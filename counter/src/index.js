// Visitor counts by region for yusheng-tan.github.io.
// POST /hit counts one visit in the region Cloudflare places them in; GET /stats lists every
// region with its count and a map position. Only the region (state or province), its country and
// a running mean of Cloudflare's approximate coordinates are kept: never an IP or a city.

const ORIGINS = ['https://yusheng-tan.github.io', 'http://localhost:8790'];

function cors(req) {
  const o = req.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

async function stats(env) {
  const { results } = await env.DB.prepare(
    'SELECT country, region, n, lat_sum / n AS lat, lon_sum / n AS lon FROM regions ORDER BY n DESC LIMIT 500'
  ).all();
  const places = results.map((r) => ({
    country: r.country, region: r.region, n: r.n,
    lat: Math.round(r.lat * 10) / 10, lon: Math.round(r.lon * 10) / 10,
  }));
  return { total: places.reduce((s, p) => s + p.n, 0), places };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const headers = { ...cors(req), 'Content-Type': 'application/json' };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });

    if (url.pathname === '/hit' && req.method === 'POST') {
      // only the homepage itself counts
      if (!ORIGINS.includes(req.headers.get('Origin'))) return new Response('{}', { status: 403, headers });
      const cf = req.cf || {};
      const lat = parseFloat(cf.latitude), lon = parseFloat(cf.longitude);
      if (cf.country && Number.isFinite(lat) && Number.isFinite(lon)) {
        const region = cf.region || cf.country;
        await env.DB.prepare(
          `INSERT INTO regions (key, country, region, n, lat_sum, lon_sum) VALUES (?1, ?2, ?3, 1, ?4, ?5)
           ON CONFLICT(key) DO UPDATE SET n = n + 1, lat_sum = lat_sum + ?4, lon_sum = lon_sum + ?5`
        ).bind(`${cf.country}|${region}`, cf.country, region, lat, lon).run();
      }
      return new Response(JSON.stringify(await stats(env)), { headers });
    }

    if (url.pathname === '/stats' && req.method === 'GET') {
      return new Response(JSON.stringify(await stats(env)), { headers: { ...headers, 'Cache-Control': 'public, max-age=60' } });
    }
    return new Response('{}', { status: 404, headers });
  },
};
