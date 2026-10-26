// Playing together: chat, emotes, pet tricks, tag, the horse race and holding the jet. Real Chromium pages.
// Run: node h/social.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18230, URL = 'http://localhost:' + PORT + '/';
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const open = async (name) => {
    const page = await (await browser.newContext({ viewport: { width: 900, height: 700 } })).newPage();
    page.on('pageerror', (e) => { console.log((name || 'page') + ' pageerror', e.message); fails++; });
    await page.goto(URL);
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
    if (name) await page.fill('#nName', name);
    return page;
  };
  const play = async (p) => { await p.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); }); await p.waitForFunction(() => document.getElementById('overlay').classList.contains('hidden'), null, { timeout: 10000 }).catch(() => {}); };
  const pose = (p, x, y, z) => p.evaluate(([x, y, z]) => { const P = window.__isle.player; P.fly = false; P.x = x; P.y = y; P.z = z; P.vx = P.vy = P.vz = 0; }, [x, y, z]);
  const S = (p) => p.evaluate(() => window.__isle.social);
  const peer = (p, f) => p.evaluate(f);

  const a = await open('Hana');
  await play(a); await wait(400);

  // Single player: chat bubble, emotes, pet tricks, the race, holding the jet.
  await a.keyboard.press('Enter'); await wait(200);
  check('Enter opens the chat box', await a.evaluate(() => !document.getElementById('chatIn').hidden && document.activeElement === document.getElementById('chatIn')));
  await a.keyboard.type('hello island'); await a.keyboard.press('Enter'); await wait(300);
  check('your message shows in the chat log and over your head', /hello island/.test(await a.textContent('#chatlog')) && (await a.evaluate(() => window.__isle.social.bubbles())) === 1);
  check('and the chat box closes', await a.evaluate(() => document.getElementById('chatIn').hidden));
  await a.keyboard.press('KeyX'); await wait(200);
  check('X opens the emote bar', await a.evaluate(() => !document.getElementById('emotes').hidden));
  await a.keyboard.press('Digit2'); await wait(200);
  check('2 dances', (await a.evaluate(() => window.__isle.social.emoteNow())) === 'dance' && await a.evaluate(() => document.getElementById('emotes').hidden));
  check('and doesn’t change your hotbar slot', (await a.evaluate(() => window.__isle.sel())) === 4);
  await a.keyboard.down('KeyW'); await wait(300); await a.keyboard.up('KeyW');
  check('moving stops the emote', (await a.evaluate(() => window.__isle.social.emoteNow())) === null);
  await a.evaluate(() => window.__isle.social.chat('/wave'));
  check('/wave in chat waves', (await a.evaluate(() => window.__isle.social.emoteNow())) === 'wave');
  // rod creatures emote too
  await a.evaluate(() => window.__isle.setSkin({ kind: 'rod', rodStyle: 'tendrils' }));
  await a.evaluate(() => window.__isle.social.emote(1)); await wait(1200);
  const rd = await a.evaluate(() => window.__isle.social.fig());
  check('a rod creature dances by spinning round', rd && rd.kind === 'rod' && Math.abs(rd.rigRot) > 0.3, rd);
  await a.evaluate(() => window.__isle.social.emote(2)); await wait(600);
  const rs = await a.evaluate(() => window.__isle.social.fig());
  check('and sits by squashing down', rs && rs.rigY < 0.7, rs);
  await a.keyboard.down('KeyW'); await wait(300); await a.keyboard.up('KeyW'); await wait(400);
  check('then stands back up', (await a.evaluate(() => window.__isle.social.fig().rigY)) === 1);
  await a.evaluate(() => window.__isle.setSkin({ kind: 'person' }));
  await a.keyboard.press('KeyY'); await wait(200);
  check('Y with no pet says to adopt one', /Adopt a pet/.test(await a.textContent('#toast')));
  await a.evaluate(() => { const I = window.__isle, h = I.pets.home.biscuit, P = I.player; P.x = h.x - 1; P.y = 19; P.z = h.z; I.pets.adopt('biscuit'); });
  await pose(a, 80.5, 13, 96.5); await wait(800);
  await a.keyboard.press('KeyY'); await wait(200);
  check('Y: your pet does a trick', /Biscuit sits/.test(await a.textContent('#toast')));
  await wait(400); await a.keyboard.press('KeyY'); await wait(200);
  check('and a different one each time', /Biscuit spins/.test(await a.textContent('#toast')));

  await a.evaluate(() => window.__isle.social.startRace());
  await wait(300);
  const r0 = await a.evaluate(() => { const r = window.__isle.social.race(), s = window.__isle.social.ringAt(0), P = window.__isle.player; return { r, d: Math.hypot(P.x - s[0] - 0.5, P.z - s[1] - 0.5) }; });
  check('a solo race puts you on the start line, counting down', r0.r && r0.r.next === 1 && r0.d < 1 && /<span class="big">\d<\/span>/.test(await a.evaluate(() => document.getElementById('gamehud').innerHTML)), r0);
  await a.waitForFunction(() => window.__isle.nowS() > window.__isle.social.race().startS, null, { timeout: 10000 }).catch(() => {});
  for (let i = 1; i <= 6; i++) { await a.evaluate((i) => { const c = window.__isle.social.ringAt(i), P = window.__isle.player; P.x = c[0] + 0.5; P.z = c[1] + 0.5; P.y = 30; P.fly = true; }, i); await wait(250); }
  await a.evaluate(() => { window.__isle.player.fly = false; });
  check('passing every ring finishes the race', await a.evaluate(() => { const r = window.__isle.social.race(); return r && r.done; }) && /Finished in/.test(await a.textContent('#toast')));

  // Holding the jet, on your own.
  const parked = await a.evaluate(() => { const I = window.__isle, k = I.dockPark(I.docks[0]); I.jet.call = null; I.jet.rel = null; I.jet.call = { dock: 0, x: k[0], y: k[1], z: k[2], h: I.docks[0].out, t0: I.nowS() - 100, wait: 200 }; return I.jetStatus(0); });
  check('with the jet waiting at a dock', parked.at === 0, parked);
  check('you can hold it there', await a.evaluate(() => window.__isle.social.hold()) && await a.evaluate(() => { const s = window.__isle.jetStatus(0); return s.held && s.leave > 1e5; }));
  check('and the hint says it’s held', await a.evaluate(() => { const I = window.__isle, k = I.dockPark(I.docks[0]), P = I.player; P.fly = true; P.x = k[0]; P.y = k[1] - 0.9; P.z = k[2] + 2; return true; }) && (await a.waitForFunction(() => /held here/.test(document.getElementById('jethint').textContent), null, { timeout: 5000 }).then(() => true).catch(() => false)));
  check('then send it on', await a.evaluate(() => window.__isle.social.release()) && await a.evaluate(() => { const s = window.__isle.jetStatus(0); return !s.held; }));

  // Rooms.
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  await play(g); await play(a); await wait(500);
  await pose(a, 80.5, 13, 96.5); await pose(g, 84.5, 13, 96.5); await wait(800);

  await g.evaluate(() => window.__isle.social.chat('hi Hana!'));
  await a.waitForFunction(() => /hi Hana!/.test(document.getElementById('chatlog').textContent), null, { timeout: 8000 }).catch(() => {});
  check('the host reads the guest’s chat, with their name', /Gus: hi Hana!/.test(await a.textContent('#chatlog')));
  check('as a bubble over the guest', (await a.evaluate(() => window.__isle.social.bubbles())) >= 1);
  await g.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'chat', text: 'x'.repeat(300) })));
  await wait(900);
  check('long messages are cut short by the server', await a.evaluate(() => [...document.querySelectorAll('#chatlog .line')].every((l) => l.textContent.length < 100)));
  await g.evaluate(() => window.__isle.social.emote(3));
  await a.waitForFunction(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.tgt && p.tgt.em === 4 && p.av && p.av.armL.rotation.x > 3) ok = true; }); return ok; }, null, { timeout: 8000 }).catch(() => {});
  check('the host sees the guest cheer', await a.evaluate(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.tgt && p.tgt.em === 4) ok = true; }); return ok; }));
  await a.keyboard.press('KeyY');
  await g.waitForFunction(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.tgt && p.tgt.pk > 0) ok = true; }); return ok; }, null, { timeout: 8000 }).catch(() => {});
  check('the guest sees Biscuit do a trick', await g.evaluate(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.tgt && p.tgt.pk > 0 && p.trick) ok = true; }); return ok; }));

  // Tag.
  await g.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'tagStart' }))); await wait(400);
  check('only the host can start tag', !(await a.evaluate(() => window.__isle.social.tag())));
  await a.evaluate(() => window.__isle.social.tagStart());
  await a.waitForFunction(() => !!window.__isle.social.tag(), null, { timeout: 8000 }).catch(() => {});
  await g.waitForFunction(() => !!window.__isle.social.tag(), null, { timeout: 8000 }).catch(() => {});
  const t0 = await a.evaluate(() => window.__isle.social.tag());
  check('the host starts tag and someone is it', t0 && (t0.it === (await a.evaluate(() => window.__isle.net.you)) || t0.it === (await g.evaluate(() => window.__isle.net.you))), t0);
  await g.waitForFunction(() => /Tag/.test(document.getElementById('gamehud').textContent) && !document.getElementById('gamehud').hidden, null, { timeout: 8000 }).catch(() => {});
  check('the HUD shows who’s it and the time left', /Tag/.test(await g.textContent('#gamehud')) && /it/.test(await g.textContent('#gamehud')));
  const ids = { a: await a.evaluate(() => window.__isle.net.you), g: await g.evaluate(() => window.__isle.net.you) };
  const itP = t0.it === ids.a ? a : g, other = itP === a ? g : a, otherId = itP === a ? ids.g : ids.a;
  await wait(1700);
  await itP.evaluate((id) => window.__isle.net.ws.send(JSON.stringify({ t: 'tagged', target: id })), otherId); await wait(500);
  check('you can’t tag someone far away', (await a.evaluate(() => window.__isle.social.tag().it)) === t0.it);
  await pose(other, 81.5, 13, 96.5); await pose(itP, 80.8, 13, 96.5);
  await a.waitForFunction((id) => window.__isle.social.tag() && window.__isle.social.tag().it === id, otherId, { timeout: 10000 }).catch(() => {});
  check('touching someone passes it on', (await a.evaluate(() => window.__isle.social.tag().it)) === otherId && (await g.evaluate(() => window.__isle.social.tag().it)) === otherId);
  await other.evaluate((id) => window.__isle.net.ws.send(JSON.stringify({ t: 'tagged', target: id })), t0.it); await wait(500);
  check('no tagging straight back', (await a.evaluate(() => window.__isle.social.tag().it)) === otherId);
  await pose(other, 100.5, 13, 96.5); await wait(300);
  await a.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'tagStop' })));
  await g.waitForFunction(() => !window.__isle.social.tag(), null, { timeout: 8000 }).catch(() => {});
  check('stopping tag shows the scores', !(await g.evaluate(() => window.__isle.social.tag())) && /Tag is over/.test(await g.textContent('#results')));

  // A race for everyone.
  await g.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'race' }))); await wait(400);
  check('only the host can start a room race', !(await g.evaluate(() => window.__isle.social.race() && window.__isle.social.race().startS > window.__isle.nowS())));
  await a.evaluate(() => { window.__isle.social.startRace(); });
  await g.waitForFunction(() => !!window.__isle.social.race(), null, { timeout: 8000 }).catch(() => {});
  check('the host starts a race and everyone lines up', !!(await g.evaluate(() => window.__isle.social.race())) && !!(await a.evaluate(() => window.__isle.social.race())));
  await g.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'raceDone', time: 16 }))); await wait(400);
  check('the server won’t take a finish time faster than the race has run', !/finished/.test(await a.textContent('#toast')));

  // Holding the jet in a room.
  await g.evaluate(() => { const q = window.__isle.jet.pose; window.__isle.net.ws.send(JSON.stringify({ t: 'hold', dock: 0, x: q.x, y: q.y, z: q.z, h: q.h })); }); await wait(400);
  check('a builder can’t hold the jet', await a.evaluate(() => !(window.__isle.jet.call && window.__isle.jet.call.hold)));
  await a.evaluate(() => { const q = window.__isle.jet.pose; window.__isle.net.ws.send(JSON.stringify({ t: 'hold', dock: 0, x: q.x, y: q.y, z: q.z, h: q.h })); });
  await g.waitForFunction(() => window.__isle.jet.call && window.__isle.jet.call.hold, null, { timeout: 8000 }).catch(() => {});
  check('the host holds it, and the guest sees it held', await g.evaluate(() => !!(window.__isle.jet.call && window.__isle.jet.call.hold)));
  await g.evaluate(() => { const q = window.__isle.jet.pose; window.__isle.net.ws.send(JSON.stringify({ t: 'call', dock: 2, x: q.x, y: q.y, z: q.z, h: q.h })); }); await wait(400);
  check('nobody else can call it away while it’s held', await a.evaluate(() => window.__isle.jet.call && window.__isle.jet.call.hold && window.__isle.jet.call.dock === 0));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
