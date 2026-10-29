# Visitor map counter

A Cloudflare Worker with a D1 database. The homepage posts to `/hit` each time someone opens it
(not on a refresh, and never from the owner's browsers, marked by visiting once with `?me`); the Worker
adds one to the visitor's region (state or province, from Cloudflare's own geolocation) and the
full map draws `/stats` as Terraria coins. No IP address, city or other visitor detail is stored.

## Deploy (free plan)

```bash
npx wrangler login
npx wrangler d1 create visitor-map          # copy the database_id it prints into wrangler.toml
npx wrangler d1 execute visitor-map --remote --file=schema.sql
npx wrangler deploy                          # prints https://visitor-map.<you>.workers.dev
```

Deployed at https://count.yushengtan.dpdns.org (a free DigitalPlat domain whose nameservers are
Cloudflare's, so mainland China can reach it) and https://visitor-map.yusheng-tan.workers.dev;
`COUNTER` in `imgsrc/build_index.py` lists both, and the page tries them in that order.
The domain is free for a year at a time; renew it on DigitalPlat within 120 days of expiry.

## Test locally

```bash
npx wrangler d1 execute visitor-map --local --file=schema.sql
npx wrangler dev --local --port 8787
```
