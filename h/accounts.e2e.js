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
  for (const p of [d2, e]) await p.context().close();
  // ----- with Supabase: a stand-in for its Auth and REST APIs, with the same row-level rule (only your own save) -----
  const SB = 'https://fake.supabase.test', users = new Map(), saves = new Map(), tokens = new Map(), refreshes = new Map();
  let seq = 0;
  const reply = (r, status, body) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: body === undefined ? '' : JSON.stringify(body) });
  const session = (u) => { const a = 'tok' + (++seq), f = 'ref' + seq; tokens.set(a, u.id); refreshes.set(f, u.id); return { access_token: a, refresh_token: f, token_type: 'bearer', expires_in: 3600, user: { id: u.id, user_metadata: { username: u.name } } }; };
  const sbRoute = async (r) => {
    const q = r.request(), url = new globalThis.URL(q.url()), h = q.headers();
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (h.apikey !== 'anon-key') return reply(r, 401, { message: 'No API key found in request' });
    const body = q.postData() ? JSON.parse(q.postData()) : {};
    if (url.pathname === '/auth/v1/signup') {
      if (users.has(body.email)) return reply(r, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      const u = { id: 'u-' + users.size + '-0000', email: body.email, pass: body.password, name: body.data && body.data.username };
      users.set(body.email, u); return reply(r, 200, session(u));
    }
    if (url.pathname === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'password') { const u = users.get(body.email); if (!u || u.pass !== body.password) return reply(r, 400, { error: 'invalid_grant', error_code: 'invalid_credentials', error_description: 'Invalid login credentials' }); return reply(r, 200, session(u)); }
      const id = refreshes.get(body.refresh_token); if (!id) return reply(r, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
      refreshes.delete(body.refresh_token); return reply(r, 200, session([...users.values()].find((u) => u.id === id)));
    }
    if (url.pathname === '/auth/v1/logout') return reply(r, 204);
    if (url.pathname === '/rest/v1/islnd_saves') {
      const uid = tokens.get(String(h.authorization || '').replace(/^Bearer /, ''));
      if (!uid) return reply(r, 401, { code: 'PGRST301', message: 'JWT expired' });
      if (q.method() === 'GET') { const want = (url.searchParams.get('user_id') || '').replace(/^eq\./, ''); return reply(r, 200, want === uid && saves.has(uid) ? [saves.get(uid)] : []); }
      if (body.user_id !== uid) return reply(r, 403, { code: '42501', message: 'new row violates row-level security policy for table "islnd_saves"' });
      saves.set(uid, body); return reply(r, 201);
    }
    return reply(r, 404, { message: 'not found' });
  };
  const sbOpen = () => open('https://islnd.test/?layout=classic', async (page) => {
    await page.route('https://islnd.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
    await page.route(SB + '/**', sbRoute);
    await page.addInitScript((u) => { window.ISLND_SUPABASE = { url: u, key: 'anon-key' }; }, SB);
  });
  const s1 = await sbOpen();
  check('with Supabase set up, accounts use Supabase', (await s1.evaluate(() => window.__isle.acct.state().mode)) === 'supabase');
  const sr = await s1.evaluate(() => window.__isle.acct.register('Hana_B', 'secret12'));
  check('make an account on Supabase (its Auth keeps the password)', sr === true && [...users.values()].some((u) => u.email === 'hana_b@players.islnd.game' && u.name === 'Hana_B'), sr);
  check('and your save goes in your own row of islnd_saves, squashed', saves.size === 1 && [...saves.values()][0].username === 'Hana_B' && [...saves.values()][0].z === 'gz');
  check('the same username can’t be taken twice', /taken/.test(await s1.evaluate(() => window.__isle.acct.register('hana_b', 'other123'))));
  await s1.evaluate(() => window.__isle.shop.give(63)); await wait(500);
  const sc = await s1.evaluate(() => window.__isle.shop.coins());
  tokens.clear();
  check('an expired login renews itself when saving', (await s1.evaluate(() => window.__isle.acct.save())) === true && tokens.size > 0);
  const s2 = await sbOpen();
  check('a wrong password is refused', /Wrong username or password/.test(await s2.evaluate(() => window.__isle.acct.login('Hana_B', 'nope1234'))));
  await s2.evaluate(() => { window.__isle.acct.login('hana_b', 'secret12'); });
  await s2.waitForNavigation({ timeout: 60000 }).catch(() => {}); await ready(s2); await wait(800);
  check('log in on another device and your progress comes back from Supabase', (await s2.evaluate(() => window.__isle.shop.coins())) === sc && (await s2.evaluate(() => window.__isle.acct.state().user)) === 'Hana_B', await s2.evaluate(() => window.__isle.shop.coins()));
  await s2.evaluate(() => window.__isle.acct.logout());
  const r2 = await s2.evaluate(() => window.__isle.acct.register('gus_b', 'hunter22'));
  check('a second player gets their own row, and can’t read the first player’s', r2 === true && saves.size === 2 && (await s2.evaluate(async (u) => { const r = await fetch(u + '/rest/v1/islnd_saves?select=data&user_id=eq.u-0-0000', { headers: { apikey: 'anon-key', Authorization: 'Bearer ' + JSON.parse(localStorage.getItem('islnd-account')).token } }); return (await r.json()).length; }, SB)) === 0);
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  await browser.close(); server.close(); process.exit(fails ? 1 : 0);
})();
