import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CARS, NPC_TYPES, NPC_COLORS, makeCar, disposeCar, loadCarModel, modelReady } from './cars.js';
import { CITIES, LEFT_HAND, fetchOSM, parseOSM, proceduralCity, buildWorld, samplePath } from './world.js';
import { GameAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const BUILD = document.querySelector('meta[name="build"]')?.content || '0';
const isTouch = matchMedia('(pointer: coarse)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpAngle = (a, b, t) => { const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };
const nextFrame = () => new Promise(r => setTimeout(r, 40)); // lets the loading text paint (works in background tabs too)

// ---------------------------------------------------------------- settings
const saved = (() => { try { return JSON.parse(localStorage.getItem('citydrive') || '{}'); } catch { return {}; } })();
const settings = Object.assign({ carId: 'concept', colors: {}, cityId: 'monaco', time: 'day', quality: isTouch ? 'low' : 'high', custom: null }, saved);
const save = () => localStorage.setItem('citydrive', JSON.stringify(settings));
// v3 introduced the real 3D-model car: show it once to existing players too
if (!settings.seenModelCar) { settings.carId = 'concept'; settings.seenModelCar = true; save(); }

const QUALITY = {
  low: { pr: 1, shadows: false, bloom: false, shadowSize: 1024, fog: 900, half: 500, npc: 14 },
  high: { pr: Math.min(devicePixelRatio, 1.5), shadows: true, bloom: true, shadowSize: 2048, fog: 1500, half: 700, npc: 26 },
  ultra: { pr: Math.min(devicePixelRatio, 2), shadows: true, bloom: true, shadowSize: 4096, fog: 2000, half: 850, npc: 36 },
};
const TIMES = {
  day: { elev: 50, az: 140, turb: 4, ray: 1.1, mie: .004, sunI: 4.2, sunC: 0xfff4e5, hemiI: 1.1, exp: .62, fog: 0xb4c6d8, night: false, bloom: .22, env: 1 },
  sunset: { elev: 4, az: 255, turb: 9, ray: 2.6, mie: .009, sunI: 3, sunC: 0xffa860, hemiI: .6, exp: .62, fog: 0xc99a82, night: false, bloom: .4, env: 1 },
  night: { elev: -4, az: 255, turb: 2, ray: .5, mie: .004, sunI: .45, sunC: 0x9fb4ff, hemiI: .22, exp: 1.0, fog: 0x0b101c, night: true, bloom: .85, env: .5 },
};
const TIME_ORDER = ['day', 'sunset', 'night'];

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(innerWidth, innerHeight);
$('app').appendChild(renderer.domElement);
const pmrem = new THREE.PMREMGenerator(renderer);

// ---------------------------------------------------------------- game scene
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb4c6d8, 220, 1500);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .3, 6000);
const sky = new Sky(); sky.scale.setScalar(4500); scene.add(sky);
const envScene = new THREE.Scene(); const sky2 = new Sky(); sky2.material = sky.material; sky2.scale.setScalar(4500); envScene.add(sky2);
let envRT = null;
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x4d4438, 1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 4); scene.add(sun, sun.target);
const sunDir = new THREE.Vector3(0, 1, 0);
Object.assign(sun.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 1, far: 1000 });
sun.shadow.bias = -.0004; sun.shadow.normalBias = .05;
const stars = (() => {
  const n = 2500, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) * .9 + .05; v.normalize().multiplyScalar(3000);
    p.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const s = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: .85 }));
  s.visible = false; return s;
})();
scene.add(stars);

