/**
 * R.I.S.E. Source System
 * Museum API Provider (Art Institute of Chicago)
 * 
 * Fetches high-resolution, public domain art and photography.
 * Provides the "Cinematic" aesthetic missing from Wikimedia.
 */

import { SourceProvider } from '../provider.js';
import { SourceCache } from '../cache.js';
import { createAbortError, isAbortError, withAbortTimeout } from './request.js';
import { ShuffleBag } from './shuffle-bag.js';

// AIC artwork_type_id vocabulary (verified against the live API):
// 1 = Painting, 18 = Print. Every category pins a type so nothing can
// smuggle in jewelry, textiles, or sculpture — the recurring necklace
// and carpet were exactly such strays.
const TYPE_PAINTING = 1;
const TYPE_PRINT = 18;

/**
 * Categories are structured Elasticsearch clauses, not prose queries.
 * (Full-text `q` only *ranks* — it never filters, so the old prose
 * categories were all the same 1,946-painting pool sorted differently,
 * with 36% overlap between "Romantic" and "Natural" landscapes.)
 *
 * Each category sits on its most reliable axis, all verified live:
 * - artist rosters (terms on artist_title.keyword) where attribution
 *   is clean — Impressionists 74, Post-Impressionists 36, Ukiyo-e 2,945
 * - a date range for Old Masters (642) — pre-1750 attribution scatters
 *   across "Master of…" and workshop names, so no roster can hold it
 * - subject terms for Landscapes (208) and Portraits (262)
 */
export const MUSEUM_CATEGORIES = {
    'oldmasters': {
        name: 'Old Masters',
        clauses: [
            { term: { artwork_type_id: TYPE_PAINTING } },
            { range: { date_start: { gte: 1400, lte: 1700 } } }
        ],
        tags: ['classical', 'historical', 'cinematic']
    },
    'impressionism': {
        name: 'Monet & the Impressionists',
        clauses: [
            { term: { artwork_type_id: TYPE_PAINTING } },
            {
                terms: {
                    'artist_title.keyword': [
                        'Claude Monet', 'Pierre-Auguste Renoir', 'Gustave Caillebotte',
                        'Camille Pissarro', 'Alfred Sisley', 'Berthe Morisot',
                        'Mary Cassatt', 'Edgar Degas'
                    ]
                }
            }
        ],
        tags: ['light', 'color', 'cinematic']
    },
    'postimpressionism': {
        name: 'Van Gogh & Post-Impressionists',
        clauses: [
            { term: { artwork_type_id: TYPE_PAINTING } },
            {
                terms: {
                    'artist_title.keyword': [
                        'Vincent van Gogh', 'Paul Cezanne', 'Georges Seurat',
                        'Paul Gauguin', 'Henri de Toulouse-Lautrec'
                    ]
                }
            }
        ],
        tags: ['color', 'structure', 'cinematic']
    },
    'ukiyoe': {
        name: 'Masters of Ukiyo-e',
        clauses: [
            { term: { artwork_type_id: TYPE_PRINT } },
            {
                terms: {
                    'artist_title.keyword': [
                        'Utagawa Hiroshige', 'Katsushika Hokusai', 'Kitagawa Utamaro',
                        'Suzuki Harunobu', 'Torii Kiyonaga', 'Tōshūsai Sharaku'
                    ]
                }
            }
        ],
        tags: ['japanese', 'contemplative', 'linear']
    },
    'landscapes': {
        name: 'Landscapes',
        clauses: [
            { term: { artwork_type_id: TYPE_PAINTING } },
            { term: { 'subject_titles.keyword': 'landscapes' } }
        ],
        tags: ['nature', 'serene', 'cinematic']
    },
    'portraits': {
        name: 'Portraits',
        clauses: [
            { term: { artwork_type_id: TYPE_PAINTING } },
            { term: { 'subject_titles.keyword': 'portraits' } }
        ],
        tags: ['human', 'presence', 'cinematic']
    }
};

// Retired ids → their richest living neighbor, so saved configs keep
// receiving art instead of a dead fallback. (Surrealism: the movement
// is still in copyright, its PD query was noise. Photography read as
// drab. Romantic/Natural landscapes were the same pool as Landscapes.
// Renaissance grew into the wider Old Masters range.)
const RETIRED_CATEGORIES = {
    'surrealism': 'postimpressionism',
    'photography': 'ukiyoe',
    'romantic': 'landscapes',
    'renaissance': 'oldmasters'
};

/**
 * Serialize a nested clause object into the PHP-style bracket params
 * the AIC API parses, e.g. query[bool][must][1][terms][field][0]=x
 */
function flattenClause(value, prefix, params) {
    if (Array.isArray(value)) {
        value.forEach((v, i) => flattenClause(v, `${prefix}[${i}]`, params));
    } else if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) {
            flattenClause(v, `${prefix}[${k}]`, params);
        }
    } else {
        params[prefix] = String(value);
    }
}

