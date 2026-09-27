import { test, expect } from './fixtures.js';
import { readFile } from 'node:fs/promises';

const paragraphs = ['A quiet word. '.repeat(20).trim(), 'Another moment. '.repeat(20).trim()];
const gate = { code: 'rise2025', name: 'M', vault: null, timestamp: Date.now() };
async function admit(page) {
  await page.addInitScript(value => localStorage.setItem('rise-beta-session', JSON.stringify(value)), gate);
}

test('create, revise, keep, Vault export, fresh-browser import and explicit Start', async ({ page, browser }) => {
  test.setTimeout(90000);
  await admit(page);
  const requests = [];
  await page.route('**/api/personal-piece', async route => {
    const body = route.request().postDataJSON(); requests.push(body);
    await route.fulfill({ json: { requestId: body.requestId, title: body.mode === 'revise' ? 'Second version' : 'First version',
      paragraphs, writerModel: 'qwen/qwen3.5-9b', promptVersion: 'personal-v1' } });
  });
  await page.goto('/');
  await page.locator('[data-nav="create"]').click();
  await expect(page.locator('.personal-create')).toBeVisible();
  await page.getByLabel('Your thought', { exact: true }).fill('PRIVATE thought');
  await page.getByLabel('Optional detail', { exact: true }).fill('PRIVATE detail');
  await page.getByRole('button', { name: 'Write a piece', exact: true }).click();
  await expect(page.locator('[data-title]')).toHaveText('First version');
  await expect(page.locator('[data-text]')).toContainText(paragraphs[1]);
  expect(await page.evaluate(() => localStorage.getItem('rise_workshop_v1'))).toBeNull();
  await page.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(page.locator('[data-status]')).toContainText('Kept');
  await page.getByRole('button', { name: 'Change something', exact: true }).click();
  await page.getByLabel('What would you change?', { exact: true }).fill('Give it another title');
  await page.getByRole('button', { name: 'Make a revision', exact: true }).click();
  await expect(page.locator('[data-title]')).toHaveText('Second version');
  expect(requests[1]).toMatchObject({ mode: 'revise', parent: { title: 'First version', paragraphs }, instruction: 'Give it another title' });
  expect(requests[1]).not.toHaveProperty('thought');
  await page.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(page.locator('[data-status]')).toContainText('Kept');
  const stored = await page.evaluate(() => localStorage.getItem('rise_workshop_v1'));
  expect(stored).not.toContain('PRIVATE'); expect(stored).not.toContain('Give it another title');
  const records = JSON.parse(stored);
  expect(records).toHaveLength(2);
  expect(records[0].provenance.parentRevisionId).toBe(records[1].id);
  await page.getByRole('button', { name: 'Vault', exact: true }).click();
  await page.locator('[data-section="custom"]').click();
  const row = page.locator('.sequence-card').filter({ hasText: 'Second version' });
  await expect(row.getByRole('button', { name: 'Revise', exact: true })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download');
  await row.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await downloadPromise;
  const json = await readFile(await download.path(), 'utf8');
  expect(JSON.parse(json)).toEqual(records[0]);
  const textPromise = page.waitForEvent('download');
  await row.getByRole('button', { name: 'Export text', exact: true }).click();
  const textDownload = await textPromise;
  expect(await readFile(await textDownload.path(), 'utf8')).toBe(`Second version\n\n${paragraphs.join('\n\n')}\n`);

  const fresh = await browser.newContext();
  const imported = await fresh.newPage(); await admit(imported);
  let modelCalls = 0;
  await imported.route('**/api/personal-piece', route => { modelCalls++; return route.abort(); });
  await imported.goto('/create');
  await imported.locator('[data-import]').setInputFiles({ name: 'reading.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await expect(imported.locator('[data-title]')).toHaveText('Second version');
  await expect(imported.locator('[data-text]')).toContainText(paragraphs[1]);
  await expect(imported.locator('[data-status]')).toContainText('not verified');
  await imported.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(imported.locator('[data-status]')).toContainText('Kept');
  expect(await imported.evaluate(() => JSON.parse(localStorage.getItem('rise_workshop_v1'))[0])).toEqual(records[0]);
  await imported.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(imported.locator('#view-chamber')).toBeVisible({ timeout: 30000 });
  expect(modelCalls).toBe(0);
  await fresh.close();
});

test('unavailable writer leaves import and text controls accessible', async ({ page }) => {
  await admit(page);
  await page.route('**/api/personal-piece', route => route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Disabled' } } }));
  await page.goto('/create');
  await page.getByLabel('Your thought', { exact: true }).fill('A thought');
  await page.getByRole('button', { name: 'Write a piece', exact: true }).click();
  await expect(page.locator('[data-status]')).toContainText('currently unavailable');
  await expect(page.locator('[data-import]')).toBeVisible();
});

test('optional media failure restores the original readable and saveable draft', async ({ page }) => {
  await admit(page);
  await page.route('**/visual-cortex-*.js', route => route.abort());
  await page.route('**/api/personal-piece', async route => route.fulfill({ json: {
    requestId: route.request().postDataJSON().requestId, title: 'Still here', paragraphs,
    writerModel: 'qwen/qwen3.5-9b', promptVersion: 'personal-v1'
  } }));
  await page.goto('/create');
  await page.getByLabel('Your thought', {exact:true}).fill('A place I remember');
  await page.getByRole('button', {name:'Write a piece',exact:true}).click();
  await expect(page.locator('[data-title]')).toHaveText('Still here');
  await page.getByRole('button', {name:'Start',exact:true}).click();
  await expect(page.locator('[data-status]')).toContainText('full text');
  await expect(page.locator('[data-text]')).toBeVisible();
  await page.getByRole('button', {name:'Keep',exact:true}).click();
  await expect(page.locator('[data-status]')).toContainText('Kept');
});

test('missing Vault chunk cannot reload away an unkept draft', async ({ page }) => {
  await admit(page);
  let documents = 0;
  page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
  await page.route('**/Vault-*.js', route => route.abort());
  await page.route('**/api/personal-piece', route => route.fulfill({ json: {
    requestId: route.request().postDataJSON().requestId, title: 'Unkept', paragraphs,
    writerModel: 'qwen/qwen3.5-9b', promptVersion: 'personal-v1'
  } }));
  await page.goto('/create');
  await page.getByLabel('Your thought', { exact: true }).fill('One thought');
  await page.getByRole('button', { name: 'Write a piece', exact: true }).click();
  await expect(page.locator('[data-title]')).toHaveText('Unkept');
  // Wait for the router to refuse the missing chunk and restore Create; a Keep
  // pressed before then belongs to the navigation it would race.
  const refused = page.waitForEvent('console', message => message.text().includes('Navigation to "vault" failed'));
  await page.getByRole('button', { name: 'Vault', exact: true }).click();
  await refused;
  await expect(page.locator('[data-text]')).toBeVisible();
  await page.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(page.locator('[data-status]')).toContainText('Kept');
  expect(documents).toBe(1);
});

test('after a deploy removes unloaded chunks, an unkept draft can still be kept and exported', async ({ page }) => {
  await admit(page);
  await page.route('**/api/personal-piece', route => route.fulfill({ json: {
    requestId: route.request().postDataJSON().requestId, title: 'Before deploy', paragraphs,
    writerModel: 'qwen/qwen3.5-9b', promptVersion: 'personal-v1'
  } }));
  await page.goto('/create');
  await page.getByLabel('Your thought', { exact: true }).fill('One thought');
  await page.getByRole('button', { name: 'Write a piece', exact: true }).click();
  await expect(page.locator('[data-title]')).toHaveText('Before deploy');
  // A deploy replaces every hashed chunk this page has not loaded yet.
  await page.route('**/assets/*.js', route => route.abort());
  await page.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(page.locator('[data-status]')).toContainText('Kept');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export text', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^personal-.*\.txt$/);
});
