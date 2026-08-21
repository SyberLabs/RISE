/**
 * WHAT A READER RECEIVES WHERE TWO PIECES ARE JOINED.
 *
 * The shelf inverted — 944 divisions, median 850 words — so a reading is now
 * composed from several pieces across several works rather than cut from one.
 * Stitching worked mechanically and read as a list: between Judge Somers and
 * Benjamin Fraser the compiler emitted one blank atom and nothing else, and
 * crossing OUT of Spoon River into the Tao looked exactly the same.
 *
 * THIS PRESSES THE CONTROL RATHER THAN CALLING THE FUNCTION. The worst defect
 * of this session survived 2,441 green tests because every test called an
 * inner function directly. So these compile a real session through
 * `compileSession` and then hand the atoms it produced to a real `Chamber`
 * mounted in a real document, and assert the two things a reader actually
 * gets: the atoms, and the frame the Chamber paints from them.
 *
 * The names are composed by `extentSourceName`, which is the function the
 * Scriptorium resolver uses, so the strings under test are the strings the
 * shelf really produces rather than strings this file invented.
 */
import { describe, expect, it } from 'vitest';
import { compileSession } from '../core/session-compiler.js';
import { extentSourceName } from '../core/library-extent.js';
import { EXPERIENCE_PROGRAM_SCHEMA } from '../core/experience-program.js';
import { Chamber } from './Chamber.js';

const EPITAPH = 'I went to the courthouse and sat all day.\n'
    + 'The wind blew over the wheat and nobody came.\n'
    + 'Now I am a flowering weed under the long grass.';

/** A Spoon River epitaph as the resolver hands one over. */
const epitaph = (division, label) => ({
    id: `spoon-river-anthology#${division}`,
    name: extentSourceName({
        workTitle: 'Spoon River Anthology', ordinal: division, label
    }),
    data: EPITAPH
});

const chapter = (division, label) => ({
    id: `sacred-tao-te-ching#${division}`,
    name: extentSourceName({
        workTitle: 'Tao Te Ching', noun: 'Chapter', ordinal: division, label
    }),
    data: 'The way that can be told is not the eternal way, and returns to the root.'
});

const book = (division, label) => ({
    id: `literary-meditations#${division}`,
    name: extentSourceName({
        workTitle: 'Meditations', noun: 'Book', ordinal: division, label
    }),
    data: 'Their spirits beat against the walls of the world and are not heard.'
});

const compile = (sources) => compileSession({ name: 'Stitch', wpm: 200, sources });

const breaksOf = (session) =>
    session.atoms.filter(atom => atom.tags?.includes('source-break'));

function mount(session) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const chamber = new Chamber(container, { session, player: null, autoStart: false });
    return { chamber, container, display: container.querySelector('#atom-display') };
}

