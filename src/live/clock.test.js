/**
 * A clock the tests own.
 *
 * Anything in the live layer that waits does so on a clock it is handed, never
 * on the wall. The real clock is a thin wrapper; the virtual clock advances
 * only when told to, so a test can say "two seconds pass" and know exactly
 * which events happened, in which order, without a single real delay.
 */
import { describe, expect, it } from 'vitest';
import { createRealClock, createVirtualClock } from './clock.js';

describe('the virtual clock', () => {
    it('starts where it is told and moves only when advanced', async () => {
        const clock = createVirtualClock(100);
        expect(clock.now()).toBe(100);
        await clock.advance(250);
        expect(clock.now()).toBe(350);
    });

    it('fires timers in time order, and in the order set when the times are equal', async () => {
        const clock = createVirtualClock();
        const seen = [];
        clock.setTimer(() => seen.push('b'), 20);
        clock.setTimer(() => seen.push('a'), 10);
        clock.setTimer(() => seen.push('c1'), 30);
        clock.setTimer(() => seen.push('c2'), 30);
        await clock.advance(100);
        expect(seen).toEqual(['a', 'b', 'c1', 'c2']);
    });

    it('does not fire a timer that is not yet due', async () => {
        const clock = createVirtualClock();
        let fired = false;
        clock.setTimer(() => { fired = true; }, 50);
        await clock.advance(49);
        expect(fired).toBe(false);
        await clock.advance(1);
        expect(fired).toBe(true);
    });

    it('fires a timer that a timer sets, when it falls inside the same advance', async () => {
        const clock = createVirtualClock();
        const seen = [];
        clock.setTimer(() => {
            seen.push(clock.now());
            clock.setTimer(() => seen.push(clock.now()), 15);
        }, 10);
        await clock.advance(30);
        expect(seen).toEqual([10, 25]);
    });

    it('lets a cancelled timer go', async () => {
        const clock = createVirtualClock();
        let fired = false;
        const cancel = clock.setTimer(() => { fired = true; }, 10);
        cancel();
        await clock.advance(50);
        expect(fired).toBe(false);
        expect(clock.pending()).toBe(0);
    });

    it('resolves a sleep at its time, and runs what awaits it before the next timer', async () => {
        const clock = createVirtualClock();
        const seen = [];
        (async () => {
            await clock.sleep(10);
            seen.push('after sleep 10');
            await clock.sleep(10);
            seen.push('after sleep 20');
        })();
        clock.setTimer(() => seen.push('timer 15'), 15);
        await clock.advance(30);
        expect(seen).toEqual(['after sleep 10', 'timer 15', 'after sleep 20']);
    });

    it('rejects a sleep when its signal aborts, and leaves nothing pending', async () => {
        const clock = createVirtualClock();
        const controller = new AbortController();
        const sleeping = clock.sleep(1000, { signal: controller.signal });
        expect(clock.pending()).toBe(1);
        controller.abort();
        await expect(sleeping).rejects.toMatchObject({ name: 'AbortError' });
        expect(clock.pending()).toBe(0);
    });

    it('rejects at once for a signal that was already aborted', async () => {
        const clock = createVirtualClock();
        const controller = new AbortController();
        controller.abort();
        await expect(clock.sleep(10, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
        expect(clock.pending()).toBe(0);
    });

    it('runs everything that is set, however far ahead, with runAll', async () => {
        const clock = createVirtualClock();
        let last = 0;
        clock.setTimer(() => { last = clock.now(); clock.setTimer(() => { last = clock.now(); }, 5_000); }, 1_000);
        await clock.runAll();
        expect(last).toBe(6_000);
        expect(clock.pending()).toBe(0);
    });

    it('refuses a negative or non-finite delay rather than guessing', () => {
        const clock = createVirtualClock();
        for (const bad of [-1, NaN, Infinity, '5', undefined]) {
            expect(() => clock.setTimer(() => {}, bad), String(bad)).toThrow(RangeError);
        }
    });

    it('gives up on a loop of timers that never stops, with runAll', async () => {
        const clock = createVirtualClock();
        const again = () => clock.setTimer(again, 1);
        again();
        await expect(clock.runAll({ limit: 500 })).rejects.toThrow(/did not settle/u);
    });
});

describe('the real clock', () => {
    it('reports time that moves forward, and sets and cancels timers', async () => {
        const clock = createRealClock();
        const a = clock.now();
        await clock.sleep(5);
        expect(clock.now()).toBeGreaterThanOrEqual(a + 4);
        let fired = false;
        const cancel = clock.setTimer(() => { fired = true; }, 5);
        cancel();
        await clock.sleep(15);
        expect(fired).toBe(false);
    });

    it('rejects a sleep when its signal aborts', async () => {
        const clock = createRealClock();
        const controller = new AbortController();
        const sleeping = clock.sleep(10_000, { signal: controller.signal });
        controller.abort();
        await expect(sleeping).rejects.toMatchObject({ name: 'AbortError' });
    });
});
