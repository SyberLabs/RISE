import { describe, expect, it, vi } from 'vitest';
import { SourceCacheClass } from './cache.js';

describe('SourceCache degraded mode', () => {
  it('falls back to bounded memory storage when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const cache = new SourceCacheClass();
    cache.maxSize = 20;

    await cache.set('provider', 'item:with:colons', '0123456789');
    expect((await cache.getStats()).persistent).toBe(false);
    expect((await cache.getStats()).totalSize).toBeLessThanOrEqual(20);
    vi.unstubAllGlobals();
  });

  it('clears provider keys without splitting colon-bearing item ids', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const cache = new SourceCacheClass();
    await cache.set('provider', 'File:Example.svg', 'image');

    expect(await cache.clearProvider('provider')).toBe(1);
    expect(await cache.get('provider', 'File:Example.svg')).toBeNull();
    vi.unstubAllGlobals();
  });
});
