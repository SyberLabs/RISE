import { describe, expect, it, vi } from 'vitest';
import { AudioLifecycle, AUDIO_STATUS } from './lifecycle.js';

/**
 * A TIMEOUT IS NOT A RESULT, AND A PROMISE IS NOT A BROWSER.
 *
 * `Promise.race` stops RISE waiting. It does not cancel
 * AudioContext.suspend(); the browser goes on doing what it was asked,
 * and may change the context long after the lifecycle gave up on it.
 * The physical trace shows exactly that:
 *
 *   31.088  visibility:hidden    context=running   owed=true
 *   31.341  visibility:yielded   context=running   ← still running!
 *   35.914  visibility:visible   context=suspended ← it landed, 4s late
 *   35.955  recover:failed       status=needs-gesture
 *   37.421  (context asynchronously becomes running)
 *   42.039  play  ctxTime=25.941
 *   49.801  play  ctxTime=25.941
 *   58.171  play  ctxTime=25.941
 *
 * Sixteen seconds of "running" against a clock frozen at 25.941, because
 * a late browser operation moved the context and nothing re-examined it.
 *
 * These tests hold three things: a command reports only what it
 * observed, a late state change is reconciled against what RISE
 * currently wants, and there is one answer to "may we start audio now".
 */

const fakeContext = (state = 'running', hooks = {}) => {
    const ctx = {
        state,
        currentTime: 0,
        suspend: hooks.suspend || vi.fn(() => { ctx.state = 'suspended'; return Promise.resolve(); }),
        resume: hooks.resume || vi.fn(() => { ctx.state = 'running'; return Promise.resolve(); })
    };
    return ctx;
};

const build = ({ context, visible = true, intent = true, wait, onNeedsGesture } = {}) => {
    const events = [];
    const gate = { open: 0, calls: [] };
    const machine = new AudioLifecycle({
        getContext: () => context,
        isVisible: () => visible,
        hasIntent: () => intent,
        onNeedsGesture,
        openOutput: () => { gate.open = 1; gate.calls.push('open'); },
        closeOutput: () => { gate.open = 0; gate.calls.push('close'); },
        diag: (event, facts) => events.push({ event, ...facts }),
        wait: wait || (() => Promise.resolve())
    });
    return { machine, gate, events, names: () => events.map(e => e.event) };
};

describe('a command reports what it observed, never what it asked for', () => {
    it('does not call a yield observed while the context still runs', async () => {
        // The trace logged `visibility:yielded context=running`. The
        // suspend had not landed; it landed four seconds later.
        const context = fakeContext('running', { suspend: vi.fn(() => new Promise(() => {})) });
        const { machine, names, events } = build({ context });

        await machine.onHidden();

        expect(names()).toContain('yield:requested');
        expect(names(), 'a timeout is not an observation').not.toContain('yield:observed');
        expect(names()).toContain('yield:timeout');
        expect(events.find(e => e.event === 'yield:timeout').context).toBe('running');
    });

    it('calls it observed once the context actually suspends', async () => {
        const context = fakeContext('running');
        const { machine, names } = build({ context });

        await machine.onHidden();

        expect(names()).toContain('yield:observed');
    });
});

