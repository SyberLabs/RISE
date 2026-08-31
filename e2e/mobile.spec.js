import { test, expect } from '@playwright/test';

/**
 * Phone viewports.
 *
 * Assert element bounds, not document.scrollWidth: body overflow:hidden
 * can clip sideways overflow while scrollWidth still matches the viewport.
 * Failures name the widest offender past the right edge.
 */
const GATE = { code: 'rise2025', name: 'M', vault: null, timestamp: Date.now() };

const PHONES = [
    { name: 'iPhone 12 portrait', width: 390, height: 844 },
    { name: 'small Android portrait', width: 360, height: 800 },
    { name: 'landscape', width: 844, height: 390 }
];

// These contracts require the authored Demonstration Journey, which is
// intentionally absent until its quotation anchors are re-authored against
// certified editions. General mobile and Keystone release coverage remains
// live; these return with Journey admission.
const withdrawnJourneyTest = test.skip;

async function enter(page, width, height) {
    await page.setViewportSize({ width, height });
    await page.addInitScript((g) => localStorage.setItem('rise-beta-session', JSON.stringify(g)), GATE);
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
        await page.locator('[data-nav="library"]').first().click();
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
    await page.locator('[data-nav="library"]').first().click();
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
    await page.locator('[data-nav="library"]').first().click();
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

withdrawnJourneyTest('the Chamber reads as a band across the picture', async ({ page }) => {
    // Phone: full-bleed reading band across the middle; imagery fills the rest.
    test.setTimeout(300000);
    await enter(page, 390, 844);
    await page.locator('[data-nav="vault"]').first().click();
    await page.locator('[data-nav="journeys"]').first().click();
    const DEMO = '[data-journey="demo-procedural"]';
    await expect(page.locator(`${DEMO} .journey-credits`)).toBeVisible({ timeout: 120000 });
    await page.locator(`${DEMO} .journey-begin`).click();
    const accept = page.locator('#safety-accept');
    await accept.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
    if (await accept.isVisible()) await accept.click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 90000 });
    await page.waitForTimeout(12000);

    const band = await page.evaluate(() => {
        const el = document.querySelector('.atom-display');
        const box = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
            text: el.textContent.trim().slice(0, 48),
            font: parseFloat(cs.fontSize),
            radius: cs.borderTopLeftRadius,
            width: Math.round(box.width),
            heightPct: (100 * box.height) / window.innerHeight,
            viewport: window.innerWidth,
            right: Math.round(box.right)
        };
    });
    console.log('BAND ' + JSON.stringify(band));

    // Full bleed, thin, viewport-sized type, no sideways clip.
    expect(band.width).toBe(band.viewport);
    expect(band.radius).toBe('0px');
    expect(band.heightPct).toBeLessThan(30);
    expect(band.font).toBeGreaterThan(16);
    expect(band.font).toBeLessThan(30);
    expect(band.right).toBeLessThanOrEqual(band.viewport);
});

test('the Portal is one viewport, and does not scroll', async ({ page }) => {
    // Portal must fit one viewport: no content hanging below the fold.
    test.setTimeout(120000);
    await enter(page, 390, 844);
    await expect(page.locator('[data-nav="chamber"]').first()).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(2500);

    const fit = await page.evaluate(() => ({
        docHeight: document.documentElement.scrollHeight,
        viewport: window.innerHeight,
        below: [...document.querySelectorAll('body *')]
            .filter(n => {
                const r = n.getBoundingClientRect();
                return r.height > 20 && r.bottom > window.innerHeight + 2;
            })
            .map(n => n.className.toString().slice(0, 34)).slice(0, 3)
    }));
    console.log('FIT ' + JSON.stringify(fit));

    expect(fit.below, `hanging off the bottom: ${fit.below.join(', ')}`).toEqual([]);
    expect(fit.docHeight).toBeLessThanOrEqual(fit.viewport + 1);

    // Secondary door ink quieter than primary nav; tap targets stay ≥40px.
});

