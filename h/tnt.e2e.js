// TNT in real Chromium: it blows up bases, but never the owl labs.
// Run: node h/tnt.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18127, URL = 'http://localhost:' + PORT + '/?layout=classic';
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

  // the campsite: a stone wall beside a TNT block, then the TNT goes off
  const camp = await a.evaluate(() => {
    const I = window.__isle, c = I.tnt.camp(), x = c.x0 + 2, y = c.G + 2, z = c.z0 + 2;
    I.cmd('/gamemode creative');
    I.tnt.place(x, y, z, I.B.TNT); I.tnt.place(x + 1, y, z, I.B.STONE);
    const before = I.get(x + 1, y, z);
    I.tnt.boom(x, y, z);
    return { before, after: I.get(x + 1, y, z), walls: I.tnt.may(x + 1, y, z) };
  });
  check('a wall in a camp is there to blow up', camp.before === 3, camp);
  check('TNT blows up the wall in a camp', camp.after === 0, camp);

  // the owl lab's secret room: the same, and the wall stays
  const lab = await a.evaluate(() => {
    const I = window.__isle, s = I.tnt.sec(), x = s.ix0 + 2, y = s.iy0 + 1, z = s.iz0 + 2;
    I.tnt.place(x, y, z, I.B.TNT); I.tnt.place(x + 1, y, z, I.B.STONE);
    const before = I.get(x + 1, y, z);
    I.tnt.boom(x, y, z);
    return { before, after: I.get(x + 1, y, z), may: I.tnt.may(x + 1, y, z) };
  });
  check('a wall in the owl lab is there to blow up', lab.before === 3, lab);
  check('TNT never blows up the owl lab', lab.after === 3 && lab.may === false, lab);

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
