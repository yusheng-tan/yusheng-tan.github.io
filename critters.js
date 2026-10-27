// Sky and ground critters, using Terraria's own sprites (from terraria.wiki.gg) and motion modelled on
// the game's AI: harpies swoop on inertia, the wyvern steers like a worm, slimes hop, the Merchant
// strolls and the bunny scampers. Pure decoration on two aria-hidden canvases; with reduced motion
// they are drawn once and stay still.
(() => {
  const sky = document.querySelector('.sky-critters');
  const ground = document.querySelector('.ground-critters');
  if (!sky || !ground || !sky.getContext) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = Math.min(devicePixelRatio || 1, 2);

  // sprite sheets: frames side by side, every sprite faces left as in the game's textures
  const SHEETS = {
    harpy: [6, 'harpy'], merchant: [16, 'merchant-walk'], traveller: [14, 'traveller'], bunny: [7, 'bunny'],
    green: [2, 'green-slime'], duck: [8, 'duck'], squirrel: [5, 'squirrel'], turtle: [7, 'turtle'],
    snail: [4, 'snail'], cat: [1, 'cat'], dog: [1, 'dog'], heart: [1, 'heart'],
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
  let sctx, VW, VH, zones, hudBottom, panel, SCALE;
  const fliers = [];
  const pointer = { x: 0, y: 0, at: -1e9, overPanel: false };
  let chaser = null;

  function layoutSky() {
    VW = innerWidth; VH = innerHeight;
    SCALE = half(zoom());
    sctx = fit(sky, VW, VH);
    const p = document.querySelector('.panel').getBoundingClientRect();
    panel = { l: p.left - 12, r: p.right + 12 };
    hudBottom = document.querySelector('.hud').getBoundingClientRect().bottom;
    const pad = 40;
    zones = [];
    if (panel.l - 2 * pad > 40) zones.push([pad, panel.l - pad]);
    if (VW - panel.r - 2 * pad > 40) zones.push([panel.r + pad, VW - pad]);
    // no room beside the panels (phones): rest just off screen until called
    if (!zones.length) zones.push([-160, -120], [VW + 120, VW + 160]);
  }
  function waypoint(f) {
    // keep to the side it is already on, so wanderers seldom cross the page
    let z = zones.find(([a, b]) => f.x >= a - 120 && f.x <= b + 120) || zones[Math.floor(Math.random() * zones.length)];
    if (Math.random() < 0.08) z = zones[Math.floor(Math.random() * zones.length)];
    if (zones[0][0] < 0) {
      // no margins (phones): rest off one edge, then every so often fly across to the other
      z = f.x < VW / 2 ? zones[1] : zones[0];
      f.tx = rand(z[0], z[1]);
      f.ty = rand(Math.max(hudBottom + 40, 80), VH * 0.7);
      f.until = performance.now() + rand(14000, 28000);
      return;
    }
    // stay in the sky: above the grass once the ground scrolls into view
    const top = Math.max(hudBottom + 60, 80);
    const floor = Math.max(top + 60, Math.min(VH - 80, ground.parentElement.getBoundingClientRect().top - 90));
    f.tx = rand(z[0], z[1]);
    f.ty = rand(top, floor);
    f.until = performance.now() + rand(3500, 7000);
  }

  // Harpy (the game's bat-style flyer): accelerates toward its target with little braking, so it
  // overshoots, turns and swoops back; wings beat through all six frames the whole time.
  function makeHarpy() {
    return { kind: 'harpy', x: 0, y: 0, vx: 0, vy: 0, right: false, accel: 170, max: 110, fastAccel: 560, fastMax: 300, flap: Math.random() * 6, phase: Math.random() * 6 };
  }
  // Wyvern (worm AI): the head flies at a near constant speed and can only turn so fast, so it
  // circles and snakes; each segment keeps a fixed gap to the one ahead and points at it.
  // laid out as the wiki's full-length wyvern: head, body, legs, four bodies, legs, body, the two
  // narrowing bodies, tail. GAPS follow the centre-to-centre distances in that picture, with the
  // body links drawn a little closer so bends never open a seam on the outside of a curve
  const WYVERN = ['head', 'body', 'legs', 'body', 'body', 'body', 'body', 'legs', 'body', 'body2', 'body3', 'tail'];
  const GAPS = [0, 62, 36, 36, 36, 36, 36, 36, 36, 39, 38, 66];
  // where the spine runs across each texture (the legs and head are wider on one side), read off
  // the same picture; drawing every part on its spine is what joins them into one body
  const SPINE = { head: 20, legs: 16, body: 16, body2: 14, body3: 10, tail: 6 };
  function makeWyvern() {
    const segs = WYVERN.map((key) => ({ key, x: 0, y: 0, a: 0 }));
    // wide arcs, as in the game: a turning radius near 150 px both cruising and chasing
    return { kind: 'wyvern', x: 0, y: 0, ang: 0, v: 150, turn: 1.0, fastV: 300, fastTurn: 2.0, segs, phase: 0 };
  }
  function place(f) {
    const z = zones[Math.floor(Math.random() * zones.length)];
    f.x = rand(z[0], z[1]); f.y = rand(Math.max(hudBottom + 60, 80), VH - 100);
    if (f.segs) f.segs.forEach((s, i) => { s.x = f.x; s.y = f.y + i * 8; s.a = -Math.PI / 2; });
    waypoint(f);
  }

  function chaseTarget(f, t) {
    // a harpy hovers beside the pointer; the wyvern circles whatever it chases on its own
    const ang = t / 700 + f.phase, orbit = f.kind === 'harpy';
    let x = pointer.x + (orbit ? Math.cos(ang) * 70 : 0), y = pointer.y + (orbit ? Math.sin(ang) * 26 - 30 : 0);
    if (pointer.overPanel && zones[0][0] >= 0) {
      // the pointer is over text: wait at the nearest panel edge, level with it
      const off = orbit ? 50 * SCALE : 80;
      x = pointer.x - panel.l < panel.r - pointer.x ? panel.l - off : panel.r + off;
      y = pointer.y + Math.sin(ang * 2) * 10;
    }
    return [x, y];
  }

  function stepFlier(f, dt, t) {
    const chasing = f === chaser;
    let tx = f.tx, ty = f.ty;
    if (chasing) [tx, ty] = chaseTarget(f, t);
    else if (t > f.until || (zones[0][0] >= 0 && Math.hypot(f.tx - f.x, f.ty - f.y) < 30)) waypoint(f);
    const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy) || 1;

    if (f.kind === 'harpy') {
      const acc = chasing ? f.fastAccel : f.accel, max = chasing ? f.fastMax : f.max;
      f.vx += dx / d * acc * dt;
      f.vy += dy / d * acc * dt;
      const drag = d < 60 ? 1.6 : 0.35;
      f.vx -= f.vx * drag * dt; f.vy -= f.vy * drag * dt;
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > max) { f.vx *= max / sp; f.vy *= max / sp; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      // 80 ms a frame, a little quicker in pursuit
      f.flap += dt * (chasing ? 16 : 12.5);
      if (f.vx > 12) f.right = true; else if (f.vx < -12) f.right = false;
      return;
    }

    let diff = Math.atan2(dy, dx) - f.ang;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const turn = (chasing ? f.fastTurn : f.turn) * dt;
    f.ang += Math.max(-turn, Math.min(turn, diff)) + Math.sin(t / 520) * 0.35 * dt;
    const v = chasing ? f.fastV : f.v;
    f.x += Math.cos(f.ang) * v * dt; f.y += Math.sin(f.ang) * v * dt;
    // one facing for the whole body, switched only once the heading is clearly left or right,
    // so the fin never flickers from side to side on a climb or a dive
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
  }

  function drawFlier(f) {
    if (f.kind === 'harpy') { draw(sctx, 'harpy', Math.floor(f.flap), f.x, f.y, f.right, SCALE); return; }
    // textures point up, so every part turns a quarter past its heading, and mirrors when
    // heading left so the fin stays on top
    const S = SCALE;
    const place = (x, y, a) => {
      sctx.save();
      sctx.translate(x, y);
      sctx.rotate(a + Math.PI / 2);
      if (f.left) sctx.scale(-1, 1);
    };
    const whole = (key, x, y, a) => {
      const t = img[key]; if (!t) return;
      place(snap(x), snap(y), a);
      sctx.drawImage(t.im, -SPINE[key] * S, -t.h * S / 2, t.w * S, t.h * S);
      sctx.restore();
    };
    const segs = f.segs, n = segs.length;
    const head = segs[0], tail = segs[n - 1], last = segs[n - 2];

    // The body is one band, not plates: a smooth curve through the body centres, painted a
    // thin slice of texture at a time, each slice turned to the curve, so bends stay whole.
    const pts = [];
    const toward = (p, q, d) => { const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1; return { x: p.x + dx / l * d, y: p.y + dy / l * d }; };
    const flat = (k) => (k === 'legs' || k === 'head' ? 'body' : k);
    pts.push({ ...toward(segs[1], head, 30 * S), key: 'body' });          // under the neck
    for (let i = 1; i < n - 1; i++) pts.push({ x: segs[i].x, y: segs[i].y, key: flat(segs[i].key) });
    pts.push({ ...toward(last, tail, 22 * S), key: 'body3' });            // into the tail's root
    whole('tail', tail.x, tail.y, tail.a);
    const ROW0 = 7, PERIOD = 30, step = 1.5;
    let along = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(pts.length - 1, k + 2)];
      const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const count = Math.max(1, Math.ceil(len / step));
      for (let j = 0; j < count; j++) {
        const t = j / count, t2 = t * t, t3 = t2 * t;
        // Catmull-Rom position and tangent
        const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
        const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
        const tx = 0.5 * ((-p0.x + p2.x) + 2 * (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t + 3 * (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t2);
        const ty = 0.5 * ((-p0.y + p2.y) + 2 * (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t + 3 * (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t2);
        // the band runs from the neck (k = 0) toward the tail; the slice faces back up the curve
        const key = t < 0.5 ? p1.key : p2.key, tex = img[key];
        if (tex) {
          const row = ROW0 + Math.floor(along / S) % PERIOD;
          place(x, y, Math.atan2(-ty, -tx));
          sctx.drawImage(tex.im, 0, row, tex.w, 1, -SPINE[key] * S, -S, tex.w * S, step + S * 1.5);
          sctx.restore();
        }
        along += len / count;
      }
    }
    // the legs hang from the band: draw only the leg itself, beside the spine
    const legs = img.legs;
    if (legs) for (const sg of segs) {
      if (sg.key !== 'legs') continue;
      place(snap(sg.x), snap(sg.y), sg.a);
      const cut = 32;
      sctx.drawImage(legs.im, cut, 0, legs.w - cut, legs.h, (cut - SPINE.legs) * S, -legs.h * S / 2, (legs.w - cut) * S, legs.h * S);
      sctx.restore();
    }
    whole('head', head.x, head.y, head.a);
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
    G = half(1.5 * zoom());
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
    if (chaser && t - pointer.at > 3000) { waypoint(chaser); chaser = null; }
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
    fliers.forEach((f) => { if (f.segs) for (let i = 0; i < 40; i++) stepFlier(f, 0.03, i * 30); drawFlier(f); });
    gctx.clearRect(0, 0, GW, GH);
    walkers.forEach(drawWalker);
  }

  Promise.all(load).then(() => {
    layoutSky(); layoutGround();
    fliers.push(makeHarpy(), makeHarpy(), makeWyvern());
    fliers.forEach(place);
    makeWalkers();

    addEventListener('resize', () => {
      layoutSky(); layoutGround();
      fliers.forEach((f) => { if (f.x > VW + 200 || f.y > VH) place(f); });
      walkers.forEach((w) => { if (w.x > GW - 30) w.x = GW - 30; });
      if (still) drawStill();
    });
    if (still) { drawStill(); return; }

    function onPointer(e) {
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.at = performance.now();
      pointer.overPanel = !!(e.target.closest && e.target.closest('.panel, .hud'));
      if (!chaser) {
        // the nearest one notices and comes over
        let best = Infinity;
        for (const f of fliers) { const d = Math.hypot(f.x - pointer.x, f.y - pointer.y); if (d < best) { best = d; chaser = f; } }
      }
    }
    // a mouse calls them by moving; a finger only by tapping, so scrolling never does
    const mouse = (e) => { if (e.pointerType !== 'touch') onPointer(e); };
    addEventListener('pointermove', mouse, { passive: true });
    addEventListener('pointerdown', mouse, { passive: true });
    addEventListener('click', onPointer, { passive: true });

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
