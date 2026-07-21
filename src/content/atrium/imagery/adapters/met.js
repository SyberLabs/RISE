/**
 * Met Museum adapter.
 *
 * The Metropolitan Museum's Open Access API: no key, ~490k objects, of
 * which ~400k are CC0. Strongest coverage in the Atrium's range for
 * classical antiquity (Roman portrait busts) and European painting
 * (David, Rembrandt, the Enlightenment portraitists).
 *
 * PINNED IDS ONLY. This adapter deliberately exposes no search. The
 * Met's search ranks rather than filters, exactly like a Commons
 * category: "French Revolution" returns a dog kennel, "James Watt"
 * returns an unrelated landscape painter named Watts, and even
 * title-scoped search returns "The Death of the Virgin" for "Death of
 * Socrates". Curation happens by a human choosing objects; the code
 * only resolves what was chosen.
 */

import { normalizeWork, RIGHTS } from '../works.js';
import { withAbortTimeout } from '../../../../sources/visual/request.js';

const OBJECT_ENDPOINT = 'https://collectionapi.metmuseum.org/public/collection/v1/objects';

export const MET_SOURCE = 'met';
const SOURCE_NAME = 'The Metropolitan Museum of Art';

/**
 * The Met states public domain with a single boolean on the record.
 * Anything else is UNKNOWN — we never infer permission from silence.
 */
function mapRights(record) {
    return record?.isPublicDomain === true ? RIGHTS.CC0 : RIGHTS.UNKNOWN;
}

/**
 * @param {number|string} id - Met object ID
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {number} [options.timeoutMs] - bounds a stalled museum API
 * @param {Function} [options.fetchImpl] - injectable for tests
 * @returns {Promise<Object|null>} normalized work, or null if unusable
 */
export async function resolveMetWork(id, options = {}) {
    const objectId = String(id).trim();
    if (!/^\d+$/.test(objectId)) return null;

    const doFetch = options.fetchImpl || fetch;
    // The cortex waits on external preload before the reading begins, so
    // an API that STALLS (rather than failing) would hold the
    // preparation screen open indefinitely. Bound every request.
    const request = withAbortTimeout(
        options.signal, options.timeoutMs ?? 8000, 'Met request');
    let record;
    try {
        const response = await doFetch(`${OBJECT_ENDPOINT}/${objectId}`, {
            signal: request.signal
        });
        if (!response.ok) return null;
        record = await response.json();
    } catch (error) {
        // A source that cannot be reached yields no work. The collection
        // simply carries one fewer image; it never carries a wrong one.
        return null;
    } finally {
        request.cleanup();
    }

    if (!record || record.message) return null;

    // web-large is the display candidate; original is kept for the
    // full-resolution path. A record with neither cannot be shown.
    const imageUrl = record.primaryImageSmall || record.primaryImage;
    if (!imageUrl) return null;

    return normalizeWork({
        id: `${MET_SOURCE}:${objectId}`,
        title: record.title,
        artist: record.artistDisplayName,
        artistBio: record.artistDisplayBio,
        date: record.objectDate,
        medium: record.medium,
        rights: mapRights(record),
        imageUrl,
        fullImageUrl: record.primaryImage || imageUrl,
        sourceName: SOURCE_NAME,
        sourceUrl: record.objectURL
            || `https://www.metmuseum.org/art/collection/search/${objectId}`
    });
}
