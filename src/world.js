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
      buildings.push({ pts: poly, h: bHeight(t, el.id, poly), color: t['building:colour'], roof: t['roof:colour'], id: el.id, type: t.building, roofShape: t['roof:shape'] });
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
    const p1 = [x + Math.cos(a1) * r, z + Math.sin(a1) * r], p2 = [x + Math.cos(a2) * r, z + Math.sin(a2) * r];
    buf.tri([x, y, z, x / 10, z / 10], [p1[0], y, p1[1], p1[0] / 10, p1[1] / 10], [p2[0], y, p2[1], p2[0] / 10, p2[1] / 10], UP);
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
function crack(g, x, y, len, w) {
  g.beginPath(); g.moveTo(x, y); let a = Math.random() * 6.28;
  for (let i = 0; i < len; i++) { a += (Math.random() - .5) * .9; x += Math.cos(a) * 6; y += Math.sin(a) * 6; g.lineTo(x, y); }
  g.lineWidth = w; g.stroke();
}
function makeTextures() {
  const asphalt = (dash, plain = false) => {
    const [c, g] = cnv(512, 512);
    g.fillStyle = '#3a3c40'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 30000; i++) {
      const v = 38 + Math.random() * 55 | 0; g.fillStyle = `rgba(${v},${v},${v + 3},.5)`;
      const s = .8 + Math.random() * 1.6; g.fillRect(Math.random() * 512, Math.random() * 512, s, s);
    }
    for (let i = 0; i < 14; i++) { // patches / repairs
      g.fillStyle = `rgba(${Math.random() < .6 ? '10,10,12' : '95,95,95'},.07)`;
      g.fillRect(Math.random() * 512, Math.random() * 512, 30 + Math.random() * 120, 20 + Math.random() * 90);
    }
    // worn wheel tracks per lane
    if (!plain) for (const x of [60, 150, 330, 420]) { const gr = g.createLinearGradient(x - 30, 0, x + 30, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.5, 'rgba(10,10,14,.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - 30, 0, 60, 512); }
    g.strokeStyle = 'rgba(15,15,17,.55)'; for (let i = 0; i < 7; i++) crack(g, Math.random() * 512, Math.random() * 512, 8 + Math.random() * 20, 1.2);
    g.strokeStyle = 'rgba(20,20,22,.35)'; for (let i = 0; i < 4; i++) { g.lineWidth = 3; g.beginPath(); const y = Math.random() * 512; g.moveTo(0, y); g.lineTo(512, y + (Math.random() - .5) * 20); g.stroke(); }
    if (plain) { /* junction surface: no markings */ }
    else if (dash) { g.fillStyle = '#e9e6da'; g.fillRect(250, 0, 12, 250); g.fillStyle = 'rgba(233,230,218,.8)'; g.fillRect(10, 0, 7, 512); g.fillRect(495, 0, 7, 512); }
    else { g.fillStyle = 'rgba(230,228,216,.45)'; g.fillRect(8, 0, 6, 512); g.fillRect(498, 0, 6, 512); }
    return tex(c);
  };
  // pavers
  const [sc, sg] = cnv(256, 256);
  sg.fillStyle = '#a9a69f'; sg.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) for (let x = 0; x < 256; x += 32) { const v = 150 + Math.random() * 40 | 0; sg.fillStyle = `rgb(${v},${v - 2},${v - 6})`; sg.fillRect(x + 1, y + 1, 30, 30); }
  speckle(sg, 256, 256, 6000, 110, 210, .25);
  sg.fillStyle = 'rgba(0,0,0,.05)'; for (let i = 0; i < 20; i++) { sg.beginPath(); sg.arc(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 16, 0, 7); sg.fill(); }
  const [cc, cg] = cnv(64, 64); cg.fillStyle = '#c4c1b9'; cg.fillRect(0, 0, 64, 64); speckle(cg, 64, 64, 600, 150, 230, .4);
  cg.fillStyle = 'rgba(0,0,0,.25)'; cg.fillRect(0, 0, 3, 64); cg.fillRect(61, 0, 3, 64);
  const [gc, gg] = cnv(512, 512);
  gg.fillStyle = '#86857e'; gg.fillRect(0, 0, 512, 512); speckle(gg, 512, 512, 30000, 90, 170, .3);
  for (let i = 0; i < 50; i++) { gg.fillStyle = `rgba(${60 + Math.random() * 40 | 0},${80 + Math.random() * 30 | 0},50,.1)`; gg.beginPath(); gg.arc(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 60, 0, 7); gg.fill(); }
  const [grc, grg] = cnv(512, 512);
  grg.fillStyle = '#4c7a32'; grg.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) { grg.fillStyle = `hsla(${70 + Math.random() * 40},${35 + Math.random() * 25}%,${22 + Math.random() * 16}%,.25)`; grg.beginPath(); grg.arc(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 70, 0, 7); grg.fill(); }
  for (let i = 0; i < 40000; i++) { grg.fillStyle = `hsla(${78 + Math.random() * 35},${38 + Math.random() * 30}%,${18 + Math.random() * 28}%,.7)`; grg.fillRect(Math.random() * 512, Math.random() * 512, 1, 2 + Math.random() * 4); }
  const [zc, zg] = cnv(64, 16); zg.clearRect(0, 0, 64, 16); zg.fillStyle = 'rgba(240,238,230,.92)'; zg.fillRect(0, 0, 36, 16);
  const [ac, ag] = cnv(4, 64); const agr = ag.createLinearGradient(0, 0, 0, 64); agr.addColorStop(0, 'rgba(0,0,0,.55)'); agr.addColorStop(.35, 'rgba(0,0,0,.2)'); agr.addColorStop(1, 'rgba(0,0,0,0)'); ag.fillStyle = agr; ag.fillRect(0, 0, 4, 64);
  const [rc, rg] = cnv(256, 256); rg.fillStyle = '#d8d8d8'; rg.fillRect(0, 0, 256, 256); speckle(rg, 256, 256, 9000, 120, 255, .35);
  rg.fillStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < 10; i++) rg.fillRect(Math.random() * 256, Math.random() * 256, 30 + Math.random() * 80, 20 + Math.random() * 60);
  const glow = (() => {
    const [c, g] = cnv(128, 128); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  const ao = tex(ac); ao.wrapS = ao.wrapT = THREE.ClampToEdgeWrapping;
  return {
    major: asphalt(true), minor: asphalt(false), plain: asphalt(false, true), side: tex(sc), curb: tex(cc), ground: tex(gc), grass: tex(grc),
    zebra: tex(zc), ao, roof: tex(rc), glow, water: waterNormals(),
  };
}
function waterNormals() {
  const N = 256, [c, g] = cnv(N, N), img = g.createImageData(N, N), H = new Float32Array(N * N);
  const waves = Array.from({ length: 14 }, () => ({ fx: (Math.random() * 9 | 0) - 4, fy: (Math.random() * 9 | 0) - 4, a: Math.random(), p: Math.random() * 6.28 })).filter(w => w.fx || w.fy);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let h = 0; for (const w of waves) h += w.a / Math.hypot(w.fx, w.fy) * Math.sin((w.fx * x + w.fy * y) / N * 6.283 + w.p); H[y * N + x] = h; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = H[y * N + (x + 1) % N] - H[y * N + (x + N - 1) % N], dy = H[((y + 1) % N) * N + x] - H[((y + N - 1) % N) * N + x];
    const l = Math.hypot(dx * 6, dy * 6, 1), i = (y * N + x) * 4;
    img.data[i] = (-dx * 6 / l * .5 + .5) * 255; img.data[i + 1] = (-dy * 6 / l * .5 + .5) * 255; img.data[i + 2] = (1 / l * .5 + .5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return tex(c, false);
}

// ---- building facades. Each style is a tile of nx x ny cells (cw x ch metres).
// map: colours (walls near-white so vertex colour tints them), orm: R = wall mask (tinted), G = roughness, B = metalness
const STYLES = {
  glass: { cw: 3, ch: 3.6, nx: 16, ny: 16, px: 64 },
  office: { cw: 3.6, ch: 3.5, nx: 16, ny: 16, px: 64 },
  classic: { cw: 3.4, ch: 3.6, nx: 12, ny: 12, px: 80 },
  brick: { cw: 3, ch: 3.2, nx: 12, ny: 12, px: 80 },
  resi: { cw: 3.6, ch: 3.0, nx: 12, ny: 12, px: 80 },
  shop: { cw: 4.5, ch: 4.5, nx: 8, ny: 1, px: 128 },
};
const LIT = ['#ffd9a0', '#ffe6bf', '#fff1d6', '#cfe3ff', '#ffc680', '#ffe0b0'];
function facadeTextures(style) {
  const S = STYLES[style], W = S.nx * S.px, H = S.ny * Math.round(S.px * S.ch / S.cw);
  const cwp = S.px, chp = H / S.ny;
  const [mc, m] = cnv(W, H), [oc, o] = cnv(W, H), [ec, e] = cnv(W, H);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const orm = (r, rough, metal) => `rgb(${r},${Math.round(rough * 255)},${Math.round(metal * 255)})`;
  const R = (x, y, w, h, col, ormc) => { m.fillStyle = col; m.fillRect(x, y, w, h); if (ormc) { o.fillStyle = ormc; o.fillRect(x, y, w, h); } };
  const glassGrad = (x, y, w, h, t = 0) => { const gr = m.createLinearGradient(x, y, x + w * .3, y + h); gr.addColorStop(0, `rgb(${92 + t},${112 + t},${130 + t})`); gr.addColorStop(.5, `rgb(${46 + t},${58 + t},${70 + t})`); gr.addColorStop(1, `rgb(${30 + t},${38 + t},${48 + t})`); return gr; };
  const win = (x, y, w, h, opts = {}) => {
    const t = Math.random() * 18 | 0;
    m.fillStyle = glassGrad(x, y, w, h, t); m.fillRect(x, y, w, h);
    o.fillStyle = orm(opts.tint ? 255 : 0, .08, opts.metal ?? .55); o.fillRect(x, y, w, h);
    if (Math.random() < (opts.litP ?? .4)) {
      e.globalAlpha = .45 + Math.random() * .55; e.fillStyle = LIT[(Math.random() * LIT.length) | 0];
      const blind = Math.random() < .35 ? h * (.2 + Math.random() * .5) : 0;
      e.fillRect(x, y + blind, w, h - blind); e.globalAlpha = 1;
      if (Math.random() < .5) { m.fillStyle = 'rgba(255,240,210,.08)'; m.fillRect(x, y + blind, w, h - blind); }
    } else if (Math.random() < .3) { m.fillStyle = 'rgba(230,225,215,.35)'; m.fillRect(x, y, w, h * (.2 + Math.random() * .4)); } // blinds
  };
  // base wall
  m.fillStyle = '#f2f2f2'; m.fillRect(0, 0, W, H); speckle(m, W, H, W * H / 40, 200, 255, .2);
  o.fillStyle = orm(255, .88, 0); o.fillRect(0, 0, W, H);
  for (let cy = 0; cy < S.ny; cy++) for (let cx = 0; cx < S.nx; cx++) {
    const x = cx * cwp, y = cy * chp, fx = (f) => x + f * cwp, fy = (f) => y + f * chp;
    if (style === 'glass') {
      // curtain wall: full-height panes, spandrel band, mullions; whole facade is tinted + metallic
      const t = Math.random() * 10 | 0;
      m.fillStyle = glassGrad(x, y, cwp, chp, t + 25); m.fillRect(x, y, cwp, chp);
      o.fillStyle = orm(255, .05, .85); o.fillRect(x, y, cwp, chp);
      R(x, fy(.8), cwp, chp * .2, '#5a6470', orm(255, .25, .7));
      if (Math.random() < .35) { e.globalAlpha = .35 + Math.random() * .5; e.fillStyle = LIT[(Math.random() * LIT.length) | 0]; e.fillRect(x + 2, y + 2, cwp - 4, chp * .78 - 2); e.globalAlpha = 1; }
      R(x, y, 2, chp, '#c7ccd2', orm(0, .3, .9)); R(x, fy(.8), cwp, 2, '#c7ccd2', orm(0, .3, .9));
    } else if (style === 'office') {
      R(x, fy(.62), cwp, chp * .38, '#ededed');
      R(x, fy(.6), cwp, 2, 'rgba(0,0,0,.25)');
      win(x, y, cwp, chp * .6, { litP: .45, metal: .65 });
      R(fx(.5) - 1.5, y, 3, chp * .6, '#c9cdd1', orm(0, .35, .8)); R(x, y, 3, chp * .6, '#c9cdd1', orm(0, .35, .8));
    } else if (style === 'classic') {
      // stone wall, tall windows with surrounds, shutters, balcony rails, floor cornices
      R(x, fy(.97), cwp, chp * .03, 'rgba(0,0,0,.13)');
      R(x, fy(.92), cwp, chp * .05, '#ffffff');
      for (let k = 0; k < 4; k++) R(x, fy(k * .24), cwp, 1, 'rgba(0,0,0,.05)');
      const wx = fx(.31), ww = cwp * .38, wy = fy(.18), wh = chp * .64;
      R(wx - 5, wy - 7, ww + 10, wh + 10, '#fbfaf7'); R(wx - 5, wy - 7, ww + 10, 3, 'rgba(0,0,0,.12)');
      win(wx, wy, ww, wh, { litP: .35 });
      R(wx + ww / 2 - 1, wy, 2, wh, '#e8e6e0', orm(0, .6, 0)); R(wx, wy + wh * .35, ww, 2, '#e8e6e0', orm(0, .6, 0));
      R(wx, wy, ww, 4, 'rgba(0,0,0,.35)', null);
      if (Math.random() < .3) { const sh = ['#3f5a3a', '#4b3a2a', '#e6e2d6', '#5b6f7b'][(Math.random() * 4) | 0]; for (const sx of [wx - ww * .5 - 6, wx + ww + 6]) { R(sx, wy, ww * .5, wh, sh, orm(0, .7, 0)); for (let k = 4; k < wh; k += 5) R(sx, wy + k, ww * .5, 1, 'rgba(0,0,0,.25)'); } }
      if (cy % 2 === 0 || Math.random() < .4) { R(wx - 4, wy + wh - chp * .2, ww + 8, 2, '#1a1a1a', orm(0, .5, .6)); for (let k = 0; k < ww + 8; k += 5) R(wx - 4 + k, wy + wh - chp * .2, 1.5, chp * .2, '#1a1a1a', orm(0, .5, .6)); R(wx - 8, wy + wh, ww + 16, 4, '#d9d6cf'); }
    } else if (style === 'brick') {
      // red brick with white-framed sash windows and stone lintels (bricks are not tinted much)
      for (let by = 0; by < chp; by += 6) for (let bx = -((by / 6) % 2) * 6; bx < cwp; bx += 12) {
        const v = Math.random() * 30 | 0; m.fillStyle = `rgb(${150 + v},${70 + v / 2},${55 + v / 3})`; m.fillRect(x + bx + 1, y + by + 1, 10, 4.6);
      }
      m.fillStyle = 'rgba(210,200,190,.5)'; for (let by = 0; by < chp; by += 6) m.fillRect(x, y + by, cwp, 1);
      const wx = fx(.28), ww = cwp * .44, wy = fy(.2), wh = chp * .6;
      R(wx - 4, wy - 9, ww + 8, 8, '#e8e4da', orm(0, .8, 0));
      R(wx - 3, wy - 3, ww + 6, wh + 6, '#f4f4f0', orm(0, .5, 0));
      win(wx, wy, ww, wh, { litP: .4 });
      R(wx, wy + wh / 2 - 2, ww, 4, '#f4f4f0', orm(0, .5, 0)); R(wx + ww / 2 - 1.5, wy, 3, wh, '#f4f4f0', orm(0, .5, 0));
      R(wx - 5, wy + wh + 2, ww + 10, 4, '#e8e4da', orm(0, .8, 0));
    } else if (style === 'resi') {
      // plaster apartments: window-doors, balconies with glass rails on alternate bays
      const balcony = (cx + cy) % 3 !== 0;
      const wx = fx(.22), ww = cwp * .56, wy = fy(.12), wh = chp * .78;
      win(wx, wy, ww, wh, { litP: .45 });
      R(wx, wy, 3, wh, '#dcdcdc', orm(0, .4, .6)); R(wx + ww - 3, wy, 3, wh, '#dcdcdc', orm(0, .4, .6)); R(wx + ww * .5, wy, 2, wh, '#dcdcdc', orm(0, .4, .6));
      if (balcony) {
        R(x + 2, fy(.88), cwp - 4, chp * .1, '#e8e8e8', orm(0, .8, 0)); R(x + 2, fy(.97), cwp - 4, chp * .03, 'rgba(0,0,0,.35)');
        m.fillStyle = 'rgba(160,190,200,.45)'; m.fillRect(x + 4, fy(.58), cwp - 8, chp * .3); o.fillStyle = orm(0, .1, .5); o.fillRect(x + 4, fy(.58), cwp - 8, chp * .3);
        R(x + 4, fy(.58), cwp - 8, 2, '#9aa0a6', orm(0, .3, .9));
      } else R(wx - 4, wy + wh, ww + 8, 3, '#d4d4d4');
    } else if (style === 'shop') {
      // storefronts: sign band, display glass, doors, awnings; not tinted
      const sign = ['#1d2a44', '#7a1a1a', '#1f4d3a', '#202020', '#c9a227', '#e9e4da', '#2f5f8a', '#8a3c1d'][(Math.random() * 8) | 0];
      R(x, y, cwp, chp, '#2a2c2f', orm(0, .6, .4));
      R(x, y, cwp, chp * .22, sign, orm(0, .5, .2));
      m.fillStyle = Math.random() < .5 ? '#f4f1e8' : '#ffd86b'; m.font = `bold ${chp * .1}px Arial`; m.textAlign = 'center'; m.textBaseline = 'middle';
      const words = ['CAFE', 'BAKERY', 'BOUTIQUE', 'PHARMACY', 'MARKET', 'BISTRO', 'BOOKS', 'GALLERY', 'OPTICS', 'BANK', 'SHOES', 'FLOWERS', 'DELI', 'STUDIO'];
      m.fillText(words[(Math.random() * words.length) | 0], x + cwp / 2, y + chp * .11);
      const gx = x + 6, gy = y + chp * .26, gw = cwp - 12, gh = chp * .7;
      const gr = m.createLinearGradient(gx, gy, gx, gy + gh); gr.addColorStop(0, '#6d7c88'); gr.addColorStop(.5, '#3b434b'); gr.addColorStop(1, '#22272c');
      m.fillStyle = gr; m.fillRect(gx, gy, gw, gh); o.fillStyle = orm(0, .06, .5); o.fillRect(gx, gy, gw, gh);
      // interior hints
      for (let k = 0; k < 6; k++) { m.fillStyle = `rgba(${150 + Math.random() * 100 | 0},${120 + Math.random() * 100 | 0},${90 + Math.random() * 80 | 0},.25)`; m.fillRect(gx + Math.random() * gw * .8, gy + gh * (.4 + Math.random() * .4), 6 + Math.random() * 14, 6 + Math.random() * 20); }
      R(gx + gw * .62, gy, 3, gh, '#16181a'); R(gx + gw * .62 + gw * .16, gy, 3, gh, '#16181a');
      e.globalAlpha = .55 + Math.random() * .4; e.fillStyle = Math.random() < .7 ? '#ffdcaa' : '#e6f0ff'; e.fillRect(gx, gy, gw, gh); e.globalAlpha = 1;
      e.fillStyle = sign; e.globalAlpha = .8; e.fillRect(x, y + chp * .02, cwp, chp * .18); e.globalAlpha = 1;
      if (Math.random() < .35) { const aw = ['#7a1a1a', '#1f4d3a', '#1d2a44', '#c9a227'][(Math.random() * 4) | 0]; for (let k = 0; k < cwp; k += 10) R(x + k, y + chp * .22, 5, chp * .1, aw, orm(0, .8, 0)); }
    }
  }
  return { map: tex(mc), orm: tex(oc, false), emis: tex(ec), S };
}

// ---- trees: leaf-cluster crowns (alpha-tested cards with rounded normals), conifers, palms, bushes
function leafAtlas() {
  const [c, g] = cnv(512, 512);
  for (let q = 0; q < 4; q++) {
    const ox = (q % 2) * 256 + 128, oy = (q >> 1) * 256 + 128;
    for (let i = 0; i < 230; i++) {
      const r = 112 * Math.sqrt(Math.random()), a = Math.random() * 6.28;
      const x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r * .9;
      g.save(); g.translate(x, y); g.rotate(Math.random() * 6.28);
      const l = 7 + Math.random() * 6, hue = 82 + Math.random() * 30, lit = 20 + Math.random() * 22 - r / 112 * 6;
      g.fillStyle = `hsl(${hue},${38 + Math.random() * 22}%,${lit}%)`;
      g.beginPath(); g.ellipse(0, 0, l, l * .45, 0, 0, 7); g.fill();
      g.fillStyle = `hsla(${hue},40%,${lit + 14}%,.6)`; g.beginPath(); g.ellipse(-l * .2, -l * .1, l * .5, l * .15, 0, 0, 7); g.fill();
      g.restore();
    }
  }
  return tex(c);
}
function needleTex() {
  const [c, g] = cnv(256, 128);
  g.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const y0 = 64 + (k - 1) * 22;
    g.strokeStyle = '#3a2a1c'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 64); g.lineTo(250, y0); g.stroke();
    for (let i = 0; i < 260; i++) {
      const t = Math.random(), x = t * 248, y = 64 + (y0 - 64) * t, len = (1 - t * .6) * (12 + Math.random() * 16), a = (Math.random() < .5 ? -1 : 1) * (.6 + Math.random() * .7);
      g.strokeStyle = `hsl(${120 + Math.random() * 30},${30 + Math.random() * 20}%,${12 + Math.random() * 14}%)`; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len * .5, y + Math.sin(a) * len); g.stroke();
    }
  }
  return tex(c);
}
function frondTex() {
  const [c, g] = cnv(128, 512);
  g.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const t = i / 90, y = 8 + t * 496, len = 58 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 4;
    for (const sd of [-1, 1]) {
      g.strokeStyle = `hsl(${78 + Math.random() * 25},${40 + Math.random() * 20}%,${20 + Math.random() * 16}%)`; g.lineWidth = 3.2;
      g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(64 + sd * len * .6, y + 4, 64 + sd * len, y + 22 + t * 10); g.stroke();
    }
  }
  g.strokeStyle = '#8a7a4a'; g.lineWidth = 4; g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 512); g.stroke();
  return tex(c);
}
function barkTex(palm) {
  const [c, g] = cnv(128, 256);
  g.fillStyle = palm ? '#7a6a55' : '#4b3a2c'; g.fillRect(0, 0, 128, 256);
  if (palm) { for (let y = 0; y < 256; y += 14) { g.fillStyle = 'rgba(40,30,20,.55)'; g.fillRect(0, y, 128, 4); g.fillStyle = 'rgba(200,180,150,.15)'; g.fillRect(0, y + 5, 128, 3); } }
  else for (let i = 0; i < 160; i++) { const x = Math.random() * 128; g.fillStyle = `rgba(${Math.random() < .5 ? '20,14,10' : '120,105,90'},.35)`; g.fillRect(x, Math.random() * 256, 2 + Math.random() * 3, 20 + Math.random() * 60); }
  return tex(c);
}
class Geo {
  constructor() { this.P = []; this.N = []; this.U = []; this.C = []; this.I = []; }
  v(p, n, u, v, c = 1) { this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]); this.U.push(u, v); this.C.push(c, c, c); return this.P.length / 3 - 1; }
  quad(a, b, c, d) { this.I.push(a, b, c, a, c, d); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setIndex(this.I); g.computeBoundingSphere(); return g;
  }
}
const V = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s], len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
};
function tube(G, pts, radii, sides = 6, vScale = .5) {
  let base = -1, vv = 0;
  for (let i = 0; i < pts.length; i++) {
    const d = V.norm(V.sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]));
    const ref = Math.abs(d[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
    const a = V.norm(V.cross(d, ref)), b = V.cross(a, d);
    if (i) vv += V.len(V.sub(pts[i], pts[i - 1])) * vScale;
    const start = G.P.length / 3;
    for (let k = 0; k <= sides; k++) {
      const th = k / sides * Math.PI * 2, n = V.add(V.mul(a, Math.cos(th)), V.mul(b, Math.sin(th)));
      G.v(V.add(pts[i], V.mul(n, radii[i])), n, k / sides, vv, .8 + .2 * i / pts.length);
    }
    if (base >= 0) for (let k = 0; k < sides; k++) G.quad(base + k, base + k + 1, start + k + 1, start + k);
    base = start;
  }
}
function card(G, p, s, n0, center, rad, atlasQ) {
  const n = V.norm(n0), ref = Math.abs(n[1]) < .95 ? [0, 1, 0] : [1, 0, 0];
  const a = V.norm(V.cross(n, ref)), b = V.cross(n, a), h = s / 2;
  const u0 = (atlasQ % 2) * .5, v0 = (atlasQ >> 1) * .5;
  const ids = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]].map(([i, j, u, v]) => {
    const q = V.add(p, V.add(V.mul(a, i * h), V.mul(b, j * h)));
    const rel = V.sub(q, center), nn = V.norm(V.add(V.norm([rel[0] / rad[0], rel[1] / rad[1], rel[2] / rad[2]]), [0, .35, 0]));
    const depth = Math.min(1, V.len([rel[0] / rad[0], rel[1] / rad[1], rel[2] / rad[2]]));
    const ao = .45 + .55 * Math.pow(depth, 1.3) * (.8 + .2 * Math.max(0, rel[1] / rad[1]));
    return G.v(q, nn, u0 + u * .5, v0 + v * .5, ao);
  });
  G.quad(...ids);
}
function broadTree(rnd, clusters) {
  const T = new Geo(), L = new Geo();
  const lean = [(rnd() - .5) * .5, 0, (rnd() - .5) * .5];
  const top = [lean[0], 3.1, lean[2]];
  tube(T, [[0, 0, 0], [lean[0] * .3, 1.2, lean[2] * .3], [lean[0] * .7, 2.3, lean[2] * .7], top], [.2, .16, .14, .11], 7);
  const c = [lean[0], 5.3, lean[2]], rad = [2.7, 2.3, 2.7];
  const nb = 4 + (rnd() * 2 | 0);
  for (let i = 0; i < nb; i++) {
    const a = i / nb * 6.28 + rnd() * .6, e = .35 + rnd() * .45;
    const end = [c[0] + Math.cos(a) * rad[0] * .6, c[1] + (e - .3) * rad[1], c[2] + Math.sin(a) * rad[2] * .6];
    const mid = V.add(V.mul(V.add(top, end), .5), [0, .3, 0]);
    tube(T, [V.add(top, [0, -.4 * rnd(), 0]), mid, end], [.09, .06, .03], 5);
  }
  for (let i = 0; i < clusters; i++) {
    let d; do { d = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]; } while (V.len(d) > 1);
    const r = .5 + .5 * Math.pow(V.len(d), .4); d = V.norm(d);
    const p = [c[0] + d[0] * rad[0] * r * .82, c[1] + d[1] * rad[1] * r * .82, c[2] + d[2] * rad[2] * r * .82];
    const s = (1.6 + rnd() * .9) * Math.sqrt(30 / clusters);
    for (let k = 0; k < 2; k++) card(L, p, s, V.add(d, [rnd() - .5, rnd() - .5, rnd() - .5]), c, rad, (rnd() * 4) | 0);
  }
  return { trunk: T.build(), leaves: L.build() };
}
function conifer(rnd) {
  const T = new Geo(), L = new Geo();
  tube(T, [[0, 0, 0], [0, 4, 0], [0, 8, 0], [0, 10.5, 0]], [.22, .16, .09, .03], 6);
  const tiers = 11, c = [0, 5.5, 0], rad = [2.6, 5, 2.6];
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1), y = 1.6 + f * 8.6, R = 2.5 * Math.pow(1 - f, .95) + .35, n = Math.max(4, Math.round(8 - f * 3));
    for (let k = 0; k < n; k++) {
      const a = k / n * 6.28 + t * .7 + rnd() * .4;
      const dir = [Math.cos(a), -.32, Math.sin(a)], tip = V.add([0, y, 0], V.mul(dir, R));
      const side = V.norm(V.cross(dir, [0, 1, 0])), w = Math.max(.5, R * .55);
      const p = [[0, y + .05, 0], tip];
      const ao = (q) => .45 + .55 * Math.min(1, Math.hypot(q[0], q[2]) / R) * (.75 + .25 * f);
      const nn = (q) => V.norm([q[0], .9, q[2]]);
      const i0 = L.v(V.add(p[0], V.mul(side, -w * .3)), nn(dir), 0, 0, .4), i1 = L.v(V.add(p[0], V.mul(side, w * .3)), nn(dir), 0, 1, .4);
      const i2 = L.v(V.add(p[1], V.mul(side, w * .5)), nn(dir), 1, 1, ao(tip)), i3 = L.v(V.add(p[1], V.mul(side, -w * .5)), nn(dir), 1, 0, ao(tip));
      L.quad(i0, i1, i2, i3);
    }
  }
  void c; void rad;
  return { trunk: T.build(), leaves: L.build() };
}
function palm(rnd) {
  const T = new Geo(), L = new Geo();
  const H = 7 + rnd() * 2.5, bend = .6 + rnd() * .9, dirA = rnd() * 6.28;
  const pts = [], radii = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([Math.cos(dirA) * bend * t * t, H * t, Math.sin(dirA) * bend * t * t]); radii.push(.24 - .08 * t + (i === 0 ? .08 : 0)); }
  tube(T, pts, radii, 7, .9);
  const top = pts[8], nF = 13;
  for (let f = 0; f < nF; f++) {
    const a = f / nF * 6.28 + rnd() * .3, Lf = 3.2 + rnd() * 1.1, up = .35 + rnd() * .45 - (f % 3 === 0 ? .3 : 0);
    const dir = [Math.cos(a), 0, Math.sin(a)], side = [-Math.sin(a), 0, Math.cos(a)];
    let prev = null;
    for (let s = 0; s <= 6; s++) {
      const t = s / 6, w = .55 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + .06;
      const p = V.add(top, [dir[0] * Lf * t, Lf * (up * t - .8 * t * t), dir[2] * Lf * t]);
      const fold = .12 * w;
      const n = V.norm([dir[0] * -.2, 1, dir[2] * -.2]);
      const l = L.v(V.add(V.add(p, V.mul(side, -w)), [0, -fold, 0]), n, 0, t, .55 + .45 * t), r = L.v(V.add(V.add(p, V.mul(side, w)), [0, -fold, 0]), n, 1, t, .55 + .45 * t);
      const m = L.v(p, n, .5, t, .6 + .4 * t);
      if (prev) { L.quad(prev[0], prev[2], m, l); L.quad(prev[2], prev[1], r, m); }
      prev = [l, r, m];
    }
  }
  return { trunk: T.build(), leaves: L.build() };
}
function bush(rnd, clusters) {
  const L = new Geo(), c = [0, .75, 0], rad = [1.2, .85, 1.2];
  for (let i = 0; i < clusters; i++) {
    let d; do { d = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]; } while (V.len(d) > 1);
    d = V.norm(V.add(d, [0, .2, 0]));
    const p = [c[0] + d[0] * rad[0] * .7, Math.max(.35, c[1] + d[1] * rad[1] * .7), c[2] + d[2] * rad[2] * .7];
    card(L, p, 1.1 + rnd() * .5, V.add(d, [rnd() - .5, rnd() - .5, rnd() - .5]), c, rad, (rnd() * 4) | 0);
  }
  return { trunk: null, leaves: L.build() };
}
// foliage: keep normals smooth on both faces of the cards (no back-face flip) so crowns read as soft volumes
function foliageMat(map, M) {
  const m = M(new THREE.MeshStandardMaterial({ map, alphaTest: .5, side: THREE.DoubleSide, roughness: .85, vertexColors: true }));
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'));
  };
  return m;
}

