# RISE team tracker implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development or executing-plans to implement this plan task-by-task.

**Goal:** Give Mateo, Seth and agents a repository-owned tracker and separate local dashboard for both product directions.

**Architecture:** One validated JSON file per task, Git-reviewed updates and a read-only loopback dashboard. Existing documents retain authority; product summaries provide navigation and provenance.

**Tech Stack:** Node built-ins, vanilla JavaScript, HTML/CSS; no new dependencies.

**Spec:** `docs/product/TRACKER-DESIGN.md` (approved conversational design recorded here).

## Global constraints

- No production routes, new dependencies, credentials, hosted writes or automatic completion inference.
- Exact task schema and API from the spec; one owner per task; validation before writes.
- Reader, Live/SDK and shared foundations remain distinct lanes.

### Task 1: Task engine and CLI

Files: `scripts/lib/roadmap.mjs`, `scripts/roadmap.mjs`, `scripts/roadmap.test.mjs`.
Produces `validateTasks(tasks)`, `loadTasks(root)`, `updateTask(root,id,patch,{expectedRevision,summary,now})` and `/api/tracker` shape in the spec.
- [ ] Write failing Node tests for unknown dependency, cycle, unsupported completion, stale update and preservation on invalid edit. Run `node --test scripts/roadmap.test.mjs` and observe failures.
- [ ] Implement schema/graph validation, atomic single-file updates, allowlisted server, static snapshot generation and recent Git log with execFile (no shell).
- [ ] Rerun tests, including real HTTP traversal/method failures and generated static assets. Commit only assigned files.

### Task 2: Dashboard

Files: `tools/roadmap/index.html`, `tools/roadmap/dashboard.js`, `tools/roadmap/styles.css`, `tools/roadmap/dashboard.test.mjs`.
Consumes `{tasks,recentCommits,generatedAt}` from `/api/tracker` or static `snapshot.json` and exact task schema.
- [ ] Write failing filter/mapping/DOM safety tests; run `node --test tools/roadmap/dashboard.test.mjs`.
- [ ] Implement lane and milestone views, search/status filters, blocked/ready lists, recent task activity and mapped/unmapped commits. Display refresh/static/error states. Use textContent and safe URLs.
- [ ] Rerun tests and browser-check desktop/phone. Commit only assigned files.

### Task 3: Seed and integrate (coordinator)

Files: `docs/product/tasks/*.json`, `docs/product/README.md`, `docs/product/discussions/*.md`, `AGENTS.md`, `docs/README.md`, `package.json`, `.gitignore`.
- [ ] Seed Reader work and Composer milestones with dated references, unassigned owners unless already owned; preserve unknown/human acceptance gaps. Record October product decisions and roadmap with provenance.
- [ ] Add agent workflow and npm `roadmap:check`, `roadmap:dev`, `roadmap:build`, `test:roadmap` commands and ignored static output. Add tracker validation/tests to the existing CI job after they pass locally; no new required check. Do not modify deployment files.
- [ ] Run task validation, tracker tests, wiki, hygiene, diff checks and browser smoke. Review full change and commit reviewed work. Launch local dashboard for review.

## Preflight

Tasks 1/2 consume the same fixed schema/API and own separate files. Task 3 supplies records and integration. Ruling: approved design and prior LUNA instruction authorize executing this plan without another execution-choice gate. No database, automatic completion or production route is needed.
