// Mining and placing bursts: flecks fly out of the block in its colour.
// Run: node h/animations.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18165, URL = 'http://localhost:' + PORT + '/?layout=classic';
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
  const small = await a.evaluate(() => window.__isle.fx.burst(80, 13, 92, 3, 2));
  check('hitting a block throws a few flecks', small >= 2, small);
  const big = await a.evaluate(() => window.__isle.fx.burst(80, 13, 92, 3, 14));
  check('breaking a block throws more flecks than a hit', big > small, [small, big]);
  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
