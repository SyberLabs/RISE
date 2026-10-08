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
| [COMPOSER-FIRST-ROADMAP.md](COMPOSER-FIRST-ROADMAP.md) | Intent | First-edition guided explanations in ChatGPT, composed in one shot and presented by RISE: milestones, dependencies and ownership. Dive and realtime Live are out of current scope. |
| [VISION.md](VISION.md) | Intent | Where RISE is going: the harness a model performs in. The reader redirects the room in words while it runs, the model searches a catalog of procedural imagery and sees what the reader does, and scenes let the reader act inside the explanation. Says plainly what is built (little of it), the order to build the rest, and what we refuse. Supersedes the `vision/` folder as direction. |
| [PROJECT-KNOWLEDGE.md](PROJECT-KNOWLEDGE.md) | Record | The handover. Recurring defect patterns and the reasoning behind decisions that look arbitrary. Read section 2 twice. |
| [specs/ARCHITECTURE.md](specs/ARCHITECTURE.md) | Contract | The canonical, living system design: the planes, the room register, the contracts, and every significant decision with the alternative it rejected. `src/core/system-design.test.js` fails a build when it drifts from the tree. |
| [specs/SYSTEM-DESIGN-REVIEW-2026-08-22.md](specs/SYSTEM-DESIGN-REVIEW-2026-08-22.md) | Record | The review that produced the document above, measured against commit `bb44899` with the commands to reproduce each number. |
| [RELEASING.md](RELEASING.md) | Contract | Production release, required approvals and secrets, and rollback for the Cloudflare host. |
| [../AGENTS.md](../AGENTS.md) | Contract | Operating principles and project development notes, for humans and agents alike. |

## Release

| Document | Status | What it is |
| --- | --- | --- |
| [RELEASE-ROADMAP-2026-08-20.md](RELEASE-ROADMAP-2026-08-20.md) | Record | The August 2026 release corridor and its evidence ledger. Historical: the product tracker ([product/README.md](product/README.md)) is current, and `npm run release:check` still runs the machine gates. |
| [RELEASE-ACCEPTANCE-PROTOCOL.md](RELEASE-ACCEPTANCE-PROTOCOL.md) | Contract | The human gates - certification, acoustic review, device review - that no script can pass on its own. |
| [RISE-RELEASE-REPORT-2026-08-31.md](RISE-RELEASE-REPORT-2026-08-31.md) | Record | System-wide production sweep of release readiness: machine gates, human gaps, security, state, documentation drift, and public-sharing verdict. |

## Pilot

