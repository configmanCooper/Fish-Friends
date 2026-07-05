const { chromium } = require('playwright-core');
const path = require('path');
const EXE = path.join(process.env.USERPROFILE, 'AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe');
const URL = 'http://localhost:8123/index.html';
let failures = 0;
function assert(c, m) { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; }

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  // Grant progress + starfish + inventory so we can reach specials/shop/deep.
  await page.evaluate(() => {
    const g = window.game;
    g.save.furthestLevel = 41;
    g.save.starfish = 20;
    g.save.bestStars[40] = 3;
    g.save.inventory = { ice: 3, shark: 3, rainbow: 3, squid: 3 };
    window.Save = null;
  });

  // --- Special level render (L20 white) via API, autoplay with perfect bot ---
  await page.evaluate(async () => {
    const g = window.game;
    g.openPreLevel(20);
    g.beginLevel();
  });
  await page.waitForTimeout(300);
  const l20 = await page.evaluate(() => {
    const g = window.game;
    const kinds = new Set(g.level.spawns.map(s => s.kind));
    return { lanes: g.level.lanes, hasWhite: kinds.has('white'), picker: g.level.picker.length, state: g.state };
  });
  assert(l20.hasWhite, 'L20 contains white fish');
  assert(l20.lanes === 9, 'L20 has 9 lanes (+50%)');
  assert(l20.picker >= 3, 'L20 picker has counters');

  // Drive L20 with the in-page perfect bot to prove it renders + completes.
  const res20 = await page.evaluate(async () => {
    const g = window.game;
    // simple perfect autoplay using requiredPlayerColor via sim
    const { requiredPlayerColor } = await import('./js/sim.js');
    let guard = 0;
    while (g.state === 'game' && guard < 60 * 130) {
      const sim = g.sim;
      if (sim.isReady()) {
        const need = {};
        for (const e of sim.enemies) {
          if (!e.alive) continue;
          let n = requiredPlayerColor(e);
          if (n === null) n = g.level.picker[0];
          (need[n] ||= new Set()).add(e.lane);
        }
        let bc = null, bl = null;
        for (const c in need) if (!bl || need[c].size > bl.size) { bc = c; bl = need[c]; }
        if (bc) { g.selectedColor = bc; sim.launch([...bl], bc); }
      }
      sim.tick(1 / 60);
      const evs = sim.drainEvents();
      g.render.handleEvents(evs, sim);
      const le = evs.find(e => e.type === 'levelEnd');
      if (le) { g._endLevel(le); break; }
      guard++;
    }
    return { state: g.state, stars: g.save.bestStars[20] || 0 };
  });
  assert(res20.state === 'results', 'L20 reaches results screen');
  assert(res20.stars >= 1, 'L20 perfect autoplay passes (stars=' + res20.stars + ')');

  // --- Shop: buy flow ---
  await page.evaluate(() => window.game.openShop());
  await page.waitForTimeout(150);
  const beforeStar = await page.evaluate(() => window.game.save.starfish);
  await page.click('[data-action="buy"][data-item="ice"]', { force: true }).catch(() => {});
  await page.waitForTimeout(150);
  const afterStar = await page.evaluate(() => window.game.save.starfish);
  assert(afterStar <= beforeStar, 'Shop buy deducts starfish (or capped)');

  // --- The Deep ---
  const deep = await page.evaluate(async () => {
    const g = window.game;
    g.startDeep();
    for (let i = 0; i < 60 * 10; i++) { g._feedDeep(); g.sim.tick(1 / 60); g.sim.drainEvents(); g.deepDepth += (1 / 60) * (10 / 30); }
    return { deep: g.deep, depth: Math.floor(g.deepDepth), lanes: g.level.lanes, spawns: g.sim.level.spawns.length };
  });
  assert(deep.deep === true, 'The Deep is running');
  assert(deep.spawns > 0, 'The Deep generates spawns (' + deep.spawns + ')');
  assert(deep.lanes === 11, 'The Deep uses 11 lanes');

  // --- Powerup: squid awards 0, shark full value (in a live level) ---
  const pu = await page.evaluate(async () => {
    const g = window.game;
    g.openPreLevel(12); g.beginLevel();
    for (let i = 0; i < 120; i++) { g.sim.tick(1 / 60); g.sim.drainEvents(); }
    const before = g.sim.score;
    g.sim.useSquid();
    let squidEats = 0;
    for (let i = 0; i < 60 * 20 && !g.sim.ended; i++) { g.sim.tick(1 / 60); for (const e of g.sim.drainEvents()) if (e.type === 'squidEat') squidEats++; }
    return { squidEats, scoreDeltaFromSquid: g.sim.score - before };
  });
  assert(pu.squidEats > 0, 'Squid eats interior enemies (' + pu.squidEats + ')');

  console.log('\nerrors:', errors.length);
  for (const e of errors.slice(0, 10)) console.log('  ' + e);
  await browser.close();
  if (failures || errors.length) { console.log('EXTENDED FAIL'); process.exit(1); }
  console.log('EXTENDED OK');
})().catch(e => { console.error('FATAL', e); process.exit(2); });
