import { test, expect } from './fixtures.js';

const offer = { checkoutAvailable: true, recoveryAvailable: true, offer: { amount: 899, currency: 'usd', interval: 'month', characterLimit: 60000 } };
async function api(page, { config = offer, subscriber = false, billing = false } = {}) {
  const calls = [];
  await page.route('**/api/plus/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON();
    calls.push({ path, body });
    if (path.endsWith('/config')) return route.fulfill({ json: config });
    if (path.endsWith('/claim') || path.endsWith('/restore')) { subscriber = true; billing = true; return route.fulfill({ status: 204 }); }
    if (path.endsWith('/recover')) return route.fulfill({ status: 202, json: { accepted: true } });
    if (path.endsWith('/checkout')) return route.fulfill({ status: 503, json: { error: { code: 'PLUS_UNAVAILABLE', message: 'Checkout is temporarily unavailable.' } } });
    if (path.endsWith('/status')) return route.fulfill({ json: { subscriber, available: subscriber, canSubscribe: !subscriber, billingAvailable: billing, allowance: subscriber ? { used: 15, limit: 60000, periodEnd: 2000000000 } : null } });
    return route.fulfill({ json: [] });
  });
  return calls;
}

test('Plus offers a readable mobile purchase/recovery flow without gating the reader', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const calls = await api(page);
  await page.goto('/plus/');
  await expect(page.getByRole('heading', { name: 'Give your reading a voice.' })).toBeVisible();
  await expect(page.locator('[data-offer]')).toContainText('60,000');
  await expect(page.locator('[data-price]')).toContainText('$8.99');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Subscribe to Plus' }).click();
  await expect(page.locator('[data-message]')).toContainText('temporarily unavailable');
  expect(calls.find(call => call.path.endsWith('/checkout')).body.request_id).toMatch(/^[a-f0-9-]{36}$/);
  await page.getByLabel('Your checkout email').fill('reader@example.test');
  await page.getByRole('button', { name: 'Send a recovery link' }).click();
  await expect(page.locator('[data-message]')).toContainText('If a subscription matches');
  await page.getByRole('link', { name: 'Keep reading free' }).click();
  await expect(page.getByRole('heading', { name: 'Read your own text' })).toBeVisible();
});

test('Checkout and email callbacks clear credentials and confirm access through the API', async ({ page }) => {
  const calls = await api(page);
  await page.goto('/plus/claim?session_id=cs_test_customer');
  await expect(page.locator('[data-message]')).toContainText('confirmed');
  await expect(page).toHaveURL(/\/plus\/$/);
  await expect(page.getByRole('button', { name: 'Manage billing & cancellation' })).toBeVisible();
  expect(calls.find(call => call.path.endsWith('/claim')).body).toEqual({ session_id: 'cs_test_customer' });
  await page.goto('/plus/restore#token=fixture-secret');
  await expect(page.locator('[data-message]')).toContainText('confirmed');
  await expect(page).toHaveURL(/\/plus\/$/);
  expect(calls.find(call => call.path.endsWith('/restore')).body).toEqual({ token: 'fixture-secret' });
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('fixture-secret');
  await expect(page.getByRole('button', { name: 'Subscribe to Plus' })).toBeHidden();
});

test('closed checkout is honest while canceled customers can still manage billing', async ({ page }) => {
  await api(page, { config: { checkoutAvailable: false, recoveryAvailable: false, offer: null }, billing: true });
  await page.goto('/plus/');
  await expect(page.locator('[data-price]')).toContainText('Subscriptions are not available');
  await expect(page.getByRole('button', { name: 'Subscribe to Plus' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Manage billing & cancellation' })).toBeVisible();
  await expect(page.getByLabel('Your checkout email')).toBeDisabled();
});

test('an own-text draft survives the checkout return and awaits an explicit voice Begin', async ({ page }) => {
  const calls = await api(page);
  await page.goto('/try/your-text/');
  await expect(page.getByRole('heading', { name: 'Read your own text' })).toBeVisible();
  await page.locator('#try-text').fill('This is my own passage, kept through checkout.');
  // Exercise the same completion handoff as the Chamber without waiting for timed playback.
  await page.evaluate(() => window.__RISE_TEST__.getView('read').paneInstance('try').update({ kind: 'text', stage: 'complete' }));
  await page.getByRole('link', { name: 'Add voice to this reading' }).click();
  await expect(page).toHaveURL(/\/plus\/$/);
  await page.goto('/plus/claim?session_id=cs_test_continuation');
  await expect(page.getByRole('link', { name: 'Continue your reading' })).toBeVisible();
  await page.getByRole('link', { name: 'Continue your reading' }).click();
  await expect(page.locator('.voice-demo textarea')).toHaveValue('This is my own passage, kept through checkout.');
  await expect(page.locator('[data-look]')).toHaveValue('sample');
  expect(calls.some(call => call.path.endsWith('/voice'))).toBe(false);
  expect(await page.evaluate(() => sessionStorage.getItem('rise.plus.continuation'))).toBeNull();
});
