/**
 * Clocks for the live layer.
 *
 * Whatever in `src/live` waits does so on a clock it is handed, never on the
 * wall, so the same code runs in a browser and in a test that decides when time
 * passes. A clock is `{ now(), setTimer(fn, ms) -> cancel, sleep(ms, {signal}) }`.
 */

const abortError = () => {
    const error = new Error('Aborted');
    error.name = 'AbortError';
    return error;
};

function delay(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) {
        throw new RangeError(`A delay is a finite number of milliseconds from 0, not ${String(ms)}`);
    }
    return ms;
}

export function createRealClock() {
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const setTimer = (fn, ms) => {
        const id = setTimeout(fn, delay(ms));
        return () => clearTimeout(id);
    };
    const sleep = (ms, { signal } = {}) => new Promise((resolve, reject) => {
        if (signal?.aborted) { reject(abortError()); return; }
        let cancel = null;
        const onAbort = () => { cancel?.(); reject(abortError()); };
        cancel = setTimer(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
    return { now, setTimer, sleep };
}

/** Let everything that is waiting on an already-settled promise run. */
async function flush() {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

/**
 * A clock that moves only when it is advanced. Timers fire in time order, then
 * in the order they were set. After each one, whatever was waiting on it (an
 * `await clock.sleep()`, say) runs before the next fires, which is what makes
 * a test's account of "what happened, in what order" the real one.
 */
export function createVirtualClock(start = 0) {
    let time = start;
    let counter = 0;
    const timers = new Map();

    const setTimer = (fn, ms) => {
        const id = counter;
        counter += 1;
        timers.set(id, { at: time + delay(ms), id, fn });
        return () => { timers.delete(id); };
    };

    const sleep = (ms, { signal } = {}) => new Promise((resolve, reject) => {
        if (signal?.aborted) { reject(abortError()); return; }
        let cancel = null;
        const onAbort = () => { cancel?.(); reject(abortError()); };
        cancel = setTimer(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal?.addEventListener('abort', onAbort, { once: true });
    });

    const nextDue = limit => {
        let best = null;
        for (const timer of timers.values()) {
            if (timer.at > limit) continue;
            if (!best || timer.at < best.at || (timer.at === best.at && timer.id < best.id)) best = timer;
        }
        return best;
    };

    async function advance(ms) {
        const target = time + delay(ms);
        await flush();
        for (let due = nextDue(target); due; due = nextDue(target)) {
            timers.delete(due.id);
            time = due.at;
            due.fn();
            await flush();
        }
        time = target;
        await flush();
    }

    /** Run every timer that is set, and every one they set, however far ahead. */
    async function runAll({ limit = 100_000 } = {}) {
        await flush();
        for (let fired = 0; timers.size > 0; fired += 1) {
            if (fired >= limit) throw new Error(`The virtual clock did not settle within ${limit} timers`);
            const due = nextDue(Infinity);
            timers.delete(due.id);
            time = Math.max(time, due.at);
            due.fn();
            await flush();
        }
    }

    return { now: () => time, setTimer, sleep, advance, runAll, pending: () => timers.size };
}
