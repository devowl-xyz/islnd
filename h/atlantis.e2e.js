// Goldie's underwater house test in real Chromium pages.
// Run: node h/atlantis.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18140, URL = 'http://localhost:' + PORT + '/?layout=classic';
const WATER = 12, GLASS = 9, MARBLE = 24, GOLD = 25, STONE = 3;
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const open = async (name) => {
    const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
    page.on('pageerror', (e) => { console.log((name || 'page') + ' pageerror', e.message); fails++; });
    await page.goto(URL);
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
    if (name) await page.fill('#nName', name);
    return page;
  };
  const play = (p) => p.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); });
  const get = (p, x, y, z) => p.evaluate(([x, y, z]) => window.__isle.get(x, y, z), [x, y, z]);
  const set = (p, x, y, z, b) => p.evaluate(([x, y, z, b]) => window.__isle.setBlock(x, y, z, b), [x, y, z, b]);
  const raw = (p, x, y, z, b) => p.evaluate(([x, y, z, b]) => window.__isle.net.ws.send(JSON.stringify({ t: 'edit', x, y, z, b })), [x, y, z, b]);
  // swim up into the moon pool from underneath, pressing forward against its edge
  const climb = async (p) => {
    await p.evaluate(() => { const P = window.__isle.player; P.fly = false; P.x = 80.0; P.y = 2.2; P.z = 147.0; P.yaw = Math.PI; P.pitch = 0; P.vx = P.vy = P.vz = 0; });
    await p.keyboard.down('Space'); await p.keyboard.down('KeyW');
    await p.waitForFunction(() => window.__isle.player.y >= 4.95 && window.__isle.player.z > 148.2, null, { timeout: 45000 }).catch(() => {});
    await p.keyboard.up('Space'); await p.keyboard.up('KeyW');
    return p.evaluate(() => { const P = window.__isle.player; return { y: P.y, z: P.z }; });
  };

  const a = await open();
  check('a marble floor with a gold rim stands on stilts above the sea bed', (await get(a, 80, 4, 150)) === MARBLE && (await get(a, 86, 4, 150)) === GOLD && (await get(a, 85, 2, 150)) === MARBLE && (await get(a, 82, 2, 152)) === WATER);
  check('a glass dome with marble columns and a gold band', (await get(a, 81, 6, 144)) === GLASS && (await get(a, 80, 6, 144)) === MARBLE && (await get(a, 80, 7, 145)) === GOLD && (await get(a, 80, 9, 150)) === GOLD);
  check('it is dry inside, under the sea', (await get(a, 80, 6, 150)) === 0 && (await get(a, 82, 7, 152)) === 0 && (await get(a, 80, 10, 140)) === WATER);
  check('a moon pool in the floor, filled to the brim', (await get(a, 79, 4, 146)) === WATER && (await get(a, 80, 3, 147)) === WATER && (await get(a, 79, 5, 146)) === 0);
  check('the water stays put: nothing is waiting to flow', await a.evaluate(() => window.__isle.simIdle()));
  check('Goldie swims round the house', await a.evaluate(() => { const h = window.__isle.pets.home.goldie; return window.__isle.get(Math.floor(h.x), Math.floor(h.y), Math.floor(h.z)) === 12 && Math.hypot(h.x - 80, h.z - 150) > 7; }));

  check('nobody can change the dome, floor or stilts', !(await set(a, 81, 6, 144, 0)) && !(await set(a, 80, 4, 150, 0)) && !(await set(a, 85, 2, 150, 0)) && !(await set(a, 79, 4, 146, STONE)));
  check('without Goldie you cannot decorate inside', !(await set(a, 82, 5, 150, STONE)));

  await play(a); await wait(900);
  const c1 = await climb(a);
  check('without Goldie the moon pool will not let you in', c1.y < 4.5, c1);
  await a.evaluate(() => { const P = window.__isle.player; P.fly = true; P.x = 81.5; P.y = 5; P.z = 151.5; });
  await a.waitForFunction(() => window.__isle.player.z < 144, null, { timeout: 8000 }).catch(() => {});
  check('a non-owner who ends up inside is put back in the sea outside', await a.evaluate(() => window.__isle.player.z < 144));

  check('adopting Goldie', await a.evaluate(() => window.__isle.pets.adopt('goldie')));
  const c2 = await climb(a);
  check('with Goldie you swim up through the moon pool into the house', c2.y >= 4.95 && c2.z > 148.2, c2);
  check('Goldie’s owner can decorate inside', await set(a, 82, 5, 152, GOLD) && (await get(a, 82, 5, 152)) === GOLD && await set(a, 80, 6, 151, 0) && await set(a, 80, 6, 151, GOLD));
  check('but the dome stays fixed', !(await set(a, 80, 6, 144, 0)) && !(await set(a, 74, 5, 150, 0)));
  await a.waitForFunction(() => { const f = window.__isle.pets.follower(); return f && Math.hypot(f.x - 80, f.z - 147) < 0.8; }, null, { timeout: 30000 }).catch(() => {});
  check('while you are home Goldie swims in the moon pool', await a.evaluate(() => { const f = window.__isle.pets.follower(); return f && Math.hypot(f.x - 80, f.z - 147) < 0.8 && f.y < 5; }));

  // Rooms: only Goldie's owner can change the inside; the server checks.
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  check('the joiner sees the owner’s decorations', (await get(g, 82, 5, 152)) === GOLD);
  await raw(g, 83, 5, 150, STONE); await wait(500);
  check('the server stops others decorating Goldie’s house', (await get(a, 83, 5, 150)) === 0);
  await raw(a, 81, 6, 144, 0); await wait(500);
  check('the server stops anyone, even the owner, breaking the dome', (await get(g, 81, 6, 144)) === GLASS);
  await raw(a, 81, 5, 150, MARBLE); await wait(500);
  await g.waitForFunction(() => window.__isle.get(81, 5, 150) === 24, null, { timeout: 8000 }).catch(() => {});
  check('the owner’s new decorations reach others', (await get(g, 81, 5, 150)) === MARBLE);

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
