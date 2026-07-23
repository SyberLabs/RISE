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
    // AIC's subject vocabulary is uncontrolled (MUSEUM-ATLAS.md §1):
    // 'portrait' and 'portraits' are separate, largely disjoint tag
    // populations (200 vs 262 PD paintings, only 161 shared). A terms
    // array unions both forms so neither population is forfeited.
    'landscapes': {
        name: 'Landscapes',
        clauses: [
            { term: { artwork_type_id: TYPE_PAINTING } },
            { terms: { 'subject_titles.keyword': ['landscape', 'landscapes'] } }
        ],
        tags: ['nature', 'serene', 'cinematic']
    },
    'portraits': {
        name: 'Portraits',
        clauses: [
            { term: { artwork_type_id: TYPE_PAINTING } },
            { terms: { 'subject_titles.keyword': ['portrait', 'portraits'] } }
        ],
        tags: ['human', 'presence', 'cinematic']
    },
    // STYLISTIC vs SUBJECT — the 2026-07-24 audit finding. Stylistic
    // categories (movement, roster, period, place) ride the museum
    // tradition's own taxonomy: AIC's metadata is authoritative and
    // live search curates well (the full audit cut 0 of Old Masters,
    // 0 of Ukiyo-e, 3 of Impressionism). SUBJECT categories ask what
    // is DEPICTED, and a subject tag is register-blind: `soldiers`
    // tags the Passion, `flower` tags the Annunciation lily, `bird`
    // the descending dove — the audit cut 79% of Flowers' and 90% of
    // Animals' live surfaces. Subject categories are therefore
    // PINNED-ONLY (clauses: null): every work human-reviewed, the
    // audit's AIC survivors landed as aic pins in museum-pins.js.
    'flowers': {
        name: 'Flowers',
        clauses: null, // subject category — pinned-only
        tags: ['nature', 'still-life', 'contemplative']
    },
    'ships': {
        name: 'Ships',
        clauses: null, // subject category — pinned-only
        tags: ['sea', 'voyage', 'cinematic']
    },
    'animals': {
        name: 'Animals',
        clauses: null, // subject category — pinned-only
        tags: ['nature', 'creatures', 'contemplative']
    },
    'knights': {
        name: 'Knights',
        clauses: null, // subject category — pinned-only
        tags: ['heraldic', 'historical', 'cinematic']
    }
};

