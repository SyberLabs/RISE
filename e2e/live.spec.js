/**
 * The live Current, in a real browser.
 *
 * Everything here runs on the deterministic provider and the silent, paced
 * voice (`?voice=paced`), so it needs no network, no key and no audio device,
 * and it proves the runtime and the host, not a provider. What it holds:
 *
 *   - the canonical flow, start to finish: ask, read, interrupt, Dive, Surface,
 *     carry on from the same atom, stop;
 *   - on a phone as well as a desktop;
 *   - every degradation the host promises (reduced motion, no WebGL2, no way to
 *     speak or listen, a voice that fails, a hidden tab), each observed and not
 *     assumed;
 *   - sync between what is shown and what is said, measured against a recorded
 *     error budget.
 *
 * The error budget is the plan's (docs/plans/LIVE-CURRENT.md §11): a segment's
 * first atom within 100 ms of the voice starting it, every other atom within
 * 250 ms of where the voice was. Measured once on the developer machine,
 * headless Chromium: boundaries within 33 ms, in-segment within 60 ms.
 */
import { compileRiseCurrent } from '../src/core/rise-current.js';
import { mapAtoms } from '../src/live/atom-map.js';
import { BLACK_HOLES } from '../src/live/fixtures/black-holes.js';
import { describePerception } from '../src/live/perception.js';
import { expect, test } from './fixtures.js';

const OPEN = '/live?host=prompt&voice=paced';
const MS_PER_CHAR = 62; // the synthetic voice's pace

const BOUNDARY_BUDGET_MS = 100;
const IN_SEGMENT_BUDGET_MS = 250;

/** The words on screen: the atom, and nothing of the Chamber's own controls or clock. */
const shown = async page => (await page.locator('#atom-display').innerText()).replace(/\s+/gu, ' ').trim();
const status = page => page.locator('.live-controls__status');

/** Errors the page raised. A live Current must not raise any. */
function watchErrors(page) {
    const errors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
        // The shared signed-out account fixture deliberately returns the real
        // protocol's 401. Chromium reports that response in the console; it is
        // not a Live runtime error. Keep every other endpoint/status/error.
        const signedOutAccount = message.location().url === 'https://syberlabs.io/admin/api/v1/account'
            && message.text() === 'Failed to load resource: the server responded with a status of 401 (Unauthorized)';
        if (message.type() === 'error' && !signedOutAccount) errors.push(`console: ${message.text().slice(0, 200)}`);
    });
    return errors;
}

test('expected account denial leaves unrelated HTTP and runtime errors observable', async ({ page }) => {
    const errors = watchErrors(page);
    const accountResponse = page.waitForResponse(response => response.url() === 'https://syberlabs.io/admin/api/v1/account');
    await page.goto(OPEN);
    const denied = await accountResponse;
    expect(denied.status()).toBe(401);
    expect(await denied.json()).toEqual({ version: 1, error: 'signin_required' });
    await expect(page.getByRole('link', { name: 'Staff sign in to SyberLabs' })).toBeVisible();
    expect(errors).toEqual([]);
    await page.route('**/api/conformance-denial', route => route.fulfill({ status: 401, body: 'unrelated denial' }));
    await page.evaluate(async () => {
        await fetch('/api/conformance-denial');
        console.error('Unrelated runtime error negative control');
    });
    await expect.poll(() => errors.length).toBe(2);
    expect(errors).toContain('console: Failed to load resource: the server responded with a status of 401 (Unauthorized)');
    expect(errors).toContain('console: Unrelated runtime error negative control');
});

async function start(page, url = OPEN) {
    await page.goto(url);
    await page.locator('.live-start').click();
    await expect(page.locator('#live-controls')).toBeVisible();
}

const expectShown = (page, phrase, timeout = 12_000) =>
    expect.poll(() => shown(page).catch(() => ''), { timeout, message: `waiting to see “${phrase}”` }).toContain(phrase);

test.describe('the canonical flow', () => {
    test('asks, reads, is interrupted, dives, surfaces, and carries on from the same atom', async ({ page }) => {
        const errors = watchErrors(page);
        await start(page, `${OPEN}&measure=1`);
        await expectShown(page, 'A black hole is a region of space');
        // From the click to the first atom, on the page’s own clock. Includes the mock’s ~220 ms to
        // commit its first segment, loading what the reading needs, and mounting the Chamber.
        const firstVisibleMs = Math.round(await page.evaluate(() => window.__riseLive.atoms()[0].at - window.__riseLive.startedAt()));
        test.info().annotations.push({ type: 'first-visible-ms', description: String(firstVisibleMs) });
        // Not a budget on the runtime (that is asserted on a virtual clock): a guard against a
        // regression that makes the reader wait for the slowest layer.
        expect(firstVisibleMs).toBeLessThan(4_000);
        await expect(status(page)).toContainText(/paced as if spoken/u);

        await expectShown(page, 'that nothing, not even light');
        await page.getByRole('button', { name: 'Interrupt', exact: true }).click();
        await expect(status(page)).toContainText('Held where you are');
        const heldAt = await shown(page);
        await page.waitForTimeout(2_500);
        expect(await shown(page)).toBe(heldAt);

        await page.locator('#live-controls-question').fill('dive on event horizon');
        await page.getByRole('button', { name: /Dive: ask about this place/u }).click();
        await expect(status(page)).toContainText('Diving');
        await expectShown(page, 'The event horizon is where the speed needed to escape');
        // A question asked now is marked as written now, by the model, and as leaving the parent alone.
        await expect(page.locator('.live-passage__origin')).toContainText('Written when you asked, by Scripted answer (mock). It does not change what you left.');
        await expect(page.getByRole('button', { name: 'Surface', exact: true })).toBeVisible();
        await expect(status(page)).toContainText('answered', { timeout: 20_000 });

        await page.getByRole('button', { name: 'Surface', exact: true }).click();
        await expect(status(page)).toContainText(/paced as if spoken/u);
        // The parent is where the reader left it: the very atom, not the one before or after.
        await expectShown(page, 'that nothing, not even light');
        expect(await shown(page)).toBe(heldAt);
        await expectShown(page, 'Its boundary is called the event horizon', 20_000);

        await page.getByRole('button', { name: 'Stop', exact: true }).click();
        await expect(page.locator('.live-start')).toBeVisible();
        await expect(page.locator('#live-controls')).toHaveCount(0);
        expect(new URL(page.url()).pathname).toBe('/live');
        expect(errors).toEqual([]);
    });

    test('keeps a transcript that says what has been said, without sight or sound', async ({ page }) => {
        await start(page);
        await expectShown(page, 'that nothing, not even light');
        await page.locator('.live-controls__transcript summary').click();
        const lines = page.locator('.live-controls__lines li');
        await expect(lines.first()).toHaveText(BLACK_HOLES.segments[0].text);
        // Only what has been committed; the status line is the one live region.
        await expect(page.locator('.live-controls__transcript')).not.toHaveAttribute('aria-live', /./u);
        await expect(status(page)).toHaveAttribute('role', 'status');
    });

    test('says plainly that it has nothing prepared, when asked something it has no answer for', async ({ page }) => {
        await page.goto(OPEN);
        await page.locator('#live-prompt').fill('What is the airspeed of an unladen swallow?');
        await page.locator('.live-start').click();
        await expect(page.locator('#live-controls')).toBeVisible();
        await expectShown(page, 'This demonstration can only explain black holes.');
        await page.getByRole('button', { name: 'Stop', exact: true }).click();
    });

    test('refuses an empty prompt in words, and does not start', async ({ page }) => {
        await page.goto(OPEN);
        await page.locator('#live-prompt').fill('   ');
        await page.locator('.live-start').click();
        await expect(page.locator('.live-error')).toContainText('Ask something first.');
        await expect(page.locator('#live-controls')).toHaveCount(0);
    });
});

test.describe('what is known about the passage the reader is in', () => {
    test('follows the reading: its condition reaches the imagery, its sources are shown as sources, and none is said to be none', async ({ page }) => {
        test.setTimeout(90_000);
        const errors = watchErrors(page);
        await start(page);
        await expectShown(page, 'A black hole is a region of space');
        await page.locator('.live-controls__passage summary').click();
        const sources = page.locator('.live-passage__sources');
        const condition = page.locator('.live-passage__condition');

        // The opening passage cites nothing, and says so; it is meant to be low in motion, and the
        // attractor beneath it was given exactly the pace and brightness that condition maps to.
        await expect(sources).toHaveText('No source was given for this passage.');
        await expect(condition).toContainText('Motion: low');
        await expect(condition).toContainText('Solemnity: medium');
        const attractor = page.locator('.chamber-attractor').last();
        await expect(attractor).toHaveAttribute('data-attractor-speed', '0.8');
        const firstIntensity = Number(await attractor.getAttribute('data-attractor-intensity'));
        expect(firstIntensity).toBeCloseTo(0.558, 2);

        // The passage about the first image of a black hole cites the paper, as supplied, with a link.
        await expectShown(page, 'In 2019, the Event Horizon Telescope', 30_000);
        await expect(sources).toContainText('Provided with the answer');
        await expect(sources).toContainText('The Shadow of the Supermassive Black Hole');
        const link = sources.locator('a');
        await expect(link).toHaveAttribute('href', 'https://doi.org/10.3847/2041-8213/ab0ec7');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(condition).toContainText('Expansiveness: high');

        // The gravitational-wave passage is the same authored visual, moving faster.
        await expectShown(page, 'In 2015, detectors on Earth', 30_000);
        await expect(page.locator('.chamber-attractor').last()).toHaveAttribute('data-attractor-speed', '1.3');
        await expect(condition).toContainText('Motion: high');
        expect(errors).toEqual([]);
    });
});

test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('runs the same flow, and the controls fit, are reachable and leave the words alone', async ({ page }) => {
        const errors = watchErrors(page);
        await start(page);
        await expectShown(page, 'that nothing, not even light', 15_000);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);

        const box = await page.locator('#live-controls').boundingBox();
        expect(box.y + box.height).toBeLessThanOrEqual(844 + 1);
        // The bar takes the bottom of the screen and no more than a third of it.
        expect(box.height).toBeLessThan(844 / 3);
        for (const name of ['Interrupt', 'Stop']) {
            const button = await page.getByRole('button', { name, exact: true }).boundingBox();
            expect(button.height, `${name} is big enough to touch`).toBeGreaterThanOrEqual(44);
            expect(button.width).toBeGreaterThanOrEqual(44);
        }

        await page.getByRole('button', { name: 'Interrupt', exact: true }).click();
        await page.locator('#live-controls-question').fill('dive on event horizon');
        await page.getByRole('button', { name: /Dive: ask about this place/u }).click();
        await expectShown(page, 'The event horizon is where');
        await page.getByRole('button', { name: 'Surface', exact: true }).click();
        await expectShown(page, 'that nothing, not even light');
        expect(errors).toEqual([]);
    });
});

