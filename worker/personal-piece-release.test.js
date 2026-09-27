// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import worker from './index.mjs';
afterEach(() => vi.unstubAllGlobals());
it('cannot activate unverified inference through environment configuration alone', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const response = await worker.fetch(new Request('https://rise.example/api/personal-piece', {
    method: 'POST', headers: { Origin: 'https://rise.example', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' },
    body: JSON.stringify({ requestId: '550e8400-e29b-41d4-a716-446655440000', mode: 'create', thought: 'Morning.' })
  }), { PERSONAL_PIECE_ENABLED: 'true', OPENROUTER_API_KEY: 'secret', UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'token', PERSONAL_PIECE_IP_SECRET: 'a-long-secret-of-at-least-thirty-two-characters' });
  expect(response.status).toBe(503);
  expect(fetch).not.toHaveBeenCalled();
});
