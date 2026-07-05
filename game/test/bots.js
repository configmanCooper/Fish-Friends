// bots.js — autoplay bots that drive a headless Sim. Used by tests.
import { requiredPlayerColor } from '../js/sim.js';
import { opposite, COLORS } from '../js/config.js';
import { TICK_DT } from '../js/config.js';

// Assign each in-flight player fish to the nearest enemy above it that it can
// act on; returns a Set of covered enemy ids.
function coveredEnemyIds(sim) {
  const covered = new Set();
  const pool = sim.enemies.filter((e) => e.alive);
  // sort players by y desc (closest to enemies handled first)
  const players = sim.players.filter((p) => p.alive).slice().sort((a, b) => b.y - a.y);
  for (const p of players) {
    let best = null, bestD = Infinity;
    for (const e of pool) {
      if (e.lane !== p.lane) continue;
      if (covered.has(e.id)) continue;
      if (e.y < p.y - 0.001) continue; // enemy already below player, unreachable
      if (!actsOn(p.color, e)) continue;
      const d = e.y - p.y;
      if (d < bestD) { best = e; bestD = d; }
    }
    if (best) covered.add(best.id);
  }
  return covered;
}

function actsOn(color, e) {
  if (color === 'rainbow') return true;
  const need = requiredPlayerColor(e);
  if (need === null) return true;
  return color === need;
}

// PERFECT bot: always correct color, reacts instantly, batches by color.
// Restricted to the level's picker (like a real player) so infeasible levels fail.
export function perfectBot(sim) {
  if (!sim.isReady()) return;
  const covered = coveredEnemyIds(sim);
  const picker = sim.level.picker;
  const pickerSet = new Set(picker);
  // a color safe to hit a phase-0 special with: its opposite is also selectable
  // (guarantees the follow-up kill is feasible for black fish).
  const phase0Color = picker.find((c) => pickerSet.has(opposite(c))) || picker[0];
  const colorLanes = {}; // color -> Set(lane)
  for (const e of sim.enemies) {
    if (!e.alive || covered.has(e.id)) continue;
    if (e.y <= 0.14) continue;
    let need = requiredPlayerColor(e);
    if (need === null) need = phase0Color; // white/black phase0: any counter color
    if (!pickerSet.has(need)) continue;     // not selectable -> real player can't do it
    if (!colorLanes[need]) colorLanes[need] = new Set();
    colorLanes[need].add(e.lane);
  }
  // pick color covering most lanes
  let bestColor = null, bestLanes = null;
  for (const c in colorLanes) {
    const set = colorLanes[c];
    if (!bestLanes || set.size > bestLanes.size) { bestColor = c; bestLanes = set; }
  }
  if (bestColor) sim.launch([...bestLanes], bestColor);
}

// NULL bot: never launches.
export function nullBot() { /* nothing */ }

// GREEDY-WRONG bot: always launches a NON-counter color at alive enemies.
export function greedyWrongBot(sim) {
  if (!sim.isReady()) return;
  const lanes = new Set();
  let wrongColor = null;
  for (const e of sim.enemies) {
    if (!e.alive) continue;
    if (e.y <= 0.14) continue;
    lanes.add(e.lane);
    if (!wrongColor) {
      const need = requiredPlayerColor(e);
      // choose any color that is NOT the needed counter
      const candidate = need ? COLORS[need].opposite : 'blue';
      wrongColor = candidate; // opposite of the needed color never counters
    }
  }
  if (lanes.size > 0 && wrongColor) sim.launch([...lanes], wrongColor);
}

// Run a bot over a full level; returns { score, maxScore, stars, events }.
export function runBot(sim, bot, opts = {}) {
  const dt = TICK_DT;
  const events = [];
  let guard = 0;
  while (!sim.ended && guard < 60 * 200) {
    bot(sim);
    sim.tick(dt);
    for (const e of sim.drainEvents()) events.push(e);
    guard++;
  }
  const le = events.filter((e) => e.type === 'levelEnd').pop();
  return {
    score: sim.score, maxScore: sim.maxScore,
    stars: le ? le.stars : sim.starsForScore(sim.score),
    leaks: sim.leaks, kills: sim.kills, events,
  };
}
