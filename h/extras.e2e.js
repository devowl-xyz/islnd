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
  await a.waitForFunction(() => !window.__isle.zip.riding(), null, { timeout: 30000 }).catch(() => {});
  const zp = await me(a);
  check('and you whizz down the line and touch down near the low post', zp.z > 92 && zp.y < 15 && !(await a.evaluate(() => window.__isle.zip.riding())), zp);
  await put(a, 76.5, 20, 81.5, Math.PI); await wait(300);
  await a.keyboard.press('KeyE'); await wait(600);
  await a.keyboard.press('Space'); await wait(300);
  check('Space lets go part way down', !(await a.evaluate(() => window.__isle.zip.riding())));
  await a.evaluate(() => window.__isle.setBlock(76, 13, 100, 0)); await wait(200);
  check('take a post away and the line goes', (await a.evaluate(() => window.__isle.zip.lines())).length === 0);
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
  check('the lighthouse stands on its islet, red and white', await a.evaluate((o) => { const I = window.__isle; return I.get(o.cx - 2, o.G, o.cz) === 33 && I.get(o.cx - 2, o.G + 4, o.cz) === 44 && I.get(o.cx, o.L + 1, o.cz) === 11; }, LH));
  await a.evaluate(() => window.__isle.cmd('/tp lighthouse'));
  const lp = await me(a);
  check('/tp lighthouse takes you to its door', Math.hypot(lp.x - LH.cx, lp.z - LH.cz) < 6, lp);
  await a.evaluate(() => window.__isle.cmd('/time noon'));
  await wait(2500);
  check('by day the beam is off', !(await a.evaluate(() => { const b = window.__isle.lighthouse.beam(); return b && b.on; })));
  const wd = await a.evaluate(() => window.__isle.wild.counts());
  check('by day birds fly over the sea', wd.birds > 0, wd);
  await a.waitForFunction(() => window.__isle.wild.counts().fish > 0, null, { timeout: 10000 }).catch(() => {});
  check('and fish swim in the sea round the lighthouse', (await a.evaluate(() => window.__isle.wild.counts().fish)) > 0);
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
  await g.waitForFunction(() => window.__isle.react.fx() > 0, null, { timeout: 8000 }).catch(() => {});
  check('others see your reaction', (await g.evaluate(() => window.__isle.react.fx())) > 0);
  await a.keyboard.press('Enter'); await wait(200);
  await a.keyboard.type('hel');
  await g.waitForFunction(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Gus'); return p && p.av && p.av.typeFx && p.av.typeFx.visible; }, null, { timeout: 8000 }).catch(() => {});
  check('and dots over your head while you type', await g.evaluate(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Gus'); return !!(p && p.av && p.av.typeFx && p.av.typeFx.visible); }));
  await a.keyboard.type('lo!'); await a.keyboard.press('Enter');
  await g.waitForFunction(() => window.__isle.social.bubbles() > 0, null, { timeout: 8000 }).catch(() => {});
  check('then your words in a bubble', (await g.evaluate(() => window.__isle.social.bubbles())) > 0 && !(await g.evaluate(() => { const p = [...window.__isle.net.peers.values()].find((q) => q.name !== 'Gus'); return !!(p && p.av && p.av.typeFx && p.av.typeFx.visible); })));
  void peerA;

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
