/**
 * The host for a live Current, at `/live`: the live pane of Read.
 *
 * In the app, `/live` is the Live venue (venue.js): the Reader site's page where RISE owns the room, a question,
 * a provider from the registry and the stage's whole instrument, one room for many readings. The runtime's test
 * page below stays at `?host=prompt`, and wherever the address names a provider or a catalog sample.
 *
 * That page is a host, not a room: a prompt, a Start, and, once the answer is being
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
 * exposes a read-only record of when atoms were shown, when the voice spoke and
 * which installed voice it was (`window.__riseLive`), which is how sync error is
 * measured in a real browser.
 *
 * `?embed=mcp` is the page an MCP host's app frames (worker/mcp-server.mjs,
 * src/live/hosts/mcp-relay.js): no prompt, no provider to choose. The host's own
 * model wrote the answer and hands it over through the frame's parent; the same
 * runtime, Chamber and voice play it, under the stage's two objects
 * (stage-controls.js) instead of this page's bar. With `?log=host` as well, a
 * witness session's switch, the port writes what the host says about the frame
 * to the console as JSON lines (docs/plans/EMBED-WITNESS.md); nothing else.
 */

import { GEMINI_DEFAULT_MODEL } from '../adapters/gemini-model.js';
import { OPENROUTER_DEFAULT_MODEL } from '../adapters/openrouter-model.js';
import { describeDegradations, detectCapabilities } from '../capabilities.js';
import { admitCatalogVisual } from '../../core/visual-catalog.js';
import { jevColors } from '../../core/jev-palette.js';
import { lookTheme } from '../../core/current-look.js';
import { createLiveControls } from './controls.js';
import { createStageControls } from './stage-controls.js';
import { isVoiceNote, voiceLine } from '../voice-trace.js';
// Statically: Play unlocks speech synchronously inside its own tap, which a module still to be fetched cannot do.
import { unlockSpeech } from '../voices/unlock.js';
import { unlockAudio } from '../../audio/unlock.js';
import { PHONE_SPEAKER_LIFT_DB } from '../../audio/sound-levels.js';
import { siteUrl } from '../../core/embed-address.js';
import { DelayedRunner, EvalRunner } from './EvalRunner.js';
import { LIVE_PROVIDERS } from '../adapters/registry.js';
import { LiveVenue } from './venue.js';
import './LiveHost.css';

const DEFAULT_PROMPT = 'Explain black holes with RISE.';
/**
 * The one height an embedded app asks its host for: it follows the frame's width, never below 481
 * (a shorter, wider frame is a phone in landscape to the Chamber, which then shrinks the words and
 * ignores the text size), never above 560, and never above the host's own cap.
 */
function embedHeight(width, maxHeight) {
    const height = Math.min(560, Math.max(481, Math.round(width * 0.66)));
    return Number.isFinite(maxHeight) ? Math.min(height, maxHeight) : height;
}
const SAFE_SIDES = ['top', 'right', 'bottom', 'left'];
/** What the stage's hidden status says of this device; the other notes have no meaning in a card. */
const STAGE_NOTES = ['speechOutput', 'canvas', 'reducedMotion'];
const PLAY_GLYPH = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10-6.5z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></svg>';
/** The frame's colors a theme sets, and which of its shipped colors each takes. */
const EMBED_THEME_VARS = [['--color-void', 'background'], ['--color-light', 'text'], ['--color-cloud', 'text'], ['--color-accent', 'accent']];
const PROVIDERS = Object.freeze({
    mock: 'Deterministic demo provider (offline)',
    openai: 'OpenAI Realtime, with your own key',
    gemini: 'Google Gemini, with your own key',
    openrouter: 'OpenRouter, on your own account'
});
/** OpenRouter's key is the reader's connection from Home (src/core/ai-connection.js), never typed here. */
const OPENROUTER_NOTE = "Uses the OpenRouter account you connected with Connect OpenRouter on Home: the key is held in this tab's memory only and goes from this browser straight to OpenRouter, never to this site. Your prompt is billed to your OpenRouter account. RISE pays for nothing.";
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
/** How many voice, audio and band trace lines "About this reading" shows. */
const TRACE_KEPT = 20;
/** How many installed voice names "About this reading" lists. */
const VOICES_LISTED = 20;
/** The journal notes after which the browser's voice is no longer speaking. */
const VOICE_QUIET = new Set(['speech.end', 'voice.failed', 'voice.taken', 'voice.held']);

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

