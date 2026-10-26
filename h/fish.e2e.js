// Fishing off the jet docks, the fish book, and the island map. Real Chromium pages.
// Run: node h/fish.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18220, URL = 'http://localhost:' + PORT + '/';
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } });
  const open = async (name, c) => {
    const page = await (c || await browser.newContext({ viewport: { width: 900, height: 700 } })).newPage();
    page.on('pageerror', (e) => { console.log((name || 'page') + ' pageerror', e.message); fails++; });
    await page.goto(URL);
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
    if (name) await page.fill('#nName', name);
    return page;
  };
  const play = async (p) => { await p.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); }); await p.waitForFunction(() => document.getElementById('overlay').classList.contains('hidden'), null, { timeout: 10000 }).catch(() => {}); };
  // stand at the sea end of a dock, facing out to sea
  const onDock = (p, i) => p.evaluate((i) => { const I = window.__isle, d = I.docks[i], P = I.player; P.fly = false; P.x = d.cx + Math.cos(d.out) * 4; P.z = d.cz + Math.sin(d.out) * 4; P.y = d.top; P.vx = P.vy = P.vz = 0; P.yaw = Math.atan2(-Math.cos(d.out), -Math.sin(d.out)); P.pitch = -0.3; }, i);
  const hint = (p) => p.textContent('#jethint');

  const a = await open(null, ctx);
  const fish = await a.evaluate(() => window.__isle.fish.all.map((f) => [f.id, f.r, f.dock || null]));
  check('twelve fish in four rarities, with a rare one for each dock', fish.length === 12 && [0, 1, 2, 3].every((r) => fish.some((f) => f[1] === r)) && ['east', 'north', 'south', 'west'].every((d) => fish.some((f) => f[2] === d)), fish);
  const rolls = await a.evaluate(() => { const I = window.__isle, n = { east: 0, west: 0 }, r = [0, 0, 0, 0]; for (let k = 0; k < 4000; k++) { const f = I.fish.roll('north'); r[f.r]++; if (f.dock === 'east') n.east++; if (f.dock === 'west') n.west++; } return { r, n }; });
  check('common fish bite most, legendary ones hardly ever, and dock fish only at their dock', rolls.r[0] > rolls.r[1] && rolls.r[1] > rolls.r[2] && rolls.r[2] > rolls.r[3] && rolls.r[3] > 0 && rolls.n.east === 0 && rolls.n.west === 0, rolls);
  check('the fish book starts empty, with a hint for each fish', /0 of 12/.test(await a.textContent('#fishCount')) && (await a.$$('#fishBook .fish')).length === 12);

  await play(a); await wait(400);
  await a.keyboard.press('KeyQ'); await wait(300);
  check('away from a dock, Q says where to fish', /jet docks to fish/.test(await a.textContent('#toast')));
  await onDock(a, 1); await wait(500);
  check('on a dock the hint offers fishing', /Q<\/b> to fish|Q to fish/.test(await a.evaluate(() => document.getElementById('jethint').innerHTML)), await hint(a));
  await a.keyboard.press('KeyQ'); await wait(300);
  check('Q casts the line onto the water', (await a.evaluate(() => window.__isle.fish.state())) && (await a.evaluate(() => window.__isle.fish.state().phase)) === 'wait');
  await a.keyboard.press('KeyQ'); await wait(300);
  check('reeling in too soon catches nothing', !(await a.evaluate(() => window.__isle.fish.state())) && /Nothing yet/.test(await a.textContent('#toast')));
  await a.keyboard.press('KeyQ'); await wait(200);
  await a.evaluate(() => window.__isle.fish.bite());
  await a.waitForFunction(() => { const s = window.__isle.fish.state(); return s && s.phase === 'bite'; }, null, { timeout: 8000 }).catch(() => {});
  check('when the bobber dips the hint says reel it in', /a bite/.test(await hint(a)));
  await a.keyboard.press('KeyQ'); await wait(400);
  const book = await a.evaluate(() => window.__isle.fish.book());
  check('Q in time catches a fish', Object.keys(book).length === 1 && /You caught a/.test(await a.textContent('#toast')), book);
  check('and it goes in the fish book', /1 of 12/.test(await a.textContent('#fishCount')) && (await a.$$('#fishBook .fish.got')).length === 1);
  for (let k = 0; k < 6; k++) { await a.keyboard.press('KeyQ'); await wait(100); await a.evaluate(() => window.__isle.fish.bite()); await a.waitForFunction(() => { const s = window.__isle.fish.state(); return s && s.phase === 'bite'; }, null, { timeout: 8000 }).catch(() => {}); await a.keyboard.press('KeyQ'); await wait(150); }
  const n = await a.evaluate(() => Object.values(window.__isle.fish.book()).reduce((s, v) => s + v, 0));
  check('you can keep fishing', n === 7, n);
  const a2 = await open(null, ctx);
  check('the fish book is kept after a reload', (await a2.evaluate(() => Object.values(window.__isle.fish.book()).reduce((s, v) => s + v, 0))) === 7);
  await a2.close();
  await a.keyboard.press('KeyQ'); await wait(200);
  await a.evaluate(() => { const P = window.__isle.player; P.x += 9; }); await wait(400);
  check('walking away snaps the line', !(await a.evaluate(() => window.__isle.fish.state())));

  // The map.
  await a.keyboard.press('KeyM'); await wait(500);
  check('M opens the island map', await a.evaluate(() => window.__isle.map.open() && !document.getElementById('map').hidden));
  const places = await a.evaluate(() => window.__isle.map.places().map((p) => p[0]));
  check('it marks the homes, the campsite and every dock', ['treehouse', 'cottage', 'paddock', 'Campsite', 'den', 'Goldie', 'East Beach', 'North Shore', 'South Shore', 'West Bay'].every((w) => places.some((p) => p.indexOf(w) >= 0)), places);
  const px = await a.evaluate(() => { const c = document.getElementById('mapCanvas').getContext('2d'), I = window.__isle, k = 704 / 352, d = c.getImageData(Math.round(I.player.x * k), Math.round(I.player.z * k), 1, 1).data; const sea = c.getImageData(4, 4, 1, 1).data; return { me: [d[0], d[1], d[2]], sea: [sea[0], sea[1], sea[2]] }; });
  check('with the land drawn, and you on it', px.sea[2] > px.sea[0] && px.me[0] > 200 && px.me[1] > 180, px);
  if (process.env.SHOTS) await a.screenshot({ path: process.env.SHOTS + '/map.png' });
  await a.keyboard.press('KeyM'); await wait(200);
  check('M again closes it', await a.evaluate(() => !window.__isle.map.open()));

  // Rooms: others see your fishing line.
  await onDock(a, 1);
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  await play(g); await play(a); await wait(500);
  await onDock(a, 1); await wait(300);
  await a.keyboard.press('KeyQ');
  await g.waitForFunction(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.fish && p.fish.g.visible) ok = true; }); return ok; }, null, { timeout: 8000 }).catch(() => {});
  check('a guest sees the host’s fishing line', await g.evaluate(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.fish && p.fish.g.visible) ok = true; }); return ok; }));
  await g.keyboard.press('KeyM'); await wait(600);
  check('and the host on the guest’s map', await g.evaluate(() => window.__isle.map.open()));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
