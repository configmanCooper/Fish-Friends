// fish_models.js — procedural fish geometry + pattern atlas (three.js layer).
import * as THREE from './vendor/three.module.js';

// Merge an array of BufferGeometries (position, normal, uv) into one.
function mergeGeoms(geoms) {
  let vCount = 0, iCount = 0;
  for (const g of geoms) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx = new Uint16Array(iCount);
  let vo = 0, io = 0;
  for (const g of geoms) {
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    const u = g.attributes.uv.array;
    pos.set(p, vo * 3);
    nor.set(n, vo * 3);
    uv.set(u, vo * 2);
    const gi = g.index ? g.index.array : null;
    const gc = g.attributes.position.count;
    if (gi) {
      for (let i = 0; i < gi.length; i++) idx[io++] = gi[i] + vo;
    } else {
      for (let i = 0; i < gc; i++) idx[io++] = i + vo;
    }
    vo += gc;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

// Build a flat fin geometry from a list of triangles (each 3 [x,y,z] points).
function triGeo(tris) {
  const n = tris.length * 3;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const idx = new Uint16Array(n);
  let vi = 0;
  for (const t of tris) {
    for (const v of t) {
      pos[vi * 3] = v[0]; pos[vi * 3 + 1] = v[1]; pos[vi * 3 + 2] = v[2];
      uv[vi * 2] = 0.5; uv[vi * 2 + 1] = 0.5;
      idx[vi] = vi; vi++;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// Parametric fish body: a spindle that is pointed at the head (+Y), widest just
// ahead of centre, and tapers to a thin caudal peduncle (-Y). UVs: u around the
// body, v along it (0 tail -> 1 head) so the pattern tiles and the shader can
// place eyes near the head.
function buildFishBody() {
  const NR = 15, NS = 12;
  const yTail = -0.6, yHead = 0.62;
  const wx = (s) => 0.35 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(s, 1.3))), 0.8);
  const wz = (s) => 0.24 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(s, 1.25))), 0.8);

  const pos = [], uv = [], idx = [];
  const cols = NS + 1;
  for (let i = 0; i < NR; i++) {
    const s = 0.05 + 0.9 * (i / (NR - 1));
    const y = yTail + (yHead - yTail) * s;
    const rx = wx(s), rz = wz(s);
    for (let j = 0; j <= NS; j++) {
      const a = (j / NS) * Math.PI * 2;
      pos.push(Math.cos(a) * rx, y, Math.sin(a) * rz);
      uv.push(j / NS, s);
    }
  }
  for (let i = 0; i < NR - 1; i++) {
    for (let j = 0; j < NS; j++) {
      const a = i * cols + j, b = a + cols;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const tailIdx = pos.length / 3; pos.push(0, yTail - 0.02, 0); uv.push(0.5, 0.0);
  const headIdx = pos.length / 3; pos.push(0, yHead + 0.04, 0); uv.push(0.5, 1.0);
  const base = (NR - 1) * cols;
  for (let j = 0; j < NS; j++) {
    idx.push(tailIdx, j + 1, j);
    idx.push(headIdx, base + j, base + j + 1);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// A realistic-ish fish facing +Y (up): spindle body, forked caudal tail, and two
// swept-back pectoral fins. Enemies are rotated 180°. DoubleSide so fins read.
export function buildFishGeometry() {
  const body = buildFishBody();

  // Forked caudal tail fin (flat), with a central notch.
  const tail = triGeo([
    [[0.07, -0.55, 0], [0.40, -1.18, 0], [0.02, -0.9, 0]],
    [[-0.07, -0.55, 0], [-0.02, -0.9, 0], [-0.40, -1.18, 0]],
    [[0.07, -0.55, 0], [0.02, -0.9, 0], [-0.07, -0.55, 0]],
    [[-0.07, -0.55, 0], [0.02, -0.9, 0], [-0.02, -0.9, 0]],
  ]);

  // Swept-back pectoral fins on each side, mid-body.
  const pecR = triGeo([[[0.30, 0.08, 0.04], [0.66, -0.14, 0], [0.33, -0.24, 0.02]]]);
  const pecL = triGeo([[[-0.30, 0.08, 0.04], [-0.33, -0.24, 0.02], [-0.66, -0.14, 0]]]);

  const geo = mergeGeoms([body, tail, pecR, pecL]);
  geo.computeVertexNormals();
  return geo;
}

// Tri-color fish: same silhouette but we band it in the shader by body-Y.
export function buildTriGeometry() {
  return buildFishGeometry();
}

// Squid mantle: a long tapered tube, pointed at the top (posterior), widest in
// the middle, narrowing to the head opening at the bottom.
export function buildSquidMantle(wxFn, wzFn) {
  const b = spindle(16, 14, -0.55, 0.95, wxFn, wzFn);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(b.pos.length), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  g.setIndex(b.idx);
  g.computeVertexNormals();
  return g;
}

// Reusable parametric spindle body -> {pos, uv, idx}. Head at +Y, tail at -Y.
function spindle(NR, NS, yTail, yHead, wxFn, wzFn) {
  const pos = [], uv = [], idx = [];
  const cols = NS + 1;
  for (let i = 0; i < NR; i++) {
    const s = 0.05 + 0.9 * (i / (NR - 1));
    const y = yTail + (yHead - yTail) * s;
    const rx = wxFn(s), rz = wzFn(s);
    for (let j = 0; j <= NS; j++) {
      const a = (j / NS) * Math.PI * 2;
      pos.push(Math.cos(a) * rx, y, Math.sin(a) * rz);
      uv.push(j / NS, s);
    }
  }
  for (let i = 0; i < NR - 1; i++) {
    for (let j = 0; j < NS; j++) {
      const a = i * cols + j, b = a + cols;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const tailIdx = pos.length / 3; pos.push(0, yTail - 0.02, 0); uv.push(0.5, 0);
  const headIdx = pos.length / 3; pos.push(0, yHead + 0.04, 0); uv.push(0.5, 1);
  const base = (NR - 1) * cols;
  for (let j = 0; j < NS; j++) { idx.push(tailIdx, j + 1, j); idx.push(headIdx, base + j, base + j + 1); }
  return { pos, uv, idx };
}

// A great-white-style shark facing +Y: torpedo body with a pointed snout and
// broad "shoulders", big swept pectoral fins, a dorsal fin, small pelvic fins,
// and a large forked caudal tail. Two-tone grey (dark back, pale margins) via
// vertex colours; two dark eyes near the snout.
export function buildSharkGeometry() {
  const wx = (s) => 0.30 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(s, 1.35))), 0.75);
  const wz = (s) => 0.22 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(s, 1.3))), 0.75);
  const b = spindle(18, 14, -0.7, 0.82, wx, wz);
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  body.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(b.pos.length), 3));
  body.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  body.setIndex(b.idx);

  // Big swept-back pectoral fins.
  const pecR = triGeo([[[0.24, 0.30, 0.02], [0.95, -0.28, 0], [0.30, -0.12, 0.02]]]);
  const pecL = triGeo([[[-0.24, 0.30, 0.02], [-0.30, -0.12, 0.02], [-0.95, -0.28, 0]]]);
  // Small pelvic fins near the back.
  const pelR = triGeo([[[0.16, -0.35, 0.01], [0.45, -0.62, 0], [0.18, -0.55, 0.01]]]);
  const pelL = triGeo([[[-0.16, -0.35, 0.01], [-0.18, -0.55, 0.01], [-0.45, -0.62, 0]]]);
  // Dorsal fin ridge on top.
  const dorsal = triGeo([
    [[-0.05, 0.20, 0.16], [0.05, 0.20, 0.16], [0.0, 0.30, 0.44]],
  ]);
  // Large forked caudal tail (upper lobe bigger).
  const tail = triGeo([
    [[0.06, -0.62, 0], [0.42, -1.42, 0], [0.02, -0.95, 0]],
    [[-0.06, -0.62, 0], [-0.02, -0.95, 0], [-0.34, -1.16, 0]],
    [[0.06, -0.62, 0], [0.02, -0.95, 0], [-0.06, -0.62, 0]],
    [[-0.06, -0.62, 0], [0.02, -0.95, 0], [-0.02, -0.95, 0]],
  ]);

  const geo = mergeGeoms([body, pecR, pecL, pelR, pelL, dorsal, tail]);
  geo.computeVertexNormals();

  // Two-tone vertex colours + dark eyes.
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const back = new THREE.Color(0x54637a), pale = new THREE.Color(0xc9d2da), eye = new THREE.Color(0x14181f);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = Math.min(1, Math.max(0, (z + 0.16) / 0.34)); // pale belly/edges, dark back
    tmp.copy(pale).lerp(back, t);
    // eyes near the snout, on the dorsal side
    if (y > 0.52 && z > 0.02 && Math.abs(x) > 0.05 && Math.abs(x) < 0.17) tmp.copy(eye);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// 128x128 pattern atlas: 4 cells (0 blank, 1 stripes, 2 dots, 3 chevrons)
