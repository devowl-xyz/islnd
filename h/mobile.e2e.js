// Phones and tablets: the touch buttons fit on screen, chat opens with a tap and isn't hidden by
// the buttons or the keyboard, commands work from the keyboard and from the quick taps, and the
// helicopter has its own buttons.
// Run: node h/mobile.e2e.js   (needs Playwright + Chromium)
const { chromium, devices } = require('playwright');
const { server } = require('../server.js');

const PORT = 18310, URL = 'http://localhost:' + PORT + '/?layout=classic';
let fails = 0;
function check(name, ok, extra) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || extra === undefined ? '' : '  got ' + JSON.stringify(extra))); if (!ok) fails++; }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const DEVS = [['iPhone, sideways', 'iPhone 13 landscape'], ['iPhone, upright', 'iPhone 13'], ['iPad, sideways', 'iPad (gen 7) landscape'], ['iPad, upright', 'iPad (gen 7)']];
  for (const [label, dev] of DEVS) {
    const ctx = await browser.newContext(devices[dev]);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => { console.log(label + ' pageerror', e.message); fails++; });
    await p.goto(URL);
    await p.waitForFunction(() => window.__isle && window.__isle.isReady(), null, { timeout: 300000 });
    const vp = await p.evaluate(() => ({ w: innerWidth, h: innerHeight }));
    check(label + ': laid out at the device’s own width (not a shrunk desktop page)', vp.w < 1100, vp);
    await p.tap('#play');
    await p.waitForFunction(() => document.getElementById('overlay').classList.contains('hidden'), null, { timeout: 10000 }).catch(() => {});
    // the visible touch buttons are all on screen and don't cover each other
    const lay = await p.evaluate(() => {
      const r = [...document.querySelectorAll('#touch .tb')].filter((b) => !b.hidden).map((b) => { const q = b.getBoundingClientRect(); return { id: b.id, x0: q.left, y0: q.top, x1: q.right, y1: q.bottom }; });
      const off = r.filter((q) => q.x0 < 0 || q.y0 < 0 || q.x1 > innerWidth || q.y1 > innerHeight).map((q) => q.id);
      const lap = [];
      for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) { const a = r[i], b = r[j]; if (a.x0 < b.x1 - 1 && b.x0 < a.x1 - 1 && a.y0 < b.y1 - 1 && b.y0 < a.y1 - 1) lap.push(a.id + '/' + b.id); }
      return { n: r.length, off, lap, big: r.every((q) => q.x1 - q.x0 >= 44 && q.y1 - q.y0 >= 44), wide: document.documentElement.scrollWidth <= innerWidth + 1 };
    });
    check(label + ': every touch button is on screen', lay.n >= 11 && !lay.off.length, lay);
    check(label + ': they don’t cover each other', !lay.lap.length, lay.lap);
    check(label + ': and are big enough to tap (44 px or more)', lay.big);
    check(label + ': nothing pokes off the side of the screen', lay.wide);
    // tapping Chat opens the box, focused (so the keyboard comes up), near the top, clear of the buttons
    await p.tap('#bChat'); await wait(300);
    const ch = await p.evaluate(() => {
      const el = document.getElementById('chatIn'), q = el.getBoundingClientRect();
      const hit = [...document.querySelectorAll('#touch .tb')].filter((b) => !b.hidden).some((b) => { const r = b.getBoundingClientRect(); return q.left < r.right && r.left < q.right && q.top < r.bottom && r.top < q.bottom; });
      const chips = document.getElementById('chatChips'), cq = chips.getBoundingClientRect();
      return { open: !el.hidden, focus: document.activeElement === el, top: q.top, bottom: q.bottom, hit, font: parseFloat(getComputedStyle(el).fontSize), ac: el.getAttribute('autocorrect'), cap: el.getAttribute('autocapitalize'), chips: !chips.hidden && chips.children.length, chipsOn: cq.bottom <= innerHeight && cq.right <= innerWidth };
    });
    check(label + ': tapping Chat opens the chat box, ready to type in', ch.open && ch.focus, ch);
    check(label + ': near the top, above where the keyboard comes up', ch.bottom < vp.h * 0.4, ch);
    check(label + ': and not under any button', !ch.hit, ch);
    check(label + ': with text big enough that iOS doesn’t zoom in, and no autocorrect or capitals', ch.font >= 16 && ch.ac === 'off' && ch.cap === 'off', ch);
    check(label + ': with taps for common commands under it', ch.chips >= 6 && ch.chipsOn, ch);
    // typing a command on the keyboard
    await p.keyboard.type('/where'); await p.keyboard.press('Enter'); await wait(300);
    const l1 = await p.evaluate(() => window.__isle.chatLines());
    check(label + ': a command typed on the keyboard works', /You’re at/.test(l1[l1.length - 1] || '') && (await p.evaluate(() => document.getElementById('chatIn').hidden)), l1.slice(-2));
    // a quick tap runs a command
    await p.evaluate(() => { const P = window.__isle.player; P.fly = false; P.x = 85.5; P.y = 13; P.z = 92.5; P.yaw = Math.PI / 2; });
    await p.tap('#bChat'); await wait(300);
    await p.tap('#chatChips button:has-text("/spawn jet")'); await wait(400);
    check(label + ': the /spawn jet tap brings the jet', !!(await p.evaluate(() => window.__isle.jet.park)) && (await p.evaluate(() => document.getElementById('chatIn').hidden)));
    await p.evaluate(() => window.__isle.cmd('/despawn jet'));
    // tapping Chat again closes it
    await p.tap('#bChat'); await wait(200); await p.tap('#bChat'); await wait(300);
    check(label + ': tapping Chat again closes it', await p.evaluate(() => document.getElementById('chatIn').hidden));
    // the helicopter's buttons
    check(label + ': the helicopter buttons are hidden until you fly it', await p.evaluate(() => ['bRope', 'bLetGo', 'bBridge'].every((id) => document.getElementById(id).hidden)));
    await p.evaluate(() => { const I = window.__isle, P = I.player; I.setSkin({ pet: 'hoot' }); I.heli.put(100.5, 22, 92.5, 0); P.fly = true; P.x = 100.5; P.y = 23; P.z = 93.5; I.heli.board(); });
    await p.waitForFunction(() => !document.getElementById('bRope').hidden, null, { timeout: 5000 }).catch(() => {});
    const hb = await p.evaluate(() => {
      const r = [...document.querySelectorAll('#touch .tb')].filter((b) => !b.hidden).map((b) => b.getBoundingClientRect());
      return { shown: ['bRope', 'bLetGo', 'bBridge'].every((id) => !document.getElementById(id).hidden), on: r.every((q) => q.left >= 0 && q.top >= 0 && q.right <= innerWidth && q.bottom <= innerHeight) };
    });
    check(label + ': flying it shows Rope, Let go and Bridge, all on screen', hb.shown && hb.on, hb);
    await p.tap('#bRope'); await wait(300);
    check(label + ': Rope lets the rope down', await p.evaluate(() => window.__isle.heli.state().down) && (await p.textContent('#bRope')) === 'Rope up');
    await p.tap('#bRope'); await wait(300);
    check(label + ': and tapping it again winds it up', !(await p.evaluate(() => window.__isle.heli.state().down)));
    await p.evaluate(() => window.__isle.heli.leave());
    await p.waitForFunction(() => document.getElementById('bRope').hidden, null, { timeout: 5000 }).catch(() => {});
    check(label + ': and they go away when you get out', await p.evaluate(() => document.getElementById('bRope').hidden));
    await ctx.close();
  }
  await browser.close();
  server.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
