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


/**
 * THE FOOT OF THE PANEL BELONGS TO THE PANE.
 *
 * Two footers were pinned to the bottom of a phone: the commit, which is the
 * primary action, and beneath it three settings a reader chooses once.
 * Measured at 390x844 with a gallery in play and a mask on the letters, the
 * settings stood 277px and never moved — Living Text 67, Glass 115 (a
 * five-line account of why it cannot act), Cadence 44. On the Visual list
 * that left the rail 151px: the furniture was very nearly twice the room it
 * framed, and half the panel was unusable.
 *
 * They are not properties of the pane — they are the same on every one of
 * them, which is exactly why they can collapse. The bar states them and
 * opens over the pane on request, at full size, keeping the explanations a
 * tooltip could never give a phone.
 */
const SEED = {
    text: 'Light enters form and returns through measure. '.repeat(80).trim(),
    textSource: 'Seed', origin: null
};

/**
 * A gallery in play, so Cadence is there, and a mask on the letters, so the
 * Glass note is the long refusal — the worst case, and the screenshots'.
 */
const LOADED = {
    wpm: 360, chunkMode: 'word',
    visualInterlocution: {
        visualMode: 'interlocution',
        livingText: { enabled: true, intensity: 0.8 },
        interlocution: {
            sourceFamily: 'procedural', procedural: ['turrell'], sourced: [],
            presentation: 'continuous', streamGlass: false,
            wordFill: { mode: 'pick', sourceFamily: 'procedural', procedural: ['fractal'], sourced: [] }
        }
    }
};

async function openLoadedNavigator(page, size = PHONE) {
    await page.setViewportSize(size);
    await page.addInitScript(({ gate, seed, prefs }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify(prefs));
        localStorage.setItem('rise-settings', JSON.stringify({ chamberFace: 'thick', fontSize: 'fit' }));
    }, { gate: GATE, seed: SEED, prefs: LOADED });
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('#begin-btn')).toBeEnabled({ timeout: 15000 });
    await page.locator('[data-orbit="visual"]').click();
    await expect(page.locator('.vnav')).toBeVisible({ timeout: 15000 });
}

/** Down to the leaf the second screenshot was taken on. */
async function openBySubject(page) {
    const visual = page.locator('.vnav-node[data-id="visual"]');
    for (let i = 0; i < 4 && !(await visual.isVisible()); i += 1) {
        await page.locator('[data-action="navigator-back"]').click();
    }
    await visual.click();
    await page.locator('.vnav-node[data-id="gallery"]').click();
    await page.locator('.vnav-node[data-id="gallery-sourced"]').click();
    await page.locator('.vnav-node[data-id="by-subject"]').click();
    await expect(page.locator('.vnav-entry h3')).toBeVisible();
}

const footer = () => {
    const nav = document.querySelector('.vnav');
    const h = el => el ? Math.round(el.getBoundingClientRect().height) : 0;
    const controls = nav.querySelector('.vnav-reader-controls');
    return {
        panel: h(nav),
        controls: h(controls),
        entry: h(nav.querySelector('.vnav-entry')),
        rail: h(nav.querySelector('.vnav-col.vnav-current')),
        summary: nav.querySelector('.vnav-reader-state')?.textContent.trim() ?? null,
        open: controls.classList.contains('is-open'),
        switchesOnScreen: [...nav.querySelectorAll('.vnav-switch')]
            .filter(el => el.offsetParent !== null).length,
        cadenceOnScreen: Boolean(nav.querySelector('.vnav-cadence')?.offsetParent)
    };
};

test('the settings do not take the room the pane needs', async ({ page }) => {
    test.setTimeout(180000);
    await openLoadedNavigator(page);
    await openBySubject(page);

    const f = await page.evaluate(footer);
    console.log('FOOTER ' + JSON.stringify(f));

    // 277px of 661 — 42% at a leaf, 56% at a list — is what this replaces.
    expect(f.controls).toBeLessThan(64);
    expect(f.controls / f.panel).toBeLessThan(0.15);
    // And the pane is the larger part of the panel by a wide margin.
    expect(f.entry).toBeGreaterThan(f.controls * 4);
    // Collapsed means collapsed: nothing of the switches is on screen.
    expect(f.switchesOnScreen).toBe(0);
    expect(f.cadenceOnScreen).toBe(false);
});

