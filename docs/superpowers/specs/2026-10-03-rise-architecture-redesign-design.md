# RISE architecture redesign — design

Date: 2026-10-03. Owner: Seth Carlson. Status: approved in conversation
("i want everything"); implementation plan at
`docs/superpowers/plans/2026-10-03-rise-architecture-redesign.md`.

## 1. Why

`docs/specs/ARCHITECTURE.md` §2 names "four constraints that decide
everything else". Questioned one by one, none is an architectural constraint:

| §2 item | What it really is | Where it goes |
|---|---|---|
| Reader material stays local | the one real product value, buried under a paragraph of Redis and key-handling detail, and contradicted by the Library route that sends the reader's intent to the Worker | constraint 1, one sentence |
| Reverent degradation | an error-handling policy | §7 contract |
| Provenance travels with the work | a rights-metadata schema rule enforced by build scripts | §7 contract |
| Structure is read, never inferred | an ingest rule | §7 contract, owned by the ingest scripts |

The constraints that do decide RISE's shape are not in §2. They are in
`AGENTS.md` and §9:

1. **No shared inference.** Every model call runs on the reader's own key or
   on the reader's own machine. RISE never pays for a reader's thinking.
2. **A browser, no account.** There is no identity service and no server-side
   reader state. Nothing a reader types or reads leaves their device unless
   they send it.
3. **Content is static and content-addressed.** Editions, recitation, imagery
   and programs are files named by their hash. They are the heavy thing
   (recitation is ~240 MB of WAV against a few MB of JavaScript) and they
   must not travel through the module graph or the application repository.

Those three sentences replace §2.

## 2. What RISE is, from physics

Text goes in. A compiler turns it into atoms with durations. A clock advances
them. A projection paints them. Everything else is a recommendation.

Measured against that, the tree today carries 20 routed rooms, 131 component
modules, a PostgreSQL database, a Redis cache, a server-side model call, a
beta gate that admits to locking nothing, in-memory routing with almost no
URLs, and 40 logged decisions. That gap is the idiot index, and the redesign
closes it.

## 3. The five layers

Each layer has one job and one owner. Lower layers never import higher ones.

### 3.1 Content

Static files addressed by their own hash: editions, Chapel books, programs
(liturgies, journeys, the poem of the day), recitation, pinned imagery, and
the catalog. They are built by the build layer into `dist/` from a content
branch, exactly as `scripts/hydrate-recitation.mjs` already does for audio,
and they are not part of the `src/` module graph.

- Recitation is encoded as Opus (`.opus`, 48 kHz, 64 kbps mono) at build.
  The manifest in `src/audio/voice-pack.manifest.json` points at the encoded
  file. WAV never ships.
- The catalog is one JSON file written by `scripts/build-content-plane.mjs`.
  There is no database.

### 3.2 Engine

Pure modules, no DOM in the first two:

| Module | Job |
|---|---|
| `src/core/session-compiler.js` | text + pacing → `Session { atoms[], totalDuration }` |
| `src/core/player.js` | the clock and the state machine `idle · playing · paused · interlocuting · complete` |
| `src/components/Chamber.js` | the Stream projection |
| `src/page/` (PageReader) | the Page projection |

The Current, the dive, the undercurrent and the successor rules stay inside
this layer unchanged. Nothing in this layer changes in the redesign; it is
the part of the tree that already matches the physics.

### 3.3 Shell

One router, real URLs, five rooms.

- `src/core/router.js` keeps crossfades and the back stack and gains a URL
  adapter: every route id has a path, `navigate()` pushes it, and a load or
  `popstate` resolves the path back to a route and its data. The Worker
  already serves `dist/index.html` for unknown paths.
- The 20 rooms collapse to five. Old route ids stay valid as aliases that
  resolve to the new room and tab, so no link breaks.

| New room | Absorbs | How |
|---|---|---|
| Home | Portal, Guide | Guide stays an overlay |
| Read | Chamber, ChamberOrbital, Live | Orbital is Read's setup pane; Live is Read with the live Current |
| Library | Library, Chapel, Rosarium, Via, Journeys, Keystones, Mint, Today, Curia | liturgies, journeys, keystone sequences and the daily poem become programs in the catalog; Curia becomes the provenance panel on any edition |
| Make | Workshop, Vault, Scriptorium, Visual Lab, Visual Catalog | tabs of one room |
| Settings | Settings, Emotions | Emotions is a toggle and an inspectable list under Settings |

BetaGate is deleted. The spec itself says it is not a security boundary.

`src/enterprise/`, the Kev check, and the render mill are kept as siblings by
owner decision (Mateo, 2026-09-30) and are out of scope.

### 3.4 Intelligence

One provider interface, two implementations, every call from the browser:

- the reader's own OpenRouter key (`src/core/decision/` today);
- Kev on the reader's own machine (`worker/kev-worker-script.mjs`, kept).

The Worker loses `/api/decision-catalog`, `worker/decision-catalog.mjs`,
`@neondatabase/serverless`, `@upstash/redis`, the three secrets and the rate
limiter in `wrangler.production.jsonc`. The Library's recommendation reads the
static catalog and asks the reader's provider. Live Realtime and the MCP relay
stay as they are: opt-in, reader's key, off by default.

### 3.5 Build

`scripts/` keeps one script per data type: ingest, audit, voice pack,
content plane, release gate, render mill. These enforce the three demoted
policies and never ship to a reader.

## 4. The spec after the redesign

`docs/specs/ARCHITECTURE.md` keeps its guarded shape (rooms table, §8
decision format, dependency count, layering check) and changes as follows:

- §2 becomes the three constraints above.
- §7 absorbs reverent degradation, provenance, and structure-is-read.
- §5's rooms table lists five rooms and the support modules.
- §8 keeps only decisions whose reason is still live. 8.1 (no backend),
  8.12 (no URLs), 8.5 (uncompressed voice pack) and the Neon/Redis parts of
  §1 are marked `reversed` with the reason, not deleted; the others are
  re-read and pruned task by task.
- §8.10's sentence argues from four production dependencies.
- §9 drops the two content costs it records as open.

## 5. What this costs

- The room collapse is five pull requests, one room family each, and each
  one edits the guarded rooms table in the same change.
- Deleting the Worker's decision route changes what the Library does on a
  recommendation: it now needs the reader's key or local Kev, which is what
  `AGENTS.md` already promises.
- Moving content out of the repository changes the deploy, so it is a
  coordinating-agent task.
- Old route ids survive as aliases, so saved links and the browser suite's
  navigation keep working during the migration.

## 6. Out of scope

Enterprise, kev-check, the render mill, the live Realtime and MCP
integrations, the six colour themes, and the engine layer. None of them
changes.
