/**
 * Threads: what lies under a passage.
 *
 * An image or a sound anchored to a span of text is already a `visual` or
 * `audio` clip, so an undercurrent needs no vocabulary for those. What had no
 * home was words: a gloss someone wrote about a passage, and an echo of an
 * earlier passage in the same text. Both are anchored to source text, like
 * every other clip, and neither is ever a claim about what the edition says.
 */
import { describe, expect, it } from 'vitest';
import {
    EXPERIENCE_PROGRAM_LIMITS,
    EXPERIENCE_PROGRAM_SCHEMA,
    PROGRAM_THREAD_KINDS,
    PROGRAM_TRACK_KINDS,
    ExperienceProgramValidationError,
    validateExperienceProgram
} from './experience-program.js';

const anchor = (extra = {}) => ({
    sourceIds: ['primary'],
    fromToken: 0,
    toToken: 3,
    quoteStart: 'The first',
    quoteEnd: 'first division',
    ...extra
});

const gloss = (id, extra = {}, cue = {}) => ({
    id,
    anchor: anchor(extra),
    cue: { kind: 'gloss', text: 'The plain sense of the opening.', ...cue }
});

const echo = (id, extra = {}, cue = {}) => ({
    id,
    anchor: anchor(extra),
    cue: {
        kind: 'echo',
        of: { sourceId: 'primary', quoteStart: 'It says', quoteEnd: 'plainly' },
        ...cue
    }
});

function program(clips, { authority = 'user', tracks = [] } = {}) {
    return {
        schema: EXPERIENCE_PROGRAM_SCHEMA,
        id: 'threads',
        authority,
        editable: authority !== 'published',
        tracks: [
            {
                id: 'movements', kind: 'movement',
                clips: [{ id: 'm1', anchor: { sourceIds: ['primary'] }, data: { index: 0, title: 'One' } }]
            },
            { id: 'threads', kind: 'thread', clips },
            ...tracks
        ]
    };
}

const refusal = value => {
    try {
        validateExperienceProgram(value);
    } catch (error) {
        if (error instanceof ExperienceProgramValidationError) return error.code;
        throw error;
    }
    return null;
};

describe('the thread vocabulary', () => {
    it('is a track kind, with gloss and echo as its only cues', () => {
        expect(PROGRAM_TRACK_KINDS).toContain('thread');
        expect(PROGRAM_THREAD_KINDS).toEqual(['gloss', 'echo']);
    });

    it('admits a gloss and an echo, anchored by token span', () => {
        const valid = validateExperienceProgram(program([
            gloss('g1'),
            echo('e1', { fromToken: 10, toToken: 13, quoteStart: 'It says', quoteEnd: 'plainly' })
        ]));
        const clips = valid.tracks.find(track => track.kind === 'thread').clips;
        expect(clips.map(clip => clip.cue.kind)).toEqual(['gloss', 'echo']);
    });

    it('admits a quotation-only anchor, and a character span', () => {
        expect(refusal(program([
            gloss('g1', { fromToken: undefined, toToken: undefined })
        ]))).toBeNull();
        expect(refusal(program([
            gloss('g1', { fromToken: undefined, toToken: undefined, fromCharacter: 0, toCharacter: 20 })
        ]))).toBeNull();
    });

    it('lets several threads stand over the same words', () => {
        expect(refusal(program([gloss('g1'), echo('e1'), gloss('g2')]))).toBeNull();
    });
});

describe('what a thread refuses', () => {
    it('a span given as a fraction of the reading', () => {
        expect(refusal(program([gloss('g1', {
            fromToken: undefined, toToken: undefined,
            quoteStart: undefined, quoteEnd: undefined,
            fromProgress: 0.1, toProgress: 0.2
        })]))).toBe('PROGRAM_THREAD_ANCHOR');
    });

    it('a whole source with no span', () => {
        expect(refusal(program([gloss('g1', {
            fromToken: undefined, toToken: undefined, quoteStart: undefined, quoteEnd: undefined
        })]))).toBe('PROGRAM_THREAD_ANCHOR');
    });

    it('a cue that is neither gloss nor echo', () => {
        expect(refusal(program([{ id: 'x', anchor: anchor(), cue: { kind: 'image' } }])))
            .toBe('PROGRAM_THREAD_KIND');
    });

    it('a gloss with no words, or too many', () => {
        expect(refusal(program([gloss('g1', {}, { text: '   ' })]))).toBe('PROGRAM_THREAD_TEXT');
        expect(refusal(program([gloss('g1', {}, {
            text: 'x'.repeat(EXPERIENCE_PROGRAM_LIMITS.maxThreadTextLength + 1)
        })]))).toBe('PROGRAM_THREAD_TEXT');
    });

    it('a gloss that carries text the edition should have supplied', () => {
        expect(refusal(program([gloss('g1', {}, { of: { sourceId: 'primary', quoteStart: 'a', quoteEnd: 'b' } })])))
            .toBe('PROGRAM_UNKNOWN_FIELD');
    });

    it('an echo that stores the words it echoes', () => {
        expect(refusal(program([echo('e1', {}, { text: 'It says it plainly.' })])))
            .toBe('PROGRAM_UNKNOWN_FIELD');
    });

    it('an echo that does not say where the echoed words are', () => {
        expect(refusal(program([echo('e1', {}, { of: { sourceId: 'primary', quoteStart: 'It says' } })])))
            .toBe('PROGRAM_THREAD_ECHO');
    });

    it('an echo of a source the program does not name', () => {
        expect(refusal(program([echo('e1', {}, {
            of: { sourceId: 'elsewhere', quoteStart: 'It says', quoteEnd: 'plainly' }
        })]))).toBe('PROGRAM_UNKNOWN_SOURCE');
    });

    it('a thread on a source the program does not name', () => {
        expect(refusal(program([gloss('g1', { sourceIds: ['nowhere'] })]))).toBe('PROGRAM_UNKNOWN_SOURCE');
    });

    it('a second thread track, because the lane is one list', () => {
        expect(refusal(program([gloss('g1')], {
            tracks: [{ id: 'more', kind: 'thread', clips: [gloss('g2')] }]
        }))).toBe('PROGRAM_DUPLICATE_TRACK_KIND');
    });
});