| Document | Status | What it is |
| --- | --- | --- |
| [plans/LIVE-CURRENT.md](plans/LIVE-CURRENT.md) | Intent | The plan for a live Current: an event protocol above the sealed one, one clock with speech as its authority, a runtime boundary, provider adapters, Dive and Surface as a branch, evidence, budgets, and the decisions that wait on the creator. A status table says what is built. |
| [plans/LIVE-HANDOFF.md](plans/LIVE-HANDOFF.md) | Intent | Where the live Current stands at the end of the first build: the ten stacked pull requests, the architecture, what is implemented, tested, browser tested, tested only against fakes, and not verified; the commands run and what they said; the measurements; how to see it; whether it differs from a visualizer (unknown); the open risks; and the next smallest experiment. |
| [plans/LIVE-MCP.md](plans/LIVE-MCP.md) | Intent | How a live Current runs inside an MCP host: the host's model as the provider, a server with one tool, an app that frames RISE's own page, and a Dive asked through sampling. Built and checked against the SDK's client and the reference package's own host class; off by default; no product host tried. |
| [evals/creative-control/CREATIVE-CONTROL-EVALS.md](evals/creative-control/CREATIVE-CONTROL-EVALS.md) | Record | The Creative Control evaluation corpus: prompts and reference Currents per style, and what `npm run eval:creative` measures (validation, admission, a headless frame run of every code scene) and does not (pixels, WebGL, the sandbox). |
| [plans/COMPOSER-INSTRUMENTS.md](plans/COMPOSER-INSTRUMENTS.md) | Intent | The three instruments a Current may name (still, attractor, genesis): purpose, limits, accessibility, why the words explain and the instruments only set the mood, the three explanation fixtures, why Neural, Flame and Gallery stay out, and the rule for the Reader's engine catalog. |
| [plans/CHATGPT-DEMO.md](plans/CHATGPT-DEMO.md) | Intent | Historical private-demo setup notes, ten acceptance cases, exact candidate evidence and remaining real-host checks; the former demo Worker endpoint is offline. |
| [plans/EMBED-WITNESS.md](plans/EMBED-WITNESS.md) | Intent | The runbook for the embed stage's one ChatGPT developer-mode session, for the owner by hand: the exact candidate, the demo Worker deployed from it, the connection per the current OpenAI page, the one conversation, what to press and watch, the `?log=host` lines and the five host questions with what each answer changes, the record's template, and the Worker made inert. |
| [experiments/RISE-GATE0.md](experiments/RISE-GATE0.md) | Intent | The first local persistent-widget Gate 0 probe and its browser simulation. Closed: ChatGPT is a Composer host. |
| [experiments/CHATGPT-HOST-2026-10-04.md](experiments/CHATGPT-HOST-2026-10-04.md) | Record | The controlled ChatGPT host session: reader-confirmed Composer narration on the exact release, the open control and fallback checks, and the decoupled probe whose admitted model changes never reached an open widget. |
| [experiments/LIVE-002-HOST-2026-10-05.md](experiments/LIVE-002-HOST-2026-10-05.md) | Record | The completed LIVE-002 session on exact main 44807f4a: reader-confirmed ChatGPT narration and controls, the visible speech-unavailable fallback, and the temporary demo endpoint verified offline. Integration acceptance, not public release. |
| [experiments/EMBED-STAGE-HOST-2026-10-07.md](experiments/EMBED-STAGE-HOST-2026-10-07.md) | Record | The embed stage witnessed in ChatGPT on exact main 122b1cb6 (includes RDR-022): the host lines and the five host questions, the owner-confirmed voice and controls, three playback defects that keep LIVE-004 open, and the demo endpoint verified offline. |
| [experiments/RELEASE-GATES-2026-10-07.md](experiments/RELEASE-GATES-2026-10-07.md) | Record | RDR-010: the fail-closed release report on exact main 8ef95ec9 (3 pass, 5 blocked, 3 human gates) and the human gate records read against it; every blocker is a human gate for the final witness pass. |
| [experiments/EMBED-SAFETY-2026-10-05.md](experiments/EMBED-SAFETY-2026-10-05.md) | Record | Whether a reader's safety settings reach the ChatGPT embed: saved RISE settings do not cross into a frame on another site, the system's reduced motion does, and nothing in a Composer presentation flashes; the gaps for a RISE-only setting. |
| [plans/LIVE-GEMINI.md](plans/LIVE-GEMINI.md) | Intent | A live Current from Gemini with the reader's own key: streaming text generation (not the Live API) behind the existing text-stream seam, called straight from the reader's browser; what is left out, the one security-policy change, the build plan, and how to verify it with a real key. Off by default; unverified against Google. |
| [plans/LIVE-EVALUATION.md](plans/LIVE-EVALUATION.md) | Intent | The instrument for asking whether a live Current differs from text, ordinary voice, and voice over a generic visualizer: a between-participants design, its measures, how to run it, what a record holds, and an analysis written so it cannot overclaim. The study has not been run. |
| [plans/LIVE-RED-TEAM.md](plans/LIVE-RED-TEAM.md) | Record | An adversarial review of the live layer and its fixes: the trust boundary, twelve confirmed defects and how each was fixed, the architectural risks, what held, streaming and plugin readiness, the experiments a real provider must settle, and what still blocks switching Live or MCP on. |
| [plans/CURRENT-CONSOLIDATION.md](plans/CURRENT-CONSOLIDATION.md) | Intent | Phase 0 map for consolidating every entrance around one compiled reading: the room inventory, the gaps in the contract, who scores affect, and the decisions that wait on the creator. Nothing in it is built. |

## The Archive - texts and their editing

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
| [ingest-records/](ingest-records/) | Record | Dated ingest and audit artifacts alongside it. Read by `scripts/attic/legacy-ingest.mjs` and `scripts/literature-ingest.mjs`; JSON, not prose. |

## Authoring - scores, rooms, and rendering

