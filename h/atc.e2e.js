// Air traffic control keeps planes apart: of two that come too close, the one that can move changes height.
// Run: node h/atc.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18161, URL = 'http://localhost:' + PORT + '/?layout=classic';
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
  await a.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); });
  await wait(900);
  const same = await a.evaluate(() => window.__isle.atcSep.separate([
    { id: 'jet', x: 100, y: 60, z: 100, pri: 3, move: false },
    { id: 'L1', x: 102, y: 62, z: 101, pri: 1, move: true }]));
  check('two planes right on top of each other: the one that can move is told to change height', Object.keys(same).join() === 'L1' && Math.abs(same.L1) === 10, same);
  const apart = await a.evaluate(() => window.__isle.atcSep.separate([
    { id: 'jet', x: 100, y: 60, z: 100, pri: 3, move: false },
    { id: 'L1', x: 200, y: 60, z: 200, pri: 1, move: true }]));
  check('planes far apart are left alone', Object.keys(apart).length === 0, apart);
  const pilot = await a.evaluate(() => window.__isle.atcSep.separate([
    { id: 'L0', x: 100, y: 60, z: 100, pri: 3, move: false },
    { id: 'jet', x: 101, y: 61, z: 101, pri: 3, move: false }]));
  check('two planes that can’t move: nothing is moved (ATC just can’t fix it)', Object.keys(pilot).length === 0, pilot);
  const alts = await a.evaluate(() => window.__isle.atcSep.alt());
  check('every timetable plane has a height change, normally zero', alts.length === 5 && alts.every((v) => typeof v === 'number'), alts);
  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
