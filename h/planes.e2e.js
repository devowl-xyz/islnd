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
  check('there are three planes on the timetable: the shuttle, the Owl Hopper and the Sightseer', poses.length === 3 && !!sight && !!shuttle, poses);
  check('the Sightseer is on the other half of the route from the shuttle', !!sight && !!shuttle && (sight.x !== shuttle.x || sight.z !== shuttle.z), [sight, shuttle]);
  check('it flies the same stops (North Shore and the Mini Isle legs)', !!sight && sight.leg !== null, sight);
  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
