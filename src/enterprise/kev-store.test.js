// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { cacheKey, dropOtherRevisions, LoadFailure, storedFile } from './kev-store.js';

const BASE = 'https://huggingface.co/ai-ecoverse/kev.js/resolve/main/kev-4b';

function fakeCache() {
    const entries = new Map();
    return {
        entries,
        match: async (key) => (entries.has(key) ? new Response(entries.get(key)) : undefined),
        // Cache Storage drains the body itself; read it the same way.
        put: async (key, response) => { entries.set(key, await response.blob()); },
        delete: async (key) => entries.delete(key),
        keys: async () => [...entries.keys()].map(url => ({ url }))
    };
}

const bytesResponse = (length, init) => new Response(new Uint8Array(length).fill(7), init);

describe('Kev weights on disk', () => {
    it('streams a file into the cache, returns it as a Blob, and does not fetch it twice', async () => {
        const cache = fakeCache();
        const fetchFile = vi.fn(async () => bytesResponse(1000));
        const progress = [];
        const options = { rev: 'r1', bytes: 1000, file: 'data_1', fetchFile, onProgress: (update) => progress.push(update) };

        const first = await storedFile(cache, `${BASE}/data_1`, options);
        expect(first).toBeInstanceOf(Blob);
        expect(first.size).toBe(1000);
        expect(progress.at(-1)).toEqual({ file: 'data_1', loaded: 1000, total: 1000 });
        expect(cache.entries.has(cacheKey(`${BASE}/data_1`, 'r1'))).toBe(true);

        const second = await storedFile(cache, `${BASE}/data_1`, options);
        expect(second.size).toBe(1000);
        expect(fetchFile).toHaveBeenCalledTimes(1);
    });

    it('drops a cached file of the wrong size and fetches it again', async () => {
        const cache = fakeCache();
        cache.entries.set(cacheKey(`${BASE}/data_1`, 'r1'), new Blob([new Uint8Array(400)]));
        const fetchFile = vi.fn(async () => bytesResponse(1000));
        const blob = await storedFile(cache, `${BASE}/data_1`, { rev: 'r1', bytes: 1000, fetchFile });
        expect(blob.size).toBe(1000);
        expect(fetchFile).toHaveBeenCalledTimes(1);
    });

    it('refuses a download of the wrong size and keeps nothing', async () => {
        const cache = fakeCache();
        const fetchFile = async () => bytesResponse(999);
        await expect(storedFile(cache, `${BASE}/data_1`, { rev: 'r1', bytes: 1000, fetchFile }))
            .rejects.toMatchObject({ code: 'network' });
        expect(cache.entries.size).toBe(0);
    });

    it('reports an unreachable or failing host as a network failure', async () => {
        const cache = fakeCache();
        await expect(storedFile(cache, `${BASE}/a`, { rev: 'r1', fetchFile: async () => { throw new TypeError('offline'); } }))
            .rejects.toMatchObject({ code: 'network' });
        await expect(storedFile(cache, `${BASE}/a`, { rev: 'r1', fetchFile: async () => bytesResponse(1, { status: 404 }) }))
            .rejects.toMatchObject({ code: 'network' });
    });

    it('reports a full disk as storage, not network', async () => {
        const cache = { ...fakeCache(), put: async () => { throw new DOMException('full', 'QuotaExceededError'); } };
        const failure = await storedFile(cache, `${BASE}/a`, { rev: 'r1', fetchFile: async () => bytesResponse(10) }).catch(e => e);
        expect(failure).toBeInstanceOf(LoadFailure);
        expect(failure.code).toBe('storage');
    });

    it('deletes this model’s other revisions and nothing else', async () => {
        const cache = fakeCache();
        const keep = cacheKey(`${BASE}/data_1`, 'r2');
        const other = cacheKey(`${BASE}/data_1`, 'r1');
        const sibling = cacheKey(`${BASE}-small/data_1`, 'r1');
        for (const key of [keep, other, sibling]) cache.entries.set(key, new Blob([]));
        await dropOtherRevisions(cache, BASE, 'r2');
        expect([...cache.entries.keys()].sort()).toEqual([keep, sibling].sort());
    });
});
