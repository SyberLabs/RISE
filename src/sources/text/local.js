/**
 * R.I.S.E. Source System
 * Local Text Provider
 * 
 * Wraps the existing curated starter sequences as a SourceProvider.
 */

import { SourceProvider } from '../provider.js';
import { STARTER_SEQUENCES } from '../../content/starters.js';

/**
 * Provider for locally bundled curated sequences
 */
export class LocalTextProvider extends SourceProvider {
    constructor() {
        super({
            id: 'local-starters',
            name: 'Curated Starters',
            contentType: 'sequence',
            tier: 1,
            description: 'Hand-crafted starter sequences for chamber sessions',
            supportsSearch: true,
            supportsPreload: false
        });

        /** @type {Map<string, Object>} */
        this._sequenceMap = new Map();

        /** @type {Map<string, Object[]>} */
        this._categoryMap = new Map();
    }

    /**
     * @override
     */
    async _doInit() {
        // Index sequences by ID and category
        for (const seq of STARTER_SEQUENCES) {
            this._sequenceMap.set(seq.id, seq);

            const category = seq.category || 'uncategorized';
            if (!this._categoryMap.has(category)) {
                this._categoryMap.set(category, []);
            }
            this._categoryMap.get(category).push(seq);
        }

        console.log(`[LocalTextProvider] Indexed ${this._sequenceMap.size} sequences in ${this._categoryMap.size} categories`);
    }

    /**
     * @override
     */
    async list(filter = {}) {
        await this.init();

        let sequences = Array.from(this._sequenceMap.values());

        // Apply category filter
        if (filter.category) {
            sequences = sequences.filter(s => s.category === filter.category);
        }

        // Apply tags filter
        if (filter.tags && filter.tags.length > 0) {
            sequences = sequences.filter(s =>
                s.tags && filter.tags.some(tag => s.tags.includes(tag))
            );
        }

        // Apply limit and offset
        if (filter.offset) {
            sequences = sequences.slice(filter.offset);
        }
        if (filter.limit) {
            sequences = sequences.slice(0, filter.limit);
        }

        // Transform to ContentItem format
        return sequences.map(seq => this._toContentItem(seq));
    }

    /**
     * @override
     */
    async get(id) {
        await this.init();

        const seq = this._sequenceMap.get(id);
        if (!seq) return null;

        return this._toContentItem(seq);
    }

    /**
     * @override
     */
    async search(query, filter = {}) {
        await this.init();

        const lowerQuery = query.toLowerCase();

        let sequences = Array.from(this._sequenceMap.values()).filter(seq => {
            // Search in name, description, and content
            return (
                seq.name.toLowerCase().includes(lowerQuery) ||
                (seq.description && seq.description.toLowerCase().includes(lowerQuery)) ||
                (seq.content && seq.content.toLowerCase().includes(lowerQuery))
            );
        });

        // Apply additional filters
        if (filter.category) {
            sequences = sequences.filter(s => s.category === filter.category);
        }

        return sequences.map(seq => this._toContentItem(seq));
    }

    /**
     * Get all categories
     * @returns {Promise<string[]>}
     */
    async getCategories() {
        await this.init();
        return Array.from(this._categoryMap.keys());
    }

    /**
     * Get sequences by category
     * @param {string} category
     * @returns {Promise<Object[]>}
     */
    async getByCategory(category) {
        await this.init();
        const sequences = this._categoryMap.get(category) || [];
        return sequences.map(seq => this._toContentItem(seq));
    }

    /**
     * Transform internal sequence to ContentItem
     * @private
     * @param {Object} seq
     * @returns {Object}
     */
    _toContentItem(seq) {
        return {
            id: seq.id,
            type: 'sequence',
            name: seq.name,
            data: seq.content,
            providerId: this.id,
            tier: this.tier,
            metadata: {
                category: seq.category,
                description: seq.description,
                curve: seq.curve,
                wpm: seq.wpm,
                tags: seq.tags || [],
                audioPairing: seq.audioPairing
            }
        };
    }
}
