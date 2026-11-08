'use strict';
/*
  Voxel Isle room server.
  Serves public/ over HTTP and runs rooms over a WebSocket at /ws.
  The server is the authority: it checks every edit against the sender's role
  and the field rule, keeps the room's edit list, and sends it to new joiners.
  The room rules live in public/hub.js, which a host's browser also uses to run
  a room without any server.
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { createHub } = require('./public/hub.js');
const { receive, leave, newPeer, rooms, onField } = createHub();

/* ---------- HTTP static server ---------- */
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
/* ---------- accounts ----------
   Usernames and passwords (scrypt-hashed, never stored as typed), each with the player's saved progress: their
   browser's voxel-isle-* keys. Kept in a JSON file (ACCOUNTS_FILE, or data/accounts.json). A login gives a
   random token the browser keeps; the token saves and loads. */
const crypto = require('crypto');
const ACC_FILE = process.env.ACCOUNTS_FILE || path.join(__dirname, 'data', 'accounts.json');
let accts = { users: {}, tokens: {} };
try { const q = JSON.parse(fs.readFileSync(ACC_FILE, 'utf8')); if (q && q.users) accts = { users: q.users, tokens: q.tokens || {} }; } catch (e) { /* no accounts yet */ }
let accTimer = null;
function accStore() {
  clearTimeout(accTimer);
  accTimer = setTimeout(() => { fs.mkdir(path.dirname(ACC_FILE), { recursive: true }, () => { fs.writeFile(ACC_FILE + '.tmp', JSON.stringify(accts), (err) => { if (!err) fs.rename(ACC_FILE + '.tmp', ACC_FILE, () => {}); }); }); }, 300);
}
const accTries = new Map();
function accLimited(ip) {
  const now = Date.now(), q = (accTries.get(ip) || []).filter((t) => now - t < 60000);
  q.push(now); accTries.set(ip, q);
  return q.length > 20;
}
function accHash(pass, salt) { return crypto.scryptSync(String(pass), salt, 32).toString('hex'); }
function accToken(user) { const t = crypto.randomBytes(24).toString('hex'); accts.tokens[t] = user; return t; }
function accReply(res, code, obj) { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); }
function accHandle(req, res) {
  if (req.method !== 'POST') return accReply(res, 405, { ok: false, error: 'POST only.' });
  let body = '', big = false;
  req.on('data', (c) => { body += c; if (body.length > 6e6) { big = true; req.destroy(); } });
  req.on('end', () => {
    if (big) return;
    let m = null; try { m = JSON.parse(body); } catch (e) { return accReply(res, 400, { ok: false, error: 'Bad request.' }); }
    const act = m && m.act, name = String((m && m.user) || '').trim(), key = name.toLowerCase();
    if (act === 'register' || act === 'login') {
      if (accLimited(req.socket.remoteAddress || '?')) return accReply(res, 429, { ok: false, error: 'Too many tries. Wait a minute.' });
      if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return accReply(res, 400, { ok: false, error: 'Usernames are 3 to 16 letters, numbers or _.' });
      const pass = String(m.pass || '');
      if (pass.length < 6 || pass.length > 72) return accReply(res, 400, { ok: false, error: 'Passwords are 6 to 72 characters.' });
      if (act === 'register') {
        if (accts.users[key]) return accReply(res, 409, { ok: false, error: 'That username is taken.' });
        const salt = crypto.randomBytes(16).toString('hex');
        accts.users[key] = { name, salt, hash: accHash(pass, salt), save: null, created: Date.now() };
        const token = accToken(key); accStore();
        return accReply(res, 200, { ok: true, user: name, token, save: null });
      }
      const u = accts.users[key];
      const ok = !!u && crypto.timingSafeEqual(Buffer.from(accHash(pass, u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
      if (!ok) return accReply(res, 401, { ok: false, error: 'Wrong username or password.' });
      const token = accToken(key); accStore();
      return accReply(res, 200, { ok: true, user: u.name, token, save: u.save });
    }
    const who = accts.tokens[String((m && m.token) || '')], u = who && accts.users[who];
    if (!u) return accReply(res, 401, { ok: false, error: 'Please log in again.' });
    if (act === 'save') {
      const save = m.save;
      if (!save || typeof save !== 'object' || Array.isArray(save)) return accReply(res, 400, { ok: false, error: 'Bad save.' });
      const clean = {};
      for (const k of Object.keys(save)) if (/^voxel-isle[\w-]{0,60}$/.test(k) && typeof save[k] === 'string') clean[k] = save[k];
      u.save = clean; u.savedAt = Date.now(); accStore();
      return accReply(res, 200, { ok: true });
    }
    if (act === 'load') return accReply(res, 200, { ok: true, user: u.name, save: u.save });
    if (act === 'logout') { delete accts.tokens[m.token]; accStore(); return accReply(res, 200, { ok: true }); }
    return accReply(res, 400, { ok: false, error: 'Bad request.' });
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (url.pathname === '/api/account') return accHandle(req, res);
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 });
wss.on('connection', (ws) => {
  const peer = newPeer(ws);
  ws.on('message', (data) => receive(peer, String(data)));
  ws.on('close', () => leave(peer));
});
// Drop dead connections so rooms don't fill with ghosts.
const beat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws._peerDead) return ws.terminate();
    ws._peerDead = true;
    ws.ping();
  });
}, 30000);
wss.on('connection', (ws) => { ws.on('pong', () => { ws._peerDead = false; }); });
wss.on('close', () => clearInterval(beat));

const PORT = parseInt(process.env.PORT, 10) || 8080;
if (require.main === module) {
  server.listen(PORT, () => console.log('Voxel Isle on http://localhost:' + PORT));
}
module.exports = { server, rooms, onField };
