// config.js — ALL tuning for Fish Friends. No magic numbers elsewhere.
// Pure data module, safe to import in Node (no three.js / DOM).

// ---------------------------------------------------------------------------
// Colors & opposite pairs.
// Each color has an id, display name, hex, a pattern id (shared within a pair
// so colorblind players read "opposite" by marking, not hue), and its opposite.
// Pairs: Blue<->Orange (stripes), Red<->Green (dots), Yellow<->Purple (chevrons).
// ---------------------------------------------------------------------------
export const PATTERNS = { STRIPES: 0, DOTS: 1, CHEVRONS: 2, GRID: 3, WAVES: 4, TRIANGLES: 5 };

export const COLORS = {
  blue:   { id: 'blue',   name: 'Blue',   hex: 0x2f7be6, css: '#2f7be6', pattern: PATTERNS.STRIPES,  opposite: 'orange' },
  orange: { id: 'orange', name: 'Orange', hex: 0xf08a2a, css: '#f08a2a', pattern: PATTERNS.STRIPES,  opposite: 'blue'   },
  red:    { id: 'red',    name: 'Red',    hex: 0xe23b3b, css: '#e23b3b', pattern: PATTERNS.DOTS,     opposite: 'green'  },
  green:  { id: 'green',  name: 'Green',  hex: 0x35b84a, css: '#35b84a', pattern: PATTERNS.DOTS,     opposite: 'red'    },
  yellow: { id: 'yellow', name: 'Yellow', hex: 0xf4d21e, css: '#f4d21e', pattern: PATTERNS.CHEVRONS, opposite: 'purple' },
  purple: { id: 'purple', name: 'Purple', hex: 0x9a4fd0, css: '#9a4fd0', pattern: PATTERNS.CHEVRONS, opposite: 'yellow' },
  // Extra opposite pairs, unlocked only by Legacy prestige (each restart adds a pair).
  teal:    { id: 'teal',    name: 'Teal',    hex: 0x1fb6a6, css: '#1fb6a6', pattern: PATTERNS.GRID,      opposite: 'pink'    },
  pink:    { id: 'pink',    name: 'Pink',    hex: 0xf25fa0, css: '#f25fa0', pattern: PATTERNS.GRID,      opposite: 'teal'    },
  lime:    { id: 'lime',    name: 'Lime',    hex: 0x8bd41f, css: '#8bd41f', pattern: PATTERNS.WAVES,     opposite: 'magenta' },
  magenta: { id: 'magenta', name: 'Magenta', hex: 0xc026d3, css: '#c026d3', pattern: PATTERNS.WAVES,     opposite: 'lime'    },
  gold:    { id: 'gold',    name: 'Gold',    hex: 0xd9a521, css: '#d9a521', pattern: PATTERNS.TRIANGLES, opposite: 'indigo'  },
  indigo:  { id: 'indigo',  name: 'Indigo',  hex: 0x4f46e5, css: '#4f46e5', pattern: PATTERNS.TRIANGLES, opposite: 'gold'    },
};

// Colors ordered by opposite-pair. The first 2N entries are always closed under
// `opposite` (required for black-fish soft-lock safety). Base game uses the
// first 3 pairs (6 colors); each Legacy prestige adds one more pair.
export const ORDERED_PAIRS = [
  ['blue', 'orange'], ['red', 'green'], ['yellow', 'purple'],
  ['teal', 'pink'], ['lime', 'magenta'], ['gold', 'indigo'],
];
export const BASE_PAIRS = 3;               // pairs available in the un-prestiged game
export const MAX_PAIRS = ORDERED_PAIRS.length; // 6 pairs = 12 colors, hard cap

// Ordered color-id list for a given number of pairs (always opposite-closed).
export function colorIdsForPairs(pairs) {
  const p = Math.max(1, Math.min(MAX_PAIRS, pairs));
  const ids = [];
  for (let i = 0; i < p; i++) { ids.push(ORDERED_PAIRS[i][0], ORDERED_PAIRS[i][1]); }
  return ids;
}

export const ALL_COLOR_IDS = Object.keys(COLORS);

