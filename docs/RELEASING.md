# Releasing RISE

Moved from the root README. Production release and rollback for the Cloudflare host.

The [CI workflow](../.github/workflows/ci.yml) checks and builds each pull request
and main commit once. On main, it records the commit in a release marker and
uploads the tested artifact. After the required `CI` job passes, the protected
production job verifies and deploys that artifact without rebuilding. Full unit,
Scriptorium, and browser validation runs separately and reports failures without
holding the release.

The GitHub `production` environment restricts deployment to `main` and
requires approval from `@sdcarlson`; owner self-review is enabled and
administrator bypass is disabled. Set these environment values before a release:

| Environment | Values |
| --- | --- |
| `production` | A separate secret `CLOUDFLARE_API_TOKEN`; variable `CLOUDFLARE_ACCOUNT_ID`. |

Scope each Cloudflare token to only the account and deployment permissions it
needs. The production Worker holds no model credential: readers bring their own
OpenRouter account or run Kev locally ([USER-OWNED-AI.md](USER-OWNED-AI.md)).
Its only secrets are the catalog's `NEON_DATABASE_URL`, `UPSTASH_REDIS_REST_URL`
and `UPSTASH_REDIS_REST_TOKEN`; the declared required secrets make Wrangler refuse
a deployment when the Worker lacks them. The release check never calls a model.

The production job checks the current main commit again after approval, verifies
the artifact digest and release marker, and checks public pages and API errors
after deployment. The `syberlabs.io` zone and `rise.syberlabs.io` custom domain must be
active, and the RISE production Worker alone must have a public Access bypass;
Relay must remain protected.

The production job records the prior Worker deployments and their version IDs
in its GitHub run summary before changing traffic. Verify a prior version is
known-good before restoring its ID from a checkout with this configuration and
Cloudflare credentials:

```bash
npx --yes wrangler@4.141.0 rollback <VERSION_ID> --config wrangler.production.jsonc --message "RISE rollback"
```

The previous [`.space` site](https://rise.syberlabs.space/) remains available
for browser-local work there. A first production release may have no
known-good prior production version to restore.
