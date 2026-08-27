/**
 * THE PROMPT AND THE WAY BACK DO NOT SHARE A ROW.
 *
 * `.orbital-back` and `.orbital-origin-slot` are absolutely positioned in the
 * top corners while "How do you want to read?" sits in the centred flow. At
 * phone widths the flow rises into the corners and the Library chip lands on
 * top of the prompt — in the primary entry corridor.
 *
 * Measured as geometry rather than inspected: two rectangles either intersect
 * or they do not, and no amount of shrinking type is an answer to overlap.
 */
import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'Header', vault: null, timestamp: Date.now() };
const SEED = {
    text: 'Light enters form and returns through measure. '.repeat(30).trim(),
    textSource: 'Metamorphoses',
    origin: { view: 'library', name: 'Library', icon: '\u25c7' }
};

// The widths a phone actually is, plus one desktop to prove nothing regressed.
const WIDTHS = [
    { width: 320, height: 568, name: 'iPhone SE (smallest supported)' },
    { width: 375, height: 667, name: 'iPhone 8 / SE 2' },
    { width: 390, height: 844, name: 'iPhone 14' },
    { width: 430, height: 932, name: 'iPhone 15 Pro Max' },
    { width: 1280, height: 900, name: 'desktop' }
];

const intersects = (a, b) => !(
    a.x + a.width <= b.x || b.x + b.width <= a.x
    || a.y + a.height <= b.y || b.y + b.height <= a.y
);

test('the prompt and the Library chip never occupy the same pixels', async ({ page }) => {
    await page.addInitScript(({ gate, seed }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
    }, { gate: GATE, seed: SEED });
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('.stance-question')).toBeVisible({ timeout: 20_000 });

    const collisions = [];
    for (const viewport of WIDTHS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.waitForTimeout(350);

        const prompt = await page.locator('.stance-question').boundingBox();
        const library = await page.locator('.orbital-origin-chip').boundingBox();
        const back = await page.locator('.orbital-back').boundingBox();

        expect(prompt, `${viewport.name}: the prompt is on screen`).toBeTruthy();
        expect(library, `${viewport.name}: the Library chip is on screen`).toBeTruthy();

        if (intersects(prompt, library)) {
            collisions.push(`${viewport.name} (${viewport.width}px): prompt overlaps Library`);
        }
        if (intersects(prompt, back)) {
            collisions.push(`${viewport.name} (${viewport.width}px): prompt overlaps Portal`);
        }

        // Neither may leave the frame, in either direction.
        for (const [label, rect] of [['prompt', prompt], ['Library', library], ['Portal', back]]) {
            expect(rect.x, `${viewport.name}: ${label} starts inside the frame`)
                .toBeGreaterThanOrEqual(-0.5);
            expect(rect.x + rect.width, `${viewport.name}: ${label} ends inside the frame`)
                .toBeLessThanOrEqual(viewport.width + 0.5);
        }

        // And the page itself must not scroll sideways.
        const overflow = await page.evaluate(() =>
            Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth));
        expect(overflow, `${viewport.name}: no horizontal overflow`).toBeLessThanOrEqual(0);
    }

    expect(collisions, collisions.join(' | ')).toEqual([]);
});

test('the Library chip keeps a real touch target on a phone', async ({ page }) => {
    await page.addInitScript(({ gate, seed }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
    }, { gate: GATE, seed: SEED });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('.orbital-origin-chip')).toBeVisible({ timeout: 20_000 });

    for (const selector of ['.orbital-origin-chip', '.orbital-back']) {
        const box = await page.locator(selector).boundingBox();
        // 44px is the floor a finger needs; a chip may be shorter than that
        // visually only if its hit area is padded to reach it.
        const hit = await page.locator(selector).evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return { height: rect.height, minHeight: style.minHeight };
        });
        expect(Math.max(box.height, parseFloat(hit.minHeight) || 0),
            `${selector} is reachable by a finger`).toBeGreaterThanOrEqual(44);
    }
});
