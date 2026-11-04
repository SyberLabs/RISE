import { test, expect, openHomeNav } from './fixtures.js';

/**
 * Phone viewports.
 *
 * Assert element bounds, not document.scrollWidth: body overflow:hidden
 * can clip sideways overflow while scrollWidth still matches the viewport.
 * Failures name the widest offender past the right edge.
 */

const PHONES = [
    { name: 'iPhone 12 portrait', width: 390, height: 844 },
    { name: 'small Android portrait', width: 360, height: 800 },
    { name: 'landscape', width: 844, height: 390 }
];

async function enter(page, width, height) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
}

/** How far the page can be pushed sideways, in pixels. */
const overflow = (page) => page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    // Widest past-edge element, for a useful failure message.
    widest: (() => {
        let worst = null;
        for (const el of document.querySelectorAll('body *')) {
            const right = el.getBoundingClientRect().right;
            if (right > document.documentElement.clientWidth + 1
                && (!worst || right > worst.right)) {
                worst = {
                    right: Math.round(right),
                    tag: el.tagName.toLowerCase(),
                    cls: (el.className || '').toString().slice(0, 60)
                };
            }
        }
        return worst;
    })()
}));

for (const phone of PHONES) {
    test(`the Library does not slide sideways on ${phone.name}`, async ({ page }) => {
        test.setTimeout(120000);
        await enter(page, phone.width, phone.height);
        await openHomeNav(page, 'library');
        await expect(page.locator('.library')).toBeVisible({ timeout: 30000 });
        // Wait until the registry has painted at least one card.
        await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 30000 });

        const measured = await overflow(page);
        console.log(`${phone.name} ${JSON.stringify(measured)}`);
        expect(measured.widest,
            measured.widest
                ? `${measured.widest.tag}.${measured.widest.cls} ends at `
                  + `${measured.widest.right}px on a ${measured.clientWidth}px screen`
                : '')
            .toBeNull();
        // Secondary check; element sweep is the authoritative signal.
        expect(measured.scrollWidth).toBeLessThanOrEqual(measured.clientWidth + 1);
    });
}

test('a card carrying a scan URL still fits the column', async ({ page }) => {
    // Card with a long edition statement that once included raw URLs.
    test.setTimeout(120000);
    await enter(page, 390, 844);
    await openHomeNav(page, 'library');
    await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 30000 });

    const card = await page.evaluate(() => {
        const el = document.querySelector('[data-text-id="the-brothers-karamazov"]');
        if (!el) return null;
        const box = el.getBoundingClientRect();
        const subtitle = el.querySelector('.archive-subtitle');
        return {
            width: Math.round(box.width),
            viewport: document.documentElement.clientWidth,
            subtitle: subtitle?.textContent.trim().slice(0, 140) || '',
            subtitleRight: Math.round(subtitle?.getBoundingClientRect().right ?? 0)
        };
    });
    console.log('CARD ' + JSON.stringify(card));

    expect(card, 'the card is not on the shelf').not.toBeNull();
    expect(card.width).toBeLessThanOrEqual(card.viewport);
    expect(card.subtitleRight).toBeLessThanOrEqual(card.viewport + 1);
    // Subtitle must not expose raw URLs.
    expect(card.subtitle).not.toContain('http');
    expect(card.subtitle).toContain('Standard Ebooks');
});

test('a titled work opens its contents sheet', async ({ page }) => {
    // Titled schemes use noun null; the sheet must still open and label rows.
    test.setTimeout(120000);
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });

    await enter(page, 390, 844);
    await openHomeNav(page, 'library');
    await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 30000 });

    await page.locator('[data-text-id="middlemarch"] [data-action="select-text"]').click();
    await expect(page.locator('.toc-sheet')).toBeVisible({ timeout: 30000 });

    const sheet = await page.evaluate(() => ({
        count: document.querySelector('.toc-weight-count')?.textContent.trim(),
        noun: document.querySelector('.toc-weight-noun')?.textContent.trim(),
        entries: document.querySelectorAll('.toc-entry').length,
        first: document.querySelector('.toc-entry')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)
    }));
    console.log('TOC ' + JSON.stringify(sheet));

    expect(errors.filter(e => /toLowerCase|Could not open/.test(e))).toEqual([]);
    expect(sheet.entries).toBeGreaterThan(0);
    // Generic "entries" when the work never named a division unit.
    expect(sheet.noun).toBe('entries');
    expect(sheet.first).toContain('Chapter I');
});

