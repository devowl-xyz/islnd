// Pets test in real Chromium pages: homes, adopting, one at a time, following, rooms.
// Run: node h/pets.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18110, URL = 'http://localhost:' + PORT + '/?layout=classic';
const B = { LEAVES: 6, WHITE: 10, BASALT: 17, WATER: 12 };
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
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
    if (name) await page.fill('#nName', name);
    return page;
  };
  const play = (p) => p.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); });
  // stand beside a pet's home and press E
  const goTo = (p, id) => p.evaluate((id) => { const I = window.__isle, h = I.pets.home[id], P = I.player; P.fly = true; P.x = h.x + 0.8; P.y = h.y - 0.6; P.z = h.z; P.vx = P.vy = P.vz = 0; }, id);
  const pet = (p) => p.evaluate(() => window.__isle.mySkin.pet);

  const ctxA = await browser.newContext({ viewport: { width: 900, height: 600 } });
  const a = await open(null, ctxA);
  const H = await a.evaluate(() => window.__isle.pets.home);
  check('all six pets have a home', ['hoot', 'snowy', 'goldie', 'biscuit', 'mochi', 'cinder'].every((k) => H[k]), Object.keys(H));
  const owlGap = Math.hypot(H.hoot.x - H.snowy.x, H.hoot.z - H.snowy.z);
  check('the two owls sit side by side on the treehouse', owlGap === 2, owlGap);
  const owlPerch = await a.evaluate((H) => [H.hoot, H.snowy].map((h) => window.__isle.get(Math.floor(h.x), h.y - 1, Math.floor(h.z))), H);
  check('both owls perch on the treehouse roof', owlPerch.every((b) => b === 8), owlPerch);
  check('the fish swims in the sea', await a.evaluate((h) => window.__isle.get(Math.floor(h.x), Math.floor(h.y), Math.floor(h.z)) === 12, H.goldie));
  const cush = await a.evaluate((H) => [H.biscuit, H.mochi].map((h) => window.__isle.get(Math.floor(h.x), h.y - 1, Math.floor(h.z))), H);
  check('puppy and kitten sit on cushions by their cottage gate', cush.every((b) => b === B.WHITE), cush);
  const roof = await a.evaluate((h) => { const I = window.__isle; for (let y = h.y; y < h.y + 5; y++) if (I.get(Math.floor(h.x), y, Math.floor(h.z)) !== 0) return y - h.y; return -1; }, H.biscuit);
  check('the arbour gives them a roof', roof >= 2, roof);
  const far = Math.hypot(H.biscuit.x - 80, H.biscuit.z - 92);
  check('their cottage is well away from the meadow', far > 35, far);
  const lair = await a.evaluate((h) => {
    const I = window.__isle, x = Math.floor(h.x), z = Math.floor(h.z);
    let roofY = -1; for (let y = h.y; y < 20; y++) if (I.get(x, y, z) !== 0) { roofY = y; break; }
    let top = 0; for (let y = 47; y >= 0; y--) if (I.get(x, y, z) !== 0) { top = y; break; }
    let wet = false; for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) for (let y = 2; y <= 7; y++) if (I.get(x + dx, y, z + dz) === 0) { for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) if (I.get(x + dx + d[0], y + (d[0] || d[1] ? 0 : 1), z + dz + d[1]) === 12) wet = true; }
    let ring = 0; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, rx = Math.round(x + Math.cos(a) * 2.2), rz = Math.round(z + Math.sin(a) * 2.2); for (let y = 47; y >= 0; y--) { const b = I.get(rx, y, rz); if (b !== 0 && b !== 12) { if (b === 17) ring++; break; } } }
    return { air: I.get(x, h.y, z) === 0, roofY, top, wet, ring };
  }, H.cinder);
  check('the dragon sleeps in a sealed cave under the beach', lair.air && lair.roofY > 0 && lair.top - lair.roofY >= 2 && !lair.wet, lair);
  check('a ring of dark stones marks the spot', lair.ring >= 8, lair.ring);

  await play(a); await wait(900);
  await goTo(a, 'biscuit');
  await a.waitForFunction(() => /Biscuit/.test(document.getElementById('jethint').textContent), null, { timeout: 8000 }).catch(() => {});
  check('standing by the puppy offers to adopt it', await a.evaluate(() => window.__isle.pets.near() === 'biscuit') && /Biscuit/.test(await a.textContent('#jethint')));
  await a.keyboard.press('KeyE'); await wait(400);
  check('pressing E adopts the puppy', (await pet(a)) === 'biscuit');
  check('the puppy leaves its cushion', !(await a.evaluate(() => window.__isle.pets.homeVisible('biscuit'))));
  // walk off and see it follow
  await a.evaluate(() => { const P = window.__isle.player; P.x -= 10; P.z += 4; });
  await a.waitForFunction(() => { const I = window.__isle, f = I.pets.follower(), P = I.player; return f && Math.hypot(f.x - P.x, f.z - P.z) < 3; }, null, { timeout: 15000 }).catch(() => {});
  const fd = await a.evaluate(() => { const I = window.__isle, f = I.pets.follower(), P = I.player; return f ? Math.hypot(f.x - P.x, f.z - P.z) : 99; });
  check('the puppy follows you', fd < 3, fd);

  await goTo(a, 'mochi'); await wait(300);
  await a.keyboard.press('KeyE'); await wait(400);
  check('adopting the kitten swaps pets (one at a time)', (await pet(a)) === 'mochi' && await a.evaluate(() => window.__isle.pets.homeVisible('biscuit')));
  check('the follower is now the kitten', (await a.evaluate(() => window.__isle.pets.follower().id)) === 'mochi');

  await goTo(a, 'hoot'); await wait(300);
  await a.keyboard.press('KeyE'); await wait(400);
  check('you can fly up to an owl and adopt it', (await pet(a)) === 'hoot');
  await a.evaluate(() => { const P = window.__isle.player; P.x -= 12; P.y = 20; });
  await a.waitForFunction(() => { const I = window.__isle, f = I.pets.follower(), P = I.player; return f && Math.hypot(f.x - P.x, f.y - P.y - 2, f.z - P.z) < 2.5; }, null, { timeout: 15000 }).catch(() => {});
  const od = await a.evaluate(() => { const I = window.__isle, f = I.pets.follower(), P = I.player; return Math.hypot(f.x - P.x, f.y - P.y - 2, f.z - P.z); });
  check('the owl flies along at your shoulder', od < 2.5, od);

  await goTo(a, 'cinder'); await wait(300);
  await a.keyboard.press('KeyE'); await wait(400);
  check('you can wake the dragon in its lair and adopt it', (await pet(a)) === 'cinder');

  // Pets list on the pause card.
  await a.keyboard.press('Escape'); await wait(300);
  const list = await a.textContent('#petList');
  check('the pets list shows who follows you and hints for the rest', /Cinder.*Following you/.test(list) && /ring of dark stones/.test(list.replace(/Following you/, '')) === false && /cottage/.test(list), list);
  // reload keeps the pet
  await a.reload();
  await a.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
  check('your pet is still yours after a reload', (await pet(a)) === 'cinder');

  // Rooms: others see your pet, and nobody can take it.
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  await play(a); await play(g); await wait(1500);
  const fol = await g.evaluate(() => window.__isle.pets.followers());
  check('the guest sees the host’s dragon following the host', fol.some((f) => f[1] === 'cinder' && /^peer:/.test(f[0])), fol);
  check('the dragon’s home is empty for the guest too', !(await g.evaluate(() => window.__isle.pets.homeVisible('cinder'))));
  check('the guest cannot adopt the host’s pet', (await g.evaluate(() => window.__isle.pets.adopt('cinder'))) === false && (await pet(g)) === 'none');
  await g.evaluate(() => { const I = window.__isle; I.net.ws.send(JSON.stringify({ t: 'skin', skin: Object.assign({}, I.mySkin, { pet: 'cinder' }) })); });
  await wait(600);
  const hostView = await a.evaluate(() => { let k = null; window.__isle.net.peers.forEach((p) => { k = p.skin.pet; }); return k; });
  check('the server stops two players having the same pet', hostView === 'none', hostView);
  check('the guest can adopt a different pet', await g.evaluate(() => window.__isle.pets.adopt('goldie')));
  await a.waitForFunction(() => window.__isle.pets.followers().some((f) => f[1] === 'goldie'), null, { timeout: 8000 }).catch(() => {});
  check('the host sees the guest’s fish', (await a.evaluate(() => window.__isle.pets.followers())).some((f) => f[1] === 'goldie'));

  await a.evaluate(() => window.__isle.pets.sendHome()); await wait(300);
  check('send home frees the pet', (await pet(a)) === 'none' && await a.evaluate(() => window.__isle.pets.homeVisible('cinder')));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
