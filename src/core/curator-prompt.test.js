/**
 * The prompt is a brief, and a brief that names something the room does not
 * hold is worse than one that names nothing.
 *
 * WHAT THIS REPLACES. The worked examples named `montaigne-essays` and
 * `extended-dhammapada-full`. Both are withheld (canon.js), neither appears
 * in any capability document, and a model that copied the shape faithfully —
 * which is what a shape is for — got PROGRAM_IO_UNKNOWN_SOURCE. The prompt
 * was prose, and prose is checked against nothing.
 *
 * So this does not look for strings. It cuts the JSON back out of the
 * generated text, puts it through the same gate the room's paste box uses,
 * and LOADS the works the example names. `expect(prompt).toMatch(/#42:200/)`
 * is a label offered as evidence; this is the evidence.
 */
import { describe, expect, it, vi } from 'vitest';
import {
    buildLibraryCatalogue,
    exportCuratorContext
} from './curator-context.js';
import { buildCuratorPrompt } from './curator-prompt.js';
import { parseCuratorPaste } from './experience-program-io.js';
import { isBoundarySource } from './journey-compiler.js';
import {
    EXTENT_OVERSHOOT_LIMIT, extentNominalWords, extentReadingBound
} from './library-extent.js';
import { resolveLibrarySourceIds } from './scriptorium-resolve.js';
import {
    EXPERIENCE_PROGRAM_LIMITS, EXPERIENCE_PROGRAM_SCHEMA
} from './experience-program.js';
import {
    MAX_SAFE_TARGET_WORDS, READING_LIMITS, READING_PACE
} from './reading-limits.js';
import { AGENT_OPERATION_SET_SCHEMA } from './agent-operations.js';

/** Exactly what the room hands the reader at its default length. */
const DEFAULT_TARGET_WORDS = 20_000;

const roomContext = (targetWords = DEFAULT_TARGET_WORDS, surface = {}) =>
    exportCuratorContext({
        id: 'scriptorium-prompt-test',
        sources: [],
        includeLibrary: true,
        constraints: { targetWords },
        ...surface
    });

/**
 * Every top-level JSON object in the prompt, as a model would copy it: from a
 * `{` alone on a line to the `}` that closes it in the same column.
 */
function jsonBlocks(prompt) {
    const lines = prompt.split('\n');
    const blocks = [];
    let start = -1;
    lines.forEach((line, index) => {
        if (line === '{') start = index;
        else if (line === '}' && start >= 0) {
            blocks.push(lines.slice(start, index + 1).join('\n'));
            start = -1;
        }
    });
    return blocks;
}

const sourceIdsOf = (program) => [...new Set((program.tracks || [])
    .flatMap(track => track.clips || [])
    .flatMap(clip => clip.anchor?.sourceIds || []))];

