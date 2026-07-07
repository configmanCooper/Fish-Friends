// render3d.js — three.js presentation. Reads sim state + events, draws the scene.
// One instanced mesh for all normal/white/black/player fish; tri fish are a small
// non-instanced group. Friend pairs swim off-screen together on a correct meeting.
import * as THREE from './vendor/three.module.js';
import { buildFishGeometry, buildTriGeometry, buildPatternAtlas, patternUvOffset, buildSharkGeometry, buildSquidMantle } from './fish_models.js';
import { ParticleFX, Floaters } from './fx.js';
import { COLORS, SPEED, FIELD, ROW_YS, CORAL } from './config.js';

const H = 10;                 // world height for y in [0,1]
const MARGIN = 0.05;          // side margin fraction of field width
const CAP = 256;              // instanced fish capacity

const patternForColor = {};   // colorId -> patternId (0 blank,1 stripes,2 dots,3 chevrons,4 grid,5 waves,6 triangles)
// stripes for blue/orange, dots for red/green, chevrons for yellow/purple
patternForColor.blue = 1; patternForColor.orange = 1;
patternForColor.red = 2; patternForColor.green = 2;
patternForColor.yellow = 3; patternForColor.purple = 3;
// prestige pairs: grid for teal/pink, waves for lime/magenta, triangles for gold/indigo
patternForColor.teal = 4; patternForColor.pink = 4;
patternForColor.lime = 5; patternForColor.magenta = 5;
patternForColor.gold = 6; patternForColor.indigo = 6;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const _qUp = new THREE.Quaternion();       // player facing up (identity)
const _qDown = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI); // enemy facing down

// Flat-triangle mesh helper (for squid fins).
function triGeoMesh(tri, mat) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array([tri[0][0], tri[0][1], tri[0][2], tri[1][0], tri[1][1], tri[1][2], tri[2][0], tri[2][1], tri[2][2]]);
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

// --- Sea-turtle canvas textures (flat top-down illustration style) -----------
function _canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// Obovoid "egg" outline: wide rounded top, tapering to a narrow rounded point at
// the bottom (the head end, which faces the player in phase 1).
function _eggPath(g, cx, cy, Wr, Hr) {
  g.beginPath();
  g.moveTo(cx, cy - Hr);
  g.bezierCurveTo(cx + Wr * 1.26, cy - Hr * 0.92, cx + Wr, cy + Hr * 0.16, cx + Wr * 0.42, cy + Hr * 0.74);
  g.bezierCurveTo(cx + Wr * 0.16, cy + Hr * 1.0, cx - Wr * 0.16, cy + Hr * 1.0, cx - Wr * 0.42, cy + Hr * 0.74);
  g.bezierCurveTo(cx - Wr, cy + Hr * 0.16, cx - Wr * 1.26, cy - Hr * 0.92, cx, cy - Hr);
  g.closePath();
}

function makeTurtleShellTexture() {
  return _canvasTex(512, 620, (g, w, h) => {
    const cx = w / 2, cy = h / 2, Wr = w * 0.43, Hr = h * 0.45;
    _eggPath(g, cx, cy, Wr, Hr);
    g.save(); g.clip();
    const grd = g.createLinearGradient(cx - Wr, cy - Hr, cx + Wr, cy + Hr);
    grd.addColorStop(0, '#956333'); grd.addColorStop(0.5, '#774a20'); grd.addColorStop(1, '#5c3814');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.restore();

    const iWr = Wr * 0.80, iHr = Hr * 0.82;
    // marginal scutes: inner boundary + radial ticks
    g.save(); _eggPath(g, cx, cy, Wr, Hr); g.clip();
    g.strokeStyle = 'rgba(48,26,9,0.75)'; g.lineWidth = 5; g.lineCap = 'round';
    _eggPath(g, cx, cy, iWr, iHr); g.stroke();
    const N = 22;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const s = Math.sin(a), c = -Math.cos(a);
      g.beginPath();
      g.moveTo(cx + s * iWr, cy + c * iHr);
      g.lineTo(cx + s * Wr * 1.05, cy + c * Hr * 1.05);
      g.stroke();
    }
    g.restore();

    // central scutes (vertebral column + costal sides)
    g.save(); _eggPath(g, cx, cy, iWr, iHr); g.clip();
    g.strokeStyle = 'rgba(48,26,9,0.72)'; g.lineWidth = 5; g.lineJoin = 'round';
    const colX = Wr * 0.24;
    g.beginPath(); g.moveTo(cx - colX, cy - Hr);
    g.bezierCurveTo(cx - colX * 1.15, cy - Hr * 0.3, cx - colX * 0.85, cy + Hr * 0.4, cx - colX * 0.5, cy + Hr); g.stroke();
    g.beginPath(); g.moveTo(cx + colX, cy - Hr);
    g.bezierCurveTo(cx + colX * 1.15, cy - Hr * 0.3, cx + colX * 0.85, cy + Hr * 0.4, cx + colX * 0.5, cy + Hr); g.stroke();
    for (let i = 1; i < 5; i++) {
      const yy = cy - Hr * 0.72 + (Hr * 1.5) * (i / 5);
      g.beginPath(); g.moveTo(cx - colX, yy); g.quadraticCurveTo(cx, yy - 9, cx + colX, yy); g.stroke();
    }
    for (let i = 1; i < 4; i++) {
      const yy = cy - Hr * 0.62 + (Hr * 1.35) * (i / 4);
      g.beginPath(); g.moveTo(cx - colX, yy); g.lineTo(cx - iWr, yy + (i - 1.5) * 10); g.stroke();
      g.beginPath(); g.moveTo(cx + colX, yy); g.lineTo(cx + iWr, yy + (i - 1.5) * 10); g.stroke();
    }
    g.restore();

    // glossy diagonal sheen
    g.save(); _eggPath(g, cx, cy, Wr, Hr); g.clip();
    g.globalAlpha = 0.13; g.fillStyle = '#ffe9c8';
    g.beginPath(); g.ellipse(cx - Wr * 0.26, cy - Hr * 0.22, Wr * 0.52, Hr * 0.72, -0.5, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1; g.restore();

    // outline
    g.strokeStyle = 'rgba(33,17,5,0.92)'; g.lineWidth = 8;
    _eggPath(g, cx, cy, Wr, Hr); g.stroke();
  });
}