// post-processing
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .3, .55, .92);
composer.addPass(bloom);
composer.addPass(new OutputPass());
// gentle film grade: a touch of contrast and saturation plus a soft vignette
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(.2126, .7152, .0722));
      c = mix(vec3(l), c, 1.08);
      c = mix(c, c * c * (3.0 - 2.0 * c), .18);
      vec2 d = vUv - .5; c *= 1.0 - dot(d, d) * .55;
      gl_FragColor = vec4(c, 1.0);
    }`,
}));

// ---------------------------------------------------------------- showroom
const show = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(30, 1, .1, 200), car: null, t: .6 };
show.scene.background = new THREE.Color(0x06080c);
show.scene.fog = new THREE.Fog(0x06080c, 14, 34);
show.scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
show.scene.environmentIntensity = .8;
{
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0d0f14, roughness: .28, metalness: .7 }));
  floor.receiveShadow = true; show.scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.7, 3.76, 128).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5a1f }));
  ring.position.y = .005; show.scene.add(ring);
  const spot = new THREE.SpotLight(0xffffff, 220, 40, .55, .6, 1.2); spot.position.set(2, 10, 3); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024);
  show.scene.add(spot, spot.target);
  const rim1 = new THREE.PointLight(0xff6a2a, 30, 20); rim1.position.set(-5, 2, -4); show.scene.add(rim1);
  const rim2 = new THREE.PointLight(0x3a7bff, 30, 20); rim2.position.set(5, 2, 4); show.scene.add(rim2);
}

// ---------------------------------------------------------------- state
const audio = new GameAudio();
let state = 'menu';         // menu | loading | play
let inGame = false, world = null, worldKey = '', curCity = null;
let camMode = 0, camYaw = 0, camZoom = 1, shake = 0, lightsOn = false, updatePending = false;
const camUser = { yaw: 0, pitch: 0, t: 0 };
const player = {
  car: null, spec: null, x: 0, z: 0, yaw: 0, vx: 0, vz: 0, vF: 0, vR: 0, acc: 0, yawRate: 0, steer: 0,
  nitro: 1, nitroOn: false, rpm: 900, gear: 1, roll: 0, pitch: 0, vmax: 90, accel: 10, brake: 22, skidPrev: [null, null], lights: [],
};
const npcs = [];

// ---------------------------------------------------------------- input
const keys = Object.create(null);
const touch = { left: false, right: false, gas: false, brake: false, hand: false, nitro: false };
let gpCamPrev = false;
addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  if (state === 'menu' && e.code === 'Escape' && inGame) { resume(); return; }
  if (state !== 'play') return;
  switch (e.code) {
    case 'Escape': case 'KeyP': openMenu(); break;
    case 'KeyC': cycleCam(); break;
    case 'KeyL': lightsOn = !lightsOn; updateLights(); toast(lightsOn ? 'Headlights on' : 'Headlights off'); break;
    case 'KeyT': settings.time = TIME_ORDER[(TIME_ORDER.indexOf(settings.time) + 1) % 3]; save(); applyTime(); toast('Time: ' + settings.time); break;
    case 'KeyR': resetCar(); break;
    case 'KeyM': audio.setMuted(!audio.muted); toast(audio.muted ? 'Sound off' : 'Sound on'); break;
    case 'F1': case 'Slash': e.preventDefault(); $('help').classList.toggle('show'); break;
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function cycleCam() { camMode = (camMode + 1) % 3; toast(['Chase camera', 'Far camera', 'Bumper camera'][camMode]); }

function readInput() {
  const k = keys;
  let steer = ((k.KeyD || k.ArrowRight || touch.right) ? 1 : 0) - ((k.KeyA || k.ArrowLeft || touch.left) ? 1 : 0);
  let throttle = (k.KeyW || k.ArrowUp || touch.gas) ? 1 : 0;
  let brake = (k.KeyS || k.ArrowDown || touch.brake) ? 1 : 0;
  let hand = !!(k.Space || touch.hand);
  let nitro = !!(k.ShiftLeft || k.ShiftRight || touch.nitro);
  let horn = !!k.KeyH;
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  if (gp) {
    const ax = gp.axes[0] || 0; if (Math.abs(ax) > .12) steer = ax;
    throttle = Math.max(throttle, gp.buttons[7]?.value || 0);
    brake = Math.max(brake, gp.buttons[6]?.value || 0);
    hand = hand || !!gp.buttons[0]?.pressed; nitro = nitro || !!gp.buttons[1]?.pressed || !!gp.buttons[5]?.pressed;
    horn = horn || !!gp.buttons[10]?.pressed;
    const cb = !!gp.buttons[3]?.pressed; if (cb && !gpCamPrev) cycleCam(); gpCamPrev = cb;
    if (gp.buttons[9]?.pressed && state === 'play') openMenu();
  }
  return { steer, throttle, brake, hand, nitro, horn };
}

// camera drag / zoom
let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => { if (state === 'play') { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; } });
addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  camUser.yaw -= (e.clientX - drag.x) * .006; camUser.pitch = clamp(camUser.pitch + (e.clientY - drag.y) * .004, -.25, .9);
  drag.x = e.clientX; drag.y = e.clientY; camUser.t = performance.now();
});
addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.id) drag = null; });
renderer.domElement.addEventListener('wheel', (e) => { camZoom = clamp(camZoom + e.deltaY * .0012, .65, 2.2); }, { passive: true });

// touch buttons
for (const b of document.querySelectorAll('#touch [data-k]')) {
  const k = b.dataset.k;
  const on = (e) => { e.preventDefault(); touch[k] = true; b.classList.add('down'); };
  const off = (e) => { e.preventDefault(); touch[k] = false; b.classList.remove('down'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
}
$('tCam').addEventListener('click', cycleCam);
$('tMenu').addEventListener('click', () => openMenu());
$('hudMenu').addEventListener('click', () => openMenu());

// ---------------------------------------------------------------- quality & time
// dynamic resolution: drop the render scale when frames run slow (integrated GPUs), raise it again when there is headroom
const dyn = { scale: 1, acc: 0, n: 0 };
function adaptResolution(dt) {
  dyn.acc += dt; dyn.n++;
  if (dyn.acc < 1.2) return;
  const avg = dyn.acc / dyn.n; dyn.acc = 0; dyn.n = 0;
  if (document.hidden) return;
  let s = dyn.scale;
  if (avg > 1 / 40) s = Math.max(.5, s - .1); else if (avg < 1 / 56) s = Math.min(1, s + .05);
  if (s !== dyn.scale) { dyn.scale = s; const pr = QUALITY[settings.quality].pr * s; renderer.setPixelRatio(pr); composer.setPixelRatio(pr); }
}
function applyQuality() {
  const q = QUALITY[settings.quality];
  dyn.scale = 1; dyn.acc = 0; dyn.n = 0;
  renderer.setPixelRatio(q.pr); renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(q.pr); composer.setSize(innerWidth, innerHeight);
  sun.castShadow = q.shadows;
  if (sun.shadow.mapSize.x !== q.shadowSize) { sun.shadow.mapSize.set(q.shadowSize, q.shadowSize); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  scene.fog.far = q.fog; scene.fog.near = q.fog * .14;
}
function applyTime() {
  const T = TIMES[settings.time], u = sky.material.uniforms;
  u.turbidity.value = T.turb; u.rayleigh.value = T.ray; u.mieCoefficient.value = T.mie; u.mieDirectionalG.value = .8;
  const sp = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - T.elev), THREE.MathUtils.degToRad(T.az));
  u.sunPosition.value.copy(sp);
  if (T.night) sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(50), THREE.MathUtils.degToRad(T.az + 40));
  else sunDir.copy(sp).setY(Math.max(sp.y, .1)).normalize();
  sun.color.set(T.sunC); sun.intensity = T.sunI;
  hemi.intensity = T.hemiI; hemi.color.set(T.night ? 0x40507a : 0xcfe3ff);
  scene.fog.color.set(T.fog);
  sky.visible = !T.night;
  scene.background = T.night ? new THREE.Color(T.fog) : null;
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene); scene.environment = envRT.texture; scene.environmentIntensity = T.env;
  stars.visible = T.night;
  bloom.strength = T.bloom; bloom.threshold = T.night ? .75 : .95;
  if (world) world.setNight(T.night);
  lightsOn = T.night || settings.time === 'sunset';
  updateLights();
  setSeg('timeSeg', settings.time);
}
function updateLights() {
  for (const l of player.lights) l.intensity = lightsOn ? 260 : 0;
  if (player.car) player.car.headMat.emissiveIntensity = lightsOn ? 4 : 1.2;
}

// ---------------------------------------------------------------- player car
function currentSpec() { return CARS.find(c => c.id === settings.carId) || CARS[0]; }
function setPlayerCar() {
  const spec = currentSpec(), color = settings.colors[spec.id] || spec.color;
  if (player.car) { scene.remove(player.car.root); disposeCar(player.car); }
  const car = makeCar(spec, color, { shadows: true });
  player.car = car; player.spec = spec;
  player.vmax = spec.topKmh / 3.6; player.accel = 27.8 / spec.zero100 * 1.08; player.brake = 24;
  player.lights = [];
  for (const sd of [-1, 1]) {
    const l = new THREE.SpotLight(0xfff0dc, 0, 110, .5, .55, 1.3);
    l.position.set(spec.L / 2 - .2, spec.p.nose + .05, sd * .6);
    l.target.position.set(spec.L / 2 + 25, 0, sd * 2);
    car.root.add(l, l.target); player.lights.push(l);
  }
  scene.add(car.root);
  updateLights();
  $('hudCar').textContent = `${spec.make} ${spec.model}`;
}
function placePlayer(x, z, yaw) {
  Object.assign(player, { x, z, yaw, vx: 0, vz: 0, vF: 0, vR: 0, yawRate: 0, steer: 0, skidPrev: [null, null] });
  camYaw = yaw; camUser.yaw = 0; camUser.pitch = 0;
  camera.position.set(x - Math.cos(yaw) * 7, 2.6, z + Math.sin(yaw) * 7);
}
function resetCar() {
  const nr = world.nearestRoad(player.x, player.z, 300);
  if (nr) {
    let yaw = Math.atan2(-nr.dz, nr.dx);
    if (Math.cos(yaw - player.yaw) < 0) yaw += Math.PI;
    placePlayer(nr.px, nr.pz, yaw);
  } else placePlayer(world.spawn.x, world.spawn.z, world.spawn.yaw);
  toast('Car reset to the road');
}

// ---------------------------------------------------------------- physics
function stepPlayer(dt, inp) {
  const P = player, s = P.spec;
  const fx = Math.cos(P.yaw), fz = -Math.sin(P.yaw), rx = Math.sin(P.yaw), rz = Math.cos(P.yaw);
  let vF = P.vx * fx + P.vz * fz, vR = P.vx * rx + P.vz * rz;
  const nitroOn = inp.nitro && P.nitro > .02 && inp.throttle > 0 && vF > -1;
  P.nitroOn = nitroOn;
  P.nitro = nitroOn ? Math.max(0, P.nitro - dt * .22) : Math.min(1, P.nitro + dt * .05);
  const vmax = P.vmax * (nitroOn ? 1.15 : 1);
  let a = 0;
  if (inp.throttle > 0) {
    if (vF < -.5) a += P.brake * inp.throttle;
    else { const ratio = Math.max(0, vF) / vmax; a += P.accel * (nitroOn ? 1.7 : 1) * inp.throttle * Math.max(0, 1 - ratio * ratio); }
  }
  if (inp.brake > 0) {
    if (vF > .5) a -= P.brake * inp.brake;
    else if (!(inp.throttle > 0)) a -= 8 * inp.brake * Math.max(0, 1 + Math.min(0, vF) / 18);
  }
  vF += a * dt;
  const drag = ((inp.throttle > 0 || inp.brake > 0) ? .15 : 1.1) + (inp.hand ? 5.5 : 0) + .00012 * vF * vF;
  vF -= Math.sign(vF) * Math.min(Math.abs(vF), drag * dt);

  const st = inp.steer;
  const rate = (Math.abs(st) < Math.abs(P.steer) || st * P.steer < 0) ? 10 : 5;
  P.steer += (st - P.steer) * Math.min(1, dt * rate);
  const spd = Math.abs(vF);
  const maxA = .6 / (1 + spd / 20);
  let yr = -vF / s.wb * Math.tan(P.steer * maxA);
  const drifting = inp.hand && spd > 6;
  if (drifting) yr *= 1.65;
  P.yawRate += (yr - P.yawRate) * Math.min(1, dt * (drifting ? 5 : 14));
  const grip = drifting ? 1.1 : (inp.hand ? 3 : 8.5 * s.grip);
  vR *= Math.exp(-grip * dt);
  P.vx = fx * vF + rx * vR; P.vz = fz * vF + rz * vR;
  P.yaw += P.yawRate * dt;
  P.x += P.vx * dt; P.z += P.vz * dt;
  P.vF = vF; P.vR = vR; P.acc = a;
}
function impact(nx, nz, bounce) {
  const l = Math.hypot(nx, nz); if (l < 1e-6) return; nx /= l; nz /= l;
  const vn = player.vx * nx + player.vz * nz;
  if (vn >= 0) return;
  player.vx -= (1 + bounce) * vn * nx; player.vz -= (1 + bounce) * vn * nz;
  const imp = -vn, f = Math.max(.55, 1 - imp * .012);
  player.vx *= f; player.vz *= f;
  if (imp > 3) {
    shake = Math.min(1.2, imp * .035);
    audio.crash(Math.min(1, imp / 30));
    player.yawRate += (Math.random() - .5) * Math.min(imp, 30) * .04;
  }
}
function carCircles(x, z, yaw, s) {
  const fx = Math.cos(yaw), fz = -Math.sin(yaw), o = s.L * .3;
  return [[x + fx * o, z + fz * o], [x, z], [x - fx * o, z - fz * o]];
}
function collidePlayer() {
  const s = player.spec, rad = s.W * .5;
  let nx = 0, nz = 0, hit = false;
  for (const [cx, cz] of carCircles(player.x, player.z, player.yaw, s)) {
    const p = world.pushOut(cx, cz, rad);
    if (p) { player.x += p.dx; player.z += p.dz; nx += p.dx; nz += p.dz; hit = true; }
  }
  if (hit) impact(nx, nz, .25);
}

// ---------------------------------------------------------------- traffic
function clearNPCs() { for (const n of npcs) { scene.remove(n.car.root); disposeCar(n.car); } npcs.length = 0; }
function spawnNPCs(count) {
  clearNPCs();
  if (!world.traffic.roads.length) return;
  for (let i = 0; i < count; i++) {
    const type = NPC_TYPES[(Math.random() * NPC_TYPES.length) | 0];
    const taxi = curCity?.taxi && type.id === 'n-sedan' && Math.random() < .6;
    const color = taxi ? '#f5c400' : NPC_COLORS[(Math.random() * NPC_COLORS.length) | 0];
    const car = makeCar(type, color, { shadows: false, taxi, lod: true });
    car.body.children[0].castShadow = settings.quality !== 'low';
    const n = { car, road: null, rev: false, s: 0, speed: 8, cruise: 10, x: 0, z: 0, yaw: 0, stopT: 0, waitT: 0, ghostT: 0 };
    placeNPC(n, i < count * .4 ? 'near' : 'any');
    scene.add(car.root); npcs.push(n);
  }
}
function placeNPC(n, mode = 'ring') {
  const R = world.traffic.roads;
  const [lo, hi] = mode === 'near' ? [25, 160] : mode === 'ring' ? [130, 380] : [25, 1e9];
  for (let tries = 0; tries < 60; tries++) {
    const road = R[(Math.random() * R.length) | 0];
    const s = Math.random() * road.len;
    const pt = samplePath(road, s, false);
    if (Math.abs(pt.x) > world.half || Math.abs(pt.z) > world.half) continue;
    const d = Math.hypot(pt.x - player.x, pt.z - player.z);
    if (d < 25) continue;
    if ((d < lo || d > hi) && tries < 55) continue;
    n.road = road; n.rev = road.oneway ? false : Math.random() < .5; n.s = n.rev ? road.len - s : s;
    n.cruise = (road.w >= 9 ? 13 : 9) + Math.random() * 3; n.speed = n.cruise;
    const p = npcPos(n); n.x = p.x; n.z = p.z; n.yaw = Math.atan2(-p.dz, p.dx);
    return;
  }
}
function npcPos(n) {
  const p = samplePath(n.road, n.s, n.rev);
  const off = n.road.oneway ? 0 : n.road.w * .25, side = world.left ? -1 : 1;
  p.x += -p.dz * off * side; p.z += p.dx * off * side;
  return p;
}
function nextRoad(n) {
  const { starts, keyOf } = world.traffic;
  const end = n.rev ? n.road.pts[0] : n.road.pts[n.road.pts.length - 1];
  const opts = (starts.get(keyOf(end)) || []).filter(o => o.road !== n.road);
  if (opts.length) { const o = opts[(Math.random() * opts.length) | 0]; n.road = o.road; n.rev = o.rev; }
  else if (!n.road.oneway) n.rev = !n.rev;
  else { placeNPC(n, 'ring'); return false; }
  n.cruise = (n.road.w >= 9 ? 13 : 9) + Math.random() * 3;
  return true;
}
function updateNPCs(dt) {
  const s = player.spec;
  for (const n of npcs) {
    const fx = Math.cos(n.yaw), fz = -Math.sin(n.yaw);
    const blockedBy = (x, z, len) => {
      const dx = x - n.x, dz = z - n.z, ahead = dx * fx + dz * fz, lat = dx * -fz + dz * fx;
      return ahead > 0 && ahead < len && Math.abs(lat) < 2.4;
    };
    let target = n.cruise;
    if (blockedBy(player.x, player.z, 13)) target = 0;
    let byCar = false;
    if (n.ghostT <= 0) for (const m of npcs) { if (m !== n && Math.abs(m.x - n.x) < 12 && Math.abs(m.z - n.z) < 12 && blockedBy(m.x, m.z, 10)) { byCar = true; break; } }
    if (byCar) { target = 0; n.waitT += dt; if (n.waitT > 4) { n.ghostT = 3; n.waitT = 0; } } else n.waitT = 0;
    n.ghostT -= dt;
    if (n.stopT > 0) { n.stopT -= dt; target = 0; }
    n.speed += clamp(target - n.speed, -9 * dt, 3 * dt);
    n.s += n.speed * dt;
    let guard = 0;
    while (n.s > n.road.len && guard++ < 4) { const over = n.s - n.road.len; if (!nextRoad(n)) break; n.s = over; }
    const p = npcPos(n);
    const k = 1 - Math.exp(-dt * 8);
    n.x += (p.x - n.x) * k; n.z += (p.z - n.z) * k;
    n.yaw = lerpAngle(n.yaw, Math.atan2(-p.dz, p.dx), 1 - Math.exp(-dt * 7));
    if (Math.hypot(n.x - player.x, n.z - player.z) > 450) { placeNPC(n, 'ring'); }
    const r = n.car.root; r.position.set(n.x, 0, n.z); r.rotation.y = n.yaw;
    for (const w of n.car.wheels) w.spin.rotation.z -= n.speed * dt / n.car.spec.r;
    // collision with player
    const dx = player.x - n.x, dz = player.z - n.z;
    if (dx * dx + dz * dz < 64) {
      const rr = s.W * .5 + n.car.spec.W * .5;
      const nc = carCircles(n.x, n.z, n.yaw, n.car.spec);
      let nx = 0, nz = 0, hit = false;
      for (let i = 0; i < 3; i++) {
        const pc = carCircles(player.x, player.z, player.yaw, s)[i];
        for (const [cx, cz] of nc) {
          const ex = pc[0] - cx, ez = pc[1] - cz, d = Math.hypot(ex, ez);
          if (d < rr && d > 1e-4) { const push = (rr - d) / d; player.x += ex * push; player.z += ez * push; nx += ex * push; nz += ez * push; hit = true; }
        }
      }
      if (hit) { impact(nx, nz, .35); n.stopT = 2.5; }
    }
  }
}

// ---------------------------------------------------------------- effects
const SKID_N = 2500;
const skids = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, .26).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x0c0c0c, transparent: true, opacity: .5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), SKID_N);
skids.count = 0; skids.renderOrder = 6; skids.frustumCulled = false; scene.add(skids);
let skidIdx = 0;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function addSkid(x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
  if (len < .05 || len > 4) return;
  _q.setFromEuler(_e.set(0, Math.atan2(-dz, dx), 0));
  _m.compose(_v.set((x1 + x2) / 2, .075, (z1 + z2) / 2), _q, _s.set(len + .04, 1, 1));
  skids.setMatrixAt(skidIdx, _m); skidIdx = (skidIdx + 1) % SKID_N;
  skids.count = Math.max(skids.count, skidIdx === 0 ? SKID_N : skidIdx);
  skids.instanceMatrix.needsUpdate = true;
}
// smoke particles
const SMOKE_N = 400;
const smoke = (() => {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(SMOKE_N * 3), alpha = new Float32Array(SMOKE_N), size = new Float32Array(SMOKE_N);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: new THREE.CanvasTexture(c) }, uScale: { value: 400 }, uColor: { value: new THREE.Color(.85, .85, .85) } },
    vertexShader: `attribute float aAlpha; attribute float aSize; varying float vA; uniform float uScale;
      void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 uColor; varying float vA;
      void main(){ vec4 t = texture2D(map, gl_PointCoord); if (vA <= 0.0) discard; gl_FragColor = vec4(uColor, t.a * vA); }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 10;
  return { pts, pos, alpha, size, vel: new Float32Array(SMOKE_N * 3), life: new Float32Array(SMOKE_N), max: new Float32Array(SMOKE_N), idx: 0 };
})();
scene.add(smoke.pts);
function puff(x, z, vx, vz, k) {
  const i = smoke.idx; smoke.idx = (smoke.idx + 1) % SMOKE_N;
  smoke.pos.set([x, .4, z], i * 3);
  smoke.vel.set([vx * .25 + (Math.random() - .5) * 1.5, .8 + Math.random(), vz * .25 + (Math.random() - .5) * 1.5], i * 3);
  smoke.max[i] = smoke.life[i] = 1.4 + Math.random() * 1.2; smoke.size[i] = .8 + k; smoke.alpha[i] = .35;
}
function updateSmoke(dt) {
  for (let i = 0; i < SMOKE_N; i++) {
    if (smoke.life[i] <= 0) { smoke.alpha[i] = 0; continue; }
    smoke.life[i] -= dt;
    for (let j = 0; j < 3; j++) smoke.pos[i * 3 + j] += smoke.vel[i * 3 + j] * dt;
    smoke.size[i] += dt * 2.4;
    smoke.alpha[i] = Math.max(0, smoke.life[i] / smoke.max[i]) * .32;
  }
  const g = smoke.pts.geometry;
  g.attributes.position.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  smoke.pts.material.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  smoke.pts.material.uniforms.uColor.value.setScalar(TIMES[settings.time].night ? .35 : .85);
}

