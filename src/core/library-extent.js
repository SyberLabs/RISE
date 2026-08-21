/**
 * Reading part of a work, and saying which part.
 *
 * A movement read its source whole, so the shortest reading the Scriptorium
 * could compose was the shortest work in the library — and below 5,539 words
 * that is exactly one work. Length was a filter over the catalogue rather than
 * a budget a score could spend.
 *
 * A work is already divided: every ingested text carries a division scheme
 * with a noun and entries. So a movement may name a division, and below a
 * division it may name that division's opening. The rung is always the
 * LARGEST honest unit that fits:
 *
 *   the whole work  →  a whole division  →  a division's opening
 *
 * Which is the same reverent degradation the imagery follows: never a broken
 * frame, always a smaller true thing. An opening is a real entry point a
 * reader could continue from, and it needs no seed to be reproducible.
 *
 * The extent rides in the SOURCE ID, so a score is self-describing: the same
 * program reads the same words on any day, at any slider position. It is
 * resolved into an ordinary source before anything downstream sees it, so the
 * chunker, the atoms and every media anchor are unchanged.
 */

// countWords USED TO BE DECLARED HERE TOO (law 5). It counted the same number
// as the chunker's for every string either could be handed, and coerced where
// the chunker's threw — one number, two contracts, and nothing but the import
// path to say which a caller had. The copy is gone; every extent-path caller
// imports the chunker's, which is where the atoms are counted from the same
// text.
import { SENTENCE_BOUNDARY, countWords } from './chunker.js';

/** Under this a passage is a fragment rather than an opening. */
export const EXTENT_MIN_WORDS = 40;

/**
 * How far past the asked-for length a boundary may sit and still be the
 * nearest one worth taking. Rounding to a sentence means overshooting
 * sometimes; it does not mean reading a whole chapter because the chapter
 * held no full stop.
 *
 * EXPORTED BECAUSE THREE PLACES SAY IT OUT LOUD. The prompt teaches a curator
 * to budget "#12:200" at 320 words, the refusal for a cut that cannot be
 * honoured explains the same multiple, and curator-prompt.js prices its own
 * worked example against it. Each of those carried a literal 1.6, so the
 * number that governs the cut and the number the reader is told could drift
 * apart with nothing to catch it.
 */
export const EXTENT_OVERSHOOT_LIMIT = 1.6;
const OVERSHOOT_LIMIT = EXTENT_OVERSHOOT_LIMIT;