test.describe('when the device cannot do what a Current would like', () => {
    test.describe('reduced motion', () => {
        test('says so, still reads, and the imagery is actually still (measured, not assumed)', async ({ page }) => {
            const errors = watchErrors(page);
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.goto(OPEN);
            await expect(page.locator('.live-notes')).toContainText('Reduced motion is on');
            await page.locator('.live-start').click();
            await expectShown(page, 'A black hole is a region of space');
            await page.waitForTimeout(1_500);
            // The top of the screen holds imagery and no words.
            const clip = { x: 0, y: 0, width: 1280, height: 240 };
            const a = await page.screenshot({ clip });
            await page.waitForTimeout(1_500);
            const b = await page.screenshot({ clip });
            expect(Buffer.compare(a, b), 'imagery moved under reduced motion').toBe(0);
            expect(errors).toEqual([]);
        });
    });

    test('with motion allowed the same imagery does move, so the check above can fail', async ({ page }) => {
        await start(page);
        await expectShown(page, 'A black hole is a region of space');
        await page.waitForTimeout(1_500);
        const clip = { x: 0, y: 0, width: 1280, height: 240 };
        const a = await page.screenshot({ clip });
        await page.waitForTimeout(1_500);
        const b = await page.screenshot({ clip });
        expect(Buffer.compare(a, b)).not.toBe(0);
    });

    test('without WebGL2 it says what that costs, and still reads', async ({ page }) => {
        const errors = watchErrors(page);
        await page.addInitScript(() => {
            const original = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function getContext(kind, ...rest) {
                return kind === 'webgl2' ? null : original.call(this, kind, ...rest);
            };
        });
        await page.goto(OPEN);
        await expect(page.locator('.live-notes')).toContainText('Hardware graphics are unavailable');
        await page.locator('.live-start').click();
        await expectShown(page, 'A black hole is a region of space');
        await expectShown(page, 'that nothing, not even light');
        expect(errors).toEqual([]);
    });

    test('with no way to speak to it, says to type, and typing works', async ({ page }) => {
        await page.addInitScript(() => {
            delete window.SpeechRecognition;
            delete window.webkitSpeechRecognition;
            Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
        });
        await page.goto(OPEN);
        await expect(page.locator('.live-notes')).toContainText('Speaking to interrupt is unavailable here. Type instead.');
        await page.locator('.live-start').click();
        await expectShown(page, 'A black hole is a region of space');
        await expect(page.locator('[data-live="listen"]')).toBeHidden();
        await page.locator('#live-controls-question').fill('dive on event horizon');
        await page.locator('#live-controls-question').press('Enter');
        await expect(status(page)).toContainText('Diving');
        await expectShown(page, 'The event horizon is where');
    });

    test('with a voice that fails, says the voice stopped and carries on at its own pace', async ({ page }) => {
        const errors = watchErrors(page);
        await page.addInitScript(() => {
            class Utterance { constructor(text) { this.text = text; } }
            const fake = {
                getVoices: () => [{ name: 'Fake', lang: 'en' }],
                addEventListener() {}, removeEventListener() {},
                speak(utterance) { setTimeout(() => utterance.onerror?.({ error: 'synthesis-failed' }), 40); },
                cancel() {}, pause() {}, resume() {}
            };
            Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
            window.SpeechSynthesisUtterance = Utterance;
        });
        await start(page, '/live?host=prompt&voice=browser');
        await expect(status(page)).toContainText('The voice stopped', { timeout: 8_000 });
        await expectShown(page, 'A black hole is a region of space');
        // Not stuck: the reading goes on without the voice.
        await expectShown(page, 'that nothing, not even light', 15_000);
        await expectShown(page, 'Its boundary is called the event horizon', 25_000);
        expect(errors.filter(error => !/synthesis-failed/u.test(error))).toEqual([]);
    });

    test('a hidden tab holds the reading and the voice, and a visible one carries on', async ({ page }) => {
        await start(page);
        await expectShown(page, 'A black hole is a region of space');
        const hide = hidden => page.evaluate(value => {
            Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (value ? 'hidden' : 'visible') });
            document.dispatchEvent(new Event('visibilitychange'));
        }, hidden);
        await hide(true);
        const held = await shown(page);
        await page.waitForTimeout(9_000);
        expect(await shown(page)).toBe(held);
        await hide(false);
        await expectShown(page, 'that nothing, not even light', 15_000);
    });
});

test.describe('sync between what is shown and what is said', () => {
    test('stays inside the recorded error budget, at segment boundaries and inside segments', async ({ page }) => {
        test.setTimeout(75_000);
        await page.goto(`${OPEN}&measure=1`);
        await page.locator('.live-start').click();
        await expect.poll(
            () => page.evaluate(() => window.__riseLive?.journal().filter(e => e.type === 'speech.end' && e.role === 'main').length ?? 0),
            { timeout: 60_000 }
        ).toBeGreaterThanOrEqual(3);

        const { journal, atoms } = await page.evaluate(() => ({
            journal: window.__riseLive.journal().filter(e => e.role === 'main' && e.type === 'speech.start'),
            atoms: window.__riseLive.atoms().filter(a => a.role === 'main')
        }));
        const segments = BLACK_HOLES.segments.map(({ id, text }) => ({ id, text }));
        const session = compileRiseCurrent({
            schema: 'rise.current.v1', id: 'sync', title: 'Sync', origin: { kind: 'human', name: 'Tester' }, segments
        });
        const map = mapAtoms(session.atoms, segments);
        const startedAt = Object.fromEntries(journal.map(entry => [entry.segmentId, entry.at]));

        const boundary = [];
        const inside = [];
        for (const atom of atoms) {
            const entry = map[atom.index];
            if (!entry || entry.seam || !entry.segmentId || startedAt[entry.segmentId] === undefined) continue;
            const error = atom.at - (startedAt[entry.segmentId] + entry.start * MS_PER_CHAR);
            (entry.start === 0 ? boundary : inside).push(error);
        }
        test.info().annotations.push({
            type: 'sync-error-ms',
            description: `boundary ${boundary.map(Math.round)} | inside ${inside.map(Math.round)}`
        });
        expect(boundary.length).toBeGreaterThanOrEqual(3);
        expect(inside.length).toBeGreaterThanOrEqual(3);
        for (const error of boundary) expect(Math.abs(error)).toBeLessThanOrEqual(BOUNDARY_BUDGET_MS);
        for (const error of inside) expect(Math.abs(error)).toBeLessThanOrEqual(IN_SEGMENT_BUDGET_MS);
    });
});

test.describe('what it costs the browser', () => {
    test('never holds the main thread, and drops no frames, through a whole reading with a Dive', async ({ page }) => {
        test.setTimeout(75_000);
        await page.goto(`${OPEN}&measure=1`);
        await page.evaluate(() => {
            window.__long = [];
            window.__frames = [];
            new PerformanceObserver(list => {
                for (const entry of list.getEntries()) window.__long.push(Math.round(entry.duration));
            }).observe({ entryTypes: ['longtask'] });
            let last = performance.now();
            const tick = now => { window.__frames.push(now - last); last = now; requestAnimationFrame(tick); };
            requestAnimationFrame(tick);
        });
        await page.locator('.live-start').click();
        await expectShown(page, 'that nothing, not even light');
        await page.locator('#live-controls-question').fill('dive on event horizon');
        await page.locator('#live-controls-question').press('Enter');
        await expectShown(page, 'The event horizon is where');
        await page.waitForTimeout(6_000);
        await page.getByRole('button', { name: 'Surface', exact: true }).click();
        await page.waitForTimeout(20_000);
        const { long, frames } = await page.evaluate(() => ({ long: window.__long, frames: window.__frames.slice(5) }));
        const worstFrame = Math.round(Math.max(...frames));
        test.info().annotations.push({
            type: 'main-thread',
            description: `long tasks ${long.length} (longest ${Math.max(0, ...long)} ms) | ${frames.length} frames, worst ${worstFrame} ms`
        });
        // Nothing the runtime does may stall the page. Measured: two long tasks, the longest 52 ms,
        // and a worst frame of 50 ms; the thresholds leave room for a slower machine and still
        // catch a real stall.
        expect(Math.max(0, ...long)).toBeLessThanOrEqual(250);
        expect(frames.filter(gap => gap > 250)).toEqual([]);
        expect(frames.length).toBeGreaterThan(600);
    });

    test('gives its memory back: a reading, a Dive, Surface and Stop, repeated, leave the heap where it was', async ({ page }) => {
        test.setTimeout(120_000);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Performance.enable');
        await cdp.send('HeapProfiler.enable');
        const heapMB = async () => {
            await cdp.send('HeapProfiler.collectGarbage');
            await cdp.send('HeapProfiler.collectGarbage');
            const { metrics } = await cdp.send('Performance.getMetrics');
            return metrics.find(metric => metric.name === 'JSHeapUsedSize').value / 1e6;
        };
        await page.goto(OPEN);
        const cycle = async () => {
            await page.locator('.live-start').click();
            await expectShown(page, 'A black hole is a region of space');
            await page.locator('#live-controls-question').fill('dive on event horizon');
            await page.locator('#live-controls-question').press('Enter');
            await expectShown(page, 'The event horizon is where');
            await page.waitForTimeout(2_000);
            await page.getByRole('button', { name: 'Surface', exact: true }).click();
            await page.waitForTimeout(1_500);
            await page.getByRole('button', { name: 'Stop', exact: true }).click();
            await expect(page.locator('.live-start')).toBeEnabled();
            await page.waitForTimeout(1_000);
            return heapMB();
        };
        const afterFirst = await cycle(); // loads code and caches once; that is not a leak
        await cycle();
        const afterThird = await cycle();
        test.info().annotations.push({
            type: 'heap-mb',
            description: `after first cycle ${afterFirst.toFixed(2)}, after third ${afterThird.toFixed(2)}, growth ${(afterThird - afterFirst).toFixed(2)}`
        });
        expect(afterThird - afterFirst).toBeLessThanOrEqual(5);
    });
});

