import { describeStatus } from './controls.js';

/**
 * The stage inside a ChatGPT card: the reading, and two objects over it.
 *
 * Play/Pause at the bottom-left and Settings at the bottom-right, and nothing
 * else visible but one sentence when the reading fails. What a screen reader
 * needs is here and hidden: the state sentence, the whole reading as a list,
 * and each committed sentence while the reading is silent. It draws no
 * reading and keeps no time; it asks the runtime for things and shows what
 * the runtime says. (docs/product/discussions/2026-10-05-embed-stage-decision.md §2–§4)
 */

const INTENSITY = { min: 0.4, max: 0.75, step: 0.05, initial: 0.65 };

const PLAY_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10-6.5z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></svg>';
const PAUSE_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M8 5.5v13M16 5.5v13" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>';
const SETTINGS_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><circle cx="16" cy="7" r="2.25" fill="none" stroke="currentColor" stroke-width="1.75"/><circle cx="8" cy="17" r="2.25" fill="none" stroke="currentColor" stroke-width="1.75"/></svg>';
const NO_VOICE_GLYPH = '<svg class="rise-stage__novoice" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M4 10v4h3l4 3V7l-4 3zM15 9l5 6M20 9l-5 6" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"/></svg>';
const CLOSE_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>';

/**
 * @param {object} options
 * @param {object} options.runtime a live runtime
 * @param {() => void} options.onPlayAgain what Play again does (the host rebuilds the reading)
 * @param {boolean} [options.audible] whether the voice makes sound; a silent one is said to be pacing
 * @param {{capability: string, effect: string}[]} [options.degradations] what this device cannot do, for the
 *   hidden status; a `speechOutput` entry marks the object as having no voice
 * @param {Document} [options.doc]
 */