test('Try RISE owns its mobile scroll instead of clipping stacked readings', async ({ page }) => {
    test.setTimeout(120000);
    await enter(page, 390, 844);
    await page.locator('[data-nav="keystones"]').first().click();
    await expect(page).toHaveURL(/\/try-rise$/u);
    await expect(page.locator('#keystone-tintern')).toBeVisible({ timeout: 30000 });

    const scroll = await page.evaluate(() => {
        const view = document.querySelector('.keystones');
        const before = view.scrollTop;
        view.scrollTop = view.scrollHeight;
        const lastCard = document.querySelector('#keystone-tintern').getBoundingClientRect();
        return {
            before,
            after: view.scrollTop,
            clientHeight: view.clientHeight,
            scrollHeight: view.scrollHeight,
            viewportHeight: window.innerHeight,
            overflowY: getComputedStyle(view).overflowY,
            lastCardBottom: Math.round(lastCard.bottom)
        };
    });

    expect(scroll.clientHeight).toBe(scroll.viewportHeight);
    expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight);
    expect(scroll.overflowY).toBe('auto');
    expect(scroll.after).toBeGreaterThan(scroll.before);
    expect(scroll.lastCardBottom).toBeLessThanOrEqual(scroll.viewportHeight);
});

test('the visual navigator exposes complete Field and Text roots without a mobile dead lane', async ({ page }) => {
    // The retired five-mode strip is now an explicit two-root hierarchy.
    // Every root must be populated, stay inside the viewport, and lead to its entry.
    test.setTimeout(240000);
    await enter(page, 390, 844);
    await page.locator('[data-nav="library"]').first().click();
    await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 40000 });
    await page.locator('[data-text-id="literary-meditations"] [data-action="select-text"]').click();
    await page.waitForTimeout(2000);
    const toc = page.locator('.toc-entry').first();
    if (await toc.isVisible().catch(() => false)) { await toc.click(); }
    // Wait for stage, then panel visibility (conditions, not sleeps).
    await expect(page.locator('.orbital-stage')).toBeVisible({ timeout: 30000 });
    await page.locator('.orbit-visual').click();
    await expect(page.locator('#modal-visual')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.vnav')).toBeVisible({ timeout: 15000 });

    const roots = await page.evaluate(() => {
        const el = document.querySelector('.vnav');
        const first = el?.querySelector('.vnav-col');
        if (!el || !first) return null;
        const groups = [...first.querySelectorAll('.vnav-group')];
        return {
            groups: groups.map(group => group.textContent.trim()),
            nodes: [...first.querySelectorAll('.vnav-node')].map(node => node.dataset.id),
            sideways: Math.max(0, el.scrollWidth - el.clientWidth),
            emptyGroups: groups.filter(group => {
                let sibling = group.nextElementSibling;
                while (sibling && !sibling.classList.contains('vnav-group')) {
                    if (sibling.classList.contains('vnav-node')) return false;
                    sibling = sibling.nextElementSibling;
                }
                return true;
            }).map(group => group.textContent.trim())
        };
    });
    console.log('NAVIGATOR ' + JSON.stringify(roots));

    expect(roots, 'no visual navigator found').not.toBeNull();
    expect(roots.groups).toEqual(['Field', 'Text']);
    expect(roots.nodes).toEqual(['off', 'visual', 'face', 'size', 'ink']);
    expect(roots.emptyGroups).toEqual([]);
    expect(roots.sideways).toBe(0);

    await page.locator('.vnav-node[data-id="size"]').click();
    await expect(page.locator('[data-font-size="fit"]')).toBeVisible();

    // One pane at a time: the open pane holds the screen, so reaching another
    // root door goes back to the rail rather than sideways past it.
    await page.locator('[data-action="navigator-back"]').click();
    await page.locator('.vnav-node[data-id="visual"]').click();
    await page.locator('.vnav-node[data-id="gallery"]').click();
    await page.locator('.vnav-node[data-id="gallery-sourced"]').click();
    await page.locator('.vnav-node[data-id="by-manner"]').click();
    await expect(page.locator('.vnav-entry h3')).toHaveText('By Manner');

    const phone = await page.evaluate(() => {
        const nav = document.querySelector('.vnav');
        const entry = nav.querySelector('.vnav-entry').getBoundingClientRect();
        return {
            visibleColumns: [...nav.querySelectorAll('.vnav-col')]
                .filter(column => getComputedStyle(column).display !== 'none').length,
            sideways: Math.max(0, nav.scrollWidth - nav.clientWidth),
            entryWidth: Math.round(entry.width),
            entryRight: Math.round(entry.right),
            viewport: window.innerWidth
        };
    });
    // With a leaf open the entry IS the pane: no rail stacked above it, which
    // is what left the commit and the reader switches below the fold. The
    // "one column" this used to assert is the state a reader is in BEFORE
    // opening something, and it is asserted at the rail below.
    expect(phone.visibleColumns).toBe(0);
    expect(phone.sideways).toBe(0);
    expect(phone.entryWidth).toBeGreaterThan(250);
    expect(phone.entryRight).toBeLessThanOrEqual(phone.viewport);

    await expect(page.locator('[data-action="navigator-back"]')).toBeVisible();
    // One press, one level: the open leaf is a step of the drill-down now, so
    // Back returns to the list By Manner was chosen FROM. It used to clear the
    // focus and pop the path together, which skipped a level.
    await page.locator('[data-action="navigator-back"]').click();
    await expect(page.locator('.vnav-node[data-id="by-manner"]')).toBeVisible();
    // Back at a list, exactly one column stands — the deepest one, alone.
    expect(await page.evaluate(() => [...document.querySelectorAll('.vnav-col')]
        .filter(column => getComputedStyle(column).display !== 'none').length)).toBe(1);
    await page.locator('[data-action="navigator-back"]').click();
    await expect(page.locator('.vnav-node[data-id="gallery-sourced"]')).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 800 });
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

