/**
 * Speaking to a live Current, in a real browser.
 *
 * The browser's own hearing is the one thing this cannot exercise: headless
 * Chromium has no speech service, so a fake `SpeechRecognition` with the events
 * the Web Speech API documents stands in for it. Everything else is real: the
 * built page, the Speak button, the grammar, the runtime holding and diving and
 * surfacing, the Chamber. What it holds:
 *
 *   - "wait, dive on event horizon" holds the reading, dives, and "go back"
 *     surfaces to the very atom the reader left;
 *   - words it cannot be sure of hold the reading and land in the box, and ask
 *     nothing;
 *   - a blocked microphone is said in words and does not cost the reader their
 *     place;
 *   - the reader is told where their voice goes before they press;
 *   - the microphone is let go of when the reader stops.
 *
 * NOT covered, and said so in docs/plans/LIVE-CURRENT.md: a real recogniser
 * in any browser.
 */
import { expect, test } from './fixtures.js';

const OPEN = '/live?voice=paced';

const shown = async page => (await page.locator('#atom-display').innerText()).replace(/\s+/gu, ' ').trim();
const status = page => page.locator('.live-controls__status');
const micLine = page => page.locator('.live-controls__mic');
const speak = page => page.locator('[data-live="listen"]');

const expectShown = (page, phrase, timeout = 12_000) =>
    expect.poll(() => shown(page).catch(() => ''), { timeout, message: `waiting to see “${phrase}”` }).toContain(phrase);

/** A recogniser the test drives, installed before the page loads. */
test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        const instances = [];
        class FakeRecognition {
            constructor() {
                this.started = false;
                this.stopped = false;
                this.aborted = false;
                instances.push(this);
            }
            start() {
                this.started = true;
                queueMicrotask(() => this.onstart?.({}));
            }
            stop() { this.stopped = true; }
            abort() { this.aborted = true; }
        }
        const last = () => instances[instances.length - 1];
        window.SpeechRecognition = FakeRecognition;
        window.webkitSpeechRecognition = FakeRecognition;
        window.__mic = {
            count: () => instances.length,
            open: () => instances.filter(item => item.started && !item.stopped && !item.aborted).length,
            interim: words => last().onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: words }], { isFinal: false })] }),
            say: words => last().onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: words }], { isFinal: true })] }),
            fail: error => last().onerror?.({ error })
        };
    });
});

async function start(page) {
    await page.goto(OPEN);
    await page.locator('.live-start').click();
    await expect(page.locator('#live-controls')).toBeVisible();
    await expectShown(page, 'A black hole is a region of space');
}

/** Press Speak and wait until the recogniser is listening. */
async function press(page) {
    const before = await page.evaluate(() => window.__mic.count());
    await speak(page).click();
    await expect.poll(() => page.evaluate(() => window.__mic.count())).toBe(before + 1);
    await expect(micLine(page)).toContainText('Listening');
}

const say = (page, words) => page.evaluate(spoken => window.__mic.say(spoken), words);

test('says where the voice goes before anyone presses, and offers Speak', async ({ page }) => {
    await start(page);
    // One line is in view before anyone presses; the rest is one tap away.
    await expect(page.locator('.live-controls__mic-note summary')).toBeVisible();
    await expect(page.locator('.live-controls__mic-note summary')).toContainText('may send your voice to your browser maker');
    await page.locator('.live-controls__mic-note summary').click();
    await expect(page.locator('#live-controls-mic-privacy')).toContainText('never receives audio');
    await expect(speak(page)).toBeVisible();
    expect(await page.evaluate(() => window.__mic.count())).toBe(0);
});

test('"wait, dive on event horizon" holds, dives, and "go back" surfaces to the very atom that was left', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await start(page);
    await expectShown(page, 'that nothing, not even light');

    await press(page);
    await expect(status(page)).toContainText('Held where you are');
    const heldAt = await shown(page);
    await page.evaluate(() => window.__mic.interim('wait dive'));
    await expect(micLine(page)).toContainText('Hearing: “wait dive”');
    // Held, and well inside the quiet that would end the utterance.
    await page.waitForTimeout(1_000);
    expect(await shown(page)).toBe(heldAt);

    await say(page, 'Wait — dive on event horizon');
    await expect(status(page)).toContainText('Diving');
    await expectShown(page, 'The event horizon is where the speed needed to escape');
    expect(await page.evaluate(() => window.__mic.open())).toBe(0);
    await expect(status(page)).toContainText('answered', { timeout: 20_000 });

    await press(page);
    await say(page, 'go back');
    await expect(status(page)).toContainText(/paced as if spoken/u);
    expect(await shown(page)).toBe(heldAt);
    await expectShown(page, 'Its boundary is called the event horizon', 20_000);
    expect(await page.evaluate(() => window.__mic.open())).toBe(0);
    expect(errors).toEqual([]);
});

test('"continue" carries on from where the press held it', async ({ page }) => {
    await start(page);
    await press(page);
    const heldAt = await shown(page);
    await say(page, 'continue');
    await expect(status(page)).toContainText(/paced as if spoken/u);
    await expect.poll(() => shown(page), { timeout: 12_000 }).not.toBe(heldAt);
});

test('words it cannot be sure of hold the reading, land in the box, and ask nothing', async ({ page }) => {
    await start(page);
    await press(page);
    await say(page, 'the horizon is interesting');
    await expect(status(page)).toContainText('Held where you are');
    await expect(page.locator('#live-controls-question')).toHaveValue('the horizon is interesting');
    await expect(micLine(page)).toContainText('Heard “the horizon is interesting”. Press Dive to ask it, or Resume.');
    await expect(page.getByRole('button', { name: 'Surface', exact: true })).toBeHidden();
    // The reader decides.
    await page.getByRole('button', { name: /Dive: ask about this place/u }).click();
    await expect(status(page)).toContainText('Diving');
});

test('a blocked microphone is said in words, and the reading carries on where it was', async ({ page }) => {
    await start(page);
    await press(page);
    await page.evaluate(() => window.__mic.fail('not-allowed'));
    await expect(micLine(page)).toContainText('The microphone is blocked');
    await expect(status(page)).toContainText(/paced as if spoken/u);
    await expect(speak(page)).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => window.__mic.open())).toBe(0);
});

test('Stop lets go of the microphone', async ({ page }) => {
    await start(page);
    await press(page);
    expect(await page.evaluate(() => window.__mic.open())).toBe(1);
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(page.locator('#live-controls')).toHaveCount(0);
    expect(await page.evaluate(() => window.__mic.open())).toBe(0);
});

test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('the Speak button is big enough to touch, and with the longest message and the disclosure open the bar stays under half the screen', async ({ page }) => {
        await start(page);
        const button = await speak(page).boundingBox();
        expect(button.height).toBeGreaterThanOrEqual(44);
        expect(button.width).toBeGreaterThanOrEqual(44);
        await press(page);
        await say(page, `${'the horizon is very interesting to me '.repeat(6)}`);
        await expect(micLine(page)).toContainText('Heard “');
        await page.locator('.live-controls__mic-note summary').click();
        const bar = await page.locator('#live-controls').boundingBox();
        expect(bar.y + bar.height).toBeLessThanOrEqual(844 + 1);
        expect(bar.height).toBeLessThan(844 / 2);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });
});
