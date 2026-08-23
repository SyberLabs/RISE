/**
 * RISE Source System
 * Main barrel export
 *
 * This barrel names every provider statically, so importing anything from
 * it pulls all of them. That is fine for a surface that browses sources and
 * wrong for the composition root: bring the system up through
 * `./bootstrap.js`, which reaches the providers by dynamic import.
 */

// Core infrastructure
export { SourceProvider, TIER_LABELS, CONTENT_TYPE_LABELS } from './provider.js';
export { SourceRegistry } from './registry.js';
export { SourceCache } from './cache.js';

// Text providers
export { ArchiveTextProvider, LocalTextProvider, GutenbergProvider, SacredTextProvider, ArxivProvider } from './text/index.js';
export { GUTENBERG_CATALOG, SACRED_TEXTS, ARXIV_CATEGORIES } from './text/index.js';

// Visual providers
export { GeneratedVisualProvider, VISUAL_TYPES } from './visual/index.js';
export { WikimediaProvider, WIKIMEDIA_CATEGORIES } from './visual/index.js';

export { SOURCE_PROVIDER_IDS, ensureSourceSystem, resetSourceSystem } from './bootstrap.js';
