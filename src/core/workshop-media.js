/**
 * Durable Workshop sequence-image store.
 *
 * Authored score media must not live as base64 inside localStorage (ROADMAP
 * Phase 0.4 finding #3). Blobs live here; project JSON keeps metadata + ids.
 * Deliberately separate from SourceCache (TTL/LRU) and PersonalSwells (audio).
 */

import { READING_LIMITS } from './reading-limits.js';

const DB_NAME = 'rise-workshop-media';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const MAX_STORE_BYTES = 256 * 1024 * 1024;

export class WorkshopMediaError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'WorkshopMediaError';
    this.code = code;
    this.details = details;
  }
}

function exactId(value, label) {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > 160) {
    throw new WorkshopMediaError('WORKSHOP_MEDIA_ID', `${label} must be a non-empty, trimmed id.`, {
      label
    });
  }
  return value;
}

function requireImageBlob(blob) {
  if (!(blob instanceof Blob)) {
    throw new WorkshopMediaError('WORKSHOP_MEDIA_BLOB', 'Sequence images must be Blob data.');
  }
  const mimeType = String(blob.type || '').trim();
  if (!mimeType.startsWith('image/')) {
    throw new WorkshopMediaError('WORKSHOP_MEDIA_MIME', 'Sequence images must be image/* blobs.', {
      mimeType
    });
  }
  if (blob.size <= 0 || blob.size > READING_LIMITS.maxImageFileBytes) {
    throw new WorkshopMediaError(
      'WORKSHOP_MEDIA_SIZE',
      `Sequence images must be between 1 byte and ${READING_LIMITS.maxImageFileBytes} bytes.`,
      { byteLength: blob.size }
    );
  }
  return { blob, mimeType, byteLength: blob.size };
}

export class WorkshopMediaStore {
  constructor() {
    /** @type {IDBDatabase|null} */
    this.db = null;
    this._initPromise = null;
    this._ready = false;
    /** @type {Map<string, string>} */
    this._objectUrls = new Map();
    /**
     * Running total of stored bytes, seeded at init and updated on write.
     * Avoids getAll() on every put just to re-sum sizes already known.
     * @type {number}
     */
    this._totalBytes = 0;
  }

  async init() {
    if (this._ready) return;
    if (this._initPromise) return this._initPromise;

    if (typeof indexedDB === 'undefined') {
      throw new WorkshopMediaError('WORKSHOP_MEDIA_UNAVAILABLE', 'IndexedDB is unavailable.');
    }

    this._initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(request.error || new WorkshopMediaError(
          'WORKSHOP_MEDIA_OPEN',
          'Failed to open Workshop media database.'
        ));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this._ready = true;
        // Seed with a cursor over byteLength — never materialise Blobs
        // just to sum sizes.
        this._sumStoredBytes().then((total) => {
          this._totalBytes = total;
          resolve();
        }, reject);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('projectId', 'projectId', { unique: false });
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

  async estimateBytes() {
    await this.init();
    return this._totalBytes;
  }

  /** Authoritative scan — used to seed the running total, and by tests. */
  async _sumStoredBytes() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const request = transaction.objectStore(STORE_NAME).openCursor();
      let total = 0;
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { resolve(total); return; }
        total += Number(cursor.value?.byteLength) || 0;
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async put({ id, projectId, data, mimeType = null }) {
    const assetId = exactId(id, 'Asset id');
    const ownerId = exactId(projectId, 'Project id');
    const normalized = requireImageBlob(data);
    const type = typeof mimeType === 'string' && mimeType.startsWith('image/')
      ? mimeType.trim()
      : normalized.mimeType;

    await this.init();

    // One readwrite transaction for get, budget check, and put so the
    // decision and the write cannot race across tabs.
    const record = {
      id: assetId,
      projectId: ownerId,
      mimeType: type,
      byteLength: normalized.byteLength,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: normalized.blob
    };
    let quotaError = null;
    let committedTotal = this._totalBytes;

    await new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const existingRequest = store.get(assetId);

      existingRequest.onsuccess = () => {
        const existing = existingRequest.result || null;
        const nextTotal = this._totalBytes
          - (existing ? Number(existing.byteLength) || 0 : 0)
          + normalized.byteLength;
        if (nextTotal > MAX_STORE_BYTES) {
          quotaError = new WorkshopMediaError(
            'WORKSHOP_MEDIA_QUOTA',
            'Workshop media storage budget exceeded.',
            { byteLength: normalized.byteLength, storeBytes: nextTotal }
          );
          transaction.abort();
          return;
        }
        // Replacing keeps the original creation time; the store is the
        // only thing that knows whether this id existed.
        if (existing?.createdAt) record.createdAt = existing.createdAt;
        committedTotal = nextTotal;
        store.put(record);
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(quotaError || transaction.error);
      transaction.onabort = () => reject(
        quotaError || transaction.error || new Error('Workshop media put aborted')
      );
    });

    // Only after the transaction has actually committed.
    this._totalBytes = committedTotal;
    this.revokeObjectUrl(assetId);
    return {
      id: record.id,
      projectId: record.projectId,
      mimeType: record.mimeType,
      byteLength: record.byteLength,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };
  }

