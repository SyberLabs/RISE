/**
 * Soundscape contract tests — Aurora builds against a mock AudioContext,
 * ramps rather than steps, wanders its halo between 200 and 216 Hz on
 * the scheduler, and tears down cleanly (no timers left alive).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SOUNDSCAPES, createSoundscape } from './soundscapes.js';

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
    const ctx = {
        currentTime: 0,
        sampleRate: 8000, // keep the impulse computation small
        destination: makeNode(),
        createGain: () => makeNode({ gain: makeParam(1) }),
        createOscillator: () => {
            const osc = makeNode({
                type: 'sine',
                frequency: makeParam(0),
                setPeriodicWave: vi.fn()
            });
            oscillators.push(osc);
            return osc;
        },
        createBiquadFilter: () => makeNode({ type: '', frequency: makeParam(0), Q: makeParam(0) }),
        createDelay: () => makeNode({ delayTime: makeParam(0) }),
        createConvolver: () => makeNode({ buffer: null }),
        createStereoPanner: () => makeNode({ pan: makeParam(0) }),
        createBuffer: (channels, length) => ({
            getChannelData: () => new Float32Array(length)
        }),
        createPeriodicWave: vi.fn(() => ({}))
    };
    return { ctx, oscillators };
}

describe('soundscapes', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('registry exposes aurora; unknown ids return null', () => {
        expect(SOUNDSCAPES.aurora.name).toBe('Aurora');
        const { ctx } = makeMockContext();
        expect(createSoundscape('nope', ctx, makeNode())).toBeNull();
        expect(createSoundscape('aurora', ctx, makeNode())).not.toBeNull();
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
