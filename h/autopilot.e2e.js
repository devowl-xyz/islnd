// Autopilot test in real Chromium: J takes off and lands the jumbo, the Owl Hopper and Bird Air Express.
// Run: node h/autopilot.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18115, URL = 'http://localhost:' + PORT + '/?layout=classic';
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
  page.on('pageerror', (e) => { console.log('pageerror', e.message); fails++; });
  await page.goto(URL);
  await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
  const a = page;
  await a.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); }); await wait(900);
  const st = () => a.evaluate(() => window.__isle.ap.state());
  const pl = () => a.evaluate(() => window.__isle.ap.plane());
  /* J, then wait until the autopilot hands back (or the plane is gone), noting the lowest the plane got and whether it crashed */
  const run = async (ms) => {
    await a.keyboard.press('KeyJ'); await wait(200);
    const s0 = await st();
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { const s = await st(), p = await pl(); if (!s.on || !p) break; await wait(400); }
    return { start: s0, end: await st(), plane: await pl() };
  };

  // ----- the jumbo, from its parking spot on the airport runway -----
  await a.evaluate(() => { const I = window.__isle, C = I.cycle(), n = I.nowS(), c = ((n % C) + C) % C; I.net.tOff -= (c - 4) * 1000; }); await wait(600);
  await a.evaluate(() => { const I = window.__isle, q = I.jet.pose, P = I.player; P.fly = true; P.x = q.x; P.y = q.y - 0.9; P.z = q.z + 2; I.toggleBoard(); }); await wait(500);
  check('fly the jumbo and the autopilot is there', (await a.evaluate(() => window.__isle.jet.seat)) === 'pilot' && (await pl()).kind === 'jet' && (await pl()).ground);
  let r = await run(120000);
  check('on the runway, J takes off: it rolls, lifts off and climbs, then hands back', r.start.phase === 'takeoff' && r.end.tookoff === 1 && !r.end.on && !!r.plane && r.plane.y - r.plane.g > 20, r);
  await wait(3000);
  r = await run(400000);
  check('in the air, J flies the pattern, comes down the approach, flares, touches down and brakes to a stop', r.start.phase === 'land' && r.end.landed === 1 && !!r.plane && r.plane.ground && r.plane.spd < 1.5, r);
  check('on the runway, the right way along it', !!r.plane && (await a.evaluate(() => { const p = window.__isle.ap.plane(); return window.__isle.ap.runways().some((w) => Math.abs(p.x - w.a[0]) < 4 && p.z > Math.min(w.a[1], w.b[1]) - 6 && p.z < Math.max(w.a[1], w.b[1]) + 6 || Math.abs(p.z - w.a[1]) < 4 && p.x > Math.min(w.a[0], w.b[0]) - 6 && p.x < Math.max(w.a[0], w.b[0]) + 6); })), r.plane);
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(500);

  // ----- the Owl Hopper, as an owl owner, from the Mini Isle -----
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  await a.waitForFunction(() => { const q = window.__isle.hop.owlPose(); return q && q.parked && q.ground; }, null, { timeout: 180000 }).catch(() => {});
  await a.evaluate(() => { const I = window.__isle, w = I.hop.owlWorld(0, 0, 0), P = I.player; P.fly = true; P.x = w.x + 3; P.y = w.y + 1; P.z = w.z; I.hop.owlBoard(); }); await wait(500);
  await a.keyboard.press('KeyF'); await wait(300);
  await a.waitForFunction(() => { const q = window.__isle.ap.plane(); return !!q && q.ground; }, null, { timeout: 15000 }).catch(() => {});
  check('take the Owl Hopper’s controls', (await pl() || {}).kind === 'hop');
  await wait(400);
  check('the Hopper’s hint mentions J for the autopilot', /<b>J<\/b> autopilot/.test(await a.evaluate(() => document.getElementById('jethint').innerHTML)), await a.evaluate(() => document.getElementById('jethint').textContent));
  r = await run(120000);
  check('J takes the Owl Hopper off', r.start.phase === 'takeoff' && r.end.tookoff === 2 && !!r.plane && r.plane.y - r.plane.g > 15, r);
  await wait(2500);
  r = await run(400000);
  check('and J lands it on the nearest runway', r.start.phase === 'land' && r.end.landed === 2 && !!r.plane && r.plane.ground && r.plane.spd < 1.5, r);
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(500);

  // ----- Bird Air Express, from one of its docks -----
  await a.waitForFunction(() => { const q = window.__isle.express.pose(); return q && q.parked; }, null, { timeout: 180000 }).catch(() => {});
  await a.evaluate(() => window.__isle.express.drive()); await wait(500);
  check('and so does the Express’s', /<b>J<\/b> autopilot/.test(await a.evaluate(() => document.getElementById('jethint').innerHTML)), await a.evaluate(() => document.getElementById('jethint').textContent));
  r = await run(120000);
  check('J takes Bird Air Express off from its dock', r.start.phase === 'takeoff' && r.end.tookoff === 3 && !!r.plane && r.plane.y - r.plane.g > 20, r);
  await wait(2500);
  r = await run(400000);
  check('and lands it', r.start.phase === 'land' && r.end.landed === 3 && !!r.plane && r.plane.spd < 1.5, r);
  // W takes the controls back
  r = await (async () => { await a.keyboard.press('KeyJ'); await wait(500); await a.keyboard.down('KeyW'); await wait(400); await a.keyboard.up('KeyW'); return st(); })();
  check('W takes the controls back from the autopilot', !r.on, r);
  check('/autopilot works too', await a.evaluate(() => { window.__isle.cmd('/autopilot'); return window.__isle.ap.state().on; }));
  await a.evaluate(() => window.__isle.cmd('/autopilot'));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
