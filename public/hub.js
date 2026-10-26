/*
  Voxel Isle room rules, shared by the Node server (server.js) and by a host's
  browser when a room runs without a server (peer-to-peer).
  createHub() gives one hub: its rooms, and handle/leave for its peers.
  A peer's ws only needs readyState (1 = open) and send(string).
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VoxelHub = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
function randomBytes(n) {
  const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
  if (c && c.getRandomValues) return c.getRandomValues(new Uint8Array(n));
  try { return require('crypto').randomBytes(n); } catch (e) { /* fall through */ }
  const a = new Uint8Array(n); for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256); return a;
}
function createHub(opts) {
opts = opts || {};
/* World rules, kept in step with the client (public/index.html). */
const W = 352, D = 352, H = 48;
const FX = 80, FZ = 92, FIELD_R = 24;
const MAX_BLOCK = 45; // 12 is water, 13 to 23 underground blocks, 24 marble, 25 gold, 26 snow, 27-28 bed, 29-32 door, 33-44 colours, 45 ice
// Doors: bottom and top, shut or open. Anyone may open or shut one, even in a building that can't be changed.
const DOOR = 29, DOOR_TOP = 30, DOOR_OPEN = 31, DOOR_TOP_OPEN = 32;
function isDoor(b) { return b >= DOOR && b <= DOOR_TOP_OPEN; }
function doorTop(b) { return b === DOOR_TOP || b === DOOR_TOP_OPEN; }
const VOX = W * H * D;

function onField(x, z) {
  const fd = Math.pow(Math.pow(Math.abs(x - FX), 4) + Math.pow(Math.abs(z - FZ), 4), 0.25);
  return fd <= FIELD_R;
}
function idxOf(x, y, z) { return (y * D + z) * W + x; }
// The meadow's surface layer (y = 12) is fixed for everyone; blocks under it can still be mined.
const FLOOR_Y = 12;
function isFloor(x, y, z) { return y === FLOOR_Y && onField(x, z); }
// The owls' treehouse (same numbers as public/index.html). The frame is fixed for
// everyone; each owl's owner has a bedroom, and both owners share the rest.
const TH = { x0: 32, x1: 56, z0: 74, z1: 98, y0: 14, y1: 41, sx0: 42, sx1: 46, sz0: 96, sz1: 104, sy1: 28 };
const TH_ROOMS = [
  { id: 'hoot', x0: 38, x1: 40, z0: 81, z1: 87, y0: 24, y1: 27 },
  { id: 'snowy', x0: 48, x1: 50, z0: 81, z1: 87, y0: 24, y1: 27 },
  { id: 'shared', x0: 42, x1: 46, z0: 83, z1: 87, y0: 24, y1: 27 },
  { id: 'shared', x0: 38, x1: 50, z0: 88, z1: 91, y0: 24, y1: 27 },
  { id: 'shared', x0: 38, x1: 50, z0: 83, z1: 85, y0: 29, y1: 31 },
  { id: 'shared', x0: 38, x1: 50, z0: 87, z1: 91, y0: 29, y1: 31 }, // the Owl Emporium
  { id: 'shared', x0: 38, x1: 41, z0: 81, z1: 82, y0: 29, y1: 31 },
  { id: 'shared', x0: 46, x1: 50, z0: 81, z1: 82, y0: 29, y1: 31 },
  { id: 'shared', x0: 37, x1: 41, z0: 93, z1: 94, y0: 24, y1: 25 },
  { id: 'shared', x0: 47, x1: 51, z0: 93, z1: 94, y0: 24, y1: 25 },
  { id: 'shared', x0: 35, x1: 36, z0: 77, z1: 79, y0: 24, y1: 25 },
  { id: 'shared', x0: 52, x1: 53, z0: 77, z1: 79, y0: 24, y1: 25 },
  { id: 'shared', x0: 35, x1: 36, z0: 93, z1: 95, y0: 24, y1: 25 },
  { id: 'shared', x0: 52, x1: 53, z0: 93, z1: 95, y0: 24, y1: 25 }
];
// Goldie's house on the sea bed (same numbers as public/index.html): the dome is fixed,
// and only Goldie's owner may change anything inside it.
const AT = { cx: 80, cz: 150, x0: 73, x1: 87, z0: 143, z1: 157, y0: 2, y1: 10 };
function atInside(x, y, z) { const dx = x - AT.cx, dz = z - AT.cz; return y >= 5 && y <= 8 && (dx * dx + dz * dz) / 28.09 + ((y - 5) / 3.9) * ((y - 5) / 3.9) < 1; }
// Biscuit and Mochi's cottage (same numbers as public/index.html): yard, kennel, cat tree and
// cottage frame are fixed; each pet's owner has a bedroom; the living room and gardens are shared.
const COT = { x0: 106, x1: 132, z0: 57, z1: 79, y0: 18, y1: 40 };
const COT_ROOMS = [
  { id: 'biscuit', x0: 117, x1: 128, z0: 62, z1: 66, y0: 24, y1: 27 },
  { id: 'mochi', x0: 117, x1: 128, z0: 70, z1: 74, y0: 24, y1: 27 },
  { id: 'cottage', x0: 117, x1: 128, z0: 62, z1: 67, y0: 19, y1: 22 },
  { id: 'cottage', x0: 117, x1: 128, z0: 69, z1: 74, y0: 19, y1: 22 },
  { id: 'cottage', x0: 117, x1: 119, z0: 68, z1: 68, y0: 19, y1: 22 },
  { id: 'cottage', x0: 125, x1: 128, z0: 68, z1: 68, y0: 19, y1: 22 },
  { id: 'cottage', x0: 116, x1: 129, z0: 59, z1: 60, y0: 19, y1: 21 },
  { id: 'cottage', x0: 116, x1: 129, z0: 76, z1: 77, y0: 19, y1: 21 }
];
// Cinder's den (same numbers as public/index.html): the hall and stairway are fixed, and
// only Cinder's owner may change anything inside the hall.
const DEN = { cx: 85, cz: 132, x0: 78, x1: 92, z0: 116, z1: 138, y0: 1, y1: 17, fy: 2 };
const DEN_PILLARS = [[82, 128], [88, 128], [81, 135], [89, 135]];
function denInside(x, y, z) {
  if (y < DEN.fy + 1 || y > 7) return false;
  if (DEN_PILLARS.some((p) => p[0] === x && p[1] === z)) return false;
  const dx = (x - DEN.cx) / 5.4, dy = (y - 4.5) / 2.7, dz = (z - DEN.cz) / 4.6;
  return dx * dx + dy * dy + dz * dz < 1;
}
// Clover's paddock and the campsite (same numbers as public/index.html) are fixed.
const PADDOCK = { x0: 190, x1: 210, z0: 184, z1: 200, G: 17 };
const CAMP = { x0: 182, x1: 206, z0: 201, z1: 217, G: 17 };
/* Layouts: where the treehouse and the cottage stand (same numbers as public/index.html). */
const SHIFTS = { classic: { th: [0, 0], cot: [0, 0] }, spread: { th: [212, -24], cot: [112, 231] } };
function shiftObj(b, dx, dz) { const t = {}; for (const k in b) { const v = b[k]; t[k] = typeof v !== 'number' ? v : /^(x|sx|cx)/.test(k) ? v + dx : /^(z|sz|cz)/.test(k) ? v + dz : v; } return t; }
const LAYOUTS = {};
for (const name in SHIFTS) {
  const [tx, tz] = SHIFTS[name].th, [cx, cz] = SHIFTS[name].cot;
  LAYOUTS[name] = { TH: shiftObj(TH, tx, tz), TH_ROOMS: TH_ROOMS.map((r) => shiftObj(r, tx, tz)), COT: shiftObj(COT, cx, cz), COT_ROOMS: COT_ROOMS.map((r) => shiftObj(r, cx, cz)) };
}
function thCell(x, y, z, L) {
  L = L || LAYOUTS.spread;
  const TH = L.TH, TH_ROOMS = L.TH_ROOMS, COT = L.COT, COT_ROOMS = L.COT_ROOMS;
  if (x >= PADDOCK.x0 && x <= PADDOCK.x1 && z >= PADDOCK.z0 && z <= PADDOCK.z1 && y >= PADDOCK.G - 1 && y <= PADDOCK.G + 5) return 'base';
  if (x >= CAMP.x0 && x <= CAMP.x1 && z >= CAMP.z0 && z <= CAMP.z1 && y >= CAMP.G - 1 && y <= CAMP.G + 4) return 'base';
  if (x >= DEN.x0 && x <= DEN.x1 && z >= DEN.z0 && z <= DEN.z1 && y >= DEN.y0 && y <= DEN.y1) return denInside(x, y, z) ? 'cinder' : 'base';
  if (x >= COT.x0 && x <= COT.x1 && z >= COT.z0 && z <= COT.z1 && y >= COT.y0 && y <= COT.y1) {
    for (const r of COT_ROOMS) if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1 && z >= r.z0 && z <= r.z1) return r.id;
    return 'base';
  }
  if (x >= AT.x0 && x <= AT.x1 && z >= AT.z0 && z <= AT.z1 && y >= AT.y0 && y <= AT.y1) return atInside(x, y, z) ? 'goldie' : 'base';
  for (const r of TH_ROOMS) if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1 && z >= r.z0 && z <= r.z1) return r.id;
  if (x >= TH.x0 && x <= TH.x1 && z >= TH.z0 && z <= TH.z1 && y >= TH.y0 && y <= TH.y1) return 'base';
  if (x >= TH.sx0 && x <= TH.sx1 && z >= TH.sz0 && z <= TH.sz1 && y >= TH.y0 && y <= TH.sy1) return 'base';
  return null;
}
function thMay(id, pet) {
  if (id === 'shared') return pet === 'hoot' || pet === 'snowy';
  if (id === 'cottage') return pet === 'biscuit' || pet === 'mochi';
  return pet === id;
}
function thBaseIdx(i, L) { return thCell(i % W, Math.floor(i / (W * D)), Math.floor(i / W) % D, L) === 'base'; }
// The cottage's doors (its front door and the two bedroom doors), in classic numbers, shut as built.
const COT_DOORS = [[116, 19, 68, DOOR], [116, 20, 68, DOOR_TOP], [126, 24, 67, DOOR], [126, 25, 67, DOOR_TOP], [126, 24, 69, DOOR], [126, 25, 69, DOOR_TOP]];
function baseDoor(x, y, z, L) {
  const dx = L.COT.x0 - COT.x0, dz = L.COT.z0 - COT.z0;
  for (const d of COT_DOORS) if (d[0] + dx === x && d[1] === y && d[2] + dz === z) return d[3];
  return null;
}
function keepEdit(i, b, L) {
  if (!thBaseIdx(i, L)) return true;
  return isDoor(b) && baseDoor(i % W, Math.floor(i / (W * D)), Math.floor(i / W) % D, L) !== null;
}
function isFloorIdx(i) { return Math.floor(i / (W * D)) === FLOOR_Y && onField(i % W, Math.floor(i / W) % D); }

