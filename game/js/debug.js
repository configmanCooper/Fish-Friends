// debug.js — perf/debug overlay, toggled with ?debug=1.
export class Debug {
  constructor() {
    this.enabled = new URLSearchParams(location.search).has('debug');
    this.frames = 0;
    this.acc = 0;
    this.fps = 0;
    this.el = null;
    if (this.enabled) {
      this.el = document.createElement('div');
      this.el.id = 'debug-overlay';
      this.el.style.cssText = 'position:fixed;top:4px;left:4px;z-index:9999;font:11px monospace;color:#7fff9f;background:rgba(0,0,0,0.6);padding:4px 6px;border-radius:4px;white-space:pre;pointer-events:none;';
      document.body.appendChild(this.el);
    }
  }
  frame(dt, render, sim) {
    if (!this.enabled) return;
    this.frames++;
    this.acc += dt;
    if (this.acc >= 0.5) {
      this.fps = Math.round(this.frames / this.acc);
      this.frames = 0; this.acc = 0;
    }
    const info = render.renderer.info;
    const nEn = sim ? sim.enemies.length : 0;
    const nPl = sim ? sim.players.length : 0;
    this.el.textContent =
      `fps ${this.fps}\n` +
      `draws ${info.render.calls}\n` +
      `tris ${info.render.triangles}\n` +
      `enemies ${nEn} players ${nPl}\n` +
      (sim ? `score ${sim.score}/${sim.maxScore}` : '');
  }
}
