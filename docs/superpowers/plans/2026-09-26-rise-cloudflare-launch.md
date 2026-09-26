# RISE Cloudflare Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve RISE and its Jev decision API from one Cloudflare Worker at `rise.syberlabs.io`, with a server-held OpenRouter key and a verified production reading decision.

**Architecture:** Vite builds static assets; a Worker handles `/api/*` before the SPA fallback. The existing validated Jev handler is shared with the Netlify preview, while the Worker owns its secret and rate-limit bindings. Staging and production are separate Workers.

**Tech Stack:** Vanilla JavaScript, Vite, Vitest, Cloudflare Workers Static Assets, Wrangler, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-26-rise-cloudflare-hosting-design.md`

## Global Constraints

- Keep the Jev model fixed at `typesafe/jev-1.13` server side; do not accept a browser override.
- Preserve the current `/api/jev-decision` schema, same-origin check, 32 KB body bound, 8-second upstream timeout, bounded response, and fail-closed errors.
- Preserve `/api/jev/route` as the separate TypeSafe bring-your-own-key flow.
- Keep `rise.syberlabs.space` reachable for its existing browser-local data.
- Put `OPENROUTER_API_KEY` only in Worker Secrets; never in source, assets, logs, or public variables.
- Apply 30 Jev decision requests per client IP per 60 seconds; use a distinct rate-limit namespace per Worker.
- Keep staging behind Access. A public bypass is limited to the RISE production Worker and must not affect Relay.
- Do not add a Go server, Kafka queue, or database to this release.

## File map

- `netlify/functions/jev-decision.mjs`: validated request/provider logic and the legacy Netlify adapter.
- `worker/index.mjs`: Cloudflare route dispatch, rate limiting, and JSON API 404s.
- `wrangler.staging.jsonc`, `wrangler.production.jsonc`: explicit Worker bindings and routing.
- `public/_headers`: Cloudflare static asset security and cache headers.
- `src/core/jev-decision.test.js`, `worker/index.test.js`: provider and routing behavior.
- `public/jev-preview.html`, `public/jev-preview.js`: explicit browser test of the server-owned Jev decision without changing playback.
- `.github/workflows/rise-cloudflare.yml`: checked-source staging and protected production deployment.
- `docs/jev-core/service.md`, `README.md`, public host configuration: launch instructions and canonical links.

---

### Task 1: Bring the tested Jev decision into the branch

**Files:** Modify `netlify/functions/jev-decision.mjs`, `src/core/jev-decision.test.js`, `docs/jev-core/README.md`, `docs/jev-core/service.md`.

**Interfaces:** Export `handleJevDecision(request, apiKey)` returning `Response`; retain the default Netlify handler and `config` export. The Worker calls the named export with `env.OPENROUTER_API_KEY`.

- [ ] **Step 1: Cherry-pick the single Jev integration commit.** Run `git cherry-pick 41f63cb` on an implementation branch from the approved design. Resolve only conflicts against current `main`; preserve #181's reading path behavior.
- [ ] **Step 2: Write the failing adapter test.** In `src/core/jev-decision.test.js`, call the named export with `server-secret` while `OPENROUTER_API_KEY` is unset; assert a 200 validated Jev action and a provider Authorization header containing only that supplied secret.
- [ ] **Step 3: Run the focused test.** Run `npx vitest run src/core/jev-decision.test.js`; expect the named export test to fail before the refactor.
- [ ] **Step 4: Refactor one line of authority.** Keep the existing validation and provider code inside `handleJevDecision(request, apiKey)`. Make the default export call `handleJevDecision(request, process.env.OPENROUTER_API_KEY)`. Do not duplicate the provider payload or log it.
- [ ] **Step 5: Run the focused test and commit.** Expect the full file to pass, then commit only Task 1 files.

### Task 2: Add Cloudflare API dispatch and rate limiting

**Files:** Create `worker/index.mjs`, `worker/index.test.js`, `wrangler.staging.jsonc`, `wrangler.production.jsonc`.

**Interfaces:** The Worker exports `{ fetch(request, env) }`; `env.DECISION_LIMITER.limit({ key: ip })` returns `{ success }`; the decision handler consumes `env.OPENROUTER_API_KEY`.

- [ ] **Step 1: Write failing Worker tests.** Stub `DECISION_LIMITER.limit()` and provider `fetch`. Assert: a same-origin `/api/jev-decision` POST returns the validated action; a denied limiter returns 429 before provider fetch; missing limiter/IP/key fails closed; `/api/jev/route` retains its own handler; unknown `/api/*` and a browser navigation to it return JSON 404, never HTML.
- [ ] **Step 2: Run `npx vitest run worker/index.test.js`.** Expect import or behavior failure.
- [ ] **Step 3: Implement narrow dispatch.** For `/api/jev-decision`, check the method/origin/body through the shared handler and call the limiter before the provider call. For `/api/jev/route`, call the existing TypeSafe handler. Return `application/json` 404 with `Cache-Control: no-store` for every other `/api/*` path; do not proxy arbitrary paths.
- [ ] **Step 4: Configure both Workers.** Each Wrangler file has `main: "./worker/index.mjs"`, `assets.directory: "./dist"`, `assets.not_found_handling: "single-page-application"`, and `assets.run_worker_first: ["/api/*"]`. Declare `OPENROUTER_API_KEY` as a required secret, distinct rate-limit namespaces with `limit: 30, period: 60`, `preview_urls: false`, and distinct Worker names. Staging uses `workers_dev: true`; production uses a custom domain for `rise.syberlabs.io` and `workers_dev: false`.
- [ ] **Step 5: Verify and commit.** Run both API test files and `wrangler deploy --dry-run --config` for each config after the Vite build. Confirm neither emitted assets nor config contains a key, then commit Task 2 files.

### Task 3: Preserve browser security and public host behavior

**Files:** Create `public/_headers`; modify only host references needed by `src/content/public-hosts.js`, `public/site.webmanifest`, `README.md`, `PRIVACY.md`, `TERMS.md`, `public/privacy.html`, `public/terms.html`, and tests that guard those references.

**Interfaces:** Static responses inherit `_headers`; API responses keep their handler-owned JSON headers.

- [ ] **Step 1: Write or extend a focused assertion.** Verify the built `dist/_headers` contains the current `netlify.toml` CSP, frame, nosniff, referrer, and permissions policies; verify `/index.html` revalidates and content-addressed assets retain immutable caching.
- [ ] **Step 2: Run the focused test and expect failure.** The Cloudflare headers file does not exist yet.
- [ ] **Step 3: Copy the effective Netlify header policy into `public/_headers`.** Use `/*` for common security headers, then exact rules for `/index.html`, `/site.webmanifest`, `/assets/*`, `/audio/recitation/*`, `/content/works/*`, and `/content/manifest.json`. Keep each header line under Cloudflare's 2,000-character limit.
- [ ] **Step 4: Change only new-host and processor references.** Make `rise.syberlabs.io` canonical for new links and QR defaults while preserving the `.space` old origin and its stored data. In privacy and terms, distinguish Cloudflare hosting of `.io` from Netlify hosting of the still-available `.space` site, and disclose the optional Jev preview transfer through OpenRouter. Preserve the named operator; do not invent a transfer of legal ownership. Do not redirect the old hostname.
- [ ] **Step 5: Build, inspect headers and paths, run focused tests, commit.** Check root and deep link behavior in local Wrangler preview before committing.

### Task 4: Add an explicit RISE browser-to-Jev preview

**Files:** Create `public/jev-preview.html`, `public/jev-preview.js`, and a focused browser behavior test; update only the navigation or documentation needed to let the owner find the preview.

**Interfaces:** The page POSTs to same-origin `/api/jev-decision` with a bounded sample `intent`, `feedback`, `excerpt`, `mode`, `pace`, and random `requestId`; it displays only the validated `continue`, `slower`, or `pause` action, model, and matching request ID.

- [ ] **Step 1: Write a failing browser behavior test.** It must show that the decision is only requested after a deliberate button click, uses the same-origin API without a browser API key, and displays a safe error on failure.
- [ ] **Step 2: Implement the minimal preview screen.** Use a short default sample passage and clear copy that one click sends that sample to OpenRouter through RISE. Bound editable fields to the API limits; do not store or log submitted text or the provider response.
- [ ] **Step 3: Keep the reading path independent.** Do not restore `JevGate`, intercept playback, or automatically call the provider from the reading flow removed in #181.
- [ ] **Step 4: Verify and commit.** Run the focused test, build, and confirm the page is served as a real static page by the local Worker preview.

### Task 5: Gate the deployment and verify the exact artifact

**Files:** Create `.github/workflows/rise-cloudflare.yml`; update deployment section of `README.md`.

**Interfaces:** GitHub `staging` and `production` environments hold scoped Cloudflare API tokens. A successful `CI` run on the exact main commit allows staging; production promotes the same uploaded build artifact after its protected environment approval.

- [ ] **Step 1: Write workflow checks before credentials.** Restrict deployment to a successful `CI` run from a push to this repository's `main`. Require the checked-out SHA to equal the completed CI head SHA; reject a newer main before promotion. Never run deployment secrets in pull-request jobs.
- [ ] **Step 2: Build once and upload an artifact.** Use `npm ci`, `npm run build`, and a pinned Wrangler CLI. Upload `dist/` plus the Worker source/config under an immutable artifact name containing the full SHA; production downloads the same artifact without rebuilding.
- [ ] **Step 3: Deploy and smoke staging.** Use `wrangler deploy --config wrangler.staging.jsonc`; check root, deep link, `/api/*` JSON refusal, static headers, and the expected release marker. Run one consented paid Jev decision from the staging UI; compare OpenRouter usage and bounded Cloudflare logs.
- [ ] **Step 4: Protect and deploy production.** Set up GitHub production environment review, bind a scoped token and Worker secret, configure the production Worker-level public Access bypass and custom domain only after the zone is active. Deploy the same artifact, then repeat HTTPS, API, header, UI Jev, and Relay Access checks.
- [ ] **Step 5: Document rollback and commit.** Record the prior deployment identifier and the exact command to restore it. Keep the old `.space` site available. Commit the workflow and runbook after the workflow is validated on staging.

## Plan self-review

- Every spec section maps to a task or the explicit account-side launch checks in Task 5.
- No Go, Kafka, database, generic AI routing, or origin-data migration is added.
- API tests exercise the paid-request boundary; the browser live test is separate from local mocks.
