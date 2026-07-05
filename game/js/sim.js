// sim.js — the entire game logic. Pure JS: imports config/levels/rng only.
// No three.js, no DOM. Runs headless in Node for tests and autoplay bots.
// Emits events consumed by render/audio/ui.

import {
  FIELD, SPEED, COOLDOWN, LEVEL, POINTS, POWERUPS, INV_CAP,
  cooldownFor, opposite, isCounter, COLORS,
  ROW_YS, CURRENT, CORAL,
} from './config.js';
import { makeRng } from './rng.js';

let _nextId = 1;
function fid() { return _nextId++; }

// remaining point value of an enemy fish (for shark scoring / max sanity).
function remainingValue(f) {
  if (f.kind === 'tri') return 3 - f.phase;
  if (f.kind === 'white' || f.kind === 'black') return (f.phase === 0) ? 2 : 1;
  return 1;
}

// Front color of an enemy that a player must counter to make progress.
// Returns the enemy color that determines the required player color, or null
// if ANY color advances it (white/black at phase 0).
function requiredPlayerColor(f) {
  if (f.kind === 'normal') return opposite(f.color);
  if (f.kind === 'tri') return opposite(f.bands[f.phase]);
  if (f.kind === 'white') {
    if (f.phase === 0) return null;        // any color transforms
    return opposite(f.color);              // phase1: colored fish
  }
  if (f.kind === 'black') {
    if (f.phase === 0) return null;        // any color transforms
    return opposite(f.color);              // phase1: colored fish
  }
  return null;
}

// Does a player fish of `pColor` correctly act on enemy f? (rainbow always yes)
function playerActsOn(pColor, f) {
  if (pColor === 'rainbow') return true;
  const need = requiredPlayerColor(f);
  if (need === null) return true; // any color advances (white/black phase0)
  return pColor === need;
}

export class Sim {
  constructor(level, opts = {}) {
    this.level = level;
    this.endless = !!opts.endless;
    this.rng = makeRng((level.seed ^ 0x9e3779b9) >>> 0);
    this.time = 0;
    this.ended = false;
    this.score = 0;
    this.maxScore = level.maxScore;
    this.lanes = level.lanes;

    this.enemies = [];
    this.players = [];
    this.spawnCursor = 0;
    this.cooldownUntil = 0;
    this.lastCooldownLen = 0;

    // Power-up runtime state.
    this.effects = {
      ice: { active: false, until: 0 },
      rainbow: { active: false, until: 0 },
      squid: { active: false, until: 0 },
    };
    this.sharks = []; // active shark sweeps
    this.squidY = 0.52;

    this.events = [];
    this.leaks = 0;
    this.kills = 0;
    this.wastedFish = 0;   // player fish that escaped the top without a hit (2 => -1)
    this.squidEats = 0;    // squid eats accumulator (2 eaten => +1)

    this._initHazards();

    this._resolvedCount = 0; // scripted spawns that have been spawned
  }

