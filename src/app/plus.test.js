import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPlusStatus, fetchPlusVoices, notePlusClaimed, forgetPlus, markPlusLapsed, notePlusAllowance, plusAllowance, plusNotice, plusState, plusVoiceSlug, plusAudioSession } from './plus.js';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Plus on this browser', () => {
  it('marks a lapse the Worker reported, and a new claim clears it', () => {
    notePlusClaimed();
    markPlusLapsed();
    expect(plusState()).toEqual({ claimed: true, lapsed: true });
    notePlusClaimed();
    expect(plusState()).toEqual({ claimed: true, lapsed: false });
  });

  it('keeps the allowance the Worker last reported beside the claim, and only beside one', () => {
    notePlusAllowance({ used: 1, limit: 105000, periodEnd: 2 });
    expect(plusAllowance()).toBeNull();
    notePlusClaimed();
    notePlusAllowance({ used: 'many', limit: 105000 });
    expect(plusAllowance()).toBeNull();
    notePlusAllowance({ used: 900, limit: 105000, periodEnd: 2 });
    expect(plusAllowance()).toEqual({ used: 900, limit: 105000, periodEnd: 2 });
    expect(plusState()).toEqual({ claimed: true, lapsed: false });
  });

  it('lists the Worker\'s voices, and Default alone when the list cannot be had', async () => {
    const listed = vi.fn(async () => Response.json([{ slug: 'default', label: 'Default' }, { slug: 'river', label: 'River' }, { slug: '<b>', label: 'x' }, { slug: 'ember' }]));
    expect(await fetchPlusVoices({ fetchImpl: listed })).toEqual([{ slug: 'default', label: 'Default' }, { slug: 'river', label: 'River' }, { slug: 'ember', label: 'ember' }]);
    expect(listed).toHaveBeenCalledWith('/api/plus/voices');
    expect(await fetchPlusVoices({ fetchImpl: async () => { throw new Error('offline'); } })).toEqual([{ slug: 'default', label: 'Default' }]);
    expect(await fetchPlusVoices({ fetchImpl: async () => new Response('nope', { status: 503 }) })).toEqual([{ slug: 'default', label: 'Default' }]);
    expect(plusVoiceSlug('river')).toBe('river');
    expect(plusVoiceSlug('"><script>')).toBe('default');
    expect(plusVoiceSlug(undefined)).toBe('default');
  });

  it('forgets the claim here, even when the Worker cannot be reached', async () => {
    notePlusClaimed();
    const fetchImpl = vi.fn(async () => { throw new Error('offline'); });
    await forgetPlus({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith('/api/plus/forget', { method: 'POST' });
    expect(plusState()).toEqual({ claimed: false, lapsed: false });
  });

  it('revokes audio across tabs when the claim changes, while allowance refreshes keep playback', () => {
    const signal = plusAudioSession();
    window.dispatchEvent(new StorageEvent('storage', { key: 'rise.plus', oldValue: '{"claimedAt":1}', newValue: '{"claimedAt":1,"allowance":{"used":2}}' }));
    expect(signal.aborted).toBe(false);
    window.dispatchEvent(new StorageEvent('storage', { key: 'rise.plus', oldValue: '{"claimedAt":1}', newValue: '{"claimedAt":2}' }));
    expect(signal.aborted).toBe(true);
    const next = plusAudioSession();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(next.aborted).toBe(true);
  });

  it('has one line for each refusal the Worker can give', () => {
    expect(plusNotice('PLUS_LAPSED')).toBe('Plus voice has lapsed. Reading continues silently.');
    expect(plusNotice('PLUS_ALLOWANCE')).toMatch(/allowance is used up/u);
    expect(plusNotice('TOO_LONG')).toBe('This reading is too long for the Plus voice.');
    expect(plusNotice('UPSTREAM')).toMatch(/continues silently/u);
  });
});

 describe('server voice entitlement', () => {
  it('recognizes only explicit server booleans and never persists admin authority', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ admin: true, subscriber: false, available: true, adminLogin: false, billingAvailable: false, canSubscribe: false, allowance: { used: 1, limit: 2, periodEnd: 3 } }));
    expect(await fetchPlusStatus({ fetchImpl })).toEqual({ confirmed: true, admin: true, subscriber: false, available: true, adminLogin: false, billingAvailable: false, canSubscribe: false, allowance: { used: 1, limit: 2, periodEnd: 3 }, audioScope: null });
    expect(fetchImpl).toHaveBeenCalledWith('/api/plus/status', { signal: expect.any(AbortSignal) });
    expect(localStorage.getItem('rise.plus')).toBeNull();
    expect(await fetchPlusStatus({ fetchImpl: async () => Response.json({ admin: 'true', subscriber: 1, available: true }) })).toEqual({ confirmed: false, admin: false, subscriber: false, available: true, adminLogin: false, billingAvailable: false, canSubscribe: false, allowance: null, audioScope: null });
  });
  it('fails closed when status is unavailable', async () => {
    for (const fetchImpl of [async () => { throw new Error('offline'); }, async () => new Response(null, { status: 503 })]) {
      expect(await fetchPlusStatus({ fetchImpl })).toEqual({ confirmed: false, admin: false, subscriber: false, available: false, adminLogin: false, billingAvailable: false, canSubscribe: false, allowance: null, audioScope: null });
    }
  });
});

 it('bounds a stalled status request so a reading can continue silently', async () => {
   vi.useFakeTimers();
   let result;
   fetchPlusStatus({ fetchImpl: () => new Promise(() => {}), timeoutMs: 20 }).then(status => { result = status; });
   await vi.advanceTimersByTimeAsync(20);
   expect(result).toEqual({ confirmed: false, admin: false, subscriber: false, available: false, adminLogin: false, billingAvailable: false, canSubscribe: false, allowance: null, audioScope: null });
 });
