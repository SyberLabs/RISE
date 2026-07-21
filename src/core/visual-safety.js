import {
    VISUAL_PRESENCE_MAX_DUTY,
    VISUAL_PRESENCE_WINDOW_MS,
    minimumVisualPresenceRest,
    normalizeVisualPresence
} from './visual-presence.js';

export const VISUAL_CONSENT_KEY = 'rise-visual-interlocution-consent';

let pendingConsent = null;
let activeSessionConsent = false;
let acceptedLaunchConsent = false;
let activeSessionConsentScope = null;
let acceptedLaunchConsentScope = null;

const DEFAULT_CONSENT_SCOPE = 'legacy-launch';

function normalizeConsentScope(scope) {
    return typeof scope === 'string' && scope.trim()
        ? scope.trim().slice(0, 160)
        : DEFAULT_CONSENT_SCOPE;
}

// Retire the former browser-session grant. Consent is now a one-use,
// in-memory capability and must never be resurrected by a reload.
try { sessionStorage.removeItem(VISUAL_CONSENT_KEY); } catch { /* unavailable */ }

export function hasVisualInterlocutionConsent(scope) {
    // Runtime cortex checks intentionally omit a scope: once a launch grant
    // has been consumed, the active chamber owns the capability. Setup
    // surfaces pass their explicit draft scope so one draft cannot reuse
    // another draft's accepted warning.
    if (scope === undefined) return activeSessionConsent || acceptedLaunchConsent;
    const normalizedScope = normalizeConsentScope(scope);
    return (activeSessionConsent && activeSessionConsentScope === normalizedScope)
        || (acceptedLaunchConsent && acceptedLaunchConsentScope === normalizedScope);
}

/**
 * Convert an accepted warning into a capability owned by one chamber
 * session. The one-use launch grant is consumed so the next session must
 * establish consent again, while the cortex can continue checking the active
 * capability before every flash.
 */
export function beginVisualInterlocutionSession(scope) {
    const normalizedScope = normalizeConsentScope(scope);
    if (!acceptedLaunchConsent || acceptedLaunchConsentScope !== normalizedScope) return false;
    activeSessionConsent = true;
    activeSessionConsentScope = normalizedScope;
    acceptedLaunchConsent = false;
    acceptedLaunchConsentScope = null;
    try { sessionStorage.removeItem(VISUAL_CONSENT_KEY); } catch { /* unavailable */ }
    return true;
}

/** Revoke the session capability and cancel any orphaned visible prompt. */
export function endVisualInterlocutionSession() {
    activeSessionConsent = false;
    activeSessionConsentScope = null;
    acceptedLaunchConsent = false;
    acceptedLaunchConsentScope = null;
    try { sessionStorage.removeItem(VISUAL_CONSENT_KEY); } catch { /* unavailable */ }
    pendingConsent?.cancel?.();
    document.getElementById('photosensitivity-modal')?.classList.add('hidden');
}

export function grantVisualInterlocutionConsent(scope) {
    acceptedLaunchConsent = true;
    acceptedLaunchConsentScope = normalizeConsentScope(scope);
    try { sessionStorage.removeItem(VISUAL_CONSENT_KEY); } catch { /* unavailable */ }
    return true;
}

export function requestVisualInterlocutionConsent(scope) {
    const normalizedScope = normalizeConsentScope(scope);
    if (hasVisualInterlocutionConsent(normalizedScope)) return Promise.resolve(true);
    if (acceptedLaunchConsent && acceptedLaunchConsentScope !== normalizedScope) {
        acceptedLaunchConsent = false;
        acceptedLaunchConsentScope = null;
    }
    if (document.documentElement.classList.contains('photosensitivity-mode')) {
        return Promise.resolve(false);
    }
    if (pendingConsent?.scope === normalizedScope) return pendingConsent.promise;
    pendingConsent?.cancel?.();

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
            if (accepted) grantVisualInterlocutionConsent(normalizedScope);
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
        // Focus must land in the dialog for keyboard and screen-reader
        // users, but the buttons sit below the fold on shorter screens:
        // a plain focus() scrolls them into view and drags the warning
        // title and icon off the top. Suppress that scroll, then pin the
        // panel to its start so the reader always sees what they are
        // being warned about first.
        cancelButton.focus({ preventScroll: true });
        const panel = modal.querySelector('.safety-modal-content');
        if (panel) panel.scrollTop = 0;
        modal.scrollTop = 0;
    });
    pendingConsent = { scope: normalizedScope, promise, cancel: () => cancelPrompt?.() };
    return promise;
}

