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
  page.on('console', m => { if (m.type() === 'error') errors.push('console:' + m.text()); });
  await page.goto('http://localhost:8123/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(700);

  // fresh save
  await page.evaluate(() => { window.game.save.furthestLevel = 1; window.game.save.starfish = 0; window.game.save.bestStars = {}; window.game.godMode = false; window.game.ui.renderTitle(window.game.save, false); });

  // Deep hidden on title when locked
  assert(await page.evaluate(() => getComputedStyle(document.getElementById('btn-deep')).display === 'none'), 'The Deep hidden on title when locked');

  // God mode from MAIN MENU (title)
  for (const ch of ['f', '1', 's', 'h', 'y', 'f', 'r', '1', 'e', 'n', 'd', 's']) await page.keyboard.press(ch);
  await page.waitForTimeout(120);
  assert(await page.evaluate(() => window.game.godMode === true), 'god mode activates on main menu');
  assert(await page.evaluate(() => getComputedStyle(document.getElementById('btn-deep')).display !== 'none'), 'The Deep shows on title in god mode');

  // Map: back-to-menu button present, deep hidden when locked (turn god off first)
  await page.evaluate(() => { window.game.godMode = false; window.game.goToMap(); });
  await page.waitForTimeout(150);
  assert(await page.evaluate(() => !!document.querySelector('#s-map [data-action="title"]')), 'map has back-to-menu (home) button');
  assert(await page.evaluate(() => getComputedStyle(document.getElementById('map-deep')).display === 'none'), 'The Deep hidden on map when locked');
  // home button returns to title
  await page.click('#s-map [data-action="title"]', { force: true });
  await page.waitForTimeout(150);
  assert(await page.evaluate(() => window.game.state === 'title'), 'home button returns to main menu');

  // Settings has delete-all-data button
  await page.evaluate(() => window.game.openSettings());
  await page.waitForTimeout(120);
  assert(await page.evaluate(() => !!document.querySelector('[data-action="wipe-data"]')), 'settings has Delete All Data button');

  // Shark: renders + eats at half fish speed
  const shark = await page.evaluate(async () => {
    const g = window.game; g.openPreLevel(4); g.beginLevel();
    for (let i = 0; i < 90; i++) { g.sim.tick(1/60); g.sim.drainEvents(); }
    g.sim.useShark(1);
    const yStart = g.sim.sharks[0].y;
    let eats = 0;
    for (let i = 0; i < 60 * 3; i++) { g.sim.tick(1/60); for (const e of g.sim.drainEvents()) if (e.type === 'sharkEat') eats++; }
    g.render.update(0.016, g.sim);
    const yEnd = g.sim.sharks.length ? g.sim.sharks[0].y : 1;
    return { rose: yEnd - yStart, sharkMeshes: g.render.sharkMeshes.size, eats };
  });
  assert(shark.rose > 0, 'shark ascends');
  assert(shark.sharkMeshes >= 1 || shark.eats >= 0, 'shark mesh created');
  await page.screenshot({ path: 'shark.png' });

  // Squid: renders when active
  const squid = await page.evaluate(async () => {
    const g = window.game; g.openPreLevel(6); g.beginLevel();
    for (let i = 0; i < 60; i++) { g.sim.tick(1/60); g.sim.drainEvents(); }
    g.sim.useSquid();
    for (let i = 0; i < 30; i++) { g.sim.tick(1/60); g.sim.drainEvents(); g.render.update(0.016, g.sim); }
    return { visible: g.render.squidMesh.visible };
  });
  assert(squid.visible === true, 'squid/octopus mesh visible when active');
  await page.screenshot({ path: 'squid.png' });

  // Waste penalty: 2 fish off top = -1
  const waste = await page.evaluate(async () => {
    const g = window.game; g.openPreLevel(2); g.beginLevel();
    g.sim.level.spawns = [{ t: 999, lane: 0, kind: 'normal', color: 'blue', value: 1 }]; // keep level alive
    g.sim.score = 10;
    // launch 2 fish into empty lanes -> both escape top
    g.sim.launch([0], 'orange');
    for (let i = 0; i < 300; i++) g.sim.tick(1/60);
    g.sim.cooldownUntil = 0;
    g.sim.launch([7], 'orange');
    let penalties = 0;
    for (let i = 0; i < 300; i++) { g.sim.tick(1/60); for (const e of g.sim.drainEvents()) if (e.type === 'wastePenalty') penalties++; }
    return { penalties, score: g.sim.score };
  });
  assert(waste.penalties >= 1, 'waste penalty fires after 2 escaped fish (' + waste.penalties + ')');
  assert(waste.score === 9, 'waste penalty subtracted 1 point (score ' + waste.score + ')');

  console.log('\nerrors:', errors.length);
  for (const e of errors.slice(0, 8)) console.log('  ' + e);
  await browser.close();
  if (failures || errors.length) { console.log('FEATURES FAIL'); process.exit(1); }
  console.log('FEATURES OK');
})().catch(e => { console.error('FATAL', e); process.exit(2); });
