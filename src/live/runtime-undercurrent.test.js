/**
 * The runtime keeps every Dive (docs/plans/LIVE-UNDERCURRENT.md). What is held:
 * a Dive opens an entry at the reader's place with their question and keeps
 * the answer as it grows; a question asked inside a Dive is a turn of the same
 * entry, at the same place, and the reading left behind stays held; two
 * questions cannot be opening at once; a Dive that cannot open leaves nothing
 * behind if it was the first question, and keeps its failure if it was a
 * follow-up; the entries outlive Surface, the end of the reading, and Stop.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../core/player.js';
import { createRealClock } from './clock.js';
import { createMockAdapter } from './adapters/mock.js';
import { createLiveRuntime } from './runtime.js';
import { createSyntheticVoice } from './voices/synthetic.js';

const clock = createRealClock();
const tick = ms => vi.advanceTimersByTimeAsync(ms);
const ASK = 'Explain black holes with RISE.';
const HORIZON = 'dive on event horizon';

let runtime;
let requests;
let presented;
let failOpens;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
});
afterEach(async () => {
    await runtime?.stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

/** `failOn`: the numbers (from 1) of the Dive opens that should be refused by the provider. */
function build({ failOn = [] } = {}) {
    requests = [];
    presented = [];
    failOpens = new Set(failOn);
    const mock = createMockAdapter({ clock });
    const adapter = {
        ...mock,
        open: async (request, options) => {
            requests.push(request);
            if (request.intent === 'dive' && failOpens.has(requests.filter(item => item.intent === 'dive').length)) throw new Error('no route to the provider');
            return mock.open(request, options);
        }
    };
    runtime = createLiveRuntime({
        adapter,
        clock,
        createPlayer: session => new Player(session),
        voices: { create: () => createSyntheticVoice({ clock, msPerChar: 30, breathMs: 150 }) },
        host: { present: ({ role }) => presented.push(['present', role]), dismiss: ({ role }) => presented.push(['dismiss', role]) }
    });
    return runtime;
}

async function reading() {
    await runtime.start(ASK);
    await tick(4_000);
}

describe('a Dive is kept', () => {
    it('opens an entry at the reader’s place, with their question, and says which Dive they are in', async () => {
        build();
        await reading();
        expect(runtime.undercurrent()).toEqual([]);
        expect(runtime.snapshot().dive).toBeNull();
        await runtime.dive({ question: HORIZON, segmentId: 'horizon', atCharacter: 42 });
        const [dive] = runtime.undercurrent();
        expect(dive).toMatchObject({ id: 'dive-1', number: 1, anchor: { segmentId: 'horizon', atCharacter: 42 } });
        expect(dive.anchor.quote).toMatch(/^It is not a surface/u);
        expect(dive.turns).toHaveLength(1);
        expect(dive.turns[0]).toMatchObject({ question: HORIZON, status: 'answering' });
        expect(runtime.snapshot().dive).toEqual({ id: 'dive-1', turns: 1, opening: false });
    });

    it('keeps the answer as it is written, and says it was answered', async () => {
        build();
        await reading();
        await runtime.dive({ question: HORIZON });
        await tick(30_000);
        const [turn] = runtime.undercurrent()[0].turns;
        expect(turn.status).toBe('answered');
        expect(turn.paragraphs.length).toBeGreaterThan(0);
        expect(turn.paragraphs.join(' ')).toBe(runtime.composed('side').segments.filter(segment => segment.ended).map(segment => segment.text).join(' '));
    });

    it('is still there after Surface, and the reader is out of it', async () => {
        build();
        await reading();
        await runtime.dive({ question: HORIZON });
        await tick(30_000);
        const kept = runtime.undercurrent();
        await runtime.surface();
        expect(runtime.snapshot().dive).toBeNull();
        expect(runtime.undercurrent()).toEqual(kept);
    });

    it('adds a second entry for a Dive taken at another place, and numbers them', async () => {
        build();
        await reading();
        await runtime.dive({ question: HORIZON, segmentId: 'what' });
        await runtime.surface();
        await runtime.dive({ question: HORIZON, segmentId: 'horizon' });
        await runtime.surface();
        expect(runtime.undercurrent().map(dive => [dive.id, dive.anchor.segmentId])).toEqual([['dive-1', 'what'], ['dive-2', 'horizon']]);
    });

    it('is still readable after Stop, with a Dive that was open marked cut short', async () => {
        build();
        await reading();
        await runtime.dive({ question: HORIZON });
        await runtime.stop();
        const [turn] = runtime.undercurrent()[0].turns;
        expect(turn.status).toBe('cut-short');
        expect(runtime.snapshot().dive).toBeNull();
    });
});

