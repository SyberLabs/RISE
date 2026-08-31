import { test, expect } from '@playwright/test';

/**
 * THE VISUAL NAVIGATOR, ON A PHONE.
 *
 * Below 960 the panel's columns collapsed to one and a Back button
 * appeared, and there the drill-down stopped: the ENTRY was never made a
 * step, so the rail a reader had just used stayed stacked above the pane
 * they opened from it. Both scrollports were released in the same rule and
 * nothing replaced them, so the panel's height ran free and the modal
 * became the only scroller.
 *
 * Measured at 390x844 before this: the panel stood 968px on a Klee leaf
 * and 2053px on Size. Everything it pins rode away with the modal — the
 * specimen from the head of the pane, the commit from its foot (y=847 on
 * an 844px screen, its toggle wholly below the fold), and the two reader
 * switches a further screen down. Opening Size from the root rendered no
 * Back button at all, because `path` was empty.
 *
 * What is guarded here is the shape, not the pixels: one pane at a time,
 * a panel bounded by the frame it sits in, the commit and the switches on
 * screen without scrolling, one press of Back per level, and a floor under
 * type and touch. The desktop case is asserted alongside so the phone rule
 * cannot leak into the columns it was written to replace.
 */
const GATE = { code: 'rise2025', name: 'M', vault: null, timestamp: Date.now() };
const PHONE = { width: 390, height: 844 };

async function openNavigator(page, size) {
    await page.setViewportSize(size);
    await page.addInitScript(g => localStorage.setItem('rise-beta-session', JSON.stringify(g)), GATE);
    await page.goto('/');
    await page.locator('[data-nav="library"]').first().click();
    await expect(page.locator('.archive-card').first()).toBeVisible({ timeout: 40000 });
    await page.locator('[data-text-id="literary-meditations"] [data-action="select-text"]').click();
    await page.waitForTimeout(2000);
    const toc = page.locator('.toc-entry').first();
    if (await toc.isVisible().catch(() => false)) { await toc.click(); }
    await expect(page.locator('.orbital-stage')).toBeVisible({ timeout: 30000 });
    await page.locator('.orbit-visual').click();
    await expect(page.locator('.vnav')).toBeVisible({ timeout: 15000 });
}

/** A leaf three levels down, which is where the commit sat below the fold. */
async function openKlee(page) {
    await page.locator('.vnav-node[data-id="visual"]').click();
    await page.locator('.vnav-node[data-id="dynamic"]').click();
    await page.locator('.vnav-node[data-id="klee"]').click();
    await expect(page.locator('.vnav-entry h3')).toBeVisible();
}

/** What is on screen, and what is merely on the page. */
const geometry = () => {
    const nav = document.querySelector('.vnav');
    const box = el => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom) };
    };
    const shown = el => Boolean(el) && getComputedStyle(el).display !== 'none';
    const modal = document.querySelector('#modal-visual .modal-content');
    const entry = nav.querySelector('.vnav-entry');
    return {
        viewportHeight: window.innerHeight,
        nav: box(nav),
        railShown: shown(nav.querySelector('.vnav-col.vnav-current')),
        entryShown: shown(entry),
        commit: box(nav.querySelector('.vnav-commit')),
        toggle: box(nav.querySelector('.vnav-toggle')),
        readerControls: box(nav.querySelector('.vnav-reader-controls')),
        // The panel scrolls inside itself; the modal around it does not.
        modalScrolls: Boolean(modal) && modal.scrollHeight > modal.clientHeight + 2,
        entryIsScrollport: Boolean(entry) && /auto|scroll/.test(getComputedStyle(entry).overflowY)
    };
};