// ---------------------------------------------------------------- update
const GEARS = [.2, .33, .46, .59, .72, .86, 1.0];
function update(dt) {
  const inp = readInput();
  const SUB = clamp(Math.ceil(dt * 240), 2, 30); // fixed ~4 ms physics steps, whatever the frame rate
  for (let i = 0; i < SUB; i++) { stepPlayer(dt / SUB, inp); collidePlayer(); }
  updateNPCs(dt);

  const P = player, s = P.spec, car = P.car;
  const spd = Math.abs(P.vF), kmh = spd * 3.6;
  // gears & rpm
  let g = 0; while (g < 6 && spd > P.vmax * GEARS[g] * .97) g++;
  let rpmT = 1000 + 7000 * Math.min(1, spd / (P.vmax * GEARS[g]));
  if (inp.throttle && spd < 6) rpmT = Math.max(rpmT, 2500 + (inp.brake ? 4000 : 1500));
  if (!inp.throttle) rpmT = Math.max(900, rpmT * .9);
  P.rpm += (rpmT - P.rpm) * Math.min(1, dt * 9);
  P.gear = P.vF < -.5 ? 'R' : (spd < .5 && !inp.throttle ? 'N' : String(g + 1));

  // visuals
  car.root.position.set(P.x, 0, P.z);
  car.root.rotation.y = P.yaw;
  const lat = P.vF * P.yawRate;
  P.roll += (clamp(lat * .006, -.06, .06) - P.roll) * Math.min(1, dt * 6);
  P.pitch += (clamp(P.acc * .0035, -.045, .03) - P.pitch) * Math.min(1, dt * 6);
  car.body.rotation.set(P.roll, 0, P.pitch);
  const maxA = .6 / (1 + spd / 20);
  for (const w of car.wheels) {
    w.spin.rotation.z -= P.vF * dt / s.r;
    if (w.front) w.pivot.rotation.y = -P.steer * maxA * 1.15;
  }
  const braking = (inp.brake && P.vF > .5) || (inp.throttle && P.vF < -.5) || inp.hand;
  car.tailMat.emissiveIntensity = braking ? 5 : (lightsOn ? 1.4 : .6);

  // skids & smoke
  const slip = Math.abs(P.vR);
  const burnout = inp.throttle && inp.brake && spd < 8;
  const skidding = (slip > 2.4 && spd > 3) || (inp.hand && spd > 4) || burnout || (inp.brake && spd > 22 && P.vF > 0);
  const fx = Math.cos(P.yaw), fz = -Math.sin(P.yaw), rx = Math.sin(P.yaw), rz = Math.cos(P.yaw);
  for (let i = 0; i < 2; i++) {
    const sd = i ? 1 : -1;
    const wx = P.x - fx * s.wb / 2 + rx * sd * (s.W / 2 - .25), wz = P.z - fz * s.wb / 2 + rz * sd * (s.W / 2 - .25);
    if (skidding) {
      if (P.skidPrev[i]) addSkid(P.skidPrev[i][0], P.skidPrev[i][1], wx, wz);
      P.skidPrev[i] = [wx, wz];
      if ((slip > 4 || burnout) && Math.random() < .6) puff(wx, wz, P.vx, P.vz, Math.min(2, slip * .1));
    } else P.skidPrev[i] = null;
  }
  updateSmoke(dt);

  // camera
  updateCamera(dt, spd);

  // sun follows the car
  sun.target.position.set(P.x, 0, P.z);
  sun.position.set(P.x + sunDir.x * 400, sunDir.y * 400, P.z + sunDir.z * 400);
  stars.position.copy(camera.position);

  audio.update(P.rpm, inp.throttle, spd, burnout ? 8 : slip, s.cyl || 8);
  audio.horn(inp.horn);

  // HUD
  $('spd').textContent = Math.round(kmh);
  $('gear').textContent = P.gear;
  $('nitroFill').style.width = (P.nitro * 100).toFixed(0) + '%';
  $('nitroFill').classList.toggle('on', P.nitroOn);
  drawGauge(P.rpm);
  drawMinimap();
}

