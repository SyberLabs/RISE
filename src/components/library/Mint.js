import { escapeHtml } from '../../core/sanitize.js';
import './Mint.css';

const ARROW = '<svg class="mint-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg>';
const SPINNER = '<svg class="mint-icon mint-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke-opacity=".25"></circle><path d="M21 12a9 9 0 0 0-9-9"></path></svg>';

/**
 * The door a minted sequence opens onto.
 *
 * A URL RESOLVES TO A THRESHOLD, NEVER TO A READING. That is the rule the
 * Keystone paths already follow, and it is not politeness — a reading that
 * begins from a cold address bar begins with no user activation, so the
 * browser refuses the audio and the first phrase is silent. Every safety
 * notice would be stepped over on the same path. The button below is the
 * gesture the whole audio lifecycle is waiting for.
 *
 * It holds no program. Loading one means fetching a file, parsing it at the
 * import gate and resolving the works it names, and none of that should
 * happen because someone glanced at a card — it happens when they decide
 * to read.
 */
export class Mint {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => {});
    this.onOpen = options.onOpen || (() => {});
    this.entry = options.entry || null;
    this.busy = false;
    this._events = new AbortController();
    this.render();
    this.attachEvents();
  }

  render() {
    const entry = this.entry;
    if (!entry) {
      // A slug nobody minted. Said plainly, with the way out — a printed
      // code outlives the sequence it names, and a dead end is the one
      // thing a card cannot recover from.
      this.container.innerHTML = `
        <main class="mint">
          <p class="mint-eyebrow"><span class="mint-dot" aria-hidden="true"></span>RISE / Not found</p>
          <h1 class="mint-title">This sequence is not one RISE has minted</h1>
          <p class="mint-summary">The code may be older than the reading it names.</p>
          <div class="mint-actions">
            <button type="button" class="mint-open" data-action="portal"><span class="mint-label">Go to RISE</span>${ARROW}</button>
          </div>
        </main>`;
      return;
    }
    this.container.innerHTML = `
      <main class="mint">
        <p class="mint-eyebrow"><span class="mint-dot" aria-hidden="true"></span>RISE / Minted sequence</p>
        <h1 class="mint-title">${escapeHtml(entry.title)}</h1>
        <p class="mint-summary">${escapeHtml(entry.summary || '')}</p>
        <div class="mint-actions">
          <button type="button" class="mint-open" data-action="open"><span class="mint-label">Begin</span>${ARROW}</button>
          <button type="button" class="mint-elsewhere" data-action="portal">Go to RISE</button>
        </div>
      </main>`;
  }

  attachEvents() {
    this.container.addEventListener('click', event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'portal') this.onNavigate('portal');
      if (action === 'open') this.open();
    }, { signal: this._events.signal });
  }

  async open() {
    // Loading a score is asynchronous and the button stays on screen, so
    // without this a second tap starts a second launch against a surface
    // the first is about to replace.
    if (this.busy) return;
    this.busy = true;
    const button = this.container.querySelector('[data-action="open"]');
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.innerHTML = `<span class="mint-label">Opening…</span>${SPINNER}`;
    }
    try {
      await this.onOpen(this.entry.slug);
    } finally {
      // Only reached when the launch refused; a launch that took navigated
      // away from this view and destroy() has already run.
      this.busy = false;
      if (button?.isConnected) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.innerHTML = `<span class="mint-label">Begin</span>${ARROW}`;
      }
    }
  }

  update(data) {
    this.entry = data?.entry || null;
    this.busy = false;
    this.render();
  }

  activate() {}
  deactivate() {}

  destroy() {
    this._events.abort();
    this.container.innerHTML = '';
  }
}