function _drawFlipper(g, x, y, ang, len, wid) {
  g.save(); g.translate(x, y); g.rotate(ang);
  const grd = g.createLinearGradient(0, -wid, 0, wid);
  grd.addColorStop(0, '#74b342'); grd.addColorStop(1, '#4c8827');
  const paddle = () => {
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.5, -wid, len, -wid * 0.5);
    g.quadraticCurveTo(len * 1.12, 0, len, wid * 0.5);
    g.quadraticCurveTo(len * 0.5, wid, 0, 0);
    g.closePath();
  };
  g.fillStyle = grd; paddle(); g.fill();
  g.globalAlpha = 0.2; g.fillStyle = '#cdea9c';
  g.beginPath(); g.moveTo(len * 0.14, -wid * 0.42); g.lineTo(len * 0.92, -wid * 0.18); g.lineTo(len * 0.42, wid * 0.18); g.closePath(); g.fill();
  g.globalAlpha = 1;
  g.strokeStyle = 'rgba(38,66,18,0.55)'; g.lineWidth = 3; paddle(); g.stroke();
  g.restore();
}

// Body plate: four green flippers + tail, drawn head-down (head end toward the
// bottom). The shell plate is drawn on top and hides the flipper roots.
function makeTurtleBodyTexture() {
  return _canvasTex(640, 760, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    // front flippers (large) flank the head end (lower sides), swept outward/down
    _drawFlipper(g, cx - 150, cy + 96, 2.55, 300, 82);
    _drawFlipper(g, cx + 150, cy + 96, Math.PI - 2.55, 300, 82);
    // rear flippers (small) toward the tail (upper sides)
    _drawFlipper(g, cx - 150, cy - 150, -2.35, 190, 58);
    _drawFlipper(g, cx + 150, cy - 150, Math.PI + 2.35, 190, 58);
    // tail (small point at the rear / top)
    g.fillStyle = '#4c8827';
    g.beginPath();
    g.moveTo(cx, cy - 300); g.quadraticCurveTo(cx - 26, cy - 250, cx, cy - 218);
    g.quadraticCurveTo(cx + 26, cy - 250, cx, cy - 300); g.closePath(); g.fill();
  });
}

function makeTurtleHeadTexture() {
  return _canvasTex(256, 340, (g, w, h) => {
    const cx = w / 2, cy = h * 0.4, R = w * 0.33;
    const outline = () => {
      g.beginPath();
      g.moveTo(cx - R, cy);
      g.bezierCurveTo(cx - R, cy - R * 1.2, cx + R, cy - R * 1.2, cx + R, cy);
      g.bezierCurveTo(cx + R, cy + R * 0.9, cx + R * 0.4, cy + R * 1.75, cx, cy + R * 1.85);
      g.bezierCurveTo(cx - R * 0.4, cy + R * 1.75, cx - R, cy + R * 0.9, cx - R, cy);
      g.closePath();
    };
    const grd = g.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.2, cx, cy + R * 0.3, R * 1.6);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#cccccc');
    g.fillStyle = grd; outline(); g.fill();
    g.fillStyle = '#181320';
    g.beginPath(); g.arc(cx - R * 0.42, cy - R * 0.12, R * 0.15, 0, 7); g.fill();
    g.beginPath(); g.arc(cx + R * 0.42, cy - R * 0.12, R * 0.15, 0, 7); g.fill();
    g.fillStyle = 'rgba(40,30,20,0.45)';
    g.beginPath(); g.arc(cx - R * 0.12, cy + R * 1.35, R * 0.055, 0, 7); g.fill();
    g.beginPath(); g.arc(cx + R * 0.12, cy + R * 1.35, R * 0.055, 0, 7); g.fill();
    g.strokeStyle = 'rgba(55,45,35,0.5)'; g.lineWidth = 4; outline(); g.stroke();
  });
}

// Irregular paint-splat mask (white on transparent) — tinted per splotch.
function makeSplatTexture(seed) {
  return _canvasTex(128, 128, (g, w) => {
    const cx = w / 2, cy = w / 2, base = w * 0.27;
    g.fillStyle = '#ffffff';
    const steps = 40;
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const r = base * (0.74 + 0.34 * Math.sin(a * 3 + seed) + 0.16 * Math.sin(a * 5 - seed * 1.7));
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.fill();
    for (let i = 0; i < 5; i++) {
      const a = seed * 1.3 + i * 1.7;
      const d = w * (0.36 + 0.06 * ((i * 7 + seed * 3) % 3));
      g.beginPath();
      g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, w * (0.035 + 0.03 * ((i + 1) % 2)), 0, 7);
      g.fill();
    }
  });
}