test('Try RISE keeps its lateral rail on a phone', async ({ page }) => {
    test.setTimeout(120000);
    await enter(page, 390, 844);
    await page.goto('/try-rise');
    await expect(page).toHaveURL(/\/try-rise$/u);
    await expect(page.locator('#keystone-metamorphoses')).toBeVisible({ timeout: 30000 });

    // The carousel survives the phone: the centre holds, the neighbours stay
    // on the rail beside it, and nothing pushes the document sideways.
    await expect(page.locator('#keystone-metamorphoses')).toHaveAttribute('data-pos', '0');
    await expect(page.locator('#keystone-meditations')).toHaveAttribute('data-pos', '-1');
    await expect(page.locator('#keystone-tintern')).toHaveAttribute('data-pos', '1');

    // The rail is where the lateral geometry is allowed to run past the
    // edge, and it clips. Neither the document nor the scrolling view may be
    // pushed sideways by it. (Element bounds are the wrong instrument here:
    // a clipped orb still reports its uncropped rectangle.)
    const sideways = await page.evaluate(() => {
        const view = document.querySelector('.keystones');
        return {
            docScroll: document.documentElement.scrollWidth,
            docClient: document.documentElement.clientWidth,
            viewScroll: view.scrollWidth,
            viewClient: view.clientWidth,
            railClip: getComputedStyle(document.querySelector('.keystone-rail')).overflowX
        };
    });
    expect(sideways.docScroll).toBeLessThanOrEqual(sideways.docClient + 1);
    expect(sideways.viewScroll).toBeLessThanOrEqual(sideways.viewClient + 1);
    expect(['clip', 'hidden']).toContain(sideways.railClip);

    // The centre is centred, and the one action sits under it, on screen.
    const centre = await page.evaluate(() => {
        const view = document.querySelector('.keystones');
        const figure = document.querySelector('#keystone-metamorphoses .keystone-figure');
        const box = figure.getBoundingClientRect();
        const cta = document.querySelector('[data-enter]').getBoundingClientRect();
        return {
            offset: Math.abs((box.left + box.right) / 2 - window.innerWidth / 2),
            diameter: Math.round(box.width),
            side: Math.round(
                document.querySelector('#keystone-tintern .keystone-figure').getBoundingClientRect().width
            ),
            ctaBottom: Math.round(cta.bottom),
            ctaWidth: Math.round(cta.width),
            clientHeight: view.clientHeight,
            viewportHeight: window.innerHeight
        };
    });

    expect(centre.offset).toBeLessThanOrEqual(1);
    expect(centre.diameter).toBeGreaterThan(centre.side * 1.4);
    expect(centre.ctaWidth).toBeGreaterThanOrEqual(44);
    expect(centre.ctaBottom).toBeLessThanOrEqual(centre.viewportHeight);
    expect(centre.clientHeight).toBe(centre.viewportHeight);

    // A tap on a neighbour selects it rather than entering it.
    await page.locator('#keystone-tintern').click();
    await expect(page.locator('#keystone-tintern')).toHaveAttribute('data-pos', '0');
    await expect(page).toHaveURL(/\/try-rise$/u);
});

