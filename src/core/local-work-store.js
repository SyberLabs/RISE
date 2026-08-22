/**
 * Durable store for a reader's own works — the shelf behind the Library door.
 *
 * A sibling of WorkshopMedia, not an extension of it. That store holds Blobs
 * and admits `image/*` and `video/mp4`; this one holds `rise.local-work.v1`
 * records and admits no binary at all. Widening WorkshopMedia's MIME list to
 * carry text would put a reader's prose behind a quota built for video and
 * make one eviction policy answer two questions it cannot both answer.
 *
 * THE RECORD IS THE PRODUCT; THIS IS ONE HYDRATOR OF IT. Everything that
 * decides what a work IS lives in local-works.js and runs in Node. This file
 * only persists what that module validated, and validates again on the way in
 * and on the way out — a record written by an older build is still a record
 * this build has to refuse rather than serve.
 */

import { LocalWorkError, validateLocalWork } from './local-works.js';
import { READING_LIMITS } from './reading-limits.js';

const DB_NAME = 'rise-local-works';
const DB_VERSION = 1;
const STORE_NAME = 'works';

/**
 * The shelf is finite. Ten of the largest works a reader may admit — beyond
 * that the browser's own quota starts refusing writes, and a quota refusal
 * arrives as an opaque failure at save time rather than as a sentence.
 */
export const MAX_LOCAL_WORKS = 40;
const MAX_STORE_CHARACTERS = READING_LIMITS.maxTextCharacters * 10;

export class LocalWorkStore {
  constructor() {
    /** @type {IDBDatabase|null} */
    this.db = null;
    this._initPromise = null;
    this._ready = false;
  }

  async init() {
    if (this._ready) return;
    if (this._initPromise) return this._initPromise;

    if (typeof indexedDB === 'undefined') {
      throw new LocalWorkError('IndexedDB is unavailable.', 'LOCAL_WORK_UNAVAILABLE');
    }

    this._initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(
        request.error || new LocalWorkError('Failed to open the local works store.', 'LOCAL_WORK_OPEN')
      );
      request.onsuccess = () => {
        this.db = request.result;
        this._ready = true;
        resolve();
      };
      request.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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

  _run(mode, work) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], mode);
      const request = work(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(
        request.error || new LocalWorkError('The local works store refused the write.', 'LOCAL_WORK_WRITE')
      );
    });
  }

  /**
   * Save a work, replacing any earlier version of the same id.
   *
   * Replacing rather than appending is what makes re-admitting a file an edit
   * instead of a duplicate: the id is minted from the title, so a reader who
   * drops the same diary twice has one shelf entry with their latest joints
   * in it. It also means a rename mints a NEW id and leaves the old work
   * standing — which is correct, because a score may already point at it.
   */
  async save(record) {
    validateLocalWork(record);
    await this.init();
    const existing = await this.all();
    const others = existing.filter(work => work.id !== record.id);

    if (others.length >= MAX_LOCAL_WORKS) {
      throw new LocalWorkError(
        `The shelf holds ${MAX_LOCAL_WORKS} of your own works. Remove one to add another.`,
        'LOCAL_WORK_SHELF_FULL'
      );
    }
    const characters = others.reduce((total, work) => total + work.text.length, 0) + record.text.length;
    if (characters > MAX_STORE_CHARACTERS) {
      throw new LocalWorkError(
        'Your own works fill the space available. Remove one to add another.',
        'LOCAL_WORK_SHELF_FULL'
      );
    }

    await this._run('readwrite', store => store.put({ ...record, savedAt: new Date().toISOString() }));
    return record;
  }

  async get(id) {
    await this.init();
    const record = await this._run('readonly', store => store.get(id));
    if (!record) return null;
    return this._served(record);
  }

  /**
   * Every work on the shelf, newest first.
   *
   * A record this build cannot validate is SKIPPED, not thrown on. One
   * malformed row from an older schema must not take the whole Library door
   * down with it — the reader would lose every other work they admitted, to
   * fix nothing.
   */
  async all() {
    await this.init();
    const rows = await this._run('readonly', store => store.getAll());
    return (Array.isArray(rows) ? rows : [])
      .map(row => this._served(row))
      .filter(Boolean)
      .sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
  }

  _served(row) {
    try {
      return validateLocalWork(row);
    } catch {
      return null;
    }
  }

  async drop(id) {
    await this.init();
    await this._run('readwrite', store => store.delete(id));
  }

  async clear() {
    await this.init();
    await this._run('readwrite', store => store.clear());
  }
}

export const LocalWorks = new LocalWorkStore();
