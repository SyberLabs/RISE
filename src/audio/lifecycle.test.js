import { describe, expect, it, vi } from 'vitest';
import { AudioLifecycle, AUDIO_STATUS } from './lifecycle.js';

/**
 * THE BROWSER IS ALLOWED TO BE UNRELIABLE. RISE'S MODEL OF IT IS NOT.
 *
 * Five facts that mobile WebKit does not keep in agreement:
 *
 *   what the reader asked for          (intent)
 *   whether the page is on screen      (visibility)
 *   what the context reports           (state)
 *   whether anything is rendering      (the audio clock)
 *   whether samples reach a speaker    (never knowable here)
 *
 * WebKit 263627 reports the fourth failing while the third says
 * "running": `currentTime` stops advancing and a programmatic
 * suspend/resume restores it. 281566 reports resume() never settling at
 * all. 291892 reports output dead while callbacks fire normally.
 *
 * These tests hold the state machine to the only honest position: it
 * asserts what it has checked, and says so in those words.
 */

/** A context whose clock only moves when a test says so. */
const fakeContext = (state = 'running', hooks = {}) => {
    const ctx = {
        state,
        currentTime: 0,
        suspend: hooks.suspend || vi.fn(() => { ctx.state = 'suspended'; return Promise.resolve(); }),
        resume: hooks.resume || vi.fn(() => { ctx.state = 'running'; return Promise.resolve(); })
    };
    return ctx;
};

/**
 * @param {object} o
 * @param {object|null} o.context
 * @param {boolean} o.visible
 * @param {boolean} o.intent
 * @param {(ms:number)=>Promise} [o.wait] advances the fake world
 */
const lifecycleFor = ({ context, visible = true, intent = true, wait, onNeedsGesture } = {}) => {
    const events = [];
    const machine = new AudioLifecycle({
        getContext: () => context,
        isVisible: () => visible,
        hasIntent: () => intent,
        onNeedsGesture,
        diag: (event, facts) => events.push({ event, ...facts }),
        wait: wait || (() => Promise.resolve())
    });
    return { machine, events, names: () => events.map(e => e.event) };
};

describe('claiming ownership when the page goes away', () => {
    it('yields a running context', async () => {
        const context = fakeContext('running');
        const { machine } = lifecycleFor({ context });

        await machine.onHidden();

        expect(context.suspend).toHaveBeenCalled();
        expect(machine.yieldedToVisibility).toBe(true);
    });

    it('claims the yield even when iOS got there first', async () => {
        // THE ORDERING THE TRACE CAUGHT. WebKit can move a context to
        // `interrupted` before our visibilitychange handler runs, and
        // ownership decided on what the browser reports at that instant
        // then never claims it: the trace read
        // `visibility:visible context=interrupted yielded=false`, and
        // nothing recovered because nothing believed it was owed.
        //
        // Ownership follows RISE's own fact — was it intending to make
        // sound — not the browser's report.
        const context = fakeContext('interrupted');
        const { machine } = lifecycleFor({ context });

        await machine.onHidden();

        expect(machine.yieldedToVisibility).toBe(true);
    });

    it('claims nothing when there was nothing to yield', async () => {
        // Audio never admitted. Hiding a silent page owes it nothing on
        // return, or showing a page becomes a way to start audio the
        // reader never asked for.
        const context = fakeContext('suspended');
        const { machine } = lifecycleFor({ context, intent: false });

        await machine.onHidden();

        expect(machine.yieldedToVisibility).toBe(false);
        expect(context.suspend).not.toHaveBeenCalled();
    });

    it('is never audible while hidden, whatever the context says', async () => {
        const context = fakeContext('running');
        const { machine } = lifecycleFor({ context, visible: false });

        expect(machine.audible).toBe(false);
    });
});

