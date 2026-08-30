/**
 * THE RING SITS BETWEEN THE STANCES AND BEGIN, NOT AGAINST ONE OF THEM.
 *
 * Temporal rides a full radius above the middle; Audio and Visual only half a
 * radius below it. So the ring's visual centre is a quarter-radius ABOVE its
 * own box's centre, and a stage with equal margins hung it against the stance
 * row with a gulf beneath — measured 9px above and 124px below on a laptop,
 * 3 and 145 on a larger screen.
 *
 * The correction moves a quarter radius from the bottom margin to the top,
 * so the column's total height does not change by a pixel. That matters:
 * Begin has to stay above the floor, which orbital-reach.spec.js measures.
 */
import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'Centring', vault: null, timestamp: Date.now() };
const SEED = { text: 'Light enters form. '.repeat(60).trim(), textSource: 'Metamorphoses', origin: null };

const DESKTOP = [
    { width: 1078, height: 900 },
    { width: 1280, height: 900 },
    { width: 1440, height: 1080 },
    { width: 1920, height: 1080 }
];

const gapsAt = (page) => page.evaluate(() => {
    const rect = sel => document.querySelector(sel)?.getBoundingClientRect();
    const stances = rect('.orbital-stances');
    const begin = rect('#begin-btn');
    const orbs = [...document.querySelectorAll('.orbit-node')].map(n => n.getBoundingClientRect());
    if (!stances || !begin || !orbs.length) return null;
    return {
        above: Math.round(Math.min(...orbs.map(o => o.top)) - stances.bottom),
        below: Math.round(begin.top - Math.max(...orbs.map(o => o.bottom)))
    };
});

test('the ring is not hung against the stance row', async ({ page }) => {
    await page.addInitScript(({ gate, seed }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
    }, { gate: GATE, seed: SEED });
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('#begin-btn')).toBeVisible({ timeout: 20_000 });

    const seen = [];
    for (const viewport of DESKTOP) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(350);
        const gaps = await gapsAt(page);
        seen.push({ at: `${viewport.width}x${viewport.height}`, ...gaps });
    }
    // eslint-disable-next-line no-console
    console.log('CENTRING ' + JSON.stringify(seen));

    for (const row of seen) {
        expect(row.above, `${row.at}: the ring stands off the stances (${row.above}px)`)
            .toBeGreaterThan(35);
        // Not perfect symmetry — the stance note and Begin carry their own
        // margins — but the same order of magnitude, where it was 14x to 48x.
        expect(row.below / row.above, `${row.at}: ${row.above} above, ${row.below} below`)
            .toBeLessThan(2);
    }
});

test('a phone gives Begin its distance instead', async ({ page }) => {
    // The phone stage is sized in vw against a tight column, so it takes its
    // room under Begin rather than centring the ring.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(({ gate, seed }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
    }, { gate: GATE, seed: SEED });
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('#begin-btn')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(350);

    const gaps = await gapsAt(page);
    // eslint-disable-next-line no-console
    console.log('PHONE ' + JSON.stringify(gaps));
    expect(gaps.below, `Begin stands clear of the lower orbs (${gaps.below}px)`)
        .toBeGreaterThan(100);
});