  async get(id) {
    const assetId = exactId(id, 'Asset id');
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(assetId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async has(id) {
    return (await this.get(id)) != null;
  }

  /**
   * Resolve a durable record into a short-lived object URL for DOM / cortex.
   * Callers that own a project lifecycle should revoke via revokeProject /
   * revokeObjectUrl when done.
   */
  async resolveObjectUrl(id) {
    const assetId = exactId(id, 'Asset id');
    const cached = this._objectUrls.get(assetId);
    if (cached) return cached;
    const record = await this.get(assetId);
    if (!record?.data) {
      throw new WorkshopMediaError(
        'WORKSHOP_MEDIA_MISSING',
        `Workshop media ${assetId} is missing.`,
        { id: assetId }
      );
    }
    const url = URL.createObjectURL(record.data);
    this._objectUrls.set(assetId, url);
    return url;
  }

  revokeObjectUrl(id) {
    if (typeof id !== 'string' || !id) return;
    const url = this._objectUrls.get(id);
    if (!url) return;
    URL.revokeObjectURL(url);
    this._objectUrls.delete(id);
  }

  async delete(id) {
    const assetId = exactId(id, 'Asset id');
    await this.init();
    this.revokeObjectUrl(assetId);
    // Read the size and remove the record in the same transaction, so the
    // running total is decremented by what was actually there.
    let removedBytes = 0;
    await new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const existingRequest = store.get(assetId);
      existingRequest.onsuccess = () => {
        removedBytes = Number(existingRequest.result?.byteLength) || 0;
        store.delete(assetId);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Workshop media delete aborted'));
    });
    this._totalBytes = Math.max(0, this._totalBytes - removedBytes);
  }

  async deleteByProject(projectId) {
    const ownerId = exactId(projectId, 'Project id');
    await this.init();
    const records = await this._getByProject(ownerId);
    await Promise.all(records.map(record => this.delete(record.id)));
  }

  async clear() {
    await this.init();
    for (const id of [...this._objectUrls.keys()]) this.revokeObjectUrl(id);
    await new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      transaction.objectStore(STORE_NAME).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Workshop media clear aborted'));
    });
    this._totalBytes = 0;
  }

  /** Full records including Blobs — for export / diagnostics only. */
  async getAllRecords() {
    await this.init();
    return this._getAll();
  }

  async _getAll() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async _getByProject(projectId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const index = transaction.objectStore(STORE_NAME).index('projectId');
      const request = index.getAll(projectId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
}

/** Convert a data:image URI into a Blob for durable storage. */
export function dataImageUriToBlob(uri) {
  if (typeof uri !== 'string' || !uri.startsWith('data:image/')) {
    throw new WorkshopMediaError('WORKSHOP_MEDIA_DATA_URI', 'Expected a data:image URI.');
  }
  const comma = uri.indexOf(',');
  if (comma < 0) {
    throw new WorkshopMediaError('WORKSHOP_MEDIA_DATA_URI', 'Malformed data:image URI.');
  }
  const header = uri.slice(0, comma);
  const payload = uri.slice(comma + 1);
  const mimeMatch = header.match(/^data:(image\/[a-z0-9.+-]+)/i);
  if (!mimeMatch) {
    throw new WorkshopMediaError('WORKSHOP_MEDIA_DATA_URI', 'Malformed data:image MIME type.');
  }
  const mimeType = mimeMatch[1].toLowerCase();
  const isBase64 = /;base64/i.test(header);
  try {
    if (isBase64) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mimeType });
    }
    return new Blob([decodeURIComponent(payload)], { type: mimeType });
  } catch (error) {
    throw new WorkshopMediaError(
      'WORKSHOP_MEDIA_DATA_URI',
      'Could not decode data:image URI.',
      { cause: error }
    );
  }
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Could not read image blob'));
    reader.readAsDataURL(blob);
  });
}

export const WorkshopMedia = new WorkshopMediaStore();
