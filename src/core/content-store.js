/**
 * The reader's door to the corpus.
 *
 * A BOOK IS NOT A PROGRAM. Works used to be JavaScript modules reached by
 * `import()`, which meant Rollup parsed a novel to emit a chunk and the
 * browser parsed it again to get a string back. Text was 83% of the shipped
 * JavaScript. Now a work is an immutable JSON object on a CDN, addressed by
 * the SHA-256 of its own bytes, and this is the only thing that reads one.
 *
 * THE HASH IS THE URL, AND THAT IS THE POINT. A payload's checksum used to
 * be verified once, at ingest, on the machine that made it. Here it is
 * verified again in the reader's browser, every time, for free — because
 * the address the object was fetched by is the digest it must have. A
 * silently corrupted object cannot be read. The old design could not have
 * that property at any price.
 *
 * REVERENT DEGRADATION IS THE REFUSAL, NOT A FALLBACK. Every failure here
 * throws. A work that will not verify is absent; it is never substituted,
 * never partially rendered, and never quietly replaced by a different
 * edition. Callers show stillness. This mirrors the Chapel's payload
 * integrity check, which has enforced the same rule on scripture since it
 * was written.
 *
 * Three layers, narrowest first: an in-memory map for this session, Cache
 * Storage for this browser (which is what makes offline reading free), and
 * the network. Cache Storage is optional — private browsing has none, and a
 * reading must not depend on it.
 */

const MANIFEST_URL = '/content/manifest.json';

export const CONTENT_CACHE_NAME = 'rise-content-v1';

export class ContentStoreError extends Error {
    constructor(code, message, detail = {}) {
        super(message);
        this.name = 'ContentStoreError';
        this.code = code;
        Object.assign(this, detail);
    }
}

async function sha256Hex(bytes) {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
        throw new ContentStoreError(
            'CONTENT_CRYPTO_UNAVAILABLE',
            'SHA-256 is unavailable, so no payload can be verified.'
        );
    }
    const digest = await subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

export class ContentStore {
    /**
     * @param {Object} [options]
     * @param {Object} [options.manifest] - Pre-resolved manifest; otherwise fetched.
     * @param {Function} [options.fetchImpl]
     * @param {CacheStorage|null} [options.caches] - null disables the durable layer.
     */
    constructor({
        manifest = null,
        fetchImpl = globalThis.fetch?.bind(globalThis),
        caches = globalThis.caches ?? null,
        manifestUrl = MANIFEST_URL
    } = {}) {
        this._manifest = manifest;
        this._manifestLoad = null;
        this._manifestUrl = manifestUrl;
        this._fetch = fetchImpl;
        this._caches = caches;
        this._sections = new Map();   // id → sections
        this._reads = new Map();      // id → in-flight read
    }

    /** The manifest, fetched once. It is the only mutable pointer. */
    async manifest() {
        if (this._manifest) return this._manifest;
        this._manifestLoad ||= (async () => {
            let response;
            try {
                response = await this._fetch(this._manifestUrl, { cache: 'no-cache' });
            } catch (error) {
                throw new ContentStoreError(
                    'CONTENT_MANIFEST_UNAVAILABLE',
                    'The content manifest could not be reached.',
                    { cause: error }
                );
            }
            if (!response?.ok) {
                throw new ContentStoreError(
                    'CONTENT_MANIFEST_UNAVAILABLE',
                    `The content manifest returned HTTP ${response?.status ?? 'unknown'}.`
                );
            }
            this._manifest = await response.json();
            return this._manifest;
        })();
        try {
            return await this._manifestLoad;
        } finally {
            this._manifestLoad = null;
        }
    }

    async entry(id) {
        const manifest = await this.manifest();
        const found = manifest?.works?.find(work => work.id === id);
        if (!found) {
            throw new ContentStoreError(
                'CONTENT_UNKNOWN_WORK',
                `The manifest does not name "${id}".`,
                { workId: id }
            );
        }
        if (found.shelved !== true) {
            // Withholding is a field, not a code path. The reason travels
            // with the refusal so a caller can say what it is.
            throw new ContentStoreError(
                'CONTENT_WITHHELD',
                found.withheldReason || `"${id}" is withheld.`,
                { workId: id, withheldReason: found.withheldReason ?? null }
            );
        }
        return found;
    }