test('the bar says what the switches say', async ({ page }) => {
    test.setTimeout(180000);
    await openLoadedNavigator(page);
    await openBySubject(page);

    // Collapsing may not cost a reader the state — that is the whole reason
    // these were kept in sight rather than filed under a menu.
    const f = await page.evaluate(footer);
    expect(f.summary).toMatch(/Living Text (on|off)/);
    expect(f.summary).toMatch(/Glass (on|off)/);
    // A gallery is in play, so its cadence is named too.
    expect(f.summary).toMatch(/Slow|Measured|Quick/);
});

test('it opens over the pane, whole, and does not resize it', async ({ page }) => {
    test.setTimeout(180000);
    await openLoadedNavigator(page);
    await openBySubject(page);
    const before = await page.evaluate(footer);

    await page.locator('[data-action="reader-sheet"]').click();
    const sheet = await page.evaluate(() => {
        const box = document.querySelector('.vnav-reader-sheet').getBoundingClientRect();
        return {
            notes: [...document.querySelectorAll('.vnav-switch-note')]
                .filter(el => el.offsetParent !== null)
                .map(el => el.textContent.trim().length),
            expanded: document.querySelector('[data-action="reader-sheet"]')
                .getAttribute('aria-expanded'),
            sheetTop: Math.round(box.top),
            sheetBottom: Math.round(box.bottom),
            viewportHeight: window.innerHeight
        };
    });
    const after = { ...(await page.evaluate(footer)), ...sheet };
    console.log('SHEET OPEN ' + JSON.stringify(after));

    expect(after.open).toBe(true);
    expect(after.expanded).toBe('true');
    expect(after.switchesOnScreen, 'both switches, at full size').toBe(2);
    expect(after.cadenceOnScreen, 'and the cadence').toBe(true);
    // The explanations survive the collapse. Glass carries the long refusal
    // here, which a phone could never have got from a tooltip.
    expect(Math.max(...after.notes)).toBeGreaterThan(80);
    // Over, not instead of: the pane behind it is the size it was.
    expect(after.entry).toBe(before.entry);
    expect(after.sheetBottom).toBeLessThanOrEqual(after.viewportHeight);
    expect(after.sheetTop).toBeGreaterThanOrEqual(0);
});

test('a switch inside the sheet still toggles once, and the bar follows', async ({ page }) => {
    test.setTimeout(180000);
    await openLoadedNavigator(page);
    await openBySubject(page);
    await page.locator('[data-action="reader-sheet"]').click();

    const before = await page.evaluate(() => ({
        checked: document.querySelector('[data-action="living-text"]').checked,
        summary: document.querySelector('.vnav-reader-state').textContent.trim()
    }));
    await page.locator('.vnav-switch:has([data-action="living-text"])').click();
    const after = await page.evaluate(() => ({
        checked: document.querySelector('[data-action="living-text"]').checked,
        summary: document.querySelector('.vnav-reader-state').textContent.trim(),
        stillOpen: document.querySelector('.vnav-reader-controls').classList.contains('is-open')
    }));

    // One press, one change — the label already forwards to the input, and a
    // re-render inside an open sheet may not lose the sheet.
    expect(after.checked).toBe(!before.checked);
    expect(after.summary).not.toBe(before.summary);
    expect(after.stillOpen, 'the sheet stays open to be used again').toBe(true);
});

test('moving in the panel closes it, rather than moving behind it', async ({ page }) => {
    test.setTimeout(180000);
    await openLoadedNavigator(page);
    await openBySubject(page);
    await page.locator('[data-action="reader-sheet"]').click();
    expect((await page.evaluate(footer)).open).toBe(true);

    // The sheet covers the pane. Backing out with it open would move a reader
    // somewhere they cannot see.
    await page.locator('[data-action="navigator-back"]').click();
    expect((await page.evaluate(footer)).open).toBe(false);
});

test('a desktop keeps the settings laid out, and never shows the bar', async ({ page }) => {
    test.setTimeout(180000);
    await openLoadedNavigator(page, { width: 1280, height: 800 });

    const desktop = await page.evaluate(() => {
        const nav = document.querySelector('.vnav');
        const bar = nav.querySelector('[data-action="reader-sheet"]');
        return {
            barShown: Boolean(bar) && getComputedStyle(bar).display !== 'none',
            switchesOnScreen: [...nav.querySelectorAll('.vnav-switch')]
                .filter(el => el.offsetParent !== null).length,
            sheetShown: getComputedStyle(nav.querySelector('.vnav-reader-sheet')).display !== 'none'
        };
    });
    // There is room here, so nothing is collapsed and nothing has to be asked
    // for. The bar is the phone's answer and stays the phone's.
    expect(desktop.barShown).toBe(false);
    expect(desktop.sheetShown).toBe(true);
    expect(desktop.switchesOnScreen).toBe(2);
});
