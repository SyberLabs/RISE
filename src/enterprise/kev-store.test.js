// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { runMatches } from './device-model.js';
import { cacheKey, dropOtherRevisions, LoadFailure, pinnedFile, storedFile, UNPINNED, variantFiles } from './kev-store.js';

const COMMIT = 'c0ffee0123456789abcdef0123456789abcdef01';
const BASE = `https://huggingface.co/ai-ecoverse/kev.js/resolve/${COMMIT}/kev-4b`;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

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
const SEVENS = digest(new Uint8Array(1000).fill(7));

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

    it('verifies a download against its pinned digest and keeps a wrong one nowhere', async () => {
        const cache = fakeCache();
        const good = await storedFile(cache, `${BASE}/data_1`, { rev: 'r1', bytes: 1000, sha256: SEVENS, fetchFile: async () => bytesResponse(1000) });
        expect(good.size).toBe(1000);

        const wrong = fakeCache();
        const failure = await storedFile(wrong, `${BASE}/data_1`, {
            rev: 'r1', bytes: 1000, sha256: digest(new Uint8Array(1000).fill(8)), file: 'data_1', fetchFile: async () => bytesResponse(1000)
        }).catch(e => e);
        expect(failure).toBeInstanceOf(LoadFailure);
        expect(failure).toMatchObject({ code: 'digest', detail: 'data_1' });
        expect(wrong.entries.size).toBe(0);
    });

    it('refuses a download of the right digest but the wrong size', async () => {
        const cache = fakeCache();
        await expect(storedFile(cache, `${BASE}/data_1`, { rev: 'r1', bytes: 999, sha256: SEVENS, fetchFile: async () => bytesResponse(1000) }))
            .rejects.toMatchObject({ code: 'network' });
        expect(cache.entries.size).toBe(0);
    });

    it('re-hashes a cached file and fetches it again when the bytes do not match', async () => {
        const cache = fakeCache();
        const key = cacheKey(`${BASE}/data_1`, 'r1');
        cache.entries.set(key, new Blob([new Uint8Array(1000).fill(8)]));
        const fetchFile = vi.fn(async () => bytesResponse(1000));
        const blob = await storedFile(cache, `${BASE}/data_1`, { rev: 'r1', bytes: 1000, sha256: SEVENS, fetchFile });
        expect(fetchFile).toHaveBeenCalledTimes(1);
        expect(digest(new Uint8Array(await blob.arrayBuffer()))).toBe(SEVENS);

        const again = await storedFile(cache, `${BASE}/data_1`, { rev: 'r1', bytes: 1000, sha256: SEVENS, fetchFile });
        expect(again.size).toBe(1000);
        expect(fetchFile).toHaveBeenCalledTimes(1);
    });

    it('refuses a manifest that names the pinned checkpoint but is not the pinned bytes', async () => {
        const run = 'jaredpalmer/kev-4b@139fdd94f1b6a6ad80cc15e08fcb99cac885a101';
        const pinnedText = JSON.stringify({ run, variants: { q8f32: { model: 'a.onnx', data: [] } } });
        const servedText = JSON.stringify({ run, variants: { q8f32: { model: 'b.onnx', data: [] } } });
        const served = new TextEncoder().encode(servedText);
        expect(runMatches(JSON.parse(servedText).run, run)).toBe(true);
        const cache = fakeCache();
        await expect(storedFile(cache, `${BASE}/manifest.json`, {
            rev: COMMIT, bytes: served.length, sha256: digest(new TextEncoder().encode(pinnedText)), file: 'manifest.json',
            fetchFile: async () => new Response(served)
        })).rejects.toMatchObject({ code: 'digest', detail: 'manifest.json' });
        expect(cache.entries.size).toBe(0);
    });

    it('refuses an unpinned model by name, and a file the pin does not cover', () => {
        const unpinned = { label: 'Kev-4B', run: 'jaredpalmer/kev-4b@139fdd9', variant: 'q8f32' };
        const failure = (() => { try { pinnedFile(unpinned, 'manifest.json'); } catch (e) { return e; } })();
        expect(failure).toBeInstanceOf(LoadFailure);
        expect(failure).toMatchObject({ code: 'unpinned', detail: UNPINNED });
        expect(UNPINNED).toBe('weights are not pinned; run scripts/pin-kev-weights.mjs');

        const pinned = { ...unpinned, revision: COMMIT, base: BASE, files: { 'manifest.json': { bytes: 10, sha256: SEVENS } } };
        expect(pinnedFile(pinned, 'manifest.json')).toEqual({ bytes: 10, sha256: SEVENS });
        expect(() => pinnedFile(pinned, 'r-abc/q8f32/model.onnx')).toThrow(expect.objectContaining({ code: 'unpinned', detail: 'r-abc/q8f32/model.onnx' }));
    });

    it('lists every file a variant loads, in load order, and refuses a missing variant', () => {
        const manifest = {
            files: { tokenizer: 'tokenizer.json', tokenizer_config: 'tokenizer_config.json', head: 'r-abc/head.safetensors' },
            variants: { q8f32: { model: 'r-abc/q8f32/model.onnx', data: ['r-abc/q8f32/model.onnx_data_0', 'r-abc/q8f32/model.onnx_data_1'] } }
        };
        expect(variantFiles(manifest, 'q8f32')).toEqual([
            'tokenizer.json', 'tokenizer_config.json', 'r-abc/head.safetensors',
            'r-abc/q8f32/model.onnx', 'r-abc/q8f32/model.onnx_data_0', 'r-abc/q8f32/model.onnx_data_1'
        ]);
        expect(() => variantFiles(manifest, 'q4')).toThrow(expect.objectContaining({ code: 'wrong-model', detail: 'no variant q4' }));
    });

    it('frees a bundle’s files cached from the branch it was pinned from', async () => {
        const cache = fakeCache();
        const branch = cacheKey('https://huggingface.co/ai-ecoverse/kev.js/resolve/main/kev-4b/data_1', 'r1');
        const keep = cacheKey(`${BASE}/data_1`, COMMIT);
        const sibling = cacheKey('https://huggingface.co/ai-ecoverse/kev.js/resolve/main/kev-0.8b/data_1', 'r1');
        for (const key of [branch, keep, sibling]) cache.entries.set(key, new Blob([]));
        await dropOtherRevisions(cache, BASE, COMMIT);
        expect([...cache.entries.keys()].sort()).toEqual([keep, sibling].sort());
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