test('the orbit is centred in the phone rather than cropped by it', async ({ page }) => {
    // Orbital stage centred and symmetric in the phone viewport.
    test.setTimeout(180000);
    await enter(page, 390, 844);
    await page.locator('[data-nav="library"]').first().click();
    await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 40000 });
    await page.locator('[data-text-id="literary-meditations"] [data-action="select-text"]').click();
    await page.waitForTimeout(2000);
    const toc = page.locator('.toc-entry').first();
    if (await toc.isVisible().catch(() => false)) { await toc.click(); }
    await expect(page.locator('.orbital-stage')).toBeVisible({ timeout: 30000 });

    const ring = await page.evaluate(() => {
        const stage = document.querySelector('.orbital-stage').getBoundingClientRect();
        const nodes = [...document.querySelectorAll('.orbit-node')]
            .map(n => n.getBoundingClientRect());
        return {
            stageMid: Math.round(stage.left + stage.width / 2),
            screenMid: Math.round(window.innerWidth / 2),
            leftGap: Math.round(Math.min(...nodes.map(n => n.left))),
            rightGap: Math.round(window.innerWidth - Math.max(...nodes.map(n => n.right)))
        };
    });
    console.log('RING ' + JSON.stringify(ring));

    expect(Math.abs(ring.stageMid - ring.screenMid)).toBeLessThanOrEqual(2);
    expect(ring.leftGap).toBeGreaterThan(8);
    expect(Math.abs(ring.leftGap - ring.rightGap)).toBeLessThanOrEqual(3);
});

withdrawnJourneyTest('the Chamber control bar stays on the screen', async ({ page }) => {
    // Control bar and every child must stay within the viewport.
    test.setTimeout(300000);
    await enter(page, 390, 844);
    await page.locator('[data-nav="vault"]').first().click();
    await page.locator('[data-nav="journeys"]').first().click();
    const DEMO = '[data-journey="demo-procedural"]';
    await expect(page.locator(`${DEMO} .journey-credits`)).toBeVisible({ timeout: 120000 });
    await page.locator(`${DEMO} .journey-begin`).click();
    const accept = page.locator('#safety-accept');
    await accept.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
    if (await accept.isVisible()) await accept.click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 90000 });
    await page.waitForTimeout(5000);
    await page.mouse.move(195, 700);
    await page.waitForTimeout(600);

    const bar = await page.evaluate(() => {
        const el = document.querySelector('.chamber-controls');
        const r = el.getBoundingClientRect();
        const kids = [...el.children].map(c => c.getBoundingClientRect());
        return {
            left: Math.round(r.left), right: Math.round(r.right),
            viewport: window.innerWidth,
            worstLeft: Math.round(Math.min(...kids.map(k => k.left))),
            worstRight: Math.round(Math.max(...kids.map(k => k.right))),
            controls: kids.length
        };
    });
    console.log('BAR ' + JSON.stringify(bar));

    expect(bar.controls).toBeGreaterThan(3);
    expect(bar.worstLeft).toBeGreaterThanOrEqual(0);
    expect(bar.worstRight).toBeLessThanOrEqual(bar.viewport);
});

