/**
 * Science catalog provider — pinned science imagery behind a provider face.
 *
 * The simplest provider in the building, and deliberately so. The
 * pinned-works provider calls `resolveCollection` because its pins are
 * museum object ids that must be turned into image URLs; these works arrive
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

import { ShuffleBag } from '../../../sources/visual/shuffle-bag.js';

/** Panel-issued ids are namespaced so they never collide with `aic-`. */
export const SCIENCE_PREFIX = 'sci-';

export const bareCategory = (categoryId) =>
    String(categoryId || '').startsWith(SCIENCE_PREFIX)
        ? String(categoryId).slice(SCIENCE_PREFIX.length)
        : String(categoryId || '');

/**
 * Every frozen, pre-verified collection by its bare id, with the generated catalog that holds it. Each catalog is
 * imported only when one of its collections is asked for: a reader who never opens one should not pay for it, and a
 * restored session can name `sci-astronomy` without the panel having rendered this visit.
 */
const CATALOGS = Object.freeze({
    astronomy: () => import('../../../sources/visual/science-catalog.generated.json'),
    landscapes: () => import('../../../sources/visual/landscapes-catalog.generated.json'),
    'earth-and-sky': () => import('../../../sources/visual/landscapes-catalog.generated.json')
});

export function hasScienceCollection(categoryId) {
    return Object.hasOwn(CATALOGS, bareCategory(categoryId));
}

const catalogPromises = new Map();
async function loadCatalog(bare) {
    if (!catalogPromises.has(bare)) {
        catalogPromises.set(bare, CATALOGS[bare]()
            .then(m => m.default || m)
            .catch((error) => {
                console.warn('[Science] catalog unavailable:', error);
                catalogPromises.delete(bare);
                return null;
            }));
    }
    return catalogPromises.get(bare);
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

        // A collection's opening photograph, the first into an empty pool, is one of the owner's favourites where it
        // has any; every draw after it is the usual shuffle.
        const favourites = filter.opening ? images.filter(item => item.favourite) : [];
        const image = favourites.length
            ? favourites[Math.floor(Math.random() * favourites.length)]
            : this._bag.draw(categoryId, images);
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
        if (!Object.hasOwn(CATALOGS, bare)) return [];

        const catalog = await loadCatalog(bare);
        const collection = catalog?.collections?.[bare];
        if (!collection) return [];

        const wanted = new Set(collection.works || []);
        const favourites = new Set(collection.favourites || []);
        // The owner's favourites lead the list, in the catalog's order: a cue's prepared first work is the list's first
        // (visual-cortex prepareCue). The order is fixed, since the ShuffleBag reads a reordered list as a new deck.
        const lead = (work) => (favourites.has(work.id) ? 0 : 1);
        return (catalog.works || [])
            .filter(work => wanted.has(work.id))
            .sort((a, b) => lead(a) - lead(b))
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
                sourceName: work.sourceName,
                favourite: favourites.has(work.id)
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
