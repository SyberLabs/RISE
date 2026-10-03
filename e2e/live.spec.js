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

const OPEN = '/live?voice=paced';
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
        if (message.type() === 'error') errors.push(`console: ${message.text().slice(0, 200)}`);
    });
    return errors;
}

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

    test('keeps every Dive: a question asked inside one is a follow-up in the same Dive, and it is still there after Surface', async ({ page }) => {
        const errors = watchErrors(page);
        await start(page);
        await expectShown(page, 'that nothing, not even light');
        await page.getByRole('button', { name: 'Interrupt', exact: true }).click();
        const heldAt = await shown(page);

        await page.locator('#live-controls-question').fill('dive on event horizon');
        await page.getByRole('button', { name: /Dive: ask about this place/u }).click();
        await expect(status(page)).toContainText('answered', { timeout: 20_000 });
        // In a Dive: where the reader is, where Surface goes back to, and the Dive in the panel.
        await expect(page.locator('.live-controls__crumb')).toContainText('Main › Dive 1: “dive on event horizon”');
        await expect(page.locator('.live-controls__crumb')).toContainText('Surface returns to:');
        await expect(page.locator('.live-controls__undercurrent summary').first()).toHaveText('Undercurrent (1)');

        // Another question inside it is another turn of the same Dive, not a second Dive.
        await page.locator('#live-controls-question').fill('and what is it like at the horizon?');
        await page.getByRole('button', { name: 'Ask a follow-up in this Dive', exact: true }).click();
        await expect(page.locator('.live-controls__crumb')).toContainText('and what is it like at the horizon?');
        await expect(status(page)).toContainText('answered', { timeout: 20_000 });
        await expect(page.locator('.live-controls__undercurrent summary').first()).toHaveText('Undercurrent (1)');
        await expect(page.locator('.live-undercurrent > li')).toHaveCount(1);
        await expect(page.locator('.live-undercurrent > li summary')).toContainText('2 questions');

        await page.getByRole('button', { name: 'Surface', exact: true }).click();
        await expect(page.locator('.live-controls__crumb')).toBeHidden();
        expect(await shown(page)).toBe(heldAt);

        // Kept after Surface, and marked where it was taken from; the marker opens it.
        await expect(page.locator('.live-controls__undercurrent summary').first()).toHaveText('Undercurrent (1)');
        await page.locator('.live-controls__transcript summary').click();
        const marker = page.locator('.live-controls__forks button').first();
        await expect(marker).toContainText('Dive 1: “dive on event horizon”');
        await marker.click();
        const entry = page.locator('.live-undercurrent details[data-dive="dive-1"]');
        await expect(entry).toHaveAttribute('open', '');
        await expect(entry).toContainText('You asked: dive on event horizon');
        await expect(entry).toContainText('You asked: and what is it like at the horizon?');
        await expect(entry).toContainText('The event horizon is where the speed needed to escape');

        await page.getByRole('button', { name: 'Stop', exact: true }).click();
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
        await start(page, '/live?voice=browser');
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
