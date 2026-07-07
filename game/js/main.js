// main.js — boot, Game controller, fixed-timestep loop. Wires all modules.
import { TICK_DT, LEVEL, DEEP, POWERUPS, DEEP as DEEPCFG, TOTAL_LEVELS, BOSS_LEVEL,
  LEGACY_UPGRADES, legacyValue, legacyMaxBuys, SEAHORSE_POWERS, SEAHORSE_POWER_IDS } from './config.js';
import { LEVELS, compileLevel, compileDeepBase, deepChunk, levelDefsFor } from './levels.js';
import { Sim } from './sim.js';
import { Render3D } from './render3d.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { buy as shopBuy } from './shop.js';
import * as Save from './save.js';
import * as Audio from './audio.js';
import { Debug } from './debug.js';

class Game {
  constructor() {
    this.save = Save.load();
    this.campaign = levelDefsFor(this.save.prestige || 0); // prestige-adjusted level defs
    this.canvas = document.getElementById('game-canvas');
    this.render = new Render3D(this.canvas);
    this.ui = new UI(document.getElementById('ui-root'), this);
    this.input = new Input(this.canvas, this.render, this);
    this.debug = new Debug();

    this.state = 'title';
    this.sim = null;
    this.level = null;
    this.levelN = 1;
    this.selectedColor = null;
    this.paused = false;
    this.acc = 0;
    this.lastT = performance.now();

    // powerup placement
    this.pendingShark = false;
    this.sharkLane = 0;

    // deep state
    this.deep = false;
    this.deepDepth = 0;
    this.deepLife = 5;
    this.deepNextChunk = 0;

    // god mode (cheat): type "f1shyfr1ends" while in a level, or enter it in Codes
    this.godMode = false;
    this._cheatBuf = '';

    this.ui.renderSettings(this.save.settings);
    Audio.setEnabled(this.save.settings.sfx);
    Audio.setMusicEnabled(this.save.settings.music);

    this.ui.renderTitle(this.save, this.godMode);
    this.ui.show('title');
    this._rotateGate();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'game' && !this.paused) this.pause();
    });
    window.addEventListener('pointerdown', () => { Audio.unlock(); Audio.playMusic('map'); }, { once: true });
    window.addEventListener('keydown', (e) => this._cheatKey(e));
    this._setupInstallPrompt();

    requestAnimationFrame((t) => this._loop(t));
  }

  // ---- PWA install prompt (Android/desktop Chrome) -----------------------
  _setupInstallPrompt() {
    this._installEvent = null;
    const btn = document.getElementById('btn-install');
    // Already running as an installed app? never show.
    const installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();           // stop Chrome's mini-infobar; we drive it
      this._installEvent = e;
      if (btn && !installed) btn.style.display = '';
    });
    window.addEventListener('appinstalled', () => {
      this._installEvent = null;
      if (btn) btn.style.display = 'none';
      this.ui.toast('Installed! 🐟');
    });
  }
  async promptInstall() {
    const btn = document.getElementById('btn-install');
    if (!this._installEvent) {
      this.ui.toast('Use your browser menu → "Add to Home screen"');
      return;
    }
    this._installEvent.prompt();
    try { await this._installEvent.userChoice; } catch (_) {}
    this._installEvent = null;
    if (btn) btn.style.display = 'none';
  }

  // Detect the "f1shyfr1ends" cheat sequence anywhere -> toggle god mode.
  _cheatKey(e) {
    if (!e.key || e.key.length !== 1) return;
    this._cheatBuf = (this._cheatBuf + e.key.toLowerCase()).slice(-12);
    if (this._cheatBuf === 'f1shyfr1ends') this._toggleGod();
  }
  _toggleGod() {
    this.godMode = !this.godMode;
    this.ui.toast(this.godMode
      ? '🐟 GOD MODE — unlimited starfish + all levels'
      : 'God mode off');
    // reflect immediately on whichever screen is showing
    if (this.state === 'map') this.ui.renderMap(this.save, this.godMode);
    else if (this.state === 'shop') this.ui.renderShop(this.save, this.godMode);
    else if (this.state === 'title') this.ui.renderTitle(this.save, this.godMode);
  }

  // ---- navigation --------------------------------------------------------
  goToMap() {
    this._stopPlay();
    this.state = 'map';
    Audio.playMusic('map');
    this.ui.renderMap(this.save, this.godMode);
    this.ui.show('map');
  }
  goToTitle() {
    this._stopPlay();
    this.state = 'title';
    Audio.playMusic('map');
    this.ui.renderTitle(this.save, this.godMode);
    this.ui.show('title');
  }
  wipeData() {
    const yes = (typeof confirm === 'function') ? confirm('Delete ALL progress, starfish and settings? This cannot be undone.') : true;
    if (!yes) return;
    Save.wipe();
    location.reload();
  }
  openSettings() { this.ui.renderSettings(this.save.settings); this.ui.show('settings'); }
  openCodes() {
    const inp = document.getElementById('code-input');
    if (inp) inp.value = '';
    const msg = document.getElementById('code-msg');
    if (msg) { msg.textContent = ''; msg.className = 'code-msg'; }
    this.ui.show('codes');
    if (inp) setTimeout(() => inp.focus(), 50);
  }
  submitCode(raw) {
    const code = (raw || '').trim().toLowerCase();
    const msg = document.getElementById('code-msg');
    const show = (text, ok) => { if (msg) { msg.textContent = text; msg.className = 'code-msg ' + (ok ? 'good' : 'bad'); } };
    if (code === 'f1shyfr1ends') {
      if (!this.godMode) this._toggleGod();
      else this.ui.toast('God mode already on');
      show('🐟 God mode activated!', true);
    } else if (!code) {
      show('Enter a code first.', false);
    } else {
      show('Unknown code.', false);
    }
  }
  openShop() { this.ui.renderShop(this.save, this.godMode); this.ui.show('shop'); }

  openPreLevel(n) {
    this.levelN = n;
    this.level = compileLevel(this.campaign[n - 1]);
    this.state = 'prelevel';
    this.ui.renderPreLevel(n, this.level);
    this.ui.show('prelevel');
  }

  // Legacy upgrade effect values (fractions) passed to the Sim.
  _legacyOpts() {
    const lg = this.save.legacy || {};
    return {
      fishSpeed: legacyValue('fishSpeed', lg.fishSpeed),
      friendSlow: legacyValue('friendSlow', lg.friendSlow),
      rainbowChance: legacyValue('rainbowChance', lg.rainbowChance),
      freeShark: legacyValue('freeShark', lg.freeShark),
    };
  }

  buyItem(kind) {
    if (this.godMode) {
      // unlimited starfish: grant the item free and ignore the stack cap (sharks ×2)
      this.save.inventory[kind] = (this.save.inventory[kind] || 0) + (kind === 'shark' ? 2 : 1);
      Audio.sfx.buy(); Save.save(this.save); this.ui.renderShop(this.save, true);
      return;
    }
    if (shopBuy(this.save, kind)) { Audio.sfx.buy(); Save.save(this.save); this.ui.renderShop(this.save); }
  }

  setSetting(key, val) {
    this.save.settings[key] = val;
    if (key === 'sfx') Audio.setEnabled(val);
    if (key === 'music') { Audio.setMusicEnabled(val); if (val && this.state === 'map') Audio.playMusic('map'); }
    if (key === 'mirror') this.ui.renderSettings(this.save.settings);
    Save.save(this.save);
  }

  // Active Seahorse Powers this run: the first `seahorses` enabled powers.
  activePowers() {
    const list = Array.isArray(this.save.seahorsePowers) ? this.save.seahorsePowers : [];
    const cap = this.godMode ? 99 : (this.save.seahorses || 0);
    return list.filter((id) => SEAHORSE_POWERS[id]).slice(0, cap);
  }

  // ---- level lifecycle ---------------------------------------------------
  beginLevel() {
    this.deep = false;
    this.sim = new Sim(this.level, { legacy: this._legacyOpts(), powers: this.activePowers() });
    this.render.setLevel(this.level.lanes);
    this.selectedColor = this.level.picker[0];
    this.pendingShark = false;
    this.sharkRowY = 0.5;
    this.itemsUsedThisLevel = new Set(); // each item once per level
    this.itemUseCount = 0;               // max 3 items per level
    this.acc = 0;
    this.paused = false;
    this.state = 'game';
    this.ui.renderPicker(this.level, this.selectedColor);
    this.ui.renderDock(this.save, this.itemsUsedThisLevel, this.itemUseCount);
    this.ui.show('game');
    Audio.playMusic('game');
  }

  nextLevel() {
    const n = Math.min(TOTAL_LEVELS, this.levelN + 1);
    this.openPreLevel(n);
  }
  replayLevel() { this.openPreLevel(this.levelN); }

  _endLevel(res) {
    // starfish awarded = improvement over previous best stars for this level.
    const prevBest = this.save.bestStars[this.levelN] || 0;
    let earned = 0;
    if (res.stars > prevBest) { earned = res.stars - prevBest; this.save.bestStars[this.levelN] = res.stars; }
    if (res.passed && this.levelN >= this.save.furthestLevel && this.levelN < TOTAL_LEVELS) {
      this.save.furthestLevel = Math.min(TOTAL_LEVELS, this.levelN + 1);
    }
    // Beating the L50 boss unlocks The Deep AND the Legacy menu.
    const firstEverClear = res.boss && res.bossWon && !this.save.legacyIntroSeen;
    if (res.boss && res.bossWon) {
      this.save.bossDefeated = true;
      if (this.save.furthestLevel <= BOSS_LEVEL) this.save.furthestLevel = BOSS_LEVEL + 1;
      res.bossFirstClear = true;
    }
    this.save.starfish += earned;
    Save.save(this.save);
    res.earned = earned;
    res.legacyUnlocked = !!this.save.bossDefeated;
    res.bossType = this.level.bossType || null;
    if (res.stars >= 1) Audio.sfx.star();
    // The very first boss victory shows a congratulations + Legacy explainer.
    if (firstEverClear) {
      this.state = 'legacyintro';
      this.ui.renderLegacyIntro(this.save);
      this.ui.show('legacyintro');
      return;
    }
    this.state = 'results';
    this.ui.renderResults(res);
    this.ui.show('results');
  }

  // Dismiss the first-clear Legacy explainer -> straight into the Legacy menu.
  dismissLegacyIntro() {
    this.save.legacyIntroSeen = true;
    Save.save(this.save);
    this.openLegacy();
  }

  // ---- Legacy (prestige) -------------------------------------------------
  openLegacy() {
    // Viewable even while locked (post-restart): renderLegacy shows the locked
    // state and buyLegacy/confirmPrestige guard the actual actions.
    this.state = 'legacy';
    this.ui.renderLegacy(this.save);
    this.ui.show('legacy');
  }

  // Open/close the Seahorse Powers chooser.
  openPowers() {
    if ((this.save.seahorses || 0) <= 0 && !this.godMode) return;
    this.state = 'powers';
    this.ui.renderPowers(this.save, this.activePowers());
    this.ui.show('powers');
  }

  // Toggle a Seahorse Power on/off. You can enable up to `seahorses` of them.
  togglePower(id) {
    if (!SEAHORSE_POWERS[id]) return;
    let list = Array.isArray(this.save.seahorsePowers) ? this.save.seahorsePowers.slice() : [];
    const cap = this.godMode ? SEAHORSE_POWER_IDS.length : (this.save.seahorses || 0);
    if (list.includes(id)) {
      list = list.filter((x) => x !== id);
    } else {
      if (list.length >= cap) return; // at slot capacity
      list.push(id);
    }
    this.save.seahorsePowers = list;
    Save.save(this.save);
    this.ui.renderPowers(this.save, this.activePowers());
  }

  buyLegacy(id) {
    if (!this.save.bossDefeated) return;           // locked after a restart until re-beaten
    const u = LEGACY_UPGRADES[id];
    if (!u) return;
    const cur = this.save.legacy[id] || 0;
    if (cur >= legacyMaxBuys(id)) return;          // at cap
    if (this.godMode) { this.save.legacy[id] = cur + 1; }
    else {
      if (this.save.starfish < u.cost) return;
      this.save.starfish -= u.cost;
      this.save.legacy[id] = cur + 1;
    }
    Audio.sfx.buy && Audio.sfx.buy();
    Save.save(this.save);
    this.ui.renderLegacy(this.save);
  }

  // Restart progress: keep permanent upgrades + seahorses, wipe run progress,
  // grant a seahorse trophy, and raise the prestige difficulty.
  confirmPrestige() {
    if (!this.save.bossDefeated) return;
    const yes = (typeof confirm === 'function')
      ? confirm('Restart your journey? You keep all Legacy upgrades and earn a Seahorse Trophy, but your levels, starfish and items reset — and the seas grow harder. Upgrades lock until you beat the boss again.')
      : true;
    if (!yes) return;
    this.doPrestige();
  }

  doPrestige() {
    this.save.seahorses = (this.save.seahorses || 0) + 1;
    this.save.prestige = (this.save.prestige || 0) + 1;
    this.save.furthestLevel = 1;
    this.save.bestStars = {};
    this.save.starfish = 0;
    this.save.inventory = { ice: 0, shark: 0, rainbow: 0, squid: 0 };
    this.save.bossDefeated = false; // upgrades locked until the boss is beaten again
    Save.save(this.save);
    this.campaign = levelDefsFor(this.save.prestige);
    Audio.sfx.star && Audio.sfx.star();
    this.ui.renderLegacy(this.save);
    this.goToMap();
  }

  // ---- The Deep ----------------------------------------------------------
  startDeep() {
    const deepUnlocked = this.godMode || this.save.bossDefeated || this.save.furthestLevel > DEEPCFG.unlockLevel;
    if (!deepUnlocked) { this.ui.toast && this.ui.show('map'); return; }
    this.level = compileDeepBase();
    this.sim = new Sim(this.level, { endless: true, legacy: this._legacyOpts(), powers: this.activePowers() });
    this.render.setLevel(this.level.lanes);
    this.selectedColor = this.level.picker[0];
    this.deep = true;
    this.deepDepth = 0;
    this.deepLife = 5;
    this.deepNextChunk = 0;
    this.deepStarfishBanked = 0;
    this.pendingShark = false;
    this.itemsUsedThisLevel = new Set();
    this.itemUseCount = 0;
    this.acc = 0; this.paused = false;
    this.state = 'game';
    this.ui.renderPicker(this.level, this.selectedColor);
    this.ui.renderDock(this.save, this.itemsUsedThisLevel, this.itemUseCount);
    this.ui.show('game');
    Audio.playMusic('game');
  }

  _feedDeep() {
    // ensure ~30s of spawns ahead of current time
    while (this.deepNextChunk < this.sim.time + 30) {
      const chunk = deepChunk(this.level.seed, this.deepNextChunk, this.deepDepth);
      for (const s of chunk.spawns) this.sim.level.spawns.push(s);
      this.level.speedMult = chunk.speedMult;
      this.deepNextChunk += 30;
    }
  }

  _endDeep() {
    const meters = Math.floor(this.deepDepth);
    const earned = Math.floor(meters / DEEPCFG.starfishPer);
    if (meters > (this.save.bestDepth || 0)) this.save.bestDepth = meters;
    this.save.starfish += earned;
    Save.save(this.save);
    this.deep = false;
    this.state = 'results';
    this.ui.renderResults({ passed: true, score: meters, maxScore: meters, stars: 3, earned });
    document.getElementById('res-title').textContent = `The Deep — ${meters}m`;
    document.getElementById('res-stars').textContent = `🌊 Depth ${meters}m`;
    document.getElementById('res-next').textContent = 'Dive Again';
    document.getElementById('res-next').dataset.action = 'deep';
    this.ui.show('results');
  }

  // ---- input hooks -------------------------------------------------------
  isPlaying() { return this.state === 'game' && this.sim && !this.sim.ended && !this.paused; }

  selectColor(c) { this.selectedColor = c; this.ui.updatePickerSelection(c); }

  tryLaunch(lanes) {
    if (!this.isPlaying()) return;
    const ok = this.sim.launch(lanes, this.selectedColor);
    if (ok) Audio.sfx.launch(); else { Audio.sfx.deny(); this.ui.toast('Not yet — recharging'); }
  }

  useItem(kind) {
    if (!this.isPlaying()) return;
    if ((this.save.inventory[kind] || 0) <= 0) return;
    // Per-level limits (normal levels only; The Deep is unrestricted).
    if (!this.deep) {
      if (kind === 'shark' && this.pendingShark) { this.pendingShark = false; this.ui.toast('Shark cancelled'); this._renderDock(); return; }
      if (this.itemsUsedThisLevel.has(kind)) { this.ui.toast(`${POWERUPS[kind].name} already used this level`); return; }
      if (this.itemUseCount >= 3) { this.ui.toast('Item limit reached (3 per level)'); return; }
    }
    if (kind === 'shark') {
      if (this.pendingShark) { this.pendingShark = false; this.ui.toast('Shark cancelled'); this._renderDock(); return; }
      this.pendingShark = true;
      this.sharkLane = Math.floor(this.level.lanes / 2) - 1;
      this.ui.toast(this.sim.powers.ambush
        ? 'Tap the ocean for an ambush sweep, or the beach for a rising pair'
        : 'Drag on the seabed to aim the shark');
      return;
    }
    this._markItemUsed(kind);
    this._consume(kind);
    if (kind === 'ice') { this.sim.useIce(); Audio.sfx.squid(); }
    if (kind === 'rainbow') { this.sim.useRainbow(); Audio.sfx.transform(); }
    if (kind === 'squid') { this.sim.useSquid(); Audio.sfx.squid(); }
  }

  confirmShark() {
    if (!this.pendingShark) return;
    this.pendingShark = false;
    this._markItemUsed('shark');
    this._consume('shark');
    const ambush = this.sim.powers.ambush;
    const onBeach = this.sharkRowY <= (POWERUPS.shark.ambushBeachY || 0.2);
    if (ambush && !onBeach) {
      // Ambush Shark: drop it into the ocean at the aimed row (edge-entry sweep).
      this.sim.useAmbushShark(this.sharkLane, this.sharkRowY);
    } else {
      // Normal rising shark; with the Ambush power a beach shark gets a free partner.
      this.sim.useShark(this.sharkLane);
      if (ambush) this.sim.useShark(this.sim.partnerSharkLane(this.sharkLane));
    }
    Audio.sfx.shark();
  }

  _markItemUsed(kind) {
    if (this.deep) return;
    this.itemsUsedThisLevel.add(kind);
    this.itemUseCount++;
  }
  _renderDock() {
    this.ui.renderDock(this.save, this.itemsUsedThisLevel, this.itemUseCount, this.deep);
  }

  _consume(kind) {
    this.save.inventory[kind] = Math.max(0, (this.save.inventory[kind] || 0) - 1);
    Save.save(this.save);
    this._renderDock();
  }

  // ---- pause -------------------------------------------------------------
  pause() { if (this.state === 'game') { this.paused = true; this.ui.showPause(); } }
  async resume() {
    this.ui.hidePause();
    await this.ui.countdown();
    this.paused = false;
    this.lastT = performance.now();
  }

  _stopPlay() { this.paused = false; this.pendingShark = false; }

  // Auto-deploy a shark in a lane when an enemy is within ~1s of the bottom,
  // if the setting is on and the player has a shark in inventory. Counts as the
  // level's single shark use — at most one auto-deploy per level play (like a
  // manual shark), and none if a shark was already used this level.
  _autoShark() {
    if (!this.save.settings.autoShark) return;
    const s = this.sim;
    if (!s || s.ended) return;
    if ((this.save.inventory.shark || 0) <= 0) return;
    // Respect the per-level item limits (auto + manual share the 1-shark cap).
    if (!this.deep) {
      if (this.itemsUsedThisLevel.has('shark')) return;
      if (this.itemUseCount >= 3) return;
    }
    const covered = new Set();
    for (const sh of s.sharks) for (const l of sh.lanes) covered.add(l);
    for (const e of s.enemies) {
      if (!e.alive || covered.has(e.lane)) continue;
      const spd = s.enemySpeed(e);
      if (spd <= 0 || e.y <= 0) continue;
      if (e.y / spd <= 1.0) {
        s.useShark(e.lane - 1);
        this._markItemUsed('shark');   // this is your one shark for the level
        this._consume('shark');
        Audio.sfx.shark();
        break;                          // only one auto-deploy per level play
      }
    }
  }

  // ---- loop --------------------------------------------------------------
  _loop(now) {
    requestAnimationFrame((t) => this._loop(t));
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (dt > 0.1) dt = 0.1;

    const inGame = this.state === 'game';
    if (inGame && !this.paused && this.sim) {
      if (this.deep) this._feedDeep();
      this.acc += dt;
      let steps = 0;
      while (this.acc >= TICK_DT && steps < 8) {
        this.sim.tick(TICK_DT);
        this.acc -= TICK_DT; steps++;
        const events = this.sim.drainEvents();
        this.render.handleEvents(events, this.sim);
        this._audioForEvents(events);
        if (this.deep) this._deepAccount(events);
        const le = events.find((e) => e.type === 'levelEnd');
        if (le && !this.deep) { this._endLevel(le); break; }
      }
      if (this.deep) {
        this.deepDepth += dt * (DEEPCFG.metersPer30s / 30);
        if (this.deepLife <= 0) this._endDeep();
      }
      this._autoShark();
    }

    this.render.update(dt, inGame && !this.paused ? this.sim : (inGame ? this.sim : null));

    if (inGame && this.sim) {
      if (this.deep) {
        this.ui.updateHUD(0, Math.floor(this.deepDepth), this.deepLife, this.sim.cooldownProgress(), this.pendingShark);
        document.getElementById('hud-timer').textContent = `${Math.floor(this.deepDepth)}m`;
        document.getElementById('hud-score').textContent = `❤ ${this.deepLife}`;
      } else if (this.level.kind === 'boss') {
        this.ui.updateBossHud(this.sim);
        const b = this.sim.boss;
        document.getElementById('hud-timer').textContent = '🐋 Boss';
        document.getElementById('hud-score').textContent = b ? `${b.maxHp - b.hp}/${b.maxHp}` : '';
      } else {
        this.ui.updateHUD(this.sim.time, this.sim.score, this.level.passTarget, this.sim.cooldownProgress(), this.pendingShark, this.level.duration);
        this.ui.updateBossHud(null);
      }
    }
    this.debug.frame(dt, this.render, inGame ? this.sim : null);
  }

  _deepAccount(events) {
    for (const e of events) if (e.type === 'leak') this.deepLife -= 1;
  }

  _audioForEvents(events) {
    for (const e of events) {
      if (e.type === 'fishKilled') Audio.sfx.pop();
      else if (e.type === 'leak') Audio.sfx.leak();
      else if (e.type === 'weave') Audio.sfx.weave();
      else if (e.type === 'transform') Audio.sfx.transform();
    }
  }

  _rotateGate() {
    const gate = document.getElementById('rotate-gate');
    const check = () => {
      const landscapePhone = window.innerWidth > window.innerHeight && Math.min(window.innerWidth, window.innerHeight) < 600;
      gate.style.display = landscapePhone ? 'flex' : 'none';
    };
    window.addEventListener('resize', check);
    check();
  }
}

window.addEventListener('DOMContentLoaded', () => { window.game = new Game(); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support optional */ });
  });
}
