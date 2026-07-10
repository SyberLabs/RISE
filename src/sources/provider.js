/**
 * R.I.S.E. Source System
 * Abstract SourceProvider base class
 * 
 * All content providers (text, visual, audio) implement this interface.
 */

/**
 * Content types supported by the source system
 * @typedef {'text' | 'image' | 'diagram' | 'fractal' | 'audio' | 'sequence'} ContentType
 */

/**
 * Content item returned by providers
 * @typedef {Object} ContentItem
 * @property {string} id - Unique identifier
 * @property {ContentType} type - Content type
 * @property {string} name - Display name
 * @property {*} data - The actual content (string, ImageData, Blob, etc.)
 * @property {Object} metadata - Provider-specific metadata
 * @property {string} [providerId] - Source provider ID
 * @property {number} [tier] - Source taxonomy tier (1-5)
 */

/**
 * Filter options for listing content
 * @typedef {Object} ListFilter
 * @property {string} [category] - Category to filter by
 * @property {string[]} [tags] - Tags to match
 * @property {number} [limit] - Maximum items to return
 * @property {number} [offset] - Pagination offset
 */

/**
 * Abstract base class for all source providers.
 * Extend this class to create text, visual, or audio providers.
 */
export class SourceProvider {
    /**
     * @param {Object} config
     * @param {string} config.id - Unique provider ID
     * @param {string} config.name - Display name
     * @param {ContentType} config.contentType - Primary content type
     * @param {number} [config.tier=1] - Source taxonomy tier (1=Curated, 2=Sacred, 3=Literary, 4=Research, 5=Live)
     * @param {string} [config.description] - Provider description
     * @param {boolean} [config.supportsSearch=false] - Whether provider supports search
     * @param {boolean} [config.supportsPreload=false] - Whether provider supports preloading
     */
    constructor(config) {
        if (new.target === SourceProvider) {
            throw new Error('SourceProvider is abstract and cannot be instantiated directly');
        }

        this.id = config.id || crypto.randomUUID();
        this.name = config.name || 'Unknown Provider';
        this.contentType = config.contentType || 'text';
        this.tier = config.tier || 1;
        this.description = config.description || '';
        this.supportsSearch = config.supportsSearch || false;
        this.supportsPreload = config.supportsPreload || false;

        this._ready = false;
        this._initPromise = null;
    }

    /**
     * Check if provider is initialized and ready
     * @returns {boolean}
     */
    get ready() {
        return this._ready;
    }

    /**
     * Initialize the provider.
     * Override this to fetch manifests, connect to APIs, etc.
     * @returns {Promise<void>}
     */
    async init() {
        if (this._ready) return;
        if (this._initPromise) return this._initPromise;

        this._initPromise = this._doInit();
        await this._initPromise;
        this._ready = true;
    }

    /**
     * Internal initialization hook for subclasses
     * @protected
     * @returns {Promise<void>}
     */
    async _doInit() {
        // Override in subclass
    }

    /**
     * List available content items.
     * @param {ListFilter} [filter] - Optional filter
     * @returns {Promise<ContentItem[]>}
     */
    async list(filter = {}) {
        throw new Error(`${this.constructor.name}.list() not implemented`);
    }

    /**
     * Get a specific content item by ID.
     * @param {string} id - Item ID
     * @returns {Promise<ContentItem|null>}
     */
    async get(id) {
        throw new Error(`${this.constructor.name}.get() not implemented`);
    }

    /**
     * Get a random content item.
     * Default implementation: list all and pick random.
     * Override for more efficient implementations.
     * @param {ListFilter} [filter] - Optional filter
     * @returns {Promise<ContentItem|null>}
     */
    async getRandom(filter = {}) {
        const items = await this.list(filter);
        if (items.length === 0) return null;
        const index = Math.floor(Math.random() * items.length);
        return items[index];
    }

    /**
     * Search for content.
     * @param {string} query - Search query
     * @param {ListFilter} [filter] - Optional additional filters
     * @returns {Promise<ContentItem[]>}
     */
    async search(query, filter = {}) {
        if (!this.supportsSearch) {
            console.warn(`${this.constructor.name} does not support search`);
            return [];
        }
        throw new Error(`${this.constructor.name}.search() not implemented`);
    }

    /**
     * Preload content for performance.
     * @param {string[]} [ids] - Specific IDs to preload, or empty for auto-select
     * @param {number} [count=5] - Number of items to preload if ids not specified
     * @returns {Promise<void>}
     */
    async preload(ids = [], count = 5) {
        if (!this.supportsPreload) return;
        // Default: no-op, override in subclass
    }

    /**
     * Get provider metadata for UI display
     * @returns {Object}
     */
    getMetadata() {
        return {
            id: this.id,
            name: this.name,
            contentType: this.contentType,
            tier: this.tier,
            description: this.description,
            supportsSearch: this.supportsSearch,
            supportsPreload: this.supportsPreload,
            ready: this.ready
        };
    }
}

/**
 * Tier labels for display
 */
export const TIER_LABELS = {
    1: 'Curated',
    2: 'Sacred',
    3: 'Literary',
    4: 'Research',
    5: 'Live'
};

/**
 * Content type labels for display
 */
export const CONTENT_TYPE_LABELS = {
    text: 'Text',
    image: 'Image',
    diagram: 'Diagram',
    fractal: 'Fractal',
    audio: 'Audio',
    sequence: 'Sequence'
};
