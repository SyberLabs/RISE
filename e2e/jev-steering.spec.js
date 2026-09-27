import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures.js';
import { resolveJevChamberConfig } from '../src/core/jev-config.js';
import { jevPalette } from '../src/core/jev-palette.js';
import { compileJevAudioProgram, compileJevVisualProgram } from '../src/core/jev-sequence.js';

const releaseInventory = JSON.parse(readFileSync(
  new URL('../src/content/archive/release-inventory.json', import.meta.url), 'utf8'
));
const released = releaseInventory.middlemarch;
const selectors = {
  section: 'first', wpm: 200, curve: 'flat', chunkMode: 'word',
  audio: 'silent', visualMode: 'interlocution', visualStyle: 'immersive',
  middleAudio: 'aurora', finaleAudio: 'faded-signal',
  visualEngine: 'klee', middleEngine: 'harmonograph', finaleEngine: 'ostensoria',
  visualPalette: 'white', visualArc: 'dual', arcSplit: '50',
  kleePreset: 'harmonic', galleryCadence: 'balanced',
  chamberFace: 'literary', fontSize: 'medium', colorTheme: 'classic',
  textColor: 'classic', backgroundColor: 'classic',
  middleTheme: 'amethyst', finaleTheme: 'prism',
  wordFill: 'plain', projection: 'stream', revealMode: 'instant'
};

const decision = {
  schemaVersion: 2,
  requestId: 'browser-jeff-steering',
  model: 'typesafe/jev-1.13',
  workId: 'middlemarch',
  editionId: released.editionId,
  sourceRevision: released.sourceRevision,
  reason: 'A thoughtful classic for reflective reading.',
  config: {
    ...selectors,
    colors: jevPalette(selectors.colorTheme),
    ...resolveJevChamberConfig(selectors),
    visualProgram: compileJevVisualProgram(selectors),
    audioProgram: compileJevAudioProgram(selectors)
  }
};

