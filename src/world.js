// Real-world city builder: OpenStreetMap streets, buildings, parks and water -> Three.js meshes.
import * as THREE from 'three';

export const CITIES = [
  { id: 'monaco', name: 'Monte Carlo', country: 'Monaco', lat: 43.7394, lon: 7.4270 },
  { id: 'nyc', name: 'Times Square', country: 'New York, USA', lat: 40.7580, lon: -73.9855, taxi: true },
  { id: 'tokyo', name: 'Shibuya', country: 'Tokyo, Japan', lat: 35.6595, lon: 139.7005, left: true },
  { id: 'dubai', name: 'Downtown', country: 'Dubai, UAE', lat: 25.1972, lon: 55.2744 },
  { id: 'london', name: 'Westminster', country: 'London, UK', lat: 51.5010, lon: -0.1260, left: true },
  { id: 'paris', name: 'Champs-Élysées', country: 'Paris, France', lat: 48.8700, lon: 2.3070 },
  { id: 'la', name: 'Beverly Hills', country: 'Los Angeles, USA', lat: 34.0696, lon: -118.4010 },
  { id: 'mumbai', name: 'South Mumbai', country: 'Mumbai, India', lat: 18.9330, lon: 72.8330, left: true },
  { id: 'blr', name: 'MG Road', country: 'Bengaluru, India', lat: 12.9750, lon: 77.6060, left: true },
  { id: 'gen', name: 'Neo City', country: 'Generated city (offline)', procedural: true },
];
export const LEFT_HAND = new Set(['gb', 'ie', 'jp', 'in', 'au', 'nz', 'za', 'hk', 'mo', 'sg', 'my', 'th', 'id', 'pk', 'bd', 'lk', 'np', 'ke', 'tz', 'ug', 'zm', 'zw', 'bw', 'na', 'mz', 'mw', 'cy', 'mt', 'jm', 'tt', 'bs', 'bb', 'gy', 'sr', 'fj', 'bt', 'mu', 'bn', 'im', 'je', 'gg']);

const ROAD_W = {
  motorway: 14, trunk: 12, primary: 11, secondary: 10, tertiary: 9, unclassified: 7, residential: 7,
  living_street: 6, service: 4.5, pedestrian: 6, motorway_link: 7, trunk_link: 7, primary_link: 7,
  secondary_link: 7, tertiary_link: 7,
};
const TRAFFIC = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);
const NO_SIDEWALK = new Set(['motorway', 'motorway_link', 'trunk_link', 'service', 'pedestrian']);

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- data
export async function fetchOSM(lat, lon, half, onStatus = () => {}) {
  const dLat = half / 110540, dLon = half / (111320 * Math.cos(lat * Math.PI / 180));
  const bb = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map(v => v.toFixed(5)).join(',');
  const hw = Object.keys(ROAD_W).join('|');
  const q = `[out:json][timeout:90];(way["highway"~"^(${hw})$"](${bb});way["building"](${bb});` +
    `way["leisure"~"^(park|garden|pitch|playground|golf_course)$"](${bb});` +
    `way["landuse"~"^(grass|forest|recreation_ground|village_green|meadow|cemetery)$"](${bb});` +
    `way["natural"~"^(water|wood|scrub|grassland)$"](${bb}););out geom;`;
  const key = 'https://citydrive.local/osm/v1/' + bb;
  let cache = null;
  try {
    cache = await caches.open('citydrive-osm');
    const hit = await cache.match(key);
    if (hit) { onStatus('Loading saved map…'); return await hit.json(); }
  } catch { cache = null; }
  // Public Overpass mirrors: start with one, and if it is slow or fails, ask the next one too. First good answer wins.
  const hosts = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
  onStatus('Downloading real streets & buildings from OpenStreetMap…');
  const text = await new Promise((resolve, reject) => {
    const ctls = []; let next = 0, failed = 0, done = false, timer = null, lastErr = null;
    const finish = (fn, v) => { if (done) return; done = true; clearTimeout(timer); clearTimeout(overall); ctls.forEach(c => c.abort()); fn(v); };
    const overall = setTimeout(() => finish(reject, new Error('map servers are busy')), 100000);
    const launch = () => {
      if (done || next >= hosts.length) return;
      const host = hosts[next++], ctl = new AbortController(); ctls.push(ctl);
      clearTimeout(timer); timer = setTimeout(launch, 9000);
      fetch(host, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal })
        .then(async res => {
          if (!res.ok) throw new Error('map server busy (HTTP ' + res.status + ')');
          const t = await res.text();
          if (!t.trimStart().startsWith('{')) throw new Error('map server returned an error');
          finish(resolve, t);
        })
        .catch(e => {
          if (done) return; lastErr = e; failed++;
          if (failed >= hosts.length) finish(reject, lastErr); else if (next < hosts.length) launch();
          if (next > 1) onStatus('Map server is busy, trying another…');
        });
    };
    launch();
  });
  onStatus(`Received ${(text.length / 1e6).toFixed(1)} MB of map data`);
  const json = JSON.parse(text);
  if (cache) { try { await cache.put(key, new Response(text, { headers: { 'Content-Type': 'application/json' } })); } catch { /* storage full */ } }
  return json;
}

