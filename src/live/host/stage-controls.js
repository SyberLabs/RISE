import { describeStatus } from './controls.js';
import { JEV_COLOR_THEMES } from '../../core/jev-color-themes.js';
import { FONT_SIZE_CHIPS, resolveFontSize } from '../../core/chamber-type-size.js';

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
/** The four fixed sizes; Fit is for Word paint, which a Current never uses. */
const SIZE_CHIPS = FONT_SIZE_CHIPS.filter(chip => chip.fontSize !== 'fit');
const STILL_NOTE = 'Imagery stays still.';

const PLAY_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10-6.5z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/></svg>';
const AGAIN_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M6.7 3.2v3.5h3.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PAUSE_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M8 5.5v13M16 5.5v13" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>';
const SETTINGS_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><circle cx="16" cy="7" r="2.25" fill="none" stroke="currentColor" stroke-width="1.75"/><circle cx="8" cy="17" r="2.25" fill="none" stroke="currentColor" stroke-width="1.75"/></svg>';
const NO_VOICE_GLYPH = '<svg class="rise-stage__novoice" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M4 10v4h3l4 3V7l-4 3zM15 9l5 6M20 9l-5 6" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"/></svg>';
const CLOSE_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>';

/**
 * @param {object} options
 * @param {object} options.runtime a live runtime
 * @param {() => void} options.onPlayAgain what Play again does (the host rebuilds the reading)
 * @param {() => object | null} [options.chamber] the Chamber playing this reading once it is on screen,
 *   for its colour theme and its two saved settings (reduced motion, text size)
 * @param {(theme: string | null) => void} [options.paintTheme] paints the frame outside the Chamber in a
 *   theme's colours; null means the reading's own
 * @param {boolean} [options.audible] whether the voice makes sound; a silent one is said to be pacing
 * @param {{capability: string, effect: string}[]} [options.degradations] what this device cannot do, for the
 *   hidden status; a `speechOutput` entry marks the object as having no voice
 * @param {boolean} [options.takeFocus] the control that started the reading had the focus and is gone: the
 *   object takes it once it can be pressed, unless the reader has put the focus somewhere else meanwhile
 * @param {Document} [options.doc]
 */
export function createStageControls({ runtime, onPlayAgain, chamber = () => null, paintTheme = () => {}, audible = true, degradations = [], takeFocus = false, doc = document }) {
    const noVoice = degradations.some(note => note.capability === 'speechOutput');
    const systemStill = degradations.some(note => note.capability === 'reducedMotion');
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
        <div class="rise-settings__row">
          <label for="rise-settings-theme">Theme</label>
          <select id="rise-settings-theme"><option value="">As written</option>${JEV_COLOR_THEMES.map(id => `<option value="${id}">${id[0].toUpperCase()}${id.slice(1)}</option>`).join('')}</select>
        </div>
        <div class="rise-settings__row rise-settings__row--switch">
          <label for="rise-settings-still">Still imagery</label>
          <input id="rise-settings-still" type="checkbox" role="switch"${systemStill ? ' checked disabled aria-describedby="rise-settings-still-note"' : ''}>
          <span id="rise-settings-still-note" hidden>Your system asks for reduced motion.</span>
        </div>
        <div class="rise-settings__row rise-settings__row--chips">
          <span class="rise-settings__label" id="rise-settings-size-label">Text size</span>
          <div class="rise-settings__chips" role="radiogroup" aria-labelledby="rise-settings-size-label">${SIZE_CHIPS.map(chip => `<label class="rise-settings__chip"><input type="radio" name="rise-settings-size" value="${chip.fontSize}"${chip.fontSize === 'medium' ? ' checked' : ''}><span>${chip.label}</span></label>`).join('')}</div>
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
    const theme = $('#rise-settings-theme');
    const still = $('#rise-settings-still');
    const sizes = [...$('.rise-settings__chips').querySelectorAll('input')];
    let destroyed = false;
    let listed = -1;
    let segmentId = null;
    // The reader's own intensity, kept for the reading: the director drops a control at every new cue.
    let chosen = null;
    // The other rows' choices, kept for a Chamber that is not on screen yet (one mounts as the reading starts).
    const picked = {};
    let reached = null;

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

    function apply(to, key, value) {
        if (key === 'theme') to.setColourTheme(value);
        else to.onSettingsChange(key, value);
    }

    /** The Chamber on screen, or null; one seen for the first time takes every choice made so far and gives its saved rows. */
    function reachChamber() {
        const current = chamber();
        if (current && current !== reached) {
            reached = current;
            for (const [key, value] of Object.entries(picked)) apply(current, key, value);
            refreshSaved(current);
        }
        return current;
    }

    /** A row's choice: kept for the reading, and given to the Chamber on screen once. */
    function choose(key, value) {
        picked[key] = value;
        const before = reached;
        const current = reachChamber();
        if (current && current === before) apply(current, key, value);
    }

    /** The two saved rows, read from the Chamber's settings; the system's reduced motion is not the reader's to change. */
    function refreshSaved(from = reachChamber()) {
        const saved = from?.getSettings?.();
        if (!saved) return;
        if (!systemStill) still.checked = picked.reducedMotion ?? (saved.reducedMotion === true);
        const size = picked.fontSize ?? resolveFontSize(saved.fontSize);
        for (const chip of sizes) chip.checked = chip.value === size;
    }

    function render(snapshot) {
        if (destroyed) return;
        const { status } = snapshot;
        const gone = status === 'failed' || status === 'stopped';
        reachChamber();
        const stillNote = !systemStill && still.checked ? [STILL_NOTE] : [];
        statusLine.textContent = [describeStatus(snapshot, { audible, dive: false }), ...degradations.map(note => note.effect), ...stillNote].filter(Boolean).join(' ');
        play.hidden = gone;
        settings.hidden = gone;
        if (gone) closeSheet(false);
        play.disabled = !(status === 'live' || status === 'interrupted' || status === 'ended');
        if (takeFocus && !play.disabled && !gone) {
            takeFocus = false;
            // Only from nowhere: a frame whose document has lost the focus, or a reader who moved it, keeps theirs.
            if (doc.hasFocus() && (doc.activeElement === doc.body || doc.activeElement === null)) play.focus();
        }
        play.setAttribute('aria-label', name(status));
        // The end is drawn apart from a pause: the same triangle would leave a sighted reader unable to tell them.
        play.innerHTML = `${status === 'live' ? PAUSE_GLYPH : status === 'ended' ? AGAIN_GLYPH : PLAY_GLYPH}${noVoice ? NO_VOICE_GLYPH : ''}`;
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
        refreshSaved();
        sheet.hidden = false;
        settings.setAttribute('aria-expanded', 'true');
        doc.addEventListener('pointerdown', outside);
        ([intensity, theme, still, ...sizes].find(control => !control.disabled) ?? close).focus();
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
    // The frame and the Chamber take a theme in one frame; "As written" (null) gives each its own back.
    theme.addEventListener('change', () => {
        paintTheme(theme.value || null);
        choose('theme', theme.value || null);
    });
    // The two saved rows go through the Chamber's settings path, which applies and keeps them.
    still.addEventListener('change', () => {
        choose('reducedMotion', still.checked);
        render(runtime.snapshot());
    });
    for (const chip of sizes) {
        chip.addEventListener('change', () => { if (chip.checked) choose('fontSize', chip.value); });
    }

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
