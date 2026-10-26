/**
 * The Live venue: the Reader site's `/live` page, where RISE owns the room (docs/superpowers/specs/2026-10-09-rise-live-design.md §5).
 *
 * Before the first question it is a page: one field for the question (Enter asks it), the microphone where the
 * browser can listen, the providers the registry offers (src/live/adapters/registry.js), and a sentence on whose key
 * it is and what is sent. Once a question is asked the reading takes the screen: the Chamber, the stage's whole
 * instrument (stage-controls.js, full screen by the browser's own API), and a small bar to ask again. One room holds
 * many readings: each question goes to the same adapter, the reader's Settings choices carry from one reading to the
 * next (the stage's `room`), and the journal of each reading is kept for perception (venue-entry.js perceptionFor).
 *
 * While a reading plays, the reader may speak into it (the interjection, docs/plans/LIVE-CURRENT.md §17): the
 * microphone, or a first letter typed in the bar's small field, holds the reading at once; Enter asks inside the room;
 * Escape, or Play, takes it back. A reading paused with Play, or one that has ended, is asked again as a new reading.
 * Words asked inside the room that only name one of RISE's own visuals are shown at once, with no request (§25).
 *
 * RISE's face (docs/plans/LIVE-CURRENT.md §22) is the room's resting picture: in the entry before a question, and in
 * the room for the whole of every reading, holding each visual the reading shows in one of three frames, the visual
 * choosing which (§23, frames.js). It is the venue's own layer (face-layer.js), never part of a reading: no Current,
 * journal or perception knows it is there.
 *
 * The host (LiveHost.js) builds each runtime, the voice and the sound as it does for every reading; this owns the
 * entry state (venue-entry.js) and what the reader sees of it. A typed key is held in the host's memory (`host.key`)
 * and nowhere else: never in the state, the page, storage or a URL.
 */

import { connectionState, subscribeConnection, takeConnectionNotice } from '../../core/ai-connection.js';
import { claimOpenRouterReturn } from '../../core/openrouter-callback.js';
import { OPENROUTER_DEFAULT_MODEL } from '../adapters/openrouter-model.js';
import { addUsage, earlierFor, earlierLine, emptyUsage, faceStateOf, initialVenue, interjectionPerception, perceptionFor, usageLine, venueStep } from './venue-entry.js';
import { FACE_SKINS, faceDark, faceLight, facePalette, faceStill } from './face-still.js';
import { createFrameDirector, frameGeometry, frameOf, holdsContent, hungPicture, hungRect, restScale, roomLayout, visualOf, visualTransform } from './frames.js';
import { collectionEngine } from '../../core/beats.js';
import { catalogNote, recogniseVisual } from '../catalog-words.js';
import { DEMO_OFFERED, DEMO_QUESTIONS } from '../fixtures/demo-questions.js';

/** How long the bar still says what a reader's catalog word showed once the room is at rest on it. */
const CHOSEN_BEAT_MS = 1_500;

/** Who makes the pictures (picturesPolicy): RISE's own visuals, the model that answers, another OpenRouter model. */
const PICTURES = Object.freeze(['rise', 'same', 'model']);
/** The venue's address: an OpenRouter sign-in started here comes back here (openrouter-callback.js). */
const LIVE_PATH = '/live';
/** The longest a visual takes to fade out, as the Chamber sets it. */
const CROSSFADE_MS = 1200;
/** The most the room's frame clock moves in one animation frame: a stalled frame slows a transition, it skips none of it. */
const FRAME_STEP_MS = 50;
/** How fast the docked face follows the bar's end when the bar moves: a critically damped spring of this rate, per second. */
const DOCK_RATE = 16;

const MIC_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><rect x="9" y="3.5" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>';
const LEAVE_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>';

const SENT = 'What is sent is your question, and what you did while it played (play, pause, replay, pace, settings, words you spoke to it), sent only with your next words. A question asked while it reads also carries the reading so far. Your earlier questions in this room and what RISE said in answer go with each new question, to the provider you chose; they are forgotten when you leave. Nothing is stored; a reload forgets the key.';

/** Whose key, where it goes and what is sent, for a provider's credential (docs/USER-OWNED-AI.md). */
function privacy(entry) {
    if (entry?.credential === 'openrouter') return `Your OpenRouter key stays in this tab’s memory and goes only to OpenRouter, billed to your account. ${SENT}`;
    if (entry?.credential === 'key') return `Your ${entry.keyName} key stays in this page’s memory and goes only to ${entry.keyGoesTo}, billed to your key. ${SENT}`;
    return 'The demo answers from a script in this page: nothing you type leaves this browser, and no key is needed.';
}

/**
 * The room's one provider for a sealed Current already admitted on the page (a RISE Changes digest's,
 * src/app/changes.js): no key, no request, the Current itself (adapters/sealed.js).
 */
export function sealedProvider(current) {
    return Object.freeze({
        id: 'sealed',
        label: 'RISE Changes',
        credential: 'none',
        adapter: async ({ clock }) => (await import('../adapters/sealed.js')).createSealedAdapter({ current, clock })
    });
}

/** Whose key the voice is on, for the voice the reader chose (voices/elevenlabs.js). */
function voicePrivacy(choice) {
    if (choice === 'elevenlabs') return 'The voice is ElevenLabs on your key, which stays in this page’s memory and goes only to ElevenLabs, billed per character to your account: each passage’s words are sent to it to be spoken.';
    return 'The voice is your device’s own; nothing of the reading leaves this browser to be spoken.';
}

export class LiveVenue {
    /**
     * @param {object} host the LiveHost presenting this page
     * @param {object} options
     * @param {readonly object[]} options.providers the registry
     * @param {{current: object, path: string, who: string, about?: string[]}|null} [options.sealed] a sealed Current
     *   already admitted on the page at `path`, the room's only source: no question, no provider, no bar; `who` says who
     *   wrote it and `about` what it speaks about, for About this reading
     */
    constructor(host, { providers, sealed = null }) {
        this.host = host;
        this.sealed = sealed;
        this.providers = sealed ? [sealedProvider(sealed.current)] : providers;
        this.doc = host.container.ownerDocument;
        this.state = initialVenue({ provider: this.providers[0]?.id === 'sealed' ? 'sealed' : undefined });
        // The reader's Settings choices, from one reading's stage to the next.
        this.room = {};
        // The room's adapter, made at its first question; every question of the room is asked of it. And another
        // model's, when it draws the pictures (illustratorFor).
        this.adapter = null;
        this.picturesAdapter = null;
        // Each reading the room has let go, by the index of its question: its journal and its passages, for perception.
        this.readings = [];
        this.reading = null;
        // The perception sent with the question the reading on screen answers, or null.
        this.sent = null;
        // How many earlier turns of the room went up with that question.
        this.sentEarlier = 0;
        // What the reading on screen has cost the reader: every request the room made for it, and what was reported.
        this.usage = emptyUsage();
        this.stage = null;
        this.bar = null;
        this.stopFollowing = null;
        this.mic = null;
        this.listener = null;
        this.heldByMic = false;
        this.micActive = false;
        // Whether the reader is typing a question: words typed and not yet asked or taken back.
        this.typing = false;
        // What the bar says of a visual the reader named (showChosen), until its timer lets it go.
        this.chosenNote = null;
        this.chosenTimer = 0;
        // The visual a catalog word named, while its note waits for the room to come to rest on it, then the beat's end.
        this.chosenWait = null;
        this.destroyed = false;
        // The OpenRouter model the reader named (a setting, not a secret); empty asks the adapter's default.
        this.openRouterModel = String(host.getSettings?.()?.liveOpenRouterModel ?? '').trim();
        // Who makes the pictures, as the reader chose ('' until they do: picturesPolicy), and the model that draws them.
        this.pictures = PICTURES.includes(host.getSettings?.()?.livePictures) ? host.getSettings().livePictures : '';
        this.picturesModel = String(host.getSettings?.()?.livePicturesModel ?? '').trim();
        // The face: its element, its engine once loaded, whether the last question failed, and (?measure=1) its states.
        const saved = host.getSettings?.()?.liveFace;
        this.faceSkin = FACE_SKINS.includes(saved) ? saved : 'sophia';
        this.face = this.makeFace();
        this.faceEngine = null;
        // The room's frame while the face is in the room (§23): its director, clock and animation frame, or null.
        this.framing = null;
        this.failedAsk = false;
        this.faceLog = [{ state: 'arrival', at: performance.now() }];
        this.render();
        void this.wakeFace();
        // Still imagery, photosensitivity or the system's reduced motion, turned on or off while the face draws: the
        // app marks the root (app.js applyAccessibilitySettings), and the face is started again to match.
        this.stillWatch = typeof MutationObserver === 'function' ? new MutationObserver(() => this.followStillness()) : null;
        this.stillWatch?.observe(this.doc.documentElement, { attributes: true, attributeFilter: ['class'] });
        if (host.params?.has('measure')) this.measureFace();
        // Connecting or disconnecting OpenRouter elsewhere in the tab is shown here at once.
        this.stopConnection = subscribeConnection(() => { if (this.chosen()?.credential === 'openrouter') this.renderCredential(); });
        // A sealed room asks nothing: no sign-in comes back to it, and nothing is said to it.
        if (sealed) return;
        const returned = claimOpenRouterReturn(LIVE_PATH);
        if (returned) void this.welcomeBack(returned);
        void Promise.resolve(host.buildMic()).then(mic => { if (mic && !this.destroyed) this.useMic(mic); }, () => {});
    }