const camPos = new THREE.Vector3(), lookAt = new THREE.Vector3();
function updateCamera(dt, spd) {
  const P = player, s = P.spec;
  if (performance.now() - camUser.t > 1600 && !drag) { const k = Math.exp(-dt * 2.5); camUser.yaw *= k; camUser.pitch *= k; }
  if (camMode === 2) {
    camPos.set(s.L / 2 - .9, s.p.hood + .32, 0); P.car.root.localToWorld(camPos);
    lookAt.set(s.L / 2 + 30, .8, 0); P.car.root.localToWorld(lookAt);
    camera.position.copy(camPos);
  } else {
    const far = camMode === 1;
    const dist = (far ? 11 : 5.6 + s.L * .2) * camZoom + spd * .022;
    const hgt = (far ? 4 : 1.6 + s.p.roof * .45) * camZoom;
    camYaw = lerpAngle(camYaw, P.yaw + camUser.yaw, 1 - Math.exp(-dt * (3.5 + spd * .03)));
    let cx = P.x - Math.cos(camYaw) * dist, cz = P.z + Math.sin(camYaw) * dist;
    const cy = hgt + camUser.pitch * dist;
    for (let k = 1; k <= 10; k++) {
      const t = k / 10, tx = P.x + (cx - P.x) * t, tz = P.z + (cz - P.z) * t;
      const b = world.insideBuilding(tx, tz);
      if (b && b.h > cy * t) { const tt = Math.max(.25, (k - 1.5) / 10); cx = P.x + (cx - P.x) * tt; cz = P.z + (cz - P.z) * tt; break; }
    }
    camPos.set(cx, cy, cz);
    camera.position.lerp(camPos, 1 - Math.exp(-dt * 14));
    lookAt.set(P.x + Math.cos(P.yaw) * 2, 1 + (far ? .4 : 0), P.z - Math.sin(P.yaw) * 2);
  }
  if (shake > .01) { camera.position.x += (Math.random() - .5) * shake; camera.position.y += (Math.random() - .5) * shake * .6; shake *= Math.exp(-dt * 6); }
  camera.lookAt(lookAt);
  const fov = 58 + Math.min(spd * .17, 22) + (P.nitroOn ? 8 : 0);
  camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- HUD drawing
const gctx = $('rpm').getContext('2d');
function drawGauge(rpm) {
  const c = gctx, W = 220, cx = 110, cy = 110, R = 92;
  c.clearRect(0, 0, W, W);
  const a0 = Math.PI * .75, a1 = Math.PI * 2.25, span = a1 - a0, max = 9000;
  c.lineCap = 'round';
  c.lineWidth = 10; c.strokeStyle = 'rgba(255,255,255,.1)'; c.beginPath(); c.arc(cx, cy, R, a0, a1); c.stroke();
  c.strokeStyle = 'rgba(255,40,40,.45)'; c.beginPath(); c.arc(cx, cy, R, a0 + span * 7500 / max, a1); c.stroke();
  const v = clamp(rpm / max, 0, 1);
  const gr = c.createLinearGradient(0, 220, 220, 0); gr.addColorStop(0, '#ffb300'); gr.addColorStop(1, '#ff2d2d');
  c.strokeStyle = gr; c.shadowColor = '#ff5a1f'; c.shadowBlur = 12;
  c.beginPath(); c.arc(cx, cy, R, a0, a0 + span * v); c.stroke(); c.shadowBlur = 0;
  c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '600 12px Rajdhani, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let i = 0; i <= 9; i++) {
    const a = a0 + span * i / 9;
    c.fillText(i, cx + Math.cos(a) * (R - 20), cy + Math.sin(a) * (R - 20));
  }
}
const mctx = $('mini').getContext('2d');
function drawMinimap() {
  const c = mctx, S = 220, mm = world.minimap, zoom = 1.25;
  c.save(); c.clearRect(0, 0, S, S);
  c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); c.clip();
  c.fillStyle = '#121822'; c.fillRect(0, 0, S, S);
  c.translate(S / 2, S / 2); c.rotate(player.yaw - Math.PI / 2); c.scale(zoom, zoom);
  c.drawImage(mm.canvas, -(player.x + mm.E), -(player.z + mm.E));
  c.fillStyle = '#ffd34d';
  for (const n of npcs) { const dx = n.x - player.x, dz = n.z - player.z; if (dx * dx + dz * dz < 30000) { c.fillRect(dx - 2, dz - 2, 4, 4); } }
  c.restore();
  c.fillStyle = '#ff4b2b'; c.strokeStyle = '#fff'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(S / 2, S / 2 - 10); c.lineTo(S / 2 + 7, S / 2 + 8); c.lineTo(S / 2, S / 2 + 4); c.lineTo(S / 2 - 7, S / 2 + 8); c.closePath(); c.fill(); c.stroke();
  // north marker
  const th = player.yaw - Math.PI / 2; // world north (-z) after the map rotation
  const nxp = S / 2 + Math.sin(th) * (S / 2 - 14), nyp = S / 2 - Math.cos(th) * (S / 2 - 14);
  c.fillStyle = '#fff'; c.font = '700 13px Rajdhani, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', nxp, nyp);
}

