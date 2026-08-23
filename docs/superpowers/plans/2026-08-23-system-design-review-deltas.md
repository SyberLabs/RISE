# System Design Review Deltas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Execute the deltas in
`docs/specs/SYSTEM-DESIGN-REVIEW-2026-08-22.md` in Algorithm order — question,
delete, simplify, accelerate, automate — proving each one with a measurement
rather than an adjective.

**Architecture:** The review's thesis is that RISE put immutable, reader-facing
bulk data (books, voice audio) into the plane reserved for versioned,
developer-facing logic (the JavaScript module graph). The fix is to cut that
seam: content becomes content-addressed assets fetched at read time, and the
control plane keeps only code. Everything in Tier 0 is deletion that makes the
seam visible; Tier 1 cuts it; Tiers 2–4 simplify what remains.

**Tech Stack:** Vanilla JS, Vite 7, Vitest 3, Playwright, Node 20.19/22.12.

**Spec:** `docs/specs/SYSTEM-DESIGN-REVIEW-2026-08-22.md`

## Global Constraints

Copied verbatim from the spec §11, "What must not change":

1. **No backend.** Not "not yet" — not ever, for the reading path.
2. **`session-compiler.js` stays the one canonical path.** One compiler, one
   clock, one flash dispatcher.
3. **Reverent degradation.** A work that will not resolve is absent — never a
   broken frame, never a substitute. A cache miss must produce stillness rather
   than a fallback.
4. **The certification chain.** Certification tied to bytes; re-ingest withdraws
   it; models flag and humans dispose.
5. **Words in equal words out.** The ingest's refusal stays.

And from §15, deliberately not proposed: no backend/accounts/sync, no UI
framework, no TypeScript, no rewrite of the reading pipeline, no weakening of
`release:check` or the certification gates.

---

## Task 0: The measurement instrument

Spec §16 lists twelve metrics as the definition of done. Before changing
anything, the first-load metric needs a repeatable command, because every
Tier 0 delta is justified by it and the spec's own finding is that three rounds
of chunk tuning were done without one.

**Files:**
- Create: `scripts/measure-first-load.mjs`
- Create: `scripts/first-load.test.js` equivalent guard wired into `release:check`? No — keep it a standalone report plus a budget gate.
- Modify: `package.json` (add `measure:first-load`)

**Verify:** `npm run build && node scripts/measure-first-load.mjs` prints the
brotli transfer total and request count, and exits nonzero when over budget.

- [ ] Write the script: parse `dist/index.html`, collect the entry script, every
      `modulepreload`, and every stylesheet; brotli-compress each; report totals.
- [ ] Record the baseline in this plan.
- [ ] Commit.

---

## Tier 0 — Delete. No design work required.

### Task D1: Delete `src/content/texts/`

Six modules, 72 KB, exporting one symbol each. No source file imports them; the
only reference in the repository is `vite.config.js` naming them as a
`manualChunks` seed, which is what builds and `modulepreload`s them.

**Files:**
- Delete: `src/content/texts/{tao-te-ching,heart-sutra,yoga-sutras,gospel-of-thomas,upanishads,hermetica}.js`
- Modify: `vite.config.js` (drop the `content-texts` group)

**Verify:** `rg TAO_TE_CHING_VERSES dist/` returns nothing; first-load report
loses one request.

### Task D2: Delete the rest of `manualChunks`

Measured worth 3 KB. It made the first-load problem look like nine tidy files
instead of one large graph.

**Files:** `vite.config.js`

**Verify:** Build succeeds; first-load report shows requests drop; total transfer
within 5 KB of before.

### Task D5a: Fix the two defeated dynamic imports, then make the warning fatal

Rollup prints these on every build:
`core/workshop-asset-durability.js` is dynamically imported by `app.js` but
statically imported by `Scriptorium.js` and `core/memory.js`;
`sources/text/archive.js` is dynamically imported by `app.js` but statically
imported by `sources/text/index.js`.

**Files:** `src/components/Scriptorium.js`, `src/core/memory.js`,
`src/sources/text/index.js`, `src/sources/index.js`, `vite.config.js`

