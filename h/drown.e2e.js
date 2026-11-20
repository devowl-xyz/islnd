// Drowning in real Chromium: in survival, your head under water uses up your air and then your hearts.
// Run: node h/drown.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18129, URL = 'http://localhost:' + PORT + '/?layout=classic';
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
  // a clear spot on the meadow, survival, full hearts
  await a.evaluate(() => { const I = window.__isle; I.cmd('/gamemode survival'); const P = I.player; P.fly = false; P.x = 80.5; P.z = 92.5; P.y = 13; P.vx = P.vy = P.vz = 0; I.hunger.set(20); I.hunger.hp(10); });
  await wait(600);
  // put your head under water: fill the column round you with water
  const water = (on) => a.evaluate((on) => { const I = window.__isle, x = Math.floor(I.player.x), z = Math.floor(I.player.z), y = Math.floor(I.player.y); for (let dy = 0; dy <= 4; dy++) I.tnt.place(x, y + dy, z, on ? I.B.WATER : 0); I.tnt.place(x, y + 5, z, on ? I.B.STONE : 0); /* a ceiling, so you can't float out of it */ }, on);
  await water(true); await wait(200);
  check('your head is under water', await a.evaluate(() => window.__isle.drown.head()));
  const hp0 = await a.evaluate(() => window.__isle.food.hp());
  // the game runs in its own time (slower than the clock in a headless browser), so wait on the game's state
  await a.waitForFunction(() => window.__isle.drown.air() < 9, null, { timeout: 60000, polling: 200 }).catch(() => {});
  check('your air runs down while you’re under', (await a.evaluate(() => window.__isle.drown.air())) < 9.5 && (await a.evaluate(() => window.__isle.food.hp())) === hp0, [hp0, await a.evaluate(() => window.__isle.drown.air())]);
  await a.waitForFunction(() => window.__isle.drown.air() <= 0, null, { timeout: 120000, polling: 200 }).catch(() => {});
  await a.waitForFunction((h) => window.__isle.food.hp() < h, hp0, { timeout: 120000, polling: 200 }).catch(() => {});
  check('out of air, you start losing hearts', (await a.evaluate(() => window.__isle.food.hp())) < hp0, [hp0, await a.evaluate(() => window.__isle.food.hp())]);
  await water(false);
  await a.waitForFunction(() => window.__isle.drown.air() >= 9.5, null, { timeout: 60000, polling: 200 }).catch(() => {});
  check('get your head out and your air comes back', (await a.evaluate(() => window.__isle.drown.air())) >= 9.5, await a.evaluate(() => window.__isle.drown.air()));
  // creative mode: no drowning at all
  await a.evaluate(() => { const I = window.__isle; I.cmd('/gamemode creative'); I.hunger.hp(10); });
  await water(true);
  await a.waitForFunction(() => window.__isle.drown.head(), null, { timeout: 10000, polling: 200 }).catch(() => {});
  await a.waitForFunction(() => window.__isle.drown.air() < 10, null, { timeout: 5000, polling: 200 }).catch(() => {});
  await wait(3000);
  check('in creative you don’t drown', (await a.evaluate(() => window.__isle.drown.air())) === 10 && (await a.evaluate(() => window.__isle.food.hp())) === 10, await a.evaluate(() => window.__isle.drown.air()));
  await water(false);
  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