test('the panel is bounded by the frame, and keeps its commit in sight', async ({ page }) => {
    test.setTimeout(180000);
    await openNavigator(page, PHONE);
    await openKlee(page);

    const g = await page.evaluate(geometry);
    console.log('PHONE LEAF ' + JSON.stringify(g));

    // The panel fits the screen rather than running past it.
    expect(g.nav.bottom).toBeLessThanOrEqual(g.viewportHeight);
    expect(g.modalScrolls, 'the modal is not the scroller').toBe(false);
    expect(g.entryIsScrollport, 'the entry is').toBe(true);

    // The two things a reader came for. The commit was measured three pixels
    // below the fold with its toggle entirely off screen; the switches were a
    // screen further down again.
    expect(g.commit.bottom).toBeLessThanOrEqual(g.viewportHeight);
    expect(g.toggle.bottom).toBeLessThanOrEqual(g.viewportHeight);
    expect(g.readerControls.bottom).toBeLessThanOrEqual(g.viewportHeight);
});

test('one pane at a time, and one press of Back per level', async ({ page }) => {
    test.setTimeout(180000);
    await openNavigator(page, PHONE);

    // With nothing open the rail IS the pane: no placeholder stacked under it.
    let g = await page.evaluate(geometry);
    expect(g.railShown, 'the rail stands alone').toBe(true);
    expect(g.entryShown, 'and the "choose a field" placeholder does not').toBe(false);

    // A leaf reached straight off the root. `path` is empty here, which is why
    // Back was never rendered and the rail stayed stacked above the controls.
    await page.locator('.vnav-node[data-id="size"]').click();
    await expect(page.locator('[data-font-size="fit"]')).toBeVisible();
    g = await page.evaluate(geometry);
    expect(g.entryShown, 'the pane a reader opened').toBe(true);
    expect(g.railShown, 'takes the screen from the rail').toBe(false);
    await expect(page.locator('[data-action="navigator-back"]'), 'and Back is offered')
        .toBeVisible();

    await page.locator('[data-action="navigator-back"]').click();
    await expect(page.locator('.vnav-node[data-id="visual"]'), 'which returns to the rail')
        .toBeVisible();

    // From a leaf three deep, Back returns to the list it was chosen from —
    // not two levels up, which is where clearing the focus and popping the
    // path together used to land.
    await openKlee(page);
    await page.locator('[data-action="navigator-back"]').click();
    await expect(page.locator('.vnav-node[data-id="klee"]'),
        'the siblings it was picked from').toBeVisible();
});

test('nothing is smaller than a fingertip, or than eleven pixels', async ({ page }) => {
    test.setTimeout(180000);
    await openNavigator(page, PHONE);
    await page.locator('.vnav-node[data-id="size"]').click();
    await expect(page.locator('[data-font-size="fit"]')).toBeVisible();

    const audit = await page.evaluate(() => {
        const nav = document.querySelector('.vnav');
        const visible = el => el.offsetParent !== null
            || getComputedStyle(el).position === 'sticky';
        // The row is the control for a switch, and the input inside it is
        // deliberately 1px — the label is what a finger lands on.
        const controls = [...nav.querySelectorAll('button, label.vnav-switch')]
            .filter(visible)
            .map(el => {
                const r = el.getBoundingClientRect();
                return {
                    name: el.className.toString().split(' ')[0],
                    width: Math.round(r.width),
                    height: Math.round(r.height)
                };
            })
            .filter(c => c.width > 0 && c.height > 0);
        const text = [...nav.querySelectorAll('*')]
            .filter(el => el.children.length === 0 && (el.textContent || '').trim().length > 1
                && el.offsetParent !== null)
            .map(el => ({
                name: el.className.toString().split(' ')[0],
                size: parseFloat(getComputedStyle(el).fontSize)
            }));
        return {
            short: controls.filter(c => c.height < 44),
            small: [...new Set(text.filter(t => t.size < 11).map(t => `${t.name}@${t.size}`))]
        };
    });
    console.log('PHONE SCALE ' + JSON.stringify(audit));

    // Chips stood at 33px and rail rows at 39px, against the 44px floor the
    // switch rows in this same panel already kept.
    expect(audit.short).toEqual([]);
    // Eight distinct sizes ran below 12px, the section labels at 9.
    expect(audit.small).toEqual([]);
});

