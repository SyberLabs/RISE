export const VISUAL_CONSENT_KEY = 'rise-visual-interlocution-consent';

let pendingConsent = null;
let activeSessionConsent = false;
let acceptedLaunchConsent = false;

// Retire the former browser-session grant. Consent is now a one-use,
// in-memory capability and must never be resurrected by a reload.
try { sessionStorage.removeItem(VISUAL_CONSENT_KEY); } catch { /* unavailable */ }

export function hasVisualInterlocutionConsent() {
    return activeSessionConsent || acceptedLaunchConsent;
}

/**
 * Convert an accepted warning into a capability owned by one chamber
 * session. The one-use launch grant is consumed so the next session must
 * establish consent again, while the cortex can continue checking the active
 * capability before every flash.
 */
export function beginVisualInterlocutionSession() {
    if (!hasVisualInterlocutionConsent()) return false;
    activeSessionConsent = true;
    acceptedLaunchConsent = false;
    try { sessionStorage.removeItem(VISUAL_CONSENT_KEY); } catch { /* unavailable */ }
    return true;
}

/** Revoke the session capability and cancel any orphaned visible prompt. */
export function endVisualInterlocutionSession() {
    activeSessionConsent = false;
    acceptedLaunchConsent = false;
    try { sessionStorage.removeItem(VISUAL_CONSENT_KEY); } catch { /* unavailable */ }
    pendingConsent?.cancel?.();
    document.getElementById('photosensitivity-modal')?.classList.add('hidden');
}

export function grantVisualInterlocutionConsent() {
    acceptedLaunchConsent = true;
    try { sessionStorage.removeItem(VISUAL_CONSENT_KEY); } catch { /* unavailable */ }
    return true;
}

export function requestVisualInterlocutionConsent() {
    if (hasVisualInterlocutionConsent()) return Promise.resolve(true);
    if (document.documentElement.classList.contains('photosensitivity-mode')) {
        return Promise.resolve(false);
    }
    if (pendingConsent) return pendingConsent.promise;

    const modal = document.getElementById('photosensitivity-modal');
    const cancelButton = document.getElementById('safety-cancel');
    const accept = document.getElementById('safety-accept');
    if (!modal || !cancelButton || !accept) return Promise.resolve(false);

    let cancelPrompt = null;
    const promise = new Promise(resolve => {
        const controller = new AbortController();
        let settled = false;
        const finish = accepted => {
            if (settled) return;
            settled = true;
            if (accepted) grantVisualInterlocutionConsent();
            modal.classList.add('hidden');
            controller.abort();
            pendingConsent = null;
            resolve(accepted);
        };
        cancelPrompt = () => finish(false);
        const options = { signal: controller.signal };
        cancelButton.addEventListener('click', () => finish(false), options);
        accept.addEventListener('click', () => finish(true), options);
        modal.addEventListener('click', event => {
            if (event.target === modal) finish(false);
        }, options);
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') finish(false);
        }, options);

        modal.classList.remove('hidden');
        cancelButton.focus();
    });
    pendingConsent = { promise, cancel: () => cancelPrompt?.() };
    return promise;
}

export class VisualFlashGate {
    constructor({ minIntervalMs = 180, burstWindowMs = 1200, maxBurst = 3 } = {}) {
        this.minIntervalMs = minIntervalMs;
        this.burstWindowMs = burstWindowMs;
        this.maxBurst = maxBurst;
        this.history = [];
    }

    reset() {
        this.history = [];
    }

    allow(now = performance.now()) {
        this.history = this.history.filter(timestamp => now - timestamp < this.burstWindowMs);
        const last = this.history[this.history.length - 1];
        if (last !== undefined && now - last < this.minIntervalMs) return false;
        if (this.history.length >= this.maxBurst) return false;
        this.history.push(now);
        return true;
    }
}
