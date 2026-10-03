/**
 * The live runtime: one answer becoming an experience.
 *
 * It owns no screen, no speaker and no provider. It is handed
 *   adapter       opens a Current and yields protocol events (see adapter.js)
 *   createPlayer  makes the ONE Player for a Session (the host's factory; the
 *                 runtime never constructs one)
 *   voices        makes a voice renderer per Current (see voices/synthetic.js)
 *   host          presents and dismisses what the runtime built
 *   clock         the only thing it waits on
 * and it does the rest:
 *
 *   events -> reducer -> ended segments lowered -> Player.extend
 *
 * Time. Before speech, and with no voice, the Player's own timer is the clock.
 * While a voice speaks, the voice is (speech-governor.js). While a Dive is
 * open, nobody is: the parent's Player is paused and its voice held, so the
 * parent's position cannot move, and Surface lets it go from the same place.
 *
 * Two records, deliberately apart. The reducer's stream is the record of what
 * the provider composed, and is sealed when the Current completes. Composition
 * finishes long before speech does, so what the reader lived through
 * (interruptions, Dives, where speech was) is kept here, in a bounded journal.
 *
 * A Dive is a Current of its own. Nested Dives are not built and are refused.
 */

import { compileRiseCurrent } from '../core/rise-current.js';
import { AdapterError, OPEN_LIMITS, assertAdapter } from './adapter.js';
import { createRealClock } from './clock.js';
import { createSpeechGovernor } from './speech-governor.js';
import { withExperientialState } from './state-visuals.js';
import { createCurrentStream } from './stream.js';
import { ATTRACTOR_VISUAL_MANIFEST, validateVisualCommand } from '../core/visual-control-contract.js';

export const RUNTIME_LIMITS = Object.freeze({ reconnects: 3, backoffMs: 250, journal: 500 });

export class LiveRuntimeError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'LiveRuntimeError';
        this.code = code;
    }
}

const clip = (text, length) => (text.length <= length ? text : text.slice(0, length));

