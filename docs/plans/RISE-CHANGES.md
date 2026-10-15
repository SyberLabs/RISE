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
  "sources": { "0": [652], "3": [653, 656] },
  "quality": { "firstPass": false, "repairs": { "composition": 1, "illustrator": 2 }, "checks": { "process-talk": 1, "text-crosses-shape": 2 } }
}
```
- `sources` maps a beat index (string) of `current.beats` to the PR numbers that beat speaks about; every number must be in `changes` with `included: true`; every included change is cited by at least one beat.
- `quality` (optional, before `notes`): the run's first-pass score (Quality gates, below). `firstPass` is true only when nothing was repaired and nothing let go; `repairs` counts the repair requests of each stage; `checks` maps each rule that fired (a lower-case id, at most 40 of them) to how many times. Every digest the pipeline writes has it; the two written before it do not, and stay valid.
- `notes` (optional, last): 1 to 20 sentences of at most 300 characters saying what the run let go, such as a picture not drawn; absent when there is none.
- `current.origin` = `{ kind: "model", name: "<composer model>", provider: "Anthropic, via Claude Code" }` (check the Current schema's origin fields and keep within them).
- Bounds: at most 60 changes listed, at most 24 included; titles ≤ 200 chars; the whole file ≤ 256 KB.

## Trust
- Everything in these files is model-written or PR-written. The app admits `current` through the SAME admission a card's Current goes through (scene code and SVG admission, the Current validator) before playing, and validates the envelope against this schema; a file that fails is shown as "This digest could not be shown", never played.
- The Worker proxies only filenames matching `^index\.json$|^\d{4}-\d{2}-\d{2}(-[a-z0-9]{1,8})?\.json$`, GET/HEAD only, returns `application/json`, `X-Content-Type-Options: nosniff`, caches index 5 minutes and dated files a day (they are immutable once written, but a re-run may replace one).

## The generator (PR A), as built
These refine the contract above. The code is in two places. `src/core/changes/` holds the pure pieces the app may share, which import nothing from the live layer: `contract.js`, the envelope check both sides use (`digestProblems`, `indexProblems`, `sourcesProblems`), with `collect.js`, `prefilter.js`, `write.js`, `claude-cli.js` and the sample in `fixtures/`. `scripts/changes/` holds the Node pipeline that reaches the live layer (the host guide, the MCP size bound): `route.js`, `compose.js`, `admit.js` and `run-digest.js`, which `digest.mjs` runs.

- **Run.** `node scripts/changes/digest.mjs [--since <ISO>] [--out <dir>] [--dry-run]`. It reads GitHub through `gh` and writes `<id>.json`, `index.json`, `issue.json` and `run.json` to a new or empty out directory. It never commits, pushes or opens an issue; the workflow does, and skips both on a dry run.
- **Period.** From the newest `period.to` in `index.json` on `changes-data` (or seven days back, or `--since`) to the moment of the run; a pull request is in it when merged after `from` and at or before `to`.
- **Collect.** GraphQL `repository.pullRequests(baseRefName: "main", states: MERGED)`, newest-updated first, paged until a pull request was last updated at or before `from`. Kept: number, title (one line, at most 200 characters), body (first 4,000 characters, for the models only, never written), url, mergedAt, merge commit, labels, the first 100 changed paths and the file count.
- **Records only.** Every changed file under `docs/product/tasks/`, and every changed file seen (a pull request with more than 100 files is never records-only). Listed with route `skip/minor/records`, never offered to a model.
- **Route.** One call; the answer is `{"routes": {"<number>": {"audience", "significance", "kind"}}}`. Each pull request's answer must have exactly the three keys, each one of the menu's values; otherwise that pull request gets `skip/minor/records` and stays listed. Answers for pull requests not offered are ignored.
- **Select.** Included in the team digest: any audience but `skip` (`team`, `readers` or `both`) with significance `notable` or `major`; the team hears everything that matters, and each change keeps its routed audience for a later readers digest. At most 24, majors first then the newest (`limit` for the rest). Listed: at most 60, every included one, then the weightiest and newest of the rest, records last. `changes` is written newest merge first. `count` in the index is the number of included changes.
- **Compose.** One call, taught by `CURRENT_GUIDE` from `src/live/guide/` (unchanged). The included pull requests, and as context only the routed ones left out (marked `"included": false`, never spoken of or cited, since a later minor fix may settle an included change's caveat), are given in merge order with their merge times; the composer is told that a later pull request may resolve or supersede an earlier one's caveat (unverified, pending, left to decide), to state such a caveat only when no later pull request resolves it, and to speak as RISE in plain words with no flourish. The answer is `{"current", "sources", "pictures"}`: the composer writes the words, and for each change or group of related changes a picture brief (`{ beat, medium, brief }`, the brief 20 to 300 characters naming every label and number to draw, medium `figure` by default or `scene` when motion explains), which RISE's illustrator draws (below). `current.origin` is set to `{ kind: "model", name: <composer model>, provider: "Anthropic, via Claude Code" }` whatever the model wrote.
- **Admit.** The connector door's checks (65,536-byte bound, `validateRiseCurrent`, `admitSceneCode`, `admitSvg`, refusals worded by `describeDiagnostic`), the `sources` rules, and one more: every number the Current says or shows must be stated by an included pull request's number, title or body, or be a date of the period. A refusal gets a repair call with the refusal's lines, then one more; a third refusal fails the run without writing.
- **The composition rule** (admitted with the composition, its refusals repaired like any other): `current.scenes` holds RISE's engines only, at most 2, each started at the opening or the close (the first or last 2 beats), for mood; every other picture is a brief, at least one, at most as many as the Current's 8 scenes leave beside its engines, each on a beat that names no scene of its own; and no scene is held for more than 4 beats. The first real digest (run 38635708731) held one attractor through all 16 beats; this rule is why it cannot happen again.
- **Illustrate.** The second role: each brief, in beat order, drawn by RISE Live's own illustrator (`draw` in `src/live/illustrator.js`, docs/plans/LIVE-CURRENT.md §19) through a text-stream adapter whose one request is an `ask`. Its instructions are Live's `ILLUSTRATOR_INSTRUCTIONS` plus a short note on where the digest's pictures are seen (a dark room, the full frame, labels readable 390 pixels wide); its request is Live's `promptFor` (the brief, the theme, the scene running, the two beats said with it); its admission and repair are Live's (`admitSvg`, `admitSceneCode`, three attempts), and every figure is also held to the number rule. An admitted picture becomes `picture-<n>`, started on its beat. A picture still refused, or whose call fails, is let go: its beat keeps the scene before it, the run log says so, and so does the digest's optional `notes` (1 to 20 sentences of at most 300 characters, shown under "How this was chosen" and in the issue).
- **Ids.** The UTC date of `period.to`; a second digest that day is `-2`, then `-3`. A digest file is never replaced.
- **Title.** `What changed in RISE, <period>`, the period in UTC dates: `12–19 October`, `28 September – 5 October`, `28 December 2026 – 4 January 2027`. The issue is titled `What changed in RISE: <period>`.
- **Model calls.** Claude Code CLI 2.1.287 (on Node 22.23.3 in the workflow, which the CLI requires) in print mode (`-p --output-format json --model claude-sonnet-5-5 --max-turns 1 --tools "" --disallowedTools "mcp__*" --strict-mcp-config --disable-slash-commands --no-session-persistence --permission-mode dontAsk --system-prompt-file system-prompt.txt`), the prompt on stdin, run in a fresh temporary directory. The child's environment is an allowlist (`PATH`, `HOME`, the temp and locale variables, `CLAUDE_CODE_OAUTH_TOKEN`) plus `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`; the GitHub token is not in it, and `gh` is not given the Claude token. Any echo of the token in the CLI's output is redacted before it is logged.
- **Sample.** `src/core/changes/fixtures/` holds the recorded week of #652–#671 (the GraphQL page, a router answer, a composition) and the illustrator's answers (`illustrations.json`), and the digest and index the pipeline produced from them (`2026-10-14.json`, `index.json`), admitted by the real validators.

## Quality gates
Every failure seen in a real run becomes a mechanical check that answers with a plain sentence a repair can act on; a sentence in a prompt alone drifts. The checks are pure (`src/core/quality/`, nothing from the live layer) and are run by the digest pipeline.

| Seen in a run | The check |
|---|---|
| A label drawn across its box (dry run 1, "harmonograph") | `svgLayoutProblems`: `text-crosses-shape` |
| A closing line about "the next dry run" (two dry runs) | `processTalkProblems`: `process-talk` |
| A number no pull request states | the number rule (Admit, above) |
| One visual held through the whole reading (run 38635708731) | the composition rule (above) |

**`svgLayoutProblems(svg, { roomWidth = 390, ground = '#0a0a0f', maxWork })`** reads the figure with the tokenizer that admits it (`svgTree` in `src/core/svg-admission.js`; a figure admission refuses is not judged) and answers `{ problems: [{ rule, line, message }], notes, work }`. Each label is a box: its x, y, dx and dy, font-size (16 when none is set), text-anchor, dominant-baseline and textLength, under every ancestor translate, scale and axis-aligned matrix. Its width is Helvetica's advance for each character (Arial's are the same), 0.56 em for a character outside that table, 0.6 em in a monospace family, 8% more when bold; a flat 0.56 em per character was tried first and wrongly refused two published labels made of narrow letters. Its height is the em box, 0.8 em above the baseline and 0.2 em below. The rules:
- `text-overlap`: two label boxes meet.
- `text-crosses-shape`: a label straddles the edge of a rect, circle or ellipse (their bounding boxes), or touches a line, polyline, polygon or path (their segments, a curve as eight chords, absolute and relative commands alike; the bounding box of a connector is not ink). A stroke widens the edge by half its width, and a label keeps 0.05 em clear of it.
- `text-outside`: any part of a label outside the viewBox.
- `text-too-small`: font-size × scale × 390 / viewBox width under 12 pixels.
- `text-low-contrast`: the label's fill (its attribute, its style, its parent's, `currentColor` as the words' ink `#eef0ff`, black when nothing sets one), blended by its opacity, under 4.5:1 (WCAG) against the ground, or against a filled rect it sits wholly on.
What it cannot place it never guesses: a rotation or skew, a CSS transform, a `<style>` sheet, an arc, a `<use>`, a `<textPath>`, a nested `<svg>`, a list of positions, a line placed by y alone and a length in another unit are each skipped with a note. At most ten problems a figure. `work` is the comparisons it made; past `maxWork` it compares nothing and says so.

