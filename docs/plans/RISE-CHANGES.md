# RISE Changes — the shared contract (coordinator, 2026-10-14)

RISE Changes turns what merged into RISE into a narrated RISE reading. Pilot: one digest a week for the TEAM (internal audience), from merged pull requests on SyberLabs/RISE. Readers-facing digests come later, behind a human approval; the schema carries `audience` now so that is additive.

## Flow
1. GitHub Actions workflow `.github/workflows/changes-digest.yml` (weekly, Monday 09:00 UTC, plus `workflow_dispatch` with inputs `since` (ISO date, optional) and `dry_run` (boolean)).
2. `scripts/changes/digest.mjs` collects merged PRs since the newest digest's `period.to` (or 7 days back), routes them (a Jev-style finite-choice decision), composes one `rise.current.v2` with Claude, admits it with RISE's own validators, and writes two files.
3. The files are committed to the orphan data branch `changes-data` (NOT main; only main is protected). Nothing deploys.
4. The Worker serves them same-origin at `/content/changes/<file>` by proxying `https://raw.githubusercontent.com/SyberLabs/RISE/changes-data/<file>` (the repo is public).
5. The app shows `/changes` (the list) and `/changes/<id>` (the reading, its sources, and how each change was routed).
6. The workflow opens one issue per digest ("What changed in RISE: <period>") linking https://rise.syberlabs.io/changes/<id>, with the routing table, so the owner is notified.

## Files on `changes-data`
`index.json`:
```json
{ "schema": "syberlabs.changes-index/v1",
  "digests": [ { "id": "2026-10-19", "audience": "team", "title": "…", "period": { "from": "2026-10-12T09:00:00Z", "to": "2026-10-19T09:00:00Z" }, "count": 12 } ] }
```
newest first, at most 200 entries.

