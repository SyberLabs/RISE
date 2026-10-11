import { fetchPlusStatus } from '../app/plus.js';
import { fetchPlusOffer, startPlusCheckout, openPlusBilling, recoverPlus, restorePlus, confirmPlusPurchase } from '../app/plus-customer.js';
import { readPlusContinuation } from '../app/plus-continuation.js';
import { takePlusCallback } from '../app/plus-callback.js';
import './Plus.css';

/** Customer subscription controls. Free reading and staff accounts are independent. */
export class Plus {
  constructor(container, { redirect = url => window.location.assign(url) } = {}) {
    this.container = container;
    this.redirect = redirect;
    this.requestId = crypto.randomUUID();
    this.callback = takePlusCallback();
    this.destroyed = false;
    this.busy = false;
    this.active = true;
    this.onFocus = () => { if (this.active && !this.busy) void this.refresh(); };
    window.addEventListener('focus', this.onFocus);
    this.events = new AbortController();
    this.render();
    container.addEventListener('click', event => {
      if (event.target.closest('[data-checkout]')) void this.purchase();
      if (event.target.closest('[data-billing]')) void this.billing();
      if (event.target.closest('[data-retry]')) void this.confirm();
    }, { signal: this.events.signal });
    container.addEventListener('submit', event => {
      event.preventDefault();
      if (event.target.matches('[data-recovery]')) void this.recover();
    }, { signal: this.events.signal });
    this.ready = this.start();
  }
  $(selector) { return this.container.querySelector(selector); }
  render() {
    this.container.innerHTML = `<div class="plus-page">
      <header class="plus-nav"><a href="/" aria-label="RISE home">RISE <span>/ PLUS</span></a><a href="/try/">Try a reading <span aria-hidden="true">↗</span></a></header>
      <main class="plus-main" aria-labelledby="plus-title">
        <section class="plus-intro">
          <p class="plus-eyebrow">YOUR WORDS. ANOTHER WAY TO HEAR THEM.</p>
          <h1 id="plus-title">Give your reading<br><em>a voice.</em></h1>
          <p class="plus-lede">Bring a draft, a poem, or a passage you love. Plus adds an ElevenLabs voice to your own text, with words appearing in time with the narration.</p>
          <a class="plus-text-link" href="/try/">Try a free reading <span aria-hidden="true">↗</span></a>
          <p class="plus-caption">No account needed. Your own text stays free to read.</p>
        </section>
        <section class="plus-plan" aria-labelledby="plus-plan-title">
          <p class="plus-eyebrow">OPTIONAL VOICE SUBSCRIPTION</p>
          <h2 id="plus-plan-title">RISE Plus</h2>
          <p class="plus-price" data-price>Checking availability…</p>
          <p class="plus-included" data-offer></p>
          <ul class="plus-benefits"><li>Natural narration of your own text</li><li>Words follow the voice’s timing</li><li>Choose from the available premade voices</li></ul>
          <p class="plus-account-state" data-account role="status"></p>
          <button class="plus-primary" type="button" data-checkout hidden>Subscribe to Plus</button>
          <button class="plus-primary" type="button" data-billing hidden>Manage billing &amp; cancellation</button>
          <p class="plus-caption" data-renewal hidden>Renews monthly until canceled. Applicable tax is added at checkout. Manage cancellation and invoices here.</p>
          <a class="plus-free" data-voice href="/voice-demo" hidden>Read with your Plus voice →</a>
          <a class="plus-free" href="/try/your-text/">Keep reading free <span aria-hidden="true">→</span></a>
        </section>
        <div class="plus-message" data-message role="status" aria-live="polite"></div>
        <button class="plus-secondary" type="button" data-retry hidden>Retry confirmation</button>
        <section class="plus-details" aria-label="What changes with Plus">
          <div><p class="plus-eyebrow">ALWAYS FREE</p><h2>The reading stays yours.</h2><p>Paced text, visuals, sound, and your own material remain free. Plus adds a premium voice; it does not unlock the reader.</p></div>
          <div><p class="plus-eyebrow">KNOW YOUR ALLOWANCE</p><h2>Clear limits. No surprise top-ups.</h2><p>Up to 5,000 characters in the voice workspace. Replaying audio already stored in this browser uses no more allowance. A new voice, another device, or erased audio requires a new voicing. A daily limit of 25,000 characters also applies.</p><p>When voice is unavailable or allowance runs out, reading continues without it.</p></div>
        </section>
        <section class="plus-recovery" aria-labelledby="plus-recovery-title">
          <div><p class="plus-eyebrow">ALREADY SUBSCRIBED?</p><h2 id="plus-recovery-title">Pick up on this browser.</h2><p>Use the email you paid with to restore access or manage an existing subscription. No separate RISE password.</p></div>
          <form data-recovery><label for="plus-email">Your checkout email</label><input id="plus-email" name="email" type="email" autocomplete="email" required maxlength="254" disabled><button class="plus-secondary" type="submit" disabled>Send a recovery link</button><p class="plus-caption" data-recovery-state>Checking recovery availability…</p></form>
        </section>
      </main>
      <footer class="plus-footer"><a href="mailto:syberlabs.software@gmail.com">Get help</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="https://syberlabs.io/">SyberLabs</a></footer>
    </div>`;
  }
  message(text) { if (!this.destroyed) this.$('[data-message]').textContent = text; }
  async start() {
    if (this.callback) await this.confirm();
    else await this.refresh();
  }
  async refresh() {
    const [config, status] = await Promise.all([fetchPlusOffer(), fetchPlusStatus({ timeoutMs: 8000 })]);
    if (this.destroyed) return;
    this.config = config; this.status = status;
    const price = this.$('[data-price]');
    const canBuy = config.checkoutAvailable && status.confirmed && !this.callback && !status.subscriber;
    price.textContent = config.checkoutAvailable
      ? `${new Intl.NumberFormat('en-US', { style: 'currency', currency: config.offer.currency }).format(config.offer.amount / 100)} / month`
      : 'Subscriptions are not available yet.';
    this.$('[data-offer]').textContent = config.checkoutAvailable ? `${config.offer.characterLimit.toLocaleString('en-US')} characters of narration each paid month.` : 'Free reading remains open. Existing subscribers can restore access below or contact support.';
    this.$('[data-checkout]').hidden = !canBuy;
    this.$('[data-checkout]').textContent = status.billingAvailable ? 'Subscribe again' : 'Subscribe to Plus';
    this.$('[data-billing]').hidden = !status.billingAvailable;
    this.$('[data-voice]').hidden = !status.subscriber;
    this.$('[data-voice]').textContent = readPlusContinuation() ? 'Continue your reading →' : 'Read with your Plus voice →';
    this.$('[data-renewal]').hidden = !canBuy;
    const allowance = status.allowance;
    this.$('[data-account]').textContent = !status.confirmed ? 'Your subscription status could not be checked. Reload this page to retry, or contact support.' : status.subscriber
      ? `Plus is active on this browser.${allowance ? ` ${allowance.used.toLocaleString('en-US')} of ${allowance.limit.toLocaleString('en-US')} characters used this period.` : ''}${status.available ? '' : ' Voice is currently unavailable; free reading continues.'}`
      : status.billingAvailable ? 'Your billing account is available. Plus voice is not currently active.' : '';
    if (status.subscriber && Number.isFinite(allowance?.periodEnd)) this.$('[data-account]').textContent += ` Current period ends ${new Date(allowance.periodEnd * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`;
    this.$('input[type=email]').disabled = !config.recoveryAvailable;
    this.$('[data-recovery] button').disabled = !config.recoveryAvailable;
    this.$('[data-recovery-state]').textContent = config.recoveryAvailable ? 'We email a short-lived link if a matching subscription exists.' : 'Email recovery is not available right now. Contact support for help.';
  }
  async run(button, task) {
    if (this.busy || this.destroyed) return;
    this.busy = true; button.disabled = true;
    try { await task(); } finally { this.busy = false; if (!this.destroyed) button.disabled = false; }
  }
  async purchase() {
    if (!this.config?.checkoutAvailable || !this.status?.confirmed || this.callback || this.status?.subscriber) return;
    await this.run(this.$('[data-checkout]'), async () => {
      this.message('Opening secure checkout…');
      const result = await startPlusCheckout(this.requestId);
      if (this.destroyed || !this.active) return;
      if (result.ok) this.redirect(result.url); else this.message(result.message);
    });
  }
  async billing() {
    if (!this.status?.billingAvailable) return;
    await this.run(this.$('[data-billing]'), async () => {
      this.message('Opening your billing portal…');
      const result = await openPlusBilling();
      if (this.destroyed || !this.active) return;
      if (result.ok) this.redirect(result.url); else this.message(result.message);
    });
  }
  async recover() {
    if (!this.config?.recoveryAvailable || !this.$('[data-recovery]').reportValidity()) return;
    const email = this.$('input[type=email]').value.trim();
    await this.run(this.$('[data-recovery] button'), async () => {
      this.message('Requesting a recovery link…');
      const result = await recoverPlus(email);
      this.message(result.ok ? 'If a subscription matches that email, a recovery link is on its way. Check your inbox and spam folder.' : result.message);
    });
  }
  async confirm() {
    if (!this.callback) return;
    await this.run(this.$('[data-retry]'), async () => {
      this.message('Confirming your subscription…');
      const result = this.callback.kind === 'restore' ? await restorePlus(this.callback.value) : await confirmPlusPurchase(this.callback.value);
      if (this.destroyed) return;
      this.$('[data-retry]').hidden = result.ok;
      this.message(result.ok ? 'Subscription access confirmed on this browser. Your current status is shown below.' : `${result.message}${this.callback.kind === 'restore' ? ' If the link expired or was already used, request a new recovery link below.' : ' Do not purchase again; retry confirmation or restore by email below.'}`);
      if (result.ok) this.callback = null;
      await this.refresh();
    });
  }
  activate() { this.active = true; }
  deactivate() { this.active = false; }
  destroy() { this.destroyed = true; window.removeEventListener('focus', this.onFocus); this.callback = null; this.events.abort(); this.container.innerHTML = ''; }
}
