/**
 * Personal Swell Store
 * 
 * Persistent storage for user-uploaded audio samples (swells)
 * using IndexedDB for binary blob efficiency.
 */

const DB_NAME = 'rise-personal-assets';
const DB_VERSION = 1;
const STORE_NAME = 'swells';

export class PersonalSwellStore {
    constructor() {
        /** @type {IDBDatabase|null} */
        this.db = null;
        this._initPromise = null;
        this._ready = false;
    }

    /**
     * Initialize the database
     */
    async init() {
        if (this._ready) return;
        if (this._initPromise) return this._initPromise;

        this._initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('[SwellStore] Failed to open DB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this._ready = true;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    console.log('[SwellStore] Created swells object store');
                }
            };
        });

        return this._initPromise;
    }

    /**
     * Add a new swell to the pool
     * @param {File|Blob} blob - The audio data
     * @param {string} name - Display name
     * @returns {Promise<Object>} The saved record
     */
    async addSwell(blob, name) {
        await this.init();
        
        const id = `swell_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const record = {
            id,
            name,
            timestamp: Date.now(),
            data: blob,
            type: blob.type
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.add(record);

            request.onsuccess = () => {
                console.log('[SwellStore] Asset saved:', id);
                resolve(record);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all personal swells
     * @returns {Promise<Array>}
     */
    async getAll() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Remove a swell by ID
     */
    async removeSwell(id) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all personal audio assets
     */
    async clear() {
        await this.init();
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        transaction.objectStore(STORE_NAME).clear();
    }
}

// Export singleton
export const PersonalSwells = new PersonalSwellStore();
