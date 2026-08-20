/**
 * THE PIXEL A CURSOR LANDS ON.
 *
 * Every other spec in this directory dispatches at an element it has
 * already found. A reader does not do that. A reader puts a cursor at a
 * coordinate and presses, and whatever is topmost at that coordinate is
 * what receives the press — so a suite that only ever dispatches at
 * elements cannot see an overlay, and 2,218 passing unit tests cannot
 * either.
 *
 * An engineering review reported the Portal's main entrance as a dead
 * button on exactly this reasoning, ranked it CRITICAL, and it did not
 * reproduce: `document.elementFromPoint` at the button's centre returns
 * the button, and a real mouse press navigates. But there was no way for
 * anyone to settle that from inside the repository, which is why the
 * claim survived four rounds. This spec is the way.
 *
 * It asserts the hit test, not the click. Playwright's own `.click()`
 * auto-waits for actionability and would paper over a real overlay by
 * retrying until it cleared; `elementFromPoint` is the same test the
 * browser runs for a human, with no retry and no synthetic events.
 */
import { test, expect } from '@playwright/test';

const GATE_SESSION = {
    code: 'rise2025',
    name: 'Hit-test Harness',
    vault: null,
    timestamp: Date.now()
};

async function openPortal(page) {
    await page.addInitScript((gate) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
    }, GATE_SESSION);
    await page.goto('/');
    await expect(page.locator('.portal-arch-sol')).toBeVisible({ timeout: 15_000 });
}

/**
 * What a cursor at this element's centre would actually hit.
 * @returns {Promise<{reachable: boolean, hit: string}>}
 */
function hitTest(page, selector) {
    return page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return { reachable: false, hit: 'element not in the DOM' };
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return { reachable: false, hit: 'zero area' };
        const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        if (!top) return { reachable: false, hit: 'nothing at that point' };
        const reachable = top === el || el.contains(top) || top.contains(el);
        const cls = top.className?.toString?.() || '';
        return { reachable, hit: `${top.tagName}${cls ? '.' + cls.split(/\s+/).join('.') : ''}` };
    }, selector);
}

test.describe('the Portal has no overlay between a cursor and a door', () => {
    test('every visible destination is reachable at its own centre', async ({ page }) => {
        await openPortal(page);
        // Let the entrance animation finish. A door that is only
        // reachable after a delay is still a defect, so the delay is
        // bounded and the assertion is made once, not polled.
        await page.waitForTimeout(3000);

        const destinations = await page.$$eval('[data-nav]', nodes => nodes
            .filter(n => n.getBoundingClientRect().width > 0
                && getComputedStyle(n).visibility !== 'hidden'
                && Number(getComputedStyle(n).opacity) > 0.05)
            .map(n => n.getAttribute('data-nav')));

        expect(destinations.length, 'the Portal presented no destinations').toBeGreaterThan(2);

        for (const nav of destinations) {
            const { reachable, hit } = await hitTest(page, `[data-nav="${nav}"]`);
            expect(reachable, `[data-nav="${nav}"] is covered by ${hit}`).toBe(true);
        }
    });

    test('CHAMBER opens from a real mouse press, without force', async ({ page }) => {
        await openPortal(page);
        await page.waitForTimeout(3000);

        const box = await page.locator('[data-nav="chamber"]').first().boundingBox();
        expect(box, 'the Chamber button has no box to press').toBeTruthy();

        // move → press → release at the coordinate, the way a hand does
        // it. No locator click, so no actionability retry to hide behind.
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.up();

        // Arrival is the assertion. Whether Begin is enabled depends on
        // whether a text is loaded, which is a different spec's business.
        await expect(page.locator('#begin-btn')).toBeVisible({ timeout: 10_000 });
    });

    test('the entrance is reachable on a phone as well as a desk', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openPortal(page);
        await page.waitForTimeout(3000);

        const { reachable, hit } = await hitTest(page, '[data-nav="chamber"]');
        expect(reachable, `the Chamber entrance is covered by ${hit} at 390x844`).toBe(true);
    });
});
