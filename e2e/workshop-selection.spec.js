import { test, expect, openHomeNav } from './fixtures.js';


test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
});

async function openWorkshopWithSource(page) {
    await page.goto('/');
    await openHomeNav(page, 'workshop');
    // A phone opens on the Scene Stack; passage scoring is Full studio.
    await expect(page.locator('.scenes')).toBeVisible({ timeout: 30_000 });
    await page.locator('[data-sa="more"]').first().click();
    await page.getByRole('button', { name: /Full studio/ }).click();
    await expect(page.locator('.workshop-studio')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Sources', exact: true }).click();
    await page.getByRole('button', { name: 'Browse' }).click();
    await expect(page.locator('.sb-content-title')).toContainText(/Curated Archive · \d+ works/);
    await page.getByRole('searchbox', { name: 'Search the source library' }).fill('Middlemarch');
    await expect(page.locator('.sb-item')).toHaveCount(1);
    await page.getByRole('button', { name: /Open chapters of Middlemarch/ }).click();
    await expect(page.locator('.sb-contents')).toBeVisible();
    await expect.poll(() => page.locator('.sb-chapter-item').count()).toBeGreaterThan(1);
    await page.locator('.sb-chapter-add').first().click();
    await expect(page.locator('.source-browser-overlay')).toBeHidden({ timeout: 10_000 });
    await expect(page.locator('#visual-score-text')).toBeVisible();
}

/**
 * WHERE THE TEXT IS, ONCE IT HAS STOPPED MOVING.
 *
 * `html { scroll-behavior: smooth }` animates every programmatic scroll of the
 * document, including the one Playwright makes to bring a button into view
 * before clicking it. Clicking Score after the Assets steps could leave that
 * animation still running when the test measured `#visual-score-text` and
 * dispatched the touch at coordinates taken from the measurement; by touchEnd
 * the text had moved on by some thirty pixels, the tap landed in the box's
 * padding or on the header above it, and Chromium collapsed the selection,
 * which left nothing for `captureVisualScoreSelection` to find. The visual
 * lane never showed this only because its touch landed off-screen.
 *
 * So the touch is placed only after the text has held one position for a
 * stretch longer than the animation takes to begin. Two quiet frames, which
 * is Playwright's own stability check, are not enough: the scroll a click
 * starts can wait a few frames before its first step.
 */
async function settledText(page) {
    await page.waitForFunction(() => {
        const top = document.querySelector('#visual-score-text')?.getBoundingClientRect().top;
        const now = performance.now();
        const seen = window.__riseSettledText;
        if (!seen || seen.top !== top) {
            window.__riseSettledText = { top, since: now };
            return false;
        }
        if (now - seen.since < 150) return false;
        window.__riseSettledText = null;
        return true;
    });
}

/**
 * SELECT THE FIRST CHARACTERS BY TOUCH, WITH THE FINGER ON THEM.
 *
 * A finger lifted where it landed is a tap, and Chromium follows a tap with
 * its own mousedown, mouseup and click at that point. A tap on the selected
 * characters leaves the selection alone; a tap anywhere else in the text
 * collapses it at mouseup; and a tap on the row of lane tabs, which is sticky
 * and sits over the text once the studio has scrolled, switches lanes and
 * re-renders the text under the selection. In each case
 * `captureVisualScoreSelection` runs, finds the selection collapsed and the
 * palette never opens. The touch used to land at a fixed offset from the
 * text's box, which is on the selected characters only when the studio's
 * smooth scroll has come to rest at one particular offset — it came to rest
 * at 219 or 572 on this machine depending on timing — and the visual lane's
 * tap landed off-screen altogether, so only the audio lane could show it.
 *
 * So the finger goes where the selection will be: the first line is brought
 * into the clear, instantly, the layout is left to settle, and the touch
 * lands at the centre of the characters this then selects, once nothing is
 * found covering them.
 */
async function touchSelectFirstCharacters(page, cdp, chars) {
    await page.evaluate(() => {
        const root = document.querySelector('#visual-score-text');
        const first = document.createTreeWalker(root, NodeFilter.SHOW_TEXT).nextNode();
        const range = document.createRange();
        range.selectNodeContents(first);
        const line = range.getClientRects()[0];
        let scroller = root.parentElement;
        while (scroller && !(/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)
            && scroller.scrollHeight > scroller.clientHeight)) scroller = scroller.parentElement;
        (scroller || document.scrollingElement).scrollBy({ top: line.top - innerHeight / 2, behavior: 'instant' });
    });
    await settledText(page);
    const point = await page.evaluate((n) => {
        const root = document.querySelector('#visual-score-text');
        const first = document.createTreeWalker(root, NodeFilter.SHOW_TEXT).nextNode();
        const range = document.createRange();
        range.setStart(first, 0);
        range.setEnd(first, Math.min(n, first.nodeValue.length));
        const rect = range.getClientRects()[0];
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return { x, y, covered: hit && !root.contains(hit) ? `${hit.tagName}.${hit.className}` : null };
    }, chars);
    expect(point.covered, 'nothing may cover the characters the finger lands on').toBeNull();

    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
    await page.evaluate((n) => {
        const root = document.querySelector('#visual-score-text');
        const first = document.createTreeWalker(root, NodeFilter.SHOW_TEXT).nextNode();
        const range = document.createRange();
        range.setStart(first, 0);
        range.setEnd(first, Math.min(n, first.nodeValue.length));
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }, chars);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('touch selection opens the passage palette and assigns without a synthetic mouseup', async ({ page }) => {
    test.setTimeout(90_000);
    await openWorkshopWithSource(page);

    await page.getByRole('button', { name: 'Assets', exact: true }).click();
    const presentation = page.locator('#studio-visual-presentation');
    await presentation.scrollIntoViewIfNeeded();
    await expect(presentation).toBeVisible();
    await expect(presentation).toContainText('Presentation');
    // Presentation belongs to its own panel, not to the Inspector. The check
    // used to name #studio-visual-inspector, which the contextual Inspector
    // now renders only while a visual is selected — so the assertion was
    // passing through an element that was simply absent. The claim is about
    // markup rather than sight: on a phone the Inspector is a surface the
    // reader opens, so it is legitimately hidden here.
    await expect(page.locator('#studio-contextual-inspector')).toHaveCount(1);
    await expect(page.locator('#studio-contextual-inspector')).not.toContainText('Presentation');
    await page.getByRole('button', { name: 'Score', exact: true }).click();

    const cdp = await page.context().newCDPSession(page);
    await touchSelectFirstCharacters(page, cdp, 24);

    const palette = page.locator('.studio-passage-popover');
    await expect(palette).toBeVisible({ timeout: 5_000 });
    await expect(palette).toContainText('Selected passage');
    await palette.locator('[data-passage-asset-picker]').selectOption('procedural:klee');
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString().length || 0))
        .toBeGreaterThan(0);
    await palette.getByRole('button', { name: 'Assign visual' }).click();

    await expect(page.locator('.visual-score-mark')).toHaveCount(1);
    await expect(page.locator('.studio-passage-popover.is-confirmation')).toBeVisible();
    await expect(page.locator('.visual-score-activation-notice')).toContainText('Scored visuals activated');

    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: 'Assets', exact: true }).click();
    await page.getByRole('tab', { name: 'Audio', exact: true }).click();
    await page.getByRole('option', { name: /Aurora, soundscape/ }).click();
    await page.getByRole('button', { name: 'Score', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Audio', exact: true })).toHaveAttribute('aria-selected', 'true');

    await touchSelectFirstCharacters(page, cdp, 18);

    await expect(page.locator('.audio-passage-popover')).toBeVisible({ timeout: 5_000 });
    await page.locator('.audio-passage-popover').getByRole('button', { name: 'Assign audio' }).click();
    await expect(page.locator('.audio-score-mark')).toHaveCount(1);
    await page.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('tab', { name: 'Combined', exact: true }).click();
    await expect(page.locator('.audio-score-lane')).toBeVisible();
    await expect(page.locator('[aria-label="Visual assignments"]')).toBeVisible();
});