test('the visual navigator holds every visual and all of Text, on a phone and on a desk', async ({ page }) => {
    // A phone gets the stage: one rail holds every visual, and Letters holds
    // Face, Size and Ink. A desk gets the directory's two roots and columns.
    test.setTimeout(240000);
    await enter(page, 390, 844);
    await openHomeNav(page, 'library');
    await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 40000 });
    await page.locator('[data-text-id="literary-meditations"] [data-action="select-text"]').click();
    await page.waitForTimeout(2000);
    const toc = page.locator('.toc-entry').first();
    if (await toc.isVisible().catch(() => false)) { await toc.click(); }
    await expect(page.locator('.orbital-stage')).toBeVisible({ timeout: 30000 });
    { const look = page.locator('#modal-look'); if (await look.isHidden()) await page.locator('[data-orbit="look"]').click(); }
    await page.locator('.orbit-visual').click();
    await expect(page.locator('.vstage')).toBeVisible({ timeout: 15000 });

    const rail = await page.evaluate(() => [...document.querySelectorAll('.vstage-tile')].map(tile => tile.dataset.world));
    expect(rail).toEqual(expect.arrayContaining([
        'off', 'focal', 'attractor', 'klee', 'harmonograph', 'fractal', 'turrell', 'by-manner', 'personal'
    ]));
    await page.locator('[data-stage="text"]').click();
    for (const section of ['face', 'size', 'ink']) {
        await expect(page.locator(`.vstage-sheet [data-section="${section}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-font-size="fit"]')).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('.vnav')).toBeVisible();
    const roots = await page.evaluate(() => {
        const first = document.querySelector('.vnav .vnav-col');
        return {
            groups: [...first.querySelectorAll('.vnav-group')].map(group => group.textContent.trim()),
            nodes: [...first.querySelectorAll('.vnav-node')].map(node => node.dataset.id)
        };
    });
    expect(roots.groups).toEqual(['Field', 'Text']);
    expect(roots.nodes).toEqual(['off', 'visual', 'face', 'size', 'ink']);
    await page.locator('.vnav-node[data-id="visual"]').click();
    await page.locator('.vnav-node[data-id="gallery"]').click();
    await page.locator('.vnav-node[data-id="gallery-sourced"]').click();
    await page.locator('.vnav-node[data-id="by-manner"]').click();
    const desktop = await page.evaluate(() => {
        const nav = document.querySelector('.vnav');
        const modal = document.querySelector('#modal-visual .modal-content').getBoundingClientRect();
        const entry = nav.querySelector('.vnav-entry').getBoundingClientRect();
        return {
            visibleColumns: [...nav.querySelectorAll('.vnav-col')]
                .filter(column => getComputedStyle(column).display !== 'none').length,
            sideways: Math.max(0, nav.scrollWidth - nav.clientWidth),
            entryWidth: Math.round(entry.width),
            entryRight: Math.round(entry.right),
            modalRight: Math.round(modal.right)
        };
    });
    expect(desktop.visibleColumns).toBe(4);
    expect(desktop.sideways).toBe(0);
    expect(desktop.entryWidth).toBeGreaterThan(250);
    expect(desktop.entryRight).toBeLessThanOrEqual(desktop.modalRight);
});

/**
 * Density: chrome must not dominate the first screen; content fits
 * under the fold. Thresholds, not pixel-perfect locks.
 */

test('a shelf shows books on the first screen', async ({ page }) => {
    test.setTimeout(120000);
    await enter(page, 390, 844);
    await openHomeNav(page, 'library');
    await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 30000 });

    const shelf = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.archive-card')];
        return {
            viewport: window.innerHeight,
            firstCardTop: Math.round(cards[0].getBoundingClientRect().top),
            cardHeight: Math.round(cards[0].getBoundingClientRect().height),
            chromeShare: cards[0].getBoundingClientRect().top / window.innerHeight
        };
    });
    console.log('SHELF ' + JSON.stringify(shelf));

    expect(shelf.chromeShare).toBeLessThan(0.62);
    expect(shelf.firstCardTop + shelf.cardHeight).toBeLessThanOrEqual(shelf.viewport);
});

test('the Vault opens on its sequences rather than on an explanation', async ({ page }) => {
    test.setTimeout(120000);
    await enter(page, 390, 844);
    await openHomeNav(page, 'vault');
    await expect(page.locator('.sequence-card').first()).toBeVisible({ timeout: 30000 });

    const vault = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.sequence-card')];
        return {
            total: cards.length,
            visible: cards.filter(c => c.getBoundingClientRect().bottom <= window.innerHeight).length
        };
    });
    console.log('VAULT ' + JSON.stringify(vault));

    expect(vault.visible).toBeGreaterThanOrEqual(1);
});

test('the configuration panels are not several screens of picture tiles', async ({ page }) => {
    // Phone panels: compact option rows; body under two viewports.
    test.setTimeout(180000);
    await enter(page, 390, 844);
    await openHomeNav(page, 'library');
    await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 30000 });
    await page.locator('[data-text-id="the-iliad"] [data-action="select-text"]').click();
    const toc = page.locator('.toc-entry').first();
    await expect(toc).toBeVisible({ timeout: 40000 });
    await toc.click();
    await expect(page.locator('.orbital-stage')).toBeVisible({ timeout: 30000 });

    // Rhythm & pace and Customize look open from the first screen; Sound and
    // Visuals open from inside Customize look, which stays open beneath them.
    const panels = [
        ['.orbit-temporal', '#modal-temporal'],
        ['.orbit-look', '#modal-look'],
        ['.orbit-audio', '#modal-audio'],
        ['.orbit-visual', '#modal-visual']
    ];

    for (const [node, modal] of panels) {
        if (node === '.orbit-audio' || node === '.orbit-visual') {
            { const look = page.locator('#modal-look'); if (await look.isHidden()) await page.locator('[data-orbit="look"]').click(); }
        }
        await page.locator(node).click();
        await expect(page.locator(modal)).toBeVisible({ timeout: 15000 });
        const m = await page.evaluate((sel) => {
            const body = document.querySelector(`${sel} .modal-body`);
            const opts = [...document.querySelectorAll(
                `${sel} .audio-preset-option, ${sel} .curve-option`
            )].map(o => Math.round(o.getBoundingClientRect().height));
            return {
                id: sel,
                body: body ? body.scrollHeight : 0,
                viewport: window.innerHeight,
                tallestOption: opts.length ? Math.max(...opts) : null
            };
        }, modal);
        console.log('PANEL ' + JSON.stringify(m));

        expect(m.body, `${m.id} body`).toBeLessThan(m.viewport * 2);
        if (m.tallestOption !== null) {
            expect(m.tallestOption, `${m.id} tallest option`).toBeLessThanOrEqual(56);
        }
        // Close via the panel control; wait until hidden before the next orb.
        // The visual panel is a stage on a phone, and closes from its own ✕.
        const stageClose = page.locator(`${modal} .vstage [data-stage="close"]`);
        if (await stageClose.isVisible()) await stageClose.click();
        else await page.locator(`${modal} [data-close]`).click();
        await expect(page.locator(modal)).toBeHidden({ timeout: 15000 });
    }
});

test('Begin reading can actually be pressed on a phone', async ({ page }) => {
    // Begin must receive taps (not be covered by .orbital-stage).
    test.setTimeout(180000);
    await enter(page, 390, 844);
    await openHomeNav(page, 'library');
    await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 30000 });
    await page.locator('[data-text-id="the-iliad"] [data-action="select-text"]').click();
    await page.waitForTimeout(1500);
    const toc = page.locator('.toc-entry').first();
    if (await toc.isVisible().catch(() => false)) { await toc.click(); }
    await expect(page.locator('.orbital-stage')).toBeVisible({ timeout: 30000 });

    const reach = await page.evaluate(() => {
        const check = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return { found: false };
            const r = el.getBoundingClientRect();
            const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return {
                found: true,
                disabled: !!el.disabled,
                reachable: !!(top && (top === el || el.contains(top))),
                intercepted: top ? `${top.tagName.toLowerCase()}.${top.className.toString().slice(0, 30)}` : 'null'
            };
        };
        return { begin: check('#begin-btn') };
    });
    console.log('REACH ' + JSON.stringify(reach));

    expect(reach.begin.found).toBe(true);
    expect(reach.begin.disabled).toBe(false);
    expect(reach.begin.reachable,
        `Begin reading is covered by ${reach.begin.intercepted}`).toBe(true);

    await page.locator('#begin-btn').click({ timeout: 10000 });
    const accept = page.locator('#safety-accept');
    await accept.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    if (await accept.isVisible()) await accept.click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 90000 });
});

test('Page Mode keeps the whole measure on the screen', async ({ page }) => {
    // Page measure and control bar must stay inside the phone viewport.
    test.setTimeout(300000);
    await enter(page, 390, 844);
    await openHomeNav(page, 'library');
    await expect(page.locator('[data-text-id="middlemarch"]')).toBeVisible({ timeout: 30000 });
    await page.locator('[data-text-id="middlemarch"] [data-action="select-text"]').click();
    await expect(page.locator('.toc-entry').first()).toBeVisible({ timeout: 30000 });
    await page.locator('.toc-entry').first().click();
    await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 30000 });
    await page.locator('#begin-btn').click();
    const accept = page.locator('#safety-accept');
    await accept.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
    if (await accept.isVisible()) await accept.click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 90000 });
    await page.waitForTimeout(2500);

    await page.mouse.move(195, 700);
    await page.waitForTimeout(400);

    // Baseline bottom gap before Page Mode (must not shrink afterward).
    const streamBottom = await page.evaluate(() =>
        Math.round(window.innerHeight - document.querySelector('.chamber-controls').getBoundingClientRect().bottom));

    await page.locator('#page-mode-btn').click({ timeout: 20000 });
    await expect(page.locator('.page-reader')).toBeVisible({ timeout: 60000 });
    await page.waitForTimeout(2000);

    const m = await page.evaluate(() => {
        const art = document.querySelector('.page-article').getBoundingClientRect();
        const clipped = [...document.querySelectorAll('.page-article *')]
            .filter(n => {
                const r = n.getBoundingClientRect();
                return r.width > 0 && r.height > 0 && r.left < -1;
            })
            .slice(0, 4)
            .map(n => ({
                cls: n.className.toString().slice(0, 22),
                left: Math.round(n.getBoundingClientRect().left),
                txt: (n.textContent || '').trim().slice(0, 30)
            }));

        const bar = document.querySelector('.chamber-controls').getBoundingClientRect();
        return {
            vw: window.innerWidth,
            article: { l: Math.round(art.left), r: Math.round(art.right) },
            clipped,
            bar: { l: Math.round(bar.left), r: Math.round(bar.right), w: Math.round(bar.width) },
            barGap: Math.round(window.innerHeight - bar.bottom)
        };
    });
    console.log('PAGE ' + JSON.stringify(m));

    expect(m.clipped,
        `these begin off the left edge of the screen: ${JSON.stringify(m.clipped)}`)
        .toEqual([]);
    expect(m.article.l).toBeGreaterThanOrEqual(0);
    expect(m.article.r).toBeLessThanOrEqual(m.vw);

    expect(m.bar.w).toBeLessThan(m.vw * 0.85);
    expect(Math.abs((m.bar.l + m.bar.r) / 2 - m.vw / 2)).toBeLessThanOrEqual(2);
    expect(m.barGap,
        `the bar sits ${m.barGap}px from the bottom in Page Mode but ${streamBottom}px in the Stream`)
        .toBeGreaterThanOrEqual(streamBottom);
    expect(streamBottom,
        `the Stream bar has only ${streamBottom}px of air above the screen edge`)
        .toBeGreaterThanOrEqual(20);
});

/**
 * The orbs rendered as square tiles on an iPhone and as circles everywhere
 * else, because iOS Safari does not apply an ancestor's rounded overflow
 * clip to a descendant it has promoted to its own compositing layer — and
 * every layer inside a face carries a filter, a blend mode and a running
 * transform animation.
 *
 * The aperture is cut by a mask instead, which the compositor honours. No
 * engine Playwright can drive reproduces the bug, so this cannot assert the
 * shape; it asserts the mask is on every face, which is the thing that would
 * be removed for looking redundant beside the `overflow: hidden` it stands
 * in for.
 */
test('every orb carries the mask that cuts its aperture on iOS', async ({ page }) => {
    await enter(page, 390, 844);
    await page.goto('/try-rise');
    await expect(page.locator('.keystone-orb.is-selected')).toBeVisible({ timeout: 15000 });

    const faces = await page.locator('.keystone-face').evaluateAll(nodes => nodes.map(el => {
        const style = getComputedStyle(el);
        return style.webkitMaskImage || style.maskImage;
    }));

    expect(faces.length).toBe(3);
    for (const mask of faces) {
        expect(mask, 'a face is clipped by overflow alone, which iOS ignores')
            .toContain('radial-gradient');
    }
});
