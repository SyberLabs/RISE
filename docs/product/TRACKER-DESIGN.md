# RISE team tracker design

Status: approved intent, 2026-10-03. Repository/local first; hosting follows content and access review.

## Purpose and boundaries

Give Mateo, Seth and agents one evidence-backed account of two equal product directions: the audiovisual Reader and Live + RiseSDK. Shared foundations form a third lane, with dependencies rather than duplicated tasks. The tracker describes development; it does not replace runtime contracts or the human release protocol.

Delete the proposed database, hosted write service and automatic completion inference. Git already provides review, attribution and concurrency. One JSON file per task limits parallel conflicts. A local read-only dashboard watches those files; agents update files through a validated CLI or reviewed edits. No dependency or production reader route is added.

## Task interface

Each `docs/product/tasks/<id>.json` has: `id`, `title`, `lane` (`reader`, `live-sdk`, `shared`), `milestone`, `status` (`planned`, `in_progress`, `blocked`, `in_review`, `done`), `delivery` (`not_shipped`, `branch`, `merged`, `deployed`, `accepted`), `owner` (string or null), `priority` (`now`, `next`, `later`), `dependencies` (task IDs), `acceptance` (nonempty strings), `evidence` (objects with `kind`, `ref`, `note`, `date`), `activity` (objects with `date`, `summary`), `updatedAt` (ISO timestamp), `revision` (positive integer), `summary` and `blocker` (string or null).

Evidence kinds: `pr`, `commit`, `test`, `observation`, `document`. References are HTTPS URLs or repository-relative file paths; execution claims live in notes, not fabricated results. Dates are ISO calendar dates or timestamps. No secrets or personal participant data belongs here. `done` needs an owner and evidence; `accepted` needs observation evidence; `blocked` needs a reason. Missing dependencies and cycles are errors. Dependency readiness is computed from `done` tasks and never inferred from delivery.

CLI: `node scripts/roadmap.mjs validate`; `update ID --patch FILE --expect-revision N --summary TEXT`; `serve [--port N]`; `build [--out DIR]`. Updates validate the complete candidate graph before writing, increment revision, append activity and set updatedAt; reject identity changes, unsupported fields and stale revision. CLI accepts data, never shell commands. Git commits remain the durable update history. Status is not derived from PR state.

## Dashboard and local server

A separate vanilla HTML/CSS/JS dashboard under `tools/roadmap/` shows lane cards, milestone/task filters, search, task evidence/dependencies, blocked and ready tasks, recent recorded activity and 30 recent Git commits. Commit links are matched using recorded commit/PR evidence; unmatched work is explicit. Header displays loaded snapshot time and refresh errors rather than leaving stale data looking current. Refresh every 15 seconds and on request. Initial UI remains read-only; editing instructions are visible.

`GET /api/tracker` returns `{tasks, recentCommits, generatedAt}`. Each recent commit has `{sha, date, subject}`. Shared module functions: `validateTasks(tasks)` throws descriptive errors; `loadTasks(root)` loads and validates; `updateTask(root,id,patch,{expectedRevision,summary,now})` returns persisted task. Server binds only `127.0.0.1`, serves an allowlist of dashboard assets plus validated data, and offers no mutations or arbitrary filesystem access. Static build emits the same UI with a generated snapshot and visibly identifies static mode. Static output is ignored by Git. Browser uses textContent/DOM APIs for task content and only safe links.

## Product discussion library and agent workflow

`docs/product/README.md` indexes current direction, historical intent, contracts and records. `docs/product/discussions/` holds dated summaries with provenance, not invented transcripts. Existing authoritative documents are linked rather than moved. Available October conversation decisions and the supplied long-range roadmap are preserved with their limitations. Reader historical release claims are marked needing reconciliation. Current task ownership is assigned only when claimed; Seth's product work is not inferred as ownership of every reader task.

Root AGENTS tells workers to read this index, select/claim a task, honor one owner and dependencies, update status/evidence in the same PR and never equate merged with accepted. Unmapped work can be linked after review. Docs README indexes every new published Markdown page.

## Verification

Node built-in tests exercise graph validation, stale update rejection and unchanged disk on invalid updates, dependency scheduling, local server allowlist and static output. Dashboard DOM behavior tests cover filter/search, safe text/link rendering, empty/error/stale states and unmapped commits. Browser smoke checks desktop and phone layout. Wiki links and hygiene must pass. The existing required CI job runs tracker validation/tests; no new check or service is added. The reader build must stay unaffected. No public hosting, production deployment, branch merge or real-host probe is part of this change.
