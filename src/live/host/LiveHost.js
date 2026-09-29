/**
 * The standalone host for a live Current, at `/live`.
 *
 * It is a host, not a room: a prompt, a Start, and, once the answer is being
 * presented in the Chamber, a small set of controls (interrupt, ask about this
 * place, Surface, stop) and a status line. No product chrome. It owns the
 * runtime; the Chamber owns the screen; the runtime owns time.
 *
 * The provider is the deterministic mock unless the page is configured
 * otherwise (`?provider=`), and only the mock exists yet, so nothing here can
 * spend money or leave the device. `?voice=paced` makes the reading silent and
 * paced as if spoken, which is what every automated test uses.
 */

import { describeDegradations, detectCapabilities } from '../capabilities.js';
import { createLiveControls } from './controls.js';
import './LiveHost.css';

const DEFAULT_PROMPT = 'Explain black holes with RISE.';
const PROVIDERS = Object.freeze({ mock: 'Deterministic demo provider (offline)' });
const VOICES = Object.freeze({ auto: 'Speak if this device can', browser: 'Speak', paced: 'Silent, paced as if spoken' });

const text = (value, fallback = '') => (typeof value === 'string' ? value : fallback);

export class LiveHost {
    /**
     * @param {HTMLElement} container
     * @param {object} options
     * @param {(session: object, player: object) => Promise<void>} options.present put a Session and its Player on screen
     * @param {() => Promise<void>|void} [options.leave] go back to this page from the reading
     * @param {string} [options.search] the query string
     * @param {object} [options.env] window-like, for capability detection
     */
    constructor(container, { present, leave = () => {}, search = globalThis.location?.search ?? '', env = globalThis } = {}) {
        this.container = container;
        this.presentInChamber = present;
        this.leave = leave;
        this.params = new URLSearchParams(search);
        this.env = env;
        this.caps = detectCapabilities(env);
        this.runtime = null;
        this.controls = null;
        this.voiceKind = 'paced';
        this.voiceCount = 0;
        this.destroyed = false;
        this.starting = false;
        this.render();
    }

    render() {
        const provider = this.params.get('provider') || 'mock';
        const voice = this.params.get('voice');
        const chosen = Object.hasOwn(VOICES, voice) ? voice : 'auto';
        this.container.innerHTML = `
      <main class="live-host" aria-labelledby="live-title">
        <h1 class="live-title" id="live-title">Live Current</h1>
        <p class="live-lede">Ask a question. The answer is spoken and shown as it is spoken. Interrupt to look deeper at any place in it, then Surface, and it carries on from where you were.</p>
        <form class="live-ask" novalidate>
          <label class="live-label" for="live-prompt">Prompt</label>
          <textarea id="live-prompt" name="prompt" rows="3" maxlength="2000" autocomplete="off">${DEFAULT_PROMPT}</textarea>
          <div class="live-row">
            <label class="live-label live-voice">Voice
              <select name="voice">
                ${Object.entries(VOICES).map(([id, label]) => `<option value="${id}"${id === chosen ? ' selected' : ''}>${label}</option>`).join('')}
              </select>
            </label>
            <button type="submit" class="live-start">Start</button>
          </div>
        </form>
        <p class="live-error" role="alert" hidden></p>
        <section class="live-facts" aria-label="What is being used">
          <p class="live-provider"></p>
          <ul class="live-notes" aria-label="What this device cannot do"></ul>
        </section>
      </main>`;
        this.form = this.container.querySelector('.live-ask');
        this.errorLine = this.container.querySelector('.live-error');
        this.providerLine = this.container.querySelector('.live-provider');
        this.notes = this.container.querySelector('.live-notes');
        this.startButton = this.container.querySelector('.live-start');
        this.form.addEventListener('submit', event => {
            event.preventDefault();
            void this.start();
        });
        this.providerName = Object.hasOwn(PROVIDERS, provider) ? provider : 'mock';
        this.providerLine.textContent = Object.hasOwn(PROVIDERS, provider)
            ? `Provider: ${PROVIDERS[provider]}`
            : `Provider “${provider.slice(0, 40)}” is not available yet. Using: ${PROVIDERS.mock}`;
        this.showNotes();
    }