describe('the atoms a stitched reading produces', () => {
    it('names the piece arriving at every seam, and adds no atoms to do it', () => {
        const sources = [epitaph(12, 'Judge Somers'), epitaph(13, 'Benjamin Fraser')];
        const session = compile(sources);
        const breaks = breaksOf(session);

        expect(breaks).toHaveLength(1);
        expect(breaks[0].seam).toEqual({
            depth: 'piece',
            label: 'Benjamin Fraser',
            name: 'Spoon River Anthology · Benjamin Fraser'
        });

        // The seam is a property of the atom that was already there. Nothing
        // is inserted, and nothing is lengthened.
        const bare = compileSession({
            name: 'Stitch', wpm: 200,
            sources: sources.map(({ name, ...rest }) => ({ ...rest, name: '' }))
        });
        expect(session.atoms).toHaveLength(bare.atoms.length);
        expect(session.totalDuration).toBe(bare.totalDuration);
    });

    it('says nothing at a seam, because a boundary is still empty', () => {
        const session = compile([epitaph(12, 'Judge Somers'), chapter(40, 'Chapter 40')]);
        for (const atom of breaksOf(session)) {
            expect(atom.content).toBe('');
            expect(atom.weight).toBe(0);
            expect(atom.timingLocked).toBe(true);
        }
    });

    it('crosses into another work more deeply than into another epitaph', () => {
        const session = compile([
            epitaph(12, 'Judge Somers'),
            epitaph(13, 'Benjamin Fraser'),
            chapter(40, 'Chapter 40')
        ]);
        const [shallow, deep] = breaksOf(session);

        expect(shallow.seam.depth).toBe('piece');
        expect(shallow.seam.label).toBe('Benjamin Fraser');

        // Another book: the reader is told which one, in full.
        expect(deep.seam.depth).toBe('work');
        expect(deep.seam.label).toBe('Tao Te Ching · Chapter 40');
    });

    it('keeps a shared first letter that is not a shared word', () => {
        // "Judge Somers" and "John M. Church" share a J. Eliding the head the
        // two names have in common must not eat it.
        const session = compile([
            epitaph(12, 'Judge Somers'), epitaph(66, 'John M. Church')
        ]);
        expect(breaksOf(session)[0].seam.label).toBe('John M. Church');
    });

    it('decides the depth by the extent grammar, not by how the names look', () => {
        // Two works whose titles share a head. Comparing the strings would
        // call this the same book and print a truncated title; the ids say
        // otherwise, and the ids are where RISE already answers this question.
        const session = compile([
            book(4, 'Book IV'),
            {
                id: 'meditations-first-philosophy#2',
                name: extentSourceName({
                    workTitle: 'Meditations on First Philosophy',
                    noun: 'Meditation', ordinal: 2, label: 'Meditation II'
                }),
                data: EPITAPH
            }
        ]);
        const [crossing] = breaksOf(session);
        expect(crossing.seam.depth).toBe('work');
        expect(crossing.seam.label).toBe('Meditations on First Philosophy · Meditation II');
    });

    it('elides the shared head only between pieces of one work', () => {
        // The mirror of the case above: one work, two divisions whose names
        // necessarily share the work's title. Here the head IS dropped, so a
        // reader is shown the two words that changed rather than the seven
        // they already have.
        const session = compile([book(4, 'Book IV'), book(5, 'Book V')]);
        const [crossing] = breaksOf(session);
        expect(crossing.seam.depth).toBe('piece');
        expect(crossing.seam.label).toBe('Book V');
        expect(crossing.seam.name).toBe('Meditations · Book V');
    });

    it('marks all ten seams of the eleven-piece stitch, three of them deep', () => {
        const session = compile([
            epitaph(12, 'Amanda Barker'), epitaph(20, 'Chase Henry'),
            epitaph(33, 'Hod Putt'), epitaph(47, 'Ollie McGee'),
            chapter(16, 'Chapter 16'),
            epitaph(60, 'Fletcher McGee'), epitaph(77, 'Knowlt Hoheimer'),
            epitaph(90, 'Lydia Puckett'), epitaph(101, 'Frank Drummer'),
            chapter(76, 'Chapter 76'),
            book(4, 'Book IV')
        ]);
        const breaks = breaksOf(session);

        expect(breaks).toHaveLength(10);
        expect(breaks.every(atom => atom.seam)).toBe(true);
        expect(breaks.map(atom => atom.seam.depth)).toEqual([
            'piece', 'piece', 'piece',
            'work',            // into the Tao
            'work',            // back out of it into Spoon River
            'piece', 'piece', 'piece',
            'work',            // into the Tao again
            'work'             // and into Marcus Aurelius
        ]);
        expect(breaks[3].seam.label).toBe('Tao Te Ching · Chapter 16');
        expect(breaks[4].seam.label).toBe('Spoon River Anthology · Fletcher McGee');
        expect(breaks[9].seam.label).toBe('Meditations · Book IV');
    });

    it('is absent rather than broken when the arriving piece has no name', () => {
        const session = compile([
            { id: 'a', name: 'Something', data: EPITAPH },
            { id: 'b', name: '   ', data: EPITAPH }
        ]);
        const [seamless] = breaksOf(session);
        expect(seamless.seam).toBeUndefined();
        expect(seamless.tags).toContain('source-break');
    });

    it('marks an authored transition with the same seam', () => {
        // A score that authored its own boundary said how long the silence
        // lasts. It did not say, and should not have to say, who speaks next.
        const session = compileSession({
            name: 'Scored stitch',
            wpm: 200,
            sources: [epitaph(12, 'Judge Somers'), chapter(40, 'Chapter 40')],
            experienceProgram: {
                schema: EXPERIENCE_PROGRAM_SCHEMA,
                id: 'scored-stitch',
                authority: 'proposed',
                editable: true,
                tracks: [
                    {
                        id: 'movements', kind: 'movement', clips: [
                            {
                                id: 'm1',
                                anchor: { sourceIds: ['spoon-river-anthology#12'] },
                                data: { index: 0, title: 'Judge Somers' }
                            },
                            {
                                id: 'm2',
                                anchor: { sourceIds: ['sacred-tao-te-ching#40'] },
                                data: { index: 1, title: 'Chapter 40' }
                            }
                        ]
                    },
                    {
                        id: 'seams', kind: 'transition', clips: [{
                            id: 'seam-1',
                            anchor: {
                                sourceIds: ['journey-boundary:seam-1'],
                                afterSourceId: 'spoon-river-anthology#12',
                                beforeSourceId: 'sacred-tao-te-ching#40'
                            },
                            data: { fromMovementId: 'm1', toMovementId: 'm2' },
                            durationMs: 1200
                        }]
                    }
                ]
            }
        });

        const [boundary] = breaksOf(session);
        expect(boundary.tags).toContain('authored-boundary');
        expect(boundary.sourceId).toBe('journey-boundary:seam-1');
        expect(boundary.duration).toBe(1200);
        expect(boundary.seam).toEqual({
            depth: 'work',
            label: 'Tao Te Ching · Chapter 40',
            name: 'Tao Te Ching · Chapter 40'
        });
    });
});