export class VisualFlashGate {
    constructor({
        minIntervalMs = 180,
        burstWindowMs = 1200,
        maxBurst = 3,
        presenceWindowMs = VISUAL_PRESENCE_WINDOW_MS,
        maxVisibleDuty = VISUAL_PRESENCE_MAX_DUTY
    } = {}) {
        this.minIntervalMs = minIntervalMs;
        this.burstWindowMs = burstWindowMs;
        this.maxBurst = maxBurst;
        this.presenceWindowMs = presenceWindowMs;
        this.maxVisibleDuty = maxVisibleDuty;
        this.history = [];
        this.lastReason = 'ready';
    }

    reset() {
        this.history = [];
        this.lastReason = 'ready';
    }

    _prune(now) {
        const retention = Math.max(this.burstWindowMs, this.presenceWindowMs);
        this.history = this.history.filter(item => {
            const edge = item.presence ? item.end : item.start;
            return now - edge < retention;
        });
    }

    check(now = performance.now(), durationMs = null) {
        this._prune(now);
        const recentStarts = this.history.filter(item => now - item.start < this.burstWindowMs);
        const last = this.history[this.history.length - 1];
        if (last && now - last.start < this.minIntervalMs) {
            this.lastReason = 'rapid-start';
            return { allowed: false, reason: this.lastReason };
        }
        if (recentStarts.length >= this.maxBurst) {
            this.lastReason = 'burst';
            return { allowed: false, reason: this.lastReason };
        }

        // Calls without a duration preserve the legacy burst-gate contract.
        // Production presentation requests always supply a normalized duration.
        if (durationMs !== null && durationMs !== undefined) {
            const duration = normalizeVisualPresence(durationMs);
            const lastPresence = [...this.history].reverse().find(item => item.presence);
            if (lastPresence) {
                const rest = minimumVisualPresenceRest(lastPresence.duration);
                if (now - lastPresence.end < rest) {
                    this.lastReason = 'rest';
                    return { allowed: false, reason: this.lastReason };
                }
            }

            const windowStart = now - this.presenceWindowMs;
            const occupied = this.history.reduce((total, item) => {
                if (!item.presence) return total;
                const overlapStart = Math.max(windowStart, item.start);
                const overlapEnd = Math.min(now, item.end);
                return total + Math.max(0, overlapEnd - overlapStart);
            }, 0);
            if (occupied + duration > this.presenceWindowMs * this.maxVisibleDuty) {
                this.lastReason = 'duty';
                return { allowed: false, reason: this.lastReason };
            }
        }

        this.lastReason = 'ready';
        return { allowed: true, reason: this.lastReason };
    }

    canAllow(now = performance.now(), durationMs = null) {
        return this.check(now, durationMs).allowed;
    }

    commit(now = performance.now(), durationMs = null) {
        const status = this.check(now, durationMs);
        if (!status.allowed) return false;
        const presence = durationMs !== null && durationMs !== undefined;
        const duration = presence ? normalizeVisualPresence(durationMs) : 0;
        this.history.push({
            start: now,
            end: now + duration,
            duration,
            presence
        });
        return true;
    }

    allow(now = performance.now(), durationMs = null) {
        return this.commit(now, durationMs);
    }
}
