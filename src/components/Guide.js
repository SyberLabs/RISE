/**
 * Guide Component
 * The "User Protocol" - onboarding and philosophical documentation.
 * 
 * Design principles:
 * - Archival/Manuscript aesthetic
 * - Structured numinosity
 * - Interactive modal experience
 */

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
          <button class="guide-close" aria-label="Close guide">✕</button>
          
          <header class="guide-header">
            <div class="guide-sigil">◊</div>
            <h1 id="guide-title" class="guide-title">User Protocol</h1>
            <p class="guide-subtitle">R.I.S.E. Operational Framework</p>
          </header>
          
          <div class="guide-content">
            <section class="guide-section">
              <h2 class="section-title">01 / Philosophical Premise</h2>
              <p>R.I.S.E. (Recursive Installation of Symbolic Experience) is an experimental reading environment for entering dense texts through pacing, sound, and procedural visuals.</p>
              <p>The goal is not passive consumption, but a designed reading session. Audio, visual, and textual streams are coordinated to create a focused browser-based experience.</p>
            </section>
            
            <section class="guide-section">
              <h2 class="section-title">02 / The Workflow</h2>
              <div class="workflow-steps">
                <div class="step">
                  <span class="step-num">Ⅰ</span>
                  <div class="step-body">
                    <strong>The Portal</strong>
                    <p>The entry point. Stillness before engagement. Use the sigil for quick access to your last state.</p>
                  </div>
                </div>
                <div class="step">
                  <span class="step-num">Ⅱ</span>
                  <div class="step-body">
                    <strong>The Library</strong>
                    <p>The repository of source material. Browse curated texts and external archives to find your focus.</p>
                  </div>
                </div>
                <div class="step">
                  <span class="step-num">Ⅲ</span>
                  <div class="step-body">
                    <strong>The Workshop</strong>
                    <p>Where content is transformed. Synthesize multiple sources into a unified sequence. Configure pacing and curves.</p>
                  </div>
                </div>
                <div class="step">
                  <span class="step-num">Ⅳ</span>
                  <div class="step-body">
                    <strong>The Chamber</strong>
                    <p>The space of the session. Fine-tune the preparation (Orbital) before descending into the reading (Immersion). A chip in the corner returns you to wherever you launched from.</p>
                  </div>
                </div>
                <div class="step">
                  <span class="step-num">Ⅴ</span>
                  <div class="step-body">
                    <strong>The Vault &amp; SOL</strong>
                    <p>Two faster doors. The Vault holds pre-configured archetypes and your saved sequences; SOL suggests sequences aligned with the hour of day, under a live solar dial.</p>
                  </div>
                </div>
                <div class="step">
                  <span class="step-num">Ⅵ</span>
                  <div class="step-body">
                    <strong>Reflections</strong>
                    <p>After each session, seal a reflection in the Synthesis stage. Everything you write is kept in the Library under Reflections — output becomes input.</p>
                  </div>
                </div>
              </div>
            </section>
            
            <section class="guide-section">
              <h2 class="section-title">03 / Interface Mechanics</h2>
              <ul class="mechanics-list">
                <li><strong>WPM (Words Per Minute):</strong> Controls the baseline speed of information delivery.</li>
                <li><strong>Temporal Curves:</strong> Modulates the speed over time (e.g., <em>Induction</em> starts slow, <em>Wave</em> pulses).</li>
                <li><strong>Visual Modes:</strong> Choose the field around the text — a still <em>Focal</em> glyph, a continuously orbiting strange <em>Attractor</em> (Aizawa, Thomas, Halvorsen), or <em>Rhythmic</em> visual interruptions drawn from procedural patterns and museum collections.</li>
                <li><strong>Living Response:</strong> Optionally let the text conduct the visuals — its emotional arc tints the text stream (<em>Living Text</em>) and shapes the timing, pattern, and palette of interruptions (<em>Responsive Flashes</em>).</li>
                <li><strong>Layered Audio:</strong> Configurable tones, drones, and atmosphere layers for session ambience.</li>
              </ul>
            </section>
            
            <section class="guide-section">
              <h2 class="section-title">04 / Keyboard Protocols</h2>
              <div class="shortcuts-grid">
                <div class="shortcut"><kbd>ESC</kbd> <span>Return to safety (Portal)</span></div>
                <div class="shortcut"><kbd>SPACE</kbd> <span>Pause / Resume session</span></div>
                <div class="shortcut"><kbd>↑/↓</kbd> <span>Adjust WPM (In-Chamber)</span></div>
              </div>
            </section>
          </div>
          
          <footer class="guide-footer">
            <p>For deep heritage, consult the <a href="/liminal_archive.html" target="_blank">Oracular Archive</a>.</p>
            <div class="guide-footer-sigil">◈</div>
          </footer>
        </div>
      </div>
    `;
  }

  attachEvents() {
    const closeBtn = this.container.querySelector('.guide-close');
    const overlay = this.container.querySelector('.guide-overlay');
    
    closeBtn.addEventListener('click', () => this.onClose());
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.onClose();
      }
    });

    // Handle ESC key
    this._keyboardHandler = (e) => {
      if (e.key === 'Escape') {
        this.onClose();
      }
    };
    document.addEventListener('keydown', this._keyboardHandler);
  }

  destroy() {
    document.removeEventListener('keydown', this._keyboardHandler);
  }
}
