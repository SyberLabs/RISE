/**
 * THE LIFECYCLE ROUND TRIP.
 *
 * Every identity-carrying field a reading owns must survive — or die —
 * correctly across the three seams that rebuild an orbital: persist,
 * restore, and reset. This suite exists because a whole class of bug
 * lived in exactly that gap and none of it was caught by a unit test.
 *
 * The canonical instance is Matthew 27, which sat on `before-pilate`
 * through verse 66. It was not a race and not pool warming: the
 * `visualProgram` travelled with `loadText` but was never persisted, so
 * any path that rebuilt the Orbital from saved state — exit and return,
 * a reset, a page reload — restored the text and its first collection
 * and dropped the program. The second session built no visual schedule
 * and the cortex stayed on the persisted first pool. Every unit test
 * passed while the reading was visibly wrong.
 *
 * The distinction that fixes it, and that this suite defends:
 *
 *   A visual program is LOADED-TEXT IDENTITY, not a preference.
 *
 * Preferences reset. Identity travels with the text and dies with it.
 * `resetPrefs` must therefore preserve the program while resetting
 * pace and mode, and `clearText` must take it away.
 *
 * These tests deliberately reconstruct the component rather than
 * calling the private persistence helpers, because reconstruction is
 * what actually happened in the field and a test that pokes
 * `_persistText` directly would prove only that the helper is
 * self-consistent.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// jsdom has no indexedDB; PersonalSwells probes it during orbital init.
// A never-settling stub keeps the run clean (same shim as the origin suite).
if (typeof globalThis.indexedDB === 'undefined') {
    globalThis.indexedDB = { open: () => ({ onsuccess: null, onerror: null, onupgradeneeded: null }) };
}

const { ChamberOrbital } = await import('./ChamberOrbital.js');

const PREFS_KEY = 'rise_orbital_prefs_v1';
const TEXT_KEY = 'rise_orbital_text_v1';

/** A source-space program: the Journey shape, not the scripture one. */
const PROGRAM = Object.freeze({
    coordinateSpace: 'source',
    segments: [
        { id: 'book-vi-chariot', match: { sourceIds: ['paradise-lost-vi'] }, collectionId: 'milton-chariot' },
        { id: 'book-vi-fall', match: { sourceIds: ['paradise-lost-vi'], fromProgress: 0.6, toProgress: 1 }, collectionId: 'milton-fall' }
    ]
});

const ORIGIN = Object.freeze({ view: 'journeys', icon: '❧', name: 'Journeys' });
const PROVENANCE = Object.freeze({ domain: 'journey', journeyId: 'journey-war' });
const SOURCES = Object.freeze([
    { id: 'paradise-lost-vi', title: 'Paradise Lost, Book VI', content: 'So spake the Son, and into terrour changed.' }
]);

function mount() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const orbital = new ChamberOrbital(container, { onNavigate: () => {}, onBeginSession: () => {} });
    return { orbital, container };
}

function unmount({ orbital, container }) {
    orbital.destroy();
    container.remove();
}

/** Load a reading carrying every identity field at once. */
function loadIdentityBearingText(orbital) {
    orbital.loadText('So spake the Son, and into terrour changed.', 'Paradise Lost', {
        sources: [...SOURCES],
        provenance: { ...PROVENANCE },
        origin: { ...ORIGIN },
        visualProgram: PROGRAM
    });
}

