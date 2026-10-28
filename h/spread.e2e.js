// The default "spread" layout: homes moved out across the new lands, joined by a road.
// Run: node h/spread.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18170, BASE = 'http://localhost:' + PORT + '/';
const WHITE = 10, STONE = 3, SANDSTONE = 23;
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const open = async (q, name) => {
    const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
    page.on('pageerror', (e) => { console.log((name || 'page') + ' pageerror', e.message); fails++; });
    await page.goto(BASE + q);
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
    if (name) await page.fill('#nName', name);
    return page;
  };
  const play = (p) => p.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); });
  const get = (p, x, y, z) => p.evaluate(([x, y, z]) => window.__isle.get(x, y, z), [x, y, z]);
  const set = (p, x, y, z, b) => p.evaluate(([x, y, z, b]) => window.__isle.setBlock(x, y, z, b), [x, y, z, b]);
  const raw = (p, x, y, z, b) => p.evaluate(([x, y, z, b]) => window.__isle.net.ws.send(JSON.stringify({ t: 'edit', x, y, z, b })), [x, y, z, b]);

  const a = await open('');
  const info = await a.evaluate(() => { const I = window.__isle; return { layout: I.layout(), TH: I.th.TH, COT: I.cot.COT, home: I.pets.home, shift: I.shift.spread }; });
  check('the spread layout is the default', info.layout === 'spread', info.layout);
  const h = info.home;
  check('the owls live out on the eastern land', [h.hoot, h.snowy].every((o) => o.x > 220 && o.z < 100), [h.hoot, h.snowy]);
  check('Biscuit and Mochi live at the far south of the southern land', [h.biscuit, h.mochi].every((o) => o.z > 270), [h.biscuit, h.mochi]);
  check('Cinder and Goldie stay by the original island', h.cinder.x < 100 && h.goldie.x < 100);
  const d = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
  check('every home is a long way from the others', d(h.hoot, h.biscuit) > 180 && d(h.hoot, h.cinder) > 150 && d(h.biscuit, h.cinder) > 150);

  // The structures are the same buildings, just moved.
  const c = await open('?layout=classic');
  const boxes = { treehouse: [32, 56, 14, 41, 74, 104, info.shift.th], cottage: [106, 132, 18, 40, 57, 79, info.shift.cot] };
  for (const [name, [x0, x1, y0, y1, z0, z1, [dx, dz]]] of Object.entries(boxes)) {
    const A = await c.evaluate(([x0, x1, y0, y1, z0, z1]) => { const I = window.__isle, o = []; for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) o.push(I.th.cell(x, y, z) === 'base' ? I.get(x, y, z) : -1); return o; }, [x0, x1, y0, y1, z0, z1]);
    const Bv = await a.evaluate(([x0, x1, y0, y1, z0, z1, dx, dz]) => { const I = window.__isle, o = []; for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) o.push(I.get(x + dx, y, z + dz)); return o; }, [x0, x1, y0, y1, z0, z1, dx, dz]);
    let n = 0, same = 0; for (let i = 0; i < A.length; i++) if (A[i] > 0) { n++; if (A[i] === Bv[i]) same++; }
    check('the ' + name + ' is rebuilt block for block at its new spot', n > 200 && same / n > 0.97, [same, n]);
  }
  check('the old spots are open land now', (await get(a, 121, 20, 64)) !== WHITE && (await a.evaluate(() => window.__isle.th.cell(121, 20, 64))) === null && (await a.evaluate(() => window.__isle.th.cell(44, 28, 86))) === null);
  check('the moved cottage frame cannot be changed', !(await set(a, 233, 20, 292, 0)) && (await get(a, 233, 20, 292)) === WHITE);
  check('nor the moved treehouse base', !(await set(a, 256, 15, 62, 0)));

  // A road joins the meadow to the treehouse and the cottage, dry and never steeper than one block.
  const road = await a.evaluate(() => {
    const I = window.__isle, T = I.th.TH, C = I.cot.COT;
    const top = (x, z) => { for (let y = 47; y > 0; y--) { const b = I.get(x, y, z); if (b !== 0 && b !== 5 && b !== 6) return [y + 1, b]; } return [0, 0]; };
    const segs = [[122, 46, 214, 80], [214, 80, T.cx - 0.5, T.sz1 + 2], [214, 80, 214, 180], [214, 180, C.x0 - 11.5, C.cz - 20], [C.x0 - 11.5, C.cz - 20, C.x0 + 0.5, C.cz]];
    let worst = 0, other = 0, n = 0, blocked = 0;
    for (const [ax, az, bx, bz] of segs) {
      const m = Math.ceil(Math.hypot(bx - ax, bz - az)); let prev = null;
      for (let k = 0; k <= m; k++) { const [y, b] = top(Math.floor(ax + (bx - ax) * k / m), Math.floor(az + (bz - az) * k / m)); n++; if (b !== 23) other++; const bx0 = Math.floor(ax + (bx - ax) * k / m), bz0 = Math.floor(az + (bz - az) * k / m); if (I.get(bx0, y, bz0) || I.get(bx0, y + 1, bz0)) blocked++; if (prev !== null) worst = Math.max(worst, Math.abs(y - prev)); prev = y; }
    }
    return { worst, other, n, blocked };
  });
  check('a clear sandstone road runs all the way, with no step over one block', road.other === 0 && road.worst <= 1 && road.n > 300 && road.blocked === 0, road);

  const edges = await a.evaluate(() => {
    const I = window.__isle, T = I.th.TH, C = I.cot.COT;
    // the ground only: skip logs, leaves, water and planks (the observation deck's staircase stands on the treehouse plot's west edge),
    // and the cable car station by the cottage
    const top = (x, z) => { for (let y = 47; y > 0; y--) { const b = I.get(x, y, z); if (I.cable.inBox(x, y, z) && b !== 7) continue; if (b !== 0 && b !== 5 && b !== 6 && b !== 7 && b !== 12) return y + 1; } return 0; };
    const line = (x0, z0, dx, dz, n) => { let w = 0; for (let k = 1; k < n; k++) w = Math.max(w, Math.abs(top(x0 + dx * k, z0 + dz * k) - top(x0 + dx * (k - 1), z0 + dz * (k - 1)))); return w; };
    return {
      treeWest: line(T.x0 - 10, T.cz, 1, 0, 11), treeNorth: line(T.cx, T.z0 - 10, 0, 1, 11), treeEast: line(T.x1 + 10, T.cz, -1, 0, 11),
      cotNorth: line(C.cx, C.z0 - 10, 0, 1, 11), cotEast: line(C.x1 + 10, C.cz - 6, -1, 0, 11), cotSouth: line(C.cx, C.z1 + 10, 0, -1, 11)
    };
  });
  check('the new plots ease into the land around them', Object.values(edges).every((v) => v <= 2), edges);
  check('the water is settled', await a.evaluate(() => window.__isle.simIdle()));

  // The jet tours the whole island, clear of the hills.
  const tour = await a.evaluate(() => {
    const I = window.__isle; let maxX = 0, maxZ = 0, minClear = 99;
    for (let t = 0; t < I.cycle(); t += 0.5) {
      const p = I.autoPose(t); maxX = Math.max(maxX, p.x); maxZ = Math.max(maxZ, p.z);
      const near = Math.min(...I.docks.map((d) => { const k = I.dockPark(d); return Math.hypot(p.x - k[0], p.z - k[2]); }));
      const runway = p.x > 148 && p.x < 168 && p.z > 80 && p.z < 158; // taxiing and taking off at the airport
      if (near > 12 && !runway) { const x = Math.floor(p.x), z = Math.floor(p.z); let g = 0; if (x >= 0 && z >= 0 && x < 352 && z < 352) for (let y = 47; y > 0; y--) if (I.get(x, y, z)) { g = y + 1; break; } minClear = Math.min(minClear, p.y - g); }
    }
    return { maxX: Math.round(maxX), maxZ: Math.round(maxZ), minClear: Math.round(minClear) };
  });
  check('the jet tour reaches the far east and south, well above the ground', tour.maxX > 300 && tour.maxZ > 300 && tour.minClear >= 6, tour);

  // A non-owner is kept out of the moved cottage.
  await play(a); await wait(600);
  await a.evaluate(() => { const P = window.__isle.player; P.fly = true; P.x = 227.5; P.y = 19; P.z = 299.5; });
  await a.waitForFunction(() => window.__isle.player.x < 222, null, { timeout: 8000 }).catch(() => {});
  check('a non-owner inside the moved cottage is put back outside its gate', await a.evaluate(() => window.__isle.player.x < 222));

  // Rooms: the host's layout wins, and the server knows where everything is.
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  await c.fill('#nName', 'Gus');
  await c.fill('#nCode', code); await c.click('#nJoin');
  await c.waitForFunction(() => window.__isle.net.code);
  await c.waitForFunction(() => window.__isle.isReady() && window.__isle.layout() === 'spread', null, { timeout: 120000 }).catch(() => {});
  check('a guest from the classic layout switches to the host’s spread layout', await c.evaluate(() => window.__isle.layout() === 'spread'));
  check('and sees the cottage at its new spot', (await get(c, 233, 20, 292)) === WHITE && (await get(c, 121, 20, 64)) !== WHITE);
  await raw(a, 233, 20, 292, 0); await wait(500);
  check('the server stops even the host changing the moved frame', (await get(c, 233, 20, 292)) === WHITE);
  check('the host builds on the old cottage spot', await set(a, 121, 21, 64, STONE));
  await c.waitForFunction(() => window.__isle.get(121, 21, 64) === 3, null, { timeout: 8000 }).catch(() => {});
  check('and the guest sees it', (await get(c, 121, 21, 64)) === STONE);
  await c.evaluate(() => document.getElementById('nLeave') && document.getElementById('nLeave').click());
  await c.waitForFunction(() => !window.__isle.net.code && window.__isle.layout() === 'classic', null, { timeout: 120000 }).catch(() => {});
  check('leaving the room returns the guest to their own layout', await c.evaluate(() => window.__isle.layout() === 'classic'));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
