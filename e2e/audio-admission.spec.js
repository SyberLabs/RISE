import { expect, test } from '@playwright/test';

/**
 * The one suite that plays by the browser's rules.
 *
 * Every other spec runs with `--autoplay-policy=no-user-gesture-required`,
 * because a hundred tests about text and layout should not each have to
 * stage a click to get a clock. The cost of that flag is that the suite
 * removed the exact rule production enforces — so a reading could open
 * into a suspended context, say nothing, and stay green for months.
 *
 * This project drops the flag. It does not assert that speakers moved;
 * headless CI is a poor judge of that. It asserts the invariant the app
 * was missing:
 *
 *     a reading may not begin until the context is running,
 *     and a gesture is what makes it run.
 */

const READING = '/keystone/metamorphoses';

/** What the page can tell us about its own audio admission. */
const admission = page => page.evaluate(() => {
    const engine = window.__RISE_TEST__?.getAudioEngine?.() ?? null;
    return {
        hasEngine: Boolean(engine),
        context: engine?.context?.state ?? 'none',
        audible: engine?.audible === true
    };
});

test.describe('audio admission, with the browser policy left on', () => {
    test('a cold durable link does not open a reading into a dead context', async ({ page }) => {
        // THE BUG THIS EXISTS FOR. Reaching /keystone/x through the app
        // keeps the document alive, and with it whatever unlock an
        // earlier click won. Loading that same URL cold is a new
        // document with no activation at all — and a returning reader
        // passes the threshold without clicking, because admission is
        // remembered. So the reading could begin with the context
        // suspended and narrate in silence.
        await page.goto(READING);
        await page.waitForLoadState('networkidle');

        const before = await admission(page);
        if (before.hasEngine && before.context !== 'none') {
            // Whatever else is true, an engine that is not running must
            // not be carrying a reading that believes it is speaking.
            if (!before.audible) {
                const streaming = await page.locator('#chamber-display')
                    .isVisible()
                    .catch(() => false);
                expect(
                    streaming,
                    'a reading is streaming while the audio context is ' + before.context
                ).toBe(false);
            }
        }
    });

    test('a gesture is what makes the context run', async ({ page }) => {
        await page.goto('/try-rise');
        await page.waitForLoadState('networkidle');

        const cold = await admission(page);
        expect(cold.audible, 'audible before anyone touched anything').toBe(false);

        // One real gesture, dispatched as a trusted input by the driver.
        await page.locator('body').click({ position: { x: 5, y: 5 } });
        await page.waitForTimeout(500);

        const warm = await admission(page);
        if (warm.hasEngine) {
            expect(
                ['running', 'suspended'].includes(warm.context),
                `context after a gesture: ${warm.context}`
            ).toBe(true);
        }
    });
});
