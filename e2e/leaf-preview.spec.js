/**
 * THE PREVIEW SHOWS THE THING THAT WAS CHOSEN.
 *
 * Genesis previewed as a few thin strokes and did not change when its presets
 * did, and two separate faults produced that.
 *
 * A still was drawn through the flash path, which advances growth by at most
 * 0.38 per step because in a reading the flashes accumulate across an episode
 * — a Genesis composition is meant to arrive over ~28 seconds. Asked for one
 * still it returned a third of a drawing.
 *
 * And the still left a half-grown episode behind it. _choosePreset returns
 * `episode.preset` while the episode is unfinished and _prepareArtwork reuses
 * its artwork on the same test, so the first still held both hostage and every
 * later one came back identical no matter which preset was pressed.
 *
 * Measured on the painted pixels, because both faults were invisible to any
 * assertion about state: the panel was doing exactly what it was told.
 */
import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'Leaf Preview', vault: null, timestamp: Date.now() };
const SEED = { text: 'Light enters form. '.repeat(40).trim(), textSource: 'Leaf Preview', origin: null };

async function openDynamic(page) {
    await page.addInitScript(({ gate, seed }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
    }, { gate: GATE, seed: SEED });
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 20_000 });
    await page.locator('[data-orbit="visual"]').click();
    await expect(page.locator('.vnav')).toBeVisible();
    await page.locator('.vnav-node[data-id="visual"]').click();
    await page.locator('.vnav-node[data-id="dynamic"]').click();
}

/** The lit pixels of the current preview, as a coarse bitmask plus its size. */
const inkMask = (page) => page.evaluate(async () => {
    const slot = document.querySelector('.vnav-preview');
    const url = (getComputedStyle(slot).backgroundImage.match(/url\("([^"]+)"\)/) || [])[1];
    if (!url) return null;
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const mask = [];
    for (let i = 0; i < px.length; i += 4) {
        mask.push(px[i] + px[i + 1] + px[i + 2] > 60 ? 1 : 0);
    }
    return { mask, lit: mask.reduce((a, b) => a + b, 0), of: mask.length };
});

/**
 * How much of A's drawing lies inside B's.
 *
 * The two faults produce pixel-different images for the WRONG reason: one
 * composition advanced three times is three different pictures by any
 * byte comparison, while being the same drawing at three stages. A growing
 * drawing only adds strokes, so the earlier is a near-subset of the later
 * and this runs to ~1. Three independent compositions do not nest.
 */
const containment = (a, b) => {
    let shared = 0;
    for (let i = 0; i < a.mask.length; i += 1) if (a.mask[i] && b.mask[i]) shared += 1;
    return a.lit ? +(shared / a.lit).toFixed(3) : 0;
};

test('Genesis previews a finished composition, and a different one per preset', async ({ page }) => {
    await openDynamic(page);
    await page.locator('.vnav-node[data-id="klee"]').click();
    await expect(page.locator('.vnav-preview')).toBeVisible();

    const shots = new Map();
    const inked = [];
    for (const preset of ['architectural', 'chaotic', 'gravitational']) {
        await page.locator(`[data-sub="preset"][data-val="${preset}"]`).first().click();
        await page.waitForTimeout(2200);
        const shot = (await page.locator('.vnav-preview').screenshot()).toString('base64');
        shots.set(preset, shot);
        inked.push({ preset, ...(await inkMask(page)) });
    }

    const nesting = [];
    for (let i = 0; i + 1 < inked.length; i += 1) {
        nesting.push({
            pair: `${inked[i].preset}→${inked[i + 1].preset}`,
            inside: containment(inked[i], inked[i + 1])
        });
    }
    // eslint-disable-next-line no-console
    console.log(inked.map(r => `${r.preset} ${(r.lit / r.of * 100).toFixed(2)}%`).join(' · ')
        + ' || ' + nesting.map(n => `${n.pair} ${(n.inside * 100).toFixed(0)}% inside`).join(' · '));

    expect(new Set(shots.values()).size,
        `${shots.size} presets produced ${new Set(shots.values()).size} distinct previews`).toBe(3);

    // Independent compositions, not one drawing caught at three stages.
    for (const { pair, inside } of nesting) {
        expect(inside, `${pair}: ${(inside * 100).toFixed(0)}% of the first lies inside the second`)
            .toBeLessThan(0.5);
    }
});

test('a shipped still is shown whole, not cropped to the frame', async ({ page }) => {
    await openDynamic(page);
    await page.locator('.vnav-node[data-id="apparitio"]').click();
    await expect(page.locator('.vnav-preview')).toBeVisible();
    await page.waitForTimeout(1500);

    const fit = await page.evaluate(() => {
        const slot = document.querySelector('.vnav-preview');
        const style = getComputedStyle(slot);
        return { size: style.backgroundSize, painted: style.backgroundImage.includes('url(') };
    });
    expect(fit.painted, 'the still painted').toBe(true);
    // `cover` crops: every shipped still measures between 0.93 and 1.34 to 1
    // inside a frame that was 16:9, so all four lost their top and bottom.
    expect(fit.size).toBe('contain');

    // The glyph was a stand-in for a picture; with the picture there it is litter.
    expect(await page.locator('.vnav-preview .vnav-preview-glyph').count()).toBe(0);
});
