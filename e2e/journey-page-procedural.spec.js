/**
 * THE DEMONSTRATION: a Journey's authored procedural imagery, on the page.
 *
 * This is the item that was gated. `PROCEDURAL_FIGURES` in flow.js was
 * held false with a precise reason — a 23,000-word Journey was one
 * continuous column, and a sampled engine still at every figure was more
 * than that column could afford. Pagination answered it, so the flag is
 * on and this is the proof, walked in a browser rather than argued.
 *
 * What it should show: the Milton movement illustrated by the engines
 * its author NAMED per segment — `flaming_sword`, `chariot_deity`,
 * `fall_hypercube` — rather than typesetting as text. And the Homeric
 * movement's museum works still arriving on the ordinary path, since
 * they never depended on this.
 *
 * Reverent degradation is asserted alongside, not afterwards: an engine
 * that will not resolve must yield stillness, never a broken frame.
 */
import { test, expect } from '@playwright/test';
import { collectAcrossPages, pageCount } from './page-helpers.js';

const GATE = { code: 'rise2025', name: 'Procedural', vault: null, timestamp: Date.now() };
const WAR = '[data-journey="journey-war"]';

test('a Journey pages, and its procedural movements are illustrated', async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.addInitScript((g) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(g));
    }, GATE);
    await page.goto('/');
    await page.locator('[data-nav="vault"]').first().click();
    await page.locator('[data-nav="journeys"]').first().click();
    await expect(page.locator('.journeys-title')).toBeVisible({ timeout: 20000 });

    await page.locator(`${WAR} .journey-begin`).click();
    const accept = page.locator('#safety-accept');
    await accept.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
    if (await accept.isVisible()) await accept.click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 90000 });
    await page.waitForFunction(() => window.rise?.router && !window.rise.router.transitioning);
    await page.waitForTimeout(2000);

    // Into the Page.
    await page.locator('#chamber-display').hover();
    await page.locator('#page-mode-btn').click();
    await expect(page.locator('.page-article')).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(2000);

    // A Journey is long, so projection-by-length must have cut it.
    const pages = await pageCount(page);
    expect(pages, 'a 23,000-word Journey pages rather than scrolling').toBeGreaterThan(4);

    // WHAT THE FLOW PLACED, read from the reader itself. The DOM shows
    // one page at a time; this is the whole reading.
    const placed = await page.evaluate(() => {
        const r = window.rise?.router?.views?.get('chamber-session')?.instance?.pageReader;
        const items = r?.composition?.items || [];
        const figures = items.filter(i => i.type === 'figure');
        const ids = figures.flatMap(f => f.collections || (f.collection ? [f.collection] : []));
        return {
            items: items.length,
            figures: figures.length,
            // `pageCollectionId` writes "family::engine"; a bare family
            // means the cue named no engine, which is also legitimate.
            procedural: ids.filter(id => String(id).includes('::')).length,
            engineNamed: [...new Set(ids.filter(id => /paradise-lost/.test(String(id))))]
        };
    });

    console.log('PLACED ' + JSON.stringify(placed));
    expect(placed.figures, 'the Journey places figures on the page').toBeGreaterThan(0);
    expect(placed.engineNamed.length,
        "Milton's movement is illustrated by its own engines").toBeGreaterThan(0);

    // REVERENT DEGRADATION, walked. Every page turned; a figure either
    // resolves or is absent, and `is-absent` is the sanctioned state.
    // There must be no figure stuck pending at the end of the walk.
    const totals = await collectAcrossPages(page, { settleMs: 900 });
    console.log('WALK ' + JSON.stringify(totals));
    expect(totals.texts, 'the reading is still a reading').toBeGreaterThan(0);
    expect(totals.shown + totals.absent,
        'every figure resolved or absented itself').toBe(totals.figures);

    const broken = await page.evaluate(() =>
        document.querySelectorAll('.page-figure img:not([src])').length);
    expect(broken, 'no figure frame stands empty').toBe(0);

    // R11, ON THE READING RATHER THAN ON A FIXTURE. Jünger's scan carries
    // its running heads — "GUILLEMONT 93 … 109" — dropped wherever the
    // printed page turned, which is usually mid-clause. They must not be
    // set as titles.
    const promoted = await page.evaluate(() => {
        const r = window.rise?.router?.views?.get('chamber-session')?.instance?.pageReader;
        const items = r?.composition?.items || [];
        const bad = [];
        items.forEach((item, i) => {
            if (item.type !== 'text' || item.heading !== true) return;
            // The preceding text; if it did not finish a sentence and the
            // next one continues in lower case, this is furniture.
            let before = null, after = null;
            for (let k = i - 1; k >= 0 && !before; k--) if (items[k].type === 'text') before = items[k];
            for (let k = i + 1; k < items.length && !after; k++) if (items[k].type === 'text') after = items[k];
            const finished = !before || /[.!?…][")'\]]*$/.test(String(before.text || '').trim());
            const resumes = after && /^[a-z]/.test(String(after.text || '').trim());
            if (!finished && resumes) bad.push(String(item.text || '').slice(0, 40));
        });
        return bad;
    });
    console.log('PROMOTED ' + JSON.stringify(promoted));
    expect(promoted, 'a running head was set as a title').toEqual([]);
});
