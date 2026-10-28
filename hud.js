// The status corner, read like Terraria's info accessories: the watch tells Chicago's time, the
// compass where that is, and the depth meter how far the view is above the grass. The minimap
// opens into the full world map, as the game's M key does.
(() => {
  const status = document.querySelector('.status');
  if (!status) return;
  const out = {};
  status.querySelectorAll('[data-info]').forEach((el) => { out[el.dataset.info] = el; });
  const set = (k, text) => { if (out[k] && out[k].textContent !== text) out[k].textContent = text; };
  const zoom = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom')) || 1;

  // ── only where there is sky enough beside the panels ──
  const panel = document.querySelector('.panel');
  function fit() {
    status.classList.remove('is-off');
    const s = status.getBoundingClientRect();
    if (!s.width) return;                       // hidden by the narrow-window rule
    const p = panel.getBoundingClientRect();
    status.classList.toggle('is-off', s.left < p.right + 24);
  }
  fit();
  addEventListener('resize', fit);

  // Chicago on the tiles: 0.4 degrees a pixel, from 180 W and 84 N
  const TW = 900, TH = 360, CX = (-87.63 + 180) / 0.4, CY = (84 - 41.88) / 0.4;

  // ── minimap: three zoom steps about Chicago, like the frame's own buttons ──
  const map = status.querySelector('.minimap');
  const world = map.querySelector('.map-world');
  const STEPS = [1, 2, 4], HOME = 1, MID = 116;
  let step = HOME;
  const btn = (k) => map.querySelector(`[data-map="${k}"]`);
  function show() {
    const s = STEPS[step];
    world.style.setProperty('--s', s);
    world.style.setProperty('--tx', `${MID - CX * s}px`);
    world.style.setProperty('--ty', `${MID - CY * s}px`);
    btn('out').disabled = step === 0;
    btn('in').disabled = step === STEPS.length - 1;
  }
  btn('out').addEventListener('click', () => { step = Math.max(0, step - 1); show(); });
  btn('in').addEventListener('click', () => { step = Math.min(STEPS.length - 1, step + 1); show(); });
  btn('reset').addEventListener('click', () => { step = HOME; show(); });
  show();

  // ── the full map: fit the world to the screen, then drag to move and scroll or pinch to zoom ──
  const dlg = document.querySelector('.worldmap');
  const view = dlg.querySelector('.wm-view');
  const full = dlg.querySelector('.wm-world');
  const me = dlg.querySelector('.wm-me');
  let fs = 1, fx = 0, fy = 0, fitS = 1;
  function place() {
    // keep some of the world on screen whichever way it is dragged
    const w = TW * fs, h = TH * fs, vw = view.clientWidth, vh = view.clientHeight;
    fx = w <= vw ? (vw - w) / 2 : Math.min(0, Math.max(vw - w, fx));
    fy = h <= vh ? (vh - h) / 2 : Math.min(0, Math.max(vh - h, fy));
    full.style.transform = `translate(${fx}px, ${fy}px) scale(${fs})`;
    me.style.transform = `translate(${fx + CX * fs}px, ${fy + CY * fs}px)`;
  }
  function zoomAt(k, px, py) {
    const s = Math.min(fitS * 10, Math.max(fitS, fs * k));
    fx = px - (px - fx) * (s / fs); fy = py - (py - fy) * (s / fs); fs = s;
    place();
  }
  function openMap() {
    if (dlg.open) return;
    dlg.showModal();
    // the whole world across the screen, Chicago in the middle
    fitS = fs = Math.min(view.clientWidth / TW, view.clientHeight / TH);
    fx = view.clientWidth / 2 - CX * fs; fy = view.clientHeight / 2 - CY * fs;
    place();
  }
  map.querySelector('.map-open').addEventListener('click', openMap);
  dlg.querySelector('.wm-close').addEventListener('click', () => dlg.close());
  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'm' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (getComputedStyle(status).display === 'none') return;
    dlg.open ? dlg.close() : openMap();
  });
  view.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = view.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  // one finger drags, two pinch
  const pts = new Map();
  let pinch = 0;
  view.addEventListener('pointerdown', (e) => {
    view.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    view.classList.add('is-dragging');
  });
  view.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    const [lx, ly] = pts.get(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { fx += e.clientX - lx; fy += e.clientY - ly; place(); return; }
    const [a, b] = [...pts.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const r = view.getBoundingClientRect();
    if (pinch) zoomAt(d / pinch, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
    pinch = d;
  });
  const lift = (e) => {
    pts.delete(e.pointerId); pinch = 0;
    if (!pts.size) view.classList.remove('is-dragging');
  };
  view.addEventListener('pointerup', lift);
  view.addEventListener('pointercancel', lift);
  // arrow keys and +/- for those without a mouse
  dlg.addEventListener('keydown', (e) => {
    const step = 60, c = [view.clientWidth / 2, view.clientHeight / 2];
    const k = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (k) { fx += k[0]; fy += k[1]; place(); e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') zoomAt(1.25, ...c);
    else if (e.key === '-') zoomAt(0.8, ...c);
  });
  addEventListener('resize', () => { if (dlg.open) { fitS = Math.min(view.clientWidth / TW, view.clientHeight / TH); fs = Math.max(fs, fitS); place(); } });

  // ── gold watch: Chicago's time and zone, e.g. 5:17 PM CDT ──
  const clock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  const tick = () => set('time', clock.format(new Date()));
  tick();
  setInterval(tick, 1000);

  // ── depth meter: the game's 16 px tile is 2 feet ──
  const ground = document.querySelector('.ground');
  function depth() {
    const px = (ground.getBoundingClientRect().top - innerHeight) / zoom();
    set('depth', px <= 0 ? 'On the surface' : `${Math.round(px / 8).toLocaleString('en-US')}' above ground`);
  }
  let queued = false;
  addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; depth(); });
  }, { passive: true });
  addEventListener('resize', depth);
  depth();
})();
