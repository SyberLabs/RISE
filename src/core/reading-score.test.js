/**
 * A program that can score the reading (ROADMAP Phase 13).
 *
 * Three rulings are under test here and each has its own describe block: the
 * reading is a TRACK, a scored pace is a DEFAULT, and a reading unaffected by
 * any score compiles exactly as it did before the track existed.
 */
import { describe, expect, it } from 'vitest';
import {
    EXPERIENCE_PROGRAM_SCHEMA,
    lowerExperienceProgram,
    validateExperienceProgram
} from './experience-program.js';
import { buildReadingPlan, paceFactor } from './reading-score.js';
import { compileSession, estimateCompiledDuration } from './session-compiler.js';
import {
    describeImportFailure,
    workshopProjectFromImportedProgram
} from './experience-program-io.js';
import { workshopProjectToSessionConfig } from './workshop-project.js';
import { buildCuratorPrompt } from './curator-prompt.js';
import { CURATOR_CONTEXT_SCHEMA, validateCuratorContext } from './curator-context.js';

const PROSE = 'The sea is calm tonight. The tide is full, the moon lies fair '
    + 'upon the straits. Only, from the long line of spray where the sea meets '
    + 'the moon-blanched land, listen! you hear the grating roar of pebbles '
    + 'which the waves draw back, and fling at their return, up the high strand.';

const scored = (readingClips, { sourceId = 'dover' } = {}) => ({
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: 'score-under-test',
    authority: 'user',
    editable: true,
    tracks: [
        {
            id: 'movements',
            kind: 'movement',
            clips: [{ id: 'only', anchor: { sourceIds: [sourceId] }, data: { index: 0, title: 'Only' } }]
        },
        { id: 'pace', kind: 'reading', clips: readingClips }
    ]
});

const curatorContext = () => validateCuratorContext({
    schema: CURATOR_CONTEXT_SCHEMA,
    id: 'reading-score-context',
    sources: [{ id: 'dover', title: 'Dover Beach' }],
    visuals: {},
    audio: {}
});

const compile = (program, overrides = {}) => compileSession({
    sources: [{ id: 'dover', name: 'Dover Beach', type: 'text', data: PROSE }],
    wpm: 320,
    chunkMode: 'word',
    ...(program ? { experienceProgram: program } : {}),
    ...overrides
});

describe('the reading is a track, so it inherits the lane laws', () => {
    it('validates and lowers into a schedule of its own', () => {
        const program = validateExperienceProgram(scored([{
            id: 'slow-open',
            anchor: { sourceIds: ['dover'], fromProgress: 0, toProgress: 0.5 },
            cue: { kind: 'pace', wpm: 120 }
        }]));
        const lowered = lowerExperienceProgram(program);
        expect(lowered.readingProgram.segments).toHaveLength(1);
        expect(lowered.readingProgram.segments[0].cue).toEqual({ kind: 'pace', wpm: 120 });
    });

    it('refuses two pace cues over the same span, with no ordering rule invented', () => {
        expect(() => validateExperienceProgram(scored([
            {
                id: 'a',
                anchor: { sourceIds: ['dover'], fromProgress: 0, toProgress: 0.6 },
                cue: { kind: 'pace', wpm: 120 }
            },
            {
                id: 'b',
                anchor: { sourceIds: ['dover'], fromProgress: 0.4, toProgress: 1 },
                cue: { kind: 'pace', wpm: 400 }
            }
        ]))).toThrow(/overlap/i);
    });

    it('allows abutment, because a half-open range ends where the next begins', () => {
        expect(() => validateExperienceProgram(scored([
            {
                id: 'a',
                anchor: { sourceIds: ['dover'], fromProgress: 0, toProgress: 0.5 },
                cue: { kind: 'pace', wpm: 120 }
            },
            {
                id: 'b',
                anchor: { sourceIds: ['dover'], fromProgress: 0.5, toProgress: 1 },
                cue: { kind: 'pace', wpm: 400 }
            }
        ]))).not.toThrow();
    });

    it('refuses a cue that changes nothing', () => {
        expect(() => validateExperienceProgram(scored([{
            id: 'mute',
            anchor: { sourceIds: ['dover'] },
            cue: { kind: 'pace' }
        }]))).toThrow(/wpm, chunkMode, or both/);
    });

    it('refuses a wpm outside what a reader could reach', () => {
        expect(() => validateExperienceProgram(scored([{
            id: 'blur',
            anchor: { sourceIds: ['dover'] },
            cue: { kind: 'pace', wpm: 5000 }
        }]))).toThrow(/50 to 1000/);
    });
});

