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

async function openType(page, settings = null) {
    await page.addInitScript(({ gate, seed, settings }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
        if (settings) localStorage.setItem('rise-settings', JSON.stringify(settings));
    }, { gate: GATE, seed: SEED, settings });
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

/**
 * THE SPECIMEN SHOWS WHAT THE READING WILL PAINT.
 *
 * It carried imagery through the letters and nothing else, so two of the
 * three things this pane decides were invisible in the one place built to
 * show them: choosing Accent left the sample unchanged, and setting a border
 * drew no edge. Both are read from the resolved style rather than from
 * pixels, because a cream edge on cream letters is real and nearly
 * invisible — the question is whether the property applies, not whether a
 * screenshot happens to show it.
 */
test('the specimen wears the ink and the edge it is being asked about', async ({ page }) => {
    await openType(page, { chamberFace: 'thick', fontSize: 'fit' });
    await page.locator('.vnav-node[data-id="ink"]').click();
    await page.locator('[data-word-fill="accent"]').first().click();
    await page.waitForTimeout(300);

    const sample = '.vnav-specimen .vnav-preview-sample';
    const painted = await page.evaluate((sel) => {
        const style = getComputedStyle(document.querySelector(sel));
        const accent = getComputedStyle(document.documentElement)
            .getPropertyValue('--color-accent').trim();
        const canvas = document.createElement('canvas').getContext('2d');
        canvas.fillStyle = accent;
        canvas.fillRect(0, 0, 1, 1);
        const [r, g, b] = [...canvas.getImageData(0, 0, 1, 1).data].slice(0, 3);
        return { ink: style.webkitTextFillColor || style.color, accent: `rgb(${r}, ${g}, ${b})` };
    }, sample);
    expect(painted.ink, 'the sample is inked with the accent it was told to use')
        .toBe(painted.accent);

    // The edge, under the one condition the Chamber draws one.
    await page.locator('.vnav-node[data-id="size"]').click();
    await page.waitForTimeout(300);
    const strokeFor = async (border) => {
        await page.locator(`[data-word-fill-border="${border}"]`).first().click();
        await page.waitForTimeout(300);
        return page.evaluate((sel) => {
            const style = getComputedStyle(document.querySelector(sel));
            return { colour: style.webkitTextStrokeColor, width: style.webkitTextStrokeWidth };
        }, sample);
    };

    const off = await strokeFor('off');
    const cream = await strokeFor('cream');
    const accentEdge = await strokeFor('accent');

    // Off declares no stroke at all, so its COLOUR falls back to currentColor
    // and says nothing; the width is what tells you whether an edge is drawn.
    expect(parseFloat(off.width), `Off drew a ${off.width} edge`).toBe(0);
    expect(parseFloat(cream.width), 'Cream draws one').toBeGreaterThan(0);
    expect(parseFloat(accentEdge.width), 'Accent draws one').toBeGreaterThan(0);
    expect(accentEdge.colour, 'and a different colour from Cream').not.toBe(cream.colour);
});

// Glass is a tile behind the text, and a Fit word leaves no behind: a frosted
// plate under a word that fills the chamber is the size of the room, and the
// field the reader chose would be behind it.
test('Glass stands aside the moment Fit is chosen', async ({ page }) => {
    await openType(page, { chamberFace: 'literary', fontSize: 'medium' });
    const glass = page.locator('[data-action="glass"]');
    expect(await glass.isDisabled(), 'available at a fixed scale').toBe(false);

    await page.locator('.vnav-node[data-id="size"]').click();
    await page.locator('[data-font-size="fit"]').first().click();
    await page.waitForTimeout(400);
    expect(await glass.isDisabled(), 'withdrawn once the word holds the frame').toBe(true);
});
