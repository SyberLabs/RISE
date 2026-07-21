# Atrium Chunk Profiles + Payload Loading

**Steering:** Fable 5 (architecture, review, commit)
**Implementation:** 5.6 sol
**Prerequisite:** none new — builds on committed `c7f3612`.
**Guardrail restated up front:** the global `chunker.js` temporal
contract (Phase 1) is frozen. This spec adds a *pre-chunk normalization
layer* and *per-source chunk options*; it does not alter how durations,
punctuation, or subdivision work.

---

## Findings that shape this spec (measured, not assumed)

- Payloads are **already lazy**: `handoff.js` is `await import`-ed in
  `app.js:279`, so the 560 KB `handoff-*.js` chunk loads only on
  launch. The browse experience is a 54 KB `Atrium-*.js` chunk that
  contains **zero** payload text (verified). **Objective B is therefore
  a refinement, not a rescue** — scope it accordingly.
- The Plato speaker-tag bug is real and reproduces exactly as the
  editor described. In Phrase mode, `SOCRATES:` splits into its own
  atom on the `:`; in continuous prose, `. THEAETETUS:` attaches the
  *next* speaker's label to the *previous* speaker's line. The label
  belongs at the **head** of the utterance that follows.

---

## Objective A — Chunk profiles (the real work)

A **chunk profile** is a named, declarative pre-processing step applied
to a source's raw text *before* the global chunker runs. It never
changes chunker internals; it shapes the input and may set per-source
chunk options.

### Contract
- New module `src/core/chunk-profiles.js`. A profile is:
  ```
  { id, description, prepare(rawText) -> { text, hints? } }
  ```
  `prepare` is pure, lossless in word content (a token-conservation
  test enforces this per profile), and returns normalized text plus
  optional `hints` (e.g. `forceBoundaryBefore` markers the chunker
  already respects, like a leading newline).
- `session-compiler.js` reads an optional `chunkProfile` id **per
  source** (sources already carry per-source fields). Resolution:
  `source.chunkProfile ?? config.chunkProfile ?? null`. When null,
  behavior is byte-identical to today (regression-tested).
- `chunker.js` change budget: **at most** accept an already-present
  hint mechanism. Prefer profiles that express intent through text the
  chunker already segments on (a newline before a speaker label makes
  the existing paragraph/line logic do the right thing) so the core
  needs **no** change. If a hint proves unavoidable, it is one
  additive, documented, default-off parameter — flag it in the summary
  for steering review before relying on it.

### The `dialogue` profile (ships in this spec)
Handles Jowett-style Platonic dialogue and any `SPEAKER:` transcript:
- Detect speaker labels: `/(^|\s)([A-Z][A-Z '.-]{1,30}):\s/` — an
  all-caps name (allowing spaces, apostrophes, periods) followed by a
  colon and space. Conservative by design; must not fire on ordinary
  mid-sentence capitalized words or `e.g.:`.
- Insert a paragraph break **before** each speaker label so the label
  begins the next unit, never trails the previous one. The label stays
  attached to its utterance.
- Lossless: every word of the source appears exactly once, speaker
  labels included, in original order.
- Verified against `pass-protagoras-measure` and `pass-plato-cosmos`
  (Timaeus, no speaker tags — must pass through unchanged).

### Assignment
The three affected packs carry `chunkProfile: 'dialogue'` on their
dialogue sources in the pack source records (content, not code). A pack
source with no profile behaves as today. **Do not** auto-detect at
runtime — assignment is editorial, explicit, and reviewable, consistent
with the corpus's provenance discipline.

### Non-goals
- No per-speaker coloring, no voice mapping (that is TTS, Phase 4).
- No profile may change durations or invent content. Normalization
  only: whitespace, boundary placement, and hint emission.

## Objective B — Payload loading refinement (light touch)

Because payloads are already lazy, this is optimization, not
restructuring:
1. Confirm and **lock** the separation with a build/size guard test:
   the browse-path modules (`Atrium.js`, `coverage.js`, `catalog.js`,
   corpus metadata) must not statically import any `packs/**/expanded-*`
   or `payloads` module. A test that walks the import graph (or asserts
   the built `Atrium-*` chunk excludes a known payload sentinel string)
   prevents future regressions where someone adds a static import and
   silently doubles the browse cost.
2. If — and only if — measurement shows the single `handoff-*` chunk is
   itself a launch-latency problem (it is one 560 KB module gating
   *any* launch), split payloads by domain so a philosophy launch does
   not download history payloads: `philosophy.js` and `history.js`
   payload maps become their own dynamic imports, resolved inside
   `handoff.js` by the journey's domain. Report the before/after
   per-domain launch transfer size. If the single chunk is not a real
   latency problem on a normal connection, **do not split** — note the
   measurement and stop. (Steering preference: don't add loader
   complexity to shave bytes nobody waits on.)

## Guardrails
- `chunker.js` temporal contract, presentation/reading clocks, safety
  controls, readiness gates, approval contract: all frozen.
- Profiles are lossless and pure; the compiler path with no profile is
  byte-identical to current output.
- No corpus/pack version bump is required for profile assignment
  (it changes presentation of already-audited text, not the text or its
  rights) — but if the audit records normalize speaker labels as part
  of the cleared text, confirm the profile's output still matches the
  recorded `payloadChecksum`. **If a profile would change a checksummed
  payload's bytes, the profile must run at *display* time only, never
  before the integrity check** — verify which side of the checksum the
  profile sits on and state it in the summary. This is the one subtle
  correctness question in the spec; get it right.

## Acceptance and handoff
1. Tests: dialogue-profile token conservation, the exact Plato
   speaker-head fix on `pass-protagoras-measure`, Timaeus pass-through
   unchanged, no-profile regression (byte-identical atoms), the
   browse/payload import-graph guard, and the checksum-side assertion
   from the guardrail.
2. One Playwright check (extend flow 10 or add): launch a dialogue pack
   in Phrase mode; assert the first atom of a speaker turn begins with
   the speaker label, not the previous line ending with it.
3. `npm run test:run`, `npm run build`, `npx playwright test` green at
   current counts plus yours; report the Atrium browse chunk size and,
   if split, per-domain launch sizes.
4. **Leave uncommitted for steering review.** Summarize files, tests,
   the checksum-side decision, and any measurement that argued for or
   against the Objective-B split.
