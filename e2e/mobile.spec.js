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
    if (await toc.isVisible().catch(() => false)) { await toc.click(); }
    // Wait for the ring, then for the panel. Every sleep here was a
    // guess about machine speed standing where a condition belonged —
    // the same defect that made the panel-density test wait out a
    // three-minute timeout against a working screen.
    await expect(page.locator('.orbital-stage')).toBeVisible({ timeout: 30000 });
    await page.locator('.orbit-visual').click();
    await expect(page.locator('#modal-visual')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.vi-mode-selector')).toBeVisible({ timeout: 15000 });

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
        // CLOSE IT THE WAY THE PANEL OFFERS, AND WAIT FOR IT TO GO.
        //
        // Two lessons are baked in here. The first: this used to sleep
        // 400ms and then click the orb underneath a possibly-still-open
        // overlay, so when the guess about machine speed was wrong the
        // modal intercepted the click and Playwright waited out a full
        // 180s actionability timeout against a working panel. Wait for
        // the condition.
        //
        // The second: waiting revealed that ESCAPE itself did not close
        // it once, under full-suite load, for 15s and 33 polls. It
        // could not be reproduced in isolation — the router path is
        // clean there (activeModal 'temporal' → null, hidden true) — and
        // the likeliest mechanism is `router.handleKeydown` swallowing
        // the press while `transitioning` is true, which loses it
        // permanently because nothing presses again. That is worth
        // chasing on its own; it is not what this test is for. This
        // test measures panel density, so it uses the panel's own close
        // control, which is deterministic and is also what a reader
        // actually touches on a phone.
        await page.locator(`${modal} [data-close]`).click();
        await expect(page.locator(modal)).toBeHidden({ timeout: 15000 });
    }
});

test('Begin Session can actually be pressed on a phone', async ({ page }) => {
    // A LAYOUT BUG THAT LOOKS LIKE NOTHING.
    //
    // On a phone the actions climb 44px into the stage's empty lower
    // band, because a square stage around a triangular ring leaves 67
    // pixels of nothing under it. But `.orbital-stage` is
    // `position: relative`, and a positioned element hit-tests ABOVE a
    // static sibling however the DOM is ordered — so the stage's own
    // box took every tap and Begin Session could not be pressed at
    // all. It rendered correctly, it was not disabled, it had a cursor
    // and a hover state, and nothing about the screen said so.
    //
    // Rendering is not reachability, so this asks the DOM who actually
    // receives the tap, and then takes it.
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

    // And the tap does what it says.
    await page.locator('#begin-btn').click({ timeout: 10000 });
    const accept = page.locator('#safety-accept');
    await accept.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    if (await accept.isVisible()) await accept.click();
    await expect(page.locator('#chamber-display')).toBeVisible({ timeout: 90000 });
});

test('the reading band holds steady while the reading fades', async ({ page }) => {
    // THE BAND AND THE READING ARE NOT THE SAME OBJECT.
    //
    // Every atom over 400ms takes #atom-display to opacity 0 and fades
    // it back over 150ms. That is right for the text, and it was
    // catastrophic for glass carried on the same element: `opacity`
    // composites the whole subtree, so the fade meant for the words
    // took the background, the blur, the borders and the shadow with
    // it. On a desktop the pane hugs the token and that IS the effect;
    // full-bleed on a phone it is a bar across the whole screen
    // blinking off and on once per atom — three to five times a second
    // in Word chunking over a Gallery field.
    //
    // So the glass lives on a wrapper the fade cannot reach. This
    // drives both failure modes by hand rather than waiting to catch a
    // flicker, because a race is not a test.
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

    // The band only exists in the two field variants that carry glass.
    await page.waitForFunction(() => {
        const f = document.querySelector('#chamber-field');
        const a = document.querySelector('#atom-display');
        return f && a && a.classList.contains('glass-tile')
            && (f.classList.contains('chamber-field-stream')
                || f.classList.contains('chamber-field-genesis'));
    }, { timeout: 150000 });

    // FREEZE THE READING FIRST. The player keeps writing #atom-display
    // on its own clock, so an unpaused measurement compares one atom's
    // height against the next one's and reports a difference the band
    // never had. The first version of this test did exactly that.
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

        // What the player does on EVERY atom over 400ms.
        el.style.opacity = '0';
        await settle();
        const faded = read();

        // And what it does on a paragraph break.
        el.textContent = '';
        await settle();
        const empty = read();

        el.textContent = saved;
        el.style.opacity = savedOpacity;
        return { hasBand: !!bandEl, lit, faded, empty };
    });
    console.log('BAND ' + JSON.stringify(band));

    expect(band.hasBand).toBe(true);

    // 1. The reading fading does not take the band with it. This is the
    //    stutter, and it is the whole reason the wrapper exists.
    expect(band.faded.bg).toBe(band.lit.bg);
    expect(band.faded.blur).toBe(band.lit.blur);
    expect(band.faded.borderTop).toBe(band.lit.borderTop);
    expect(band.faded.opacity).toBe('1');
    expect(band.faded.h).toBe(band.lit.h);

    // 2. Nor does an empty atom.
    expect(band.empty.bg).toBe(band.lit.bg);
    expect(band.empty.blur).not.toBe('none');
    expect(band.empty.borderTop).toBe(band.lit.borderTop);
    // It may grow past one line for a long phrase; it never falls below.
    expect(band.empty.h).toBe(band.lit.h);
    expect(band.empty.h).toBeGreaterThan(24);
});

