/**
 * Audubon bulk hydration service.
 *
 * The generated catalog is the command/observation boundary between remote
 * cultural-heritage APIs and the reading runtime. It is refreshed explicitly
 * by scripts/build-audubon-catalog.mjs and contains only institution-asserted,
 * display-quality public-domain plates. Runtime hydration is therefore pure:
 * turn an audited IIIF service identifier into responsive display URLs.
 *
 * This module is loaded only for the Animals intent. It does not register a new
 * UI category or provider identity; "Animals" remains a reader intent and each
 * work carries its true institutional provenance.
 */

import catalog from './audubon-catalog.generated.json';
import { ShuffleBag } from './shuffle-bag.js';

export const AUDUBON_CORPORA = Object.freeze({
    BIRDS: 'birds-folio',
    QUADRUPEDS: 'quadrupeds-folio'
});

export const AUDUBON_EXPECTED_COUNTS = Object.freeze({
    [AUDUBON_CORPORA.BIRDS]: 435,
    [AUDUBON_CORPORA.QUADRUPEDS]: 150
});

const DISPLAY_WIDTH = 1600;
const DETAIL_WIDTH = 3200;
const MIN_LONG_EDGE = 2400;
const PUBLIC_DOMAIN_URIS = [
    /rightsstatements\.org\/vocab\/NoC-US\/1\.0/i,
    /creativecommons\.org\/publicdomain\/mark\/1\.0/i
];
const ALLOWED_IMAGE_HOSTS = new Set([
    'cdm16998.contentdm.oclc.org',
    'quod.lib.umich.edu'
]);
const ALLOWED_SOURCE_HOSTS = new Set([
    'digital.cincinnatilibrary.org',
    'quod.lib.umich.edu'
]);

const clean = (value, max = 300) => String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

function trustedHttpsUrl(value, allowedHosts) {
    try {
        const url = new URL(String(value));
        return url.protocol === 'https:' && allowedHosts.has(url.hostname)
            ? url.href.replace(/\/$/, '')
            : '';
    } catch {
        return '';
    }
}

function iiifImageUrl(service, requestedWidth, sourceWidth) {
    const width = Math.max(1, Math.min(
        Number(requestedWidth) || DISPLAY_WIDTH,
        Number(sourceWidth) || requestedWidth
    ));
    return `${service}/full/${Math.round(width)},/0/default.jpg`;
}

/**
 * Normalize and independently re-gate one generated record.
 * A malformed or rights-silent record is withheld, never substituted.
 */
export function hydrateAudubonRecord(record, options = {}) {
    if (!record || typeof record !== 'object') return null;
    if (!Object.values(AUDUBON_CORPORA).includes(record.corpus)) return null;

    const plate = Number(record.plate);
    const width = Number(record.width);
    const height = Number(record.height);
    const rightsUri = clean(record.rightsUri, 500);
    const imageService = trustedHttpsUrl(record.imageService, ALLOWED_IMAGE_HOSTS);
    const sourceUrl = trustedHttpsUrl(record.sourceUrl, ALLOWED_SOURCE_HOSTS);
    const id = clean(record.id, 120);

    if (!id) return null;
    if (!Number.isInteger(plate) || plate < 1) return null;
    if (record.rights !== 'PUBLIC_DOMAIN'
        || !PUBLIC_DOMAIN_URIS.some(pattern => pattern.test(rightsUri))) return null;
    if (!imageService || !sourceUrl) return null;
    if (!Number.isFinite(width) || !Number.isFinite(height)
        || Math.max(width, height) < MIN_LONG_EDGE) return null;

    const displayWidth = options.displayWidth ?? DISPLAY_WIDTH;
    const detailWidth = options.detailWidth ?? DETAIL_WIDTH;
    const title = clean(record.title, 300) || `Audubon plate ${plate}`;

    return Object.freeze({
        id,
        title,
        artist: clean(record.artist, 180),
        contributors: clean(record.contributors, 500),
        date: clean(record.date, 80),
        medium: clean(record.medium, 160),
        caption: clean(record.caption, 600),
        corpus: record.corpus,
        plate,
        rights: 'PUBLIC_DOMAIN',
        rightsUri,
        width,
        height,
        url: iiifImageUrl(imageService, displayWidth, width),
        fullUrl: iiifImageUrl(imageService, detailWidth, width),
        imageService,
        sourceName: clean(record.sourceName, 160),
        sourceUrl
    });
}

