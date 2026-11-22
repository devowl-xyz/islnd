// Rusty the fox: an owl owner can recruit him, and then he follows them along with their owl.
// Run: node h/fox-recruit.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18181, URL = 'http://localhost:' + PORT + '/?layout=classic';
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
  await a.evaluate(() => { const I = window.__isle; I.fox.reset(); I.setSkin({ pet: 'hoot' }); const h = I.fox.home(); I.player.fly = false; I.player.x = h.x + 1.5; I.player.z = h.z; I.player.y = h.y + 0.2; });
  await wait(800);
  check('an owl owner next to Rusty is close enough to ask', await a.evaluate(() => window.__isle.fox.near()));
  await a.keyboard.press('KeyE'); await wait(300);
  check('E asks whether to recruit Rusty', await a.evaluate(() => window.__isle.fox.ask()));
  await a.evaluate(() => window.__isle.fox.recruit());
  check('Rusty is recruited', await a.evaluate(() => window.__isle.fox.recruited()));
  await a.waitForFunction(() => window.__isle.fox.followers().indexOf('fox:me') >= 0, null, { timeout: 60000, polling: 300 }).catch(() => {});
  check('recruited, Rusty follows the owl’s owner', await a.evaluate(() => window.__isle.fox.followers().indexOf('fox:me') >= 0), await a.evaluate(() => window.__isle.fox.followers()));
  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
