import { fetchPlusStatus, fetchPlusVoices, fetchPlusPaymentLink } from '../../app/plus.js';
import { voiceDemoSession, VOICE_DEMO_SAMPLE, VOICE_DEMO_MAX_CHARS, VOICE_DEMO_LOOKS } from '../../app/voice-demo-session.js';
import './VoiceDemo.css';

const DRAFT_KEY = 'rise.voice-demo.draft';
function readDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
    return draft?.schema === 1 && typeof draft.text === 'string' && draft.text.length <= VOICE_DEMO_MAX_CHARS
      && typeof draft.voice === 'string' && /^[a-z0-9_-]{1,32}$/u.test(draft.voice) && VOICE_DEMO_LOOKS.some(look => look.id === draft.look) ? draft : null;
  } catch { return null; }
}

export class VoiceDemo {
  constructor(container, { onBeginSession, ensureAudioEngine, getAudioEngine } = {}) {
    this.container = container;
    this.onBeginSession = onBeginSession;
    this.getAudioEngine = getAudioEngine;
    this.generation = 0;
    this.entitled = false;
    this.busy = false;
    this.destroyed = false;
    this.audioPrepared = false;
    const draft = readDraft();
    container.innerHTML = `<section class="voice-demo" aria-labelledby="voice-demo-title">
      <a class="voice-demo-home" href="/">RISE <span>↗ Home</span></a>
      <p class="voice-demo-eyebrow">WORDS · VOICE · COLOR</p>
      <h1 id="voice-demo-title">Hear the words.<br>Enter the color.</h1>
      <p class="voice-demo-intro">Try an ElevenLabs voice with a living visual field. Change the words, choose your voice, then Begin.</p>
      <form><label for="voice-demo-text">Your words</label>
      <textarea id="voice-demo-text" rows="4" maxlength="${VOICE_DEMO_MAX_CHARS}"></textarea>
      <p class="voice-demo-count" data-count></p>
      <div class="voice-demo-choices"><label>ElevenLabs voice<select data-voice aria-label="ElevenLabs voice"></select></label>
      <label>Visual preset<select data-look aria-label="Visual preset"></select></label></div>
      <p class="voice-demo-note">Your text goes to ElevenLabs when you Begin. This tab keeps your draft through sign-in. The voiced reading stays in this browser for replay. Reset the draft here, or clear all browser data in Settings. Voice limits apply.</p>
      <p data-status role="status" aria-live="polite">Checking voice availability…</p>
      <div data-access class="voice-demo-access"></div>
      <button data-begin type="submit" disabled>Begin with ElevenLabs <span aria-hidden="true">↗</span></button>
      <button data-refresh type="button">Check availability again</button><button data-reset type="button">Reset draft</button></form>
      <p class="voice-demo-foot">Continuous visuals respect reduced motion. You can pause or leave the reading at any time.</p>
      </section>`;
    this.text = container.querySelector('textarea');
    this.text.value = draft?.text ?? VOICE_DEMO_SAMPLE;
    this.voice = container.querySelector('[data-voice]');
    this.look = container.querySelector('[data-look]');
    for (const preset of VOICE_DEMO_LOOKS) this.look.add(new Option(preset.label, preset.id));
    this.look.value = draft?.look ?? 'prism';
    this.savedVoice = draft?.voice;
    this.status = container.querySelector('[data-status]');
    this.begin = container.querySelector('[data-begin]');
    this.events = new AbortController();
    const options = { signal: this.events.signal };
    this.text.addEventListener('input', () => { this.saveDraft(); this.updateBegin(); }, options);
    this.voice.addEventListener('change', () => this.saveDraft(), options);
    this.look.addEventListener('change', () => this.saveDraft(), options);
    container.querySelector('form').addEventListener('submit', event => { event.preventDefault(); void this.start(); }, options);
    container.querySelector('[data-refresh]').addEventListener('click', () => { void this.refresh(); }, options);
    container.querySelector('[data-reset]').addEventListener('click', () => {
      this.text.value = VOICE_DEMO_SAMPLE; this.look.value = 'prism'; this.voice.selectedIndex = 0;
      this.savedVoice = null;
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* storage unavailable */ }
      this.updateBegin();
    }, options);
    // Load the engine before Begin. init() constructs the context here; Begin
    // calls resume() synchronously in its gesture, before any status/TTS await.
    this.audioReady = Promise.resolve(ensureAudioEngine?.()).then(async engine => {
      if (!engine) return;
      await engine.init();
      this.audioPrepared = true;
      if (!this.destroyed) this.updateBegin();
    }).catch(() => { if (!this.destroyed) this.status.textContent = 'Audio could not initialize. Reload this page to try again.'; });
    this.ready = this.refresh();
    this.updateBegin();
  }

  saveDraft() {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ schema: 1, text: this.text.value.slice(0, VOICE_DEMO_MAX_CHARS), voice: this.voice.value || this.savedVoice || 'default', look: this.look.value })); } catch { /* browser storage can be unavailable */ }
  }

  updateBegin() {
    this.container.querySelector('[data-count]').textContent = `${this.text.value.length.toLocaleString()} / 1,000 characters`;
    this.begin.disabled = this.busy || !this.audioPrepared || !this.entitled || !/[\p{L}\p{N}]/u.test(this.text.value) || this.text.value.length > VOICE_DEMO_MAX_CHARS;
  }

  async refresh() {
    const generation = ++this.generation;
    this.entitled = false;
    this.updateBegin();
    this.status.textContent = 'Checking voice availability…';
    let timeout;
    const fallback = [{ admin: false, available: false, unconfirmed: true }, [{ slug: 'default', label: 'Default' }], null];
    const values = await Promise.race([
      Promise.all([fetchPlusStatus(), fetchPlusVoices(), fetchPlusPaymentLink()]),
      new Promise(resolve => { timeout = setTimeout(() => resolve(fallback), 2000); })
    ]).catch(() => fallback).finally(() => clearTimeout(timeout));
    if (this.destroyed || generation !== this.generation) return;
    const [status, voices, paymentLink] = values;
    this.entitled = status.available === true && (status.admin === true || status.subscriber === true);
    const selected = this.voice.value || this.savedVoice;
    this.voice.replaceChildren(...voices.map(voice => new Option(voice.label, voice.slug)));
    if (voices.some(voice => voice.slug === selected)) this.voice.value = selected;
    this.status.textContent = this.entitled ? 'Voice access confirmed. Begin when you are ready to listen.'
      : status.unconfirmed || status.admin || status.subscriber ? 'Could not confirm ElevenLabs availability. Try checking again; your text stays here.'
        : 'Voice access is not ready. A signed-in administrator or active Plus subscription is required. Check again after signing in.';
    const access = this.container.querySelector('[data-access]');
    access.replaceChildren();
    const addLink = (href, label) => { const link = document.createElement('a'); link.href = href; link.textContent = label; access.append(link); };
    if (!this.entitled && status.adminLogin === true) addLink('/api/plus/admin/login?returnTo=voice-demo', 'Administrator sign-in');
    if (!this.entitled && paymentLink) addLink(paymentLink, 'Subscribe to Plus');
    if (!this.entitled && !status.adminLogin && !paymentLink) access.textContent = status.unconfirmed
      ? 'Could not confirm sign-in or checkout availability. Check again to retry.'
      : 'No administrator sign-in or Plus checkout link is available here. Check availability again.';
    this.updateBegin();
  }

  async start() {
    if (this.begin.disabled || this.busy) return;
    const generation = this.generation;
    this.busy = true;
    this.updateBegin();
    this.status.textContent = 'Preparing your ElevenLabs reading…';
    try {
      const engine = this.getAudioEngine?.();
      const resumed = engine?.resume(); // spend the Begin gesture before awaits
      await this.audioReady;
      if (resumed) await resumed;
      const readyEngine = this.getAudioEngine?.();
      if (!readyEngine?.context || (typeof readyEngine.audible === 'boolean' ? !readyEngine.audible : readyEngine.context.state !== 'running')) throw new Error('Audio is paused by this browser. Press Begin again to enable sound.');
      if (this.destroyed || this.inactive || generation !== this.generation) return;
      this.saveDraft();
      const config = voiceDemoSession({ text: this.text.value, voice: this.voice.value, look: this.look.value });
      const opened = await this.onBeginSession(config);
      if (!opened && !this.destroyed) this.status.textContent = config.origin.voiceFailure || 'ElevenLabs could not start. Your text is still here. Check availability and try again.';
    } catch (error) {
      if (!this.destroyed) this.status.textContent = error.message || 'ElevenLabs could not start. Your text is still here.';
    } finally {
      this.busy = false;
      if (!this.destroyed) this.updateBegin();
    }
  }

  activate() { if (this.inactive) { this.inactive = false; if (!this.busy) this.ready = this.refresh(); } }
  deactivate() { this.inactive = true; this.generation++; }
  destroy() { this.destroyed = true; this.generation++; this.events.abort(); this.container.innerHTML = ''; }
}
