/**
 * The three conditions that are not a live Current, each showing the fixed
 * answer (script.js) in its own way and nothing more.
 *
 *   text               all of it on the page, sources as notes, read at the
 *                      reader's pace: what a chat answer is
 *   spoken             a voice says it, sources named after each passage, and
 *                      there is nothing to look at: ordinary AI voice
 *   spoken-visualizer  the same voice, over an imagery field that pulses with
 *                      the words and knows nothing of what they mean: voice
 *                      over a generic audio-reactive visualizer
 *
 * The visualizer is deliberately the control for a live Current's imagery: the
 * same renderer family, the same voice, and no connection between the imagery
 * and the passages. If it is as good as a live Current at getting the answer
 * across, that is the finding.
 */

import { scriptParts, spokenLines } from './script.js';

const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
};

const button = (label, onClick) => {
    const node = el('button', 'live-start', label);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
};

/** The whole answer as text, the way a chat answer arrives. */
export function textPresenter({ container, done }) {
    const article = el('article', 'live-eval__article');
    article.append(el('p', 'live-eval__you', 'You asked: Explain black holes with RISE.'));
    for (const part of scriptParts()) {
        if (part.kind === 'passage' || part.kind === 'side-answer') article.append(el('p', part.kind === 'side-answer' ? 'live-eval__side' : '', part.text));
        else if (part.kind === 'source') article.append(el('p', 'live-eval__source', `Source: ${part.text}`));
        else if (part.kind === 'side-question') article.append(el('p', 'live-eval__you', `You asked, about the event horizon: ${part.text}`));
        else if (part.kind === 'return') article.append(el('p', 'live-eval__note', part.text));
    }
    container.append(article, button('I have finished reading', () => done()));
    return { destroy() { container.replaceChildren(); } };
}

/**
 * A voice says the answer. `visualizer` puts an imagery field behind it that
 * pulses on each word.
 *
 * @param {object} context
 * @param {() => Promise<{create: () => object}>} context.voices the host's voices
 * @param {(key: string, value: unknown) => void} context.note put what the device did into the record
 * @param {() => string} context.voiceKind what kind of voice it turned out to be
 * @param {boolean} [context.visualizer]
 */
export function spokenPresenter({ container, done, voices, note, voiceKind, visualizer = false }) {
    let destroyed = false;
    let voice = null;
    let field = null;
    let decay = null;
    const status = el('p', 'live-eval__status', 'Getting ready…');
    status.setAttribute('role', 'status');
    const stage = el('div', 'live-eval__voice');
    container.append(stage);
    stage.append(status);

    const finish = (message = 'The answer has finished.') => {
        if (destroyed) return;
        status.textContent = message;
        stage.append(button('Continue', () => done()));
    };

    (async () => {
        const factory = await voices();
        if (destroyed) return;
        note('voice', voiceKind());
        if (visualizer) {
            const { AttractorField } = await import('../../visuals/attractor.js');
            if (destroyed) return;
            const host = el('div', 'live-eval__field');
            container.prepend(host);
            field = new AttractorField(host, { system: 'aizawa', palette: 'white', form: 'mirror', intensity: 0.5 });
        }
        voice = factory.create();
        const lines = spokenLines().map(line => ({ ...line, key: `${line.kind}-${line.id}` }));
        const last = lines.at(-1).key;
        voice.attach({
            mark: () => {
                // A generic pulse on each word: the imagery reacts to the speech and to nothing in it.
                // A brightness change on every word is motion and flicker, so a reader who turned
                // either off sees the field still.
                const root = document.documentElement.classList;
                if (!field || root.contains('reduced-motion') || root.contains('photosensitivity-mode')
                    || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true) return;
                field.setIntensity(0.85);
                clearTimeout(decay);
                decay = setTimeout(() => field?.setIntensity(0.5), 180);
            },
            end: id => { if (id === last) finish(); },
            fail: () => { note('voice', 'failed'); finish('The voice stopped.'); }
        });
        status.textContent = 'Listening…';
        for (const line of lines) voice.enqueue({ id: line.key, text: line.text });
    })().catch(error => {
        console.warn('[live-eval] the voice could not start:', error);
        note('voice', 'failed');
        finish('The voice could not start.');
    });

    return {
        destroy() {
            destroyed = true;
            clearTimeout(decay);
            voice?.close?.();
            field?.destroy?.();
            container.replaceChildren();
        }
    };
}

export function createPresenters({ voices, voiceKind, note }) {
    return {
        text: context => textPresenter(context),
        spoken: context => spokenPresenter({ ...context, voices, voiceKind, note: context.note ?? note }),
        'spoken-visualizer': context => spokenPresenter({ ...context, voices, voiceKind, note: context.note ?? note, visualizer: true })
    };
}
