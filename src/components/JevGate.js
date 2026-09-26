import { createJevConductor } from '../core/jev-conductor.js';

const DEFAULT_INTENT = 'Read attentively';

/** A clear consent gate. It does not send text or contact Jev. */
export class JevGate {
    constructor(container, { onReady, onExit, mode = 'reading', pace = 200 } = {}) {
        if (!container?.replaceChildren) throw new TypeError('JevGate needs a DOM container.');
        if (!['reading', 'devotional'].includes(mode)) throw new TypeError('mode must be reading or devotional.');
        if (!Number.isFinite(pace) || pace < 100 || pace > 500) throw new TypeError('pace must be between 100 and 500 WPM.');
        this.container = container;
        this.onReady = onReady || (() => {});
        this.onExit = onExit || (() => {});
        this.finished = false;
        this.form = null;
        this.consent = null;
        this.intent = null;
        this.continueButton = null;
        this.status = null;

        container.innerHTML = `
            <section class="jev-gate" aria-labelledby="jev-gate-title">
                <h2 id="jev-gate-title">Start with Jev</h2>
                <p id="jev-gate-description">Jev is required for this ${mode} session. It can recommend continuing, slowing down, or pausing.</p>
                <p id="jev-gate-privacy">For this ${mode} session, Jev receives the excerpt being read (up to 2,000 characters), your intent, any feedback you enter (up to 500 characters), and the current pace (starting at ${pace} WPM; Jev accepts 100–500 WPM). This information is sent to TypeSafe for a decision. Nothing is sent before you agree.</p>
                <form>
                    <label for="jev-intent">What would you like from this reading? <span>(optional)</span></label>
                    <input id="jev-intent" name="intent" type="text" maxlength="500" value="${DEFAULT_INTENT}" autocomplete="off" autofocus>
                    <label class="jev-consent">
                        <input name="consent" type="checkbox" required>
                        I agree to send each excerpt I read, my intent, and any feedback to TypeSafe’s Jev service during this session.
                    </label>
                    <p class="jev-gate-status" role="status" aria-live="polite" hidden></p>
                    <div class="jev-gate-actions">
                        <button type="button" data-action="exit">Exit</button>
                        <button type="submit" data-action="continue" disabled>Continue with Jev</button>
                    </div>
                </form>
            </section>`;

        this.form = container.querySelector('form');
        this.consent = container.querySelector('[name="consent"]');
        this.intent = container.querySelector('[name="intent"]');
        this.continueButton = container.querySelector('[data-action="continue"]');
        this.status = container.querySelector('[role="status"]');
        this.handleConsent = () => {
            this.continueButton.disabled = !this.consent.checked;
        };
        this.handleSubmit = async event => {
            event.preventDefault();
            if (this.finished || !this.consent.checked) return;
            this.finished = true;
            this.continueButton.disabled = true;
            try {
                await this.onReady({ intent: this.intent.value.trim() || DEFAULT_INTENT });
            } catch (error) {
                this.finished = false;
                this.continueButton.disabled = false;
                this.setStatus(error?.message || 'Could not start a Jev session. Try again.');
            }
        };
        this.handleExit = () => {
            if (this.finished) return;
            this.finished = true;
            this.onExit();
        };
        this.consent.addEventListener('change', this.handleConsent);
        this.form.addEventListener('submit', this.handleSubmit);
        container.querySelector('[data-action="exit"]').addEventListener('click', this.handleExit);
    }

    setStatus(message) {
        this.status.textContent = String(message || '');
        this.status.hidden = !message;
    }

    destroy() {
        this.consent?.removeEventListener('change', this.handleConsent);
        this.form?.removeEventListener('submit', this.handleSubmit);
        this.container.replaceChildren();
        this.finished = true;
    }
}

/** Show the consent prompt above route content and resolve to a conductor or null. */
export function requestJevSession(_container, { onExit, mode = 'reading', pace = 200, signal } = {}) {
    if (signal?.aborted) return Promise.resolve(null);
    if (!['reading', 'devotional'].includes(mode)) {
        return Promise.reject(new TypeError('mode must be reading or devotional.'));
    }
    if (typeof document === 'undefined' || !document.body) {
        return Promise.reject(new Error('Jev consent requires a browser document.'));
    }

    return new Promise((resolve, reject) => {
        const dialog = document.createElement('dialog');
        dialog.setAttribute('aria-labelledby', 'jev-gate-title');
        dialog.className = 'jev-session-dialog';
        Object.assign(dialog.style, {
            position: 'fixed', zIndex: '2147483647', inset: '0', margin: 'auto',
            maxWidth: 'min(36rem, calc(100vw - 2rem))', maxHeight: 'calc(100vh - 2rem)',
            overflow: 'auto'
        });
        document.body.append(dialog);

        let settled = false;
        let gate;
        const cleanUp = () => {
            signal?.removeEventListener('abort', handleAbort);
            dialog.removeEventListener('cancel', handleCancel);
            gate?.destroy();
            if (dialog.open && typeof dialog.close === 'function') dialog.close();
            dialog.remove();
        };
        const finish = value => {
            if (settled) return;
            settled = true;
            cleanUp();
            resolve(value);
        };
        const exit = () => {
            try { onExit?.(); } finally { finish(null); }
        };
        const handleAbort = () => exit();
        const handleCancel = event => {
            event.preventDefault();
            exit();
        };
        gate = new JevGate(dialog, {
            mode,
            pace,
            onExit: exit,
            onReady: ({ intent }) => finish(createJevConductor({ intent, mode, pace }))
        });
        dialog.addEventListener('cancel', handleCancel);
        signal?.addEventListener('abort', handleAbort, { once: true });

        try {
            if (typeof dialog.showModal === 'function') dialog.showModal();
            else dialog.setAttribute('open', '');
        } catch (error) {
            cleanUp();
            reject(error);
        }
    });
}
