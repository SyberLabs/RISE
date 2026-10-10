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
 *
 * The host (LiveHost.js) builds each runtime, the voice and the sound as it does for every reading; this owns the
 * entry state (venue-entry.js) and what the reader sees of it. A typed key is held in the host's memory (`host.key`)
 * and nowhere else: never in the state, the page, storage or a URL.
 */

import { connectionState, subscribeConnection } from '../../core/ai-connection.js';
import { initialVenue, interjectionPerception, perceptionFor, venueStep } from './venue-entry.js';

const MIC_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><rect x="9" y="3.5" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>';
const LEAVE_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>';

const SENT = 'What is sent is your question, and what you did while it played (play, pause, replay, pace, settings, words you spoke to it), sent only with your next words. A question asked while it reads also carries the reading so far. Nothing is stored; a reload forgets the key.';

/** Whose key, where it goes and what is sent, for a provider's credential (docs/USER-OWNED-AI.md). */
function privacy(entry) {
    if (entry?.credential === 'openrouter') return `Your OpenRouter key stays in this tab’s memory and goes only to OpenRouter, billed to your account. ${SENT}`;
    if (entry?.credential === 'key') return `Your ${entry.keyName} key stays in this page’s memory and goes only to ${entry.keyGoesTo}, billed to your key. ${SENT}`;
    return 'The demo answers from a script in this page: nothing you type leaves this browser, and no key is needed.';
}

export class LiveVenue {
    /**
     * @param {object} host the LiveHost presenting this page
     * @param {object} options
     * @param {readonly object[]} options.providers the registry
     */
    constructor(host, { providers }) {
        this.host = host;
        this.providers = providers;
        this.doc = host.container.ownerDocument;
        this.state = initialVenue();
        // The reader's Settings choices, from one reading's stage to the next.
        this.room = {};
        // The room's adapter, made at its first question; every question of the room is asked of it.
        this.adapter = null;
        // Each reading the room has let go, by the index of its question: its journal and its passages, for perception.
        this.readings = [];
        this.reading = null;
        this.stage = null;
        this.bar = null;
        this.stopFollowing = null;
        this.mic = null;
        this.listener = null;
        this.heldByMic = false;
        this.destroyed = false;
        this.render();
        // Connecting or disconnecting OpenRouter elsewhere in the tab is shown here at once.
        this.stopConnection = subscribeConnection(() => { if (this.chosen()?.credential === 'openrouter') this.renderCredential(); });
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

    /** The room's one adapter, made once from the chosen provider; the key is asked for at each request. */
    adapterFor({ clock }) {
        this.adapter ??= Promise.resolve(this.chosen().adapter({ clock, getKey: () => this.host.key }));
        return this.adapter;
    }

    // ─── the entry page ────────────────────────────────────────────────

    render() {
        const container = this.host.container;
        container.innerHTML = `
      <main class="live-host live-venue" aria-labelledby="live-venue-title">
        <h1 class="live-title" id="live-venue-title">RISE Live</h1>
        <p class="live-lede">Ask anything. The answer comes as a reading: said in RISE’s voice, shown as it is said, and yours to pause, replay and ask about again.</p>
        <form class="live-venue__ask" novalidate>
          <label class="live-label" for="live-venue-question">Your question</label>
          <div class="live-venue__field">
            <input id="live-venue-question" name="question" type="text" maxlength="2000" autocomplete="off" enterkeyhint="go">
          </div>
          <fieldset class="live-venue__providers">
            <legend class="live-label">Who answers</legend>
          </fieldset>
          <div class="live-venue__credential"></div>
          <div class="live-row"><button type="submit" class="live-start">Ask</button></div>
        </form>
        <p class="live-error" role="alert" hidden></p>
        <p class="live-venue__heard" role="status" aria-live="polite"></p>
        <p class="live-venue__privacy"></p>
        <details class="live-venue__mic-privacy" hidden><summary></summary><p></p></details>
      </main>`;
        const $ = selector => container.querySelector(selector);
        this.form = $('.live-venue__ask');
        this.field = $('#live-venue-question');
        this.errorLine = $('.live-error');
        this.heardLine = $('.live-venue__heard');
        this.privacyLine = $('.live-venue__privacy');
        this.credential = $('.live-venue__credential');
        this.startButton = $('.live-start');
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
        if (this.mic) this.addMic(this.form.querySelector('.live-venue__field'));
        this.showMicPrivacy();
        this.renderCredential();
        this.paint();
    }

    /** The chosen provider's credential: a typed key, the OpenRouter connection, or nothing; and whose key it is. */
    renderCredential() {
        const entry = this.chosen();
        this.privacyLine.textContent = privacy(entry);
        this.credential.replaceChildren();
        if (entry?.credential === 'key') {
            const label = this.doc.createElement('label');
            label.className = 'live-label';
            label.htmlFor = 'live-venue-key';
            label.textContent = `Your ${entry.keyName} key`;
            const key = this.doc.createElement('input');
            Object.assign(key, { id: 'live-venue-key', type: 'password', autocomplete: 'off', spellcheck: false, maxLength: 300 });
            key.setAttribute('autocapitalize', 'off');
            this.credential.append(label, key);
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
                note.textContent = 'Connecting goes to OpenRouter and brings you back to RISE’s Home, connected; then open Live again.';
                this.credential.append(connect, note);
            }
        }
    }

