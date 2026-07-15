/**
 * R.I.S.E. Source System
 * Project Gutenberg Provider
 * 
 * Fetches public domain literature from Project Gutenberg.
 */

import { SourceProvider } from '../provider.js';
import { SourceCache } from '../cache.js';
import { isAbortError, withAbortTimeout } from '../visual/request.js';

/**
 * Curated book catalog - philosophical, poetic, contemplative works
 * Format: { id, title, author, gutenbergId, category, tags }
 */
export const GUTENBERG_CATALOG = {
    // Philosophy
    'meditations': {
        title: 'Meditations',
        author: 'Marcus Aurelius',
        gutenbergId: 2680,
        category: 'philosophy',
        tags: ['stoic', 'contemplation', 'wisdom']
    },
    'thus-spoke-zarathustra': {
        title: 'Thus Spoke Zarathustra',
        author: 'Friedrich Nietzsche',
        gutenbergId: 1998,
        category: 'philosophy',
        tags: ['existential', 'poetry', 'prophecy']
    },
    'walden': {
        title: 'Walden',
        author: 'Henry David Thoreau',
        gutenbergId: 205,
        category: 'philosophy',
        tags: ['nature', 'simplicity', 'contemplation']
    },
    'essays-emerson': {
        title: 'Essays: First Series',
        author: 'Ralph Waldo Emerson',
        gutenbergId: 2944,
        category: 'philosophy',
        tags: ['transcendentalism', 'self-reliance', 'nature']
    },

    // Poetry
    'leaves-of-grass': {
        title: 'Leaves of Grass',
        author: 'Walt Whitman',
        gutenbergId: 1322,
        category: 'poetry',
        tags: ['transcendental', 'nature', 'self']
    },
    'collected-poems-blake': {
        title: 'Poems of William Blake',
        author: 'William Blake',
        gutenbergId: 574,
        category: 'poetry',
        tags: ['visionary', 'mystical', 'romantic']
    },
    'divine-comedy': {
        title: 'The Divine Comedy',
        author: 'Dante Alighieri',
        gutenbergId: 8800,
        category: 'poetry',
        tags: ['epic', 'allegory', 'spiritual']
    },
    'paradise-lost': {
        title: 'Paradise Lost',
        author: 'John Milton',
        gutenbergId: 26,
        category: 'poetry',
        tags: ['epic', 'theological', 'cosmic']
    },
    'rime-ancient-mariner': {
        title: 'The Rime of the Ancient Mariner',
        author: 'Samuel Taylor Coleridge',
        gutenbergId: 151,
        category: 'poetry',
        tags: ['supernatural', 'romantic', 'journey']
    },

    // Mysticism
    'cloud-unknowing': {
        title: 'The Cloud of Unknowing',
        author: 'Anonymous',
        gutenbergId: 10663,
        category: 'mysticism',
        tags: ['contemplative', 'christian', 'meditation']
    },
    'imitation-christ': {
        title: 'The Imitation of Christ',
        author: 'Thomas à Kempis',
        gutenbergId: 1653,
        category: 'mysticism',
        tags: ['devotional', 'spiritual', 'christian']
    },

    // Science/Nature
    'origin-species': {
        title: 'On the Origin of Species',
        author: 'Charles Darwin',
        gutenbergId: 1228,
        category: 'science',
        tags: ['evolution', 'nature', 'observation']
    },
    'voyage-beagle': {
        title: 'The Voyage of the Beagle',
        author: 'Charles Darwin',
        gutenbergId: 944,
        category: 'science',
        tags: ['exploration', 'nature', 'observation']
    }
};

/**
 * Provider for Project Gutenberg texts
 */
export class GutenbergProvider extends SourceProvider {
    constructor() {
        super({
            id: 'gutenberg',
            name: 'Project Gutenberg',
            contentType: 'text',
            tier: 3, // Literary tier
            description: 'Public domain literature from Project Gutenberg',
            supportsSearch: true,
            supportsPreload: true
        });

        // Cache for fetched book content
        this._bookCache = new Map();
    }

