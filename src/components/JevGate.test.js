import { afterEach, describe, expect, it, vi } from 'vitest';
import { JevGate, requestJevSession } from './JevGate.js';

afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
});

describe('JevGate', () => {
    it('requires an unchecked consent before continuing and returns the intent', () => {
        const container = document.createElement('div');
        document.body.append(container);
        const onReady = vi.fn();
        const gate = new JevGate(container, { onReady, mode: 'reading' });
        const consent = container.querySelector('input[type="checkbox"]');
        const continueButton = container.querySelector('button[type="submit"]');
        const intent = container.querySelector('input[name="intent"]');

        expect(consent.checked).toBe(false);
        expect(continueButton.disabled).toBe(true);
        expect(container.textContent).toContain('TypeSafe');
        expect(container.textContent).toContain('2,000 characters');
        expect(container.textContent).toContain('reading session');
        expect(container.textContent).toContain('200 WPM');
        continueButton.click();
        expect(onReady).not.toHaveBeenCalled();

        intent.value = 'Read for comfort';
        intent.dispatchEvent(new Event('input', { bubbles: true }));
        consent.checked = true;
        consent.dispatchEvent(new Event('change', { bubbles: true }));
        expect(continueButton.disabled).toBe(false);
        continueButton.click();
        expect(onReady).toHaveBeenCalledWith({ intent: 'Read for comfort' });
        gate.destroy();
    });

    it('uses the default intent and lets the reader exit', () => {
        const container = document.createElement('div');
        const onReady = vi.fn();
        const onExit = vi.fn();
        const gate = new JevGate(container, { onReady, onExit });
        expect(container.querySelector('[name="intent"]').value).toBe('Read attentively');
        container.querySelector('button[type="button"]').click();
        expect(onExit).toHaveBeenCalledOnce();
        expect(onReady).not.toHaveBeenCalled();
        gate.destroy();
    });

    it('announces status updates accessibly', () => {
        const container = document.createElement('div');
        const gate = new JevGate(container);
        gate.setStatus('The service could not respond. Try again.');
        expect(container.querySelector('[role="status"]').textContent)
            .toBe('The service could not respond. Try again.');
        gate.destroy();
    });
});

describe('requestJevSession', () => {
    it('shows consent in a top-level dialog and returns a conductor only after consent', async () => {
        const fetchImpl = vi.fn(async (_url, request) => ({
            ok: true,
            json: async () => ({
                requestId: JSON.parse(request.body).requestId,
                action: 'continue', model: 'jev-model', confidence: 0.9
            })
        }));
        vi.stubGlobal('fetch', fetchImpl);
        const session = requestJevSession(document.createElement('div'), { mode: 'devotional', pace: 240 });
        const dialog = document.body.querySelector('dialog');
        expect(dialog).toBeTruthy();
        expect(dialog.open).toBe(true);
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(dialog.textContent).toContain('devotional session');
        expect(dialog.textContent).toContain('240 WPM');

        dialog.querySelector('input[type="checkbox"]').click();
        dialog.querySelector('button[type="submit"]').click();
        const conductor = await session;
        expect(conductor).toBeTruthy();
        expect(fetchImpl).not.toHaveBeenCalled();
        await conductor.decide({ excerpt: 'only the current excerpt' });
        expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
            excerpt: 'only the current excerpt', mode: 'devotional', pace: 240
        });
        conductor.destroy();
        expect(document.body.querySelector('dialog')).toBeNull();
    });

    it('resolves null when the reader exits or the prompt is aborted', async () => {
        const onExit = vi.fn();
        const exited = requestJevSession(document.createElement('div'), { onExit });
        document.body.querySelector('dialog button[type="button"]').click();
        await expect(exited).resolves.toBeNull();
        expect(onExit).toHaveBeenCalledOnce();

        const controller = new AbortController();
        const aborted = requestJevSession(document.createElement('div'), { signal: controller.signal });
        controller.abort();
        await expect(aborted).resolves.toBeNull();
        expect(document.body.querySelector('dialog')).toBeNull();
    });

    it('rejects an unsupported mode before opening a dialog', async () => {
        await expect(requestJevSession(document.createElement('div'), { mode: 'other' }))
            .rejects.toThrow(/mode/);
        expect(document.body.querySelector('dialog')).toBeNull();
    });
});
