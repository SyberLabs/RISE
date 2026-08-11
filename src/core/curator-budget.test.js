/**
 * The reader's length, carried to the model and enforced at the gate.
 *
 * The failure this replaces arrived at Run: a score naming 300,000 words
 * compiled, exceeded the 120,000-atom ceiling, and refused after the reader
 * had already accepted it into the Vault.
 */
import { describe, expect, it } from 'vitest';
import {
    CURATOR_CONTEXT_SCHEMA,
    exportCuratorContext,
    validateCuratorContext
} from './curator-context.js';
import { buildCuratorPrompt } from './curator-prompt.js';
import { EXPERIENCE_PROGRAM_SCHEMA } from './experience-program.js';
import { assertProgramWithinContext, describeImportFailure } from './experience-program-io.js';
import { READING_LIMITS } from './reading-limits.js';

const context = ({ targetWords, library, sources = [] } = {}) => validateCuratorContext({
    schema: CURATOR_CONTEXT_SCHEMA,
    id: 'budget-context',
    sources,
    library,
    visuals: {},
    audio: {},
    ...(targetWords != null ? { constraints: { targetWords } } : {})
});

const LIBRARY = [
    { id: 'short-hours', title: 'Short Hours', words: 4_000 },
    { id: 'long-novel', title: 'Long Novel', words: 90_000 }
];

const program = (sourceIds) => ({
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: 'budget-score',
    authority: 'user',
    editable: true,
    tracks: [{
        id: 'movements',
        kind: 'movement',
        clips: sourceIds.map((sourceId, index) => ({
            id: `m${index}`,
            anchor: { sourceIds: [sourceId] },
            data: { index, title: `Movement ${index}` }
        }))
    }]
});

describe('length is measured in words', () => {
    it('bounds the budget by what a session can actually hold', () => {
        expect(() => context({ targetWords: READING_LIMITS.maxAtoms })).not.toThrow();
        expect(() => context({ targetWords: READING_LIMITS.maxAtoms + 1 }))
            .toThrow(/from 1 to/);
        expect(() => context({ targetWords: 0 })).toThrow(/from 1 to/);
        expect(() => context({ targetWords: 1500.5 })).toThrow(/whole number/);
    });

    it('gives a loaded source a word count, not only a character length', () => {
        const exported = exportCuratorContext({
            id: 'probe',
            sources: [{ id: 'pasted', name: 'Pasted', data: 'one two three four five' }],
            includeLibrary: false
        });
        expect(exported.sources[0].words).toBe(5);
        expect(exported.sources[0].characterLength).toBe(23);
    });

    it('refuses the field it replaced, so a reading is measured one way', () => {
        expect(() => validateCuratorContext({
            schema: CURATOR_CONTEXT_SCHEMA,
            id: 'legacy',
            sources: [],
            visuals: {},
            audio: {},
            constraints: { targetMinutes: 20 }
        })).toThrow(/Unknown field: targetMinutes/);
    });
});

describe('a score is refused at the gate, not at Run', () => {
    it('accepts a score inside the budget', () => {
        expect(assertProgramWithinContext(
            program(['short-hours']),
            context({ targetWords: 20_000, library: LIBRARY })
        )).toBe(true);
    });

    it('refuses one over it, and says by how much', () => {
        let refusal = '';
        try {
            assertProgramWithinContext(
                program(['short-hours', 'long-novel']),
                context({ targetWords: 20_000, library: LIBRARY })
            );
        } catch (error) {
            refusal = describeImportFailure(error);
        }
        expect(refusal).toMatch(/94,000 words/);
        expect(refusal).toMatch(/asked for 20,000/);
        expect(refusal).toMatch(/long-novel — 90,000 words/);
        expect(refusal).toMatch(/reads its source whole/);
        expect(refusal).toMatch(/PROGRAM_IO_BUDGET_EXCEEDED/);
    });

    it('counts a source named by two movements once', () => {
        // Ownership already forbids this, but the budget must not be the thing
        // that discovers it — double counting would refuse a legal score.
        const twice = program(['short-hours']);
        twice.tracks[0].clips.push({
            id: 'm1', anchor: { sourceIds: ['short-hours'] }, data: { index: 1, title: 'Again' }
        });
        expect(assertProgramWithinContext(
            twice, context({ targetWords: 5_000, library: LIBRARY })
        )).toBe(true);
    });

    it('refuses what it cannot measure rather than admitting it', () => {
        expect(() => assertProgramWithinContext(
            program(['unmeasured']),
            context({
                targetWords: 20_000,
                library: [...LIBRARY, { id: 'unmeasured', title: 'No Count' }]
            })
        )).toThrow(/declares no word count/);
    });

    it('stays silent when the reader set no length', () => {
        expect(assertProgramWithinContext(
            program(['short-hours', 'long-novel']),
            context({ library: LIBRARY })
        )).toBe(true);
    });
});

describe('the model is told the number, not an approximation', () => {
    it('states the budget as a hard limit when one is set', () => {
        const prompt = buildCuratorPrompt({
            context: context({ targetWords: 20_000, library: LIBRARY })
        });
        expect(prompt).toMatch(/asked for about 20,000 words/);
        expect(prompt).toMatch(/HARD LIMIT/);
        expect(prompt).toMatch(/reads its source WHOLE/);
    });

    it('falls back to the compiler ceiling when none is set', () => {
        const prompt = buildCuratorPrompt({ context: context({ library: LIBRARY }) });
        expect(prompt).toMatch(/hard ceiling of 120,000 atoms/);
        expect(prompt).not.toMatch(/HARD LIMIT/);
    });
});
