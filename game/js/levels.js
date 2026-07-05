// levels.js — level definitions (DATA) + deterministic compiler.
// A level is band params; compileLevel() expands to a concrete spawn list using
// the level seed. Rows are spaced so a perfect player always has time to draw the
// counters (feasible-by-construction: required launch-time <= apmGuardPct of gap).
// Nothing here imports three.js or the DOM.

import { COOLDOWN, LEVEL, POINTS, cooldownFor, opposite, CURRENT, CORAL, SPECIAL_ROWS, SHUFFLE_PICKER_FROM, FISH_DENSITY } from './config.js';
import { makeRng } from './rng.js';

// Enemy color pools by "colors in play" count.
const POOLS = {
  1: ['blue'],
  2: ['blue', 'orange'],
  3: ['blue', 'orange', 'red'],
  4: ['blue', 'orange', 'red', 'green'],
  5: ['blue', 'orange', 'red', 'green', 'yellow'],
  6: ['blue', 'orange', 'red', 'green', 'yellow', 'purple'],
};

// Player picker set for a given enemy pool = the opposite of each enemy color.
export function pickerFor(pool) {
  const set = [];
  for (const c of pool) {
    const o = opposite(c);
    if (!set.includes(o)) set.push(o);
  }
  return set;
}

// Point value of a spawn kind.
function pointsOf(kind) {
  if (kind === 'white') return POINTS.white;
  if (kind === 'black') return POINTS.black;
  if (kind === 'tri') return POINTS.tri;
  return POINTS.normal;
}

// Number of player launches a perfect player needs to resolve a spawn kind.
function launchesOf(kind) {
  if (kind === 'white') return 2; // hit, transform, kill (same color twice)
  if (kind === 'black') return 2; // hit -> becomes that color, kill w/ opposite
  if (kind === 'tri') return 3;   // peel 3 bands
  return 1;
}

// ---------------------------------------------------------------------------
// Level band table -> 40 level definitions, driven by an explicit progression:
//   colors: L1=1, L2-3=2, L4-5=3, L6-7=4, L8-9=5, L10+=6 (game has 6 colors max)
//   white fish from L12, black fish from L14, tri-color fish from L20.
// Difficulty knobs (speed, row size, gap) ramp smoothly with the level number.
// ---------------------------------------------------------------------------
function colorsFor(n) {
  if (n <= 1) return 1;
  if (n <= 3) return 2;
  if (n <= 5) return 3;
  if (n <= 7) return 4;
  if (n <= 9) return 5;
  return 6; // L10+ uses all six colors
}
function lanesFor(n) {
  if (n <= 11) return 5;
  if (n <= 24) return 6;
  return 7;
}
function specialsFor(n) {
  const s = {};
  if (n >= 12) s.white = Math.min(3, 1 + Math.floor((n - 12) / 5)); // white from L12
  if (n >= 14) s.black = Math.min(3, 1 + Math.floor((n - 14) / 5)); // black from L14
  if (n >= 20) s.tri = Math.min(2, 1 + Math.floor((n - 20) / 8));   // tri-color from L20
  return s;
}
function isIntroLevel(n) {
  // levels that introduce a new colour count or a new special fish -> taught in calm
  return [1, 2, 4, 6, 8, 10, 12, 14, 20].includes(n);
}

function buildLevelDefs() {
  const defs = [];
  for (let n = 1; n <= 40; n++) {
    const colors = colorsFor(n);
    const maxSize = n === 1 ? 1 : Math.max(3, Math.min(7, 3 + Math.floor((n - 2) / 7)));
    const def = {
      n,
      lanes: lanesFor(n),
      colorsInPlay: colors,
      speedMult: 0.85 + (n - 1) * 0.021,
      rowSizeMin: n === 1 ? 1 : 2,
      rowSizeMax: maxSize,
      minGap: Math.max(1.8, 3.0 - (n - 1) * 0.03),
      maxDistinct: Math.min(3, Math.max(1, colors - 1)),
      specials: specialsFor(n),
      newThing: isIntroLevel(n),
      duration: n === 1 ? 45 : undefined, // Level 1 is a shorter 45s tutorial
      currents: n >= CURRENT.twoFrom ? 2 : (n >= CURRENT.rowsFrom ? 1 : 0),
      coral: n >= CORAL.from,
    };
    defs.push(def);
  }

  // Post-process: +50% more columns (5→8, 6→9, 7→11) so lanes pack tighter.
  for (const d of defs) {
    d.lanes = Math.round(d.lanes * 1.5);
  }

  // Assign a stable seed per level.
  for (const d of defs) d.seed = 0x5F1E + d.n * 2654435761 >>> 0;
  return defs;
}

