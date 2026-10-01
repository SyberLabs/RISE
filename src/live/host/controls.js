import { describeOrigin, describePassage } from './passage.js';
import { describeCrumb, describeDive, describeTurn, forksBySegment } from './undercurrent.js';

/**
 * What the reader has in their hands while a Current is on screen.
 *
 * A small bar over the Chamber: one line saying what is happening, a way to
 * interrupt, a place to ask about where they are, Surface when they are in a
 * Dive, Stop, the words so far as a transcript that works without sight or
 * sound, and the undercurrent: every Dive taken, where from, and what was asked
 * and answered in it. It draws no reading and keeps no time; it only asks the runtime
 * for things and shows what the runtime says.
 */

/** One plain sentence for what is going on. Pure, so it can be held to what it says. */
export function describeStatus(snapshot, { audible = true, question = '' } = {}) {
    const { status, error, main, side, dive } = snapshot;
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
            if (dive?.opening) return 'Asking…';
            if (!side) return 'The question could not be opened. Ask again, or Surface to go back.';
            if (side.error) return `The Dive could not be answered (${side.error.message}). Ask again, or Surface to go back.`;
            return side.finished
                ? `Dive${asked}: answered. Ask a follow-up here, or Surface to go back to where you were.`
                : `Diving${asked}. The reading you left is held exactly where it was. Ask a follow-up, or Surface to go back.${quiet}`;
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
      <p class="live-controls__crumb" hidden><span class="live-controls__trail"></span> <span class="live-controls__returns"></span></p>
      <p class="live-controls__error" role="alert" hidden></p>
      <form class="live-controls__ask" novalidate>
        <label class="live-controls__sr" for="live-controls-question">Ask about this place</label>
        <input id="live-controls-question" name="question" type="text" maxlength="500" autocomplete="off"
               placeholder="Wait — dive on the event horizon">
        <button type="button" data-live="dive" aria-label="Dive: ask about this place">Dive</button>
      </form>
      <div class="live-controls__buttons">
        <button type="button" data-live="interrupt">Interrupt</button>
        <button type="button" data-live="listen" aria-pressed="false" aria-describedby="live-controls-mic-privacy" hidden>Speak</button>
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
      <details class="live-controls__undercurrent" hidden>
        <summary></summary>
        <ol class="live-undercurrent" aria-label="Every Dive you have taken"></ol>
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
    const dive = $('[data-live="dive"]');
    const interrupt = $('[data-live="interrupt"]');
    const surface = $('[data-live="surface"]');
    const listen = $('[data-live="listen"]');
    const micLine = $('.live-controls__mic');
    const micNote = $('.live-controls__mic-note');
    const lines = $('.live-controls__lines');
    const crumb = $('.live-controls__crumb');
    const trail = $('.live-controls__trail');
    const returns = $('.live-controls__returns');
    const undercurrent = $('.live-controls__undercurrent');
    const dives = $('.live-undercurrent');
    const passageOrigin = $('.live-passage__origin');
    const passageCondition = $('.live-passage__condition');
    const passageSources = $('.live-passage__sources');
    const passageDepth = $('.live-passage__depth');
    let question = '';
    let shownLines = '';
    let shownPassage = '';
    let shownDives = '';
    // Dives to open the next time the panel is drawn (a marker was pressed).
    const wanted = new Set();
    let destroyed = false;
    let listener = null;
    let heldByMic = false;

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

    /** Open a Dive in the panel, and put the reader's place on it. */
    function showDive(id) {
        wanted.add(id);
        undercurrent.open = true;
        drawDives(runtime.snapshot(), true);
        const summary = dives.querySelector(`details[data-dive="${id}"] > summary`);
        summary?.focus();
        summary?.scrollIntoView?.({ block: 'nearest' });
    }

    function transcript(snapshot, all) {
        const inDive = snapshot.status === 'diving';
        const view = runtime.composed(inDive ? 'side' : 'main');
        const said = view ? view.segments.filter(segment => segment.ended) : [];
        // The places the reader has dived from are marked in the reading they left, not in a Dive's own answer.
        const forks = inDive ? new Map() : forksBySegment(all);
        const key = `${inDive ? 's' : 'm'}:${said.length}:${JSON.stringify([...forks])}`;
        if (key === shownLines) return;
        shownLines = key;
        lines.replaceChildren(...said.map(segment => {
            const item = doc.createElement('li');
            item.append(segment.text);
            const here = forks.get(segment.id);
            if (here?.length) {
                const list = doc.createElement('ul');
                list.className = 'live-controls__forks';
                for (const fork of here) {
                    const entry = doc.createElement('li');
                    const button = doc.createElement('button');
                    button.type = 'button';
                    button.textContent = fork.label;
                    button.addEventListener('click', () => showDive(fork.id));
                    entry.append(button);
                    list.append(entry);
                }
                item.append(list);
            }
            return item;
        }));
    }

    /** Where the reader is, in a Dive; and every Dive, wherever they are. */
    function drawDives(snapshot, force = false) {
        const all = runtime.undercurrent?.() ?? [];
        const here = snapshot.dive?.id ?? null;
        const crumbs = describeCrumb(snapshot.dive, all);
        crumb.hidden = !crumbs;
        trail.textContent = crumbs?.trail ?? '';
        returns.textContent = crumbs?.returnsTo ?? '';

        undercurrent.hidden = all.length === 0;
        const key = JSON.stringify([all, here]);
        if (!force && key === shownDives) return all;
        shownDives = key;
        undercurrent.querySelector('summary').textContent = `Undercurrent (${all.length})`;
        const open = new Set([...dives.querySelectorAll('details[open]')].map(node => node.dataset.dive));
        for (const id of wanted) open.add(id);
        wanted.clear();
        dives.replaceChildren(...all.map(dive => {
            const described = describeDive(dive);
            const entry = doc.createElement('li');
            const details = doc.createElement('details');
            details.dataset.dive = dive.id;
            details.open = open.has(dive.id);
            const summary = doc.createElement('summary');
            summary.textContent = [described.title, described.count, dive.id === here ? 'You are here' : null].filter(Boolean).join(' · ');
            details.append(summary);
            const place = doc.createElement('p');
            place.className = 'live-undercurrent__place';
            place.textContent = described.place;
            details.append(place);
            for (const turn of dive.turns) {
                const block = doc.createElement('div');
                block.className = 'live-undercurrent__turn';
                const asked = doc.createElement('p');
                asked.className = 'live-undercurrent__asked';
                const label = doc.createElement('strong');
                label.textContent = 'You asked:';
                asked.append(label, ` ${turn.question}`);
                block.append(asked);
                const ended = describeTurn(turn);
                for (const paragraph of turn.paragraphs) {
                    const text = doc.createElement('p');
                    text.className = 'live-undercurrent__answer';
                    text.textContent = paragraph;
                    block.append(text);
                }
                if (ended) {
                    const how = doc.createElement('p');
                    how.className = 'live-undercurrent__how';
                    how.textContent = ended;
                    block.append(how);
                }
                details.append(block);
            }
            entry.append(details);
            return entry;
        }));
        return all;
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
        statusLine.textContent = describeStatus(snapshot, { audible, question });
        const canAsk = status === 'live' || status === 'interrupted' || status === 'ended';
        // A Dive that is still connecting is already the runtime's side run. Inside a Dive, a question is a follow-up.
        const canDive = status === 'diving' ? snapshot.dive?.opening === false : canAsk && !snapshot.side;
        input.disabled = !canDive;
        dive.disabled = !canDive;
        dive.textContent = status === 'diving' ? 'Ask again' : 'Dive';
        dive.setAttribute('aria-label', status === 'diving' ? 'Ask a follow-up in this Dive' : 'Dive: ask about this place');
        surface.hidden = status !== 'diving';
        interrupt.hidden = status === 'diving' || status === 'ended' || status === 'failed' || status === 'stopped' || status === 'starting';
        interrupt.textContent = status === 'interrupted' ? 'Resume' : 'Interrupt';
        interrupt.dataset.live = status === 'interrupted' ? 'resume' : 'interrupt';
        if (listener) {
            listen.hidden = !(canAsk || status === 'diving');
            if (status === 'failed' || status === 'stopped') listener.cancel();
        }
        if (status === 'failed' && snapshot.error) show(snapshot.error.message);
        transcript(snapshot, drawDives(snapshot));
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
            onInterim: words => say(`Hearing: “${words.slice(0, 120)}”`),
            onFinal: heard,
            onState: state => {
                const active = state === 'starting' || state === 'listening';
                listen.setAttribute('aria-pressed', String(active));
                say(state === 'idle' ? '' : mic.describe(state));
                if (!active && state !== 'idle') letGo();
            }
        });
        micLine.setAttribute('role', 'status');
        micLine.setAttribute('aria-live', 'polite');
        micNote.querySelector('summary').textContent = mic.privacyLead;
        micNote.querySelector('p').textContent = mic.privacy;
        micNote.hidden = false;
        listen.addEventListener('click', () => {
            if (listener.listening) {
                listener.stop();
                return;
            }
            show('');
            heldByMic = false;
            if (runtime.status === 'live') {
                try {
                    runtime.hold();
                    heldByMic = true;
                } catch { /* it is no longer live; listening still works */ }
            }
            listener.start();
        });
    }

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
