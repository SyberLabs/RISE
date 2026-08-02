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
    await expect(page.locator('[data-nav="journeys"]').first()).toBeVisible({ timeout: 30000 });
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