describe('the audio clock, which is the only proof of rendering', () => {
    it('reads a moving clock as advancing', async () => {
        const context = fakeContext('running');
        const { machine } = lifecycleFor({
            context,
            wait: () => { context.currentTime += 0.12; return Promise.resolve(); }
        });

        expect(await machine.probeClock()).toBe('advancing');
    });

    it('reads a pinned clock as stalled, even at state running', async () => {
        // 25 seconds of wall time at ctxTime 8.691. `running` was a
        // claim about an object, not about a renderer.
        const context = fakeContext('running');
        const { machine } = lifecycleFor({ context });   // wait advances nothing

        expect(await machine.probeClock()).toBe('stalled');
    });

    it('will not call a stalled context audible', async () => {
        const context = fakeContext('running');
        const { machine } = lifecycleFor({ context });

        await machine.recover();

        expect(machine.status).toBe(AUDIO_STATUS.CLOCK_STALLED);
        expect(machine.audible).toBe(false);
    });
});

describe('recovery is not success until its postcondition is true', () => {
    it('settles on a healthy context after one resume', async () => {
        const context = fakeContext('suspended');
        const { machine, names } = lifecycleFor({
            context,
            wait: () => { context.currentTime += 0.12; return Promise.resolve(); }
        });

        const verdict = await machine.recover();

        expect(verdict.ok).toBe(true);
        expect(machine.status).toBe(AUDIO_STATUS.RUNNING_LIVE);
        expect(names()).toContain('recover:attempted');
        expect(names()).toContain('clock:advancing');
    });

    it('cures a stalled clock with an explicit suspend and resume', async () => {
        // The documented cure in 263627, 276016 and 281566 alike.
        const context = fakeContext('running');
        let cycled = false;
        context.suspend = vi.fn(() => { cycled = true; context.state = 'suspended'; return Promise.resolve(); });
        context.resume = vi.fn(() => { context.state = 'running'; return Promise.resolve(); });
        const { machine, names } = lifecycleFor({
            context,
            wait: () => { if (cycled) context.currentTime += 0.12; return Promise.resolve(); }
        });

        const verdict = await machine.recover();

        expect(context.suspend).toHaveBeenCalled();
        expect(verdict.ok).toBe(true);
        expect(machine.status).toBe(AUDIO_STATUS.RUNNING_LIVE);
        expect(names()).toContain('recover:cycled');
    });

    it('asks for a gesture rather than claiming a recovery it did not get', async () => {
        // The trace logged `visibility:recovered` against a suspended
        // context. A name is a claim; this one has to be earned.
        const context = fakeContext('running');    // clock never moves
        const onNeedsGesture = vi.fn();
        const { machine, names } = lifecycleFor({ context, onNeedsGesture });

        const verdict = await machine.recover();

        expect(verdict.ok).toBe(false);
        expect(machine.status).toBe(AUDIO_STATUS.CLOCK_STALLED);
        expect(onNeedsGesture).toHaveBeenCalled();
        expect(names()).toContain('recover:failed');
        expect(names(), 'never claims what it has not checked').not.toContain('recovered');
    });

    it('does not hang on a resume that never settles', async () => {
        const context = fakeContext('suspended', { resume: vi.fn(() => new Promise(() => {})) });
        const { machine } = lifecycleFor({ context });

        const outcome = await Promise.race([
            machine.recover().then(() => 'settled'),
            new Promise(r => setTimeout(() => r('hung'), 2000))
        ]);

        expect(outcome).toBe('settled');
    }, 6000);

    it('does not hang on a suspend that never settles', async () => {
        const context = fakeContext('running', { suspend: vi.fn(() => new Promise(() => {})) });
        const { machine } = lifecycleFor({ context });

        const outcome = await Promise.race([
            machine.onHidden().then(() => 'settled'),
            new Promise(r => setTimeout(() => r('hung'), 2000))
        ]);

        expect(outcome).toBe('settled');
    }, 6000);
});