test('the reading stays above the imagery it is presented over', async ({ page }) => {
    // THE BUG A MODE-DEPENDENT TEST WOULD HAVE MISSED.
    //
    // .atom-display carries `position: relative; z-index: 10` for one
    // reason: the reading must sit above the presenting imagery, which
    // drops to z-index 2 in behind-stream. Wrapping it in a band with
    // `backdrop-filter` made that wrapper a STACKING CONTEXT, so the 10
    // stopped being measured against the imagery and started being
    // measured against the band's own siblings — of which there are
    // none. The band itself was static and auto: beneath everything
    // positioned in the field. A gallery image arriving a few seconds
    // into a reading painted over the text and the glass together, and
    // never uncovered them.
    //
    // Watching a live Demo did not catch it, because whether imagery
    // ever covers the centre depends on which engine is presenting and
    // when. So this puts a layer exactly where the cortex puts one and
    // asks the DOM who is on top — a condition, not a coincidence.
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

        // Exactly what the cortex mounts behind the stream: an opaque
        // full-field layer at the z-index the spec gives it.
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
    // The band inherited the job along with the box.
    expect(verdict.bandPosition).not.toBe('static');
    expect(Number(verdict.bandZ)).toBeGreaterThanOrEqual(10);
});

test('Page Mode keeps the whole measure on the screen', async ({ page }) => {
    // AN OPTICAL NUDGE THAT BECAME A NEGATIVE MARGIN.
    //
    // The measure is centred by hand rather than by `auto`, because the
    // hanging verse marks sit outside it on the left and a
    // mathematically centred column reads pushed left. That correction
    // is `calc(50% - var(--page-measure) / 2 + 1.4rem)`, which is sound
    // while the viewport is wider than the measure and vandalism as
    // soon as it is not: at 390px it computes to MINUS 55px, and the
    // reader clips its own overflow-x. The first 39px of every line —
    // the title, the source, the opening of every paragraph — was cut
    // off the left edge and could not be scrolled to.
    //
    // The bar is checked in the same breath because Page Mode is the
    // one place it holds three controls instead of six, and it was
    // still spanning the full width for them.
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
    await page.waitForTimeout(2500);

    // The bar fades on inactivity and goes pointer-events:none with it.
    await page.mouse.move(195, 700);
    await page.waitForTimeout(400);

    // Where the bar sits BEFORE the projection changes. Page Mode may
    // reshape it; it may not push it closer to the bottom edge, which
    // on a phone means into the home-indicator strip.
    const streamBottom = await page.evaluate(() =>
        Math.round(window.innerHeight - document.querySelector('.chamber-controls').getBoundingClientRect().bottom));

    await page.locator('#page-mode-btn').click({ timeout: 20000 });
    await expect(page.locator('.page-reader')).toBeVisible({ timeout: 60000 });
    await page.waitForTimeout(2000);

    const m = await page.evaluate(() => {
        const art = document.querySelector('.page-article').getBoundingClientRect();
        // Anything whose ink begins left of the screen is unreachable:
        // the reader clips overflow-x, so it cannot be scrolled to.
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

    // Three controls do not need the whole width, and cannot wrap.
    expect(m.bar.w).toBeLessThan(m.vw * 0.75);
    // Still centred on the screen it shrank inside.
    expect(Math.abs((m.bar.l + m.bar.r) / 2 - m.vw / 2)).toBeLessThanOrEqual(2);
    // AND NO LOWER THAN IT WAS. A safe-area inset is worth nothing in a
    // document with no `viewport-fit=cover` — every env() here resolves
    // to zero — so a bottom offset that budgeted for one was simply a
    // smaller number, and the bar dropped 16px into the indicator strip
    // on entering Page Mode.
    expect(m.barGap,
        `the bar sits ${m.barGap}px from the bottom in Page Mode but ${streamBottom}px in the Stream`)
        .toBeGreaterThanOrEqual(streamBottom);
});

/**
 * ═══════════════════════════════════════════════════════════════
 * THE PREMIUM MOBILE THRESHOLD (Premium_Mobile_Chamber P1–P7)
 * ═══════════════════════════════════════════════════════════════
 */

test('the phone-only threshold renders nothing on a desktop', async ({ page }) => {
    // THE CONSTRAINT WAS "DO NOT TOUCH THE PC", so it is asserted rather
    // than reasoned about. Every part added for the phone is declared
    // `display: none` at the top of the cascade and revealed only under
    // ≤640 — which means a desktop cannot be affected by construction,
    // and this proves the construction holds.
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
            // innerText respects rendering; textContent would report the
            // hidden spans and tell us nothing about what is on screen.
            actLabel: document.querySelector('.nav-act').innerText.replace(/\s+/g, ' ').trim(),
            rooms: [...document.querySelectorAll('.nav-secondary .nav-item')]
                .map(b => b.innerText.replace(/\s+/g, ' ').trim()),
            vessel: Math.round(document.querySelector('.portal-sigil-vessel').getBoundingClientRect().width),
            gazeboShown: getComputedStyle(document.querySelector('.gazebo')).display !== 'none',
            phoneOnly: {
                stage: show('.sigil-stage'), mark: show('.act-mark'), verb: show('.act-verb'),
                go: show('.act-go'), roomGlyph: show('.room-glyph'), roomLine: show('.room-line'),
                archGlyph: show('.portal-arch-glyph'), orb: show('.sol-strip-orb'),
                win: show('.sol-strip-window'), cont: show('.portal-continue')
            }
        };
    });
    console.log('DESKTOP ' + JSON.stringify(d));

    // The desktop tile still says the word it always said.
    expect(d.actLabel).toBe('CHAMBER');
    expect(d.rooms).toEqual(['VAULT', 'LIBRARY', 'WORKSHOP']);
    expect(d.vessel).toBe(180);
    expect(d.gazeboShown, 'the marble is still drawn').toBe(true);
    for (const [part, display] of Object.entries(d.phoneOnly)) {
        expect(display, `${part} is rendering on the desktop`).toBe('none');
    }
});

