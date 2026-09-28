# RISE hosted narration job API foundation

This is an isolated Go API foundation for one future `rise.voice` job. It does
not replace the static RISE reader, add a login UI, or connect the reader to a
server. Existing reading, the optional Scriptorium JEV route, and its
user-supplied TypeSafe key are unchanged.

## Implemented here

- `GET /livez` reports that the process is running. `GET /readyz` checks that
  PostgreSQL and the job tables are available and an OIDC verifier is
  configured. Its response says `jobExecution: not_configured`: the API can
  durably accept and manage jobs, but there is no worker or provider dispatch.
- `POST /v1/jobs` accepts only `{"operation":"rise.voice","text":"..."}`.
  The request is limited to 32 KiB total and 24 KiB of UTF-8 text. Unknown
  fields and other operations are rejected. A verified issuer/subject owns the
  row; caller-supplied owner headers are ignored.
- `Idempotency-Key` is unique per verified issuer and subject. Repeating the
  same typed input returns the original job; changing the input under the same
  key returns `409`.
- `GET /v1/jobs/{id}` and `DELETE /v1/jobs/{id}` always filter by that verified
  owner. Missing and other-owner jobs both return `404`. Cancel changes a
  queued job and its pending outbox record to `canceled` in one transaction.
- The job and content-free outbox metadata commit together in PostgreSQL.
  SQL values are parameterized. The input is never returned in status or
  logged by this service.

The migration is [`internal/store/migrations/001_jobs.sql`](internal/store/migrations/001_jobs.sql).
From the repository root, apply it with a migration-capable database role
before starting the service:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f services/rise-api/internal/store/migrations/001_jobs.sql
```

The API runtime needs `SELECT`, `INSERT`, and `UPDATE` on both tables (plus
`USAGE` on their schema). Keep the migration credential separate from the
runtime credential.

## Configuration and identity contract

Set `RISE_ENV` explicitly to `local`, `staging`, or `production`. An unset or
unknown value is an error. Local mode may use a local PostgreSQL connection;
staging and production require a PostgreSQL URL with `sslmode=verify-full`.
Set `RISE_API_ADDR` to `:8080` only inside a private service network. Its local
default is `127.0.0.1:8080`.

Private routes and readiness fail closed unless both `RISE_OIDC_ISSUER` and
`RISE_OIDC_AUDIENCE` are configured. The issuer must be the exact HTTPS issuer
string published by discovery; the audience must be dedicated to this API.
Discovery and JWKS URLs must be HTTPS, redirects are rejected, and JWT
signatures are checked by `coreos/go-oidc` against the configured issuer and
audience. Only RS256, PS256, ES256, and EdDSA are allowed. Accepted tokens must
be RFC 9068 style access tokens (`typ=at+jwt` or
`application/at+jwt`) with `exp`, nonempty `sub`, and `iat`; `iat` can be at
most 30 seconds ahead and tokens older than five minutes plus that skew are
rejected. An identity provider must be configured to issue this API-specific
access-token audience and type. The scaffold does not introspect tokens or
promise immediate revocation: a revoked token may remain usable until expiry.

The runtime does not verify AWS RDS KMS/backup encryption configuration. Do
not submit real private text until the deployed database and backups have
verified encryption at rest, and the actual TLS chain/hostname has been
verified against the RDS CA bundle. The development/PostgreSQL integration
tests use only synthetic text. No source text is wired from the browser.

## Deliberate boundary

There is no consumer for `rise_job_outbox`, no Kafka dispatch, Redis cache or
limiter, model call, artifact bucket, signed artifact URL, or private artifact
route in this increment. An accepted job therefore remains `queued` until a
separately reviewed worker and dispatch path are implemented. Do not treat a
successful submit or readiness response as completed narration or production
readiness. A future consumer must claim only still-queued jobs and pending
outbox records transactionally before dispatch; cancellation cannot undo work
already sent to an external provider. User membership policy, account UI,
artifact retention, and real-provider revocation rules also remain open.

The static browser keeps the existing no-account/local reading behavior. There
is no client wiring or public Netlify proxy to these private API routes.

## Run and verify

From this directory, apply the schema, set `RISE_ENV=local` and
`DATABASE_URL`, then run `go run ./cmd/rise-api`. Without OIDC configuration,
the process may serve liveness, but readiness is `503` and all private routes
are `503 IDENTITY_NOT_CONFIGURED`.

`go test -race ./...` includes real PostgreSQL transaction and concurrency
tests when `RISE_TEST_DATABASE_URL` is set. Without it, those integration tests
skip; CI supplies a disposable PostgreSQL service and runs the full package
suite, `go vet`, a build, and the non-root container build.
