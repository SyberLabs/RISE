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

    // Register text providers
    SourceRegistry.register(new LocalTextProvider());
    SourceRegistry.register(new GutenbergProvider());
    SourceRegistry.register(new SacredTextProvider());
    SourceRegistry.register(new ArxivProvider());

    // Register visual providers
    SourceRegistry.register(new GeneratedVisualProvider());
    SourceRegistry.register(new WikimediaProvider());

    // Initialize all registered providers
    await SourceRegistry.initAll();

    console.log('[Sources] Source system ready');
    console.log('[Sources] Stats:', SourceRegistry.getStats());
}