// ---------------------------------------------------------------- render loop
const clock = new THREE.Clock();
function renderShowroom(dt) {
  show.t += dt * .22;
  const r = 9.5;
  show.cam.position.set(Math.cos(show.t) * r, 2.1, Math.sin(show.t) * r);
  show.cam.lookAt(0, .6, 0);
  renderer.toneMappingExposure = 1.0;
  renderer.render(show.scene, show.cam);
}
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 8);
  if (state === 'play') {
    update(dt);
    world?.update?.(clock.elapsedTime);
    adaptResolution(dt);
    renderer.toneMappingExposure = TIMES[settings.time].exp;
    if (QUALITY[settings.quality].bloom) composer.render(); else renderer.render(scene, camera);
  } else if (state === 'menu') renderShowroom(dt);
  else if (state === 'loading') renderShowroom(dt);
});
function onResize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h); composer.setSize(w, h); bloom.resolution.set(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  show.cam.aspect = w / h;
  if (w > 900) show.cam.setViewOffset(w, h, w * .17, -h * .04, w, h); else show.cam.clearViewOffset();
  show.cam.updateProjectionMatrix();
}
addEventListener('resize', onResize);

// ---------------------------------------------------------------- city loading
function cityList() { const l = [...CITIES]; if (settings.custom) l.splice(0, 0, { ...settings.custom, id: 'custom' }); return l; }
function currentCity() { return cityList().find(c => c.id === settings.cityId) || CITIES[0]; }
function setLoading(msg) { $('loadMsg').textContent = msg; }
async function loadCity(city, half) {
  $('loading').classList.add('show');
  setLoading(`Heading to ${city.name}…`);
  await nextFrame();
  let data = null, label = `${city.name} · ${city.country || ''}`;
  if (!city.procedural) {
    try {
      const json = await fetchOSM(city.lat, city.lon, half, setLoading);
      data = parseOSM(json, city.lat, city.lon, half);
      if (data.roads.length < 5) throw new Error('no drivable roads found here');
    } catch (e) {
      console.warn(e);
      toast(`Couldn't reach the map servers (${e.message}). Driving a generated city instead. Try ${city.name} again in a minute.`, 7000);
      data = null;
      label = `Neo City · generated (map servers busy)`;
    }
  }
  if (!data) data = proceduralCity(half, 1234);
  const usedReal = !!data && !city.procedural && !label.startsWith('Neo');
  setLoading(`Building ${data.buildings.length.toLocaleString()} buildings and ${data.roads.length.toLocaleString()} streets…`);
  await nextFrame(); await nextFrame();
  if (world) { scene.remove(world.group); world.dispose(); }
  clearNPCs();
  skids.count = 0; skidIdx = 0;
  world = buildWorld(data, { lat: city.procedural || !usedReal ? undefined : city.lat, lon: city.procedural || !usedReal ? undefined : city.lon, quality: settings.quality });
  world.left = usedReal && !!city.left;
  scene.add(world.group);
  curCity = usedReal ? city : null;
  $('hudCity').textContent = label;
  return usedReal || city.procedural;
}

