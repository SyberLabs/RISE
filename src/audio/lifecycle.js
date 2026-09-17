/**
 * Who owns RISE's audio, and whether anything is actually rendering.
 *
 * The browser is allowed to be unreliable. RISE's model of it is not.
 *
 * Five facts that mobile WebKit does not keep in agreement, and which
 * this file refuses to collapse into one:
 *
 *   INTENT      what the reader asked for            (ours, durable)
 *   VISIBILITY  whether the page is on screen        (told to us, trustworthy)
 *   STATE       what the AudioContext reports        (told to us, unreliable)
 *   CLOCK       whether anything is rendering        (measurable)
 *   OUTPUT      whether samples reach a speaker      (never knowable here)
 *
 * The evidence for keeping them apart is a physical trace: 25 seconds of
 * wall time during which `context.state` read "running" and
 * `currentTime` never moved from 8.691. Every phrase and every fade
 * scheduled in that window landed on one audio timestamp.
 *
 * WebKit has three open reports of this family, and they are three
 * different failures rather than one:
 *
 *   263627  state running, currentTime frozen — suspend/resume cures it
 *   281566  resume() never settles at all
 *   291892  output dead while ended callbacks keep firing normally
 *
 * The first is detectable here, by measuring the clock. The second is
 * survivable, by bounding every call. The THIRD IS NOT DETECTABLE from
 * JavaScript at all, and nothing in this file pretends otherwise: a
 * live verdict means "rendering", never "audible".
 */

/** How long a probe watches the clock before judging it. */
const CLOCK_PROBE_MS = 120;

/** Nothing the browser is asked may hold the lifecycle longer than this. */
const CALL_BUDGET_MS = 250;

export const AUDIO_STATUS = Object.freeze({
    NO_CONTEXT: 'no-context',
    /** Suspended, and never admitted. Showing the page does not admit it. */
    UNADMITTED: 'unadmitted',
    /** Suspended because RISE hid it, and owed back on return. */
    YIELDED_HIDDEN: 'yielded-hidden',
    INTERRUPTED: 'interrupted',
    /** Running, and the clock was seen to move. The strongest claim available. */
    RUNNING_LIVE: 'running-live',
    /**
     * Running, and not yet watched. Admitted, because refusing until a
     * probe returns would silence the first phrase of every reading -
     * and an unproven context is not a suspect one. It becomes LIVE or
     * CLOCK_STALLED within a probe window.
     */
    RUNNING_UNVERIFIED: 'running-unverified',
    /** Running by its own account, rendering nothing. */
    CLOCK_STALLED: 'clock-stalled',
    /** Recovery is exhausted; only a reader can help now. */
    NEEDS_GESTURE: 'needs-gesture',
    CLOSED: 'closed'
});

export class AudioLifecycle {
    /**
     * @param {object} deps
     * @param {() => (AudioContext|null)} deps.getContext
     * @param {() => boolean} deps.isVisible
     * @param {() => boolean} deps.hasIntent    was RISE meaning to make a sound
     * @param {(event: string, facts?: object) => void} [deps.diag]
     * @param {() => void} [deps.onNeedsGesture]
     * @param {(ms: number) => Promise<void>} [deps.wait]
     */
    constructor({ getContext, isVisible, hasIntent, diag, onNeedsGesture,
        onVisibleSettled, openOutput, closeOutput, wait } = {}) {
        this._getContext = getContext || (() => null);
        this._isVisible = isVisible || (() => true);
        this._hasIntent = hasIntent || (() => false);
        this._diag = diag || (() => {});
        this._onNeedsGesture = onNeedsGesture || (() => {});
        // ONE VISIBILITY LISTENER, ONE POLICY. Anything else the engine
        // wants to do on return happens here, in a known order, rather
        // than in a second listener racing this one.
        this._onVisibleSettled = onVisibleSettled || (() => {});
        // HIDDEN SILENCE MUST NOT DEPEND ON THE BROWSER ANSWERING. A
        // bounded suspend() is bounded only in how long RISE waits; the
        // call itself is uncancellable and may land seconds later, as
        // the trace shows. Closing an output gate we own is immediate
        // and needs nobody's cooperation.
        this._openOutput = openOutput || (() => {});
        this._closeOutput = closeOutput || (() => {});
        /** Has this context ever been caught running without rendering? */
        this._suspect = false;
        this._wait = wait || (ms => new Promise(resolve => setTimeout(resolve, ms)));

        // Assigned directly, not through the setter below: the graph is
        // built connected and a fresh session must not need a probe to
        // make its first sound. The gate is only ever touched once a
        // real lifecycle event has moved the status.
        this._statusValue = AUDIO_STATUS.NO_CONTEXT;
        this._outputOpen = true;
        /** A recovery in flight owns the probe; nothing else re-enters. */
        this._recovering = false;
        this._yieldedToVisibility = false;
        /** A newer visibility event always supersedes an older recovery. */
        this._epoch = 0;
        this._onVisibilityChange = null;
    }

