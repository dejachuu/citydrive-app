// Procedural car models + specs.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Side profile: heights (m) at key points along the length (x = metres from centre, front is +x)
const P = (nose, hoodX, hood, cowlX, cowl, wsX, roof, roofX, deckX, deck, tail) =>
  ({ nose, hoodX, hood, cowlX, cowl, wsX, roof, roofX, deckX, deck, tail });

// mid: mid-engine (side intakes), light/tail: lamp styles, rimStyle: wheel design, cal: brake caliper colour
export const CARS = [
  { id: 'sf90', make: 'Ferrari', model: 'SF90 Stradale', color: '#b3121b', colors: ['#b3121b', '#f2c500', '#f4f4f4', '#111111', '#1d3f8f'],
    L: 4.71, W: 1.97, wb: 2.65, r: .35, clr: .17, p: P(.52, 1.65, .76, .85, .9, -.15, 1.18, -.6, -1.35, 1.0, .96),
    taper: .18, topKmh: 340, zero100: 2.5, hp: 986, grip: 1.05, cyl: 8, mid: true, light: 'slim', tail: 'pair', rimStyle: 'twin', cal: '#f2c500' },
  { id: 'svj', make: 'Lamborghini', model: 'Aventador SVJ', color: '#7ac70c', colors: ['#7ac70c', '#f29b00', '#e8e8e8', '#5b2a86', '#141414'],
    L: 4.94, W: 2.1, wb: 2.7, r: .36, clr: .16, p: P(.48, 1.95, .68, 1.05, .86, -.2, 1.13, -.65, -1.45, .98, .9),
    taper: .2, facet: true, wing: true, rim: '#1c1c1e', topKmh: 350, zero100: 2.8, hp: 770, grip: 1.1, cyl: 12, mid: true, light: 'slim', tail: 'bar', rimStyle: 'star', cal: '#f2c500' },
  { id: '911', make: 'Porsche', model: '911 Turbo S', color: '#c9ccd1', colors: ['#c9ccd1', '#1f5fae', '#e5e1d6', '#2f4f2f', '#c21f1f'],
    L: 4.53, W: 1.9, wb: 2.45, r: .34, clr: .15, p: P(.6, 1.65, .78, .75, .88, .05, 1.29, -.45, -1.7, .95, .9),
    taper: .2, topKmh: 330, zero100: 2.7, hp: 650, grip: 1.05, cyl: 6, light: 'round', tail: 'bar', rimStyle: 'multi', cal: '#e8c200' },
  { id: 'amggt', make: 'Mercedes-AMG', model: 'GT Black Series', color: '#e07b00', colors: ['#e07b00', '#c0c4c8', '#1a1a1a', '#f2f2f2', '#2c4a2e'],
    L: 4.55, W: 1.98, wb: 2.63, r: .35, clr: .15, p: P(.62, 1.75, .82, .45, .92, -.3, 1.27, -.75, -1.6, 1.0, .95),
    taper: .18, wing: true, rim: '#2a2a2c', topKmh: 325, zero100: 3.2, hp: 720, grip: 1.1, cyl: 8, light: 'slim', tail: 'pair', rimStyle: 'mesh', cal: '#d4a017' },
  { id: 'm4', make: 'BMW', model: 'M4 Competition', color: '#1f6f5c', colors: ['#1f6f5c', '#f5c400', '#1c3f94', '#f2f2f2', '#2a2a2a'],
    L: 4.79, W: 1.89, wb: 2.86, r: .34, clr: .17, p: P(.68, 1.75, .9, .95, .98, .2, 1.38, -.75, -1.6, 1.05, 1.03),
    taper: .14, topKmh: 290, zero100: 3.9, hp: 503, grip: .95, cyl: 6, light: 'slim', tail: 'pair', rimStyle: 'twin', cal: '#1f4fa0' },
  { id: '720s', make: 'McLaren', model: '720S', color: '#ff6a00', colors: ['#ff6a00', '#d9dde2', '#0f3b5f', '#141414', '#9b1b30'],
    L: 4.54, W: 1.93, wb: 2.67, r: .35, clr: .15, p: P(.5, 1.7, .7, 1.05, .82, 0, 1.18, -.5, -1.4, .98, .95),
    taper: .2, topKmh: 341, zero100: 2.9, hp: 710, grip: 1.08, cyl: 8, mid: true, light: 'slim', tail: 'bar', rimStyle: 'star', cal: '#c8102e' },
  { id: 'chiron', make: 'Bugatti', model: 'Chiron', color: '#1b3f8b', colors: ['#1b3f8b', '#111111', '#c8102e', '#e9e9e9', '#d4a017'],
    L: 4.54, W: 2.04, wb: 2.71, r: .36, clr: .13, p: P(.6, 1.7, .76, .95, .86, .05, 1.2, -.45, -1.3, 1.0, 1.0),
    taper: .18, topKmh: 420, zero100: 2.4, hp: 1500, grip: 1.08, cyl: 16, mid: true, light: 'quad', tail: 'bar', rimStyle: 'six', cal: '#1b1b1b' },
  { id: 'r8', make: 'Audi', model: 'R8 V10', color: '#6d7378', colors: ['#6d7378', '#2a5fb8', '#f2f2f2', '#b30f0f', '#141414'],
    L: 4.43, W: 1.94, wb: 2.65, r: .34, clr: .15, p: P(.6, 1.6, .76, .9, .9, .05, 1.23, -.5, -1.3, .98, .96),
    taper: .17, topKmh: 324, zero100: 3.4, hp: 602, grip: 1.02, cyl: 10, mid: true, light: 'slim', tail: 'pair', rimStyle: 'twin', cal: '#c8102e' },
  { id: 'gtr', make: 'Nissan', model: 'GT-R Nismo', color: '#e9e9e9', colors: ['#e9e9e9', '#111111', '#1e4fa3', '#9a9fa5', '#c2121c'],
    L: 4.71, W: 1.9, wb: 2.78, r: .34, clr: .15, p: P(.7, 1.7, .88, .85, .96, .1, 1.36, -.55, -1.65, 1.08, 1.05),
    taper: .15, wing: true, rim: '#2a2a2c', topKmh: 315, zero100: 2.5, hp: 600, grip: 1.0, cyl: 6, light: 'slim', tail: 'quad', rimStyle: 'six', cal: '#c8102e' },
  { id: 'mustang', make: 'Ford', model: 'Mustang GT', color: '#f2b400', colors: ['#f2b400', '#1b2a4a', '#c8102e', '#f2f2f2', '#141414'],
    L: 4.81, W: 1.92, wb: 2.72, r: .34, clr: .16, p: P(.78, 1.7, .95, .6, 1.0, -.15, 1.37, -.75, -1.7, 1.08, 1.05),
    taper: .13, topKmh: 250, zero100: 4.3, hp: 480, grip: .9, cyl: 8, light: 'slim', tail: 'tri', rimStyle: 'twin', cal: '#c8102e' },
  { id: 'g63', make: 'Mercedes-AMG', model: 'G 63', color: '#181818', colors: ['#181818', '#e9e9e9', '#5a6b4c', '#8a8f94', '#7a1a1a'],
    L: 4.87, W: 1.98, wb: 2.89, r: .42, clr: .38, p: P(1.15, 2.2, 1.2, 1.2, 1.25, 1.0, 1.95, -2.25, -2.28, 1.3, 1.3),
    taper: .04, glassTaper: .08, boxy: true, doors4: true, spare: true, topKmh: 220, zero100: 4.5, hp: 577, grip: .78, cyl: 8, light: 'round', tail: 'pair', rimStyle: 'multi', cal: '#c8102e' },
];

