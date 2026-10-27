// Cinder's den, smooth plot edges and footpaths, in real Chromium pages.
// Run: node h/den.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18160, URL = 'http://localhost:' + PORT + '/?layout=classic';
const BASALT = 17, GOLD = 25, SANDSTONE = 23, STONE = 3;
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
  const walkDown = async (p, untilZ) => {
    await p.evaluate(() => { const P = window.__isle.player; P.fly = false; P.x = 85.5; P.y = 13; P.z = 116.6; P.yaw = Math.PI; P.pitch = 0; P.vx = P.vy = P.vz = 0; });
    await p.keyboard.down('KeyW');
    await p.waitForFunction((z) => window.__isle.player.z > z, untilZ, { timeout: 90000 }).catch(() => {});
    await p.keyboard.up('KeyW');
    return p.evaluate(() => { const P = window.__isle.player; return { y: P.y, z: P.z }; });
  };

  const a = await open();
  // Smooth edges: walk outward from each levelled plot and check no step is more than 2 blocks.
  const edges = await a.evaluate(() => {
    const I = window.__isle;
    // the ground only: skip logs, leaves, water and planks (the observation deck's staircase stands on the treehouse plot's west edge)
    const top = (x, z) => { for (let y = 47; y > 0; y--) { const b = I.get(x, y, z); if (b !== 0 && b !== 5 && b !== 6 && b !== 7 && b !== 12) return y + 1; } return 0; };
    const line = (pts) => { let worst = 0; for (let k = 1; k < pts.length; k++) worst = Math.max(worst, Math.abs(top(pts[k][0], pts[k][1]) - top(pts[k - 1][0], pts[k - 1][1]))); return worst; };
    const seq = (x0, z0, dx, dz, n) => Array.from({ length: n }, (_, k) => [x0 + dx * k, z0 + dz * k]);
    return {
      cottageNorth: line(seq(121, 49, 0, 1, 10)), cottageEast: line(seq(131, 70, 1, 0, 9)),
      treehouseWest: line(seq(24, 82, 1, 0, 10)), treehouseSouth: line(seq(44, 104, 0, 1, 9)), treehouseEast: line(seq(54, 86, 1, 0, 6))
    };
  });
  check('the levelled plots ease into the hills (no step over 2 blocks)', Object.values(edges).every((v) => v <= 2), edges);
  const paths = await a.evaluate(() => { const I = window.__isle, top = (x, z) => { for (let y = 47; y > 0; y--) { const b = I.get(x, y, z); if (b !== 0 && b !== 5 && b !== 6) return b; } return 0; }; return { tree: top(50, 106), cottage: top(103, 72), dock: top(125, 80), beach: top(79, 125) }; });
  check('sandstone paths lead from the meadow to the homes and the dock', Object.values(paths).every((b) => b === SANDSTONE), paths);

  // The den.
  const steps = []; for (let k = 0; k <= 10; k++) steps.push(await get(a, 85, 12 - k, 118 + k));
  check('a stairway leads down from the meadow’s south edge', steps.every((b) => b === BASALT), steps);
  check('under a gold-capped arch', (await get(a, 85, 16, 118)) === GOLD && (await get(a, 85, 13, 118)) === 0 && (await get(a, 85, 15, 118)) === 0);
  check('into a hall with pillars, a hoard and a nest', (await get(a, 85, 4, 132)) === 0 && (await get(a, 82, 5, 128)) === BASALT && (await get(a, 88, 3, 134)) === GOLD && (await get(a, 85, 3, 132)) === 0);
  check('the hall stays dry', await a.evaluate(() => window.__isle.simIdle()));
  check('the stairway, hall and pillars cannot be changed', !(await set(a, 85, 10, 120, 0)) && !(await set(a, 82, 5, 128, 0)) && !(await set(a, 85, 9, 132, 0)) && !(await set(a, 85, 2, 132, 0)));
  check('nobody can decorate while Cinder has no owner', !(await set(a, 84, 4, 131, STONE)));

  await play(a); await wait(900);
  const d1 = await walkDown(a, 129.5);
  check('while Cinder has no owner, anyone can walk down to it', d1.z > 129.5 && d1.y < 4, d1);
  check('waking Cinder in its den', await a.evaluate(() => window.__isle.pets.adopt('cinder')));
  check('Cinder’s owner decorates the den', await set(a, 84, 4, 131, GOLD) && (await get(a, 84, 4, 131)) === GOLD && await set(a, 88, 3, 134, 0) && await set(a, 88, 3, 134, GOLD));
  await a.waitForFunction(() => { const f = window.__isle.pets.follower(); return f && Math.hypot(f.x - 85.5, f.z - 132.5) < 0.6 && Math.abs(f.y - 3) < 0.6; }, null, { timeout: 30000 }).catch(() => {});
  check('while you are home Cinder curls up on its nest', await a.evaluate(() => { const f = window.__isle.pets.follower(); return f && Math.hypot(f.x - 85.5, f.z - 132.5) < 0.6 && Math.abs(f.y - 3) < 0.6; }));

  // Rooms: once Cinder has an owner, only they can go in or change it.
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  await play(g);
  await g.waitForFunction(() => { let k = false; window.__isle.net.peers.forEach((p) => { if (p.skin.pet === 'cinder') k = true; }); return k; }, null, { timeout: 8000 }).catch(() => {});
  const d2 = await walkDown(g, 124);
  check('someone else is stopped partway down the stairway', d2.z < 124.5, d2);
  await g.evaluate(() => { const P = window.__isle.player; P.fly = true; P.x = 85.5; P.y = 4; P.z = 131.5; });
  await g.waitForFunction(() => window.__isle.player.z < 118, null, { timeout: 8000 }).catch(() => {});
  check('and put back at the top if they end up inside', await g.evaluate(() => window.__isle.player.z < 118));
  await raw(g, 86, 4, 131, STONE); await wait(500);
  check('the server stops others decorating the den', (await get(a, 86, 4, 131)) === 0);
  check('the owner’s decorations reach others', (await get(g, 84, 4, 131)) === GOLD);

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