describe('a scored chunkMode needs a coordinate that predates the cut', () => {
    // The circularity is the point: a progress range is a fraction OF the atom
    // stream, so it cannot locate the cut it is asking to change.
    it('refuses chunkMode on a progress anchor', () => {
        expect(() => validateExperienceProgram(scored([{
            id: 'phrase-here',
            anchor: { sourceIds: ['dover'], fromProgress: 0.2, toProgress: 0.6 },
            cue: { kind: 'pace', chunkMode: 'phrase' }
        }]))).toThrow(/chunkMode needs a character, token, or quotation anchor/);
    });

    it('accepts chunkMode on a quotation anchor', () => {
        expect(() => validateExperienceProgram(scored([{
            id: 'phrase-here',
            anchor: {
                sourceIds: ['dover'],
                quoteStart: 'Only, from the long line',
                quoteEnd: 'at their return,'
            },
            cue: { kind: 'pace', chunkMode: 'phrase' }
        }]))).not.toThrow();
    });

    it('accepts chunkMode over a whole source, which needs no cut to locate', () => {
        expect(() => validateExperienceProgram(scored([{
            id: 'all-phrase',
            anchor: { sourceIds: ['dover'] },
            cue: { kind: 'pace', chunkMode: 'phrase' }
        }]))).not.toThrow();
    });

    it('still allows wpm on a progress anchor, which only retimes', () => {
        expect(() => validateExperienceProgram(scored([{
            id: 'slow',
            anchor: { sourceIds: ['dover'], fromProgress: 0.2, toProgress: 0.6 },
            cue: { kind: 'pace', wpm: 90 }
        }]))).not.toThrow();
    });
});

describe('an unscored reading compiles exactly as it always did', () => {
    it('produces identical atoms with and without an empty-of-pace program', () => {
        const plain = compile(null);
        const withProgram = compile(validateExperienceProgram({
            schema: EXPERIENCE_PROGRAM_SCHEMA,
            id: 'no-pace',
            authority: 'user',
            editable: true,
            tracks: [{
                id: 'movements',
                kind: 'movement',
                clips: [{ id: 'only', anchor: { sourceIds: ['dover'] }, data: { index: 0, title: 'Only' } }]
            }]
        }));
        expect(withProgram.atoms.map(atom => atom.content))
            .toEqual(plain.atoms.map(atom => atom.content));
        expect(withProgram.atoms.map(atom => atom.duration))
            .toEqual(plain.atoms.map(atom => atom.duration));
    });

    it('leaves the plan a single default piece when no track scores the source', () => {
        const plan = buildReadingPlan(null, { id: 'dover', raw: PROSE },
            { chunkMode: 'word', wpm: 320 });
        expect(plan.recut).toBe(false);
        expect(plan.pieces).toEqual([
            { fromCharacter: 0, toCharacter: PROSE.length, mode: 'word', wpm: 320 }
        ]);
        expect(plan.progressPace).toEqual([]);
    });

    it('keeps Atrium-style estimates constant, since no launch authors a pace', () => {
        const input = {
            sources: [{ id: 'dover', name: 'Dover Beach', type: 'text', data: PROSE }],
            wpm: 320,
            chunkMode: 'word'
        };
        expect(estimateCompiledDuration(input)).toBe(estimateCompiledDuration(input));
        expect(estimateCompiledDuration(input)).toBe(compile(null).totalDuration);
    });
});

describe('a scored pace reaches the atoms', () => {
    it('lengthens exactly the atoms inside a progress span, and no others', () => {
        const plain = compile(null);
        const slowed = compile(validateExperienceProgram(scored([{
            id: 'slow-open',
            anchor: { sourceIds: ['dover'], fromProgress: 0, toProgress: 0.5 },
            cue: { kind: 'pace', wpm: 160 }
        }])));

        expect(slowed.atoms).toHaveLength(plain.atoms.length);
        const changed = [];
        const unchanged = [];
        slowed.atoms.forEach((atom, index) => {
            const before = plain.atoms[index].duration;
            (atom.duration > before ? changed : unchanged).push(index);
        });
        expect(changed.length).toBeGreaterThan(0);
        expect(unchanged.length).toBeGreaterThan(0);
        // Half the pace, so about twice the time — the pacer's texture and
        // curve move it a little either side, and its 10s ceiling is untouched
        // at these lengths.
        const sample = changed[Math.floor(changed.length / 2)];
        expect(slowed.atoms[sample].duration / plain.atoms[sample].duration)
            .toBeGreaterThan(1.6);
        expect(slowed.atoms[sample].duration / plain.atoms[sample].duration)
            .toBeLessThan(2.4);
    });

    it('re-cuts a quoted span in its own chunk mode', () => {
        const wordCut = compile(null);
        const mixed = compile(validateExperienceProgram(scored([{
            id: 'phrase-here',
            anchor: {
                sourceIds: ['dover'],
                quoteStart: 'Only, from the long line',
                quoteEnd: 'at their return,'
            },
            cue: { kind: 'pace', chunkMode: 'phrase' }
        }])));

        // Phrase atoms hold several words, so re-cutting one span in phrase
        // mode must yield strictly fewer atoms than cutting all of it by word.
        expect(mixed.atoms.length).toBeLessThan(wordCut.atoms.length);
        const longest = Math.max(...mixed.atoms.map(atom => atom.content.split(/\s+/).length));
        expect(longest).toBeGreaterThan(1);
        // And the reading is still the whole reading: nothing was dropped at
        // a seam, which is the failure a piecewise cut invites.
        const words = text => text.replace(/\s+/gu, ' ').trim();
        expect(words(mixed.atoms.map(atom => atom.content).join(' ')))
            .toBe(words(wordCut.atoms.map(atom => atom.content).join(' ')));
    });

    it('refuses to cut a source whose profile prepares the whole text', () => {
        expect(() => compile(
            validateExperienceProgram(scored([{
                id: 'phrase-here',
                anchor: {
                    sourceIds: ['dover'],
                    quoteStart: 'Only, from the long line',
                    quoteEnd: 'at their return,'
                },
                cue: { kind: 'pace', chunkMode: 'phrase' }
            }])),
            { sources: [{ id: 'dover', name: 'Dover Beach', type: 'text', data: PROSE, chunkProfile: 'verse' }] }
        )).toThrow(/chunk profile/);
    });
});

