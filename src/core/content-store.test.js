/**
 * The store is the door the corpus now comes through, so its refusals are
 * the interesting part. A work that will not verify is ABSENT — never a
 * broken frame, never a substitute (SYSTEM-DESIGN-REVIEW §11.3).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ContentStore,
    ContentStoreError,
    CONTENT_CACHE_NAME
} from './content-store.js';

const SECTIONS = [
    { name: 'Chapter I', content: 'In the beginning.' },
    { name: 'Chapter II', content: 'And then.', verse: true }
];

const BODY = JSON.stringify(SECTIONS);

/** sha256 of BODY, computed the same way the store will. */
async function digestOf(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

function manifestFor(sha) {
    return {
        schema: 'rise.content-manifest.v1',
        revision: 'test',
        works: [
            {
                id: 'the-iliad',
                sha256: sha,
                bytes: BODY.length,
                url: `/content/works/${sha}.json`,
                shelved: true
            },
            {
                id: 'hamlet',
                shelved: false,
                withheldReason: 'Cambridge 1863 variorum — 32.3% critical apparatus.'
            }
        ]
    };
}

/** A Cache Storage stand-in with the three methods the store uses. */
function fakeCaches() {
    const stores = new Map();
    return {
        stores,
        async open(name) {
            if (!stores.has(name)) stores.set(name, new Map());
            const entries = stores.get(name);
            return {
                async match(url) {
                    const body = entries.get(url);
                    return body === undefined ? undefined : new Response(body);
                },
                async put(url, response) {
                    entries.set(url, await response.clone().text());
                },
                async delete(url) {
                    return entries.delete(url);
                }
            };
        }
    };
}

describe('ContentStore', () => {
    let sha;
    let manifest;

    beforeEach(async () => {
        sha = await digestOf(BODY);
        manifest = manifestFor(sha);
    });

    it('fetches a work, verifies its hash, and returns its sections', async () => {
        const fetchImpl = vi.fn(async () => new Response(BODY));
        const store = new ContentStore({ manifest, fetchImpl, caches: fakeCaches() });

        await expect(store.getSections('the-iliad')).resolves.toEqual(SECTIONS);
        expect(fetchImpl).toHaveBeenCalledWith(`/content/works/${sha}.json`, expect.anything());
    });

    it('serves the second read from Cache Storage without another fetch', async () => {
        const fetchImpl = vi.fn(async () => new Response(BODY));
        const store = new ContentStore({ manifest, fetchImpl, caches: fakeCaches() });

        await store.getSections('the-iliad');
        store.forget('the-iliad');           // drop the in-memory copy only
        await expect(store.getSections('the-iliad')).resolves.toEqual(SECTIONS);

        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    /**
     * THE HASH IS THE URL, so this is the whole point: a CDN object that
     * changed under us cannot be read. The module-graph design could not
     * have this property at any price.
     */
    it('refuses a payload whose bytes do not match the hash it was fetched by', async () => {
        const fetchImpl = async () => new Response(`${BODY} tampered`);
        const store = new ContentStore({ manifest, fetchImpl, caches: fakeCaches() });

        await expect(store.getSections('the-iliad')).rejects.toThrow(ContentStoreError);
        await expect(store.getSections('the-iliad')).rejects.toMatchObject({
            code: 'CONTENT_PAYLOAD_INTEGRITY'
        });
    });

    it('evicts a cached object that no longer verifies rather than serving it', async () => {
        const caches = fakeCaches();
        const cache = await caches.open(CONTENT_CACHE_NAME);
        await cache.put(`/content/works/${sha}.json`, new Response('poisoned'));

        const fetchImpl = vi.fn(async () => new Response(BODY));
        const store = new ContentStore({ manifest, fetchImpl, caches });

        await expect(store.getSections('the-iliad')).resolves.toEqual(SECTIONS);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('refuses a withheld work by its stated reason, and does not fetch', async () => {
        const fetchImpl = vi.fn();
        const store = new ContentStore({ manifest, fetchImpl, caches: fakeCaches() });

        await expect(store.getSections('hamlet')).rejects.toMatchObject({
            code: 'CONTENT_WITHHELD'
        });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('refuses a work the manifest does not name', async () => {
        const store = new ContentStore({
            manifest,
            fetchImpl: vi.fn(),
            caches: fakeCaches()
        });
        await expect(store.getSections('not-a-work')).rejects.toMatchObject({
            code: 'CONTENT_UNKNOWN_WORK'
        });
    });

    it('reports an unreachable object as absent rather than as a broken reading', async () => {
        const fetchImpl = async () => new Response('nope', { status: 503 });
        const store = new ContentStore({ manifest, fetchImpl, caches: fakeCaches() });

        await expect(store.getSections('the-iliad')).rejects.toMatchObject({
            code: 'CONTENT_UNAVAILABLE'
        });
    });

    it('reads a work once however many callers ask at the same time', async () => {
        const fetchImpl = vi.fn(async () => new Response(BODY));
        const store = new ContentStore({ manifest, fetchImpl, caches: fakeCaches() });

        const [left, right] = await Promise.all([
            store.getSections('the-iliad'),
            store.getSections('the-iliad')
        ]);

        expect(left).toBe(right);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('works with no Cache Storage at all, which is private browsing', async () => {
        const fetchImpl = vi.fn(async () => new Response(BODY));
        const store = new ContentStore({ manifest, fetchImpl, caches: null });

        await expect(store.getSections('the-iliad')).resolves.toEqual(SECTIONS);
    });
});
