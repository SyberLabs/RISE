import { test, expect } from '@playwright/test';

/**
 * Phone viewports.
 *
 * Nothing tested one until now, which is why the Library's cards could
 * push the page sideways: an edition statement arrived carrying a
 * 96-character Wikisource URL with no break in it, and no rule said a
 * card may not be wider than its column.
 *
 * THE ASSERTION IS ABOUT ELEMENTS, NOT scrollWidth, and that took a
 * verification run to learn. With the fix removed the card measured
 * `right: 464` on a 390px screen — 74px over — and document.scrollWidth
 * still read exactly 390, because `body { overflow: hidden }` clips the
 * page and hides its own overflow. A scrollWidth check would have
 * passed on a visibly broken layout, which is the shape of bug this
 * codebase keeps paying for: the measurement agreeing with itself.
 *
 * So the test asks every element whether it ends past the viewport, and
 * names the widest offender when one does.
 */
const GATE = { code: 'rise2025', name: 'M', vault: null, timestamp: Date.now() };

const PHONES = [
    { name: 'iPhone 12 portrait', width: 390, height: 844 },
    { name: 'small Android portrait', width: 360, height: 800 },
    { name: 'landscape', width: 844, height: 390 }
];

async function enter(page, width, height) {
    await page.setViewportSize({ width, height });
    await page.addInitScript((g) => localStorage.setItem('rise-beta-session', JSON.stringify(g)), GATE);
    await page.goto('/');
}

/** How far the page can be pushed sideways, in pixels. */
const overflow = (page) => page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    // The widest offender, so a failure names something rather than
    // reporting a number nobody can act on.
    widest: (() => {
        let worst = null;
        for (const el of document.querySelectorAll('body *')) {
            const right = el.getBoundingClientRect().right;
            if (right > document.documentElement.clientWidth + 1
                && (!worst || right > worst.right)) {
                worst = {
                    right: Math.round(right),
                    tag: el.tagName.toLowerCase(),
                    cls: (el.className || '').toString().slice(0, 60)
                };
            }
        }
        return worst;
    })()
}));

for (const phone of PHONES) {
    test(`the Library does not slide sideways on ${phone.name}`, async ({ page }) => {
        test.setTimeout(120000);
        await enter(page, phone.width, phone.height);
        await page.locator('[data-nav="library"]').first().click();
        await expect(page.locator('.library')).toBeVisible({ timeout: 30000 });
        // Cards render from a registry; give the list a moment to fill.
        await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 30000 });

        const measured = await overflow(page);
        console.log(`${phone.name} ${JSON.stringify(measured)}`);
        expect(measured.widest,
            measured.widest
                ? `${measured.widest.tag}.${measured.widest.cls} ends at `
                  + `${measured.widest.right}px on a ${measured.clientWidth}px screen`
                : '')
            .toBeNull();
        // Kept as a second opinion. It cannot fail alone while the body
        // clips, but it would catch an overflow the element sweep missed.
        expect(measured.scrollWidth).toBeLessThanOrEqual(measured.clientWidth + 1);
    });
}

test('a card carrying a scan URL still fits the column', async ({ page }) => {
    // Romance of the Three Kingdoms is the specific card that broke:
    // its edition statement is a 341-character sourcing memo with two
    // Wikisource file URLs in it.
    test.setTimeout(120000);
    await enter(page, 390, 844);
    await page.locator('[data-nav="library"]').first().click();
    await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 30000 });

    const card = await page.evaluate(() => {
        const el = document.querySelector('[data-text-id="romance-of-the-three-kingdoms"]');
        if (!el) return null;
        const box = el.getBoundingClientRect();
        const subtitle = el.querySelector('.archive-subtitle');
        return {
            width: Math.round(box.width),
            viewport: document.documentElement.clientWidth,
            subtitle: subtitle?.textContent.trim().slice(0, 140) || '',
            subtitleRight: Math.round(subtitle?.getBoundingClientRect().right ?? 0)
        };
    });
    console.log('CARD ' + JSON.stringify(card));

    expect(card, 'the card is not on the shelf').not.toBeNull();
    expect(card.width).toBeLessThanOrEqual(card.viewport);
    expect(card.subtitleRight).toBeLessThanOrEqual(card.viewport + 1);
    // And the URL is gone from what a reader reads.
    expect(card.subtitle).not.toContain('http');
    expect(card.subtitle).toContain('Brewitt-Taylor');
});
