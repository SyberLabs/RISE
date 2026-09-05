/**
 * Page Mode geometry: figures must not float beside headings.
 * Walks real pages (Vitruvius-style inline structure).
 */
import { test, expect } from '@playwright/test';
import { pageCount } from './page-helpers.js';

const GATE = { code: 'rise2025', name: 'Typography', vault: null, timestamp: Date.now() };

/** A reading long enough to paginate, carrying inline headings. */
const SEED = {
    text: [
        'CHAPTER I',
        'THE EDUCATION OF THE ARCHITECT',
        ...Array.from({ length: 14 }, (_, i) =>
            `${i + 1}. The architect should be equipped with knowledge of many branches of study and varied kinds of learning, for it is by his judgement that all work done by the other arts is put to test. ${'This knowledge is the child of practice and theory. '.repeat(3)}`),
        'CHAPTER II',
        'THE FUNDAMENTAL PRINCIPLES OF ARCHITECTURE',
        ...Array.from({ length: 14 }, (_, i) =>
            `${i + 1}. Architecture depends on Order, Arrangement, Eurythmy, Symmetry, Propriety and Economy. ${'Order gives due measure to the members of a work considered separately. '.repeat(3)}`)
    ].join('\n\n'),
    textSource: 'Vitruvius, The Ten Books on Architecture',
    origin: null
};

const PREFS = {
    visualInterlocution: {
        visualMode: 'interlocution',
        interlocution: {
            sourceFamily: 'procedural', procedural: ['klee'],
            sourced: [], presentation: 'behind-stream'
        }
    }
};

async function openThePage(page) {
    await page.addInitScript((g) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(g.gate));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify(g.seed));
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify(g.prefs));
    }, { gate: GATE, seed: SEED, prefs: PREFS });
    await page.goto('/');
    await expect(page.locator('[data-nav="library"]').first()).toBeVisible({ timeout: 15000 });
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 15000 });
    await page.locator('#begin-btn').click();
    const warn = page.locator('#photosensitivity-modal');
    await expect(warn).toBeVisible({ timeout: 15000 });
    await warn.locator('#safety-accept').click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 20000 });
    await page.waitForFunction(() => window.__RISE_TEST__ && !window.__RISE_TEST__.getRouterState().transitioning);
    await page.waitForTimeout(1200);
    // The bar hides until the reader reaches for it; without this the
    // field intercepts the click.
    await page.locator('#chamber-display').hover();
    await page.locator('#page-mode-btn').click();
    await expect(page.locator('.page-article')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1200);
}

/**
 * A figure wraps a heading when they share vertical space but sit apart
 * horizontally (float beside title). Centred plate under a title is fine.
 */
async function wrappedHeadings(page) {
    return page.evaluate(() => {
        const boxes = (sel) => [...document.querySelectorAll(sel)]
            .map(el => ({ el, r: el.getBoundingClientRect() }))
            .filter(b => b.r.width > 0 && b.r.height > 0);
        const heads = boxes('.page-text.is-heading');
        const figs = boxes('.page-figure');
        const offences = [];
        for (const h of heads) {
            for (const f of figs) {
                const sharesRows = h.r.top < f.r.bottom - 2 && f.r.top < h.r.bottom - 2;
                const apart = h.r.right < f.r.left + 2 || f.r.right < h.r.left + 2;
                if (sharesRows && apart) {
                    offences.push(h.el.textContent.trim().slice(0, 48));
                }
            }
        }
        return offences;
    });
}

/**
 * Enter the paged projection.
 *
 * The public Page opens as one elongated composition, so a test about how
 * PAGES are typeset has to ask for pages rather than assume them. The control
 * reads 'Paginate' on open and 'Elongate' once pages are cut.
 */
async function paginate(page) {
    await page.locator('#chamber-display').hover();
    const btn = page.locator('#page-elongate');
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();
    await expect.poll(() => pageCount(page), { timeout: 10000 }).toBeGreaterThan(1);
    await page.waitForTimeout(600);
}

test('no figure stands beside a heading, on any page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openThePage(page);
    await paginate(page);

    const total = await pageCount(page);
    expect(total, 'the fixture is long enough to paginate').toBeGreaterThan(1);

    const found = [];
    for (let i = 0; i < total; i++) {
        if (i > 0) {
            await page.evaluate((index) => {
                window.__RISE_TEST__?.getView('chamber-session')?.pageReader?.goToPage(index);
            }, i);
            await page.waitForTimeout(900);
        }
        for (const offence of await wrappedHeadings(page)) {
            found.push(`page ${i + 1}: ${offence}`);
        }
    }
    console.log('HEADINGS ' + JSON.stringify({ pages: total, offences: found }));
    expect(found, found.join(' | ')).toEqual([]);
});

test('an inline CHAPTER heading opens its page rather than closing the last one', async ({ page }) => {
    // CHAPTER II must open a page, not close the previous one.
    await page.setViewportSize({ width: 1280, height: 900 });
    await openThePage(page);
    await paginate(page);

    const where = await page.evaluate(() => {
        const r = window.__RISE_TEST__?.getView('chamber-session')?.pageReader;
        const pages = r?.pages || [];
        const hit = [];
        pages.forEach((p, i) => {
            p.items.forEach((item, at) => {
                if (item.type === 'text' && /^CHAPTER II\b/.test(String(item.text || '').trim())) {
                    hit.push({ page: i, at, of: p.items.length });
                }
            });
        });
        return hit;
    });

    console.log('CHAPTER ' + JSON.stringify(where));
    expect(where.length, 'the fixture carries an inline CHAPTER II').toBeGreaterThan(0);
    for (const h of where) {
        expect(h.at, `CHAPTER II sits at item ${h.at} of page ${h.page}`).toBe(0);
    }
});

test('the projection control turns both ways — neither is a one-way door', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openThePage(page);

    const btn = page.locator('#page-elongate');
    await page.locator('#chamber-display').hover();
    await expect(btn).toBeVisible({ timeout: 10000 });
    // The Page opens elongated, so the control offers the other projection.
    await expect(btn.locator('.control-label')).toHaveText('Paginate');

    await btn.click();
    await page.waitForTimeout(700);
    await page.locator('#chamber-display').hover();
    // Pagination must leave a way back to one column.
    await expect(btn, 'the way back to one column vanished').toBeVisible();
    await expect(btn.locator('.control-label')).toHaveText('Elongate');

    await btn.click();
    await page.waitForTimeout(700);
    await page.locator('#chamber-display').hover();
    // And back to where it opened: one column, offering pages again.
    await expect(btn.locator('.control-label')).toHaveText('Paginate');
    expect(await pageCount(page)).toBe(1);
});
