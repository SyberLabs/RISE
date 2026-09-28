import { afterEach, expect, it, vi } from 'vitest';
import { requestJevRoute } from './jev-client.js';
afterEach(() => vi.unstubAllGlobals());
it('routes without collecting or forwarding a reader provider key', async () => {
  const fetcher = vi.fn(async () => Response.json({ route: 'experience_program', confidence: 0.5, model: 'kev-latest' }));
  vi.stubGlobal('fetch', fetcher);
  expect((await requestJevRoute(undefined, { intent: 'Read', targetWords: 800 })).route).toBe('experience_program');
  expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  await requestJevRoute('old-reader-key', { intent: 'Read', targetWords: 800 });
  expect(JSON.stringify(fetcher.mock.calls[1])).not.toContain('old-reader-key');
});
