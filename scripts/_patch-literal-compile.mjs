import fs from 'node:fs';

function edit(p, pairs) {
    let s = fs.readFileSync(p, 'utf8');
    const crlf = s.includes('\r\n');
    s = s.replace(/\r\n/g, '\n');
    for (const [a, b] of pairs) {
        if (s.split(a).length !== 2) throw new Error(`not found exactly once: ${p}: ${a.slice(0, 80)}`);
        s = s.replace(a, () => b);
    }
    if (crlf) s = s.replace(/\n/g, '\r\n');
    fs.writeFileSync(p, s);
}

edit('src/core/session-compiler.js', [
[`import { chunkText, countWords, insertSourceScoreCuts } from './chunker.js';`,
 `import { chunkText, countWords, escapeLiteral, insertSourceScoreCuts, restoreLiteral } from './chunker.js';`],
[`        const raw = sourceText(source);
        if (raw.length > SESSION_LIMITS.maxTextCharacters) {`, `        // A LITERAL SOURCE is escaped here, once, so that every reader of \`raw\` below (the
        // chunker, the span aligner, the reading plan) sees text with nothing in it to
        // obey; the escape is one unit for one, so offsets are unchanged, and it is
        // undone where the reading is made (chunker) and where the text is kept.
        const literal = source.literal === true;
        const supplied = sourceText(source);
        const raw = literal ? escapeLiteral(supplied) : supplied;
        if (raw.length > SESSION_LIMITS.maxTextCharacters) {`],
[`            verseLines: source.verseLines === true,
            raw
        };`, `            verseLines: source.verseLines === true,
            ...(literal ? { literal: true } : {}),
            raw
        };`],
[`                verseLines: source.verseLines === true
            });`, `                verseLines: source.verseLines === true,
                literal: source.literal === true
            });`],
[`        value: new Map(sources.map(source => [source.id, source.raw])),`,
 `        value: new Map(sources.map(source => [source.id, source.literal ? restoreLiteral(source.raw) : source.raw])),`]
]);

edit('src/core/source-span.js', [
[`import { isDroppedWordToken, SOURCE_MARKER, SOURCE_SCORE_CUT } from './chunker.js';`,
 `import { isDroppedWordToken, restoreLiteral, SOURCE_MARKER, SOURCE_SCORE_CUT } from './chunker.js';`],
[`function alignmentTokens(text, omissions = []) {`, `function alignmentTokens(text, omissions = [], literal = false) {`],
[`        aligned.push({
          index: token.index,
          start: offset + match.index,
          end: offset + match.index + match[0].length,
          comparable: match[0]
        });`, `        aligned.push({
          index: token.index,
          start: offset + match.index,
          end: offset + match.index + match[0].length,
          // What an atom's words are compared with: for a literal source, what the author wrote.
          comparable: literal ? restoreLiteral(match[0]) : match[0],
          // What the chunker saw, which is what decided whether it kept the token.
          seen: match[0]
        });`],
[`export function alignSourceAtoms(text, atoms, path = '$.sources', { chunkProfile = null } = {}) {
  const omissions = prepareChunkText(text, chunkProfile).sourceOmissions || [];
  const tokens = alignmentTokens(text, omissions);`, `export function alignSourceAtoms(text, atoms, path = '$.sources', { chunkProfile = null, literal = false } = {}) {
  const omissions = prepareChunkText(text, chunkProfile).sourceOmissions || [];
  const tokens = alignmentTokens(text, omissions, literal === true);`],
[`      && tokens[cursor].comparable !== expected
      && isDroppedWordToken(tokens[cursor].comparable)) {`, `      && tokens[cursor].comparable !== expected
      && isDroppedWordToken(tokens[cursor].seen, literal === true)) {`],
// Span text: quotes and tokens are compared against what the author wrote.
[`export function sourceSpanCutPoints(program, source) {
  if (!source?.id || typeof source?.raw !== 'string') return Object.freeze([]);
  const offsets = new Set();`, `export function sourceSpanCutPoints(program, source) {
  if (!source?.id || typeof source?.raw !== 'string') return Object.freeze([]);
  const text = spanText(source);
  const offsets = new Set();`],
[`    if (quotationOnly && !normalizedIndex) {
      normalizedIndex = buildNormalizedSourceIndex(source.raw);
    }
    let span;
    try {
      span = resolveSourceSpan(clip.anchor, source.raw, path, { normalizedIndex });`, `    if (quotationOnly && !normalizedIndex) {
      normalizedIndex = buildNormalizedSourceIndex(text);
    }
    let span;
    try {
      span = resolveSourceSpan(clip.anchor, text, path, { normalizedIndex });`],
[`    span = assertResolvedTokenBoundary(span, source.raw, path, { snap: quotationOnly });
    if (span.fromCharacter > 0) offsets.add(span.fromCharacter);
    if (span.toCharacter < source.raw.length) offsets.add(span.toCharacter);`, `    span = assertResolvedTokenBoundary(span, text, path, { snap: quotationOnly });
    if (span.fromCharacter > 0) offsets.add(span.fromCharacter);
    if (span.toCharacter < text.length) offsets.add(span.toCharacter);`],
[`    if (quotationOnly && !normalizedBySource.has(sourceId)) {
      normalizedBySource.set(sourceId, buildNormalizedSourceIndex(source.raw));
    }

    let span;
    try {
      span = resolveSourceSpan(clip.anchor, source.raw, path, {`, `    const text = spanText(source);
    if (quotationOnly && !normalizedBySource.has(sourceId)) {
      normalizedBySource.set(sourceId, buildNormalizedSourceIndex(text));
    }

    let span;
    try {
      span = resolveSourceSpan(clip.anchor, text, path, {`],
[`    span = assertResolvedTokenBoundary(span, source.raw, path, { snap: quotationOnly });

    const matchedAtoms`, `    span = assertResolvedTokenBoundary(span, text, path, { snap: quotationOnly });

    const matchedAtoms`],
[`export function sourceSpanCutPoints(program, source) {`, `/**
 * The text a span is measured and quoted against. For a literal source the
 * compiler holds the escaped form; an author's quotation is of what they wrote,
 * and the two have the same length, so every offset means the same in both.
 */
function spanText(source) {
  return source.literal === true ? restoreLiteral(source.raw) : source.raw;
}

export function sourceSpanCutPoints(program, source) {`]
]);