// Special / meta color markers used inside the sim (not real player colors).
export const SPECIAL = {
  WHITE: 'white',   // hit by ANY color -> becomes opposite of that color
  BLACK: 'black',   // hit by ANY color -> becomes that color
  TRI:   'tri',     // 3 bands front->back, hit front's opposite to peel
  RAINBOW: 'rainbow', // player-only power-up fish; counts as any opposite
};

export function opposite(colorId) {
  const c = COLORS[colorId];
  return c ? c.opposite : null;
}

// True if playerColor destroys / correctly-acts-on a plain enemy of enemyColor.
export function isCounter(playerColor, enemyColor) {
  if (playerColor === SPECIAL.RAINBOW) return true;
  return opposite(enemyColor) === playerColor;
}

// ---------------------------------------------------------------------------
// Field geometry (abstract sim units; render maps these to world space).
// The field is a unit rectangle: x in [0,1] across lanes, y in [0,1] bottom->top.
// Enemies spawn at y>1 and move down; player fish launch near y=0 and move up.
// ---------------------------------------------------------------------------
export const FIELD = {
  drawStripTop: 0.15,   // draw strip occupies y in [0, 0.15]
  launchY: 0.12,        // player fish are born here
  topSpawnY: 1.08,      // enemies born just above the visible top
  bottomLeakY: 0.0,     // enemy reaching here => leak (-1)
  topExitY: 1.05,       // player fish reaching here => harmless exit
  collideRadiusY: 0.045, // |yA - yB| < this (same lane) => meeting
  enemyFollowGap: 0.06,  // min vertical gap between same-lane enemy fish (no piling/overtaking)
};

// ---------------------------------------------------------------------------
// Movement speeds (field-units per second).
// ---------------------------------------------------------------------------
export const SPEED = {
  enemyBase: 0.068,     // base enemy descend speed (20% slower than the original 0.085)
  player: 0.34,         // player fish ascend speed (fast, feels responsive)
  friendSwimOff: 0.9,   // paired "friends" swim off screen this fast (render only)
  whiteMult: 0.6,       // white fish speed multiplier
  triMult: 0.8,         // tri-color speed multiplier
  iceMult: 0.5,         // ice cube slows enemies to half
  sharkMult: 0.5,       // shark ascends at half a player fish's speed
};

// ---------------------------------------------------------------------------
// Draw cooldown: launching starts a recharge of base + perFish * fishCount.
// Disabled (0) — the player can draw fish as fast as they like.
// ---------------------------------------------------------------------------
export const COOLDOWN = {
  base: 0,
  perFish: 0,
};
export function cooldownFor(fishCount) {
  return COOLDOWN.base + COOLDOWN.perFish * Math.max(1, fishCount);
}
export const COOLDOWN_ENABLED = COOLDOWN.base > 0 || COOLDOWN.perFish > 0;

// ---------------------------------------------------------------------------
// Level rules.
// ---------------------------------------------------------------------------
export const LEVEL = {
  duration: 60,         // seconds (one-minute levels)
  spawnWindow: 50,      // all spawns scheduled within this
  passPct: 0.50,        // 1 star
  twoStarPct: 0.75,
  threeStarPct: 0.95,
  apmGuardPct: 0.80,    // required APM must be <= 80% of cooldown-possible
};

export const STAR_THRESHOLDS = [LEVEL.passPct, LEVEL.twoStarPct, LEVEL.threeStarPct];

// Point value per fish type (used for max-score computation).
export const POINTS = {
  normal: 1,
  white: 2,   // 2 correct hits
  black: 2,   // 2 correct hits
  tri: 3,     // 3 correct hits
};

// ---------------------------------------------------------------------------
// Shop / power-ups.
// ---------------------------------------------------------------------------
export const PRICES = { ice: 2, shark: 3, rainbow: 5, squid: 6 };
export const INV_CAP = 4;