// Exclusions live beside the pins in museum-pins.js — one machine-
// writable curation file the Curia (and its dev-write endpoint) owns.

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

        if (!this._categoryCache) this._categoryCache = new Map();

        // PINNED-ONLY is the default across the board: every AIC
        // survivor of the full audit is promoted to a pin, and the
        // creator judged that curated canon superior to what live
        // search adds. The pins ARE the pool, resolved BLOCKING so no
        // first flash is empty; warm sessions answer from the imagery
        // cache in milliseconds. A category opts back into live search
        // only through the canon flag LIVE_SEARCH_ENABLED (Curia-
        // governed) — subject categories (clauses: null) can never.
        const { LIVE_SEARCH_ENABLED } = await import('./museum-pins.js');
        const liveEnabled = !!cat.clauses && LIVE_SEARCH_ENABLED?.[resolvedId] === true;
        if (!liveEnabled) {
            // ONE shared resolution per category, populating the cached
            // pool INCREMENTALLY as batches land. A cold full resolution
            // runs ~30s — far past any caller's draw budget — so callers
            // never wait for completion: they wait (within their own
            // timeout) only for the pool to be non-empty. The first
            // batch lands in ~2s, first flashes draw from it, and the
            // pool grows to full behind the session (the ShuffleBag's
            // growth-merge keeps the cycle sound). Traced 2026-07-24:
            // the completion-blocking version made the cortex's 8s
            // hydration budget fail the whole cold session open —
            // readiness 'failed', retained 0, the reader's "repetition
            // 30s in".
            // Pins are the WHOLE pool — the limit axis is meaningless
            // here, so the cache key drops it (a :100 and a :20 caller
            // share one growing array).
            const pinKey = `pins:${resolvedId}`;
            const pool = this._categoryCache.get(pinKey) || [];
            this._categoryCache.set(pinKey, pool);
            if (!this._pinResolutions) this._pinResolutions = new Map();
            if (!this._pinsResolved) this._pinsResolved = new Set();
            if (!this._pinRetryAt) this._pinRetryAt = new Map();
            const retryAt = this._pinRetryAt.get(resolvedId) || 0;
            if (!this._pinsResolved.has(resolvedId)
                && !this._pinResolutions.has(resolvedId)
                && Date.now() >= retryAt) {
                const run = this._resolvePins(resolvedId, {
                    onBatch: (works) => {
                        const have = new Set(pool.map(w => String(w.id)));
                        for (const w of works) {
                            if (!have.has(String(w.id))) pool.push(w);
                        }
                    }
                }).then(() => {
                    // SUCCESS marks resolved; failure must NOT — a
                    // transient network failure once froze a category
                    // as permanently empty for the provider's life
                    // (2026-07 review, finding 1)
                    this._pinsResolved.add(resolvedId);
                    this._pinRetryAt.delete(resolvedId);
                }).catch(() => {
                    // Bounded backoff: a dry provider must not restart
                    // a ~30s resolution on every draw. Doubles from
                    // 15s to a 4-minute ceiling; partial batches are
                    // already in the pool and deduplicate on retry.
                    const prev = this._pinBackoffMs?.get(resolvedId) || 15000;
                    if (!this._pinBackoffMs) this._pinBackoffMs = new Map();
                    this._pinBackoffMs.set(resolvedId, Math.min(prev * 2, 240000));
                    this._pinRetryAt.set(resolvedId, Date.now() + prev);
                }).finally(() => { this._pinResolutions.delete(resolvedId); });
                this._pinResolutions.set(resolvedId, run);
            }
            const request = withAbortTimeout(
                options.signal, options.timeoutMs ?? 8000, 'Museum pins');
            try {
                while (pool.length === 0 && this._pinResolutions.has(resolvedId)) {
                    if (request.signal.aborted) break;
                    // wake on either a 150ms tick or the abort itself, so
                    // an abort/timeout is honored immediately
                    await new Promise(resolve => {
                        const timer = setTimeout(done, 150);
                        function done() {
                            clearTimeout(timer);
                            request.signal.removeEventListener('abort', done);
                            resolve();
                        }
                        request.signal.addEventListener('abort', done, { once: true });
                    });
                }
                if (request.signal.aborted) {
                    if (request.didTimeout() && pool.length === 0) {
                        const timeoutError = new Error(
                            `Museum pins timed out after ${options.timeoutMs ?? 8000}ms`);
                        timeoutError.name = 'TimeoutError';
                        throw timeoutError;
                    }
                    if (!request.didTimeout()) throw createAbortError();
                }
                return pool;
            } finally {
                request.cleanup();
            }
        }

        // Structured bool query: public domain AND the category's
        // clauses (artist roster / date range / subject / type),
        // minus the audit's excluded ids (must_not — search would
        // otherwise re-serve every cut on the next fetch)
        const params = {
            'query[bool][must][0][term][is_public_domain]': 'true',
            limit: limit,
            fields: 'id,title,image_id,artist_display,date_display'
        };
        cat.clauses.forEach((clause, i) =>
            flattenClause(clause, `query[bool][must][${i + 1}]`, params));
        const { CATEGORY_EXCLUSIONS } = await import('./museum-pins.js');
        const excluded = CATEGORY_EXCLUSIONS?.[resolvedId];
        if (excluded?.length) {
            flattenClause({ terms: { id: excluded } }, 'query[bool][must_not][0]', params);
        }

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

        // Cross-institution enrichment: pinned works from other museums
        // join the same pool (a category is a reader intent, not an
        // institution — museum-pins.js). NON-BLOCKING for live-search
        // categories: the AIC results return immediately so the first
        // flash never waits on a cold pin resolution; the pins land
        // into the cached pool as they resolve (chunked), deepening
        // the rotation mid-session. Later sessions answer from the
        // 7-day imagery cache at once.
        this._categoryCache.set(cacheKey, results);
        this._resolvePins(resolvedId, options).then(pinned => {
            if (pinned.length === 0) return;
            const pool = this._categoryCache.get(cacheKey);
            if (Array.isArray(pool)) pool.push(...pinned);
        }).catch(() => { /* the AIC pool stands alone */ });
        return results;
    }

    /**
     * Resolve a category's cross-institution pins into the provider's
     * image shape. Lazy imports keep the imagery service out of this
     * module's static graph; failures degrade to the AIC-only pool.
     */
    async _resolvePins(categoryId, options = {}) {
        try {
            const { MUSEUM_CATEGORY_PINS } = await import('./museum-pins.js');
            const declared = MUSEUM_CATEGORY_PINS[categoryId];
            if (!Array.isArray(declared) || declared.length === 0) return [];

            // Interleave round-robin by institution before resolving.
            // Pins land into the live pool in resolution order, and the
            // pin file groups by museum — resolved as-declared, a first
            // (cold-cache) session drained one institution's pins before
            // the next institution appeared at all (measured: Cleveland
            // present in 26% of cold oldmasters sessions vs 100% after
            // interleaving — draw-distribution study, 2026-07-23).
            const bySource = new Map();
            for (const pin of declared) {
                if (!bySource.has(pin.source)) bySource.set(pin.source, []);
                bySource.get(pin.source).push(pin);
            }
            const pins = [];
            for (let i = 0; pins.length < declared.length; i++) {
                for (const group of bySource.values()) {
                    if (group[i]) pins.push(group[i]);
                }
            }
            const { resolveCollection } = await import('../../content/atrium/imagery/service.js');
            // Chunked: 95 rijks pins are ~285 Linked-Art requests on a
            // cold cache — batches of 8 keep the museum's API unhammered.
            // SourceCache (30 days) makes every later session instant.
            const shape = work => ({
                id: work.id,
                title: work.title,
                artist: work.artist,
                date: work.date,
                url: work.imageUrl,
                fullUrl: work.fullImageUrl || work.imageUrl,
                // Provenance shows on the work, where it is true
                sourceName: work.sourceName
            });
            const works = [];
            for (let i = 0; i < pins.length; i += 8) {
                if (options.signal?.aborted) break;
                const batch = await resolveCollection(
                    { works: pins.slice(i, i + 8) },
                    { signal: options.signal }
                );
                const shaped = batch.map(shape);
                works.push(...shaped);
                // Incremental consumers (the shared category resolution)
                // receive each batch as it lands
                if (typeof options.onBatch === 'function') options.onBatch(shaped);
            }
            // Declared pins with ZERO resolutions is operational
            // failure (network down, adapters dark), not an empty
            // category — the caller must be able to retry. The
            // adapters degrade individual misses to omissions, so an
            // all-miss run fulfills with [] unless we throw here.
            if (works.length === 0 && !options.signal?.aborted) {
                throw new Error(`No pins resolved for ${categoryId} (${pins.length} declared)`);
            }
            return works;
        } catch (e) {
            console.warn('[Museum] Pin resolution failed:', e);
            throw e;
        }
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
