/**
 * A reading that brings its own presentation.
 *
 * Face, size and where the reading band sits are the READER's. They are
 * saved, and they are carried from one reading to the next, because they
 * are how that person can stand to read.
 *
 * A Keystone is the exception, and only because it is not really a
 * setting there: a Keystone is a composed piece, and part of what is
 * composed is how the text is set. Meditations wants a thick face at Fit
 * with one word holding the frame; it is not a Keystone if the reader
 * arrives at it in Crimson Pro at medium and has to be told to go and
 * change two settings first.
 *
 * THREE RULES HOLD THIS TO SOMETHING SMALL.
 *
 * Nothing is written back. The claim is a lens over the settings getter,
 * never a write: a reader who leaves a Keystone finds the size and the
 * face they chose, exactly as they left them, because those were never
 * touched. This is the whole reason it is done here and not by setting
 * the settings and putting them back afterwards, which is the same idea
 * with a crash in the middle of it.
 *
 * The reader still wins. A claimed key is the reading's OPENING
 * position, not a lock. The moment a reader reaches for one — the Size
 * control in the bar is right there — the claim on that key is released
 * for the rest of the session and their choice answers. A control that
 * is offered and does nothing is worse than one that is not offered.
 *
 * Only presentation. This cannot reach safety, audio, or anything a
 * reader has a right to decide once and never revisit. The list is
 * closed, and it is short.
 */

import { clampBandFraction, BAND_OFFSET_SETTING } from './band-offset.js';
import { resolveChamberStreamFace } from './chamber-stream-face.js';
import { persistFontSize } from './chamber-type-size.js';

/** The only settings a composed reading may open with. */
export const PRESENTATION_KEYS = Object.freeze([
  'chamberFace',
  'fontSize',
  BAND_OFFSET_SETTING
]);

/**
 * What a session actually claims, normalized, or null for the ordinary
 * case of a reading that claims nothing.
 *
 * Every value goes through the same resolver the setting itself uses, so
 * an authored typo cannot put a face or a size into the Chamber that a
 * reader could never have chosen.
 */
export function sessionPresentation(session) {
  const declared = session?.presentation;
  if (!declared || typeof declared !== 'object' || Array.isArray(declared)) return null;

  const claimed = {};
  if (declared.chamberFace != null) {
    claimed.chamberFace = resolveChamberStreamFace(declared.chamberFace);
  }
  if (declared.fontSize != null) {
    const size = persistFontSize(declared.fontSize);
    if (size) claimed.fontSize = size;
  }
  if (declared[BAND_OFFSET_SETTING] != null) {
    claimed[BAND_OFFSET_SETTING] = clampBandFraction(declared[BAND_OFFSET_SETTING]);
  }
  return Object.keys(claimed).length ? Object.freeze(claimed) : null;
}

/**
 * A settings reader that answers with the reading's presentation until
 * the reader takes a key back.
 *
 * @param {object} session the session being read
 * @param {() => object} readSettings the reader's own settings
 * @returns {{getSettings: () => object, release: (key: string) => void,
 *   claims: (key: string) => boolean}}
 */
export function createPresentationLens(session, readSettings) {
  const read = typeof readSettings === 'function' ? readSettings : () => ({});
  const claimed = sessionPresentation(session);
  const released = new Set();

  const holds = key => Boolean(claimed) && key in claimed && !released.has(key);

  return {
    getSettings() {
      const base = read() || {};
      if (!claimed) return base;
      const merged = { ...base };
      for (const key of Object.keys(claimed)) {
        if (!released.has(key)) merged[key] = claimed[key];
      }
      return merged;
    },
    release(key) {
      if (holds(key)) released.add(key);
    },
    claims: holds
  };
}
