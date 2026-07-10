/**
 * R.I.S.E. Source System
 * The Metropolitan Museum of Art Provider
 *
 * Free, no-key API. 470k+ open-access public domain works.
 *
 * CORS Architecture:
 *   /search  → returns objectIDs (CORS-safe ✓)
 *   /objects/{id} → blocked by browser CORS ✗
 *   images.metmuseum.org → public CDN, CORS-free ✓
 *
 * Strategy:
 *   1. Curated seed records with verified CDN URLs (instant playback)
 *   2. /search for additional IDs → /objects via CORS proxy (background)
 *
 * Department availability confirmed via API (isPublicDomain=true, hasImages=true):
 *   Dept 10 (Egyptian) — large pool ✓
 *   Dept 13 (Greek/Roman) — large pool ✓
 *   Dept 17 (Medieval) — 4 confirmed ✓
 *   Dept 6  (Asian Art) — large pool ✓
 *   Dept 14 (Islamic) — moderate ✓
 *   Dept 11 (European Paintings) — 23 confirmed ✓
 */

import { SourceProvider } from '../provider.js';
import { SourceCache } from '../cache.js';

export const MET_CATEGORIES = {
    'met-greek-roman': {
        name: 'Greek & Roman Antiquities',
        departmentId: 13,
        q: 'vase amphora',
        tags: ['classical', 'ancient', 'sculpture', 'ceramic']
    },
    'met-egyptian': {
        name: 'Egyptian Antiquities',
        departmentId: 10,
        q: '',
        tags: ['ancient', 'hieroglyphic', 'symbolic', 'ceremonial']
    },
    'met-medieval': {
        name: 'Medieval Collection',
        departmentId: 17,
        q: '',
        tags: ['medieval', 'ivory', 'ceremonial', 'sacred']
    },
    'met-japanese': {
        name: 'Japanese Woodblock Prints',
        departmentId: 6,
        q: 'Hokusai woodblock',
        tags: ['japanese', 'ukiyo-e', 'ink', 'landscape']
    },
    'met-islamic': {
        name: 'Islamic Arts',
        departmentId: 14,
        q: 'geometric',
        tags: ['geometric', 'pattern', 'calligraphy', 'ornamental']
    },
    'met-european': {
        name: 'European Masters',
        departmentId: 11,
        q: '',
        tags: ['painting', 'european', 'renaissance', 'baroque']
    }
};

/**
 * CORS proxy for /objects endpoint (browser-side CORS workaround)
 */
const CORS_PROXY = 'https://corsproxy.io/?';

/**
 * Curated seed records with API-verified CDN URLs.
 * These provide instant imagery without any API calls on startup.
 */