export class Render3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.W = H * 0.6;
    this.camera = new THREE.OrthographicCamera(-this.W / 2, this.W / 2, H, 0, -50, 50);
    this.camera.position.z = 10;

    this.laneCount = 5;
    this.time = 0;
    this.swimoffs = [];   // ephemeral friend pairs {fish:[{...}], t}
    this.triFish = new Map(); // id -> {mesh, bands, phase}

    this._buildBackground();
    this._buildLights();
    this._buildFishMesh();
    this._buildTriPrototype();
    this._buildShark();
    this._buildSquid();
    this._buildCurrents();
    this._buildCoral();
    this._buildAnemone();
    this._buildWhale();
    this._buildTurtle();
    this.fx = new ParticleFX(this.scene);
    this.floaters = new Floaters(this.scene);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  _buildCurrents() {
    // Pool of subtle horizontal "moving water" bands (semi-transparent, additive,
    // with a scrolling stripe shader driven by uTime * direction).
    this.currentBands = [];
    for (let i = 0; i < 2; i++) {
      const geo = new THREE.PlaneGeometry(40, 0.9);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uDir: { value: 1 }, uOpacity: { value: 0.3 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `
          varying vec2 vUv; uniform float uTime; uniform float uDir; uniform float uOpacity;
          void main(){
            // vertical fade so the band blends into the water
            float edge = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
            // scrolling row of little triangle arrows pointing in the current direction
            float cellW = 0.032;
            float scroll = uTime * uDir * 0.024;
            float fx = fract((vUv.x - scroll) / cellW);
            float ax = uDir >= 0.0 ? fx : 1.0 - fx;          // mirror for left-flowing
            float hh = clamp((0.72 - ax) / 0.62, 0.0, 1.0) * 0.34; // taper to the apex
            float inArrow = (ax > 0.12 && abs(vUv.y - 0.5) < hh) ? 1.0 : 0.0;
            float a = (0.06 + inArrow * 1.0) * edge * uOpacity;
            vec3 col = mix(vec3(0.4, 0.65, 1.0), vec3(0.72, 0.9, 1.0), inArrow);
            gl_FragColor = vec4(col, a);
          }`,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.position.z = -1.5;
      mesh.renderOrder = 1;
      this.scene.add(mesh);
      this.currentBands.push(mesh);
    }
  }

  _buildCoral() {
    // Procedural coral: a cluster of colored rounded branches.
    const group = new THREE.Group();
    const cols = [0xff6f8f, 0xff9a5a, 0xd66fff, 0xffd23f];
    for (let i = 0; i < 7; i++) {
      const h = 0.5 + Math.random() * 0.6;
      const g = new THREE.CapsuleGeometry(0.12, h, 4, 8);
      const m = new THREE.MeshLambertMaterial({ color: cols[i % cols.length] });
      const b = new THREE.Mesh(g, m);
      const a = (i / 7) * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.28, -0.1 + h * 0.4, Math.sin(a) * 0.12);
      b.rotation.z = (Math.random() - 0.5) * 0.7;
      group.add(b);
    }
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), new THREE.MeshLambertMaterial({ color: 0xd98f6a }));
    base.scale.set(1.2, 0.6, 1.0);
    group.add(base);
    group.visible = false;
    group.renderOrder = 2;
    this.coralGroup = group;
    this.coralX = null; // for slide animation
    this.scene.add(group);
  }

  _buildAnemone() {
    // A cluster of wavy translucent tentacles that repaint fish crossing it.
    const group = new THREE.Group();
    this.anemoneTentacles = [];
    const cols = [0x8b5cf6, 0x22d3ee, 0xf25fa0, 0x8bd41f];
    for (let i = 0; i < 9; i++) {
      const h = 0.4 + Math.random() * 0.5;
      const g = new THREE.CapsuleGeometry(0.05, h, 4, 6);
      const m = new THREE.MeshLambertMaterial({ color: cols[i % cols.length], transparent: true, opacity: 0.72, emissive: cols[i % cols.length], emissiveIntensity: 0.35 });
      const b = new THREE.Mesh(g, m);
      const a = (i / 9) * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.22, -0.05 + h * 0.4, Math.sin(a) * 0.1);
      b.userData.phase = Math.random() * Math.PI * 2;
      b.userData.h = h;
      group.add(b);
      this.anemoneTentacles.push(b);
    }
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), new THREE.MeshLambertMaterial({ color: 0x6d3f8a }));
    base.scale.set(1.3, 0.5, 1.0);
    group.add(base);
    group.visible = false;
    group.renderOrder = 2;
    this.anemoneGroup = group;
    this.anemoneX = null;
    this.scene.add(group);
  }

  _buildWhale() {
    // Top-down whale spanning two lanes, head toward the beach (-y). Two body
    // halves so the final phase can show a distinct colour on each side.
    const group = new THREE.Group();
    const bodyMat = (hex) => new THREE.MeshLambertMaterial({ color: hex });
    const half = (sign) => {
      const g = new THREE.SphereGeometry(0.5, 20, 16);
      const m = new THREE.Mesh(g, bodyMat(0x2f7be6));
      m.scale.set(0.52, 0.95, 0.42);
      m.position.x = sign * 0.24;
      return m;
    };
    this.whaleLeft = half(-1);
    this.whaleRight = half(1);
    group.add(this.whaleLeft, this.whaleRight);

    this.whaleTrim = [];
    // tail flukes at the back (+y)
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), bodyMat(0x2a6fd0));
      f.scale.set(0.34, 0.16, 0.08);
      f.position.set(s * 0.28, 0.92, 0);
      f.rotation.z = s * 0.5;
      group.add(f); this.whaleTrim.push(f);
    }
    // pectoral fins mid-body
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), bodyMat(0x2a6fd0));
      f.scale.set(0.3, 0.5, 0.08);
      f.position.set(s * 0.52, 0.02, 0);
      f.rotation.z = s * 0.7;
      group.add(f); this.whaleTrim.push(f);
    }
    // eyes near the head (-y)
    this.whaleEyes = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshBasicMaterial({ color: 0x101820 }));
      e.scale.setScalar(0.055);
      e.position.set(s * 0.2, -0.55, 0.28);
      group.add(e); this.whaleEyes.push(e);
    }
    group.visible = false;
    group.renderOrder = 3;
    this.whaleGroup = group;
    this.whaleX = null;
    this.scene.add(group);
  }

  _updateWhale(sim) {
    const g = this.whaleGroup;
    const b = (sim && !sim.ended && !sim.bossWon) ? sim.boss : null;
    if (!b) { if (g.visible) g.visible = false; this.whaleX = null; return; }
    const segs = sim.bossSegments();
    const hexOf = (id) => (COLORS[id] ? COLORS[id].hex : 0x2f7be6);
    const cL = hexOf(segs[0] ? segs[0].color : b.color);
    const cR = hexOf(segs[1] ? segs[1].color : (segs[0] ? segs[0].color : b.color));
    this.whaleLeft.material.color.setHex(cL);
    this.whaleRight.material.color.setHex(cR);
    // trims: darkened blend of the two sides
    const trim = new THREE.Color(cL).lerp(new THREE.Color(cR), 0.5).multiplyScalar(0.72);
    for (const t of this.whaleTrim) t.material.color.copy(trim);

    const laneW = this._laneW();
    const targetX = (this.worldX(b.l0) + this.worldX(b.l0 + b.w - 1)) / 2;
    if (this.whaleX === null) this.whaleX = targetX;
    else this.whaleX += (targetX - this.whaleX) * Math.min(1, 0.14); // slide on strafe
    const scale = b.w * laneW * 0.95;
    g.visible = true;
    g.position.set(this.whaleX, this.worldY(b.y), 0.4);
    g.scale.setScalar(scale);
    g.rotation.z = Math.sin(this.time * 1.2) * 0.05; // gentle sway
  }

  _buildTurtle() {
    const g = new THREE.Group();
    this.turtleSplatTex = [makeSplatTexture(0.6), makeSplatTexture(1.9), makeSplatTexture(3.1), makeSplatTexture(4.4)];
    this.turtleHeadTex = makeTurtleHeadTexture();
    this.turtleSpotPlane = new THREE.PlaneGeometry(1, 1);

    const mkPlane = (tex, wl, hl, ro, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wl, hl),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      m.renderOrder = ro; m.position.z = z;
      return m;
    };

    // body plate (flippers + tail) — does not spin
    const body = mkPlane(makeTurtleBodyTexture(), 1.62, 1.92, 2, 0.0);
    g.add(body); this.turtleBody = body;
    // shell plate — spins in phases 2/3
    const shell = mkPlane(makeTurtleShellTexture(), 1.05, 1.28, 3, 0.02);
    g.add(shell); this.turtleShell = shell;
    // colored paint splotches (created lazily on the front rim)
    this.turtleSpotMeshes = [];
    // head — hidden until it pokes out; snout points down (toward the player)
    const head = mkPlane(this.turtleHeadTex, 0.34, 0.44, 5, 0.06);
    head.visible = false; g.add(head); this.turtleHeadMesh = head;
    // phase-3 paint projectiles (live in world space, added to scene)
    this.turtlePaintMeshes = [];

    g.visible = false; g.renderOrder = 3;
    this.turtleGroup = g;
    this.scene.add(g);
  }

  _updateTurtle(sim) {
    const g = this.turtleGroup;
    const t = (sim && !sim.ended && !sim.bossWon) ? sim.turtle : null;
    if (!t) { if (g.visible) g.visible = false; return; }
    g.visible = true;
    const cx = 0;
    const shellY = t.leaving ? t.leaveY : t.shellY;
    g.position.set(cx, this.worldY(shellY), 0.4);
    const span = this.laneCount * this._laneW() * 0.92;
    g.scale.setScalar(span);
    // only the shell plate spins; the body/flippers hold station
    this.turtleShell.rotation.z = t.spinAngle || 0;
    this.turtleBody.rotation.z = Math.sin(this.time * 1.1) * 0.015; // faint idle sway

    // paint splotches — ride the shell's front rim (sim.spots owns lane + rim y)
    const spots = (sim.spots || []).filter((s) => s && s.alive !== false);
    while (this.turtleSpotMeshes.length < spots.length) {
      const idx = this.turtleSpotMeshes.length;
      const m = new THREE.Mesh(this.turtleSpotPlane, new THREE.MeshBasicMaterial({
        map: this.turtleSplatTex[idx % this.turtleSplatTex.length], transparent: true, depthWrite: false }));
      m.renderOrder = 4; m.rotation.z = (idx * 1.7) % (Math.PI * 2);
      this.turtleGroup.add(m); this.turtleSpotMeshes.push(m);
    }
    for (let i = 0; i < this.turtleSpotMeshes.length; i++) {
      const m = this.turtleSpotMeshes[i];
      const s = spots[i];
      if (!s) { m.visible = false; continue; }
      m.visible = true;
      m.material.color.setHex(COLORS[s.color] ? COLORS[s.color].hex : 0xffffff);
      const lx = this.worldX(s.px != null ? s.px : s.lane) / span;
      const ly = (this.worldY(s.y) - this.worldY(shellY)) / span;
      m.position.set(lx, ly, 0.05);
      const sc = 0.185 + 0.03 * Math.sin(i * 2.1);
      m.scale.set(sc, sc, sc);
    }

    // head (the hittable head lives on sim.turtleHead when it's out)
    const head = this.turtleHeadMesh;
    const hEnemy = sim.turtleHead;
    head.visible = !!t.headOut && !!hEnemy && !t.leaving;
    if (head.visible) {
      head.material.color.setHex(COLORS[hEnemy.color] ? COLORS[hEnemy.color].hex : 0xffffff);
      head.rotation.z = 0;
      head.position.set(this.worldX(hEnemy.lane) / span, (this.worldY(hEnemy.y) - this.worldY(shellY)) / span, 0.08);
    }
    if (t.leaving) {
      head.visible = true; head.material.color.setHex(0x5aa832);
      head.rotation.z = Math.PI; // snout up as he swims away
      head.position.set(0, 0.62, 0.08);
    }

    // phase-3 paint projectiles
    const paint = t.paint || [];
    while (this.turtlePaintMeshes.length < paint.length) {
      const m = new THREE.Mesh(this.turtleSpotPlane, new THREE.MeshBasicMaterial({
        map: this.turtleSplatTex[this.turtlePaintMeshes.length % this.turtleSplatTex.length], transparent: true, depthWrite: false }));
      m.renderOrder = 6; this.scene.add(m); this.turtlePaintMeshes.push(m);
    }
    for (let i = 0; i < this.turtlePaintMeshes.length; i++) {
      const m = this.turtlePaintMeshes[i];
      const pt = paint[i];
      if (!pt) { m.visible = false; continue; }
      m.visible = true;
      m.material.color.setHex(COLORS[pt.color] ? COLORS[pt.color].hex : 0xffffff);
      m.position.set(this.worldX(Math.max(0, Math.min(this.laneCount - 1, pt.x))), this.worldY(pt.y), 1.4);
      m.rotation.z = this.time * 2 + i;
      const sc = 0.55 + 0.12 * Math.sin(this.time * 10 + i);
      m.scale.set(sc, sc, sc);
    }
  }

  _buildShark() {
    this.sharkGeo = buildSharkGeometry();
    this.sharkMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.sharkMeshes = new Map(); // shark id -> mesh
  }

  _buildSquid() {
    // Build the squid as a Group so its arms can be animated (grabbing fish).
    const g = new THREE.Group();
    const body = new THREE.Color(0x9a4fd0);
    const bodyMat = new THREE.MeshLambertMaterial({ color: body, side: THREE.DoubleSide });
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0x1a1030 });

    // Long tapered mantle: pointed at the top (posterior), opening at the head.
    const wx = (s) => 0.34 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(s, 0.7))), 0.6);
    const wz = (s) => 0.26 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(s, 0.7))), 0.6);
    const mb = buildSquidMantle(wx, wz);
    const mantle = new THREE.Mesh(mb, bodyMat);
    g.add(mantle);

    // Two triangular fins near the top (posterior) of the mantle.
    for (const sgn of [1, -1]) {
      const fin = triGeoMesh([[0, 0.72, 0], [sgn * 0.55, 0.95, 0], [sgn * 0.08, 0.42, 0]], bodyMat);
      g.add(fin);
    }
    // Head bulge + two big eyes at the base of the mantle.
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), bodyMat);
    head.scale.set(1.0, 0.7, 0.8); head.position.y = -0.5; g.add(head);
    for (const sgn of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), eyeMat);
      eye.position.set(sgn * 0.2, -0.46, 0.22); g.add(eye);
    }

    // Arms: 8 shorter arms + 2 long tentacles, hanging from the head. Kept in an
    // array so we can bend them toward prey when the squid eats.
    this.squidArms = [];
    const armGeo = new THREE.CapsuleGeometry(0.05, 0.8, 3, 6);
    const tentGeo = new THREE.CapsuleGeometry(0.045, 1.35, 3, 6);
    const N = 8;
    for (let i = 0; i < N; i++) {
      const frac = (i / (N - 1) - 0.5);          // -0.5..0.5
      const arm = new THREE.Mesh(armGeo, bodyMat);
      const pivot = new THREE.Group();
      pivot.position.set(frac * 0.34, -0.62, 0.05);
      arm.position.y = -0.42;                     // hang below the pivot
      pivot.rotation.z = -frac * 0.7;             // fan outward
      pivot.add(arm);
      pivot.userData = { rest: pivot.rotation.z, restLen: 1, x: frac * 0.34 };
      g.add(pivot);
      this.squidArms.push(pivot);
    }
    for (const sgn of [1, -1]) {                  // two long feeding tentacles
      const t = new THREE.Mesh(tentGeo, bodyMat);
      const pivot = new THREE.Group();
      pivot.position.set(sgn * 0.12, -0.62, 0.02);
      t.position.y = -0.72;
      pivot.rotation.z = -sgn * 0.12;
      pivot.add(t);
      pivot.userData = { rest: pivot.rotation.z, restLen: 1, x: sgn * 0.12, long: true };
      g.add(pivot);
      this.squidArms.push(pivot);
    }

    g.visible = false;
    g.renderOrder = 3;
    this.squidGroup = g;
    this.squidGrabs = [];   // active grab animations
    this.scene.add(g);
  }

  _buildLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(0.3, 1, 0.8);
    this.scene.add(dir);
  }

  _buildBackground() {
    // vertical water gradient quad
    const geo = new THREE.PlaneGeometry(40, H * 1.4);
    const colTop = new THREE.Color(0x0a3a66);
    const colBot = new THREE.Color(0x0c6a8f);
    const colors = [];
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y + H * 0.7) / (H * 1.4);
      _c.copy(colBot).lerp(colTop, t);
      colors.push(_c.r, _c.g, _c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const bg = new THREE.Mesh(geo, mat);
    bg.position.set(0, H / 2, -5);
    this.scene.add(bg);

    // seabed strip
    const seaGeo = new THREE.PlaneGeometry(40, H * 0.15);
    const seaMat = new THREE.MeshBasicMaterial({ color: 0xcdb681 });
    this.seabed = new THREE.Mesh(seaGeo, seaMat);
    this.seabed.position.set(0, H * 0.075, -4);
    this.scene.add(this.seabed);

    // bubbles
    const N = 80;
    const bpos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      bpos[i * 3] = (Math.random() - 0.5) * 20;
      bpos[i * 3 + 1] = Math.random() * H;
      bpos[i * 3 + 2] = -3 - Math.random() * 2;
    }
    const bgeo = new THREE.BufferGeometry();
    bgeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3));
    const bmat = new THREE.PointsMaterial({ color: 0xbfe8ff, size: 0.12, transparent: true, opacity: 0.4, depthWrite: false });
    this.bubbles = new THREE.Points(bgeo, bmat);
    this.bubbleData = bpos;
    this.scene.add(this.bubbles);

    // light rays (additive)
    this.rays = [];
    for (let i = 0; i < 3; i++) {
      const rg = new THREE.PlaneGeometry(1.4, H * 1.3);
      const rm = new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false });
      const r = new THREE.Mesh(rg, rm);
      r.position.set(-4 + i * 4, H / 2, -4.5);
      r.rotation.z = 0.2;
      this.scene.add(r);
      this.rays.push(r);
    }
  }

  _buildFishMesh() {
    this.atlas = buildPatternAtlas();
    const geo = buildFishGeometry();
    const aData = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);
    geo.setAttribute('aData', aData);
    this.aData = aData;

    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = { value: 0 };
      sh.uniforms.uPattern = { value: this.atlas };
      this._fishUniforms = sh.uniforms;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec4 aData;
          varying float vPattern; varying float vFlag; varying vec2 vUvF;
          uniform float uTime;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vPattern = aData.z; vFlag = aData.w; vUvF = uv;
          float _phase = aData.x; float _spd = max(aData.y, 0.2);
          float _amp = 0.14 * clamp(0.2 - transformed.y, 0.0, 1.0);
          transformed.x += sin(uTime * 6.0 * _spd + _phase + transformed.y * 3.0) * _amp;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying float vPattern; varying float vFlag; varying vec2 vUvF;
          uniform sampler2D uPattern;
          uniform float uTime;
          vec3 hue2rgb(float h){
            vec3 k = vec3(1.0, 2.0/3.0, 1.0/3.0);
            vec3 p = abs(fract(vec3(h) + k) * 6.0 - 3.0);
            return clamp(p - 1.0, 0.0, 1.0);
          }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          if (vFlag > 0.5) {
            diffuseColor.rgb = hue2rgb(fract(uTime * 0.25 + vUvF.y));
          }
          if (vPattern > 0.5) {
            float col = mod(vPattern, 4.0) * 0.25;
            float row = vPattern < 4.0 ? 0.5 : 0.0;
            vec2 uv2 = vec2(col, row) + fract(vUvF) * vec2(0.25, 0.5);
            float mask = texture2D(uPattern, uv2).a;
            diffuseColor.rgb *= (1.0 - mask * 0.55);
          }
          // two eyes near the head — the fish's own colour, just a little darker
          float _e = min(length((vUvF - vec2(0.17, 0.84)) * vec2(1.0, 0.5)),
                         length((vUvF - vec2(0.33, 0.84)) * vec2(1.0, 0.5)));
          diffuseColor.rgb *= mix(1.0, 0.62, smoothstep(0.05, 0.03, _e));`);
    };
    this.fishMat = mat;
    this.fishMesh = new THREE.InstancedMesh(geo, mat, CAP);
    this.fishMesh.frustumCulled = false;
    this.fishMesh.count = 0;
    this.scene.add(this.fishMesh);
  }

  _buildTriPrototype() {
    this.triGeo = buildTriGeometry();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.W = H * aspect;
    this.camera.left = -this.W / 2;
    this.camera.right = this.W / 2;
    this.camera.top = H;
    this.camera.bottom = 0;
    this.camera.updateProjectionMatrix();
  }

  setLevel(laneCount) { this.laneCount = laneCount; }

  // ---- coordinate mapping (shared with input via metrics) ----------------
  worldX(lane) {
    const playW = this.W * (1 - 2 * MARGIN);
    const left = -this.W / 2 + this.W * MARGIN;
    return left + (lane + 0.5) * (playW / this.laneCount);
  }
  worldY(y01) { return y01 * H; }

  // pointer(clientX) -> lane index using same margins as worldX
  laneAtClientX(clientX) {
    const rect = this.canvas.getBoundingClientRect();
    const fx = (clientX - rect.left) / rect.width;   // 0..1
    const inner = (fx - MARGIN) / (1 - 2 * MARGIN);
    if (inner < 0 || inner > 1) return -1;
    const lane = Math.floor(inner * this.laneCount);
    return Math.max(0, Math.min(this.laneCount - 1, lane));
  }
  isInDrawStrip(clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const fy = (clientY - rect.top) / rect.height; // 0 top .. 1 bottom
    return fy > (1 - FIELD.drawStripTop);
  }
  // Field-space y (0 bottom .. 1 top) for a screen clientY — used to aim the
  // Ambush Shark at a row in the open ocean.
  fieldYAtClientY(clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const fy = (clientY - rect.top) / rect.height;
    return Math.max(0.08, Math.min(0.95, 1 - fy));
  }

  // ---- event handling ----------------------------------------------------
  handleEvents(events, sim) {
    for (const e of events) {
      if (e.type === 'friendPair') {
        this._spawnSwimoff(e.lane, e.colorA, e.colorB);
        this.floaters.spawn(this.worldX(e.lane), this.worldY(e.y || 0.5), 1, '+1');
      } else if (e.type === 'fishKilled') {
        const hex = e.color ? COLORS[e.color].hex : 0xffffff;
        this.fx.spawn(this.worldX(e.lane), this.worldY(0.5), 0.5, hex, { count: 16, speed: 0.9 });
      } else if (e.type === 'leak') {
        this.fx.spawn(this.worldX(e.lane), this.worldY(0.06), 0.5, 0xff5a5a, { count: 20, up: 0.8, speed: 1.0 });
        this.floaters.spawn(this.worldX(e.lane), this.worldY(0.12), 1, '-1');
      } else if (e.type === 'weave') {
        this.fx.spawn(this.worldX(e.lane), this.worldY(0.5), 0.5, 0xbfe8ff, { count: 4, speed: 0.3, size: 5 });
      } else if (e.type === 'transform') {
        this.fx.spawn(this.worldX(e.lane), this.worldY(0.5), 0.5, 0xffffff, { count: 14, speed: 0.8 });
        this.floaters.spawn(this.worldX(e.lane), this.worldY(0.5), 1, '+1');
      } else if (e.type === 'sharkEat') {
        this.fx.spawn(this.worldX(e.lane), this.worldY(0.5), 0.5, 0xffffff, { count: 18, speed: 1.1 });
        this.floaters.spawn(this.worldX(e.lane), this.worldY(0.5), 1, '+' + e.value);
      } else if (e.type === 'squidEat') {
        this.fx.spawn(this.worldX(e.lane), this.worldY(0.5), 0.5, 0x7a4fb0, { count: 10, speed: 0.6 });
        this._squidGrab(e.lane);
        if (e.scored) this.floaters.spawn(this.worldX(e.lane), this.worldY(0.5), 1, '+1');
      } else if (e.type === 'wastePenalty') {
        this.fx.spawn(this.worldX(e.lane), this.worldY(0.98), 0.5, 0xff8a5a, { count: 10, up: 0.4, speed: 0.5 });
        this.floaters.spawn(this.worldX(e.lane), this.worldY(0.94), 1, '-1');
      } else if (e.type === 'launch') {
        for (const l of e.lanes) this.fx.spawn(this.worldX(l), this.worldY(FIELD.launchY), 0.5, 0xbfe8ff, { count: 5, up: 0.5, speed: 0.4, size: 5 });
      } else if (e.type === 'coralBlockPlayer') {
        this.fx.spawn(this.worldX(e.lane), this.worldY(e.y || 0.5), 0.6, 0xff9ab0, { count: 6, speed: 0.5, size: 6 });
      } else if (e.type === 'currentPush') {
        this.fx.spawn(this.worldX(e.lane), this.worldY(0.5), 0.6, 0x9fdcff, { count: 3, speed: 0.3, size: 5, life: 0.3 });
      } else if (e.type === 'anemoneShift') {
        const hex = e.to && COLORS[e.to] ? COLORS[e.to].hex : 0xa970ff;
        this.fx.spawn(this.worldX(e.lane), this.worldY(0.5), 0.6, hex, { count: 12, speed: 0.7, size: 6 });
        if (!e.player) this.floaters.spawn(this.worldX(e.lane), this.worldY(0.5), 1, '✦');
      } else if (e.type === 'prismPass') {
        this.fx.spawn(this.worldX(e.lane), this.worldY(0.4), 0.6, 0xffffff, { count: 8, speed: 0.6, size: 5 });
      } else if (e.type === 'bossHit') {
        const wy = this.whaleGroup && this.whaleGroup.visible ? this.whaleGroup.position.y : this.worldY(0.6);
        this.fx.spawn(this.worldX(e.lane), wy, 0.6, 0xffef9a, { count: 10, speed: 0.9 });
        this.floaters.spawn(this.worldX(e.lane), wy, 1, '-1');
      } else if (e.type === 'bossSplitBreak') {
        const wy = this.whaleGroup && this.whaleGroup.visible ? this.whaleGroup.position.y : this.worldY(0.6);
        this.fx.spawn(this.whaleGroup.position.x, wy, 0.7, 0xfff0a0, { count: 16, speed: 1.1 });
      } else if (e.type === 'bossSideHit') {
        const wy = this.whaleGroup && this.whaleGroup.visible ? this.whaleGroup.position.y : this.worldY(0.6);
        this.fx.spawn(this.worldX(e.lane), wy, 0.5, 0xbfe8ff, { count: 5, speed: 0.5, size: 5 });
      } else if (e.type === 'bossDefeated') {
        for (let i = 0; i < 6; i++) this.fx.spawn(this.worldX(Math.floor(this.laneCount / 2)) + (Math.random() - 0.5) * 2, this.worldY(0.4), 0.8, 0xffe37a, { count: 22, speed: 1.4, life: 1.1 });
      } else if (e.type === 'turtleSpotClear') {
        const hex = e.color && COLORS[e.color] ? COLORS[e.color].hex : 0xffffff;
        const y = e.y != null ? e.y : 0.82;
        this.fx.spawn(this.worldX(e.lane), this.worldY(y), 0.7, hex, { count: 14, speed: 0.85, size: 6, life: 0.55 });
        this.floaters.spawn(this.worldX(e.lane), this.worldY(y), 1, '✦');
      }
    }
  }

  _spawnSwimoff(lane, colorA, colorB) {
    const x = this.worldX(lane);
    const y = this.worldY(0.5);
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.swimoffs.push({
      t: 0, life: 1.1,
      fish: [
        { x: x - 0.15, y, vx: dir * SPEED.friendSwimOff * 6, vy: 1.2, color: colorA },
        { x: x + 0.15, y, vx: dir * SPEED.friendSwimOff * 6, vy: 1.4, color: colorB },
      ],
    });
  }

  // ---- per-frame update --------------------------------------------------
  update(dt, sim) {
    this.time += dt;
    if (this._fishUniforms) this._fishUniforms.uTime.value = this.time;

    // background motion
    for (let i = 0; i < this.bubbleData.length / 3; i++) {
      this.bubbleData[i * 3 + 1] += dt * 0.6;
      if (this.bubbleData[i * 3 + 1] > H) this.bubbleData[i * 3 + 1] = 0;
    }
    this.bubbles.geometry.attributes.position.needsUpdate = true;
    for (const r of this.rays) r.material.opacity = 0.05 + 0.02 * Math.sin(this.time * 0.5 + r.position.x);

    // advance swimoffs
    for (const so of this.swimoffs) {
      so.t += dt;
      for (const f of so.fish) { f.x += f.vx * dt; f.y += f.vy * dt; }
    }
    this.swimoffs = this.swimoffs.filter((so) => so.t < so.life);

    this._writeInstances(sim);
    this._updateTri(sim);
    this._updateSharks(sim);
    this._updateSquid(sim);
    this._updateCurrents(sim);
    this._updateCoral(sim);
    this._updateAnemone(sim);
    this._updateWhale(sim);
    this._updateTurtle(sim);
    this.fx.update(dt);
    this.floaters.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  _updateCurrents(sim) {
    const cur = (sim && !sim.ended) ? (sim.currents || []) : [];
    for (let i = 0; i < this.currentBands.length; i++) {
      const band = this.currentBands[i];
      const c = cur[i];
      if (!c) { band.visible = false; continue; }
      band.visible = true;
      band.position.y = this.worldY(c.rowY);
      band.material.uniforms.uTime.value = this.time;
      band.material.uniforms.uDir.value = sim.currentDir(c);
    }
  }

  _updateCoral(sim) {
    const coral = (sim && !sim.ended) ? sim.coral : null;
    if (!coral) {
      if (this.coralGroup.visible) {
        // disintegrate burst on the way out
        this.fx.spawn(this.coralGroup.position.x, this.coralGroup.position.y, 0.6, 0xff8fae, { count: 24, speed: 1.2, life: 0.9 });
        this.coralGroup.visible = false;
        this.coralX = null;
      }
      return;
    }
    const targetX = this.worldX(coral.lane);
    if (this.coralX === null) this.coralX = targetX;
    else this.coralX += (targetX - this.coralX) * Math.min(1, 0.15); // slide to new lane
    this.coralGroup.visible = true;
    this.coralGroup.position.set(this.coralX, this.worldY(coral.rowY), 0.5);
    this.coralGroup.rotation.y = this.time * 0.3;
  }

  _updateAnemone(sim) {
    const an = (sim && !sim.ended) ? sim.anemone : null;
    if (!an) { if (this.anemoneGroup.visible) { this.anemoneGroup.visible = false; this.anemoneX = null; } return; }
    const targetX = this.worldX(an.lane);
    if (this.anemoneX === null) this.anemoneX = targetX;
    else this.anemoneX += (targetX - this.anemoneX) * Math.min(1, 0.18);
    this.anemoneGroup.visible = true;
    this.anemoneGroup.position.set(this.anemoneX, this.worldY(an.rowY), 0.5);
    // sway the tentacles
    for (const t of this.anemoneTentacles) {
      t.rotation.z = Math.sin(this.time * 2.0 + t.userData.phase) * 0.35;
    }
  }

  // lane pitch in world units
  _laneW() { return this.W * (1 - 2 * MARGIN) / this.laneCount; }

  _updateSharks(sim) {
    const seen = new Set();
    const laneW = this._laneW();
    if (sim && !sim.ended) {
      for (const sh of sim.sharks) {
        seen.add(sh.id);
        let mesh = this.sharkMeshes.get(sh.id);
        if (!mesh) {
          mesh = new THREE.Mesh(this.sharkGeo, this.sharkMat);
          mesh.frustumCulled = false;
          mesh.renderOrder = 2;
          this.scene.add(mesh);
          this.sharkMeshes.set(sh.id, mesh);
        }
        if (sh.horizontal) {
          // Ambush shark: aim along its row, nose in the travel direction.
          const scale = (2.2 * laneW) / 1.5;
          mesh.position.set(this.worldX(sh.x), this.worldY(sh.rowY), 1.2);
          mesh.scale.setScalar(scale);
          mesh.rotation.z = (sh.dir >= 0 ? -Math.PI / 2 : Math.PI / 2)
            + Math.sin(this.time * 8) * 0.05;
          continue;
        }
        // centre across its (usually 3) lanes; scale to span them.
        const mid = (sh.lanes[0] + sh.lanes[sh.lanes.length - 1]) / 2;
        const cx = this.worldX(mid);
        const span = sh.lanes.length * laneW;
        const scale = span / 1.5; // shark geom is ~1.5 units wide
        mesh.position.set(cx, this.worldY(sh.y), 1.2);
        mesh.scale.setScalar(scale);
        // gentle body sway
        mesh.rotation.z = Math.sin(this.time * 4 + sh.id) * 0.05;
      }
    }
    for (const [id, mesh] of this.sharkMeshes) {
      if (!seen.has(id)) { this.scene.remove(mesh); this.sharkMeshes.delete(id); }
    }
  }

  _updateSquid(sim) {
    const active = sim && !sim.ended && sim.effects && sim.effects.squid.active;
    this.squidGroup.visible = !!active;
    if (!active) { this.squidGrabs.length = 0; return; }
    const laneW = this._laneW();
    const interior = Math.max(1, this.laneCount - 2);
    const scale = Math.min((interior * laneW) / 2.6, 1.6);
    // position the head/mouth near the eat line; mantle rises above, arms hang below.
    const cx = 0;
    const mouthY = this.worldY(sim.squidY);
    const cy = mouthY + 0.5 * scale;
    this.squidScale = scale;
    this.squidMouth = mouthY;
    this.squidGroup.position.set(cx, cy, 1.6);
    this.squidGroup.scale.setScalar(scale);
    this.squidGroup.rotation.z = Math.sin(this.time * 1.2) * 0.02;

    // idle arm sway
    for (const arm of this.squidArms) {
      const sway = Math.sin(this.time * 2 + arm.userData.x * 6) * 0.08;
      arm.rotation.z = arm.userData.rest + sway - (arm.userData.grab || 0);
      arm.scale.y = 1 + (arm.userData.stretch || 0);
    }

    // advance active grabs: an arm whips toward the eaten fish, a little fish
    // blob is dragged up into the mouth, then the arm relaxes.
    for (const grab of this.squidGrabs) {
      grab.t += 0.06;
      const arm = grab.arm;
      const reach = Math.sin(Math.min(Math.PI, grab.t * Math.PI)); // 0..1..0
      // aim the arm's angle toward the prey x (in the group's local frame)
      const localX = (grab.x - cx) / scale;
      const aim = Math.atan2(localX - arm.userData.x, 1.2) * 0.9;
      arm.userData.grab = (arm.userData.rest - aim) * reach;
      arm.userData.stretch = reach * (arm.userData.long ? 0.5 : 0.35);
      // drag the captured fish blob from its spot into the mouth
      if (grab.blob) {
        const p = Math.min(1, grab.t);
        const my = this.squidMouth != null ? this.squidMouth : (cy - 0.4 * scale);
        grab.blob.position.set(
          grab.x + (cx - grab.x) * p,
          grab.y + (my - grab.y) * p,
          1.7);
        grab.blob.scale.setScalar((1 - p) * 0.5 * scale + 0.05);
        grab.blob.material.opacity = 1 - p;
      }
    }
    // retire finished grabs
    for (const grab of this.squidGrabs) {
      if (grab.t >= 1 && grab.blob) { this.scene.remove(grab.blob); grab.blob.geometry.dispose(); grab.blob.material.dispose(); grab.blob = null; }
    }
    this.squidGrabs = this.squidGrabs.filter((g) => g.t < 1.05);
    for (const arm of this.squidArms) { if (!this.squidGrabs.some((g) => g.arm === arm)) { arm.userData.grab = (arm.userData.grab || 0) * 0.8; arm.userData.stretch = (arm.userData.stretch || 0) * 0.8; } }
  }

  // Called on a squidEat event: start a grab animation for the eaten fish.
  _squidGrab(lane) {
    if (!this.squidArms || !this.squidArms.length) return;
    const x = this.worldX(lane);
    const y = this.worldY(0.62);
    // choose the nearest free-ish arm to the prey lane
    let best = this.squidArms[0], bestD = Infinity;
    for (const arm of this.squidArms) {
      const ax = this.squidGroup.position.x + arm.userData.x * (this.squidScale || 1);
      const d = Math.abs(ax - x) + (this.squidGrabs.some((g) => g.arm === arm) ? 5 : 0);
      if (d < bestD) { best = arm; bestD = d; }
    }
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 1 }));
    blob.position.set(x, y, 1.7);
    this.scene.add(blob);
    this.squidGrabs.push({ arm: best, x, y, t: 0, blob });
  }

  _writeInstances(sim) {
    let idx = 0;
    const mesh = this.fishMesh;
    const writeFish = (x, y, z, colorId, patternId, phase, spd, rainbow, faceUp, scale) => {
      if (idx >= CAP) return;
      _p.set(x, y, z);
      _q.copy(faceUp ? _qUp : _qDown);
      _s.setScalar(scale || 0.62);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(idx, _m);
      if (rainbow) _c.set(0xffffff); else _c.set(colorId != null ? COLORS[colorId] ? COLORS[colorId].hex : colorId : 0xffffff);
      mesh.setColorAt(idx, _c);
      this.aData.setXYZW(idx, phase, spd, rainbow ? 0 : patternId, rainbow ? 1 : 0);
      idx++;
    };

    if (sim && !sim.ended) {
      for (const e of sim.enemies) {
        if (e.kind === 'tri' || e.kind === 'boss') continue; // tri + whale drawn separately
        let colorId, patternId = 0, scale = 0.62;
        if (e.kind === 'white') {
          if (e.phase === 0) { colorId = 0xf2f6ff; patternId = 0; scale = 0.66; }
          else { colorId = e.color; patternId = patternForColor[e.color] || 0; }
        } else if (e.kind === 'black') {
          if (e.phase === 0) { colorId = 0x222630; patternId = 0; scale = 0.66; }
          else { colorId = e.color; patternId = patternForColor[e.color] || 0; }
        } else {
          colorId = e.color; patternId = patternForColor[e.color] || 0;
        }
        const tx = this.worldX(e.lane);
        if (e._rx === undefined) e._rx = tx; else e._rx += (tx - e._rx) * 0.25;
        writeFish(e._rx, this.worldY(e.y), 0, colorId, patternId, e.id * 0.7, this.enemyWag(e), false, false, scale);
      }
      for (const p of sim.players) {
        const rainbow = p.color === 'rainbow';
        const patternId = rainbow ? 0 : (patternForColor[p.color] || 0);
        writeFish(this.worldX(p.lane), this.worldY(p.y), 0, p.color, patternId, p.id * 0.7, 1.2, rainbow, true, 0.6);
      }
    }

    // swimoff friend pairs (visual only)
    for (const so of this.swimoffs) {
      const fade = 1 - so.t / so.life;
      for (const f of so.fish) {
        writeFish(f.x, f.y, 1, f.color, patternForColor[f.color] || 0, 3.0, 2.0, false, f.vy > 0, 0.6 * Math.max(0.3, fade));
      }
    }

    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.aData.needsUpdate = true;
  }

  enemyWag(e) {
    let s = 1.0;
    if (e.kind === 'white' && e.phase === 0) s *= 0.6;
    if (e.kind === 'tri') s *= 0.8;
    return s;
  }

  _updateTri(sim) {
    const seen = new Set();
    if (sim && !sim.ended) {
      for (const e of sim.enemies) {
        if (e.kind !== 'tri') continue;
        seen.add(e.id);
        let t = this.triFish.get(e.id);
        if (!t) {
          const geo = this.triGeo.clone();
          this._paintTriBands(geo, e.bands, e.phase);
          const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.quaternion.copy(_qDown);
          mesh.scale.setScalar(0.66);
          this.scene.add(mesh);
          t = { mesh, geo, phase: e.phase };
          this.triFish.set(e.id, t);
        }
        if (t.phase !== e.phase) { this._paintTriBands(t.geo, e.bands, e.phase); t.phase = e.phase; }
        const txr = this.worldX(e.lane);
        if (e._rx === undefined) e._rx = txr; else e._rx += (txr - e._rx) * 0.25;
        t.mesh.position.set(e._rx, this.worldY(e.y), 0);
      }
    }
    for (const [id, t] of this.triFish) {
      if (!seen.has(id)) { this.scene.remove(t.mesh); t.geo.dispose(); t.mesh.material.dispose(); this.triFish.delete(id); }
    }
  }

  _paintTriBands(geo, bands, phase) {
    // color body vertices by Y into 3 bands (front=head faces -Y after rotation,
    // so front band = highest local Y). Peeled bands render dim.
    const pos = geo.attributes.position;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y; }
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) - minY) / (maxY - minY + 1e-6); // 0 tail .. 1 head
      let bandIdx = t > 0.66 ? 0 : (t > 0.33 ? 1 : 2); // 0 = head/front
      let colId = bands[bandIdx];
      let dim = bandIdx < phase ? 0.25 : 1.0;
      _c.set(COLORS[colId].hex).multiplyScalar(dim);
      colors[i * 3] = _c.r; colors[i * 3 + 1] = _c.g; colors[i * 3 + 2] = _c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  // draw ghost preview during drag (lightweight: reuse particles as markers)
  showGhosts(lanes, colorId) {
    for (const l of lanes) {
      this.fx.spawn(this.worldX(l), this.worldY(FIELD.launchY + 0.02), 0.6,
        colorId ? (COLORS[colorId] ? COLORS[colorId].hex : 0xffffff) : 0xffffff,
        { count: 2, speed: 0.05, size: 6, life: 0.15 });
    }
  }
}