describe('the exact physical trace', () => {
    /** Reproduces 31.088 → 58.171 step by step. */
    const stage = () => {
        let visible = true;
        const context = fakeContext('running', {
            // Never settles inside the budget — as in the trace.
            suspend: vi.fn(() => new Promise(() => {}))
        });
        const onNeedsGesture = vi.fn();
        const { machine, gate, events, names } = build({
            context,
            get visible() { return visible; },
            onNeedsGesture
        });
        // The getter above is not honoured by the object literal; rebuild
        // with a live reader.
        const live = new AudioLifecycle({
            getContext: () => context,
            isVisible: () => visible,
            hasIntent: () => true,
            onNeedsGesture,
            openOutput: () => { gate.open = 1; },
            closeOutput: () => { gate.open = 0; },
            diag: (event, facts) => events.push({ event, ...facts }),
            wait: () => Promise.resolve()
        });
        return {
            machine: live, context, gate, events, onNeedsGesture,
            names: () => events.map(e => e.event),
            hide: () => { visible = false; },
            show: () => { visible = true; }
        };
    };

    it('never admits playback against a clock frozen at 25.941', async () => {
        const s = stage();

        // 31.088 — hidden, owed. The suspend will not land in time.
        s.hide();
        await s.machine.onHidden();
        expect(s.machine.yieldedToVisibility).toBe(true);
        expect(s.gate.open, 'output closed without waiting on the browser').toBe(0);

        // 35.914 — visible again; the suspend has landed by now.
        s.context.state = 'suspended';
        s.context.resume = vi.fn(() => Promise.resolve());   // resolves, changes nothing
        s.show();
        await s.machine.onVisible();

        expect(s.machine.status).toBe(AUDIO_STATUS.NEEDS_GESTURE);
        expect(s.onNeedsGesture).toHaveBeenCalled();

        // 37.421 — a LATE operation moves the context to running, on its
        // own schedule, with the render clock still dead at 25.941.
        s.context.state = 'running';
        s.context.currentTime = 25.941;
        await s.machine.observeStateChange();

        // 42.039, 49.801, 58.171 — every one of these must be refused.
        expect(s.machine.status).not.toBe(AUDIO_STATUS.RUNNING_LIVE);
        expect(s.machine.admitted, 'no playback against a dead renderer').toBe(false);
        expect(s.machine.audible).toBe(false);
        expect(s.gate.open, 'output stays closed').toBe(0);
    });

    it('admits playback again only once the clock actually moves', async () => {
        const s = stage();
        s.hide();
        await s.machine.onHidden();
        s.context.state = 'suspended';
        s.context.resume = vi.fn(() => Promise.resolve());
        s.show();
        await s.machine.onVisible();
        expect(s.machine.admitted).toBe(false);

        // The reader touches the screen. Recovery is asked to establish
        // the postcondition rather than to trust `state`.
        s.context.state = 'running';
        s.context.currentTime = 25.941;
        let moving = false;
        s.machine._wait = () => { if (moving) s.context.currentTime += 0.12; return Promise.resolve(); };

        await s.machine.ensureLive();
        expect(s.machine.admitted, 'still dead, still refused').toBe(false);

        moving = true;
        await s.machine.ensureLive();

        expect(s.machine.status).toBe(AUDIO_STATUS.RUNNING_LIVE);
        expect(s.machine.admitted).toBe(true);
        expect(s.gate.open, 'and only now is the output opened').toBe(1);
    });
});

describe('a late operation is reconciled against what RISE wants now', () => {
    it('re-yields when a stale resume lands on a hidden page', async () => {
        // The inverse stale case. A resume requested while visible can
        // land after the reader has gone; it must not make a hidden page
        // audible.
        let visible = true;
        const context = fakeContext('suspended');
        const events = [];
        let gateOpen = 1;
        const machine = new AudioLifecycle({
            getContext: () => context,
            isVisible: () => visible,
            hasIntent: () => true,
            openOutput: () => { gateOpen = 1; },
            closeOutput: () => { gateOpen = 0; },
            diag: (event, facts) => events.push({ event, ...facts }),
            wait: () => Promise.resolve()
        });

        visible = false;
        context.state = 'running';           // the late resume lands
        await machine.observeStateChange();

        expect(machine.audible).toBe(false);
        expect(machine.admitted).toBe(false);
        expect(gateOpen, 'hidden output is closed').toBe(0);
        expect(context.suspend, 'and the context is asked to go back').toHaveBeenCalled();
    });
});

describe('one answer to may we start audio now', () => {
    it('refuses while the status is unproven or bad', async () => {
        const context = fakeContext('running');
        for (const status of [
            AUDIO_STATUS.NEEDS_GESTURE, AUDIO_STATUS.CLOCK_STALLED,
            AUDIO_STATUS.UNADMITTED, AUDIO_STATUS.INTERRUPTED,
            AUDIO_STATUS.YIELDED_HIDDEN, AUDIO_STATUS.CLOSED
        ]) {
            const { machine } = build({ context });
            machine._status = status;
            expect(machine.admitted, status).toBe(false);
        }
    });

    it('allows a context that has only just started, while it verifies', async () => {
        // The ordinary admission path. Refusing everything until a probe
        // returns would silence the first phrase of every reading, which
        // is the defect this project spent a week removing.
        const context = fakeContext('running');
        const { machine } = build({ context });
        machine._status = AUDIO_STATUS.RUNNING_UNVERIFIED;

        expect(machine.admitted).toBe(true);
    });
});

