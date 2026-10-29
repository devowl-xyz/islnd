// Rides: the five jet skis at the campsite jetty, the cable car from the southern summit down to
// Biscuit and Mochi's cottage, and the parachute, alone and in a room.
// Run: node h/rides.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18330, URL = 'http://localhost:' + PORT + '/';
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const open = async (name, ctx) => {
    ctx = ctx || await browser.newContext({ viewport: { width: 900, height: 600 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { console.log((name || 'page') + ' pageerror', e.message); fails++; });
    await page.goto(URL);
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 300000 });
    if (name) await page.fill('#nName', name);
    return page;
  };
  const play = async (p) => { await p.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); }); await p.waitForFunction(() => document.getElementById('overlay').classList.contains('hidden'), null, { timeout: 10000 }).catch(() => {}); };
  const me = (p) => p.evaluate(() => { const P = window.__isle.player; return { x: P.x, y: P.y, z: P.z, vy: P.vy, fly: P.fly }; });
  const skis = (p) => p.evaluate(() => window.__isle.skis.list());
  const hint = (p) => p.evaluate(() => document.getElementById('jethint').textContent);
  const put = (p, x, y, z, yaw) => p.evaluate((q) => { const P = window.__isle.player; window.__isle.noChute(); P.fly = false; P.vx = P.vy = P.vz = 0; P.x = q[0]; P.y = q[1]; P.z = q[2]; P.yaw = q[3] || 0; }, [x, y, z, yaw]);

  const ctxA = await browser.newContext({ viewport: { width: 900, height: 600 } });
  let a = await open(null, ctxA);
  await play(a);
  // ----- jet skis -----
  const s0 = await skis(a);
  const home = await a.evaluate(() => window.__isle.skis.home);
  check('five jet skis are moored at the campsite jetty', s0.length === 5 && s0.every((s, k) => Math.hypot(s.x - home[k][0], s.z - home[k][1]) < 0.01));
  check('all on the water', await a.evaluate(() => window.__isle.skis.list().every((s) => window.__isle.skis.water(s.x, s.z))));
  check('the steps from the camp come down to the jetty', (await a.evaluate(() => [window.__isle.get(197, 11, 219), window.__isle.get(202, 16, 219), window.__isle.get(190, 10, 219)])).join() === '23,23,7');
  await put(a, 187.5, 11.2, 219.5, Math.PI); await wait(800);
  check('standing on the jetty, one is in reach', (await a.evaluate(() => window.__isle.skis.near())) === 0 && /ride the jet ski/.test(await hint(a)), await hint(a));
  await a.keyboard.press('KeyE'); await wait(400);
  check('E gets on', (await a.evaluate(() => window.__isle.skis.mine())) === 0 && /throttle/.test(await hint(a)));
  await a.keyboard.down('KeyA'); await wait(900); await a.keyboard.up('KeyA');
  const h1 = (await skis(a))[0].h;
  check('A steers', h1 < Math.PI / 2 - 0.05, h1);
  await a.evaluate(() => { const s = window.__isle.skis.list(); });
  await a.keyboard.down('KeyW'); await wait(2500); await a.keyboard.up('KeyW');
  const s1 = (await skis(a))[0];
  check('W drives it along', Math.hypot(s1.x - home[0][0], s1.z - home[0][1]) > 2 && s1.rider === -1, s1);
  check('and it stays on the water', await a.evaluate(() => { const s = window.__isle.skis.list()[0]; return window.__isle.skis.water(s.x, s.z); }));
  const pr = await me(a);
  check('with you on board', Math.hypot(pr.x - s1.x, pr.z - s1.z) < 1 && pr.y > 10.5 && pr.y < 12, { pr, s1 });
  await a.keyboard.down('KeyW'); await wait(4000); await a.keyboard.up('KeyW');
  check('it can’t drive up on to the land', await a.evaluate(() => { const s = window.__isle.skis.list()[0]; return window.__isle.skis.water(s.x, s.z); }));
  await a.keyboard.press('KeyE'); await wait(400);
  const s2 = (await skis(a))[0];
  check('E gets off, and it stays where you left it', (await a.evaluate(() => window.__isle.skis.mine())) === null && s2.rider === null && Math.hypot(s2.x - home[0][0], s2.z - home[0][1]) > 2);
  await a.close();
  a = await open(null, ctxA); await play(a);
  const s3 = (await skis(a))[0];
  check('even after a reload', Math.hypot(s3.x - s2.x, s3.z - s2.z) < 0.05, { s2, s3 });
  await a.evaluate(() => window.__isle.cmd('/despawn skis'));
  check('/despawn skis sends them back to the jetty', Math.hypot((await skis(a))[0].x - home[0][0], (await skis(a))[0].z - home[0][1]) < 0.01);

  // ----- the helicopter's rope lifts jet skis -----
  const sk2 = (await skis(a))[2];
  await a.evaluate((q) => { const I = window.__isle, P = I.player; I.setSkin({ pet: 'hoot' }); I.heli.put(q.x, 22, q.z, 0); P.fly = true; P.x = q.x; P.y = 23; P.z = q.z + 1; I.heli.board(); I.heli.put(q.x, 22, q.z, 0); }, sk2);
  await wait(400);
  await a.keyboard.press('KeyH');
  await a.waitForFunction(() => window.__isle.heli.state().skis.includes(2), null, { timeout: 30000 }).catch(() => {});
  check('the helicopter’s rope lifts a jet ski', (await a.evaluate(() => window.__isle.heli.state().skis)).includes(2) && /Got the green jet ski/.test(await a.textContent('#toast')));
  await a.evaluate(() => window.__isle.heli.put(150.5, 30, 170.5, 0));
  await wait(1500);
  const hang = (await skis(a))[2];
  check('and carries it off', Math.hypot(hang.x - 150.5, hang.z - 170.5) < 1.5, hang);
  await a.keyboard.press('KeyJ');
  await a.waitForFunction(() => !window.__isle.heli.state().skis.length, null, { timeout: 8000 }).catch(() => {});
  const dropped = (await skis(a))[2];
  const water = await a.evaluate((q) => window.__isle.skis.water(q.x, q.z), dropped);
  check('J drops it, on the water or on dry land', !(await a.evaluate(() => window.__isle.heli.state().skis.length)) && dropped.land === !water, { dropped, water });
  await a.evaluate(() => { window.__isle.heli.leave(); window.__isle.noChute(); window.__isle.heli.put(295.5, 12, 34.5, -Math.PI / 2); window.__isle.setSkin({ pet: 'none' }); window.__isle.cmd('/despawn skis'); });
  check('and /despawn skis brings it back to the jetty', !(await skis(a))[2].land && Math.hypot((await skis(a))[2].x - home[2][0], (await skis(a))[2].z - home[2][1]) < 0.01);

  // ----- the cable car -----
  const cab = await a.evaluate(() => ({ on: window.__isle.cable.on(), A: window.__isle.cable.A, B: window.__isle.cable.B }));
  check('the cable car runs (in the spread layout)', cab.on);
  check('its stations are built at the summit and by the cottage', (await a.evaluate(() => [window.__isle.get(236, 40, 259), window.__isle.get(233, 17, 282)])).join() === '7,7');
  check('and can’t be broken', !(await a.evaluate(() => window.__isle.setBlock(236, 40, 259, 0))) && /cable car station/.test(await a.textContent('#toast')));
  // wait for a cabin to be at the summit with time to get on
  await a.waitForFunction(() => [0, 1].some((k) => { const s = window.__isle.cable.state(k); return s.dock === 'top' && s.left > 4; }), null, { timeout: 70000 });
  const k = await a.evaluate(() => [0, 1].find((k) => window.__isle.cable.state(k).dock === 'top'));
  const cp = await a.evaluate((k) => window.__isle.cable.pos(k, 0), k);
  await put(a, cp.x, cp.y + 0.1, cp.z + 1.2); await wait(600);
  check('at the summit a cabin waits for you', /ride the cable car down/.test(await hint(a)), await hint(a));
  await a.keyboard.press('KeyE'); await wait(300);
  check('E gets in', !!(await a.evaluate(() => window.__isle.cable.riding())));
  await a.waitForFunction(() => window.__isle.cable.state(window.__isle.cable.riding() ? window.__isle.cable.riding().k : 0).moving, null, { timeout: 20000 }).catch(() => {});
  await wait(4000);
  const mid = await me(a);
  check('and it carries you down the rope', mid.y < 40.5 && mid.y > 18.5 && mid.z > 260 && mid.z < 282, mid);
  await a.keyboard.press('KeyE'); await wait(200);
  check('you can’t get out half way', !!(await a.evaluate(() => window.__isle.cable.riding())));
  await a.waitForFunction(() => !window.__isle.cable.riding(), null, { timeout: 40000 }).catch(() => {});
  const end = await me(a);
  check('at the bottom you step out by Biscuit and Mochi’s cottage', !(await a.evaluate(() => window.__isle.cable.riding())) && Math.hypot(end.x - 233.5, end.z - 285.5) < 1 && Math.abs(end.y - 18) < 1 && /cottage/.test(await a.textContent('#toast')), end);

  // ----- skiing -----
  const rk = await a.evaluate(() => window.__isle.racks()[0]);
  await put(a, rk[0], rk[1] + 0.1, rk[2]); await wait(600);
  check('a ski rack stands on the summit station', (await a.evaluate(() => window.__isle.rack())) === 0 && /put on skis/.test(await hint(a)), await hint(a));
  await a.keyboard.press('KeyE'); await wait(300);
  check('E puts skis on', await a.evaluate(() => window.__isle.skiing()) && /Skis on/.test(await a.textContent('#toast')));
  await a.keyboard.press('KeyE'); await wait(300);
  check('and E at the rack takes them off', !(await a.evaluate(() => window.__isle.skiing())));
  // down the snowy slope west of the summit
  await put(a, 230.5, 38.2, 259.5, Math.PI * 0.8); await wait(500);
  await a.evaluate(() => window.__isle.cmd('/ski'));
  const top = await me(a);
  await a.waitForFunction((y) => window.__isle.player.y < y - 2.5, top.y, { timeout: 30000 }).catch(() => {});
  const down = await a.evaluate(() => { const P = window.__isle.player; return { y: P.y, sp: Math.hypot(P.vx, P.vz), mode: document.getElementById('coords').textContent }; });
  check('on skis you slide away downhill on your own', down.y < top.y - 2.5 && down.sp > 2 && /Skiing/.test(down.mode), { top, down });
  await a.keyboard.down('KeyS'); await wait(2500); await a.keyboard.up('KeyS');
  check('S slows you down', (await a.evaluate(() => { const P = window.__isle.player; return Math.hypot(P.vx, P.vz); })) < Math.max(1.5, down.sp));
  await a.keyboard.press('KeyE'); await wait(300);
  check('E anywhere takes your skis off', !(await a.evaluate(() => window.__isle.skiing())));

  // ----- the helicopter's cockpit -----
  await a.evaluate(() => { const I = window.__isle, P = I.player; I.setSkin({ pet: 'hoot' }); I.heli.put(100.5, 40, 92.5, 0); P.fly = true; P.x = 100.5; P.y = 41; P.z = 93.5; I.heli.board(); });
  await wait(400);
  if ((await a.evaluate(() => window.__isle.camAt().third))) { await a.keyboard.press('KeyV'); await wait(400); }
  const ck = await a.evaluate(() => { const c = window.__isle.camAt(), h = window.__isle.heli.state(); return { c, h: { x: h.x, y: h.y, z: h.z } }; });
  check('first person in the helicopter puts your eyes in the cockpit', !ck.c.third && Math.hypot(ck.c.x - ck.h.x - 0.5, ck.c.z - ck.h.z + 0.3) < 0.6 && ck.c.y - ck.h.y > 1.8 && ck.c.y - ck.h.y < 2.4, ck);
  await a.keyboard.press('KeyV'); await wait(300);
  await a.keyboard.press('KeyH');
  await a.waitForFunction(() => window.__isle.heli.state().rope > 24, null, { timeout: 30000 }).catch(() => {});
  check('the helicopter’s rope reaches the ground from high up (well over 16 blocks)', (await a.evaluate(() => window.__isle.heli.state().rope)) > 24, await a.evaluate(() => window.__isle.heli.state().rope));
  await a.keyboard.press('KeyH');
  await a.waitForFunction(() => window.__isle.heli.state().rope < 1, null, { timeout: 30000 }).catch(() => {});
  await a.evaluate(() => window.__isle.heli.leave());

  // ----- the parachute -----
  await put(a, 80.5, 42, 92.5); await a.evaluate(() => { window.__isle.player.vy = 0; });
  await a.waitForFunction(() => window.__isle.player.vy < -8, null, { timeout: 10000 }).catch(() => {});
  await a.keyboard.press('Space'); await wait(1500);
  check('Jump while falling from high up opens the parachute', await a.evaluate(() => window.__isle.chute()) && /parachute/i.test(await a.textContent('#toast')));
  const fall = await me(a);
  check('and you drift down slowly', fall.vy > -4 && fall.vy < -2.5, fall);
  await a.waitForFunction(() => !window.__isle.chute(), null, { timeout: 150000 }).catch(() => {});
  check('it packs away when you land', !(await a.evaluate(() => window.__isle.chute())) && /land softly/.test(await a.textContent('#toast')));
  await a.evaluate(() => { const I = window.__isle, P = I.player; I.setSkin({ pet: 'hoot' }); I.heli.put(100.5, 50, 92.5, 0); P.fly = true; P.x = 100.5; P.y = 51; P.z = 93.5; I.heli.board(); });
  await wait(500);
  await a.keyboard.press('KeyE'); await wait(500);
  check('jumping out of the helicopter high up opens it by itself', await a.evaluate(() => window.__isle.chute()));
  await a.evaluate(() => window.__isle.heli.put(295.5, 12, 34.5, -Math.PI / 2));

  // ----- in a room -----
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 300000 });
  await play(g); await play(a);
  await put(a, 189.5, 11.2, 219.5, Math.PI); await put(g, 193.5, 11.2, 219.5, Math.PI); await wait(800);
  await a.keyboard.press('KeyE');
  const aid = await a.evaluate(() => window.__isle.net.you);
  await g.waitForFunction((id) => window.__isle.skis.list()[1].rider === id, aid, { timeout: 8000 }).catch(() => {});
  check('in a room everyone sees who is on a jet ski', (await skis(g))[1].rider === aid && (await a.evaluate(() => window.__isle.skis.mine())) === 1);
  const g0 = (await skis(g))[1];
  await a.keyboard.down('KeyW');
  await a.waitForFunction((q) => { const s = window.__isle.skis.list()[1]; return Math.hypot(s.x - q.x, s.z - q.z) > 3; }, g0, { timeout: 20000 }).catch(() => {});
  await a.keyboard.up('KeyW');
  await wait(1500);
  const g1 = (await skis(g))[1], a1 = (await skis(a))[1];
  check('and sees it ride about', Math.hypot(g1.x - g0.x, g1.z - g0.z) > 1 && Math.hypot(g1.x - a1.x, g1.z - a1.z) < 1.5, { g0, g1, a1 });
  await g.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'skiBoard', k: 1 })));
  await wait(800);
  check('nobody else can get on it meanwhile', (await skis(a))[1].rider === aid && /already on that jet ski/.test(await g.textContent('#toast')));
  await g.keyboard.press('KeyE');
  const gid = await g.evaluate(() => window.__isle.net.you);
  await a.waitForFunction((id) => window.__isle.skis.list()[3].rider === id, gid, { timeout: 8000 }).catch(() => {});
  check('but another one is free', (await skis(a))[3].rider === gid);
  await a.keyboard.press('KeyE');
  await g.waitForFunction(() => window.__isle.skis.list()[1].rider === null, null, { timeout: 8000 }).catch(() => {});
  check('getting off frees it for everyone', (await skis(g))[1].rider === null);
  await g.keyboard.press('KeyE'); await wait(300);
  // a parachute others can see
  await put(a, 80.5, 42, 92.5);
  await a.waitForFunction(() => window.__isle.player.vy < -8, null, { timeout: 10000 }).catch(() => {});
  await a.evaluate(() => window.__isle.openChute());
  await g.waitForFunction(() => { const p = [...window.__isle.net.peers.values()][0]; return p && p.av && p.av.chute && p.av.chute.visible; }, null, { timeout: 8000 }).catch(() => {});
  await g.waitForFunction(() => true);
  check('others see your parachute', await g.evaluate(() => { const p = [...window.__isle.net.peers.values()][0]; return !!(p && p.av && p.av.chute && p.av.chute.visible); }));

  await a.waitForFunction(() => !window.__isle.chute(), null, { timeout: 150000 }).catch(() => {});
  await a.evaluate(() => window.__isle.cmd('/ski'));
  await g.waitForFunction(() => { const p = [...window.__isle.net.peers.values()][0]; return p && p.av && p.av.skiGear && p.av.skiGear.visible; }, null, { timeout: 8000 }).catch(() => {});
  check('and your skis', await g.evaluate(() => { const p = [...window.__isle.net.peers.values()][0]; return !!(p && p.av && p.av.skiGear && p.av.skiGear.visible); }));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
