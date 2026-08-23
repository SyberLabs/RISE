/**
 * Bringing up the source system, on the first surface that browses sources.
 *
 * THIS USED TO HAPPEN AT BOOT. `initializeApp` awaited a function that
 * constructed all seven providers before the Portal could paint, and the
 * providers are not thin: `sacred.js` carries 22 KB of verse inline,
 * `local.js` wraps the 32 KB starter set, `archive.js` reaches
 * `content/library.js` and through it `sacred_deep.js` and
 * `literary_deep.js`, and `wikimedia.js` is 21 KB around a category
 * registry that an audit emptied. A registry needs ids; it was loading
 * payloads. Nothing the Portal shows reads any of them.
 *
 * There is no metadata manifest here, and that is deliberate.
 * `work-engines.js` keeps one because the curator context and diagnostics
 * must NAME an engine without loading it. Nothing needs to name a provider
 * without loading it — the SourceBrowser is the only reader of the registry
 * and it wants the providers themselves — so a parallel copy of the ids and
 * tiers would be a second vocabulary to keep in sync for no caller.
 *
 * `SOURCE_PROVIDER_IDS` is the promise and `LOADERS` is the delivery;
 * bootstrap.test.js fails if they disagree.
 */

import { SourceRegistry } from './registry.js';

/** id → () => Promise<SourceProvider> */
const LOADERS = Object.freeze({
    'library-archive': () => import('./text/archive.js')
        .then(m => new m.ArchiveTextProvider()),
    'local-starters': () => import('./text/local.js')
        .then(m => new m.LocalTextProvider()),
    'gutenberg': () => import('./text/gutenberg.js')
        .then(m => new m.GutenbergProvider()),
    'sacred-texts': () => import('./text/sacred.js')
        .then(m => new m.SacredTextProvider()),
    'arxiv-research': () => import('./text/arxiv.js')
        .then(m => new m.ArxivProvider()),
    'generated-visuals': () => import('./visual/generated.js')
        .then(m => new m.GeneratedVisualProvider()),
    'wikimedia-commons': () => import('./visual/wikimedia.js')
        .then(m => new m.WikimediaProvider())
});

/** The providers RISE promises to have once the system is up. */
export const SOURCE_PROVIDER_IDS = Object.freeze(Object.keys(LOADERS));

let bootstrap = null;

/**
 * Build, register and initialize the default providers exactly once.
 * Concurrent callers share the one bootstrap; later callers get the same
 * provider instances, so cache state and in-flight work survive.
 *
 * @returns {Promise<{failures: Array, ready: SourceProvider[]}>}
 */
export function ensureSourceSystem() {
    bootstrap ||= (async () => {
        console.log('[Sources] Initializing source system...');

        // Loaded in parallel; a provider that cannot be fetched at all
        // leaves the rest of the library usable rather than taking the
        // browser down with it.
        const built = await Promise.all(
            SOURCE_PROVIDER_IDS.map(async (id) => {
                try {
                    return await LOADERS[id]();
                } catch (error) {
                    console.error(`[Sources] ${id} could not be loaded:`, error);
                    return null;
                }
            })
        );

        // Registration is idempotent so a second bootstrap keeps provider
        // identity, cache state, and any in-flight provider initialization.
        for (const provider of built) {
            if (provider && !SourceRegistry.get(provider.id)) {
                SourceRegistry.register(provider);
            }
        }

        const status = await SourceRegistry.initAll();
        console.log('[Sources] Source system ready');
        console.log('[Sources] Stats:', SourceRegistry.getStats());
        return status;
    })();
    return bootstrap;
}

/** Test seam: forget the memoized bootstrap. */
export function resetSourceSystem() {
    bootstrap = null;
}