export const NPC_TYPES = [
  { id: 'n-sedan', L: 4.8, W: 1.84, wb: 2.8, r: .33, clr: .2, p: P(.72, 1.8, .92, .85, 1.0, .1, 1.45, -.9, -1.7, 1.05, 1.02), taper: .12, doors4: true, npc: true, light: 'slim', tail: 'pair', rimStyle: 'six', rim: '#b9bdc2' },
  { id: 'n-hatch', L: 4.1, W: 1.76, wb: 2.55, r: .31, clr: .19, p: P(.7, 1.55, .9, .9, .98, .2, 1.48, -1.6, -1.9, 1.1, 1.05), taper: .12, doors4: true, npc: true, light: 'slim', tail: 'pair', rimStyle: 'multi', rim: '#a9adb2' },
  { id: 'n-suv', L: 4.7, W: 1.9, wb: 2.8, r: .38, clr: .3, p: P(.95, 1.95, 1.1, 1.0, 1.18, .3, 1.72, -1.95, -2.1, 1.2, 1.15), taper: .1, doors4: true, npc: true, light: 'slim', tail: 'pair', rimStyle: 'twin', rim: '#c3c6ca' },
  { id: 'n-van', L: 5.0, W: 1.95, wb: 3.0, r: .36, clr: .28, p: P(1.0, 2.3, 1.15, 1.75, 1.25, 1.15, 2.0, -2.3, -2.35, 1.3, 1.3), taper: .06, boxy: true, van: true, doors4: true, npc: true, light: 'slim', tail: 'pair', rimStyle: 'six', rim: '#9da1a6' },
];
export const NPC_COLORS = ['#f2f2f2', '#e6e6e6', '#1a1a1a', '#2b2b2b', '#9ea3a8', '#6c7278', '#1f2f4f', '#7a1a1a', '#c9b79c', '#3f4a3a', '#5a6f8f', '#b8bcc0'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- shared resources
let shared = null;
function getShared() {
  if (shared) return shared;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  shared = {
    glass: new THREE.MeshPhysicalMaterial({ color: 0x020304, metalness: 0, roughness: .03, clearcoat: 1, clearcoatRoughness: .01, envMapIntensity: 1.1 }),
    trim: new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: .22, metalness: .1, clearcoat: .8, clearcoatRoughness: .1 }),
    under: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: .85, metalness: 0 }),
    carbon: new THREE.MeshPhysicalMaterial({ color: 0x141518, roughness: .35, metalness: .4, clearcoat: 1, clearcoatRoughness: .05 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: .08, metalness: 1 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .92, map: tireTex() }),
    barrel: new THREE.MeshStandardMaterial({ color: 0x2b2c2f, roughness: .5, metalness: .8, side: THREE.DoubleSide }),
    disc: new THREE.MeshStandardMaterial({ map: discTex(), roughness: .35, metalness: .9 }),
    blob: new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
    taxi: new THREE.MeshStandardMaterial({ color: 0xffd400, emissive: 0xffb000, emissiveIntensity: .5 }),
    rims: new Map(), cals: new Map(), sides: new Map(),
  };
  return shared;
}
function rimMat(color) {
  const m = getShared();
  if (!m.rims.has(color)) m.rims.set(color, new THREE.MeshPhysicalMaterial({ color, roughness: .18, metalness: 1, clearcoat: .6, clearcoatRoughness: .1 }));
  return m.rims.get(color);
}
function calMat(color) {
  const m = getShared();
  if (!m.cals.has(color)) m.cals.set(color, new THREE.MeshPhysicalMaterial({ color, roughness: .3, metalness: .2, clearcoat: 1 }));
  return m.cals.get(color);
}

const geoCache = new Map();
function cached(key, fn) {
  let g = geoCache.get(key);
  if (!g) { g = fn(); if (g) g.userData.shared = true; geoCache.set(key, g); }
  return g;
}

// ---------- canvas textures
const texCache = new Map();
function canvasTex(key, w, h, draw, srgb = true) {
  let t = texCache.get(key); if (t) return t;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  texCache.set(key, t); return t;
}
function tireTex() {
  return canvasTex('tire', 64, 512, (g, w, h) => {
    g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h);
    // sidewalls slightly lighter/smoother, tread band with circumferential grooves
    g.fillStyle = '#7d7d7d'; g.fillRect(0, h * .38, w, h * .24);
    g.fillStyle = '#3a3a3a'; for (const v of [.43, .5, .57]) g.fillRect(0, h * v - 3, w, 6);
    g.fillStyle = '#b0b0b0'; g.fillRect(0, h * .14, w, 3); g.fillRect(0, h * .86 - 3, w, 3);
  });
}
function discTex() {
  return canvasTex('disc', 256, 256, (g) => {
    g.fillStyle = '#6e6e70'; g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill();
    for (let i = 0; i < 2600; i++) { const a = Math.random() * 7, r = 60 + Math.random() * 66; g.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},.08)`; g.fillRect(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 2, 2); }
    g.fillStyle = '#2a2a2c'; for (let i = 0; i < 36; i++) for (const r of [78, 96, 112]) {
      const a = i / 36 * Math.PI * 2 + r * .01; g.beginPath(); g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 3.4, 0, 7); g.fill();
    }
    g.fillStyle = '#3b3b3e'; g.beginPath(); g.arc(128, 128, 58, 0, 7); g.fill();
  });
}
function honey(g, x, y, w, h, cell = 9) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = '#060607'; g.fillRect(x, y, w, h);
  g.strokeStyle = '#2a2c30'; g.lineWidth = 1.6;
  for (let j = 0, yy = y; yy < y + h + cell; j++, yy += cell * .86) for (let xx = x + (j % 2) * cell / 2; xx < x + w + cell; xx += cell) {
    g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; g.lineTo(xx + Math.cos(a) * cell * .5, yy + Math.sin(a) * cell * .5); } g.closePath(); g.stroke();
  }
  g.restore();
}
function plateText(seed) {
  const L = 'ABCDEFGHJKLMNPRSTVWXYZ', rnd = mulberry(seed);
  const ch = () => L[(rnd() * L.length) | 0], dg = () => (rnd() * 10) | 0;
  return `${ch()}${ch()} ${dg()}${dg()}${dg()} ${ch()}${ch()}`;
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function drawPlate(g, cx, cy, pw, ph, text, emit) {
  if (emit) return;
  g.fillStyle = '#f4f4f0'; g.beginPath(); g.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, ph * .12); g.fill();
  g.strokeStyle = '#222'; g.lineWidth = Math.max(1, ph * .05); g.stroke();
  g.fillStyle = '#151515'; g.font = `bold ${ph * .7}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, cx, cy + ph * .04, pw * .9);
}

