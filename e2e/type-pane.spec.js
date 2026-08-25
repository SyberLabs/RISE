/**
 * THE WORD BEING CHANGED STAYS IN THE FRAME.
 *
 * Face, Size and Ink are three attributes of ONE word, and the Type pane
 * shows that word. But the three sections stack down a 26rem scrollport, so
 * reaching Large or the mask carried the specimen off the top: the reader was
 * choosing blind, with the evidence of the choice out of the frame.
 *
 * Measured on geometry, not on a CSS spelling — `position: sticky` fails
 * silently when an ancestor scrolls instead, and only the rendered rectangle
 * can tell you which happened.
 */
import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'Type Pane', vault: null, timestamp: Date.now() };
const SEED = {
    text: 'Light enters form and returns through measure. '.repeat(40).trim(),
    textSource: 'Type Pane Seed',
    origin: null
};

async function openType(page) {
    await page.addInitScript(({ gate, seed }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
    }, { gate: GATE, seed: SEED });
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 20_000 });
    await page.locator('[data-orbit="visual"]').click();
    await expect(page.locator('.vnav')).toBeVisible();
    const size = page.locator('.vnav-node[data-id="size"]');
    for (let depth = 0; depth < 4 && !(await size.isVisible()); depth += 1) {
        await page.locator('[data-action="navigator-back"]').click();
    }
}

/** How much of the specimen is inside the pane's own scrollport. */
const visibleFraction = (page) => page.evaluate(() => {
    const pane = document.querySelector('.vnav-entry');
    const spec = pane?.querySelector('.vnav-specimen');
    if (!pane || !spec) return null;
    const p = pane.getBoundingClientRect();
    const s = spec.getBoundingClientRect();
    const covered = Math.max(0, Math.min(p.bottom, s.bottom) - Math.max(p.top, s.top));
    return +(covered / s.height).toFixed(3);
});

test('the specimen stays in the frame through every section of the Type pane', async ({ page }) => {
    await openType(page);
    await page.locator('.vnav-node[data-id="face"]').click();
    await expect(page.locator('.vnav-specimen')).toBeVisible();

    expect(await visibleFraction(page), 'at rest').toBe(1);

    // Scrolled to the very bottom of the pane — past Size, past Ink.
    await page.locator('.vnav-entry').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(200);
    expect(await visibleFraction(page), 'scrolled to the bottom of the pane').toBe(1);
});

test('naming a section in the rail travels to it', async ({ page }) => {
    await openType(page);

    const offsetOf = (section) => page.evaluate((name) => {
        const pane = document.querySelector('.vnav-entry');
        const el = pane?.querySelector(`[data-section="${name}"]`);
        if (!pane || !el) return null;
        const spec = pane.querySelector('.vnav-specimen');
        // Distance from the section's top to the bottom edge of the pinned
        // specimen: 0 means it is sitting right where the reader was sent.
        return Math.round(el.getBoundingClientRect().top
            - (spec ? spec.getBoundingClientRect().bottom : pane.getBoundingClientRect().top));
    }, section);

    for (const section of ['ink', 'size', 'face']) {
        await page.locator(`.vnav-node[data-id="${section}"]`).click();
        await expect(page.locator('.vnav-specimen')).toBeVisible();
        await page.waitForTimeout(200);

        expect(await visibleFraction(page), `${section}: specimen still whole`).toBe(1);
        const offset = await offsetOf(section);
        expect(offset, `${section} landed ${offset}px from the specimen's edge`)
            .toBeLessThanOrEqual(24);
        expect(offset, `${section} landed ${offset}px ABOVE the specimen`)
            .toBeGreaterThanOrEqual(-24);
    }
});
