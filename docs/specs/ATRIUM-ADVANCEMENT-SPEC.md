# Atrium Advancement — Corpus 0.3.2, Full Launchability, the Constellation

**Steering:** Fable 5 (architecture, review, commit authority)
**Implementation:** 5.6 sol
**Prerequisite:** Phase 2 (safety) reviewed and committed first — this
spec touches none of Phase 2's files until then.
**Companion documents:** `ATRIUM-CORPUS-SPEC.md` (product law),
`ATRIUM-GATE-C-TRANCHE-1-SECOND-OPINION.md` (editorial annex whose
amendments Objective A encodes).

**The two product outcomes, in the editor's words:** every included
sequence launchable in the Chamber by the end, and a dedicated graph
UI — the current map's edges are hard to read, and the relations
deserve a first-class view.

---

## Objective A — Corpus 0.3.2: encode the second-opinion amendments

Amend four tranche-one case files per the annex (these are amendments
to *proposed* dispositions — still zero specialist decisions recorded;
the approval contract is untouched):

1. `specialist-edge-heraclitus-stoa`: the proposed note must hedge
   ekpyrosis — "…including fire and, on the Stoic reading, cosmic
   recurrence…". The corpus must not silently take sides on whether
   Heraclitus held ekpyrosis.
2. `specialist-edge-stoa-plotinus`: add Porphyry, *Life of Plotinus* 14
   as an evidence anchor (direct ancient testimony of Stoic material
   embedded in Plotinus). A `VP-14` research-source entry will be
   needed; SEP-Plotinus discusses it if a stable citation is preferred.
3. `specialist-edge-iamblichean-alexandria`: proposed note phrasing →
   "through the Athenian school (Syrianus, Proclus) and its Alexandrian
   heirs (Hermeias, Ammonius)".
4. `specialist-edge-eleatic-milesian`: carry the constructive-cosmology
   acknowledgment from the rationale into the proposed note text.

Additionally: register two **tranche-2 draft candidates** (drafts only,
gated as all drafts are): the reversed `Academic Skepticism →
Pyrrhonism` origin/reaction edge (Aenesidemus; Photius *Bibl.* 212) and
a distinct Pyrrho person node carrying the contested edge to
Arcesilaus. Bump corpus version 0.3.1 → 0.3.2 everywhere the validators
check it; the second-opinion annex stays version-pinned to 0.3.1 (do
not edit it).

## Objective B — Every included sequence launchable

Today only journeys launch. By the end of this work:

1. **Point launches exist.** Every node/event whose passages clear the
   existing readiness gates gets a point launch (the 3–7 minute
   sequence class from ATRIUM-CORPUS-SPEC §2.2). Extend `handoff.js`
   with a point handoff that reuses — not duplicates — the journey
   machinery: same checksum verification, word-count check, provenance
   fields (`kind: 'atrium-point'`), origin chip with restore state.
2. **A coverage manifest** (content module + test): every node and
   event is enumerated as `launchable: journey | point | both | none`.
   The build test asserts that everything the pilot pack *claims* to
   cover launches, and prints the coverage table on failure.
3. **Honest gaps.** Records with no ready passage keep a quiet,
   truthful affordance ("Corpus passage pending") — never a dead or
   hidden button.
4. **THE INVIOLABLE RULE:** launchability is achieved by completing
   payloads, edition records, and audits — **never by weakening or
   special-casing the readiness gates**. If a passage cannot clear
   rights review, it stays blocked and is reported in the summary as
   blocked-with-reason. A gate bypass of any kind fails review.
5. One invariant test closing an audit watchpoint: a handoff's joined
   `text` must equal the join of its `sources[].data` — the dual
   representation can never diverge.

## Objective C — The Constellation: a dedicated graph view

A third view mode for philosophy: `Map | List | Graph`. The map keeps
its era-section layout; the Constellation is a **new renderer where
edges are the protagonist** — transmission is the story of this corpus.

**Layout.** Layered DAG: eras as chronological columns (left→right),
nodes ordered within columns by a simple deterministic
barycenter pass to reduce crossings. No dependencies; static SVG.
Horizontal scroll/pan; the container joins the existing
`atrium-scroll` idiom.

**Edges as first-class citizens:**
- Cubic bézier threads. Confidence → stroke character: high/reviewed
  = solid luminous 1.5px; medium = solid 1px at reduced alpha;
  contested = dashed, faint. Relationship type → hue accent within the
  house palette (influence: threshold violet; critique: ember;
  transmission: jade; synthesis: gold). A compact legend anchors the
  corner.