const WALLS = ['#d8d2c4', '#c9c2b3', '#b8b4ad', '#e6e1d6', '#a89f91', '#c7b299', '#9aa5ad', '#b5a48c', '#d1c7b7', '#8f9aa3', '#e9e4da', '#9c9488'];
const PASTEL = ['#e9d8b8', '#f0e2c8', '#e6c9a8', '#efe6d4', '#f2d7c4', '#dcc7a1', '#f4ecdc', '#e8d3a6', '#e3b99a', '#f1e4cf'];
const GLASS = ['#9fb6cc', '#8ba5bd', '#b4c6d4', '#7f98ad', '#a9bcc0', '#8fb0a8', '#b8a98f'];
const BRICKS = ['#ffffff', '#f0e2da', '#e2d0c4', '#d8c8c0', '#c9b8a8'];
const ROOFS = ['#6b6b6b', '#7a7570', '#5e6166', '#8a8580', '#545454', '#8c8a84'];
const TILES = ['#a5492f', '#9a4a35', '#b25d3c', '#5a5c60', '#6d4a3a', '#8c3f2a'];
const _cc = cnv(1, 1)[1];
function cssColor(str) {
  if (!str) return null;
  _cc.fillStyle = '#010203'; _cc.fillStyle = String(str).trim();
  return _cc.fillStyle === '#010203' ? null : _cc.fillStyle;
}
function regionOf(lat, lon) {
  if (lat == null) return 'us';
  if (lon > -12 && lon < 32 && lat > 34 && lat < 62) return 'eu';
  if (lon < -30) return 'us';
  if (lon > 34 && lon < 62 && lat > 12 && lat < 36) return 'gulf';
  return 'asia';
}
function pickStyle(b, rnd, region) {
  const h = b.h, t = b.type || '';
  if (t === 'house' || t === 'detached' || t === 'semidetached_house' || t === 'bungalow' || t === 'terrace') return rnd() < (region === 'us' || region === 'eu' ? .45 : .2) ? 'brick' : 'resi';
  if (h > 60) return rnd() < .75 ? 'glass' : 'office';
  if (t === 'office' || t === 'commercial') return rnd() < .5 ? 'glass' : 'office';
  if (t === 'apartments' || t === 'residential') return region === 'eu' ? (rnd() < .6 ? 'classic' : 'resi') : region === 'us' ? (rnd() < .5 ? 'brick' : 'resi') : 'resi';
  const r = rnd();
  if (region === 'eu') return h < 32 ? (r < .65 ? 'classic' : r < .85 ? 'resi' : 'office') : (r < .4 ? 'office' : r < .7 ? 'glass' : 'resi');
  if (region === 'us') return h < 25 ? (r < .45 ? 'brick' : r < .75 ? 'office' : 'resi') : (r < .45 ? 'glass' : r < .8 ? 'office' : 'brick');
  if (region === 'gulf') return h > 30 ? (r < .65 ? 'glass' : 'office') : (r < .6 ? 'resi' : 'office');
  return h > 30 ? (r < .45 ? 'glass' : r < .8 ? 'office' : 'resi') : (r < .65 ? 'resi' : 'office');
}
function offsetPoly(pts, d, sgn) { // miter offset; positive d grows outward
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n];
    const n1 = edgeN(a, b, sgn), n2 = edgeN(b, c, sgn);
    let mx = n1[0] + n2[0], mz = n1[1] + n2[1]; const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l;
    const k = Math.min(2.5, 1 / Math.max(.4, mx * n1[0] + mz * n1[1]));
    out.push([b[0] + mx * d * k, b[1] + mz * d * k]);
  }
  return out;
}
function edgeN(p1, p2, sgn) { const dx = p2[0] - p1[0], dz = p2[1] - p1[1], l = Math.hypot(dx, dz) || 1; return sgn > 0 ? [dz / l, -dx / l] : [-dz / l, dx / l]; }

