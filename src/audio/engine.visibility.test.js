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
    // The handlers are async and bounded; a macrotask drains whatever
    // depth of microtasks they happen to be, which counting ticks does
    // not.
    await new Promise(resolve => setTimeout(resolve, 0));
};

const fakeContext = (state = 'running', hooks = {}) => {
    const ctx = {
        state,
        currentTime: 0,
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

describe('the lobby drone, which answers to nobody else', () => {
    const withDrones = (engine, ctx) => {
        engine.isInitialized = true;
        engine.buffers.drones = [{ duration: 1 }];
        engine.layerGains.ambient = ctx.createGain();
        engine.setLayerVolume = vi.fn();
        return engine;
    };

    it('starts no drone while the document is hidden', async () => {
        // Failure 1. The playlist re-arms itself from source.onended,
        // which WebKit keeps firing while the page is hidden — so a
        // backgrounded RISE could become audible behind another tab.
        const ctx = fakeContext('running');
        const engine = withDrones(engineWith(ctx), ctx);
        const started = [];
        ctx.createBufferSource = () => {
            const s = { buffer: null, connect: vi.fn(), start: vi.fn(() => started.push(1)), stop: vi.fn(), onended: null };
            return s;
        };

        await setVisibility('hidden');
        engine.startAmbientPlaylist();

        expect(started).toHaveLength(0);
    });

    it('holds the intent while hidden and takes the next drone on return', async () => {
        // The real shape of Failure 1: WebKit goes on firing onended for
        // a hidden page, so the playlist asks for its next drone while
        // nobody is looking. It must be refused then and granted once on
        // return — not refused and forgotten, which would leave the
        // lobby permanently silent.
        const ctx = fakeContext('running');
        const engine = withDrones(engineWith(ctx), ctx);
        const started = [];
        const sources = [];
        ctx.createBufferSource = () => {
            const s = {
                buffer: null, connect: vi.fn(),
                start: vi.fn(() => started.push(1)), stop: vi.fn(), onended: null
            };
            sources.push(s);
            return s;
        };

        engine.startAmbientPlaylist();
        expect(started).toHaveLength(1);

        await setVisibility('hidden');
        expect(engine.ambienceActive, 'the intent survives the yield').toBe(true);

        sources[0].onended();                       // WebKit keeps firing it
        expect(started, 'no drone behind another tab').toHaveLength(1);

        await setVisibility('visible');
        expect(started, 'one drone back, not two').toHaveLength(2);
    });

    it('does not double the drone when the page merely came back', async () => {
        // A yielded context resumes the source it was already playing.
        // Starting another here is the doubled drone the acceptance
        // matrix watches for.
        const ctx = fakeContext('running');
        const engine = withDrones(engineWith(ctx), ctx);
        const started = [];
        ctx.createBufferSource = () => ({
            buffer: null, connect: vi.fn(), start: vi.fn(() => started.push(1)),
            stop: vi.fn(), onended: null
        });

        engine.startAmbientPlaylist();
        await setVisibility('hidden');
        await setVisibility('visible');

        expect(started, 'the suspended source resumes; no second one').toHaveLength(1);
    });
});
