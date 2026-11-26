// Procedural car models + specs.
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Side profile: heights (m) at key points along the length (x = metres from centre, front is +x)
const P = (nose, hoodX, hood, cowlX, cowl, wsX, roof, roofX, deckX, deck, tail) =>
  ({ nose, hoodX, hood, cowlX, cowl, wsX, roof, roofX, deckX, deck, tail });

export const CARS = [
  { id: 'sf90', make: 'Ferrari', model: 'SF90 Stradale', color: '#b3121b', colors: ['#b3121b', '#f2c500', '#f4f4f4', '#111111', '#1d3f8f'],
    L: 4.71, W: 1.97, wb: 2.65, r: .35, clr: .17, p: P(.52, 1.65, .76, .85, .9, -.15, 1.18, -.6, -1.35, 1.0, .96),
    taper: .18, bevel: .09, topKmh: 340, zero100: 2.5, hp: 986, grip: 1.05, cyl: 8 },
  { id: 'svj', make: 'Lamborghini', model: 'Aventador SVJ', color: '#7ac70c', colors: ['#7ac70c', '#f29b00', '#e8e8e8', '#5b2a86', '#141414'],
    L: 4.94, W: 2.1, wb: 2.7, r: .36, clr: .16, p: P(.48, 1.95, .68, 1.05, .86, -.2, 1.13, -.65, -1.45, .98, .9),
    taper: .2, bevel: .04, facet: true, wing: true, rim: '#1c1c1e', topKmh: 350, zero100: 2.8, hp: 770, grip: 1.1, cyl: 12 },
  { id: '911', make: 'Porsche', model: '911 Turbo S', color: '#c9ccd1', colors: ['#c9ccd1', '#1f5fae', '#e5e1d6', '#2f4f2f', '#c21f1f'],
    L: 4.53, W: 1.9, wb: 2.45, r: .34, clr: .15, p: P(.6, 1.65, .78, .75, .88, .05, 1.29, -.45, -1.7, .95, .9),
    taper: .2, bevel: .11, topKmh: 330, zero100: 2.7, hp: 650, grip: 1.05, cyl: 6 },
  { id: 'amggt', make: 'Mercedes-AMG', model: 'GT Black Series', color: '#e07b00', colors: ['#e07b00', '#c0c4c8', '#1a1a1a', '#f2f2f2', '#2c4a2e'],
    L: 4.55, W: 1.98, wb: 2.63, r: .35, clr: .15, p: P(.62, 1.75, .82, .45, .92, -.3, 1.27, -.75, -1.6, 1.0, .95),
    taper: .18, bevel: .1, wing: true, rim: '#2a2a2c', topKmh: 325, zero100: 3.2, hp: 720, grip: 1.1, cyl: 8 },
  { id: 'm4', make: 'BMW', model: 'M4 Competition', color: '#1f6f5c', colors: ['#1f6f5c', '#f5c400', '#1c3f94', '#f2f2f2', '#2a2a2a'],
    L: 4.79, W: 1.89, wb: 2.86, r: .34, clr: .17, p: P(.68, 1.75, .9, .95, .98, .2, 1.38, -.75, -1.6, 1.05, 1.03),
    taper: .14, bevel: .1, topKmh: 290, zero100: 3.9, hp: 503, grip: .95, cyl: 6 },
  { id: '720s', make: 'McLaren', model: '720S', color: '#ff6a00', colors: ['#ff6a00', '#d9dde2', '#0f3b5f', '#141414', '#9b1b30'],
    L: 4.54, W: 1.93, wb: 2.67, r: .35, clr: .15, p: P(.5, 1.7, .7, 1.05, .82, 0, 1.18, -.5, -1.4, .98, .95),
    taper: .2, bevel: .1, topKmh: 341, zero100: 2.9, hp: 710, grip: 1.08, cyl: 8 },
  { id: 'chiron', make: 'Bugatti', model: 'Chiron', color: '#1b3f8b', colors: ['#1b3f8b', '#111111', '#c8102e', '#e9e9e9', '#d4a017'],
    L: 4.54, W: 2.04, wb: 2.71, r: .36, clr: .13, p: P(.6, 1.7, .76, .95, .86, .05, 1.2, -.45, -1.3, 1.0, 1.0),
    taper: .18, bevel: .12, topKmh: 420, zero100: 2.4, hp: 1500, grip: 1.08, cyl: 16 },
  { id: 'r8', make: 'Audi', model: 'R8 V10', color: '#6d7378', colors: ['#6d7378', '#2a5fb8', '#f2f2f2', '#b30f0f', '#141414'],
    L: 4.43, W: 1.94, wb: 2.65, r: .34, clr: .15, p: P(.6, 1.6, .76, .9, .9, .05, 1.23, -.5, -1.3, .98, .96),
    taper: .17, bevel: .09, topKmh: 324, zero100: 3.4, hp: 602, grip: 1.02, cyl: 10 },
  { id: 'gtr', make: 'Nissan', model: 'GT-R Nismo', color: '#e9e9e9', colors: ['#e9e9e9', '#111111', '#1e4fa3', '#9a9fa5', '#c2121c'],
    L: 4.71, W: 1.9, wb: 2.78, r: .34, clr: .15, p: P(.7, 1.7, .88, .85, .96, .1, 1.36, -.55, -1.65, 1.08, 1.05),
    taper: .15, bevel: .08, wing: true, rim: '#2a2a2c', topKmh: 315, zero100: 2.5, hp: 600, grip: 1.0, cyl: 6 },
  { id: 'mustang', make: 'Ford', model: 'Mustang GT', color: '#f2b400', colors: ['#f2b400', '#1b2a4a', '#c8102e', '#f2f2f2', '#141414'],
    L: 4.81, W: 1.92, wb: 2.72, r: .34, clr: .16, p: P(.78, 1.7, .95, .6, 1.0, -.15, 1.37, -.75, -1.7, 1.08, 1.05),
    taper: .13, bevel: .07, topKmh: 250, zero100: 4.3, hp: 480, grip: .9, cyl: 8 },
  { id: 'g63', make: 'Mercedes-AMG', model: 'G 63', color: '#181818', colors: ['#181818', '#e9e9e9', '#5a6b4c', '#8a8f94', '#7a1a1a'],
    L: 4.87, W: 1.98, wb: 2.89, r: .42, clr: .38, p: P(1.15, 2.2, 1.2, 1.2, 1.25, 1.0, 1.95, -2.25, -2.28, 1.3, 1.3),
    taper: .04, glassTaper: .08, endTaper: .04, bevel: .05, boxy: true, topKmh: 220, zero100: 4.5, hp: 577, grip: .78, cyl: 8 },
];

