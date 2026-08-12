// @vitest-environment node
//
// NODE, NOT JSDOM, AND THE REASON IS THE SUBJECT OF THE TEST. jsdom's Blob
// implements neither `arrayBuffer()` nor `text()`, and fake-indexeddb's
// structured clone hands it back as a plain object — so a "round trip" in
// jsdom would assert that metadata survived while quietly losing the bytes,
// which is the one thing these tests exist to prove. Node's Blob clones
// intact. The store touches no DOM; only `URL.createObjectURL` is needed,
// and that is stubbed below in either environment.

/**
 * The durable store itself, exercised against a real IndexedDB.
 *
 * Every other test of this subsystem mocks `WorkshopMedia` wholesale —
 * `vi.spyOn(WorkshopMedia, 'put').mockResolvedValue(...)` — which tests the
 * plumbing around the store and never the store. Three hundred lines of
 * transaction handling, a byte budget, an upgrade path and an object-URL
 * lifecycle had no coverage at all, and the thing they protect is the
 * reader's own images.
 *
 * `fake-indexeddb` is a real IDB implementation, so these are round trips:
 * bytes go in and the same bytes come out, or the test fails.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkshopMediaStore, WorkshopMediaError, dataImageUriToBlob } from './workshop-media.js';
import { READING_LIMITS } from './reading-limits.js';

// jsdom implements neither half of the object-URL API. The store's contract
// is that it mints one per asset, caches it, and revokes on replace/delete —
// which is observable through these counters.
let minted = 0;
let revoked = [];

beforeEach(() => {
    minted = 0;
    revoked = [];
    globalThis.URL.createObjectURL = vi.fn(() => `blob:https://rise.test/object-${++minted}`);
    globalThis.URL.revokeObjectURL = vi.fn((url) => revoked.push(url));
});

afterEach(() => {
    delete globalThis.URL.createObjectURL;
    delete globalThis.URL.revokeObjectURL;
});

/** A store on its own database, so tests cannot see each other's records. */
async function freshStore() {
    const store = new WorkshopMediaStore();
    await store.init();
    await store.clear();
    return store;
}

const imageBlob = (bytes = 8, type = 'image/png') =>
    new Blob([new Uint8Array(bytes).fill(7)], { type });
const videoBlob = (bytes = 8) =>
    new Blob([new Uint8Array(bytes).fill(9)], { type: 'video/mp4' });

describe('the durable store round-trips real bytes', () => {
    it('returns what it was given', async () => {
        const store = await freshStore();
        const meta = await store.put({
            id: 'asset-1', projectId: 'project-1', data: imageBlob(32, 'image/jpeg')
        });
        expect(meta).toMatchObject({
            id: 'asset-1', projectId: 'project-1', mimeType: 'image/jpeg', byteLength: 32
        });

        const record = await store.get('asset-1');
        expect(record.data).toBeInstanceOf(Blob);
        expect(record.data.size).toBe(32);
        // THE BYTES, not the metadata about the bytes.
        expect(new Uint8Array(await record.data.arrayBuffer())).toEqual(new Uint8Array(32).fill(7));
    });

    it('round-trips MP4 bytes through the same project-scoped media store', async () => {
        const store = await freshStore();
        const meta = await store.put({ id: 'video-1', projectId: 'p', data: videoBlob(24) });
        const record = await store.get('video-1');

        expect(meta).toMatchObject({ mimeType: 'video/mp4', byteLength: 24 });
        expect(new Uint8Array(await record.data.arrayBuffer()))
            .toEqual(new Uint8Array(24).fill(9));
    });

    it('survives a reopen — that is the whole point of durability', async () => {
        const store = await freshStore();
        await store.put({ id: 'asset-keep', projectId: 'p', data: imageBlob(16) });

        const reopened = new WorkshopMediaStore();
        const record = await reopened.get('asset-keep');
        expect(record?.data?.size).toBe(16);
        expect(await reopened.estimateBytes()).toBe(16);
    });

    it('creates the projectId index on upgrade, and deletes by project', async () => {
        const store = await freshStore();
        await store.put({ id: 'a', projectId: 'keep', data: imageBlob(4) });
        await store.put({ id: 'b', projectId: 'drop', data: imageBlob(4) });
        await store.put({ id: 'c', projectId: 'drop', data: imageBlob(4) });

        await store.deleteByProject('drop');
        expect(await store.has('a')).toBe(true);
        expect(await store.has('b')).toBe(false);
        expect(await store.has('c')).toBe(false);
        expect(await store.estimateBytes()).toBe(4);
    });

    it('keeps createdAt across a replacement and updates the size', async () => {
        const store = await freshStore();
        const first = await store.put({ id: 'a', projectId: 'p', data: imageBlob(10) });
        await new Promise(resolve => setTimeout(resolve, 2));
        const second = await store.put({ id: 'a', projectId: 'p', data: imageBlob(20) });

        expect(second.createdAt).toBe(first.createdAt);
        expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);
        // Replaced, not added — the total must not carry the old size.
        expect(await store.estimateBytes()).toBe(20);
    });
});

