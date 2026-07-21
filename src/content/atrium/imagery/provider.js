/**
 * Pinned-works provider — the imagery service behind a provider face.
 *
 * The cortex asks providers for images by category id. This adapts the
 * pinned collections to that shape so a curated Atrium reading can show
 * David's Death of Socrates where it previously showed whatever a
 * keyword search returned that day.
 *
 * ISOLATION (ATRIUM-IMAGERY-SPEC.md §5): this is not registered with
 * the Chamber's provider registry. The cortex reaches it only for ids
 * that a pinned collection defines, which only an Atrium launch can
 * supply. A reader browsing Collections never encounters it.
 */

import { ATRIUM_PINNED_COLLECTIONS } from './collections.js';
import { resolveCollection } from './service.js';
import { attributionLine } from './works.js';

export function hasPinnedCollection(id) {
    return Object.hasOwn(ATRIUM_PINNED_COLLECTIONS, id);
}

/**
 * A minimal provider surface: enough for the cortex's hydrate path,
 * without inheriting SourceProvider's registry lifecycle (which would
 * make it discoverable, and it must not be).
 */
export class PinnedWorksProvider {
    constructor() {
        this.id = 'atrium-pinned';
        this.name = 'Atrium curated works';
        this.contentType = 'image';
    }

    /**
     * @param {string} categoryId - an `atr-` pinned collection id
     * @param {number} [limit]
     * @param {Object} [options] - { signal }
     * @returns {Promise<Object[]>} display-ready image records
     */
    async getImagesInCategory(categoryId, limit = 20, options = {}) {
        const collection = ATRIUM_PINNED_COLLECTIONS[categoryId];
        if (!collection) return [];

        const works = await resolveCollection(collection, options);
        return works.slice(0, limit).map(work => ({
            // The cortex's image contract
            id: work.id,
            title: work.title,
            url: work.imageUrl,
            fullUrl: work.fullImageUrl,
            // Provenance the Atrium can display and Study mode will need
            artist: work.artist,
            date: work.date,
            license: work.rights,
            attribution: attributionLine(work),
            sourceUrl: work.sourceUrl,
            sourceName: work.sourceName
        }));
    }

    /** Pinned works are already resolved; nothing further to fetch. */
    async getImageInfo(item) {
        return item || null;
    }
}

let instance = null;
export function getPinnedWorksProvider() {
    if (!instance) instance = new PinnedWorksProvider();
    return instance;
}
