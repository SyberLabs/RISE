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
