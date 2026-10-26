/**
 * A sealed Current whose events the reducer refused does not play as if whole.
 *
 * The field trace (Edge 155, a stored card re-opened): the reducer refused the
 * Current's later passages (`run.failed code=TOO_MANY_REFUSALS … UNKNOWN_SEGMENT`),
 * the reading went on, and at the first passage whose words never reached the
 * voice the clock waited for speech that could not come and stood down
 * (`voice.degraded reason=voice-did-not-start segmentId=beat-20 chars=0`). Here
 * one beat's events are lost on the way to the reducer, which then refuses the
 * rest: the card still plays the whole sealed Current, the journal names what
 * was refused and which passages were not spoken, the stage says how many, and
 * a passage with no words for the voice is timed at reading pace, never waited on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../core/player.js';
import { validateRiseCurrent } from '../core/rise-current.js';
import { createRealClock } from './clock.js';
import { createLiveRuntime } from './runtime.js';
import { createMcpAppAdapter } from './adapters/mcp-app.js';
import { currentToEvents } from './adapters/current-events.js';
import { describeStatus } from './host/controls.js';
import { createSyntheticVoice } from './voices/synthetic.js';
import { SKY_PREMIUM_EDUCATIONAL } from './fixtures/sky-premium-educational.js';
import { SETTLED_MATHS } from '../test/settled-maths.js';

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

/** The card's run of the Sky Current, with the events of one beat lost before the reducer. */
function open(lostBeat) {
    const clock = createRealClock();
    const events = currentToEvents(SKY_PREMIUM_EDUCATIONAL).filter(event => event.body.segmentId !== lostBeat);
    const adapter = createMcpAppAdapter({
        port: { onCurrent: () => () => {}, canSample: () => false }, clock, host: 'https://host.example',
        admittedEvents: events, admittedCurrent: SKY_PREMIUM_EDUCATIONAL
    });
    const shown = new Set();
    const given = [];
    const compiled = { atoms: 0 };
    runtime = createLiveRuntime({
        adapter, clock, maths: SETTLED_MATHS,
        createPlayer: session => {
            compiled.atoms = session.atoms.length;
            const player = new Player(session);
            player.on('atom', ({ index }) => shown.add(index));
            return player;
        },
        voices: {
            create: () => {
                const voice = createSyntheticVoice({ clock, msPerChar: 20 });
                const enqueue = voice.enqueue.bind(voice);
                voice.enqueue = segment => { given.push(segment.id); return enqueue(segment); };
                return voice;
            }
        },
        host: { present: async () => {}, dismiss: () => {} }
    });
    return { shown, given, compiled };
}

const entries = type => runtime.journal().filter(entry => entry.type === type);

async function until(test, limitMs = 300_000) {
    for (let waited = 0; waited < limitMs && !test(); waited += 100) await tick(100);
}

describe('a sealed Current that lost events on the way to the reducer', () => {
    const sealed = validateRiseCurrent(SKY_PREMIUM_EDUCATIONAL);
    const spoken = sealed.segments.filter(segment => segment.spoken !== null).map(segment => segment.id);
    // A said beat goes missing; the beat stream then refuses what follows it (BEAT_ID), as the field's did.
    const lostFrom = 2;
    const missing = spoken[lostFrom];
    const next = `beat-${Number(missing.slice('beat-'.length)) + 1}`;

    it('plays whole, names what was refused and the passages not spoken, and says how many', async () => {
        open(missing);
        await runtime.start('Why is the sky blue?');
        await until(() => runtime.status === 'ended');

        expect(runtime.status).toBe('ended');
        const [failed] = entries('run.failed');
        expect(failed).toEqual(expect.objectContaining({ role: 'main', code: 'TOO_MANY_REFUSALS' }));
        expect(failed.refused).toHaveLength(8);
        expect(failed.refused[0]).toEqual({ code: 'BEAT_ID', segmentId: next });
        expect(failed.lost).toEqual(spoken.slice(lostFrom, lostFrom + 8));
        const lost = spoken.length - lostFrom;
        expect(failed.passages).toBe(lost);
        expect(runtime.snapshot().main.lost).toBe(lost);
        expect(describeStatus(runtime.snapshot(), { audible: true, dive: false })).toContain(`${lost} passages could not be spoken.`);
    });

    it('times a passage the voice was never given at reading pace, and never waits on it for speech', async () => {
        const { shown, given, compiled } = open(missing);
        await runtime.start('Why is the sky blue?');
        await until(() => runtime.status === 'ended');

        expect(entries('voice.degraded')).toEqual([]);
        expect(given).toEqual(spoken.slice(0, lostFrom));
        // Every atom of the sealed Current was shown, the lost passages' too.
        expect(compiled.atoms).toBeGreaterThan(0);
        expect(shown.size).toBe(compiled.atoms);
    });
});