test('cold sample deep link admits a preset Gallery, then returns to its threshold', async ({ page }) => {
  let jevRequests = 0;
  await page.route('**/api/jev-recommend', route => {
    jevRequests += 1;
    return route.abort();
  });
  await page.goto('/jev-scene-demo');
  await page.locator('#beta-enter').click();
  await expect(page.locator('#jev-scene-demo-start')).toBeVisible();
  await expect(page.locator('#portal-jev-demo')).toContainText('No live RISE request');
  await expect(page.locator('#portal-jev-form')).toHaveCount(0);
  await page.locator('#jev-scene-demo-start').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#jev-next-scene')).toBeEnabled({ timeout: 20_000 });
  expect(jevRequests).toBe(0);
  await page.locator('#chamber-display').hover();
  await page.locator('#jev-next-scene').click();
  await expect(page.locator('#jev-scene-status')).toContainText('Next scene selected');
  await expect.poll(() => page.evaluate(() => {
    return [...document.querySelectorAll('#chamber-continuous-field .plate-plane')]
      .some(canvas => canvas.style.opacity === '1' && canvas.width > 0 && canvas.height > 0
        && canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data
          .some((value, index) => index % 4 === 3 && value > 0));
  }), { timeout: 10_000 }).toBe(true);
  expect(jevRequests).toBe(0);
  await page.locator('#exit-btn').click();
  await page.locator('#exit-confirm').click();
  await expect(page.locator('#jev-scene-demo-start')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/jev-scene-demo');
});

test('reader shifts Jev’s next visual scene without moving the text or pace', async ({ page }) => {
  const visualCues = [];
  let jevRequests = 0;
  page.on('console', message => {
    if (message.text().includes('[Visual Cortex] Cue activated:')) visualCues.push(message.text());
  });
  await page.addInitScript(() => localStorage.setItem('rise-beta-session', JSON.stringify({
    code: 'rise2025', name: 'Jev steering harness', vault: null, timestamp: Date.now()
  })));
  await page.route('**/api/jev-recommend', route => {
    jevRequests += 1;
    return route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(decision)
    });
  });
  await page.goto('/');
  await expect(page.locator('#portal-jev-form')).toBeVisible({ timeout: 15_000 });
  await page.locator('#portal-jev-intent').fill('A reflective reading with changing visual scenes.');
  await page.locator('#portal-jev-form button[type="submit"]').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });

  const shift = page.locator('#jev-next-scene');
  await expect(shift).toBeVisible();
  await expect(shift).toBeEnabled({ timeout: 20_000 });
  const before = await page.evaluate(() => {
    const chamber = window.__RISE_TEST__.getView('chamber-session');
    return {
      index: chamber.player.sessionState.currentIndex,
      progress: chamber._jevCurrentAtom?.sourceProgress,
      wpm: chamber.currentWpm,
      speedFactor: chamber.player.speedFactor,
      activeCue: chamber._visualSchedule._activeCueId,
      engine: chamber._visualSchedule.program.segments[0].cue.collections[0]
    };
  });
  expect(before.progress).toBeGreaterThan(0);
  expect(before.progress).toBeLessThan(0.5);
  expect(before.activeCue).toBe('jev-opening');
  expect(before.engine).toBe('klee');

  await page.locator('#chamber-display').hover();
  const immediate = await page.evaluate(() => {
    const chamber = window.__RISE_TEST__.getView('chamber-session');
    const beforeClick = {
      index: chamber.player.sessionState.currentIndex,
      progress: chamber._jevCurrentAtom?.sourceProgress,
      wpm: chamber.currentWpm,
      speedFactor: chamber.player.speedFactor,
      state: chamber.player.state
    };
    document.querySelector('#jev-next-scene').click();
    const afterClick = {
      index: chamber.player.sessionState.currentIndex,
      progress: chamber._jevCurrentAtom?.sourceProgress,
      wpm: chamber.currentWpm,
      speedFactor: chamber.player.speedFactor,
      activeCue: chamber._visualSchedule._activeCueId,
      engine: chamber._visualSchedule.program.segments[1].cue.collections[0],
      boundary: chamber._visualSchedule.program.segments[1].match.fromProgress,
      chosen: chamber.session.jevSceneShifted
    };
    return { beforeClick, afterClick };
  });
  expect(immediate.beforeClick.state).toBe('playing');
  expect(immediate.afterClick).toMatchObject({
    index: immediate.beforeClick.index, progress: immediate.beforeClick.progress,
    wpm: immediate.beforeClick.wpm, speedFactor: immediate.beforeClick.speedFactor,
    activeCue: 'jev-finale', engine: 'ostensoria',
    boundary: immediate.beforeClick.progress, chosen: true
  });
  await expect.poll(() => visualCues.some(message =>
    message.includes('jev-finale') && message.includes('ostensoria'))).toBe(true);
  await expect(page.locator('.chamber')).toHaveCSS('--color-accent', '#E84BFF');
  await expect(page.locator('.chamber')).toHaveCSS('--color-light', '#F4EEE4');
  await expect(page.locator('.chamber')).toHaveCSS('--color-void', '#08090F');
  await expect.poll(() => page.evaluate(() => {
    return [...document.querySelectorAll('#chamber-continuous-field .plate-plane')]
      .some(canvas => {
        if (canvas.style.opacity !== '1' || !canvas.width || !canvas.height) return false;
        const pixels = canvas.getContext('2d')?.getImageData(
          0, 0, canvas.width, canvas.height
        ).data;
        return pixels && pixels.some((value, index) => index % 4 === 3 && value > 0);
      });
  }), { timeout: 10_000 }).toBe(true);
  expect(jevRequests).toBe(1);

  const after = await page.evaluate(() => {
    const chamber = window.__RISE_TEST__.getView('chamber-session');
    return {
      index: chamber.player.sessionState.currentIndex,
      progress: chamber._jevCurrentAtom?.sourceProgress,
      wpm: chamber.currentWpm,
      speedFactor: chamber.player.speedFactor,
      activeCue: chamber._visualSchedule._activeCueId,
      engine: chamber._visualSchedule.program.segments[1].cue.collections[0],
      boundary: chamber._visualSchedule.program.segments[1].match.fromProgress
    };
  });
  expect(after).toMatchObject({ activeCue: 'jev-finale', engine: 'ostensoria',
    boundary: immediate.beforeClick.progress });
});

