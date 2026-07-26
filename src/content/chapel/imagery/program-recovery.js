import {
  isLaunchHeldFocal,
  normalizeReadingVisualIdentity
} from '../../../core/visual-identity.js';
import { normalizeVisualProgram } from '../../../core/visual-program.js';
import { collectionsForReading } from '../handoff.js';
import { compileVisualProgram } from './pericope-program.js';

const GOSPEL_BOOKS = new Set(['matthew', 'mark', 'luke', 'john']);
const GOSPEL_SOURCE_NAMES = Object.freeze({
  Matthew: 'matthew',
  Mark: 'mark',
  Luke: 'luke',
  John: 'john'
});

function canonicalGospelLocation({ provenance, origin, sources, textSource } = {}) {
  const provenanceCandidates = [
    provenance,
    ...(Array.isArray(sources) ? sources.map(source => source?.provenance) : [])
  ].filter(candidate => candidate?.kind === 'chapel-book');
  const candidates = origin?.view === 'chapel'
    ? [...provenanceCandidates, origin.data]
    : provenanceCandidates;
  for (const candidate of candidates) {
    const bookId = typeof candidate?.bookId === 'string'
      ? candidate.bookId.toLowerCase()
      : '';
    const chapter = Number(candidate?.chapter);
    if (GOSPEL_BOOKS.has(bookId) && Number.isInteger(chapter) && chapter > 0) {
      return { bookId, chapter };
    }
  }

  // Oldest orbital records predate bounded provenance but retain the exact
  // canonical source label written by createChapelHandoff.
  const sourceMatch = typeof textSource === 'string'
    ? /^The Chapel · (Matthew|Mark|Luke|John) ([1-9]\d*)$/.exec(textSource)
    : null;
  if (!sourceMatch) return null;
  return {
    bookId: GOSPEL_SOURCE_NAMES[sourceMatch[1]],
    chapter: Number(sourceMatch[2])
  };
}

/**
 * Reconstruct the schedule missing from orbital records written before
 * visualProgram persistence existed. This is deliberately Chapel-specific:
 * provenance identifies the content domain, which remains the sole author of
 * its episode schedule; the generic Orbital only asks for a recovery.
 */
export function recoverLegacyChapelVisualProgram({
  provenance = null,
  origin = null,
  sources = null,
  textSource = null,
  visualConfig = null
} = {}) {
  const location = canonicalGospelLocation({
    provenance,
    origin,
    sources,
    textSource
  });
  if (!location) return null;

  const mode = visualConfig?.visualMode;
  const focal = visualConfig?.focals;
  const heldFocal = mode === 'focals' && isLaunchHeldFocal(focal);
  const fallback = heldFocal
    ? { kind: 'focal', focal }
    : { kind: 'still' };
  // A true Icon locks the episode program. Rosa Mystica is a held focal too,
  // but the underlying program remains available when the reader releases it.
  const enabled = !(heldFocal && focal.type === 'icon');

  return normalizeVisualProgram(compileVisualProgram(
    location.bookId,
    location.chapter,
    fallback,
    enabled
  ));
}

/**
 * Restore the Scripture chunk-profile envelope needed to mint chapter/verse
 * coordinates. Very old orbital records retained only combined text; a
 * recovered schedule without this envelope would still have nothing to
 * observe.
 */
export function recoverLegacyChapelScriptureSources({
  provenance = null,
  origin = null,
  sources = null,
  textSource = null,
  text = null
} = {}) {
  const location = canonicalGospelLocation({
    provenance,
    origin,
    sources,
    textSource
  });
  if (!location) return Array.isArray(sources) ? sources : null;

  if (Array.isArray(sources) && sources.length) {
    return sources.map(source => ({
      ...source,
      chunkProfile: 'scripture'
    }));
  }
  if (typeof text !== 'string' || !text.trim()) return null;

  const canonicalProvenance = provenance?.kind === 'chapel-book'
    ? provenance
    : {
      kind: 'chapel-book',
      bookId: location.bookId,
      chapter: location.chapter
    };
  return [{
    id: `chapel-${location.bookId}-${location.chapter}`,
    name: textSource || `The Chapel · ${location.bookId} ${location.chapter}`,
    type: 'text',
    providerId: 'chapel-corpus',
    chunkProfile: 'scripture',
    data: text,
    provenance: canonicalProvenance
  }];
}

/**
 * Heal an ordinary Chapel reading saved before reading-owned collection
 * identity existed. This migration is intentionally conjunctive:
 *
 * 1. provenance must identify a non-program Chapel reading;
 * 2. current Chapel policy must explicitly assign collections there; and
 * 3. only exact assigned ids already present in the old effective selection
 *    are retained; absence is preserved as an empty (removed) selection.
 *
 * Merely being Scripture is never enough. In particular, a Gospel pericope
 * program is recovered by recoverLegacyChapelVisualProgram and never enters
 * this broad/ordinary collection path.
 */
export function recoverLegacyChapelCollectionIdentity({
  provenance = null,
  origin = null,
  visualConfig = null
} = {}) {
  const candidate = provenance?.kind === 'chapel-book'
    ? provenance
    : origin?.view === 'chapel'
      ? origin.data
      : null;
  const bookId = typeof candidate?.bookId === 'string'
    ? candidate.bookId.toLowerCase()
    : '';
  const chapterValue = Number(candidate?.chapter);
  const chapter = Number.isInteger(chapterValue) && chapterValue > 0
    ? chapterValue
    : null;
  if (!bookId) return null;

  const expected = collectionsForReading(bookId, chapter);
  if (!Array.isArray(expected) || expected.length === 0) return null;
  const sourced = visualConfig?.interlocution?.sourced;
  if (!Array.isArray(sourced)) return null;
  const activeExpected = expected.filter(id => sourced.includes(id));

  return normalizeReadingVisualIdentity({
    version: 1,
    domain: 'chapel',
    collections: activeExpected
  });
}
