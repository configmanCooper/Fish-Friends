// title_fish.js — small DOM canvas animation: two opposite-colored game-style
// fish chasing each other in a tight circle (like the app icon), used to flank
// the title. Fish are drawn to match the in-game silhouette (spindle body,
// forked caudal tail, pectoral fins, pair pattern, eyes).
import { COLORS } from './config.js';

// pattern id -> draw a marking clipped to the body (matches the game's pairs)
function drawPattern(ctx, S, pattern) {
  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = '#10202c';
  ctx.fillStyle = '#10202c';
  ctx.lineWidth = S * 0.05;
  if (pattern === 0) {                     // stripes (blue/orange)
    for (let i = -2; i <= 2; i++) {
      const y = i * S * 0.16;
      ctx.beginPath(); ctx.moveTo(-S * 0.3, y); ctx.lineTo(S * 0.3, y); ctx.stroke();
    }
  } else if (pattern === 1) {               // dots (red/green)
    for (let r = -1; r <= 1; r++) for (let c = -1; c <= 1; c++) {
      ctx.beginPath(); ctx.arc(c * S * 0.16, r * S * 0.2, S * 0.05, 0, 7); ctx.fill();
    }
  } else {                                  // chevrons (yellow/purple) + others
    for (let i = -2; i <= 2; i++) {
      const y = i * S * 0.16;
      ctx.beginPath();
      ctx.moveTo(-S * 0.22, y - S * 0.07); ctx.lineTo(0, y); ctx.lineTo(S * 0.22, y - S * 0.07);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Draw one fish at the origin, nose pointing up (-y). S = overall scale (px).
function drawGameFish(ctx, S, hexCss, pattern) {
  // body (spindle: nose up at -0.62S, tail root at +0.55S, widest near middle)
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(0, -0.62 * S);
    ctx.bezierCurveTo(0.30 * S, -0.5 * S, 0.36 * S, 0.1 * S, 0.12 * S, 0.55 * S);
    ctx.bezierCurveTo(0.05 * S, 0.62 * S, -0.05 * S, 0.62 * S, -0.12 * S, 0.55 * S);
    ctx.bezierCurveTo(-0.36 * S, 0.1 * S, -0.30 * S, -0.5 * S, 0, -0.62 * S);
    ctx.closePath();
  };
  // caudal (forked tail) below the body
  ctx.fillStyle = hexCss;
  ctx.beginPath();
  ctx.moveTo(0.07 * S, 0.5 * S);
  ctx.lineTo(0.40 * S, 1.15 * S);
  ctx.lineTo(0, 0.86 * S);
  ctx.lineTo(-0.40 * S, 1.15 * S);
  ctx.lineTo(-0.07 * S, 0.5 * S);
  ctx.closePath(); ctx.fill();
  // pectoral fins (swept back, mid-body)
  ctx.beginPath();
  ctx.moveTo(0.28 * S, -0.02 * S); ctx.lineTo(0.60 * S, 0.16 * S); ctx.lineTo(0.30 * S, 0.24 * S);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-0.28 * S, -0.02 * S); ctx.lineTo(-0.30 * S, 0.24 * S); ctx.lineTo(-0.60 * S, 0.16 * S);
  ctx.closePath(); ctx.fill();
  // body fill + subtle shading
  const grd = ctx.createLinearGradient(-0.36 * S, 0, 0.36 * S, 0);
  grd.addColorStop(0, shade(hexCss, -0.16));
  grd.addColorStop(0.5, hexCss);
  grd.addColorStop(1, shade(hexCss, 0.12));
  ctx.fillStyle = grd; body(); ctx.fill();
  // pattern (clipped to body)
  ctx.save(); body(); ctx.clip(); drawPattern(ctx, S, pattern); ctx.restore();
  // eyes near the nose
  ctx.fillStyle = shade(hexCss, -0.5);
  ctx.beginPath(); ctx.arc(-0.12 * S, -0.4 * S, 0.055 * S, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(0.12 * S, -0.4 * S, 0.055 * S, 0, 7); ctx.fill();
  // outline
  ctx.strokeStyle = shade(hexCss, -0.3); ctx.lineWidth = S * 0.03; body(); ctx.stroke();
}

// lighten (>0) / darken (<0) a #rrggbb css color
function shade(css, amt) {
  const n = parseInt(css.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = amt < 0 ? 0 : 255, t = Math.abs(amt);
  r = Math.round(r + (f - r) * t); g = Math.round(g + (f - g) * t); b = Math.round(b + (f - b) * t);
  return `rgb(${r},${g},${b})`;
}

// Manages one canvas with two opposite-color fish orbiting in a tight circle.
class OrbitPair {
  constructor(canvas, colorA) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.a = COLORS[colorA];
    this.b = COLORS[this.a.opposite];
    this.ang = 0;
  }
  draw(t) {
    const ctx = this.ctx, W = this.canvas.width, Hc = this.canvas.height;
    ctx.clearRect(0, 0, W, Hc);
    const cx = W / 2, cy = Hc / 2;
    const rr = W * 0.20;      // orbit radius (tight)
    const S = W * 0.34;       // fish scale
    this.ang = t * 1.3;       // orbit speed (rad/s)
    const fish = [{ c: this.a, off: 0 }, { c: this.b, off: Math.PI }];
    for (const f of fish) {
      const th = this.ang + f.off;
      const x = cx + Math.cos(th) * rr;
      const y = cy + Math.sin(th) * rr;
      // velocity tangent (ccw): angle th + 90deg; fish is drawn nose-up (-y),
      // so rotate by th + 90deg to align the nose with travel.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(th + Math.PI / 2);
      drawGameFish(ctx, S, f.c.css, f.c.pattern);
      ctx.restore();
    }
  }
}

export class TitleFish {
  constructor() {
    this.pairs = [];
    this.running = false;
    this._raf = null;
    this._t0 = 0;
  }
  // Bind to the two title canvases; leftColor/rightColor pick each pair.
  mount(leftId, rightId, leftColor, rightColor) {
    const l = document.getElementById(leftId);
    const r = document.getElementById(rightId);
    this.pairs = [];
    if (l) this.pairs.push(new OrbitPair(l, leftColor));
    if (r) this.pairs.push(new OrbitPair(r, rightColor));
  }
  start() {
    if (this.running || !this.pairs.length) return;
    this.running = true;
    this._t0 = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const t = (now - this._t0) / 1000;
      for (const p of this.pairs) p.draw(t);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }
  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }
}
