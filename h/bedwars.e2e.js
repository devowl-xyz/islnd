// Bedwars in real Chromium: a crystal round out at sea; beds can't be broken, crystals count.
// Run: node h/bedwars.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18145, URL = 'http://localhost:' + PORT + '/?layout=classic';
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
  await a.evaluate(() => window.__isle.cmd('/bedwars team water'));
  await wait(200);
  check('you can pick an elemental team', (await a.evaluate(() => window.__isle.bw.state())).team === 'water');
  await a.evaluate(() => window.__isle.cmd('/bedwars'));
  await wait(400);
  check('/bedwars starts a round', (await a.evaluate(() => window.__isle.bw.state())).on === true, await a.evaluate(() => window.__isle.bw.state()));
  const crystals = await a.evaluate(() => { const I = window.__isle; let n = 0; for (let x = 20; x < 50; x++) for (let z = 122; z < 152; z++) if (I.get(x, 11, z) === I.B.CRYSTAL) n++; return n; });
  check('there are crystals on the arena floor', crystals >= 20, crystals);
  check('there are beds at either end', await a.evaluate(() => { const I = window.__isle; return I.get(...I.bw.bedAt()) === I.B.BED; }));
  await a.evaluate(() => { const I = window.__isle, c = I.bw.bedAt(); I.bw.mine(c[0], c[1], c[2]); });
  await wait(200);
  check('a bed can’t be broken', await a.evaluate(() => { const I = window.__isle, c = I.bw.bedAt(); return I.get(c[0], c[1], c[2]) === I.B.BED; }));
  // mine a crystal: find one and break it
  const cry = await a.evaluate(() => { const I = window.__isle; for (let x = 20; x < 50; x++) for (let z = 122; z < 152; z++) if (I.get(x, 11, z) === I.B.CRYSTAL) return [x, 11, z]; return null; });
  const before = (await a.evaluate(() => window.__isle.bw.state())).crystals;
  if (cry) await a.evaluate((c) => window.__isle.bw.mine(c[0], c[1], c[2]), cry);
  await wait(200);
  check('mining a crystal counts one', cry && (await a.evaluate(() => window.__isle.bw.state())).crystals === before + 1, [before, await a.evaluate(() => window.__isle.bw.state())]);
  // the empty teams are bots: they take crystals too, so you race them
  await a.waitForFunction(() => window.__isle.bw.state().bots >= 1, null, { timeout: 150000, polling: 300 }).catch(() => {});
  check('the bots take crystals off the floor', (await a.evaluate(() => window.__isle.bw.state())).bots >= 1, await a.evaluate(() => window.__isle.bw.state().bots));
  // the round ends when the time is up, and keeps your best
  await a.evaluate(() => window.__isle.bw.set(0.5));
  await a.waitForFunction(() => window.__isle.bw.state().on === false, null, { timeout: 90000, polling: 200 }).catch(() => {});
  const end = await a.evaluate(() => window.__isle.bw.state());
  check('the round ends, and your best is kept', end.on === false && end.best >= 1, end);
  check('your team’s record is kept', (end.teamBest.water || 0) >= 1, end.teamBest);
  check('the round ranks all four teams, and a winner is recorded', Array.isArray(end.ranking) && end.ranking.length === 4 && Object.keys(end.wins).length >= 1, end.ranking);
  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
