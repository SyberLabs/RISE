/**
 * The Reader's glass between phrases (PLY-001): the Chamber the card shares, in a canonical reading. The card's own
 * measure, with its said phrases and a hold, is in live-mcp.spec.js.
 */
import { expect, test } from './fixtures.js';
import { sampleGlass } from './glass-probe.js';

test('in the Reader the glass stays as one phrase gives way to the next, and eases to its size', async ({ page }) => {
  await page.goto('/try-rise');
  await page.locator('#keystone-tintern').click();
  await expect(page.locator('[data-enter]')).toBeEnabled({ timeout: 15_000 });
  await page.locator('[data-enter]').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => page.locator('#atom-display').textContent().then(text => text.trim().length), { timeout: 20_000 }).toBeGreaterThan(0);
  const frames = await sampleGlass(page, 12_000);
  const visible = Math.max(...frames.map(frame => frame.glass));
  // From the first frame the first phrase's glass is whole; before it, that glass is still arriving with its words.
  const settled = frames.slice(frames.findIndex(frame => frame.glass >= visible));
  const changes = settled.filter((frame, index) => index > 0 && frame.text !== settled[index - 1].text).length;
  const lowest = Math.min(...settled.map(frame => frame.glass));
  console.log(`[glass reader] visible ${visible}; ${changes} phrase changes; lowest glass ${lowest}; widths ${[...new Set(settled.map(frame => frame.width))].join(' ')}`);
  // Measured before (Tintern Abbey, 1280 x 800): the glass went to 0 at each of five phrase changes in 12 s.
  expect(visible).toBeGreaterThan(0.5);
  expect(changes).toBeGreaterThanOrEqual(3);
  expect(lowest).toBeGreaterThanOrEqual(visible * 0.5);
  expect(Math.min(...settled.map(frame => frame.height))).toBeGreaterThan(60);
});
