// Sky and ground critters: harpies and a sky dragon in the margins, villagers and slimes on the grass.
// Pure decoration on two aria-hidden canvases; with reduced motion they are drawn once and stay still.
(() => {
  const sky = document.querySelector('.sky-critters');
  const ground = document.querySelector('.ground-critters');
  if (!sky || !ground || !sky.getContext) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = getComputedStyle(document.documentElement);
  const tok = (name) => css.getPropertyValue(name).trim();

  // ── sprites: one character per pixel, '.' is empty; a dark outline is added around every shape ──
  const INK = {
    f: '--color-harpy', F: '--color-harpy-dark', h: '--color-harpy-hair', s: '--color-skin', e: '--color-eye',
    y: '--color-talon', W: '--color-dragon', S: '--color-dragon-shade', m: '--color-dragon-mane',
    g: '--color-slime-green', G: '--color-slime-shine', w: '--color-bunny', k: '--color-bunny-pink',
    b: '--color-villager-hair', c: '--color-shirt-green', C: '--color-shirt-red', p: '--color-pants',
    t: '--color-straw', B: '--color-wood-dark', r: '--color-accent',
  };
  const ART = {
    harpyUp: [
      'FF.............',
      '.FFf...........',
      '.fFff....hhh...',
      '..fFff..hhhhh..',
      '..ffFff.hhsse..',
      '...ffFffhhsss..',
      '....fffFfsss...',
      '.....ffFFFf....',
      '......fFFFff...',
      '.......fffff...',
      '........y..y...',
      '.......yy.yy...',
    ],
    harpyDown: [
      '...............',
      '...............',
      '.........hhh...',
      '........hhhhh..',
      '........hhsse..',
      '........hhsss..',
      '.....fffffss...',
      '...fffFFFFf....',
      '..fFFffFFFff...',
      '.fFf...fffff...',
      'fF......y..y...',
      'F......yy.yy...',
    ],
    harpyMid: [
      '...............',
      '...............',
      '.........hhh...',
      '........hhhhh..',
      '........hhsse..',
      'FFf.....hhsss..',
      '.FFffffffsss...',
      '...ffFFFFf.....',
      '......fFFFff...',
      '.......fffff...',
      '........y..y...',
      '.......yy.yy...',
    ],
    dragonHead: [
      '.yy...........',
      '..yyy.........',
      '..mWWWWW......',
      '.mWWWeWWWWWW..',
      'mmWWWWWWWWWWWW',
      'mWWWWWWWS.....',
      '.mWWWWWWWWWW..',
      '..SSSSSSSSS...',
    ],
    dragonBody: [
      '..mm...',
      '.WWWWW.',
      'WWWWWWW',
      'WWWWWWW',
      'WWWWWWW',
      '.SSSSS.',
    ],
    dragonLegs: [
      '..mm...',
      '.WWWWW.',
      'WWWWWWW',
      'WWWWWWW',
      'WWWWWWW',
      '.SSSSS.',
      '.y...y.',
      'yy..yy.',
    ],
    dragonTail: [
      '.mm..',
      'WWWW.',
      'WWWWW',
      '.SSS.',
    ],
    dragonTip: [
      'mm.',
      'Wm.',
      '.S.',
    ],
    slimeSquat: [
      '...gggg...',
      '.gGGggggg.',
      'gGggeggegg',
      'gggggggggg',
      'gggggggggg',
    ],
    slimeTall: [
      '...gg...',
      '..gggg..',
      '.gGgggg.',
      '.gGgggg.',
      'gggeggeg',
      'gggggggg',
      '.gggggg.',
    ],
    bunnySit: [
      '......ww.',
      '......wk.',
      '....wwww.',
      '...wwwewk',
      'wwwwwwww.',
      'wwwwwwww.',
      '.wwwwwww.',
      '..w...ww.',
    ],
    bunnyHop: [
      '.......ww',
      '......wk.',
      '....wwww.',
      '..wwwwewk',
      'wwwwwwww.',
      'wwwwwwwww',
      'w.wwww...',
      'w......w.',
    ],
    farmerA: [
      '..tttt..',
      'tttttttt',
      '.bbsses.',
      '.bbssss.',
      '..ssss..',
      '..cccc..',
      '.cccccs.',
      '.scccc..',
      '..cccc..',
      '..pppp..',
      '..p..p..',
      '..B..B..',
    ],
    farmerB: [
      '..tttt..',
      'tttttttt',
      '.bbsses.',
      '.bbssss.',
      '..ssss..',
      '..cccc..',
      '.cccccs.',
      '.scccc..',
      '..cccc..',
      '..pppp..',
      '.p....p.',
      'BB....BB',
    ],
    villagerA: [
      '..bbbb..',
      '.bbbbbb.',
      '.bbsses.',
      '.bbssss.',
      '..ssss..',
      '..CCCC..',
      '.CCCCCs.',
      '.sCCCC..',
      '..CCCC..',
      '..pppp..',
      '..p..p..',
      '..B..B..',
    ],
    villagerB: [
      '..bbbb..',
      '.bbbbbb.',
      '.bbsses.',
      '.bbssss.',
      '..ssss..',
      '..CCCC..',
      '.CCCCCs.',
      '.sCCCC..',
      '..CCCC..',
      '..pppp..',
      '.p....p.',
      'BB....BB',
    ],
    heart: [
      '.rr.rr.',
      'rrrrrrr',
      'rrrrrrr',
      '.rrrrr.',
      '..rrr..',
      '...r...',
    ],
  };

  const dpr = Math.min(devicePixelRatio || 1, 2);
  // one art pixel is drawn as a whole number of device pixels, near `target` CSS px
  const unit = (target) => Math.max(1, Math.round(target * dpr)) / dpr;

  // tones from one token: lit edge, body, shadow side and a hue-matched outline
  const toneCache = new Map();
  function tone(token, kind) {
    const key = token + kind;
    if (toneCache.has(key)) return toneCache.get(key);
    const raw = tok(token);
    const m = raw.match(/oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)/);
    let out = raw;
    if (m) {
      const L = +m[1], C = +m[2], H = +m[3];
      const mk = (l, c) => `oklch(${Math.max(8, Math.min(99, l)).toFixed(1)}% ${Math.max(0, c).toFixed(3)} ${H})`;
      if (kind === 'hi') out = mk(L + 8, C * 0.85);
      else if (kind === 'lo') out = mk(L - 10, C * 1.08);
      else if (kind === 'line') out = mk(L * 0.55, Math.max(0.02, C * 1.1));
      else if (kind === 'glint') out = mk(97, 0.01);
    }
    toneCache.set(key, out);
    return out;
  }

  // Scale2x: doubles the art and rounds its stair-steps, so every shape gets twice the pixels
  function scale2x(rows) {
    const h = rows.length, w = Math.max(...rows.map((r) => r.length));
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : rows[y][x] || '.');
    const out = Array.from({ length: h * 2 }, () => []);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      out[2 * y][2 * x] = C === A && C !== D && A !== B ? A : P;
      out[2 * y][2 * x + 1] = A === B && A !== C && B !== D ? B : P;
      out[2 * y + 1][2 * x] = D === C && D !== B && C !== A ? C : P;
      out[2 * y + 1][2 * x + 1] = B === D && B !== A && D !== C ? D : P;
    }
    return out;
  }

  // surface texture inside a shape, in detail pixels: feather barbs, hair strands, straw weave, belly scales
  const GRAIN = {
    f: (x, y) => (x + y) % 4 === 0,
    F: (x, y) => (x + y) % 4 === 0,
    h: (x, y) => x % 3 === 0 && y % 2 === 0,
    b: (x, y) => x % 3 === 0 && y % 2 === 0,
    t: (x, y) => (x + 2 * y) % 5 === 0,
    S: (x) => x % 3 === 0,
    m: (x, y) => (x + y) % 3 === 0,
  };

  const cache = new Map();
  // bake a sprite with art pixels of `px` CSS px, optionally mirrored and recoloured; returns {img, w, h} in CSS px.
  // Light comes from the upper left: lit pixels along the top and left edges, a two-pixel shadow along the
  // bottom and right, eyes get a glint, and the outline takes a dark tone of the colour it borders.
  function sprite(name, px, flip = false, swap = {}, part = 'all') {
    const key = [name, px, flip, JSON.stringify(swap), part].join('|');
    if (cache.has(key)) return cache.get(key);
    const grid = scale2x(ART[name]);
    const rows = grid.length, cols = grid[0].length;
    const W = cols + 2, H = rows + 2, d = Math.round(px * dpr);
    const cv = document.createElement('canvas');
    cv.width = W * d; cv.height = H * d;
    const g = cv.getContext('2d');
    const at = (x, y) => { const ch = (grid[y] || [])[x]; return ch && ch !== '.' ? ch : null; };
    const ink = (ch) => swap[ch] || INK[ch];
    const put = (x, y, color) => { g.fillStyle = color; g.fillRect(((flip ? cols - 1 - x : x) + 1) * d, (y + 1) * d, d, d); };
    if (part !== 'fill') {
      for (let y = -1; y <= rows; y++) for (let x = -1; x <= cols; x++) {
        if (at(x, y)) continue;
        const n = at(x, y + 1) || at(x - 1, y) || at(x + 1, y) || at(x, y - 1);
        if (n) put(x, y, tone(ink(n), 'line'));
      }
    }
    if (part !== 'line') {
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const ch = at(x, y); if (!ch) continue;
        const t = ink(ch);
        let kind = 'base';
        if (ch === 'e') kind = at(x, y - 1) !== 'e' && at(x - 1, y) !== 'e' ? 'glint' : 'base';
        else {
          const lit = !at(x, y - 1) || !at(x - 1, y);
          const dark = !at(x, y + 1) || !at(x + 1, y) || !at(x, y + 2);
          if (lit && !dark) kind = 'hi'; else if (dark && !lit) kind = 'lo';
          else if (!lit && !dark && GRAIN[ch] && GRAIN[ch](x, y)) kind = 'lo';
        }
        put(x, y, kind === 'base' ? tok(t) : tone(t, kind));
      }
    }
    const out = { img: cv, w: W * px, h: H * px };
    cache.set(key, out);
    return out;
  }

  function fit(cv, w, h) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    return g;
  }
  const rand = (a, b) => a + Math.random() * (b - a);
  const snap = (v) => Math.round(v);

  // ── sky ──
  let sctx, VW, VH, PX, zones, hudBottom, panel;
  const fliers = [];
  const pointer = { x: 0, y: 0, at: -1e9, overPanel: false };
  let chaser = null;

  function layoutSky() {
    VW = innerWidth; VH = innerHeight;
    // PX is one art pixel; the baked sprites carry two detail pixels per art pixel
    PX = 2 * unit(VW < 768 ? 1 : 1.5);
    sctx = fit(sky, VW, VH);
    const p = document.querySelector('.panel').getBoundingClientRect();
    panel = { l: p.left - 12, r: p.right + 12 };
    hudBottom = document.querySelector('.hud').getBoundingClientRect().bottom;
    const pad = 28;
    zones = [];
    if (panel.l - 2 * pad > 40) zones.push([pad, panel.l - pad]);
    if (VW - panel.r - 2 * pad > 40) zones.push([panel.r + pad, VW - pad]);
    // no room beside the panels (phones): rest just off screen until called
    if (!zones.length) zones.push([-90, -60], [VW + 60, VW + 90]);
  }
  function waypoint(f) {
    // keep to the side it is already on, so wanderers seldom cross the page
    let z = zones.find(([a, b]) => f.x >= a - 80 && f.x <= b + 80) || zones[Math.floor(Math.random() * zones.length)];
    if (Math.random() < 0.08) z = zones[Math.floor(Math.random() * zones.length)];
    f.tx = rand(z[0], z[1]);
    f.ty = rand(Math.max(hudBottom + 40, 60), VH - 60);
    f.until = performance.now() + rand(3500, 7000);
  }

  // Harpy: steers by acceleration with almost no braking, so it overshoots the
  // target, turns and swoops back; flight traces loose loops instead of easing in.
  function makeHarpy() {
    return { kind: 'harpy', x: 0, y: 0, vx: 0, vy: 0, face: 1, accel: 150, max: 95, fastAccel: 520, fastMax: 270, phase: Math.random() * 6, flap: Math.random() };
  }
  // Sky dragon: worm-style. The head flies at a near constant speed and can only
  // turn so fast, so it circles and snakes around its target; each segment
  // trails the one ahead at a fixed gap and points at it.
  function makeDragon() {
    const segs = Array.from({ length: 16 }, () => ({ x: 0, y: 0, a: 0 }));
    return { kind: 'dragon', x: 0, y: 0, ang: 0, v: 95, turn: 2.1, fastV: 230, fastTurn: 3.6, face: 1, segs, phase: 0 };
  }
  function place(f) {
    const z = zones[Math.floor(Math.random() * zones.length)];
    f.x = rand(z[0], z[1]); f.y = rand(Math.max(hudBottom + 40, 60), VH - 80);
    if (f.segs) f.segs.forEach((s, i) => { s.x = f.x - i * 6; s.y = f.y; s.a = 0; });
    waypoint(f);
  }

  function chaseTarget(f, t) {
    // the chaser hovers beside the pointer rather than on it
    // (the dragon already circles whatever it chases, so it aims straight at the point)
    const ang = t / 700 + f.phase, orbit = f.kind === 'harpy';
    let x = pointer.x + (orbit ? Math.cos(ang) * 56 : 0), y = pointer.y + (orbit ? Math.sin(ang) * 22 - 24 : 0);
    if (pointer.overPanel && zones[0][0] >= 0) {
      // the pointer is over text: wait at the nearest panel edge, level with it
      const off = orbit ? 34 : 60;
      x = pointer.x - panel.l < panel.r - pointer.x ? panel.l - off : panel.r + off;
      y = pointer.y + Math.sin(ang * 2) * 10;
    }
    return [x, y];
  }

  function stepFlier(f, dt, t) {
    const chasing = f === chaser;
    let tx = f.tx, ty = f.ty;
    if (chasing) [tx, ty] = chaseTarget(f, t);
    else if (t > f.until || Math.hypot(f.tx - f.x, f.ty - f.y) < 30) waypoint(f);
    const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy) || 1;

    if (f.kind === 'harpy') {
      const acc = chasing ? f.fastAccel : f.accel, max = chasing ? f.fastMax : f.max;
      f.vx += dx / d * acc * dt;
      f.vy += dy / d * acc * dt;
      // a touch of drag so loops stay tight, more when close in
      const drag = d < 60 ? 1.6 : 0.35;
      f.vx -= f.vx * drag * dt; f.vy -= f.vy * drag * dt;
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > max) { f.vx *= max / sp; f.vy *= max / sp; }
      // each downstroke lifts it a little
      const rate = chasing ? 7 : 4.2;
      const prev = f.flap; f.flap = (f.flap + dt * rate) % 1;
      if (prev < 0.5 && f.flap >= 0.5) f.vy -= chasing ? 30 : 22;
      f.vy += 22 * dt; // gravity between beats
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.vx > 10) f.face = 1; else if (f.vx < -10) f.face = -1;
      return;
    }

    // dragon head: turn toward the target at a capped rate, never stop
    const want = Math.atan2(dy, dx);
    let diff = want - f.ang;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const turn = (chasing ? f.fastTurn : f.turn) * dt;
    // a slow wobble keeps a straight run from looking ruled
    f.ang += Math.max(-turn, Math.min(turn, diff)) + Math.sin(t / 520) * 0.35 * dt;
    const v = chasing ? f.fastV : f.v;
    f.x += Math.cos(f.ang) * v * dt; f.y += Math.sin(f.ang) * v * dt;
    f.face = Math.cos(f.ang) < 0 ? -1 : 1;
    const segs = f.segs;
    segs[0].x = f.x; segs[0].y = f.y; segs[0].a = f.ang;
    const gap = PX * 4.6;
    for (let i = 1; i < segs.length; i++) {
      const a = segs[i - 1], b = segs[i];
      const ex = a.x - b.x, ey = a.y - b.y, el = Math.hypot(ex, ey) || 1;
      b.a = Math.atan2(ey, ex);
      b.x = a.x - ex / el * gap; b.y = a.y - ey / el * gap;
    }
  }

  function drawRot(s, x, y, ang, flipY) {
    sctx.save();
    sctx.translate(snap(x), snap(y));
    sctx.rotate(ang);
    if (flipY) sctx.scale(1, -1);
    sctx.drawImage(s.img, -s.w / 2, -s.h / 2, s.w, s.h);
    sctx.restore();
  }

  function drawFlier(f, t) {
    if (f.kind === 'harpy') {
      // four-frame beat: up, level, down, level
      const frame = ['harpyUp', 'harpyMid', 'harpyDown', 'harpyMid'][Math.floor(f.flap * 4) % 4];
      const s = sprite(frame, PX / 2, f.face < 0);
      sctx.drawImage(s.img, snap(f.x - s.w / 2), snap(f.y - s.h / 2), s.w, s.h);
      return;
    }
    // dragon: every outline first, then every fill, so the body reads as one shape
    const n = f.segs.length;
    const name = (i) => (i === 0 ? 'dragonHead' : i >= n - 1 ? 'dragonTip' : i >= n - 3 ? 'dragonTail' : i % 4 === 2 ? 'dragonLegs' : 'dragonBody');
    for (const part of ['line', 'fill']) {
      for (let i = n - 1; i >= 0; i--) {
        const sg = f.segs[i];
        // sprites point right; heading left, mirror top to bottom so the mane stays up
        drawRot(sprite(name(i), PX / 2, false, {}, part), sg.x, sg.y, sg.a, Math.cos(sg.a) < 0);
      }
    }
  }

  // ── ground ──
  let gctx, GW;
  const GH = 130;
  let GPX = 3;
  const walkers = [];
  const hearts = [];
  function layoutGround() {
    GW = ground.parentElement.clientWidth;
    GPX = 2 * unit(GW < 768 ? 1.25 : 1.5);
    gctx = fit(ground, GW, GH);
  }
  function makeWalkers() {
    const spec = [
      { kind: 'walker', a: 'farmerA', b: 'farmerB', speed: 30 },
      { kind: 'walker', a: 'villagerA', b: 'villagerB', speed: 26 },
      { kind: 'slime', swap: {} },
      { kind: 'slime', swap: { g: '--color-slime-blue' } },
      { kind: 'slime', swap: { g: '--color-slime-pink' } },
      { kind: 'bunny' },
    ];
    for (const s of spec) walkers.push({ ...s, x: rand(40, GW - 40), dir: Math.random() < 0.5 ? -1 : 1, h: 0, vy: 0, vx: 0, wait: rand(0, 2), walk: rand(2, 6) });
  }
  function hop(w, strength) {
    if (w.h > 0) return;
    w.vy = strength;
    w.vx = w.dir * (w.kind === 'bunny' ? 95 : w.kind === 'slime' ? 55 : 40);
  }
  function stepWalker(w, dt) {
    const airborne = w.h > 0 || w.vy > 0;
    if (airborne) {
      w.vy -= 620 * dt; w.h += w.vy * dt; w.x += w.vx * dt;
      if (w.h <= 0) { w.h = 0; w.vy = 0; w.vx = 0; w.land = 0.18; w.wait = w.kind === 'walker' ? 0 : rand(0.6, 2.2); }
    } else if (w.kind === 'walker') {
      if (w.wait > 0) w.wait -= dt;
      else {
        w.x += w.dir * w.speed * dt; w.walk -= dt;
        if (w.walk <= 0) { w.wait = rand(1, 3); w.walk = rand(2, 6); if (Math.random() < 0.5) w.dir *= -1; }
      }
    } else {
      w.wait -= dt;
      if (w.land > 0) w.land -= dt;
      if (w.wait <= 0) {
        if (Math.random() < 0.25) w.dir *= -1;
        hop(w, w.kind === 'bunny' ? 150 : 190);
      }
    }
    if (w.x < 20) { w.x = 20; w.dir = 1; w.vx = Math.abs(w.vx); }
    if (w.x > GW - 20) { w.x = GW - 20; w.dir = -1; w.vx = -Math.abs(w.vx); }
  }
  function drawWalker(w, t) {
    let name;
    if (w.kind === 'walker') name = w.wait > 0 || w.h > 0 ? w.a : (Math.floor(t / 220) % 2 ? w.b : w.a);
    else if (w.kind === 'slime') name = w.h > 0 ? 'slimeTall' : 'slimeSquat';
    else name = w.h > 0 ? 'bunnyHop' : 'bunnySit';
    const s = sprite(name, GPX / 2, w.dir < 0, w.swap || {});
    // feet rest on the grass line at the bottom of the canvas
    gctx.drawImage(s.img, snap(w.x - s.w / 2), snap(GH - s.h - w.h + GPX / 2), s.w, s.h);
  }

  // ── loop ──
  let last = performance.now(), groundOn = false;
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (chaser && t - pointer.at > 3000) { waypoint(chaser); chaser = null; }
    sctx.clearRect(0, 0, VW, VH);
    for (const f of fliers) { stepFlier(f, dt, t); drawFlier(f, t); }
    if (groundOn) {
      gctx.clearRect(0, 0, GW, GH);
      for (const w of walkers) { stepWalker(w, dt); drawWalker(w, t); }
      for (let i = hearts.length - 1; i >= 0; i--) {
        const h = hearts[i]; h.life -= dt; h.y -= 18 * dt;
        if (h.life <= 0) { hearts.splice(i, 1); continue; }
        const s = sprite('heart', 1);
        gctx.drawImage(s.img, snap(h.x - s.w / 2), snap(h.y), s.w, s.h);
      }
    }
    requestAnimationFrame(frame);
  }
  function drawStill() {
    sctx.clearRect(0, 0, VW, VH);
    fliers.forEach((f) => drawFlier(f, 0));
    gctx.clearRect(0, 0, GW, GH);
    walkers.forEach((w) => drawWalker(w, 0));
  }

  layoutSky(); layoutGround();
  fliers.push(makeHarpy(), makeHarpy(), makeDragon());
  fliers.forEach(place);
  makeWalkers();

  addEventListener('resize', () => {
    layoutSky(); layoutGround();
    fliers.forEach((f) => { if (f.x > VW + 120 || f.y > VH) place(f); });
    walkers.forEach((w) => { if (w.x > GW - 20) w.x = GW - 20; });
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

  // tap the ground: the nearest critter jumps and shows a heart
  ground.parentElement.addEventListener('pointerdown', (e) => {
    const x = e.clientX - ground.getBoundingClientRect().left;
    let near = null, best = 90;
    for (const w of walkers) { const d = Math.abs(w.x - x); if (d < best) { best = d; near = w; } }
    if (near) { hop(near, 260); hearts.push({ x: near.x, y: GH - 70, life: 1 }); }
  });

  new IntersectionObserver(([e]) => {
    groundOn = e.isIntersecting;
    if (!groundOn) gctx.clearRect(0, 0, GW, GH);
  }, { rootMargin: '200px 0px' }).observe(ground.parentElement);

  requestAnimationFrame(frame);
})();
