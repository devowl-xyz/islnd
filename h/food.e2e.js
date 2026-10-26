// Biscuit and Mochi turning into food, and what happens if you try to eat them. Real Chromium pages.
// Run: node h/food.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18200, URL = 'http://localhost:' + PORT + '/?layout=classic';
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
  const adopt = (p, id) => p.evaluate((id) => { const I = window.__isle, h = I.pets.home[id], P = I.player; P.fly = false; P.x = h.x - 1; P.y = 19; P.z = h.z; return I.pets.adopt(id); }, id);
  const pose = (p, x, y, z) => p.evaluate(([x, y, z]) => { const P = window.__isle.player; P.fly = false; P.x = x; P.y = y; P.z = z; P.vx = P.vy = P.vz = 0; }, [x, y, z]);
  const follower = (p) => p.evaluate(() => { const I = window.__isle; let f = null; I.pets.followers(); return I.pets.follower(); });
  const P = (p) => p.evaluate(() => { const P = window.__isle.player; return { x: P.x, y: P.y, z: P.z }; });

  const a = await open();
  await play(a); await wait(500);
  check('adopting Biscuit', await adopt(a, 'biscuit'));
  await pose(a, 80.5, 13, 96.5); await wait(1500);
  await a.keyboard.press('KeyT'); await wait(400);
  check('T turns Biscuit into a biscuit', await a.evaluate(() => window.__isle.food.mine()) && /turned into a biscuit/.test(await a.textContent('#toast')));
  await a.waitForFunction(() => { const I = window.__isle; return [...document.querySelectorAll('#petList button')].some((b) => /Turn back/.test(b.textContent)); }, null, { timeout: 5000 }).catch(() => {});
  check('the pause card offers to turn it back', await a.evaluate(() => [...document.querySelectorAll('#petList button')].some((b) => /Turn back/.test(b.textContent))));
  check('and it still follows you, as food', await a.evaluate(() => { let ok = false; window.__isle.pets.followers(); const I = window.__isle, f = I.pets.follower(); return !!f; }));
  await a.keyboard.press('KeyT'); await wait(300);
  check('T again turns it back', !(await a.evaluate(() => window.__isle.food.mine())));
  check('only Biscuit and Mochi can do it', await a.evaluate(() => { const I = window.__isle; I.pets.adopt('hoot'); const r = I.food.toggle(); I.pets.adopt('biscuit'); return r === false; }));

  // Try to eat it: it chases you home to bed.
  await a.evaluate(() => { const I = window.__isle; I.setBlock(70, 13, 92, 27); I.setBlock(70, 13, 91, 28); I.sleep.in(70, 13, 92); I.sleep.wake(); });
  await pose(a, 80.5, 13, 96.5); await wait(1500);
  await a.evaluate(() => window.__isle.food.toggle());
  await a.waitForFunction(() => { const I = window.__isle, f = I.pets.follower(), P = I.player; return f && Math.hypot(f.x - P.x, f.z - P.z) < 2.4; }, null, { timeout: 20000 }).catch(() => {});
  check('you can try to eat your own biscuit', await a.evaluate(() => window.__isle.food.eat(true)));
  check('it turns back and goes for you', !(await a.evaluate(() => window.__isle.food.mine())) && (await a.evaluate(() => window.__isle.food.chases())).some((c) => c[1] === 'me'));
  await a.waitForFunction(() => window.__isle.food.hp() < 5, null, { timeout: 20000 }).catch(() => {});
  check('it bites, and you lose hearts', await a.evaluate(() => window.__isle.food.hp() < 5 && !document.getElementById('hearts').hidden));
  await a.waitForFunction(() => window.__isle.food.ko() > 0, null, { timeout: 30000 }).catch(() => {});
  check('after five bites you are chased home', await a.evaluate(() => window.__isle.food.ko() > 0 && /chased you all the way home/.test(document.getElementById('sleepText').textContent)));
  await a.waitForFunction(() => window.__isle.food.ko() === 0, null, { timeout: 15000 }).catch(() => {});
  const home = await P(a);
  check('and wake up beside your bed', Math.hypot(home.x - 70.5, home.z - 91.5) < 2.5, home);
  check('with your hearts back, and the chase over', await a.evaluate(() => window.__isle.food.hp() === 5 && window.__isle.food.chases().length === 0));

  // Rooms: the guest tries to eat the host's Mochi.
  await a.evaluate(() => window.__isle.pets.sendHome());
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  await play(g); await play(a); await wait(500);
  check('the host adopts Mochi', await adopt(a, 'mochi'));
  await pose(a, 80.5, 13, 96.5); await wait(1500);
  await a.evaluate(() => window.__isle.food.toggle());
  await g.waitForFunction(() => { let f = false; window.__isle.net.peers.forEach((p) => { if (p.food) f = true; }); return f; }, null, { timeout: 8000 }).catch(() => {});
  check('the guest sees Mochi turn into a mochi', await g.evaluate(() => { let f = false; window.__isle.net.peers.forEach((p) => { if (p.food) f = true; }); return f; }));
  await g.evaluate(() => { const I = window.__isle; I.net.ws.send(JSON.stringify({ t: 'eat', owner: 999 })); });
  await wait(300);
  await g.waitForFunction(() => { const I = window.__isle; let pk = null; I.pets.followers().forEach((f) => { if (f[1] === 'mochi') pk = f[0]; }); return !!pk; }, null, { timeout: 8000 }).catch(() => {});
  await g.evaluate(() => { const I = window.__isle, P = I.player, f = I.food.list().find((e) => e[4]); P.fly = false; P.x = f[1] + 1.2; P.y = f[2]; P.z = f[3]; P.vx = P.vy = P.vz = 0; });
  await g.waitForFunction(() => !!window.__isle.food.near(), null, { timeout: 15000 }).catch(() => {});
  check('next to it, the guest is offered a bite', /eat the mochi/.test(await g.textContent('#jethint')), await g.textContent('#jethint'));
  await g.keyboard.press('KeyE');
  await a.waitForFunction(() => window.__isle.food.chases().length > 0, null, { timeout: 8000 }).catch(() => {});
  check('Mochi turns back and chases the guest, on both screens', await a.evaluate(() => window.__isle.food.chases().some((c) => c[0] === 'me' && c[1] !== 'me') && !window.__isle.food.mine()) && await g.evaluate(() => window.__isle.food.chases().some((c) => c[1] === 'me')));
  check('the host is told', /tried to eat Mochi/.test(await a.textContent('#toast')));
  await g.waitForFunction(() => window.__isle.food.ko() > 0, null, { timeout: 40000 }).catch(() => {});
  check('the guest is chased home', await g.evaluate(() => window.__isle.food.ko() > 0));
  await a.waitForFunction(() => window.__isle.food.chases().length === 0, null, { timeout: 8000 }).catch(() => {});
  check('and Mochi comes back to its owner', await a.evaluate(() => window.__isle.food.chases().length === 0));
  await g.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'eat', owner: [...window.__isle.net.peers.keys()][0] })));
  await wait(500);
  check('you can’t eat a pet that isn’t food', await a.evaluate(() => window.__isle.food.chases().length === 0));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
