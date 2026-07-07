// ui.js — DOM screens + HUD, one state machine. Reads/writes via the game object.
import { COLORS } from './config.js';
import { POWERUPS, INV_CAP, LEVEL, DEEP, COOLDOWN_ENABLED,
  LEGACY_UPGRADES, legacyMaxBuys, legacyValue, BOSS_LEVEL,
  SEAHORSE_POWERS, SEAHORSE_POWER_IDS, bossTypeFor } from './config.js';
import { LEVELS } from './levels.js';

const SCREENS = ['title', 'map', 'prelevel', 'game', 'results', 'shop', 'settings', 'codes', 'legacy', 'legacyintro', 'powers'];

// Starfish icon (inline SVG) — the game's currency & level rating.
// Chunky rounded 5-armed sea-star (fat quadratic-bezier arms) with bump spots.
const STARFISH_PATH = 'M 8.18 6.74 Q 12 -3 15.82 6.74 Q 26.27 7.36 18.18 14.01 Q 20.82 24.14 12 18.5 Q 3.18 24.14 5.82 14.01 Q -2.27 7.36 8.18 6.74 Z';
function sfSVG(size, filled = true) {
  const fill = filled ? '#f2933a' : 'rgba(255,255,255,0.12)';
  const stroke = filled ? '#c9761d' : 'rgba(255,255,255,0.3)';
  const dots = filled
    ? '<g fill="#ffd9a8" opacity="0.8">' +
      '<circle cx="12" cy="12" r="1.4"/>' +
      '<circle cx="12" cy="5.6" r="0.9"/>' +
      '<circle cx="18.4" cy="9.9" r="0.9"/>' +
      '<circle cx="15.9" cy="17.3" r="0.9"/>' +
      '<circle cx="8.1" cy="17.3" r="0.9"/>' +
      '<circle cx="5.6" cy="9.9" r="0.9"/>' +
      '</g>'
    : '';
  return `<svg class="sf" viewBox="0 0 24 24" width="${size}" height="${size}" style="vertical-align:middle;margin:0 1px"><path d="${STARFISH_PATH}" fill="${fill}" stroke="${stroke}" stroke-width="1.1" stroke-linejoin="round"/>${dots}</svg>`;
}
const SF = sfSVG(16), SF_BIG = sfSVG(22), SF_SM = sfSVG(13);

// Seahorse trophy icon (inline SVG) — the Legacy prestige trophy. A filled
// silhouette (trumpet snout, crowned spiky head, dorsal fin, coiled tail) in the
// starfish's hand-drawn style. Reads as a seahorse from 16px up.
const SEAHORSE_SIL = 'M4.6 7.9 C6.2 7.2 7.5 6.9 8.5 6.0 C9.0 4.9 9.2 4.1 9.9 3.6 L10.2 2.3 L10.9 3.5 L11.6 2.1 L12.3 3.4 L13.1 2.6 L13.6 3.9 C14.5 4.4 14.8 5.3 14.4 6.1 L15.1 6.7 L14.5 7.5 C15.3 8.3 15.2 9.3 14.6 10.1 L15.1 10.7 L14.4 11.5 C14.7 12.5 14.5 13.5 13.8 14.3 L14.3 15.0 L13.3 15.7 C12.9 16.7 12.9 17.7 13.4 18.5 C14.2 19.7 13.8 21.2 12.2 21.5 C10.7 21.8 9.5 20.7 9.7 19.2 C9.8 18.0 10.8 17.3 12.0 17.5 C12.9 17.6 13.2 18.5 12.7 19.2 C12.4 19.7 11.6 19.8 11.2 19.3 C10.7 18.7 10.9 17.5 10.6 16.4 C10.2 15.0 9.4 13.8 9.2 12.3 C9.0 10.9 9.7 9.9 9.0 8.7 C8.7 8.2 8.2 8.0 7.8 8.1 C6.7 8.3 5.6 8.4 5.0 8.6 C4.5 8.7 4.3 8.3 4.6 7.9 Z';
const SEAHORSE_FIN = 'M14.6 9.6 C16.2 9.2 17.2 10.4 17.0 11.8 C16.9 12.9 15.9 13.6 14.7 13.4 C14.9 12.1 14.8 10.8 14.6 9.6 Z';
function shSVG(size, filled = true) {
  const fill = filled ? '#c67a33' : 'rgba(255,255,255,0.14)';
  const finFill = filled ? '#b96f2b' : 'rgba(255,255,255,0.10)';
  const dark = filled ? '#8a531d' : 'rgba(255,255,255,0.3)';
  const eye = filled
    ? '<circle cx="10.9" cy="5.6" r="1.15" fill="#2b1808"/><circle cx="10.55" cy="5.25" r="0.35" fill="#f6e2c4"/>'
    : '<circle cx="10.9" cy="5.6" r="1.05" fill="rgba(0,0,0,0.25)"/>';
  return `<svg class="sh" viewBox="0 0 24 24" width="${size}" height="${size}" style="vertical-align:middle;margin:0 1px">`
    + `<path d="${SEAHORSE_FIN}" fill="${finFill}" stroke="${dark}" stroke-width="0.7" stroke-linejoin="round"/>`
    + `<path d="${SEAHORSE_SIL}" fill="${fill}" stroke="${dark}" stroke-width="0.8" stroke-linejoin="round"/>`
    + `${eye}</svg>`;
}
const SH = shSVG(16), SH_BIG = shSVG(22), SH_SM = shSVG(13);