const SNAP_CHUNK = 3000;        // pairs per snapshot message
const MAX_PLAYERS = 16;
const MAX_ROOMS = 200;
const EDIT_RATE = 25, EDIT_BURST = 60; // per player, tokens per second
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const rooms = new Map(); // code -> room

function makeCode() {
  for (let tries = 0; tries < 50; tries++) {
    let c = '';
    const bytes = randomBytes(5);
    for (let i = 0; i < 5; i++) c += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    if (!rooms.has(c)) return c;
  }
  return null;
}
function cleanName(s) {
  s = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 16);
  return s || 'Player';
}
/* Skins are a few colours and style names; anything else is dropped. */
const SKIN_COLORS = ['skin', 'hair', 'shirt', 'pants', 'shoes', 'hat', 'rod'];
const SKIN_STYLES = {
  kind: ['person', 'rod'],
  hairStyle: ['short', 'long', 'none'], face: ['eyes', 'smile', 'visor'], hatStyle: ['none', 'cap', 'beanie', 'crown'],
  headWrap: ['front', 'all'],
  rodStyle: ['pillars', 'swirl', 'tendrils', 'legs'],
  effect: ['none', 'embers', 'wind', 'bubbles', 'sparkles', 'smoke'],
  pet: ['none', 'hoot', 'snowy', 'goldie', 'biscuit', 'mochi', 'cinder', 'horse']
};
const HEX6 = /^#[0-9a-f]{6}$/i, PX256 = /^[0-9a-f]{256}$/;
function cleanSkin(raw) {
  const o = {};
  if (!raw || typeof raw !== 'object') return o;
  SKIN_COLORS.forEach((k) => { if (typeof raw[k] === 'string' && HEX6.test(raw[k])) o[k] = raw[k].toLowerCase(); });
  Object.keys(SKIN_STYLES).forEach((k) => { if (SKIN_STYLES[k].includes(raw[k])) o[k] = raw[k]; });
  // Painted heads: 16 palette colours and one hex digit per pixel.
  if (Array.isArray(raw.headPal) && raw.headPal.length === 16 && raw.headPal.every((c) => typeof c === 'string' && HEX6.test(c))) o.headPal = raw.headPal.map((c) => c.toLowerCase());
  if (typeof raw.headPx === 'string' && PX256.test(raw.headPx)) o.headPx = raw.headPx;
  return o;
}
/* each pet can follow only one player in a room */
function claimPet(room, peer) {
  const k = peer.skin;
  if (!room || !k.pet || k.pet === 'none') return;
  let taken = false;
  room.peers.forEach((p) => { if (p.id !== peer.id && p.skin && p.skin.pet === k.pet) taken = true; });
  if (taken) { send(peer.ws, { t: 'petNo', pet: k.pet }); k.pet = 'none'; }
}
function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function broadcast(room, msg, exceptId) {
  const s = JSON.stringify(msg);
  room.peers.forEach((p) => { if (p.id !== exceptId && p.ws.readyState === 1) p.ws.send(s); });
}
function peerList(room) {
  const a = [];
  room.peers.forEach((p) => a.push({ id: p.id, name: p.name, host: p.id === room.hostId, admin: p.admin, skin: p.skin, food: !!p.food }));
  return a;
}
function canEditAt(room, peer, x, z) {
  return peer.id === room.hostId || peer.admin || onField(x, z);
}
function sendSnapshot(room, peer) {
  const flat = [];
  room.edits.forEach((b, i) => { flat.push(i, b); });
  const parts = Math.max(1, Math.ceil(flat.length / (SNAP_CHUNK * 2)));
  for (let k = 0; k < parts; k++) {
    send(peer.ws, { t: 'snap', part: k, parts, edits: flat.slice(k * SNAP_CHUNK * 2, (k + 1) * SNAP_CHUNK * 2) });
  }
  room.peers.forEach((p) => {
    if (p.id !== peer.id && p.pos) send(peer.ws, Object.assign({ t: 'pos', id: p.id }, p.pos));
  });
}
function closeRoom(room, reason) {
  rooms.delete(room.code);
  room.peers.forEach((p) => {
    p.room = null;
    send(p.ws, { t: 'closed', reason });
  });
  room.peers.clear();
}
/* the island jet: one pilot (host or admin) and up to four passengers; anyone can call it to a dock */
const JET_DOCKS = 4;
function jetSeats(room) { broadcast(room, { t: 'jetSeats', pilot: room.jet.pilot, pass: room.jet.pass }); }
function unboard(room, peer) {
  const j = room.jet;
  if (j.pilot === peer.id) {
    j.pilot = null;
    const l = j.last || { x: 0, y: 30, z: 0, h: 0 };
    j.release = { x: l.x, y: l.y, z: l.z, h: l.h, at: Date.now() };
    j.call = null;
    broadcast(room, Object.assign({ t: 'jetRelease' }, j.release));
  } else if (j.pass.includes(peer.id)) {
    j.pass = j.pass.filter((id) => id !== peer.id);
  } else return;
  jetSeats(room);
}
function leave(peer) {
  const room = peer.room;
  if (!room) return;
  unboard(room, peer);
  peer.room = null;
  room.peers.delete(peer.id);
  if (peer.id === room.hostId) { if (room.tagTimer) clearTimeout(room.tagTimer); closeRoom(room, 'The host left, so the room closed.'); return; }
  broadcast(room, { t: 'left', id: peer.id, name: peer.name });
  // whoever was it in tag left: pass it to someone else, or stop if too few are left
  if (room.tag && room.tag.it === peer.id) {
    if (room.peers.size < 2) endTag(room);
    else { const ids = [...room.peers.keys()]; room.tag.it = ids[Math.floor(Math.random() * ids.length)]; room.tag.since = Date.now(); room.tag.last = null; tagNews(room); }
  }
}
/* tag: one player is it; touching someone passes it on; least time as it wins */
const TAG_MS = 120000;
function tagNews(room, by) { const t = room.tag; broadcast(room, { t: 'tag', it: t.it, ends: t.ends, scores: t.scores, by: by || null }); }
function endTag(room) {
  const t = room.tag; if (!t) return;
  if (room.tagTimer) clearTimeout(room.tagTimer); room.tagTimer = null;
  t.scores[t.it] = (t.scores[t.it] || 0) + (Date.now() - t.since) / 1000;
  room.tag = null;
  broadcast(room, { t: 'tagEnd', scores: t.scores });
}