export const POWERUPS = {
  ice:     { id: 'ice',     name: 'Ice Cube',   icon: '🧊', price: PRICES.ice,     duration: 15 },
  shark:   { id: 'shark',   name: 'Shark',      icon: '🦈', price: PRICES.shark,   duration: 2.5, lanesWide: 3 },
  rainbow: { id: 'rainbow', name: 'Rainbow',    icon: '🌈', price: PRICES.rainbow, duration: 15 },
  squid:   { id: 'squid',   name: 'Giant Squid',icon: '🦑', price: PRICES.squid,   duration: 30 },
};

// Intro levels for specials (used by validator + level generator).
export const SPECIAL_INTRO = { white: 12, black: 14, tri: 20 };

// ---------------------------------------------------------------------------
// Grid "rows" (horizontal bands) used by water currents & coral reefs.
// Row 0 is closest to the beach (bottom), the last row is at the top.
// ---------------------------------------------------------------------------
export const ROWS = 6;
export const ROW_YS = Array.from({ length: ROWS }, (_, i) => 0.22 + 0.56 * i / (ROWS - 1));

// Water currents: a horizontal band that shoves fish 1 lane left/right as they
// cross it; direction flips every `flipInterval` seconds.
export const CURRENT = {
  flipInterval: 15,
  band: 0.04,                 // crossing detection half-height
  rowsFrom: 25,               // currents appear from this level
  twoFrom: 28,                // two currents from this level
  candidateRows: [1, 2, 3, 4],// never the row nearest the beach or the top
};

// Coral reef: a single grid cell that blocks fish. Moves every `moveInterval`s,
// disintegrates `disintegrateBefore` seconds before the level ends.
export const CORAL = {
  from: 30,                   // coral appears from this level
  moveInterval: 10,
  disintegrateBefore: 10,
  candidateRows: [2, 3],      // never the first two or last two rows
  stopMargin: 0.03,
  stackSpacing: 0.06,
};

// Levels that can spawn full rows of a special fish, and shuffled picker.
export const SPECIAL_ROWS = { white: 30, black: 33, tri: 35 };
export const SHUFFLE_PICKER_FROM = 30;

// Global fish-count scaler: rows are spaced wider by 1/FISH_DENSITY so every
// level spawns ~FISH_DENSITY of the fish it otherwise would (0.9 = 10% fewer).
export const FISH_DENSITY = 0.9;

// ---------------------------------------------------------------------------
// Endless "The Deep".
// ---------------------------------------------------------------------------
export const DEEP = {
  unlockLevel: 50,    // The Deep unlocks after the L50 boss
  metersPer30s: 10,
  starfishPer: 100,   // +1 starfish per 100m
};

// ---------------------------------------------------------------------------
// Total authored levels (campaign) and the boss level.
// ---------------------------------------------------------------------------
export const TOTAL_LEVELS = 50;
export const BOSS_LEVEL = 50;

// ---------------------------------------------------------------------------
// Color-shift anemone (new mechanic, from L46). A grid cell that repaints any
// enemy fish crossing it to a new random color from the level pool. Players,
// sharks and the squid are unaffected (like currents).
// ---------------------------------------------------------------------------
export const ANEMONE = {
  from: 46,                     // anemones appear from this level
  band: 0.045,                  // crossing detection half-height
  moveInterval: 8,              // hops to a new lane every N seconds
  candidateRows: [1, 2, 3, 4],  // never the row nearest the beach or the top
};

