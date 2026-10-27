// Air traffic control: the host and admins (or you, on your own) route the jet through waypoints picked on the map.
// Run: node h/atc.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18280, URL = 'http://localhost:' + PORT + '/?layout=classic';
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const open = async (name) => {
    const page = await (await browser.newContext({ viewport: { width: 1000, height: 760 } })).newPage();
    page.on('pageerror', (e) => { console.log((name || 'page') + ' pageerror', e.message); fails++; });
    await page.goto(URL);
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
    if (name) await page.fill('#nName', name);
    return page;
  };
  const toast = (p) => p.textContent('#toast');
  const btn = (p, text) => p.evaluate((t) => { const b = [...document.querySelectorAll('#atcBtns button')].find((e) => e.textContent === t); if (b) b.click(); return !!b; }, text);
  // click a spot on the map, by world x and z, with the real mouse
  const mapClick = async (p, x, z) => { const r = await p.evaluate(() => { const b = document.getElementById('mapCanvas').getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; }); await p.mouse.click(r.l + (x + 0.5) / 352 * r.w, r.t + (z + 0.5) / 352 * r.h); };
  const ROUTE = [[120, 200], [200, 250], [260, 200]];

  const a = await open();
  check('on your own, the pause card has air traffic control', await a.evaluate(() => [...document.querySelectorAll('#playCtl button')].some((b) => /Air traffic control/.test(b.textContent))));
  await a.evaluate(() => [...document.querySelectorAll('#playCtl button')].find((b) => /Air traffic control/.test(b.textContent)).click());
  check('it opens the map with the tower’s controls', await a.evaluate(() => !document.getElementById('map').hidden && !document.getElementById('atc').hidden && window.__isle.atc.on()));
  check('one Land at button for each dock', (await a.evaluate(() => [...document.querySelectorAll('#atcBtns button')].filter((b) => /^Land at /.test(b.textContent)).length)) === 4);
  for (const w of ROUTE) await mapClick(a, w[0], w[1]);
  const picked = await a.evaluate(() => window.__isle.atc.route());
  check('clicking the map adds waypoints', picked.length === 3 && picked.every((w, k) => Math.abs(w[0] - ROUTE[k][0]) <= 1 && Math.abs(w[1] - ROUTE[k][1]) <= 1), picked);
  check('the panel counts them', /3 waypoints picked/.test(await a.textContent('#atcMsg')));
  await btn(a, 'Undo');
  check('Undo takes the last one off', (await a.evaluate(() => window.__isle.atc.route().length)) === 2);
  await mapClick(a, ROUTE[2][0], ROUTE[2][1]);
  await btn(a, 'Land at South Shore');
  const via = await a.evaluate(() => window.__isle.atc.via());
  check('Land at sends the jet on the route', via && via.length === 3 && /Tower: you cleared the jet through 3 waypoints to land at South Shore/.test(await toast(a)), { via, t: await toast(a) });
  const plan = await a.evaluate(() => window.__isle.atc.plan());
  check('its flight plan goes through each waypoint, high over the land, then to South Shore', plan.dock === 2 && ROUTE.every((w) => plan.k.some((p) => Math.abs(p[0] - w[0]) <= 1 && Math.abs(p[2] - w[1]) <= 1 && p[1] === 46)), plan);
  // fly the route forward in time with the pose the game itself uses
  const passes = await a.evaluate(() => {
    const I = window.__isle, C = I.atc.plan(), via = I.atc.via(), near = via.map(() => 99);
    let clear = 99;
    const start = I.jet.call.t0;
    for (let t = start; t <= C.tLand; t += 0.25) {
      const q = I.atc.pose(t);
      via.forEach((w, n) => { near[n] = Math.min(near[n], Math.hypot(q.x - w[0], q.z - w[1])); });
      const x = Math.floor(q.x), z = Math.floor(q.z);
      // away from the docks, and not taxiing on the airport's runway
      const far = Math.min(...I.docks.map((d) => Math.hypot(q.x - d.cx, q.z - d.cz))) > 12 && !(q.x > 148 && q.x < 168 && q.z > 80 && q.z < 158);
      if (far && x >= 0 && z >= 0 && x < 352 && z < 352) { let g = 0; for (let y = 47; y > 0; y--) if (I.get(x, y, z)) { g = y + 1; break; } clear = Math.min(clear, q.y - g); }
    }
    const end = I.atc.pose(C.tLand), d = I.dockPark(I.docks[2]);
    return { near, clear, landed: Math.hypot(end.x - d[0], end.y - d[1], end.z - d[2]) };
  });
  check('the jet flies through every waypoint', passes.near.every((v) => v < 1.5), passes);
  check('well clear of the ground', passes.clear >= 6, passes);
  check('and lands at South Shore', passes.landed < 0.01, passes);
  await a.waitForFunction(() => { const s = window.__isle.air.shown(); return s && /Air traffic control/.test(s.msg); }, null, { timeout: 8000 }).catch(() => {});
  check('the airport board says the jet is on an air traffic control route', /Air traffic control has the jet on a special route to South Shore/.test(await a.evaluate(() => { const s = window.__isle.air.shown(); return s ? s.msg : ''; })));
  check('the map shows the route the jet is flying', await a.evaluate(() => { const c = document.getElementById('mapCanvas').getContext('2d'), I = window.__isle, w = I.atc.via()[0], d = c.getImageData(Math.round((w[0]) * 2), Math.round((w[1]) * 2), 1, 1).data; return d[2] > 200 && d[0] < 160; }));
  await btn(a, 'Close');
  check('Close shuts the map', await a.evaluate(() => document.getElementById('map').hidden && !window.__isle.atc.on()));

  // Rooms: only the host and admins are air traffic control
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 240000 });
  await g.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); });
  await g.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); }); await wait(300);
  if (await g.evaluate(() => document.getElementById('overlay').classList.contains('hidden'))) { await g.keyboard.press('Escape'); await wait(300); }
  check('a builder has no air traffic control button', !(await g.evaluate(() => [...document.querySelectorAll('#playCtl button')].some((b) => /Air traffic control/.test(b.textContent)))) && !(await g.evaluate(() => window.__isle.atc.may())));
  check('and can’t open it', !(await g.evaluate(() => window.__isle.atc.open())) && /Only the host and admins can be air traffic control/.test(await toast(g)));
  const before = await a.evaluate(() => JSON.stringify(window.__isle.atc.via()));
  await g.evaluate(() => { const n = window.__isle.net; n.ws.send(JSON.stringify({ t: 'call', dock: 3, x: 100, y: 30, z: 100, h: 0, via: [[10, 10], [20, 20]] })); });
  await g.waitForFunction(() => /Only the host and admins can be air traffic control/.test(document.getElementById('toast').textContent), null, { timeout: 8000 }).catch(() => {});
  await wait(600);
  check('the server turns down a route from a builder', (await a.evaluate(() => JSON.stringify(window.__isle.atc.via()))) === before && /Only the host and admins can be air traffic control/.test(await toast(g)));
  // the host routes the jet; everyone sees the same route
  await a.evaluate(() => window.__isle.atc.open());
  for (const w of [[90, 150], [60, 200]]) await mapClick(a, w[0], w[1]);
  await btn(a, 'Land at West Bay');
  await g.waitForFunction(() => { const v = window.__isle.atc.via(); return v && v.length === 2; }, null, { timeout: 8000 }).catch(() => {});
  check('the host routes the jet and the guest sees the same route', JSON.stringify(await g.evaluate(() => window.__isle.atc.via())) === JSON.stringify(await a.evaluate(() => window.__isle.atc.via())) && (await g.evaluate(() => window.__isle.atc.plan().dock)) === 3);
  check('and the guest is told by the tower', /Tower: air traffic control cleared the jet through 2 waypoints to land at West Bay/.test(await toast(g)), await toast(g));
  await a.evaluate(() => window.__isle.atc.close());
  // the host makes the guest an admin, and now they can be air traffic control too
  await a.evaluate(() => document.querySelector('#nPeers button').click());
  await g.waitForFunction(() => window.__isle.net.admin, null, { timeout: 8000 }).catch(() => {});
  check('an admin can be air traffic control', await g.evaluate(() => window.__isle.atc.may()));
  await g.evaluate(() => window.__isle.atc.send(0, [[150, 60]]));
  await a.waitForFunction(() => { const v = window.__isle.atc.via(); return v && v.length === 1 && v[0][0] === 150; }, null, { timeout: 8000 }).catch(() => {});
  check('and their route reaches everyone', JSON.stringify(await a.evaluate(() => window.__isle.atc.via())) === '[[150,60]]');

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