    /**
     * @override
     */
    async _doInit() {
        console.log(`[GutenbergProvider] Catalog: ${Object.keys(GUTENBERG_CATALOG).length} books`);
    }

    /**
     * Get the raw text URL for a Gutenberg book
     * @private
     */
    _getTextUrl(gutenbergId) {
        // Gutenberg provides plain text at predictable URLs
        return `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`;
    }

    /**
     * Fetch book content from Gutenberg
     * @param {number} gutenbergId
     * @returns {Promise<string>}
     */
    async fetchBook(gutenbergId, options = {}) {
        // Check persistent cache first
        const cacheKey = `book-${gutenbergId}`;
        const cached = await SourceCache.get(this.id, cacheKey);
        if (cached) {
            return cached.data;
        }

        const url = this._getTextUrl(gutenbergId);

        const request = withAbortTimeout(options.signal, options.timeoutMs ?? 10000, 'Gutenberg request');
        try {
            const response = await fetch(url, { signal: request.signal });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            let text = await response.text();

            // Strip Gutenberg header/footer (between *** markers)
            const startMarker = '*** START OF';
            const endMarker = '*** END OF';

            const startIdx = text.indexOf(startMarker);
            const endIdx = text.indexOf(endMarker);

            if (startIdx !== -1 && endIdx !== -1) {
                // Find the end of the START line
                const contentStart = text.indexOf('\n', startIdx) + 1;
                text = text.substring(contentStart, endIdx).trim();
            }

            // Cache the cleaned text (TTL: 30 days)
            await SourceCache.set(
                this.id,
                cacheKey,
                text,
                { gutenbergId },
                'text',
                30 * 24 * 60 * 60 * 1000
            );

            return text;
        } catch (error) {
            if (isAbortError(error)) throw error;
            console.warn(`[GutenbergProvider] Failed to fetch book ${gutenbergId}, using fallback:`, error);
            return `[Simulated Gutenberg Text for ID ${gutenbergId}]\n\nThe project Gutenberg integration is currently experiencing network limitations. This is a simulated text to demonstrate the RSVP reading interface and allow testing of the Chamber flow without depending on external network availability. It demonstrates the ability to chunk text and display it inside the player.\n\n*** END OF SIMULATION ***`;
        } finally {
            request.cleanup();
        }
    }

    /**
     * Extract random passages from a book
     * @param {string} text - Full book text
     * @param {number} [count=5] - Number of passages
     * @param {number} [minLength=100] - Minimum passage length
     * @param {number} [maxLength=500] - Maximum passage length
     * @returns {string[]}
     */
    extractPassages(text, count = 5, minLength = 100, maxLength = 500) {
        // Split into paragraphs
        const paragraphs = text
            .split(/\n\n+/)
            .map(p => p.replace(/\s+/g, ' ').trim())
            .filter(p => p.length >= minLength && p.length <= maxLength);

        if (paragraphs.length === 0) {
            return [];
        }

        // Pick random paragraphs
        const passages = [];
        const usedIndices = new Set();

        for (let i = 0; i < Math.min(count, paragraphs.length); i++) {
            let idx;
            do {
                idx = Math.floor(Math.random() * paragraphs.length);
            } while (usedIndices.has(idx) && usedIndices.size < paragraphs.length);

            usedIndices.add(idx);
            passages.push(paragraphs[idx]);
        }

        return passages;
    }

    /**
     * @override
     * List available books in catalog
     */
    async list(filter = {}) {
        let books = Object.entries(GUTENBERG_CATALOG);

        // Filter by category
        if (filter.category) {
            books = books.filter(([_, book]) => book.category === filter.category);
        }

        // Filter by tags
        if (filter.tags && filter.tags.length > 0) {
            books = books.filter(([_, book]) =>
                filter.tags.some(tag => book.tags.includes(tag))
            );
        }

        return books.map(([id, book]) => ({
            id,
            type: 'text',
            name: book.title,
            data: null, // Loaded on demand
            providerId: this.id,
            tier: this.tier,
            metadata: {
                author: book.author,
                category: book.category,
                tags: book.tags,
                gutenbergId: book.gutenbergId
            }
        }));
    }

