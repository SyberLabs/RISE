/**
 * /try/ — a pane of the Read room: the one-minute sample, its completion
 * screen, and the visitor's own text (/try/your-text/).
 *
 * The pane is a small state machine. `idle` shows the entry screen; Begin
 * moves to `preparing`; the reading opening moves to `playing` (the Chamber
 * shows; this pane is hidden); the Chamber hands back `complete` when the
 * reading ends, or `idle` when the reader leaves early (chamber-exit.js).
 * A failed preparation is `error`, which keeps the entry screen and offers
 * Retry and, when sound was on, Read silently.
 *
 * Playback starts only from Begin, which is the gesture that lets the
 * browser start audio.
 */
import {
  TRY_PUBLICATION_URL,
  TRY_SAMPLE,
  TRY_TEXT_MAX_CHARS,
  TRY_TEXT_PATH,
  trySampleSession,
  tryTextProblem,
  tryTextSession
} from '../../app/try-session.js';
import './Try.css';

const LIMIT = TRY_TEXT_MAX_CHARS.toLocaleString('en-US');
const FAILED = 'The reading could not be prepared.';

/** Whether the engine can make a sound now (engine.js `audible`, or the context's state). */
function audible(engine) {
  return typeof engine.audible === 'boolean' ? engine.audible : engine.context?.state === 'running';
}

export class Try {
  constructor(container, { data = {}, onBeginSession, onNavigate, ensureAudioEngine, getAudioEngine } = {}) {
    this.container = container;
    this.onBeginSession = onBeginSession;
    this.onNavigate = onNavigate;
    this.getAudioEngine = getAudioEngine;
    this.kind = data?.kind === 'text' ? 'text' : 'sample';
    this.stage = data?.stage === 'complete' ? 'complete' : 'idle';
    this.sound = true;
    this.text = '';
    this.error = null;
    this.errorHadSound = false;
    this.run = 0;
    this.destroyed = false;
    this.events = new AbortController();
    const options = { signal: this.events.signal };
    container.addEventListener('click', event => this.handleClick(event), options);
    container.addEventListener('submit', event => {
      event.preventDefault();
      void this.start();
    }, options);
    container.addEventListener('input', event => {
      if (event.target?.id !== 'try-text') return;
      this.text = event.target.value;
      this.sync();
    }, options);
    // Construct the audio context before Begin, so Begin can resume it inside
    // its own gesture (the same order VoiceDemo.js keeps).
    this.audioReady = Promise.resolve(ensureAudioEngine?.())
      .then(engine => engine?.init?.())
      .catch(() => null);
    this.render({ focus: false });
  }

  /** The router shows the pane again: a new address, or a reading that ended. */
  update(data = {}) {
    this.kind = data?.kind === 'text' ? 'text' : 'sample';
    this.stage = data?.stage === 'complete' ? 'complete' : 'idle';
    this.error = null;
    this.render();
  }

  handleClick(event) {
    const target = event.target?.closest?.('[data-action]');
    if (!target || !this.container.contains(target)) return;
    const action = target.dataset.action;
    if (action === 'sound') {
      this.sound = !this.sound;
      this.sync();
    } else if (action === 'begin' && this.kind === 'sample') {
      void this.start();
    } else if (action === 'retry') {
      void this.start();
    } else if (action === 'silent') {
      this.sound = false;
      void this.start();
    } else if (action === 'replay' || action === 'again') {
      void this.start();
    } else if (action === 'edit') {
      this.stage = 'idle';
      this.render();
    } else if (action === 'own-text') {
      // A real link for a new tab or a copied address; in place otherwise.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button > 0) return;
      event.preventDefault();
      if (this.onNavigate) void this.onNavigate('try', { kind: 'text' });
      else this.update({ kind: 'text' });
    }
  }

  async start() {
    if (this.stage === 'preparing' || this.destroyed) return;
    if (this.kind === 'text' && tryTextProblem(this.text)) return;
    const sound = this.sound;
    const run = ++this.run;
    const fromComplete = this.stage === 'complete';
    this.stage = 'preparing';
    this.error = null;
    if (fromComplete) this.render();
    else this.sync();
    try {
      if (sound) {
        // Spend the gesture on the clock before anything is awaited.
        const resumed = Promise.resolve(this.getAudioEngine?.()?.resume?.()).catch(() => {});
        await this.audioReady;
        await resumed;
        const engine = this.getAudioEngine?.();
        if (engine && !audible(engine)) await Promise.resolve(engine.resume?.()).catch(() => {});
        if (!engine?.context || !audible(engine)) throw new Error('Sound could not start in this browser.');
      }
      if (this.destroyed || run !== this.run) return;
      const config = this.kind === 'text'
        ? tryTextSession({ text: this.text, sound, run })
        : trySampleSession({ sound, run });
      const opened = await this.onBeginSession?.(config);
      if (this.destroyed || run !== this.run) return;
      if (!opened) throw new Error(config.origin.failure || FAILED);
      if (this.stage === 'preparing') this.stage = 'playing';
    } catch (error) {
      if (this.destroyed || run !== this.run) return;
      this.stage = 'error';
      this.error = error?.name === 'AbortError' ? FAILED : (error?.message || FAILED);
      this.errorHadSound = sound;
      this.render();
      this.container.querySelector('[data-action="retry"]')?.focus();
    }
  }

