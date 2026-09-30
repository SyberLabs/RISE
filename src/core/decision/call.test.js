import { describe, expect, it, vi } from 'vitest';
import { callDecision, DecisionError } from './call.js';
import { JEV, KEV } from './providers.js';

const answers = { pick: { type: 'choice', choice: 'a' } };
const hanging = vi.fn((init) => new Promise((_, reject) => {
  init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
}));
const body = { model: 'attacker/model', state: {}, questions: {} };

async function codeOf(promise) {
  try { await promise; } catch (error) { return error instanceof DecisionError ? error.code : error; }
  return 'resolved';
}

describe('callDecision', () => {
  it('refuses to send without a reader connection', async () => {
    expect(await codeOf(callDecision(null, body))).toBe('NOT_CONNECTED');
  });

  it('pins the model to the connection, whatever the caller asked for', async () => {
    const request = vi.fn(async () => Response.json({ provider: 'TypeSafe', model: 'typesafe/jev-1.13', answers }));
    await callDecision({ provider: JEV, request }, body);
    expect(JSON.parse(request.mock.calls[0][0].body).model).toBe('typesafe/jev-1.13');
    expect(request.mock.calls[0][0].redirect).toBe('error');
  });

  it('ends at the deadline with TIMEOUT and makes exactly one attempt', async () => {
    hanging.mockClear();
    expect(await codeOf(callDecision({ provider: JEV, request: hanging }, body, { deadlineMs: 20 }))).toBe('TIMEOUT');
    expect(hanging).toHaveBeenCalledOnce();
  });

  it('reports reader cancellation as CANCELED, not as a failure to retry', async () => {
    const controller = new AbortController();
    const pending = callDecision({ provider: JEV, request: hanging }, body, { signal: controller.signal });
    controller.abort();
    expect(await codeOf(pending)).toBe('CANCELED');
    expect(await codeOf(callDecision({ provider: JEV, request: hanging }, body, { signal: controller.signal }))).toBe('CANCELED');
  });

  it('rejects a Jev answer claiming another model, and a Kev answer without attestation', async () => {
    const wrong = vi.fn(async () => Response.json({ provider: 'TypeSafe', model: 'openai/gpt-x', answers }));
    expect(await codeOf(callDecision({ provider: JEV, request: wrong }, body))).toBe('INVALID_RESPONSE');
    const bare = vi.fn(async () => Response.json({ model: 'kev-latest', answers }));
    expect(await codeOf(callDecision({ provider: KEV, request: bare }, body))).toBe('UNATTESTED');
    const generic = vi.fn(async () => Response.json({ model: 'qwen', answers },
      { headers: { 'x-kev-revision': KEV.revision } }));
    expect(await codeOf(callDecision({ provider: KEV, request: generic }, body))).toBe('INVALID_RESPONSE');
  });

  it('rejects malformed and oversized answers', async () => {
    const malformed = vi.fn(async () => new Response('{'));
    expect(await codeOf(callDecision({ provider: JEV, request: malformed }, body))).toBe('INVALID_RESPONSE');
    const huge = vi.fn(async () => new Response('x'.repeat(300 * 1024)));
    expect(await codeOf(callDecision({ provider: JEV, request: huge }, body))).toBe('INVALID_RESPONSE');
  });
});