  emit(type, data) { this.events.push({ t: this.time, type, ...data }); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  // ---- hazards: water currents + coral reef ------------------------------
  _initHazards() {
    // Water currents (horizontal push bands).
    this.currents = [];
    const nCur = this.level.currents || 0;
    if (nCur > 0) {
      const rows = this.rng.shuffle(CURRENT.candidateRows).slice(0, nCur);
      for (let i = 0; i < rows.length; i++) {
        this.currents.push({
          id: 'cur' + i,
          rowY: ROW_YS[rows[i]],
          baseDir: this.rng.chance(0.5) ? 1 : -1,
        });
      }
    }
    // Coral reef (single blocking cell).
    this.coral = null;
    if (this.level.coral) {
      const row = this.rng.pick(CORAL.candidateRows);
      this.coral = {
        lane: this.rng.int(0, this.lanes - 1),
        rowY: ROW_YS[row],
        _step: 0,
        moveDir: this.rng.chance(0.5) ? 1 : -1,
        gone: false,
      };
    }
  }

  // Effective current direction (flips every flipInterval seconds).
  currentDir(c) {
    const phase = Math.floor(this.time / CURRENT.flipInterval) % 2;
    return phase === 0 ? c.baseDir : -c.baseDir;
  }

  // Push enemy fish 1 lane as they cross a current band (once per fish per
  // current). Player fish you draw, sharks, and the squid are NOT affected.
  applyCurrents() {
    if (!this.currents.length) return;
    for (const c of this.currents) {
      const dir = this.currentDir(c);
      for (const f of this.enemies) this._maybePush(f, c, dir);
    }
  }
  _maybePush(f, c, dir) {
    if (!f.alive) return;
    if (Math.abs(f.y - c.rowY) > CURRENT.band) return;
    if (!f._pushed) f._pushed = new Set();
    if (f._pushed.has(c.id)) return;
    f._pushed.add(c.id);
    const nl = Math.max(0, Math.min(this.lanes - 1, f.lane + dir));
    if (nl !== f.lane) { f.lane = nl; this.emit('currentPush', { id: f.id, lane: nl, dir }); }
  }

  // Coral reef: move on a 10s cadence, disintegrate near the end, block fish.
  updateCoral() {
    const c = this.coral;
    if (!c) return;
    const dur = this.level.duration || LEVEL.duration;
    if (this.time >= dur - CORAL.disintegrateBefore) {
      this.coral = null;
      this.emit('coralGone', {});
      return;
    }
    const step = Math.floor(this.time / CORAL.moveInterval);
    if (step !== c._step) {
      c._step = step;
      // pick a direction that stays on the grid, then move one lane.
      if (c.lane <= 0) c.moveDir = 1;
      else if (c.lane >= this.lanes - 1) c.moveDir = -1;
      else c.moveDir = this.rng.chance(0.5) ? 1 : -1;
      c.lane = Math.max(0, Math.min(this.lanes - 1, c.lane + c.moveDir));
      this.emit('coralMove', { lane: c.lane });
    }
  }

  // Block enemies (they stop & stack above the coral) and remove player fish
  // that reach it (they "swim away"). Sharks pass through; squid is unaffected.
  applyCoral() {
    const c = this.coral;
    if (!c) return;
    const stopY = c.rowY + CORAL.stopMargin;
    const inLane = this.enemies
      .filter((e) => e.alive && e.lane === c.lane)
      .sort((a, b) => a.y - b.y);
    let floor = stopY;
    for (const e of inLane) {
      if (e.y < floor) { e.y = floor; e.coralStopped = true; }
      else e.coralStopped = false;
      floor = Math.max(floor, e.y) + CORAL.stackSpacing;
    }
    // mark enemies no longer in the coral lane as free
    for (const e of this.enemies) if (e.lane !== c.lane) e.coralStopped = false;
    // player fish moving up hit the coral and swim away (no score, no penalty)
    for (const p of this.players) {
      if (p.alive && p.lane === c.lane && p.y >= c.rowY - CORAL.stopMargin) {
        p.alive = false;
        this.emit('coralBlockPlayer', { lane: p.lane, y: p.y });
      }
    }
  }

  // ---- public control ----------------------------------------------------
  cooldownRemaining() { return Math.max(0, this.cooldownUntil - this.time); }
  cooldownProgress() {
    if (this.lastCooldownLen <= 0) return 1;
    return Math.min(1, 1 - this.cooldownRemaining() / this.lastCooldownLen);
  }
  isReady() { return this.time >= this.cooldownUntil; }

  // Launch a row of player fish, one per lane in `lanes`, of `color`.
  // During rainbow the color is forced to 'rainbow'. Returns true on launch.
  launch(lanes, color) {
    if (this.ended) return false;
    lanes = [...new Set(lanes)].filter((l) => l >= 0 && l < this.lanes);
    if (lanes.length === 0) return false;
    if (!this.isReady()) {
      this.emit('launchDenied', { lanes });
      return false;
    }
    const useColor = this.effects.rainbow.active ? 'rainbow' : color;
    for (const lane of lanes) {
      this.players.push({ id: fid(), lane, y: FIELD.launchY, color: useColor, alive: true, weaved: new Set() });
    }
    const len = cooldownFor(lanes.length);
    this.cooldownUntil = this.time + len;
    this.lastCooldownLen = len;
    this.emit('launch', { lanes, color: useColor, count: lanes.length });
    return true;
  }

  // ---- power-ups ---------------------------------------------------------
  useIce() {
    this.effects.ice.active = true;
    this.effects.ice.until = this.time + POWERUPS.ice.duration;
    this.emit('powerup', { kind: 'ice' });
  }
  useRainbow() {
    this.effects.rainbow.active = true;
    this.effects.rainbow.until = this.time + POWERUPS.rainbow.duration;
    this.emit('powerup', { kind: 'rainbow' });
  }
  useSquid() {
    this.effects.squid.active = true;
    this.effects.squid.until = this.time + POWERUPS.squid.duration;
    this.emit('powerup', { kind: 'squid' });
  }
  useShark(startLane) {
    const w = POWERUPS.shark.lanesWide;
    let l0 = Math.max(0, Math.min(startLane, this.lanes - w));
    const lanes = [];
    for (let i = 0; i < w; i++) lanes.push(l0 + i);
    this.sharks.push({ id: fid(), lanes, y: -0.18, born: this.time });
    this.emit('powerup', { kind: 'shark', lanes });
  }

  // interior lanes (all but leftmost & rightmost) for squid.
  isInteriorLane(lane) { return lane > 0 && lane < this.lanes - 1; }

  // ---- main tick ---------------------------------------------------------
  tick(dt) {
    if (this.ended) return;
    this.time += dt;

    // Expire effects.
    for (const k of ['ice', 'rainbow', 'squid']) {
      const e = this.effects[k];
      if (e.active && this.time >= e.until) { e.active = false; this.emit('powerupEnd', { kind: k }); }
    }

    this.spawnDue();
    this.moveFish(dt);
    this.applyCurrents();
    this.updateCoral();
    this.applyCoral();
    this.updateSharks(dt);
    this.squidPass();
    this.collide();
    this.handleLeaksAndExits();
    this.checkEnd();
  }

  spawnDue() {
    const sp = this.level.spawns;
    // No new enemy fish are generated after the level timer ends.
    if (this.time >= (this.level.duration || LEVEL.duration)) { this.spawnCursor = sp.length; return; }
    while (this.spawnCursor < sp.length && sp[this.spawnCursor].t <= this.time) {
      const s = sp[this.spawnCursor++];
      const f = {
        id: fid(), lane: s.lane, y: FIELD.topSpawnY, kind: s.kind,
        alive: true, weaveDir: this.rng.chance(0.5) ? 1 : -1,
      };
      if (s.kind === 'tri') { f.bands = s.bands.slice(); f.phase = 0; }
      else if (s.kind === 'white' || s.kind === 'black') { f.phase = 0; f.color = null; }
      else { f.color = s.color; }
      this.enemies.push(f);
      this._resolvedCount++;
      this.emit('spawn', { id: f.id, lane: f.lane, kind: f.kind });
    }
  }

  enemySpeed(f) {
    let s = SPEED.enemyBase * (this.level.speedMult || 1);
    if (f.kind === 'white' && f.phase === 0) s *= SPEED.whiteMult;
    if (f.kind === 'tri') s *= SPEED.triMult;
    if (this.effects.ice.active) s *= SPEED.iceMult;
    return s;
  }

  moveFish(dt) {
    for (const e of this.enemies) { if (e.alive) e.y -= this.enemySpeed(e) * dt; }
    for (const p of this.players) { if (p.alive) p.y += SPEED.player * dt; }
  }

  updateSharks(dt) {
    for (const sh of this.sharks) {
      sh.y += SPEED.player * SPEED.sharkMult * dt; // half the speed of a player fish
      // Eat any enemy in shark lanes within the shark's (big) body band.
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (!sh.lanes.includes(e.lane)) continue;
        if (e.y <= sh.y + 0.14 && e.y >= sh.y - 0.16) {
          const val = remainingValue(e); // shark scores the fish's full remaining value
          this.addScore(val);
          e.alive = false;
          this.kills++;
          this.emit('sharkEat', { id: e.id, lane: e.lane, value: val });
        }
      }
    }
    this.sharks = this.sharks.filter((sh) => sh.y < 1.25);
  }

