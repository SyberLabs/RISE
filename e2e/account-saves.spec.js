import { test, expect } from './fixtures.js';

const work = {
  schema: 'rise.local-work.v1', id: 'local-account-poem', title: 'Account poem', author: null,
  createdAt: '2026-10-08T00:00:00Z', sourceName: 'poem.txt', text: 'The sea is still.',
  cuts: [0, 17], labels: ['Reading 1'], noun: 'Reading', authored: false, reason: 'measured'
};
const payload = { schema: 'rise.account-work.v1', work };
const save = { id: 'save-1', app: 'rise', name: 'Account poem', createdAt: '2026-10-08T00:00:00Z', bytes: 400 };
const seed = async page => page.evaluate(async record => {
  await new Promise((resolve, reject) => {
    const request = indexedDB.open('rise-local-works', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('works', { keyPath: 'id' });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('works', 'readwrite');
      tx.objectStore('works').put(record);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  });
}, work);

async function mockAccount(page, onPost = () => {}) {
  await page.route('https://syberlabs.io/admin/api/v1/**', async route => {
    const req = route.request();
    const headers = { 'Access-Control-Allow-Origin': new URL(page.url()).origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type,X-SyberLabs-Account,X-SyberLabs-Expected-User', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const pathname = new URL(req.url()).pathname;
    if (pathname.includes('/saves') && !req.headers()['x-syberlabs-expected-user']) return route.fulfill({ status: 400, headers, json: { version: 1, error: 'expected_user_required' } });
    if (pathname.includes('/saves') && req.headers()['x-syberlabs-expected-user'] !== 'u1') return route.fulfill({ status: 409, headers, json: { version: 1, error: 'account_changed' } });
    let body = { user: { id: 'u1', label: 'Test reader' } };
    if (req.method() === 'POST') { expect(req.headers()['x-syberlabs-expected-user']).toBe('u1'); onPost(req); body = { save }; }
    else if (pathname.endsWith('/saves')) body = { saves: [save] };
    else if (pathname.endsWith('/saves/save-1')) body = { save: { ...save, payload } };
    await route.fulfill({ status: 200, headers, json: { version: 1, ...body } });
  });
}

test('standalone policy and app-information pages retain the upper-right sign-in entrance', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const path of ['/privacy.html', '/terms.html', '/apps.html']) {
    await page.goto(path);
    const link = page.getByRole('link', { name: 'Sign in to SyberLabs' });
    await expect(link).toBeVisible();
    expect(new URL(await link.getAttribute('href')).searchParams.get('next')).toBe('/admin/return?app=rise');
    const reachable = await link.evaluate(node => {
      const r = node.getBoundingClientRect();
      return r.right <= innerWidth && r.height >= 44 && node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    });
    expect(reachable).toBe(true);
  }
});

test('account is visible and clickable in the upper right across routes on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockAccount(page);
  for (const path of ['/', '/library', '/make', '/settings', '/read', '/wormhole.html']) {
    await page.goto(path);
    const account = page.getByRole('link', { name: 'Open SyberLabs account' });
    await expect(account).toBeVisible();
    const box = await account.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect(box.x).toBeGreaterThan(250);
    expect(box.y).toBeLessThan(30);
    await account.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close account' }).click();
  }
});

test('explicit account save and validated restore round trip through browser library', async ({ page }) => {
  let posted;
  await mockAccount(page, req => { posted = req.postDataJSON(); });
  await page.goto('/');
  await seed(page);
  await page.getByRole('link', { name: 'Open SyberLabs account' }).click();
  await page.getByRole('button', { name: 'Save to account', exact: true }).click();
  await expect(page.locator('[data-status]')).toHaveText('Saved “Account poem” to your account.');
  expect(posted.app).toBe('rise');
  expect(posted.payload).toEqual(payload);
  expect(posted.requestId).toMatch(/^[a-f0-9-]{36}$/);
  await page.evaluate(() => new Promise(resolve => { const req = indexedDB.open('rise-local-works', 1); req.onsuccess = () => { const db = req.result; const tx = db.transaction('works', 'readwrite'); tx.objectStore('works').clear(); tx.oncomplete = () => { db.close(); resolve(); }; }; }));
  await page.getByRole('button', { name: 'Restore to browser library' }).click();
  await expect(page.locator('[data-status]')).toContainText('Restored “Account poem”');
  const restored = await page.evaluate(() => new Promise(resolve => { const req = indexedDB.open('rise-local-works', 1); req.onsuccess = () => { const db = req.result; const get = db.transaction('works').objectStore('works').get('local-account-poem'); get.onsuccess = () => { db.close(); resolve(get.result); }; }; }));
  expect(restored.text).toBe(work.text);
});

test('a detail response from an old account cannot overwrite the browser library after account refresh', async ({ page }) => {
  let accountId = 'u1';
  let releaseDetail;
  let profileReads = 0;
  await page.route('https://syberlabs.io/admin/api/v1/**', async route => {
    const req = route.request();
    const headers = { 'Access-Control-Allow-Origin': new URL(page.url()).origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type,X-SyberLabs-Account,X-SyberLabs-Expected-User', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const pathname = new URL(req.url()).pathname;
    if (pathname.endsWith('/account')) {
      await route.fulfill({ status: 200, headers, json: { version: 1, user: { id: accountId, label: accountId } } });
      profileReads++;
      return;
    }
    expect(req.headers()['x-syberlabs-expected-user']).toBe('u1');
    if (pathname.endsWith('/saves/save-1')) {
      // The producer already accepted user A; deliver that valid response after
      // the global entrance has observed user B, to exercise the client write guard.
      await new Promise(resolve => { releaseDetail = resolve; });
      return route.fulfill({ status: 200, headers, json: { version: 1, save: { ...save, payload } } });
    }
    return route.fulfill({ status: 200, headers, json: { version: 1, saves: [save] } });
  });
  await page.goto('/');
  await seed(page);
  await page.getByRole('link', { name: 'Open SyberLabs account' }).click();
  await page.locator('[data-replace]').check();
  await page.getByRole('button', { name: 'Restore to browser library' }).click();
  await expect.poll(() => typeof releaseDetail).toBe('function');
  const readsBefore = profileReads;
  accountId = 'u2';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => profileReads).toBeGreaterThan(readsBefore);
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
  releaseDetail();
  await expect(page.locator('[data-status]')).toContainText('no longer current');
  const rows = await page.evaluate(() => new Promise(resolve => { const req = indexedDB.open('rise-local-works', 1); req.onsuccess = () => { const db = req.result; const get = db.transaction('works').objectStore('works').getAll(); get.onsuccess = () => { db.close(); resolve(get.result); }; }; }));
  expect(rows).toEqual([work]);
});
