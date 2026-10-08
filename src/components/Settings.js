import { clearUserData, exportUserData } from '../core/user-data.js';
import { PLUS_PAYMENT_LINK, PLUS_PRICE, forgetPlus, plusAllowance, plusState } from '../app/plus.js';
import { CHAMBER_STREAM_FACES, resolveChamberStreamFace } from '../core/chamber-stream-face.js';
import { roomHeader, roomIcon } from './room-chrome.js';
import './Settings.css';
import {
    FONT_SIZE_CHIPS,
    persistFontSize,
    resolveFontSize,
    sizeFitHint
} from '../core/chamber-type-size.js';

/**
 * Settings Component
 * Preferences and configuration interface
 *
 * Design principles (from UX spec):
 * - Dark background
 * - Generous spacing
 * - Clear section divisions
 * - Toggle/slider controls per spec
 */

/**
 * A READING CANNOT BE RESUMED ONCE ABANDONED — the exit overlay says so:
 * "The current sequence will be abandoned." So the panel a reader opens from
 * inside a reading is not the panel they visit from Home. It carries
 * what can rescue a reading in progress — the type, the chrome, the volume,
 * the two safety switches — and none of what is meaningless or destructive
 * there: the LOBBY drone does not play during a reading, and exporting or
 * CLEARING personal data mid-reading wipes the session and reloads the page.
 * The in-session surface is the control bar; this door only widens it.
 */
const SESSION_SCOPE = 'session';

/**
 * THE BAR IS THE IN-SESSION SETTINGS; THIS DOOR ONLY WIDENS IT.
 *
 * The Chamber's door opened Home's panel over the whole screen, and
 * narrowing its CONTENTS still left a full-screen replica for a handful of
 * controls. The bar scope is the honest size: what a reader can need without
 * abandoning a reading that cannot be resumed, and nothing they could have
 * decided before beginning.
 *
 *   Sound  — the ONE control the bar already carried, folded in here so the
 *            bar sheds a button rather than gaining a door beside it.
 *   Size   — S, M, L. Not Fit: Fit stands recitation and phrase chunking
 *            aside, so it changes the reading's mechanics rather than its
 *            scale, and belongs with the projection choices made beforehand.
 *   Safety — the bar's Visuals button is a blunt kill-all for the rhythmic
 *            cortex; it does nothing for brightness oscillation or a Gallery.
 *            A reader who starts feeling unwell needs the graded switch, and
 *            needs it without ending the reading.
 *
 * Face is the One Type editor's and Home's: changing a typeface
 * mid-sentence is not a rescue, it is a decision made too late. There is no
 * accent: the reading's theme is the only colour a reader sees.
 */
const BAR_SCOPE = 'bar';

/** The sizes Settings offers for every reading; XL is a reading's own choice, and Fit is Inlay's. */
const SETTINGS_SIZES = Object.freeze(['small', 'medium', 'large']);

const VOLUME_PRESETS = Object.freeze([
    Object.freeze({ value: 0, label: 'Mute' }),
    Object.freeze({ value: 50, label: '50%' }),
    Object.freeze({ value: 100, label: 'Max' })
]);

export class Settings {
    constructor(container, options = {}) {
        this.container = container;
        this.settings = options.settings || {};
        this.scope = options.scope === SESSION_SCOPE || options.scope === BAR_SCOPE
            ? options.scope
            : 'portal';

        this.onNavigate = options.onNavigate || (() => { });
        this.onClose = typeof options.onClose === 'function' ? options.onClose : null;
        this.onChange = options.onChange || (() => { });
        this.onDataCleared = options.onDataCleared || (() => { });
        this.notify = options.notify || ((message) => console.log('[Settings]', message));
        this._active = false;
        this.boundKeyboardHandler = this.handleKeyboard.bind(this);

        this.render();
        this.attachEvents();
    }

    get inSession() {
        return this.scope === SESSION_SCOPE || this.scope === BAR_SCOPE;
    }

