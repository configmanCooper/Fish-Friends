// input.js — pointer -> lane math, drag/ghost state, cooldown-gated launch.
import { sfx } from './audio.js';

export class Input {
  constructor(canvas, render, game) {
    this.canvas = canvas;
    this.render = render;
    this.game = game;
    this.active = false;
    this.lanes = new Set();
    this.startedInStrip = false;
    this._bind();
  }

  _bind() {
    const c = this.canvas;
    const opts = { passive: false };
    c.addEventListener('pointerdown', (e) => this._down(e), opts);
    c.addEventListener('pointermove', (e) => this._move(e), opts);
    c.addEventListener('pointerup', (e) => this._up(e), opts);
    c.addEventListener('pointercancel', (e) => this._cancel(e), opts);
  }

  _down(e) {
    if (!this.game.isPlaying()) return;
    e.preventDefault();
    // Shark placement mode overrides normal drawing.
    if (this.game.pendingShark) {
      this.active = true;
      this._sharkMove(e);
      return;
    }
    this.startedInStrip = this.render.isInDrawStrip(e.clientY);
    if (!this.startedInStrip) return;
    this.active = true;
    this.lanes.clear();
    this._addLaneAt(e.clientX);
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
  }

  _move(e) {
    if (!this.active) return;
    e.preventDefault();
    if (this.game.pendingShark) { this._sharkMove(e); return; }
    if (!this.startedInStrip) return;
    this._addLaneAt(e.clientX);
    this.render.showGhosts([...this.lanes], this.game.selectedColor);
  }

  _addLaneAt(clientX) {
    const lane = this.render.laneAtClientX(clientX);
    if (lane < 0) return;
    if (!this.lanes.has(lane)) { this.lanes.add(lane); sfx.draw(); }
  }

  _sharkMove(e) {
    const lane = this.render.laneAtClientX(e.clientX);
    if (lane >= 0) this.game.sharkLane = lane;
    // Track the vertical tap position too — used to tell a beach placement (rising
    // shark) from an open-ocean placement (Ambush sweep).
    this.game.sharkRowY = this.render.fieldYAtClientY(e.clientY);
  }

  _up(e) {
    if (!this.active) return;
    e.preventDefault();
    this.active = false;
    if (this.game.pendingShark) {
      this.game.confirmShark();
      return;
    }
    if (!this.startedInStrip) return;
    const lanes = [...this.lanes].sort((a, b) => a - b);
    this.lanes.clear();
    if (lanes.length === 0) return;
    this.game.tryLaunch(lanes);
  }

  _cancel() {
    this.active = false;
    this.lanes.clear();
  }
}
