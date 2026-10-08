# Releasing RISE

Moved from the root README. Production release and rollback for the Cloudflare host.
This page describes the workflow as it runs today.

## On a pull request

The [CI workflow](../.github/workflows/ci.yml) runs one job, `CI`, for every
pull request: hygiene, roadmap and security checks, the generated architecture
diagram, the content build, the fast unit tests listed in
[`vitest.fast.config.js`](../vitest.fast.config.js) (CI fails if they collect
a different number of files than the committed `FAST_TEST_FILES`),
`vite build`, the first-load budget, a Worker deploy dry run, and the browser
gate (`npm run test:e2e:gate`, no retries). The main-branch ruleset requires
that check and no human approval.

## On a push to `main`

The same `CI` job runs again on the merged commit. Its `dist/` (with the
recitation audio and the release markers `dist/release.txt` and
`dist/release-<sha>.txt`) and the Worker bundle from its dry run are uploaded
as the artifact `rise-release-<sha>`, before the browser gate rebuilds `dist/`
with test flags.

The `production` job `needs` that job, so it runs only when every check on the
merged commit, browser gate included, has passed. It does not build `dist/`:
it downloads the artifact, checks the release markers and the audio count,
bundles the Worker again from the same commit and requires it to be
byte-identical to the tested bundle, and writes `wrangler versions list` to the
run summary. Right before deploying it reads `main` from the GitHub API and
stops if `main` no longer points at the tested commit. So not every push to
`main` deploys: when merges land faster than the jobs run, a superseded push's
job fails at this step without deploying, and the job for the newest commit
deploys. It deploys with the lockfile's Wrangler and writes the new Worker
version id to the run summary:

```bash
./node_modules/.bin/wrangler deploy --config wrangler.production.jsonc --message "RISE <sha>"
```

After deploying, the job polls `https://rise.syberlabs.io/release-<sha>.txt`
until it returns the commit, then checks that `/` and `/try-rise` answer 200,
that an unknown `/api/` path answers a JSON 404, that `/content/catalog.json`
passes the browser catalog contract, that every retired inference route
answers 410, and that the release marker still matches once those checks are
done. It writes the result and an owner-acceptance step to the run summary. No
release check calls a model.

[Full validation](../.github/workflows/full-validation.yml) starts when the
`CI` workflow completes on `main`, and on manual dispatch: the full unit suite
in four shards, the Scriptorium CLI, and the browser suite in sixteen shards.
It reports failures and uploads Playwright reports. It does not hold or undo
the release.

## Environment

The GitHub `production` environment restricts deployment to `main`. Its
protection rules are configured in GitHub settings and are not recorded in
this repository. Set these environment values before a release:

| Environment | Values |
| --- | --- |
| `production` | A separate secret `CLOUDFLARE_API_TOKEN`; variable `CLOUDFLARE_ACCOUNT_ID`. |

Scope each Cloudflare token to only the account and deployment permissions it
needs. The production Worker holds no model credential: readers bring their own
OpenRouter account or run Kev locally ([USER-OWNED-AI.md](USER-OWNED-AI.md)).
It holds no secrets: the catalog is a static file. The release check never calls a model.

The `syberlabs.io` zone and `rise.syberlabs.io` custom domain must be active,
and the RISE production Worker alone must have a public Access bypass; Relay
must remain protected.

## Rollback

Each production run's summary lists the Worker versions that existed before
its deploy and the version it deployed. Confirm one is known-good, and restore
it with the lockfile's Wrangler from a checkout with this configuration and
Cloudflare credentials:

```bash
./node_modules/.bin/wrangler versions list --config wrangler.production.jsonc
./node_modules/.bin/wrangler rollback <VERSION_ID> --config wrangler.production.jsonc --message "RISE rollback"
```

The previous [`.space` site](https://rise.syberlabs.space/) remains available
for browser-local work there. A first production release may have no
known-good prior production version to restore.

## History

Until 2026-09-26 the `CI` job uploaded the tested `dist/` and the production
job deployed it; #204 removed that handoff and the `needs: ci` link, and from
then until this change production deployed a fresh build that no test had run
against. The handoff is restored to close R1 of the
2026-10-05 principal-architect critique: production ships the tested artifact.
[Full validation](../.github/workflows/full-validation.yml) still runs after
the deploy and does not hold it.
