/**
 * Rijksmuseum adapter — pinned ids only, key-free Linked Art API.
 *
 * Resolution is three hops, each a stable persistent identifier:
 *   object (id.rijksmuseum.nl/<id>)
 *     → VisualItem (the license lives HERE: Public Domain Mark / CC0)
 *       → DigitalObject (the IIIF image URL at iiif.micr.io)
 *
 * The rights gate reads the VisualItem's stated license — the
 * photograph's own declaration, not an inference from the work's age.
 * A missing or non-PD statement yields null, never a fallback.
 *
 * One timeout budget bounds the WHOLE chain: a stalled hop cannot
 * hold the preparation screen open.
 */

import { normalizeWork, RIGHTS } from '../works.js';
import { withAbortTimeout } from '../../../../sources/visual/request.js';

const ID_BASE = 'https://id.rijksmuseum.nl';

export const RIJKS_SOURCE = 'rijks';
const SOURCE_NAME = 'Rijksmuseum';

const JSON_HEADERS = { 'Accept': 'application/json' };

function names(entity) {
    return (entity?.identified_by || [])
        .filter(part => part.type === 'Name')
        .map(part => part.content)
        .filter(Boolean);
}

/** Prefer an English title; Rijksmuseum records usually carry both. */
function pickTitle(titles) {
    return titles.find(title => /^[\x20-\x7E‘’“”]+$/.test(title) && /[a-z]/.test(title))
        || titles[0] || '';
}

/**
 * @param {number|string} id - Rijksmuseum LOD id (the numeric tail of
 *   https://id.rijksmuseum.nl/<id>)
 * @param {Object} [options] - { signal, timeoutMs, fetchImpl }
 * @returns {Promise<Object|null>} normalized work, or null if unusable
 */
export async function resolveRijksWork(id, options = {}) {
    const lodId = String(id).trim();
    if (!/^\d+$/.test(lodId)) return null;

    const doFetch = options.fetchImpl || fetch;
    const request = withAbortTimeout(
        options.signal, options.timeoutMs ?? 8000, 'Rijksmuseum request');

    const getJson = async url => {
        const response = await doFetch(url, {
            signal: request.signal,
            headers: JSON_HEADERS
        });
        if (!response.ok) return null;
        return response.json();
    };

    try {
        const object = await getJson(`${ID_BASE}/${lodId}`);
        if (!object?.id) return null;

        const visualRef = (object.shows || [])[0]?.id;
        if (!visualRef || !visualRef.startsWith(ID_BASE)) return null;
        const visual = await getJson(visualRef);
        if (!visual) return null;

        // The stated license of the IMAGE. Silence is not permission.
        const visualText = JSON.stringify(visual);
        const isPublicDomain = /creativecommons\.org\/publicdomain\/(mark|zero)/.test(visualText);
        if (!isPublicDomain) return null;

        const digitalRef = (visual.digitally_shown_by || [])[0]?.id;
        if (!digitalRef || !digitalRef.startsWith(ID_BASE)) return null;
        const digital = await getJson(digitalRef);
        const accessPoint = (digital?.access_point || [])[0]?.id || '';
        if (!accessPoint.startsWith('https://iiif.micr.io/')) return null;

        const objectNumber = (object.identified_by || [])
            .find(part => part.type === 'Identifier' && /^[A-Z]{2}-/.test(part.content || ''))
            ?.content || '';
        const artist = (object.produced_by?.carried_out_by || [])
            .map(actor => actor._label)
            .filter(Boolean)
            .join(', ');

        return normalizeWork({
            id: `${RIJKS_SOURCE}:${lodId}`,
            title: pickTitle(names(object)),
            artist,
            date: object.produced_by?.timespan?._label || '',
            medium: (object.made_of || []).map(part => part._label).filter(Boolean).join(', '),
            rights: RIGHTS.CC0,
            imageUrl: accessPoint.replace('/full/max/', '/full/843,/'),
            fullImageUrl: accessPoint,
            sourceName: objectNumber ? `${SOURCE_NAME} · ${objectNumber}` : SOURCE_NAME,
            sourceUrl: `${ID_BASE}/${lodId}`
        });
    } catch (error) {
        // A source that cannot be reached yields no work — the
        // collection carries one fewer image, never a wrong one.
        return null;
    } finally {
        request.cleanup();
    }
}
