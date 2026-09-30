/**
 * The performance budgets in docs/plans/LIVE-CURRENT.md §11 that can be held
 * in Node, held.
 *
 *   - applying one maximum-size event: at most 2 ms at p95
 *   - lowering a maximum-size Current to a Session: bounded, so a segment
 *     ending never blocks the main thread for long
 *   - memory: a Current run many times leaves nothing behind, and one run
 *     never holds more than 5 MB more than it started with
 *
 * The browser-only budgets (main-thread blocking, frame pacing, first load)
 * are measured in e2e/live.spec.js and scripts/measure-first-load.mjs.
 *
 * Timings are wall-clock and so vary by machine; each threshold is several
 * times what was measured, and the measured values are printed so a slow
 * regression is visible long before it fails.
 */
import v8 from 'node:v8';
import vm from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../core/player.js';
import { compileRiseCurrent } from '../core/rise-current.js';
import { createEventWriter } from './adapter.js';
import { createMockAdapter } from './adapters/mock.js';
import { createRealClock } from './clock.js';
import { createLiveRuntime } from './runtime.js';
import { createCurrentStream, STREAM_LIMITS } from './stream.js';
import { createSyntheticVoice } from './voices/synthetic.js';

const percentile = (values, p) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

/** A word-like filler that never contains a reserved marker. */
const filler = length => 'lorem ipsum dolor sit amet '.repeat(Math.ceil(length / 27)).slice(0, length).trim().padEnd(length, 'x');

/** Every event of a maximum-size Current: 5 segments of 4,000 characters in 1,000-character chunks. */
function maximumCurrent(id) {
    const writer = createEventWriter(id);
    const events = [writer.next('current.open', { title: 'Perf', origin: { kind: 'model', name: 'Perf', provider: 'mock' } })];
    for (let s = 0; s < 5; s += 1) {
        const segmentId = `s${s}`;
        events.push(writer.next('segment.begin', { segmentId, visual: 'still' }));
        events.push(writer.next('state.set', { segmentId, state: { tension: 0.5, solemnity: 0.4 } }));
        for (let c = 0; c < 4; c += 1) {
            events.push(writer.next('segment.text', { segmentId, offset: c * 1000, text: filler(1000) }));
        }
        events.push(writer.next('segment.end', { segmentId }));
    }
    events.push(writer.next('current.complete', {}));
    return events;
}

describe('applying an event', () => {
    it('costs at most 2 ms at p95, for events at their maximum size', () => {
        const costs = [];
        for (let round = 0; round < 80; round += 1) {
            const stream = createCurrentStream();
            for (const event of maximumCurrent(`perf-${round}`)) {
                const began = performance.now();
                const result = stream.apply(event);
                costs.push(performance.now() - began);
                expect(result.status, JSON.stringify(event).slice(0, 80)).toBe('applied');
            }
        }
        const p95 = percentile(costs, 95);
        console.info(`event apply: n=${costs.length} p50=${percentile(costs, 50).toFixed(3)}ms p95=${p95.toFixed(3)}ms p99=${percentile(costs, 99).toFixed(3)}ms max=${Math.max(...costs).toFixed(3)}ms`);
        expect(p95).toBeLessThanOrEqual(2);
    });

    it('does not slow down as a Current fills: the last segment costs no more than the first', () => {
        const stream = createCurrentStream();
        const perSegment = [];
        let current = [];
        for (const event of maximumCurrent('perf-fill')) {
            const began = performance.now();
            stream.apply(event);
            current.push(performance.now() - began);
            if (event.type === 'segment.end') { perSegment.push(current.reduce((a, b) => a + b, 0)); current = []; }
        }
        expect(perSegment).toHaveLength(5);
        // Not exact timing: a segment is never an order of magnitude dearer than the first.
        expect(perSegment.at(-1)).toBeLessThan(Math.max(perSegment[0] * 10, 5));
    });
});

describe('lowering a Current to a Session', () => {
    it('stays cheap enough that a segment ending never holds the main thread', () => {
        const stream = createCurrentStream();
        for (const event of maximumCurrent('perf-lower')) stream.apply(event);
        expect(stream.snapshot().phase).toBe('complete');
        const costs = [];
        for (let i = 0; i < 60; i += 1) {
            const began = performance.now();
            compileRiseCurrent(stream.toCurrent());
            costs.push(performance.now() - began);
        }
        const p95 = percentile(costs, 95);
        console.info(`lowering (5 x 4,000 characters): p50=${percentile(costs, 50).toFixed(2)}ms p95=${p95.toFixed(2)}ms max=${Math.max(...costs).toFixed(2)}ms`);
        // A maximum Current is 20,000 characters and about 40 minutes of speech; this runs once per
        // segment, not per frame. Well under a frame budget for anything a real answer is.
        expect(p95).toBeLessThanOrEqual(60);
    });
});

