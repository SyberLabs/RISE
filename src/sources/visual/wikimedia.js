/**
 * R.I.S.E. Source System
 * Wikimedia Commons Provider
 * 
 * Fetches images from Wikimedia Commons API.
 * Focuses on diagrams, mathematical illustrations, and public domain art.
 */

import { SourceProvider } from '../provider.js';
import { SourceCache } from '../cache.js';
import { abortableDelay, createAbortError, isAbortError, withAbortTimeout } from './request.js';
import { ShuffleBag } from './shuffle-bag.js';

// Category membership is lightweight title metadata. A wider candidate window
// improves variety without increasing image-info requests or decoded images.
const RANDOM_CANDIDATE_LIMIT = 250;
const MIN_DISPLAY_AREA = 360_000;

/**
 * Curated categories for R.I.S.E. visual content
 * Based on diagram.txt catalog
 */
export const WIKIMEDIA_CATEGORIES = {

    'haeckel': {
        name: 'Haeckel Biology',
        category: 'Category:Kunstformen der Natur',
        tags: ['natural', 'biological', 'symmetry']
    },
    'botany': {
        name: 'Botanical Flora',
        category: 'Category:Botanical illustrations',
        tags: ['natural', 'biological', 'flora']
    },
    'anatomy': {
        name: 'Historic Anatomy',
        category: 'Category:Historic anatomical plates and drawings',
        tags: ['anatomical', 'vitruvian', 'historical']
    },
    'astronomy': {
        name: 'Celestial Mechanics',
        category: 'Category:Astronomical diagrams',
        tags: ['space', 'physics', 'cosmic']
    },
    'geometry': {
        name: 'Geometric Proofs',
        category: 'Category:Mathematical diagrams',
        tags: ['geometric', 'mathematical', 'pattern']
    },
    'fractals': {
        name: 'Fractal Patterns',
        category: 'Category:Fractals',
        tags: ['mathematical', 'recursive', 'complexity']
    },
    'microscopy': {
        name: 'Microscopic Forms',
        category: 'Category:Microscopic Cellular Forms',
        tags: ['microscopic', 'cellular', 'biological']
    },
    'romantic': {
        name: 'Romantic Landscapes',
        category: 'Category:Romantic paintings',
        tags: ['aesthetic', 'historical', 'sublime']
    },
    'sacred': {
        name: 'Sacred Symmetry',
        category: 'Category:Sacred geometry',
        tags: ['geometric', 'spiritual', 'pattern', 'symmetry']
    },
    'solar': {
        name: 'Solar Dynamics',
        category: 'Category:Sun',
        tags: ['solar', 'sun', 'astronomy', 'energy']
    }
};

/**
 * Regex patterns for filtering out unwanted imagery
 */
const IMAGE_BLACKLIST = [
    /pentagram/i,
    /occult/i,
    /satan/i,
    /demon/i,
    /witch/i,
    /ritual/i,
    /magic/i,
    /esoteric/i,
    /mystical/i,
    /supernatural/i,
    /oracle/i,
    /pagan/i,
    /altar/i,
    /cult/i,
    /sigil/i,
    /hex/i
];

/**
 * Provider for Wikimedia Commons images
 */
export class WikimediaProvider extends SourceProvider {
    constructor() {
        super({
            id: 'wikimedia-commons',
            name: 'Wikimedia Commons',
            contentType: 'diagram',
            tier: 3, // Literary tier
            description: 'Public domain diagrams and illustrations from Wikimedia Commons',
            supportsSearch: true,
            supportsPreload: true
        });

        this.baseUrl = 'https://commons.wikimedia.org/w/api.php';
        this.thumbWidth = 1200; // Thumbnail width — raised from 800 so
        // Wikimedia frames sit closer to the AIC's 843px IIIF quality
        // when both providers share a session's rotation

        // Rate limiting state
        this._lastRequestTime = 0;
        this._minRequestInterval = 200; // 200ms between API calls
        this._cooldownUntil = 0;

        // In-memory cache for current session
        this._imageCache = new Map();
        this._categoryCache = new Map();
        this._candidateBag = new ShuffleBag();
    }

