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
    buildLibraryCatalogue,
    exportCuratorContext,
    validateCuratorContext
} from './curator-context.js';
import { buildCuratorPrompt } from './curator-prompt.js';
import { resolveLibrarySourceIds } from './scriptorium-resolve.js';
import { EXPERIENCE_PROGRAM_SCHEMA } from './experience-program.js';
import { assertProgramWithinContext, describeImportFailure } from './experience-program-io.js';
import { MAX_SAFE_TARGET_WORDS, READING_LIMITS } from './reading-limits.js';

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
        // NOT "a movement reads its source whole", which the reply used to say.
        // The budget counts every source the score will load, movements and
        // transition clips alike — see programSourceIds.
        expect(refusal).not.toMatch(/movements? (?:reads?|names?)/u);
        // WHAT THE SENTENCE HAD TO STOP SAYING. It read "Every source a score
        // names is read whole", which was the old budget's own premise: the
        // gate charged every extent `extentReadingBound` and told the curator
        // their score would be read at that length. An opening is not read
        // whole and is not charged as though it were, so the reply names both
        // units and the rounding one of them is allowed.
        expect(refusal).toMatch(/A whole work or a whole division is read entire/);
        expect(refusal).toMatch(/an opening is cut at the nearest real boundary/);
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

    /**
     * THE READER'S LENGTH AND THE MACHINE'S CEILING ARE TWO QUESTIONS.
     *
     * Both were answered by `extentReadingBound` — the most a cut can be
     * handed — so a score of openings was charged 1.6× what it would read and
     * a reader asking for ten minutes was given five. The ceiling still spends
     * the bound, because that is the quantity MAX_SAFE_TARGET_WORDS is derived
     * over; the reader's length spends what the extents name.
     *
     * The library below is shaped so the two numbers differ: `long-parts` has
     * divisions of 5,000 words, so `#1:200` names 200 and is bounded at 320.
     */
    const DIVIDED = [
      { id: 'long-parts', title: 'Long Parts', words: 20_000,
          divisions: { count: 4, words: [5_000, 5_000, 5_000, 5_000] } },
      { id: 'short-parts', title: 'Short Parts', words: 240,
          divisions: { count: 4, words: [60, 60, 60, 60] } }
    ];

    it('spends what an opening names, not the most it could be handed', () => {
        // Five openings name 1,000 words and are bounded at 1,600. Under the
        // ceiling-as-budget this was refused at a length of 1,000 — and the
        // reading it would have produced is about a thousand words long.
        const openings = ['long-parts#1:200', 'long-parts#2:200', 'long-parts#3:200',
            'long-parts#4:200'];
        expect(assertProgramWithinContext(
            program(openings), context({ targetWords: 800, library: DIVIDED })
        )).toBe(true);

        // And it is still a limit: one more than the length names is refused.
        let failure = null;
        try {
            assertProgramWithinContext(
                program(openings), context({ targetWords: 799, library: DIVIDED })
            );
        } catch (error) {
            failure = error;
        }
        expect(failure?.code).toBe('PROGRAM_IO_BUDGET_EXCEEDED');
        expect(failure?.details.total).toBe(800);
        // The most it could read travels beside what it names, so a reader
        // deciding what to cut can see the rounding an opening is allowed.
        expect(failure?.details.boundTotal).toBe(1_280);
    });

    it('charges a division shorter than the ask its own length', () => {
        // The case the old charge got right, and the reason the shortfall was
        // not uniform: a 60-word division at `:200` is read whole, so naming
        // and bounding are the same number. Four of them are 240 words.
        let failure = null;
        try {
            assertProgramWithinContext(
                program(['short-parts#1:200', 'short-parts#2:200', 'short-parts#3:200',
                    'short-parts#4:200']),
                context({ targetWords: 239, library: DIVIDED })
            );
        } catch (error) {
            failure = error;
        }
        expect(failure?.details).toMatchObject({ total: 240, boundTotal: 240 });
    });

    it('still refuses at the atom ceiling on the most it could read', () => {
        // THE HALF THAT MUST NOT HAVE MOVED. reading-limits.js derives
        // MAX_SAFE_TARGET_WORDS from atoms per word of BUDGET, and the step
        // that makes the derivation hold is that no cut delivers more words
        // than `extentReadingBound` charged. A ceiling spending the nominal
        // would hand the compiler a reading it never measured.
        //
        // One division past the ceiling, asked for at the smallest length
        // whose overshoot reaches the whole of it: the cut may be handed every
        // word, so it is charged every word — while what it NAMES is well
        // inside the ceiling and would have been admitted.
        const huge = MAX_SAFE_TARGET_WORDS + 1;
        const enormous = [{
            id: 'one-huge-part', title: 'One Huge Part', words: huge,
            divisions: { count: 1, words: [huge] }
        }];
        const ask = Math.ceil(huge / 1.6);
        let failure = null;
        try {
            assertProgramWithinContext(
                program([`one-huge-part#1:${ask}`]), context({ library: enormous })
            );
        } catch (error) {
            failure = error;
        }
        expect(failure?.code).toBe('PROGRAM_IO_ATOM_CEILING');
        // The ceiling's own number, which is the bound and not what was named.
        expect(failure?.details.total).toBe(huge);
        expect(ask).toBeLessThan(MAX_SAFE_TARGET_WORDS);
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

    it('does not let an unmeasured source carry measured ones past the ceiling', () => {
        // THE HOLE: the unmeasured branch returned early on a door with no
        // targetWords, and it stood BEFORE the ceiling check — so adding a
        // source of unknown length to a score that was refused made it pass.
        // A strictly longer reading cannot be more admissible than the one
        // inside it.
        const library = [
            { id: 'enormous', title: 'Enormous', words: MAX_SAFE_TARGET_WORDS + 1 },
            { id: 'unmeasured-notes', title: 'Notes' }
        ];
        const noLength = context({ library });

        expect(() => assertProgramWithinContext(program(['enormous']), noLength))
            .toThrow(/more than one session can hold/);
        expect(() => assertProgramWithinContext(
            program(['enormous', 'unmeasured-notes']), noLength
        )).toThrow(/more than one session can hold/);

        // And the unmeasured source is still not GUESSED at: on its own, with
        // no length asked for, there is nothing to prove and nothing claimed.
        expect(assertProgramWithinContext(program(['unmeasured-notes']), noLength)).toBe(true);
    });

    it('says how much of an over-ceiling score it could actually count', () => {
        let refusal = '';
        try {
            assertProgramWithinContext(
                program(['enormous', 'unmeasured-notes']),
                context({
                    library: [
                        { id: 'enormous', title: 'Enormous', words: MAX_SAFE_TARGET_WORDS + 1 },
                        { id: 'unmeasured-notes', title: 'Notes' }
                    ]
                })
            );
        } catch (error) {
            refusal = describeImportFailure(error);
        }
        // A total that omits an unmeasured source is a floor, not the length,
        // and the refusal says which it is.
        expect(refusal).toMatch(/at least/);
        expect(refusal).toMatch(/enormous — /);
        // Never a fabricated number for the source that declared none.
        expect(refusal).not.toMatch(/unmeasured-notes — /);
    });
});

