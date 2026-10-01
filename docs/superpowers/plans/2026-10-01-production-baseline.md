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

### Task 2: Close existing production review defects

**Files:** Modify `src/live/host/controls.js`, `src/live/host/LiveHost.js`; tests `src/live/host/controls.test.js`, `src/live/host/LiveHost.test.js` (or existing catalog host test file discovered in the repository).

**Interfaces:** Consumes existing `submitVisual`, runtime snapshots with main/side run and segment identity, and `chosenProvider()`. Produces lifecycle-correct feedback and catalog admission preserving the existing unknown-provider mock fallback.

- [ ] Write and run failing tests for direct visual-form submit cancellation and exactly one visual command; stale brightness-limit feedback disappearing on active run/segment change; unknown/differently-cased provider catalog requests falling back to mock while known real providers still refuse catalog.
- [ ] Add a submit listener to `.live-controls__visual` that prevents default and calls the existing `submitVisual` function. Preserve the intercepted Enter and button paths.
- [ ] Track active run/segment identity in `render(snapshot)` and clear visual outcome only when that identity changes; retain feedback across ordinary same-segment snapshots. Cover Dive and Surface selection.
- [ ] Replace the catalog conflict's raw provider comparison with `this.chosenProvider() !== 'mock'`. Preserve embed/eval conflicts and all invalid catalog refusals.
- [ ] Run targeted host tests and `e2e/live-control.spec.js` plus `e2e/visual-catalog.spec.js`; record real red/green evidence, self-review and commit only task files. If snapshot identity differs from this description, use the actual existing runtime identifiers and report them.

### Task 3: Restore the mobile reading viewport

**Files:** Modify `src/live/host/LiveHost.css`; strengthen `e2e/live-voice.spec.js` phone test only if needed to verify reachability.

**Interfaces:** Existing `#live-controls` and its form, microphone disclosure and buttons. No changes to runtime commands or playback.

- [ ] Reproduce the existing phone tests at 390 by 844: normal controls height 368.8 exceeds its less-than-281.333 contract in `e2e/live.spec.js`, and expanded height 537.8 exceeds its less-than-422 contract in `e2e/live-voice.spec.js`.
- [ ] Restore space for the reading with a bounded, internally scrollable controls panel. Use viewport-relative sizing with a fallback where needed, retain minimum 44 px touch targets, prevent horizontal overflow, and keep every control and disclosure reachable by touch and keyboard. Follow existing CSS spacing and styles; do not hide commands or loosen the height assertion.
- [ ] Extend the existing phone browser test to verify a lower control remains operable when the panel overflows, alongside its original height, touch and no-horizontal-overflow checks.
- [ ] Run both focused phone tests and complete live-control/visual-catalog suites. Record red/green evidence, inspect the diff and commit the small responsive fix plus these plan/spec updates.

### Task 4: Verify and integrate production (coordinator)

**Files:** No intended production code changes. Existing `.github/workflows/ci.yml` and `full-validation.yml` own deployment and full validation.

**Interfaces:** Consumes reviewed PR364 then PR365 then baseline fix PR. Produces an exact deployed SHA and live verification evidence.

- [ ] Review Task 1 against its brief and diff; resolve actionable findings.
- [ ] Run `npm run test:run`, `npm run test:e2e:gate`, existing slice browser tests, CI hygiene/security/architecture checks and production build using the pinned compatible Node runtime. Inspect every result.
- [ ] Push baseline branch and create a PR stacked on PR365; attach it to this chat. Verify required CI.
- [ ] Merge PR364 through CI, retarget PR365 to main, wait for its current-base CI, merge it, retarget baseline PR to main and merge through its current-base CI. Never bypass required checks or use force pushes.
- [ ] Wait for production deployment and full main validation. Verify `/release-<sha>.txt`, `/live`, `/visual-catalog`, retired inference refusals, and production browser sample/control behavior without real provider calls.
- [ ] Report deployed release, verification results, and any unestablished real-provider, microphone or human-perception claims.