async function drive() {
  audio.init();
  const city = currentCity(), q = QUALITY[settings.quality];
  const key = (city.id === 'custom' ? `c:${city.lat.toFixed(4)},${city.lon.toFixed(4)}` : city.id) + '|' + q.half;
  $('menu').classList.add('hidden');
  applyQuality();
  if (!inGame || key !== worldKey) {
    state = 'loading';
    const ok = await loadCity(city, q.half);
    worldKey = ok ? key : 'fallback';
    await ensureModel();
    setPlayerCar();
    placePlayer(world.spawn.x, world.spawn.z, world.spawn.yaw);
    spawnNPCs(q.npc);
    inGame = true;
    setLoading('Starting engine…'); await nextFrame();
    $('loading').classList.remove('show');
    if (!localStorage.getItem('citydrive-helped')) { $('help').classList.add('show'); localStorage.setItem('citydrive-helped', '1'); setTimeout(() => $('help').classList.remove('show'), 12000); }
  } else {
    const keepX = player.x, keepZ = player.z, keepYaw = player.yaw;
    await ensureModel();
    setPlayerCar(); placePlayer(keepX, keepZ, keepYaw);
    $('loading').classList.remove('show');
  }
  applyTime();
  resume();
}
async function ensureModel() {
  const s = currentSpec(); if (!s.glb || modelReady(s)) return;
  $('loading').classList.add('show'); setLoading(`Loading the ${s.make} ${s.model}…`);
  try { await loadCarModel(s); } catch (e) { console.warn(e); toast('Could not load the 3D car model; using the simple version.'); }
}
function resume() {
  state = 'play';
  $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !isTouch);
  audio.setPaused(false);
  clock.getDelta();
}
function openMenu() {
  if (updatePending) { location.reload(); return; }
  state = 'menu';
  $('menu').classList.remove('hidden'); $('hud').classList.add('hidden'); $('touch').classList.add('hidden');
  $('resumeBtn').classList.toggle('hidden', !inGame);
  $('driveBtn').textContent = inGame ? 'DRIVE' : 'DRIVE';
  audio.setPaused(true); audio.horn(false);
  for (const k in touch) touch[k] = false;
}

