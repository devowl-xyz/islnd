// The sponge soaks up water and lava (and nothing else); bedrock can be dug, except the very bottom.
// Run: node h/sponge-bedrock.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18149, URL = 'http://localhost:' + PORT + '/?layout=classic';
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
  await a.evaluate(() => { const I = window.__isle; I.cmd('/gamemode creative'); const P = I.player; P.fly = true; P.x = 80.5; P.z = 92.5; P.y = 20; I.sponge.hold(I.B.SPONGE); });
  // a pool of water and a pool of lava, with a stone block in the middle of the water
  await a.evaluate(() => { const I = window.__isle; for (let x = 60; x < 66; x++) for (let z = 60; z < 66; z++) for (let y = 14; y < 17; y++) I.tnt.place(x, y, z, I.B.WATER); I.tnt.place(63, 15, 63, I.B.STONE); for (let x = 70; x < 76; x++) for (let z = 60; z < 66; z++) I.tnt.place(x, 15, z, I.B.LAVA); });
  const count = (b) => a.evaluate((b) => { const I = window.__isle; let n = 0; for (let x = 58; x < 78; x++) for (let z = 58; z < 68; z++) for (let y = 13; y < 18; y++) if (I.get(x, y, z) === b) n++; return n; }, null);
  const water0 = await a.evaluate(() => { const I = window.__isle; let n = 0; for (let x = 58; x < 68; x++) for (let z = 58; z < 68; z++) for (let y = 13; y < 18; y++) if (I.get(x, y, z) === I.B.WATER) n++; return n; });
  check('there is water to soak', water0 > 40, water0);
  // holding the button soaks again and again, as you drag it over the pool
  // dragging the sponge over the pool: soak at points across it
  await a.evaluate(() => { for (let x = 60; x <= 65; x += 2) for (let z = 60; z <= 65; z += 2) window.__isle.sponge.soak(x, 15, z); });
  const water1 = await a.evaluate(() => { const I = window.__isle; let n = 0; for (let x = 58; x < 68; x++) for (let z = 58; z < 68; z++) for (let y = 13; y < 18; y++) if (I.get(x, y, z) === I.B.WATER) n++; return n; });
  check('the sponge soaks up water near where you point', water1 < water0 / 2, [water0, water1]);
  check('the stone in the water is left alone', await a.evaluate(() => { const I = window.__isle; return I.get(63, 15, 63) === I.B.STONE; }));
  await a.evaluate(() => { for (let x = 70; x <= 75; x += 2) for (let z = 60; z <= 65; z += 2) window.__isle.sponge.soak(x, 15, z); });
  const lava1 = await a.evaluate(() => { const I = window.__isle; let n = 0; for (let x = 70; x < 76; x++) for (let z = 60; z < 66; z++) if (I.get(x, 15, z) === I.B.LAVA) n++; return n; });
  check('it soaks up lava too', lava1 < 20, lava1);
  // bedrock: you can place it and dig it (creative breaks it), but the very bottom can't be broken
  await a.evaluate(() => { const I = window.__isle; I.tnt.place(40, 20, 40, I.B.BEDROCK); I.bw.mine(40, 20, 40); });
  check('bedrock can be dug', await a.evaluate(() => window.__isle.get(40, 20, 40) === 0));
  await a.evaluate(() => { const I = window.__isle; I.tnt.place(40, 0, 40, I.B.BEDROCK); I.bw.mine(40, 0, 40); });
  check('the very bottom of the world still can’t be dug', await a.evaluate(() => window.__isle.get(40, 0, 40) === window.__isle.B.BEDROCK));
  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
