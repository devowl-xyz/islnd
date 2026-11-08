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
  // messages in bottles
  const shore = await host.evaluate(() => { const I = window.__isle; for (let z = 40; z < 320; z += 3) for (let x = 40; x < 320; x += 3) if (I.get(x, 10, z) === 4 && I.get(x, 11, z) === 0 && (I.get(x + 1, 10, z) === 12 || I.get(x - 1, 10, z) === 12 || I.get(x, 10, z + 1) === 12 || I.get(x, 10, z - 1) === 12)) return { x: x + 0.5, y: 11, z: z + 0.5 }; return null; });
  await host.evaluate((q) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = q.x; P.y = q.y; P.z = q.z; }, shore); await wait(500);
  check('in a room, /bottle throws your message out to sea', await host.evaluate(() => window.__isle.cmd('/bottle Ahoy, Gus!')));
  await guest.waitForFunction(() => window.__isle.bottle.list().some((b) => /Ahoy, Gus/.test(b.text)), null, { timeout: 20000 }).catch(() => {});
  const gb = await guest.evaluate(() => window.__isle.bottle.list().find((b) => /Ahoy, Gus/.test(b.text)) || null);
  check('and it washes up on a beach for others to find', !!gb && gb.from === 'Hana', gb);
  if (gb) {
    await guest.evaluate((q) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = q.x + 0.6; P.y = q.y; P.z = q.z; }, gb); await wait(600);
    await guest.evaluate(() => window.__isle.bottle.read());
    await host.waitForFunction(() => !window.__isle.bottle.list().some((b) => /Ahoy, Gus/.test(b.text)), null, { timeout: 20000 }).catch(() => {});
    check('whoever finds it first reads it, and it’s gone for everyone', /Ahoy, Gus/.test(await guest.evaluate(() => window.__isle.bottle.said() || '')) && !(await host.evaluate(() => window.__isle.bottle.list().some((b) => /Ahoy, Gus/.test(b.text)))));
    await guest.evaluate(() => { const b = document.getElementById('letterOk'); if (b) b.click(); });
  }
  // owners may break any block of their own house: the room's server agrees
  const tc = await host.evaluate(() => { const I = window.__isle, T = I.th.TH; for (let y = T.y0 + 1; y <= T.y1; y++) for (let z = T.z0; z <= T.z1; z++) for (let x = T.x0; x <= T.x1; x++) if (I.th.cell(x, y, z) === 'base' && I.get(x, y, z) && I.get(x, y, z) !== 12) return [x, y, z]; return null; });
  await host.evaluate((c) => window.__isle.setBlock(c[0], c[1], c[2], 0), tc); await wait(2500);
  check('in a room, someone else can’t break the treehouse’s frame', (await guest.evaluate((c) => window.__isle.get(c[0], c[1], c[2]), tc)) !== 0 && (await host.evaluate((c) => window.__isle.get(c[0], c[1], c[2]), tc)) !== 0);
  await guest.evaluate(() => window.__isle.setSkin({ pet: 'hoot' })); await wait(1500);
  await guest.evaluate((c) => window.__isle.setBlock(c[0], c[1], c[2], 0), tc);
  await host.waitForFunction((c) => window.__isle.get(c[0], c[1], c[2]) === 0, tc, { timeout: 20000 }).catch(() => {});
  check('but an owl owner can, and everyone sees it', (await host.evaluate((c) => window.__isle.get(c[0], c[1], c[2]), tc)) === 0);
  await guest.evaluate(() => window.__isle.setSkin({ pet: 'none' }));
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
