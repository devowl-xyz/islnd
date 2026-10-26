// End-to-end room test: starts the server and drives three real browser pages.
// Run: node h/rooms.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const path = require('path');
const { server } = require('../server.js');

const PORT = 18080, URL = 'http://localhost:' + PORT + '/?layout=classic';
let fails = 0;
function check(name, ok) { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fails++; }
const idx = (x, y, z) => (y * 160 + z) * 160 + x;

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const open = async (name, seed) => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { console.log(name + ' pageerror', e.message); fails++; });
    if (seed) await page.addInitScript((s) => localStorage.setItem('voxel-isle-edits-v1', s), JSON.stringify(seed));
    await page.goto(URL);
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
    await page.fill('#nName', name);
    return page;
  };
  const ready = (p) => p.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  const cell = (p, x, y, z) => p.evaluate(([x, y, z]) => window.__isle.get(x, y, z), [x, y, z]);
  const set = (p, x, y, z, b) => p.evaluate(([x, y, z, b]) => window.__isle.setBlock(x, y, z, b), [x, y, z, b]);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Host already has a tower off the field (at 40,30,40) saved from single player.
  const host = await open('Hana', [idx(40, 30, 40), 8]);
  check('net panel visible', await host.isVisible('#nHost'));
  await host.click('#nHost');
  await host.waitForFunction(() => window.__isle.net.code);
  const code = await host.textContent('#nRoomCode');
  check('room code is 5 chars: ' + code, /^[A-Z0-9]{5}$/.test(code));

  const guest = await open('Gus');
  await guest.fill('#nCode', code.toLowerCase());
  await guest.click('#nJoin');
  await guest.waitForFunction(() => window.__isle.net.code);
  await ready(guest);
  check('joiner got host snapshot (brick at 40,30,40)', (await cell(guest, 40, 30, 40)) === 8);
  check('host sees guest in list', (await host.textContent('#nPeers')).includes('Gus'));

  // Field edit by guest reaches host.
  await set(guest, 80, 13, 92, 8);
  await wait(300);
  check('guest field edit reaches host', (await cell(host, 80, 13, 92)) === 8);

  // Off-field edit is blocked locally.
  check('guest off-field edit blocked locally', (await set(guest, 40, 31, 40, 7)) === false);
  // A cheating client that skips the local check is rejected by the server.
  await guest.evaluate(() => { const n = window.__isle.net; n.ws.send(JSON.stringify({ t: 'edit', x: 40, y: 31, z: 40, b: 7 })); });
  await wait(300);
  check('server rejects off-field edit from builder', (await cell(host, 40, 31, 40)) === 0);
  // Nobody can break the meadow floor, not even the host or a client that skips the check.
  check('host cannot break the meadow floor', (await set(host, 80, 12, 94, 0)) === false);
  await guest.evaluate(() => { window.__isle.net.ws.send(JSON.stringify({ t: 'edit', x: 81, y: 12, z: 94, b: 0 })); });
  await host.evaluate(() => { window.__isle.net.ws.send(JSON.stringify({ t: 'edit', x: 82, y: 12, z: 94, b: 0 })); });
  await wait(300);
  check('server rejects floor edits from anyone', (await cell(host, 81, 12, 94)) === 1 && (await cell(guest, 82, 12, 94)) === 1);
  check('host can still mine under the floor', (await set(host, 80, 11, 94, 0)) === true);
  await wait(300);
  check('mining under the floor reaches others', (await cell(guest, 80, 11, 94)) === 0);

  // A fake role message from a non-host is ignored.
  await guest.evaluate(() => { const n = window.__isle.net; n.ws.send(JSON.stringify({ t: 'role', peer: n.you, admin: true })); });
  await wait(200);
  check('non-host cannot grant admin', (await guest.evaluate(() => window.__isle.net.admin)) === false);

  // Host grants admin.
  await host.click('#nPeers button');
  await guest.waitForFunction(() => window.__isle.net.admin);
  check('guest became admin', true);
  check('admin off-field edit allowed', (await set(guest, 40, 31, 40, 7)) === true);
  await wait(300);
  check('admin off-field edit reaches host', (await cell(host, 40, 31, 40)) === 7);
  check('button now says Remove admin', (await host.textContent('#nPeers button')) === 'Remove admin');
  await host.click('#nPeers button');
  await guest.waitForFunction(() => !window.__isle.net.admin);
  check('admin revoked, off-field blocked again', (await set(guest, 41, 31, 40, 7)) === false);

  // Host can edit anywhere.
  await set(host, 20, 30, 120, 3);
  await wait(300);
  check('host off-field edit reaches guest', (await cell(guest, 20, 30, 120)) === 3);

  // Late joiner gets everything so far.
  const late = await open('Lia');
  await late.fill('#nCode', code);
  await late.click('#nJoin');
  await late.waitForFunction(() => window.__isle.net.code);
  await ready(late);
  check('late joiner sees all edits', (await cell(late, 80, 13, 92)) === 8 && (await cell(late, 40, 31, 40)) === 7 && (await cell(late, 20, 30, 120)) === 3);

  // Skins: a change shows up for others, late joiners get it, junk is dropped.
  await guest.evaluate(() => window.__isle.setSkin({ shirt: '#123456', hatStyle: 'crown', hairStyle: 'long' }));
  await host.waitForFunction(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.name === 'Gus' && p.skin.shirt === '#123456') ok = true; }); return ok; }, null, { timeout: 5000 }).catch(() => {});
  const gSkin = await host.evaluate(() => { let k = null; window.__isle.net.peers.forEach((p) => { if (p.name === 'Gus') k = p.skin; }); return k; });
  check('host sees guest skin change', gSkin && gSkin.shirt === '#123456' && gSkin.hatStyle === 'crown' && gSkin.hairStyle === 'long');
  const lSkin = await late.evaluate(() => { let k = null; window.__isle.net.peers.forEach((p) => { if (p.name === 'Gus') k = p.skin; }); return k; });
  check('late joiner sees guest skin', lSkin && lSkin.shirt === '#123456');
  await guest.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'skin', skin: { shirt: 'red;x', hatStyle: 'rocket', face: 'smile' } })));
  await wait(400);
  const bad = await host.evaluate(() => { let k = null; window.__isle.net.peers.forEach((p) => { if (p.name === 'Gus') k = p.skin; }); return k; });
  check('malformed skin parts are dropped', bad && /^#[0-9a-f]{6}$/.test(bad.shirt) && bad.hatStyle === 'none' && bad.face === 'smile');
  // Rod creatures: painted head, rods and effect reach others; broken heads are dropped.
  const px = 'f'.repeat(128) + '3'.repeat(128);
  await guest.evaluate((px) => window.__isle.setSkin({ kind: 'rod', rodStyle: 'tendrils', effect: 'bubbles', rod: '#173640', headPx: px }), px);
  await host.waitForFunction((px) => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.name === 'Gus' && p.skin.headPx === px) ok = true; }); return ok; }, px, { timeout: 5000 }).catch(() => {});
  const rSkin = await host.evaluate(() => { let k = null; window.__isle.net.peers.forEach((p) => { if (p.name === 'Gus') k = p.skin; }); return k; });
  check('host sees guest rod creature', rSkin && rSkin.kind === 'rod' && rSkin.rodStyle === 'tendrils' && rSkin.effect === 'bubbles' && rSkin.headPx === px && rSkin.headPal.length === 16);
  await wait(300);
  await guest.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'skin', skin: { kind: 'rod', headPx: 'zz', headPal: ['red'], rodStyle: 'spikes' } })));
  await wait(400);
  const bad2 = await host.evaluate(() => { let k = null; window.__isle.net.peers.forEach((p) => { if (p.name === 'Gus') k = p.skin; }); return k; });
  check('broken painted head is dropped', bad2 && bad2.kind === 'rod' && /^[0-9a-f]{256}$/.test(bad2.headPx) && bad2.rodStyle === 'pillars');
  await guest.evaluate(() => window.__isle.setSkin({ kind: 'person' }));
  await wait(400);

  check('skin saved in browser', (await guest.evaluate(() => JSON.parse(localStorage.getItem('voxel-isle-skin')).shirt)) === '#123456');

  // Avatars: positions flow at ~10 Hz.
  await guest.evaluate(() => { const P = window.__isle.player; P.x = 85.5; P.z = 90.5; });
  await host.waitForFunction(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.tgt && p.tgt.x === 85.5) ok = true; }); return ok; }, null, { timeout: 8000 }).catch(() => {});
  const seen = await host.evaluate(() => { const a = []; window.__isle.net.peers.forEach((p) => a.push(p.tgt && p.tgt.x)); return a; });
  check('host receives guest position', seen.includes(85.5));
  await host.evaluate(() => { const P = window.__isle.player; P.x = 82.5; P.z = 100.5; P.yaw = 0; P.pitch = 0; });
  await wait(800);
  await guest.click('#play');
  await wait(1200);
  await guest.screenshot({ path: path.join(process.env.SHOTS || __dirname, 'guest-view.png') });

  // Guest leaves: their own island comes back, host's list updates.
  await guest.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })));
  await guest.keyboard.press('Escape');
  await wait(300);
  await guest.evaluate(() => document.getElementById('nLeave').click());
  await ready(guest);
  check('guest back on own island after leaving', (await cell(guest, 40, 30, 40)) === 0 && (await cell(guest, 80, 13, 92)) !== 8);
  await wait(300);
  check('host list drops guest', !(await host.textContent('#nPeers')).includes('Gus'));

  // Host leaves: room closes for others, host keeps the builds.
  await host.click('#nLeave');
  await late.waitForFunction(() => !window.__isle.net.code);
  check('room closed for late joiner', true);
  await wait(1800);
  const saved = await host.evaluate(() => JSON.parse(localStorage.getItem('voxel-isle-edits-v3') || '[]'));
  check('host island kept room builds', saved.includes((13 * 352 + 92) * 352 + 80));
  check('bad code shows error', await (async () => {
    await ready(late);
    await late.fill('#nCode', 'ZZZZZ'); await late.click('#nJoin');
    await late.waitForFunction(() => /No room/.test(document.getElementById('nMsg').textContent));
    return true;
  })());

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
