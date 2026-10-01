import { describeOrigin, describePassage } from './passage.js';
import { interpretVisualControl } from '../visual-control.js';

/**
 * What the reader has in their hands while a Current is on screen.
 *
 * A small bar over the Chamber: one line saying what is happening, a way to
 * interrupt, a place to ask about where they are, Surface when they are in a
 * Dive, Stop, and the words so far as a transcript that works without sight
 * or sound. It draws no reading and keeps no time; it only asks the runtime
 * for things and shows what the runtime says.
 */

/** One plain sentence for what is going on. Pure, so it can be held to what it says. */
export function describeStatus(snapshot, { audible = true, question = '' } = {}) {
    const { status, error, main, side } = snapshot;
    const voiceLost = (side ?? main)?.voiceDegraded === true;
    const quiet = voiceLost ? ' The voice stopped; the reading carries on at its own pace.' : '';
    // What arrived is still read, so a failure after some of it must be said, or the reading looks finished.
    const early = main?.error ? ` The answer stopped early: ${String(main.error.message ?? 'the provider failed').slice(0, 200).replace(/\.+$/u, '')}.` : '';
    switch (status) {
        case 'idle':
            return '';
        case 'starting':
            return 'Asking…';
        case 'live': {
            const said = audible ? 'Speaking.' : 'Reading, paced as if spoken.';
            return `${main?.speaking || !main?.voiceDegraded ? said : 'Reading.'}${early}${quiet}`;
        }
        case 'interrupted':
            return 'Held where you are. Resume, or ask about this place.';
        case 'diving': {
            const asked = question ? ` “${question.slice(0, 120)}”` : '';
            if (side?.error) return `The Dive could not be answered (${side.error.message}). Surface to go back.`;
            return side?.finished
                ? `Dive${asked}: answered. Surface to go back to where you were; you can ask about another place from there.`
                : `Diving${asked}. The reading you left is held exactly where it was. Surface to go back, then ask again.${quiet}`;
        }
        case 'ended':
            return main?.error
                ? `Finished reading what arrived.${early} You can still ask about any place in it.`
                : 'Finished. You can still ask about any place in it.';
        case 'failed':
            return `It could not be answered: ${error?.message ?? 'the provider failed'}.`;
        case 'stopped':
            return 'Stopped.';
        default:
            return '';
    }
}

/**
 * @param {object} options
 * @param {object} options.runtime a live runtime
 * @param {() => void} options.onStop what Stop does (the host ends the session)
 * @param {boolean} [options.audible] whether the voice makes sound; a silent one is said to be pacing
 * @param {object} [options.mic] speaking to it, where the browser can listen: `{ createListener, interpret, describe, privacy, privacyLead }`
 *   (src/live/mic); without it there is no Speak button at all
 * @param {Document} [options.doc]
 */