    /** The site's own sign-in (docs/USER-OWNED-AI.md): the key it mints stays in this tab's memory. */
    async connectOpenRouter() {
        try {
            const { beginOpenRouterConnect } = await import('../../core/openrouter-oauth.js');
            await beginOpenRouterConnect();
        } catch {
            this.errorLine.textContent = 'OpenRouter could not be connected in this browser.';
            this.errorLine.hidden = false;
        }
    }

    // ─── asking ────────────────────────────────────────────────────────

    /** The reader asked, by Enter or the Ask button: inside their press, so the voice and the sound may begin. */
    ask(words) {
        if (this.destroyed) return;
        this.host.unlockSpeech();
        this.host.unlockAudio();
        const keyField = this.credential?.querySelector('#live-venue-key');
        if (keyField) {
            const typed = keyField.value.trim();
            if (typed) this.host.key = typed;
            // Out of the page as soon as it is in memory: the field is not where it is kept.
            keyField.value = '';
        }
        const runtime = this.host.runtime;
        if (this.state.phase === 'reading' && runtime) {
            const { state } = runtime.snapshot().interjection;
            // Asked while it plays (Enter on words that came without a keystroke): an interjection all the same.
            if (state === 'none' && runtime.status === 'live') this.beginInterjection(runtime);
            const now = runtime.snapshot().interjection.state;
            if (now === 'held') {
                void this.interject(runtime, words);
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
        this.dispatch({ type: 'ask', question: words, connected: connectionState().kind === 'openrouter', hasKey: this.host.key !== '' });
        if (this.state.phase !== 'asking') return;
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

    /** The reader's words, asked inside the reading, with what they did in it since RISE last spoke. */
    async interject(runtime, words) {
        const question = String(words ?? '').trim();
        if (!question) {
            this.say('Ask something first.');
            return;
        }
        if (this.bar) this.bar.elements.question.value = '';
        const perception = interjectionPerception(runtime.journal(), runtime.passages(), question);
        try {
            await runtime.interject(question, perception ? { perception } : {});
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
            // moves can name them (perception.js).
            passages: (runtime.passages?.() ?? []).map(({ segmentId, text }) => ({ segmentId, text: text ?? '' }))
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
        try {
            const runtime = await host.buildRuntime();
            if (this.destroyed) {
                await runtime.stop();
                return;
            }
            host.runtime = runtime;
            const stage = host.venueStage(runtime, { room: this.room, onPlayAgain: () => this.playAgain(runtime) });
            host.controls = stage;
            this.stage = stage;
            this.reading = { runtime, stage, turn };
            this.ensureBar();
            this.stopFollowing = runtime.subscribe(view => this.dispatch({ type: 'status', status: view.status }));
            const perception = perceptionFor(this.turns().slice(0, turn + 1));
            await (perception ? runtime.start(question, { perception }) : runtime.start(question));
            if (this.destroyed || this.reading?.runtime !== runtime) return;
            this.dispatch({ type: 'opened' });
            this.dispatch({ type: 'status', status: runtime.status });
        } catch (error) {
            if (this.destroyed) return;
            await this.letGo().catch(() => {});
            // A key that was refused is no use to keep.
            if (error?.code === 'KEY_REFUSED') host.forgetKey();
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

    /** The reader leaves the room: back to the entry, with nothing carried and the key forgotten. */
    async leave() {
        if (this.destroyed) return;
        this.listener?.cancel();
        this.bar?.remove();
        this.bar = null;
        this.dispatch({ type: 'leave' });
        await this.letGo();
        this.room = {};
        this.adapter = null;
        this.readings = [];
        this.host.paintEmbedTheme();
        await this.host.stop();
        if (this.destroyed) return;
        this.render();
        this.field.focus({ preventScroll: true });
    }

    // ─── the bar over the reading ──────────────────────────────────────

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
        // Escape takes an interjection back before it is answered; nothing else hears that Escape.
        field.addEventListener('keydown', event => {
            const state = this.host.runtime?.snapshot().interjection.state;
            if (event.key !== 'Escape' || (state !== 'held' && state !== 'asking')) return;
            event.preventDefault();
            event.stopPropagation();
            field.value = '';
            try { this.host.runtime.cancelInterjection(); } catch { /* it was answered meanwhile */ }
        });
        bar.querySelector('.live-again__leave').addEventListener('click', () => { void this.leave(); });
        this.doc.body.append(bar);
        this.bar = bar;
        if (this.mic) this.addMic(bar, bar.querySelector('.live-again__ask'));
        this.paint();
    }

    paint() {
        const { phase, held, error } = this.state;
        if (this.errorLine) {
            this.errorLine.textContent = phase === 'idle' ? error ?? '' : '';
            this.errorLine.hidden = !(phase === 'idle' && error);
        }
        if (this.startButton) this.startButton.disabled = phase === 'asking';
        if (!this.bar) return;
        const runtime = this.host.runtime;
        const interjection = phase === 'reading' ? runtime?.snapshot().interjection ?? null : null;
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
        else if (interjection?.state !== 'answering') note.textContent = runtime?.status === 'failed' ? '' : error ?? '';
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
        const details = this.host.container.querySelector('.live-venue__mic-privacy');
        if (!details || !this.mic) return;
        details.querySelector('summary').textContent = this.mic.privacyLead;
        details.querySelector('p').textContent = this.mic.privacy;
        details.hidden = false;
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
        this.listener?.destroy();
        this.stopFollowing?.();
        this.stopFollowing = null;
        this.bar?.remove();
        this.bar = null;
        this.host.paintEmbedTheme();
    }
}
