# RISE — system design overview, review, and the optimal design

**Written 2026-08-22.** Every number below was measured against the tree at
commit `bb44899`, not estimated. Commands are given so each one can be
reproduced or falsified.

---

## The verdict, first

**The hardest decision in RISE is right, and it is right for reasons most
projects get wrong. One structural decision underneath it is wrong, and it is
the cause of nearly every scaling symptom the project has.**

Right: there is no backend. No accounts, no sync, no database, no server-side
identity, no request path to be available or consistent. The reader's machine
is the only replica. This is not a shortcut taken for lack of time — it is what
makes "nothing leaves" enforceable rather than promised, and it deletes the
entire class of problems that most system design is about.

Wrong: **content is compiled as code.** Ninety-five books are JavaScript
modules. Rollup parses a 15 MB Mahabharata as a program. **Eighty-three percent
of the shipped JavaScript is book text** — 15.44 MB across 88 chunks — and only
about 10% of the bundle is code anyone wrote. Eight hundred and seventy-nine
uncompressed WAV files, 240 MB, are served to every visitor's origin. The
repository is 340 MB packed because a corpus lives in it.

Everything in Part II follows from that one sentence. Part III is what to do
about it, and Part IV is the exact list.

**One measurement that shows the shape of the problem.** RISE has tuned its
bundle chunking three different ways. I built all three:

| Build configuration | First-load transfer (brotli) | Requests |
|---|---|---|
| As shipped | 251 KB | 9 |
| `manualChunks` removed entirely | 250 KB | 2 |
| Only the `content-texts` group removed | 248 KB | 8 |

The chunking layer moves three kilobytes. The 250 KB is in `src/app.js`'s
static import graph, and no bundler configuration can reach it. The project has
been optimizing a layer that should not exist before deleting the thing that
made it necessary — which is Algorithm step 3 executed before step 2.

---

## Status of this document

**This is a dated review, not the living design.** The canonical, current
system design is `docs/specs/ARCHITECTURE.md`, which carries the diagram, the
contracts, and a decision register recording every rejected alternative. This
file is the analysis that produced several of those entries, kept because the
evidence and the measurements behind them are worth more than the conclusions.

Acted on since it was written, and no longer open:

| Delta | Landed in | Note |
|---|---|---|
| **D1** delete the orphaned `src/content/texts/` and its chunk group | #45 | found independently; the six modules had no importer |
| **D20** retire `display/modes.js` and `ActiveSourcesModal.js` | #45 | plus `orbital-integration.js`, `core/sequencer.js`, a render barrel, and a debug logger nothing imported |
| **D2** delete `manualChunks`; **D3** defer the audio engine; **D4** give each room its stylesheet; **D5a** fix the defeated dynamic imports | #47 | first load 248 kB → 207 kB brotli, 8 → 2 requests |
| **D11** (in part) the vitest worker heuristic | #45 | replaced by a named fork heap ceiling; the sharper finding was that scaling worker count against system memory could never have prevented a single fork from hitting its own V8 limit |

The load-bearing claim — that content is compiled as code, and that this is the
root of the repository size, the bundle, the test-runner memory and the
withheld-work machinery — is **unchanged and still open.** `ARCHITECTURE.md`
§8.2 records it as an open decision rather than a settled one.

Because the analysis below is evidence rather than instruction, it is left in
the present tense as measured on 2026-08-22. Three paths it names have since
been deleted and will not be found in the tree:
`src/content/texts/`, `src/display/modes.js`, and
`src/components/ActiveSourcesModal.js`.

One thing this review got wrong is worth keeping visible: it reported three
global `window` assignments as evidence of clean layering. There are three
assignments and 237 production reads through `window.rise`. The correction is
in §3.

---

# Part I — The system as built

## 1. What RISE is, structurally

A reader opens a browser. Text is broken into **atoms** — a word, a phrase, a
line — each carrying a duration. A **Player** advances atoms against an
animation-frame clock. A **Chamber** paints them over procedural or sourced
imagery with a bed of sound. The same compiled session can instead be projected
into **Page**, a spatial typographic composition. An **Experience Program** can
author what appears when.

Around that engine sit rooms: Portal (hub), Library (prepared editions), Chapel
and Rosarium (a Catholic devotional instrument with a liturgy engine), Workshop
(authoring), Vault (saved compositions), Scriptorium (a model composes, a gate
refuses), Curia (rights and provenance record).

It ships as static files to Netlify.

## 2. The diagram