describe('a question asked inside a Dive', () => {
    it('is another turn of the same Dive, at the same place, and the reading left behind stays held', async () => {
        build();
        await reading();
        await runtime.dive({ question: HORIZON, segmentId: 'horizon', atCharacter: 24 });
        await tick(30_000);
        const held = runtime.playerFor('main').sessionState.currentIndex;
        await runtime.dive({ question: 'and what is on the other side of it?' });
        expect(runtime.status).toBe('diving');
        const dives = runtime.undercurrent();
        expect(dives).toHaveLength(1);
        expect(dives[0].turns.map(turn => [turn.question, turn.status])).toEqual([[HORIZON, 'answered'], ['and what is on the other side of it?', 'answering']]);
        expect(dives[0].anchor).toMatchObject({ segmentId: 'horizon', atCharacter: 24 });
        expect(runtime.snapshot().dive).toEqual({ id: 'dive-1', turns: 2, opening: false });
        await tick(30_000);
        expect(runtime.playerFor('main').sessionState.state).toBe('paused');
        expect(runtime.playerFor('main').sessionState.currentIndex).toBe(held);
        await runtime.surface();
        expect(runtime.status).toBe('live');
    });

    it('is asked of the provider at the same place, as a Dive, and only one Dive is ever open', async () => {
        build();
        await reading();
        await runtime.dive({ question: HORIZON, segmentId: 'horizon', atCharacter: 24 });
        await tick(1_000);
        await runtime.dive({ question: 'and beyond?' });
        await tick(1_000);
        const [first, second] = requests.filter(request => request.intent === 'dive');
        expect(second.parent).toEqual(first.parent);
        expect(second.prompt).toBe('and beyond?');
        expect(presented.filter(entry => entry[1] === 'side').map(entry => entry[0])).toEqual(['present', 'dismiss', 'present']);
        await runtime.surface();
        expect(presented.filter(entry => entry[1] === 'side').map(entry => entry[0])).toEqual(['present', 'dismiss', 'present', 'dismiss']);
    });

    it('cuts short a turn that was still being written, and keeps what had been written', async () => {
        build();
        await reading();
        await runtime.dive({ question: HORIZON });
        await tick(350);
        expect(runtime.undercurrent()[0].turns[0]).toMatchObject({ status: 'answering' });
        expect(runtime.undercurrent()[0].turns[0].paragraphs.length).toBeGreaterThan(0);
        await runtime.dive({ question: 'and beyond?' });
        const [first, second] = runtime.undercurrent()[0].turns;
        expect(first.status).toBe('cut-short');
        expect(first.paragraphs.length).toBeGreaterThan(0);
        expect(second.status).toBe('answering');
    });

    it('is refused while another question is still opening, and nothing is orphaned', async () => {
        build();
        await reading();
        await runtime.dive({ question: HORIZON });
        await tick(30_000);
        const one = runtime.dive({ question: 'one?' });
        const two = runtime.dive({ question: 'two?' }).catch(error => error.code);
        expect(runtime.snapshot().dive.opening).toBe(true);
        expect(await two).toBe('DIVE_BUSY');
        await one;
        expect(runtime.snapshot().dive.opening).toBe(false);
        expect(requests.filter(request => request.intent === 'dive')).toHaveLength(2);
        expect(runtime.undercurrent()[0].turns.map(turn => turn.question)).toEqual([HORIZON, 'one?']);
    });

    it('is kept as failed if it could not be opened, and the reader is still in the Dive and can ask again', async () => {
        build({ failOn: [2] });
        await reading();
        await runtime.dive({ question: HORIZON });
        await tick(30_000);
        await expect(runtime.dive({ question: 'and beyond?' })).rejects.toThrow('no route');
        expect(runtime.status).toBe('diving');
        expect(runtime.snapshot().dive).toEqual({ id: 'dive-1', turns: 2, opening: false });
        const turns = runtime.undercurrent()[0].turns;
        expect(turns[1]).toMatchObject({ question: 'and beyond?', status: 'failed' });
        expect(turns[1].error).toMatch(/no route/u);
        await runtime.dive({ question: 'and beyond, again?' });
        expect(runtime.undercurrent()[0].turns.map(turn => turn.status)).toEqual(['answered', 'failed', 'answering']);
        await runtime.surface();
        expect(runtime.status).toBe('live');
    });

    it('can be surfaced from after a follow-up failed to open', async () => {
        build({ failOn: [2] });
        await reading();
        await runtime.dive({ question: HORIZON });
        await expect(runtime.dive({ question: 'and beyond?' })).rejects.toThrow();
        await runtime.surface();
        expect(runtime.status).toBe('live');
        expect(runtime.snapshot().dive).toBeNull();
        expect(runtime.undercurrent()[0].turns).toHaveLength(2);
    });
});

