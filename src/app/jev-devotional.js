import '../jev.css';

/** The reading guide may hold a fixed prayer, never rewrite or reorder it. */
export function createDevotionalJev({ requestSession } = {}) {
    let conductor;
    let generation = 0;
    let dialog;
    let cancel;
    let pending = false;
    let controller = new AbortController();

    function destroy() {
        generation += 1;
        controller.abort();
        controller = new AbortController();
        conductor?.destroy();
        conductor = null;
        cancel?.();
        dialog?.remove();
    }

    async function allow(excerpt) {
        if (pending) return null;
        pending = true;
        const revision = generation;
        try {
            if (!conductor) {
                const request = requestSession || (await import('../components/JevGate.js')).requestJevSession;
                if (generation !== revision) return null;
                const candidate = await request(document.body, { mode: 'devotional', signal: controller.signal });
                if (generation !== revision) { candidate?.destroy(); return null; }
                conductor = candidate;
            }
            if (!conductor) return null;
            dialog = document.createElement('dialog');
            dialog.dataset.jevDevotional = '';
            dialog.setAttribute('aria-label', 'Reading decision');
            dialog.innerHTML = '<p role="status">Checking the next prayer…</p><label data-feedback-label hidden>What would help you continue? <input data-feedback maxlength="500" placeholder="For example: give me more time"></label><button type="button" data-retry hidden>Continue / retry</button> <button type="button" data-cancel>Leave this prayer</button>';
            document.body.append(dialog);
            if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
            return await new Promise(resolve => {
                let settled = false;
                const finish = result => {
                    if (settled) return;
                    settled = true;
                    dialog?.remove();
                    cancel = null;
                    resolve(result);
                };
                cancel = () => finish(null);
                const attempt = async (feedback = '') => {
                    const retry = dialog.querySelector('[data-retry]');
                    retry.hidden = true;
                    try {
                        const decision = await conductor.decide({ excerpt: excerpt.slice(0, 2000), feedback, signal: controller.signal });
                        if (settled || generation !== revision) { finish(null); return; }
                        if (decision.action === 'continue' || decision.action === 'slower') {
                            finish(decision.action);
                            return;
                        }
                        dialog.querySelector('[role="status"]').textContent = 'The reading guide recommends a pause here. Retry when you are ready, or leave.';
                    } catch {
                        if (settled || generation !== revision) { finish(null); return; }
                        dialog.querySelector('[role="status"]').textContent = 'The reading decision is unavailable. Reading is paused.';
                    }
                    retry.hidden = false;
                    dialog.querySelector('[data-feedback-label]').hidden = false;
                };
                dialog.querySelector('[data-retry]').onclick = () => attempt(dialog.querySelector('[data-feedback]').value.trim() || 'I am ready to continue.');
                dialog.querySelector('[data-cancel]').onclick = () => finish(null);
                dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
                void attempt();
            });
        } finally { pending = false; }
    }
    return { allow, destroy };
}