describe('the shape the prompt teaches is a score the gate accepts', () => {
    const context = roomContext();
    const prompt = buildCuratorPrompt({ intent: 'Memory and loss.', context });
    const blocks = jsonBlocks(prompt);

    it('prints two examples, and both are JSON', () => {
        expect(blocks).toHaveLength(2);
        for (const block of blocks) expect(() => JSON.parse(block)).not.toThrow();
    });

    it('admits the score example verbatim, ids and length together', () => {
        const parsed = parseCuratorPaste(blocks[0], { context });
        expect(parsed.kind).toBe('program');
        expect(parsed.program.schema).toBe(EXPERIENCE_PROGRAM_SCHEMA);
    });

    it('admits the operation example verbatim', () => {
        const parsed = parseCuratorPaste(blocks[1], { context });
        expect(parsed.kind).toBe('operations');
        expect(parsed.operationSet.schema).toBe(AGENT_OPERATION_SET_SCHEMA);
    });

    it('spends less than the reader asked for', () => {
        // The example is priced against the budget it is generated under, so
        // a shape copied whole cannot be the thing that breaks the ceiling.
        //
        // AN OPENING COSTS ITS BOUND, NOT ITS DIVISION. This charged the whole
        // division for "#1:200" — the same arithmetic the prompt tells a
        // curator not to do — which held only while the example never named an
        // opening. `extentReadingBound` is what the gate charges, so this now
        // spends the room's own number instead of an overestimate that would
        // refuse example scores the room accepts.
        const catalogue = new Map(context.library.map(entry => [entry.id, entry]));
        const program = JSON.parse(blocks[0]);
        const total = sourceIdsOf(program).reduce((sum, id) => {
            const [workId, extent] = id.split('#');
            const entry = catalogue.get(workId);
            if (!extent) return sum + entry.words;
            const [ordinal, ask] = extent.split(':');
            const words = entry.divisions.words[Number(ordinal) - 1];
            return sum + (ask ? extentReadingBound(words, Number(ask)) : words);
        }, 0);
        expect(total).toBeLessThanOrEqual(DEFAULT_TARGET_WORDS);
    });

    it('names sources that LOAD, not sources that merely parse', async () => {
        // The gate above reads the catalogue. This reads the shelf: an id can
        // sit in a capability document and still refuse to resolve, which is
        // exactly what a below-floor or unboundable opening does.
        const ids = [
            ...sourceIdsOf(JSON.parse(blocks[0])),
            ...JSON.parse(blocks[1]).operations
                .map(op => op.sourceId).filter(Boolean)
        ];
        const { sources, missing, refused } = await resolveLibrarySourceIds(ids);
        expect(missing, 'the prompt names a work the shelf does not hold').toEqual([]);
        expect(refused, 'the prompt names an extent the shelf refuses').toEqual([]);
        expect(sources).toHaveLength(new Set(ids).size);
        for (const source of sources) expect(source.data.length).toBeGreaterThan(0);
    }, 120_000);

    it('names no id outside the document it ships with', () => {
        // The shelf listing, the extent grammar and both examples all draw on
        // the same context, so an id that appears in the prompt and not in
        // that context means one of them was written by hand again.
        //
        // Two places in the text can make such a claim: a quoted token, and
        // the head of a shelf line. Everything the EXAMPLES mint for
        // themselves — a program id, a clip id, an operation id — is read out
        // of the parsed JSON rather than listed here, so this cannot be
        // quietly widened by adding a name to an allowlist.
        const offered = new Set([
            ...buildLibraryCatalogue().map(entry => entry.id),
            ...context.visuals.collections,
            ...context.visuals.engines,
            ...context.audio.soundscapes,
            ...context.audio.tones,
            ...context.audio.swells
        ]);
        const minted = new Set();
        const walk = (value) => {
            if (typeof value === 'string') minted.add(value);
            else if (Array.isArray(value)) value.forEach(walk);
            else if (value && typeof value === 'object') Object.values(value).forEach(walk);
        };
        blocks.forEach(block => walk(JSON.parse(block)));

        const claims = [
            ...[...prompt.matchAll(/"([a-z0-9][a-z0-9#:_-]*)"/gu)].map(match => match[1]),
            ...[...prompt.matchAll(/^ {2}([a-z0-9-]+) +[\d,]+w · /gmu)].map(match => match[1])
        ];
        const strangers = [...new Set(claims)].filter(id =>
            id.includes('-') || id.includes('#'))
            // A SYNTHETIC BOUNDARY SOURCE NAMES NOTHING TO RESOLVE. The prompt
            // teaches the transition track, whose anchor carries a
            // program-local id that no shelf holds and no context offers —
            // which is precisely what `isBoundarySource` is for, and what
            // programSourceIds skips when it walks a score. The production
            // predicate is used rather than a literal, so a prefix that
            // changes there changes here.
            .filter(id => !isBoundarySource(id))
            .filter(id => !offered.has(id.split('#')[0]) && !minted.has(id));
        expect(strangers).toEqual([]);
    });
});

describe('the example holds at both ends of the slider', () => {
    // 200 is the room's shortest offer and MAX_SAFE_TARGET_WORDS its longest.
    // The example is priced against whatever the reader set, so both ends
    // have to produce a score the gate takes — the short end is the one that
    // forces the ladder all the way down to an opening.
    for (const targetWords of [200, 400, 5_000, 114_285]) {
        it(`admits its own example at ${targetWords.toLocaleString('en-US')} words`, () => {
            const context = roomContext(targetWords);
            const blocks = jsonBlocks(buildCuratorPrompt({ context }));
            const parsed = parseCuratorPaste(blocks[0], { context });
            expect(parsed.kind).toBe('program');
        });
    }
});

