// run.js — Fish Friends headless test suite. Plain asserts, no deps.
import {
  COLORS, opposite, isCounter, cooldownFor, LEVEL, POINTS, SPECIAL, bossTypeFor,
} from '../js/config.js';
import { LEVELS, compileLevel, rowLaunchTime, launchesOf, levelDefsFor } from '../js/levels.js';
import { Sim, remainingValue, requiredPlayerColor, playerActsOn } from '../js/sim.js';
import { perfectBot, nullBot, greedyWrongBot, runBot } from './bots.js';

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; fails.push(msg); } }
function eq(a, b, msg) { ok(a === b, `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }

// ---------------------------------------------------------------------------
// 1. Color / opposite table.
// ---------------------------------------------------------------------------
function testColors() {
  eq(opposite('blue'), 'orange', 'blue opposite orange');
  eq(opposite('orange'), 'blue', 'orange opposite blue');
  eq(opposite('red'), 'green', 'red opposite green');
  eq(opposite('green'), 'red', 'green opposite red');
  eq(opposite('yellow'), 'purple', 'yellow opposite purple');
  eq(opposite('purple'), 'yellow', 'purple opposite yellow');
  // involution + shared pattern
  for (const id in COLORS) {
    eq(opposite(opposite(id)), id, `opposite involution ${id}`);
    eq(COLORS[id].pattern, COLORS[opposite(id)].pattern, `shared pattern ${id}`);
  }
  ok(isCounter('orange', 'blue'), 'orange counters blue');
  ok(!isCounter('blue', 'blue'), 'blue does not counter blue');
  ok(isCounter('rainbow', 'blue'), 'rainbow counters anything');
}

// ---------------------------------------------------------------------------
// 2. Cooldown formula.
// ---------------------------------------------------------------------------
function testCooldown() {
  // Cooldown is disabled — launching is always instant.
  eq(cooldownFor(1), 0, 'cooldown disabled (1 fish)');
  eq(cooldownFor(3), 0, 'cooldown disabled (3 fish)');
  const lvl = makeLevel([{ t: 0.1, lane: 0, kind: 'normal', color: 'blue', value: 1 }]);
  const sim = new Sim(lvl);
  sim.launch([0], 'orange');
  ok(sim.isReady(), 'ready immediately after launching (no wait)');
}

// ---------------------------------------------------------------------------
// 3. Collision + scoring on a tiny synthetic level.
// ---------------------------------------------------------------------------
function makeLevel(spawns, over = {}) {
  const maxScore = spawns.reduce((s, sp) => s + sp.value, 0);
  return {
    n: 99, lanes: over.lanes || 3, pool: over.pool || ['blue', 'orange'],
    picker: over.picker || ['orange', 'blue'], spawns,
    maxScore, passTarget: Math.ceil(maxScore * 0.5),
    twoStar: Math.ceil(maxScore * 0.75), threeStar: Math.ceil(maxScore * 0.95),
    speedMult: 1, seed: 123,
    duration: over.duration, currents: over.currents || 0, coral: !!over.coral,
  };
}

function testCollisionBasic() {
  const lvl = makeLevel([{ t: 0.1, lane: 1, kind: 'normal', color: 'blue', value: 1 }]);
  const sim = new Sim(lvl);
  // step a bit so the enemy exists (spawn at t=0.1)
  for (let i = 0; i < 8; i++) sim.tick(1 / 60);
  ok(sim.enemies.length === 1, 'enemy spawned');
  // launch orange counter
  const okLaunch = sim.launch([1], 'orange');
  ok(okLaunch, 'launch succeeded');
  // run until resolved or leak
  let killed = false;
  for (let i = 0; i < 60 * 30 && !sim.ended; i++) {
    sim.tick(1 / 60);
    for (const e of sim.drainEvents()) {
      if (e.type === 'fishKilled') killed = true;
      if (e.type === 'friendPair') ok(true, 'friend pair emitted');
    }
  }
  ok(killed, 'blue enemy killed by orange (paired off)');
  eq(sim.score, 1, 'score +1 on counter');
}

function testWrongColorWeaves() {
  const lvl = makeLevel([{ t: 0.1, lane: 0, kind: 'normal', color: 'blue', value: 1 }]);
  const sim = new Sim(lvl);
  sim.tick(1 / 60);
  sim.launch([0], 'green'); // wrong color
  let weaved = false, leaked = false;
  for (let i = 0; i < 60 * 40 && !sim.ended; i++) {
    sim.tick(1 / 60);
    for (const e of sim.drainEvents()) {
      if (e.type === 'weave') weaved = true;
      if (e.type === 'leak') leaked = true;
    }
  }
  ok(weaved, 'wrong color weaves past');
  ok(leaked, 'unkilled enemy leaks');
  eq(sim.score, 0, 'score floor at 0 after leak');
}

function testScoreFloor() {
  const lvl = makeLevel([{ t: 0.1, lane: 0, kind: 'normal', color: 'blue', value: 1 }]);
  const sim = new Sim(lvl);
  sim.addScore(-5);
  eq(sim.score, 0, 'score never negative');
}

// ---------------------------------------------------------------------------
// 4. Special state machines.
// ---------------------------------------------------------------------------
function drive(sim, launches) {
  // launches: [{atEnemyPhase?, color}] applied greedily when ready
  let li = 0;
  for (let i = 0; i < 60 * 60 && !sim.ended; i++) {
    if (li < launches.length && sim.isReady() && sim.enemies.length) {
      const e = sim.enemies[0];
      if (e.y > 0.2) { sim.launch([e.lane], launches[li]); li++; }
    }
    sim.tick(1 / 60);
    sim.drainEvents();
  }
}

function testWhiteMachine() {
  // white: hit Red -> becomes Green; hit Red again -> dies. +2 total.
  const lvl = makeLevel([{ t: 0.1, lane: 0, kind: 'white', value: 2 }], { pool: ['red', 'green'], picker: ['green', 'red'] });
  const sim = new Sim(lvl);
  drive(sim, ['red', 'red']);
  eq(sim.score, 2, 'white: two same-color hits => +2');
  eq(sim.enemies.length, 0, 'white destroyed');
}

function testWhiteWrongSecondHit() {
  // white hit Red -> Green; hit Green (wrong, Green needs Red) -> weaves, survives/leaks.
  const lvl = makeLevel([{ t: 0.1, lane: 0, kind: 'white', value: 2 }], { pool: ['red', 'green'], picker: ['green', 'red'] });
  const sim = new Sim(lvl);
  drive(sim, ['red', 'green']);
  ok(sim.score < 2, 'white: wrong 2nd color does not finish');
}

function testBlackMachine() {
  // black: hit Red -> becomes Red; kill with Green. +2 total.
  const lvl = makeLevel([{ t: 0.1, lane: 0, kind: 'black', value: 2 }], { pool: ['red', 'green'], picker: ['green', 'red'] });
  const sim = new Sim(lvl);
  drive(sim, ['red', 'green']);
  eq(sim.score, 2, 'black: color then counter => +2');
  eq(sim.enemies.length, 0, 'black destroyed');
}

function testTriMachine() {
  // tri bands [blue, red, yellow] front->back. Need orange, green, purple.
  const lvl = makeLevel([{ t: 0.1, lane: 0, kind: 'tri', bands: ['blue', 'red', 'yellow'], value: 3 }],
    { pool: ['blue', 'red', 'yellow', 'orange', 'green', 'purple'], picker: ['orange', 'green', 'purple'] });
  const sim = new Sim(lvl);
  drive(sim, ['orange', 'green', 'purple']);
  eq(sim.score, 3, 'tri: correct front-to-back order => +3');
  eq(sim.enemies.length, 0, 'tri destroyed');
}

function testTriWrongOrder() {
  const lvl = makeLevel([{ t: 0.1, lane: 0, kind: 'tri', bands: ['blue', 'red', 'yellow'], value: 3 }],
    { pool: ['blue', 'red', 'yellow', 'orange', 'green', 'purple'], picker: ['orange', 'green', 'purple'] });
  const sim = new Sim(lvl);
  // green counters red (2nd band) not blue (front) -> weaves, no progress on first hit
  drive(sim, ['green', 'green', 'green']);
  ok(sim.score < 3, 'tri: wrong order fails to clear');
}

function testRainbowAdvancesSpecials() {
  const lvl = makeLevel([{ t: 0.1, lane: 0, kind: 'tri', bands: ['blue', 'red', 'yellow'], value: 3 }],
    { pool: ['blue', 'red', 'yellow', 'orange', 'green', 'purple'], picker: ['orange', 'green', 'purple'] });
  const sim = new Sim(lvl);
  sim.useRainbow();
  drive(sim, ['orange', 'orange', 'orange']); // rainbow overrides -> all rainbow
  eq(sim.score, 3, 'rainbow advances tri each step => +3');
}

// ---------------------------------------------------------------------------
// 5. Power-up rules: squid 0 pts, shark full value, ice slows.
// ---------------------------------------------------------------------------
function testSquidScoresHalf() {
  // two interior-lane enemies, squid active -> 2 eaten => +1 point.
  const lvl = makeLevel([
    { t: 0.1, lane: 1, kind: 'normal', color: 'blue', value: 1 },
    { t: 0.1, lane: 1, kind: 'normal', color: 'blue', value: 1 },
  ], { lanes: 3 });
  const sim = new Sim(lvl);
  sim.useSquid();
  let eats = 0;
  for (let i = 0; i < 60 * 30 && !sim.ended; i++) {
    sim.tick(1 / 60);
    for (const e of sim.drainEvents()) if (e.type === 'squidEat') eats++;
  }
  ok(eats >= 2, 'squid ate both interior enemies');
  eq(sim.score, 1, 'squid awards 1 point per 2 eaten');
}

function testSquidOneEatNoPoint() {
  // a single interior eat awards 0 (needs 2 for a point).
  const lvl = makeLevel([{ t: 0.1, lane: 1, kind: 'normal', color: 'blue', value: 1 }], { lanes: 3 });
  const sim = new Sim(lvl);
  sim.useSquid();
  for (let i = 0; i < 60 * 30 && !sim.ended; i++) { sim.tick(1 / 60); sim.drainEvents(); }
  eq(sim.score, 0, 'single squid eat awards 0 (half-point rule)');
}

function testSquidEdgeLanesOpen() {
  // edge lane enemy is NOT eaten by squid.
  const lvl = makeLevel([{ t: 0.1, lane: 0, kind: 'normal', color: 'blue', value: 1 }], { lanes: 3 });
  const sim = new Sim(lvl);
  sim.useSquid();
  let ate = false;
  for (let i = 0; i < 60 * 30 && !sim.ended; i++) {
    sim.tick(1 / 60);
    for (const e of sim.drainEvents()) if (e.type === 'squidEat') ate = true;
  }
  ok(!ate, 'squid does not eat edge-lane enemy');
}

function testSharkFullValue() {
  const lvl = makeLevel([{ t: 0.1, lane: 1, kind: 'white', value: 2 }], { lanes: 3 });
  const sim = new Sim(lvl);
  // let white descend a bit, then shark
  for (let i = 0; i < 30; i++) sim.tick(1 / 60);
  sim.useShark(0);
  let ate = false, val = 0;
  for (let i = 0; i < 60 * 30 && !sim.ended; i++) {
    sim.tick(1 / 60);
    for (const e of sim.drainEvents()) if (e.type === 'sharkEat') { ate = true; val = e.value; }
  }
  ok(ate, 'shark ate the fish');
  eq(val, 2, 'shark awards full remaining value of fresh white (2)');
}

function testIceSlows() {
  const lvl = makeLevel([{ t: 0.05, lane: 0, kind: 'normal', color: 'blue', value: 1 }]);
  const simFast = new Sim(lvl);
  const simIce = new Sim(lvl);
  simIce.useIce();
  for (let i = 0; i < 30; i++) { simFast.tick(1 / 60); simIce.tick(1 / 60); }
  const yFast = simFast.enemies[0].y, yIce = simIce.enemies[0].y;
  ok(yIce > yFast, 'ice-slowed enemy is higher (moved less)');
}

// ---------------------------------------------------------------------------
// 6. Level validator: max score, targets, spawn window, static APM.
// ---------------------------------------------------------------------------
function testLevelValidator() {
  eq(LEVELS.length, 50, 'exactly 50 authored levels');
  for (const def of LEVELS) {
    const lvl = compileLevel(def);
    ok(lvl.maxScore > 0, `L${def.n} maxScore > 0`);
    eq(lvl.passTarget, Math.ceil(lvl.maxScore * 0.5), `L${def.n} passTarget = 50%`);
    // The boss level has no scripted spawn table (fish are procedural) and no
    // timer, so skip the spawn-window / APM checks.
    if (def.kind === 'boss') {
      ok(lvl.spawns.length === 0, `L${def.n} boss has no scripted spawns`);
      for (const c of lvl.picker) ok(lvl.picker.includes(opposite(c)), `L${def.n} boss picker closed under opposite (${c})`);
      continue;
    }
    // spawn window (per-level)
    const lastT = lvl.spawns[lvl.spawns.length - 1].t;
    ok(lastT <= lvl.spawnWindow + 0.001, `L${def.n} last spawn <= ${lvl.spawnWindow}s (got ${lastT.toFixed(1)})`);
    // spawns must resolve before the level clock ends
    ok(lvl.spawnWindow <= lvl.duration, `L${def.n} spawnWindow within duration`);
    // colors used subset of declared
    for (const s of lvl.spawns) {
      if (s.kind === 'normal') ok(lvl.pool.includes(s.color), `L${def.n} color in pool`);
      if (s.kind === 'tri') for (const b of s.bands) ok(lvl.pool.includes(b), `L${def.n} tri band in pool`);
    }
    // specials not before intro
    const hasWhite = lvl.spawns.some((s) => s.kind === 'white');
    const hasBlack = lvl.spawns.some((s) => s.kind === 'black');
    const hasTri = lvl.spawns.some((s) => s.kind === 'tri');
    if (hasWhite) ok(def.n >= 12, `L${def.n} white not before L12`);
    if (hasBlack) ok(def.n >= 14, `L${def.n} black not before L14`);
    if (hasTri) ok(def.n >= 20, `L${def.n} tri not before L20`);
    // Black fish require the picker be closed under opposite (soft-lock guard).
    if (hasBlack) {
      for (const c of lvl.picker) {
        ok(lvl.picker.includes(opposite(c)), `L${def.n} black-level picker closed under opposite (${c})`);
      }
    }
    // every required player color for any special phase must be selectable.
    for (const s of lvl.spawns) {
      if (s.kind === 'tri') for (const b of s.bands) ok(lvl.picker.includes(opposite(b)), `L${def.n} tri band counter selectable`);
    }
    const byT = {};
    for (const s of lvl.spawns) { (byT[s.t.toFixed(3)] ||= []).push(s); }
    let totalCost = 0;
    for (const key in byT) totalCost += rowLaunchTime(byT[key]);
    ok(totalCost <= LEVEL.apmGuardPct * lvl.duration + 0.001,
      `L${def.n} required launch time ${totalCost.toFixed(1)}s <= ${(LEVEL.apmGuardPct * lvl.duration).toFixed(1)}s`);
  }
}

// ---------------------------------------------------------------------------
// 7. Autoplay bots on every level.
// ---------------------------------------------------------------------------
function testBots() {
  for (const def of LEVELS) {
    const perfect = runBot(new Sim(compileLevel(def)), perfectBot);
    ok(perfect.stars >= 3, `L${def.n} PERFECT bot reaches 3★ (score ${perfect.score}/${perfect.maxScore}, leaks ${perfect.leaks})`);

    const nul = runBot(new Sim(compileLevel(def)), nullBot);
    ok(nul.stars === 0, `L${def.n} NULL bot fails (score ${nul.score})`);

    const wrong = runBot(new Sim(compileLevel(def)), greedyWrongBot);
    ok(wrong.stars === 0, `L${def.n} GREEDY-WRONG bot fails (score ${wrong.score}/${wrong.maxScore})`);
  }
}

// ---------------------------------------------------------------------------
// 8. Determinism: same seed + same bot => identical event log.
// ---------------------------------------------------------------------------
function testDeterminism() {
  const def = LEVELS[15];
  const a = runBot(new Sim(compileLevel(def)), perfectBot);
  const b = runBot(new Sim(compileLevel(def)), perfectBot);
  const sig = (r) => r.events.map((e) => `${e.t.toFixed(4)}:${e.type}:${e.lane ?? ''}`).join('|');
  eq(sig(a), sig(b), 'determinism: identical event log for same seed+bot');
  eq(a.score, b.score, 'determinism: identical score');
}

// Black soft-lock regression: a black fish hit with a color whose opposite is
// selectable must be killable within the level's picker.
function testBlackSoftLockGuard() {
  // find a real black-fish level and confirm picker closed under opposite
  const blackDef = LEVELS.find((d) => d.n === 25);
  const lvl = compileLevel(blackDef);
  const hasBlack = lvl.spawns.some((s) => s.kind === 'black');
  ok(hasBlack, 'L25 has black fish');
  for (const c of lvl.picker) ok(lvl.picker.includes(opposite(c)), `L25 picker closed: ${c}`);
  // simulate: black hit purple -> becomes purple -> kill with yellow (must be selectable)
  const mk = makeLevel([{ t: 0.1, lane: 0, kind: 'black', value: 2 }],
    { pool: ['yellow', 'purple'], picker: ['purple', 'yellow'] });
  const sim = new Sim(mk);
  drive(sim, ['purple', 'yellow']);
  eq(sim.score, 2, 'black hit purple then yellow => +2 (no soft-lock)');
}

// ---------------------------------------------------------------------------
// Hazards: water currents + coral reef.
// ---------------------------------------------------------------------------
function testCurrentPush() {
  const lvl = makeLevel([], { lanes: 6, currents: 1 });
  const sim = new Sim(lvl);
  ok(sim.currents.length === 1, 'one current initialized');
  const cur = sim.currents[0];
  const dir = sim.currentDir(cur);
  // place an enemy just above the current band in lane 2
  const e = { id: 1, lane: 2, y: cur.rowY + 0.06, kind: 'normal', color: 'blue', alive: true };
  sim.enemies.push(e);
  const startLane = e.lane;
  for (let i = 0; i < 60 * 3 && e.y > cur.rowY - 0.1; i++) sim.tick(1 / 60);
  const expected = Math.max(0, Math.min(5, startLane + dir));
  eq(e.lane, expected, 'current pushes enemy one lane in its direction');
}

function testCurrentFlips() {
  const lvl = makeLevel([], { lanes: 6, currents: 1 });
  const sim = new Sim(lvl);
  const cur = sim.currents[0];
  const d0 = sim.currentDir(cur);
  sim.time = 16; // past the 15s flip
  const d1 = sim.currentDir(cur);
  eq(d1, -d0, 'current direction flips after 15s');
}

function testCurrentNotSharkSquid() {
  const lvl = makeLevel([{ t: 0.1, lane: 2, kind: 'normal', color: 'blue', value: 1 }], { lanes: 6, currents: 1 });
  const sim = new Sim(lvl);
  sim.useShark(1);
  const lanesBefore = sim.sharks[0].lanes.slice();
  for (let i = 0; i < 30; i++) sim.tick(1 / 60);
  eq(JSON.stringify(sim.sharks[0] ? sim.sharks[0].lanes : lanesBefore), JSON.stringify(lanesBefore), 'shark lanes unaffected by current');
}

function testAmbushShark() {
  // Start side by click position (lanes 0..7, centre = 3.5).
  const mk = () => new Sim(makeLevel([], { lanes: 8 }), { powers: ['ambush'] });
  let s = mk(); s.useAmbushShark(1, 0.5);
  eq(s.sharks[0].x, 0, 'ambush click on left half enters from far left');
  eq(s.sharks[0].dir, 1, 'ambush from left sweeps right first');
  s = mk(); s.useAmbushShark(6, 0.5);
  eq(s.sharks[0].x, 7, 'ambush click on right half enters from far right');
  eq(s.sharks[0].dir, -1, 'ambush from right sweeps left first');

  // Odd-lane dead-centre tie starts on the right.
  const sc = new Sim(makeLevel([], { lanes: 7 }), { powers: ['ambush'] });
  sc.useAmbushShark(3, 0.5); // centre lane of 7 (centre index 3)
  eq(sc.sharks[0].x, 6, 'centre-tie ambush starts on the right');

  // Four passes then it swims off and is removed.
  s = mk(); s.useAmbushShark(1, 0.5);
  const sh = s.sharks[0];
  let reversals = 0, prevDir = sh.dir, sawLeaving = false;
  for (let i = 0; i < 60 * 40 && s.sharks.length; i++) {
    s.updateSharks(1 / 60);
    if (s.sharks[0]) {
      if (s.sharks[0].dir !== prevDir) { reversals++; prevDir = s.sharks[0].dir; }
      if (s.sharks[0].leaving) sawLeaving = true;
    }
  }
  eq(reversals, 3, 'a 4-pass sweep reverses exactly 3 times');
  ok(sawLeaving, 'ambush shark enters a leaving state');
  eq(s.sharks.length, 0, 'ambush shark is removed after swimming off');

  // Ambush shark eats a fish sitting in its row as it sweeps by.
  const se = new Sim(makeLevel([], { lanes: 8 }), { powers: ['ambush'] });
  se.enemies.push({ id: 1, lane: 5, y: 0.5, kind: 'normal', color: 'blue', value: 1, alive: true });
  se.useAmbushShark(1, 0.5); // enters far left, sweeps right through lane 5
  for (let i = 0; i < 60 * 10 && se.enemies[0].alive; i++) se.updateSharks(1 / 60);
  ok(!se.enemies[0].alive, 'ambush shark eats a fish in its row');

  // Beach partner: 2 over toward centre-away side, clamped in range.
  const sp = new Sim(makeLevel([], { lanes: 8 }), { powers: ['ambush'] });
  eq(sp.partnerSharkLane(1), 3, 'left-half beach shark gets a partner 2 to the right');
  eq(sp.partnerSharkLane(6), 4, 'right-half beach shark gets a partner 2 to the left');
  eq(sp.partnerSharkLane(0), 2, 'edge beach shark partner stays in range');
}

function testCoralBlocksEnemy() {
  const lvl = makeLevel([{ t: 999, lane: 0, kind: 'normal', color: 'blue', value: 1 }], { lanes: 5, coral: true });
  const sim = new Sim(lvl);
  ok(sim.coral, 'coral initialized');
  const c = sim.coral;
  const e = { id: 1, lane: c.lane, y: 0.9, kind: 'normal', color: 'blue', alive: true };
  sim.enemies.push(e);
  for (let i = 0; i < 60 * 8; i++) sim.tick(1 / 60); // within the first coral position
  ok(e.alive, 'enemy not leaked (blocked by coral)');
  ok(e.y >= c.rowY, 'enemy stopped at/above the coral, never passed it');
  eq(sim.leaks, 0, 'coral-blocked enemy never leaks');
}

function testCoralRemovesPlayer() {
  const lvl = makeLevel([{ t: 999, lane: 0, kind: 'normal', color: 'blue', value: 1 }], { lanes: 5, coral: true });
  const sim = new Sim(lvl);
  const c = sim.coral;
  sim.players.push({ id: 2, lane: c.lane, y: 0.12, color: 'orange', alive: true, weaved: new Set() });
  let swamAway = false;
  for (let i = 0; i < 60 * 4; i++) {
    sim.tick(1 / 60);
    for (const ev of sim.drainEvents()) if (ev.type === 'coralBlockPlayer') swamAway = true;
  }
  ok(swamAway, 'player fish hits coral and swims away');
}

function testCoralDisintegrates() {
  const lvl = makeLevel([], { lanes: 5, coral: true, duration: 30 });
  const sim = new Sim(lvl);
  sim.time = 21; // past duration - 10
  let gone = false;
  sim.tick(1 / 60);
  for (const ev of sim.drainEvents()) if (ev.type === 'coralGone') gone = true;
  ok(gone && !sim.coral, 'coral disintegrates 10s before the level ends');
}

function testSpecialRowsAndPicker() {
  const l30 = compileLevel(LEVELS[29]);
  const l35 = compileLevel(LEVELS[34]);
  const rowKinds = (lvl) => {
    const byT = {};
    for (const s of lvl.spawns) (byT[s.t.toFixed(3)] ||= []).push(s);
    const kinds = new Set();
    for (const k in byT) { const r = byT[k]; if (r.length >= 2 && r.every((s) => s.kind === r[0].kind) && r[0].kind !== 'normal') kinds.add(r[0].kind); }
    return kinds;
  };
  ok(rowKinds(l30).has('white'), 'L30 has white rows');
  ok(rowKinds(l35).has('tri'), 'L35 has tri rows');
  // shuffled picker is a permutation of the ordered picker
  const ordered = ['orange', 'blue', 'green', 'red', 'purple', 'yellow'];
  ok([...l30.picker].sort().join() === [...ordered].sort().join(), 'L30 picker is a permutation of all counters');
}

// Level ends only when all enemy fish are off-screen; no spawns after the timer.
function testNoEndUntilClear() {
  const lvl = makeLevel([{ t: 0.1, lane: 0, kind: 'normal', color: 'blue', value: 1 }], { duration: 5 });
  const sim = new Sim(lvl);
  for (let i = 0; i < 60 * 6; i++) sim.tick(1 / 60); // run past the 5s timer
  ok(!sim.ended, 'level not ended while an enemy is still on screen past the timer');
  ok(sim.enemies.length === 1, 'enemy still descending after the timer');
  for (let i = 0; i < 60 * 25 && !sim.ended; i++) sim.tick(1 / 60);
  ok(sim.ended, 'level ends once all enemy fish are off the screen');
}

function testNoSpawnAfterTimer() {
  const lvl = makeLevel([
    { t: 0.1, lane: 0, kind: 'normal', color: 'blue', value: 1 },
    { t: 999, lane: 1, kind: 'normal', color: 'blue', value: 1 }, // scheduled way past timer
  ], { duration: 5 });
  const sim = new Sim(lvl);
  let maxEnemies = 0;
  for (let i = 0; i < 60 * 8; i++) { sim.tick(1 / 60); maxEnemies = Math.max(maxEnemies, sim.enemies.length); }
  ok(maxEnemies <= 1, 'no new enemy fish spawn after the timer ends');
}

// ---------------------------------------------------------------------------
// Boss level (Prism Whale) + anemone mechanic + prestige.
// ---------------------------------------------------------------------------
function testBossLevel() {
  const def = LEVELS.find((d) => d.n === 50);
  ok(def && def.kind === 'boss', 'L50 is a boss level');
  const lvl = compileLevel(def);
  eq(lvl.maxScore, def.bossHp, 'boss maxScore == boss HP');
  ok(lvl.spawns.length === 0, 'boss level fish are procedural (no scripted spawns)');
  ok(lvl.anemone && lvl.coral && lvl.currents >= 1, 'boss level has anemone, coral and current hazards');

  const perfect = runBot(new Sim(compileLevel(def)), perfectBot);
  ok(perfect.stars >= 3, `boss PERFECT bot wins 3★ (score ${perfect.score}/${perfect.maxScore})`);
  ok(perfect.events.filter((e) => e.type === 'bossDefeated').length === 1, 'perfect bot defeats the whale');
  ok(perfect.events.some((e) => e.type === 'bossSplitBreak'), 'perfect bot triggers the final split phase');

  const nul = runBot(new Sim(compileLevel(def)), nullBot);
  eq(nul.stars, 0, 'boss NULL bot fails');
  ok(nul.events.some((e) => e.type === 'levelEnd' && (e.loseReason === 'beach' || e.loseReason === 'swarm')),
    'do-nothing bot loses the boss (beach or swarm)');

  const wrong = runBot(new Sim(compileLevel(def)), greedyWrongBot);
  eq(wrong.stars, 0, 'boss GREEDY-WRONG bot fails');
  ok(wrong.events.every((e) => e.type !== 'bossDefeated'), 'wrong-colour bot never defeats the whale');

  // High-prestige whale (much higher HP) is still fully defeatable by a perfect
  // player, and a do-nothing player still loses.
  const p5 = levelDefsFor(5).find((d) => d.n === 50);
  const p5perfect = runBot(new Sim(compileLevel(p5)), perfectBot);
  ok(p5perfect.stars >= 3, `prestige-5 boss PERFECT bot still wins (hp ${p5.bossHp})`);
  const p5null = runBot(new Sim(compileLevel(p5)), nullBot);
  eq(p5null.stars, 0, 'prestige-5 boss NULL bot still fails');
}

// Sea Turtle boss (prestige 1's L50). Perfect wins by clearing splotches, hitting
// the painted head, then surviving phase 3; null/wrong-colour bots lose to swarm.
function testTurtleBoss() {
  const def = levelDefsFor(1).find((d) => d.n === 50);
  ok(def && def.kind === 'boss' && def.bossType === 'turtle', 'prestige-1 L50 is the Sea Turtle');
  eq(bossTypeFor(0), 'whale', 'prestige 0 -> whale');
  eq(bossTypeFor(1), 'turtle', 'prestige 1 -> turtle');
  eq(bossTypeFor(2), 'whale', 'prestige 2 -> whale again');

  const perfect = runBot(new Sim(compileLevel(def)), perfectBot);
  ok(perfect.stars >= 3, `turtle PERFECT bot wins (leaks ${perfect.leaks})`);
  ok(perfect.events.some((e) => e.type === 'turtleDefeated'), 'turtle swims away for the perfect bot');
  ok(perfect.events.filter((e) => e.type === 'turtleHeadHit').length === 5, 'turtle takes 5 head hits (3+2) before phase 3');
  ok(perfect.events.some((e) => e.type === 'turtlePhase3'), 'turtle reaches phase 3');

  const nul = runBot(new Sim(compileLevel(def)), nullBot);
  eq(nul.stars, 0, 'turtle NULL bot fails');
  ok(nul.events.some((e) => e.type === 'levelEnd' && e.loseReason === 'swarm'), 'do-nothing loses the turtle to the swarm');

  const wrong = runBot(new Sim(compileLevel(def)), greedyWrongBot);
  eq(wrong.stars, 0, 'turtle GREEDY-WRONG bot fails');
  ok(wrong.events.every((e) => e.type !== 'turtleDefeated'), 'wrong-colour bot never beats the turtle');
}

function testAnemoneShift() {
  const def = LEVELS.find((d) => d.n === 46);
  const lvl = compileLevel(def);
  ok(lvl.anemone, 'L46 has a color-shift anemone');
  // Drive perfect bot; expect at least one repaint event over the run.
  const r = runBot(new Sim(lvl), perfectBot);
  ok(r.events.some((e) => e.type === 'anemoneShift'), 'anemone repaints enemy fish');
  ok(r.stars >= 3, `L46 perfect bot still 3★ despite anemone (score ${r.score}/${r.maxScore})`);
}

function testPrestigeRun() {
  for (const prestige of [1, 2]) {
    const defs = levelDefsFor(prestige);
    eq(defs.length, 50, `prestige ${prestige}: 50 levels`);
    // more colours in play at L10 than the base game
    const l10 = defs.find((d) => d.n === 10);
    ok(l10.colorsInPlay > 6, `prestige ${prestige}: L10 has extra colours (${l10.colorsInPlay})`);
    // mechanics arrive earlier
    const base = LEVELS.find((d) => d.coral).n;
    const pc = defs.find((d) => d.coral).n;
    ok(pc < base, `prestige ${prestige}: coral arrives earlier (${pc} < ${base})`);
    // a mechanic never triggers before L5
    ok(defs.every((d) => d.n >= 5 || (!d.coral && !d.anemone && d.currents === 0)), 'no mechanic before L5');
    // perfect bot still clears a sampling incl. the boss
    for (const n of [10, 30, 46, 50]) {
      const r = runBot(new Sim(compileLevel(defs.find((d) => d.n === n))), perfectBot);
      ok(r.stars >= 3, `prestige ${prestige} L${n} PERFECT bot 3★ (${r.score}/${r.maxScore})`);
    }
  }
}

// ---------------------------------------------------------------------------
function main() {
  testColors();
  testCooldown();
  testCollisionBasic();
  testWrongColorWeaves();
  testScoreFloor();
  testWhiteMachine();
  testWhiteWrongSecondHit();
  testBlackMachine();
  testTriMachine();
  testTriWrongOrder();
  testRainbowAdvancesSpecials();
  testSquidScoresHalf();
  testSquidOneEatNoPoint();
  testSquidEdgeLanesOpen();
  testSharkFullValue();
  testIceSlows();
  testLevelValidator();
  testBots();
  testDeterminism();
  testBlackSoftLockGuard();
  testCurrentPush();
  testCurrentFlips();
  testCurrentNotSharkSquid();
  testAmbushShark();
  testCoralBlocksEnemy();
  testCoralRemovesPlayer();
  testCoralDisintegrates();
  testSpecialRowsAndPicker();
  testNoEndUntilClear();
  testNoSpawnAfterTimer();
  testBossLevel();
  testTurtleBoss();
  testAnemoneShift();
  testPrestigeRun();

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) {
    console.log('\nFAILURES:');
    for (const f of fails.slice(0, 60)) console.log('  ✗ ' + f);
    process.exit(1);
  } else {
    console.log('ALL GREEN ✓');
  }
}
main();