| Document | Status | What it is |
| --- | --- | --- |
| [vision/EXPERIENCE-PROGRAM-SPEC.md](vision/EXPERIENCE-PROGRAM-SPEC.md) | Contract | `rise.experience-program.v1`, the score format everything authored compiles into. |
| [specs/LIVE-CURRENT-EVENTS-V1.md](specs/LIVE-CURRENT-EVENTS-V1.md) | Contract | `rise.current-events.v1`: the events, limits, ordering and failure rules of a live Current, and how committed words lower to `rise.current.v1`. Matches `src/live/protocol.js` and `src/live/stream.js`. |
| [specs/RISE-CURRENT-V1-SLICE.md](specs/RISE-CURRENT-V1-SLICE.md) | Contract | The bounded external Current input that compiles through the Experience Program and Session. Sealed response only; realtime events and voice are outside this slice. |
| [vision/SCRIPTORIUM-SPEC.md](vision/SCRIPTORIUM-SPEC.md) | Contract | The room where a model composes against an exported capability document, and the gate that admits the result. Cited by eleven source files. |
| [vision/WORKSHOP-COMPOSITION-STUDIO-SPEC.md](vision/WORKSHOP-COMPOSITION-STUDIO-SPEC.md) | Contract | The authoring room. |
| [vision/AGENT-COMPOSITION-AND-RENDER-SPEC.md](vision/AGENT-COMPOSITION-AND-RENDER-SPEC.md) | Contract | What may be published and rendered, and under what policy. |
| [vision/NARRATION-LANE-SPEC.md](vision/NARRATION-LANE-SPEC.md) | Contract | The narration lane. Cited by `src/core/narration.js`. |
| [vision/RECITATION-SPEC.md](vision/RECITATION-SPEC.md) | Contract | Recitation and voice packs. |
| [vision/SCRIPTORIUM-STRENGTHENING-SPEC.md](vision/SCRIPTORIUM-STRENGTHENING-SPEC.md) | Intent | Design brief. Partly realised - `src/core/partition.js` is its §2.4. |

## Reading surfaces

| Document | Status | What it is |
| --- | --- | --- |
| [vision/PAGE-MODE-SPEC.md](vision/PAGE-MODE-SPEC.md) | Contract | Page projection, v1. Matches `src/page/`. |
| [specs/RHYTHMIC-VISUAL-PRESENCE-SPEC.md](specs/RHYTHMIC-VISUAL-PRESENCE-SPEC.md) | Contract | Rhythmic visual presence, as built. |
| [specs/LATERAL-TRAVERSAL-SPEC.md](specs/LATERAL-TRAVERSAL-SPEC.md) | Contract | The Shuttle. Implemented in `src/core/shuttle.js`. |
| [specs/CONTINUOUS-FIELD-SPEC.md](specs/CONTINUOUS-FIELD-SPEC.md) | Contract | Gallery's continuous field. Implemented in `src/visuals/continuous-field.js`. |
| [specs/JEV-VARIANCE.md](specs/JEV-VARIANCE.md) | Contract | One-call Jev reading diversity, intent precedence, and bounded cache slots. |
| [specs/INVOCATION-SKINS.md](specs/INVOCATION-SKINS.md) | Contract | Home's night library and the wormhole: one roll, one decision route, one way to open a reading, and the accessibility contract a new skin meets. Implemented in `src/core/roll.js`, `src/app/invocation.js` and `src/wormhole/`. |
| [specs/PHASE-2-SAFETY-SPEC.md](specs/PHASE-2-SAFETY-SPEC.md) | Contract | Photosensitivity and reading limits. See `src/core/visual-safety.js`. |
| [vision/SPATIAL-CHAMBER-SPEC.md](vision/SPATIAL-CHAMBER-SPEC.md) | Intent | A separate spatial room. Realised instead as the Stream/Page toggle. |
| [specs/Premium_Mobile_Chamber.md](specs/Premium_Mobile_Chamber.md) | Intent | Mobile visual grammar. Portal adopts part of it. |

## Imagery - what may be shown, and on whose authority

