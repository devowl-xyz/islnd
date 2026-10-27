// East Beach Airport: the runway, terminal, control tower, departures and arrivals board, and the members' lounge.
// Run: node h/airport.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18270, URL = 'http://localhost:' + PORT + '/?layout=classic';
const WHITE = 10, LAMP = 11, GLASS = 9, BLUE = 38, BLACK = 42, SNOW = 44, GOLD = 25, PURPLE = 39, STONE = 3, LOG = 5, PLANKS = 7;
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
  const play = async (p) => { await p.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); }); await p.waitForFunction(() => document.getElementById('overlay').classList.contains('hidden'), null, { timeout: 10000 }).catch(() => {}); };
  const get = (p, x, y, z) => p.evaluate(([x, y, z]) => window.__isle.get(x, y, z), [x, y, z]);
  const set = (p, x, y, z, b) => p.evaluate(([x, y, z, b]) => window.__isle.setBlock(x, y, z, b), [x, y, z, b]);
  const raw = (p, x, y, z, b) => p.evaluate(([x, y, z, b]) => window.__isle.net.ws.send(JSON.stringify({ t: 'edit', x, y, z, b })), [x, y, z, b]);
  const toast = (p) => p.textContent('#toast');
  const put = (p, x, y, z, yaw) => p.evaluate(([x, y, z, yaw]) => { const P = window.__isle.player; P.fly = false; P.x = x; P.y = y; P.z = z; P.yaw = yaw || 0; P.vx = P.vy = P.vz = 0; }, [x, y, z, yaw]);
  const pet = (p, id) => p.evaluate((id) => window.__isle.setSkin({ pet: id }), id);
  const inLounge = (p) => p.evaluate(() => window.__isle.air.inLounge());

  const a = await open();
  await play(a); await wait(300);
  const dock = await a.evaluate(() => { const d = window.__isle.docks[0]; return { x0: d.x0, x1: d.x1, z0: d.z0, z1: d.z1, top: d.top }; });
  check('it is right by the East Beach jet dock', dock.z1 === 86 && dock.x0 <= 141 && dock.x1 >= 141);

  // the runway
  check('an asphalt runway over the sea, south of the dock', (await get(a, 158, 11, 120)) === BLACK && (await get(a, 158, 12, 120)) === 0 && (await get(a, 158, 10, 120)) === 12);
  check('with white edge lines, edge lights and a dashed centre line', (await get(a, 156, 11, 121)) === SNOW && (await get(a, 164, 11, 120)) === LAMP && (await get(a, 160, 11, 120)) === SNOW && (await get(a, 160, 11, 123)) === BLACK);
  check('and stripes at each end', (await get(a, 157, 11, 92)) === SNOW && (await get(a, 158, 11, 92)) === BLACK && (await get(a, 157, 11, 154)) === SNOW);
  check('on stilts down to the sea bed', (await get(a, 156, 5, 122)) === LOG);
  check('a taxiway line from the terminal to the runway', (await get(a, 153, 11, 104)) === 35);
  // the terminal and tower
  check('a walkway from the jet dock to the terminal', (await get(a, 141, 11, 89)) === PLANKS);
  check('the terminal: white walls, a glass front to the runway and a blue-rimmed roof', (await get(a, 134, 14, 100)) === WHITE && (await get(a, 150, 14, 100)) === GLASS && (await get(a, 134, 18, 100)) === BLUE && (await get(a, 142, 18, 102)) === WHITE);
  check('its entrance faces the jet dock', (await get(a, 141, 12, 96)) === 0 && (await get(a, 141, 14, 96)) === 0 && (await get(a, 141, 15, 96)) !== 0);
  check('check-in desks and seats in the hall', (await get(a, 137, 12, 103)) === GOLD && (await get(a, 146, 12, 99)) === BLUE);
  check('a control tower with a glass cab and a light on top', (await get(a, 137, 20, 117)) !== 0 && (await get(a, 135, 27, 117)) === GLASS && (await get(a, 137, 27, 117)) === 0 && (await get(a, 137, 30, 117)) === LAMP);
  check('it is on the map', await a.evaluate(() => window.__isle.map.places().some((p) => /Airport/.test(p[0]))));
  check('nobody can change the airport', !(await set(a, 158, 11, 120, 0)) && /East Beach Airport can’t be changed/.test(await toast(a)) && !(await set(a, 134, 14, 100, 0)) && !(await set(a, 144, 12, 100, STONE)));

  // the board
  await put(a, 141.5, 12, 101.5, -Math.PI / 2); await wait(2500);
  const shown = await a.evaluate(() => window.__isle.air.shown());
  check('a departures and arrivals board hangs in the hall', !!shown && shown.dep.length === 4 && shown.arr.length === 4 && !!(await a.evaluate(() => window.__isle.air.board())));
  check('every flight on the tour is listed, soonest first', shown && shown.dep.map((r) => r.code).sort().join() === 'IS1,IS2,IS3,IS4' && shown.dep.every((r, k) => k === 0 || r.t >= shown.dep[k - 1].t) && shown.arr.every((r, k) => k === 0 || r.t >= shown.arr[k - 1].t));
  const at5 = await a.evaluate(() => window.__isle.air.rows(5));
  const is1 = at5.dep.find((r) => r.code === 'IS1');
  check('while the jet waits at East Beach, IS1 to North Shore is boarding', is1.place === 'North Shore' && is1.status === 'Boarding' && Math.abs(is1.t - 13) < 0.01, is1);
  const at40 = await a.evaluate(() => window.__isle.air.rows(40));
  check('once it leaves, IS1 has departed and is in flight', at40.dep.find((r) => r.code === 'IS1').status === 'Departed' && at40.arr.find((r) => r.code === 'IS1').status === 'In flight');
  const cyc = await a.evaluate(() => window.__isle.cycle());
  const st = await a.evaluate(() => window.__isle.stops());
  const atN = await a.evaluate((t) => window.__isle.air.rows(t), st[0].tArrive + 2);
  check('when it lands at North Shore, IS1 has landed and IS2 is boarding', atN.arr.find((r) => r.code === 'IS1').status === 'Landed' && atN.dep.find((r) => r.code === 'IS2').status === 'Boarding', atN);
  check('times count down to the timetable', Math.abs(at5.arr.find((r) => r.code === 'IS1').t - (st[0].tArrive - 5)) < 0.01 && cyc > 60);

  // the members' lounge
  await put(a, 141.5, 12, 104.5, Math.PI);
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => /members’ lounge is for/.test(document.getElementById('toast').textContent) || window.__isle.air.inLounge(), null, { timeout: 20000 }).catch(() => {});
  await a.keyboard.up('KeyW');
  check('without a pet you are stopped at the lounge door', !(await inLounge(a)) && /members’ lounge is for the owners of Hoot, Snowy, Biscuit, Mochi and Clover/.test(await toast(a)), [await toast(a), await a.evaluate(() => { const P = window.__isle.player; return [P.x, P.y, P.z]; })]);
  await put(a, 142.5, 12, 109.5);
  await a.waitForFunction(() => !window.__isle.air.inLounge(), null, { timeout: 5000 }).catch(() => {});
  check('and if you end up inside you are put back in the hall', !(await inLounge(a)) && (await a.evaluate(() => window.__isle.player.z)) < 107);
  check('nor can you decorate it', !(await set(a, 143, 12, 108, GOLD)) && /Only the owners of Hoot, Snowy, Biscuit, Mochi and Clover can decorate the members’ lounge/.test(await toast(a)));
  for (const id of ['goldie', 'cinder']) {
    await pet(a, id); await put(a, 142.5, 12, 109.5);
    await a.waitForFunction(() => !window.__isle.air.inLounge(), null, { timeout: 5000 }).catch(() => {});
    check(id + '’s owner can’t go in either', !(await inLounge(a)));
  }
  for (const id of ['hoot', 'snowy', 'biscuit', 'mochi', 'horse']) {
    await pet(a, id); await put(a, 142.5, 12, 109.5); await wait(700);
    check((id === 'horse' ? 'Clover' : id[0].toUpperCase() + id.slice(1)) + '’s owner can relax in the lounge', await inLounge(a));
  }
  await put(a, 141.5, 12, 104.5, Math.PI); await wait(500);
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => window.__isle.air.inLounge(), null, { timeout: 10000 }).catch(() => {});
  await a.keyboard.up('KeyW');
  check('a member walks in through the door', await inLounge(a));
  await a.waitForFunction(() => /Welcome to the members’ lounge/.test(document.getElementById('toast').textContent), null, { timeout: 5000 }).catch(() => {});
  check('and is welcomed', /Welcome to the members’ lounge/.test(await toast(a)));
  check('the lounge has a carpet, sofas, a snack bar, a coffee table and a big window', (await get(a, 142, 11, 109)) === PURPLE && (await get(a, 137, 12, 111)) === 33 && (await get(a, 135, 12, 107)) === GOLD && (await get(a, 141, 12, 109)) === SNOW && (await get(a, 150, 14, 109)) === GLASS);
  check('members can decorate the lounge', await set(a, 143, 12, 108, GOLD) && (await get(a, 143, 12, 108)) === GOLD);
  check('but not its carpet or walls', !(await set(a, 142, 11, 109, 0)) && !(await set(a, 145, 14, 106, 0)));

  // rooms: the server checks the lounge too
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  check('the guest sees the lounge decorations', (await get(g, 143, 12, 108)) === GOLD);
  await raw(g, 144, 12, 108, STONE); await wait(600);
  check('the server stops a guest without a lounge pet decorating it', (await get(a, 144, 12, 108)) === 0);
  await raw(a, 158, 11, 120, 0); await wait(600);
  check('and stops anyone, even the host, breaking the runway', (await get(g, 158, 11, 120)) === BLACK);
  await pet(g, 'mochi');
  await a.waitForFunction(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.skin.pet === 'mochi') ok = true; }); return ok; }, null, { timeout: 8000 }).catch(() => {});
  await raw(g, 144, 12, 108, STONE);
  await a.waitForFunction(() => window.__isle.get(144, 12, 108) === 3, null, { timeout: 8000 }).catch(() => {});
  check('once the guest has Mochi, their lounge decorations reach everyone', (await get(a, 144, 12, 108)) === STONE, [await get(a, 144, 12, 108), await get(g, 144, 12, 108), await g.evaluate(() => window.__isle.mySkin.pet), await a.evaluate(() => { const r = []; window.__isle.net.peers.forEach((p) => r.push(p.skin.pet)); return r; })]);

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
