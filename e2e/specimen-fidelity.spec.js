/**
 * THE SPECIMEN IS A SMALLER SURFACE, NOT A WEAKER EFFECT.
 *
 * The Chamber paints a Fit word's ink over a ground plate that sits inside
 * the glyph, behind the engine. mask-ground.js declares Attractor `dark`, so
 * the Chamber backs it with Dark Slate and the filaments read. The specimen
 * had no plate: the same still — a thin bright filament on near-black —
 * was clipped to 26px letters over a near-black panel and disappeared, and
 * a reader would have concluded the effect erases the word.
 *
 * Measured rather than eyeballed, because "nearly invisible" is a number.
 */
import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'Specimen', vault: null, timestamp: Date.now() };
const SEED = { text: 'Light enters form. '.repeat(40).trim(), textSource: 'Specimen', origin: null };

test('the masking specimen shows a word a reader can read', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.addInitScript(({ gate, seed }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
        localStorage.setItem('rise-settings', JSON.stringify({ chamberFace: 'thick', fontSize: 'fit' }));
    }, { gate: GATE, seed: SEED });
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 20_000 });
    await page.locator('[data-orbit="visual"]').click();
    await expect(page.locator('.vnav')).toBeVisible();

    // A gallery room, then the Attractor as the ink that paints the letters.
    await page.locator('.vnav-node[data-id="visual"]').click();
    await page.locator('.vnav-node[data-id="gallery"]').click();
    await page.locator('.vnav-node[data-id="gallery-procedural"]').click();
    await page.locator('.vnav-node[data-id="turrell"]').click();
    await page.locator('[data-action="toggle"]').click();

    const ink = page.locator('.vnav-node[data-id="ink"]');
    for (let depth = 0; depth < 5 && !(await ink.isVisible()); depth += 1) {
        await page.locator('[data-action="navigator-back"]').click();
    }
    await ink.click();
    await page.locator('[data-word-fill="procedural:attractor"]').first().click();
    await page.waitForTimeout(2500);

    const figure = page.locator('.vnav-specimen');
    await expect(figure).toBeVisible();
    const box = await figure.boundingBox();
    expect(box.width, 'the specimen has a surface').toBeGreaterThan(80);
    expect(box.height).toBeGreaterThan(30);

    // The plate the Chamber would use, from the Chamber's own rule.
    await expect(figure).toHaveAttribute('data-specimen-ground', 'dark');

    // And the word is actually recoverable: the glyph band must differ from
    // the panel behind it by more than a rounding error. A specimen with no
    // plate measured close to zero here.
    const spread = await page.evaluate(async () => {
        const fig = document.querySelector('.vnav-specimen');
        const sample = fig.querySelector('.vnav-preview-sample');
        const panel = getComputedStyle(fig).backgroundColor;
        const paint = document.createElement('canvas').getContext('2d');
        const read = (value) => {
            paint.fillStyle = value;
            paint.fillRect(0, 0, 1, 1);
            return [...paint.getImageData(0, 0, 1, 1).data].slice(0, 3);
        };
        const ground = getComputedStyle(sample).backgroundColor;
        const [a, b] = [read(panel), read(ground)];
        return Math.round(Math.hypot(...a.map((c, i) => c - b[i])));
    });
    // eslint-disable-next-line no-console
    console.log(`specimen ground stands ${spread} from the panel behind it`);
    expect(spread, 'the letters have a ground to read against').toBeGreaterThan(30);
});