export const NPC_TYPES = [
  { id: 'n-sedan', L: 4.8, W: 1.84, wb: 2.8, r: .33, clr: .2, p: P(.72, 1.8, .92, .85, 1.0, .1, 1.45, -.9, -1.7, 1.05, 1.02), taper: .12, bevel: .1 },
  { id: 'n-hatch', L: 4.1, W: 1.76, wb: 2.55, r: .31, clr: .19, p: P(.7, 1.55, .9, .9, .98, .2, 1.48, -1.6, -1.9, 1.1, 1.05), taper: .12, bevel: .1 },
  { id: 'n-suv', L: 4.7, W: 1.9, wb: 2.8, r: .38, clr: .3, p: P(.95, 1.95, 1.1, 1.0, 1.18, .3, 1.72, -1.95, -2.1, 1.2, 1.15), taper: .1, bevel: .1 },
  { id: 'n-van', L: 5.0, W: 1.95, wb: 3.0, r: .36, clr: .28, p: P(1.0, 2.3, 1.15, 1.75, 1.25, 1.15, 2.0, -2.3, -2.35, 1.3, 1.3), taper: .06, endTaper: .06, bevel: .08, boxy: true },
];
export const NPC_COLORS = ['#f2f2f2', '#e6e6e6', '#1a1a1a', '#2b2b2b', '#9ea3a8', '#6c7278', '#1f2f4f', '#7a1a1a', '#c9b79c', '#3f4a3a', '#5a6f8f', '#b8bcc0'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- shared resources
let shared = null;
function getShared() {
  if (shared) return shared;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.8)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  shared = {
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0a0d12, metalness: .3, roughness: .04, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 1.6 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: .55, metalness: .2 }),
    carbon: new THREE.MeshStandardMaterial({ color: 0x151618, roughness: .32, metalness: .5 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: .12, metalness: 1 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: .9 }),
    rimDark: new THREE.MeshStandardMaterial({ color: 0x1d1e21, roughness: .45, metalness: .7 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: .45, metalness: .9 }),
    caliper: new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: .4, metalness: .3 }),
    blob: new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
    taxi: new THREE.MeshStandardMaterial({ color: 0xffd400, emissive: 0xffb000, emissiveIntensity: .5 }),
    rims: new Map(),
  };
  return shared;
}
function rimMat(color) {
  const m = getShared();
  if (!m.rims.has(color)) m.rims.set(color, new THREE.MeshStandardMaterial({ color, roughness: .22, metalness: 1 }));
  return m.rims.get(color);
}