test('the audio lane offers a passage picker on selection, as the visual lane does', async ({ page }) => {
    test.setTimeout(90_000);
    await openWorkshopWithSource(page);
    await page.getByRole('button', { name: 'Score', exact: true }).click();
    await page.getByRole('tab', { name: 'Audio', exact: true }).click();

    const cdp = await page.context().newCDPSession(page);
    await touchSelectFirstCharacters(page, cdp, 20);

    // The point: choosing what to assign is possible from the selection itself.
    // Before this, the audio popover offered only "Browse audio", so the lane
    // could not be scored without first visiting the Assets panel.
    const palette = page.locator('.audio-passage-popover');
    await expect(palette).toBeVisible({ timeout: 5_000 });
    const picker = palette.locator('[data-passage-audio-picker]');
    await expect(picker).toBeVisible();
    await picker.selectOption({ index: 1 });
    await palette.getByRole('button', { name: 'Assign audio' }).click();
    await expect(page.locator('.audio-score-mark')).toHaveCount(1);
});

test('choosing from the passage picker does not leave the Combined view', async ({ page }) => {
    test.setTimeout(90_000);
    await openWorkshopWithSource(page);
    await page.getByRole('button', { name: 'Score', exact: true }).click();
    await page.getByRole('tab', { name: 'Combined', exact: true }).click();

    const cdp = await page.context().newCDPSession(page);
    await touchSelectFirstCharacters(page, cdp, 20);

    const palette = page.locator('.studio-passage-popover');
    await expect(palette).toBeVisible({ timeout: 5_000 });
    await palette.locator('[data-passage-asset-picker], [data-passage-audio-picker]')
        .first().selectOption({ index: 1 });

    // Picking what to assign is not a request to change tab; it used to move
    // the reader to Visual mid-selection.
    await expect(page.getByRole('tab', { name: 'Combined', exact: true }))
        .toHaveAttribute('aria-selected', 'true');
});
