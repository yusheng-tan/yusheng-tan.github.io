// Sky and ground critters, using Terraria's own sprites (from terraria.wiki.gg) and motion modelled on
// the game's AI: harpies and the demon eye swoop on inertia, the wyvern steers like a worm, birds,
// butterflies, a dragonfly and a pixie cross the sky, and on the grass slimes hop and critters wander. Pure decoration on two aria-hidden canvases; with reduced motion
// they are drawn once and stay still.
(() => {
  const sky = document.querySelector('.sky-critters');
  const ground = document.querySelector('.ground-critters');
  if (!sky || !ground || !sky.getContext) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // pixel art needs no retina backing store: drawn at 1x and scaled up crisp by the browser,
  // the canvases have a quarter of the pixels to fill each frame
  const dpr = 1;

  // sprite sheets: frames side by side, every sprite faces left as in the game's textures
  const SHEETS = {
    harpy: [6, 'harpy'], merchant: [16, 'merchant-walk'], traveller: [14, 'traveller'], bunny: [7, 'bunny'],
    green: [2, 'green-slime'], duck: [8, 'duck'], squirrel: [5, 'squirrel'], turtle: [7, 'turtle'],
    snail: [4, 'snail'], cat: [1, 'cat'], dog: [1, 'dog'], heart: [1, 'heart'],
    bird: [4, 'bird'], bluejay: [4, 'blue-jay'], cardinal: [4, 'cardinal'], monarch: [3, 'monarch'],
    sulphur: [3, 'sulphur'], dragonfly: [4, 'dragonfly'], pixie: [4, 'pixie'], eye: [2, 'demon-eye'],
    head: [1, 'wyvern-head'], legs: [1, 'wyvern-legs'], body: [1, 'wyvern-body'],
    body2: [1, 'wyvern-body-2'], body3: [1, 'wyvern-body-3'], tail: [1, 'wyvern-tail'],
  };
  const img = {};
  const load = Object.entries(SHEETS).map(([key, [frames, file]]) => new Promise((done) => {
    const im = new Image();
    im.onload = () => { img[key] = { im, frames, w: im.width / frames, h: im.height }; done(); };
    im.onerror = done;
    im.src = `img/critters/${file}.png`;
  }));

  function fit(cv, w, h) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    return g;
  }
  const rand = (a, b) => a + Math.random() * (b - a);
  // the page-wide scale set in the head; sprites follow it in half steps so their pixels stay even
  const zoom = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom')) || 1;
  const half = (v) => Math.max(1, Math.round(v * 2) / 2);
  // one scale for every critter, sky and ground alike, so their sizes compare as in the game:
  // 1.5x on wide screens (each art pixel exactly 3 px), 1x on phones
  const unitScale = () => (innerWidth >= 768 ? half(1.5 * zoom()) : 1);
  const snap = (v) => Math.round(v);

  // draw frame `i` of a sheet centred on (x, y); `right` mirrors it to face right
  function draw(g, key, i, x, y, right, scale = 1) {
    const s = img[key]; if (!s) return;
    const w = s.w * scale, h = s.h * scale;
    g.save();
    g.translate(snap(x), snap(y));
    if (right) g.scale(-1, 1);
    g.drawImage(s.im, (i % s.frames) * s.w, 0, s.w, s.h, -w / 2, -h / 2, w, h);
    g.restore();
  }

  // ── sky ──
  let sctx, VW, VH, zones, hudBottom, panel, SCALE, wide;
  const fliers = [];

  function layoutSky() {
    VW = innerWidth; VH = innerHeight;
    SCALE = unitScale();
    sctx = fit(sky, VW, VH);
    const p = document.querySelector('.panel').getBoundingClientRect();
    panel = { l: p.left - 12, r: p.right + 12 };
    hudBottom = document.querySelector('.hud').getBoundingClientRect().bottom;
    const pad = 40;
    zones = [];
    if (panel.l - 2 * pad > 40) zones.push([pad, panel.l - pad]);
    if (VW - panel.r - 2 * pad > 40) zones.push([panel.r + pad, VW - pad]);
    wide = zones.length > 0;
    // no room beside the panels (phones): rest just off screen between visits
    if (!wide) zones.push([-160, -120], [VW + 120, VW + 160]);
  }
  const skyTop = () => Math.max(hudBottom + 50, 70);
  // stay in the sky: above the grass once the ground scrolls into view
  const skyFloor = () => Math.max(skyTop() + 80, Math.min(VH - 70, ground.parentElement.getBoundingClientRect().top - 90));

  // Wanderers (harpy, demon eye) use the game's bat-style flight: accelerate toward a point with
  // little braking, overshoot, swing back. On wide screens they roam a side margin; on phones they
  // rest off screen and now and then fly across.
  function waypoint(f) {
    if (!wide) {
      const z = f.x < VW / 2 ? zones[1] : zones[0];
      f.tx = rand(z[0], z[1]);
      f.ty = rand(skyTop(), VH * 0.7);
      f.until = performance.now() + rand(14000, 28000);
      return;
    }
    let z = zones.find(([a, b]) => f.x >= a - 120 && f.x <= b + 120) || zones[Math.floor(Math.random() * zones.length)];
    if (Math.random() < 0.08) z = zones[Math.floor(Math.random() * zones.length)];
    f.tx = rand(z[0], z[1]);
    f.ty = rand(skyTop(), skyFloor());
    f.until = performance.now() + rand(3500, 7000);
  }
  function makeWanderer(key) {
    return { kind: 'wander', key, x: 0, y: 0, vx: 0, vy: 0, right: false, accel: 170, max: 110, flap: Math.random() * 6 };
  }
  // speeds are per unit of scale, so bigger critters keep the same pace relative to their size
  function pace(f) {
    if (f.kind === 'wander') { f.accelS = f.accel * SCALE; f.maxS = f.max * SCALE; }
  }

  // Critters crossing the sky, each with its own way of flying: birds flap straight across with
  // a gentle rise and fall, butterflies flutter slowly and unevenly, the dragonfly darts and
  // hovers, the pixie drifts on long waves.
  const CROSSERS = [
    { key: 'bird', fly: 'bird', speed: 95, fps: 10, phone: true },
    { key: 'bluejay', fly: 'bird', speed: 110, fps: 10 },
    { key: 'cardinal', fly: 'bird', speed: 100, fps: 10 },
    { key: 'monarch', fly: 'butterfly', speed: 34, fps: 8, phone: true },
    { key: 'sulphur', fly: 'butterfly', speed: 30, fps: 8 },
    { key: 'dragonfly', fly: 'dart', speed: 230, fps: 20 },
    { key: 'pixie', fly: 'drift', speed: 55, fps: 8 },
  ];
  function makeCrosser(c) {
    return { kind: 'cross', ...c, x: -999, y: 0, hidden: true, wait: rand(0.5, wide ? 9 : 14), frame: 0 };
  }
  function launch(c) {
    c.dir = Math.random() < 0.5 ? 1 : -1;
    c.x = c.dir > 0 ? -40 : VW + 40;
    c.base = rand(skyTop(), skyTop() + (skyFloor() - skyTop()) * 0.8);
    c.y = c.base; c.phase = Math.random() * 6; c.hidden = false; c.mode = 'dash'; c.left = 0; c.vy = 0;
  }
  function stepCrosser(c, dt, t) {
    if (c.hidden) { c.wait -= dt; if (c.wait <= 0) launch(c); return; }
    c.frame += dt * c.fps;
    const S = SCALE;
    if (c.fly === 'bird') {
      c.x += c.dir * c.speed * S * dt;
      c.y = c.base + Math.sin(c.x / (90 * S) + c.phase) * 10 * S;
    } else if (c.fly === 'butterfly') {
      c.x += c.dir * c.speed * S * dt * (0.6 + 0.8 * Math.abs(Math.sin(t / 900 + c.phase)));
      c.y = c.base + (Math.sin(t / 420 + c.phase) * 18 + Math.sin(t / 160 + c.phase * 2) * 5) * S;
    } else if (c.fly === 'dart') {
      c.left -= dt;
      if (c.left <= 0) {
        c.mode = c.mode === 'dash' ? 'hover' : 'dash';
        c.left = c.mode === 'dash' ? rand(0.2, 0.45) : rand(0.4, 1.1);
        c.vy = rand(-70, 70);
      }
      if (c.mode === 'dash') { c.x += c.dir * c.speed * S * dt; c.y += c.vy * S * dt; }
      else c.y += Math.sin(t / 60) * 0.4 * S;
      c.y = Math.max(skyTop(), Math.min(skyFloor(), c.y));
    } else {
      c.x += c.dir * c.speed * S * dt;
      c.y = c.base + Math.sin(t / 650 + c.phase) * 30 * S;
    }
    if (c.x < -80 || c.x > VW + 80) { c.hidden = true; c.wait = wide ? rand(4, 14) : rand(12, 26); }
  }

  // Wyvern (worm AI): the head flies at a near constant speed and can only turn so fast, and the
  // body follows. Fifteen segments as in the game: head, body, legs, six bodies, legs, two bodies,
  // then the three tail pieces; GAPS are centre-to-centre distances measured off the wiki's
  // full-length picture.
  const WYVERN = ['head', 'body', 'legs', 'body', 'body', 'body', 'body', 'body', 'body', 'legs', 'body', 'body', 'body2', 'body3', 'tail'];
  const GAPS = [0, 62, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 39, 38, 66];
  const I2 = WYVERN.indexOf('body2'), I3 = WYVERN.indexOf('body3'), IT = WYVERN.indexOf('tail');
  // where the spine runs across each texture (the legs and head are wider on one side)
  const SPINE = { head: 20, legs: 16, body: 16, body2: 14, body3: 10, tail: 6 };
  function makeWyvern() {
    const segs = WYVERN.map((key) => ({ key, x: 0, y: 0, a: 0 }));
    return { kind: 'wyvern', x: 0, y: 0, ang: 0, v: 150, turn: 1.0, segs, hidden: true, wait: 0.4 };
  }
  // lay the wyvern out straight behind its head, so it never appears in a heap
  function layStraight(f, x, y, ang) {
    f.x = x; f.y = y; f.ang = ang;
    let d = 0;
    f.segs.forEach((s, i) => { d += GAPS[i] * SCALE; s.x = x - Math.cos(ang) * d; s.y = y - Math.sin(ang) * d; s.a = ang; });
    f.left = Math.cos(ang) < -0.35;
  }
  // It patrols on long routes, sweeping the sky as in the game: up or down a side margin
  // (across the screen on phones) in a gentle S until its whole body has left; then it waits
  // a moment and comes back the other way, often on the other side.
  function route(f, dir) {
    f.hidden = false;
    if (wide) {
      const z = zones[Math.floor(Math.random() * zones.length)];
      f.lane = (z[0] + z[1]) / 2; f.half = (z[1] - z[0]) * 0.35;
      f.dir = dir || (Math.random() < 0.5 ? 1 : -1);
      layStraight(f, f.lane, f.dir > 0 ? -60 : VH + 60, f.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    } else {
      f.laneY = rand(skyTop(), VH * 0.6);
      f.dir = dir || (Math.random() < 0.5 ? 1 : -1);
      layStraight(f, f.dir > 0 ? -60 : VW + 60, f.laneY, f.dir > 0 ? 0 : Math.PI);
    }
  }
  function stepWyvern(f, dt, t) {
    if (f.hidden) { f.wait -= dt; if (f.wait <= 0) route(f, f.next); return; }
    let tx, ty;
    if (wide) { tx = f.lane + Math.sin(t / 700) * f.half; ty = f.dir > 0 ? VH + 2000 : -2000; }
    else { tx = f.dir > 0 ? VW + 2000 : -2000; ty = f.laneY + Math.sin(t / 600) * 40; }
    let diff = Math.atan2(ty - f.y, tx - f.x) - f.ang;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const turn = f.turn * dt;
    f.ang += Math.max(-turn, Math.min(turn, diff));
    f.x += Math.cos(f.ang) * f.v * SCALE * dt; f.y += Math.sin(f.ang) * f.v * SCALE * dt;
    // one facing for the whole body, switched only once the heading is clearly left or right
    const c = Math.cos(f.ang);
    if (c < -0.35) f.left = true; else if (c > 0.35) f.left = false;
    const segs = f.segs;
    segs[0].x = f.x; segs[0].y = f.y; segs[0].a = f.ang;
    for (let i = 1; i < segs.length; i++) {
      const a = segs[i - 1], b = segs[i];
      const gap = GAPS[i] * SCALE;
      const ex = a.x - b.x, ey = a.y - b.y, el = Math.hypot(ex, ey) || 1;
      b.a = Math.atan2(ey, ex);
      b.x = a.x - ex / el * gap; b.y = a.y - ey / el * gap;
    }
    // once the whole body is off screen, rest a moment, then come back the other way
    const tl = segs[segs.length - 1], m = 80;
    const gone = wide ? (f.dir > 0 ? tl.y > VH + m : tl.y < -m) : (f.dir > 0 ? tl.x > VW + m : tl.x < -m);
    if (gone) { f.hidden = true; f.next = -f.dir; f.wait = wide ? rand(1.5, 5) : rand(12, 24); }
  }

  // The whole wyvern is drawn as one strip: a smooth curve from the tip of the snout through
  // every segment centre to the tip of the tail, painted one texture row at a time with each
  // row turned to the curve. Head, body, the narrowing bodies and the tail all bend together,
  // so no rigid piece ever sticks out of a bend.
  function drawWyvern(f) {
    if (f.hidden) return;
    const S = SCALE, segs = f.segs, n = segs.length;
    const hd = segs[0], tl = segs[n - 1], pre = segs[n - 2];
    const ux = tl.x - pre.x, uy = tl.y - pre.y, ul = Math.hypot(ux, uy) || 1;
    const P = [{ x: hd.x + Math.cos(hd.a) * 50 * S, y: hd.y + Math.sin(hd.a) * 50 * S }];
    for (const s of segs) P.push(s);
    P.push({ x: tl.x + ux / ul * 48 * S, y: tl.y + uy / ul * 48 * S });
    // arc length at each control point; P[i + 1] is segment i
    const at = [0];
    for (let k = 1; k < P.length; k++) at.push(at[k - 1] + Math.hypot(P[k].x - P[k - 1].x, P[k].y - P[k - 1].y));
    const headEnd = 100 * S, b2 = (at[I2] + at[I2 + 1]) / 2, b3 = (at[I3] + at[I3 + 1]) / 2, tailStart = at[IT + 1] - 48 * S;
    const fx = f.left ? -1 : 1, ROW0 = 7, PERIOD = 30;
    let lastRow = -1;
    for (let k = 0; k < P.length - 1; k++) {
      const p0 = P[Math.max(0, k - 1)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(P.length - 1, k + 2)];
      const len = at[k + 1] - at[k], count = Math.max(1, Math.ceil(len));
      for (let j = 0; j < count; j++) {
        const s = at[k] + len * j / count, r = Math.floor(s / S);
        if (r === lastRow) continue;
        lastRow = r;
        const t = j / count, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
        const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
        const dx = 0.5 * ((-p0.x + p2.x) + 2 * (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t + 3 * (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t2);
        const dy = 0.5 * ((-p0.y + p2.y) + 2 * (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t + 3 * (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t2);
        // which texture row lies here, counting from the snout
        let key, row;
        if (s < headEnd) { key = 'head'; row = r; }
        else if (s < tailStart) {
          key = s < b2 ? 'body' : s < b3 ? 'body2' : 'body3';
          row = ROW0 + (r - Math.floor(headEnd / S)) % PERIOD;
        } else { key = 'tail'; row = Math.min(95, r - Math.floor(tailStart / S)); }
        const tex = img[key]; if (!tex) continue;
        // rows run snout to tail, so the texture's "up" points back along the curve
        const a = Math.atan2(-dy, -dx) + Math.PI / 2, c = Math.cos(a), sn = Math.sin(a);
        sctx.setTransform(dpr * c * fx, dpr * sn * fx, -dpr * sn, dpr * c, dpr * x, dpr * y);
        sctx.drawImage(tex.im, 0, row, tex.w, 1, -SPINE[key] * S, -0.3 * S, tex.w * S, 1.6 * S);
      }
    }
    // the legs hang from the strip: only the leg itself, beside the spine
    const legs = img.legs;
    if (legs) for (const sg of segs) {
      if (sg.key !== 'legs') continue;
      const a = sg.a + Math.PI / 2, c = Math.cos(a), sn = Math.sin(a), cut = 32;
      sctx.setTransform(dpr * c * fx, dpr * sn * fx, -dpr * sn, dpr * c, dpr * sg.x, dpr * sg.y);
      sctx.drawImage(legs.im, cut, 0, legs.w - cut, legs.h, (cut - SPINE.legs) * S, -legs.h * S / 2, (legs.w - cut) * S, legs.h * S);
    }
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function stepWanderer(f, dt, t) {
    if (t > f.until || (wide && Math.hypot(f.tx - f.x, f.ty - f.y) < 30)) waypoint(f);
    const dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy) || 1;
    pace(f);
    f.vx += dx / d * f.accelS * dt;
    f.vy += dy / d * f.accelS * dt;
    const drag = d < 60 ? 1.6 : 0.35;
    f.vx -= f.vx * drag * dt; f.vy -= f.vy * drag * dt;
    const sp = Math.hypot(f.vx, f.vy);
    if (sp > f.maxS) { f.vx *= f.maxS / sp; f.vy *= f.maxS / sp; }
    f.x += f.vx * dt; f.y += f.vy * dt;
    f.flap += dt * 12.5;
    if (f.vx > 12) f.right = true; else if (f.vx < -12) f.right = false;
  }
  function stepFlier(f, dt, t) {
    if (f.kind === 'wyvern') stepWyvern(f, dt, t);
    else if (f.kind === 'cross') stepCrosser(f, dt, t);
    else stepWanderer(f, dt, t);
  }
  function drawFlier(f) {
    if (f.kind === 'wyvern') { drawWyvern(f); return; }
    if (f.hidden) return;
    if (f.kind === 'cross') { draw(sctx, f.key, Math.floor(f.frame), f.x, f.y, f.dir > 0, SCALE); return; }
    if (f.key === 'eye') {
      // the demon eye turns to look where it flies (its texture looks left)
      const s = img.eye; if (!s) return;
      const a = Math.atan2(f.vy, f.vx) + Math.PI;
      sctx.save(); sctx.translate(snap(f.x), snap(f.y)); sctx.rotate(a);
      sctx.drawImage(s.im, (Math.floor(f.flap / 2) % s.frames) * s.w, 0, s.w, s.h, -s.w * SCALE / 2, -s.h * SCALE / 2, s.w * SCALE, s.h * SCALE);
      sctx.restore();
      return;
    }
    draw(sctx, f.key, Math.floor(f.flap), f.x, f.y, f.right, SCALE);
  }
  function place(f) {
    if (f.kind !== 'wander') return;
    const z = zones[Math.floor(Math.random() * zones.length)];
    f.x = rand(z[0], z[1]); f.y = rand(skyTop(), VH - 100);
    waypoint(f);
  }

  // ── ground ──
  let gctx, GW;
  // the game's textures already double every art pixel, so 1.5 draws each one as exactly 3 px
  let G = 1.5, GH = 200;
  const walkers = [];
  const hearts = [];
  const GRAVITY = 1080; // the game's 0.3 px per tick², in px/s²
  function layoutGround() {
    GW = ground.parentElement.clientWidth;
    G = unitScale();
    GH = Math.round(200 * G / 1.5);
    gctx = fit(ground, GW, GH);
  }
  // one of each, as the game would have them: walk frames, pixels walked per frame (so feet never
  // slide), walking speed in px/s, how long they wander and rest, and which way the art faces.
  // Wide ground gets the whole cast, a phone's narrow strip the first six.
  const CAST = [
    { key: 'merchant', walk: [2, 14], idle: 0, air: 1, stride: 4, speed: 42, go: [1.5, 4.5], rest: [1.5, 5] },
    { key: 'green', slime: true },
    { key: 'bunny', walk: [1, 6], idle: 0, air: 4, stride: 6, speed: 80, go: [0.8, 2.5], rest: [1, 3.5] },
    { key: 'cat', walk: [0, 1], idle: 0, stride: 6, speed: 46, go: [1, 3], rest: [2, 6], bob: true },
    { key: 'duck', walk: [0, 8], idle: 0, stride: 3, speed: 30, go: [1.5, 4], rest: [1.5, 4] },
    { key: 'traveller', walk: [0, 14], idle: 0, stride: 4, speed: 52, go: [2, 5], rest: [1.5, 4], facesRight: true },
    { key: 'dog', walk: [0, 1], idle: 0, stride: 7, speed: 60, go: [1, 3.5], rest: [2, 5], bob: true },
    { key: 'squirrel', walk: [0, 5], idle: 0, stride: 6, speed: 95, go: [0.5, 1.6], rest: [1, 3] },
    { key: 'turtle', walk: [0, 7], idle: 0, stride: 3, speed: 14, go: [3, 7], rest: [2, 5] },
    { key: 'snail', walk: [0, 4], idle: 0, stride: 2, speed: 7, go: [5, 10], rest: [1, 3] },
  ];
  function makeWalkers() {
    const cast = GW < 768 ? CAST.slice(0, 6) : CAST;
    // spread them out along the ground rather than in a clump
    cast.forEach((c, i) => walkers.push({ ...c, kind: c.slime ? 'slime' : 'walker', x: (i + 0.5 + rand(-0.3, 0.3)) * GW / cast.length, dir: Math.random() < 0.5 ? -1 : 1, h: 0, vy: 0, vx: 0, timer: rand(0.5, 3), moving: false, dist: 0, jumps: 0, wobble: 0 }));
  }
  // jumps and gravity grow with the sprites, so a bigger slime hops just as high relative to itself
  function jump(w, vy, vx) { if (w.h > 0 || w.vy > 0) return; w.vy = vy * G / 1.5; w.vx = vx; }
  function stepWalker(w, dt) {
    const airborne = w.h > 0 || w.vy > 0;
    if (airborne) {
      w.vy -= GRAVITY * G / 1.5 * dt; w.h += w.vy * dt; w.x += w.vx * dt;
      if (w.h <= 0) { w.h = 0; w.vy = 0; if (w.kind === 'slime') { w.vx = 0; w.timer = rand(1.2, 2.8); } }
    } else if (w.kind === 'slime') {
      // sit and wobble, wobble faster just before a hop; every third hop is a big one
      w.timer -= dt;
      w.wobble += dt * (w.timer < 0.5 ? 13 : 6.5);
      if (w.timer <= 0) {
        if (Math.random() < 0.3) w.dir *= -1;
        w.jumps++;
        const big = w.jumps % 3 === 0;
        jump(w, big ? 470 : 340, w.dir * (big ? 150 : 120) * G);
      }
    } else {
      // town NPC and critter: stand a while, walk a while, now and then turn round
      w.timer -= dt;
      if (w.timer <= 0) {
        w.moving = !w.moving;
        w.timer = w.moving ? rand(...w.go) : rand(...w.rest);
        if (w.moving && Math.random() < 0.45) w.dir *= -1;
      }
      const top = w.speed * G;
      const want = w.moving ? top * w.dir : 0;
      w.vx += (want - w.vx) * Math.min(1, dt * 5);
      w.x += w.vx * dt;
      w.dist += Math.abs(w.vx * dt);
    }
    if (w.x < 40) { w.x = 40; w.dir = 1; w.vx = Math.abs(w.vx); }
    if (w.x > GW - 40) { w.x = GW - 40; w.dir = -1; w.vx = -Math.abs(w.vx); }
  }
  function frameOf(w) {
    if (w.kind === 'slime') return w.h > 0 ? 1 : Math.floor(w.wobble) % 2;
    if (w.h > 0 && w.air !== undefined) return w.air;
    if (Math.abs(w.vx) < 3) return w.idle;
    return w.walk[0] + Math.floor(w.dist / (w.stride * G)) % w.walk[1];
  }
  function drawWalker(w) {
    const s = img[w.key]; if (!s) return;
    if (w.kind === 'slime') gctx.globalAlpha = 0.86; // slimes are see-through in the game
    // single-frame pets bob a pixel with each step
    const bob = w.bob && Math.abs(w.vx) > 3 ? (Math.floor(w.dist / (w.stride * G)) % 2) * G : 0;
    // feet rest on the grass line at the bottom of the canvas
    draw(gctx, w.key, frameOf(w), w.x, GH - s.h * G / 2 - w.h - bob + 3, (w.dir > 0) !== !!w.facesRight, G);
    gctx.globalAlpha = 1;
  }

  // ── loop ──
  let last = performance.now(), groundOn = false;
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    sctx.clearRect(0, 0, VW, VH);
    for (const f of fliers) { stepFlier(f, dt, t); drawFlier(f); }
    if (groundOn) {
      gctx.clearRect(0, 0, GW, GH);
      for (const w of walkers) { stepWalker(w, dt); drawWalker(w); }
      for (let i = hearts.length - 1; i >= 0; i--) {
        const h = hearts[i]; h.life -= dt; h.y -= 30 * dt;
        if (h.life <= 0) { hearts.splice(i, 1); continue; }
        gctx.globalAlpha = Math.min(1, h.life * 2);
        draw(gctx, 'heart', 0, h.x, h.y, false, G);
        gctx.globalAlpha = 1;
      }
    }
    requestAnimationFrame(frame);
  }
  function drawStill() {
    sctx.clearRect(0, 0, VW, VH);
    fliers.forEach((f) => {
      // held still: the wyvern rests straight along a margin, fully in view
      if (f.segs) { f.hidden = false; layStraight(f, wide ? (zones[0][0] + zones[0][1]) / 2 : VW * 0.8, VH * 0.25, Math.PI / 2); }
      if (f.kind === 'cross') return;
      drawFlier(f);
    });
    gctx.clearRect(0, 0, GW, GH);
    walkers.forEach(drawWalker);
  }

  Promise.all(load).then(() => {
    layoutSky(); layoutGround();
    // phones get a smaller flock, since there everything flies over the text
    fliers.push(makeWanderer('harpy'), makeWyvern());
    if (wide) fliers.push(makeWanderer('harpy'), makeWanderer('eye'));
    for (const c of CROSSERS) if (wide || c.phone) fliers.push(makeCrosser(c));
    fliers.forEach(place);
    makeWalkers();

    addEventListener('resize', () => {
      layoutSky(); layoutGround();
      fliers.forEach((f) => { if (f.kind === 'wander' && (f.x > VW + 200 || f.y > VH)) place(f); });
      walkers.forEach((w) => { if (w.x > GW - 30) w.x = GW - 30; });
      if (still) drawStill();
    });
    if (still) { drawStill(); return; }

    // tap the ground: the nearest critter jumps and a heart floats up
    ground.parentElement.addEventListener('pointerdown', (e) => {
      const x = e.clientX - ground.getBoundingClientRect().left;
      let near = null, best = 100;
      for (const w of walkers) { const d = Math.abs(w.x - x); if (d < best) { best = d; near = w; } }
      if (near) { jump(near, 440, near.vx * 0.5); hearts.push({ x: near.x, y: GH - 110 * G / 1.5, life: 1.2 }); }
    });

    new IntersectionObserver(([e]) => {
      groundOn = e.isIntersecting;
      if (!groundOn) gctx.clearRect(0, 0, GW, GH);
    }, { rootMargin: '200px 0px' }).observe(ground.parentElement);

    requestAnimationFrame(frame);
  });
})();