    get status() { return this._statusValue; }
    get yieldedToVisibility() { return this._yieldedToVisibility; }

    get _status() { return this._statusValue; }

    /**
     * THE GATE IS OPEN EXACTLY WHEN PLAYBACK IS ADMITTED.
     *
     * One rule, applied wherever the status moves, so there is no path
     * that leaves RISE admitting phrases into a closed gate or sounding
     * through an open one it has disowned. Writing it as a setter is
     * what makes that true by construction rather than by review.
     */
    set _status(next) {
        this._statusValue = next;
        this._applyOutputGate();
    }

    _applyOutputGate() {
        const open = this.admitted;
        if (open === this._outputOpen) return;
        this._outputOpen = open;
        if (open) this._openOutput(); else this._closeOutput();
    }

    /**
     * The only claim worth making: rendering was observed, and the page
     * is on screen. Still not a promise that a speaker moved.
     */
    get audible() {
        return this._status === AUDIO_STATUS.RUNNING_LIVE && this._isVisible();
    }

    /**
     * THE ONE ANSWER TO "MAY WE START WEB AUDIO NOW".
     *
     * Everything that starts a source asks this, and it derives from
     * what the lifecycle has established rather than from
     * `context.state`. The trace is what it costs to have two answers:
     * the controller said needs-gesture while the engine said running,
     * and sixteen seconds of phrases were scheduled onto a dead clock.
     *
     * An unproven context is admitted and a suspect one is not. Refusing
     * everything until a probe returns would silence the opening phrase
     * of every reading; admitting a context already caught rendering
     * nothing would be the bug itself.
     */
    get admitted() {
        if (!this._isVisible()) return false;
        return this._status === AUDIO_STATUS.RUNNING_LIVE
            || this._status === AUDIO_STATUS.RUNNING_UNVERIFIED;
    }

    attach(doc = typeof document === 'undefined' ? null : document) {
        this.detach();
        if (!doc) return;
        this._document = doc;
        this._onVisibilityChange = () => {
            this._epoch += 1;
            if (doc.visibilityState === 'hidden') void this.onHidden();
            else void this.onVisible();
        };
        doc.addEventListener('visibilitychange', this._onVisibilityChange);
    }

    detach() {
        if (this._onVisibilityChange && this._document) {
            this._document.removeEventListener('visibilitychange', this._onVisibilityChange);
        }
        this._onVisibilityChange = null;
        this._document = null;
    }

    /**
     * Ask the browser for something, and report only what was observed.
     *
     * A TIMEOUT IS NOT A RESULT. Promise.race stops RISE waiting; it
     * does not cancel suspend() or resume(), which go on and may move
     * the context long afterwards. The trace logged a yield as done
     * while the context still read running, and the suspension landed
     * four seconds later. So the outcome of a timeout is UNKNOWN, and is
     * named that way.
     *
     * @returns {'observed'|'timeout'|'unavailable'}
     */
    async _command(verb, invoke, satisfied) {
        const before = this._getContext()?.state ?? 'none';
        this._diag(`${verb}:requested`, { context: before });
        if (typeof invoke !== 'function') return 'unavailable';
        let settled = false;
        const call = Promise.resolve()
            .then(invoke)
            .then(() => { settled = true; })
            .catch(() => { settled = true; });
        await Promise.race([call, this._wait(CALL_BUDGET_MS)]);
        const after = this._getContext()?.state ?? 'none';
        if (satisfied(after)) {
            this._diag(`${verb}:observed`, { context: after });
            return 'observed';
        }
        // `timeout` is what RISE did; `pending` is what is known about
        // the operation, which is nothing. It has not failed and it has
        // not been cancelled - it is still out there, and the trace's
        // suspension landed four seconds after this line.
        this._diag(`${verb}:timeout`, { context: after, settled, outcome: 'pending' });
        return 'timeout';
    }