  squidPass() {
    if (!this.effects.squid.active) return;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (!this.isInteriorLane(e.lane)) continue;
      if (e.y <= this.squidY) {
        e.alive = false; // eaten
        this.squidEats++;
        let scored = false;
        if (this.squidEats >= 2) { this.squidEats -= 2; this.addScore(1); scored = true; } // 1 pt / 2 eaten
        this.emit('squidEat', { id: e.id, lane: e.lane, scored });
      }
    }
  }

  addScore(n) { this.score = Math.max(0, this.score + n); }

  collide() {
    // Group alive fish per lane.
    const R = FIELD.collideRadiusY;
    const claimed = new Set(); // enemy ids resolved/advanced this collision pass
    for (let lane = 0; lane < this.lanes; lane++) {
      const es = this.enemies.filter((e) => e.alive && e.lane === lane);
      const ps = this.players.filter((p) => p.alive && p.lane === lane);
      if (es.length === 0 || ps.length === 0) continue;
      // players sorted by y descending (closest to enemies resolves first).
      ps.sort((a, b) => b.y - a.y);
      for (const p of ps) {
        if (!p.alive) continue;
        // Prefer the nearest enemy this player can act on (and isn't claimed).
        let act = null, actD = Infinity;
        let wrong = null, wrongD = Infinity;
        for (const e of es) {
          if (!e.alive) continue;
          const d = Math.abs(e.y - p.y);
          if (d >= R) continue;
          if (!claimed.has(e.id) && playerActsOn(p.color, e)) {
            if (d < actD) { act = e; actD = d; }
          } else if (!playerActsOn(p.color, e)) {
            if (d < wrongD) { wrong = e; wrongD = d; }
          }
        }
        if (act) {
          claimed.add(act.id);
          this.resolveHit(p, act);
        } else if (wrong && !p.weaved.has(wrong.id)) {
          p.weaved.add(wrong.id);
          this.emit('weave', { lane, player: p.id, enemy: wrong.id });
        }
      }
    }
  }

  // A correct player hit lands on enemy f.
  resolveHit(p, f) {
    p.alive = false; // player fish consumed
    if (f.kind === 'normal') {
      f.alive = false;
      this.addScore(POINTS.normal);
      this.kills++;
      this.emit('fishKilled', { id: f.id, lane: f.lane, color: f.color, playerColor: p.color });
      this.emit('friendPair', { lane: f.lane, colorA: f.color, colorB: p.color, y: f.y });
      return;
    }
    if (f.kind === 'white') {
      if (f.phase === 0) {
        f.phase = 1;
        f.color = (p.color === 'rainbow') ? this.level.pool[0] : opposite(p.color);
        this.addScore(1);
        this.emit('transform', { id: f.id, lane: f.lane, kind: 'white', to: f.color });
      } else {
        f.alive = false;
        this.addScore(1);
        this.kills++;
        this.emit('fishKilled', { id: f.id, lane: f.lane, color: f.color, playerColor: p.color });
        this.emit('friendPair', { lane: f.lane, colorA: f.color, colorB: p.color, y: f.y });
      }
      return;
    }
    if (f.kind === 'black') {
      if (f.phase === 0) {
        f.phase = 1;
        f.color = (p.color === 'rainbow') ? this.level.pool[0] : p.color;
        this.addScore(1);
        this.emit('transform', { id: f.id, lane: f.lane, kind: 'black', to: f.color });
      } else {
        f.alive = false;
        this.addScore(1);
        this.kills++;
        this.emit('fishKilled', { id: f.id, lane: f.lane, color: f.color, playerColor: p.color });
        this.emit('friendPair', { lane: f.lane, colorA: f.color, colorB: p.color, y: f.y });
      }
      return;
    }
    if (f.kind === 'tri') {
      f.phase++;
      this.addScore(1);
      if (f.phase >= 3) {
        f.alive = false;
        this.kills++;
        this.emit('fishKilled', { id: f.id, lane: f.lane, kind: 'tri', playerColor: p.color });
        this.emit('friendPair', { lane: f.lane, colorA: f.bands[2], colorB: p.color, y: f.y });
      } else {
        this.emit('transform', { id: f.id, lane: f.lane, kind: 'tri', phase: f.phase });
      }
      return;
    }
  }

  handleLeaksAndExits() {
    for (const e of this.enemies) {
      if (e.alive && e.y <= FIELD.bottomLeakY) {
        e.alive = false;
        this.addScore(-1);
        this.leaks++;
        this.emit('leak', { lane: e.lane, kind: e.kind });
      }
    }
    for (const p of this.players) {
      if (p.alive && p.y >= FIELD.topExitY) {
        p.alive = false;
        this.emit('playerExit', { lane: p.lane });
        // Wasted fish: every 2 that escape the top without a hit cost 1 point.
        this.wastedFish++;
        if (this.wastedFish >= 2) {
          this.wastedFish -= 2;
          this.addScore(-1);
          this.emit('wastePenalty', { lane: p.lane });
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);
    this.players = this.players.filter((p) => p.alive);
  }

  allSpawned() { return this.spawnCursor >= this.level.spawns.length; }

  checkEnd() {
    if (this.endless) return; // Game controls endless termination (life-based)
    // The level ends only once every enemy fish is off the screen, and no new
    // fish spawn after the timer ends. So: end when there are no enemies left
    // AND either all scripted fish have spawned or the timer has run out.
    const timeUp = this.time >= (this.level.duration || LEVEL.duration);
    const noMoreSpawns = this.allSpawned() || timeUp;
    if (noMoreSpawns && this.enemies.length === 0) {
      this.ended = true;
      const stars = this.starsForScore(this.score);
      this.emit('levelEnd', {
        score: this.score, maxScore: this.maxScore, stars,
        passTarget: this.level.passTarget, passed: stars >= 1,
      });
    }
  }

  starsForScore(score) {
    if (score >= this.level.threeStar) return 3;
    if (score >= this.level.twoStar) return 2;
    if (score >= this.level.passTarget) return 1;
    return 0;
  }

  // Snapshot for renderer / debug.
  getState() {
    return {
      time: this.time, score: this.score, maxScore: this.maxScore,
      lanes: this.lanes, ended: this.ended,
      enemies: this.enemies, players: this.players, sharks: this.sharks,
      effects: this.effects, cooldown: this.cooldownProgress(),
      currents: this.currents, coral: this.coral,
    };
  }
}

export { remainingValue, requiredPlayerColor, playerActsOn };