test.describe('the venue: the Reader site’s /live, where RISE owns the room', () => {
    const VENUE = '/live?voice=paced';

    test('asks, reads under the whole instrument, fills the screen on F, and asks again in the same room', async ({ page }) => {
        const errors = watchErrors(page);
        // What full screen was asked for, counted; the browser's own full screen is not this test's to judge.
        await page.addInitScript(() => {
            window.__fullscreenAsked = 0;
            Element.prototype.requestFullscreen = function requestFullscreen() { window.__fullscreenAsked += 1; return Promise.resolve(); };
        });
        await page.goto(VENUE);
        await expect(page.getByRole('heading', { name: 'RISE Live' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Who answers: Demo' })).toBeVisible();
        await expect(page.getByRole('radio', { name: 'Demo (no key)', includeHidden: true })).toBeChecked();
        await expect(page.locator('.live-venue__privacy')).toContainText('nothing you type leaves this browser');

        const asked = page.locator('#live-venue-question');
        await asked.fill('Explain black holes with RISE.');
        await asked.press('Enter');
        await expectShown(page, 'A black hole is a region of space');
        const stage = page.locator('#rise-stage-controls');
        for (const name of ['Back a passage', 'Forward a passage', 'Say this passage again', 'Full screen', 'Settings']) {
            await expect(stage.getByRole('button', { name, exact: true })).toHaveCount(1);
        }

        // The room: a theme picked in this reading is the next reading's too.
        await stage.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.locator('#rise-settings-theme').selectOption('ember');
        const ground = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--color-void'));
        const ember = await ground();
        expect(ember).not.toBe('');
        await page.locator('#rise-settings').press('Escape');

        await stage.getByRole('button', { name: 'Settings', exact: true }).focus();
        await page.keyboard.press('f');
        await expect.poll(() => page.evaluate(() => window.__fullscreenAsked)).toBe(1);

        // Held, the bar to ask again opens; the next question reads in the same page.
        await stage.locator('[data-stage="play"]').click();
        const again = page.getByRole('form', { name: 'Ask again' });
        await expect(again).toBeVisible();
        await page.locator('#live-again-question').fill('What is a quasar?');
        await page.locator('#live-again-question').press('Enter');
        await expectShown(page, 'This demonstration can only explain black holes.');
        expect(await ground()).toBe(ember);
        await stage.getByRole('button', { name: 'Settings', exact: true }).click();
        await expect(page.locator('#rise-settings-theme')).toHaveValue('ember');
        await page.locator('#rise-settings').press('Escape');

        // The end offers the question again, and Leave goes back to the entry.
        await expect(stage.getByRole('button', { name: /^Play again/u })).toHaveCount(1, { timeout: 20_000 });
        await expect(again).toBeVisible();
        await page.getByRole('button', { name: 'Leave this room' }).click();
        await expect(page.getByRole('heading', { name: 'RISE Live' })).toBeVisible();
        await expect(page.locator('#rise-stage-controls')).toHaveCount(0);
        expect(await ground()).toBe('');
        expect(new URL(page.url()).pathname).toBe('/live');
        expect(errors).toEqual([]);
    });

    test('refuses an empty question in words, and starts nothing', async ({ page }) => {
        await page.goto(VENUE);
        await page.locator('#live-venue-question').press('Enter');
        await expect(page.locator('.live-error')).toHaveText('Ask something first.');
        await expect(page.locator('#rise-stage-controls')).toHaveCount(0);
    });

    test('the entry is a room: the face on one ground, the question a single line, the choices a quiet line, what is sent folded at the foot', async ({ page }) => {
        await page.goto(VENUE);
        await expect(page.locator('.live-venue .live-face')).toBeAttached();
        // No disc, box or edge around the face: neither it nor its square draws a background or border of its own,
        // and the room's ground is the face's own dark.
        const looks = await page.evaluate(() => {
            const style = selector => getComputedStyle(document.querySelector(selector));
            const edges = selector => {
                const s = style(selector);
                return { background: s.backgroundColor, border: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth].join(' '), radius: s.borderTopLeftRadius, shadow: s.boxShadow, outline: s.outlineStyle };
            };
            return { ground: style('.live-venue').backgroundColor, body: style('body').backgroundColor, slot: edges('.live-venue__face'), face: edges('.live-face'), disc: edges('.live-face__disc'), scheme: style('.live-venue').colorScheme };
        });
        expect(looks.ground).toBe('rgb(10, 10, 15)');
        expect(looks.body).toBe(looks.ground);
        expect(looks.scheme).toBe('dark');
        for (const part of [looks.slot, looks.face, looks.disc]) {
            expect(part).toEqual({ background: 'rgba(0, 0, 0, 0)', border: '0px 0px 0px 0px', radius: '0px', shadow: 'none', outline: 'none' });
        }

        // The question is one focusable line, and Enter asks it.
        // The page gives the line focus once its route has settled (LiveHost activate).
        const question = page.getByRole('textbox', { name: 'Your question' });
        await expect(question).toBeFocused();
        await expect(page.locator('.live-start')).toBeHidden();
        await question.fill('Explain black holes with RISE.');
        await expect(page.getByRole('button', { name: 'Ask', exact: true })).toBeVisible();

        // Who answers: a radio group under its name, reached and moved by keyboard; Anthropic asks for its key.
        const answered = page.getByRole('button', { name: 'Who answers: Demo' });
        await answered.focus();
        await page.keyboard.press('Enter');
        await expect(answered).toHaveAttribute('aria-expanded', 'true');
        const group = page.getByRole('group', { name: 'Who answers' });
        await expect(group.getByRole('radio', { name: 'Demo (no key)' })).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await expect(group.getByRole('radio', { name: 'OpenRouter (your key)' })).toBeChecked();
        await page.keyboard.press('ArrowDown');
        await expect(group.getByRole('radio', { name: 'Anthropic (your key)' })).toBeChecked();
        await expect(page.getByLabel('Your Anthropic key')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(group).toBeHidden();
        await expect(page.getByRole('button', { name: 'Who answers: Anthropic' })).toBeFocused();

        // What is sent: one small line at the foot, the sentences behind it.
        const sent = page.locator('.live-venue__sent');
        await expect(sent.locator('.live-venue__privacy')).toBeHidden();
        await sent.getByText('What is sent, and to whom').click();
        await expect(sent.locator('.live-venue__privacy')).toBeVisible();
        await expect(sent.locator('.live-venue__privacy')).toContainText('Your Anthropic key stays in this page’s memory');

        // Back on the demo, Enter on the line asks.
        await page.getByRole('button', { name: 'Who answers: Anthropic' }).click();
        await group.getByRole('radio', { name: 'Demo (no key)' }).check();
        await question.press('Enter');
        await expectShown(page, 'A black hole is a region of space');
    });

    test('plays a reading written in beats as it arrives: a hold and a scene take effect before the answer is complete', async ({ page }) => {
        test.setTimeout(90_000);
        const errors = watchErrors(page);
        // When a picture is put up in the field, on the page's own clock (the journal's).
        await page.addInitScript(() => {
            window.__pictures = [];
            new MutationObserver(records => {
                for (const record of records) {
                    const kind = record.target.dataset?.picture;
                    if (kind && !window.__pictures.some(item => item.kind === kind)) window.__pictures.push({ kind, at: performance.now() });
                }
            }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-picture'] });
        });
        await page.goto(`${VENUE}&measure=1`);
        await page.locator('#live-venue-question').fill('Explain black holes with RISE.');
        await page.locator('#live-venue-question').press('Enter');
        await expectShown(page, 'A black hole is a region of space');

        const journal = () => page.evaluate(() => window.__riseLive.journal());
        await expect.poll(async () => (await journal()).some(entry => entry.type === 'composed'), { timeout: 45_000 }).toBe(true);
        const composed = (await journal()).find(entry => entry.type === 'composed');
        expect(composed).toMatchObject({ role: 'main', phase: 'complete' });
        // The hold after the first beat, and the figure the third beat starts, each took effect while the answer was still being written.
        await expect.poll(() => page.evaluate(() => window.__pictures.some(item => item.kind === 'figure')), { timeout: 30_000 }).toBe(true);
        const atoms = await page.evaluate(() => window.__riseLive.atoms());
        const hold = atoms.find(atom => atom.sourceId === 'beat-1');
        const pictures = await page.evaluate(() => window.__pictures);
        const figure = pictures.find(item => item.kind === 'figure');
        const startedAt = (await journal()).find(entry => entry.type === 'start').at;
        const since = at => Math.round(at - startedAt);
        console.log(`beats streamed (ms from Ask): first words ${since(atoms[0].at)}, hold ${since(hold.at)} (${hold.holdMs} ms), figure up ${figure ? since(figure.at) : 'never'}, answer complete ${since(composed.at)}`);
        expect(hold.holdMs).toBe(1800);
        expect(hold.at).toBeLessThan(composed.at);
        expect(figure, 'the figure was put up').toBeTruthy();
        expect(figure.at).toBeLessThan(composed.at);
        await expect(page.locator('#chamber-field[data-picture="figure"] img, #chamber-field[data-picture="figure"] svg').first()).toBeAttached();
        expect(errors).toEqual([]);
    });

    // The demo ends on a said beat. A closing shown line, which no one says, is pinned streamed in src/live/last-beat.test.js:
    // the demo's own script is not changed to show it here.
    test('ends the reading only after the voice has said its last beat, whole', async ({ page }) => {
        test.setTimeout(90_000);
        const errors = watchErrors(page);
        await page.goto(`${VENUE}&measure=1`);
        await page.locator('#live-venue-question').fill('Explain black holes with RISE.');
        await page.locator('#live-venue-question').press('Enter');
        await expectShown(page, 'A black hole is a region of space');
        const journal = () => page.evaluate(() => window.__riseLive.journal().filter(entry => entry.role === 'main'));
        await expect.poll(async () => (await journal()).some(entry => entry.type === 'run.finished'), { timeout: 60_000 }).toBe(true);
        const entries = await journal();
        const finished = entries.find(entry => entry.type === 'run.finished');
        const last = entries.filter(entry => entry.type === 'speech.end').at(-1);
        const words = 'The black hole itself stays dark. What we photograph is the shadow it casts on that light.';
        expect(last).toMatchObject({ segmentId: 'beat-6' });
        expect(last.durationMs).toBeGreaterThanOrEqual(words.length * MS_PER_CHAR);
        // Said before the reading ended, and the words kept with it: the Player completed as the voice ended.
        expect(last.at).toBeLessThanOrEqual(finished.at);
        expect(finished.voiceTailMs ?? 0).toBeLessThan(250);
        expect(entries.filter(entry => ['voice.taken', 'voice.failed', 'voice.degraded'].includes(entry.type))).toEqual([]);
        expect(errors).toEqual([]);
    });

    // RISE's face (docs/plans/LIVE-CURRENT.md §22, §23): the room's resting picture, which holds the reading's visuals.
    /** When the face was first put on the page, whether the still eye was in it and the engine had not yet drawn. */
    const recordFirstFace = page => page.addInitScript(() => {
        window.__firstFace = null;
        new MutationObserver((records, observer) => {
            const face = document.querySelector('.live-face');
            if (!face) return;
            window.__firstFace = { still: Boolean(face.querySelector('svg.live-face__still')), drawn: face.dataset.faceDrawn };
            observer.disconnect();
        }).observe(document, { subtree: true, childList: true });
    });
    /** Every frame the venue framed, as the face reports it, on the page's clock: frame, how open, how far docked. */
    const recordFrames = page => page.evaluate(() => {
        window.__framesSeen = [];
        const look = () => {
            const g = window.__riseFace?.frame?.();
            if (g) window.__framesSeen.push({ at: performance.now(), frame: g.frame, hole: g.aperture?.hole ?? g.wipe?.hole ?? 0, small: g.small, face: g.face, wipe: g.wipe ? { r: g.wipe.r } : null });
            requestAnimationFrame(look);
        };
        requestAnimationFrame(look);
    });
    const framesSeen = page => page.evaluate(() => window.__framesSeen);

    test('the face rests at arrival, listens, thinks on Ask, speaks the reading in the room, never hidden, and rests at the end', async ({ page }) => {
        test.setTimeout(150_000);
        const errors = watchErrors(page);
        await recordFirstFace(page);
        await page.goto(`${VENUE}&measure=1`);
        const face = page.locator('.live-face');
        const hooks = () => page.evaluate(() => ({ state: window.__riseFace.state(), log: window.__riseFace.log() }));
        await expect(face).toHaveAttribute('data-face-state', 'arrival');
        await expect(face).toBeVisible();
        // The still eye was the face before the engine drew, and gives way to it once it has.
        expect(await page.evaluate(() => window.__firstFace)).toEqual({ still: true, drawn: 'false' });
        await expect.poll(() => page.evaluate(() => window.__riseFace?.drawn() ?? false), { timeout: 15_000 }).toBe(true);
        await expect(page.locator('svg.live-face__still')).toBeHidden();

        // Its own frames, in the worker, at the venue's size; and a blink the flash gate lets through.
        await page.waitForTimeout(2_000);
        const before = (await page.evaluate(() => window.__riseFace.lumas())).length;
        await page.evaluate(() => window.__riseFace.blink());
        await page.waitForTimeout(1_000);
        const frames = (await page.evaluate(() => window.__riseFace.frames())).sort((a, b) => a - b);
        const lumas = (await page.evaluate(() => window.__riseFace.lumas())).slice(before - 1);
        const median = frames[frames.length >> 1];
        const step = Math.max(...lumas.slice(1).map((value, i) => Math.abs(value - lumas[i])));
        console.log(`face frames: ${frames.length}, median ${median.toFixed(2)} ms, p95 ${frames[Math.floor(frames.length * 0.95)].toFixed(2)} ms; largest brightness step across a blink ${step.toFixed(4)} over ${lumas.length} samples`);
        expect(median).toBeLessThan(24);
        expect(await page.evaluate(() => window.__riseFace.frozen())).toBe(false);
        expect(step).toBeLessThan(0.1);

        // The reader types: it listens. Ask: it thinks until the reading's first words, then speaks them, in the room.
        await page.locator('#live-venue-question').fill('Explain black holes with RISE.');
        await expect(face).toHaveAttribute('data-face-state', 'listening');
        await page.locator('#live-venue-question').press('Enter');
        await expect(face).toHaveAttribute('data-face-state', /thinking|speaking/u);
        await expectShown(page, 'A black hole is a region of space');
        const firstWords = (await page.evaluate(() => window.__riseLive.atoms()))[0].at;
        const { log } = await hooks();
        const at = state => log.find(entry => entry.state === state)?.at;
        console.log(`face hand-offs (ms): Ask to thinking ${Math.round(at('thinking') - at('listening'))} after listening; thinking to first words ${Math.round(firstWords - at('thinking'))}; first words to speaking ${Math.round(at('speaking') - firstWords)}`);
        expect(log.map(entry => entry.state).slice(0, 4)).toEqual(['arrival', 'listening', 'thinking', 'speaking']);
        // The same atom: the runtime hears it a fraction of a millisecond before the measuring page's listener does.
        expect(at('speaking')).toBeGreaterThanOrEqual(firstWords - 5);
        // She does not leave: with no visual yet she is the eye, the words below her.
        await page.waitForTimeout(800);
        await expect(face).toBeVisible();
        expect(await page.evaluate(() => window.__riseFace.frame()?.frame)).toBe('none');
        const eye = await page.evaluate(() => window.__riseFace.frame().face);
        const words = await page.locator('#atom-display').boundingBox();
        expect(words.y).toBeGreaterThan(eye.y + eye.s / 2 - 1);

        // The end: it is at rest, the frame closed to the eye.
        await expect(face).toHaveAttribute('data-face-state', 'rest', { timeout: 90_000 });
        await expect(face).toBeVisible();
        await expect.poll(() => page.evaluate(() => window.__riseFace.frame()?.frame), { timeout: 5_000 }).toBe('none');
        expect(errors).toEqual([]);
    });

    test('the frames: an attractor is held in the outer shell, scaled to its aperture, the words below it', async ({ page }) => {
        test.setTimeout(90_000);
        const errors = watchErrors(page);
        await page.goto(`${VENUE}&measure=1`);
        await expect.poll(() => page.evaluate(() => window.__riseFace?.drawn() ?? false), { timeout: 15_000 }).toBe(true);
        await page.locator('#live-venue-question').fill('Explain black holes with RISE.');
        await page.locator('#live-venue-question').press('Enter');
        await expectShown(page, 'A black hole is a region of space');
        // The demo's second beat holds its attractor: the shell opens around it. Caught on the animation frame it is
        // first wholly open, with the attractor's layer as the page then lays it out.
        await page.evaluate(() => {
            window.__shellOpen = null;
            const look = () => {
                const g = window.__riseFace?.frame?.();
                const layer = document.querySelector('#chamber-field .chamber-attractor');
                if (g?.frame === 'shell' && g.aperture?.hole === 1 && layer) {
                    const words = document.querySelector('#atom-display').getBoundingClientRect();
                    window.__shellOpen = { g, box: layer.getBoundingClientRect().toJSON(), wordsTop: words.top, marked: document.documentElement.dataset.liveFrame };
                    return;
                }
                requestAnimationFrame(look);
            };
            requestAnimationFrame(look);
        });
        await expect.poll(() => page.evaluate(() => window.__shellOpen !== null), { timeout: 25_000 }).toBe(true);
        const shell = await page.evaluate(() => window.__shellOpen);
        const { aperture } = shell.g;
        expect(shell.marked).toBe('shell');
        // The circle inscribed in the attractor's own square is the aperture: its centre, and its radius, to a pixel.
        expect(aperture.r).toBeCloseTo(shell.g.big.s * 0.41, 6);
        expect(shell.box.x + shell.box.width / 2).toBeCloseTo(aperture.x, 0);
        expect(shell.box.y + shell.box.height / 2).toBeCloseTo(aperture.y, 0);
        expect(Math.min(shell.box.width, shell.box.height) / 2).toBeCloseTo(aperture.r, 0);
        // The words' place is below the circle.
        expect(shell.wordsTop).toBeGreaterThan(aperture.y + aperture.r);
        expect(errors).toEqual([]);
    });

    test('the frames: a figure takes the full frame, the face docked by the bar, the words over the scrim', async ({ page }) => {
        test.setTimeout(90_000);
        const errors = watchErrors(page);
        await page.goto(`${VENUE}&measure=1`);
        await expect.poll(() => page.evaluate(() => window.__riseFace?.drawn() ?? false), { timeout: 15_000 }).toBe(true);
        await page.locator('#live-venue-question').fill('Explain black holes with RISE.');
        await page.locator('#live-venue-question').press('Enter');
        await expectShown(page, 'A black hole is a region of space');
        await recordFrames(page);
        // The third beat puts up the event horizon as a figure: the shell closes, the full frame opens.
        await expect.poll(() => page.evaluate(() => window.__riseFace.frame()?.wipe?.hole ?? 0), { timeout: 25_000 }).toBe(1);
        const seen = await framesSeen(page);
        const order = seen.map(entry => entry.frame).filter((frame, i, all) => frame !== all[i - 1]);
        expect(order.slice(-2)).toEqual(['shell', 'full']);
        const full = seen.filter(entry => entry.frame === 'full');
        // Opening over its own time: about 1.9 s from the eye to past every corner, passing through the middle.
        expect(full.some(entry => entry.hole > 0.3 && entry.hole < 0.7)).toBe(true);
        expect(full.at(-1).at - full[0].at).toBeGreaterThan(1_500);
        const { face } = full.at(-1);
        const bar = await page.locator('.live-again').boundingBox();
        expect(face.s).toBeCloseTo(48 * 1.15, 6);
        expect(face.x).toBeLessThan(bar.x);
        expect(bar.x - face.x).toBeLessThan(40);
        expect(Math.abs(face.y - (bar.y + bar.height / 2))).toBeLessThan(2);
        expect(await page.evaluate(() => document.documentElement.dataset.liveFrame)).toBe('full');
        // The figure itself is not moved or scaled in the full frame.
        const figure = await page.locator('#chamber-field img.chamber-figure').boundingBox();
        const viewport = page.viewportSize();
        expect(figure).toMatchObject({ x: 0, y: 0, width: viewport.width, height: viewport.height });
        expect(errors).toEqual([]);
    });

    test('the frames under reduced motion: every change at once, no blinks, the face still drawn and never hidden', async ({ page }) => {
        test.setTimeout(90_000);
        const errors = watchErrors(page);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(`${VENUE}&measure=1`);
        const face = page.locator('.live-face');
        await expect(face).toHaveAttribute('data-face-state', 'arrival');
        await expect.poll(() => page.evaluate(() => window.__riseFace?.drawn() ?? false), { timeout: 15_000 }).toBe(true);
        await page.locator('#live-venue-question').fill('Explain black holes with RISE.');
        await page.locator('#live-venue-question').press('Enter');
        await expectShown(page, 'A black hole is a region of space');
        await recordFrames(page);
        await expect.poll(() => page.evaluate(() => window.__riseFace.frame()?.frame), { timeout: 25_000 }).toBe('full');
        const seen = await framesSeen(page);
        // Each frame was open from the first animation frame it was shown in, and never part-way.
        const framed = seen.filter(entry => entry.frame !== 'none');
        expect(framed.map(entry => entry.frame)).toContain('shell');
        for (const entry of framed) expect(entry.hole).toBe(1);
        expect(framed.filter(entry => entry.frame === 'full').every(entry => entry.small === 1)).toBe(true);
        await expect(face).toBeVisible();
        expect(await page.evaluate(() => window.__riseFace.frozen())).toBe(false);
        expect(errors).toEqual([]);
    });

    // Catalog words (docs/plans/LIVE-CURRENT.md §24): a visual the reader names is shown at once, with no request.
    test('catalog words: “attractor” typed during the figure shows the attractor in the outer shell at once, and asks nothing', async ({ page }) => {
        test.setTimeout(90_000);
        const errors = watchErrors(page);
        await page.goto(`${VENUE}&measure=1`);
        await expect.poll(() => page.evaluate(() => window.__riseFace?.drawn() ?? false), { timeout: 15_000 }).toBe(true);
        await page.locator('#live-venue-question').fill('Explain black holes with RISE.');
        await page.locator('#live-venue-question').press('Enter');
        await expectShown(page, 'A black hole is a region of space');
        // The demo's third beat puts up the event horizon as a figure: the full frame.
        await expect.poll(() => page.evaluate(() => window.__riseFace.frame()?.frame), { timeout: 25_000 }).toBe('full');
        const journal = () => page.evaluate(() => window.__riseLive.journal());
        const field = page.locator('#live-again-question');
        await field.fill('attractor');
        await field.press('Enter');
        await expect(page.locator('.live-again__note')).toHaveText('Showing the attractor.');
        await expect.poll(() => page.evaluate(() => window.__riseFace.frame()?.frame), { timeout: 10_000 }).toBe('shell');
        await expect(page.locator('#chamber-field .chamber-attractor')).toBeAttached();
        expect((await journal()).filter(entry => entry.type === 'visual.chosen')).toEqual([expect.objectContaining({ engine: 'attractor' })]);
        // The reading goes on to its end with the reader's choice: the disk the demo starts later is held, and no
        // request was opened for the words.
        await expect.poll(async () => (await journal()).some(entry => entry.type === 'run.finished'), { timeout: 60_000 }).toBe(true);
        const entries = await journal();
        expect(entries.filter(entry => entry.type === 'room.held' && entry.kind === 'scene').map(entry => entry.scene)).toEqual(['disk']);
        expect(entries.some(entry => entry.type.startsWith('interjection.') && entry.type !== 'interjection.held')).toBe(false);
        expect(errors).toEqual([]);
    });

    // The demo's first beat lays a bed (starlight). What leaves the engine's last gate is measured, as in the card:
    // started is not heard. With the paced voice nothing ducks it.
    test('a bed under the reading stops with it, sounds again on Play again, and under the next reading asked', async ({ page }) => {
        test.setTimeout(150_000);
        const errors = watchErrors(page);
        await page.goto(`${VENUE}&measure=1`);
        await page.locator('#live-venue-question').fill('Explain black holes with RISE.');
        await page.locator('#live-venue-question').press('Enter');
        await expectShown(page, 'A black hole is a region of space');
        const audio = () => page.evaluate(() => window.__riseLive.audio());
        const level = async () => (await audio()).levelDbfs ?? -Infinity;
        await expect.poll(async () => (await audio()).sounding, { timeout: 10_000 }).toBe('starlight');
        await expect.poll(level, { timeout: 5_000 }).toBeGreaterThan(-45);

        const stage = page.locator('#rise-stage-controls');
        const playAgain = stage.getByRole('button', { name: /^Play again/u });
        await expect(playAgain).toHaveCount(1, { timeout: 60_000 });
        // No audio outlives the reading (#631). Play again is pressed at once, while the session is still closing.
        await expect.poll(level, { timeout: 5_000 }).toBeLessThan(-60);
        await playAgain.click();
        await expect(stage.locator('[data-stage="play"]')).toHaveAttribute('aria-label', /^Pause/u);
        await expect.poll(level, { timeout: 5_000 }).toBeGreaterThan(-45);

        // Held, the next question reads anew in the same room, on a new runtime: its bed sounds under it.
        await stage.locator('[data-stage="play"]').click();
        await page.locator('#live-again-question').fill('Explain black holes again.');
        await page.locator('#live-again-question').press('Enter');
        await expect.poll(async () => (await page.evaluate(() => window.__riseLive.journal())).some(entry => entry.type === 'start' && /again/u.test(entry.prompt)), { timeout: 10_000 }).toBe(true);
        await expectShown(page, 'A black hole is a region of space');
        await expect.poll(level, { timeout: 10_000 }).toBeGreaterThan(-45);
        expect(errors).toEqual([]);
    });

    test('carries what the reader did up with their next words: a replay, a theme and the pause go, and nothing of the voice', async ({ page }) => {
        test.setTimeout(90_000);
        const errors = watchErrors(page);
        await page.goto(`${VENUE}&measure=1`);
        await page.locator('#live-venue-question').fill('Explain black holes with RISE.');
        await page.locator('#live-venue-question').press('Enter');
        await expectShown(page, 'A black hole is a region of space');
        const stage = page.locator('#rise-stage-controls');
        const journal = () => page.evaluate(() => window.__riseLive.journal());

        await stage.getByRole('button', { name: 'Say this passage again', exact: true }).click();
        await expect.poll(async () => (await journal()).some(entry => entry.type === 'replay')).toBe(true);
        await stage.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.locator('#rise-settings-theme').selectOption('ember');
        await page.locator('#rise-settings').press('Escape');
        await stage.locator('[data-stage="play"]').click();
        await expect(page.getByRole('form', { name: 'Ask again' })).toBeVisible();

        await page.locator('#live-again-question').fill('Explain black holes with RISE.');
        await page.locator('#live-again-question').press('Enter');
        await expect.poll(async () => (await journal()).find(entry => entry.type === 'perception.sent') ?? null, { timeout: 15_000 }).not.toBeNull();
        const sent = (await journal()).find(entry => entry.type === 'perception.sent');
        expect(sent).toMatchObject({ count: 3, kinds: ['replayed', 'visual.changed', 'held'] });
        await expectShown(page, 'A black hole is a region of space');
        expect(errors).toEqual([]);
    });

    test('remembers the room: the next question carries the one before it and what RISE said, and the demo answers it (LIVE-026)', async ({ page }) => {
        test.setTimeout(90_000);
        const errors = watchErrors(page);
        await page.goto(`${VENUE}&measure=1`);
        await page.locator('#live-venue-question').fill('Explain black holes with RISE.');
        await page.locator('#live-venue-question').press('Enter');
        await expectShown(page, 'A black hole is a region of space');
        const journal = () => page.evaluate(() => window.__riseLive.journal());
        expect((await journal()).some(entry => entry.type === 'earlier.sent')).toBe(false);
        await page.locator('#rise-stage-controls [data-stage="play"]').click();
        await expect(page.getByRole('form', { name: 'Ask again' })).toBeVisible();

        await page.locator('#live-again-question').fill('What did Einstein say about it?');
        await page.locator('#live-again-question').press('Enter');
        await expect.poll(async () => (await journal()).find(entry => entry.type === 'earlier.sent') ?? null, { timeout: 15_000 }).not.toBeNull();
        expect((await journal()).find(entry => entry.type === 'earlier.sent')).toMatchObject({ count: 1 });
        await expectShown(page, 'This demonstration can only explain black holes');
        expect(errors).toEqual([]);
    });

    test('sends nothing by itself: a reading paused for a long time asks nothing and sends nothing', async ({ page }) => {
        test.setTimeout(60_000);
        const errors = watchErrors(page);
        const requested = [];
        page.on('request', request => requested.push(request.url()));
        await page.goto(`${VENUE}&measure=1`);
        await page.locator('#live-venue-question').fill('Explain black holes with RISE.');
        await page.locator('#live-venue-question').press('Enter');
        await expectShown(page, 'A black hole is a region of space');
        const startOf = async () => (await page.evaluate(() => window.__riseLive.journal())).filter(entry => entry.type === 'start');
        const started = await startOf();
        expect(started).toHaveLength(1);
        await page.locator('#rise-stage-controls [data-stage="play"]').click();
        await expect(page.getByRole('form', { name: 'Ask again' })).toBeVisible();
        const before = requested.length;
        // A long pause, on the page's own timers: nothing may go up, and no reading may begin.
        await page.waitForTimeout(12_000);
        const journal = await page.evaluate(() => window.__riseLive.journal());
        // The same reading, the one it began with: no other was asked.
        expect(await startOf()).toEqual(started);
        expect(journal.some(entry => entry.type === 'perception.sent')).toBe(false);
        expect(requested.slice(before).filter(url => /openrouter\.ai|googleapis\.com|api\.openai\.com/u.test(url))).toEqual([]);
        expect(errors).toEqual([]);
    });

    /**
     * The interjection (docs/plans/LIVE-CURRENT.md §17), on the demo and the paced voice. Measured: the reader's words
     * to RISE's first word of answer. Held: never two voices; Pause holds the answer; after resume the reading goes on
     * at the held phrase; after replace the rest never plays; Back from the first answer passage is the held passage.
     */
    const interjectionHooks = page => ({
        journal: () => page.evaluate(() => window.__riseLive.journal()),
        passages: () => page.evaluate(() => window.__riseLive.passages())
    });

    /** Every speech.start while another utterance was still being said and nothing silenced it: two voices at once. */
    function overlaps(journal) {
        let speaking = null;
        const found = [];
        for (const entry of journal) {
            if (entry.type === 'speech.start') {
                if (speaking !== null) found.push({ at: entry.at, speaking, started: entry.segmentId });
                speaking = entry.segmentId;
            } else if (entry.type === 'speech.end' && entry.segmentId === speaking) speaking = null;
            else if (['voice.held', 'interjection.held', 'seek', 'replay', 'hold', 'voice.taken'].includes(entry.type)) speaking = null;
        }
        return found;
    }

    async function interjectIn(page, words) {
        const errors = watchErrors(page);
        await page.goto(`${VENUE}&measure=1`);
        await page.locator('#live-venue-question').fill('Explain black holes with RISE.');
        await page.locator('#live-venue-question').press('Enter');
        await expectShown(page, 'A black hole is a region of space');
        const hooks = interjectionHooks(page);
        // Part way into the first passage, the reader starts typing into the playing reading: it holds at once.
        await page.waitForTimeout(1_500);
        const field = page.locator('#live-again-question');
        await expect(field).toBeVisible();
        await field.fill(words);
        await expect.poll(async () => (await hooks.journal()).some(entry => entry.type === 'interjection.held')).toBe(true);
        await field.press('Enter');
        await expect.poll(async () => (await hooks.journal()).some(entry => entry.type === 'interjection.asked')).toBe(true);
        return { errors, hooks, asked: (await hooks.journal()).find(entry => entry.type === 'interjection.asked') };
    }

    test('the interjection: RISE answers inside the room, in the same voice, and the reading resumes at the held phrase', async ({ page }) => {
        test.setTimeout(120_000);
        const { errors, hooks, asked } = await interjectIn(page, 'What is the horizon, really?');
        expect(asked.segmentId).toBe('beat-0');
        const answered = () => hooks.journal().then(journal => journal.find(entry => entry.type === 'speech.start' && entry.segmentId === 'beat-1' && entry.at > asked.at) ?? null);
        await expect.poll(answered, { timeout: 15_000 }).not.toBeNull();
        const first = await answered();
        console.log(`interjection: the reader's words to RISE's first word of answer ${Math.round(first.at - asked.at)} ms`);
        await expectShown(page, 'Good question');

        // Pause during the answer holds the answer.
        const stage = page.locator('#rise-stage-controls');
        await stage.locator('[data-stage="play"]').click();
        const pausedAt = await page.evaluate(() => window.__riseLive.now());
        const onScreen = await shown(page);
        await page.waitForTimeout(1_500);
        expect(await shown(page)).toBe(onScreen);
        expect((await hooks.journal()).filter(entry => entry.type === 'speech.start' && entry.at > pausedAt)).toEqual([]);
        await stage.locator('[data-stage="play"]').click();

        await expect.poll(async () => (await hooks.journal()).find(entry => entry.type === 'interjection.answered') ?? null, { timeout: 30_000 })
            .toMatchObject({ beats: 2, ending: 'resume' });
        const passages = await hooks.passages();
        expect(passages.slice(1, 3).map(passage => passage.text)).toEqual([
            'Good question: the horizon is not a surface you could touch.',
            'It is only the distance past which light can no longer climb back out.'
        ]);
        // After the answer, the held passage again from the phrase the voice was held at.
        expect(passages[0].text.endsWith(passages[3].text)).toBe(true);
        await expect.poll(async () => (await hooks.journal()).some(entry => entry.type === 'speech.start' && entry.segmentId === 'beat-3'), { timeout: 30_000 }).toBe(true);
        const journal = await hooks.journal();
        expect(overlaps(journal)).toEqual([]);
        expect(journal.filter(entry => entry.type === 'voice.chosen')).toHaveLength(1);
        expect(errors).toEqual([]);
    });

    test('the interjection: Back from the first answer passage is the held passage; replace ends the reading with the answer', async ({ page }) => {
        test.setTimeout(120_000);
        const { errors, hooks, asked } = await interjectIn(page, 'Skip the rest: the short version.');
        await expect.poll(async () => (await hooks.journal()).some(entry => entry.type === 'speech.start' && entry.segmentId === 'beat-1' && entry.at > asked.at), { timeout: 15_000 }).toBe(true);
        const stage = page.locator('#rise-stage-controls');
        await stage.getByRole('button', { name: 'Back a passage', exact: true }).click();
        await expect.poll(async () => (await hooks.journal()).find(entry => entry.type === 'seek') ?? null).toMatchObject({ from: 'beat-1', to: 'beat-0' });
        await expectShown(page, 'A black hole is a region of space');

        await expect(stage.getByRole('button', { name: /^Play again/u })).toHaveCount(1, { timeout: 45_000 });
        const journal = await hooks.journal();
        expect(journal.find(entry => entry.type === 'interjection.answered')).toMatchObject({ beats: 2, ending: 'replace' });
        expect((await hooks.passages()).map(passage => passage.text)).toEqual([
            expect.stringContaining('A black hole is a region of space'),
            'In short: a black hole is gravity so strong that not even light can leave it.',
            'That is the whole of it; the rest was detail.'
        ]);
        // The rest of the room's answer never played.
        expect(journal.filter(entry => entry.type === 'speech.start').map(entry => entry.segmentId).filter(id => !['beat-0', 'beat-1', 'beat-2'].includes(id))).toEqual([]);
        expect(overlaps(journal)).toEqual([]);
        expect(errors).toEqual([]);
    });

    /**
     * The model changes the room while it plays (docs/plans/LIVE-CURRENT.md §18), on the demo's sky reading and the
     * paced voice. Measured on the page's own clock: when each change landed against the phrase it landed on.
     */
    const roomHooks = page => ({
        journal: () => page.evaluate(() => window.__riseLive.journal()),
        atoms: () => page.evaluate(() => window.__riseLive.atoms().filter(entry => entry.role === 'main'))
    });

    test('the model changes the room: a look and a cue as the passage after them begins, a second change one phrase on, a pace with a way back, and RISE’s changes go up as RISE’s', async ({ page }) => {
        test.setTimeout(150_000);
        const errors = watchErrors(page);
        await page.goto(`${VENUE}&measure=1`);
        await page.locator('#live-venue-question').fill('Why is the sky blue?');
        await page.locator('#live-venue-question').press('Enter');
        await expectShown(page, 'Sunlight carries every colour at once.');
        const hooks = roomHooks(page);
        const changed = async () => (await hooks.journal()).filter(entry => entry.type === 'room.changed');
        await expect.poll(async () => (await changed()).length, { timeout: 60_000 }).toBeGreaterThanOrEqual(3);
        const [look, cue, visual] = await changed();
        const phrases = (await hooks.atoms()).filter(entry => entry.sourceId === 'beat-2');
        expect(look).toMatchObject({ kind: 'look.change', look: 'flame', theme: 'ember' });
        expect(cue).toMatchObject({ kind: 'scene.cue', scene: 'sky', cue: 'calm' });
        expect(visual).toMatchObject({ kind: 'visual.control', parameter: 'intensity', value: 0.7 });
        expect(phrases.length).toBeGreaterThanOrEqual(2);
        const since = (entry, phrase) => Math.round(entry.at - phrase.at);
        console.log(`room changes (ms after the phrase they landed on): look ${since(look, phrases[0])} and cue ${since(cue, phrases[0])} at the passage's first phrase; the second change ${since(visual, phrases[1])} after its second phrase began, ${since(visual, phrases[0])} after the first`);
        for (const [entry, phrase] of [[look, phrases[0]], [cue, phrases[0]], [visual, phrases[1]]]) {
            expect(entry.at).toBeGreaterThanOrEqual(phrase.at);
            expect(entry.at - phrase.at).toBeLessThan(250);
        }
        // The room wears the look's colours, as the reader's Theme row would show them.
        await expect(page.locator('#rise-settings-theme')).toHaveValue('ember');

        // RISE suggests a pace before the last beat; the reader keeps their own.
        const suggest = page.locator('.rise-stage__suggest');
        await expect(suggest).toContainText('RISE suggests 1.25×', { timeout: 60_000 });
        await suggest.getByRole('button', { name: 'Keep 1×' }).click();
        await expect(suggest).toBeHidden();
        const stage = page.locator('#rise-stage-controls');
        await expect(stage.locator('[data-stage="pace"]')).toHaveText('1×');

        // Asked again, the next question carries what RISE changed, as RISE's, beside what the reader did.
        await expect(stage.getByRole('button', { name: /^Play again/u })).toHaveCount(1, { timeout: 60_000 });
        await page.locator('#live-again-question').fill('What is a quasar?');
        await page.locator('#live-again-question').press('Enter');
        await expectShown(page, 'This demonstration can only explain black holes.');
        const sent = await page.evaluate(() => window.__riseLive.perception());
        expect(sent.events).toEqual(expect.arrayContaining([
            { type: 'visual.changed', by: 'rise', parameter: 'look', value: 'flame' },
            { type: 'visual.changed', by: 'rise', parameter: 'intensity', value: 0.7 },
            { type: 'paced', by: 'rise', rate: 1.25 },
            { type: 'paced', rate: 1 }
        ]));
        expect(errors).toEqual([]);
    });

    test('the model changes the room in an answer to the reader: the visual lands as the answer begins, within a second; the reader’s own pace is not overridden', async ({ page }) => {
        test.setTimeout(150_000);
        const errors = watchErrors(page);
        await page.goto(`${VENUE}&measure=1`);
        await page.locator('#live-venue-question').fill('Why is the sky blue?');
        await page.locator('#live-venue-question').press('Enter');
        await expectShown(page, 'Sunlight carries every colour at once.');
        const hooks = roomHooks(page);
        // The reader sets their own pace before RISE suggests one.
        const stage = page.locator('#rise-stage-controls');
        await stage.locator('[data-stage="pace"]').click();
        await expect(stage.locator('[data-stage="pace"]')).toHaveText('1.25×');
        // In the passage with the sky, the reader asks for more vibrant imagery.
        await expect.poll(async () => (await hooks.journal()).some(entry => entry.type === 'speech.start' && entry.segmentId === 'beat-1'), { timeout: 30_000 }).toBe(true);
        await page.waitForTimeout(1_000);
        const field = page.locator('#live-again-question');
        await field.fill('Make it more vibrant.');
        await expect.poll(async () => (await hooks.journal()).some(entry => entry.type === 'interjection.held')).toBe(true);
        await field.press('Enter');
        const brighter = async () => (await hooks.journal()).find(entry => entry.type === 'room.changed' && entry.value === 0.75) ?? null;
        await expect.poll(brighter, { timeout: 15_000 }).not.toBeNull();
        const journal = await hooks.journal();
        const asked = journal.find(entry => entry.type === 'interjection.asked');
        const requested = journal.find(entry => entry.type === 'room.asked' && entry.at > asked.at);
        const landed = await brighter();
        const answer = (await hooks.atoms()).find(entry => entry.sourceId === 'beat-2' && entry.at > asked.at);
        console.log(`room change in an answer: requested ${Math.round(requested.at - asked.at)} ms after the question, landed ${Math.round(landed.at - requested.at)} ms after it was requested, ${Math.round(landed.at - answer.at)} ms after the answer's first phrase began`);
        expect(landed.at - requested.at).toBeLessThan(1_000);
        expect(landed.at).toBeGreaterThanOrEqual(answer.at);
        expect(landed.at - answer.at).toBeLessThan(250);

        // The reading resumes and reaches RISE's pace: refused, as the reader set their own.
        await expect.poll(async () => (await hooks.journal()).find(entry => entry.type === 'room.refused' && entry.kind === 'pace.suggest') ?? null, { timeout: 90_000 })
            .toMatchObject({ code: 'READER_SET' });
        await expect(stage.locator('[data-stage="pace"]')).toHaveText('1.25×');
        await expect(page.locator('.rise-stage__suggest')).toBeHidden();
        expect(errors).toEqual([]);
    });

    /**
     * The illustrator (docs/plans/LIVE-CURRENT.md §19), on the demo's water and tesseract readings and the paced voice.
     * Measured on the page's own clock: when each picture was asked for, drawn, admitted and put up, against the phrase
     * it landed on; and whether the voice ever waited for one.
     */
    async function illustrated(page, question) {
        const errors = watchErrors(page);
        // When a picture is put up in the field, on the page's own clock (the journal's).
        await page.addInitScript(() => {
            window.__pictures = [];
            new MutationObserver(records => {
                for (const record of records) {
                    const kind = record.target.dataset?.picture;
                    if (kind) window.__pictures.push({ kind, at: performance.now() });
                }
            }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-picture'] });
        });
        await page.goto(`${VENUE}&measure=1`);
        await page.locator('#live-venue-question').fill(question);
        await page.locator('#live-venue-question').press('Enter');
        return { errors, hooks: roomHooks(page), stage: page.locator('#rise-stage-controls') };
    }

    /** The longest silence between the end of one utterance and the start of the next, in the reading's own voice. */
    function longestGap(journal) {
        let gap = 0;
        let ended = null;
        for (const entry of journal.filter(item => item.role === 'main')) {
            if (entry.type === 'speech.end') ended = entry.at;
            else if (entry.type === 'speech.start' && ended !== null) { gap = Math.max(gap, entry.at - ended); ended = null; }
        }
        return Math.round(gap);
    }

    const beatOf = sourceId => Number(String(sourceId).slice('beat-'.length));

    test('the illustrator: RISE’s own cue at once with no request, then a figure refused, repaired and put up at a phrase, while the voice goes on; the cost is shown', async ({ page }) => {
        test.setTimeout(180_000);
        const { errors, hooks, stage } = await illustrated(page, 'What are the three states of water?');
        await expectShown(page, 'Water comes in three states');
        const of = (journal, n) => journal.filter(entry => entry.n === n);
        await expect.poll(async () => of(await hooks.journal(), 2).some(entry => entry.type === 'illustrated'), { timeout: 90_000 }).toBe(true);
        let journal = await hooks.journal();
        const atoms = await hooks.atoms();

        // The cue: the attractor's own, as the beat after its line began, and no request for it.
        expect(of(journal, 1).map(entry => entry.type)).toEqual(['illustration.asked', 'illustrated']);
        const [cueAsked, cue] = of(journal, 1);
        expect(cueAsked).toMatchObject({ rung: 'cue', medium: 'cue', brief: 'brighter attractor' });
        const cuePlace = atoms.find(entry => entry.sourceId === 'beat-2');
        expect(cue.at - cuePlace.at).toBeGreaterThanOrEqual(0);
        expect(cue.at - cuePlace.at).toBeLessThan(250);
        expect(journal.find(entry => entry.type === 'visual.control' && entry.parameter === 'intensity' && entry.at >= cuePlace.at)).toMatchObject({ status: 'accepted', effective: 0.75 });

        // The figure: a sentence dropped and a <script> refused, the repair admitted, put up as a phrase began.
        expect(of(journal, 2).map(entry => entry.type)).toEqual([
            'illustration.asked', 'illustration.requested', 'illustrator.spoke', 'illustration.refused', 'illustration.requested', 'illustration.admitted', 'illustrated'
        ]);
        const [asked, first, , refused, second, admitted, landed] = of(journal, 2);
        expect(asked).toMatchObject({ rung: 'figure', brief: 'a labelled diagram of the three states of water' });
        expect(refused).toMatchObject({ attempt: 1, rule: 'figure' });
        expect(admitted).toMatchObject({ attempt: 2, medium: 'figure' });
        // It lands at the first phrase that began once it was admitted, at or after its line's place (beat 3).
        const phrase = atoms.find(entry => entry.at >= admitted.at && beatOf(entry.sourceId) >= 3);
        expect(landed.at - phrase.at).toBeGreaterThanOrEqual(0);
        expect(landed.at - phrase.at).toBeLessThan(250);
        await expect.poll(() => page.evaluate(() => window.__pictures.some(item => item.kind === 'figure')), { timeout: 10_000 }).toBe(true);
        const figure = (await page.evaluate(() => window.__pictures)).find(item => item.kind === 'figure');
        expect(figure.at).toBeGreaterThanOrEqual(phrase.at - 50);
        expect(figure.at - phrase.at).toBeLessThan(500);
        await expect(page.locator('#chamber-field[data-picture="figure"] img, #chamber-field[data-picture="figure"] svg').first()).toBeAttached();
        const ms = at => Math.round(at - asked.at);
        console.log(`illustrator (ms from the line's arrival): cue landed ${Math.round(cue.at - cueAsked.at)} with no request, ${Math.round(cue.at - cuePlace.at)} ms after its beat began; figure requested ${ms(first.at)}, refused ${ms(refused.at)} (${refused.rule}), asked again ${ms(second.at)}, admitted ${ms(admitted.at)} (drawn in ${admitted.ms}), put up ${ms(figure.at)}, landed ${ms(landed.at)} ${Math.round(landed.at - phrase.at)} ms after its phrase began (${landed.waitedMs} ms after the reading reached its place)`);

        // The voice never waited: nothing held it, and no silence between phrases beyond its own breath and the seam.
        await expect(stage.getByRole('button', { name: /^Play again/u })).toHaveCount(1, { timeout: 90_000 });
        journal = await hooks.journal();
        expect(journal.filter(entry => ['hold', 'voice.held', 'interjection.held'].includes(entry.type))).toEqual([]);
        const gap = longestGap(journal);
        console.log(`illustrator: the longest silence between two utterances, ${gap} ms`);
        expect(gap).toBeLessThan(1_000);

        // What it cost: three requests, the illustrator's two among them; the demo spends nothing.
        await stage.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.locator('.rise-settings__about summary').click();
        await expect(page.locator('.rise-settings__about-text')).toContainText('requests: 3 (1 answer, 2 illustrator), tokens: none reported (the demo spends nothing)');
        expect(errors).toEqual([]);
    });

    test('the illustrator: a picture refused three times is let go in one line, and the reading goes on to its end', async ({ page }) => {
        test.setTimeout(150_000);
        const { errors, hooks, stage } = await illustrated(page, 'What is a tesseract?');
        await expectShown(page, 'A tesseract is a cube in four dimensions.');
        await expect.poll(async () => (await hooks.journal()).find(entry => entry.type === 'illustration.failed') ?? null, { timeout: 60_000 })
            .toMatchObject({ n: 1, reason: 'REFUSED', attempts: 3 });
        await expect(page.locator('.live-again__note')).toHaveText('RISE could not draw that picture; the reading goes on.');
        const journal = await hooks.journal();
        expect(journal.filter(entry => entry.type === 'illustration.refused').map(entry => entry.attempt)).toEqual([1, 2, 3]);
        expect(journal.filter(entry => entry.type === 'illustration.requested')).toHaveLength(3);
        await expect(stage.getByRole('button', { name: /^Play again/u })).toHaveCount(1, { timeout: 90_000 });
        const ended = await hooks.journal();
        expect(ended.filter(entry => entry.type === 'illustrated')).toEqual([]);
        expect(ended.filter(entry => ['hold', 'voice.held'].includes(entry.type))).toEqual([]);
        expect(longestGap(ended)).toBeLessThan(1_000);
        expect(await page.evaluate(() => window.__pictures.filter(item => item.kind === 'figure'))).toEqual([]);
        expect(errors).toEqual([]);
    });

    test('the illustrator: asked “show me that as a diagram” while it reads, the answer asks for one and it is put up in the reading', async ({ page }) => {
        test.setTimeout(150_000);
        const { errors, hooks } = await illustrated(page, 'What are the three states of water?');
        await expectShown(page, 'Water comes in three states');
        // Part way into the first passage, the reader types into the playing reading, and asks.
        await page.waitForTimeout(1_500);
        const field = page.locator('#live-again-question');
        await field.fill('Show me that as a diagram.');
        await expect.poll(async () => (await hooks.journal()).some(entry => entry.type === 'interjection.held')).toBe(true);
        await field.press('Enter');
        const BRIEF = 'a labelled diagram of ice, water and steam side by side';
        const answered = async () => (await hooks.journal()).find(entry => entry.type === 'illustrated' && entry.brief === BRIEF) ?? null;
        await expect.poll(answered, { timeout: 90_000 }).toMatchObject({ medium: 'figure' });
        const journal = await hooks.journal();
        const askedAt = journal.find(entry => entry.type === 'interjection.asked').at;
        const { n, at } = await answered();
        // Drawn on the first request, from the answer to the reader, while the reading went on.
        expect(journal.filter(entry => entry.type === 'illustration.requested' && entry.n === n)).toHaveLength(1);
        expect(journal.find(entry => entry.type === 'illustration.asked' && entry.n === n).at).toBeGreaterThan(askedAt);
        await expect.poll(() => page.evaluate(() => window.__pictures.some(item => item.kind === 'figure')), { timeout: 10_000 }).toBe(true);
        console.log(`illustrator in an answer to the reader: put up ${Math.round(at - askedAt)} ms after the reader asked`);
        expect(errors).toEqual([]);
    });

    /**
     * Interactive scenes (docs/plans/LIVE-CURRENT.md §20), on the demo and the paced voice. Every message the page posts
     * to a worker is logged by type, so what a scene was given is read from the worker's own message log.
     */
    async function listening(page, question) {
        const errors = watchErrors(page);
        await page.addInitScript(() => {
            window.__workerLog = [];
            const post = Worker.prototype.postMessage;
            Worker.prototype.postMessage = function postMessage(message, transfer) {
                // RISE's face runs in a worker of its own and is given the pointer anywhere in the room (§23): its
                // messages are not the reading's scene's.
                if (message?.type === 'scene/init' && String(message.code).includes('export default function oracle(rise)')) this.isFace = true;
                if (!this.isFace) window.__workerLog.push(message?.type ?? null);
                return post.call(this, message, transfer);
            };
        });
        await page.goto(`${VENUE}&measure=1`);
        await page.locator('#live-venue-question').fill(question);
        await page.locator('#live-venue-question').press('Enter');
        const journal = () => page.evaluate(() => window.__riseLive.journal());
        const inputs = async () => (await journal()).filter(entry => entry.type === 'scene.input');
        const delivered = () => page.evaluate(() => window.__workerLog.filter(type => type === 'scene/input').length);
        return { errors, journal, inputs, delivered };
    }

    test('interactive scenes: the reader drags the input and moves a weight, by pointer and by key; each move is journaled, said, and goes up with the next question', async ({ page }) => {
        test.setTimeout(120_000);
        const { errors, journal, inputs, delivered } = await listening(page, 'How does a neural network learn?');
        await expectShown(page, 'A neural network is a machine for weighing evidence.');
        // The scene's code arrives at a model's pace, behind the three beats said while it is written.
        const canvas = page.locator('canvas.chamber-scene[data-listens="pointer keys"]');
        await expect(canvas).toBeAttached({ timeout: 45_000 });
        await expect(page.locator('.chamber-scene-controls li')).toHaveText(['Weight 1, slider: 1', 'Weight 2, slider: -0.5', 'Input, point: 0.5, 0.5'], { timeout: 10_000 });
        await expect(canvas).toHaveAttribute('role', 'application');

        // The input point, dragged by its region; the journal keeps the drag's last value, once its trailing value is in.
        const point = await page.locator('.chamber-scene-hit[data-control="input"]').boundingBox();
        const [px, py] = [point.x + point.width / 2, point.y + point.height / 2];
        expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.dataset.control, [px, py])).toBe('input');
        await page.mouse.move(px, py);
        await page.mouse.down();
        await page.mouse.move(px - 60, py + 40, { steps: 6 });
        await page.mouse.up();
        await page.waitForTimeout(400);
        const dragged = (await inputs()).find(entry => entry.control === 'input');
        expect(dragged).toMatchObject({ scene: 'network', value: expect.stringMatching(/^-?\d+(\.\d+)?, -?\d+(\.\d+)?$/u) });
        expect(dragged.value).not.toBe('0.5, 0.5');
        await expect(page.locator('.chamber-scene-controls li').nth(2)).toHaveText(`Input, point: ${dragged.value}`);

        // Weight 1, pressed a quarter of the way along its track (x 28 to 198): -1, said in the stage's live region. One press
        // is one input and one move: its round trip, from the press to the journal, on the page's own clock.
        const w1 = await page.locator('.chamber-scene-hit[data-control="w1"]').boundingBox();
        const pressedAt = await page.evaluate(() => performance.now());
        await page.mouse.click(w1.x + 10 + 170 * 0.25, w1.y + w1.height / 2);
        await expect.poll(async () => (await inputs()).find(entry => entry.control === 'w1')?.value ?? null).toBe(-1);
        const weighed = (await inputs()).find(entry => entry.control === 'w1');
        console.log(`interactive scene: a press on Weight 1 to scene.input journaled ${Math.round(weighed.at - pressedAt)} ms (the drag of the input ended at ${dragged.value})`);
        expect(weighed.at - pressedAt).toBeLessThan(1_000);
        await expect(page.locator('.rise-stage__scene-note')).toHaveText('Weight 1 -1');
        await expect(canvas).toBeFocused();

        // The arrows are the focused scene's; Space is still the stage's; Escape gives the focus back to Play.
        await page.keyboard.press('ArrowRight');
        await expect.poll(async () => (await inputs()).find(entry => entry.control === 'w1')?.value ?? null).toBe(-0.9);
        await expect(page.locator('.chamber-scene-controls li').first()).toHaveText('Weight 1, slider: -0.9');
        expect((await journal()).some(entry => entry.type === 'seek')).toBe(false);
        await page.keyboard.press('Space');
        await expect.poll(async () => (await journal()).some(entry => entry.type === 'interrupt')).toBe(true);
        await page.keyboard.press('Escape');
        await expect(page.locator('#rise-stage-controls [data-stage="play"]')).toBeFocused();
        expect(new URL(page.url()).pathname).toBe('/live');
        expect(await delivered()).toBeGreaterThan(0);

        // Asked again, the moves go up as the reader's, in words of action.
        await expect(page.getByRole('form', { name: 'Ask again' })).toBeVisible();
        await page.locator('#live-again-question').fill('What did my weights do?');
        await page.locator('#live-again-question').press('Enter');
        await expect.poll(() => page.evaluate(() => window.__riseLive.perception()), { timeout: 15_000 }).not.toBeNull();
        const sent = await page.evaluate(() => window.__riseLive.perception());
        expect(sent.events).toEqual(expect.arrayContaining([
            { type: 'scene.input', scene: 'network', control: 'input', value: dragged.value },
            { type: 'scene.input', scene: 'network', control: 'w1', value: -0.9 }
        ]));
        const block = describePerception(sent);
        expect(block).toContain('- set w1 in the scene network to -0.9');
        expect(block).toContain(`- set input in the scene network to “${dragged.value}”`);
        console.log(`interactive scene: the next question carried\n${block}`);
        expect(errors).toEqual([]);
    });

    test('interactive scenes: the words keep their own drag over a listening scene, and a press on them is no input to it', async ({ page }) => {
        test.setTimeout(90_000);
        const { errors, inputs } = await listening(page, 'How does a neural network learn?');
        await expect(page.locator('canvas.chamber-scene[data-listens]')).toBeAttached({ timeout: 45_000 });
        await expectShown(page, 'Here is the smallest one there is');
        const band = page.locator('#atom-display');
        const offset = () => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#chamber-field')).getPropertyValue('--band-offset')) || 0);
        const drag = async dy => {
            const box = await band.boundingBox();
            const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
            expect(await page.evaluate(([X, Y]) => document.querySelector('#atom-display').contains(document.elementFromPoint(X, Y)), [x, y])).toBe(true);
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x, y + dy, { steps: 8 });
            await page.mouse.up();
        };
        await drag(0);
        await expect(band).toHaveClass(/is-band-movable/u);
        const before = await offset();
        await drag(-80);
        expect(await offset()).toBeLessThan(before - 10);
        expect(await inputs()).toEqual([]);
        expect(errors).toEqual([]);
    });

    test('interactive scenes: a scene that does not declare it listens is given nothing, and its canvas stays inert and hidden', async ({ page }) => {
        test.setTimeout(90_000);
        const { errors, delivered, inputs } = await listening(page, 'Explain black holes with RISE.');
        const canvas = page.locator('canvas.chamber-scene');
        await expect(canvas).toBeAttached({ timeout: 40_000 });
        await expect(canvas).not.toHaveAttribute('data-listens', /./u);
        await expect(canvas).toHaveAttribute('aria-hidden', 'true');
        const box = await canvas.boundingBox();
        const [x, y] = [box.x + box.width / 2, box.y + box.height * 0.3];
        expect(await page.evaluate(([X, Y]) => document.elementFromPoint(X, Y)?.matches('canvas.chamber-scene') ?? false, [x, y])).toBe(false);
        await page.mouse.click(x, y);
        await page.mouse.move(x + 40, y + 20, { steps: 5 });
        await canvas.evaluate(node => node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 })));
        await page.keyboard.press('a');
        expect(await delivered()).toBe(0);
        expect(await inputs()).toEqual([]);
        expect(await page.locator('.chamber-scene-controls, .chamber-scene-hits').count()).toBe(0);
        expect(errors).toEqual([]);
    });

    test('interactive scenes: a scene that emits junk, a thousand values a press, is bounded with refusal notes, and the reading goes on to its end', async ({ page }) => {
        test.setTimeout(120_000);
        const { errors, journal, inputs } = await listening(page, 'Show me a scene that misbehaves');
        const canvas = page.locator('canvas.chamber-scene[data-listens="pointer keys"]');
        await expect(canvas).toBeAttached({ timeout: 20_000 });
        const box = await canvas.boundingBox();
        for (let i = 0; i < 12; i += 1) await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3, { delay: 10 });
        await expect.poll(async () => (await journal()).filter(entry => entry.type === 'scene.input.refused').map(entry => entry.reason), { timeout: 10_000 })
            .toEqual(expect.arrayContaining(['controls', 'unprompted', 'value']));
        const refused = (await journal()).filter(entry => entry.type === 'scene.input.refused');
        expect(refused.length).toBeLessThanOrEqual(16);
        expect(refused).toEqual(expect.arrayContaining([
            expect.objectContaining({ scene: 'unruly', control: 'shape', reason: 'value' }),
            expect.objectContaining({ scene: 'unruly', control: 'note', reason: 'value' }),
            expect.objectContaining({ scene: 'unruly', control: 'count', reason: 'unprompted' })
        ]));
        const moved = await inputs();
        expect(moved.length).toBeLessThanOrEqual(64);
        expect(new Set(moved.map(entry => entry.control)).size).toBe(moved.length);
        await expectShown(page, 'Whatever it says, the reading goes on.', 40_000);
        await expect.poll(async () => (await journal()).some(entry => entry.type === 'run.finished'), { timeout: 30_000 }).toBe(true);
        expect((await journal()).some(entry => entry.type === 'scene.refused')).toBe(false);
        expect(errors).toEqual([]);
    });
});