**Verify:** `npm run build` emits no `(!) … dynamic import will not move module`
lines, and a deliberately reintroduced static import fails the build.

### Task D3: Load `AudioEngine` and `visualCortex` on demand

`app.js` constructs `AudioEngine` (87 KB source) in `init()` before the beta
gate, and imports the `visualCortex` singleton (179 KB source, which also pulls
`visuals.css` and ~20 engine modules) at module scope.

**Files:** `src/app.js`

**Verify:** First-load report; the audio engine chunk and visual-cortex chunk no
longer appear in the first-load set. Existing `src/app.*.test.js` still pass.

### Task D3a: Split the source registry the way `work-engines.js` is split

`initSourceSystem()` constructs seven providers at boot. `sacred.js` is 22 KB of
inline verse, `local.js` pulls `content/starters.js` (32 KB),
`archive.js` pulls `content/library.js` → `sacred_deep.js` + `literary_deep.js`,
`wikimedia.js` is 21 KB around a registry that is now `{}`.

The established pattern is `src/visuals/work-engines.js`: a frozen manifest of
ids and metadata, a map of lazy loaders, and a test that keeps them honest.

**Files:** `src/sources/registry.js`, `src/sources/index.js`, new
`src/sources/provider-manifest.js`, `src/sources/provider-manifest.test.js`

**Verify:** First-load report; `SourceRegistry.get('archive')` still resolves a
provider after an `await`; provider tests pass.

### Task D4: Move each room's CSS into the room's own module

`app.js` imports 16 stylesheets eagerly — every room's, not the Portal's.

**Files:** `src/app.js`, and each of `src/components/{Portal,Keystones,
ChamberOrbital,Chamber,Library,Workshop,Settings,Guide,Chapel,Rosarium,Via,
Curia,Journeys}.js`

**Verify:** First-load CSS transfer drops; each room still styled (E2E).
`design-system.css` and `premium-additions.css` stay eager — they are the shell.

### Task D5: Ship Opus, certify WAV

879 uncompressed WAVs, 240 MB, are the master. Every visitor's origin serves
them. The acoustic ledger binds the WAV bytes, so the masters must remain
readable by `scripts/lib/release-voice-evidence.mjs` — they move out of
`public/` (which is copied whole into `dist/`), not out of existence.

**Files:** `scripts/build-voice-pack.mjs`, `scripts/transcode-voice-pack.mjs`
(new), `scripts/lib/release-voice-evidence.mjs`,
`src/audio/voice-pack.manifest.json`, `src/audio/voice.js`,
`scripts/check-release-readiness.mjs`, `netlify.toml`

**Verify:** `du -sh dist/audio`; `npm run release:check` reports the voice
findings against the new locations; `src/audio/voice-pack.test.js` passes.

---

## Tier 1 — Cut the seam.

### Task D6: Ingest emits data, not code

`literature-ingest.mjs`, `standard-ebooks-ingest.mjs`, `legacy-ingest.mjs` and
`chapel-ingest.mjs` write `<sha256>.json` instead of `<slug>.js`. The
`words-in == words-out` refusal is unchanged.

### Task D7: Publish `content/manifest.json`

`{schema, revision, works:[{id, sha256, bytes, url, shelved, withheldReason?,
certification?}], voice:[...]}`. Generated by the ingest, which already computes
every field.

### Task D8: Add `content-store.js`

`get(id)` → Cache Storage → verify `sha256` → return, else fetch → verify →
store → return. **A hash mismatch refuses.** An unverified work is absent.

### Task D9: Repoint the archive provider at `content-store`

The session compiler, chunker, player and every room are untouched.

### Task D10: Move `src/content/archive/works/` out of the application repo

93 MB out of the source tree. Withheld, never deleted: payloads keep their
reasons and their reversibility.

### Task D11: Delete what D6–D10 orphan

`reachable-payloads.test.js`, the `load:` lines in the catalogs, the withheld
build-filter path, the vitest `maxWorkers` heuristic.

---

## Tier 2 — Simplify.

