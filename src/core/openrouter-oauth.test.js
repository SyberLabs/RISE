import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_URL, CALLBACK_PATH, EXCHANGE_URL, PENDING_KEY, PENDING_TTL_MS,
  beginOpenRouterConnect, codeChallenge, completeOpenRouterConnect, finishOpenRouterReturn, takeOpenRouterReturn
} from './openrouter-oauth.js';
import { takeConnectionNotice } from './ai-connection.js';
import { connectionState, disconnect, getConnection, resetConnectionForTests } from './ai-connection.js';
import { callDecision } from './decision/call.js';

const ORIGIN = 'https://rise.syberlabs.io';
const KEY = 'sk-or-v1-reader-test-key-0123456789abcdef';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    dump: () => JSON.stringify([...map])
  };
}

async function begin(storage, now = () => 1_000) {
  let navigated = null;
  await beginOpenRouterConnect({ storage, origin: ORIGIN, navigate: url => { navigated = url; }, now });
  const url = new URL(navigated);
  const callback = new URL(url.searchParams.get('callback_url'));
  return { url, callback, state: callback.searchParams.get('rise_state') };
}

function callbackLocation(params) {
  const url = new URL(CALLBACK_PATH, ORIGIN);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return { pathname: url.pathname, href: url.href };
}

beforeEach(() => resetConnectionForTests());
afterEach(() => { resetConnectionForTests(); vi.unstubAllGlobals(); });

