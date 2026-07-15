import { afterEach, describe, expect, it, vi } from 'vitest';
import { MuseumProvider } from './museum.js';
import { WikimediaProvider } from './wikimedia.js';

function abortingFetch() {
    return vi.spyOn(globalThis, 'fetch').mockImplementation((url, options = {}) =>
        new Promise((resolve, reject) => {
            const rejectAbort = () => {
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
            };
            if (options.signal?.aborted) rejectAbort();
            else options.signal?.addEventListener('abort', rejectAbort, { once: true });
        }));
}

describe('external visual provider cancellation', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('propagates generation aborts through the Art Institute request', async () => {
        abortingFetch();
        const provider = new MuseumProvider();
        const controller = new AbortController();

        const request = provider.getImagesInCategory('oldmasters', 1, {
            signal: controller.signal,
            timeoutMs: 5000
        });
        controller.abort();

        await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('turns a stalled Art Institute request into a structured timeout', async () => {
        vi.useFakeTimers();
        abortingFetch();
        const provider = new MuseumProvider();

        const request = provider.getImagesInCategory('oldmasters', 1, { timeoutMs: 25 });
        const assertion = expect(request).rejects.toMatchObject({
            name: 'TimeoutError',
            message: expect.stringContaining('25ms')
        });
        await vi.advanceTimersByTimeAsync(25);

        await assertion;
    });

    it('propagates cancellation through Wikimedia rate pacing and fetch', async () => {
        abortingFetch();
        const provider = new WikimediaProvider();
        provider._lastRequestTime = Date.now() + 1000; // force the abortable pacing delay
        const controller = new AbortController();

        const request = provider._fetch({ action: 'query' }, {
            signal: controller.signal,
            timeoutMs: 5000
        });
        controller.abort();

        await expect(request).rejects.toMatchObject({ name: 'AbortError' });
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });
});
