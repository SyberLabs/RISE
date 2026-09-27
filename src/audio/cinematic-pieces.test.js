import { afterEach, describe, expect, it, vi } from 'vitest';
import { CINEMATIC_SOUNDSCAPES } from './cinematic-pieces.js';

function param(value = 0) {
    return {
        value,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn()
    };
}

function mockContext() {
    const oscillators = [];
    const nodes = [];
    const node = (extra = {}) => {
        const result = { connect: vi.fn(target => target), disconnect: vi.fn(), ...extra };
        nodes.push(result);
        return result;
    };
    const ctx = {
        currentTime: 0,
        destination: node(),
        createGain: () => node({ gain: param(1) }),
        createOscillator: () => {
            const osc = node({ type: 'sine', frequency: param(), start: vi.fn(), stop: vi.fn() });
            oscillators.push(osc);
            return osc;
        },
        createBiquadFilter: () => node({ type: 'lowpass', frequency: param(), Q: param() }),
        createStereoPanner: () => node({ pan: param() })
    };
    return { ctx, oscillators, nodes };
}

describe('cinematic soundscapes', () => {
    afterEach(() => vi.useRealTimers());

    it('provides six named, described, distinct reading beds', () => {
        expect(Object.keys(CINEMATIC_SOUNDSCAPES)).toEqual([
            'wonder', 'mystery', 'chase', 'triumph', 'haunted', 'starlight'
        ]);
        for (const entry of Object.values(CINEMATIC_SOUNDSCAPES)) {
            expect(entry.name).toBeTruthy();
            expect(entry.description).toBeTruthy();
            expect(typeof entry.create).toBe('function');
        }

        const signatures = Object.values(CINEMATIC_SOUNDSCAPES).map(entry => {
            const { ctx, oscillators } = mockContext();
            const sound = entry.create(ctx, ctx.destination, { mayAdvance: () => true });
            sound.start();
            const signature = oscillators.map(osc => `${osc.type}:${osc.frequency.value}`).join('|');
            sound.stop();
            return signature;
        });
        expect(new Set(signatures).size).toBe(6);
    });

    it.each(Object.entries(CINEMATIC_SOUNDSCAPES))('%s starts and fully releases its sound graph', (_id, entry) => {
        const { ctx, oscillators, nodes } = mockContext();
        const sound = entry.create(ctx, ctx.destination);
        sound.start();
        expect(oscillators.length).toBeGreaterThan(0);
        expect(oscillators.every(osc => osc.start.mock.calls.length === 1)).toBe(true);
        sound.stop(true);
        expect(oscillators.every(osc => osc.stop.mock.calls.length > 0)).toBe(true);
        expect(nodes.slice(1).every(node => node.disconnect.mock.calls.length > 0)).toBe(true);
    });

    it('holds scheduled musical changes while mayAdvance is false and resumes afterward', () => {
        vi.useFakeTimers();
        let allowed = false;
        const { ctx, oscillators } = mockContext();
        const sound = CINEMATIC_SOUNDSCAPES.starlight.create(ctx, ctx.destination, {
            mayAdvance: () => allowed
        });
        sound.start();
        const initial = oscillators.length;
        vi.advanceTimersByTime(4000);
        expect(oscillators).toHaveLength(initial);
        allowed = true;
        vi.advanceTimersByTime(1200);
        expect(oscillators.length).toBeGreaterThan(initial);
        sound.stop(true);
        const stoppedAt = oscillators.length;
        vi.advanceTimersByTime(10000);
        expect(oscillators).toHaveLength(stoppedAt);
    });

    it('keeps the Wonder melody inside a major pentatonic scale', () => {
        vi.useFakeTimers();
        const { ctx, oscillators } = mockContext();
        const sound = CINEMATIC_SOUNDSCAPES.wonder.create(ctx, ctx.destination);
        sound.start();

        for (let bar = 1; bar < 9; bar += 1) {
            ctx.currentTime = bar * 2.6;
            vi.advanceTimersByTime(2600);
        }

        const melody = oscillators.slice(3).map(osc => {
            const semitones = 12 * Math.log2(osc.frequency.value / 130.81);
            return ((Math.round(semitones) % 12) + 12) % 12;
        });
        expect(melody).toEqual([0, 2, 4, 7, 9, 7, 4, 2, 0]);
        sound.stop(true);
    });

    it('makes stop idempotent and prevents later scheduling', () => {
        vi.useFakeTimers();
        const { ctx, oscillators, nodes } = mockContext();
        const sound = CINEMATIC_SOUNDSCAPES.chase.create(ctx, ctx.destination);
        sound.start();
        sound.stop(true);
        sound.stop(true);
        const stoppedAt = oscillators.length;
        vi.advanceTimersByTime(10000);
        expect(oscillators).toHaveLength(stoppedAt);
        expect(nodes.slice(1).every(node => node.disconnect.mock.calls.length > 0)).toBe(true);
    });

    it('fades on ordinary stop and lets an immediate stop finish that release early', () => {
        vi.useFakeTimers();
        const { ctx, nodes } = mockContext();
        const sound = CINEMATIC_SOUNDSCAPES.wonder.create(ctx, ctx.destination);
        sound.start();
        sound.stop();
        expect(nodes[1].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 1.25);
        sound.stop(true);
        expect(nodes.slice(1).every(node => node.disconnect.mock.calls.length > 0)).toBe(true);
        vi.advanceTimersByTime(2000);
        expect(vi.getTimerCount()).toBe(0);
    });
});
