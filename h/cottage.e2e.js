// Biscuit and Mochi's cottage test in real Chromium pages.
// Run: node h/cottage.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18150, URL = 'http://localhost:' + PORT + '/?layout=classic';
const LOG = 5, LEAVES = 6, PL = 7, BR = 8, WHITE = 10, STONE = 3;
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
  const adopt = (p, id) => p.evaluate((id) => { const I = window.__isle, h = I.pets.home[id], P = I.player; P.fly = false; P.x = h.x - 1; P.y = 19; P.z = h.z; return I.pets.adopt(id); }, id);
  const follower = (p) => p.evaluate(() => window.__isle.pets.follower());

  const a = await open();
  check('a hedge with log posts surrounds the yard, with an open gate', (await get(a, 115, 19, 58)) === LEAVES && (await get(a, 131, 20, 58)) === LOG && (await get(a, 111, 19, 66)) === LOG && (await get(a, 111, 19, 68)) === 0 && (await get(a, 111, 22, 68)) === PL);
  check('a two-storey white cottage in a log frame, with a brick roof and chimney', (await get(a, 121, 20, 61)) === WHITE && (await get(a, 116, 20, 61)) === LOG && (await get(a, 121, 25, 61)) === WHITE && (await get(a, 121, 23, 61)) === LOG && (await get(a, 122, 28, 68)) === BR && (await get(a, 120, 36, 61)) === BR && (await get(a, 116, 19, 68)) === 29 && (await get(a, 116, 20, 68)) === 30);
  check('downstairs is one big living room', (await get(a, 118, 20, 63)) === 0 && (await get(a, 127, 20, 73)) === 0 && (await get(a, 122, 23, 64)) === PL);
  check('stairs go straight up from the front door', (await get(a, 121, 19, 68)) === PL && (await get(a, 122, 20, 68)) === PL && (await get(a, 124, 22, 68)) === PL && (await get(a, 123, 23, 68)) === 0 && (await get(a, 125, 23, 68)) === PL);
  check('upstairs a landing runs between two bedrooms, with a door into each', (await get(a, 125, 24, 67)) === PL && (await get(a, 126, 24, 67)) === 29 && (await get(a, 126, 25, 67)) === 30 && (await get(a, 126, 24, 69)) === 29 && (await get(a, 122, 25, 64)) === 0 && (await get(a, 122, 25, 72)) === 0);
  check('a kennel and a cat tree in the yard', (await get(a, 113, 21, 60)) === BR && (await get(a, 113, 19, 61)) === 0 && (await get(a, 113, 21, 76)) === LOG && (await get(a, 113, 23, 76)) === WHITE);
  check('Biscuit and Mochi wait on cushions under the arbour outside the gate', await a.evaluate(() => { const I = window.__isle, h = I.pets.home; return [h.biscuit, h.mochi].every((o) => I.get(Math.floor(o.x), o.y - 1, Math.floor(o.z)) === 10 && o.x < 111); }));

  check('nobody can change the cottage, hedge, kennel or path', !(await set(a, 121, 20, 61, 0)) && !(await set(a, 115, 19, 58, 0)) && !(await set(a, 112, 19, 59, 0)) && !(await set(a, 110, 18, 68, 0)) && !(await set(a, 122, 20, 68, 0)) && !(await set(a, 120, 24, 68, STONE)));
  check('without one of their pets you cannot change the rooms or gardens', !(await set(a, 122, 20, 66, STONE)) && !(await set(a, 120, 19, 60, STONE)) && !(await set(a, 126, 24, 64, STONE)));

  await play(a); await wait(900);
  await a.evaluate(() => { const P = window.__isle.player; P.fly = false; P.x = 109.5; P.y = 19; P.z = 68.5; P.yaw = -Math.PI / 2; P.pitch = 0; P.vx = P.vy = P.vz = 0; });
  await a.keyboard.down('KeyW'); await wait(2500); await a.keyboard.up('KeyW');
  const x1 = await a.evaluate(() => window.__isle.player.x);
  check('a non-owner is stopped at the gate', x1 < 111.8, x1);
  await a.evaluate(() => { const P = window.__isle.player; P.fly = true; P.x = 115.5; P.y = 19; P.z = 68.5; });
  await a.waitForFunction(() => window.__isle.player.x < 110, null, { timeout: 8000 }).catch(() => {});
  check('a non-owner who ends up inside is put back outside the gate', await a.evaluate(() => window.__isle.player.x < 110));

  check('adopting Biscuit under the arbour', await adopt(a, 'biscuit'));
  await a.evaluate(() => { const P = window.__isle.player; P.fly = false; P.x = 109.5; P.y = 19; P.z = 68.5; P.yaw = -Math.PI / 2; P.pitch = 0; P.vx = P.vy = P.vz = 0; });
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => window.__isle.player.x > 115.2, null, { timeout: 90000 }).catch(() => {});
  await wait(1000);
  await a.keyboard.up('KeyW');
  const atDoor = await a.evaluate(() => window.__isle.player.x);
  check('with Biscuit you walk through the gate up to the front door, which is shut', atDoor > 115.2 && atDoor < 115.75, atDoor);
  await a.evaluate(() => { window.__isle.player.pitch = 0; window.__isle.player.yaw = -Math.PI / 2; });
  await a.keyboard.press('KeyV'); await wait(200);
  await a.keyboard.press('KeyE'); await wait(300);
  await a.keyboard.press('KeyV'); await wait(200);
  check('E opens the door', (await get(a, 116, 19, 68)) === 31 && (await get(a, 116, 20, 68)) === 32);
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => window.__isle.player.x > 117, null, { timeout: 90000 }).catch(() => {});
  await a.keyboard.up('KeyW');
  check('and you go in', await a.evaluate(() => window.__isle.player.x > 117));
  check('Biscuit’s owner decorates Biscuit’s bedroom upstairs', await set(a, 122, 24, 64, STONE) && (await get(a, 122, 24, 64)) === STONE && await set(a, 122, 24, 64, 0));
  check('but not Mochi’s bedroom', !(await set(a, 122, 24, 72, STONE)));
  check('and shares the living room and gardens', await set(a, 123, 19, 66, BR) && await set(a, 120, 19, 60, 2) && await set(a, 125, 19, 76, LEAVES));
  for (const c of [[123, 19, 66], [120, 19, 60], [125, 19, 76]]) await set(a, c[0], c[1], c[2], 0);
  // up the stairs to the landing
  await a.evaluate(() => { const P = window.__isle.player; P.fly = false; P.x = 117.6; P.y = 19; P.z = 68.5; P.yaw = -Math.PI / 2; P.pitch = 0; P.vx = P.vy = P.vz = 0; });
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => window.__isle.player.x > 125.5, null, { timeout: 120000 }).catch(() => {});
  await a.keyboard.up('KeyW');
  check('you can walk up the stairs to the landing', await a.evaluate(() => { const P = window.__isle.player; return P.x > 125.5 && Math.abs(P.y - 24) < 0.3; }));
  await a.waitForFunction(() => { const f = window.__isle.pets.follower(); return f && Math.hypot(f.x - 113.5, f.z - 62.5) < 0.8; }, null, { timeout: 30000 }).catch(() => {});
  check('while you are home Biscuit settles by the kennel', await a.evaluate(() => { const f = window.__isle.pets.follower(); return f && Math.hypot(f.x - 113.5, f.z - 62.5) < 0.8 && Math.abs(f.y - 19) < 0.6; }));

  // Rooms: the two owners share the cottage; the server checks every edit.
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  await play(g); await wait(800);
  await raw(g, 121, 19, 66, STONE); await wait(500);
  check('the server stops others changing the living room', (await get(a, 121, 19, 66)) === 0);
  check('the guest adopts Mochi', await adopt(g, 'mochi'));
  await a.waitForFunction(() => { let k = false; window.__isle.net.peers.forEach((p) => { if (p.skin.pet === 'mochi') k = true; }); return k; }, null, { timeout: 8000 }).catch(() => {});
  check('Mochi’s owner decorates Mochi’s bedroom, even as a builder', await set(g, 126, 25, 72, BR));
  await a.waitForFunction(() => window.__isle.get(126, 25, 72) === 8, null, { timeout: 8000 }).catch(() => {});
  check('the host sees it', (await get(a, 126, 25, 72)) === BR);
  check('both owners share the living room', await set(g, 121, 19, 66, WHITE));
  await a.waitForFunction(() => window.__isle.get(121, 19, 66) === 10, null, { timeout: 8000 }).catch(() => {});
  check('and the host can tidy it away', (await get(a, 121, 19, 66)) === WHITE && await set(a, 121, 19, 66, 0));
  await raw(g, 126, 25, 64, BR); await wait(500);
  check('the server stops Mochi’s owner editing Biscuit’s bedroom', (await get(a, 126, 25, 64)) === 0);
  await raw(a, 121, 20, 61, 0); await wait(500);
  check('the server stops anyone changing the frame', (await get(g, 121, 20, 61)) === WHITE);
  await raw(a, 122, 20, 68, 0); await wait(500);
  check('or the stairs', (await get(g, 122, 20, 68)) === PL);
  await g.evaluate(() => { const P = window.__isle.player; P.fly = true; P.x = 117.5; P.y = 19; P.z = 70.5; });
  await g.waitForFunction(() => { const f = window.__isle.pets.follower(); return f && Math.hypot(f.x - 113.5, f.z - 76.5) < 0.8 && Math.abs(f.y - 24) < 0.6; }, null, { timeout: 30000 }).catch(() => {});
  check('while its owner is home Mochi sits on top of the cat tree', await g.evaluate(() => { const f = window.__isle.pets.follower(); return f && Math.hypot(f.x - 113.5, f.z - 76.5) < 0.8 && Math.abs(f.y - 24) < 0.6; }));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
