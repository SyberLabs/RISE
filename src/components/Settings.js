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

export class Settings {
    constructor(container, options = {}) {
        this.container = container;
        this.settings = options.settings || {};
        this.onNavigate = options.onNavigate || (() => { });
        this.onChange = options.onChange || (() => { });

        this.render();
        this.attachEvents();
    }

    render() {
        this.container.innerHTML = `
      <div class="settings" role="main" aria-labelledby="settings-title">
        <a href="#settings-content" class="skip-link">Skip to settings</a>

        <!-- Header -->
        <header class="settings-header">
          <button class="btn-ghost" data-action="back" aria-label="Back to Portal">
            <span class="icon">←</span>
            <span>Portal</span>
          </button>
        </header>

        <!-- Content -->
        <div class="settings-content" id="settings-content">
          <h1 id="settings-title" class="settings-title text-light">Settings</h1>

          <!-- Display Section -->
          <section class="settings-section" aria-labelledby="display-heading">
            <h2 id="display-heading" class="settings-section-title text-fog">Display</h2>

            <div class="settings-row">
              <label class="settings-label" for="font-size">Font Size</label>
              <div class="settings-control slider-container">
                <input
                  type="range"
                  id="font-size"
                  class="slider"
                  min="0"
                  max="2"
                  value="${this.getFontSizeValue()}"
                  aria-valuetext="${this.settings.fontSize || 'medium'}"
                />
                <span class="slider-value text-capitalize" id="font-size-value">
                  ${this.settings.fontSize || 'medium'}
                </span>
              </div>
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
          </section>

          <!-- Audio Section -->
          <section class="settings-section" aria-labelledby="audio-heading">
            <h2 id="audio-heading" class="settings-section-title text-fog">Audio</h2>

            <div class="settings-row">
              <label class="settings-label">Enable Ambient</label>
              <label class="toggle">
                <input
                  type="checkbox"
                  data-setting="enableAmbient"
                  ${this.settings.enableAmbient ? 'checked' : ''}
                />
                <span class="toggle-switch"></span>
              </label>
            </div>

            <div class="settings-row">
              <label class="settings-label" for="master-volume">Master Volume</label>
              <div class="settings-control slider-container">
                <input
                  type="range"
                  id="master-volume"
                  class="slider"
                  min="0"
                  max="100"
                  value="${Math.round((this.settings.masterVolume || 0.75) * 100)}"
                  aria-valuenow="${Math.round((this.settings.masterVolume || 0.75) * 100)}"
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
                <span class="slider-value font-mono" id="volume-value">
                  ${Math.round((this.settings.masterVolume || 0.75) * 100)}%
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
          <section class="settings-section" aria-labelledby="data-heading">
            <h2 id="data-heading" class="settings-section-title text-fog">Data</h2>

            <div class="settings-row">
              <button class="btn-secondary" data-action="export-data">
                Export Personal Data
              </button>
            </div>

            <div class="settings-row">
              <button class="btn-secondary btn-caution" data-action="clear-history">
                Clear Session History
              </button>
            </div>
          </section>

          <!-- About Section -->
          <section class="settings-section settings-about" aria-labelledby="about-heading">
            <h2 id="about-heading" class="settings-section-title text-fog">About</h2>

            <div class="about-content text-fog">
              <p class="about-version font-mono">R.I.S.E. v2.0</p>
              <p class="about-tagline">An experimental audiovisual reading interface.</p>
              <p class="about-attribution text-mist">SyberLabs · 2026</p>
            </div>
          </section>
        </div>
      </div>
    `;
    }

    getFontSizeValue() {
        const sizes = ['small', 'medium', 'large'];
        return sizes.indexOf(this.settings.fontSize || 'medium');
    }

    attachEvents() {
        // Back button
        this.container.querySelector('[data-action="back"]')?.addEventListener('click', () => {
            this.onNavigate('portal');
        });

        // Toggle checkboxes
        this.container.querySelectorAll('[data-setting]').forEach(input => {
            input.addEventListener('change', (e) => {
                const setting = e.target.dataset.setting;
                const value = e.target.checked;
                this.settings[setting] = value;
                this.onChange(setting, value);
            });
        });

        // Font size slider
        const fontSizeSlider = this.container.querySelector('#font-size');
        const fontSizeValue = this.container.querySelector('#font-size-value');
        fontSizeSlider?.addEventListener('input', (e) => {
            const sizes = ['small', 'medium', 'large'];
            const size = sizes[parseInt(e.target.value)];
            fontSizeValue.textContent = size;
            e.target.setAttribute('aria-valuetext', size);
            this.settings.fontSize = size;
            this.onChange('fontSize', size);
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

        // Keyboard
        document.addEventListener('keydown', this.handleKeyboard.bind(this));
    }

    handleKeyboard(e) {
        if (e.key === 'Escape') {
            this.onNavigate('portal');
        }
    }

    // All localStorage keys holding user-generated content.
    // Settings and the beta session are intentionally separate.
    static USER_DATA_KEYS = {
        journals: 'rise_recursions_v1',
        blueprints: 'rise_workshop_v1',
        globalImages: 'rise_global_images_v1'
    };

    exportData() {
        try {
            const data = {
                settings: this.settings,
                exportedAt: new Date().toISOString(),
                version: '2.0'
            };

            // Export every store that holds user-generated content
            for (const [label, key] of Object.entries(Settings.USER_DATA_KEYS)) {
                const raw = localStorage.getItem(key);
                if (raw) {
                    try {
                        data[label] = JSON.parse(raw);
                    } catch {
                        data[label] = raw;
                    }
                }
            }

            // Create download
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rise-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);

            this.showToast('Data exported successfully');
        } catch (e) {
            console.error('[Settings] Export failed:', e);
            this.showToast('Export failed');
        }
    }

    clearHistory() {
        const confirm = window.confirm('Clear all session history? This deletes your journals, saved sequences, and uploaded images. This cannot be undone.');
        if (!confirm) return;

        try {
            for (const key of Object.values(Settings.USER_DATA_KEYS)) {
                localStorage.removeItem(key);
            }
            this.showToast('Session history cleared');
        } catch (e) {
            console.error('[Settings] Clear history failed:', e);
        }
    }

    showToast(message) {
        // Use global app toast if available
        if (window.rise?.showToast) {
            window.rise.showToast(message);
        } else {
            console.log('[Settings]', message);
        }
    }

    destroy() {
        document.removeEventListener('keydown', this.handleKeyboard.bind(this));
    }
}

export default Settings;
