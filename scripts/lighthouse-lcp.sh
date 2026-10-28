#!/usr/bin/env bash
# LCP check for the public gallery (M7: LCP < 2.5 s on 4G). Seeds a gallery with
# 60 photos into the fake storage, serves a production build and runs Lighthouse
# (mobile preset: simulated slow 4G, 4x CPU throttling). Needs Postgres + Redis
# and a Lighthouse install; LIGHTHOUSE=<path to lighthouse bin> (default: PATH).
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-3200}"
export DATABASE_URL="${DATABASE_URL:-postgres://roses:roses@localhost:5432/roses_gallery}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export AUTH_SECRET="perf-only-secret-not-for-production"
export AUTH_URL="http://localhost:$PORT" AUTH_TRUST_HOST=true
export STORAGE_TRANSPORT=fake VIDEO_TRANSPORT=fake MAIL_TRANSPORT=fake BILLING_TRANSPORT=fake
export STORAGE_FAKE_DIR="${STORAGE_FAKE_DIR:-$(mktemp -d)}" E2E_TEST_MODE=1
CHROME="${CHROME_PATH:-/opt/pw-browsers/chromium}"
export CHROME_PATH="$CHROME"

pnpm db:migrate >/dev/null
pnpm exec tsx scripts/perf-seed.ts
pnpm build >/dev/null
pnpm start --port "$PORT" >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
until curl -sf "http://localhost:$PORT/api/health" >/dev/null; do sleep 1; done

"${LIGHTHOUSE:-lighthouse}" "http://localhost:$PORT/g/perf" \
  --only-categories=performance --output=json --output-path="${OUT:-lighthouse.json}" \
  --chrome-flags="--headless --no-sandbox" --quiet
node -e '
const r = require(require("path").resolve(process.env.OUT ?? "lighthouse.json"));
const a = r.audits;
console.log("LCP ms:", Math.round(a["largest-contentful-paint"].numericValue));
console.log("FCP ms:", Math.round(a["first-contentful-paint"].numericValue));
console.log("TBT ms:", Math.round(a["total-blocking-time"].numericValue));
console.log("CLS:", a["cumulative-layout-shift"].numericValue);

'
