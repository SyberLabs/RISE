import { SHORT_SEQUENCES, shortSequenceSession } from '../content/short-sequences.js';
import { escapeHtml } from '../core/sanitize.js';
import './ShortSequences.css';

const LEGACY_STORAGE_KEY = 'rise-sequence-preview-v1';

export class ShortSequences {
  constructor(container, { onNavigate, onBeginSession } = {}) {
    this.container = container;
    this.onNavigate = onNavigate;
    this.onBeginSession = onBeginSession;
    this.selected = SHORT_SEQUENCES[0];
    this.sound = true;
    this.completed = false;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <main class="short-sequences" id="short-sequences-main">
        <header class="short-header">
          <a href="/" id="short-home" aria-label="Return to RISE home">✦ RISE</a>
          <span>SHORT SEQUENCES</span>
        </header>
        <section class="short-intro" aria-labelledby="short-title">
          <p class="short-eyebrow">A short experience with a purpose</p>
          <h1 id="short-title">Take a moment. Carry something out.</h1>
          <p>Choose a reading. As the words and visuals unfold, keep a line that matters to you. Pause or switch to Page whenever you want.</p>
        </section>
        <div class="short-layout">
          <div class="short-choices" role="group" aria-label="Choose a short sequence">
            ${SHORT_SEQUENCES.map((item, index) => `<button type="button" class="short-choice" data-sequence="${item.id}" aria-pressed="${index === 0}">
              <span class="short-choice-number">0${index + 1}</span>
              <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.promise)}</small></span>
              <span aria-hidden="true">↗</span>
            </button>`).join('')}
          </div>
          <section class="short-selected" aria-live="polite" aria-labelledby="short-selected-title">
            <p class="short-eyebrow">YOUR READING</p>
            <h2 id="short-selected-title"></h2>
            <p id="short-selected-promise"></p>
            <label class="short-sound"><input id="short-sound" type="checkbox" checked> Include sound</label>
            <button type="button" class="short-enter" id="short-enter">Enter the reading <span aria-hidden="true">→</span></button>
            <p class="short-note">Under one minute. Original RISE demonstration text. Nothing you write is saved or sent.</p>
          </section>
        </div>
        <section class="short-reflection" id="short-reflection" hidden aria-labelledby="short-reflection-title">
          <p class="short-eyebrow">AFTER THE READING</p>
          <h2 id="short-reflection-title">Carry one thing forward.</h2>
          <div class="short-kept" id="short-kept" hidden><span>THE LINE YOU KEPT</span><blockquote id="short-kept-text"></blockquote></div>
          <label id="short-prompt" for="short-answer"></label>
          <textarea id="short-answer" maxlength="240" rows="2" placeholder="I will…"></textarea>
          <button type="button" id="short-copy">Copy my next step</button>
          <p id="short-copy-status" role="status">Your words stay in this tab unless you copy them.</p>
        </section>
        <section class="short-legacy" id="short-legacy" hidden>
          <p>An earlier preview saved reading records on this device.</p>
          <button type="button" id="short-erase">Erase old preview records</button>
          <p id="short-erase-status" role="status"></p>
        </section>
      </main>`;
    this.container.querySelector('#short-home').addEventListener('click', event => {
      event.preventDefault();
      this.onNavigate('portal');
    });
    this.container.querySelectorAll('[data-sequence]').forEach(button => button.addEventListener('click', () => {
      this.selected = SHORT_SEQUENCES.find(item => item.id === button.dataset.sequence);
      this.completed = false;
      this.container.querySelector('#short-reflection').hidden = true;
      this.showSelection();
    }));
    this.container.querySelector('#short-sound').addEventListener('change', event => {
      this.sound = event.target.checked;
    });
    this.container.querySelector('#short-enter').addEventListener('click', () => {
      this.sound = this.container.querySelector('#short-sound').checked;
      this.onBeginSession(shortSequenceSession(this.selected, { sound: this.sound }));
    });
    this.container.querySelector('#short-copy').addEventListener('click', async () => {
      const answer = this.container.querySelector('#short-answer').value.trim();
      const status = this.container.querySelector('#short-copy-status');
      if (!answer) {
        status.textContent = 'Write a next step first.';
        this.container.querySelector('#short-answer').focus();
        return;
      }
      try {
        await navigator.clipboard.writeText(answer);
        status.textContent = 'Copied. Take your words wherever you keep your plans.';
      } catch {
        status.textContent = 'Copy was blocked. Select your words above to copy them.';
      }
    });
    this.container.querySelector('#short-erase').addEventListener('click', () => {
      try {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        this.container.querySelector('#short-legacy').hidden = true;
      } catch {
        this.container.querySelector('#short-erase-status').textContent = 'Clear this site’s storage in browser settings.';
      }
    });
    try {
      this.container.querySelector('#short-legacy').hidden = localStorage.getItem(LEGACY_STORAGE_KEY) === null;
    } catch { /* This experience works without browser storage. */ }
    this.showSelection();
  }

  showSelection() {
    this.container.querySelectorAll('[data-sequence]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.sequence === this.selected.id));
    });
    this.container.querySelector('#short-selected-title').textContent = this.selected.title;
    this.container.querySelector('#short-selected-promise').textContent = this.selected.promise;
    this.container.querySelector('#short-sound').checked = this.sound;
    this.container.querySelector('#short-prompt').textContent = this.selected.prompt;
  }

  update(data) {
    if (data?.sequenceId) {
      this.selected = SHORT_SEQUENCES.find(item => item.id === data.sequenceId) || this.selected;
      this.showSelection();
    }
    this.completed = data?.completed === true;
    this.container.querySelector('#short-reflection').hidden = !this.completed;
    if (this.completed) {
      const keptLine = typeof data?.keptLine === 'string' ? data.keptLine.trim() : '';
      this.container.querySelector('#short-kept').hidden = !keptLine;
      this.container.querySelector('#short-kept-text').textContent = keptLine;
      this.container.querySelector('#short-answer').value = '';
      this.container.querySelector('#short-copy-status').textContent = 'Your words stay in this tab unless you copy them.';
      requestAnimationFrame(() => this.container.querySelector('#short-reflection').scrollIntoView({ block: 'center' }));
    }
  }
}
