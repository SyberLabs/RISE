/**
 * Haeckel's Kunstformen der Natur (1904) as a pinned plate collection.
 *
 * The plates come from haeckel-catalog.generated.json, written by
 * scripts/build-haeckel-catalog.mjs from the Commons gallery page and
 * audited there (public domain by age, size, sha1, a URL that answered).
 * Nothing here reaches Commons: the reader's browser fetches image bytes
 * from upload.wikimedia.org and nothing else.
 *
 * Ids are namespaced (SOURCE-CURATION-SPEC §4): `haeckel:plates` is the
 * book, `haeckel:plates/<n>` its plate n alone, which is how a picture
 * work's unit n shows plate n. The bare `haeckel` was the retired searched
 * Wikimedia category and resolves to nothing.
 */

import { ShuffleBag } from './shuffle-bag.js';

export const HAECKEL_PLATES = 'haeckel:plates';
const PLATE_COUNT = 100;
const SINGLE = /^haeckel:plates\/([1-9]\d{0,2})$/u;

function plateNumber(categoryId) {
    const match = SINGLE.exec(String(categoryId || ''));
    const plate = match ? Number(match[1]) : 0;
    return plate >= 1 && plate <= PLATE_COUNT ? plate : 0;
}

export function hasHaeckelCollection(categoryId) {
    return categoryId === HAECKEL_PLATES || plateNumber(categoryId) > 0;
}

let catalogPromise = null;
/** Lazy: a reader who never opens the plates does not load their catalog. */
function loadCatalog() {
    catalogPromise ??= import('./haeckel-catalog.generated.json').then(m => m.default || m);
    return catalogPromise;
}

function work(plate) {
    return {
        id: `${HAECKEL_PLATES}/${plate.plate}`,
        title: `Tafel ${plate.plate} · ${plate.title}`,
        url: plate.image,
        fullUrl: plate.original,
        artist: 'Ernst Haeckel',
        date: '1904',
        license: 'PUBLIC_DOMAIN',
        attribution: plate.attribution,
        sourceUrl: plate.sourceUrl,
        sourceName: 'Wikimedia Commons'
    };
}

export class HaeckelPlatesProvider {
    constructor() {
        this.id = 'haeckel-plates';
        this.name = 'Haeckel · Kunstformen der Natur';
        this.contentType = 'image';
        // The book is seen through before a plate repeats.
        this._bag = new ShuffleBag();
    }

    async getRandom(filter = {}) {
        const categoryId = filter.category;
        const images = await this.getImagesInCategory(categoryId);
        const image = images.length ? this._bag.draw(categoryId, images) : null;
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
                attribution: image.attribution,
                sourceUrl: image.sourceUrl,
                sourceName: image.sourceName,
                categoryId
            }
        };
    }

    /** The book's plates in plate order, or the one plate its id names. */
    async getImagesInCategory(categoryId, limit = PLATE_COUNT) {
        if (!hasHaeckelCollection(categoryId)) return [];
        const { plates } = await loadCatalog();
        const plate = plateNumber(categoryId);
        return (plate ? plates.filter(entry => entry.plate === plate) : plates).slice(0, limit).map(work);
    }

    /** Already resolved; nothing further to fetch. */
    async getImageInfo(item) {
        return item || null;
    }
}

let instance = null;
export function getHaeckelPlatesProvider() {
    instance ??= new HaeckelPlatesProvider();
    return instance;
}
