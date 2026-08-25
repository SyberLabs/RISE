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
// 'default' is the ground state and the ABSENCE of data-accent, so it is
// dressed by clearing the attribute rather than by setting it.
const SITTINGS = ['default', 'slate', 'ivory', 'purple', 'cobalt', 'amber',
    'sunset', 'gecko', 'garnet', 'teal', 'orchid'];

test('the Try RISE seal keeps a legible ink in every sitting', async ({ page }) => {
    await openPortal(page);
    await page.waitForTimeout(3000);

    const measured = [];
    for (const sitting of SITTINGS) {
        // Hide the ink so the capture is pure seal body, and take the colour
        // the label actually renders in.
        const ink = await page.evaluate((id) => {
            if (id === 'default') document.documentElement.removeAttribute('data-accent');
            else document.documentElement.setAttribute('data-accent', id);
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

// A SITTING THAT LOOKS LIKE SLATE IS NOT A SITTING.
// Ivory used to fail this. Every sitting dresses the Portal tiles by mixing
// its hue into the void, and a saturated hue reads at that strength — but a
// pale one does not: ivory's tile resolved DARKER than the slate default it
// was meant to differ from, and was the least distinguishable of the nine.
// So ivory carries its surface at full strength and flips its ink, and both
// halves of that bargain are measured here rather than spelled.
test('every sitting gives the Portal tiles a distinct, legible surface', async ({ page }) => {
    await openPortal(page);
    await page.waitForTimeout(2000);

    const channel = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    const contrast = (a, b) => {
        const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
    };

    const TILE = '.nav-secondary .nav-item';
    const HERO = '.nav-primary .nav-item';

    // TWO QUESTIONS, TWO INSTRUMENTS.
    //
    // LEGIBILITY is what a reader's eye receives, so it is measured on pixels:
    // the composited surface carries gradient, border, and shadow, and no
    // token can tell you what they add up to.
    //
    // DISTINCTNESS is what the sitting declares, and pixels are the wrong
    // instrument for it. Averaging a crop mixes the page ground and the
    // antialiased border in with the surface, which compressed real spreads of
    // 25-38 down to 4-16 AND moved by ±4 between machines — enough, against a
    // bar of 5, to fail a sitting on one runner and pass it on another. It is
    // read from the resolved surface token instead: the very thing a sitting
    // sets, and the same number everywhere.
    // .nav-item transitions `color`, so a read taken in the same task returns
    // the OUTGOING sitting's ink. Dress first, let the transition land, then read.
    const dress = async (sitting) => {
        await page.evaluate((id) => {
            if (id === 'default') document.documentElement.removeAttribute('data-accent');
            else document.documentElement.setAttribute('data-accent', id);
        }, sitting);
        await page.waitForTimeout(400);
    };

    const inkOf = (sel) => page.evaluate((selector) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = getComputedStyle(document.querySelector(selector)).color;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
    }, sel);

    // What the sitting declares the surface to be, resolved by the browser
    // (color-mix and color(srgb ...) both come back as numbers this way).
    const declaredSurfaceOf = (sel) => page.evaluate((selector) => {
        const style = getComputedStyle(document.querySelector(selector));
        const found = (style.backgroundImage || '').match(/(rgba?\([^)]*\)|color\([^)]*\))/);
        const paint = document.createElement('canvas').getContext('2d');
        paint.fillStyle = found ? found[1] : style.backgroundColor;
        paint.fillRect(0, 0, 1, 1);
        return [...paint.getImageData(0, 0, 1, 1).data].slice(0, 3);
    }, sel);

    const surfaceOf = async (sel) => {
        const box = await page.locator(sel).first().boundingBox();
        const shot = await page.screenshot({
            clip: { x: box.x + box.width * 0.3, y: box.y + box.height * 0.3,
                    width: Math.max(4, box.width * 0.4), height: Math.max(4, box.height * 0.4) }
        });
        return page.evaluate(async (data) => {
            const img = new Image();
            await new Promise(done => { img.onload = done; img.src = 'data:image/png;base64,' + data; });
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            const sum = [0, 0, 0];
            for (let i = 0; i < px.length; i += 4) { sum[0] += px[i]; sum[1] += px[i + 1]; sum[2] += px[i + 2]; }
            return sum.map(c => Math.round(c / (px.length / 4)));
        }, shot.toString('base64'));
    };

    await dress('default');
    const groundTile = await declaredSurfaceOf(TILE);
    const seen = [];

    for (const sitting of SITTINGS.filter(s => s !== 'default')) {
        await dress(sitting);
        const row = { sitting };
        for (const [part, sel] of [['tile', TILE], ['hero', HERO]]) {
            row[`${part}Ink`] = await inkOf(sel);
            row[`${part}Surface`] = await surfaceOf(sel);
            row[`${part}Contrast`] = contrast(row[`${part}Ink`], row[`${part}Surface`]);
            // Hover lightens the surface, so it is its own legibility case.
            await page.locator(sel).first().hover();
            await page.waitForTimeout(400);
            row[`${part}HoverContrast`] = contrast(await inkOf(sel), await surfaceOf(sel));
            await page.mouse.move(0, 0);
            await page.waitForTimeout(400);
        }
        row.declared = await declaredSurfaceOf(TILE);
        row.apart = Math.round(Math.hypot(...row.declared.map((c, i) => c - groundTile[i])));
        seen.push(row);
    }

    // eslint-disable-next-line no-console
    console.log('default tile rgb(' + groundTile + ')\n' + seen.map(r =>
        `${r.sitting.padEnd(8)} tile rgb(${r.declared}) ink ${r.tileContrast}:1 · ` +
        `hero ${r.heroContrast}:1 · hover ${r.tileHoverContrast}/${r.heroHoverContrast}:1 · ${r.apart} from default`).join('\n'));

    for (const r of seen) {
        expect(r.tileContrast, `${r.sitting} tile ink measured ${r.tileContrast}:1`).toBeGreaterThanOrEqual(4.5);
        expect(r.heroContrast, `${r.sitting} hero ink measured ${r.heroContrast}:1`).toBeGreaterThanOrEqual(4.5);
        expect(r.tileHoverContrast, `${r.sitting} tile ink on hover measured ${r.tileHoverContrast}:1`).toBeGreaterThanOrEqual(4.5);
        expect(r.heroHoverContrast, `${r.sitting} hero ink on hover measured ${r.heroHoverContrast}:1`).toBeGreaterThanOrEqual(4.5);
        // Every sitting genuinely dresses the tile: the family measures 25-38
        // from the ground state, so 20 fails a sitting that has stopped
        // carrying its hue without failing one that carries it a little less.
        expect(r.apart, `${r.sitting} tile sits only ${r.apart} from the ground state`).toBeGreaterThan(20);
        if (r.sitting === 'ivory') {
            // Ivory is the one sitting whose surface IS its hue. It measured
            // 20 once, and DARKER than the ground state it was meant to differ
            // from; it measures 213 now.
            expect(r.apart, `ivory tile sits ${r.apart} from the ground state`).toBeGreaterThan(120);
        }
    }
});
