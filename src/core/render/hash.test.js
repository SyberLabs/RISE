import { describe, expect, it } from 'vitest';
import { canonicalJson, contentHashOf, contentHashOfBytes, looksLikeUri, parseContentHash } from './hash.js';
import { RenderError } from './errors.js';

describe('render content hashing', () => {
  it('canonicalizes object key order so equivalent jobs hash identically', async () => {
    const left = { b: 2, a: { d: 4, c: 3 } };
    const right = { a: { c: 3, d: 4 }, b: 2 };
    expect(canonicalJson(left)).toBe(canonicalJson(right));
    expect(await contentHashOf(left)).toBe(await contentHashOf(right));
    expect(await contentHashOf(left)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('refuses malformed hashes and treats delivery URLs as non-identities', () => {
    expect(() => parseContentHash('sha256:deadbeef'))
      .toThrow(expect.objectContaining({ code: 'RENDER_HASH_FORMAT' }));
    expect(looksLikeUri('blob:https://rise.local/1')).toBe(true);
    expect(looksLikeUri('asset-rain-window')).toBe(false);
    expect(() => parseContentHash('not-a-hash')).toThrow(RenderError);
  });

  it('hashes admitted media bytes distinctly from canonical JSON of the same view', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const hashed = await contentHashOfBytes(bytes);
    expect(hashed).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(hashed).toBe(await contentHashOfBytes(bytes.buffer));
    expect(hashed).not.toBe(await contentHashOf(Array.from(bytes)));
  });
});