  render({ focus = true } = {}) {
    if (this.destroyed) return;
    this.container.innerHTML = this.stage === 'complete' ? this.completeMarkup() : this.entryMarkup();
    const text = this.container.querySelector('#try-text');
    if (text) text.value = this.text;
    this.sync();
    if (focus && this.stage !== 'error') this.container.querySelector('#try-heading')?.focus();
  }

  entryMarkup() {
    const sample = this.kind === 'sample';
    const begin = `<button class="try-primary" type="${sample ? 'button' : 'submit'}" data-action="begin">Begin reading</button>`;
    const sound = '<button class="try-sound" type="button" role="switch" data-action="sound">Sound <span data-sound-state></span></button>';
    const status = `<div class="try-status" data-status role="status" aria-live="polite"></div>
      <div class="try-recover" data-recover hidden>
        <button class="try-secondary" type="button" data-action="retry">Retry</button>
        <button class="try-secondary" type="button" data-action="silent" data-silent>Read silently</button>
      </div>`;
    if (sample) {
      return `<section class="try" aria-labelledby="try-heading">
        <h1 id="try-heading" tabindex="-1">${TRY_SAMPLE.title}</h1>
        <p class="try-meta">${TRY_SAMPLE.author} <span aria-hidden="true">·</span> translated by ${TRY_SAMPLE.translator}
          <span aria-hidden="true">·</span> <span data-duration>${TRY_SAMPLE.duration}</span></p>
        <p class="try-lede">RISE reads text with you — pacing, visuals and sound timed to the words.</p>
        <div class="try-controls">${begin}${sound}</div>
        ${status}
      </section>`;
    }
    return `<section class="try" aria-labelledby="try-heading">
      <h1 id="try-heading" tabindex="-1">Read your own text</h1>
      <p class="try-lede">Paste a short excerpt. RISE reads it in the same look as the sample.</p>
      <form class="try-form" novalidate>
        <label for="try-text">Your text <span class="try-hint">(up to ${LIMIT} characters)</span></label>
        <textarea id="try-text" rows="6" maxlength="${TRY_TEXT_MAX_CHARS}" spellcheck="false"
          aria-describedby="try-text-count try-text-privacy"></textarea>
        <p class="try-count" id="try-text-count" data-count></p>
        <p class="try-note" id="try-text-privacy">Your text is prepared and read in this browser. It is not uploaded.</p>
        <div class="try-controls">${begin}${sound}</div>
        ${status}
      </form>
    </section>`;
  }

  completeMarkup() {
    const publication = `<a class="try-secondary" href="${TRY_PUBLICATION_URL}" data-publication>Create a reading for your publication</a>`;
    if (this.kind === 'sample') {
      return `<section class="try try-complete" aria-labelledby="try-heading">
        <h1 id="try-heading" tabindex="-1">Now try your words.</h1>
        <p class="try-lede">Bring a short excerpt and choose how it reads.</p>
        <div class="try-actions">
          <a class="try-primary" href="${TRY_TEXT_PATH}" data-action="own-text">Read your own text</a>
          ${publication}
          <button class="try-quiet" type="button" data-action="replay">Replay sample</button>
        </div>
      </section>`;
    }
    return `<section class="try try-complete" aria-labelledby="try-heading">
      <h1 id="try-heading" tabindex="-1">That was your text in RISE.</h1>
      <p class="try-lede">Read it again, change the words, or bring RISE to your publication.</p>
      <div class="try-actions">
        <button class="try-primary" type="button" data-action="again">Read again</button>
        <button class="try-secondary" type="button" data-action="edit">Edit text</button>
        ${publication}
      </div>
    </section>`;
  }

  /** Bring the controls and the live region in line with the state, without rebuilding them. */
  sync() {
    const root = this.container;
    const preparing = this.stage === 'preparing';
    const toggle = root.querySelector('[data-action="sound"]');
    if (toggle) {
      toggle.setAttribute('aria-checked', String(this.sound));
      toggle.querySelector('[data-sound-state]').textContent = this.sound ? 'on' : 'off';
      toggle.disabled = preparing;
    }
    const begin = root.querySelector('[data-action="begin"]');
    if (begin) {
      begin.disabled = preparing || (this.kind === 'text' && tryTextProblem(this.text) !== null);
      begin.textContent = preparing ? 'Preparing…' : 'Begin reading';
    }
    for (const button of root.querySelectorAll('[data-action="replay"], [data-action="again"], [data-action="edit"]')) {
      button.disabled = preparing;
    }
    root.querySelector('.try')?.setAttribute('aria-busy', String(preparing));
    const count = root.querySelector('[data-count]');
    if (count) count.textContent = `${this.text.length.toLocaleString('en-US')} / ${LIMIT} characters`;
    const status = root.querySelector('[data-status]');
    if (status) {
      status.textContent = preparing ? 'Preparing the reading…' : this.stage === 'error' ? this.error : '';
      status.classList.toggle('is-error', this.stage === 'error');
    }
    const recover = root.querySelector('[data-recover]');
    if (recover) {
      recover.hidden = this.stage !== 'error';
      recover.querySelector('[data-silent]').hidden = !this.errorHadSound;
    }
  }

  activate() {}
  deactivate() {}

  destroy() {
    this.destroyed = true;
    this.run++;
    this.events.abort();
    this.container.innerHTML = '';
  }
}
