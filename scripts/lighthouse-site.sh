#!/usr/bin/env bash
# Misst die Website-Seiten mit Lighthouse (mobil: simuliertes langsames 4G,
# 4x CPU-Drosselung), Ziel W2-6: LCP < 2,5 s. Standard ist die Live-Seite.
#   BASE=https://roses-gallery.app LIGHTHOUSE=<pfad> scripts/lighthouse-site.sh
# Lighthouse ist keine Projekt-Abhängigkeit: z. B. in einem eigenen Ordner
# `npm i lighthouse@12` und LIGHTHOUSE auf dessen node_modules/.bin/lighthouse.
set -euo pipefail
BASE="${BASE:-https://roses-gallery.app}"
OUT="${OUT:-$(mktemp -d)}"
export CHROME_PATH="${CHROME_PATH:-/opt/pw-browsers/chromium}"
PAGES=("" preise fuer-fotografen fuer-videografen blog)

for page in "${PAGES[@]}"; do
  name="${page:-start}"
  if ! "${LIGHTHOUSE:-lighthouse}" "$BASE/$page" \
    --only-categories=performance,accessibility,best-practices,seo \
    --output=json --output-path="$OUT/$name.json" \
    --chrome-flags="--headless --no-sandbox" --quiet 2>/dev/null; then
    echo "/$page: nicht messbar (Seite nicht erreichbar?)"
    continue
  fi
  node -e '
    const r = require(process.argv[1]);
    const a = r.audits;
    const scores = Object.entries(r.categories)
      .map(([k, v]) => `${k}=${Math.round(v.score * 100)}`).join(" ");
    console.log(process.argv[2].padEnd(18), scores,
      "LCP=" + a["largest-contentful-paint"].displayValue,
      "TBT=" + a["total-blocking-time"].displayValue,
      "CLS=" + a["cumulative-layout-shift"].displayValue);
  ' "$OUT/$name.json" "/$page"
done