function polyArea(p) { let a = 0; for (let i = 0, n = p.length; i < n; i++) { const q = p[(i + 1) % n]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; }
function closedPoly(pts) {
  if (pts.length < 4) return null;
  const a = pts[0], b = pts[pts.length - 1];
  if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.05) return null;
  const p = pts.slice(0, -1);
  return p.length >= 3 ? p : null;
}
const SMALL = new Set(['house', 'detached', 'garage', 'garages', 'shed', 'hut', 'bungalow', 'semidetached_house', 'terrace', 'cabin', 'carport', 'kiosk']);
function bHeight(t, id, poly) {
  const pf = s => { const v = parseFloat(String(s ?? '').replace(',', '.')); return isFinite(v) ? v : NaN; };
  let h = pf(t.height);
  if (!(h > 0)) { const lv = pf(t['building:levels']); if (lv > 0) h = lv * 3.3 + 1.5; }
  if (!(h > 0)) {
    const r = mulberry32(id % 2147483647)();
    if (t.building === 'roof') h = 5;
    else if (SMALL.has(t.building)) h = 5 + r * 4;
    else h = 9 + r * 14 + Math.min(18, Math.abs(polyArea(poly)) / 500);
  }
  return Math.max(3, Math.min(h, 650));
}
const isGreen = t => /^(park|garden|pitch|playground|golf_course)$/.test(t.leisure || '') ||
  /^(grass|forest|recreation_ground|village_green|meadow|cemetery)$/.test(t.landuse || '') ||
  /^(wood|scrub|grassland)$/.test(t.natural || '');

export function parseOSM(json, lat0, lon0, half) {
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), kz = 110540;
  const roads = [], buildings = [], green = [], water = [];
  const lim = half * 1.3;
  for (const el of json.elements || []) {
    if (el.type !== 'way' || !el.geometry) continue;
    const t = el.tags || {};
    const pts = [];
    for (const g of el.geometry) if (g) pts.push([(g.lon - lon0) * kx, -(g.lat - lat0) * kz]);
    if (pts.length < 2) continue;
    if (t.building && t.building !== 'no') {
      if (t.location === 'underground' || t.layer && parseFloat(t.layer) < 0) continue;
      const poly = closedPoly(pts); if (!poly) continue;
      let cx = 0, cz = 0; for (const p of poly) { cx += p[0]; cz += p[1]; } cx /= poly.length; cz /= poly.length;
      if (Math.abs(cx) > lim || Math.abs(cz) > lim) continue;
      buildings.push({ pts: poly, h: bHeight(t, el.id, poly), color: t['building:colour'], roof: t['roof:colour'], id: el.id });
    } else if (t.highway && ROAD_W[t.highway]) {
      if ((t.tunnel && t.tunnel !== 'no') || t.area === 'yes') continue;
      let w = ROAD_W[t.highway];
      const lanes = parseFloat(t.lanes); if (lanes > 0) w = Math.max(w, Math.min(lanes * 3.4, 24));
      const ow = t.oneway;
      if (ow === '-1') pts.reverse();
      roads.push({ pts, cls: t.highway, w, oneway: ow === 'yes' || ow === '1' || ow === '-1' || t.highway === 'motorway' || t.junction === 'roundabout', name: t.name || '' });
    } else if (isGreen(t)) {
      const poly = closedPoly(pts); if (poly) green.push(poly);
    } else if (t.natural === 'water') {
      const poly = closedPoly(pts); if (poly) water.push(poly);
    }
  }
  return { roads, buildings, green, water, half };
}

export function proceduralCity(half, seed = 7) {
  const rnd = mulberry32(seed);
  const sp = 96, n = Math.floor(half / sp);
  const roads = [], buildings = [], green = [];
  const co = []; for (let k = -n; k <= n; k++) co.push(k * sp);
  for (const c of co) {
    const major = Math.round(c / sp) % 3 === 0;
    for (let j = 0; j < co.length - 1; j++) {
      const o = { cls: major ? 'primary' : 'residential', w: major ? 12 : 8, oneway: false, name: '' };
      roads.push({ ...o, pts: [[c, co[j]], [c, co[j + 1]]] });
      roads.push({ ...o, pts: [[co[j], c], [co[j + 1], c]] });
    }
  }
  let id = 1;
  for (let i = 0; i < co.length - 1; i++) for (let j = 0; j < co.length - 1; j++) {
    const ins = 9, x0 = co[i] + ins, x1 = co[i + 1] - ins, z0 = co[j] + ins, z1 = co[j + 1] - ins;
    if (rnd() < 0.08) { green.push([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]); continue; }
    const nx = 2 + (rnd() * 2 | 0), nz = 2 + (rnd() * 2 | 0);
    const lw = (x1 - x0) / nx, ld = (z1 - z0) / nz;
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      const m = 1.5, bx0 = x0 + a * lw + m, bx1 = x0 + (a + 1) * lw - m, bz0 = z0 + b * ld + m, bz1 = z0 + (b + 1) * ld - m;
      const d = Math.hypot((bx0 + bx1) / 2, (bz0 + bz1) / 2) / half;
      const h = 8 + rnd() * 12 + (rnd() < .6 ? Math.pow(Math.max(0, 1 - d), 2) * rnd() * 180 : 0);
      buildings.push({ pts: [[bx0, bz0], [bx1, bz0], [bx1, bz1], [bx0, bz1]], h, id: id++ });
    }
  }
  return { roads, buildings, green, water: [], half };
}

