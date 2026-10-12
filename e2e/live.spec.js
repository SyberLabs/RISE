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
        await expect(page.getByRole('radio', { name: 'Demo (no key)' })).toBeChecked();
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
        console.log(`illustrator (ms from the line's arrival): cue landed ${Math.round(cue.at - cueAsked.at)} with no request; figure requested ${ms(first.at)}, refused ${ms(refused.at)} (${refused.rule}), asked again ${ms(second.at)}, admitted ${ms(admitted.at)} (drawn in ${admitted.ms}), put up ${ms(figure.at)}, landed ${ms(landed.at)} ${Math.round(landed.at - phrase.at)} ms after its phrase began (${landed.waitedMs} ms after the reading reached its place)`);

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
});
