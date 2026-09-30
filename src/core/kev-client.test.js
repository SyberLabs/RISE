import { afterEach, expect, it, vi } from 'vitest';
import { requestJevRoute } from './jev-client.js';
import { acceptOpenRouterKey, detectLocalKev, resetConnectionForTests } from './ai-connection.js';
import { KEV } from './decision/providers.js';

afterEach(() => { vi.unstubAllGlobals(); resetConnectionForTests(); });

const routeAnswer = { route: { type: 'choice', choice: 'experience_program', confidence: 0.7,
  probabilities: { experience_program: 0.85, agent_operation_set: 0.15 } } };

it('asks nothing of any server without a reader connection', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(requestJevRoute(undefined, { intent: 'Read', targetWords: 800 })).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  expect(fetcher).not.toHaveBeenCalled();
});

it('routes through the reader OpenRouter key and never forwards the legacy argument', async () => {
  acceptOpenRouterKey('sk-or-v1-reader-route-key-0123456789');
  const fetcher = vi.fn(async () => Response.json({ provider: 'TypeSafe', model: 'typesafe/jev-1.13', answers: routeAnswer }));
  vi.stubGlobal('fetch', fetcher);
  const result = await requestJevRoute('old-reader-key', { intent: 'Read', targetWords: 800 });
  expect(result).toMatchObject({ route: 'experience_program', confidence: 0.7 });
  expect(fetcher.mock.calls[0][0]).toBe('https://openrouter.ai/api/alpha/decisions');
  expect(JSON.stringify(fetcher.mock.calls[0])).not.toContain('old-reader-key');
});

it('routes through attested local Kev and rejects an invalid route', async () => {
  const fetcher = vi.fn(async url => url === '/api/local/status'
    ? Response.json({ rise: 'local', kev: { state: 'ready', revision: KEV.revision } })
    : Response.json({ model: 'kev-latest', answers: routeAnswer }, { headers: { 'x-kev-revision': KEV.revision } }));
  vi.stubGlobal('fetch', fetcher);
  expect((await detectLocalKev({ fetcher })).ready).toBe(true);
  expect(await requestJevRoute(undefined, { intent: 'Read', targetWords: 800 }))
    .toMatchObject({ route: 'experience_program', provider: 'Kev', revision: KEV.revision });
  fetcher.mockImplementation(async () => Response.json({ model: 'kev-latest',
    answers: { route: { type: 'choice', choice: 'delete_everything', confidence: 0.9 } } },
  { headers: { 'x-kev-revision': KEV.revision } }));
  await expect(requestJevRoute(undefined, { intent: 'Read', targetWords: 800 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
