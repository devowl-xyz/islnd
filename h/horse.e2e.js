// Clover the horse: its paddock, adopting it, riding it, and riding in a room. Real Chromium pages.
// Run: node h/horse.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18180, URL = 'http://localhost:' + PORT + '/';
const LOG = 5, PL = 7, BR = 8, WATER = 12, SANDSTONE = 23, STONE = 3;
const SHOTS = process.env.SHOTS;
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
  const place = (p, x, y, z, yaw) => p.evaluate(([x, y, z, yaw]) => { const P = window.__isle.player; P.fly = false; P.x = x; P.y = y; P.z = z; P.yaw = yaw; P.pitch = 0; P.vx = P.vy = P.vz = 0; }, [x, y, z, yaw]);
  const riding = (p) => p.evaluate(() => window.__isle.ride.on());
  const hint = (p) => p.evaluate(() => document.getElementById('jethint').textContent);
  // put Clover right beside you and wait until it is close enough to get on
  const fetchHorse = async (p) => {
    await p.waitForFunction(() => window.__isle.ride.can(), null, { timeout: 30000 }).catch(() => {});
    return p.evaluate(() => window.__isle.ride.can());
  };
  const speedAfter = async (p, keys, ms) => {
    for (const k of keys) await p.keyboard.down(k);
    await wait(ms);
    const v = await p.evaluate(() => Math.hypot(window.__isle.player.vx, window.__isle.player.vz));
    for (const k of keys) await p.keyboard.up(k);
    await wait(300);
    return v;
  };

  const a = await open();
  // The paddock.
  check('a post-and-rail fence round the paddock', (await get(a, 190, 17, 184)) === LOG && (await get(a, 190, 18, 184)) === LOG && (await get(a, 192, 18, 184)) === PL && (await get(a, 192, 17, 184)) === 0);
  check('a gate arch opens onto the road', (await get(a, 210, 17, 191)) === 0 && (await get(a, 210, 18, 191)) === 0 && (await get(a, 210, 21, 191)) === PL && (await get(a, 210, 19, 189)) === LOG);
  check('a stable with a brick roof, hay and a lamp', (await get(a, 195, 20, 186)) === BR && (await get(a, 192, 17, 186)) === SANDSTONE && (await get(a, 195, 19, 185)) === 11 && (await get(a, 195, 17, 189)) === 0);
  check('a water trough', (await get(a, 201, 17, 197)) === WATER && (await get(a, 199, 17, 197)) === PL);
  const path = await a.evaluate(() => { const I = window.__isle, top = (x, z) => { for (let y = 47; y > 0; y--) { const b = I.get(x, y, z); if (b !== 0 && b !== 5 && b !== 6) return b; } return 0; }; return [top(211, 191), top(212, 192), top(213, 191)]; });
  check('a sandstone path joins the gate to the road', path.every((b) => b === SANDSTONE), path);
  check('nobody can change the paddock', !(await set(a, 195, 20, 186, 0)) && !(await set(a, 192, 18, 184, 0)) && !(await set(a, 200, 17, 192, STONE)));
  check('Clover grazes in the paddock', await a.evaluate(() => { const I = window.__isle, h = I.pets.home.horse, Pd = I.paddock; return I.pets.homeVisible('horse') && h.x > Pd.x0 && h.x < Pd.x1 && h.z > Pd.z0 && h.z < Pd.z1; }));
  check('the pause card says where Clover lives', (await a.textContent('#petList')).includes('Clover') && (await a.textContent('#petList')).includes('paddock'));

  // Adopt and ride.
  await play(a); await wait(600);
  await place(a, 200.5, 17, 192.5, 0); await wait(400);
  check('E near Clover offers to adopt it', (await a.evaluate(() => window.__isle.pets.near())) === 'horse' && (await hint(a)).includes('Clover'));
  await a.keyboard.press('KeyE'); await wait(300);
  check('Clover becomes your pet', await a.evaluate(() => window.__isle.mySkin.pet === 'horse'));
  check('you cannot ride from far away', !(await a.evaluate(() => { const P = window.__isle.player; P.x += 12; return window.__isle.ride.can(); })));
  await place(a, 80.5, 13, 88.5, 0);
  check('Clover follows you to the meadow and can be ridden', await fetchHorse(a));
  check('the hint says how to ride', (await hint(a)).includes('ride Clover'));
  const walk = await speedAfter(a, ['KeyW'], 1200);
  await fetchHorse(a);
  await a.keyboard.press('KeyE'); await wait(300);
  check('E gets you on Clover', await riding(a) && (await hint(a)).includes('get off'));
  check('you sit up in the saddle', await a.evaluate(() => Math.abs(window.__isle.pets.follower().x - window.__isle.player.x) < 0.01));
  await place(a, 80.5, 13, 100.5, 0); await a.evaluate(() => { window.__isle.player.ride = true; });
  const trot = await speedAfter(a, ['KeyW'], 1200);
  await place(a, 80.5, 13, 100.5, 0); await a.evaluate(() => { window.__isle.player.ride = true; });
  const gallop = await speedAfter(a, ['ShiftLeft', 'KeyW'], 1200);
  check('Clover is faster than walking, and gallops with Shift', trot > walk * 1.6 && gallop > trot * 1.3, { walk, trot, gallop });
  check('Clover moves along under you', await a.evaluate(() => { const f = window.__isle.pets.follower(), P = window.__isle.player; return Math.hypot(f.x - P.x, f.z - P.z) < 0.3; }));

  // A two-block wall on the meadow: too high on foot, easy on horseback.
  for (let x = 74; x <= 86; x++) for (const y of [13, 14]) await set(a, x, y, 84, STONE);
  await place(a, 80.5, 13, 90.5, 0); await a.evaluate(() => { window.__isle.player.ride = true; });
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => window.__isle.player.z < 82, null, { timeout: 20000 }).catch(() => {});
  await a.keyboard.up('KeyW');
  check('on horseback you jump a two-block wall', await a.evaluate(() => window.__isle.player.z < 82));
  await a.keyboard.press('KeyE'); await wait(300);
  check('E gets you off again', !(await riding(a)));
  await place(a, 80.5, 13, 87.5, 0);
  await a.keyboard.down('KeyW'); await wait(2500); await a.keyboard.up('KeyW');
  check('on foot the same wall stops you', await a.evaluate(() => window.__isle.player.z > 84.5));
  for (let x = 74; x <= 86; x++) for (const y of [13, 14]) await set(a, x, y, 84, 0);
  check('Clover comes back for you', await fetchHorse(a));
  await a.keyboard.press('KeyE'); await wait(300);
  await a.evaluate(() => { window.__isle.player.fly = true; }); await wait(400);
  check('flying gets you off', !(await riding(a)));
  await a.evaluate(() => { window.__isle.player.fly = false; });

  // Rooms: others see you riding, and Clover stays yours.
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  await play(g); await play(a); await wait(600);
  await place(a, 80.5, 13, 96.5, 0);
  await fetchHorse(a);
  await a.keyboard.press('KeyE'); await wait(300);
  check('the host rides Clover in the room', await riding(a));
  await place(g, 87.5, 13, 96.5, Math.PI / 2);
  await g.waitForFunction(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.tgt && p.tgt.rd && p.av && p.cur && p.av.g.position.y - p.cur.y > 0.7) ok = true; }); return ok; }, null, { timeout: 10000 }).catch(() => {});
  check('the guest sees the host up in the saddle', await g.evaluate(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.tgt && p.tgt.rd && p.av && p.cur && p.av.g.position.y - p.cur.y > 0.7) ok = true; }); return ok; }));
  check('with Clover under them', await g.evaluate(() => { const I = window.__isle; let hx = null; I.net.peers.forEach((p) => { if (p.cur) hx = p.cur; }); const fs = I.pets.followers().filter((f) => f[1] === 'horse'); return !!hx && fs.length === 1; }));
  if (SHOTS) { await wait(800); await g.screenshot({ path: SHOTS + '/h-peer.png' }); }
  check('the guest cannot adopt Clover', !(await g.evaluate(() => window.__isle.pets.adopt('horse'))));
  await raw(a, 200, 18, 192, STONE); await wait(500);
  check('the server stops even the host changing the paddock', (await get(g, 200, 18, 192)) === 0);
  await a.keyboard.press('KeyE');
  await g.waitForFunction(() => { let r = true; window.__isle.net.peers.forEach((p) => { if (p.tgt) r = p.tgt.rd; }); return !r; }, null, { timeout: 10000 }).catch(() => {});
  check('and sees them get off', await g.evaluate(() => { let r = true; window.__isle.net.peers.forEach((p) => { if (p.tgt) r = p.tgt.rd; }); return !r; }));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
