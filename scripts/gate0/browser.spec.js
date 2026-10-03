import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startGate0Server } from './server.mjs';

let host;
let base;
test.beforeAll(async () => {
  const testHarnessHtml = await readFile(resolve('scripts/gate0/fake-host.html'), 'utf8');
  host = await startGate0Server({ port: 0, testHarnessHtml });
  base = `http://127.0.0.1:${host.address.port}`;
});
test.afterAll(async () => {
  if (!host) return;
  await new Promise(resolveClose => host.server.close(resolveClose));
});

const snapshot = (sequence, intensity = 0.65) => ({
  runId: '57be2c5a-6b58-4a21-92d5-c70be9e4d592', sequence, visual: 'attractor', intensity,
  serverReceivedAt: '2026-10-02T12:00:00.000Z', serverAppliedAt: '2026-10-02T12:00:00.010Z'
});

test('simulation: MCP Apps host delivers results to one real renderer, records distinct evidence, and tears down', async ({ page }) => {
  await page.goto(`${base}/__gate0/host`);
  await page.waitForFunction(() => window.gate0Host.calls.some(message => message.method === 'ui/notifications/initialized'));
  const frame = page.frameLocator('#widget');
  await page.evaluate(value => window.gate0Host.sendFromOtherFrame(value), snapshot(1));
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 40)));
  expect(await frame.locator('canvas.attractor-canvas').count()).toBe(0);

  const first = await page.evaluate(() => window.gate0Host.deliverTool({ visual: 'attractor' }));
  expect(first.sequence).toBe(1);
  await expect(frame.locator('canvas.attractor-canvas')).toHaveCount(1);
  await expect.poll(async () => {
    const entry = JSON.parse(await frame.locator('#log li').first().textContent());
    return entry.animationFrameObservedAt;
  }).not.toBeNull();
  const canvas = await frame.locator('canvas.attractor-canvas').elementHandle();
  const rendererId = await frame.locator('#surface').getAttribute('data-renderer-id');

  const second = await page.evaluate(() => window.gate0Host.deliverTool({ visual: 'attractor', intensity: 0.7 }));
  expect(second.sequence).toBe(2);
  await expect(frame.locator('#surface')).toHaveAttribute('data-intensity', '0.7');
  const sameCanvas = await frame.locator('canvas.attractor-canvas').elementHandle();
  expect(await sameCanvas.evaluate((element, original) => element === original, canvas)).toBe(true);
  expect(await frame.locator('#surface').getAttribute('data-renderer-id')).toBe(rendererId);

  await page.evaluate(value => window.gate0Host.sendResult(value), second);
  await expect(frame.locator('#status')).toContainText('duplicate');
  await page.evaluate(value => window.gate0Host.sendResult(value), first);
  await expect(frame.locator('#status')).toContainText('stale');
  expect(await frame.locator('canvas.attractor-canvas').count()).toBe(1);

  await frame.locator('#context').click();
  await expect(frame.locator('#reader-status')).toContainText('does not prove');
  expect(await page.evaluate(() => window.gate0Host.calls.some(message => message.method === 'ui/update-model-context' && message.params.content[0].text === 'RISE GATE 0 READER MARKER'))).toBe(true);
  await frame.locator('#message').click();
  await expect(frame.locator('#reader-status')).toContainText('does not prove');
  expect(await page.evaluate(() => window.gate0Host.calls.some(message => message.method === 'ui/message' && message.params.role === 'user' && message.params.content[0].text === 'RISE GATE 0 READER MARKER'))).toBe(true);
  await frame.locator('#speech-start').click();
  await frame.locator('#speech-end').click();
  await frame.locator('#voice-ack').click();
  await expect(frame.locator('#log')).toContainText('"evidence":"manual"');

  await expect(frame.locator('#log')).toContainText('host_rpc_acknowledged; voice receipt unverified');
  const oldInstance = await frame.locator('#instance').textContent();
  await page.evaluate(() => window.gate0Host.replaceWidget());
  const replacement = page.frameLocator('#widget');
  await expect(replacement.locator('#instance')).toHaveText(/Widget instance [0-9a-f-]{36}; a host-created replacement gets a new ID\./iu);
  await expect.poll(() => replacement.locator('#instance').textContent()).not.toBe(oldInstance);
  const third = await page.evaluate(() => window.gate0Host.deliverTool({ visual: 'attractor', intensity: 0.6 }));
  expect(third.sequence).toBe(3);
  await expect(replacement.locator('canvas.attractor-canvas')).toHaveCount(1);
  await expect(replacement.locator('#log')).toContainText('"widgetInstanceId"');
  await page.evaluate(() => { window.gate0Host.dropNextAck = true; });
  await replacement.locator('#context').click();
  const logBeforeTeardown = await replacement.locator('#log').textContent();
  await page.evaluate(() => window.gate0Host.sendTeardown());
  await expect(replacement.locator('body')).toHaveAttribute('data-teardown', 'complete');
  expect(await replacement.locator('canvas.attractor-canvas').count()).toBe(0);
  await page.waitForTimeout(50);
  await expect(replacement.locator('#log')).toHaveText(logBeforeTeardown);
  const before = await replacement.locator('#status').textContent();
  await page.evaluate(value => window.gate0Host.sendResult(value), snapshot(4, 0.6));
  await expect(replacement.locator('#status')).toHaveText(before);
  expect(await page.evaluate(() => window.gate0Host.calls.some(message => message.method === 'ui/resource-teardown'))).toBe(false);
});