    get inBar() {
        return this.scope === BAR_SCOPE;
    }

    settingInputId(key) {
        return `setting-${this.scope}-${key}`;
    }

    render() {
        if (this.inBar) return this.renderBar();
        const backLabel = this.onClose ? 'Back' : 'Home';
        const backAria = this.onClose ? 'Back' : 'Back to Home';
        // One main landmark per page: the full panel is the page's main
        // region; opened over a reading it sits inside the Reader's own.
        const region = this.inSession ? 'div' : 'main';
        this.container.innerHTML = `
      <div class="settings">
        <a href="#settings-content" class="skip-link">Skip to settings</a>

        ${roomHeader({ back: backLabel, backLabel: backAria, backClass: 'settings-back' })}

        <${region} class="settings-content" id="settings-content" aria-labelledby="settings-title">
          <h1 id="settings-title" class="settings-title room-title">Settings</h1>

          <form class="settings-form">
          <section class="settings-section" aria-labelledby="display-heading">
            <h2 id="display-heading" class="settings-section-title">Display</h2>

            <div class="settings-row">
              <div class="settings-label-group">
                <span class="settings-label" id="font-size-label">Text size</span>
                <p class="settings-hint" id="font-size-hint" ${resolveFontSize(this.settings.fontSize) === 'fit' ? '' : 'hidden'}>
                  ${this.fontSizeHint()}
                </p>
              </div>
              <div class="settings-control" role="radiogroup" aria-labelledby="font-size-label">
                ${this.renderFontSizeRadios()}
              </div>
            </div>

            <div class="settings-row">
              <div class="settings-label-group">
                <span class="settings-label" id="chamber-face-label">Reader typeface</span>
                <p class="settings-hint">The typeface for words in a streamed reading. Page view keeps its own.</p>
              </div>
              <div class="settings-control" role="radiogroup" aria-labelledby="chamber-face-label">
                ${this.renderChamberFaceRadios()}
                <p class="settings-fail" id="chamber-face-fail" hidden>Typeface did not take.</p>
              </div>
            </div>

            ${this.toggleRow('livingText', 'Living Text',
                'The words take a tint from the feeling of the passage they are in, in every reading.',
                this.settings.livingText !== false)}
            ${this.toggleRow('showProgress', 'Show progress',
                'A thin bar along the bottom of a reading.',
                Boolean(this.settings.showProgress))}
            ${this.toggleRow('showDuration', 'Show time',
                'Elapsed and total time in the reading controls.',
                Boolean(this.settings.showDuration))}
            ${this.toggleRow('showArtworkLabels', 'Artwork labels',
                'Title and artist while a sourced work is on screen. Credits a licence requires always stay visible.',
                this.settings.showArtworkLabels !== false)}
          </section>

          <section class="settings-section" aria-labelledby="audio-heading">
            <h2 id="audio-heading" class="settings-section-title">Sound</h2>

            <div class="settings-row">
              <label class="settings-label" for="master-volume">Volume</label>
              <div class="settings-control slider-container">
                <input
                  type="range"
                  id="master-volume"
                  class="slider"
                  min="0"
                  max="100"
                  value="${Math.round((this.settings.masterVolume ?? 0.75) * 100)}"
                  aria-valuenow="${Math.round((this.settings.masterVolume ?? 0.75) * 100)}"
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
                <span class="slider-value" id="volume-value">
                  ${Math.round((this.settings.masterVolume ?? 0.75) * 100)}%
                </span>
              </div>
            </div>

            ${this.inSession ? '' : this.plusVoiceRow()}
          </section>

          <section class="settings-section" aria-labelledby="safety-heading">
            <h2 id="safety-heading" class="settings-section-title">Safety</h2>

            ${this.toggleRow('photosensitivityMode', 'Photosensitivity mode',
                'Stops imagery from flashing or pulsing in brightness.',
                Boolean(this.settings.photosensitivityMode))}
            ${this.toggleRow('reducedMotion', 'Reduced motion',
                'Keeps animation to a minimum everywhere in RISE.',
                Boolean(this.settings.reducedMotion))}
          </section>

          ${this.inSession ? '' : `
          <section class="settings-section" aria-labelledby="affect-heading">
            <h2 id="affect-heading" class="settings-section-title">Affect</h2>

            <div class="settings-row">
              <div class="settings-label-group">
                <label class="settings-label" for="${this.settingInputId('affect')}">Emotions map</label>
                <p class="settings-hint">Where texts, colours and Living Flame scenes sit by valence, arousal and warmth.</p>
              </div>
              <label class="toggle">
                <input id="${this.settingInputId('affect')}" type="checkbox" data-affect-toggle />
                <span class="toggle-switch"></span>
              </label>
            </div>
            <div class="settings-affect" data-section="affect" hidden></div>
          </section>

          <section class="settings-section" aria-labelledby="data-heading">
            <h2 id="data-heading" class="settings-section-title">Your data</h2>

            <div class="settings-row settings-action">
              <div class="settings-label-group">
                <span class="settings-label">Export personal data</span>
                <p class="settings-hint">Downloads your journals, saved sequences, preferences and uploaded media as one JSON file.</p>
              </div>
              <button type="button" class="btn-secondary" data-action="export-data">Export</button>
            </div>

            <div class="settings-row settings-action">
              <div class="settings-label-group">
                <span class="settings-label">Clear personal data</span>
                <p class="settings-hint">
                  Removes your journals, saved sequences, preferences, uploaded media
                  and cached sources from this browser. There is no other copy, so
                  export first if you want one.
                </p>
              </div>
              <button type="button" class="btn-secondary settings-btn-danger" data-action="clear-history">Clear data</button>
            </div>
          </section>

          <section class="settings-section settings-about" aria-labelledby="about-heading">
            <h2 id="about-heading" class="settings-section-title">About</h2>

            <div class="about-content">
              <p class="about-tagline">RISE 2.0, an experimental reading interface by SyberLabs.</p>
            </div>
          </section>
          `}
          </form>
        </${region}>
      </div>
    `;
    }

