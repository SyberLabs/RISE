import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MuseumProvider, MUSEUM_CATEGORIES } from './museum.js';

/**
 * Pool + persistence mechanics for the museum provider.
 *
 * The category pool is session-scoped (a plain Map on the provider):
 * AIC results are fetched fresh each session, pins stream in behind
 * them (non-blocking, batched) from the imagery service's SourceCache.
 * These tests pin that contract: pools build correctly, retired ids
 * keep resolving, the cache key respects limit, and a failed pin
 * resolution never costs the category its AIC results.
 */

const aicResponse = (n, prefix = 'w') => ({
    pagination: { total: n },
    data: Array.from({ length: n }, (_, i) => ({
        id: 1000 + i,
        title: `${prefix}${i}`,
        image_id: `img-${prefix}${i}`,
        artist_display: 'Artist',
        date_display: '1650'
    }))
});

describe('museum pool mechanics', () => {
    let provider;

    beforeEach(() => {
        provider = new MuseumProvider();
        vi.restoreAllMocks();
    });

    it('serves AIC results immediately without waiting on pins', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true, json: async () => aicResponse(5)
        })));
        const pool = await provider.getImagesInCategory('oldmasters', 100);
        expect(pool.length).toBe(5);
        expect(pool[0].url).toContain('artic.edu/iiif');
        vi.unstubAllGlobals();
    });

    it('caches per category AND limit — different limits are different pools', async () => {
        const fetchMock = vi.fn(async () => ({ ok: true, json: async () => aicResponse(3) }));
        vi.stubGlobal('fetch', fetchMock);
        await provider.getImagesInCategory('landscapes', 100);
        await provider.getImagesInCategory('landscapes', 100);
        await provider.getImagesInCategory('landscapes', 20);
        // two distinct cache keys → two upstream fetches, not three
        expect(fetchMock).toHaveBeenCalledTimes(2);
        vi.unstubAllGlobals();
    });

    it('a fresh provider instance holds no pool state (session-scoped cache)', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => aicResponse(2) })));
        await provider.getImagesInCategory('portraits', 100);
        expect(provider._categoryCache.size).toBe(1);
        const fresh = new MuseumProvider();
        expect(fresh._categoryCache ?? new Map()).toHaveProperty('size', 0);
        vi.unstubAllGlobals();
    });

    it('retired category ids resolve to their living neighbor', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => aicResponse(2) })));
        const viaRetired = await provider.getImagesInCategory('renaissance', 100);
        const direct = await provider.getImagesInCategory('oldmasters', 100);
        // same resolved id → same cached pool object
        expect(viaRetired).toBe(direct);
        vi.unstubAllGlobals();
    });

    it('an unknown category yields an empty pool, never a throw', async () => {
        const pool = await provider.getImagesInCategory('no-such-room', 100);
        expect(pool).toEqual([]);
    });

    it('pin-resolution failure degrades to the AIC-only pool', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url) => {
            if (String(url).includes('artic.edu')) {
                return { ok: true, json: async () => aicResponse(4) };
            }
            throw new Error('museum API down');
        }));
        const pool = await provider.getImagesInCategory('oldmasters', 100);
        expect(pool.length).toBe(4);
        // give the background pin promise a beat to fail quietly
        await new Promise(r => setTimeout(r, 50));
        expect(provider._categoryCache.get('cat:oldmasters:100').length)
            .toBeGreaterThanOrEqual(4);
        vi.unstubAllGlobals();
    });

    it('the audit exclusions exist and are non-empty (museum.js soft-guards them, so their loss is otherwise silent)', async () => {
        const { CATEGORY_EXCLUSIONS } = await import('./museum-pins.js');
        expect(CATEGORY_EXCLUSIONS, 'CATEGORY_EXCLUSIONS export vanished from museum-pins.js').toBeDefined();
        // the 2026-07-24 audit floor: these categories carry exclusions
        expect(CATEGORY_EXCLUSIONS.landscapes?.length).toBeGreaterThanOrEqual(14);
        expect(CATEGORY_EXCLUSIONS.portraits?.length).toBeGreaterThanOrEqual(2);
        expect(CATEGORY_EXCLUSIONS.impressionism?.length).toBeGreaterThanOrEqual(3);
    });

    it('every declared pin category exists in MUSEUM_CATEGORIES', async () => {
        const { MUSEUM_CATEGORY_PINS } = await import('./museum-pins.js');
        for (const catId of Object.keys(MUSEUM_CATEGORY_PINS)) {
            expect(MUSEUM_CATEGORIES[catId],
                `pins declare '${catId}' but no such category exists — those pins would never surface`
            ).toBeDefined();
        }
    });

    it('the pin file holds no duplicate works within a category', async () => {
        const { MUSEUM_CATEGORY_PINS } = await import('./museum-pins.js');
        for (const [catId, pins] of Object.entries(MUSEUM_CATEGORY_PINS)) {
            const ids = new Set(pins.map(p => `${p.source}:${p.id}`));
            expect(ids.size, `duplicate pins in ${catId}`).toBe(pins.length);
        }
    });

    it('every pin names a source the imagery service can resolve', async () => {
        const { MUSEUM_CATEGORY_PINS } = await import('./museum-pins.js');
        const { isKnownImagerySource } = await import('../../content/atrium/imagery/service.js');
        for (const [catId, pins] of Object.entries(MUSEUM_CATEGORY_PINS)) {
            for (const pin of pins) {
                expect(isKnownImagerySource(pin.source),
                    `${catId} pin ${pin.source}:${pin.id} names an unknown source`
                ).toBe(true);
            }
        }
    });

    it('getRandom draws a full no-repeat cycle from a stable pool', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => aicResponse(6) })));
        const seen = [];
        for (let i = 0; i < 6; i++) {
            const item = await provider.getRandom({ category: 'ukiyoe' });
            seen.push(item.id);
        }
        expect(new Set(seen).size).toBe(6);
        vi.unstubAllGlobals();
    });
});