    /**
     * OWNERSHIP FOLLOWS INTENT, NOT THE BROWSER'S REPORT.
     *
     * Deciding this on `state === 'running'` at the instant the callback
     * fires loses the case the trace caught: iOS can move a context to
     * `interrupted` BEFORE visibilitychange arrives, and a handler that
     * checks the report then declines to claim what it is owed. On
     * return it finds `yielded=false` and recovers nothing.
     *
     * Whether RISE was meaning to make a sound is RISE's own fact, and
     * it is true across that race.
     */
    async onHidden() {
        const epoch = this._epoch;
        // Before anything is asked of the browser, and synchronously.
        // This is the only part of going silent that RISE can guarantee
        // by itself; everything downstream of here is a request.
        this._applyOutputGate();
        const context = this._getContext();
        if (!context) { this._status = AUDIO_STATUS.NO_CONTEXT; return; }
        if (context.state === 'closed') { this._status = AUDIO_STATUS.CLOSED; return; }

        // WHAT IS OWED, PER STATE.
        //
        //   running      always yield. It holds the session and may be
        //                sounding, and hiding must silence it.
        //   interrupted  yield if RISE meant to be heard. This is the
        //                race the trace caught: it WAS running until iOS
        //                took it, moments before our callback ran.
        //   suspended    nothing to yield. Either it was never admitted,
        //                or it is already ours — and resuming it on
        //                return would be autoplay by the back door.
        const running = context.state === 'running';
        const interrupted = context.state === 'interrupted';
        if (!running && !(interrupted && this._hasIntent())) {
            this._status = AUDIO_STATUS.UNADMITTED;
            this._diag('visibility:hidden', { context: context.state, owed: false });
            return;
        }

        this._yieldedToVisibility = true;
        this._status = AUDIO_STATUS.YIELDED_HIDDEN;
        this._diag('visibility:hidden', { context: context.state, owed: true, epoch });

        if (context.state !== 'suspended') {
            await this._command('yield',
                () => context.suspend(),
                state => state === 'suspended');
        } else {
            this._diag('yield:observed', { context: 'suspended' });
        }
    }

    /**
     * Take back only what visibility took, and prove it before saying so.
     *
     * An INTERRUPTED context is the exception that predates this work:
     * iOS took a session the reader had already allowed, so asking for
     * it back restores what they had rather than starting what they did
     * not ask for.
     */
    async onVisible() {
        const context = this._getContext();
        const interrupted = context?.state === 'interrupted';
        this._diag('visibility:visible', {
            context: context?.state ?? 'none',
            owed: this._yieldedToVisibility
        });
        if (!this._yieldedToVisibility && !interrupted) {
            this._onVisibleSettled();
            return;
        }
        this._yieldedToVisibility = false;
        await this.recover();
        this._onVisibleSettled();
    }

    /**
     * Is anything rendering?
     *
     * `currentTime` advances only as render quanta are produced, so a
     * clock that does not move is a renderer that is not running — a
     * stronger and more useful fact than "state says suspended". The
     * window is long enough to clear WebKit's reduced-precision clamping
     * on `currentTime`, and the verdict is only ever "did it move at
     * all", never a comparison of rates.
     */
    async probeClock() {
        const context = this._getContext();
        if (!context || context.state !== 'running') return 'unknown';
        const before = context.currentTime;
        await this._wait(CLOCK_PROBE_MS);
        const after = this._getContext()?.currentTime ?? before;
        return after > before ? 'advancing' : 'stalled';
    }

    /**
     * A bounded ladder, each rung with a stated success criterion.
     *
     *   1  ask for the context back
     *   2  if it claims to be running but renders nothing, cycle it —
     *      the cure named in 263627, 276016 and 281566 alike
     *   3  stop, and say a reader is needed. DO NOT CLAIM A RECOVERY.
     *
     * There is deliberately no rung that rebuilds the context. Every
     * report of this pathology was cured by a suspend/resume cycle, and
     * no evidence yet says a fresh context survives an OS-level session
     * failure that the old one did not.
     */
    async recover() {
        this._recovering = true;
        try {
            return await this._recover();
        } finally {
            this._recovering = false;
        }
    }

