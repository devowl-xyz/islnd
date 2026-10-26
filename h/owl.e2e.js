// Hoot and Snowy's power: the owl lift. Real Chromium pages.
// Run: node h/owl.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18210, URL = 'http://localhost:' + PORT + '/?layout=classic';
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const open = async (name) => {
    const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
    page.on('pageerror', (e) => { console.log((name || 'page') + ' pageerror', e.message); fails++; });
    await page.goto(URL);
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
    if (name) await page.fill('#nName', name);
    return page;
  };
  const play = async (p) => { await p.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); }); await p.waitForFunction(() => document.getElementById('overlay').classList.contains('hidden'), null, { timeout: 10000 }).catch(() => {}); };
  const adopt = (p, id) => p.evaluate((id) => window.__isle.pets.adopt(id), id);
  const pose = (p, x, y, z) => p.evaluate(([x, y, z]) => { const P = window.__isle.player; P.fly = false; P.x = x; P.y = y; P.z = z; P.vx = P.vy = P.vz = 0; }, [x, y, z]);
  const P = (p) => p.evaluate(() => { const P = window.__isle.player; return { x: P.x, y: P.y, z: P.z, ground: P.onGround }; });
  const lift = (p) => p.evaluate(() => window.__isle.owl.state());

  const a = await open();
  await play(a); await wait(400);
  await pose(a, 80.5, 13, 96.5); await wait(600);
  await a.keyboard.press('KeyT'); await wait(300);
  check('without an owl, T just says which pets have powers', !(await lift(a)) && /power on T/.test(await a.textContent('#toast')));
  check('adopting Hoot', await adopt(a, 'hoot'));
  await pose(a, 80.5, 13, 96.5); await wait(1500);
  await a.keyboard.press('KeyT'); await wait(300);
  check('T: Hoot lifts you into the sky', (await lift(a)) && (await lift(a)).phase === 'up' && /lifts you/.test(await a.textContent('#toast')));
  const y0 = (await P(a)).y;
  await a.keyboard.down('Space'); await a.waitForFunction((y0) => window.__isle.player.y > y0 + 5, y0, { timeout: 30000 }).catch(() => {}); await a.keyboard.up('Space');
  const p1 = await P(a);
  check('Space climbs', p1.y > y0 + 4, { y0, p1 });
  await a.keyboard.down('KeyW'); await a.waitForFunction((p) => Math.hypot(window.__isle.player.x - p.x, window.__isle.player.z - p.z) > 5, p1, { timeout: 30000 }).catch(() => {}); await a.keyboard.up('KeyW');
  const p2 = await P(a);
  check('and you fly wherever you look', Math.hypot(p2.x - p1.x, p2.z - p1.z) > 4 && p2.y > y0 + 3, { p1, p2 });
  check('the hint counts down the time left', /carrying you · \d+ s/.test(await a.textContent('#jethint')), await a.textContent('#jethint'));
  check('Hoot is right overhead, holding on', await a.evaluate(() => { const I = window.__isle, f = I.pets.follower(), P = I.player; return f && Math.hypot(f.x - P.x, f.z - P.z) < 1 && f.y - P.y > 1.4 && f.y - P.y < 2.6; }));
  await a.keyboard.press('KeyT'); await wait(300);
  check('T again: Hoot glides you back down', ((await lift(a)) || {}).phase === 'glide', { lift: await lift(a), p: await P(a), toast: await a.textContent('#toast') });
  const g0 = await P(a); await wait(1000); const g1 = await P(a);
  check('gently', g1.y < g0.y && g0.y - g1.y < 5, { g0, g1 });
  await a.waitForFunction(() => !window.__isle.owl.state(), null, { timeout: 40000 }).catch(() => {});
  check('and sets you down on the ground', !(await lift(a)) && (await P(a)).ground);

  await a.keyboard.press('KeyT'); await wait(300);
  const yy = (await P(a)).y;
  await a.keyboard.down('Space'); await a.waitForFunction((y0) => window.__isle.player.y > y0 + 5, yy, { timeout: 30000 }).catch(() => {}); await a.keyboard.up('Space');
  await a.evaluate(() => window.__isle.owl.age(31)); await wait(800);
  check('after 30 seconds Hoot gets tired and lets you down', ((await lift(a)) || {}).phase === 'glide' && /tired/.test(await a.textContent('#toast')));
  await a.waitForFunction(() => !window.__isle.owl.state(), null, { timeout: 40000 }).catch(() => {});

  // Hoot's own power: owl eyes.
  await a.evaluate(() => { const P = window.__isle.player; P.fly = true; P.x = 80.5; P.y = 5; P.z = 50.5; P.vx = P.vy = P.vz = 0; });
  await a.keyboard.press('KeyG'); await wait(300);
  check('G: Hoot’s Owl Eyes', await a.evaluate(() => window.__isle.owl.eyes()) && /Owl Eyes/.test(await a.textContent('#toast')));
  await a.waitForFunction(() => window.__isle.owl.ores() > 0 && window.__isle.owl.lift2() > 0.5, null, { timeout: 15000 }).catch(() => {});
  check('ores shine through the rock around you, and you can see in the dark', await a.evaluate(() => window.__isle.owl.ores() > 0 && window.__isle.owl.lift2() > 0.5), await a.evaluate(() => [window.__isle.owl.ores(), window.__isle.owl.lift2()]));
  await a.keyboard.press('KeyG'); await wait(200);
  check('it can’t be stacked', /already on/.test(await a.textContent('#toast')));
  await a.evaluate(() => window.__isle.owl.ageSpecial(21)); await wait(600);
  check('after 20 seconds it wears off', !(await a.evaluate(() => window.__isle.owl.eyes())));
  await a.keyboard.press('KeyG'); await wait(200);
  check('and Hoot needs a rest before the next go', /needs a rest/.test(await a.textContent('#toast')));
  await a.evaluate(() => window.__isle.owl.cool());

  // Snowy's own power: frost wings, walking on the sea.
  check('swapping to Snowy', await adopt(a, 'snowy'));
  await a.evaluate(() => { const P = window.__isle.player; P.fly = false; P.x = 160.5; P.y = 11.6; P.z = 80.5; P.vx = P.vy = P.vz = 0; });
  await a.keyboard.press('KeyG'); await wait(200);
  check('G: Snowy’s Frost Wings', await a.evaluate(() => window.__isle.owl.frost()) && /Frost Wings/.test(await a.textContent('#toast')));
  await a.waitForFunction(() => window.__isle.get(160, 10, 80) === 45 && window.__isle.player.onGround, null, { timeout: 15000 }).catch(() => {});
  check('the sea freezes under you and you stand on the ice', await a.evaluate(() => window.__isle.get(160, 10, 80) === 45 && window.__isle.player.onGround && Math.abs(window.__isle.player.y - 11) < 0.1), await a.evaluate(() => [window.__isle.get(160, 10, 80), window.__isle.player.y]));
  await a.evaluate(() => { window.__isle.player.yaw = 0; });
  await a.keyboard.down('KeyW'); await a.waitForFunction(() => Math.hypot(window.__isle.player.x - 160.5, window.__isle.player.z - 80.5) > 3, null, { timeout: 30000 }).catch(() => {}); await a.keyboard.up('KeyW');
  check('and keep walking across the water', await a.evaluate(() => window.__isle.player.y > 10.9 && Math.hypot(window.__isle.player.x - 160.5, window.__isle.player.z - 80.5) > 3), await a.evaluate(() => { const P = window.__isle.player; return [P.x, P.y, P.z, window.__isle.owl.frost()]; }));
  check('the ice is only for a while: it isn’t saved', await a.evaluate(() => !JSON.parse(localStorage.getItem('voxel-isle-edits-v3') || '[]').includes(45)));
  await a.evaluate(() => { window.__isle.owl.ageSpecial(21); }); await wait(500);
  await a.evaluate(() => { const P = window.__isle.player; P.fly = true; P.y = 16; window.__isle.owl.ageMelts(16); }); await wait(800);
  check('and melts back into the sea', await a.evaluate(() => window.__isle.get(160, 10, 80) === 12));
  await a.evaluate(() => { window.__isle.owl.cool(); window.__isle.player.fly = false; });

  // Rooms: the guest sees the host carried by Snowy.
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  await play(g); await play(a); await wait(500);
  check('the host swaps to Snowy', await adopt(a, 'snowy'));
  await pose(a, 80.5, 13, 96.5); await pose(g, 86.5, 13, 96.5); await wait(1500);
  await a.evaluate(() => window.__isle.owl.lift());
  await a.keyboard.down('Space'); await wait(1500); await a.keyboard.up('Space');
  await g.waitForFunction(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.tgt && p.tgt.lf && p.av && p.av.armL.rotation.x > 3) ok = true; }); return ok; }, null, { timeout: 10000 }).catch(() => {});
  check('the guest sees the host hanging from Snowy', await g.evaluate(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.tgt && p.tgt.lf && p.av && p.av.armL.rotation.x > 3) ok = true; }); return ok; }));
  check('with Snowy overhead', await g.evaluate(() => { const I = window.__isle; let ok = false, cur = null; I.net.peers.forEach((p) => { cur = p.cur; }); I.food.list().forEach((f) => { if (cur && f[0] !== 'me' && f[2] - cur.y > 1.4 && Math.hypot(f[1] - cur.x, f[3] - cur.z) < 1.5) ok = true; }); return ok; }));
  check('a builder can’t be lifted without an owl', !(await g.evaluate(() => window.__isle.owl.lift())));
  await a.evaluate(() => window.__isle.owl.letGo());
  await a.evaluate(() => { const P = window.__isle.player; P.fly = false; P.x = 166.5; P.y = 11.6; P.z = 82.5; P.vx = P.vy = P.vz = 0; window.__isle.owl.special(); });
  await g.waitForFunction(() => window.__isle.get(166, 10, 82) === 45, null, { timeout: 15000 }).catch(() => {});
  check('the guest sees the sea freeze under the host', await g.evaluate(() => window.__isle.get(166, 10, 82) === 45));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
