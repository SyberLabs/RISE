import { describe, it, expect, vi } from 'vitest';
import { requestPersonalPiece } from './personal-piece-client.js';
const good = { title: 'A piece', paragraphs: ['A quiet word. '.repeat(20).trim(), 'Another moment. '.repeat(20).trim()], writerModel: 'qwen/qwen3.5-9b', promptVersion: 'personal-v1' };
describe('writer client', () => {
  it('makes one request, validates metadata and malformed text without retry', async () => {
    for (const mutation of [v => v.title = {}, v => v.requestId = 'wrong', v => v.authority = true, v => v.paragraphs = ['short']]) {
      const fetcher = vi.fn(async (_url, opts) => {
        const value = { ...good, requestId: JSON.parse(opts.body).requestId }; mutation(value);
        return { ok: true, text: async () => JSON.stringify(value) };
      });
      await expect(requestPersonalPiece({ mode: 'create', thought: 'hello' }, { fetcher })).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it('deadline and abort settle even when fetch ignores abort', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(() => new Promise(() => {}));
    const pending = requestPersonalPiece({}, { fetcher });
    const check = expect(pending).rejects.toThrow(/too long/);
    await vi.advanceTimersByTimeAsync(35000); await check;
    const controller = new AbortController();
    const cancelled = requestPersonalPiece({}, { fetcher, signal: controller.signal });
    const checkCancel = expect(cancelled).rejects.toThrow(/cancelled/);
    controller.abort(); await checkCancel;
    vi.useRealTimers();
  });
});