    async _recover() {
        const epoch = this._epoch;
        const superseded = () => epoch !== this._epoch || !this._isVisible();
        const context = this._getContext();
        if (!context) {
            this._status = AUDIO_STATUS.NO_CONTEXT;
            return { ok: false, status: this._status };
        }
        if (context.state === 'closed') {
            this._status = AUDIO_STATUS.CLOSED;
            this._diag('recover:closed');
            return { ok: false, status: this._status };
        }

        this._diag('recover:attempted', { context: context.state, epoch });

        // Rung 1 — ask.
        if (context.state !== 'running') {
            await this._command('resume',
                () => context.resume(),
                state => state === 'running');
            if (superseded()) return this._supersede(epoch);
        }

        if (await this._settle(epoch)) return { ok: true, status: this._status };
        if (superseded()) return this._supersede(epoch);

        // Rung 2 — cycle it.
        this._diag('recover:cycled', { context: this._getContext()?.state ?? 'none' });
        await this._command('yield',
            () => this._getContext()?.suspend(),
            state => state === 'suspended');
        if (superseded()) return this._supersede(epoch);
        await this._command('resume',
            () => this._getContext()?.resume(),
            state => state === 'running');
        if (superseded()) return this._supersede(epoch);

        if (await this._settle(epoch)) return { ok: true, status: this._status };

        // Rung 3 — say so plainly.
        this._suspect = true;
        this._status = this._getContext()?.state === 'running'
            ? AUDIO_STATUS.CLOCK_STALLED
            : AUDIO_STATUS.NEEDS_GESTURE;
        this._diag('recover:failed', { context: this._getContext()?.state ?? 'none', status: this._status });
        this._onNeedsGesture();
        return { ok: false, status: this._status };
    }

    /** Did that leave us rendering? The postcondition, checked. */
    async _settle(epoch) {
        const verdict = await this.probeClock();
        if (epoch !== this._epoch || !this._isVisible()) return false;
        if (verdict === 'advancing') {
            this._suspect = false;
            this._status = AUDIO_STATUS.RUNNING_LIVE;
            this._diag('clock:advancing');
            return true;
        }
        if (verdict === 'stalled') {
            // A PROBED CLOCK ALWAYS HAS A VERDICT. Leaving the status at
            // "unverified" after measuring it would strand the machine
            // between its own answers: admitted, because unverified is
            // admitted, yet never live enough to let a scheduler take a
            // step - so a soundscape would hold for a stall nothing ever
            // revisited. `unverified` means not yet measured, and this
            // has just measured it.
            this._suspect = true;
            this._status = AUDIO_STATUS.CLOCK_STALLED;
            this._diag('clock:stalled');
        }
        return false;
    }

    /**
     * A LATE OPERATION IS RECONCILED AGAINST WHAT RISE WANTS NOW.
     *
     * Promise completion order is not browser state order. A suspend
     * requested before the reader left can land after they return; a
     * resume requested while visible can land once they have gone. So
     * the desired state is recomputed from visibility at the moment the
     * change is observed, and the context is moved back toward it.
     *
     * This is also the path that catches the trace's 37.421: a context
     * that became running by itself, long after recovery had given up,
     * with its clock still dead. Nothing re-examined it then. It does
     * now, and a context already caught rendering nothing has to prove
     * itself before it is admitted again.
     */
    async observeStateChange() {
        const context = this._getContext();
        const state = context?.state ?? 'none';
        this._diag('context:statechange', { context: state, status: this._status });

        if (state === 'closed') { this._status = AUDIO_STATUS.CLOSED; return; }
        if (state === 'none') { this._status = AUDIO_STATUS.NO_CONTEXT; return; }

        if (!this._isVisible()) {
            this._applyOutputGate();
            if (state === 'running') {
                this._diag('reconcile:re-yield', { context: state });
                await this.onHidden();
            }
            return;
        }

        if (state !== 'running') return;
        if (!this._suspect) this._status = AUDIO_STATUS.RUNNING_UNVERIFIED;
        // recover() is already probing and about to rule on this same
        // context. Two verdicts racing would let the loser overwrite the
        // winner, and the ladder's own rungs are the stricter test.
        if (this._recovering) return;
        await this._settle(this._epoch);
    }

    /**
     * What a user gesture should ask for.
     *
     * Not "is state running" - that is the question whose answer the
     * trace shows to be worthless. This establishes the postcondition:
     * visible, usable, and a clock that was seen to move.
     */
    async ensureLive() {
        if (!this._isVisible()) return { ok: false, status: this._status };
        if (this._status === AUDIO_STATUS.RUNNING_LIVE) {
            return { ok: true, status: this._status };
        }
        return this.recover();
    }

    _supersede(epoch) {
        this._diag('recover:superseded', { epoch, now: this._epoch });
        if (!this._isVisible()) this._status = AUDIO_STATUS.YIELDED_HIDDEN;
        return { ok: false, status: this._status };
    }
}
