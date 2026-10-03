import { readFileSync } from 'node:fs';
import { test, expect, openHomeNav } from './fixtures.js';

// Screenshots are evidence for a human reviewer, not assertions.
const shot = (page, name) => page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true });
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('rise_workshop_v1') || '[]'));

async function openVault(page) {
  await page.goto('/');
  await expect(page.locator('.portal h1').first()).toBeVisible({ timeout: 15_000 });
  await openHomeNav(page, 'vault');
  await expect(page.locator('.vault-examples')).toBeVisible({ timeout: 15_000 });
}

async function keepQuiet(page) {
  await page.locator('[data-portable-example="quiet"]').getByRole('button', { name: 'Keep' }).click();
  await expect(page.locator('.vault-portable-review')).toBeVisible();
  await page.getByRole('button', { name: 'Keep in this browser' }).click();
  await expect.poll(async () => (await stored(page)).length).toBe(1);
  const [parent] = await stored(page);
  await page.locator(`.sequence-card[data-id="${parent.id}"]`)
    .getByRole('button', { name: 'Vary as new' }).click();
  await expect(page.locator('.workshop-studio')).toBeVisible();
  return parent;
}

// The soundscape the engine was asked for is its own console line (production keeps console).
function heardSoundscapes(page) {
  const heard = [];
  page.on('console', message => {
    const match = /\[AudioEngine\] Soundscape: (\S+)/u.exec(message.text());
    if (match) heard.push(match[1]);
  });
  return heard;
}

// What the reader is given at the start of the reading: first soundscape requested, visual pool active.
async function expectPlaying(page, heard, { sound, visual }) {
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => page.locator('#atom-display').textContent(), { timeout: 30_000 }).toMatch(/\S/u);
  await expect.poll(() => heard[0], { timeout: 30_000 }).toBe(sound);
  await expect.poll(() => page.evaluate(async () =>
    (await window.__RISE_TEST__.ensureVisualCortex()).config.activeTypes), { timeout: 30_000 }).toEqual([visual]);
}

async function remix(page, visual, soundscape) {
  await page.locator('#remix-visual').selectOption(visual);
  await page.locator('#remix-soundscape').selectOption(soundscape);
}

// The child shares its parent's title; only a local (non-imported) card offers a credit field.
async function exportChild(page, credit) {
  await page.goto('/');
  await openHomeNav(page, 'vault');
  await page.getByRole('button', { name: 'Custom' }).click();
  const child = page.locator('.sequence-card').filter({ has: page.locator('[data-portable-credit]') });
  await expect(child).toHaveCount(1);
  await child.locator('[data-portable-credit]').fill(credit);
  const [download] = await Promise.all([
    page.waitForEvent('download'), child.getByRole('button', { name: 'Export portable score' }).click()
  ]);
  return { file: await download.path(), bundle: JSON.parse(readFileSync(await download.path(), 'utf8')) };
}

const passageCue = (bundle, index, kind) => {
  const clip = track => bundle.program.tracks.find(item => item.kind === track).clips[index];
  return kind === 'visual' ? clip('visual').cue.collections[0] : clip('audio').cue.soundscapeId;
};

