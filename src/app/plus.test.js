import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimPlus, forgetPlus, markPlusLapsed, plusNotice, plusState } from './plus.js';
import { enterFromPlusClaim } from './plus-claim.js';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('Plus on this browser', () => {
  it('remembers a claim the Worker confirmed, and nothing from one it refused', async () => {
    const refused = vi.fn(async () => Response.json({ error: { code: 'PLUS_REQUIRED', message: 'not paid' } }, { status: 402 }));
    expect(await claimPlus('cs_test_1', { fetchImpl: refused })).toEqual({ ok: false, message: 'not paid' });
    expect(plusState()).toEqual({ claimed: false, lapsed: false });

    const confirmed = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await claimPlus('cs_test_1', { fetchImpl: confirmed })).toEqual({ ok: true });
    expect(confirmed).toHaveBeenCalledWith('/api/plus/claim', expect.objectContaining({ method: 'POST', body: JSON.stringify({ session_id: 'cs_test_1' }) }));
    expect(plusState()).toEqual({ claimed: true, lapsed: false });
  });

  it('marks a lapse the Worker reported, and a new claim clears it', async () => {
    await claimPlus('cs_test_1', { fetchImpl: async () => new Response(null, { status: 204 }) });
    markPlusLapsed();
    expect(plusState()).toEqual({ claimed: true, lapsed: true });
    await claimPlus('cs_test_2', { fetchImpl: async () => new Response(null, { status: 204 }) });
    expect(plusState()).toEqual({ claimed: true, lapsed: false });
  });

  it('forgets the claim here, even when the Worker cannot be reached', async () => {
    await claimPlus('cs_test_1', { fetchImpl: async () => new Response(null, { status: 204 }) });
    const fetchImpl = vi.fn(async () => { throw new Error('offline'); });
    await forgetPlus({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith('/api/plus/forget', { method: 'POST' });
    expect(plusState()).toEqual({ claimed: false, lapsed: false });
  });

  it('has one line for each refusal the Worker can give', () => {
    expect(plusNotice('PLUS_LAPSED')).toBe('Plus voice has lapsed. Reading continues silently.');
    expect(plusNotice('PLUS_ALLOWANCE')).toMatch(/allowance is used up/u);
    expect(plusNotice('TOO_LONG')).toBe('This reading is too long for the Plus voice.');
    expect(plusNotice('UPSTREAM')).toMatch(/continues silently/u);
  });
});

describe('the claim page', () => {
  it('lifts the session id out of the address, claims it, says so once and returns Home', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchImpl);
    window.history.replaceState({}, '', '/plus/claim?session_id=cs_test_9');
    const home = vi.fn(async () => {});
    const notify = vi.fn();

    await enterFromPlusClaim(window.location.search, { home, notify });

    expect(window.location.pathname + window.location.search).toBe('/');
    expect(fetchImpl.mock.calls[0][1].body).toBe(JSON.stringify({ session_id: 'cs_test_9' }));
    expect(notify).toHaveBeenCalledWith('Plus voice is on in this browser.');
    expect(home).toHaveBeenCalledTimes(1);
    expect(plusState().claimed).toBe(true);
  });

  it('shows the Worker\'s own message when the claim is refused', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ error: { code: 'BAD_REQUEST', message: 'A Checkout session id is needed.' } }, { status: 400 }));
    const notify = vi.fn();
    await enterFromPlusClaim('', { home: async () => {}, notify });
    expect(notify).toHaveBeenCalledWith('A Checkout session id is needed.');
    expect(plusState().claimed).toBe(false);
  });
});
