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

// The pinned path resolves incrementally: _resolvePins feeds each
// batch to options.onBatch and the category pool grows in place.
// Mocks must honor that contract or the caller's non-empty wait spins.
const mockPins = (provider, works) =>
    vi.spyOn(provider, '_resolvePins').mockImplementation(async (categoryId, options = {}) => {
        options.onBatch?.(works);
        return works;
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
        mockPins(provider, [{ id: 'rijks:1', title: 'w', url: 'u', fullUrl: 'u' }]);
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

    it('pinned pools ignore the limit axis: one shared resolution, one growing array', async () => {
        mockPins(provider, [{ id: 'rijks:1', title: 'w', url: 'u', fullUrl: 'u' }]);
        const a = await provider.getImagesInCategory('landscapes', 100);
        const b = await provider.getImagesInCategory('landscapes', 100);
        const c = await provider.getImagesInCategory('landscapes', 20);
        // pins ARE the whole pool — every caller shares it
        expect(provider._resolvePins).toHaveBeenCalledTimes(1);
        expect(a).toBe(b);
        expect(b).toBe(c);
    });

    it('a fresh provider instance holds no pool state (session-scoped cache)', async () => {
        mockPins(provider, [{ id: 'rijks:1', title: 'w', url: 'u', fullUrl: 'u' }]);
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
        // the shared run degrades failure to an empty pool; the caller
        // and the cortex treat it like any dry category
        expect(pool).toEqual([]);
        vi.unstubAllGlobals();
    });

    it('a transient failure does NOT permanently resolve a category as empty (recovery)', async () => {
        // first attempt: everything fails
        let failing = true;
        vi.spyOn(provider, '_resolvePins').mockImplementation(async (categoryId, options = {}) => {
            if (failing) throw new Error('museum dark');
            const works = [{ id: 'rijks:1', title: 'w', url: 'u', fullUrl: 'u' }];
            options.onBatch?.(works);
            return works;
        });
        const first = await provider.getImagesInCategory('flowers', 100);
        expect(first).toEqual([]);
        expect(provider._pinsResolved.has('flowers')).toBe(false); // NOT marked resolved

        // the museum comes back; backoff window elapses
        failing = false;
        provider._pinRetryAt.set('flowers', 0);
        const second = await provider.getImagesInCategory('flowers', 100);
        expect(second.length).toBe(1); // recovered
        expect(provider._pinsResolved.has('flowers')).toBe(true);
    });

    it('failure sets a bounded backoff so a dry provider is not hammered per draw', async () => {
        vi.spyOn(provider, '_resolvePins').mockRejectedValue(new Error('dark'));
        await provider.getImagesInCategory('ships', 100);
        // within the backoff window a second call must NOT start a new run
        const calls = provider._resolvePins.mock.calls.length;
        await provider.getImagesInCategory('ships', 100);
        expect(provider._resolvePins.mock.calls.length).toBe(calls);
        expect(provider._pinRetryAt.get('ships')).toBeGreaterThan(Date.now());
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

    it('every category declares what kind it is', () => {
        // `kind` is what the Visual panel groups Collections by. A
        // category without one would still resolve imagery but would
        // fall into the panel's catch-all heading — visible, but filed
        // under nothing a reader recognises. Declare it at the source.
        for (const [id, category] of Object.entries(MUSEUM_CATEGORIES)) {
            expect(['style', 'subject'], `'${id}' has no usable kind`)
                .toContain(category.kind);
        }
    });

    it('a subject category never rides live search', () => {
        // The 2026-07-24 audit: subject tags are register-blind —
        // `soldiers` tags the Passion, `flower` the Annunciation lily —
        // and cut 79% of Flowers' and 90% of Animals' live surfaces.
        // Landscapes and Portraits are the deliberate exceptions: their
        // tags are unambiguous, so they keep clauses.
        const LIVE_SUBJECTS = new Set(['landscapes', 'portraits']);
        for (const [id, category] of Object.entries(MUSEUM_CATEGORIES)) {
            if (category.kind !== 'subject' || LIVE_SUBJECTS.has(id)) continue;
            expect(category.clauses, `subject category '${id}' must be pinned-only`)
                .toBeNull();
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
        mockPins(provider, Array.from({ length: 6 }, (_, i) => ({ id: `rijks:${i}`, title: `w${i}`, url: `u${i}`, fullUrl: `u${i}` })));
        const seen = [];
        for (let i = 0; i < 6; i++) {
            const item = await provider.getRandom({ category: 'ukiyoe' });
            seen.push(item.id);
        }
        expect(new Set(seen).size).toBe(6);
    });

    describe('Audubon Animals authority', () => {
        const audubonWork = {
            id: 'audubon:birds-folio:1',
            title: 'Wild Turkey',
            artist: 'John James Audubon',
            date: '1827',
            url: 'https://iiif.example/1600.jpg',
            fullUrl: 'https://iiif.example/3200.jpg',
            corpus: 'birds-folio',
            plate: 1,
            sourceName: 'Cincinnati Library',
            sourceUrl: 'https://digital.cincinnatilibrary.org/item/1',
            rights: 'PUBLIC_DOMAIN',
            rightsUri: 'http://rightsstatements.org/vocab/NoC-US/1.0/'
        };

        it('uses the bulk Audubon pool without starting pin resolution', async () => {
            const audubon = { getPool: () => [audubonWork], draw: () => audubonWork };
            provider = new MuseumProvider({ audubonService: audubon });
            vi.spyOn(provider, '_resolvePins');

            const pool = await provider.getImagesInCategory('animals');

            expect(pool).toEqual([audubonWork]);
            expect(provider._resolvePins).not.toHaveBeenCalled();
        });

        it('preserves corpus, plate, rights, and provenance on random results', async () => {
            const audubon = { getPool: () => [audubonWork], draw: () => audubonWork };
            provider = new MuseumProvider({ audubonService: audubon });

            const result = await provider.getRandom({ category: 'animals' });

            expect(result.id).toBe(audubonWork.id);
            expect(result.data).toBe(audubonWork);
            expect(result.metadata).toMatchObject({
                categoryId: 'animals',
                corpus: 'birds-folio',
                plate: 1,
                sourceName: 'Cincinnati Library',
                rights: 'PUBLIC_DOMAIN'
            });
        });

        it('falls back to the prior curated pins if catalog loading fails', async () => {
            provider = new MuseumProvider({
                audubonLoader: async () => { throw new Error('invalid generated catalog'); }
            });
            mockPins(provider, [{
                id: 'rijks:1', title: 'Fallback', url: 'fallback.jpg', fullUrl: 'fallback.jpg'
            }]);

            const pool = await provider.getImagesInCategory('animals');

            expect(pool).toHaveLength(1);
            expect(pool[0].id).toBe('rijks:1');
            expect(provider._audubonUnavailable).toBe(true);
        });

        it('rejects a stale lazy-load completion after the caller aborts', async () => {
            let release;
            const audubon = { getPool: () => [audubonWork], draw: () => audubonWork };
            provider = new MuseumProvider({
                audubonLoader: () => new Promise(resolve => { release = resolve; })
            });
            const controller = new AbortController();
            const request = provider.getImagesInCategory('animals', 100, {
                signal: controller.signal
            });

            controller.abort();
            release(audubon);

            await expect(request).rejects.toMatchObject({ name: 'AbortError' });
        });
    });
});
