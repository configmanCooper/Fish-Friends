// smoke.js — launch the real game in Chromium, capture console/errors, drive it.
const { chromium } = require('playwright-core');
const path = require('path');

const EXE = path.join(process.env.USERPROFILE, 'AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe');
const URL = 'http://localhost:8123/index.html?debug=1';

(async () => {
  const browser = await chromium.launch({
    executablePath: EXE,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [], logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  const boot = await page.evaluate(() => !!window.game && window.game.state);
  console.log('boot state:', boot);

  // Title -> Play -> Map
  await page.click('[data-action="play"]', { force: true });
  await page.waitForTimeout(400);
  const mapState = await page.evaluate(() => window.game.state);
  console.log('after play:', mapState);

  // Start level 1
  await page.click('[data-action="start-level"][data-level="1"]', { force: true });
  await page.waitForTimeout(300);
  await page.click('[data-action="swim"]', { force: true });
  await page.waitForTimeout(500);
  const gState = await page.evaluate(() => window.game.state);
  console.log('after swim:', gState);

  // instrument launches
  await page.evaluate(() => {
    window._diag = { launches: 0, denied: 0, kills: 0, maxPlayers: 0 };
    const g = window.game;
    const origTry = g.tryLaunch.bind(g);
    g.tryLaunch = (lanes) => { window._diag.launches++; return origTry(lanes); };
  });

  // Simulate a drag on the seabed to draw fish
  const box = await page.$eval('#game-canvas', (c) => {
    const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const stripY = box.y + box.h * 0.92;
  for (let round = 0; round < 8; round++) {
    await page.evaluate(() => { window._diag.maxPlayers = Math.max(window._diag.maxPlayers, window.game.sim.players.length); });
    await page.mouse.move(box.x + box.w * 0.15, stripY);
    await page.mouse.down();
    await page.mouse.move(box.x + box.w * 0.5, stripY, { steps: 6 });
    await page.mouse.move(box.x + box.w * 0.85, stripY, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(1600);
  }

  const diag = await page.evaluate(() => window._diag);
  console.log('DIAG:', JSON.stringify(diag));

  const stats = await page.evaluate(() => ({
    state: window.game.state,
    time: window.game.sim ? +window.game.sim.time.toFixed(1) : null,
    score: window.game.sim ? window.game.sim.score : null,
    enemies: window.game.sim ? window.game.sim.enemies.length : null,
    players: window.game.sim ? window.game.sim.players.length : null,
    fishDrawn: window.game.render.fishMesh.count,
    drawCalls: window.game.render.renderer.info.render.calls,
    tris: window.game.render.renderer.info.render.triangles,
  }));
  console.log('STATS:', JSON.stringify(stats));

  // check the canvas rendered non-black pixels
  await page.screenshot({ path: 'smoke.png' });

  console.log('--- console logs (last 20) ---');
  for (const l of logs.slice(-20)) console.log(l);
  console.log('--- errors ---');
  for (const e of errors) console.log(e);

  await browser.close();
  if (errors.length) { console.log('SMOKE FAIL'); process.exit(1); }
  console.log('SMOKE OK');
})().catch((e) => { console.error('FATAL', e); process.exit(2); });

