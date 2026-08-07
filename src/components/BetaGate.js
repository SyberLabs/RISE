/**
 * BetaGate - Client-side invitation and onboarding gate
 *
 * Features:
 * - Invitation UX (not a server-side authorization boundary)
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
  'ackerman': {
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
const BETA_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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
        const candidate = JSON.parse(stored);
        const invite = candidate && typeof candidate.code === 'string'
          ? this.validateCode(candidate.code)
          : null;
        const fresh = Number.isFinite(candidate?.timestamp)
          && Date.now() - candidate.timestamp >= 0
          && Date.now() - candidate.timestamp <= BETA_SESSION_MAX_AGE_MS;
        if (invite && fresh) {
          return {
            code: candidate.code.toLowerCase().trim(),
            name: invite.name,
            vault: invite.vault || null,
            timestamp: candidate.timestamp
          };
        }
        localStorage.removeItem(BETA_SESSION_KEY);
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
          <h1 class="beta-title">RISE</h1>
          <p class="beta-subtitle">Audiovisual Reader</p>

          ${hasValidInvite ? this.renderPersonalizedWelcome(inviteData) : this.renderOpenThreshold()}
        </div>

        <!-- Footer -->
        <div class="beta-footer">
          <p>Open Beta · v2.0</p>
        </div>
      </div>
    `;
  }

  /**
   * THE DOOR IS OPEN — 2026-08-06.
   *
   * The code prompt was raised while the creator was still deciding
   * whether fast interlocution and a shelf of declassified psychotronic
   * documents could be handed to a stranger. Those questions have since
   * been answered in the work itself: the visual safety gate, the
   * consent scope, reverent degradation, a corpus reviewed by hand. The
   * gate was standing in for guarantees that now exist elsewhere.
   *
   * WHAT IS KEPT IS THE INVITE, NOT THE LOCK. A personalized code still
   * resolves to its own welcome and its own vault, because that was never
   * a barrier — it is a room prepared for someone. Removing the prompt
   * opens the front door and leaves those rooms exactly as they were.
   *
   * The threshold itself stays. It is the first breath of the piece, and
   * it is also where the audio context is unlocked by a real click.
   */
  renderOpenThreshold() {
    return `
      <div class="beta-welcome">
        <div class="beta-welcome-text">
          <p>An audiovisual reader: curated texts, paced to be entered rather than skimmed, with museum imagery and sound arranged around the words.</p>
          <p>It runs entirely in your browser. Nothing you read is sent anywhere.</p>
        </div>

        <button id="beta-enter" class="beta-enter-btn">
          Enter the Space
        </button>
      </div>
    `;
  }

  renderPersonalizedWelcome(inviteData) {
    // NO STATE OF THE BETA IN THE FALLBACK. This said "the closed beta"
    // while the footer said "Open Beta", so any invite without its own
    // `welcome` greeted its reader with a contradiction. An invitation is
    // still an invitation once the door is open — it just cannot be the
    // thing that describes the door.
    const welcomeText = inviteData.welcome || `Welcome to RISE, ${inviteData.name}.

You have been invited into this audiovisual reading environment.

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

    // Entry — for an invited reader and for anyone else. The `inviteCode`
    // guard used to be on this handler, which is why removing the prompt
    // needed this line changed too: without it the open door would render
    // a button that did nothing.
    const enterBtn = this.container.querySelector('#beta-enter');
    if (enterBtn) {
      enterBtn.addEventListener('click', () => {
        const inviteData = (this.inviteCode && this.validateCode(this.inviteCode))
          || { name: 'Reader', welcome: null };
        this.saveSession(inviteData, this.inviteCode?.toLowerCase().trim() || 'open');
        this.onAccess(this.session);
      });
    }
  }

  destroy() {
    this.container.innerHTML = '';
  }
}

// Export invite codes for testing
export { BETA_INVITES };
