/**
 * THE ONE BUTTON THE SCREEN EXISTS TO OFFER.
 *
 * The Orbital was sized for a tall screen. When the stance row was added
 * above the ring the column grew to 1223px, `body` sets `overflow: hidden`,
 * and the column was centred inside `min-height: 100vh` — so Begin sat
 * below the floor of every common laptop with nothing able to scroll to it.
 * It cleared a 1080p screen by six pixels, which is how it reached release.
 *
 * Height is the constraint, so height is what this asserts, and it asserts
 * the thing a reader actually does: put a cursor on the button and press.
 */
import { test, expect } from '@playwright/test';

const GATE_SESSION = {
    code: 'rise2025',
    name: 'Orbital Reach',
    vault: null,
    timestamp: Date.now()
};
const SEED = {
    text: 'Light enters form and returns through measure.'.repeat(4),
    textSource: 'Orbital Reach',
    origin: null
};

// Common desktop and laptop shapes at 100% zoom, plus a phone.
const VIEWPORTS = [
    { width: 1920, height: 1080 },
    { width: 1920, height: 955 },
    { width: 1536, height: 864 },
    { width: 1366, height: 768 },
    { width: 1280, height: 800 },
    { width: 390, height: 844 }
];

test('Begin stays on screen and pressable at every common height', async ({ page }) => {
    await page.addInitScript(({ gate, seed }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
    }, { gate: GATE_SESSION, seed: SEED });
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('#begin-btn')).toBeVisible({ timeout: 20_000 });

    for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(300);

        const shape = `${viewport.width}x${viewport.height}`;
        const seen = await page.evaluate(() => {
            const button = document.querySelector('#begin-btn');
            const box = button.getBoundingClientRect();
            // What a cursor at the button's centre would actually strike —
            // the same test the browser runs for a hand, with no retry.
            const hit = document.elementFromPoint(
                box.left + box.width / 2,
                Math.min(Math.max(box.top + box.height / 2, 1), window.innerHeight - 1)
            );
            return {
                top: Math.round(box.top),
                bottom: Math.round(box.bottom),
                viewportHeight: window.innerHeight,
                pressable: hit === button || button.contains(hit),
                struck: hit?.id || hit?.className?.toString?.().slice(0, 30) || 'nothing'
            };
        });

        expect(seen.bottom, `Begin is ${seen.bottom - seen.viewportHeight}px below the floor at ${shape}`)
            .toBeLessThanOrEqual(seen.viewportHeight);
        expect(seen.top, `Begin is clipped off the top at ${shape}`).toBeGreaterThanOrEqual(0);
        expect(seen.pressable, `at ${shape} a press on Begin lands on ${seen.struck}`).toBe(true);
    }
});

test('the ring stays an equilateral triangle at every size', async ({ page }) => {
    await page.addInitScript(({ gate, seed }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
    }, { gate: GATE_SESSION, seed: SEED });
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('#begin-btn')).toBeVisible({ timeout: 20_000 });

    // The ring scales by radius alone, so 120° separation is preserved by
    // construction — this holds the construction to it.
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }]) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(300);
        const ratio = await page.evaluate(() => {
            const centre = (selector) => {
                const r = document.querySelector(selector).getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            };
            const points = ['.orbit-temporal', '.orbit-audio', '.orbit-visual'].map(centre);
            const span = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
            const sides = [
                span(points[0], points[1]),
                span(points[1], points[2]),
                span(points[2], points[0])
            ];
            return Math.max(...sides) / Math.min(...sides);
        });
        expect(ratio, `the ring is lopsided at ${viewport.width}x${viewport.height}`)
            .toBeLessThan(1.05);
    }
});

/**
 * NO WORD RUNS DOWN TWO LINES ON ANY ORB.
 *
 * The status a satellite states used to set `overflow-wrap: anywhere`, which
 * gave Procedu/ral and Collec/tions — a disc reading a word down two lines is
 * not reading a word. The phone breakpoint had fixed it for itself and left
 * the base rule alone, so this went unseen on every desktop.
 *
 * A stylesheet assertion could only ever check the spelling of the rule that
 * happens to be in the file. This measures the rendered line boxes: each word
 * is walked with a Range and asked how many lines its rects occupy.
 */
// The longest statuses the orbital can actually state, from getVisualStatus
// and getAudioStatus: the family names, the roughest glyph, the widest
// attractor and genesis presets, and the named soundscapes.
const LONGEST_STATUSES = [
    '◈ Collections', '◈ Procedural', '◈ Personal',
    '○ Focals · Rosa Mystica', '∮ Attractor · Halvorsen',
    '✎ Genesis · Gravitational', 'Faded Signal', 'Gregorian', 'Znamenny'
];

test('no orb breaks a word across lines, at any size', async ({ page }) => {
    await page.addInitScript(({ gate, seed }) => {
        localStorage.setItem('rise-beta-session', JSON.stringify(gate));
        localStorage.setItem('rise_orbital_text_v1', JSON.stringify(seed));
    }, { gate: GATE_SESSION, seed: SEED });
    await page.goto('/');
    await page.locator('[data-nav="chamber"]').first().click();
    await expect(page.locator('#begin-btn')).toBeVisible({ timeout: 20_000 });

    const broken = [];
    for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(300);

        const split = await page.evaluate((phrases) => {
            const found = [];
            const statuses = [...document.querySelectorAll('.orbit-node .orbit-status')];
            const original = statuses.map(n => n.textContent);

            // The rule has to hold for the longest status the app can state,
            // not merely for whichever one happens to be selected now — that
            // is how this went unseen. Every orb is made to wear each of them.
            const trials = [...phrases, ...original];
            for (const phrase of trials) {
                statuses.forEach(n => { n.textContent = phrase; });
                for (const node of document.querySelectorAll('.orbit-node .orbit-status, .orbit-node .orbit-label')) {
                const text = node.firstChild;
                if (!text || text.nodeType !== Node.TEXT_NODE) continue;
                const value = text.textContent;
                // Walk each run of non-space characters and ask the layout
                // how many line boxes it was laid across.
                for (const match of value.matchAll(/\S+/g)) {
                    if (match[0].length < 2) continue;
                    const range = document.createRange();
                    range.setStart(text, match.index);
                    range.setEnd(text, match.index + match[0].length);
                    const tops = new Set([...range.getClientRects()]
                        .filter(r => r.width > 0)
                        .map(r => Math.round(r.top)));
                    if (tops.size > 1) found.push({ word: match[0], lines: tops.size, phrase });
                }
                }
            }
            statuses.forEach((n, i) => { n.textContent = original[i]; });
            return found;
        }, LONGEST_STATUSES);

        for (const hit of split) {
            broken.push(`${viewport.width}x${viewport.height}: "${hit.word}" over ${hit.lines} lines (in "${hit.phrase}")`);
        }
    }

    expect(broken, broken.join('; ')).toEqual([]);
});