    chosen() {
        return this.providers.find(entry => entry.id === this.state.provider) ?? null;
    }

    dispatch(event) {
        this.state = venueStep(this.state, event, this.providers);
        this.paint();
    }

    /** The questions the room has asked, each with the journal and passages of its reading once that reading was let go. */
    turns() {
        return this.state.turns.map((turn, index) => ({ ...turn, ...this.readings[index] }));
    }

    /**
     * The room's one adapter, made once from the chosen provider; the key is asked for at each request. Every request it
     * opens is the reader's, the illustrator's among them (docs/plans/LIVE-CURRENT.md §19), so each is counted for the
     * reading on screen, with what the provider reports it cost.
     */
    adapterFor({ clock }) {
        this.adapter ??= Promise.resolve(this.chosen().adapter({
            clock,
            getKey: () => this.host.key,
            getModel: () => this.openRouterModel || undefined,
            onUsage: report => { this.usage = addUsage(this.usage, { report }); }
        }))
            .then(adapter => ({
                ...adapter,
                open: (request, options) => {
                    this.usage = addUsage(this.usage, { intent: request?.intent });
                    // A room of RISE's own visuals tells the composer so (openai-instructions.js); a picture asked of it is drawn.
                    const own = this.picturesPolicy() === 'rise' && request?.intent !== 'illustrate';
                    return adapter.open(own ? { ...request, pictures: 'rise' } : request, options);
                },
                // A figure or a code scene written all the same is refused there, by name.
                admitScene: scene => (this.picturesPolicy() === 'rise'
                    ? `Scene "${scene.id}" was refused: this room shows RISE’s own visuals only.`
                    : adapter.admitScene?.(scene) ?? null)
            }));
        return this.adapter;
    }

    /**
     * Who draws a picture the composer asks for (runtime.js `illustrator`): null for RISE's own visuals only; another
     * OpenRouter model, on the same connection and counted with the reading's requests; or the room's own adapter
     * (undefined).
     */
    async illustratorFor({ clock }) {
        const policy = this.picturesPolicy();
        if (policy === 'rise') return null;
        if (policy !== 'model') return undefined;
        const entry = this.providers.find(item => item.id === 'openrouter');
        this.picturesAdapter ??= Promise.resolve(entry.adapter({
            clock,
            getModel: () => this.picturesModel || undefined,
            onUsage: report => { this.usage = addUsage(this.usage, { report }); }
        })).then(adapter => ({
            ...adapter,
            open: (request, options) => {
                this.usage = addUsage(this.usage, { intent: request?.intent });
                return adapter.open(request, options);
            }
        }));
        return this.picturesAdapter;
    }

    /** What the reading on screen has cost, for About this reading; the demo says it spends nothing, and a sealed room asks nothing. */
    usageLine() {
        if (this.sealed) return '';
        return usageLine(this.usage, { demo: this.chosen()?.credential === 'none' });
    }

    /** How many earlier turns of the room went up with the question on screen, for About this reading. */
    earlierLine() {
        return earlierLine(this.sentEarlier);
    }

    // ─── the entry page ────────────────────────────────────────────────

    /**
     * The entry is a room, not a form: the face, the name, one line for the question, and one quiet sentence naming
     * who answers and who speaks, each name the button that opens its choices. Whose key it is and what is sent sit
     * folded at the foot. The room is drawn in the face's skin (facePalette), dark in either site theme.
     */
    render() {
        const container = this.host.container;
        // The arrival plays once, when the page is first opened; the entry returned to after a reading is simply there.
        const arriving = !this.arrived;
        this.arrived = true;
        if (this.sealed) {
            this.renderSealed(arriving);
            return;
        }
        container.innerHTML = `
      <main class="live-host live-venue${arriving ? ' live-venue--arriving' : ''}" aria-labelledby="live-venue-title">
        <div class="live-venue__face"><div class="live-venue__bloom" aria-hidden="true"></div></div>
        <h1 class="live-venue__mark" id="live-venue-title">RISE <span>Live</span></h1>
        <p class="live-venue__lede">Ask, and the answer becomes a reading.</p>
        <form class="live-venue__ask" novalidate>
          <label class="live-venue__sr" for="live-venue-question">Your question</label>
          <div class="live-venue__field">
            <input id="live-venue-question" name="question" type="text" maxlength="2000" autocomplete="off" enterkeyhint="go" placeholder="Ask anything.">
            <button type="submit" class="live-start">Ask <span aria-hidden="true">→</span></button>
          </div>
          <p class="live-venue__try" hidden></p>
          <p class="live-venue__choices">Answered by <button type="button" class="live-venue__choice" data-venue-open="providers" aria-expanded="false" aria-controls="live-venue-providers-panel"></button><span class="live-venue__pictures-choice"><span aria-hidden="true"> · </span>pictures by <button type="button" class="live-venue__choice" data-venue-open="pictures" aria-expanded="false" aria-controls="live-venue-pictures-panel"></button></span><span aria-hidden="true"> · </span>spoken by <button type="button" class="live-venue__choice" data-venue-open="voices" aria-expanded="false" aria-controls="live-venue-voices-panel"></button></p>
          <div class="live-venue__panel" id="live-venue-providers-panel" data-panel="providers" hidden>
            <fieldset class="live-venue__providers">
              <legend class="live-venue__legend">Who answers</legend>
            </fieldset>
            <div class="live-venue__credential"></div>
          </div>
          <div class="live-venue__panel" id="live-venue-pictures-panel" data-panel="pictures" hidden>
            <fieldset class="live-venue__pictures">
              <legend class="live-venue__legend">Who makes the pictures</legend>
              <label class="live-venue__provider"><input type="radio" name="live-venue-pictures" value="rise"><span>RISE’s own visuals</span></label>
              <label class="live-venue__provider"><input type="radio" name="live-venue-pictures" value="same"><span>The model that answers</span></label>
              <label class="live-venue__provider"><input type="radio" name="live-venue-pictures" value="model"><span>Another OpenRouter model</span></label>
            </fieldset>
            <div class="live-venue__pictures-credential"></div>
          </div>
          <div class="live-venue__panel" id="live-venue-voices-panel" data-panel="voices" hidden>
            <fieldset class="live-venue__voices">
              <legend class="live-venue__legend">Who speaks</legend>
              <label class="live-venue__provider"><input type="radio" name="live-venue-voice" value="device" checked><span>Your device’s voice</span></label>
              <label class="live-venue__provider"><input type="radio" name="live-venue-voice" value="elevenlabs"><span>ElevenLabs (your key)</span></label>
            </fieldset>
            <div class="live-venue__voice-credential"></div>
          </div>
        </form>
        <p class="live-error" role="alert" hidden></p>
        <p class="live-venue__heard" role="status" aria-live="polite"></p>
        <details class="live-venue__sent">
          <summary>What is sent, and to whom</summary>
          <p class="live-venue__privacy"></p>
          <p class="live-venue__mic-privacy" hidden></p>
        </details>
      </main>`;
        const $ = selector => container.querySelector(selector);
        this.root = $('.live-venue');
        this.paintSkin();
        this.form = $('.live-venue__ask');
        this.field = $('#live-venue-question');
        this.errorLine = $('.live-error');
        this.heardLine = $('.live-venue__heard');
        this.privacyLine = $('.live-venue__privacy');
        this.credential = $('.live-venue__credential');
        this.voiceCredential = $('.live-venue__voice-credential');
        for (const radio of container.querySelectorAll('input[name="live-venue-voice"]')) {
            radio.checked = radio.value === this.host.voiceChoice;
            radio.addEventListener('change', () => {
                if (!radio.checked) return;
                this.host.voiceChoice = radio.value;
                // A key typed for the provider's voice is not kept once the device's is chosen.
                if (radio.value !== 'elevenlabs') this.host.forgetVoiceKey();
                this.renderVoiceCredential();
                this.renderCredential();
            });
        }
        this.picturesCredential = $('.live-venue__pictures-credential');
        for (const radio of container.querySelectorAll('input[name="live-venue-pictures"]')) {
            radio.addEventListener('change', () => {
                if (!radio.checked) return;
                this.pictures = radio.value;
                this.host.onSettingChange?.('livePictures', radio.value);
                this.renderChoices();
            });
        }
        this.startButton = $('.live-start');
        this.wirePanels();
        const choices = $('.live-venue__providers');
        for (const entry of this.providers) {
            const label = this.doc.createElement('label');
            label.className = 'live-venue__provider';
            const radio = this.doc.createElement('input');
            radio.type = 'radio';
            radio.name = 'live-venue-provider';
            radio.value = entry.id;
            radio.checked = entry.id === this.state.provider;
            radio.disabled = !entry.adapter;
            const name = this.doc.createElement('span');
            name.textContent = entry.adapter ? entry.label : `${entry.label}, soon`;
            label.append(radio, name);
            choices.append(label);
            radio.addEventListener('change', () => {
                if (!radio.checked) return;
                // A key typed for another provider is not this one's to keep.
                this.host.forgetKey();
                this.dispatch({ type: 'choose', provider: entry.id });
                this.renderCredential();
            });
        }
        this.form.addEventListener('submit', event => {
            event.preventDefault();
            this.ask(this.field.value);
        });
        // A question the Demo answers, offered while it is the one answering: asked as if typed.
        this.tryLine = $('.live-venue__try');
        this.tryLine.addEventListener('click', event => {
            const question = event.target.closest?.('button[data-question]')?.dataset.question;
            if (!question) return;
            this.field.value = question;
            this.ask(question);
        });
        // The face listens while the reader types a question.
        this.field.addEventListener('input', () => this.typed(this.field));
        if (this.mic) this.addMic(this.form.querySelector('.live-venue__field'));
        this.showMicPrivacy();
        this.renderVoiceCredential();
        this.renderCredential();
        this.paint();
    }

