export const VISUAL_CONSENT_KEY = 'rise-visual-interlocution-consent';

let pendingConsent = null;

export function hasVisualInterlocutionConsent() {
    try {
        return sessionStorage.getItem(VISUAL_CONSENT_KEY) === 'true';
    } catch {
        return false;
    }
}

export function grantVisualInterlocutionConsent() {
    try {
        sessionStorage.setItem(VISUAL_CONSENT_KEY, 'true');
        return true;
    } catch {
        return false;
    }
}

export function requestVisualInterlocutionConsent() {
    if (hasVisualInterlocutionConsent()) return Promise.resolve(true);
    if (document.documentElement.classList.contains('photosensitivity-mode')) {
        return Promise.resolve(false);
    }
    if (pendingConsent) return pendingConsent;

    const modal = document.getElementById('photosensitivity-modal');
    const cancel = document.getElementById('safety-cancel');
    const accept = document.getElementById('safety-accept');
    if (!modal || !cancel || !accept) return Promise.resolve(false);

    pendingConsent = new Promise(resolve => {
        const controller = new AbortController();
        const finish = accepted => {
            if (accepted) grantVisualInterlocutionConsent();
            modal.classList.add('hidden');
            controller.abort();
            pendingConsent = null;
            resolve(accepted);
        };
        const options = { signal: controller.signal };
        cancel.addEventListener('click', () => finish(false), options);
        accept.addEventListener('click', () => finish(true), options);
        modal.addEventListener('click', event => {
            if (event.target === modal) finish(false);
        }, options);
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') finish(false);
        }, options);

        modal.classList.remove('hidden');
        cancel.focus();
    });

    return pendingConsent;
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
