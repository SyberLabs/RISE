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
import { test, expect, connectTestOpenRouter } from './fixtures.js';


async function openPortal(page) {
    await page.goto('/');
    await expect(page.locator('.portal .home-title').first()).toBeVisible({ timeout: 15_000 });
}

/** Press at a door's centre with a real mouse, the way a hand does. */
async function pressAt(page, selector) {
    const box = await page.locator(selector).first().boundingBox();
    expect(box, `${selector} has no box to press`).toBeTruthy();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
}

/** Every room sits behind the one Menu; open it by pressing it. */
async function openMenu(page) {
    await pressAt(page, '.portal-menu-toggle');
    await expect(page.locator('.portal-nav')).toBeVisible();
}

/**
 * What a cursor at this element's centre would actually hit.
 * @returns {Promise<{reachable: boolean, hit: string}>}
 */
async function hitTest(page, selector) {
    // The Jev request is now the first viewport. Secondary doors remain
    // reachable in the Portal's scroll container; test each after scrolling.
    await page.locator(selector).first().scrollIntoViewIfNeeded();
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
        await openMenu(page);

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

    test('Read opens from a real mouse press, without force', async ({ page }) => {
        await openPortal(page);
        await page.waitForTimeout(3000);

        // Read sits in the Menu.
        await openMenu(page);
        const box = await page.locator('[data-nav="read"]').first().boundingBox();
        expect(box, 'the Read button has no box to press').toBeTruthy();
        expect(box.y + box.height / 2, 'the Read button centre is below the viewport')
            .toBeLessThan(page.viewportSize().height);

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
        await openMenu(page);

        const { reachable, hit } = await hitTest(page, '[data-nav="read"]');
        expect(reachable, `the Read entrance is covered by ${hit} at 390x844`).toBe(true);
    });
});

test('Read it with sound, Another reading, the link, the legal links and Ask are reachable on a desk and a phone', async ({ page }) => {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        await openPortal(page);
        await page.reload();
        await expect(page.locator('h1')).toContainText(', by ', { timeout: 15_000 });
        const check = async selector => {
            const { reachable, hit } = await hitTest(page, selector);
            expect(reachable, `${selector} is covered by ${hit} at ${viewport.width}px`).toBe(true);
        };
        // The engine and its scrim lie under the bar; every key must still take the press.
        for (const selector of ['[data-home="enter"]', '[data-home="roll"]', '[data-home="library"]', '.portal-legal-link']) await check(selector);
        await pressAt(page, '[data-home="roll"]');
        await expect(page.locator('[data-home="adjust"]')).toBeVisible({ timeout: 10_000 });
        for (const selector of ['[data-home="enter"]', '[data-home="roll"]', '[data-home="adjust"]']) await check(selector);
        await connectTestOpenRouter(page);
        await openMenu(page);
        await check('[data-home="ask-open"]');
        await pressAt(page, '[data-home="ask-open"]');
        await expect(page.locator('#home-intent')).toBeVisible();
        for (const selector of ['#home-intent', '[data-home="ask"]', '[data-home="ask-cancel"]']) await check(selector);
    }
});

// The SyberLabs home is neutral ink on near-black: a sitting may retint the
// RISE marker, never the chrome, so every text colour stays legible whatever
// the reader chose.
const SITTINGS = ['default', 'slate', 'ivory', 'purple', 'cobalt', 'amber',
    'sunset', 'gecko', 'garnet', 'teal', 'orchid'];

test('Home text keeps AA contrast in every sitting', async ({ page }) => {
    await openPortal(page);
    // The quieter text (the caption's plan words, Adjust) appears once there is a rolled reading.
    await page.locator('[data-home="roll"]').click();
    await expect(page.locator('[data-home="adjust"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.home-stream .reading-stream-current')).not.toBeEmpty({ timeout: 15_000 });
    const results = await page.evaluate((sittings) => {
        const rgb = colour => {
            const ctx = document.createElement('canvas').getContext('2d');
            ctx.fillStyle = colour;
            ctx.fillRect(0, 0, 1, 1);
            return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
        };
        const channel = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        const lum = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
        const ground = rgb(getComputedStyle(document.querySelector('.portal')).backgroundColor);
        const out = [];
        for (const id of sittings) {
            if (id === 'default') document.documentElement.removeAttribute('data-accent');
            else document.documentElement.setAttribute('data-accent', id);
            for (const sel of ['.portal-nav-link', '.home-title', '.home-label', '.home-link', '[data-home="adjust"]', '.portal-footer-link', '.home-stream .reading-stream-current', '.home-stream .reading-stream-previous']) {
                out.push({ id, sel, ratio: +ratio(rgb(getComputedStyle(document.querySelector(sel)).color), ground).toFixed(2) });
            }
        }
        return out;
    }, SITTINGS);
    for (const { id, sel, ratio } of results) {
        expect(ratio, `${sel} in ${id} measured ${ratio}:1`).toBeGreaterThanOrEqual(4.5);
    }
});
