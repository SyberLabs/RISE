/**
 * THE NAVIGATOR WAITS FOR A READING, AND SAYS SO WHERE THE WORK WOULD BE.
 *
 * It used to render its whole browser under a one-line notice: a reader could
 * walk the tree, open a leaf, and meet the refusal only at the end, at a
 * disabled "Bring into the room" with no cause attached.
 */
import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'Nav Gate', vault: null, timestamp: Date.now() };
const SEED = { text: 'Light enters form and returns through measure. '.repeat(30).trim(), textSource: 'Gate', origin: null };

async function openNavigator(page, { withText }) {
    await page.addInitScript(({ gate, seed, withText }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        if (withText) localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
        else localStorage.removeItem('rise_orbital_text_v1');
    }, { gate: GATE, seed: SEED, withText });
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('[data-orbit="visual"]')).toBeVisible({ timeout: 20_000 });
    await page.locator('[data-orbit="visual"]').click();
    await expect(page.locator('.vnav')).toBeVisible({ timeout: 10_000 });
}

test('with no reading, the Navigator states the dependency and offers no journey', async ({ page }) => {
    await openNavigator(page, { withText: false });

    const gate = page.locator('.vnav-gate');
    await expect(gate).toBeVisible();
    await expect(gate.locator('h3')).toHaveText(/Pick a text first/i);

    // Nothing behind it to walk into, and no dead end waiting at the end.
    expect(await page.locator('.vnav-body').count(), 'no browser behind the gate').toBe(0);
    expect(await page.locator('.vnav-node').count(), 'no tree').toBe(0);
    expect(await page.locator('[data-action="toggle"]').count(), 'no unexplained commit').toBe(0);

    // And nothing inert left in the tab order.
    const strays = await page.locator(
        '.vnav button:not([disabled]), .vnav input:not([disabled]), .vnav [tabindex]:not([tabindex="-1"])'
    ).evaluateAll(nodes => nodes.filter(n => !n.closest('.vnav-gate')).length);
    expect(strays, 'nothing tabbable behind the gate').toBe(0);
});

test('with a reading, the whole Navigator is there', async ({ page }) => {
    await openNavigator(page, { withText: true });

    expect(await page.locator('.vnav-gate').count(), 'no stale gate').toBe(0);
    await expect(page.locator('.vnav-body')).toBeVisible();
    expect(await page.locator('.vnav-node').count()).toBeGreaterThan(0);

    // The commit exists and is reachable, rather than disabled without cause.
    await page.locator('.vnav-node[data-id="visual"]').click();
    await page.locator('.vnav-node[data-id="focal"]').click();
    await expect(page.locator('[data-action="toggle"]')).toBeEnabled();
});