describe('Surface or Stop while a question is being opened', () => {
    it('surfaces cleanly, the question is cut short, and nothing is left open', async () => {
        build();
        await reading();
        await runtime.dive({ question: HORIZON });
        await tick(30_000);
        const asking = runtime.dive({ question: 'and beyond?' });
        await runtime.surface();
        await expect(asking).resolves.toBeUndefined();
        await tick(500);
        expect(runtime.status).toBe('live');
        expect(runtime.snapshot()).toMatchObject({ dive: null, side: null });
        expect(runtime.undercurrent()[0].turns.map(turn => turn.status)).toEqual(['answered', 'cut-short']);
        expect(presented.filter(entry => entry[1] === 'side').map(entry => entry[0]).at(-1)).toBe('dismiss');
    });

    it('stops cleanly, and the question is cut short', async () => {
        build();
        await reading();
        await runtime.dive({ question: HORIZON });
        await tick(30_000);
        const asking = runtime.dive({ question: 'and beyond?' });
        await runtime.stop();
        await expect(asking).resolves.toBeUndefined();
        expect(runtime.undercurrent()[0].turns.map(turn => turn.status)).toEqual(['answered', 'cut-short']);
    });
});

describe('a Dive that cannot be opened', () => {
    it('leaves nothing behind if it was the first question, and the reading goes on', async () => {
        build({ failOn: [1] });
        await reading();
        await expect(runtime.dive({ question: HORIZON })).rejects.toThrow('no route');
        expect(runtime.undercurrent()).toEqual([]);
        expect(runtime.snapshot().dive).toBeNull();
        expect(runtime.status).toBe('live');
        await runtime.dive({ question: HORIZON });
        expect(runtime.undercurrent()[0].id).toBe('dive-2');
    });

    it('says the undercurrent is full, before anything is held, when it is', async () => {
        build();
        await reading();
        for (let i = 0; i < 50; i += 1) {
            await runtime.dive({ question: `question ${i}`, segmentId: 'what' });
            await runtime.surface();
        }
        const playing = runtime.status;
        await expect(runtime.dive({ question: 'one more' })).rejects.toMatchObject({ code: 'UNDERCURRENT_FULL' });
        expect(runtime.status).toBe(playing);
        expect(runtime.snapshot().dive).toBeNull();
    });
});
