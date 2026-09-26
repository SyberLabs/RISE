import { expect, it, vi } from 'vitest';
import { createDevotionalJev } from './jev-devotional.js';

it('does not send a prayer when consent is declined', async () => {
    const requestSession = vi.fn(async () => null);
    const gate = createDevotionalJev({ requestSession });
    expect(await gate.allow('private prayer')).toBe(null);
    expect(requestSession).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-jev-devotional]')).toBe(null);
});

it('requires a fresh decision for each fixed prayer', async () => {
    const decide = vi.fn().mockResolvedValue({ action: 'continue' });
    const destroy = vi.fn();
    const gate = createDevotionalJev({ requestSession: async () => ({ decide, destroy }) });
    expect(await gate.allow('first')).toBe('continue');
    expect(await gate.allow('second')).toBe('continue');
    expect(decide.mock.calls.map(([request]) => request.excerpt)).toEqual(['first', 'second']);
    gate.destroy();
    expect(destroy).toHaveBeenCalledOnce();
});

it('cannot return a late decision after destruction', async () => {
    let finish;
    const gate = createDevotionalJev({ requestSession: async () => ({
        decide: () => new Promise(resolve => { finish = resolve; }), destroy() {}
    }) });
    const pending = gate.allow('first');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    gate.destroy();
    finish({ action: 'continue' });
    expect(await pending).toBe(null);
    expect(document.querySelector('[data-jev-devotional]')).toBe(null);
});

it('holds on pause and sends fresh feedback when the reader retries', async () => {
    const decide = vi.fn().mockResolvedValueOnce({ action: 'pause' }).mockResolvedValueOnce({ action: 'slower' });
    const gate = createDevotionalJev({ requestSession: async () => ({ decide, destroy() {} }) });
    const pending = gate.allow('Fixed prayer');
    await vi.waitFor(() => expect(document.querySelector('[data-retry]')?.hidden).toBe(false));
    document.querySelector('[data-feedback]').value = 'I need more time';
    document.querySelector('[data-retry]').click();
    expect(await pending).toBe('slower');
    expect(decide.mock.calls[1][0]).toMatchObject({ excerpt: 'Fixed prayer', feedback: 'I need more time' });
    gate.destroy();
});

it('uses a neutral reading-decision dialog and pause message', async () => {
    const decide = vi.fn().mockResolvedValue({ action: 'pause' });
    const gate = createDevotionalJev({ requestSession: async () => ({ decide, destroy() {} }) });
    const pending = gate.allow('Fixed prayer');
    await vi.waitFor(() => expect(document.querySelector('[data-jev-devotional]')).toBeTruthy());
    const dialog = document.querySelector('[data-jev-devotional]');
    expect(dialog.getAttribute('aria-label')).toBe('Reading decision');
    await vi.waitFor(() => expect(dialog.querySelector('[role="status"]').textContent)
        .toContain('reading guide recommends a pause'));
    expect(dialog.textContent).not.toContain('Jev');
    dialog.querySelector('[data-cancel]').click();
    expect(await pending).toBe(null);
    gate.destroy();
});

it('aborts a pending consent dialog when the room exits', async () => {
    let consentSignal;
    const gate = createDevotionalJev({ requestSession: (_container, { signal }) => {
        consentSignal = signal;
        return new Promise(resolve => signal.addEventListener('abort', () => resolve(null)));
    } });
    const pending = gate.allow('Fixed prayer');
    gate.destroy();
    expect(consentSignal.aborted).toBe(true);
    expect(await pending).toBe(null);
});
