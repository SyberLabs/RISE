/**
 * RISE Source System
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
        this._initPromise = null;
        this._version = 0;
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
        this._initialized = false;
        this._version++;
        console.log(`[SourceRegistry] Registered: ${provider.name} (${provider.contentType})`);
    }

    /**
     * Unregister a provider
     * @param {string} providerId
     */
    unregister(providerId) {
        if (this.providers.delete(providerId)) {
            this._initialized = false;
            this._version++;
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
     * Get all text providers
     * @returns {SourceProvider[]}
     */
    getTextProviders() {
        return this.getAll().filter(p =>
            p.contentType === 'text' || p.contentType === 'sequence'
        );
    }

    /**
     * Initialize all registered providers
     * @returns {Promise<{failures: Array, ready: SourceProvider[]}>}
     */
    async initAll() {
        if (this._initialized) return this._status([]);
        if (this._initPromise) return this._initPromise;

        const version = this._version;
        this._initPromise = (async () => {
            console.log(`[SourceRegistry] Initializing ${this.providers.size} providers...`);

            const failures = [];
            const initPromises = this.getAll().map(async (provider) => {
                try {
                    await provider.init();
                    console.log(`[SourceRegistry] ✓ ${provider.name} ready`);
                } catch (error) {
                    failures.push({ provider, error });
                    console.error(`[SourceRegistry] ✗ ${provider.name} failed:`, error);
                }
            });

            await Promise.all(initPromises);
            this._initialized = failures.length === 0 && version === this._version;
            if (failures.length === 0 && this._initialized) {
                console.log('[SourceRegistry] All providers initialized');
            } else if (failures.length > 0) {
                console.warn(`[SourceRegistry] Ready with ${failures.length} unavailable provider(s); retry remains enabled.`);
            }
            return this._status(failures);
        })();

        try {
            return await this._initPromise;
        } finally {
            this._initPromise = null;
        }
    }

    _status(failures = []) {
        return {
            failures,
            ready: this.getAll().filter(provider => provider.ready)
        };
    }
}

// Export singleton instance
export const SourceRegistry = new SourceRegistryClass();