describe('Connect OpenRouter (PKCE S256)', () => {
  it('starts at OpenRouter with an S256 challenge and a state bound to this tab', async () => {
    const storage = memoryStorage();
    const { url, callback, state } = await begin(storage);
    expect(url.origin + url.pathname).toBe(AUTH_URL);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(callback.origin).toBe(ORIGIN);
    expect(callback.pathname).toBe(CALLBACK_PATH);
    const pending = JSON.parse(storage.getItem(PENDING_KEY));
    expect(pending.state).toBe(state);
    expect(url.searchParams.get('code_challenge')).toBe(await codeChallenge(pending.verifier));
    expect(url.href).not.toContain(pending.verifier);
  });

  it('strips the code from the address bar before exchanging it', () => {
    const history = { replaceState: vi.fn() };
    const storage = memoryStorage();
    const taken = takeOpenRouterReturn(callbackLocation({ rise_state: 's', code: 'abc12345' }), history, storage);
    expect(taken).toEqual({ callback: { code: 'abc12345', state: 's' } });
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/');
    const elsewhere = vi.fn();
    expect(takeOpenRouterReturn({ pathname: '/', href: `${ORIGIN}/` }, { replaceState: elsewhere }, storage)).toEqual({ abandoned: false });
    expect(elsewhere).not.toHaveBeenCalled();
  });

  it('exchanges a matching callback for a key held only in memory, then clears PKCE state', async () => {
    const storage = memoryStorage();
    const { state } = await begin(storage);
    const verifier = JSON.parse(storage.getItem(PENDING_KEY)).verifier;
    const fetcher = vi.fn(async () => Response.json({ key: KEY, user_id: 'u1' }));
    const result = await completeOpenRouterConnect({ code: 'auth-code-123', state }, { storage, fetcher, now: () => 2_000 });
    expect(result.code).toBe('CONNECTED');
    expect(fetcher.mock.calls[0][0]).toBe(EXCHANGE_URL);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      code: 'auth-code-123', code_verifier: verifier, code_challenge_method: 'S256'
    });
    expect(fetcher.mock.calls[0][1].credentials).toBe('omit');
    expect(storage.getItem(PENDING_KEY)).toBeNull();
    expect(storage.dump()).not.toContain(KEY);
    expect(connectionState()).toMatchObject({ kind: 'openrouter', billing: 'reader' });
    expect(JSON.stringify(connectionState())).not.toContain(KEY);
  });

  it('treats a callback without a code as cancellation and connects nothing', async () => {
    const storage = memoryStorage();
    const { state } = await begin(storage);
    const fetcher = vi.fn();
    expect((await completeOpenRouterConnect({ code: null, state }, { storage, fetcher, now: () => 2_000 })).code).toBe('CANCELED');
    expect(fetcher).not.toHaveBeenCalled();
    expect(storage.getItem(PENDING_KEY)).toBeNull();
    expect(connectionState().kind).toBe('none');
  });

  it('clears an abandoned sign-in when the reader comes back without a callback, and says so', async () => {
    const storage = memoryStorage();
    await begin(storage);
    const home = { pathname: '/', href: `${ORIGIN}/` };
    const returned = takeOpenRouterReturn(home, { replaceState: vi.fn() }, storage);
    expect(returned).toEqual({ abandoned: true });
    expect(storage.getItem(PENDING_KEY)).toBeNull();
    expect(await finishOpenRouterReturn(returned)).toBe('CANCELED');
    expect(takeConnectionNotice().message).toContain('not connected');
    expect(takeOpenRouterReturn(home, { replaceState: vi.fn() }, storage)).toEqual({ abandoned: false });
    expect(await finishOpenRouterReturn({ abandoned: false })).toBeNull();
  });

  it.each([
    ['an unsolicited callback', async storage => ({ taken: { code: 'auth-code-123', state: 'A'.repeat(32) }, storage }), 'UNSOLICITED'],
    ['a mismatched state', async storage => { await begin(storage); return { taken: { code: 'auth-code-123', state: 'B'.repeat(32) } }; }, 'STATE_MISMATCH'],
    ['an expired sign-in', async storage => { const { state } = await begin(storage); return { taken: { code: 'auth-code-123', state }, now: () => 1_000 + PENDING_TTL_MS + 1 }; }, 'EXPIRED'],
    ['a malformed code', async storage => { const { state } = await begin(storage); return { taken: { code: 'bad code<script>', state } }; }, 'INVALID_CALLBACK']
  ])('rejects %s without contacting OpenRouter', async (_name, arrange, code) => {
    const storage = memoryStorage();
    const { taken, now = () => 2_000 } = await arrange(storage);
    const fetcher = vi.fn();
    expect((await completeOpenRouterConnect(taken, { storage, fetcher, now })).code).toBe(code);
    expect(fetcher).not.toHaveBeenCalled();
    expect(storage.getItem(PENDING_KEY)).toBeNull();
    expect(connectionState().kind).toBe('none');
  });

  it.each([
    ['a refused exchange', async () => new Response('no', { status: 403 }), 'EXCHANGE_FAILED'],
    ['a reply without a key', async () => Response.json({ user_id: 'u1' }), 'EXCHANGE_FAILED'],
    ['a network failure', async () => { throw new TypeError('offline'); }, 'UNAVAILABLE']
  ])('reports %s and stays disconnected', async (_name, exchange, code) => {
    const storage = memoryStorage();
    const { state } = await begin(storage);
    expect((await completeOpenRouterConnect({ code: 'auth-code-123', state }, { storage, fetcher: vi.fn(exchange), now: () => 2_000 })).code).toBe(code);
    expect(connectionState().kind).toBe('none');
  });
});

describe('the reader connection', () => {
  async function connect() {
    const storage = memoryStorage();
    const { state } = await begin(storage);
    await completeOpenRouterConnect({ code: 'auth-code-123', state },
      { storage, fetcher: async () => Response.json({ key: KEY }), now: () => 2_000 });
  }
  const body = { state: {}, questions: { pick: { type: 'choice', instructions: 'x', criteria: { a: 'A' } } } };

  it('sends the key only to OpenRouter Decisions, never with cookies or a referrer', async () => {
    await connect();
    const fetcher = vi.fn(async () => Response.json({ provider: 'TypeSafe', model: 'typesafe/jev-1.13',
      answers: { pick: { type: 'choice', choice: 'a' } } }));
    vi.stubGlobal('fetch', fetcher);
    await callDecision(getConnection(), body);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/alpha/decisions');
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' });
  });

  it('forgets the key on disconnect, after which nothing can be sent', async () => {
    await connect();
    disconnect();
    expect(connectionState().kind).toBe('none');
    expect(getConnection()).toBeNull();
  });

  it('drops a revoked or expired key when OpenRouter answers 401', async () => {
    await connect();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unauthorized', { status: 401 })));
    await expect(callDecision(getConnection(), body)).rejects.toMatchObject({ code: 'AUTH' });
    expect(connectionState().kind).toBe('none');
  });
});
