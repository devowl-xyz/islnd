// Water and sand physics test in real Chromium pages.
// Run: node h/water.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18090, URL = 'http://localhost:' + PORT + '/?layout=classic';
const WATER = 12, SAND = 4, STONE = 3;
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const open = async () => {
    const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
    page.on('pageerror', (e) => { console.log('pageerror', e.message); fails++; });
    await page.goto(URL);
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
    return page;
  };
  const p = await open();
  const lv = (x, y, z) => p.evaluate(([x, y, z]) => window.__isle.water(x, y, z), [x, y, z]);
  const blk = (x, y, z) => p.evaluate(([x, y, z]) => window.__isle.get(x, y, z), [x, y, z]);
  const set = (x, y, z, b) => p.evaluate(([x, y, z, b]) => window.__isle.setBlock(x, y, z, b), [x, y, z, b]);
  const settle = (pg) => (pg || p).waitForFunction(() => window.__isle.simIdle(), null, { timeout: 60000 });

  check('open sea is full water', (await lv(80, 10, 5)) === 8 && (await blk(80, 10, 5)) === WATER);
  check('sea is still at start', await p.evaluate(() => window.__isle.simIdle()));

  // A source on flat ground spreads 7 blocks, dropping a level each step.
  await set(80, 13, 100, WATER); await settle();
  const row = []; for (let x = 80; x <= 89; x++) row.push(await lv(x, 13, 100));
  check('water spreads 8,7,6...1 then stops', JSON.stringify(row) === JSON.stringify([8, 7, 6, 5, 4, 3, 2, 1, 0, 0]), row);
  check('spreads the same way in z', (await lv(80, 13, 103)) === 5);
  // Scooping the source drains the flow.
  await set(80, 13, 100, 0); await settle();
  check('flow drains when the source is removed', (await lv(81, 13, 100)) === 0 && (await lv(84, 13, 100)) === 0);

  // A gap between two sources fills as a new source.
  await set(70, 13, 100, WATER); await set(72, 13, 100, WATER); await settle();
  check('gap between two sources becomes a source', (await lv(71, 13, 100)) === 8);
  for (const x of [70, 71, 72]) await set(x, 13, 100, 0);
  await settle();

  // Waterfall off a pillar.
  for (const y of [13, 14, 15]) await set(60, y, 106, STONE);
  await set(60, 16, 106, WATER); await settle();
  check('water pours off the pillar top', (await lv(61, 16, 106)) === 7);
  check('falling water fills the drop', (await lv(61, 15, 106)) === 7 && (await lv(61, 14, 106)) === 7 && (await lv(61, 13, 106)) === 7);
  check('it spreads again on landing', (await lv(62, 13, 106)) === 6);
  await set(60, 16, 106, 0); await settle();
  check('waterfall drains', (await lv(61, 14, 106)) === 0 && (await lv(62, 13, 106)) === 0);

  // Sand falls.
  await set(90, 16, 100, SAND); await settle();
  check('floating sand falls to the ground', (await blk(90, 13, 100)) === SAND && (await blk(90, 16, 100)) === 0);
  // Sand stack falls when the block under it goes.
  await set(92, 13, 100, STONE); await set(92, 14, 100, SAND); await set(92, 15, 100, SAND); await settle();
  await set(92, 13, 100, 0); await settle();
  check('sand stack drops when support is removed', (await blk(92, 13, 100)) === SAND && (await blk(92, 14, 100)) === SAND && (await blk(92, 15, 100)) === 0);

  // The meadow floor is fixed, but you can tunnel under it from beside the meadow.
  check('meadow floor cannot be broken', (await set(80, 12, 95, 0)) === false && (await blk(80, 12, 95)) === 1);
  check('meadow floor cannot be replaced', (await set(80, 12, 95, STONE)) === false);
  check('blocks can still be built on the floor', (await set(80, 13, 95, STONE)) === true && (await set(80, 13, 95, 0)) === true);
  // Off the meadow at x=110 (outside the field), dig down then tunnel west under it.
  const offField = await p.evaluate(() => !window.__isle.onField(110, 92) && window.__isle.onField(100, 92));
  check('tunnel starts off the meadow and ends under it', offField);
  let dug = true;
  for (let x = 110; x >= 98; x--) for (const y of [10, 11]) { if ((await blk(x, y, 92)) !== 0 && !(await set(x, y, 92, 0))) dug = false; }
  check('mining under the meadow works', dug && (await blk(100, 11, 92)) === 0 && (await blk(98, 10, 92)) === 0);
  check('floor stays in place over the tunnel', (await blk(100, 12, 92)) === 1 && (await blk(98, 12, 92)) === 1);
  await settle();

  // Digging out a block on the shoreline lets the sea in.
  const shore = await p.evaluate(() => {
    const I = window.__isle;
    for (let z = 2; z < 158; z++) for (let x = 2; x < 158; x++) {
      if (I.get(x, 10, z) === 12 || I.get(x, 10, z) === 0) continue;
      if (I.get(x, 11, z) !== 0) continue;
      let n = 0;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach((d) => { if (I.water(x + d[0], 10, z + d[1]) === 8) n++; });
      if (n >= 2) return [x, z];
    }
    return null;
  });
  check('found a shoreline block', !!shore);
  if (shore) {
    await set(shore[0], 10, shore[1], 0); await settle();
    check('the sea refills a dug shoreline hole', (await lv(shore[0], 10, shore[1])) === 8);
  }

  // Floating: drop the player under the open sea and let go.
  await p.evaluate(() => document.getElementById('play').click());
  await wait(900);
  await p.evaluate(() => { const P = window.__isle.player; P.x = 80.5; P.z = 6.5; P.y = 6; P.vx = P.vy = P.vz = 0; P.fly = false; });
  await p.waitForFunction(() => { const P = window.__isle.player; return P.y + 1.62 > 10.875 && P.y < 10.875 && Math.abs(P.vy) < 1.5; }, null, { timeout: 20000 }).catch(() => {});
  const fl = await p.evaluate(() => { const P = window.__isle.player; return { y: P.y, vy: P.vy, hud: document.getElementById('coords').textContent }; });
  check('player floats up with head above water', fl.y + 1.62 > 10.875 && fl.y < 10.875, fl);
  check('HUD says Swimming', /Swimming/.test(fl.hud), fl.hud);

  // Current: standing in a flow pushes you downstream.
  await set(100, 13, 92, WATER); await settle();
  await p.evaluate(() => { const P = window.__isle.player; P.x = 102.5; P.z = 92.5; P.y = 13; P.vx = P.vy = P.vz = 0; });
  await wait(1500);
  const cur = await p.evaluate(() => { const P = window.__isle.player; return { x: P.x, vx: P.vx, vz: P.vz }; });
  check('a current pushes the player downstream', cur.vx > 1.5 && Math.abs(cur.vz) < 0.5 && cur.x > 102.6, cur);

  // Rooms: every player sees the same flow.
  await p.keyboard.press('Escape'); await wait(200);
  await p.evaluate(() => document.getElementById('nHost').click());
  await p.waitForFunction(() => window.__isle.net.code);
  const code = await p.textContent('#nRoomCode');
  const g = await open();
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code); await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  await settle(g);
  check('joiner sees the host water already flowing', (await g.evaluate(() => window.__isle.water(102, 13, 92))) === 6);
  await g.evaluate(() => window.__isle.setBlock(75, 13, 95, 12));
  await wait(300); await settle(); await settle(g);
  const a = await p.evaluate(() => [window.__isle.water(76, 13, 95), window.__isle.water(79, 13, 95)]);
  const b = await g.evaluate(() => [window.__isle.water(76, 13, 95), window.__isle.water(79, 13, 95)]);
  check('guest water flows the same for both players', JSON.stringify(a) === '[7,4]' && JSON.stringify(a) === JSON.stringify(b), { a, b });

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