- **D12** One frame scheduler; promote `src/core/render/clock.js`'s model to the
  live runtime; 59 `requestAnimationFrame` sites become subscribers.
- **D13** Make the route table data. `registerViews()` is 591 lines of `app.js`.
- **D14** Generate `WORK_ENGINE_MANIFEST` at build time.
- **D15** Give `src/core/` branches; break the one import cycle.
- **D15a** Retire `window.rise` as a service locator, one component at a time.
- **D16** Harvested catalogs the rule, live museum APIs the exception.

## Tier 3 — Accelerate.

- **D17** Split the browser suite into a fast gate and a full matrix.
- **D18** Add a real-browser contract layer.
- **D19** Test the entrances, not the compiler.
- **D20** Retire `src/display/modes.js` and `src/components/ActiveSourcesModal.js`.

## Tier 4 — Automate.

- **D21** Publishing a work becomes a manifest append plus an upload.

---

## How to know this worked (spec §16)

Measured on this branch. "Today" is the tree at `bb44899`, which the review
measured; "now" is after the deltas below.

| Metric | Today | Now | Target | Command |
|---|---|---|---|---|
| First-load transfer (brotli) | 252.2 KB / 10 requests | **58.8 KB / 3** | ≤ 60 KB / ≤ 3 | `npm run measure:first-load` |
| Through the Portal painting | ~255 KB / 11 | **64.0 KB / 5** | — | same |
| `dist/assets` JavaScript | 18.2 MB | **3.2 MB** | — | `du -sh dist/assets` |
| Book text in `dist/assets` | 15.4 MB (83% of JS) | **0** | 0 | `npm run measure:first-load -- --bundle` |
| Rollup deferral warnings | 2 reported (9 real) | **0, and fatal** | 0 | `npm run build` |
| Required browser gate | 45 min cap | **134 s** | ≤ 5 min on PR | `npm run test:e2e:gate` |
| `requestAnimationFrame` sites | 59 in 21 files | 56 in 19 files | 1 scheduler | `rg -c requestAnimationFrame src --glob '!*.test.js'` |
| `window.rise` references | 237 | 224 | 0 | `rg -c 'window\.rise' src --glob '!*.test.js'` |
| Import cycles in `src/core/` | 1 | 1 | 0 | `npm run build` reports it |
| `src/app.js` | 1,610 lines | 1,652 | ≤ 400 | `wc -l src/app.js` |
| Largest `src/core/` directory | 148 files | 144 | ≤ 30 | `ls src/core/*.js \| wc -l` |
| Packed repository | 340 MB | 340 MB | ≤ 15 MB | `git count-objects -vH` |

## Status

**Landed:** the measurement instrument, D1, D2, D3, D3a, D4, D5a, D20 (Tier 0
complete); D6, D7, D8, D9, D11 (the Tier 1 seam, archive and Chapel); D14, D17.

**Not done, and what each needs:**

- **D5 (Opus).** The acoustic ledger binds `manifestHash` over records that
  include each WAV's byte hash, and `check-release-readiness` compares `dist`
  WAVs byte-for-byte against source. Shipping Opus means moving the masters out
  of `public/` into a certification store that `release-voice-evidence.mjs`
  still reads, recording both digests, and teaching the distribution gate to
  check the derived object. Touches the release corridor, so it wants its own
  change.
- **D10 (works out of the repository).** Needs a destination the project owns —
  a content release, a separate repository, or release assets — and a decision
  about how `withheld, never deleted` is honoured there. The runtime no longer
  depends on the modules being in `src/`, so this is now purely a hosting
  question.
- **D12 (one frame scheduler).** 56 `requestAnimationFrame` sites across 19
  files, each a persistent visual field with its own `_tick`. Promoting
  `core/render/clock.js` to the live runtime is the largest single change in
  the review and should not ride alongside anything else.
- **D13 (route table as data), D15 (`core/` subdirectories), D15a
  (`window.rise`), D16 (harvested catalogs), D19 (entrance test), D21
  (publishing automation).** Each independent; D21 is explicitly last.
