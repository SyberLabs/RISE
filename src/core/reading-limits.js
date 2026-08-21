/**
 * Shared reading-size authority for Workshop acceptance and Session compile.
 *
 * Workshop is an authoring surface for Sessions. Vault acceptance must be a
 * subset of compile acceptance — a project that validates and saves must
 * compile without a limit refusal (ROADMAP Phase 0.4 finding #2).
 *
 * Every reading-size ceiling — and the pace window a reading is performed at
 * — lives here so Workshop and Session share one vocabulary.
 */

export const READING_LIMITS = Object.freeze({
  maxTextCharacters: 2_000_000,
  maxTotalChars: 2_000_000,
  maxSources: 64,
  maxSequenceAssets: 24,

  /**
   * The most atoms one compiled session may hold. An atom is not a word —
   * see MAX_SAFE_TARGET_WORDS below for the word budget this permits.
   */
  maxAtoms: 120_000,
  maxImageFileBytes: 8 * 1024 * 1024,
  // Sequence-local MP4 only. Kept below half the durable project budget so
  // one import cannot crowd every other authored asset out of the store.
  maxVideoFileBytes: 96 * 1024 * 1024,

  /**
   * Two URI ceilings for the same asset at different moments:
   *   maxInlineProjectImageUriChars — what may be written into project
   *     JSON / localStorage (small origin budget; larger bytes → IndexedDB).
   *   maxSequenceAssetUriChars — what an asset may carry at runtime after
   *     hydration (blob: or legacy data: already in hand).
   * Inline must never exceed runtime, or a project could persist what it
   * cannot later carry (asserted in workshop-media.test.js).
   */
  maxInlineProjectImageUriChars: 64 * 1024,
  maxSequenceAssetUriChars: 12 * 1024 * 1024,

  /**
   * How much a reader may say about a file they added.
   *
   * Here rather than in either module that needs it, because BOTH do and they
   * must not drift. The descriptor bounds the string on the way in
   * (visual-score-lane.js), and the capability document bounds it again on the
   * way out (curator-context.js, CURATOR_CONTEXT_LIMITS.maxDescriptionLength,
   * which is this number). Two ceilings kept equal by hand is how a room comes
   * to accept a description the document then refuses — and the refusal would
   * land at Prepare prompt, several steps from the field that caused it.
   */
  maxMaterialDescriptionChars: 400
});

/**
 * THE ONE PACE WINDOW, because there were four and they disagreed.
 *
 * 50–1000 is what the reading engine performs. It is the window the compiled
 * session normalizes to (SESSION_LIMITS), the window the Experience Program
 * validator refuses outside of, the window the chunker turns into a per-word
 * duration, the window the pacing engine holds a curve inside, and the window
 * the Chamber's ↑/↓ keys move a live reading through. ARCHITECTURE.md states
 * it as a hard limit, and curator-prompt.js tells a curator the same number.
 *
 * 100–500 was NOT a considered constraint. It is the `min`/`max` of the
 * `<input type="range">` in the Chamber's Temporal modal, present since the
 * initial commit, copied into workshop-project.js when the Workshop project
 * shipped and copied again into scriptorium-session.js to match it. No spec
 * argues a floor of 100 or a ceiling of 500; the one test that names them
 * (presets.test.js) justifies them as "the orbital's clamp" — the slider's
 * range, not the engine's. A slider offering a comfortable subrange is fine.
 * A normalizer silently rewriting a reader's 60 to 100 is not, because the
 * app accepts 60, stores 60, and then reads at 100.
 *
 * `default` is the pace of a reading that states none. It is not the app's
 * out-of-box preference (app.js owns that, and passes it to clampReadingWpm
 * as an explicit fallback), and it is not the temporal contract's 320 — that
 * is the compiler's honest-label default for an unspecified session config
 * (PHASE-2-SAFETY-SPEC), a different fact with a different argument.
 */
export const READING_PACE = Object.freeze({
  min: 50,
  max: 1000,
  default: 200
});

/**
 * A pace, or the fallback — never a floor-clamped zero.
 *
 * `Number(null)`, `Number('')` and `Number([])` are all 0, and 0 is finite, so
 * every clamp written as `Number.isFinite(Number(x)) ? clamp(x) : fallback`
 * turned an ABSENT setting into the slowest pace the window allows instead of
 * the default. That is how a stored `defaultWpm` of null became 50 in app.js
 * and 100 by the time the reading opened.
 */