export function createStageControls({ runtime, onPlayAgain, audible = true, degradations = [], doc = document }) {
    const noVoice = degradations.some(note => note.capability === 'speechOutput');
    // Why it is silent, in the object's name: the two reasons src/live/capabilities.js gives.
    const silent = !noVoice ? '' : degradations.find(note => note.capability === 'speechOutput').effect.startsWith('No voice')
        ? ' (silent, no voice is installed)'
        : ' (silent, this browser cannot speak)';
    const root = doc.createElement('section');
    root.id = 'rise-stage-controls';
    root.className = 'rise-stage';
    root.setAttribute('aria-label', 'Reading controls');
    root.innerHTML = `
      <p class="rise-stage__status rise-stage__sr" role="status" aria-live="polite"></p>
      <ol class="rise-stage__text rise-stage__sr" aria-label="The whole reading"></ol>
      <p class="rise-stage__said rise-stage__sr" aria-live="off"></p>
      <p class="rise-stage__alert" role="alert" hidden></p>
      <button type="button" class="rise-stage__object rise-stage__play" data-stage="play"${noVoice ? ' data-voice="none"' : ''}></button>
      <button type="button" class="rise-stage__object rise-stage__settings" data-stage="settings" aria-label="Settings" aria-expanded="false" aria-controls="rise-settings">${SETTINGS_GLYPH}</button>
      <section id="rise-settings" class="rise-settings" role="dialog" aria-modal="false" aria-label="Settings" hidden>
        <div class="rise-settings__head">
          <h2 class="rise-settings__title">Settings</h2>
          <button type="button" class="rise-settings__close" aria-label="Close settings">${CLOSE_GLYPH}</button>
        </div>
        <div class="rise-settings__row">
          <label for="rise-settings-intensity">Intensity</label>
          <input id="rise-settings-intensity" type="range" min="${INTENSITY.min}" max="${INTENSITY.max}" step="${INTENSITY.step}" value="${INTENSITY.initial}" aria-describedby="rise-settings-intensity-note">
          <span id="rise-settings-intensity-note" hidden>Not on this passage</span>
        </div>
      </section>`;
    doc.body.appendChild(root);

    const $ = selector => root.querySelector(selector);
    const statusLine = $('.rise-stage__status');
    const text = $('.rise-stage__text');
    const said = $('.rise-stage__said');
    const alert = $('.rise-stage__alert');
    const play = $('[data-stage="play"]');
    const settings = $('[data-stage="settings"]');
    const sheet = $('#rise-settings');
    const close = $('.rise-settings__close');
    const intensity = $('#rise-settings-intensity');
    let destroyed = false;
    let listed = -1;
    let segmentId = null;
    // The reader's own intensity, kept for the reading: the director drops a control at every new cue.
    let chosen = null;

    function name(status) {
        if (status === 'ended') return 'Play again';
        if (status === 'interrupted') return `Play${silent}`;
        if (status === 'live') return `Pause${silent}`;
        return 'Starting';
    }

    function wholeReading() {
        const segments = runtime.composed?.('main')?.segments ?? [];
        if (segments.length === listed) return;
        listed = segments.length;
        text.replaceChildren(...segments.map(segment => {
            const item = doc.createElement('li');
            item.textContent = segment.text;
            return item;
        }));
    }

    function committed(snapshot) {
        const silent = !audible || snapshot.main?.voiceDegraded === true;
        if (!silent) {
            said.setAttribute('aria-live', 'off');
            said.textContent = '';
            return;
        }
        said.setAttribute('aria-live', 'polite');
        const last = (runtime.composed?.('main')?.segments ?? []).filter(segment => segment.ended).at(-1)?.text ?? '';
        if (said.textContent !== last) said.textContent = last;
    }

    function vividness(value) {
        return `${Math.round((value - INTENSITY.min) / (INTENSITY.max - INTENSITY.min) * 100)} percent vivid`;
    }

    function sendIntensity(value) {
        const receipt = runtime.controlVisual?.({ surface: 'attractor', parameter: 'intensity', value });
        if (receipt?.status !== 'accepted') return;
        chosen = value;
        root.dataset.intensity = receipt.effective.toFixed(2);
    }

    function refreshIntensity() {
        const discovery = runtime.discoverVisual?.() ?? null;
        intensity.disabled = !discovery;
        if (!discovery) return;
        const target = chosen ?? discovery.target?.intensity ?? discovery.current?.intensity ?? INTENSITY.initial;
        intensity.value = String(target);
        intensity.setAttribute('aria-valuetext', vividness(Number(intensity.value)));
    }

    function render(snapshot) {
        if (destroyed) return;
        const { status } = snapshot;
        const gone = status === 'failed' || status === 'stopped';
        statusLine.textContent = [describeStatus(snapshot, { audible, dive: false }), ...degradations.map(note => note.effect)].filter(Boolean).join(' ');
        play.hidden = gone;
        settings.hidden = gone;
        if (gone) closeSheet(false);
        play.disabled = !(status === 'live' || status === 'interrupted' || status === 'ended');
        play.setAttribute('aria-label', name(status));
        play.innerHTML = `${status === 'live' ? PAUSE_GLYPH : PLAY_GLYPH}${noVoice ? NO_VOICE_GLYPH : ''}`;
        alert.textContent = status === 'failed' ? describeStatus(snapshot, { audible, dive: false }) : '';
        alert.hidden = status !== 'failed';
        wholeReading();
        committed(snapshot);
        const at = snapshot.main?.segmentId ?? null;
        if (at !== segmentId) {
            segmentId = at;
            if (chosen !== null) sendIntensity(chosen);
        }
        if (!sheet.hidden) refreshIntensity();
    }

    // ─── the sheet ─────────────────────────────────────────────────────
    // Inside the stage, never the host's page; it does not pause the reading. Escape is heard on the
    // sheet itself and a press outside on the document: no key handler is bound to the document.

    const outside = event => { if (!sheet.contains(event.target) && event.target !== settings) closeSheet(); };

    function openSheet() {
        refreshIntensity();
        sheet.hidden = false;
        settings.setAttribute('aria-expanded', 'true');
        doc.addEventListener('pointerdown', outside);
        (intensity.disabled ? close : intensity).focus();
    }

    function closeSheet(refocus = true) {
        if (sheet.hidden) return;
        sheet.hidden = true;
        settings.setAttribute('aria-expanded', 'false');
        doc.removeEventListener('pointerdown', outside);
        if (refocus) settings.focus();
    }

    settings.addEventListener('click', () => (sheet.hidden ? openSheet() : closeSheet()));
    close.addEventListener('click', () => closeSheet());
    sheet.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        closeSheet();
    });
    intensity.addEventListener('input', () => {
        const value = Number(intensity.value);
        intensity.setAttribute('aria-valuetext', vividness(value));
        sendIntensity(value);
    });

    play.addEventListener('click', () => {
        if (runtime.status === 'ended') { onPlayAgain(); return; }
        if (runtime.status === 'interrupted') { runtime.resume(); return; }
        if (runtime.status === 'live') void runtime.interrupt().catch(() => {});
    });

    const off = runtime.subscribe(render);
    render(runtime.snapshot());

    return {
        element: root,
        destroy() {
            if (destroyed) return;
            destroyed = true;
            doc.removeEventListener('pointerdown', outside);
            off();
            root.remove();
        }
    };
}
