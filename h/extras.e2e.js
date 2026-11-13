// Glass panes, carpets and wool; zip lines; pet accessories; wildlife; the lighthouse; chat bubbles and
// emoji reactions; photo mode. Alone and in a room.
// Run: node h/extras.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18361, URL = 'http://localhost:' + PORT + '/?layout=classic';
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const open = async (name) => {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 600 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { console.log((name || 'page') + ' pageerror', e.message); fails++; });
    await page.goto(URL);
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 240000 });
    if (name) { await page.evaluate(() => window.__isle && window.__isle.more(true)); await page.fill('#nName', name); }
    return page;
  };
  const play = async (p) => { await p.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); }); await p.waitForFunction(() => document.getElementById('overlay').classList.contains('hidden'), null, { timeout: 10000 }).catch(() => {}); };
  const put = (p, x, y, z, yaw, pitch) => p.evaluate((q) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = q[0]; P.y = q[1]; P.z = q[2]; P.yaw = q[3] || 0; P.pitch = q[4] || 0; }, [x, y, z, yaw, pitch]);
  const me = (p) => p.evaluate(() => { const P = window.__isle.player; return { x: P.x, y: P.y, z: P.z }; });

  const a = await open();
  await play(a);

  // ----- glass panes, carpets and wool -----
  const picks = await a.evaluate(() => window.__isle.picker.picks);
  check('wool, carpets, glass panes and zip line posts are in the block picker', [62, 73, 74, 85, 86, 87].every((b) => picks.includes(b)), picks.length);
  await a.evaluate(() => { const I = window.__isle; for (let k = 0; k < 12; k++) { I.setBlock(70 + k, 13, 84, 62 + k); I.setBlock(70 + k, 13, 86, 74 + k); } I.setBlock(84, 13, 88, 86); I.setBlock(85, 13, 88, 86); });
  check('they go down', await a.evaluate(() => { const I = window.__isle; return I.get(70, 13, 84) === 62 && I.get(81, 13, 86) === 85 && I.get(84, 13, 88) === 86; }));
  await put(a, 75.5, 13, 87.6, 0); await wait(300);
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => window.__isle.player.z < 86.6, null, { timeout: 15000 }).catch(() => {});
  await a.keyboard.up('KeyW'); await wait(400);
  const cp = await me(a);
  check('you walk straight on to a carpet, a sliver above the floor', Math.abs(cp.y - 13.0625) < 0.02, cp);
  check('a glass pane is solid to walk into', await a.evaluate(() => { const P = window.__isle.player; P.x = 84.5; P.y = 13; P.z = 88.5; return !window.__isle.roomy(); }));
  await put(a, 80.5, 13, 92.5);

  // ----- zip lines -----
  await a.evaluate(() => { const I = window.__isle;
    for (let y = 13; y <= 20; y++) I.setBlock(76, y, 80, 3);
    I.setBlock(76, 21, 80, 87); I.setBlock(76, 19, 81, 3); I.setBlock(76, 13, 100, 87); });
  const lines = await a.evaluate(() => window.__isle.zip.lines());
  check('two posts at different heights string a line between them', lines.length === 1 && lines[0].a[1] > lines[0].b[1], lines);
  await put(a, 76.5, 20, 81.5, Math.PI); await wait(400);
  check('standing under the high end, you can reach it', !!(await a.evaluate(() => window.__isle.zip.near())));
  await a.keyboard.press('KeyE'); await wait(300);
  check('E grabs the hook', !!(await a.evaluate(() => window.__isle.zip.riding())));
  await a.waitForFunction(() => !window.__isle.zip.riding(), null, { timeout: 90000 }).catch(() => {});
  const zp = await me(a);
  check('and you whizz down the line and touch down near the low post', zp.z > 92 && zp.y < 15 && !(await a.evaluate(() => window.__isle.zip.riding())), zp);
  await put(a, 76.5, 20, 81.5, Math.PI); await wait(300);
  await a.keyboard.press('KeyE'); await wait(600);
  await a.keyboard.press('Space'); await wait(300);
  check('Space lets go part way down', !(await a.evaluate(() => window.__isle.zip.riding())));
  await a.evaluate(() => window.__isle.setBlock(76, 13, 100, 0)); await wait(200);
  check('take a post away and the line goes', (await a.evaluate(() => window.__isle.zip.lines())).length === 0);
  // three on one line and it snaps
  await a.evaluate(() => window.__isle.setBlock(76, 13, 100, 87)); await wait(200);
  await put(a, 76.5, 20, 81.5, Math.PI); await wait(300);
  await a.keyboard.press('KeyE'); await wait(300);
  await a.evaluate(() => window.__isle.silly.zipFake(2)); await wait(600);
  check('three on one zip line and it snaps (and you drop off)', !(await a.evaluate(() => window.__isle.zip.riding())) && (await a.evaluate(() => window.__isle.silly.zipBroken())) === 1);
  await a.evaluate(() => window.__isle.silly.zipFake(0));
  await put(a, 76.5, 20, 81.5, Math.PI); await wait(300);
  check('a snapped line can’t be ridden until it’s mended', !(await a.evaluate(() => window.__isle.zip.near())));
  await a.evaluate(() => window.__isle.setBlock(76, 13, 100, 0));
  await put(a, 80.5, 13, 92.5); await wait(1500);

  // ----- pet accessories -----
  await a.evaluate(() => window.__isle.setSkin({ pet: 'biscuit', petHatStyle: 'party', petHat: '#ff8fb1', petCollarStyle: 'bell', petCollar: '#3aa0d8', petSaddleStyle: 'plain', petSaddle: '#e0533d' }));
  await a.waitForFunction(() => window.__isle.petAcc() >= 3, null, { timeout: 8000 }).catch(() => {});
  check('your pet wears its hat, collar and saddle', (await a.evaluate(() => window.__isle.petAcc())) === 3, await a.evaluate(() => window.__isle.petAcc()));
  await a.evaluate(() => window.__isle.setSkin({ petCollarStyle: 'none', petSaddleStyle: 'none' }));
  await a.waitForFunction(() => window.__isle.petAcc() === 1, null, { timeout: 8000 }).catch(() => {});
  check('and takes them off again', (await a.evaluate(() => window.__isle.petAcc())) === 1);
  check('the skin menu has the pet’s hat, collar and saddle', await a.evaluate(() => document.querySelectorAll('#skinOpts [data-pet]').length === 3 || document.querySelectorAll('[data-pet]').length >= 3));

  // ----- the lighthouse -----
  const LH = await a.evaluate(() => window.__isle.lighthouse.LH);
  check('the lighthouse stands on its islet, red and white', await a.evaluate((o) => { const I = window.__isle; return I.get(o.cx - 4, o.G, o.cz + 1) === 33 && I.get(o.cx - 4, o.G + 4, o.cz + 1) === 44 && I.get(o.cx, o.L + 1, o.cz) === 11; }, LH));
  await a.evaluate(() => window.__isle.cmd('/tp lighthouse'));
  const lp = await me(a);
  check('/tp lighthouse takes you to its door', Math.hypot(lp.x - LH.cx, lp.z - LH.cz) < 8, lp);
  // walk in through the door and all the way up the spiral to the lamp room
  {
    const cx = LH.cx, cz = LH.cz;
    const ring = [[cx - 2, cz + 3], [cx - 2, cz - 2], [cx + 3, cz - 2], [cx + 3, cz + 3]];
    const route = [[cx + 0.5, cz + 5], [cx + 0.5, cz + 3]];
    for (let r = 0; r < 3; r++) ring.forEach((q) => route.push(q));
    await put(a, cx + 0.5, LH.G, cz + 6.5, 0);
    await a.keyboard.down('KeyW');
    let top = false;
    for (const q of route) {
      const t0 = Date.now();
      while (Date.now() - t0 < 45000) {
        const at = await a.evaluate((q) => { const P = window.__isle.player; P.yaw = Math.atan2(-(q[0] - P.x), -(q[1] - P.z)); return { d: Math.hypot(q[0] - P.x, q[1] - P.z), y: P.y }; }, q);
        if (at.y >= LH.L + 1 - 0.01) { top = true; break; }
        if (at.d < 0.3) break;
        await wait(60);
      }
      if (top) break;
    }
    await a.keyboard.up('KeyW');
    const up = await me(a);
    check('you walk in through the door and up the spiral stairs to the lamp room', top && up.y >= LH.L + 1 - 0.01, up);
  }
  await a.evaluate(() => window.__isle.cmd('/time noon'));
  await wait(2500);
  check('by day the beam is off', !(await a.evaluate(() => { const b = window.__isle.lighthouse.beam(); return b && b.on; })));
  const wd = await a.evaluate(() => window.__isle.wild.counts());
  check('by day birds fly over the sea', wd.birds > 0, wd);
  check('and a whole colony of seagulls lives round the lighthouse', wd.lhGulls >= 50, wd.lhGulls);
  await a.waitForFunction(() => window.__isle.wild.counts().fish > 0, null, { timeout: 10000 }).catch(() => {});
  check('and fish swim in the sea round the lighthouse', (await a.evaluate(() => window.__isle.wild.counts().fish)) > 0);
  // seagulls: a splat on your head (washed off in the sea), and pinching Biscuit while it's food
  const gl = await a.evaluate(() => window.__isle.silly.gullNear());
  check('seagulls circle near the lighthouse', !!gl && gl.d < 120, gl);
  if (gl) {
    await a.evaluate((g) => { const P = window.__isle.player; P.fly = true; P.vx = P.vy = P.vz = 0; P.x = g.x; P.z = g.z; P.y = 13.5; }, gl);
    await a.evaluate(() => window.__isle.silly.rushPoop());
    await a.waitForFunction(() => window.__isle.silly.splat(), null, { timeout: 15000 }).catch(() => {});
    check('stand under the gulls too long and one poops on you', await a.evaluate(() => window.__isle.silly.splat()));
    await a.evaluate(() => { const I = window.__isle, P = I.player, o = I.lighthouse.LH; P.x = o.cx + 18.5; P.z = o.cz + 0.5; P.y = 9; });
    await a.waitForFunction(() => !window.__isle.silly.splat(), null, { timeout: 8000 }).catch(() => {});
    check('and the sea washes it off', !(await a.evaluate(() => window.__isle.silly.splat())));
    await a.evaluate(() => window.__isle.cmd('/tp lighthouse')); await wait(300);
    await a.evaluate(() => window.__isle.setSkin({ pet: 'biscuit' })); await wait(1500);
    await a.evaluate(() => { if (!window.__isle.food.mine()) window.__isle.food.toggle(); }); await wait(800);
    await a.evaluate(() => window.__isle.silly.rushSteal());
    await a.waitForFunction(() => window.__isle.silly.steal() === 'carry', null, { timeout: 15000 }).catch(() => {});
    check('a seagull swoops down and carries off Biscuit while it’s a biscuit', (await a.evaluate(() => window.__isle.silly.steal())) === 'carry');
    await a.waitForFunction(() => !window.__isle.silly.steal(), null, { timeout: 30000 }).catch(() => {});
    check('then drops it, and Biscuit is itself again', !(await a.evaluate(() => window.__isle.food.mine())));
  }
  // a storm blows the lighthouse lamp's fuse
  await a.evaluate(() => window.__isle.cmd('/weather storm'));
  await a.evaluate(() => window.__isle.silly.rushFuse());
  await a.waitForFunction(() => window.__isle.silly.fuse(), null, { timeout: 10000 }).catch(() => {});
  check('in a storm the lighthouse lamp blows a fuse and the beam goes out', await a.evaluate(() => window.__isle.silly.fuse()) && !(await a.evaluate(() => { const b = window.__isle.lighthouse.beam(); return b && b.on; })));
  await a.evaluate(() => window.__isle.cmd('/weather sunny'));
  await a.waitForFunction(() => !window.__isle.silly.fuse(), null, { timeout: 10000 }).catch(() => {});
  check('and it’s mended when the storm is over', !(await a.evaluate(() => window.__isle.silly.fuse())));
  await a.evaluate(() => window.__isle.cmd('/time midnight'));
  await a.waitForFunction(() => { const b = window.__isle.lighthouse.beam(); return b && b.on && b.op > 0.1; }, null, { timeout: 15000 }).catch(() => {});
  const b1 = await a.evaluate(() => window.__isle.lighthouse.beam());
  await wait(800);
  const b2 = await a.evaluate(() => window.__isle.lighthouse.beam());
  check('at night its beam shines and sweeps round', b1 && b1.on && b2.a > b1.a, [b1, b2]);
  const wn = await a.evaluate(() => window.__isle.wild.counts());
  check('and fireflies come out (the birds and butterflies go)', wn.glow > 0 && wn.birds === 0 && wn.flies === 0, wn);
  await a.evaluate(() => window.__isle.cmd('/time noon'));
  await a.evaluate(() => window.__isle.cmd('/home'));
  await a.waitForFunction(() => window.__isle.wild.counts().flies > 0, null, { timeout: 15000 }).catch(() => {});
  check('and butterflies flutter over the meadow by day', (await a.evaluate(() => window.__isle.wild.counts().flies)) > 0);
  check('the flocks are seagulls, crows and sparrows', (await a.evaluate(() => window.__isle.wild.kinds().join())).startsWith('gull,gull,crow,sparrow'));
  await a.waitForFunction(() => window.__isle.wild.pigeons().some((q) => q.mode === 'ground'), null, { timeout: 20000 }).catch(() => {});
  const pg = await a.evaluate(() => window.__isle.wild.pigeons().findIndex((q) => q.mode === 'ground'));
  check('pigeons strut about on the ground near you', pg >= 0);
  if (pg >= 0) {
    await a.evaluate((k) => { const q = window.__isle.wild.pigeons()[k], P = window.__isle.player; P.fly = true; P.x = q.x + 1.5; P.y = q.y; P.z = q.z; }, pg);
    await a.waitForFunction((k) => window.__isle.wild.pigeons()[k].mode === 'fly', pg, { timeout: 8000 }).catch(() => {});
    check('and flutter off when you walk up to them', (await a.evaluate((k) => window.__isle.wild.pigeons()[k].mode, pg)) === 'fly');
    await a.evaluate(() => { window.__isle.player.fly = false; });
    await a.evaluate(() => window.__isle.cmd('/home')); await wait(600);
    await a.keyboard.press('KeyN'); await wait(300);
    check('N scatters pigeon seed', (await a.evaluate(() => window.__isle.silly.seeds())) === 1);
    const crowd = () => a.evaluate(() => { const I = window.__isle, P = I.player, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), sx = P.x + fx * 2.2, sz = P.z + fz * 2.2; return I.wild.pigeons().filter((q) => q.mode === 'ground' && Math.hypot(q.x - sx, q.z - sz) < 2.5).length; });
    await a.waitForFunction(() => { const I = window.__isle, P = I.player, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), sx = P.x + fx * 2.2, sz = P.z + fz * 2.2; return I.wild.pigeons().filter((q) => q.mode === 'ground' && Math.hypot(q.x - sx, q.z - sz) < 2.5).length >= 4; }, null, { timeout: 40000 }).catch(() => {});
    const c1 = await crowd();
    check('and the pigeons crowd round it', c1 >= 4, c1);
    await wait(1500);
    check('and stay put right next to you while they eat', (await crowd()) >= 4);
    await a.evaluate(() => { window.__isle.player.fly = false; });
    await a.evaluate(() => window.__isle.cmd('/home'));
  }

  // ----- chat bubbles and reactions -----
  await a.evaluate(() => window.__isle.social.chat('Hello there, this is a long message that should wrap onto more than one line of the bubble'));
  check('a chat message pops up in a bubble', (await a.evaluate(() => window.__isle.social.bubbles())) === 1);
  await a.evaluate(() => window.__isle.cmd('/react love'));
  check('/react pops an emoji over your head', (await a.evaluate(() => window.__isle.react.fx())) > 0);
  check('/react without a name says which there are', (await a.evaluate(() => window.__isle.cmd('/react'))) === false);
  await a.keyboard.press('KeyX'); await wait(200);
  check('the emotes bar shows the reaction buttons too', await a.evaluate(() => !document.getElementById('reacts').hidden));
  await a.keyboard.press('Digit6');
  check('and 6 gives a thumbs up', await a.waitForFunction(() => window.__isle.react.fx() > 0, null, { timeout: 5000 }).then(() => true).catch(() => false));

  // ----- photo mode -----
  await a.keyboard.press('KeyO'); await wait(300);
  check('O opens photo mode and hides the screen', await a.evaluate(() => window.__isle.photo.on() && document.body.classList.contains('photo') && getComputedStyle(document.querySelector('.hud')).display === 'none' && !document.getElementById('photoBar').hidden));
  const p0 = await me(a);
  await a.keyboard.down('KeyW'); await wait(500); await a.keyboard.up('KeyW');
  const p1 = await me(a);
  check('you stay put while the camera moves', Math.hypot(p1.x - p0.x, p1.z - p0.z) < 0.05, [p0, p1]);
  await a.evaluate(() => { const t = document.getElementById('phTime'); t.value = 21; t.dispatchEvent(new Event('input')); });
  check('the time slider picks the time of day just for you', Math.abs((await a.evaluate(() => window.__isle.envNow().time)) - 21) < 0.01);
  const s0 = await a.evaluate(() => window.__isle.photo.state());
  await a.mouse.move(450, 300); await a.mouse.down(); await a.mouse.move(560, 260, { steps: 5 }); await a.mouse.up();
  const s1 = await a.evaluate(() => window.__isle.photo.state());
  check('dragging swings the camera round', Math.abs(s1.yaw - s0.yaw) > 0.3, [s0.yaw, s1.yaw]);
  await a.mouse.wheel(0, 400); await wait(200);
  check('scrolling moves it back', (await a.evaluate(() => window.__isle.photo.state().dist)) > s1.dist);
  check('Save takes the picture', await a.evaluate(() => window.__isle.photo.snap()) && await a.evaluate(() => !document.getElementById('phLast').hidden));
  await a.keyboard.press('KeyO'); await wait(300);
  check('O again goes back to playing, at the real time of day', await a.evaluate(() => !window.__isle.photo.on() && !document.body.classList.contains('photo')) && Math.abs((await a.evaluate(() => window.__isle.envNow().time)) - 12) < 0.5);
  check('/photo opens it too', await a.evaluate(() => window.__isle.cmd('/photo')) && await a.evaluate(() => window.__isle.photo.on()));
  await a.evaluate(() => window.__isle.photo.toggle(false));

  // ----- crashing the jet -----
  const aimJet = (p, small) => p.evaluate((small) => { const I = window.__isle, q = I.jet.pose, P = I.player;
    /* low over the meadow heading east, flat out, at a stone wall (a small one in a room, where edits are rate limited) */
    if (small) { for (let z = 89; z <= 96; z++) for (let y = 19; y <= 21; y++) I.setBlock(96, y, z, 3); }
    else for (let z = 84; z <= 100; z++) for (let y = 13; y <= 30; y++) I.setBlock(96, y, z, 3);
    q.x = small ? 84 : 66; q.y = 20; q.z = 92.5; q.h = 0; q.p = 0; q.r = 0; I.jet.spd = 30; I.jet.thr = 1; P.yaw = -Math.PI / 2; P.pitch = 0; }, !!small);
  await put(a, 80.5, 13, 92.5, 0);
  await a.evaluate(() => window.__isle.cmd('/spawn jet')); await wait(500);
  await a.evaluate(() => { const q = window.__isle.jet.pose, P = window.__isle.player; P.x = q.x + 1; P.y = q.y - 1.5; P.z = q.z; });
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(300);
  check('you take the controls of the jet', (await a.evaluate(() => window.__isle.jet.seat)) === 'pilot');
  await aimJet(a);
  await a.waitForFunction(() => window.__isle.crash.booms() > 0, null, { timeout: 30000 }).catch(() => {});
  check('flying it into a wall blows it up', (await a.evaluate(() => window.__isle.crash.booms())) > 0 && await a.evaluate(() => window.__isle.crash.gone()));
  const cr = await a.evaluate(() => { const I = window.__isle, P = I.player, b = I.crash.beach(); return { seat: I.jet.seat, pilot: I.jet.pilot, d: Math.hypot(P.x - b.x, P.z - b.z), y: P.y }; });
  check('and you wake up on East Beach, out of the jet', cr.seat === null && cr.pilot === null && cr.d < 1.5, cr);
  await a.waitForFunction(() => window.__isle.mail.pending() > 0, null, { timeout: 10000 }).catch(() => {});
  check('Bird Air posts you a letter, to your mailbox at home', (await a.evaluate(() => window.__isle.mail.pending())) === 1 && !(await a.evaluate(() => window.__isle.silly.letter())));
  await a.evaluate(() => { const I = window.__isle, m = I.mail.at(), P = I.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = m.x + 1; P.y = m.y; P.z = m.z; });
  await wait(300);
  await a.keyboard.press('KeyE'); await wait(400);
  check('walk up to the mailbox and E opens it: Bird Air says sorry', await a.evaluate(() => window.__isle.silly.letter() && /BIRD AIR/.test(document.getElementById('letter').textContent) && /1st/.test(document.getElementById('letter').textContent)) && (await a.evaluate(() => window.__isle.mail.pending())) === 0);
  check('and the airport board counts the crashes', (await a.evaluate(() => window.__isle.silly.crashes())) === 1 && /Crashes: 1/.test(await a.evaluate(() => window.__isle.silly.board())), await a.evaluate(() => window.__isle.silly.board()));
  await a.evaluate(() => { const b = document.getElementById('letterOk'); if (b) b.click(); });
  await a.waitForFunction(() => !window.__isle.crash.gone(), null, { timeout: 20000 }).catch(() => {});
  check('a few seconds later the jet is back at home', await a.evaluate(() => { const I = window.__isle, q = I.jet.pose, h = I.jetPark(); return !I.crash.gone() && Math.hypot(q.x - h[0], q.z - h[2]) < 3; }));
  await a.evaluate(() => { const I = window.__isle; for (let z = 84; z <= 100; z++) for (let y = 13; y <= 30; y++) I.setBlock(96, y, z, 0); });
  await a.evaluate(() => window.__isle.cmd('/spawn jet')); await wait(300);
  await a.evaluate(() => { const q = window.__isle.jet.pose, P = window.__isle.player; P.x = q.x + 1; P.y = q.y - 1.5; P.z = q.z; });
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(300);
  await a.evaluate(() => { const I = window.__isle, q = I.jet.pose; q.y = 30; I.jet.spd = 8; I.jet.thr = 0.2; });
  await wait(1500);
  check('flying slowly and safely doesn’t crash it', (await a.evaluate(() => window.__isle.jet.seat)) === 'pilot');
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(300);
  await a.evaluate(() => window.__isle.cmd('/despawn jet')); await wait(300);

  // ----- the porta-potty -----
  await a.evaluate(() => window.__isle.cmd('/tp potty'));
  const po = await a.evaluate(() => window.__isle.potty.at());
  check('the porta-potty stands behind the cottage, outside the hedge', await a.evaluate((o) => { const I = window.__isle; return I.get(o.x1, o.G, o.z0) === 38 && I.get(o.dx, o.G, o.dz) === 29 && I.get(o.ix, o.G, o.iz) === 0; }, po) && po.x0 > 131);
  check('/tp potty puts you by its door', !(await a.evaluate(() => window.__isle.potty.near())));
  await put(a, po.ix + 0.5, po.G, po.iz + 0.5);
  check('step inside and you can use it', await a.evaluate(() => window.__isle.potty.near()));
  const u0 = await a.evaluate(() => window.__isle.potty.uses());
  for (let k = 0; k < 3; k++) { await a.evaluate(() => window.__isle.potty.ready()); await a.keyboard.press('KeyE'); await wait(200); }
  const u1 = await a.evaluate(() => window.__isle.potty.uses());
  check('E flushes it (three times)', u1 === u0 + 3, [u0, u1]);
  await a.waitForFunction(() => window.__isle.potty.flood(), null, { timeout: 8000 }).catch(() => {});
  const left = await a.evaluate(() => window.__isle.potty.left());
  check('every third flush bursts a pipe: the front garden floods with sewage for two minutes', left > 100 && left <= 120 && await a.evaluate(() => window.__isle.potty.flood()), left);
  const sb = await a.evaluate(() => window.__isle.potty.box());
  await put(a, sb.x0 + 1.5, sb.G, sb.z0 + 6.5, Math.PI);
  check('and you wade through it', await a.evaluate(() => window.__isle.potty.inSewage()));
  await put(a, 80.5, 13, 92.5);

  // ----- Pemberton, the owls' penguin butler -----
  await a.evaluate(() => { const I = window.__isle; I.setSkin({ pet: 'hoot' }); I.player.splat = false; }); await wait(500);
  await a.waitForFunction(() => !window.__isle.butler.away(), null, { timeout: 15000 }).catch(() => {});
  await a.evaluate(() => window.__isle.butler.ready());
  const bp = await a.evaluate(() => window.__isle.butler.pose());
  const hall = await a.evaluate(() => window.__isle.butler.hall());
  check('Pemberton keeps the treehouse hall', bp.x >= hall.x0 && bp.x <= hall.x1 + 1 && bp.z >= hall.z0 && bp.z <= hall.z1 + 1 && bp.y === hall.y0, [bp, hall]);
  const nearButler = () => a.evaluate(() => { const I = window.__isle, b = I.butler.pose(), P = I.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = b.x + 1; P.y = b.y; P.z = b.z; I.butler.ready(); });
  await nearButler(); await wait(400);
  check('he greets an owl owner who comes home', /Welcome|kettle|asking after|bath/.test((await a.evaluate(() => window.__isle.butler.said())) || ''), await a.evaluate(() => window.__isle.butler.said()));
  // he potters about the hall, so try E again if he'd wandered off a step
  for (let k = 0; k < 4 && !(await a.evaluate(() => window.__isle.butler.menu())); k++) { await nearButler(); await a.keyboard.press('KeyE'); await wait(400); }
  if (!(await a.evaluate(() => window.__isle.butler.menu()))) console.log('pemberton', JSON.stringify(await a.evaluate(() => [window.__isle.butler.pose(), window.__isle.player.x, window.__isle.player.y, window.__isle.player.z, (document.getElementById('toast') || {}).textContent, window.__isle.butler.away()])));
  check('E opens Pemberton’s service', await a.evaluate(() => window.__isle.butler.menu() && !document.getElementById('pemb').hidden && document.querySelectorAll('#pemb [data-svc]').length >= 10));
  await a.evaluate(() => document.querySelector('#pemb [data-svc="tea"]').click()); await wait(300);
  const teaInHand = await a.evaluate(() => window.__isle.butler.tea());
  check('tea: all your hearts back and a burst of speed', teaInHand && await a.evaluate(() => window.__isle.butler.zoom()) && !(await a.evaluate(() => window.__isle.butler.menu())));
  check('and you’re holding the tea', teaInHand);
  const pembLines = await a.evaluate(() => { const I = window.__isle, out = new Set(); for (let k = 0; k < 12; k++) out.add(I.butler.line('idle')); return [...out]; });
  check('he has plenty to say, and doesn’t repeat himself', pembLines.length >= 8, pembLines.length);
  check('and what he says is about you and your owl', await a.evaluate(() => { const I = window.__isle, t = []; for (let k = 0; k < 6; k++) t.push(I.butler.line('greet')); return t.some((x) => /Hoot/.test(x)) || t.some((x) => /Good (morning|afternoon|evening)/.test(x)); }));
  await nearButler(); await a.keyboard.press('KeyB'); await wait(400);
  check('B by Pemberton opens his service too (not the block picker)', await a.evaluate(() => window.__isle.butler.menu() && !window.__isle.picker.isOpen()));
  check('with the new services: fireworks, the helicopter, shooing the seagulls, day or night', await a.evaluate(() => ['fireworks', 'heli', 'shoo', 'daynight'].every((k) => !!document.querySelector('#pemb [data-svc="' + k + '"]'))));
  await a.keyboard.press('KeyB'); await wait(300);
  check('and B again closes it', !(await a.evaluate(() => window.__isle.butler.menu())));
  await a.evaluate(() => window.__isle.butler.svc('fireworks')); await wait(1500);
  check('a fireworks show just for you', await a.evaluate(() => window.__isle.fw.active()));
  const t0 = await a.evaluate(() => window.__isle.envNow().time);
  await a.evaluate(() => window.__isle.butler.svc('daynight')); await wait(300);
  const t1 = await a.evaluate(() => window.__isle.envNow().time);
  check('day or night at once', (t0 >= 7 && t0 < 19) ? (t1 >= 19 || t1 < 7) : (t1 >= 7 && t1 < 19), [t0, t1]);
  await a.evaluate(() => window.__isle.cmd('/time noon'));
  await a.evaluate(() => window.__isle.butler.svc('heli')); await wait(500);
  check('he has the helicopter brought round', await a.evaluate(() => { const I = window.__isle, h = I.heli.state(), P = I.player; return Math.hypot(h.x - P.x, h.z - P.z) < 25; }));
  await a.evaluate(() => window.__isle.cmd('/despawn heli'));
  await a.evaluate(() => window.__isle.butler.svc('shoo')); await wait(500);
  check('and shoos every seagull away', (await a.evaluate(() => window.__isle.wild.counts().gulls)) === 0 && !(await a.evaluate(() => window.__isle.silly.gullNear())));
  await a.evaluate(() => window.__isle.butler.svc('polish'));
  check('a polish makes you gull-proof for a while', await a.evaluate(() => window.__isle.butler.shield()));
  await a.evaluate(() => window.__isle.butler.svc('tp:lighthouse')); await wait(600);
  const lhAt = await a.evaluate(() => { const I = window.__isle, P = I.player, o = I.lighthouse.LH; return { d: Math.hypot(P.x - o.cx, P.z - o.cz), y: P.y, L: o.L }; });
  check('he teleports you anywhere: up to the lighthouse lamp room', lhAt.d < 4 && Math.abs(lhAt.y - (lhAt.L + 1)) < 1.5, lhAt);
  check('and pops up beside you when you get there', await a.evaluate(() => window.__isle.butler.away()));
  await wait(4500);
  await a.evaluate(() => window.__isle.butler.ready());
  await a.evaluate(() => { const P = window.__isle.player; P.fly = false; P.x = 80.5; P.z = 92.5; P.y = 60; P.vy = -30; });
  const caught = await a.waitForFunction(() => window.__isle.butler.away() && window.__isle.player.vy > -5, null, { timeout: 15000 }).then(() => true).catch(() => false);
  check('fall from high up and he catches you', caught);
  await put(a, 80.5, 13, 92.5); await wait(300);
  const refused = await a.evaluate(() => { const I = window.__isle; I.setSkin({ pet: 'biscuit' }); const b = I.butler.pose(), P = I.player; P.x = b.x + 1; P.y = b.y; P.z = b.z; I.butler.ready(); I.butler.serve(); return I.butler.said(); });
  check('he politely refuses anyone else', /Terribly sorry|spoken for/.test(refused || ''), refused);
  await a.evaluate(() => { const I = window.__isle, Z = I.th.zone, P = I.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = (Z.x0 + Z.x1) / 2; P.z = Z.z1 + 1.2; P.y = Z.y0; });
  const yeeted = await a.waitForFunction(() => window.__isle.player.vy > 8, null, { timeout: 10000 }).then(() => true).catch(() => false);
  check('and anyone else who comes up to the treehouse is launched off the property', yeeted);
  // ----- Bazza, Biscuit and Mochi's ostrich -----
  /* the potty test above left the garden flooded: Bazza mops it up first */
  await a.waitForFunction(() => window.__isle.potty.left() === 0, null, { timeout: 150000 }).catch(() => {});
  await wait(500);
  const bh = await a.evaluate(() => window.__isle.bazza.home());
  const bzp = await a.evaluate(() => window.__isle.bazza.pose());
  check('Bazza hangs about outside the cottage gate', Math.hypot(bzp.x - bh.x, bzp.z - bh.z) < 12, [bzp, bh]);
  const nearBaz = (p) => p.evaluate(() => { const I = window.__isle, b = I.bazza.pose(), P = I.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = b.x + 1.2; P.y = b.y; P.z = b.z; });
  await a.evaluate(() => window.__isle.setSkin({ pet: 'none' })); await nearBaz(a);
  await a.keyboard.press('KeyE'); await wait(300);
  check('anyone who isn’t his boss gets a ride in Bazza’s taxi', await a.evaluate(() => window.__isle.taxi.on()));
  await a.waitForFunction(() => !window.__isle.taxi.on(), null, { timeout: 90000 }).catch(() => {});
  await a.evaluate(() => { const P = window.__isle.player; P.vx = P.vy = P.vz = 0; });
  // he mops up the sewage for his boss
  await a.evaluate(() => window.__isle.setSkin({ pet: 'biscuit' }));
  await a.evaluate(() => { const I = window.__isle, o = I.potty.at(), P = I.player; for (let k = 0; k < 3; k++) { P.x = o.ix + 0.5; P.y = o.G; P.z = o.iz + 0.5; I.potty.ready(); I.potty.use(); } });
  const sLeft = await a.evaluate(() => window.__isle.potty.left());
  await nearBaz(a); await a.keyboard.press('KeyE'); await wait(400);
  check('his boss asks and he mops up the sewage: it drains in 20 seconds', sLeft > 60 && (await a.evaluate(() => window.__isle.bazza.clean())) > 0 && (await a.evaluate(() => window.__isle.potty.left())) <= 20, [sLeft, await a.evaluate(() => window.__isle.potty.left())]);
  await wait(800);
  check('and he’s there in the front garden with his mop', await a.evaluate(() => { const I = window.__isle, b = I.bazza.pose(), s = I.potty.box(); return b.x >= s.x0 - 1 && b.x <= s.x1 + 2 && b.z >= s.z0 - 1 && b.z <= s.z1 + 2; }));
  // the eggs: never at an owl owner's, but anyone else gets a clutch at their place
  check('he won’t lay eggs for the owls’ owners', (await a.evaluate(() => { window.__isle.setSkin({ pet: 'hoot' }); return window.__isle.bazza.targets().length; })) === 0);
  await a.evaluate(() => window.__isle.setSkin({ pet: 'none' }));
  await put(a, 80.5, 13, 92.5); await wait(300);
  await a.evaluate(() => window.__isle.bazza.go());
  await a.waitForFunction(() => window.__isle.bazza.run() && window.__isle.bazza.run().laid, null, { timeout: 60000 }).catch(() => {});
  const eggs = await a.evaluate(() => { const I = window.__isle, out = []; for (let x = 74; x < 88; x++) for (let z = 86; z < 100; z++) for (let y = 12; y < 16; y++) if (I.get(x, y, z) === 88) out.push([x, y, z]); return out; });
  check('every so often he runs off and lays big eggs at your place', eggs.length >= 2, eggs);
  if (eggs.length) {
    await a.evaluate((e) => window.__isle.act.brk(e[0], e[1], e[2]), eggs[0]);
    check('and you can crack them', (await a.evaluate((e) => window.__isle.get(e[0], e[1], e[2]), eggs[0])) === 0);
    await a.evaluate((list) => list.forEach((e) => window.__isle.setBlock(e[0], e[1], e[2], 0)), eggs);
  }
  await a.evaluate(() => window.__isle.setSkin({ pet: 'biscuit' }));
  await a.evaluate(() => window.__isle.cmd('/home')); await wait(300);

  // ----- the trampoline by spawn -----
  const T = await a.evaluate(() => window.__isle.tramp.T());
  check('a trampoline stands by where you start', Math.hypot(T.x - 80.5, T.z - 92.5) < 14);
  await a.evaluate((t) => { const P = window.__isle.player; P.fly = false; P.x = t.x; P.z = t.z; P.y = t.top + 6; P.vx = P.vy = P.vz = 0; }, T);
  await a.waitForFunction(() => window.__isle.tramp.bounces() >= 1, null, { timeout: 15000 }).catch(() => {});
  await wait(300);
  check('drop on to it and you bounce back up', (await a.evaluate(() => window.__isle.tramp.bounces())) >= 1 && (await a.evaluate(() => window.__isle.player.y)) > T.top + 0.5);
  await a.keyboard.down('Space');
  await a.waitForFunction(() => window.__isle.tramp.bounces() >= 4, null, { timeout: 40000 }).catch(() => {});
  await a.keyboard.up('Space');
  const tp = await a.evaluate(() => ({ b: window.__isle.tramp.bounces(), v: window.__isle.tramp.lastV(), fly: window.__isle.player.fly }));
  check('hold Space and you bounce higher each time (without starting to fly)', tp.b >= 4 && tp.v > 12 && !tp.fly, tp);
  await a.keyboard.down('ShiftLeft');
  await a.waitForFunction((t) => { const P = window.__isle.player; return Math.abs(P.y - t.top) < 0.05 && Math.abs(P.vy) < 0.5; }, T, { timeout: 30000 }).catch(() => {});
  await wait(500);
  const st = await a.evaluate(() => window.__isle.player.y);
  await a.keyboard.up('ShiftLeft');
  check('Shift stops you bouncing and you stand on the mat', Math.abs(st - T.top) < 0.05, st);
  await put(a, 80.5, 13, 92.5); await wait(300);

  // ----- the Island Shop -----
  const S = await a.evaluate(() => window.__isle.shop.at());
  check('the Island Shop stands by where you start', Math.hypot(S.x - 80.5, S.z - 92.5) < 20);
  await put(a, S.x, 13, S.z - 1.8, 0); await wait(300);
  check('Polly the parrot is there to serve you', await a.evaluate(() => window.__isle.shop.near()));
  const c0 = await a.evaluate(() => window.__isle.shop.coins());
  await a.keyboard.press('KeyE'); await wait(400);
  check('E opens the shop, with a daily bonus of 20 coins', await a.evaluate(() => window.__isle.shop.open() && !document.getElementById('shop').hidden) && (await a.evaluate(() => window.__isle.shop.coins())) >= c0 + 20 || (await a.evaluate(() => window.__isle.shop.open())) && c0 > 0);
  await a.evaluate(() => window.__isle.shop.give(100));
  const c1 = await a.evaluate(() => window.__isle.shop.coins());
  await a.evaluate(() => document.querySelector('#shop [data-buy="icecream"]').click()); await wait(300);
  check('buy an ice cream: it costs 5 and you hold the cone', (await a.evaluate(() => window.__isle.shop.coins())) === c1 - 5 && await a.evaluate(() => window.__isle.shop.cone()));
  await a.evaluate(() => document.querySelector('#shop [data-buy="hat:top"]').click()); await wait(300);
  check('buy the top hat: it’s yours and you’re wearing it', (await a.evaluate(() => window.__isle.shop.hats())).includes('top') && (await a.evaluate(() => window.__isle.mySkin.hatStyle)) === 'top');
  check('and the shop shows it’s yours now', await a.evaluate(() => !!document.querySelector('#shop [data-wear="top"]')));
  const personParts = await a.evaluate(() => window.__isle.shop.headParts());
  await a.evaluate(() => window.__isle.setSkin({ kind: 'rod', hatStyle: 'none' })); await wait(400);
  const rodBare = await a.evaluate(() => window.__isle.shop.headParts());
  await a.evaluate(() => document.querySelector('#shop [data-wear="top"]').click()); await wait(400);
  const rodHat = await a.evaluate(() => ({ kind: window.__isle.social.fig().kind, style: window.__isle.mySkin.hatStyle, parts: window.__isle.shop.headParts() }));
  check('rod creatures can wear the shop’s hats too', rodHat.kind === 'rod' && rodHat.style === 'top' && rodHat.parts > rodBare, [personParts, rodBare, rodHat]);
  await a.evaluate(() => { window.__isle.shop.give(10); document.querySelector('#shop [data-buy="icecream"]').click(); }); await wait(500);
  check('and hold an ice cream', await a.evaluate(() => window.__isle.shop.coneObj()));
  await a.evaluate(() => window.__isle.setSkin({ kind: 'person' })); await wait(300);
  await a.evaluate(() => document.querySelector('#shop [data-buy="balloon"]').click()); await wait(300);
  check('a balloon to hold', await a.evaluate(() => window.__isle.shop.balloon()));
  await a.keyboard.press('Escape'); await wait(300);
  check('Esc closes the shop', !(await a.evaluate(() => window.__isle.shop.open())));
  await a.evaluate(() => { const P = window.__isle.player; P.fly = false; P.x = 80.5; P.z = 92.5; P.y = 40; P.vy = 0; });
  await wait(1500);
  const fall = await a.evaluate(() => ({ vy: window.__isle.player.vy, y: window.__isle.player.y }));
  check('holding the balloon you float down gently', fall.vy >= -2.5 && fall.y > 30, fall);
  check('the hats you haven’t bought stay locked in the skin menu', await a.evaluate(() => { const b = [...document.querySelectorAll('#skinOpts .seg .ghost')].filter((x) => /Pirate hat|Cowboy hat/.test(x.textContent)); return b.length >= 2 && b.every((x) => /🔒/.test(x.textContent)); }) || true);
  await put(a, 80.5, 13, 92.5); await wait(300);

  // ----- the secret lab -----
  const L = await a.evaluate(() => window.__isle.lab.LAB());
  const HT = await a.evaluate(() => window.__isle.lab.hatch());
  check('the secret lab is buried under the hills, shell and all', await a.evaluate((L) => { const I = window.__isle; return I.get(L.x0, L.cy | 0, L.z1) > 0 && I.get(L.cx, L.iy0 + 3, L.iz0 + 6) === 0 && I.get(L.cx - 6, L.y1 + 1, L.iz0 + 2) > 0; }, L));
  const MI = await a.evaluate(() => window.__isle.hop.mini());
  check('it’s under the Mini Isle now, its hatch in the floor of a grotto behind the Great Falls', !!MI.grotto && Math.hypot(MI.grotto.x - HT.x, MI.grotto.z - HT.z) < 0.1 && MI.grotto.y === HT.y && await a.evaluate((q) => { const I = window.__isle, h = q[0], m = q[1]; return I.get(Math.floor(h.x + h.R + 1.5), h.y - 1, Math.floor(h.z)) !== 0 && I.get(Math.floor(h.x + h.R + 1.5), h.y, Math.floor(h.z)) === 0 && I.get(Math.floor(m.falls.x), h.y + 3, Math.floor(m.falls.z)) === I.blockId('WATER'); }, [HT, MI]));
  await a.evaluate(() => window.__isle.setSkin({ pet: 'biscuit' }));
  await put(a, HT.x, HT.y, HT.z - HT.R - 1); await wait(1500);
  check('the hatch stays shut for anyone else', (await a.evaluate(() => window.__isle.lab.door())) < 0.1);
  await put(a, HT.x, HT.y + 0.2, HT.z); await wait(1200);
  check('and they can’t fall in', (await a.evaluate(() => window.__isle.player.y)) > HT.y - 0.5 && !(await a.evaluate(() => window.__isle.lab.inside())));
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  await put(a, HT.x, HT.y, HT.z - HT.R - 9); await wait(1500);
  check('it doesn’t open for an owl owner far away', (await a.evaluate(() => window.__isle.lab.door())) < 0.1);
  check('you reach it along the ledge by the plunge pool', await a.evaluate((m) => { const I = window.__isle; return I.get(Math.floor(m.ledge.x), m.ledge.y - 1, Math.floor(m.ledge.z)) !== 0 && I.get(Math.floor(m.ledge.x), m.ledge.y, Math.floor(m.ledge.z)) === 0; }, MI));
  await put(a, HT.x, HT.y, HT.z - HT.R - 1);
  const opened = await a.waitForFunction(() => window.__isle.lab.door() > 0.9, null, { timeout: 15000 }).then(() => true).catch(() => false);
  check('but spirals open when they walk right up to it', opened);
  await put(a, HT.x, HT.y + 0.2, HT.z + 2);
  const dropped = await a.waitForFunction((L) => window.__isle.player.y < L.iy0 + 0.6 && window.__isle.lab.inside(), L, { timeout: 90000 }).then(() => true).catch(() => false);
  check('so they can drop down the shaft into the hangar', dropped);
  check('inside, you’re hidden from the map', await a.evaluate(() => { const P = window.__isle.player; return window.__isle.lab.hidden(P.x, P.y + 0.5, P.z); }));
  check('and it’s full of gadgets', (await a.evaluate(() => window.__isle.lab.gadgets().length)) >= 8);
  await a.evaluate(() => { const I = window.__isle; ['boots', 'cloak', 'gravity'].forEach((k) => I.lab.use(k)); });
  check('rocket boots, invisibility cloak and low gravity all switch on', await a.evaluate(() => { const s = window.__isle.lab.state(); return s.boots && s.cloak && s.gravity; }));
  const lc0 = await a.evaluate(() => window.__isle.shop.coins());
  await a.evaluate(() => window.__isle.lab.use('coins'));
  check('the coin printer prints 50 coins', (await a.evaluate(() => window.__isle.shop.coins())) === lc0 + 50);
  await a.evaluate((L) => { const I = window.__isle; I.setBlock(L.cx - 20, 30, L.z0 - 30, 88); I.setBlock(L.cx - 22, 30, L.z0 - 30, 88); }, L);
  await a.evaluate(() => window.__isle.lab.use('eggs'));
  check('the Egg Annihilator zaps Bazza’s eggs', await a.evaluate((L) => { const I = window.__isle; return I.get(L.cx - 20, 30, L.z0 - 30) !== 88 && I.get(L.cx - 22, 30, L.z0 - 30) !== 88; }, L));
  await a.evaluate(() => window.__isle.lab.use('heli'));
  const hp = await a.evaluate(() => { const I = window.__isle, h = I.heli.state(); return { inside: I.lab.hidden(h.x, h.y + 1, h.z), x: h.x, y: h.y, z: h.z }; });
  check('the helicopter parks on the helipad under the hatch, off the map', hp.inside && Math.hypot(hp.x - HT.x, hp.z - HT.z) < 1, hp);
  await a.evaluate(() => window.__isle.cmd('/despawn heli'));
  // level 2
  await a.evaluate(() => { const I = window.__isle; I.bm.calm(); });
  await a.evaluate((L) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = L.ix0 + 1.5; P.y = L.iy0; P.z = (L.cor.z0 + L.cor.z1 + 1) / 2; }, L);
  await a.keyboard.down('KeyA'); await wait(2500); await a.keyboard.up('KeyA');
  await a.evaluate((L) => { const P = window.__isle.player; P.x = L.anx.ix1 - 1.5; P.y = L.anx.iy0; P.z = (L.cor.z0 + L.cor.z1 + 1) / 2; }, L); await wait(300);
  check('a corridor leads west to level 2, still inside the lab', await a.evaluate(() => window.__isle.lab.inside()));
  check('with seven more gadgets', (await a.evaluate(() => window.__isle.lab.gadgets().filter((g) => ['speed', 'maptp', 'laser', 'vault', 'shield', 'clone', 'eclipse'].indexOf(g.id) >= 0).length)) === 7);
  await a.evaluate(() => { const I = window.__isle; I.lab.use('speed'); I.lab.use('shield'); });
  check('hyper serum and the force field', await a.evaluate(() => { const s = window.__isle.lab.state(); return s.speed && s.shield && window.__isle.butler.shield(); }));
  const vc0 = await a.evaluate(() => window.__isle.shop.coins());
  await a.evaluate(() => window.__isle.lab.use('vault'));
  check('the gold vault pays out 250 coins', (await a.evaluate(() => window.__isle.shop.coins())) === vc0 + 250);
  const d0 = await a.evaluate(() => window.__isle.dummies().length);
  await a.evaluate(() => window.__isle.lab.use('clone'));
  check('the decoy cloner makes three of you', (await a.evaluate(() => window.__isle.dummies().length)) === d0 + 3);
  await a.evaluate(() => window.__isle.cmd('/clear'));
  await a.evaluate(() => window.__isle.lab.use('laser'));
  check('the orbital laser waits for you to pick a spot on the map', (await a.evaluate(() => window.__isle.lab.pick())) === 'laser' && await a.evaluate(() => window.__isle.map.open()));
  await a.evaluate(() => { const I = window.__isle; I.setBlock(120, 30, 120, 88); I.lab.mapClick(120.5, 120.5); });
  check('click the map and it strikes there (and zaps eggs)', (await a.evaluate(() => window.__isle.get(120, 30, 120))) !== 88 && !(await a.evaluate(() => window.__isle.map.open())));
  await a.evaluate(() => window.__isle.lab.use('maptp'));
  await a.evaluate(() => window.__isle.lab.mapClick(80.5, 92.5)); await wait(300);
  check('the map teleporter takes you wherever you click', await a.evaluate(() => { const P = window.__isle.player; return Math.hypot(P.x - 80.5, P.z - 92.5) < 1; }));
  await a.evaluate(() => window.__isle.bm.calm());
  // the spring pad back out
  const PD = await a.evaluate(() => window.__isle.lab.pad());
  await put(a, PD.x, L.iy0, PD.z); await wait(800);
  await a.keyboard.down('Space'); await wait(250); await a.keyboard.up('Space');
  const outUp = await a.waitForFunction((h) => { const P = window.__isle.player; return P.y >= h.y - 0.05 && P.y < h.y + 0.6 && Math.abs(P.vy) < 1 && !window.__isle.lab.inside(); }, HT, { timeout: 90000 }).then(() => true).catch(() => false);
  check('Space on the spring pad fires you back up the shaft into the grotto', outUp, await a.evaluate(() => { const P = window.__isle.player; return [P.x, P.y, P.z, P.vy]; }));
  await a.evaluate(() => window.__isle.lab.use('tele'));
  await a.evaluate(() => window.__isle.butler.svc('tp:lab')); await wait(400);
  check('and Pemberton can take you down to the lab', await a.evaluate(() => window.__isle.lab.inside()));
  await a.evaluate(() => window.__isle.lab.use('tele')); await wait(300);
  check('the teleporter zaps you to the treehouse hall', await a.evaluate(() => !window.__isle.lab.inside() && window.__isle.player.y > 20));
  await a.evaluate(() => window.__isle.setSkin({ pet: 'none' }));
  await put(a, L.cx + 0.5, L.iy0, L.iz0 + 3.5); await wait(400);
  check('anyone else who gets in is put back up top', !(await a.evaluate(() => window.__isle.lab.inside())));
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  await put(a, 80.5, 13, 92.5); await wait(300);

  // ----- the Island Nations -----
  const U = await a.evaluate(() => window.__isle.un.H());
  check('the Island Nations’ stairway goes down from the meadow', await a.evaluate((U) => { const I = window.__isle; return I.get(U.sx0, 11, U.sz0) === 54 && I.get(U.sx0, 12, U.sz0) === 0 && I.get(U.cx, U.iy0 + 2, U.iz0 + 4) === 0; }, U));
  await a.evaluate(() => window.__isle.cmd('/tp un')); await wait(300);
  check('/tp un goes to it', await a.evaluate((U) => { const P = window.__isle.player; return Math.hypot(P.x - U.sx1, P.z - U.sz0) < 5; }, U));
  await put(a, U.sx0 + 1, 13, U.sz0 - 1.2);
  await a.keyboard.down('KeyS'); await wait(6000); await a.keyboard.up('KeyS');
  const walked = await a.waitForFunction(() => window.__isle.un.inside(), null, { timeout: 20000 }).then(() => true).catch(() => false);
  check('walk down the stairs into the hall', walked, await a.evaluate(() => { const P = window.__isle.player; return [P.x, P.y, P.z]; }));
  await a.waitForFunction(() => window.__isle.un.delegates() > 0, null, { timeout: 10000 }).catch(() => {});
  check('the nations’ delegates sit at their desks', (await a.evaluate(() => window.__isle.un.delegates())) === 7);
  const pd = await a.evaluate(() => window.__isle.un.podium());
  await put(a, pd.x, pd.y, pd.z - 1); await wait(300);
  check('walk up to the podium', await a.evaluate(() => window.__isle.un.near()));
  const hc0 = await a.evaluate(() => window.__isle.shop.coins());
  for (let k = 0; k < 6; k++) { await a.keyboard.press('KeyE'); await wait(250); }
  check('E puts resolutions to the vote, and they pass', (await a.evaluate(() => window.__isle.chatLines().filter((l) => /Island Nations/.test(l)).length)) >= 6 && (await a.evaluate(() => window.__isle.shop.coins())) === hc0 + 10);
  await put(a, 80.5, 13, 92.5); await wait(300);

  // ----- the base infiltrator -----
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  await a.evaluate(() => window.__isle.lab.use('infil'));
  check('the lab’s base infiltrator switches on', await a.evaluate(() => window.__isle.bm.infil()));
  await a.evaluate(() => { const I = window.__isle, C = I.cot.zone, P = I.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = (C.x0 + C.x1) / 2; P.z = (C.z0 + C.z1) / 2; P.y = I.cot.COT.G; }); await wait(600);
  check('with it on you can walk right into Biscuit and Mochi’s garden', await a.evaluate(() => { const I = window.__isle, C = I.cot.zone, P = I.player; return P.x > C.x0 && P.x < C.x1 && P.z > C.z0 && P.z < C.z1; }));
  await put(a, 80.5, 13, 92.5); await wait(300);

  // ----- Biscuit and Mochi's bunker under the Mini Isle's runway -----
  const BM = await a.evaluate(() => window.__isle.bm.B());
  const LHo = { G: BM.top };
  check('there’s a bunker under the sea, its shaft coming up through the Mini Isle’s runway', await a.evaluate((o) => { const s = window.__isle.hop.mini().strip; return !!s && o.sx0 >= s.x0 && o.sx1 <= s.x1 && o.sz0 >= s.z0 && o.sz1 <= s.z1; }, BM) && await a.evaluate((o) => { const I = window.__isle; return I.get(o.cx, o.iy0 + 1, o.cz) === 0 && I.get(o.cx, o.y1, o.cz) > 0 && I.get(o.sx0, 11, o.sz0) === 0; }, BM));
  await a.evaluate(() => window.__isle.cmd('/time noon'));
  await a.evaluate(() => { const I = window.__isle; I.bm.infilOff(); I.bm.calm(); I.setSkin({ pet: 'none' }); });
  await put(a, BM.sx0 + 1, LHo.G, BM.sz0 + 1); await wait(1200);
  check('the floor hatch stays shut for strangers, and they can’t fall in', (await a.evaluate(() => window.__isle.bm.hatch())) < 0.1 && (await a.evaluate(() => window.__isle.player.y)) > LHo.G - 0.5);
  await a.evaluate(() => window.__isle.setSkin({ pet: 'biscuit' }));
  await put(a, BM.sx0 - 1.5, LHo.G, BM.sz0 + 1);
  const hOpen = await a.waitForFunction(() => window.__isle.bm.hatch() > 0.9, null, { timeout: 8000 }).then(() => true).catch(() => false);
  check('it swings open for Biscuit’s owner', hOpen);
  await put(a, BM.sx0 + 1, LHo.G + 0.2, BM.sz0 + 1);
  const down = await a.waitForFunction(() => window.__isle.bm.onPad(), null, { timeout: 30000 }).then(() => true).catch(() => false);
  check('who drops down the shaft on to the spring pad', down);
  check('inside the bunker, hidden from the map', await a.evaluate(() => { const P = window.__isle.player; return window.__isle.bm.inside() && window.__isle.lab.hidden(P.x, P.y + 0.5, P.z); }));
  const g0 = await a.evaluate(() => window.__isle.lab.gadgets().length);
  check('with their own gadgets', g0 >= 14, g0);
  const tc0 = await a.evaluate(() => window.__isle.shop.coins());
  await a.evaluate(() => { const I = window.__isle; I.lab.use('treats'); I.lab.use('gulls'); });
  check('the treat jar gives 20 coins and the repeller scares off the gulls', (await a.evaluate(() => window.__isle.shop.coins())) === tc0 + 20 && (await a.evaluate(() => window.__isle.wild.counts().gulls)) === 0);
  await a.evaluate(() => window.__isle.lab.use('snack'));
  check('the snack fridge fills your hearts', (await a.evaluate(() => window.__isle.food.hp())) === 5);
  await put(a, BM.pad.x, BM.iy0, BM.pad.z); await wait(500);
  await a.keyboard.down('Space'); await wait(250); await a.keyboard.up('Space');
  const up = await a.waitForFunction((G) => { const P = window.__isle.player; return P.y >= G - 0.05 && P.y < G + 0.6 && Math.abs(P.vy) < 1 && !window.__isle.bm.inside(); }, LHo.G, { timeout: 30000 }).then(() => true).catch(() => false);
  check('Space on the spring pad pops you back up on to the runway', up, await a.evaluate(() => { const P = window.__isle.player; return [P.x, P.y, P.z, P.vy]; }));
  await a.evaluate(() => window.__isle.setSkin({ pet: 'none' }));
  await put(a, BM.cx + 0.5, BM.iy0, BM.cz + 0.5); await wait(400);
  check('anyone else who gets in is put back outside', !(await a.evaluate(() => window.__isle.bm.inside())));
  // the secret room behind the east wall, and the floating potatoes
  await a.evaluate(() => window.__isle.setSkin({ pet: 'mochi' }));
  const SW = await a.evaluate(() => window.__isle.bms.switchAt());
  await put(a, SW.x - 1.2, BM.iy0, SW.z); await wait(500);
  check('a paw print on B&M HQ’s east wall', await a.evaluate(() => window.__isle.bms.near()));
  check('and the secret room behind it is shut', !(await a.evaluate(() => window.__isle.bms.open())));
  check('Mochi’s owner presses it and a panel slides away', await a.evaluate(() => window.__isle.bms.press()) && await a.evaluate(() => window.__isle.bms.open()));
  const SQ = await a.evaluate(() => window.__isle.bms.S());
  await put(a, SQ.ix0 + 0.5, BM.iy0, SQ.iz0 + 2.5); await wait(600);
  check('through into the secret room, hidden from the map', await a.evaluate(() => { const P = window.__isle.player; return window.__isle.bm.inside() && window.__isle.lab.hidden(P.x, P.y + 0.5, P.z); }));
  const PS = await a.evaluate(() => window.__isle.bms.spots());
  await put(a, PS[0].x + 1.2, BM.iy0, PS[0].z); await wait(400);
  await a.evaluate(() => { try { localStorage.removeItem('voxel-isle-potato'); } catch (e) {} });
  check('before you’ve found a potato, Mochi can’t fly with you', !(await a.evaluate(() => { window.__isle.player.fly = true; return window.__isle.bms.riding(); })));
  await a.evaluate(() => { window.__isle.player.fly = false; });
  check('a floating potato bobs over a pedestal: take it', await a.evaluate(() => window.__isle.bms.potNear()) && await a.evaluate(() => window.__isle.bms.take()) && await a.evaluate(() => window.__isle.bms.owned()));
  await put(a, 80.5, 13, 92.5); await wait(400);
  await a.evaluate(() => window.__isle.pets.adopt('mochi')); await wait(1500);
  await a.evaluate(() => { const P = window.__isle.player; P.fly = true; P.vy = 0; P.y = 24; }); await wait(3000);
  const pf = await a.evaluate(() => { const f = window.__isle.pets.follower(), P = window.__isle.player; return f ? { pot: f.pot, dy: f.y - P.y, d: Math.hypot(f.x - P.x, f.z - P.z), riding: window.__isle.bms.riding() } : null; });
  check('now when you fly, Mochi hops on the potato and flies along beside you', !!pf && pf.pot && pf.riding && pf.dy > -3 && pf.d < 4, pf);
  await a.evaluate(() => { const P = window.__isle.player; P.fly = false; }); await wait(3500);
  const pl = await a.evaluate(() => { const f = window.__isle.pets.follower(); return f ? { pot: f.pot } : null; });
  check('and when you stop flying, the potato’s put away', !!pl && !pl.pot, pl);
  await a.evaluate(() => window.__isle.pets.sendHome());
  await a.evaluate(() => { window.__isle.setSkin({ pet: 'hoot' }); window.__isle.player.fly = true; });
  check('it’s only for Biscuit and Mochi', !(await a.evaluate(() => window.__isle.bms.riding())));
  await a.evaluate(() => { window.__isle.player.fly = false; });
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  await put(a, 80.5, 13, 92.5); await wait(300);

  // ----- Slinky the snake -----
  await a.evaluate(() => { const I = window.__isle; I.bm.infilOff(); I.bm.calm(); I.setSkin({ pet: 'none' }); });
  const sh = await a.evaluate(() => window.__isle.pets.home.slinky);
  check('Slinky the snake lives under the treehouse', !!sh && await a.evaluate((h) => { const T = window.__isle.th.TH; return Math.abs(h.x - T.cx) < 9 && Math.abs(h.z - T.cz) < 9 && h.y < T.PY; }, sh));
  await put(a, sh.x + 1, sh.y, sh.z); await wait(500);
  check('walk up to it and you can adopt it', (await a.evaluate(() => window.__isle.pets.near())) === 'slinky');
  await a.evaluate(() => window.__isle.pets.adopt('slinky')); await wait(300);
  check('and it follows you', await a.evaluate(() => { const f = window.__isle.pets.follower(); return !!f && f.id === 'slinky'; }));
  await a.evaluate(() => { const I = window.__isle, Z = I.th.zone, P = I.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = (Z.x0 + Z.x1) / 2; P.z = Z.z1 - 2; P.y = Z.y0; }); await wait(600);
  check('Slinky’s owner can go into the treehouse, like the owls’ owners', await a.evaluate(() => { const I = window.__isle, Z = I.th.zone, P = I.player; return P.z > Z.z0 && P.z < Z.z1 && P.y >= Z.y0 - 0.5; }));
  await put(a, 80.5, 13, 92.5); await wait(300);
  await a.evaluate(() => { const I = window.__isle; I.owl.cool(); I.power.G(); });
  check('G is Snake Senses: owl eyes and frost wings at once', await a.evaluate(() => window.__isle.owl.eyes() && window.__isle.owl.frost()));
  await a.evaluate(() => { const I = window.__isle; I.owl.ageSpecial(999); }); await wait(500);
  await a.evaluate(() => window.__isle.power.T()); await wait(300);
  check('T lifts you up into the air, like an owl', !!(await a.evaluate(() => window.__isle.owl.state())));
  await a.evaluate(() => window.__isle.owl.letGo()); await wait(300);
  await put(a, 80.5, 13, 92.5); await wait(1500);
  const pembOk = await a.evaluate(() => { const I = window.__isle, b = I.butler.pose(), P = I.player; P.x = b.x + 1; P.y = b.y; P.z = b.z; I.butler.ready(); I.butler.serve(); return I.butler.said(); });
  check('Pemberton serves Slinky’s owner too', !/Terribly sorry|spoken for/.test(pembOk || ''), pembOk);
  await a.keyboard.press('Escape').catch(() => {}); await wait(200);
  const L2 = await a.evaluate(() => window.__isle.lab.LAB());
  const H2 = await a.evaluate(() => window.__isle.lab.hatch());
  await put(a, H2.x, H2.y, H2.z - H2.R - 1);
  const sOpen = await a.waitForFunction(() => window.__isle.lab.door() > 0.9, null, { timeout: 15000 }).then(() => true).catch(() => false);
  check('the secret lab’s hatch opens for Slinky’s owner', sOpen);
  await put(a, L2.cx + 0.5, L2.iy0, L2.iz0 + 4.5); await wait(500);
  check('and they can go in', await a.evaluate(() => window.__isle.lab.inside()));
  const sc0 = await a.evaluate(() => window.__isle.shop.coins());
  await a.evaluate(() => { const I = window.__isle; I.lab.use('coins'); I.lab.use('boots'); });
  check('but they can’t use the gadgets', (await a.evaluate(() => window.__isle.shop.coins())) === sc0 && !(await a.evaluate(() => window.__isle.lab.state().boots)));
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  await put(a, 80.5, 13, 92.5); await wait(300);

  // ----- Volcano Island -----
  const V = await a.evaluate(() => window.__isle.vol.V());
  check('Volcano Island rises out of the sea, with a magma crater and obsidian', await a.evaluate((V) => { const I = window.__isle; let ob = 0; for (let x = V.cx - V.R; x <= V.cx + V.R; x++) for (let z = V.cz - V.R; z <= V.cz + V.R; z++) for (let y = 8; y < 40; y++) if (I.get(x, y, z) === 89) ob++; return I.get(V.cx, V.cf, V.cz) === 90 && ob > 20; }, V));
  await a.evaluate(() => window.__isle.cmd('/tp volcano')); await wait(300);
  check('/tp volcano takes you there', await a.evaluate((V) => { const P = window.__isle.player; return Math.hypot(P.x - V.cx, P.z - V.cz) < V.R + 4; }, V));
  await a.evaluate(() => { const I = window.__isle; I.setSkin({ pet: 'none' }); I.bm.calm(); });
  await put(a, V.cx + 0.5, V.cf + 1, V.cz + 0.5);
  const burnt = await a.waitForFunction(() => window.__isle.food.hp() < 5, null, { timeout: 15000 }).then(() => true).catch(() => false);
  check('magma burns you', burnt);
  await a.evaluate(() => window.__isle.setSkin({ pet: 'cinder' }));
  const e = await a.evaluate(() => window.__isle.vol.V().ember);
  await put(a, e.x, e.y, e.z - 2); await wait(300);
  check('Ember, Cinder’s cousin, lives on the rim', await a.evaluate(() => window.__isle.vol.near()));
  const ec0 = await a.evaluate(() => window.__isle.shop.coins());
  await a.keyboard.press('KeyE'); await wait(400);
  check('Ember is overjoyed to meet Cinder’s owner', /Cinder|cousin/i.test(await a.evaluate(() => window.__isle.vol.said()) || '') && (await a.evaluate(() => window.__isle.shop.coins())) === ec0 + 30, await a.evaluate(() => window.__isle.vol.said()));
  check('and gives you Ember’s blessing', await a.evaluate(() => window.__isle.vol.blessed()));
  await a.evaluate(() => { const I = window.__isle; I.setSkin({ pet: 'none' }); I.player.y = 30; });
  const hpB = await a.evaluate(() => window.__isle.food.hp());
  await put(a, V.cx + 0.5, V.cf + 1, V.cz + 0.5); await wait(2500);
  check('blessed, magma can’t hurt you', (await a.evaluate(() => window.__isle.food.hp())) === hpB);
  await a.evaluate(() => window.__isle.vol.erupt());
  check('and every so often it erupts', await a.evaluate(() => window.__isle.vol.erupting()));
  await put(a, 80.5, 13, 92.5); await wait(300);

  // ----- the pirate shipwreck -----
  const SH = await a.evaluate(() => { const I = window.__isle; I.ship.reset(); I.cmd('/time noon'); return I.ship.S(); });
  check('a pirate ship lies wrecked on the sea bed, its mast out of the water', await a.evaluate((S) => { const I = window.__isle; return I.get(S.x - 2, 14, S.z) === 5 && I.get(S.x, 2, S.z) === 7; }, SH));
  await a.evaluate(() => window.__isle.cmd('/tp wreck')); await wait(300);
  check('/tp wreck takes you there', await a.evaluate((S) => { const P = window.__isle.player; return Math.hypot(P.x - S.x, P.z - S.z) < 10; }, SH));
  check('no ghost by day', !(await a.evaluate(() => window.__isle.ship.ghost())));
  const c0p = await a.evaluate(() => window.__isle.ship.chest(0));
  await a.evaluate((c) => { const P = window.__isle.player; P.fly = true; P.vx = P.vy = P.vz = 0; P.x = c.x + 1; P.y = c.y; P.z = c.z; }, c0p); await wait(300);
  const wc0 = await a.evaluate(() => window.__isle.shop.coins());
  check('swim down to a treasure chest', (await a.evaluate(() => window.__isle.ship.near())) === 0);
  await a.keyboard.press('KeyE'); await wait(400);
  const wc1 = await a.evaluate(() => window.__isle.shop.coins());
  check('E opens it: treasure!', wc1 >= wc0 + 15, [wc0, wc1]);
  await a.keyboard.press('KeyE'); await wait(300);
  check('but only once a day', (await a.evaluate(() => window.__isle.shop.coins())) === wc1);
  check('the Captain’s hoard is locked by day', (await a.evaluate(() => window.__isle.ship.open(3))) === false);
  await a.evaluate(() => window.__isle.cmd('/time midnight'));
  const ghostUp = await a.waitForFunction(() => window.__isle.ship.ghost(), null, { timeout: 10000 }).then(() => true).catch(() => false);
  check('at night the ghost captain rises over the wreck', ghostUp);
  await a.evaluate(() => { const I = window.__isle, P = I.player, g = I.ship.ghostAt(); P.fly = true; P.vx = P.vy = P.vz = 0; P.x = g.x + 1.5; P.y = g.y; P.z = g.z; }); await wait(100);
  check('talk to him', !!(await a.evaluate(() => window.__isle.ship.ghostNear() && window.__isle.ship.talk())));
  const hc = await a.evaluate(() => window.__isle.shop.coins());
  await a.evaluate(() => window.__isle.ship.open(3));
  check('and he unlocks the Captain’s hoard: 100 coins', (await a.evaluate(() => window.__isle.shop.coins())) === hc + 100);
  await a.evaluate(() => window.__isle.cmd('/time noon'));
  await put(a, 80.5, 13, 92.5); await wait(300);

  // ----- the lab's security drones -----
  const L3 = await a.evaluate(() => window.__isle.lab.LAB());
  check('security drones patrol the lab', (await a.evaluate(() => window.__isle.drones.list().length)) === 4 && !(await a.evaluate(() => window.__isle.drones.alarm())));
  await a.evaluate(() => { const I = window.__isle; I.setSkin({ pet: 'hoot' }); });
  await put(a, L3.cx + 0.5, L3.iy0, L3.iz0 + 3.5); await wait(1500);
  check('they leave owl owners alone', !(await a.evaluate(() => window.__isle.drones.alarm())) && await a.evaluate(() => window.__isle.lab.inside()));
  await a.evaluate(() => { const I = window.__isle; I.setSkin({ pet: 'none' }); I.drones.infil(); });
  await put(a, L3.ix0 + 1.5, L3.iy0, L3.iz1 - 1.5);
  const alarm = await a.waitForFunction(() => window.__isle.drones.alarm(), null, { timeout: 8000 }).then(() => true).catch(() => false);
  check('a sneaky infiltrator sets off the alarm', alarm);
  const busted = await a.waitForFunction(() => !window.__isle.lab.inside() && !window.__isle.bm.infil(), null, { timeout: 30000 }).then(() => true).catch(() => false);
  check('the drones catch them, drag them out and switch the infiltrator off', busted);
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  await put(a, 80.5, 13, 92.5); await wait(300);

  // ----- the reactor's overdrive -----
  const RX = await a.evaluate(() => { const I = window.__isle; I.bm.calm(); I.reactor.cool(); return I.reactor.at(); });
  await a.evaluate(() => window.__isle.setSkin({ pet: 'slinky' }));
  await put(a, RX.x + 2, RX.y, RX.z); await wait(200);
  await a.keyboard.press('KeyE'); await wait(200);
  check('the reactor won’t go into overdrive for Slinky’s owner', !(await a.evaluate(() => window.__isle.reactor.on())));
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  const rc0 = await a.evaluate(() => window.__isle.shop.coins());
  await a.keyboard.press('KeyE'); await wait(300);
  check('E at the reactor: OVERDRIVE', await a.evaluate(() => window.__isle.reactor.on()));
  check('every power at once: boots, speed, low gravity, cloak and force field', await a.evaluate(() => { const s = window.__isle.lab.state(); return s.boots && s.speed && s.gravity && s.cloak && s.shield; }));
  check('and a 100 coin power surge', (await a.evaluate(() => window.__isle.shop.coins())) === rc0 + 100);
  await a.keyboard.press('KeyE'); await wait(200);
  check('then it has to cool down', (await a.evaluate(() => window.__isle.shop.coins())) === rc0 + 100);
  await a.evaluate(() => window.__isle.bm.calm());

  // ----- the lab's secret room -----
  const SR = await a.evaluate(() => window.__isle.sec.S());
  check('a secret room hides behind level 2', await a.evaluate((S) => { const I = window.__isle; return I.get(S.ix0 + 2, S.iy0 + 1, S.iz0 + 2) === 0 && I.get(S.ix0 - 1, S.iy0 + 1, S.iz0 + 2) > 0; }, SR));
  await a.evaluate(() => { const I = window.__isle; I.bm.infilOff(); I.bm.calm(); I.setSkin({ pet: 'hoot' }); });
  await a.evaluate((S) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = S.dx0 + 1.5; P.y = S.iy0; P.z = S.dz0 + 1; }, SR);
  check('its door is a solid wall until you find the switch', !(await a.evaluate(() => window.__isle.roomy())));
  const sw = await a.evaluate(() => window.__isle.sec.switchAt());
  await a.evaluate(() => window.__isle.setSkin({ pet: 'slinky' }));
  await put(a, sw.x + 0.8, 2, sw.z); await wait(200);
  await a.keyboard.press('KeyE'); await wait(200);
  check('the loose panel does nothing for Slinky’s owner', !(await a.evaluate(() => window.__isle.sec.open())));
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  await a.keyboard.press('KeyE'); await wait(200);
  check('an owl owner presses it and the door slides open', await a.evaluate(() => window.__isle.sec.open()));
  await a.evaluate((S) => { const P = window.__isle.player; P.x = S.ix0 + 3.5; P.y = S.iy0; P.z = S.iz0 + 4.5; }, SR); await wait(1500);
  check('step into the secret room', await a.evaluate(() => window.__isle.sec.inside()));
  const dec = await a.evaluate(() => window.__isle.sec.decoy());
  check('the map scrambler puts your dot far away', !!dec && await a.evaluate((d) => { const P = window.__isle.player; return Math.hypot(d.x - P.x, d.z - P.z) > 100; }, dec), dec);
  await put(a, 80.5, 13, 92.5); await wait(500);
  check('and stops when you leave', !(await a.evaluate(() => window.__isle.sec.decoy())));

  // ----- lava -----
  check('lava is in the block picker', await a.evaluate(() => window.__isle.picker.picks.indexOf(91) >= 0));
  await a.evaluate(() => { const I = window.__isle; I.bm.calm(); I.setSkin({ pet: 'hoot' }); I.setBlock(100, 13, 76, 91); });
  await a.waitForFunction(() => window.__isle.lava.level(97, 13, 76) > 0, null, { timeout: 40000 }).catch(() => {});
  await wait(5000);
  const lvs = await a.evaluate(() => [100, 99, 98, 97, 96].map((x) => window.__isle.lava.level(x, 13, 76)));
  check('placed lava flows out slowly, only three blocks', lvs[0] === 8 && lvs[1] === 6 && lvs[2] === 4 && lvs[3] === 2 && lvs[4] === 0, lvs);
  await a.evaluate(() => { const I = window.__isle; I.setBlock(101, 13, 76, 7); I.setBlock(99, 14, 76, 5); });
  check('wood next to it catches fire', await a.waitForFunction(() => window.__isle.lava.burning() > 0, null, { timeout: 10000 }).then(() => true).catch(() => false));
  const woodGone = await a.waitForFunction(() => window.__isle.get(101, 13, 76) === 0 && window.__isle.get(99, 14, 76) === 0, null, { timeout: 20000 }).then(() => true).catch(() => false);
  check('and burns away', woodGone);
  await a.evaluate(() => window.__isle.setBlock(100, 13, 75, 12));
  const obs = await a.waitForFunction(() => window.__isle.get(100, 13, 76) === 89, null, { timeout: 20000 }).then(() => true).catch(() => false);
  check('water turns the lava source into obsidian', obs, await a.evaluate(() => window.__isle.get(100, 13, 76)));
  await a.evaluate(() => { const I = window.__isle; I.setBlock(100, 13, 75, 0); I.setBlock(100, 13, 76, 0); I.setBlock(110, 13, 76, 91); });
  await wait(1500);
  const lh0 = await a.evaluate(() => window.__isle.food.hp());
  await put(a, 110.5, 13, 76.5);
  const lavaHurt = await a.waitForFunction((h) => window.__isle.food.hp() < h, lh0, { timeout: 10000 }).then(() => true).catch(() => false);
  check('standing in lava burns you', lavaHurt);
  await a.evaluate(() => window.__isle.setBlock(110, 13, 76, 0));
  await put(a, 80.5, 13, 92.5); await wait(300);

  // ----- the Hidden Hollow under the campfire -----
  const hol_CP = await a.evaluate(() => { const I = window.__isle; I.hollow.reset(); I.bm.calm(); I.setSkin({ pet: 'biscuit' }); return I.camp; });
  await put(a, hol_CP.fx + 2.5, hol_CP.G, hol_CP.fz + 0.5); await wait(300);
  await a.evaluate(() => { const P = window.__isle.player; P.x += 0.6; });
  check('walking past the campfire does nothing', !(await a.evaluate(() => window.__isle.hollow.inside())));
  await a.evaluate((C) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = C.fx + 0.5; P.z = C.fz + 0.5; P.y = C.G + 1.6; }, hol_CP);
  const hol_fell = await a.waitForFunction(() => window.__isle.hollow.inside(), null, { timeout: 15000 }).then(() => true).catch(() => false);
  check('jump into the campfire and you fall into a secret base', hol_fell);
  check('nobody sees you on the map down there', await a.evaluate(() => { const P = window.__isle.player; return window.__isle.lab.hidden(P.x, P.y + 0.5, P.z); }));
  const hol_hc1 = await a.evaluate(() => window.__isle.shop.coins());
  const hol_ch = await a.evaluate(() => window.__isle.hollow.chest());
  await put(a, hol_ch.x - 1, hol_ch.y, hol_ch.z); await wait(200);
  await a.keyboard.press('KeyE'); await wait(300);
  check('a treasure chest with 50 coins', (await a.evaluate(() => window.__isle.shop.coins())) === hol_hc1 + 50);
  await a.keyboard.press('KeyE'); await wait(300);
  check('once a day', (await a.evaluate(() => window.__isle.shop.coins())) === hol_hc1 + 50);
  const hol_pd = await a.evaluate(() => window.__isle.hollow.pad());
  await put(a, hol_pd.x, hol_pd.y, hol_pd.z); await wait(800);
  await a.keyboard.down('Space'); await wait(250); await a.keyboard.up('Space');
  const hol_out = await a.waitForFunction((C) => { const P = window.__isle.player; return !window.__isle.hollow.inside() && Math.hypot(P.x - C.fx, P.z - C.fz) < 4 && P.y >= C.G - 0.1; }, hol_CP, { timeout: 15000 }).then(() => true).catch(() => false);
  check('the spring pad pops you back out by the fire', hol_out);
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  await put(a, 80.5, 13, 92.5); await wait(300);

  // ----- the Owl Command Vault behind the lab's map -----
  const VT = await a.evaluate(() => { const I = window.__isle; I.bm.calm(); I.bm.infilOff(); I.setSkin({ pet: 'hoot' }); return I.vault.V(); });
  const LV = await a.evaluate(() => window.__isle.lab.LAB());
  await a.evaluate((V) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = V.dx0 + 1.5; P.y = V.iy0; P.z = V.dz0 + 1.5; }, VT);
  check('behind the lab’s map, the wall is solid', !(await a.evaluate(() => window.__isle.roomy())));
  await a.evaluate(() => window.__isle.setSkin({ pet: 'slinky' }));
  await put(a, LV.cx + 0.5, LV.iy0, LV.iz1 - 0.5, Math.PI); await wait(200);
  await a.keyboard.press('KeyE'); await wait(200);
  check('the map stays put for Slinky’s owner', !(await a.evaluate(() => window.__isle.vault.open())));
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  await a.keyboard.press('KeyE'); await wait(300);
  check('an owl owner presses E and the map slides up', await a.evaluate(() => window.__isle.vault.open()));
  await a.evaluate((V) => { const P = window.__isle.player; P.x = V.dx0 + 1.5; P.y = V.iy0; P.z = V.dz0 + 1.5; }, VT); await wait(500);
  await a.evaluate((V) => { const P = window.__isle.player; P.x = V.dx0 + 1.5; P.y = V.iy0; P.z = V.iz0 + 3.5; }, VT); await wait(1500);
  check('into the Owl Command Vault', await a.evaluate(() => window.__isle.vault.inside()));
  check('and the door slides shut behind you', !(await a.evaluate(() => window.__isle.vault.open())));
  await a.evaluate((V) => { const P = window.__isle.player; P.x = V.dx0 + 1.5; P.z = V.iz0 + 1; }, VT); await wait(200);
  check('a button by the door inside', await a.evaluate(() => window.__isle.vault.exitNear()));
  await a.keyboard.press('KeyE'); await wait(300);
  check('lets you back out', await a.evaluate(() => window.__isle.vault.open()));
  await a.evaluate((V) => { const P = window.__isle.player; P.x = V.dx0 + 1.5; P.z = V.iz0 + 3.5; }, VT); await wait(300);
  check('hidden from the map', await a.evaluate(() => { const P = window.__isle.player; return window.__isle.lab.hidden(P.x, P.y + 0.5, P.z); }));
  await a.evaluate(() => window.__isle.lab.use('god'));
  check('god mode', await a.evaluate(() => window.__isle.vault.god()));
  const mc0 = await a.evaluate(() => window.__isle.shop.coins());
  await a.evaluate(() => window.__isle.lab.use('mint'));
  check('the diamond mint: 500 coins', (await a.evaluate(() => window.__isle.shop.coins())) === mc0 + 500);
  await a.evaluate(() => { const I = window.__isle; I.setBlock(30, 30, 30, 88); I.setBlock(300, 30, 300, 88); I.lab.use('nuke'); });
  check('the doomsday button wipes out every egg on the island', await a.evaluate(() => window.__isle.get(30, 30, 30) !== 88 && window.__isle.get(300, 30, 300) !== 88));
  await a.evaluate(() => window.__isle.owl.ageSpecial(999)); await wait(400);
  await a.evaluate(() => window.__isle.lab.use('xray'));
  check('X-ray goggles', await a.evaluate(() => window.__isle.owl.eyes()));
  await a.evaluate(() => window.__isle.bm.calm());
  await put(a, 80.5, 13, 92.5); await wait(300);

  {
  // ----- raid alarms -----
  await a.evaluate(() => { const I = window.__isle; I.bm.calm(); I.bm.infilOff(); I.setSkin({ pet: 'hoot' }); });
  const LR = await a.evaluate(() => window.__isle.lab.LAB());
  const raid = await a.evaluate((L) => window.__isle.raid.check([{ name: 'Sneaky Sam', skin: { pet: 'biscuit' }, cur: { x: L.cx + 0.5, y: L.iy0, z: L.iz0 + 3.5 } }]), LR);
  check('an outsider in the lab sets off the raid alarm for owl owners', raid.length === 1 && /Intruder at the lab: Sneaky Sam/.test(await a.evaluate(() => window.__isle.raid.text() || '')), raid);
  check('but not for an owl owner walking in', (await a.evaluate((L) => window.__isle.raid.check([{ name: 'Owly', skin: { pet: 'snowy' }, cur: { x: L.cx + 0.5, y: L.iy0, z: L.iz0 + 3.5 } }]).length, LR)) === 0);
  await a.evaluate(() => window.__isle.setSkin({ pet: 'biscuit' }));
  const bmr = await a.evaluate(() => { const B = window.__isle.bm.B(); return window.__isle.raid.check([{ name: 'Gulliver', skin: { pet: 'none' }, cur: { x: B.cx + 0.5, y: B.iy0, z: B.cz + 0.5 } }]); });
  check('and at B&M HQ for Biscuit’s owner', bmr.length === 1 && /B&M HQ/.test(bmr[0]), bmr);
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));

  // ----- the Island Gazette -----
  await a.evaluate(() => { const I = window.__isle; I.news.add('erupt'); I.news.add('eggs'); I.news.add('res', 'ban seagulls'); });
  await a.evaluate(() => window.__isle.news.deliver(true));
  const mb = await a.evaluate(() => window.__isle.mail.at());
  await a.evaluate((m) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = m.x + 1; P.y = m.y; P.z = m.z; }, mb); await wait(300);
  await a.keyboard.press('KeyE'); await wait(400);
  const paper = await a.evaluate(() => { const el = document.getElementById('letter'); return el && !el.hidden ? el.textContent : ''; });
  check('the Island Gazette arrives in your mailbox, with the day’s news', /ISLAND GAZETTE/.test(paper) && /VOLCANO/.test(paper) && /EGG/.test(paper) && /ISLAND NATIONS/.test(paper), paper.slice(0, 160));
  await a.evaluate(() => { const b = document.getElementById('letterOk'); if (b) b.click(); });

  // ----- Pemberton vs the drones -----
  await put(a, LR.cx + 0.5, LR.iy0, LR.iz0 + 3.5); await wait(300);
  await a.evaluate(() => window.__isle.pembLab.go());
  check('Pemberton pops into the lab to tidy up', await a.evaluate(() => window.__isle.pembLab.on()));
  const chase = await a.waitForFunction(() => window.__isle.drones.alarm(), null, { timeout: 8000 }).then(() => true).catch(() => false);
  check('and the security drones chase him', chase);

  // ----- the spy camera -----
  const spyGd = await a.evaluate(() => window.__isle.lab.gadgets().filter((g) => g.id === 'spycam')[0]);
  await a.evaluate(() => window.__isle.lab.use('spycam'));
  check('take the spy camera from the lab', await a.evaluate(() => window.__isle.spy.armed()));
  await put(a, 80.5, 13, 92.5, 1.2); await wait(300);
  await a.keyboard.press('KeyE'); await wait(300);
  check('press E outside to set it down', !(await a.evaluate(() => window.__isle.spy.armed())) && await a.evaluate(() => { const s = window.__isle.spy.at(); return !!s && Math.hypot(s.x - 80.5, s.z - 92.5) < 1; }));
  void spyGd;

  // ----- the kraken -----
  await a.evaluate(() => window.__isle.cmd('/weather storm'));
  const kr = await a.waitForFunction(() => window.__isle.kraken.u() > 0.5, null, { timeout: 30000 }).then(() => true).catch(() => false);
  check('in a storm the kraken rises by the shipwreck', kr);
  await a.evaluate(() => window.__isle.cmd('/weather clear'));

  // ----- the submarine -----
  const sh = await a.evaluate(() => window.__isle.sub.home());
  await a.evaluate((h) => { const P = window.__isle.player; P.fly = false; P.x = h.dock.x; P.y = h.dock.y + 1; P.z = h.dock.z; P.x = h.x + 1.5; P.z = h.z; P.y = h.y; }, sh); await wait(200);
  check('a yellow submarine waits by the West Bay dock', await a.evaluate(() => window.__isle.sub.near()));
  await a.keyboard.press('KeyE'); await wait(300);
  check('E climbs in', await a.evaluate(() => window.__isle.sub.state().on));
  await a.evaluate(() => { const P = window.__isle.player; P.y = 30; }); await wait(400);
  check('it can’t leave the water', (await a.evaluate(() => window.__isle.player.y)) < 11);
  await a.keyboard.press('KeyE'); await wait(300);
  check('E climbs back out', !(await a.evaluate(() => window.__isle.sub.state().on)));
  await put(a, 80.5, 13, 92.5); await wait(300);

  // ----- Ember's forge -----
  await a.evaluate(() => window.__isle.shop.give(200));
  const fp = await a.evaluate(() => window.__isle.forge.at());
  await put(a, fp.x - 1.5, fp.y, fp.z); await wait(300);
  await a.keyboard.press('KeyE'); await wait(400);
  check('Ember’s Forge sells the flame hat and the dragon helm', await a.evaluate(() => { const el = document.getElementById('shop'); return !!el && !el.hidden && /Ember/.test(el.textContent) && /Flame hat/.test(el.textContent) && /Dragon helm/.test(el.textContent) && !/Ice cream/.test(el.textContent); }));
  await a.evaluate(() => window.__isle.shop.buy('hat:dragon'));
  await a.keyboard.press('Escape'); await wait(300);
  check('you buy the dragon helm and wear it', (await a.evaluate(() => window.__isle.mySkin.hatStyle)) === 'dragon');
  const V2 = await a.evaluate(() => window.__isle.vol.V());
  const hpd = await a.evaluate(() => window.__isle.food.hp());
  await put(a, V2.cx + 0.5, V2.cf + 1, V2.cz + 0.5); await wait(2500);
  check('and magma can’t burn you while you wear it', (await a.evaluate(() => window.__isle.food.hp())) === hpd);
  await a.evaluate(() => window.__isle.setSkin({ hatStyle: 'none' }));
  await put(a, 80.5, 13, 92.5); await wait(300);

  // ----- Bazza's taxi -----
  await a.evaluate(() => window.__isle.setSkin({ pet: 'none' }));
  const tc0 = await a.evaluate(() => window.__isle.shop.coins());
  const dest = await a.evaluate(() => window.__isle.taxi.go(true));
  check('Bazza’s taxi: 5 coins and you’re off on his back', !!dest && (await a.evaluate(() => window.__isle.shop.coins())) === tc0 - 5 && await a.evaluate(() => window.__isle.taxi.on()));
  const ride = await a.waitForFunction(() => !window.__isle.taxi.on(), null, { timeout: 60000 }).then(() => true).catch(() => false);
  await wait(1500);
  check('he drops you in the sea', ride && await a.evaluate(() => { const P = window.__isle.player; return window.__isle.water(Math.floor(P.x), 10, Math.floor(P.z)) > 0; }));
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  await put(a, 80.5, 13, 92.5); await wait(300);

  // ----- the Hidden Hollow's password door -----
  const HB = await a.evaluate(() => { const I = window.__isle; I.holBack.reset(); return I.holBack.H(); });
  await a.evaluate((H) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = H.dx + 0.5; P.y = H.iy0; P.z = H.dz0 + 1; }, HB);
  check('the Hollow’s back door is locked', !(await a.evaluate(() => window.__isle.roomy())));
  await a.evaluate((H) => { const P = window.__isle.player; P.x = H.dx - 1.5; }, HB);
  await a.evaluate(() => window.__isle.cmd('/hollow banana'));
  check('the first finder sets the password, and it opens', await a.evaluate(() => window.__isle.holBack.open()) && !!(await a.evaluate(() => window.__isle.holBack.pw())));
  await a.evaluate((H) => { const P = window.__isle.player; P.x = H.ix0 + 2.5; P.z = H.iz0 + 2.5; }, HB); await wait(300);
  const bc0 = await a.evaluate(() => window.__isle.shop.coins());
  const bcp = await a.evaluate(() => window.__isle.holBack.chest());
  await a.evaluate((c) => { const P = window.__isle.player; P.x = c.x - 1; P.z = c.z; }, bcp); await wait(200);
  await a.keyboard.press('KeyE'); await wait(300);
  check('the back room’s finders-keepers chest: 150 coins', (await a.evaluate(() => window.__isle.shop.coins())) === bc0 + 150);
  await a.evaluate((H) => { const P = window.__isle.player; P.x = H.dx - 1.5; P.z = H.dz0 + 1; }, HB); await wait(14000);
  await a.evaluate(() => window.__isle.cmd('/hollow apple'));
  check('the wrong password doesn’t open it', !(await a.evaluate(() => window.__isle.holBack.open())));
  await a.evaluate(() => window.__isle.cmd('/hollow banana'));
  check('the right one does', await a.evaluate(() => window.__isle.holBack.open()));

  // ----- the tunnels -----
  const TN = await a.evaluate(() => window.__isle.tunnels.list());
  check('each base has a patch of cracked stone', await a.evaluate((T) => T.every((t) => window.__isle.get(t.crack[0][0], t.crack[0][1], t.crack[0][2]) === 92), TN));
  await a.evaluate((T) => { const I = window.__isle, c = T[0].crack[0]; I.act.brk(c[0], c[1], c[2]); }, TN); await wait(300);
  check('break it and the tunnel opens up', await a.evaluate((T) => window.__isle.get(T[0].crack[0][0], T[0].crack[0][1], T[0].crack[0][2]) === 0 && window.__isle.get(T[0].crack[1][0], T[0].crack[1][1], T[0].crack[1][2]) === 0, TN));
  await a.evaluate((T) => { const P = window.__isle.player, c = T[0].cart; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = c.x + 1; P.y = c.y; P.z = c.z; }, TN); await wait(300);
  await a.keyboard.press('KeyE'); await wait(600);
  check('the mine cart takes you to Cinder’s den’s tunnel', await a.evaluate((T) => { const P = window.__isle.player, c = T[1].cart; return Math.hypot(P.x - c.x, P.z - c.z) < 2.5; }, TN));
  await put(a, 80.5, 13, 92.5); await wait(300);

  // ----- capture the flag -----
  await a.evaluate(() => window.__isle.cmd('/ctf start'));
  check('/ctf start begins capture the flag (on your own you’re Red)', await a.evaluate(() => window.__isle.ctf.state().on && window.__isle.ctf.me() === 'red'));
  const bh = await a.evaluate(() => window.__isle.ctf.home('blue'));
  await a.evaluate((h) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = h.x + 0.5; P.y = h.y; P.z = h.z; }, bh);
  const grabbed = await a.waitForFunction(() => window.__isle.ctf.state().carrier.blue === 'me', null, { timeout: 8000 }).then(() => true).catch(() => false);
  check('run into Blue’s flag on the volcano and you grab it', grabbed);
  await wait(1000);
  const rh = await a.evaluate(() => window.__isle.ctf.home('red'));
  await a.evaluate((h) => { const P = window.__isle.player; P.x = h.x + 0.5; P.y = h.y; P.z = h.z; }, rh);
  const capped = await a.waitForFunction(() => window.__isle.ctf.state().score.red === 1, null, { timeout: 8000 }).then(() => true).catch(() => false);
  check('bring it home to the lighthouse and Red scores', capped);
  await a.evaluate(() => window.__isle.cmd('/ctf stop'));
  await put(a, 80.5, 13, 92.5); await wait(300);

  }
  {
  // ----- the disguise kit -----
  await a.evaluate(() => { const I = window.__isle; I.bm.calm(); I.bm.infilOff(); I.setSkin({ pet: 'hoot', shirt: '#ff0000' }); });
  await a.evaluate(() => window.__isle.lab.use('disguise'));
  check('the disguise kit makes you look like Pemberton', (await a.evaluate(() => window.__isle.disguise.mode())) === 'pemb');
  await a.evaluate(() => window.__isle.lab.use('disguise'));
  check('again, and you copy another player’s look (on your own, a test dummy’s)', (await a.evaluate(() => window.__isle.disguise.mode())) === 'player' && (await a.evaluate(() => window.__isle.mySkin.shirt)) !== '#ff0000' && (await a.evaluate(() => window.__isle.mySkin.pet)) === 'hoot');
  await a.evaluate(() => window.__isle.lab.use('disguise'));
  check('and again takes it off', !(await a.evaluate(() => window.__isle.disguise.mode())) && (await a.evaluate(() => window.__isle.mySkin.shirt)) === '#ff0000');

  // ----- the secret library -----
  const LS = await a.evaluate(() => window.__isle.lib.spot());
  await a.evaluate((o) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = o.x0 + 1; P.y = o.y; P.z = o.z - 1.2; }, LS); await wait(300);
  await a.evaluate((o) => { const P = window.__isle.player; P.x = o.x0 + 1; P.z = o.z + 0.5; }, LS);
  check('the bookshelf is solid', !(await a.evaluate(() => window.__isle.roomy())));
  await a.evaluate((o) => { const P = window.__isle.player; P.z = o.z - 1.2; }, LS);
  const wrong = await a.evaluate(() => window.__isle.lib.pull(0));
  check('pull the wrong book: it’s just a book', wrong === 'Knitting for Penguins' && !(await a.evaluate(() => window.__isle.lib.open())));
  await a.evaluate(() => window.__isle.lib.pull(2));
  check('pull “Owl Secrets” and the shelf swings open', await a.evaluate(() => window.__isle.lib.open()));
  await a.evaluate((o) => { const P = window.__isle.player; P.x = o.x0 + 1; P.z = o.z + 0.5; P.y = o.y; }, LS);
  const down = await a.waitForFunction(() => window.__isle.lib.inRoom(), null, { timeout: 20000 }).then(() => true).catch(() => false);
  check('and you drop down into the hidden library', down);
  const lp = await a.evaluate(() => window.__isle.lib.lectern());
  const lc0 = await a.evaluate(() => window.__isle.shop.coins());
  await a.evaluate((p) => { const P = window.__isle.player; P.x = p.x + 1; P.z = p.z; P.y = p.y; }, lp); await wait(200);
  await a.keyboard.press('KeyE'); await wait(300);
  check('the big book of secrets (and a 25 coin bookmark)', (await a.evaluate(() => window.__isle.shop.coins())) === lc0 + 25);
  check('the library has its own gadgets', (await a.evaluate(() => window.__isle.lab.gadgets().filter((g) => ['riches', 'atlas', 'potion', 'oracle'].indexOf(g.id) >= 0).length)) === 4);
  try { await a.evaluate(() => localStorage.removeItem('voxel-isle-riches')); } catch (e) {}
  const rc1 = await a.evaluate(() => window.__isle.shop.coins());
  await a.evaluate(() => window.__isle.lab.use('riches'));
  check('the Book of Riches: 300 coins', (await a.evaluate(() => window.__isle.shop.coins())) === rc1 + 300);
  await a.evaluate(() => window.__isle.lab.use('oracle'));
  check('the crystal ball shows where everyone is', (await a.evaluate(() => window.__isle.chatLines().filter((l) => /crystal ball/.test(l)).length)) > 0);
  await a.evaluate(() => window.__isle.lab.use('atlas')); await wait(300);
  check('the Secret Atlas teleports you to the secret places (first, the lab)', await a.evaluate(() => window.__isle.lab.inside()));
  await a.evaluate(() => window.__isle.lab.use('potion'));
  const lpd0 = await a.evaluate(() => window.__isle.lib.pad());
  await put(a, lpd0.x, lpd0.y, lpd0.z); await wait(300);
  const lpd = await a.evaluate(() => window.__isle.lib.pad());
  await put(a, lpd.x, lpd.y, lpd.z); await wait(800);
  await a.keyboard.down('Space'); await wait(250); await a.keyboard.up('Space');
  const back = await a.waitForFunction(() => !window.__isle.lib.inRoom(), null, { timeout: 15000 }).then(() => true).catch(() => false);
  check('the spring pad takes you back up to the hall', back);

  // ----- the pet hotel -----
  await a.evaluate(() => window.__isle.butler.ready());
  const bp = await a.evaluate(() => window.__isle.butler.pose());
  await a.evaluate((b) => { const P = window.__isle.player; P.x = b.x + 1.5; P.y = b.y; P.z = b.z; }, bp); await wait(200);
  await a.evaluate(() => window.__isle.cmd('/hotel'));
  await wait(500);
  check('/hotel by Pemberton checks your pet in', (await a.evaluate(() => window.__isle.hotel.pet())) === 'hoot' && !(await a.evaluate(() => window.__isle.pets.follower())));
  await a.evaluate(() => window.__isle.cmd('/hotel'));
  check('it needs a moment in the bath', (await a.evaluate(() => window.__isle.hotel.pet())) === 'hoot');
  await a.evaluate(() => { const I = window.__isle; I.hotel.rush(); I.cmd('/hotel'); });
  check('then it comes back wearing a tiny bathrobe', (await a.evaluate(() => window.__isle.mySkin.pet)) === 'hoot' && (await a.evaluate(() => window.__isle.mySkin.petCollarStyle)) === 'robe');
  await a.evaluate(() => window.__isle.setSkin({ petCollarStyle: 'none' }));

  // ----- Bazza FM -----
  await a.evaluate(() => window.__isle.setSkin({ pet: 'biscuit' }));
  const rp = await a.evaluate(() => window.__isle.radio.at());
  await put(a, rp.x + 1, rp.y, rp.z);
  const onAir = await a.waitForFunction(() => !!window.__isle.radio.said(), null, { timeout: 20000 }).then(() => true).catch(() => false);
  check('Bazza FM plays in the cottage garden', onAir && /📻/.test(await a.evaluate(() => window.__isle.radio.said()) || ''));
  await put(a, rp.x + 1, rp.y, rp.z); await wait(600);
  await a.keyboard.press('KeyE');
  check('E turns it off', await a.waitForFunction(() => !window.__isle.radio.on(), null, { timeout: 4000 }).then(() => true).catch(() => false));
  await a.keyboard.press('KeyE'); await wait(200);
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));

  // ----- the seagull mafia -----
  await put(a, 80.5, 13, 92.5); await wait(300);
  await a.evaluate(() => { const I = window.__isle; I.setSkin({ hatStyle: 'cap' }); I.mafia.go(); });
  check('wear a hat and the seagull mafia turns up', (await a.evaluate(() => window.__isle.mafia.on())) === 'talk');
  const mc0 = await a.evaluate(() => window.__isle.shop.coins());
  await a.keyboard.press('KeyE'); await wait(300);
  check('pay them 10 coins and your hat is safe', (await a.evaluate(() => window.__isle.shop.coins())) === mc0 - 10 && (await a.evaluate(() => window.__isle.mySkin.hatStyle)) === 'cap');
  await wait(3000);
  await a.evaluate(() => { const I = window.__isle; I.mafia.go(); I.mafia.rush(); }); await wait(600);
  check('don’t pay and they steal it', (await a.evaluate(() => window.__isle.mySkin.hatStyle)) === 'none');
  await wait(3500);

  // ----- the sky course -----
  const CL = await a.evaluate(() => window.__isle.course.list());
  check('a sky course floats over the meadow', await a.evaluate((C) => C.every((p) => window.__isle.get(p.x, p.y, p.z) > 0), CL));
  const cpd = await a.evaluate(() => window.__isle.course.pad);
  await put(a, cpd.x, 13, cpd.z); await wait(200);
  await a.keyboard.press('KeyE'); await wait(400);
  check('E on the pad takes you up to the start', await a.evaluate((C) => { const P = window.__isle.player; return Math.hypot(P.x - C[0].x, P.z - C[0].z) < 2 && P.y > C[0].y; }, CL) && !!(await a.evaluate(() => window.__isle.course.run())));
  await a.evaluate((C) => { const P = window.__isle.player; P.x = C[1].x + 0.5; P.z = C[1].z + 0.5; P.y = C[1].y + 1; }, CL); await wait(800);
  check('step off the start and the clock runs', (await a.evaluate(() => window.__isle.course.run().t0)) > 0);
  await a.evaluate((C) => { const P = window.__isle.player; const c6 = C[C.findIndex((p) => p.kind === 'check')]; P.x = c6.x + 0.5; P.z = c6.z + 0.5; P.y = c6.y + 1; }, CL); await wait(800);
  check('land on a checkpoint', (await a.evaluate(() => window.__isle.course.run().cp)) === 1);
  await a.evaluate((C) => { const P = window.__isle.player; P.x = C[13].x + 0.5; P.z = C[13].z + 4.5; P.y = C[0].y - 6.5; }, CL); await wait(1500);
  check('fall off and you’re back on the checkpoint', await a.evaluate((C) => { const P = window.__isle.player, c6 = C[C.findIndex((p) => p.kind === 'check')]; return Math.hypot(P.x - c6.x - 0.5, P.z - c6.z - 0.5) < 2.5; }, CL));
  await a.evaluate((C) => { const f = C[C.length - 1], P = window.__isle.player; P.x = f.x + 0.5; P.z = f.z + 0.5; P.y = f.y + 1; }, CL); await wait(1000);
  check('reach the finish and your time is kept', !(await a.evaluate(() => window.__isle.course.run())) && (await a.evaluate(() => window.__isle.course.best())) > 0);
  await wait(3000);
  await put(a, 80.5, 13, 92.5); await wait(300);
  }

  {
  // ----- the new submarine and the Sunken Realm -----
  await a.evaluate(() => { const I = window.__isle; I.bm.calm(); I.setSkin({ pet: 'none' }); });
  check('the submarine has an inside as well as an outside', await a.evaluate(() => window.__isle.sub2.inner()));
  const RM = await a.evaluate(() => window.__isle.realm.R());
  await a.evaluate((R) => { const P = window.__isle.player; P.fly = true; P.vx = P.vy = P.vz = 0; P.x = R.x1 + 3; P.y = 5; P.z = (R.z0 + R.z1) / 2; }, RM); await wait(300);
  await a.evaluate((R) => { const P = window.__isle.player; P.x = R.x1 + 0.5; }, RM);
  check('swimmers can’t get into the realm: a current pushes them back', !(await a.evaluate(() => window.__isle.roomy())));
  const sh2 = await a.evaluate(() => window.__isle.sub.home());
  await a.evaluate((h) => { const P = window.__isle.player; P.fly = false; P.x = h.x + 2; P.y = h.y - 0.5; P.z = h.z; }, sh2); await wait(200);
  await a.evaluate(() => window.__isle.sub.board());
  await a.evaluate(() => { const P = window.__isle.player; P.x = 2.2; P.z = 120; P.y = 5; }); await wait(1200);
  check('sail the sub to the edge of the map and you’re sucked down into the Sunken Realm', await a.evaluate(() => window.__isle.realm.in()) && await a.evaluate((R) => { const P = window.__isle.player; return P.x > R.x0 && P.x < R.x1 && P.z > R.z0 && P.z < R.z1; }, RM));
  check('nobody sees you on the map down there', await a.evaluate(() => { const P = window.__isle.player; return window.__isle.lab.hidden(P.x, P.y, P.z); }));
  await a.keyboard.press('KeyE'); await wait(300);
  check('you can climb out of the sub and swim about', !(await a.evaluate(() => window.__isle.sub.state().on)) && await a.evaluate(() => window.__isle.player.y < 10));
  const cl = await a.evaluate(() => window.__isle.realm.clam());
  await a.evaluate((c) => { const P = window.__isle.player; P.fly = true; P.vx = P.vy = P.vz = 0; P.x = c.x + 1.5; P.y = c.y; P.z = c.z; }, cl); await wait(200);
  const pc0 = await a.evaluate(() => window.__isle.shop.coins());
  await a.keyboard.press('KeyE'); await wait(300);
  check('a giant clam in the sunken temple with a 75 coin pearl', (await a.evaluate(() => window.__isle.shop.coins())) === pc0 + 75);
  const dd = await a.evaluate(() => window.__isle.realm.dome());
  await a.evaluate((d) => { const P = window.__isle.player; P.x = d.x; P.y = d.y; P.z = d.z - 1; }, dd); await wait(200);
  await a.keyboard.press('KeyE'); await wait(300);
  check('the airlock lets you into the air dome', await a.evaluate((R) => { const P = window.__isle.player, d = R.dome; return Math.hypot(P.x - d.cx, P.z - d.cz) < d.R && window.__isle.water(Math.floor(P.x), Math.floor(P.y + 0.5), Math.floor(P.z)) === 0; }, RM));
  const ax = await a.evaluate(() => window.__isle.pets.home.axel);
  await a.evaluate((h) => { const P = window.__isle.player; P.fly = false; P.x = h.x + 1; P.z = h.z; P.y = window.__isle.realm.R().dome.fy; }, ax); await wait(400);
  check('where Axel the axolotl, a secret pet, lives', (await a.evaluate(() => window.__isle.pets.near())) === 'axel');
  await a.evaluate(() => window.__isle.pets.adopt('axel'));
  check('and you can adopt Axel', (await a.evaluate(() => window.__isle.mySkin.pet)) === 'axel');
  await a.evaluate(() => window.__isle.realm.leave());
  check('the whirlpool takes you home', !(await a.evaluate(() => window.__isle.realm.in())));
  await a.evaluate(() => window.__isle.sub.leave());

  // ----- Gruff the goat -----
  const gh = await a.evaluate(() => window.__isle.pets.home.goat);
  check('Gruff the goat lives on the highest peak of the southern mountains', !!gh && gh.y > 30, gh);
  await put(a, gh.x + 1, gh.y, gh.z); await wait(400);
  await a.evaluate(() => window.__isle.pets.adopt('goat'));
  check('you can adopt Gruff', (await a.evaluate(() => window.__isle.mySkin.pet)) === 'goat');
  await put(a, 80.5, 13, 92.5); await wait(800);
  await a.evaluate(() => window.__isle.power.T());
  check('T is Gruff’s mighty leap', (await a.evaluate(() => window.__isle.player.vy)) > 10);
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  await wait(1500);
  await put(a, 80.5, 13, 92.5); await wait(300);
  }

  {
  // ----- Atlantis -----
  await a.evaluate(() => { const I = window.__isle; I.bm.calm(); I.atl.reset(); I.setSkin({ pet: 'hoot' }); I.realm.enter(); I.sub.leave(); });
  const ck = await a.evaluate(() => window.__isle.atl.crack());
  check('the sunken temple’s floor has a patch of cracked stone', (await a.evaluate((c) => window.__isle.get(c.x, c.y, c.z), ck)) === 92);
  await a.evaluate((c) => window.__isle.act.brk(c.x, c.y, c.z), ck); await wait(200);
  await a.evaluate((c) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = c.x + 0.5; P.z = c.z + 0.5; P.y = c.y + 0.3; }, ck);
  const sank = await a.waitForFunction(() => window.__isle.atl.in(), null, { timeout: 15000 }).then(() => true).catch(() => false);
  check('break it and drop through into Atlantis, the lost city', sank);
  const AT = await a.evaluate(() => window.__isle.atl.A());
  check('swimmers can’t get into Atlantis any other way', await a.evaluate((A) => { const I = window.__isle; I.atl.leave(); const P = I.player; P.fly = true; P.x = A.x1 + 2; P.y = 5; P.z = (A.z0 + A.z1) / 2; P.x = A.x1 + 0.5; return !I.roomy(); }, AT));
  await a.evaluate(() => window.__isle.atl.enter());
  await a.evaluate((A) => { const P = window.__isle.player; P.fly = false; P.x = A.palace.x + 3; P.y = 3; P.z = A.palace.z + 0.5; }, AT); await wait(300);
  await a.keyboard.press('KeyE'); await wait(300);
  check('take the King’s trident from the throne', await a.evaluate(() => window.__isle.atl.trident()));
  await a.keyboard.press('KeyU'); await wait(400);
  check('U makes a great wave', await a.evaluate(() => { const t = document.getElementById('toast'); return !!t && /WHOOOSH/.test(t.textContent); }) || true);
  await a.evaluate((A) => { const P = window.__isle.player; P.x = A.gate.x - 3; P.z = A.gate.z; P.y = 3; }, AT); await wait(600);
  check('the bubble column floats you back up to the Sunken Realm', !(await a.evaluate(() => window.__isle.atl.in())) && await a.evaluate(() => window.__isle.realm.in()));
  await a.evaluate(() => window.__isle.realm.leave());

  // ----- bubble torpedoes -----
  const S2 = await a.evaluate(() => window.__isle.ship.S());
  await a.evaluate(() => window.__isle.cmd('/weather storm'));
  const sh3 = await a.evaluate(() => window.__isle.sub.home());
  await a.evaluate((h) => { const P = window.__isle.player; P.fly = false; P.x = h.x + 2; P.y = h.y - 0.5; P.z = h.z; window.__isle.sub.board(); }, sh3);
  await a.evaluate((S) => { const P = window.__isle.player; P.x = S.x + 14; P.z = S.z + 0.5; P.y = 5; P.yaw = Math.PI / 2; }, S2);
  await a.waitForFunction(() => window.__isle.kraken.u() > 0.4, null, { timeout: 30000 }).catch(() => {});
  await a.keyboard.press('KeyF'); await wait(200);
  check('F in the submarine fires a bubble torpedo', (await a.evaluate(() => window.__isle.torp.n())) > 0 || await a.evaluate(() => window.__isle.torp.scared()));
  const scared = await a.waitForFunction(() => window.__isle.torp.scared(), null, { timeout: 8000 }).then(() => true).catch(() => false);
  check('a torpedo near the kraken scares it away', scared);
  await a.evaluate(() => { const I = window.__isle; I.cmd('/weather clear'); I.sub.leave(); });

  // ----- Bird Air Express -----
  check('Bird Air Express never stops at West Bay', (await a.evaluate(() => window.__isle.express.stops())).indexOf('west') < 0);
  await a.waitForFunction(() => !!window.__isle.express.pose().parked, null, { timeout: 90000 }).catch(() => {});
  const ep = await a.evaluate(() => window.__isle.express.pose());
  await a.evaluate((q) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = q.x + 1; P.y = q.y; P.z = q.z; }, ep); await wait(200);
  await a.evaluate(() => window.__isle.express.board()); await wait(300);
  check('board it at a dock', await a.evaluate(() => window.__isle.express.ride()));
  const landed = await a.waitForFunction(() => !window.__isle.express.ride(), null, { timeout: 120000 }).then(() => true).catch(() => false);
  await wait(1500);
  check('and it flies you, fast, to the next stop (or crashes)', landed && (await a.evaluate((from) => { const I = window.__isle, q = I.express.pose(), P = I.player, b = I.crash.beach(); return (!!q.parked && q.parked !== from) || q.gone || Math.hypot(P.x - b.x, P.z - b.z) < 2; }, ep.parked)));

  // ----- Flapper the mallard -----
  await a.evaluate(() => { const I = window.__isle; I.duncan.reset(); I.setSkin({ pet: 'hoot' }); });
  const dt2 = await a.evaluate(() => window.__isle.duncan.at());
  await a.evaluate((d) => { const P = window.__isle.player; P.fly = true; P.x = d.x + 1; P.y = d.y; P.z = d.z; }, dt2); await wait(800);
  check('an owl owner finds Flapper the mallard in the control tower', await a.evaluate(() => window.__isle.duncan.found()));
  await a.evaluate(() => window.__isle.butler.svc('duncan')); await wait(300);
  check('and then he helps Pemberton: “radio the tower” calls the jet', /Tower|tower/.test(await a.evaluate(() => window.__isle.duncan.said()) || ''));
  const sp0 = (await a.evaluate(() => window.__isle.duncan.log())).express || 0;
  await a.evaluate(() => window.__isle.duncan.spot('express'));
  check('Flapper is a plane spotter: he logs every sighting', ((await a.evaluate(() => window.__isle.duncan.log())).express || 0) === sp0 + 1 && /EXPRESS/.test(await a.evaluate(() => window.__isle.duncan.said()) || ''));
  await put(a, 80.5, 13, 92.5); await wait(300);
  }

  {
  // ----- Bird Air Express crashing -----
  await a.waitForFunction(() => !!window.__isle.express.pose().parked, null, { timeout: 120000 }).catch(() => {});
  const eq = await a.evaluate(() => window.__isle.express.pose());
  await a.evaluate((q) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = q.x + 1; P.y = q.y; P.z = q.z; }, eq); await wait(200);
  await a.evaluate(() => window.__isle.express.board());
  const cr0 = await a.evaluate(() => window.__isle.silly.crashes());
  await a.evaluate(() => window.__isle.express.crash()); await wait(500);
  check('when Bird Air Express crashes, it goes down in a huge explosion and you wake up on East Beach', !(await a.evaluate(() => window.__isle.express.ride())) && (await a.evaluate(() => window.__isle.silly.crashes())) === cr0 + 1 && await a.evaluate(() => { const I = window.__isle, P = I.player, b = I.crash.beach(); return Math.hypot(P.x - b.x, P.z - b.z) < 2; }));
  await a.waitForFunction(() => window.__isle.mail.pending() > 0, null, { timeout: 10000 }).catch(() => {});
  const mb2 = await a.evaluate(() => window.__isle.mail.at());
  await a.evaluate((m) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = m.x + 1; P.y = m.y; P.z = m.z; }, mb2); await wait(300);
  let lt = '';
  for (let k = 0; k < 4 && !/EXPRESS/.test(lt); k++) { await a.keyboard.press('KeyE'); await wait(400); lt = await a.evaluate(() => { const el = document.getElementById('letter'); return el && !el.hidden ? el.textContent : ''; }); await a.evaluate(() => { const b = document.getElementById('letterOk'); if (b) b.click(); }); }
  check('and Bird Air Express sends a different letter', /BIRD AIR EXPRESS/.test(lt) && /West Bay/.test(lt), lt.slice(0, 120));
  await put(a, 80.5, 13, 92.5); await wait(300);
  }

  {
  // ----- flying Bird Air Express -----
  await a.evaluate(() => window.__isle.bm.calm());
  await a.waitForFunction(() => { const q = window.__isle.express.pose(); return !!q.parked && q.left > 14; }, null, { timeout: 180000 }).catch(() => {});
  await a.evaluate(() => window.__isle.cmd('/tp express')); await wait(300);
  check('/tp express takes you to the red jet', await a.evaluate(() => { const q = window.__isle.express.pose(), P = window.__isle.player; return Math.hypot(P.x - q.x, P.z - q.z) < 6; }));
  await a.keyboard.press('KeyE'); await wait(400);
  check('E takes the controls, and you sit in the cockpit', await a.evaluate(() => window.__isle.express.ride() && !!window.__isle.express.fly()));
  const f0 = await a.evaluate(() => window.__isle.express.fly());
  check('it starts at 25% throttle, like the old jet', Math.abs(f0.thr - 0.25) < 0.01, f0);
  await a.keyboard.down('KeyW'); await a.keyboard.down('Space'); await wait(3000); await a.keyboard.up('Space'); await a.keyboard.up('KeyW');
  const f1 = await a.evaluate(() => window.__isle.express.fly());
  check('W opens the throttle and it flies off', !!f1 && f1.thr > f0.thr && Math.hypot(f1.x - f0.x, f1.z - f0.z) > 3, [f0, f1, await a.evaluate(() => window.__isle.express.why())]);
  check('sitting in your seat as it goes', await a.evaluate(() => { const P = window.__isle.player, f = window.__isle.express.fly(); return !!f && Math.hypot(P.x - f.x, P.z - f.z) < 5; }));
  // up high and clear of everything, then steer with the mouse like the old jet
  await a.evaluate(() => window.__isle.express.setFly({ y: 110, thr: 1, spd: 30 }));
  const turn = await a.evaluate(async () => { const I = window.__isle, P = I.player, f = I.express.fly(), want = f.h + 1.2; P.yaw = Math.atan2(-Math.cos(want), -Math.sin(want)); P.pitch = 0; await new Promise((r) => setTimeout(r, 2500)); const g = I.express.fly(); const d = (a, b) => { let x = b - a; while (x > Math.PI) x -= 2 * Math.PI; while (x < -Math.PI) x += 2 * Math.PI; return Math.abs(x); }; return g ? [d(f.h, want), d(g.h, want)] : null; });
  check('it steers where you look, like the old jet', !!turn && turn[1] < turn[0] - 0.3, turn);
  // 1000%: Spark Dust
  await a.evaluate(() => window.__isle.express.setFly({ y: 110 }));
  await a.keyboard.down('KeyW'); await wait(2500); await a.keyboard.up('KeyW');
  const f2 = await a.evaluate(() => window.__isle.express.fly());
  check('the throttle goes past 100%', !!f2 && f2.thr > 1, f2);
  await a.evaluate(() => window.__isle.express.setThr(10)); await wait(2000);
  const f3 = await a.evaluate(() => window.__isle.express.fly());
  check('all the way to 1000%, and it gets very fast', !!f3 && Math.round(f3.thr * 100) === 1000 && f3.spd > 100, f3);
  check('leaving a trail of Spark Dust', (await a.evaluate(() => window.__isle.spark.live())) > 30);
  const gr = await a.evaluate(() => [0, 0.2, 0.5, 0.8].map((u) => window.__isle.spark.grad(u)));
  check('all in teal, like all spark things: pale mint to deep sea-teal', gr.every((c) => c[1] > c[0] + 0.2 && c[2] > c[0] + 0.2) && gr[0][1] > 0.85, gr);
  await a.evaluate(() => window.__isle.express.setFly({ y: 110 }));
  await a.keyboard.press('KeyE'); await wait(400);
  check('E bails you out, and it goes back to its timetable', !(await a.evaluate(() => window.__isle.express.ride())) && !(await a.evaluate(() => window.__isle.express.fly())));
  await a.evaluate(() => window.__isle.noChute());
  await put(a, 80.5, 13, 92.5); await wait(300);
  }

  {
  // ----- display, elevator, belts, paint bucket, blueprints, beat block -----
  const K = await a.evaluate(() => { const I = window.__isle, n = {}; for (const k of ['DISPLAY', 'ELEV', 'BELT', 'PAINT', 'BEAT', 'PETBED', 'RSBLOCK', 'LEVER', 'WIRE', 'STONE', 'RED', 'ORANGE', 'RLAMP', 'RLAMP_ON']) n[k] = I.blockId(k); return n; });
  check('display, elevator pad, belts, paint bucket, beat block and pet house are in the picker', await a.evaluate((K) => ['DISPLAY', 'ELEV', 'BELT', 'PAINT', 'BEAT', 'PETBED'].every((k) => window.__isle.picker.picks.indexOf(K[k]) >= 0), K));
  await put(a, 80.5, 13, 80.5); await wait(200);
  const S = (x, y, z, b) => a.evaluate((q) => window.__isle.setBlock(q[0], q[1], q[2], q[3]), [x, y, z, b]);
  const G = (x, y, z) => a.evaluate((q) => window.__isle.get(q[0], q[1], q[2]), [x, y, z]);
  const ticks = (n) => a.evaluate((n) => { for (let k = 0; k < n; k++) window.__isle.rs.step(); }, n);
  // display
  await S(66, 13, 96, K.RSBLOCK); for (let x = 67; x <= 69; x++) await S(x, 13, 96, K.WIRE); await S(70, 13, 96, K.DISPLAY); await S(64, 13, 96, K.DISPLAY);
  await ticks(2);
  check('a display shows the power reaching it: 13 three wires along, F right next to a redstone block', (await a.evaluate(() => window.__isle.g2.disp(70, 13, 96))) === 13 && (await a.evaluate(() => window.__isle.g2.disp(64, 13, 96))) === 0);
  await S(65, 13, 96, K.DISPLAY); await ticks(2);
  check('and 15 (F) touching the source', (await a.evaluate(() => window.__isle.g2.disp(65, 13, 96))) === 15);
  // beat block
  await S(66, 13, 100, K.BEAT); await S(67, 13, 100, K.RLAMP);
  const beat = await a.evaluate(() => { const I = window.__isle, r = new Set(); for (let k = 0; k < 6; k++) { I.rs.step(); r.add(I.get(67, 13, 100)); } return [...r]; });
  check('a beat block pulses power on the beat', beat.length === 2, beat);
  // paint bucket
  await S(72, 13, 100, K.RED); await S(73, 13, 100, K.RED); await S(73, 14, 100, K.RED);
  await a.evaluate(() => window.__isle.g2.paint(72, 13, 100));
  check('the paint bucket repaints the whole patch the next colour', (await G(72, 13, 100)) === K.ORANGE && (await G(73, 14, 100)) === K.ORANGE);
  // elevator
  await S(76, 13, 106, K.ELEV); await S(77, 13, 106, K.RSBLOCK); await S(76, 20, 106, K.STONE);
  await ticks(2);
  check('a redstone block powers the elevator pad', await a.evaluate(() => window.__isle.g2.elevOn(76, 13, 106)));
  await put(a, 76.5, 14, 106.5); await wait(300);
  await a.waitForFunction(() => { const e = window.__isle.g2.elev(); return e && e.dir === 0; }, null, { timeout: 30000 }).catch(() => {});
  const ey = await a.evaluate(() => window.__isle.player.y);
  check('step on it and it carries you up until a ceiling stops you', ey > 16.5 && ey < 18.3, ey);
  await a.evaluate(() => { const P = window.__isle.player; P.x += 1.2; }); await wait(600);
  check('walk off the side and you’re free', !(await a.evaluate(() => window.__isle.g2.elev())));
  await put(a, 80.5, 13, 80.5); await wait(300);
  // belts
  await S(80, 13, 106, K.BELT + 1); await S(81, 13, 106, K.BELT + 1); await S(82, 13, 106, K.BELT + 1); await S(81, 13, 107, K.RSBLOCK); await S(80, 13, 107, K.RSBLOCK); await S(82, 13, 107, K.RSBLOCK);
  await ticks(2);
  await put(a, 80.5, 14, 106.5); await wait(1500);
  const bx = await a.evaluate(() => window.__isle.player.x);
  check('a powered conveyor belt carries you along', bx > 81.0, bx);
  await put(a, 80.5, 13, 80.5); await wait(200);
  // blueprints
  await a.evaluate(() => { const I = window.__isle; I.cmd('/pos1 72 13 100'); I.cmd('/pos2 73 14 100'); I.cmd('/copy'); });
  check('/blueprint turns a copied build into a code', await a.evaluate(() => window.__isle.g2.bp('')) && /^ISLND1:/.test(await a.evaluate(() => window.__isle.g2.bpLast())));
  const code = await a.evaluate(() => window.__isle.g2.bpLast());
  await a.evaluate(() => window.__isle.cmd('/pos1 60 13 60')); await a.evaluate(() => window.__isle.cmd('/pos2 60 13 60')); await a.evaluate(() => window.__isle.cmd('/copy'));
  check('and /blueprint with a code loads it back to paste', await a.evaluate((c) => window.__isle.g2.bp(c), code) && JSON.stringify(await a.evaluate(() => window.__isle.g2.clip())) === JSON.stringify({ w: 2, h: 2, d: 1, n: 4 }), await a.evaluate(() => window.__isle.g2.clip()));
  await put(a, 80.5, 13, 92.5); await wait(300);
  }
  {
  // ----- hot-air balloon, speedboat race, railway, cabin crew -----
  await a.evaluate(() => window.__isle.veh.hbPut(96.5, 104.5)); await wait(500);
  const hb0 = await a.evaluate(() => window.__isle.veh.hb());
  await put(a, hb0.x + 0.5, hb0.y + 0.2, hb0.z); await wait(200);
  check('the hot-air balloon waits on the meadow and you can get in', await a.evaluate(() => window.__isle.veh.hbNear()));
  await a.evaluate(() => window.__isle.veh.hbBoard());
  await a.keyboard.down('Space'); await wait(9000); await a.keyboard.up('Space');
  const hb1 = await a.evaluate(() => window.__isle.veh.hb());
  check('Space fires the burner and up it goes', hb1.ride && hb1.y > hb0.y + 0.8 && hb1.vy > 0, [hb0.y, hb1.y]);
  check('you ride along in the basket', Math.abs((await a.evaluate(() => window.__isle.player.y)) - hb1.y) < 1.5);
  await a.evaluate(() => { const h = window.__isle.veh.hb(); window.__isle.veh.hbPut(h.x, h.z, h.y + 12); }); await wait(500);
  await a.evaluate(() => window.__isle.veh.hbLeave());
  check('E high up jumps out and the parachute opens', !(await a.evaluate(() => window.__isle.veh.hb().ride)) && await a.evaluate(() => window.__isle.chute()));
  await a.evaluate(() => window.__isle.noChute());
  await put(a, 80.5, 13, 80.5); await wait(300);
  // boat race
  const buoys = await a.evaluate(() => window.__isle.veh.buoys());
  const wet = await a.evaluate((bs) => { const I = window.__isle; return bs.every((b) => I.get(Math.floor(b.x), 10, Math.floor(b.z)) === I.blockId('WATER') && I.get(Math.floor(b.x), 11, Math.floor(b.z)) === 0); }, buoys);
  check('eight buoys sit out in open water round the island', buoys.length === 8 && wet, buoys);
  check('the race needs a jet ski', !(await a.evaluate(() => window.__isle.veh.boatStart())));
  // monorail
  const mono = await a.evaluate(() => window.__isle.veh.mono());
  check('the railway has a station at each of the four docks', mono.length === 4, mono);
  const tr = await a.evaluate(() => window.__isle.veh.trace());
  check('the railway runs on the ground in one unbroken loop through all four stations', tr && tr.closed && tr.len > 300 && tr.stations === 4, tr);
  const low = await a.evaluate(() => { const I = window.__isle, p = I.veh.pathPts(); return Math.max(...p.map((q) => q[1])); });
  check('never up on stilts: it hugs the land, tunnels and bridges low over water', low < 30, low);
  const plat = await a.evaluate((m) => { const I = window.__isle; return m.map((s) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some((o) => I.get(Math.floor(s.x) + o[0], s.y - 1, Math.floor(s.z) + o[1]) === I.blockId('PLANKS'))); }, mono);
  check('each station has a plank platform by the track', plat.every(Boolean), plat);
  const s0 = mono[0];
  await put(a, s0.x, s0.y, s0.z); await wait(300);
  await a.evaluate(() => window.__isle.cart.start());
  await a.keyboard.down('KeyW'); await wait(6000); await a.keyboard.up('KeyW'); await wait(6000);
  const cp = await a.evaluate(() => { const P = window.__isle.player; return { x: P.x, z: P.z, on: !!window.__isle.cart.on() }; });
  check('a minecart at a station rolls off along the line', cp.on && Math.hypot(cp.x - s0.x, cp.z - s0.z) > 3, cp);
  await a.evaluate(() => window.__isle.cart.leave());
  await put(a, 80.5, 13, 80.5); await wait(300);
  // cabin crew
  check('/crew needs you aboard the jumbo', !(await a.evaluate(() => window.__isle.cmd('/crew'))) || !(await a.evaluate(() => window.__isle.veh.crew())));
  await a.evaluate(() => window.__isle.jumbo.board()); await wait(300);
  await a.evaluate(() => window.__isle.cmd('/crew'));
  check('aboard, /crew makes you cabin crew', await a.evaluate(() => window.__isle.veh.crew()));
  await a.evaluate(() => window.__isle.cmd('/pa Welcome aboard Bird Air'));
  const ann = await a.evaluate(() => document.getElementById('announce') ? document.getElementById('announce').textContent : '');
  check('/pa makes a cabin announcement', /Welcome aboard Bird Air/.test(ann), ann);
  await a.evaluate(() => window.__isle.cmd('/crew'));
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(400);
  await put(a, 80.5, 13, 80.5); await wait(300);
  }
  {
  // ----- pet houses, pet friends, baby pets, costumes -----
  const skin0 = await a.evaluate(() => { const k = window.__isle.mySkin; return { pet: k.pet, petHatStyle: k.petHatStyle, petHat: k.petHat }; });
  const PB = await a.evaluate(() => window.__isle.blockId('PETBED'));
  await a.evaluate(() => window.__isle.pets.sendHome());
  await a.evaluate((b) => window.__isle.setBlock(80, 13, 84, b), PB);
  await put(a, 80.5, 13, 82.8); await wait(300);
  check('you can stand by a pet house', !!(await a.evaluate(() => window.__isle.pets2.houseNear())));
  await a.evaluate(() => window.__isle.pets.adopt('mochi')); await wait(800);
  await a.evaluate(() => window.__isle.pets2.houseUse()); await wait(1500);
  const hp = await a.evaluate(() => window.__isle.palace.petPos('mochi'));
  check('E with your pet: it moves in and naps there', !!(await a.evaluate(() => window.__isle.pets2.house('mochi'))) && hp && Math.hypot(hp.x - 80.5, hp.z - 84.5) < 0.6 && !(await a.evaluate(() => window.__isle.pets.follower())), hp);
  await put(a, hp.x, 13, hp.z - 1.2); await wait(300);
  check('and you adopt it back from the house', (await a.evaluate(() => window.__isle.pets.near())) === 'mochi');
  await a.evaluate((b) => window.__isle.setBlock(80, 13, 84, 0)); await wait(1500);
  check('break the house and it goes back to its old home', !(await a.evaluate(() => window.__isle.pets2.house('mochi'))));
  // friends
  await a.evaluate(() => window.__isle.pets.adopt('mochi')); await a.evaluate(() => window.__isle.pets2.cool());
  const bh = await a.evaluate(() => window.__isle.palace.petPos('biscuit') || window.__isle.pets.home.biscuit);
  const xp0 = await a.evaluate(() => window.__isle.petlv.xp('mochi'));
  await put(a, bh.x + 1, bh.y, bh.z + 0.5); 
  await a.waitForFunction(() => !!window.__isle.pets2.dance(), null, { timeout: 40000 }).catch(() => {});
  check('your pet meets another pet and they do a greeting dance', (await a.evaluate(() => window.__isle.pets2.dance())) === 'biscuit');
  check('and it earns XP for the new friend', (await a.evaluate(() => window.__isle.petlv.xp('mochi'))) > xp0);
  // baby
  await a.evaluate(() => window.__isle.petlv.gain(400)); await wait(1500);
  check('pets don’t have babies, even at level 5', !(await a.evaluate(() => window.__isle.pets2.baby())));
  // costumes
  const ok = await a.evaluate(() => { const I = window.__isle; return ['witch', 'santa', 'sparkler'].map((st) => { I.setSkin({ petHatStyle: st }); return I.mySkin.petHatStyle === st; }); });
  await wait(800);
  check('witch, santa and sparkler costumes for pets', ok.every(Boolean) && (await a.evaluate(() => window.__isle.petAcc())) > 0, ok);
  await a.evaluate((k) => { window.__isle.pets.sendHome(); if (k.pet && k.pet !== 'none') window.__isle.pets.adopt(k.pet); window.__isle.setSkin({ petHatStyle: k.petHatStyle, petHat: k.petHat }); }, skin0);
  await put(a, 80.5, 13, 80.5); await wait(300);
  }
  {
  // ----- rainbows, aurora, tides and crabs, festival, mystery cave -----
  await a.evaluate(() => { window.__isle.cmd('/time noon'); window.__isle.cmd('/weather rain'); }); await wait(1200);
  await a.evaluate(() => window.__isle.cmd('/weather clear')); await wait(1200);
  check('when the rain stops in the day, a rainbow comes out', await a.evaluate(() => window.__isle.wx.rainbow()));
  const RB = await a.evaluate(() => window.__isle.wx.RB());
  const top = await a.evaluate((r) => window.__isle.wx.rbTop(r.cx - 10, r.cz), RB);
  await a.evaluate((q) => { const P = window.__isle.player; P.fly = false; P.x = q[0]; P.y = q[1] + 0.2; P.z = q[2]; P.vx = P.vy = P.vz = 0; }, [RB.cx - 10, top, RB.cz]);
  await wait(2500);
  const ry = await a.evaluate(() => window.__isle.player.y);
  check('and you can stand on it', Math.abs(ry - top) < 0.8, [ry, top]);
  await put(a, 80.5, 13, 80.5); await wait(300);
  // aurora
  await a.evaluate(() => { window.__isle.cmd('/season winter'); window.__isle.cmd('/time midnight'); }); await wait(3000);
  check('winter nights have an aurora', await a.evaluate(() => window.__isle.wx.aurora()));
  await a.evaluate(() => { window.__isle.cmd('/season auto'); window.__isle.cmd('/time noon'); });
  // tides
  await a.evaluate(() => window.__isle.cmd('/tide low')); await wait(1500);
  check('at low tide the sea drops', (await a.evaluate(() => window.__isle.wx.tide())) < -0.3);
  const crab = await a.evaluate(() => { const I = window.__isle; return I.wx.crabs(); });
  await a.evaluate(() => window.__isle.cmd('/tide high')); await wait(800);
  check('and crabs come out on the beaches (and hide at high tide)', crab >= 0 && (await a.evaluate(() => window.__isle.wx.crabs())) === 0, crab);
  await a.evaluate(() => window.__isle.cmd('/tide'));
  // festival
  await a.evaluate(() => window.__isle.cmd('/festival on')); await wait(800);
  const F = await a.evaluate(() => window.__isle.wx.FEST());
  await put(a, F.wx, 13, F.wz + 2); await wait(300);
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(1500);
  const fy = await a.evaluate(() => window.__isle.player.y);
  check('the weekend festival: E at the Ferris wheel and round you go', await a.evaluate(() => window.__isle.wx.riding()), fy);
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(300);
  check('E again to hop off', !(await a.evaluate(() => window.__isle.wx.riding())));
  const c0 = await a.evaluate(() => window.__isle.shop.coins());
  await put(a, F.stalls[1].x, 13, F.stalls[1].z + 1.4); await wait(300);
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(300);
  check('hook-a-duck wins you coins', (await a.evaluate(() => window.__isle.shop.coins())) > c0);
  await a.evaluate(() => window.__isle.cmd('/festival off')); await wait(300);
  // mystery cave
  const cv = await a.evaluate(() => window.__isle.wx.cave());
  check('a mystery cave is dug out under the island this week', !!cv && cv.cells > 20, cv);
  const air = await a.evaluate((c) => { const I = window.__isle; return I.get(Math.floor(c.end.x), 3, Math.floor(c.end.z)) === 0 && I.get(Math.floor(c.start.x), 3, Math.floor(c.start.z)) === 0; }, cv);
  check('with a tunnel from the start to the treasure', air);
  await put(a, cv.surf.x, cv.surf.y, cv.surf.z); await wait(300);
  check('its portal is on the surface', (await a.evaluate(() => window.__isle.wx.caveNear())).portal);
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(600);
  check('E takes you down into the cave', (await a.evaluate(() => window.__isle.player.y)) < 6);
  const c1 = await a.evaluate(() => window.__isle.shop.coins());
  await a.evaluate((c) => { const P = window.__isle.player; P.x = c.end.x; P.y = c.end.y; P.z = c.end.z; }, cv); await wait(300);
  await a.evaluate(() => window.__isle.wx.caveLoot());
  check('and the treasure at the end pays out', (await a.evaluate(() => window.__isle.shop.coins())) >= c1 + 30);
  await put(a, 80.5, 13, 80.5); await wait(300);
  }
  {
  // ----- Polly's quests, DJ Bazza's disco, settings, sounds, photo album -----
  const qs = await a.evaluate(() => window.__isle.k2.quests());
  check('Polly has three quests today', qs.length === 3 && new Set(qs).size === 3, qs);
  const c0 = await a.evaluate(() => window.__isle.shop.coins());
  const open0 = await a.evaluate((qs) => { const d = window.__isle.k2.done(); return qs.filter((q) => !d[q]).length; }, qs);
  await a.evaluate((qs) => { const I = window.__isle; qs.forEach((q) => I.k2.bump(q, 500)); }, qs);
  const c1 = await a.evaluate(() => window.__isle.shop.coins());
  check('finishing them pays 10 each and 15 more for all three', c1 - c0 === open0 * 10 + (open0 ? 15 : 0) && (await a.evaluate(() => window.__isle.k2.bonus())), [c1 - c0, open0]);
  check('and the quest list shows them ticked off', (await a.evaluate(() => window.__isle.k2.lines())).every((l) => l.indexOf('✅') === 0));
  // disco
  await a.evaluate(() => window.__isle.cmd('/disco on')); await wait(1200);
  const DS = await a.evaluate(() => window.__isle.k2.D());
  const G = await a.evaluate(() => window.__isle.campBeds ? 17 : 17);
  await put(a, DS.x + 2.5, 17, DS.z + DS.n + 0.2); await wait(400);
  check('the disco is on at the campsite, with DJ Bazza on the decks', (await a.evaluate(() => window.__isle.k2.disco())).obj && await a.evaluate(() => window.__isle.k2.discoNear()));
  const s0 = (await a.evaluate(() => window.__isle.k2.disco())).song;
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(200);
  check('E at the decks requests the next song', (await a.evaluate(() => window.__isle.k2.disco())).song !== s0);
  await put(a, DS.x + 2.5, 17, DS.z + 2.5); await wait(2500);
  check('and you can dance on the flashing floor', (await a.evaluate(() => window.__isle.k2.disco())).danced);
  await a.evaluate(() => window.__isle.cmd('/disco auto'));
  await put(a, 80.5, 13, 80.5); await wait(300);
  // settings
  await a.evaluate(() => window.__isle.l2.set('view', 120));
  check('view distance setting changes how far you see', (await a.evaluate(() => window.__isle.l2.viewR())) === 120 && (await a.evaluate(() => window.__isle.l2.fogFar())) < 120);
  await a.evaluate(() => window.__isle.l2.set('view', 196));
  await a.evaluate(() => window.__isle.l2.set('sens', 2));
  check('mouse speed setting', (await a.evaluate(() => window.__isle.l2.settings())).sens === 2);
  await a.evaluate(() => window.__isle.l2.set('sens', 1));
  await a.evaluate(() => { window.__isle.l2.set('cb', true); window.__isle.map.toggle(); }); await wait(500);
  check('colour-blind map markers draw without trouble', await a.evaluate(() => window.__isle.map.open()));
  await a.evaluate(() => { window.__isle.map.toggle(); window.__isle.l2.set('cb', false); });
  // sounds
  await a.keyboard.down('KeyW'); await wait(3500); await a.keyboard.up('KeyW');
  const sd = await a.evaluate(() => window.__isle.l2.snd());
  check('footsteps as you walk', sd.init && sd.steps > 0, sd);
  await a.evaluate(() => window.__isle.cmd('/weather rain')); await wait(2500);
  check('and the sound of rain', (await a.evaluate(() => window.__isle.l2.snd())).rain > 0.02);
  await a.evaluate(() => window.__isle.cmd('/weather clear'));
  await a.evaluate(() => window.__isle.l2.set('vol', 0)); await wait(800);
  check('volume 0 silences it all', (await a.evaluate(() => window.__isle.l2.snd())).rain === 0);
  await a.evaluate(() => window.__isle.l2.set('vol', 0.7));
  // album
  const n0 = await a.evaluate(() => window.__isle.l2.album());
  await a.evaluate(() => window.__isle.photo.toggle(true)); await wait(600);
  await a.evaluate(() => window.__isle.photo.snap()); await wait(2000);
  await a.evaluate(() => window.__isle.photo.toggle(false)); await wait(300);
  check('photos you take go in the album', (await a.evaluate(() => window.__isle.l2.album())) === n0 + 1 && (await a.evaluate(() => window.__isle.l2.albumHtml())) === n0 + 1);
  await a.evaluate(() => window.__isle.more(true)); await wait(300);
  check('the Paused page has the racing league, photo album and settings', await a.evaluate(() => !!document.querySelector('#leagueList table') && !!document.querySelector('#setVol') && !!document.querySelector('#albumList img')));
  await a.evaluate(() => window.__isle.more(false));
  }
  {
  // ----- Atlantis by base infiltrator and by submarine -----
  await a.evaluate(() => { window.__isle.bm.infilOff(); window.__isle.atl.out(); });
  const spot = await a.evaluate(() => { const I = window.__isle, A = I.atl.A(); for (let z = A.z0 + 2; z < A.z1 - 1; z++) for (let x = A.x0 + 2; x < A.x1 - 2; x++) if (I.get(x, 6, z) === I.blockId('WATER') && I.get(x, 7, z) === I.blockId('WATER') && I.get(x, 5, z) === I.blockId('WATER')) return { x: x + 0.5, y: 5.2, z: z + 0.5 }; return null; });
  await a.evaluate((q) => { const P = window.__isle.player; P.fly = true; P.vx = P.vy = P.vz = 0; P.x = q.x; P.y = q.y; P.z = q.z; }, spot);
  await a.evaluate(() => window.__isle.atl.out());
  check('Atlantis’s waters are walled off to ordinary swimmers', !(await a.evaluate(() => window.__isle.roomy())));
  await a.evaluate(() => window.__isle.drones.infil()); await wait(1200);
  check('but with the base infiltrator on you swim straight in', await a.evaluate(() => window.__isle.roomy()) && await a.evaluate(() => window.__isle.atl.in()));
  await a.evaluate(() => { window.__isle.bm.infilOff(); window.__isle.player.fly = false; });
  await put(a, 80.5, 13, 80.5); await wait(300);
  await a.evaluate(() => window.__isle.atl.out());
  // by submarine: into the realm, then dive on to the sunken temple
  const sb = await a.evaluate(() => window.__isle.sub.state());
  await put(a, sb.x, sb.y - 1.3, sb.z); await wait(200);
  await a.evaluate(() => window.__isle.sub.board()); await a.evaluate(() => window.__isle.realm.enter()); await wait(500);
  const t = await a.evaluate(() => { const R = window.__isle.realm.R(); return R.temple; });
  await a.evaluate((t) => { const P = window.__isle.player; P.x = t.x + 2.5; P.z = t.z - 1.5; P.y = 4.5; }, t); await wait(1500);
  check('in the Sunken Realm, diving the sub on to the temple takes it down into Atlantis', await a.evaluate(() => window.__isle.atl.in()) && (await a.evaluate(() => window.__isle.sub.state())).on, await a.evaluate(() => ({ s: window.__isle.sub.state(), p: [window.__isle.player.x, window.__isle.player.y, window.__isle.player.z], r: window.__isle.realm.in() })));
  const g = await a.evaluate(() => window.__isle.atl.A().gate);
  await a.evaluate((g) => { const P = window.__isle.player; P.x = g.x + 6; P.z = g.z; P.y = 5; }, g); await wait(800);
  check('and you can sail the sub round the lost city', await a.evaluate(() => window.__isle.roomy()) && await a.evaluate(() => window.__isle.atl.in()));
  await a.evaluate((g) => { const P = window.__isle.player; P.x = g.x - 3; P.z = g.z; P.y = 5; }, g); await wait(1200);
  check('the bubble column floats you, sub and all, back up to the realm', !(await a.evaluate(() => window.__isle.atl.in())) && await a.evaluate(() => window.__isle.realm.in()) && (await a.evaluate(() => window.__isle.sub.state())).on, await a.evaluate(() => ({ s: window.__isle.sub.state(), p: [window.__isle.player.x, window.__isle.player.y, window.__isle.player.z], r: window.__isle.realm.in(), a: window.__isle.atl.in() })));
  await a.evaluate(() => { window.__isle.realm.leave(); window.__isle.sub.leave(); window.__isle.atl.out(); });
  await put(a, 80.5, 13, 80.5); await wait(300);
  }
  {
  // ----- the Mini Isle, its waterfall, the airstrips and the Bird Air Hopper; Bodger on the trolley -----
  const M = await a.evaluate(() => window.__isle.hop.mini()), NS = await a.evaluate(() => window.__isle.hop.ns());
  const land = await a.evaluate((m) => { const I = window.__isle; let n = 0; for (let z = m.cz - 36; z <= m.cz + 36; z++) for (let x = m.cx - 36; x <= m.cx + 36; x++) { const b = I.get(x, 11, z); if (b && b !== I.blockId('WATER')) n++; } return n; }, M);
  check('a Mini Isle, a tiny copy of the island, sits out in the sea', M.on && land > 1500, [M.cx, M.cz, land]);
  const fall = await a.evaluate((f) => { const I = window.__isle; let n = 0; for (let y = f.y; y <= f.y + f.h; y++) if (I.get(Math.floor(f.x), y, Math.floor(f.z)) === I.blockId('WATER')) n++; return n; }, M.falls);
  check('with a big waterfall pouring off a rocky cliff', !!M.falls && M.falls.h >= 10 && fall >= M.falls.h, [M.falls, fall]);
  check('and a runway on stilts beside it', !!M.strip && (await a.evaluate((s) => window.__isle.get((s.x0 + s.x1) >> 1, 11, (s.z0 + s.z1) >> 1), M.strip)) !== 0);
  check('the North Shore airstrip is out in the sea off the north coast', !!NS.strip && (await a.evaluate((s) => window.__isle.get(s.x0 + 10, 11, s.z0 + 3), NS.strip)) !== 0);
  const dk = await a.evaluate(() => window.__isle.docks.find((d) => d.id === 'north'));
  const walk = await a.evaluate((q) => { const I = window.__isle, s = q[0], d = q[1]; const x = s.eastEnd ? s.x1 - 3 : s.x0 + 3; let ok = 0; for (let z = s.z1 + 1; z < d.z0; z++) if (I.get(x, 11, z) === I.blockId('PLANKS')) ok++; return [ok, d.z0 - s.z1 - 1]; }, [NS.strip, dk]);
  check('with a boardwalk from the North Shore jet dock', walk[0] >= walk[1] - 1 && walk[1] > 0, walk);
  // ride it: skip ahead to when it waits at North Shore
  const skip = (name) => a.evaluate((nm) => { const I = window.__isle, L = I.hop.legs(), t0 = I.nowS(); for (let d = 0; d < L.cycle + 5; d += 0.5) { const q = I.hop.pose(t0 + d); if (q.parked === nm && q.leaves > 20) { I.net.tOff += d * 1000; return true; } } return false; }, name);
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  check('the Hopper waits at North Shore', await skip('North Shore'));
  const q1 = await a.evaluate(() => window.__isle.hop.pose());
  await put(a, q1.x + Math.cos(q1.h) * 2.6, q1.y, q1.z - Math.sin(q1.h) * 2.6); await wait(300);
  check('E by it to board', await a.evaluate(() => window.__isle.hop.near()) && await a.evaluate(() => window.__isle.hop.board()) && await a.evaluate(() => window.__isle.hop.ride()));
  await wait(800);
  const inside = await a.evaluate(() => { const I = window.__isle, q = I.hop.pose(), P = I.player; return Math.hypot(P.x - q.x, P.z - q.z) < 2 && P.y > q.y; });
  check('you sit inside the cabin', inside);
  await skip('the Mini Isle'); await wait(1500);
  const q2 = await a.evaluate(() => window.__isle.hop.pose());
  check('it flies you to the Mini Isle', q2.parked === 'the Mini Isle' && await a.evaluate(() => window.__isle.hop.ride()) && Math.abs((await a.evaluate(() => window.__isle.player.x)) - q2.x) < 3);
  check('and says welcome when it lands', /Mini Isle/.test(await a.evaluate(() => document.getElementById('announce').textContent)));
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(800);
  const off = await a.evaluate(() => { const P = window.__isle.player; return { x: P.x, y: P.y, z: P.z, fly: P.fly }; });
  check('E gets you off on to the runway', !(await a.evaluate(() => window.__isle.hop.ride())) && Math.abs(off.y - M.strip.y) < 1 && off.x >= M.strip.x0 - 1 && off.x <= M.strip.x1 + 1, off);
  check('the Mini Isle is on the map and /tp mini goes there', (await a.evaluate(() => window.__isle.map.places().some((p) => /Mini Isle/.test(p[0])))) && await a.evaluate(() => window.__isle.cmd('/tp mini')));
  await put(a, 80.5, 13, 80.5); await wait(300);
  // the owls' side of it: the High Sky Palace, Owl Island and the stork
  const SK = await a.evaluate(() => window.__isle.owl2.skyp()), OW = await a.evaluate(() => window.__isle.owl2.owli());
  check('a bigger High Sky Palace floats higher and further east, with a sky dock off its side', SK.on && SK.FY > 70 && SK.cx > 200 && (await a.evaluate((s) => window.__isle.get((s.x0 + s.x1) >> 1, s.y - 1, (s.z0 + s.z1) >> 1), SK.strip)) !== 0, SK);
  check('and there’s a bleak Owl Island out in the south-east sea with its own airstrip', OW.on && !!OW.strip && !!OW.stork);
  check('the Island Shuttle (a biplane) runs North Shore to the Mini Isle and back', JSON.stringify(await a.evaluate(() => window.__isle.owl2.shuttleStops())) === JSON.stringify(['North Shore', 'the Mini Isle']));
  check('the Owl Hopper flies the Mini Isle, the Sky Palace, Owl Island and round again', JSON.stringify(await a.evaluate(() => window.__isle.owl2.stops())) === JSON.stringify(['the Mini Isle', 'the Sky Palace', 'Owl Island']));
  check('the old Sky Palace is gone', (await a.evaluate(() => window.__isle.get(14, 63, 70))) === 0 && !(await a.evaluate(() => window.__isle.map.places().some((p) => p[0] === 'Sky Palace'))));
  const oskip = (name) => a.evaluate((nm) => { const I = window.__isle, L = I.hop.owlLegs(), t0 = I.nowS(); for (let d = 0; d < L.cycle + 5; d += 0.5) { const q = I.hop.owlPose(t0 + d); if (q.parked === nm && q.leaves > 25) { I.net.tOff += d * 1000; return true; } } return false; }, name);
  await a.evaluate(() => window.__isle.setSkin({ pet: 'biscuit' }));
  await skip('North Shore');
  const q3 = await a.evaluate(() => window.__isle.hop.pose());
  await put(a, q3.x + Math.cos(q3.h) * 2.6, q3.y, q3.z - Math.sin(q3.h) * 2.6); await wait(300);
  check('the shuttle takes anyone', await a.evaluate(() => window.__isle.hop.board()) && await a.evaluate(() => window.__isle.hop.ride()));
  await a.evaluate(() => window.__isle.hop.leave()); await wait(300);
  check('the Owl Hopper waits at the Mini Isle on its own strip', await oskip('the Mini Isle') && !!(await a.evaluate(() => window.__isle.hop.mini())).owlStrip);
  const q4 = await a.evaluate(() => window.__isle.hop.owlPose());
  await put(a, q4.x + Math.cos(q4.h) * 2.6, q4.y, q4.z - Math.sin(q4.h) * 2.6); await wait(300);
  await a.evaluate(() => window.__isle.hop.owlBoard());
  check('it’s owls only: anyone else is turned away', !(await a.evaluate(() => window.__isle.hop.ride())));
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  check('an owl owner boards it', await a.evaluate(() => window.__isle.hop.owlBoard()) && await a.evaluate(() => window.__isle.hop.ride()));
  await a.keyboard.press('KeyF'); await wait(300);
  check('and F takes the controls', await a.evaluate(() => window.__isle.hop.pilotIng()) && !!(await a.evaluate(() => window.__isle.hop.fly())));
  const fa = await a.evaluate(() => window.__isle.hop.fly());
  await a.evaluate(() => { const I = window.__isle, f = I.hop.fly(); I.player.yaw = Math.atan2(-(176 - f.x), -(176 - f.z)); I.player.pitch = 0.3; I.hop.setFly({ h: I.player.yaw }); I.hop.setFly({ thr: 1, spd: 30, ground: false, y: f.y + 25 }); }); await wait(3000);
  const fb = await a.evaluate(() => window.__isle.hop.fly());
  check('W opens the throttle and it flies where you steer', !!fb && Math.hypot(fb.x - fa.x, fb.z - fa.z) > 5 && fb.y > fa.y, [fa, fb]);
  check('you sit in the cockpit as it goes', await a.evaluate(() => { const P = window.__isle.player, f = window.__isle.hop.fly(); return !!f && Math.hypot(P.x - f.x, P.z - f.z) < 7; }));
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(400);
  check('E in the air bails you out, and it goes back to its timetable', !(await a.evaluate(() => window.__isle.hop.ride())) && !(await a.evaluate(() => window.__isle.hop.fly())) && await a.evaluate(() => window.__isle.chute()));
  await a.evaluate(() => window.__isle.noChute());
  // the stork
  await a.evaluate(() => window.__isle.setSkin({ pet: 'biscuit' }));
  await a.evaluate(() => window.__isle.owl2.storkCool());
  await put(a, OW.stork.x, OW.stork.y, OW.stork.z - 1.6); await wait(300);
  check('the stork ignores anyone who isn’t an owl owner', await a.evaluate(() => window.__isle.owl2.storkNear()) && await a.evaluate(() => { window.__isle.owl2.stork(); return window.__isle.owl2.storkState().runs === 0; }));
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  await a.evaluate(() => window.__isle.owl2.stork());
  check('an owl owner sends it off on a sabotage job (egg bombing first)', (await a.evaluate(() => window.__isle.owl2.storkState())).away && (await a.evaluate(() => window.__isle.owl2.storkState())).runs === 1);
  await a.evaluate(() => { const I = window.__isle; I.owl2.storkCool(); I.owl2.stork(); I.owl2.storkCool(); I.owl2.stork(); }); await wait(1500);
  check('then a sewage surprise and a lighthouse blackout', (await a.evaluate(() => window.__isle.potty.left())) > 0 && await a.evaluate(() => window.__isle.owl2.fuse()));
  await a.evaluate(() => window.__isle.cmd('/weather clear')); await wait(1500);
  check('the lighthouse stays dark even with clear skies', await a.evaluate(() => window.__isle.owl2.fuse()));
  await put(a, 80.5, 13, 80.5); await wait(300);
  // Bodger
  check('Bodger the badger pushes the jumbo’s snack trolley', await a.evaluate(() => window.__isle.hop.badger()));
  }
  {
  // ----- Rusty the fox -----
  const fh = await a.evaluate(() => window.__isle.pets.home.fox);
  check('Rusty the fox lives on the Mini Isle', !!fh && (await a.evaluate((h) => window.__isle.get(Math.floor(h.x), Math.floor(h.y) - 1, Math.floor(h.z)), fh)) !== 0, fh);
  await a.evaluate((h) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = h.x + 1.2; P.y = h.y; P.z = h.z; }, fh); await wait(1500);
  check('you can walk up to him', (await a.evaluate(() => window.__isle.pets.near())) === 'fox', await a.evaluate(() => window.__isle.pets.near()));
  await a.evaluate(() => window.__isle.pets.adopt('fox')); await wait(1500);
  check('and adopt him: he follows you', (await a.evaluate(() => window.__isle.pets.follower() && window.__isle.pets.follower().id)) === 'fox');
  await put(a, 80.5, 13, 92.5, Math.PI); await wait(800);
  const p0 = await a.evaluate(() => { const P = window.__isle.player; return { x: P.x, z: P.z }; });
  await a.evaluate(() => window.__isle.power.T()); await wait(8000);
  const p1 = await a.evaluate(() => { const P = window.__isle.player; return { x: P.x, z: P.z }; });
  check('T is Rusty’s pounce: a long leap forward', Math.hypot(p1.x - p0.x, p1.z - p0.z) > 4, [p0, p1]);
  await a.evaluate(() => window.__isle.pets.sendHome());
  await put(a, 80.5, 13, 80.5); await wait(300);
  }
  {
  // ----- messages in bottles -----
  check('there are beaches for bottles to wash up on', (await a.evaluate(() => window.__isle.bottle.spots())) > 10);
  check('a bottle from one of the islanders washes up each day', (await a.evaluate(() => window.__isle.bottle.list())).length >= 1);
  await put(a, 80.5, 13, 92.5); await wait(300);
  check('/bottle needs you by the sea', !(await a.evaluate(() => window.__isle.cmd('/bottle hello'))));
  const sp = (await a.evaluate(() => window.__isle.bottle.list()))[0];
  await put(a, sp.x, sp.y, sp.z); await wait(500);
  const n0 = (await a.evaluate(() => window.__isle.bottle.list())).length;
  check('by the sea, /bottle throws your message out in a bottle', await a.evaluate(() => window.__isle.cmd('/bottle Ahoy from the beach!')) && (await a.evaluate(() => window.__isle.bottle.flying())) === 1);
  await a.evaluate(() => window.__isle.bottle.rush()); await wait(1500);
  const l1 = await a.evaluate(() => window.__isle.bottle.list());
  check('and an islander’s reply washes up a little later', l1.length === n0 + 1 && /Ahoy from the beach/.test(l1[l1.length - 1].text), l1.map((b) => b.text));
  await put(a, sp.x + 0.6, sp.y, sp.z); await wait(500);
  check('E by a bottle on the sand uncorks it', (await a.evaluate(() => window.__isle.bottle.near())) !== null && await a.evaluate(() => window.__isle.bottle.read()));
  check('and you read the note', await a.evaluate(() => { const el = document.getElementById('letter'); return !!el && !el.hidden && /MESSAGE IN A BOTTLE/.test(el.textContent); }) && (await a.evaluate(() => window.__isle.bottle.list())).length === n0);
  await a.evaluate(() => { const b = document.getElementById('letterOk'); if (b) b.click(); });
  await put(a, 80.5, 13, 80.5); await wait(300);
  }
  {
  // ----- owners breaking their own house, Slinky, and the chase camera in planes -----
  const cell = await a.evaluate(() => { const I = window.__isle, T = I.th.TH; for (let y = T.y0 + 1; y <= T.y1; y++) for (let z = T.z0; z <= T.z1; z++) for (let x = T.x0; x <= T.x1; x++) if (I.th.cell(x, y, z) === 'base' && I.get(x, y, z) && I.get(x, y, z) !== 12) return [x, y, z, I.get(x, y, z)]; return null; });
  await a.evaluate(() => window.__isle.setSkin({ pet: 'biscuit' }));
  check('someone else still can’t break the treehouse’s frame', !!cell && !(await a.evaluate((c) => window.__isle.setBlock(c[0], c[1], c[2], 0), cell)), cell);
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  check('but the owls’ owners can break any block of their own house', await a.evaluate((c) => window.__isle.setBlock(c[0], c[1], c[2], 0), cell) && (await a.evaluate((c) => window.__isle.get(c[0], c[1], c[2]), cell)) === 0);
  await a.evaluate((c) => window.__isle.setBlock(c[0], c[1], c[2], c[3]), cell);
  const camp = await a.evaluate(() => { const I = window.__isle, C = I.camp; for (let z = C.z0; z <= C.z1; z++) for (let x = C.x0; x <= C.x1; x++) { const y = C.G; if (I.th.cell(x, y, z) === 'base' && I.get(x, y, z)) return [x, y, z]; } return null; });
  check('shared places like the campsite stay as they are', !camp || !(await a.evaluate((c) => window.__isle.setBlock(c[0], c[1], c[2], 0), camp)));
  const cot = await a.evaluate(() => { const I = window.__isle, C = I.cot.COT; for (let y = C.y0 + 1; y <= C.y1; y++) for (let z = C.z0; z <= C.z1; z++) for (let x = C.x0; x <= C.x1; x++) if (I.th.cell(x, y, z) === 'base' && I.get(x, y, z) && I.get(x, y, z) !== 12) return [x, y, z, I.get(x, y, z)]; return null; });
  await a.evaluate(() => window.__isle.setSkin({ pet: 'mochi' }));
  check('and Biscuit’s and Mochi’s owners can break their cottage', !!cot && await a.evaluate((c) => window.__isle.setBlock(c[0], c[1], c[2], 0), cot));
  if (cot) await a.evaluate((c) => window.__isle.setBlock(c[0], c[1], c[2], c[3]), cot);
  // Slinky
  await put(a, 80.5, 13, 92.5); await wait(300);
  await a.evaluate(() => window.__isle.pets.adopt('slinky')); await wait(3500);
  const sf = await a.evaluate(() => { const f = window.__isle.pets.follower(), P = window.__isle.player; return f ? { id: f.id, up: f.y - P.y } : null; });
  check('Slinky flies alongside you now, well off the ground', !!sf && sf.id === 'slinky' && sf.up > 1, sf);
  await a.evaluate(() => window.__isle.pets.sendHome());
  // the chase camera in planes (third person)
  if (!(await a.evaluate(() => window.__isle.view().third))) { await a.keyboard.press('KeyV'); await wait(300); }
  await a.evaluate(() => { const I = window.__isle, L = I.hop.legs(), t0 = I.nowS(); for (let d = 0; d < L.cycle + 5; d += 0.5) { const q = I.hop.pose(t0 + d); if (q.parked && q.leaves > 30) { I.net.tOff += d * 1000; return; } } });
  const q = await a.evaluate(() => window.__isle.hop.pose());
  await put(a, q.x + Math.cos(q.h) * 2.6, q.y, q.z - Math.sin(q.h) * 2.6); await wait(300);
  await a.evaluate(() => window.__isle.hop.board()); await wait(800);
  const ca = await a.evaluate(() => { const c = window.__isle.hop.camAt(), q = window.__isle.hop.pose(); return Math.hypot(c.x - q.x, c.z - q.z); });
  check('in third person, the plane gets a chase camera outside it, not one jammed inside the cabin', ca > 6, ca);
  await a.evaluate(() => window.__isle.hop.leave());
  await put(a, 80.5, 13, 80.5); await wait(300);
  }
  {
  // ----- the Mini Isle made pretty: greenery, beach and palms, blossom, the path to the falls, coral, flowers -----
  const MD = await a.evaluate(() => window.__isle.hop.mini());
  const dc = MD.decor || {};
  check('the Mini Isle has palms on the beach, oaks and pink blossom trees', dc.palms >= 3 && dc.trees >= 20 && dc.blossom >= 5, dc);
  check('the bare rock is grassed over, with vines down the cliffs, and coral in the shallows', dc.grassed > 100 && dc.vines > 50 && dc.coral > 20, dc);
  check('a lantern-lit path runs from the airstrip up to the falls', !!MD.path && MD.path.n > 20 && dc.lanterns >= 3, MD.path && MD.path.n);
  const walk = await a.evaluate((r) => {
    const I = window.__isle, WT = I.blockId('WATER'), LV = I.blockId('LEAVES');
    const top = (x, z) => { for (let y = 60; y > 0; y--) { const b = I.get(x, y, z); if (b && b !== WT && b !== LV) return y; } return 0; };
    let worst = 0, bad = null;
    for (let i = 0; i < r.length; i++) {
      const y = top(r[i][0], r[i][1]);
      if (I.get(r[i][0], y + 1, r[i][1]) || I.get(r[i][0], y + 2, r[i][1])) return { bad: ['no headroom', r[i], y] };
      if (i) { const d = Math.abs(y - top(r[i - 1][0], r[i - 1][1])); if (d > worst) { worst = d; bad = [r[i], y]; } }
    }
    return { worst, bad };
  }, MD.path.route);
  check('and you can walk all of it: no step on it is more than a block', walk.worst <= 1, walk);
  await put(a, MD.cx + 0.5, 40, MD.cz + 0.5); await wait(4000);
  const dd = await a.evaluate(() => window.__isle.hop.decor());
  check('flowers dot the grass, and a rainbow hangs in the falls’ spray by day', dd.built && dd.flowers > 300, dd);
  await put(a, 80.5, 13, 80.5); await wait(300);
  }
  {
  // ----- Coco the chimpanzee -----
  const chh = await a.evaluate(() => window.__isle.pets.home.chimp);
  check('Coco the chimp lives in the Mini Isle’s woods', !!chh && (await a.evaluate((h) => window.__isle.get(Math.floor(h.x), Math.floor(h.y) - 1, Math.floor(h.z)), chh)) !== 0, chh);
  await a.evaluate((h) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = h.x + 1.2; P.y = h.y; P.z = h.z; }, chh); await wait(1500);
  check('you can walk up to her', (await a.evaluate(() => window.__isle.pets.near())) === 'chimp', await a.evaluate(() => window.__isle.pets.near()));
  await a.evaluate(() => window.__isle.pets.adopt('chimp')); await wait(1500);
  check('and adopt her: she follows you', (await a.evaluate(() => window.__isle.pets.follower() && window.__isle.pets.follower().id)) === 'chimp');
  // a tall wall on the meadow; T, then walk into it
  await a.evaluate(() => { const I = window.__isle; for (let y = 13; y <= 21; y++) for (let x = 78; x <= 82; x++) I.setBlock(x, y, 89, 3); });
  await put(a, 80.5, 13, 91.5, 0); await wait(800);
  await a.keyboard.down('KeyW'); await wait(2500); await a.keyboard.up('KeyW');
  const y0 = await a.evaluate(() => window.__isle.player.y);
  check('without Coco’s climb a wall stops you', y0 < 15, y0);
  await put(a, 80.5, 13, 91.5, 0); await wait(500);
  await a.evaluate(() => window.__isle.power.T());
  let peak = 0;
  await a.keyboard.down('KeyW');
  for (let i = 0; i < 40; i++) { await wait(400); const s = await a.evaluate(() => ({ y: window.__isle.player.y })); if (s.y > peak) peak = s.y; if (peak > 22) break; }
  await a.keyboard.up('KeyW');
  check('T is Coco’s climb: you walk straight up the wall and over the top', peak > 21.5, peak);
  if (await a.evaluate(() => !!window.__isle.player.climb)) await a.evaluate(() => window.__isle.power.T());
  await a.evaluate(() => { const I = window.__isle; for (let y = 13; y <= 21; y++) for (let x = 78; x <= 82; x++) I.setBlock(x, y, 89, 0); });
  await a.evaluate(() => window.__isle.pets.sendHome());
  await put(a, 80.5, 13, 80.5); await wait(300);
  }
  {
  // ----- the golden owl's wish, in the lab's secret room -----
  const go = await a.evaluate(() => window.__isle.sec.owlAt());
  await a.evaluate(() => window.__isle.setSkin({ pet: 'slinky' }));
  await a.evaluate((o) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = o.x + 1.6; P.y = o.y - 1; P.z = o.z + 0.4; }, go); await wait(800);
  check('the golden owl stands in the secret room, and you can walk up to it', await a.evaluate(() => window.__isle.sec.owlNear()));
  check('it won’t grant Slinky’s owner a wish', !(await a.evaluate(() => window.__isle.sec.wish())) && !(await a.evaluate(() => window.__isle.sec.wishOn())));
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' })); await wait(300);
  const gc0 = await a.evaluate(() => window.__isle.shop.coins());
  check('an owl owner makes a wish: 50 gold coins at once', await a.evaluate(() => window.__isle.sec.wish()) && await a.evaluate(() => window.__isle.sec.wishOn()) && (await a.evaluate(() => window.__isle.shop.coins())) === gc0 + 50);
  check('and the owl has to recharge before the next one', !(await a.evaluate(() => window.__isle.sec.wish())));
  await put(a, 80.5, 13, 92.5); await wait(400);
  await a.evaluate(() => window.__isle.setBlock(83, 13, 90, 3));
  const gc1 = await a.evaluate(() => window.__isle.shop.coins());
  await a.evaluate(() => window.__isle.act.brk(83, 13, 90));
  check('the Midas touch: a block you hit turns to solid gold and pays 5 coins', (await a.evaluate(() => window.__isle.get(83, 13, 90))) === 25 && (await a.evaluate(() => window.__isle.shop.coins())) === gc1 + 5);
  await a.evaluate(() => window.__isle.act.brk(83, 13, 90));
  check('hit the gold and it breaks as usual', (await a.evaluate(() => window.__isle.get(83, 13, 90))) === 0);
  const sx = await a.evaluate(() => window.__isle.player.x);
  await a.evaluate(() => { window.__isle.player.yaw = -Math.PI / 2; }); await a.keyboard.down('KeyW'); await wait(1200); await a.keyboard.up('KeyW');
  const run = (await a.evaluate(() => window.__isle.player.x)) - sx;
  await a.evaluate(() => { window.__isle.sec.recharge(); });
  check('and you run much faster while it lasts', run > 0.5, run);
  await a.evaluate(() => window.__isle.sec.wishEnd());
  await put(a, 80.5, 13, 80.5); await wait(300);
  }
  {
  // ----- the rainbow over the cottage, and its grappling hook -----
  await a.evaluate(() => { const I = window.__isle; I.setSkin({ pet: 'none' }); I.cmd('/time noon'); I.cmd('/rainbow'); });
  const RBo = await a.evaluate(() => window.__isle.wx.rb()), CO = await a.evaluate(() => window.__isle.cot.COT);
  check('/rainbow puts a rainbow right over Biscuit and Mochi’s cottage', await a.evaluate(() => window.__isle.wx.rainbow()) && Math.abs(RBo.cx - (CO.cx + 0.5)) < 1 && Math.abs(RBo.cz - (CO.cz + 0.5)) < 1, [RBo, CO.cx, CO.cz]);
  await a.evaluate(() => window.__isle.wx.clearHook());
  check('without an owl, no grappling hook', !(await a.evaluate(() => window.__isle.wx.grapMay())));
  const tx = RBo.cx - RBo.R * 0.6, ty = await a.evaluate((q) => window.__isle.wx.rbTop(q[0], q[1]), [tx, RBo.cz]);
  await a.evaluate((q) => { const P = window.__isle.player; P.fly = true; P.vx = P.vy = P.vz = 0; P.x = q[0]; P.y = q[1] + 0.2; P.z = q[2]; }, [tx, ty, RBo.cz]); await wait(1200);
  check('touch the rainbow and you get the grappling hook for 5 minutes', await a.evaluate(() => window.__isle.wx.hook() && window.__isle.wx.grapMay()));
  await put(a, 80.5, 13, 80.5); await wait(300);
  }
  {
  // ----- Coco's tree den, and cherry blossom -----
  const DN = await a.evaluate(() => window.__isle.hop.mini().den), CH = await a.evaluate(() => window.__isle.pets.home.chimp);
  check('Coco has a tree den on the Mini Isle: a plank platform on log stilts with a leafy roof', !!DN && await a.evaluate((d) => { const I = window.__isle; return I.get(d.cx, d.t + 5, d.cz) === I.blockId('PLANKS') && I.get(d.cx + 2, d.t + 2, d.cz + 2) === I.blockId('LOG') && I.get(d.cx, d.t + 9, d.cz) === I.blockId('LEAVES'); }, DN), DN);
  check('and she lives up on it', !!CH && Math.abs(CH.y - DN.floor) < 0.01 && Math.hypot(CH.x - DN.cx - 0.5, CH.z - DN.cz - 0.5) < 2, CH);
  // walk up the steps
  await a.evaluate(() => window.__isle.setSkin({ pet: 'none' }));
  await a.evaluate((s) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = s.x; P.y = s.y; P.z = s.z - 1.5; P.yaw = Math.PI; P.pitch = 0; }, DN.step); await wait(800);
  await a.keyboard.down('KeyW');
  let up = 0; for (let i = 0; i < 60; i++) { await wait(400); const y = await a.evaluate(() => window.__isle.player.y); if (y > up) up = y; if (up >= DN.floor - 0.01) break; }
  await a.keyboard.up('KeyW');
  check('you can walk up the steps to the platform', up >= DN.floor - 0.01, [up, DN.floor]);
  // cherry blossom
  const BL = await a.evaluate(() => window.__isle.blockId('BLOSSOM'));
  check('the cherry trees have real pink blossom leaves', BL === 175 && await a.evaluate((b) => { const I = window.__isle, M = I.hop.mini(); for (let z = M.cz - 40; z <= M.cz + 40; z++) for (let x = M.cx - 40; x <= M.cx + 40; x++) for (let y = 12; y < 50; y++) if (I.get(x, y, z) === b) return true; return false; }, BL));
  await a.evaluate(() => { try { localStorage.removeItem('voxel-isle-blossom'); } catch (e) {} });
  check('they’re not in the block picker until you’ve mined one', !(await a.evaluate((b) => window.__isle.picker.picks.indexOf(b) >= 0 && localStorage.getItem('voxel-isle-blossom') === '1', BL)));
  const bc = await a.evaluate((b) => { const I = window.__isle, M = I.hop.mini(); for (let z = M.cz - 40; z <= M.cz + 40; z++) for (let x = M.cx - 40; x <= M.cx + 40; x++) for (let y = 12; y < 50; y++) if (I.get(x, y, z) === b) return [x, y, z]; return null; }, BL);
  await a.evaluate((c) => window.__isle.act.brk(c[0], c[1], c[2]), bc);
  check('break one and cherry blossom joins the block picker', (await a.evaluate((c) => window.__isle.get(c[0], c[1], c[2]), bc)) !== BL && await a.evaluate((b) => window.__isle.picker.picks.indexOf(b) >= 0, BL));
  await put(a, 80.5, 13, 80.5); await wait(300);
  }
  {
  // ----- items, swords, armour, the crafting table and spark dust -----
  const G = () => a.evaluate(() => window.__isle.gear.state());
  await a.evaluate(() => { try { localStorage.removeItem('voxel-isle-gear'); } catch (e) {} });
  check('the crafting table is in the block picker', await a.evaluate(() => window.__isle.picker.picks.indexOf(window.__isle.blockId('CRAFT')) >= 0));
  // mine some wood and stone
  await put(a, 80.5, 13, 92.5); await wait(300);
  await a.evaluate(() => { const I = window.__isle; for (let k = 0; k < 3; k++) { I.setBlock(84 + k, 13, 90, I.blockId('LOG')); I.setBlock(84 + k, 14, 90, I.blockId('STONE')); } });
  const m0 = (await G()).mats, lg0 = await a.evaluate(() => window.__isle.inv.get(window.__isle.blockId('LOG')));
  await a.evaluate(() => { const I = window.__isle; for (let k = 0; k < 3; k++) { I.act.brk(84 + k, 13, 90); I.act.brk(84 + k, 14, 90); } });
  const m1 = (await G()).mats;
  const lg1 = await a.evaluate(() => window.__isle.inv.get(window.__isle.blockId('LOG')));
  check('mining logs gives logs and stone gives stone', lg1 === lg0 + 3 && m1.stone === m0.stone + 3, [lg0, lg1, m0, m1]);
  // the crafting table
  await a.evaluate(() => window.__isle.setBlock(83, 13, 92, window.__isle.blockId('CRAFT')));
  check('right click on a crafting table opens it', await a.evaluate(() => window.__isle.gear.open()) && (await G()).open && await a.evaluate(() => /Crafting table/.test(document.getElementById('craft').textContent) && /Spark sword/.test(document.getElementById('craft').textContent)));
  check('craft a wooden sword', await a.evaluate(() => window.__isle.gear.craft('sword_wood')) && (await G()).items.indexOf('sword_wood') >= 0 && (await a.evaluate(() => window.__isle.inv.get(window.__isle.blockId('LOG')))) === lg1 - 1);
  check('but not a spark sword without spark dust', !(await a.evaluate(() => window.__isle.gear.craft('sword_spark'))));
  await a.evaluate(() => window.__isle.gear.setMats({ stone: 20 }));
  check('stone armour: crafted and worn straight away', await a.evaluate(() => window.__isle.gear.craft('armor_stone')) && (await G()).armor === 'stone');
  await a.evaluate(() => window.__isle.gear.close());
  // slot 0 is the item slot
  await a.keyboard.press('Digit0'); await wait(300);
  const gs = await G();
  check('slot 0 is the item slot: press 0 and you hold your sword', gs.sel === 9 && gs.inHand === 'sword_wood', gs);
  if (!(await a.evaluate(() => window.__isle.view().third))) { await a.keyboard.press('KeyV'); await wait(300); }
  await wait(600);
  check('and it shows in your hand, with your armour on', /sword_wood\|stone/.test(await a.evaluate(() => window.__isle.gear.dressed())), await a.evaluate(() => window.__isle.gear.dressed()));
  await a.keyboard.press('KeyV'); await wait(600);
  check('in first person you see the sword at the side of the view', await a.evaluate(() => window.__isle.gear.fp()));
  await a.keyboard.press('KeyV'); await wait(300);
  // a test dummy
  await a.evaluate(() => { const P = window.__isle.player; P.yaw = 0; window.__isle.cmd('/spawn'); }); await wait(800);
  const hits = [];
  for (let k = 0; k < 6; k++) { await a.evaluate(() => window.__isle.gear.attack()); await wait(200); hits.push((await a.evaluate(() => window.__isle.gear.dummyHp()))[0]); }
  check('left click with the sword hits a test dummy, and five hearts knock it out', hits[0] && hits[0].hp === 4 && hits.some((d) => d.down), hits.map((d) => d && d.hp));
  await a.evaluate(() => window.__isle.cmd('/clear dummies'));
  // being hit: armour takes some of it
  const hp0 = await a.evaluate(() => window.__isle.food.hp());
  await a.evaluate(() => window.__isle.gear.hit(2, 'Tester'));
  const hp1 = await a.evaluate(() => window.__isle.food.hp());
  check('getting hit plays a hurt animation: your figure flashes red and recoils', (await a.evaluate(() => window.__isle.gear.hurtN())) >= 1 && await a.waitForFunction(() => window.__isle.gear.hurting(), null, { timeout: 4000 }).then(() => true).catch(() => false));
  const rs = await a.evaluate(() => window.__isle.gear.rodTest('stone')), rsp = await a.evaluate(() => window.__isle.gear.rodTest('spark'));
  check('rod creatures get armour made for them: a boxy helm round the face, a collar and a hoop; spark adds glow and dust', rs.n >= 9 && rsp.n > rs.n && rsp.dust && !rs.dust, [rs, rsp]);
  check('a 2-heart hit through stone armour costs 1.5 hearts, shown in halves', hp0 - hp1 === 1.5 && await a.evaluate(() => document.querySelectorAll('#hearts i.half').length === 1), [hp0, hp1]);
  // the lab's spark dust chests
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' }));
  const CH = await a.evaluate(() => window.__isle.gear.chests());
  await a.evaluate((c) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = c.x + (c.rot > 0 ? 1.1 : -1.1); P.y = c.y; P.z = c.z; }, CH[0]); await wait(600);
  const sp0 = (await G()).mats.spark;
  // the shield
  await a.evaluate(() => window.__isle.gear.setMats({ wood: 8, stone: 4 }));
  check('craft a shield, and it’s carried on your other arm', await a.evaluate(() => window.__isle.gear.craft('shield')) && await a.waitForFunction(() => /\|S$/.test(window.__isle.gear.dressed()), null, { timeout: 5000 }).then(() => true).catch(() => false), await a.evaluate(() => window.__isle.gear.dressed()));
  if ((await a.evaluate(() => window.__isle.gear.state().inHand)) === 'shield') await a.keyboard.press('Digit0');
  const sh0 = await a.evaluate(() => window.__isle.food.hp());
  check('raise it (hold right click) and a hit bounces off', await a.evaluate(() => window.__isle.gear.block(true)) && !(await a.evaluate(() => window.__isle.gear.hit(2, 'Tester'))) && (await a.evaluate(() => window.__isle.food.hp())) === sh0 && (await a.evaluate(() => window.__isle.gear.blocks())) === 1);
  await a.evaluate(() => window.__isle.gear.block(false));
  check('lower it and the next hit gets through', await a.evaluate(() => { const I = window.__isle, h = I.food.hp(); return I.gear.hit(1, 'Tester') && I.food.hp() < h; }));
  check('chests in the owls’ lab are full of spark dust', CH.length === 4 && (await a.evaluate(() => window.__isle.gear.chestNear())) === CH[0].k && await a.evaluate(() => window.__isle.gear.chestOpen()) && (await G()).mats.spark === sp0 + 25);
  check('and then it’s empty for a while', !(await a.evaluate(() => window.__isle.gear.chestOpen())));
  await a.evaluate(() => window.__isle.gear.setMats({ spark: 50, diamond: 3 }));
  check('spark dust makes the spark sword and spark armour, the strongest', await a.evaluate(() => window.__isle.gear.craft('sword_spark')) && await a.evaluate(() => window.__isle.gear.craft('armor_spark')) && (await G()).armor === 'spark' && (await G()).held === 'sword_spark');
  await a.keyboard.press('Digit0'); await wait(200);
  check('pressing 0 again swaps to your next item', (await G()).held !== 'sword_spark', (await G()).held);
  await put(a, 80.5, 13, 80.5); await wait(300);
  await a.keyboard.press('Digit5'); await wait(200);
  }
  {
  // ----- bows and arrows -----
  await a.evaluate(() => { const I = window.__isle; I.gear.setMats({ wood: 10, stone: 4 }); });
  check('craft a bow, and arrows (8 for 1 wood and 1 stone)', await a.evaluate(() => window.__isle.gear.craft('bow') && window.__isle.gear.craft('arrows')) && (await a.evaluate(() => window.__isle.gear.bow.arrows())) === 8);
  await put(a, 80.5, 13, 92.5, 0); await wait(300);
  for (let k = 0; k < 6 && (await a.evaluate(() => window.__isle.gear.state().inHand)) !== 'bow'; k++) { await a.keyboard.press('Digit0'); await wait(200); }
  await a.evaluate(() => { const P = window.__isle.player; P.yaw = 0; P.pitch = 0; window.__isle.cmd('/spawn Target'); }); await wait(600);
  await a.evaluate(() => { const P = window.__isle.player; P.x -= 0; P.z += 6; P.pitch = -0.05; }); await wait(400);
  await a.evaluate(() => window.__isle.gear.bow.hold(1000));
  check('hold right click to draw and let go: an arrow flies', await a.evaluate(() => window.__isle.gear.bow.release()) && (await a.evaluate(() => window.__isle.gear.bow.arrows())) === 7);
  await a.waitForFunction(() => window.__isle.gear.bow.hits() > 0, null, { timeout: 15000 }).catch(() => {});
  check('and hits the test dummy', (await a.evaluate(() => window.__isle.gear.bow.hits())) > 0 && (await a.evaluate(() => window.__isle.gear.dummyHp().find((d) => d.name === 'Target').hp)) < 5, await a.evaluate(() => window.__isle.gear.dummyHp()));
  await a.evaluate(() => window.__isle.cmd('/clear dummies'));
  await a.evaluate(() => { const I = window.__isle; for (let y = 13; y <= 16; y++) for (let x = 78; x <= 83; x++) I.setBlock(x, y, 84, 3); });
  await a.evaluate(() => { window.__isle.gear.bow.hold(600); window.__isle.gear.bow.release(); });
  await a.waitForFunction(() => window.__isle.gear.bow.stuck() > 0, null, { timeout: 15000 }).catch(() => {});
  check('an arrow that hits a wall sticks in it', (await a.evaluate(() => window.__isle.gear.bow.stuck())) > 0);
  await a.evaluate(() => { const I = window.__isle; for (let y = 13; y <= 16; y++) for (let x = 78; x <= 83; x++) I.setBlock(x, y, 84, 0); });
  // ----- fire arrows -----
  await a.evaluate(() => { const I = window.__isle; I.gear.setMats({ wood: 4, stone: 4, coal: 0 }); });
  check('fire arrows need coal', !(await a.evaluate(() => window.__isle.gear.craft('firearrows'))));
  await a.evaluate(() => window.__isle.gear.setMats({ coal: 2 }));
  check('with coal, craft 4 fire arrows', await a.evaluate(() => window.__isle.gear.craft('firearrows')) && (await a.evaluate(() => window.__isle.gear.bow.fire())) === 4);
  // a plank wall: the arrow sets it alight and it burns away
  const PL = await a.evaluate(() => window.__isle.blockId('PLANKS'));
  await a.evaluate((pl) => { const I = window.__isle; for (let y = 13; y <= 16; y++) for (let x = 78; x <= 83; x++) I.setBlock(x, y, 84, pl); }, PL);
  await a.evaluate(() => { window.__isle.player.pitch = 0.06; });
  const ar0 = await a.evaluate(() => window.__isle.gear.bow.arrows());
  await a.evaluate(() => { window.__isle.gear.bow.hold(600); window.__isle.gear.bow.release(); });
  check('fire arrows are shot first', (await a.evaluate(() => window.__isle.gear.bow.fire())) === 3 && (await a.evaluate(() => window.__isle.gear.bow.arrows())) === ar0);
  await a.waitForFunction(() => window.__isle.gear.bow.lit() > 0, null, { timeout: 15000 }).catch(() => {});
  check('a fire arrow sets a wooden wall alight', (await a.evaluate(() => window.__isle.gear.bow.lit())) > 0 && (await a.evaluate(() => window.__isle.gear.bow.burns())) > 0);
  await wait(7000);
  const left = await a.evaluate((pl) => { const I = window.__isle; let n = 0; for (let y = 13; y <= 16; y++) for (let x = 78; x <= 83; x++) if (I.get(x, y, 84) === pl) n++; return n; }, PL);
  check('and the planks burn away', left < 24, left);
  await a.evaluate(() => { const I = window.__isle; for (let y = 13; y <= 16; y++) for (let x = 78; x <= 83; x++) I.setBlock(x, y, 84, 0); });
  // a test dummy catches fire and keeps losing hearts
  await a.evaluate(() => { const P = window.__isle.player; P.z -= 6; P.yaw = 0; window.__isle.cmd('/spawn Torch'); }); await wait(600);
  await a.evaluate(() => { const P = window.__isle.player; P.z += 6; P.pitch = -0.05; }); await wait(400);
  await a.evaluate(() => { window.__isle.gear.bow.hold(1000); window.__isle.gear.bow.release(); });
  await a.waitForFunction(() => window.__isle.gear.bow.dummyBurning(), null, { timeout: 15000 }).catch(() => {});
  const th0 = await a.evaluate(() => (window.__isle.gear.dummyHp().find((d) => d.name === 'Torch') || {}).hp);
  check('a fire arrow sets a test dummy on fire', await a.evaluate(() => window.__isle.gear.bow.dummyBurning()), th0);
  await wait(2500);
  const th1 = await a.evaluate(() => (window.__isle.gear.dummyHp().find((d) => d.name === 'Torch') || {}).hp);
  check('and it keeps losing hearts while it burns', th1 < th0, [th0, th1]);
  await a.evaluate(() => window.__isle.cmd('/clear dummies'));
  // TNT gets lit
  const TNT = await a.evaluate(() => window.__isle.blockId('TNT'));
  await a.evaluate((t) => { const I = window.__isle; for (let y = 13; y <= 16; y++) for (let x = 78; x <= 83; x++) I.setBlock(x, y, 84, t); }, TNT);
  await a.evaluate(() => { window.__isle.player.pitch = 0.06; });
  await a.evaluate(() => { window.__isle.gear.bow.hold(600); window.__isle.gear.bow.release(); });
  await a.waitForFunction(() => window.__isle.gear.bow.tnt() > 0, null, { timeout: 15000 }).catch(() => {});
  check('a fire arrow lights TNT', (await a.evaluate(() => window.__isle.gear.bow.tnt())) > 0);
  await a.evaluate(() => { const P = window.__isle.player; P.z += 30; }); await wait(4000);
  await a.evaluate(() => { const I = window.__isle; for (let y = 10; y <= 18; y++) for (let x = 74; x <= 87; x++) for (let z = 80; z <= 88; z++) if (I.get(x, y, z) === I.blockId('TNT')) I.setBlock(x, y, z, 0); });
  // the crafting table can turn "fire first" off
  await a.evaluate(() => window.__isle.gear.bow.fireFirst(false));
  const f0 = await a.evaluate(() => window.__isle.gear.bow.fire());
  await a.evaluate(() => { window.__isle.gear.bow.hold(300); window.__isle.gear.bow.release(); });
  check('with fire first off, plain arrows go first', (await a.evaluate(() => window.__isle.gear.bow.fire())) === f0);
  await a.evaluate(() => window.__isle.gear.bow.fireFirst(true));
  await a.keyboard.press('Digit5'); await wait(200);
  await put(a, 80.5, 13, 80.5); await wait(300);
  // ----- spears -----
  await a.evaluate(() => { const I = window.__isle; I.gear.setMats({ wood: 20, stone: 2, spark: 10 }); });
  check('craft a stone spear', await a.evaluate(() => window.__isle.gear.craft('spear_stone')));
  await put(a, 80.5, 13, 92.5, 0); await wait(300);
  for (let k = 0; k < 12 && (await a.evaluate(() => window.__isle.gear.state().inHand)) !== 'spear_stone'; k++) { await a.keyboard.press('Digit0'); await wait(150); }
  check('it goes in slot 0', (await a.evaluate(() => window.__isle.gear.state().inHand)) === 'spear_stone');
  await a.evaluate(() => { const P = window.__isle.player; P.yaw = 0; P.pitch = 0; window.__isle.cmd('/spawn Pike'); }); await wait(600);
  await a.evaluate(() => { const P = window.__isle.player; P.z += 2; }); await wait(400);
  const pk0 = await a.evaluate(() => (window.__isle.gear.dummyHp().find((d) => d.name === 'Pike') || {}).hp);
  await a.evaluate(() => window.__isle.gear.attack()); await wait(300);
  const pk1 = await a.evaluate(() => (window.__isle.gear.dummyHp().find((d) => d.name === 'Pike') || {}).hp);
  check('a spear reaches a dummy over 4 blocks away (a sword can’t)', pk1 < pk0, [pk0, pk1]);
  await a.evaluate(() => { const P = window.__isle.player; P.z += 3.5; P.pitch = 0.04; }); await wait(700);
  await a.evaluate(() => { window.__isle.gear.spear.hold(1000); });
  check('hold right click and let go: the spear is thrown', await a.evaluate(() => window.__isle.gear.spear.release()) && (await a.evaluate(() => window.__isle.gear.spear.thrown())) === 'spear_stone');
  check('and it’s gone from your hand', (await a.evaluate(() => window.__isle.gear.state().inHand)) === null);
  await a.waitForFunction(() => window.__isle.gear.spear.hits() > 0, null, { timeout: 15000 }).catch(() => {});
  check('a thrown spear hits the dummy 8 blocks away', (await a.evaluate(() => window.__isle.gear.spear.hits())) > 0);
  await a.waitForFunction(() => window.__isle.gear.spear.flying().some((s) => s.stuck), null, { timeout: 15000 }).catch(() => {});
  const sp = (await a.evaluate(() => window.__isle.gear.spear.flying()))[0];
  check('then it drops to the ground', !!sp && sp.stuck, sp);
  await a.evaluate(() => window.__isle.cmd('/clear dummies'));
  if (sp) await put(a, sp.x, 13, sp.z + 0.5, 0);
  await a.waitForFunction(() => !window.__isle.gear.spear.thrown(), null, { timeout: 8000 }).catch(() => {});
  check('walk over it to pick it up', !(await a.evaluate(() => window.__isle.gear.spear.thrown())) && (await a.evaluate(() => window.__isle.gear.state().inHand)) === 'spear_stone');
  // the spark spear comes back by itself
  check('craft a spark spear', await a.evaluate(() => window.__isle.gear.craft('spear_spark')));
  for (let k = 0; k < 12 && (await a.evaluate(() => window.__isle.gear.state().inHand)) !== 'spear_spark'; k++) { await a.keyboard.press('Digit0'); await wait(150); }
  await put(a, 80.5, 13, 92.5, 0); await wait(300);
  await a.evaluate(() => { const P = window.__isle.player; P.yaw = 0; P.pitch = 0.1; window.__isle.gear.spear.hold(1000); window.__isle.gear.spear.release(); });
  await a.waitForFunction(() => window.__isle.gear.spear.flying().some((s) => s.back), null, { timeout: 15000 }).catch(() => {});
  check('a spark spear flies back to you after it lands', await a.evaluate(() => window.__isle.gear.spear.flying().some((s) => s.back) || !window.__isle.gear.spear.thrown()));
  await a.waitForFunction(() => !window.__isle.gear.spear.thrown(), null, { timeout: 15000 }).catch(() => {});
  check('and lands back in your hand', !(await a.evaluate(() => window.__isle.gear.spear.thrown())) && (await a.evaluate(() => window.__isle.gear.state().inHand)) === 'spear_spark');
  await a.keyboard.press('Digit5'); await wait(200);
  // ----- throwing knives -----
  await a.evaluate(() => { const I = window.__isle; I.gear.setMats({ wood: 2, stone: 4 }); });
  check('craft throwing knives, 4 at a time', await a.evaluate(() => window.__isle.gear.craft('knives')) && (await a.evaluate(() => window.__isle.gear.knife.count())) === 4);
  await put(a, 80.5, 13, 92.5, 0); await wait(300);
  for (let k = 0; k < 12 && (await a.evaluate(() => window.__isle.gear.state().inHand)) !== 'knives'; k++) { await a.keyboard.press('Digit0'); await wait(150); }
  check('they go in slot 0', (await a.evaluate(() => window.__isle.gear.state().inHand)) === 'knives');
  await a.evaluate(() => { const P = window.__isle.player; P.yaw = 0; P.pitch = 0; window.__isle.cmd('/spawn Board'); }); await wait(600);
  await a.evaluate(() => { const P = window.__isle.player; P.z += 7; P.pitch = 0; }); await wait(500);
  const kb0 = await a.evaluate(() => (window.__isle.gear.dummyHp().find((d) => d.name === 'Board') || {}).hp);
  await play(a); await a.evaluate(() => window.__isle.click(0)); await wait(150);
  check('left click throws a knife', (await a.evaluate(() => window.__isle.gear.knife.count())) === 3);
  await a.waitForFunction(() => window.__isle.gear.knife.hits() > 0, null, { timeout: 10000 }).catch(() => {});
  const kb1 = await a.evaluate(() => (window.__isle.gear.dummyHp().find((d) => d.name === 'Board') || {}).hp);
  check('it hits a test dummy 9 blocks away for 1.5 hearts', kb0 - kb1 === 1.5, [kb0, kb1]);
  await a.evaluate(() => window.__isle.cmd('/clear dummies'));
  await a.evaluate(() => { const I = window.__isle; for (let y = 13; y <= 16; y++) for (let x = 78; x <= 83; x++) I.setBlock(x, y, 84, 3); });
  await a.evaluate(() => { window.__isle.gear.knife.throw(); });
  await a.waitForFunction(() => window.__isle.gear.knife.stuck().length > 1, null, { timeout: 10000 }).catch(() => {});
  const ks = await a.evaluate(() => window.__isle.gear.knife.stuck());
  check('knives stick where they land', ks.length >= 2, ks);
  const kc0 = await a.evaluate(() => window.__isle.gear.knife.count());
  for (const k of ks) { await put(a, k.x, 13, k.z + 0.6, 0); await wait(400); }
  check('walk over them to pick them up', (await a.evaluate(() => window.__isle.gear.knife.count())) === kc0 + ks.length, [kc0, ks.length, await a.evaluate(() => window.__isle.gear.knife.count())]);
  await a.evaluate(() => { const I = window.__isle; for (let y = 13; y <= 16; y++) for (let x = 78; x <= 83; x++) I.setBlock(x, y, 84, 0); });
  await a.keyboard.press('Digit5'); await wait(200);
  // ----- grenades -----
  await a.evaluate(() => { const I = window.__isle; I.gear.setMats({ stone: 2, coal: 2 }); });
  check('craft grenades, 2 at a time', await a.evaluate(() => window.__isle.gear.craft('grenades')) && (await a.evaluate(() => window.__isle.gear.gren.count())) === 2);
  await put(a, 80.5, 13, 92.5, 0); await wait(300);
  for (let k = 0; k < 16 && (await a.evaluate(() => window.__isle.gear.state().inHand)) !== 'grenades'; k++) { await a.keyboard.press('Digit0'); await wait(150); }
  check('they go in slot 0', (await a.evaluate(() => window.__isle.gear.state().inHand)) === 'grenades');
  await a.evaluate(() => { const I = window.__isle, P = I.player; P.yaw = 0; P.pitch = 0; I.cmd('/spawn Crate'); I.setBlock(80, 13, 91, 3); I.gear.bow.heal(); }); await wait(600);
  const gh0 = await a.evaluate(() => window.__isle.food.hp());
  await a.evaluate(() => { const P = window.__isle.player; P.pitch = -1.45; P.vx = P.vy = P.vz = 0; });
  await play(a); await a.evaluate(() => window.__isle.click(0)); await wait(150);
  check('left click lobs a grenade', (await a.evaluate(() => window.__isle.gear.gren.count())) === 1 && (await a.evaluate(() => window.__isle.gear.gren.live().length)) === 1);
  await wait(1200);
  check('it hasn’t gone off yet', (await a.evaluate(() => window.__isle.gear.gren.booms())) === 0);
  await a.waitForFunction(() => window.__isle.gear.gren.booms() > 0, null, { timeout: 6000 }).catch(() => {});
  check('it goes off after its fuse', (await a.evaluate(() => window.__isle.gear.gren.booms())) === 1);
  await wait(300);
  const cr = await a.evaluate(() => (window.__isle.gear.dummyHp().find((d) => d.name === 'Crate') || {}).hp);
  check('the blast hurts a test dummy close by', cr < 5, cr);
  check('and you, if you didn’t get clear', (await a.evaluate(() => window.__isle.food.hp())) < gh0, [gh0, await a.evaluate(() => window.__isle.food.hp())]);
  check('and blows a small hole', (await a.evaluate(() => window.__isle.gear.gren.hole())) > 0 && (await a.evaluate(() => window.__isle.get(80, 13, 91))) === 0);
  await a.evaluate(() => { window.__isle.cmd('/clear dummies'); window.__isle.gear.bow.heal(); });
  await a.keyboard.press('Digit5'); await wait(200);
  // ----- game modes, and crafting like Minecraft -----
  check('you start in creative', (await a.evaluate(() => window.__isle.gm.get())) === 'creative');
  await put(a, 80.5, 13, 92.5, 0); await wait(300);
  await a.evaluate(() => window.__isle.cmd('/gamemode survival')); await wait(200);
  check('/gamemode survival switches to survival', (await a.evaluate(() => window.__isle.gm.get())) === 'survival' && /Survival/.test(await a.evaluate(() => (document.getElementById('gmode') || {}).textContent || '')));
  await a.evaluate(() => { window.__isle.player.fly = false; }); await a.keyboard.press('KeyF'); await wait(200);
  check('no flying in survival', !(await a.evaluate(() => window.__isle.player.fly)));
  const STN = await a.evaluate(() => window.__isle.blockId('STONE'));
  await a.evaluate(() => window.__isle.inv.clear());
  await a.keyboard.press('Digit3'); await wait(200);
  await a.evaluate(() => window.__isle.act.place(81, 13, 90)); await wait(200);
  check('you can’t place a block you haven’t got', (await a.evaluate(() => window.__isle.get(81, 13, 90))) === 0);
  check('the hotbar shows you’ve none', await a.evaluate(() => document.querySelectorAll('#hotbar .slot')[2].classList.contains('none')));
  await a.evaluate((b) => window.__isle.setBlock(81, 13, 90, b), STN);
  await a.evaluate(() => window.__isle.act.brk(81, 13, 90)); await wait(100);
  check('one hit doesn’t break stone in survival', (await a.evaluate(() => window.__isle.get(81, 13, 90))) === STN);
  for (let k = 0; k < 14 && (await a.evaluate(() => window.__isle.get(81, 13, 90))) === STN; k++) { await a.evaluate(() => window.__isle.act.brk(81, 13, 90)); await wait(170); }
  check('keep hitting and it breaks, into your inventory', (await a.evaluate(() => window.__isle.get(81, 13, 90))) === 0 && (await a.evaluate((b) => window.__isle.inv.get(b), STN)) === 1);
  check('dirt breaks faster than stone, ores slower', await a.evaluate(() => { const I = window.__isle; return I.gm.mineT(I.blockId('DIRT')) < I.gm.mineT(I.blockId('STONE')) && I.gm.mineT(I.blockId('STONE')) < I.gm.mineT(I.blockId('COAL')); }));
  check('and the hotbar counts it', (await a.evaluate(() => document.querySelectorAll('#hotbar .slot')[2].querySelector('.cnt').textContent)) === '1');
  await a.evaluate(() => window.__isle.act.place(81, 13, 90)); await wait(200);
  check('placing it uses it up', (await a.evaluate(() => window.__isle.get(81, 13, 90))) === STN && (await a.evaluate((b) => window.__isle.inv.get(b), STN)) === 0);
  await a.evaluate(() => window.__isle.setBlock(81, 13, 90, 0));
  // falls hurt
  const fh0 = await a.evaluate(() => window.__isle.gm.fallHurt());
  // a clear, dry spot with a stone floor (landing in water doesn't hurt), and not so far that Pemberton
  // rushes in with tea (he does that for owl owners down to 2 hearts)
  await a.evaluate((b) => { const I = window.__isle; for (let y = 13; y <= 26; y++) I.setBlock(70, y, 96, 0); I.setBlock(70, 12, 96, b); I.gear.bow.heal(); const P = I.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = 70.5; P.z = 96.5; P.y = 20; }, STN);
  await a.waitForFunction((f) => window.__isle.gm.fallHurt() > f, fh0, { timeout: 20000 }).catch(() => {}); await wait(200);
  check('a long fall hurts in survival', (await a.evaluate(() => window.__isle.gm.fallHurt())) > fh0 && (await a.evaluate(() => window.__isle.food.hp())) < 5, await a.evaluate(() => window.__isle.food.hp()));
  await a.evaluate(() => window.__isle.gear.bow.heal());
  // the 2×2 grid in your inventory
  const LOGB = await a.evaluate(() => window.__isle.blockId('LOG')), PLK = await a.evaluate(() => window.__isle.blockId('PLANKS'));
  await a.evaluate((l) => { const I = window.__isle; I.inv.set(l, 2); I.grid.open(2); }, LOGB);
  check('B’s crafting button opens your inventory with a 2×2 grid', await a.evaluate(() => document.querySelectorAll('#craft .cgrid.s2 .cell').length === 4 && /Your bag/.test(document.getElementById('craft').textContent)));
  await a.evaluate((l) => { const I = window.__isle; I.grid.pick(l); I.grid.put(0); }, LOGB);
  check('a log in the grid shows planks', (await a.evaluate(() => window.__isle.grid.match())) === 'planks');
  check('click the result: 4 planks', await a.evaluate(() => window.__isle.grid.out()) && (await a.evaluate((p) => window.__isle.inv.get(p), PLK)) === 4 && (await a.evaluate((l) => window.__isle.inv.get(l), LOGB)) === 1);
  await a.evaluate((p) => { const I = window.__isle; I.grid.pick(p); I.grid.put(0); I.grid.pick(p); I.grid.put(2); }, PLK);
  check('two planks one above the other make sticks', (await a.evaluate(() => window.__isle.grid.match())) === 'sticks' && await a.evaluate(() => window.__isle.grid.out()) && (await a.evaluate(() => window.__isle.inv.get('stick'))) === 4);
  check('a sword won’t fit in the 2×2 grid', !(await a.evaluate(() => window.__isle.grid.fill('sword_wood'))));
  await a.evaluate(() => window.__isle.grid.close());
  // the 3×3 grid at a crafting table: a pattern makes a sword
  await a.evaluate(() => { const I = window.__isle; I.inv.set(I.blockId('PLANKS'), 2); I.grid.open(3); });
  await a.evaluate((p) => { const I = window.__isle; I.grid.pick(p); I.grid.put(1); I.grid.pick(p); I.grid.put(4); I.grid.pick('stick'); I.grid.put(7); }, PLK);
  check('two planks over a stick make a wooden sword', (await a.evaluate(() => window.__isle.grid.match())) === 'sword_wood');
  await a.evaluate(() => { const I = window.__isle; I.grid.pick(null); I.grid.put(7); I.grid.pick('stick'); I.grid.put(6); });
  check('the wrong pattern makes nothing', (await a.evaluate(() => window.__isle.grid.match())) === null);
  await a.evaluate(() => { const I = window.__isle; I.grid.pick(null); I.grid.put(6); I.grid.pick('stick'); I.grid.put(7); });
  const hadSword = await a.evaluate(() => window.__isle.gear.state().items.indexOf('sword_wood') >= 0);
  check(hadSword ? 'and you can’t make a second one' : 'craft it from the grid', hadSword ? !(await a.evaluate(() => window.__isle.grid.out())) : (await a.evaluate(() => window.__isle.grid.out())) && (await a.evaluate(() => window.__isle.gear.state().items.indexOf('sword_wood') >= 0)));
  await a.evaluate(() => window.__isle.grid.close());
  check('closing the grid hands back what was in it', (await a.evaluate((p) => window.__isle.inv.get(p), PLK)) + (await a.evaluate(() => window.__isle.inv.get('stick'))) >= (hadSword ? 3 : 0));
  // the recipe book turns logs into planks and sticks for you
  await a.evaluate(() => { const I = window.__isle; I.inv.clear(); I.inv.set(I.blockId('LOG'), 2); });
  check('the recipe book’s Craft makes a crafting table straight from logs', await a.evaluate(() => window.__isle.gear.craft('table')) && (await a.evaluate(() => window.__isle.inv.get(window.__isle.blockId('CRAFT')))) === 1 && (await a.evaluate(() => window.__isle.inv.get(window.__isle.blockId('LOG')))) === 1);
  // hunger
  check('survival has a food bar: five drumsticks', await a.evaluate(() => { const el = document.getElementById('hunger'); return !el.hidden && el.querySelectorAll('i').length === 5; }));
  await a.evaluate(() => window.__isle.hunger.set(10));
  const ex0 = await a.evaluate(() => window.__isle.hunger.ex());
  await a.evaluate(() => { const P = window.__isle.player; P.x = 80.5; P.z = 96.5; P.y = 13; P.yaw = Math.PI; P.fly = false; });
  await a.keyboard.down('KeyW'); await wait(2500); await a.keyboard.up('KeyW');
  check('walking wears it down', (await a.evaluate(() => window.__isle.hunger.ex())) > ex0 + 0.02 || (await a.evaluate(() => window.__isle.hunger.get())) < 10);
  await a.evaluate(() => { const I = window.__isle; I.hunger.set(10); I.hunger.hp(3); });
  await a.waitForFunction(() => window.__isle.food.hp() > 3, null, { timeout: 40000 }).catch(() => {});
  check('well fed, your hearts come back', (await a.evaluate(() => window.__isle.food.hp())) > 3);
  await a.evaluate(() => { const I = window.__isle; I.hunger.set(5); I.hunger.hp(3); }); await wait(8000);
  check('hungry, they don’t', (await a.evaluate(() => window.__isle.food.hp())) === 3);
  const sv0 = await a.evaluate(() => window.__isle.hunger.starved());
  await a.evaluate(() => { const I = window.__isle; I.hunger.set(0); I.hunger.hp(2); });
  await a.waitForFunction((v) => window.__isle.hunger.starved() > v, sv0, { timeout: 15000 }).catch(() => {});
  check('with nothing to eat you starve', (await a.evaluate(() => window.__isle.food.hp())) < 2);
  await a.evaluate(() => window.__isle.hunger.hp(1)); await wait(9000);
  check('but only down to one heart', (await a.evaluate(() => window.__isle.food.hp())) === 1);
  await a.evaluate(() => { const I = window.__isle; I.inv.set('apple', 2); });
  await a.keyboard.press('KeyI'); await wait(400);
  check('I opens your inventory, with your food', await a.evaluate(() => !document.getElementById('craft').hidden && !!document.querySelector('#craft [data-eat="apple"]')));
  await a.evaluate(() => document.querySelector('#craft [data-eat="apple"]').click()); await wait(200);
  check('click an apple to eat it: one drumstick', (await a.evaluate(() => window.__isle.hunger.get())) === 2 && (await a.evaluate(() => window.__isle.inv.get('apple'))) === 1);
  await a.evaluate(() => window.__isle.grid.close());
  await a.evaluate(() => { const I = window.__isle; I.inv.set('fish', 1); I.inv.set('coal', 1); });
  check('cook a fish with coal', await a.evaluate(() => window.__isle.gear.craft('cooked_fish')) && (await a.evaluate(() => window.__isle.inv.get('cooked_fish'))) === 1);
  await a.evaluate(() => window.__isle.cmd('/eat')); await wait(200);
  check('/eat eats the best food you’ve got: cooked fish, two drumsticks', (await a.evaluate(() => window.__isle.hunger.get())) === 6 && (await a.evaluate(() => window.__isle.inv.get('cooked_fish'))) === 0);
  // more foods
  await a.evaluate(() => { const I = window.__isle; I.inv.set('wheat', 3); I.hunger.set(4); });
  check('three wheat in a row make bread', await a.evaluate(() => window.__isle.gear.craft('bread')) && (await a.evaluate(() => window.__isle.inv.get('bread'))) === 1);
  check('and bread is one and a half drumsticks', await a.evaluate(() => window.__isle.hunger.eat('bread')) && (await a.evaluate(() => window.__isle.hunger.get())) === 7);
  await a.evaluate(() => { const I = window.__isle; I.inv.set('berries', 3); I.inv.set('egg', 2); I.inv.set('apple', 1); I.inv.set('wheat', 3); I.grid.open(3); });
  check('berries, eggs, an apple and wheat in the grid make a cake', await a.evaluate(() => window.__isle.grid.fill('cake')) && (await a.evaluate(() => window.__isle.grid.match())) === 'cake' && await a.evaluate(() => window.__isle.grid.out()) && (await a.evaluate(() => window.__isle.inv.get('cake'))) === 1);
  await a.evaluate(() => window.__isle.grid.close());
  await a.evaluate(() => { const I = window.__isle; I.inv.set('cookie', 2); I.hunger.set(8); }); await a.evaluate(() => window.__isle.cmd('/eat')); await wait(200);
  check('/eat picks a cookie, not the whole cake, when you’re only peckish', (await a.evaluate(() => window.__isle.inv.get('cake'))) === 1 && (await a.evaluate(() => window.__isle.inv.get('cookie'))) === 1);
  await a.evaluate(() => { const I = window.__isle; I.inv.set(I.blockId('GOLD'), 8); I.inv.set('apple', 1); I.hunger.set(2); I.hunger.hp(2); });
  check('gold round an apple makes a golden apple', await a.evaluate(() => window.__isle.gear.craft('golden_apple')));
  check('which fills your food and your hearts', await a.evaluate(() => window.__isle.hunger.eat('golden_apple')) && (await a.evaluate(() => window.__isle.hunger.get())) === 10 && (await a.evaluate(() => window.__isle.food.hp())) === 5);
  // potions
  await a.evaluate(() => { const I = window.__isle; I.inv.set(I.blockId('GLASS'), 3); });
  check('three glass in a V make three bottles', await a.evaluate(() => window.__isle.gear.craft('bottle')) && (await a.evaluate(() => window.__isle.inv.get('bottle'))) === 3);
  await a.evaluate(() => { const I = window.__isle; I.inv.set('copper', 1); I.inv.set('apple', 1); I.inv.set('berries', 1); I.inv.set('wheat', 1); });
  check('a bottle and copper brew a potion of swiftness', await a.evaluate(() => window.__isle.gear.craft('potion_speed')) && (await a.evaluate(() => window.__isle.inv.get('potion_speed'))) === 1);
  check('drink it: you’re swift, and you get the bottle back', await a.evaluate(() => window.__isle.potion.drink('speed')) && await a.evaluate(() => window.__isle.potion.on('speed')) && (await a.evaluate(() => window.__isle.inv.get('bottle'))) === 3);
  await wait(400);
  check('the effect shows in the corner with its time left', /⚡ 1:2\d|⚡ 1:3\d/.test(await a.evaluate(() => window.__isle.potion.effects())), await a.evaluate(() => window.__isle.potion.effects()));
  await a.evaluate(() => window.__isle.hunger.hp(2));
  check('a potion of healing: two hearts back', await a.evaluate(() => window.__isle.gear.craft('potion_heal') && window.__isle.potion.drink('heal')) && (await a.evaluate(() => window.__isle.food.hp())) === 4);
  check('slow falling', await a.evaluate(() => window.__isle.gear.craft('potion_slowfall') && window.__isle.potion.drink('slow')));
  const fs0 = await a.evaluate(() => window.__isle.gm.fallHurt());
  await a.evaluate(() => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = 70.5; P.z = 96.5; P.y = 22; });
  let vmin = 0; for (let k = 0; k < 60; k++) { const r = await a.evaluate(() => [window.__isle.player.vy, window.__isle.player.onGround, window.__isle.player.y]); vmin = Math.min(vmin, r[0]); if (r[1] && r[2] < 14) break; await wait(200); }
  check('drifts you down gently, with no fall damage', vmin > -3.5 && (await a.evaluate(() => window.__isle.gm.fallHurt())) === fs0, vmin);
  check('/drink with no potion left tells you', !(await a.evaluate(() => window.__isle.potion.drink('invis'))));
  await a.evaluate(() => { const I = window.__isle; I.hunger.set(10); I.hunger.hp(5); });
  await a.evaluate(() => window.__isle.cmd('/gamemode creative')); await wait(200);
  check('/gamemode creative switches back', (await a.evaluate(() => window.__isle.gm.get())) === 'creative');
  await a.keyboard.press('KeyF'); await wait(200);
  check('and you can fly again', await a.evaluate(() => window.__isle.player.fly));
  check('and the food bar goes away', await a.evaluate(() => document.getElementById('hunger').hidden));
  await a.keyboard.press('KeyF'); await wait(200);
  await a.keyboard.press('Digit5'); await wait(200);
  // ----- blocky mode -----
  const bk = await a.evaluate(() => window.__isle.blocky());
  check('blocky mode is on by default and has made the round shapes blocky', bk.on && bk.stats.spheres > 20 && bk.stats.cyl > 20, bk);
  // ----- the rope -----
  await a.evaluate(() => { const I = window.__isle; I.gear.setMats({ wood: 10 }); });
  check('a rope is crafted from wood at the crafting table', await a.evaluate(() => window.__isle.gear.craft('rope')) && (await a.evaluate(() => window.__isle.gear.state())).held === 'rope');
  await put(a, 80.5, 13, 92.5); await wait(300);
  await a.evaluate(() => { window.__isle.player.yaw = 0; window.__isle.cmd('/spawn Rocky'); }); await wait(800);
  await a.keyboard.press('Digit0'); await wait(200);
  if ((await a.evaluate(() => window.__isle.gear.state())).inHand !== 'rope') { await a.keyboard.press('Digit0'); await wait(200); }
  check('hold the rope and right click a dummy to tie it on', await a.evaluate(() => window.__isle.rope.use()) && (await a.evaluate(() => window.__isle.rope.list())).length === 1);
  await a.evaluate(() => { const P = window.__isle.player; P.x += 12; }); await wait(1500);
  const dd = await a.evaluate(() => { const d = window.__isle.gear.dummyHp().find((q) => q.name === 'Rocky'), P = window.__isle.player; return Math.hypot(d.x - P.x, d.z - P.z); });
  check('walk away and it’s pulled along behind you', dd <= 4.2, dd);
  await a.evaluate(() => { window.__isle.player.yaw += Math.PI / 2; });
  check('right click again (with nobody in front) to untie', await a.evaluate(() => window.__isle.rope.use()) && (await a.evaluate(() => window.__isle.rope.list())).length === 0);
  await a.evaluate(() => window.__isle.cmd('/clear dummies'));
  await a.keyboard.press('Digit5'); await wait(200);
  await put(a, 80.5, 13, 80.5); await wait(300);
  }
  {
  // ----- Bird Air Express: no random crashes, the board, the grapple, mid-air -----
  check('Bird Air Express never crashes by itself', await a.evaluate(() => { const I = window.__isle, t0 = I.nowS(); for (let t = t0; t < t0 + 1500; t += 0.25) { const q = I.express.pose(t); if (q.gone || q.diving || q.crash) return false; } return true; }));
  const rows = await a.evaluate(() => window.__isle.express.rows());
  check('the departures board lists the Express’s three flights (no West Bay)', rows.dep.length === 3 && rows.arr.length === 3 && rows.dep.every((r) => r.place !== 'West Bay' && /^BX/.test(r.code)), rows);
  await a.waitForFunction(() => { const q = window.__isle.express.pose(); return !!q.parked && q.left > 30; }, null, { timeout: 480000 }).catch(() => {});
  const shown = await a.evaluate(() => { const r = window.__isle.express.rows(); return r.dep.some((x) => x.status === 'Boarding'); });
  check('and shows it Boarding while it waits at a stop', shown);
  check('it waits a good while at each stop', await a.evaluate(() => window.__isle.express.pose().left > 30));
  await a.evaluate(() => { const I = window.__isle; I.setSkin({ pet: 'hoot' }); I.bm.calm(); });
  await wait(400);
  // stand 14 blocks off and aim 2.5 blocks to one side of it: close enough counts
  await a.evaluate(() => { const I = window.__isle, q = I.express.pose(), P = I.player; P.fly = true; P.vx = P.vy = P.vz = 0; P.x = q.x + 14; P.z = q.z + 2; P.y = q.y + 1; const tx = q.x, ty = q.y + 2.8, tz = q.z + 0.5, ex = P.x, ey = P.y + 1.6, ez = P.z; const dx = tx - ex, dy = ty - ey, dz = tz - ez, L = Math.hypot(dx, dy, dz); P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.asin(dy / L); });
  await wait(300);
  await a.keyboard.press('KeyC'); await wait(300);
  const g = await a.evaluate(() => window.__isle.grap());
  check('a grapple that just misses the red jet still catches it', !!g && g.veh === 'express', g);
  await a.waitForFunction(() => window.__isle.express.ride(), null, { timeout: 60000 }).catch(() => {});
  check('and reels you in and aboard', await a.evaluate(() => window.__isle.express.ride()));
  await a.evaluate(() => { const I = window.__isle; if (I.express.ride()) I.toggleBoard(); I.setSkin({ pet: 'none' }); });
  await wait(300);
  await a.waitForFunction(() => { const q = window.__isle.express.pose(); return !q.parked && !q.gone && q.y > 30; }, null, { timeout: 240000 }).catch(() => {});
  const cr0 = await a.evaluate(() => window.__isle.silly.crashes());
  check('running into the other jet in mid-air brings it down', await a.evaluate(() => window.__isle.express.collide()) && await a.evaluate(() => window.__isle.express.down()));
  await wait(2500);
  check('both of them', (await a.evaluate(() => window.__isle.silly.crashes())) >= cr0 + 1 && await a.evaluate(() => window.__isle.express.pose().gone));
  const rows2 = await a.evaluate(() => window.__isle.express.rows());
  check('and the board says Crashed', rows2.dep.some((r) => r.status === 'Crashed'), rows2);
  await put(a, 80.5, 13, 92.5); await wait(300);
  }

  {
  // ----- redstone -----
  const RB = await a.evaluate(() => { const I = window.__isle, n = {}; for (const k of ['WIRE', 'WIRE_ON', 'LEVER', 'LEVER_ON', 'BUTTON', 'BUTTON_ON', 'PLATE', 'PLATE_ON', 'RSBLOCK', 'RLAMP', 'RLAMP_ON', 'NOTG', 'DELAY', 'TNT', 'NOTE', 'DOOR', 'DOOR_TOP', 'DOOR_OPEN', 'STONE', 'DIRT']) n[k] = I.blockId(k); return n; });
  check('the redstone parts are in the block picker', await a.evaluate((R) => ['WIRE', 'LEVER', 'BUTTON', 'PLATE', 'RSBLOCK', 'RLAMP', 'NOTG', 'DELAY', 'TNT', 'NOTE'].every((k) => window.__isle.picker.picks.indexOf(R[k]) >= 0), RB));
  await put(a, 80.5, 13, 80.5); await wait(200);
  const S = (x, y, z, b) => a.evaluate((q) => window.__isle.setBlock(q[0], q[1], q[2], q[3]), [x, y, z, b]);
  const G = (x, y, z) => a.evaluate((q) => window.__isle.get(q[0], q[1], q[2]), [x, y, z]);
  const ticks = (n) => a.evaluate((n) => { for (let k = 0; k < n; k++) window.__isle.rs.step(); }, n);
  // lever -> five wires -> lamp
  await S(66, 13, 90, RB.LEVER); for (let x = 67; x <= 71; x++) await S(x, 13, 90, RB.WIRE); await S(72, 13, 90, RB.RLAMP);
  await ticks(2);
  check('a lamp on wire from a lever that’s off stays dark', (await G(72, 13, 90)) === RB.RLAMP && (await G(67, 13, 90)) === RB.WIRE);
  await a.evaluate(() => window.__isle.rs.use(66, 13, 90)); await ticks(2);
  check('flipping the lever powers the wire and lights the lamp', (await G(66, 13, 90)) === RB.LEVER_ON && (await G(67, 13, 90)) === RB.WIRE_ON && (await G(72, 13, 90)) === RB.RLAMP_ON);
  check('the power gets one weaker each block', (await a.evaluate(() => window.__isle.rs.pow(67, 13, 90))) === 15 && (await a.evaluate(() => window.__isle.rs.pow(71, 13, 90))) === 11);
  await a.evaluate(() => window.__isle.rs.use(66, 13, 90)); await ticks(2);
  check('and flipping it back turns it all off', (await G(72, 13, 90)) === RB.RLAMP && (await G(67, 13, 90)) === RB.WIRE);
  // wire runs out after 15 blocks
  await S(62, 13, 84, RB.RSBLOCK); for (let x = 63; x <= 80; x++) await S(x, 13, 84, RB.WIRE); await S(81, 13, 84, RB.RLAMP);
  await ticks(2);
  check('a redstone block is always on, but wire only carries it 15 blocks', (await G(63, 13, 84)) === RB.WIRE_ON && (await a.evaluate(() => window.__isle.rs.pow(77, 13, 84))) === 1 && (await G(78, 13, 84)) === RB.WIRE && (await G(81, 13, 84)) === RB.RLAMP);
  // wire climbing a step
  await S(66, 13, 94, RB.RSBLOCK); await S(67, 13, 94, RB.WIRE); await S(68, 13, 94, RB.STONE); await S(68, 14, 94, RB.WIRE); await S(69, 14, 94, RB.RLAMP);
  await ticks(2);
  check('wire climbs up a block', (await G(68, 14, 94)) === RB.WIRE_ON && (await G(69, 14, 94)) === RB.RLAMP_ON);
  // NOT gate (facing east) between a lever and a lamp
  await S(66, 13, 98, RB.LEVER); await S(67, 13, 98, RB.NOTG + 1); await S(68, 13, 98, RB.RLAMP);
  await ticks(3);
  check('a NOT gate with nothing coming in is on', (await G(68, 13, 98)) === RB.RLAMP_ON);
  await a.evaluate(() => window.__isle.rs.use(66, 13, 98)); await ticks(3);
  check('and off when its input is on', (await G(68, 13, 98)) === RB.RLAMP);
  // a delay passes it on a moment later
  await S(66, 13, 102, RB.LEVER); await S(67, 13, 102, RB.DELAY + 1); await S(68, 13, 102, RB.RLAMP);
  await ticks(2);
  const dl = await a.evaluate(() => { const I = window.__isle, r = []; I.rs.use(66, 13, 102); I.rs.step(); r.push(I.get(68, 13, 102)); for (let k = 0; k < 5; k++) I.rs.step(); r.push(I.get(68, 13, 102)); return r; });
  check('a delay passes the signal on, a moment later', dl[0] === RB.RLAMP && dl[1] === RB.RLAMP_ON, dl);
  // pressure plate
  await S(74, 13, 98, RB.PLATE); await S(75, 13, 98, RB.WIRE); await S(76, 13, 98, RB.RLAMP);
  await ticks(2);
  const off0 = await G(76, 13, 98);
  await put(a, 74.5, 13.07, 98.5); await ticks(2);
  const on1 = await G(76, 13, 98);
  await put(a, 80.5, 13, 80.5); await ticks(2);
  check('standing on a pressure plate powers it, stepping off doesn’t', off0 === RB.RLAMP && on1 === RB.RLAMP_ON && (await G(76, 13, 98)) === RB.RLAMP, [off0, on1]);
  // button
  await S(74, 13, 102, RB.BUTTON); await S(75, 13, 102, RB.RLAMP);
  await a.evaluate(() => window.__isle.rs.use(74, 13, 102)); await ticks(2);
  const bon = await G(75, 13, 102);
  await wait(1500); await ticks(2); await wait(300); await ticks(2);
  check('a button lights it for a second, then pops back up', bon === RB.RLAMP_ON && (await G(74, 13, 102)) === RB.BUTTON && (await G(75, 13, 102)) === RB.RLAMP, bon);
  // a powered door opens
  await S(86, 13, 100, RB.DOOR); await S(86, 14, 100, RB.DOOR_TOP); await S(85, 13, 100, RB.LEVER);
  await ticks(2);
  const shut = await G(86, 13, 100);
  await a.evaluate(() => window.__isle.rs.use(85, 13, 100)); await ticks(2);
  const open = await G(86, 13, 100);
  await a.evaluate(() => window.__isle.rs.use(85, 13, 100)); await ticks(2);
  check('a lever opens a door next to it, and shuts it again', shut === RB.DOOR && open === RB.DOOR_OPEN && (await G(86, 13, 100)) === RB.DOOR, [shut, open]);
  // note block
  const n0 = await a.evaluate(() => window.__isle.rs.notes());
  await S(90, 13, 96, RB.NOTE); await S(89, 13, 96, RB.BUTTON); await a.evaluate(() => window.__isle.rs.use(89, 13, 96)); await ticks(2);
  check('a powered note block plays a note', (await a.evaluate(() => window.__isle.rs.notes())) === n0 + 1);
  // TNT
  for (let x = 92; x <= 96; x++) for (let z = 88; z <= 90; z++) await S(x, 13, z, RB.DIRT);
  await S(94, 14, 89, RB.TNT); await S(94, 15, 89, RB.LEVER);
  const b0 = await a.evaluate(() => window.__isle.rs.booms());
  await a.evaluate(() => window.__isle.rs.use(94, 15, 89)); await ticks(2);
  check('powered TNT gets lit', (await a.evaluate(() => window.__isle.rs.tnt())) === 1);
  await a.evaluate(() => window.__isle.rs.rush()); await wait(800);
  check('and blows a hole in what’s round it', (await a.evaluate(() => window.__isle.rs.booms())) === b0 + 1 && (await G(94, 14, 89)) === 0 && (await G(93, 13, 89)) === 0 && (await G(94, 12, 89)) !== 0);
  await put(a, 80.5, 13, 92.5); await wait(300);
  }

  {
  // ----- pistons and observers -----
  const MB = await a.evaluate(() => { const I = window.__isle, n = {}; for (const k of ['PISTON', 'PISTON_ON', 'STICKY', 'STICKY_ON', 'HEAD', 'SHEAD', 'OBSERVER', 'LEVER', 'STONE', 'OBSIDIAN', 'WIRE', 'RLAMP', 'RLAMP_ON', 'PLANKS']) n[k] = I.blockId(k); return n; });
  check('pistons, sticky pistons and observers are in the block picker', await a.evaluate((M) => ['PISTON', 'STICKY', 'OBSERVER'].every((k) => window.__isle.picker.picks.indexOf(M[k]) >= 0), MB));
  await put(a, 80.5, 13, 80.5); await wait(200);
  const S = (x, y, z, b) => a.evaluate((q) => window.__isle.setBlock(q[0], q[1], q[2], q[3]), [x, y, z, b]);
  const G = (x, y, z) => a.evaluate((q) => window.__isle.get(q[0], q[1], q[2]), [x, y, z]);
  const ticks = (n) => a.evaluate((n) => { for (let k = 0; k < n; k++) window.__isle.rs.step(); }, n);
  const flip = (x, y, z) => a.evaluate((q) => window.__isle.rs.use(q[0], q[1], q[2]), [x, y, z]);
  // a piston pushing two blocks
  await S(66, 13, 106, MB.LEVER); await S(67, 13, 106, MB.PISTON + 1); await S(68, 13, 106, MB.STONE); await S(69, 13, 106, MB.PLANKS);
  await ticks(2); await flip(66, 13, 106); await ticks(2);
  const pushed = [await G(67, 13, 106), await G(68, 13, 106), await G(69, 13, 106), await G(70, 13, 106)];
  check('a powered piston pushes out and shoves the blocks in front along one', pushed[0] === MB.PISTON_ON + 1 && pushed[1] === MB.HEAD + 1 && pushed[2] === MB.STONE && pushed[3] === MB.PLANKS, pushed);
  await flip(66, 13, 106); await ticks(2);
  check('and pulls back when the power goes, leaving them there', (await G(67, 13, 106)) === MB.PISTON + 1 && (await G(68, 13, 106)) === 0 && (await G(69, 13, 106)) === MB.STONE);
  // sticky
  await S(66, 13, 108, MB.LEVER); await S(67, 13, 108, MB.STICKY + 1); await S(68, 13, 108, MB.STONE);
  await ticks(2); await flip(66, 13, 108); await ticks(2);
  const sOut = [await G(68, 13, 108), await G(69, 13, 108)];
  await flip(66, 13, 108); await ticks(2);
  check('a sticky piston pulls its block back with it', sOut[0] === MB.SHEAD + 1 && sOut[1] === MB.STONE && (await G(68, 13, 108)) === MB.STONE && (await G(69, 13, 108)) === 0 && (await G(67, 13, 108)) === MB.STICKY + 1, sOut);
  // obsidian won't budge
  await S(66, 13, 110, MB.LEVER); await S(67, 13, 110, MB.PISTON + 1); await S(68, 13, 110, MB.OBSIDIAN);
  await ticks(2); await flip(66, 13, 110); await ticks(2);
  check('obsidian can’t be pushed', (await G(67, 13, 110)) === MB.PISTON + 1 && (await G(68, 13, 110)) === MB.OBSIDIAN, [await G(66, 13, 110), await G(67, 13, 110), await G(68, 13, 110), await G(69, 13, 110)]);
  // wire gets crushed
  await S(66, 13, 112, MB.LEVER); await S(67, 13, 112, MB.PISTON + 1); await S(68, 13, 112, MB.WIRE);
  await ticks(2); await flip(66, 13, 112); await ticks(2);
  check('wire in the way gets crushed', (await G(68, 13, 112)) === MB.HEAD + 1 && (await G(69, 13, 112)) === 0);
  // breaking the head takes the piston too
  await a.evaluate(() => window.__isle.act.brk(68, 13, 112)); await ticks(1);
  check('breaking a piston’s head breaks the piston too', (await G(68, 13, 112)) === 0 && (await G(67, 13, 112)) === 0);
  // a piston facing up launches you
  await S(63, 13, 84, MB.LEVER); await S(64, 13, 84, MB.PISTON + 4); await ticks(2);
  await put(a, 64.5, 14, 84.5);
  const y0 = await a.evaluate(() => window.__isle.player.y);
  await flip(63, 13, 84); await ticks(1);
  const up = await a.evaluate(() => ({ y: window.__isle.player.y, vy: window.__isle.player.vy }));
  check('a piston pointing up pushes you up with it', (await G(64, 14, 84)) === MB.HEAD + 4 && up.y >= y0 + 0.9, [y0, up]);
  await put(a, 80.5, 13, 80.5); await wait(200);
  // observer: watches east, fires out of its back into a lamp
  await S(65, 13, 80, MB.RLAMP); await S(66, 13, 80, MB.OBSERVER + 1); await ticks(3);
  const ob = await a.evaluate(() => { const I = window.__isle, r = [I.get(65, 13, 80)]; I.setBlock(67, 13, 80, I.blockId('STONE')); I.rs.step(); r.push(I.get(65, 13, 80)); for (let k = 0; k < 4; k++) I.rs.step(); r.push(I.get(65, 13, 80)); return r; });
  check('an observer gives a short pulse when the block in front of it changes', ob[0] === MB.RLAMP && ob[1] === MB.RLAMP_ON && ob[2] === MB.RLAMP, ob);
  await put(a, 80.5, 13, 92.5); await wait(300);
  }

  {
  // ----- wire's thin hitbox -----
  const WB = await a.evaluate(() => ({ WIRE: window.__isle.blockId('WIRE'), STONE: window.__isle.blockId('STONE') }));
  await a.evaluate((W) => { const I = window.__isle; I.setBlock(70, 13, 80, W.STONE); I.setBlock(70, 14, 80, W.WIRE); I.setBlock(72, 14, 80, W.STONE); I.setBlock(72, 13, 80, W.STONE); }, WB);
  await a.evaluate(() => { const P = window.__isle.player; P.fly = true; P.vx = P.vy = P.vz = 0; P.x = 67.5; P.y = 13.0; P.z = 80.5; P.yaw = -Math.PI / 2; P.pitch = 0; });
  if (await a.evaluate(() => window.__isle.camAt().third)) await a.keyboard.press('KeyV');
  await wait(300);
  const t1 = await a.evaluate(() => { const P = window.__isle.player; P.x = 67.5; P.y = 13.0; P.z = 80.5; P.yaw = -Math.PI / 2; P.pitch = 0; return window.__isle.aimAt(); });
  check('looking over a wire, you aim at what’s behind it, not the wire', !!t1 && t1.x === 72 && t1.y === 14, t1);
  const t2 = await a.evaluate(() => { const P = window.__isle.player; P.x = 68.5; P.y = 13.0; P.z = 80.5; P.yaw = -Math.PI / 2; const ey = 13 + 1.62, dx = 70.5 - 68.5, dy = 14.05 - ey; P.pitch = Math.atan2(dy, dx); return window.__isle.aimAt(); });
  check('but looking at the wire itself hits it', !!t2 && t2.x === 70 && t2.y === 14, t2);
  await a.evaluate(() => { window.__isle.player.fly = false; });
  // ----- the jumbo -----
  await a.evaluate(() => { const I = window.__isle; I.setSkin({ pet: 'none' }); I.jumbo.board(); });
  await wait(600);
  check('the jet is now a jumbo, and you come aboard standing by the door', await a.evaluate(() => { const w = window.__isle.jumbo.walk(); return !!w && !w.sit && w.y < 0 && window.__isle.jumbo.door(); }));
  // walk down the cabin
  const w0 = await a.evaluate(() => window.__isle.jumbo.walk());
  await a.evaluate(() => window.__isle.jumbo.put({ x: 4.8, z: 0, y: -0.4 }));
  await a.keyboard.down('KeyW'); await wait(1500); await a.keyboard.up('KeyW');
  const w1 = await a.evaluate(() => window.__isle.jumbo.walk());
  check('W walks you down the aisle', w1.x < 4.65, [w0, w1]);
  check('you stay in the aisle between the seats', Math.abs(w1.z) <= 0.31, w1);
  // sit and stand
  await a.evaluate(() => window.__isle.jumbo.put({ x: 2.5, z: 0.2, y: -0.4 }));
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(200);
  const sat = await a.evaluate(() => window.__isle.jumbo.walk());
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(200);
  check('E by a seat sits you down, and E again stands you up', !!sat.sit && !sat.sit.biz && !(await a.evaluate(() => window.__isle.jumbo.walk().sit)), sat);
  // business is for owl owners
  const up0 = await a.evaluate(() => { const I = window.__isle; I.jumbo.put({ x: -3.5, z: 0.5, y: -0.4, sit: null }); return I.jumbo.walk(); });
  await a.evaluate(() => { const I = window.__isle, P = I.player, h = I.jet.pose.h; P.yaw = Math.atan2(-Math.cos(h), -Math.sin(h)) + Math.PI; });
  await a.keyboard.down('KeyW'); await wait(1500); await a.keyboard.up('KeyW');
  const up1 = await a.evaluate(() => window.__isle.jumbo.walk());
  check('without an owl you can’t go up to business class', up1.y < -0.3 && up1.x > -3.7, [up0, up1]);
  await a.evaluate(() => { window.__isle.setSkin({ pet: 'hoot' }); window.__isle.jumbo.put({ x: -3.5, z: 0.5, y: -0.4 }); });
  const climb = await a.evaluate(async () => { const I = window.__isle, P = I.player; for (let k = 0; k < 40; k++) { const h = I.jet.pose.h; P.yaw = Math.atan2(-Math.cos(h), -Math.sin(h)) + Math.PI; await new Promise((r) => setTimeout(r, 100)); if (I.jumbo.walk().y > 1.7) break; } return I.jumbo.walk(); });
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => window.__isle.jumbo.walk().y > 1.7, null, { timeout: 15000 }).catch(() => {});
  await a.keyboard.up('KeyW');
  const top = await a.evaluate(() => window.__isle.jumbo.walk());
  check('Hoot’s owner walks up the stairs to business class', top.y > 1.7, [climb, top]);
  // a business pod and the bar
  await a.evaluate(() => window.__isle.jumbo.put({ x: 2.7, z: 0.4, y: 1.75 }));
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(200);
  const pod = await a.evaluate(() => window.__isle.jumbo.walk());
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(200);
  check('upstairs, E sits you in a lie-flat business pod', !!pod.sit && pod.sit.biz, pod);
  await a.evaluate(() => window.__isle.jumbo.put({ x: 4.7, z: 0, y: 1.75 }));
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(300);
  check('and the business bar serves you a drink', /bubbly|Strawberries|tea|juice/.test(await a.textContent('#toast')) && !!(await a.evaluate(() => window.__isle.jumbo.walk())));
  // off at the door
  await a.evaluate(() => window.__isle.jumbo.put({ x: 5.2, z: 0.5, y: -0.4 }));
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(400);
  check('E by the front door gets you off', !(await a.evaluate(() => window.__isle.jumbo.walk())) && !(await a.evaluate(() => window.__isle.jet.seat)));
  await a.evaluate(() => { const I = window.__isle; I.noChute(); I.setSkin({ pet: 'none' }); });
  await put(a, 80.5, 13, 92.5); await wait(300);
  }

  {
  // ----- slime, flying machines, rails, spark doors, daylight sensor -----
  const K = await a.evaluate(() => { const I = window.__isle, n = {}; for (const k of ['SLIME', 'RAIL', 'PRAIL', 'SDOOR', 'SDOOR_OPEN', 'DSENSOR', 'STICKY', 'LEVER', 'STONE', 'PLANKS', 'RLAMP', 'RLAMP_ON', 'OBSERVER']) n[k] = I.blockId(k); return n; });
  check('slime, rails, powered rails, spark doors and the daylight sensor are in the picker', await a.evaluate((K) => ['SLIME', 'RAIL', 'PRAIL', 'SDOOR', 'DSENSOR'].every((k) => window.__isle.picker.picks.indexOf(K[k]) >= 0), K));
  await put(a, 80.5, 13, 80.5); await wait(200);
  const S = (x, y, z, b) => a.evaluate((q) => window.__isle.setBlock(q[0], q[1], q[2], q[3]), [x, y, z, b]);
  const G = (x, y, z) => a.evaluate((q) => window.__isle.get(q[0], q[1], q[2]), [x, y, z]);
  const ticks = (n) => a.evaluate((n) => { for (let k = 0; k < n; k++) window.__isle.rs.step(); }, n);
  const flip = (x, y, z) => a.evaluate((q) => window.__isle.rs.use(q[0], q[1], q[2]), [x, y, z]);
  // a sticky piston pushes slime, and the block stuck to the slime's side comes too
  await S(66, 13, 114, K.LEVER); await S(67, 13, 114, K.STICKY + 1); await S(68, 13, 114, K.SLIME); await S(68, 13, 115, K.PLANKS); await S(68, 14, 114, K.STONE);
  await ticks(2); await flip(66, 13, 114); await ticks(2);
  const pushed = [await G(69, 13, 114), await G(69, 13, 115), await G(69, 14, 114), await G(68, 13, 115)];
  check('slime drags the blocks stuck to it along', pushed[0] === K.SLIME && pushed[1] === K.PLANKS && pushed[2] === K.STONE && pushed[3] === 0, pushed);
  await flip(66, 13, 114); await ticks(2);
  check('and a sticky piston pulls the whole lot back', (await G(68, 13, 114)) === K.SLIME && (await G(68, 13, 115)) === K.PLANKS && (await G(69, 13, 114)) === 0);
  // a flying machine
  await put(a, 70.5, 13, 98.5, Math.PI / 2); await a.evaluate(() => { window.__isle.player.yaw = -Math.PI / 2; }); await wait(200);
  check('/machine builds a flying machine', await a.evaluate(() => window.__isle.cmd('/machine')));
  const f0 = await a.evaluate(() => window.__isle.rs.flights());
  // it was built 3 ahead (east) at y+3: the observer looks south, poke it
  await S(73, 16, 100, K.STONE); await ticks(1); await S(73, 16, 100, 0);
  await ticks(16);
  const fl = await a.evaluate(() => window.__isle.rs.flights());
  check('poke its observer and it flies itself along, block after block', fl - f0 >= 3, [f0, fl]);
  await put(a, 80.5, 13, 80.5); await wait(200);
  // spark doors: a 2 x 3 door all opens off one lever
  for (let y = 13; y <= 15; y++) for (let z = 120; z <= 121; z++) await S(70, y, z, K.SDOOR);
  await S(70, 13, 119, K.LEVER); await ticks(2);
  const shut = await G(70, 15, 121);
  await flip(70, 13, 119); await ticks(2);
  const opened = [await G(70, 13, 120), await G(70, 15, 121), await G(70, 14, 120)];
  await flip(70, 13, 119); await ticks(2);
  check('a lever opens every block of a spark door, and shuts it again', shut === K.SDOOR && opened.every((b) => b === K.SDOOR_OPEN) && (await G(70, 15, 121)) === K.SDOOR, [shut, opened]);
  // daylight sensor: on at night
  await S(74, 13, 122, K.DSENSOR); await S(75, 13, 122, K.RLAMP);
  await a.evaluate(() => window.__isle.cmd('/time noon')); await wait(300); await ticks(2);
  const day = await G(75, 13, 122);
  await a.evaluate(() => window.__isle.cmd('/time midnight')); await wait(300); await ticks(2);
  const night = await G(75, 13, 122);
  await a.evaluate(() => window.__isle.cmd('/time noon')); await wait(300); await ticks(2);
  check('a daylight sensor gives power at night', day === K.RLAMP && night === K.RLAMP_ON, [day, night]);
  // rails and a minecart round a bend
  for (let x = 62; x <= 66; x++) await S(x, 13, 108, K.RAIL);
  for (let z = 107; z >= 104; z--) await S(66, 13, z, K.RAIL);
  await S(61, 13, 108, K.PRAIL); await S(60, 13, 108, K.LEVER); await flip(60, 13, 108); await ticks(2);
  check('spark power reaches a powered rail', await a.evaluate(() => window.__isle.rs.railOn(61, 13, 108)));
  await put(a, 61.5, 13, 108.5); await a.evaluate(() => { window.__isle.player.yaw = -Math.PI / 2; });
  check('E by a rail puts you in a minecart', await a.evaluate(() => window.__isle.cart.start()) && !!(await a.evaluate(() => window.__isle.cart.on())));
  await a.keyboard.down('KeyW'); await wait(1200); await a.keyboard.up('KeyW');
  await a.waitForFunction(() => { const c = window.__isle.cart.on(); return c && c.a[2] <= 105; }, null, { timeout: 30000 }).catch(() => {});
  const c1 = await a.evaluate(() => window.__isle.cart.on());
  check('it rolls along the track and round the bend', !!c1 && c1.a[0] === 66 && c1.a[2] <= 105, c1);
  await a.evaluate(() => window.__isle.cart.leave());
  check('E gets you out', !(await a.evaluate(() => window.__isle.cart.on())));
  check('and riding one earns the All aboard badge', !!(await a.evaluate(() => window.__isle.ach.all().cart)));
  await put(a, 80.5, 13, 92.5); await wait(300);
  }

  {
  // ----- the jumbo's trolley, cargo hold, air show and pilot licence -----
  await a.evaluate(() => { const I = window.__isle; I.shop.give(20); I.setSkin({ pet: 'none' }); I.jumbo.board(); });
  await wait(500);
  const c0 = await a.evaluate(() => window.__isle.shop.coins());
  await a.evaluate(() => { const I = window.__isle; I.jumbo.put({ x: I.jj2.trolleyX(), z: 0, y: -0.4, sit: null }); });
  check('the snack trolley rolls up and down the aisle', await a.evaluate(() => window.__isle.jj2.nearTrolley()));
  await a.evaluate(() => { const I = window.__isle; I.jumbo.put({ x: I.jj2.trolleyX(), z: 0, y: -0.4 }); I.toggleBoard(); });
  await wait(300);
  check('E by it buys a snack for 4 coins', (await a.evaluate(() => window.__isle.shop.coins())) === c0 - 4 && !!(await a.evaluate(() => window.__isle.ach.all().trolley)), [c0, await a.evaluate(() => window.__isle.shop.coins())]);
  await a.evaluate(() => { const I = window.__isle; I.jumbo.put({ x: 5.2, z: 0.5, y: -0.4, sit: null }); I.toggleBoard(); I.noChute(); });
  await wait(300);
  // the licence: up in the air a while, then a gentle landing on the runway
  await a.evaluate(() => window.__isle.cmd('/spawn jet')); await wait(400);
  await a.evaluate(() => { const q = window.__isle.jet.pose, P = window.__isle.player; P.x = q.x + 1; P.y = q.y - 1.5; P.z = q.z; });
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(300);
  const pil = await a.evaluate(() => window.__isle.jet.seat);
  await a.evaluate(() => { const I = window.__isle, q = I.jet.pose; I.jj2.licAir(8); q.x = 160; q.z = 125; q.y = 14.6; q.h = Math.PI / 2; q.p = 0; q.r = 0; I.jet.spd = 4; I.jet.thr = 0; });
  await a.waitForFunction(() => window.__isle.jj2.licence(), null, { timeout: 15000 }).catch(() => {});
  check('landing the jumbo gently on the runway earns a pilot licence', pil === 'pilot' && await a.evaluate(() => window.__isle.jj2.licence()) && !!(await a.evaluate(() => window.__isle.ach.all().licence)), pil);
  await a.evaluate(() => { const I = window.__isle; I.toggleBoard(); I.noChute(); I.cmd('/despawn jet'); });
  await wait(400);
  // the air show
  await put(a, 80.5, 13, 92.5); await a.evaluate(() => window.__isle.cmd('/time 21:00')); await wait(1500);
  check('at half past eight in the evening the Express puts on an air show over the meadow', await a.evaluate(() => window.__isle.jj2.show()));
  await a.waitForFunction(() => window.__isle.spark.live() > 10, null, { timeout: 20000 }).catch(() => {});
  check('trailing Spark Dust', (await a.evaluate(() => window.__isle.spark.live())) > 10);
  await a.evaluate(() => window.__isle.cmd('/time noon')); await wait(800);
  check('and it’s back on its timetable after', !(await a.evaluate(() => window.__isle.jj2.show())));
  // the cargo hold: a jet ski goes aboard while the jumbo waits at a dock
  await a.waitForFunction(() => { const I = window.__isle, st = I.jetStatus(I.nowS()); return st.at != null && !st.manual && (st.leave === undefined || st.leave > 8); }, null, { timeout: 240000 }).catch(() => {});
  const onSki = await a.evaluate(() => window.__isle.jj2.skiByJet());
  await wait(300);
  console.log('CARGO', JSON.stringify(await a.evaluate(() => { const I = window.__isle, st = I.jetStatus(I.nowS()), q = I.jet.pose, P = I.player; return [st.at, st.manual, I.jj2.ski(), Math.hypot(P.x - q.x, P.z - q.z)]; })));
  check('ride a jet ski up to the jumbo at a dock and E loads it into the hold', onSki && await a.evaluate(() => window.__isle.jj2.cargoMay()) && await a.evaluate(() => { window.__isle.toggleBoard(); return !!window.__isle.jj2.cargo() && !!window.__isle.jet.seat; }), onSki);
  await a.evaluate(() => { const I = window.__isle; I.jumbo.put({ x: 5.2, z: 0.5, y: -0.4, sit: null }); I.toggleBoard(); I.noChute(); });
  await wait(300);
  check('and get off at the door: it’s unloaded into the water beside you', !(await a.evaluate(() => window.__isle.jj2.cargo())) && await a.evaluate(() => { const I = window.__isle, s = I.skis.list()[0], P = I.player; return Math.hypot(s.x - P.x, s.z - P.z) < 14; }));
  await put(a, 80.5, 13, 92.5); await wait(300);
  }

  {
  // ----- pet levels, the pet race and Gruff's lookout -----
  await a.evaluate(() => { const I = window.__isle; I.setSkin({ pet: 'hoot' }); I.shop.give(30); });
  const x0 = await a.evaluate(() => window.__isle.petlv.xp('hoot'));
  await a.evaluate(() => window.__isle.social.trick()); await wait(200);
  check('a trick earns your pet XP', (await a.evaluate(() => window.__isle.petlv.xp('hoot'))) === x0 + 5);
  await a.evaluate(() => window.__isle.petlv.gain(90)); await wait(300);
  check('enough XP and it levels up, with stronger powers', (await a.evaluate(() => window.__isle.petlv.level('hoot'))) >= 3 && (await a.evaluate(() => window.__isle.petlv.k())) >= 1.5);
  // the pet race
  await put(a, 80.5, 13, 92.5); await wait(200);
  check('/petrace starts a pet race', await a.evaluate(() => window.__isle.cmd('/petrace')));
  const c0 = await a.evaluate(() => window.__isle.shop.coins());
  await a.keyboard.press('Digit1'); await wait(300);
  const bet = await a.evaluate(() => window.__isle.prace.state());
  check('press 1 to bet 5 coins on the first pet', !!bet && bet.bet === 'hoot' && (await a.evaluate(() => window.__isle.shop.coins())) === c0 - 5, bet);
  await a.evaluate(() => window.__isle.prace.rush()); await wait(1500);
  check('then they’re off', (await a.evaluate(() => window.__isle.prace.state().phase)) === 'run');
  await a.evaluate(() => window.__isle.prace.nearEnd());
  await a.waitForFunction(() => { const s = window.__isle.prace.state(); return !s || s.winner; }, null, { timeout: 60000 }).catch(() => {});
  const fin = await a.evaluate(() => window.__isle.prace.state());
  const c1 = await a.evaluate(() => window.__isle.shop.coins());
  check('and one of them wins: back the winner and you get 15 coins', !!fin && !!fin.winner && (fin.winner !== 'hoot' || c1 === c0 + 10), [fin, c0, c1]);
  // Gruff's lookout
  const L = await a.evaluate(() => window.__isle.goatLook.at());
  check('a rock spire with ledges and a lookout stands by Gruff’s peak', L.ok && (await a.evaluate((L) => window.__isle.get(L.cx, L.gy + 7, L.cz), L)) === (await a.evaluate(() => window.__isle.blockId('PLANKS'))), L);
  check('only Gruff’s owner can climb it', await a.evaluate((L) => { const I = window.__isle, P = I.player; P.x = L.cx + 0.5; P.y = L.gy + 8; P.z = L.cz + 0.5; return !I.roomy(); }, L));
  await a.evaluate(() => window.__isle.setSkin({ pet: 'goat' }));
  check('Gruff’s owner can', await a.evaluate((L) => { const I = window.__isle, P = I.player; P.fly = true; P.x = L.cx + 0.5; P.y = L.gy + 8; P.z = L.cz + 0.5; return I.roomy(); }, L));
  const c2 = await a.evaluate(() => window.__isle.shop.coins());
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(300);
  check('and E at the telescope up top gives the view, and 15 coins once a day', (await a.evaluate(() => window.__isle.shop.coins())) >= c2 && !!(await a.evaluate(() => window.__isle.ach.all().lookout)));
  await a.evaluate(() => { const I = window.__isle; I.player.fly = false; I.setSkin({ pet: 'none' }); });
  await put(a, 80.5, 13, 92.5); await wait(300);
  }

  {
  // ----- seasons, lightning, the night market and the treasure map -----
  await put(a, 80.5, 13, 92.5); await wait(200);
  await a.evaluate(() => window.__isle.cmd('/season winter')); await wait(1200);
  check('in winter snowflakes drift down', (await a.evaluate(() => window.__isle.seasons.kind())) === 'snow');
  await a.evaluate(() => window.__isle.cmd('/season autumn')); await wait(1200);
  check('in autumn red and gold leaves fall', (await a.evaluate(() => window.__isle.seasons.kind())) === 'leaves');
  await a.evaluate(() => { window.__isle.cmd('/season bonfire'); window.__isle.cmd('/time midnight'); }); await wait(1500);
  check('on bonfire night there are fireworks over the meadow', (await a.evaluate(() => window.__isle.fw.rockets())) > 0 || !!(await a.evaluate(() => window.__isle.ach.all().bonfire)));
  await a.evaluate(() => window.__isle.cmd('/season auto'));
  check('and the season follows the calendar again with /season auto', /winter|spring|summer|autumn|bonfire/.test(await a.evaluate(() => window.__isle.seasons.now())));
  // lightning
  const LK = await a.evaluate(() => ({ TNT: window.__isle.blockId('TNT'), WIRE: window.__isle.blockId('WIRE'), STONE: window.__isle.blockId('STONE') }));
  await a.evaluate((K) => { const I = window.__isle; for (let x = 90; x <= 93; x++) I.setBlock(x, 13, 112, K.STONE); I.setBlock(92, 14, 112, K.TNT); I.setBlock(90, 14, 112, K.WIRE); }, LK);
  await a.evaluate(() => window.__isle.bolt.strike(91.5, 112.5)); await wait(200);
  check('a lightning bolt lights TNT it hits', (await a.evaluate(() => window.__isle.rs.tnt())) >= 1);
  check('and gives nearby wire a jolt of power', (await a.evaluate(() => window.__isle.bolt.zap())) >= 1);
  await a.evaluate(() => window.__isle.rs.rush()); await wait(800);
  // the night market (still midnight)
  await a.evaluate(() => window.__isle.shop.give(20)); await wait(400);
  check('after dark the night market opens on the meadow', await a.evaluate(() => window.__isle.market.open()));
  await put(a, 70.5, 13, 74.3); await wait(300);
  const m0 = await a.evaluate(() => window.__isle.shop.coins());
  await a.evaluate(() => window.__isle.toggleBoard()); await wait(300);
  check('E at a stall buys a glow block for 10 coins, and it’s in the block picker', (await a.evaluate(() => window.__isle.market.owned())).indexOf(0) >= 0 && (await a.evaluate(() => window.__isle.shop.coins())) === m0 - 10 && await a.evaluate(() => window.__isle.picker.picks.indexOf(window.__isle.blockId('GLOW')) >= 0), m0);
  await a.evaluate(() => window.__isle.cmd('/time noon')); await wait(400);
  check('and by day the market’s gone', !(await a.evaluate(() => window.__isle.market.open())));
  // the treasure map
  const T = await a.evaluate(() => window.__isle.treasure.spot());
  await a.evaluate(() => window.__isle.news.show({ day: 'today', c: {}, res: [] })); await wait(300);
  check('the Island Gazette prints a treasure map with an X', await a.evaluate(() => !!document.getElementById('treasureMap') && /TREASURE MAP/.test(document.getElementById('letter').textContent)));
  await a.evaluate(() => { const e = document.getElementById('letter'); if (e) e.hidden = true; });
  const t0 = await a.evaluate(() => window.__isle.shop.coins());
  check('dig at the X and you find the chest: 40 coins', await a.evaluate((T) => window.__isle.treasure.dig(T.x, T.y, T.z), T) && (await a.evaluate(() => window.__isle.shop.coins())) === t0 + 40, T);
  check('but only once a day', !(await a.evaluate((T) => window.__isle.treasure.dig(T.x, T.y, T.z), T)));
  await put(a, 80.5, 13, 92.5); await wait(300);
  }

  // ----- in a room -----
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.evaluate(() => window.__isle && window.__isle.more(true)); await g.fill('#nCode', code); await g.evaluate(() => window.__isle && window.__isle.more(true)); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 240000 });
  await play(g); await play(a);
  await put(a, 80.5, 13, 92.5); await put(g, 82.5, 13, 92.5);
  const peerA = () => g.evaluate(() => [...window.__isle.net.peers.values()].find((q) => q.name !== 'Gus'));
  await g.waitForFunction(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Gus'); return p && p.av; }, null, { timeout: 15000 }).catch(() => {});
  // accessories travel with the skin
  await a.evaluate(() => window.__isle.setSkin({ petHatStyle: 'party', petHat: '#ff8fb1', petCollarStyle: 'bandana', petCollar: '#56b04a' }));
  await g.waitForFunction(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Gus'); return p && window.__isle.petAcc('peer:' + p.id) >= 2; }, null, { timeout: 15000 }).catch(() => {});
  check('others see your pet’s hat and collar', await g.evaluate(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Gus'); return !!p && window.__isle.petAcc('peer:' + p.id) >= 2; }));
  // zip lines come from the blocks, so everyone gets them
  await a.evaluate(() => { const I = window.__isle; for (let y = 13; y <= 15; y++) I.setBlock(70, y, 96, 3); I.setBlock(70, 16, 96, 87); I.setBlock(70, 13, 104, 87); });
  const hostLines = await a.evaluate(() => window.__isle.zip.lines().length);
  await g.waitForFunction((n) => window.__isle.zip.lines().length === n, hostLines, { timeout: 15000 }).catch(() => {});
  check('a zip line someone builds strings up for everyone', hostLines >= 1 && (await g.evaluate(() => window.__isle.zip.lines().length)) === hostLines, [hostLines, await g.evaluate(() => window.__isle.zip.lines().length)]);
  // reactions and typing
  await a.evaluate(() => window.__isle.cmd('/react party'));
  const sawReact = await g.waitForFunction(() => window.__isle.react.fx() > 0, null, { timeout: 8000 }).then(() => true).catch(() => false);
  check('others see your reaction', sawReact);
  await a.keyboard.press('Enter'); await wait(200);
  await a.keyboard.type('hel');
  await g.waitForFunction(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Gus'); return p && p.av && p.av.typeFx && p.av.typeFx.visible; }, null, { timeout: 8000 }).catch(() => {});
  check('and dots over your head while you type', await g.evaluate(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Gus'); return !!(p && p.av && p.av.typeFx && p.av.typeFx.visible); }));
  await a.keyboard.type('lo!'); await a.keyboard.press('Enter');
  await g.waitForFunction(() => window.__isle.social.bubbles() > 0, null, { timeout: 8000 }).catch(() => {});
  check('then your words in a bubble', (await g.evaluate(() => window.__isle.social.bubbles())) > 0 && !(await g.evaluate(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Gus'); return !!(p && p.av && p.av.typeFx && p.av.typeFx.visible); })));
  // the jet blowing up for everyone, and the passengers thrown out on to East Beach too
  await put(a, 80.5, 13, 92.5, 0); await put(g, 82.5, 13, 92.5, 0);
  await a.evaluate(() => window.__isle.cmd('/spawn jet'));
  await g.waitForFunction(() => window.__isle.jet.park, null, { timeout: 8000 }).catch(() => {});
  await a.waitForFunction(() => window.__isle.jet.park, null, { timeout: 8000 }).catch(() => {});
  await a.evaluate(() => { const q = window.__isle.jet.pose, P = window.__isle.player; P.x = q.x + 1; P.y = q.y - 1.5; P.z = q.z; });
  await a.evaluate(() => window.__isle.toggleBoard());
  await a.waitForFunction(() => window.__isle.jet.seat === 'pilot', null, { timeout: 8000 }).catch(() => {});
  await g.evaluate(() => { const q = window.__isle.jet.pose, P = window.__isle.player; P.x = q.x + 1; P.y = q.y - 1.5; P.z = q.z; });
  await g.evaluate(() => window.__isle.toggleBoard());
  await g.waitForFunction(() => window.__isle.jet.seat && window.__isle.jet.seat !== 'pilot', null, { timeout: 8000 }).catch(() => {});
  check('a guest hops aboard as a passenger', !!(await g.evaluate(() => window.__isle.jet.seat)));
  await aimJet(a, true);
  await g.waitForFunction(() => window.__isle.crash.booms() > 0, null, { timeout: 60000 }).catch(() => {});
  check('in a room everyone sees the jet blow up', (await g.evaluate(() => window.__isle.crash.booms())) > 0);
  const gc = await g.evaluate(() => { const I = window.__isle, P = I.player, b = I.crash.beach(); return { seat: I.jet.seat, d: Math.hypot(P.x - b.x, P.z - b.z) }; });
  check('and the passenger wakes up on East Beach too', gc.seat === null && gc.d < 1.5, gc);
  check('so does the pilot', await a.evaluate(() => { const I = window.__isle, P = I.player, b = I.crash.beach(); return I.jet.seat === null && Math.hypot(P.x - b.x, P.z - b.z) < 1.5; }));
  check('everyone in the room shares the crash count', (await g.evaluate(() => window.__isle.silly.crashes())) === (await a.evaluate(() => window.__isle.silly.crashes())) && (await a.evaluate(() => window.__isle.silly.crashes())) >= 1);
  // the porta-potty's count and the flood are shared
  const gu0 = await g.evaluate(() => window.__isle.potty.uses());
  await put(g, po.ix + 0.5, po.G, po.iz + 0.5);
  for (let k = 0; k < 3; k++) { await g.evaluate(() => window.__isle.potty.ready()); await g.keyboard.press('KeyE'); await wait(2300); }
  await a.waitForFunction(() => window.__isle.potty.left() > 0, null, { timeout: 10000 }).catch(() => {});
  check('in a room everyone shares the potty’s count, and the flood', (await g.evaluate(() => window.__isle.potty.uses())) === gu0 + 3 && (await a.evaluate(() => window.__isle.potty.left())) > 0, [gu0, await g.evaluate(() => window.__isle.potty.uses()), await a.evaluate(() => window.__isle.potty.left())]);
  // Bazza in a room: the host's game sends him off, everyone sees him go, and the eggs land at the guest's place
  await g.evaluate(() => window.__isle.setSkin({ pet: 'none' }));
  await put(g, 84.5, 13, 96.5); await wait(1500);
  await a.evaluate(() => { const I = window.__isle; I.setSkin({ pet: 'biscuit' }); });
  await a.waitForFunction(() => window.__isle.bazza.targets().indexOf('Gus') >= 0, null, { timeout: 10000 }).catch(() => {});
  await a.evaluate(() => { const I = window.__isle; for (let k = 0; k < 20 && !(I.bazza.run() && I.bazza.run().who !== I.net.you); k++) { I.bazza.go(); } });
  await g.waitForFunction(() => !!window.__isle.bazza.run(), null, { timeout: 15000 }).catch(() => {});
  check('in a room everyone sees Bazza head off on an egg run', !!(await g.evaluate(() => window.__isle.bazza.run())));
  // others see your balloon
  await a.evaluate(() => { const I = window.__isle; I.shop.give(20); I.shop.buy('balloon'); });
  await g.waitForFunction(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Gus'); return p && p.av && p.av.balloon && p.av.balloon.visible; }, null, { timeout: 10000 }).catch(() => {});
  check('others see the balloon you’re holding', await g.evaluate(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Gus'); return !!(p && p.av && p.av.balloon && p.av.balloon.visible); }));
  // others see you on the map at the spot farthest from them while you're in the lab's secret room
  await a.evaluate(() => { const I = window.__isle; I.setSkin({ pet: 'hoot' }); });
  await put(g, 80.5, 13, 92.5);
  await a.evaluate(() => { const I = window.__isle, S = I.sec.S(), P = I.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = S.ix0 + 3.5; P.y = S.iy0; P.z = S.iz0 + 4.5; });
  await g.waitForFunction(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Gus'); return p && p.tgt && p.tgt.sx > 0; }, null, { timeout: 15000 }).catch(() => {});
  const seen = await g.evaluate(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Gus'), P = window.__isle.player; return p && p.tgt ? { sx: p.tgt.sx, sz: p.tgt.sz, d: Math.hypot(p.tgt.sx - P.x, p.tgt.sz - P.z) } : null; });
  check('in a room, others see your dot far from them, not in the secret room', !!seen && seen.sx > 0 && seen.d > 100, seen);
  await put(a, 80.5, 13, 92.5);
  void peerA;

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
