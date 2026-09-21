import { test, expect } from '@playwright/test';

/**
 * A PRINTED CODE IS THE ONE ENTRY POINT THAT CANNOT BE RECALLED.
 *
 * Everything else about a mint is checked in the unit suite — the register
 * is an allowlist, the file parses, the authority stays `proposed`. None of
 * that proves the thing it exists for: that scanning the code opens the
 * reading. This does, in a real browser, against the production build.
 */

const GATE = { code: 'rise2025', name: 'Mint', vault: null, timestamp: Date.now() };
const MINT = '/p/the-uncarved-block';

test.describe.configure({ timeout: 120_000 });

async function arrive(page, path) {
    await page.addInitScript(gate => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
    }, GATE);
    await page.goto(path);
}

test('a minted URL opens its threshold, and the threshold opens the reading', async ({ page }) => {
    await arrive(page, MINT);

    // A URL RESOLVES TO A THRESHOLD, NEVER TO A READING. Beginning from a
    // cold address bar would begin with no user activation, so the browser
    // refuses the audio and the first phrase is silent.
    const begin = page.locator('.mint-open');
    await expect(page.locator('.mint-title')).toHaveText('The Uncarved Block', { timeout: 30_000 });
    await expect(begin).toBeVisible();
    await expect(page.locator('#chamber-display'), 'nothing has started yet').toBeHidden();

    await begin.click();

    const warning = page.locator('#photosensitivity-modal');
    const display = page.locator('#chamber-display');
    await Promise.race([
        warning.waitFor({ state: 'visible', timeout: 60_000 }),
        display.waitFor({ state: 'visible', timeout: 60_000 })
    ]);
    if (await warning.isVisible()) await warning.locator('#safety-accept').click();
    await expect(display).toBeVisible({ timeout: 60_000 });

    // The reading is the one the mint names, and the address still says so
    // on arrival — a reload from a scanned code has to land back here.
    await expect(page).toHaveURL(new RegExp(`${MINT}$`, 'u'));
    await expect.poll(async () => page.evaluate(
        () => (document.querySelector('#atom-display')?.textContent || '').trim().length
    ), { timeout: 30_000, message: 'the reading never produced a word' }).toBeGreaterThan(0);
});

test('a slug nobody minted says so, and offers the way out', async ({ page }) => {
    // A printed code outlives the sequence it names. A dead end is the one
    // thing a card cannot recover from, so this is a door rather than a
    // blank screen.
    await arrive(page, '/p/never-minted-this');

    await expect(page.locator('.mint-title'))
        .toContainText('not one RISE has minted', { timeout: 30_000 });
    await expect(page.locator('[data-action="portal"]')).toBeVisible();
    await expect(page.locator('.mint-open[data-action="open"]')).toHaveCount(0);
});

test('a path that is trying to name a file is not a mint at all', async ({ page }) => {
    // The register is the allowlist and the route looks a slug up rather
    // than building a path from it, so this never reaches the threshold —
    // it falls through to the ordinary application entry.
    await arrive(page, '/p/programs/the-uncarved-block.json');

    await expect(page.locator('.mint-title')).toHaveCount(0, { timeout: 30_000 });
});
