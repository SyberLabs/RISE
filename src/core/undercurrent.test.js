import { describe, expect, it } from 'vitest';
import { compileSession } from './session-compiler.js';
import { undercurrentAt } from './undercurrent.js';

const TEXT = 'The first division says one thing. It says it plainly. The last division says it again.';

const anchor = (extra = {}) => ({ sourceIds: ['primary'], ...extra });

function read({ threads = [], extra = [], authority = 'user' } = {}) {
    return compileSession({
        title: 'Under',
        text: TEXT,
        chunkMode: 'word',
        experienceProgram: {
            schema: 'rise.experience-program.v1',
            id: 'under',
            authority,
            editable: authority !== 'published',
            tracks: [
                {
                    id: 'movements', kind: 'movement',
                    clips: [{ id: 'm1', anchor: anchor(), data: { index: 0, title: 'One' } }]
                },
                ...(threads.length ? [{ id: 'threads', kind: 'thread', clips: threads }] : []),
                ...extra
            ]
        }
    });
}

const indexOfWord = (session, word, nth = 0) =>
    session.atoms.map((atom, index) => [atom.content, index])
        .filter(([content]) => content === word)[nth][1];

const gloss = (id, span, text = 'A note.') => ({
    id, anchor: anchor(span), cue: { kind: 'gloss', text }
});

const OPENING = { fromToken: 0, toToken: 3, quoteStart: 'The first', quoteEnd: 'first division' };

describe('what lies under an atom', () => {
    it('is nothing where nothing was written', () => {
        const session = read({ threads: [gloss('g1', OPENING)] });
        expect(undercurrentAt(session, indexOfWord(session, 'plainly.')))
            .toEqual({ threads: [], visual: null, audio: null });
    });

    it('is nothing for a reading with no score at all', () => {
        const plain = compileSession({ title: 'Plain', text: TEXT });
        expect(undercurrentAt(plain, 0)).toEqual({ threads: [], visual: null, audio: null });
    });

    it('is nothing for an atom that does not exist', () => {
        const session = read({ threads: [gloss('g1', OPENING)] });
        expect(undercurrentAt(session, 9999)).toEqual({ threads: [], visual: null, audio: null });
        expect(undercurrentAt(session, -1)).toEqual({ threads: [], visual: null, audio: null });
    });

    it('carries a gloss as written, by whoever authored the program', () => {
        const proposed = read({ threads: [gloss('g1', OPENING, 'The plain sense.')], authority: 'proposed' });
        const [thread] = undercurrentAt(proposed, indexOfWord(proposed, 'first')).threads;
        expect(thread).toEqual({
            id: 'g1',
            kind: 'gloss',
            provenance: 'written',
            authority: 'proposed',
            text: 'The plain sense.'
        });
    });

    it('carries an echo as received, with the edition\'s own words', () => {
        const session = read({
            threads: [{
                id: 'e1',
                anchor: anchor({ fromToken: 13, toToken: 16, quoteStart: 'says it', quoteEnd: 'it again.' }),
                cue: { kind: 'echo', of: { sourceId: 'primary', quoteStart: 'It says it', quoteEnd: 'plainly' } }
            }]
        });
        const under = undercurrentAt(session, indexOfWord(session, 'again.'));
        expect(under.threads).toEqual([{
            id: 'e1',
            kind: 'echo',
            provenance: 'received',
            source: 'primary',
            text: 'It says it plainly'
        }]);
    });

    it('lists every thread on one atom, in the order they were authored', () => {
        const session = read({
            threads: [
                gloss('g1', OPENING, 'One.'),
                gloss('g2', { fromToken: 1, toToken: 4, quoteStart: 'first division', quoteEnd: 'division says' }, 'Two.')
            ]
        });
        const found = undercurrentAt(session, indexOfWord(session, 'division')).threads;
        expect(found.map(thread => thread.text)).toEqual(['One.', 'Two.']);
    });

    it('leaves out an echo whose words cannot be found, and keeps the rest', () => {
        const session = read({
            threads: [
                gloss('g1', OPENING),
                {
                    id: 'e1', anchor: anchor(OPENING),
                    cue: { kind: 'echo', of: { sourceId: 'primary', quoteStart: 'Never written', quoteEnd: 'nowhere' } }
                }
            ]
        });
        const found = undercurrentAt(session, indexOfWord(session, 'first')).threads;
        expect(found.map(thread => thread.id)).toEqual(['g1']);
    });

    it('leaves out an echo whose opening words occur twice, rather than choosing one', () => {
        const session = read({
            threads: [{
                id: 'e1', anchor: anchor(OPENING),
                cue: { kind: 'echo', of: { sourceId: 'primary', quoteStart: 'division says', quoteEnd: 'says' } }
            }]
        });
        expect(undercurrentAt(session, indexOfWord(session, 'first')).threads).toEqual([]);
    });

    it('reports the image and the sound the score already puts under a passage', () => {
        const session = read({
            threads: [gloss('g1', OPENING)],
            extra: [
                {
                    id: 'visual-main', kind: 'visual', fallback: { kind: 'still' },
                    clips: [{
                        id: 'v1',
                        anchor: anchor({ fromToken: 0, toToken: 3, quoteStart: 'The first', quoteEnd: 'first division' }),
                        cue: { kind: 'sourced', collections: ['aic-landscapes'] }
                    }]
                },
                {
                    id: 'audio-bed', kind: 'audio', fallback: { kind: 'silence', fadeMs: 500 },
                    clips: [{
                        id: 'a1',
                        anchor: anchor({ fromToken: 0, toToken: 3, quoteStart: 'The first', quoteEnd: 'first division' }),
                        cue: { kind: 'soundscape', soundscapeId: 'aurora' }
                    }]
                }
            ]
        });
        const under = undercurrentAt(session, indexOfWord(session, 'first'));
        expect(under.visual).toEqual({ id: 'v1', cue: { kind: 'sourced', collections: ['aic-landscapes'] } });
        expect(under.audio).toEqual({ id: 'a1', cue: { kind: 'soundscape', soundscapeId: 'aurora' } });

        const elsewhere = undercurrentAt(session, indexOfWord(session, 'plainly.'));
        expect(elsewhere.visual).toBeNull();
        expect(elsewhere.audio).toBeNull();
    });
});
