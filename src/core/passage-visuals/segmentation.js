/**
 * Source preparation for passage-directed visuals.
 *
 * Deterministic blocks of roughly 150-250 words cover the exact source text
 * with no gaps or overlaps. Cuts prefer paragraph starts, then sentence
 * ends, then token starts; a token longer than the hard ceiling is cut at a
 * UTF-16 boundary that never splits a surrogate pair. Blocks group into
 * sections of at most eight blocks and 12,000 code units.
 *
 * Offsets stay here, in application code. Jev only ever sees block ids and
 * block text, and chooses among ids; it never names an offset.
 */

export const SEGMENTATION_VERSION = 1;
export const SEGMENTATION_LIMITS = Object.freeze({
  minWords: 150,
  maxWords: 250,
  maxBlockChars: 2000,
  maxSectionBlocks: 8,
  maxSectionChars: 12000
});

const PARAGRAPH_BREAK = /\n[^\S\n]*\n\s*/gu;
const SENTENCE_END = /[.!?…][)"'”’\]]*\s+/gu;
const TOKEN = /\S+/gu;

function wordCount(text, from, to) {
  const slice = text.slice(from, to);
  let count = 0;
  for (const _ of slice.matchAll(TOKEN)) count += 1;
  return count;
}

function cutsWithin(text, from, to, pattern) {
  const cuts = [];
  const slice = text.slice(from, to);
  for (const match of slice.matchAll(pattern)) {
    const at = from + match.index + match[0].length;
    if (at > from && at < to) cuts.push(at);
  }
  return cuts;
}

function spans(from, to, cuts) {
  const points = [from, ...cuts, to];
  const out = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    if (points[i + 1] > points[i]) out.push([points[i], points[i + 1]]);
  }
  return out;
}

/** Cut an overlong token at the ceiling without splitting a surrogate pair. */
function hardPieces(text, from, to, max) {
  const out = [];
  let start = from;
  while (to - start > max) {
    let cut = start + max;
    const code = text.charCodeAt(cut - 1);
    if (code >= 0xd800 && code <= 0xdbff) cut -= 1;
    out.push([start, cut]);
    start = cut;
  }
  out.push([start, to]);
  return out;
}

/** Finest units needed so that every unit fits the ceilings. */
function units(text, from, to, level = 0) {
  const { maxWords, maxBlockChars } = SEGMENTATION_LIMITS;
  const fits = to - from <= maxBlockChars && (level >= 2 || wordCount(text, from, to) <= maxWords);
  if (fits) return [[from, to]];
  if (level === 0) {
    return spans(from, to, cutsWithin(text, from, to, SENTENCE_END))
      .flatMap(([a, b]) => units(text, a, b, 1));
  }
  if (level === 1) {
    const starts = [];
    for (const match of text.slice(from, to).matchAll(TOKEN)) {
      if (match.index > 0) starts.push(from + match.index);
    }
    return spans(from, to, starts).flatMap(([a, b]) => units(text, a, b, 2));
  }
  return hardPieces(text, from, to, maxBlockChars);
}

/**
 * Segment exact source text into blocks and sections (pure, synchronous).
 * @param {string} text
 */
export function segmentSource(text) {
  const source = typeof text === 'string' ? text : '';
  if (!source.length) return { version: SEGMENTATION_VERSION, blocks: [], sections: [] };
  const { maxWords, maxBlockChars, maxSectionBlocks, maxSectionChars } = SEGMENTATION_LIMITS;
  const paragraphs = spans(0, source.length, cutsWithin(source, 0, source.length, PARAGRAPH_BREAK));
  const pieces = paragraphs.flatMap(([from, to]) => units(source, from, to));

  const blocks = [];
  let current = null;
  for (const [from, to] of pieces) {
    const words = wordCount(source, from, to);
    if (current && current.words + words <= maxWords && to - current.from <= maxBlockChars) {
      current.to = to;
      current.words += words;
      continue;
    }
    if (current) blocks.push(current);
    current = { from, to, words };
  }
  if (current) blocks.push(current);
  blocks.forEach((block, index) => { block.index = index; });

  const sections = [];
  let start = 0;
  let chars = 0;
  blocks.forEach((block, index) => {
    const size = block.to - block.from;
    if (index > start && (index - start >= maxSectionBlocks || chars + size > maxSectionChars)) {
      sections.push({ index: sections.length, start, end: index });
      start = index;
      chars = 0;
    }
    chars += size;
  });
  if (blocks.length) sections.push({ index: sections.length, start, end: blocks.length });
  sections.forEach(section => {
    section.from = blocks[section.start].from;
    section.to = blocks[section.end - 1].to;
  });
  return { version: SEGMENTATION_VERSION, blocks, sections };
}

/** Lowercase hexadecimal SHA-256 of the UTF-8 encoding of a string. */
export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The one canonical section digest shared by browser and Worker: SHA-256 of
 * the UTF-8 JSON serialization of the ordered array of [blockId, text] pairs.
 */
export function canonicalSectionDigest(blocks) {
  return sha256Hex(JSON.stringify(blocks.map(block => [block.id, block.text])));
}

/**
 * Segment and identify a source. Block ids derive from the source digest,
 * the exact block text, and its span, so any edit to the source changes
 * every id and invalidates scores and consent built on the old text.
 */
export async function prepareVisualSource(text) {
  const source = typeof text === 'string' ? text : '';
  const sourceDigest = await sha256Hex(source);
  const { blocks, sections } = segmentSource(source);
  const identified = await Promise.all(blocks.map(async block => ({
    ...block,
    id: `b${(await sha256Hex(
      `${SEGMENTATION_VERSION}\u0000${sourceDigest}\u0000${block.from}\u0000${block.to}\u0000${source.slice(block.from, block.to)}`
    )).slice(0, 20)}`
  })));
  return Object.freeze({
    version: SEGMENTATION_VERSION,
    sourceDigest,
    blocks: Object.freeze(identified.map(block => Object.freeze(block))),
    sections: Object.freeze(sections.map(section => Object.freeze(section)))
  });
}
