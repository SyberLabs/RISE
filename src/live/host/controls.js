import { describeOrigin, describePassage } from './passage.js';

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
    switch (status) {
        case 'idle':
            return '';
        case 'starting':
            return 'Asking…';
        case 'live': {
            const said = audible ? 'Speaking.' : 'Reading, paced as if spoken.';
            return `${main?.speaking || !main?.voiceDegraded ? said : 'Reading.'}${quiet}`;
        }
        case 'interrupted':
            return 'Held where you are. Resume, or ask about this place.';
        case 'diving': {
            const asked = question ? ` “${question.slice(0, 120)}”` : '';
            if (side?.error) return `The Dive could not be answered (${side.error.message}). Surface to go back.`;
            return side?.finished
                ? `Dive${asked}: answered. Surface to go back to where you were.`
                : `Diving${asked}. The reading you left is held exactly where it was.${quiet}`;
        }
        case 'ended':
            return 'Finished. You can still ask about any place in it.';
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
 * @param {Document} [options.doc]
 */
export function createLiveControls({ runtime, onStop, audible = true, doc = document }) {
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
        <button type="submit" data-live="dive" aria-label="Dive: ask about this place">Dive</button>
      </form>
      <div class="live-controls__buttons">
        <button type="button" data-live="interrupt">Interrupt</button>
        <button type="button" data-live="surface" hidden>Surface</button>
        <button type="button" data-live="stop">Stop</button>
      </div>
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
    const dive = $('[data-live="dive"]');
    const interrupt = $('[data-live="interrupt"]');
    const surface = $('[data-live="surface"]');
    const lines = $('.live-controls__lines');
    const passageOrigin = $('.live-passage__origin');
    const passageCondition = $('.live-passage__condition');
    const passageSources = $('.live-passage__sources');
    const passageDepth = $('.live-passage__depth');
    let question = '';
    let shownLines = '';
    let shownPassage = '';
    let destroyed = false;

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
        statusLine.textContent = describeStatus(snapshot, { audible, question });
        const canAsk = status === 'live' || status === 'interrupted' || status === 'ended';
        input.disabled = !canAsk;
        dive.disabled = !canAsk;
        surface.hidden = status !== 'diving';
        interrupt.hidden = status === 'diving' || status === 'ended' || status === 'failed' || status === 'stopped' || status === 'starting';
        interrupt.textContent = status === 'interrupted' ? 'Resume' : 'Interrupt';
        interrupt.dataset.live = status === 'interrupted' ? 'resume' : 'interrupt';
        if (status === 'failed' && snapshot.error) show(snapshot.error.message);
        transcript(snapshot);
        passage(snapshot);
    }

    interrupt.addEventListener('click', () => {
        void attempt(async () => {
            if (runtime.status === 'interrupted') runtime.resume();
            else await runtime.interrupt({ text: input.value.trim() || undefined });
        });
    });
    form.addEventListener('submit', event => {
        event.preventDefault();
        const asked = input.value.trim();
        if (!asked) {
            input.focus();
            return;
        }
        void attempt(async () => {
            question = asked;
            input.value = '';
            await runtime.dive({ question: asked });
            surface.focus();
        });
    });
    surface.addEventListener('click', () => {
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
            off();
            root.remove();
        }
    };
}