// ---------------------------------------------------------------- helpers
class Grid {
  constructor(cs) { this.cs = cs; this.m = new Map(); this.stamp = 0; }
  k(i, j) { return (i + 32768) * 65536 + (j + 32768); }
  add(minx, minz, maxx, maxz, it) {
    const cs = this.cs;
    for (let i = Math.floor(minx / cs); i <= Math.floor(maxx / cs); i++)
      for (let j = Math.floor(minz / cs); j <= Math.floor(maxz / cs); j++) {
        const key = this.k(i, j); let a = this.m.get(key);
        if (!a) this.m.set(key, a = []); a.push(it);
      }
  }
  query(x, z, r, cb) {
    const cs = this.cs, s = ++this.stamp;
    for (let i = Math.floor((x - r) / cs); i <= Math.floor((x + r) / cs); i++)
      for (let j = Math.floor((z - r) / cs); j <= Math.floor((z + r) / cs); j++) {
        const a = this.m.get(this.k(i, j)); if (!a) continue;
        for (const it of a) { if (it._s === s) continue; it._s = s; if (cb(it) === false) return; }
      }
  }
}

class Buf {
  constructor(colors = false) { this.P = []; this.N = []; this.U = []; this.C = colors ? [] : null; }
  tri(a, b, c, n, col) {
    const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2], acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
    const cx = aby * acz - abz * acy, cy = abz * acx - abx * acz, cz = abx * acy - aby * acx;
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) { const t = b; b = c; c = t; }
    for (const v of [a, b, c]) {
      this.P.push(v[0], v[1], v[2]); this.N.push(n[0], n[1], n[2]); this.U.push(v[3] || 0, v[4] || 0);
      if (this.C) this.C.push(col.r, col.g, col.b);
    }
  }
  get empty() { return this.P.length === 0; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    if (this.C) g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.computeBoundingSphere();
    return g;
  }
}
const UP = [0, 1, 0];

