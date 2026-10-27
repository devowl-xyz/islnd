// Chat commands (/help, /tp, /fly, /home, /pet, /jet, /block, /where) and test dummies (/spawn, /despawn, /clear).
// Run: node h/commands.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18300, URL = 'http://localhost:' + PORT + '/?layout=classic';
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
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 240000 });
    if (name) await page.fill('#nName', name);
    return page;
  };
  const play = async (p) => { await p.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); }); await p.waitForFunction(() => document.getElementById('overlay').classList.contains('hidden'), null, { timeout: 10000 }).catch(() => {}); };
  // type a line into the chat box, the way a player does (Enter, type, Enter)
  const say = async (p, text) => { await p.keyboard.press('Enter'); await p.waitForFunction(() => !document.getElementById('chatIn').hidden, null, { timeout: 5000 }).catch(() => {}); await p.keyboard.type(text); await p.keyboard.press('Enter'); await wait(300); };
  const lines = (p) => p.evaluate(() => window.__isle.chatLines());
  const last = async (p) => { const l = await lines(p); return l[l.length - 1] || ''; };
  const me = (p) => p.evaluate(() => { const P = window.__isle.player; return { x: P.x, y: P.y, z: P.z, fly: P.fly }; });
  const D = (p) => p.evaluate(() => window.__isle.dummies());

  const a = await open();
  await play(a); await wait(400);
  check('the chat box mentions /help', /\/help/.test(await a.getAttribute('#chatIn', 'placeholder')));
  await say(a, '/help');
  const help = (await lines(a)).join('\n');
  check('/help lists the commands in the chat log', ['/spawn', '/despawn', '/clear', '/tp', '/home', '/fly', '/pet', '/jet', '/block', '/where'].every((c) => help.includes(c)), help);
  check('and commands aren’t said out loud as chat', !(await lines(a)).some((l) => /^Player: \/help/.test(l)));
  await say(a, '/where');
  const at = await me(a);
  check('/where says where you are', (await last(a)).includes(Math.floor(at.x) + ' ' + Math.floor(at.y) + ' ' + Math.floor(at.z)), await last(a));
  await say(a, '/tp 120 30 100');
  const tp = await me(a);
  check('/tp x y z teleports you there', Math.abs(tp.x - 120) < 0.6 && Math.abs(tp.z - 100) < 0.6 && /Teleported to 120 /.test(await last(a)), tp);
  await say(a, '/fly');
  check('/fly starts flying', (await me(a)).fly && /Flying/.test(await last(a)));
  await say(a, '/fly');
  check('and /fly again stops', !(await me(a)).fly);
  await say(a, '/home');
  const home = await me(a);
  check('/home takes you back to the meadow', Math.hypot(home.x - 80.5, home.z - 92.5) < 3, home);
  await say(a, '/block brick');
  check('/block puts a block in your hand', (await a.evaluate(() => window.__isle.hotbar[window.__isle.sel()])) === 8 && /Holding Brick/.test(await last(a)));
  await say(a, '/block nonsense');
  check('and says when there’s no such block', /no block called/.test(await last(a)));
  await say(a, '/pet goldie');
  check('/pet adopts a pet', (await a.evaluate(() => window.__isle.mySkin.pet)) === 'goldie');
  await say(a, '/pet none');
  check('/pet none sends it home', (await a.evaluate(() => window.__isle.mySkin.pet)) === 'none');
  await say(a, '/jet north');
  check('/jet calls the jet to a dock', (await a.evaluate(() => window.__isle.atc.plan() && window.__isle.atc.plan().dock)) === 1);
  await say(a, '/frobnicate');
  check('an unknown command points you to /help', /no command \/frobnicate/.test(await last(a)));

  // test dummies
  await a.evaluate(() => { const P = window.__isle.player; P.fly = false; P.x = 85.5; P.y = 13; P.z = 92.5; P.yaw = Math.PI / 2; });
  await wait(400);
  await say(a, '/spawn');
  let ds = await D(a);
  check('/spawn puts a test dummy in front of you', ds.length === 1 && ds[0].name === 'Test Dummy' && Math.hypot(ds[0].x - 83, ds[0].z - 92.5) < 0.6 && /Spawned Test Dummy/.test(await last(a)), ds);
  await a.waitForFunction(() => { const d = window.__isle.dummies()[0]; return d && Math.abs(d.y - 13) < 0.01; }, null, { timeout: 15000 }).catch(() => {});
  check('it drops onto the ground and stands there', Math.abs((await D(a))[0].y - 13) < 0.01, await D(a));
  await say(a, '/spawn Bob');
  ds = await D(a);
  check('/spawn with a name names it', ds.length === 2 && ds[1].name === 'Bob');
  await a.evaluate(() => { const P = window.__isle.player; P.x = 100.5; P.z = 100.5; });
  await say(a, '/tp bob');
  const nb = await me(a);
  check('/tp and a name takes you to it', Math.hypot(nb.x - ds[1].x, nb.z - ds[1].z) < 2, { nb, bob: ds[1] });
  await say(a, '/despawn');
  ds = await D(a);
  check('/despawn removes the one nearest you', ds.length === 1 && ds[0].name === 'Test Dummy' && /Removed Bob/.test(await last(a)), ds);
  // the helicopter's rope can snatch up a dummy
  await a.evaluate(() => { const I = window.__isle, d = I.dummies()[0], P = I.player; I.setSkin({ pet: 'hoot' }); I.heli.put(d.x, d.y + 8, d.z, 0); P.fly = true; P.x = d.x; P.y = d.y + 9; P.z = d.z + 1; I.heli.board(); I.heli.put(d.x, d.y + 8, d.z, 0); P.yaw = -Math.PI / 2; });
  await a.keyboard.press('KeyH');
  await a.waitForFunction(() => window.__isle.heli.state().dummies.length === 1, null, { timeout: 30000 }).catch(() => {});
  check('the helicopter’s rope snatches up a test dummy', (await a.evaluate(() => window.__isle.heli.state().dummies.length)) === 1 && /Got Test Dummy/.test(await a.textContent('#toast')));
  await wait(800);
  const hd = (await D(a))[0], hs = await a.evaluate(() => window.__isle.heli.state());
  check('and it hangs from the hook', hd.y < hs.y - 3 && Math.hypot(hd.x - hs.x, hd.z - hs.z) < 1.2, { hd, hs });
  await a.keyboard.press('KeyJ');
  await a.waitForFunction(() => { const d = window.__isle.dummies()[0]; return d && Math.abs(d.y - 13) < 0.01; }, null, { timeout: 15000 }).catch(() => {});
  check('J drops it back down to the ground', (await a.evaluate(() => window.__isle.heli.state().dummies.length)) === 0 && Math.abs((await D(a))[0].y - 13) < 0.01, await D(a));
  await a.evaluate(() => window.__isle.heli.leave());
  for (let k = 0; k < 13; k++) await a.evaluate(() => window.__isle.cmd('/spawn'));
  check('there can be at most 12 dummies', (await D(a)).length === 12 && /most test dummies/.test(await last(a)));
  await say(a, '/clear');
  check('/clear removes them all', (await D(a)).length === 0 && /Removed 12 test dummies/.test(await last(a)));

  // rooms: only the host and admins spawn dummies, and everyone sees them
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 240000 });
  await play(g); await play(a);
  await say(g, '/spawn');
  check('a guest can’t /spawn in a room', (await D(g)).length === 0 && /Only the host and admins can \/spawn/.test(await last(g)));
  await g.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'dummy', act: 'spawn', name: 'Sneaky', x: 80, y: 20, z: 90, yaw: 0 })));
  await wait(800);
  check('and the room turns down a sneaky one', (await D(a)).length === 0);
  await a.evaluate(() => { const P = window.__isle.player; P.fly = false; P.x = 85.5; P.y = 13; P.z = 92.5; P.yaw = Math.PI / 2; });
  await wait(300);
  await say(a, '/spawn Dummy Dan');
  await g.waitForFunction(() => window.__isle.dummies().length === 1, null, { timeout: 8000 }).catch(() => {});
  const gd = await D(g), ad = await D(a);
  check('the host spawns one and the guest sees it in the same place', gd.length === 1 && gd[0].name === 'Dummy Dan' && Math.hypot(gd[0].x - ad[0].x, gd[0].z - ad[0].z) < 0.01, { gd, ad });
  check('and is told who spawned it', /spawned Dummy Dan/.test(await last(g)), await last(g));
  await say(g, '/tp dummy');
  check('a guest can still use /tp', Math.hypot((await me(g)).x - gd[0].x, (await me(g)).z - gd[0].z) < 2);
  await say(a, '/clear');
  await g.waitForFunction(() => window.__isle.dummies().length === 0, null, { timeout: 8000 }).catch(() => {});
  check('the host clears them for everyone', (await D(g)).length === 0);

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