describe('returning to the page', () => {
    it('recovers what visibility took', async () => {
        const context = fakeContext('running');
        const { machine } = lifecycleFor({
            context,
            wait: () => { context.currentTime += 0.12; return Promise.resolve(); }
        });

        await machine.onHidden();
        context.resume.mockClear();
        await machine.onVisible();

        expect(context.resume).toHaveBeenCalled();
    });

    it('leaves an unadmitted context alone', async () => {
        const context = fakeContext('suspended');
        const { machine } = lifecycleFor({ context, intent: false });

        await machine.onHidden();
        await machine.onVisible();

        expect(context.resume).not.toHaveBeenCalled();
        expect(context.state).toBe('suspended');
    });

    it('recovers an interruption it did not cause', async () => {
        // iOS taking the session during a call is a loss from a state
        // the reader had already allowed. Preserved from #145.
        const context = fakeContext('interrupted');
        const { machine } = lifecycleFor({
            context,
            intent: false,
            wait: () => { context.currentTime += 0.12; return Promise.resolve(); }
        });

        await machine.onVisible();

        expect(context.resume).toHaveBeenCalled();
    });
});

describe('a newer lifecycle event supersedes an older recovery', () => {
    it('cannot be left audible by a recovery from a page that is gone', async () => {
        let visible = true;
        const context = fakeContext('running');
        const events = [];
        const machine = new AudioLifecycle({
            getContext: () => context,
            isVisible: () => visible,
            hasIntent: () => true,
            diag: (event, facts) => events.push({ event, ...facts }),
            // The page hides again while the probe is in flight.
            wait: () => { visible = false; return Promise.resolve(); }
        });

        await machine.onVisible();

        expect(machine.audible).toBe(false);
    });
});

describe('a failure inside the machine is reported, never dropped', () => {
    /** A context whose clock refuses to be read at all. */
    const hostileClock = (state = 'running') => {
        const ctx = {
            state,
            suspend: vi.fn(() => { ctx.state = 'suspended'; return Promise.resolve(); }),
            resume: vi.fn(() => { ctx.state = 'running'; return Promise.resolve(); })
        };
        Object.defineProperty(ctx, 'currentTime', {
            get() { throw new TypeError('currentTime is not available'); }
        });
        return ctx;
    };

    it('does not reject from an entry point nobody is awaiting', async () => {
        // Every caller of this reaches it through `void`: a statechange
        // listener, a visibilitychange listener, and four places in the
        // engine. None of them has anywhere to catch. In Node the
        // rejection lands inside whatever ran next — that is how a suite
        // where every test passed still failed the run — and in a browser
        // it lands nowhere at all, which is worse: reconciliation stops
        // and no trace says why.
        const context = hostileClock();
        const { machine, names, events } = lifecycleFor({ context });

        await expect(machine.observeStateChange()).resolves.toBeUndefined();

        expect(names(), 'silence is the one unacceptable answer').toContain('lifecycle:threw');
        const thrown = events.find(e => e.event === 'lifecycle:threw');
        expect(thrown.where).toBe('statechange');
        expect(thrown.error).toContain('currentTime');
    });

    it('does not reject from a visibility handler either', async () => {
        // Interrupted, so returning to the page actually runs the recovery
        // ladder rather than finding nothing owed and stopping. The ladder
        // is where the clock gets read, and reading it is what fails.
        const context = hostileClock('interrupted');
        const { machine, names } = lifecycleFor({ context });

        await expect(machine.onVisible()).resolves.toBeUndefined();

        expect(names()).toContain('lifecycle:threw');
    });

    it('still answers a gesture with a verdict when it fails', async () => {
        // ensureLive IS awaited, and its caller reads the answer. A
        // rejection there would take the app's first-gesture path with it.
        const context = hostileClock();
        const { machine } = lifecycleFor({ context });

        const verdict = await machine.ensureLive();

        expect(verdict.ok).toBe(false);
        expect(typeof verdict.status).toBe('string');
    });
});
