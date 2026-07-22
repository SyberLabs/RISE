/**
 * Art Institute of Chicago adapter — pinned ids only.
 *
 * AIC's public API needs no key and serves IIIF images. Its European
 * Painting and Sculpture range carries the Chapel's register: Zurbarán,
 * Crivelli, Botticelli, Fra Bartolommeo, Jean Hey.
 *
 * Like every adapter here, this exposes no search: curation happens by
 * a human choosing objects; the code only resolves what was chosen.
 */

import { normalizeWork, RIGHTS } from '../works.js';
import { withAbortTimeout } from '../../../../sources/visual/request.js';

const OBJECT_ENDPOINT = 'https://api.artic.edu/api/v1/artworks';
const IIIF_BASE = 'https://www.artic.edu/iiif/2';
const FIELDS = 'id,title,artist_display,date_display,medium_display,is_public_domain,image_id';

export const AIC_SOURCE = 'aic';
const SOURCE_NAME = 'Art Institute of Chicago';

/** AIC states public domain with a boolean; anything else is UNKNOWN. */
function mapRights(record) {
    return record?.is_public_domain === true ? RIGHTS.CC0 : RIGHTS.UNKNOWN;
}

/**
 * @param {number|string} id - AIC artwork id
 * @param {Object} [options] - { signal, timeoutMs, fetchImpl }
 * @returns {Promise<Object|null>} normalized work, or null if unusable
 */
export async function resolveAicWork(id, options = {}) {
    const artworkId = String(id).trim();
    if (!/^\d+$/.test(artworkId)) return null;

    const doFetch = options.fetchImpl || fetch;
    const request = withAbortTimeout(
        options.signal, options.timeoutMs ?? 8000, 'AIC request');
    let record;
    try {
        const response = await doFetch(
            `${OBJECT_ENDPOINT}/${artworkId}?fields=${FIELDS}`,
            { signal: request.signal }
        );
        if (!response.ok) return null;
        record = (await response.json())?.data;
    } catch (error) {
        return null;
    } finally {
        request.cleanup();
    }

    if (!record || !record.image_id) return null;

    return normalizeWork({
        id: `${AIC_SOURCE}:${artworkId}`,
        title: record.title,
        artist: (record.artist_display || '').split('\n')[0],
        date: record.date_display,
        medium: record.medium_display,
        rights: mapRights(record),
        imageUrl: `${IIIF_BASE}/${record.image_id}/full/843,/0/default.jpg`,
        fullImageUrl: `${IIIF_BASE}/${record.image_id}/full/1686,/0/default.jpg`,
        sourceName: SOURCE_NAME,
        sourceUrl: `https://www.artic.edu/artworks/${artworkId}`
    });
}
