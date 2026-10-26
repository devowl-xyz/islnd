// Owls' treehouse test in real Chromium pages: frame, rooms, who may go in, room permissions.
// Run: node h/treehouse.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18130, URL = 'http://localhost:' + PORT + '/?layout=classic';
const PL = 7, BR = 8, STONE = 3;
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
  const adopt = (p, id) => p.evaluate((id) => { const I = window.__isle, h = I.pets.home[id], P = I.player; P.fly = true; P.x = h.x + 0.8; P.y = h.y - 0.6; P.z = h.z; return I.pets.adopt(id); }, id);
  const raw = (p, x, y, z, b) => p.evaluate(([x, y, z, b]) => window.__isle.net.ws.send(JSON.stringify({ t: 'edit', x, y, z, b })), [x, y, z, b]);

  const a = await open();
  // The frame.
  check('a big deck is built round the trunk', (await get(a, 36, 23, 86)) === PL && (await get(a, 52, 23, 86)) === PL && (await get(a, 44, 20, 86)) === 5);
  check('the house has two floors and a roof with the owls on top', (await get(a, 40, 28, 86)) === PL && (await get(a, 44, 32, 86)) === BR && await a.evaluate(() => { const I = window.__isle, h = I.pets.home; return [h.hoot, h.snowy].every((o) => I.get(Math.floor(o.x), o.y - 1, Math.floor(o.z)) === 8 && I.get(Math.floor(o.x), o.y, Math.floor(o.z)) === 0); }));
  check('the owls perch side by side', await a.evaluate(() => { const h = window.__isle.pets.home; return Math.abs(h.hoot.x - h.snowy.x) === 2 && h.hoot.y === h.snowy.y; }));
  const stair = []; for (let k = 0; k <= 8; k++) stair.push(await get(a, 44, 23 - k, 96 + k));
  check('a staircase runs up to the deck', stair.every((b) => b === PL), stair);
  const head = await a.evaluate(() => { const I = window.__isle; for (let k = 0; k <= 8; k++) for (let y = 24 - k; y <= 27 - k; y++) if (I.get(44, y, 96 + k) !== 0) return [k, y]; return null; });
  check('the stairs have headroom all the way up', head === null, head);
  const inner = await a.evaluate(() => { const I = window.__isle; const steps = [0, 1, 2, 3].map((k) => I.get(42 + k, 24 + k, 81)); const hole = [42, 43, 44, 45].every((x) => I.get(x, 28, 81) === 0); return { steps, hole, landing: I.get(46, 28, 81) }; });
  check('an inside staircase climbs to the loft', inner.steps.every((b) => b === PL) && inner.hole && inner.landing === PL, inner);

  // Nobody can change the frame; the rooms are only for owl owners.
  check('the trunk, deck, walls and stairs cannot be changed', !(await set(a, 44, 18, 86, 0)) && !(await set(a, 36, 23, 86, 0)) && !(await set(a, 37, 25, 85, 0)) && !(await set(a, 44, 20, 99, 0)) && !(await set(a, 33, 20, 90, STONE)) && !(await set(a, 43, 25, 81, 0)));
  check('without an owl you cannot decorate anything inside', !(await set(a, 39, 24, 85, STONE)) && !(await set(a, 44, 24, 85, STONE)) && !(await set(a, 44, 30, 88, STONE)) && !(await set(a, 35, 24, 77, STONE)));

  // Without an owl you cannot go in.
  await play(a); await wait(900);
  await a.evaluate(() => { const P = window.__isle.player; P.fly = false; P.x = 44.5; P.y = 24; P.z = 96.6; P.yaw = 0; P.pitch = 0; P.vx = P.vy = P.vz = 0; });
  await a.keyboard.down('KeyW'); await wait(2500); await a.keyboard.up('KeyW');
  const z1 = await a.evaluate(() => window.__isle.player.z);
  check('a non-owner is stopped at the gate', z1 > 96.2, z1);
  await a.evaluate(() => { const P = window.__isle.player; P.fly = true; P.x = 44.5; P.y = 29; P.z = 88.5; });
  await a.waitForFunction(() => window.__isle.player.z > 103, null, { timeout: 8000 }).catch(() => {});
  check('a non-owner who ends up inside is put back at the foot of the stairs', await a.evaluate(() => { const P = window.__isle.player; return P.z > 103 && Math.abs(P.y - 15) < 1; }));

  // With an owl you can climb the stairs and go in.
  check('adopting Hoot from the roof', await adopt(a, 'hoot'));
  // start a few steps up (step k=4 is at z=100, top y=20) and climb the rest
  await a.evaluate(() => { const P = window.__isle.player; P.fly = false; P.x = 44.5; P.y = 20.05; P.z = 100.5; P.yaw = 0; P.pitch = 0; P.vx = P.vy = P.vz = 0; });
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => { const P = window.__isle.player; return P.z < 94 && P.y >= 23.9; }, null, { timeout: 120000 }).catch(() => {});
  await a.keyboard.up('KeyW');
  const in1 = await a.evaluate(() => { const P = window.__isle.player; return { y: P.y, z: P.z }; });
  check('an owl owner climbs the stairs onto the deck', in1.z < 94 && in1.y >= 23.9, in1);
  await a.evaluate(() => { const P = window.__isle.player; P.fly = false; P.x = 42.5; P.y = 24; P.z = 83.6; P.yaw = 0; P.pitch = 0; P.vx = P.vy = P.vz = 0; });
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => window.__isle.player.z < 82.6 && window.__isle.player.y >= 24.9, null, { timeout: 30000 }).catch(() => {});
  await a.keyboard.up('KeyW');
  await a.evaluate(() => { window.__isle.player.yaw = -Math.PI / 2; });
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => window.__isle.player.y >= 28.9, null, { timeout: 60000 }).catch(() => {});
  await a.keyboard.up('KeyW');
  check('the inside staircase takes you up to the loft', await a.evaluate(() => window.__isle.player.y >= 28.9));
  // The Owl Emporium at the front of the loft.
  check('a fixed log wall with an open archway leads into the Owl Emporium', (await get(a, 40, 30, 86)) !== 0 && (await get(a, 44, 29, 86)) === 0 && (await get(a, 44, 30, 86)) === 0 && !(await set(a, 44, 29, 86, STONE)) && !(await set(a, 40, 30, 86, 0)));
  check('each owl has a perch and a nest there', (await get(a, 40, 30, 89)) === 5 && (await get(a, 48, 30, 89)) === 5 && (await get(a, 39, 29, 90)) === 6 && (await get(a, 49, 29, 90)) === 6);
  check('owl owners can rearrange the emporium', await set(a, 40, 30, 89, 0) && await set(a, 40, 30, 89, 7) && (await get(a, 40, 30, 89)) === 7 && await set(a, 40, 30, 89, 5));
  await a.waitForFunction(() => { const f = window.__isle.pets.follower(); return f && Math.hypot(f.x - 40.5, f.z - 89.5) < 0.8 && Math.abs(f.y - 31) < 0.6; }, null, { timeout: 30000 }).catch(() => {});
  check('while you are inside, Hoot flies to its perch in the emporium', await a.evaluate(() => { const f = window.__isle.pets.follower(); return f && Math.hypot(f.x - 40.5, f.z - 89.5) < 0.8 && Math.abs(f.y - 31) < 0.6; }));
  check('Hoot’s owner decorates Hoot’s bedroom', await set(a, 39, 24, 85, STONE) && (await get(a, 39, 24, 85)) === STONE && await set(a, 39, 24, 85, 0));
  check('but not Snowy’s bedroom', !(await set(a, 49, 24, 85, STONE)));
  check('and the shared common room, hall, loft, porch and planters', await set(a, 44, 24, 85, BR) && await set(a, 40, 25, 89, BR) && await set(a, 44, 30, 88, BR) && await set(a, 38, 24, 93, 6) && await set(a, 35, 24, 77, 6));
  for (const c of [[44, 24, 85], [40, 25, 89], [38, 24, 93], [35, 24, 77]]) await set(a, c[0], c[1], c[2], 0);
  check('the frame stays fixed for owners too', !(await set(a, 44, 24, 92, STONE)) && !(await set(a, 37, 25, 85, 0)) && !(await set(a, 42, 24, 81, 0)));

  // Rooms: two owl owners share the treehouse; the server checks every edit.
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  await play(g); await wait(800);
  check('the joiner sees the host’s loft decoration', (await get(g, 44, 30, 88)) === BR);
  await raw(g, 36, 24, 95, STONE); await wait(400);
  check('the server stops non-owners using the planters', (await get(a, 36, 24, 95)) === 0);
  check('the guest adopts Snowy', await adopt(g, 'snowy'));
  await a.waitForFunction(() => { let k = false; window.__isle.net.peers.forEach((p) => { if (p.skin.pet === 'snowy') k = true; }); return k; }, null, { timeout: 8000 }).catch(() => {});
  check('Snowy’s owner decorates Snowy’s bedroom, even as a builder off the meadow', await set(g, 49, 25, 85, BR));
  await a.waitForFunction(() => window.__isle.get(49, 25, 85) === 8, null, { timeout: 8000 }).catch(() => {});
  check('the host sees the guest’s decoration', (await get(a, 49, 25, 85)) === BR);
  check('both owners share the loft: the guest can tidy away what the host put there', await set(g, 44, 30, 88, 0));
  await a.waitForFunction(() => window.__isle.get(44, 30, 88) === 0, null, { timeout: 8000 }).catch(() => {});
  check('and the host sees it gone', (await get(a, 44, 30, 88)) === 0);
  await raw(g, 39, 25, 85, BR); await wait(500);
  check('the server stops Snowy’s owner editing Hoot’s bedroom', (await get(a, 39, 25, 85)) === 0);
  await raw(a, 44, 20, 86, 0); await wait(500);
  check('the server stops anyone, even the host, changing the frame', (await get(g, 44, 20, 86)) === 5);
  check('both owners can be in the treehouse at once', await g.evaluate(() => { const P = window.__isle.player; P.fly = true; P.x = 48.5; P.y = 29; P.z = 89.5; return true; }) && (await wait(800), await g.evaluate(() => window.__isle.player.z < 92)));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
