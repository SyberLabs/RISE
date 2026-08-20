import { test, expect } from '@playwright/test';

/**
 * The reading band can be moved out of the picture's way.
 *
 * A press selects it and shows a frame; only a selected band follows the
 * pointer. The reading surface takes no other input, but a reader should
 * still not shift the words by brushing them.
 */
const GATE = { code: 'rise2025', name: 'Band', vault: null, timestamp: Date.now() };
const SEED = { text: 'The pendulum draws the chord it hears. '.repeat(60).trim(), textSource: 'Band Seed', origin: null };

async function reading(page, width = 390, height = 844) {
    await page.setViewportSize({ width, height });
    await page.addInitScript(({ g, s }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(g));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify(s));
    }, { g: GATE, s: SEED });
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 15_000 });
    await page.locator('#begin-btn').click();
    const warn = page.locator('#photosensitivity-modal');
    await warn.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
    if (await warn.isVisible()) await warn.locator('#safety-accept').click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() => window.rise?.router && !window.rise.router.transitioning);
    await page.waitForTimeout(1200);
}

const offset = (page) => page.evaluate(() =>
    getComputedStyle(document.querySelector('#chamber-field')).getPropertyValue('--band-offset').trim());

async function press(page, dy) {
    const band = page.locator('#atom-display');
    const box = await band.boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + dy, { steps: 8 });
    await page.mouse.up();
}

test('a brush does not move the words; a second press does', async ({ page }) => {
    await reading(page);
    const band = page.locator('#atom-display');
    expect(await offset(page)).toBe('0px');

    // First press selects and shows the frame — and does NOT move it.
    await press(page, 120);
    await expect(band).toHaveClass(/is-band-movable/);
    expect(await offset(page), 'the selecting press must not also drag').toBe('0px');

    // Now it follows the pointer.
    await press(page, 120);
    const moved = parseFloat(await offset(page));
    console.log('B moved to ' + moved + 'px');
    // CI #101 measured 15px on the 390-wide selecting-then-drag.
    expect(moved).toBeGreaterThan(10);
});

test('the frame is put down by Escape, and the position survives it', async ({ page }) => {
    await reading(page);
    const band = page.locator('#atom-display');
    await press(page, 0);
    await press(page, -100);
    const lifted = parseFloat(await offset(page));
    expect(lifted).toBeLessThan(0);

    await page.keyboard.press('Escape');
    await expect(band).not.toHaveClass(/is-band-movable/);
    expect(parseFloat(await offset(page)), 'putting the frame down must not recentre').toBe(lifted);
});

test('the band cannot be pushed out of its field', async ({ page }) => {
    await reading(page);
    await press(page, 0);
    await press(page, 4000);
    const px = parseFloat(await offset(page));
    const room = await page.evaluate(() => {
        const f = document.querySelector('#chamber-field');
        const b = document.querySelector('#atom-display');
        return (f.clientHeight - b.offsetHeight) / 2;
    });
    console.log('B clamped ' + px + 'px against travel ' + Math.round(room) + 'px');
    expect(px).toBeLessThanOrEqual(Math.ceil(room) + 1);
});

test('the choice is remembered for the next reading', async ({ page }) => {
    await reading(page);
    await press(page, 0);
    await press(page, -90);
    const chosen = parseFloat(await offset(page));
    expect(chosen).toBeLessThan(0);

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('rise-settings') || '{}').bandOffset);
    console.log('B stored fraction ' + stored);
    expect(typeof stored).toBe('number');
    expect(stored).toBeLessThan(0);
});

// One viewport per test: Chromium refuses a second setViewportSize on a
// maximized window, and each test gets a fresh page anyway.
for (const [label, w, h] of [['a phone', 390, 844], ['a desktop', 1280, 800]]) {
    test(`the offset lands on exactly one box on ${label}`, async ({ page }) => {
        // On a phone with glass the band is the visible box; elsewhere it
        // is `display: contents` and cannot be transformed at all, so the
        // offset belongs to .atom-display. If both took it they would
        // compound and the text would leave its own tile.
        await reading(page, w, h);
        await press(page, 0);
        await press(page, -80);

        const applied = await page.evaluate(() => {
            const read = (sel) => {
                const el = document.querySelector(sel);
                const style = getComputedStyle(el);
                const t = style.transform;
                return {
                    display: style.display,
                    ty: t === 'none' ? 0 : Math.round(parseFloat(t.split(',')[5] || '0'))
                };
            };
            return { band: read('#atom-band'), display: read('#atom-display') };
        });
        console.log(`B ${label} ` + JSON.stringify(applied));

        expect(applied.band.ty + applied.display.ty, 'the band did not move').toBeLessThan(0);
        expect(
            applied.band.ty === 0 || applied.display.ty === 0,
            'the offset was applied twice and would compound'
        ).toBe(true);
    });
}