/**
 * Density: chrome must not dominate the first screen; content fits
 * under the fold. Thresholds, not pixel-perfect locks.
 */

test('a shelf shows books on the first screen', async ({ page }) => {
    test.setTimeout(120000);
    await enter(page, 390, 844);
    await page.locator('[data-nav="library"]').first().click();
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
    await page.locator('[data-nav="vault"]').first().click();
    await expect(page.locator('.sequence-card').first()).toBeVisible({ timeout: 30000 });

    const vault = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.sequence-card')];
        return {
            total: cards.length,
            visible: cards.filter(c => c.getBoundingClientRect().bottom <= window.innerHeight).length,
            introShown: (() => {
                const el = document.querySelector('.vault-intro');
                return el ? getComputedStyle(el).display !== 'none' : false;
            })()
        };
    });
    console.log('VAULT ' + JSON.stringify(vault));

    expect(vault.introShown).toBe(false);
    expect(vault.visible).toBeGreaterThanOrEqual(1);
});

test('the configuration panels are not several screens of picture tiles', async ({ page }) => {
    // Phone panels: compact option rows; body under two viewports.
    test.setTimeout(180000);
    await enter(page, 390, 844);
    await page.locator('[data-nav="library"]').first().click();
    await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 30000 });
    await page.locator('[data-text-id="the-iliad"] [data-action="select-text"]').click();
    const toc = page.locator('.toc-entry').first();
    await expect(toc).toBeVisible({ timeout: 40000 });
    await toc.click();
    await expect(page.locator('.orbital-stage')).toBeVisible({ timeout: 30000 });

    const panels = [
        ['.orbit-temporal', '#modal-temporal'],
        ['.orbit-audio', '#modal-audio'],
        ['.orbit-visual', '#modal-visual']
    ];

    for (const [node, modal] of panels) {
        await page.locator(node).click();
        await expect(page.locator(modal)).toBeVisible({ timeout: 15000 });
        const m = await page.evaluate((sel) => {
            const body = document.querySelector(`${sel} .modal-body`);
            const opts = [...document.querySelectorAll(
                `${sel} .mode-option, ${sel} .audio-preset-option, ${sel} .curve-option,`
                + ` ${sel} .audio-mode-option, ${sel} .audio-waveform-option`
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
        await page.locator(`${modal} [data-close]`).click();
        await expect(page.locator(modal)).toBeHidden({ timeout: 15000 });
    }
});

test('Begin Session can actually be pressed on a phone', async ({ page }) => {
    // Begin/Reset must receive taps (not be covered by .orbital-stage).
    test.setTimeout(180000);
    await enter(page, 390, 844);
    await page.locator('[data-nav="library"]').first().click();
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
        return { begin: check('#begin-btn'), reset: check('.orbital-reset') };
    });
    console.log('REACH ' + JSON.stringify(reach));

    expect(reach.begin.found).toBe(true);
    expect(reach.begin.disabled).toBe(false);
    expect(reach.begin.reachable,
        `Begin Session is covered by ${reach.begin.intercepted}`).toBe(true);
    expect(reach.reset.reachable,
        `Reset Settings is covered by ${reach.reset.intercepted}`).toBe(true);

    await page.locator('#begin-btn').click({ timeout: 10000 });
    const accept = page.locator('#safety-accept');
    await accept.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    if (await accept.isVisible()) await accept.click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 90000 });
});

