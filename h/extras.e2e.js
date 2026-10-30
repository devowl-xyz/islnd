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
    if (name) await page.fill('#nName', name);
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
  await a.keyboard.press('Digit6'); await wait(200);
  check('and 6 gives a thumbs up', (await a.evaluate(() => window.__isle.react.fx())) > 0);

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
  await a.waitForFunction(() => window.__isle.silly.letter(), null, { timeout: 8000 }).catch(() => {});
  check('Bird Air writes to say sorry', await a.evaluate(() => window.__isle.silly.letter() && /BIRD AIR/.test(document.getElementById('letter').textContent) && /1st/.test(document.getElementById('letter').textContent)));
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
  await a.evaluate(() => window.__isle.setSkin({ pet: 'hoot' })); await wait(500);
  const bp = await a.evaluate(() => window.__isle.butler.pose());
  const hall = await a.evaluate(() => window.__isle.butler.hall());
  check('Pemberton keeps the treehouse hall', bp.x >= hall.x0 && bp.x <= hall.x1 + 1 && bp.z >= hall.z0 && bp.z <= hall.z1 + 1 && bp.y === hall.y0, [bp, hall]);
  const nearButler = () => a.evaluate(() => { const I = window.__isle, b = I.butler.pose(), P = I.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = b.x + 1; P.y = b.y; P.z = b.z; I.butler.ready(); });
  await nearButler(); await wait(400);
  check('he greets an owl owner who comes home', /Welcome home|kettle/.test((await a.evaluate(() => window.__isle.butler.said())) || ''), await a.evaluate(() => window.__isle.butler.said()));
  const served = [];
  let teaInHand = false;
  for (let k = 0; k < 4; k++) { await nearButler(); await a.keyboard.press('KeyE'); await wait(300); served.push(await a.evaluate(() => window.__isle.butler.said())); if (k === 0) teaInHand = await a.evaluate(() => window.__isle.butler.tea()); }
  check('E: a cup of tea, a snack for your owl, a polish and the news', /tea/i.test(served[0]) && /snack|Mice/i.test(served[1]) && /polish/i.test(served[2]) && /news/i.test(served[3]), served);
  check('and you’re holding the tea', teaInHand);
  const refused = await a.evaluate(() => { const I = window.__isle; I.setSkin({ pet: 'biscuit' }); const b = I.butler.pose(), P = I.player; P.x = b.x + 1; P.y = b.y; P.z = b.z; I.butler.ready(); I.butler.serve(); return I.butler.said(); });
  check('he politely refuses anyone else', /Terribly sorry/.test(refused || ''), refused);
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
  check('he tells anyone who isn’t his boss to rack off', /Rack off/.test((await a.evaluate(() => window.__isle.bazza.said())) || ''), await a.evaluate(() => window.__isle.bazza.said()));
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
  await put(a, 80.5, 13, 92.5); await put(g, 82.5, 13, 92.5);
  const peerA = () => g.evaluate(() => [...window.__isle.net.peers.values()].find((q) => q.name !== 'Gus'));
  await g.waitForFunction(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Gus'); return p && p.av; }, null, { timeout: 15000 }).catch(() => {});
  // accessories travel with the skin
  await a.evaluate(() => window.__isle.setSkin({ petCollarStyle: 'bandana', petCollar: '#56b04a' }));
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
  void peerA;

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
