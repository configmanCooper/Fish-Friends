// ui.js — DOM screens + HUD, one state machine. Reads/writes via the game object.
import { COLORS } from './config.js';
import { POWERUPS, INV_CAP, LEVEL, DEEP, COOLDOWN_ENABLED } from './config.js';
import { LEVELS } from './levels.js';

const SCREENS = ['title', 'map', 'prelevel', 'game', 'results', 'shop', 'settings'];

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
  }

  _action(a, el) {
    const g = this.game;
    switch (a) {
      case 'play': g.goToMap(); break;
      case 'install': g.promptInstall(); break;
      case 'title': g.goToTitle(); break;
      case 'deep': g.startDeep(); break;
      case 'settings': g.openSettings(); break;
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
    if (screen !== 'game') this.hidePause();
  }

  // ---- Title / Map -------------------------------------------------------
  renderMap(saveData, godMode = false) {
    document.getElementById('map-starfish').innerHTML = godMode ? '∞' : saveData.starfish;
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    for (const def of LEVELS) {
      const n = def.n;
      const unlocked = godMode || n <= saveData.furthestLevel;
      const stars = saveData.bestStars[n] || 0;
      const b = document.createElement('button');
      b.className = 'level-bubble' + (unlocked ? '' : ' locked') + (n === saveData.furthestLevel ? ' current' : '');
      b.innerHTML = `<span class="lvl-n">${n}</span><span class="lvl-stars">${starStr(stars)}</span>`;
      if (unlocked) { b.dataset.action = 'start-level'; b.dataset.level = n; }
      grid.appendChild(b);
    }
    const deepBtn = document.getElementById('map-deep');
    const deepUnlocked = godMode || saveData.furthestLevel > DEEP.unlockLevel || saveData.bestStars[40];
    deepBtn.style.display = deepUnlocked ? '' : 'none';
    document.getElementById('btn-deep').style.display = deepUnlocked ? '' : 'none';
  }

  // Show/hide the title's The Deep button based on unlock state.
  renderTitle(saveData, godMode = false) {
    const deepUnlocked = godMode || saveData.furthestLevel > DEEP.unlockLevel || saveData.bestStars[40];
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
    const specials = new Set(level.spawns.map((s) => s.kind).filter((k) => k !== 'normal'));
    let hint = 'Touch, or touch and drag, on the beach to draw fish of the opposite color to make friends!';
    if (specials.has('white')) hint = '⚪ White fish: hit twice with the SAME color.';
    if (specials.has('black')) hint = '⚫ Black fish: hit with a color, then its opposite.';
    if (specials.has('tri')) hint = '🌈 Tri fish: counter the FRONT band first, then back.';
    demo.textContent = hint;
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
    document.getElementById('res-title').textContent = res.passed ? 'Level Complete!' : 'The current was strong…';
    const pct = res.maxScore ? Math.min(1, res.score / res.maxScore) : 0;
    document.getElementById('res-fill').style.width = Math.round(pct * 100) + '%';
    document.querySelector('.thr1').style.left = (LEVEL.passPct * 100) + '%';
    document.querySelector('.thr2').style.left = (LEVEL.twoStarPct * 100) + '%';
    document.querySelector('.thr3').style.left = (LEVEL.threeStarPct * 100) + '%';
    document.getElementById('res-score').textContent = `${res.score} / ${res.maxScore}`;
    document.getElementById('res-stars').innerHTML = starStr(res.stars);
    const earn = document.getElementById('res-earn');
    earn.innerHTML = res.earned > 0 ? `+${res.earned} ${SF_SM}` : (res.passed ? 'No new starfish' : 'Try again!');
    const next = document.getElementById('res-next');
    next.textContent = res.passed ? 'Next ▶' : 'Retry';
    next.dataset.action = res.passed ? 'next' : 'retry';
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
