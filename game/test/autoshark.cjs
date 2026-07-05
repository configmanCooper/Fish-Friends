const { chromium } = require('playwright-core');
const path = require('path');
const EXE = path.join(process.env.USERPROFILE, 'AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe');
let failures = 0;
function assert(c, m) { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; }
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);

  // settings has autoShark toggle
  await page.evaluate(() => window.game.openSettings());
  await page.waitForTimeout(120);
  assert(await page.evaluate(() => !!document.querySelector('[data-setting="autoShark"]')), 'settings has Auto-deploy shark toggle');

  // Auto-shark: enable, give shark, put an enemy ~0.9s from bottom -> shark deploys, enemy eaten not leaked
  const r = await page.evaluate(async () => {
    const g = window.game;
    g.save.settings.autoShark = true;
    g.save.inventory.shark = 2;
    g.openPreLevel(3); g.beginLevel();
    g.sim.level.spawns = [{ t: 999, lane: 0, kind: 'normal', color: 'blue', value: 1 }]; // keep alive
    // enemy near bottom in lane 4
    const spd = g.sim.enemySpeed({ kind: 'normal' });
    g.sim.enemies = [{ id: 555, lane: 4, y: spd * 0.9, kind: 'normal', color: 'blue', alive: true, weaveDir: 1 }];
    let deployed = false, eaten = false, leaked = false;
    for (let i = 0; i < 60 * 4; i++) {
      g._autoShark();
      g.sim.tick(1/60);
      for (const e of g.sim.drainEvents()) {
        if (e.type === 'sharkEat' && e.id === 555) eaten = true;
        if (e.type === 'leak') leaked = true;
      }
      if (g.sim.sharks.length) deployed = true;
    }
    return { deployed, eaten, leaked, sharkInv: g.save.inventory.shark };
  });
  assert(r.deployed, 'shark auto-deployed for a near-bottom enemy');
  assert(r.eaten, 'auto-shark ate the threatened enemy');
  assert(!r.leaked, 'threatened enemy did NOT leak');
  assert(r.sharkInv === 1, 'one shark consumed from inventory (' + r.sharkInv + ')');

  // Auto-shark OFF does not deploy
  const off = await page.evaluate(async () => {
    const g = window.game;
    g.save.settings.autoShark = false; g.save.inventory.shark = 2;
    g.openPreLevel(3); g.beginLevel();
    g.sim.level.spawns = [{ t: 999, lane: 0, kind: 'normal', color: 'blue', value: 1 }];
    const spd = g.sim.enemySpeed({ kind: 'normal' });
    g.sim.enemies = [{ id: 556, lane: 4, y: spd * 0.9, kind: 'normal', color: 'blue', alive: true, weaveDir: 1 }];
    for (let i = 0; i < 60 * 2; i++) { g._autoShark(); g.sim.tick(1/60); g.sim.drainEvents(); }
    return { sharks: g.sim.sharks.length, inv: g.save.inventory.shark };
  });
  assert(off.sharks === 0 && off.inv === 2, 'auto-shark OFF deploys nothing');

  // squid size: capture screenshot
  await page.evaluate(async () => {
    const g = window.game; g.openPreLevel(6); g.beginLevel();
    for (let i = 0; i < 60; i++) { g.sim.tick(1/60); g.sim.drainEvents(); }
    g.sim.useSquid();
    for (let i = 0; i < 40; i++) { g.sim.tick(1/60); g.sim.drainEvents(); g.render.update(0.016, g.sim); }
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'squid2.png' });

  console.log('\nerrors:', errors.length);
  for (const e of errors.slice(0, 8)) console.log('  ' + e);
  await browser.close();
  if (failures || errors.length) { console.log('AUTOSHARK FAIL'); process.exit(1); }
  console.log('AUTOSHARK OK');
})().catch(e => { console.error('FATAL', e); process.exit(2); });
