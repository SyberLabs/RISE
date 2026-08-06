/**
 * Science catalog provider — pinned science imagery behind a provider face.
 *
 * The simplest provider in the building, and deliberately so. The Atrium's
 * pinned provider calls `resolveCollection` because its pins are museum
 * object ids that must be turned into image URLs; these works arrive
 * already resolved, rights-checked and credit-composed by
 * `build-science-catalog.mjs`. There is nothing left to fetch, so this
 * makes no network request at all.
 *
 * That is the whole point of the arrangement rather than a happy accident:
 * `connect-src` in netlify.toml does not list ESA/Hubble, NASA or
 * api.si.edu, and it does not need to (SOURCE-EXPANSION-SPEC §3a, "the API
 * key never leaves the workstation"). The reader's browser fetches images
 * and nothing else.
 *
 * THE CREDIT TRAVELS WITH THE WORK. Every record carries `requiredCredit`,
 * composed once at build time by the same `normalizeArtworkLabel` the chip
 * uses. Recomposing it here from parts would put a second author of credit
 * lines in the codebase, which is this project's oldest failure — a
 * vocabulary living in two places where only one copy learns a new word.
 */

import { SCIENCE_CATEGORIES } from './science-pins.js';
import { ShuffleBag } from '../../../sources/visual/shuffle-bag.js';

/** Panel-issued ids are namespaced so they never collide with `aic-`. */
export const SCIENCE_PREFIX = 'sci-';

export const bareCategory = (categoryId) =>
    String(categoryId || '').startsWith(SCIENCE_PREFIX)
        ? String(categoryId).slice(SCIENCE_PREFIX.length)
        : String(categoryId || '');

export function hasScienceCollection(categoryId) {
    return Object.hasOwn(SCIENCE_CATEGORIES, bareCategory(categoryId));
}

let catalogPromise = null;
/**
 * Loaded lazily. A reader who never opens a science collection should not
 * pay for the catalog, and a restored session can name `sci-astronomy`
 * without the panel having rendered this visit.
 */
async function loadCatalog() {
    if (!catalogPromise) {
        catalogPromise = import('../../../sources/visual/science-catalog.generated.json')
            .then(m => m.default || m)
            .catch((error) => {
                console.warn('[Science] catalog unavailable:', error);
                catalogPromise = null;
                return null;
            });
    }
    return catalogPromise;
}

export class ScienceCatalogProvider {
    constructor(options = {}) {
        this.id = options.id || 'science-catalog';
        this.name = options.name || 'Science collections';
        this.contentType = 'image';
        // A curated collection is finite; raw random would repeat a
        // nebula before the reader had seen the rest.
        this._bag = new ShuffleBag();
    }

    /**
     * The contract the cortex's hydration path actually calls. Missing it
     * resolves the right provider and then fails on the next line, and the
     * hydration guard swallows that — which is exactly how a collection
     * silently never enters the pool.
     */
    async getRandom(filter = {}) {
        const categoryId = filter.category;
        const images = await this.getImagesInCategory(categoryId, 200, filter);
        if (images.length === 0) return null;

        const image = this._bag.draw(categoryId, images);
        if (!image) return null;

        return {
            id: image.id,
            type: 'image',
            name: image.title,
            data: image,
            providerId: this.id,
            metadata: {
                artist: image.artist,
                date: image.date,
                license: image.license,
                // The composed line, carried whole. `creditRequired` is
                // explicit because NASA's basis reads as public domain and
                // would otherwise classify as OPEN, dropping the
                // acknowledgement the institution actually asks for.
                attribution: image.attribution,
                creditRequired: image.creditRequired,
                sourceUrl: image.sourceUrl,
                sourceName: image.sourceName,
                categoryId
            }
        };
    }

    /**
     * @param {string} categoryId - a `sci-` category id
     * @returns {Promise<Object[]>} display-ready image records
     */
    async getImagesInCategory(categoryId, limit = 200) {
        const bare = bareCategory(categoryId);
        if (!Object.hasOwn(SCIENCE_CATEGORIES, bare)) return [];

        const catalog = await loadCatalog();
        const collection = catalog?.collections?.[bare];
        if (!collection) return [];

        const wanted = new Set(collection.works || []);
        return (catalog.works || [])
            .filter(work => wanted.has(work.id))
            .slice(0, limit)
            .map(work => ({
                id: work.id,
                title: work.title,
                url: work.image,
                fullUrl: work.image,
                thumbUrl: work.thumb,
                artist: work.artist,
                date: work.date,
                license: work.rights,
                attribution: work.requiredCredit,
                // Everything but an open licence owes a credit, and the
                // catalog already decided which is which.
                creditRequired: work.licence !== 'open',
                sourceUrl: work.sourceUrl,
                sourceName: work.sourceName
            }));
    }

    /** Already resolved; nothing further to fetch. */
    async getImageInfo(item) {
        return item || null;
    }
}

let instance = null;
export function getScienceCatalogProvider() {
    if (!instance) instance = new ScienceCatalogProvider();
    return instance;
}
