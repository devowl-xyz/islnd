// Signs, fences, the spyglass and the grappling hook, alone and in a room.
// Run: node h/build.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18350, URL = 'http://localhost:' + PORT + '/?layout=classic';
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
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 240000 });
    if (name) await page.fill('#nName', name);
    return page;
  };
  const play = async (p) => { await p.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); }); await p.waitForFunction(() => document.getElementById('overlay').classList.contains('hidden'), null, { timeout: 10000 }).catch(() => {}); };
  const put = (p, x, y, z, yaw, pitch) => p.evaluate((q) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = q[0]; P.y = q[1]; P.z = q[2]; P.yaw = q[3] || 0; P.pitch = q[4] || 0; }, [x, y, z, yaw, pitch]);
  const me = (p) => p.evaluate(() => { const P = window.__isle.player; return { x: P.x, y: P.y, z: P.z }; });
  const signs = (p) => p.evaluate(() => window.__isle.signs());

  const ctxA = await browser.newContext({ viewport: { width: 900, height: 600 } });
  let a = await open(null, ctxA);
  await play(a);
  check('signs and fences are in the block picker', await a.evaluate(() => window.__isle.picker.picks.includes(46) && window.__isle.picker.picks.includes(47)));
  // ----- Ctrl and click is a right click (in first person, looking at a known block) -----
  await a.keyboard.press('KeyV'); await wait(300);
  if (await a.evaluate(() => window.__isle.camAt().third)) { await a.keyboard.press('KeyV'); await wait(300); }
  await a.evaluate(() => { const I = window.__isle; I.setSlot(I.sel(), 8); I.setBlock(80, 13, 88, 3); });
  const look = (q) => a.evaluate((q) => { const P = window.__isle.player, ey = P.y + 1.62, dx = q[0] - P.x, dy = q[1] - ey, dz = q[2] - P.z; P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, q);
  await a.mouse.move(450, 300); await wait(200); await put(a, 80.5, 13, 91.5); await look([80.5, 14, 88.5]); await wait(500);
  await a.keyboard.down('Control'); await a.mouse.click(450, 300); await a.keyboard.up('Control'); await wait(500);
  check('Ctrl and click places a block, like a right click', (await a.evaluate(() => window.__isle.get(80, 14, 88))) === 8);
  await look([80.5, 14.5, 88.5]); await wait(400);
  await a.mouse.click(450, 300); await wait(500);
  check('and a plain click still breaks it', (await a.evaluate(() => window.__isle.get(80, 14, 88))) === 0);
  await a.evaluate(() => window.__isle.setBlock(80, 13, 88, 0));
  await a.keyboard.press('KeyV'); await wait(300);
  // ----- slabs, stairs and slides -----
  check('slabs, stairs and slides are in the block picker', await a.evaluate(() => [48, 49, 50, 54, 58].every((b) => window.__isle.picker.picks.includes(b))));
  const facing = await a.evaluate(() => { const I = window.__isle, P = I.player, out = []; for (const y of [0, -Math.PI / 2, Math.PI, Math.PI / 2]) { P.yaw = y; out.push(I.shapeOf(50), I.shapeOf(58)); } return out; });
  check('stairs and slides go down facing the way you look', facing.join() === '50,58,51,59,52,60,53,61', facing);
  await a.evaluate(() => { const I = window.__isle;
    I.setBlock(80, 13, 86, 54); I.setBlock(80, 13, 85, 3); I.setBlock(80, 14, 85, 54); I.setBlock(80, 13, 84, 3); I.setBlock(80, 14, 84, 3); I.setBlock(80, 15, 84, 54); });
  await put(a, 80.5, 13, 88.5, 0); await wait(400);
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => window.__isle.player.z < 84.8, null, { timeout: 20000 }).catch(() => {});
  await a.keyboard.up('KeyW');
  const st = await me(a);
  check('you walk straight up stairs, no jumping', st.z < 84.8 && st.y > 15.9, st);
  await a.evaluate(() => window.__isle.setBlock(84, 13, 90, 48));
  await put(a, 84.5, 13, 92.5, 0); await wait(400);
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => window.__isle.player.z < 90.7, null, { timeout: 20000 }).catch(() => {});
  await a.keyboard.up('KeyW');
  check('and up on to a slab, half a block up', Math.abs((await me(a)).y - 13.5) < 0.05, await me(a));
  await a.evaluate(() => { const I = window.__isle;
    I.setBlock(88, 13, 90, 3); I.setBlock(88, 14, 90, 3); I.setBlock(88, 15, 90, 58); I.setBlock(88, 13, 89, 3); I.setBlock(88, 14, 89, 58); I.setBlock(88, 13, 88, 58); });
  await put(a, 88.5, 16.2, 90.85, 0);
  let slid = false;
  for (let k = 0; k < 60; k++) { await wait(150); const q = await a.evaluate(() => ({ z: window.__isle.player.z, m: document.getElementById('coords').textContent })); if (/Sliding/.test(q.m)) slid = true; if (q.z < 87.6) break; }
  check('a slide sends you whizzing down it on its own', (await me(a)).z < 88 && slid, { at: await me(a), slid });
  // ----- fences -----
  await a.evaluate(() => { for (let x = 78; x <= 84; x++) window.__isle.setBlock(x, 13, 88, 47); });
  check('fences go down', (await a.evaluate(() => [78, 81, 84].map((x) => window.__isle.get(x, 13, 88)))).join() === '47,47,47');
  await put(a, 81.5, 13, 91.5, 0); await wait(300);
  await a.keyboard.down('KeyW');
  for (let k = 0; k < 6; k++) { await a.keyboard.press('Space'); await wait(350); }
  await a.keyboard.up('KeyW');
  const f1 = await me(a);
  check('you can’t walk or jump over a fence', f1.z > 88.9, f1);
  await put(a, 81.5, 15, 88.5, 0);
  await a.waitForFunction(() => { const P = window.__isle.player; return P.onGround && P.y < 14.9; }, null, { timeout: 10000 }).catch(() => {});
  const f2 = await me(a);
  check('but you can stand on top of one, a block and a half up', Math.abs(f2.y - 14.5) < 0.05, f2);
  // ----- signs -----
  await a.evaluate(() => window.__isle.setBlock(86, 13, 90, 46));
  await put(a, 86.5, 13, 92.5, 0); await wait(200);
  await a.evaluate(() => window.__isle.signEdit(86, 13, 90));
  await wait(200);
  check('a sign asks what it should say', await a.evaluate(() => !document.getElementById('chatIn').hidden && /sign/.test(document.getElementById('chatIn').placeholder)));
  await a.keyboard.type('Welcome to the meadow'); await a.keyboard.press('Enter'); await wait(500);
  const i0 = (13 * 352 + 90) * 352 + 86;
  check('and then says it', (await signs(a)).some((q) => q[0] === i0 && q[1] === 'Welcome to the meadow') && !(await a.evaluate(() => window.__isle.chatLines().some((l) => /Welcome to the meadow/.test(l)))));
  await a.waitForFunction(() => window.__isle.signFx() > 0, null, { timeout: 5000 }).catch(() => {});
  check('with the words painted on it', (await a.evaluate(() => window.__isle.signFx())) > 0);
  check('you can walk through a sign post', await a.evaluate(() => { const P = window.__isle.player; P.x = 86.5; P.y = 13; P.z = 90.5; return window.__isle.roomy(); }));
  await a.close();
  a = await open(null, ctxA); await play(a);
  check('the words stay after a reload', (await signs(a)).some((q) => q[0] === i0 && q[1] === 'Welcome to the meadow'), await signs(a));
  await a.evaluate(() => window.__isle.setBlock(86, 13, 90, 0));
  check('break the sign and its words go too', !(await signs(a)).some((q) => q[0] === i0));
  // ----- the spyglass -----
  await put(a, 80.5, 13, 92.5, 0, 0.1);
  await a.evaluate(() => window.__isle.setSkin({ pet: 'none' }));
  await a.keyboard.down('KeyZ');
  await a.waitForFunction(() => window.__isle.fov() < 20, null, { timeout: 8000 }).catch(() => {});
  check('holding Z looks through the spyglass', (await a.evaluate(() => window.__isle.fov())) < 20 && await a.evaluate(() => !document.getElementById('spy').hidden));
  await a.keyboard.up('KeyZ');
  await a.waitForFunction(() => window.__isle.fov() > 70, null, { timeout: 8000 }).catch(() => {});
  check('and letting go puts it away', (await a.evaluate(() => window.__isle.fov())) > 70);
  for (const [pet, who] of [['goldie', 'Goldie'], ['horse', 'Clover']]) {
    await a.evaluate((p) => window.__isle.setSkin({ pet: p }), pet);
    await a.keyboard.down('KeyZ'); await wait(600);
    const f = await a.evaluate(() => window.__isle.fov());
    await a.keyboard.up('KeyZ');
    check(who + '’s owner can’t use the spyglass', f > 70 && new RegExp(who + '’s owner can’t use the spyglass').test(await a.textContent('#toast')));
  }
  // ----- the grappling hook -----
  await a.evaluate(() => { const I = window.__isle; for (let x = 77; x <= 84; x++) for (let y = 13; y <= 20; y++) I.setBlock(x, y, 76, 3); });
  await a.evaluate(() => window.__isle.setSkin({ pet: 'none' }));
  await put(a, 80.5, 13, 94.5, 0, 0.25); await wait(300);
  await a.keyboard.press('KeyC'); await wait(300);
  check('only owl owners have a grappling hook', !(await a.evaluate(() => window.__isle.grap())) && /Only Hoot’s and Snowy’s owners have a grappling hook/.test(await a.textContent('#toast')));
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  await put(a, 80.5, 13, 94.5, 0, 0.25); await wait(300);
  await a.keyboard.press('KeyC');
  await a.waitForFunction(() => { const g = window.__isle.grap(); return g && g.phase === 'pull'; }, null, { timeout: 8000 }).catch(() => {});
  const g0 = await a.evaluate(() => window.__isle.grap());
  check('C shoots the hook into the wall you look at', g0 && g0.phase === 'pull' && Math.abs(g0.z - 77) < 0.6, g0);
  await a.waitForFunction(() => !window.__isle.grap(), null, { timeout: 20000 }).catch(() => {});
  const g1 = await me(a);
  check('and reels you in to it', g1.z < 80 && g1.y > 14, g1);
  await put(a, 80.5, 13, 94.5, 0, 0.25); await wait(300);
  await a.keyboard.press('KeyC');
  await a.waitForFunction(() => { const g = window.__isle.grap(); return g && g.phase === 'pull'; }, null, { timeout: 8000 }).catch(() => {});
  await wait(200);
  await a.keyboard.press('KeyC'); await wait(200);
  check('C again lets go', !(await a.evaluate(() => window.__isle.grap())));
  // a long way off: a slab hanging in the sky 130 blocks north
  await a.evaluate(() => { const I = window.__isle; for (let x = 77; x <= 84; x++) for (let y = 58; y <= 66; y++) I.setBlock(x, y, 20, 3); });
  await a.evaluate(() => { const P = window.__isle.player; P.fly = true; P.x = 80.5; P.y = 61; P.z = 150.5; P.yaw = 0; P.pitch = 0; P.vx = P.vy = P.vz = 0; });
  await wait(300);
  await a.keyboard.press('KeyC');
  await a.waitForFunction(() => { const g = window.__isle.grap(); return g && g.phase === 'pull'; }, null, { timeout: 15000 }).catch(() => {});
  const gf = await a.evaluate(() => window.__isle.grap());
  check('the hook reaches a long way: it catches on a wall 130 blocks off', gf && gf.phase === 'pull' && Math.abs(gf.z - 21) < 0.6, gf);
  await a.waitForFunction(() => !window.__isle.grap(), null, { timeout: 60000 }).catch(() => {});
  check('and reels you all the way there', (await me(a)).z < 25, await me(a));
  await put(a, 80.5, 13, 94.5, 0, 1.2); await wait(300);
  await a.keyboard.press('KeyC');
  await a.waitForFunction(() => !window.__isle.grap(), null, { timeout: 10000 }).catch(() => {});
  check('aimed at the empty sky it comes back', /Nothing to hook on to/.test(await a.textContent('#toast')));

  // ----- the hook catches the helicopter, the jet and the jet skis, and you climb aboard -----
  const aimAt = (x, y, z) => a.evaluate((q) => { const P = window.__isle.player, ey = P.y + 1.62, dx = q[0] - P.x, dy = q[1] - ey, dz = q[2] - P.z; P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, [x, y, z]);
  await a.evaluate(() => { const I = window.__isle; I.setSkin({ pet: 'hoot' }); I.heli.put(80.5, 22, 79.5, 0); });
  await put(a, 80.5, 13, 92.5); await wait(300);
  await aimAt(80.7, 23.6, 79.5);
  await a.keyboard.press('KeyC');
  await a.waitForFunction(() => { const g = window.__isle.grap(); return g && g.veh === 'heli'; }, null, { timeout: 8000 }).catch(() => {});
  check('the hook catches on the helicopter', (await a.evaluate(() => (window.__isle.grap() || {}).veh)) === 'heli');
  await a.waitForFunction(() => window.__isle.heli.state().seat, null, { timeout: 30000 }).catch(() => {});
  check('and reels you in to fly it', await a.evaluate(() => window.__isle.heli.state().seat));
  await a.evaluate(() => { const I = window.__isle; I.heli.leave(); I.noChute(); I.heli.put(295.5, 12, 34.5, -Math.PI / 2); });
  await put(a, 80.5, 13, 92.5, 0); await wait(300);
  await a.evaluate(() => window.__isle.cmd('/spawn jet')); await wait(500);
  const jp = await a.evaluate(() => Object.assign({}, window.__isle.jet.pose));
  await aimAt(jp.x, jp.y, jp.z);
  await a.keyboard.press('KeyC');
  await a.waitForFunction(() => { const g = window.__isle.grap(); return g && g.veh === 'jet'; }, null, { timeout: 8000 }).catch(() => {});
  check('the hook catches on the jet', (await a.evaluate(() => (window.__isle.grap() || {}).veh)) === 'jet');
  await a.waitForFunction(() => !!window.__isle.jet.seat, null, { timeout: 30000 }).catch(() => {});
  check('and you climb aboard', (await a.evaluate(() => window.__isle.jet.seat)) === 1);
  await a.keyboard.press('KeyE'); await wait(300);
  await a.evaluate(() => window.__isle.cmd('/despawn jet'));
  const sk = await a.evaluate(() => window.__isle.skis.list()[4]);
  await put(a, sk.x - 6, 11.2, 219.5); await wait(500);
  await aimAt(sk.x, 11, sk.z);
  await a.keyboard.press('KeyC');
  await a.waitForFunction(() => { const g = window.__isle.grap(); return g && g.veh === 'ski'; }, null, { timeout: 8000 }).catch(() => {});
  check('the hook catches on a jet ski', (await a.evaluate(() => (window.__isle.grap() || {}).veh)) === 'ski');
  await a.waitForFunction(() => window.__isle.skis.mine() !== null, null, { timeout: 30000 }).catch(() => {});
  check('and you hop on', (await a.evaluate(() => window.__isle.skis.mine())) !== null);
  await a.keyboard.press('KeyE'); await wait(300);
  await a.evaluate(() => window.__isle.cmd('/despawn skis'));

  // ----- in a room -----
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 240000 });
  await play(g); await play(a);
  await a.evaluate(() => window.__isle.setBlock(83, 13, 92, 46)); await wait(500);
  await put(a, 83.5, 13, 94.5, 0);
  await a.evaluate(() => window.__isle.signEdit(83, 13, 92)); await wait(200);
  await a.keyboard.type('Room rules: be kind'); await a.keyboard.press('Enter');
  const i1 = (13 * 352 + 92) * 352 + 83;
  await g.waitForFunction((i) => window.__isle.signs().some((q) => q[0] === i && q[1] === 'Room rules: be kind'), i1, { timeout: 8000 }).catch(() => {});
  check('in a room everyone reads the same sign', (await signs(g)).some((q) => q[0] === i1 && q[1] === 'Room rules: be kind'), await signs(g));
  await g.evaluate((i) => window.__isle.net.ws.send(JSON.stringify({ t: 'sign', i: (13 * 352 + 50) * 352 + 50, text: 'sneaky', r: 0 })), i1);
  await wait(600);
  check('and the room turns down words for a sign that isn’t there', !(await signs(a)).some((q) => q[1] === 'sneaky'));
  const g2 = await open('Pip');
  await g2.fill('#nCode', code); await g2.click('#nJoin');
  await g2.waitForFunction(() => window.__isle.net.code);
  await g2.waitForFunction(() => window.__isle.isReady(), null, { timeout: 240000 });
  await g2.waitForFunction((i) => window.__isle.signs().some((q) => q[0] === i), i1, { timeout: 15000 }).catch(() => {});
  check('someone who joins later reads it too', (await signs(g2)).some((q) => q[0] === i1 && q[1] === 'Room rules: be kind'));
  await g2.close();
  await a.evaluate(() => window.__isle.setSkin({ pet: 'none' }));
  await a.keyboard.down('KeyZ');
  await g.waitForFunction(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Pip'); return p && p.av && p.av.spy && p.av.spy.visible; }, null, { timeout: 8000 }).catch(() => {});
  check('others see you with the spyglass to your eye', await g.evaluate(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Pip'); return !!(p && p.av && p.av.spy && p.av.spy.visible); }));
  await a.keyboard.up('KeyZ');
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  await wait(400);
  await put(a, 80.5, 13, 94.5, 0, 0.25); await wait(300);
  await a.keyboard.press('KeyC');
  await g.waitForFunction(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Pip'); return p && p.grapFx && p.grapFx.line.visible; }, null, { timeout: 8000 }).catch(() => {});
  check('and your grappling hook’s rope', await g.evaluate(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Pip'); return !!(p && p.grapFx && p.grapFx.line.visible); }));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
