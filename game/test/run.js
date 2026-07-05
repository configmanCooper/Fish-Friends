// run.js — Fish Friends headless test suite. Plain asserts, no deps.
import {
  COLORS, opposite, isCounter, cooldownFor, LEVEL, POINTS, SPECIAL,
} from '../js/config.js';
import { LEVELS, compileLevel, rowLaunchTime, launchesOf } from '../js/levels.js';
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
  eq(cooldownFor(1), 0.75, 'cooldown 1 fish');
  eq(Math.round(cooldownFor(3) * 100) / 100, 1.45, 'cooldown 3 fish');
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
  eq(LEVELS.length, 40, 'exactly 40 authored levels');
  for (const def of LEVELS) {
    const lvl = compileLevel(def);
    ok(lvl.maxScore > 0, `L${def.n} maxScore > 0`);
    eq(lvl.passTarget, Math.ceil(lvl.maxScore * 0.5), `L${def.n} passTarget = 50%`);
    // spawn window
    const lastT = lvl.spawns[lvl.spawns.length - 1].t;
    ok(lastT <= LEVEL.spawnWindow + 0.001, `L${def.n} last spawn <= ${LEVEL.spawnWindow}s (got ${lastT.toFixed(1)})`);
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
    ok(totalCost <= LEVEL.apmGuardPct * LEVEL.duration + 0.001,
      `L${def.n} required launch time ${totalCost.toFixed(1)}s <= ${(LEVEL.apmGuardPct * LEVEL.duration).toFixed(1)}s`);
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
