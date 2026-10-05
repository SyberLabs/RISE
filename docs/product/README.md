# RISE product library and team tracker

The Reader and the ChatGPT Composer (with RiseSDK later) are equal product directions. Shared foundations connect specific tasks; research in one lane does not automatically hold the other. Start the local team dashboard with `npm run roadmap:dev`, then open the loopback address printed by the command. The dashboard is read-only and refreshes while agents update task files. It is separate from the public reader. Each dashboard reflects the checkout serving it; updates from other branches appear after their commits are integrated. Seth can run the same commands in his checkout. Git review resolves cross-branch updates.

## Current direction and truth

| Source | Role |
| --- | --- |
| [Task records](tasks/) | Current work state, owners, dependencies and linked evidence; validated JSON, one file per task |
| [Reader direction](READER-DIRECTION.md) | Website scope and near-term acceptance packages; Intent |
| [Composer decision](discussions/2026-10-04-composer-decision.md) | Composer is the approach in ChatGPT; Dive and realtime Live out of current scope; Record |
| [Composer-first roadmap](../COMPOSER-FIRST-ROADMAP.md) | Composer delivery sequence M0–M4 (M3 removed); Intent |
| [October decisions](discussions/2026-10-03-direction-decisions.md) | Dated conversation summary and provenance; Record |
| [Tracker design](TRACKER-DESIGN.md) | Tracker architecture and boundaries; approved Intent implemented by this tool |
| [Experience Program](../vision/EXPERIENCE-PROGRAM-SPEC.md) | Durable score Contract |
| [System architecture](../specs/ARCHITECTURE.md) | Runtime architecture Contract |
| [Human release acceptance](../RELEASE-ACCEPTANCE-PROTOCOL.md) | Human evidence Contract |

Status and delivery are independent. `done` means a task's stated scope is complete, not that the product is released. A merged implementation task can coexist with unstarted acceptance tasks. Dashboard readiness depends on completed task dependencies. No percentage is presented as a measure of reader value or release readiness.

## Agent update workflow

1. Read this index and the lane's direction. Run `npm run roadmap:check` and choose a ready task; inspect dependencies and acceptance before coding.
2. Claim the task with one owner and an activity summary. Do not replace an active owner without coordination. Keep one narrow PR and respect file ownership.
3. Update the task in the same PR as the work. Link commits/PRs, exact test evidence and human observations; distinguish branch, merged, deployed and accepted. No tokens or participant data.
4. Validate the full graph before committing. Never infer task completion from a green build or merged PR alone. Reconcile acceptance and evidence, and record remaining blockers.

CLI example (run from the repository):

```sh
node scripts/roadmap.mjs validate
node scripts/roadmap.mjs update LIVE-003 --patch patch.json --expect-revision 1 --summary "Claimed fixture preparation"
```

`patch.json` contains only the fields to change, for example:

```json
{"owner":"agent-fixtures","status":"in_progress"}
```

The CLI adds an activity entry, timestamp and revision after validating the candidate graph. A stale expected revision fails without changing the record. For richer updates, edit one JSON record directly, increment revision, update timestamp/activity and run validation. Git review resolves cross-branch conflicts; the CLI is not a multi-user locking service. Patch files are temporary local inputs, not new task records.

Commands: `npm run roadmap:check`, `npm run test:roadmap`, `npm run roadmap:dev`, `npm run roadmap:build`. Static output is an explicitly dated snapshot; re-run the build for current state. Shared hosting and dashboard writes are deferred until content/access review. Recent Git history includes unlinked work so the team can classify it instead of silently omitting it.

## Product discussions and earlier direction

The collection preserves available source documents and summaries. It is not a complete transcript of every chat or external MasterMind discussion. Historical proposals retain their dates and do not override current contracts.

- [Original October performance roadmap](discussions/2026-10-original-performance-roadmap.md): user-supplied long-range vision, retained verbatim; historical Intent, Composer-first changes delivery order.
- [North Star](../vision/NORTH-STAR.md): July orientation/doorway direction.
- [Dreams](../vision/DREAMS.md), [Journeys](../vision/JOURNEYS-SPEC.md), [Source expansion](../vision/SOURCE-EXPANSION-SPEC.md) and [Source curation](../vision/SOURCE-CURATION-SPEC.md): Reader horizon.
- [Narration](../vision/NARRATION-LANE-SPEC.md), [Recitation](../vision/RECITATION-SPEC.md), [Page](../vision/PAGE-MODE-SPEC.md), [Spatial Chamber](../vision/SPATIAL-CHAMBER-SPEC.md), [Text-attuned imagery](../vision/TEXT-ATTUNED-IMAGERY-SPEC.md) and [Visual navigator (historical)](https://github.com/SyberLabs/RISE/blob/4737d5ae/docs/vision/VISUAL-NAVIGATOR-MIGRATION.md): audiovisual design discussions.
- [Scriptorium](../vision/SCRIPTORIUM-SPEC.md), [Scriptorium strengthening](../vision/SCRIPTORIUM-STRENGTHENING-SPEC.md), [Workshop](../vision/WORKSHOP-COMPOSITION-STUDIO-SPEC.md) and [Agent composition](../vision/AGENT-COMPOSITION-AND-RENDER-SPEC.md): authored experiences.
- [Current consolidation](../plans/CURRENT-CONSOLIDATION.md), [Live Current](../plans/LIVE-CURRENT.md), [Live MCP](../plans/LIVE-MCP.md), [Live handoff](../plans/LIVE-HANDOFF.md) and [Live evaluation](../plans/LIVE-EVALUATION.md): earlier integration and research direction, with status limits in each source.
- [August release corridor](../RELEASE-ROADMAP-2026-08-20.md) and [August release report](../RISE-RELEASE-REPORT-2026-08-31.md): historical Reader gate/evidence snapshots requiring current reconciliation.

## October engineering context

- [Performance foundation](../superpowers/plans/2026-10-02-rise-performance-foundation.md) and [current handoff](../superpowers/handoffs/2026-10-02-rise-performance-foundation-current.md).
- [Release blockers](../superpowers/plans/2026-10-02-rise-release-blockers.md).
- [Stack review design](../superpowers/specs/2026-10-02-rise-stack-review-repair.md) and [repair plan](../superpowers/plans/2026-10-02-rise-stack-review-repair.md).
- [ChatGPT acceptance](../superpowers/handoffs/2026-10-02-rise-chatgpt-live-acceptance.md) and [reader Begin](../superpowers/handoffs/2026-10-02-rise-chatgpt-reader-begin.md): historical handoffs, not current-release acceptance.
- [Decoupled design](../superpowers/specs/2026-10-03-gate0-decoupled-design.md) and [probe plan](../superpowers/plans/2026-10-03-gate0-decoupled.md): pending host experiment.
- [Composer contract](../superpowers/specs/2026-10-03-composer-first-contract.md), [foundation reconciliation](../superpowers/handoffs/2026-10-03-composer-foundation-reconciliation.md) and [earlier parallel assignment](../superpowers/handoffs/2026-10-03-parallel-roadmap-assignment.md): current boundaries and superseded broader assignment.

- [Tracker implementation handoff](../superpowers/handoffs/2026-10-04-roadmap-tracker.md): local verification, branch and next contributor workflow.