```text
╔══════════════════════════════════════════════════════════════════════════════╗
║                        RISE — AS BUILT, 2026-08-22                           ║
╚══════════════════════════════════════════════════════════════════════════════╝

  OFFLINE / BUILD PLANE                          run by hand, on one machine
  ┌────────────────────────────────────────────────────────────────────────┐
  │  56 scripts in scripts/                                                │
  │                                                                        │
  │   Standard Ebooks ──┐                                                  │
  │   Gutenberg ────────┼──▶ *-ingest.mjs ──▶ words-in == words-out ──┐    │
  │   Douay-Rheims ─────┘        │                                    │    │
  │                              ▼                                    ▼    │
  │   Met / AIC / NASA ──▶ *-harvest.mjs ──▶ catalogs        95 works as   │
  │                                              │           .js MODULES  │
  │   Kokoro TTS ────────▶ build-voice-pack ─────┼──▶ 879 .wav (240 MB)   │
  │                                              │                   │    │
  │   audit-* · study-* · check-release-readiness │                  │    │
  └──────────────────────────────────────────────┼──────────────────┼─────┘
                                                 │                  │
                    ══════════════ THE BREAK ════╪══════════════════╪═════
                    content enters the SOURCE TREE, not a data store
                                                 │                  │
  BUILD                                          ▼                  ▼
  ┌────────────────────────────────────────────────────┐   ┌───────────────┐
  │  vite build  (3.6 s)                               │   │  public/      │
  │  Rollup parses novels as JavaScript                │   │  copied whole │
  │  147 chunks, 18.7 MB                               │   │  243 MB       │
  │   ├─ 10.4 MB = 15 archive books   (15 chunks)      │   │  uncompressed │
  │   ├─  5.0 MB = 73 Douay-Rheims books               │   │  single voice │
  │   ├─  1.3 MB = catalogs + manifests, also as JS    │   │               │
  │   └─  1.9 MB = code anyone wrote        (10%)      │   │               │
  │      TEXT IS 83% OF THE SHIPPED JAVASCRIPT         │   │               │
  └───────────────────────┬────────────────────────────┘   └───────┬───────┘
                          │                                        │
                          ▼                                        ▼
  DELIVERY        ┌───────────────────────────────────────────────────────┐
                  │  Netlify CDN · SPA rewrite · immutable /assets/*       │
                  │  index.html no-cache (names the hashed chunks)         │
                  │  CSP: self + 8 museum/text origins + corsproxy.io      │
                  └───────────────────────┬───────────────────────────────┘
                                          │  FIRST LOAD: 251 KB brotli
                                          │  9 requests, before any choice
                                          ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║  BROWSER — the whole runtime. No server. No account. Nothing leaves.          ║
║                                                                              ║
║   index.html ──▶ src/app.js  ·  one App class · 1,610 lines · 31 methods     ║
║                      │          registerViews() alone spans lines 346–942    ║
║                      │          eagerly imports AudioEngine, visualCortex,   ║
║                      │          and 16 room stylesheets before first paint   ║
║        ┌─────────────┼──────────────┬───────────────┬────────────────┐       ║
║        ▼             ▼              ▼               ▼                ▼       ║
║  ┌──────────┐  ┌───────────┐  ┌──────────┐   ┌───────────┐   ┌────────────┐ ║
║  │  Router  │  │  Session  │  │  Player  │   │   Audio   │   │   Visual   │ ║
║  │  296 ln  │  │ Compiler  │  │ 1,089 ln │   │  Engine   │   │   Cortex   │ ║
║  │ backstack│  │  637 ln   │  │ 5 states │   │ Web Audio │   │ ~20 engines│ ║
║  │ crossfade│  │           │  │          │   │ recitation│   │ flash gate │ ║
║  └────┬─────┘  └─────┬─────┘  └────┬─────┘   └─────┬─────┘   └─────┬──────┘ ║
║       │              │             │               │               │        ║
║       │              │        THE ONLY CONTRACT ANY OF THESE SHARE           ║
║       │              │        is that Player owns the authoritative clock.   ║
║       │              │        There are 59 requestAnimationFrame call sites  ║
║       │              │        in 21 files. There is no shared timeline.      ║
║       │              │                                                       ║
║       ▼              ▼                                                       ║
║  ┌─────────────────────────────────────────────────────────────────────┐    ║
║  │  ROOMS  56 component modules, each bespoke, no shared base          │    ║
║  │  Portal 390 · Chamber 3,178 · Workshop 5,554 · VIP 2,168 · +18 more │    ║
║  │  render by direct DOM + template strings (89 innerHTML= sites)      │    ║
║  └─────────────────────────────────────────────────────────────────────┘    ║
║                                                                              ║
║  ┌─────────────────────────────────────────────────────────────────────┐    ║
║  │  STATE  localStorage (51 sites) · sessionStorage (10) · IndexedDB(8)│    ║
║  │  USER_DATA_KEYS is the export/erase inventory. No central store.    │    ║
║  └─────────────────────────────────────────────────────────────────────┘    ║
╚══════════════════════════════════════════════════════════════════════════════╝
       │                                          ▲
       │  anonymous, no-referrer, abort+timeout    │  degrade to stillness
       ▼                                          │  on any failure
  ┌──────────────────────────────────────────────────────────────────────┐
  │  THIRD PARTIES  Met · Art Institute · Cleveland · Rijksmuseum ·       │
  │  Wikimedia · Gutenberg · arXiv   —  reached through corsproxy.io      │
  │  (a proxy RISE does not own, on the critical path, named in the CSP)  │
  └──────────────────────────────────────────────────────────────────────┘
```

## 3. The three planes, measured

The system already has three planes. Two of them are healthy. One of them was
never given a boundary, and everything else pays for it.

### Control plane — the code. Healthy.

| Measure | Value | Command |
|---|---|---|
| Source, excluding tests and content | 227 files, 93,396 lines | `find src -name '*.js' ! -name '*.test.js' ! -path 'src/content/*'` |
| Tests, excluding content | 194 files, 47,155 lines | same, `-name '*.test.js'` |
| Test-to-source line ratio | **0.50** | — |
| Production dependencies | **1** (`sql.js`) | `package.json` |
| Dev dependencies | 8 | `package.json` |
| Build time | **3.6 s** | `time npm run build` |
| `core` importing `components` | **0** | `rg "from '\.\./components/" src/core` |
| `visuals` importing `components` | **0** | same, `src/visuals` |
| Global `window.*` assignments | **3** | `rg "^\s*window\.\w+ *="` |

One production dependency for a system with twenty visual engines, a Web Audio
graph, a liturgy engine, a page compositor and an MP4 render path is a genuinely
rare result. The layering discipline in the *import graph* is real and enforced.

**But the import graph is not the whole coupling story, and three things hide
behind it:**

- **`window.rise` is a service locator with 237 production references.** Only
  three globals are ever assigned, which looks clean — but components reach the
  application through the global rather than through their constructor:
  `VisualInterlocutionPanel` 60 references, `Chamber` 52, `Workshop` 35,
  `ChamberOrbital` 26. Zero `components → app.js` imports is true and is not the
  same as decoupled. A dependency that does not appear in the module graph is
  harder to see, not absent.
- **One import cycle**, confirmed by inspection:
  `models.js → visual-score-lane.js → source-span.js → chunker.js → models.js`.
  `models.js` imports `createSequenceVisualAsset`; `chunker.js` imports `Atom`.
- **`src/display/modes.js` — 618 lines, zero production importers.** It exports
  `FocalRenderer`, `ChamberRenderer`, `OrbitalRenderer` and `DisplayManager`;
  `Chamber.js` reimplements rendering inline. It also contributes 2 of the 59
  `requestAnimationFrame` call sites counted below, in code no reader reaches.

The largest single source file in the repository is
`src/visuals/visual-cortex.js` at **4,112 lines**, followed by
`components/Workshop.js` at 5,554 and `components/Chamber.js` at 3,178.

### Data plane — the corpus. This is the problem.

| Measure | Value |
|---|---|
| `src/content/archive/works/` | **95 modules, 93 MB** |
| Largest single module | `the-mahabharata-...js` — **15 MB of JavaScript** |
| Works a reader can actually open | **15** (`ingestedArchiveTexts().length`) |
| Works withheld but still on disk and in git | **80** |
| `public/audio/recitation/` | **879 `.wav`, 240 MB, one voice, uncompressed** |
| Shipped `dist/` | **264 MB** — 243 MB audio, 18.7 MB JavaScript |
| Archive books in the JS bundle | 10.42 MB, 15 chunks |
| Douay-Rheims books in the JS bundle | 5.02 MB, 73 chunks |
| **Text as a share of shipped JavaScript** | **15.44 MB — 83%, across 88 chunks** |
| Of the remaining 3.25 MB, catalogs and manifests as JS | ~1.3 MB (`audubon` 435 KB, `content-texts` 323 KB, `arxiv_cache` 296 KB, `science-catalog` 260 KB, `voice-pack` manifest 205 KB) |
| **Actual application code in the bundle** | **≈ 1.9 MB of 18.7 MB — about 10%** |
| Packed git repository | **340 MB** across 522 commits |

Nine tenths of the JavaScript RISE ships is not JavaScript anyone wrote. It is
books, catalogs and manifests wearing a `.js` extension because that is the only
door the build system offers.

Every one of those numbers is a consequence of a single choice: the ingest
script writes `.js`, so a book becomes a program, so the bundler owns it, so
git owns it, so the test runner's memory owns it.

### Build plane — the machine that builds the machine. Strong, and undersold.

56 scripts do ingest, audit, catalog construction, voice-pack generation,
render proofs and release admission. The invariants are enforced by machine,
not by intention:

