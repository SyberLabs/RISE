/**
 * Plus voicings kept in the reader's browser.
 *
 * The Worker keeps no copy of a voiced reading (worker/plus.mjs): it answers
 * with the pack and the audio, and they are kept here, next to the reader's
 * other work, so the same text is never paid for twice on this device. Erase
 * clears it (src/core/user-data.js). Modelled on personal-swells.js.
 */

const DB_NAME = 'rise-plus-voice';
const DB_VERSION = 1;
const STORE_NAME = 'voicings';
/** About thirty hours of the Worker's 64 kbps MP3; the oldest voicings go first past it. */
export const PLUS_VOICE_STORE_MAX_BYTES = 800 * 1024 * 1024;

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

    /** @returns {Promise<{ key: string, pack: object, audio: ArrayBuffer, createdAt: number } | null>} */
    async get(key) {
        await this.init();
        return (await this._request('readonly', store => store.get(key))) ?? null;
    }

    /** Keeps one voicing, then lets the oldest go while the store is over its cap. */
    async put(key, { pack, audio }) {
        await this.init();
        // Best effort: a persisted origin is not evicted under storage pressure.
        void globalThis.navigator?.storage?.persist?.().catch(() => {});
        await this._request('readwrite', store => store.put({ key, pack, audio, createdAt: Date.now() }));
        const records = await this._request('readonly', store => store.getAll());
        let bytes = records.reduce((sum, record) => sum + (record.audio?.byteLength ?? 0), 0);
        const oldest = records.filter(record => record.key !== key).sort((a, b) => a.createdAt - b.createdAt);
        const evicted = [];
        while (bytes > PLUS_VOICE_STORE_MAX_BYTES && oldest.length) {
            const record = oldest.shift();
            bytes -= record.audio?.byteLength ?? 0;
            evicted.push(record.key);
        }
        if (evicted.length) await this._request('readwrite', store => evicted.forEach(old => store.delete(old)));
    }

    async clear() {
        await this.init();
        await this._request('readwrite', store => store.clear());
    }
}

export const PlusVoices = new PlusVoiceStore();
