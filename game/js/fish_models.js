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

// A cute fish facing +Y (up): plump rounded body, forked caudal tail fin, a
// little dorsal fin and two pectoral side fins. Enemies get rotated 180°.
// (Rendered with DoubleSide so the flat fins read from the front camera.)
export function buildFishGeometry() {
  // Plump, slightly egg-shaped body (rounder head at +Y).
  const body = new THREE.SphereGeometry(0.5, 16, 12);
  body.scale(0.5, 0.74, 0.46);
  body.translate(0, 0.06, 0);

  // Forked caudal tail fin (flat, at the back / -Y).
  const tail = triGeo([
    [[0, -0.46, 0], [0.44, -1.04, 0], [0, -0.74, 0]],
    [[0, -0.46, 0], [0, -0.74, 0], [-0.44, -1.04, 0]],
  ]);

  // Little dorsal fin on top of the body (near the head).
  const dorsal = triGeo([
    [[-0.12, 0.42, 0], [0.12, 0.42, 0], [0.02, 0.66, 0]],
  ]);

  // Two pectoral side fins around mid-body.
  const pecR = triGeo([
    [[0.40, 0.10, 0], [0.66, 0.20, 0], [0.46, -0.14, 0]],
  ]);
  const pecL = triGeo([
    [[-0.40, 0.10, 0], [-0.46, -0.14, 0], [-0.66, 0.20, 0]],
  ]);

  const geo = mergeGeoms([body, tail, dorsal, pecR, pecL]);
  geo.computeVertexNormals();
  return geo;
}

// Tri-color fish: same silhouette but we band it in the shader by body-Y.
export function buildTriGeometry() {
  return buildFishGeometry();
}

// A big shark facing +Y (up): long torpedo body, pointed snout, tall dorsal fin,
// two pectoral fins and a forked caudal tail. ~1 unit tall before scaling.
export function buildSharkGeometry() {
  // Torpedo body.
  const body = new THREE.SphereGeometry(0.5, 18, 12);
  body.scale(0.34, 1.05, 0.36);
  body.translate(0, 0.05, 0);

  // Pointed snout at the front (+Y), overlapping the body so it connects.
  const snout = new THREE.ConeGeometry(0.19, 0.55, 14);
  snout.translate(0, 0.78, 0);
  snout.scale(1.0, 1.0, 1.06);

  // Tall dorsal fin on the back.
  const dorsal = triGeo([
    [[0, 0.15, 0.0], [0.02, 0.15, 0.30], [0.0, 0.72, 0.05]],
  ]);
  // Forked caudal tail fin (flat), bigger top lobe.
  const tail = triGeo([
    [[0, -0.55, 0], [0.40, -1.30, 0], [0, -0.86, 0]],
    [[0, -0.55, 0], [0, -0.86, 0], [-0.30, -1.05, 0]],
  ]);
  // Pectoral fins.
  const pecR = triGeo([[[0.28, 0.10, 0], [0.72, -0.20, 0], [0.30, -0.20, 0]]]);
  const pecL = triGeo([[[-0.28, 0.10, 0], [-0.30, -0.20, 0], [-0.72, -0.20, 0]]]);

  const geo = mergeGeoms([body, snout, dorsal, tail, pecR, pecL]);
  geo.computeVertexNormals();
  return geo;
}

// A giant squid / octopus: a wide, fairly flat mantle (head) with a spread fan
// of shorter tentacles, so it can span the lanes without hanging to the bottom.
export function buildSquidGeometry() {
  const parts = [];
  // Mantle / head dome (wide + flattish).
  const head = new THREE.SphereGeometry(0.5, 20, 16);
  head.scale(1.05, 0.62, 0.7);
  head.translate(0, 0.3, 0);
  parts.push(head);
  // A brow ridge to make it read as a head.
  const brow = new THREE.SphereGeometry(0.5, 16, 12);
  brow.scale(0.8, 0.24, 0.5);
  brow.translate(0, 0.52, 0.18);
  parts.push(brow);
  // Tentacles: a wide fan of short tapered prisms curling downward.
  const N = 9;
  for (let i = 0; i < N; i++) {
    const t = (i / (N - 1) - 0.5); // -0.5..0.5
    const x = t * 2.1;             // wide spread across the lanes
    const tent = new THREE.ConeGeometry(0.12, 0.8, 8);
    tent.rotateZ(Math.PI);        // point down
    tent.scale(1.0, 1.0, 0.7);
    tent.rotateZ(-t * 0.4);       // slight outward curl
    tent.translate(x, -0.32, -0.05 + Math.abs(t) * 0.08);
    parts.push(tent);
  }
  const geo = mergeGeoms(parts);
  geo.computeVertexNormals();
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
