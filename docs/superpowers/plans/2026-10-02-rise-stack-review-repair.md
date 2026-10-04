# RISE Stack Review Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** Repair the theme regression and Worker admission boundary, reconcile preserved foundation work, and produce an exact-head tested local candidate.
**Architecture:** One canonical Experience Program/Session/Player path. MCP tool-input is a proposal, successful tool-result is Worker admission. Reconstruct on a private branch; preserved histories are rollback points.
**Tech Stack:** Vanilla JS, Vite, Vitest, Playwright, Cloudflare Worker; existing Node24 runtime satisfies repository floor.
**Spec:** `docs/superpowers/specs/2026-10-02-rise-stack-review-repair.md`.

## Global Constraints

- No dependency, lockfile, provider-credential, shared-inference, production configuration or workflow changes.
- Reader Begin/Stop, strict schema and UTF-8 budgets remain: Current65536 bytes, full MCP envelope/body262144 bytes.
- No implicit public exposure, force-push, merge, #354 deletion or protocol expansion.
- Preserve the foundation branch0a08ef72, remote6728e4f3 and local reconstruction backup. Source restoration must not overwrite already-retained theme-aware Current/compiler work.
- Tests verify behavior; root owns integration and generated diagram, LUNA owners write narrow product repairs. Independent review after each task.

## Task 1: Restore original theme and picker semantics

Files: the exact13 paths listed in `theme-reconstruction.md` in this plan's ledger. Source `d7dbd3ee`; no other11 theme paths require restoration. No Current/host/runtime edits.

- [ ] Confirm existing RED log: Current/current-guide19 failures before repair.
- [ ] Restore original13 blobs, excluding substitute-name followup commits:
```bash
git restore --source=d7dbd3ee --worktree -- scripts/decision-eval.test.mjs scripts/jev-eval-local-hf.mjs scripts/jev-eval-look-options.json scripts/jev-eval-phase-options.json scripts/jev-eval-reference-options.json src/app/jev-reading.js src/app/jev-reading.test.js src/components/Chamber.jev-look.test.js src/core/decision/recommend.js src/core/decision/recommend.test.js src/core/jev-color-themes.js src/core/jev-palette.js src/core/jev-palette.test.js
```
- [ ] Check all13 diffs against source intent: nine themes, handwritten ink/ground names, palette-table reading validation, recommendation prompt budget14000 and eval lists/guards. No unrelated changes.
- [ ] Run Current/current-guide, Jev palette/reading/Chamber look/recommend suites and Node decision-eval tests. Existing19 failures must pass with original explicit names.
- [ ] Commit only13 files, report commands and exact SHA, independently review. Keep expanded offline-provider regression unchanged: audit proves it covers the original invariant.

## Task 2: Make Worker success authorize Begin

Files: `src/live/hosts/mcp-port.js`, `src/live/host/LiveHost.js`, their tests and `e2e/live-mcp.spec.js`; Worker tests only for actual-boundary integration if required. Contract in `worker-admission.md` in this plan's ledger.

- [ ] RED: valid tool-input before delayed result has no playable Begin; successful matching result enables exactly one start; failed result never starts. ConfirmedA survives unrelated errorB.
- [ ] Preserve result-only host delivery. Admission listener receives only successful validated result; input must not consume its dedup key. Preview is optional, not a reason for a third state machine.
- [ ] Implement minimal activation/refusal guards. Never correlate an error to a Current without identity; retain bounded async correction behavior unless measured host evidence makes it unnecessary.
- [ ] Add actual Worker→port→Begin regression at the largest admitted UTF-8 payload, and just-over-budget refusal. Generate schema-valid bounded data, measure serializedbytes, preserve262144 outerlimits. Do not test only two copied constants.
- [ ] Run focused unit checks and affected MCP/control/red-team browser specs; commit narrow changes/report, independent review.

## Task 3: Reconcile preserved foundation without theme loss

Sources: Gate0 commits378e39ff/1630996c; materializer72a68ca5; catalog0a08ef72. Saved commit ranges remain immutable. Files: probe experiment; Current/spec/test; catalog/test. No host tool widening.

- [ ] Coordinator replays nonconflicting Gate0 commits. Verify resulting scope matches saved reviewed diffs.
- [ ] LUNA owner re-extracts materializeRiseCurrent from the theme-aware compiler. Preserve original theme validation/cue styles plus detached durablepair, provenance/literal/Dive and wrapper equivalence. Never take a whole conflict side. Run targeted Current and theme checks; review.
- [ ] Coordinator replays catalog commit. LUNA owner fixes open saved review finding: construct canonical compile-test cues from manifest.mapping instead of hardcodedrenderer/collection. Verify real mapping is executable and legacy behavior remains. Scoped independent re-review.

## Task 4: Integration and exact evidence

- [ ] Regenerate `docs/specs/ARCHITECTURE.md` via build-architecture-diagram.mjs; rerun and assert unchanged. No manual diagram edits.
- [ ] Run required CI checks, appropriate broader affected suites, browser gate and first-load budget. Hydrate before any audio-dependent suite; missing WAV is not a pass.
- [ ] Whole-candidate independent review; address load-bearing findings before publication decisions.
- [ ] Update evidence docs with actual repair SHA and actual local results. Historical audible Composer acceptance at04d2b828 remains historical only; new real-host proof pending.
- [ ] Present concrete repaired layer/candidate refs and checks. Keep draft until exact real-host acceptance; do not treat public exposure approval as granted.

## Task 5: Preserve independently added public fixes

Added after a fresh remote audit found public demo branch advanced from6728e4f3 to6b9cdf6f while private repair ran. This is integration of new external work, not another fix wave for the completed final review.

- [ ] Preserve the reviewed6eff540c candidate as a rollback point after finishing its full-suite diagnosis.
- [ ] LUNA owner transplants five public commits80f91240/324709e0/42640b10/e710d70e/5d547e1c into controls/CSS/Attractor/tests/e2e. Preserve strict result admission, actual Worker boundary cases, catalog behavior, all nine themes and materializer.
- [ ] Exclude17be6953: it only deletes the three restored themes and coverage. Diagram6b9cdf6f already matches candidate exactly; no manual edit.
- [ ] Independent scoped integration review of only the new delta; required affected unit/browser/build/budget checks after changes. Record previous concurrent full-suite failures separately and verify final full suite with measured resource constraints.
- [ ] Update exact evidence/handoff and publication refs. Do not overwrite independently advanced shared branch.

Preflight supplement: Task5 shares control/render interfaces withTask2/3, but leaves Worker/port/Current/materializer untouched. It consumes the restored nine-theme table; the public six-theme cleanup conflicts and is excluded. Generated diagram remains generator-owned and currently identical. Newly changed tests must retain result-only/Worker-boundary/reader-control assertions.

## Self-review

The critical theme, admission and diagram findings map to tasks1/2/4. The named provider test already retains the required invariant, so no duplicate is added. Catalog history guard is verified correct and untouched. Optional Workshop inert, controls limits and #366 Escape are separate bounded followups; #361/#366/#354 public integration remains outside this repair candidate. The event vocabulary and durable reader-control decisions remain explicit future architecture work.