function ribbon(buf, pts, w, y) {
  const n = pts.length, hw = w / 2;
  const seg = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; };
  const L = [], R = [], D = []; let dist = 0;
  for (let i = 0; i < n; i++) {
    let m;
    if (i === 0) m = seg(pts[0], pts[1]);
    else if (i === n - 1) m = seg(pts[n - 2], pts[n - 1]);
    else {
      const a = seg(pts[i - 1], pts[i]), b = seg(pts[i], pts[i + 1]);
      let mx = a[0] + b[0], mz = a[1] + b[1]; const l = Math.hypot(mx, mz);
      if (l < 1e-3) m = a; else { mx /= l; mz /= l; const s = 1 / Math.max(mx * a[0] + mz * a[1], .5); m = [mx * s, mz * s]; }
    }
    if (i > 0) dist += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    L.push([pts[i][0] + m[0] * hw, pts[i][1] + m[1] * hw]); R.push([pts[i][0] - m[0] * hw, pts[i][1] - m[1] * hw]); D.push(dist / 10);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = [L[i][0], y, L[i][1], 0, D[i]], b = [R[i][0], y, R[i][1], 1, D[i]];
    const c = [R[i + 1][0], y, R[i + 1][1], 1, D[i + 1]], d = [L[i + 1][0], y, L[i + 1][1], 0, D[i + 1]];
    buf.tri(a, b, c, UP); buf.tri(a, c, d, UP);
  }
}
function disc(buf, x, z, r, y) {
  const s = 14;
  for (let i = 0; i < s; i++) {
    const a1 = i / s * Math.PI * 2, a2 = (i + 1) / s * Math.PI * 2;
    buf.tri([x, y, z, .25, .3], [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r, .25, .3], [x + Math.cos(a2) * r, y, z + Math.sin(a2) * r, .25, .3], UP);
  }
}
function fillPoly(buf, pts, y, uvs) {
  const contour = pts.map(p => new THREE.Vector2(p[0], p[1]));
  let faces; try { faces = THREE.ShapeUtils.triangulateShape(contour, []); } catch { return; }
  for (const f of faces) {
    const v = f.map(i => [pts[i][0], y, pts[i][1], pts[i][0] / uvs, pts[i][1] / uvs]);
    buf.tri(v[0], v[1], v[2], UP);
  }
}
function pip(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
    if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------- textures
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function speckle(g, w, h, n, lo, hi, a) {
  for (let i = 0; i < n; i++) {
    const v = (lo + Math.random() * (hi - lo)) | 0;
    g.fillStyle = `rgba(${v},${v},${v},${a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}
function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function makeTextures() {
  const asphalt = (dash) => {
    const [c, g] = cnv(512, 512);
    g.fillStyle = '#3c3e42'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 26000; i++) {
      const v = 40 + Math.random() * 50 | 0; g.fillStyle = `rgba(${v},${v},${v + 3},.55)`;
      const s = 1 + Math.random() * 1.5; g.fillRect(Math.random() * 512, Math.random() * 512, s, s);
    }
    for (let i = 0; i < 18; i++) { // patches / repairs
      g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '90,90,90'},.06)`;
      g.fillRect(Math.random() * 512, Math.random() * 512, 30 + Math.random() * 120, 20 + Math.random() * 90);
    }
    g.fillStyle = 'rgba(0,0,0,.09)'; g.fillRect(90, 0, 80, 512); g.fillRect(342, 0, 80, 512);
    if (dash) { g.fillStyle = '#e7e4d8'; g.fillRect(250, 0, 12, 250); }
    else { g.fillStyle = 'rgba(230,228,216,.5)'; g.fillRect(8, 0, 6, 512); g.fillRect(498, 0, 6, 512); }
    return tex(c);
  };
  const [sc, sg] = cnv(256, 256);
  sg.fillStyle = '#a3a19b'; sg.fillRect(0, 0, 256, 256); speckle(sg, 256, 256, 8000, 120, 200, .35);
  sg.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 256; i += 32) { sg.fillRect(i, 0, 2, 256); sg.fillRect(0, i, 256, 2); }
  const [gc, gg] = cnv(512, 512);
  gg.fillStyle = '#8a8a84'; gg.fillRect(0, 0, 512, 512); speckle(gg, 512, 512, 30000, 90, 170, .3);
  for (let i = 0; i < 40; i++) { gg.fillStyle = `rgba(${60 + Math.random() * 40 | 0},${80 + Math.random() * 30 | 0},50,.08)`; gg.beginPath(); gg.arc(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 60, 0, 7); gg.fill(); }
  const [grc, grg] = cnv(256, 256);
  grg.fillStyle = '#4f7d34'; grg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) { grg.fillStyle = `hsla(${85 + Math.random() * 30},${40 + Math.random() * 25}%,${22 + Math.random() * 22}%,.6)`; grg.fillRect(Math.random() * 256, Math.random() * 256, 1, 2 + Math.random() * 3); }

  // building facades: 16 x 16 window cells per tile (one tile = 64 m wide, 51.2 m tall)
  const N = 1024, C = 64;
  const [wc, wg] = cnv(N, N), [ec, eg] = cnv(N, N), [rc, rg] = cnv(N, N);
  wg.fillStyle = '#ffffff'; wg.fillRect(0, 0, N, N); speckle(wg, N, N, 25000, 190, 255, .25);
  eg.fillStyle = '#000'; eg.fillRect(0, 0, N, N);
  rg.fillStyle = 'rgb(235,235,235)'; rg.fillRect(0, 0, N, N);
  const lit = ['#ffd9a0', '#ffe6bf', '#fff1d6', '#cfe3ff', '#ffc680'];
  for (let cy = 0; cy < 16; cy++) for (let cx = 0; cx < 16; cx++) {
    const x = cx * C, y = cy * C;
    wg.fillStyle = 'rgba(0,0,0,.10)'; wg.fillRect(x, y + C - 5, C, 5);
    const gr = wg.createLinearGradient(0, y + 12, 0, y + 52);
    const tint = Math.random() * 20 | 0;
    gr.addColorStop(0, `rgb(${70 + tint},${88 + tint},${105 + tint})`); gr.addColorStop(1, `rgb(${22 + tint},${30 + tint},${40 + tint})`);
    wg.fillStyle = gr; wg.fillRect(x + 9, y + 12, 46, 40);
    wg.fillStyle = 'rgba(210,210,210,.7)'; wg.fillRect(x + 31, y + 12, 2, 40);
    rg.fillStyle = 'rgb(28,28,28)'; rg.fillRect(x + 9, y + 12, 46, 40);
    if (Math.random() < .42) {
      eg.globalAlpha = .45 + Math.random() * .55; eg.fillStyle = lit[(Math.random() * lit.length) | 0];
      const blind = Math.random() < .3 ? 10 + Math.random() * 20 : 0;
      eg.fillRect(x + 9, y + 12 + blind, 46, 40 - blind); eg.globalAlpha = 1;
    }
  }
  const glow = (() => {
    const [c, g] = cnv(128, 128); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  return {
    major: asphalt(true), minor: asphalt(false), side: tex(sc), ground: tex(gc), grass: tex(grc),
    wall: tex(wc), wallE: tex(ec), wallR: tex(rc, false), glow,
  };
}

const WALLS = ['#d8d2c4', '#c9c2b3', '#b8b4ad', '#e6e1d6', '#a89f91', '#c7b299', '#9aa5ad', '#b5a48c', '#d1c7b7', '#8f9aa3', '#a0604a', '#b07a5a', '#e9e4da', '#9c9488'];
const GLASS = ['#8fa3b5', '#7d93a8', '#a7b6c4', '#6f8296', '#9fb0b8'];
const ROOFS = ['#6b6b6b', '#7a7570', '#5e6166', '#8a8580', '#545454'];
const _cc = cnv(1, 1)[1];
function cssColor(str) {
  if (!str) return null;
  _cc.fillStyle = '#010203'; _cc.fillStyle = String(str).trim();
  return _cc.fillStyle === '#010203' ? null : _cc.fillStyle;
}

// ---------------------------------------------------------------- build
export function buildWorld(data, opts = {}) {
  const half = data.half, B = half + 40;
  const group = new THREE.Group();
  const segGrid = new Grid(24), bGrid = new Grid(48), rGrid = new Grid(32), oGrid = new Grid(12);
  const T = makeTextures();
  const mats = [];
  const M = (m) => { mats.push(m); return m; };
  const overlay = { depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
  const addMesh = (buf, mat, ro, shadow = false) => {
    if (buf.empty) return null;
    const mesh = new THREE.Mesh(buf.geometry(), mat);
    mesh.receiveShadow = true; mesh.castShadow = shadow; mesh.renderOrder = ro; mesh.matrixAutoUpdate = false;
    group.add(mesh); return mesh;
  };

  // ground
  T.ground.repeat.set(500, 500);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(10000, 10000).rotateX(-Math.PI / 2), M(new THREE.MeshStandardMaterial({ map: T.ground, roughness: .95 })));
  ground.receiveShadow = true; group.add(ground);

  // parks & water
  const greenBuf = new Buf(), waterBuf = new Buf();
  for (const p of data.green) fillPoly(greenBuf, p, .02, 6);
  for (const p of data.water) fillPoly(waterBuf, p, .03, 20);
  addMesh(greenBuf, M(new THREE.MeshStandardMaterial({ map: T.grass, roughness: 1, ...overlay })), 1);
  addMesh(waterBuf, M(new THREE.MeshStandardMaterial({ color: 0x1d4b66, metalness: .4, roughness: .06, ...overlay })), 1);

  // roads
  const keyOf = (p) => Math.round(p[0] * 10) + ',' + Math.round(p[1] * 10);
  const nodeCount = new Map();
  for (const r of data.roads) for (const p of r.pts) { const k = keyOf(p); nodeCount.set(k, (nodeCount.get(k) || 0) + 1); }
  const sideBuf = new Buf(), minorBuf = new Buf(), majorBuf = new Buf(), walkBuf = new Buf();
  for (const r of data.roads) {
    // cumulative lengths
    r.cum = [0]; for (let i = 1; i < r.pts.length; i++) r.cum.push(r.cum[i - 1] + Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]));
    r.len = r.cum[r.cum.length - 1];
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], e = r.w / 2 + 2;
      rGrid.add(Math.min(a[0], b[0]) - e, Math.min(a[1], b[1]) - e, Math.max(a[0], b[0]) + e, Math.max(a[1], b[1]) + e, { road: r, i });
    }
    if (r.cls === 'pedestrian') { ribbon(walkBuf, r.pts, r.w, .035); continue; }
    const sw = !NO_SIDEWALK.has(r.cls);
    if (sw) ribbon(sideBuf, r.pts, r.w + 3.6, .03);
    const major = r.w >= 9;
    ribbon(major ? majorBuf : minorBuf, r.pts, r.w, major ? .05 : .045);
    r.pts.forEach((p, i) => {
      if (i === 0 || i === r.pts.length - 1 || nodeCount.get(keyOf(p)) > 1) {
        disc(minorBuf, p[0], p[1], r.w / 2, .045);
        if (sw) disc(sideBuf, p[0], p[1], r.w / 2 + 1.8, .03);
      }
    });
  }
  addMesh(sideBuf, M(new THREE.MeshStandardMaterial({ map: T.side, roughness: .9, ...overlay })), 2);
  addMesh(walkBuf, M(new THREE.MeshStandardMaterial({ map: T.side, color: 0xd8cfc0, roughness: .9, ...overlay })), 2);
  addMesh(minorBuf, M(new THREE.MeshStandardMaterial({ map: T.minor, roughness: .85, ...overlay })), 3);
  addMesh(majorBuf, M(new THREE.MeshStandardMaterial({ map: T.major, roughness: .85, ...overlay })), 4);

  // buildings
  T.wall.repeat.set(1, 1);
  const wallMat = M(new THREE.MeshStandardMaterial({
    map: T.wall, emissiveMap: T.wallE, emissive: 0xffffff, emissiveIntensity: 0, roughnessMap: T.wallR,
    roughness: 1, metalness: .15, vertexColors: true,
  }));
  const roofMat = M(new THREE.MeshStandardMaterial({ roughness: .9, vertexColors: true }));
  const wallBuf = new Buf(true), roofBuf = new Buf(true);
  const col = new THREE.Color(), rcol = new THREE.Color();
  const buildings = [];
  for (const b of data.buildings) {
    const pts = b.pts, n = pts.length, h = b.h;
    const rnd = mulberry32((b.id * 2654435761) >>> 0);
    const tag = cssColor(b.color);
    if (tag) col.set(tag); else col.set(h > 45 && rnd() < .7 ? GLASS[(rnd() * GLASS.length) | 0] : WALLS[(rnd() * WALLS.length) | 0]);
    const rtag = cssColor(b.roof);
    if (rtag) rcol.set(rtag); else rcol.set(ROOFS[(rnd() * ROOFS.length) | 0]);
    const sgn = polyArea(pts) > 0 ? 1 : -1;
    let per = (rnd() * 16 | 0) * 4, minx = 1e9, minz = 1e9, maxx = -1e9, maxz = -1e9;
    for (let i = 0; i < n; i++) {
      const p1 = pts[i], p2 = pts[(i + 1) % n];
      minx = Math.min(minx, p1[0]); maxx = Math.max(maxx, p1[0]); minz = Math.min(minz, p1[1]); maxz = Math.max(maxz, p1[1]);
      const dx = p2[0] - p1[0], dz = p2[1] - p1[1], len = Math.hypot(dx, dz);
      if (len < .01) continue;
      const nn = sgn > 0 ? [dz / len, 0, -dx / len] : [-dz / len, 0, dx / len];
      const u1 = per / 64, u2 = (per + len) / 64; per += len;
      const a = [p1[0], 0, p1[1], u1, 0], bb = [p2[0], 0, p2[1], u2, 0], c = [p2[0], h, p2[1], u2, h / 51.2], d = [p1[0], h, p1[1], u1, h / 51.2];
      wallBuf.tri(a, bb, c, nn, col); wallBuf.tri(a, c, d, nn, col);
      const s = { x1: p1[0], z1: p1[1], x2: p2[0], z2: p2[1], nx: nn[0], nz: nn[2] };
      segGrid.add(Math.min(p1[0], p2[0]), Math.min(p1[1], p2[1]), Math.max(p1[0], p2[0]), Math.max(p1[1], p2[1]), s);
    }
    const contour = pts.map(p => new THREE.Vector2(p[0], p[1]));
    let faces = [];
    try { faces = THREE.ShapeUtils.triangulateShape(contour, []); } catch { /* bad polygon */ }
    for (const f of faces) roofBuf.tri([pts[f[0]][0], h, pts[f[0]][1]], [pts[f[1]][0], h, pts[f[1]][1]], [pts[f[2]][0], h, pts[f[2]][1]], UP, rcol);
    const bo = { pts, h, minx, minz, maxx, maxz };
    buildings.push(bo);
    bGrid.add(minx, minz, maxx, maxz, bo);
  }
  addMesh(wallBuf, wallMat, 0, true);
  addMesh(roofBuf, roofMat, 0, true);

  const insideBuilding = (x, z) => {
    let found = null;
    bGrid.query(x, z, 0, b => {
      if (x < b.minx || x > b.maxx || z < b.minz || z > b.maxz) return;
      if (pip(x, z, b.pts)) { found = b; return false; }
    });
    return found;
  };
  const nearestRoad = (x, z, maxR = 60, filter = null) => {
    let best = null;
    rGrid.query(x, z, maxR, it => {
      const r = it.road; if (filter && !filter(r)) return;
      const a = r.pts[it.i], b = r.pts[it.i + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
      let t = ((x - a[0]) * dx + (z - a[1]) * dz) / l2; t = Math.max(0, Math.min(1, t));
      const px = a[0] + dx * t, pz = a[1] + dz * t, d = Math.hypot(x - px, z - pz);
      if (!best || d < best.d) { const l = Math.sqrt(l2); best = { road: r, i: it.i, t, px, pz, d, dx: dx / l, dz: dz / l }; }
    });
    return best;
  };
  const inB = (x, z) => Math.abs(x) < half && Math.abs(z) < half;

  // trees & street lights (instanced)
  const trees = [], lamps = [];
  const okSpot = (x, z, clear) => {
    if (!inB(x, z) || insideBuilding(x, z)) return false;
    const nr = nearestRoad(x, z, 14);
    return !(nr && nr.d < nr.road.w / 2 + clear);
  };
  for (const poly of data.green) {
    let minx = 1e9, minz = 1e9, maxx = -1e9, maxz = -1e9;
    for (const p of poly) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); minz = Math.min(minz, p[1]); maxz = Math.max(maxz, p[1]); }
    const area = Math.abs(polyArea(poly)), cnt = Math.min(120, area / 140);
    for (let i = 0; i < cnt && trees.length < 2600; i++) {
      const x = minx + Math.random() * (maxx - minx), z = minz + Math.random() * (maxz - minz);
      if (pip(x, z, poly) && okSpot(x, z, 1.2)) trees.push([x, z]);
    }
  }
  for (const r of data.roads) {
    if (!TRAFFIC.has(r.cls) && r.cls !== 'living_street') continue;
    const major = r.w >= 9;
    for (let d = 6; d < r.len; d += 15) {
      const sp = samplePath(r, d, false);
      const px = -sp.dz, pz = sp.dx;
      for (const side of [-1, 1]) {
        const off = r.w / 2 + (major ? 1.3 : 2.2);
        const x = sp.x + px * side * off, z = sp.z + pz * side * off;
        if (major && side === 1 && (Math.round(d / 15) % 2 === 0)) {
          if (lamps.length < 1800 && okSpot(x, z, .6)) lamps.push([x, z, Math.atan2(-(-pz * side), -px * side)]);
        } else if (!NO_SIDEWALK.has(r.cls) && Math.random() < (major ? .35 : .55) && trees.length < 5200) {
          if (okSpot(x, z, .8)) trees.push([x + (Math.random() - .5), z + (Math.random() - .5)]);
        }
      }
    }
  }
  const dummy = new THREE.Object3D();
  if (trees.length) {
    const trunkG = new THREE.CylinderGeometry(.13, .2, 2.6, 6).translate(0, 1.3, 0);
    const crownG = new THREE.IcosahedronGeometry(1.8, 1).translate(0, 3.9, 0);
    const trunk = new THREE.InstancedMesh(trunkG, M(new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 })), trees.length);
    const crown = new THREE.InstancedMesh(crownG, M(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, flatShading: true })), trees.length);
    const c = new THREE.Color();
    trees.forEach(([x, z], i) => {
      const s = .75 + Math.random() * .6;
      dummy.position.set(x, 0, z); dummy.rotation.set(0, Math.random() * 6.28, 0); dummy.scale.set(s, s * (.85 + Math.random() * .4), s); dummy.updateMatrix();
      trunk.setMatrixAt(i, dummy.matrix); crown.setMatrixAt(i, dummy.matrix);
      c.setHSL(.22 + Math.random() * .1, .5 + Math.random() * .25, .09 + Math.random() * .08); crown.setColorAt(i, c);
      const o = { x, z, r: .35 }; oGrid.add(x - 1, z - 1, x + 1, z + 1, o);
    });
    crown.castShadow = true; trunk.castShadow = true; crown.receiveShadow = true;
    group.add(trunk, crown);
  }
  const lampMat = M(new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffd9a0, emissiveIntensity: .2 }));
  const poolMat = M(new THREE.MeshBasicMaterial({ map: T.glow, color: 0xffc98a, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
  let pools = null;
  if (lamps.length) {
    const poleG = new THREE.CylinderGeometry(.07, .11, 7.2, 6).translate(0, 3.6, 0);
    const armG = new THREE.BoxGeometry(1.9, .09, .09).translate(.95, 7.1, 0);
    const headG = new THREE.BoxGeometry(.7, .12, .3).translate(1.75, 7.0, 0);
    const pole = new THREE.InstancedMesh(poleG, M(new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: .5, metalness: .7 })), lamps.length);
    const arm = new THREE.InstancedMesh(armG, pole.material, lamps.length);
    const head = new THREE.InstancedMesh(headG, lampMat, lamps.length);
    pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2), poolMat, lamps.length);
    lamps.forEach(([x, z, yaw], i) => {
      dummy.position.set(x, 0, z); dummy.rotation.set(0, yaw, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      pole.setMatrixAt(i, dummy.matrix); arm.setMatrixAt(i, dummy.matrix); head.setMatrixAt(i, dummy.matrix);
      const hx = x + Math.cos(yaw) * 2.2, hz = z - Math.sin(yaw) * 2.2;
      dummy.position.set(hx, .08, hz); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); pools.setMatrixAt(i, dummy.matrix);
      oGrid.add(x - 1, z - 1, x + 1, z + 1, { x, z, r: .2 });
    });
    pole.castShadow = true;
    pools.renderOrder = 7; pools.visible = false;
    group.add(pole, arm, head, pools);
  }

  // minimap
  const E = half + 200, mapSize = Math.ceil(E * 2);
  const [mc, mg] = cnv(mapSize, mapSize);
  mg.fillStyle = '#121822'; mg.fillRect(0, 0, mapSize, mapSize);
  const mp = (p) => [p[0] + E, p[1] + E];
  const poly = (pts, fill) => { mg.fillStyle = fill; mg.beginPath(); pts.forEach((p, i) => { const [x, y] = mp(p); i ? mg.lineTo(x, y) : mg.moveTo(x, y); }); mg.closePath(); mg.fill(); };
  for (const p of data.green) poly(p, '#1d3a25');
  for (const p of data.water) poly(p, '#1b3a57');
  for (const b of data.buildings) poly(b.pts, '#283041');
  mg.lineCap = 'round'; mg.lineJoin = 'round';
  for (const pass of [0, 1]) for (const r of data.roads) {
    const major = r.w >= 9; if ((pass === 1) !== major) continue;
    mg.strokeStyle = major ? '#b9c2d6' : (r.cls === 'service' || r.cls === 'pedestrian' ? '#4b5568' : '#7d879c');
    mg.lineWidth = Math.max(2.5, r.w * .9);
    mg.beginPath(); r.pts.forEach((p, i) => { const [x, y] = mp(p); i ? mg.lineTo(x, y) : mg.moveTo(x, y); }); mg.stroke();
  }

  // traffic graph
  const drive = data.roads.filter(r => TRAFFIC.has(r.cls) && r.len > 8 && r.pts.some(p => inB(p[0], p[1])));
  const starts = new Map();
  const pushS = (k, v) => { let a = starts.get(k); if (!a) starts.set(k, a = []); a.push(v); };
  for (const r of drive) {
    pushS(keyOf(r.pts[0]), { road: r, rev: false });
    if (!r.oneway) pushS(keyOf(r.pts[r.pts.length - 1]), { road: r, rev: true });
  }

  // spawn on a main road near the centre
  let spawn = null;
  for (const rad of [80, 200, 400, 800]) {
    const nr = nearestRoad(0, 0, rad, r => TRAFFIC.has(r.cls) && r.w >= 7);
    if (nr) { spawn = { x: nr.px, z: nr.pz, yaw: Math.atan2(-nr.dz, nr.dx) }; break; }
  }
  if (!spawn) { const nr = nearestRoad(0, 0, 900); spawn = nr ? { x: nr.px, z: nr.pz, yaw: Math.atan2(-nr.dz, nr.dx) } : { x: 0, z: 0, yaw: 0 }; }

  return {
    group, half, spawn, buildings, roads: data.roads,
    traffic: { roads: drive, starts, keyOf },
    minimap: { canvas: mc, E },
    stats: { buildings: data.buildings.length, roads: data.roads.length, trees: trees.length, lamps: lamps.length },
    insideBuilding, nearestRoad,
    setNight(on) {
      wallMat.emissiveIntensity = on ? 1.5 : 0;
      lampMat.emissiveIntensity = on ? 8 : .2;
      if (pools) pools.visible = on;
    },
    pushOut(x, z, r) {
      let ox = x, oz = z, moved = false;
      segGrid.query(x, z, r + 1, s => {
        const dx = s.x2 - s.x1, dz = s.z2 - s.z1, l2 = dx * dx + dz * dz || 1;
        let t = ((ox - s.x1) * dx + (oz - s.z1) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = s.x1 + dx * t, pz = s.z1 + dz * t;
        let ex = ox - px, ez = oz - pz; const d = Math.hypot(ex, ez);
        if (d >= r) return;
        const behind = ex * s.nx + ez * s.nz < 0 && t > 0 && t < 1;
        if (behind) { ox = px + s.nx * r; oz = pz + s.nz * r; }
        else if (d < 1e-5) { ox += s.nx * r; oz += s.nz * r; }
        else { ox += ex / d * (r - d); oz += ez / d * (r - d); }
        moved = true;
      });
      oGrid.query(ox, oz, r + 1, o => {
        const ex = ox - o.x, ez = oz - o.z, d = Math.hypot(ex, ez), m = r + o.r;
        if (d < m && d > 1e-5) { ox += ex / d * (m - d); oz += ez / d * (m - d); moved = true; }
      });
      if (ox > B - r) { ox = B - r; moved = true; } if (ox < -B + r) { ox = -B + r; moved = true; }
      if (oz > B - r) { oz = B - r; moved = true; } if (oz < -B + r) { oz = -B + r; moved = true; }
      return moved ? { dx: ox - x, dz: oz - z } : null;
    },
    dispose() {
      group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      for (const m of mats) m.dispose();
      for (const t of Object.values(T)) t.dispose();
    },
  };
}

export function samplePath(road, s, rev) {
  const L = road.len; let d = rev ? L - s : s; d = Math.max(0, Math.min(L, d));
  const cum = road.cum; let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
  const a = road.pts[lo], b = road.pts[hi], sl = cum[hi] - cum[lo];
  const t = sl > 0 ? (d - cum[lo]) / sl : 0;
  let dx = sl > 0 ? (b[0] - a[0]) / sl : 1, dz = sl > 0 ? (b[1] - a[1]) / sl : 0;
  if (rev) { dx = -dx; dz = -dz; }
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx, dz };
}