export const LEVELS = buildLevelDefs();

// ---------------------------------------------------------------------------
// compileLevel(def) -> concrete, deterministic level.
// Returns { n, lanes, pool, picker, spawns:[{t,lane,kind,color?,bands?,value}],
//           maxScore, passTarget, twoStar, threeStar }
// Rows are spaced by required perfect-player launch time / apmGuardPct so the
// level is always physically clearable.
// ---------------------------------------------------------------------------
export function compileLevel(def) {
  const rng = makeRng(def.seed);
  const pool = POOLS[def.colorsInPlay];
  const picker = pickerFor(pool);
  const lanes = def.lanes;
  const spawns = [];
  // Per-level duration (default = global). Spawns end ~10s before the clock so
  // stragglers can resolve.
  const duration = def.duration || LEVEL.duration;
  const spawnWindow = def.spawnWindow || Math.max(10, duration - 10);

  // Special budget to inject across the level.
  const specialsLeft = {
    white: (def.specials && def.specials.white) || 0,
    black: (def.specials && def.specials.black) || 0,
    tri: (def.specials && def.specials.tri) || 0,
  };
  const totalSpecials = specialsLeft.white + specialsLeft.black + specialsLeft.tri;

  // Density reduction on "new thing" levels (~20% fewer rows via larger gap).
  const gapScale = def.newThing ? 1.25 : 1.0;

  let t = 2.5; // first spawn
  let rowIndex = 0;
  // Spread specials evenly across the level's expected rows (keeps the tail empty).
  const estRows = Math.max(6, Math.floor(spawnWindow / def.minGap));
  const specialEveryRows = totalSpecials > 0
    ? Math.max(2, Math.floor(estRows / (totalSpecials + 1)))
    : Infinity;

  // Whole-row special kinds unlocked at higher levels.
  const specialRowKinds = [];
  if (def.n >= SPECIAL_ROWS.white) specialRowKinds.push('white');
  if (def.n >= SPECIAL_ROWS.black) specialRowKinds.push('black');
  if (def.n >= SPECIAL_ROWS.tri) specialRowKinds.push('tri');

  while (t < spawnWindow) {
    // Occasionally spawn a whole row of one special kind (same tri pattern).
    let rowKind = null;
    if (specialRowKinds.length && rowIndex > 0 && rng.chance(0.22)) {
      rowKind = rng.pick(specialRowKinds);
    }

    const rowFish = buildContiguousRow(rng, lanes, def, pool);
    const rowSpawns = [];
    if (rowKind) {
      const bands = rowKind === 'tri' ? rng.shuffle(pool).slice(0, 3) : null;
      for (const { lane } of rowFish) {
        if (rowKind === 'tri') rowSpawns.push({ t, lane, kind: 'tri', bands: bands.slice(), value: POINTS.tri });
        else rowSpawns.push({ t, lane, kind: rowKind, value: rowKind === 'white' ? POINTS.white : POINTS.black });
      }
    } else {
      // Maybe convert the first fish in this row into a single special.
      let injectedSpecial = null;
      if (totalSpecials > 0 && rowIndex > 0 && rowIndex % specialEveryRows === 0) {
        injectedSpecial = takeSpecial(specialsLeft);
      }
      for (let li = 0; li < rowFish.length; li++) {
        const { lane, color } = rowFish[li];
        if (injectedSpecial && li === 0) {
          rowSpawns.push(makeSpecialSpawn(t, lane, injectedSpecial, pool, rng));
        } else {
          rowSpawns.push({ t, lane, kind: 'normal', color, value: POINTS.normal });
        }
      }
    }
    for (const s of rowSpawns) spawns.push(s);

    // Compute perfect-player launch time to resolve this row, then space next row.
    // Wider gaps (÷ FISH_DENSITY) => ~10% fewer rows/fish across every level.
    const rowCost = rowLaunchTime(rowSpawns);
    const gap = (Math.max(def.minGap, rowCost / LEVEL.apmGuardPct) * gapScale
      + rng.next() * 0.4) / FISH_DENSITY;
    t += gap;
    rowIndex++;
  }

  // Any specials not yet injected: append as spaced singles before window close.
  let tailT = Math.min(t, spawnWindow - 6);
  for (const kind of ['white', 'black', 'tri']) {
    while (specialsLeft[kind] > 0) {
      const lane = rng.int(0, lanes - 1);
      const s = makeSpecialSpawn(tailT, lane, kind, pool, rng);
      spawns.push(s);
      specialsLeft[kind]--;
      tailT += Math.max(def.minGap, launchesOf(kind) * cooldownFor(1) / LEVEL.apmGuardPct);
      if (tailT > spawnWindow) tailT = spawnWindow - 1;
    }
  }

  spawns.sort((a, b) => a.t - b.t);

  // Black fish become an arbitrary picker color and must then be killed by its
  // opposite. So if the level contains black fish, the picker MUST be closed
  // under `opposite` — otherwise a legal hit could soft-lock the fish.
  const hasBlack = spawns.some((s) => s.kind === 'black');
  let finalPicker = picker;
  if (hasBlack) {
    finalPicker = picker.slice();
    for (const c of picker) {
      const o = opposite(c);
      if (!finalPicker.includes(o)) finalPicker.push(o);
    }
  }
  // From L30, shuffle the picker so the colour buttons are in a random order.
  if (def.n >= SHUFFLE_PICKER_FROM) {
    finalPicker = rng.shuffle(finalPicker === picker ? picker.slice() : finalPicker);
  }

  const maxScore = spawns.reduce((s, sp) => s + sp.value, 0);
  const passTarget = Math.ceil(maxScore * LEVEL.passPct);
  const twoStar = Math.ceil(maxScore * LEVEL.twoStarPct);
  const threeStar = Math.ceil(maxScore * LEVEL.threeStarPct);

  return { n: def.n, lanes, pool, picker: finalPicker, spawns, maxScore, passTarget, twoStar, threeStar, seed: def.seed, duration, spawnWindow, currents: def.currents || 0, coral: !!def.coral };
}