test('the commit toggle answers a finger, without changing its form', async ({ page }) => {
    test.setTimeout(180000);
    await openNavigator(page, PHONE);
    await openKlee(page);

    const hit = await page.evaluate(() => {
        const toggle = document.querySelector('.vnav-toggle');
        const r = toggle.getBoundingClientRect();
        const at = (x, y) => {
            const el = document.elementFromPoint(x, y);
            return Boolean(el) && (el === toggle || toggle.contains(el)
                || el.closest('.vnav-toggle') === toggle);
        };
        const x = r.left + r.width / 2;
        return {
            // The track keeps the form it was drawn with...
            drawn: { width: Math.round(r.width), height: Math.round(r.height) },
            // ...while what a finger may land on reaches the floor around it.
            above: at(x, r.top - 7),
            below: at(x, r.bottom + 7)
        };
    });
    console.log('TOGGLE ' + JSON.stringify(hit));
    expect(hit.drawn).toEqual({ width: 54, height: 26 });
    expect(hit.above, 'the hit area reaches above the track').toBe(true);
    expect(hit.below, 'and below it').toBe(true);
});

/**
 * Landscape, and the band between a phone and a desktop.
 *
 * The single-pane collapse begins at 960, so the height that lets the panel
 * scroll inside itself has to begin there too — otherwise a tablet gets one
 * pane AND a panel running off the bottom. The two reader switches stack
 * only below 640: a landscape phone has 844px of width to lay them across
 * and 390px of height it cannot spare.
 */
for (const shape of [
    { name: 'a landscape phone', width: 844, height: 390 },
    { name: 'a small tablet', width: 820, height: 1100 }
]) {
    test(`the panel is bounded on ${shape.name} too`, async ({ page }) => {
        test.setTimeout(180000);
        await openNavigator(page, shape);
        await openKlee(page);

        const g = await page.evaluate(geometry);
        console.log(`${shape.name.toUpperCase()} ` + JSON.stringify(g));

        expect(g.nav.bottom).toBeLessThanOrEqual(g.viewportHeight);
        expect(g.modalScrolls, 'the modal is not the scroller').toBe(false);
        expect(g.railShown, 'one pane at a time here as well').toBe(false);
        expect(g.commit.bottom).toBeLessThanOrEqual(g.viewportHeight);
        expect(g.readerControls.bottom).toBeLessThanOrEqual(g.viewportHeight);

        // The pane a reader came to use keeps real room, rather than being
        // squeezed to nothing by the furniture above and below it.
        const entryHeight = await page.evaluate(() =>
            Math.round(document.querySelector('.vnav-entry').getBoundingClientRect().height));
        expect(entryHeight).toBeGreaterThan(120);
    });
}

test('the columns still stand beside the entry on a desktop', async ({ page }) => {
    test.setTimeout(180000);
    await openNavigator(page, { width: 1280, height: 800 });
    await openKlee(page);

    const desktop = await page.evaluate(() => {
        const nav = document.querySelector('.vnav');
        const back = nav.querySelector('[data-action="navigator-back"]');
        return {
            columns: [...nav.querySelectorAll('.vnav-col')]
                .filter(c => getComputedStyle(c).display !== 'none').length,
            entryShown: getComputedStyle(nav.querySelector('.vnav-entry')).display !== 'none',
            backShown: Boolean(back) && getComputedStyle(back).display !== 'none'
        };
    });
    // The phone hides one pane to show the other. A desktop shows the chain,
    // which is the whole reason the panel is drawn as columns.
    expect(desktop.columns).toBeGreaterThan(1);
    expect(desktop.entryShown).toBe(true);
    expect(desktop.backShown, 'and reaches its levels by the columns, not a button')
        .toBe(false);
});