    /** A setting that is on or off: its name, what it does, and the switch. */
    toggleRow(key, label, hint, checked) {
        const id = this.settingInputId(key);
        return `
            <div class="settings-row">
              <div class="settings-label-group">
                <label class="settings-label" for="${id}">${label}</label>
                <p class="settings-hint">${hint}</p>
              </div>
              <label class="toggle">
                <input id="${id}" type="checkbox" data-setting="${key}" ${checked ? 'checked' : ''} />
                <span class="toggle-switch"></span>
              </label>
            </div>`;
    }

    /**
     * The Plus voice: the way to buy it, or, once claimed in this browser,
     * its switch and the way to forget it here. A lapse the Worker reported
     * (src/app/plus.js) is said on the buying row, so the link is the way back.
     */
    plusVoiceRow() {
        const plus = plusState();
        if (!plus.claimed || plus.lapsed) {
            return `
            <div class="settings-row settings-action">
              <div class="settings-label-group">
                <span class="settings-label">Plus voice</span>
                <p class="settings-hint">A reading of your own, read aloud. ${PLUS_PRICE}.</p>
                <p class="settings-fail" ${plus.lapsed ? '' : 'hidden'}>Plus voice has lapsed.</p>
              </div>
              <a class="btn-secondary" href="${PLUS_PAYMENT_LINK}" rel="noopener">Subscribe</a>
            </div>`;
        }
        const allowance = plusAllowance();
        const used = allowance
            ? ` ${allowance.used.toLocaleString('en')} of ${allowance.limit.toLocaleString('en')} characters used this month.`
            : '';
        return `
            ${this.toggleRow('plusVoice', 'Plus voice',
                `Reads a reading of your own aloud.${used}`,
                this.settings.plusVoice !== false)}
            <div class="settings-row settings-action">
              <div class="settings-label-group">
                <span class="settings-label">Forget Plus on this browser</span>
                <p class="settings-hint">Clears the receipt this browser holds. The subscription itself stays with Stripe.</p>
              </div>
              <button type="button" class="btn-secondary" data-action="forget-plus">Forget</button>
            </div>`;
    }