- **Words in must equal words out.** The ingest refuses a payload whose token
  count differs from its source.
- Every work carries `source.sha256`, `payloadChecksum`, a rights basis with
  evidence, and a retrieval date.
- **Withheld, never deleted**, and every withholding states a reason — enforced
  by test.
- `npm run release:check` is a single admission report that is *expected to
  exit nonzero* while any gate is open, and the roadmap explicitly forbids
  weakening it to obtain green.

This is better release engineering than most funded teams have. It is also the
asset that makes Part III cheap, because the content is already
content-addressed — the hashes exist, they are simply not used as the delivery
key.

### One more thing the planes hide: RISE has almost no URLs

`src/core/router.js` (296 lines) is an **in-memory** view registry — a `Map` of
containers, a back stack, and a 400 ms crossfade. Fourteen rooms are registered.
**Two paths have real URLs:** the Keystone corridor (`/try-rise`,
`/keystone/:slug`, which `handleNavigate` pushes to history) and `#rosary`.
Everything else — Chamber, Chapel, Library, Workshop, Vault, Scriptorium, Curia,
Journeys, Via, Rosarium, Settings — has no address. Browser Back does not
meaningfully work in them, and nothing in RISE can be linked to.

This is worth naming because `NORTH-STAR.md` defers JSON → MP4 as
"distribution, not experience," and it is right to. But a URL *is* distribution,
it is the cheapest form of it, and the router is already 90% of the way there —
`handleNavigate` already knows how to push state; it just does it for one
corridor. This is not on the critical path and is not proposed as a delta. It is
recorded here because a review that measured the front door should say that most
of the house has no address.

## 4. One reading, end to end

```text
  reader picks "Meditations, Book II"
        │
        ▼
  Library ──▶ work.load()  ─── a dynamic import() of a 244 KB JavaScript chunk
        │                      the browser parses a novel as a program
        ▼
  session-compiler.js   ── the one canonical path; every launch surface calls it
        │  validate and bound input          (50–1000 wpm, 2,000,000 chars/source)
        │  chunk each source independently   chunker.js, 839 lines
        │     ceiling MAX_CHUNK_WORDS = 16 · floor PHRASE_FLOOR_WORDS = 5
        │     verse is READ from the edition, never inferred
        │  attach source name + id to every atom
        │  insert timing-locked source boundaries
        │  apply the pacing curve            (timingLocked atoms are exempt)
        │  normalize visual settings
        ▼
  Session { atoms[], totalDuration }   ── totalDuration is the single source of
        │                                  truth for duration UI and memory
        ▼
  player.js  ── idle │ playing │ paused │ interlocuting │ complete
        │  owns the authoritative clock, drives requestAnimationFrame
        │  a visual presence PAUSES the reading clock and is awaited
        │  VisualFlashGate: ≤45% visible duty over 12 s,
        │     rest ≥ max(250 ms, 1.25 × presence)
        │  gate budget is committed only after a source renders — a failure
        │     consumes no cadence
        ▼
  ┌──────────────┬───────────────┬──────────────┐
  │  Chamber     │  visual-cortex│  audio/engine│
  │  paints text │  the ONLY     │  Web Audio + │
  │  no clock    │  flash        │  recitation  │
  │              │  dispatcher   │              │
  └──────────────┴───────────────┴──────────────┘
        │
        ▼
  Page projection — same Session, spatial renderer instead of temporal
```

This pipeline is the best-designed thing in the system. One canonical
compiler, one authoritative clock, one flash dispatcher, and a safety gate that
is an execution-time veto rather than a configuration flag. Part III does not
touch it.

---

# Part II — The review

## 5. First principles: the Idiot Index

Divide the complexity of the finished system by the complexity of the essential
work. Do it per layer, because a single number hides where the waste is.

| Layer | Essential work | As built | Index |
|---|---|---|---|
| Reading engine | chunk, pace, advance, paint | 93 K lines of code for ~20 visual engines, a liturgy engine, Page, Workshop | **≈ 1** — earned |
| Dependencies | a bundler | 1 production dependency | **≈ 1** — exemplary |
| Build cycle | compile a SPA | 3.6 s | **≈ 1** — exemplary |
| **Corpus delivery** | **fetch a string** | ingest writes `.js` → Rollup parses a novel as a program → emits a hashed chunk → browser parses it as a program → extracts a string | **very high** |
| **Voice delivery** | **play a phrase** | 879 uncompressed WAVs shipped whole; Opus at 32 kbps is ~12 MB against 240 MB | **≈ 20× on bytes** |
| **Startup** | **paint the Portal** | 251 KB brotli including six dead modules, the audio engine, four visual engines, and 16 room stylesheets | **≈ 5×** |
| **Repository** | version 93 K lines of code | 340 MB packed, because a corpus is in it | **very high** |

The engine is lean. The pipe the engine's food travels through is not.

## 6. The Algorithm, in order

### Step 1 — Question every requirement, and name its owner

| Requirement | Owner | Verdict |
|---|---|---|
| "Books are JavaScript modules" | **Nobody.** No spec requires it. It happened because `literature-ingest.mjs` writes `.js` and everything downstream followed. | **Not a requirement.** Delete. |
| "Recitation ships as WAV" | The release gate. `release-evidence.json` binds a human acoustic verdict to exact WAV bytes, and regeneration invalidates it. | **Real requirement, wrong scope.** It binds the *reviewed* bytes, not the *delivered* bytes. Certify WAV, ship Opus derived from it, checksum both. |
| "Withheld works stay in the repository" | `ARCHIVE-CANON-SPEC §8` — withheld, never deleted. | **Real requirement, satisfied differently.** It requires the payload remain *reachable and reversible*, not that it live in the application's source tree. |
| "`manualChunks` groups large subsystems" | Nobody. The config's own comment concedes "these are not route-lazy by themselves." | **Not a requirement.** Measured worth: 3 KB. Delete. |
| "`src/content/texts/` ships six sacred texts" | **Nobody, and nothing imports them.** | **Dead.** See below. |
| "Museum imagery reaches through `corsproxy.io`" | Nobody. A third-party proxy on the critical path, named in the CSP. | **Question hard.** RISE already harvests catalogs offline. Make harvest the rule. |
| "No backend" | The privacy promise, stated in the README, `ARCHITECTURE.md`, and `DREAMS.md` ("Nothing leaves"). | **Real, load-bearing, and correct.** Keep. Defend. |

**The dead-module finding, because it is exact.** `src/content/texts/` holds six
modules — `tao-te-ching.js`, `heart-sutra.js`, `yoga-sutras.js`,
`gospel-of-thomas.js`, `upanishads.js`, `hermetica.js`, 72 KB. Each exports one
symbol. Each symbol is referenced in exactly one file: the file that defines it.
**No source file imports them.** They are built and `modulepreload`ed on first
paint for one reason: `vite.config.js` names them as `manualChunks` seeds. I
removed only that group and rebuilt — `TAO_TE_CHING_VERSES` vanishes from
`dist/` entirely.

This is the defect class `PROJECT-KNOWLEDGE.md §2.2` already names — "a runtime
filter cannot remove a build-time dependency" — in its purest form. Here the
build configuration *is* the only dependency.

