# RISE parallel roadmap assessment and agent assignment

> Superseded for release sequencing and agent scope by [the Composer-first roadmap](../../COMPOSER-FIRST-ROADMAP.md). Keep semantic convergence; defer the general temporal reducer and mutation demonstration until the Live research earns them. The assessment below remains historical evidence.

Date: 2026-10-03. This is an assignment brief, not authorization to deploy or merge.

## Standing and evidence boundary

The October roadmap remains: Gate 0 and transport repair; semantic convergence; a small instrument catalog; events with temporal authority; one reciprocal Live demonstration. Foundation work is provider-independent. Gate 0 decides whether ChatGPT is a Live host, not whether to build the RISE kernel.

Remote main was checked at `38332c468be98e8dffd671304e3076db06cdc758`. The visual-catalog PR #365 and Live-door PR #366 have merged. Draft repair PR #371 is still at `8819564483491f584c1d312b8fba10132ac8e61f`; draft experiment PR #372 is at `65c1824fbeda95289c652368816be47d2cf590c4`, based on #371. Main and #371 have diverged. Candidate test results do not certify current main or a future rebased tree.

| Roadmap area | Standing | Remaining |
|---|---|---|
| Composer admission/Begin/playback | Repaired and tested in #371; earlier audible ChatGPT demonstration exists | Reconcile with current main and record exact-head release acceptance |
| Gate 0 | Direct-delivery trial made new widgets; decoupled probe locally verified in #372 | Real-host delivery, one-instance continuity, same-turn speech/tool ordering, marker recognition |
| Semantic convergence | Experience Program, Current compiler, Session and Player exist | Live conditions are applied after canonical compilation; reader visual changes lack canonical score authority |
| Manifests/catalog | Main has a searchable nine-surface browser catalog; candidate adds strict manifests/admission for Attractor, Klee/Genesis and Neural | Broader renderer parity, accurate accessibility/cost evidence, bounded model-facing retrieval; Neural is not a Current/control surface |
| Events/commit horizon | Current streaming reducer preserves ended segments; speech governor controls playback | Canonical cue mutation, active/future authority, retained reader edits and valid Program projection |
| Voice | Browser fallback and speech-governor path exist | Benchmarked local neural streaming/marks and interruption behavior; browser timestamps do not prove audible timing |
| Reader control/perception | Bounded local visual controls, pause and Dive exist | Score-aware reader edits and bounded observations delivered to the active model |
| Scenes/SDK/generated renderers/materialization/multiple hosts | Later product stages; some existing composition/export machinery is reusable | Reciprocal foundation first; no public SDK or arbitrary generated code now |

Code seams checked in the candidate: `src/live/runtime.js` compiles `run.stream.toCurrent()` then separately applies `withExperientialState` to `session.visualProgram`; `src/live/stream.js` projects ended segments into Current without passage state or speech observations. `src/core/visual-catalog.js` holds the candidate's three strict manifests. `src/core/rise-current.js` contains the existing Current-to-Program materializer. Not every runtime observation belongs in a durable score.

## Ownership

Coordinator/human lane: exact-head ChatGPT trial, temporary exposure and shutdown, `scripts/gate0*`, MCP host/Worker changes, provider credentials, PR #371/#372 reconciliation, integration, workflows, lockfile and production verification.

Long-horizon agent lane: provider-independent score convergence and temporal-authority kernel. Own new narrowly scoped core modules and focused tests; modify `src/live/runtime.js`, `src/live/stream.js`, `src/core/rise-current.js` only where their existing boundary must consume the canonical projection. Existing Program/compiler/Player modules are shared interfaces: keep changes minimal and report any required signature change before another lane depends on it. Leave host, Worker, provider adapters, catalog expansion and production configuration with the coordinator.

Use a separate worktree and `codex/` branch from the reviewed foundation `8819564483491f584c1d312b8fba10132ac8e61f`, recording that exact starting SHA. Do not include #372's experimental probe in the agent's work. A reverse comparison confirms #371 has candidate-only changes in `rise-current.js`, `live/runtime.js`, `live/stream.js`, and the visual catalog; starting from current main would omit those repairs. Preserve their tests and behavior. Do not copy the candidate over main, resurrect deleted UI, replay already-merged catalog/door work, or force-push shared branches. The coordinator reconciles the foundation with current main and rebases the new work onto that reviewed integrated base before landing it. Until then, the new draft PR depends on #371. The host experiment stays pinned to its tested executable.

## Copyable long-horizon assignment

Build the provider-independent performance foundation described below while the coordinator runs the real ChatGPT trial. Progress until all three milestones have concrete, reviewable deliverables; do not widen into provider integration or platform features.

Non-negotiable architecture:

