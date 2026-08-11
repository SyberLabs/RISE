/**
 * The Scriptorium accepts a score without opening the Workshop, so this
 * rundown is the only account a reader gets of what they are agreeing to.
 */
import { describe, expect, it } from 'vitest';
import { validateExperienceProgram } from './experience-program.js';
import {
    describePace,
    describeProgramRundown,
    describeSpan,
    estimateRundownMinutes
} from './program-rundown.js';

// Verbatim from the second hand-run of the curator loop (2026-08-11).
const RUN_TWO = validateExperienceProgram({
    schema: 'rise.experience-program.v1',
    id: 'self-transformation-great-work',
    authority: 'proposed',
    editable: true,
    tracks: [
        {
            id: 'movements',
            kind: 'movement',
            clips: [{
                id: 'm1',
                anchor: { sourceIds: ['sacred-emerald-tablet'] },
                data: { index: 0, title: 'The Great Work' }
            }]
        },
        {
            id: 'visuals',
            kind: 'visual',
            fallback: { kind: 'still' },
            clips: [
                {
                    id: 'v1', cue: { kind: 'procedural', collections: ['rockgarden'] },
                    anchor: { sourceIds: ['sacred-emerald-tablet'], fromProgress: 0, toProgress: 0.3 }
                },
                {
                    id: 'v2', cue: { kind: 'procedural', collections: ['fractal'] },
                    anchor: { sourceIds: ['sacred-emerald-tablet'], fromProgress: 0.3, toProgress: 0.72 }
                },
                {
                    id: 'v3', cue: { kind: 'procedural', collections: ['turrell'] },
                    anchor: { sourceIds: ['sacred-emerald-tablet'], fromProgress: 0.72, toProgress: 1 }
                }
            ]
        },
        {
            id: 'bed',
            kind: 'audio',
            fallback: { kind: 'silence', fadeMs: 500 },
            clips: [{
                id: 'a1', cue: { kind: 'soundscape', soundscapeId: 'aurora' },
                anchor: { sourceIds: ['sacred-emerald-tablet'] }
            }]
        },
        {
            id: 'pace',
            kind: 'reading',
            clips: [{
                id: 'p1', cue: { kind: 'pace', wpm: 120, chunkMode: 'phrase' },
                anchor: { sourceIds: ['sacred-emerald-tablet'] }
            }]
        }
    ]
});

const CONTEXT = {
    library: [{ id: 'sacred-emerald-tablet', title: 'The Emerald Tablet', words: 237 }],
    catalog: {
        collections: { rockgarden: { name: 'Rock Garden' }, turrell: { name: 'Turrell Fields' } },
        soundscapes: { aurora: { name: 'Aurora' } }
    }
};

describe('a span is described in the coordinate its author used', () => {
    it('says progress as proportion, and names the ends', () => {
        expect(describeSpan({ fromProgress: 0, toProgress: 0.3 })).toBe('the first 30%');
        expect(describeSpan({ fromProgress: 0.72, toProgress: 1 })).toBe('the last 28%');
        expect(describeSpan({ fromProgress: 0.3, toProgress: 0.72 })).toBe('30%–72%');
        expect(describeSpan({ fromProgress: 0, toProgress: 1 })).toBe('throughout');
    });

    it('quotes a quotation rather than converting it', () => {
        // Turning a quotation into a percentage would state a precision the
        // anchor does not have, and the Workshop's character spans are a
        // different coordinate entirely.
        expect(describeSpan({ quoteStart: 'So above', quoteEnd: 'so below' }))
            .toBe('from “So above” to “so below”');
    });

    it('treats an anchor with no range as the whole source', () => {
        expect(describeSpan({ sourceIds: ['x'] })).toBe('throughout');
        expect(describeSpan(null)).toBe('throughout');
    });
});

describe('a pace cue reads as a sentence', () => {
    it('composes the halves, since either alone is complete', () => {
        expect(describePace({ wpm: 120, chunkMode: 'phrase' }))
            .toBe('120 words a minute, in phrases');
        expect(describePace({ wpm: 120 })).toBe('120 words a minute');
        expect(describePace({ chunkMode: 'phrase' })).toBe('in phrases');
        expect(describePace({ chunkMode: 'word' })).toBe('one word at a time');
    });
});

describe('the rundown of a real curator score', () => {
    const rundown = describeProgramRundown(RUN_TWO, CONTEXT);

    it('names the movement, its source and its length', () => {
        expect(rundown.movements).toHaveLength(1);
        expect(rundown.movements[0].title).toBe('The Great Work');
        expect(rundown.movements[0].sources[0].title).toBe('The Emerald Tablet');
        expect(rundown.movements[0].words).toBe(237);
        expect(rundown.totals.words).toBe(237);
    });

    it('reports the pace the Workshop could not show', () => {
        expect(rundown.unpaced).toBe(false);
        expect(rundown.pace).toEqual([
            { span: 'throughout', description: '120 words a minute, in phrases' }
        ]);
    });

    it('describes every visual clip, which the Workshop dropped entirely', () => {
        // visualAssignmentsFromProgram reads character anchors only and returns
        // nothing for a progress-anchored score. This is the whole reason the
        // room accounts for itself.
        expect(rundown.visuals).toEqual([
            { span: 'the first 30%', description: 'Rock Garden' },
            { span: '30%–72%', description: 'fractal' },
            { span: 'the last 28%', description: 'Turrell Fields' }
        ]);
    });

    it('names the sound', () => {
        expect(rundown.audio).toEqual([{ span: 'throughout', description: 'Aurora' }]);
    });

    it('takes its length from the scored pace, not the reader\'s', () => {
        // 237 words at the scored 120 wpm is two minutes; at the reader's 320
        // it would read as one, which is the wrong promise.
        expect(estimateRundownMinutes(rundown, 320)).toBe(2);
    });
});

describe('an unscored reading says so', () => {
    const bare = validateExperienceProgram({
        schema: 'rise.experience-program.v1',
        id: 'bare',
        authority: 'proposed',
        editable: true,
        tracks: [{
            id: 'movements',
            kind: 'movement',
            clips: [{
                id: 'm1',
                anchor: { sourceIds: ['sacred-emerald-tablet'] },
                data: { index: 0, title: 'Only' }
            }]
        }]
    });

    it('marks the absence rather than omitting the section', () => {
        const rundown = describeProgramRundown(bare, CONTEXT);
        expect(rundown.unpaced).toBe(true);
        expect(rundown.pace).toEqual([]);
        expect(estimateRundownMinutes(rundown, 320)).toBe(1);
    });

    it('reports an unknown length as unknown rather than as zero', () => {
        const rundown = describeProgramRundown(bare, { library: [] });
        expect(rundown.totals.words).toBeNull();
        expect(estimateRundownMinutes(rundown, 320)).toBeNull();
    });
});