const SCENE_PHASES = ['load', 'init', 'frame', 'cue'];
/** Text a scene may have written, fit to be quoted inside RISE's line: one line, no double quote to close the quote with, clipped. */
function quotable(value, length) {
    const flat = String(value ?? '').replace(/[\u0000-\u001F\u007F]+/gu, ' ').replace(/"/gu, "'");
    return flat.length <= length ? flat : `${flat.slice(0, length - 1)}…`;
}

/**
 * One failed generated scene (the Chamber's diagnostic) as a line in RISE's words, for DevTools and the
 * host's model. A scene's code can write its error's message (`throw new Error(...)`), so the message is
 * quoted as data, never as RISE speaking; its id and place are bounded and checked the same way.
 */
export function sceneReportLine({ sceneId, phase, message, where }) {
    const id = quotable(sceneId, 40);
    if (phase === 'flash') return `scene "${id}": frozen — it would flash more than three times a second; its last frame stays`;
    // A figure's two failures (Chamber._mountFigureCue): the rule is admission's sentence, though it names what the figure wrote.
    if (phase === 'admission') return `scene "${id}": not drawn — the card refused the figure: "${quotable(message, 200)}"`;
    if (phase === 'image') return `scene "${id}": not drawn — the figure could not be drawn as an image`;
    const at = typeof where === 'string' && /^scene\.js(:\d{1,6}:\d{1,6})?$/u.test(where) ? ` at ${where}` : '';
    return `scene "${id}": ${SCENE_PHASES.includes(phase) ? phase : 'failed'} — the scene’s own words: "${quotable(message, 200)}"${at}`;
}

export class LiveHost {
    /**
     * @param {HTMLElement} container
     * @param {object} options
     * @param {object} options.router the shell’s router, to put a reading on screen and to come back
     * @param {string} [options.search] the query string
     * @param {object} [options.env] window-like, for capability detection
     * @param {() => Promise<object>} [options.ensureAudioEngine] the app's audio engine, the one the Chamber plays beds on
     * @param {() => object} [options.getSettings] the app's saved settings: the reader's own browser voice (`cardVoice`)
     * @param {(key: string, value: unknown) => void} [options.onSettingChange] keeps a setting the reader changed here
     * @param {boolean} [options.venue] the app's `/live`: the Live venue, unless the address asks for the test page
     * @param {readonly object[]} [options.providers] the venue's provider registry
     */
    constructor(container, {
        router, onNavigate = () => {}, search = globalThis.location?.search ?? '', env = globalThis, ensureAudioEngine = null,
        getSettings = () => ({}), onSettingChange = () => {}, venue = false, providers = LIVE_PROVIDERS
    } = {}) {
        this.container = container;
        this.router = router;
        this.onNavigate = onNavigate;
        this.ensureAudioEngine = ensureAudioEngine;
        this.getSettings = getSettings;
        this.onSettingChange = onSettingChange;
        // The engine the reading's beds play on, once a reading is built; and the beds and tones it started (?measure=1).
        this.audioEngine = null;
        // The same engine, known before the reader's first press, so the press can start its context (unlockAudio);
        // the silent loop a press started (src/audio/unlock.js); and the dB the beds are lifted by on a phone.
        this.engineAtHand = null;
        void Promise.resolve().then(() => ensureAudioEngine?.()).then(engine => { this.engineAtHand = engine ?? null; }, () => {});
        this.audioKeeper = null;
        this.audioLiftDb = 0;
        this.audioLog = [];
        // The last voice and audio lines written to DevTools, for "About this reading" (aboutReading).
        this.traceLines = [];
        this.onSoundStart = null;
        // ?measure=1 only: an analyser on the engine's output, made at the first measurement (outputLevelDbfs).
        this.audioTap = null;
        // Leaves the shown Player's state changes; set while the engine's session follows one (followReading).
        this.stopFollowingReading = null;
        this.params = new URLSearchParams(search);
        this.env = env;
        this.caps = detectCapabilities(env);
        this.runtime = null;
        this.controls = null;
        // Which voice the reading uses, and how many voices the browser offered, once each is known.
        this.voiceKind = null;
        this.voiceCount = null;
        // The installed voice a browser reading speaks with, by name and language; null leaves the browser's default.
        this.spokenVoice = null;
        // A browser reading's installed voices, its language and the voice it speaks with (buildVoices), and the
        // browser voice last made from them, which a reader's pick reaches (chooseBrowserVoice).
        this.browserVoices = null;
        this.madeVoice = null;
        this.destroyed = false;
        this.starting = false;
        this.embeddedStartupCancelled = false;
        this.embeddedCurrentHandled = false;
        this.embeddedCurrentProcessing = false;
        this.embeddedProposalRevision = 0;
        this.embeddedProposalCurrent = null;
        this.embeddedQueuedCurrent = null;
        this.embeddedBeginStarted = false;
        this.embeddedEvents = null;
        this.embeddedCurrent = null;
        this.embeddedTheme = null;
        this.stopListeningCurrent = null;
        this.stopListeningError = null;
        this.embeddedAnswerTimeoutMs = 60_000;
        this.embeddedAnswerTimer = null;
        this.atomLog = [];
        // A generated scene that failed in the Chamber (Chamber.js `_noteScene`) is said in DevTools, kept for
        // ?measure=1, and told to the host's model where the host takes it (reportScene).
        this.sceneReports = [];
        this.onSceneDiagnostic = event => this.reportScene(event.detail);
        container.ownerDocument.defaultView?.addEventListener('rise-scene-diagnostic', this.onSceneDiagnostic);
        // The words' press, move and release on the card (Chamber.js `_noteBand`), on the voice's clock, so a
        // field report says whether a drag reached the card or the app took it (band.cancel).
        this.onBandNote = event => this.trace('[RISE band]', voiceLine({ at: performance.now(), ...event.detail }));
        container.ownerDocument.defaultView?.addEventListener('rise-band-note', this.onBandNote);
        // The reader's own key, in memory and nowhere else; see forgetKey.
        this.key = '';
        // Which Gemini model to ask, if the reader named one; not secret, and empty means the default.
        this.model = undefined;
        this.embedded = this.params.get('embed') === 'mcp' && !this.params.has('eval');
        this.hasCatalogChoice = this.params.has('catalog');
        this.catalogId = this.params.get('catalog');
        this.catalogConflict = this.hasCatalogChoice && (
            this.embedded || this.params.has('eval') || this.chosenProvider() !== 'mock'
        );
        if (this.catalogConflict) {
            this.renderCatalogRefusal('Catalog sample choices are only available in the offline demonstration.');
            return;
        }
        if (this.embedded) {
            this.modules = this.loadModules();
            this.modules.catch(() => {});
            void import('../../components/read/Chamber.js').catch(() => {});
            // The stage takes no speech, so nothing of the microphone is fetched.
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
        const venued = venue && !this.hasCatalogChoice && !this.params.has('provider') && this.params.get('host') !== 'prompt';
        this.venue = null;
        if (!venued) this.render();
        // While the reader is typing, fetch what starting will need, so that the time from
        // Start to the first words is the answer’s and not the network’s.
        this.modules = this.loadModules();
        this.modules.catch(() => {});
        void import('../../components/read/Chamber.js').catch(() => {});
        this.prefetchMic();
        if (venued) this.venue = new LiveVenue(this, { providers });
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
          ${provider === 'openrouter' ? `
          <div class="live-key">
            <label class="live-label" for="live-model">Model
              <input id="live-model" name="model" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="200" value="${OPENROUTER_DEFAULT_MODEL}">
            </label>
            <p class="live-key-note">${OPENROUTER_NOTE}</p>
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
        <p class="live-catalog-note" role="status"></p>
        <p><a class="live-catalog-link" href="/visual-catalog">Browse visuals</a></p>
        <section class="live-facts" aria-label="What is being used">
          <p class="live-provider"></p>
          <ul class="live-notes" aria-label="What this device cannot do"></ul>
        </section>
      </main>`;
        this.form = this.container.querySelector('.live-ask');
        this.errorLine = this.container.querySelector('.live-error');
        this.catalogNote = this.container.querySelector('.live-catalog-note');
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
        if (this.hasCatalogChoice) {
            const admission = admitCatalogVisual(this.catalogId, this.caps);
            if (admission.status === 'accepted') {
                this.openingVisual = admission.visual;
                this.catalogNote.textContent = `This sample begins with ${this.catalogId}.`;
            } else if (admission.code === 'CAPABILITY_UNAVAILABLE') {
                this.openingVisual = 'still';
                this.catalogNote.textContent = 'Drawing is unavailable. This reading begins without imagery.';
            }
        }
        this.container.querySelector('.live-catalog-link').addEventListener('click', event => {
            event.preventDefault();
            this.onNavigate('visual-catalog');
        });
    }

    renderCatalogRefusal(message) {
        this.container.replaceChildren();
        const main = document.createElement('main');
        main.className = 'live-host';
        const title = document.createElement('h1');
        title.className = 'live-title';
        title.textContent = 'Live Current';
        const error = document.createElement('p');
        error.className = 'live-error';
        error.setAttribute('role', 'alert');
        error.textContent = message;
        const link = document.createElement('a');
        link.href = '/visual-catalog';
        link.textContent = 'Browse visuals';
        main.append(title, error, link);
        this.container.append(main);
    }

    /** What this device cannot do: for the voice the reading uses once it is built, and the one chosen before. */
    degradations({ pacingShown = false } = {}) {
        return describeDegradations(this.caps, { voice: this.voiceKind ?? this.selectedVoice(), voices: this.voiceCount, pacingShown });
    }

    showNotes() {
        if (!this.notes) return;
        const notes = this.degradations();
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
        if (this.catalogConflict) return;
        if (this.hasCatalogChoice) {
            const admission = admitCatalogVisual(this.catalogId, this.caps);
            if (admission.status === 'refused' && admission.code !== 'CAPABILITY_UNAVAILABLE') {
                this.fail(admission.code === 'UNKNOWN_VISUAL'
                    ? 'That choice is not in the visual catalog.'
                    : 'That visual is a specimen only and has no live opening.');
                return;
            }
            this.openingVisual = admission.status === 'accepted' ? admission.visual : 'still';
        }
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
        if (this.providerName === 'openrouter') this.model = text(this.form.elements.model?.value).trim() || undefined;
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

    stopHearingExitListener() {
        this.stopHearingExit?.();
        this.stopHearingExit = null;
    }

    /** Everything the runtime needs, loaded now and not before: none of it is in the first load. */
    async buildRuntime() {
        const [{ createLiveRuntime }, { createMockAdapter }, { createSessionPlayer }, { createRealClock }, present, handoff] = await this.modules;
        this.present = present;
        // Hear when the reader leaves the Chamber by its own control.
        if (this.destroyed || this.embeddedStartupCancelled) {
            this.stopHearingExitListener();
        } else {
            this.stopHearingExitListener();
            this.stopHearingExit = handoff.onLiveExit(() => { void this.ended(); });
            if (this.destroyed || this.embeddedStartupCancelled) this.stopHearingExitListener();
        }
        const clock = createRealClock();
        const voices = await this.buildVoices(clock);
        await this.hearAudio(clock);
        const mountedChamber = player => this.chamberPlaying(player);
        const runtime = createLiveRuntime({
            adapter: await this.buildAdapter(clock, createMockAdapter),
            clock,
            // The voice's trace in DevTools, always: a reader who sees the words and the voice part can copy
            // what the clock saw (voice-trace.js), as a failed scene is reported.
            onNote: entry => {
                if (isVoiceNote(entry.type)) this.trace('[RISE voice]', voiceLine(entry));
                this.duckUnderVoice(entry.type);
            },
            createPlayer: session => createSessionPlayer(session),
            voices,
            host: {
                present: async ({ role, session, player }) => {
                    if (this.params.has('measure')) {
                        player.on('atom', ({ atom, index, concealed, replayed }) => {
                            // The passage, or beat, the atom belongs to, and the hold it is, so a beat's time can be read.
                            if (!concealed && !replayed) this.atomLog.push({ at: performance.now(), index, role, sourceId: atom?.sourceId ?? null, ...(atom?.hold ? { holdMs: atom.hold.ms } : {}) });
                        });
                    }
                    await this.present.presentLive(this.router, session, player);
                    this.followReading(player);
                },
                discoverVisual: ({ player }) => mountedChamber(player)?.discoverVisual?.() ?? null,
                controlVisual: ({ player, command, instant }) => mountedChamber(player)?.controlVisual?.(command, { instant: instant === true })
                    ?? { status: 'refused', code: 'NO_ACTIVE_VISUAL' },
                holdScene: ({ player, atom }) => mountedChamber(player)?.holdScene?.(atom) ?? null,
                dismiss: () => {}
            }
        });
        if (this.params.has('measure')) {
            this.env.__riseLive = Object.freeze({
                journal: () => runtime.journal(),
                atoms: () => this.atomLog.map(entry => ({ ...entry })),
                startedAt: () => this.startedAt,
                voice: () => this.spokenVoice,
                scenes: () => [...this.sceneReports],
                audio: () => ({
                    started: this.audioLog.map(entry => ({ ...entry })),
                    sounding: this.audioEngine?.sounding?.id ?? null,
                    levelDbfs: this.outputLevelDbfs()
                }),
                now: () => performance.now()
            });
        }
        return runtime;
    }

    /**
     * The engine the Chamber plays the reading's beds and tones on (the app's own): each one it starts is
     * a line in DevTools (`[RISE audio]`) and, under ?measure=1, an entry in `__riseLive.audio()`.
     */
    async hearAudio(clock) {
        const engine = await Promise.resolve(this.ensureAudioEngine?.()).catch(() => null);
        if (!engine || this.destroyed) return;
        this.releaseAudio();
        this.audioEngine = engine;
        // A phone's speaker, as the host says (hostContext.platform): the session is lifted by the phone level.
        this.audioLiftDb = this.port?.hostContext?.()?.platform === 'mobile' ? PHONE_SPEAKER_LIFT_DB : 0;
        engine.setSessionLift?.(this.audioLiftDb);
        this.onSoundStart = ({ id, kind, trimDb }) => {
            const entry = { at: clock.now(), type: kind === 'tone' ? 'audio.tone' : 'audio.bed', id, trimDb };
            this.trace('[RISE audio]', voiceLine(entry));
            if (this.params.has('measure')) this.audioLog = [...this.audioLog, entry].slice(-50);
        };
        engine.onSoundStart = this.onSoundStart;
    }

    /** One line in DevTools, and kept among the last TRACE_KEPT for "About this reading". */
    trace(tag, line) {
        console.info(tag, line);
        this.traceLines = [...this.traceLines, `${tag} ${line}`].slice(-TRACE_KEPT);
    }

    /**
     * "About this reading", for a reader with no DevTools (the stage's Settings sheet): which voice, why it went
     * quiet if it did, how often it began, the host's context, the device, the audio engine, and the last trace
     * lines. Only what the host already keeps, as plain text to copy.
     */
    aboutReading() {
        const journal = this.runtime?.journal?.() ?? [];
        const chosen = journal.findLast(entry => entry.type === 'voice.chosen');
        const trouble = journal.findLast(entry => entry.type === 'voice.degraded' || entry.type === 'voice.failed');
        const spoken = this.spokenVoice;
        const voice = this.voiceKind !== 'browser' ? this.voiceKind ?? 'not chosen yet'
            : spoken ? `browser "${spoken.name}" ${spoken.lang} local=${chosen?.local ?? 'unknown'}` : 'browser (platform default)';
        const why = trouble
            ? `${trouble.type} ${trouble.reason ? `reason=${trouble.reason}` : `message=${trouble.message}`} at ${(trouble.at / 1000).toFixed(1)} s`
            : this.degradations({ pacingShown: true }).find(note => note.capability === 'speechOutput')?.effect ?? 'none';
        const synth = this.env.speechSynthesis;
        const count = this.voiceCount;
        const voices = count === null ? 'voices not asked' : `${count} voice${count === 1 ? '' : 's'}`;
        const lines = [
            `voice: ${voice}`,
            `voice trouble: ${why}`,
            `speech starts: ${journal.filter(entry => entry.type === 'speech.start').length}`,
            `speechSynthesis: ${this.caps.speechOutput}, ${voices}${synth ? `, speaking=${synth.speaking} pending=${synth.pending} paused=${synth.paused}` : ''}`
        ];
        if (this.browserVoices) {
            // What the Voice row offers on this device, so a reader can say what their phone has.
            const names = this.browserVoices.offered.map(item => item.name);
            const more = names.length > VOICES_LISTED ? `, and ${names.length - VOICES_LISTED} more` : '';
            lines.push(`voices for ${this.browserVoices.lang}: ${names.slice(0, VOICES_LISTED).join(', ')}${more}`);
        }
        const context = this.port?.hostContext?.();
        if (context) {
            const { platform, displayMode, deviceCapabilities: device, containerDimensions: box } = context;
            lines.push(`host: platform=${platform ?? 'unknown'} display=${displayMode ?? 'unknown'} touch=${device?.touch ?? 'unknown'} hover=${device?.hover ?? 'unknown'} container=${box ? JSON.stringify(box) : 'unknown'}`);
        }
        const view = this.env.window ?? this.env;
        lines.push(`device: ${this.env.navigator?.userAgent ?? 'unknown'}`, `viewport: ${view.innerWidth}×${view.innerHeight} @${view.devicePixelRatio ?? 1}x`);
        const engine = this.audioEngine;
        if (engine) {
            const level = this.outputLevelDbfs();
            const heard = level === null ? 'unknown' : `${Number.isFinite(level) ? level.toFixed(1) : '-inf'} dBFS`;
            const lift = this.audioLiftDb ? `, phone level +${this.audioLiftDb} dB` : '';
            lines.push(`audio: context ${engine.context?.state ?? 'none'}, audible=${engine.audible}, sounding=${engine.sounding?.id ?? 'none'}, level=${heard}${lift}`);
        } else lines.push('audio: none');
        const keeper = this.audioKeeper;
        lines.push(`audio session: ${this.env.navigator?.audioSession?.type ?? 'none'}${keeper ? `, silent loop ${keeper.paused ? 'paused' : 'playing'}` : ''}`);
        return [...lines, '', ...this.traceLines].join('\n');
    }

    /** The browser's voice is not the engine's, so the engine is told when it speaks: the beds step back under it. */
    duckUnderVoice(type) {
        if (!this.audioEngine || this.voiceKind !== 'browser') return;
        if (type === 'speech.start') this.audioEngine.setVoiceDucking(true);
        else if (VOICE_QUIET.has(type)) this.audioEngine.setVoiceDucking(false);
    }

    /**
     * What the engine sends the speakers (?measure=1): the RMS, in dBFS, of about the last quarter second
     * after its last gate, mixed to one channel; null with no engine output to listen to. A bed the engine
     * says it started can still be silent, so this is what a test of hearing it measures.
     */
    outputLevelDbfs() {
        const out = this.audioEngine?.lifecycleGate;
        const context = this.audioEngine?.context;
        if (!out || !context) return null;
        if (this.audioTap?.node !== out) {
            this.releaseAudioTap();
            const analyser = context.createAnalyser();
            // The longest power of two of samples within a quarter second; an AnalyserNode allows 32 to 32768.
            analyser.fftSize = 2 ** Math.min(15, Math.max(5, Math.floor(Math.log2(context.sampleRate / 4))));
            out.connect(analyser);
            this.audioTap = { node: out, analyser, samples: new Float32Array(analyser.fftSize) };
        }
        const { analyser, samples } = this.audioTap;
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += sample * sample;
        return 10 * Math.log10(sum / samples.length);
    }

    releaseAudioTap() {
        const tap = this.audioTap;
        this.audioTap = null;
        try { tap?.node.disconnect(tap.analyser); } catch { /* already gone with its context */ }
    }

    /**
     * The engine's session heard as the Reader hears it. The factory opens it at zero (startSession) and
     * leaves the reveal to whoever plays the reading: the Chamber's own Begin in the Reader, and here,
     * where the Chamber plays nothing (hostPlays), this host. Shown after the factory has opened it, so
     * the reveal is never zeroed behind it. A visual presence's return to playing is not a new reveal.
     */
    followReading(player) {
        this.stopFollowingReading?.();
        this.stopFollowingReading = null;
        const engine = this.audioEngine;
        if (!engine || this.destroyed) return;
        let heard = false;
        let up = false;
        const follow = state => {
            if (state === 'playing' && !up) {
                engine.fadeInSession?.(heard ? 0.6 : 1.2);
                heard = true;
                up = true;
            } else if (state === 'paused') {
                engine.fadeOutSession?.(0.4);
                up = false;
            } else if (state === 'complete') {
                // No audio outlives the reading; Play again opens a new session.
                engine.stopSession?.();
                this.releaseAudioSession();
                up = false;
            }
        };
        this.stopFollowingReading = player.on('state', ({ state }) => follow(state));
        follow(player.state);
    }

    /** Let go of the engine: no longer told of its sounds, and nothing left ducked for a voice that is gone. */
    releaseAudio() {
        this.stopFollowingReading?.();
        this.stopFollowingReading = null;
        this.releaseAudioTap();
        const engine = this.audioEngine;
        if (!engine) return;
        if (engine.onSoundStart === this.onSoundStart) engine.onSoundStart = null;
        engine.setVoiceDucking?.(false);
        engine.setSessionLift?.(0);
        this.audioEngine = null;
    }

    /** A failed generated scene, in RISE's words: DevTools, ?measure=1, and the host's model if the host takes its context. */
    reportScene(diagnostic) {
        if (this.destroyed || !diagnostic || typeof diagnostic !== 'object') return;
        const line = sceneReportLine(diagnostic);
        console.warn('[RISE scene]', line);
        if (this.params.has('measure')) this.sceneReports = [...this.sceneReports, line].slice(-20);
        this.port?.report(line);
    }

    /**
     * The Chamber on screen playing `player`, or null. The container is shown before the router
     * finishes its fade-in. Stop exposing controls as soon as it is hidden, and resolve the instance
     * through the router's public API.
     */
    chamberPlaying(player) {
        // On screen only: Read's container shown and the chamber pane the one it shows.
        const read = this.router?.getViewInstance?.('read');
        if (this.router?.views?.get('read')?.container?.hidden !== false || read?.activePane !== 'chamber') return null;
        const chamber = read.paneInstance('chamber');
        return chamber?.player === player ? chamber : null;
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
        // The venue asks every question of a room through the one adapter of the provider the reader chose.
        if (this.venue) return this.venueAdapter({ clock });
        if (this.providerName === 'mcp') {
            const { createMcpAppAdapter } = await import('../adapters/mcp-app.js');
            return createMcpAppAdapter({
                port: this.port, clock, host: framedBy(this.env.window ?? this.env),
                admittedEvents: this.embeddedEvents, admittedCurrent: this.embeddedCurrent
            });
        }
        if (this.providerName === 'gemini') {
            const [{ createGeminiAdapter }, { createGeminiFetchTransport }] = await Promise.all([
                import('../adapters/gemini.js'),
                import('../adapters/gemini-fetch.js')
            ]);
            // The key and the model are asked for at each request, so a forgotten key is not used again.
            return createGeminiAdapter({ transport: createGeminiFetchTransport({ getKey: () => this.key, getModel: () => this.model }) });
        }
        if (this.providerName === 'openrouter') {
            // The reader's connection and the model are asked for at each request (ai-connection.js holds the key).
            const { createOpenRouterAdapter } = await import('../adapters/openrouter.js');
            return createOpenRouterAdapter({ getModel: () => this.model });
        }
        if (this.providerName !== 'openai') {
            if (!this.hasCatalogChoice) return createMockAdapter({ clock });
            const admission = admitCatalogVisual(this.catalogId, this.caps);
            if (admission.status === 'refused' && admission.code !== 'CAPABILITY_UNAVAILABLE') {
                throw new Error('The catalog choice is unavailable.');
            }
            return createMockAdapter({
                clock,
                openingVisual: admission.status === 'accepted' ? admission.visual : 'still'
            });
        }
        const [{ createOpenAIRealtimeAdapter }, { createOpenAIWebRtcTransport }] = await Promise.all([
            import('../adapters/openai-realtime.js'),
            import('../adapters/openai-webrtc.js')
        ]);
        return createOpenAIRealtimeAdapter({ transport: createOpenAIWebRtcTransport({ getKey: () => this.key, clock }) });
    }

    async buildVoices(clock) {
        const wants = this.selectedVoice();
        if (wants === 'browser') {
            const { chooseVoice, createBrowserVoice, voicesFor, whenVoicesAvailable } = await import('../voices/browser.js');
            const synth = this.env.speechSynthesis;
            const list = await whenVoicesAvailable(synth, { clock });
            this.voiceCount = list.length;
            if (list.length > 0) {
                this.voiceKind = 'browser';
                this.showNotes();
                const speech = { synth, Utterance: this.env.SpeechSynthesisUtterance };
                const lang = this.env.navigator?.language || 'en';
                this.browserVoices = { list, lang, offered: voicesFor(list, lang), choose: chooseVoice, voice: null };
                this.useBrowserVoice(chooseVoice(list, lang, this.savedVoiceName()));
                return {
                    create: () => {
                        this.madeVoice = createBrowserVoice({ speech, clock, lang, voice: this.browserVoices.voice });
                        return this.madeVoice;
                    }
                };
            }
        }
        this.browserVoices = null;
        this.spokenVoice = null;
        const { createSyntheticVoice } = await import('../voices/synthetic.js');
        this.voiceKind = 'paced';
        this.showNotes();
        return { create: () => createSyntheticVoice({ clock }) };
    }

    /** The browser voice the reader saved in Settings, by name; empty for Automatic. */
    savedVoiceName() {
        const saved = this.getSettings?.()?.cardVoice;
        return typeof saved === 'string' ? saved : '';
    }

    useBrowserVoice(voice) {
        this.browserVoices.voice = voice;
        this.spokenVoice = voice ? Object.freeze({ name: voice.name, lang: voice.lang }) : null;
    }

    /**
     * The reader picked a browser voice by name in Settings (empty: Automatic, the ranking). It is kept, and the
     * voice speaking takes it from its next passage without interrupting this one (voices/browser.js setVoice).
     */
    chooseBrowserVoice(name) {
        if (!this.browserVoices) return;
        this.onSettingChange('cardVoice', name);
        const { list, lang, choose } = this.browserVoices;
        this.useBrowserVoice(choose(list, lang, name));
        this.madeVoice?.setVoice(this.browserVoices.voice);
    }

    /** What the stage's Voice row offers: the installed voices of the reading's language, and the reader's own; null without them. */
    voicePick() {
        if (!this.browserVoices) return null;
        const voices = this.browserVoices.offered.map(voice => ({ name: voice.name, local: voice.localService === true }));
        const saved = this.savedVoiceName();
        return { voices, selected: voices.some(voice => voice.name === saved) ? saved : '', choose: name => this.chooseBrowserVoice(name) };
    }

    // ─── the venue ──────────────────────────────────────────────────────

    /** The venue room's one adapter (venue.js). */
    venueAdapter({ clock }) {
        return this.venue.adapterFor({ clock });
    }

    /** The venue room's questions, each with its reading's journal once let go. */
    venueTurns() {
        return this.venue?.turns() ?? [];
    }

    /**
     * The stage over a venue reading: the whole instrument, the browser's own full screen, Settings with Sound, the
     * reader's voice and About this reading, and the room's choices carried from the reading before.
     */
    venueStage(runtime, { room, onPlayAgain }) {
        return createStageControls({
            runtime,
            onPlayAgain,
            chamber: () => { const player = runtime.playerFor?.(); return player ? this.chamberPlaying(player) : null; },
            paintTheme: theme => this.paintEmbedTheme(theme ?? undefined),
            audible: this.voiceKind === 'browser',
            degradations: this.degradations({ pacingShown: true }).filter(note => STAGE_NOTES.includes(note.capability)),
            sound: Boolean(this.audioEngine),
            about: () => this.aboutReading(),
            voice: this.voiceKind === 'browser' ? this.voicePick() : null,
            room
        });
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
        // A fresh frame lists its voices late (a host's sandbox: none at first, hundreds a moment later), and the first
        // getVoices() is what starts the listing. Asked now, so that by the reader's Play press the list is there.
        this.env.speechSynthesis?.getVoices?.();
        try {
            const [{ createMcpGuestPort }] = await Promise.all([import('../hosts/mcp-port.js'), this.modules]);
            if (this.destroyed || this.embeddedStartupCancelled) return;
            this.port = createMcpGuestPort({ frame, log: this.params.get('log') === 'host' ? line => console.log(line) : undefined });
            this.stopListeningError = this.port.onError(error => this.refuseEmbeddedProposal(error));
            this.port.onToolCancelled(() => {
                // The host withdrew the call this frame waits on: no answer will come of it. An
                // answer already delivered is the reader's to begin; the cancel does not take it back.
                if (this.destroyed || this.embeddedStartupCancelled || this.embeddedBeginStarted
                    || this.embeddedCurrentHandled || this.embeddedCurrentProcessing || this.embeddedQueuedCurrent) return;
                this.cancelEmbeddedPending();
                this.say('The assistant cancelled this answer.', { alert: true });
            });
            this.port.onTeardown(() => {
                this.embeddedStartupCancelled = true;
                this.cancelEmbeddedPending();
                this.stopFittingFrame?.();
                this.port?.close();
                this.port = null;
                // The host is taking the frame away, so the Chamber showing the reading goes with it.
                void this.ended().then(() => this.present?.dismissLive(this.router));
            });
            await this.port.connect();
            if (this.destroyed || this.embeddedStartupCancelled) return;
            this.fitFrame(frame);
            this.listenEmbeddedCurrent();
            this.armEmbeddedAnswerTimer();
        } catch (error) {
            if (this.destroyed || this.embeddedStartupCancelled) return;
            this.controls?.destroy();
            this.controls = null;
            this.runtime = null;
            this.port?.close();
            this.port = null;
            this.say(`Could not start: ${text(error?.message, 'unknown error').slice(0, 200)}`, { alert: true });
        }
    }

    /**
     * Fit the host's frame. The root is marked as the embed, the host's safe area and sans font
     * become variables with fallbacks, and the one height is told to the host after the handshake
     * and whenever it changes: a resize of the frame or a change of host context, coalesced to one
     * animation frame, sent only when the value differs. Width is never sent; the host owns it.
     */
    fitFrame(frame) {
        const root = this.container.ownerDocument.documentElement;
        root.dataset.embed = 'mcp';
        let reported = null;
        let pending = null;
        const report = () => {
            pending = null;
            if (!this.port) return;
            const { containerDimensions, safeAreaInsets, styles } = this.port.hostContext();
            for (const side of SAFE_SIDES) root.style.setProperty(`--safe-${side}`, `${Number(safeAreaInsets?.[side]) || 0}px`);
            const sans = styles?.variables?.['--font-sans'];
            // A font stack is a short list of names; anything longer is not one the page should take from its host.
            if (typeof sans === 'string' && sans && sans.length <= 200) root.style.setProperty('--font-sans', sans);
            else root.style.removeProperty('--font-sans');
            const height = embedHeight(frame.innerWidth, containerDimensions?.maxHeight);
            if (height === reported) return;
            reported = height;
            this.port.sizeChanged({ height });
        };
        const schedule = () => { if (pending === null) pending = frame.requestAnimationFrame(report); };
        const stopHostContext = this.port.onHostContext(schedule);
        const observer = new frame.ResizeObserver(schedule);
        observer.observe(root);
        report();
        this.stopFittingFrame = () => {
            this.stopFittingFrame = null;
            stopHostContext();
            observer.disconnect();
            if (pending !== null) frame.cancelAnimationFrame(pending);
            pending = null;
        };
    }

    /** The root marks fitFrame set, taken off when the page is left. */
    unmarkEmbedRoot() {
        const root = this.container.ownerDocument.documentElement;
        delete root.dataset.embed;
        for (const side of SAFE_SIDES) root.style.removeProperty(`--safe-${side}`);
        root.style.removeProperty('--font-sans');
    }

    listenEmbeddedCurrent() {
        if (!this.port || this.stopListeningCurrent || this.embeddedStartupCancelled || this.destroyed) return;
        const stopListeningCurrent = this.port.onCurrent(({ current }) => this.admitEmbeddedCurrent(current));
        if (this.embeddedCurrentHandled || this.destroyed || this.embeddedStartupCancelled) stopListeningCurrent();
        else this.stopListeningCurrent = stopListeningCurrent;
    }

    clearEmbeddedAnswerTimer() {
        if (this.embeddedAnswerTimer === null) return;
        clearTimeout(this.embeddedAnswerTimer);
        this.embeddedAnswerTimer = null;
    }

    armEmbeddedAnswerTimer() {
        this.clearEmbeddedAnswerTimer();
        if (this.destroyed || this.embeddedStartupCancelled || this.embeddedCurrentHandled
            || this.embeddedBeginStarted || !this.port) return;
        this.embeddedAnswerTimer = setTimeout(() => {
            this.embeddedAnswerTimer = null;
            if (this.destroyed || this.embeddedStartupCancelled || this.embeddedCurrentHandled
                || this.embeddedBeginStarted) return;
            // The host owns the wait: a long answer streams for longer than this, and a host re-showing an old call may
            // deliver its result late or not at all. The reader is told what to do, and the card keeps listening.
            this.say('Still waiting for the assistant’s answer. If none arrives, reload this chat.', { alert: true });
        }, this.embeddedAnswerTimeoutMs);
    }

    refuseEmbeddedProposal(error) {
        if (this.destroyed || this.embeddedStartupCancelled || this.embeddedBeginStarted
            || this.embeddedCurrentHandled || this.embeddedCurrentProcessing || this.embeddedQueuedCurrent) return;
        this.clearEmbeddedAnswerTimer();
        this.embeddedProposalRevision += 1;
        if (this.embeddedProposalCurrent) this.port?.forgetCurrent(this.embeddedProposalCurrent);
        if (this.embeddedQueuedCurrent) this.port?.forgetCurrent(this.embeddedQueuedCurrent);
        this.embeddedQueuedCurrent = null;
        this.embeddedProposalCurrent = null;
        this.embeddedEvents = null;
        this.embeddedCurrent = null;
        this.embeddedCurrentHandled = false;
        this.container.querySelector('.live-start')?.remove();
        this.say(`Ask the assistant again. The Current was refused: ${text(error?.message, 'invalid Current').slice(0, 220)}`, { alert: true });
        this.listenEmbeddedCurrent();
        this.armEmbeddedAnswerTimer();
    }

    async validateEmbeddedCurrent(current) {
        const { currentToEvents } = await import('../adapters/current-events.js');
        return currentToEvents(current);
    }

    async processEmbeddedCurrent(current, revision) {
        let events;
        let failure = null;
        try {
            events = await this.validateEmbeddedCurrent(current);
        } catch (error) {
            failure = error;
        }
        if (this.destroyed || this.embeddedStartupCancelled) return;

        if (revision !== this.embeddedProposalRevision) {
            this.port?.forgetCurrent(current);
            const queued = this.embeddedQueuedCurrent;
            this.embeddedQueuedCurrent = null;
            if (queued) {
                this.embeddedProposalCurrent = queued;
                void this.processEmbeddedCurrent(queued, this.embeddedProposalRevision);
            } else {
                this.embeddedProposalCurrent = null;
                this.embeddedCurrentProcessing = false;
            }
            return;
        }

        const queued = this.embeddedQueuedCurrent;
        if (queued) {
            this.port?.forgetCurrent(current);
            this.embeddedQueuedCurrent = null;
            this.embeddedProposalCurrent = queued;
            void this.processEmbeddedCurrent(queued, revision);
            return;
        }

        this.embeddedCurrentProcessing = false;
        if (failure) {
            this.port?.forgetCurrent(current);
            this.embeddedProposalCurrent = null;
            this.embeddedEvents = null;
            this.embeddedCurrent = null;
            this.say(`Ask the assistant again. The Current was refused: ${text(failure?.message, 'invalid Current').slice(0, 220)}`, { alert: true });
            this.armEmbeddedAnswerTimer();
            return;
        }

        this.clearEmbeddedAnswerTimer();
        this.embeddedEvents = events;
        this.embeddedCurrent = current;
        this.embeddedCurrentHandled = true;
        this.stopListeningCurrent?.();
        this.stopListeningCurrent = null;
        this.say('Answer ready.');
        this.showPoster(events[0]?.body ?? {});
    }

    /**
     * The answer, ready: its title over Play, in its theme's colors, and no other word. The title is
     * text, never markup; the heading is clamped to three lines, so the whole title is its label too.
     */
    showPoster({ title, theme: own, look }) {
        // The answer's own theme, or its look's: what the stage's Theme row calls "As written".
        const theme = own ?? lookTheme(look) ?? undefined;
        this.embeddedTheme = theme ?? null;
        this.paintEmbedTheme(theme);
        const main = this.container.querySelector('.live-host--embedded');
        main.classList.add('live-host--poster');
        const heading = document.createElement('h1');
        heading.className = 'live-title';
        heading.textContent = title;
        heading.setAttribute('aria-label', title);
        const play = document.createElement('button');
        play.type = 'button';
        play.className = 'live-start';
        play.setAttribute('aria-label', 'Play');
        play.innerHTML = PLAY_GLYPH;
        play.addEventListener('click', () => {
            this.unlockSpeech();
            this.unlockAudio();
            void this.beginEmbedded();
        });
        main.append(heading, play);
    }

    /** The whole frame in a theme's shipped colors, or in RISE's own when the answer names none. */
    paintEmbedTheme(theme) {
        const colors = jevColors(theme);
        const style = this.container.ownerDocument.documentElement.style;
        for (const [name, key] of EMBED_THEME_VARS) {
            if (colors) style.setProperty(name, colors[key]);
            else style.removeProperty(name);
        }
    }

    /** Inside a reader's press, before anything is awaited: a browser voice begun later may then be heard (voices/browser.js). */
    unlockSpeech() {
        if (this.selectedVoice() !== 'browser') return;
        unlockSpeech({ synth: this.env.speechSynthesis, Utterance: this.env.SpeechSynthesisUtterance });
    }

    /** Inside a reader's press, before anything is awaited: the beds' context and, on WebKit, an audio session a ring switch does not mute. */
    unlockAudio() {
        this.audioKeeper = unlockAudio({
            engine: this.audioEngine ?? this.engineAtHand,
            navigator: this.env.navigator,
            Audio: this.env.Audio,
            silence: siteUrl('/audio/silence.wav'),
            keeper: this.audioKeeper
        });
    }

    /** The reading is over: the silent loop stops, and the audio session goes back to WebKit's own choice. */
    releaseAudioSession() {
        this.audioKeeper?.pause();
        try { if (this.env.navigator?.audioSession) this.env.navigator.audioSession.type = 'auto'; } catch { /* WebKit's own choice already */ }
    }

    /** Validate the host's sealed answer once, then wait for the reader to begin it. */
    admitEmbeddedCurrent(current) {
        if (this.destroyed || this.embeddedStartupCancelled || this.embeddedCurrentHandled) return true;
        this.clearEmbeddedAnswerTimer();
        if (this.embeddedCurrentProcessing) {
            // Keep the superseded queued proposal remembered by the port. Its
            // delayed matching tool-result is a duplicate, not a new proposal.
            this.embeddedQueuedCurrent = current;
            return true;
        }
        this.embeddedProposalRevision += 1;
        this.embeddedProposalCurrent = current;
        this.embeddedCurrentProcessing = true;
        void this.processEmbeddedCurrent(current, this.embeddedProposalRevision);
        return true;
    }

    /** @param {{keepFocus?: boolean}} [how] keepFocus: the control that started it had the focus (Play again's). */
    async beginEmbedded({ keepFocus = false } = {}) {
        if (!this.embeddedEvents || this.embeddedBeginStarted || this.destroyed || this.embeddedStartupCancelled) return;
        this.embeddedBeginStarted = true;
        this.starting = true;
        const play = this.container.querySelector('.live-start');
        let takeFocus = keepFocus;
        if (play) {
            // The stage's object takes the focus once it can be pressed; until then it rests nowhere, not on a disabled poster.
            takeFocus ||= play === this.container.ownerDocument.activeElement;
            play.blur();
            play.disabled = true;
            play.setAttribute('aria-label', 'Starting');
        }
        try {
            const runtime = await this.buildRuntime();
            if (this.destroyed || this.embeddedStartupCancelled) {
                await runtime.stop();
                return;
            }
            this.runtime = runtime;
            // The stage: the transport and Settings, no microphone, no notice, no notes, no question. What
            // this device cannot do goes into the hidden status, which already says a silent reading is paced.
            this.controls = createStageControls({
                runtime,
                onPlayAgain: () => {
                    this.unlockSpeech();
                    this.unlockAudio();
                    void this.playAgainEmbedded();
                },
                chamber: () => { const player = runtime.playerFor?.(); return player ? this.chamberPlaying(player) : null; },
                paintTheme: theme => this.paintEmbedTheme(theme ?? this.embeddedTheme),
                audible: this.voiceKind === 'browser',
                degradations: this.degradations({ pacingShown: true }).filter(note => STAGE_NOTES.includes(note.capability)),
                takeFocus,
                // Sound, where the reading has an engine for its beds and tones.
                sound: Boolean(this.audioEngine),
                // The host card: whether its host will show the card full screen, or floating.
                port: this.port,
                about: () => this.aboutReading(),
                // The reader's own browser voice, where the reading speaks with one.
                voice: this.voiceKind === 'browser' ? this.voicePick() : null
            });
            await runtime.start('The answer the assistant presents');
        } catch (error) {
            if (this.destroyed || this.embeddedStartupCancelled) return;
            this.controls?.destroy();
            this.controls = null;
            this.runtime = null;
            this.embeddedEvents = null;
            this.embeddedCurrent = null;
            this.say(`Could not start: ${text(error?.message, 'unknown error').slice(0, 200)}`, { alert: true });
            this.port?.close();
            this.port = null;
        } finally {
            this.starting = false;
        }
    }

    /**
     * Play again: the finished runtime is stopped and a new one is built from the same admitted answer.
     * A runtime carries one conversation (`runtime.start` refuses a second), so the reading is rebuilt,
     * not resumed; and the end never goes through `ended()`, which would close the port to the host.
     */
    async playAgainEmbedded() {
        if (!this.embeddedEvents || this.destroyed || this.embeddedStartupCancelled || this.starting) return;
        const runtime = this.runtime;
        this.runtime = null;
        const keepFocus = this.controls?.element.contains(this.container.ownerDocument.activeElement) === true;
        this.controls?.destroy();
        this.controls = null;
        await runtime?.stop();
        if (this.destroyed || this.embeddedStartupCancelled) return;
        this.embeddedBeginStarted = false;
        await this.beginEmbedded({ keepFocus });
    }

    cancelEmbeddedPending() {
        this.clearEmbeddedAnswerTimer();
        this.embeddedProposalRevision += 1;
        this.stopListeningCurrent?.();
        this.stopListeningCurrent = null;
        this.stopListeningError?.();
        this.stopListeningError = null;
        this.embeddedEvents = null;
        this.embeddedCurrent = null;
        this.embeddedCurrentProcessing = false;
        this.embeddedProposalCurrent = null;
        this.embeddedQueuedCurrent = null;
    }

    /** The reader pressed Stop on the standalone page, or asked to leave; the embed has no Stop. */
    async stop() {
        this.stopHearingExitListener();
        if (this.embedded) {
            this.embeddedStartupCancelled = true;
            this.cancelEmbeddedPending();
            this.stopFittingFrame?.();
            this.port?.close();
            this.port = null;
        }
        const runtime = this.runtime;
        this.runtime = null;
        this.forgetKey();
        this.controls?.destroy();
        this.controls = null;
        await runtime?.stop();
        this.resetButton();
        this.releaseAudio();
        this.releaseAudioSession();
        await this.present?.leaveLive(this.router);
        if (this.embedded && !this.destroyed) this.say('Stopped.');
    }

    /** The reader left the Chamber by its own control: end what was running. */
    async ended() {
        // In the venue that is leaving the room, back to its entry.
        if (this.venue && !this.destroyed) return this.venue.leave();
        this.stopHearingExitListener();
        if (this.embedded) {
            this.embeddedStartupCancelled = true;
            this.cancelEmbeddedPending();
            this.port?.close();
            this.port = null;
        }
        const runtime = this.runtime;
        this.runtime = null;
        this.forgetKey();
        this.controls?.destroy();
        this.controls = null;
        await runtime?.stop();
        this.resetButton();
        this.releaseAudio();
        this.releaseAudioSession();
        if (this.embedded && !this.destroyed) this.say('Finished.');
    }

    activate() {
        this.container.querySelector('#live-prompt, #live-venue-question')?.focus({ preventScroll: true });
    }

    deactivate() {}

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.container.ownerDocument.defaultView?.removeEventListener('rise-scene-diagnostic', this.onSceneDiagnostic);
        this.container.ownerDocument.defaultView?.removeEventListener('rise-band-note', this.onBandNote);
        this.embeddedStartupCancelled = true;
        this.cancelEmbeddedPending();
        this.stopHearingExitListener();
        this.venue?.destroy();
        void this.ended();
        this.stopFittingFrame?.();
        this.port?.close();
        this.port = null;
        this.container.replaceChildren();
        if (this.embedded) {
            this.paintEmbedTheme();
            this.unmarkEmbedRoot();
        }
    }
}
