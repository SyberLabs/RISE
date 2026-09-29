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
import { createCurrentStream } from './stream.js';

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
            finished: run.finished,
            error: run.error
        };
    }

    function snapshot() {
        return Object.freeze({ status, error, main: summary(main), side: summary(side) });
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
            session = compileRiseCurrent(run.stream.toCurrent());
        } catch (caught) {
            failRun(run, caught);
            return;
        }
        const segments = ended.map(({ id, text }) => ({ id, text }));
        run.governor.update({ atoms: session.atoms, segments });
        for (const segment of fresh) {
            if (!run.voice) break;
            try {
                run.voice.enqueue({ id: segment.id, text: segment.text });
            } catch (caught) {
                run.governor.standDown('voice-refused');
                note('voice.failed', { role: run.role, message: String(caught?.message ?? caught).slice(0, 200) });
                break;
            }
        }
        run.lowered = ended.length;

        if (!run.player) {
            run.player = createPlayer(session, { role: run.role });
            run.player.setLive(true);
            watchPlayer(run);
            // With no voice there is no clock but the Player’s own.
            if (run.voice) run.governor.install(run.player);
            if (run.role === 'main') set('live');
            host.present?.({ role: run.role, session, player: run.player, run: summary(run) });
            run.player.play();
        } else {
            run.player.extend(session);
        }
        if (run.stream.terminal) run.player.setLive(false);
    }

    function watchPlayer(run) {
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

    async function openRun(request, role) {
        const run = {
            role, request, stream: createCurrentStream(), connection: null, player: null, voice: null, governor: null,
            lowered: 0, closed: false, finished: false, error: null, speaking: null, abort: new AbortController(), pumping: null
        };
        run.connection = await adapter.open(request);
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
        /** The Player of a run, for a host that wants to draw its progress. */
        playerFor(role = 'main') { return (role === 'side' ? side : main)?.player ?? null; },
        /** The reducer's view of a run: what the provider has composed so far. */
        composed(role = 'main') { return (role === 'side' ? side : main)?.stream.snapshot() ?? null; },

        /** Ask. Resolves once the Current has opened; the reading begins as words arrive. */
        async start(prompt) {
            if (status !== 'idle') throw new LiveRuntimeError('ALREADY_STARTED', 'A runtime carries one conversation');
            set('starting');
            try {
                main = await openRun({ intent: 'answer', prompt }, 'main');
            } catch (caught) {
                set('failed', { code: caught?.code ?? 'OPEN_FAILED', message: String(caught?.message ?? caught).slice(0, 300) });
                throw caught;
            }
            note('start', { prompt: clip(prompt, 200) });
            attachVoice(main);
            startPumping(main);
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
            main.player.pause();
            const view = main.stream.snapshot();
            const index = view.segments.findIndex(segment => segment.id === position.segmentId);
            const context = view.segments.slice(Math.max(0, index - 1), index + 1)
                .map(segment => clip(segment.text, OPEN_LIMITS.contextText));
            note('branch.open', { question: clip(question, 200), ...position });
            try {
                side = await openRun({
                    intent: 'dive',
                    prompt: question,
                    parent: { currentId: main.stream.currentId, ...position, context }
                }, 'side');
            } catch (caught) {
                note('branch.failed', { code: caught?.code ?? 'OPEN_FAILED' });
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
            note('branch.close', { currentId: child.stream.currentId });
            host.present?.({ role: 'main', session: main.player.sessionState.session, player: main.player, run: summary(main) });
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
        run.voice.attach({
            start: id => { run.speaking = id; note('speech.start', { role: run.role, segmentId: id }); },
            mark: (id, charIndex, tMs) => run.governor.observe('mark', id, charIndex, tMs),
            end: (id, durationMs) => {
                run.governor.observe('end', id, durationMs);
                if (run.speaking === id) run.speaking = null;
                note('speech.end', { role: run.role, segmentId: id, durationMs });
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
