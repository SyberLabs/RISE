/**
 * R.I.S.E. Source System
 * Museum API Provider (Art Institute of Chicago)
 * 
 * Fetches high-resolution, public domain art and photography.
 * Provides the "Cinematic" aesthetic missing from Wikimedia.
 */

import { SourceProvider } from '../provider.js';
import { SourceCache } from '../cache.js';

export const MUSEUM_CATEGORIES = {
    'renaissance': {
        name: 'Renaissance Art',
        query: 'Renaissance paintings',
        tags: ['classical', 'historical', 'cinematic']
    },
    'romantic': {
        name: 'Romantic Landscapes',
        query: 'Romanticism landscape paintings',
        tags: ['sublime', 'historical', 'cinematic']
    },
    'impressionism': {
        name: 'Impressionist Fields',
        query: 'Impressionism',
        tags: ['light', 'color', 'cinematic']
    },
    'photography': {
        name: 'Cinematic Photography',
        query: 'Photography',
        filter: 'is_public_domain=true',
        tags: ['cinematic', 'composition', 'modern']
    },
    'surrealism': {
        name: 'Surrealist Forms',
        query: 'Surrealism',
        tags: ['visionary', 'psychological', 'cinematic']
    },
    'landscapes': {
        name: 'Natural Landscapes',
        query: 'landscape nature scenery',
        tags: ['nature', 'serene', 'cinematic']
    }
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
        const cat = MUSEUM_CATEGORIES[categoryId];
        if (!cat) return [];

        const cacheKey = `cat:${categoryId}:${limit}`;
        if (this._categoryCache?.has(cacheKey)) return this._categoryCache.get(cacheKey);

        const data = await this._fetch('/search', {
            q: cat.query,
            'query[term][is_public_domain]': 'true',
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
        const images = await this.getImagesInCategory(categoryId, 20);
        if (images.length === 0) return null;

        return {
            id: categoryId,
            type: 'image',
            name: MUSEUM_CATEGORIES[categoryId].name,
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
