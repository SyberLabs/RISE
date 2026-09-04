import { clearUserData, exportUserData } from '../core/user-data.js';
import { CHAMBER_STREAM_FACES, resolveChamberStreamFace } from '../core/chamber-stream-face.js';
import {
    CHAMBER_ACCENTS,
    CHAMBER_ACCENT_TOKENS,
    resolveChamberAccent
} from '../core/chamber-accent.js';
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
 * inside a reading is not the panel they visit from the Portal. It carries
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
 * The Chamber's door opened the Portal's panel over the whole screen, and
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
 * Face and Accent are the One Type editor's and the Portal's: changing a
 * typeface mid-sentence is not a rescue, it is a decision made too late.
 */
const BAR_SCOPE = 'bar';

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

    render() {
        if (this.inBar) return this.renderBar();
        const backLabel = this.onClose ? 'Back' : 'Portal';
        const backAria = this.onClose ? 'Back' : 'Back to Portal';
        this.container.innerHTML = `
      <form class="settings" role="main" aria-labelledby="settings-title">
        <a href="#settings-content" class="skip-link">Skip to settings</a>

        <!-- Header -->
        <header class="settings-header">
          <button type="button" class="btn-ghost" data-action="back" aria-label="${backAria}">
            <span class="icon">←</span>
            <span>${backLabel}</span>
          </button>
        </header>

        <!-- Content -->
        <div class="settings-content" id="settings-content">
          <h1 id="settings-title" class="settings-title text-light">Settings</h1>

          <!-- Display Section -->
          <section class="settings-section" aria-labelledby="display-heading">
            <h2 id="display-heading" class="settings-section-title text-fog">Display</h2>

            <div class="settings-row">
              <div class="settings-label-group">
                <span class="settings-label" id="font-size-label">Size</span>
                <p class="settings-hint text-mist" id="font-size-hint" ${resolveFontSize(this.settings.fontSize) === 'fit' ? '' : 'hidden'}>
                  ${this.fontSizeHint()}
                </p>
              </div>
              <div class="settings-control" role="radiogroup" aria-labelledby="font-size-label">
                ${this.renderFontSizeRadios()}
              </div>
            </div>

            <div class="settings-row">
              <div class="settings-label-group">
                <span class="settings-label" id="chamber-face-label">Chamber face</span>
                <p class="settings-hint text-mist">Live Chamber stream only.</p>
              </div>
              <div class="settings-control" role="radiogroup" aria-labelledby="chamber-face-label">
                ${this.renderChamberFaceRadios()}
                <p class="settings-fail" id="chamber-face-fail" hidden>Face did not take.</p>
              </div>
            </div>

            <div class="settings-row">
              <div class="settings-label-group">
                <span class="settings-label" id="chamber-accent-label">Accent</span>
              </div>
              <div class="settings-control" role="radiogroup" aria-labelledby="chamber-accent-label">
                ${this.renderChamberAccentRadios()}
                <p class="settings-fail" id="chamber-accent-fail" hidden>Accent did not take.</p>
              </div>
            </div>

            <div class="settings-row">
              <div class="settings-label-group">
                <label class="settings-label">Mask</label>
                <p class="settings-hint text-mist">
                  Same as PREP → Presentation → Gallery in the word.
                  Thick Word stream. Glass stays off. Phrase and sentence are unchanged.
                </p>
              </div>
              <label class="toggle">
                <input
                  type="checkbox"
                  data-setting="chamberMask"
                  ${this.settings.chamberMask === true ? 'checked' : ''}
                />
                <span class="toggle-switch"></span>
              </label>
            </div>

            <div class="settings-row">
              <label class="settings-label">Show Progress</label>
              <label class="toggle">
                <input
                  type="checkbox"
                  data-setting="showProgress"
                  ${this.settings.showProgress ? 'checked' : ''}
                />
                <span class="toggle-switch"></span>
              </label>
            </div>

            <div class="settings-row">
              <label class="settings-label">Show Duration</label>
              <label class="toggle">
                <input
                  type="checkbox"
                  data-setting="showDuration"
                  ${this.settings.showDuration ? 'checked' : ''}
                />
                <span class="toggle-switch"></span>
              </label>
            </div>

            <div class="settings-row">
              <div class="settings-label-group">
                <label class="settings-label">Artwork Labels</label>
                <p class="settings-hint text-mist">
                  Show the title and artist while a sourced work is visible.
                  Credits required by a work's license always remain visible.
                </p>
              </div>
              <label class="toggle">
                <input
                  type="checkbox"
                  data-setting="showArtworkLabels"
                  ${this.settings.showArtworkLabels !== false ? 'checked' : ''}
                />
                <span class="toggle-switch"></span>
              </label>
            </div>
          </section>

          <!-- Audio Section -->
          <section class="settings-section" aria-labelledby="audio-heading">
            <h2 id="audio-heading" class="settings-section-title text-fog">Audio</h2>

            ${this.inSession ? '' : `
            <div class="settings-row">
              <div class="settings-label-group">
                <label class="settings-label">Lobby Drone</label>
                <p class="settings-hint text-mist">
                  A low drone between sessions, in the Portal and the
                  other rooms. Off by default — nothing plays until you
                  ask for it.
                </p>
              </div>
              <label class="toggle">
                <input
                  type="checkbox"
                  data-setting="enableAmbient"
                  ${this.settings.enableAmbient ? 'checked' : ''}
                />
                <span class="toggle-switch"></span>
              </label>
            </div>
            `}

            <div class="settings-row">
              <label class="settings-label" for="master-volume">Master Volume</label>
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
                <span class="slider-value font-mono" id="volume-value">
                  ${Math.round((this.settings.masterVolume ?? 0.75) * 100)}%
                </span>
              </div>
            </div>

            <div class="settings-row">
              <label class="settings-label">Enable Binaural</label>
              <label class="toggle">
                <input
                  type="checkbox"
                  data-setting="enableBinaural"
                  ${this.settings.enableBinaural ? 'checked' : ''}
                />
                <span class="toggle-switch"></span>
              </label>
            </div>
          </section>

          <!-- Safety Section -->
          <section class="settings-section" aria-labelledby="safety-heading">
            <h2 id="safety-heading" class="settings-section-title text-fog">Safety</h2>

            <div class="settings-row">
              <div class="settings-label-group">
                <label class="settings-label">Photosensitivity Mode</label>
                <span class="settings-hint text-mist">Disables all brightness oscillation</span>
              </div>
              <label class="toggle">
                <input
                  type="checkbox"
                  data-setting="photosensitivityMode"
                  ${this.settings.photosensitivityMode ? 'checked' : ''}
                />
                <span class="toggle-switch"></span>
              </label>
            </div>

            <div class="settings-row">
              <div class="settings-label-group">
                <label class="settings-label">Reduced Motion</label>
                <span class="settings-hint text-mist">Minimizes animations throughout</span>
              </div>
              <label class="toggle">
                <input
                  type="checkbox"
                  data-setting="reducedMotion"
                  ${this.settings.reducedMotion ? 'checked' : ''}
                />
                <span class="toggle-switch"></span>
              </label>
            </div>
          </section>

          <!-- Data Section -->
          ${this.inSession ? '' : `
          <section class="settings-section" aria-labelledby="data-heading">
            <h2 id="data-heading" class="settings-section-title text-fog">Data</h2>

            <div class="settings-row">
              <button class="btn-secondary" data-action="export-data">
                Export Personal Data
              </button>
            </div>

            <div class="settings-row settings-danger">
              <div class="settings-label-group">
                <p class="settings-hint text-mist">
                  Removes every reading, sequence, and preference held in this
                  browser. There is no copy elsewhere — export first if you
                  want one.
                </p>
                <button class="btn-secondary btn-caution" data-action="clear-history">
                  Clear All Personal Data
                </button>
              </div>
            </div>
          </section>

          <!-- About Section -->
          <section class="settings-section settings-about" aria-labelledby="about-heading">
            <h2 id="about-heading" class="settings-section-title text-fog">About</h2>

            <div class="about-content text-fog">
              <p class="about-version font-mono">RISE v2.0</p>
              <p class="about-tagline">An experimental audiovisual reading interface.</p>
              <p class="about-attribution text-mist">SyberLabs · 2026</p>
            </div>
          </section>
          `}
        </div>
      </form>
    `;
    }

    /** The reading's own controls, at the size the reading can spare. */
    renderBar() {
        const volume = Math.round((this.settings.masterVolume ?? 0.75) * 100);
        const size = resolveFontSize(this.settings.fontSize);
        this.container.innerHTML = `
      <form class="settings settings--bar" role="dialog" aria-labelledby="settings-title">
        <header class="settings-bar-head">
          <h1 id="settings-title" class="settings-bar-title">Settings</h1>
          <button type="button" class="settings-bar-close" data-action="back" aria-label="Close">✕</button>
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
            ${FONT_SIZE_CHIPS.filter(chip => chip.fontSize !== 'fit').map(chip => `
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
                { key: 'reducedMotion', label: 'Reduced Motion', hint: 'Fewer animations' }
            ].map(row => `
            <div class="settings-row">
              <div class="settings-label-group">
                <label class="settings-label">${row.label}</label>
                <p class="settings-hint text-mist">${row.hint}</p>
              </div>
              <label class="toggle">
                <input type="checkbox" data-setting="${row.key}" ${this.settings[row.key] ? 'checked' : ''} />
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

    renderFontSizeRadios() {
        const selected = resolveFontSize(this.settings.fontSize);
        return FONT_SIZE_CHIPS.map((chip) => `
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

    /**
     * A COLOUR PICKER HAS TO SHOW THE COLOUR. These eleven read as words with
     * eleven identical grey rings — the ring paints from --color-accent, the
     * one already in force, so every option wore the same hue and none wore
     * its own. Each chip now carries its real token, and the default carries
     * both halves of what it actually is: a slate surface under ivory.
     */
    renderChamberAccentRadios() {
        const selected = resolveChamberAccent(this.settings.chamberAccent);
        return CHAMBER_ACCENTS.map((accent) => {
            const hue = CHAMBER_ACCENT_TOKENS[accent.id]?.['--color-accent'];
            const swatch = hue
                ? `--swatch: ${hue}; --swatch-far: ${hue}`
                : '--swatch: #2A2A30; --swatch-far: #E4D2AE';
            return `
          <label class="radio radio-swatch" style="${swatch}">
            <input
              type="radio"
              name="chamber-accent"
              value="${accent.id}"
              ${accent.id === selected ? 'checked' : ''}
            />
            <span class="radio-label">${accent.label}</span>
          </label>
        `;
        }).join('');
    }

    leave() {
        if (this.onClose) this.onClose();
        else this.onNavigate('portal');
    }

    attachEvents() {
        this.container.querySelector('form.settings')?.addEventListener('submit', (e) => {
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

        this.container.querySelectorAll('input[name="chamber-accent"]').forEach((input) => {
            input.addEventListener('change', (e) => {
                const requested = e.target.value;
                if (resolveChamberAccent(requested) !== requested) return;
                this.settings.chamberAccent = requested;
                this.onChange('chamberAccent', requested);
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

        // Data actions
        this.container.querySelector('[data-action="export-data"]')?.addEventListener('click', () => {
            this.exportData();
        });

        this.container.querySelector('[data-action="clear-history"]')?.addEventListener('click', () => {
            this.clearHistory();
        });

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
            this.showToast('Personal data cleared. Reloadingâ€¦');
            this.onDataCleared();
        } catch (e) {
            console.error('[Settings] Clear data failed:', e);
            this.showToast('Some browser data could not be cleared');
        }
    }

    showToast(message) {
        this.notify(message);
    }

    activate() {
        if (this._active) return;
        this._active = true;
        document.addEventListener('keydown', this.boundKeyboardHandler);
    }

    deactivate() {
        if (!this._active) return;
        this._active = false;
        document.removeEventListener('keydown', this.boundKeyboardHandler);
    }

    destroy() {
        this.deactivate();
    }
}

export default Settings;