// ---------- body shape
const linp = (pts, x) => { // pts sorted by descending x
  if (x >= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    if (x <= x1 && x >= x2) return y1 + (y2 - y1) * ((x1 - x) / ((x1 - x2) || 1));
  }
  return pts[pts.length - 1][1];
};
const smooth = (pts, x, lo, hi, w = .2) => { let a = 0, n = 0; for (let d = -w; d <= w + 1e-6; d += w / 4) { a += linp(pts, clamp(x + d, lo, hi)); n++; } return a / n; };

// Body cross-section at x: flat underside (yb), near-vertical lower side up to the shoulder line (ys),
// then a crowned upper surface to the centre line height (yt). Fenders rise above the hood over the wheels.
function profile(s) {
  if (s._prof) return s._prof;
  const h = s.L / 2, p = s.p, R = s.r + .075;
  const top = [[h + .01, p.nose], [p.hoodX, p.hood], [p.cowlX, p.cowl], [p.deckX, p.deck], [-h - .01, p.tail]];
  const wheelsX = [s.wb / 2, -s.wb / 2];
  const eF = s.boxy ? .14 : .34, eR = s.boxy ? .1 : .24;
  const endK = s.boxy ? .3 : .55;
  const endU = (x) => x > 0 ? clamp((x - (h - eF)) / eF, 0, 1) : clamp((-x - (h - eR)) / eR, 0, 1);
  const fenderTop = s.r + R + (s.boxy ? .05 : .075);
  const kS = s.boxy ? .86 : s.npc ? .74 : .7, pTop = s.boxy ? 7 : s.npc ? 2.6 : 2.2;
  const sec = (x) => {
    const u = endU(x);
    let yt = smooth(top, x, -h, h, s.boxy ? .08 : .2);
    yt -= u * u * .1 * yt;
    const yb0 = s.clr + u * u * (x > 0 ? .12 : .05);
    let ys = yb0 + (yt - yb0) * kS;
    let fw = 0;
    for (const wx of wheelsX) {
      const dx = Math.abs(x - wx), span = R + .38;
      if (dx < span) fw = Math.max(fw, .5 + .5 * Math.cos(Math.PI * dx / span));
    }
    if (fenderTop > ys) ys += (fenderTop - ys) * fw * (1 - u);
    let yb = yb0;
    for (const wx of wheelsX) { const dx = x - wx; if (Math.abs(dx) < R) yb = Math.max(yb, s.r + Math.sqrt(R * R - dx * dx) * .96); }
    yb = Math.min(yb, ys - .07);
    const hw = s.W / 2 * (1 - .04 * Math.pow(Math.abs(x) / h, 4)) * Math.sqrt(1 - (x > 0 ? endK : endK * .7) * u * u);
    return { yb, ys, yt, hw, pTop: ys > yt ? 2 : pTop, u, fw };
  };
  const surfY = (x, z) => { const c = sec(x), uu = Math.min(1, Math.abs(z) / c.hw); return c.ys + (c.yt - c.ys) * (1 - Math.pow(uu, c.pTop)); };
  const sideZ = (x, y) => { const c = sec(x), t = clamp((y - c.yb) / Math.max(.01, c.ys - c.yb), 0, 1); return c.hw * (.93 + .07 * Math.sqrt(t)); };
  // greenhouse (cabin)
  const gl = [[p.cowlX, p.cowl], [p.wsX, p.roof], [p.roofX, p.roof], [p.deckX, p.deck]];
  const gTop = (x) => smooth(gl, x, p.deckX, p.cowlX, s.boxy ? .03 : .12);
  const hwB = (x) => sec(x).hw * (s.boxy ? .9 : s.npc ? .84 : .78);
  s._prof = { h, sec, surfY, sideZ, gTop, hwB, endU };
  return s._prof;
}

function bodyRing(s, pr, x, coarse) {
  const c = pr.sec(x), { yb, ys, yt, hw, pTop } = c;
  const pts = [[0, yb], [hw * .5, yb], [hw * .86, yb]];
  const side = coarse ? [0, .15, .5, 1] : [0, .06, .18, .38, .62, .84, 1];
  for (const t of side) pts.push([hw * (.93 + .07 * Math.sqrt(t)), yb + (ys - yb) * t]);
  const nT = coarse ? 6 : 15;
  for (let i = 1; i <= nT; i++) {
    const uu = 1 - Math.pow(i / nT, 1.6);
    pts.push([uu * hw, ys + (yt - ys) * (1 - Math.pow(uu, pTop))]);
  }
  return { pts, kSide: 3 };
}

