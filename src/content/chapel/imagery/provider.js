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
import { CHAPEL_PINNED_COLLECTIONS, hasChapelCollection } from './collections.js';

export { hasChapelCollection };

let instance = null;
export function getChapelWorksProvider() {
    if (!instance) {
        instance = new PinnedWorksProvider({
            id: 'chapel-pinned',
            name: 'Chapel sacred works',
            collections: CHAPEL_PINNED_COLLECTIONS
        });
    }
    return instance;
}
