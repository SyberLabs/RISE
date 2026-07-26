/**
 * Build the runtime Audubon plate catalog from institutional IIIF manifests.
 *
 * Runtime code deliberately does not crawl remote catalogs. This script is the
 * controlled refresh boundary: it verifies rights, completeness, plate
 * identity, image dimensions, and institutional provenance before replacing
 * the checked-in generated catalog.
 *
 * Sources:
 * - Cincinnati & Hamilton County Public Library: all 435 Birds of America
 *   double-elephant folio plates (CONTENTdm / IIIF Presentation 2).
 * - University of Michigan: all 150 Viviparous Quadrupeds imperial-folio
 *   plates, exposed as three 52-canvas manifests (title, contents, 50 plates).
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OUTPUT_URL = new URL(
    '../src/sources/visual/audubon-catalog.generated.json',
    import.meta.url
);

const CINCINNATI_ORIGIN = 'https://cdm16998.contentdm.oclc.org';
const CINCINNATI_COLLECTION = 'p16998coll33';
const CINCINNATI_SEARCH =
    `${CINCINNATI_ORIGIN}/digital/api/search/collection/${CINCINNATI_COLLECTION}`
    + '/maxRecords/1024';

const MICHIGAN_VOLUMES = Object.freeze([
    { itemId: 'B6719889', volume: 1, date: '1845' },
    { itemId: 'B6719890', volume: 2, date: '1846' },
    { itemId: 'B6719891', volume: 3, date: '1848' }
]);

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 3;
const CINCINNATI_CONCURRENCY = 10;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJson(url, attempt = 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                Accept: 'application/json, application/ld+json',
                'User-Agent': 'RISE-Audubon-Catalog-Builder/1.0'
            }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const contentType = response.headers.get('content-type') || '';
        if (!/json|ld\+json/i.test(contentType)) {
            throw new Error(`unexpected content type ${contentType || '(missing)'}`);
        }
        return await response.json();
    } catch (error) {
        if (attempt >= MAX_ATTEMPTS) {
            throw new Error(`Failed ${url}: ${error.message}`, { cause: error });
        }
        await delay(500 * (2 ** (attempt - 1)));
        return fetchJson(url, attempt + 1);
    } finally {
        clearTimeout(timer);
    }
}

async function mapConcurrent(items, concurrency, mapper) {
    const results = new Array(items.length);
    let cursor = 0;
    const workers = Array.from(
        { length: Math.min(concurrency, items.length) },
        async () => {
            while (cursor < items.length) {
                const index = cursor++;
                results[index] = await mapper(items[index], index);
            }
        }
    );
    await Promise.all(workers);
    return results;
}

function metadataMap(metadata = []) {
    const result = new Map();
    for (const entry of metadata) {
        const label = typeof entry?.label === 'string'
            ? entry.label.trim().toLowerCase()
            : '';
        if (label && !result.has(label)) result.set(label, entry.value);
    }
    return result;
}

function plainText(value) {
    return String(value ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function numericPlate(value) {
    const matches = [...plainText(value).matchAll(/\b(\d{1,3})\b/g)];
    return matches.length ? Number(matches.at(-1)[1]) : NaN;
}

function imageResource(canvas) {
    const resource = canvas?.images?.[0]?.resource;
    const serviceId = resource?.service?.['@id'];
    if (!serviceId || !/^https:\/\//.test(serviceId)) return null;
    return {
        serviceId,
        width: Number(resource.width ?? canvas.width),
        height: Number(resource.height ?? canvas.height)
    };
}

function assertPublicDomain(text, sourceId) {
    const statement = plainText(text);
    if (!/no copyright|public domain/i.test(statement)
        && !/rightsstatements\.org\/vocab\/NoC-US/i.test(statement)
        && !/creativecommons\.org\/publicdomain\/mark/i.test(statement)) {
        throw new Error(`${sourceId} has no institution-stated public-domain right`);
    }
}

function assertDimensions(image, sourceId) {
    if (!image
        || !Number.isFinite(image.width)
        || !Number.isFinite(image.height)
        || Math.max(image.width, image.height) < 2400) {
        throw new Error(`${sourceId} lacks a display-quality IIIF image`);
    }
}

function parseCincinnatiManifest(itemId, manifest) {
    const metadata = metadataMap(manifest.metadata);
    const canvas = manifest?.sequences?.[0]?.canvases?.[0];
    const image = imageResource(canvas);
    const sourceId = `cincinnati:${itemId}`;
    const plate = numericPlate(metadata.get('plate number'));
    const rightsUri = plainText(metadata.get('rights uri'));
    const rightsDescription = plainText(metadata.get('rights description'));

    assertPublicDomain(`${rightsUri} ${rightsDescription}`, sourceId);
    assertDimensions(image, sourceId);
    // Covers, title pages, and volume furniture are image records too.
    // Plate Number is the institution's structural boundary; titles are
    // descriptive prose and must never be used to infer plate membership.
    if (!Number.isInteger(plate)) return null;

    return {
        id: `audubon:birds-folio:${plate}`,
        corpus: 'birds-folio',
        plate,
        title: plainText(metadata.get('title') || manifest.label),
        caption: plainText(metadata.get('plate caption')),
        artist: plainText(metadata.get('illustrator')),
        contributors: plainText(metadata.get('other contributors')),
        date: plainText(metadata.get('date') || metadata.get('date (original)')),
        medium: 'Hand-colored engraving and aquatint',
        rights: 'PUBLIC_DOMAIN',
        rightsUri: rightsUri || 'http://rightsstatements.org/vocab/NoC-US/1.0/',
        imageService: image.serviceId,
        width: image.width,
        height: image.height,
        sourceName: 'Cincinnati & Hamilton County Public Library',
        sourceUrl:
            `https://digital.cincinnatilibrary.org/digital/collection/`
            + `${CINCINNATI_COLLECTION}/id/${itemId}`
    };
}

async function buildBirds() {
    const search = await fetchJson(CINCINNATI_SEARCH);
    const items = Array.isArray(search.items) ? search.items : [];
    if (search.totalResults !== 449 || items.length !== 449) {
        throw new Error(
            `Cincinnati collection returned ${items.length}/${search.totalResults}; expected 449`
        );
    }

    let completed = 0;
    const works = await mapConcurrent(items, CINCINNATI_CONCURRENCY, async item => {
        const itemId = String(item.itemId);
        const manifestUrl =
            `${CINCINNATI_ORIGIN}/iiif/${CINCINNATI_COLLECTION}:${itemId}/manifest.json`;
        const work = parseCincinnatiManifest(itemId, await fetchJson(manifestUrl));
        completed++;
        if (completed % 50 === 0 || completed === items.length) {
            console.log(`[Audubon catalog] Cincinnati birds ${completed}/${items.length}`);
        }
        return work;
    });
    return works.filter(Boolean);
}

function parseMichiganCanvas(volume, canvas) {
    const metadata = metadataMap(canvas.metadata);
    const imageTitle = plainText(metadata.get('image title'));
    const plate = numericPlate(imageTitle.match(/\bplate\s+\d{1,3}\b/i)?.[0]);
    if (!Number.isInteger(plate)) return null; // title page / contents

    const image = imageResource(canvas);
    const imageId = plainText(metadata.get('image id'));
    const itemId = plainText(metadata.get('item id')) || volume.itemId;
    const sourceId = `michigan:${itemId}:${imageId}`;
    const rights = plainText(metadata.get('rights'));

    assertPublicDomain(rights, sourceId);
    assertDimensions(image, sourceId);

    const shortTitle = imageTitle
        .replace(/\s*\(v\.\s*\d+,\s*no\.\s*\d+,\s*plate\s*\d+\)\s*$/i, '')
        .trim();

    return {
        id: `audubon:quadrupeds-folio:${plate}`,
        corpus: 'quadrupeds-folio',
        plate,
        title: shortTitle,
        caption: imageTitle,
        artist: 'John James Audubon and John Woodhouse Audubon',
        contributors: plainText(metadata.get('creator')),
        date: plainText(metadata.get('date')) || volume.date,
        medium: plainText(metadata.get('medium')) || 'Hand-colored lithograph',
        rights: 'PUBLIC_DOMAIN',
        rightsUri: 'https://creativecommons.org/publicdomain/mark/1.0/',
        imageService: image.serviceId,
        width: image.width,
        height: image.height,
        sourceName: 'University of Michigan Library Digital Collections',
        sourceUrl: `https://quod.lib.umich.edu/s/sclaudubon/x-${itemId.toLowerCase()}/${imageId}`
    };
}

async function buildQuadrupeds() {
    const manifests = await Promise.all(MICHIGAN_VOLUMES.map(async volume => ({
        volume,
        manifest: await fetchJson(
            `https://quod.lib.umich.edu/cgi/i/image/api/manifest/sclaudubon:${volume.itemId}`
        )
    })));

    return manifests.flatMap(({ volume, manifest }) => {
        const canvases = manifest?.sequences?.[0]?.canvases;
        if (!Array.isArray(canvases) || canvases.length !== 52) {
            throw new Error(
                `Michigan volume ${volume.volume} has ${canvases?.length ?? 0} canvases; expected 52`
            );
        }
        return canvases.map(canvas => parseMichiganCanvas(volume, canvas)).filter(Boolean);
    });
}

function assertCompleteCorpus(works, corpus, first, last) {
    const subset = works.filter(work => work.corpus === corpus);
    const plates = subset.map(work => work.plate).sort((a, b) => a - b);
    const expected = Array.from({ length: last - first + 1 }, (_, index) => first + index);
    if (JSON.stringify(plates) !== JSON.stringify(expected)) {
        const actual = new Set(plates);
        const missing = expected.filter(plate => !actual.has(plate));
        throw new Error(
            `${corpus} incomplete: ${subset.length} works; missing plates ${missing.join(', ')}`
        );
    }
    if (new Set(subset.map(work => work.id)).size !== subset.length) {
        throw new Error(`${corpus} contains duplicate work identifiers`);
    }
}

async function main() {
    console.log('[Audubon catalog] Harvesting institutional IIIF metadata...');
    const [birds, quadrupeds] = await Promise.all([buildBirds(), buildQuadrupeds()]);
    const works = [...birds, ...quadrupeds]
        .sort((a, b) => a.corpus.localeCompare(b.corpus) || a.plate - b.plate);

    assertCompleteCorpus(works, 'birds-folio', 1, 435);
    assertCompleteCorpus(works, 'quadrupeds-folio', 1, 150);

    const catalog = {
        version: 1,
        generatedAt: new Date().toISOString(),
        sources: {
            birds: `${CINCINNATI_ORIGIN}/digital/collection/${CINCINNATI_COLLECTION}`,
            quadrupeds:
                'https://quod.lib.umich.edu/s/sclaudubon?'
                + 'field1=volu;field2=work;field3=type;field4=medium;field5=subje;'
                + 'field6=creat;field7=imag1;field8=item;field9=ic_all;'
                + 'rgn1=ic_all;rgn2=ic_all;rgn3=ic_all;rgn4=ic_all;rgn5=ic_all;'
                + 'rgn6=ic_all;rgn7=ic_all;rgn8=ic_all;rgn9=ic_all;'
                + 'size=50;sort=relevance;type=boolean;view=reslist;'
                + 'q1=Quadrupeds;q2=%2A;q3=%2A;q4=%2A;q5=%2A;q6=%2A;q7=%2A;q8=%2A;q9=%2A'
        },
        works
    };

    await writeFile(OUTPUT_URL, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
    console.log(
        `[Audubon catalog] Wrote ${works.length} verified plates to `
        + fileURLToPath(OUTPUT_URL)
    );
}

await main();
