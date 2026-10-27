// The Sky Palace: Hoot and Snowy's floating palace, the cloud ride up and down, and invites. Real Chromium pages.
// Run: node h/palace.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18250, URL = 'http://localhost:' + PORT + '/?layout=classic';
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const open = async (name, ctx) => {
    const page = await (ctx || await browser.newContext({ viewport: { width: 900, height: 700 } })).newPage();
    page.on('pageerror', (e) => { console.log((name || 'page') + ' pageerror', e.message); fails++; });
    await page.goto(URL);
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
    if (name) await page.fill('#nName', name);
    return page;
  };
  const play = async (p) => { await p.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); }); await p.waitForFunction(() => document.getElementById('overlay').classList.contains('hidden'), null, { timeout: 10000 }).catch(() => {}); };
  const pause = async (p) => { await p.evaluate(() => { if (document.pointerLockElement) document.exitPointerLock(); }); await wait(200); if (await p.evaluate(() => document.getElementById('overlay').classList.contains('hidden'))) await p.keyboard.press('Escape'); await p.waitForFunction(() => !document.getElementById('overlay').classList.contains('hidden'), null, { timeout: 5000 }).catch(() => {}); };
  const toast = (p) => p.textContent('#toast');
  const put = (p, x, y, z, yaw) => p.evaluate(([x, y, z, yaw]) => { const P = window.__isle.player; P.fly = false; P.x = x; P.y = y; P.z = z; P.yaw = yaw || 0; P.vx = P.vy = P.vz = 0; }, [x, y, z, yaw]);
  const inZone = (p) => p.evaluate(() => window.__isle.palace.inZone());
  const rideDone = (p) => p.waitForFunction(() => !window.__isle.palace.riding(), null, { timeout: 30000 }).catch(() => {});

  const ctxA = await browser.newContext({ viewport: { width: 900, height: 700 } });
  let a = await open(null, ctxA);
  await play(a); await wait(300);
  const C = await a.evaluate(() => window.__isle.palace.PAL);
  const get = (p, x, y, z) => p.evaluate(([x, y, z]) => window.__isle.get(x, y, z), [x, y, z]);

  // The palace itself
  check('a marble plaza floats high in the sky', (await get(a, C.cx + 3, C.FY - 1, C.cz + 8)) === 24 && (await get(a, C.cx, C.FY - 13, C.cz)) === 0);
  check('with clouds round it and rock and crystal underneath', await a.evaluate((C) => { let w = 0, c = 0; for (let x = C.x0; x <= C.x1; x++) for (let z = C.z0; z <= C.z1; z++) for (let y = C.y0; y < C.FY - 1; y++) { const b = window.__isle.get(x, y, z); if (b === 44) w++; if (b === 21) c++; } return w > 40 && c > 0; }, C));
  check('a hall with a gold band, a stepped roof and a lamp on top', (await get(a, C.cx - 6, C.FY + 5, C.cz)) === 25 && (await get(a, C.cx, C.FY + 12, C.cz)) === 11 && (await get(a, C.cx, C.FY + 6, C.cz)) === 24);
  check('four towers', (await get(a, C.cx + 7, C.FY + 9, C.cz + 7)) === 25 && (await get(a, C.cx - 7, C.FY + 10, C.cz - 7)) === 11);
  check('an open door to the south', (await get(a, C.cx, C.FY + 1, C.cz + 6)) === 0 && (await get(a, C.cx, C.FY + 4, C.cz + 6)) === 25);
  check('Hoot’s and Snowy’s thrones and a fountain inside', (await get(a, C.cx - 2, C.FY + 2, C.cz - 5)) === 25 && (await get(a, C.cx + 2, C.FY, C.cz - 4)) === 39 && (await get(a, C.cx + 1, C.FY - 1, C.cz)) === 12);
  check('a cloud landing pad by the door', (await get(a, C.cx, C.FY - 1, C.cz + 9)) === 37);
  check('it is on the map', await a.evaluate(() => window.__isle.map.places().some((p) => p[0] === 'Sky Palace')));
  check('nobody can change the palace itself', !(await a.evaluate((C) => window.__isle.setBlock(C.cx - 6, C.FY + 1, C.cz, 0), C)) && /Sky Palace can’t be changed/.test(await toast(a)));
  check('and without an owl you can’t decorate the hall', !(await a.evaluate((C) => window.__isle.setBlock(C.cx - 3, C.FY, C.cz + 3, 8), C)) && /Only owl owners can decorate the Sky Palace/.test(await toast(a)));

  // Without an owl, you can't go up
  await a.keyboard.press('KeyP'); await wait(300);
  check('P without an owl or an invite says who may go up', !(await a.evaluate(() => window.__isle.palace.riding())) && /Only Hoot’s and Snowy’s owners/.test(await toast(a)));
  const pad = await a.evaluate(() => window.__isle.palace.pad());
  await put(a, pad.x, pad.y, pad.z + 3, 0); await wait(500);
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => /Ask an owl owner to invite you/.test(document.getElementById('toast').textContent), null, { timeout: 10000 }).catch(() => {});
  await a.keyboard.up('KeyW');
  check('the cloud by the treehouse stairs won’t carry you either', !(await a.evaluate(() => window.__isle.palace.riding())) && /Ask an owl owner to invite you/.test(await toast(a)));
  // flying in is blocked by the palace's invisible walls
  await a.evaluate((C) => { const P = window.__isle.player; P.fly = true; P.x = C.cx + 0.5; P.y = C.FY + 2; P.z = C.z1 + 4; P.yaw = 0; P.vx = P.vy = P.vz = 0; }, C);
  await a.keyboard.down('KeyW'); await wait(2500); await a.keyboard.up('KeyW');
  check('and you can’t fly in', !(await inZone(a)) && /guests they invite can go into the Sky Palace/.test(await toast(a)));
  // someone left inside without leave is carried down
  await put(a, C.cx + 0.5, C.FY, C.cz + 3.5);
  await a.waitForFunction(() => window.__isle.palace.riding(), null, { timeout: 5000 }).catch(() => {});
  check('a stranger who ends up inside is carried down', !!(await a.evaluate(() => window.__isle.palace.riding())));
  await a.evaluate(() => window.__isle.palace.rush()); await rideDone(a);
  check('to the foot of the treehouse', !(await inZone(a)) && (await a.evaluate((p) => Math.hypot(window.__isle.player.x - p.x, window.__isle.player.z - p.z) < 4, pad)));
  await a.evaluate(() => { window.__isle.player.fly = false; });

  // Hoot's owner
  await a.evaluate(() => { const I = window.__isle, h = I.pets.home.hoot, P = I.player; P.x = h.x; P.y = h.y - 1; P.z = h.z; I.pets.adopt('hoot'); });
  await put(a, pad.x, pad.y, pad.z + 3, 0); await wait(600);
  await a.keyboard.down('KeyW');
  await a.waitForFunction(() => window.__isle.palace.riding(), null, { timeout: 15000 }).catch(() => {});
  await a.keyboard.up('KeyW');
  check('an owl owner steps on the cloud and floats up', !!(await a.evaluate(() => { const r = window.__isle.palace.riding(); return r && r.up; })) && /carries you up/.test(await toast(a)));
  await a.waitForFunction(() => window.__isle.player.y > 25, null, { timeout: 15000 }).catch(() => {});
  check('riding a cloud through the sky', (await a.evaluate(() => window.__isle.player.y)) > 25 && /Floating up/.test(await a.textContent('#coords')));
  await rideDone(a);
  const at = await a.evaluate(() => { const P = window.__isle.player; return { x: P.x, y: P.y, z: P.z }; });
  check('and lands at the palace door', (await inZone(a)) && Math.abs(at.y - C.FY) < 0.01 && Math.abs(at.z - (C.cz + 7.5)) < 0.01, at);
  await a.waitForFunction(() => /Welcome to your Sky Palace/.test(document.getElementById('toast').textContent), null, { timeout: 5000 }).catch(() => {});
  check('welcomed home', /Welcome to your Sky Palace/.test(await toast(a)));
  await put(a, C.cx + 0.5, C.FY, C.cz + 3.5);
  await a.waitForFunction(() => { const I = window.__isle, f = I.pets.follower(), q = I.palace.perch.hoot; return f && Math.hypot(f.x - q.x, f.y - q.y, f.z - q.z) < 0.6; }, null, { timeout: 15000 }).catch(() => {});
  check('Hoot perches on its throne', await a.evaluate(() => { const I = window.__isle, f = I.pets.follower(), q = I.palace.perch.hoot; return f && Math.hypot(f.x - q.x, f.y - q.y, f.z - q.z) < 0.6; }));
  check('the owner can decorate the hall', await a.evaluate((C) => window.__isle.setBlock(C.cx - 3, C.FY, C.cz + 3, 8), C));
  check('but not the walls', !(await a.evaluate((C) => window.__isle.setBlock(C.cx + 6, C.FY + 1, C.cz + 1, 0), C)));

  // pets: one click to invite, one to send home
  await pause(a);
  check('the pause card has a Sky Palace list', /Invite players and pets up/.test(await a.textContent('#palHint')));
  await a.click('#palList [data-pal="biscuit"] button');
  await wait(300);
  check('one click invites Biscuit up', (await a.evaluate(() => window.__isle.palace.state().pets)).includes('biscuit') && /Biscuit floats up/.test(await toast(a)));
  check('and the button now sends Biscuit home', (await a.textContent('#palList [data-pal="biscuit"] button')) === 'Send home');
  await a.click('#palList [data-pal="goldie"] button');
  await play(a); await wait(800);
  const homeAt = (p, id) => p.evaluate((id) => window.__isle.palace.petPos(id), id);
  const bp = await homeAt(a, 'biscuit'), sp = (await a.evaluate(() => window.__isle.palace.spot.biscuit));
  check('Biscuit sits on its cushion in the palace', bp && Math.hypot(bp.x - sp.x, bp.y - sp.y, bp.z - sp.z) < 0.2, { bp, sp });
  const gp = await homeAt(a, 'goldie');
  check('Goldie swims in the fountain', gp && Math.hypot(gp.x - (C.cx + 0.5), gp.z - (C.cz + 0.5)) < 1.3 && Math.abs(gp.y - (C.FY - 0.55)) < 0.2, gp);
  check('Biscuit’s hint says where it is', /Visiting the Sky Palace/.test(await a.evaluate(() => { const r = [...document.querySelectorAll('#petList .petrow')].find((e) => /Biscuit/.test(e.textContent)); return r ? r.textContent : ''; })));
  // kept after a reload
  await a.close();
  a = await open(null, ctxA); await play(a); await wait(300);
  check('visiting pets stay after a reload', (await a.evaluate(() => window.__isle.palace.state().pets)).join() === 'biscuit,goldie');
  await a.evaluate(() => { const I = window.__isle, h = I.pets.home.hoot, P = I.player; P.x = h.x; P.y = h.y - 1; P.z = h.z; I.pets.adopt('hoot'); });
  await a.evaluate(() => window.__isle.palace.act('kickPet', 'biscuit'));
  await wait(300);
  const bh = await homeAt(a, 'biscuit'), hb = await a.evaluate(() => window.__isle.pets.home.biscuit);
  check('sending Biscuit home puts it back at the cottage', Math.hypot(bh.x - hb.x, bh.z - hb.z) < 0.2);

  // P inside floats you down
  await put(a, C.cx + 0.5, C.FY, C.cz + 3.5); await wait(400);
  await a.keyboard.press('KeyP'); await wait(200);
  check('P in the palace floats you down', !!(await a.evaluate(() => { const r = window.__isle.palace.riding(); return r && !r.up; })));
  await a.evaluate(() => window.__isle.palace.rush()); await rideDone(a);
  check('to the treehouse', !(await inZone(a)) && (await a.evaluate((p) => Math.hypot(window.__isle.player.x - p.x, window.__isle.player.z - p.z) < 4, pad)));
  await wait(400);
  await a.keyboard.press('KeyP'); await wait(200);
  check('and P outside floats an owl owner up from anywhere', !!(await a.evaluate(() => { const r = window.__isle.palace.riding(); return r && r.up; })));
  await a.evaluate(() => window.__isle.palace.rush()); await rideDone(a);

  // Rooms: invite a guest with one click, kick them out with one click
  await pause(a);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  check('the host’s visiting pets come to the room', (await a.evaluate(() => window.__isle.palace.state().pets)).join() === 'goldie');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  check('the guest sees Goldie in the fountain', (await g.evaluate(() => window.__isle.palace.state().pets)).join() === 'goldie');
  await play(g); await wait(500);
  await put(g, pad.x, pad.y, pad.z + 3);
  await g.keyboard.press('KeyP'); await wait(300);
  check('a guest who isn’t invited can’t go up', !(await g.evaluate(() => window.__isle.palace.riding())));
  // cheating: a guest can't invite themselves
  await g.evaluate(() => { const n = window.__isle.net; n.ws.send(JSON.stringify({ t: 'palace', act: 'invite', peer: n.you })); });
  await wait(600);
  check('the server ignores a guest inviting themselves', !(await g.evaluate(() => window.__isle.palace.may())));
  const gid = await g.evaluate(() => window.__isle.net.you);
  await a.waitForFunction((id) => !!document.querySelector('#palList [data-pal="p' + id + '"] button'), gid, { timeout: 10000 }).catch(() => {});
  check('the host’s list shows Gus with an Invite button', (await a.textContent('#palList [data-pal="p' + gid + '"]')).includes('Not invited') && (await a.textContent('#palList [data-pal="p' + gid + '"] button')) === 'Invite');
  await a.click('#palList [data-pal="p' + gid + '"] button');
  await g.waitForFunction(() => window.__isle.palace.may(), null, { timeout: 8000 }).catch(() => {});
  check('one click invites Gus', await g.evaluate(() => window.__isle.palace.may()));
  check('and Gus is told how to come up', /invited you to the Sky Palace/.test(await toast(g)));
  await a.waitForFunction((id) => document.querySelector('#palList [data-pal="p' + id + '"] button').textContent === 'Kick out', gid, { timeout: 5000 }).catch(() => {});
  check('the host’s button turns into Kick out', (await a.textContent('#palList [data-pal="p' + gid + '"] button')) === 'Kick out');
  await g.keyboard.press('KeyP');
  await g.waitForFunction(() => window.__isle.palace.riding(), null, { timeout: 5000 }).catch(() => {});
  await a.waitForFunction(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.tgt && p.tgt.cl) ok = true; }); return ok; }, null, { timeout: 8000 }).catch(() => {});
  check('others see the guest riding a cloud', await a.evaluate(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.tgt && p.tgt.cl && p.cloudFx && p.cloudFx.visible) ok = true; }); return ok; }));
  await g.evaluate(() => window.__isle.palace.rush()); await rideDone(g);
  check('the invited guest floats up into the palace', await inZone(g));
  await put(g, C.cx + 0.5, C.FY, C.cz + 2.5);
  check('but a guest can’t decorate the hall', !(await g.evaluate((C) => window.__isle.setBlock(C.cx + 3, C.FY, C.cz + 3, 8), C)));
  await g.evaluate((C) => { const n = window.__isle.net; n.ws.send(JSON.stringify({ t: 'edit', x: C.cx + 3, y: C.FY, z: C.cz + 3, b: 8 })); }, C);
  await wait(600);
  check('and the server refuses it too', (await get(a, C.cx + 3, C.FY, C.cz + 3)) === 0);
  await a.click('#palList [data-pal="p' + gid + '"] button');
  await g.waitForFunction(() => !window.__isle.palace.may(), null, { timeout: 8000 }).catch(() => {});
  check('one click kicks Gus out', !(await g.evaluate(() => window.__isle.palace.may())) && /sent you down from the Sky Palace/.test(await toast(g)), [await g.evaluate(() => window.__isle.palace.state()), await toast(g)]);
  await g.waitForFunction(() => window.__isle.palace.riding(), null, { timeout: 15000 }).catch(() => {});
  check('and a cloud carries Gus down', !!(await g.evaluate(() => { const r = window.__isle.palace.riding(); return r && !r.up; })), await g.evaluate(() => { const P = window.__isle.player; return [P.x, P.y, P.z, window.__isle.palace.inZone(), window.__isle.palace.riding(), document.getElementById('overlay').className]; }));
  await g.evaluate(() => window.__isle.palace.rush()); await rideDone(g);
  check('out of the palace', !(await inZone(g)));
  // pets in a room, and kicking everyone out
  await a.click('#palList [data-pal="mochi"] button');
  await g.waitForFunction(() => window.__isle.palace.state().pets.includes('mochi'), null, { timeout: 8000 }).catch(() => {});
  check('the host invites Mochi and the guest sees it', (await g.evaluate(() => window.__isle.palace.state().pets)).includes('mochi'));
  await a.click('#palList [data-pal="p' + gid + '"] button');
  await g.waitForFunction(() => window.__isle.palace.may(), null, { timeout: 8000 }).catch(() => {});
  await a.waitForFunction(() => [...document.querySelectorAll('#palList > button')].some((b) => b.textContent === 'Kick everyone out'), null, { timeout: 5000 }).catch(() => {});
  await a.evaluate(() => [...document.querySelectorAll('#palList > button')].find((b) => b.textContent === 'Kick everyone out').click());
  await g.waitForFunction(() => !window.__isle.palace.may() && !window.__isle.palace.state().pets.length, null, { timeout: 8000 }).catch(() => {});
  check('Kick everyone out sends every guest and pet home', !(await g.evaluate(() => window.__isle.palace.may())) && (await g.evaluate(() => window.__isle.palace.state().pets.length)) === 0);
  // adopting Snowy makes the guest an owl owner, who is always welcome
  await g.evaluate(() => { const I = window.__isle, h = I.pets.home.snowy, P = I.player; P.x = h.x; P.y = h.y - 1; P.z = h.z; I.pets.adopt('snowy'); });
  await a.waitForFunction((id) => /Owl owner/.test((document.querySelector('#palList [data-pal="p' + id + '"]') || {}).textContent || ''), gid, { timeout: 8000 }).catch(() => {});
  check('an owl owner guest can always go up, and has no kick button', (await g.evaluate(() => window.__isle.palace.may())) && !(await a.$('#palList [data-pal="p' + gid + '"] button')));
  check('and can invite pets too', await g.evaluate(() => window.__isle.palace.act('invitePet', 'horse')));
  await a.waitForFunction(() => window.__isle.palace.state().pets.includes('horse'), null, { timeout: 8000 }).catch(() => {});
  check('the host sees Clover invited', (await a.evaluate(() => window.__isle.palace.state().pets)).includes('horse'));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
