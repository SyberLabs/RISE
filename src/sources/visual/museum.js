/**
 * R.I.S.E. Source System
 * Museum API Provider (Art Institute of Chicago)
 * 
 * Fetches high-resolution, public domain art and photography.
 * Provides the "Cinematic" aesthetic missing from Wikimedia.
 */

import { SourceProvider } from '../provider.js';
import { SourceCache } from '../cache.js';

// AIC artwork_type_id vocabulary (verified against the live API):
// 1 = Painting, 18 = Print. Every category pins a type so full-text
// matches can never smuggle in jewelry, textiles, or sculpture — the
// recurring necklace and carpet were exactly such strays.
const TYPE_PAINTING = 1;
const TYPE_PRINT = 18;

export const MUSEUM_CATEGORIES = {
    'renaissance': {
        name: 'Renaissance Art',
        query: 'Renaissance paintings',
        artworkType: TYPE_PAINTING,
        tags: ['classical', 'historical', 'cinematic']
    },
    'romantic': {
        name: 'Romantic Landscapes',
        query: 'Romanticism landscape paintings',
        artworkType: TYPE_PAINTING,
        tags: ['sublime', 'historical', 'cinematic']
    },
    'impressionism': {
        name: 'Impressionist Fields',
        query: 'Impressionism',
        artworkType: TYPE_PAINTING,
        tags: ['light', 'color', 'cinematic']
    },
    'postimpressionism': {
        name: 'Post-Impressionist Masters',
        query: 'Post-Impressionism',
        artworkType: TYPE_PAINTING,
        tags: ['color', 'structure', 'cinematic']
    },
    'ukiyoe': {
        name: 'Ukiyo-e Prints',
        query: 'Japanese woodblock print ukiyo-e',
        artworkType: TYPE_PRINT,
        tags: ['japanese', 'contemplative', 'linear']
    },
    'landscapes': {
        name: 'Natural Landscapes',
        query: 'landscape nature scenery',
        artworkType: TYPE_PAINTING,
        tags: ['nature', 'serene', 'cinematic']
    }
};

// Retired category ids (public-domain surrealism barely exists — the
// movement is still in copyright, so its query degenerated to noise;
// PD photography read as drab). Saved configs holding them get the
// richest neighbor instead of a dead fallback.
const RETIRED_CATEGORIES = {
    'surrealism': 'postimpressionism',
    'photography': 'ukiyoe'
};

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
    }

    async _fetch(endpoint, params = {}) {
        const url = new URL(`${this.baseUrl}${endpoint}`);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`ArtIC HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('[MuseumProvider] Fetch error:', error);
            throw error;
        }
    }

    async getImagesInCategory(categoryId, limit = 50) {
        const resolvedId = MUSEUM_CATEGORIES[categoryId]
            ? categoryId
            : RETIRED_CATEGORIES[categoryId];
        const cat = MUSEUM_CATEGORIES[resolvedId];
        if (!cat) return [];

        const cacheKey = `cat:${resolvedId}:${limit}`;
        if (this._categoryCache?.has(cacheKey)) return this._categoryCache.get(cacheKey);

        // Typed bool query: public domain AND the category's artwork
        // type — full-text q alone let textiles and jewelry rank into
        // painting categories
        const data = await this._fetch('/search', {
            q: cat.query,
            'query[bool][must][0][term][is_public_domain]': 'true',
            'query[bool][must][1][term][artwork_type_id]': String(cat.artworkType),
            limit: limit,
            fields: 'id,title,image_id,artist_display,date_display'
        });

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
        const catId = filter.category || catIds[Math.floor(Math.random() * catIds.length)];
        
        const images = await this.getImagesInCategory(catId, 50);
        if (images.length === 0) return null;

        const img = images[Math.floor(Math.random() * images.length)];

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
