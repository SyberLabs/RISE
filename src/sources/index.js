/**
 * R.I.S.E. Source System
 * Main barrel export
 */

// Core infrastructure
export { SourceProvider, TIER_LABELS, CONTENT_TYPE_LABELS } from './provider.js';
export { SourceRegistry } from './registry.js';
export { SourceCache } from './cache.js';

// Text providers
export { LocalTextProvider, GutenbergProvider, SacredTextProvider, ArxivProvider } from './text/index.js';
export { GUTENBERG_CATALOG, SACRED_TEXTS, ARXIV_CATEGORIES } from './text/index.js';

// Visual providers
export { GeneratedVisualProvider, VISUAL_TYPES } from './visual/index.js';
export { WikimediaProvider, WIKIMEDIA_CATEGORIES } from './visual/index.js';

// Initialization helper
import { SourceRegistry } from './registry.js';
import { SourceCache } from './cache.js';
import { LocalTextProvider, GutenbergProvider, SacredTextProvider, ArxivProvider } from './text/index.js';
import { GeneratedVisualProvider, WikimediaProvider } from './visual/index.js';

/**
 * Initialize the source system with default providers
 * Call this early in app initialization
 * @returns {Promise<void>}
 */
export async function initSourceSystem() {
    console.log('[Sources] Initializing source system...');

    // Initialize cache
    await SourceCache.init();

    // Register defaults once. Repeated bootstrap calls retain provider
    // identity, cache state, and any in-flight provider initialization.
    const defaults = [
        new LocalTextProvider(),
        new GutenbergProvider(),
        new SacredTextProvider(),
        new ArxivProvider(),
        new GeneratedVisualProvider(),
        new WikimediaProvider()
    ];
    for (const provider of defaults) {
        if (!SourceRegistry.get(provider.id)) SourceRegistry.register(provider);
    }

    // Initialize all registered providers
    const status = await SourceRegistry.initAll();

    console.log('[Sources] Source system ready');
    console.log('[Sources] Stats:', SourceRegistry.getStats());
    return status;
}



