/**
 * Stable source-span compilation for Experience Programs.
 *
 * Authored clips bind to source text, never atom ids. Character offsets use
 * JavaScript/editor UTF-16 code units; token offsets use half-open indexes
 * over non-whitespace source tokens. Endpoint quotations are mandatory and
 * are checked after whitespace normalization before any atom is annotated.
 */

const SOURCE_TOKEN = /\S+/gu;
const STRUCTURAL_MARKER = /^\[(?:PAUSE|FLASH|HOLD)\]$/i;
const VERSE_SENTINEL_OPEN = /^\[v$/i;
const VERSE_SENTINEL_CLOSE = /^\d+:\d+\]$/;
const MAX_COMPILED_SPAN_IDS = 1_536;

export class SourceSpanResolutionError extends Error {
  constructor(code, message, path = '$', details = {}) {
    super(`${message} (${path})`);
    this.name = 'SourceSpanResolutionError';
    this.code = code;
    this.path = path;
    this.details = details;
  }
}

const fail = (code, message, path, details) => {
  throw new SourceSpanResolutionError(code, message, path, details);
};

export function sourceTokens(text) {
  if (typeof text !== 'string') return [];
  return [...text.matchAll(SOURCE_TOKEN)].map((match, index) => ({
    index,
    value: match[0],
    start: match.index,
    end: match.index + match[0].length
  }));
}

/**
 * Expand a DOM character selection to complete whitespace tokens. Passage
 * media never divides a word: the smallest authored unit is one token.
 */
export function snapCharacterRangeToTokens(text, fromCharacter, toCharacter) {
  if (typeof text !== 'string' || !Number.isInteger(fromCharacter)
    || !Number.isInteger(toCharacter) || fromCharacter < 0
    || toCharacter <= fromCharacter || toCharacter > text.length) return null;
  const covered = sourceTokens(text).filter(token =>
    token.end > fromCharacter && token.start < toCharacter);
  if (!covered.length) return null;
  return Object.freeze({
    fromCharacter: covered[0].start,
    toCharacter: covered[covered.length - 1].end,
    fromToken: covered[0].index,
    toToken: covered[covered.length - 1].index + 1
  });
}

function assertResolvedTokenBoundary(span, text, path, { snap = false } = {}) {
  const snapped = snapCharacterRangeToTokens(
    text, span.fromCharacter, span.toCharacter);
  if (!snapped || snapped.fromCharacter !== span.fromCharacter
    || snapped.toCharacter !== span.toCharacter) {
    if (snap && snapped) {
      return Object.freeze({
        ...span,
        fromCharacter: snapped.fromCharacter,
        toCharacter: snapped.toCharacter,
        fromToken: snapped.fromToken,
        toToken: snapped.toToken
      });
    }
    fail('SOURCE_SPAN_TOKEN_BOUNDARY',
      'Passage media boundaries must fall between complete words', path, {
        fromCharacter: span.fromCharacter,
        toCharacter: span.toCharacter,
        snappedFromCharacter: snapped?.fromCharacter ?? null,
        snappedToCharacter: snapped?.toCharacter ?? null
      });
  }
  return span;
}

export function normalizeQuote(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : '';
}

/**
 * Build the whitespace-normalized search index for one source once.
 * Quotation clips then only pay indexOf — same memo shape as `aligned`
 * in compileSourceSpans (SCRIPTORIUM perf: do not rebuild per clip).
 *
 * @returns {{ text: string, normalized: string, map: number[] } | null}
 */
export function buildNormalizedSourceIndex(text) {
  if (typeof text !== 'string') return null;
  let normalized = '';
  /** @type {number[]} original UTF-16 index for each normalized character */
  const map = [];
  let pendingSpace = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || /\s/u.test(ch)) {
      if (normalized.length > 0) pendingSpace = true;
      continue;
    }
    if (pendingSpace) {
      normalized += ' ';
      map.push(i);
      pendingSpace = false;
    }
    normalized += ch;
    map.push(i);
  }
  return { text, normalized, map };
}