| Document | Status | What it is |
| --- | --- | --- |
| [specs/MUSEUM-ATLAS.md](specs/MUSEUM-ATLAS.md) | Contract | Per-institution provider discipline. Cited by `src/sources/visual/museum.js`. |
| [vision/SOURCE-CURATION-SPEC.md](vision/SOURCE-CURATION-SPEC.md) | Contract | Curated pins only, no keyword search. The invariant that retired the searched categories. |
| [vision/SOURCE-EXPANSION-SPEC.md](vision/SOURCE-EXPANSION-SPEC.md) | Contract | The science and Audubon collections. |
| [specs/ATRIUM-IMAGERY-SPEC.md](specs/ATRIUM-IMAGERY-SPEC.md) | Contract | The museum imagery subsystem. Named for a deleted room; the `atr-` accessions it governs are live data. |
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
| [vision/NORTH-STAR.md](vision/NORTH-STAR.md) | Intent | Product philosophy of the engine era. Superseded as direction by [VISION.md](VISION.md); kept as a record of that era and not re-reviewed against it. |
| [vision/JOURNEYS-SPEC.md](vision/JOURNEYS-SPEC.md) | Intent | Journeys are on ice - their scores quote editions the canon no longer serves. Re-anchoring is an editorial act, not a repair. |
| [specs/BOOK-VI-PROCEDURAL-WORKS.md](specs/BOOK-VI-PROCEDURAL-WORKS.md) | Record | Milton's Book VI mapped to the engines in `src/visuals/paradise_lost/`, for the withdrawn Journey. |
| [vision/DREAMS.md](vision/DREAMS.md) | Intent | Unscheduled experiments. Explicitly not a plan. |
| [journey-editorial/editorial-work.md](journey-editorial/editorial-work.md) | Draft | Unpublished source-bound Journey, editorial status, and decisions. |
| [journey-editorial/sources.md](journey-editorial/sources.md) | Evidence | Edition identities, excerpt anchors, and checksum evidence. |
| [journey-editorial/review.md](journey-editorial/review.md) | Review | Scope-limited review and validation evidence. |
| [journey-editorial/validation.md](journey-editorial/validation.md) | Validation | Draft launch, source, checksum, and certification boundaries. |

---

## Affect and the Emotions room

| Document | Status | What it is |
| --- | --- | --- |
| [affect/AFFECT-LAYER.md](affect/AFFECT-LAYER.md) | Record | The optional affect evaluator, phrase-addressed programs, and Emotions map; not a model of a reader's feelings. |
| [affect/BENCHMARK.md](affect/BENCHMARK.md) | Record | Inspection results for the lexicon-backed text priors and offline comparison probes. |
| [affect/RESEARCH-LOG.md](affect/RESEARCH-LOG.md) | Record | Research limitations, unavailable human judgments, and the reasons the probe is not a trained runtime. |
| [adr/0001-affective-semantic-layer.md](adr/0001-affective-semantic-layer.md) | Record | The architecture decision and alternatives for the inspectable affect layer. |
| [adr/0002-gate-0-realtime-host.md](adr/0002-gate-0-realtime-host.md) | Record | Gate 0 of the realtime roadmap: the persistent-widget probe, the older Worker-only probe, and the outcome: ChatGPT is a Composer host (decided 2026-10-04). |

## Reading decision service and retired gate

| Document | Status | What it is |
| --- | --- | --- |
| [USER-OWNED-AI.md](USER-OWNED-AI.md) | Intent | RISE spends no shared inference: hosted Jev on the reader's own OpenRouter account, the shared decision contract, retired routes, release order, and the mocked/local/live evaluation. |
| [LOCAL-RISE.md](LOCAL-RISE.md) | Intent | Run RISE and pinned Kev-4B on your own computer: requirements, launcher states, bridge security, and network dependencies. |
| [jev-core/variety-evaluation.md](jev-core/variety-evaluation.md) | Record | Jev prompt-variety baseline, bounded evaluation method, and local candidate evidence. |

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
published view, never a source - edit the wiki directly and the next push
overwrites you. To change the wiki, change the Markdown here.

Everything under `docs/` is published and must therefore appear in the tables
above, or the build fails. The one exception is `docs/superpowers/`, which
holds design specs and task-by-task plans belonging to the Superpowers
workflow: in-flight process addressed to whoever is executing it, rather than
documentation a reader came looking for. It is neither published nor indexed.

Preview the generated pages without pushing:

```bash
node scripts/build-wiki.mjs --out /tmp/rise-wiki
```

## Product direction and team tracking

