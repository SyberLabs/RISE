import { test, expect } from '@playwright/test';

/**
 * Phone viewports.
 *
 * Nothing tested one until now, which is why the Library's cards could
 * push the page sideways: an edition statement arrived carrying a
 * 96-character Wikisource URL with no break in it, and no rule said a
 * card may not be wider than its column.
 *
 * THE ASSERTION IS ABOUT ELEMENTS, NOT scrollWidth, and that took a
 * verification run to learn. With the fix removed the card measured
 * `right: 464` on a 390px screen — 74px over — and document.scrollWidth
 * still read exactly 390, because `body { overflow: hidden }` clips the
 * page and hides its own overflow. A scrollWidth check would have
 * passed on a visibly broken layout, which is the shape of bug this
 * codebase keeps paying for: the measurement agreeing with itself.
 *
 * So the test asks every element whether it ends past the viewport, and
 * names the widest offender when one does.
 */
const GATE = { code: 'rise2025', name: 'M', vault: null, timestamp: Date.now() };

const PHONES = [
    { name: 'iPhone 12 portrait', width: 390, height: 844 },
    { name: 'small Android portrait', width: 360, height: 800 },
    { name: 'landscape', width: 844, height: 390 }
];

async function enter(page, width, height) {
    await page.setViewportSize({ width, height });
    await page.addInitScript((g) => localStorage.setItem('rise-beta-session', JSON.stringify(g)), GATE);
    await page.goto('/');
}

/** How far the page can be pushed sideways, in pixels. */
const overflow = (page) => page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    // The widest offender, so a failure names something rather than
    // reporting a number nobody can act on.
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
        // Cards render from a registry; give the list a moment to fill.
        await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 30000 });

        const measured = await overflow(page);
        console.log(`${phone.name} ${JSON.stringify(measured)}`);
        expect(measured.widest,
            measured.widest
                ? `${measured.widest.tag}.${measured.widest.cls} ends at `
                  + `${measured.widest.right}px on a ${measured.clientWidth}px screen`
                : '')
            .toBeNull();
        // Kept as a second opinion. It cannot fail alone while the body
        // clips, but it would catch an overflow the element sweep missed.
        expect(measured.scrollWidth).toBeLessThanOrEqual(measured.clientWidth + 1);
    });
}

test('a card carrying a scan URL still fits the column', async ({ page }) => {
    // Romance of the Three Kingdoms is the specific card that broke:
    // its edition statement is a 341-character sourcing memo with two
    // Wikisource file URLs in it.
    test.setTimeout(120000);
    await enter(page, 390, 844);
    await page.locator('[data-nav="library"]').first().click();
    await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 30000 });

    const card = await page.evaluate(() => {
        const el = document.querySelector('[data-text-id="romance-of-the-three-kingdoms"]');
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
    // And the URL is gone from what a reader reads.
    expect(card.subtitle).not.toContain('http');
    expect(card.subtitle).toContain('Brewitt-Taylor');
});

test('a titled work opens its contents sheet', async ({ page }) => {
    // `divisions.noun` is null for a titled scheme and the sheet threw on
    // it, so eleven works could not be opened at all — Ross, Kandinsky,
    // Okakura, the Cherokee myths, Marcus Aurelius, The Storm of Steel.
    // A reader clicking any of them got a console error and no sheet.
    test.setTimeout(120000);
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });

    await enter(page, 390, 844);
    await page.locator('[data-nav="library"]').first().click();
    await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 30000 });

    await page.locator('[data-text-id="ross-pure-design"] [data-action="select-text"]').click();
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
    // It counts rows in our list rather than claiming a unit Ross never
    // named.
    expect(sheet.noun).toBe('entries');
    expect(sheet.first).toContain('Preface');
});