- `rise.experience-program.v1` is the durable score. Current remains an adapter. Use the existing Session/compiler/Player path; no second runtime or score format.
- Authored intent and reader-authorized changes belong in the score where its vocabulary can represent them. Speech marks, delivery receipts and observations remain timing/evidence, not invented score cues.
- Keep existing public Current/current-events compatibility. Record the relationship between Current streaming and canonical score operations in an ADR. Do not publish a competing versioned wire protocol in this assignment.
- Stable source-character coordinates govern score changes. Compiled atom IDs are not durable anchors.
- Future intent can change. Experienced semantics cannot be rewritten. Active changes require an explicit narrow rule, initially the existing bounded Attractor intensity operation.
- Reader input and model proposals have distinct authority. A transport acknowledgment does not grant durable authority. Preserve score import/approval behavior; do not globally mark model-authored content reader-approved.
- No executable model content, new dependencies, shared inference, deployments or merges. Use existing admission bounds rather than copying constants.

### Milestone 1 — converge the existing semantics

Write a short ADR and an executable equivalence fixture before extending events. Map Current, live-prefix projection, Experience Program, Session, Player and reader-control ownership.

Replace the separate post-compilation condition rewrite with a documented canonical projection for the visual properties that are actually implemented. Preserve existing presentation behavior, themes, Dives, source anchors and unchanged sealed Current compatibility. Unsupported condition dimensions must not silently acquire meaning. Do not force observation journals into the Program merely to retain them.

Deliver a small draft PR with meaningful RED/GREEN tests: equivalent streamed and composed inputs preserve shared score semantics; mapped visual conditions survive Program validation/compilation; rejected input leaves the previous state intact; chunk-mode changes do not move source-bound cues. Document what remains intentionally transient.

### Milestone 2 — define and prove temporal authority

Implement a small internal reducer over canonical Program operations, with an injected playback position/clock boundary. Start with future visual cue selection and parameter updates, plus the existing bounded reader intensity control. Keep text, audio and pace expansion out of this milestone.

The reducer must produce a valid canonical Program prefix and structured refusals. Prove future edits are accepted; edits affecting experienced semantics are refused; active model edits are refused unless explicitly permitted; the bounded reader operation preserves its authority and source position. Duplicate/stale/wrong-session operations and invalid anchors/configurations cannot mutate accepted state. Test the semantic interpretation of the committed prefix, not just object shape or cue IDs.

Persist enough admitted intent and authority to reconstruct the changed score; use existing interchange/Vault machinery rather than a second durable store. Keep performance receipts separate from authored data. Deliver the second reviewable PR with the authority table and boundary tests.

### Milestone 3 — deterministic local demonstration

Use the existing runtime/Player and an injected deterministic clock or existing synthetic voice to show: open an explanation, admit a future visual cue, advance into it, apply a reader intensity change, pause/resume, and reject an attempted past edit. Preserve the running Player; do not restart the experience for each action.

The final trace must correlate source positions, admitted operations, score revisions and applied changes. Export/validate the resulting canonical score using existing interchange; compare replay semantics for the demonstrated authored changes. This is a local kernel demonstration, not proof of real speech quality, provider reciprocity or ChatGPT interleaving.

Deliver the third PR or a clearly isolated demonstration/test commit. Run focused checks after each milestone and required repository gates before publication. Report exact SHAs, RED/GREEN evidence, observed behavior and remaining gaps. Commit/push reviewable branches and open draft PRs; leave review, merging, rebasing shared candidates and deployment to the coordinator. Do not run the complete suite after every small edit.

Done means three reviewed deliverables with a reproducible local trace and canonical score output, not merely an ADR or a new protocol schema.

## Optional genuinely independent second assignment

A local voice-clock benchmark can run concurrently: consume the existing voice/governor boundary, emit normalized character/timing marks in an isolated harness, measure cold start, first sample, throughput, memory, interruption latency, alignment error and competition with one visual. Own only the benchmark/experimental adapter and evidence; do not replace the production voice or change kernel clock interfaces. Keep model/license/asset requirements explicit. Integrate only after the timing contract is agreed. Do not call it audible acceptance without reader observation.

Defer catalog expansion and provider tool exposure until the canonical operation interface is stable. Defer scenes, SDK freeze, generated-renderer admission and additional hosts until the reciprocal demonstration earns them.

## Integration checkpoints

1. Establish separate worktrees and file owners.
2. Review Milestone 1's semantic/authority map before wiring Milestone 2 to Player.
3. Freeze the source-position and operation/refusal interface before another agent consumes it.
4. Reconcile current main and the pending repair stack once, with a rebase-integrity check and exact-head tests.
5. Combine the host evidence and local kernel evidence without treating either as proof of the other.

The source roadmap's historical ADR/VISION status tables lag the new experiments and merged catalog. Update status claims in a focused documentation change after the next real-host result; do not rewrite historical trial records.