describe('a scored pace survives the Scriptorium loop', () => {
    it('reaches the atoms through import, project, and compile', () => {
        const project = workshopProjectFromImportedProgram({
            program: scored([{
                id: 'slow-open',
                anchor: { sourceIds: ['dover'], fromProgress: 0, toProgress: 0.5 },
                cue: { kind: 'pace', wpm: 160 }
            }]),
            sources: [{ id: 'dover', name: 'Dover Beach', type: 'text', data: PROSE }],
            context: curatorContext()
        });
        const readingTrack = project.experienceProgram.tracks.find(track => track.kind === 'reading');
        expect(readingTrack.clips[0].cue).toEqual({ kind: 'pace', wpm: 160 });

        const config = workshopProjectToSessionConfig(project);
        const session = compileSession(config);
        const plain = compileSession({ ...config, experienceProgram: null });
        expect(session.atoms.some((atom, index) => atom.duration > plain.atoms[index].duration))
            .toBe(true);
    });

    it('explains a refused pace in terms a curator can act on', () => {
        let refusal = '';
        try {
            validateExperienceProgram(scored([{
                id: 'phrase-here',
                anchor: { sourceIds: ['dover'], fromProgress: 0.2, toProgress: 0.6 },
                cue: { kind: 'pace', chunkMode: 'phrase' }
            }]));
        } catch (error) {
            refusal = describeImportFailure(error);
        }
        expect(refusal).toMatch(/phrase-here/);
        expect(refusal).toMatch(/quoteStart/);
        expect(refusal).toMatch(/wpm cue has no such limit/);
        expect(refusal).toMatch(/PROGRAM_READING_CHUNK_ANCHOR/);
    });

    it('offers pace to the curator with its one restriction stated', () => {
        const prompt = buildCuratorPrompt({ context: curatorContext() });
        expect(prompt).toMatch(/"kind": "reading"/);
        expect(prompt).toMatch(/word \| phrase \| sentence \| paragraph/);
        expect(prompt).toMatch(/It cannot use progress/);
    });
});

describe('the reader stays above the score', () => {
    it('bakes pace into durations, so the Chamber speed control still scales all of it', () => {
        // The Chamber applies one factor to the whole reading. Scored pace is
        // therefore a contour the reader scales rather than a second clock
        // competing with them.
        const slowed = compile(validateExperienceProgram(scored([{
            id: 'slow-open',
            anchor: { sourceIds: ['dover'], fromProgress: 0, toProgress: 0.5 },
            cue: { kind: 'pace', wpm: 160 }
        }])));
        const durations = slowed.atoms.map(atom => atom.duration);
        expect(new Set(durations).size).toBeGreaterThan(1);
        expect(durations.every(value => Number.isFinite(value) && value > 0)).toBe(true);
    });

    it('has no track fallback, so an unscored stretch is the reader\'s own pace', () => {
        const lowered = lowerExperienceProgram(validateExperienceProgram(scored([{
            id: 'slow-open',
            anchor: { sourceIds: ['dover'], fromProgress: 0, toProgress: 0.5 },
            cue: { kind: 'pace', wpm: 160 }
        }])));
        expect(lowered.readingProgram).not.toHaveProperty('fallback');
    });

    it('retimes by the ratio of the two paces', () => {
        expect(paceFactor(320, 160)).toBe(2);
        expect(paceFactor(160, 320)).toBe(0.5);
        expect(paceFactor(320, 320)).toBe(1);
        for (const bad of [0, -1, NaN, Infinity, undefined]) {
            expect(paceFactor(320, bad), String(bad)).toBe(1);
        }
    });
});