export class MuseumProvider extends SourceProvider {
    constructor() {
        super({
            id: 'museum-aic',
            name: 'Art Institute of Chicago',
            contentType: 'image',
            tier: 2, // Sacred tier
            description: 'Ultra-high-resolution art and cinematic photography',
            supportsSearch: true,
            supportsPreload: true
        });

        this.baseUrl = 'https://api.artic.edu/api/v1/artworks';
        this.iiifBase = 'https://www.artic.edu/iiif/2';
        this.thumbSize = 843; // Standard high-quality size
        this._candidateBag = new ShuffleBag();
    }

    async _fetch(endpoint, params = {}, options = {}) {
        if (options.signal?.aborted) throw createAbortError();
        const url = new URL(`${this.baseUrl}${endpoint}`);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }

        const request = withAbortTimeout(options.signal, options.timeoutMs ?? 8000, 'ArtIC request');
        try {
            const response = await fetch(url, { signal: request.signal });
            if (!response.ok) throw new Error(`ArtIC HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            if (request.didTimeout() && isAbortError(error)) {
                const timeoutError = new Error(`ArtIC request timed out after ${options.timeoutMs ?? 8000}ms`);
                timeoutError.name = 'TimeoutError';
                throw timeoutError;
            }
            if (isAbortError(error)) throw error;
            console.error('[MuseumProvider] Fetch error:', error);
            throw error;
        } finally {
            request.cleanup();
        }
    }

    async getImagesInCategory(categoryId, limit = 100, options = {}) {
        if (options.signal?.aborted) throw createAbortError();
        const resolvedId = MUSEUM_CATEGORIES[categoryId]
            ? categoryId
            : RETIRED_CATEGORIES[categoryId];
        const cat = MUSEUM_CATEGORIES[resolvedId];
        if (!cat) return [];

        const cacheKey = `cat:${resolvedId}:${limit}`;
        if (this._categoryCache?.has(cacheKey)) return this._categoryCache.get(cacheKey);

        // Structured bool query: public domain AND the category's
        // clauses (artist roster / date range / subject / type)
        const params = {
            'query[bool][must][0][term][is_public_domain]': 'true',
            limit: limit,
            fields: 'id,title,image_id,artist_display,date_display'
        };
        cat.clauses.forEach((clause, i) =>
            flattenClause(clause, `query[bool][must][${i + 1}]`, params));

        const data = await this._fetch('/search', params, options);

        const results = (data.data || []).filter(item => item.image_id).map(item => ({
            id: item.id.toString(),
            title: item.title,
            imageId: item.image_id,
            artist: item.artist_display,
            date: item.date_display,
            url: `${this.iiifBase}/${item.image_id}/full/${this.thumbSize},/0/default.jpg`,
            fullUrl: `${this.iiifBase}/${item.image_id}/full/max/0/default.jpg`
        }));

        if (!this._categoryCache) this._categoryCache = new Map();
        this._categoryCache.set(cacheKey, results);
        return results;
    }

    async list(filter = {}) {
        return Object.entries(MUSEUM_CATEGORIES).map(([id, cat]) => ({
            id: id,
            type: 'image',
            name: cat.name,
            providerId: this.id,
            tier: this.tier,
            metadata: {
                category: id,
                tags: cat.tags,
                description: `High-resolution ${cat.name}`
            }
        }));
    }

    async get(categoryId) {
        const resolvedId = MUSEUM_CATEGORIES[categoryId]
            ? categoryId
            : RETIRED_CATEGORIES[categoryId];
        if (!resolvedId) return null;
        const images = await this.getImagesInCategory(resolvedId, 20);
        if (images.length === 0) return null;

        return {
            id: resolvedId,
            type: 'image',
            name: MUSEUM_CATEGORIES[resolvedId].name,
            data: {
                images: images,
                previewUrl: images[0].url
            },
            providerId: this.id,
            tier: this.tier,
            metadata: {
                images: images,
                count: images.length
            }
        };
    }

    async getRandom(filter = {}) {
        const catIds = Object.keys(MUSEUM_CATEGORIES);
        const requestedId = filter.category || catIds[Math.floor(Math.random() * catIds.length)];
        const catId = MUSEUM_CATEGORIES[requestedId]
            ? requestedId
            : RETIRED_CATEGORIES[requestedId];
        if (!catId) return null;
        
        const images = await this.getImagesInCategory(catId, 100, {
            signal: filter.signal,
            timeoutMs: filter.timeoutMs
        });
        if (images.length === 0) return null;

        const img = this._candidateBag.draw(catId, images);
        if (!img) return null;

        return {
            id: img.id,
            type: 'image',
            name: img.title,
            data: img,
            providerId: this.id,
            tier: this.tier,
            metadata: {
                artist: img.artist,
                date: img.date,
                url: img.url,
                categoryId: catId
            }
        };
    }
}
