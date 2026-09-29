// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { requestComposedReading, saveInvocationHandoff, takeInvocationHandoff, openInvocationDecision } from './invocation.js';

afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

it('asks the existing decision route once and admits its versioned answer', async () => {
  const decision = { schemaVersion: 2, workId: 'a' };
  const fetchImpl = vi.fn(async () => Response.json(decision));
  const admit = vi.fn();
  await expect(requestComposedReading('Surprise me with a reading.', { fetchImpl, admit })).resolves.toEqual(decision);
  expect(fetchImpl).toHaveBeenCalledWith('/api/jev-recommend', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent: 'Surprise me with a reading.', schemaVersion: 3 })
  });
  expect(admit).toHaveBeenCalledWith(decision);
});

it('does not admit a failed or malformed decision', async () => {
  const admit = vi.fn();
  await expect(requestComposedReading('Surprise me', {
    fetchImpl: async () => Response.json({ error: { message: 'Unavailable' } }, { status: 503 }), admit
  })).rejects.toThrow('Unavailable');
  expect(admit).not.toHaveBeenCalled();
  await expect(requestComposedReading('Surprise me', {
    fetchImpl: async () => Response.json({}), admit: () => { throw new TypeError('Invalid plan'); }
  })).rejects.toThrow('Invalid plan');
  await expect(requestComposedReading('Surprise me', {
    fetchImpl: async () => Response.json({ schemaVersion: 2, workId: 'x' })
  })).rejects.toThrow('invalid destination');
});

it('hands a decision to the app once, with only a known destination action', () => {
  const decision = { workId: 'ulysses' };
  saveInvocationHandoff(decision, 'dock');
  expect(takeInvocationHandoff()).toEqual({ decision, action: 'dock' });
  expect(takeInvocationHandoff()).toBeNull();
  expect(() => saveInvocationHandoff(decision, 'delete')).toThrow();
  sessionStorage.setItem('rise:invocation-handoff:v1', JSON.stringify({ action: 'delete', decision }));
  expect(takeInvocationHandoff()).toBeNull();
});

it('docks through the app launch and adjusts through Reader Setup with the resolved reading', async () => {
  const decision = { workId: 'ulysses' };
  const launch = vi.fn();
  const navigate = vi.fn();
  const resolve = vi.fn(async () => ({ text: 'Released text', textSource: 'Ulysses', wpm: 200 }));
  await openInvocationDecision({ decision, action: 'dock' }, { launch, navigate, resolve });
  expect(launch).toHaveBeenCalledWith(decision);
  expect(resolve).not.toHaveBeenCalled();
  await openInvocationDecision({ decision, action: 'adjust' }, { launch, navigate, resolve });
  expect(navigate).toHaveBeenCalledWith('chamber', {
    text: 'Released text', source: 'Ulysses', config: { text: 'Released text', textSource: 'Ulysses', wpm: 200 }
  });
});
