import './NamingModal.css';

/**
 * The naming prompt: a promise-based system dialog for labelling an asset.
 * Its classes (.naming-modal-*) are also the dialog every Compose prompt
 * uses, so the styles live in NamingModal.css rather than in this file.
 */
export class NamingModal {
  constructor() {
    this.container = null;
    this.resolve = null;
    this.reject = null;
  }

  /**
   * Show the naming modal
   * @param {string} defaultValue - Initial text in the input
   * @param {string} title - Modal title
   * @param {string} subtitle - Modal subtitle
   * @returns {Promise<string|null>} - Resolves with name or null if cancelled
   */
  async show(defaultValue = '', title = 'Name this asset', subtitle = '') {
    // Prevent multiple modals
    if (this.container) return null;

    return new Promise((resolve) => {
      this.resolve = resolve;
      this.previousFocus = document.activeElement;
      this._createModal(defaultValue, title, subtitle);
    });
  }

  _createModal(defaultValue, title, subtitle) {
    this.container = document.createElement('div');
    this.container.className = 'naming-modal-overlay';
    
    this.container.innerHTML = `
      <div class="naming-modal" role="dialog" aria-modal="true" aria-labelledby="naming-modal-title">
        <div class="naming-modal-header">
          <span class="naming-modal-eyebrow"></span>
          <h2 class="naming-modal-title" id="naming-modal-title"></h2>
        </div>
        <label class="naming-modal-body">
          <span class="naming-modal-label">Name</span>
          <input type="text" class="naming-modal-input" spellcheck="false" autocomplete="off">
        </label>
        <div class="naming-modal-actions">
          <button type="button" class="naming-btn naming-btn-cancel" data-action="cancel">Cancel</button>
          <button type="button" class="naming-btn naming-btn-submit" data-action="submit">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    const input = this.container.querySelector('.naming-modal-input');
    this.container.querySelector('.naming-modal-title').textContent = String(title || '');
    const eyebrow = this.container.querySelector('.naming-modal-eyebrow');
    eyebrow.textContent = String(subtitle || '');
    eyebrow.hidden = !subtitle;
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
      if (e.key === 'Escape') {
        // The prompt owns Escape; the router would otherwise leave the view.
        e.stopPropagation();
        this._cancel();
      }
    });

    this.container.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const controls = [...this.container.querySelectorAll('input, button')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
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
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
    this.previousFocus = null;
  }
}

// Global instance helper if needed
export const namingModal = new NamingModal();
