import { test, expect } from '@playwright/test';
import { chromium } from '@playwright/test';
import { createDecoupledRunState, startDecoupledServer } from './server.mjs';
import { buildDecoupledWidgetHtml } from './widget-build.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
let server;
let browser;

test.beforeAll(async () => {
  browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
});
test.beforeEach(async () => {
  const widgetHtml = await buildDecoupledWidgetHtml();
  const testHarnessHtml = await readFile(path.join(here, 'fake-host.html'), 'utf8');
  server = await startDecoupledServer({ port: 0, widgetHtml, testHarnessHtml });
});
test.afterEach(async () => {
  if (server) await new Promise(resolve => server.server.close(resolve));
  server = null;
});
test.afterAll(async () => {
  await browser?.close();
});

test('reader calls update one actual renderer and retain its canvas identity', async () => {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address.port}/__gate0/host`);
  const frame = page.frameLocator('#widget');
  await page.getByRole('button', { name: 'Open visual surface', exact: true }).click();
  await expect(frame.locator('[data-applied-sequence="0"]')).toHaveCount(1);
  await frame.getByRole('button', { name: 'Set intensity 0.4', exact: true }).click();
  await expect(frame.locator('canvas.attractor-canvas')).toHaveCount(1);
  const original = await frame.locator('canvas.attractor-canvas').elementHandle();
  await frame.getByRole('button', { name: 'Set intensity 0.75', exact: true }).click();
  const current = await frame.locator('canvas.attractor-canvas').elementHandle();
  expect(await current.evaluate((element, previous) => element === previous, original)).toBe(true);
  await expect(frame.locator('[data-applied-sequence="2"]')).toHaveCount(1);
  await page.close();
});

test('only received bridge deliveries change the surface; a manual read is labeled', async () => {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address.port}/__gate0/host`);
  const frame = page.frameLocator('#widget');
  await page.getByRole('button', { name: 'Open visual surface', exact: true }).click();
  await page.getByRole('button', { name: 'Model set 0.4 and notify' }).click();
  await expect(frame.locator('canvas.attractor-canvas')).toHaveCount(1);
  await expect(frame.locator('[data-applied-sequence="1"]')).toHaveCount(1);
  await expect(frame.locator('#delivery-source')).toHaveText('Delivery source: host_notification');
  const original = await frame.locator('canvas.attractor-canvas').elementHandle();
  await page.getByRole('button', { name: 'Model set 0.75 without notification' }).click();
  await expect(frame.locator('[data-applied-sequence="1"]')).toHaveCount(1);
  await expect(frame.locator('[data-server-sequence="1"]')).toHaveCount(1);
  const unchanged = await frame.locator('canvas.attractor-canvas').elementHandle();
  expect(await unchanged.evaluate((element, previous) => element === previous, original)).toBe(true);
  await frame.getByRole('button', { name: 'Read server state', exact: true }).click();
  await expect(frame.locator('[data-applied-sequence="2"]')).toHaveCount(1);
  await expect(frame.locator('[data-server-sequence="2"]')).toHaveCount(1);
  await expect(frame.locator('#delivery-source')).toContainText('manual_read');
  await page.close();
});

