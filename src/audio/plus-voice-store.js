/** Legacy browser audio, retained only so Settings can erase old copies.
 * New Plus audio is saved and authorized on the server; never read this store
 * as playback authority or write new recordings here. */

const DB_NAME = 'rise-plus-voice';
const DB_VERSION = 1;
const STORE_NAME = 'voicings';
export class PlusVoiceStore {
    constructor() {
        /** @type {IDBDatabase|null} */
        this.db = null;
        this._initPromise = null;
    }

    async init() {
        if (this.db) return;
        this._initPromise ??= new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onupgradeneeded = event => {
                event.target.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
            };
        });
        try {
            await this._initPromise;
        } catch (error) {
            this._initPromise = null;
            throw error;
        }
    }

    _request(mode, run) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], mode);
            const request = run(transaction.objectStore(STORE_NAME));
            transaction.oncomplete = () => resolve(request?.result);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error || new Error('Plus voice transaction aborted'));
        });
    }

    async clear() {
        await this.init();
        await this._request('readwrite', store => store.clear());
    }
}

export const PlusVoices = new PlusVoiceStore();
