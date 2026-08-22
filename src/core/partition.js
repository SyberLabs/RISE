/**
 * The partition — one text, one ordered list of joints, three verbs.
 *
 * THE PHYSICS FIRST. The start of one part IS the end of the other. There are
 * not two ranges with a gap or an overlap between them; there is one number
 * they share, and sliding it lengthens one part and shortens the other in the
 * same motion. Everything here is pure: a record in, a record out, no DOM and
 * no store, so the behaviour a reader will feel under their finger is settled
 * before anything is drawn.
 *
 * This is deliberately NOT the Workshop's highlight. That paints character
 * spans for media assignment — spans that may overlap and may leave gaps, in
 * per-asset colours. A partition can do neither. Cloning that screen would
 * paint the wrong physics (SCRIPTORIUM-STRENGTHENING-SPEC §2.4).
 *
 * A JOINT MAY ONLY LAND ON A SNAP. Never mid-word, never inside a token the
 * word count would split. What counts as a snap is measured against real
 * files rather than assumed — see MAGNETS.
 */

import { countWords } from './chunker.js';
import {
  LOCAL_WORK_DEFAULT_NOUN,
  authorship,
  localWorkParts,
  validateLocalWork
} from './local-works.js';

/**
 * A BLANK LINE, WHICHEVER WAY THE FILE ENDS ITS LINES.
 *
 * Written `\n[ \t]*\n` first, which finds nothing at all in a CRLF file — the
 * `\r` sits between the two newlines and is neither a space nor a tab. Every
 * fixture in this tree uses LF, so the pattern was right about all of them
 * and wrong about the first real file it met: a book of poems in 105 blocks
 * reported zero paragraph breaks and one part.
 *
 * A source string rather than a literal, because it is used three ways and
 * three copies of a separator is how two of them end up disagreeing.
 */
const PARAGRAPH_BREAK = String.raw`\r?\n[ \t]*(?:\r?\n)+`;

/** Below this a snap is not worth offering: it makes a part of a line or two. */
const MIN_SNAP_WORDS = 8;

/**
 * A DATE LINE, conservatively.
 *
 * The divider cannot see this unit at all — it packs paragraphs toward a word
 * target — so a diary cuts through the middle of the next day's entry. The
 * snap must see what the chunker cannot.
 */
const DATE_LINE =
  /^(?:\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?|(?:mon|tues|wednes|thurs|fri|satur|sun)day\b.*|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:,?\s*\d{4})?)$/iu;

/**
 * A TITLE LINE — measured, not assumed.
 *
 * `paragraphIsHeading` wants ALL CAPS or an ordinal, and on a real book of
 * poems it fired ZERO times: 105 blocks, 97 of whose first lines read as
 * titles — Pyramid, Sycamore, Railroad — and not one of them shouting. A
 * reader's own file is where this rule came from, which is the only place a
 * rule about reader files can honestly come from.
 *
 * Conservative on purpose: a short line, no terminal punctuation, followed by
 * something. A line of verse that happens to be short is the false positive
 * this will make, and a reader joins it in one gesture.
 */
const TITLE_MAX_CHARS = 60;
const TITLE_MAX_WORDS = 9;

function looksLikeTitle(line) {
  const text = line.trim();
  if (!text || text.length > TITLE_MAX_CHARS) return false;
  if (/[.,;:!?]$/u.test(text)) return false;
  return countWords(text) <= TITLE_MAX_WORDS;
}

/**
 * The magnets, strongest first. A magnet is a line whose START is a joint
 * worth preferring over the ordinary paragraph break beside it.
 */
export const MAGNETS = Object.freeze([
  Object.freeze({ kind: 'date', test: line => DATE_LINE.test(line.trim()) }),
  Object.freeze({ kind: 'title', test: looksLikeTitle })
]);

function magnetKind(line) {
  return MAGNETS.find(magnet => magnet.test(line))?.kind || null;
}

