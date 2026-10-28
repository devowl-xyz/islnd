// Host and admin tools: /time, /weather, /fireworks, /announce, /give, /freeze, /lock, and copy and paste
// (/pos1, /pos2, /copy, /rotate, /paste, /undo, /save, /load, /builds, /forget), alone and in a room.
// Run: node h/tools.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18320, URL = 'http://localhost:' + PORT + '/?layout=classic';
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
  const cmd = (p, t) => p.evaluate((t) => window.__isle.cmd(t), t);
  const last = async (p) => { const l = await p.evaluate(() => window.__isle.chatLines()); return l[l.length - 1] || ''; };
  const envNow = (p) => p.evaluate(() => window.__isle.envNow());
  const at = (p, x, y, z) => p.evaluate((q) => window.__isle.get(q[0], q[1], q[2]), [x, y, z]);
  const meadow = (p) => p.evaluate(() => { const P = window.__isle.player; P.fly = false; P.x = 80.5; P.y = 13; P.z = 92.5; P.yaw = 0; P.pitch = 0.4; });

  const a = await open();
  await play(a); await meadow(a); await wait(300);
  // time of day
  await cmd(a, '/time night');
  check('/time night makes it 22:00', (await envNow(a)).time === 22 && /22:00/.test(await last(a)), await envNow(a));
  await a.waitForFunction(() => window.__isle.envNow().L < 0.35 && window.__isle.envNow().stars > 0.5, null, { timeout: 20000 }).catch(() => {});
  check('and the sky goes dark, with stars out', (await envNow(a)).L < 0.35 && (await envNow(a)).stars > 0.5, await envNow(a));
  await cmd(a, '/time 7:30');
  check('/time 7:30 sets the hour', Math.abs((await envNow(a)).time - 7.5) < 0.01);
  await cmd(a, '/time cycle');
  check('/time cycle lets the day run on', (await envNow(a)).cycle === true);
  await cmd(a, '/time stop'); await cmd(a, '/time noon');
  await a.waitForFunction(() => window.__isle.envNow().L > 0.95, null, { timeout: 20000 }).catch(() => {});
  check('/time noon brings the daylight back', !(await envNow(a)).cycle && (await envNow(a)).time === 12 && (await envNow(a)).L > 0.95, await envNow(a));
  await cmd(a, '/time teatime');
  check('and a time it doesn’t know gets a hint', /Use \/time/.test(await last(a)));
  // weather
  await cmd(a, '/weather rain'); await wait(1500);
  check('/weather rain makes it rain', (await envNow(a)).weather === 'rain' && (await envNow(a)).rain, await envNow(a));
  await cmd(a, '/weather snow'); await wait(1500);
  check('/weather snow makes it snow', (await envNow(a)).weather === 'snow' && (await envNow(a)).snow && !(await envNow(a)).rain);
  await cmd(a, '/weather storm'); await wait(800);
  check('/weather storm brings a storm', (await envNow(a)).weather === 'storm' && /storm/.test(await last(a)));
  await cmd(a, '/weather sunny'); await wait(1500);
  check('/weather sunny clears it up', (await envNow(a)).weather === 'clear' && !(await envNow(a)).rain && !(await envNow(a)).snow);
  await a.reload();
  await a.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 240000 });
  await play(a); await meadow(a);
  // fireworks
  await cmd(a, '/fireworks');
  check('/fireworks sets off a show', (await a.evaluate(() => window.__isle.fw.rockets())) >= 10 && /Fireworks/.test(await last(a)));
  await a.waitForFunction(() => window.__isle.fw.active() > 100, null, { timeout: 15000 }).catch(() => {});
  check('and the rockets burst into sparks', (await a.evaluate(() => window.__isle.fw.active())) > 100);
  await cmd(a, '/fireworks');
  check('one show at a time', /being set up/.test(await last(a)));
  // announcements and giving
  await cmd(a, '/announce Hello island');
  check('/announce shows a big message', (await a.textContent('#announce')).includes('Hello island') && await a.evaluate(() => document.getElementById('announce').classList.contains('on')));
  await cmd(a, '/give brick');
  check('/give on your own puts the block in your hand', (await a.evaluate(() => window.__isle.hotbar[window.__isle.sel()])) === 8);
  await cmd(a, '/freeze Bob');
  check('/freeze on your own says it’s for rooms', /for rooms/.test(await last(a)));
  await cmd(a, '/lock');
  check('/lock on your own says nobody else can change it', /nobody else/.test(await last(a)));
  // copy and paste
  await a.evaluate(() => { const I = window.__isle; I.setBlock(84, 13, 86, 8); I.setBlock(85, 13, 86, 8); I.setBlock(84, 14, 86, 9); });
  await cmd(a, '/pos1 84 13 86'); await cmd(a, '/pos2 85 14 86');
  check('/pos1 and /pos2 mark the corners', /2 by 2 by 1/.test(await last(a)));
  await cmd(a, '/copy');
  const c1 = await a.evaluate(() => window.__isle.clip());
  check('/copy copies the blocks between them', c1 && c1.w === 2 && c1.h === 2 && c1.d === 1 && c1.n === 3, c1);
  await cmd(a, '/paste 90 13 86');
  check('/paste puts a copy down', (await at(a, 90, 13, 86)) === 8 && (await at(a, 91, 13, 86)) === 8 && (await at(a, 90, 14, 86)) === 9 && (await at(a, 91, 14, 86)) === 0);
  await cmd(a, '/undo');
  check('/undo takes it back', (await at(a, 90, 13, 86)) === 0 && (await at(a, 90, 14, 86)) === 0);
  await cmd(a, '/rotate');
  const c2 = await a.evaluate(() => window.__isle.clip());
  check('/rotate turns the copy a quarter turn', c2.w === 1 && c2.d === 2 && c2.n === 3, c2);
  await cmd(a, '/paste 90 13 86');
  check('and it pastes turned', (await at(a, 90, 13, 87)) === 8 && (await at(a, 90, 13, 86)) === 8 && (await at(a, 90, 14, 86)) === 9 && (await at(a, 90, 14, 87)) === 0);
  await cmd(a, '/save Little Wall');
  await cmd(a, '/builds');
  check('/save keeps it, and /builds lists it', /little wall/.test(await last(a)));
  await a.evaluate(() => { window.__isle.cmd('/pos1 0 0 0'); });
  await cmd(a, '/load little wall');
  check('/load brings it back', /Loaded/.test(await last(a)) && (await a.evaluate(() => window.__isle.clip().n)) === 3);
  await cmd(a, '/forget little wall'); await cmd(a, '/builds');
  check('/forget deletes it', /No saved builds/.test(await last(a)));
  await cmd(a, '/paste 87 12 92');
  check('the copy won’t paste into the fixed meadow floor', (await at(a, 87, 12, 92)) !== 8 || /couldn’t/.test(await last(a)));

  // ----- in a room -----
  await a.evaluate(() => { document.getElementById('play'); });
  await a.keyboard.press('Escape'); await wait(200);
  await a.evaluate(() => document.getElementById('nHost').click());
  await a.waitForFunction(() => window.__isle.net.code);
  const code = await a.textContent('#nRoomCode');
  const g = await open('Gus');
  await g.fill('#nCode', code); await g.click('#nJoin');
  await g.waitForFunction(() => window.__isle.net.code);
  await g.waitForFunction(() => window.__isle.isReady(), null, { timeout: 240000 });
  await play(g); await play(a); await meadow(g); await meadow(a);
  await cmd(g, '/time night');
  check('a guest can’t change the time', (await envNow(g)).time !== 22 && /Only the host and admins can \/time/.test(await last(g)));
  await cmd(a, '/time night');
  await g.waitForFunction(() => window.__isle.envNow().time === 22, null, { timeout: 8000 }).catch(() => {});
  check('the host sets night for everyone', (await envNow(g)).time === 22 && /set the time to 22:00/.test(await last(g)), await last(g));
  await cmd(a, '/weather snow');
  await g.waitForFunction(() => window.__isle.envNow().weather === 'snow', null, { timeout: 8000 }).catch(() => {});
  check('and the weather', (await envNow(g)).weather === 'snow');
  await cmd(a, '/announce Race at the campsite!');
  await g.waitForFunction(() => document.getElementById('announce').textContent.includes('Race at the campsite'), null, { timeout: 8000 }).catch(() => {});
  check('/announce reaches everyone, with who said it', (await g.textContent('#announce')).includes('Race at the campsite!') && (await g.textContent('#announce')).includes('Player'), await g.textContent('#announce'));
  await cmd(a, '/give Gus gold');
  await g.waitForFunction(() => window.__isle.hotbar[window.__isle.sel()] === 25, null, { timeout: 8000 }).catch(() => {});
  check('/give puts a block in someone’s hand', (await g.evaluate(() => window.__isle.hotbar[window.__isle.sel()])) === 25 && /gave you Gold/.test(await g.textContent('#toast')));
  await cmd(g, '/give Player brick');
  check('but a guest can’t /give', /Only the host and admins can \/give/.test(await last(g)));
  // freezing
  await cmd(a, '/freeze gus');
  await g.waitForFunction(() => window.__isle.iced(), null, { timeout: 8000 }).catch(() => {});
  check('/freeze freezes a player', await g.evaluate(() => window.__isle.iced()) && /froze you/.test(await g.textContent('#toast')));
  const p0 = await g.evaluate(() => { const P = window.__isle.player; return { x: P.x, z: P.z }; });
  await g.keyboard.down('KeyW'); await wait(1200); await g.keyboard.up('KeyW');
  const p1 = await g.evaluate(() => { const P = window.__isle.player; return { x: P.x, z: P.z }; });
  check('and they can’t move', Math.hypot(p1.x - p0.x, p1.z - p0.z) < 0.01, { p0, p1 });
  check('or build', !(await g.evaluate(() => window.__isle.setBlock(82, 13, 95, 8))));
  check('or teleport away', !(await cmd(g, '/home')) && /frozen/.test(await last(g)));
  await a.waitForFunction(() => { const p = [...window.__isle.net.peers.values()][0]; return p && p.av && p.av.ice && p.av.ice.visible; }, null, { timeout: 8000 }).catch(() => {});
  check('everyone sees them in a block of ice', await a.evaluate(() => { const p = [...window.__isle.net.peers.values()][0]; return !!(p && p.av && p.av.ice && p.av.ice.visible); }));
  await cmd(a, '/unfreeze gus');
  await g.waitForFunction(() => !window.__isle.iced(), null, { timeout: 8000 }).catch(() => {});
  await g.keyboard.down('KeyW');
  await g.waitForFunction((q) => { const P = window.__isle.player; return Math.hypot(P.x - q.x, P.z - q.z) > 1; }, p1, { timeout: 15000 }).catch(() => {});
  await g.keyboard.up('KeyW');
  const p2 = await g.evaluate(() => { const P = window.__isle.player; return { x: P.x, z: P.z }; });
  check('/unfreeze lets them go', !(await g.evaluate(() => window.__isle.iced())) && Math.hypot(p2.x - p1.x, p2.z - p1.z) > 1, { p1, p2 });
  await cmd(g, '/freeze Player');
  check('a guest can’t freeze anyone', /Only the host and admins can \/freeze/.test(await last(g)));
  // locks
  await meadow(g);
  await cmd(g, '/lock 4');
  await a.waitForFunction(() => window.__isle.locks().length === 1, null, { timeout: 8000 }).catch(() => {});
  const lk = await a.evaluate(() => window.__isle.locks()[0]);
  check('/lock locks the build round you, for everyone to see', lk && lk.x0 === 76 && lk.x1 === 84 && lk.z0 === 88 && lk.z1 === 96 && lk.name === 'Gus' && /Locked your build/.test(await last(g)), lk);
  check('and you can still build in it', await g.evaluate(() => window.__isle.setBlock(78, 13, 90, 8)));
  await wait(500);
  check('so can the host', await a.evaluate(() => window.__isle.setBlock(79, 13, 90, 8)));
  await cmd(a, '/unlock');
  await a.waitForFunction(() => window.__isle.locks().length === 0, null, { timeout: 8000 }).catch(() => {});
  check('the host can unlock anyone’s build', (await a.evaluate(() => window.__isle.locks().length)) === 0);
  await cmd(a, '/lock 4');
  await g.waitForFunction(() => window.__isle.locks().length === 1, null, { timeout: 8000 }).catch(() => {});
  check('a guest can’t build in someone else’s locked build', !(await g.evaluate(() => window.__isle.setBlock(80, 13, 94, 8))) && /locked by Player/.test(await g.textContent('#toast')));
  await g.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'edit', x: 80, y: 13, z: 94, b: 8 })));
  await wait(800);
  check('and the room turns down a sneaky edit there too', (await at(a, 80, 13, 94)) === 0 && /locked/.test(await g.textContent('#toast')));
  await cmd(g, '/unlock');
  check('a guest can’t unlock it', /Only its owner/.test(await last(g)) || (await g.evaluate(() => window.__isle.locks().length)) === 1);
  await cmd(a, '/unlock all');
  await g.waitForFunction(() => window.__isle.locks().length === 0, null, { timeout: 8000 }).catch(() => {});
  check('/unlock all clears them', (await g.evaluate(() => window.__isle.locks().length)) === 0);
  // pasting in a room
  await cmd(a, '/pos1 84 13 86'); await cmd(a, '/pos2 85 14 86'); await cmd(a, '/copy');
  await cmd(a, '/paste 70 13 80');
  await g.waitForFunction(() => window.__isle.get(70, 13, 80) === 8, null, { timeout: 8000 }).catch(() => {});
  check('the host’s paste shows up for everyone', (await at(g, 70, 13, 80)) === 8 && (await at(g, 70, 14, 80)) === 9);
  await cmd(g, '/pos1 84 13 86'); await cmd(g, '/pos2 85 14 86'); await cmd(g, '/copy');
  await cmd(g, '/paste 72 13 80');
  check('a guest can copy but not paste', /Only the host and admins can \/paste/.test(await last(g)) && (await at(a, 72, 13, 80)) === 0);
  // fireworks for everyone
  await cmd(a, '/fireworks palace');
  await g.waitForFunction(() => window.__isle.fw.rockets() > 0 || window.__isle.fw.active() > 0, null, { timeout: 8000 }).catch(() => {});
  check('fireworks go off for everyone', (await g.evaluate(() => window.__isle.fw.rockets() + window.__isle.fw.active())) > 0 && /set off fireworks/.test(await last(g)));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