**`processTalkProblems(texts, { subject })`** finds a beat that speaks of the making instead of the change, from a small literal list: dry run; test, trial or practice run; this, next, later, future, following, previous or last run; will show or will tell followed by nothing, in, whether, if, once, after, when, soon or later ("the room will show the picture" passes); remains to be seen; a later, next, coming, future, final, pending or human review, and under review; as of writing; the pipeline, unless the pull requests speak of a pipeline. A phrase an included pull request says itself passes.

In the pipeline:
- **Composition.** `admitComposition` holds the beats to `processTalkProblems` with the included pull requests as the subject; a hit is a refusal line like any other, repaired in the same two repairs. Each refusal also says how many lines each rule gave.
- **Illustration.** Every figure the illustrator draws is held to `svgLayoutProblems` as part of its admission, so a problem goes back as a diagnostic (`line N (text-crosses-shape): the text "…" at x 72, y 206 crosses the edge of the <rect> on line 11 …`) within the same three attempts. A code scene has no static text to place: it keeps the number rule only.
- **Rendered check.** `scripts/changes/render-check.mjs` draws each admitted figure in Playwright's Chromium, fitted whole into 390 × 844 and 1440 × 900 on the room's ground with `#eef0ff` as its `currentColor`, and measures every label with `getBoundingClientRect`: `rendered-overlap` (two labels' glyph boxes, less a tenth top and bottom for the font's leading, meet by more than a pixel), `rendered-outside` (a label past the figure's edge) and `rendered-too-small` (under 12 pixels at 390). The page has JavaScript off, a policy that loads nothing, and every request refused. A figure at fault goes back to the illustrator once, as a refusal carrying its source; a repaired figure still at fault is let go like a refused one (its beat keeps the scene before it, and `notes` says why). One browser serves the run and starts with the first figure; each check takes about 10 ms after a start of about 1.3 s (measured on 24 real figures). The weekly job installs it with `npx playwright install --with-deps chromium`, the build the lockfile pins. Its test, `scripts/changes/render-check.test.js`, needs that browser: the full unit suite runs it (`full-validation.yml` installs Chromium), and the fast set the required `CI` check runs excludes it (`vitest.fast.config.js`).
- **The score.** Every rule that fired and every repair asked for is counted into `quality` (`createTally` in `run-digest.js`). The run log prints `Quality: First pass: no — 3 repairs (1 composition, 2 illustrator); checks fired: figure (3), process-talk (2)` and the object as JSON; the issue carries the same line, and `/changes/<id>` shows it under "How this was chosen".