function pickRowLanes(rng, laneCount, sizeMin, sizeMax) {
  const size = Math.min(laneCount, rng.int(sizeMin, sizeMax));
  const all = [];
  for (let i = 0; i < laneCount; i++) all.push(i);
  return rng.shuffle(all).slice(0, size).sort((a, b) => a - b);
}

// Build a row as a CONTIGUOUS block of fish. Small rows (2-3) are a single
// color; larger rows are contiguous same-color runs of 2-3 (so the player
// always faces recognizable "rows of same-colored fish").
function buildContiguousRow(rng, laneCount, def, pool) {
  const size = Math.min(laneCount, rng.int(def.rowSizeMin, def.rowSizeMax));
  const start = rng.int(0, laneCount - size);
  const distinctCap = Math.min(def.maxDistinct, pool.length);
  const fish = [];
  if (size <= 3 || distinctCap <= 1) {
    const color = rng.pick(pool);
    for (let i = 0; i < size; i++) fish.push({ lane: start + i, color });
    return fish;
  }
  let li = start, lastColor = null;
  const distinctUsed = new Set();
  while (li < start + size) {
    const remaining = start + size - li;
    const runLen = Math.min(remaining, rng.int(2, 3));
    let color;
    if (lastColor === null) color = rng.pick(pool);
    else if (distinctUsed.size < distinctCap && rng.chance(0.7)) {
      do { color = rng.pick(pool); } while (color === lastColor);
    } else color = lastColor;
    distinctUsed.add(color); lastColor = color;
    for (let r = 0; r < runLen; r++) fish.push({ lane: li++, color });
  }
  return fish;
}

