// Slabs and corner stairs in real Chromium: side slabs, top slabs, double slabs, corner stairs.
// Run: node h/slabs-corners.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18155, URL = 'http://localhost:' + PORT + '/?layout=classic';
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
  await a.evaluate(() => { const I = window.__isle; I.cmd('/gamemode creative'); const P = I.player; P.fly = true; P.x = 80.5; P.z = 92.5; P.y = 24; });
  const names = await a.evaluate(() => window.__isle.slab.names());
  check('the picker names the top slabs and corner stairs', names[0] === 'Wood top slab' && names[1] === 'Stone top slab' && names[2] === 'Wood corner stairs' && names[9] === 'Stone corner stairs', names);
  // a stone slab placed on the side of a stone block
  await a.evaluate(() => { const I = window.__isle; I.tnt.place(40, 20, 40, I.B.STONE); });
  const side = await a.evaluate(() => window.__isle.slab.place(40, 20, 40, 1, 0, 0, window.__isle.B.SLAB_STONE));
  check('a slab on the side sits at the bottom of its cell', side[1] === 49, side);
  // a slab placed on the underside of a block sits in the top half
  await a.evaluate(() => { const I = window.__isle; I.tnt.place(45, 21, 40, I.B.STONE); });
  const under = await a.evaluate(() => window.__isle.slab.place(45, 21, 40, 0, -1, 0, window.__isle.B.SLAB_STONE));
  check('a slab on the underside of a block is a top slab', under[1] === 186, under);
  // a slab on the top of a matching slab makes a double slab (a whole block)
  await a.evaluate(() => { const I = window.__isle; I.tnt.place(50, 20, 40, I.B.SLAB_STONE); });
  const dbl = await a.evaluate(() => window.__isle.slab.place(50, 20, 40, 0, 1, 0, window.__isle.B.SLAB_STONE));
  check('two slabs stacked make a double slab', dbl[0] === 3, dbl);
  // corner stairs: a corner stair placed on top of a stone block
  await a.evaluate(() => { const I = window.__isle; I.tnt.place(55, 20, 40, I.B.STONE); });
  const corner = await a.evaluate(() => window.__isle.slab.place(55, 20, 40, 0, 1, 0, window.__isle.B.CORNER_STONE));
  check('a corner stair sits on top, in one of its four ways round', corner[1] >= 191 && corner[1] <= 194, corner);
  // the new shapes are drawn with their own shape, not as full cubes
  const shapes = await a.evaluate(() => { const I = window.__isle; const out = [I.slab.shape(I.B.SLAB_WOOD_TOP), I.slab.shape(I.B.SLAB_STONE_TOP)]; for (let k = 0; k < 8; k++) out.push(I.slab.shape(I.B.CORNER_WOOD + k)); return out; });
  check('top slabs and corner stairs are drawn as their own shapes', shapes.every((s) => s === true), shapes);
  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
