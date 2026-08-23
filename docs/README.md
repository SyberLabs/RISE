# RISE documentation

Start at the [README](../README.md) for what RISE is. This page says which
document to trust for what, and how much.

A document here is one of three things, and the difference matters more than
the folder it sits in:

| Status | Means |
| --- | --- |
| **Contract** | Code is held to it. Changing the code without changing this is a defect. |
| **Record** | A decision, measurement, or permission already taken. Historical, and not to be edited to match later opinion. |
| **Intent** | A design not yet built, or built only in part. Describes where something is going, not what it does. |

Folders carry no authority. `docs/specs/` and `docs/vision/` are an accident of
history, not a distinction; read the status column instead.

---

## Start here

| Document | Status | What it is |
| --- | --- | --- |
| [PROJECT-KNOWLEDGE.md](PROJECT-KNOWLEDGE.md) | Record | The handover. Recurring defect patterns and the reasoning behind decisions that look arbitrary. Read section 2 twice. |
| [specs/ARCHITECTURE.md](specs/ARCHITECTURE.md) | Contract | The canonical, living system design: the planes, the room register, the contracts, and every significant decision with the alternative it rejected. `src/core/system-design.test.js` fails a build when it drifts from the tree. |
| [specs/SYSTEM-DESIGN-REVIEW-2026-08-22.md](specs/SYSTEM-DESIGN-REVIEW-2026-08-22.md) | Record | The review that produced the document above, measured against commit `bb44899` with the commands to reproduce each number. |
| [superpowers/plans/2026-08-23-system-design-review-deltas.md](superpowers/plans/2026-08-23-system-design-review-deltas.md) | Record | How the review's deltas were executed, with the before and after for each. Dated; the design it settled is recorded in `specs/ARCHITECTURE.md` §8.2. |
| [../AGENTS.md](../AGENTS.md) | Contract | Operating principles and project development notes, for humans and agents alike. |

## Release

| Document | Status | What it is |
| --- | --- | --- |
| [RELEASE-ROADMAP-2026-08-20.md](RELEASE-ROADMAP-2026-08-20.md) | Contract | The current release corridor. Gates checked by `npm run release:check`. |
| [RELEASE-ACCEPTANCE-PROTOCOL.md](RELEASE-ACCEPTANCE-PROTOCOL.md) | Contract | The human gates — certification, acoustic review, device review — that no script can pass on its own. |

## The Archive — texts and their editing

| Document | Status | What it is |
| --- | --- | --- |
| [specs/ARCHIVE-CANON-SPEC.md](specs/ARCHIVE-CANON-SPEC.md) | Contract | Governs the fifteen-work canon. Cited by `src/content/archive/canon.js`. The authority on what may be served. |
| [specs/ARCHIVE-CLEANSING-SPEC.md](specs/ARCHIVE-CLEANSING-SPEC.md) | Record | The defect vocabulary from the cleansing campaign. The campaign ended; the vocabulary survives as the regression suite. |
| [specs/CORPUS-REVIEWER-PROMPT.md](specs/CORPUS-REVIEWER-PROMPT.md) | Record | The prompt those reviews ran under, kept because `scripts/corpus-review-*.mjs` still speak its format. |
| [specs/TYPESETTING-CANON.md](specs/TYPESETTING-CANON.md) | Contract | Compositor rules. Matches `src/page/compositor.js`. |
| [vision/PHRASE-CHUNKING-STUDY.md](vision/PHRASE-CHUNKING-STUDY.md) | Record | Measured, not assumed. Reproduce with `npm run study:chunking`. |
| [vision/CHUNKER-AWARENESS-STUDY.md](vision/CHUNKER-AWARENESS-STUDY.md) | Record | Reproduce with `npm run study:awareness`. |
| [vision/LIBRARY-SPEC.md](vision/LIBRARY-SPEC.md) | Record | The critique that produced the canon. Superseded as policy by ARCHIVE-CANON-SPEC. |
| [ingest-records/SOL-PD-ACQUISITIONS-DOSSIER-LITERATURE-2026-07-28.md](ingest-records/SOL-PD-ACQUISITIONS-DOSSIER-LITERATURE-2026-07-28.md) | Record | The acquisitions dossier the shelf was assembled from. Read by `scripts/archive-dossier.mjs`. |
| [ingest-records/](ingest-records/) | Record | Dated ingest and audit artifacts alongside it. Read by `scripts/legacy-ingest.mjs` and `scripts/literature-ingest.mjs`; JSON, not prose. |

## Authoring — scores, rooms, and rendering

| Document | Status | What it is |
| --- | --- | --- |
| [vision/EXPERIENCE-PROGRAM-SPEC.md](vision/EXPERIENCE-PROGRAM-SPEC.md) | Contract | `rise.experience-program.v1`, the score format everything authored compiles into. |
| [vision/SCRIPTORIUM-SPEC.md](vision/SCRIPTORIUM-SPEC.md) | Contract | The room where a model composes against an exported capability document, and the gate that admits the result. Cited by eleven source files. |
| [vision/WORKSHOP-COMPOSITION-STUDIO-SPEC.md](vision/WORKSHOP-COMPOSITION-STUDIO-SPEC.md) | Contract | The authoring room. |
| [vision/AGENT-COMPOSITION-AND-RENDER-SPEC.md](vision/AGENT-COMPOSITION-AND-RENDER-SPEC.md) | Contract | What may be published and rendered, and under what policy. |
| [vision/NARRATION-LANE-SPEC.md](vision/NARRATION-LANE-SPEC.md) | Contract | The narration lane. Cited by `src/core/narration.js`. |
| [vision/RECITATION-SPEC.md](vision/RECITATION-SPEC.md) | Contract | Recitation and voice packs. |
| [vision/SCRIPTORIUM-STRENGTHENING-SPEC.md](vision/SCRIPTORIUM-STRENGTHENING-SPEC.md) | Intent | Design brief. Partly realised — `src/core/partition.js` is its §2.4. |

