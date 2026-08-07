/**
 * Journey Page Mode: authored procedural figures per segment, plus
 * museum path; unresolved engines yield is-absent, never a broken frame.
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

    // Collect figure ids from the full reading (DOM is one page at a time).
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

    // Every figure shown or absent; none left pending.
    const totals = await collectAcrossPages(page, { settleMs: 900 });
    console.log('WALK ' + JSON.stringify(totals));
    expect(totals.texts, 'the reading is still a reading').toBeGreaterThan(0);
    expect(totals.shown + totals.absent,
        'every figure resolved or absented itself').toBe(totals.figures);

    const broken = await page.evaluate(() =>
        document.querySelectorAll('.page-figure img:not([src])').length);
    expect(broken, 'no figure frame stands empty').toBe(0);

    // Running heads mid-clause must not be typeset as titles.
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
