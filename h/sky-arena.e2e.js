// The sky arena's powers: Fire's crystals count double; Earth digs half as much again as fast.
// Run: node h/sky-arena.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18167, URL = 'http://localhost:' + PORT + '/?layout=classic';
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
  await a.evaluate(() => window.__isle.cmd('/gamemode creative'));
  // Fire: crystals count double
  await a.evaluate(() => window.__isle.cmd('/bedwars team fire'));
  await a.evaluate(() => window.__isle.cmd('/bedwars start'));
  await wait(300);
  const cry = await a.evaluate(() => { const I = window.__isle; for (let x = 160; x < 256; x++) for (let z = 160; z < 256; z++) if (I.get(x, 61, z) === I.B.CRYSTAL) return [x, 61, z]; return null; });
  const before = await a.evaluate(() => window.__isle.bw.state().crystals);
  if (cry) await a.evaluate((c) => window.__isle.bw.mine(c[0], c[1], c[2]), cry);
  await wait(200);
  const after = await a.evaluate(() => window.__isle.bw.state().crystals);
  check('for Fire, a crystal counts double', cry && after - before === 2, [before, after]);
  await a.evaluate(() => window.__isle.cmd('/bedwars stop'));
  await wait(200);
  // Earth: digs half as much again as fast
  await a.evaluate(() => window.__isle.cmd('/bedwars team earth'));
  await a.evaluate(() => window.__isle.cmd('/bedwars start'));
  await wait(300);
  const dig = await a.evaluate(() => window.__isle.bw.dig());
  check('for Earth, digging is half as much again as fast', Math.abs(dig - 1.5) < 1e-9, dig);
  await a.evaluate(() => window.__isle.cmd('/bedwars stop'));
  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
