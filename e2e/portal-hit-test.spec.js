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
    await expect(page.locator('[data-nav="library"]').first()).toBeVisible({ timeout: 15_000 });
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

test('Try RISE remains a profile-colored reachable seal', async ({ page }) => {
    await openPortal(page);
    await page.waitForTimeout(3000);
    const { reachable, hit } = await hitTest(page, '[data-nav="keystones"]');
    expect(reachable, `Try RISE is covered by ${hit}`).toBe(true);

    const seal = page.locator('[data-nav="keystones"]');
    const material = await seal.evaluate(node => ({
        accent: getComputedStyle(document.documentElement).getPropertyValue('--color-accent-rgb').trim(),
        background: getComputedStyle(node).backgroundImage,
        radius: getComputedStyle(node).borderRadius,
        beforePointerEvents: getComputedStyle(node, '::before').pointerEvents,
        afterPointerEvents: getComputedStyle(node, '::after').pointerEvents
    }));
    expect(material.accent).not.toBe('');
    expect(material.background).toContain('radial-gradient');
    expect(material.radius).toBe('50%');
    expect(material.beforePointerEvents).toBe('none');
    expect(material.afterPointerEvents).toBe('none');

    await seal.focus();
    await expect(seal).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/try-rise$/);
    await expect(page.locator('.keystones')).toBeVisible();
});

test('Try RISE remains wholly reachable on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPortal(page);
    await page.waitForTimeout(3000);
    const { reachable, hit } = await hitTest(page, '[data-nav="keystones"]');
    expect(reachable, `Try RISE is covered by ${hit}`).toBe(true);
    const box = await page.locator('[data-nav="keystones"]').boundingBox();
    expect(box).toBeTruthy();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
});

/**
 * The seal's ink, measured rather than assumed.
 *
 * The seal is lit by the sitting's accent over a slate body, so no token
 * name can promise its label is legible: what a reader sees is a composite
 * of three gradients, a rim, and an inset shadow, and only the browser
 * knows the result. This renders it in every sitting and measures the real
 * contrast against the LIGHTEST pixel beneath the label — the worst case,
 * not the average.
 */
const SITTINGS = ['slate', 'ivory', 'purple', 'cobalt', 'amber',
    'sunset', 'gecko', 'garnet', 'teal', 'orchid'];

test('the Try RISE seal keeps a legible ink in every sitting', async ({ page }) => {
    await openPortal(page);
    await page.waitForTimeout(3000);

    const measured = [];
    for (const sitting of SITTINGS) {
        // Hide the ink so the capture is pure seal body, and take the colour
        // the label actually renders in.
        const ink = await page.evaluate((id) => {
            document.documentElement.setAttribute('data-accent', id);
            const seal = document.querySelector('[data-nav="keystones"]');
            const colour = getComputedStyle(seal.querySelector('.try-label')).color;
            seal.querySelectorAll('.try-label, .try-mark')
                .forEach(node => { node.style.visibility = 'hidden'; });
            return colour;
        }, sitting);
        await page.waitForTimeout(120);

        const box = await page.locator('[data-nav="keystones"]').boundingBox();
        const shot = (await page.screenshot({ clip: box })).toString('base64');

        const contrast = await page.evaluate(async ({ data, inkColour }) => {
            const img = new Image();
            await new Promise(done => { img.onload = done; img.src = 'data:image/png;base64,' + data; });
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

            const channel = v => {
                v /= 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            };
            const luminance = (r, g, b) =>
                0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

            // Inside the circle, in the band the label occupies.
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const radius = Math.min(cx, cy) * 0.82;
            let lightest = -1;
            for (let y = Math.floor(canvas.height * 0.34); y < canvas.height * 0.72; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    if ((x - cx) ** 2 + (y - cy) ** 2 > radius * radius) continue;
                    const i = (y * canvas.width + x) * 4;
                    lightest = Math.max(lightest, luminance(pixels[i], pixels[i + 1], pixels[i + 2]));
                }
            }
            const [r, g, b] = inkColour.match(/\d+/g).map(Number);
            const inkLuminance = luminance(r, g, b);
            const [hi, lo] = [inkLuminance, lightest].sort((a, z) => z - a);
            return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
        }, { data: shot, inkColour: ink });

        measured.push({ sitting, contrast });

        await page.evaluate(() => {
            document.querySelectorAll('.try-label, .try-mark')
                .forEach(node => { node.style.removeProperty('visibility'); });
        });
    }

    for (const { sitting, contrast } of measured) {
        expect(contrast, `Try RISE ink on ${sitting} measured ${contrast}:1`)
            .toBeGreaterThanOrEqual(4.5);
    }
});
