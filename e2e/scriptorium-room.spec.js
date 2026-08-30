/**
 * A ROOM, NOT A PAGE OF RAW MARKUP.
 *
 * The Scriptorium ran edge to edge — padding and nothing else — so on any
 * wide screen the prose ran the full width of the monitor with no column to
 * read down. And render() replaces the container's innerHTML wholesale, but
 * `.scriptorium` IS the scroll container, so every action tore out the
 * element holding the scroll offset and rebuilt it at the top. A reader who
 * pressed anything was thrown back to the first line.
 */
import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'Scriptorium', vault: null, timestamp: Date.now() };

async function openScriptorium(page) {
    await page.addInitScript((gate) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
    }, GATE);
    await page.goto('/');
    await expect(page.locator('[data-nav="library"]').first()).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => window.rise?.router?.navigate('scriptorium'));
    await expect(page.locator('.scriptorium')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(600);
}

test('the room holds its content in a column rather than against the glass', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await openScriptorium(page);

    const measured = await page.evaluate(() => {
        const room = document.querySelector('.scriptorium');
        const heading = room.querySelector('h1');
        const prose = room.querySelector('.scriptorium-sub');
        const roomRect = room.getBoundingClientRect();
        const inset = (el) => {
            const r = el.getBoundingClientRect();
            return { left: Math.round(r.left - roomRect.left), right: Math.round(roomRect.right - r.right) };
        };
        return { width: Math.round(roomRect.width), heading: inset(heading), prose: inset(prose) };
    });

    // eslint-disable-next-line no-console
    console.log('ROOM ' + JSON.stringify(measured));

    // On a 1600px monitor the reading column is a column, not the monitor.
    expect(measured.heading.left, 'the room breathes on the left').toBeGreaterThan(40);
    expect(measured.heading.right, 'and on the right').toBeGreaterThan(40);
    // And it is centred rather than merely padded: both sides agree.
    expect(Math.abs(measured.heading.left - measured.heading.right),
        'the column is centred').toBeLessThan(8);
});

test('an action leaves the reader where they were standing', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openScriptorium(page);

    const room = page.locator('.scriptorium');
    await room.evaluate(el => { el.scrollTop = Math.round(el.scrollHeight * 0.45); });
    await page.waitForTimeout(200);
    const before = await room.evaluate(el => Math.round(el.scrollTop));
    expect(before, 'the room scrolls at all').toBeGreaterThan(50);

    // Any action rebuilds the room. The reader should not travel with it.
    await page.evaluate(() => {
        const field = document.querySelector('#scriptorium-intent');
        field.value = 'A sequence about memory and loss.';
        field.dispatchEvent(new Event('input', { bubbles: true }));
        window.rise?.router?.views?.get('scriptorium')?.instance?.render?.();
    });
    await page.waitForTimeout(300);

    const after = await page.locator('.scriptorium').evaluate(el => Math.round(el.scrollTop));
    // eslint-disable-next-line no-console
    console.log(`SCROLL ${before} -> ${after}`);
    expect(Math.abs(after - before), `scrolled from ${before} to ${after}`).toBeLessThan(24);
});
