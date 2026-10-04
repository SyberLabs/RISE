# RISE team tracker handoff

Date: 2026-10-04. Record of the local tracker implementation before PR CI. No production release or public dashboard hosting was performed.

## What exists

Branch `codex/roadmap-tracker`, managed worktree `C:/Users/MATEO/.codex/worktrees/roadmap-tracker/nise`. Main through `2c71cba8` is integrated without history rewrite. Dashboard code fixes are reviewed at `42aa9568`; engine at `5181b593`, with portable subprocess and real stale-revision tests at `c63ea422` / `4876bf88`.

There are 28 tasks across Reader, Live + RiseSDK and shared foundations. Root AGENTS directs agents to the product library, task ownership, dependencies and validated updates. The product library indexes existing contracts/intent/records, preserves the supplied October performance roadmap and records available conversation decisions without inventing a full transcript.

The dashboard is separate from the Reader build: `npm run roadmap:dev` starts a loopback read-only server (default port 4173). Current review instance is `http://127.0.0.1:4186/`. It shows recent task activity, evidence-mapped/unmapped Git work, priorities, dependencies, milestones and task evidence. It polls every 15 seconds; details remain open during refresh. The static build is a dated snapshot with no polling.

Task updates use `node scripts/roadmap.mjs update ID --patch FILE --expect-revision N --summary TEXT`; validation runs before atomic persistence. Git remains the cross-worktree review/concurrency mechanism. Each dashboard shows its serving checkout; it does not magically receive unmerged task edits from other branches.

## Observed checks

- Tracker Node tests: 23 passed, zero failures/skips.
- All 28 records validate; static dashboard builds.
- Chromium: desktop and 375/320px no horizontal overflow; lane/search/empty filters; automatic poll updates; task and history disclosures retained through success/error; stale data retained then recovered; static snapshot performs no polling; no page exceptions.
- Wiki: 73 pages; repository hygiene: 8 clean checks.
- Architectural contract: 8 tests passed on the integrated branch.
- Integrated Reader build succeeds; first load is 59.9 KB brotli against 64 KB budget. Existing Vite JSON-import/chunk-size warnings remain unrelated to the tracker.
- Independent review found portable-runner, PR-boundary, duplicate-count, refresh-order and disclosure-reset defects; meaningful tests cover the corrected behavior. Scoped final review has no remaining findings.

These are local engineering checks. Browser phone widths are emulation, not witnessed phone acceptance. The full Reader unit/audio/browser suite was not rerun locally for this standalone tool. Required PR CI also runs the new tracker check/tests in its existing job; no new required check or service was introduced. Remote exact-head CI was pending when this record was written.

## Product state and next use

Seth's merged Reader contributions are mapped individually, including Home/Today, recitation machinery, CSP, frame adaptation, navigation and sliced Ember baking. Merge evidence does not pass listening/device/source certification gates. Reader release reconciliation is a separate task.

PR #371 remains OPEN draft at `62fe11f3`; #372 remains OPEN draft at `65c1824f`, verified remotely on 2026-10-04. Composer M1–M4 and real-host Live research are distinct dependency paths. Events/voice-perception/SDK scenes remain conditional later work. No demo exposure is started by the tracker.

Review the local view with Mateo/Seth, then integrate the tracker through required CI. Future agents claim one task and update evidence in the same PR. Host the dashboard only after the requested content/access review. Do not repeat the completed implementation or invent product acceptance from task status.
