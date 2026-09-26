import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJevConductor } from './jev-conductor.js';

const answer = (overrides = {}) => ({
    requestId: 'request-1',
    action: 'continue',
    model: 'openai/gpt-4.1-mini',
    ...overrides
});

const response = (body, ok = true) => ({ ok, status: ok ? 200 : 502, json: async () => body });
const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

afterEach(() => vi.useRealTimers());

describe('createJevConductor', () => {
    it('sends only the bounded request fields and returns a validated decision', async () => {
        const fetchImpl = vi.fn(async (_url, request) => response(answer({
            requestId: JSON.parse(request.body).requestId
        })));
        const jev = createJevConductor({ intent: 'Read closely', mode: 'devotional', pace: 180, fetchImpl });

        const result = await jev.decide({ excerpt: 'A bounded excerpt', feedback: 'A note' });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, request] = fetchImpl.mock.calls[0];
        expect(url).toBe('/api/jev-decision');
        expect(request.method).toBe('POST');
        expect(request.headers).toEqual({ 'Content-Type': 'application/json' });
        const body = JSON.parse(request.body);
        expect(result).toEqual(answer({ requestId: body.requestId }));
        expect(body).toMatchObject({
            intent: 'Read closely', feedback: 'A note', excerpt: 'A bounded excerpt',
            mode: 'devotional', pace: 180
        });
        expect(body.requestId).toBeTruthy();
        jev.destroy();
    });

    it.each([
        ['wrong request id', { requestId: 'other' }],
        ['unknown action', { action: 'skip' }],
        ['missing model', { model: '' }]
    ])('rejects a response with %s', async (_label, payload) => {
        const jev = createJevConductor({ fetchImpl: async (_url, request) => response(answer({
            requestId: JSON.parse(request.body).requestId,
            ...payload
        })) });
        await expect(jev.decide({ excerpt: 'text' })).rejects.toThrow();
        jev.destroy();
    });

    it('rejects a service error without accepting its body as a decision', async () => {
        const jev = createJevConductor({ fetchImpl: async () => response({ error: { code: 'DECISION_NOT_CONFIGURED', message: 'Private server details' } }, false) });
        await expect(jev.decide({ excerpt: 'text' })).rejects.toThrow(/reading decision/i);
        jev.destroy();
    });

    it('rejects local fields that exceed the service contract', async () => {
        const fetchImpl = vi.fn();
        expect(() => createJevConductor({ intent: 'i'.repeat(501), fetchImpl }))
            .toThrow(/intent/);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('sends queued feedback once and clears it before the next decision', async () => {
        const sent = [];
        const fetchImpl = vi.fn(async (_url, request) => {
            const body = JSON.parse(request.body);
            sent.push(body.feedback);
            return response(answer({ requestId: body.requestId }));
        });
        const jev = createJevConductor({ fetchImpl });
        jev.setFeedback('Please slow down.');
        await jev.decide({ excerpt: 'first' });
        await jev.decide({ excerpt: 'second' });
        expect(sent).toEqual(['Please slow down.', '']);
        expect(() => jev.setFeedback('x'.repeat(501))).toThrow(/feedback/);
        jev.destroy();
    });

    it('uses a validated pace update on the next decision', async () => {
        const paces = [];
        const fetchImpl = vi.fn(async (_url, request) => {
            const body = JSON.parse(request.body);
            paces.push(body.pace);
            return response(answer({ requestId: body.requestId }));
        });
        const jev = createJevConductor({ pace: 200, fetchImpl });
        jev.setPace(160);
        await jev.decide({ excerpt: 'text' });
        expect(paces).toEqual([160]);
        expect(() => jev.setPace(0)).toThrow(/pace/);
        expect(() => jev.setPace(501)).toThrow(/pace/);
        expect(() => createJevConductor({ pace: 99, fetchImpl })).toThrow(/pace/);
        jev.destroy();
    });

    it('aborts the prior request and ignores its late response', async () => {
        const first = deferred();
        const fetchImpl = vi.fn()
            .mockImplementationOnce(() => first.promise)
            .mockImplementationOnce(async (_url, options) => response(answer({ requestId: JSON.parse(options.body).requestId })));
        const jev = createJevConductor({ fetchImpl });
        const prior = jev.decide({ excerpt: 'first' });
        const current = jev.decide({ excerpt: 'second' });

        await expect(prior).rejects.toMatchObject({ name: 'AbortError' });
        await expect(current).resolves.toMatchObject({ action: 'continue' });
        first.resolve(response(answer()));
        await Promise.resolve();
        jev.destroy();
    });

    it('honors caller aborts', async () => {
        const pending = deferred();
        const fetchImpl = vi.fn(() => pending.promise);
        const jev = createJevConductor({ fetchImpl });
        const controller = new AbortController();
        const decision = jev.decide({ excerpt: 'text', signal: controller.signal });
        controller.abort();
        await expect(decision).rejects.toMatchObject({ name: 'AbortError' });
        jev.destroy();
    });

    it('times out after ten seconds, even if fetch ignores abort', async () => {
        vi.useFakeTimers();
        const pending = deferred();
        const jev = createJevConductor({ fetchImpl: () => pending.promise });
        const decision = jev.decide({ excerpt: 'text' });
        const rejection = expect(decision).rejects.toMatchObject({ name: 'AbortError' });
        await vi.advanceTimersByTimeAsync(10_000);
        await rejection;
        jev.destroy();
    });

    it('prevents new work after destroy', async () => {
        const fetchImpl = vi.fn();
        const jev = createJevConductor({ fetchImpl });
        jev.destroy();
        await expect(jev.decide({ excerpt: 'text' })).rejects.toThrow(/session has ended/);
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});
