// config.js — ALL tuning for Fish Friends. No magic numbers elsewhere.
// Pure data module, safe to import in Node (no three.js / DOM).

// ---------------------------------------------------------------------------
// Colors & opposite pairs.
// Each color has an id, display name, hex, a pattern id (shared within a pair
// so colorblind players read "opposite" by marking, not hue), and its opposite.
// Pairs: Blue<->Orange (stripes), Red<->Green (dots), Yellow<->Purple (chevrons).
// ---------------------------------------------------------------------------
export const PATTERNS = { STRIPES: 0, DOTS: 1, CHEVRONS: 2 };

export const COLORS = {
  blue:   { id: 'blue',   name: 'Blue',   hex: 0x2f7be6, css: '#2f7be6', pattern: PATTERNS.STRIPES,  opposite: 'orange' },
  orange: { id: 'orange', name: 'Orange', hex: 0xf08a2a, css: '#f08a2a', pattern: PATTERNS.STRIPES,  opposite: 'blue'   },
  red:    { id: 'red',    name: 'Red',    hex: 0xe23b3b, css: '#e23b3b', pattern: PATTERNS.DOTS,     opposite: 'green'  },
  green:  { id: 'green',  name: 'Green',  hex: 0x35b84a, css: '#35b84a', pattern: PATTERNS.DOTS,     opposite: 'red'    },
  yellow: { id: 'yellow', name: 'Yellow', hex: 0xf4d21e, css: '#f4d21e', pattern: PATTERNS.CHEVRONS, opposite: 'purple' },
  purple: { id: 'purple', name: 'Purple', hex: 0x9a4fd0, css: '#9a4fd0', pattern: PATTERNS.CHEVRONS, opposite: 'yellow' },
};

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
};

// ---------------------------------------------------------------------------
// Movement speeds (field-units per second).
// ---------------------------------------------------------------------------
export const SPEED = {
  enemyBase: 0.085,     // base enemy descend speed at level 1
  player: 0.34,         // player fish ascend speed (fast, feels responsive)
  friendSwimOff: 0.9,   // paired "friends" swim off screen this fast (render only)
  whiteMult: 0.6,       // white fish speed multiplier
  triMult: 0.8,         // tri-color speed multiplier
  iceMult: 0.5,         // ice cube slows enemies to half
  sharkMult: 0.5,       // shark ascends at half a player fish's speed
};

// ---------------------------------------------------------------------------
// Draw cooldown: launching starts a recharge of base + perFish * fishCount.
// ---------------------------------------------------------------------------
export const COOLDOWN = {
  base: 0.4,
  perFish: 0.35,
  // helper
};
export function cooldownFor(fishCount) {
  return COOLDOWN.base + COOLDOWN.perFish * Math.max(1, fishCount);
}

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
export const INV_CAP = 3;

export const POWERUPS = {
  ice:     { id: 'ice',     name: 'Ice Cube',   icon: '🧊', price: PRICES.ice,     duration: 15 },
  shark:   { id: 'shark',   name: 'Shark',      icon: '🦈', price: PRICES.shark,   duration: 2.5, lanesWide: 3 },
  rainbow: { id: 'rainbow', name: 'Rainbow',    icon: '🌈', price: PRICES.rainbow, duration: 15 },
  squid:   { id: 'squid',   name: 'Giant Squid',icon: '🦑', price: PRICES.squid,   duration: 30 },
};

// Intro levels for specials (used by validator + level generator).
export const SPECIAL_INTRO = { white: 12, black: 14, tri: 20 };

// ---------------------------------------------------------------------------
// Endless "The Deep".
// ---------------------------------------------------------------------------
export const DEEP = {
  unlockLevel: 40,
  metersPer30s: 10,
  starfishPer: 100,   // +1 starfish per 100m
};

// ---------------------------------------------------------------------------
// Sim tick.
// ---------------------------------------------------------------------------
export const TICK_HZ = 60;
export const TICK_DT = 1 / TICK_HZ;