`<id>.json` where id matches `^\d{4}-\d{2}-\d{2}(-[a-z0-9]{1,8})?$` (date of `period.to`, a short suffix only if two runs share a day):
```json
{ "schema": "syberlabs.changes-digest/v1",
  "id": "2026-10-19",
  "audience": "team",
  "title": "What changed in RISE, 12–19 October",
  "period": { "from": "ISO-8601", "to": "ISO-8601" },
  "generatedAt": "ISO-8601",
  "model": { "router": "claude-sonnet-5-5", "composer": "claude-sonnet-5-5", "via": "Claude Code" },
  "changes": [
    { "number": 652, "title": "…", "url": "https://github.com/SyberLabs/RISE/pull/652", "mergedAt": "ISO-8601", "mergeSha": "2f13e80a…(40 hex)",
      "route": { "audience": "skip|team|readers|both", "significance": "minor|notable|major", "kind": "feature|fix|performance|design|infrastructure|records" },
      "included": true, "reason": "routed|records-only|limit" } ],
  "current": { "schema": "rise.current.v2", "...": "an admitted Current" },
  "sources": { "0": [652], "3": [653, 656] }
}
```
- `sources` maps a beat index (string) of `current.beats` to the PR numbers that beat speaks about; every number must be in `changes` with `included: true`; every included change is cited by at least one beat.
- `current.origin` = `{ kind: "model", name: "<composer model>", provider: "Anthropic, via Claude Code" }` (check the Current schema's origin fields and keep within them).
- Bounds: at most 60 changes listed, at most 24 included; titles ≤ 200 chars; the whole file ≤ 256 KB.

## Trust
- Everything in these files is model-written or PR-written. The app admits `current` through the SAME admission a card's Current goes through (scene code and SVG admission, the Current validator) before playing, and validates the envelope against this schema; a file that fails is shown as "This digest could not be shown", never played.
- The Worker proxies only filenames matching `^index\.json$|^\d{4}-\d{2}-\d{2}(-[a-z0-9]{1,8})?\.json$`, GET/HEAD only, returns `application/json`, `X-Content-Type-Options: nosniff`, caches index 5 minutes and dated files a day (they are immutable once written, but a re-run may replace one).

## The generator (PR A), as built
These refine the contract above; the shared code is `src/core/changes/` and the envelope check both sides can use is `contract.js` (`digestProblems`, `indexProblems`, `sourcesProblems`).

- **Run.** `node scripts/changes/digest.mjs [--since <ISO>] [--out <dir>] [--dry-run]`. It reads GitHub through `gh` and writes `<id>.json`, `index.json`, `issue.json` and `run.json` to a new or empty out directory. It never commits, pushes or opens an issue; the workflow does, and skips both on a dry run.
- **Period.** From the newest `period.to` in `index.json` on `changes-data` (or seven days back, or `--since`) to the moment of the run; a pull request is in it when merged after `from` and at or before `to`.
- **Collect.** GraphQL `repository.pullRequests(baseRefName: "main", states: MERGED)`, newest-updated first, paged until a pull request was last updated at or before `from`. Kept: number, title (one line, at most 200 characters), body (first 4,000 characters, for the models only, never written), url, mergedAt, merge commit, labels, the first 100 changed paths and the file count.
- **Records only.** Every changed file under `docs/product/tasks/`, and every changed file seen (a pull request with more than 100 files is never records-only). Listed with route `skip/minor/records`, never offered to a model.
- **Route.** One call; the answer is `{"routes": {"<number>": {"audience", "significance", "kind"}}}`. Each pull request's answer must have exactly the three keys, each one of the menu's values; otherwise that pull request gets `skip/minor/records` and stays listed. Answers for pull requests not offered are ignored.
- **Select.** Included in the team digest: any audience but `skip` (`team`, `readers` or `both`) with significance `notable` or `major`; the team hears everything that matters, and each change keeps its routed audience for a later readers digest. At most 24, majors first then the newest (`limit` for the rest). Listed: at most 60, every included one, then the weightiest and newest of the rest, records last. `changes` is written newest merge first. `count` in the index is the number of included changes.
- **Compose.** One call, taught by `CURRENT_GUIDE` from `src/live/guide/` (unchanged). The included pull requests are given in merge order with their merge times; the composer is told that a later pull request may resolve or supersede an earlier one's caveat (unverified, pending, left to decide), to state such a caveat only when no later pull request resolves it, and to speak as RISE in plain words with no flourish. The answer is `{"current", "sources"}`. `current.origin` is set to `{ kind: "model", name: <composer model>, provider: "Anthropic, via Claude Code" }` whatever the model wrote.
- **Admit.** The connector door's checks (65,536-byte bound, `validateRiseCurrent`, `admitSceneCode`, `admitSvg`, refusals worded by `describeDiagnostic`), the `sources` rules, and one more: every number the Current says or shows must be stated by an included pull request's number, title or body, or be a date of the period. A refusal gets a repair call with the refusal's lines, then one more; a third refusal fails the run without writing.
- **Ids.** The UTC date of `period.to`; a second digest that day is `-2`, then `-3`. A digest file is never replaced.
- **Title.** `What changed in RISE, <period>`, the period in UTC dates: `12–19 October`, `28 September – 5 October`, `28 December 2026 – 4 January 2027`. The issue is titled `What changed in RISE: <period>`.
- **Model calls.** Claude Code CLI 2.1.287 (on Node 22.23.3 in the workflow, which the CLI requires) in print mode (`-p --output-format json --model claude-sonnet-5-5 --max-turns 1 --tools "" --disallowedTools "mcp__*" --strict-mcp-config --disable-slash-commands --no-session-persistence --permission-mode dontAsk --system-prompt-file system-prompt.txt`), the prompt on stdin, run in a fresh temporary directory. The child's environment is an allowlist (`PATH`, `HOME`, the temp and locale variables, `CLAUDE_CODE_OAUTH_TOKEN`) plus `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`; the GitHub token is not in it, and `gh` is not given the Claude token. Any echo of the token in the CLI's output is redacted before it is logged.
- **Sample.** `src/core/changes/fixtures/` holds the recorded week of #652–#671 (the GraphQL page, a router answer, a composition) and the digest and index the pipeline produced from them (`2026-10-14.json`, `index.json`), admitted by the real validators.