**And the build is already reporting the same class of defect out loud, on
every run.** `npm run build` prints:

```text
(!) src/core/workshop-asset-durability.js is dynamically imported by src/app.js
    but also statically imported by src/components/Scriptorium.js,
    src/core/memory.js, dynamic import will not move module into another chunk.

(!) src/sources/text/archive.js is dynamically imported by src/app.js
    but also statically imported by src/sources/text/index.js,
    dynamic import will not move module into another chunk.
```

Two deliberate `import()` calls in the composition root are defeated by a static
import elsewhere, and Rollup says so in plain language every time anyone builds.
That is the same shape as the 82 MB defect, the same shape as the dead sacred
texts, and the same shape as the first-load measurement above: **a deferral
written at one site, undone at another, with the bundler as the only witness.**
The warning has been on screen for every build and has not been acted on, which
is the strongest available argument that the fix is structural rather than a
matter of attention.

**What the 250 KB actually is.** Two eager decisions in the composition root
account for most of it:

1. **`initSourceSystem()` constructs all seven providers at boot** —
   `ArchiveText`, `LocalText`, `Gutenberg`, `SacredText`, `Arxiv`,
   `GeneratedVisual`, `Wikimedia` — and several carry their data inline rather
   than behind a loader: `sacred.js` is 22,170 bytes of verse, `wikimedia.js` is
   21,197 bytes around a category registry that is now **empty** (retired after
   an audit), `LocalTextProvider` wraps `content/starters.js` (32,221 bytes),
   and `ArchiveTextProvider` reaches `content/library.js`, which pulls
   `sacred_deep.js` (28,864 bytes) and `literary_deep.js` (26,195 bytes). A
   registry needs ids and metadata; it is loading payloads.

   (Sizes here are exact bytes rather than rounded kilobytes on purpose. This
   document names `division-index.json`, which puts it inside the sweep in
   `shelf-measurements.test.js` — and that guard reads *any* kilobyte figure in
   a file that names an index as a claim about the index. A rounded kilobyte
   figure for `starters.js` collided with the embedded size of the index itself
   and failed the build: correct by the guard's design, wrong about this file.
   See the note at the end of Part IV.)
2. **`src/app.js` imports `AudioEngine`, `visualCortex`, and 16 room
   stylesheets** before the Portal paints. The CSS alone is 220 KB raw / 31 KB
   brotli, and it is every room's, not the Portal's.

**RISE has already solved this exact problem, once, correctly.**
`src/visuals/work-engines.js` separates `WORK_ENGINE_MANIFEST` — ids, names and
categories, no classes — from `FAMILIES`, a map of lazy loaders, precisely
because "importing them synchronously would pull every generator into the main
bundle." The source registry needs the same treatment and has not had it. The
recommendation is not a new pattern; it is the pattern this codebase invented,
applied to the other place that needs it.

### Step 2 — Delete

Ordered by bytes deleted per line of code touched.

1. **Delete the bundler from the content path.** Books stop being modules and
   become content-addressed assets fetched at read time. Applied to the archive
   and the Douay-Rheims alike, this removes 15.4 MB from `dist/assets` — 83% of
   the shipped JavaScript — 98 MB from the source tree, and ~330 MB from the
   packed repository.
2. **Delete 228 MB of uncompressed audio.** Ship Opus. The WAV masters stay in
   the certification store, which is where the acoustic ledger already points.
3. **Delete `manualChunks`.** Measured at 3 KB, but it is worse than useless —
   it made the first-load problem *look* like nine tidy files instead of one
   large graph, which is why the real 250 KB went unexamined.
4. **Delete the six orphan modules** in `src/content/texts/`.
5. **Delete the eager imports in `src/app.js`** — `AudioEngine`, `visualCortex`,
   and 15 of 16 room stylesheets.
6. **Delete the flat namespace.** `src/core/` is 148 files in one directory with
   a single subdirectory. It has leaves and no branches.

**The 10% add-back test.** Deleting the bundler from the content path adds back
a manifest (`id → sha256 → bytes → url`) and a fetch-verify-cache module. Call
it 250 lines against ~430 MB deleted. That is far below 10%, which by the rule
means *not enough has been deleted*. So the list continues:

7. **Delete the withheld-work build machinery.** When content is not built,
   withholding is a field in a manifest, not a code path. `reachable-payloads.test.js`
   exists to assert a correspondence between a catalogue and a bundler's
   behaviour. Remove the bundler from the path and the test's subject ceases to
   exist — which is the strongest form of a fix.
8. **Delete `WORK_ENGINE_MANIFEST`'s hand-maintained twin.** It is a second copy
   of what `FAMILIES` loads, kept in sync by a test, and it exists *only*
   because importing the engine array synchronously would drag every generator
   into the main bundle. Generate the manifest at build time from the engine
   modules and the duplication becomes structurally impossible rather than
   test-guarded. `PROJECT-KNOWLEDGE.md §2.1` calls this the single most frequent
   defect in the codebase — "a vocabulary living in two places where only one
   learns a new word." The right fix for a vocabulary in two places is to make
   the second copy derived.
9. **Delete the vitest worker heuristic.** `vite.config.js` carries 35 lines of
   comment justifying `maxWorkers: Math.max(2, Math.min(6, coreCeiling, memoryCeiling))`.
   It is excellent forensics — and the entire investigation was caused by test
   forks loading book payloads. Remove content from the module graph and the
   heuristic has nothing left to defend against.

### Step 3 — Simplify, and only now

- **One clock — and RISE has already built it, in the wrong half of the system.**
  There are 59 `requestAnimationFrame` call sites across 21 files. `Player` owns
  the authoritative clock for *text*; every persistent visual field
  (`WorkEngineField`, `PlateField`, `HarmonographField`, `KleeField`,
  `AttractorField`, `RosaMystica`, `ContinuousField`) runs its own `_tick`, and
  two more sites live in `display/modes.js`, which nothing imports. Nothing can
  answer "what time is it" for a session as a whole.

  Meanwhile `src/core/render/clock.js` is exactly that abstraction — a
  deterministic rational frame clock whose own header states it is *not* `rAF`
  and *not* `AudioContext.currentTime` — and it exists only in the offline MP4
  path. The consequence is that a rendered MP4 and a live reading of the same
  session are driven by two different notions of time. **The target design is
  already written and tested; it simply has not been given to the live path.**
  That is what makes D12 cheap: promote `clock.js`'s model to the runtime and
  make the fields subscribers, rather than inventing a scheduler.
- **`app.js` is a route table pretending to be a method.** `registerViews()`
  spans lines 346–942 — 596 lines, 37% of the file. A route table is data.
- **The 16 eager stylesheet imports** are a symptom of the same thing: the
  composition root knows every room. It should know a manifest.

### Step 4 — Accelerate cycle time, on the cleaned system

The build is 3.6 s. That is not the bottleneck. The bottlenecks are:

- **The browser suite.** CI run #99 died at **29 m 25 s** against a 30-minute
  cap with no assertion; the timeout is now 45 minutes. A 45-minute gate is a
  gate people learn to route around.
