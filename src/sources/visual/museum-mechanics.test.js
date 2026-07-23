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

    it('pinned-only is the default: no AIC search request leaves the provider', async () => {
        // LIVE_SEARCH_ENABLED ships empty, so even clause-bearing
        // categories resolve from pins alone
        const fetchMock = vi.fn(async () => ({ ok: true, json: async () => aicResponse(5) }));
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(provider, '_resolvePins').mockResolvedValue([
            { id: 'rijks:1', title: 'w', url: 'u', fullUrl: 'u' }
        ]);
        const pool = await provider.getImagesInCategory('oldmasters', 100);
        expect(pool.length).toBe(1);
        const searchCalls = fetchMock.mock.calls.filter(([u]) => /artic\.edu/.test(String(u)));
        expect(searchCalls.length).toBe(0);
        vi.unstubAllGlobals();
    });

    it('the live-search canon flag ships, and ships empty (pinned-only everywhere)', async () => {
        const { LIVE_SEARCH_ENABLED } = await import('./museum-pins.js');
        expect(LIVE_SEARCH_ENABLED).toBeDefined();
        expect(Object.values(LIVE_SEARCH_ENABLED).filter(v => v === true)).toHaveLength(0);
    });

    it('caches per category AND limit — different limits are different pools', async () => {
        vi.spyOn(provider, '_resolvePins').mockResolvedValue([
            { id: 'rijks:1', title: 'w', url: 'u', fullUrl: 'u' }
        ]);
        await provider.getImagesInCategory('landscapes', 100);
        await provider.getImagesInCategory('landscapes', 100);
        await provider.getImagesInCategory('landscapes', 20);
        // two distinct cache keys → two pin resolutions, not three
        expect(provider._resolvePins).toHaveBeenCalledTimes(2);
    });

    it('a fresh provider instance holds no pool state (session-scoped cache)', async () => {
        vi.spyOn(provider, '_resolvePins').mockResolvedValue([
            { id: 'rijks:1', title: 'w', url: 'u', fullUrl: 'u' }
        ]);
        await provider.getImagesInCategory('portraits', 100);
        expect(provider._categoryCache.size).toBe(1);
        const fresh = new MuseumProvider();
        expect(fresh._categoryCache ?? new Map()).toHaveProperty('size', 0);
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

    it('pin-resolution failure yields an empty pool, never a throw (pinned-only era)', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
        const pool = await provider.getImagesInCategory('oldmasters', 100);
        // _resolvePins degrades to [] on failure; the caller sees an
        // empty pool and the cortex treats it like any dry category
        expect(pool).toEqual([]);
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

    it('getRandom draws a full no-repeat cycle from a stable pinned pool', async () => {
        vi.spyOn(provider, '_resolvePins').mockResolvedValue(
            Array.from({ length: 6 }, (_, i) => ({
                id: `rijks:${i}`, title: `w${i}`, url: `u${i}`, fullUrl: `u${i}`
            }))
        );
        const seen = [];
        for (let i = 0; i < 6; i++) {
            const item = await provider.getRandom({ category: 'ukiyoe' });
            seen.push(item.id);
        }
        expect(new Set(seen).size).toBe(6);
    });
});