withdrawnJourneyTest('the reading band holds steady while the reading fades', async ({ page }) => {
    // Glass on #atom-band must stay lit while #atom-display fades or empties.
    test.setTimeout(300000);
    await enter(page, 390, 844);
    await page.locator('[data-nav="vault"]').first().click();
    await page.locator('[data-nav="journeys"]').first().click();
    const DEMO = '[data-journey="demo-procedural"]';
    await expect(page.locator(`${DEMO} .journey-credits`)).toBeVisible({ timeout: 120000 });
    await page.locator(`${DEMO} .journey-begin`).click();
    const accept = page.locator('#safety-accept');
    await accept.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
    if (await accept.isVisible()) await accept.click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 90000 });

    await page.waitForFunction(() => {
        const f = document.querySelector('#chamber-field');
        const a = document.querySelector('#atom-display');
        return f && a && a.classList.contains('glass-tile')
            && (f.classList.contains('chamber-field-stream')
                || f.classList.contains('chamber-field-genesis'));
    }, { timeout: 150000 });

    // Pause so atom swaps do not change measured band height mid-check.
    await page.evaluate(() => {
        document.querySelector('#play-pause-btn')?.click();
    });
    await page.waitForTimeout(600);

    const band = await page.evaluate(async () => {
        const el = document.querySelector('#atom-display');
        const bandEl = document.querySelector('#atom-band');
        const read = () => {
            const cs = getComputedStyle(bandEl);
            const r = bandEl.getBoundingClientRect();
            return {
                h: Math.round(r.height),
                bg: cs.backgroundColor,
                blur: (cs.backdropFilter || cs.webkitBackdropFilter || 'none'),
                borderTop: cs.borderTopColor,
                opacity: cs.opacity
            };
        };
        const settle = () => new Promise(r =>
            requestAnimationFrame(() => requestAnimationFrame(r)));

        const saved = el.textContent;
        const savedOpacity = el.style.opacity;

        el.textContent = 'a phrase of ordinary length';
        el.style.opacity = '1';
        await settle();
        const lit = read();

        el.style.opacity = '0';
        await settle();
        const faded = read();

        el.textContent = '';
        await settle();
        const empty = read();

        el.textContent = saved;
        el.style.opacity = savedOpacity;
        return { hasBand: !!bandEl, lit, faded, empty };
    });
    console.log('BAND ' + JSON.stringify(band));

    expect(band.hasBand).toBe(true);

    expect(band.faded.bg).toBe(band.lit.bg);
    expect(band.faded.blur).toBe(band.lit.blur);
    expect(band.faded.borderTop).toBe(band.lit.borderTop);
    expect(band.faded.opacity).toBe('1');
    expect(band.faded.h).toBe(band.lit.h);

    expect(band.empty.bg).toBe(band.lit.bg);
    expect(band.empty.blur).not.toBe('none');
    expect(band.empty.borderTop).toBe(band.lit.borderTop);
    expect(band.empty.h).toBe(band.lit.h);
    expect(band.empty.h).toBeGreaterThan(24);
});

