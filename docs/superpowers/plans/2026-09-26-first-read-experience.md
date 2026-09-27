# First-read experience implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a new visitor enter the admitted Meditations Chamber in one action and receive a useful choice after thirty seconds of active reading.

**Architecture:** The Portal calls the existing Keystone launch operation with an ephemeral first-read marker. The existing admission and session compiler remain authoritative. The Chamber shows a one-time choice from Player elapsed time, reusing its Page and transport actions.

**Tech Stack:** Vanilla JavaScript, Vite, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-26-first-read-experience-design.md`

## Global constraints

- Use `launchKeystone('meditations')` and its normal admission result; do not construct or fetch text independently.
- Do not add a dependency, provider call, persistent record, background tracking, or Kafka queue.
- The thirty-second milestone uses active Stream elapsed time and appears once only for a Portal first-read session.
- Jev request and existing rooms stay reachable; reader safety and Page controls keep their current behavior.

---

### Task 1: Portal entry and session marker

**Files:** Modify `src/components/Portal.js`, `src/components/Portal.css`, `src/app/route-manifest.js`, `src/app.js`; test `src/components/Portal.test.js` and `e2e/keystones.spec.js`.

**Interfaces:** The Portal receives `onLaunchFirstRead: () => Promise<void>` from the route manifest. `app.launchKeystone(slug, { firstReadPreview = false } = {})` continues to use `resolveKeystone` and passes the marker to `handleBeginSession`. The compiled session carries `firstReadPreview: true` only for this action.

- [ ] Write a Portal test that finds one primary `.portal-first-read` button labelled “Experience 30 seconds,” clicks it twice, and verifies one `onLaunchFirstRead` call while pending. Assert the Jev form is still present.
- [ ] Run `npx vitest run src/components/Portal.test.js` and verify the new test fails because the button is absent.
- [ ] Add the button ahead of the Jev form, its pending state, and style it as the clearest Portal action at phone and desktop widths. Wire the route operation to the existing Keystone launch and carry the ephemeral marker through session compilation.
- [ ] Run the focused test and add a browser test: from `/`, click the new button, verify `/keystone/meditations` and visible Chamber; exit and verify `/try-rise`, then Back reaches `/`. Run `npx playwright test e2e/keystones.spec.js --project=gate` or the repository's available browser project.
- [ ] Commit the tested Portal entry and marker without touching unrelated files.

### Task 2: Thirty-second reader choice

**Files:** Modify `src/components/Chamber.js`, `src/components/Chamber.css`; test a focused `src/components/Chamber.first-read.test.js` and the first-read browser path in `e2e/keystones.spec.js`.

**Interfaces:** `session.firstReadPreview === true` enables the choice. `updateProgress({ elapsed })` receives Player active elapsed milliseconds. At `elapsed >= 30000`, a one-time nonmodal choice appears. Its actions call existing `togglePageMode(true)` or `togglePlayPause()` or dismiss the choice.

- [ ] Write a focused test showing that `updateProgress({ elapsed: 29999 })` hides the choice, `elapsed: 30000` shows it once for a marked session, and an ordinary session never shows it. Test Continue dismisses, Page invokes the existing projection, and Pause invokes transport. Test completion and destroy remove it.
- [ ] Run `npx vitest run src/components/Chamber.first-read.test.js` and verify failure is caused by absent behavior.
- [ ] Add a small reader choice to the Chamber display, styled clear of the text and controls. Use the Player's elapsed reading time, not a wall-clock timeout. Suppress it after Page opens, completion, or teardown.
- [ ] Run the focused unit and browser tests, then `npm run build`, `npm run test:e2e:gate`, and repository hygiene/system-design checks. Fix failures caused by this change.
- [ ] Commit the tested Chamber choice and update the spec if implementation details diverged.

### Task 3: Final validation and handoff

**Files:** No new production files; only focused test or documentation corrections if evidence shows a defect.

**Interfaces:** Preserve the exact `firstReadPreview` marker and Keystone admission contract from Tasks 1–2.

- [ ] Review the branch diff for accidental copy changes, admission bypasses, private data transmission, and changed exits.
- [ ] Verify desktop and phone behavior in the browser, including legible first words, the thirty-second choice, Page, Jev form, and keyboard focus.
- [ ] Run the necessary release checks, publish a reviewable PR if branch rules allow, and report exact validation and any live deployment limit.