// Loft rings (half-profiles from bottom centre to top centre, mirrored) along xs.
// group(x, k) picks the material group of the face starting at half-index k.
function loft(xs, ringFn, group, nGroups) {
  const P = [], groups = Array.from({ length: nGroups }, () => []);
  let K = 0;
  const ringAt = (x) => {
    const half = ringFn(x); K = half.length;
    const full = half.map(([z, y]) => [z, y]);
    for (let k = K - 2; k >= 1; k--) full.push([-half[k][0], half[k][1]]);
    return full;
  };
  const rings = xs.map(ringAt);
  const M = rings[0].length;
  for (let i = 0; i < xs.length; i++) for (const [z, y] of rings[i]) P.push(xs[i], y, z);
  const kOf = (j) => j < K ? j : 2 * (K - 1) - j;
  for (let i = 0; i < xs.length - 1; i++) {
    const xm = (xs[i] + xs[i + 1]) / 2;
    for (let j = 0; j < M; j++) {
      const j2 = (j + 1) % M, k = Math.min(kOf(j), kOf(j2));
      const a = i * M + j, b = (i + 1) * M + j, c = (i + 1) * M + j2, d = i * M + j2;
      const gi = group(xm, k);
      // winding so normals point outward on the +z half
      groups[gi].push(a, b, c, a, c, d);
    }
  }
  // end caps with their own vertices
  for (const [ri, dir] of [[0, -1], [xs.length - 1, 1]]) {
    const base = P.length / 3, r = rings[ri], x = xs[ri];
    let cy = 0; for (const q of r) cy += q[1]; cy /= r.length;
    P.push(x, cy, 0);
    for (const [z, y] of r) P.push(x, y, z);
    for (let j = 0; j < M; j++) {
      const a = base + 1 + j, b = base + 1 + (j + 1) % M;
      if (dir > 0) groups[0].push(base, b, a); else groups[0].push(base, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  const idx = []; let off = 0;
  for (let gi = 0; gi < nGroups; gi++) { g.addGroup(off, groups[gi].length, gi); off += groups[gi].length; idx.push(...groups[gi]); }
  g.setIndex(idx);
  return g;
}
function finish(g, facet) {
  if (facet) g = g.toNonIndexed();
  g.computeVertexNormals();
  return g;
}
function stations(a, b, step) { const xs = []; const n = Math.max(2, Math.ceil((b - a) / step)); for (let i = 0; i <= n; i++) xs.push(a + (b - a) * i / n); return xs; }

// groups: 0 paint, 1 black underside / rocker
function bodyGeo(s) {
  return cached(s.id + ':body', () => {
    const pr = profile(s), h = pr.h, coarse = !!s.facet;
    const g = loft(stations(-h, h, coarse ? .08 : .04), x => bodyRing(s, pr, x, coarse).pts,
      (x, k) => k <= 3 ? 1 : 0, 2);
    return finish(g, coarse);
  });
}

// groups: 0 glass, 1 paint (roof, pillars), 2 black trim
function glassGeo(s) {
  return cached(s.id + ':glass', () => {
    const pr = profile(s), p = s.p, coarse = !!s.facet;
    const lo = p.deckX, hi = p.cowlX;
    const gt = s.glassTaper ?? .32;
    const nSide = 4, nTop = coarse ? 5 : 10;
    const ring = (x) => {
      const hB = pr.hwB(x), y0 = pr.surfY(x, hB) - .035;
      const gT = Math.max(gTopC(x), y0 + .012);
      const H = gT - y0, yS = gT - Math.min(s.boxy ? .05 : .13, H * (s.boxy ? .12 : .32));
      const hT = hB * (1 - gt);
      const pts = [[0, y0], [hB, y0]];
      for (let i = 1; i <= nSide; i++) { const t = i / nSide; pts.push([lerp(hB, hT, Math.pow(t, 1.3)), lerp(y0, yS, t)]); }
      for (let i = 1; i <= nTop; i++) { const uu = 1 - Math.pow(i / nTop, 1.3); pts.push([uu * hT, yS + (gT - yS) * (1 - Math.pow(uu, s.boxy ? 8 : 2.6))]); }
      return pts;
    };
    const gTopC = (x) => Math.max(pr.surfY(x, 0) + .015, pr.gTop(x));
    const kBand = 1 + nSide; // first face of the top part
    const xC = s.boxy ? p.deckX + .12 : p.roofX - (p.roofX - p.deckX) * (s.mid ? .3 : .5);
    const xB = (p.wsX + p.roofX) / 2 + .12;
    const g = loft(stations(lo, hi, coarse ? .08 : .035), ring, (x, k) => {
      if (k === 0) return 2;
      if (k === 1) return 2;                                       // beltline trim
      if (k < kBand) {                                             // side windows
        if (x < xC) return 1;                                      // C-pillar
        if (s.doors4 && Math.abs(x - xB) < .05) return 2;          // B-pillar
        if (x > hi - .04) return 2;
        return 0;
      }
      const roof = x < p.wsX - .06 && x > p.roofX + .06;
      if (k === kBand) return roof ? 1 : (x > p.wsX ? 2 : 1);      // roof rail / A-pillar
      if (roof) return 1;
      if (x > hi - .05) return 2;                                  // cowl / wiper trim
      return 0;
    }, 3);
    return finish(g, coarse);
  });
}

// ---------- surface-conforming patches (lights, panel lines, fascias)
function patchGeo(nu, nv, fn) { // fn(u,v) -> [x,y,z,U,V]
  const P = [], UV = [], I = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const q = fn(i / nu, j / nv); P.push(q[0], q[1], q[2]); UV.push(q[3], q[4]); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 2, d = a + nu + 1;
    I.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I); g.computeVertexNormals();
  return g;
}
function orientOut(g, dir) { // flip winding if the average normal points away from dir
  const n = g.attributes.normal, v = new THREE.Vector3(); let dot = 0;
  for (let i = 0; i < n.count; i++) { v.fromBufferAttribute(n, i); dot += v.dot(dir); }
  if (dot < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  return g;
}
// planar cap matching the body section at x, UV = (z,y) box
function capGeo(s, x, dir, vScale = 1, vOff = 0) {
  const pr = profile(s), c = pr.sec(x), half = bodyRing(s, pr, x, false).pts;
  const ring = half.map(q => q.slice()); for (let k = half.length - 2; k >= 1; k--) ring.push([-half[k][0], half[k][1]]);
  const shrink = .985, cy = (c.yb + c.yt) / 2;
  const P = [x, cy, 0], UV = [.5, vOff + .5 * vScale * 0 + ((cy - c.yb) / (c.yt - c.yb || 1)) * vScale];
  for (const [z, y] of ring) {
    const zz = z * shrink, yy = cy + (y - cy) * shrink;
    P.push(x, yy, zz); UV.push((dir > 0 ? -zz : zz) / (2 * c.hw) + .5, vOff + clamp((yy - c.yb) / Math.max(.01, Math.max(c.yt, c.ys) - c.yb), 0, 1) * vScale);
  }
  const I = [], M = ring.length;
  for (let j = 0; j < M; j++) I.push(0, 1 + j, 1 + (j + 1) % M);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I); g.computeVertexNormals();
  return orientOut(g, new THREE.Vector3(dir, 0, 0));
}

// ---------- lamp / fascia textures (drawn in metres so details keep real sizes)
function frontTextures(s) {
  const pr = profile(s), c = pr.sec(pr.h), fw = 2 * c.hw, fh = Math.max(c.yt, c.ys) - c.yb;
  const draw = (emit) => (g, W, H) => {
    g.clearRect(0, 0, W, H);
    if (emit) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
    // ---- top half: hood headlight unit; x = along length (right = front), y = lateral (top = outer edge)
    const hl = (x, y) => [x * W, y * H / 2];
    const housing = emit ? null : (() => { const gr = g.createLinearGradient(0, 0, 0, H / 2); gr.addColorStop(0, '#2c3036'); gr.addColorStop(1, '#0b0c0e'); return gr; })();
    const lens = (cx, cy, r) => {
      if (emit) { g.fillStyle = '#6a6a6a'; g.beginPath(); g.arc(cx, cy, r * .7, 0, 7); g.fill(); return; }
      const gr = g.createRadialGradient(cx - r * .2, cy - r * .2, r * .1, cx, cy, r);
      gr.addColorStop(0, '#f4f6f8'); gr.addColorStop(.35, '#9aa1aa'); gr.addColorStop(.7, '#2a2e34'); gr.addColorStop(1, '#c9ced4');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    };
    const led = '#ffffff', ledMap = '#eef2f6';
    if (!s.boxy) {
      if (s.light === 'round') {
        const [cx, cy] = hl(.55, .5);
        if (!emit) { g.fillStyle = housing; g.beginPath(); g.ellipse(cx, cy, W * .38, H * .21, 0, 0, 7); g.fill(); }
        g.strokeStyle = emit ? led : ledMap; g.lineWidth = 9; g.beginPath(); g.ellipse(cx, cy, W * .3, H * .165, 0, 0, 7); g.stroke();
        lens(cx + W * .08, cy, H * .08); lens(cx - W * .12, cy, H * .07);
      } else if (s.light === 'quad') {
        if (!emit) { g.fillStyle = housing; g.beginPath(); g.roundRect(W * .12, H * .08, W * .84, H * .3, 40); g.fill(); }
        for (let i = 0; i < 4; i++) lens(W * (.25 + i * .19), H * .22, H * .09);
        g.fillStyle = emit ? led : ledMap; g.fillRect(W * .16, H * .39, W * .78, 7);
      } else { // slim wedge along the outer edge with an LED blade
        if (!emit) {
          g.fillStyle = housing; g.beginPath();
          g.moveTo(...hl(.99, .06)); g.lineTo(...hl(.93, .78)); g.lineTo(...hl(.18, .5)); g.lineTo(...hl(.06, .1)); g.closePath(); g.fill();
        }
        lens(...hl(.78, .32), H * .09); lens(...hl(.55, .26), H * .08);
        g.strokeStyle = emit ? led : ledMap; g.lineWidth = 10; g.lineCap = 'round';
        g.beginPath(); g.moveTo(...hl(.9, .7)); g.lineTo(...hl(.2, .45)); g.lineTo(...hl(.12, .14)); g.stroke();
      }
    }
    // ---- bottom half: nose fascia; x = lateral, y = height
    const fx = (m) => (m / fw + .5) * W, fy = (m) => H - (m / fh) * H / 2;
    const box = (x0, y0, x1, y1, r = 6) => { g.beginPath(); g.roundRect(fx(x0), fy(y1), fx(x1) - fx(x0), fy(y0) - fy(y1), r); };
    const hc = (x0, y0, x1, y1, r) => { if (emit) return; box(x0, y0, x1, y1, r); g.save(); g.clip(); honey(g, fx(x0), fy(y1), fx(x1) - fx(x0), fy(y0) - fy(y1)); g.restore(); };
    if (s.boxy) {
      const lr = Math.min(.11, fh * .2), ly = fh * .68, lx = fw / 2 - lr - .1;
      for (const sd of [-1, 1]) {
        if (!emit) { g.fillStyle = '#1a1c20'; g.beginPath(); g.arc(fx(sd * lx), fy(ly), (fx(lr) - fx(0)) * 1.15, 0, 7); g.fill(); }
        g.strokeStyle = emit ? led : ledMap; g.lineWidth = 7; g.beginPath(); g.arc(fx(sd * lx), fy(ly), (fx(lr) - fx(0)) * .95, 0, 7); g.stroke();
        lens(fx(sd * lx), fy(ly), (fx(lr) - fx(0)) * .6);
        if (!emit) { g.fillStyle = '#f29b00'; g.fillRect(fx(sd * (lx - .02)) - 14, fy(ly - lr - .06), 28, 10); }
      }
      // grille with horizontal bars
      if (!emit) {
        const gx = lx - lr - .06; box(-gx, fh * .45, gx, fh * .88, 4); g.fillStyle = '#0b0b0c'; g.fill();
        g.fillStyle = '#9ca0a6'; for (let yy = fh * .5; yy < fh * .86; yy += .045) g.fillRect(fx(-gx), fy(yy), fx(gx) - fx(-gx), 3);
        hc(-fw * .3, fh * .08, fw * .3, fh * .3, 6);
        drawPlate(g, fx(0), fy(fh * .38), fx(.26) - fx(-.26), fy(0) - fy(.11), plateText(hash(s.id)), emit);
      }
    } else if (s.npc) {
      if (!emit) {
        box(-fw * .22, fh * .45, fw * .22, fh * .9, 10); g.fillStyle = '#0c0d0f'; g.fill(); g.strokeStyle = '#b9bec4'; g.lineWidth = 5; g.stroke();
        g.fillStyle = '#26292d'; for (let yy = fh * .52; yy < fh * .88; yy += .035) g.fillRect(fx(-fw * .21), fy(yy), fx(fw * .21) - fx(-fw * .21), 2);
        hc(-fw * .28, fh * .06, fw * .28, fh * .22, 8);
        drawPlate(g, fx(0), fy(fh * .33), fx(.26) - fx(-.26), fy(0) - fy(.11), plateText(hash(s.id)), emit);
      }
      g.fillStyle = emit ? led : ledMap; for (const sd of [-1, 1]) g.fillRect(fx(sd * fw * .36) - 30, fy(fh * .85), 60, 6);
    } else {
      // supercar nose: big central intake, side intakes, splitter lip
      hc(-fw * .27, fh * .08, fw * .27, fh * .62, 14);
      for (const sd of [-1, 1]) hc(sd > 0 ? fw * .31 : -fw * .47, fh * .1, sd > 0 ? fw * .47 : -fw * .31, fh * .7, 12);
      if (!emit) { g.fillStyle = '#0c0c0d'; g.fillRect(0, fy(fh * .06), W, H); }
    }
  };
  const key = 'front:' + s.id;
  return { map: canvasTex(key, 512, 512, draw(false)), emit: canvasTex(key + ':e', 512, 512, draw(true)) };
}
function rearTextures(s) {
  const pr = profile(s), c = pr.sec(-pr.h), fw = 2 * c.hw, fh = Math.max(c.yt, c.ys) - c.yb;
  const ex = exhaustLayout(s);
  const draw = (emit) => (g, W, H) => {
    g.clearRect(0, 0, W, H);
    if (emit) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
    const fx = (m) => (m / fw + .5) * W, fy = (m) => H - (m / fh) * H;
    const px = (m) => fx(m) - fx(0);
    const box = (x0, y0, x1, y1, r = 6) => { g.beginPath(); g.roundRect(fx(x0), fy(y1), fx(x1) - fx(x0), fy(y0) - fy(y1), r); };
    const lensRed = (x0, y0, x1, y1, r) => { box(x0, y0, x1, y1, r); if (emit) { g.fillStyle = '#3a0000'; g.fill(); } else { const gr = g.createLinearGradient(0, fy(y1), 0, fy(y0)); gr.addColorStop(0, '#5c0508'); gr.addColorStop(1, '#2a0103'); g.fillStyle = gr; g.fill(); } };
    const ledLine = (x0, y, x1, w = 6) => { g.fillStyle = emit ? '#ffffff' : '#ff5a5a'; g.fillRect(fx(x0), fy(y) - w / 2, fx(x1) - fx(x0), w); };
    const lt = fh * .84, lb = Math.max(fh * .56, lt - .14);
    const style = s.tail || 'pair';
    if (style === 'bar') {
      lensRed(-fw * .44, lb, fw * .44, lt, 10); ledLine(-fw * .42, (lb + lt) / 2, fw * .42, 8);
      ledLine(-fw * .42, lt - .02, -fw * .28, 5); ledLine(fw * .28, lt - .02, fw * .42, 5);
    } else if (style === 'quad') {
      for (const xm of [-fw * .36, -fw * .23, fw * .23, fw * .36]) {
        const r = px(Math.min(.065, fw * .06)), cx = fx(xm), cy = fy((lb + lt) / 2);
        g.fillStyle = emit ? '#300' : '#3a0306'; g.beginPath(); g.arc(cx, cy, r * 1.15, 0, 7); g.fill();
        g.strokeStyle = emit ? '#fff' : '#ff5050'; g.lineWidth = 7; g.beginPath(); g.arc(cx, cy, r * .8, 0, 7); g.stroke();
      }
    } else { // pair (and tri-bar)
      for (const sd of [-1, 1]) {
        const x0 = sd > 0 ? fw * .16 : -fw * .43, x1 = sd > 0 ? fw * .43 : -fw * .16;
        lensRed(x0, lb, x1, lt, 12);
        if (style === 'tri') { for (let i = 0; i < 3; i++) { const xx = lerp(x0 + .03, x1 - .03, (i + .5) / 3); g.fillStyle = emit ? '#fff' : '#ff6060'; g.fillRect(fx(xx) - 5, fy(lt - .015), 10, fy(lb + .015) - fy(lt - .015)); } }
        else { ledLine(x0 + .02, lt - .025, x1 - .02, 6); g.fillStyle = emit ? '#fff' : '#ff6060'; g.fillRect(fx(sd > 0 ? x1 - .03 : x0 + .02), fy(lt - .025), 6, fy(lb + .02) - fy(lt - .025)); }
        if (!emit) { g.fillStyle = '#d9dde2'; box(sd > 0 ? x0 + .03 : x1 - .09, lb + .015, sd > 0 ? x0 + .09 : x1 - .03, lb + .045, 3); g.fill(); }
      }
    }
    if (!emit) {
      // diffuser with fins
      const dh = Math.min(.17, fh * .3);
      box(-fw * .44, 0, fw * .44, dh, 4); g.fillStyle = '#0a0a0b'; g.fill();
      g.fillStyle = '#25272a'; for (let xm = -fw * .4; xm <= fw * .4; xm += .09) g.fillRect(fx(xm) - 2, fy(dh), 4, fy(0) - fy(dh));
      for (const [ez, ey, er] of ex) { g.fillStyle = '#c9cdd2'; g.beginPath(); g.arc(fx(ez), fy(ey - c.yb), px(er) * 1.12, 0, 7); g.fill(); g.fillStyle = '#050505'; g.beginPath(); g.arc(fx(ez), fy(ey - c.yb), px(er) * .85, 0, 7); g.fill(); }
      drawPlate(g, fx(0), fy(Math.min(lb - .1, dh + .1)), px(.52), fy(0) - fy(.11), plateText(hash(s.id + 'r')), false);
    }
  };
  const key = 'rear:' + s.id;
  return { map: canvasTex(key, 512, 256, draw(false)), emit: canvasTex(key + ':e', 512, 256, draw(true)) };
}
function exhaustLayout(s) {
  const pr = profile(s), c = pr.sec(-pr.h), y = c.yb + Math.min(.08, (c.ys - c.yb) * .2), r = .045;
  if (s.id === '911' || s.id === 'chiron' || s.id === 'svj') return [[-.07, y + .02, r], [.07, y + .02, r]];
  if (s.npc) return [[-c.hw * .6, y - .02, .03]];
  return [[-c.hw * .62, y, r], [-c.hw * .48, y, r], [c.hw * .48, y, r], [c.hw * .62, y, r]].filter((_, i) => s.cyl > 6 || i === 0 || i === 3);
}
function sideTexture(s) {
  return canvasTex('side:' + s.id, 512, 128, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    g.strokeStyle = '#050505'; g.lineWidth = 2.2; g.lineCap = 'round';
    const line = (pts) => { g.beginPath(); pts.forEach(([u, v], i) => i ? g.lineTo(u * W, (1 - v) * H) : g.moveTo(u * W, (1 - v) * H)); g.stroke(); };
    const handle = (u, v) => { g.fillStyle = '#0a0a0a'; g.beginPath(); g.roundRect(u * W - 20, (1 - v) * H - 4, 40, 8, 4); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(u * W - 17, (1 - v) * H - 3, 34, 2); };
    // u = 0 rear arch, 1 front arch
    if (s.doors4) {
      line([[.93, 1], [.93, .12], [.5, .1], [.5, 1]]); line([[.5, .1], [.1, .12], [.1, 1]]);
      handle(.6, .82); handle(.2, .82);
    } else {
      const back = s.mid ? .5 : .34;
      line([[.94, 1], [.94, .14], [back, .12], [back - .03, 1]]);
      handle(back + .06, .82);
    }
    if (s.mid) {
      g.save(); g.beginPath(); g.moveTo(.43 * W, (1 - .82) * H); g.lineTo(.05 * W, (1 - .9) * H); g.lineTo(.03 * W, (1 - .28) * H); g.quadraticCurveTo(.2 * W, (1 - .2) * H, .38 * W, (1 - .45) * H); g.closePath();
      g.clip(); honey(g, 0, 0, W, H, 10); g.restore();
    }
    // lower rocker shadow line
    g.fillStyle = 'rgba(0,0,0,.9)'; g.fillRect(.02 * W, (1 - .035) * H, .96 * W, 3);
  });
}

// ---------- wheels
const RIM_STYLES = {
  twin: { n: 5, f: .42, slit: true }, star: { n: 7, f: .3 }, multi: { n: 10, f: .38 },
  six: { n: 6, f: .36 }, mesh: { n: 14, f: .45 },
};
function rimFaceGeo(r, style) {
  return cached(`rim:${r}:${style}`, () => {
    const st = RIM_STYLES[style] || RIM_STYLES.twin;
    const R0 = r * .7, ri = r * .27, Ro = r * .62, sector = Math.PI * 2 / st.n;
    const shape = new THREE.Shape(); shape.absarc(0, 0, R0, 0, Math.PI * 2, false);
    const hole = (a0, a1, rIn, rOut) => {
      const path = new THREE.Path(); const steps = 8;
      for (let i = 0; i <= steps; i++) { const a = lerp(a0, a1, i / steps); const v = [Math.cos(a) * rOut, Math.sin(a) * rOut]; i ? path.lineTo(...v) : path.moveTo(...v); }
      for (let i = steps; i >= 0; i--) { const a = lerp(a0 + (a1 - a0) * .12, a1 - (a1 - a0) * .12, i / steps); path.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn); }
      path.closePath(); shape.holes.push(path);
    };
    for (let i = 0; i < st.n; i++) {
      const a0 = i * sector + st.f * sector / 2, a1 = (i + 1) * sector - st.f * sector / 2;
      hole(a0, a1, ri, Ro);
      if (st.slit) { const am = i * sector; hole(am - .035, am + .035, r * .34, r * .58); }
    }
    const face = new THREE.ExtrudeGeometry(shape, { depth: .02, bevelEnabled: true, bevelThickness: .012, bevelSize: .006, bevelSegments: 2, curveSegments: 40 });
    const parts = [face];
    parts.push(new THREE.TorusGeometry(R0, .014, 6, 48).translate(0, 0, .022));
    parts.push(new THREE.CylinderGeometry(r * .085, r * .1, .05, 20).rotateX(Math.PI / 2).translate(0, 0, .035));
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; parts.push(new THREE.CylinderGeometry(.011, .011, .03, 8).rotateX(Math.PI / 2).translate(Math.cos(a) * r * .15, Math.sin(a) * r * .15, .045)); }
    for (const p of parts) { p.deleteAttribute('uv'); }
    return mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p));
  });
}
function wheelGeos(r, tw) {
  const k = `${r}_${tw}`;
  const tire = cached('tire' + k, () => {
    const a = tw / 2;
    const pts = [[r * .7, -a * .9], [r * .79, -a], [r * .92, -a * .99], [r - .014, -a + .012], [r - .002, -a + .035], [r, -a + .06], [r, a - .06], [r - .002, a - .035], [r - .014, a - .012], [r * .92, a * .99], [r * .79, a], [r * .7, a * .9]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 48).rotateX(Math.PI / 2);
  });
  const barrel = cached('barrel' + k, () => new THREE.CylinderGeometry(r * .7, r * .7, tw - .03, 32, 1, true).rotateX(Math.PI / 2));
  const disc = cached('disc' + k, () => new THREE.CircleGeometry(r * .56, 40));
  const back = cached('back' + k, () => new THREE.CircleGeometry(r * .7, 24));
  const cal = cached('cal' + k, () => {
    const sh = new THREE.Shape(); const a0 = Math.PI / 2 - .5, a1 = Math.PI / 2 + .5, r0 = r * .4, r1 = r * .6;
    sh.absarc(0, 0, r1, a0, a1, false); sh.absarc(0, 0, r0, a1, a0, true); sh.closePath();
    return new THREE.ExtrudeGeometry(sh, { depth: .06, bevelEnabled: true, bevelThickness: .01, bevelSize: .01, bevelSegments: 2, curveSegments: 12 }).translate(0, 0, -.03);
  });
  return { tire, barrel, disc, back, cal };
}