## Reading surfaces

| Document | Status | What it is |
| --- | --- | --- |
| [vision/PAGE-MODE-SPEC.md](vision/PAGE-MODE-SPEC.md) | Contract | Page projection, v1. Matches `src/page/`. |
| [specs/RHYTHMIC-VISUAL-PRESENCE-SPEC.md](specs/RHYTHMIC-VISUAL-PRESENCE-SPEC.md) | Contract | Rhythmic visual presence, as built. |
| [specs/LATERAL-TRAVERSAL-SPEC.md](specs/LATERAL-TRAVERSAL-SPEC.md) | Contract | The Shuttle. Implemented in `src/core/shuttle.js`. |
| [specs/CONTINUOUS-FIELD-SPEC.md](specs/CONTINUOUS-FIELD-SPEC.md) | Contract | Gallery's continuous field. Implemented in `src/visuals/continuous-field.js`. |
| [specs/PHASE-2-SAFETY-SPEC.md](specs/PHASE-2-SAFETY-SPEC.md) | Contract | Photosensitivity and reading limits. See `src/core/visual-safety.js`. |
| [vision/SPATIAL-CHAMBER-SPEC.md](vision/SPATIAL-CHAMBER-SPEC.md) | Intent | A separate spatial room. Realised instead as the Stream/Page toggle. |
| [specs/Premium_Mobile_Chamber.md](specs/Premium_Mobile_Chamber.md) | Intent | Mobile visual grammar. Portal adopts part of it. |

## Imagery — what may be shown, and on whose authority

| Document | Status | What it is |
| --- | --- | --- |
| [specs/MUSEUM-ATLAS.md](specs/MUSEUM-ATLAS.md) | Contract | Per-institution provider discipline. Cited by `src/sources/visual/museum.js`. |
| [vision/SOURCE-CURATION-SPEC.md](vision/SOURCE-CURATION-SPEC.md) | Contract | Curated pins only, no keyword search. The invariant that retired the searched categories. |
| [vision/SOURCE-EXPANSION-SPEC.md](vision/SOURCE-EXPANSION-SPEC.md) | Contract | The science and Audubon collections. |
| [specs/ATRIUM-IMAGERY-SPEC.md](specs/ATRIUM-IMAGERY-SPEC.md) | Contract | The museum imagery subsystem. Named for a deleted room; the `atr-` accessions it governs are live data. |
| [specs/ATRIUM-IMAGERY-CLASSIFICATION.md](specs/ATRIUM-IMAGERY-CLASSIFICATION.md) | Contract | The imagery taxonomy read by `src/visuals/visual-cortex.js`. |
| [specs/PERICOPE-IMAGERY-SPEC.md](specs/PERICOPE-IMAGERY-SPEC.md) | Contract | Gospel pericope imagery. Implemented in `src/content/chapel/imagery/`. |
| [icon-museum-permission.txt](icon-museum-permission.txt) | Record | Written permission, verbatim. The rights basis for every Icon Museum pin. Do not edit. |
| [icon-museum-request-draft.md](icon-museum-request-draft.md) | Record | What was described when that permission was asked for, and therefore the scope it was granted against. |
| [vision/TEXT-ATTUNED-IMAGERY-SPEC.md](vision/TEXT-ATTUNED-IMAGERY-SPEC.md) | Intent | Not built. |

## The Chapel

| Document | Status | What it is |
| --- | --- | --- |
| [specs/CATHOLIC-CHAMBER-SPEC.md](specs/CATHOLIC-CHAMBER-SPEC.md) | Record | The proposal the Chapel, Rosarium, and Via were built from. The rooms shipped; the document is the reasoning, not the current contract. |

## Direction and unbuilt work

| Document | Status | What it is |
| --- | --- | --- |
| [vision/NORTH-STAR.md](vision/NORTH-STAR.md) | Intent | Product philosophy. |
| [vision/JOURNEYS-SPEC.md](vision/JOURNEYS-SPEC.md) | Intent | Journeys are on ice — their scores quote editions the canon no longer serves. Re-anchoring is an editorial act, not a repair. |
| [specs/BOOK-VI-PROCEDURAL-WORKS.md](specs/BOOK-VI-PROCEDURAL-WORKS.md) | Record | Milton's Book VI mapped to the engines in `src/visuals/paradise_lost/`, for the withdrawn Journey. |
| [vision/DREAMS.md](vision/DREAMS.md) | Intent | Unscheduled experiments. Explicitly not a plan. |

---

## Conventions

**Say what a document is at the top of it.** A spec headed "not implemented"
that has been implemented for months costs a reader more than no heading at
all. If you build the thing, change the heading in the same commit.

**Delete a document when its subject is gone.** Git keeps it. A stale spec in
the tree is read as current by the next person, and by every model that greps
the repository.

**Records are not edited to match later opinion.** Permissions, measurements,
and dated audits stay as written. Supersede them with a new document; do not
quietly correct them.

**One subject, one authority.** Where two documents both claim to govern
something, fold one into the other. The most expensive recurring defect in this
project is a vocabulary living in two places where only one learns a new word.

## Publishing to the wiki

The [GitHub wiki](https://github.com/SyberLabs/RISE/wiki) is generated from
these files by `.github/workflows/wiki.yml` on every push to `main`. It is a
published view, never a source — edit the wiki directly and the next push
overwrites you. To change the wiki, change the Markdown here.

Preview the generated pages without pushing:

```bash
node scripts/build-wiki.mjs --out /tmp/rise-wiki
```
