// save.js — versioned localStorage save with a migration table.
const KEY = 'fishfriends.save';
const CURRENT_V = 2;

// Permanent Legacy (prestige) upgrades. Values are the number of times bought.
function legacyDefaults() {
  return { fishSpeed: 0, friendSlow: 0, rainbowChance: 0, freeShark: 0 };
}

function defaults() {
  return {
    v: CURRENT_V,
    furthestLevel: 1,
    bestStars: {},      // {levelN: stars}
    bestDepth: 0,
    starfish: 0,
    inventory: { ice: 0, shark: 0, rainbow: 0, squid: 0 },
    settings: { patterns: true, reducedMotion: false, mirror: false, sfx: true, music: true, autoShark: false },
    // ---- Legacy / prestige ----
    bossDefeated: false,   // has the L50 boss been beaten in the CURRENT run?
    legacy: legacyDefaults(), // permanent upgrades (persist across restarts)
    seahorses: 0,          // trophies: +1 per legacy restart
    prestige: 0,           // number of legacy restarts done (drives difficulty ramp)
    legacyIntroSeen: false, // has the first-boss-clear Legacy explainer been shown?
  };
}

// migration table: index i migrates from version i to i+1.
const MIGRATIONS = [
  // v1 -> v2: add legacy/prestige fields.
  (save) => {
    save.bossDefeated = false;
    save.legacy = legacyDefaults();
    save.seahorses = 0;
    save.prestige = 0;
    return save;
  },
];

export function load() {
  let raw;
  try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
  if (!raw) return defaults();
  let data;
  try { data = JSON.parse(raw); } catch (e) { return defaults(); }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return defaults();
  data = migrate(data);
  // fill any missing keys from defaults
  return Object.assign(defaults(), data, {
    settings: Object.assign(defaults().settings, data.settings || {}),
    inventory: Object.assign(defaults().inventory, data.inventory || {}),
    legacy: Object.assign(legacyDefaults(), data.legacy || {}),
  });
}

function migrate(data) {
  let v = data.v || 1;
  while (v < CURRENT_V && MIGRATIONS[v - 1]) { data = MIGRATIONS[v - 1](data); v++; data.v = v; }
  data.v = CURRENT_V;
  return data;
}

export function save(data) {
  data.v = CURRENT_V;
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore quota */ }
}

export function wipe() { try { localStorage.removeItem(KEY); } catch (e) {} }