// Traffic cars: merge every static body part into one mesh per material (cached per model) to save draw calls.
const lodCache = new Map();
function bakeLOD(body, key, own) {
  let parts = lodCache.get(key);
  const slotOf = (mat) => mat === own.paint ? 'paint' : mat === own.head ? 'head' : mat === own.tail ? 'tail' : mat;
  if (!parts) {
    const bySlot = new Map();
    body.updateMatrix();
    for (const mesh of body.children) {
      if (!mesh.isMesh) continue;
      mesh.updateMatrix();
      const g = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrix);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const n = g.attributes.position.count;
      const groups = g.groups.length ? g.groups : [{ start: 0, count: n, materialIndex: 0 }];
      for (const gr of groups) {
        const part = new THREE.BufferGeometry();
        for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]]) {
          const src = g.attributes[name], arr = new Float32Array(gr.count * size);
          if (src) for (let i = 0; i < gr.count; i++) for (let k = 0; k < size; k++) arr[i * size + k] = src.array[(gr.start + i) * size + k];
          part.setAttribute(name, new THREE.BufferAttribute(arr, size));
        }
        const slot = slotOf(mats[gr.materialIndex]);
        if (!bySlot.has(slot)) bySlot.set(slot, []);
        bySlot.get(slot).push(part);
      }
    }
    parts = [...bySlot.entries()].map(([slot, list]) => { const g = mergeGeometries(list); g.userData.shared = true; return { slot, g }; });
    parts.sort((a, b) => (b.slot === 'paint') - (a.slot === 'paint'));
    lodCache.set(key, parts);
  }
  for (const c of [...body.children]) body.remove(c);
  for (const { slot, g } of parts) {
    const mat = slot === 'paint' ? own.paint : slot === 'head' ? own.head : slot === 'tail' ? own.tail : slot;
    body.add(new THREE.Mesh(g, mat));
  }
}