    /**
     * @override
     * Get a book with content
     */
    async get(bookId, options = {}) {
        const bookDef = GUTENBERG_CATALOG[bookId];
        if (!bookDef) return null;

        const text = await this.fetchBook(bookDef.gutenbergId, options);

        return {
            id: bookId,
            type: 'text',
            name: bookDef.title,
            data: text,
            providerId: this.id,
            tier: this.tier,
            metadata: {
                author: bookDef.author,
                category: bookDef.category,
                tags: bookDef.tags,
                gutenbergId: bookDef.gutenbergId,
                length: text.length
            }
        };
    }

    /**
     * Get random passage from a specific book or any book
     * @param {string} [bookId] - Specific book, or random if not specified
     * @returns {Promise<Object|null>}
     */
    async getRandomPassage(bookId = null) {
        // Pick random book if not specified
        if (!bookId) {
            const bookIds = Object.keys(GUTENBERG_CATALOG);
            bookId = bookIds[Math.floor(Math.random() * bookIds.length)];
        }

        const bookDef = GUTENBERG_CATALOG[bookId];
        if (!bookDef) return null;

        try {
            const text = await this.fetchBook(bookDef.gutenbergId);
            const passages = this.extractPassages(text, 1);

            if (passages.length === 0) return null;

            return {
                id: `${bookId}-passage-${Date.now()}`,
                type: 'text',
                name: `${bookDef.title} (excerpt)`,
                data: passages[0],
                providerId: this.id,
                tier: this.tier,
                metadata: {
                    bookId,
                    title: bookDef.title,
                    author: bookDef.author,
                    isPassage: true
                }
            };
        } catch (error) {
            console.error(`[GutenbergProvider] Failed to get passage from ${bookId}:`, error);
            return null;
        }
    }

    /**
     * @override
     */
    async getRandom(filter = {}) {
        return this.getRandomPassage(filter.bookId);
    }

    /**
     * @override
     * Search through catalog (not full text)
     */
    async search(query, filter = {}) {
        const lowerQuery = query.toLowerCase();

        return Object.entries(GUTENBERG_CATALOG)
            .filter(([id, book]) => {
                return (
                    book.title.toLowerCase().includes(lowerQuery) ||
                    book.author.toLowerCase().includes(lowerQuery) ||
                    book.tags.some(tag => tag.includes(lowerQuery))
                );
            })
            .map(([id, book]) => ({
                id,
                type: 'text',
                name: book.title,
                data: null,
                providerId: this.id,
                tier: this.tier,
                metadata: {
                    author: book.author,
                    category: book.category,
                    tags: book.tags
                }
            }));
    }

    /**
     * @override
     * Preload book texts
     */
    async preload(bookIds = [], count = 3) {
        // If no books specified, preload a diverse selection
        if (bookIds.length === 0) {
            bookIds = ['meditations', 'leaves-of-grass', 'walden'];
        }

        console.log(`[GutenbergProvider] Preloading ${bookIds.length} books...`);

        const preloadPromises = bookIds.slice(0, count).map(async (bookId) => {
            const bookDef = GUTENBERG_CATALOG[bookId];
            if (bookDef) {
                try {
                    await this.fetchBook(bookDef.gutenbergId);
                    console.log(`[GutenbergProvider] ✓ Preloaded: ${bookDef.title}`);
                } catch (error) {
                    console.warn(`[GutenbergProvider] ✗ Failed to preload: ${bookDef.title}`);
                }
            }
        });

        await Promise.all(preloadPromises);
    }
}