- **The unit suite**, memory-bound for the reason given above.
- **Human gates.** `CERTIFIED_IDS` is empty. The public build serves uncertified
  candidates under an explicit `RELEASE_SERVES_UNCERTIFIED` decision. The
  release long pole is 10–15 human certifications and a 665-phrase acoustic
  review. **No amount of engineering shortens this, and the roadmap is right to
  refuse to weaken the checker to get green.** But it is the actual critical
  path, and it should be stated as such: the machine corridor is green and
  waiting on people.

### Step 5 — Automate, last

Do not automate any of the above until it is deleted and simplified. The one
thing worth automating early is the content manifest, because it is generated
by a script that already exists and already computes the hashes.

## 7. Superpowers review

RISE's engineering discipline is, in the places that matter, better than the
skills ask for.

**Where it exceeds the standard:**

- *verification-before-completion*: `PROJECT-KNOWLEDGE.md §2.4` — "ask of every
  guard: what input makes this fail? If you cannot construct one, it is
  decoration" — is a stronger statement of the skill than the skill makes.
  `expect(Math.max(...beads)).toBe(ROSARY_BEAD_COUNT - 1)` passed for six weeks
  against a rosary with the wrong number of beads, and the lesson was written
  down rather than patched.
- *systematic-debugging*: the vitest `maxWorkers` comment is a model root-cause
  investigation. It names the symptom (`ERR_IPC_CHANNEL_CLOSED`), the files it
  appeared on, the measurement (15.9 GB total, 4.7 GB free, forks peaking at
  100–200 MB with a 594 MB worst case), and why the fix is a floor of two rather
  than a guess.
- *test-driven-development*: 0.50 test lines per source line, colocated, with
  focused contracts on the high-risk paths — player recovery, router failure
  containment, visual safety, provider aborts, cache degradation.

**Where it falls short, and both are structural rather than cultural:**

1. **Tests are written against the door the developer just built.**
   `PROJECT-KNOWLEDGE.md §2.3` documents this precisely: verse handling was
   wired to `scriptorium-resolve`, tested against `scriptorium-resolve`, and
   reported as shipped — while the reader's actual entrance dropped the flag at
   the first of four hops. The lesson is recorded but the *architecture* still
   permits it, because there are many entrances to a reading and no single
   admission point that all of them provably pass through. `session-compiler.js`
   is declared canonical in `ARCHITECTURE.md`; nothing enforces that a launch
   surface cannot bypass it.
2. **jsdom is the substrate for a system whose whole subject is time, sound and
   paint.** `ARCHITECTURE.md` lists this under known debt. The two tests that
   touch reality — `encode-mp4.test.js` (real ffmpeg bytes) and
   `chamber-paint.test.js` (real Chromium, real RGBA) — are the two that needed
   system tools installed in CI, and the comments say plainly that without them
   "nothing on CI ever painted a frame." Those two are the model; there should
   be more of them and fewer jsdom approximations of a canvas.

## 8. Alex Xu, Volume 1

The instinct to apply Volume 1 to RISE is to ask which chapters it is missing —
load balancers, sharding, caching tiers, message queues. That reading is wrong,
and applying it would make RISE worse. The right reading is that Volume 1's
*first* chapter is the one that matters, and RISE has half-executed it.

| Volume 1 chapter | What it actually teaches | RISE |
|---|---|---|
| **Ch. 1 — Scale from zero to millions** | **Separate the web tier from the data tier. Put static content on a CDN. Keep the serving tier stateless.** | **Half done.** The serving tier is stateless and CDN-backed — correct. But the data tier is *inside the JavaScript bundle*. This is the single deepest violation. |
| Ch. 2 — Back-of-envelope | Estimate before building | Done better than most: `study:chunking`, `sheet:chunks`, measured `maxWorkers`, byte-exact release inventory |
| Ch. 4 — Rate limiter | Be polite to services you depend on | **Absent, and unfixable client-side.** Every reader's browser calls the Met and Art Institute directly. There is no way to rate-limit across readers. The answer is not a rate limiter; it is to depend on harvested catalogs, which RISE already builds. |
| Ch. 6 — Key-value store | Consistency is a cost you pay for replicas | **Not applicable, and that is the win.** One replica: the reader's browser. No consistency problem exists. Do not create one. |
| Ch. 9 — Web crawler | Politeness, freshness, dedup | `met-harvest.mjs`, `harvest-science.mjs` — offline, catalogued, rights-checked. Correct. |
| Ch. 13 — Search autocomplete | Precompute offline, serve a static structure | `division-index.json`, `science-catalog.generated` — correct, and the pattern to generalize. |
| **Ch. 14 — YouTube** | **Pre-transcode into renditions. Never ship the master to a viewer.** | **Violated.** 879 uncompressed WAVs, 240 MB, are the master. Every visitor's origin serves them. |
| **Ch. 15 — Google Drive** | **Metadata database separate from block storage. Content-addressed blocks. Sync only what changed.** | **Violated, and the fix is already 90% built.** Every work carries `source.sha256` and `payloadChecksum`. The content address exists. It is simply not the delivery key. |

**The chapter RISE most needs is 15, and it needs one step.** The hashes are
computed, verified, and enforced by the ingest. Making them the URL is the whole
change: `/content/works/<sha256>.json`, immutable, cached forever, verified on
arrival by the hash it was fetched by.

## 9. Alex Xu, Volume 2

| Volume 2 chapter | What it teaches | RISE |
|---|---|---|
| **Ch. 9 — S3-like object storage** | **Separate the data plane from the metadata plane. Objects are immutable and content-addressed. The metadata service is small; the data plane is large and dumb.** | **The exact prescription.** RISE's metadata plane (catalogs, division index, certifications, rights) is small, structured and already generated. Its data plane (93 MB of works, 240 MB of audio) is large and immutable. They are currently welded together and pushed through a JavaScript compiler. |
| Ch. 4 — Distributed message queue | Decouple producer from consumer | The offline pipeline is already this: scripts produce, the app consumes, the manifest is the queue's contract. Formalize the contract. |
| Ch. 6 — Ad click aggregation | Batch offline, serve precomputed artifacts | Already the shape of `build-pericopes`, `build-division-index`, `build-science-catalog`. |
| Ch. 11 — Payment system | **Reconciliation. Idempotency. An audit trail that survives the process that wrote it.** | **RISE's strongest suit, and it is unusual.** Certification is tied to bytes; a re-ingest withdraws it automatically. The acoustic ledger is bound to exact WAV bytes and invalidated by regeneration. "Models flag; humans dispose." This is payment-grade discipline applied to a text corpus. |
| Ch. 2 — Nearby friends / Ch. 1 — Proximity | Real-time fanout | Not applicable. Correctly not built. |

**Volume 2's meta-lesson, which is the one that decides RISE:** at scale, the
thing you must get right is *which plane a piece of state lives in*. RISE has
put immutable, content-addressed, reader-facing bulk data into the plane
reserved for versioned, mutable, developer-facing logic. Everything else is a
symptom.

## 10. Master Reference Checklist

