/**
 * THE ROW IS THE CONTROL, IT TOGGLES ONCE, AND IT SURVIVES THE TRIP.
 *
 * Living Text and Glass were bare checkboxes with a word beside them. The
 * trap in fixing that is the double toggle: a label wrapping an input already
 * forwards a click, so a row handler added on top makes one press two.
 */
import { test, expect } from '@playwright/test';

const GATE = { code: 'rise2025', name: 'Controls', vault: null, timestamp: Date.now() };
const SEED = { text: 'Light enters form. '.repeat(30).trim(), textSource: 'Controls', origin: null };

async function openNavigator(page) {
    await page.addInitScript(({ gate, seed }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
    }, { gate: GATE, seed: SEED });
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await page.waitForFunction(() => {
        const state = window.__RISE_TEST__?.getRouterState();
        return state?.currentView === 'chamber' && state.transitioning === false;
    });
    await expect(page.locator('[data-orbit="visual"]')).toBeVisible({ timeout: 20_000 });
    await page.locator('[data-orbit="visual"]').click();
    await expect(page.locator('.vnav')).toBeVisible({ timeout: 10_000 });
}

const stateOf = (page, action) => page.evaluate((name) =>
    document.querySelector(`[data-action="${name}"]`).checked, action);

test('pressing the row toggles once, and pressing it back returns', async ({ page }) => {
    await openNavigator(page);

    const row = page.locator('[data-action="living-text"]').locator('xpath=ancestor::label[1]');
    await expect(row).toBeVisible();

    const before = await stateOf(page, 'living-text');
    await row.click();
    await page.waitForTimeout(250);
    const after = await stateOf(page, 'living-text');
    expect(after, 'one press, one change').toBe(!before);

    await page.locator('[data-action="living-text"]').locator('xpath=ancestor::label[1]').click();
    await page.waitForTimeout(250);
    expect(await stateOf(page, 'living-text'), 'and back again').toBe(before);
});

test('each row explains itself where a phone can read it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openNavigator(page);

    // A phone collapses these to a bar that states them, because at full size
    // they stood 277px on every pane and left the rail 151. The reason still
    // has to be ON THE ROW rather than in a tooltip — that is what this
    // guards — so it is read where the row now lives.
    await page.locator('[data-action="reader-sheet"]').click();

    for (const action of ['living-text', 'glass']) {
        const row = page.locator(`[data-action="${action}"]`).locator('xpath=ancestor::label[1]');
        const note = row.locator('.vnav-switch-note');
        await expect(note, `${action} carries its reason on the row`).toBeVisible();
        expect((await note.innerText()).trim().length).toBeGreaterThan(20);

        // And a finger can land on it.
        const box = await row.boundingBox();
        expect(box.height, `${action} is reachable by a finger`).toBeGreaterThanOrEqual(44);
    }
});

test('the setting survives leaving the panel and coming back', async ({ page }) => {
    await openNavigator(page);

    const before = await stateOf(page, 'living-text');
    await page.locator('[data-action="living-text"]').locator('xpath=ancestor::label[1]').click();
    await page.waitForTimeout(300);
    const chosen = await stateOf(page, 'living-text');
    expect(chosen).toBe(!before);

    // Out of the panel and back in: the same answer, from the same key.
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal-visual')).toBeHidden();
    await page.locator('[data-orbit="visual"]').click();
    await expect(page.locator('.vnav')).toBeVisible({ timeout: 10_000 });

    expect(await stateOf(page, 'living-text'), 'the choice round-trips').toBe(chosen);
});