export function createLiveRuntime({
    adapter, createPlayer, host = {}, voices = null, clock = createRealClock(), graceMs, reconnects = RUNTIME_LIMITS.reconnects
}) {
    assertAdapter(adapter);
    if (typeof createPlayer !== 'function') throw new TypeError('A runtime is handed the host’s Player factory');

    let status = 'idle';
    let error = null;
    let main = null;
    let side = null;
    let stopped = false;
    const journal = [];
    const listeners = new Set();

    // ─── what the host can see ──────────────────────────────────────────

    function note(type, body = {}) {
        journal.push({ at: clock.now(), type, ...body });
        if (journal.length > RUNTIME_LIMITS.journal) journal.shift();
    }

    function summary(run) {
        if (!run) return null;
        return {
            currentId: run.stream.currentId,
            role: run.role,
            phase: run.stream.phase,
            committedSegments: run.lowered,
            atomIndex: run.player ? run.player.sessionState.currentIndex : null,
            playerState: run.player ? run.player.sessionState.state : null,
            voiceDegraded: run.governor ? run.governor.degraded : false,
            speaking: run.speaking,
            segmentId: run.segmentId,
            finished: run.finished,
            error: run.error
        };
    }

    function snapshot() {
        return Object.freeze({ status, error, main: summary(main), side: summary(side) });
    }

    function visualRun() {
        return status === 'diving' ? side : main;
    }

    function visualRunIsActive(run) {
        return Boolean(run && !run.closed && run.player
            && (run.role === 'side' ? status === 'diving' : status === 'live' || status === 'interrupted')
            && run.stream.phase !== 'failed' && !run.error);
    }

    function visualRunIsLive(run) {
        return visualRunIsActive(run)
            && (run.player.sessionState.state === 'playing' || run.player.sessionState.state === 'paused');
    }

    function visualRefusal(code = 'NO_ACTIVE_VISUAL') {
        return Object.freeze({ status: 'refused', code });
    }

    function recordVisualReceipt(run, receipt) {
        note('visual.control', { ...(run ? { role: run.role } : {}), ...receipt });
        return receipt;
    }

    function discoverVisual() {
        const run = visualRun();
        if (!visualRunIsLive(run) || !run.presented || typeof host.discoverVisual !== 'function') return null;
        try {
            return host.discoverVisual({ role: run.role, player: run.player }) || null;
        } catch {
            return null;
        }
    }

    function controlVisual(command) {
        const run = visualRun();
        const checked = validateVisualCommand(command);
        if (!checked.ok) return recordVisualReceipt(run, visualRefusal(checked.code));
        if (!visualRunIsActive(run)) return recordVisualReceipt(run, visualRefusal('NOT_LIVE'));
        if (!run.presented) return recordVisualReceipt(run, visualRefusal());
        if (!visualRunIsLive(run)) return recordVisualReceipt(run, visualRefusal('NOT_LIVE'));
        if (typeof host.controlVisual !== 'function') return recordVisualReceipt(run, visualRefusal());
        let response;
        try {
            response = host.controlVisual({ role: run.role, player: run.player, command: checked.command });
        } catch {
            response = visualRefusal();
        }
        const bounds = ATTRACTOR_VISUAL_MANIFEST.parameters.intensity;
        const receipt = response?.status === 'accepted' && Number.isFinite(response.effective)
            && response.effective >= bounds.minimum && response.effective <= bounds.maximum
            ? Object.freeze({ status: 'accepted', surface: checked.command.surface, parameter: checked.command.parameter,
                requested: checked.requested, effective: response.effective })
            : visualRefusal(response?.code || 'NO_ACTIVE_VISUAL');
        return recordVisualReceipt(run, receipt);
    }

    function set(nextStatus, nextError = error) {
        status = nextStatus;
        error = nextError;
        for (const listener of [...listeners]) {
            try { listener(snapshot()); } catch { /* a listener may not break the runtime */ }
        }
    }

    // ─── a run: one Current, from open to close ─────────────────────────

    function failRun(run, caught) {
        if (run.closed) return;
        run.error = { code: caught?.code ?? 'FAILED', message: String(caught?.message ?? caught).slice(0, 300) };
        note('run.failed', { role: run.role, ...run.error });
        run.player?.setLive(false);
        // What was committed is still worth reading; only a Current with nothing to show has failed.
        if (!run.player) {
            if (run.role === 'main') set('failed', run.error);
            else set(status, run.error);
        } else set(status, run.error);
    }

    function lower(run) {
        const view = run.stream.snapshot();
        const ended = view.segments.filter(segment => segment.ended);
        const fresh = ended.slice(run.lowered);
        let session;
        try {
            let current = run.stream.toCurrent();
            // A Dive keeps the colors of the answer it comes from, whatever it said of itself.
            if (run.role === 'side') {
                const { theme: _own, ...rest } = current;
                const theme = main.stream.snapshot().theme;
                current = theme === null ? rest : { ...rest, theme };
            }
            session = compileRiseCurrent(current);
        } catch (caught) {
            failRun(run, caught);
            return;
        }
        // The intended condition of each passage adjusts the imagery beneath it, within bounds;
        // the sealed Current itself never carries it.
        const conditions = new Map(ended.map(segment => [segment.id, segment.state]));
        session.visualProgram = withExperientialState(session.visualProgram, id => conditions.get(id));
        const segments = ended.map(({ id, text }) => ({ id, text }));
        run.governor.update({ atoms: session.atoms, segments });
        // Words are given to the voice once the reading is on screen (see speak): a voice
        // that began while the host was still mounting would say the first words unseen.
        run.unspoken.push(...fresh);
        if (run.presented) speak(run);
        run.lowered = ended.length;
        set(status);

        if (!run.player) {
            run.player = createPlayer(session, { role: run.role });
            run.player.setLive(true);
            watchPlayer(run);
            // With no voice there is no clock but the Player’s own.
            if (run.voice) run.governor.install(run.player);
            if (run.role === 'main') set('live');
            // The host may need a moment to put the Player on screen; the reading starts when it has.
            run.presenting = Promise.resolve(host.present?.({ role: run.role, session, player: run.player, run: summary(run) }))
                .then(() => {
                    if (run.closed) return;
                    run.presented = true;
                    speak(run);
                    if (run.player.sessionState.state === 'idle') run.player.play();
                })
                .catch(caught => failRun(run, caught));
        } else {
            run.player.extend(session);
        }
        if (run.stream.terminal) run.player.setLive(false);
    }

    /** Give the voice what has been committed and not yet handed to it. */
    function speak(run) {
        const fresh = run.unspoken.splice(0);
        if (!run.voice) return;
        for (const segment of fresh) {
            try {
                run.voice.enqueue({ id: segment.id, text: segment.text });
            } catch (caught) {
                run.governor.standDown('voice-refused');
                note('voice.failed', { role: run.role, message: String(caught?.message ?? caught).slice(0, 200) });
                return;
            }
        }
    }

    function watchPlayer(run) {
        // Which passage the reader is in, for whatever wants to say more about it.
        run.player.on('atom', ({ index, concealed }) => {
            if (run.closed || concealed) return;
            const at = run.governor.positionOf(index);
            if (at && at.segmentId !== run.segmentId) {
                run.segmentId = at.segmentId;
                set(status);
            }
        });
        run.player.on('state', ({ state }) => {
            if (run.closed) return;
            if (state === 'paused') run.voice?.hold();
            else if (state === 'playing') run.voice?.release();
            else if (state === 'complete') {
                run.finished = true;
                note('run.finished', { role: run.role });
                if (run.role === 'main' && status === 'live') set('ended');
                else set(status);
            }
        });
    }

    async function pump(run) {
        let attempts = 0;
        try {
            for (;;) {
                let lost = null;
                try {
                    for await (const event of run.connection.events) {
                        if (run.closed) return;
                        const result = run.stream.apply(event);
                        if (result.applied > 0) {
                            attempts = 0;
                            if (run.stream.endedCount !== run.lowered) lower(run);
                        }
                        if (run.stream.terminal) break;
                        if (run.stream.resumeFrom !== null) {
                            lost = new AdapterError('SEQUENCE_GAP', 'Events were missed', { recoverable: true });
                            break;
                        }
                    }
                } catch (caught) {
                    if (run.closed) return;
                    lost = caught;
                }
                if (run.closed) return;
                if (run.stream.terminal) break;
                if (!lost) lost = new AdapterError('STREAM_ENDED', 'The provider stopped without finishing');
                if (!lost.recoverable || attempts >= reconnects) throw lost;
                attempts += 1;
                note('connection.lost', { role: run.role, code: lost.code, attempt: attempts });
                await clock.sleep(RUNTIME_LIMITS.backoffMs * attempts, { signal: run.abort.signal });
                await run.connection.resume(run.stream.resumeFrom ?? run.stream.snapshot().nextSeq);
                note('connection.resumed', { role: run.role });
            }
            if (run.stream.phase === 'failed') throw new AdapterError(run.stream.snapshot().error?.code ?? 'FAILED', run.stream.snapshot().error?.message ?? 'The Current failed');
            run.player?.setLive(false);
            if (!run.player) {
                if (run.role === 'main') set(run.stream.phase === 'cancelled' ? 'stopped' : 'failed', run.stream.phase === 'cancelled' ? null : { code: 'EMPTY_CURRENT', message: 'Nothing was said' });
                else set(status, { code: 'EMPTY_CURRENT', message: 'The Dive said nothing' });
            }
        } catch (caught) {
            if (caught?.name === 'AbortError' && run.closed) return;
            failRun(run, caught);
        }
    }

    /**
     * The run is the runtime's before its provider has answered, so Stop can close it and a
     * second Dive is refused while the first is still connecting. Resolves null if it was
     * closed meanwhile; the connection that arrives too late is closed, never used.
     */
    async function openRun(request, role) {
        const run = {
            role, request, stream: createCurrentStream(), connection: null, player: null, voice: null, governor: null,
            lowered: 0, presenting: null, presented: false, unspoken: [], segmentId: null, closed: false, finished: false, error: null, speaking: null, abort: new AbortController(), pumping: null
        };
        if (role === 'main') main = run;
        else side = run;
        set(status);
        try {
            run.connection = await adapter.open(request, { signal: run.abort.signal });
        } catch (caught) {
            if (run.closed) return null;
            if (role === 'main') main = null;
            else side = null;
            throw caught;
        }
        if (run.closed) {
            try { await run.connection.close(); } catch { /* it was never used */ }
            return null;
        }
        run.voice = voices ? voices.create() : null;
        run.governor = createSpeechGovernor({
            voice: run.voice ?? { playedMs: () => undefined },
            clock,
            graceMs,
            onDegrade: ({ reason }) => note('voice.degraded', { role, reason })
        });
        return run;
    }

    function startPumping(run) {
        run.pumping = pump(run);
    }

    async function closeRun(run) {
        if (!run || run.closed) return;
        run.closed = true;
        run.abort.abort();
        run.governor?.dispose();
        run.voice?.close?.();
        run.player?.destroy();
        try { await run.connection?.close(); } catch { /* closing must always finish */ }
        host.dismiss?.({ role: run.role });
    }

    return {
        get status() { return status; },
        snapshot,
        journal: () => journal.map(entry => ({ ...entry })),
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        discoverVisual,
        controlVisual,
        /** The Player of a run, for a host that wants to draw its progress. */
        playerFor(role = 'main') { return (role === 'side' ? side : main)?.player ?? null; },
        /** The reducer's view of a run: what the provider has composed so far. */
        composed(role = 'main') { return (role === 'side' ? side : main)?.stream.snapshot() ?? null; },

        /** Ask. Resolves once the Current has opened; the reading begins as words arrive. */
        async start(prompt) {
            if (status !== 'idle') throw new LiveRuntimeError('ALREADY_STARTED', 'A runtime carries one conversation');
            set('starting');
            let run;
            try {
                run = await openRun({ intent: 'answer', prompt }, 'main');
            } catch (caught) {
                set('failed', { code: caught?.code ?? 'OPEN_FAILED', message: String(caught?.message ?? caught).slice(0, 300) });
                throw caught;
            }
            if (!run) return;
            note('start', { prompt: clip(prompt, 200) });
            attachVoice(main);
            startPumping(main);
        },

        /**
         * Hold everything where it is, and nothing more: the reading and the voice stop, and the
         * provider is left to go on composing. This is what a reader who starts to speak needs (the
         * voice must not talk over them), and it costs nothing they cannot undo with resume.
         */
        hold({ text } = {}) {
            if (!main?.player || status !== 'live') throw new LiveRuntimeError('NOT_LIVE', 'There is nothing to hold');
            main.player.pause();
            note('hold', { reason: 'user', ...(text ? { text: clip(text, 200) } : {}) });
            set('interrupted');
        },

        /** Barge in: hold everything where it is, and tell the provider to stop composing if it still is. */
        async interrupt({ text } = {}) {
            if (!main?.player || status !== 'live') throw new LiveRuntimeError('NOT_LIVE', 'There is nothing to interrupt');
            main.player.pause();
            note('interrupt', { reason: 'user', ...(text ? { text: clip(text, 200) } : {}) });
            set('interrupted');
            if (!main.stream.terminal) {
                try { await main.connection.interrupt({ text }); } catch { /* the reader is already held */ }
            }
        },

        /** Carry on after an interruption, from the same place. */
        resume() {
            if (status !== 'interrupted') throw new LiveRuntimeError('NOT_INTERRUPTED', 'Nothing is held');
            set('live');
            main.player.play();
        },

        /**
         * Ask a question at the reader's exact position. The parent is held
         * where it is; the question is answered as a Current of its own.
         */
        async dive({ question, segmentId, atCharacter } = {}) {
            if (side) throw new LiveRuntimeError('NESTED_DIVE', 'A Dive inside a Dive is not built');
            if (!main?.player || (status !== 'live' && status !== 'interrupted' && status !== 'ended')) {
                throw new LiveRuntimeError('NOT_LIVE', 'There is nothing to dive from');
            }
            if (typeof question !== 'string' || !question.trim() || question.length > OPEN_LIMITS.prompt) {
                throw new LiveRuntimeError('QUESTION', 'A Dive needs a question');
            }
            const position = where(main, segmentId, atCharacter);
            const before = status;
            // Where the phrase on screen begins, for a voice that will have to say it again: the screen
            // knows, and a voice with no word boundaries does not. Between two phrases (in a flash, or held
            // during one) the phrase on screen has already been said, and the Player will go past it, so there is none to say again.
            const phrase = main.player.betweenPhrases
                ? null
                : main.governor?.restartPoint(main.player.sessionState.currentIndex) ?? null;
            main.player.pause();
            // Something else is about to speak, and a device speaks one thing at a time. A voice that will
            // take up at the start of the phrase is decided here, once, so that every way back (Surface, a
            // Dive that fails to open, a resume after one) shows that phrase again and times it by the voice.
            if (main.voice?.hold({ exclusive: true, ...(phrase ? { resumeAt: phrase } : {}) }) === true) main.player.restartCurrentAtom();
            const view = main.stream.snapshot();
            const index = view.segments.findIndex(segment => segment.id === position.segmentId);
            const context = view.segments.slice(Math.max(0, index - 1), index + 1)
                .map(segment => clip(segment.text, OPEN_LIMITS.contextText));
            note('branch.open', { question: clip(question, 200), ...position });
            try {
                if (!await openRun({
                    intent: 'dive',
                    prompt: question,
                    parent: { currentId: main.stream.currentId, ...position, context }
                }, 'side')) return;
            } catch (caught) {
                note('branch.failed', { code: caught?.code ?? 'OPEN_FAILED' });
                // Playing again releases the voice with it; a reader who had held it keeps it held.
                if (before === 'live') main.player.play();
                throw caught;
            }
            attachVoice(side);
            set('diving');
            startPumping(side);
        },

        /** Come back. The parent continues from exactly where the Dive left it. */
        async surface() {
            if (!side) throw new LiveRuntimeError('NOT_DIVING', 'There is no Dive to surface from');
            const child = side;
            side = null;
            await closeRun(child);
            if (stopped) return;
            note('branch.close', { currentId: child.stream.currentId });
            await host.present?.({ role: 'main', session: main.player.sessionState.session, player: main.player, run: summary(main) });
            if (stopped) return;
            set(main.finished ? 'ended' : 'live');
            if (main.player.sessionState.state === 'paused') main.player.play();
        },

        /** Everything ends and every timer, voice and connection is released. Safe more than once. */
        async stop() {
            if (stopped) return;
            stopped = true;
            const runs = [side, main];
            side = null;
            for (const run of runs) await closeRun(run);
            set('stopped', error);
            listeners.clear();
        }
    };

    // ─── helpers that need the runs above ───────────────────────────────

    function attachVoice(run) {
        if (!run.voice) return;
        // A renderer is not trusted to stop calling once its run has closed.
        run.voice.attach({
            start: id => {
                if (run.closed) return;
                run.speaking = id; note('speech.start', { role: run.role, segmentId: id }); set(status);
            },
            mark: (id, charIndex, tMs) => { if (!run.closed) run.governor.observe('mark', id, charIndex, tMs); },
            fail: (id, reason) => {
                if (run.closed) return;
                run.governor.standDown('voice-failed');
                note('voice.failed', { role: run.role, segmentId: id, message: String(reason).slice(0, 200) });
            },
            end: (id, durationMs) => {
                if (run.closed) return;
                run.governor.observe('end', id, durationMs);
                if (run.speaking === id) run.speaking = null;
                note('speech.end', { role: run.role, segmentId: id, durationMs });
                set(status);
            }
        });
    }

    /** The reader's semantic position in a run: a segment and a character in it. */
    function where(run, segmentId, atCharacter) {
        const view = run.stream.snapshot();
        if (segmentId !== undefined) {
            const segment = view.segments.find(item => item.id === segmentId && item.ended);
            if (!segment) throw new LiveRuntimeError('POSITION', `No committed segment ${segmentId}`);
            const at = atCharacter ?? 0;
            if (!Number.isInteger(at) || at < 0 || at > segment.text.length) throw new LiveRuntimeError('POSITION', 'That character is outside the segment');
            return { segmentId, atCharacter: at };
        }
        const entry = run.governor.positionOf(run.player.sessionState.currentIndex);
        if (!entry) throw new LiveRuntimeError('POSITION', 'The reader is not on any words yet');
        return entry;
    }
}