    /**
     * A sealed room's entry: the face, the reading's title over Play, who wrote it, whose voice speaks it (the venue's
     * choice of voice), and the way back to the page it was opened from. Nothing in it asks a question.
     */
    renderSealed(arriving) {
        const container = this.host.container;
        container.innerHTML = `
      <main class="live-host live-venue live-venue--sealed${arriving ? ' live-venue--arriving' : ''}" aria-labelledby="live-venue-title">
        <div class="live-venue__face"><div class="live-venue__bloom" aria-hidden="true"></div></div>
        <p class="live-venue__lede live-venue__eyebrow">RISE Changes</p>
        <h1 class="live-venue__title" id="live-venue-title"></h1>
        <form class="live-venue__ask" novalidate>
          <button type="submit" class="live-start live-venue__play">Play <span aria-hidden="true">→</span></button>
          <p class="live-venue__who"></p>
          <p class="live-venue__choices">Spoken by <button type="button" class="live-venue__choice" data-venue-open="voices" aria-expanded="false" aria-controls="live-venue-voices-panel"></button></p>
          <div class="live-venue__panel" id="live-venue-voices-panel" data-panel="voices" hidden>
            <fieldset class="live-venue__voices">
              <legend class="live-venue__legend">Who speaks</legend>
              <label class="live-venue__provider"><input type="radio" name="live-venue-voice" value="device" checked><span>Your device’s voice</span></label>
              <label class="live-venue__provider"><input type="radio" name="live-venue-voice" value="elevenlabs"><span>ElevenLabs (your key)</span></label>
            </fieldset>
            <div class="live-venue__voice-credential"></div>
          </div>
        </form>
        <p class="live-error" role="alert" hidden></p>
        <p class="live-venue__heard" role="status" aria-live="polite"></p>
        <p class="live-venue__privacy live-venue__sealed-privacy"></p>
        <p class="live-venue__back"><a href="" data-venue="back">Back to the digest</a></p>
      </main>`;
        const $ = selector => container.querySelector(selector);
        this.root = $('.live-venue');
        this.paintSkin();
        // Model-written words: text, never markup.
        $('#live-venue-title').textContent = this.sealed.current.title;
        $('.live-venue__who').textContent = this.sealed.who;
        this.form = $('.live-venue__ask');
        this.field = null;
        this.credential = null;
        this.errorLine = $('.live-error');
        this.heardLine = $('.live-venue__heard');
        this.privacyLine = $('.live-venue__privacy');
        this.voiceCredential = $('.live-venue__voice-credential');
        for (const radio of container.querySelectorAll('input[name="live-venue-voice"]')) {
            radio.checked = radio.value === this.host.voiceChoice;
            radio.addEventListener('change', () => {
                if (!radio.checked) return;
                this.host.voiceChoice = radio.value;
                if (radio.value !== 'elevenlabs') this.host.forgetVoiceKey();
                this.renderVoiceCredential();
                this.renderCredential();
            });
        }
        this.startButton = $('.live-start');
        this.wirePanels();
        this.form.addEventListener('submit', event => {
            event.preventDefault();
            this.ask(this.sealed.current.title);
        });
        const back = $('[data-venue="back"]');
        back.setAttribute('href', this.sealed.path);
        back.addEventListener('click', event => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            this.host.leaveSealed();
        });
        this.renderVoiceCredential();
        this.renderCredential();
        this.paint();
    }

    /**
     * The face's skin, worn by the room: its ground, bloom, hairlines and accents (LiveHost.css `.live-venue`). Set on
     * the document's root, not the venue's, so the page behind the app's own fade-in wears the same ground.
     */
    paintSkin() {
        const root = this.doc.documentElement;
        for (const [name, value] of Object.entries(facePalette(this.faceSkin))) root.style.setProperty(name, value);
        // A light face makes a light room (LiveHost.css, "The light room"): the reading and the stage wear it too.
        if (faceLight(this.faceSkin)) root.dataset.liveRoom = 'light';
        else delete root.dataset.liveRoom;
    }

    /**
     * The quiet line's two names open their choices: a small panel rising from the line (a sheet from the foot on a phone),
     * one at a time. Escape, or a press anywhere else in the room, closes it and gives focus back to its name.
     */
    wirePanels() {
        const root = this.root;
        this.openedPanel = null;
        for (const trigger of root.querySelectorAll('[data-venue-open]')) {
            trigger.addEventListener('click', () => this.openPanel(trigger.getAttribute('aria-expanded') === 'true' ? null : trigger.dataset.venueOpen));
        }
        root.addEventListener('keydown', event => {
            if (event.key !== 'Escape' || !this.openedPanel) return;
            // Answered here: the router leaves the page only on an Escape nothing has prevented.
            event.preventDefault();
            this.openPanel(null, { refocus: true });
        });
        // Back to the question: the choices give it the room.
        this.field?.addEventListener('focus', () => { if (this.openedPanel) this.openPanel(null); });
        root.addEventListener('pointerdown', event => {
            if (!this.openedPanel || event.target.closest?.('.live-venue__panel, [data-venue-open]')) return;
            this.openPanel(null);
        });
    }

    /** Opens the named panel (and closes the other), or closes whichever is open for null. */
    openPanel(name, { refocus = false } = {}) {
        const was = this.openedPanel;
        this.openedPanel = name;
        for (const panel of this.root.querySelectorAll('.live-venue__panel')) panel.hidden = panel.dataset.panel !== name;
        for (const trigger of this.root.querySelectorAll('[data-venue-open]')) trigger.setAttribute('aria-expanded', String(trigger.dataset.venueOpen === name));
        if (name) {
            const panel = this.root.querySelector(`.live-venue__panel[data-panel="${name}"]`);
            (panel.querySelector('input[type="radio"]:checked') ?? panel.querySelector('input'))?.focus({ preventScroll: true });
        } else if (refocus && was) {
            this.root.querySelector(`[data-venue-open="${was}"]`)?.focus({ preventScroll: true });
        }
    }

    /** The quiet line names the current choices: the provider's short name, and whose voice. */
    renderChoices() {
        const entry = this.chosen();
        const answered = this.root?.querySelector('[data-venue-open="providers"]');
        const spoken = this.root?.querySelector('[data-venue-open="voices"]');
        if (!spoken || (!answered && !this.sealed)) return;
        const name = (entry?.label ?? 'Demo').replace(/\s*\(.*\)$/u, '');
        if (answered) {
            answered.textContent = name;
            answered.setAttribute('aria-label', `Who answers: ${name}`);
        }
        // The Demo knows a few subjects: the field says so, and a few of its questions are offered under it.
        const demo = !entry || entry.id === 'mock';
        if (this.field) this.field.placeholder = demo ? 'Ask about black holes and more.' : 'Ask anything.';
        if (this.tryLine) {
            this.tryLine.hidden = !demo;
            if (demo && !this.tryLine.childElementCount) {
                const label = this.doc.createElement('span');
                label.textContent = 'Try';
                this.tryLine.replaceChildren(label, ...DEMO_QUESTIONS.slice(0, DEMO_OFFERED).map(question => {
                    const button = this.doc.createElement('button');
                    button.type = 'button';
                    button.className = 'live-venue__question';
                    button.dataset.question = question;
                    button.textContent = question;
                    return button;
                }));
            }
        }
        const voice = this.host.voiceChoice === 'elevenlabs' ? 'ElevenLabs' : 'your device';
        spoken.textContent = voice;
        spoken.setAttribute('aria-label', `Who speaks: ${voice}`);
        this.renderPictures();
    }

    /**
     * Who makes the pictures: RISE's own visuals, the model that answers, or another model on the same OpenRouter
     * account. The Demo's readings are written with their pictures, so it offers no choice.
     */
    picturesPolicy() {
        const entry = this.chosen();
        if (!entry || entry.id === 'mock') return 'same';
        if (this.pictures === 'model') return entry.credential === 'openrouter' ? 'model' : 'same';
        if (this.pictures) return this.pictures;
        // Unchosen: a free model shows RISE's own visuals, which ask the least of it; any other draws its own.
        return entry.credential === 'openrouter' && this.openRouterModel.endsWith(':free') ? 'rise' : 'same';
    }

    /** The quiet line's "pictures by", the panel's radios, and the model field under "Another OpenRouter model". */
    renderPictures() {
        const named = this.root?.querySelector('[data-venue-open="pictures"]');
        if (!named) return;
        const entry = this.chosen();
        const policy = this.picturesPolicy();
        this.root.querySelector('.live-venue__pictures-choice').hidden = !entry || entry.id === 'mock';
        const model = this.picturesModel || OPENROUTER_DEFAULT_MODEL;
        const name = { rise: 'RISE', same: 'the same model', model: model.split('/').at(-1) }[policy];
        named.textContent = name;
        named.setAttribute('aria-label', `Who makes the pictures: ${name}`);
        for (const radio of this.root.querySelectorAll('input[name="live-venue-pictures"]')) {
            radio.checked = radio.value === policy;
            if (radio.value === 'model') radio.disabled = entry?.credential !== 'openrouter';
        }
        this.picturesCredential.replaceChildren();
        this.root.querySelector('input[name="live-venue-pictures"]:checked')?.closest('label')?.after(this.picturesCredential);
        if (policy !== 'model') return;
        const label = this.doc.createElement('label');
        label.className = 'live-label';
        label.htmlFor = 'live-venue-pictures-model';
        label.textContent = 'Model';
        const input = this.doc.createElement('input');
        Object.assign(input, { id: 'live-venue-pictures-model', type: 'text', autocomplete: 'off', spellcheck: false, maxLength: 240, placeholder: OPENROUTER_DEFAULT_MODEL, value: this.picturesModel });
        input.setAttribute('autocapitalize', 'off');
        input.addEventListener('input', () => {
            this.picturesModel = input.value.trim();
            const shown = (this.picturesModel || OPENROUTER_DEFAULT_MODEL).split('/').at(-1);
            named.textContent = shown;
            named.setAttribute('aria-label', `Who makes the pictures: ${shown}`);
        });
        input.addEventListener('change', () => this.host.onSettingChange?.('livePicturesModel', this.picturesModel));
        const note = this.doc.createElement('p');
        note.className = 'live-venue__note';
        note.textContent = 'Draws the figures and moving scenes the answer asks for, on the same OpenRouter account.';
        this.picturesCredential.append(label, input, note);
    }

    /** The voice's credential: a typed ElevenLabs key, held in the host's memory only, when that voice is chosen. */
    renderVoiceCredential() {
        if (!this.voiceCredential) return;
        this.voiceCredential.replaceChildren();
        // Under the chosen voice, inline.
        this.voiceCredential.closest('.live-venue__panel')?.querySelector('input[name="live-venue-voice"]:checked')?.closest('label')?.after(this.voiceCredential);
        if (this.host.voiceChoice !== 'elevenlabs') return;
        const label = this.doc.createElement('label');
        label.className = 'live-label';
        label.htmlFor = 'live-venue-voice-key';
        label.textContent = 'Your ElevenLabs key';
        const key = this.doc.createElement('input');
        Object.assign(key, { id: 'live-venue-voice-key', type: 'password', autocomplete: 'off', spellcheck: false, maxLength: 300 });
        key.setAttribute('autocapitalize', 'off');
        this.voiceCredential.append(label, key);
    }

    /** The chosen provider's credential: a typed key, the OpenRouter connection, or nothing; and whose key it is. */
    renderCredential() {
        const entry = this.chosen();
        if (this.sealed) {
            this.privacyLine.textContent = `Nothing is asked of a model here: the reading was written before, and RISE checked it before showing it. ${voicePrivacy(this.host.voiceChoice)}`;
            this.renderChoices();
            return;
        }
        this.privacyLine.textContent = `${privacy(entry)} ${voicePrivacy(this.host.voiceChoice)}`;
        this.renderChoices();
        this.credential.replaceChildren();
        // Under the chosen provider, inline.
        this.credential.closest('.live-venue__panel')?.querySelector('input[name="live-venue-provider"]:checked')?.closest('label')?.after(this.credential);
        if (entry?.credential === 'key') {
            const label = this.doc.createElement('label');
            label.className = 'live-label';
            label.htmlFor = 'live-venue-key';
            label.textContent = `Your ${entry.keyName} key`;
            const key = this.doc.createElement('input');
            Object.assign(key, { id: 'live-venue-key', type: 'password', autocomplete: 'off', spellcheck: false, maxLength: 300 });
            key.setAttribute('autocapitalize', 'off');
            this.credential.append(label, key);
            if (entry.note) {
                const note = this.doc.createElement('p');
                note.className = 'live-venue__note';
                note.textContent = entry.note;
                this.credential.append(note);
            }
        } else if (entry?.credential === 'openrouter' && entry.adapter) {
            if (connectionState().kind === 'openrouter') {
                const line = this.doc.createElement('p');
                line.className = 'live-venue__connected';
                line.textContent = 'Connected to your OpenRouter account.';
                this.credential.append(line);
            } else {
                const connect = this.doc.createElement('button');
                connect.type = 'button';
                connect.dataset.venue = 'connect';
                connect.textContent = 'Connect OpenRouter';
                connect.addEventListener('click', () => { void this.connectOpenRouter(); });
                const note = this.doc.createElement('p');
                note.className = 'live-venue__note';
                note.textContent = 'Connecting goes to OpenRouter and brings you back here, connected, with your question; this tab keeps the question only until you are back.';
                this.credential.append(connect, note);
            }
            this.credential.append(...this.modelField());
        }
    }

    /** OpenRouter's model, by its id: any the reader's account reaches, kept as a setting; empty is the default. */
    modelField() {
        const label = this.doc.createElement('label');
        label.className = 'live-label';
        label.htmlFor = 'live-venue-model';
        label.textContent = 'Model';
        const input = this.doc.createElement('input');
        Object.assign(input, { id: 'live-venue-model', type: 'text', autocomplete: 'off', spellcheck: false, maxLength: 240, placeholder: OPENROUTER_DEFAULT_MODEL, value: this.openRouterModel });
        input.setAttribute('autocapitalize', 'off');
        input.addEventListener('input', () => {
            this.openRouterModel = input.value.trim();
            // An unchosen "pictures by" follows the model: a free one shows RISE's own visuals.
            this.renderPictures();
        });
        input.addEventListener('change', () => this.host.onSettingChange?.('liveOpenRouterModel', this.openRouterModel));
        const note = this.doc.createElement('p');
        note.className = 'live-venue__note';
        note.textContent = 'Any model your OpenRouter account reaches. Free ones end in :free, such as nvidia/nemotron-3.5-lightning:free.';
        return [label, input, note];
    }

    /**
     * The site's own sign-in (docs/USER-OWNED-AI.md): the key it mints stays in this tab's memory. It comes back to
     * this page, with the question typed so far, kept in this tab's session storage for the round trip only.
     */
    async connectOpenRouter() {
        try {
            const { beginOpenRouterConnect } = await import('../../core/openrouter-oauth.js');
            await beginOpenRouterConnect({ returnTo: LIVE_PATH, draft: this.field.value });
        } catch {
            this.errorLine.textContent = 'OpenRouter could not be connected in this browser.';
            this.errorLine.hidden = false;
        }
    }

    /**
     * Back from an OpenRouter sign-in started here: OpenRouter chosen, the question where it was, and the outcome said
     * here (the notice is taken, so Home does not say it again later).
     */
    async welcomeBack(returned) {
        if (this.providers.some(entry => entry.id === 'openrouter' && entry.adapter)) {
            this.dispatch({ type: 'choose', provider: 'openrouter' });
            for (const radio of this.form.querySelectorAll('input[name="live-venue-provider"]')) radio.checked = radio.value === 'openrouter';
            this.renderCredential();
        }
        if (returned.draft) this.field.value = returned.draft;
        let code = null;
        try {
            const { finishOpenRouterReturn, outcomeMessage } = await import('../../core/openrouter-oauth.js');
            code = await finishOpenRouterReturn(returned);
            takeConnectionNotice();
            if (this.destroyed) return;
            this.heardLine.textContent = code === 'CONNECTED' ? 'OpenRouter connected. What you ask here is billed to your OpenRouter account.' : outcomeMessage(code);
        } catch {
            if (!this.destroyed) this.heardLine.textContent = 'OpenRouter could not be connected in this browser.';
        }
    }

    // ─── asking ────────────────────────────────────────────────────────

    /** The reader asked, by Enter or the Ask button: inside their press, so the voice and the sound may begin. */
    ask(words) {
        if (this.destroyed) return;
        this.typing = false;
        this.host.unlockSpeech();
        this.host.unlockAudio();
        const keyField = this.credential?.querySelector('#live-venue-key');
        if (keyField) {
            const typed = keyField.value.trim();
            if (typed) this.host.key = typed;
            // Out of the page as soon as it is in memory: the field is not where it is kept.
            keyField.value = '';
        }
        const voiceKeyField = this.voiceCredential?.querySelector('#live-venue-voice-key');
        if (voiceKeyField) {
            const typed = voiceKeyField.value.trim();
            if (typed) this.host.voiceKey = typed;
            voiceKeyField.value = '';
        }
        const runtime = this.host.runtime;
        if (this.state.phase === 'reading' && runtime) {
            const { state } = runtime.snapshot().interjection;
            // Asked while it plays (Enter on words that came without a keystroke): an interjection all the same.
            if (state === 'none' && runtime.status === 'live') this.beginInterjection(runtime);
            const now = runtime.snapshot().interjection.state;
            if (now === 'held') {
                if (!this.showChosen(runtime, words)) void this.interject(runtime, words);
                return;
            }
            if (now !== 'none') {
                this.say('RISE is answering; ask again once it has.');
                return;
            }
            // A reading that takes no interjection is held first, as Pause holds it, and the question reads anew.
            if (runtime.status === 'live') {
                try { runtime.hold(); } catch { /* it is no longer live */ }
            }
        }
        this.dispatch({
            type: 'ask', question: words, connected: connectionState().kind === 'openrouter', hasKey: this.host.key !== '',
            voice: this.host.voiceChoice, hasVoiceKey: this.host.voiceKey !== ''
        });
        if (this.state.phase !== 'asking') return;
        this.failedAsk = false;
        if (this.bar) this.bar.elements.question.value = '';
        void this.begin(this.state.turns.at(-1).question, this.state.turns.length - 1);
    }

    /**
     * The reader begins to speak into a playing reading: it holds at once. A reading that takes no interjection (its
     * last words already all shown) is held as Pause holds it. Whether it was held for an interjection is returned.
     */
    beginInterjection(runtime) {
        try {
            runtime.beginInterjection();
            return true;
        } catch {
            try { runtime.hold(); } catch { /* it is no longer live */ }
            return false;
        }
    }

    /**
     * Words that only name one of RISE's own visuals (catalog-words.js, docs/plans/LIVE-CURRENT.md §25): shown at once
     * by the runtime, the reading taken up again, with no request and nothing counted; the bar says what is shown until
     * the room's frame has opened onto it (frameStep), and a short beat more; with no frames to follow, a short beat
     * after the switch. Whether they were: anything else, or what the reading cannot show, is asked of the model as before.
     */
    showChosen(runtime, words) {
        const chosen = recogniseVisual(words, { running: runtime.visualEngine?.() ?? null });
        if (!chosen) return false;
        let shown = false;
        try { shown = runtime.chooseVisual(chosen) === true; } catch { /* it is no longer held */ }
        if (!shown) return false;
        if (this.bar) this.bar.elements.question.value = '';
        this.typing = false;
        this.chosenNote = catalogNote(chosen);
        const win = this.doc.defaultView;
        win.clearTimeout(this.chosenTimer);
        this.chosenWait = null;
        if (this.framing) this.chosenWait = { engine: chosen.engine, until: null };
        else this.chosenTimer = win.setTimeout(() => this.letChosenGo(), CHOSEN_BEAT_MS);
        this.paint();
        return true;
    }

    letChosenGo() {
        this.chosenWait = null;
        this.chosenNote = null;
        this.paint();
    }

    /** The reader's words, asked inside the reading, with what they did in it since RISE last spoke. */
    async interject(runtime, words) {
        const question = String(words ?? '').trim();
        if (!question) {
            this.say('Ask something first.');
            return;
        }
        if (this.bar) this.bar.elements.question.value = '';
        const perception = interjectionPerception(runtime.journal(), runtime.passages(), question);
        // The question the reading answers goes with what was said before it; the reading itself goes as the reading.
        const turn = this.reading?.turn ?? this.state.turns.length - 1;
        const earlier = earlierFor([...this.turns().slice(0, turn), { question: this.state.turns[turn]?.question ?? '' }, { question }]);
        try {
            await runtime.interject(question, { ...(perception ? { perception } : {}), ...(earlier ? { earlier } : {}) });
        } catch { /* the reading has moved on; it plays as it was */ }
    }

    /** The reading that was on screen is let go: its stage, its runtime, and its journal kept for the room. */
    async letGo() {
        const reading = this.reading;
        this.reading = null;
        this.stopFollowing?.();
        this.stopFollowing = null;
        this.stage?.destroy();
        this.stage = null;
        if (this.host.controls === reading?.stage) this.host.controls = null;
        if (this.host.runtime === reading?.runtime) this.host.runtime = null;
        if (!reading) return;
        const { runtime } = reading;
        this.readings[reading.turn] = {
            journal: runtime.journal?.() ?? [],
            // The reading's passages in order as it was read (answers to interjections among them), so the reader's
            // moves can name them (perception.js), and what RISE said and showed in it can be remembered (earlierFor).
            passages: (runtime.passages?.() ?? []).map(({ segmentId, key, text, spoken, scene }) => ({
                segmentId, key: key ?? segmentId, text: text ?? '', spoken: spoken !== false,
                ...(typeof scene === 'string' ? { scene } : {})
            })),
            // Where the reading stood when let go: what was said before a cut ends there.
            reached: runtime.snapshot?.()?.position?.segmentIndex ?? null
        };
        await runtime.stop();
    }

    /**
     * One question, read in this room: the reading before it is let go, and a new runtime is built on the room's
     * adapter (the host's buildAdapter asks adapterFor). What the reader did in the reading before goes up with the
     * question, and only with it (perception, the design's §4): rebuilt from that reading's journal, never on a timer.
     */
    async begin(question, turn) {
        const host = this.host;
        await this.letGo();
        this.usage = emptyUsage();
        this.chosenNote = null;
        this.chosenWait = null;
        try {
            const runtime = await host.buildRuntime();
            if (this.destroyed) {
                await runtime.stop();
                return;
            }
            host.runtime = runtime;
            const stage = host.venueStage(runtime, {
                room: this.room, onPlayAgain: () => this.playAgain(runtime),
                face: { skins: FACE_SKINS, skin: this.faceSkin, choose: name => this.chooseFace(name) }
            });
            host.controls = stage;
            this.stage = stage;
            this.reading = { runtime, stage, turn };
            // The field the question was asked in goes, or would take every key as words: the stage takes the focus, so
            // its keys (Space, R, F, the arrows, the pace) work and a screen reader is in the reading. Focus the reader
            // put anywhere else is left where it is.
            const active = this.doc.activeElement;
            if (!active || active === this.doc.body || this.form?.contains(active) || active.closest?.('.live-again')) {
                stage.element.focus({ preventScroll: true });
            }
            // A sealed room has nothing to ask again: only the way back to its page.
            if (this.sealed) this.ensureLeave();
            else this.ensureBar();
            this.stopFollowing = runtime.subscribe(view => this.dispatch({ type: 'status', status: view.status }));
            const perception = perceptionFor(this.turns().slice(0, turn + 1));
            const earlier = earlierFor(this.turns().slice(0, turn + 1));
            // What went up with this question, for the host's measurement page (?measure=1) to read.
            this.sent = perception;
            this.sentEarlier = earlier?.length ?? 0;
            const sending = { ...(perception ? { perception } : {}), ...(earlier ? { earlier } : {}) };
            await (perception || earlier ? runtime.start(question, sending) : runtime.start(question));
            if (this.destroyed || this.reading?.runtime !== runtime) return;
            this.dispatch({ type: 'opened' });
            this.dispatch({ type: 'status', status: runtime.status });
        } catch (error) {
            if (this.destroyed) return;
            await this.letGo().catch(() => {});
            // A key that was refused is no use to keep.
            if (error?.code === 'KEY_REFUSED') host.forgetKey();
            this.failedAsk = true;
            this.dispatch({ type: 'failed', message: `Could not start: ${String(error?.message ?? 'unknown error').slice(0, 200)}` });
        }
    }

    /** The stage's Play again: the ended reading from its first passage, on the same runtime; nothing is asked. */
    playAgain(runtime) {
        this.host.unlockSpeech();
        this.host.unlockAudio();
        const first = runtime.passages?.()[0];
        if (!first) return;
        try { runtime.seek({ segmentId: first.segmentId }); } catch { /* the reading stays where it ended */ }
    }

    /** The reader leaves the room: back to the entry, with nothing carried and the key forgotten; a sealed room, back to its page. */
    async leave() {
        if (this.destroyed) return;
        if (this.sealed) {
            this.leaveButton?.remove();
            this.leaveButton = null;
            this.dispatch({ type: 'leave' });
            await this.letGo();
            await this.host.leaveSealed();
            return;
        }
        this.listener?.cancel();
        this.bar?.remove();
        this.bar = null;
        this.typing = false;
        this.dispatch({ type: 'leave' });
        await this.letGo();
        this.room = {};
        this.adapter = null;
        this.picturesAdapter = null;
        this.readings = [];
        this.host.paintEmbedTheme();
        await this.host.stop();
        if (this.destroyed) return;
        this.render();
        this.field.focus({ preventScroll: true });
    }

    // ─── the bar over the reading ──────────────────────────────────────

    /** A sealed room's one control over the reading: back to the page it was opened from. */
    ensureLeave() {
        if (this.leaveButton) return;
        const button = this.doc.createElement('button');
        button.type = 'button';
        button.className = 'live-leave';
        button.innerHTML = `<span aria-hidden="true">←</span> Back to the digest`;
        button.addEventListener('click', () => { void this.leave(); });
        this.doc.body.append(button);
        this.leaveButton = button;
    }

    /** The bar to ask again: open while the reading has ended or is held, only the microphone while it plays. */
    ensureBar() {
        if (this.bar) return;
        const bar = this.doc.createElement('form');
        bar.className = 'live-again';
        bar.noValidate = true;
        bar.setAttribute('aria-label', 'Ask again');
        bar.innerHTML = `
          <input id="live-again-question" name="question" type="text" maxlength="2000" autocomplete="off" enterkeyhint="go" aria-label="Ask again" placeholder="Ask again…">
          <button type="submit" class="live-again__ask">Ask</button>
          <button type="button" class="live-again__leave" aria-label="Leave this room">${LEAVE_GLYPH}</button>
          <p class="live-again__note" role="status" aria-live="polite"></p>`;
        bar.addEventListener('submit', event => {
            event.preventDefault();
            this.ask(bar.elements.question.value);
        });
        const field = bar.elements.question;
        // The first letter typed into a playing reading holds it: the reader is speaking into it.
        field.addEventListener('input', () => {
            const runtime = this.host.runtime;
            if (!field.value.trim() || this.state.phase !== 'reading' || runtime?.status !== 'live') return;
            if (runtime.snapshot().interjection.state === 'none') this.beginInterjection(runtime);
        });
        // After a reading has ended, the face listens while the reader types the next question.
        field.addEventListener('input', () => this.typed(field));
        // Escape takes an interjection back before it is answered; nothing else hears that Escape.
        field.addEventListener('keydown', event => {
            const state = this.host.runtime?.snapshot().interjection.state;
            if (event.key !== 'Escape' || (state !== 'held' && state !== 'asking')) return;
            event.preventDefault();
            event.stopPropagation();
            field.value = '';
            this.typing = false;
            try { this.host.runtime.cancelInterjection(); } catch { /* it was answered meanwhile */ }
        });
        bar.querySelector('.live-again__leave').addEventListener('click', () => { void this.leave(); });
        this.doc.body.append(bar);
        this.bar = bar;
        if (this.mic) this.addMic(bar, bar.querySelector('.live-again__ask'));
        this.paint();
    }

    paint() {
        this.paintFace();
        const { phase, held, error } = this.state;
        if (this.errorLine) {
            this.errorLine.textContent = phase === 'idle' ? error ?? '' : '';
            this.errorLine.hidden = !(phase === 'idle' && error);
        }
        if (this.startButton) this.startButton.disabled = phase === 'asking';
        if (!this.bar) return;
        const runtime = this.host.runtime;
        const interjection = phase === 'reading' ? runtime?.snapshot().interjection ?? null : null;
        const illustration = phase === 'reading' ? runtime?.snapshot().illustration ?? null : null;
        const interjecting = interjection?.state === 'held' || interjection?.state === 'asking';
        const open = phase === 'ended' || (phase === 'reading' && held);
        const playing = phase === 'reading' && !held;
        this.bar.dataset.open = String(open);
        this.bar.hidden = !open && !playing;
        const field = this.bar.elements.question;
        field.placeholder = interjecting ? 'Ask RISE…' : playing ? 'Ask while it reads…' : 'Ask again…';
        field.setAttribute('aria-label', interjecting || playing ? 'Ask RISE while it reads' : 'Ask again');
        // A failed reading is said by the stage; the bar says only what it refused, and how an interjection went.
        const note = this.bar.querySelector('.live-again__note');
        if (interjection?.state === 'asking') note.textContent = 'Asking RISE…';
        else if (interjection?.state === 'none' && interjection.failed) note.textContent = 'RISE could not answer that just now; the reading goes on.';
        // A picture the illustrator could not draw admissibly (docs/plans/LIVE-CURRENT.md §19): one line, and the reading goes on.
        else if (illustration?.failed) note.textContent = 'RISE could not draw that picture; the reading goes on.';
        else if (interjection?.state !== 'answering') note.textContent = runtime?.status === 'failed' ? '' : this.chosenNote ?? error ?? '';
    }

    // ─── the face ──────────────────────────────────────────────────────

    /** The face's element: the still eye at once, the engine's canvas over it once loaded. Decorative, so hidden from assistive technology. */
    makeFace() {
        const face = this.doc.createElement('div');
        face.className = 'live-face';
        face.setAttribute('aria-hidden', 'true');
        Object.assign(face.dataset, { faceState: 'arrival', faceSkin: this.faceSkin, faceDrawn: 'false' });
        face.style.setProperty('--face-dark', faceDark(this.faceSkin));
        face.innerHTML = `<div class="live-face__disc">${faceStill(this.faceSkin)}</div>`;
        return face;
    }

    /** Whether the face holds still: the device's reduced motion, or the app's own (and photosensitivity) setting. */
    faceHoldsStill() {
        const root = this.doc.documentElement.classList;
        return this.host.caps?.reducedMotion === true || root.contains('reduced-motion') || root.contains('photosensitivity-mode');
    }

    /**
     * The face's engine, loaded after the entry is on screen. Until it draws, and wherever it cannot run (no worker,
     * no offscreen canvas, a frame over budget), the still eye is the face.
     */
    async wakeFace() {
        let mountFace;
        try {
            ({ mountFace } = await import('./face-layer.js'));
        } catch {
            return;
        }
        if (this.destroyed || this.faceEngine) return;
        const state = this.face.dataset.faceState;
        this.faceStillness = this.faceHoldsStill();
        this.faceEngine = mountFace({
            host: this.face.querySelector('.live-face__disc'),
            skin: this.faceSkin,
            state,
            reducedMotion: this.faceStillness,
            onFirstFrame: () => { this.face.dataset.faceDrawn = 'true'; },
            onFailure: diagnostic => {
                this.face.dataset.faceDrawn = 'false';
                this.host.trace?.('[RISE face]', `${diagnostic.phase}: ${diagnostic.message}`);
            }
        });
        this.faceEngine.play();
    }

    /**
     * The engine is told reduced motion once, at its start: a change is a new engine, in the same skin and state, and
     * the room's frame follows it at once.
     */
    followStillness() {
        if (!this.faceEngine || this.faceHoldsStill() === this.faceStillness) return;
        this.faceEngine.destroy();
        this.faceEngine = null;
        this.face.dataset.faceDrawn = 'false';
        if (this.framing) Object.assign(this.framing, { director: createFrameDirector({ reduced: this.faceHoldsStill() }), key: undefined, cue: undefined });
        void this.wakeFace();
    }

    /** Words typed into a question field: the face listens while there are some. */
    typed(field) {
        this.typing = field.value.trim() !== '';
        this.paint();
    }

    /**
     * The face follows the room (venue-entry.js faceStateOf): placed in the entry before a question and in the room
     * after one, where it frames the reading's visuals, and cued with its state.
     */
    paintFace() {
        const { phase, held } = this.state;
        const view = phase === 'reading' ? this.host.runtime?.snapshot() ?? null : null;
        const state = faceStateOf({
            phase, held,
            interjection: view?.interjection?.state ?? 'none',
            wordsShown: Boolean(view?.main?.segmentId || view?.main?.speaking),
            typing: this.typing || this.micActive,
            failed: this.failedAsk
        });
        const slot = phase === 'idle' ? this.host.container.querySelector('.live-venue__face') : null;
        const parent = slot ?? this.doc.body;
        const disc = this.face.querySelector('.live-face__disc');
        const from = this.face.parentElement !== parent && this.face.isConnected ? disc.getBoundingClientRect() : null;
        this.face.classList.toggle('live-face--room', !slot);
        if (this.face.parentElement !== parent) parent.append(this.face);
        if (slot) this.stopFrames();
        else this.startFrames();
        // The eye travels from where it rested to its place in the room, rather than appearing there: one ground, one eye.
        if (from?.width && !slot && !this.faceHoldsStill() && typeof disc.animate === 'function') {
            const { big } = this.measureRoom();
            const dx = from.left + from.width / 2 - big.x;
            const dy = from.top + from.height / 2 - big.y;
            const k = from.width / big.s;
            disc.animate([
                { transformOrigin: `${big.x}px ${big.y}px`, transform: `translate(${dx}px, ${dy}px) scale(${k})` },
                { transformOrigin: `${big.x}px ${big.y}px`, transform: 'none' }
            ], { duration: 700, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
        }
        if (state === this.face.dataset.faceState) return;
        this.face.dataset.faceState = state;
        this.faceLog = [...this.faceLog, { state, at: performance.now() }].slice(-40);
        this.faceEngine?.cue(state);
    }

    // ─── the frames (docs/plans/LIVE-CURRENT.md §23) ──────────────────

    /** The Chamber on screen for the reading in the room, or null. */
    chamber() {
        const player = this.host.runtime?.playerFor?.();
        return player ? this.host.chamberPlaying?.(player) ?? null : null;
    }

    /**
     * The room's layout from its foot up (roomLayout): what is measured here is only the stage's instrument, the bar's
     * box and its note, and how much of the room an on-screen keyboard covers while the bar's field has focus (the
     * visual viewport's foot above the window's). LiveHost.css places the bar and the words from the root's
     * --live-bar-foot, --live-words-foot and --live-words-size.
     */
    measureRoom() {
        const win = this.doc.defaultView;
        const width = win.innerWidth;
        const height = win.innerHeight;
        const instrument = this.doc.querySelector('.rise-stage__bar')?.getBoundingClientRect();
        const box = this.bar && !this.bar.hidden ? this.bar.getBoundingClientRect() : null;
        const viewport = win.visualViewport;
        const typing = viewport && this.bar && this.doc.activeElement === this.bar.elements.question;
        const layout = roomLayout({
            width, height,
            instrumentTop: instrument?.height ? instrument.top : undefined,
            bar: box?.width ? { left: box.left, width: box.width, height: box.height } : null,
            keyboard: typing ? Math.max(0, height - viewport.height - viewport.offsetTop) : 0,
            note: this.bar?.querySelector('.live-again__note')?.getBoundingClientRect().height ?? 0
        });
        const root = this.doc.documentElement.style;
        for (const [name, value] of [['--live-bar-foot', layout.barFoot], ['--live-words-foot', layout.wordsFoot], ['--live-words-size', layout.wordsSize]]) {
            if (root.getPropertyValue(name) !== `${value}px`) root.setProperty(name, `${value}px`);
        }
        return layout;
    }

    /**
     * The room's frame, while the face is in the room: on each animation frame, the visual the Chamber has on screen
     * chooses the frame, the frame moves on the venue's clock (standing still while the reading is held), and one
     * geometry scales the Chamber's visual layers and is drawn by the face. The reader's pointer anywhere in the room
     * is where the eye looks.
     */
    startFrames() {
        // The host's window: where there are no animation frames there is nothing to animate, and nothing is framed.
        const view = this.host.env?.window ?? this.host.env;
        if (this.framing || this.destroyed || typeof view?.requestAnimationFrame !== 'function') return;
        const framing = { view, director: createFrameDirector({ reduced: this.faceHoldsStill() }), clock: 0, last: null, cue: undefined, key: undefined, raf: 0, geometry: null, fitUntil: 0 };
        this.framing = framing;
        const tick = now => {
            if (this.framing !== framing) return;
            framing.raf = view.requestAnimationFrame(tick);
            this.frameStep(now);
        };
        framing.raf = view.requestAnimationFrame(tick);
        framing.point = event => this.faceEngine?.point?.(event.clientX, event.clientY);
        this.doc.defaultView.addEventListener('pointermove', framing.point, { passive: true });
    }

    stopFrames() {
        const framing = this.framing;
        if (!framing) return;
        this.framing = null;
        framing.view.cancelAnimationFrame?.(framing.raf);
        this.gateSwaps(framing, null);
        this.doc.defaultView.removeEventListener('pointermove', framing.point);
        this.unframe();
        for (const name of ['--live-bar-foot', '--live-words-foot', '--live-words-size']) this.doc.documentElement.style.removeProperty(name);
        this.faceEngine?.place?.(null);
    }

    /**
     * Whether the visual on screen is fitted into the room's safe rectangle in the full frame: a picture with content
     * always; in a light room every visual, which keeps its own night there rather than laying it over the room. A
     * sourced image is the gallery's, which places it and its credit itself: scaled again, the credit would shrink.
     */
    hangs(cue) {
        return holdsContent(cue) || (faceLight(this.faceSkin) && frameOf(cue) === 'full' && visualOf(cue) !== 'sourced');
    }

    /** The Chamber's visual whole and unmoved, and the root unmarked: as the Reader and the card always have it. */
    unframe() {
        delete this.doc.documentElement.dataset.liveFrame;
        delete this.doc.documentElement.dataset.liveFit;
        delete this.face.dataset.faceAside;
        const field = this.doc.querySelector('#chamber-field');
        for (const name of ['--live-vx', '--live-vy', '--live-vk']) field?.style.removeProperty(name);
        for (const layer of field?.children ?? []) delete layer.dataset.liveScale;
        this.hang(null);
    }

    /**
     * A collection image hung in its own box, the safe rectangle (frames.js hungRect), in every room and whether or not
     * the face draws (LiveHost.css, "A collection image"); anything else, or `layout` null, takes it down.
     */
    hang(layout) {
        const root = this.doc.documentElement;
        const field = this.doc.querySelector('#chamber-field');
        const box = layout && hungPicture(this.framing?.cue) ? hungRect(layout) : null;
        if (box) root.dataset.liveHang = 'true';
        else delete root.dataset.liveHang;
        for (const [name, value] of [['--live-hx', box?.x], ['--live-hy', box?.y], ['--live-hw', box?.w], ['--live-hh', box?.h]]) {
            if (box) field?.style.setProperty(name, `${value}px`);
            else field?.style.removeProperty(name);
        }
    }

    /**
     * Every visual layer carries the scale the visual on screen is shown at once its frame is open (frames.js
     * restScale), declared as the visual changes and before its aperture opens, so a field is drawn at the size it is
     * shown (attractor.js, harmonograph-field.js). Fixed for each visual: the room's size moving under it (a keyboard
     * lifting the bar) changes no backing mid-transition.
     */
    declareScales(field, scale) {
        for (const layer of field.children) {
            if (layer.dataset.liveScale !== scale && !layer.matches('.atom-band, .movement-title')) layer.dataset.liveScale = scale;
        }
    }

    /**
     * The dock as the face is placed at it: following the bar's end when the bar moves (it opens wider as the reader
     * types, and lifts above a keyboard) on a critically damped spring in real time, held reading or not, so she moves
     * aside with it rather than jumping. At once on the first frame and under reduced motion.
     */
    followDock(framing, dock, dt) {
        const was = framing.dock;
        if (!was || dt <= 0 || this.faceHoldsStill()) {
            framing.dock = { x: dock.x, y: dock.y, vx: 0, vy: 0 };
            return dock;
        }
        const w = DOCK_RATE;
        const t = dt / 1000;
        const decay = Math.exp(-w * t);
        const axis = (p, v, to) => {
            const e = p - to;
            const lead = v + w * e;
            return [to + (e + lead * t) * decay, (v - w * lead * t) * decay];
        };
        const [x, vx] = axis(was.x, was.vx, dock.x);
        const [y, vy] = axis(was.y, was.vy, dock.y);
        const settled = Math.abs(x - dock.x) < 0.01 && Math.abs(y - dock.y) < 0.01 && Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01;
        framing.dock = settled ? { x: dock.x, y: dock.y, vx: 0, vy: 0 } : { x, y, vx, vy };
        return { ...dock, x: framing.dock.x, y: framing.dock.y };
    }

    frameStep(now) {
        const framing = this.framing;
        const { phase, held } = this.state;
        const step = framing.last === null ? 0 : Math.max(0, Math.min(now - framing.last, FRAME_STEP_MS));
        if (!(phase === 'reading' && held)) framing.clock += step;
        framing.last = now;
        // The visual on screen, never a timer: none while a question is asked or once the reading has ended.
        const chamber = phase === 'reading' ? this.chamber() : null;
        const cue = chamber?.visualCue?.() ?? null;
        let looked = false;
        if (cue !== framing.cue) {
            framing.cue = cue;
            // The same visual given again (a look laid over it) is not a change of visual.
            const key = cue ? JSON.stringify({ ...cue, colorTheme: undefined }) : null;
            looked = key === framing.key;
            if (key !== framing.key) {
                framing.key = key;
                // The outgoing figure or scene is still fading out; it stays fitted until the crossfade has run.
                if (this.hangs(framing.cue)) framing.fitUntil = Infinity;
                else if (framing.fitUntil === Infinity) framing.fitUntil = framing.clock + CROSSFADE_MS;
                framing.director.see(frameOf(cue), framing.clock);
                framing.scale = undefined;
            }
        }
        const { frame, a, cut, lid, close, carry } = framing.director.at(framing.clock);
        // A catalog word's note: kept until the visual it named is on screen and the room is at rest on it, then a beat.
        const wait = this.chosenWait;
        if (wait?.until === null && (collectionEngine(framing.cue) ?? visualOf(framing.cue)) === wait.engine && framing.director.settled(framing.clock)) wait.until = framing.clock + CHOSEN_BEAT_MS;
        else if (wait && wait.until !== null && framing.clock >= wait.until) this.letChosenGo();
        const measured = this.measureRoom();
        const layout = { ...measured, dock: this.followDock(framing, measured.dock, step) };
        // A face that is not drawing frames nothing: a visual is the room's, full-bleed, and the still eye steps aside;
        // with none, the still eye is the room, the words at its foot.
        if (this.face.dataset.faceDrawn !== 'true') {
            framing.geometry = null;
            this.gateSwaps(framing, null);
            this.unframe();
            this.hang(layout);
            if (frameOf(framing.cue)) this.face.dataset.faceAside = 'true';
            else this.doc.documentElement.dataset.liveFrame = 'none';
            return;
        }
        const geometry = frameGeometry({ frame, a, cut, lid, close, carry, layout, content: this.hangs(framing.cue) || framing.clock < framing.fitUntil });
        framing.geometry = geometry;
        const move = visualTransform(geometry, layout);
        this.doc.documentElement.dataset.liveFrame = frame;
        if (geometry.fit) this.doc.documentElement.dataset.liveFit = 'true';
        else delete this.doc.documentElement.dataset.liveFit;
        const field = this.doc.querySelector('#chamber-field');
        field?.style.setProperty('--live-vx', `${move.x}px`);
        field?.style.setProperty('--live-vy', `${move.y}px`);
        field?.style.setProperty('--live-vk', String(move.k));
        this.hang(layout);
        framing.scale ??= String(Math.round(restScale(frameOf(framing.cue), layout) * 1e4) / 1e4);
        if (field) this.declareScales(field, framing.scale);
        delete this.face.dataset.faceAside;
        this.faceEngine?.place?.(geometry, now);
        this.gateSwaps(framing, chamber);
        // The change is made under the shut eye; a look laid over the same visual keeps the Chamber's own crossfade.
        if (framing.gated && looked) framing.gated.releaseVisualSwap?.({ shut: false });
        else if (framing.gated && !((geometry.aperture?.hole ?? 0) > 0 || geometry.wipe)) framing.gated.releaseVisualSwap?.({ shut: true });
    }

    /**
     * While the face draws the room, the Chamber on screen holds each change of visual until the venue says its eye is
     * shut over the old one (Chamber.setVisualSwapAtShut), so no crossfade shows round a blink. Under reduced motion,
     * with the face not drawing, or the room left, the Chamber is let go of and changes as it always has.
     */
    gateSwaps(framing, chamber) {
        const wanted = chamber && !this.faceHoldsStill() ? chamber : null;
        if (framing.gated === wanted) return;
        framing.gated?.setVisualSwapAtShut?.(false);
        wanted?.setVisualSwapAtShut?.(true);
        framing.gated = wanted;
    }

    /** The reader chose a face in Settings: kept as a setting, worn at once. The model never chooses it. */
    chooseFace(name) {
        if (!FACE_SKINS.includes(name) || name === this.faceSkin) return;
        this.faceSkin = name;
        this.host.onSettingChange?.('liveFace', name);
        this.face.dataset.faceSkin = name;
        this.face.style.setProperty('--face-dark', faceDark(name));
        this.paintSkin();
        this.face.querySelector('.live-face__still')?.remove();
        this.face.querySelector('.live-face__disc').insertAdjacentHTML('afterbegin', faceStill(name));
        this.faceEngine?.setSkin(name);
    }

    /** ?measure=1: what the face did and when, its frame times and brightness, and a blink on demand. */
    measureFace() {
        this.host.env.__riseFace = Object.freeze({
            state: () => this.face.dataset.faceState,
            log: () => this.faceLog.map(entry => ({ ...entry })),
            drawn: () => this.face.dataset.faceDrawn === 'true',
            frames: () => this.faceEngine?.frameTimes() ?? [],
            lumas: () => this.faceEngine?.lumas() ?? [],
            frozen: () => this.faceEngine?.frozen() ?? false,
            blink: () => this.faceEngine?.cue('blink'),
            // The room's frame (§23): the geometry the face drew and the visual was scaled by in the last animation frame.
            frame: () => (this.framing?.geometry ? JSON.parse(JSON.stringify(this.framing.geometry)) : null)
        });
    }

    // ─── the microphone ───────────────────────────────────────────────

    useMic(mic) {
        this.mic = mic;
        this.listener = mic.createListener({
            onInterim: words => this.say(`Hearing: “${words.slice(0, 120)}”`),
            onFinal: words => this.heard(words),
            onState: state => {
                const active = state === 'starting' || state === 'listening';
                for (const button of this.doc.querySelectorAll('[data-venue="listen"]')) button.setAttribute('aria-pressed', String(active));
                this.micActive = active;
                this.paint();
                this.say(state === 'idle' ? '' : mic.describe(state));
                // A microphone that would not listen gives the reading back.
                if (!active && state !== 'idle' && this.heldByMic) this.giveBack();
            }
        });
        this.addMic(this.form.querySelector('.live-venue__field'));
        this.showMicPrivacy();
        if (this.bar) this.addMic(this.bar, this.bar.querySelector('.live-again__ask'));
        this.paint();
    }

    addMic(parent, before = null) {
        if (!this.mic || parent.querySelector('[data-venue="listen"]')) return;
        const button = this.doc.createElement('button');
        button.type = 'button';
        button.className = 'live-venue__mic';
        button.dataset.venue = 'listen';
        button.setAttribute('aria-label', 'Speak your question');
        button.setAttribute('aria-pressed', 'false');
        button.innerHTML = MIC_GLYPH;
        button.addEventListener('click', () => this.listen());
        parent.insertBefore(button, before);
    }

    showMicPrivacy() {
        const line = this.host.container.querySelector('.live-venue__mic-privacy');
        if (!line || !this.mic) return;
        line.textContent = `${this.mic.privacyLead}. ${this.mic.privacy}`;
        line.hidden = false;
    }

    /** Where the microphone's sentences go: the entry's status line, or the bar's. */
    say(sentence) {
        const target = this.bar && this.state.phase !== 'idle' ? this.bar.querySelector('.live-again__note') : this.heardLine;
        if (target) target.textContent = sentence;
    }

    /**
     * Press to talk: a playing reading is held first, so the voice does not talk over the reader; what they say is
     * then an interjection, asked inside the reading with Enter.
     */
    listen() {
        if (this.listener.listening) {
            this.listener.stop();
            return;
        }
        const runtime = this.host.runtime;
        this.heldByMic = false;
        if (this.state.phase === 'reading' && runtime?.status === 'live') {
            this.beginInterjection(runtime);
            this.heldByMic = runtime.status === 'interrupted';
        }
        this.listener.start();
    }

    giveBack() {
        this.heldByMic = false;
        const runtime = this.host.runtime;
        if (runtime?.status === 'interrupted') runtime.resume();
    }

    /**
     * What the reader said. During a reading, "carry on" and its kin take the reading up again and "wait" keeps it
     * held; anything else is put in the bar's field, the reading held, for the reader to ask with Enter. Before a
     * reading, the words are put in the question field. Nothing heard is asked by itself.
     */
    heard(words) {
        const said = this.mic.interpret(words);
        const held = this.heldByMic;
        this.heldByMic = false;
        this.say('');
        if (this.state.phase === 'reading' && this.host.runtime) {
            const runtime = this.host.runtime;
            // What the reader said to the reading is theirs to send with their next words (perception).
            if (said.heard && said.intent !== 'none') runtime.noteSaid?.(said.heard);
            if (said.intent === 'none') {
                if (held && runtime.status === 'interrupted') runtime.resume();
                return;
            }
            if (said.intent === 'resume' || said.intent === 'surface') {
                if (runtime.status === 'interrupted') runtime.resume();
                return;
            }
            if (said.intent === 'hold') return;
        }
        if (!said.heard) return;
        this.dispatch({ type: 'heard', text: said.heard });
        const field = this.bar && this.state.phase !== 'idle' ? this.bar.elements.question : this.field;
        field.value = this.state.question;
        field.focus({ preventScroll: true });
    }

    destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.stopConnection();
        this.doc.defaultView.clearTimeout(this.chosenTimer);
        this.listener?.destroy();
        this.stopFollowing?.();
        this.stopFollowing = null;
        this.bar?.remove();
        this.bar = null;
        this.leaveButton?.remove();
        this.leaveButton = null;
        this.stopFrames();
        this.stillWatch?.disconnect();
        this.faceEngine?.destroy();
        this.faceEngine = null;
        this.face.remove();
        for (const name of Object.keys(facePalette(this.faceSkin))) this.doc.documentElement.style.removeProperty(name);
        delete this.doc.documentElement.dataset.liveRoom;
        if (this.host.env?.__riseFace) this.host.env.__riseFace = undefined;
        this.host.paintEmbedTheme();
    }
}