test('rejects a foreign-frame notification after the outsider is ready', async () => {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address.port}/__gate0/host`);
  const frame = page.frameLocator('#widget');
  await page.getByRole('button', { name: 'Open visual surface', exact: true }).click();
  await frame.getByRole('button', { name: 'Set intensity 0.4', exact: true }).click();
  await expect(frame.locator('canvas.attractor-canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Create ready outsider' }).click();
  await expect(page.locator('#host-status')).toContainText('Outsider ready');
  const canvas = await frame.locator('canvas.attractor-canvas').elementHandle();
  await page.getByRole('button', { name: 'Send foreign notification' }).click();
  await expect(page.locator('#host-status')).toContainText('Foreign notification sent');
  await expect(frame.locator('[data-applied-sequence="1"]')).toHaveCount(1);
  expect(await canvas.evaluate(element => element.isConnected)).toBe(true);
  await page.close();
});

test('ignores oversized parent envelopes before parsing or recording them', async () => {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address.port}/__gate0/host`);
  const frame = page.frameLocator('#widget');
  await page.getByRole('button', { name: 'Open visual surface', exact: true }).click();
  await frame.getByRole('button', { name: 'Set intensity 0.4', exact: true }).click();
  await expect(frame.locator('canvas.attractor-canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Send oversized notification' }).click();
  await expect(page.locator('#host-status')).toContainText('Oversized notification sent');
  await expect(frame.locator('[data-applied-sequence="1"]')).toHaveCount(1);
  await expect(frame.locator('#log li')).toHaveCount(2);
  await page.close();
});

test('duplicate, stale, run-mismatched, and refused deliveries preserve the accepted renderer', async () => {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address.port}/__gate0/host`);
  const frame = page.frameLocator('#widget');
  await page.getByRole('button', { name: 'Open visual surface', exact: true }).click();
  await frame.getByRole('button', { name: 'Set intensity 0.4', exact: true }).click();
  await expect(frame.locator('canvas.attractor-canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Deliver sequence cases' }).click();
  await expect(frame.locator('[data-applied-sequence="2"]')).toHaveCount(1);
  await expect(frame.locator('#status')).toContainText('refused');
  await expect(frame.locator('canvas.attractor-canvas')).toHaveCount(1);
  await expect(frame.locator('#log li')).toHaveCount(7);
  await page.close();
});

test('timeout and Stop are bounded, explicit, and idempotent', async () => {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address.port}/__gate0/host`);
  const frame = page.frameLocator('#widget');
  await page.getByRole('button', { name: 'Open visual surface', exact: true }).click();
  await page.getByRole('button', { name: 'Withhold next response' }).click();
  await frame.getByRole('button', { name: 'Set intensity 0.4', exact: true }).click();
  await expect(frame.locator('#reader-status')).toContainText('timed out', { timeout: 10_000 });
  await frame.getByRole('button', { name: 'Stop', exact: true }).click();
  await frame.getByRole('button', { name: 'Stop', exact: true }).click().catch(() => {});
  await expect(frame.locator('body')).toHaveAttribute('data-stopped', 'true');
  await page.close();
});

test('a matched completion arriving after Stop cannot change widget UI', async () => {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address.port}/__gate0/host`);
  const frame = page.frameLocator('#widget');
  await page.getByRole('button', { name: 'Open visual surface', exact: true }).click();
  await page.getByRole('button', { name: 'Delay next response' }).click();
  await frame.getByRole('button', { name: 'Set intensity 0.4', exact: true }).click();
  await frame.getByRole('button', { name: 'Stop', exact: true }).click();
  const statusAtStop = await frame.locator('#status').textContent();
  await expect(page.locator('#host-status')).toContainText('Late response sent.');
  await expect(frame.locator('body')).toHaveAttribute('data-stopped', 'true');
  expect(await frame.locator('#status').textContent()).toBe(statusAtStop);
  await page.close();
});

test('keeps at most four matched host requests pending', async () => {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address.port}/__gate0/host`);
  const frame = page.frameLocator('#widget');
  await page.getByRole('button', { name: 'Open visual surface', exact: true }).click();
  await expect(frame.locator('#delivery-source')).toHaveText('Delivery source: initial_render');
  await expect(page.locator('#host-status')).toHaveText('Widget initialized.');
  await page.getByRole('button', { name: 'Withhold next four responses' }).click();
  const set = frame.getByRole('button', { name: 'Set intensity 0.4', exact: true });
  await Promise.all([set.click(), set.click(), set.click(), set.click(), set.click()]);
  await expect(frame.locator('#log')).toContainText('"errorCategory":"request_limit"');
  await frame.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.close();
});
