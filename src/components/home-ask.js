/**
 * Ask for a reading: Home's native dialog, opened from the Menu. Asking needs
 * the reader's own AI (their OpenRouter account, or Kev on their computer);
 * not connected, the dialog says so and offers both. Connected, it is a
 * labelled request with a microphone, and the account with Disconnect.
 *
 * A request goes through the one decision route every way in shares
 * (src/app/invocation.js). An admitted answer closes the dialog and goes to
 * `onAnswer(decision, intent)`; a failure is said in the dialog, or, if the
 * dialog closed while the request was in flight, through `onFailure`. What
 * was typed is kept while Home is open.
 */
import { attachJevDictation } from './jev-dictation.js';
import { connectionState, detectLocalKev, disconnect, isLocalRise, subscribeConnection, takeConnectionNotice } from '../core/ai-connection.js';
import { escapeHtml } from '../core/sanitize.js';

const MIC_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path></svg>';
const ASK_HELP = 'Only your request is sent, to your connected OpenRouter account or local Kev. Your reading and saved work stay here. Voice input may use your browser’s speech service.';
const ABOUT_CONNECTION = 'OpenRouter requests are billed to your account. The key stays in this tab’s memory and is forgotten when you disconnect, reload, or close the tab. It is never sent to SyberLabs. Browser extensions can read page memory; revoke keys in your OpenRouter settings.';
const LOCAL_RISE = 'https://github.com/SyberLabs/RISE/blob/main/docs/LOCAL-RISE.md';
const FAILED = 'Couldn’t interpret that here. Your request is kept.';
const CANCEL = '<button class="btn btn-ghost" type="button" data-home="ask-cancel">Cancel</button>';

/** An alert with its cause behind a closed "Details"; Home's and the dialog's. */
export const alertMarkup = className => `<div class="portal-alert ${className}" role="alert" hidden>
          <div class="portal-alert-body">
            <p class="portal-alert-title"></p>
            <details class="portal-alert-details">
              <summary>Details</summary>
              <p class="portal-alert-message"></p>
            </details>
          </div>
        </div>`;

/** Say `title` in the alert (an empty title hides it), the cause in its Details. */
export function showAlert(alert, title, details = '') {
  if (!alert) return;
  alert.hidden = !title;
  alert.querySelector('.portal-alert-title').textContent = title;
  const more = alert.querySelector('.portal-alert-details');
  more.open = false;
  more.hidden = !details;
  alert.querySelector('.portal-alert-message').textContent = details;
}

export class HomeAsk {
  /**
   * `parent` receives the dialog. `loadTools` resolves to the invocation
   * route and the admission check; `onBusy(true | false)` follows a request
   * in flight, so Home can hold its own controls meanwhile.
   */
  constructor(parent, { getAudioEngine = () => null, loadTools, onAnswer, onFailure, onBusy = () => {} }) {
    Object.assign(this, { getAudioEngine, loadTools, onAnswer, onFailure, onBusy });
    this.pending = false;
    this.draft = '';
    parent.insertAdjacentHTML('beforeend', `<dialog class="home-ask" aria-labelledby="home-ask-title">
      <form class="home-ask-form" id="home-form" novalidate>
        <div class="home-view"></div>
        <p class="home-ask-status" role="status" aria-live="polite"><span data-ask-status></span><span data-jev-dictation-status></span></p>
        ${alertMarkup('home-ask-alert')}
        <div class="portal-ai" id="portal-ai"></div>
      </form>
    </dialog>`);
    this.dialog = parent.lastElementChild;
    this.form = this.dialog.querySelector('form');
    this.renderConnection();
    this.attachEvents();
    this.stopConnection = subscribeConnection(() => this.renderConnection());
    if (isLocalRise()) void detectLocalKev();
  }

  get connected() {
    return connectionState().kind !== 'none';
  }

  open() {
    this.showError('');
    this.renderView();
    if (!this.dialog.open) this.dialog.showModal();
    this.focus(this.connected ? '#home-intent' : '[data-ai="connect"]');
    this.setStatus(this.connected ? 'Ask for a mood, a style, a text, or all three.' : '');
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }

  destroy() {
    this.close();
    this.stopDictation?.();
    this.stopConnection();
    this.dialog.remove();
  }

  /** The dialog's view for the connection, keeping what was typed. */
  renderView() {
    this.dialog.querySelector('.home-view').innerHTML = this.connected
      ? `<h2 class="home-ask-title" id="home-ask-title"><label for="home-intent">What would you like to read?</label></h2>
      <div class="home-field">
        <textarea class="input home-intent" id="home-intent" name="intent" rows="3" maxlength="240" aria-describedby="home-help"></textarea>
        <p class="home-help" id="home-help">${ASK_HELP}</p>
      </div>
      <div class="home-ask-actions"><button class="btn btn-primary" type="submit" data-home="ask">Ask</button>
        <button class="btn btn-ghost btn-icon" type="button" data-jev-dictate="icon" aria-label="Speak your request" aria-pressed="false">${MIC_ICON}</button>
        ${CANCEL}
      </div>`
      : `<h2 class="home-ask-title" id="home-ask-title">Asking needs your own AI.</h2>
      <p class="home-lede">Connect your OpenRouter account (billed to you) or run RISE on your computer with Kev. Another reading needs neither.</p>
      <div class="home-ask-actions">
        <button class="btn btn-primary" type="button" data-ai="connect">Connect OpenRouter</button>
        <a class="btn btn-secondary" href="${LOCAL_RISE}" target="_blank" rel="noopener noreferrer">Run RISE locally</a>
        ${CANCEL}
      </div>
      <details class="portal-ai-about"><summary>About your connection</summary><p class="home-help">${ABOUT_CONNECTION}</p></details>`;
    const field = this.field();
    if (field) field.value = this.draft;
    this.stopDictation?.();
    this.stopDictation = field ? attachJevDictation(this.form) : null;
    this.renderBusy();
  }

