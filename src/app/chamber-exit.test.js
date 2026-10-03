/**
 * Where leaving a reading goes.
 *
 * The point of most of these cases is that they did NOT change: a
 * reading opened from the Library still returns to the orbital prep
 * screen, and a Workshop preview still returns to Workshop. Only a
 * reading opened from the try-rise screen goes somewhere new.
 */
import { describe, expect, it } from 'vitest';
import { KEYSTONE_SESSION_ORIGIN, chamberExitTarget } from './chamber-exit.js';

const LEAVING = ['back', 'exit', 'close'];
const fromTryRise = { origin: KEYSTONE_SESSION_ORIGIN };

describe('leaving a reading opened from try-rise', () => {
    it('opens the chosen next Keystone in its selection screen only for a finished Keystone', () => {
        expect(chamberExitTarget('pilot-next', {
            provenance: { kind: 'keystone', keystone: 'meditations' }
        }, { slug: 'metamorphoses' })).toEqual({
            kind: 'navigate', view: 'keystones', data: { slug: 'metamorphoses' }, replaceUrl: true
        });
        expect(chamberExitTarget('pilot-next', {}, { slug: 'metamorphoses' })).toBeNull();
        expect(chamberExitTarget('pilot-next', { provenance: { kind: 'keystone' } },
            { slug: 'meditations' })).toBeNull();
        expect(chamberExitTarget('pilot-next', {
            provenance: { kind: 'keystone', keystone: 'meditations' }
        }, { slug: '../other' })).toBeNull();
        expect(chamberExitTarget('pilot-next', {
            provenance: { kind: 'keystone', keystone: 'meditations' }
        }, { slug: 'meditations' })).toBeNull();
    });
    it('returns to the try-rise screen however the reader left', () => {
        for (const reason of LEAVING) {
            expect(chamberExitTarget(reason, fromTryRise), reason).toEqual({
                kind: 'navigate',
                view: 'keystones',
                replaceUrl: true
            });
        }
    });

    it('replaces the reading in history rather than stacking on it', () => {
        // The reader has already left; Back should offer the Portal, not
        // the address of the thing they just closed.
        expect(chamberExitTarget('back', fromTryRise).replaceUrl).toBe(true);
    });
});

describe('every other surface leaves exactly as it did', () => {
    it('returns a live reading to the live surface', () => {
        for (const reason of LEAVING) {
            expect(chamberExitTarget(reason, { origin: { view: 'live' } }), reason)
                .toEqual({ kind: 'navigate', view: 'live' });
        }
    });
    it('returns a reading opened from today\'s poem to that poem', () => {
        for (const reason of LEAVING) {
            expect(chamberExitTarget(reason, { origin: { view: 'today', name: 'Today\'s poem' } }), reason)
                .toEqual({ kind: 'navigate', view: 'today' });
        }
    });
    it('returns a disclosed Jev sample to its threshold on every leave action', () => {
        for (const reason of LEAVING) {
            expect(chamberExitTarget(reason, {
                origin: { view: 'portal', experience: 'jev-sample' }
            })).toEqual({ kind: 'navigate', view: 'portal' });
        }
    });
    it('returns a reading entered from Home to Home, where its proposal still waits', () => {
        for (const reason of LEAVING) {
            expect(chamberExitTarget(reason, {
                origin: { view: 'portal', experience: 'jev' }
            }), reason).toEqual({ kind: 'navigate', view: 'portal' });
        }
    });
    it('returns a Home reading opened through Adjust to Reader Setup', () => {
        for (const reason of LEAVING) {
            expect(chamberExitTarget(reason, {
                origin: { view: 'portal', experience: 'jev', adjusted: true }
            }), reason).toEqual({ kind: 'navigate', view: 'chamber' });
        }
    });
    it('sends a Library reading back to the orbital prep screen', () => {
        for (const reason of LEAVING) {
            expect(chamberExitTarget(reason, {}), reason)
                .toEqual({ kind: 'navigate', view: 'chamber' });
        }
    });

    it('isolates a Workshop preview to Workshop', () => {
        for (const reason of LEAVING) {
            expect(chamberExitTarget(reason, { isPreview: true }), reason)
                .toEqual({ kind: 'navigate', view: 'workshop' });
        }
    });

    it('keeps a preview in Workshop even when it came from try-rise', () => {
        // A preview belongs to the room previewing it, whatever the
        // reading itself was.
        expect(chamberExitTarget('back', { isPreview: true, origin: KEYSTONE_SESSION_ORIGIN }))
            .toEqual({ kind: 'navigate', view: 'workshop' });
    });

    it('continues a Library reading rather than navigating anywhere', () => {
        expect(chamberExitTarget('continue', fromTryRise)).toEqual({ kind: 'continue' });
        expect(chamberExitTarget('continue', {})).toEqual({ kind: 'continue' });
    });

    it('carries a recursion into Workshop with its text', () => {
        expect(chamberExitTarget('workshop', fromTryRise, { text: 'a passage' })).toEqual({
            kind: 'navigate',
            view: 'workshop',
            data: { draftIntent: 'new-recursion', text: 'a passage' }
        });
    });

    it('does nothing for a workshop hand-off with no text, as before', () => {
        expect(chamberExitTarget('workshop', {}, null)).toBeNull();
        expect(chamberExitTarget('workshop', {}, { text: '' })).toBeNull();
    });

    it('has no destination for a reason it does not know', () => {
        // Teardown still runs; the reader simply stays where they are.
        expect(chamberExitTarget('finished', fromTryRise)).toBeNull();
        expect(chamberExitTarget(undefined, {})).toBeNull();
    });

    it('survives a session it was handed nothing about', () => {
        expect(chamberExitTarget('back')).toEqual({ kind: 'navigate', view: 'chamber' });
        expect(chamberExitTarget('back', null)).toEqual({ kind: 'navigate', view: 'chamber' });
    });
});

describe('leaving a directed reading for the Workshop', () => {
    it('opens the saved project, and nothing without one', () => {
        expect(chamberExitTarget('visual-passages', {}, { blueprintId: 'bp-1' }))
            .toEqual({ kind: 'navigate', view: 'workshop', data: { blueprintId: 'bp-1' } });
        expect(chamberExitTarget('visual-passages', {}, {})).toBeNull();
        expect(chamberExitTarget('visual-passages', {}, { blueprintId: '' })).toBeNull();
    });
});
