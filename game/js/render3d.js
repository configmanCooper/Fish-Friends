// render3d.js — three.js presentation. Reads sim state + events, draws the scene.
// One instanced mesh for all normal/white/black/player fish; tri fish are a small
// non-instanced group. Friend pairs swim off-screen together on a correct meeting.
import * as THREE from './vendor/three.module.js';
import { buildFishGeometry, buildTriGeometry, buildPatternAtlas, patternUvOffset, buildSharkGeometry, buildSquidGeometry } from './fish_models.js';
import { ParticleFX, Floaters } from './fx.js';
import { COLORS, SPEED, FIELD } from './config.js';

const H = 10;                 // world height for y in [0,1]
const MARGIN = 0.05;          // side margin fraction of field width
const CAP = 256;              // instanced fish capacity

const patternForColor = {};   // colorId -> patternId (0 blank,1 stripes,2 dots,3 chevrons)
// stripes for blue/orange, dots for red/green, chevrons for yellow/purple
patternForColor.blue = 1; patternForColor.orange = 1;
patternForColor.red = 2; patternForColor.green = 2;
patternForColor.yellow = 3; patternForColor.purple = 3;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const _qUp = new THREE.Quaternion();       // player facing up (identity)
const _qDown = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI); // enemy facing down

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
    this.fx = new ParticleFX(this.scene);
    this.floaters = new Floaters(this.scene);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  _buildShark() {
    this.sharkGeo = buildSharkGeometry();
    this.sharkMat = new THREE.MeshLambertMaterial({ color: 0x8894a3, side: THREE.DoubleSide });
    this.sharkMeshes = new Map(); // shark id -> mesh
  }

  _buildSquid() {
    const geo = buildSquidGeometry();
    const mat = new THREE.MeshLambertMaterial({ color: 0x9a4fd0, transparent: true, opacity: 0.82, side: THREE.DoubleSide });
    this.squidMesh = new THREE.Mesh(geo, mat);
    this.squidMesh.visible = false;
    this.squidMesh.renderOrder = 3;
    this.scene.add(this.squidMesh);
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
            float col = mod(vPattern, 2.0) < 1.0 ? 0.0 : 0.5;
            float row = vPattern < 2.0 ? 0.5 : 0.0;
            vec2 uv2 = vec2(col, row) + fract(vUvF) * 0.5;
            float mask = texture2D(uPattern, uv2).a;
            diffuseColor.rgb *= (1.0 - mask * 0.55);
          }`);
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
      } else if (e.type === 'wastePenalty') {
        this.fx.spawn(this.worldX(e.lane), this.worldY(0.98), 0.5, 0xff8a5a, { count: 10, up: 0.4, speed: 0.5 });
        this.floaters.spawn(this.worldX(e.lane), this.worldY(0.94), 1, '-1');
      } else if (e.type === 'launch') {
        for (const l of e.lanes) this.fx.spawn(this.worldX(l), this.worldY(FIELD.launchY), 0.5, 0xbfe8ff, { count: 5, up: 0.5, speed: 0.4, size: 5 });
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
    this.fx.update(dt);
    this.floaters.update(dt);
    this.renderer.render(this.scene, this.camera);
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
    this.squidMesh.visible = !!active;
    if (!active) return;
    const laneW = this._laneW();
    const interior = Math.max(1, this.laneCount - 2);
    // scale to span the interior lanes horizontally (geom is ~2.5 wide), capped.
    const scale = Math.min((interior * laneW) / 2.5, 2.0);
    // position so the tentacle tips (geom y ~ -0.72) stay above the bottom strip.
    const TIP = 0.72;
    const bottomLimit = H * 0.32;      // never reach into the seabed / draw strip
    const posY = bottomLimit + TIP * scale;
    this.squidMesh.position.set(0, posY, 1.5);
    this.squidMesh.scale.setScalar(scale);
    // gentle tentacle bob
    this.squidMesh.rotation.z = Math.sin(this.time * 1.5) * 0.03;
    this.squidMesh.position.y += Math.sin(this.time * 1.2) * 0.05;
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
        if (e.kind === 'tri') continue;
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
        writeFish(this.worldX(e.lane), this.worldY(e.y), 0, colorId, patternId, e.id * 0.7, this.enemyWag(e), false, false, scale);
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
        t.mesh.position.set(this.worldX(e.lane), this.worldY(e.y), 0);
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
