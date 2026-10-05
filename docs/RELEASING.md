# Releasing RISE

Moved from the root README. Production release and rollback for the Cloudflare host.
This page describes the workflow as it runs today; the open question at the end
records what it no longer does.

## On a pull request

The [CI workflow](../.github/workflows/ci.yml) runs one job, `CI`, for every
pull request: hygiene, roadmap and security checks, the generated architecture
diagram, the content build, a fixed set of fast unit tests, `vite build`, the
first-load budget, and the browser gate (`npm run test:e2e:gate`). The
main-branch ruleset requires that check and no human approval.

## On a push to `main`

The same workflow runs its `production` job, and only that job; the `CI` job
does not run on push. The job checks out the merged commit, rebuilds the app
with `npm run build`, restores the recitation audio, and writes the commit into
`dist/release.txt` and `dist/release-<sha>.txt`. Right before deploying it
reads `main` from the GitHub API and stops if `main` no longer points at the
commit it built. So not every push to `main` deploys: when merges land faster
than the job runs, a superseded push's job fails at this step without deploying
or verifying anything, and the job for the newest commit deploys. That check is
the only guard between the merge and the deploy: nothing is handed from the pull
request's `CI` run to this job, and the deploy is a fresh build from source. It
deploys with the lockfile's Wrangler:

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

The release does not record prior Worker versions. To roll back, list the
versions from a checkout with this configuration and Cloudflare credentials,
confirm one is known-good, and restore it with the lockfile's Wrangler:

```bash
./node_modules/.bin/wrangler versions list --config wrangler.production.jsonc
./node_modules/.bin/wrangler rollback <VERSION_ID> --config wrangler.production.jsonc --message "RISE rollback"
```

The previous [`.space` site](https://rise.syberlabs.space/) remains available
for browser-local work there. A first production release may have no
known-good prior production version to restore.

## Open question

Until 2026-09-26 the `CI` job uploaded the tested `dist/` as an artifact and
the production job deployed that artifact without rebuilding. #196 removed the
artifact digest, #204 removed the artifact handoff and the `needs: ci` link,
and #209 removed the step that recorded prior Worker versions in the run
summary. Whether to restore a build-once handoff is a decision for the
repository owner; it is not made here.
