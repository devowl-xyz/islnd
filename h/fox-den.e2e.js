// The fox den: under Rusty's home, joined to the owls' lab annex. Only owl owners who have recruited Rusty can open its
// three hidden doors or step into it. Run: NODE_PATH=/opt/node-tools/node_modules node h/fox-den.e2e.js
const { chromium } = require('playwright');
const { server } = require('../server.js');

const PORT = 18182, URL = 'http://localhost:' + PORT + '/?layout=classic';
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
  page.on('pageerror', (e) => { console.log('pageerror', e.message); fails++; });
  await page.goto(URL);
  await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
  const a = page;
  await a.evaluate(() => { if (!document.getElementById('overlay').classList.contains('hidden')) document.getElementById('play').click(); });
  await wait(900);
  await a.evaluate(() => window.__isle.fox.reset());
  // place the player (feet at x,y,z) with the owl skin, not yet recruited
  const at = (x, y, z, pet) => a.evaluate(([x, y, z, pet]) => { const I = window.__isle; I.setSkin({ pet: pet }); I.player.fly = false; I.player.x = x; I.player.y = y; I.player.z = z; I.player.vx = I.player.vy = I.player.vz = 0; }, [x, y, z, pet]);
  const state = (k) => a.evaluate((k) => window.__isle.fox.den[k === 'built' ? 'built' : 'door'](k === 'built' ? undefined : k), k);
  const door = (k) => a.evaluate((k) => window.__isle.fox.den.door(k), k);
  const blocked = (x, y, z) => a.evaluate(([x, y, z]) => window.__isle.fox.den.blocked(x, y, z), [x, y, z]);
  const here = (x, y, z) => a.evaluate(([x, y, z]) => window.__isle.fox.den.here(x, y, z), [x, y, z]);
  const cell = (x, y, z) => a.evaluate(([x, y, z]) => window.__isle.fox.den.cell(x, y, z), [x, y, z]);

  check('the den is built under Rusty’s home', await a.evaluate(() => window.__isle.fox.den.built()));
  check('its hatch is shut at first (a grass-cover block, not air)', (await cell(52, 13, 253)) !== 0, await cell(52, 13, 253));

  // owl owner who hasn't recruited Rusty: the hatch stays shut and the den keeps them out
  await at(52.5, 14, 254.5, 'hoot');
  await wait(1500);
  check('before recruiting, the hatch stays shut for the owl', (await door(0)) === false, await door(0));
  check('before recruiting, the den keeps the owl out', await blocked(47.5, 2, 243.5));

  // recruit Rusty, then the owl can open the doors
  await a.evaluate(() => window.__isle.fox.recruit());
  await at(52.5, 14, 254.5, 'hoot');
  await wait(1500);
  check('recruited, the owl opens the hatch', (await door(0)) === true, await door(0));
  check('the hatch cell is now air', (await cell(52, 13, 253)) === 0, await cell(52, 13, 253));

  // step down through the hatch into the den
  await a.evaluate(() => { const I = window.__isle; I.player.x = 52.5; I.player.y = 13; I.player.z = 253.5; });
  await wait(1200);
  await a.evaluate(() => { const I = window.__isle; I.player.x = 47.5; I.player.y = 2.2; I.player.z = 243.5; });
  await wait(900);
  check('recruited, the owl can walk into the den', await here(47, 2, 243), await here(47, 2, 243));
  check('the den is open to the owl', !(await blocked(47.5, 2, 243.5)));

  // a non-owner at the hatch: the door stays shut and the den keeps them out
  await at(52.5, 14, 254.5, 'horse');
  await wait(1500);
  check('a non-owner does not open the hatch', (await door(0)) === false, await door(0));
  check('a non-owner is kept out of the den', await blocked(47.5, 2, 243.5));

  // the west panel and the annex plug open for a recruited owl
  await at(39.5, 2.5, 242.5, 'hoot');
  await wait(1500);
  check('the west panel opens for a recruited owl', (await door(1)) === true, await door(1));
  await at(44.5, 2.5, 221.5, 'hoot');
  await wait(1500);
  check('the annex plug opens for a recruited owl', (await door(2)) === true, await door(2));

  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