function makeWheel(s, tw, side, lod) {
  const m = getShared();
  const r = s.r;
  const G = wheelGeos(r, tw);
  const pivot = new THREE.Group(), spin = new THREE.Group();
  pivot.add(spin);
  spin.add(new THREE.Mesh(G.tire, m.tire));
  if (lod) {
    const face = new THREE.Mesh(rimFaceGeo(r, s.rimStyle), rimMat(s.rim || '#cfd2d6'));
    face.position.z = side * (tw / 2 - .07); face.rotation.y = side > 0 ? 0 : Math.PI; spin.add(face);
    const back = new THREE.Mesh(G.back, m.under); back.position.z = side * (tw / 2 - .08); back.rotation.y = side > 0 ? 0 : Math.PI; spin.add(back);
    return { pivot, spin };
  }
  spin.add(new THREE.Mesh(G.barrel, m.barrel));
  const back = new THREE.Mesh(G.back, m.under); back.position.z = -side * .04; back.rotation.y = side > 0 ? 0 : Math.PI; spin.add(back);
  const disc = new THREE.Mesh(G.disc, m.disc); disc.position.z = side * (tw / 2 - .1); disc.rotation.y = side > 0 ? 0 : Math.PI; spin.add(disc);
  const face = new THREE.Mesh(rimFaceGeo(r, s.rimStyle), rimMat(s.rim || '#cfd2d6'));
  face.position.z = side * (tw / 2 - .07); face.rotation.y = side > 0 ? 0 : Math.PI; spin.add(face);
  const cal = new THREE.Mesh(G.cal, calMat(s.cal || '#c8102e')); cal.position.z = side * (tw / 2 - .075); cal.rotation.y = side > 0 ? 0 : Math.PI; pivot.add(cal);
  return { pivot, spin };
}

