/**
 * A network voice that never begins one passage, while it says the passage before it.
 *
 * The field trace (Edge 155, "Microsoft Ava Online (Natural)"): beat-19 was said, beat-20 never began, and about a
 * second later the clock stood down (`voice.degraded reason=voice-did-not-start`). A seek back to beat-19 lifted it;
 * beat-19 was said again, and beat-20 failed again. Here the fake device drops one passage's utterance outright, as
 * that voice did, and the whole runtime reads the field's Current over it: the passage is tried again a sentence at
 * a time, and the clock stands down only when that fails too.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../core/player.js';
import { createRealClock } from './clock.js';
import { createLiveRuntime } from './runtime.js';
import { createMcpAppAdapter } from './adapters/mcp-app.js';
import { currentToEvents } from './adapters/current-events.js';
import { createBrowserVoice } from './voices/browser.js';
import { createFakeSpeech } from '../test/fake-speech.js';
import { SKY_PREMIUM_EDUCATIONAL } from './fixtures/sky-premium-educational.js';

const NATURAL = { name: 'Microsoft Ava Online (Natural) - English (United States)', lang: 'en-US', localService: false };
/** beat-5 follows beat-4 with no hold between, as beat-20 followed beat-19: two sentences. */
const DROPPED = SKY_PREMIUM_EDUCATIONAL.beats[5].say;
const SPOKEN = SKY_PREMIUM_EDUCATIONAL.beats.filter(beat => beat.say).length;

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

function open(drops) {
    const clock = createRealClock();
    const synth = createFakeSpeech(clock, { msPerChar: 70, latencyMs: 600, boundaries: false, drops });
    const adapter = createMcpAppAdapter({
        port: { onCurrent: () => () => {}, canSample: () => false }, clock, host: 'https://host.example',
        admittedEvents: currentToEvents(SKY_PREMIUM_EDUCATIONAL), admittedCurrent: SKY_PREMIUM_EDUCATIONAL
    });
    runtime = createLiveRuntime({
        adapter, clock,
        createPlayer: session => new Player(session),
        voices: { create: () => createBrowserVoice({ speech: { synth, Utterance: synth.Utterance }, clock, lang: 'en-US', voice: NATURAL }) },
        host: { present: async () => {}, dismiss: () => {} }
    });
    return runtime;
}

const entries = (type, segmentId) => runtime.journal().filter(entry => entry.type === type && (segmentId === undefined || entry.segmentId === segmentId));

async function until(test, limitMs = 120_000) {
    for (let waited = 0; waited < limitMs && !test(); waited += 100) await tick(100);
}

describe('a passage a network voice never begins', () => {
    it('is tried again a sentence at a time, and the reading goes on with the voice as its clock', async () => {
        open(text => text === DROPPED);
        await runtime.start('Why is the sky blue?');
        await until(() => runtime.status === 'ended' || entries('speech.end').length >= SPOKEN);

        expect(entries('voice.degraded')).toEqual([]);
        expect(entries('voice.retried', 'beat-5')).toEqual([expect.objectContaining({ role: 'main', mode: 'sentences' })]);
        expect(entries('speech.start', 'beat-5')).toEqual([expect.objectContaining({ mode: 'sentences' })]);
        expect(entries('speech.end').length).toBe(SPOKEN);
    });

    it('stands the clock down only when the sentences fail too, saying which passage, how long, and that it was tried again', async () => {
        // Every utterance with "scatters" in it: both of beat-5's sentences.
        open(text => text.includes('scatters'));
        await runtime.start('Why is the sky blue?');
        await until(() => entries('voice.degraded').length > 0);

        const [beat4End] = entries('speech.end', 'beat-4');
        const [degraded] = entries('voice.degraded');
        expect(degraded).toMatchObject({ reason: 'voice-did-not-start', segmentId: 'beat-5', chars: DROPPED.length, retried: 'sentences' });
        expect(entries('voice.retried', 'beat-5')).toHaveLength(1);
        // Two graces and the retry's pause after the passage before it ended, not a reading that waits on and on.
        expect(degraded.at - beat4End.at).toBeLessThan(4_000);

        // The reader goes back a passage: the clock is the voice's again, beat-4 is said again, and beat-5 fails again.
        runtime.seek({ segmentId: 'beat-4' });
        expect(entries('voice.recovered')).toHaveLength(1);
        await until(() => entries('voice.degraded').length > 1);
        expect(entries('speech.start', 'beat-4')).toHaveLength(2);
        expect(entries('voice.retried', 'beat-5')).toHaveLength(2);
        expect(entries('voice.degraded').at(-1)).toMatchObject({ segmentId: 'beat-5', retried: 'sentences' });
    });

    it('stands down after its one retry where the passage is one sentence, and the retry can only say it whole again', async () => {
        // beat-0 is one sentence: its "sentence-wise" retry is the same utterance, which is dropped again.
        const first = SKY_PREMIUM_EDUCATIONAL.beats[0].say;
        open(text => text === first);
        await runtime.start('Why is the sky blue?');
        await until(() => entries('voice.degraded').length > 0);
        expect(entries('voice.degraded')[0]).toMatchObject({ segmentId: 'beat-0', chars: first.length, retried: 'sentences' });
    });
});

describe('the reader’s controls over a passage said again in sentences', () => {
    /** Read until the voice has begun beat-5 a sentence at a time. */
    async function intoRetried() {
        open(text => text === DROPPED);
        await runtime.start('Why is the sky blue?');
        await until(() => entries('speech.start', 'beat-5').length > 0);
        expect(entries('speech.start', 'beat-5')[0]).toMatchObject({ mode: 'sentences' });
    }
    const finish = () => until(() => runtime.status === 'ended');

    it('a pace set in its first sentence lands at its second, and the reading ends with the voice', async () => {
        await intoRetried();
        runtime.setPace(1.5);
        expect(runtime.snapshot().paceFrom).toBe('sentence');
        await until(() => entries('pace.applied').length > 0);
        expect(entries('pace.applied')[0]).toMatchObject({ rate: 1.5, segmentId: 'beat-5' });
        expect(entries('speech.end', 'beat-5')).toHaveLength(0);
        await finish();
        expect(entries('voice.degraded')).toEqual([]);
    });

    it('a seek back onto it says it again, tried again in sentences, and the reading ends with the voice', async () => {
        await intoRetried();
        runtime.seek({ segmentId: 'beat-5' });
        await finish();
        expect(entries('voice.degraded')).toEqual([]);
        expect(entries('voice.retried', 'beat-5')).toHaveLength(2);
        expect(entries('speech.start', 'beat-5').map(entry => entry.mode)).toEqual(['sentences', 'sentences']);
        expect(entries('speech.end', 'beat-5')).toHaveLength(1);
    });

    it('a replay in it says it again from its start, and the reading ends with the voice', async () => {
        await intoRetried();
        runtime.replay();
        await finish();
        expect(entries('voice.degraded')).toEqual([]);
        expect(entries('speech.start', 'beat-5')).toHaveLength(2);
        expect(entries('speech.end', 'beat-5')).toHaveLength(1);
    });
});
