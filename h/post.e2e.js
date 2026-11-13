// Room social test in real Chromium pages: letters, gifts, team bases and the racing league.
// Run: node h/post.e2e.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const { server } = require('../server.js');
const PORT = 18095, URL = 'http://localhost:' + PORT + '/?layout=classic';
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const open = async (name) => {
    const page = await (await browser.newContext({ viewport: { width: 800, height: 500 } })).newPage();
    page.on('pageerror', (e) => { console.log(name + ' pageerror', e.message); fails++; });
    await page.goto(URL);
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 240000 });
    await page.evaluate(() => window.__isle.more(true)); await page.fill('#nName', name);
    return page;
  };
  const host = await open('Hana');
  await host.evaluate(() => document.getElementById('nHost').click());
  await host.waitForFunction(() => window.__isle.net.code, null, { timeout: 60000 });
  const code = await host.textContent('#nRoomCode');
  const guest = await open('Gus');
  await guest.fill('#nCode', code); await guest.click('#nJoin');
  await guest.waitForFunction(() => window.__isle.net.code && window.__isle.isReady(), null, { timeout: 240000 });
  for (const p of [host, guest]) await p.evaluate(() => document.getElementById('play').click());
  await wait(1500);
  // the postman pigeon
  check('/letter sends a pigeon off with your letter', await guest.evaluate(() => window.__isle.cmd('/letter Hana Meet me at the lighthouse!')));
  await host.waitForFunction(() => /lighthouse/.test(document.getElementById('announce').textContent), null, { timeout: 30000 }).catch(() => {});
  check('a pigeon flies it to them and they read it', /Meet me at the lighthouse/.test(await host.evaluate(() => document.getElementById('announce').textContent)));
  // messages in bottles
  const shore = await host.evaluate(() => { const I = window.__isle; for (let z = 40; z < 320; z += 3) for (let x = 40; x < 320; x += 3) if (I.get(x, 10, z) === 4 && I.get(x, 11, z) === 0 && (I.get(x + 1, 10, z) === 12 || I.get(x - 1, 10, z) === 12 || I.get(x, 10, z + 1) === 12 || I.get(x, 10, z - 1) === 12)) return { x: x + 0.5, y: 11, z: z + 0.5 }; return null; });
  await host.evaluate((q) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = q.x; P.y = q.y; P.z = q.z; }, shore); await wait(500);
  check('in a room, /bottle throws your message out to sea', await host.evaluate(() => window.__isle.cmd('/bottle Ahoy, Gus!')));
  await guest.waitForFunction(() => window.__isle.bottle.list().some((b) => /Ahoy, Gus/.test(b.text)), null, { timeout: 20000 }).catch(() => {});
  const gb = await guest.evaluate(() => window.__isle.bottle.list().find((b) => /Ahoy, Gus/.test(b.text)) || null);
  check('and it washes up on a beach for others to find', !!gb && gb.from === 'Hana', gb);
  if (gb) {
    await guest.evaluate((q) => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = q.x + 0.6; P.y = q.y; P.z = q.z; }, gb); await wait(600);
    await guest.evaluate(() => window.__isle.bottle.read());
    await host.waitForFunction(() => !window.__isle.bottle.list().some((b) => /Ahoy, Gus/.test(b.text)), null, { timeout: 20000 }).catch(() => {});
    check('whoever finds it first reads it, and it’s gone for everyone', /Ahoy, Gus/.test(await guest.evaluate(() => window.__isle.bottle.said() || '')) && !(await host.evaluate(() => window.__isle.bottle.list().some((b) => /Ahoy, Gus/.test(b.text)))));
    await guest.evaluate(() => { const b = document.getElementById('letterOk'); if (b) b.click(); });
  }
  // owners may break any block of their own house: the room's server agrees
  const tc = await host.evaluate(() => { const I = window.__isle, T = I.th.TH; for (let y = T.y0 + 1; y <= T.y1; y++) for (let z = T.z0; z <= T.z1; z++) for (let x = T.x0; x <= T.x1; x++) if (I.th.cell(x, y, z) === 'base' && I.get(x, y, z) && I.get(x, y, z) !== 12) return [x, y, z]; return null; });
  await host.evaluate((c) => window.__isle.setBlock(c[0], c[1], c[2], 0), tc); await wait(2500);
  check('in a room, someone else can’t break the treehouse’s frame', (await guest.evaluate((c) => window.__isle.get(c[0], c[1], c[2]), tc)) !== 0 && (await host.evaluate((c) => window.__isle.get(c[0], c[1], c[2]), tc)) !== 0);
  await guest.evaluate(() => window.__isle.setSkin({ pet: 'hoot' })); await wait(1500);
  await guest.evaluate((c) => window.__isle.setBlock(c[0], c[1], c[2], 0), tc);
  await host.waitForFunction((c) => window.__isle.get(c[0], c[1], c[2]) === 0, tc, { timeout: 20000 }).catch(() => {});
  check('but an owl owner can, and everyone sees it', (await host.evaluate((c) => window.__isle.get(c[0], c[1], c[2]), tc)) === 0);
  // the invisibility cloak: nobody else can see you, your name or your pet
  await guest.evaluate(() => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = 82.5; P.y = 13; P.z = 92.5; });
  await host.evaluate(() => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = 80.5; P.y = 13; P.z = 96.5; });
  await host.waitForFunction(() => { const v = window.__isle.peerVis().Gus; return v && v.av && v.pet === true; }, null, { timeout: 30000 }).catch(() => {});
  check('you can see another player and their pet', await host.evaluate(() => { const v = window.__isle.peerVis().Gus; return !!v && v.av && v.pet === true; }), await host.evaluate(() => window.__isle.peerVis()));
  await guest.evaluate(() => window.__isle.lab.use('cloak'));
  await host.waitForFunction(() => { const v = window.__isle.peerVis().Gus; return v && v.iv; }, null, { timeout: 30000 }).catch(() => {});
  await wait(1000);
  check('in the invisibility cloak they vanish completely for everyone else, pet and all', await host.evaluate(() => { const v = window.__isle.peerVis().Gus; return !!v && v.iv && !v.av && v.pet === false; }), await host.evaluate(() => window.__isle.peerVis()));
  await guest.evaluate(() => window.__isle.lab.uncloak());
  await host.waitForFunction(() => { const v = window.__isle.peerVis().Gus; return v && !v.iv && v.av; }, null, { timeout: 30000 }).catch(() => {});
  check('and come back when it wears off', await host.evaluate(() => { const v = window.__isle.peerVis().Gus; return !!v && !v.iv && v.av && v.pet === true; }), await host.evaluate(() => window.__isle.peerVis()));
  await guest.evaluate(() => window.__isle.setSkin({ pet: 'none' }));
  // admins: /pet Name pet and /kill Name, and the death screen
  check('a guest can’t use /pet on someone else', !(await guest.evaluate(() => window.__isle.cmd('/pet Hana fox'))));
  check('the host can: /pet Gus mochi', await host.evaluate(() => window.__isle.cmd('/pet Gus mochi')));
  await guest.waitForFunction(() => window.__isle.pets.mine() === 'mochi', null, { timeout: 20000 }).catch(() => {});
  check('and Gus’s pet becomes Mochi', (await guest.evaluate(() => window.__isle.pets.mine())) === 'mochi', await guest.evaluate(() => window.__isle.pets.mine()));
  check('a guest can’t /kill anyone', !(await guest.evaluate(() => window.__isle.cmd('/kill Hana'))) && !(await host.evaluate(() => window.__isle.death.on())));
  check('the host can: /kill Gus', await host.evaluate(() => window.__isle.cmd('/kill Gus')));
  await guest.waitForFunction(() => window.__isle.death.on(), null, { timeout: 20000 }).catch(() => {});
  check('his character falls over first, and the chat says what happened', await host.waitForFunction(() => /Gus was struck down by Hana/.test(document.getElementById('chatlog').textContent), null, { timeout: 20000 }).then(() => true).catch(() => false));
  await guest.waitForFunction(() => !document.getElementById('death').hidden, null, { timeout: 20000 }).catch(() => {});
  check('Gus dies: YOU DIED, with a Respawn button and a picture of him', await guest.evaluate(() => { const d = document.getElementById('death'); return window.__isle.death.on() && !d.hidden && /YOU DIED/.test(d.textContent) && !!document.getElementById('deathBtn') && !!document.getElementById('deathPic'); }));
  const gy0 = await guest.evaluate(() => { const P = window.__isle.player; return [P.x, P.y, P.z]; });
  await wait(1200);
  check('while dead you can’t move', await guest.evaluate((p) => { const P = window.__isle.player; return Math.hypot(P.x - p[0], P.z - p[2]) < 0.01; }, gy0));
  await guest.click('#deathBtn');
  await guest.waitForFunction(() => !window.__isle.death.on(), null, { timeout: 10000 }).catch(() => {});
  check('Respawn brings him back with full hearts', await guest.evaluate(() => !window.__isle.death.on() && document.getElementById('death').hidden && window.__isle.food.hp() === 5));
  await guest.evaluate(() => window.__isle.setSkin({ pet: 'none' }));
  // swords and armour: others see what you hold and wear, and a hit lands (the server checks you're close)
  await host.evaluate(() => { const I = window.__isle; I.gear.setMats({ spark: 50, diamond: 3, copper: 8 }); I.gear.craft('sword_spark'); I.gear.craft('armor_copper'); });
  await host.keyboard.press('Digit0'); await wait(300);
  await guest.evaluate(() => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = 82.5; P.y = 13; P.z = 92.5; });
  await host.evaluate(() => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = 82.5; P.y = 13; P.z = 94.5; P.yaw = 0; });
  await guest.waitForFunction(() => { const v = window.__isle.peerVis().Hana; return v && /sword_spark\|copper/.test(v.gear); }, null, { timeout: 30000 }).catch(() => {});
  check('others see the spark sword in your hand and your copper armour', await guest.evaluate(() => { const v = window.__isle.peerVis().Hana; return !!v && /sword_spark\|copper/.test(v.gear); }), await guest.evaluate(() => window.__isle.peerVis()));
  const ghp0 = await guest.evaluate(() => window.__isle.food.hp());
  await host.waitForFunction(() => { const I = window.__isle; return [...I.net.peers.values()].some((p) => p.cur && Math.hypot(p.cur.x - 82.5, p.cur.z - 92.5) < 0.5); }, null, { timeout: 20000 }).catch(() => {});
  check('a swing hits them', await host.evaluate(() => window.__isle.gear.attack()));
  await guest.waitForFunction((h) => window.__isle.food.hp() < h || window.__isle.death.on(), ghp0, { timeout: 20000 }).catch(() => {});
  check('everyone sees them flash red as they’re hit', await host.waitForFunction(() => window.__isle.gear.peerHurt() > 0, null, { timeout: 20000 }).then(() => true).catch(() => false));
  check('and a spark sword (5 hearts) knocks them out in one go', await guest.evaluate(() => window.__isle.death.on() && /Hana got you with a spark sword/.test(window.__isle.death.cause())), await guest.evaluate(() => [window.__isle.food.hp(), window.__isle.death.cause()]));
  await guest.evaluate(() => window.__isle.death.respawn()); await wait(300);
  await host.keyboard.press('Digit5'); await wait(200);
  // the shield: others see it raised, and a hit from the front bounces off
  await host.evaluate(() => { const I = window.__isle; I.gear.setMats({ wood: 8, stone: 4 }); I.gear.craft('shield'); I.gear.block(true); });
  await guest.evaluate(() => { const I = window.__isle; I.gear.setMats({ wood: 6 }); I.gear.craft('sword_wood'); });
  await guest.keyboard.press('Digit0'); await wait(300);
  if ((await guest.evaluate(() => window.__isle.gear.state().inHand)) !== 'sword_wood') { await guest.keyboard.press('Digit0'); await wait(300); }
  await guest.evaluate(() => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = 82.5; P.y = 13; P.z = 92.5; P.yaw = Math.PI; });
  await host.evaluate(() => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = 82.5; P.y = 13; P.z = 94.5; P.yaw = 0; });
  await guest.waitForFunction(() => window.__isle.gear.peerShield().Hana === 2, null, { timeout: 20000 }).catch(() => {});
  check('others see your shield raised', (await guest.evaluate(() => window.__isle.gear.peerShield().Hana)) === 2, await guest.evaluate(() => window.__isle.gear.peerShield()));
  const hh0 = await host.evaluate(() => window.__isle.food.hp()), hb0 = await host.evaluate(() => window.__isle.gear.blocks());
  await guest.waitForFunction(() => [...window.__isle.net.peers.values()].some((p) => p.cur && Math.hypot(p.cur.x - 82.5, p.cur.z - 94.5) < 0.5), null, { timeout: 20000 }).catch(() => {});
  await guest.evaluate(() => window.__isle.gear.attack());
  await host.waitForFunction((b) => window.__isle.gear.blocks() > b, hb0, { timeout: 20000 }).catch(() => {});
  check('and a sword hit from the front bounces off it', (await host.evaluate(() => window.__isle.gear.blocks())) > hb0 && (await host.evaluate(() => window.__isle.food.hp())) === hh0);
  await host.evaluate(() => window.__isle.gear.block(false)); await guest.keyboard.press('Digit5');
  // bows and arrows: the other player sees the arrow, and it hits them
  await host.evaluate(() => { const I = window.__isle; I.gear.setMats({ wood: 6, stone: 2 }); I.gear.craft('bow'); I.gear.craft('arrows'); });
  for (let k = 0; k < 6 && (await host.evaluate(() => window.__isle.gear.state().inHand)) !== 'bow'; k++) { await host.keyboard.press('Digit0'); await wait(200); }
  await guest.evaluate(() => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = 82.5; P.y = 13; P.z = 86.5; });
  await host.evaluate(() => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = 82.5; P.y = 13; P.z = 96.5; P.yaw = 0; P.pitch = 0.02; });
  await host.waitForFunction(() => [...window.__isle.net.peers.values()].some((p) => p.cur && Math.hypot(p.cur.x - 82.5, p.cur.z - 86.5) < 0.5), null, { timeout: 20000 }).catch(() => {});
  const ah0 = await guest.evaluate(() => window.__isle.food.hp());
  await host.evaluate(() => { window.__isle.gear.bow.hold(1000); window.__isle.gear.bow.release(); });
  await guest.waitForFunction(() => window.__isle.gear.bow.seen() > 0, null, { timeout: 20000 }).catch(() => {});
  check('shoot an arrow and the other player sees it fly', (await guest.evaluate(() => window.__isle.gear.bow.seen())) > 0);
  await guest.waitForFunction((h) => window.__isle.food.hp() < h, ah0, { timeout: 20000 }).catch(() => {});
  check('and it hits them from 10 blocks away', (await guest.evaluate(() => window.__isle.food.hp())) < ah0, [ah0, await guest.evaluate(() => window.__isle.food.hp()), await host.evaluate(() => window.__isle.gear.bow.hits())]);
  // a fire arrow sets them alight, and the host sees them burn
  await guest.evaluate(() => window.__isle.gear.bow.heal());
  await host.evaluate(() => { const I = window.__isle; I.gear.setMats({ wood: 2, stone: 1, coal: 1 }); I.gear.craft('firearrows'); });
  await wait(600);
  const fb0 = await guest.evaluate(() => window.__isle.gear.bow.burnHurt());
  await host.evaluate(() => { window.__isle.gear.bow.hold(1000); window.__isle.gear.bow.release(); });
  await guest.waitForFunction(() => window.__isle.gear.bow.seenFire() > 0, null, { timeout: 20000 }).catch(() => {});
  check('the other player sees a fire arrow fly', (await guest.evaluate(() => window.__isle.gear.bow.seenFire())) > 0);
  await guest.waitForFunction(() => window.__isle.gear.bow.burning(), null, { timeout: 20000 }).catch(() => {});
  check('a fire arrow sets them on fire', await guest.evaluate(() => window.__isle.gear.bow.burning()), await guest.evaluate(() => window.__isle.food.hp()));
  await host.waitForFunction(() => window.__isle.gear.bow.peerBurning(), null, { timeout: 20000 }).catch(() => {});
  check('and the shooter sees them burning', await host.evaluate(() => window.__isle.gear.bow.peerBurning()));
  await guest.waitForFunction((b) => window.__isle.gear.bow.burnHurt() > b, fb0, { timeout: 20000 }).catch(() => {});
  check('burning costs them hearts', (await guest.evaluate(() => window.__isle.gear.bow.burnHurt())) > fb0);
  // spears: the other player sees a thrown spear, and it hits them
  await guest.evaluate(() => window.__isle.gear.bow.heal());
  await host.evaluate(() => { const I = window.__isle; I.gear.setMats({ wood: 4, stone: 1 }); I.gear.craft('spear_stone'); });
  for (let k = 0; k < 12 && (await host.evaluate(() => window.__isle.gear.state().inHand)) !== 'spear_stone'; k++) { await host.keyboard.press('Digit0'); await wait(200); }
  await guest.evaluate(() => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = 82.5; P.y = 13; P.z = 90.5; });
  await host.evaluate(() => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = 82.5; P.y = 13; P.z = 96.5; P.yaw = 0; P.pitch = 0.02; });
  await wait(1500);
  const sh0 = await guest.evaluate(() => window.__isle.food.hp());
  await host.evaluate(() => { window.__isle.gear.spear.hold(1000); window.__isle.gear.spear.release(); });
  await guest.waitForFunction(() => window.__isle.gear.spear.seen() > 0, null, { timeout: 20000 }).catch(() => {});
  check('throw a spear and the other player sees it fly', (await guest.evaluate(() => window.__isle.gear.spear.seen())) > 0);
  await guest.waitForFunction((h) => window.__isle.food.hp() < h, sh0, { timeout: 20000 }).catch(() => {});
  check('and it hits them from 6 blocks away', (await guest.evaluate(() => window.__isle.food.hp())) < sh0, [sh0, await guest.evaluate(() => window.__isle.food.hp())]);
  // throwing knives: seen flying, and they hit
  await guest.evaluate(() => window.__isle.gear.bow.heal());
  await host.evaluate(() => { const I = window.__isle; I.gear.setMats({ wood: 2, stone: 2 }); I.gear.craft('knives'); });
  for (let k = 0; k < 16 && (await host.evaluate(() => window.__isle.gear.state().inHand)) !== 'knives'; k++) { await host.keyboard.press('Digit0'); await wait(200); }
  await host.evaluate(() => { const P = window.__isle.player; P.x = 82.5; P.z = 96.5; P.yaw = 0; P.pitch = 0; P.vx = P.vy = P.vz = 0; });
  await wait(800);
  const kh0 = await guest.evaluate(() => window.__isle.food.hp());
  await host.evaluate(() => window.__isle.gear.knife.throw());
  await guest.waitForFunction(() => window.__isle.gear.knife.seen() > 0, null, { timeout: 20000 }).catch(() => {});
  check('throw a knife and the other player sees it fly', (await guest.evaluate(() => window.__isle.gear.knife.seen())) > 0);
  await guest.waitForFunction((h) => window.__isle.food.hp() < h, kh0, { timeout: 20000 }).catch(() => {});
  check('and it hits them', (await guest.evaluate(() => window.__isle.food.hp())) < kh0, [kh0, await guest.evaluate(() => window.__isle.food.hp())]);
  // grenades: seen flying, and the blast hurts the other player
  await guest.evaluate(() => window.__isle.gear.bow.heal());
  await host.evaluate(() => { const I = window.__isle; I.gear.setMats({ stone: 1, coal: 1 }); I.gear.craft('grenades'); });
  for (let k = 0; k < 18 && (await host.evaluate(() => window.__isle.gear.state().inHand)) !== 'grenades'; k++) { await host.keyboard.press('Digit0'); await wait(200); }
  await host.evaluate(() => { const P = window.__isle.player; P.x = 82.5; P.z = 92.5; P.yaw = 0; P.pitch = -0.6; P.vx = P.vy = P.vz = 0; });
  await wait(800);
  const gg0 = await guest.evaluate(() => window.__isle.food.hp());
  await host.evaluate(() => window.__isle.gear.gren.throw());
  await guest.waitForFunction(() => window.__isle.gear.gren.seen() > 0, null, { timeout: 20000 }).catch(() => {});
  check('lob a grenade and the other player sees it', (await guest.evaluate(() => window.__isle.gear.gren.seen())) > 0);
  await guest.waitForFunction(() => window.__isle.gear.gren.booms() > 0, null, { timeout: 20000 }).catch(() => {});
  check('and sees it go off', (await guest.evaluate(() => window.__isle.gear.gren.booms())) > 0);
  await guest.waitForFunction((h) => window.__isle.food.hp() < h, gg0, { timeout: 20000 }).catch(() => {});
  check('and the blast hurts them', (await guest.evaluate(() => window.__isle.food.hp())) < gg0, [gg0, await guest.evaluate(() => window.__isle.food.hp()), await host.evaluate(() => window.__isle.gear.gren.live())]);
  await guest.evaluate(() => window.__isle.gear.bow.heal()); await host.evaluate(() => window.__isle.gear.bow.heal());
  await guest.evaluate(() => window.__isle.gear.bow.heal());
  await host.keyboard.press('Digit5');
  // the rope: pull someone along, they can untie themselves; /tie yourself to someone
  await host.evaluate(() => { const I = window.__isle; I.gear.setMats({ wood: 4 }); I.gear.craft('rope'); });
  if ((await host.evaluate(() => window.__isle.gear.state().inHand)) !== 'rope') { await host.keyboard.press('Digit0'); await wait(200); }
  if ((await host.evaluate(() => window.__isle.gear.state().inHand)) !== 'rope') { await host.keyboard.press('Digit0'); await wait(200); }
  await guest.evaluate(() => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = 82.5; P.y = 13; P.z = 92.5; });
  await host.evaluate(() => { const P = window.__isle.player; P.fly = false; P.vx = P.vy = P.vz = 0; P.x = 82.5; P.y = 13; P.z = 94.5; P.yaw = 0; });
  await host.waitForFunction(() => [...window.__isle.net.peers.values()].some((p) => p.cur && Math.hypot(p.cur.x - 82.5, p.cur.z - 92.5) < 0.5), null, { timeout: 20000 }).catch(() => {});
  check('hold a rope and right click someone to tie them to you', await host.evaluate(() => window.__isle.rope.use()));
  await guest.waitForFunction(() => window.__isle.rope.tied(), null, { timeout: 20000 }).catch(() => {});
  check('they’re tied on (and everyone sees the rope)', await guest.evaluate(() => window.__isle.rope.tied()) && (await host.evaluate(() => window.__isle.rope.list())).length === 1);
  await host.evaluate(() => { const P = window.__isle.player; P.x = 70.5; P.z = 94.5; });
  await guest.waitForFunction(() => Math.hypot(window.__isle.player.x - 70.5, window.__isle.player.z - 94.5) < 4.5, null, { timeout: 30000 }).catch(() => {});
  check('walk off and they’re pulled along behind you', await guest.evaluate(() => Math.hypot(window.__isle.player.x - 70.5, window.__isle.player.z - 94.5) < 4.5), await guest.evaluate(() => [window.__isle.player.x, window.__isle.player.z]));
  await guest.evaluate(() => window.__isle.toggleBoard());
  await host.waitForFunction(() => window.__isle.rope.list().length === 0, null, { timeout: 20000 }).catch(() => {});
  check('they can press E to untie themselves', !(await guest.evaluate(() => window.__isle.rope.tied())) && (await host.evaluate(() => window.__isle.rope.list())).length === 0);
  check('/tie Hana ties yourself to her instead', await guest.evaluate(() => window.__isle.cmd('/tie Hana')));
  await guest.waitForFunction(() => window.__isle.rope.tied(), null, { timeout: 20000 }).catch(() => {});
  await host.evaluate(() => { const P = window.__isle.player; P.x = 70.5; P.z = 104.5; });
  await guest.waitForFunction(() => Math.hypot(window.__isle.player.x - 70.5, window.__isle.player.z - 104.5) < 4.5, null, { timeout: 30000 }).catch(() => {});
  check('and she pulls you along', await guest.evaluate(() => Math.hypot(window.__isle.player.x - 70.5, window.__isle.player.z - 104.5) < 4.5));
  check('/untie gets you free', await guest.evaluate(() => window.__isle.cmd('/untie')));
  await host.keyboard.press('Digit5'); await wait(200);
  // gifts
  await host.evaluate(() => window.__isle.shop.give(50)); await wait(1700);
  const hc = await host.evaluate(() => window.__isle.shop.coins()), gc = await guest.evaluate(() => window.__isle.shop.coins());
  check('/gift Name 10 gives them coins', await host.evaluate(() => window.__isle.cmd('/gift Gus 10')));
  await guest.waitForFunction((g) => window.__isle.shop.coins() >= g + 10, gc, { timeout: 20000 }).catch(() => {});
  check('they arrive, and leave your purse', (await guest.evaluate(() => window.__isle.shop.coins())) === gc + 10 && (await host.evaluate(() => window.__isle.shop.coins())) === hc - 10);
  await host.evaluate(() => window.__isle.k2.addHat('pirate')); await wait(1700);
  await host.evaluate(() => window.__isle.cmd('/gift Gus hat pirate'));
  await guest.waitForFunction(() => window.__isle.k2.hats().indexOf('pirate') >= 0, null, { timeout: 20000 }).catch(() => {});
  check('you can give a hat too', (await guest.evaluate(() => window.__isle.k2.hats())).indexOf('pirate') >= 0 && (await host.evaluate(() => window.__isle.k2.hats())).indexOf('pirate') < 0);
  // teams
  await host.evaluate(() => window.__isle.cmd('/team red')); await guest.evaluate(() => window.__isle.cmd('/team red')); await wait(1500);
  await host.evaluate(() => window.__isle.cmd('/team base'));
  await guest.waitForFunction(() => { const t = window.__isle.k2.teams(); return t.state.red && t.state.red.base; }, null, { timeout: 20000 }).catch(() => {});
  const gt2 = await guest.evaluate(() => window.__isle.k2.teams());
  check('players join a team and plant its flag; everyone sees the base', gt2.mine === 'red' && gt2.state.red.members.length === 2 && !!gt2.state.red.base && gt2.flags.indexOf('red') >= 0, gt2);
  await guest.evaluate(() => window.__isle.cmd('/team deposit 5'));
  await host.waitForFunction(() => { const t = window.__isle.k2.teams(); return t.state.red && t.state.red.bank === 5; }, null, { timeout: 20000 }).catch(() => {});
  check('the team bank is shared', (await host.evaluate(() => window.__isle.k2.teams().state.red.bank)) === 5);
  const hc2 = await host.evaluate(() => window.__isle.shop.coins());
  await host.evaluate(() => window.__isle.cmd('/team withdraw 3'));
  await host.waitForFunction((c) => window.__isle.shop.coins() === c + 3, hc2, { timeout: 20000 }).catch(() => {});
  check('and any member can take coins out', (await host.evaluate(() => window.__isle.shop.coins())) === hc2 + 3 && (await guest.evaluate(() => window.__isle.k2.teams().state.red.bank)) === 2);
  await host.evaluate(() => window.__isle.cmd('/team withdraw 50')); await wait(1500);
  check('but not more than is in it', (await host.evaluate(() => window.__isle.k2.teams().state.red.bank)) === 2);
  // the racing league
  await host.evaluate(() => window.__isle.k2.setBoatBest(83.4));
  await guest.waitForFunction(() => /Hana/.test(window.__isle.k2.leagueHtml()), null, { timeout: 20000 }).catch(() => {});
  check('the racing league shows the best times in the room', /1:23\.4\s*Hana/.test(await guest.evaluate(() => window.__isle.k2.leagueHtml())), await guest.evaluate(() => window.__isle.k2.leagueHtml()));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await browser.close(); server.close(); process.exit(fails ? 1 : 0);
})();
