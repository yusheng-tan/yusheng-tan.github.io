# Visitor map counter

A Cloudflare Worker with a D1 database. The homepage posts once per browser to `/hit`; the Worker
adds one to the visitor's region (state or province, from Cloudflare's own geolocation) and the
full map draws `/stats` as Terraria coins. No IP address, city or other visitor detail is stored.

## Deploy (free plan)

```bash
npx wrangler login
npx wrangler d1 create visitor-map          # copy the database_id it prints into wrangler.toml
npx wrangler d1 execute visitor-map --remote --file=schema.sql
npx wrangler deploy                          # prints https://visitor-map.<you>.workers.dev
```

Deployed at https://visitor-map.yusheng-tan.workers.dev, which `COUNTER` in `imgsrc/build_index.py` points to.

## Test locally

```bash
npx wrangler d1 execute visitor-map --local --file=schema.sql
npx wrangler dev --local --port 8787
```
