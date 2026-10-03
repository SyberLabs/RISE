/**
 * The standalone host for a live Current, at `/live`.
 *
 * It is a host, not a room: a prompt, a Start, and, once the answer is being
 * presented in the Chamber, a small set of controls (interrupt, ask about this
 * place, Surface, stop) and a status line. No product chrome. It owns the
 * runtime; the Chamber owns the screen; the runtime owns time.
 *
 * The provider is the deterministic mock unless the page is explicitly
 * configured otherwise (`?provider=openai`), so by default nothing here can
 * spend money or leave the device. OpenAI Realtime uses the reader's own key,
 * typed into this page, held in memory, sent once to this site to open each
 * session, and forgotten when the session ends. `?eval=1` replaces the prompt with a study
 * instrument (src/live/eval/study.js) and `?eval=later` with its later questions.
 * `?voice=paced` makes the reading silent and
 * paced as if spoken, which is what every automated test uses. `?measure=1`
 * exposes a read-only record of when atoms were shown and when the voice spoke
 * (`window.__riseLive`), which is how sync error is measured in a real browser.
 *
 * `?embed=mcp` is the page an MCP host's app frames (worker/mcp-server.mjs,
 * src/live/hosts/mcp-relay.js): no prompt, no provider to choose. The host's own
 * model wrote the answer and hands it over through the frame's parent; the same
 * runtime, Chamber, controls and voice play it.
 */

import { GEMINI_DEFAULT_MODEL } from '../adapters/gemini-model.js';
import { describeDegradations, detectCapabilities } from '../capabilities.js';
import { createLiveControls } from './controls.js';
import { DelayedRunner, EvalRunner } from './EvalRunner.js';
import './LiveHost.css';

const DEFAULT_PROMPT = 'Explain black holes with RISE.';
/** What an embedded app asks its host for: enough for the Chamber and the controls on a phone. */
const EMBED_HEIGHT = 640;
const PROVIDERS = Object.freeze({
    mock: 'Deterministic demo provider (offline)',
    openai: 'OpenAI Realtime, with your own key',
    gemini: 'Google Gemini, with your own key'
});
/** The providers the reader pays for with their own key: what to call it, and where the key goes. */
const KEYED = Object.freeze({
    openai: {
        name: 'OpenAI',
        note: "Held in this page's memory only: it is sent once, to this site, to open each session, and is never stored. Your prompt goes to OpenAI and is billed to your key. RISE pays for nothing."
    },
    gemini: {
        name: 'Gemini',
        note: "Held in this page's memory only: it is sent from this browser straight to Google, never to this site, and is never stored. Your prompt goes to Google and is billed to your key. RISE pays for nothing."
    }
});
const VOICES = Object.freeze({ auto: 'Speak if this device can', browser: 'Speak', paced: 'Silent, paced as if spoken' });

const text = (value, fallback = '') => (typeof value === 'string' ? value : fallback);

/** The page that framed this one, as far as the browser says. Any page may, so the reader is told which. */
export function framedBy(frame) {
    const ancestor = frame.location?.ancestorOrigins?.[0];
    if (ancestor && ancestor !== 'null') return ancestor;
    try {
        const referrer = frame.document?.referrer;
        if (referrer) return new URL(referrer).origin;
    } catch { /* not an address */ }
    return 'an unidentified page';
}