    /**
     * A work's sections: `[{name, content, verse?}, ...]`.
     * Rejects rather than degrading; the caller shows stillness.
     */
    async getSections(id) {
        if (this._sections.has(id)) return this._sections.get(id);
        if (this._reads.has(id)) return this._reads.get(id);

        const read = this._read(id)
            .then(sections => {
                this._sections.set(id, sections);
                return sections;
            })
            .finally(() => this._reads.delete(id));

        this._reads.set(id, read);
        return read;
    }

    /** Drop the in-session copy. Cache Storage keeps its own. */
    forget(id) {
        this._sections.delete(id);
    }

    async _read(id) {
        const entry = await this.entry(id);
        const cache = await this._openCache();

        const cached = await this._readCached(cache, entry);
        if (cached !== null) return cached;

        let response;
        try {
            response = await this._fetch(entry.url, { cache: 'force-cache' });
        } catch (error) {
            throw new ContentStoreError(
                'CONTENT_UNAVAILABLE',
                `"${id}" could not be reached.`,
                { workId: id, url: entry.url, cause: error }
            );
        }
        if (!response?.ok) {
            throw new ContentStoreError(
                'CONTENT_UNAVAILABLE',
                `"${id}" returned HTTP ${response?.status ?? 'unknown'}.`,
                { workId: id, url: entry.url }
            );
        }

        const text = await response.text();
        const sections = await this._verify(entry, text);

        // Stored only after it verified, so the durable layer can never
        // hold bytes this store would refuse.
        if (cache) {
            try {
                await cache.put(entry.url, new Response(text));
            } catch (error) {
                console.warn('[ContentStore] Could not cache', entry.url, error);
            }
        }
        return sections;
    }

    async _readCached(cache, entry) {
        if (!cache) return null;
        let text;
        try {
            const hit = await cache.match(entry.url);
            if (!hit) return null;
            text = await hit.text();
        } catch (error) {
            console.warn('[ContentStore] Cache read failed for', entry.url, error);
            return null;
        }
        try {
            return await this._verify(entry, text);
        } catch (error) {
            // A stored object that no longer verifies is evicted rather than
            // served. Falling through to the network is correct here: the
            // authority is the hash, and the network may still satisfy it.
            console.warn('[ContentStore] Evicting unverifiable cache entry', entry.url);
            await cache.delete(entry.url).catch(() => {});
            return null;
        }
    }

    async _verify(entry, text) {
        const bytes = new TextEncoder().encode(text);
        const digest = await sha256Hex(bytes);
        if (digest !== entry.sha256) {
            throw new ContentStoreError(
                'CONTENT_PAYLOAD_INTEGRITY',
                `"${entry.id}" did not verify and will not be read.`,
                { workId: entry.id, expected: entry.sha256, actual: digest }
            );
        }
        let sections;
        try {
            sections = JSON.parse(text);
        } catch (error) {
            throw new ContentStoreError(
                'CONTENT_PAYLOAD_MALFORMED',
                `"${entry.id}" is not readable JSON.`,
                { workId: entry.id, cause: error }
            );
        }
        if (!Array.isArray(sections) || sections.length === 0) {
            throw new ContentStoreError(
                'CONTENT_PAYLOAD_MALFORMED',
                `"${entry.id}" carries no sections.`,
                { workId: entry.id }
            );
        }
        return sections;
    }

    async _openCache() {
        if (!this._caches?.open) return null;
        try {
            return await this._caches.open(CONTENT_CACHE_NAME);
        } catch (error) {
            console.warn('[ContentStore] Cache Storage unavailable:', error);
            return null;
        }
    }
}

/** The reader's one store. */
export const contentStore = new ContentStore();

/** What a catalogue entry's loader calls. */
export function loadArchiveSections(id) {
    return contentStore.getSections(id);
}