| Item | Verdict |
|---|---|
| **First principles: questioned why? pushed for what is right?** | **Yes, and unusually well** — the archive went from 88 works to 15 by changing the loop rather than the effort, and the reason was written down. |
| **Algorithm applied in order?** | **No.** Step 3 ran before step 2. Three rounds of chunk-config optimization moved 3 KB; the deletion that would move 250 KB was never made. |
| **Machine optimized? Staying lean?** | **Split.** One production dependency, 3.6 s build, machine-enforced ingest invariants — exemplary. A 340 MB repository, a 264 MB deploy, and a 45-minute browser gate — not lean. |
| **Communication: shortest path? Bad news fast?** | **Yes, and it is the project's best habit.** "Eighty-two megabytes of unreachable books were built and deployed" is written in the codebase, in bold, at the top of the test that now prevents it. |
| **Ownership: one name per part?** | **Partial.** Content, ingest, release and specs have clear ownership. Time has no owner — 59 frame loops in 21 files, and the one deterministic clock that exists is reachable only from the offline render path. |
| **Excellence the average?** | **Yes in the engine and the pipeline. No in delivery** — which is the layer the reader actually touches first. |
| **Semantic tree: trunk before leaves?** | **Inverted in two places.** `src/core/` is 148 files in one flat directory: leaves with no branches. And a first-time reader downloads six dead sacred texts before the Portal paints. |
| **Maniacal urgency? Decide at 70%?** | **Yes.** 522 commits in six weeks by one person and their agents. |
| **Net useful? Experience flawless?** | **Net useful, clearly.** Not yet flawless: 251 KB and nine requests before a first-time visitor sees anything, of which roughly 55% is engine and content they have not asked for — and twelve of the fourteen rooms they then walk into have no URL to return to or share. |

---

# Part III — The optimal design

## 11. What must not change

Stated first, because the temptation with a review like this is to propose a
distributed system, and that would be the wrong answer.

1. **No backend.** Not "not yet" — not ever, for the reading path. It is what
   makes "nothing leaves" a property rather than a policy. It deletes identity,
   authorization, availability, consistency, replication, and the entire cost
   structure that goes with them. Any proposal that adds a server to the reading
   path is a worse design regardless of what it enables.
2. **`session-compiler.js` stays the one canonical path.** One compiler, one
   clock, one flash dispatcher.
3. **Reverent degradation.** A work that will not resolve is absent — never a
   broken frame, never a substitute. This constrains the caching design below
   and is the reason a cache miss must produce stillness rather than a fallback.
4. **The certification chain.** Certification tied to bytes; re-ingest withdraws
   it; models flag and humans dispose. The design below strengthens this rather
   than routing around it.
5. **Words in equal words out.** The ingest's refusal is the reason several
   disasters are stories about bugs rather than about books.

## 12. The target

