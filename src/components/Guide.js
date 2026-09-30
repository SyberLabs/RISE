/**
 * Guide — how RISE works, in the words the rest of the product uses.
 *
 * A plain overlay: one heading, four short sections, a close button. The
 * room names match the navigation (Home, Library, Sequences, Compose,
 * Reader); an ornament, numbered eyebrows and roman numerals were deleted.
 */
import './Guide.css';

const ICON = 'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';

export class Guide {
  constructor(container, options = {}) {
    this.container = container;
    this.onClose = options.onClose || (() => { });

    this.render();
    this.attachEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="guide-overlay" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <div class="guide-modal">
          <header class="guide-header">
            <div>
              <h1 id="guide-title" class="guide-title">Guide</h1>
              <p class="guide-subtitle">How to use RISE</p>
            </div>
            <button class="guide-close" type="button" aria-label="Close guide"><svg ${ICON}><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>
          </header>

          <div class="guide-content" tabindex="0" role="region" aria-label="Guide contents">
            <section class="guide-section">
              <h2 class="section-title">What RISE is</h2>
              <p>RISE is an audiovisual reader: a place to read dense texts with pacing, sound, and chosen images around the words.</p>
              <p>A reading is a designed session rather than a scroll. Sound, images, and text are timed together, in your browser.</p>
            </section>

            <section class="guide-section">
              <h2 class="section-title">Where things are</h2>
              <dl class="workflow-steps">
                <div class="step">
                  <dt>Home</dt>
                  <dd>Ask Jev for a reading, or continue the last one when there is one.</dd>
                </div>
                <div class="step">
                  <dt>Library</dt>
                  <dd>Works in named editions, texts written for RISE, and files you keep on this device.</dd>
                </div>
                <div class="step">
                  <dt>Compose</dt>
                  <dd>Combine text sources, set the reading pace and visuals, then save your composition.</dd>
                </div>
                <div class="step">
                  <dt>Reader</dt>
                  <dd>Readings open here. Some start right away; others let you adjust pace and visuals first. Leaving returns you to where you opened the reading.</dd>
                </div>
                <div class="step">
                  <dt>Sequences</dt>
                  <dd>Sequences are prepared readings. Try RISE opens three sample readings without a setup step.</dd>
                </div>
                <div class="step">
                  <dt>Chapel</dt>
                  <dd>Read the Douay-Rheims Bible, or follow a Rosary or Stations session with sacred art.</dd>
                </div>
              </dl>
            </section>

            <section class="guide-section">
              <h2 class="section-title">Reading controls</h2>
              <dl class="mechanics-list">
                <div><dt>Speed</dt><dd>Words per minute sets the baseline pace.</dd></div>
                <div><dt>Pace curve</dt><dd>Changes the speed over time: <em>Induction</em> starts slow, <em>Wave</em> rises and falls.</dd></div>
                <div><dt>Visuals</dt><dd>The field around the text: a still <em>Focal</em> image, an orbiting <em>Attractor</em> (Aizawa, Thomas, Halvorsen), or <em>Rhythmic</em> interruptions drawn from patterns and museum collections.</dd></div>
                <div><dt>Living response</dt><dd>Optionally let the text lead the visuals: its emotional arc tints the words (<em>Living Text</em>) and shapes the timing and palette of interruptions (<em>Responsive Presence</em>).</dd></div>
                <div><dt>Sound</dt><dd>Tones, drones, and ambient layers you can set for each session.</dd></div>
              </dl>
            </section>

            <section class="guide-section">
              <h2 class="section-title">Keyboard shortcuts</h2>
              <dl class="shortcuts-grid">
                <div class="shortcut"><dt><kbd>Esc</kbd></dt><dd>Go back Home</dd></div>
                <div class="shortcut"><dt><kbd>Space</kbd></dt><dd>Pause or resume the reading</dd></div>
                <div class="shortcut"><dt><kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Change reading speed in the Reader</dd></div>
              </dl>
            </section>
          </div>
        </div>
      </div>
    `;
  }

  attachEvents() {
    const closeBtn = this.container.querySelector('.guide-close');
    const overlay = this.container.querySelector('.guide-overlay');
    
    closeBtn.addEventListener('click', () => this.onClose());
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.onClose();
      }
    });

    this._keyboardHandler = (e) => {
      if (e.key === 'Escape') {
        this.onClose();
      }
    };
    document.addEventListener('keydown', this._keyboardHandler);
    // Focus starts inside the dialog, on its one control.
    closeBtn.focus({ preventScroll: true });
  }

  destroy() {
    document.removeEventListener('keydown', this._keyboardHandler);
  }
}
