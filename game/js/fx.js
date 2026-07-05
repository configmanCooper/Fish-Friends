// fx.js — particle pool + floating score sprites (three.js layer).
import * as THREE from './vendor/three.module.js';

const SCRATCH = new THREE.Color();

export class ParticleFX {
  constructor(scene, cap = 1000) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.maxLife = new Float32Array(cap);
    this.size = new Float32Array(cap);
    this.col = new Float32Array(cap * 3);
    this.cursor = 0;

    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('pcolor', this.aCol);
    geo.setAttribute('psize', this.aSize);
    this.geo = geo;

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {},
      vertexShader: `
        attribute vec3 pcolor;
        attribute float psize;
        varying vec3 vCol;
        void main() {
          vCol = pcolor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(psize, 1.0, 26.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vCol;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float r = dot(d, d);
          if (r > 0.25) discard;
          float a = 1.0 - r * 4.0;
          gl_FragColor = vec4(vCol, a);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  spawn(x, y, z, hex, opts = {}) {
    const n = opts.count || 12;
    const spread = opts.spread || 0.5;
    const speed = opts.speed || 0.6;
    const life = opts.life || 0.7;
    const sz = opts.size || 12;
    SCRATCH.set(hex);
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.cap;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.vel[i * 3] = Math.cos(a) * sp * spread;
      this.vel[i * 3 + 1] = Math.sin(a) * sp * spread + (opts.up || 0);
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * sp * 0.3;
      this.life[i] = life * (0.7 + Math.random() * 0.6);
      this.maxLife[i] = this.life[i];
      this.size[i] = sz * (0.6 + Math.random() * 0.8);
      this.col[i * 3] = SCRATCH.r; this.col[i * 3 + 1] = SCRATCH.g; this.col[i * 3 + 2] = SCRATCH.b;
    }
  }

  update(dt) {
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) { if (this.size[i] !== 0) this.size[i] = 0; continue; }
      this.life[i] -= dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] -= 0.4 * dt; // slight gravity/sink
      const f = Math.max(0, this.life[i] / this.maxLife[i]);
      this.size[i] = this.size[i] * 0.98 + 0.02 * (f * this.size[i]);
    }
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aSize.needsUpdate = true;
  }
}

// Floating +1 / -1 / +2 / +3 sprites from pooled canvas textures.
export class Floaters {
  constructor(scene, cap = 40) {
    this.textures = {};
    for (const label of ['+1', '-1', '+2', '+3']) this.textures[label] = this._makeTex(label);
    this.pool = [];
    for (let i = 0; i < cap; i++) {
      const mat = new THREE.SpriteMaterial({ transparent: true, depthTest: false });
      const s = new THREE.Sprite(mat);
      s.visible = false;
      s.renderOrder = 10;
      s.scale.set(0.5, 0.25, 1);
      scene.add(s);
      this.pool.push({ sprite: s, life: 0, maxLife: 0 });
    }
    this.cursor = 0;
  }

  _makeTex(label) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    const neg = label.startsWith('-');
    ctx.fillStyle = neg ? '#ff5a5a' : '#ffe14a';
    ctx.strokeText(label, 64, 34);
    ctx.fillText(label, 64, 34);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  spawn(x, y, z, label) {
    const tex = this.textures[label] || this.textures['+1'];
    const item = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    item.sprite.material.map = tex;
    item.sprite.material.needsUpdate = true;
    item.sprite.position.set(x, y, z);
    item.sprite.visible = true;
    item.life = 1.0; item.maxLife = 1.0;
  }

  update(dt) {
    for (const it of this.pool) {
      if (it.life <= 0) { if (it.sprite.visible) it.sprite.visible = false; continue; }
      it.life -= dt;
      it.sprite.position.y += 0.35 * dt;
      const f = Math.max(0, it.life / it.maxLife);
      it.sprite.material.opacity = f;
      const sc = 0.5 * (1.1 - 0.2 * f);
      it.sprite.scale.set(sc, sc * 0.5, 1);
      if (it.life <= 0) it.sprite.visible = false;
    }
  }
}