const geoCache = new Map();
function cached(key, fn) {
  let g = geoCache.get(key);
  if (!g) { g = fn(); if (g) g.userData.shared = true; geoCache.set(key, g); }
  return g;
}
const box = (w, h, d) => cached(`box${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`, () => new THREE.BoxGeometry(w, h, d));

// ---------- lofted body: smooth cross-sections swept along the car's length
const lin = (pts, x) => { // pts sorted by descending x
  if (x >= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    if (x <= x1 && x >= x2) return y1 + (y2 - y1) * ((x1 - x) / ((x1 - x2) || 1));
  }
  return pts[pts.length - 1][1];
};
const smooth = (pts, x, lo, hi, w = .2) => { let a = 0, n = 0; for (let d = -w; d <= w + 1e-6; d += w / 4) { a += lin(pts, clamp(x + d, lo, hi)); n++; } return a / n; };

function profile(s) {
  if (s._prof) return s._prof;
  const h = s.L / 2, p = s.p, R = s.r + .075;
  const top = [[h + .01, p.nose], [p.hoodX, p.hood], [p.cowlX, p.cowl], [p.deckX, p.deck], [-h - .01, p.tail]];
  const wheelsX = [s.wb / 2, -s.wb / 2];
  const archTop = s.r + R;
  const eF = s.boxy ? .14 : .32, eR = s.boxy ? .1 : .2;
  const endU = (x) => x > 0 ? clamp((x - (h - eF)) / eF, 0, 1) : clamp((-x - (h - eR)) / eR, 0, 1);
  const yTop = (x) => {
    let y = smooth(top, x, -h, h, s.boxy ? .08 : .2);
    for (const wx of wheelsX) {
      const dx = Math.abs(x - wx), span = R + .3;
      if (dx < span) { const bulge = archTop + (s.boxy ? .05 : .08), wgt = .5 + .5 * Math.cos(Math.PI * dx / span); if (bulge > y) y += (bulge - y) * wgt; }
    }
    return y;
  };
  const yBot = (x) => {
    let y = s.clr;
    for (const wx of wheelsX) { const dx = x - wx; if (Math.abs(dx) < R) y = Math.max(y, s.r + Math.sqrt(R * R - dx * dx) * .95); }
    const u = endU(x); y += u * u * .12;
    return Math.min(y, yTop(x) - .1);
  };
  const hw = (x) => { const u = endU(x); return s.W / 2 * (1 - .05 * Math.pow(Math.abs(x) / h, 4)) * Math.sqrt(1 - .62 * u * u); };
  s._prof = { h, yTop, yBot, hw, endU };
  return s._prof;
}

