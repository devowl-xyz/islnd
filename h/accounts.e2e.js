// Accounts in real Chromium pages: on the game server (it keeps them) and on the published page (its own
// database, here a stand-in kept by this test). Create an account, change something, save, then log in from
// a brand-new browser and get it back; wrong passwords and taken usernames are refused.
// Run: node h/accounts.e2e.js   (needs Playwright + Chromium)
const fs = require('fs'), os = require('os'), path = require('path');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'islnd-acct-'));
process.env.ACCOUNTS_FILE = path.join(tmp, 'accounts.json');
const { chromium } = require('playwright');
const { server } = require('../server.js');
const PORT = 18097, URL = 'http://localhost:' + PORT + '/?layout=classic';
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const ready = (p) => p.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 240000 });
  const open = async (url, setup) => {
    const ctx = await browser.newContext({ viewport: { width: 800, height: 500 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { console.log('pageerror', e.message); fails++; });
    if (setup) await setup(page);
    await page.goto(url, { timeout: 180000 }); await ready(page);
    return page;
  };
  // ----- on the game server -----
  const a = await open(URL);
  check('on the game server, accounts use the server', (await a.evaluate(() => window.__isle.acct.state().mode)) === 'server');
  check('usernames and passwords are checked', /Passwords are/.test(await a.evaluate(() => window.__isle.acct.register('hana', '123'))));
  check('create an account', (await a.evaluate(() => window.__isle.acct.register('hana', 'secret12'))) === true && (await a.evaluate(() => window.__isle.acct.state().user)) === 'hana');
  await a.evaluate(() => window.__isle.shop.give(77)); await wait(500);
  const coins = await a.evaluate(() => window.__isle.shop.coins());
  check('Save now keeps your progress on the account', (await a.evaluate(() => window.__isle.acct.save())) === true);
  check('nobody else can take the same username', /taken/.test(await a.evaluate(() => window.__isle.acct.register('Hana', 'other123'))));
  check('the password is stored hashed, never as typed', (() => { const f = JSON.parse(fs.readFileSync(process.env.ACCOUNTS_FILE, 'utf8')); return !!f.users.hana && f.users.hana.hash.length === 64 && !JSON.stringify(f).includes('secret12'); })());
  const b = await open(URL);
  check('a new browser starts from scratch', (await b.evaluate(() => window.__isle.shop.coins())) !== coins);
  check('a wrong password is refused', /Wrong username or password/.test(await b.evaluate(() => window.__isle.acct.login('hana', 'nope1234'))));
  await b.evaluate(() => { window.__isle.acct.login('hana', 'secret12'); });
  await b.waitForNavigation({ timeout: 60000 }).catch(() => {}); await ready(b); await wait(800);
  check('logging in from another browser brings your progress back', (await b.evaluate(() => window.__isle.shop.coins())) === coins && (await b.evaluate(() => window.__isle.acct.state().user)) === 'hana', await b.evaluate(() => window.__isle.shop.coins()));
  await b.evaluate(() => window.__isle.acct.logout());
  check('and you can log out', !(await b.evaluate(() => window.__isle.acct.state().user)));
  // ----- on the published page: its own database (a stand-in here) -----
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8').replace(/^const NET_OK=typeof WebSocket/m, 'const NET_OK=false&&typeof WebSocket');
  const store = new Map();
  const setup = async (page) => {
    await page.route('https://islnd.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
    await page.exposeFunction('__dbGet', (p) => (store.has(p) ? JSON.parse(store.get(p)) : null));
    // like the real one: documents over 256 KiB, and writes by someone who may only view, are refused with invalid_argument
    const big = (d) => Buffer.byteLength(JSON.stringify(d)) > 262144;
    await page.exposeFunction('__dbSet', (p, d, ro) => { if (ro || big(d)) return 'invalid_argument'; store.set(p, JSON.stringify(d)); return true; });
    await page.exposeFunction('__dbUpdate', (p, d, ro) => { if (ro || !store.has(p)) return 'invalid_argument'; const n = Object.assign(JSON.parse(store.get(p)), d); if (big(n)) return 'invalid_argument'; store.set(p, JSON.stringify(n)); return true; });
    await page.addInitScript((ro) => {
      const ok = async (r) => { if (r !== true) throw { code: r, message: r }; };
      const ref = (p) => ({ get: async () => { const v = await window.__dbGet(p); return { exists: v !== null, data: () => v }; }, set: async (d) => ok(await window.__dbSet(p, d, ro)), update: async (d) => ok(await window.__dbUpdate(p, d, ro)) });
      window.claude = { use: async (n) => (n === 'db' ? { doc: ref } : null) };
    }, !!page.__ro);
  };
  const c = await open('https://islnd.test/?layout=classic', setup);
  check('on the published page, accounts use the page’s database', (await c.evaluate(() => window.__isle.acct.state().mode)) === 'db');
  const reg = await c.evaluate(() => window.__isle.acct.register('gus', 'hunter22'));
  check('create an account there', reg === true, reg);
  await c.evaluate(() => window.__isle.shop.give(41)); await wait(500);
  const coins2 = await c.evaluate(() => window.__isle.shop.coins());
  // a big save (lots of building) still fits: it's squashed and split into parts under the database's limit
  await c.evaluate(() => { const a = []; for (let i = 0; i < 160000; i++) a.push((i * 7919) % 100003); localStorage.setItem('voxel-isle-testbig', JSON.stringify(a)); localStorage.setItem('voxel-isle-album', JSON.stringify(['x'.repeat(400000)])); });
  const sv = await c.evaluate(() => window.__isle.acct.save());
  check('a big save fits in the database (squashed and split into small parts)', sv === true && [...store.entries()].filter(([k]) => k.startsWith('islnd_saves/gus~')).every(([, v]) => Buffer.byteLength(v) < 262144), sv);
  check('photos stay on the device and aren’t put in the account', ![...store.values()].some((v) => v.includes('xxxxxxxxxx')));
  check('the password is hashed in the browser before it’s stored', (() => { const d = JSON.parse(store.get('islnd_accounts/gus')); return d.hash.length === 64 && ![...store.values()].some((v) => v.includes('hunter22')); })());
  const d2 = await open('https://islnd.test/?layout=classic', setup);
  check('a wrong password is refused there too', /Wrong username or password/.test(await d2.evaluate(() => window.__isle.acct.login('gus', 'wrong999'))));
  await d2.evaluate(() => localStorage.setItem('voxel-isle-album', '["my-photo"]'));
  await d2.evaluate(() => { window.__isle.acct.login('gus', 'hunter22'); });
  await d2.waitForNavigation({ timeout: 60000 }).catch(() => {}); await ready(d2); await wait(800);
  check('and logging in on another device brings the progress back', (await d2.evaluate(() => window.__isle.shop.coins())) === coins2, await d2.evaluate(() => window.__isle.shop.coins()));
  check('the big save came back whole', (await d2.evaluate(() => { const v = JSON.parse(localStorage.getItem('voxel-isle-testbig') || '[]'); return v.length === 160000 && v[1234] === (1234 * 7919) % 100003; })));
  check('and logging in leaves that device’s own photos alone', (await d2.evaluate(() => localStorage.getItem('voxel-isle-album'))) === '["my-photo"]');
  for (const p of [a, b, c]) await p.context().close();
  // someone the page is shared with to view only can't write to its database: they're told why
  const e = await open('https://islnd.test/?layout=classic', async (page) => { page.__ro = true; await setup(page); });
  const ro = await e.evaluate(() => window.__isle.acct.register('vic', 'viewer99'));
  check('a view-only visitor is told plainly why they can’t make an account', /won’t let you save here/.test(ro) && !(await e.evaluate(() => window.__isle.acct.state().user)), ro);
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await browser.close(); server.close(); process.exit(fails ? 1 : 0);
})();
