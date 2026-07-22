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

/**
 * Contemplative defaults, authored under the honest temporal contract:
 * ~240 wpm label, which Phrase mode + verse-paragraph structure
 * delivers in the 140-180 range that suits Scripture. Visuals stay
 * OFF until the Chapel's pinned imagery exists (stage 3) — stillness
 * is the correct default for this room, not a borrowed rotation.
 * Everything remains overridable in the orbital.
 */
export function chapelSensoryConfig() {
  return {
    wpm: 240,
    chunkMode: 'phrase',
    curve: 'flat',
    soundscape: 'aurora',
    visualConfig: {
      visualMode: 'off'
    }
  };
}

/**
 * Build the only supported Chapel -> Chamber handoff.
 *
 * @param {string} bookId - a CHAPEL_BOOKS id, e.g. 'psalms'
 * @param {object} [options] - { loadPayload } test seam for payload injection
 */
export async function createChapelHandoff(bookId, options = {}) {
  const book = findChapelBook(bookId);
  if (!book) {
    throw new ChapelHandoffError('CHAPEL_BOOK_NOT_FOUND', 'Chapel book does not exist.', { bookId });
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

  const translationLabel = `${CHAPEL_TRANSLATION.name} · ${CHAPEL_TRANSLATION.edition}`;

  return {
    text,
    source: `The Chapel · ${book.name}`,
    config: {
      ...chapelSensoryConfig(),
      sources: [{
        id: `chapel-${book.id}`,
        name: `${book.name} — ${translationLabel}`,
        type: 'text',
        providerId: 'chapel-corpus',
        chunkProfile: 'scripture',
        data: text,
        provenance: {
          kind: 'chapel-book',
          bookId: book.id,
          bookName: book.name,
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
          checksum: `sha256:${checksum}`
        }
      }],
      origin: {
        view: 'chapel',
        icon: '✛',
        name: 'Chapel',
        data: { bookId: book.id }
      },
      provenance: {
        kind: 'chapel-book',
        bookId: book.id,
        bookName: book.name,
        translationId: CHAPEL_TRANSLATION.id,
        translation: translationLabel
      }
    }
  };
}
