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
  await a.evaluate(() => window.__isle.cmd('/bedwars start'));
  await wait(400);
  check('/bedwars starts a round', (await a.evaluate(() => window.__isle.bw.state())).on === true, await a.evaluate(() => window.__isle.bw.state()));
  const crystals = await a.evaluate(() => { const I = window.__isle; let n = 0; for (let x = 160; x < 256; x++) for (let z = 160; z < 256; z++) if (I.get(x, 61, z) === I.B.CRYSTAL) n++; return n; });
  check('there is one crystal on each island', crystals === 5, crystals);
  check('the four islands are in the sky, one per element', (await a.evaluate(() => window.__isle.bw.islands())).join() === 'fire,water,earth,air');
  check('the water team’s power is on in the round', await a.evaluate(() => window.__isle.bw.powerOn('water')) === true);
  check('there are beds at either end', await a.evaluate(() => { const I = window.__isle; return I.get(...I.bw.bedAt()) === I.B.BED; }));
  await a.evaluate(() => { const I = window.__isle, c = I.bw.bedAt(); I.bw.mine(c[0], c[1], c[2]); });
  await wait(200);
  check('a bed can’t be broken', await a.evaluate(() => { const I = window.__isle, c = I.bw.bedAt(); return I.get(c[0], c[1], c[2]) === I.B.BED; }));
  // mine a crystal: find one and break it
  const cry = await a.evaluate(() => { const I = window.__isle; for (let x = 160; x < 256; x++) for (let z = 160; z < 256; z++) if (I.get(x, 61, z) === I.B.CRYSTAL) return [x, 61, z]; return null; });
  const before = (await a.evaluate(() => window.__isle.bw.state())).crystals;
  if (cry) await a.evaluate((c) => window.__isle.bw.mine(c[0], c[1], c[2]), cry);
  await wait(200);
  check('mining a crystal counts one', cry && (await a.evaluate(() => window.__isle.bw.state())).crystals === before + 1, [before, await a.evaluate(() => window.__isle.bw.state())]);
  // a crystal that's broken comes back after ten seconds
  const gone = await a.evaluate(() => window.__isle.bw.spots().filter((s) => s.t > 0).length);
  check('a broken island crystal waits ten seconds before it grows back', gone >= 1, gone);
  await a.evaluate(() => window.__isle.bwAdv(10));
  const back = await a.evaluate(() => window.__isle.bw.spots().every((s) => s.has));
  check('after ten seconds it is back', back === true);
  // an admin can change how many bots a team has
  await a.evaluate(() => window.__isle.cmd('/bedwars bots earth 2'));
  check('an admin can give a team two bots', (await a.evaluate(() => window.__isle.bw.state())).botCount.earth === 2);
  // the start screen opens and lists the teams
  await a.evaluate(() => window.__isle.bw.panel(true));
  await wait(200);
  check('the start screen lists the four teams', await a.evaluate(() => window.__isle.bw.panelText()).then(function(x){return /Fire/.test(x)&&/Water/.test(x)&&/Earth/.test(x)&&/Air/.test(x);}));
  await a.evaluate(() => window.__isle.bw.panel(false));
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
