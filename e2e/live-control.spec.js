/**
 * Local visual control through the real /live reader.
 *
 * The provider and paced voice are deterministic; this proves the browser
 * control path, not provider or real speech-recognition operation. Pixel
 * assertions sample the mounted 2D canvas itself, not its announced receipt.
 */
import { expect, test } from './fixtures.js';

const OPEN = '/live?voice=paced';
const status = page => page.locator('.live-controls__status');
const shown = async page => (await page.locator('#atom-display').innerText()).replace(/\s+/gu, ' ').trim();
const canvas = page => page.locator('.chamber-attractor canvas.attractor-canvas').first();

async function start(page) {
    await page.goto(OPEN);
    await page.locator('.live-start').click();
    await expect(page.locator('#live-controls')).toBeVisible();
    await expect.poll(() => shown(page)).toContain('A black hole is a region of space');
    await expect.poll(() => canvas(page).evaluate(element => Boolean(element.closest('.chamber-scheduled-field.is-active')))).toBe(true);
}

// Read a grid of RGBA bytes from the rendered canvas. Sampling distributed
// pixels avoids moving image data across Playwright while still checking the
// actual paint rather than renderer metadata or a receipt.
async function paint(page) {
    return page.locator('.chamber-attractor canvas.attractor-canvas').first().evaluate(element => {
        const { width, height } = element;
        if (!width || !height) return [];
        const pixels = element.getContext('2d').getImageData(0, 0, width, height).data;
        const bytes = [];
        for (let y = 0; y < 64; y += 1) {
            const py = Math.min(height - 1, Math.floor(y * height / 64));
            for (let x = 0; x < 64; x += 1) {
                const px = Math.min(width - 1, Math.floor(x * width / 64));
                const offset = (py * width + px) * 4;
                bytes.push(pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]);
            }
        }
        return bytes;
    });
}

test('a typed local control changes painted canvas bytes within one second and keeps the field mounted', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await start(page);
    const field = await canvas(page).elementHandle();
    await expect(canvas(page)).toHaveCount(1);
    const beforePaint = await paint(page);
    expect(beforePaint.length).toBeGreaterThan(0);
    // Reduced motion gives a stable comparison frame without freezing reading.
    await page.waitForTimeout(120);
    expect(await paint(page)).toEqual(beforePaint);

    await page.locator('#live-controls-visual').fill('more vibrant');
    const submittedAt = await page.evaluate(() => performance.now());
    await page.locator('[data-live="visual-submit"]').click();

    let firstChangedAt;
    await expect.poll(async () => {
        const afterPaint = await paint(page);
        if (afterPaint.some((byte, index) => byte !== beforePaint[index])) {
            firstChangedAt ??= await page.evaluate(() => performance.now());
            return true;
        }
        return false;
    }, { timeout: 1_200, message: 'waiting for a changed canvas pixel sample' }).toBe(true);

    const firstPaintMs = Math.round(firstChangedAt - submittedAt);
    test.info().annotations.push({ type: 'typed-control-first-paint-ms', description: String(firstPaintMs) });
    expect(firstPaintMs).toBeLessThan(1_000);
    await expect(status(page)).toContainText(/Visual brightness target changed/u);
    expect(await canvas(page).elementHandle()).toBeTruthy();
    expect(await field.evaluate((original, current) => original === current, await canvas(page).elementHandle())).toBe(true);
    // The next authored segment chooses a still field; the local Attractor
    // adjustment expires with its passage and cannot carry into that cue.
    await expect.poll(() => shown(page), { timeout: 20_000 }).toContain('Its boundary is called the event horizon');
    await expect(canvas(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(page.locator('#live-controls')).toHaveCount(0);
});

test('rapid typed retargets leave playback advancing on the same renderer', async ({ page }) => {
    await start(page);
    const field = await canvas(page).elementHandle();
    expect((await paint(page)).length).toBeGreaterThan(0);
    // The visible canvas can mount just before the runtime publishes its
    // controllable active-field record.
    await page.waitForTimeout(150);
    const textBefore = await shown(page);

    // Deliver two commands through the actual form synchronously, so the
    // second target arrives while the first 320 ms transition is in flight.
    await page.locator('#live-controls-visual').fill('more vibrant');
    await page.evaluate(() => {
        const button = document.querySelector('[data-live="visual-submit"]');
        button.click();
        button.click();
    });
    await expect(status(page)).toContainText(/Visual brightness target changed/u);
    await expect.poll(() => shown(page), { timeout: 5_000 }).not.toBe(textBefore);
    expect(await field.evaluate((original, current) => original === current, await canvas(page).elementHandle())).toBe(true);
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(page.locator('#live-controls')).toHaveCount(0);
});

test('fake visual recognition applies without holding narration', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
        let latest;
        class FakeRecognition {
            start() { queueMicrotask(() => this.onstart?.({})); }
            stop() { queueMicrotask(() => this.onend?.({})); }
            abort() {}
        }
        window.SpeechRecognition = FakeRecognition;
        window.webkitSpeechRecognition = FakeRecognition;
        window.__visualRecognition = {
            say(words) {
                latest?.onresult?.({
                    resultIndex: 0,
                    results: [Object.assign([{ transcript: words }], { isFinal: true })]
                });
                // Model the browser's asynchronous final end event so latency
                // starts at a completed recognition, not the silence timeout.
                queueMicrotask(() => latest?.onend?.({}));
            }
        };
        const Original = window.SpeechRecognition;
        window.SpeechRecognition = class extends Original {
            constructor() { super(); latest = this; }
        };
        window.webkitSpeechRecognition = window.SpeechRecognition;
    });
    await start(page);
    const field = await canvas(page).elementHandle();
    const textBefore = await shown(page);
    await page.getByRole('button', { name: 'Listen for a visual change', exact: true }).click();
    await expect(page.locator('.live-controls__mic')).toContainText('Listening');
    await expect(status(page)).not.toContainText('Held where you are');
    await expect.poll(() => shown(page), { timeout: 5_000 }).not.toBe(textBefore);

    const listenedPaint = await paint(page);
    const submittedAt = await page.evaluate(() => performance.now());
    await page.evaluate(() => window.__visualRecognition.say('more vibrant'));
    await expect(status(page)).toContainText(/Visual brightness target changed/u);
    let firstChangedAt;
    await expect.poll(async () => {
        const afterPaint = await paint(page);
        if (afterPaint.some((byte, index) => byte !== listenedPaint[index])) {
            firstChangedAt ??= await page.evaluate(() => performance.now());
            return true;
        }
        return false;
    }, { timeout: 1_200, message: 'waiting for the visual-listening command to change canvas pixels' }).toBe(true);
    const firstPaintMs = Math.round(firstChangedAt - submittedAt);
    test.info().annotations.push({ type: 'fake-recognition-first-paint-ms', description: String(firstPaintMs) });
    expect(firstPaintMs).toBeLessThan(1_000);
    expect(await field.evaluate((original, current) => original === current, await canvas(page).elementHandle())).toBe(true);
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(page.locator('#live-controls')).toHaveCount(0);
});
