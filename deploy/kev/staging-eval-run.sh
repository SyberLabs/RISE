#!/usr/bin/env bash
# Deploy the staging Worker for one provider, wait until it serves this exact
# deploy, then capture the 39 fixed cases in three rate-limited batches.
# Usage (from kev-staging-eval.yml): staging-eval-run.sh jev|kev
set -euo pipefail
provider=$1
case "$provider" in jev|kev) ;; *) echo "provider must be jev or kev"; exit 1 ;; esac
: "${STAGE:?}" "${NAMESPACE:?}" "${TESTED_SHA:?}" "${KEV_BASE_URL:?}" "${KEV_REVISION:?}" "${RUNNER_TEMP:?}"

marker="eval-$NAMESPACE-$provider.txt"
printf '%s\n' "$TESTED_SHA" > "dist/$marker"
./node_modules/.bin/wrangler deploy --config wrangler.staging.jsonc \
  --var "DECISION_PROVIDER:$provider" --var "DECISION_CACHE_NAMESPACE:$NAMESPACE" \
  --var "KEV_BASE_URL:$KEV_BASE_URL" --var "KEV_REVISION:$KEV_REVISION" \
  --message "RISE $TESTED_SHA staging eval ($provider)"

# Cloudflare can serve the prior version for a few seconds after a deploy.
for attempt in {1..60}; do
  body=$(curl -sS --max-time 20 -H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" \
    -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET" "$STAGE/$marker" || true)
  [ "$body" = "$TESTED_SHA" ] && break
  [ "$attempt" = 60 ] && { echo "Staging did not serve the $provider deploy after 60 checks."; exit 1; }
  sleep 2
done
echo "Staging serves $TESTED_SHA with DECISION_PROVIDER=$provider."

for start in 0 13 26; do
  # The staging Worker allows 30 decision requests per 60 seconds per IP.
  [ -e "$RUNNER_TEMP/captured-once" ] && sleep 65
  node deploy/kev/staging-eval.mjs capture --origin "$STAGE" --provider "$provider" \
    --cases scripts/jev-eval-cases.json --options scripts/jev-eval-options-candidate.json \
    --start "$start" --count 13 --output "$RUNNER_TEMP/$provider-staging.json"
  touch "$RUNNER_TEMP/captured-once"
done