  /** What is connected. Not connected, the view's own words say what asking needs. */
  renderConnection() {
    const state = connectionState();
    const line = state.kind === 'openrouter'
      ? `${escapeHtml('Jev through your OpenRouter account, billed to your OpenRouter account.')} <button class="portal-link" type="button" data-ai="disconnect">Disconnect</button>`
      : state.kind === 'local' ? escapeHtml('Kev on this computer. No hosted inference bill.') : '';
    this.dialog.querySelector('.portal-ai').innerHTML = `<p class="portal-ai-line" id="portal-ai-status">${line}</p>
      <p class="portal-ai-notice" role="status" hidden></p>`;
    const notice = takeConnectionNotice();
    if (notice) this.showNotice(notice.message);
    // An open request becomes a field, or an explanation, as the connection changes.
    if (this.dialog.open) this.renderView();
    else this.renderBusy();
  }

  showNotice(message) {
    const node = this.dialog.querySelector('.portal-ai-notice');
    node.textContent = message;
    node.hidden = !message;
  }

  async connectOpenRouter() {
    try {
      const { beginOpenRouterConnect } = await import('../core/openrouter-oauth.js');
      await beginOpenRouterConnect();
    } catch {
      this.showNotice('OpenRouter could not be connected in this browser.');
    }
  }

  async submit() {
    const field = this.field();
    if (this.pending || !field) return;
    this.draft = field.value;
    const intent = field.value.trim();
    if (intent.length < 3 || intent.length > 240) {
      this.setStatus(intent ? 'Keep it under 240 characters.' : 'Add a few words: a mood, a style, a text, or all three.');
      field.focus();
      return;
    }
    this.showError('');
    this.getAudioEngine()?.playClick();
    this.setPending(true);
    this.setStatus('Interpreting your request. This usually takes a few seconds.');
    let decision;
    try {
      const tools = await this.loadTools();
      decision = await tools.requestComposedReading(intent, { admit: tools.validateJevRecommendation });
    } catch (error) {
      this.setPending(false);
      this.setStatus('');
      if (error?.code === 'NOT_CONNECTED') {
        this.showNotice('Connect OpenRouter or run RISE locally to ask for a specific reading. Another reading works without AI.');
      }
      if (this.dialog.open) {
        this.showError(FAILED, error?.message || '');
        this.focus('#home-intent');
      } else {
        this.onFailure(FAILED, error?.message || '');
      }
      return;
    }
    this.setPending(false);
    this.setStatus('');
    this.close();
    this.onAnswer(decision, intent);
  }

  setPending(pending) {
    this.pending = pending;
    this.renderBusy();
    this.onBusy(pending);
  }

  /** While a request is in flight every control holds, and Ask says it is busy. */
  renderBusy() {
    for (const control of this.dialog.querySelectorAll('[data-home], [data-ai]')) {
      control.disabled = this.pending;
      if (this.pending && control.dataset.home === 'ask') control.setAttribute('aria-busy', 'true');
      else control.removeAttribute('aria-busy');
    }
    const field = this.field();
    if (field) field.readOnly = this.pending;
  }

  attachEvents() {
    this.form.addEventListener('submit', event => {
      event.preventDefault();
      void this.submit();
    });
    this.form.addEventListener('click', event => {
      const control = event.target.closest('[data-home="ask-cancel"], [data-ai]');
      if (!control || control.disabled) return;
      if (control.dataset.home === 'ask-cancel') this.close();
      else if (control.dataset.ai === 'connect') void this.connectOpenRouter();
      else if (control.dataset.ai === 'disconnect') {
        disconnect();
        this.showNotice('Disconnected. RISE forgot the key.');
      }
    });
    this.form.addEventListener('input', event => {
      if (event.target.id === 'home-intent') this.draft = event.target.value;
    });
    this.form.addEventListener('keydown', event => {
      if (event.target.id === 'home-intent' && event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        this.form.requestSubmit();
      }
    });
    this.dialog.addEventListener('close', () => {
      this.stopDictation?.();
      this.stopDictation = null;
    });
    // A dialog cannot be dismissed while its request is in flight.
    this.dialog.addEventListener('cancel', event => {
      if (this.pending) event.preventDefault();
    });
  }

  field() {
    return this.dialog.querySelector('#home-intent');
  }

  focus(selector) {
    this.dialog.querySelector(selector)?.focus({ preventScroll: true });
  }

  setStatus(text) {
    this.dialog.querySelector('[data-ask-status]').textContent = text;
  }

  showError(title, details = '') {
    showAlert(this.dialog.querySelector('.home-ask-alert'), title, details);
  }
}
