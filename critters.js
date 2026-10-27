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
    harpy: [6, 'harpy'], merchant: [16, 'merchant-walk'], bunny: [7, 'bunny'],
    green: [2, 'green-slime'], blue: [2, 'blue-slime'], pinky: [2, 'pinky'], heart: [1, 'heart'],
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
    // tail first, head last; textures point up, so turn them a quarter past the heading,
    // and mirror when heading left so the fin stays on top
    for (let i = f.segs.length - 1; i >= 0; i--) {
      const sg = f.segs[i], s = img[sg.key]; if (!s) continue;
      const w = s.w * SCALE, h = s.h * SCALE;
      sctx.save();
      sctx.translate(snap(sg.x), snap(sg.y));
      sctx.rotate(sg.a + Math.PI / 2);
      if (f.left) sctx.scale(-1, 1);
      sctx.drawImage(s.im, -SPINE[sg.key] * SCALE, -h / 2, w, h);
      sctx.restore();
    }
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
  function makeWalkers() {
    const spec = [
      { kind: 'merchant', key: 'merchant' },
      { kind: 'bunny', key: 'bunny' },
      { kind: 'slime', key: 'green' },
      { kind: 'slime', key: 'blue' },
      { kind: 'slime', key: 'pinky' },
      { kind: 'bunny', key: 'bunny' },
    ];
    for (const s of spec) walkers.push({ ...s, x: rand(60, GW - 60), dir: Math.random() < 0.5 ? -1 : 1, h: 0, vy: 0, vx: 0, timer: rand(0.5, 3), moving: false, dist: 0, jumps: 0, wobble: 0 });
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
        w.timer = w.moving ? rand(1.5, 4.5) : rand(1.5, 5);
        if (w.moving && Math.random() < 0.45) w.dir *= -1;
      }
      const top = (w.kind === 'bunny' ? 80 : 42) * G;
      const want = w.moving ? top * w.dir : 0;
      w.vx += (want - w.vx) * Math.min(1, dt * 5);
      w.x += w.vx * dt;
      w.dist += Math.abs(w.vx * dt);
    }
    if (w.x < 40) { w.x = 40; w.dir = 1; w.vx = Math.abs(w.vx); }
    if (w.x > GW - 40) { w.x = GW - 40; w.dir = -1; w.vx = -Math.abs(w.vx); }
  }
  function frameOf(w) {
    const airborne = w.h > 0;
    if (w.kind === 'slime') return airborne ? 1 : Math.floor(w.wobble) % 2;
    if (w.kind === 'merchant') {
      if (airborne) return 1;
      // walk frames 2 to 15, one per 4 px walked so the feet never slide
      return Math.abs(w.vx) > 4 ? 2 + Math.floor(w.dist / (4 * G)) % 14 : 0;
    }
    if (airborne) return 4;
    return Math.abs(w.vx) > 6 ? 1 + Math.floor(w.dist / (6 * G)) % 6 : 0;
  }
  function drawWalker(w) {
    const s = img[w.key]; if (!s) return;
    if (w.kind === 'slime') gctx.globalAlpha = 0.86; // slimes are see-through in the game
    // feet rest on the grass line at the bottom of the canvas
    draw(gctx, w.key, frameOf(w), w.x, GH - s.h * G / 2 - w.h + 3, w.dir > 0, G);
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
