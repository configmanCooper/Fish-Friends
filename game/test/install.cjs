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

  // manifest valid + icons load
  const man = await page.evaluate(async () => {
    const r = await fetch('manifest.webmanifest'); const j = await r.json();
    const i192 = await fetch('icon-192.png'); const i512 = await fetch('icon-512.png');
    return { ok: r.ok, name: j.name, icons: j.icons.length, display: j.display, i192: i192.status, i512: i512.status };
  });
  assert(man.ok && man.name === 'Fish Friends', 'manifest parses');
  assert(man.icons >= 2, 'manifest has >=2 icons');
  assert(man.i192 === 200 && man.i512 === 200, 'both icon PNGs load (200)');

  // install button hidden initially
  const hidden = await page.evaluate(() => document.getElementById('btn-install').style.display === 'none');
  assert(hidden, 'install button hidden before prompt available');

  // simulate beforeinstallprompt
  const shown = await page.evaluate(() => new Promise(res => {
    const ev = new Event('beforeinstallprompt');
    ev.prompt = () => { window.__promptCalled = true; };
    ev.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(ev);
    setTimeout(() => res(document.getElementById('btn-install').style.display !== 'none'), 50);
  }));
  assert(shown, 'install button appears after beforeinstallprompt');

  // click install -> prompt() called + hides
  await page.click('#btn-install', { force: true });
  await page.waitForTimeout(100);
  const after = await page.evaluate(() => ({ called: !!window.__promptCalled, hidden: document.getElementById('btn-install').style.display === 'none' }));
  assert(after.called, 'clicking install calls the native prompt()');
  assert(after.hidden, 'install button hides after prompting');

  // service worker registered
  await page.waitForTimeout(300);
  const sw = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length > 0);
  assert(sw, 'service worker registered (installability requirement)');

  console.log('\nerrors:', errors.length);
  for (const e of errors.slice(0,8)) console.log('  ' + e);
  await browser.close();
  if (failures || errors.length) { console.log('INSTALL FAIL'); process.exit(1); }
  console.log('INSTALL OK');
})().catch(e => { console.error('FATAL', e); process.exit(2); });
