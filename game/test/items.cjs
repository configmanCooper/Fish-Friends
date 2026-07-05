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

  // Shop: buying shark gives 2
  const buy = await page.evaluate(() => {
    const g = window.game;
    g.save.starfish = 20; g.save.inventory = { ice:0, shark:0, rainbow:0, squid:0 };
    g.godMode = false;
    g.buyItem('shark');
    return { shark: g.save.inventory.shark, starfish: g.save.starfish };
  });
  assert(buy.shark === 2, 'buying shark grants 2 (got ' + buy.shark + ')');
  assert(buy.starfish === 17, 'shark costs 3 starfish once for the pair');

  // Per-level limit: each item once, max 3 total
  const limit = await page.evaluate(async () => {
    const g = window.game;
    g.save.inventory = { ice:3, shark:3, rainbow:3, squid:3 };
    g.godMode = false;
    g.openPreLevel(6); g.beginLevel();
    g.sim.level.spawns = [{ t: 999, lane: 0, kind:'normal', color:'blue', value:1 }];
    const res = { iceUsed:false, iceSecondBlocked:false, over3Blocked:false };
    g.useItem('ice'); res.iceUsed = g.sim.effects.ice.active;
    g.useItem('ice'); // second ice -> blocked (already used)
    res.iceSecondBlocked = (g.itemsUsedThisLevel.size === 1);
    g.useItem('rainbow');
    g.useItem('squid');
    // now 3 items used; a 4th distinct item should be blocked
    const before = g.itemUseCount;
    g.useItem('shark'); // this opens pending; confirm
    if (g.pendingShark) g.confirmShark();
    res.over3Blocked = (g.itemUseCount === before) && before === 3;
    res.count = g.itemUseCount;
    return res;
  });
  assert(limit.iceUsed, 'ice usable');
  assert(limit.iceSecondBlocked, 'same item cannot be used twice per level');
  assert(limit.over3Blocked, 'cannot use more than 3 items per level (count=' + limit.count + ')');

  // Squid scores 1 per 2 eaten
  const sq = await page.evaluate(async () => {
    const g = window.game;
    g.openPreLevel(6); g.beginLevel();
    g.sim.level.spawns = [{ t: 999, lane: 0, kind:'normal', color:'blue', value:1 }];
    g.sim.score = 0;
    // 4 interior enemies -> +2
    const spd = g.sim.enemySpeed({ kind:'normal' });
    g.sim.enemies = [1,2,3,4].map((n,i)=>({ id:600+i, lane:3, y:0.4+i*0.05, kind:'normal', color:'blue', alive:true, weaveDir:1 }));
    g.sim.useSquid();
    for (let i=0;i<60*20 && !g.sim.ended;i++){ g.sim.tick(1/60); g.sim.drainEvents(); }
    return { score: g.sim.score };
  });
  assert(sq.score === 2, 'squid: 4 eaten => +2 points (got ' + sq.score + ')');

  // special fish scores: white=2, black=2, tri=3 via maxScore reflecting POINTS
  const scores = await page.evaluate(async () => {
    const mod = await import('./js/config.js');
    return { white: mod.POINTS.white, black: mod.POINTS.black, tri: mod.POINTS.tri };
  });
  assert(scores.white === 2 && scores.black === 2 && scores.tri === 3, 'white/black=2, tri=3 point values');

  console.log('\nerrors:', errors.length);
  for (const e of errors.slice(0,8)) console.log('  ' + e);
  await browser.close();
  if (failures || errors.length) { console.log('ITEMS FAIL'); process.exit(1); }
  console.log('ITEMS OK');
})().catch(e => { console.error('FATAL', e); process.exit(2); });
