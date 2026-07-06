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

  // fresh save: only level 1 unlocked, 0 starfish
  await page.evaluate(() => { window.game.save.furthestLevel = 1; window.game.save.starfish = 0; window.game.save.bestStars = {}; });

  // start level 1
  await page.click('[data-action="play"]', { force: true });
  await page.click('[data-action="start-level"][data-level="1"]', { force: true });
  await page.click('[data-action="swim"]', { force: true });
  await page.waitForTimeout(300);
  assert(await page.evaluate(() => window.game.godMode === false), 'god mode starts OFF');

  // type f 1 s h y f r 1 e n d s
  for (const ch of ['f', '1', 's', 'h', 'y', 'f', 'r', '1', 'e', 'n', 'd', 's']) { await page.keyboard.press(ch); }
  await page.waitForTimeout(150);
  assert(await page.evaluate(() => window.game.godMode === true), 'typing "f1shyfr1ends" in-game enables god mode');

  // go to map -> all levels unlocked, starfish ∞
  await page.evaluate(() => window.game.goToMap());
  await page.waitForTimeout(200);
  const map = await page.evaluate(() => ({
    starfishText: document.getElementById('map-starfish').textContent,
    unlockedCount: document.querySelectorAll('.level-bubble[data-action="start-level"]').length,
    lockedCount: document.querySelectorAll('.level-bubble.locked').length,
    deepLocked: document.getElementById('map-deep').classList.contains('locked'),
    hasStarfishSVG: !!document.querySelector('.star-chip .sf'),
  }));
  assert(map.starfishText.includes('∞'), 'god mode shows ∞ starfish on map');
  assert(map.unlockedCount === 50, 'all 50 levels unlocked in god mode (got ' + map.unlockedCount + ')');
  assert(map.lockedCount === 0, 'no locked levels in god mode');
  assert(!map.deepLocked, 'The Deep unlocked in god mode');
  assert(map.hasStarfishSVG, 'starfish icon (SVG) renders instead of star');

  // open a high level directly
  await page.evaluate(() => window.game.openPreLevel(37));
  await page.waitForTimeout(150);
  assert(await page.evaluate(() => window.game.state === 'prelevel' && window.game.levelN === 37), 'can open any level (37) in god mode');

  // shop: buy freely with 0 real starfish
  await page.evaluate(() => window.game.openShop());
  await page.waitForTimeout(150);
  await page.click('[data-action="buy"][data-item="squid"]', { force: true });
  await page.click('[data-action="buy"][data-item="squid"]', { force: true });
  await page.click('[data-action="buy"][data-item="squid"]', { force: true });
  await page.click('[data-action="buy"][data-item="squid"]', { force: true });
  await page.waitForTimeout(150);
  const shop = await page.evaluate(() => ({ squid: window.game.save.inventory.squid, starfish: window.game.save.starfish, shopText: document.getElementById('shop-starfish').textContent }));
  assert(shop.squid >= 4, 'god mode buys past the cap (squid=' + shop.squid + ')');
  assert(shop.starfish === 0, 'god mode does not deduct real starfish');
  assert(shop.shopText.includes('∞'), 'shop shows ∞ in god mode');

  // toggle off
  await page.evaluate(() => { window.game.openPreLevel(1); window.game.beginLevel(); });
  for (const ch of ['f', '1', 's', 'h', 'y', 'f', 'r', '1', 'e', 'n', 'd', 's']) { await page.keyboard.press(ch); }
  await page.waitForTimeout(120);
  assert(await page.evaluate(() => window.game.godMode === false), 'typing "f1shyfr1ends" again toggles god mode OFF');

  console.log('\nerrors:', errors.length);
  for (const e of errors.slice(0, 8)) console.log('  ' + e);
  await browser.close();
  if (failures || errors.length) { console.log('GODMODE FAIL'); process.exit(1); }
  console.log('GODMODE OK');
})().catch(e => { console.error('FATAL', e); process.exit(2); });
