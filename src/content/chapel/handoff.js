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
 * A stable seed from the book id — the same book always receives the
 * same rose window (fixed forms are fixed, even procedural ones).
 */
export function seedFromBook(bookId) {
  let hash = 0x811c9dc5;
  for (const ch of String(bookId || 'chapel')) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 8) & 0xffffff;
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
  // The Gospels carry NO whole-book painted default. Passion and
  // Crucifixion imagery belongs to the Passion narratives (chapter
  // mappings below) — draped over the Beatitudes, the parables, the
  // Bread of Life, it stops accompanying and starts editorializing.
  // Outside the mapped chapters the Gospels read under Rosa Mystica
  // (ROSE_BOOKS below): accompaniment where depiction would
  // overstate.
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
 * Chapter-level assignments follow the text itself — imagery attaches
 * to the narratives it depicts, never to a whole Gospel by default
 * (the 2026-07 review: Passion paintings over the Beatitudes turn
 * accompaniment into editorial interpretation):
 *   Matthew 1–2 infancy · 26–27 Passion (27 + Crucifixion) · 28 Resurrection
 *   Mark 14–15 Passion (15 + Crucifixion) · 16 Resurrection
 *   Luke 1–2 Annunciation/Nativity · 22–23 Passion (23 + Crucifixion) · 24 Resurrection
 *   John 18–19 Passion (19 + Crucifixion) · 20–21 Resurrection
 * All other Gospel chapters read under Rosa Mystica (the Gospels are
 * ROSE_BOOKS below).
 */
const CHAPTER_COLLECTIONS = Object.freeze({
  matthew: {
    1: ['chapel-nativity'], 2: ['chapel-nativity'],
    26: ['chapel-passion'], 27: ['chapel-passion', 'chapel-crucifixion'],
    28: ['chapel-resurrection']
  },
  mark: {
    14: ['chapel-passion'], 15: ['chapel-passion', 'chapel-crucifixion'],
    16: ['chapel-resurrection']
  },
  luke: {
    1: ['chapel-nativity'], 2: ['chapel-nativity'],
    22: ['chapel-passion'], 23: ['chapel-passion', 'chapel-crucifixion'],
    24: ['chapel-resurrection']
  },
  john: {
    18: ['chapel-passion'], 19: ['chapel-passion', 'chapel-crucifixion'],
    20: ['chapel-resurrection'], 21: ['chapel-resurrection']
  }
  // Baptism chapters (Mt 3, Mk 1, Lk 3) carried chapel-nativity by
  // name-stretch; they now fall to the Gospel default (Rosa Mystica)
  // until a true chapel-baptism collection is curated.
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
/**
 * The CONCEPTUAL books (SCRIPTURE-IMAGERY-CLASSIFICATION.md): law,
 * wisdom, and epistle — not depicted subjects. They read under ROSA
 * MYSTICA, the Chapel's procedural rose window (spec §6: procedural
 * forms accompany, never depict). Psalms keeps its DELIBERATE
 * stillness — the Psalter is prayed, not accompanied.
 */
const ROSE_BOOKS = new Set([
  'leviticus', 'deuteronomy', 'paralipomenon-1', 'paralipomenon-2', 'baruch',
  'proverbs', 'ecclesiastes', 'canticles', 'wisdom', 'ecclesiasticus',
  'romans', 'corinthians-1', 'corinthians-2', 'galatians', 'ephesians',
  'philippians', 'colossians', 'thessalonians-1', 'thessalonians-2',
  'timothy-1', 'timothy-2', 'titus', 'philemon', 'hebrews',
  'james', 'peter-1', 'peter-2', 'john-1', 'john-2', 'john-3', 'jude',
  // The Gospels outside their mapped narrative chapters: the rose
  // accompanies the teaching without depicting an event the chapter
  // does not hold (2026-07 review — whole-Gospel Passion was
  // editorial, not accompaniment)
  'matthew', 'mark', 'luke', 'john'
]);

export function chapelSensoryConfig(bookId = null, iconId = null, chapter = null) {
  const collections = collectionsForReading(bookId, chapter);

  // The Icon mode is a MODE: a chosen icon holds the Chamber's focal
  // and the reading proceeds around it — it wins over the book's
  // collections. "None" returns each book to its own imagery.
  // Everything remains overridable in the orbital. An icon id that
  // is not pinned is ignored — pinned, never improvised. The special
  // id 'rosa-mystica' chooses the rose window instead of an icon.
  // An icon id that is not pinned is ignored BEFORE any mode
  // decision — an ignored icon must behave exactly like no icon
  // (pinned, never improvised)
  if (iconId && iconId !== 'rosa-mystica' && !findChapelIcon(iconId)) iconId = null;
  const wantsRose = iconId === 'rosa-mystica'
    || (!iconId && !collections && ROSE_BOOKS.has(bookId));
  const visualConfig = wantsRose
    ? {
      visualMode: 'focals',
      // Seeded from the book so each epistle keeps its own window,
      // deterministically — the same book, the same glass, forever
      focals: { type: 'rose', petala: 12, seed: seedFromBook(bookId) }
    }
    : iconId
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