test('a recipient remixes one passage, keeps it as a child, and it plays in a clean browser', async ({ page, browser }) => {
  test.setTimeout(180_000);
  const heardA = heardSoundscapes(page);
  await openVault(page);
  const parent = await keepQuiet(page);
  const parentSnapshot = JSON.stringify(parent);

  // 2. the remix panel
  const panel = page.locator('#passage-remix');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-remix-lineage]')).toContainText(parent.title);
  await expect(panel.locator('[data-remix-lineage]')).toContainText('RISE');
  await expect(panel.locator('[data-action="keep-remix"]')).toBeDisabled();
  await expect(panel.locator('[data-remix-passage] option').first()).toContainText('Passage 1');
  await shot(page, '1-remix-desktop-before');

  // 3. change passage 1
  await expect(panel.locator('[data-remix-visual]')).toHaveValue('turrell');
  await expect(panel.locator('[data-remix-soundscape]')).toHaveValue('aurora');
  await remix(page, 'fractal', 'soft-rain');
  await expect(panel.locator('[data-action="keep-remix"]')).toBeEnabled();
  await shot(page, '2-remix-desktop-after');

  // 4. preview plays the changed cues and saves nothing
  heardA.length = 0;
  await page.locator('[data-action="preview"]').click();
  await expectPlaying(page, heardA, { sound: 'soft-rain', visual: 'fractal' });
  await shot(page, '3-preview-chamber');
  expect(await stored(page)).toHaveLength(1);
  await page.mouse.move(640, 700);
  await page.locator('#exit-btn').click();
  await page.locator('#exit-confirm').click();
  await expect.poll(() => page.evaluate(() => !!window.__RISE_TEST__?.getAudioEngine()?.sessionActive)).toBe(false);
  expect(await stored(page)).toHaveLength(1);
  // The unsaved remix is still there to keep or change after the preview ends.
  await expect(page.locator('#passage-remix')).toBeVisible();
  await expect(page.locator('#remix-visual')).toHaveValue('fractal');
  await expect(page.locator('#remix-soundscape')).toHaveValue('soft-rain');

  // 5. cancel: leave the unsaved draft without Keep
  await page.goto('/');
  await openHomeNav(page, 'vault');
  await page.getByRole('button', { name: 'Custom' }).click();
  const stillOne = await stored(page);
  expect(stillOne).toHaveLength(1);
  expect(JSON.stringify(stillOne[0])).toBe(parentSnapshot);

  // 6. keep: a fresh Vary as new, then Keep as new child
  await page.locator(`.sequence-card[data-id="${parent.id}"]`)
    .getByRole('button', { name: 'Vary as new' }).click();
  await expect(page.locator('#passage-remix [data-action="keep-remix"]')).toBeDisabled();
  await remix(page, 'fractal', 'soft-rain');
  await page.locator('[data-action="keep-remix"]').click();
  await expect.poll(async () => (await stored(page)).length).toBe(2);
  const saved = await stored(page);
  expect(JSON.stringify(saved.find(item => item.id === parent.id))).toBe(parentSnapshot);

  // 7. export the child with a credit
  const { file, bundle } = await exportChild(page, 'Remix author');
  expect(bundle.parent).toEqual({ id: parent.provenance.portableId });
  expect(bundle.id).not.toBe(parent.provenance.portableId);
  expect(bundle.creatorCredit).toBe('Remix author');
  expect(passageCue(bundle, 0, 'visual')).toBe('fractal');
  expect(passageCue(bundle, 0, 'sound')).toBe('soft-rain');
  expect(passageCue(bundle, 1, 'visual')).toBe('rockgarden');
  expect(passageCue(bundle, 1, 'sound')).toBe('nocturne');
  const original = JSON.parse(readFileSync('src/content/portable-examples/quiet.json', 'utf8'));
  expect(original.id).toBe(parent.provenance.portableId);
  expect(bundle.sources).toEqual(original.sources);
  expect(passageCue(original, 0, 'visual')).toBe('turrell');

  // 8. a clean browser reviews, keeps, and plays the child
  const clean = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const recipient = await clean.newPage();
  const heardB = heardSoundscapes(recipient);
  try {
    await openVault(recipient);
    await recipient.getByRole('button', { name: 'Custom' }).click();
    await recipient.locator('[data-portable-file]').setInputFiles(file);
    const review = recipient.locator('.vault-portable-review');
    await expect(review).toContainText('Remix author');
    await expect(review).toContainText(parent.provenance.portableId);
    await shot(recipient, '4-clean-import-review');
    await recipient.getByRole('button', { name: 'Keep in this browser' }).click();
    await expect.poll(async () => (await stored(recipient)).length).toBe(1);
    await recipient.locator('[data-portable-file]').setInputFiles(file);
    await recipient.getByRole('button', { name: 'Keep in this browser' }).click();
    await expect(recipient.locator('.vault-portable [role="status"]')).toContainText('already in this browser');
    expect(await stored(recipient)).toHaveLength(1);
    heardB.length = 0;
    await recipient.locator('.sequence-card').first()
      .getByRole('button', { name: 'Launch' }).click();
    await expectPlaying(recipient, heardB, { sound: 'soft-rain', visual: 'fractal' });
    await shot(recipient, '5-clean-child-playing');
  } finally {
    await clean.close();
  }

  // 9. the parent still plays as it did
  await page.goto('/');
  await openHomeNav(page, 'vault');
  await page.getByRole('button', { name: 'Custom' }).click();
  heardA.length = 0;
  await page.locator(`.sequence-card[data-id="${parent.id}"]`)
    .getByRole('button', { name: 'Launch' }).click();
  await expectPlaying(page, heardA, { sound: 'aurora', visual: 'turrell' });
});

test('on a phone with reduced motion the remix is reachable and works from the keyboard', async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await openVault(page);
    await keepQuiet(page);
    const panel = page.locator('#passage-remix');
    if (!(await panel.isVisible())) await page.locator('[data-studio-surface-target="score"]').click();
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toBeVisible();
    await expect(page.locator('.scene-stack-host')).toHaveCount(0);
    await expect(panel.locator('[data-action="keep-remix"]')).toBeDisabled();
    // Keyboard only: focus the select and type ahead ("f": Fractal Flames, Faded Signal).
    // Headless macOS Chromium ignores ArrowDown on a closed select, so typeahead is the portable key.
    for (const [id, was] of [['#remix-visual', 'turrell'], ['#remix-soundscape', 'aurora']]) {
      await page.locator(id).focus();
      await page.keyboard.press('f');
      await expect(page.locator(id)).not.toHaveValue(was);
    }
    await expect(panel.locator('[data-action="keep-remix"]')).toBeEnabled();
    await shot(page, '6-remix-phone');
  } finally {
    await context.close();
  }
});