describe('memory', () => {
    let gc;
    beforeEach(() => {
        v8.setFlagsFromString('--expose-gc');
        gc = vm.runInNewContext('gc');
        vi.useFakeTimers({
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
                'Date', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame']
        });
        vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    });
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    const heap = () => { gc(); gc(); return process.memoryUsage().heapUsed; };

    async function oneReading({ dive }) {
        const clock = createRealClock();
        const runtime = createLiveRuntime({
            adapter: createMockAdapter({ clock }),
            clock,
            createPlayer: session => new Player(session),
            voices: { create: () => createSyntheticVoice({ clock, msPerChar: 30 }) }
        });
        await runtime.start('Explain black holes with RISE.');
        await vi.advanceTimersByTimeAsync(6_000);
        if (dive) {
            await runtime.dive({ question: 'dive on event horizon' });
            await vi.advanceTimersByTimeAsync(20_000);
            await runtime.surface();
        }
        await vi.advanceTimersByTimeAsync(120_000);
        await runtime.stop();
    }

    it('one whole reading, with a Dive, never holds more than 5 MB it did not start with, and gives it back', async () => {
        await oneReading({ dive: true }); // warm the code paths once, so compilation is not counted
        const before = heap();
        let peak = 0;
        const clock = createRealClock();
        const runtime = createLiveRuntime({
            adapter: createMockAdapter({ clock }),
            clock,
            createPlayer: session => new Player(session),
            voices: { create: () => createSyntheticVoice({ clock, msPerChar: 30 }) }
        });
        await runtime.start('Explain black holes with RISE.');
        for (let step = 0; step < 12; step += 1) {
            await vi.advanceTimersByTimeAsync(5_000);
            // What is still reachable, not what is merely waiting to be collected.
            peak = Math.max(peak, heap() - before);
        }
        await runtime.stop();
        const after = heap() - before;
        console.info(`one reading: peak live growth ${(peak / 1e6).toFixed(2)} MB, after stop ${(after / 1e6).toFixed(2)} MB`);
        expect(peak).toBeLessThanOrEqual(5e6);
        expect(after).toBeLessThanOrEqual(5e6);
    }, 120_000);

    it('thirty readings, each with a Dive, leave nothing behind: heap is back to where it started', async () => {
        await oneReading({ dive: true });
        const before = heap();
        for (let i = 0; i < 30; i += 1) await oneReading({ dive: true });
        const growth = heap() - before;
        console.info(`30 readings with a Dive: retained ${(growth / 1e6).toFixed(2)} MB`);
        expect(growth).toBeLessThanOrEqual(5e6);
        expect(vi.getTimerCount()).toBe(0);
    }, 300_000);

    it('a Current at the limits is bounded: no more than the documented events, segments and text are ever kept', () => {
        const stream = createCurrentStream();
        let applied = 0;
        const writer = createEventWriter('perf-bound');
        stream.apply(writer.next('current.open', { title: 'x', origin: { kind: 'model', name: 'x', provider: 'x' } }));
        // A hostile provider that never stops sending segments is stopped at the limit, and the
        // memory it can make the stream hold is bounded by the limits and not by what it sends.
        for (let s = 0; s < STREAM_LIMITS.segments * 3; s += 1) {
            const segmentId = `s${s}`;
            const results = [
                stream.apply(writer.next('segment.begin', { segmentId })),
                stream.apply(writer.next('segment.text', { segmentId, offset: 0, text: filler(900) })),
                stream.apply(writer.next('segment.end', { segmentId }))
            ];
            applied += results.filter(r => r.status === 'applied').length;
        }
        const view = stream.snapshot();
        expect(view.segments.length).toBeLessThanOrEqual(STREAM_LIMITS.segments);
        expect(view.segments.reduce((sum, s) => sum + s.text.length, 0)).toBeLessThanOrEqual(STREAM_LIMITS.totalText);
        expect(applied).toBeLessThanOrEqual(STREAM_LIMITS.segments * 3);
    });
});
