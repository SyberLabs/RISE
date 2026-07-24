/**
 * Cleveland Museum of Art adapter.
 *
 * Open Access API: no key, ~60k objects with an explicit per-object
 * `share_license_status`. Strong in 18th–19th century European painting
 * and prints, which covers Atrium history subjects the Met is thin on.
 *
 * WHY THIS AND NOT RIJKSMUSEUM OR YALE (probed 2026-07-21):
 * - Rijksmuseum's public API returns 410 Gone; their replacement
 *   platform requires a key we do not hold.
 * - Yale's LUX API resolves objects and finds genuinely relevant
 *   material, but exposes an empty `subject_to` — no machine-readable
 *   rights — and its IIIF manifests return 401. Under the rights gate
 *   (ATRIUM-IMAGERY-SPEC.md §4) absence of a stated restriction is not
 *   permission, so an adapter would have to infer rights. It cannot.
 *
 * PINNED IDS ONLY, for the same reason as the Met adapter: search ranks
 * rather than curates.
 */

import { normalizeWork, RIGHTS } from '../works.js';
import { withAbortTimeout } from '../../../../sources/visual/request.js';

const OBJECT_ENDPOINT = 'https://openaccess-api.clevelandart.org/api/artworks';

export const CLEVELAND_SOURCE = 'cleveland';
const SOURCE_NAME = 'The Cleveland Museum of Art';

/**
 * Cleveland states sharing status per object. Only an explicit CC0 is
 * accepted; "Copyrighted" and anything unrecognized fall through to
 * UNKNOWN and are withheld by the work contract.
 */
function mapRights(record) {
    return record?.share_license_status === 'CC0' ? RIGHTS.CC0 : RIGHTS.UNKNOWN;
}

/**
 * @param {number|string} id - Cleveland accession/object id
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {Function} [options.fetchImpl] - injectable for tests
 * @returns {Promise<Object|null>}
 */
export async function resolveClevelandWork(id, options = {}) {
    // Cleveland's object endpoint accepts BOTH a numeric object id
    // (94979) and a dotted accession number (1953.143) at /{id}
    // (verified 2026-07). The old digit-only guard silently withheld
    // every accession-keyed work — the concordance's Baptism, among
    // others (PERICOPE-IMAGERY-SPEC §9). Accept digits or the dotted
    // accession form; reject anything else before spending a fetch.
    const objectId = String(id).trim();
    if (!/^\d+(\.\d+)*$/.test(objectId)) return null;

    const doFetch = options.fetchImpl || fetch;
    const request = withAbortTimeout(
        options.signal, options.timeoutMs ?? 8000, 'Cleveland request');
    let payload;
    try {
        const response = await doFetch(
            `${OBJECT_ENDPOINT}/${encodeURIComponent(objectId)}`, {
            signal: request.signal
        });
        if (!response.ok) return null;
        payload = await response.json();
    } catch (error) {
        return null;
    } finally {
        request.cleanup();
    }

    const record = payload?.data;
    if (!record) return null;

    // PIN IDENTITY stays canonical: a work resolved by its dotted
    // accession reports its own stable numeric id, and the pin adopts
    // it so the same work is never pinned under two ids.
    const canonicalId = Number.isInteger(record.id) ? record.id : objectId;

    const images = record.images || {};
    const imageUrl = images.web?.url || images.print?.url;
    if (!imageUrl) return null;

    // Cleveland bundles the artist's nationality and dates into one
    // string — "Henri Rousseau (French, 1844–1910)" — where the Met
    // keeps them apart. Split so attribution lines read identically
    // whichever institution a collection draws from.
    const creator = record.creators?.[0]?.description || '';
    const match = creator.match(/^([^(]+?)\s*\(([^)]*)\)\s*$/);
    const artist = match ? match[1].trim() : creator.trim();
    const artistBio = match ? match[2].trim() : '';

    return normalizeWork({
        id: `${CLEVELAND_SOURCE}:${canonicalId}`,
        title: record.title,
        artist,
        artistBio,
        date: record.creation_date,
        medium: record.technique || record.type || '',
        rights: mapRights(record),
        imageUrl,
        fullImageUrl: images.print?.url || images.full?.url || imageUrl,
        sourceName: SOURCE_NAME,
        sourceUrl: record.url || `https://clevelandart.org/art/${canonicalId}`
    });
}
