/**
 * A thread lands on the atoms under its words, and does nothing else to the
 * reading: it adds no cut, it changes no duration, and one that cannot be
 * found is simply not there.
 */
import { describe, expect, it } from 'vitest';
import { compileSession } from './session-compiler.js';

const TEXT = 'The first division says one thing. It says it plainly.';

function program(clips) {
    return {
        schema: 'rise.experience-program.v1',
        id: 'threaded',
        authority: 'user',
        editable: true,
        tracks: [
            {
                id: 'movements', kind: 'movement',
                clips: [{ id: 'm1', anchor: { sourceIds: ['primary'] }, data: { index: 0, title: 'One' } }]
            },
            { id: 'threads', kind: 'thread', clips }
        ]
    };
}

const gloss = (id, anchor) => ({
    id,
    anchor: { sourceIds: ['primary'], ...anchor },
    cue: { kind: 'gloss', text: 'A note.' }
});

const compile = (clips, options = {}) => compileSession({
    title: 'Threaded',
    text: TEXT,
    chunkMode: 'word',
    ...options,
    experienceProgram: clips ? program(clips) : undefined
});

const stamped = session => session.atoms.map(atom => atom.sourceSpanIds ?? []);

describe('threads on atoms', () => {
    it('stamps each atom under a thread with that thread', () => {
        const session = compile([
            gloss('g1', { fromToken: 0, toToken: 3, quoteStart: 'The first', quoteEnd: 'first division' })
        ]);
        const under = session.atoms
            .filter(atom => atom.sourceSpanIds?.includes('threads:g1'))
            .map(atom => atom.content);
        expect(under).toEqual(['The', 'first', 'division']);
    });

    it('lets two threads stand on the same atom', () => {
        const session = compile([
            gloss('g1', { fromToken: 0, toToken: 3, quoteStart: 'The first', quoteEnd: 'first division' }),
            gloss('g2', { fromToken: 1, toToken: 4, quoteStart: 'first division', quoteEnd: 'division says' })
        ]);
        const both = session.atoms.filter(atom =>
            atom.sourceSpanIds?.includes('threads:g1') && atom.sourceSpanIds?.includes('threads:g2'));
        expect(both.map(atom => atom.content)).toEqual(['first', 'division']);
    });

    it('does not change how the reading is cut or how long it takes', () => {
        const bare = compile(null, { chunkMode: 'phrase' });
        const threaded = compile([
            gloss('g1', { fromToken: 1, toToken: 3, quoteStart: 'first division', quoteEnd: 'first division' })
        ], { chunkMode: 'phrase' });
        expect(threaded.atoms.map(atom => [atom.content, atom.duration]))
            .toEqual(bare.atoms.map(atom => [atom.content, atom.duration]));
    });

    it('omits a quotation that is not in the text, and the reading carries on', () => {
        const session = compile([
            gloss('lost', { quoteStart: 'A phrase this edition does not hold', quoteEnd: 'nor this closing one' })
        ]);
        expect(stamped(session).flat()).toEqual([]);
        expect(session.atoms.length).toBeGreaterThan(0);
    });

    it('refuses a token span whose quotes do not match, because that was written carefully', () => {
        expect(() => compile([
            gloss('wrong', { fromToken: 0, toToken: 3, quoteStart: 'The first', quoteEnd: 'not the words' })
        ])).toThrow(/quote/i);
    });
});
