/**
 * The canonical flow, end to end, against the real Player.
 *
 *   ask -> speech begins -> the reader interrupts and dives -> a side Current
 *   runs -> Surface -> the parent continues from the same place
 *
 * The provider is the deterministic mock, the voice is the synthetic one, and
 * one time source (vitest's fake timers) drives them and the Player alike.
 * Nothing here is paid for or audible; it proves the runtime, not a provider.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../core/player.js';
import { createRealClock } from './clock.js';
import { createMockAdapter } from './adapters/mock.js';
import { BLACK_HOLES } from './fixtures/black-holes.js';
import { createLiveRuntime, LiveRuntimeError } from './runtime.js';
import { createSyntheticVoice } from './voices/synthetic.js';

const MS_PER_CHAR = 30;
const clock = createRealClock();
const tick = ms => vi.advanceTimersByTimeAsync(ms);
const ASK = 'Explain black holes with RISE.';

let runtime;
let presented;
let shown;

beforeEach(() => {
    vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
            'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame']
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
});

afterEach(async () => {
    await runtime?.stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

function build({ faults = {}, voice = true, voiceOptions = {}, graceMs, presentMs = 0 } = {}) {
    presented = [];
    shown = { main: [], side: [] };
    runtime = createLiveRuntime({
        adapter: createMockAdapter({ clock, faults }),
        clock,
        graceMs,
        createPlayer: (session, { role }) => {
            const player = new Player(session);
            player.on('atom', ({ index, concealed }) => { if (!concealed) shown[role].push({ index, at: performance.now() }); });
            return player;
        },
        voices: voice ? { create: () => createSyntheticVoice({ clock, msPerChar: MS_PER_CHAR, breathMs: 150, ...voiceOptions }) } : null,
        host: {
            present: ({ role }) => {
                presented.push(['present', role]);
                return presentMs ? clock.sleep(presentMs) : undefined;
            },
            dismiss: ({ role }) => presented.push(['dismiss', role])
        }
    });
    return runtime;
}

const speechStarts = () => runtime.journal().filter(e => e.type === 'speech.start' && e.role === 'main');
const orderedOnce = list => list.map(s => s.index).every((index, i, all) => i === 0 || index === all[i - 1] + 1);

describe('asking', () => {
    it('shows the first words and starts speaking within a beat of the first segment being committed', async () => {
        build();
        const began = performance.now();
        await runtime.start(ASK);
        await tick(400);
        expect(runtime.status).toBe('live');
        expect(shown.main.length).toBeGreaterThan(0);
        // The mock finishes writing its first segment at 220 ms (20 ms latency, five 40 ms chunks).
        // Time to first visible response and to first audio are that plus one event turn.
        const committed = 220;
        expect(shown.main[0].at - began - committed).toBeLessThanOrEqual(100);
        expect(speechStarts().length).toBeGreaterThan(0);
        expect(speechStarts()[0].at - began - committed).toBeLessThanOrEqual(100);
    });

    it('does not let the voice begin while the host is still putting the reading on screen', async () => {
        build({ presentMs: 1_000 });
        const began = performance.now();
        await runtime.start(ASK);
        await tick(900);
        expect(shown.main).toEqual([]);
        expect(speechStarts()).toEqual([]);
        await tick(600);
        // The first words are shown and the voice starts together, and neither before the host was ready.
        expect(shown.main.length).toBeGreaterThan(0);
        expect(speechStarts().length).toBeGreaterThan(0);
        expect(Math.abs(shown.main[0].at - speechStarts()[0].at)).toBeLessThanOrEqual(50);
        expect(speechStarts()[0].at - began).toBeGreaterThanOrEqual(1_000);
    });

    it('speaks each segment in order and reads every atom exactly once, then ends', async () => {
        build();
        await runtime.start(ASK);
        await tick(120_000);
        expect(runtime.status).toBe('ended');
        const ids = speechStarts().map(e => e.segmentId);
        expect(ids).toEqual(BLACK_HOLES.segments.map(s => s.id));
        expect(shown.main.length).toBe(runtime.playerFor().sessionState.session.atoms.length);
        expect(orderedOnce(shown.main)).toBe(true);
        expect(shown.main[0].index).toBe(0);
    });

    it('presents the parent once and lowers every segment into the one Player', async () => {
        build();
        await runtime.start(ASK);
        await tick(120_000);
        expect(presented.filter(e => e[0] === 'present' && e[1] === 'main')).toHaveLength(1);
        expect(runtime.snapshot().main.committedSegments).toBe(BLACK_HOLES.segments.length);
        expect(runtime.composed().phase).toBe('complete');
    });

    it('works with no voice at all, on the Player’s own timer, without calling that a failure', async () => {
        build({ voice: false });
        await runtime.start(ASK);
        await tick(120_000);
        expect(runtime.status).toBe('ended');
        expect(runtime.journal().some(e => e.type === 'voice.degraded')).toBe(false);
        expect(orderedOnce(shown.main)).toBe(true);
    });

    it('refuses to start twice', async () => {
        build();
        await runtime.start(ASK);
        await expect(runtime.start(ASK)).rejects.toMatchObject({ code: 'ALREADY_STARTED' });
    });
});

describe('interrupting', () => {
    it('holds the reading and the voice where they are, and carries on from there', async () => {
        build();
        await runtime.start(ASK);
        await tick(3_000);
        await runtime.interrupt({ text: 'wait' });
        expect(runtime.status).toBe('interrupted');
        const at = runtime.snapshot().main.atomIndex;
        const count = shown.main.length;
        const heldAt = performance.now();
        await tick(20_000);
        expect(runtime.snapshot().main.atomIndex).toBe(at);
        expect(shown.main.length).toBe(count);
        runtime.resume();
        await tick(120_000);
        expect(runtime.status).toBe('ended');
        expect(orderedOnce(shown.main)).toBe(true);
        expect(runtime.journal().find(e => e.type === 'interrupt').at).toBeGreaterThanOrEqual(heldAt - 20_000 - 1);
    });

    it('stops the provider composing when it was still composing, and reads what was already committed', async () => {
        build();
        await runtime.start(ASK);
        await tick(300);
        const committed = runtime.snapshot().main.committedSegments;
        await runtime.interrupt({ text: 'wait' });
        await tick(5_000);
        expect(runtime.composed().phase).toBe('cancelled');
        runtime.resume();
        await tick(120_000);
        expect(runtime.status).toBe('ended');
        expect(runtime.snapshot().main.committedSegments).toBeLessThan(BLACK_HOLES.segments.length);
        expect(runtime.snapshot().main.committedSegments).toBeGreaterThanOrEqual(committed);
    });
});

describe('diving and surfacing', () => {
    it('suspends the parent without moving it, answers in a Current of its own, and returns to the same atom', async () => {
        build();
        await runtime.start(ASK);
        await tick(4_000);
        const before = runtime.snapshot().main;
        const parentShown = shown.main.length;

        await runtime.dive({ question: 'dive on event horizon' });
        expect(runtime.status).toBe('diving');
        await tick(1_000);
        expect(presented).toContainEqual(['present', 'side']);
        expect(runtime.snapshot().side.currentId).not.toBe(before.currentId);

        await tick(40_000);
        expect(runtime.snapshot().main.atomIndex).toBe(before.atomIndex);
        expect(shown.main.length).toBe(parentShown);
        expect(runtime.snapshot().side.finished).toBe(true);
        expect(shown.side.length).toBeGreaterThan(0);

        await runtime.surface();
        expect(runtime.status).toBe('live');
        expect(runtime.snapshot().side).toBeNull();
        expect(presented.at(-2)).toEqual(['dismiss', 'side']);
        expect(runtime.snapshot().main.atomIndex).toBe(before.atomIndex);

        await tick(120_000);
        expect(runtime.status).toBe('ended');
        expect(shown.main.map(s => s.index)).toEqual([...new Set(shown.main.map(s => s.index))]);
        expect(orderedOnce(shown.main)).toBe(true);
    });

    it('gives the parent back its time: everything after Surface is later by exactly the Dive', async () => {
        const free = build();
        const freeBegan = performance.now();
        await free.start(ASK);
        await tick(200_000);
        const baseline = speechStarts().map(e => e.at - freeBegan);
        await free.stop();

        build();
        const began = performance.now();
        await runtime.start(ASK);
        await tick(4_000);
        const heldFrom = performance.now() - began;
        await runtime.dive({ question: 'dive on event horizon' });
        await tick(25_000);
        await runtime.surface();
        const heldFor = performance.now() - began - heldFrom;
        await tick(200_000);
        const starts = speechStarts().map(e => ({ ...e, at: e.at - began }));
        expect(starts).toHaveLength(baseline.length);
        // Segments that began before the Dive are where they were; later ones are later by the Dive.
        for (let i = 0; i < starts.length; i += 1) {
            const late = starts[i].at - baseline[i];
            if (baseline[i] < heldFrom) expect(Math.abs(late)).toBeLessThanOrEqual(50);
            else expect(Math.abs(late - heldFor)).toBeLessThanOrEqual(400);
        }
    });

    it('can dive while the parent is still being composed, and the parent keeps composing', async () => {
        build();
        await runtime.start(ASK);
        await tick(300);
        await runtime.dive({ question: 'dive on event horizon' });
        await tick(30_000);
        expect(runtime.composed().phase).toBe('complete');
        await runtime.surface();
        await tick(200_000);
        expect(runtime.status).toBe('ended');
        expect(runtime.snapshot().main.committedSegments).toBe(BLACK_HOLES.segments.length);
        expect(orderedOnce(shown.main)).toBe(true);
    });

    it('can dive after the parent has ended, and surfaces without replaying it', async () => {
        build();
        await runtime.start(ASK);
        await tick(200_000);
        expect(runtime.status).toBe('ended');
        const count = shown.main.length;
        await runtime.dive({ question: 'dive on event horizon' });
        await tick(30_000);
        await runtime.surface();
        await tick(30_000);
        expect(runtime.status).toBe('ended');
        expect(shown.main).toHaveLength(count);
    });

    it('takes the question’s place from where the reader is, or from where it is told', async () => {
        build();
        await runtime.start(ASK);
        await tick(4_000);
        await runtime.dive({ question: 'dive on event horizon', segmentId: 'horizon', atCharacter: 24 });
        expect(runtime.journal().find(e => e.type === 'branch.open')).toMatchObject({ segmentId: 'horizon', atCharacter: 24 });
        await runtime.surface();
    });

    it('refuses a nested Dive, an unknown place, a blank question, and a Surface with nothing to surface from', async () => {
        build();
        await runtime.start(ASK);
        await tick(4_000);
        await expect(runtime.surface()).rejects.toMatchObject({ code: 'NOT_DIVING' });
        await expect(runtime.dive({ question: '   ' })).rejects.toMatchObject({ code: 'QUESTION' });
        await expect(runtime.dive({ question: 'x', segmentId: 'nope' })).rejects.toMatchObject({ code: 'POSITION' });
        await expect(runtime.dive({ question: 'x', segmentId: 'what', atCharacter: 99_999 })).rejects.toMatchObject({ code: 'POSITION' });
        expect(runtime.status).toBe('live');
        await runtime.dive({ question: 'dive on event horizon' });
        await expect(runtime.dive({ question: 'and deeper' })).rejects.toBeInstanceOf(LiveRuntimeError);
        await expect(runtime.dive({ question: 'and deeper' })).rejects.toMatchObject({ code: 'NESTED_DIVE' });
    });

    it('still surfaces cleanly when the side Current is abandoned half way', async () => {
        build();
        await runtime.start(ASK);
        await tick(4_000);
        await runtime.dive({ question: 'dive on event horizon' });
        await tick(500);
        await runtime.surface();
        expect(runtime.snapshot().side).toBeNull();
        await tick(200_000);
        expect(runtime.status).toBe('ended');
    });
});

describe('when things go wrong', () => {
    it('resumes after the connection is lost and reads the answer exactly once', async () => {
        build({ faults: { transportLossAfter: 9 } });
        await runtime.start(ASK);
        await tick(200_000);
        expect(runtime.status).toBe('ended');
        expect(runtime.journal().map(e => e.type)).toEqual(expect.arrayContaining(['connection.lost', 'connection.resumed']));
        expect(runtime.composed().refusals).toBe(0);
        expect(orderedOnce(shown.main)).toBe(true);
        expect(speechStarts().map(e => e.segmentId)).toEqual(BLACK_HOLES.segments.map(s => s.id));
    });

    it('reads what was committed when the provider fails part way, and says it failed', async () => {
        build({ faults: { failAfter: 12 } });
        await runtime.start(ASK);
        await tick(200_000);
        const main = runtime.snapshot().main;
        expect(main.error).toMatchObject({ code: expect.any(String) });
        expect(main.committedSegments).toBeGreaterThan(0);
        expect(main.committedSegments).toBeLessThan(BLACK_HOLES.segments.length);
        expect(orderedOnce(shown.main)).toBe(true);
        expect(runtime.status).toBe('ended');
    });

    it('fails outright, visibly, when the provider fails before saying anything', async () => {
        build({ faults: { failAfter: 1 } });
        await runtime.start(ASK);
        await tick(5_000);
        expect(runtime.status).toBe('failed');
        expect(runtime.snapshot().error.code).toEqual(expect.any(String));
        expect(shown.main).toEqual([]);
    });

    it('stands the voice down when it never speaks, and the reading finishes on its own timer', async () => {
        build({ voiceOptions: { msPerChar: 30 }, graceMs: 800 });
        const original = runtime;
        await original.stop();
        // A voice that accepts speech and never says it.
        runtime = createLiveRuntime({
            adapter: createMockAdapter({ clock }),
            clock,
            graceMs: 800,
            createPlayer: (session) => new Player(session),
            voices: { create: () => ({ attach() {}, enqueue() {}, hold() {}, release() {}, cancel() {}, close() {}, playedMs: () => undefined }) }
        });
        await runtime.start(ASK);
        await tick(200_000);
        expect(runtime.status).toBe('ended');
        expect(runtime.snapshot().main.voiceDegraded).toBe(true);
        expect(runtime.journal().filter(e => e.type === 'voice.degraded')).toHaveLength(1);
    });

    it('carries on, silently, when the voice throws on the first thing it is asked to say', async () => {
        build();
        await runtime.stop();
        runtime = createLiveRuntime({
            adapter: createMockAdapter({ clock }),
            clock,
            createPlayer: (session) => new Player(session),
            voices: { create: () => ({ attach() {}, enqueue() { throw new Error('no voice'); }, hold() {}, release() {}, cancel() {}, close() {}, playedMs: () => undefined }) }
        });
        await runtime.start(ASK);
        await tick(200_000);
        expect(runtime.status).toBe('ended');
        expect(runtime.journal().some(e => e.type === 'voice.failed')).toBe(true);
    });
});

describe('stopping', () => {
    it('releases every timer, voice and connection, from any moment, and is safe twice', async () => {
        for (const moment of [0, 150, 1_000, 6_000]) {
            build();
            await runtime.start(ASK);
            await tick(moment);
            await runtime.stop();
            await runtime.stop();
            expect(runtime.status).toBe('stopped');
            expect(vi.getTimerCount(), `after ${moment} ms`).toBe(0);
        }
    });

    it('releases everything from inside a Dive too', async () => {
        build();
        await runtime.start(ASK);
        await tick(4_000);
        await runtime.dive({ question: 'dive on event horizon' });
        await tick(500);
        await runtime.stop();
        expect(vi.getTimerCount()).toBe(0);
        expect(presented.filter(e => e[0] === 'dismiss').map(e => e[1]).sort()).toEqual(['main', 'side']);
    });

    it('tells a subscriber each change, and stops telling it after it unsubscribes', async () => {
        build();
        const seen = [];
        const off = runtime.subscribe(view => seen.push(view.status));
        await runtime.start(ASK);
        await tick(400);
        off();
        const count = seen.length;
        await tick(200_000);
        expect(seen[0]).toBe('starting');
        expect(seen).toContain('live');
        expect(seen.length).toBe(count);
    });
});