export class UI {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this._build();
    this._bind();
  }

  _build() {
    this.root.innerHTML = `
      <div class="screen" id="s-title">
        <div class="title-wrap">
          <div class="logo">🐟 Fish Friends</div>
          <div class="tagline">Match opposite colors — send them swimming off together.</div>
          <button class="btn btn-primary" data-action="play">Play</button>
          <button class="btn" data-action="deep" id="btn-deep">The Deep 🌊</button>
          <button class="btn" data-action="settings">Settings ⚙️</button>
          <button class="btn" data-action="install" id="btn-install" style="display:none">📲 Install App</button>
        </div>
      </div>

      <div class="screen" id="s-map">
        <div class="map-top">
          <button class="chip" data-action="title" title="Main Menu">🏠</button>
          <button class="chip" data-action="settings">⚙️</button>
          <div class="chip star-chip">${SF} <span id="map-starfish">0</span></div>
          <button class="chip" data-action="shop">🛒 Shop</button>
        </div>
        <div class="map-title">Choose a Level</div>
        <div class="level-grid" id="level-grid"></div>
        <button class="btn deep-btn" data-action="deep" id="map-deep">🌊 The Deep (Endless)</button>
        <button class="btn legacy-btn" data-action="legacy" id="map-legacy" style="display:none">🐚 Legacy Menu</button>
      </div>

      <div class="screen" id="s-prelevel">
        <div class="card">
          <div class="card-level" id="pre-level">Level 1</div>
          <div class="card-target" id="pre-target"></div>
          <div class="card-colors" id="pre-colors"></div>
          <div class="card-demo" id="pre-demo"></div>
          <button class="btn btn-primary" data-action="swim">Swim ▶</button>
          <button class="btn btn-small" data-action="back-map">Back</button>
        </div>
      </div>

      <div class="screen" id="s-game">
        <div id="hud-top">
          <button class="hud-btn" data-action="pause">⏸</button>
          <div class="hud-timer" id="hud-timer">1:00</div>
          <div class="hud-score" id="hud-score">0/0</div>
        </div>
        <div id="boss-hud" style="display:none">
          <div class="boss-name" id="boss-name">🐋 Prism Whale</div>
          <div class="boss-hpbar"><div class="boss-hpfill" id="boss-hpfill"></div></div>
        </div>
        <div id="powerup-dock"></div>
        <div id="picker"></div>
        <div id="cooldown-strip"><div id="cooldown-fill"></div></div>
      </div>

      <div class="screen" id="s-results">
        <div class="card">
          <div class="card-level" id="res-title">Level Complete</div>
          <div class="score-bar"><div class="score-fill" id="res-fill"></div>
            <span class="thr thr1"></span><span class="thr thr2"></span><span class="thr thr3"></span>
          </div>
          <div class="res-score" id="res-score"></div>
          <div class="res-stars" id="res-stars"></div>
          <div class="res-earn" id="res-earn"></div>
          <div class="res-buttons">
            <button class="btn btn-primary" data-action="next" id="res-next">Next ▶</button>
            <button class="btn" data-action="replay">Replay</button>
            <button class="btn" data-action="shop">Shop 🛒</button>
            <button class="btn" data-action="back-map">Map</button>
          </div>
        </div>
      </div>

      <div class="screen" id="s-shop">
        <div class="card wide">
          <div class="card-level">Shop</div>
          <div class="star-chip big">${SF_BIG} <span id="shop-starfish">0</span></div>
          <div class="shop-grid" id="shop-grid"></div>
          <button class="btn btn-primary" data-action="continue-shop">Continue ▶</button>
        </div>
      </div>

      <div class="screen" id="s-settings">
        <div class="card">
          <div class="card-level">Settings</div>
          <label class="set-row"><span>Colorblind patterns</span><input type="checkbox" data-setting="patterns"></label>
          <label class="set-row"><span>Reduced motion</span><input type="checkbox" data-setting="reducedMotion"></label>
          <label class="set-row"><span>Left-handed layout</span><input type="checkbox" data-setting="mirror"></label>
          <label class="set-row"><span>Sound effects</span><input type="checkbox" data-setting="sfx"></label>
          <label class="set-row"><span>Music</span><input type="checkbox" data-setting="music"></label>
          <label class="set-row"><span>Auto-deploy shark near bottom</span><input type="checkbox" data-setting="autoShark"></label>
          <button class="btn btn-danger" data-action="wipe-data">🗑️ Delete All Data</button>
          <button class="btn btn-primary" data-action="back-map">Done</button>
          <button class="btn btn-small" data-action="open-codes">Codes</button>
        </div>
      </div>

      <div class="screen" id="s-codes">
        <div class="card">
          <div class="card-level">Enter a Code</div>
          <div class="card-target">Type a secret code and hit Enter.</div>
          <input type="text" id="code-input" class="code-input" placeholder="code…" autocomplete="off" autocapitalize="none" spellcheck="false">
          <div class="code-msg" id="code-msg"></div>
          <button class="btn btn-primary" data-action="submit-code">Enter</button>
          <button class="btn btn-small" data-action="settings">Back</button>
        </div>
      </div>

      <div class="screen" id="s-legacyintro">
        <div class="card wide legacy-intro-card">
          <div class="li-trophy">${shSVG(72)}</div>
          <div class="card-level">The Prism Whale is at peace!</div>
          <div class="li-congrats">You've beaten the final boss and unlocked <strong>Legacy</strong>.</div>
          <div class="li-explain">
            <p>🐚 <strong>Legacy</strong> is where your journey lives on. Spend leftover
               ${SF_SM} starfish on <strong>permanent upgrades</strong> — they stay with you forever.</p>
            <p>♻️ When you're ready, <strong>restart your journey</strong> to keep every upgrade,
               earn a <strong>Seahorse Trophy</strong> ${SH_SM}, and face tougher seas — one extra
               colour and hazards arriving sooner each time.</p>
            <p>Your upgrades lock until you defeat the whale again — then you can buy more.</p>
          </div>
          <button class="btn btn-primary" data-action="legacy-intro-ok">Open Legacy 🐚</button>
        </div>
      </div>

      <div class="screen" id="s-legacy">
        <div class="card wide">
          <div class="legacy-corner">
            <div class="legacy-seahorse">${shSVG(64)}</div>
            <div class="seahorse-count"><span id="legacy-seahorses">0</span> ${SH_SM}</div>
          </div>
          <div class="card-level">🐚 Legacy</div>
          <div class="legacy-top">
            <div class="chip star-chip big">${SF_BIG} <span id="legacy-starfish">0</span></div>
            <button class="btn btn-small" data-action="powers" id="legacy-powers-btn">⚡ Powers</button>
          </div>
          <div class="legacy-god" id="legacy-god" style="display:none"></div>
          <div class="legacy-note" id="legacy-note"></div>
          <div class="legacy-grid" id="legacy-grid"></div>
          <button class="btn btn-danger" data-action="prestige-restart" id="legacy-restart">♻️ Restart Journey (+1 ${SH_SM})</button>
          <button class="btn btn-primary" data-action="back-map">Back</button>
        </div>
      </div>

      <div class="screen" id="s-powers">
        <div class="card wide">
          <div class="legacy-corner"><div class="legacy-seahorse">${shSVG(56)}</div></div>
          <div class="card-level">⚡ Seahorse Powers</div>
          <div class="legacy-note" id="powers-note"></div>
          <div class="powers-grid" id="powers-grid"></div>
          <button class="btn btn-primary" data-action="legacy">Back</button>
        </div>
      </div>

      <div class="overlay" id="pause-overlay">
        <div class="card">
          <div class="card-level">Paused</div>
          <button class="btn btn-primary" data-action="resume">Resume</button>
          <button class="btn" data-action="restart">Restart</button>
          <button class="btn" data-action="back-map">Quit to Map</button>
          <button class="btn" data-action="settings">Settings ⚙️</button>
        </div>
      </div>

      <div class="overlay" id="countdown-overlay"><div id="countdown-num"></div></div>
      <div id="toast"></div>
    `;
  }

  _bind() {
    this.root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (el) { e.preventDefault(); this._action(el.dataset.action, el); return; }
    });
    this.root.addEventListener('change', (e) => {
      const s = e.target.closest('[data-setting]');
      if (s) this.game.setSetting(s.dataset.setting, s.checked);
    });
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target && e.target.id === 'code-input') {
        e.preventDefault(); this.game.submitCode(e.target.value);
      }
    });
  }

  _action(a, el) {
    const g = this.game;
    switch (a) {
      case 'play': g.goToMap(); break;
      case 'install': g.promptInstall(); break;
      case 'title': g.goToTitle(); break;
      case 'deep': g.startDeep(); break;
      case 'legacy': g.openLegacy(); break;
      case 'legacy-intro-ok': g.dismissLegacyIntro(); break;
      case 'powers': g.openPowers(); break;
      case 'toggle-power': g.togglePower(el.dataset.power); break;
      case 'buy-legacy': g.buyLegacy(el.dataset.legacy); break;
      case 'prestige-restart': g.confirmPrestige(); break;
      case 'prestige-inc': g.setPrestige((g.save.prestige || 0) + 1); break;
      case 'prestige-dec': g.setPrestige((g.save.prestige || 0) - 1); break;
      case 'settings': g.openSettings(); break;
      case 'open-codes': g.openCodes(); break;
      case 'submit-code': g.submitCode(document.getElementById('code-input').value); break;
      case 'shop': g.openShop(); break;
      case 'back-map': g.goToMap(); break;
      case 'start-level': g.openPreLevel(+el.dataset.level); break;
      case 'swim': g.beginLevel(); break;
      case 'next': g.nextLevel(); break;
      case 'replay': g.replayLevel(); break;
      case 'retry': g.replayLevel(); break;
      case 'continue-shop': g.goToMap(); break;
      case 'buy': g.buyItem(el.dataset.item); break;
      case 'wipe-data': g.wipeData(); break;
      case 'pause': g.pause(); break;
      case 'resume': g.resume(); break;
      case 'restart': g.replayLevel(); break;
      case 'use-item': g.useItem(el.dataset.item); break;
      case 'select-color': g.selectColor(el.dataset.color); break;
    }
  }

  show(screen) {
    for (const s of SCREENS) {
      const el = document.getElementById('s-' + s);
      if (el) el.classList.toggle('active', s === screen);
    }
    if (screen !== 'game') { this.hidePause(); this.updateBossHud(null); }
  }

  // ---- Title / Map -------------------------------------------------------
  renderMap(saveData, godMode = false) {
    document.getElementById('map-starfish').innerHTML = godMode ? '∞' : saveData.starfish;
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    // The L50 boss icon reflects the current journey's boss (whale or turtle).
    const bossIcon = bossTypeFor(saveData.prestige || 0) === 'turtle' ? '🐢' : '🐋';
    for (const def of LEVELS) {
      const n = def.n;
      const unlocked = godMode || n <= saveData.furthestLevel;
      const stars = saveData.bestStars[n] || 0;
      const b = document.createElement('button');
      const isBoss = n === BOSS_LEVEL;
      b.className = 'level-bubble' + (unlocked ? '' : ' locked') + (n === saveData.furthestLevel ? ' current' : '') + (isBoss ? ' boss' : '');
      b.innerHTML = `<span class="lvl-n">${isBoss ? bossIcon : n}</span><span class="lvl-stars">${starStr(stars)}</span>`;
      if (unlocked) { b.dataset.action = 'start-level'; b.dataset.level = n; }
      grid.appendChild(b);
    }
    const deepBtn = document.getElementById('map-deep');
    const deepUnlocked = godMode || saveData.bossDefeated || saveData.furthestLevel > DEEP.unlockLevel;
    deepBtn.style.display = deepUnlocked ? '' : 'none';
    document.getElementById('btn-deep').style.display = deepUnlocked ? '' : 'none';
    // Legacy menu becomes visible once the boss has ever been beaten (or has
    // upgrades/seahorses from a prior run).
    const legBtn = document.getElementById('map-legacy');
    const legacyVisible = godMode || saveData.bossDefeated || (saveData.seahorses || 0) > 0
      || Object.values(saveData.legacy || {}).some((v) => v > 0);
    if (legBtn) legBtn.style.display = legacyVisible ? '' : 'none';
  }

  // Boss HP bar (shown only during a boss level). Pass the Sim (or null).
  updateBossHud(sim) {
    const hud = document.getElementById('boss-hud');
    if (!hud) return;
    const boss = sim && sim.boss;
    const turtle = sim && sim.turtle;
    if (!boss && !turtle) { hud.style.display = 'none'; return; }
    hud.style.display = '';
    const fill = document.getElementById('boss-hpfill');
    const name = document.getElementById('boss-name');
    if (turtle) {
      const frac = turtle.maxHp > 0 ? Math.max(0, turtle.hp / turtle.maxHp) : 0;
      if (fill) fill.style.width = (frac * 100).toFixed(1) + '%';
      const left = Math.max(0, (turtle.maxLeaks || 30) - (sim.leaks || 0));
      if (name) name.textContent = `🐢 Ancient Sea Turtle — Phase ${turtle.phase}  ·  🐟 ${left} left`;
      return;
    }
    const frac = boss.maxHp > 0 ? Math.max(0, boss.hp / boss.maxHp) : 0;
    if (fill) fill.style.width = (frac * 100).toFixed(1) + '%';
    const leaks = sim.leaks || 0, maxLeaks = 20;
    if (name) name.textContent = `🐋 Prism Whale — Phase ${boss.phase}  ·  🐟 ${Math.max(0, maxLeaks - leaks)} left`;
  }

  // ---- Legacy menu -------------------------------------------------------
  renderLegacyIntro(saveData) {
    document.getElementById('s-legacyintro'); // static content; nothing dynamic needed
  }

  renderLegacy(saveData) {
    const godMode = this.game && this.game.godMode;
    document.getElementById('legacy-starfish').innerHTML = godMode ? '∞' : saveData.starfish;
    document.getElementById('legacy-seahorses').textContent = saveData.seahorses || 0;
    const locked = !saveData.bossDefeated;
    const note = document.getElementById('legacy-note');
    note.textContent = locked
      ? 'Upgrades are locked until you defeat the Prism Whale again. Your permanent bonuses below still apply.'
      : 'Spend starfish on permanent upgrades — they persist through every restart.';
    const grid = document.getElementById('legacy-grid');
    grid.innerHTML = '';
    for (const id in LEGACY_UPGRADES) {
      const u = LEGACY_UPGRADES[id];
      const buys = (saveData.legacy && saveData.legacy[id]) || 0;
      const maxBuys = legacyMaxBuys(id);
      const atCap = buys >= maxBuys;
      const pct = Math.round(legacyValue(id, buys) * 100);
      const canBuy = !locked && !atCap && (godMode || saveData.starfish >= u.cost);
      const row = document.createElement('div');
      row.className = 'legacy-item' + (atCap ? ' maxed' : '') + (locked ? ' locked' : '');
      row.innerHTML =
        `<div class="li-icon">${u.icon}</div>` +
        `<div class="li-body"><div class="li-name">${u.name} <span class="li-cur">(${pct}%${atCap ? ' • MAX' : ''})</span></div>` +
        `<div class="li-desc">${u.desc}</div>` +
        `<div class="li-pips">${'●'.repeat(buys)}${'○'.repeat(Math.max(0, maxBuys - buys))}</div></div>` +
        `<button class="btn btn-small li-buy" data-action="buy-legacy" data-legacy="${id}" ${canBuy ? '' : 'disabled'}>${atCap ? 'MAX' : `${SF_SM}${u.cost}`}</button>`;
      grid.appendChild(row);
    }
    const restart = document.getElementById('legacy-restart');
    if (restart) restart.disabled = locked;
    // Powers button visible only if you own at least one seahorse.
    const powBtn = document.getElementById('legacy-powers-btn');
    if (powBtn) powBtn.style.display = (godMode || (saveData.seahorses || 0) > 0) ? '' : 'none';
    // God-mode only: adjust the prestige level directly (drives boss + difficulty).
    const godRow = document.getElementById('legacy-god');
    if (godRow) {
      if (godMode) {
        godRow.style.display = '';
        const p = saveData.prestige || 0;
        const boss = bossTypeFor(p) === 'turtle' ? '🐢 Turtle' : '🐋 Whale';
        godRow.innerHTML =
          `<span class="lg-plabel">Prestige</span>` +
          `<button class="btn btn-small" data-action="prestige-dec" ${p <= 0 ? 'disabled' : ''}>−</button>` +
          `<span class="lg-pval" id="legacy-prestige-val">${p}</span>` +
          `<button class="btn btn-small" data-action="prestige-inc">+</button>` +
          `<span class="lg-pboss">L50: ${boss}</span>`;
      } else {
        godRow.style.display = 'none';
      }
    }
  }

  // ---- Seahorse Powers ---------------------------------------------------
  renderPowers(saveData, activePowers) {
    const godMode = this.game && this.game.godMode;
    const cap = godMode ? SEAHORSE_POWER_IDS.length : (saveData.seahorses || 0);
    const enabled = new Set(activePowers || []);
    const note = document.getElementById('powers-note');
    if (note) note.innerHTML = `Choose up to <strong>${cap}</strong> power${cap === 1 ? '' : 's'} `
      + `(one per Seahorse Trophy ${SH_SM}). Change them any time — trophies aren't spent. `
      + `<strong>${enabled.size}/${cap}</strong> active.`;
    const grid = document.getElementById('powers-grid');
    grid.innerHTML = '';
    for (const id of SEAHORSE_POWER_IDS) {
      const pw = SEAHORSE_POWERS[id];
      const on = enabled.has(id);
      const full = !on && enabled.size >= cap;
      const row = document.createElement('div');
      row.className = 'power-item' + (on ? ' on' : '') + (full ? ' full' : '');
      row.innerHTML =
        `<div class="pw-icon">${pw.icon}</div>` +
        `<div class="pw-body"><div class="pw-name">${pw.name}</div><div class="pw-desc">${pw.desc}</div></div>` +
        `<button class="btn btn-small pw-toggle" data-action="toggle-power" data-power="${id}" ${full ? 'disabled' : ''}>${on ? 'ON' : (full ? '—' : 'OFF')}</button>`;
      grid.appendChild(row);
    }
  }

  // Show/hide the title's The Deep button based on unlock state.
  renderTitle(saveData, godMode = false) {
    const deepUnlocked = godMode || saveData.bossDefeated || saveData.furthestLevel > DEEP.unlockLevel;
    document.getElementById('btn-deep').style.display = deepUnlocked ? '' : 'none';
  }

  // ---- Pre-level ---------------------------------------------------------
  renderPreLevel(n, level) {
    document.getElementById('pre-level').textContent = 'Level ' + n;
    document.getElementById('pre-target').textContent = `Pass: ${level.passTarget} / Max: ${level.maxScore}`;
    const cw = document.getElementById('pre-colors');
    cw.innerHTML = '';
    for (const c of level.picker) {
      const chip = document.createElement('div');
      chip.className = 'swatch';
      chip.style.background = COLORS[c].css;
      chip.title = COLORS[c].name;
      cw.appendChild(chip);
    }
    const demo = document.getElementById('pre-demo');
    demo.textContent = this._levelHint(n, level);
  }

  // Describe the newest fish/mechanic relevant to this level (highest-rank
  // feature present), so later levels stop harping on tri fish and L50 is the boss.
  _levelHint(n, level) {
    if (level.kind === 'boss') {
      if (level.bossType === 'turtle') {
        return '🐢 BOSS — the Ancient Sea Turtle! Clear the colour splotches on its shell with their OPPOSITES to make it poke its painted head out, then hit the head with its opposite. Survive its final spin — lose if 30 fish reach the beach.';
      }
      return '🐋 BOSS — the Prism Whale! Hit it with the OPPOSITE of its colour (or a rainbow) to drive it back. Keep fish from leaking: if it reaches the beach or 20 fish slip past, you lose.';
    }
    const kinds = new Set((level.spawns || []).map((s) => s.kind));
    if (level.anemone) return '🌸 Anemone: it repaints any fish that drifts through it — watch the colours change and re-read them!';
    if (level.coral) return '🪸 Coral reef: blocks a cell so fish can\'t pass, and it drifts around the grid every few seconds.';
    if (level.currents > 0) return '🌊 Water currents sweep fish one lane sideways as they cross — the flow flips direction every 15s.';
    if (kinds.has('tri')) return '🔺 Tri fish: counter the FRONT band first, then work your way to the back.';
    if (kinds.has('black')) return '⚫ Black fish: hit it with any colour, then finish it with THAT colour\'s opposite.';
    if (kinds.has('white')) return '⚪ White fish: hit it twice with the SAME colour.';
    return 'Touch, or touch and drag, on the beach to draw fish of the opposite colour to make friends!';
  }

  // ---- Game HUD ----------------------------------------------------------
  renderPicker(level, selected) {
    const p = document.getElementById('picker');
    p.innerHTML = '';
    if (level.picker.length <= 1) { p.style.display = 'none'; return; }
    p.style.display = 'flex';
    for (const c of level.picker) {
      const b = document.createElement('button');
      b.className = 'swatch pick' + (c === selected ? ' sel' : '');
      b.style.background = COLORS[c].css;
      b.dataset.action = 'select-color';
      b.dataset.color = c;
      b.title = COLORS[c].name;
      p.appendChild(b);
    }
  }
  updatePickerSelection(selected) {
    for (const b of document.querySelectorAll('#picker .pick')) {
      b.classList.toggle('sel', b.dataset.color === selected);
    }
  }

  renderDock(saveData, usedKinds, useCount, deep) {
    const dock = document.getElementById('powerup-dock');
    dock.innerHTML = '';
    const used = usedKinds || new Set();
    const atLimit = !deep && (useCount || 0) >= 3;
    for (const k of ['shark', 'ice', 'rainbow', 'squid']) {
      const count = saveData.inventory[k] || 0;
      if (count <= 0) continue;
      const spent = !deep && used.has(k);
      const disabled = spent || (atLimit && !spent);
      const b = document.createElement('button');
      b.className = 'dock-btn' + (disabled ? ' spent' : '');
      if (!disabled) { b.dataset.action = 'use-item'; b.dataset.item = k; }
      b.disabled = disabled;
      b.title = spent ? `${POWERUPS[k].name} already used this level`
        : (atLimit ? 'Item limit reached (3 per level)' : POWERUPS[k].name);
      b.innerHTML = `${POWERUPS[k].icon}<span class="dock-n">${count}</span>`;
      dock.appendChild(b);
    }
  }

  updateHUD(time, score, target, cooldown, pendingShark, duration) {
    const total = duration || LEVEL.duration;
    const remain = Math.max(0, total - time);
    const mm = Math.floor(remain / 60), ss = Math.floor(remain % 60);
    const timer = document.getElementById('hud-timer');
    timer.textContent = `${mm}:${ss.toString().padStart(2, '0')}`;
    timer.classList.toggle('amber', remain <= 20 && remain > 10);
    timer.classList.toggle('red', remain <= 10);
    const sc = document.getElementById('hud-score');
    sc.textContent = `${score}/${target}`;
    sc.classList.toggle('gold', score >= target);
    const fill = document.getElementById('cooldown-fill');
    // Cooldown disabled -> hide the recharge bar entirely.
    if (COOLDOWN_ENABLED) {
      fill.style.display = '';
      fill.style.width = Math.round(cooldown * 100) + '%';
      fill.classList.toggle('ready', cooldown >= 1);
    } else {
      fill.style.display = 'none';
    }
    document.getElementById('cooldown-strip').classList.toggle('shark-mode', !!pendingShark);
  }

  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('show'), 1400);
  }

  // ---- Results -----------------------------------------------------------
  renderResults(res) {
    const isBoss = !!res.boss;
    const turtle = res.bossType === 'turtle';
    document.getElementById('res-title').textContent = isBoss
      ? (res.bossWon
          ? (turtle ? '🐢 The Ancient Sea Turtle swims free!' : '🐋 The Prism Whale is at peace!')
          : (res.loseReason === 'beach' ? 'The whale reached the beach…' : 'Too many fish slipped past…'))
      : (res.passed ? 'Level Complete!' : 'The current was strong…');
    const pct = res.maxScore ? Math.min(1, res.score / res.maxScore) : 0;
    document.getElementById('res-fill').style.width = Math.round(pct * 100) + '%';
    document.querySelector('.thr1').style.left = (LEVEL.passPct * 100) + '%';
    document.querySelector('.thr2').style.left = (LEVEL.twoStarPct * 100) + '%';
    document.querySelector('.thr3').style.left = (LEVEL.threeStarPct * 100) + '%';
    document.getElementById('res-score').textContent = `${res.score} / ${res.maxScore}`;
    document.getElementById('res-stars').innerHTML = starStr(res.stars);
    const earn = document.getElementById('res-earn');
    if (res.bossFirstClear) {
      earn.innerHTML = `+${res.earned} ${SF_SM} • 🐚 Legacy unlocked!`;
    } else {
      earn.innerHTML = res.earned > 0 ? `+${res.earned} ${SF_SM}` : (res.passed ? 'No new starfish' : 'Try again!');
    }
    const next = document.getElementById('res-next');
    if (res.boss && res.bossWon) {
      next.textContent = '🐚 Legacy';
      next.dataset.action = 'legacy';
    } else {
      next.textContent = res.passed ? 'Next ▶' : 'Retry';
      next.dataset.action = res.passed ? 'next' : 'retry';
    }
    // Optional Legacy shortcut once unlocked.
    let legBtn = document.getElementById('res-legacy');
    if (res.legacyUnlocked) {
      if (!legBtn) {
        legBtn = document.createElement('button');
        legBtn.id = 'res-legacy';
        legBtn.className = 'btn';
        legBtn.dataset.action = 'legacy';
        legBtn.textContent = '🐚 Legacy';
        document.querySelector('#s-results .res-buttons').appendChild(legBtn);
      }
      legBtn.style.display = '';
    } else if (legBtn) {
      legBtn.style.display = 'none';
    }
  }

  // ---- Shop --------------------------------------------------------------
  renderShop(saveData, godMode = false) {
    document.getElementById('shop-starfish').innerHTML = godMode ? '∞' : saveData.starfish;
    const grid = document.getElementById('shop-grid');
    grid.innerHTML = '';
    for (const k of ['ice', 'shark', 'rainbow', 'squid']) {
      const p = POWERUPS[k];
      const owned = saveData.inventory[k] || 0;
      const affordable = godMode || (saveData.starfish >= p.price && owned < INV_CAP);
      const card = document.createElement('div');
      card.className = 'shop-card' + (affordable ? '' : ' disabled');
      const btnLabel = godMode
        ? `Buy ${SF_SM}`
        : (owned >= INV_CAP ? 'Max' : (saveData.starfish >= p.price ? `Buy ${p.price}${SF_SM}` : `Need ${p.price - saveData.starfish} more ${SF_SM}`));
      const autoRow = k === 'shark'
        ? `<label class="shop-auto"><input type="checkbox" data-setting="autoShark" ${saveData.settings.autoShark ? 'checked' : ''}> Autodeploy</label>`
        : '';
      card.innerHTML = `
        <div class="shop-icon">${p.icon}</div>
        <div class="shop-name">${p.name}</div>
        <div class="shop-desc">${shopDesc(k)}</div>
        <div class="shop-owned">Owned: ${owned}/${godMode ? '∞' : INV_CAP}</div>
        ${autoRow}
        <button class="btn btn-small ${affordable ? 'btn-primary' : ''}" data-action="buy" data-item="${k}" ${affordable ? '' : 'disabled'}>
          ${btnLabel}
        </button>`;
      grid.appendChild(card);
    }
  }

  // ---- Settings ----------------------------------------------------------
  renderSettings(settings) {
    const scope = document.getElementById('s-settings');
    for (const key of ['patterns', 'reducedMotion', 'mirror', 'sfx', 'music', 'autoShark']) {
      const el = scope.querySelector(`[data-setting="${key}"]`);
      if (el) el.checked = !!settings[key];
    }
    this.root.classList.toggle('mirror', !!settings.mirror);
  }

  // ---- Pause / countdown -------------------------------------------------
  showPause() { document.getElementById('pause-overlay').classList.add('active'); }
  hidePause() { document.getElementById('pause-overlay').classList.remove('active'); }
  async countdown() {
    const ov = document.getElementById('countdown-overlay');
    const num = document.getElementById('countdown-num');
    ov.classList.add('active');
    for (const n of ['3', '2', '1']) {
      num.textContent = n;
      await new Promise((r) => setTimeout(r, 500));
    }
    ov.classList.remove('active');
  }
}

function starStr(n) { let s = ''; for (let i = 0; i < 3; i++) s += sfSVG(13, i < n); return s; }

function shopDesc(k) {
  return {
    ice: '15s: all fish friends swim at half speed.',
    shark: 'Sweep 3 lanes, eat every fish for full points. Buy gives ×2.',
    rainbow: '15s: your fish become friends with fish of any color.',
    squid: '30s: eats interior lanes, +1 per 2 eaten.',
  }[k];
}
