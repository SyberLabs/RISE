import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync('public/jev-preview.html', 'utf8');

async function openPreview() {
    document.body.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML;
    expect(document.querySelector('#jev-submit')).not.toBeNull();
    // jsdom cannot finish a native form submission; the app still receives the click's submit event.
    document.querySelector('#jev-form').addEventListener('submit', (event) => event.preventDefault());
    vi.resetModules();
    await import('../../public/jev-preview.js');
}

describe('Jev browser preview', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.unstubAllGlobals();
    });

    it('sends one bounded same-origin sample only after a click and shows the validated decision', async () => {
        fetch.mockImplementation(async (url, options) => {
            const request = JSON.parse(options.body);
            return new Response(JSON.stringify({
                requestId: request.requestId,
                action: 'slower',
                model: 'typesafe/jev-1.13-20260917'
            }), { status: 200 });
        });

        await openPreview();
        expect(fetch).not.toHaveBeenCalled();
        document.querySelector('#jev-submit').click();

        await vi.waitFor(() => expect(document.querySelector('#jev-result').textContent).toContain('slower'));
        expect(fetch).toHaveBeenCalledOnce();
        const [url, options] = fetch.mock.calls[0];
        expect(url).toBe('/api/jev-decision');
        expect(options.method).toBe('POST');
        expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
        const request = JSON.parse(options.body);
        expect(request).toEqual({
            intent: 'Help me stay with this passage.',
            feedback: 'I would like a little more time to read.',
            excerpt: 'The light moved slowly across the room, and the reader paused to notice it.',
            mode: 'reading',
            pace: 220,
            requestId: expect.any(String)
        });
        expect(request.requestId.length).toBeGreaterThan(0);
        expect(document.querySelector('#jev-result').textContent).toContain(request.requestId);
        expect(document.querySelector('#jev-result').textContent).toContain('typesafe/jev-1.13-20260917');
    });

    it('shows a safe error without exposing a provider response', async () => {
        fetch.mockResolvedValue(new Response(JSON.stringify({ error: { message: 'private provider details' } }), {
            status: 502
        }));

        await openPreview();
        document.querySelector('#jev-submit').click();

        await vi.waitFor(() => expect(document.querySelector('#jev-result').textContent).toContain('could not complete'));
        expect(document.body.textContent).not.toContain('private provider details');
    });

    it('rejects a mismatched request ID and untrusted model or action', async () => {
        fetch.mockResolvedValue(new Response(JSON.stringify({
            requestId: 'someone-else',
            action: '<img src=x>',
            model: 'untrusted/model'
        }), { status: 200 }));

        await openPreview();
        document.querySelector('#jev-submit').click();

        await vi.waitFor(() => expect(document.querySelector('#jev-result').textContent).toContain('could not complete'));
        expect(document.querySelector('#jev-result').textContent).not.toContain('<img');
        expect(document.querySelector('#jev-result').textContent).not.toContain('untrusted/model');
    });

    it('keeps out-of-range edits local and does not send them', async () => {
        await openPreview();
        document.querySelector('#jev-intent').value = 'x'.repeat(501);
        document.querySelector('#jev-submit').click();
        expect(fetch).not.toHaveBeenCalled();
        expect(document.querySelector('#jev-result').textContent).toContain('shorten');
    });
});