// ---------------------------------------------------------------- build
export function buildWorld(data, opts = {}) {
  const half = data.half, B = half + 40;
  const region = regionOf(opts.lat, opts.lon), absLat = Math.abs(opts.lat ?? 40);
  const detail = opts.quality === 'low' ? 0 : opts.quality === 'ultra' ? 2 : 1;
  const group = new THREE.Group();
  const segGrid = new Grid(24), bGrid = new Grid(48), rGrid = new Grid(32), oGrid = new Grid(12);
  const T = makeTextures();
  const mats = [], texs = Object.values(T);
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
  for (const p of data.green) fillPoly(greenBuf, p, .02, 9);
  for (const p of data.water) fillPoly(waterBuf, p, .03, 14);
  addMesh(greenBuf, M(new THREE.MeshStandardMaterial({ map: T.grass, roughness: 1, ...overlay })), 1);
  T.water.repeat.set(1, 1);
  const waterMat = M(new THREE.MeshStandardMaterial({ color: 0x1a4560, metalness: .1, roughness: .04, normalMap: T.water, normalScale: new THREE.Vector2(.35, .35), envMapIntensity: 1.4, ...overlay }));
  addMesh(waterBuf, waterMat, 1);

  // roads
  const keyOf = (p) => Math.round(p[0] * 10) + ',' + Math.round(p[1] * 10);
  const nodeCount = new Map(), nodeW = new Map();
  for (const r of data.roads) for (const p of r.pts) { const k = keyOf(p); nodeCount.set(k, (nodeCount.get(k) || 0) + 1); if (TRAFFIC.has(r.cls)) nodeW.set(k, Math.max(nodeW.get(k) || 0, r.w)); }
  const sideBuf = new Buf(), curbBuf = new Buf(), junctionBuf = new Buf(), contBuf = new Buf(), minorBuf = new Buf(), majorBuf = new Buf(), walkBuf = new Buf(), zebraBuf = new Buf();
  for (const r of data.roads) {
    r.cum = [0]; for (let i = 1; i < r.pts.length; i++) r.cum.push(r.cum[i - 1] + Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]));
    r.len = r.cum[r.cum.length - 1];
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], e = r.w / 2 + 2;
      rGrid.add(Math.min(a[0], b[0]) - e, Math.min(a[1], b[1]) - e, Math.max(a[0], b[0]) + e, Math.max(a[1], b[1]) + e, { road: r, i });
    }
    if (r.cls === 'pedestrian') { ribbon(walkBuf, r.pts, r.w, .035); continue; }
    const sw = !NO_SIDEWALK.has(r.cls);
    if (sw) { ribbon(sideBuf, r.pts, r.w + 3.6, .03); ribbon(curbBuf, r.pts, r.w + .5, .04); }
    const major = r.w >= 9;
    ribbon(major ? majorBuf : minorBuf, r.pts, r.w, major ? .05 : .045);
    r.pts.forEach((p, i) => {
      if (i === 0 || i === r.pts.length - 1 || nodeCount.get(keyOf(p)) > 1) {
        disc((nodeCount.get(keyOf(p)) || 0) >= 3 ? junctionBuf : contBuf, p[0], p[1], r.w / 2, .047);
        if (sw) { disc(sideBuf, p[0], p[1], r.w / 2 + 1.8, .03); disc(curbBuf, p[0], p[1], r.w / 2 + .25, .04); }
      }
    });
    // zebra crossings where streets meet
    if (TRAFFIC.has(r.cls) && r.w >= 6 && r.len > 18 && !r.cls.startsWith('motorway')) {
      for (const end of [0, 1]) {
        const p = end ? r.pts[r.pts.length - 1] : r.pts[0], k = keyOf(p);
        if ((nodeCount.get(k) || 0) < 3) continue;
        const d = (nodeW.get(k) || r.w) / 2 + 2.2;
        if (d + 3 > r.len / 2) continue;
        const s0 = samplePath(r, d, !!end), s1 = samplePath(r, d + 3, !!end);
        const px = -s0.dz, pz = s0.dx, hw = r.w / 2 - .4, y = .055;
        const reps = (hw * 2) / .9;
        zebraBuf.tri([s0.x + px * hw, y, s0.z + pz * hw, 0, 0], [s0.x - px * hw, y, s0.z - pz * hw, reps, 0], [s1.x - px * hw, y, s1.z - pz * hw, reps, 1], UP);
        zebraBuf.tri([s0.x + px * hw, y, s0.z + pz * hw, 0, 0], [s1.x - px * hw, y, s1.z - pz * hw, reps, 1], [s1.x + px * hw, y, s1.z + pz * hw, 0, 1], UP);
      }
    }
  }
  addMesh(sideBuf, M(new THREE.MeshStandardMaterial({ map: T.side, roughness: .9, ...overlay })), 2);
  addMesh(walkBuf, M(new THREE.MeshStandardMaterial({ map: T.side, color: 0xd8cfc0, roughness: .9, ...overlay })), 2);
  addMesh(curbBuf, M(new THREE.MeshStandardMaterial({ map: T.curb, roughness: .85, ...overlay })), 3);
  addMesh(minorBuf, M(new THREE.MeshStandardMaterial({ map: T.minor, roughness: .88, ...overlay })), 4);
  addMesh(majorBuf, M(new THREE.MeshStandardMaterial({ map: T.major, roughness: .88, ...overlay })), 5);
  const plainMat = M(new THREE.MeshStandardMaterial({ map: T.plain, roughness: .88, ...overlay }));
  addMesh(contBuf, plainMat, 3.5);
  addMesh(junctionBuf, plainMat, 5.5);
  addMesh(zebraBuf, M(new THREE.MeshStandardMaterial({ map: T.zebra, transparent: true, roughness: .7, ...overlay })), 6);

  // buildings
  const styleNames = ['glass', 'office', 'classic', 'brick', 'resi', 'shop'];
  const F = {}, wallMats = {}, wallBufs = {};
  for (const st of styleNames) {
    F[st] = facadeTextures(st); texs.push(F[st].map, F[st].orm, F[st].emis);
    const mat = M(new THREE.MeshStandardMaterial({
      map: F[st].map, roughnessMap: F[st].orm, metalnessMap: F[st].orm, roughness: 1, metalness: 1,
      emissiveMap: F[st].emis, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true, envMapIntensity: st === 'glass' ? 1.3 : 1,
    }));
    // vertex colour only tints the wall areas (orm.r = 1), never the windows
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>',
        '#if defined( USE_COLOR )\n  diffuseColor.rgb *= mix( vec3( 1.0 ), vColor, texture2D( roughnessMap, vRoughnessMapUv ).r );\n#endif');
    };
    wallMats[st] = mat; wallBufs[st] = new Buf(true);
  }
  const roofMat = M(new THREE.MeshStandardMaterial({ map: T.roof, roughness: .92, vertexColors: true }));
  const trimMat = M(new THREE.MeshStandardMaterial({ map: T.roof, roughness: .85, vertexColors: true }));
  const roofBuf = new Buf(true), trimBuf = new Buf(true), aoBuf = new Buf();
  const col = new THREE.Color(), rcol = new THREE.Color(), tcol = new THREE.Color(), boxCol = new THREE.Color();
  const buildings = [];
  const SHOP_H = 4.5;
  const quadWall = (buf, p1, p2, y0, y1, u1, u2, v0, v1, nn, c) => {
    buf.tri([p1[0], y0, p1[1], u1, v0], [p2[0], y0, p2[1], u2, v0], [p2[0], y1, p2[1], u2, v1], nn, c);
    buf.tri([p1[0], y0, p1[1], u1, v0], [p2[0], y1, p2[1], u2, v1], [p1[0], y1, p1[1], u1, v1], nn, c);
  };
  const boxOn = (buf, cx, cz, y, w, d, h, rot, c) => {
    const cs = Math.cos(rot), sn = Math.sin(rot), P = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([a, b]) => [cx + a * cs - b * sn, cz + a * sn + b * cs]);
    for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4], n = edgeN(a, b, -1); quadWall(buf, a, b, y, y + h, 0, 1, 0, 1, [n[0], 0, n[1]], c); }
    buf.tri([P[0][0], y + h, P[0][1]], [P[1][0], y + h, P[1][1]], [P[2][0], y + h, P[2][1]], UP, c); buf.tri([P[0][0], y + h, P[0][1]], [P[2][0], y + h, P[2][1]], [P[3][0], y + h, P[3][1]], UP, c);
  };
  for (const b of data.buildings) {
    const pts = b.pts, n = pts.length, h = b.h;
    const rnd = mulberry32((b.id * 2654435761) >>> 0);
    const style = pickStyle(b, rnd, region), S = STYLES[style];
    const tag = cssColor(b.color);
    const pal = style === 'glass' ? GLASS : style === 'brick' ? BRICKS : style === 'classic' || (style === 'resi' && (region === 'eu' || region === 'asia' || region === 'gulf')) ? PASTEL : WALLS;
    if (tag && style !== 'glass') col.set(tag); else col.set(pal[(rnd() * pal.length) | 0]);
    const area = Math.abs(polyArea(pts)), sgn = polyArea(pts) > 0 ? 1 : -1;
    const small = SMALL.has(b.type) || h < 8;
    const pitched = n === 4 && (small || h <= 12) && area < 500 && b.roofShape !== 'flat';
    const shop = !small && h >= 9 && style !== 'glass' && b.type !== 'house' && rnd() < (region === 'us' ? .55 : .75);
    const rtag = cssColor(b.roof);
    if (rtag) rcol.set(rtag); else rcol.set((pitched ? TILES : ROOFS)[(rnd() * (pitched ? TILES : ROOFS).length) | 0]);
    tcol.copy(col).multiplyScalar(style === 'glass' ? .55 : .92);
    const tileW = S.nx * S.cw, tileH = S.ny * S.ch;
    let per = (rnd() * S.nx | 0) * S.cw, minx = 1e9, minz = 1e9, maxx = -1e9, maxz = -1e9;
    const vOff = (rnd() * S.ny | 0) * S.ch;
    const yBase = shop ? SHOP_H : 0;
    for (let i = 0; i < n; i++) {
      const p1 = pts[i], p2 = pts[(i + 1) % n];
      minx = Math.min(minx, p1[0]); maxx = Math.max(maxx, p1[0]); minz = Math.min(minz, p1[1]); maxz = Math.max(maxz, p1[1]);
      const dx = p2[0] - p1[0], dz = p2[1] - p1[1], len = Math.hypot(dx, dz);
      if (len < .01) continue;
      const nn = sgn > 0 ? [dz / len, 0, -dx / len] : [-dz / len, 0, dx / len];
      const fl = sgn > 0 ? -1 : 1; // keep facades (and shop signs) reading left-to-right from outside
      const u1 = fl * per / tileW, u2 = fl * (per + len) / tileW;
      quadWall(wallBufs[style], p1, p2, yBase, h, u1, u2, vOff / tileH, (vOff + h - yBase) / tileH, nn, col);
      if (shop) { const sw = STYLES.shop.nx * STYLES.shop.cw; quadWall(wallBufs.shop, p1, p2, 0, SHOP_H, fl * per / sw, fl * (per + len) / sw, 0, 1, nn, col); }
      per += len;
      const s = { x1: p1[0], z1: p1[1], x2: p2[0], z2: p2[1], nx: nn[0], nz: nn[2] };
      segGrid.add(Math.min(p1[0], p2[0]), Math.min(p1[1], p2[1]), Math.max(p1[0], p2[0]), Math.max(p1[1], p2[1]), s);
    }
    // contact shadow on the ground around the footprint
    const out = offsetPoly(pts, 2.2, sgn);
    for (let i = 0; i < n; i++) {
      const a = pts[i], bb = pts[(i + 1) % n], c = out[(i + 1) % n], d = out[i];
      aoBuf.tri([a[0], .06, a[1], 0, 0], [bb[0], .06, bb[1], 1, 0], [c[0], .06, c[1], 1, 1], UP); aoBuf.tri([a[0], .06, a[1], 0, 0], [c[0], .06, c[1], 1, 1], [d[0], .06, d[1], 0, 1], UP);
    }
    if (pitched) {
      // gable roof along the longer axis, with small eaves
      let q = pts.slice();
      const l0 = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), l1 = Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]);
      if (l1 > l0) q = [q[1], q[2], q[3], q[0]];
      const qo = offsetPoly(q, .45, polyArea(q) > 0 ? 1 : -1);
      const short = Math.min(l0, l1), rh = Math.min(3.2, short * .42);
      const m1 = [(q[3][0] + q[0][0]) / 2, (q[3][1] + q[0][1]) / 2], m2 = [(q[1][0] + q[2][0]) / 2, (q[1][1] + q[2][1]) / 2];
      const mo1 = [(qo[3][0] + qo[0][0]) / 2, (qo[3][1] + qo[0][1]) / 2], mo2 = [(qo[1][0] + qo[2][0]) / 2, (qo[1][1] + qo[2][1]) / 2];
      const ey = h - .25, ry = h + rh;
      const face = (A, Bp, Cp, Dp) => {
        const a3 = [A[0], ey, A[1]], b3 = [Bp[0], ey, Bp[1]], c3 = [Cp[0], ry, Cp[1]], d3 = [Dp[0], ry, Dp[1]];
        let nrm = V.norm(V.cross(V.sub(b3, a3), V.sub(d3, a3))); if (nrm[1] < 0) nrm = V.mul(nrm, -1);
        const L = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]) / 3;
        roofBuf.tri([...a3, 0, 0], [...b3, L, 0], [...c3, L, 1.2], nrm, rcol); roofBuf.tri([...a3, 0, 0], [...c3, L, 1.2], [...d3, 0, 1.2], nrm, rcol);
      };
      face(qo[0], qo[1], mo2, mo1); face(qo[2], qo[3], mo1, mo2);
      for (const [A, Bp, Mm] of [[q[1], q[2], m2], [q[3], q[0], m1]]) {
        const nn = edgeN(A, Bp, polyArea(q) > 0 ? 1 : -1);
        wallBufs[style].tri([A[0], h, A[1], 0, .1], [Bp[0], h, Bp[1], .05, .1], [Mm[0], ry, Mm[1], .025, .1 + rh / tileH], [nn[0], 0, nn[1]], col);
      }
    } else {
      const contour = pts.map(p => new THREE.Vector2(p[0], p[1]));
      let faces = [];
      try { faces = THREE.ShapeUtils.triangulateShape(contour, []); } catch { /* bad polygon */ }
      for (const f of faces) roofBuf.tri(...f.map(k => [pts[k][0], h, pts[k][1], pts[k][0] / 9, pts[k][1] / 9]), UP, rcol);
      // parapet with a small cornice
      if (h > 6 && area > 40) {
        const ph = h > 30 ? 1.1 : .8, outer = offsetPoly(pts, .18, sgn), inner = offsetPoly(pts, -.3, sgn);
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n, nO = edgeN(pts[i], pts[j], sgn);
          quadWall(trimBuf, outer[i], outer[j], h - .3, h + ph, 0, 1, 0, .2, [nO[0], 0, nO[1]], tcol);
          quadWall(trimBuf, inner[j], inner[i], h, h + ph, 0, 1, 0, .2, [-nO[0], 0, -nO[1]], tcol);
          trimBuf.tri([outer[i][0], h + ph, outer[i][1]], [outer[j][0], h + ph, outer[j][1]], [inner[j][0], h + ph, inner[j][1]], UP, tcol);
          trimBuf.tri([outer[i][0], h + ph, outer[i][1]], [inner[j][0], h + ph, inner[j][1]], [inner[i][0], h + ph, inner[i][1]], UP, tcol);
          trimBuf.tri([outer[i][0], h - .3, outer[i][1]], [outer[j][0], h - .3, outer[j][1]], [pts[j][0], h - .3, pts[j][1]], [0, -1, 0], tcol);
          trimBuf.tri([outer[i][0], h - .3, outer[i][1]], [pts[j][0], h - .3, pts[j][1]], [pts[i][0], h - .3, pts[i][1]], [0, -1, 0], tcol);
        }
        // rooftop plant: AC units, stair housings, water tanks
        const nBox = Math.min(6, Math.floor(area / 250) + (rnd() < .6 ? 1 : 0));
        for (let k = 0, tries = 0; k < nBox && tries < 30; tries++) {
          const x = minx + rnd() * (maxx - minx), z = minz + rnd() * (maxz - minz);
          const w = 1.2 + rnd() * 3, d = 1 + rnd() * 2.5;
          if (!pip(x, z, pts) || !pip(x + w, z, pts) || !pip(x - w, z, pts) || !pip(x, z + w, pts) || !pip(x, z - w, pts)) continue;
          const g = .55 + rnd() * .3; boxCol.setRGB(g, g, g * 1.02);
          boxOn(trimBuf, x, z, h, w, d, .8 + rnd() * (rnd() < .2 ? 2.4 : 1), rnd() * 3, boxCol); k++;
        }
      }
    }
    const bo = { pts, h, minx, minz, maxx, maxz };
    buildings.push(bo);
    bGrid.add(minx, minz, maxx, maxz, bo);
  }
  for (const st of styleNames) addMesh(wallBufs[st], wallMats[st], 0, true);
  addMesh(roofBuf, roofMat, 0, true);
  addMesh(trimBuf, trimMat, 0, true);
  addMesh(aoBuf, M(new THREE.MeshBasicMaterial({ map: T.ao, transparent: true, ...overlay })), 6);

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

  // vegetation & street lights
  const palmShare = absLat < 27 ? .65 : absLat < 37 ? .45 : (region === 'eu' && absLat < 45) ? .3 : 0;
  const pine = absLat > 44 ? .3 : .12;
  const plants = []; // [x, z, kind]
  const lamps = [];
  const okSpot = (x, z, clear) => {
    if (!inB(x, z) || insideBuilding(x, z)) return false;
    const nr = nearestRoad(x, z, 14);
    return !(nr && nr.d < nr.road.w / 2 + clear);
  };
  const parkKind = () => { const r = Math.random(); return r < palmShare * .5 ? 'palm' : r < palmShare * .5 + pine ? 'pine' : 'broad'; };
  for (const poly of data.green) {
    let minx = 1e9, minz = 1e9, maxx = -1e9, maxz = -1e9;
    for (const p of poly) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); minz = Math.min(minz, p[1]); maxz = Math.max(maxz, p[1]); }
    const area = Math.abs(polyArea(poly)), cnt = Math.min(140, area / 130);
    for (let i = 0; i < cnt && plants.length < 3000; i++) {
      const x = minx + Math.random() * (maxx - minx), z = minz + Math.random() * (maxz - minz);
      if (pip(x, z, poly) && okSpot(x, z, 1.2)) plants.push([x, z, parkKind()]);
    }
    for (let i = 0; i < cnt * .8 && plants.length < 4200; i++) {
      const x = minx + Math.random() * (maxx - minx), z = minz + Math.random() * (maxz - minz);
      if (pip(x, z, poly) && okSpot(x, z, .8)) plants.push([x, z, 'bush']);
    }
  }
  for (const r of data.roads) {
    if (!TRAFFIC.has(r.cls) && r.cls !== 'living_street') continue;
    const major = r.w >= 9;
    const kind = Math.random() < palmShare ? 'palm' : 'broad';
    for (let d = 6; d < r.len; d += 15) {
      const sp = samplePath(r, d, false);
      const px = -sp.dz, pz = sp.dx;
      for (const side of [-1, 1]) {
        const off = r.w / 2 + (major ? 1.3 : 2.2);
        const x = sp.x + px * side * off, z = sp.z + pz * side * off;
        if (major && side === 1 && (Math.round(d / 15) % 2 === 0)) {
          if (lamps.length < 1800 && okSpot(x, z, .6)) lamps.push([x, z, Math.atan2(-(-pz * side), -px * side)]);
        } else if (!NO_SIDEWALK.has(r.cls) && Math.random() < (major ? .35 : .55) && plants.length < 7000) {
          if (okSpot(x, z, .8)) plants.push([x + (Math.random() - .5) * .6, z + (Math.random() - .5) * .6, kind]);
        }
      }
    }
  }
  const dummy = new THREE.Object3D();
  const leafT = leafAtlas(), needT = needleTex(), frondT = frondTex(), barkT = barkTex(false), palmBarkT = barkTex(true);
  texs.push(leafT, needT, frondT, barkT, palmBarkT);
  const rndT = mulberry32(99);
  const clusters = [16, 24, 34][detail];
  const species = {
    broad: { tpl: [broadTree(rndT, clusters), broadTree(rndT, clusters)], leaf: foliageMat(leafT, M), bark: M(new THREE.MeshStandardMaterial({ map: barkT, roughness: 1, vertexColors: true })), s: [.8, 1.35], hue: [.2, .3], obst: .35 },
    pine: { tpl: [conifer(rndT)], leaf: foliageMat(needT, M), bark: null, s: [.75, 1.25], hue: [.28, .38], obst: .3 },
    palm: { tpl: [palm(rndT), palm(rndT), palm(rndT)], leaf: foliageMat(frondT, M), bark: M(new THREE.MeshStandardMaterial({ map: palmBarkT, roughness: .95, vertexColors: true })), s: [.85, 1.2], hue: [.18, .24], obst: .3 },
    bush: { tpl: [bush(rndT, 10), bush(rndT, 12)], leaf: foliageMat(leafT, M), bark: null, s: [.6, 1.3], hue: [.2, .32], obst: 0 },
  };
  species.pine.bark = species.broad.bark;
  const CH = 260, chunks = new Map();
  for (const [x, z, kind] of plants) {
    const sp = species[kind], v = (Math.random() * sp.tpl.length) | 0;
    const key = `${Math.floor(x / CH)},${Math.floor(z / CH)}|${kind}|${v}`;
    let a = chunks.get(key); if (!a) chunks.set(key, a = { sp, v, items: [] });
    a.items.push([x, z]);
    if (sp.obst) oGrid.add(x - 1, z - 1, x + 1, z + 1, { x, z, r: sp.obst });
  }
  const c = new THREE.Color();
  for (const { sp, v, items } of chunks.values()) {
    const tpl = sp.tpl[v];
    const leaves = new THREE.InstancedMesh(tpl.leaves, sp.leaf, items.length);
    const trunk = tpl.trunk && sp.bark ? new THREE.InstancedMesh(tpl.trunk, sp.bark, items.length) : null;
    items.forEach(([x, z], i) => {
      const s = sp.s[0] + Math.random() * (sp.s[1] - sp.s[0]);
      dummy.position.set(x, 0, z); dummy.rotation.set(0, Math.random() * 6.28, 0); dummy.scale.set(s, s * (.88 + Math.random() * .3), s); dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix); if (trunk) trunk.setMatrixAt(i, dummy.matrix);
      c.setHSL(sp.hue[0] + Math.random() * (sp.hue[1] - sp.hue[0]), .25 + Math.random() * .25, .8 + Math.random() * .25); c.r = Math.min(c.r, 1);
      leaves.setColorAt(i, c);
    });
    for (const m of [leaves, trunk]) if (m) { m.castShadow = true; m.receiveShadow = true; m.computeBoundingSphere(); group.add(m); }
  }

  const lampMat = M(new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffd9a0, emissiveIntensity: .2 }));
  const poolMat = M(new THREE.MeshBasicMaterial({ map: T.glow, color: 0xffc98a, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
  let pools = null;
  if (lamps.length) {
    const poleG = new THREE.CylinderGeometry(.07, .12, 7.2, 8).translate(0, 3.6, 0);
    const armG = new THREE.CylinderGeometry(.045, .045, 1.9, 6).rotateZ(Math.PI / 2).translate(.95, 7.05, 0);
    const headG = new THREE.CylinderGeometry(.22, .34, .16, 10).scale(1.6, 1, 1).translate(1.8, 6.98, 0);
    const pole = new THREE.InstancedMesh(poleG, M(new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: .45, metalness: .7 })), lamps.length);
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
    stats: { buildings: data.buildings.length, roads: data.roads.length, trees: plants.length, lamps: lamps.length },
    insideBuilding, nearestRoad,
    update(t) { T.water.offset.set(t * .012, t * .007); },
    setNight(on) {
      for (const st of styleNames) wallMats[st].emissiveIntensity = on ? (st === 'shop' ? 2.2 : 1.5) : 0;
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
      for (const t of texs) t.dispose();
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