    /**
     * @override
     */
    async _doInit() {
        console.log(`[WikimediaProvider] Available categories: ${Object.keys(WIKIMEDIA_CATEGORIES).length}`);
        console.log(`[WikimediaProvider] Active Blacklist: ${IMAGE_BLACKLIST.length} patterns`);
    }

    /**
     * Check if a text (title or description) matches the blacklist
     * @private
     */
    _isBlacklisted(text) {
        if (!text) return false;
        return IMAGE_BLACKLIST.some(pattern => pattern.test(text));
    }

    _isDisplayQuality(imageInfo) {
        if (imageInfo?.mime === 'image/svg+xml') return true;
        const width = Number(imageInfo?.width);
        const height = Number(imageInfo?.height);
        // Missing legacy/SVG dimensions remain eligible; only candidates that
        // are demonstrably too small for the chamber are rejected.
        if (!Number.isFinite(width) || !Number.isFinite(height)) return true;
        return width * height >= MIN_DISPLAY_AREA;
    }

    /**
     * Build API URL with parameters
     * @private
     */
    _buildUrl(params) {
        const url = new URL(this.baseUrl);
        url.searchParams.set('format', 'json');
        url.searchParams.set('origin', '*'); // CORS

        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }

        return url.toString();
    }

    /**
     * Fetch from Wikimedia API
     * @private
     */
    async _fetch(params, options = {}) {
        if (options.signal?.aborted) throw createAbortError();
        // Check for 429 cooldown
        if (Date.now() < this._cooldownUntil) {
            console.warn('[WikimediaProvider] In 429 cooldown, skipping request.');
            throw new Error('Wikimedia Rate Limit Active');
        }

        // Apply min interval
        const now = Date.now();
        const wait = Math.max(0, this._minRequestInterval - (now - this._lastRequestTime));
        if (wait > 0) {
            await abortableDelay(wait, options.signal);
        }
        this._lastRequestTime = Date.now();

        const url = this._buildUrl(params);

        const request = withAbortTimeout(options.signal, options.timeoutMs ?? 8000, 'Wikimedia request');
        try {
            const response = await fetch(url, { signal: request.signal });

            if (response.status === 429) {
                console.error('[WikimediaProvider] 429 Too Many Requests detected. Cooling down for 10s.');
                this._cooldownUntil = Date.now() + 10000;
                throw new Error('429');
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            if (request.didTimeout() && isAbortError(error)) {
                const timeoutError = new Error(`Wikimedia request timed out after ${options.timeoutMs ?? 8000}ms`);
                timeoutError.name = 'TimeoutError';
                throw timeoutError;
            }
            if (isAbortError(error)) throw error;
            console.error('[WikimediaProvider] Fetch error:', error);
            throw error;
        } finally {
            request.cleanup();
        }
    }

    /**
     * Get images from a category
     * @param {string} categoryName - Full category name (e.g., "Category:Fractals")
     * @param {number} [limit=20] - Maximum images to fetch
     * @returns {Promise<Object[]>}
     */
    async getImagesInCategory(categoryName, limit = 20, options = {}) {
        if (options.signal?.aborted) throw createAbortError();
        // Check cache
        const cacheKey = `${categoryName}:${limit}`;
        if (this._categoryCache.has(cacheKey)) {
            return this._categoryCache.get(cacheKey);
        }

        const data = await this._fetch({
            action: 'query',
            list: 'categorymembers',
            cmtitle: categoryName,
            cmtype: 'file',
            cmlimit: limit,
            cmprop: 'title|timestamp'
        }, options);

        const members = data.query?.categorymembers || [];

        // Filter to only images and skip blacklisted titles
        const images = members.filter(m => {
            // Animated GIFs are intentionally excluded from a flash surface.
            // They add ungoverned motion and tend to be poor fullscreen frames.
            const isImage = /\.(jpg|jpeg|png|svg)$/i.test(m.title);
            if (!isImage) return false;

            if (this._isBlacklisted(m.title)) {
                console.warn(`[WikimediaProvider] Filtering blacklisted result: ${m.title}`);
                return false;
            }
            return true;
        });

        this._categoryCache.set(cacheKey, images);
        return images;
    }

    /**
     * Get image info (URL, dimensions, etc.)
     * @param {string} title - File title (e.g., "File:Example.jpg")
     * @returns {Promise<Object|null>}
     */
    async getImageInfo(title, options = {}) {
        if (options.signal?.aborted) throw createAbortError();
        // Check persistent cache first
        const cached = await SourceCache.get(this.id, title);
        if (cached) {
            return this._isDisplayQuality(cached.data) ? cached.data : null;
        }

        const data = await this._fetch({
            action: 'query',
            titles: title,
            prop: 'imageinfo',
            iiprop: 'url|size|mime|extmetadata',
            iiurlwidth: this.thumbWidth
        }, options);

        const pages = data.query?.pages || {};
        const page = Object.values(pages)[0];

        if (!page || page.missing || !page.imageinfo) {
            return null;
        }

        const info = page.imageinfo[0];
        const metadata = info.extmetadata || {};

        const result = {
            title: title,
            url: info.thumburl || info.url,
            fullUrl: info.url,
            width: info.thumbwidth || info.width,
            height: info.thumbheight || info.height,
            mime: info.mime,
            description: metadata.ImageDescription?.value || '',
            artist: metadata.Artist?.value || '',
            license: metadata.LicenseShortName?.value || 'Unknown'
        };

        // Reject only clearly undersized raster candidates. Missing dimensions
        // remain eligible so SVG/legacy metadata cannot starve a category.
        if (!this._isDisplayQuality(result)) return null;

        // Double check description against blacklist
        if (this._isBlacklisted(result.description)) {
            console.warn(`[WikimediaProvider] Filtering image with blacklisted description: ${title}`);
            return null;
        }

        // Cache for future use
        await SourceCache.set(this.id, title, result, { title }, 'diagram');

        return result;
    }

    /**
     * Fetch image as blob
     * @param {string} url - Image URL
     * @returns {Promise<Blob>}
     */
    async fetchImageBlob(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
        }
        return await response.blob();
    }

    /**
     * @override
     * List available curated categories with sample thumbnails
     */
    async list(filter = {}) {
        const items = await Promise.all(
            Object.entries(WIKIMEDIA_CATEGORIES).map(async ([id, cat]) => {
                // Try to get a sample image for preview
                let previewUrl = null;
                try {
                    const images = await this.getImagesInCategory(cat.category, 1);
                    if (images.length > 0) {
                        const info = await this.getImageInfo(images[0].title);
                        previewUrl = info?.url || null;
                    }
                } catch (e) {
                    // Preview fetch failed, continue without preview
                }

                return {
                    id: id,
                    type: 'diagram',
                    name: cat.name,
                    data: {
                        isCategory: true,
                        categoryId: id,
                        previewUrl: previewUrl
                    },
                    providerId: this.id,
                    tier: this.tier,
                    metadata: {
                        category: cat.category,
                        tags: cat.tags,
                        isCategory: true,
                        description: `Browse ${cat.name} from Wikimedia Commons`,
                        previewUrl: previewUrl
                    }
                };
            })
        );

        // Filter by tags if specified
        if (filter.tags && filter.tags.length > 0) {
            return items.filter(item =>
                filter.tags.some(tag => item.metadata.tags.includes(tag))
            );
        }

        return items;
    }

    /**
     * @override
     * Get images from a curated category with full URLs
     */
    async get(categoryId) {
        const category = WIKIMEDIA_CATEGORIES[categoryId];
        if (!category) {
            console.warn(`[WikimediaProvider] Unknown category: ${categoryId}`);
            return null;
        }

        // Get images in this category
        const images = await this.getImagesInCategory(category.category, 20);

        // Fetch full image info for each (with URLs)
        const imageDetails = await Promise.all(
            images.slice(0, 10).map(async (img) => {
                try {
                    const info = await this.getImageInfo(img.title);
                    return info ? {
                        id: img.title,
                        title: img.title.replace('File:', '').replace(/_/g, ' '),
                        url: info.url,
                        fullUrl: info.fullUrl,
                        width: info.width,
                        height: info.height,
                        artist: info.artist,
                        license: info.license
                    } : null;
                } catch (e) {
                    return null;
                }
            })
        );

        const validImages = imageDetails.filter(Boolean);

        return {
            id: categoryId,
            type: 'diagram',
            name: category.name,
            data: {
                isCategory: true,
                categoryId: categoryId,
                images: validImages,
                // For direct use, provide first image URL
                previewUrl: validImages[0]?.url || null
            },
            providerId: this.id,
            tier: this.tier,
            metadata: {
                category: category.category,
                tags: category.tags,
                imageCount: validImages.length,
                images: validImages
            }
        };
    }

    /**
     * Get a random image from a category
     * @param {string} [categoryId] - Category ID, or random if not specified
     * @returns {Promise<Object|null>}
     */
    async getRandomImage(categoryId = null, retryCount = 0, options = {}) {
        if (options.signal?.aborted) throw createAbortError();
        // Pick random category if not specified
        if (!categoryId) {
            const categoryIds = Object.keys(WIKIMEDIA_CATEGORIES);
            categoryId = categoryIds[Math.floor(Math.random() * categoryIds.length)];
        }

        const category = WIKIMEDIA_CATEGORIES[categoryId];
        if (!category) return null;

        // Get images from category
        const images = await this.getImagesInCategory(
            category.category,
            RANDOM_CANDIDATE_LIMIT,
            options
        );
        if (images.length === 0) return null;

        // Draw without replacement. Blacklisted or undersized candidates are
        // consumed from this cycle before retrying, rather than being rolled
        // repeatedly by chance.
        const randomImage = this._candidateBag.draw(categoryId, images);
        if (!randomImage) return null;

        // Get full image info
        const imageInfo = await this.getImageInfo(randomImage.title, options);

        if (!imageInfo) {
            // If blacklisted or fetch failed, retry with a different random image
            if (retryCount < 5) {
                console.log(`[WikimediaProvider] Null result (blacklist?), retrying... (${retryCount + 1}/5)`);
                return this.getRandomImage(categoryId, retryCount + 1, options);
            }
            return null;
        }

        return {
            id: randomImage.title,
            type: 'diagram',
            name: randomImage.title.replace('File:', '').replace(/_/g, ' '),
            data: imageInfo,
            providerId: this.id,
            tier: this.tier,
            metadata: {
                categoryId,
                categoryName: category.name,
                url: imageInfo.url,
                artist: imageInfo.artist,
                license: imageInfo.license
            }
        };
    }

    /**
     * @override
     */
    async getRandom(filter = {}) {
        const categoryId = filter.category || null;
        return this.getRandomImage(categoryId, 0, {
            signal: filter.signal,
            timeoutMs: filter.timeoutMs
        });
    }

    /**
     * @override
     * Search Wikimedia Commons
     */
    async search(query, filter = {}) {
        const data = await this._fetch({
            action: 'query',
            list: 'search',
            srsearch: `${query} filetype:bitmap|drawing`,
            srnamespace: 6, // File namespace
            srlimit: filter.limit || 20
        });

        const results = data.query?.search || [];

        return results
            .filter(result => !this._isBlacklisted(result.title))
            .map(result => ({
                id: result.title,
                type: 'diagram',
                name: result.title.replace('File:', '').replace(/_/g, ' '),
                data: null, // Fetch on demand
                providerId: this.id,
                tier: this.tier,
                metadata: {
                    snippet: result.snippet,
                    timestamp: result.timestamp
                }
            }));
    }

    /**
     * @override
     * Preload images from specified categories
     */
    async preload(categoryIds = [], count = 5) {
        // If no categories specified, use a diverse set
        if (categoryIds.length === 0) {
            categoryIds = ['fractals', 'cajal', 'geometry', 'astronomy', 'botany'];
        }

        console.log(`[WikimediaProvider] Preloading ${count} images from ${categoryIds.length} categories...`);

        const preloadPromises = [];

        for (const categoryId of categoryIds) {
            const category = WIKIMEDIA_CATEGORIES[categoryId];
            if (!category) continue;

            const images = await this.getImagesInCategory(category.category, count);

            for (const image of images.slice(0, Math.ceil(count / categoryIds.length))) {
                preloadPromises.push(this.getImageInfo(image.title));
            }
        }

        await Promise.all(preloadPromises);
        console.log(`[WikimediaProvider] Preloaded ${preloadPromises.length} images`);
    }
}
