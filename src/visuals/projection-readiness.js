import { createAbortError } from '../sources/visual/request.js';

/**
 * One pending first-paint for a glyph projection host.
 * Cortex owns flash and generation; this owns only "has this host painted?"
 */
export class ProjectionReadiness {
    constructor() {
        this.host = null;
        this.paintedHost = null;
        this.promise = null;
        this._resolve = null;
        this._reject = null;
    }

    isPainted(host) {
        return !!host && host === this.paintedHost;
    }

    whenReady(host) {
        if (!host) {
            const rejected = Promise.reject(createAbortError('Projection host required'));
            rejected.catch(() => {});
            return rejected;
        }
        if (this.host !== host) this.begin(host);
        return this.promise;
    }

    begin(host) {
        this.cancel('Projection host replaced');
        let resolveReady;
        let rejectReady;
        const promise = new Promise((resolve, reject) => {
            resolveReady = resolve;
            rejectReady = reject;
        });
        promise.catch(() => {});
        this.host = host;
        this.promise = promise;
        this._resolve = resolveReady;
        this._reject = rejectReady;
    }

    cancel(message) {
        const reject = this._reject;
        const pending = typeof reject === 'function';
        this.host = null;
        this.promise = null;
        this._resolve = null;
        this._reject = null;
        if (pending) reject?.(createAbortError(message));
    }

    reportPaint(host) {
        if (!host) return;
        this.paintedHost = host;
        if (host !== this.host) return;
        const resolve = this._resolve;
        this._resolve = null;
        this._reject = null;
        resolve?.();
    }

    clearPaint() {
        this.paintedHost = null;
    }
}