describe('orbital lifecycle round trip', () => {
    beforeEach(() => {
        localStorage.removeItem(PREFS_KEY);
        localStorage.removeItem(TEXT_KEY);
    });

    it('carries a visual program across a reconstruction — the Matthew 27 fault', () => {
        const first = mount();
        loadIdentityBearingText(first.orbital);
        expect(first.orbital.config.visualProgram).toBeTruthy();
        unmount(first);

        // Exit and return. Nothing survives but localStorage — which is
        // precisely the condition under which the Gospel lost its program.
        const second = mount();
        const restored = second.orbital.config.visualProgram;

        expect(restored, 'the program did not survive a rebuild from saved state').toBeTruthy();
        expect(restored.coordinateSpace).toBe('source');
        expect(restored.segments.map(s => s.id)).toEqual(['book-vi-chariot', 'book-vi-fall']);
        unmount(second);
    });

    it('carries the rest of the reading identity across a reconstruction', () => {
        const first = mount();
        loadIdentityBearingText(first.orbital);
        unmount(first);

        const second = mount();
        const c = second.orbital.config;

        expect(c.textSource).toBe('Paradise Lost');
        expect(c.origin?.view).toBe('journeys');
        expect(c.provenance?.journeyId).toBe('journey-war');
        expect(c.sources?.[0]?.id).toBe('paradise-lost-vi');
        // The text itself may be reconstituted from the sources rather
        // than stored twice — either way a reader must get one.
        expect(String(c.text || c.sources?.[0]?.content || '')).toContain('So spake the Son');
        unmount(second);
    });

    it('resetPrefs resets preferences and keeps identity — a program is not a preference', () => {
        const { orbital, container } = mount();
        loadIdentityBearingText(orbital);

        orbital.config.wpm = 430;
        orbital.config.chunkMode = 'sentence';
        orbital.resetPrefs();

        expect(orbital.config.wpm, 'a preference survived a reset').not.toBe(430);
        expect(orbital.config.visualProgram, 'the program was reset as if it were a preference').toBeTruthy();
        expect(orbital.config.visualProgram.segments).toHaveLength(2);
        expect(orbital.config.text).toBeTruthy();
        expect(orbital.config.origin?.view).toBe('journeys');
        expect(orbital.config.provenance?.journeyId).toBe('journey-war');

        unmount({ orbital, container });
    });

    it('a reset survives its own reconstruction', () => {
        // resetPrefs holding the program in memory is only half of it —
        // it must also have written it back, or the next rebuild drops it
        // and the bug returns one navigation later.
        const first = mount();
        loadIdentityBearingText(first.orbital);
        first.orbital.resetPrefs();
        unmount(first);

        const second = mount();
        expect(second.orbital.config.visualProgram,
            'the program survived the reset in memory but not on disk').toBeTruthy();
        unmount(second);
    });

    it('clearText takes the identity with it, in memory and on disk', () => {
        const first = mount();
        loadIdentityBearingText(first.orbital);
        first.orbital.clearText();

        expect(first.orbital.config.text).toBeFalsy();
        expect(first.orbital.config.visualProgram,
            'a cleared reading kept its program — the next text would inherit it').toBeFalsy();
        unmount(first);

        // And it stays gone. A program that resurrects on the next mount
        // would bind one reading's imagery to another's words, which is
        // the mirror image of the Matthew 27 fault and worse.
        const second = mount();
        expect(second.orbital.config.visualProgram).toBeFalsy();
        expect(second.orbital.config.text).toBeFalsy();
        unmount(second);
    });

    it('a reading with no program does not invent one', () => {
        const first = mount();
        first.orbital.loadText('Plain pasted text, no imagery authored.', 'Pasted', {});
        expect(first.orbital.config.visualProgram).toBeFalsy();
        unmount(first);

        const second = mount();
        expect(second.orbital.config.visualProgram).toBeFalsy();
        expect(second.orbital.config.textSource).toBe('Pasted');
        unmount(second);
    });

    it('a corrupt saved program is refused rather than half-restored', () => {
        // Reverent degradation at the persistence boundary: a hand-edited
        // or version-skewed entry must not produce a partially valid
        // program that the scheduler then reads as authority.
        localStorage.setItem(TEXT_KEY, JSON.stringify({
            text: 'Some text',
            textSource: 'Broken',
            visualProgram: { coordinateSpace: 'source', segments: 'not-an-array' }
        }));

        const { orbital, container } = mount();
        expect(orbital.config.visualProgram).toBeFalsy();
        unmount({ orbital, container });
    });
});
