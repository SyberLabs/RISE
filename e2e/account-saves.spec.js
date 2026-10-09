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
    const headers = { 'Access-Control-Allow-Origin': new URL(page.url()).origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type,X-SyberLabs-Account', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const pathname = new URL(req.url()).pathname;
    let body = { user: { id: 'u1', label: 'Test reader' } };
    if (req.method() === 'POST') { onPost(req); body = { save }; }
    else if (pathname.endsWith('/saves')) body = { saves: [save] };
    else if (pathname.endsWith('/saves/save-1')) body = { save: { ...save, payload } };
    await route.fulfill({ status: 200, headers, json: { version: 1, ...body } });
  });
}

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
