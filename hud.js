// The status corner, read like Terraria's info accessories: the watch tells Chicago's time, the
// depth meter how far the view is above the grass, the stopwatch how fast you scroll, the radar how
// many critters are on screen, the sextant tonight's moon and the tally counter your visits.
// Nothing leaves the browser: the visit count lives in this visitor's own storage.
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

  // ── minimap: three zoom steps about Chicago, like the frame's own buttons ──
  const map = status.querySelector('.minimap');
  const world = map.querySelector('.map-world');
  const STEPS = [1, 2, 4], HOME = 1;
  // Chicago on the tiles: 0.4 degrees a pixel, from 180 W and 84 N
  const CX = (-87.63 + 180) / 0.4, CY = (84 - 41.88) / 0.4, MID = 116;
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

  // ── gold watch: the time in Chicago ──
  const clock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });
  // ── sextant: the moon's age from a known new moon, in the game's eight phases ──
  const PHASES = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Third Quarter', 'Waning Crescent'];
  function moon() {
    const days = (Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5;
    const age = ((days % 29.530589) + 29.530589) % 29.530589;
    return PHASES[Math.floor(age / 29.530589 * 8 + 0.5) % 8];
  }
  // ── radar: critters in view, counted by critters.js ──
  function radar() {
    const n = window.critterCensus ? window.critterCensus() : 0;
    return n === 0 ? 'No creatures nearby' : n === 1 ? '1 creature nearby' : `${n} creatures nearby`;
  }
  function tick() {
    set('time', `${clock.format(new Date())} in Chicago`);
    set('moon', moon());
    set('radar', radar());
  }
  tick();
  setInterval(tick, 1000);

  // ── tally counter: this visitor's visits, counted once a browsing session ──
  let visits = 1;
  try {
    visits = parseInt(localStorage.getItem('visits') || '0', 10) || 0;
    if (!sessionStorage.getItem('counted')) { visits += 1; localStorage.setItem('visits', visits); sessionStorage.setItem('counted', '1'); }
    visits = Math.max(1, visits);
  } catch (e) { visits = 1; }
  const nth = (n) => { const t = n % 100, u = n % 10; return n + (t > 10 && t < 14 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'); };
  set('visits', visits === 1 ? 'Your first visit' : `Your ${nth(visits)} visit`);

  // ── depth meter and stopwatch: the game's 16 px tile is 2 feet ──
  const ground = document.querySelector('.ground');
  let lastY = scrollY, lastT = performance.now(), mph = 0, running = false;
  function depth() {
    const px = (ground.getBoundingClientRect().top - innerHeight) / zoom();
    if (px <= 0) return 'On the surface';
    return `${Math.round(px / 8).toLocaleString('en-US')}' above ground`;
  }
  function frame(t) {
    const dt = Math.max(1, t - lastT) / 1000;
    const v = Math.abs(scrollY - lastY) / zoom() / dt;     // px a second
    const want = v / 8 * 0.6818;                            // ft a second to mph
    mph += (want - mph) * Math.min(1, dt * 8);
    lastY = scrollY; lastT = t;
    set('depth', depth());
    set('speed', `${Math.round(mph)} mph`);
    if (mph > 0.5 || v > 0) requestAnimationFrame(frame);
    else { running = false; set('speed', '0 mph'); }
  }
  addEventListener('scroll', () => {
    if (!running) { running = true; lastT = performance.now(); requestAnimationFrame(frame); }
  }, { passive: true });
  set('depth', depth());
  addEventListener('resize', () => set('depth', depth()));
})();
