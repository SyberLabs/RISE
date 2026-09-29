/**
 * The fixed answers as sealed Currents, the form a host's model hands an app.
 * A sealed Current carries text, a visual and Dives; it has no evidence and no
 * condition, so neither survives the trip, and neither is invented.
 */
import { BLACK_HOLES } from '../live/fixtures/black-holes.js';

export function toSealedCurrent(script, id = 'sealed-1') {
    return {
        schema: 'rise.current.v1',
        id,
        title: script.title,
        origin: { ...script.origin },
        segments: script.segments.map(segment => ({
            id: segment.id,
            text: segment.text,
            visual: segment.visual ?? 'still',
            ...(segment.dives ? { dives: segment.dives.map(dive => ({ id: dive.id, text: dive.text, anchor: { ...dive.anchor } })) } : {})
        }))
    };
}

export const BLACK_HOLES_CURRENT = toSealedCurrent(BLACK_HOLES, 'black-holes');
