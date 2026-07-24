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

// Dynamic pericope collections (PERICOPE-IMAGERY-SPEC §6.1): a Gospel
// chapter launch registers its chapter's pericope collections here,
// keyed by their chapel-gospel-* ids. They live beside the static
// painted collections; the cortex resolves both through the one
// provider and never learns which is which. A launch replaces the
// whole overlay, so a previous reading's pericopes never linger.
let dynamicCollections = Object.freeze({});

/** True for a static painted collection OR a registered pericope. */
export function hasChapelCollection(id) {
    return hasStaticChapelCollection(id) || Object.hasOwn(dynamicCollections, id);
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
    return { ...CHAPEL_PINNED_COLLECTIONS, ...dynamicCollections };
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