export class LiveHost {
    /**
     * @param {HTMLElement} container
     * @param {object} options
     * @param {object} options.router the shell’s router, to put a reading on screen and to come back
     * @param {string} [options.search] the query string
     * @param {object} [options.env] window-like, for capability detection
     */
    constructor(container, { router, search = globalThis.location?.search ?? '', env = globalThis } = {}) {
        this.container = container;
        this.router = router;
        this.params = new URLSearchParams(search);
        this.env = env;
        this.caps = detectCapabilities(env);
        this.runtime = null;
        this.controls = null;
        this.voiceKind = 'paced';
        this.voiceCount = 0;
        this.destroyed = false;
        this.starting = false;
        this.atomLog = [];
        // The reader's own key, in memory and nowhere else; see forgetKey.
        this.key = '';
        // Which Gemini model to ask, if the reader named one; not secret, and empty means the default.
        this.model = undefined;
        this.embedded = this.params.get('embed') === 'mcp' && !this.params.has('eval');
        if (this.embedded) {
            this.modules = this.loadModules();
            this.modules.catch(() => {});
            this.prefetchMic();
            void this.startEmbedded();
            return;
        }
        if (this.params.has('eval')) {
            // A study instrument, not a prompt. Everything it needs is fetched as it is needed.
            this.modules = this.loadModules();
            this.modules.catch(() => {});
            this.startEval();
            return;
        }
        this.render();
        // While the reader is typing, fetch what starting will need, so that the time from
        // Start to the first words is the answer’s and not the network’s.
        this.modules = this.loadModules();
        this.modules.catch(() => {});
        void import('../../components/Chamber.js').catch(() => {});
        this.prefetchMic();
    }

    /** Speaking to it is fetched only where the browser can recognise speech; a failure is no mic. */
    prefetchMic() {
        this.micModules = this.caps.speechRecognition ? Promise.all([import('../mic/listener.js'), import('../mic/interpret.js')]).catch(() => null) : null;
    }

    loadModules() {
        return Promise.all([
            import('../runtime.js'),
            import('../adapters/mock.js'),
            import('../../app/chamber-session-factory.js'),
            import('../clock.js'),
            import('../../app/live-present.js'),
            import('../../app/live-handoff.js')
        ]);
    }

    /** The provider asked for, which is always one this host knows. */
    chosenProvider() {
        const asked = this.params.get('provider') || 'mock';
        return Object.hasOwn(PROVIDERS, asked) ? asked : 'mock';
    }