withdrawnJourneyTest('the reading stays above the imagery it is presented over', async ({ page }) => {
    // #atom-band must stack above behind-stream imagery (z-index ≥ 10).
    test.setTimeout(300000);
    await enter(page, 390, 844);
    await page.locator('[data-nav="vault"]').first().click();
    await page.locator('[data-nav="journeys"]').first().click();
    const DEMO = '[data-journey="demo-procedural"]';
    await expect(page.locator(`${DEMO} .journey-credits`)).toBeVisible({ timeout: 120000 });
    await page.locator(`${DEMO} .journey-begin`).click();
    const accept = page.locator('#safety-accept');
    await accept.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
    if (await accept.isVisible()) await accept.click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 90000 });
    await page.waitForFunction(() => {
        const f = document.querySelector('#chamber-field');
        const a = document.querySelector('#atom-display');
        return f && a && a.classList.contains('glass-tile')
            && (f.classList.contains('chamber-field-stream')
                || f.classList.contains('chamber-field-genesis'));
    }, { timeout: 150000 });

    const verdict = await page.evaluate(() => {
        const field = document.querySelector('#chamber-field');
        const band = document.querySelector('#atom-band');
        const el = document.querySelector('#atom-display');
        el.textContent = 'a phrase the reader must be able to see';

        // Opaque probe at cortex imagery z-index 2.
        const imagery = document.createElement('div');
        imagery.id = 'probe-imagery';
        imagery.style.cssText =
            'position:absolute;inset:0;z-index:2;background:#fff;pointer-events:auto;';
        field.insertBefore(imagery, field.firstChild);

        const r = band.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const result = {
            top: top ? `${top.tagName.toLowerCase()}#${top.id}.${top.className.toString().slice(0, 24)}` : 'null',
            readingOnTop: !!(top && (top === band || band.contains(top))),
            bandZ: getComputedStyle(band).zIndex,
            bandPosition: getComputedStyle(band).position
        };
        imagery.remove();
        return result;
    });
    console.log('LAYER ' + JSON.stringify(verdict));

    expect(verdict.readingOnTop,
        `imagery at z-index 2 covers the reading — topmost is ${verdict.top}`).toBe(true);
    expect(verdict.bandPosition).not.toBe('static');
    expect(Number(verdict.bandZ)).toBeGreaterThanOrEqual(10);
});

