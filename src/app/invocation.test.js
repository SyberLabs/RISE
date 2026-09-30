// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { enterFromInvocation, requestComposedReading, saveInvocationHandoff, takeInvocationHandoff, openInvocationDecision } from './invocation.js';

afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });

it('uses the reader-owned decision provider and admits its versioned answer', async () => {
  const decision = { schemaVersion: 2, workId: 'a' };
  const recommend = vi.fn(async () => decision);
  const admit = vi.fn();
  await expect(requestComposedReading('Surprise me with a reading.', { recommend, admit })).resolves.toEqual(decision);
  expect(recommend).toHaveBeenCalledWith('Surprise me with a reading.', { nightDrive: true });
  expect(admit).toHaveBeenCalledWith(decision);
});

it('does not admit a failed or malformed decision', async () => {
  const admit = vi.fn();
  await expect(requestComposedReading('Surprise me', {
    recommend: async () => { throw new Error('Unavailable'); }, admit
  })).rejects.toThrow('Unavailable');
  expect(admit).not.toHaveBeenCalled();
  await expect(requestComposedReading('Surprise me', {
    recommend: async () => ({}), admit: () => { throw new TypeError('Invalid plan'); }
  })).rejects.toThrow('Invalid plan');
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

it('docks through the app launch and adjusts through Reader Setup, the same two operations as Home', async () => {
  const decision = { workId: 'ulysses' };
  const launch = vi.fn();
  const adjust = vi.fn();
  await openInvocationDecision({ decision, action: 'dock' }, { launch, adjust });
  expect(launch).toHaveBeenCalledWith(decision);
  expect(adjust).not.toHaveBeenCalled();
  await openInvocationDecision({ decision, action: 'adjust' }, { launch, adjust });
  expect(adjust).toHaveBeenCalledWith(decision);
  expect(launch).toHaveBeenCalledOnce();
  await expect(openInvocationDecision({ decision, action: 'delete' }, { launch, adjust })).rejects.toThrow('Unknown');
});

function entry() {
  return { home: vi.fn(async () => {}), launch: vi.fn(async () => {}), adjust: vi.fn(async () => {}), fail: vi.fn() };
}

it('opens a handed-over reading at startup, once, and cleans the address', async () => {
  const decision = { workId: 'ulysses' };
  saveInvocationHandoff(decision, 'adjust');
  window.history.replaceState({}, '', '/?invocation=wormhole');
  const ops = entry();
  await expect(enterFromInvocation(window.location.search, ops)).resolves.toBe(true);
  expect(ops.home).toHaveBeenCalledOnce();
  expect(ops.adjust).toHaveBeenCalledWith(decision);
  expect(ops.launch).not.toHaveBeenCalled();
  expect(window.location.pathname + window.location.search).toBe('/');
  expect(takeInvocationHandoff()).toBeNull();
});

it('tells the reader why when the reading cannot be opened, and still counts as handled', async () => {
  saveInvocationHandoff({ workId: 'ulysses' }, 'dock');
  window.history.replaceState({}, '', '/?invocation=wormhole');
  const ops = entry();
  ops.launch.mockRejectedValueOnce(new Error('The selected edition is not available in this RISE release.'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await expect(enterFromInvocation(window.location.search, ops)).resolves.toBe(true);
  expect(ops.fail).toHaveBeenCalledWith('The selected edition is not available in this RISE release.');
});

it('lets startup go on as usual when there is nothing to open', async () => {
  const ops = entry();
  // No handoff (a reload after it was taken): the address is cleaned, nothing opens.
  window.history.replaceState({}, '', '/?invocation=wormhole');
  await expect(enterFromInvocation(window.location.search, ops)).resolves.toBe(false);
  expect(window.location.search).toBe('');
  expect(ops.home).not.toHaveBeenCalled();
  // Some other address is none of its business, and a stored handoff is left alone.
  saveInvocationHandoff({ workId: 'ulysses' }, 'dock');
  window.history.replaceState({}, '', '/?utm=1');
  await expect(enterFromInvocation(window.location.search, ops)).resolves.toBe(false);
  expect(takeInvocationHandoff()).not.toBeNull();
});
