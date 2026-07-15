/**
 * Personal Swell Store
 * 
 * Persistent storage for user-uploaded audio samples (swells)
 * using IndexedDB for binary blob efficiency.
 */

const DB_NAME = 'rise-personal-assets';
const DB_VERSION = 1;
const STORE_NAME = 'swells';
const MAX_SWELL_BYTES = 20 * 1024 * 1024;

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

        try {
            return await this._initPromise;
        } catch (error) {
            this._initPromise = null;
            this._ready = false;
            throw error;
        }
    }

    /**
     * Add a new swell to the pool
     * @param {File|Blob} blob - The audio data
     * @param {string} name - Display name
     * @returns {Promise<Object>} The saved record
     */
    async addSwell(blob, name) {
        if (!(blob instanceof Blob) || !blob.type.startsWith('audio/')) {
            throw new TypeError('Personal swells must be audio files');
        }
        if (blob.size <= 0 || blob.size > MAX_SWELL_BYTES) {
            throw new RangeError('Personal swells must be between 1 byte and 20 MB');
        }
        await this.init();
        
        const id = `swell_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const record = {
            id,
            name: String(name || 'Untitled Swell').trim().slice(0, 120),
            timestamp: Date.now(),
            data: blob,
            type: blob.type
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            store.add(record);

            transaction.oncomplete = () => {
                console.log('[SwellStore] Asset saved:', id);
                resolve(record);
            };
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error || new Error('Swell transaction aborted'));
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
            store.delete(id);

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error || new Error('Swell transaction aborted'));
        });
    }

    /**
     * Clear all personal audio assets
     */
    async clear() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            transaction.objectStore(STORE_NAME).clear();
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error || new Error('Swell clear transaction aborted'));
        });
    }
}

// Export singleton
export const PersonalSwells = new PersonalSwellStore();