/**
 * THE BRIEF PRICED AN OPENING AT A NUMBER THE GATE NO LONGER SPENDS.
 *
 * The gate charges what an extent NAMES against the reader's length — `#12:200`
 * costs 200 — and keeps the 1.6× `extentReadingBound` for the atom ceiling,
 * where it is load-bearing. The prompt still taught the bound as the price, so
 * a model obeying it budgeted 320 for a reading that costs 200 and under-filled
 * by about 40%: the same defect as the gate's old over-charge with the sign
 * reversed, and invisible to a test that matches the sentence for "1.6×".
 *
 * So these read the two numbers back out of the sentence and spend them. The
 * arithmetic check binds each to the function that produces it; the two after
 * it hand the gate a score built by doing exactly what the sentence says, and
 * require the gate to charge what the sentence promised.
 */
describe('the prompt prices an opening at the number the gate spends', () => {
    const context = roomContext();
    const prompt = buildCuratorPrompt({ context });

    /** A budget nothing can fit, so every score comes back with its own price. */
    const penny = roomContext(1);

    /**
     * WHAT THE GATE SPENDS, ASKED OF THE GATE. Recomputing it here would prove
     * this file agrees with itself. `PROGRAM_IO_BUDGET_EXCEEDED` carries the
     * total the gate measured, which is the number a reader's length is spent
     * against and the number the sentence is about.
     */
    const gateCharge = (program) => {
        try {
            parseCuratorPaste(JSON.stringify(program), { context: penny });
        } catch (error) {
            if (error.code === 'PROGRAM_IO_BUDGET_EXCEEDED') return error.details.total;
            throw error;
        }
        throw new Error('a one-word budget admitted this score');
    };

    /** The pricing sentence, unwrapped, with its numbers pulled out. */
    const pricing = (text) => {
        const bullet = text
            .slice(text.indexOf('- An opening the text cannot be cut near.'))
            .split('\n\n')[0]
            .replace(/\s+/gu, ' ');
        const cost = bullet.match(
            /"#\d+:(\d+)" costs ([\d,]+) words against the reader's length/u);
        const bound = bullet.match(/may READ up to ([\d.]+)× that — ([\d,]+) words/u);
        expect(cost, 'the prompt states no cost for an opening').toBeTruthy();
        expect(bound, 'the prompt states no bound for an opening').toBeTruthy();
        const plain = (value) => Number(value.replace(/,/gu, ''));
        return {
            ask: plain(cost[1]),
            cost: plain(cost[2]),
            multiple: Number(bound[1]),
            bound: plain(bound[2])
        };
    };

    /**
     * A score of openings, each asked for at the length the sentence prices,
     * over divisions long enough that the cut is a cut rather than the whole
     * division — which is the case the two numbers differ in.
     */
    const openingsFilling = (budget, { ask, cost }) => {
        const clips = [];
        for (const entry of context.library) {
            const words = entry.divisions?.words;
            if (!Array.isArray(words)) continue;
            const body = Number.isInteger(entry.divisions.bodyFrom)
                ? entry.divisions.bodyFrom : 1;
            words.forEach((count, index) => {
                if (index + 1 < body) return;
                if (count <= extentReadingBound(Number.MAX_SAFE_INTEGER, ask)) return;
                if ((clips.length + 1) * cost > budget) return;
                if (clips.length >= EXPERIENCE_PROGRAM_LIMITS.maxMovements) return;
                clips.push({
                    id: `m${clips.length + 1}`,
                    anchor: { sourceIds: [`${entry.id}#${index + 1}:${ask}`] },
                    data: { index: clips.length, title: `Piece ${clips.length + 1}` }
                });
            });
        }
        return {
            schema: EXPERIENCE_PROGRAM_SCHEMA,
            id: 'by-the-brief',
            authority: 'proposed',
            editable: true,
            tracks: [{ id: 'movements', kind: 'movement', clips }]
        };
    };

    it('states both numbers, each derived from the function that decides it', () => {
        const { ask, cost, multiple, bound } = pricing(prompt);
        // The most a cut can be handed, and what it names — the same two
        // functions the gate calls, over a division longer than either.
        expect(bound).toBe(extentReadingBound(Number.MAX_SAFE_INTEGER, ask));
        expect(cost).toBe(extentNominalWords(bound, ask));
        expect(multiple).toBe(EXTENT_OVERSHOOT_LIMIT);
        // Saying one number twice would satisfy every check above but the
        // last: the whole point is that a curator is told two different things.
        expect(cost).toBeLessThan(bound);
    });

    it('charges the stated cost, not the stated bound, against a length', () => {
        const { ask, cost, bound } = pricing(prompt);
        const one = openingsFilling(cost, pricing(prompt));
        expect(one.tracks[0].clips).toHaveLength(1);
        expect(gateCharge(one)).toBe(cost);
        // And the id is admitted at exactly the length the sentence prices it
        // at — a promise the reader's own slider keeps.
        expect(parseCuratorPaste(JSON.stringify(one), { context: roomContext(cost) }).kind)
            .toBe('program');
        expect(cost).toBeLessThan(bound);
        expect(ask).toBe(cost);
    });

    /**
     * THE END-TO-END PROOF: a model that does the arithmetic the brief teaches.
     *
     * It reads the price out of the sentence, names openings until the length
     * is spent, and hands the score in. What the gate then charges is what the
     * reader gets. Under the old sentence the model priced each opening at the
     * bound, named ⌊length / 320⌋ of them, and delivered 200 apiece — a 10-minute
     * sitting filled to about 63%. The sentence is the only thing that changed.
     */
    for (const minutes of [5, 10]) {
        it(`fills a ${minutes}-minute length when a model follows it`, () => {
            const budget = minutes * READING_PACE.default;
            const priced = pricing(buildCuratorPrompt({ context: roomContext(budget) }));
            const filled = openingsFilling(budget, priced);
            const charged = gateCharge(filled);
            expect(charged).toBe(filled.tracks[0].clips.length * priced.cost);
            expect(charged / budget,
                `a model obeying the brief fills ${Math.round(100 * charged / budget)}% `
                + `of a ${minutes}-minute reading`).toBeGreaterThanOrEqual(0.95);
            // And what it composed is a score the room takes at that length.
            expect(parseCuratorPaste(JSON.stringify(filled),
                { context: roomContext(budget) }).kind).toBe('program');
        });
    }

    /**
     * AND THE WORKED EXAMPLE OBEYS ITS OWN SENTENCE. It reserved the overshoot
     * — asking for `share / 1.6` so the BOUND would fit the share — which was
     * the same over-charge in the same file, and cost a one-minute reading a
     * fifth of itself and a five-minute reading nearly a quarter.
     */
    for (const minutes of [1, 5]) {
        it(`prints an example that fills the ${minutes}-minute length it was made for`, () => {
            const budget = minutes * READING_PACE.default;
            const example = JSON.parse(jsonBlocks(
                buildCuratorPrompt({ context: roomContext(budget) }))[0]);
            const charged = gateCharge(example);
            expect(charged / budget).toBeGreaterThanOrEqual(0.95);
            // BOTH SIDES, because the example keeps its own books and the gate
            // keeps the real ones. Pricing a piece at less than the gate
            // charges fills the page just as convincingly and prints a score
            // the room refuses.
            expect(charged).toBeLessThanOrEqual(budget);
        });
    }
});

describe('the prompt says what this room can do, in its own vocabulary', () => {
    const context = roomContext();
    const prompt = buildCuratorPrompt({ context });

    it('names the companion document rather than pointing at "that document"', () => {
        // The only pointer used to be the phrase "that document"; the branch
        // that named the file fired only when there was no context to name.
        expect(prompt).toMatch(/context\.json/u);
        expect(prompt).not.toMatch(/that document/u);
    });

    it('names real ids a stranger could use without opening the context', () => {
        const named = buildLibraryCatalogue()
            .filter(entry => prompt.includes(entry.id));
        expect(named.length).toBe(buildLibraryCatalogue().length);
        expect(prompt).toMatch(/sacred-tao-te-ching/u);
        expect(prompt).toMatch(/aurora/u);
        expect(prompt).toMatch(/klee/u);
    });

    it('states the length of a division as the array it now is', () => {
        // "roughly `words` / `divisions.count`" was an estimate of a number
        // the catalogue ships exactly.
        expect(prompt).toMatch(/divisions\.words\[n-1\]/u);
        expect(prompt).not.toMatch(/roughly `words` \/ `divisions\.count`/u);
    });

    it('teaches the two extent refusals that now exist', () => {
        expect(prompt).toMatch(/under 40 words/u);
        expect(prompt).toMatch(/1\.6×/u);
        expect(prompt).toMatch(/refused rather than handed back/u);
    });

    it('warns that a position is not the work\'s own number, with a true example', () => {
        expect(prompt).toMatch(/POSITION IS NOT THE WORK'S OWN NUMBER/u);
        // The illustration is computed from the catalogue, so it must still
        // describe the shelf as it stands.
        const claim = prompt.match(/ {2}In ([a-z0-9-]+), "(.+)" is division (\d+) — not division (\d+)\./u);
        expect(claim, 'the prompt makes no ordinal claim to check').toBeTruthy();
        const [, workId, label, position, own] = claim;
        const entry = buildLibraryCatalogue().find(item => item.id === workId);
        expect(entry.divisions.labels[Number(position) - 1]).toBe(label);
        expect(Number(own)).not.toBe(Number(position));
    });

    it('does not spend a quarter of itself on operations this room cannot run', () => {
        // Twenty operations were re-explained at length; four of them
        // (request-asset, set-render-profile, create-sync-group,
        // assign-narration) have no expression against an empty project at
        // revision 0, which is the only project this room builds.
        for (const op of ['request-asset', 'set-render-profile', 'create-sync-group']) {
            expect(prompt.includes(`"${op}"`), `${op} is demonstrated`).toBe(false);
        }
        const operations = prompt.slice(prompt.indexOf('ALTERNATIVE —'));
        expect(operations.length).toBeLessThan(prompt.length / 5);
    });
});

/**
 * THE SHELF INVERTED AND THE BRIEF DID NOT.
 *
 * 944 divisions with a median of 853 words means a reading is several pieces
 * across works, and the prompt had one sentence about that — "prefer fewer
 * works over a long list of whole books" — pointing the other way. The worked
 * example was two sources at every length from 2,000 words to 60,000, with
 * every visual, audio and pace clip anchored to the first, so the shape a
 * model copied was a scored opening followed by an unscored remainder.
 *
 * These press the generated text rather than the helpers behind it: a claim
 * the prompt makes is checked against the gate, the catalogue or the constant
 * it came from, because a brief is only as true as the room it describes.
 */
describe('the prompt teaches composing from several pieces', () => {
    const context = roomContext();
    const prompt = buildCuratorPrompt({ context });
    const program = JSON.parse(jsonBlocks(prompt)[0]);
    const movements = program.tracks.find(track => track.kind === 'movement').clips;

    it('no longer argues for fewer works, which is the shelf\'s opposite', () => {
        expect(prompt).not.toMatch(/prefer fewer works/iu);
        expect(prompt).toMatch(/COMPOSING FROM SEVERAL PIECES/u);
    });

    it('counts the shelf it describes rather than remembering it', () => {
        const shelf = buildLibraryCatalogue();
        const divisions = shelf.reduce((sum, entry) =>
            sum + (entry.divisions?.count || 1), 0);
        const claim = prompt.match(
            /This shelf holds ([\d,]+) divisions across ([\d,]+) works, and the median division is\n([\d,]+) words/u);
        expect(claim, 'the prompt states no shelf shape').toBeTruthy();
        const unComma = (text) => Number(text.replace(/,/gu, ''));
        expect(unComma(claim[1])).toBe(divisions);
        expect(unComma(claim[2])).toBe(shelf.length);

        const lengths = shelf.flatMap(entry =>
            entry.divisions?.words?.length ? entry.divisions.words : [entry.words])
            .sort((left, right) => left - right);
        expect(unComma(claim[3])).toBe(lengths[Math.floor(lengths.length / 2)]);
    });

    it('grows the example with the reader\'s length instead of always naming two', () => {
        // The defect exactly: only the ids changed between a two-minute
        // sitting and an hour. Piece count is now the ladder's answer, so a
        // longer reading is demonstrated as a longer one.
        const count = (targetWords) => JSON.parse(jsonBlocks(
            buildCuratorPrompt({ context: roomContext(targetWords) }))[0])
            .tracks.find(track => track.kind === 'movement').clips.length;
        expect(count(20_000)).toBeGreaterThan(count(200));
        expect(count(20_000)).toBeGreaterThan(2);
    });

    it('spreads the budget instead of spending it on the first piece', () => {
        // Reserving a 40-word floor per piece let the opening take everything
        // that was left: a whole 12,592-word play and then nine scraps, which
        // is the shape the ladder printed underneath argues against. A
        // reading whose first piece is most of the reading is the old advice
        // with more ids in it.
        const catalogue = new Map(context.library.map(entry => [entry.id, entry]));
        const costs = movements.flatMap(clip => clip.anchor.sourceIds).map(id => {
            const [workId, extent] = id.split('#');
            const entry = catalogue.get(workId);
            if (!extent) return entry.words;
            const [ordinal, ask] = extent.split(':');
            const words = entry.divisions.words[Number(ordinal) - 1];
            return ask ? extentReadingBound(words, Number(ask)) : words;
        });
        const total = costs.reduce((sum, words) => sum + words, 0);
        expect(Math.max(...costs)).toBeLessThan(total / 2);
    });

    it('scores a piece other than the first, so no movement arrives bare', () => {
        // Every cue in the example used to anchor to m1. A model shown that
        // shape scores its opening and lets the rest of the reading run
        // unaccompanied, which is the list the seam and this section are
        // both against.
        const owned = new Set(movements.flatMap(clip => clip.anchor.sourceIds));
        const opening = new Set(movements[0].anchor.sourceIds);
        for (const kind of ['visual', 'audio', 'reading']) {
            const cued = program.tracks.filter(track => track.kind === kind)
                .flatMap(track => track.clips)
                .flatMap(clip => clip.anchor.sourceIds)
                .filter(id => owned.has(id) && !opening.has(id));
            expect(cued.length, `the ${kind} track scores only the first piece`)
                .toBeGreaterThan(0);
        }
    });

    it('names the refusal a mis-ordered movement actually earns', () => {
        // The section tells a curator that `data.index` must match the clip's
        // position and names the code that says so. That code is read back
        // out of the prompt and provoked, so the two cannot drift apart.
        const named = prompt.match(/\((PROGRAM_[A-Z_]+)\)/u);
        expect(named, 'the ORDER section cites no refusal').toBeTruthy();
        const reversed = structuredClone(program);
        const track = reversed.tracks.find(item => item.kind === 'movement');
        track.clips[0].data.index = 1;
        track.clips[1].data.index = 0;
        expect(() => parseCuratorPaste(JSON.stringify(reversed), { context }))
            .toThrowError(expect.objectContaining({ code: named[1] }));
    });

    it('states both ceilings as the constants that enforce them', () => {
        expect(prompt).toContain(`${READING_LIMITS.maxSources} sources`);
        expect(prompt).toContain(
            `${EXPERIENCE_PROGRAM_LIMITS.maxMovements} movements in one reading`);
    });

    it('holds when the movements ceiling moves under it', async () => {
        // The ceiling belongs to experience-program.js, not here, and it may
        // change. At one movement the example is a single piece that must
        // still fit MAX_SAFE_TARGET_WORDS at the top of the slider — the one
        // limit a reader cannot raise — and the ladder must not print a
        // number the score above it contradicts.
        vi.resetModules();
        vi.doMock('./experience-program.js', async (importOriginal) => {
            const actual = await importOriginal();
            return {
                ...actual,
                EXPERIENCE_PROGRAM_LIMITS: Object.freeze({
                    ...actual.EXPERIENCE_PROGRAM_LIMITS, maxMovements: 1
                })
            };
        });
        try {
            const { buildCuratorPrompt: rebuild } = await import('./curator-prompt.js');
            const wide = roomContext(Math.round(MAX_SAFE_TARGET_WORDS * 1.1));
            const text = rebuild({ context: wide });
            expect(text).toContain('1 movements in one reading');
            const rebuilt = JSON.parse(jsonBlocks(text)[0]);
            expect(rebuilt.tracks.find(track => track.kind === 'movement').clips)
                .toHaveLength(1);
            expect(parseCuratorPaste(JSON.stringify(rebuilt), { context: wide }).kind)
                .toBe('program');

            // AND THE ATOM CEILING STILL HOLDS AT ONE MOVEMENT. The reader's
            // slider goes past what a session can hold; with several pieces
            // an even share keeps every one of them small, but at one
            // movement there is nothing to dilute a whole long work chosen
            // against a number the room does not honour. This is the shape
            // that parsed here and was refused at the paste box.
            const long = buildLibraryCatalogue().find(entry =>
                entry.words > MAX_SAFE_TARGET_WORDS);
            expect(long, 'no work on the shelf outgrows one session').toBeTruthy();
            const narrow = {
                ...roomContext(Math.round(long.words * 1.05)),
                library: [long]
            };
            const single = jsonBlocks(rebuild({ context: narrow }))[0];
            expect(parseCuratorPaste(single, { context: narrow }).kind).toBe('program');
        } finally {
            vi.doUnmock('./experience-program.js');
            vi.resetModules();
        }
    });

    it('teaches pace as the way between two voices, not only within one', () => {
        const section = prompt.slice(prompt.indexOf('COMPOSING FROM SEVERAL PIECES'));
        expect(section).toMatch(/PACE IS HOW YOU KEEP TWO VOICES APART/u);
        expect(section).toMatch(/juxtaposition/iu);
    });
});

describe('the transition the prompt teaches is one the gate takes', () => {
    const context = roomContext();
    const prompt = buildCuratorPrompt({ context });

    /** The transition track exactly as printed, dedented and nothing else. */
    const transitionTrack = (text) => {
        const lines = text.split('\n');
        const start = lines.findIndex(line => line.includes('"kind": "transition"'));
        if (start < 0) return null;
        const end = lines.findIndex((line, index) => index > start && line === '  ] }');
        return JSON.parse(lines.slice(start, end + 1)
            .map(line => line.slice(2)).join('\n'));
    };

    it('prints a transition clip at all, which it never used to', () => {
        // The only mention of transitions in the whole brief was the sentence
        // saying the operation is refused. "Optional transition… tracks"
        // appeared in the Structure list with no cue, no example and none of
        // the four fields.
        const track = transitionTrack(prompt);
        expect(track, 'no transition example is printed').toBeTruthy();
        const [clip] = track.clips;
        expect(clip.data.fromMovementId).toBeTruthy();
        expect(clip.data.toMovementId).toBeTruthy();
        expect(clip.anchor.afterSourceId).toBeTruthy();
        expect(clip.anchor.beforeSourceId).toBeTruthy();
        expect(isBoundarySource(clip.anchor.sourceIds[0])).toBe(true);
    });

    it('grafts onto the score above and passes the same door a paste does', () => {
        // The proof that matters: the two snippets are printed metres apart
        // and a model will hand them in together. A transition whose
        // afterSourceId is not owned by its fromMovementId is refused
        // (PROGRAM_TRANSITION_OWNERSHIP), so this fails the moment the
        // example's movements and its crossing stop describing each other.
        const program = JSON.parse(jsonBlocks(prompt)[0]);
        program.tracks.push(transitionTrack(prompt));
        const parsed = parseCuratorPaste(JSON.stringify(program), { context });
        expect(parsed.kind).toBe('program');
        expect(parsed.program.tracks.some(track => track.kind === 'transition')).toBe(true);
    });

    it('points from the Structure list to where the shape is taught', () => {
        // The Structure list is where a model looks for the track kinds, and
        // it named the transition track without ever saying what one looks
        // like. The pointer is read out of the list and followed, so a
        // section that is renamed or a bullet that stops pointing both fail
        // here rather than leaving a model to search the brief.
        const structure = prompt
            .slice(prompt.indexOf('Structure:'), prompt.indexOf('PACE —'))
            .replace(/\s+/gu, ' ');
        const pointer = structure.match(
            /A transition is a scored silence between two movements — see ([A-Z][A-Z ]+[A-Z]) below/u);
        expect(pointer, 'the Structure list says nothing about a transition\'s shape')
            .toBeTruthy();
        const at = prompt.indexOf(`${pointer[1]} —`);
        expect(at, `the Structure list points at ${pointer[1]}, which has no section`)
            .toBeGreaterThan(-1);
        expect(prompt.slice(at)).toContain('"kind": "transition"');
    });

    it('says which door takes a transition, not only which one refuses it', () => {
        const operations = prompt.slice(prompt.indexOf('ALTERNATIVE —'));
        expect(operations).toMatch(/create-transition/u);
        // The old sentence stopped at the refusal, and a model read that as
        // "transitions do not exist" — on the one construct written for the
        // problem this shelf poses.
        expect(operations).toMatch(/TRANSITIONS BELONG TO A SCORE/u);
        expect(operations).toMatch(/return a program, not operations/u);
    });
});

describe('the reader\'s own materials are described as what they are', () => {
    const context = roomContext(DEFAULT_TARGET_WORDS, {
        assets: [
            { id: 'asset-still', name: 'Kitchen window', mimeType: 'image/png' },
            {
                id: 'asset-clip', name: 'Rain on the roof',
                kind: 'video', mimeType: 'video/mp4', durationMs: 30_500
            }
        ]
    });
    const prompt = buildCuratorPrompt({ context });

    it('says which upload is a moving picture, and how long it runs', () => {
        expect(prompt).toMatch(/Rain on the roof/u);
        expect(prompt).toMatch(/video · 30\.5s/u);
        expect(prompt).toMatch(/Kitchen window/u);
    });

    it('teaches a video cue the validator accepts, with the real asset id', () => {
        // A wrong-kind reference raises VISUAL_SCORE_ASSET_KIND, and this is
        // the only cue that can carry a clip. Teaching its shape is worth
        // nothing unless the shape is one the gate takes — the cue is lifted
        // out of the prompt and scored, rather than matched as a string.
        const printed = prompt.match(
            / {2}(\{ "kind": "video",[\s\S]*?\})\n/u);
        expect(printed, 'the prompt prints no video cue').toBeTruthy();
        const cue = JSON.parse(printed[1].replace(/\n\s+/gu, ' '));
        expect(cue.assetId).toBe('asset-clip');

        const program = {
            schema: EXPERIENCE_PROGRAM_SCHEMA,
            id: 'rain', authority: 'proposed', editable: true,
            tracks: [
                {
                    id: 'movements', kind: 'movement', clips: [{
                        id: 'm1', anchor: { sourceIds: ['sacred-tao-te-ching#40'] },
                        data: { index: 0, title: 'Rain' }
                    }]
                },
                {
                    id: 'visuals', kind: 'visual', fallback: { kind: 'still' }, clips: [{
                        id: 'v1', cue, anchor: { sourceIds: ['sacred-tao-te-ching#40'] }
                    }]
                }
            ]
        };
        const parsed = parseCuratorPaste(JSON.stringify(program), { context });
        expect(parsed.program.tracks[1].clips[0].cue.kind).toBe('video');
    });

    it('prints nothing where RISE wrote the description itself', () => {
        // Every catalogue entry carries a description; the generated one says
        // no more than `mediaKind` already does, so printing it would cost a
        // line per file to repeat the heading above them.
        expect(prompt).not.toMatch(/An image the reader added to this project/u);
        expect(prompt).not.toMatch(/A video the reader added to this project/u);
        expect(prompt).not.toMatch(/quoted line under a file/u);
    });
});

/**
 * A DESCRIPTION IS THE ONLY THING IN THIS SECTION THAT IS NOT A MEASUREMENT.
 *
 * Name, kind and duration are facts RISE read off the file. A description is
 * the reader talking about their own photograph, and it is the only signal
 * that can tell a composer WHERE an image belongs rather than merely that it
 * exists — which is the difference between anchored placement and a gallery.
 * It reached the catalogue and stopped there: the prompt printed the ids and
 * never the words.
 */
describe('the reader\'s own words about their own file', () => {
    const WORDS = 'The cliff path above the harbour, the morning after.';
    const context = roomContext(DEFAULT_TARGET_WORDS, {
        assets: [
            { id: 'asset-said', name: 'cliff.png', mimeType: 'image/png', description: WORDS },
            { id: 'asset-silent', name: 'harbour.png', mimeType: 'image/png' }
        ]
    });
    const prompt = buildCuratorPrompt({ context });

    it('prints them under the file they are about', () => {
        const lines = prompt.split('\n');
        const at = lines.findIndex(line => line.includes('cliff.png'));
        expect(at).toBeGreaterThan(-1);
        // Quoted, so the model can tell the reader's voice from RISE's.
        expect(lines[at + 1].trim()).toBe(`"${WORDS}"`);
    });

    it('leaves an undescribed file undescribed', () => {
        const lines = prompt.split('\n');
        const at = lines.findIndex(line => line.includes('harbour.png'));
        expect(lines[at + 1].trim().startsWith('"')).toBe(false);
        expect(prompt).not.toMatch(/An image the reader added to this project/u);
    });

    it('keeps the attribution a description strengthens', () => {
        expect(prompt).toContain("THE READER'S OWN");
        expect(prompt).toContain("These are the reader's own, not the Library's");
        // And says what a quoted line means, so the composer acts on it
        // rather than reading it as more of RISE's own prose.
        expect(prompt).toMatch(/quoted line under a file is the reader's own description/u);
        expect(prompt).toMatch(/an undescribed file has no such claim/u);
    });
});

describe('with no capability document there is nothing to name', () => {
    const prompt = buildCuratorPrompt({ intent: 'Anything.' });

    it('says where the ids will come from and invents none', () => {
        expect(prompt).toMatch(/supplied separately as context\.json/u);
        for (const entry of buildLibraryCatalogue()) {
            expect(prompt.includes(entry.id), `${entry.id} named without a context`).toBe(false);
        }
    });
});