test('Page Mode keeps the whole measure on the screen', async ({ page }) => {
    // Page measure and control bar must stay inside the phone viewport.
    test.setTimeout(300000);
    await enter(page, 390, 844);
    await page.locator('[data-nav="library"]').first().click();
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

/** Premium mobile threshold (Premium_Mobile_Chamber P1–P7). */

test('the phone-only threshold renders nothing on a desktop', async ({ page }) => {
    // Phone-only portal chrome stays display:none on desktop.
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript((g) => localStorage.setItem('rise-beta-session', JSON.stringify(g)), GATE);
    await page.goto('/');
    await expect(page.locator('[data-nav="chamber"]').first()).toBeVisible({ timeout: 40000 });
    await page.waitForTimeout(2000);

    const d = await page.evaluate(() => {
        const show = (sel) => {
            const el = document.querySelector(sel);
            return el ? getComputedStyle(el).display : 'absent';
        };
        return {
            // innerText ignores display:none phone-only spans.
            actLabel: document.querySelector('.nav-act').innerText.replace(/\s+/g, ' ').trim(),
            rooms: [...document.querySelectorAll('.nav-secondary .nav-item:not(.nav-try)')]
                .map(b => b.innerText.replace(/\s+/g, ' ').trim()),
            tryRise: (() => {
                const library = document.querySelector('[data-nav="library"]').getBoundingClientRect();
                const button = document.querySelector('.nav-try');
                const box = button.getBoundingClientRect();
                return {
                    label: button.querySelector('.try-label')?.textContent.trim(),
                    width: Math.round(box.width),
                    height: Math.round(box.height),
                    centerDelta: Math.round(Math.abs(
                        (library.left + library.width / 2) - (box.left + box.width / 2)
                    ))
                };
            })(),
            vessel: Math.round(document.querySelector('.portal-sigil-vessel').getBoundingClientRect().width),
            // The pavilions went with the Atrium and the Solarium, and with
            // them the arch glyph, the orb and the window this used to read
            // inside their niches. What is left is the phone-only chrome that
            // belongs to the nav.
            phoneOnly: {
                stage: show('.sigil-stage'), mark: show('.act-mark'), verb: show('.act-verb'),
                go: show('.act-go'), roomGlyph: show('.room-glyph'), roomLine: show('.room-line'),
                cont: show('.portal-continue')
            }
        };
    });
    console.log('DESKTOP ' + JSON.stringify(d));

    expect(d.actLabel).toBe('CHAMBER');
    expect(d.rooms).toEqual(['VAULT', 'LIBRARY', 'WORKSHOP']);
    expect(d.tryRise).toEqual({ label: 'Try RISE', width: 96, height: 96, centerDelta: 0 });
    expect(d.vessel).toBe(180);
    for (const [part, display] of Object.entries(d.phoneOnly)) {
        expect(display, `${part} is rendering on the desktop`).toBe('none');
    }
});

test('the threshold fits the phone in its widest state', async ({ page }) => {
    // Assert the tightest real budget (Safari toolbar) with Continue showing.
    test.setTimeout(300000);
    await enter(page, 390, 664);
    await expect(page.locator('[data-nav="chamber"]').first()).toBeVisible({ timeout: 40000 });
    await page.waitForTimeout(2000);

    const cold = await page.evaluate(() => ({
        hidden: document.querySelector('.portal-continue').hidden,
        display: getComputedStyle(document.querySelector('.portal-continue')).display
    }));
    console.log('COLD ' + JSON.stringify(cold));
    expect(cold.display).toBe('none');

    await page.locator('[data-nav="library"]').first().click();
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
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.rise.router.navigate('portal'));
    await page.waitForTimeout(2000);

    const warm = await page.evaluate(() => ({
        display: getComputedStyle(document.querySelector('.portal-continue')).display,
        title: document.querySelector('.continue-title').textContent.trim(),
        cards: [...document.querySelectorAll('.nav-secondary .nav-item:not(.nav-try)')]
            .map(c => c.innerText.replace(/\s+/g, ' ').trim()),
        tryRise: document.querySelector('.nav-try .try-label')?.textContent.trim(),
        below: [...document.querySelectorAll('body *')]
            .filter(n => { const r = n.getBoundingClientRect(); return r.height > 14 && r.bottom > window.innerHeight + 2; })
            .map(n => n.className.toString().slice(0, 30)).slice(0, 4),
        sideways: [...document.querySelectorAll('body *')]
            .filter(n => n.getBoundingClientRect().right > window.innerWidth + 1)
            .map(n => n.className.toString().slice(0, 30)).slice(0, 3),
        docScroll: document.documentElement.scrollHeight,
        vh: window.innerHeight
    }));
    console.log('WARM ' + JSON.stringify(warm));

    // Continue uses title || name; strip must show a non-empty label.
    expect(warm.display).toBe('flex');
    expect(warm.title.length).toBeGreaterThan(0);

    // Three, not five: the two arches counted here went with their rooms.
    expect(warm.cards).toHaveLength(3);
    for (const c of warm.cards) expect(c.length).toBeGreaterThan(8);
    expect(warm.tryRise).toBe('Try RISE');

    expect(warm.below, `these hang below the fold: ${JSON.stringify(warm.below)}`).toEqual([]);
    expect(warm.sideways).toEqual([]);
    expect(warm.docScroll).toBeLessThanOrEqual(warm.vh);
});

/**
 * Phone title tracking matches other surfaces; sigil is a seal, not a control.
 */
test('the phone sets R I S E open, like every other surface', async ({ page }) => {
    await enter(page, 390, 844);
    const title = page.locator('.portal-title');
    await expect(title).toBeVisible();

    const type = await title.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
            text: el.textContent.trim(),
            fontSize: parseFloat(style.fontSize),
            tracking: parseFloat(style.letterSpacing),
            indent: parseFloat(style.textIndent)
        };
    });

    expect(type.text).toBe('RISE');
    expect(type.tracking / type.fontSize).toBeGreaterThan(0.15);
    expect(type.indent).toBeCloseTo(type.tracking, 1);
});

test('the sigil is a seal on a phone, not a play button that opens the Vault', async ({ page }) => {
    await enter(page, 390, 844);
    const vessel = page.locator('.portal-sigil-vessel');
    await expect(vessel).toBeVisible();

    expect(await vessel.evaluate(el => el.tagName)).toBe('DIV');
    expect(await vessel.getAttribute('aria-hidden')).toBe('true');

    await vessel.click({ force: true });
    await page.waitForTimeout(400);
    await expect(page.locator('.portal-title')).toBeVisible();
});

test('the sigil is still the quick way back on a pointer', async ({ page }) => {
    await enter(page, 1280, 800);
    const vessel = page.locator('.portal-sigil-vessel');
    await expect(vessel).toBeVisible();
    expect(await vessel.evaluate(el => el.tagName)).toBe('BUTTON');
    expect(await vessel.getAttribute('aria-label')).toBe('Quick access to last session');
});
