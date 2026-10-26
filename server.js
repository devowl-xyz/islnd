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
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
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
