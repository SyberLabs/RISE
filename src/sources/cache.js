/**
 * R.I.S.E. Source System
 * Persistent Cache Layer
 * 
 * IndexedDB-based caching for source content.
 * Persists across sessions for importable library functionality.
 */

const DB_NAME = 'rise-source-cache';
const DB_VERSION = 1;
const STORE_NAME = 'content';

/**
 * Cache entry structure
 * @typedef {Object} CacheEntry
 * @property {string} id - Content ID (provider:itemId)
 * @property {string} providerId - Source provider ID
 * @property {string} contentType - Content type
 * @property {*} data - Cached content
 * @property {Object} metadata - Item metadata
 * @property {number} cachedAt - Timestamp when cached
 * @property {number} accessedAt - Last access timestamp
 * @property {number} [expiresAt] - Optional expiration timestamp
 * @property {number} size - Approximate size in bytes
 */

/**
 * Source Cache - persistent storage using IndexedDB
 */
class SourceCacheClass {
    constructor() {
        /** @type {IDBDatabase|null} */
        this.db = null;
        this._initPromise = null;
        this._ready = false;

        // Cache settings
        this.maxSize = 100 * 1024 * 1024; // 100MB default
        this.defaultTTL = 7 * 24 * 60 * 60 * 1000; // 7 days default
    }

    /**
     * Initialize the cache database
     * @returns {Promise<void>}
     */
    async init() {
        if (this._ready) return;
        if (this._initPromise) return this._initPromise;

        this._initPromise = this._openDatabase();
        this.db = await this._initPromise;
        this._ready = true;
        console.log('[SourceCache] Initialized');
    }

    /**
     * Open or create the IndexedDB database
     * @private
     * @returns {Promise<IDBDatabase>}
     */
    _openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('[SourceCache] Failed to open database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create content store with indexes
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('providerId', 'providerId', { unique: false });
                    store.createIndex('contentType', 'contentType', { unique: false });
                    store.createIndex('cachedAt', 'cachedAt', { unique: false });
                    store.createIndex('accessedAt', 'accessedAt', { unique: false });
                    console.log('[SourceCache] Created content store');
                }
            };
        });
    }

    /**
     * Generate cache key
     * @param {string} providerId
     * @param {string} itemId
     * @returns {string}
     */
    _makeKey(providerId, itemId) {
        return `${providerId}:${itemId}`;
    }

    /**
     * Estimate size of data in bytes
     * @private
     * @param {*} data
     * @returns {number}
     */
    _estimateSize(data) {
        if (data === null || data === undefined) return 0;
        if (typeof data === 'string') return data.length * 2; // UTF-16
        if (data instanceof Blob) return data.size;
        if (data instanceof ArrayBuffer) return data.byteLength;
        if (data instanceof ImageData) return data.data.byteLength;
        // For objects, use JSON approximation
        try {
            return JSON.stringify(data).length * 2;
        } catch {
            return 1024; // Default estimate
        }
    }

    /**
     * Store content in cache
     * @param {string} providerId - Provider ID
     * @param {string} itemId - Item ID
     * @param {*} data - Content data
     * @param {Object} [metadata={}] - Additional metadata
     * @param {string} [contentType='text'] - Content type
     * @param {number} [ttl] - Time to live in ms (optional)
     * @returns {Promise<void>}
     */
    async set(providerId, itemId, data, metadata = {}, contentType = 'text', ttl = null) {
        await this.init();

        const key = this._makeKey(providerId, itemId);
        const now = Date.now();

        /** @type {CacheEntry} */
        const entry = {
            id: key,
            providerId,
            contentType,
            data,
            metadata,
            cachedAt: now,
            accessedAt: now,
            expiresAt: ttl ? now + ttl : null,
            size: this._estimateSize(data)
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(entry);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get content from cache
     * @param {string} providerId - Provider ID
     * @param {string} itemId - Item ID
     * @returns {Promise<CacheEntry|null>}
     */
    async get(providerId, itemId) {
        await this.init();

        const key = this._makeKey(providerId, itemId);

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => {
                const entry = request.result;

                if (!entry) {
                    resolve(null);
                    return;
                }

                // Check expiration
                if (entry.expiresAt && Date.now() > entry.expiresAt) {
                    // Remove expired entry
                    store.delete(key);
                    resolve(null);
                    return;
                }

                // Update access time
                entry.accessedAt = Date.now();
                store.put(entry);

                resolve(entry);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Check if item exists in cache
     * @param {string} providerId
     * @param {string} itemId
     * @returns {Promise<boolean>}
     */
    async has(providerId, itemId) {
        const entry = await this.get(providerId, itemId);
        return entry !== null;
    }

    /**
     * Delete item from cache
     * @param {string} providerId
     * @param {string} itemId
     * @returns {Promise<void>}
     */
    async delete(providerId, itemId) {
        await this.init();

        const key = this._makeKey(providerId, itemId);

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all entries for a provider
     * @param {string} providerId
     * @returns {Promise<CacheEntry[]>}
     */
    async getByProvider(providerId) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('providerId');
            const request = index.getAll(providerId);

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all entries by content type
     * @param {string} contentType
     * @returns {Promise<CacheEntry[]>}
     */
    async getByType(contentType) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('contentType');
            const request = index.getAll(contentType);

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all entries for a provider
     * @param {string} providerId
     * @returns {Promise<number>} Number of entries deleted
     */
    async clearProvider(providerId) {
        const entries = await this.getByProvider(providerId);

        for (const entry of entries) {
            await this.delete(entry.providerId, entry.id.split(':')[1]);
        }

        return entries.length;
    }

    /**
     * Clear entire cache
     * @returns {Promise<void>}
     */
    async clear() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('[SourceCache] Cleared all entries');
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get cache statistics
     * @returns {Promise<Object>}
     */
    async getStats() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const entries = request.result || [];
                const totalSize = entries.reduce((sum, e) => sum + (e.size || 0), 0);

                const byProvider = {};
                const byType = {};

                for (const entry of entries) {
                    byProvider[entry.providerId] = (byProvider[entry.providerId] || 0) + 1;
                    byType[entry.contentType] = (byType[entry.contentType] || 0) + 1;
                }

                resolve({
                    totalEntries: entries.length,
                    totalSize,
                    totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
                    byProvider,
                    byType,
                    maxSize: this.maxSize,
                    usagePercent: ((totalSize / this.maxSize) * 100).toFixed(1)
                });
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Evict oldest entries to stay under size limit (LRU)
     * @returns {Promise<number>} Number of entries evicted
     */
    async evictOldest() {
        const stats = await this.getStats();

        if (stats.totalSize <= this.maxSize) {
            return 0;
        }

        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('accessedAt');
            const request = index.openCursor();

            let evicted = 0;
            let bytesFreed = 0;
            const targetFree = stats.totalSize - (this.maxSize * 0.8); // Free to 80%

            request.onsuccess = (event) => {
                const cursor = event.target.result;

                if (cursor && bytesFreed < targetFree) {
                    bytesFreed += cursor.value.size || 0;
                    cursor.delete();
                    evicted++;
                    cursor.continue();
                } else {
                    console.log(`[SourceCache] Evicted ${evicted} entries, freed ${(bytesFreed / 1024).toFixed(1)}KB`);
                    resolve(evicted);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }
}

// Export singleton instance
export const SourceCache = new SourceCacheClass();