function pickRowColors(rng, pool, distinctCap) {
  const nDistinct = Math.min(distinctCap, 1 + Math.floor(rng.next() * distinctCap));
  return rng.shuffle(pool).slice(0, nDistinct);
}

function takeSpecial(left) {
  for (const kind of ['tri', 'black', 'white']) {
    if (left[kind] > 0) { left[kind]--; return kind; }
  }
  return null;
}

function makeSpecialSpawn(t, lane, kind, pool, rng) {
  if (kind === 'tri') {
    const bands = rng.shuffle(pool).slice(0, 3);
    return { t, lane, kind: 'tri', bands, value: POINTS.tri };
  }
  return { t, lane, kind, value: pointsOf(kind) };
}

// Perfect-player launch time to clear a row: group by (color, kind) then sum
// cooldowns. Specials need multiple same-color launches.
function rowLaunchTime(rowSpawns) {
  // Normal fish: group by color, one launch per color covers all lanes.
  const byColor = {};
  let cost = 0;
  for (const s of rowSpawns) {
    if (s.kind === 'normal') {
      byColor[s.color] = (byColor[s.color] || 0) + 1;
    } else {
      // Special resolved with dedicated launches (single-lane fish each launch).
      cost += launchesOf(s.kind) * cooldownFor(1);
    }
  }
  for (const c in byColor) cost += cooldownFor(byColor[c]);
  return cost;
}

export { pointsOf, launchesOf, rowLaunchTime, POOLS };

// ---------------------------------------------------------------------------
// The Deep — endless generator. Produces a chunk of escalating spawn rows
// starting at time `fromT`, difficulty scaled by `depthMeters`. Feasible-by-
// construction spacing is relaxed (endless is meant to eventually overwhelm).
// ---------------------------------------------------------------------------
export function compileDeepBase() {
  const pool = POOLS[6];
  return {
    n: 'deep', lanes: 11, pool, picker: pickerFor(pool),
    spawns: [], maxScore: Infinity, passTarget: 0, twoStar: 0, threeStar: 0,
    speedMult: 1.4, seed: 0xDEE9, endless: true,
  };
}

export function deepChunk(seed, fromT, depthMeters) {
  const rng = makeRng((seed ^ (Math.floor(fromT) * 2654435761)) >>> 0);
  const pool = POOLS[6];
  const lanes = 11;
  const spawns = [];
  const diff = 1 + depthMeters / 200;           // grows with depth
  const speedMult = 1.4 + Math.min(1.2, depthMeters / 300);
  const minGap = Math.max(1.0, 2.0 - depthMeters / 500);
  let t = fromT;
  const end = fromT + 30; // one 30s chunk
  while (t < end) {
    const size = Math.min(lanes, 2 + Math.floor(rng.next() * Math.min(lanes - 1, 2 + diff)));
    const all = [];
    for (let i = 0; i < lanes; i++) all.push(i);
    const rowLanes = rng.shuffle(all).slice(0, size).sort((a, b) => a - b);
    const nColors = Math.min(3, 1 + Math.floor(rng.next() * 3));
    const rowColors = rng.shuffle(pool).slice(0, nColors);
    // occasional specials once deep enough
    let specialKind = null;
    if (depthMeters > 40 && rng.chance(0.15)) specialKind = 'white';
    if (depthMeters > 90 && rng.chance(0.12)) specialKind = 'black';
    if (depthMeters > 150 && rng.chance(0.1)) specialKind = 'tri';
    for (let i = 0; i < rowLanes.length; i++) {
      const lane = rowLanes[i];
      if (specialKind && i === 0) {
        if (specialKind === 'tri') spawns.push({ t, lane, kind: 'tri', bands: rng.shuffle(pool).slice(0, 3), value: POINTS.tri });
        else spawns.push({ t, lane, kind: specialKind, value: 2 });
      } else {
        spawns.push({ t, lane, kind: 'normal', color: rowColors[i % rowColors.length], value: POINTS.normal });
      }
    }
    t += minGap + rng.next() * 0.6;
  }
  return { spawns, speedMult };
}
