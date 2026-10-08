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
 * When the reader moves the reading (seek, replay, setPace), the voice moves
 * first and the words follow it: a seek re-anchors the voice at the start of a
 * passage, and the pace is the voice's rate. There is no second clock.
 *
 * Two records, deliberately apart. The reducer's stream is the record of what
 * the provider composed, and is sealed when the Current completes. Composition
 * finishes long before speech does, so what the reader lived through
 * (interruptions, Dives, where speech was) is kept here, in a bounded journal.
 *
 * A Dive is a Current of its own. Nested Dives are not built and are refused.
 */

import { compileRiseCurrent } from '../core/rise-current.js';
import { lookTheme, lowerCurrentLook } from '../core/current-look.js';
import { AdapterError, OPEN_LIMITS, assertAdapter } from './adapter.js';
import { createRealClock } from './clock.js';
import { createSpeechGovernor } from './speech-governor.js';
import { createBeatConductor } from './beat-conductor.js';
import { withExperientialState } from './state-visuals.js';
import { createCurrentStream } from './stream.js';
import { ATTRACTOR_VISUAL_MANIFEST, validateVisualCommand } from '../core/visual-control-contract.js';

/** voiceTailMs: how long a reading whose words have all been shown waits for its voice to finish saying them. */
export const RUNTIME_LIMITS = Object.freeze({ reconnects: 3, backoffMs: 250, journal: 500, voiceTailMs: 20_000 });

export class LiveRuntimeError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'LiveRuntimeError';
        this.code = code;
    }
}

const clip = (text, length) => (text.length <= length ? text : text.slice(0, length));

