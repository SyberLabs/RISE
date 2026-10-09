import { test, expect } from './fixtures.js';
import { voiceAssetKey } from '../src/audio/voice-pack-key.js';

// Exercise Begin's real gesture admission; do not inherit the gate's autoplay override.
test.use({ launchOptions: { args: [] } });

// Real decodable local audio exercises preparation and playback without a
// provider call or charge. The endpoint remains the same server-only boundary.
function tone() {
  const rate = 24000, samples = rate * 30;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(1200 * Math.sin(i * Math.PI * 440 / rate)), 44 + i * 2);
  return wav.toString('base64');
}
async function installProvider(page, { refusal = false, malformed = false, entitled = true } = {}) {
  let calls = 0;
  await page.route('**/api/plus/status', route => route.fulfill({ json: { admin: entitled, subscriber: false, available: true, adminLogin: false } }));
  await page.route('**/api/plus/config', route => route.fulfill({ json: { paymentLink: null } }));
  await page.route('**/api/plus/voices', route => route.fulfill({ json: [{ slug: 'river', label: 'River' }] }));
  await page.route('**/api/plus/voice', route => {
    calls++;
    if (refusal) return route.fulfill({ status: 402, json: { error: { code: 'PLUS_ALLOWANCE', message: 'Voice allowance used up.' } } });
    const { atoms, voice } = route.request().postDataJSON();
    expect(voice).toBe('river');
    const entries = Object.fromEntries(atoms.map((text, i) => [voiceAssetKey(text), { text, asset: '/api/plus/audio/demo.mp3', mimeType: 'audio/mpeg', fromMs: i * 3000, toMs: (i + 1) * 3000, onsetsMs: [0] }]));
    return route.fulfill({ json: { pack: { schema: 'rise.recitation-voice-pack.v1', voices: { [voice]: { model: 'elevenlabs/test', entries } } }, audio: malformed ? 'bm90LWF1ZGlv' : tone() } });
  });
  return () => calls;
}

test('returning voice access begins directly with visible psychedelic fractals and keeps the draft on exit', async ({ page }) => {
  const calls = await installProvider(page);
  await page.goto('/voice-demo');
  await expect(page.locator('[data-begin]')).toBeEnabled();
  await page.locator('textarea').fill('A beam of light opens into a flower. The colors turn around us.');
  await page.screenshot({ path: test.info().outputPath('voice-demo-form.png'), fullPage: true });
  await page.locator('[data-begin]').click();
  await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 25000 });
  expect(calls()).toBe(1);
  await page.waitForFunction(() => !window.__RISE_TEST__.getRouterState().transitioning);
  expect(await page.evaluate(() => window.__RISE_TEST__.getView('read').paneInstance('chamber').voice.voiceId)).toBe('river');
  await expect.poll(() => page.evaluate(() => window.__RISE_TEST__.getAudioEngine().audible)).toBe(true);
  // Observe the actual cortex and painted canvas, not just session settings.
  await expect.poll(() => page.evaluate(async () => {
    const cortex = await window.__RISE_TEST__.ensureVisualCortex();
    return { types: cortex.config?.activeTypes, continuous: cortex._continuousField?.running };
  })).toMatchObject({ types: ['fractal'], continuous: true });
  await expect(page.locator('.continuous-field-artwork').first()).toBeVisible({ timeout: 15000 });
  await expect.poll(() => page.locator('.continuous-field-artwork').evaluateAll(images => images.some(image => image.complete && image.naturalWidth > 0 && Number(getComputedStyle(image.parentElement).opacity) > 0.9)), { timeout: 15000 }).toBe(true);
  await expect(page.locator('#loading-overlay')).toBeHidden();
  await page.screenshot({ path: test.info().outputPath('voice-demo-fractal.png') });
  await page.keyboard.press('Escape');
  const confirm = page.locator('#exit-confirm-overlay');
  await expect(confirm).toBeVisible();
  await page.locator('#exit-confirm').click();
  await expect(page.locator('.voice-demo textarea')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('textarea')).toHaveValue('A beam of light opens into a flower. The colors turn around us.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: test.info().outputPath('voice-demo-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const failure of ['allowance', 'decode']) test(`${failure} refusal retains text without silently starting another voice`, async ({ page }) => {
  const calls = await installProvider(page, { refusal: failure === 'allowance', malformed: failure === 'decode' });
  await page.goto('/voice-demo');
  await expect(page.locator('[data-begin]')).toBeEnabled();
  await page.locator('textarea').fill('These words remain here after a refusal.');
  await page.locator('[data-begin]').click();
  await expect(page.locator('[data-status]')).toContainText(failure === 'allowance' ? 'allowance' : 'could not be prepared', { timeout: 20000 });
  await expect(page.locator('textarea')).toHaveValue('These words remain here after a refusal.');
  await expect(page.locator('#chamber-display')).toHaveCount(0);
  expect(calls()).toBe(1);
  expect(await page.evaluate(() => window.__RISE_TEST__.getAudioEngine().voice?.isPlaying ?? false)).toBe(false);
});

test('a browser claim never enables the direct demo without server entitlement', async ({ page }) => {
  const calls = await installProvider(page, { entitled: false });
  await page.addInitScript(() => localStorage.setItem('rise.plus', JSON.stringify({ claimedAt: Date.now() })));
  await page.goto('/voice-demo');
  await expect(page.locator('[data-status]')).toContainText('not ready');
  await expect(page.locator('[data-begin]')).toBeDisabled();
  expect(calls()).toBe(0);
});
