/**
 * The last beat with words is said whole before the reading ends.
 *
 * The field trace (Edge, "Microsoft Ava Online (Natural)", a stored premium-educational card): `speech.end beat-22`
 * at 108.211 s, then `run.finished` at 112.281 s and no speech between. The style ends on a shown line ("show" with
 * "hold", in the centre, larger; guide/styles/premium-educational.js), which no one says: those four seconds are its
 * 3,500 ms hold and the seam before it. Here the whole runtime reads Currents ending both ways, over the synthetic
 * voice and over a network-like browser voice that is slow to begin, and the journal says the last passage with words
 * was begun and ended, for its full length, before `run.finished`, and never let go of or cut.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../core/player.js';
import { createRealClock } from './clock.js';
import { createLiveRuntime } from './runtime.js';
import { createMcpAppAdapter } from './adapters/mcp-app.js';
import { currentToEvents } from './adapters/current-events.js';
import { createSyntheticVoice } from './voices/synthetic.js';
import { createBrowserVoice } from './voices/browser.js';
import { createTextStreamAdapter } from './adapters/text-stream.js';
import { createMockBeatsAdapter } from './adapters/mock-beats.js';
import { createFakeSpeech } from '../test/fake-speech.js';
import { SKY_PREMIUM_EDUCATIONAL } from './fixtures/sky-premium-educational.js';
import { BLACK_HOLES_BEATS_CURRENT } from './fixtures/black-holes-beats.js';

const NATURAL = { name: 'Microsoft Ava Online (Natural) - English (United States)', lang: 'en-US', localService: false };
/** A slow voice: slower than the Player's own pace, so a reading that did not wait for it would end while it still spoke. */
const MS_PER_CHAR = 90;
const LONG = 'At sunset the light crosses far more air than at noon, so the blue is scattered away long before it reaches you, and the oranges and reds that scatter least are what is left to colour the sky.';

const tick = ms => vi.advanceTimersByTimeAsync(ms);
let runtime = null;

beforeEach(() => {
    vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
            'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame']
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
});

afterEach(async () => {
    await runtime?.stop();
    runtime = null;
    vi.restoreAllMocks();
    vi.useRealTimers();
});

const v2 = beats => ({
    schema: 'rise.current.v2', id: 'last-beat', title: 'Why the sky is blue',
    origin: { kind: 'model', name: 'Claude', provider: 'Anthropic' },
    scenes: [{ id: 'field', engine: 'attractor', params: { palette: 'jade' } }],
    beats
});

const v1 = segments => ({
    schema: 'rise.current.v1', id: 'last-passage', title: 'Why the sky is blue',
    origin: { kind: 'model', name: 'Claude', provider: 'Anthropic' },
    segments: segments.map((text, index) => ({ id: `s${index}`, text, visual: 'still' }))
});

/** The device's voice: the synthetic one, or the browser's over a fake engine that begins each utterance late, as a network voice does. */
const VOICES = {
    synthetic: clock => createSyntheticVoice({ clock, msPerChar: MS_PER_CHAR, breathMs: 50 }),
    network: clock => {
        const synth = createFakeSpeech(clock, { msPerChar: MS_PER_CHAR, latencyMs: 600, boundaries: false });
        return createBrowserVoice({ speech: { synth, Utterance: synth.Utterance }, clock, lang: 'en-US', voice: NATURAL });
    }
};

/** The card's way in: a sealed Current, handed over whole. */
const sealed = current => clock => createMcpAppAdapter({
    port: { onCurrent: () => () => {}, canSample: () => false }, clock, host: 'https://host.example',
    admittedEvents: currentToEvents(current), admittedCurrent: current
});

/** The venue's way in: beats written as a model streams them, through the text-stream adapter and its parser. */
const streamed = text => () => createTextStreamAdapter({
    id: 'scripted', provider: 'test',
    connect: async (_request, sink) => { setTimeout(() => { sink.delta(text); sink.done(); }, 10); return { cancel() {}, close() {} }; }
});

/** Read to its end what `open` adapts, with `kind` of voice; resolves with the main run's journal. */
async function read(open, kind) {
    const clock = createRealClock();
    const voice = VOICES[kind](clock);
    runtime = createLiveRuntime({
        adapter: open(clock), clock, voices: { create: () => voice },
        createPlayer: session => new Player(session),
        host: { present: async () => {}, dismiss: () => {} }
    });
    await runtime.start('Explain black holes with RISE.');
    for (let waited = 0; waited < 120_000 && runtime.status !== 'ended'; waited += 100) await tick(100);
    expect(runtime.status).toBe('ended');
    return runtime.journal().filter(entry => entry.role === 'main');
}

const of = (journal, type, segmentId) => journal.filter(entry => entry.type === type && (segmentId === undefined || entry.segmentId === segmentId));

/**
 * The voice began and ended `id`, once, saying all of `text`, and the reading ended after it, with nothing let go or
 * cut. `kept`: the words kept with the voice, so the Player completed as it ended (`voiceTailMs` is how long the
 * reading then waited on the voice).
 */
