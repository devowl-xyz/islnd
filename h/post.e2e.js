// Room social test in real Chromium pages: letters, gifts, team bases and the racing league.
// Run: node h/post.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');
const PORT = 18095, URL = 'http://localhost:' + PORT + '/?layout=classic';
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
  // the postman pigeon
  check('/letter sends a pigeon off with your letter', await guest.evaluate(() => window.__isle.cmd('/letter Hana Meet me at the lighthouse!')));
  await host.waitForFunction(() => /lighthouse/.test(document.getElementById('announce').textContent), null, { timeout: 30000 }).catch(() => {});
  check('a pigeon flies it to them and they read it', /Meet me at the lighthouse/.test(await host.evaluate(() => document.getElementById('announce').textContent)));
  // gifts
  await host.evaluate(() => window.__isle.shop.give(50)); await wait(1700);
  const hc = await host.evaluate(() => window.__isle.shop.coins()), gc = await guest.evaluate(() => window.__isle.shop.coins());
  check('/gift Name 10 gives them coins', await host.evaluate(() => window.__isle.cmd('/gift Gus 10')));
  await guest.waitForFunction((g) => window.__isle.shop.coins() >= g + 10, gc, { timeout: 20000 }).catch(() => {});
  check('they arrive, and leave your purse', (await guest.evaluate(() => window.__isle.shop.coins())) === gc + 10 && (await host.evaluate(() => window.__isle.shop.coins())) === hc - 10);
  await host.evaluate(() => window.__isle.k2.addHat('pirate')); await wait(1700);
  await host.evaluate(() => window.__isle.cmd('/gift Gus hat pirate'));
  await guest.waitForFunction(() => window.__isle.k2.hats().indexOf('pirate') >= 0, null, { timeout: 20000 }).catch(() => {});
  check('you can give a hat too', (await guest.evaluate(() => window.__isle.k2.hats())).indexOf('pirate') >= 0 && (await host.evaluate(() => window.__isle.k2.hats())).indexOf('pirate') < 0);
  // teams
  await host.evaluate(() => window.__isle.cmd('/team red')); await guest.evaluate(() => window.__isle.cmd('/team red')); await wait(1500);
  await host.evaluate(() => window.__isle.cmd('/team base'));
  await guest.waitForFunction(() => { const t = window.__isle.k2.teams(); return t.state.red && t.state.red.base; }, null, { timeout: 20000 }).catch(() => {});
  const gt2 = await guest.evaluate(() => window.__isle.k2.teams());
  check('players join a team and plant its flag; everyone sees the base', gt2.mine === 'red' && gt2.state.red.members.length === 2 && !!gt2.state.red.base && gt2.flags.indexOf('red') >= 0, gt2);
  await guest.evaluate(() => window.__isle.cmd('/team deposit 5'));
  await host.waitForFunction(() => { const t = window.__isle.k2.teams(); return t.state.red && t.state.red.bank === 5; }, null, { timeout: 20000 }).catch(() => {});
  check('the team bank is shared', (await host.evaluate(() => window.__isle.k2.teams().state.red.bank)) === 5);
  const hc2 = await host.evaluate(() => window.__isle.shop.coins());
  await host.evaluate(() => window.__isle.cmd('/team withdraw 3'));
  await host.waitForFunction((c) => window.__isle.shop.coins() === c + 3, hc2, { timeout: 20000 }).catch(() => {});
  check('and any member can take coins out', (await host.evaluate(() => window.__isle.shop.coins())) === hc2 + 3 && (await guest.evaluate(() => window.__isle.k2.teams().state.red.bank)) === 2);
  await host.evaluate(() => window.__isle.cmd('/team withdraw 50')); await wait(1500);
  check('but not more than is in it', (await host.evaluate(() => window.__isle.k2.teams().state.red.bank)) === 2);
  // the racing league
  await host.evaluate(() => window.__isle.k2.setBoatBest(83.4));
  await guest.waitForFunction(() => /Hana/.test(window.__isle.k2.leagueHtml()), null, { timeout: 20000 }).catch(() => {});
  check('the racing league shows the best times in the room', /1:23\.4\s*Hana/.test(await guest.evaluate(() => window.__isle.k2.leagueHtml())), await guest.evaluate(() => window.__isle.k2.leagueHtml()));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await browser.close(); server.close(); process.exit(fails ? 1 : 0);
})();
