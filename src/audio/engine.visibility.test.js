import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from './engine.js';

/**
 * WHO OWNS THE SOUND WHILE NOBODY IS LOOKING.
 *
 * RISE keeps three facts that a mobile browser does not treat as one:
 * what the app intends to play, what the AudioContext reports, and
 * whether the OS is actually routing this document's audio anywhere.
 *
 * WebKit 276016 and 291892 both describe the gap: after a background
 * and return, `context.state` reads "running" and source callbacks fire
 * normally while nothing is audible. The reported workaround in both is
 * an explicit suspend/resume cycle — which is to say, taking ownership
 * back rather than assuming it was kept.
 *
 * These tests fix the ownership contract:
 *
 *   visible + intent   → the engine may sound
 *   hidden             → the engine yields, deliberately, and remembers
 *                        that visibility is why
 *   visible again      → the engine reacquires exactly what visibility
 *                        took, and nothing else
 */

let listeners;
let visibility;

const fakeDocument = () => ({
    addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
    removeEventListener: (type, fn) => {
        listeners[type] = (listeners[type] || []).filter(f => f !== fn);
    },
    get visibilityState() { return visibility; },
    get hidden() { return visibility === 'hidden'; }
});

/** Drive the page between states the way a phone does. */
const setVisibility = async (state) => {
    visibility = state;
    for (const fn of listeners.visibilitychange || []) fn();
    // The recovery ladder measures the audio clock over a real window
    // before it will call anything recovered, so this waits past that
    // rather than counting microtasks.
    await new Promise(resolve => setTimeout(resolve, 450));
};

const fakeContext = (state = 'running', hooks = {}) => {
    const ctx = {
        state,
        // A LIVE RENDERER HAS A MOVING CLOCK. The lifecycle proves
        // recovery by watching currentTime rather than trusting `state`,
        // so a fake whose clock never moves models the WebKit pathology,
        // not a working context. This one advances while running.
        _t0: Date.now(),
        get currentTime() {
            return ctx.state === 'running' ? (Date.now() - ctx._t0) / 1000 : ctx._frozen ?? 0;
        },
        destination: { name: 'destination' },
        suspend: hooks.suspend || vi.fn(function () { ctx.state = 'suspended'; return Promise.resolve(); }),
        resume: hooks.resume || vi.fn(function () { ctx.state = 'running'; return Promise.resolve(); }),
        close: vi.fn(function () { ctx.state = 'closed'; return Promise.resolve(); }),
        addEventListener: (type, fn) => { (ctx._on ??= {})[type] = fn; },
        removeEventListener: () => {},
        createGain: () => ({
            gain: {
                value: 0, cancelScheduledValues: vi.fn(),
                setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn()
            },
            connect: vi.fn()
        }),
        createBufferSource: () => ({
            buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null
        })
    };
    return ctx;
};

/** An engine with a context already in place and its lifecycle bound. */
const engineWith = (context) => {
    const engine = new AudioEngine();
    engine.context = context;
    engine._bindContextLifecycle();
    return engine;
};

beforeEach(() => {
    listeners = {};
    visibility = 'visible';
    vi.stubGlobal('document', fakeDocument());
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('yielding the audio when the page goes away', () => {
    it('suspends a running context when the document hides', async () => {
        const ctx = fakeContext('running');
        const engine = engineWith(ctx);

        await setVisibility('hidden');

        expect(ctx.suspend).toHaveBeenCalled();
        expect(ctx.state).toBe('suspended');
    });

    it('records that visibility is why it was suspended', async () => {
        const ctx = fakeContext('running');
        const engine = engineWith(ctx);

        await setVisibility('hidden');

        expect(engine.yieldedToVisibility).toBe(true);
    });

    it('does not report its own yield as an interruption', async () => {
        // The app spends the reader's next tap recovering from an
        // interruption. A suspension RISE asked for is not one.
        const ctx = fakeContext('running');
        const engine = engineWith(ctx);
        const onInterrupted = vi.fn();
        engine.onInterrupted = onInterrupted;

        await setVisibility('hidden');
        ctx._on?.statechange?.();

        expect(onInterrupted).not.toHaveBeenCalled();
    });

    it('still reports an interruption nobody asked for', async () => {
        // The distinction that makes the rule above safe: iOS taking the
        // session during a call is a failure the reader must be able to
        // recover from, and it must not be swallowed along with the
        // suspensions RISE performs on purpose.
        const ctx = fakeContext('running');
        const engine = engineWith(ctx);
        const onInterrupted = vi.fn();
        engine.onInterrupted = onInterrupted;

        ctx.state = 'interrupted';
        ctx._on?.statechange?.();

        expect(onInterrupted).toHaveBeenCalledWith('interrupted');
    });

    it('is not audible while hidden, whatever the context reports', async () => {
        // The whole point. WebKit says running; the speaker says nothing.
        const ctx = fakeContext('running');
        const engine = engineWith(ctx);

        await setVisibility('hidden');
        ctx.state = 'running';          // as WebKit may well report it

        expect(engine.audible).toBe(false);
    });
});

describe('taking the audio back when the page returns', () => {
    it('resumes what visibility took', async () => {
        const ctx = fakeContext('running');
        const engine = engineWith(ctx);

        await setVisibility('hidden');
        ctx.resume.mockClear();
        await setVisibility('visible');

        expect(ctx.resume).toHaveBeenCalled();
        expect(engine.yieldedToVisibility).toBe(false);
    });

    it('leaves a context alone that was already suspended before hiding', async () => {
        // Audio was never admitted. Showing the page again is not a
        // reason to start it — that would be autoplay by the back door.
        const ctx = fakeContext('suspended');
        const engine = engineWith(ctx);

        await setVisibility('hidden');
        ctx.resume.mockClear();
        await setVisibility('visible');

        expect(ctx.resume).not.toHaveBeenCalled();
        expect(ctx.state).toBe('suspended');
    });
});

describe('races and promises that never settle', () => {
    it('ends hidden when visibility flips faster than the calls resolve', async () => {
        // hidden → visible → hidden, with the suspend still in flight.
        // The last thing the reader did must win.
        let releaseSuspend;
        const ctx = fakeContext('running', {
            suspend: vi.fn(() => new Promise(r => { releaseSuspend = () => { ctx.state = 'suspended'; r(); }; }))
        });
        const engine = engineWith(ctx);

        await setVisibility('hidden');
        await setVisibility('visible');
        await setVisibility('hidden');
        releaseSuspend?.();
        await Promise.resolve();

        expect(engine.audible).toBe(false);
    });

    it('does not hang when suspend never settles', async () => {
        const ctx = fakeContext('running', { suspend: vi.fn(() => new Promise(() => {})) });
        const engine = engineWith(ctx);

        const settled = await Promise.race([
            engine._onVisibilityHidden().then(() => 'settled'),
            new Promise(r => setTimeout(() => r('hung'), 1500))
        ]);

        expect(settled).toBe('settled');
    }, 5000);

    it('does not hang when resume never settles', async () => {
        const ctx = fakeContext('running', { resume: vi.fn(() => new Promise(() => {})) });
        const engine = engineWith(ctx);
        await setVisibility('hidden');

        const settled = await Promise.race([
            engine._onVisibilityVisible().then(() => 'settled'),
            new Promise(r => setTimeout(() => r('hung'), 1500))
        ]);

        expect(settled).toBe('settled');
    }, 5000);
});
