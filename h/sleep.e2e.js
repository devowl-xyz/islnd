// Beds, doors, the block picker, sleeping and the campsite, in real Chromium pages.
// Run: node h/sleep.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18190, URL = 'http://localhost:' + PORT + '/';
const STONE = 3, BED = 27, BED_HEAD = 28, DOOR = 29, DOOR_TOP = 30, DOOR_OPEN = 31, DOOR_TOP_OPEN = 32, ORANGE = 34, BLUE = 38, GREEN = 36, LAMP = 11;
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const open = async (name, ctx) => {
    const page = await (ctx || await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
    page.on('pageerror', (e) => { console.log((name || 'page') + ' pageerror', e.message); fails++; });
    await page.goto(URL);
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
    if (name) await page.fill('#nName', name);
    return page;
  };
  const play = async (p) => { await p.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); }); await p.waitForFunction(() => document.getElementById('overlay').classList.contains('hidden'), null, { timeout: 10000 }).catch(() => {}); };
  const get = (p, x, y, z) => p.evaluate(([x, y, z]) => window.__isle.get(x, y, z), [x, y, z]);
  const set = (p, x, y, z, b) => p.evaluate(([x, y, z, b]) => window.__isle.setBlock(x, y, z, b), [x, y, z, b]);
  const raw = (p, x, y, z, b) => p.evaluate(([x, y, z, b]) => window.__isle.net.ws.send(JSON.stringify({ t: 'edit', x, y, z, b })), [x, y, z, b]);
  const place = (p, x, y, z) => p.evaluate(([x, y, z]) => window.__isle.act.place(x, y, z), [x, y, z]);
  const use = (p, x, y, z) => p.evaluate(([x, y, z]) => window.__isle.act.use(x, y, z), [x, y, z]);
  const pose = (p, x, y, z, yaw) => p.evaluate(([x, y, z, yaw]) => { const P = window.__isle.player; P.fly = false; P.x = x; P.y = y; P.z = z; P.yaw = yaw; P.pitch = 0; P.vx = P.vy = P.vz = 0; }, [x, y, z, yaw]);
  const P = (p) => p.evaluate(() => { const P = window.__isle.player; return { x: P.x, y: P.y, z: P.z }; });

  const ctx = await browser.newContext({ viewport: { width: 900, height: 600 } });
  const a = await open(null, ctx);

  // The campsite, just south of Clover's paddock.
  const C = await a.evaluate(() => window.__isle.camp);
  check('the campsite is where it was asked for, by the paddock', C.x0 <= 194 && C.x1 >= 194 && C.z0 <= 202 && C.z0 >= 200 && C.G === 17, C);
  check('three tents in orange, blue and green', (await get(a, 189, 17, 207)) === ORANGE && (await get(a, 187, 19, 209)) === ORANGE && (await get(a, 199, 17, 207)) === BLUE && (await get(a, 192, 17, 214)) === GREEN);
  const campBeds = await a.evaluate(() => window.__isle.campBeds.map((b) => [window.__isle.get(b[0], b[1], b[2]), b]));
  check('with a sleeping bag in each', campBeds.length === 3 && campBeds.every((c) => c[0] === BED_HEAD), campBeds);
  check('round a campfire with a stone ring and a glowing pit', (await get(a, 193, 17, 208)) === STONE && (await get(a, 194, 17, 209)) === 0 && (await get(a, 194, 16, 209)) === LAMP);
  check('nobody can change the campsite', !(await set(a, 194, 17, 209, STONE)) && !(await set(a, 189, 17, 207, 0)));
  // The message names the place you're actually at.
  const said = async (x, y, z) => { await set(a, x, y, z, 0); return a.textContent('#toast'); };
  const msgs = await (async () => {
    const C = await a.evaluate(() => { const C = window.__isle.cot.COT, T = window.__isle.th.TH; return { ox: C.x0 - 106, oz: C.z0 - 57, tx: T.cx, ty: T.PY + 9, tz: T.cz }; });
    return {
      camp: await said(189, 17, 207), paddock: await said(192, 18, 184), cottage: await said(121 + C.ox, 20, 61 + C.oz),
      tree: await said(C.tx, C.ty, C.tz), den: await said(85, 10, 120), goldie: await said(50, 4, 226)
    };
  })();
  check('trying to change a fixed building names that building', /campsite/.test(msgs.camp) && /paddock/.test(msgs.paddock) && /cottage/.test(msgs.cottage) && /treehouse/.test(msgs.tree) && /den/.test(msgs.den) && /Goldie/.test(msgs.goldie), msgs);

  // A bed for every pet's owner, and doors in the cottage.
  const homes = await a.evaluate(() => {
    const I = window.__isle, T = I.th.TH, C = I.cot.COT, ox = C.x0 - 106, oz = C.z0 - 57, g = I.get;
    return {
      biscuit: g(128 + ox, 24, 63 + oz), mochi: g(128 + ox, 24, 73 + oz),
      hoot: g(T.cx - 6, T.PY + 1, T.cz - 5), snowy: g(T.cx + 6, T.PY + 1, T.cz - 5),
      goldie: g(46, 5, 224), cinder: g(82, 3, 134), clover: g(197, 17, 186),
      front: [g(116 + ox, 19, 68 + oz), g(116 + ox, 20, 68 + oz)], rooms: [g(126 + ox, 24, 67 + oz), g(126 + ox, 25, 69 + oz)]
    };
  });
  check('a bed in each pet’s home for its owner', ['biscuit', 'mochi', 'hoot', 'snowy', 'goldie', 'cinder', 'clover'].every((k) => homes[k] === BED_HEAD), homes);
  check('the cottage has a front door and a door into each bedroom', homes.front[0] === DOOR && homes.front[1] === DOOR_TOP && homes.rooms[0] === DOOR && homes.rooms[1] === DOOR_TOP, homes);

  // The block picker.
  await play(a); await wait(600);
  await a.keyboard.press('KeyB'); await wait(300);
  const pk = await a.evaluate(() => ({ open: window.__isle.picker.isOpen(), n: document.querySelectorAll('#picker button').length, names: [...document.querySelectorAll('#picker button')].map((b) => b.title) }));
  check('B opens the block picker', pk.open && pk.n >= 35, pk.n);
  check('with beds, doors and coloured blocks', ['Bed', 'Door', 'Red', 'Yellow', 'Blue', 'Pink', 'Black'].every((n) => pk.names.includes(n)), pk.names);
  await a.click('#picker button[title="Door"]'); await wait(300);
  check('choosing one puts it in your hotbar and closes the picker', !(await a.evaluate(() => window.__isle.picker.isOpen())) && (await a.evaluate(() => window.__isle.hotbar[window.__isle.sel()])) === DOOR);
  await play(a); await wait(300);

  // Doors.
  await pose(a, 80.5, 13, 98.5, 0);
  for (const x of [78, 80]) for (const y of [13, 14]) await set(a, x, y, 94, STONE);
  await place(a, 79, 13, 94);
  check('a door is two blocks tall', (await get(a, 79, 13, 94)) === DOOR && (await get(a, 79, 14, 94)) === DOOR_TOP);
  await pose(a, 79.5, 13, 97.5, 0);
  await a.keyboard.down('KeyW'); await wait(2500); await a.keyboard.up('KeyW');
  check('a shut door stops you', (await P(a)).z > 94.9, await P(a));
  await use(a, 79, 14, 94);
  check('right click opens it, both halves', (await get(a, 79, 13, 94)) === DOOR_OPEN && (await get(a, 79, 14, 94)) === DOOR_TOP_OPEN);
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => window.__isle.player.z < 93, null, { timeout: 30000 }).catch(() => {});
  await a.keyboard.up('KeyW');
  check('and you can walk through', (await P(a)).z < 93, await P(a));
  await pose(a, 79.5, 13, 92.5, 0);
  await a.evaluate(() => window.__isle.ride.toggle ? 0 : 0);
  await use(a, 79, 13, 94);
  check('it shuts again', (await get(a, 79, 13, 94)) === DOOR && (await get(a, 79, 14, 94)) === DOOR_TOP);
  await a.evaluate(() => window.__isle.act.brk(79, 14, 94));
  check('breaking one half takes the whole door', (await get(a, 79, 13, 94)) === 0 && (await get(a, 79, 14, 94)) === 0);

  // Beds and sleeping.
  await a.evaluate(() => window.__isle.setSlot(window.__isle.sel(), 27));
  await pose(a, 84.5, 13, 98.5, 0);
  await place(a, 84, 13, 96);
  check('a bed is two blocks long, its head the way you face', (await get(a, 84, 13, 96)) === BED && (await get(a, 84, 13, 95)) === BED_HEAD);
  await pose(a, 84.5, 14.2, 96.5, 0);
  await a.waitForFunction(() => window.__isle.player.onGround && Math.abs(window.__isle.player.y - 13.5625) < 0.05, null, { timeout: 15000 }).catch(() => {});
  check('beds are half height: you stand on top of one', Math.abs((await P(a)).y - 13.5625) < 0.05, await P(a));
  await pose(a, 85.5, 13, 96.5, 0);
  await use(a, 84, 13, 96);
  check('right click a bed to lie down and sleep', await a.evaluate(() => window.__isle.sleep.on() && document.getElementById('sleep').classList.contains('on')));
  check('you lie on the bed', await a.evaluate(() => { const P = window.__isle.player; return Math.abs(P.x - 84.5) < 0.01 && Math.abs(P.z - 96) < 0.01 && Math.abs(P.y - 13.5625) < 0.01; }));
  await a.waitForFunction(() => window.__isle.sleep.state() && window.__isle.sleep.state().morning && /get up/.test(document.getElementById('jethint').textContent), null, { timeout: 15000 }).catch(() => {});
  check('then morning comes', await a.evaluate(() => !document.getElementById('sleep').classList.contains('on') && /get up/.test(document.getElementById('jethint').textContent)), await a.evaluate(() => ({ st: window.__isle.sleep.state(), cls: document.getElementById('sleep').className, hint: document.getElementById('jethint').textContent })));
  check('and that bed is where you wake up now', JSON.stringify(await a.evaluate(() => window.__isle.sleep.bed())) === JSON.stringify({ x: 84, y: 13, z: 95 }));
  await a.keyboard.down('KeyW'); await wait(400); await a.keyboard.up('KeyW');
  const up = await P(a);
  check('move to get up beside the bed', !(await a.evaluate(() => window.__isle.sleep.on())) && Math.abs(up.y - 13) < 0.6 && Math.abs(up.x - 84.5) > 0.6, up);
  await pose(a, 60.5, 13, 80.5, 0);
  await a.keyboard.press('KeyR'); await wait(300);
  const rs = await P(a);
  check('respawning puts you back at your bed', Math.hypot(rs.x - 84.5, rs.z - 95.5) < 2.5, rs);
  await a.evaluate(() => window.__isle.act.brk(84, 13, 95));
  check('breaking a bed takes both halves', (await get(a, 84, 13, 96)) === 0 && (await get(a, 84, 13, 95)) === 0);
  await a.keyboard.press('KeyR'); await wait(300);
  const rs2 = await P(a);
  check('with your bed gone you wake on the meadow again', Math.hypot(rs2.x - 80.5, rs2.z - 92.5) < 1, rs2);

  // Sleeping at the campsite, and the cottage door after a reload.
  await pose(a, 191.5, 17, 209.5, Math.PI / 2);
  check('anyone can sleep in a tent at the campsite', await a.evaluate(() => window.__isle.sleep.in(188, 17, 209)));
  await a.evaluate(() => window.__isle.sleep.wake());
  const fd = await a.evaluate(() => { const C = window.__isle.cot.COT; return [116 + C.x0 - 106, 19, 68 + C.z0 - 57]; });
  check('anyone can open a door in a house that can’t be changed', await a.evaluate((d) => window.__isle.door.toggle(d[0], d[1], d[2]), fd) && (await get(a, fd[0], fd[1], fd[2])) === DOOR_OPEN);
  await wait(3000); // builds save 1.5 s after the last change
  const a2 = await open(null, ctx);
  check('and it stays open after a reload', (await get(a2, fd[0], fd[1], fd[2])) === DOOR_OPEN && (await get(a2, fd[0], 20, fd[2])) === DOOR_TOP_OPEN);
  await a2.close();
  await a.evaluate((d) => window.__isle.door.toggle(d[0], d[1], d[2]), fd);

  // Rooms.
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  await play(g); await play(a); await wait(600);
  await raw(g, fd[0], fd[1], fd[2], DOOR_OPEN); await raw(g, fd[0], 20, fd[2], DOOR_TOP_OPEN);
  await a.waitForFunction((d) => window.__isle.get(d[0], d[1], d[2]) === 31, fd, { timeout: 8000 }).catch(() => {});
  check('a builder can open a door off the meadow, and the host sees it', (await get(a, fd[0], fd[1], fd[2])) === DOOR_OPEN);
  await raw(g, fd[0], fd[1], fd[2], STONE); await wait(500);
  check('but the server won’t let them swap the door for a block', (await get(a, fd[0], fd[1], fd[2])) === DOOR_OPEN);
  check('and tells them it’s the cottage that can’t be changed', /cottage/.test(await g.textContent('#toast')), await g.textContent('#toast'));
  await raw(g, fd[0], fd[1], fd[2], DOOR_TOP); await wait(500);
  check('or turn a door bottom into a door top', (await get(a, fd[0], fd[1], fd[2])) === DOOR_OPEN);
  await pose(g, 191.5, 17, 209.5, Math.PI / 2);
  await g.evaluate(() => window.__isle.sleep.in(188, 17, 209));
  await pose(a, 192.5, 17, 206.5, Math.PI);
  await a.waitForFunction(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.tgt && p.tgt.sl && p.av && Math.abs(p.av.g.rotation.x - Math.PI / 2) < 0.01) ok = true; }); return ok; }, null, { timeout: 10000 }).catch(() => {});
  check('the host sees the guest asleep in the tent', await a.evaluate(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.tgt && p.tgt.sl && p.av && Math.abs(p.av.g.rotation.x - Math.PI / 2) < 0.01) ok = true; }); return ok; }));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
