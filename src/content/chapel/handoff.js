/**
 * The Chapel -> Chamber boundary.
 *
 * Same discipline as the Atrium handoff: payload bytes are hashed
 * before they can enter a session, and a missing or altered payload is
 * a refusal, never a substitution. The Scripture corpus is immutable
 * content — a checksum mismatch means the text is not the text.
 *
 * Degradation is reverent (spec non-negotiable #5): every failure path
 * throws a typed error the caller renders as a quiet message. Nothing
 * in this module ever falls back to different text.
 */

import { CHAPEL_TRANSLATION, findChapelBook } from './corpus/manifest.js';
import { findChapelIcon } from './imagery/icons.js';

export class ChapelHandoffError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ChapelHandoffError';
    this.code = code;
    this.details = details;
  }
}

async function sha256Hex(text) {
  if (!globalThis.crypto?.subtle) {
    throw new ChapelHandoffError('CHAPEL_CRYPTO_UNAVAILABLE', 'SHA-256 is unavailable in this runtime.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');
}

function payloadExportName(bookId) {
  return `BOOK_${bookId.toUpperCase().replace(/-/g, '_')}`;
}

/** What a division of this book is called in its own tradition. */
export function chapterNoun(bookId) {
  return bookId === 'psalms' ? 'Psalm' : 'Chapter';
}

/**
 * Slice one chapter's verses out of a VERIFIED whole-book payload.
 *
 * The integrity contract is untouched: the checksum always covers the
 * full immutable payload, and this runs strictly after verification —
 * a chapter is a display-side selection, the same principle as the
 * scripture chunk profile. Slicing is by verse sentinel: everything
 * from `[v C:1]` up to the next chapter's first sentinel (or the end
 * of the book). A chapter that cannot be found in verified bytes is a
 * refusal, never an approximation.
 */
export function sliceChapter(text, chapter, bookId) {
  const start = text.indexOf(`[v ${chapter}:1] `);
  if (start < 0) {
    throw new ChapelHandoffError('CHAPEL_CHAPTER_NOT_FOUND', `${chapterNoun(bookId)} ${chapter} not found in ${bookId}.`, {
      bookId, chapter
    });
  }
  // End at the FIRST sentinel of any later chapter (not just C+1 verse 1)
  // so an unexpected verse numbering can never silently widen the slice.
  const nextChapter = new RegExp(`\\[v ${chapter + 1}:\\d+\\] `);
  const nextMatch = text.slice(start).match(nextChapter);
  const slice = (nextMatch
    ? text.slice(start, start + nextMatch.index)
    : text.slice(start)
  ).trimEnd();
  if (!slice) {
    throw new ChapelHandoffError('CHAPEL_CHAPTER_EMPTY', `${chapterNoun(bookId)} ${chapter} is empty in ${bookId}.`, {
      bookId, chapter
    });
  }
  return slice;
}

/**
 * Which pinned collections accompany a book's reading (spec §5):
 * the Gospels carry the Passion; the Apocalypse carries the
 * Resurrection. Every other book reads in stillness — no collection
 * is ever a default, and nativity/resurrection also serve the Rosary's
 * mysteries in stage 5. Seasonal assignments (Advent readings with
 * chapel-nativity) are a later, deliberate decision.
 */
const BOOK_COLLECTIONS = Object.freeze({
  matthew: ['chapel-passion', 'chapel-crucifixion'],
  mark: ['chapel-passion', 'chapel-crucifixion'],
  luke: ['chapel-passion', 'chapel-crucifixion'],
  john: ['chapel-passion', 'chapel-crucifixion'],
  apocalypse: ['chapel-resurrection'],

  // Painted collections (SCRIPTURE-IMAGERY-CLASSIFICATION.md,
  // DEPICTED class): where masterpieces are rich, they carry the
  // book — Rembrandt's Jeremiah for Jeremias, The Jewish Bride for
  // Genesis. Per the classification rule, a book carries paintings
  // OR the Doré cycle, never both at once.
  genesis: ['chapel-patriarchs'],
  exodus: ['chapel-patriarchs'],
  'kings-3': ['chapel-prophets'],
  'kings-4': ['chapel-prophets'],
  job: ['chapel-prophets'],
  isaias: ['chapel-prophets'],
  jeremias: ['chapel-prophets'],
  lamentations: ['chapel-prophets'],
  daniel: ['chapel-prophets'],
  jonas: ['chapel-prophets'],

  // The Doré cycle (CYCLE class): one engraved voice for the books
  // where painted collections are thin. Each book shows ONLY its own
  // plates.
  numbers: ['dore:numbers'],
  josue: ['dore:josue'],
  judges: ['dore:judges'],
  ruth: ['dore:ruth'],
  'kings-1': ['dore:kings-1'],
  'kings-2': ['dore:kings-1'],   // the Samuel/David plates span both
  'esdras-1': ['dore:esdras-1'],
  nehemias: ['dore:esdras-1'],   // the return-and-rebuilding plates serve both
  tobias: ['dore:tobias'],
  judith: ['dore:judith'],
  esther: ['dore:esther'],
  ezechiel: ['dore:ezechiel'],
  amos: ['dore:amos'],
  micheas: ['dore:micheas'],
  zacharias: ['dore:zacharias'],
  'machabees-1': ['dore:machabees-1'],
  'machabees-2': ['dore:machabees-1']
});

/**
 * Chapter-level overrides where the narrative is not the Passion:
 * the infancy narratives and the Baptism carry the Nativity; the
 * Resurrection chapters carry the Resurrection. Assignments follow
 * the text itself:
 *   Matthew 1–2 infancy, 3 Baptism · 28 Resurrection
 *   Mark 1 Baptism · 16 Resurrection
 *   Luke 1–2 Annunciation/Nativity, 3 Baptism · 24 Resurrection
 *   John 20–21 Resurrection (John has no infancy narrative;
 *     the Baptist's testimony in 1 stays with the book default)
 */
const CHAPTER_COLLECTIONS = Object.freeze({
  matthew: { 1: ['chapel-nativity'], 2: ['chapel-nativity'], 3: ['chapel-nativity'], 28: ['chapel-resurrection'] },
  mark: { 1: ['chapel-nativity'], 16: ['chapel-resurrection'] },
  luke: { 1: ['chapel-nativity'], 2: ['chapel-nativity'], 3: ['chapel-nativity'], 24: ['chapel-resurrection'] },
  john: { 20: ['chapel-resurrection'], 21: ['chapel-resurrection'] }
});

function collectionsForReading(bookId, chapter) {
  const perChapter = chapter != null ? CHAPTER_COLLECTIONS[bookId]?.[chapter] : null;
  return perChapter || BOOK_COLLECTIONS[bookId] || null;
}

/**
 * Contemplative defaults, authored under the honest temporal contract:
 * ~240 wpm label, which Phrase mode + verse-paragraph structure
 * delivers in the 140-180 range that suits Scripture. Books without an
 * assigned collection read in stillness (visualMode off) — stillness
 * is this room's default, never a borrowed rotation. Books WITH one
 * show museum works behind-stream at long presence (≥1400ms per spec:
 * museum stillness, not rhythmic flashing), sourced only — chapel-*
 * routing has no fallback. Everything remains overridable in the
 * orbital.
 */
export function chapelSensoryConfig(bookId = null, iconId = null, chapter = null) {
  const collections = collectionsForReading(bookId, chapter);

  // The Icon mode is a MODE: a chosen icon holds the Chamber's focal
  // and the reading proceeds around it — it wins over the book's
  // collections. "None" returns each book to its own imagery.
  // Everything remains overridable in the orbital. An icon id that
  // is not pinned is ignored — pinned, never improvised.
  if (iconId && !findChapelIcon(iconId)) iconId = null;
  const visualConfig = iconId
    ? {
      visualMode: 'focals',
      focals: { type: 'icon', iconId }
    }
    : collections
      ? {
        visualMode: 'interlocution',
        interlocution: {
          sourceFamily: 'collections',
          frequency: 0.12,
          duration: 1600,
          procedural: [],
          sourced: collections,
          // Drives the "From this reading" pills in the visual panel,
          // exactly as Atrium launches do — informational; `sourced`
          // already carries the collections and stays editable.
          atriumCollections: collections,
          responsive: false
        }
      }
      : {
        visualMode: 'off'
      };

  return {
    wpm: 240,
    chunkMode: 'phrase',
    curve: 'flat',
    // Rights-cleared chant exists (chants.js), so the room opens in
    // its own voice. Chant is offered, never imposed — the orbital
    // changes it in one click, and the fixed devotions (Rosary,
    // Stations) will still default to silence per the spec.
    soundscape: 'chant-gregorian',
    visualConfig
  };
}

/**
 * Build the only supported Chapel -> Chamber handoff.
 *
 * @param {string} bookId - a CHAPEL_BOOKS id, e.g. 'psalms'
 * @param {object} [options]
 *   - chapter: launch one chapter (1..book.chapters) instead of the
 *     whole book. The WHOLE payload is still checksum-verified first;
 *     the chapter is sliced from verified bytes.
 *   - loadPayload: test seam for payload injection
 */
export async function createChapelHandoff(bookId, options = {}) {
  const book = findChapelBook(bookId);
  if (!book) {
    throw new ChapelHandoffError('CHAPEL_BOOK_NOT_FOUND', 'Chapel book does not exist.', { bookId });
  }

  let chapter = null;
  if (options.chapter != null) {
    chapter = Number(options.chapter);
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
      throw new ChapelHandoffError('CHAPEL_CHAPTER_NOT_FOUND', `${chapterNoun(book.id)} ${String(options.chapter)} is outside ${book.name} (1–${book.chapters}).`, {
        bookId: book.id, chapter: options.chapter
      });
    }
  }

  const loadPayload = options.loadPayload || (async id => {
    const module = await import(`./corpus/books/${id}.js`);
    return module[payloadExportName(id)];
  });

  let text;
  try {
    text = await loadPayload(book.id);
  } catch (error) {
    throw new ChapelHandoffError('CHAPEL_PAYLOAD_UNAVAILABLE', `Payload module failed to load for ${book.id}.`, {
      bookId: book.id,
      cause: String(error?.message || error)
    });
  }
  if (typeof text !== 'string' || !text.trim()) {
    throw new ChapelHandoffError('CHAPEL_PAYLOAD_MISSING', `Payload is missing for ${book.id}.`, { bookId: book.id });
  }

  const checksum = await sha256Hex(text);
  if (checksum !== book.checksum) {
    throw new ChapelHandoffError('CHAPEL_PAYLOAD_INTEGRITY', `Payload checksum failed for ${book.id}.`, {
      bookId: book.id,
      expected: book.checksum,
      actual: checksum
    });
  }

  // The chapter is sliced ONLY from bytes that just verified.
  const sessionText = chapter == null ? text : sliceChapter(text, chapter, book.id);
  // "John 3", but "Psalm 23" — a Psalm is named by its own noun,
  // never "Psalms 23".
  const readingName = chapter == null
    ? book.name
    : book.id === 'psalms' ? `Psalm ${chapter}` : `${book.name} ${chapter}`;

  const translationLabel = `${CHAPEL_TRANSLATION.name} · ${CHAPEL_TRANSLATION.edition}`;

  return {
    text: sessionText,
    source: `The Chapel · ${readingName}`,
    config: {
      ...chapelSensoryConfig(book.id, options.iconId ?? null, chapter),
      sources: [{
        id: chapter == null ? `chapel-${book.id}` : `chapel-${book.id}-${chapter}`,
        name: `${readingName} — ${translationLabel}`,
        type: 'text',
        providerId: 'chapel-corpus',
        chunkProfile: 'scripture',
        data: sessionText,
        provenance: {
          kind: 'chapel-book',
          bookId: book.id,
          bookName: book.name,
          ...(chapter == null ? {} : { chapter, chapterNoun: chapterNoun(book.id) }),
          testament: book.testament,
          grouping: book.grouping,
          chapters: book.chapters,
          verses: book.verses,
          translationId: CHAPEL_TRANSLATION.id,
          translation: translationLabel,
          language: CHAPEL_TRANSLATION.language,
          rightsStatus: CHAPEL_TRANSLATION.rights,
          canonicalUrl: CHAPEL_TRANSLATION.sourceUrl,
          attribution: `${translationLabel} — ${CHAPEL_TRANSLATION.source}`,
          // Always the verified whole-book payload's checksum: chapter
          // launches inherit their integrity from the parent payload.
          checksum: `sha256:${checksum}`,
          checksumScope: 'book'
        }
      }],
      origin: {
        view: 'chapel',
        icon: '✛',
        name: 'Chapel',
        data: { bookId: book.id, ...(chapter == null ? {} : { chapter }) }
      },
      provenance: {
        kind: 'chapel-book',
        bookId: book.id,
        bookName: book.name,
        ...(chapter == null ? {} : { chapter }),
        translationId: CHAPEL_TRANSLATION.id,
        translation: translationLabel
      }
    }
  };
}
