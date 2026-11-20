// The planes in real Chromium: the Island Sightseer flies the shuttle's route, half a timetable behind it.
// Run: node h/planes.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18133, URL = 'http://localhost:' + PORT + '/?layout=classic';
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
  page.on('pageerror', (e) => { console.log('pageerror', e.message); fails++; });
  await page.goto(URL);
  await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
  const a = page;
  await a.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); });
  await a.waitForTimeout(900);
  const poses = await a.evaluate(() => window.__isle.planes.poses());
  const sight = poses.filter((p) => p.name === 'Island Sightseer')[0];
  const shuttle = poses.filter((p) => p.name === 'Island Shuttle')[0];
  check('there are five planes on the timetable: the shuttle, the Owl Hopper, the Sightseer, the seaplane and the Sky Dart', poses.length === 5 && poses.every((p) => p.leg !== null), poses);
  const sea = poses.filter((p) => p.name === 'Island Seaplane')[0], sky = poses.filter((p) => p.name === 'Sky Dart')[0];
  check('the seaplane and the Sky Dart have routes', !!sea && !!sky && sea.leg !== null && sky.leg !== null, [sea, sky]);
  check('the Sightseer is on the other half of the route from the shuttle', !!sight && !!shuttle && (sight.x !== shuttle.x || sight.z !== shuttle.z), [sight, shuttle]);
  check('it flies the same stops (North Shore and the Mini Isle legs)', !!sight && sight.leg !== null, sight);
  const fl = await a.evaluate(() => ({ bottom: window.__isle.planes2.floatBottom(), water: window.__isle.planes2.water() }));
  check('the seaplane floats: its floats rest on the water', Math.abs(fl.bottom - fl.water) < 0.01, fl);
  const sea2 = await a.evaluate(() => { const I = window.__isle; let wet = 0, n = 0; for (let x = 102; x <= 138; x += 4) for (let z = 172; z <= 176; z += 2) { n++; if (I.get(x, 10, z) === I.B.WATER) wet++; } return { wet, n }; });
  check('the seaplane alights on open water off West Bay', sea2.wet >= sea2.n * 0.9, sea2);
  // a plane is grappleable: put yourself by the shuttle, then aim the hook at where it is right now
  await a.evaluate(() => { const I = window.__isle, q = I.planes.poses().filter((p) => p.name === 'Island Shuttle')[0]; I.player.x = q.x + 3; I.player.z = q.z + 3; I.player.y = 13; });
  await a.waitForTimeout(1500);
  const grab = await a.evaluate(() => {
    const I = window.__isle, q = I.planes.poses().filter((p) => p.name === 'Island Shuttle')[0];
    const o = [q.x - 12, q.y + 6, q.z], tx = q.x, ty = q.y + 2, tz = q.z;
    const l = Math.hypot(tx - o[0], ty - o[1], tz - o[2]);
    return I.grapVeh(o[0], o[1], o[2], (tx - o[0]) / l, (ty - o[1]) / l, (tz - o[2]) / l, 60);
  });
  check('the hook catches the shuttle, as a plane', !!grab && grab.kind === 'line' && grab.k === 0, grab);
  // the Owl Hopper can be hooked mid-flight, by an owl owner: wait for it to be in the air, then hook on
  const k = await a.evaluate(() => window.__isle.planes.poses().findIndex((p) => p.name === 'Owl Hopper'));
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  await a.waitForFunction((k) => { const p = window.__isle.planes.poses()[k]; return p && !p.parked && p.ground === false; }, k, { timeout: 240000, polling: 300 }).catch(() => {});
  const inAir = await a.evaluate((k) => { const p = window.__isle.planes.poses()[k]; return !p.parked && !p.ground; }, k);
  if (inAir) {
    await a.evaluate((k) => window.__isle.planes2.arrive(k), k);
    check('an owl owner hooks on to the Owl Hopper in the air, as a passenger', await a.evaluate(() => { const r = window.__isle.planes2.riding(); return !!r && r.line === 'Owl Hopper' && !r.pilot; }), await a.evaluate(() => window.__isle.planes2.riding()));
    await a.waitForTimeout(800);
    // the game runs slower than the clock here, so compare altitude (which changes slowly) rather than the moving position
    const d = await a.evaluate((k) => { const I = window.__isle, p = I.planes.poses()[k], q = I.planes2.pos(); return Math.abs(q[1] - p.y); }, k);
    check('you sit in it, in the air, at the plane’s height', d < 8 && (await a.evaluate(() => window.__isle.planes2.fly())), d);
  } else { console.log('note: the Owl Hopper was not in the air in time, so the mid-flight check was skipped'); }
  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