// superellipse cross-section loft; sec(x) -> {yb, yt, hw, n, tumble}
function loft(xs, sec, N, classify) {
  const P = [], idxA = [], idxB = [];
  for (const x of xs) {
    const { yb, yt, hw, n, tumble } = sec(x);
    const ym = (yb + yt) / 2, hh = Math.max(.01, (yt - yb) / 2);
    for (let j = 0; j < N; j++) {
      const th = j / N * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
      const ez = Math.sign(c) * Math.pow(Math.abs(c), 2 / n), ey = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n);
      const z = ez * hw * (1 - tumble * Math.max(0, ey)) * (1 - .1 * Math.pow(Math.max(0, -ey), 2));
      P.push(x, ym + ey * hh, z);
    }
  }
  const S = xs.length;
  for (let i = 0; i < S - 1; i++) for (let j = 0; j < N; j++) {
    const a = i * N + j, b = (i + 1) * N + j, c = (i + 1) * N + (j + 1) % N, d = i * N + (j + 1) % N;
    const target = classify && classify(P, a, c) ? idxB : idxA;
    target.push(a, b, c, a, c, d);
  }
  const c0 = P.length / 3; P.push(xs[0], sec(xs[0]).yb / 2 + sec(xs[0]).yt / 2, 0);
  const c1 = P.length / 3; P.push(xs[S - 1], sec(xs[S - 1]).yb / 2 + sec(xs[S - 1]).yt / 2, 0);
  for (let j = 0; j < N; j++) {
    idxA.push(c0, j, (j + 1) % N);
    idxA.push(c1, (S - 1) * N + (j + 1) % N, (S - 1) * N + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setIndex([...idxA, ...idxB]);
  g.addGroup(0, idxA.length, 0); g.addGroup(idxA.length, idxB.length, 1);
  return g;
}
function finish(g, facet) {
  if (facet) g = g.toNonIndexed();
  g.computeVertexNormals();
  return g;
}
function stations(a, b, step) { const xs = []; const n = Math.max(2, Math.ceil((b - a) / step)); for (let i = 0; i <= n; i++) xs.push(a + (b - a) * i / n); return xs; }

function topY(s, x) { return profile(s).yTop(x); }
function halfW(s, x) { return profile(s).hw(x); }

function bodyGeo(s) {
  return cached(s.id + ':body', () => {
    const pr = profile(s), h = pr.h;
    const n = s.facet ? 7 : s.boxy ? 7 : 4.2;
    const g = loft(stations(-h, h, s.facet ? .09 : .045), (x) => {
      const u = pr.endU(x); let yb = pr.yBot(x), yt = pr.yTop(x);
      yt -= u * u * (yt - yb) * .12;
      return { yb, yt, hw: pr.hw(x), n, tumble: s.taper * .7 };
    }, s.facet ? 14 : 28);
    return finish(g, s.facet);
  });
}
const glassT = (s) => s.glassTaper ?? .34;
function glassGeo(s) {
  return cached(s.id + ':glass', () => {
    const pr = profile(s), p = s.p;
    const gl = [[p.cowlX, p.cowl], [p.wsX, p.roof], [p.roofX, p.roof], [p.deckX, p.deck]];
    const lo = p.deckX, hi = p.cowlX;
    const gTop = (x) => Math.max(pr.yTop(x) + .015, smooth(gl, x, lo, hi, s.boxy ? .03 : .12));
    const gt = glassT(s), n = s.boxy || s.facet ? 6 : 3.4;
    const roofLo = p.roofX + .1, roofHi = p.wsX - .1;
    const g = loft(stations(lo, hi, s.facet ? .08 : .04), (x) => {
      const yb = pr.yTop(x) - .05, yt = Math.max(gTop(x), yb + .02);
      const hwB = pr.hw(x) * (1 - s.taper * .7) * (s.boxy ? .88 : .8);
      // section centred on the beltline so the widest point is hidden inside the body
      return { yb: yb - (yt - yb), yt, hw: hwB, n, tumble: gt };
    }, s.facet ? 14 : 24, (P, a, c) => {
      const x = (P[a * 3] + P[c * 3]) / 2, y = (P[a * 3 + 1] + P[c * 3 + 1]) / 2;
      return roofHi - roofLo > .25 && x > roofLo && x < roofHi && y > p.roof - .05;
    });
    return finish(g, s.facet);
  });
}

function wheelGeos(r, tw) {
  const k = `${r}_${tw}`;
  const tire = cached('tire' + k, () => {
    const pts = [[r * .7, -tw / 2], [r - .035, -tw / 2], [r, -tw / 2 + .045], [r, tw / 2 - .045], [r - .035, tw / 2], [r * .7, tw / 2]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 36).rotateX(Math.PI / 2);
  });
  const barrel = cached('barrel' + k, () => new THREE.CylinderGeometry(r * .7, r * .7, tw - .02, 32, 1, true).rotateX(Math.PI / 2));
  const disc = cached('disc' + k, () => new THREE.CylinderGeometry(r * .5, r * .5, .03, 24).rotateX(Math.PI / 2));
  const back = cached('back' + k, () => new THREE.CircleGeometry(r * .7, 24));
  const spokes = cached('spokes' + k, () => {
    const parts = [];
    for (let i = 0; i < 5; i++) {
      const b = new THREE.BoxGeometry(r * .58, .07, .035).translate(r * .38, 0, 0);
      b.rotateZ(i * Math.PI * 2 / 5); parts.push(b);
    }
    parts.push(new THREE.CylinderGeometry(r * .15, r * .15, .05, 16).rotateX(Math.PI / 2));
    const ring = new THREE.TorusGeometry(r * .69, .022, 6, 36); parts.push(ring);
    for (const p of parts) { p.deleteAttribute('uv'); }
    return mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p));
  });
  return { tire, barrel, disc, back, spokes };
}

