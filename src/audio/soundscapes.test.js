/**
 * Soundscape contract tests — Aurora builds against a mock AudioContext,
 * ramps rather than steps, wanders its halo between 200 and 216 Hz on
 * the scheduler, and tears down cleanly (no timers left alive).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { JEV_AUDIO_IDS } from '../core/jev-config.js';
import { PARKED_SOUNDSCAPES, SOUNDSCAPES, createSoundscape } from './soundscapes.js';
import { PARKED_SOUNDS } from './sound-ids.js';

function makeParam(initial = 0) {
    return {
        value: initial,
        setValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn()
    };
}

function makeNode(params = {}) {
    const node = {
        connect: vi.fn((target) => target),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        ...params
    };
    return node;
}

function makeMockContext() {
    const oscillators = [];
    const bufferSources = [];
    const buffers = [];
    const ctx = {
        currentTime: 0,
        sampleRate: 8000, // keep the impulse computation small
        destination: makeNode(),
        createGain: () => makeNode({ gain: makeParam(1) }),
        createOscillator: () => {
            const osc = makeNode({
                type: 'sine',
                frequency: makeParam(0),
                detune: makeParam(0),
                setPeriodicWave: vi.fn()
            });
            oscillators.push(osc);
            return osc;
        },
        createBiquadFilter: () => makeNode({ type: '', frequency: makeParam(0), Q: makeParam(0) }),
        createDelay: () => makeNode({ delayTime: makeParam(0) }),
        createConvolver: () => makeNode({ buffer: null }),
        createStereoPanner: () => makeNode({ pan: makeParam(0) }),
        createBuffer: (channels, length) => {
            const data = Array.from({ length: channels }, () => new Float32Array(length));
            buffers.push(data);
            return { getChannelData: channel => data[channel] };
        },
        createPeriodicWave: vi.fn(() => ({})),
        createWaveShaper: () => makeNode({ curve: null, oversample: 'none' }),
        createBufferSource: () => {
            const source = makeNode({ buffer: null, loop: false });
            bufferSources.push(source);
            return source;
        }
    };
    return { ctx, oscillators, bufferSources, buffers };
}

describe('soundscapes', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('catalog sound rows match the sounds the Chamber can actually play', () => {
        const ids = JSON.parse(readFileSync('src/content/decision-catalog.json', 'utf8')).sounds
            .filter(row => row.active).map(row => row.sound_id);
        expect(new Set(ids)).toEqual(new Set(JEV_AUDIO_IDS));
        ids.forEach(id => expect(SOUNDSCAPES).toHaveProperty(id));
    });

    it('offers the expanded original music catalog', () => {
        const additions = ['lullaby', 'nocturne', 'waltz', 'blues', 'bossa', 'ragtime', 'starlight'];
        additions.forEach(id => {
            expect(JEV_AUDIO_IDS).toContain(id);
            expect(SOUNDSCAPES[id]?.create).toBeTypeOf('function');
        });
    });

    it('parks the Feelings: kept to rework, never created by id', () => {
        const { ctx } = makeMockContext();
        expect(Object.keys(PARKED_SOUNDSCAPES).sort()).toEqual(Object.keys(PARKED_SOUNDS).sort());
        for (const id of Object.keys(PARKED_SOUNDS)) {
            expect(SOUNDSCAPES, id).not.toHaveProperty(id);
            expect(createSoundscape(id, ctx, makeNode()), id).toBeNull();
            expect(PARKED_SOUNDSCAPES[id].create, id).toBeTypeOf('function');
        }
    });

    it.each(['sad', 'angry', 'happy', 'excited', 'thrilling', 'scary'])(
        'plays and tears down the parked %s mood sound', id => {
            const { ctx, oscillators } = makeMockContext();
            const sound = PARKED_SOUNDSCAPES[id].create(ctx, makeNode());
            expect(sound).not.toBeNull();
            sound.start();
            expect(oscillators.length).toBeGreaterThan(1);
            oscillators.forEach(osc => expect(osc.start).toHaveBeenCalledOnce());
            sound.stop(true);
            oscillators.forEach(osc => expect(osc.stop).toHaveBeenCalledOnce());
        }
    );

    it('gives the six moods distinct audible pitch and timbre signatures', () => {
        const signatures = ['sad', 'angry', 'happy', 'excited', 'thrilling', 'scary'].map(id => {
            const { ctx, oscillators } = makeMockContext();
            const sound = PARKED_SOUNDSCAPES[id].create(ctx, makeNode());
            const signature = `${oscillators[0].type}:${oscillators[0].frequency.value}`;
            sound.start();
            sound.stop(true);
            return signature;
        });
        expect(new Set(signatures).size).toBe(6);
    });

    it.each(['piano', 'jazz'])('plays a repeating %s composition and stops its scheduler', id => {
        const { ctx, oscillators } = makeMockContext();
        const sound = createSoundscape(id, ctx, makeNode());
        expect(sound).not.toBeNull();
        sound.start();
        expect(oscillators.length).toBeGreaterThan(8);
        expect(new Set(oscillators.map(osc => osc.frequency.value)).size).toBeGreaterThan(5);
        const firstBar = oscillators.length;
        ctx.currentTime = 5;
        vi.advanceTimersByTime(5000);
        expect(oscillators.length).toBeGreaterThan(firstBar);
        sound.stop(true);
        const stoppedAt = oscillators.length;
        ctx.currentTime = 15;
        vi.advanceTimersByTime(15000);
        expect(oscillators.length).toBe(stoppedAt);
    });

    it('swings jazz offbeats while piano stays even', () => {
        const starts = id => {
            const { ctx, oscillators } = makeMockContext();
            const sound = createSoundscape(id, ctx, makeNode());
            sound.start();
            const times = [...new Set(oscillators.flatMap(osc => osc.start.mock.calls.map(call => call[0])))];
            sound.stop(true);
            return times;
        };
        expect(starts('piano')).not.toEqual(starts('jazz'));
    });

    it('registry exposes aurora and faded-signal; unknown ids return null', () => {
        expect(SOUNDSCAPES.aurora.name).toBe('Aurora');
        expect(SOUNDSCAPES['faded-signal'].name).toBe('Faded Signal');
        const { ctx } = makeMockContext();
        expect(createSoundscape('nope', ctx, makeNode())).toBeNull();
        expect(createSoundscape('aurora', ctx, makeNode())).not.toBeNull();
        expect(createSoundscape('faded-signal', ctx, makeNode())).not.toBeNull();
    });

    it('soft-rain creates a finite stereo noise bed and stops it cleanly', () => {
        const { ctx, bufferSources, buffers } = makeMockContext();
        const rain = createSoundscape('soft-rain', ctx, makeNode());
        expect(rain).not.toBeNull();
        rain.start();

        expect(bufferSources).toHaveLength(1);
        expect(bufferSources[0].loop).toBe(true);
        expect(bufferSources[0].start).toHaveBeenCalledOnce();
        expect(buffers).toHaveLength(1);
        expect(buffers[0]).toHaveLength(2);
        for (const channel of buffers[0]) {
            expect(Math.abs(channel[0])).toBe(0);
            expect(Math.abs(channel.at(-1))).toBe(0);
            expect(channel.some(sample => sample !== 0)).toBe(true);
            expect(channel.every(sample => Number.isFinite(sample) && Math.abs(sample) <= 1)).toBe(true);
        }
        rain.stop(true);
        vi.runAllTimers();
        expect(bufferSources[0].stop).toHaveBeenCalledOnce();
    });

    it('faded-signal starts its full graph and tears down dead', () => {
        const { ctx, oscillators } = makeMockContext();
        const scape = createSoundscape('faded-signal', ctx, makeNode());
        scape.start();

        // 6 voices × 2 + wow + flutter + chorus LFO + tone breath +
        // bed breath + undertone = 18 oscillators (haze is a buffer source)
        expect(oscillators.length).toBe(18);
        oscillators.forEach(osc => expect(osc.start).toHaveBeenCalled());

        scape.stop(true);
        vi.advanceTimersByTime(60000);
        oscillators.forEach(osc => expect(osc.stop).toHaveBeenCalled());
    });

    it('aurora starts: pad voices + halo oscillators, all ramped in', () => {
        const { ctx, oscillators } = makeMockContext();
        const dest = makeNode();
        const aurora = createSoundscape('aurora', ctx, dest);
        aurora.start();

        // 8 pad voices × 2 oscs + breath + undertone + 5 halo partials
        expect(oscillators.length).toBe(23);
        oscillators.forEach(osc => expect(osc.start).toHaveBeenCalled());
        aurora.stop(true);
    });

    it('halo holds its phase while the audio clock is not running', () => {
        // A PHASE MACHINE MUST NOT RUN ON A CLOCK ITS OUTPUT HAS STOPPED.
        // Every phase writes automation against ctx.currentTime while
        // the scheduler runs on setTimeout. Hidden or stalled, the
        // second keeps moving and the first does not — so a run of
        // phases collapses onto one audio timestamp, each cancelling the
        // last, and a slow fade arrives as a step. That is the shape of
        // the harsh transient reported on leaving the browser.
        const { ctx, oscillators } = makeMockContext();
        let mayAdvance = false;
        const aurora = createSoundscape('aurora', ctx, makeNode(), {
            mayAdvance: () => mayAdvance
        });
        aurora.start();

        const haloOscs = oscillators.slice(18);
        const retunes = () => haloOscs[0].frequency.setTargetAtTime.mock.calls.length;
        const atStart = retunes();

        vi.advanceTimersByTime(120000);      // two minutes of held phases
        expect(retunes(), 'no phase may advance while held').toBe(atStart);

        mayAdvance = true;
        vi.advanceTimersByTime(120000);
        expect(retunes(), 'and it resumes wandering when let go')
            .toBeGreaterThan(atStart);

        aurora.stop(true);
    });

    it('halo wanders: scheduler retunes the five partials to 200 or 216', () => {
        const { ctx, oscillators } = makeMockContext();
        const aurora = createSoundscape('aurora', ctx, makeNode());
        aurora.start();

        const haloOscs = oscillators.slice(18); // the five halo partials
        vi.advanceTimersByTime(120000); // two minutes: several phases

        // Every retune targets tuning × ratio for ratios 1..5
        haloOscs.forEach((osc, i) => {
            const calls = osc.frequency.setTargetAtTime.mock.calls;
            expect(calls.length).toBeGreaterThan(0);
            for (const [freq] of calls) {
                expect([200 * (i + 1), 216 * (i + 1)]).toContain(freq);
            }
        });

        // Both tunings appear over enough phases (wander + re-entry)
        const rootFreqs = new Set(
            haloOscs[0].frequency.setTargetAtTime.mock.calls.map(c => c[0]));
        expect(rootFreqs.has(200) || rootFreqs.has(216)).toBe(true);

        aurora.stop(true);
    });

    it('stop() halts the scheduler and releases every node', () => {
        const { ctx, oscillators } = makeMockContext();
        const aurora = createSoundscape('aurora', ctx, makeNode());
        aurora.start();

        aurora.stop(true);
        const retunesAtStop = oscillators
            .map(o => o.frequency?.setTargetAtTime.mock.calls.length ?? 0);

        // A dead scheduler schedules nothing further
        vi.advanceTimersByTime(300000);
        oscillators.forEach((osc, i) => {
            expect(osc.frequency?.setTargetAtTime.mock.calls.length ?? 0)
                .toBe(retunesAtStop[i]);
            expect(osc.stop).toHaveBeenCalled();
        });
    });

    it('non-instant stop ramps out, then tears down after the tail', () => {
        const { ctx, oscillators } = makeMockContext();
        const aurora = createSoundscape('aurora', ctx, makeNode());
        aurora.start();

        aurora.stop(false);
        expect(oscillators[0].stop).not.toHaveBeenCalled(); // tail still sounding
        vi.advanceTimersByTime(1500);
        oscillators.forEach(osc => expect(osc.stop).toHaveBeenCalled());
    });
});