// ---------------------------------------------------------------------------
// Prism Whale boss (L50). Modeled as one damage-shared creature with a segment
// per occupied lane; hit a segment with the OPPOSITE of its current color to
// deal 1 damage, then that segment goes briefly invulnerable. 3 phases scale the
// colour-cycle speed; the final phase gives every lane its own colour.
// ---------------------------------------------------------------------------
export const BOSS = {
  hp: 80,                       // total hits to defeat (base; +15 per prestige)
  hpPerPrestige: 15,
  lanesWide: 2,                 // whale spans two lanes
  backY: 0.8,                   // furthest-back position (start)
  beachY: 0.14,                 // reaching here = you lose
  steps: 8,                     // discrete advance steps from back to beach
  hitRadius: 0.11,              // contact half-height (big body)
  segCooldown: 0.55,            // seconds a lane is inert after a contact
  cyclePeriod: 6.0,             // colour-cycle period (seconds) — slow so shots land fresh
  phase3CycleMult: 3,           // final phase changes each half's colour 3x slower
  phaseAt: { p2: 0.66, p3: 0.33 }, // hp-fraction thresholds for phases 2 & 3
  splitWithin: 5,               // final phase: hit BOTH halves' opposites within this
  advanceEvery: 10,             // advances one step per this many seconds without a hit
  lateralEvery: 10,             // strafes one lane left/right every this many seconds
  retreatHits: 3,               // hits needed…
  retreatWindow: 15,            // …within this many seconds to shove it back a step
  maxLeaks: 20,                 // this many fish past you = you lose
  fishSpeedMult: 0.9,           // whale-fight fish friends swim 10% slower
  fish: {                       // descending fish while you fight the whale
    every: 3.2,                 // seconds between fish rows (~25% fewer than 2.4)
    rowMin: 1, rowMax: 3,
    whiteChance: 0.10,
    blackChance: 0.10,
    triChance: 0.04,            // 50% fewer tri fish
  },
};

// ---------------------------------------------------------------------------
// Boss roster — the L50 boss alternates each Legacy restart (prestige).
// prestige 0 -> Prism Whale, prestige 1 -> Sea Turtle, then repeat.
// ---------------------------------------------------------------------------
export const BOSS_ROSTER = ['whale', 'turtle'];
export function bossTypeFor(prestige) {
  return BOSS_ROSTER[((prestige || 0) % BOSS_ROSTER.length + BOSS_ROSTER.length) % BOSS_ROSTER.length];
}

// ---------------------------------------------------------------------------
// Ancient Sea Turtle boss (L50, prestige 1). A huge turtle at the back whose
// shell is dotted with colour splotches. Clear the splotches with their opposite
// colours to make it poke its painted head out; hit the head with its opposite
// to damage it. Phase 2 it advances and slowly spins an 18-spot shell. Phase 3
// (25% hp) it spins fast, sheds paint, self-drains to 1% while you survive, then
// swims away for the win. Lose if 30 fish reach the beach. No timer.
// ---------------------------------------------------------------------------
export const TURTLE = {
  hp: 100,                    // base; +20 per prestige-pair
  hpPerPrestige: 20,
  maxLeaks: 30,               // this many fish past you = you lose
  hitRadius: 0.09,            // contact half-height for spots/head
  segCooldown: 0.5,           // seconds a spot/head is inert after a contact
  rimDepth: 0.13,             // how far the front-rim splotch arc dips toward the player
  headLane: null,             // centre lane (computed)
  // Phase 1: head tucked; shell fills the back row with one splotch per lane.
  p1: { headOut: 5, hits: 3, shellY: 0.86, headY: 0.72, damagePerHit: null },
  // Phase 2: advances; head in middle; shell slowly spins an 18-spot ring.
  p2: { headOut: 10, hits: 2, shellY: 0.7, headY: 0.54, spinPeriod: 15, spots: 18, frontArc: 6 },
  // Phase 3 (<=25% hp): fast spin, self-drain, sheds paint, two currents.
  p3: { atFrac: 0.25, drainPct: 0.01, drainEvery: 3, spinPeriod: 7,
        fishMult: 1.1, speedMult: 1.1, paintMin: 2, paintMax: 3, paintSpeed: 0.5,
        currentLoRow: 1, currentHiRow: 4, leaveSpeed: 0.4 },
  fishSpeedMult: 0.9,         // fight fish 10% slower (like the whale)
  fish: { every: 3.2, rowMin: 1, rowMax: 3, whiteChance: 0.10, blackChance: 0.10, triChance: 0.04 },
};

