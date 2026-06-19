/**
 * R.I.S.E. Source System
 * Provider Registry
 * 
 * Central registry for discovering and managing source providers.
 */

import { SourceProvider } from './provider.js';

/**
 * Source Registry - singleton for provider management
 */
class SourceRegistryClass {
    constructor() {
        /** @type {Map<string, SourceProvider>} */
        this.providers = new Map();
        this._initialized = false;
    }

    /**
     * Register a provider
     * @param {SourceProvider} provider
     */
    register(provider) {
        if (!(provider instanceof SourceProvider)) {
            throw new Error('Provider must extend SourceProvider');
        }

        if (this.providers.has(provider.id)) {
            console.warn(`[SourceRegistry] Provider ${provider.id} already registered, replacing`);
        }

        this.providers.set(provider.id, provider);
        console.log(`[SourceRegistry] Registered: ${provider.name} (${provider.contentType})`);
    }

    /**
     * Unregister a provider
     * @param {string} providerId
     */
    unregister(providerId) {
        if (this.providers.delete(providerId)) {
            console.log(`[SourceRegistry] Unregistered: ${providerId}`);
        }
    }

    /**
     * Get a provider by ID
     * @param {string} providerId
     * @returns {SourceProvider|undefined}
     */
    get(providerId) {
        return this.providers.get(providerId);
    }

    /**
     * Get all providers
     * @returns {SourceProvider[]}
     */
    getAll() {
        return Array.from(this.providers.values());
    }

    /**
     * Get providers by content type
     * @param {string} contentType
     * @returns {SourceProvider[]}
     */
    getByType(contentType) {
        return this.getAll().filter(p => p.contentType === contentType);
    }

    /**
     * Get providers by tier
     * @param {number} tier
     * @returns {SourceProvider[]}
     */
    getByTier(tier) {
        return this.getAll().filter(p => p.tier === tier);
    }

    /**
     * Get all text providers
     * @returns {SourceProvider[]}
     */
    getTextProviders() {
        return this.getAll().filter(p =>
            p.contentType === 'text' || p.contentType === 'sequence'
        );
    }

    /**
     * Get all visual providers
     * @returns {SourceProvider[]}
     */
    getVisualProviders() {
        return this.getAll().filter(p =>
            ['image', 'diagram', 'fractal'].includes(p.contentType)
        );
    }

    /**
     * Initialize all registered providers
     * @returns {Promise<void>}
     */
    async initAll() {
        if (this._initialized) return;

        console.log(`[SourceRegistry] Initializing ${this.providers.size} providers...`);

        const initPromises = this.getAll().map(async (provider) => {
            try {
                await provider.init();
                console.log(`[SourceRegistry] ✓ ${provider.name} ready`);
            } catch (error) {
                console.error(`[SourceRegistry] ✗ ${provider.name} failed:`, error);
            }
        });

        await Promise.all(initPromises);
        this._initialized = true;
        console.log('[SourceRegistry] All providers initialized');
    }

    /**
     * Search across all providers that support search
     * @param {string} query
     * @param {Object} [options]
     * @param {string} [options.contentType] - Filter by content type
     * @param {number} [options.tier] - Filter by tier
     * @returns {Promise<Array<{provider: SourceProvider, items: ContentItem[]}>>}
     */
    async searchAll(query, options = {}) {
        const providers = this.getAll()
            .filter(p => p.supportsSearch)
            .filter(p => !options.contentType || p.contentType === options.contentType)
            .filter(p => !options.tier || p.tier === options.tier);

        const results = await Promise.all(
            providers.map(async (provider) => {
                try {
                    const items = await provider.search(query);
                    return { provider, items };
                } catch (error) {
                    console.error(`[SourceRegistry] Search failed for ${provider.name}:`, error);
                    return { provider, items: [] };
                }
            })
        );

        return results.filter(r => r.items.length > 0);
    }

    /**
     * Get registry stats
     * @returns {Object}
     */
    getStats() {
        const providers = this.getAll();
        return {
            total: providers.length,
            ready: providers.filter(p => p.ready).length,
            byType: {
                text: this.getByType('text').length,
                sequence: this.getByType('sequence').length,
                image: this.getByType('image').length,
                diagram: this.getByType('diagram').length,
                fractal: this.getByType('fractal').length,
                audio: this.getByType('audio').length
            },
            byTier: {
                1: this.getByTier(1).length,
                2: this.getByTier(2).length,
                3: this.getByTier(3).length,
                4: this.getByTier(4).length,
                5: this.getByTier(5).length
            }
        };
    }
}

// Export singleton instance
export const SourceRegistry = new SourceRegistryClass();
