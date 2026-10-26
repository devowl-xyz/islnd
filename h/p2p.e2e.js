// Rooms with no game server: the host's browser runs the room and guests connect
// to it peer to peer (PeerJS over WebRTC). Uses a plain static server (no /healthz,
// like GitHub Pages) and a local PeerJS signalling server.
// Run: node h/p2p.e2e.js   (needs Playwright + Chromium, and the peer + peerjs dev packages)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { ExpressPeerServer } = require('peer');
const express = require('express');

const PORT = 18260, SIG = 18261;
const PAGE = 'http://localhost:' + PORT + '/?layout=classic&peerhost=127.0.0.1&peerport=' + SIG + '&peerpath=/';
const PEERJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js';
const PEERJS = fs.readFileSync(require.resolve('peerjs/dist/peerjs.min.js'));
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A static host only: no /healthz and no /ws.
const PUBLIC = path.join(__dirname, '..', 'public');
const stat = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('<h1>404</h1>'); }
    res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' });
    res.end(data);
  });
});

(async () => {
  await new Promise((r) => stat.listen(PORT, r));
  const app = express(), sigSrv = http.createServer(app);
  app.use('/', ExpressPeerServer(sigSrv, { path: '/' }));
  await new Promise((r) => sigSrv.listen(SIG, '127.0.0.1', r));
  await wait(500);
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
  const open = async (name, url) => {
    const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
    page.on('pageerror', (e) => { console.log(name + ' pageerror', e.message); fails++; });
    await page.route(PEERJS_URL, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: PEERJS }));
    await page.goto(url || PAGE);
    await page.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 120000 });
    await page.fill('#nName', name);
    return page;
  };
  const cell = (p, x, y, z) => p.evaluate(([x, y, z]) => window.__isle.get(x, y, z), [x, y, z]);
  const set = (p, x, y, z, b) => p.evaluate(([x, y, z, b]) => window.__isle.setBlock(x, y, z, b), [x, y, z, b]);

  const host = await open('Hana');
  check('the room panel shows with no server', await host.isVisible('#nHost'));
  await host.click('#nHost');
  await host.waitForFunction(() => window.__isle.net.code, null, { timeout: 30000 }).catch(() => {});
  const code = await host.textContent('#nRoomCode');
  check('the host’s browser opens a room: ' + code, /^[A-Z0-9]{5}$/.test(code || ''));
  check('it found there is no server and went peer to peer', await host.evaluate(() => window.__isle.net.ws && !!window.__isle.net.ws.peer));
  // something on the host's island before anyone joins
  await set(host, 80, 13, 90, 8);

  const guest = await open('Gus');
  await guest.fill('#nCode', code.toLowerCase());
  await guest.click('#nJoin');
  await guest.waitForFunction(() => window.__isle.net.code, null, { timeout: 30000 }).catch(() => {});
  check('the guest joins straight to the host’s browser', (await guest.evaluate(() => window.__isle.net.code)) === code);
  await guest.waitForFunction(() => window.__isle.isReady(), null, { timeout: 120000 });
  await guest.waitForFunction(() => window.__isle.get(80, 13, 90) === 8, null, { timeout: 20000 }).catch(() => {});
  check('the guest gets the host’s island', (await cell(guest, 80, 13, 90)) === 8);
  await host.waitForFunction(() => document.getElementById('nPeers').textContent.includes('Gus'), null, { timeout: 10000 }).catch(() => {});
  check('the host sees the guest in the list', (await host.textContent('#nPeers')).includes('Gus'));

  await set(guest, 81, 13, 92, 7);
  await host.waitForFunction(() => window.__isle.get(81, 13, 92) === 7, null, { timeout: 10000 }).catch(() => {});
  check('the guest’s meadow edit reaches the host', (await cell(host, 81, 13, 92)) === 7);
  await set(host, 82, 13, 92, 9);
  await guest.waitForFunction(() => window.__isle.get(82, 13, 92) === 9, null, { timeout: 10000 }).catch(() => {});
  check('the host’s edit reaches the guest', (await cell(guest, 82, 13, 92)) === 9);
  check('the guest can’t build off the meadow', (await set(guest, 40, 31, 40, 7)) === false);
  await guest.evaluate(() => window.__isle.net.ws.send(JSON.stringify({ t: 'edit', x: 40, y: 31, z: 40, b: 7 })));
  await wait(800);
  check('the host’s browser turns down a sneaky off-meadow edit', (await cell(host, 40, 31, 40)) === 0);

  await host.evaluate(() => { const P = window.__isle.player; P.x = 80.5; P.y = 13; P.z = 96.5; });
  await guest.waitForFunction(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.tgt && Math.abs(p.tgt.x - 80.5) < 1 && Math.abs(p.tgt.z - 96.5) < 1) ok = true; }); return ok; }, null, { timeout: 10000 }).catch(() => {});
  check('the guest sees where the host is', await guest.evaluate(() => { let ok = false; window.__isle.net.peers.forEach((p) => { if (p.tgt && Math.abs(p.tgt.x - 80.5) < 1 && Math.abs(p.tgt.z - 96.5) < 1) ok = true; }); return ok; }));

  // a wrong code says so
  const lost = await open('Lou');
  await lost.fill('#nCode', 'ZZZZZ');
  await lost.click('#nJoin');
  await lost.waitForFunction(() => /No room with code ZZZZZ|Could not reach room/.test(document.getElementById('nMsg').textContent), null, { timeout: 30000 }).catch(() => {});
  check('a wrong code says there is no such room', /No room with code ZZZZZ|Could not reach room/.test(await lost.textContent('#nMsg')), await lost.textContent('#nMsg'));
  check('and does not join', !(await lost.evaluate(() => window.__isle.net.code)));

  // host leaves: the room closes for the guest
  await host.evaluate(() => document.getElementById('nLeave').click());
  await guest.waitForFunction(() => !window.__isle.net.code, null, { timeout: 15000 }).catch(() => {});
  check('when the host leaves, the guest is told the room closed', !(await guest.evaluate(() => window.__isle.net.code)) && /host left|Lost the connection/.test(await guest.textContent('#nMsg')), await guest.textContent('#nMsg'));

  // the host can open another room right away
  await host.click('#nHost');
  await host.waitForFunction(() => window.__isle.net.code, null, { timeout: 30000 }).catch(() => {});
  check('the host can open a new room after', /^[A-Z0-9]{5}$/.test((await host.evaluate(() => window.__isle.net.code)) || ''));

  await browser.close();
  stat.close();
  sigSrv.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
