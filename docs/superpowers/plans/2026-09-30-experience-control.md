# Governed experience control implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver one closed visual control loop during ongoing live reading, independently of composition completion.

**Architecture:** The existing runtime asks its host to discover and control the visible Chamber, passing its Player identity. The Chamber delegates to VisualFieldDirector's active record; the Attractor record owns a bounded brightness transition. Reader controls translate one closed phrase to this same data contract.

**Tech Stack:** Existing vanilla JavaScript, Vite, Vitest, Playwright; no added dependencies.

**Spec:** docs/superpowers/specs/2026-09-30-experience-control-design.md (approved by the reader's "begin").

## Global constraints

- Single existing live runtime and Player; narration remains reading-clock authority.
- No new provider transport, persistent store, executable model data, SDK, or observation upload.
- Attractor intensity min 0.4, max 0.75, default 0.65; phrase increases current target by 0.1.
- RISE-owned transition 320 ms; reduced motion uses one repaint without simulation advancement or refuses.
- First painted local change within 1,000 ms; real recognizer end-to-end latency remains unverified.
- Unknown fields/names and non-finite values refused; finite out-of-range values clamped.
- A control applies only to the current field lifetime; replacement, destruction, Dive and Surface cancel departing work.
- Use supported bundled Node at C:/Users/MATEO/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe. Default Node is 20.18.0 and unsupported.
- Keep lockfile and production/workflow configuration unchanged. Read relevant AGENTS.md, TDD and writing-good-tests instructions.

## Shared interfaces

`{ surface: 'attractor', parameter: 'intensity', value: finiteNumber }` is the complete command shape.

`discoverVisual()` returns null or an immutable `{ manifest, current: { intensity }, target: { intensity } }` from the actually mounted controllable field.

`controlVisual(command)` returns `{ status: 'accepted', surface, parameter, requested, effective }` or `{ status: 'refused', code }`. Accepted means scheduled; it never means already painted. Stable reason codes: INVALID_CONTROL, UNSUPPORTED_SURFACE, NO_ACTIVE_VISUAL, NOT_LIVE. Keep failure reasons as data, renderer details out of reader copy.

Host bridges use `host.discoverVisual({ role, player })` and `host.controlVisual({ role, player, command })`, synchronously. They verify the router's currently mounted Chamber owns that exact Player. Runtime checks presented/current run identity before invoking them; absent handlers refuse.

### Task 1: Mounted visual capability and owned transition

**Files:** Create src/visuals/attractor-manifest.js and focused tests; create src/live/visual-control.js and tests; modify src/visuals/attractor.js, src/visuals/visual-field-director.js and lifecycle tests; modify src/components/Chamber.js with focused existing renderer tests.

**Interfaces:** Produce shared command validation and immutable manifest. Produce `discoverVisual()` and `controlVisual(command)` on VisualFieldDirector and Chamber. Active Attractor record supplies the same methods; non-Attractor records expose none. Keep renderer identity and destroy ownership intact. No Player changes required.

- [ ] Write failing behavior tests for validation, bounds, discovery limited to a mounted capable field, live transition/retarget and disposal. Literal expectations include effective 0.75 for requested 8 and refusal for value NaN or an extra shader field.

```js
expect(director.controlVisual({surface:'attractor', parameter:'intensity', value:8}))
  .toMatchObject({status:'accepted', requested:8, effective:0.75});
expect(director.controlVisual({surface:'attractor', parameter:'intensity', value:NaN}))
  .toEqual({status:'refused', code:'INVALID_CONTROL'});
```

- [ ] Run new tests using the supported Node and `node_modules/vitest/vitest.mjs run <files>`; save the intended red output in the task report.
- [ ] Implement the small manifest and closed validator first; validate again at the renderer boundary. Implement brightness interpolation inside the existing Attractor frame lifecycle, including paused-field repaint and reduced-motion single repaint. Never add a second reading clock or remount the field.
- [ ] Wire active-record discovery/control through the director and Chamber. A disconnected/destroyed field refuses. Preserve authored cue behavior; cancel controls on successor cues even if the successor is the same authored renderer/config.
- [ ] Run new and existing Attractor/director/Chamber visual tests, self-review, and commit only owned files. Record red/green commands and concerns in task-1-report.md.

### Task 2: Live runtime and reader control loop

**Files:** Modify src/live/runtime.js and runtime.test.js; modify src/live/host/LiveHost.js and tests; modify src/live/host/controls.js, controls.test.js, LiveHost.css; extend src/live/visual-control.js/tests with closed phrase parser if needed. Existing mic question interpreter remains unchanged unless a focused shared normalization extraction is necessary.

**Interfaces:** Consume Task 1's Chamber/director discovery/control and command validator. Produce runtime `discoverVisual()` and `controlVisual(command)` and host bridges described above. Export `interpretVisualControl(text)` returning a boolean or closed intent for normalized "more vibrant" only. No guessed parameter values and no direct DOM renderer access from the UI.

- [ ] Write failing runtime tests for control after terminal composition while Player still plays, held-main and active-side delivery, starting/ended/stopped refusal, pending presentation, and host/field identity loss. Tests keep real runtime state and verify no re-created Player or additional provider open.
- [ ] Write failing UI tests for typed phrase, limit outcome, invalid phrase visibility, a dedicated non-holding visual speech mode, preserved existing Speak holding behavior, recognizer cancellation and failure. Literal parser cases: " Please MORE   VIBRANT! " accepts; "not more vibrant" and "more vibrant and stop" refuse.
- [ ] Run intended red tests before implementation and retain evidence in report.
- [ ] Implement runtime discovery/control with fail-closed host responses and bounded journal entries; sealed composition stream is untouched. Active visible run selected internally, not by callers. Catch host errors as refusals without changing playback status.
- [ ] Add host bridge using current router Chamber instance and exact Player identity; supply it consistently for mock, provider, and embedded live runtime construction.
- [ ] Add labelled typed visual input/action and dedicated visual-listening button, reusing the existing recognizer with one listener owner. Match closed grammar and increase target by 0.1. Unknown visual text is shown and never opens a Dive. Preserve existing question mic mode and privacy text. Use truthful accessible messages for changed target, limit, and refusal.
- [ ] Run focused existing runtime/controls/host/mic tests and new tests; self-review, commit owned files, report red/green evidence.

### Task 3: Browser proof, documentation, and acceptance

**Files:** Extend existing live Playwright suite under tests (locate current suite), and existing live documentation in docs/plans/LIVE-CURRENT.md; update docs/specs/ARCHITECTURE.md prose only if its contract description changes. Do not hand-edit generated graph.

**Interfaces:** Consume Tasks 1/2 through real `/live` UI with deterministic mock provider. No test-only production methods or renderer globals.

- [ ] Write a failing browser test before filling any uncovered integration gaps. Freeze field motion if necessary for a meaningful pixel comparison using legitimate paused/reduced-motion mode, then separately verify normal playback advances. At least one test must demonstrate painted canvas output changes, not merely a dataset or receipt.

```js
// Browser assertion: real canvas bytes sampled before and after local control differ.
expect(afterPaint).not.toEqual(beforePaint);
expect(firstChangedAt - submittedAt).toBeLessThan(1000);
expect(afterAtomIndex).toBeGreaterThan(beforeAtomIndex);
```

- [ ] Verify same canvas/renderer stays mounted across control, authored successor replaces adjustment, rapid retarget cancels prior work, Stop removes controls, and fake visual recognition does not hold narration. Extend existing fixtures rather than adding a parallel harness.
- [ ] Run audio hydration before browser tests. Existing Playwright global setup builds/serves the app; do not start an extra server. Install Chromium only if absent.
- [ ] Fix only integration defects exposed by these tests, retaining failing evidence before each fix. If a defect belongs to earlier task files, report to the coordinator rather than unreviewed broad rewrites.
- [ ] Document internal contract, readable bounds, lifetime, and limits: typed local latency verified, real microphone/provider tool operation and perceptual vibrancy unverified. Explain how to try it through `/live`.
- [ ] Run browser feature suite and gate, focused unit suites and required CI checks. Report exact commands/results and environment failures; do not claim success on skipped checks. Commit tests/docs and report.

## Controller verification

- [ ] Review each task for spec compliance and code quality before its successor begins.
- [ ] Keep plan-specific ignored ledger, briefs, reports and review packages.
- [ ] Independently rerun relevant unit suite, browser feature test and required CI checks; confirm generated diagram expectations and first-load budget.
- [ ] Whole-change review, fix concrete findings with LUNA implementer, scoped re-review.
- [ ] Finish as locally committed, reviewable work; no merge or deployment without user authorization.