function assertCanonicalCompleteness(works, expectedCounts) {
    for (const [corpus, expectedCount] of Object.entries(expectedCounts || {})) {
        const subset = works
            .filter(work => work.corpus === corpus)
            .sort((a, b) => a.plate - b.plate);
        if (subset.length !== expectedCount) {
            throw new Error(
                `Audubon ${corpus} has ${subset.length} verified plates; expected ${expectedCount}`
            );
        }
        for (let index = 0; index < expectedCount; index++) {
            if (subset[index].plate !== index + 1) {
                throw new Error(
                    `Audubon ${corpus} is missing canonical plate ${index + 1}`
                );
            }
        }
    }
    if (new Set(works.map(work => work.id)).size !== works.length) {
        throw new Error('Audubon catalog contains duplicate work identifiers');
    }
}

/**
 * Smooth weighted round-robin.
 *
 * Eleven bird and nine mammal selections per twenty draws preserve both the
 * breadth of the 435-plate bird corpus and the visual presence of mammals.
 * Unlike random weighted choice, the deficit schedule cannot produce long
 * single-corpus streaks.
 */
class CorpusSchedule {
    constructor(weights) {
        this.weights = Object.freeze({ ...weights });
        this.current = Object.fromEntries(Object.keys(weights).map(key => [key, 0]));
        this.total = Object.values(weights).reduce((sum, value) => sum + value, 0);
    }

    next(available) {
        let selected = null;
        for (const [corpus, weight] of Object.entries(this.weights)) {
            if (!available.has(corpus)) continue;
            this.current[corpus] += weight;
            if (selected === null || this.current[corpus] > this.current[selected]) {
                selected = corpus;
            }
        }
        if (selected !== null) this.current[selected] -= this.total;
        return selected;
    }
}

export class AudubonHydrationService {
    constructor(options = {}) {
        const rawWorks = options.catalog?.works ?? options.catalog ?? catalog.works;
        const expectedCounts = options.expectedCounts === undefined
            ? AUDUBON_EXPECTED_COUNTS
            : options.expectedCounts;
        const hydrated = Array.isArray(rawWorks)
            ? rawWorks.map(record => hydrateAudubonRecord(record, options)).filter(Boolean)
            : [];

        assertCanonicalCompleteness(hydrated, expectedCounts);

        this.catalogVersion = options.catalog?.version ?? catalog.version;
        this.generatedAt = options.catalog?.generatedAt ?? catalog.generatedAt;
        this.works = Object.freeze(hydrated);
        this.byCorpus = new Map(Object.values(AUDUBON_CORPORA).map(corpus => [
            corpus,
            Object.freeze(hydrated.filter(work => work.corpus === corpus))
        ]));
        this._workBag = new ShuffleBag(options.random);
        this._schedule = new CorpusSchedule(options.weights || {
            [AUDUBON_CORPORA.BIRDS]: 11,
            [AUDUBON_CORPORA.QUADRUPEDS]: 9
        });
    }

    getPool() {
        return this.works;
    }

    draw() {
        const available = new Set(
            [...this.byCorpus.entries()]
                .filter(([, works]) => works.length > 0)
                .map(([corpus]) => corpus)
        );
        const corpus = this._schedule.next(available);
        if (!corpus) return null;
        return this._workBag.draw(`audubon:${corpus}`, this.byCorpus.get(corpus));
    }

    getStats() {
        return Object.freeze({
            version: this.catalogVersion,
            generatedAt: this.generatedAt,
            total: this.works.length,
            corpora: Object.fromEntries(
                [...this.byCorpus.entries()].map(([corpus, works]) => [corpus, works.length])
            )
        });
    }
}

let sharedService = null;

export function getAudubonHydrationService() {
    if (!sharedService) sharedService = new AudubonHydrationService();
    return sharedService;
}
