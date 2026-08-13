/**
 * Content addressing for render jobs, source snapshots, and manifests.
 *
 * Hashes identify admitted bytes and canonical JSON. They are never editor
 * identity, and they never carry URIs or credentials.
 */

import { fail } from './errors.js';

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const HEX = Array.from({ length: 256 }, (_, index) => index.toString(16).padStart(2, '0'));

export function looksLikeUri(value) {
  if (typeof value !== 'string' || !value) return false;
  return /^(data:|blob:|https?:|javascript:)/i.test(value) || value.includes('://');
}

export function parseContentHash(value, path = '$.contentHash') {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    fail('RENDER_HASH_FORMAT', 'Expected a sha256:<64 hex> content hash', path, { value });
  }
  return value;
}

export function refuseUri(value, path) {
  if (typeof value === 'string' && looksLikeUri(value)) {
    fail('RENDER_URI_REFUSED', 'Render artifacts may not name URIs as identities', path, { value });
  }
  return value;
}

/**
 * Stable JSON for hashing: sorted object keys, arrays in authored order,
 * `undefined` omitted. Must not be used as a pretty-printer.
 */
export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out = {};
  for (const key of Object.keys(value).sort()) {
    const item = value[key];
    if (item === undefined) continue;
    out[key] = canonicalize(item);
  }
  return out;
}

export async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) {
    fail('RENDER_HASH_UNAVAILABLE', 'Web Crypto SHA-256 is unavailable', '$');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const view = new Uint8Array(digest);
  let hex = '';
  for (const byte of view) hex += HEX[byte];
  return hex;
}

export async function contentHashOf(value) {
  const text = typeof value === 'string' ? value : canonicalJson(value);
  const hex = await sha256Hex(new TextEncoder().encode(text));
  return `sha256:${hex}`;
}

/**
 * Hash admitted media bytes. Distinct from `contentHashOf`, which digests
 * canonical JSON / UTF-8 text — never use one where the other is owed.
 */
export async function contentHashOfBytes(bytes) {
  const view = bytes instanceof Uint8Array
    ? bytes
    : bytes instanceof ArrayBuffer
      ? new Uint8Array(bytes)
      : null;
  if (!view) {
    fail('RENDER_HASH_BYTES', 'Expected Uint8Array or ArrayBuffer media bytes', '$');
  }
  const hex = await sha256Hex(view);
  return `sha256:${hex}`;
}

export function hashesEqual(left, right) {
  return parseContentHash(left, '$.left') === parseContentHash(right, '$.right');
}