- **Edges are selectable.** Clicking a thread opens the *edge* in the
  detail aside: claim type, confidence, note, citations, editorial
  stage. The edges carry the corpus's most carefully reviewed
  content; today no UI surfaces them as entities.
- Hover a node → its edge neighborhood brightens, everything else
  dims to ~0.15 opacity. Select a node → a slow **transmission pulse**
  of light travels its incoming edges (SVG stroke-dashoffset
  animation, ~1.5s, once — not looping).
- **Motion discipline:** under OS reduced-motion OR the app's
  `reduced-motion` root class, no pulse — static highlight only. No
  per-frame JavaScript anywhere in this view; all animation is CSS/SMIL-
  free declarative CSS on SVG strokes.

**Accessibility.** Nodes remain buttons (tabbable, aria-pressed as in
the map); edges get `role="button"` with an aria-label naming the
relation ("Influence: Heraclitus → Stoicism, medium confidence").

**Performance watchpoint (audit carry-over):** while implementing,
convert `renderBody()`'s search-input path to a targeted update for
the stage region only (filters/detail untouched) — the wholesale
re-render is the Atrium's scale ceiling and the graph raises the
per-render cost.

## Objective D — Launch experience: itinerary and sensory identity

1. **Itinerary preview.** Expanding a journey shows a boarding card:
   its segments as stations — role, author/work, honest minutes per
   segment via `estimateCompiledDuration` (post-temporal-contract this
   is truthful), and a total. Point launches show a single honest
   duration on their button ("Enter · 4 min").
2. **Curated sensory identity.** Journeys and point launches carry
   explicit suggested configs in their handoff `config` (the SOL/Vault
   archetype precedent — explicit, visible, overridable in the
   orbital; never implied):
   - Philosophy: `soundscape: 'aurora'`, visuals blend of
     `harmonograph` (climate auto) + `aic-oldmasters`, modest
     frequency (≤0.15), `curve: 'flat'`.
   - History: `soundscape: 'faded-signal'`, visuals blend of
     `aic-portraits` + `aic-landscapes` + architectural `klee`,
     `curve: 'flat'`.
   Route them through the existing `loadText(config)` path; the
   orbital's panels must show them as they show archetype presets.
   Include `sourceFamily` explicitly on every config (post-family
   contract there are no implied mixtures).

## Objective E — Cross-domain echoes (content-gated, smallest slice)

Add an `echoes` cross-domain relation table as **draft editorial
content** (e.g., Stoic natural law ↔ rights declarations; a handful of
high-confidence pairs only). UI: a quiet "Echoes" row in the detail
aside linking to the other domain's record (switches domain, selects,
preserves state). If no reviewed echo exists for a record, the row is
absent. Do not force pairs — three to six excellent echoes beat twenty
plausible ones. These enter at `editorial` stage and are labeled as
such per the corpus's honesty rules.

## Guardrails

- The **handoff integrity machinery** (checksums, word counts,
  readiness evaluation, typed errors) may be *reused and extended*,
  never relaxed. No test may stub integrity checks to make a launch
  pass.
- The **approval contract** (`validate-specialist-review.js`) is
  untouched except for the corpus-version bump; `specialistSignoff`
  and decision records remain empty.
- Temporal contract, reading clock, presentation clock, safety
  controls (Phase 2): consume, never modify.
- The Atrium chunk stays lazy-loaded; keep the content pack inside it
  (report the new gzip size in your summary — growth is expected and
  acceptable, but it must be *known*).
- Design tokens only — no new colors outside the house palette; the
  Constellation must read as R.I.S.E., not as a graph library demo.

## Acceptance and handoff

1. New tests: coverage manifest assertion, point-handoff integrity
   (including a corrupted-checksum refusal), text/sources invariant,
   graph-view render (nodes + edges + selectable edge detail in
   jsdom), itinerary durations from the compiler, echoes navigation.
2. One new Playwright flow: seed the gate → Atrium → open a journey →
   launch → orbital shows the Atrium origin chip and the suggested
   config → Begin → exit → chip returns to the Atrium with domain and
   selection restored.
3. `npm run test:run`, `npm run build`, `npx playwright test` — all
   green at current counts plus yours.
4. **Leave everything uncommitted.** Summarize: files touched, tests
   added, coverage table (what launches, what is honestly blocked and
   why), new chunk size, anything discovered out of scope (report,
   don't fix).