    showNotes() {
        const notes = describeDegradations(this.caps, { voice: this.selectedVoice() === 'browser' ? 'browser' : 'paced', voices: this.voiceCount || 1 });
        this.notes.replaceChildren(...notes.map(note => {
            const item = document.createElement('li');
            item.textContent = note.effect;
            item.dataset.capability = note.capability;
            return item;
        }));
    }

    selectedVoice() {
        const chosen = this.form.elements.voice.value;
        if (chosen === 'paced') return 'paced';
        return this.caps.speechOutput === 'synthesis' ? 'browser' : 'paced';
    }

    fail(message) {
        this.errorLine.textContent = message;
        this.errorLine.hidden = false;
    }

    async start() {
        if (this.starting || this.runtime) return;
        const prompt = text(this.form.elements.prompt.value).trim();
        if (!prompt) {
            this.fail('Ask something first.');
            return;
        }
        this.starting = true;
        this.errorLine.hidden = true;
        this.startButton.disabled = true;
        this.startButton.textContent = 'Asking…';
        try {
            const runtime = await this.buildRuntime();
            this.runtime = runtime;
            this.controls = createLiveControls({ runtime, onStop: () => this.stop(), audible: this.voiceKind === 'browser' });
            await runtime.start(prompt);
        } catch (error) {
            this.controls?.destroy();
            this.controls = null;
            this.runtime = null;
            this.fail(`Could not start: ${text(error?.message, 'unknown error').slice(0, 200)}`);
            this.resetButton();
        } finally {
            this.starting = false;
        }
    }

    resetButton() {
        this.startButton.disabled = false;
        this.startButton.textContent = 'Start';
    }

    /** Everything the runtime needs, loaded now and not before: none of it is in the first load. */
    async buildRuntime() {
        const [{ createLiveRuntime }, { createMockAdapter }, { createSessionPlayer }] = await Promise.all([
            import('../runtime.js'),
            import('../adapters/mock.js'),
            import('../../app/chamber-session-factory.js')
        ]);
        const { createRealClock } = await import('../clock.js');
        const clock = createRealClock();
        const voices = await this.buildVoices(clock);
        return createLiveRuntime({
            adapter: createMockAdapter({ clock }),
            clock,
            createPlayer: session => createSessionPlayer(session),
            voices,
            host: {
                present: ({ session, player }) => this.presentInChamber(session, player),
                dismiss: () => {}
            }
        });
    }

    async buildVoices(clock) {
        const wants = this.selectedVoice();
        if (wants === 'browser') {
            const { createBrowserVoice, whenVoicesAvailable } = await import('../voices/browser.js');
            const synth = this.env.speechSynthesis;
            const list = await whenVoicesAvailable(synth, { clock });
            this.voiceCount = list.length;
            if (list.length > 0) {
                this.voiceKind = 'browser';
                this.showNotes();
                const speech = { synth, Utterance: this.env.SpeechSynthesisUtterance };
                return { create: () => createBrowserVoice({ speech, clock, lang: this.env.navigator?.language || 'en' }) };
            }
        }
        const { createSyntheticVoice } = await import('../voices/synthetic.js');
        this.voiceKind = 'paced';
        this.showNotes();
        return { create: () => createSyntheticVoice({ clock }) };
    }

    /** The reader pressed Stop, or asked to leave. */
    async stop() {
        const runtime = this.runtime;
        this.runtime = null;
        this.controls?.destroy();
        this.controls = null;
        await runtime?.stop();
        this.resetButton();
        await this.leave();
    }

    /** The reader left the Chamber by its own control: end what was running. */
    async ended() {
        const runtime = this.runtime;
        this.runtime = null;
        this.controls?.destroy();
        this.controls = null;
        await runtime?.stop();
        this.resetButton();
    }

    activate() {
        this.container.querySelector('#live-prompt')?.focus({ preventScroll: true });
    }

    deactivate() {}

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        void this.ended();
        this.container.replaceChildren();
    }
}
