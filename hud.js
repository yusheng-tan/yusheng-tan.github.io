// The status corner, read like Terraria's info accessories: the watch tells Chicago's time, the
// compass where that is, and the weather radio its temperature. The minimap opens into the full
// world map, as the game's M key does, where coins mark how many visits came from each region.
(() => {
  const status = document.querySelector('.status');
  if (!status) return;
  const out = {};
  status.querySelectorAll('[data-info]').forEach((el) => { out[el.dataset.info] = el; });
  const set = (k, text) => { if (out[k] && out[k].textContent !== text) out[k].textContent = text; };

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
  let fs = 1, fx = 0, fy = 0, fitS = 1, coins = [];
  function place() {
    // keep some of the world on screen whichever way it is dragged
    const w = TW * fs, h = TH * fs, vw = view.clientWidth, vh = view.clientHeight;
    fx = w <= vw ? (vw - w) / 2 : Math.min(0, Math.max(vw - w, fx));
    fy = h <= vh ? (vh - h) / 2 : Math.min(0, Math.max(vh - h, fy));
    full.style.transform = `translate(${fx}px, ${fy}px) scale(${fs})`;
    me.style.transform = `translate(${fx + CX * fs}px, ${fy + CY * fs}px)`;
    for (const c of coins) c.el.style.transform = `translate(${fx + c.x * fs}px, ${fy + c.y * fs}px)`;
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
  // the browser's own image drag would cancel the pointer partway through
  view.addEventListener('dragstart', (e) => e.preventDefault());
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

  // ── visits: everyone else counts each time they open the site (a refresh in the same tab does
  // not), the owner's browsers never after their first; kept by the Cloudflare counter and shown as
  // the game's coins: copper for a few, silver from 10, gold from 100, platinum from 1,000 ──
  const api = dlg.dataset.counter;
  const total = dlg.querySelector('.wm-total');
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  const coin = (n) => (n >= 1000 ? 'platinum' : n >= 100 ? 'gold' : n >= 10 ? 'silver' : 'copper');
  const plural = (n, w) => `${n.toLocaleString('en-US')} ${w}${n === 1 ? '' : 's'}`;
  function drawCoins({ total: t, places }) {
    const box = dlg.querySelector('.wm-places');
    box.textContent = '';
    coins = places.filter((p) => p.lat <= 84 && p.lat >= -60).map((p) => {
      let country = p.country;
      try { country = names.of(p.country); } catch (e) { /* keep the code */ }
      const where = p.region && p.region !== p.country ? `${p.region}, ${country}` : country;
      const el = document.createElement('span');
      el.className = 'wm-place';
      el.tabIndex = 0;
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', `${where}: ${plural(p.n, 'visit')}`);
      el.innerHTML = `<img src="img/hud/coin-${coin(p.n)}.png" alt="" draggable="false"><span class="wm-count">${p.n.toLocaleString('en-US')}</span><span class="wm-where">${where}</span>`;
      box.append(el);
      const x = (p.lon + 180) / 0.4, y = (84 - p.lat) / 0.4;
      // the home region sits beside the head rather than under it
      if (Math.hypot(x - CX, y - CY) < 8) el.classList.add('is-home');
      return { el, x, y };
    });
    total.textContent = `${plural(t, 'visit')} from ${plural(places.length, 'region')}`;
    total.hidden = !t;
    place();
  }
  async function visitors() {
    if (!api) return;
    // opening the site once with ?me marks a browser as the owner's
    let counted = true;
    try {
      if (new URLSearchParams(location.search).has('me')) localStorage.setItem('owner', '1');
      counted = !!localStorage.getItem('owner') || !!sessionStorage.getItem('counted');
    } catch (e) { /* storage blocked: only read the counts */ }
    try {
      const r = await fetch(`${api}/${counted ? 'stats' : 'hit'}`, { method: counted ? 'GET' : 'POST' });
      if (!r.ok) return;
      drawCoins(await r.json());
      if (!counted) try { sessionStorage.setItem('counted', '1'); } catch (e) { /* counted again on refresh */ }
    } catch (e) { /* the map works without coins */ }
  }
  visitors();

  // ── gold watch: Chicago's time and zone, e.g. 5:17 PM CDT ──
  const clock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  const tick = () => set('time', clock.format(new Date()));
  tick();
  setInterval(tick, 1000);

  // ── weather radio: Chicago's temperature and sky now, from Open-Meteo, every 15 minutes ──
  const SKY = [[0, 'Clear'], [1, 'Mostly clear'], [2, 'Partly cloudy'], [3, 'Cloudy'], [45, 'Fog'], [51, 'Drizzle'],
    [61, 'Rain'], [66, 'Freezing rain'], [71, 'Snow'], [77, 'Snow grains'], [80, 'Showers'], [85, 'Snow showers'], [95, 'Thunderstorm']];
  const sky = (code) => { let t = ''; for (const [c, name] of SKY) if (code >= c) t = name; return t; };
  async function weather() {
    try {
      const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=41.88&longitude=-87.63&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FChicago');
      const { current } = await r.json();
      const f = current.temperature_2m, c = (f - 32) * 5 / 9;
      set('weather', `${Math.round(f)}\u00b0F (${Math.round(c)}\u00b0C), ${sky(current.weather_code)}`);
    } catch (e) { /* keep the last reading */ }
  }
  weather();
  setInterval(weather, 15 * 60 * 1000);
})();