| Document | Status | What it is |
| --- | --- | --- |
| [product/README.md](product/README.md) | Contract | Task update workflow and product discussion library for both directions. |
| [product/READER-DIRECTION.md](product/READER-DIRECTION.md) | Intent | Reader scope, recent merged work and acceptance packages. |
| [product/CONSOLIDATED-READER.md](product/CONSOLIDATED-READER.md) | Intent | Decided 2026-10-05: a canonical Home, four reader choices, ten looks, one engine catalog and colour vocabulary, what the ChatGPT plugin holds constant, and the build order. |
| [COMPOSER-FIRST-ROADMAP.md](COMPOSER-FIRST-ROADMAP.md) | Intent | Approved Composer delivery: M0 to M2, reader sessions, then release. |
| [product/TRACKER-DESIGN.md](product/TRACKER-DESIGN.md) | Intent | Approved repository/local tracker architecture. |
| [product/discussions/2026-10-03-direction-decisions.md](product/discussions/2026-10-03-direction-decisions.md) | Record | Available October conversation decisions and provenance. |
| [product/discussions/2026-10-04-composer-decision.md](product/discussions/2026-10-04-composer-decision.md) | Record | Composer is the approach in ChatGPT: a one-shot sequence creator and RISE presentation. Dive and realtime Live leave the current scope, with the host evidence. |
| [product/discussions/2026-10-05-consolidated-reader-decisions.md](product/discussions/2026-10-05-consolidated-reader-decisions.md) | Record | The answers to the Consolidated Reader's six questions: the canonical Home, ten looks, phone-first Inlay, Follow text inside one look, the attractor frame policy and the nine themes as the one colour vocabulary. |
| [product/discussions/2026-10-05-embed-stage-decision.md](product/discussions/2026-10-05-embed-stage-decision.md) | Record | The ChatGPT embed is one stage with two controls, Play/Pause and Settings (intensity, theme, still imagery, text size): what is removed and where each old requirement lives, the sizing and the host contract, what #423 already did, the tests, the build plan and two open owner questions. |
| [product/discussions/2026-10-06-score-speech-service-roadmap.md](product/discussions/2026-10-06-score-speech-service-roadmap.md) | Record | The score, speech and service roadmap of 2026-10-06: the Current as a thin envelope over the curator context in two stages, speech stage 0 and the poem packs now, the deferrals with their triggers, the hosted carry explained, and what begins score stage 1. |
| [product/discussions/2026-10-07-current-with-a-look.md](product/discussions/2026-10-07-current-with-a-look.md) | Record | SCR-001, score stage 1: the Current gains `look`, admitted only where every engine the look draws is verified for the card (Plain, Garden, Signal today) and lowered through the look’s own partial; 1b’s collection, sound and pace with their gates; stage 2’s `program` reserved; four owner questions with defaults. |
| [product/discussions/2026-10-07-reader-control-and-replay.md](product/discussions/2026-10-07-reader-control-and-replay.md) | Record | LIVE-005 (M2) in the embed: Stop folded into Pause and teardown, the focus kept on the stage for keyboard readers, place kept through pauses and hidden pages, which settings are kept, and replay as the host's redelivery and Play again rather than a Vault save inside the card. |
| [product/discussions/2026-10-05-one-colour-vocabulary-design.md](product/discussions/2026-10-05-one-colour-vocabulary-design.md) | Record | B2a design: the theme-to-engine map beside `RISE_CURRENT_THEMES`, how each engine takes its theme, seven pull requests and five owner questions. |
| [product/discussions/2026-10-07-chrome-follows-theme.md](product/discussions/2026-10-07-chrome-follows-theme.md) | Record | B2b: the Settings accent and its eleven colourways are removed, and a themed reading dresses the page in its accent while it is on screen; one reading owns the root at a time, and a host’s card keeps its own. |
| [product/discussions/2026-10-07-gallery-follows-with-works.md](product/discussions/2026-10-07-gallery-follows-with-works.md) | Record | RDR-023 part 2: a Gallery reading follows its text with one museum collection a passage, by mood (Landscapes, the Impressionists, the Post-Impressionists, the Old Masters), locally and never sent to Jev; the four mood lines drafted for the owner’s review. |
| [product/discussions/2026-10-05-canonical-home-design.md](product/discussions/2026-10-05-canonical-home-design.md) | Record | B4 design: Home as a home with a window, the featured reading set still over its own field, Begin the one key, Continue when a reading is in memory, eight pull requests and five owner questions. |
| [product/discussions/2026-10-04-reader-evidence.md](product/discussions/2026-10-04-reader-evidence.md) | Record | Production probes, Reader capabilities, the stutter's causes and 14 days of history behind the Consolidated Reader proposal. |
| [product/discussions/2026-10-original-performance-roadmap.md](product/discussions/2026-10-original-performance-roadmap.md) | Intent | User-supplied long-range roadmap, preserved as historical direction. |