// ---------------------------------------------------------------- menu UI
function toast(msg, ms = 2200) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.tm); toast.tm = setTimeout(() => t.classList.remove('show'), ms);
}
function setSeg(id, v) { for (const b of $(id).querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === v); }
function renderCars() {
  const s = currentSpec();
  $('carMake').textContent = s.make; $('carModel').textContent = s.model;
  const bar = (label, v) => `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.round(clamp(v, .06, 1) * 100)}%"></i></div></div>`;
  $('carStats').innerHTML = bar('Top speed', s.topKmh / 420) + bar('Acceleration', (5.2 - s.zero100) / 2.9) + bar('Handling', (s.grip - .65) / .47) +
    `<div class="nums"><b>${s.hp}</b> hp <i></i> <b>${s.zero100}s</b> 0–100 <i></i> <b>${s.topKmh}</b> km/h</div>`;
  const cur = settings.colors[s.id] || s.color;
  $('swatches').innerHTML = s.colors.map(c => `<button style="--c:${c}" data-c="${c}" class="${c === cur ? 'on' : ''}" aria-label="Paint ${c}"></button>`).join('');
  $('carIdx').textContent = `${CARS.indexOf(s) + 1} / ${CARS.length}`;
  if (s.glb && !modelReady(s)) loadCarModel(s).then(() => { if (currentSpec() === s && state !== 'play') renderCars(); }).catch(e => console.warn('car model', e));
  if (show.car) { show.scene.remove(show.car.root); disposeCar(show.car); }
  show.car = makeCar(s, cur, { shadows: true });
  show.scene.add(show.car.root);
}
$('swatches').addEventListener('click', (e) => {
  const c = e.target.closest('button')?.dataset.c; if (!c) return;
  settings.colors[currentSpec().id] = c; save();
  show.car.paint.color.set(c);
  for (const b of $('swatches').children) b.classList.toggle('on', b.dataset.c === c);
});
const stepCar = (d) => { const i = CARS.indexOf(currentSpec()); settings.carId = CARS[(i + d + CARS.length) % CARS.length].id; save(); renderCars(); };
$('prevCar').addEventListener('click', () => stepCar(-1));
$('nextCar').addEventListener('click', () => stepCar(1));
addEventListener('keydown', (e) => {
  if (state !== 'menu' || e.target.tagName === 'INPUT') return;
  if (e.code === 'ArrowLeft') stepCar(-1); else if (e.code === 'ArrowRight') stepCar(1); else if (e.code === 'Enter') drive();
});
function renderCities() {
  $('cities').innerHTML = cityList().map(c => `<button data-id="${c.id}" class="${c.id === settings.cityId ? 'on' : ''}"><b>${esc(c.name)}</b><span>${esc(c.country || '')}</span></button>`).join('');
}
const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
$('cities').addEventListener('click', (e) => {
  const id = e.target.closest('button')?.dataset.id; if (!id) return;
  settings.cityId = id; save(); renderCities();
});
async function searchPlace() {
  const q = $('placeInput').value.trim(); if (!q) return;
  $('placeGo').disabled = true; $('placeGo').textContent = '…';
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=' + encodeURIComponent(q), { headers: { 'Accept-Language': 'en' } });
    const j = await r.json();
    if (!j.length) throw new Error('Place not found');
    const it = j[0], a = it.address || {};
    const country = [a.city || a.town || a.village || a.state, a.country].filter(Boolean).join(', ');
    settings.custom = { name: it.name || q, country, lat: +it.lat, lon: +it.lon, left: LEFT_HAND.has(a.country_code) };
    settings.cityId = 'custom'; save(); renderCities();
    toast(`Found ${settings.custom.name}. Press DRIVE!`);
  } catch (e) { toast(e.message === 'Place not found' ? 'Place not found. Try a city or street name.' : 'Search failed. Check your connection.'); }
  $('placeGo').disabled = false; $('placeGo').textContent = 'Go';
}
$('placeGo').addEventListener('click', searchPlace);
$('placeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchPlace(); });
$('myLoc').addEventListener('click', () => {
  if (!navigator.geolocation) { toast('Location is not available'); return; }
  navigator.geolocation.getCurrentPosition((p) => {
    settings.custom = { name: 'Near me', country: 'Your neighbourhood', lat: p.coords.latitude, lon: p.coords.longitude, left: false };
    settings.cityId = 'custom'; save(); renderCities(); toast('Got your location. Press DRIVE!');
  }, () => toast('Location permission was denied'));
});
for (const [id, key] of [['timeSeg', 'time'], ['qualSeg', 'quality']]) {
  $(id).addEventListener('click', (e) => {
    const v = e.target.closest('button')?.dataset.v; if (!v) return;
    settings[key] = v; save(); setSeg(id, v);
    if (key === 'time' && inGame) applyTime();
  });
}
$('driveBtn').addEventListener('click', drive);
$('resumeBtn').addEventListener('click', resume);
$('ver').textContent = 'v' + BUILD;

// ---------------------------------------------------------------- auto update
async function checkUpdate() {
  try {
    const r = await fetch('version.txt?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const v = (await r.text()).trim().split(/\s+/)[0];
    if (/^\d+$/.test(v) && +v > +BUILD) {
      if (state !== 'play') location.reload();
      else if (!updatePending) { updatePending = true; toast('A new version is ready. It installs when you open the menu (Esc).', 6000); }
    }
  } catch { /* offline */ }
}
setTimeout(checkUpdate, 4000); setInterval(checkUpdate, 3 * 60 * 1000);

// ---------------------------------------------------------------- boot
window.citydrive = { player, npcs, show, camera, renderer, scene, composer, get world() { return world; } }; // handy for debugging in the console
renderCities(); renderCars(); setSeg('timeSeg', settings.time); setSeg('qualSeg', settings.quality);
applyQuality(); onResize();
$('boot').classList.add('done');
setTimeout(() => $('boot')?.remove(), 900);
