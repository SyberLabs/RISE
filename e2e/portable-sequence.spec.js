import { readFileSync } from 'node:fs';
import { test, expect, openHomeNav, openHomeRoom } from './fixtures.js';

const GATE = { code: 'rise2025', name: 'Portable sequence', vault: null, timestamp: Date.now() };
const SOURCE_ID = 'spoon-river-anthology#12';
const SCORE = JSON.stringify({
  schema: 'rise.experience-program.v1', id: 'portable-light-and-sound',
  authority: 'proposed', editable: true,
  tracks: [
    { id: 'movement', kind: 'movement', clips: [{ id: 'first',
      anchor: { sourceIds: [SOURCE_ID] }, data: { index: 0, title: 'A changing light' } }] },
    { id: 'visual', kind: 'visual', fallback: { kind: 'still' }, clips: [{ id: 'light',
      anchor: { sourceIds: [SOURCE_ID] }, cue: { kind: 'field', renderer: 'attractor' } }] },
    { id: 'audio', kind: 'audio', fallback: { kind: 'silence' }, clips: [{ id: 'sound',
      anchor: { sourceIds: [SOURCE_ID] },
      cue: { kind: 'soundscape', soundscapeId: 'aurora', gain: 0.4 } }] }
  ]
});

async function openHome(page) {
  await page.addInitScript(gate => localStorage.setItem('rise-beta-session', JSON.stringify(gate)), GATE);
  await page.goto('/');
  await expect(page.locator('.portal .portal-title').first()).toBeVisible({ timeout: 15_000 });
}

test('an authored audiovisual score travels to a clean mobile browser without source text', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await openHome(page);
  await openHomeRoom(page, 'scriptorium');
  await page.locator('#scriptorium-paste').fill(SCORE);
  await page.getByRole('button', { name: 'Examine' }).click();
  await expect(page.getByRole('region', { name: 'The reading' })).toContainText('A changing light');
  await page.getByRole('button', { name: 'Keep in Sequences' }).click();
  await expect(page.locator('.scriptorium')).toContainText('Kept in Sequences.', { timeout: 30_000 });

  await page.goto('/');
  await openHomeNav(page, 'vault');
  await page.getByRole('button', { name: 'Custom' }).click();
  const card = page.locator('.sequence-card').filter({ hasText: 'portable-light-and-sound' }).first();
  await expect(card.getByRole('button', { name: 'Export portable score' })).toBeVisible();
  await card.locator('[data-portable-credit]').fill('A. Reader');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    card.getByRole('button', { name: 'Export portable score' }).click()
  ]);
  const filePath = await download.path();
  const exported = readFileSync(filePath, 'utf8');
  expect(exported).toContain('rise.portable-sequence.v1');
  expect(exported).not.toContain('How does it happen, tell me');

  const recipient = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const other = await recipient.newPage();
  try {
    await openHome(other);
    await openHomeNav(other, 'vault');
    await other.getByRole('button', { name: 'Custom' }).click();
    const changedEdition = JSON.parse(exported);
    changedEdition.sources[0].sourceRevision = `sha256:${'0'.repeat(64)}`;
    await other.locator('[data-portable-file]').setInputFiles({
      name: 'changed-edition.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(changedEdition))
    });
    await expect(other.locator('.vault-portable [role="status"]'))
      .toContainText('differs from the exact edition');
    expect(await other.evaluate(() => localStorage.getItem('rise_workshop_v1'))).toBeNull();
    await other.locator('[data-portable-file]').setInputFiles(filePath);
    await expect(other.locator('.vault-portable-review')).toContainText('A. Reader');
    await expect(other.locator('.vault-portable-review')).toContainText('Spoon River Anthology');
    expect(await other.evaluate(() => localStorage.getItem('rise_workshop_v1'))).toBeNull();
    await other.getByRole('button', { name: 'Keep in this browser' }).click();
    const imported = other.locator('.sequence-card').filter({ hasText: 'portable-light-and-sound' }).first();
    await other.setViewportSize({ width: 1280, height: 800 });
    await imported.getByRole('button', { name: 'Preview / vary' }).click();
    await expect(other.locator('.workshop-studio')).toBeVisible();
    await other.locator('[data-action="preview"]').click();
    await expect(other.locator('#chamber-display')).toBeVisible({ timeout: 60_000 });
    await other.setViewportSize({ width: 390, height: 844 });
    await other.goto('/');
    await openHomeNav(other, 'vault');
    await other.getByRole('button', { name: 'Custom' }).click();
    const replay = other.locator('.sequence-card').filter({ hasText: 'portable-light-and-sound' }).first();
    await expect(replay.getByRole('button', { name: 'Launch' })).toBeVisible();
    await replay.getByRole('button', { name: 'Launch' }).click();
    await expect(other.locator('#chamber-display')).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => other.locator('#atom-display').textContent(), { timeout: 30_000 })
      .toMatch(/\S/u);
    await other.screenshot({ path: test.info().outputPath('portable-recipient-mobile.png'), fullPage: true });
  } finally {
    await recipient.close();
  }

  const reduced = await browser.newContext({
    viewport: { width: 390, height: 844 }, reducedMotion: 'reduce'
  });
  const quiet = await reduced.newPage();
  try {
    await openHome(quiet);
    await openHomeNav(quiet, 'vault');
    await quiet.getByRole('button', { name: 'Custom' }).click();
    await quiet.locator('[data-portable-file]').setInputFiles(filePath);
    await expect(quiet.locator('.vault-portable-review')).toBeVisible();
    await quiet.getByRole('button', { name: 'Keep in this browser' }).click();
    const card = quiet.locator('.sequence-card').filter({ hasText: 'portable-light-and-sound' }).first();
    await card.getByRole('button', { name: 'Launch' }).click();
    await expect(quiet.locator('#chamber-display')).toBeVisible({ timeout: 60_000 });
    await expect.poll(() => quiet.locator('#atom-display').textContent(), { timeout: 30_000 })
      .toMatch(/\S/u);
    expect(await quiet.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await quiet.screenshot({ path: test.info().outputPath('portable-recipient-reduced-motion.png'), fullPage: true });
  } finally {
    await reduced.close();
  }
});