export function createLiveControls({ runtime, onStop, audible = true, mic = null, doc = document }) {
    const root = doc.createElement('section');
    root.id = 'live-controls';
    root.className = 'live-controls';
    root.setAttribute('aria-label', 'Live Current controls');
    root.innerHTML = `
      <p class="live-controls__status" role="status" aria-live="polite"></p>
      <p class="live-controls__error" role="alert" hidden></p>
      <form class="live-controls__ask" novalidate>
        <label class="live-controls__sr" for="live-controls-question">Ask about this place</label>
        <input id="live-controls-question" name="question" type="text" maxlength="500" autocomplete="off"
               placeholder="Wait — dive on the event horizon">
        <button type="button" data-live="dive" aria-label="Dive: ask about this place">Dive</button>
      </form>
      <form class="live-controls__visual" novalidate>
        <label class="live-controls__sr" for="live-controls-visual">Visual change</label>
        <input id="live-controls-visual" name="visual" type="text" maxlength="120" autocomplete="off" placeholder="more vibrant">
        <button type="button" data-live="visual-submit">Change visual</button>
      </form>
      <div class="live-controls__buttons">
        <button type="button" data-live="interrupt">Interrupt</button>
        <button type="button" data-live="listen" aria-pressed="false" aria-describedby="live-controls-mic-privacy" hidden>Speak</button>
        <button type="button" data-live="listen-visual" aria-pressed="false" aria-describedby="live-controls-mic-privacy" hidden>Listen for a visual change</button>
        <button type="button" data-live="surface" hidden>Surface</button>
        <button type="button" data-live="stop">Stop</button>
      </div>
      <p class="live-controls__mic" hidden></p>
      <details class="live-controls__mic-note" hidden><summary></summary><p id="live-controls-mic-privacy"></p></details>
      <details class="live-controls__passage">
        <summary>About this passage</summary>
        <div class="live-passage">
          <p class="live-passage__origin" hidden></p>
          <h3>Meant to be</h3>
          <p class="live-passage__note">What this passage is meant to be like. It says nothing about you.</p>
          <ul class="live-passage__condition"></ul>
          <h3>Sources</h3>
          <ul class="live-passage__sources"></ul>
          <h3>Going deeper</h3>
          <ul class="live-passage__depth"></ul>
        </div>
      </details>
      <details class="live-controls__transcript">
        <summary>Transcript</summary>
        <ol class="live-controls__lines" aria-label="What has been said so far"></ol>
      </details>`;
    doc.body.appendChild(root);

    const $ = selector => root.querySelector(selector);
    const statusLine = $('.live-controls__status');
    const errorLine = $('.live-controls__error');
    const form = $('.live-controls__ask');
    const input = $('input[name="question"]');
    const visualInput = $('input[name="visual"]');
    const dive = $('[data-live="dive"]');
    const interrupt = $('[data-live="interrupt"]');
    const surface = $('[data-live="surface"]');
    const listen = $('[data-live="listen"]');
    const listenVisual = $('[data-live="listen-visual"]');
    const micLine = $('.live-controls__mic');
    const micNote = $('.live-controls__mic-note');
    const lines = $('.live-controls__lines');
    const passageOrigin = $('.live-passage__origin');
    const passageCondition = $('.live-passage__condition');
    const passageSources = $('.live-passage__sources');
    const passageDepth = $('.live-passage__depth');
    let question = '';
    let shownLines = '';
    let shownPassage = '';
    let destroyed = false;
    let listener = null;
    let heldByMic = false;
    let micMode = null;
    let visualOutcome = '';

    const show = message => {
        errorLine.textContent = message ?? '';
        errorLine.hidden = !message;
    };

    const attempt = async work => {
        show('');
        try {
            await work();
        } catch (error) {
            show(String(error?.message ?? error).slice(0, 200));
        }
    };

    function transcript(snapshot) {
        const view = runtime.composed(snapshot.status === 'diving' ? 'side' : 'main');
        const said = view ? view.segments.filter(segment => segment.ended).map(segment => segment.text) : [];
        const key = `${snapshot.status === 'diving' ? 's' : 'm'}:${said.length}`;
        if (key === shownLines) return;
        shownLines = key;
        lines.replaceChildren(...said.map(sentence => {
            const item = doc.createElement('li');
            item.textContent = sentence;
            return item;
        }));
    }

    const item = (text, className) => {
        const node = doc.createElement('li');
        node.textContent = text;
        if (className) node.className = className;
        return node;
    };

    /** Everything said about the passage the reader is in, drawn as words. */
    function passage(snapshot) {
        const role = snapshot.status === 'diving' ? 'side' : 'main';
        const view = runtime.composed(role);
        const described = describePassage(view, snapshot[role]?.segmentId ?? null);
        const origin = role === 'side' ? describeOrigin(view?.origin) : '';
        const key = JSON.stringify([role, origin, described]);
        if (key === shownPassage) return;
        shownPassage = key;
        passageOrigin.textContent = origin;
        passageOrigin.hidden = !origin;

        passageCondition.replaceChildren(...(described?.condition.length
            ? described.condition.map(entry => item(`${entry.label}: ${entry.word}`))
            : [item('Nothing was said about how this passage is meant to be.', 'live-passage__none')]));

        passageSources.replaceChildren(...(described?.sources.length
            ? described.sources.map(source => {
                const li = doc.createElement('li');
                li.dataset.kind = source.kind;
                const kind = doc.createElement('strong');
                kind.className = 'live-passage__kind';
                kind.textContent = source.kindLabel;
                li.append(kind);
                const title = doc.createElement('cite');
                title.textContent = source.title;
                li.append(': ', title);
                if (source.location) li.append(`, ${source.location}`);
                if (source.supports) li.append(` — supports “${source.supports}”`);
                if (source.href) {
                    const link = doc.createElement('a');
                    link.href = source.href;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = 'Open the source';
                    li.append(' ', link);
                } else if (source.uri) {
                    li.append(` (address: ${source.uri})`);
                }
                return li;
            })
            : [item('No source was given for this passage.', 'live-passage__none')]));

        passageDepth.replaceChildren(
            ...(described?.notes ?? []).map(note => item(`Note written with the answer${note.about ? `, about “${note.about}”` : ''}: ${note.text}`)),
            item('Ask your own question above: the answer is written now, for you, and marked as the model’s.')
        );
    }

    function render(snapshot) {
        if (destroyed) return;
        const { status } = snapshot;
        statusLine.textContent = [describeStatus(snapshot, { audible, question }), visualOutcome].filter(Boolean).join(' ');
        const canAsk = status === 'live' || status === 'interrupted' || status === 'ended';
        // A Dive that is still connecting is already the runtime's side run.
        const canDive = canAsk && !snapshot.side;
        input.disabled = !canDive;
        dive.disabled = !canDive;
        surface.hidden = status !== 'diving';
        interrupt.hidden = status === 'diving' || status === 'ended' || status === 'failed' || status === 'stopped' || status === 'starting';
        interrupt.textContent = status === 'interrupted' ? 'Resume' : 'Interrupt';
        interrupt.dataset.live = status === 'interrupted' ? 'resume' : 'interrupt';
        if (listener) {
            listen.hidden = !(canAsk || status === 'diving');
            listenVisual.hidden = !(['live', 'interrupted', 'diving'].includes(status));
            if (status === 'failed' || status === 'stopped') listener.cancel();
        }
        if (status === 'failed' && snapshot.error) show(snapshot.error.message);
        transcript(snapshot);
        passage(snapshot);
    }

    // ─── speaking to it ────────────────────────────────────────────────
    // Only where the browser can listen (`mic`); it does nothing the buttons do not. What is heard is
    // matched against a closed list (src/live/mic/interpret.js) and anything else is put in the box
    // for the reader to read, change, and send themselves.

    const say = message => {
        micLine.textContent = message;
        micLine.hidden = !message;
    };

    /** Give up listening, and let go of a reading that only the microphone was holding. */
    const stopListening = () => {
        listener?.cancel();
        heldByMic = false;
        micMode = null;
    };

    const letGo = () => {
        if (heldByMic && runtime.status === 'interrupted') runtime.resume();
        heldByMic = false;
    };

    const ask = async asked => {
        question = asked;
        input.value = '';
        await runtime.dive({ question: asked });
        surface.focus();
    };

    function heard(words) {
        if (micMode === 'visual') {
            micMode = null;
            say(`Heard “${words.slice(0, 120)}”.`);
            if (interpretVisualControl(words)) applyVisualControl();
            else say(`Heard “${words.slice(0, 120)}”. Only “more vibrant” is available for visual changes.`);
            return;
        }
        const said = mic.interpret(words);
        const held = heldByMic;
        heldByMic = false;
        say('');
        void attempt(async () => {
            switch (said.intent) {
                case 'none':
                    if (held && runtime.status === 'interrupted') runtime.resume();
                    break;
                case 'surface':
                    if (runtime.status === 'diving') await runtime.surface();
                    else if (runtime.status === 'interrupted') runtime.resume();
                    question = '';
                    break;
                case 'resume':
                    if (runtime.status === 'interrupted') runtime.resume();
                    break;
                case 'hold':
                    if (runtime.status === 'live') runtime.hold({ text: said.heard });
                    break;
                case 'dive':
                    await ask(said.question);
                    break;
                default:
                    if (runtime.status === 'live') runtime.hold({ text: said.heard });
                    input.value = said.heard;
                    input.focus();
                    say(`Heard “${said.heard.slice(0, 120)}”. Press Dive to ask it, or Resume.`);
            }
        });
    }

    if (mic) {
        listener = mic.createListener({
            onInterim: words => say(`${micMode === 'visual' ? 'Listening for a visual change' : 'Hearing'}: “${words.slice(0, 120)}”`),
            onFinal: heard,
            onState: state => {
                const active = state === 'starting' || state === 'listening';
                listen.setAttribute('aria-pressed', String(active && micMode === 'question'));
                listenVisual.setAttribute('aria-pressed', String(active && micMode === 'visual'));
                say(state === 'idle' ? '' : mic.describe(state));
                if (!active && state !== 'idle') {
                    if (micMode === 'question') letGo();
                    micMode = null;
                }
            }
        });
        micLine.setAttribute('role', 'status');
        micLine.setAttribute('aria-live', 'polite');
        micNote.querySelector('summary').textContent = mic.privacyLead;
        micNote.querySelector('p').textContent = mic.privacy;
        micNote.hidden = false;
        const startListening = mode => {
            if (listener.listening) {
                if (micMode === mode) { listener.stop(); return; }
                const abandonedMode = micMode;
                listener.cancel();
                if (abandonedMode === 'question') letGo();
            }
            show('');
            micMode = mode;
            heldByMic = false;
            if (mode === 'question' && runtime.status === 'live') {
                try {
                    runtime.hold();
                    heldByMic = true;
                } catch { /* it is no longer live; listening still works */ }
            }
            listener.start();
        };
        listen.addEventListener('click', () => startListening('question'));
        listenVisual.addEventListener('click', () => startListening('visual'));
    }

    function visualRefusalMessage(code) {
        if (code === 'NOT_LIVE') return 'Visual changes are available while a reading is playing.';
        return 'There is no adjustable visual on screen right now.';
    }

    function applyVisualControl() {
        const discovery = runtime.discoverVisual?.();
        const target = discovery?.target?.intensity ?? discovery?.current?.intensity;
        if (!Number.isFinite(target)) {
            visualOutcome = visualRefusalMessage('NO_ACTIVE_VISUAL');
            show(visualOutcome);
            render(runtime.snapshot());
            return;
        }
        const next = Math.min(0.75, target + 0.1);
        const receipt = runtime.controlVisual?.({ surface: 'attractor', parameter: 'intensity', value: next });
        if (receipt?.status === 'accepted') {
            visualOutcome = next === target
                ? 'The visual is already at its brightness limit.'
                : `Visual brightness target changed to ${receipt.effective.toFixed(2)}.`;
            show('');
        } else {
            visualOutcome = visualRefusalMessage(receipt?.code);
            show(visualOutcome);
        }
        render(runtime.snapshot());
    }

    const submitVisual = () => {
        const words = visualInput.value;
        if (!interpretVisualControl(words)) {
            const message = 'Only “more vibrant” is available for visual changes.';
            visualOutcome = '';
            show(message);
            return;
        }
        visualOutcome = '';
        show('');
        applyVisualControl();
    };
    $('[data-live="visual-submit"]').addEventListener('click', submitVisual);
    visualInput.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.isComposing) return;
        event.preventDefault();
        submitVisual();
    });

    interrupt.addEventListener('click', () => {
        stopListening();
        void attempt(async () => {
            if (runtime.status === 'interrupted') runtime.resume();
            else await runtime.interrupt({ text: input.value.trim() || undefined });
        });
    });
    // Asked by the button and by Enter, and not by submitting the form: a frame that is sandboxed
    // without `allow-forms` (as an MCP host may make it) never fires a form's submit event.
    const submitAsk = () => {
        const asked = input.value.trim();
        if (!asked) {
            input.focus();
            return;
        }
        stopListening();
        void attempt(() => ask(asked));
    };
    dive.addEventListener('click', submitAsk);
    input.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.isComposing) return;
        event.preventDefault();
        submitAsk();
    });
    form.addEventListener('submit', event => {
        event.preventDefault();
        submitAsk();
    });
    surface.addEventListener('click', () => {
        stopListening();
        void attempt(async () => {
            await runtime.surface();
            question = '';
        });
    });
    $('[data-live="stop"]').addEventListener('click', () => { void attempt(async () => onStop()); });

    const off = runtime.subscribe(render);
    render(runtime.snapshot());

    return {
        element: root,
        destroy() {
            if (destroyed) return;
            destroyed = true;
            listener?.destroy();
            off();
            root.remove();
        }
    };
}