const EXTENT_PATTERN = /^([^#]+)#(\d+)(?::(\d+))?$/u;

/**
 * Why an id that tries to name an extent was not read as one.
 *
 * These travel as codes rather than sentences: the phrasing belongs to the
 * gate, which is the surface that has to hand a curator something copyable.
 */
export const EXTENT_REFUSAL = Object.freeze({
  /** `work#12:20` — a cut below the floor is a fragment, not an opening. */
  FLOOR: 'below-floor',
  /** `work#0`, `work#two` — the shape is not one the grammar has. */
  GRAMMAR: 'malformed-extent'
});

/** Digits that are already how the number they denote is written. */
function isCanonicalOrdinal(digits) {
  return digits === undefined || digits === String(Number(digits));
}

/**
 * `work` · `work#12` · `work#12:200`
 *
 * An id with no `#` names a whole work: not an extent, and not an error. An
 * id that TRIES to name an extent and gets the grammar wrong is refused here
 * rather than handed back as a work id.
 *
 * Handing it back was a real defect: `spoon-river-anthology#50:37` returned
 * the whole string as `workId`, missed in the registry, and told the reader
 * the room does not hold Spoon River — while Spoon River stood in the same
 * catalogue. The problem was a 37-word cut against a 40-word floor, and that
 * is what the refusal now says.
 *
 * @returns {{ workId: string, division: number|null, words: number|null,
 *             refusal: string|null }}
 */
export function parseLibraryExtent(sourceId) {
  const id = String(sourceId || '');
  const match = EXTENT_PATTERN.exec(id);
  if (!match) {
    return id.includes('#')
      ? { workId: id, division: null, words: null, refusal: EXTENT_REFUSAL.GRAMMAR }
      : { workId: id, division: null, words: null, refusal: null };
  }
  const division = Number(match[2]);
  const words = match[3] === undefined ? null : Number(match[3]);
  // Ordinals are the reader's numbering, which starts at one.
  if (!Number.isInteger(division) || division < 1) {
    return { workId: id, division: null, words: null, refusal: EXTENT_REFUSAL.GRAMMAR };
  }
  // NORMALISING IS REPAIRING, and this gate does not repair (law 1). `\d+`
  // accepts `0040` and `Number()` silently makes it 40, so `#0` was refused
  // as grammar while `#0040` was corrected — the gate rewriting a model's
  // output, and a spelling that defeated PROGRAM_SOURCE_OWNERSHIP, which
  // refuses one source named by two movements. An id must spell the numbers
  // it means; the check is that each capture is already how JavaScript would
  // write the value it parses to, so any future normalisation is caught here
  // rather than discovered downstream.
  if (!isCanonicalOrdinal(match[2]) || !isCanonicalOrdinal(match[3])) {
    return { workId: id, division: null, words: null, refusal: EXTENT_REFUSAL.GRAMMAR };
  }
  if (words !== null && (!Number.isInteger(words) || words < EXTENT_MIN_WORDS)) {
    // The work and the division are still legible, and a refusal that can
    // name them is worth more than one that can only quote the whole string.
    return { workId: match[1], division, words: null, refusal: EXTENT_REFUSAL.FLOOR };
  }
  return { workId: match[1], division, words, refusal: null };
}

export function libraryExtentId(workId, division = null, words = null) {
  if (!division) return String(workId);
  return words ? `${workId}#${division}:${words}` : `${workId}#${division}`;
}

/**
 * Offsets where the text may honestly be cut, strongest class first.
 *
 * Verse, litanies and dialogue can run a whole division without a full stop
 * followed by a capital. A stanza break is a real boundary too, and a line
 * break after that; only text with none of them is cut between words.
 */
function boundaryOffsets(text) {
  const sentences = [];
  const finder = new RegExp(SENTENCE_BOUNDARY.source, 'gu');
  for (const match of text.matchAll(finder)) sentences.push(match.index);
  if (sentences.length) return { offsets: sentences, kind: 'sentence' };

  const paragraphs = [];
  for (const match of text.matchAll(/\n[ \t]*\n/gu)) paragraphs.push(match.index);
  if (paragraphs.length) return { offsets: paragraphs, kind: 'paragraph' };

  const lines = [];
  for (const match of text.matchAll(/\n/gu)) lines.push(match.index);
  if (lines.length) return { offsets: lines, kind: 'line' };

  const spaces = [];
  for (const match of text.matchAll(/\s+/gu)) spaces.push(match.index);
  return { offsets: spaces, kind: 'word' };
}

/**
 * The opening of `text`, cut at the boundary nearest `targetWords`.
 *
 * Nearest, not "at most": rounding down would end a passage a sentence short
 * of its own thought as often as not. The overshoot is capped so a division
 * without boundaries cannot return itself entire.
 *
 * WHEN THE FIRST HONEST BOUNDARY LIES PAST THE CAP, THIS REFUSES.
 * ───────────────────────────────────────────────────────────────
 * The cap used to read `words > ceiling && best`, which could not reject the
 * FIRST candidate — the only case a cap on overshoot was ever written for.
 * Measured: `ulysses#18:200` returned 5,714 words, Molly's soliloquy to its
 * first full stop and 28.6× what was asked for; `lyrical-ballads#42:200`
 * returned 336.
 *
 * A reader who asked for 200 words may be given 320 — that is what rounding
 * to a sentence costs, and OVERSHOOT_LIMIT is where this codebase drew that
 * line. They may not be given 5,714. The choice is between two wrong things:
 * a passage of a wildly different length, or nothing. RISE degrades
 * reverently everywhere else — a thing that will not resolve is absent,
 * never a substitute — so it is nothing, and the resolver reports the id as
 * refused rather than composing a reading nobody asked for.
 *
 * The cost of that choice was measured before it was made, and is measured
 * again on every run: over every division on the shelf, 2 refuse at a
 * 200-word ask and 1 at 500 or 2,000 — `ulysses#18` and `lyrical-ballads#42`,
 * named rather than counted in shelf-measurements.test.js. Ulysses is nearly
 * alone, and if it stops being so that test says which work joined it.
 *
 * @returns {{ text: string, words: number, boundary: string }|null}
 *   null when no boundary at or under the cap holds enough words to be an
 *   opening rather than a fragment.
 */
export function sentenceAlignedPrefix(text, targetWords) {
  // `String(text || '')` USED TO STAND HERE, and it made this entry answer
  // for a non-string: 42 became "42", one word, a whole reading. That is the
  // chunker's contract repaired at the door it was written to guard, and it
  // is also what made a duplicate counter invisible — a module that keeps the
  // chunker's import and declares its own coercing `countWords` beside it
  // counts every real string identically, so the only place the difference
  // can ever show is a non-string, and this swallowed them all. The extent
  // path's public entry now refuses one, out loud, in the chunker's words.
  const body = text;
  const target = Math.max(EXTENT_MIN_WORDS, Math.round(Number(targetWords) || 0));
  const total = countWords(body);
  if (!total || total <= target) return { text: body, words: total, boundary: 'whole' };

  const { offsets, kind } = boundaryOffsets(body);
  const ceiling = Math.round(target * OVERSHOOT_LIMIT);
  let best = null;
  let bestDistance = Infinity;
  for (const offset of [...offsets, body.length]) {
    const words = countWords(body.slice(0, offset));
    if (words < EXTENT_MIN_WORDS) continue;
    if (words > ceiling) break;
    const distance = Math.abs(words - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { offset, words };
    }
    // Offsets ascend, so once past the target nothing nearer follows.
    if (words >= target) break;
  }
  if (!best) return null;
  // The last candidate offered to the loop is the end of the text. Taking it
  // is taking the division entire, so it is named for what it is — this used
  // to be reported as an opening whose text happened to be the whole thing.
  if (best.offset >= body.length) return { text: body, words: total, boundary: 'whole' };
  return { text: body.slice(0, best.offset).trimEnd(), words: best.words, boundary: kind };
}

/**
 * The MOST an extent can read, decided before any text is loaded.
 *
 * The gate has to measure a score against the reader's length while holding
 * nothing but the catalogue, and an opening's exact length is a fact about
 * where the sentences fall. What can be proved from the catalogue alone is
 * the ceiling: sentenceAlignedPrefix returns either the whole division or a
 * cut no longer than OVERSHOOT_LIMIT × what was asked for. The budget spends
 * that ceiling, so a score it admits cannot read longer than it promised.
 *
 * The arithmetic lives here beside the cut it bounds; a second copy of
 * OVERSHOOT_LIMIT in the gate is exactly the drift this codebase keeps
 * paying for.
 *
 * @param {number} divisionWords words the whole division holds
 * @param {number|null} askedWords the `:N` in the id, if it carried one
 * @returns {number|null} null when the division's length is unknown
 */
export function extentReadingBound(divisionWords, askedWords = null) {
  if (!Number.isInteger(divisionWords) || divisionWords < 0) return null;
  if (!askedWords) return divisionWords;
  const target = Math.max(EXTENT_MIN_WORDS, Math.round(askedWords));
  if (divisionWords <= target) return divisionWords;
  return Math.min(divisionWords, Math.round(target * OVERSHOOT_LIMIT));
}

/**
 * THE LENGTH AN EXTENT NAMES, which is a different question from the most it
 * can read — and the two were one number answering both, badly.
 *
 * `extentReadingBound` is the CEILING: the most a cut can be handed, which is
 * what the atom ceiling has to be a bound over (see reading-limits.js). It is
 * not an estimate of what will be read. A `:200` ask on a long division is
 * bounded at 320 and the cutter aims at 200, so the bound over-states delivery
 * by about 1.6× on every opening that actually cuts — and by nothing at all on
 * a division shorter than the ask, which is read whole. Spending the ceiling
 * from the reader's length therefore made the shortfall depend on the SHAPE of
 * the shelf: over every division of the Tao at `:200` the charge came within
 * 2.3% of what arrived, and over Ovid's Metamorphoses it over-charged by a
 * third. A reader asking for ten minutes got five, and asking for one work got
 * ten minutes.
 *
 * This is the other number. A whole work or a whole division names its own
 * length; `#12:200` names two hundred words. That is what the reader's length
 * is spent against, and it is the best estimate of delivery the catalogue can
 * produce: an opening delivers the boundary nearest its ask.
 *
 * WHY THIS IS SAFE, AND WHY IT NEEDS NO SECOND CEILING. For every extent
 * `bound ≤ OVERSHOOT_LIMIT × nominal` — a whole division has bound = nominal,
 * and a cut has bound ≤ round(OVERSHOOT_LIMIT × ask) = round(OVERSHOOT_LIMIT ×
 * nominal). So a score whose NOMINAL total fits the reader's length has a
 * BOUND total inside OVERSHOOT_LIMIT × that length, without the gate checking
 * for it. The envelope is a consequence of the arithmetic rather than a second
 * rule that could drift from the first.
 *
 * IT TAKES THE BOUND, NOT THE DIVISION'S LENGTH, because the gate holds the
 * bound: `createCuratorSourceReader` reads the catalogue and reports
 * `extentReadingBound`. The two forms agree — where the division is no longer
 * than the ask the bound IS the division's length, and where it is longer the
 * bound exceeds the ask — so `min(bound, ask)` is `min(divisionWords, ask)`.
 * library-extent.test.js re-derives it from the division over every extent the
 * shelf can name and requires the two to be equal, so the identity is measured
 * rather than argued.
 *
 * @param {number|null} boundWords `extentReadingBound` for this extent
 * @param {number|null} askedWords the `:N` in the id, if it carried one
 * @returns {number|null} null when the length is unknown
 */
export function extentNominalWords(boundWords, askedWords = null) {
  if (!Number.isInteger(boundWords) || boundWords < 0) return null;
  if (!askedWords) return boundWords;
  return Math.min(boundWords, Math.max(EXTENT_MIN_WORDS, Math.round(askedWords)));
}

/**
 * Does this id provably name its division ENTIRE?
 *
 * `#12:79` against a 79-word division is the same passage as `#12`, because
 * `sentenceAlignedPrefix` returns the whole text when the text already fits.
 * Two spellings of one passage, and the gate has to know they are one — see
 * the ownership check in experience-program-io.js.
 *
 * PROVABLY, and no further. Where the division is longer than the ask the cut
 * lands somewhere the catalogue cannot see, so two asks that happen to reach
 * the same sentence are not knowable here and are not claimed. What IS knowable
 * is the case the bound already reports: `bound ≤ ask` holds exactly when the
 * division is no longer than the ask, since a longer division is charged more
 * than the ask by construction.
 */
export function extentReadsWholeDivision(boundWords, askedWords = null) {
  if (!Number.isInteger(boundWords) || boundWords < 0) return false;
  return extentNominalWords(boundWords, askedWords) === boundWords;
}

/**
 * What the reader is told they are reading.
 *
 * The name carries the location, everywhere the source appears — the rundown,
 * the Chamber, the Vault, an export. A part of a work must never present
 * itself as the work, which is the same rule every other work in RISE follows.
 */
export function extentSourceName({
  workTitle, noun, ordinal, divisionTitle, label, opening = false
}) {
  const work = String(workTitle || 'Untitled');
  if (!ordinal) return work;
  // The scheme's own label is the best name it has — "II. The Schools of Tea."
  // reads as the work's own numbering, where "Part 2" would be ours.
  const unit = divisionTitle || label || `${noun ? String(noun) : 'Part'} ${ordinal}`;
  return `${work} · ${String(unit).trim()}${opening ? ', opening' : ''}`;
}