describe('what the Chamber shows at a seam', () => {
    const stitched = () => compile([
        epitaph(12, 'Judge Somers'),
        epitaph(13, 'Benjamin Fraser'),
        chapter(40, 'Chapter 40')
    ]);

    it('paints the arriving piece where the text was', () => {
        const session = stitched();
        const { chamber, container, display } = mount(session);
        const index = session.atoms.findIndex(atom => atom.seam);

        chamber.displayAtom(session.atoms[index], index);

        const seam = display.querySelector('.atom-seam');
        expect(seam).toBeTruthy();
        expect(seam.textContent).toBe('Benjamin Fraser');
        expect(seam.dataset.seamDepth).toBe('piece');
        // Visible: the old behaviour faded the frame to nothing here.
        expect(display.style.opacity).toBe('1');

        chamber.destroy();
        container.remove();
    });

    it('draws the two depths differently, and names the work in full at the deeper one', () => {
        const session = stitched();
        const { chamber, container, display } = mount(session);
        const [shallow, deep] = session.atoms
            .map((atom, index) => ({ atom, index }))
            .filter(entry => entry.atom.seam);

        chamber.displayAtom(shallow.atom, shallow.index);
        expect(display.querySelector('.atom-seam').dataset.seamDepth).toBe('piece');

        chamber.displayAtom(deep.atom, deep.index);
        const crossing = display.querySelector('.atom-seam');
        expect(crossing.dataset.seamDepth).toBe('work');
        expect(crossing.textContent).toBe('Tao Te Ching · Chapter 40');

        chamber.destroy();
        container.remove();
    });

    it('gives the whole identity to a reader who cannot see the screen', () => {
        const session = stitched();
        const { chamber, container, display } = mount(session);
        const index = session.atoms.findIndex(atom => atom.seam);

        chamber.displayAtom(session.atoms[index], index);
        expect(display.querySelector('.atom-seam').getAttribute('aria-label'))
            .toBe('Spoon River Anthology · Benjamin Fraser');

        chamber.destroy();
        container.remove();
    });

    it('is gone the moment the next piece begins', () => {
        const session = stitched();
        const { chamber, container, display } = mount(session);
        const index = session.atoms.findIndex(atom => atom.seam);

        chamber.displayAtom(session.atoms[index], index);
        expect(display.querySelector('.atom-seam')).toBeTruthy();

        chamber.displayAtom(session.atoms[index + 1], index + 1);
        expect(display.querySelector('.atom-seam')).toBeNull();
        expect(display.textContent).toContain(session.atoms[index + 1].content);

        chamber.destroy();
        container.remove();
    });

    it('leaves a paragraph break blank, as it always was', () => {
        const session = stitched();
        const { chamber, container, display } = mount(session);

        chamber.displayAtom({ content: '', duration: 300, tags: ['PAUSE'] }, 0);
        expect(display.querySelector('.atom-seam')).toBeNull();
        expect(display.textContent).toBe('');
        expect(display.style.opacity).toBe('0');

        chamber.destroy();
        container.remove();
    });

    it('shows nothing at all rather than a frame it cannot fill', () => {
        // A restored or hand-edited session may carry anything here. Reverent
        // degradation: absent, never a broken frame and never "undefined".
        const session = stitched();
        const { chamber, container, display } = mount(session);

        for (const seam of [null, {}, { depth: 'work' }, { label: '   ' }, 'work', 7]) {
            chamber.displayAtom({ content: '', duration: 900, seam }, 0);
            expect(display.querySelector('.atom-seam'), JSON.stringify(seam)).toBeNull();
            expect(display.textContent).toBe('');
        }

        chamber.destroy();
        container.remove();
    });

    it('quiets an unrecognised depth rather than promoting it', () => {
        const session = stitched();
        const { chamber, container, display } = mount(session);

        chamber.displayAtom(
            { content: '', duration: 900, seam: { depth: 'cataclysm', label: 'Somewhere' } }, 0);
        expect(display.querySelector('.atom-seam').dataset.seamDepth).toBe('piece');

        chamber.destroy();
        container.remove();
    });

    it('does not carry the previous passage\'s mood across the boundary', () => {
        const session = stitched();
        session.visualConfig = { ...session.visualConfig, livingText: { enabled: true } };
        const { chamber, container, display } = mount(session);
        const index = session.atoms.findIndex(atom => atom.seam);

        display.style.color = 'rgb(255, 208, 130)';
        display.style.textShadow = '0 0 20px rgba(255, 208, 130, 0.4)';
        chamber.displayAtom(session.atoms[index], index);

        expect(display.style.color).toBe('');
        expect(display.style.textShadow).toBe('');

        chamber.destroy();
        container.remove();
    });
});