// ---------------------------------------------------------------------------
// Legacy (prestige) upgrades. Each purchase applies `per` up to `cap`.
// ---------------------------------------------------------------------------
export const LEGACY_UPGRADES = {
  fishSpeed:     { id: 'fishSpeed',     name: 'Swift Fins',       icon: '⚡', cost: 3, per: 0.01, cap: 0.20, kind: 'pct',
                   desc: '+1% player fish speed (max +20%)' },
  friendSlow:    { id: 'friendSlow',    name: 'Sluggish Tide',    icon: '🐌', cost: 3, per: 0.01, cap: 0.20, kind: 'pct',
                   desc: '-1% enemy fish speed (max -20%)' },
  rainbowChance: { id: 'rainbowChance', name: 'Rainbow Instinct', icon: '🌈', cost: 5, per: 0.01, cap: 0.10, kind: 'pct',
                   desc: '+1% chance a drawn fish is rainbow (max 10%)' },
  freeShark:     { id: 'freeShark',     name: 'Patrol Shark',     icon: '🦈', cost: 5, per: 0.05, cap: 0.50, kind: 'pct',
                   desc: '+5% chance/level of a free shark at 0:30 (max 50%)' },
};
// Max purchases per upgrade = cap / per.
export function legacyMaxBuys(id) {
  const u = LEGACY_UPGRADES[id];
  return u ? Math.round(u.cap / u.per) : 0;
}
export function legacyValue(id, buys) {
  const u = LEGACY_UPGRADES[id];
  if (!u) return 0;
  return Math.min(u.cap, (buys || 0) * u.per);
}

// ---------------------------------------------------------------------------
// Seahorse Powers. Each Seahorse Trophy lets you keep ONE power active (you can
// enable up to `seahorses` of the five, and swap them any time — they aren't
// consumed). Applied at runtime; they only ever help the player.
// ---------------------------------------------------------------------------
export const SEAHORSE_POWERS = {
  prism:     { id: 'prism',     name: 'Prism Dash',   icon: '💎',
               desc: 'When your fish makes a friend, 50% chance it passes through and becomes a rainbow fish. Those rainbow fish never cost points if they reach the top.' },
  ambush:    { id: 'ambush',    name: 'Ambush Shark', icon: '🦈',
               desc: 'Place a shark out in the ocean instead of on the beach. It sweeps its row across to one side, then back the other way once.' },
  voyager:   { id: 'voyager',   name: 'Reef Voyager', icon: '🧭',
               desc: 'Your fish swim through coral reefs, turn rainbow when passing an anemone, and speed up 50% through currents.' },
  schooling: { id: 'schooling', name: 'Schooling',    icon: '🐟',
               desc: 'Friending a fish also brings along every other same-colour fish in its row as friends — extra points included.' },
  transmute: { id: 'transmute', name: 'Transmuter',   icon: '✨',
               desc: 'Tri fish become black, black become white, white become a plain colour. Plus: double points for friending black and white fish.' },
};
export const SEAHORSE_POWER_IDS = Object.keys(SEAHORSE_POWERS);

// ---------------------------------------------------------------------------
// Prestige difficulty ramp. Each restart adds one color pair and pulls the
// mechanic-intro levels earlier by 5, capped so nothing lands before L5 and the
// ramp stops growing after PRESTIGE_RAMP_CAP restarts.
// ---------------------------------------------------------------------------
export const PRESTIGE_RAMP_CAP = 3;    // difficulty stops increasing beyond this
export const PRESTIGE_SHIFT_PER = 5;   // levels-earlier per prestige
export const PRESTIGE_MIN_LEVEL = 5;   // a mechanic never triggers before this

export function prestigePairs(prestige) {
  return Math.min(MAX_PAIRS, BASE_PAIRS + Math.min(prestige, PRESTIGE_RAMP_CAP));
}
export function prestigeShift(prestige) {
  return Math.min(prestige, PRESTIGE_RAMP_CAP) * PRESTIGE_SHIFT_PER;
}
// Apply the prestige "earlier" shift to a base intro level, with a floor.
export function shiftedIntro(baseLevel, prestige) {
  return Math.max(PRESTIGE_MIN_LEVEL, baseLevel - prestigeShift(prestige));
}

// ---------------------------------------------------------------------------
// Sim tick.
// ---------------------------------------------------------------------------
export const TICK_HZ = 60;
export const TICK_DT = 1 / TICK_HZ;
