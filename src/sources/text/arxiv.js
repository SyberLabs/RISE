/**
 * R.I.S.E. Source System
 * ArXiv Research Provider
 * 
 * Fetches research paper abstracts from ArXiv API.
 * Focus: Quantum Physics, AI, Neuroscience, General Relativity.
 */

import { SourceProvider } from '../provider.js';
import CACHED_PAPERS from './data/arxiv_cache.json';

export const ARXIV_CATEGORIES = {
    'quant-ph': { name: 'Quantum Physics', tags: ['quantum', 'physics', 'entanglement'] },
    'cs.AI': { name: 'Artificial Intelligence', tags: ['ai', 'cybernetics', 'logic'] },
    'gr-qc': { name: 'General Relativity', tags: ['gravity', 'spacetime', 'cosmology'] },
    'q-bio.NC': { name: 'Neuroscience', tags: ['brain', 'cognition', 'neurons'] },
    'cs.CY': { name: 'Computers & Society', tags: ['ethics', 'social', 'impact'] }
};

export class ArxivProvider extends SourceProvider {
    constructor() {
        super({
            id: 'arxiv-research',
            name: 'ArXiv Research',
            contentType: 'text',
            tier: 3, // Research tier
            description: 'Live research abstracts from ArXiv (Quantum, AI, Neuro)',
            supportsSearch: true,
            supportsPreload: false
        });

        // https required: browsers block http fetches from an https page (mixed content)
        this.baseUrl = 'https://export.arxiv.org/api/query';
        this.cache = CACHED_PAPERS || {};
    }

    /**
     * @override
     * List available categories
     */
    async list(filter = {}) {
        return Object.entries(ARXIV_CATEGORIES).map(([id, cat]) => ({
            id: id,
            type: 'text',
            name: cat.name,
            providerId: this.id,
            metadata: {
                category: id,
                tags: cat.tags,
                isCategory: true
            }
        }));
    }

    /**
     * @override
     * Get recent papers from a category
     */
    async get(categoryId) {
        if (!ARXIV_CATEGORIES[categoryId]) {
            throw new Error(`Unknown category: ${categoryId}`);
        }

        // Use cache if available
        if (this.cache[categoryId] && this.cache[categoryId].length > 0) {
            console.log(`[ArxivProvider] Serving ${this.cache[categoryId].length} papers from local cache for ${categoryId}`);
            return {
                id: categoryId,
                type: 'text',
                name: ARXIV_CATEGORIES[categoryId].name,
                data: this.cache[categoryId],
                providerId: this.id,
                metadata: {
                    category: categoryId,
                    count: this.cache[categoryId].length,
                    source: 'local-cache'
                }
            };
        }

        // Fallback to live fetch
        const query = `cat:${categoryId}`;
        const results = await this._searchArxiv(query, 10, 'submittedDate');

        return {
            id: categoryId,
            type: 'text',
            name: ARXIV_CATEGORIES[categoryId].name,
            data: results, // Array of simplified paper objects
            providerId: this.id,
            metadata: {
                category: categoryId,
                count: results.length
            }
        };
    }

    /**
     * @override
     * Search ArXiv
     */
    async search(query, filter = {}) {
        // Search local cache first
        const q = query.toLowerCase();
        const localMatches = Object.values(this.cache).flat().filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.metadata.abstract.toLowerCase().includes(q)
        );

        if (localMatches.length > 0) {
            return localMatches;
        }

        return this._searchArxiv(query, filter.limit || 10, 'relevance');
    }

    /**
     * Fetch and parse from ArXiv API
     * @private
     */
    async _searchArxiv(searchQuery, maxResults = 10, sortBy = 'relevance') {
        const url = `${this.baseUrl}?search_query=${encodeURIComponent(searchQuery)}&start=0&max_results=${maxResults}&sortBy=${sortBy}&sortOrder=descending`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`ArXiv API Error: ${response.status}`);
            const xmlText = await response.text();

            return this._parseAtomResponse(xmlText);
        } catch (error) {
            console.warn('[ArxivProvider] API request failed (likely CORS). Using mock data fallback.', error);
            return this._getMockData(searchQuery);
        }
    }

    /**
     * Mock data for offline/CORS environments
     * @private
     */
    _getMockData(query) {
        // Simple mock generator based on query
        const timestamp = new Date().toISOString();
        const base = query.split(':')[1] || 'General';

        return Array.from({ length: 5 }, (_, i) => ({
            id: `mock-${i}`,
            type: 'text',
            name: `${base} Research Paper #${i + 1}: Theoretical Implications`,
            content: `ABSTRACT\n\nThis is a simulated abstract for a paper about ${base}.\nIn a real environment with a backend proxy, this would be live data from ArXiv.\n\nThe study explores the intersection of ${base} and consciousness systems, proposing a novel framework for understanding symbolic recursion.\n\nAuthors: J. Doe, A. Smith\nPublished: ${timestamp}`,
            providerId: this.id,
            tier: this.tier,
            metadata: {
                author: 'Simulated Author (CORS Fallback)',
                date: new Date().toLocaleDateString(),
                url: '#',
                abstract: `This is a simulated abstract for a paper about ${base}. In a real environment with a backend proxy, this would be live data from ArXiv.`,
                isAbstract: true
            }
        }));
    }

    /**
     * Parse Atom XML response to structured objects
     * @private
     */
    _parseAtomResponse(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const entries = xmlDoc.getElementsByTagName("entry");

        const results = [];

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];

            // Extract fields safely
            const title = this._getTagValue(entry, "title").replace(/\n/g, ' ').trim();
            const summary = this._getTagValue(entry, "summary").replace(/\n/g, ' ').trim();
            const published = this._getTagValue(entry, "published");
            const idUrl = this._getTagValue(entry, "id");

            // Extract authors
            const authorTags = entry.getElementsByTagName("author");
            const authors = [];
            for (let j = 0; j < authorTags.length; j++) {
                authors.push(this._getTagValue(authorTags[j], "name"));
            }

            // Create standardized Source object structure
            results.push({
                id: idUrl,
                type: 'text',
                name: title,
                // Content mapped to Source format: abstract becomes the "text"
                content: summary,
                providerId: this.id,
                tier: this.tier,
                metadata: {
                    author: authors.join(', '),
                    date: new Date(published).toLocaleDateString(),
                    url: idUrl,
                    abstract: summary,
                    isAbstract: true
                }
            });
        }

        return results;
    }

    _getTagValue(parent, tagName) {
        const tag = parent.getElementsByTagName(tagName)[0];
        return tag ? tag.textContent : "";
    }
}
