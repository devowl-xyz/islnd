// The helicopter at North Shore: the helipad, flying it (owl owners only), staying put where it's left, the bridge,
// and in a room the rope that snatches people up, who then can't get away until they're let go.
// Run: node h/heli.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18290, URL = 'http://localhost:' + PORT + '/?layout=classic';
const GREY = 43, SNOW = 44, YELLOW = 35, LAMP = 11, PLANKS = 7, BRICK = 8;
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const open = async (name, ctx) => {
    const page = await (ctx || await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
    page.on('pageerror', (e) => { console.log((name || 'page') + ' pageerror', e.message); fails++; });
    await page.goto(URL);
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 240000 });
    if (name) await page.fill('#nName', name);
    return page;
  };
  const play = async (p) => { await p.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); }); await p.waitForFunction(() => document.getElementById('overlay').classList.contains('hidden'), null, { timeout: 10000 }).catch(() => {}); };
  const get = (p, x, y, z) => p.evaluate(([x, y, z]) => window.__isle.get(x, y, z), [x, y, z]);
  const toast = (p) => p.textContent('#toast');
  const H = (p) => p.evaluate(() => window.__isle.heli.state());
  const me = (p) => p.evaluate(() => { const P = window.__isle.player; return { x: P.x, y: P.y, z: P.z }; });
  const put = (p, x, y, z, yaw, fly) => p.evaluate(([x, y, z, yaw, fly]) => { const P = window.__isle.player; P.fly = !!fly; P.x = x; P.y = y; P.z = z; P.yaw = yaw || 0; P.vx = P.vy = P.vz = 0; }, [x, y, z, yaw, fly]);
  const pet = (p, id) => p.evaluate((id) => window.__isle.setSkin({ pet: id }), id);

  const ctxA = await browser.newContext({ viewport: { width: 900, height: 600 } });
  let a = await open(null, ctxA);
  await play(a); await wait(300);

  // the helipad and the helicopter parked on it
  const dock = await a.evaluate(() => { const d = window.__isle.docks[1]; return { x1: d.x1, z0: d.z0, z1: d.z1 }; });
  check('North Shore’s dock is built out east into a helipad', dock.x1 === 288 && (await get(a, 289, 11, 38)) !== 0 && (await get(a, 290, 11, 30)) === GREY && (await get(a, 289, 5, 28)) === 5);
  check('with a big white H, a yellow ring and lights at the corners', (await get(a, 295, 11, 34)) === SNOW && (await get(a, 298, 11, 33)) === SNOW && (await get(a, 289, 11, 28)) === LAMP && await a.evaluate(() => { let n = 0; for (let z = 28; z <= 41; z++) for (let x = 289; x <= 302; x++) if (window.__isle.get(x, 11, z) === 35) n++; return n > 20; }));
  check('the helicopter is parked on it', JSON.stringify(await a.evaluate(() => { const s = window.__isle.heli.state(); return [s.x, s.y, s.z, s.pilot]; })) === '[295.5,12,34.5,null]');
  check('the helipad is on the map', await a.evaluate(() => window.__isle.map.places().some((p) => p[0] === 'Helipad')));
  check('nobody can change the helipad', !(await a.evaluate(() => window.__isle.setBlock(292, 11, 32, 0))) && /helipad can’t be changed/.test(await toast(a)));

  // only owl owners fly it
  await put(a, 295.5, 12, 37.5, 0); await wait(500);
  check('walking up to it says who may fly it', /Only Hoot’s and Snowy’s owners can fly the helicopter/.test(await a.textContent('#jethint')));
  await a.keyboard.press('KeyE'); await wait(400);
  check('without an owl, E won’t let you fly it', !(await H(a)).seat && /Only Hoot’s and Snowy’s owners can fly the helicopter/.test(await toast(a)));
  await pet(a, 'hoot'); await wait(300);
  await put(a, 295.5, 12, 37.5, 0); await wait(500);
  check('with Hoot, the hint says E to fly it', /E<\/b> to fly the helicopter/.test(await a.evaluate(() => document.getElementById('jethint').innerHTML)));
  await a.keyboard.press('KeyE'); await wait(500);
  check('Hoot’s owner climbs in and flies it', (await H(a)).seat && /Flying the helicopter/.test(await a.textContent('#coords')));
  const y0 = (await H(a)).y;
  await a.keyboard.down('Space');
  await a.waitForFunction((y) => window.__isle.heli.state().y > y + 8, y0, { timeout: 30000 }).catch(() => {});
  await a.keyboard.up('Space');
  const up = await H(a);
  check('Space climbs', up.y > y0 + 8, up);
  const z0 = up.z;
  await a.keyboard.down('KeyW');
  await a.waitForFunction((z) => Math.abs(window.__isle.heli.state().z - z) > 6, z0, { timeout: 30000 }).catch(() => {});
  await a.keyboard.up('KeyW');
  const fw = await H(a);
  check('W flies it forward, the way it faces', Math.abs(fw.z - z0) > 6 && fw.z < z0, fw);
  const pm = await me(a);
  check('the pilot sits in the cockpit', Math.hypot(pm.x - fw.x, pm.z - fw.z) < 1.5 && pm.y > fw.y && pm.y < fw.y + 1.5);
  // leave it in mid-air: it stays put, and you drop out
  await a.keyboard.press('KeyE'); await wait(300);
  const left = await H(a);
  check('E gets you out', !left.seat && left.pilot === null && /stay right here/.test(await toast(a)));
  await wait(2500);
  const still = await H(a), fell = await me(a);
  check('left in mid-air, the helicopter stays exactly where it is', Math.hypot(still.x - left.x, still.y - left.y, still.z - left.z) < 0.01 && still.y > y0 + 8, { left, still });
  check('and you drop out of it', fell.y < left.y - 2, fell);
  // it's still there after a reload
  await a.close();
  a = await open(null, ctxA); await play(a); await wait(300);
  const back = await H(a);
  check('after a reload it’s still hanging in the sky where you left it', Math.hypot(back.x - left.x, back.y - left.y, back.z - left.z) < 0.01, back);

  // the bridge: a pathway from the door to the nearest building
  for (let y = 13; y <= 24; y++) for (let z = 86; z <= 95; z++) await a.evaluate(([y, z]) => window.__isle.setBlock(90, y, z, 8), [y, z]);
  await a.evaluate(() => { const I = window.__isle; I.setSkin({ pet: 'hoot' }); I.heli.put(80.5, 18.2, 90.5, -Math.PI / 2); const P = I.player; P.fly = true; P.x = 80.5; P.y = 19; P.z = 92; });
  await wait(400);
  check('boarding it in mid-air (flying up to it)', await a.evaluate(() => window.__isle.heli.board()) && (await H(a)).seat);
  await a.evaluate(() => { const P = window.__isle.player; P.yaw = Math.atan2(-Math.cos(-Math.PI / 2), -Math.sin(-Math.PI / 2)); P.yaw = 0; });
  await a.evaluate(() => window.__isle.heli.put(80.5, 18.2, 90.5, -Math.PI / 2));
  await a.keyboard.press('KeyK'); await wait(500);
  const br = await H(a);
  check('K puts out a bridge from the door', !!br.bridge && br.cells.length >= 10, br.cells.length);
  check('two planks wide, all the way to the building', (await get(a, 83, 18, 90)) === PLANKS && (await get(a, 89, 18, 90)) === PLANKS && br.end && /bridge slides out to the building/.test(await toast(a)), br);
  check('nobody can break the bridge', !(await a.evaluate(() => window.__isle.setBlock(85, 18, 90, 0))) && /helicopter’s bridge can’t be changed/.test(await toast(a)));
  check('the bridge isn’t saved as a build', await a.evaluate(() => { const s = JSON.parse(localStorage.getItem('voxel-isle-edits-v3') || '[]'); const i = (18 * 352 + 90) * 352 + 85; for (let k = 0; k < s.length; k += 2) if (s[k] === i) return false; return true; }));
  await a.keyboard.press('KeyE'); await wait(300);
  await put(a, 84.5, 19.2, 90.5, -Math.PI / 2); await wait(1500);
  const onb = await me(a);
  check('the pilot gets out and walks across the bridge in mid-air', Math.abs(onb.y - 19) < 0.05, onb);
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => window.__isle.player.x > 88, null, { timeout: 30000 }).catch(() => {});
  await a.keyboard.up('KeyW');
  check('right up to the building', (await me(a)).x > 88 && Math.abs((await me(a)).y - 19) < 0.05);
  await a.close();
  a = await open(null, ctxA); await play(a); await wait(500);
  check('the bridge is still out after a reload', (await get(a, 85, 18, 90)) === PLANKS);
  await a.evaluate(() => { const I = window.__isle, P = I.player; P.fly = true; P.x = 80.5; P.y = 19; P.z = 92; I.heli.board(); P.yaw = 0; });
  await a.keyboard.down('KeyS'); await wait(1500); await a.keyboard.up('KeyS');
  check('flying off folds the bridge away', !(await H(a)).bridge && (await get(a, 85, 18, 90)) === 0);
  await a.evaluate(() => window.__isle.heli.leave());

  // the rope picks up pets too: Clover, grazing in the open in its paddock (Biscuit waits under the arbour, out of the hook's reach)
  const hb = await a.evaluate(() => { const h = window.__isle.pets.home.horse; return { x: h.x, y: h.y, z: h.z }; });
  await a.evaluate((hb) => { const I = window.__isle, P = I.player; I.heli.put(hb.x, hb.y + 8, hb.z, 0); P.fly = true; P.x = hb.x; P.y = hb.y + 9; P.z = hb.z + 1; I.heli.board(); I.heli.put(hb.x, hb.y + 8, hb.z, 0); }, hb);
  await a.evaluate(() => { window.__isle.player.yaw = -Math.PI / 2; });
  await a.keyboard.press('KeyH');
  await a.waitForFunction(() => window.__isle.heli.state().pets.includes('horse'), null, { timeout: 30000 }).catch(() => {});
  check('the rope snatches up Clover from its paddock', (await H(a)).pets.includes('horse') && /Got Clover/.test(await toast(a)), await H(a));
  await wait(800);
  const bp = await a.evaluate(() => window.__isle.palace.petPos('horse')), bs = await H(a);
  check('Clover hangs from the hook', bp && bp.y < bs.y - 3 && Math.hypot(bp.x - bs.x, bp.z - bs.z) < 1.2, { bp, bs });
  await a.keyboard.press('KeyH');
  await a.waitForFunction(() => window.__isle.heli.state().rope < 1, null, { timeout: 30000 }).catch(() => {});
  await wait(600);
  const bc = await a.evaluate(() => window.__isle.palace.petPos('horse')), bh = await H(a);
  check('and is winched up into the cabin', bc && Math.abs(bc.y - (bh.y + 0.9)) < 0.3 && Math.hypot(bc.x - bh.x, bc.z - bh.z) < 2, { bc, bh });
  await a.evaluate(() => window.__isle.heli.put(120.5, 30, 100.5));
  await wait(600);
  const bf = await a.evaluate(() => window.__isle.palace.petPos('horse'));
  check('going wherever the helicopter goes', bf && Math.hypot(bf.x - 120.5, bf.z - 100.5) < 2 && bf.y > 29, bf);
  await a.evaluate(() => window.__isle.heli.leave());
  await a.close();
  a = await open(null, ctxA); await play(a); await wait(500);
  check('it’s still aboard after a reload', (await H(a)).pets.includes('horse'));
  await a.evaluate(() => { const I = window.__isle, P = I.player; P.fly = true; P.x = 120.5; P.y = 31; P.z = 102; I.heli.board(); });
  await a.keyboard.press('KeyJ'); await wait(500);
  const home = await a.evaluate(() => { const I = window.__isle, h = I.pets.home.horse, p = I.palace.petPos('horse'); return { h: { x: h.x, z: h.z }, p }; });
  check('J lets it go, and Clover goes back to its paddock', !(await H(a)).pets.includes('horse') && /Clover drops down and heads home/.test(await toast(a)) && home.p && Math.hypot(home.p.x - home.h.x, home.p.z - home.h.z) < 0.5, home);
  await a.evaluate(() => window.__isle.heli.leave());

  // rooms: the rope snatches people up
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => { window.__isle.heli.put(110.5, 22, 92.5, -Math.PI / 2); document.getElementById('nHost').click(); });
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 240000 });
  await play(g); await play(a);
  check('the guest sees the host’s helicopter where the host left it', Math.hypot((await H(g)).x - 110.5, (await H(g)).y - 22) < 0.01);
  await g.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'heliBoard' })));
  await g.waitForFunction(() => /Only Hoot’s and Snowy’s owners can fly the helicopter/.test(document.getElementById('toast').textContent), null, { timeout: 8000 }).catch(() => {});
  check('the room won’t let a guest without an owl fly it', (await H(a)).pilot === null && /Only Hoot’s and Snowy’s owners/.test(await toast(g)));
  const gid = await g.evaluate(() => window.__isle.net.you), aid = await a.evaluate(() => window.__isle.net.you);
  await g.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'heliGrab', peer: window.__isle.net.you })));
  await wait(600);
  check('and a guest can’t grab anyone', (await H(a)).captives.length === 0);
  // the guest has Mochi following them; the host flies over and lets the rope down
  await g.evaluate(() => window.__isle.setSkin({ pet: 'mochi' }));
  await a.waitForFunction(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.skin.pet === 'mochi') ok = true; }); return ok; }, null, { timeout: 8000 }).catch(() => {});
  await g.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'heliGrabPet', pet: 'goldie' })));
  await wait(800);
  check('the room only lets the pilot grab pets', !(await H(a)).pets.includes('goldie'));
  await put(g, 100.5, 13, 92.5, 0); await wait(2500);
  await a.evaluate(() => { const I = window.__isle, P = I.player; P.fly = true; P.x = 110.5; P.y = 22.5; P.z = 92.5; I.heli.board(); });
  await a.waitForFunction(() => window.__isle.heli.state().seat, null, { timeout: 8000 }).catch(() => {});
  check('the host (who has Hoot) flies it in the room', (await H(a)).seat && (await H(g)).pilot === aid);
  await a.evaluate(() => window.__isle.heli.put(100.5, 22, 92.5));
  await a.keyboard.press('KeyH');
  await g.waitForFunction((id) => window.__isle.heli.state().captives.includes(id), gid, { timeout: 30000 }).catch(() => {});
  check('the rope goes down and snatches up the guest, who gets no say', (await H(g)).captives.includes(gid) && /You’ve been kidnapped by|snatched up your Mochi/.test(await toast(g)), await H(g));
  check('the pilot hears they got them', /Got (Gus|Mochi)/.test(await toast(a)), await toast(a));
  await g.waitForFunction(() => window.__isle.heli.state().pets.includes('mochi'), null, { timeout: 20000 }).catch(() => {});
  check('Mochi, right beside them, is snatched up too', (await H(g)).pets.includes('mochi'), await H(g));
  check('but never the pilot’s own Hoot', !(await H(a)).pets.includes('hoot'));
  await wait(1200);
  const hang = await me(g), hs = await H(g);
  check('the guest hangs from the hook', hang.y < hs.y - 3 && Math.hypot(hang.x - hs.x, hang.z - hs.z) < 1.2 && /Kidnapped by/.test(await g.textContent('#coords')), { hang, hs });
  await a.waitForFunction((id) => { const p = window.__isle.net.peers.get(id); return p && p.tgt && p.tgt.kd === 1; }, gid, { timeout: 8000 }).catch(() => {});
  check('everyone sees them hanging', await a.evaluate((id) => { const p = window.__isle.net.peers.get(id); return !!p && !!p.tgt && p.tgt.kd === 1; }, gid));
  await g.keyboard.down('KeyW'); await wait(1200); await g.keyboard.up('KeyW');
  const tried = await me(g);
  check('they can’t walk away', Math.hypot(tried.x - hang.x, tried.z - hang.z) < 0.5, { hang, tried });
  await g.keyboard.press('KeyR'); await wait(300);
  check('or respawn', (await H(g)).captives.includes(gid) && /You can’t get away until you’re let go/.test(await toast(g)));
  await g.keyboard.press('KeyE'); await wait(300);
  check('or get off with E', (await H(g)).captives.includes(gid) && /kidnapped/.test(await toast(g)));
  await g.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'heliRelease' })));
  await wait(800);
  check('and the room won’t let them free themselves', (await H(a)).captives.includes(gid) && /Only the pilot or the host/.test(await toast(g)));
  // wind them up into the cabin and fly off with them
  await a.keyboard.press('KeyH');
  await g.waitForFunction(() => window.__isle.heli.state().rope < 1, null, { timeout: 30000 }).catch(() => {});
  await wait(800);
  const cab = await me(g), cs = await H(g);
  check('H winds them up into the cabin', Math.abs(cab.y - (cs.y + 0.85)) < 0.3 && Math.hypot(cab.x - cs.x, cab.z - cs.z) < 1.8, { cab, cs });
  await a.evaluate(() => window.__isle.heli.put(160.5, 30, 60.5));
  await g.waitForFunction(() => { const s = window.__isle.heli.state(); return Math.hypot(s.x - 160.5, s.z - 60.5) < 1; }, null, { timeout: 15000 }).catch(() => {});
  await wait(1000);
  const away = await me(g);
  check('and they’re carried away with the helicopter', Math.hypot(away.x - 160.5, away.z - 60.5) < 2.5 && away.y > 29, away);
  // the pilot leaves it in mid-air: they're still stuck aboard
  await a.keyboard.press('KeyE'); await wait(1500);
  check('the pilot gets out in mid-air, and the guest is still stuck aboard', (await H(g)).pilot === null && (await H(g)).captives.includes(gid) && (await me(g)).y > 29);
  // the host lets them go
  await a.evaluate(() => window.__isle.heli.release());
  await g.waitForFunction((id) => !window.__isle.heli.state().captives.includes(id), gid, { timeout: 8000 }).catch(() => {});
  check('the host lets them go', !(await H(g)).captives.includes(gid) && /You’ve been let go/.test(await toast(g)));
  check('and Mochi too', !(await H(g)).pets.includes('mochi') && !(await H(a)).pets.includes('mochi'));
  const y1 = (await me(g)).y;
  await g.waitForFunction((y) => window.__isle.player.y < y - 2, y1, { timeout: 20000 }).catch(() => {});
  check('and they drop out of the sky', (await me(g)).y < y1 - 2);

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