/** First normalized offset whose original index is >= fromOriginal. */
function normalizedOffsetAtOrAfter(map, fromOriginal) {
  const startAt = Math.max(0, fromOriginal | 0);
  if (startAt <= 0) return 0;
  let lo = 0;
  let hi = map.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (map[mid] < startAt) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Locate a whitespace-normalized needle using a prebuilt source index.
 * @returns {{ from: number, to: number } | null}
 */
export function findInNormalizedIndex(index, needle, fromOriginal = 0) {
  const target = normalizeQuote(needle);
  if (!target || !index?.normalized || !index?.map) return null;
  const startAt = normalizedOffsetAtOrAfter(index.map, fromOriginal);
  const at = index.normalized.indexOf(target, startAt);
  if (at < 0) return null;
  const from = index.map[at];
  const last = index.map[at + target.length - 1];
  if (from == null || last == null) return null;
  return { from, to: last + 1 };
}

/** Count non-overlapping occurrences of a normalized needle in the index. */
export function countInNormalizedIndex(index, needle) {
  const target = normalizeQuote(needle);
  if (!target || !index?.normalized) return 0;
  let count = 0;
  let from = 0;
  while (from <= index.normalized.length - target.length) {
    const at = index.normalized.indexOf(target, from);
    if (at < 0) break;
    count += 1;
    from = at + target.length;
  }
  return count;
}

/**
 * Find a whitespace-normalized needle inside original text; return the
 * UTF-16 half-open range covering the matched region, or null.
 * Prefer buildNormalizedSourceIndex + findInNormalizedIndex when scanning
 * the same source more than once.
 */
export function findNormalizedSubstring(text, needle, fromIndex = 0) {
  return findInNormalizedIndex(buildNormalizedSourceIndex(text), needle, fromIndex);
}

/**
 * Derive a character span from quote fingerprints alone (Scriptorium /
 * Live Curator). Returns null when either endpoint cannot be located —
 * absence, never a substitute.
 *
 * If quoteStart occurs more than once, refuses with SOURCE_SPAN_QUOTE_AMBIGUOUS
 * rather than silently binding the first hit (fail closed).
 *
 * @param {string} text
 * @param {string} quoteStart
 * @param {string} quoteEnd
 * @param {{ text: string, normalized: string, map: number[] } | null} [index]
 */
export function locateQuoteSpan(text, quoteStart, quoteEnd, index = null) {
  const start = normalizeQuote(quoteStart);
  const end = normalizeQuote(quoteEnd);
  if (!start || !end) return null;
  const idx = index?.normalized ? index : buildNormalizedSourceIndex(text);
  const occurrences = countInNormalizedIndex(idx, start);
  if (occurrences > 1) {
    fail('SOURCE_SPAN_QUOTE_AMBIGUOUS',
      `Opening quote occurs ${occurrences} times in this source; quote a phrase that appears once`,
      '$.anchor.quoteStart',
      { quoteStart: start, occurrences });
  }
  const open = findInNormalizedIndex(idx, start, 0);
  if (!open) return null;
  const close = findInNormalizedIndex(idx, end, open.from);
  if (!close) return null;
  const fromCharacter = open.from;
  const toCharacter = Math.max(close.to, open.to);
  if (toCharacter <= fromCharacter) return null;
  return Object.freeze({
    kind: 'character',
    fromCharacter,
    toCharacter,
    quoteStart: start,
    quoteEnd: end
  });
}

function isUtf16Boundary(text, offset) {
  if (offset <= 0 || offset >= text.length) return true;
  const before = text.charCodeAt(offset - 1);
  const after = text.charCodeAt(offset);
  return !(before >= 0xD800 && before <= 0xDBFF && after >= 0xDC00 && after <= 0xDFFF);
}

/** Resolve and integrity-check one validated authored span. */
export function resolveSourceSpan(anchor, text, path = '$.anchor', options = {}) {
  if (typeof text !== 'string') {
    fail('SOURCE_SPAN_TEXT_REQUIRED', 'A source span needs source text', path);
  }
  const hasCharacters = anchor?.fromCharacter !== undefined;
  const hasTokens = anchor?.fromToken !== undefined;
  const quotationOnly = !hasCharacters && !hasTokens
    && normalizeQuote(anchor?.quoteStart) && normalizeQuote(anchor?.quoteEnd);

  if (quotationOnly) {
    const located = locateQuoteSpan(
      text,
      anchor.quoteStart,
      anchor.quoteEnd,
      options.normalizedIndex || null
    );
    if (!located) {
      fail('SOURCE_SPAN_QUOTE_NOT_FOUND',
        'Quotation anchors must resolve against the supplied edition', path, {
          quoteStart: normalizeQuote(anchor.quoteStart),
          quoteEnd: normalizeQuote(anchor.quoteEnd)
        });
    }
    return resolveSourceSpan({
      ...anchor,
      fromCharacter: located.fromCharacter,
      toCharacter: located.toCharacter,
      quoteStart: located.quoteStart,
      quoteEnd: located.quoteEnd
    }, text, path, options);
  }

  if (!hasCharacters && !hasTokens) return null;
  if (hasCharacters && hasTokens) {
    fail('SOURCE_SPAN_AMBIGUOUS_RANGE',
      'A source span may use character or token coordinates, not both', path);
  }
  const from = hasCharacters ? anchor.fromCharacter : anchor.fromToken;
  const to = hasCharacters ? anchor.toCharacter : anchor.toToken;
  if (!Number.isInteger(from) || from < 0 || !Number.isInteger(to) || to <= from) {
    fail('SOURCE_SPAN_INVALID_RANGE',
      'A source span needs increasing, non-negative integer endpoints', path);
  }
  if (!normalizeQuote(anchor.quoteStart) || !normalizeQuote(anchor.quoteEnd)) {
    fail('SOURCE_SPAN_QUOTES_REQUIRED',
      'A source span needs opening and closing quote fingerprints', path);
  }

  const tokens = sourceTokens(text);
  let fromCharacter;
  let toCharacter;
  let fromToken;
  let toToken;

  if (hasCharacters) {
    fromCharacter = anchor.fromCharacter;
    toCharacter = anchor.toCharacter;
    if (toCharacter > text.length) {
      fail('SOURCE_SPAN_CHARACTER_BOUNDS',
        `Character span ends at ${toCharacter}, beyond source length ${text.length}`,
        `${path}.toCharacter`, { sourceLength: text.length });
    }
    if (!isUtf16Boundary(text, fromCharacter) || !isUtf16Boundary(text, toCharacter)) {
      fail('SOURCE_SPAN_UNICODE_BOUNDARY',
        'Character span may not split a Unicode surrogate pair', path);
    }
    const covered = tokens.filter(token => token.end > fromCharacter && token.start < toCharacter);
    fromToken = covered[0]?.index ?? null;
    toToken = covered.length ? covered[covered.length - 1].index + 1 : null;
  } else {
    fromToken = anchor.fromToken;
    toToken = anchor.toToken;
    if (toToken > tokens.length) {
      fail('SOURCE_SPAN_TOKEN_BOUNDS',
        `Token span ends at ${toToken}, beyond source token count ${tokens.length}`,
        `${path}.toToken`, { tokenCount: tokens.length });
    }
    fromCharacter = tokens[fromToken]?.start;
    toCharacter = tokens[toToken - 1]?.end;
  }

  if (!Number.isInteger(fromCharacter) || !Number.isInteger(toCharacter)
    || toCharacter <= fromCharacter) {
    fail('SOURCE_SPAN_EMPTY', 'Source span resolves to no source text', path);
  }

  const selected = normalizeQuote(text.slice(fromCharacter, toCharacter));
  const quoteStart = normalizeQuote(anchor.quoteStart);
  const quoteEnd = normalizeQuote(anchor.quoteEnd);
  if (!selected.startsWith(quoteStart)) {
    fail('SOURCE_SPAN_QUOTE_START_MISMATCH',
      'Opening quote fingerprint no longer matches the source span',
      `${path}.quoteStart`, { expected: quoteStart, actual: selected.slice(0, quoteStart.length) });
  }
  if (!selected.endsWith(quoteEnd)) {
    fail('SOURCE_SPAN_QUOTE_END_MISMATCH',
      'Closing quote fingerprint no longer matches the source span',
      `${path}.quoteEnd`, { expected: quoteEnd, actual: selected.slice(-quoteEnd.length) });
  }

  return Object.freeze({
    kind: hasCharacters ? 'character' : 'token',
    fromCharacter,
    toCharacter,
    fromToken,
    toToken,
    quoteStart,
    quoteEnd
  });
}

function comparableToken(value) {
  return String(value ?? '').replace(/\|/gu, '');
}

function alignmentTokens(text) {
  const raw = sourceTokens(text);
  const aligned = [];
  for (let i = 0; i < raw.length; i += 1) {
    if (VERSE_SENTINEL_OPEN.test(raw[i].value)
      && VERSE_SENTINEL_CLOSE.test(raw[i + 1]?.value ?? '')) {
      i += 1;
      continue;
    }
    const value = comparableToken(raw[i].value);
    if (value) aligned.push({ ...raw[i], comparable: value });
  }
  return aligned;
}

/**
 * Stamp compiled source coordinates onto the atoms produced from one source.
 * The alignment is exact over the source token stream, apart from the two
 * display-only transformations the chunker declares: bars and verse sentinels.
 */
export function alignSourceAtoms(text, atoms, path = '$.sources') {
  const tokens = alignmentTokens(text);
  let cursor = 0;
  let characterCursor = 0;

  for (let atomIndex = 0; atomIndex < atoms.length; atomIndex += 1) {
    const atom = atoms[atomIndex];
    const contentTokens = sourceTokens(typeof atom?.content === 'string' ? atom.content : '')
      .map(token => comparableToken(token.value))
      .filter(Boolean);

    if (contentTokens.length === 0) {
      const marker = atom?.tags?.find(tag => STRUCTURAL_MARKER.test(`[${tag}]`));
      const expectedMarker = marker ? `[${marker.toUpperCase()}]` : null;
      if (expectedMarker && tokens[cursor]?.comparable.toUpperCase() === expectedMarker) {
        const token = tokens[cursor++];
        atom.sourceCharacterStart = token.start;
        atom.sourceCharacterEnd = token.end;
        atom.sourceTokenStart = token.index;
        atom.sourceTokenEnd = token.index + 1;
        characterCursor = token.end;
      } else {
        const next = tokens[cursor];
        const point = next?.start ?? characterCursor;
        const tokenPoint = next?.index ?? sourceTokens(text).length;
        atom.sourceCharacterStart = point;
        atom.sourceCharacterEnd = point;
        atom.sourceTokenStart = tokenPoint;
        atom.sourceTokenEnd = tokenPoint;
      }
      continue;
    }

    const first = tokens[cursor];
    const matches = first && contentTokens.every((value, index) =>
      tokens[cursor + index]?.comparable === value);
    if (!matches) {
      fail('SOURCE_SPAN_ATOM_ALIGNMENT',
        `Compiled atom ${atomIndex} no longer aligns with its source text`,
        `${path}.atoms[${atomIndex}]`, {
          expected: contentTokens[0],
          actual: first?.comparable ?? null
        });
    }

    const last = tokens[cursor + contentTokens.length - 1];
    atom.sourceCharacterStart = first.start;
    atom.sourceCharacterEnd = last.end;
    atom.sourceTokenStart = first.index;
    atom.sourceTokenEnd = last.index + 1;
    cursor += contentTokens.length;
    characterCursor = last.end;
  }

  return atoms;
}

function atomIntersects(atom, span) {
  if (span.kind === 'character') {
    const from = atom?.sourceCharacterStart;
    const to = atom?.sourceCharacterEnd;
    if (!Number.isInteger(from) || !Number.isInteger(to)) return false;
    return from === to
      ? from >= span.fromCharacter && from < span.toCharacter
      : to > span.fromCharacter && from < span.toCharacter;
  }
  const from = atom?.sourceTokenStart;
  const to = atom?.sourceTokenEnd;
  if (!Number.isInteger(from) || !Number.isInteger(to)) return false;
  return from === to
    ? from >= span.fromToken && from < span.toToken
    : to > span.fromToken && from < span.toToken;
}

function authoredSpanAnchors(program) {
  const out = [];
  program?.tracks?.forEach((track, trackIndex) => {
    if (!['visual', 'audio', 'swell'].includes(track.kind)) return;
    track.clips.forEach((clip, clipIndex) => {
      const anchor = clip.anchor || {};
      const hasOffsets = anchor.fromCharacter !== undefined || anchor.fromToken !== undefined;
      const hasQuotes = normalizeQuote(anchor.quoteStart) && normalizeQuote(anchor.quoteEnd);
      if (!hasOffsets && !hasQuotes) return;
      out.push({
        clip,
        trackId: track.id,
        path: `$.tracks[${trackIndex}].clips[${clipIndex}].anchor`,
        quotationOnly: !hasOffsets && !!hasQuotes
      });
    });
  });
  return out;
}

/**
 * Resolve all media endpoints for one source before atomization. Quotation-
 * only misses retain the reader's existing soft-omission policy; explicit
 * coordinates fail closed. Returned offsets are exact token boundaries.
 */
export function sourceSpanCutPoints(program, source) {
  if (!source?.id || typeof source?.raw !== 'string') return Object.freeze([]);
  const offsets = new Set();
  let normalizedIndex = null;
  for (const { clip, path, quotationOnly } of authoredSpanAnchors(program)) {
    if (clip.anchor?.sourceIds?.[0] !== source.id) continue;
    if (quotationOnly && !normalizedIndex) {
      normalizedIndex = buildNormalizedSourceIndex(source.raw);
    }
    let span;
    try {
      span = resolveSourceSpan(clip.anchor, source.raw, path, { normalizedIndex });
    } catch (error) {
      if (quotationOnly && (error?.code === 'SOURCE_SPAN_QUOTE_NOT_FOUND'
        || error?.code === 'SOURCE_SPAN_QUOTE_AMBIGUOUS')) continue;
      throw error;
    }
    if (!span) continue;
    span = assertResolvedTokenBoundary(span, source.raw, path, { snap: quotationOnly });
    if (span.fromCharacter > 0) offsets.add(span.fromCharacter);
    if (span.toCharacter < source.raw.length) offsets.add(span.toCharacter);
  }
  return Object.freeze([...offsets].sort((left, right) => left - right));
}

/**
 * Verify every authored span against the supplied edition and compile its
 * coordinate space onto that source's atoms. Returns the resolved spans for
 * diagnostics and tests; the canonical program remains unchanged.
 *
 * Quotation-only anchors that cannot be located, or whose opening quote is
 * ambiguous, are omitted (reverent degradation) and listed under `omitted`;
 * character/token spans still refuse. Ambiguity is refused at import/accept
 * (where the curator can extend the quote); the reading must not die on it.
 */
export function compileSourceSpans(program, sources, atoms) {
  const authored = authoredSpanAnchors(program);
  if (authored.length === 0) {
    return Object.freeze({ resolutions: Object.freeze([]), omitted: Object.freeze([]) });
  }

  const sourceMap = new Map();
  for (const source of sources) {
    if (sourceMap.has(source.id)) {
      fail('SOURCE_SPAN_DUPLICATE_SOURCE',
        `Source id ${source.id} is not unique`, '$.sources', { sourceId: source.id });
    }
    sourceMap.set(source.id, source);
  }
  const atomsBySource = new Map();
  for (const atom of atoms) {
    if (!atomsBySource.has(atom.sourceId)) atomsBySource.set(atom.sourceId, []);
    atomsBySource.get(atom.sourceId).push(atom);
  }

  const aligned = new Set();
  /** @type {Map<string, ReturnType<typeof buildNormalizedSourceIndex>>} */
  const normalizedBySource = new Map();
  const resolutions = [];
  const omitted = [];
  for (const { clip, trackId, path, quotationOnly } of authored) {
    const sourceId = clip.anchor.sourceIds[0];
    const source = sourceMap.get(sourceId);
    if (!source) {
      fail('SOURCE_SPAN_SOURCE_NOT_FOUND',
        `No supplied source matches ${sourceId}`, path, { sourceId, clipId: clip.id });
    }
    const sourceAtoms = atomsBySource.get(sourceId) || [];
    if (!aligned.has(sourceId)) {
      alignSourceAtoms(source.raw, sourceAtoms, `$.sources[${sourceId}]`);
      aligned.add(sourceId);
    }
    if (quotationOnly && !normalizedBySource.has(sourceId)) {
      normalizedBySource.set(sourceId, buildNormalizedSourceIndex(source.raw));
    }

    let span;
    try {
      span = resolveSourceSpan(clip.anchor, source.raw, path, {
        normalizedIndex: normalizedBySource.get(sourceId) || null
      });
    } catch (error) {
      // Reader path: omit unresolvable quotation clips. Authoring-time
      // refusal of ambiguity lives in assertQuotationAnchorsAgainstSources.
      if (quotationOnly && (
        error?.code === 'SOURCE_SPAN_QUOTE_NOT_FOUND'
        || error?.code === 'SOURCE_SPAN_QUOTE_AMBIGUOUS'
      )) {
        omitted.push(Object.freeze({
          trackId, clipId: clip.id, sourceId, reason: error.code
        }));
        continue;
      }
      throw error;
    }
    if (!span) continue;
    span = assertResolvedTokenBoundary(span, source.raw, path, { snap: quotationOnly });

    const matchedAtoms = sourceAtoms.filter(atom => atomIntersects(atom, span));
    if (matchedAtoms.length === 0) {
      if (quotationOnly) {
        omitted.push(Object.freeze({
          trackId, clipId: clip.id, sourceId, reason: 'SOURCE_SPAN_NO_ATOMS'
        }));
        continue;
      }
      fail('SOURCE_SPAN_NO_ATOMS',
        `Span for ${clip.id} compiles to no playable atoms`, path,
        { sourceId, clipId: clip.id });
    }
    const spanId = `${trackId}:${clip.id}`;
    for (const atom of matchedAtoms) {
      const sameTrack = (atom.sourceSpanIds || [])
        .find(id => id.startsWith(`${trackId}:`));
      if (sameTrack && sameTrack !== spanId) {
        fail('SOURCE_SPAN_ATOM_CONFLICT',
          `Compiled atom ${atom.position} crosses two ${trackId} clips`, path, {
            atomPosition: atom.position,
            conflicts: [sameTrack, spanId]
          });
      }
      atom.sourceSpanIds = [...new Set([...(atom.sourceSpanIds || []), spanId])]
        .slice(0, MAX_COMPILED_SPAN_IDS);
    }
    resolutions.push(Object.freeze({
      spanId,
      trackId,
      clipId: clip.id,
      sourceId,
      fromAtom: matchedAtoms[0].position,
      toAtom: matchedAtoms[matchedAtoms.length - 1].position + 1,
      ...span
    }));
  }
  return Object.freeze({
    resolutions: Object.freeze(resolutions),
    omitted: Object.freeze(omitted)
  });
}

function sourceTextFromRecord(source) {
  if (typeof source?.raw === 'string') return source.raw;
  if (typeof source?.data === 'string') return source.data;
  if (typeof source?.text === 'string') return source.text;
  return null;
}

/**
 * Authoring-time check: quotation-only anchors against loaded edition text.
 * Ambiguous openings refuse so describeImportFailure can send "extend until
 * unique" back to the curator. Call this at import/accept — not at session
 * compile (compile omits instead; the reader is not the author).
 */
export function assertQuotationAnchorsAgainstSources(program, sources = []) {
  const sourceMap = new Map();
  for (const source of sources) {
    if (!source?.id) continue;
    const text = sourceTextFromRecord(source);
    if (typeof text === 'string') sourceMap.set(source.id, text);
  }
  /** @type {Map<string, ReturnType<typeof buildNormalizedSourceIndex>>} */
  const normalizedBySource = new Map();

  for (const { clip, path, quotationOnly } of authoredSpanAnchors(program)) {
    if (!quotationOnly) continue;
    const sourceId = clip.anchor.sourceIds[0];
    const text = sourceMap.get(sourceId);
    if (typeof text !== 'string') continue;
    if (!normalizedBySource.has(sourceId)) {
      normalizedBySource.set(sourceId, buildNormalizedSourceIndex(text));
    }
    try {
      locateQuoteSpan(
        text,
        clip.anchor.quoteStart,
        clip.anchor.quoteEnd,
        normalizedBySource.get(sourceId)
      );
    } catch (error) {
      if (error?.code === 'SOURCE_SPAN_QUOTE_AMBIGUOUS') {
        fail(
          error.code,
          `Opening quote occurs ${error.details.occurrences} times in this source; quote a phrase that appears once`,
          path,
          error.details
        );
      }
      // Not-found stays soft: omit at compile. Only ambiguity refuses here —
      // the curator can extend until unique; the reader cannot.
      if (error?.code === 'SOURCE_SPAN_QUOTE_NOT_FOUND') continue;
      throw error;
    }
  }
  return true;
}
