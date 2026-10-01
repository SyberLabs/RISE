# Production Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Ship the existing governed visual control and catalog on a verified production baseline.

**Architecture:** Preserve the existing runtime and integrate its two reviewed slices in dependency order. Repair remaining baseline defects at their source; do not widen the capability surface.

**Tech Stack:** Vanilla JavaScript, Vite, Vitest, Playwright, Cloudflare Worker.

**Spec:** `docs/superpowers/specs/2026-10-01-production-baseline.md`

## Global Constraints

- RISE owns playback and admission.
- Preserve the existing Player, clock, Dive/Surface lifecycle, closed visual capabilities, reader-owned inference, reduced-motion behavior, and explicit refusal paths.
- No new provider, microphone spending, scenes, telemetry, public SDK contract, or Portal promotion is part of this release.
- Preserve exported reader-selected pace and child lineage; do not change the expected pace to hide a persistence bug.

### Task 1: Restore recipient remix browser coverage

**Files:** Modify `e2e/recipient-remix.spec.js`; test `e2e/recipient-remix.spec.js` and `e2e/authored-examples.spec.js`. Documentation above travels with this baseline PR.

**Interfaces:** Consumes existing `openHomeNav(page, 'vault')`; produces coverage of the unchanged reader remix, export, clean-browser import and reduced-motion keyboard journeys.

- [ ] Observe the unchanged recipient tests fail waiting for `.portal .portal-title` on the production home. Record the reproduction command and result.
- [ ] Replace only the stale readiness assertion with the existing authored-examples readiness convention:

```js
await expect(page.locator('.portal h1').first()).toBeVisible({ timeout: 15_000 });
```

- [ ] Run the focused browser command:

```sh
node node_modules/@playwright/test/cli.js test e2e/authored-examples.spec.js e2e/recipient-remix.spec.js --project=full --reporter=line --output=test-results-production-baseline
```

Both authored tests must preserve their existing assertions, including exported pace 240. If they fail, investigate before modifying production code and report the specific source defect to the coordinator.

- [ ] Inspect the diff, document root cause and red/green evidence, and commit only the narrow test fix plus this specification and plan.

### Task 2: Verify and integrate production (coordinator)

**Files:** No intended production code changes. Existing `.github/workflows/ci.yml` and `full-validation.yml` own deployment and full validation.

**Interfaces:** Consumes reviewed PR364 then PR365 then baseline fix PR. Produces an exact deployed SHA and live verification evidence.

- [ ] Review Task 1 against its brief and diff; resolve actionable findings.
- [ ] Run `npm run test:run`, `npm run test:e2e:gate`, existing slice browser tests, CI hygiene/security/architecture checks and production build using the pinned compatible Node runtime. Inspect every result.
- [ ] Push baseline branch and create a PR stacked on PR365; attach it to this chat. Verify required CI.
- [ ] Merge PR364 through CI, retarget PR365 to main, wait for its current-base CI, merge it, retarget baseline PR to main and merge through its current-base CI. Never bypass required checks or use force pushes.
- [ ] Wait for production deployment and full main validation. Verify `/release-<sha>.txt`, `/live`, `/visual-catalog`, retired inference refusals, and production browser sample/control behavior without real provider calls.
- [ ] Report deployed release, verification results, and any unestablished real-provider, microphone or human-perception claims.