// ---------- assembly
export function makeCar(s, color, opts = {}) {
  const m = getShared();
  const { W, wb, r, p } = s, h = s.L / 2;
  const pr = profile(s);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: .45, roughness: .3, clearcoat: 1, clearcoatRoughness: .025, envMapIntensity: 1.15 });
  const ft = frontTextures(s), rt = rearTextures(s);
  const overlay = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
  const headMat = new THREE.MeshStandardMaterial({ map: ft.map, emissiveMap: ft.emit, emissive: 0xfff3dc, emissiveIntensity: 1.2, alphaTest: .4, roughness: .18, metalness: .5, ...overlay });
  const tailMat = new THREE.MeshStandardMaterial({ map: rt.map, emissiveMap: rt.emit, emissive: 0xff1a1a, emissiveIntensity: .7, alphaTest: .4, roughness: .25, metalness: .2, ...overlay });
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = body) => {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  add(bodyGeo(s), [paint, m.under]);
  add(glassGeo(s), [m.glass, paint, m.trim]);

  // nose fascia (+ hood headlights in the top half of the same texture)
  add(cached(s.id + ':fcap', () => capGeo(s, h + .003, 1, .5, 0)), headMat);
  if (!s.boxy) {
    add(cached(s.id + ':hl', () => {
      const parts = [];
      for (const sd of [-1, 1]) {
        const x0 = h - (s.npc ? .42 : .6), x1 = h - .04;
        parts.push(orientOut(patchGeo(12, 6, (u, v) => {
          const x = lerp(x0, x1, u), c = pr.sec(x), z = sd * lerp(.42, .97, v) * c.hw;
          return [x, pr.surfY(x, z) + .006, z, u, .5 + .5 * v];
        }), new THREE.Vector3(0, 1, 0)));
      }
      return mergeGeometries(parts);
    }), headMat);
  }
  add(cached(s.id + ':rcap', () => capGeo(s, -h - .003, -1)), tailMat);
  // panel lines, handles, side intakes
  let sideMat = m.sides.get(s.id);
  if (!sideMat) { sideMat = new THREE.MeshStandardMaterial({ map: sideTexture(s), alphaTest: .45, roughness: .4, ...overlay }); m.sides.set(s.id, sideMat); }
  add(cached(s.id + ':side', () => {
    const R = r + .075, x0 = -wb / 2 + R + .04, x1 = wb / 2 - R - .04, parts = [];
    for (const sd of [-1, 1]) parts.push(orientOut(patchGeo(16, 6, (u, v) => {
      const x = lerp(x0, x1, u), c = pr.sec(x), y = lerp(c.yb + .02, c.ys - .015, v);
      return [x, y, sd * (pr.sideZ(x, y) + .004), sd > 0 ? u : u, v];
    }), new THREE.Vector3(0, 0, sd)));
    return mergeGeometries(parts);
  }), sideMat);

  // mirrors on stalks at the base of the A-pillar
  {
    const mx = p.cowlX - (s.boxy ? .1 : .2), hb = pr.hwB(mx), by = pr.surfY(mx, hb);
    const head = cached('mirrorHead', () => new THREE.SphereGeometry(1, 18, 12).scale(.07, .055, .11));
    const stalk = cached('mirrorStalk', () => new THREE.BoxGeometry(.05, .03, .14));
    for (const sd of [-1, 1]) {
      add(head, paint, mx, by + .07, sd * (hb + .19));
      add(stalk, m.trim, mx + .01, by + .04, sd * (hb + .09)).rotation.x = sd * -.3;
      const g = add(cached('mirrorGlass', () => new THREE.CircleGeometry(1, 16).scale(.095, .045, 1).rotateY(-Math.PI / 2)), m.chrome, mx - .072, by + .07, sd * (hb + .19));
    }
  }
  // exhaust tips
  const exG = cached('exhaust', () => new THREE.CylinderGeometry(1, 1, .14, 16, 1, true).rotateZ(Math.PI / 2));
  for (const [ez, ey, er] of exhaustLayout(s)) { const e = add(exG, m.chrome, -h + .03, ey, ez); e.scale.set(1, er, er); }
  // front splitter + rear wing
  if (!s.boxy) {
    const c = pr.sec(h - .05);
    add(cached(s.id + ':split', () => new THREE.BoxGeometry(.12, .02, c.hw * 1.9)), m.carbon, h - .03, c.yb + .005, 0);
  }
  if (s.wing) {
    const wx = -h + .3, wy = p.deck + .26;
    const foil = cached('foil' + s.id, () => {
      const sh = new THREE.Shape(); sh.moveTo(.22, 0); sh.quadraticCurveTo(.1, .05, -.2, .035); sh.quadraticCurveTo(-.23, .015, -.2, -.005); sh.quadraticCurveTo(.05, -.01, .22, 0);
      return new THREE.ExtrudeGeometry(sh, { depth: W * .92, bevelEnabled: false, curveSegments: 10 }).translate(0, 0, -W * .46);
    });
    add(foil, m.carbon, wx, wy, 0);
    for (const sd of [-1, 1]) add(cached('wingPost', () => new THREE.BoxGeometry(.12, .28, .02)), m.carbon, wx + .04, p.deck + .12, sd * .45);
    for (const sd of [-1, 1]) add(cached('wingEnd' + s.id, () => new THREE.BoxGeometry(.48, .16, .012)), m.carbon, wx, wy - .02, sd * W * .462);
  }
  if (s.spare) {
    const c = pr.sec(-h), sp = new THREE.Group(); sp.position.set(-h - .14, (c.yb + c.yt) / 2 + .05, 0); sp.rotation.y = Math.PI / 2; body.add(sp);
    sp.add(new THREE.Mesh(wheelGeos(r, .24).tire, m.tire));
    const cover = new THREE.Mesh(cached('spareCover', () => new THREE.CylinderGeometry(r * .78, r * .78, .2, 32).rotateX(Math.PI / 2)), paint); sp.add(cover);
  }
  if (opts.taxi) add(cached('taxiSign', () => new THREE.BoxGeometry(.5, .17, .22)), m.taxi, (p.wsX + p.roofX) / 2, p.roof + .1, 0);

  if (opts.lod) bakeLOD(body, s.id + (opts.taxi ? ':taxi' : ''), { paint, head: headMat, tail: tailMat });

  // wheels
  const wheels = [];
  for (const [x, front] of [[wb / 2, true], [-wb / 2, false]]) {
    for (const sd of [-1, 1]) {
      const tw = front ? .26 : .3;
      const w = makeWheel(s, tw, sd, opts.lod);
      w.pivot.position.set(x, r, sd * (W / 2 - tw / 2 - .015));
      root.add(w.pivot);
      wheels.push({ ...w, front });
    }
  }
  // soft contact shadow
  const blob = new THREE.Mesh(cached('blob' + s.id, () => new THREE.PlaneGeometry(s.L * 1.2, W * 1.45).rotateX(-Math.PI / 2)), m.blob);
  blob.position.y = .06; blob.renderOrder = 8; root.add(blob);

  root.traverse(o => { if (o.isMesh && o !== blob) { o.castShadow = !!opts.shadows; } });
  return { root, body, wheels, paint, headMat, tailMat, spec: s };
}

export function disposeCar(c) {
  c.paint.dispose(); c.headMat.dispose(); c.tailMat.dispose();
}
