// Goldie's and Cinder's powers. Real Chromium pages.
// Run: node h/powers.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18240, URL = 'http://localhost:' + PORT + '/?layout=classic';
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
  const P = (p) => p.evaluate(() => { const P = window.__isle.player; return { x: P.x, y: P.y, z: P.z, vy: P.vy, g: P.onGround }; });
  const pose = (p, x, y, z, yaw) => p.evaluate(([x, y, z, yaw]) => { const P = window.__isle.player; P.fly = false; P.x = x; P.y = y; P.z = z; P.yaw = yaw; P.pitch = 0; P.vx = P.vy = P.vz = 0; }, [x, y, z, yaw]);

  const a = await open();
  await play(a); await wait(400);
  check('adopting Goldie', await a.evaluate(() => window.__isle.pets.adopt('goldie')));

  // Goldie: bubble dash. Swim underwater east of the dock, out in the sea.
  await pose(a, 162.5, 6, 80.5, -Math.PI / 2); await wait(800);
  await a.keyboard.down('KeyW'); await wait(1500);
  const s0 = await P(a); await wait(1500); const s1 = await P(a); await a.keyboard.up('KeyW');
  const plain = Math.hypot(s1.x - s0.x, s1.z - s0.z);
  await pose(a, 162.5, 6, 84.5, -Math.PI / 2); await wait(500);
  await a.keyboard.press('KeyT'); await wait(300);
  check('T: Goldie’s Bubble Dash', await a.evaluate(() => window.__isle.power.dash()) && /Bubble Dash/.test(await a.textContent('#toast')));
  await a.keyboard.down('KeyW'); await wait(1500);
  const d0 = await P(a); await wait(1500); const d1 = await P(a); await a.keyboard.up('KeyW');
  const fast = Math.hypot(d1.x - d0.x, d1.z - d0.z);
  check('you swim much faster with Goldie', fast > plain * 2, { plain, fast });
  check('Goldie leads the way', await a.evaluate(() => { const I = window.__isle, f = I.pets.follower(), P = I.player; return f && Math.hypot(f.x - P.x, f.z - P.z) < 3; }));
  await a.keyboard.down('Shift'); await wait(900); await a.keyboard.up('Shift');
  const dn = await P(a);
  await a.keyboard.down('Space');
  await a.waitForFunction(() => window.__isle.player.y > 12, null, { timeout: 20000 }).catch(() => {});
  await a.keyboard.up('Space');
  const up = await P(a);
  check('Space swims up and leaps right out of the sea', up.y > 12, { dn, up });
  await a.evaluate(() => window.__isle.power.ageDash(31)); await wait(500);
  check('after 30 seconds the bubble pops', !(await a.evaluate(() => window.__isle.power.dash())));

  // Goldie: lucky fin.
  await a.keyboard.press('KeyG'); await wait(200);
  check('G: Lucky Fin for five casts', (await a.evaluate(() => window.__isle.power.luck())) === 5);
  await a.evaluate(() => { const I = window.__isle, d = I.docks[0], P = I.player; P.fly = false; P.x = d.cx + 4; P.z = d.cz; P.y = d.top; P.vx = P.vy = P.vz = 0; P.yaw = -Math.PI / 2; P.pitch = -0.3; });
  await wait(400);
  await a.keyboard.press('KeyQ');
  const t0 = Date.now();
  // reel in the moment it bites (the test browser draws slowly, so a key press could miss the bite)
  await a.waitForFunction(() => { const I = window.__isle, s = I.fish.state(); if (s && s.phase === 'bite') { I.fish.cast(); return true; } return false; }, null, { timeout: 15000, polling: 'raf' }).catch(() => {});
  check('with Lucky Fin a fish bites almost at once', Date.now() - t0 < 5000, Date.now() - t0);
  await wait(300);
  check('and each catch uses one', (await a.evaluate(() => window.__isle.power.luck())) === 4 && /Lucky Fin: 4 left/.test(await a.textContent('#toast')), [await a.evaluate(() => window.__isle.power.luck()), await a.textContent('#toast'), await a.evaluate(() => window.__isle.fish.state())]);
  const rare = await a.evaluate(() => { const I = window.__isle; let n = 0, m = 0; for (let k = 0; k < 3000; k++) { if (I.fish.roll('east', true).r >= 2) n++; if (I.fish.roll('east', false).r >= 2) m++; } return { lucky: n, plain: m }; });
  check('rare fish are much more likely', rare.lucky > rare.plain * 2, rare);
  await a.keyboard.press('KeyG'); await wait(200);
  check('Goldie needs a rest before the next Lucky Fin', /needs a rest/.test(await a.textContent('#toast')));

  // Cinder: dragon flight and fire breath.
  await a.evaluate(() => { const I = window.__isle, h = I.pets.home.cinder, P = I.player; P.x = h.x - 1; P.y = h.y; P.z = h.z; I.pets.adopt('cinder'); });
  await pose(a, 80.5, 13, 96.5, 0); await wait(1500);
  await a.keyboard.press('KeyT'); await wait(300);
  check('T: you climb on Cinder and take off', await a.evaluate(() => { const s = window.__isle.owl.state(); return s && s.phase === 'up'; }) && /Cinder/.test(await a.textContent('#toast')));
  const y0 = (await P(a)).y;
  await a.keyboard.down('Space'); await a.waitForFunction((y) => window.__isle.player.y > y + 5, y0, { timeout: 30000 }).catch(() => {}); await a.keyboard.up('Space');
  const f0 = await P(a);
  await a.keyboard.down('KeyW'); await a.waitForFunction((p) => Math.hypot(window.__isle.player.x - p.x, window.__isle.player.z - p.z) > 6, f0, { timeout: 30000 }).catch(() => {}); await a.keyboard.up('KeyW');
  const f1 = await P(a);
  check('and fly where you look', f0.y > y0 + 5 && Math.hypot(f1.x - f0.x, f1.z - f0.z) > 6, { y0, f0, f1 });
  check('sitting on Cinder’s back, with Cinder big beneath you', await a.evaluate(() => { const I = window.__isle, f = I.pets.follower(), P = I.player; return f && Math.hypot(f.x - P.x, f.z - P.z) < 0.5 && P.y - f.y > 0.8 && P.y - f.y < 1.6; }));
  check('the hint says you’re flying on Cinder', /Flying on Cinder/.test(await a.textContent('#jethint')));
  await a.keyboard.press('KeyT'); await wait(300);
  await a.waitForFunction(() => !window.__isle.owl.state(), null, { timeout: 40000 }).catch(() => {});
  check('T again: Cinder glides down and lands', !(await a.evaluate(() => window.__isle.owl.state())) && /Cinder lands/.test(await a.textContent('#toast')));

  await a.evaluate(() => { const I = window.__isle; I.owl.cool(); });
  // ice to melt: Snowy freezes some sea first
  await a.evaluate(() => { const I = window.__isle, P = I.player; P.fly = false; P.x = 160.5; P.y = 11; P.z = 80.5; P.yaw = 0; });
  await a.evaluate(() => { const I = window.__isle; I.pets.adopt('snowy'); I.owl.special(); });
  await a.waitForFunction(() => window.__isle.get(160, 10, 80) === 45, null, { timeout: 10000 }).catch(() => {});
  await a.evaluate(() => { const I = window.__isle; I.owl.ageSpecial(30); });
  await wait(400);
  await a.evaluate(() => { const I = window.__isle, h = I.pets.home.cinder, P = I.player, x = P.x, y = P.y, z = P.z; P.x = h.x - 1; P.y = h.y; P.z = h.z; I.pets.adopt('cinder'); P.x = x; P.y = y; P.z = z + 2; P.yaw = 0; I.owl.cool(); });
  await wait(300);
  const iceBefore = await a.evaluate(() => [window.__isle.get(160, 10, 80), window.__isle.get(160, 10, 79)]);
  await a.keyboard.press('KeyG'); await wait(1200);
  check('G: Cinder breathes fire', /breathes fire/.test(await a.textContent('#toast')) && (await a.evaluate(() => window.__isle.power.flames())) > 0);
  const iceAfter = await a.evaluate(() => [window.__isle.get(160, 10, 80), window.__isle.get(160, 10, 79)]);
  check('and the flames melt the ice in front of you', iceBefore.includes(45) && !iceAfter.includes(45), { iceBefore, iceAfter });

  // Rooms: the guest sees the host on the dragon, and the flames.
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  await play(g); await play(a); await wait(500);
  await pose(a, 80.5, 13, 96.5, 0); await pose(g, 86.5, 13, 96.5, Math.PI / 2); await wait(1200);
  await a.evaluate(() => { window.__isle.owl.cool(); window.__isle.power.G(); });
  await g.waitForFunction(() => window.__isle.power.flames() > 0, null, { timeout: 8000 }).catch(() => {});
  check('the guest sees the host breathe fire', (await g.evaluate(() => window.__isle.power.flames())) > 0);
  await a.evaluate(() => window.__isle.power.T());
  await a.keyboard.down('Space'); await wait(1200); await a.keyboard.up('Space');
  await g.waitForFunction(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.tgt && p.tgt.lf && p.av && p.av.legL.rotation.z) ok = true; }); return ok; }, null, { timeout: 10000 }).catch(() => {});
  check('and riding Cinder through the sky', await g.evaluate(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.tgt && p.tgt.lf && p.av && p.av.legL.rotation.z) ok = true; }); return ok; }));
  check('the guest has no power without a pet', !(await g.evaluate(() => window.__isle.power.T())) && !(await g.evaluate(() => window.__isle.power.G())));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
