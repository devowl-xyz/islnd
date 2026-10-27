// Island jet test in real Chromium pages: dock, shared autopilot, boarding, flying, rooms.
// Run: node h/jet.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18100, URL = 'http://localhost:' + PORT + '/?layout=classic';
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const open = async (name) => {
    const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
    page.on('pageerror', (e) => { console.log(name + ' pageerror', e.message); fails++; });
    await page.goto(URL);
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
    if (name) await page.fill('#nName', name);
    return page;
  };
  const play = (p) => p.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); });
  // put the player beside the jet wherever it is and press E
  const board = (p) => p.evaluate(() => { const I = window.__isle, q = I.jet.pose, P = I.player; P.fly = true; P.x = q.x; P.y = q.y - 0.9; P.z = q.z + 2; I.toggleBoard(); });
  const pose = (p) => p.evaluate(() => Object.assign({}, window.__isle.jet.pose));

  const a = await open();
  const park = await a.evaluate(() => window.__isle.jetPark());
  const deck = await a.evaluate((pk) => window.__isle.get(Math.floor(pk[0]), Math.floor(pk[1] - 2), Math.floor(pk[2])), park);
  check('the dock deck is built under the parking spot', deck === 7 || deck === 10, deck);
  check('the dock is on the east side', park[0] > 120, park);

  // The autopilot route is the same for everyone and loops the island.
  const b = await open();
  const same = await Promise.all([a, b].map((p) => p.evaluate(() => [40, 60, 80].map((t) => { const q = window.__isle.autoPose(t); return [q.x, q.y, q.z].map((v) => Math.round(v * 10) / 10); }))));
  check('two players get the same autopilot route', JSON.stringify(same[0]) === JSON.stringify(same[1]));
  const decks = await a.evaluate(() => { const I = window.__isle; return I.docks.map((d) => { const k = I.dockPark(d); return I.get(Math.floor(k[0]), Math.floor(k[1] - 2), Math.floor(k[2])); }); });
  check('four jet docks round the island', decks.length === 4 && decks.every((b) => b === 7 || b === 10), decks);
  const tour = await a.evaluate(() => {
    const I = window.__isle, C = I.cycle();
    const visits = I.docks.map((d) => { const k = I.dockPark(d); let best = 99; for (let t = 0; t < C; t += 0.25) { const q = I.autoPose(t); best = Math.min(best, Math.hypot(q.x - k[0], q.y - k[1], q.z - k[2])); } return best; });
    let top = 0, minClear = 99;
    for (let t = 0; t < C; t += 0.5) {
      const q = I.autoPose(t); top = Math.max(top, q.y);
      const near = Math.min(...I.docks.map((d) => { const k = I.dockPark(d); return Math.hypot(q.x - k[0], q.z - k[2]); }));
      if (near < 12) continue;
      // taxiing and taking off on the airport's runway is meant to be on the ground
      if (q.x > 148 && q.x < 168 && q.z > 80 && q.z < 158) continue;
      const x = Math.floor(q.x), z = Math.floor(q.z); let g = 0; if (x >= 0 && z >= 0 && x < 352 && z < 352) for (let y = 47; y > 0; y--) if (I.get(x, y, z)) { g = y + 1; break; }
      minClear = Math.min(minClear, q.y - g);
    }
    const st = I.stops().map((s) => [s.dock, Math.round(s.tArrive)]);
    return { C, visits, top, minClear, st, s5: I.jetStatus(5), sFly: I.jetStatus(40) };
  });
  check('the tour lands at every dock', tour.visits.every((v) => v < 0.01), tour.visits);
  check('and flies high over the hills between them', tour.top > 45 && tour.minClear >= 6, tour);
  check('it knows where it is and where it goes next', tour.s5.at === 0 && tour.s5.next === 1 && tour.sFly.flying && tour.sFly.next === 1 && tour.st.map((s) => s[0]).join() === '1,2,3,0', tour);
  const parked = await a.evaluate(() => { const p = window.__isle.jetPark(); const q = window.__isle.autoPose(5); return Math.hypot(q.x - p[0], q.y - p[1], q.z - p[2]); });
  check('it waits at the dock at the start of each loop', parked < 0.01, parked);
  await b.context().close();

  // Single player: you are the pilot.
  await play(a); await wait(900);
  await board(a);
  check('boarding in single player puts you in the pilot seat', await a.evaluate(() => window.__isle.jet.seat === 'pilot'));
  const p0 = await pose(a);
  await a.keyboard.down('KeyW'); await wait(2500); await a.keyboard.up('KeyW');
  const p1 = await pose(a);
  const thr = await a.evaluate(() => ({ thr: window.__isle.jet.thr, spd: window.__isle.jet.spd }));
  check('throttle moves the jet', thr.thr > 0.4 && thr.spd > 2 && Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.5, { thr, p0, p1 });
  const me = await a.evaluate(() => { const I = window.__isle, q = I.jet.pose, P = I.player; return Math.hypot(P.x - q.x, P.y - q.y, P.z - q.z); });
  check('the pilot rides inside the jet', me < 4, me);
  check('the HUD shows the controls', /throttle/.test(await a.textContent('#jethint')));
  check('the cockpit has a dashboard and a yoke', await a.evaluate(() => !!(window.__isle.jet.dash && window.__isle.jet.yoke && window.__isle.jet.screen)));
  await a.keyboard.press('KeyV'); await wait(400);
  const fp = await a.evaluate(() => { const I = window.__isle, v = I.view(), q = I.jet.pose; return { third: v.third, d: Math.hypot(v.x - q.x, v.y - q.y, v.z - q.z) }; });
  check('in first person you look out from the pilot’s seat inside the jet', !fp.third && fp.d < 3.5, fp);
  await a.keyboard.press('KeyV'); await wait(200);
  await a.keyboard.press('KeyE'); await wait(300);
  const st = await a.evaluate(() => ({ seat: window.__isle.jet.seat, rel: !!window.__isle.jet.rel, pilot: window.__isle.jet.pilot }));
  check('leaving hands the jet back to autopilot, flying home', st.seat === null && st.rel && st.pilot === null, st);

  // Calling the jet to a dock.
  const clear = await a.evaluate(() => {
    const I = window.__isle, keep = I.jet.call; let worst = 99;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const f = I.dockPark(I.docks[i]);
      I.jet.call = { dock: j, x: f[0], y: f[1], z: f[2], h: I.docks[i].out, t0: 1000 };
      const C = I.callPlan();
      for (let t = 1000; t < C.tDone; t += 0.5) {
        const q = I.callPose(t);
        if (Math.min(...I.docks.map((d) => { const k = I.dockPark(d); return Math.hypot(q.x - k[0], q.z - k[2]); })) < 12) continue;
        const x = Math.floor(q.x), z = Math.floor(q.z); let g = 0; if (x >= 0 && z >= 0 && x < 352 && z < 352) for (let y = 47; y > 0; y--) if (I.get(x, y, z)) { g = y + 1; break; }
        worst = Math.min(worst, q.y - g);
      }
    }
    I.jet.call = keep;
    return worst;
  });
  check('called from any dock to any other, the jet flies well clear of the ground', clear >= 6, clear);
  const west = await a.evaluate(() => { const d = window.__isle.docks[3]; return { cx: d.cx, cz: d.cz, top: d.top, post: d.post }; });
  check('each dock has a call post with a gold bell', await a.evaluate((d) => { const I = window.__isle, q = d.post; return I.get(q[0], q[1], q[2]) === 5 && I.get(q[0], q[1] + 2, q[2]) === 25; }, west));
  await a.evaluate((d) => { const P = window.__isle.player; P.fly = false; P.x = d.cx - 2; P.y = d.top; P.z = d.cz + 0.5; P.vx = P.vy = P.vz = 0; }, west); await wait(500);
  check('on a dock the hint offers to call the jet there', /call the jet to West Bay/.test(await a.textContent('#jethint')), await a.textContent('#jethint'));
  await a.keyboard.press('KeyE'); await wait(400);
  const plan = await a.evaluate(() => {
    const I = window.__isle, C = I.callPlan(); if (!C) return null;
    const k = I.dockPark(I.docks[3]), h = I.dockPark(I.docks[0]), at = I.callPose(C.tLand + 2), home = I.callPose(C.tDone + 0.01), q = I.jet.pose; let follow = 99; for (let dt = -2; dt <= 0.2; dt += 0.05) { const c = I.callPose(I.nowS() + dt); follow = Math.min(follow, Math.hypot(q.x - c.x, q.y - c.y, q.z - c.z)); }
    return { dock: C.dock, wait: C.tLeave - C.tLand, land: Math.hypot(at.x - k[0], at.y - k[1], at.z - k[2]), home: Math.hypot(home.x - h[0], home.y - h[1], home.z - h[2]), resume: C.resume >= C.tDone, follow };
  });
  check('E calls the jet: it flies to that dock, lands and waits for you', plan && plan.dock === 3 && plan.land < 0.01 && plan.wait >= 20 && plan.follow < 2, plan);
  check('then it flies home to East Beach and back to its tour', plan && plan.home < 0.01 && plan.resume, plan);
  await a.evaluate(() => { const I = window.__isle, q = I.docks[2].post; I.jet.call = null; return I.act.use(q[0], q[1] + 2, q[2]); });
  check('ringing the gold bell on a post calls it too', await a.evaluate(() => window.__isle.jet.call && window.__isle.jet.call.dock === 2));
  await a.evaluate(() => { const I = window.__isle, q = I.jet.pose; I.jet.call = null; I.callJet(3); });
  check('the hint says it is coming', /on its way to West Bay/.test(await a.textContent('#jethint')));
  const cst = await a.evaluate(() => { const I = window.__isle, C = I.callPlan(); return { s: I.jetStatus(0), next: C.dock }; });
  check("and so does the dashboard", cst.s.called && cst.s.next === 3, cst);

  // Rooms.
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  await play(g); await wait(900);
  const ret = await Promise.all([a, g].map((p) => p.evaluate(() => { const j = window.__isle.jet; return j.rel ? Math.round(j.rel.t0) : null; })));
  check('host and joiner agree on the jet state', ret[0] === ret[1] || (ret[0] !== null && ret[1] !== null && Math.abs(ret[0] - ret[1]) <= 1), ret);

  await board(g); await wait(500);
  check('a builder boards as a passenger', await g.evaluate(() => window.__isle.jet.seat === 1 && window.__isle.jet.pass.length === 1));
  check('passengers are told the next stop', /Next stop|leaving for|Your pilot|to leave/.test(await g.textContent('#jethint')));
  await g.keyboard.press('KeyV'); await wait(400);
  const pv = await g.evaluate(() => { const I = window.__isle, v = I.view(), q = I.jet.pose; return { third: v.third, d: Math.hypot(v.x - q.x, v.y - q.y, v.z - q.z) }; });
  check('in first person a passenger sits in the cabin', !pv.third && pv.d < 2.5, pv);
  await g.keyboard.press('KeyV'); await wait(200);
  check('the host sees the passenger sitting down', await a.evaluate(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.av && p.av.legL && p.av.legL.rotation.x > 1.3) ok = true; }); return ok; }));
  await g.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'unboard' })));
  await wait(300);
  await g.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'board', seat: 'pilot' })));
  await wait(400);
  check('a builder cannot take the pilot seat', await a.evaluate(() => window.__isle.jet.pilot === null));

  await board(g); await wait(300);
  await play(a); await wait(900);
  await board(a);
  await a.waitForFunction(() => window.__isle.jet.seat === 'pilot', null, { timeout: 8000 }).catch(() => {});
  await g.waitForFunction(() => window.__isle.jet.pilot !== null, null, { timeout: 8000 }).catch(() => {});
  check('the host takes the pilot seat', await a.evaluate(() => window.__isle.jet.seat === 'pilot') && await g.evaluate(() => window.__isle.jet.pilot === window.__isle.net.peers.keys().next().value));
  await g.evaluate(() => { const q = window.__isle.jet.pose; window.__isle.net.ws.send(JSON.stringify({ t: 'call', dock: 2, x: q.x, y: q.y, z: q.z, h: q.h })); });
  await wait(500);
  check('nobody can call the jet while someone is flying it', await a.evaluate(() => !window.__isle.jet.call) && await g.evaluate(() => !window.__isle.jet.call));
  await a.keyboard.down('KeyW'); await wait(3000); await a.keyboard.up('KeyW');
  await wait(800);
  const hp = await pose(a), gp = await pose(g);
  check('the passenger sees the jet where the pilot flies it', Math.hypot(hp.x - gp.x, hp.y - gp.y, hp.z - gp.z) < 4, { hp, gp });
  const ride = await g.evaluate(() => { const I = window.__isle, q = I.jet.pose, P = I.player; return Math.hypot(P.x - q.x, P.y - q.y, P.z - q.z); });
  check('the passenger rides along inside', ride < 4, ride);
  await g.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'jet', x: 0, y: 99, z: 0, h: 0, p: 0, r: 0, s: 0 })));
  await wait(400);
  check('a passenger cannot steer the jet', (await pose(a)).y < 90 && (await pose(g)).y < 90);

  await a.keyboard.press('KeyE');
  for (const p of [a, g]) await p.waitForFunction(() => !!window.__isle.jet.rel, null, { timeout: 5000 }).catch(() => {});
  const rel = await Promise.all([a, g].map((p) => p.evaluate(() => { const I = window.__isle, j = I.jet; return j.rel ? { t0: j.rel.t0, x: j.rel.x } : null; })));
  check('when the pilot leaves, both see the same flight home', rel[0] && rel[1] && rel[0].t0 === rel[1].t0 && Math.abs(rel[0].x - rel[1].x) < 0.5, rel);
  check('the passenger stays aboard for the ride home', await g.evaluate(() => window.__isle.jet.seat === 1));
  await g.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'unboard' })));
  await g.waitForFunction(() => window.__isle.jet.seat === null, null, { timeout: 8000 }).catch(() => {});
  await g.evaluate(() => { const I = window.__isle, d = I.docks[1], P = I.player; P.fly = false; P.x = d.cx - 1; P.y = d.top; P.z = d.cz - 2; P.vx = P.vy = P.vz = 0; });
  await wait(500);
  await g.evaluate(() => window.__isle.toggleBoard());
  for (const p of [a, g]) await p.waitForFunction(() => !!window.__isle.jet.call, null, { timeout: 8000 }).catch(() => {});
  const calls = await Promise.all([a, g].map((p) => p.evaluate(() => { const c = window.__isle.jet.call; return c ? { dock: c.dock, t0: c.t0 } : null; })));
  check('a builder calls the jet to North Shore, and everyone sees the same flight', calls[0] && calls[1] && calls[0].dock === 1 && calls[0].t0 === calls[1].t0, calls);
  await g.evaluate(() => { const q = window.__isle.jet.pose, P = window.__isle.player; P.fly = true; P.x = q.x; P.y = q.y - 0.9; P.z = q.z + 2; window.__isle.toggleBoard(); });
  await g.waitForFunction(() => window.__isle.jet.seat === 1, null, { timeout: 8000 }).catch(() => {});

  // An admin can fly.
  await g.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'unboard' }))); await wait(300);
  await a.evaluate(() => { document.getElementById('overlay').classList.contains('hidden') || 0; });
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => { const b = document.querySelector('#nPeers button'); if (b) b.click(); });
  await g.waitForFunction(() => window.__isle.net.admin, null, { timeout: 5000 }).catch(() => {});
  await board(g);
  await g.waitForFunction(() => window.__isle.jet.seat === 'pilot', null, { timeout: 8000 }).catch(() => {});
  check('an admin takes the pilot seat', await g.evaluate(() => window.__isle.jet.seat === 'pilot'), await g.evaluate(() => { const I = window.__isle, j = I.jet; return { admin: I.net.admin, seat: j.seat, pilot: j.pilot, pass: j.pass, rel: !!j.rel, near: I.pets.near(), hint: document.getElementById('jethint').textContent }; }));
  await a.evaluate(() => { const b = document.querySelector('#nPeers button'); if (b) b.click(); });
  await g.waitForFunction(() => window.__isle.jet.seat === null && window.__isle.jet.pilot === null, null, { timeout: 8000 }).catch(() => {});
  check('removing admin takes them out of the pilot seat', await g.evaluate(() => window.__isle.jet.seat === null && window.__isle.jet.pilot === null));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
