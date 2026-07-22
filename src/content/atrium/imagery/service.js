/**
 * Atrium Imagery Service.
 *
 * Resolves a curated collection — an explicit list of pinned works — into
 * displayable records with full attribution.
 *
 * ISOLATION (see ATRIUM-IMAGERY-SPEC.md §5): this module is additive. It
 * registers nothing with the Chamber's provider registry, defines no new
 * Chamber defaults, and caches under its own provider id so an Atrium
 * launch never warms or pollutes Chamber caches. The dependency arrow
 * points content → source, never the reverse.
 */

import { SourceCache } from '../../../sources/cache.js';
import { isDisplayable } from './works.js';
import { MET_SOURCE, resolveMetWork } from './adapters/met.js';
import { CLEVELAND_SOURCE, resolveClevelandWork } from './adapters/cleveland.js';
import { AIC_SOURCE, resolveAicWork } from './adapters/aic.js';
import { RIJKS_SOURCE, resolveRijksWork } from './adapters/rijks.js';

/** Cache namespace — deliberately distinct from every Chamber provider. */
export const IMAGERY_PROVIDER_ID = 'atrium-imagery';

/** Resolved works change only when a museum edits its catalog. */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const ADAPTERS = {
    [MET_SOURCE]: resolveMetWork,
    [CLEVELAND_SOURCE]: resolveClevelandWork,
    [AIC_SOURCE]: resolveAicWork,
    [RIJKS_SOURCE]: resolveRijksWork
};

/**
 * Bound so one malformed collection cannot issue unbounded requests.
 * Sized above the largest CURATED collection (chapel-nativity, 55
 * works) — the bound is a safety rail against malformed data, and it
 * must never silently truncate a deliberately reviewed collection.
 */
const MAX_WORKS_PER_COLLECTION = 80;

export function isKnownImagerySource(source) {
    return Object.hasOwn(ADAPTERS, source);
}

async function resolveOne(pin, options) {
    const resolver = ADAPTERS[pin?.source];
    if (!resolver) return null;

    const cacheKey = `${pin.source}:${pin.id}`;
    try {
        const cached = await SourceCache.get(IMAGERY_PROVIDER_ID, cacheKey);
        if (cached?.data && isDisplayable(cached.data)) return cached.data;
    } catch {
        // A cache miss or failure is not a resolution failure
    }

    const work = await resolver(pin.id, options);
    if (!work) return null;

    try {
        await SourceCache.set(
            IMAGERY_PROVIDER_ID, cacheKey, work, {}, 'image', CACHE_TTL_MS
        );
    } catch {
        // Caching is an optimization; never let it fail a resolution
    }
    return work;
}

/**
 * Resolve a collection's pinned works.
 *
 * Unresolvable works are SKIPPED, never substituted. A collection that
 * resolves to nothing degrades exactly like any empty source — the
 * cortex falls back to the rest of the pool — whereas a substituted
 * image would reintroduce the off-subject problem this service exists
 * to remove.
 *
 * @param {Object} collection - { name, works: [{ source, id }] }
 * @param {Object} [options] - { signal, fetchImpl }
 * @returns {Promise<Object[]>} displayable works, in curated order
 */
export async function resolveCollection(collection, options = {}) {
    const pins = Array.isArray(collection?.works)
        ? collection.works.slice(0, MAX_WORKS_PER_COLLECTION)
        : [];
    if (pins.length === 0) return [];

    const settled = await Promise.all(
        pins.map(pin => resolveOne(pin, options).catch(() => null))
    );
    return settled.filter(isDisplayable);
}

/**
 * Resolve several collections at once, returning a map of id → works.
 * Order within each collection is the curator's order.
 */
export async function resolveCollections(collections, options = {}) {
    const entries = Object.entries(collections || {});
    const resolved = await Promise.all(
        entries.map(async ([id, collection]) => [
            id, await resolveCollection(collection, options)
        ])
    );
    return Object.fromEntries(resolved);
}