function expectSaidWholeBeforeTheEnd(journal, id, text, { kept = true } = {}) {
    const [finished] = of(journal, 'run.finished');
    const started = of(journal, 'speech.start', id);
    const ended = of(journal, 'speech.end', id);
    expect(started).toHaveLength(1);
    expect(ended).toHaveLength(1);
    // Its whole length: a voice cut part way would end it early.
    expect(ended[0].durationMs).toBeGreaterThanOrEqual(text.length * MS_PER_CHAR);
    expect(ended[0].at).toBeLessThanOrEqual(finished.at);
    if (kept) expect(finished.voiceTailMs ?? 0).toBeLessThan(250);
    // Nothing held, let go of, taken or stopped the voice while it said it (the Play that began the reading notes a
    // release of a voice nothing held, at the start).
    const meanwhile = journal.filter(entry => entry.at >= started[0].at && ['voice.released', 'voice.held', 'voice.taken', 'voice.failed', 'voice.degraded', 'interrupt'].includes(entry.type));
    expect(meanwhile).toEqual([]);
    for (const type of ['voice.held', 'voice.taken', 'voice.failed', 'voice.degraded']) expect(of(journal, type)).toEqual([]);
}

describe('the last beat with words', () => {
    const endings = {
        'a long say': [{ say: 'Sunlight carries every colour.', scene: 'field' }, { say: LONG }],
        'a say shown differently': [{ say: 'Sunlight carries every colour.', scene: 'field' }, { say: LONG, show: 'Sunset: the long way through the air.' }],
        'a say with a scene cue': [{ say: 'Sunlight carries every colour.', scene: 'field' }, { say: LONG, cue: 'bright' }],
        'a say after a hold': [{ say: 'Sunlight carries every colour.', scene: 'field' }, { hold: { ms: 2000 } }, { say: LONG }]
    };
    for (const kind of Object.keys(VOICES)) {
        for (const [ending, beats] of Object.entries(endings)) {
            it(`ending on ${ending} is said whole before run.finished (${kind} voice)`, async () => {
                const journal = await read(sealed(v2(beats)), kind);
                expectSaidWholeBeforeTheEnd(journal, `beat-${beats.length - 1}`, LONG);
            });
        }

        it(`a v1 Current's long last passage is said whole before run.finished (${kind} voice)`, async () => {
            const journal = await read(sealed(v1(['Sunlight carries every colour.', 'Blue scatters most.', LONG])), kind);
            expectSaidWholeBeforeTheEnd(journal, 's2', LONG);
        });

        it(`the venue's demo, streamed as a model writes it, says its last beat whole before run.finished (${kind} voice)`, async () => {
            const journal = await read(clock => createMockBeatsAdapter({ clock }), kind);
            const last = BLACK_HOLES_BEATS_CURRENT.beats.length - 1;
            expectSaidWholeBeforeTheEnd(journal, `beat-${last}`, BLACK_HOLES_BEATS_CURRENT.beats[last].say);
        });
    }

    it('is waited for when the words ran ahead of it: a voice with no word marks, slower than the clock’s first guess', async () => {
        // One passage, so the clock has only its default speed (65 ms a character) for a voice saying 90: the Player
        // shows the last words and completes some 4.8 s before the voice has said them. The reading still ends on
        // the voice (runtime.js settle), not on the words.
        const journal = await read(sealed(v1([LONG])), 'network');
        expectSaidWholeBeforeTheEnd(journal, 's0', LONG, { kept: false });
        expect(of(journal, 'run.finished')[0].voiceTailMs).toBeGreaterThan(1_000);
    });
});

describe('a closing shown line', () => {
    // By the style's design (guide/styles/premium-educational.js): "End on a shown line ("show" with "hold", in the
    // centre, larger) that states the result." No one says it, so the reading's last speech is the beat before it.
    const beats = SKY_PREMIUM_EDUCATIONAL.beats;
    const closing = beats.at(-1);
    const lastSaid = `beat-${beats.findLastIndex(beat => beat.say)}`;

    it('is the premium-educational fixture’s last beat, as the style asks', () => {
        expect(closing).toMatchObject({ show: expect.any(String), hold: { ms: 3500 }, place: 'centre', size: 'larger' });
        expect(closing.say).toBeUndefined();
        expect(lastSaid).toBe(`beat-${beats.length - 2}`);
    });

    for (const kind of Object.keys(VOICES)) {
        it(`is silent, and the reading ends its hold after the last speech.end, as in the field trace (${kind} voice)`, async () => {
            const journal = await read(sealed(SKY_PREMIUM_EDUCATIONAL), kind);
            const closingId = `beat-${beats.length - 1}`;
            expect(of(journal, 'speech.start', closingId)).toEqual([]);
            expectSaidWholeBeforeTheEnd(journal, lastSaid, beats.at(-2).say);
            const said = of(journal, 'speech.end');
            expect(said.at(-1).segmentId).toBe(lastSaid);
            const gap = of(journal, 'run.finished')[0].at - said.at(-1).at;
            // The field's 4,070 ms (4,063 ms here, with either voice): the shown line's 3,500 ms hold, and the seam before it.
            expect(gap).toBeGreaterThanOrEqual(closing.hold.ms);
            expect(gap).toBeLessThan(closing.hold.ms + 1_500);
        });
    }

    for (const kind of Object.keys(VOICES)) {
        it(`streamed as the venue reads it, is silent too, and the reading ends its hold after the last speech.end (${kind} voice)`, async () => {
            const text = ['@say Sunlight carries every colour.', `@say ${LONG}`, `@show hold=${closing.hold.ms} place=centre size=larger ${closing.show}`, ''].join('\n');
            const journal = await read(streamed(text), kind);
            expect(of(journal, 'speech.start', 'beat-2')).toEqual([]);
            expectSaidWholeBeforeTheEnd(journal, 'beat-1', LONG);
            const gap = of(journal, 'run.finished')[0].at - of(journal, 'speech.end', 'beat-1')[0].at;
            expect(gap).toBeGreaterThanOrEqual(closing.hold.ms);
            expect(gap).toBeLessThan(closing.hold.ms + 1_500);
        });
    }
});