export function clampReadingWpm(value, fallback = READING_PACE.default) {
  const parsed = typeof value === 'number'
    ? value
    : (typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(READING_PACE.min, Math.min(READING_PACE.max, Math.round(parsed)));
}

/**
 * THE DENSEST THING ON THE SHELF, measured rather than guessed at.
 *
 * A movement may name any division, so the worst reading a curator can compose
 * is one made entirely of the worst divisions — which makes the bound this
 * ceiling needs the worst ratio of any single DIVISION, not the average of a
 * work and not the average of the shelf.
 *
 * Book IV of the Analects is that division: 897 words of one-line sayings,
 * each its own paragraph, each paragraph costing an empty paragraph-break atom
 * of its own. The pair is recorded rather than the quotient so the claim can be
 * checked against the text: shelf-measurements.test.js re-measures every
 * division on the shelf with the real chunker and fails if any of them exceeds
 * MAX_WORDS_TO_ATOMS.
 */
export const WORST_MEASURED_DIVISION = Object.freeze({
  id: 'confucius-analects#4',
  words: 897,
  atoms: 953
});

/**
 * THE DENSEST THING THE EXTENT GRAMMAR CAN NAME, which is not a division.
 *
 * `ulysses#11:50` is a division's OPENING — a different string from the
 * division, with its own atoms-per-word ratio, and six of them compile denser
 * than MAX_WORDS_TO_ATOMS allows a division to. So the sentence "no unit a
 * curator may name exceeds MAX_WORDS_TO_ATOMS atoms per word" was false the
 * day the extent grammar was written; only the narrower claim about whole
 * divisions was ever measured.
 *
 * Recorded here as the pair rather than the quotient, for the same reason as
 * the division above: shelf-measurements.test.js re-cuts every opening the
 * grammar can name and fails if a denser one appears, naming it.
 *
 * That this exceeds MAX_WORDS_TO_ATOMS is not a breach of the reading ceiling
 * — see MAX_SAFE_TARGET_WORDS for what is actually proved and why.
 */
export const WORST_MEASURED_OPENING = Object.freeze({
  id: 'ulysses#11:50',
  words: 49,
  atoms: 58
});

/**
 * ROOM FOR THE SHELF TO GROW BEFORE THE GUARD HAS TO CATCH IT.
 *
 * The previous constant was 1.05 — a round number below the 1.0624 the
 * Analects already measured, which left the whole ceiling standing on 0.43%
 * of margin: a greedy fill by ratio reached 114,284 words and 119,483 atoms
 * against a 120,000 cap. One more Analects-shaped acquisition would have put
 * a score through the gate that throws at Begin, which is the exact failure
 * the ceiling was written to end.
 *
 * Eight per cent above the measured worst case covers a work denser in
 * paragraph breaks than anything held today. Past that the guard fires and
 * this is re-derived — the margin buys time, not silence.
 */
const ATOM_RATIO_HEADROOM = 1.08;

/**
 * ONE WORD IS NOT ONE ATOM, which is what the comment above maxAtoms used to
 * claim.
 *
 * Even in word chunking the chunker emits an empty paragraph-break atom
 * between paragraphs, so a reading of W words across P paragraphs compiles to
 * W + (P − 1) atoms. Rounded UP to the nearest thousandth, because rounding a
 * ceiling down is how the last one came to be exceeded.
 *
 * WHAT THIS BOUNDS IS A WORD OF BUDGET, NOT A WORD OF TEXT. See
 * MAX_SAFE_TARGET_WORDS: an opening can compile denser than this per word it
 * delivers (WORST_MEASURED_OPENING), and cannot per word it is charged.
 */
export const MAX_WORDS_TO_ATOMS = Math.ceil(
  (WORST_MEASURED_DIVISION.atoms / WORST_MEASURED_DIVISION.words)
  * ATOM_RATIO_HEADROOM * 1_000
) / 1_000;

/**
 * The largest reading length a curator may be given as a budget.
 *
 * A word budget equal to the atom cap is a promise no session can keep: a
 * 118,695-word score passed the Scriptorium gate and then threw at Begin with
 * 121,617 atoms, telling the reader to "choose Phrase or Sentence chunking"
 * in a room that has no chunk-mode control. The gate refuses such a score
 * here instead, and the room's length slider is capped against this constant
 * so the reader cannot ask for a length that cannot be read.
 *
 * WHAT IS ACTUALLY PROVED, AND WHAT THE ARGUMENT USED TO SAY.
 * ──────────────────────────────────────────────────────────
 * The claim here was "because MAX_WORDS_TO_ATOMS bounds the worst single
 * division, no arrangement of divisions adding to this many words can exceed
 * the atom cap: a weighted mean of ratios cannot exceed the largest of them."
 * That is a true statement about DIVISIONS, and a curator does not only name
 * divisions. A movement may name a division's opening, which is a different
 * string with its own ratio, and six openings on today's shelf compile denser
 * than MAX_WORDS_TO_ATOMS (WORST_MEASURED_OPENING is the worst at 1.1837).
 * The mean-of-ratios argument does not reach them, so it was never the
 * argument that made this ceiling safe.
 *
 * What makes it safe is that the budget and the compiler count different
 * things, and the budget counts more:
 *
 *   1. The budget charges an extent `extentReadingBound` — a whole division
 *      its own length, an opening `min(divisionWords, OVERSHOOT_LIMIT × ask)`.
 *      Across every extent the grammar can name on this shelf, no cut delivers
 *      more words than it was charged.
 *   2. Atoms per CHARGED word therefore never exceeds the ratio of the cut,
 *      and for an opening it is far below it: an opening asked at 50 words is
 *      charged 80, so even a 1.1837 ratio costs 0.72 atoms per charged word.
 *   3. The densest thing per charged word is consequently a whole division
 *      read whole, where charge and delivery are the same number — which is
 *      exactly what MAX_WORDS_TO_ATOMS bounds.
 *
 * So the ceiling stands on a bound over atoms per word of BUDGET, and the
 * per-extent version of that bound is what shelf-measurements.test.js
 * measures: every extent, at every ask the grammar admits, against this
 * constant, plus the greedy worst-case fill the cap has to survive.
 */
export const MAX_SAFE_TARGET_WORDS = Math.floor(READING_LIMITS.maxAtoms / MAX_WORDS_TO_ATOMS);
