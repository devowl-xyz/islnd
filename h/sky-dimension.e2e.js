// The sky: a second dimension, reached by a portal of cloud blocks.
// Run: node h/sky-dimension.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18171, URL = 'http://localhost:' + PORT + '/?layout=classic';
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
  await a.evaluate(() => { const I = window.__isle; I.cmd('/gamemode creative'); const P = I.player; P.fly = true; P.x = 80.5; P.z = 92.5; P.y = 15; });
  // a cloud-block portal frame right beside you, then light it
  await a.evaluate(() => { const I = window.__isle; for (let u = -1; u <= 2; u++) for (let v = -1; v <= 3; v++) { const fr = u < 0 || u > 1 || v < 0 || v > 2; I.tnt.place(80 + u, 14 + v, 94, fr ? I.B.CLOUD : 0); } });
  check('a portal of cloud blocks lights, without spark dust', await a.evaluate(() => window.__isle.skyDim.light()) === true);
  check('and it is a sky portal', await a.evaluate(() => window.__isle.skyDim.portalSky()) === true);
  await a.evaluate(() => window.__isle.skyDim.enter());
  await wait(300);
  const st = await a.evaluate(() => window.__isle.skyDim.state());
  check('you go up into the sky', st.on === true && st.kind === 'sky', st);
  const blocks = await a.evaluate(() => { const I = window.__isle; return { skystone: I.skyDim.count(I.B.SKYSTONE), starlamp: I.skyDim.count(I.B.STARLAMP), cloud: I.skyDim.count(I.B.CLOUD) }; });
  check('the sky has its own blocks, skystone and starlamp, in its structures', blocks.skystone > 60 && blocks.starlamp >= 3, blocks);
  const sp = await a.evaluate(() => window.__isle.skyDim.spawn());
  check('you stand on the big cloud island', sp && Math.abs(sp.y - 45) < 1, sp);
  await a.evaluate(() => window.__isle.skyDim.leave());
  await wait(300);
  const back = await a.evaluate(() => window.__isle.skyDim.state());
  check('and the way home leads back to the island', back.on === false && back.kind === null, back);
  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
