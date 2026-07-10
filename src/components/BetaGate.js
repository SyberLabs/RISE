/**
 * BetaGate - Password-protected access for closed beta
 *
 * Features:
 * - Password protection for beta access
 * - Invite codes via URL params
 * - Custom welcome messages per invitee
 * - Session persistence (localStorage)
 */

// Beta access codes - add new invitees here
const BETA_INVITES = {
  // General beta access
  'rise2025': {
    name: 'Beta Tester',
    welcome: null // Uses default
  },

  // Personalized invites
  'maya': {
    name: 'Dr. Ackerman',
    welcome: `Welcome, Dr. Ackerman.

A personalized vault has been prepared featuring selections on computational creativity and human-AI co-creation.`,
    vault: 'vault-a',
    redirectToVault: true
  }

  // Add more personalized invites as needed
};

// Storage key for session persistence
const BETA_SESSION_KEY = 'rise-beta-session';

export class BetaGate {
  constructor(container, options = {}) {
    this.container = container;
    this.onAccess = options.onAccess || (() => {});

    // Check for invite code in URL
    this.inviteCode = this.getInviteFromURL();

    // Check if already authenticated
    this.session = this.loadSession();

    this.render();
    this.attachEvents();
  }

  getInviteFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('invite') || params.get('i');
  }

  loadSession() {
    try {
      const stored = localStorage.getItem(BETA_SESSION_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('[BetaGate] Failed to load session:', e);
    }
    return null;
  }

  saveSession(inviteData, code) {
    try {
      const session = {
        code,
        name: inviteData.name,
        vault: inviteData.vault || null,
        timestamp: Date.now()
      };
      localStorage.setItem(BETA_SESSION_KEY, JSON.stringify(session));
      this.session = session;
    } catch (e) {
      console.error('[BetaGate] Failed to save session:', e);
    }
  }

  clearSession() {
    localStorage.removeItem(BETA_SESSION_KEY);
    this.session = null;
  }

  validateCode(code) {
    const normalizedCode = code.toLowerCase().trim();
    return BETA_INVITES[normalizedCode] || null;
  }

  render() {
    // Check if already authenticated
    if (this.session) {
      // If there's a URL invite code, ensure the session has the vault from that invite
      // This handles cases where user bookmarked the personalized link
      if (this.inviteCode) {
        const inviteData = this.validateCode(this.inviteCode);
        if (inviteData && inviteData.vault && this.session.vault !== inviteData.vault) {
          // Update session with vault from URL invite
          this.session.vault = inviteData.vault;
          localStorage.setItem(BETA_SESSION_KEY, JSON.stringify(this.session));
        }
      }
      this.onAccess(this.session);
      this.container.innerHTML = '';
      return;
    }

    // Check for URL invite code
    const inviteData = this.inviteCode ? this.validateCode(this.inviteCode) : null;
    const hasValidInvite = !!inviteData;

    this.container.innerHTML = `
      <div class="beta-gate">
        <div class="beta-gate-content">
          <!-- Sigil -->
          <div class="beta-sigil">◇</div>

          <!-- Title -->
          <h1 class="beta-title">R.I.S.E.</h1>
          <p class="beta-subtitle">Recursive Installation of Symbolic Experience</p>

          ${hasValidInvite ? this.renderPersonalizedWelcome(inviteData) : this.renderCodeEntry()}
        </div>

        <!-- Footer -->
        <div class="beta-footer">
          <p>Closed Beta · v2.0</p>
        </div>
      </div>
    `;
  }

  renderCodeEntry() {
    return `
      <div class="beta-form">
        <p class="beta-prompt">Enter access code to continue</p>

        <input
          type="text"
          id="beta-code-input"
          class="beta-input"
          placeholder="Access code"
          autocomplete="off"
          spellcheck="false"
        />

        <p id="beta-error" class="beta-error" hidden>Invalid access code</p>
      </div>
    `;
  }

  renderPersonalizedWelcome(inviteData) {
    const welcomeText = inviteData.welcome || `Welcome to R.I.S.E., ${inviteData.name}.

You have been invited to experience the closed beta of this audiovisual reading environment.

A space has been prepared for you.`;

    return `
      <div class="beta-welcome">
        <div class="beta-welcome-text">
          ${welcomeText.split('\n\n').map(p => `<p>${p}</p>`).join('')}
        </div>

        <button id="beta-enter" class="beta-enter-btn">
          Enter the Space
        </button>
      </div>
    `;
  }

  attachEvents() {
    // Code submission (Enter key only - no button)
    const input = this.container.querySelector('#beta-code-input');
    const errorEl = this.container.querySelector('#beta-error');

    if (input) {
      const handleSubmit = () => {
        const code = input.value;
        const inviteData = this.validateCode(code);

        if (inviteData) {
          this.saveSession(inviteData, code.toLowerCase().trim());
          this.onAccess(this.session);
        } else {
          errorEl.hidden = false;
          input.classList.add('error');
          input.focus();

          // Clear error after delay
          setTimeout(() => {
            errorEl.hidden = true;
            input.classList.remove('error');
          }, 3000);
        }
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSubmit();
      });

      // Focus input
      setTimeout(() => input.focus(), 100);
    }

    // Personalized welcome entry
    const enterBtn = this.container.querySelector('#beta-enter');
    if (enterBtn && this.inviteCode) {
      enterBtn.addEventListener('click', () => {
        const inviteData = this.validateCode(this.inviteCode);
        if (inviteData) {
          this.saveSession(inviteData, this.inviteCode.toLowerCase().trim());
          this.onAccess(this.session);
        }
      });
    }
  }

  destroy() {
    this.container.innerHTML = '';
  }
}

// Export invite codes for testing
export { BETA_INVITES };
