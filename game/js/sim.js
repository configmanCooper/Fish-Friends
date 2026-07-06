// sim.js — the entire game logic. Pure JS: imports config/levels/rng only.
// No three.js, no DOM. Runs headless in Node for tests and autoplay bots.
// Emits events consumed by render/audio/ui.

import {
  FIELD, SPEED, COOLDOWN, LEVEL, POINTS, POWERUPS, INV_CAP,
  cooldownFor, opposite, isCounter, COLORS,
  ROW_YS, CURRENT, CORAL, ANEMONE, BOSS,
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
  if (f.kind === 'boss') return opposite(f.color); // hit boss segment with its opposite
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

    // Legacy (prestige) upgrade effect values (fractions). Default: no bonus.
    const lg = opts.legacy || {};
    this.legacy = {
      fishSpeed: lg.fishSpeed || 0,
      friendSlow: lg.friendSlow || 0,
      rainbowChance: lg.rainbowChance || 0,
      freeShark: lg.freeShark || 0,
    };
    this._freeSharkRolled = false;

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
    this.boss = null;
    this.bossWon = false;
    if (level.kind === 'boss') this._initBoss();

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
    // Color-shift anemone (single cell that repaints enemies crossing it).
    this.anemone = null;
    if (this.level.anemone) {
      const row = this.rng.pick(ANEMONE.candidateRows);
      this.anemone = {
        id: 'anem',
        lane: this.rng.int(0, this.lanes - 1),
        rowY: ROW_YS[row],
        _step: 0,
      };
    }
  }

  // Anemone hops to a new lane on a cadence; when an enemy fish crosses its
  // cell it is repainted to a new random colour from the pool (once per fish).
  updateAnemone() {
    const a = this.anemone;
    if (!a) return;
    const step = Math.floor(this.time / ANEMONE.moveInterval);
    if (step !== a._step) {
      a._step = step;
      const nl = this.rng.int(0, this.lanes - 1);
      if (nl !== a.lane) { a.lane = nl; this.emit('anemoneMove', { lane: a.lane }); }
    }
  }
  applyAnemone() {
    const a = this.anemone;
    if (!a) return;
    const pool = this.level.pool;
    for (const f of this.enemies) {
      if (!f.alive || f.boss) continue;
      if (f.lane !== a.lane) continue;
      if (Math.abs(f.y - a.rowY) > ANEMONE.band) continue;
      if (!f._shifted) f._shifted = new Set();
      if (f._shifted.has(a.id)) continue;
      f._shifted.add(a.id);
      this._repaint(f, pool);
    }
  }
  // Repaint an enemy fish to a new colour (different from its current one).
  _repaint(f, pool) {
    const pickNew = (cur) => {
      let c = this.rng.pick(pool);
      let guard = 0;
      while (c === cur && pool.length > 1 && guard++ < 8) c = this.rng.pick(pool);
      return c;
    };
    if (f.kind === 'normal') {
      f.color = pickNew(f.color);
      this.emit('anemoneShift', { id: f.id, lane: f.lane, to: f.color });
    } else if (f.kind === 'tri') {
      // repaint the current front band the player still has to counter
      const cur = f.bands[f.phase];
      f.bands[f.phase] = pickNew(cur);
      this.emit('anemoneShift', { id: f.id, lane: f.lane, to: f.bands[f.phase] });
    } else if ((f.kind === 'white' || f.kind === 'black') && f.phase === 1) {
      f.color = pickNew(f.color);
      this.emit('anemoneShift', { id: f.id, lane: f.lane, to: f.color });
    }
    // phase-0 white/black have no colour yet -> nothing to shift.
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
    if (!f.alive || f.boss) return;
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
      .filter((e) => e.alive && !e.boss && e.lane === c.lane)
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

  // ---- Prism Whale boss --------------------------------------------------
  _initBoss() {
    const lvl = this.level;
    const hp = lvl.bossHp || BOSS.hp;
    const w = Math.min(BOSS.lanesWide, this.lanes);
    const l0 = Math.floor((this.lanes - w) / 2);
    const pool = lvl.pool;
    this.boss = {
      hp, maxHp: hp,
      l0, w,
      step: 0,                 // 0 = all the way back, BOSS.steps = at the beach
      y: BOSS.backY,
      phase: 1,
      colorIdx: 0,
      color: pool[0],
      cycleT: 0,
      advanceT: 0,             // seconds since the last correct hit
      recentHits: [],          // timestamps of recent correct hits (retreat combo)
      lateralT: BOSS.lateralEvery, // countdown to next left/right strafe
      fishT: BOSS.fish.every,  // countdown to next descending fish row
    };
    // One damage-shared segment per occupied lane; each is an enemy the collide
    // system / bots handle, flagged boss so it holds station & shares HP. Each
    // carries its own struckAt (used by the half-and-half final phase).
    for (let i = 0; i < w; i++) {
      this.enemies.push({
        id: fid(), lane: l0 + i, y: BOSS.backY, kind: 'boss', boss: true,
        color: pool[0], alive: true, vulnerableAt: 0, struckAt: -999, weaved: new Set(),
      });
    }
    this.emit('bossSpawn', { hp, lanes: w });
  }

  bossSegments() { return this.enemies.filter((e) => e.boss && e.alive); }

  _bossY() { const b = this.boss; return BOSS.backY - (b.step / BOSS.steps) * (BOSS.backY - BOSS.beachY); }

  updateBoss(dt) {
    const b = this.boss;
    if (!b || this.bossWon) return;
    const pool = this.level.pool;

    // Phase by remaining HP. Final phase (3) splits the whale into two halves,
    // each its own colour — you must hit BOTH halves' opposites within
    // BOSS.splitWithin seconds to land damage.
    const frac = b.hp / b.maxHp;
    let phase = frac <= BOSS.phaseAt.p3 ? 3 : frac <= BOSS.phaseAt.p2 ? 2 : 1;
    if (phase !== b.phase) {
      b.phase = phase;
      if (phase === 3) this._recolorBoss(true, pool);
      this.emit('bossPhase', { phase });
    }

    // Colour cycle.
    b.cycleT += dt;
    if (b.cycleT >= BOSS.cyclePeriod) {
      b.cycleT -= BOSS.cyclePeriod;
      b.colorIdx = (b.colorIdx + 1) % pool.length;
      this._recolorBoss(b.phase === 3, pool);
      this.emit('bossCycle', {});
    }

    // Advance one step for every `advanceEvery` seconds without a correct hit.
    b.advanceT += dt;
    if (b.advanceT >= BOSS.advanceEvery) {
      b.advanceT -= BOSS.advanceEvery;
      b.step = Math.min(BOSS.steps, b.step + 1);
      this.emit('bossAdvance', { step: b.step });
    }

    // Strafe one lane left/right every lateralEvery seconds (stay on the grid).
    b.lateralT -= dt;
    if (b.lateralT <= 0) {
      b.lateralT += BOSS.lateralEvery;
      const canLeft = b.l0 > 0;
      const canRight = b.l0 + b.w <= this.lanes - 1;
      let dir = 0;
      if (canLeft && canRight) dir = this.rng.chance(0.5) ? -1 : 1;
      else if (canLeft) dir = -1;
      else if (canRight) dir = 1;
      if (dir !== 0) {
        b.l0 += dir;
        const segs = this.bossSegments();
        for (let i = 0; i < segs.length; i++) segs[i].lane = b.l0 + i;
        this.emit('bossStrafe', { l0: b.l0, dir });
      }
    }

    // Position (bob for life).
    b.y = this._bossY() + Math.sin(this.time * 1.4) * 0.012;
    for (const s of this.bossSegments()) s.y = b.y;

    // Descending fish (incl. occasional specials) keep coming — pure threat.
    b.fishT -= dt;
    if (b.fishT <= 0) { b.fishT += BOSS.fish.every; this._spawnBossFishRow(); }

    this.score = b.maxHp - b.hp; // score == net whale damage
  }

  // Colour the whale: split=true gives each half its own (distinct) colour.
  _recolorBoss(split, pool) {
    const b = this.boss;
    const segs = this.bossSegments();
    if (!split) {
      b.color = pool[b.colorIdx];
      for (const s of segs) s.color = b.color;
    } else {
      const a = pool[b.colorIdx];
      let c = pool[(b.colorIdx + Math.max(1, Math.floor(pool.length / 2))) % pool.length];
      if (c === a && pool.length > 1) c = pool[(b.colorIdx + 1) % pool.length];
      b.color = a;
      for (let i = 0; i < segs.length; i++) segs[i].color = (i === 0) ? a : c;
    }
  }

  _spawnBossFishRow() {
    const rng = this.rng;
    const size = Math.min(this.lanes, rng.int(BOSS.fish.rowMin, BOSS.fish.rowMax));
    const start = rng.int(0, this.lanes - size);
    const pool = this.level.pool;
    // whole-row special sometimes
    let rowKind = null;
    const r = rng.next();
    if (r < BOSS.fish.triChance) rowKind = 'tri';
    else if (r < BOSS.fish.triChance + BOSS.fish.blackChance) rowKind = 'black';
    else if (r < BOSS.fish.triChance + BOSS.fish.blackChance + BOSS.fish.whiteChance) rowKind = 'white';
    const bands = rowKind === 'tri' ? rng.shuffle(pool.slice()).slice(0, 3) : null;
    const color = rng.pick(pool);
    for (let i = 0; i < size; i++) {
      const lane = start + i;
      const f = { id: fid(), lane, y: FIELD.topSpawnY, alive: true, weaveDir: rng.chance(0.5) ? 1 : -1, minion: true };
      if (rowKind === 'tri') { f.kind = 'tri'; f.bands = bands.slice(); f.phase = 0; }
      else if (rowKind === 'white' || rowKind === 'black') { f.kind = rowKind; f.phase = 0; f.color = null; }
      else { f.kind = 'normal'; f.color = color; }
      this.enemies.push(f);
      this.emit('spawn', { id: f.id, lane, kind: f.kind });
    }
  }

  // Boss collision: a player fish reaching the whale with its OPPOSITE colour (or
  // rainbow) deals 1 damage and resets the advance timer; 3 hits within
  // retreatWindow shove it back a step. Wrong colours do nothing (no heal).
  bossCollide() {
    const b = this.boss;
    if (!b || this.bossWon) return;
    const R = BOSS.hitRadius;
    for (const seg of this.enemies) {
      if (!seg.boss || !seg.alive) continue;
      if (this.time < seg.vulnerableAt) continue; // inert -> let fish pass
      // nearest CORRECT-colour player fish in this lane within the body band
      // (wrong-colour fish just weave past the whale with no effect).
      let p = null, best = Infinity;
      for (const q of this.players) {
        if (!q.alive || q.lane !== seg.lane) continue;
        if (!playerActsOn(q.color, seg)) continue;
        const d = Math.abs(q.y - seg.y);
        if (d < R && d < best) { best = d; p = q; }
      }
      if (!p) continue;
      p.alive = false; // correct fish consumed
      seg.vulnerableAt = this.time + BOSS.segCooldown;
      // Any correct hit resets the creep timer and counts toward the retreat combo.
      b.advanceT = 0;
      b.recentHits.push(this.time);
      b.recentHits = b.recentHits.filter((t) => this.time - t <= BOSS.retreatWindow);
      if (b.recentHits.length >= BOSS.retreatHits) {
        b.recentHits.length = 0;
        if (b.step > 0) { b.step = Math.max(0, b.step - 1); this.emit('bossRetreat', { step: b.step }); }
      }
      // Damage: phases 1-2 damage per hit; phase 3 needs BOTH halves struck
      // (each with its own opposite) within BOSS.splitWithin seconds.
      let dealt = false;
      if (b.phase < 3) {
        dealt = true;
      } else {
        seg.struckAt = this.time;
        const allStruck = this.bossSegments().every((s) => this.time - s.struckAt <= BOSS.splitWithin);
        if (allStruck) {
          dealt = true;
          for (const s of this.bossSegments()) s.struckAt = -999; // reset the combo
          this.emit('bossSplitBreak', {});
        } else {
          this.emit('bossSideHit', { lane: seg.lane });
        }
      }
      if (dealt) {
        b.hp = Math.max(0, b.hp - 1);
        this.emit('bossHit', { lane: seg.lane, hp: b.hp, maxHp: b.maxHp });
        if (b.hp <= 0) {
          this.bossWon = true;
          for (const s of this.enemies) if (s.boss) s.alive = false;
          this.emit('bossDefeated', {});
        }
        this.score = b.maxHp - b.hp;
      }
    }
  }
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
    // Legacy "Rainbow Instinct": small chance the whole launch becomes rainbow.
    let useColor = this.effects.rainbow.active ? 'rainbow' : color;
    if (useColor !== 'rainbow' && this.legacy.rainbowChance > 0
        && this.rng.chance(this.legacy.rainbowChance)) {
      useColor = 'rainbow';
    }
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
    this.updateAnemone();
    this.applyAnemone();
    this.resolveEnemyStacking();
    this.updateCoral();
    this.applyCoral();
    this.updateBoss(dt);
    this.rollFreeShark();
    this.updateSharks(dt);
    this.squidPass();
    this.bossCollide();
    this.collide();
    this.handleLeaksAndExits();
    this.checkEnd();
  }

  // Legacy "Patrol Shark": once per level, at the 0:30 mark, roll for a free
  // shark in a random lane. Independent of the shop shark / auto-shark.
  rollFreeShark() {
    if (this._freeSharkRolled || this.legacy.freeShark <= 0) return;
    if (this.time < 30) return;
    this._freeSharkRolled = true;
    if (this.rng.chance(this.legacy.freeShark)) {
      const lane = this.rng.int(0, this.lanes - 1);
      this.useShark(lane);
      this.emit('freeShark', { lane });
    }
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
      if (s.minion) f.minion = true; // boss-fight minion: threat only, 0 points
      this.enemies.push(f);
      this._resolvedCount++;
      this.emit('spawn', { id: f.id, lane: f.lane, kind: f.kind });
    }
  }

  enemySpeed(f) {
    if (f.boss) return 0; // boss segments hold station
    let s = SPEED.enemyBase * (this.level.speedMult || 1);
    if (f.kind === 'white' && f.phase === 0) s *= SPEED.whiteMult;
    if (f.kind === 'tri') s *= SPEED.triMult;
    if (this.effects.ice.active) s *= SPEED.iceMult;
    // Legacy "Sluggish Tide": permanently slow enemy fish.
    if (this.legacy.friendSlow) s *= (1 - this.legacy.friendSlow);
    return s;
  }

  // Player fish ascend speed, boosted by the Legacy "Swift Fins" upgrade.
  playerSpeed() { return SPEED.player * (1 + this.legacy.fishSpeed); }

  moveFish(dt) {
    for (const e of this.enemies) { if (e.alive && !e.boss) e.y -= this.enemySpeed(e) * dt; }
    const ps = this.playerSpeed();
    for (const p of this.players) { if (p.alive) p.y += ps * dt; }
  }

  // Prevent enemy fish from piling up / overtaking within a lane. A faster fish
  // (e.g. normal fish behind a slower white/tri fish) that catches the one ahead
  // is clamped to a minimum gap behind it — so it effectively slows to the
  // leading fish's speed instead of overlapping it.
  resolveEnemyStacking() {
    const gap = FIELD.enemyFollowGap;
    const byLane = new Map();
    for (const e of this.enemies) {
      if (!e.alive || e.boss) continue;
      let arr = byLane.get(e.lane);
      if (!arr) { arr = []; byLane.set(e.lane, arr); }
      arr.push(e);
    }
    for (const arr of byLane.values()) {
      if (arr.length < 2) continue;
      // Leader first: sort by y ascending (lowest y = furthest down the screen).
      arr.sort((a, b) => a.y - b.y);
      let floor = arr[0].y;
      for (let i = 1; i < arr.length; i++) {
        const minY = floor + gap;
        if (arr[i].y < minY) arr[i].y = minY; // hold trailing fish behind the one ahead
        floor = arr[i].y;
      }
    }
  }

  updateSharks(dt) {
    for (const sh of this.sharks) {
      sh.y += SPEED.player * SPEED.sharkMult * dt; // half the speed of a player fish
      // Eat any enemy in shark lanes within the shark's (big) body band.
      for (const e of this.enemies) {
        if (!e.alive || e.boss) continue;
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
      if (!e.alive || e.boss) continue;
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
      const es = this.enemies.filter((e) => e.alive && !e.boss && e.lane === lane);
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
      this.addScore(f.minion ? 0 : POINTS.normal); // boss minions score 0
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
        if (!e.minion) this.addScore(-1); // boss minions are threat-only, no score
        this.leaks++;
        this.emit('leak', { lane: e.lane, kind: e.kind });
      }
    }
    for (const p of this.players) {
      if (p.alive && p.y >= FIELD.topExitY) {
        p.alive = false;
        this.emit('playerExit', { lane: p.lane });
        // Wasted fish: every 2 that escape the top without a hit cost 1 point.
        // Not applied on the boss level (fish sail past the big cycling body).
        if (this.level.kind !== 'boss') {
          this.wastedFish++;
          if (this.wastedFish >= 2) {
            this.wastedFish -= 2;
            this.addScore(-1);
            this.emit('wastePenalty', { lane: p.lane });
          }
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive);
    this.players = this.players.filter((p) => p.alive);
  }

  allSpawned() { return this.spawnCursor >= this.level.spawns.length; }

  checkEnd() {
    if (this.endless) return; // Game controls endless termination (life-based)
    const dur = this.level.duration || LEVEL.duration;
    const timeUp = this.time >= dur;
    // Boss level: WIN when the whale's HP hits 0; LOSE if it reaches the beach
    // or 20 fish slip past you. No timer.
    if (this.level.kind === 'boss') {
      const b = this.boss;
      const beached = b && b.step >= BOSS.steps;
      const swarmed = this.leaks >= BOSS.maxLeaks;
      if (this.bossWon || beached || swarmed) {
        for (const s of this.enemies) if (s.boss) s.alive = false;
        this.enemies = this.enemies.filter((e) => e.alive);
        this.ended = true;
        const stars = this.bossWon ? 3 : 0; // boss is binary: win = 3★, lose = 0★
        this.emit('levelEnd', {
          score: this.score, maxScore: this.maxScore, stars,
          passTarget: this.level.passTarget, passed: this.bossWon,
          boss: true, bossWon: this.bossWon,
          loseReason: this.bossWon ? null : (beached ? 'beach' : 'swarm'),
        });
      }
      return;
    }
    // The level ends only once every enemy fish is off the screen, and no new
    // fish spawn after the timer ends. So: end when there are no enemies left
    // AND either all scripted fish have spawned or the timer has run out.
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
      currents: this.currents, coral: this.coral, anemone: this.anemone,
      boss: this.boss ? {
        hp: this.boss.hp, maxHp: this.boss.maxHp, phase: this.boss.phase,
        l0: this.boss.l0, w: this.boss.w, y: this.boss.y, step: this.boss.step,
        won: this.bossWon,
        colors: this.bossSegments().map((s) => s.color),
        leaks: this.leaks, maxLeaks: BOSS.maxLeaks,
      } : null,
    };
  }
}

export { remainingValue, requiredPlayerColor, playerActsOn };
