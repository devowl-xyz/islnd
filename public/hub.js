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
const W = 352, D = 352, H = 80;
const FX = 80, FZ = 92, FIELD_R = 24;
const MAX_BLOCK = 61; // 12 is water, 13 to 23 underground blocks, 24 marble, 25 gold, 26 snow, 27-28 bed, 29-32 door, 33-44 colours, 45 ice, 46 sign, 47 fence, 48-49 slabs, 50-57 stairs, 58-61 slides
const SIGN = 46, SIGN_MAX = 60;
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
const AT = { cx: 50, cz: 226, x0: 43, x1: 57, z0: 219, z1: 233, y0: 2, y1: 10 };
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
// The Sky Palace floating north-west of the treehouse (same numbers as public/index.html): the frame
// is fixed and owl owners may decorate the great hall. It moves with the treehouse.
const PAL = { x0: 0, x1: 28, z0: 56, z1: 84, y0: 54, y1: 76 };
const PAL_HALL = { x0: 9, x1: 19, z0: 65, z1: 75, y0: 64, y1: 68 };
// The treehouse's observation tree, its spiral staircase and deck (same numbers as public/index.html) are fixed.
const OD_TREE = { x0: 23, x1: 37, z0: 91, z1: 105, y0: 1, y1: 45 };
const PAL_PETS = ['goldie', 'biscuit', 'mochi', 'cinder', 'horse'];
// East Beach Airport (same numbers as public/index.html): fixed, except the members' lounge, which the
// owners of Hoot, Snowy, Biscuit, Mochi and Clover may decorate. It stays put in every layout.
const AIR = [
  { x0: 132, x1: 155, z0: 92, z1: 122, y0: 1, y1: 31 },
  { x0: 156, x1: 164, z0: 90, z1: 156, y0: 1, y1: 13 },
  { x0: 140, x1: 142, z0: 87, z1: 91, y0: 1, y1: 15 },
  { x0: 150, x1: 164, z0: 84, z1: 91, y0: 1, y1: 13 },
  { x0: 126, x1: 131, z0: 92, z1: 95, y0: 11, y1: 15 }
];
const LOUNGE = { x0: 135, x1: 149, z0: 107, z1: 111, y0: 12, y1: 16 };
// North Shore's helipad (same numbers as public/index.html) is fixed, and the helicopter parks on it.
AIR.push({ x0: 289, x1: 302, z0: 28, z1: 41, y0: 1, y1: 12 });
const HELI_HOME = { x: 295.5, y: 12, z: 34.5, h: -Math.PI / 2 };
// The jet ski jetty and the steps down to it from the campsite (same numbers as public/index.html) are fixed, in every layout.
AIR.push({ x0: 186, x1: 203, z0: 219, z1: 220, y0: 9, y1: 22 });
const SKI_HOME = [[187.5, 221.6], [189.5, 221.6], [191.5, 221.6], [193.5, 221.6], [195.5, 221.6]];
// The cable car's two stations (same numbers as public/index.html) are fixed; it only runs in the spread layout.
const CABLE_BOXES = { spread: [{ x0: 230, x1: 240, z0: 255, z1: 263, y0: 37, y1: 47 }, { x0: 229, x1: 237, z0: 278, z1: 286, y0: 16, y1: 26 }], classic: [] };
const ROPE_MAX = H + 40; // as long as it needs to be to reach the ground
const LOUNGE_PETS = ['hoot', 'snowy', 'biscuit', 'mochi', 'horse'];
/* Layouts: where the treehouse and the cottage stand (same numbers as public/index.html). */
const SHIFTS = { classic: { th: [0, 0], cot: [0, 0] }, spread: { th: [212, -24], cot: [112, 231] } };
function shiftObj(b, dx, dz) { const t = {}; for (const k in b) { const v = b[k]; t[k] = typeof v !== 'number' ? v : /^(x|sx|cx)/.test(k) ? v + dx : /^(z|sz|cz)/.test(k) ? v + dz : v; } return t; }
const LAYOUTS = {};
for (const name in SHIFTS) {
  const [tx, tz] = SHIFTS[name].th, [cx, cz] = SHIFTS[name].cot;
  LAYOUTS[name] = { OD: [shiftObj(OD_TREE, tx, tz)], PAL: shiftObj(PAL, tx, tz), PAL_HALL: shiftObj(PAL_HALL, tx, tz), TH: shiftObj(TH, tx, tz), TH_ROOMS: TH_ROOMS.map((r) => shiftObj(r, tx, tz)), COT: shiftObj(COT, cx, cz), COT_ROOMS: COT_ROOMS.map((r) => shiftObj(r, cx, cz)), CABLE: CABLE_BOXES[name] || [] };
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
  const inB = (o) => x >= o.x0 && x <= o.x1 && z >= o.z0 && z <= o.z1 && y >= o.y0 && y <= o.y1;
  if (inB(L.PAL)) return inB(L.PAL_HALL) ? 'shared' : 'base';
  if (L.OD.some(inB)) return 'base';
  if (inB(LOUNGE)) return 'lounge';
  if (AIR.some(inB)) return 'base';
  if (L.CABLE.some(inB)) return 'base';
  for (const r of TH_ROOMS) if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1 && z >= r.z0 && z <= r.z1) return r.id;
  if (x >= TH.x0 && x <= TH.x1 && z >= TH.z0 && z <= TH.z1 && y >= TH.y0 && y <= TH.y1) return 'base';
  if (x >= TH.sx0 && x <= TH.sx1 && z >= TH.sz0 && z <= TH.sz1 && y >= TH.y0 && y <= TH.sy1) return 'base';
  return null;
}
function thMay(id, pet) {
  if (id === 'shared') return pet === 'hoot' || pet === 'snowy';
  if (id === 'cottage') return pet === 'biscuit' || pet === 'mochi';
  if (id === 'lounge') return LOUNGE_PETS.includes(pet);
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
  if (taken) { send(peer.ws, { t: 'petNo', pet: k.pet }); k.pet = 'none'; return; }
  if (room.palace && room.palace.pets.delete(k.pet)) palaceNews(room, { act: 'adopted', pet: k.pet });
}
/* the Sky Palace guest list: players invited up by an owl owner, and pets visiting */
function isOwlPeer(p) { return !!p && !!p.skin && (p.skin.pet === 'hoot' || p.skin.pet === 'snowy'); }
function palaceState(room) { return { guests: [...room.palace.guests], pets: [...room.palace.pets] }; }
function palaceNews(room, extra) { broadcast(room, Object.assign({ t: 'palace' }, palaceState(room), extra)); }
/* the helicopter: where it is, who flies it, the rope, who has been snatched up, and its bridge */
function num(v, lo, hi, d) { return typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; }
function cleanPose(m, d) { return { x: num(m && m.x, -50, W + 50, d.x), y: num(m && m.y, 0, H + 40, d.y), z: num(m && m.z, -50, D + 50, d.z), h: num(m && m.h, -1e4, 1e4, d.h) }; }
function heliState(room) { const h = room.heli; return { x: h.x, y: h.y, z: h.z, h: h.h, pilot: h.pilot, rope: h.rope, down: h.down, captives: h.captives.slice(), pets: h.pets.slice(), dummies: h.dummies.slice(), skis: h.skis.slice(), bridge: h.bridge }; }
/* test dummies: spawned by the host and admins with /spawn, everyone sees the same ones */
const DUMMY_MAX = 12;
function dummyList(room) { return room.dummies.map((d) => ({ id: d.id, name: d.name, x: d.x, y: d.y, z: d.z, yaw: d.yaw })); }
const HELI_PETS = ['hoot', 'snowy', 'goldie', 'biscuit', 'mochi', 'cinder', 'horse'];
function heliNews(room, extra) { broadcast(room, Object.assign({ t: 'heli' }, heliState(room), extra)); }
function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}
function broadcast(room, msg, exceptId) {
  const s = JSON.stringify(msg);
  room.peers.forEach((p) => { if (p.id !== exceptId && p.ws.readyState === 1) p.ws.send(s); });
}
function peerList(room) {
  const a = [];
  room.peers.forEach((p) => a.push({ id: p.id, name: p.name, host: p.id === room.hostId, admin: p.admin, skin: p.skin, food: !!p.food, frozen: !!p.frozen }));
  return a;
}
/* host and admin tools: the time and weather everyone shares, locked builds, and the jet skis */
const WEATHERS = ['clear', 'rain', 'snow', 'storm'];
function cleanEnv(m, d) {
  d = d || { time: 12, weather: 'clear', cycle: false };
  return { time: num(m && m.time, 0, 24, d.time) % 24, weather: m && WEATHERS.includes(m.weather) ? m.weather : d.weather, cycle: m && m.cycle !== undefined ? !!m.cycle : d.cycle, at: Date.now() };
}
function isBoss(room, peer) { return peer.id === room.hostId || !!peer.admin; }
function lockAt(room, x, y, z) { return room.locks.find((o) => x >= o.x0 && x <= o.x1 && z >= o.z0 && z <= o.z1 && y >= o.y0 && y <= o.y1) || null; }
// a locked build can only be changed by whoever locked it, and by the host
function lockedFor(room, peer, x, y, z) { if (peer.id === room.hostId) return null; const o = lockAt(room, x, y, z); return o && o.owner !== peer.id ? o : null; }
function locksNews(room, extra) { broadcast(room, Object.assign({ t: 'locks', locks: room.locks }, extra)); }
const SKI_MAX_V = 25;
function skiState(room) { return room.skis.map((q) => ({ x: q.x, z: q.z, h: q.h, y: q.y, rider: q.rider })); }
/* the bicycles by the meadow: only players with a pet may ride one */
const BIKE_HOME = [0, 1, 2, 3, 4, 5].map((k) => [87.5 + k * 1.2, 100.5]);
function bikeState(room) { return room.bikes.map((b) => ({ x: b.x, y: b.y, z: b.z, yaw: b.yaw, rider: b.rider })); }
function bikesNews(room, extra) { broadcast(room, Object.assign({ t: 'bikes', bikes: bikeState(room) }, extra)); }
function hasPet(p) { return !!p && !!p.skin && !!p.skin.pet && p.skin.pet !== 'none'; }
function skisNews(room, extra) { broadcast(room, Object.assign({ t: 'skis', skis: skiState(room) }, extra)); }
/* signs: the words on each sign block, which anyone who may change that block may write */
function cleanSignText(t) { return String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, SIGN_MAX); }
function signList(room) { const a = []; room.signs.forEach((v, i) => { if (room.edits.get(i) === SIGN) a.push([i, v.t, v.r]); }); return a; }
function signGone(room, i) { if (room.signs.delete(i)) broadcast(room, { t: 'sign', i, text: null }); }
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
  if (room.palace && room.palace.guests.delete(peer.id)) palaceNews(room, { act: 'left', peer: peer.id });
  if (room.skis && room.skis.some((q) => q.rider === peer.id)) { room.skis.forEach((q) => { if (q.rider === peer.id) q.rider = null; }); skisNews(room); }
  if (room.bikes && room.bikes.some((b) => b.rider === peer.id)) { room.bikes.forEach((b) => { if (b.rider === peer.id) b.rider = null; }); bikesNews(room); }
  if (room.locks && room.locks.some((o) => o.owner === peer.id)) { room.locks = room.locks.filter((o) => o.owner !== peer.id); locksNews(room, { act: 'left' }); }
  if (room.heli) {
    const h = room.heli, k = h.captives.indexOf(peer.id);
    let changed = false;
    if (k >= 0) { h.captives.splice(k, 1); changed = true; }
    if (h.pilot === peer.id) { h.pilot = null; changed = true; }
    if (changed) heliNews(room, { act: 'left', peer: peer.id });
  }
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
      const r = { code, hostId: peer.id, peers: new Map(), edits: new Map(), seeding: true, jet: { pilot: null, pass: [], last: null, release: null, call: null, park: null } };
      const hp = cleanPose(msg.heli, HELI_HOME);
      r.dummies = []; r.dummySeq = 1;
      r.heli = Object.assign(hp, { pilot: null, rope: 0, down: false, captives: [], dummies: [], bridge: msg.heli && msg.heli.bridge ? cleanPose(msg.heli.bridge, hp) : null,
        pets: (msg.heli && Array.isArray(msg.heli.pets) ? msg.heli.pets : []).filter((id, k, a) => HELI_PETS.includes(id) && a.indexOf(id) === k).slice(0, 4),
        skis: (msg.heli && Array.isArray(msg.heli.skis) ? msg.heli.skis : []).filter((k, i, a) => Number.isInteger(k) && k >= 0 && k < 5 && a.indexOf(k) === i).slice(0, 3) });
      r.palace = { guests: new Set(), pets: new Set((Array.isArray(msg.palace) ? msg.palace : []).filter((id) => PAL_PETS.includes(id) && id !== peer.skin.pet)) };
      r.layout = LAYOUTS[msg.layout] ? msg.layout : 'spread'; r.lay = LAYOUTS[r.layout];
      r.env = cleanEnv(msg.env); r.locks = []; r.lockSeq = 1;
      r.bikes = BIKE_HOME.map((h, k) => { const q = Array.isArray(msg.bikes) ? msg.bikes[k] : null; return { x: num(q && q.x, 1, W - 1, h[0]), y: num(q && q.y, 0, H, 13), z: num(q && q.z, 1, D - 1, h[1]), yaw: num(q && q.yaw, -1e4, 1e4, 0), rider: null }; });
      r.signs = new Map();
      (Array.isArray(msg.signs) ? msg.signs : []).slice(0, 4000).forEach((q) => { if (Array.isArray(q) && Number.isInteger(q[0]) && q[0] >= 0 && q[0] < VOX) r.signs.set(q[0], { t: cleanSignText(q[1]), r: q[2] ? 1 : 0 }); });
      r.skis = SKI_HOME.map((h, k) => { const q = Array.isArray(msg.skis) ? msg.skis[k] : null; return { x: num(q && q.x, 1, W - 1, h[0]), z: num(q && q.z, 1, D - 1, h[1]), h: num(q && q.h, -1e4, 1e4, Math.PI / 2), y: num(q && q.y, 0, H, 10.875), rider: null }; });
      r.peers.set(peer.id, peer);
      rooms.set(code, r);
      peer.room = r;
      send(peer.ws, { t: 'hosted', code, you: peer.id, peers: peerList(r), now: Date.now(), jet: r.jet, layout: r.layout, palace: palaceState(r), heli: heliState(r), dummies: dummyList(r), env: r.env, locks: r.locks, skis: skiState(r), signs: signList(r), bikes: bikeState(r) });
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
      send(peer.ws, { t: 'joined', code, you: peer.id, peers: peerList(r), now: Date.now(), jet: r.jet, layout: r.layout, tag: r.tag ? { it: r.tag.it, ends: r.tag.ends, scores: r.tag.scores } : null, palace: palaceState(r), heli: heliState(r), dummies: dummyList(r), env: r.env, locks: r.locks, skis: skiState(r), signs: signList(r), bikes: bikeState(r) });
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
      const locked = !door && !!lockedFor(room, peer, x, y, z);
      const ok = peer.tokens >= 1 && !locked && (door || (!floor && th !== 'base' && (th ? thOk : canEditAt(room, peer, x, z)) && !(b === 0 && y < 1)));
      if (!ok) {
        // Tell the sender what the cell really holds so it can undo its guess.
        const cur = room.edits.has(i) ? room.edits.get(i) : null;
        send(peer.ws, { t: 'revert', i, b: cur, why: peer.tokens < 1 ? 'rate' : locked ? 'lock' : (floor ? 'floor' : (th === 'base' ? 'tree' : (th ? 'owl' : 'perm'))) });
        return;
      }
      peer.tokens -= 1;
      room.edits.set(i, b);
      broadcast(room, { t: 'edit', x, y, z, b, by: peer.id });
      if (b !== SIGN) signGone(room, i);
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
      if (msg.seat === 'pilot' && may && j.pilot === null) { j.pilot = peer.id; j.release = null; j.call = null; j.last = null; j.park = null; }
      else if (msg.seat === 'pilot' && !may) return send(peer.ws, { t: 'boardNo', why: 'admin' });
      else if (j.pass.length < 4) j.pass.push(peer.id);
      else return send(peer.ws, { t: 'boardNo', why: 'full' });
      jetSeats(room);
      return;
    }
    case 'heliBoard': {
      // only Hoot's and Snowy's owners fly it, one at a time, and not while they've been snatched up
      if (!room) return;
      const h = room.heli;
      if (!isOwlPeer(peer)) return send(peer.ws, { t: 'heliNo', why: 'owl' });
      if (h.captives.includes(peer.id)) return send(peer.ws, { t: 'heliNo', why: 'captive' });
      if (h.pilot !== null && h.pilot !== peer.id) return send(peer.ws, { t: 'heliNo', why: 'busy' });
      h.pilot = peer.id;
      heliNews(room, { act: 'board', by: peer.id });
      return;
    }
    case 'heliPos': {
      if (!room || room.heli.pilot !== peer.id) return;
      const h = room.heli, p = cleanPose(msg, h);
      h.x = p.x; h.y = p.y; h.z = p.z; h.h = p.h; h.rope = num(msg.r, 0, ROPE_MAX, 0); h.down = !!msg.d;
      if (!h.down && h.rope < 0.5) h.rope = 0;
      broadcast(room, { t: 'heliPos', x: h.x, y: h.y, z: h.z, h: h.h, r: h.rope, d: h.down ? 1 : 0 }, peer.id);
      return;
    }
    case 'heliLeave': {
      if (!room || room.heli.pilot !== peer.id) return;
      const h = room.heli, p = cleanPose(msg, h);
      h.x = p.x; h.y = p.y; h.z = p.z; h.h = p.h; h.pilot = null;
      // it stays right where it was left, rope and all
      heliNews(room, { act: 'leave', by: peer.id });
      return;
    }
    case 'heliGrab': {
      // the pilot's rope snatches up someone close under its hook; nobody gets a choice
      if (!room) return;
      const h = room.heli, target = room.peers.get(msg.peer);
      if (h.pilot !== peer.id || !h.down || h.rope < 2 || !target || target.id === peer.id || h.captives.includes(target.id) || !target.pos) return;
      const ex = h.x, ey = h.y + 0.4 - h.rope, ez = h.z;
      if (Math.hypot(target.pos.x - ex, target.pos.z - ez) > 3.5 || target.pos.y < ey - 3.5 || target.pos.y > ey + 2) return;
      if (h.captives.length >= 4) return;
      h.captives.push(target.id);
      heliNews(room, { act: 'grab', by: peer.id, peer: target.id });
      return;
    }
    case 'heliGrabPet': {
      // the pilot's rope snatches up a pet (any pet but the pilot's own), up to four at a time
      if (!room) return;
      const h = room.heli;
      if (h.pilot !== peer.id || !h.down || h.rope < 2 || !HELI_PETS.includes(msg.pet) || h.pets.includes(msg.pet) || h.pets.length >= 4) return;
      if (peer.skin && peer.skin.pet === msg.pet) return;
      h.pets.push(msg.pet);
      heliNews(room, { act: 'grabPet', by: peer.id, pet: msg.pet });
      return;
    }
    case 'heliGrabDummy': {
      if (!room) return;
      const h = room.heli, d = room.dummies.find((q) => q.id === msg.id);
      if (h.pilot !== peer.id || !h.down || h.rope < 2 || !d || h.dummies.includes(d.id) || h.dummies.length >= 4) return;
      h.dummies.push(d.id);
      heliNews(room, { act: 'grabDummy', by: peer.id, dummy: d.id });
      return;
    }
    case 'dummy': {
      // /spawn, /despawn and /clear: the host and admins only
      if (!room || (peer.id !== room.hostId && !peer.admin)) return;
      if (msg.act === 'spawn') {
        if (room.dummies.length >= DUMMY_MAX) return;
        const p = cleanPose(msg, { x: 0, y: 20, z: 0, h: 0 });
        const name = cleanName(msg.name).slice(0, 16), d = { id: room.dummySeq++, name: name === 'Player' && msg.name !== 'Player' ? 'Test Dummy' : name, x: p.x, y: p.y, z: p.z, yaw: num(msg.yaw, -1e4, 1e4, 0) };
        room.dummies.push(d);
        broadcast(room, { t: 'dummies', act: 'spawn', by: peer.id, byName: peer.name, name: d.name, dummies: dummyList(room) });
      } else if (msg.act === 'remove' || msg.act === 'clear') {
        const gone = msg.act === 'clear' ? room.dummies.splice(0) : room.dummies.filter((d) => d.id === msg.id);
        if (!gone.length) return;
        room.dummies = room.dummies.filter((d) => !gone.includes(d));
        const ids = gone.map((d) => d.id), had = room.heli.dummies.length;
        room.heli.dummies = room.heli.dummies.filter((id) => !ids.includes(id));
        broadcast(room, { t: 'dummies', act: msg.act, by: peer.id, name: gone[0].name, dummies: dummyList(room) });
        if (room.heli.dummies.length !== had) heliNews(room, { act: 'dummyGone' });
      }
      return;
    }
    case 'heliGrabSki': {
      // the pilot's rope lifts a jet ski nobody is riding (up to three at once)
      if (!room || room.heli.pilot !== peer.id || !Number.isInteger(msg.k) || !room.skis[msg.k]) return;
      const h = room.heli, q = room.skis[msg.k];
      if (q.rider !== null || h.skis.includes(msg.k) || h.skis.length >= 3 || !h.down) return;
      h.skis.push(msg.k);
      heliNews(room, { act: 'grabSki', by: peer.id, ski: msg.k });
      return;
    }
    case 'heliRelease': {
      // only the pilot or the host (or an admin) lets people go
      if (!room) return;
      const h = room.heli;
      if (h.pilot !== peer.id && peer.id !== room.hostId && !peer.admin) return send(peer.ws, { t: 'heliNo', why: 'release' });
      if (!h.captives.length && !h.pets.length && !h.dummies.length && !h.skis.length) return;
      const freed = h.captives.splice(0), pets = h.pets.splice(0), dm = h.dummies.splice(0), sk = h.skis.splice(0);
      // jet skis drop straight down from the hook; each player's game sees whether they land on water
      sk.forEach((k) => { const q = room.skis[k]; if (q) { q.x = h.x; q.z = h.z; q.y = h.y - (h.rope > 2 ? h.rope : 0); } });
      // the dummies drop from the helicopter: remember where, for anyone who joins later
      dm.forEach((id) => { const d = room.dummies.find((q) => q.id === id); if (d) { d.x = h.x; d.z = h.z; d.y = h.y - (h.rope > 2 ? h.rope : 0); } });
      if (dm.length) broadcast(room, { t: 'dummies', act: 'drop', dummies: dummyList(room) });
      heliNews(room, { act: 'release', by: peer.id, freed, freedPets: pets });
      if (sk.length) skisNews(room, { act: 'drop' });
      return;
    }
    case 'heliBridge': {
      if (!room || room.heli.pilot !== peer.id) return;
      const h = room.heli;
      h.bridge = msg.on ? cleanPose(msg, h) : null;
      heliNews(room, { act: 'bridge', by: peer.id });
      return;
    }
    case 'palace': {
      // only Hoot's and Snowy's owners invite guests up or send them down; owl owners can't be sent down
      if (!room || !isOwlPeer(peer)) return;
      const now = Date.now();
      if (now - (peer.palT || 0) < 150) return;
      peer.palT = now;
      const P = room.palace, act = msg.act;
      if (act === 'invite' || act === 'kick') {
        const target = room.peers.get(msg.peer);
        if (!target || target.id === peer.id || isOwlPeer(target)) return;
        if (act === 'invite') P.guests.add(target.id); else if (!P.guests.delete(target.id)) return;
        palaceNews(room, { act, by: peer.id, peer: target.id });
      } else if (act === 'invitePet' || act === 'kickPet') {
        if (!PAL_PETS.includes(msg.pet)) return;
        if (act === 'invitePet') {
          let owned = false;
          room.peers.forEach((p) => { if (p.skin && p.skin.pet === msg.pet) owned = true; });
          if (owned || P.pets.has(msg.pet)) return;
          P.pets.add(msg.pet);
        } else if (!P.pets.delete(msg.pet)) return;
        palaceNews(room, { act, by: peer.id, pet: msg.pet });
      } else if (act === 'kickAll') {
        if (!P.guests.size && !P.pets.size) return;
        P.guests.clear(); P.pets.clear();
        palaceNews(room, { act, by: peer.id });
      }
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
      j.release = null; j.park = null;
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
      // a route of waypoints is air traffic control: only the host and admins may send one, and it can redirect a call
      const atc = Array.isArray(msg.via);
      if (atc && !boss) return send(peer.ws, { t: 'callNo', why: 'atc' });
      if (j.call && j.call.hold && !boss) return send(peer.ws, { t: 'callNo', why: 'held' });
      if (j.call && !j.call.hold && now - j.call.at < 4000 && !atc) return send(peer.ws, { t: 'callNo', why: 'busy' });
      const wait = typeof msg.wait === 'number' && isFinite(msg.wait) ? Math.max(0, Math.min(25, msg.wait)) : undefined;
      j.call = { dock: msg.dock, x: n(msg.x), y: n(msg.y), z: n(msg.z), h: n(msg.h), at: now, by: peer.id };
      if (wait !== undefined) j.call.wait = wait;
      if (atc) {
        j.call.atc = true;
        j.call.via = msg.via.slice(0, 8).filter((w) => Array.isArray(w) && w.length === 2 && w.every((v) => typeof v === 'number' && isFinite(v)))
          .map((w) => [Math.max(0, Math.min(W - 1, Math.round(w[0]))), Math.max(0, Math.min(D - 1, Math.round(w[1])))]);
      }
      j.release = null; j.park = null;
      broadcast(room, Object.assign({ t: 'jetCall' }, j.call));
      return;
    }
    case 'jetSpawn': {
      // /spawn jet: the host or an admin parks the jet where they say, until someone flies it, calls it or sends it home
      if (!room || (peer.id !== room.hostId && !peer.admin)) return;
      const j = room.jet;
      if (j.pilot !== null) return send(peer.ws, { t: 'callNo', why: 'pilot' });
      j.park = cleanPose(msg, { x: 80, y: 30, z: 80, h: 0 });
      j.call = null; j.release = null;
      broadcast(room, Object.assign({ t: 'jetSpawn', by: peer.id }, j.park));
      return;
    }
    case 'jetDespawn': {
      // /despawn jet: a parked jet flies home from where it is
      if (!room || (peer.id !== room.hostId && !peer.admin) || !room.jet.park) return;
      const j = room.jet;
      j.release = Object.assign({}, j.park, { at: Date.now() });
      j.park = null;
      broadcast(room, Object.assign({ t: 'jetRelease' }, j.release));
      return;
    }
    case 'heliSpawn': {
      // /spawn heli (and /despawn heli, back to its pad): the host or an admin moves the helicopter, when nobody is flying it
      if (!room || (peer.id !== room.hostId && !peer.admin)) return;
      const h = room.heli;
      if (h.pilot !== null) return send(peer.ws, { t: 'heliNo', why: 'busy' });
      Object.assign(h, cleanPose(msg, h));
      h.bridge = null; h.rope = 0; h.down = false;
      heliNews(room, { act: msg.home ? 'home' : 'spawn', by: peer.id });
      return;
    }
    case 'sign': {
      // the words on a sign: the cell must hold a sign, and the writer must be allowed to change it
      if (!room || !Number.isInteger(msg.i) || msg.i < 0 || msg.i >= VOX || room.edits.get(msg.i) !== SIGN) return;
      const now = Date.now();
      if (now - (peer.signT || 0) < 300) return;
      peer.signT = now;
      const i = msg.i, x = i % W, y = Math.floor(i / (W * D)), z = Math.floor(i / W) % D;
      const th = thCell(x, y, z, room.lay);
      const may = !isFloor(x, y, z) && th !== 'base' && (th ? thMay(th, peer.skin && peer.skin.pet) : canEditAt(room, peer, x, z)) && !lockedFor(room, peer, x, y, z);
      if (!may) return;
      const v = { t: cleanSignText(msg.text), r: msg.r ? 1 : 0 };
      room.signs.set(i, v);
      broadcast(room, { t: 'sign', i, text: v.t, r: v.r, by: peer.id });
      return;
    }
    case 'env': {
      // /time and /weather: the host and admins set them for everyone
      if (!room || !isBoss(room, peer)) return;
      const cur = room.env, nowH = cur.cycle ? (cur.time + (Date.now() - cur.at) / 1000 * 24 / 1200) % 24 : cur.time;
      room.env = cleanEnv(msg, { time: nowH, weather: cur.weather, cycle: cur.cycle });
      broadcast(room, Object.assign({ t: 'env', by: peer.id, what: msg.what === 'weather' ? 'weather' : 'time' }, room.env));
      return;
    }
    case 'freeze': {
      // the host can freeze anyone but themselves; admins can freeze guests
      if (!room || !isBoss(room, peer)) return;
      const on = !!msg.on, ids = [];
      room.peers.forEach((p) => {
        if (p.id === room.hostId || p.id === peer.id) return;
        if (p.admin && peer.id !== room.hostId) return;
        if (msg.all || p.id === msg.peer) { p.frozen = on; ids.push(p.id); }
      });
      broadcast(room, { t: 'frozen', ids, on, by: peer.id });
      return;
    }
    case 'give': {
      if (!room || !isBoss(room, peer) || !Number.isInteger(msg.b) || msg.b < 1 || msg.b > MAX_BLOCK) return;
      if (msg.all) { broadcast(room, { t: 'given', all: true, b: msg.b, by: peer.id }); return; }
      const target = room.peers.get(msg.peer);
      if (!target) return;
      send(target.ws, { t: 'given', to: target.id, b: msg.b, by: peer.id });
      if (target !== peer) send(peer.ws, { t: 'given', to: target.id, b: msg.b, by: peer.id });
      return;
    }
    case 'announce': {
      if (!room || !isBoss(room, peer) || typeof msg.text !== 'string') return;
      const text = msg.text.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 100);
      if (!text) return;
      broadcast(room, { t: 'announce', text, name: peer.name, by: peer.id });
      return;
    }
    case 'lock': {
      // lock the build round you: up to 3 each (any number for the host and admins), not over anyone else's
      if (!room) return;
      const n = (v) => (Number.isInteger(v) ? v : NaN);
      const o = { x0: n(msg.x0), x1: n(msg.x1), z0: n(msg.z0), z1: n(msg.z1), y0: n(msg.y0), y1: n(msg.y1) };
      if (![o.x0, o.x1, o.z0, o.z1, o.y0, o.y1].every(isFinite) || o.x1 < o.x0 || o.z1 < o.z0 || o.y1 < o.y0) return;
      const big = isBoss(room, peer) ? 65 : 33;
      if (o.x1 - o.x0 + 1 > big || o.z1 - o.z0 + 1 > big) return send(peer.ws, { t: 'locks', locks: room.locks, no: 'size' });
      o.x0 = Math.max(0, o.x0); o.z0 = Math.max(0, o.z0); o.x1 = Math.min(W - 1, o.x1); o.z1 = Math.min(D - 1, o.z1); o.y0 = Math.max(0, o.y0); o.y1 = Math.min(H - 1, o.y1);
      if (!isBoss(room, peer) && room.locks.filter((q) => q.owner === peer.id).length >= 3) return send(peer.ws, { t: 'locks', locks: room.locks, no: 'many' });
      if (room.locks.some((q) => q.owner !== peer.id && q.x0 <= o.x1 && o.x0 <= q.x1 && q.z0 <= o.z1 && o.z0 <= q.z1 && q.y0 <= o.y1 && o.y0 <= q.y1)) return send(peer.ws, { t: 'locks', locks: room.locks, no: 'overlap' });
      if (room.locks.length >= 200) return;
      room.locks.push(Object.assign(o, { id: room.lockSeq++, owner: peer.id, name: peer.name }));
      locksNews(room, { act: 'lock', by: peer.id });
      return;
    }
    case 'unlock': {
      if (!room) return;
      const boss = isBoss(room, peer), had = room.locks.length;
      if (msg.all) room.locks = room.locks.filter((o) => !boss && o.owner !== peer.id);
      else {
        const o = room.locks.find((q) => q.id === msg.id);
        if (!o) return;
        if (o.owner !== peer.id && !boss) return send(peer.ws, { t: 'locks', locks: room.locks, no: 'owner' });
        room.locks = room.locks.filter((q) => q !== o);
      }
      if (room.locks.length !== had) locksNews(room, { act: 'unlock', by: peer.id });
      return;
    }
    case 'paste': {
      // /paste and /undo from the host or an admin: many blocks at once, each checked like an edit
      if (!room || !isBoss(room, peer) || !Array.isArray(msg.cells) || msg.cells.length > 32000) return;
      const out = [];
      let no = 0;
      for (let k = 0; k + 1 < msg.cells.length; k += 2) {
        const i = msg.cells[k], b = msg.cells[k + 1];
        if (!Number.isInteger(i) || i < 0 || i >= VOX || !Number.isInteger(b) || b < 0 || b > MAX_BLOCK) continue;
        const x = i % W, y = Math.floor(i / (W * D)), z = Math.floor(i / W) % D;
        const th = thCell(x, y, z, room.lay);
        if (isFloor(x, y, z) || th === 'base' || (th && !thMay(th, peer.skin && peer.skin.pet)) || y < 1 || lockedFor(room, peer, x, y, z)) { no++; continue; }
        room.edits.set(i, b);
        out.push(i, b);
        if (b !== SIGN && room.signs.has(i)) room.signs.delete(i);
      }
      if (out.length) broadcast(room, { t: 'pasted', edits: out, by: peer.id, no });
      else send(peer.ws, { t: 'pasted', edits: [], by: peer.id, no });
      return;
    }
    case 'fireworks': {
      // anyone may set off a show, every few seconds
      if (!room) return;
      const now = Date.now();
      if (now - (peer.fwT || 0) < 5000) return;
      peer.fwT = now;
      const x = num(msg.x, -50, W + 50, 0), y = num(msg.y, 0, H + 20, 20), z = num(msg.z, -50, D + 50, 0);
      broadcast(room, { t: 'fireworks', x, y, z, seed: Number.isInteger(msg.seed) ? msg.seed >>> 0 : 1, by: peer.id });
      return;
    }
    case 'bikeBoard': {
      if (!room || !Number.isInteger(msg.k) || !room.bikes[msg.k]) return;
      const b = room.bikes[msg.k];
      if (!hasPet(peer)) return send(peer.ws, { t: 'bikes', bikes: bikeState(room), no: 'pet' });
      if (room.bikes.some((q) => q.rider === peer.id)) return;
      if (b.rider !== null) return send(peer.ws, { t: 'bikes', bikes: bikeState(room), no: 'busy' });
      b.rider = peer.id;
      bikesNews(room, { act: 'board', by: peer.id });
      return;
    }
    case 'bikePos': {
      if (!room || !Number.isInteger(msg.k) || !room.bikes[msg.k] || room.bikes[msg.k].rider !== peer.id) return;
      const b = room.bikes[msg.k];
      b.x = num(msg.x, 0, W, b.x); b.y = num(msg.y, 0, H + 40, b.y); b.z = num(msg.z, 0, D, b.z); b.yaw = num(msg.yaw, -1e4, 1e4, b.yaw);
      broadcast(room, { t: 'bikePos', k: msg.k, x: b.x, y: b.y, z: b.z, yaw: b.yaw }, peer.id);
      return;
    }
    case 'bikeLeave': {
      if (!room || !Number.isInteger(msg.k) || !room.bikes[msg.k] || room.bikes[msg.k].rider !== peer.id) return;
      const b = room.bikes[msg.k];
      b.x = num(msg.x, 0, W, b.x); b.y = num(msg.y, 0, H + 40, b.y); b.z = num(msg.z, 0, D, b.z); b.yaw = num(msg.yaw, -1e4, 1e4, b.yaw); b.rider = null;
      bikesNews(room, { act: 'leave', by: peer.id });
      return;
    }
    case 'bikeHome': {
      if (!room || !isBoss(room, peer)) return;
      room.bikes.forEach((b, k) => { if (b.rider === null) { b.x = BIKE_HOME[k][0]; b.z = BIKE_HOME[k][1]; b.y = 13; b.yaw = 0; } });
      bikesNews(room, { act: 'home', by: peer.id });
      return;
    }
    case 'skiBoard': {
      if (!room || !Number.isInteger(msg.k) || !room.skis[msg.k]) return;
      const q = room.skis[msg.k];
      if (room.skis.some((s) => s.rider === peer.id)) return;
      if (q.rider !== null || room.heli.skis.includes(msg.k)) return send(peer.ws, { t: 'skis', skis: skiState(room), no: 'busy' });
      q.rider = peer.id;
      skisNews(room, { act: 'board', by: peer.id });
      return;
    }
    case 'skiPos': {
      if (!room || !Number.isInteger(msg.k) || !room.skis[msg.k] || room.skis[msg.k].rider !== peer.id) return;
      const q = room.skis[msg.k];
      q.x = num(msg.x, 1, W - 1, q.x); q.z = num(msg.z, 1, D - 1, q.z); q.h = num(msg.h, -1e4, 1e4, q.h);
      broadcast(room, { t: 'skiPos', k: msg.k, x: q.x, z: q.z, h: q.h, v: num(msg.v, -SKI_MAX_V, SKI_MAX_V, 0) }, peer.id);
      return;
    }
    case 'skiLeave': {
      if (!room || !Number.isInteger(msg.k) || !room.skis[msg.k] || room.skis[msg.k].rider !== peer.id) return;
      const q = room.skis[msg.k];
      q.x = num(msg.x, 1, W - 1, q.x); q.z = num(msg.z, 1, D - 1, q.z); q.h = num(msg.h, -1e4, 1e4, q.h); q.rider = null;
      skisNews(room, { act: 'leave', by: peer.id });
      return;
    }
    case 'skiHome': {
      // /despawn skis: the host or an admin sends the free ones back to the jetty
      if (!room || !isBoss(room, peer)) return;
      room.skis.forEach((q, k) => { if (q.rider === null && !room.heli.skis.includes(k)) { q.x = SKI_HOME[k][0]; q.z = SKI_HOME[k][1]; q.h = Math.PI / 2; q.y = 10.875; } });
      skisNews(room, { act: 'home', by: peer.id });
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
        cl: msg.cl ? 1 : 0, pc: msg.pc ? 1 : 0, js: msg.js ? 1 : 0, sk: msg.sk ? 1 : 0, bk: k(msg.bk, 0, 6), sg: msg.sg ? 1 : 0, gp: msg.gp ? 1 : 0, gx: n(msg.gx), gy: n(msg.gy), gz: n(msg.gz), kd: k(msg.kd, 0, 2), em: k(msg.em, 0, 5), es: k(msg.es, 0, 1e9), pk: k(msg.pk, 0, 1e9), pi: k(msg.pi, 0, 3), fx: n(msg.fx), fy: n(msg.fy), fz: n(msg.fz) };
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