/* Validate and apply a list of [idx, b] pairs that the host seeds a new room with. */
function seedEdits(room, arr) {
  if (!Array.isArray(arr)) return;
  for (let k = 0; k + 1 < arr.length; k += 2) {
    const i = arr[k], b = arr[k + 1];
    if (Number.isInteger(i) && i >= 0 && i < VOX && Number.isInteger(b) && b >= 0 && b <= MAX_BLOCK && !isFloorIdx(i) && keepEdit(i, b, room.lay)) room.edits.set(i, b);
  }
}

let nextId = 1;
function handle(peer, msg) {
  if (!msg || typeof msg.t !== 'string') return;
  const room = peer.room;
  switch (msg.t) {
    case 'host': {
      if (room) return;
      if (rooms.size >= MAX_ROOMS) return send(peer.ws, { t: 'error', msg: 'The server is full right now. Try again soon.' });
      // In a room run by the host's own browser, the host picks the code (it is also the host's address).
      const want = String(msg.code || '').toUpperCase();
      const code = opts.hostCode && /^[A-Z0-9]{5}$/.test(want) && !rooms.has(want) ? want : makeCode();
      if (!code) return send(peer.ws, { t: 'error', msg: 'Could not make a room code.' });
      peer.name = cleanName(msg.name);
      peer.skin = cleanSkin(msg.skin);
      peer.admin = false;
      const r = { code, hostId: peer.id, peers: new Map(), edits: new Map(), seeding: true, jet: { pilot: null, pass: [], last: null, release: null, call: null } };
      r.layout = LAYOUTS[msg.layout] ? msg.layout : 'spread'; r.lay = LAYOUTS[r.layout];
      r.peers.set(peer.id, peer);
      rooms.set(code, r);
      peer.room = r;
      send(peer.ws, { t: 'hosted', code, you: peer.id, peers: peerList(r), now: Date.now(), jet: r.jet, layout: r.layout });
      return;
    }
    case 'seed': {
      // Host uploads its island's existing edits, in parts, right after hosting.
      if (!room || peer.id !== room.hostId || !room.seeding) return;
      seedEdits(room, msg.edits);
      if (msg.last) room.seeding = false;
      return;
    }
    case 'join': {
      if (room) return;
      const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const r = rooms.get(code);
      if (!r) return send(peer.ws, { t: 'error', msg: 'No room with code ' + (code || '(blank)') + '.' });
      if (r.peers.size >= MAX_PLAYERS) return send(peer.ws, { t: 'error', msg: 'That room is full.' });
      peer.name = cleanName(msg.name);
      peer.skin = cleanSkin(msg.skin);
      peer.admin = false;
      peer.pos = null;
      claimPet(r, peer);
      r.peers.set(peer.id, peer);
      peer.room = r;
      send(peer.ws, { t: 'joined', code, you: peer.id, peers: peerList(r), now: Date.now(), jet: r.jet, layout: r.layout, tag: r.tag ? { it: r.tag.it, ends: r.tag.ends, scores: r.tag.scores } : null });
      if (r.tag) r.tag.scores[peer.id] = r.tag.scores[peer.id] || 0;
      sendSnapshot(r, peer);
      broadcast(r, { t: 'peer', id: peer.id, name: peer.name, host: false, admin: false, skin: peer.skin }, peer.id);
      return;
    }
    case 'leave': {
      leave(peer);
      send(peer.ws, { t: 'closed', reason: null });
      return;
    }
    case 'edit': {
      if (!room) return;
      const { x, y, z, b } = msg;
      if (![x, y, z, b].every(Number.isInteger)) return;
      if (x < 0 || z < 0 || x >= W || z >= D || y < 0 || y >= H || b < 0 || b > MAX_BLOCK) return;
      const i = idxOf(x, y, z);
      const now = Date.now();
      peer.tokens = Math.min(EDIT_BURST, peer.tokens + (now - peer.tokT) / 1000 * EDIT_RATE);
      peer.tokT = now;
      const floor = isFloor(x, y, z);
      const th = thCell(x, y, z, room.lay), thOk = !!th && th !== 'base' && thMay(th, peer.skin && peer.skin.pet);
      // opening or shutting a door is not building: anyone may, anywhere, as long as it stays the same half of a door
      const was = room.edits.has(i) ? room.edits.get(i) : baseDoor(x, y, z, room.lay);
      const door = isDoor(b) && isDoor(was) && doorTop(b) === doorTop(was);
      const ok = peer.tokens >= 1 && (door || (!floor && th !== 'base' && (th ? thOk : canEditAt(room, peer, x, z)) && !(b === 0 && y < 1)));
      if (!ok) {
        // Tell the sender what the cell really holds so it can undo its guess.
        const cur = room.edits.has(i) ? room.edits.get(i) : null;
        send(peer.ws, { t: 'revert', i, b: cur, why: peer.tokens < 1 ? 'rate' : (floor ? 'floor' : (th === 'base' ? 'tree' : (th ? 'owl' : 'perm'))) });
        return;
      }
      peer.tokens -= 1;
      room.edits.set(i, b);
      broadcast(room, { t: 'edit', x, y, z, b, by: peer.id });
      return;
    }
    case 'role': {
      if (!room || peer.id !== room.hostId) return;
      const target = room.peers.get(msg.peer);
      if (!target || target.id === room.hostId) return;
      target.admin = !!msg.admin;
      broadcast(room, { t: 'role', peer: target.id, admin: target.admin });
      if (!target.admin && room.jet.pilot === target.id) unboard(room, target);
      return;
    }
    case 'skin': {
      if (!room) return;
      const now = Date.now();
      if (now - (peer.skinT || 0) < 200) return; // ignore floods; clients send at most every 250 ms
      peer.skinT = now;
      peer.skin = cleanSkin(msg.skin);
      claimPet(room, peer);
      if (peer.food && peer.skin.pet !== 'biscuit' && peer.skin.pet !== 'mochi') { peer.food = false; broadcast(room, { t: 'form', id: peer.id, food: false }, peer.id); }
      broadcast(room, { t: 'skin', id: peer.id, skin: peer.skin }, peer.id);
      return;
    }
    case 'board': {
      if (!room) return;
      const j = room.jet;
      if (j.pilot === peer.id || j.pass.includes(peer.id)) return;
      const may = peer.id === room.hostId || peer.admin;
      if (msg.seat === 'pilot' && may && j.pilot === null) { j.pilot = peer.id; j.release = null; j.call = null; j.last = null; }
      else if (msg.seat === 'pilot' && !may) return send(peer.ws, { t: 'boardNo', why: 'admin' });
      else if (j.pass.length < 4) j.pass.push(peer.id);
      else return send(peer.ws, { t: 'boardNo', why: 'full' });
      jetSeats(room);
      return;
    }
    case 'chat': {
      // a line of chat, shown over the speaker's head; short, plain text, not too often
      if (!room || typeof msg.text !== 'string') return;
      const text = msg.text.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
      const now = Date.now();
      if (!text || now - (peer.chatT || 0) < 700) return;
      peer.chatT = now;
      broadcast(room, { t: 'chat', id: peer.id, name: peer.name, text });
      return;
    }
    case 'tagStart': {
      if (!room || peer.id !== room.hostId || room.tag || room.peers.size < 2) return;
      const ids = [...room.peers.keys()], now = Date.now(), scores = {};
      ids.forEach((id) => { scores[id] = 0; });
      room.tag = { it: ids[Math.floor(Math.random() * ids.length)], since: now, ends: now + TAG_MS, scores, last: null };
      room.tagTimer = setTimeout(() => endTag(room), TAG_MS);
      tagNews(room);
      return;
    }
    case 'tagStop': {
      if (room && peer.id === room.hostId) endTag(room);
      return;
    }
    case 'tagged': {
      // only whoever is it can tag, only someone close by, and no tagging straight back
      if (!room || !room.tag || room.tag.it !== peer.id) return;
      const t = room.tag, target = room.peers.get(msg.target), now = Date.now();
      if (!target || target === peer || now - t.since < 1500) return;
      if (t.last === target.id && now - t.since < 3000) return;
      if (peer.pos && target.pos && Math.hypot(peer.pos.x - target.pos.x, peer.pos.z - target.pos.z) > 3.5) return;
      t.scores[peer.id] = (t.scores[peer.id] || 0) + (now - t.since) / 1000;
      t.last = peer.id; t.it = target.id; t.since = now;
      tagNews(room, peer.id);
      return;
    }
    case 'race': {
      // the host starts a race to the campsite for everyone, five seconds from now
      if (!room || peer.id !== room.hostId) return;
      const now = Date.now();
      if (room.race && now < room.race.start + 360000) return;
      room.race = { start: now + 5000, done: [] };
      broadcast(room, { t: 'race', start: room.race.start });
      return;
    }
    case 'raceDone': {
      if (!room || !room.race) return;
      const r = room.race, now = Date.now(), time = Number(msg.time);
      if (!isFinite(time) || time < 15 || time > 600 || r.done.some((d) => d.id === peer.id)) return;
      if ((now - r.start) / 1000 < time - 2) return;
      r.done.push({ id: peer.id, name: peer.name, time });
      broadcast(room, { t: 'raceResult', id: peer.id, name: peer.name, time, place: r.done.length });
      return;
    }
    case 'hold': {
      // the host or an admin keeps the jet waiting at the dock it's at
      if (!room || !(peer.id === room.hostId || peer.admin)) return;
      const j = room.jet, n = (v) => (typeof v === 'number' && isFinite(v) ? Math.max(-1000, Math.min(1000, Math.round(v * 100) / 100)) : 0);
      if (j.pilot !== null || !Number.isInteger(msg.dock) || msg.dock < 0 || msg.dock >= JET_DOCKS) return;
      j.call = { dock: msg.dock, x: n(msg.x), y: n(msg.y), z: n(msg.z), h: n(msg.h), at: Date.now(), by: peer.id, hold: true };
      j.release = null;
      broadcast(room, Object.assign({ t: 'jetCall' }, j.call));
      return;
    }
    case 'form': {
      // Biscuit or Mochi turning into food (or back), on their owner's say
      if (!room) return;
      const k = peer.skin && peer.skin.pet;
      peer.food = !!msg.food && (k === 'biscuit' || k === 'mochi');
      broadcast(room, { t: 'form', id: peer.id, food: peer.food }, peer.id);
      return;
    }
    case 'eat': {
      // someone tries to eat a pet that is food: it turns back and chases them
      if (!room) return;
      const owner = room.peers.get(msg.owner);
      if (!owner || !owner.food) return;
      const k = owner.skin && owner.skin.pet;
      if (k !== 'biscuit' && k !== 'mochi') return;
      if (owner !== peer && peer.pos && owner.pos && Math.hypot(peer.pos.x - owner.pos.x, peer.pos.z - owner.pos.z) > 16) return;
      owner.food = false;
      broadcast(room, { t: 'eat', by: peer.id, owner: owner.id, pet: k });
      return;
    }
    case 'chased': {
      if (room) broadcast(room, { t: 'chaseEnd', by: peer.id }, peer.id);
      return;
    }
    case 'call': {
      // anyone may call the jet to one of the four docks, unless someone is flying it
      if (!room) return;
      const j = room.jet, n = (v) => (typeof v === 'number' && isFinite(v) ? Math.max(-1000, Math.min(1000, Math.round(v * 100) / 100)) : 0);
      if (!Number.isInteger(msg.dock) || msg.dock < 0 || msg.dock >= JET_DOCKS) return;
      if (j.pilot !== null) return send(peer.ws, { t: 'callNo', why: 'pilot' });
      const now = Date.now(), boss = peer.id === room.hostId || peer.admin;
      if (j.call && j.call.hold && !boss) return send(peer.ws, { t: 'callNo', why: 'held' });
      if (j.call && !j.call.hold && now - j.call.at < 4000) return send(peer.ws, { t: 'callNo', why: 'busy' });
      const wait = typeof msg.wait === 'number' && isFinite(msg.wait) ? Math.max(0, Math.min(25, msg.wait)) : undefined;
      j.call = { dock: msg.dock, x: n(msg.x), y: n(msg.y), z: n(msg.z), h: n(msg.h), at: now, by: peer.id };
      if (wait !== undefined) j.call.wait = wait;
      j.release = null;
      broadcast(room, Object.assign({ t: 'jetCall' }, j.call));
      return;
    }
    case 'unboard': {
      if (room) unboard(room, peer);
      return;
    }
    case 'jet': {
      if (!room || room.jet.pilot !== peer.id) return;
      const n = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v * 100) / 100 : 0);
      room.jet.last = { x: n(msg.x), y: n(msg.y), z: n(msg.z), h: n(msg.h), p: n(msg.p), r: n(msg.r), s: n(msg.s) };
      broadcast(room, Object.assign({ t: 'jet', id: peer.id }, room.jet.last), peer.id);
      return;
    }
    case 'pos': {
      if (!room) return;
      const n = (v) => (typeof v === 'number' && isFinite(v) ? Math.round(v * 100) / 100 : 0);
      const k = (v, a, b) => (Number.isInteger(v) && v >= a && v <= b ? v : 0);
      peer.pos = { x: n(msg.x), y: n(msg.y), z: n(msg.z), yaw: n(msg.yaw), pitch: n(msg.pitch), rd: msg.rd ? 1 : 0, sl: msg.sl ? 1 : 0, lf: msg.lf ? 1 : 0, fr: msg.fr ? 1 : 0, gd: msg.gd ? 1 : 0, fb: msg.fb ? 1 : 0,
        em: k(msg.em, 0, 5), es: k(msg.es, 0, 1e9), pk: k(msg.pk, 0, 1e9), pi: k(msg.pi, 0, 3), fx: n(msg.fx), fy: n(msg.fy), fz: n(msg.fz) };
      broadcast(room, Object.assign({ t: 'pos', id: peer.id }, peer.pos), peer.id);
      return;
    }
  }
}


function newPeer(ws) {
  return { id: nextId++, ws, name: 'Player', skin: {}, admin: false, room: null, pos: null, tokens: EDIT_BURST, tokT: Date.now() };
}
function receive(peer, data) {
  let msg;
  try { msg = typeof data === 'string' ? JSON.parse(data) : data; } catch (e) { return; }
  try { handle(peer, msg); } catch (e) { console.error(e); }
}
return { handle, receive, leave, newPeer, rooms, onField };
}
return { createHub };
});