describe('the model is told the number, not an approximation', () => {
    it('states the budget as a hard limit when one is set', () => {
        const prompt = buildCuratorPrompt({
            context: context({ targetWords: 20_000, library: LIBRARY })
        });
        expect(prompt).toMatch(/asked for about 20,000 words/);
        expect(prompt).toMatch(/HARD LIMIT/);
    });

    it('teaches the extents a movement may name, since a work is not the only unit', async () => {
        // A movement read its source whole, so the shortest reading the
        // Scriptorium could compose was the shortest work in the library.
        //
        // WHAT THIS USED TO ASSERT was `toMatch(/#42:200/)` against a prompt
        // whose worked extent was `montaigne-essays#42:200` — a work withheld
        // from the shelf since the Standard Ebooks rule. The string was
        // present and the id was refused, which is a label offered as
        // evidence. So the ids are read back out of the prompt and put
        // through the resolver that would have to load them.
        const shelf = buildLibraryCatalogue();
        const prompt = buildCuratorPrompt({
            context: exportCuratorContext({
                id: 'extent-teaching', sources: [], includeLibrary: true,
                constraints: { targetWords: 20_000 }
            })
        });
        expect(prompt).toMatch(/EXTENT/);
        expect(prompt).toMatch(/nearest sentence/);
        const extents = [...new Set(
            [...prompt.matchAll(/"([a-z0-9-]+#\d+(?::\d+)?)"/gu)].map(match => match[1])
        )];
        expect(extents.length, 'the prompt teaches no extent at all').toBeGreaterThan(0);
        for (const id of extents) {
            expect(shelf.some(entry => entry.id === id.split('#')[0]), id).toBe(true);
        }
        const { sources, missing, refused } = await resolveLibrarySourceIds(extents);
        expect({ missing, refused }).toEqual({ missing: [], refused: [] });
        expect(sources).toHaveLength(extents.length);
    }, 120_000);

    it('says a division a work does not have is refused, not neared', () => {
        // WHAT THIS USED TO BE was two toMatch calls on prompt prose. The
        // wording can be present down to the letter while the gate quietly
        // rounds `work#900` to the last division the work has — the promise
        // and the behaviour were never compared. Its sibling above resolves
        // the ids it finds in the prompt; this puts the RULE the prompt
        // states through the door that has to keep it.
        const divided = [
            { id: 'short-hours', title: 'Short Hours', words: 4_000,
                divisions: { count: 3, words: [1_000, 1_500, 1_500] } }
        ];
        const gate = context({ targetWords: 4_000, library: divided });
        const prompt = buildCuratorPrompt({ context: gate });
        expect(prompt).toMatch(/Ordinals start at 1/);
        expect(prompt).toMatch(/the gate refuses, it never repairs/);

        // A division the work has.
        expect(assertProgramWithinContext(program(['short-hours#3']), gate)).toBe(true);

        // One past the end. Refused — and refused as a missing DIVISION of a
        // work the room holds, not as a missing work, which is the answer that
        // used to be printed above a list offering that very work.
        let failure = null;
        try {
            assertProgramWithinContext(program(['short-hours#4']), gate);
        } catch (error) {
            failure = error;
        }
        expect(failure?.code).toBe('PROGRAM_IO_UNKNOWN_DIVISION');
        expect(failure?.details).toMatchObject({ division: 4, divisionCount: 3 });
        // NEVER NEARED: the refusal does not quietly become division 3.
        expect(describeImportFailure(failure, { context: gate }))
            .toMatch(/has 3 .*and the score asks for number 4/su);

        // Ordinals start at one, so there is no division zero to round up to.
        expect(() => assertProgramWithinContext(program(['short-hours#0']), gate))
            .toThrow(/not a source id this reader can read/);
    });

    it('falls back to the compiler ceiling when none is set', () => {
        const prompt = buildCuratorPrompt({ context: context({ library: LIBRARY }) });
        expect(prompt).toMatch(/hard ceiling of 120,000 atoms/);
        expect(prompt).not.toMatch(/HARD LIMIT/);
    });
});