const SEED_RECORDS = {
    'met-greek-roman': [
        { id: '248902', title: 'Terracotta Panathenaic prize amphora', artist: 'Euphiletos Painter', date: 'ca. 530 BCE',
          url: 'https://images.metmuseum.org/CRDImages/gr/web-large/DP245711.jpg',   fullUrl: 'https://images.metmuseum.org/CRDImages/gr/original/DP245711.jpg' },
        { id: '248902b', title: 'Panathenaic Amphora — reverse', artist: 'Euphiletos Painter', date: 'ca. 530 BCE',
          url: 'https://images.metmuseum.org/CRDImages/gr/web-large/DP245712.jpg',   fullUrl: 'https://images.metmuseum.org/CRDImages/gr/original/DP245712.jpg' },
        { id: '248902c', title: 'Panathenaic Amphora — detail', artist: 'Euphiletos Painter', date: 'ca. 530 BCE',
          url: 'https://images.metmuseum.org/CRDImages/gr/web-large/DP245714.jpg',   fullUrl: 'https://images.metmuseum.org/CRDImages/gr/original/DP245714.jpg' },
    ],
    'met-egyptian': [
        { id: '544685',  title: 'Head from a Statuette (Amarna Period)', artist: 'Egyptian, Dynasty 18', date: 'ca. 1353–1336 B.C.',
          url: 'https://images.metmuseum.org/CRDImages/eg/web-large/31.114.1_EGDP019314.jpg', fullUrl: 'https://images.metmuseum.org/CRDImages/eg/original/31.114.1_EGDP019314.jpg' },
        { id: '545131',  title: 'Large Oval Storage Basket', artist: 'Egyptian, Dynasty 18', date: 'ca. 1492–1473 B.C.',
          url: 'https://images.metmuseum.org/CRDImages/eg/web-large/36.3.57a-b_EGDP011891.jpg', fullUrl: 'https://images.metmuseum.org/CRDImages/eg/original/36.3.57a-b_EGDP011891.jpg' },
        { id: '544055',  title: 'Head of a Woman', artist: 'Egyptian, Dynasty 18', date: 'ca. 1390–1352 B.C.',
          url: 'https://images.metmuseum.org/CRDImages/eg/web-large/LC-1989_281_93_EGDP026390.jpg', fullUrl: 'https://images.metmuseum.org/CRDImages/eg/original/LC-1989_281_93_EGDP026390.jpg' },
        { id: '543895',  title: 'Archers (Relief)', artist: 'Egyptian, Dynasty 4', date: 'ca. 2551–2494 B.C.',
          url: 'https://images.metmuseum.org/CRDImages/eg/web-large/DT259178.jpg',   fullUrl: 'https://images.metmuseum.org/CRDImages/eg/original/DT259178.jpg' },
    ],
    'met-medieval': [
        { id: '464294',  title: 'Virgin and Child (ivory)', artist: 'French', date: 'ca. 1275–1300',
          url: 'https://images.metmuseum.org/CRDImages/md/web-large/DP-34069-001.jpg', fullUrl: 'https://images.metmuseum.org/CRDImages/md/original/DP-34069-001.jpg' },
        { id: '464294b', title: 'Virgin and Child — side view', artist: 'French', date: 'ca. 1275–1300',
          url: 'https://images.metmuseum.org/CRDImages/md/web-large/DP-34069-003.jpg', fullUrl: 'https://images.metmuseum.org/CRDImages/md/original/DP-34069-003.jpg' },
        { id: '464294c', title: 'Virgin and Child — detail', artist: 'French', date: 'ca. 1275–1300',
          url: 'https://images.metmuseum.org/CRDImages/md/web-large/DP-34069-004.jpg', fullUrl: 'https://images.metmuseum.org/CRDImages/md/original/DP-34069-004.jpg' },
    ],
    'met-japanese': [
        { id: '36491',   title: 'The Great Wave off Kanagawa', artist: 'Katsushika Hokusai', date: 'ca. 1830–32',
          url: 'https://images.metmuseum.org/CRDImages/as/web-large/DP141063.jpg',   fullUrl: 'https://images.metmuseum.org/CRDImages/as/original/DP141063.jpg' },
        { id: '39901',   title: 'Night-Shining White (horse scroll)', artist: 'Han Gan', date: 'ca. 750',
          url: 'https://images.metmuseum.org/CRDImages/as/web-large/DP153705.jpg',   fullUrl: 'https://images.metmuseum.org/CRDImages/as/original/DP153705.jpg' },
        { id: '39895',   title: 'The Classic of Filial Piety', artist: 'Li Gonglin', date: 'ca. 1085',
          url: 'https://images.metmuseum.org/CRDImages/as/web-large/DP151528.jpg',   fullUrl: 'https://images.metmuseum.org/CRDImages/as/original/DP151528.jpg' },
        { id: '54475',   title: 'Set of Sword Fittings (surimono print)', artist: 'Shungensai', date: 'Edo period',
          url: 'https://images.metmuseum.org/CRDImages/as/web-large/DP135751.jpg',   fullUrl: 'https://images.metmuseum.org/CRDImages/as/original/DP135751.jpg' },
    ],
    'met-islamic': [
        { id: '447408',  title: 'Textile Fragment', artist: 'Indian', date: '18th century',
          url: 'https://images.metmuseum.org/CRDImages/is/web-large/48800.jpg',       fullUrl: 'https://images.metmuseum.org/CRDImages/is/original/48800.jpg' },
        { id: '453344',  title: 'Pierced Window Screen (Jali)', artist: 'Indian', date: 'second half 16th century',
          url: 'https://images.metmuseum.org/CRDImages/is/web-large/DT490.jpg',       fullUrl: 'https://images.metmuseum.org/CRDImages/is/original/DT490.jpg' },
        { id: '453344b', title: 'Jali — geometric detail', artist: 'Indian', date: 'second half 16th century',
          url: 'https://images.metmuseum.org/CRDImages/is/web-large/DP326717.jpg',    fullUrl: 'https://images.metmuseum.org/CRDImages/is/original/DP326717.jpg' },
    ],
    'met-european': [
        { id: '437261',  title: 'The Penitence of Saint Jerome', artist: 'Joachim Patinir', date: 'ca. 1515',
          url: 'https://images.metmuseum.org/CRDImages/ep/web-large/DT5549.jpg',      fullUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DT5549.jpg' },
        { id: '435711',  title: 'An Egyptian Peasant Woman and Her Child', artist: 'Léon Bonnat', date: '1869–70',
          url: 'https://images.metmuseum.org/CRDImages/ep/web-large/DT234058.jpg',    fullUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DT234058.jpg' },
        { id: '438821',  title: 'Ia Orana Maria (Hail Mary)', artist: 'Paul Gauguin', date: '1891',
          url: 'https://images.metmuseum.org/CRDImages/ep/web-large/DT1025.jpg',      fullUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DT1025.jpg' },
        { id: '437202',  title: 'Christ Bearing the Cross', artist: 'North Netherlandish Painter', date: 'ca. 1470',
          url: 'https://images.metmuseum.org/CRDImages/ep/web-large/DP-20751-001.jpg', fullUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DP-20751-001.jpg' },
        { id: '436098',  title: 'The Crucifixion', artist: 'Gerard David', date: 'ca. 1495',
          url: 'https://images.metmuseum.org/CRDImages/ep/web-large/DP-17230-001.jpg', fullUrl: 'https://images.metmuseum.org/CRDImages/ep/original/DP-17230-001.jpg' },
    ]
};

export class MetMuseumProvider extends SourceProvider {
    constructor() {
        super({
            id: 'met-museum',
            name: 'The Metropolitan Museum of Art',
            contentType: 'image',
            tier: 2,
            description: 'Premium public domain art from The Met — 470k+ open-access works',
            supportsSearch: true,
            supportsPreload: true
        });

        this.searchUrl = 'https://collectionapi.metmuseum.org/public/collection/v1/search';
        this.objectUrl = 'https://collectionapi.metmuseum.org/public/collection/v1/objects';

        this._pool = new Map();   // categoryId → imageRecord[]
        this._lastRequest = 0;
        this._minInterval = 250;
    }

    async _doInit() {
        // Seed pools immediately for instant first-render
        for (const [catId, seeds] of Object.entries(SEED_RECORDS)) {
            this._pool.set(catId, [...seeds]);
        }
        console.log(`[MetMuseumProvider] ${Object.keys(MET_CATEGORIES).length} categories ready with ${Object.values(SEED_RECORDS).reduce((n, s) => n + s.length, 0)} seed images`);

        // Background enrichment (non-blocking)
        this._enrichAllCategories();
    }

    /** Rate-limiting fetch — no proxy */
    async _fetchJson(url, proxy = false) {
        const wait = Math.max(0, this._minInterval - (Date.now() - this._lastRequest));
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        this._lastRequest = Date.now();
        const target = proxy ? `${CORS_PROXY}${encodeURIComponent(url)}` : url;
        const resp = await fetch(target);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
    }

    /** Background: enrich all category pools via search + CORS proxy */
    async _enrichAllCategories() {
        for (const catId of Object.keys(MET_CATEGORIES)) {
            try {
                await this._enrichCategory(catId);
            } catch (e) {
                // Non-fatal — seeds remain available
            }
        }
    }

    async _enrichCategory(categoryId) {
        const cat = MET_CATEGORIES[categoryId];
        const pool = this._pool.get(categoryId) || [];
        const existingIds = new Set(pool.map(r => r.id));

        // /search is CORS-safe
        const params = new URLSearchParams({
            q: cat.q || '*',
            isPublicDomain: 'true',
            hasImages: 'true',
            departmentId: cat.departmentId
        });

        let search;
        try {
            search = await this._fetchJson(`${this.searchUrl}?${params}`);
        } catch (e) {
            console.warn(`[MetMuseumProvider] search failed for ${categoryId}:`, e.message);
            return;
        }

        const ids = (search.objectIDs || []).filter(id => !existingIds.has(String(id)));
        const shuffled = ids.sort(() => Math.random() - 0.5).slice(0, 30);

        let added = 0;
        for (const id of shuffled) {
            if (added >= 10) break;
            try {
                // /objects needs CORS proxy
                const data = await this._fetchJson(`${this.objectUrl}/${id}`, true);
                if (!data.isPublicDomain) continue;
                const url = data.primaryImageSmall || data.primaryImage;
                if (!url) continue;

                pool.push({
                    id: String(id),
                    title: data.title || 'Untitled',
                    artist: data.artistDisplayName || data.culture || '',
                    date: data.objectDate || '',
                    url,
                    fullUrl: data.primaryImage || url,
                    culture: data.culture || ''
                });
                existingIds.add(String(id));
                added++;
            } catch {
                // Skip failed objects
            }
        }

        this._pool.set(categoryId, pool);
        if (added > 0) console.log(`[MetMuseumProvider] ${cat.name}: enriched +${added} (total ${pool.length})`);
    }

    async getImagesInCategory(categoryId, limit = 20) {
        const pool = this._pool.get(categoryId) || (SEED_RECORDS[categoryId] || []);
        return pool.slice(0, limit);
    }

    async list() {
        return Object.entries(MET_CATEGORIES).map(([id, cat]) => ({
            id,
            type: 'image',
            name: cat.name,
            providerId: this.id,
            tier: this.tier,
            metadata: { category: id, tags: cat.tags, description: cat.name }
        }));
    }

    async get(categoryId) {
        const cat = MET_CATEGORIES[categoryId];
        if (!cat) return null;
        const images = await this.getImagesInCategory(categoryId);
        return {
            id: categoryId,
            type: 'image',
            name: cat.name,
            data: { images, previewUrl: images[0]?.url || null },
            providerId: this.id,
            tier: this.tier,
            metadata: { images, count: images.length }
        };
    }

    async getRandom(filter = {}) {
        const keys = Object.keys(MET_CATEGORIES);
        const catId = filter.category || keys[Math.floor(Math.random() * keys.length)];
        const images = await this.getImagesInCategory(catId);
        if (images.length === 0) return null;

        const img = images[Math.floor(Math.random() * images.length)];
        return {
            id: img.id,
            type: 'image',
            name: img.title,
            data: img,
            providerId: this.id,
            tier: this.tier,
            metadata: { artist: img.artist, date: img.date, url: img.url, categoryId: catId }
        };
    }
}