test('the threshold fits the phone in its widest state', async ({ page }) => {
    // 844 is the iPhone 12's LAYOUT height; 664 is what Safari leaves
    // visible with its toolbar up, and it is the real budget. The widest
    // state is the one with the Continue strip present — the layout that
    // breaks first, and therefore the only one worth asserting.
    test.setTimeout(300000);
    await enter(page, 390, 664);
    await expect(page.locator('[data-nav="chamber"]').first()).toBeVisible({ timeout: 40000 });
    await page.waitForTimeout(2000);

    // A cold visit has nothing to continue, and shows nothing.
    const cold = await page.evaluate(() => ({
        hidden: document.querySelector('.portal-continue').hidden,
        display: getComputedStyle(document.querySelector('.portal-continue')).display
    }));
    console.log('COLD ' + JSON.stringify(cold));
    expect(cold.display).toBe('none');

    // Warm it the honest way: actually read something.
    await page.locator('[data-nav="vault"]').first().click();
    await page.locator('[data-nav="journeys"]').first().click();
    const DEMO = '[data-journey="demo-procedural"]';
    await expect(page.locator(`${DEMO} .journey-credits`)).toBeVisible({ timeout: 120000 });
    await page.locator(`${DEMO} .journey-begin`).click();
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
        // Every card present and named.
        cards: [...document.querySelectorAll('.nav-secondary .nav-item, .portal-arch')]
            .map(c => c.innerText.replace(/\s+/g, ' ').trim()),
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

    // The session's name lives on `name`, not `title`; reading only
    // `title` shipped this strip as dead code once already.
    expect(warm.display).toBe('flex');
    expect(warm.title.length).toBeGreaterThan(0);

    // Each room says what it holds.
    expect(warm.cards).toHaveLength(5);
    for (const c of warm.cards) expect(c.length).toBeGreaterThan(8);

    // And it still fits, with everything showing at once.
    expect(warm.below, `these hang below the fold: ${JSON.stringify(warm.below)}`).toEqual([]);
    expect(warm.sideways).toEqual([]);
    expect(warm.docScroll).toBeLessThanOrEqual(warm.vh);
});
