# CI pipeline: speed, merge gates, and a diagram that cannot go stale

> Design, 23 August 2026

## The problem, measured

Run `32609458113` and the nine before it agree on the shape. A pull request
waits about ten minutes, and one job is nearly all of it.

| Job | Wall clock | Where it goes |
| --- | --- | --- |
| Browser smoke | 9m 43s | `test:e2e` 8m 43s, setup 1m 0s |
| Unit tests | 4m 20s | `test:run` 3m 12s, ffmpeg 18s, Chromium 18s |
| Scriptorium CLI | 1m 20s | almost entirely setup |
| Production build | 43s | the build itself is 3s |
| Source hygiene | 35s | the check itself is 2s |

The jobs already run in parallel, so the wall clock is the slowest one. Ninety
per cent of the wait is 22 Playwright spec files running one after another in a
single worker.

Three more facts the run history gives up:

- Every red run in the recent history failed the same way — the unit-test heap
  crash fixed on `main` by `e3dacc1`. The browser suite retried nothing in a
  full local run: 89 tests, 89 first attempts. It is slow, not flaky.
- Three of the last twenty-five runs were cancelled **on `main`**.
  `cancel-in-progress: true` is not scoped to pull requests, so a push to
  `main` can kill the run that would have said whether `main` is healthy.
- Several recent pull requests changed only prose — `AGENTS.md`, the Elon
  principles, the vendored Superpowers snapshot. Each spent ten minutes
  proving nothing about the application.

## Why the browser suite is slow, and what that permits

A local run on a box with the same shape as a GitHub runner (4 cores, 15.6 GB)
took 504s against CI's 8m 43s, so local measurement is trustworthy. Per file:

```
  199.0s  23 tests  mobile.spec.js
   47.8s   3 tests  page-fields.spec.js
   44.3s   9 tests  smoke.spec.js
   39.7s   6 tests  band-move.spec.js
   36.8s   6 tests  recitation.spec.js
   ...      (16 more files, 130s combined)
  498.0s  89 tests  total
```

`mobile.spec.js` is 40% of the suite on its own, and three of its tests —
each setting its own 120–300s timeout — are 170s of that 199s.

Playwright shards by **file**, not by test. Replaying the measured per-test
durations against `--list` output for each shard count proves it:

| Shards | Slowest shard | Note |
| --- | --- | --- |
| 2 | 255.9s | |
| 3 | 255.9s | no better than 2 |
| 4 | **199.0s** | shard 2 is exactly `mobile.spec.js` |
| 6 | 213.3s | and shard 3 gets zero tests |

199.0s is the floor, because one file cannot be divided. Four shards is the
smallest count that reaches it; anything more spends runner minutes for no
wall-clock gain. Each shard keeps `workers: 1` on its own machine, so the
"flows share an audio device" constraint is untouched — the parallelism is
across machines, not inside one.

Rejected alternatives: raising `workers` above 1 (violates that constraint);
moving the browser suite off pull requests (it is exactly the class of defect
we want blocked); splitting `mobile.spec.js` (its three slow tests are 170s,
so isolating them buys ~30s for a real test refactor); building once and
passing `dist/` to the shards as an artifact (the build is 3s, and the
serialisation costs more than it saves).

## What changes

### Speed

**Shard the browser suite four ways.** 9m 43s becomes roughly 58s setup + 3s
build + 199s specs ≈ 4m 20s.

**Let prose skip the expensive jobs.** A `changes` job asks the pull-request
API which files moved and classifies the change. Anything outside the prose
allowlist (`docs/`, `.agents/`, `.cursor/`, root `*.md`, `LICENSE`, `NOTICE`)
means code moved. The polarity is fail-safe: an unrecognised path runs
everything, and so does an empty answer.

Two jobs run even for prose. `ci-hygiene.mjs` reads `README.md` and `NOTICE`
for retired vocabulary, and the architecture document can be edited by hand,
so `hygiene` and `docs` are never skipped. They cost about 40s together.

**Delete the duplicated setup.** Six job definitions repeat checkout, Node
20.19, and `npm ci`, each carrying its own copy of the comment explaining the
Node pin. One composite action at `.github/actions/setup` owns it, so the
version has one name. Checkout itself stays in the workflow, because a local
action cannot be resolved before the repository exists on disk.

A Playwright browser cache was considered and dropped. The install is 18–24s
and most of that is `apt`, which the cache cannot hold; it would have saved
about five seconds for a new failure mode.

### Gates that do not exist today

**A first-load budget.** The repository is actively fighting the size of its
first screen and nothing measures it. `dist/index.html` names the whole set the
browser fetches before the application runs: one entry script, six
`modulepreload` chunks, one stylesheet. Gzipped that is 305.2 kB today. The
budget is 320 kB — enough headroom for ordinary work, tight enough that a new
subsystem landing in the entry chunk turns the check red. The script prints the
per-asset breakdown whether it passes or fails, so the number is never a
mystery.

**A dependency audit.** One production dependency reaches readers.
`npm audit --omit=dev --audit-level=high` takes about three seconds and ignores
the dev-dependency noise that makes `npm audit` unusable as a gate. It runs as
a step of `hygiene`, which already means "properties of the committed artifacts
checked where a unit test cannot reach them".

**A least-privilege token.** The workflow declares no `permissions` block, so
it inherits whatever the repository default is. Nothing in CI writes to the
repository: `contents: read`, with `pull-requests: read` added only to the job
that reads the file list.

**Cancellation scoped to pull requests.** `main` runs are allowed to finish so
a commit's health is recorded.

**One stable required check.** A `ci` gate job depends on every other job,
runs with `if: always()`, and fails if any dependency failed or was cancelled.
Skipped is allowed, because skipping is the point of the change filter. This is
the single name a branch ruleset should require — conditional jobs are only
safe to skip when something unconditional reports on their behalf.

### Documentation that cannot go stale

`ARCHITECTURE.md` and `README.md` both carry hand-drawn ASCII trees that
nothing forces anyone to update. `scripts/build-architecture-diagram.mjs`
reads every non-test module under `src/`, resolves its relative imports,
aggregates them to subsystem level, and writes a Mermaid diagram into
`ARCHITECTURE.md` between generated markers. Static and dynamic imports are
drawn differently, because a subsystem reached only through `import()` is not
in the first load — which is the same question the budget check answers.

The `docs` job regenerates the diagram and fails if the working tree moved.
The diagram cannot disagree with the code, because the code writes it.

Layering enforcement is deliberately **not** included. The diagram reports what
the edges are; deciding which of them are forbidden is a separate decision for
the humans who own the architecture.

## Result

| | Before | After |
| --- | --- | --- |
| Pull request touching code | ~9m 50s | ~4m 30s |
| Pull request touching only prose | ~9m 50s | ~45s |
| Merge blocked on first-load regression | no | yes |
| Merge blocked on a high-severity advisory in a shipped dependency | no | yes |
| Architecture diagram guaranteed to match the code | no | yes |
| `main` runs cancelled by the next push | yes | no |

## Verification

- `npx playwright test --shard=i/4` green for each `i`, and the union of the
  four shards equal to the 89 tests the unsharded run collects.
- `node scripts/check-first-load-budget.mjs` passing on the current build and
  failing when the budget is lowered below the measured size.
- `node scripts/build-architecture-diagram.mjs` idempotent, and the `docs`
  check red when the committed diagram is edited by hand.
- `actionlint` clean on the workflow and the composite action.
