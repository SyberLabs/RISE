import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';

function makeChamber() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const player = {
        on: vi.fn(), play: vi.fn(), pause: vi.fn(), setInterlocutionHandler: vi.fn(),
        jevConductor: { setFeedback: vi.fn(), destroy: vi.fn() }
    };
    const chamber = new Chamber(container, {
        session: { title: 'Jev reading', atoms: [{ content: 'A bounded passage.' }], visualConfig: { visualMode: 'off' } },
        player,
        autoStart: false
    });
    return { chamber, container, player };
}

describe('Chamber Jev gate state', () => {
    afterEach(() => document.body.replaceChildren());

    it('announces waiting and blocked states and retries the active projection', () => {
        const { chamber, container, player } = makeChamber();
        const status = container.querySelector('#jev-status');
        expect(status).toBeTruthy();
        expect(status.hidden).toBe(true);
        expect(container.querySelector('#atom-display').textContent).toBe('');
        expect(player.on).toHaveBeenCalledWith('jev', expect.any(Function));

        chamber.onJevState({ state: 'waiting', message: 'Waiting for passage approval.' });
        expect(status.hidden).toBe(false);
        expect(status.getAttribute('aria-live')).toBe('polite');
        expect(status.textContent).toContain('Waiting for passage approval.');

        chamber.onJevState({ state: 'blocked', message: 'Jev asked to pause.' });
        expect(status.querySelector('#jev-feedback').maxLength).toBe(500);
        status.querySelector('#jev-feedback').value = 'I am ready to continue.';
        const retry = status.querySelector('button');
        expect(retry.hidden).toBe(false);
        retry.click();
        expect(player.play).toHaveBeenCalledOnce();
        expect(player.jevConductor.setFeedback).toHaveBeenCalledWith('I am ready to continue.');

        chamber.pageModeActive = true;
        chamber.pageReader = { pageIndex: 2, retry: vi.fn(), destroy: vi.fn() };
        retry.click();
        expect(chamber.pageReader.retry).toHaveBeenCalledOnce();
        chamber.destroy();
    });

    it('hides its status when the passage is approved', () => {
        const { chamber, container } = makeChamber();
        chamber.onJevState({ state: 'waiting', message: 'Waiting.' });
        chamber.onJevState({ state: 'ready', message: '' });
        expect(container.querySelector('#jev-status').hidden).toBe(true);
        chamber.destroy();
    });

    it('shows Jev’s slower cue without exposing feedback or retry controls', () => {
        const { chamber, container } = makeChamber();
        chamber.onJevState({ state: 'ready', action: 'slower' });
        expect(container.querySelector('#jev-status').hidden).toBe(false);
        expect(container.querySelector('#jev-status').classList.contains('is-suggestion')).toBe(true);
        expect(container.querySelector('#jev-status-message').textContent)
            .toBe('Take a little more time with this passage.');
        expect(container.querySelector('#jev-feedback').hidden).toBe(true);
        expect(container.querySelector('#jev-retry').hidden).toBe(true);
        chamber.onJevState({ state: 'ready', action: 'continue' });
        expect(container.querySelector('#jev-status').hidden).toBe(true);
        expect(container.querySelector('#jev-status').classList.contains('is-suggestion')).toBe(false);
        chamber.destroy();
    });

    it('does not offer retry for a permanent Page limitation', () => {
        const { chamber, container } = makeChamber();
        chamber.onJevState({ state: 'blocked', retryable: false, message: 'Printing is unavailable.' });
        expect(container.querySelector('#jev-status').textContent).toContain('Printing is unavailable.');
        expect(container.querySelector('#jev-feedback').hidden).toBe(true);
        expect(container.querySelector('label[for="jev-feedback"]').hidden).toBe(true);
        expect(container.querySelector('#jev-retry').hidden).toBe(true);
        chamber.destroy();
    });

    it('cancels an outstanding Jev decision when switching from a paused Stream to Page', async () => {
        const { chamber, player } = makeChamber();
        player.state = 'paused';
        chamber.onJevState({ state: 'waiting', message: 'Waiting for passage approval.' });

        await chamber.togglePageMode(true);

        expect(player.pause).toHaveBeenCalledOnce();
        chamber.destroy();
    });
});
