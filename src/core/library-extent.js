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

import { SENTENCE_BOUNDARY } from './chunker.js';

/** Under this a passage is a fragment rather than an opening. */
export const EXTENT_MIN_WORDS = 40;

/**
 * How far past the asked-for length a boundary may sit and still be the
 * nearest one worth taking. Rounding to a sentence means overshooting
 * sometimes; it does not mean reading a whole chapter because the chapter
 * held no full stop.
 */
const OVERSHOOT_LIMIT = 1.6;

const EXTENT_PATTERN = /^([^#]+)#(\d+)(?::(\d+))?$/u;

export function countWords(text) {
  return String(text || '').split(/\s+/u).filter(Boolean).length;
}

/**
 * `work` · `work#12` · `work#12:200`
 * @returns {{ workId: string, division: number|null, words: number|null }}
 */
export function parseLibraryExtent(sourceId) {
  const id = String(sourceId || '');
  const match = EXTENT_PATTERN.exec(id);
  if (!match) return { workId: id, division: null, words: null };
  const division = Number(match[2]);
  const words = match[3] === undefined ? null : Number(match[3]);
  // Ordinals are the reader's numbering, which starts at one.
  if (!Number.isInteger(division) || division < 1) {
    return { workId: id, division: null, words: null };
  }
  if (words !== null && (!Number.isInteger(words) || words < EXTENT_MIN_WORDS)) {
    return { workId: id, division: null, words: null };
  }
  return { workId: match[1], division, words };
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
 * @returns {{ text: string, words: number, boundary: string }}
 */
export function sentenceAlignedPrefix(text, targetWords) {
  const body = String(text || '');
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
    if (words > ceiling && best) break;
    const distance = Math.abs(words - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { offset, words };
    }
    // Offsets ascend, so once past the target nothing nearer follows.
    if (words >= target) break;
  }
  if (!best) return { text: body, words: total, boundary: 'whole' };
  return { text: body.slice(0, best.offset).trimEnd(), words: best.words, boundary: kind };
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