test('the Portal puts the marble away rather than shrinking it', async ({ page }) => {
    // The flanking gazebos are architecture — dome, frieze, volutes,
    // columns, three steps, a niche. They used to be scaled to 0.5 on a
    // phone, and a half-size building is not a smaller building, it is
    // an illegible one. Below 640 the ornament is not drawn and what
    // remains is what the arch was for: a door with its name on it.
    test.setTimeout(120000);
    await enter(page, 390, 844);
    await expect(page.locator('[data-nav="chamber"]').first()).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(2000);

    const arches = await page.evaluate(() =>
        [...document.querySelectorAll('.portal-arch')].map(a => {
            const gz = a.querySelector('.gazebo');
            const nm = a.querySelector('.portal-arch-name');
            return {
                nav: a.dataset.nav,
                name: nm?.textContent.trim() || '',
                gazebo: gz ? getComputedStyle(gz).display : 'absent',
                nameShown: nm ? getComputedStyle(nm).display !== 'none' : false,
                label: a.getAttribute('aria-label')
            };
        }));
    console.log('ARCHES ' + JSON.stringify(arches));

    expect(arches.length).toBeGreaterThan(0);
    for (const arch of arches) {
        expect(arch.gazebo, `${arch.nav} still draws its gazebo`).toBe('none');
        // The carved name lives inside the ornament, so it needs another
        // home once the ornament is gone.
        expect(arch.nameShown, `${arch.nav} shows no name`).toBe(true);
        expect(arch.name.length).toBeGreaterThan(2);
        // The decoration is aria-hidden; the accessible name is on the
        // button and must survive untouched.
        expect(arch.label).toBeTruthy();
    }
});

test('the Chamber reads as a band across the picture', async ({ page }) => {
    // The desktop composition is a lit stage with a column of text in
    // the middle and 48px of air around it. On a 390px screen the air
    // took 96 of them and `max-width: 80%` most of the rest, so a
    // seven-word phrase wrapped to five lines of 36px type.
    //
    // The phone composition is the one Mateo asked for: the phone IS
    // the visual, and the reading is a thin band across the middle.
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

    // Full bleed: a band that stops short of the edges is a card again.
    expect(band.width).toBe(band.viewport);
    expect(band.radius).toBe('0px');
    // Thin. If the reading covers half the phone there is no picture.
    expect(band.heightPct).toBeLessThan(30);
    // Readable, and sized by the viewport rather than by a JS constant.
    // The ladder used to be written inline as 72/56/40/32px, which no
    // stylesheet could answer.
    expect(band.font).toBeGreaterThan(16);
    expect(band.font).toBeLessThan(30);
    // And the phrase does not run off the side, which is where this began.
    expect(band.right).toBeLessThanOrEqual(band.viewport);
});

test('the Portal is one viewport, and does not scroll', async ({ page }) => {
    // A threshold is taken in at a glance. It measured 913px on an
    // 844px screen with the Solarium hanging 21px off the bottom,
    // unreachable — and two stacks were most of it: Vault/Library/
    // Workshop one per line (192px) and the two arches as full-width
    // blocks (230px). Both are rows now.
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
            .map(n => n.className.toString().slice(0, 34)).slice(0, 3),
        // The two doors sit side by side rather than stacked.
        archesSideBySide: (() => {
            const a = [...document.querySelectorAll('.portal-arch')];
            if (a.length < 2) return null;
            const [one, two] = a.map(n => n.getBoundingClientRect());
            return Math.abs(one.top - two.top) < 4 && one.right <= two.left + 4;
        })()
    }));
    console.log('FIT ' + JSON.stringify(fit));

    expect(fit.below, `hanging off the bottom: ${fit.below.join(', ')}`).toEqual([]);
    expect(fit.docHeight).toBeLessThanOrEqual(fit.viewport + 1);
    expect(fit.archesSideBySide).toBe(true);

    // SECONDARY, AND SIZED LIKE IT. At 83px the two doors matched the
    // primary nav and at 47 they still competed with it, because a
    // bordered tile is the wrong object: the right one is a quiet line
    // of type with a hairline under it. The Atrium and the Solarium
    // are rooms off the act, not the act.
    //
    // Measured on the INK rather than the box. The box stays 44px
    // because that is a thumb, and shrinking a touch target to match
    // its type is the other way to get this wrong.
    const doors = await page.evaluate(() => {
        const primary = document.querySelector('.nav-primary .nav-item')
            .getBoundingClientRect().height;
        return {
            primary: Math.round(primary),
            ink: [...document.querySelectorAll('.portal-arch .portal-arch-name')]
                .map(n => Math.round(n.getBoundingClientRect().height)),
            tap: [...document.querySelectorAll('.portal-arch')]
                .map(a => Math.round(a.getBoundingClientRect().height))
        };
    });
    console.log('DOORS ' + JSON.stringify(doors));

    expect(doors.ink.length).toBe(2);
    for (const ink of doors.ink) {
        expect(ink, 'a secondary door is as loud as the primary nav')
            .toBeLessThan(doors.primary / 2);
    }
    for (const tap of doors.tap) {
        expect(tap, 'a door is too small to hit').toBeGreaterThanOrEqual(40);
    }
});

