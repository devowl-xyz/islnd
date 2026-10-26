const fs = require('fs'), vm = require('vm');
const TOUCH = process.argv[2] === 'touch';
const html = fs.readFileSync(__dirname + '/../public/index.html', 'utf8');
const code = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
const THREE = require('three');
const T = Object.assign({}, THREE);
let scene = null, renders = 0;
T.Scene = class extends THREE.Scene { constructor() { super(); scene = this; } };
T.WebGLRenderer = class { constructor() {} setPixelRatio() {} setSize() {} render() { renders++; } };

const listeners = {};
const stubs = {};
const ctx2d = new Proxy(function () {}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
let n = 0;
function stub(name) {
  const store = {};
  const p = new Proxy(function () {}, {
    get(t, k) {
      if (k === 'addEventListener') return (type, fn) => { (listeners[name + ':' + type] = listeners[name + ':' + type] || []).push(fn); };
      if (k in store) return store[k];
      if (k === 'classList') return { toggle() {}, add() {}, remove() {} };
      if (k === 'style') return (store.style = {});
      if (k === 'clientWidth') return 1280;
      if (k === 'clientHeight') return 720;
      if (k === 'getContext') return () => ctx2d;
      if (k === 'firstChild') return stub(name + '.fc');
      if (k === Symbol.toPrimitive) return () => 0;
      return () => {};
    },
    set(t, k, v) { store[k] = v; return true; }
  });
  stubs[name] = p;
  return p;
}
const cache = {};
const document = {
  getElementById: (id) => cache[id] || (cache[id] = stub(id)),
  createElement: () => stub('el' + (n++)),
  body: { classList: { toggle() {} } },
  addEventListener: (type, fn) => { (listeners['doc:' + type] = listeners['doc:' + type] || []).push(fn); },
  hidden: false, pointerLockElement: null
};
const store = new Map();
const window = {
  matchMedia: () => ({ matches: TOUCH }), innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  addEventListener: (type, fn) => { (listeners['win:' + type] = listeners['win:' + type] || []).push(fn); }
};
const sandbox = {
  window, document, THREE: T, performance, setTimeout, clearTimeout, setInterval, clearInterval, console,
  localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
  requestAnimationFrame: (fn) => setTimeout(() => fn(performance.now()), 16)
};
process.on('uncaughtException', (e) => { console.log('UNCAUGHT', e.stack); process.exit(1); });
vm.createContext(sandbox);
const t0 = Date.now();
vm.runInContext(code, sandbox);
const fire = (key, ev) => (listeners[key] || []).forEach((fn) => fn(Object.assign({ preventDefault() {}, stopPropagation() {} }, ev)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  console.log('init ms', Date.now() - t0);
  for (let i = 0; i < 1500 && !/play|Resume/i.test(String(stubs.play && stubs.play.textContent)) ; i++) await sleep(100);
  console.log('button:', stubs.play.textContent, 'disabled:', stubs.play.disabled, 'ready ms', Date.now() - t0);
  let meshes = 0, verts = 0;
  scene.traverse((o) => { if (o.isMesh && o.geometry.attributes.position) { meshes++; verts += o.geometry.attributes.position.count; } });
  console.log('meshes', meshes, 'vertices', verts);
  fire('play:click', {});
  await sleep(1000);
  console.log('playing overlay hidden?', stubs.overlay && 'ok', 'coords', stubs.coords.innerHTML);
  if (TOUCH) {
    fire('view:touchstart', { changedTouches: [{ identifier: 1, clientX: 100, clientY: 500 }] });
    fire('view:touchmove', { changedTouches: [{ identifier: 1, clientX: 100, clientY: 440 }] });
    fire('view:touchstart', { changedTouches: [{ identifier: 2, clientX: 900, clientY: 300 }] });
    fire('view:touchmove', { changedTouches: [{ identifier: 2, clientX: 940, clientY: 340 }] });
    await sleep(800);
    console.log('touch coords', stubs.coords.innerHTML);
    fire('bBreak:pointerdown', {}); await sleep(300); fire('bBreak:pointerup', {});
    fire('bJump:pointerdown', {}); fire('bFly:pointerdown', {}); await sleep(500);
    console.log('touch after jump/fly', stubs.coords.innerHTML);
    process.exit(0);
  }
  fire('win:keydown', { code: 'KeyW', repeat: false });
  await sleep(1500);
  fire('win:keyup', { code: 'KeyW' });
  console.log('after walk', stubs.coords.innerHTML);
  fire('win:keydown', { code: 'Space', repeat: false }); await sleep(250);
  console.log('mid jump', stubs.coords.innerHTML);
  fire('win:keyup', { code: 'Space' }); await sleep(800);
  console.log('landed', stubs.coords.innerHTML);
  // look down by dragging
  fire('view:mousedown', { button: 0, clientX: 100, clientY: 100 });
  for (let y = 110; y <= 400; y += 30) fire('win:mousemove', { clientX: 100, clientY: y, movementX: 0, movementY: 0 });
  fire('win:mouseup', {});
  // break then place
  const edBefore = store.get('voxel-isle-edits-v3');
  fire('view:mousedown', { button: 0, clientX: 100, clientY: 400 }); fire('win:mouseup', {});
  fire('view:mousedown', { button: 2, clientX: 100, clientY: 400 }); fire('win:mouseup', {});
  fire('win:keydown', { code: 'Digit7', repeat: false });
  fire('view:mousedown', { button: 2, clientX: 100, clientY: 400 }); fire('win:mouseup', {});
  fire('view:mousedown', { button: 1, clientX: 100, clientY: 400 }); fire('win:mouseup', {});
  await sleep(2200);
  const ed = JSON.parse(store.get('voxel-isle-edits-v3') || '[]');
  console.log('saved edits (pairs):', ed.length / 2, JSON.stringify(ed.slice(0, 8)), 'before', edBefore);
  fire('win:keydown', { code: 'KeyF', repeat: false }); await sleep(300);
  fire('win:keydown', { code: 'Space', repeat: false }); await sleep(600);
  console.log('fly', stubs.coords.innerHTML);
  console.log('renders', renders);
  process.exit(0);
})();
