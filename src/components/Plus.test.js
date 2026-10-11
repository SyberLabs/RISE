import { afterEach, expect, it, vi } from 'vitest';
import { Plus } from './Plus.js';
import { capturePlusCallback } from '../app/plus-callback.js';
let view;
afterEach(() => { view?.destroy(); document.body.innerHTML = ''; vi.unstubAllGlobals(); localStorage.clear(); window.history.replaceState({}, '', '/'); });
const config = { checkoutAvailable: true, recoveryAvailable: true, offer: { amount: 899, currency: 'usd', interval: 'month', characterLimit: 60000 } };
function mount(replies = {}, options = {}) {
  vi.stubGlobal('fetch', vi.fn(async (path, init) => {
    const value = replies[path] ?? (path.endsWith('/config') ? config : { subscriber: false, available: false, billingAvailable: false });
    return typeof value === 'function' ? value(init) : Response.json(value);
  }));
  const root = document.createElement('div'); document.body.append(root);
  view = new Plus(root, options);
  return root;
}
it('shows the real offer, leaves free reading accessible, and recovers without claiming success from email', async () => {
  const root = mount({ '/api/plus/recover': () => new Response(null, { status: 202 }) });
  await view.ready;
  expect(root.textContent).toContain('60,000');
  expect(root.textContent).toContain('$8.99');
  expect(root.querySelector('[data-checkout]').hidden).toBe(false);
  root.querySelector('input[type=email]').value = 'reader@example.com';
  root.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(root.querySelector('[data-message]').textContent).toContain('If a subscription matches'));
  expect(root.querySelector('a[href="/try/"]')).not.toBeNull();
});
it('does not offer a second purchase to a subscriber and permits billing after entitlement lapses', async () => {
  const root = mount({ '/api/plus/status': { subscriber: true, available: true, billingAvailable: true, allowance: { used: 20, limit: 60000, periodEnd: 2000000000 } } });
  await view.ready;
  expect(root.querySelector('[data-checkout]').hidden).toBe(true);
  expect(root.querySelector('[data-billing]').hidden).toBe(false);
  expect(root.textContent).toContain('20 of 60,000');
  view.destroy();
  const lapsed = mount({ '/api/plus/status': { subscriber: false, available: false, billingAvailable: true } });
  await view.ready;
  expect(lapsed.querySelector('[data-billing]').hidden).toBe(false);
});
it('keeps unavailable checkout honest and recovers from a payment failure without leaving the page', async () => {
  const root = mount({ '/api/plus/config': { checkoutAvailable: false, recoveryAvailable: false, offer: null } });
  await view.ready;
  expect(root.querySelector('[data-checkout]').hidden).toBe(true);
  expect(root.textContent).toContain('Subscriptions are not available');
  expect(root.querySelector('input[type=email]').disabled).toBe(true);
});
it('claims a callback before checking status and offers a retry without retaining the secret in the URL', async () => {
  window.history.replaceState({}, '', '/plus/claim?session_id=cs_test_1'); capturePlusCallback();
  let claims = 0;
  const root = mount({ '/api/plus/claim': () => ++claims === 1 ? Response.json({ error: { message: 'Please retry confirmation.' } }, { status: 503 }) : new Response(null, { status: 204 }) });
  await view.ready;
  expect(root.querySelector('[data-retry]').hidden).toBe(false);
  expect(window.location.search).toBe('');
  root.querySelector('[data-retry]').click();
  await vi.waitFor(() => expect(root.querySelector('[data-message]').textContent).toContain('confirmed'));
  expect(claims).toBe(2);
});
it('uses one request id across checkout retries and prevents double submission', async () => {
  let resolve;
  const redirect = vi.fn();
  const root = mount({ '/api/plus/checkout': () => new Promise(r => { resolve = r; }) }, { redirect });
  await view.ready;
  root.querySelector('[data-checkout]').click(); root.querySelector('[data-checkout]').click();
  expect(root.querySelector('[data-checkout]').disabled).toBe(true);
  resolve(Response.json({ error: { message: 'Try again' } }, { status: 503 }));
  await vi.waitFor(() => expect(root.querySelector('[data-checkout]').disabled).toBe(false));
  root.querySelector('[data-checkout]').click();
  const calls = fetch.mock.calls.filter(([path]) => path.endsWith('/checkout'));
  expect(calls).toHaveLength(2); expect(calls[0][1].body).toBe(calls[1][1].body);
  resolve(Response.json({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' }));
  await vi.waitFor(() => expect(redirect).toHaveBeenCalled());
});
it('does not invite a duplicate purchase when subscription status cannot be checked', async () => {
  const root = mount({ '/api/plus/status': () => new Response(null, { status: 503 }) });
  await view.ready;
  expect(root.querySelector('[data-checkout]').hidden).toBe(true);
  expect(root.querySelector('[data-account]').textContent).toContain('could not be checked');
});
it('does not redirect a reader who leaves while checkout is opening', async () => {
  let finish;
  const redirect = vi.fn();
  const root = mount({ '/api/plus/checkout': () => new Promise(resolve => { finish = resolve; }) }, { redirect });
  await view.ready;
  root.querySelector('[data-checkout]').click();
  view.deactivate();
  finish(Response.json({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' }));
  await vi.waitFor(() => expect(view.busy).toBe(false));
  expect(redirect).not.toHaveBeenCalled();
});
it('keeps recovery available after a claim is refused and does not offer a duplicate purchase', async () => {
  window.history.replaceState({}, '', '/plus/claim?session_id=cs_test_elsewhere'); capturePlusCallback();
  const root = mount({ '/api/plus/claim': () => Response.json({ error: { code: 'CHECKOUT_BROWSER_REQUIRED', message: 'Restore your subscription by email.' } }, { status: 401 }) });
  await view.ready;
  expect(root.querySelector('[data-message]').textContent).toContain('Restore your subscription by email');
  expect(root.querySelector('[data-checkout]').hidden).toBe(true);
  expect(root.querySelector('input[type=email]').disabled).toBe(false);
});
it('lets a verified former subscriber subscribe again while keeping billing management', async () => {
  const root = mount({ '/api/plus/status': { subscriber: false, available: false, billingAvailable: true } });
  await view.ready;
  expect(root.querySelector('[data-checkout]').hidden).toBe(false);
  expect(root.querySelector('[data-checkout]').textContent).toContain('Subscribe again');
  expect(root.querySelector('[data-billing]').hidden).toBe(false);
});