function makeWheel(s, tw, side) {
  const m = getShared();
  const r = s.r;
  const G = wheelGeos(r, tw);
  const pivot = new THREE.Group(), spin = new THREE.Group();
  pivot.add(spin);
  spin.add(new THREE.Mesh(G.tire, m.tire));
  spin.add(new THREE.Mesh(G.barrel, m.rimDark));
  const back = new THREE.Mesh(G.back, m.rimDark); back.position.z = -side * .02; back.rotation.y = side > 0 ? 0 : Math.PI; spin.add(back);
  const disc = new THREE.Mesh(G.disc, m.disc); disc.position.z = side * (tw / 2 - .12); spin.add(disc);
  const sp = new THREE.Mesh(G.spokes, rimMat(s.rim || '#cfd2d6')); sp.position.z = side * (tw / 2 - .035); spin.add(sp);
  const cal = new THREE.Mesh(box(.12, .17, .06), m.caliper); cal.position.set(-r * .3, r * .3, side * (tw / 2 - .08)); cal.rotation.z = .9; pivot.add(cal);
  return { pivot, spin };
}

export function makeCar(s, color, opts = {}) {
  const m = getShared();
  const { W, wb, r, clr, p } = s, h = s.L / 2;
  const pr = profile(s);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: .55, roughness: .26, clearcoat: 1, clearcoatRoughness: .03 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3dc, emissiveIntensity: 1.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x2a0000, emissive: 0xff1a1a, emissiveIntensity: .7 });
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = body) => {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  add(bodyGeo(s), paint);
  add(glassGeo(s), [m.glass, paint]);

  // headlights set into the hood, light strip across the nose
  const hx = h - .3, hy = topY(s, hx) - .045;
  const slope = Math.atan2(topY(s, hx + .1) - topY(s, hx - .1), .2);
  const hz = halfW(s, hx) * .62;
  for (const sd of [-1, 1]) {
    const hm = add(box(.4, .07, .32), headMat, hx, hy, sd * hz); hm.rotation.z = slope; hm.rotation.y = sd * .12;
  }
  const noseY = (pr.yBot(h - .02) + pr.yTop(h - .02)) / 2;
  add(box(.06, .035, halfW(s, h) * 1.5), headMat, h - .005, noseY + .04, 0);
  // grille / intake
  add(box(.06, .1, halfW(s, h) * 1.4), m.black, h - .01, noseY - .07, 0);
  // tail lights and diffuser
  const tailY = (pr.yBot(-h + .02) + pr.yTop(-h + .02)) / 2 + .05;
  add(box(.06, .055, halfW(s, -h) * 1.9), tailMat, -h + .005, tailY, 0);
  for (const sd of [-1, 1]) add(box(.12, .1, .3), tailMat, -h + .04, tailY - .02, sd * halfW(s, -h + .05) * .78);
  add(box(.06, .1, halfW(s, -h) * 1.5), m.black, -h + .01, pr.yBot(-h + .02) + .06, 0);
  // side skirts
  add(box(Math.max(.3, wb - 2 * r - .35), .08, W * .985), m.black, 0, clr + .03, 0);
  // mirrors
  {
    const mx = p.cowlX - .22, mz = halfW(s, mx) * (1 - s.taper * .7) * (s.boxy ? .88 : .8);
    for (const sd of [-1, 1]) {
      add(box(.12, .1, .2), paint, mx, topY(s, mx) + .1, sd * (mz + .1));
      add(box(.05, .03, .12), m.black, mx + .02, topY(s, mx) + .045, sd * (mz + .03));
    }
  }
  // exhausts
  const exG = cached('exhaust', () => new THREE.CylinderGeometry(.05, .05, .2, 12).rotateZ(Math.PI / 2));
  for (const sd of [-1, 1]) add(exG, m.chrome, -h + .02, pr.yBot(-h + .05) + .06, sd * .38);
  // wing
  if (s.wing) {
    const wx = -h + .32, wy = p.deck + .3;
    for (const sd of [-1, 1]) add(box(.08, .3, .04), m.carbon, wx + .03, p.deck + .14, sd * .42);
    add(box(.42, .03, W * .94), m.carbon, wx, wy, 0);
    for (const sd of [-1, 1]) add(box(.44, .14, .02), m.carbon, wx, wy - .03, sd * W * .47);
  }
  if (opts.taxi) add(box(.5, .17, .22), m.taxi, (p.wsX + p.roofX) / 2, p.roof + .1, 0);

  // wheels
  const wheels = [];
  for (const [x, front] of [[wb / 2, true], [-wb / 2, false]]) {
    for (const sd of [-1, 1]) {
      const tw = front ? .25 : .29;
      const w = makeWheel(s, tw, sd);
      w.pivot.position.set(x, r, sd * (W / 2 - tw / 2 - .01));
      root.add(w.pivot);
      wheels.push({ ...w, front });
    }
  }
  // soft contact shadow
  const blob = new THREE.Mesh(cached('blob' + s.id, () => new THREE.PlaneGeometry(s.L * 1.25, W * 1.5).rotateX(-Math.PI / 2)), m.blob);
  blob.position.y = .06; blob.renderOrder = 8; root.add(blob);

  root.traverse(o => { if (o.isMesh && o !== blob) { o.castShadow = !!opts.shadows; } });
  return { root, body, wheels, paint, headMat, tailMat, spec: s };
}

export function disposeCar(c) {
  c.paint.dispose(); c.headMat.dispose(); c.tailMat.dispose();
}
