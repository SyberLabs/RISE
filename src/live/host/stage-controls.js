import { describeStatus } from './controls.js';
import { JEV_COLOR_THEMES } from '../../core/jev-color-themes.js';
import { FONT_SIZE_CHIPS, resolveFontSize } from '../../core/chamber-type-size.js';
import { ACCOUNT_SIGN_IN } from '../../core/account-service.js';

/**
 * The stage inside a host's card: the reading, and a row of objects over it.
 *
 * The full transport (the default): back a passage, Play/Pause, forward a
 * passage, say this passage again, the pace, full screen where the host or
 * the browser can give it, and Settings at the right, with a thin line above
 * them of one tick per passage that is also the progress. The minimal
 * transport is the two objects of the 2026-10-05 decision, Play/Pause at the
 * bottom-left and Settings at the bottom-right, kept for ChatGPT's two-action
 * guideline. Nothing else is visible but one sentence when the reading fails.
 * What a screen reader needs is here and hidden: the state sentence (with the
 * passage, of how many), the whole reading as a list, and each committed
 * sentence while the reading is silent. It draws no reading and keeps no
 * time; it asks the runtime for things and shows what the runtime says.
 * While the reading plays, the bar gets out of the way: 2.5 s after the
 * pointer last moved, the objects fade (the beat line stays, faint, as
 * progress) and the words take the room back. Any pointer movement, a touch,
 * a key on the stage or the focus entering it brings the bar back; a paused,
 * ended or failed reading, or the sheet open, keeps it. A touch that finds the
 * bar hidden only brings it back: nothing unseen is pressed.
 * (docs/product/discussions/2026-10-05-embed-stage-decision.md §2–§4, and its amendment of 2026-10-08)
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
const BACK_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M7 6v12M18 6.5v11L9.5 12z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const FORWARD_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M17 6v12M6 6.5v11l8.5-5.5z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const REPLAY_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M17.3 3.2v3.5h-3.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="1.75" fill="currentColor"/></svg>';
const FULLSCREEN_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PIP_GLYPH = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><rect x="3.5" y="5" width="17" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.75"/><rect x="12" y="11.5" width="6" height="5" rx="1" fill="currentColor"/></svg>';

/** The pace object's rates, in the order one press steps through them; the keys step along them and stop at the ends. */
const PACES = [0.8, 1, 1.25, 1.5];
/** How long the bar stays after the pointer last moved while the reading plays. */
const BAR_STAYS_MS = 2_500;
const KEYS_DESCRIBED = 'Keys on the stage: Space plays or pauses; the Left and Right arrows go back or on a passage; R says the passage again; F fills the screen where it can; minus and equals, or the brackets, slow or quicken the pace.';

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
 * @param {'full' | 'minimal'} [options.transport] the whole transport, or only Play/Pause and Settings
 * @param {object | null} [options.port] the host card's port (mcp-port.js), whose host may offer to show the
 *   card full screen or floating; with none, the browser's own full screen where it allows it
 * @param {boolean} [options.sound] there is an engine for the reading's beds and tones: the sheet offers Sound
 * @param {(() => string) | null} [options.about] what the host knows of this reading's voice, host and device, as
 *   plain text: the sheet ends with it, collapsed, under "About this reading", with Copy
 * @param {{voices: {name: string, local: boolean}[], selected: string, choose: (name: string) => void} | null} [options.voice]
 *   the browser's installed voices for the reading's language: the sheet offers them under Voice, after Automatic
 *   (the empty name), and `choose` takes the reader's pick, which the voice speaks from its next passage
 * @param {Document} [options.doc]
 */