export function createLiveRuntime({
    adapter, createPlayer, host = {}, voices = null, clock = createRealClock(), graceMs, reconnects = RUNTIME_LIMITS.reconnects,
    // Told every journal entry as it is written, so a host can show the voice's trace where a reader can copy it.
    onNote = null
}) {
    assertAdapter(adapter);
    if (typeof createPlayer !== 'function') throw new TypeError('A runtime is handed the host’s Player factory');

    let status = 'idle';
    let error = null;
    let main = null;
    let side = null;
    let stopped = false;
    /** The voice's rate, as the reader set it: 1 is the voice's own. */
    let pace = 1;
    const journal = [];
    const listeners = new Set();

    // ─── what the host can see ──────────────────────────────────────────

    function note(type, body = {}) {
        const entry = { at: clock.now(), type, ...body };
        journal.push(entry);
        if (journal.length > RUNTIME_LIMITS.journal) journal.shift();
        if (onNote) { try { onNote({ ...entry }); } catch { /* a listener may not break the runtime */ } }
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
        return Object.freeze({ status, error, main: summary(main), side: summary(side), pace, position: positionOf(main) });
    }

    /**
     * The passages of a run's reading in order, each with the atom a seek takes it up at: the seam before it when
     * the voice opens that seam (the words then begin when the voice does), else its first atom.
     */
    function passagesOf(run) {
        const { session } = run.player.sessionState;
        if (run.passages?.session === session) return run.passages.list;
        const list = [];
        session.atoms.forEach((atom, index) => {
            if (atom.seam || !atom.sourceId || atom.sourceId === list.at(-1)?.id) return;
            const seam = session.atoms[index - 1];
            list.push({ id: atom.sourceId, first: seam?.seam && !seam.beatTimed ? index - 1 : index });
        });
        run.passages = { session, list };
        return list;
    }

    /** Where a run's reading is: the passage, among all of them, the atom, and whether a voice says that passage. */
    function positionOf(run) {
        if (!run?.player) return null;
        const list = passagesOf(run);
        if (list.length === 0) return null;
        const { currentIndex: atomIndex, session } = run.player.sessionState;
        const at = Math.max(0, list.findLastIndex(passage => passage.first <= atomIndex));
        const { id } = list[at];
        return Object.freeze({
            segmentId: id, segmentIndex: at, segmentCount: list.length,
            atomIndex, atomCount: session.atoms.length, spoken: !run.unspokenIds?.has(id)
        });
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

    /**
     * A beat's cue, as the running engine's commands the compiler lowered it to, each through controlVisual.
     * `instant`: an earlier beat's cue landed at once after a seek, which the host passes on to the scene.
     */
    function cueScene(commands, instant) {
        for (const command of commands) controlVisual(command, { instant });
    }

    function controlVisual(command, { instant = false } = {}) {
        const run = visualRun();
        // The running engine's own manifest bounds the command; the attractor's stands in before anything is shown.
        const discovered = discoverVisual()?.manifest;
        const manifest = discovered?.parameters ? discovered : ATTRACTOR_VISUAL_MANIFEST;
        const checked = validateVisualCommand(command, manifest);
        if (!checked.ok) return recordVisualReceipt(run, visualRefusal(checked.code));
        if (!visualRunIsActive(run)) return recordVisualReceipt(run, visualRefusal('NOT_LIVE'));
        if (!run.presented) return recordVisualReceipt(run, visualRefusal());
        if (!visualRunIsLive(run)) return recordVisualReceipt(run, visualRefusal('NOT_LIVE'));
        if (typeof host.controlVisual !== 'function') return recordVisualReceipt(run, visualRefusal());
        let response;
        try {
            response = host.controlVisual({ role: run.role, player: run.player, command: checked.command, ...(instant === true ? { instant: true } : {}) });
        } catch {
            response = visualRefusal();
        }
        const spec = manifest.parameters[checked.command.parameter];
        const kept = spec.type === 'enum' || spec.type === 'name'
            ? response?.effective === checked.command.value
            : Number.isFinite(response?.effective) && response.effective >= spec.minimum && response.effective <= spec.maximum;
        const receipt = response?.status === 'accepted' && kept
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
            // A sealed Current is compiled whole (its beats never pass through the stream); a streamed one is rebuilt.
            let current = run.connection?.sealed ?? run.stream.toCurrent();
            // A Dive keeps the colors of the answer it comes from, whatever it said of itself.
            if (run.role === 'side') {
                const { theme: _own, ...rest } = current;
                const answer = main.stream.snapshot();
                const theme = answer.theme ?? lookTheme(answer.look);
                current = theme === null ? rest : { ...rest, theme };
            }
            session = compileRiseCurrent(current, { lowerLook: lowerCurrentLook });
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
        // Passages no voice says: a hold, or a beat shown for a while (rise-current.js).
        run.unspokenIds = session.unspokenIds ?? null;
        // Spoken passages that follow one of those: each is given to the voice when the reading reaches it (see speak).
        run.voiceWaitsFor = session.voiceWaitsFor ?? null;
        // Words are given to the voice once the reading is on screen (see speak): a voice
        // that began while the host was still mounting would say the first words unseen.
        run.unspoken.push(...fresh);
        if (run.presented) speak(run);
        run.lowered = ended.length;
        set(status);

        if (!run.player) {
            run.player = createPlayer(session, { role: run.role });
            run.player.setLive(true);
            if (run.role === 'main' && pace !== 1) run.player.setSpeedFactor(1 / pace);
            watchPlayer(run);
            // With no voice there is no clock but the Player’s own.
            // With a voice, the conductor is asked first: it times what no voice says, and declines the rest to the governor.
            if (run.voice) {
                run.conductor.install(run.player);
                run.governor.install(run.player);
            }
            if (run.role === 'main') set('live');
            // The host may need a moment to put the Player on screen; the reading starts when it has.
            run.presenting = Promise.resolve(host.present?.({ role: run.role, session, player: run.player, run: summary(run) }))
                .then(() => {
                    if (run.closed) return;
                    run.presented = true;
                    speak(run);
                    // A reader who interrupted while the Chamber was being presented stays held:
                    // the reading begins on Resume, which plays an idle Player.
                    const held = run.role === 'main' && status === 'interrupted';
                    if (run.player.sessionState.state === 'idle' && !held) run.player.play();
                })
                .catch(caught => failRun(run, caught));
        } else {
            run.player.extend(session);
        }
        if (run.stream.terminal) run.player.setLive(false);
    }

    /**
     * Give the voice what has been committed and not yet handed to it. A passage after one no voice says
     * waits, with all after it, until the reading reaches it: a voice given it at once would say it during the hold.
     */
    function speak(run) {
        const waits = run.unspoken.findIndex(segment => run.voiceWaitsFor?.has(segment.id) && segment.id !== run.segmentId);
        const fresh = run.unspoken.splice(0, waits < 0 ? run.unspoken.length : waits);
        if (!run.voice) return;
        for (const segment of fresh) {
            if (run.unspokenIds?.has(segment.id)) continue;
            try {
                run.voice.enqueue({ id: segment.id, text: segment.text });
                run.owed.add(segment.id);
                run.given.push(segment.id);
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
                if (run.unspoken.length > 0) speak(run);
                set(status);
            }
        });
        run.player.on('state', ({ state }) => {
            if (run.closed) return;
            if (state === 'paused') holdVoice(run);
            else if (state === 'playing') { if (run.voice) note('voice.released', { role: run.role, segmentId: run.speaking ?? null }); run.voice?.release(); }
            else if (state === 'complete') {
                run.finished = true;
                run.completedAt = clock.now();
                settle(run);
            }
        });
    }

    /**
     * The words have all been shown; the reading is over when the voice has said what it was given too, so the end
     * is never shown under a voice still talking. A voice that never finishes is waited for `voiceTailMs` at most.
     */
    function settle(run) {
        if (run.owed.size === 0) { endRun(run); return; }
        run.tail ??= clock.setTimer(() => endRun(run), RUNTIME_LIMITS.voiceTailMs);
    }

    function endRun(run) {
        if (run.closed || run.ended) return;
        run.ended = true;
        run.tail?.();
        run.tail = null;
        const voiceTailMs = Math.round(clock.now() - run.completedAt);
        note('run.finished', { role: run.role, ...(voiceTailMs > 0 ? { voiceTailMs } : {}) });
        if (run.role === 'main' && (status === 'live' || status === 'interrupted')) set('ended');
        else set(status);
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
            // A run that already failed (the compiler refused what the validator accepted) keeps its own reason.
            if (!run.player && !run.error) {
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
            role, request, stream: createCurrentStream(), connection: null, player: null, voice: null, governor: null, conductor: null, unspokenIds: null,
            lowered: 0, presenting: null, presented: false, unspoken: [], segmentId: null, closed: false, finished: false, error: null, speaking: null, abort: new AbortController(), pumping: null,
            // Passages the voice was given and has not finished or failed; the run ends when none are left.
            owed: new Set(), completedAt: null, tail: null, ended: false,
            // Every passage the voice was given, in the reading's order (a seek gives the voice the rest again); the passages a seek goes to.
            given: [], passages: null
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
        if (role === 'main' && pace !== 1) {
            run.voice?.setRate?.(pace);
            run.governor.rescale(1 / pace);
        }
        run.conductor = createBeatConductor({
            clock,
            onCue: ({ commands, instant }) => cueScene(commands, instant),
            // A hold the running scene may end early is the host's to ask of the scene (Chamber.holdScene).
            onHold: atom => {
                if (run.closed || typeof host.holdScene !== 'function') return null;
                try {
                    return host.holdScene({ role: run.role, player: run.player, atom }) ?? null;
                } catch {
                    return null;
                }
            }
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
        run.tail?.();
        run.tail = null;
        run.conductor?.dispose();
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
        controlVisual: command => controlVisual(command),
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
            // A Player that has not begun sends no pause, so the voice is held here too.
            main.voice?.hold();
            note('hold', { reason: 'user', ...(text ? { text: clip(text, 200) } : {}) });
            set('interrupted');
        },

        /** Barge in: hold everything where it is, and tell the provider to stop composing if it still is. */
        async interrupt({ text } = {}) {
            if (!main?.player || status !== 'live') throw new LiveRuntimeError('NOT_LIVE', 'There is nothing to interrupt');
            main.player.pause();
            // A Player that has not begun sends no pause, so the voice is held here too.
            main.voice?.hold();
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
            // A Player whose words are all shown does not play again, so the voice saying the last of them is let go here.
            if (main.finished && !main.ended) main.voice?.release();
        },

        /** Where the reading is: { segmentId, segmentIndex, segmentCount, atomIndex, atomCount, spoken }, or null before it has words. */
        position() {
            return positionOf(main);
        },

        /**
         * Move the reading to the start of a passage (`segmentId`), or `delta` passages on or back. The voice moves
         * first and the words follow it there. A held reading stays held; an ended one is live again from there.
         */
        seek({ segmentId, delta } = {}) {
            const run = movable();
            const list = passagesOf(run);
            const to = segmentId !== undefined || !Number.isInteger(delta)
                ? segmentId
                : list[Math.min(list.length - 1, Math.max(0, positionOf(run).segmentIndex + delta))].id;
            if (!list.some(passage => passage.id === to)) throw new LiveRuntimeError('POSITION', 'There is no such passage in the reading');
            moveTo(run, to, 'seek');
        },

        /** Say the passage the reader is in again, from its start. */
        replay() {
            const run = movable();
            moveTo(run, positionOf(run).segmentId, 'replay');
        },

        /**
         * The voice's rate, from half to twice its own. The voice takes it at once; the speech clock rescales what
         * it measured; the Player's timers follow it for what no voice says. Where the reader is does not move.
         */
        setPace(rate) {
            if (!Number.isFinite(rate) || rate < 0.5 || rate > 2) throw new LiveRuntimeError('PACE', 'A pace is between half and twice the voice’s own');
            const before = pace;
            pace = rate;
            main?.voice?.setRate?.(rate);
            main?.governor?.rescale(before / rate);
            main?.player?.setSpeedFactor(1 / rate);
            note('pace', { rate });
            set(status);
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
            if (main.voice?.hold(phrase ? { resumeAt: phrase } : undefined) === true) main.player.restartCurrentAtom();
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

    /**
     * Hold a run's voice where its words are. A held voice is silenced, not paused (voices/browser.js), and is
     * told where the phrase on screen begins; when it takes up there, that phrase is shown again from its start,
     * so after a pause or a hidden page the voice and the words begin it together. Held between two passages, the
     * seam is taken up again too, so the next passage is shown when the voice begins it, not on the seam's own clock.
     */
    function holdVoice(run) {
        if (!run.voice) return;
        const phrase = run.player.betweenPhrases ? null : run.governor?.restartPoint(run.player.sessionState.currentIndex) ?? null;
        const takenUp = run.voice.hold(phrase ? { resumeAt: phrase } : undefined) === true;
        note('voice.held', { role: run.role, segmentId: run.speaking ?? null, ...(phrase ? { resumeAt: phrase.charIndex } : {}), restarts: takenUp });
        if (takenUp || run.player.sessionState.currentAtom?.seam) run.player.restartCurrentAtom();
    }

    /** The run a reader's seek moves: the main one, while it is read, held or ended. */
    function movable() {
        if (!main?.player || (status !== 'live' && status !== 'interrupted' && status !== 'ended')) {
            throw new LiveRuntimeError('NOT_LIVE', 'There is nothing to move');
        }
        return main;
    }

    /**
     * Take the reading to the start of passage `to`. The voice first: what it says stops, it forgets this passage
     * and every later one it was given, and is given them again from here in the reading's order, as speak gives
     * them. The speech clock forgets their timing and is the clock again if it had stood down; the conductor lands
     * the running scene's earlier cues at once; then the Player goes to the passage's first atom.
     */
    function moveTo(run, to, type) {
        const list = passagesOf(run);
        const at = list.findIndex(passage => passage.id === to);
        const order = new Map(list.map((passage, index) => [passage.id, index]));
        note(type, { from: positionOf(run).segmentId, to, reason: 'reader' });

        const kept = run.given.findIndex(id => order.get(id) >= at);
        run.voice?.seek(kept < 0 ? to : run.given[kept]);
        if (kept >= 0) run.given.length = kept;
        run.owed.clear();
        run.speaking = null;
        const recovered = run.governor.degraded;
        run.governor.forget(to);
        if (recovered) note('voice.recovered', { role: run.role });
        run.segmentId = to;
        run.unspoken = run.stream.snapshot().segments.filter(segment => segment.ended).slice(0, run.lowered)
            .filter(segment => order.get(segment.id) >= at);
        if (run.presented) speak(run);

        run.conductor.seek(run.player.sessionState.session.atoms, list[at].first);
        const ended = status === 'ended';
        run.tail?.();
        run.tail = null;
        run.finished = false;
        run.ended = false;
        run.completedAt = null;
        if (ended) set('live');
        run.player.seekTo(list[at].first);
        if (ended) run.player.play();
        set(status);
    }

    function attachVoice(run) {
        if (!run.voice) return;
        note('voice.chosen', { role: run.role, kind: run.voice.id, name: run.voice.chosen?.name ?? null, local: run.voice.chosen?.local ?? null });
        // A renderer is not trusted to stop calling once its run has closed.
        run.voice.attach({
            start: id => {
                if (run.closed) return;
                run.speaking = id; note('speech.start', { role: run.role, segmentId: id }); set(status);
            },
            mark: (id, charIndex, tMs) => { if (!run.closed) run.governor.observe('mark', id, charIndex, tMs); },
            // Something else on the device stopped the voice. The reading is held where it is, as a reader's Pause
            // holds it, rather than going on in silence; Play takes up the phrase on screen with the voice.
            taken: (id, reason) => {
                if (run.closed) return;
                note('voice.taken', { role: run.role, segmentId: id, reason });
                // Taken while saying the last words, after they were all shown: it will not go on, so the reading is over.
                if (run.finished) endRun(run);
                else if (run.role === 'main' && status === 'live') {
                    run.player.pause();
                    set('interrupted');
                } else if (run.role === 'side') {
                    // A Dive has no Play of its own on the stage to take the voice up again, so it is not held:
                    // its clock stands down and the Dive finishes on the timer rather than waiting on a voice
                    // that will not resume. Holding a Dive comes with the Dive, when it returns to scope.
                    run.governor.standDown('voice-taken');
                }
            },
            restarted: (id, afterMs) => { if (!run.closed) note('voice.restarted', { role: run.role, segmentId: id, afterMs }); },
            fail: (id, reason) => {
                if (run.closed) return;
                run.governor.standDown('voice-failed');
                note('voice.failed', { role: run.role, segmentId: id, message: String(reason).slice(0, 200) });
                run.owed.delete(id);
                if (run.finished) settle(run);
            },
            end: (id, durationMs) => {
                if (run.closed) return;
                run.governor.observe('end', id, durationMs);
                if (run.speaking === id) run.speaking = null;
                note('speech.end', { role: run.role, segmentId: id, durationMs });
                run.owed.delete(id);
                if (run.finished) settle(run);
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
