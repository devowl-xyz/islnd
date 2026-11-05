// Room games test in real Chromium pages: hide and seek, and build battles.
// Run: node h/games.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');
const PORT = 18094, URL = 'http://localhost:' + PORT + '/?layout=classic';
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const open = async (name) => {
    const page = await (await browser.newContext({ viewport: { width: 800, height: 500 } })).newPage();
    page.on('pageerror', (e) => { console.log(name + ' pageerror', e.message); fails++; });
    await page.goto(URL);
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 240000 });
    await page.evaluate(() => window.__isle.more(true)); await page.fill('#nName', name);
    return page;
  };
  const host = await open('Hana');
  await host.evaluate(() => document.getElementById('nHost').click());
  await host.waitForFunction(() => window.__isle.net.code, null, { timeout: 60000 });
  const code = await host.textContent('#nRoomCode');
  const guest = await open('Gus');
  await guest.fill('#nCode', code); await guest.click('#nJoin');
  await guest.waitForFunction(() => window.__isle.net.code && window.__isle.isReady(), null, { timeout: 240000 });
  for (const p of [host, guest]) await p.evaluate(() => document.getElementById('play').click());
  await wait(1500);
  // hide and seek
  check('the host starts hide and seek', await host.evaluate(() => window.__isle.games.hsStart()));
  await guest.waitForFunction(() => window.__isle.games.hs().on, null, { timeout: 15000 }).catch(() => {});
  const hh = await host.evaluate(() => window.__isle.games.hs()), gh = await guest.evaluate(() => window.__isle.games.hs());
  check('everyone in the room is playing, with the same seeker', hh.on && gh.on && hh.seeker === gh.seeker && hh.hiders.length === 1, [hh, gh]);
  const hostSeeks = await host.evaluate((s) => window.__isle.net.you === s, hh.seeker);
  const seeker = hostSeeks ? host : guest, hider = hostSeeks ? guest : host;
  check('the seeker is frozen while counting, and the hider is in disguise', await seeker.evaluate(() => window.__isle.games.frozen()) && !!(await hider.evaluate(() => window.__isle.games.dg())));
  await seeker.evaluate(() => window.__isle.games.hsRush());
  const sp = await seeker.evaluate(() => { const P = window.__isle.player; return { x: P.x, y: P.y, z: P.z }; });
  await hider.evaluate((q) => { const P = window.__isle.player; P.x = q.x + 1; P.y = q.y; P.z = q.z; P.vx = P.vy = P.vz = 0; }, sp);
  await hider.waitForFunction(() => window.__isle.games.hs().found.length > 0 || !window.__isle.games.hs().on, null, { timeout: 30000 }).catch(() => {});
  check('the seeker tags the hider by getting close, and everyone hears', (await hider.evaluate(() => { const h = window.__isle.games.hs(); return h.found.length > 0 || !h.on; })) && !(await hider.evaluate(() => window.__isle.games.dg())));
  // build battle
  check('the host starts a build battle', await host.evaluate(() => window.__isle.games.bbStart()));
  await guest.waitForFunction(() => !!window.__isle.games.bb(), null, { timeout: 15000 }).catch(() => {});
  const ht = await host.evaluate(() => window.__isle.games.bb()), gt = await guest.evaluate(() => window.__isle.games.bb());
  check('everyone gets the same theme', !!ht && !!gt && ht.theme === gt.theme, [ht, gt]);
  for (const p of [host, guest]) await p.evaluate(() => window.__isle.games.bbRush());
  await host.waitForFunction(() => { const b = window.__isle.games.bb(); return b && b.phase === 'vote'; }, null, { timeout: 15000 }).catch(() => {});
  await guest.waitForFunction(() => { const b = window.__isle.games.bb(); return b && b.phase === 'vote'; }, null, { timeout: 15000 }).catch(() => {});
  await host.keyboard.press('Digit1'); await guest.keyboard.press('Digit1'); await wait(1500);
  check('then everyone votes with 1 to 9', (await host.evaluate(() => window.__isle.games.bb().myVote)) !== null && Object.keys(await guest.evaluate(() => window.__isle.games.bb().votes)).length === 2);
  for (const p of [host, guest]) await p.evaluate(() => window.__isle.games.bbRush());
  await wait(1500);
  const w = [await host.evaluate(() => window.__isle.games.wins()), await guest.evaluate(() => window.__isle.games.wins())];
  check('and exactly one winner is crowned, the same on every screen', w[0] + w[1] === 1 && !(await host.evaluate(() => window.__isle.games.bb())), w);
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await browser.close(); server.close(); process.exit(fails ? 1 : 0);
})();