export function createStageControls({
    runtime, onPlayAgain, chamber = () => null, paintTheme = () => {}, audible = true, degradations = [], takeFocus = false,
    transport = 'full', port = null, sound: offersSound = false, about = null, voice: voicePick = null, doc = document
}) {
    // With Sound offered too, Voice shares its row: one row more would make the sheet scroll in a 481 px card.
    const offersVoice = (voicePick?.voices?.length ?? 0) > 0;
    const full = transport !== 'minimal';
    const noVoice = degradations.some(note => note.capability === 'speechOutput');
    const systemStill = degradations.some(note => note.capability === 'reducedMotion');
    // Why it is silent, in the object's name: the two reasons src/live/capabilities.js gives.
    const silent = !noVoice ? '' : degradations.find(note => note.capability === 'speechOutput').effect.startsWith('No voice')
        ? ' (silent, no voice is installed)'
        : ' (silent, this browser cannot speak)';
    // A voice the reading gave up on (speech-governor.js) is marked as one that cannot speak until it is the clock again.
    const givenUp = ' (silent, the voice did not start; Play tries it again)';
    const root = doc.createElement('section');
    root.id = 'rise-stage-controls';
    root.className = 'rise-stage';
    root.setAttribute('aria-label', 'Reading controls');
    root.dataset.transport = full ? 'full' : 'minimal';
    const object = (name, label, glyph, keys) => `<button type="button" class="rise-stage__object rise-stage__${name}" data-stage="${name}" aria-label="${label}" aria-disabled="true"${keys ? ` aria-keyshortcuts="${keys}"` : ''}>${glyph}</button>`;
    root.innerHTML = `
      <p class="rise-stage__status rise-stage__sr" role="status" aria-live="polite"></p>
      <ol class="rise-stage__text rise-stage__sr" aria-label="The whole reading"></ol>
      <p class="rise-stage__said rise-stage__sr" aria-live="off"></p>
      ${full ? '<p class="rise-stage__pace-note rise-stage__sr" aria-live="polite"></p>' : ''}
      ${offersVoice ? '<p class="rise-stage__voice-note rise-stage__sr" aria-live="polite"></p>' : ''}
      <p class="rise-stage__alert" role="alert" hidden></p>
      <div class="rise-stage__bar">
        ${full ? '<div class="rise-stage__beats" aria-hidden="true"></div>' : ''}
        <div class="rise-stage__row">
          ${full ? object('back', 'Back a passage', BACK_GLYPH, 'ArrowLeft') : ''}
          <button type="button" class="rise-stage__object rise-stage__play" data-stage="play"${noVoice ? ' data-voice="none"' : ''}></button>
          ${full ? `${object('forward', 'Forward a passage', FORWARD_GLYPH, 'ArrowRight')}${object('replay', 'Say this passage again', REPLAY_GLYPH, 'R')}
          <button type="button" class="rise-stage__object rise-stage__pace" data-stage="pace" aria-keyshortcuts="Minus Equal"></button>
          <button type="button" class="rise-stage__object rise-stage__fullscreen" data-stage="fullscreen" aria-pressed="false" aria-keyshortcuts="F" hidden></button>` : ''}
          <button type="button" class="rise-stage__object rise-stage__settings" data-stage="settings" aria-label="Settings" aria-expanded="false" aria-controls="rise-settings">${SETTINGS_GLYPH}</button>
        </div>
      </div>
      <section id="rise-settings" class="rise-settings" role="dialog" aria-modal="false" aria-label="Settings"${full ? ' aria-describedby="rise-settings-keys"' : ''} hidden>
        ${full ? `<p id="rise-settings-keys" class="rise-stage__sr">${KEYS_DESCRIBED}</p>` : ''}
        <div class="rise-settings__head">
          <h2 class="rise-settings__title">Settings</h2>
          <a class="rise-settings__account" href="${ACCOUNT_SIGN_IN}" target="_blank" rel="noopener">Sign in to SyberLabs</a>
          <button type="button" class="rise-settings__close" aria-label="Close settings">${CLOSE_GLYPH}</button>
        </div>
        <div class="rise-settings__row">
          <label for="rise-settings-intensity">Intensity</label>
          <input id="rise-settings-intensity" type="range" min="${INTENSITY.min}" max="${INTENSITY.max}" step="${INTENSITY.step}" value="${INTENSITY.initial}">
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
        ${offersSound && offersVoice ? `<div class="rise-settings__row">
          <span class="rise-settings__label" aria-hidden="true">Sound &amp; voice</span>
          <input id="rise-settings-sound" type="checkbox" role="switch" aria-label="Sound" checked>
          <select id="rise-settings-voice" aria-label="Voice"><option value="">Automatic</option></select>
        </div>` : offersSound ? `<div class="rise-settings__row rise-settings__row--switch">
          <label for="rise-settings-sound">Sound</label>
          <input id="rise-settings-sound" type="checkbox" role="switch" checked>
        </div>` : offersVoice ? `<div class="rise-settings__row">
          <label for="rise-settings-voice">Voice</label>
          <select id="rise-settings-voice"><option value="">Automatic</option></select>
        </div>` : ''}
        <div class="rise-settings__row rise-settings__row--chips">
          <span class="rise-settings__label" id="rise-settings-size-label">Text size</span>
          <div class="rise-settings__chips" role="radiogroup" aria-labelledby="rise-settings-size-label">${SIZE_CHIPS.map(chip => `<label class="rise-settings__chip"><input type="radio" name="rise-settings-size" value="${chip.fontSize}"${chip.fontSize === 'medium' ? ' checked' : ''}><span>${chip.label}</span></label>`).join('')}</div>
        </div>
        ${about ? `<details class="rise-settings__about">
          <summary>About this reading</summary>
          <button type="button" class="rise-settings__copy">Copy</button>
          <pre class="rise-settings__about-text"></pre>
        </details>` : ''}
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
    const sound = $('#rise-settings-sound');
    const voiceSelect = $('#rise-settings-voice');
    const voiceNote = $('.rise-stage__voice-note');
    if (voiceSelect) {
        // The device's names, as text: never markup.
        for (const { name: voiceName, local } of voicePick.voices) {
            voiceSelect.add(new Option(local ? voiceName : `${voiceName} (network)`, voiceName));
        }
        voiceSelect.value = voicePick.voices.some(item => item.name === voicePick.selected) ? voicePick.selected : '';
    }
    const sizes = [...$('.rise-settings__chips').querySelectorAll('input')];
    const back = $('[data-stage="back"]');
    const forward = $('[data-stage="forward"]');
    const replay = $('[data-stage="replay"]');
    const pace = $('[data-stage="pace"]');
    const fullscreen = $('[data-stage="fullscreen"]');
    const beats = $('.rise-stage__beats');
    const paceNote = $('.rise-stage__pace-note');
    const aboutPanel = $('.rise-settings__about');
    const aboutText = $('.rise-settings__about-text');
    const copy = $('.rise-settings__copy');
    let destroyed = false;
    // The pace last said and where it was to land; the first one rendered is the reading's own, not news.
    let paceSaid = null;
    // The passages the beat line was last drawn for.
    let drawn = null;
    let listed = -1;
    let segmentId = null;
    // The reader's own intensity, kept for the reading: the director drops a control at every new cue.
    let chosen = null;
    // The other rows' choices, kept for a Chamber that is not on screen yet (one mounts as the reading starts).
    const picked = {};
    let reached = null;

    function name(status, why) {
        if (status === 'ended') return 'Play again';
        if (status === 'interrupted') return `Play${why}`;
        if (status === 'live') return `Pause${why}`;
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
        const found = runtime.discoverVisual?.() ?? null;
        // Only a field whose intensity changes while it runs offers the row: the attractor's does, the flame's is fixed.
        const discovery = found?.manifest?.parameters?.intensity?.cueable === true ? found : null;
        intensity.closest('.rise-settings__row').hidden = !discovery;
        intensity.disabled = !discovery;
        if (!discovery) return;
        const target = chosen ?? discovery.target?.intensity ?? discovery.current?.intensity ?? INTENSITY.initial;
        intensity.value = String(target);
        intensity.setAttribute('aria-valuetext', vividness(Number(intensity.value)));
    }

    function apply(to, key, value) {
        if (key === 'theme') to.setColourTheme(value);
        else if (key === 'cardSound') {
            // Off is the Chamber's own silence of the reading's sound, the one its sound list's None makes;
            // on gives the reading back the sound it was written with.
            to.changeJevLook?.('jev-soundscape', value ? 'authored' : 'none');
            to.onSettingsChange(key, value);
        } else to.onSettingsChange(key, value);
    }

    /** The Chamber on screen, or null; one seen for the first time takes every choice made so far and gives its saved rows. */
    function reachChamber() {
        const current = chamber();
        if (current && current !== reached) {
            reached = current;
            for (const [key, value] of Object.entries(picked)) apply(current, key, value);
            refreshSaved(current);
            // Sound the reader turned off in an earlier reading stays off in this one.
            if (sound && !sound.checked && picked.cardSound === undefined) apply(current, 'cardSound', false);
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
        if (sound) sound.checked = picked.cardSound ?? (saved.cardSound !== false);
        const size = picked.fontSize ?? resolveFontSize(saved.fontSize);
        for (const chip of sizes) chip.checked = chip.value === size;
    }

    // ─── the transport ─────────────────────────────────────────────────

    const rate = value => `${Number(value.toFixed(2))}`;
    const disable = (control, off) => control.setAttribute('aria-disabled', off ? 'true' : 'false');
    const enabled = control => control.getAttribute('aria-disabled') !== 'true';

    /**
     * How this card can fill the screen, or null: a host card asks its host for a display mode the host offers
     * (full screen first, else floating); a page in no host card uses the browser's own full screen, of the whole
     * page (the stage itself holds only the controls), where the browser allows it.
     */
    function display() {
        if (port) {
            const context = port.hostContext?.() ?? {};
            const offered = Array.isArray(context.availableDisplayModes) ? context.availableDisplayModes : [];
            const mode = offered.includes('fullscreen') ? 'fullscreen' : offered.includes('pip') ? 'pip' : null;
            if (!mode || typeof port.requestDisplayMode !== 'function') return null;
            const active = context.displayMode === mode;
            return { mode, active, toggle: () => port.requestDisplayMode(active ? 'inline' : mode) };
        }
        if (doc.fullscreenEnabled !== true) return null;
        const active = Boolean(doc.fullscreenElement);
        return { mode: 'fullscreen', active, toggle: () => (active ? doc.exitFullscreen() : doc.documentElement.requestFullscreen()) };
    }

    function setPace(value) {
        try { runtime.setPace(value); } catch { /* the pace stays as it was */ }
    }

    /** One step along the rates, stopping at the ends. */
    function stepPace(direction) {
        const now = runtime.snapshot().pace ?? 1;
        const to = direction > 0 ? PACES.find(value => value > now) : PACES.findLast(value => value < now);
        if (to !== undefined) setPace(to);
    }

    function seek(target) {
        try { runtime.seek(target); } catch { /* a passage that cannot be reached leaves the reading where it is */ }
    }

    /** The beat line: one tick per passage, drawn again only when the passages change, lit by where the reader is. */
    function drawBeats(position, gone) {
        beats.hidden = gone || !position;
        const passages = runtime.passages?.() ?? [];
        const key = passages.map(passage => `${passage.segmentId}:${passage.spoken}`).join('|');
        if (key !== drawn) {
            drawn = key;
            beats.replaceChildren(...passages.map(({ segmentId, spoken }) => {
                const tick = doc.createElement('button');
                tick.type = 'button';
                tick.tabIndex = -1;
                tick.className = 'rise-stage__beat';
                tick.dataset.segmentId = segmentId;
                tick.dataset.spoken = String(spoken);
                tick.addEventListener('click', () => seek({ segmentId }));
                return tick;
            }));
        }
        const at = position?.segmentIndex ?? -1;
        [...beats.children].forEach((tick, index) => { tick.dataset.state = index < at ? 'passed' : index === at ? 'current' : 'ahead'; });
    }

    /** A new pace is said with where it lands (the voice's next sentence or passage), and again once it has. */
    function sayPace(now, from) {
        const said = `${now}|${from}`;
        if (paceSaid !== null && said !== paceSaid) {
            paceNote.textContent = from ? `Pace ${rate(now)}×, from the next ${from}.` : `Pace ${rate(now)}×.`;
        }
        paceSaid = said;
    }

    function renderTransport(snapshot, gone) {
        const { status, position } = snapshot;
        const ready = (status === 'live' || status === 'interrupted' || status === 'ended') && Boolean(position);
        for (const control of [back, forward, replay, pace]) control.hidden = gone;
        disable(back, !ready || position.segmentIndex === 0);
        disable(forward, !ready || position.segmentIndex >= position.segmentCount - 1);
        disable(replay, !ready);
        const now = snapshot.pace ?? 1;
        pace.textContent = `${rate(now)}×`;
        pace.setAttribute('aria-label', `Pace, ${rate(now)} times`);
        sayPace(now, snapshot.paceFrom ?? null);
        const shown = display();
        fullscreen.hidden = gone || !shown;
        if (shown) {
            fullscreen.innerHTML = shown.mode === 'pip' ? PIP_GLYPH : FULLSCREEN_GLYPH;
            fullscreen.setAttribute('aria-label', shown.mode === 'pip' ? 'Pop out' : 'Full screen');
            fullscreen.setAttribute('aria-pressed', String(shown.active));
        }
        drawBeats(position, gone);
    }

    function render(snapshot) {
        if (destroyed) return;
        const { status } = snapshot;
        const gone = status === 'failed' || status === 'stopped';
        reachChamber();
        const stillNote = !systemStill && still.checked ? [STILL_NOTE] : [];
        const where = full && !gone && snapshot.position ? [`Passage ${snapshot.position.segmentIndex + 1} of ${snapshot.position.segmentCount}.`] : [];
        statusLine.textContent = [describeStatus(snapshot, { audible, dive: false }), ...where, ...degradations.map(note => note.effect), ...stillNote].filter(Boolean).join(' ');
        if (full) renderTransport(snapshot, gone);
        play.hidden = gone;
        settings.hidden = gone;
        if (gone) closeSheet(false);
        play.disabled = !(status === 'live' || status === 'interrupted' || status === 'ended');
        if (takeFocus && !play.disabled && !gone) {
            takeFocus = false;
            // Only from nowhere: a frame whose document has lost the focus, or a reader who moved it, keeps theirs.
            if (doc.hasFocus() && (doc.activeElement === doc.body || doc.activeElement === null)) play.focus();
        }
        const lost = !noVoice && audible && snapshot.main?.voiceDegraded === true;
        if (noVoice || lost) play.dataset.voice = 'none';
        else delete play.dataset.voice;
        play.setAttribute('aria-label', name(status, lost ? givenUp : silent));
        // The end is drawn apart from a pause: the same triangle would leave a sighted reader unable to tell them.
        play.innerHTML = `${status === 'live' ? PAUSE_GLYPH : status === 'ended' ? AGAIN_GLYPH : PLAY_GLYPH}${noVoice || lost ? NO_VOICE_GLYPH : ''}`;
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
        if (!mayHideBar() || (root.dataset.bar !== 'hidden' && barTimer === null)) showBar();
    }

    // ─── the bar, out of the way while the reading plays ──────────────

    let barTimer = null;
    // A touch that found the bar hidden: its press only brings the bar back.
    let unseenPress = false;

    const mayHideBar = () => !destroyed && runtime.status === 'live' && sheet.hidden;

    /** Show the bar, and hide it again BAR_STAYS_MS from now if the reading is playing. */
    function showBar() {
        clearTimeout(barTimer);
        barTimer = null;
        root.dataset.bar = 'shown';
        if (!mayHideBar()) return;
        barTimer = setTimeout(() => {
            barTimer = null;
            if (mayHideBar()) root.dataset.bar = 'hidden';
        }, BAR_STAYS_MS);
    }

    root.addEventListener('pointerdown', event => { unseenPress = root.dataset.bar === 'hidden' && event.pointerType !== 'mouse'; }, true);
    root.addEventListener('click', event => {
        if (!unseenPress) return;
        unseenPress = false;
        event.preventDefault();
        event.stopPropagation();
    }, true);
    root.addEventListener('keydown', () => { unseenPress = false; showBar(); }, true);
    root.addEventListener('focusin', showBar);
    doc.addEventListener('pointermove', showBar);
    doc.addEventListener('pointerdown', showBar);

    // ─── the sheet ─────────────────────────────────────────────────────
    // Inside the stage, never the host's page; it does not pause the reading. Escape is heard on the
    // sheet itself and a press outside on the document: no key handler is bound to the document.

    const outside = event => { if (!sheet.contains(event.target) && event.target !== settings) closeSheet(); };

    /** What the host says of the reading now; Copy says it was not yet pressed. */
    function refreshAbout() {
        if (!aboutText) return;
        aboutText.textContent = about();
        copy.textContent = 'Copy';
        // More than the sheet can show is faded at its foot (the stage never scrolls); Copy takes it all.
        aboutText.dataset.clipped = String(aboutText.scrollHeight > aboutText.clientHeight);
    }

    function openSheet() {
        refreshIntensity();
        refreshSaved();
        refreshAbout();
        sheet.hidden = false;
        settings.setAttribute('aria-expanded', 'true');
        doc.addEventListener('pointerdown', outside);
        // Never a list: iOS opens a <select>'s picker when it is focused inside the press that opened the sheet.
        const first = [intensity, still, sound, ...sizes].find(control => control && !control.disabled);
        (first ?? close).focus();
        showBar();
    }

    function closeSheet(refocus = true) {
        if (sheet.hidden) return;
        sheet.hidden = true;
        settings.setAttribute('aria-expanded', 'false');
        doc.removeEventListener('pointerdown', outside);
        if (refocus) settings.focus();
        showBar();
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
    sound?.addEventListener('change', () => choose('cardSound', sound.checked));
    // The voice in use finishes its passage (voices/browser.js setVoice), so the change is said with where it lands.
    voiceSelect?.addEventListener('change', () => {
        voicePick.choose(voiceSelect.value);
        voiceNote.textContent = `Voice: ${voiceSelect.value || 'Automatic'}, from the next passage.`;
    });
    aboutPanel?.addEventListener('toggle', () => { if (aboutPanel.open) refreshAbout(); });
    // Written inside the press, which the clipboard asks for; where it is refused, the text is selected for the reader to copy.
    copy?.addEventListener('click', () => {
        refreshAbout();
        const said = aboutText.textContent;
        let written;
        try { written = Promise.resolve(doc.defaultView.navigator.clipboard.writeText(said)); } catch (refused) { written = Promise.reject(refused); }
        written.then(() => { copy.textContent = 'Copied'; }, () => {
            const range = doc.createRange();
            range.selectNodeContents(aboutText);
            const selection = doc.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            copy.textContent = 'Selected';
        });
    });
    // Sign in opens outside the card: a host is asked to open it (a sandboxed card cannot open a page itself, and
    // following the link would put the sign-in page where the reading was). With no host it is an ordinary link.
    $('.rise-settings__account').addEventListener('click', event => {
        if (typeof port?.openLink !== 'function') return;
        event.preventDefault();
        port.openLink(event.currentTarget.href).catch(() => {});
    });
    for (const chip of sizes) {
        chip.addEventListener('change', () => { if (chip.checked) choose('fontSize', chip.value); });
    }

    play.addEventListener('click', () => {
        if (runtime.status === 'ended') { onPlayAgain(); return; }
        if (runtime.status === 'interrupted') { runtime.resume(); return; }
        if (runtime.status === 'live') void runtime.interrupt().catch(() => {});
    });

    let stopHostContext = null;
    const repaint = () => { if (!destroyed) render(runtime.snapshot()); };
    if (full) {
        back.addEventListener('click', () => { if (enabled(back)) seek({ delta: -1 }); });
        forward.addEventListener('click', () => { if (enabled(forward)) seek({ delta: 1 }); });
        replay.addEventListener('click', () => {
            if (!enabled(replay)) return;
            try { runtime.replay(); } catch { /* nothing to say again */ }
        });
        pace.addEventListener('click', () => {
            const now = runtime.snapshot().pace ?? 1;
            const at = PACES.indexOf(now);
            setPace(at < 0 ? PACES.find(value => value > now) ?? PACES[0] : PACES[(at + 1) % PACES.length]);
        });
        fullscreen.addEventListener('click', () => {
            const shown = display();
            if (!shown) return;
            // Asked at once, inside the press: a browser gives full screen only to a page the reader has just used.
            try { Promise.resolve(shown.toggle()).catch(() => {}).then(repaint); } catch { /* the host or browser said no */ }
        });
        // Heard on the stage only, never the document; never from the sheet's controls or a field for words.
        root.addEventListener('keydown', event => {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
            const target = event.target;
            if (sheet.contains(target) || target.closest?.('input, select, textarea, [contenteditable]:not([contenteditable="false"])')) return;
            let act;
            switch (event.key) {
                // On an object, Space is that object's own press.
                case ' ': if (target.closest?.('button')) return; act = () => play.click(); break;
                case 'ArrowLeft': act = () => back.click(); break;
                case 'ArrowRight': act = () => forward.click(); break;
                case 'r': case 'R': act = () => replay.click(); break;
                case 'f': case 'F': if (fullscreen.hidden) return; act = () => fullscreen.click(); break;
                case '-': case '_': case '[': act = () => stepPace(-1); break;
                case '=': case '+': case ']': act = () => stepPace(1); break;
                default: return;
            }
            event.preventDefault();
            act();
        });
        stopHostContext = port?.onHostContext?.(repaint) ?? null;
        doc.addEventListener('fullscreenchange', repaint);
    }

    const off = runtime.subscribe(render);
    render(runtime.snapshot());

    return {
        element: root,
        destroy() {
            if (destroyed) return;
            destroyed = true;
            clearTimeout(barTimer);
            doc.removeEventListener('pointerdown', outside);
            doc.removeEventListener('pointermove', showBar);
            doc.removeEventListener('pointerdown', showBar);
            doc.removeEventListener('fullscreenchange', repaint);
            stopHostContext?.();
            off();
            root.remove();
        }
    };
}
