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

export function normalizeQuote(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : '';
}

function isUtf16Boundary(text, offset) {
  if (offset <= 0 || offset >= text.length) return true;
  const before = text.charCodeAt(offset - 1);
  const after = text.charCodeAt(offset);
  return !(before >= 0xD800 && before <= 0xDBFF && after >= 0xDC00 && after <= 0xDFFF);
}

/** Resolve and integrity-check one validated authored span. */
export function resolveSourceSpan(anchor, text, path = '$.anchor') {
  if (typeof text !== 'string') {
    fail('SOURCE_SPAN_TEXT_REQUIRED', 'A source span needs source text', path);
  }
  const hasCharacters = anchor?.fromCharacter !== undefined;
  const hasTokens = anchor?.fromToken !== undefined;
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
      if (clip.anchor.fromCharacter === undefined && clip.anchor.fromToken === undefined) return;
      out.push({
        clip,
        trackId: track.id,
        path: `$.tracks[${trackIndex}].clips[${clipIndex}].anchor`
      });
    });
  });
  return out;
}

/**
 * Verify every authored span against the supplied edition and compile its
 * coordinate space onto that source's atoms. Returns the resolved spans for
 * diagnostics and tests; the canonical program remains unchanged.
 */
export function compileSourceSpans(program, sources, atoms) {
  const authored = authoredSpanAnchors(program);
  if (authored.length === 0) return [];

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
  const resolutions = [];
  for (const { clip, trackId, path } of authored) {
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
    const span = resolveSourceSpan(clip.anchor, source.raw, path);
    const matchedAtoms = sourceAtoms.filter(atom => atomIntersects(atom, span));
    if (matchedAtoms.length === 0) {
      fail('SOURCE_SPAN_NO_ATOMS',
        `Span for ${clip.id} compiles to no playable atoms`, path,
        { sourceId, clipId: clip.id });
    }
    // Runtime membership is compiled data, never a durable authoring
    // coordinate. It is useful to editors/diagnostics and survives Session
    // serialization without making the canonical score depend on atom ids.
    const spanId = `${trackId}:${clip.id}`;
    for (const atom of matchedAtoms) {
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
  return Object.freeze(resolutions);
}