describe('the store refuses what it should refuse', () => {
    it('rejects a non-Blob, a non-image, and an empty blob', async () => {
        const store = await freshStore();
        for (const [data, code] of [
            ['not a blob', 'WORKSHOP_MEDIA_BLOB'],
            [new Blob(['x'], { type: 'text/html' }), 'WORKSHOP_MEDIA_MIME'],
            [new Blob([], { type: 'image/png' }), 'WORKSHOP_MEDIA_SIZE']
        ]) {
            await expect(store.put({ id: 'x', projectId: 'p', data }))
                .rejects.toMatchObject({ code });
        }
        expect(await store.has('x')).toBe(false);
    });

    it('rejects a blob over the shared image ceiling', async () => {
        const store = await freshStore();
        await expect(store.put({
            id: 'huge', projectId: 'p',
            data: imageBlob(READING_LIMITS.maxImageFileBytes + 1)
        })).rejects.toMatchObject({ code: 'WORKSHOP_MEDIA_SIZE' });
    });

    it('rejects an unusable id before touching the database', async () => {
        const store = await freshStore();
        for (const id of ['', '  padded  ', 'x'.repeat(161)]) {
            await expect(store.put({ id, projectId: 'p', data: imageBlob() }))
                .rejects.toMatchObject({ code: 'WORKSHOP_MEDIA_ID' });
        }
    });

    it('leaves the store and the running total untouched when a put is refused', async () => {
        // THE REASON THE BUDGET CHECK AND THE WRITE SHARE A TRANSACTION.
        // A refusal that had already moved the counter would make every
        // later budget decision wrong.
        const store = await freshStore();
        await store.put({ id: 'good', projectId: 'p', data: imageBlob(12) });
        await expect(store.put({ id: 'bad', projectId: 'p', data: new Blob(['x'], { type: 'text/plain' }) }))
            .rejects.toMatchObject({ code: 'WORKSHOP_MEDIA_MIME' });

        expect(await store.estimateBytes()).toBe(12);
        expect(await store._sumStoredBytes()).toBe(12);
    });
});

describe('the running total tracks the store', () => {
    it('agrees with a full scan after every kind of write', async () => {
        // The total is maintained incrementally rather than recomputed, so
        // the thing worth testing is that it never drifts from the truth.
        const store = await freshStore();
        const agrees = async () =>
            expect(await store.estimateBytes()).toBe(await store._sumStoredBytes());

        await agrees();
        await store.put({ id: 'a', projectId: 'p', data: imageBlob(10) });
        await agrees();
        await store.put({ id: 'b', projectId: 'p', data: imageBlob(30) });
        await agrees();
        await store.put({ id: 'a', projectId: 'p', data: imageBlob(5) });  // replace
        await agrees();
        await store.delete('b');
        await agrees();
        await store.delete('nonexistent-id');                              // no-op
        await agrees();
        await store.clear();
        await agrees();
        expect(await store.estimateBytes()).toBe(0);
    });

    it('is seeded from the database on a cold open', async () => {
        const store = await freshStore();
        await store.put({ id: 'a', projectId: 'p', data: imageBlob(64) });
        // A second store instance has never seen a write; it must still
        // know the budget, or the first put after a page load could
        // overshoot it.
        expect(await new WorkshopMediaStore().estimateBytes()).toBe(64);
    });
});

describe('object URLs are minted once and released', () => {
    it('caches per asset rather than minting per call', async () => {
        const store = await freshStore();
        await store.put({ id: 'a', projectId: 'p', data: imageBlob() });
        const first = await store.resolveObjectUrl('a');
        const second = await store.resolveObjectUrl('a');
        expect(second).toBe(first);
        expect(minted).toBe(1);
    });

    it('revokes on replace, so a stale handle cannot outlive its bytes', async () => {
        const store = await freshStore();
        await store.put({ id: 'a', projectId: 'p', data: imageBlob(4) });
        const stale = await store.resolveObjectUrl('a');
        await store.put({ id: 'a', projectId: 'p', data: imageBlob(8) });
        expect(revoked).toContain(stale);

        const fresh = await store.resolveObjectUrl('a');
        expect(fresh).not.toBe(stale);
    });

    it('revokes on delete and on clear', async () => {
        const store = await freshStore();
        await store.put({ id: 'a', projectId: 'p', data: imageBlob() });
        await store.put({ id: 'b', projectId: 'p', data: imageBlob() });
        const urlA = await store.resolveObjectUrl('a');
        const urlB = await store.resolveObjectUrl('b');

        await store.delete('a');
        expect(revoked).toContain(urlA);

        await store.clear();
        expect(revoked).toContain(urlB);
    });

    it('raises MISSING for an asset that is not there', async () => {
        const store = await freshStore();
        await expect(store.resolveObjectUrl('never-stored'))
            .rejects.toMatchObject({ code: 'WORKSHOP_MEDIA_MISSING' });
    });
});

describe('data URI conversion is lossless', () => {
    it('carries the same bytes and MIME through a data: URI', async () => {
        const original = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
        const base64 = btoa(String.fromCharCode(...original));
        const blob = dataImageUriToBlob(`data:image/png;base64,${base64}`);
        expect(blob.type).toBe('image/png');
        expect(new Uint8Array(await blob.arrayBuffer())).toEqual(original);
    });

    it('refuses a URI that is not a data:image', () => {
        for (const uri of ['data:text/html,<script>', 'https://example.org/a.png', 'data:image/png']) {
            expect(() => dataImageUriToBlob(uri))
                .toThrow(expect.objectContaining({ code: 'WORKSHOP_MEDIA_DATA_URI' }));
        }
    });
});

describe('the store reports its own unavailability', () => {
    it('raises UNAVAILABLE rather than throwing a bare TypeError', async () => {
        const store = new WorkshopMediaStore();
        const real = globalThis.indexedDB;
        // eslint-disable-next-line no-undef
        globalThis.indexedDB = undefined;
        try {
            await expect(store.init()).rejects.toBeInstanceOf(WorkshopMediaError);
        } finally {
            globalThis.indexedDB = real;
        }
    });
});