test('spoken Jev request opens a reading whose look can be changed live', async ({ page }) => {
  let requestBody;
  await page.addInitScript(() => {
    localStorage.setItem('rise-beta-session', JSON.stringify({
      code: 'rise2025', name: 'Jev voice harness', vault: null, timestamp: Date.now()
    }));
    window.SpeechRecognition = class {
      start() {
        this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: {
          transcript: 'A reflective reading with visual scenes'
        } }] });
        this.onend?.();
      }
      stop() { this.onend?.(); }
      abort() {}
    };
  });
  await page.route('**/api/jev-recommend', route => {
    requestBody = route.request().postDataJSON();
    return route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(decision)
    });
  });
  await page.goto('/');
  await page.locator('#portal-jev-form [data-jev-dictate]').click();
  await expect(page.locator('#portal-jev-intent'))
    .toHaveValue('A reflective reading with visual scenes');
  await page.locator('#portal-jev-form button[type="submit"]').click();
  expect(requestBody).toEqual({
    intent: 'A reflective reading with visual scenes', schemaVersion: 2
  });
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
  await page.locator('#chamber-display').hover();
  await page.locator('#jev-look-btn').click();
  await page.locator('[name="jev-font-size"]').selectOption('xlarge');
  await expect(page.locator('#atom-display')).toHaveAttribute('data-font-size', 'xlarge');
  const text = page.locator('[name="jev-text-color"]');
  await text.selectOption('jade');
  await page.locator('[name="jev-background-color"]').selectOption('ember');
  await expect(page.locator('.chamber')).toHaveCSS('--color-light', '#AFFFCE');
  await expect(page.locator('.chamber')).toHaveCSS('--color-void', '#1C0B0A');
  await expect(page.locator('#atom-display')).toHaveCSS('color', 'rgb(175, 255, 206)');
  const currentWord = await page.locator('#atom-display').textContent();
  await expect.poll(() => page.locator('#atom-display').textContent()).not.toBe(currentWord);
  await expect(page.locator('#atom-display')).toHaveCSS('color', 'rgb(175, 255, 206)');
  await expect(page.locator('#atom-display')).toHaveAttribute('data-font-size', 'xlarge');
  await page.locator('[name="jev-volume"]').evaluate(input => {
    input.value = '30';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#jev-volume-value')).toHaveText('30%');
  await expect.poll(() => page.evaluate(() => window.__RISE_TEST__
    ?.getAudioEngine()?.config?.masterVolume)).toBe(0.3);
  await page.locator('[name="jev-soundscape"]').selectOption('aurora');
  await expect.poll(() => page.evaluate(() => Boolean(window.__RISE_TEST__
    ?.getAudioEngine()?.layers?.soundscape))).toBe(true);
  await page.locator('[name="jev-soundscape"]').selectOption('none');
  await expect(page.locator('[name="jev-soundscape"]')).toHaveValue('none');
  await expect.poll(() => page.evaluate(() => Boolean(window.__RISE_TEST__
    ?.getAudioEngine()?.layers?.soundscape))).toBe(false);
});

test.describe('touch reader', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('can reveal the Shift control by tapping the Gallery', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('rise-beta-session', JSON.stringify({
      code: 'rise2025', name: 'Jev touch harness', vault: null, timestamp: Date.now()
    })));
    await page.route('**/api/jev-recommend', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(decision)
    }));
    await page.goto('/');
    await page.locator('#portal-jev-intent').fill('A reading with a visual scene I can change.');
    await page.locator('#portal-jev-form button[type="submit"]').click();
    const shift = page.locator('#jev-next-scene');
    await expect(shift).toBeEnabled({ timeout: 20_000 });
    await page.locator('#chamber-display').tap({ position: { x: 40, y: 120 } });
    await expect(page.locator('#chamber-controls')).toHaveCSS('opacity', '1');
    await shift.tap();
    await expect(page.locator('#jev-scene-status')).toContainText('Next scene selected');
  });
});
