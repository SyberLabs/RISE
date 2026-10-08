/**
 * What every strict validator of a model's composition shares: the error with
 * a code and a path, and the primitives that refuse rather than coerce.
 *
 * rise-current.js (the Current) and beats.js (its beats and scenes) both build
 * on these; neither imports the other's helpers, so neither depends on the
 * other at load.
 */
import { SOURCE_MARKER, SOURCE_SCORE_CUT, hasLiteralForbidden } from './chunker.js';

export class RiseCurrentError extends Error {
  constructor(code, path, message) {
    super(`${message} (${path})`);
    this.name = 'RiseCurrentError';
    this.code = code;
    this.path = path;
  }
}

export const fail = (code, path, message) => { throw new RiseCurrentError(code, path, message); };

export function object(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    fail('CURRENT_OBJECT', path, 'Expected a plain object');
  }
  return value;
}

export function keys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) {
      // The name is the author's: bounded before it is echoed back to them.
      fail('CURRENT_UNKNOWN_FIELD', `${path}.${key.slice(0, 40)}`, `Unknown field: ${key.slice(0, 40)}`);
    }
  }
}

export function label(value, max, path, code = 'CURRENT_TEXT') {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    fail(code, path, `Expected nonblank text of at most ${max} characters`);
  }
  return value;
}

export function id(value, max, path) {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > max) {
    fail('CURRENT_ID', path, `Expected a trimmed id of at most ${max} characters`);
  }
  return value;
}

/** True when text contains a playback marker the chunker would read as an instruction. */
export function hasReservedMarker(text) {
  return new RegExp(SOURCE_MARKER.source, 'i').test(text)
    || text.includes(SOURCE_SCORE_CUT) || text.includes('|');
}

export { hasLiteralForbidden };

/** Text meant to be heard or shown: nonblank, bounded, and free of what the chunker would obey. */
export function spokenText(value, max, path) {
  const text = label(value, max, path);
  if (hasReservedMarker(text)) fail('CURRENT_RESERVED_TEXT', path, 'Text contains a reserved playback marker');
  return text;
}