describe('a measured clock always has a verdict', () => {
    it('does not leave a stalled context sitting at unverified', async () => {
        // The state that has no honest meaning: admitted, because
        // unverified is admitted, and simultaneously never live enough
        // for a scheduler to take a step. A soundscape would hold there
        // forever, waiting on a stall nothing was going to revisit.
        const context = fakeContext('running');     // clock never moves
        const { machine } = build({ context });

        await machine.observeStateChange();

        expect(machine.status).toBe(AUDIO_STATUS.CLOCK_STALLED);
        expect(machine.admitted).toBe(false);
    });

    it('comes back on its own when the clock does, without a gesture', async () => {
        // A suspect context is not a condemned one. Every resume, every
        // statechange re-measures it, so a stall that passes costs the
        // reader one phrase rather than the rest of the session.
        let moving = false;
        const context = fakeContext('running');
        const { machine, gate } = build({
            context,
            wait: () => { if (moving) context.currentTime += 0.12; return Promise.resolve(); }
        });

        await machine.observeStateChange();
        expect(machine.admitted).toBe(false);
        expect(gate.open).toBe(0);

        moving = true;
        await machine.observeStateChange();

        expect(machine.status).toBe(AUDIO_STATUS.RUNNING_LIVE);
        expect(machine.admitted).toBe(true);
        expect(gate.open, 'and the output comes back with it').toBe(1);
    });
});

describe('a command distinguishes no answer from a useless one', () => {
    it('calls a settled call that changed nothing ineffective, not timed out', async () => {
        // FROM AN IPHONE TRACE: `resume:timeout settled:true` eight
        // milliseconds after the request. The call answered, promptly, and
        // the context did not move. Reporting that as a timeout pending an
        // answer claims RISE is still waiting on something that already
        // came back — the exact class of untruth this machine exists to
        // stop telling.
        const context = fakeContext('suspended', {
            resume: vi.fn(() => Promise.resolve())   // settles; changes nothing
        });
        // The budget has to outlast the call, as a real 250ms timer does
        // against a resume that answered in eight milliseconds. A wait
        // that resolves in one microtask wins the race against the call's
        // own continuation and reports a timeout that never happened.
        const { machine, names, events } = build({
            context,
            wait: () => new Promise(resolve => setTimeout(resolve, 0))
        });

        await machine.recover();

        expect(names(), 'it answered, so nothing is pending').not.toContain('resume:timeout');
        expect(names()).toContain('resume:ineffective');
        expect(events.find(e => e.event === 'resume:ineffective').outcome).toBe('no-effect');
    });

    it('still calls it a timeout when the browser never answers', async () => {
        const context = fakeContext('suspended', { resume: vi.fn(() => new Promise(() => {})) });
        const { machine, names, events } = build({ context });

        await machine.recover();

        expect(names()).toContain('resume:timeout');
        expect(events.find(e => e.event === 'resume:timeout').outcome).toBe('pending');
    });
});

describe('one probe, however many ask', () => {
    it('shares a clock probe rather than running five of them', async () => {
        // An iPhone trace logged five `clock:advancing` inside a single
        // millisecond: every statechange and every resume had started its
        // own 120ms probe of the same clock. They agreed, so nothing broke
        // — but the trace is the only instrument RISE has here, and five
        // copies of one answer is not a reading.
        const context = fakeContext('running');
        let waits = 0;
        const { machine, names } = build({
            context,
            wait: () => { waits += 1; context.currentTime += 0.12; return Promise.resolve(); }
        });

        await Promise.all([
            machine.observeStateChange(),
            machine.observeStateChange(),
            machine.observeStateChange()
        ]);

        expect(names().filter(n => n === 'clock:advancing')).toHaveLength(1);
        expect(waits, 'one probe window, not three').toBe(1);
    });
});