test('the mode selector is one row with no empty cell', async ({ page }) => {
    // Three columns put the five visual modes in two rows and left the
    // sixth cell empty, which reads as a missing option rather than a
    // tidy grid. One row of five is what the choice actually is.
    //
    // Getting there needed width, not just columns: 164px of nested
    // padding (modal 24, body 32, content 24, each side) left the
    // selector 226px, and at 44px a cell ATTRACTOR could only break
    // mid-word — ATTRA/CTOR, GENE/SIS. A UI label is never broken
    // mid-word; the type comes down and the padding gives way.
    test.setTimeout(240000);
    await enter(page, 390, 844);
    await page.locator('[data-nav="library"]').first().click();
    await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 40000 });
    await page.locator('[data-text-id="literary-meditations"] [data-action="select-text"]').click();
    await page.waitForTimeout(2000);
    const toc = page.locator('.toc-entry').first();
    if (await toc.isVisible().catch(() => false)) { await toc.click(); await page.waitForTimeout(2500); }
    await page.locator('.orbit-visual').click();
    await page.waitForTimeout(1500);

    const selector = await page.evaluate(() => {
        const el = document.querySelector('.vi-mode-selector');
        if (!el) return null;
        const btns = [...el.querySelectorAll('.vi-mode-btn')];
        return {
            modes: btns.length,
            columns: getComputedStyle(el).gridTemplateColumns.split(' ').length,
            rows: new Set(btns.map(b => Math.round(b.getBoundingClientRect().top))).size,
            height: Math.round(el.getBoundingClientRect().height),
            clipped: btns.filter(b => {
                const n = b.querySelector('.vi-mode-name');
                return n && n.scrollWidth > n.clientWidth + 1;
            }).map(b => b.textContent.trim().slice(0, 12))
        };
    });
    console.log('SELECTOR ' + JSON.stringify(selector));

    expect(selector, 'no mode selector found').not.toBeNull();
    // A column per mode: five in, five across, no hole.
    expect(selector.columns).toBe(selector.modes);
    expect(selector.rows).toBe(1);
    expect(selector.clipped, 'a mode label is cut off').toEqual([]);
    // And it costs a strip rather than a screen. It was 410px.
    expect(selector.height).toBeLessThan(110);
});

test('the orbit is centred in the phone rather than cropped by it', async ({ page }) => {
    // The stage was a fixed 400px on a 390px screen, sitting at
    // left:-5 / right:395. Worse, it overflowed its own padded
    // container — and an overflowing flex child with `align-items:
    // center` pins to the start edge instead of centring, which is why
    // one orb touched the frame while the other looked padded.
    test.setTimeout(180000);
    await enter(page, 390, 844);
    await page.locator('[data-nav="library"]').first().click();
    await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 40000 });
    await page.locator('[data-text-id="literary-meditations"] [data-action="select-text"]').click();
    await page.waitForTimeout(2000);
    const toc = page.locator('.toc-entry').first();
    if (await toc.isVisible().catch(() => false)) { await toc.click(); await page.waitForTimeout(2500); }
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

    // Centred on the screen, not merely inside it.
    expect(Math.abs(ring.stageMid - ring.screenMid)).toBeLessThanOrEqual(2);
    // And symmetric: this is the asymmetry that read as "too big".
    expect(ring.leftGap).toBeGreaterThan(8);
    expect(Math.abs(ring.leftGap - ring.rightGap)).toBeLessThanOrEqual(3);
});

