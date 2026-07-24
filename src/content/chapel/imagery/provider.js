/**
 * Chapel pinned-works provider.
 *
 * The same PinnedWorksProvider machinery the Atrium uses, holding the
 * Chapel's collections instead. A separate instance with its own
 * shuffle state, so Chapel readings and Atrium readings never share a
 * rotation.
 *
 * ISOLATION (spec §5): not registered with the Chamber's provider
 * registry, never in the browsable Collections panel. The cortex
 * reaches it only for chapel-* ids, which only a Chapel launch can
 * supply — and chapel-* routing has NO fallback: a collection that
 * cannot resolve yields stillness, never a Wikimedia substitute.
 */

import { PinnedWorksProvider } from '../../atrium/imagery/provider.js';
import { CHAPEL_PINNED_COLLECTIONS, hasChapelCollection as hasStaticChapelCollection } from './collections.js';
import { allPericopeCollections } from './pericope-program.js';

// A persisted program can outlive the launch module state (hard reload).
// Keep the curated pins recoverable inside this hidden provider so its ids
// continue to resolve without registering them as global/browsable sources.
const RECOVERABLE_PERICOPE_COLLECTIONS = Object.freeze(allPericopeCollections());

// Dynamic pericope collections (PERICOPE-IMAGERY-SPEC §6.1): a Gospel
// chapter launch registers its chapter's pericope collections here,
// keyed by their chapel-gospel-* ids. They may override the recoverable
// catalog for that launch; activation still comes exclusively from the
// current reading's schedule, never by searching this provider.
let dynamicCollections = Object.freeze({});

/** True for a static painted collection or a curated pericope id. */
export function hasChapelCollection(id) {
    return hasStaticChapelCollection(id)
        || Object.hasOwn(RECOVERABLE_PERICOPE_COLLECTIONS, id)
        || Object.hasOwn(dynamicCollections, id);
}

/**
 * Register (replacing) this session's dynamic pericope collections.
 * Passing {} clears them (a non-Gospel or unmapped reading).
 */
export function setDynamicChapelCollections(collections) {
    dynamicCollections = Object.freeze({ ...(collections || {}) });
    // The provider holds a live reference to the merged view, so a
    // fresh instance next call picks up the change; refresh the
    // existing instance's collection map too.
    if (instance) instance.setCollections(mergedCollections());
}

function mergedCollections() {
    return {
        ...CHAPEL_PINNED_COLLECTIONS,
        ...RECOVERABLE_PERICOPE_COLLECTIONS,
        ...dynamicCollections
    };
}

let instance = null;
export function getChapelWorksProvider() {
    if (!instance) {
        instance = new PinnedWorksProvider({
            id: 'chapel-pinned',
            name: 'Chapel sacred works',
            collections: mergedCollections()
        });
    }
    return instance;
}