// arranged in a 2x2 grid. Alpha channel encodes the marking mask.
export function buildPatternAtlas() {
  const S = 128, cell = 64;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';

  // cell coords (col,row): 0=(0,0) blank, 1=(1,0) stripes, 2=(0,1) dots, 3=(1,1) chevrons
  const cx = (i) => (i % 2) * cell;
  const cy = (i) => Math.floor(i / 2) * cell;

  // stripes (cell 1)
  {
    const ox = cx(1), oy = cy(1);
    for (let x = 0; x < cell; x += 14) ctx.fillRect(ox + x, oy, 7, cell);
  }
  // dots (cell 2)
  {
    const ox = cx(2), oy = cy(2);
    for (let y = 8; y < cell; y += 18) for (let x = 8; x < cell; x += 18) {
      ctx.beginPath(); ctx.arc(ox + x, oy + y, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // chevrons (cell 3)
  {
    const ox = cx(3), oy = cy(3);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 5;
    for (let y = -cell; y < cell; y += 16) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + y);
      ctx.lineTo(ox + cell / 2, oy + y + cell / 2);
      ctx.lineTo(ox + cell, oy + y);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// pattern id (0 blank,1 stripes,2 dots,3 chevrons) -> uv offset for the atlas cell
export function patternUvOffset(id) {
  const col = id % 2, row = Math.floor(id / 2);
  return [col * 0.5, 1.0 - (row + 1) * 0.5];
}
