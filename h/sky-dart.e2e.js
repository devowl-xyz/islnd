// The Sky Dart can be flown: F takes the controls, W/S set the throttle, which tops out at 105%.
// Run: node h/sky-dart.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18159, URL = 'http://localhost:' + PORT + '/?layout=classic';
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
  page.on('pageerror', (e) => { console.log('pageerror', e.message); fails++; });
  await page.goto(URL);
  await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
  const a = page;
  await a.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); });
  await wait(900);
  check('the throttle can go to 105%', await a.evaluate(() => window.__isle.sky.max()) === 1.05);
  await a.evaluate(() => window.__isle.sky.board());
  await a.evaluate(() => window.__isle.sky.pilot());
  check('you take the Sky Dart’s controls', await a.evaluate(() => window.__isle.sky.thr() !== null));
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => window.__isle.sky.thr() >= 1.05, null, { timeout: 150000, polling: 300 }).catch(() => {});
  await a.keyboard.up('KeyW');
  const thr = await a.evaluate(() => window.__isle.sky.thr());
  check('holding W takes the throttle to 105%', thr !== null && thr >= 1.04, thr);
  check('but no further than 105%', thr !== null && thr <= 1.05 + 1e-9, thr);
  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
