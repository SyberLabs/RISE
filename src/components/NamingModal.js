/**
 * R.I.S.E. Premium Naming Modal
 * A glassmorphic, promise-based interface for asset labeling
 */
export class NamingModal {
  constructor() {
    this.container = null;
    this.resolve = null;
    this.reject = null;
    this._injectStyles();
  }

  _injectStyles() {
    if (document.getElementById('naming-modal-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'naming-modal-styles';
    style.textContent = `
      .naming-modal-overlay {
        --modal-bg: var(--color-void, var(--void, #0A0A0C));
        --modal-depth: var(--color-depth, var(--void-surface, #1A1A1E));
        --modal-accent: var(--color-threshold, var(--accent, #8B7FD4));
        --modal-text: var(--color-light, var(--glow, #E8E8EC));
        --modal-shadow: var(--color-shadow, var(--void-elevated, #2A2A30));
        
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(10, 10, 12, 0.85); 
        backdrop-filter: blur(8px);
        z-index: 20000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        animation: naming-modal-fade-in 0.3s forwards cubic-bezier(0.2, 0, 0.2, 1);
      }

      .naming-modal {
        width: 100%;
        max-width: 440px;
        background: rgba(26, 26, 30, 0.7);
        border: 1px solid rgba(139, 127, 212, 0.4);
        box-shadow: 0 0 40px rgba(0, 0, 0, 0.6), 0 0 100px rgba(139, 127, 212, 0.1);
        padding: 48px;
        transform: translateY(20px) scale(0.98);
        animation: naming-modal-slide-up 0.4s forwards cubic-bezier(0.16, 1, 0.3, 1);
        display: flex;
        flex-direction: column;
        gap: 32px;
        position: relative;
        overflow: hidden;
      }

      .naming-modal::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent);
        animation: naming-modal-sheen 8s infinite linear;
      }

      .naming-modal-header {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .naming-modal-title {
        font-family: var(--font-display, serif);
        font-size: 24px;
        color: var(--modal-text);
        letter-spacing: 0.05em;
        text-transform: uppercase;
        margin: 0;
      }

      .naming-modal-subtitle {
        font-family: var(--font-primary, sans-serif);
        font-size: 12px;
        color: var(--color-fog, #999);
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      .naming-modal-body {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .naming-modal-input {
        width: 100%;
        background: rgba(10, 10, 12, 0.5);
        border: 1px solid var(--modal-shadow);
        color: var(--modal-text);
        font-family: var(--font-primary, sans-serif);
        font-size: 16px;
        padding: 16px;
        outline: none;
        transition: all 0.2s ease;
        border-radius: 2px;
      }

      .naming-modal-input:focus {
        border-color: var(--modal-accent);
        background: rgba(139, 127, 212, 0.05);
        box-shadow: 0 0 15px rgba(139, 127, 212, 0.2);
      }

      .naming-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 16px;
        margin-top: 16px;
      }

      .naming-btn {
        font-family: var(--font-primary, sans-serif);
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        padding: 12px 24px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid transparent;
      }

      .naming-btn-cancel {
        background: transparent;
        color: var(--color-fog, #999);
        border: 1px solid var(--modal-shadow);
      }

      .naming-btn-cancel:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: #666;
      }

      .naming-btn-submit {
        background: rgba(139, 127, 212, 0.2);
        color: white;
        border-color: var(--modal-accent);
      }

      .naming-btn-submit:hover {
        background: rgba(139, 127, 212, 0.4);
        box-shadow: 0 0 20px rgba(139, 127, 212, 0.3);
      }

      @keyframes naming-modal-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes naming-modal-slide-up { from { transform: translateY(20px) scale(0.98); } to { transform: translateY(0) scale(1); } }
      @keyframes naming-modal-sheen { 0% { left: -100%; } 20% { left: 100%; } 100% { left: 100%; } }
    `;
    document.head.appendChild(style);
  }

  /**
   * Show the naming modal
   * @param {string} defaultValue - Initial text in the input
   * @param {string} title - Modal title
   * @param {string} subtitle - Modal subtitle
   * @returns {Promise<string|null>} - Resolves with name or null if cancelled
   */
  async show(defaultValue = '', title = 'Label Asset', subtitle = 'Atmospheric Metadata') {
    // Prevent multiple modals
    if (this.container) return null;

    return new Promise((resolve) => {
      this.resolve = resolve;
      this._createModal(defaultValue, title, subtitle);
    });
  }

  _createModal(defaultValue, title, subtitle) {
    this.container = document.createElement('div');
    this.container.className = 'naming-modal-overlay';
    
    this.container.innerHTML = `
      <div class="naming-modal">
        <div class="naming-modal-header">
          <span class="naming-modal-subtitle"></span>
          <h2 class="naming-modal-title"></h2>
        </div>
        <div class="naming-modal-body">
          <input type="text" class="naming-modal-input" placeholder="Enter identifier..." spellcheck="false" autocomplete="off">
        </div>
        <div class="naming-modal-actions">
          <button class="naming-btn naming-btn-cancel" data-action="cancel">Discard</button>
          <button class="naming-btn naming-btn-submit" data-action="submit">Record</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    const input = this.container.querySelector('.naming-modal-input');
    this.container.querySelector('.naming-modal-title').textContent = String(title || '');
    this.container.querySelector('.naming-modal-subtitle').textContent = String(subtitle || '');
    input.value = String(defaultValue || '');
    const submitBtn = this.container.querySelector('[data-action="submit"]');
    const cancelBtn = this.container.querySelector('[data-action="cancel"]');

    // Auto-focus input and select text
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);

    // Event Listeners
    submitBtn.addEventListener('click', () => this._submit());
    cancelBtn.addEventListener('click', () => this._cancel());
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._submit();
      if (e.key === 'Escape') this._cancel();
    });

    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) this._cancel();
    });
  }

  _submit() {
    const name = this.container.querySelector('.naming-modal-input').value.trim();
    this._cleanup();
    this.resolve(name || null);
  }

  _cancel() {
    this._cleanup();
    this.resolve(null);
  }

  _cleanup() {
    if (this.container) {
      // Small delay for exit animation could be added here if css support it
      this.container.remove();
      this.container = null;
    }
  }
}

// Global instance helper if needed
export const namingModal = new NamingModal();
