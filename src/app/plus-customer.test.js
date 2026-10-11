import { afterEach, expect, it, vi } from 'vitest';
import { fetchPlusOffer, startPlusCheckout, openPlusBilling, recoverPlus, restorePlus } from './plus-customer.js';
import { plusState } from './plus.js';
import { capturePlusCallback, takePlusCallback } from './plus-callback.js';
afterEach(() => { localStorage.clear(); window.history.replaceState({}, '', '/'); takePlusCallback(); });
it('offers checkout only with the server-confirmed fixed offer, never a legacy payment link', async () => {
  const fetchImpl = async () => Response.json({ checkoutAvailable: true, recoveryAvailable: true, offer: { amount: 899, currency: 'usd', interval: 'month', characterLimit: 60000 } });
  expect(await fetchPlusOffer({ fetchImpl })).toMatchObject({ checkoutAvailable: true, recoveryAvailable: true, offer: { characterLimit: 60000 } });
  for (const body of [{ paymentLink: 'https://buy.stripe.com/x' }, { checkoutAvailable: true, offer: null }]) {
    expect((await fetchPlusOffer({ fetchImpl: async () => Response.json(body) })).checkoutAvailable).toBe(false);
  }
});
it('bounds an unavailable config request', async () => {
  vi.useFakeTimers();
  const pending = fetchPlusOffer({ fetchImpl: () => new Promise(() => {}), timeoutMs: 20 });
  await vi.advanceTimersByTimeAsync(20);
  expect((await pending).checkoutAvailable).toBe(false);
  vi.useRealTimers();
});
it('sends a reusable checkout request id and allows only the expected Stripe redirect host', async () => {
  const fetchImpl = vi.fn(async () => Response.json({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' }));
  expect(await startPlusCheckout('request-1', { fetchImpl })).toEqual({ ok: true, url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
  expect(fetchImpl).toHaveBeenCalledWith('/api/plus/checkout', expect.objectContaining({ method: 'POST', body: '{"request_id":"request-1"}' }));
  expect((await startPlusCheckout('request-1', { fetchImpl: async () => Response.json({ url: 'https://checkout.stripe.com.evil.test/' }) })).ok).toBe(false);
  expect((await openPlusBilling({ fetchImpl: async () => Response.json({ url: 'https://billing.stripe.com/p/session/example' }) })).ok).toBe(true);
});
it('does not infer ownership from a recovery email; only a confirmed restore marks the browser', async () => {
  expect(await recoverPlus('person@example.com', { fetchImpl: async () => new Response(null, { status: 202 }) })).toEqual({ ok: true });
  expect(plusState().claimed).toBe(false);
  expect(await restorePlus('secret', { fetchImpl: async () => new Response(null, { status: 204 }) })).toEqual({ ok: true });
  expect(plusState().claimed).toBe(true);
});
it('captures callback secrets once, erasing address before any request and never storing them', () => {
  window.history.replaceState({}, '', '/plus/restore#token=private');
  capturePlusCallback();
  expect(window.location.pathname + window.location.search + window.location.hash).toBe('/plus/');
  expect(takePlusCallback()).toEqual({ kind: 'restore', value: 'private' });
  expect(takePlusCallback()).toBeNull();
  expect(localStorage.length).toBe(0);
  window.history.replaceState({}, '', '/plus/claim?session_id=cs_test_1');
  capturePlusCallback();
  expect(takePlusCallback()).toEqual({ kind: 'claim', value: 'cs_test_1' });
  expect(window.location.search).toBe('');
});
it('bounds a stalled payment confirmation so the customer can retry or recover', async () => {
  const { confirmPlusPurchase } = await import('./plus-customer.js');
  vi.useFakeTimers();
  const pending = confirmPlusPurchase('cs_test_1', { fetchImpl: () => new Promise(() => {}), timeoutMs: 20 });
  await vi.advanceTimersByTimeAsync(20);
  expect((await pending).ok).toBe(false);
  expect(plusState().claimed).toBe(false);
  vi.useRealTimers();
});