test('the Chamber control bar stays on the screen', async ({ page }) => {
    // It ran 525px wide on a 390px screen, from x=-68 to x=458: two
    // buttons off the left edge and the exit button off the right,
    // unreachable. Six controls at a 16px gap, two carrying text
    // labels whose reserved min-widths outlived them.
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
    // Every control reachable by a thumb, which is the whole point.
    expect(bar.worstLeft).toBeGreaterThanOrEqual(0);
    expect(bar.worstRight).toBeLessThanOrEqual(bar.viewport);
});

/**
 * ═══════════════════════════════════════════════════════════════
 * DENSITY
 * ═══════════════════════════════════════════════════════════════
 *
 * Every measurement in this app was authored against a 1440px desktop
 * and then applied unchanged at 390px, because no stylesheet knew the
 * difference. Nothing about that is visible in a screenshot of a
 * component; it only shows up as an answer to "how much of the thing
 * you came for can you actually see?" — which is what these ask.
 *
 * Before the density step in design-system.css:
 *
 *     the Vault      first archetype at y=573, 1 of 6 visible
 *     the Library    first card at y=541, card height 401 — no book
 *                    fit the first screen at all
 *     Audio panel    1273px of body on a 664px phone, four of its
 *                    seven sections starting below the fold
 *
 * These are thresholds, not pixel-perfect locks: they fail when a
 * screen goes back to spending most of itself on chrome, and they do
 * not care how the remaining room is arranged.
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

    // Header, tabs, preamble and two axes of filters are all real —
    // but between them they may not own most of the glass.
    expect(shelf.chromeShare).toBeLessThan(0.62);
    // And a card is a card, not a page: one has to fit under the fold
    // it starts at.
    expect(shelf.firstCardTop + shelf.cardHeight).toBeLessThanOrEqual(shelf.viewport);
});

test('the Vault opens on its archetypes rather than on an explanation', async ({ page }) => {
    test.setTimeout(120000);
    await enter(page, 390, 844);
    await page.locator('[data-nav="vault"]').first().click();
    await expect(page.locator('.archetype-card').first()).toBeVisible({ timeout: 30000 });

    const vault = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.archetype-card')];
        return {
            total: cards.length,
            visible: cards.filter(c => c.getBoundingClientRect().bottom <= window.innerHeight).length,
            // The orientation blurb is desktop courtesy; on a phone it
            // is the reason the shelf started below the fold.
            introShown: (() => {
                const el = document.querySelector('.vault-intro');
                return el ? getComputedStyle(el).display !== 'none' : false;
            })()
        };
    });
    console.log('VAULT ' + JSON.stringify(vault));

    expect(vault.introShown).toBe(false);
    expect(vault.visible).toBeGreaterThanOrEqual(3);
});

test('the configuration panels are not several screens of picture tiles', async ({ page }) => {
    // An option used to be a TILE: a 28px glyph on its own line, a name
    // beneath it, 24px of padding around both — so three soundscapes
    // cost 265px and the Audio panel ran to 1273. On a phone the same
    // choice is a list: glyph and name on one line, at a touch target's
    // height.
    test.setTimeout(180000);
    await enter(page, 390, 844);
    await page.locator('[data-nav="library"]').first().click();
    await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 30000 });
    await page.locator('[data-text-id="the-iliad"] [data-action="select-text"]').click();
    await page.waitForTimeout(1500);
    const toc = page.locator('.toc-entry').first();
    if (await toc.isVisible().catch(() => false)) { await toc.click(); }
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

        // Two screens of scrolling is a page, not a panel.
        expect(m.body, `${m.id} body`).toBeLessThan(m.viewport * 2);
        // A row, not a tile. Nothing here needs to be taller than a
        // generous touch target.
        if (m.tallestOption !== null) {
            expect(m.tallestOption, `${m.id} tallest option`).toBeLessThanOrEqual(56);
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
    }
});