/**
 * Every offset a joint may occupy, in order, each saying why it is one.
 *
 * `rungWords` is the reader's current length: a sentence start is only a snap
 * inside a paragraph too large to be a part on its own, because otherwise
 * every full stop in the work is a joint and the ghost becomes noise.
 */
export function snapPoints(text, { rungWords = 4000 } = {}) {
  const body = String(text ?? '');
  const points = [];
  const seen = new Set();
  const add = (offset, kind) => {
    if (offset <= 0 || offset >= body.length || seen.has(offset)) return;
    seen.add(offset);
    points.push({ offset, kind });
  };

  // A paragraph break is the first choice, and the line that opens the
  // paragraph decides whether it is merely a break or a magnet.
  for (const match of body.matchAll(new RegExp(PARAGRAPH_BREAK, 'gu'))) {
    const start = match.index + match[0].length;
    const line = body.slice(start, body.indexOf('\n', start) < 0
      ? body.length
      : body.indexOf('\n', start));
    add(start, magnetKind(line) || 'paragraph');
  }

  // Sentence starts, only where a paragraph is too big to be one part.
  let cursor = 0;
  for (const block of body.split(new RegExp(PARAGRAPH_BREAK, 'u'))) {
    if (countWords(block) > rungWords) {
      for (const match of block.matchAll(/(?<=[.!?]["')\]]?)\s+(?=[A-ZÁÉÍÓÚÑ¿¡"'(])/gu)) {
        add(cursor + match.index + match[0].length, 'sentence');
      }
    }
    cursor += block.length;
    const gap = body.slice(cursor).match(new RegExp(`^${PARAGRAPH_BREAK}`, 'u'));
    cursor += gap ? gap[0].length : 0;
  }

  return points.sort((left, right) => left.offset - right.offset);
}

/**
 * The snap a raw position means.
 *
 * A reader points at prose, not at an offset. `within` bounds how far a
 * pointer may be from a joint and still mean it — beyond that there is no
 * snap, and the caller shows no ghost rather than cutting somewhere the
 * reader did not indicate.
 */
export function nearestSnap(text, offset, { rungWords, within = Infinity, exclude = [] } = {}) {
  const taken = new Set(exclude);
  const candidates = snapPoints(text, { rungWords })
    .filter(point => !taken.has(point.offset));
  let best = null;
  for (const point of candidates) {
    const distance = Math.abs(point.offset - offset);
    if (distance > within) continue;
    if (!best || distance < best.distance) best = { ...point, distance };
  }
  return best;
}

/** The label a part takes when nobody has named it. */
function automaticLabel(text, cuts, index, noun) {
  const content = text.slice(cuts[index], cuts[index + 1]).trim();
  const first = content.split(/\r?\n/, 1)[0].trim();
  if (magnetKind(first)) return first;
  return `${noun} ${index + 1}`;
}

/** Is this the counted form — the one a renumber may rewrite? */
function isCounted(label, noun) {
  return new RegExp(`^${noun}\\s+\\d+$`, 'u').test(String(label ?? '').trim());
}

/**
 * Renumber the counted labels and leave every other one alone.
 *
 * A READER-TYPED LABEL IS NEVER REWRITTEN, and neither is one a magnet took
 * from the text: "Pyramid" describes the words under it, and those words did
 * not move because a joint three parts earlier did.
 */
function renumber(record, cuts, labels) {
  const noun = record.noun || LOCAL_WORK_DEFAULT_NOUN;
  return labels.map((label, index) => (
    isCounted(label, noun) ? `${noun} ${index + 1}` : label
  ));
}

function rebuilt(record, cuts, labels) {
  const named = renumber(record, cuts, labels);
  // Authorship is read off the names by the same function the draft uses, so
  // a record's `authored` can never disagree with the labels it describes.
  const next = { ...record, cuts, labels: named };
  return validateLocalWork({ ...next, ...authorship(next) });
}

/**
 * A JOINT NEVER LANDS INSIDE A WORD.
 *
 * Stated at the top of this file, and until now enforced only by the snap
 * resolution — which is to say, enforced whenever the caller remembered. An
 * invariant a caller can opt out of is a convention. The verbs check it
 * themselves so that a hand-written offset, a stored record from an older
 * build, and a dragged finger all obey the same rule.
 */
function splitsAWord(text, at) {
  return /\S/u.test(text[at - 1] || '') && /\S/u.test(text[at] || '');
}

/**
 * PLACE — a new joint, which makes one part into two.
 *
 * The part that gains a start gets the name; the part above it keeps its own,
 * because the reader cut the bottom off it and what is left is still what it
 * was called.
 */
export function placeJoint(record, offset) {
  validateLocalWork(record);
  const { text, cuts, labels } = record;
  const at = Number(offset);
  if (!Number.isInteger(at) || at <= 0 || at >= text.length) {
    return record;
  }
  if (cuts.includes(at)) return record;
  if (splitsAWord(text, at)) return record;

  const index = cuts.findIndex(cut => cut > at);
  const next = [...cuts.slice(0, index), at, ...cuts.slice(index)];
  const noun = record.noun || LOCAL_WORK_DEFAULT_NOUN;
  const nextLabels = [...labels];
  nextLabels.splice(index, 0, automaticLabel(text, next, index, noun));
  // The part above kept its words but not all of them; if its name was the
  // counted form it is still counted, and if it was a title it still opens
  // with that title.
  return rebuilt(record, next, nextLabels);
}

/**
 * SLIDE — move one interior joint. Two parts change in one motion.
 *
 * The joint index is one-based against the interior joints: joint 1 sits
 * between part 1 and part 2. There is no joint 0 and no joint at the end;
 * those are the ends of the text and are not the reader's to move.
 */
export function slideJoint(record, jointIndex, offset) {
  validateLocalWork(record);
  const { cuts, labels } = record;
  if (!Number.isInteger(jointIndex) || jointIndex < 1 || jointIndex > cuts.length - 2) {
    return record;
  }
  const at = Number(offset);
  const lower = cuts[jointIndex - 1];
  const upper = cuts[jointIndex + 1];
  if (!Number.isInteger(at) || at <= lower || at >= upper) return record;
  if (splitsAWord(record.text, at)) return record;

  const next = [...cuts];
  next[jointIndex] = at;
  const noun = record.noun || LOCAL_WORK_DEFAULT_NOUN;
  const nextLabels = labels.map((label, index) => {
    // A part whose OPENING moved re-reads its opening, unless a reader named
    // it. The part above only lost or gained a tail and keeps its name.
    if (index !== jointIndex || !isAutomatic(label, record, noun)) return label;
    return automaticLabel(record.text, next, index, noun);
  });
  return rebuilt(record, next, nextLabels);
}

/** Counted, or a magnet's own words — either way, nobody typed it. */
function isAutomatic(label, record, noun) {
  if (isCounted(label, noun)) return true;
  return Boolean(magnetKind(String(label ?? '')));
}

/**
 * JOIN — remove one joint, and the two parts either side become one.
 *
 * The upper part's name survives, because a reader joining downward is
 * extending the part they were reading rather than starting a new one.
 */
export function joinAt(record, jointIndex) {
  validateLocalWork(record);
  const { cuts, labels } = record;
  if (!Number.isInteger(jointIndex) || jointIndex < 1 || jointIndex > cuts.length - 2) {
    return record;
  }
  const next = cuts.filter((unused, index) => index !== jointIndex);
  const nextLabels = labels.filter((unused, index) => index !== jointIndex);
  return rebuilt(record, next, nextLabels);
}

/** NAME — a reader's own words, which no renumber may touch afterwards. */
export function relabel(record, partIndex, label) {
  validateLocalWork(record);
  const text = String(label ?? '').trim().slice(0, 90);
  if (!text || partIndex < 0 || partIndex >= record.labels.length) return record;
  const labels = [...record.labels];
  labels[partIndex] = text;
  const next = { ...record, labels };
  return validateLocalWork({ ...next, ...authorship(next) });
}

/**
 * Cut a whole text at every magnet of one kind.
 *
 * The gesture a reader would otherwise make a hundred times. It is offered
 * because the draft the divider produces on lyric verse is ONE part — the
 * work is under its word floor — and a hundred manual cuts is not review, it
 * is transcription.
 */
export function partitionByMagnet(record, kind) {
  validateLocalWork(record);
  const offsets = snapPoints(record.text)
    .filter(point => point.kind === kind)
    .map(point => point.offset);
  const cut = offsets.reduce((held, offset) => placeJoint(held, offset), record);

  // THE FIRST PART OPENS WITH A TITLE TOO. A draft of one part is named by
  // count — a first line describes a part only when there are several — and
  // once the cuts land that is no longer true of it. Only counted labels are
  // refreshed, so nothing a reader typed is touched.
  const noun = cut.noun || LOCAL_WORK_DEFAULT_NOUN;
  return validateLocalWork({
    ...cut,
    labels: cut.labels.map((label, index) => (
      isCounted(label, noun) ? automaticLabel(cut.text, cut.cuts, index, noun) : label
    ))
  });
}

/**
 * What the magnets can see, before anyone commits to them.
 *
 * The admit surface offers this as a sentence — "105 titles found" — because
 * a reader deciding whether to accept a hundred cuts wants the count first.
 */
export function describeMagnets(text, { rungWords } = {}) {
  const points = snapPoints(text, { rungWords });
  const counts = {};
  for (const point of points) counts[point.kind] = (counts[point.kind] || 0) + 1;
  return counts;
}

/** Parts with their word counts, for a readout that is not the prose. */
export function describePartition(record) {
  return localWorkParts(record).map((part, index) => ({
    ordinal: index + 1,
    label: part.label,
    words: countWords(part.content)
  }));
}

/**
 * The whole partition, laid out for a surface to draw — and no arithmetic left.
 *
 * A view that computes its own offsets is a second copy of the physics, and
 * the second copy is the one that will be wrong: it would have to know that a
 * snap is absolute into the whole text, that the first block of a part is the
 * part's own start and NOT a joint a reader may place, and that a sentence
 * snap falls inside a paragraph rather than at its head. Three chances to
 * disagree with this file. So the view receives blocks and hands back the
 * offset it was given, and every rule about where a joint may live stays here.
 *
 * Each block after the first in a part begins AT a snap, which is exactly the
 * offset `placeJoint` wants. The first carries `snap: null` — there is already
 * a joint there, and it is the one above it.
 */
export function layoutPartition(record, { rungWords } = {}) {
  validateLocalWork(record);
  const { text, cuts } = record;
  const interior = new Set(cuts.slice(1, -1));
  const points = snapPoints(text, { rungWords });

  return localWorkParts(record).map((part, index) => {
    const from = cuts[index];
    const to = cuts[index + 1];
    const inside = points
      .filter(point => point.offset > from && point.offset < to && !interior.has(point.offset))
      .map(point => point.offset);
    const edges = [from, ...inside, to];

    const blocks = [];
    for (let i = 0; i < edges.length - 1; i += 1) {
      const paragraphs = text.slice(edges[i], edges[i + 1])
        .split(new RegExp(PARAGRAPH_BREAK, 'u'))
        .map(block => block.trim())
        .filter(Boolean);
      if (!paragraphs.length) continue;
      blocks.push({
        offset: edges[i],
        snap: i === 0 ? null : (magnetKind(paragraphs[0].split(/\r?\n/, 1)[0].trim()) || 'paragraph'),
        paragraphs
      });
    }

    return { ordinal: index + 1, label: part.label, words: countWords(part.content), blocks };
  });
}