```text
╔══════════════════════════════════════════════════════════════════════════════╗
║                     RISE — TARGET DESIGN                                     ║
║        same topology · the data plane cut out and given its own life         ║
╚══════════════════════════════════════════════════════════════════════════════╝

  BUILD PLANE                                       unchanged in kind, formalized
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  ingest ──▶ words-in == words-out ──▶ sha256 ──▶ EMIT DATA, NOT CODE     │
  │  harvest ──▶ catalogs                                                    │
  │  voice ──▶ WAV master (certified) ──▶ transcode ──▶ Opus (delivered)     │
  │                                    both hashed, both recorded            │
  │                                                                          │
  │  OUTPUT: content/manifest.json                                           │
  │          { schema, revision, works: [ {id,sha256,bytes,url,shelved,      │
  │            withheldReason?,certification?} ], voice: [...] }             │
  └───────────────────────────────┬──────────────────────────────────────────┘
                                  │   the manifest IS the contract
                                  │   nothing crosses except through it
  ┌───────────────────────────────┴──────────────────────────────────────────┐
  │                                                                          │
  ▼                                                                          ▼
┌──────────────────────────────┐                    ┌────────────────────────────┐
│  CONTROL PLANE  (code)       │                    │  DATA PLANE  (content)     │
│  vite build                  │                    │  no bundler. ever.         │
│                              │                    │                            │
│  target first load ≤ 60 KB   │                    │  /content/manifest.json    │
│    shell + router + Portal   │                    │     small · revalidated    │
│    + Portal.css only         │                    │  /content/works/<sha>.json │
│                              │                    │  /content/voice/<sha>.opus │
│  everything else on demand:  │                    │  /content/catalog/*.json   │
│    room  → import() + its CSS│                    │     immutable · 1 y cache  │
│    engine→ import()          │                    │                            │
│    audio → import() on play  │                    │  ~12 MB voice (was 240 MB) │
│                              │                    │  works fetched per reading │
│  ONE frame scheduler.        │                    │                            │
│  ONE sessionTime.            │                    │  MAY live in a separate    │
│  Route table = data.         │                    │  repo or a release asset.  │
└──────────────┬───────────────┘                    └─────────────┬──────────────┘
               │                                                  │
               └────────────────────┬─────────────────────────────┘
                                    ▼
              ┌──────────────────────────────────────────────┐
              │   CDN  —  the data tier. Not a database.     │
              │   immutable content-addressed objects        │
              │   one mutable pointer: manifest.json         │
              └──────────────────────┬───────────────────────┘
                                     ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║  BROWSER                                                                     ║
║                                                                              ║
║   ┌────────────────────────────────────────────────────────────────────┐    ║
║   │  content-store.js   ~250 lines, the only new module                │    ║
║   │    get(id) →  Cache Storage hit?  ──yes──▶ verify sha256 ──▶ text  │    ║
║   │               │no                                                   │    ║
║   │               ▼                                                     │    ║
║   │            fetch(manifest.url) ──▶ verify sha256 ──▶ put ──▶ text  │    ║
║   │            hash mismatch → REFUSE. Reverent degradation:            ║    ║
║   │            an unverified work is ABSENT, never substituted.         │    ║
║   └────────────────────────────────────────────────────────────────────┘    ║
║                              │                                               ║
║                              ▼   the pipeline below is UNCHANGED             ║
║   session-compiler ──▶ Session ──▶ Player(clock) ──▶ Chamber │ Page          ║
║                                          │                                   ║
║                                    ┌─────┴──────┐                            ║
║                                    ▼            ▼                            ║
║                              visual-cortex   audio-engine                    ║
║                              (subscribes)    (subscribes)                    ║
║                                                                              ║
║   Cache Storage = the reader's library. Offline reading becomes free.        ║
║   localStorage / IndexedDB = the reader's own data. Unchanged.               ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## 13. Why this is the optimal design, and what it buys

**It is the same system.** The Chamber, the compiler, the player, the gate, the
rooms, the privacy promise and the certification chain are untouched. This is
not a rewrite; it is cutting one seam that was never cut.

| Property | Now | Target | Why |
|---|---|---|---|
| First load | 251 KB brotli, 9 requests | ~60 KB, 2 requests | Portal needs a shell, a router and one component |
| Shipped bytes | 264 MB | ~30 MB | Opus for voice; works fetched on demand |
| Text in the JS bundle | 15.4 MB (83%, 88 chunks) | **0** | A book is not a program |
| Packed repository | 340 MB | ~15 MB | The corpus leaves the code repo |
| Adding the 16th work | edit a catalog, add a loader, rebuild, redeploy the app | append to the manifest | Content ships without shipping code |
| Adding the 500th work | ~500 MB repo, hours of build, an unusable clone | identical to the 16th | **This is the scalability answer** |
| Offline reading | not possible | free | Cache Storage already holds it |
| Test-fork memory | heuristic tuned to book payloads | irrelevant | Content is not in the module graph |
| Corpus corruption | caught at ingest | caught at ingest **and on arrival** | The fetch verifies the hash it fetched by |

**The last row matters more than it looks.** Today a work's `payloadChecksum` is
verified when it is created. In the target it is verified again in the reader's
browser, every time, for free — because the hash is the URL. A silently
corrupted CDN object cannot be read. That is not a feature the current design
can have at any price.

**On "most scalable."** For RISE the axis is not requests per second, because
there is no server to serve them. Static files on a CDN scale to any readership
without a design change; that problem is already solved and should not be
re-opened. The axes that actually bind are:

1. **Corpus size.** Today the 96th work makes the repository, the build, the
   test suite and every clone worse. In the target it costs one manifest line.
   This is the binding constraint and the target removes it.
2. **First-paint cost.** 251 KB and nine requests today, and it grows with every
   room whose stylesheet `app.js` eagerly imports. In the target it is flat: the
   Portal's cost does not depend on how many rooms exist.
3. **Cognitive load.** One human and their agents hold this system. A 148-file
   flat directory and a 596-line route method are the real limit on velocity,
   and no amount of infrastructure helps.
4. **Human certification throughput.** `CERTIFIED_IDS` is empty and the release
   is blocked on 10–15 human verdicts and 665 acoustic decisions. This is the
   actual critical path today, it is correctly refusing to be automated, and it
   should be named as the release's long pole rather than buried under
   engineering work.

A design that adds servers improves none of those four. The target improves the
first three and leaves the fourth honest.

---

# Part IV — The deltas

## 14. The delta list

Twenty-four deltas, ordered by the Algorithm: question, delete, simplify,
accelerate, automate. Each is independently shippable; none requires the next.
Every one names what it removes and how to prove it worked.

### Tier 0 — Delete. No design work required.

| # | Delta | Removes | Verify |
|---|---|---|---|
| **D1** | Delete `src/content/texts/` (six modules, 72 KB) and the `content-texts` group from `manualChunks`. Nothing imports them. | 6 dead modules; 1 preload request | `rg TAO_TE_CHING_VERSES dist/` returns nothing |
| **D2** | Delete the rest of `manualChunks`. Measured worth: 3 KB. It hides the real problem. | 41 lines of config | First load unchanged; then D3 becomes visible |
| **D3** | Make `src/app.js` import `AudioEngine` and `visualCortex` dynamically — at first play and first visual, not at boot. | ~30 KB brotli from first load | First-load byte count, measured before and after |
| **D3a** | **Split the source registry the way `work-engines.js` is already split**: a manifest of provider ids and metadata, with the provider modules behind lazy loaders, so `initSourceSystem()` stops constructing seven providers and their inline data at boot. While there, delete `wikimedia.js`'s empty retired category registry or record why it stays. | The inline verse, starter and `*_deep` payloads leave first load | First-load byte count; providers still resolve on demand |
| **D4** | Move each room's CSS into the room's own module so it loads with the room. `app.js` currently imports 16 stylesheets eagerly. | ~25 KB brotli from first load | 220 KB `index.css` splits; Portal path measured |
| **D5** | Transcode recitation to Opus. Keep WAV masters in the certification store; record both hashes; the acoustic ledger continues to bind the WAV. | **228 MB** from every deploy | `du -sh dist/audio`; acoustic ledger still validates |
| **D5a** | Fix the two defeated dynamic imports Rollup names on every build: `core/workshop-asset-durability.js` (statically imported by `Scriptorium.js` and `core/memory.js`) and `sources/text/archive.js` (statically imported by `sources/text/index.js`). Then **make the warning fatal** so the next one cannot accumulate. | Two chunks that cannot currently split | `npm run build` emits no `(!) … dynamic import will not move module` lines |

D1–D4 together should take first load from 251 KB to roughly 60 KB. That number
is a target to measure, not a promise — the true floor is whatever the shell,
router and `Portal.js` actually need.

### Tier 1 — Cut the seam. This is the delta that matters.

| # | Delta | Detail |
|---|---|---|
| **D6** | **Ingest emits data, not code.** `literature-ingest.mjs`, `standard-ebooks-ingest.mjs`, `legacy-ingest.mjs` and `chapel-ingest.mjs` write `<sha256>.json` instead of `<slug>.js`. The `words-in == words-out` refusal is unchanged. | The one-line change with the largest consequence in the document |
| **D7** | **Publish `content/manifest.json`.** `{schema, revision, works:[{id, sha256, bytes, url, shelved, withheldReason?, certification?}], voice:[...]}`. Generated by the ingest, which already computes every field. | The contract between the two planes |
| **D8** | **Add `content-store.js`** (~250 lines): `get(id)` → Cache Storage → verify `sha256` → return, else fetch → verify → store → return. **A hash mismatch refuses.** An unverified work is *absent*, per reverent degradation — never substituted. | The only genuinely new module |
| **D9** | **Repoint the archive provider** at `content-store` instead of `work.load()`. The session compiler, chunker, player and every room are untouched — they receive the same strings from a different door. | The blast radius is one provider |
| **D10** | **Move `src/content/archive/works/` out of the application repository** into a content release. Withheld, never deleted: the payloads keep their reasons and their reversibility, in a store built for bytes rather than one built for diffs. | 93 MB out of the source tree, ~330 MB out of the pack |
| **D11** | **Delete what D6–D10 orphan:** `reachable-payloads.test.js` (its subject no longer exists), the `load:` lines in the catalogs, the withheld build-filter path, and the vitest `maxWorkers` heuristic. | Deleting a test because its defect became impossible is the strongest fix available |

### Tier 2 — Simplify, now that deletion is done.

| # | Delta | Detail |
|---|---|---|
| **D12** | **One frame scheduler.** Promote the model in `src/core/render/clock.js` — already deterministic, already tested, currently reachable only from the offline render path — to the live runtime. Replace 59 `requestAnimationFrame` sites across 21 files with one scheduler exposing `sessionTime`; `Player` stays authoritative, fields and audio become subscribers. | Makes a rendered MP4 and a live reading the same timeline. Unblocks Journeys and the virtual clock `DREAMS.md` defers |
| **D13** | **Make the route table data.** `registerViews()` is 596 lines — 37% of `app.js`. A route table is `{id, import, css, mount}`. Composes with D3 and D4. | `app.js` should be ~400 lines |
| **D14** | **Generate `WORK_ENGINE_MANIFEST` at build time** from the engine modules. It is currently a hand-maintained twin kept honest by a test — the exact defect class `PROJECT-KNOWLEDGE §2.1` names as the most frequent in the codebase. | Duplication becomes impossible instead of test-guarded |
| **D15** | **Give `src/core/` branches.** 148 files in one directory. Proposed: `core/text/` (chunker, source-span, boundaries), `core/session/` (compiler, pacing, player, clock), `core/score/` (experience-program, journey-compiler, visual-score-lane), `core/archive/` (certification, acquisition, publication), `core/scriptorium/`, `core/render/` (exists). Breaking the one cycle — `models → visual-score-lane → source-span → chunker → models` — falls out of drawing these lines, because `models.js` importing a score lane is what the boundary forbids. | Master the trunk before the leaves |
| **D15a** | **Retire `window.rise` as a service locator.** 237 production references, concentrated in four components (`VisualInterlocutionPanel` 60, `Chamber` 52, `Workshop` 35, `ChamberOrbital` 26). Pass the audio engine, settings and router in through the constructor the way `onNavigate` already is. Do this incrementally, one component at a time — it is not a prerequisite for anything else. | A dependency absent from the module graph is harder to see, not absent |
| **D16** | **Make harvested catalogs the rule and live museum APIs the exception**, removing `corsproxy.io` from the critical path and eventually from the CSP. RISE already builds the catalogs. | Deletes a third-party single point of failure it does not own |

### Tier 3 — Accelerate, on the cleaned system.

| # | Delta | Detail |
|---|---|---|
| **D17** | **Split the browser suite into a fast gate and a full matrix.** A 45-minute required check — after one run died at 29 m 25 s against a 30-minute cap — is a gate people route around. Keep a ≤5-minute smoke on every pull request; run the full matrix nightly and before release. | Cycle time is the thing being protected |
| **D18** | **Add a real-browser contract layer.** `encode-mp4.test.js` and `chamber-paint.test.js` are the two tests that touch reality, and they are the model. Extend that treatment to Web Audio, IndexedDB, DPR resize and real animation frames — the list `ARCHITECTURE.md` already names as debt. | Fewer jsdom approximations of a canvas |
| **D19** | **Test the entrances, not the compiler.** Every launch surface does call `compileSession` — that part of the contract holds. What differs per entrance is the *configuration* that reaches it: `PROJECT-KNOWLEDGE §2.3` records a verse flag surviving `scriptorium-resolve` and being dropped at the first of four hops on the path a reader actually uses. The guard therefore belongs at the doors — a test that enumerates every entrance (Library contents sheet, Vault, Workshop, Scriptorium, Journeys, Keystone, Continue) and asserts each produces an equivalent `Session` for the same work. | Converts "a reading has more than one entrance" from a lesson into a guard that can fail |
| **D20** | **Retire the orphans, or say why they stay.** `src/display/modes.js` (618 lines, zero production importers, 2 of the 59 frame-loop sites) and `src/components/ActiveSourcesModal.js` (257 lines, imported by nothing) are dead in the ordinary sense, not withheld in the archive's sense — no reason is recorded and no reader is being protected. The archive's own norm is that a withholding **states a reason**; apply it here or delete. | Removes 875 lines of code that no reader can reach and no test defends |

### Tier 4 — Automate, last.

| # | Delta | Detail |
|---|---|---|
| **D21** | **Publishing a work becomes a manifest append plus a CDN upload**, with `release:check` gating it. Only after D6–D11 — never automate a broken process. | The 500th work costs what the 16th costs |

### A note on the guard this document tripped, flagged rather than changed

Writing this document failed CI, and the failure is worth recording because the
guard is a good one and the interaction is not obvious.

`shelf-measurements.test.js` sweeps every `.js`, `.mjs` and `.md` file under
`src`, `scripts` and `docs` that names `division-index.json` or its withheld
sibling, and asserts that every kilobyte figure in those files is one of the
four measured index sizes — the two indexes as committed and as a bundler
embeds them. Its stated assumption is explicit: *"a KiB claim in a file that
names an index is a claim ABOUT an index; nothing else in these files is
measured in KiB."*

That assumption held until a document arrived whose subject is bytes. This
review names `division-index.json` once, in the Alex Xu table, and therefore
enters the sweep — after which a rounded kilobyte figure describing
`content/starters.js` was read as the index's embedded size restated in the
wrong unit, and the build went red.

The guard is right and the document was ambiguous, so the document changed to
exact byte counts, which are better documentation anyway. **The guard was not
weakened, and should not be.** Note that the first attempt at this very
paragraph failed too, because explaining the collision meant quoting the
colliding figure — which is the clearest possible demonstration that the sweep
does what it says. Its blast radius now includes any future document that
discusses sizes and happens to mention an index. Two options, both cheap, and
the choice is editorial rather than a machine's:

- narrow the sweep to figures within a line or two of an index mention; or
- leave it exactly as is and record the constraint where a writer will meet it,
  which is what this note does.

## 15. What is deliberately not proposed

- **A backend, an account system, or sync.** They would break the promise that
  makes RISE what it is, and they solve no constraint RISE actually has.
- **A UI framework.** 89 `innerHTML` sites are a real XSS surface, and the
  existing answer — prefer `textContent`, `escapeHtml`/`safeUrl` where
  templating is unavoidable — is adequate. Introducing React to fix it would add
  a dependency, a build step and a rendering model to solve a problem a lint
  rule addresses.
- **TypeScript.** Defensible, but it is a six-figure line change against a
  codebase whose defects — per its own record — have been about *structure being
  destroyed at import* and *guards that cannot fail*, not about types.
- **Rewriting the reading pipeline.** It is the best-designed part of the system.
- **Weakening `release:check` or the certification gates.** The roadmap forbids
  it and the roadmap is right.

## 16. How to know this worked

Numbers, not adjectives. Each is measurable today and after.

| Metric | Today | Target |
|---|---|---|
| First-load transfer (brotli) | **251 KB / 9 requests** | ≤ 60 KB / ≤ 3 requests |
| `dist/` total | **264 MB** | ≤ 30 MB |
| Text in `dist/assets` | **15.4 MB (83% of JS)** | 0 |
| `window.rise` references | **237** | 0 — dependencies passed in |
| Import cycles in `src/core/` | **1** | 0 |
| Packed repository | **340 MB** | ≤ 15 MB |
| `git clone` on a normal connection | minutes | seconds |
| `requestAnimationFrame` call sites | **59 in 21 files** | 1 scheduler |
| `src/app.js` | **1,610 lines** | ≤ 400 |
| Largest `src/core/` directory | **148 files** | ≤ 30 per module |
| Required browser gate | **45 min cap** | ≤ 5 min on pull request |
| Cost of the 500th work | repository-breaking | one manifest line |

---

## The sentence this review turns on

`PROJECT-KNOWLEDGE.md` ends on: *RISE does not need every text. It needs the
right texts, represented correctly.*

The corollary this review adds:

> **A text is data. The moment it became a program, every system that touches
> it — the bundler, the repository, the test runner, the browser — started
> paying for a compiler it never needed.**

Cut that seam and the rest of the list is small. Leave it and every future work,
every voice, and every reader pays for it again.
