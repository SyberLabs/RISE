/**
 * A Pause and a Play, anywhere early in a real reading, never part the words from the voice.
 *
 * The whole runtime (the field's 17-beat Current through the MCP adapter, the Player, the speech governor, the
 * beat conductor and the browser voice) on a fake speech device that behaves like the three voices a reader on
 * Windows meets: Chrome's Google network voice (no word boundaries, said a sentence at a time, slow to start),
 * Edge's online natural voice (no boundaries, a passage whole) and a voice on the device (boundaries). A 2 s
 * Pause is swept through the first 12 s of the reading. After each, the clock must not have been given up on,
 * and the voice must not still be speaking when the reading on screen has ended.
 *
 * One time source runs all of it: vitest's fake timers drive the Player, the voice, the adapter and the conductor.
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

const VOICES = {
    google: { voice: { name: 'Google US English', lang: 'en-US', localService: false }, msPerChar: 65, latencyMs: 400, boundaries: false },
    natural: { voice: { name: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US', localService: false }, msPerChar: 70, latencyMs: 600, boundaries: false },
    local: { voice: { name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true }, msPerChar: 70, latencyMs: 600, boundaries: true }
};
/** The Current's spoken beats: the ten passages the voice says. */
const SPOKEN = SKY_PREMIUM_EDUCATIONAL.beats.filter(beat => beat.say).length;
const PAUSE_MS = 2_000;
const PAUSES_AT = Array.from({ length: 24 }, (_, i) => 500 + i * 500);

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

/** Read the field's Current in `kind`'s voice, held for 2 s at `pauseAt` (or never); what the journal says of it. */
async function read(kind, pauseAt = null) {
    const { voice, ...device } = VOICES[kind];
    const clock = createRealClock();
    const synth = createFakeSpeech(clock, device);
    const adapter = createMcpAppAdapter({
        port: { onCurrent: () => () => {}, canSample: () => false }, clock, host: 'https://host.example',
        admittedEvents: currentToEvents(SKY_PREMIUM_EDUCATIONAL), admittedCurrent: SKY_PREMIUM_EDUCATIONAL
    });
    runtime = createLiveRuntime({
        adapter, clock,
        createPlayer: session => new Player(session),
        voices: { create: () => createBrowserVoice({ speech: { synth, Utterance: synth.Utterance }, clock, lang: 'en-US', voice }) },
        host: { present: async () => {}, dismiss: () => {} }
    });
    const startedAt = performance.now();
    await runtime.start('Why is the sky blue?');
    if (pauseAt !== null) {
        await tick(startedAt + pauseAt - performance.now());
        if (runtime.status === 'live') await runtime.interrupt();
        await tick(PAUSE_MS);
        if (runtime.status === 'interrupted') runtime.resume();
    }
    const said = () => runtime.journal().filter(entry => entry.type === 'speech.end').length;
    for (let waited = 0; waited < 200_000 && (said() < SPOKEN || !runtime.journal().some(entry => entry.type === 'run.finished')); waited += 1_000) {
        await tick(1_000);
    }
    const journal = runtime.journal();
    const result = {
        degraded: journal.filter(entry => entry.type === 'voice.degraded').map(entry => entry.reason),
        finishedAt: journal.find(entry => entry.type === 'run.finished')?.at ?? null,
        voiceEndedAt: journal.filter(entry => entry.type === 'speech.end').at(-1)?.at ?? null,
        said: said()
    };
    await runtime.stop();
    runtime = null;
    return result;
}

describe('a Pause and a Play early in a reading', () => {
    for (const kind of Object.keys(VOICES)) {
        it(`keep the words and the ${kind} voice together, wherever in the first 12 s they fall`, async () => {
            const parted = [];
            for (const pauseAt of PAUSES_AT) {
                const result = await read(kind, pauseAt);
                const late = result.voiceEndedAt - result.finishedAt;
                if (result.degraded.length > 0 || result.said < SPOKEN || result.finishedAt === null || late > 1_000) {
                    parted.push(`paused at ${pauseAt} ms: gave up on the voice [${result.degraded.join(', ')}], voice ended ${Math.round(late)} ms after the reading, ${result.said}/${SPOKEN} passages said`);
                }
            }
            expect(parted).toEqual([]);
        });
    }
});