test.describe('a provider voice on the reader’s key (design §8 stage 7)', () => {
    /** ElevenLabs as the venue would reach it: silence of 40 ms a character, with the alignment that spells the text. */
    async function serveElevenLabs(page) {
        const requests = [];
        await page.route('https://api.elevenlabs.io/**', async route => {
            const body = route.request().postDataJSON();
            requests.push({ text: body.text, speed: body.voice_settings?.speed, key: route.request().headers()['xi-api-key'] });
            const msPerChar = 40;
            const samples = Math.round((body.text.length * msPerChar / 1000) * 22050);
            const audio_base64 = Buffer.alloc(samples * 2).toString('base64');
            const characters = [...body.text];
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    audio_base64,
                    alignment: {
                        characters,
                        character_start_times_seconds: characters.map((_, i) => (i * msPerChar) / 1000),
                        character_end_times_seconds: characters.map((_, i) => ((i + 1) * msPerChar) / 1000)
                    }
                })
            });
        });
        return requests;
    }

    test('speaks each passage from the provider, holds and takes up exactly, replays from what was fetched, and says so in About', async ({ page }) => {
        test.setTimeout(120_000);
        const errors = watchErrors(page);
        const requests = await serveElevenLabs(page);
        await page.goto(`/live?measure=1`);
        await page.getByRole('button', { name: /^Who speaks/u }).click();
        await page.locator('input[name="live-venue-voice"][value="elevenlabs"]').check();
        await page.locator('#live-venue-voice-key').fill('xi-e2e-key');
        await page.locator('#live-venue-question').fill('Explain black holes with RISE.');
        await page.locator('#live-venue-question').press('Enter');
        // Out of the page as soon as it is in memory: the field is emptied at Ask.
        await expect(page.locator('#live-venue-voice-key')).toHaveValue('');
        await expectShown(page, 'A black hole is a region of space');
        const journal = () => page.evaluate(() => window.__riseLive.journal().filter(entry => entry.role === 'main'));
        await expect.poll(async () => (await journal()).filter(entry => entry.type === 'speech.start').length, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
        const chosen = (await journal()).find(entry => entry.type === 'voice.chosen');
        expect(chosen).toMatchObject({ kind: 'elevenlabs', name: 'ElevenLabs Rachel', local: false });
        expect(requests.length).toBeGreaterThanOrEqual(2);
        expect(requests.every(request => request.key === 'xi-e2e-key')).toBe(true);
        // The provider's clock: a passage of n characters ends about 40 ms × n after it began.
        const ended = (await journal()).find(entry => entry.type === 'speech.end');
        const said = requests.find(request => request.text.length * 40 > 0);
        expect(ended.durationMs).toBeGreaterThan(said.text.length * 40 * 0.8);

        const stage = page.locator('#rise-stage-controls');
        const play = stage.locator('[data-stage="play"]');
        await play.click();
        await expect.poll(async () => (await journal()).some(entry => entry.type === 'voice.held'), { timeout: 5_000 }).toBe(true);
        const fetchedBeforeReplay = requests.length;
        await play.click();
        await expect(play).toHaveAttribute('aria-label', /^Pause/u);
        await stage.locator('[data-stage="replay"]').click();
        await expect.poll(() => page.evaluate(() => window.__riseLive.journal().filter(entry => entry.type === 'replay').length), { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
        await page.waitForTimeout(500);
        // What was fetched is kept for the reading: a replay asks the provider for nothing.
        expect(requests.length).toBe(fetchedBeforeReplay);

        await stage.locator('[data-stage="settings"]').click();
        await stage.locator('.rise-settings__about summary').click();
        await expect(stage.locator('.rise-settings__about-text')).toContainText(/voice: elevenlabs "ElevenLabs Rachel" model=eleven_flash_v2_5 chars=\d+ \(your key\)/u);
        await expect(stage.locator('.rise-settings__about-text')).not.toContainText('xi-e2e-key');
        expect(errors).toEqual([]);
    });

    test('a refused key is said in the reader’s words, and the reading goes on paced', async ({ page }) => {
        test.setTimeout(90_000);
        await page.route('https://api.elevenlabs.io/**', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: { status: 'invalid_api_key' } }) }));
        await page.goto(`/live?measure=1`);
        await page.getByRole('button', { name: /^Who speaks/u }).click();
        await page.locator('input[name="live-venue-voice"][value="elevenlabs"]').check();
        await page.locator('#live-venue-voice-key').fill('xi-bad-key');
        await page.locator('#live-venue-question').fill('Explain black holes with RISE.');
        await page.locator('#live-venue-question').press('Enter');
        await expectShown(page, 'A black hole is a region of space');
        const journal = () => page.evaluate(() => window.__riseLive.journal().filter(entry => entry.role === 'main'));
        await expect.poll(async () => (await journal()).find(entry => entry.type === 'voice.failed')?.message ?? '', { timeout: 20_000 }).toContain('ElevenLabs did not accept the key');
        await expect.poll(async () => (await journal()).some(entry => entry.type === 'voice.degraded'), { timeout: 20_000 }).toBe(true);
        await expectShown(page, 'that nothing, not even light', 30_000);
    });
});