    /** The reading's own controls, at the size the reading can spare. */
    renderBar() {
        const volume = Math.round((this.settings.masterVolume ?? 0.75) * 100);
        const size = resolveFontSize(this.settings.fontSize);
        this.container.innerHTML = `
      <form class="settings settings--bar" role="dialog" aria-labelledby="settings-title">
        <header class="settings-bar-head">
          <h1 id="settings-title" class="settings-bar-title">Settings</h1>
          <button type="button" class="settings-bar-close" data-action="back" aria-label="Close">${roomIcon('close')}</button>
        </header>

        <section class="settings-bar-group" aria-labelledby="bar-sound-label">
          <span class="settings-bar-label" id="bar-sound-label">Sound</span>
          <div class="settings-bar-sound">
            <input type="range" id="master-volume" class="slider" min="0" max="100"
              value="${volume}" aria-valuenow="${volume}" aria-valuemin="0" aria-valuemax="100"
              aria-labelledby="bar-sound-label" />
            <span class="slider-value font-mono" id="volume-value">${volume}%</span>
          </div>
          <div class="settings-bar-presets">
            ${VOLUME_PRESETS.map(preset => `
              <button type="button" class="settings-bar-preset" data-volume="${preset.value}">${preset.label}</button>
            `).join('')}
          </div>
        </section>

        <section class="settings-bar-group" aria-labelledby="bar-size-label">
          <span class="settings-bar-label" id="bar-size-label">Size</span>
          <div class="settings-control" role="radiogroup" aria-labelledby="bar-size-label">
            ${this.sizeChoices(size).map(chip => `
              <label class="radio">
                <input type="radio" name="font-size" value="${chip.fontSize}"
                  data-font-size="${chip.id}" ${chip.fontSize === size ? 'checked' : ''} />
                <span class="radio-label">${chip.label}</span>
              </label>
            `).join('')}
          </div>
        </section>

        <section class="settings-bar-group" aria-labelledby="bar-safety-label">
          <span class="settings-bar-label" id="bar-safety-label">Safety</span>
          ${[
                { key: 'photosensitivityMode', label: 'Photosensitivity', hint: 'No brightness oscillation' },
                { key: 'reducedMotion', label: 'Reduced motion', hint: 'Fewer animations' }
            ].map(row => `
            <div class="settings-row">
              <div class="settings-label-group">
                <label class="settings-label" for="${this.settingInputId(row.key)}">${row.label}</label>
                <p class="settings-hint text-mist">${row.hint}</p>
              </div>
              <label class="toggle">
                <input id="${this.settingInputId(row.key)}" type="checkbox" data-setting="${row.key}" ${this.settings[row.key] ? 'checked' : ''} />
                <span class="toggle-switch"></span>
              </label>
            </div>
          `).join('')}
        </section>
      </form>
    `;
    }

    fontSizeHint() {
        if (resolveFontSize(this.settings.fontSize) !== 'fit') return '';
        const atom = typeof document !== 'undefined'
            ? document.querySelector('#atom-display')
            : null;
        return sizeFitHint(Boolean((atom?.textContent || '').trim()));
    }

    /** S, M and L; a size saved beyond them (XL, or Fit from before Inlay) stays shown until another is picked. */
    sizeChoices(selected) {
        return FONT_SIZE_CHIPS.filter(chip => SETTINGS_SIZES.includes(chip.fontSize) || chip.fontSize === selected);
    }