    render() {
        const asked = this.params.get('provider') || 'mock';
        const provider = this.chosenProvider();
        const voice = this.params.get('voice');
        const chosen = Object.hasOwn(VOICES, voice) ? voice : 'auto';
        const keyed = KEYED[provider];
        this.container.innerHTML = `
      <main class="live-host" aria-labelledby="live-title">
        <h1 class="live-title" id="live-title">Live Current</h1>
        <p class="live-lede">Ask a question. The answer is spoken and shown as it is spoken. Interrupt to look deeper at any place in it, then Surface, and it carries on from where you were.</p>
        <form class="live-ask" novalidate>
          <label class="live-label" for="live-prompt">Prompt</label>
          <textarea id="live-prompt" name="prompt" rows="3" maxlength="2000" autocomplete="off">${DEFAULT_PROMPT}</textarea>
          ${keyed ? `
          <div class="live-key">
            <label class="live-label" for="live-key">Your ${keyed.name} API key
              <input id="live-key" name="key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="300">
            </label>
            ${provider === 'gemini' ? `
            <label class="live-label" for="live-model">Model
              <input id="live-model" name="model" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="64" value="${GEMINI_DEFAULT_MODEL}">
            </label>` : ''}
            <p class="live-key-note">${keyed.note}</p>
          </div>` : ''}
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
        this.providerName = provider;
        this.providerLine.textContent = Object.hasOwn(PROVIDERS, asked)
            ? `Provider: ${PROVIDERS[asked]}`
            : `Provider “${asked.slice(0, 40)}” is not available. Using: ${PROVIDERS.mock}`;
        this.showNotes();
    }

    showNotes() {
        if (!this.notes) return;
        const notes = describeDegradations(this.caps, { voice: this.selectedVoice() === 'browser' ? 'browser' : 'paced', voices: this.voiceCount || 1 });
        this.notes.replaceChildren(...notes.map(note => {
            const item = document.createElement('li');
            item.textContent = note.effect;
            item.dataset.capability = note.capability;
            return item;
        }));
    }

    selectedVoice() {
        const chosen = this.form?.elements.voice.value ?? this.params.get('voice');
        if (chosen === 'paced') return 'paced';
        return this.caps.speechOutput === 'synthesis' ? 'browser' : 'paced';
    }

    fail(message) {
        if (!this.errorLine) return;
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
        const keyed = KEYED[this.providerName];
        if (keyed) {
            const typed = text(this.form.elements.key?.value).trim();
            if (typed) this.key = typed;
            if (!this.key) {
                this.fail(`Enter your ${keyed.name} key to use this provider.`);
                return;
            }
            // Out of the page as soon as it is in memory: the field is not where it is kept.
            this.form.elements.key.value = '';
            if (this.providerName === 'gemini') this.model = text(this.form.elements.model?.value).trim() || undefined;
        }
        this.starting = true;
        this.startedAt = performance.now();
        this.errorLine.hidden = true;
        this.startButton.disabled = true;
        this.startButton.textContent = 'Asking…';
        try {
            // The reader may leave while this is getting ready; nothing is started for a page that is gone.
            const runtime = await this.buildRuntime();
            if (this.destroyed) return;
            this.runtime = runtime;
            const mic = await this.buildMic();
            if (this.destroyed) return;
            this.controls = createLiveControls({ runtime, onStop: () => this.stop(), audible: this.voiceKind === 'browser', mic });
            await runtime.start(prompt);
        } catch (error) {
            if (this.destroyed) return;
            this.controls?.destroy();
            this.controls = null;
            this.runtime = null;
            this.fail(`Could not start: ${text(error?.message, 'unknown error').slice(0, 200)}`);
            // A key that was refused is no use to keep; one that failed for another reason is kept for a retry.
            if (error?.code === 'KEY_REFUSED') this.forgetKey();
            this.resetButton();
        } finally {
            this.starting = false;
        }
    }

    /** The key is forgotten when the session ends, or is refused. */
    forgetKey() {
        this.key = '';
    }

    resetButton() {
        if (!this.startButton) return;
        this.startButton.disabled = false;
        this.startButton.textContent = 'Start';
    }

    /** Everything the runtime needs, loaded now and not before: none of it is in the first load. */
    async buildRuntime() {
        const [{ createLiveRuntime }, { createMockAdapter }, { createSessionPlayer }, { createRealClock }, present, handoff] = await this.modules;
        this.present = present;
        // Hear when the reader leaves the Chamber by its own control.
        this.stopHearingExit?.();
        this.stopHearingExit = handoff.onLiveExit(() => { void this.ended(); });
        const clock = createRealClock();
        const voices = await this.buildVoices(clock);
        const mountedChamber = player => {
            if (this.router?.getCurrentView?.() !== 'chamber-session') return null;
            const chamber = this.router.getViewInstance?.('chamber-session');
            return chamber?.player === player ? chamber : null;
        };
        const runtime = createLiveRuntime({
            adapter: await this.buildAdapter(clock, createMockAdapter),
            clock,
            createPlayer: session => createSessionPlayer(session),
            voices,
            host: {
                present: ({ role, session, player }) => {
                    if (this.params.has('measure')) {
                        player.on('atom', ({ index, concealed, replayed }) => {
                            if (!concealed && !replayed) this.atomLog.push({ at: performance.now(), index, role });
                        });
                    }
                    return this.present.presentLive(this.router, session, player);
                },
                discoverVisual: ({ player }) => mountedChamber(player)?.discoverVisual?.() ?? null,
                controlVisual: ({ player, command }) => mountedChamber(player)?.controlVisual?.(command)
                    ?? { status: 'refused', code: 'NO_ACTIVE_VISUAL' },
                dismiss: () => {}
            }
        });
        if (this.params.has('measure')) {
            this.env.__riseLive = Object.freeze({
                journal: () => runtime.journal(),
                atoms: () => this.atomLog.map(entry => ({ ...entry })),
                startedAt: () => this.startedAt,
                now: () => performance.now()
            });
        }
        return runtime;
    }

    /**
     * Speaking to it, or nothing. The grammar is English, so the recogniser is asked for English
     * whatever the page's language: words in another language would only ever be "not understood".
     */
    async buildMic() {
        const loaded = await this.micModules;
        if (!loaded) return null;
        const [{ createSpeechListener, describeMic, MIC_PRIVACY, MIC_PRIVACY_LEAD }, { interpret }] = loaded;
        const scope = this.env.window ?? this.env;
        const Recognition = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
        return {
            createListener: handlers => createSpeechListener({ Recognition, ...handlers }),
            interpret,
            describe: describeMic,
            privacy: MIC_PRIVACY,
            privacyLead: MIC_PRIVACY_LEAD
        };
    }

    /** The provider's adapter. A keyed provider's is loaded only if it is the one asked for, and the host's model only inside a host. */
    async buildAdapter(clock, createMockAdapter) {
        if (this.providerName === 'mcp') {
            const { createMcpAppAdapter } = await import('../adapters/mcp-app.js');
            return createMcpAppAdapter({ port: this.port, clock, host: framedBy(this.env.window ?? this.env) });
        }
        if (this.providerName === 'gemini') {
            const [{ createGeminiAdapter }, { createGeminiFetchTransport }] = await Promise.all([
                import('../adapters/gemini.js'),
                import('../adapters/gemini-fetch.js')
            ]);
            // The key and the model are asked for at each request, so a forgotten key is not used again.
            return createGeminiAdapter({ transport: createGeminiFetchTransport({ getKey: () => this.key, getModel: () => this.model }) });
        }
        if (this.providerName !== 'openai') return createMockAdapter({ clock });
        const [{ createOpenAIRealtimeAdapter }, { createOpenAIWebRtcTransport }] = await Promise.all([
            import('../adapters/openai-realtime.js'),
            import('../adapters/openai-webrtc.js')
        ]);
        return createOpenAIRealtimeAdapter({ transport: createOpenAIWebRtcTransport({ getKey: () => this.key, clock }) });
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

    // ─── the study instrument ───────────────────────────────────────────

    startEval() {
        if (this.params.get('eval') === 'later') {
            this.eval = new DelayedRunner(this.container);
            return;
        }
        const voices = async () => {
            const { createRealClock } = await this.modules.then(loaded => loaded[3]);
            return this.buildVoices(createRealClock());
        };
        import('../eval/presenters.js').then(({ createPresenters: make }) => {
            const presenters = make({ voices, voiceKind: () => this.voiceKind, note: () => {} });
            presenters['rise-current'] = context => this.presentEvalCurrent(context);
            this.eval = new EvalRunner(this.container, {
                params: this.params,
                presenters,
                environment: () => ({
                    viewport: `${globalThis.innerWidth}x${globalThis.innerHeight}`,
                    reducedMotion: this.caps.reducedMotion,
                    touch: this.caps.touch,
                    webgl2: this.caps.webgl2
                })
            });
        });
    }

    /** The live Current condition: the real runtime, with the fixed answer and a prompt to ask about the horizon. */
    presentEvalCurrent({ container, done, note }) {
        this.providerName = 'mock';
        let finished = false;
        const guide = document.createElement('section');
        guide.id = 'live-eval-guide';
        guide.className = 'live-eval__guide';
        guide.innerHTML = '<p class="live-eval__guide-text"></p>';
        const text = guide.querySelector('p');
        text.textContent = 'Listen to the answer. When it reaches the size of the horizon, type “dive on event horizon” below and press Dive, read the side answer, then press Surface. Then let the answer carry on to the end.';
        const carry = document.createElement('button');
        carry.type = 'button';
        carry.className = 'live-start';
        carry.hidden = true;
        carry.textContent = 'Continue to the questions';
        guide.append(carry);
        document.body.append(guide);

        const finish = async () => {
            if (finished) return;
            finished = true;
            guide.remove();
            await this.stop();
            done();
        };
        carry.addEventListener('click', finish);

        (async () => {
            try {
                const runtime = await this.buildRuntime();
                this.runtime = runtime;
                note('voice', this.voiceKind);
                this.controls = createLiveControls({ runtime, onStop: finish, audible: this.voiceKind === 'browser' });
                runtime.subscribe(view => {
                    if (runtime.journal().some(entry => entry.type === 'branch.open')) note('dived', true);
                    if (view.status === 'ended' && !view.side) carry.hidden = false;
                });
                await runtime.start('Explain black holes with RISE.');
            } catch (error) {
                note('voice', 'failed');
                text.textContent = `It could not start: ${String(error?.message ?? error).slice(0, 160)}`;
                carry.hidden = false;
            }
        })();
        return { destroy() { guide.remove(); } };
    }

    // ─── inside an MCP host ─────────────────────────────────────────────

    /** What the reader is told in the frame, before and after the reading. */
    say(message, { alert = false } = {}) {
        this.container.innerHTML = `
      <main class="live-host live-host--embedded" aria-label="RISE">
        <p class="live-embed" role="${alert ? 'alert' : 'status'}"></p>
      </main>`;
        this.container.querySelector('.live-embed').textContent = message;
    }

    /**
     * Say hello to the host, and play what its model hands over. The frame's parent is the host (or
     * the relay that stands for it); a page opened directly has no host, and says so.
     */
    async startEmbedded() {
        const frame = this.env.window ?? this.env;
        if (!frame.parent || frame.parent === frame) {
            this.say('This is the RISE app for an assistant that can show it. Open it from one.', { alert: true });
            return;
        }
        this.say('Waiting for the answer…');
        this.providerName = 'mcp';
        this.startedAt = performance.now();
        try {
            const [{ createMcpGuestPort }] = await Promise.all([import('../hosts/mcp-port.js'), this.modules]);
            this.port = createMcpGuestPort({ frame });
            this.port.onTeardown(() => { void this.ended(); });
            await this.port.connect();
            if (this.destroyed) return;
            // The host sizes a frame from what the app says it wants; the Chamber fills what it is given.
            this.port.sizeChanged({ width: frame.innerWidth, height: EMBED_HEIGHT });
            const runtime = await this.buildRuntime();
            if (this.destroyed) return;
            this.runtime = runtime;
            const mic = await this.buildMic();
            if (this.destroyed) return;
            this.controls = createLiveControls({ runtime, onStop: () => this.stop(), audible: this.voiceKind === 'browser', mic });
            await runtime.start('The answer the assistant presents');
        } catch (error) {
            if (this.destroyed) return;
            this.controls?.destroy();
            this.controls = null;
            this.runtime = null;
            this.port?.close();
            this.port = null;
            this.say(`Could not start: ${text(error?.message, 'unknown error').slice(0, 200)}`, { alert: true });
        }
    }

    /** The reader pressed Stop, or asked to leave. */
    async stop() {
        const runtime = this.runtime;
        this.runtime = null;
        this.forgetKey();
        this.controls?.destroy();
        this.controls = null;
        await runtime?.stop();
        this.resetButton();
        await this.present?.leaveLive(this.router);
        if (this.embedded && !this.destroyed) this.say('Stopped. Ask the assistant again to see it.');
    }

    /** The reader left the Chamber by its own control: end what was running. */
    async ended() {
        const runtime = this.runtime;
        this.runtime = null;
        this.forgetKey();
        this.controls?.destroy();
        this.controls = null;
        await runtime?.stop();
        this.resetButton();
        if (this.embedded && !this.destroyed) this.say('Finished. Ask the assistant again to see it.');
    }

    activate() {
        this.container.querySelector('#live-prompt')?.focus({ preventScroll: true });
    }

    deactivate() {}

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.stopHearingExit?.();
        void this.ended();
        this.port?.close();
        this.port = null;
        this.container.replaceChildren();
    }
}