    renderFontSizeRadios() {
        const selected = resolveFontSize(this.settings.fontSize);
        return this.sizeChoices(selected).map((chip) => `
          <label class="radio">
            <input
              type="radio"
              name="font-size"
              value="${chip.fontSize}"
              data-font-size="${chip.id}"
              ${chip.fontSize === selected ? 'checked' : ''}
            />
            <span class="radio-label">${chip.label}</span>
          </label>
        `).join('');
    }

    renderChamberFaceRadios() {
        const selected = resolveChamberStreamFace(this.settings.chamberFace);
        return CHAMBER_STREAM_FACES.map((face) => `
          <label class="radio">
            <input
              type="radio"
              name="chamber-face"
              value="${face.id}"
              ${face.id === selected ? 'checked' : ''}
            />
            <span class="radio-label">${face.label}</span>
          </label>
        `).join('');
    }

    leave() {
        if (this.onClose) this.onClose();
        else this.onNavigate('home');
    }

    attachEvents() {
        this.container.querySelector('form')?.addEventListener('submit', (e) => {
            e.preventDefault();
        });

        // Back button
        this.container.querySelector('[data-action="back"]')?.addEventListener('click', () => {
            this.leave();
        });

        this.container.querySelectorAll('[data-setting]').forEach(input => {
            input.addEventListener('change', (e) => {
                const setting = e.target.dataset.setting;
                const value = e.target.checked;
                this.settings[setting] = value;
                this.onChange(setting, value);
            });
        });

        this.container.querySelectorAll('input[name="font-size"]').forEach((input) => {
            input.addEventListener('change', (e) => {
                const persist = persistFontSize(e.target.value);
                if (!persist) return;
                this.settings.fontSize = persist;
                this.onChange('fontSize', persist);
                const hint = this.container.querySelector('#font-size-hint');
                if (hint) {
                    const text = this.fontSizeHint();
                    hint.textContent = text;
                    hint.hidden = persist !== 'fit';
                }
            });
        });

        this.container.querySelectorAll('input[name="chamber-face"]').forEach((input) => {
            input.addEventListener('change', (e) => {
                const requested = e.target.value;
                if (resolveChamberStreamFace(requested) !== requested) return;
                this.settings.chamberFace = requested;
                this.onChange('chamberFace', requested);
            });
        });

        this.container.querySelectorAll('[data-volume]').forEach((button) => {
            button.addEventListener('click', () => {
                const value = Number(button.dataset.volume);
                if (!Number.isFinite(value)) return;
                const slider = this.container.querySelector('#master-volume');
                const readout = this.container.querySelector('#volume-value');
                if (slider) slider.value = String(value);
                if (readout) readout.textContent = `${value}%`;
                this.settings.masterVolume = value / 100;
                this.onChange('masterVolume', value / 100);
            });
        });

        // Volume slider
        const volumeSlider = this.container.querySelector('#master-volume');
        const volumeValue = this.container.querySelector('#volume-value');
        volumeSlider?.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value);
            volumeValue.textContent = `${volume}%`;
            e.target.setAttribute('aria-valuenow', volume);
            this.settings.masterVolume = volume / 100;
            this.onChange('masterVolume', volume / 100);
        });

        this.container.querySelector('[data-affect-toggle]')?.addEventListener('change', (e) => {
            void this.showAffect(e.target.checked);
        });

        // Data actions
        this.container.querySelector('[data-action="export-data"]')?.addEventListener('click', () => {
            this.exportData();
        });

        this.container.querySelector('[data-action="clear-history"]')?.addEventListener('click', () => {
            this.clearHistory();
        });

        this.container.querySelector('[data-action="forget-plus"]')?.addEventListener('click', () => {
            void this.forgetPlus();
        });

    }

    /**
     * The Emotions map, below its toggle. Loaded the first time it is turned
     * on and taken down when it is turned off. Leaving Settings takes it down
     * too (`deactivate`), and returning brings it back while the toggle is on.
     */
    async showAffect(on) {
        const section = this.container.querySelector('[data-section="affect"]');
        const toggle = this.container.querySelector('[data-affect-toggle]');
        if (!section || !toggle) return;
        toggle.checked = on;
        section.hidden = !on;
        if (!on) {
            this.emotions?.destroy();
            this.emotions = null;
            section.replaceChildren();
            return;
        }
        if (this.emotions) return;
        const { Emotions } = await import('./settings/Emotions.js');
        if (!toggle.checked || this.emotions) return;
        this.emotions = new Emotions(section);
    }

    /**
     * The router's mark of a room with panes (router.js, in place): the
     * affect section is Settings' one pane, so `/settings` and `/emotions`
     * move within the room.
     */
    showPane(name, data = {}) {
        return this.update({ ...data, pane: name });
    }

    /**
     * Router entry and re-entry: `/emotions` names the affect section. A
     * room entered from elsewhere is still hidden here, so the scroll waits
     * for `activate()`.
     */
    async update(data) {
        if (data?.pane !== 'affect') return;
        await this.showAffect(true);
        this.affectScrollPending = true;
        this.scrollToAffect();
    }

    scrollToAffect() {
        const section = this.container.querySelector('[data-section="affect"]');
        if (!this.affectScrollPending || !section || section.closest('[hidden]')) return;
        this.affectScrollPending = false;
        // The whole section, so its heading and toggle are in view too.
        (section.closest('.settings-section') || section).scrollIntoView?.({ block: 'start' });
    }

    handleKeyboard(e) {
        if (e.key === 'Escape') {
            this.leave();
        }
    }

    async exportData() {
        try {
            const data = await exportUserData(this.settings);

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const revokeObjectURL = URL.revokeObjectURL.bind(URL);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rise-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            window.setTimeout(() => revokeObjectURL(url), 0);

            const withheld = Number(data.exportSummary?.withheldMedia) || 0;
            const warnings = Array.isArray(data.warnings) ? data.warnings.length : 0;
            if (withheld > 0) {
                this.showToast(`Data exported with omissions: ${withheld} media file${withheld === 1 ? '' : 's'} listed but not included`);
            } else if (warnings > 0) {
                this.showToast(`Data exported with ${warnings} warning${warnings === 1 ? '' : 's'}; review the downloaded file`);
            } else {
                this.showToast('Data exported successfully');
            }
        } catch (e) {
            console.error('[Settings] Export failed:', e);
            this.showToast('Export failed');
        }
    }

    async clearHistory() {
        const confirm = window.confirm('Clear all personal RISE data? This deletes journals, saved sequences, loaded text, uploaded images, personal audio, and cached sources. This cannot be undone.');
        if (!confirm) return;

        try {
            await clearUserData();
            this.showToast('Personal data cleared. Reloading…');
            this.onDataCleared();
        } catch (e) {
            console.error('[Settings] Clear data failed:', e);
            this.showToast('Some browser data could not be cleared');
        }
    }

    /** The panel is drawn again so the row shows the way to buy Plus. */
    async forgetPlus() {
        await forgetPlus();
        this.showToast('Plus voice forgotten on this browser.');
        this.emotions?.destroy();
        this.emotions = null;
        this.render();
        this.attachEvents();
    }

    showToast(message) {
        this.notify(message);
    }

    activate() {
        if (this._active) return;
        this._active = true;
        document.addEventListener('keydown', this.boundKeyboardHandler);
        if (this.container.querySelector('[data-affect-toggle]')?.checked) void this.showAffect(true);
        this.scrollToAffect();
    }

    deactivate() {
        if (!this._active) return;
        this._active = false;
        document.removeEventListener('keydown', this.boundKeyboardHandler);
        this.emotions?.destroy();
        this.emotions = null;
        this.container.querySelector('[data-section="affect"]')?.replaceChildren();
    }

    destroy() {
        this.deactivate();
        this.emotions?.destroy();
        this.emotions = null;
    }
}

export default Settings;
