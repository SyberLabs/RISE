/**
 * The study instrument, in a real browser: one participant per condition, from
 * consent to the record they take away, and the later questions.
 *
 * These prove the instrument works and keeps its promises (nothing identifies
 * a person, nothing is sent, nothing is stored). They do not prove anything
 * about RISE: that needs people, and has not been done.
 */
import { readFileSync } from 'node:fs';
import { CONDITION_IDS, conditionFor, RECORD_SCHEMA, validateRecord } from '../src/live/eval/study.js';
import { expect, test } from './fixtures.js';

/** A participant number that lands in `condition`, under seed 1. */
const numberFor = condition => [0, 1, 2, 3].find(n => conditionFor(n, 1) === condition);
const open = (condition, extra = '') => `/live?eval=1&n=${numberFor(condition)}&seed=1${extra}`;

async function agree(page) {
    await expect(page.locator('h1')).toHaveText('A short study');
    await expect(page.locator('.live-start')).toBeDisabled();
    await page.locator('#live-eval-agree').check();
    await page.locator('.live-start').click();
    await page.locator('.live-start').click();
}

/** Answer every question with the right answer (value 0 is the original meaning), rate, and finish. */
async function answer(page, { rated = 5 } = {}) {
    await expect(page.locator('h1')).toHaveText('What did you take from it?');
    const groups = await page.locator('fieldset.live-eval__question:not(.live-eval__rating)').count();
    expect(groups).toBe(8);
    for (const name of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'e1', 'o1']) await page.locator(`input[name="${name}"][value="0"]`).check();
    for (const rating of await page.locator('fieldset.live-eval__rating').all()) await rating.locator(`input[value="${rated}"]`).check();
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.locator('h1')).toHaveText('Thank you');
}

async function takeRecord(page) {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download my answers' }).click()]);
    const path = await download.path();
    return { name: download.suggestedFilename(), value: JSON.parse(readFileSync(path, 'utf8')), path };
}

function watch(page) {
    const requests = [];
    const errors = [];
    page.on('request', request => requests.push(`${request.method()} ${request.url()}`));
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text().slice(0, 200)}`); });
    return { requests, errors };
}

test.describe('the study instrument', () => {
    test('a participant in the text condition: consent, the answer, the questions, a record that names no one, and nothing sent or stored', async ({ page }) => {
        const { requests, errors } = watch(page);
        await page.goto(open('text'));
        await expect(page.locator('body')).toContainText('nothing you do here leaves this device');
        // The app keeps a little of its own; the study must add nothing to it.
        const storedBefore = await page.evaluate(() => JSON.stringify([Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort()]));
        await agree(page);

        const article = page.locator('.live-eval__article');
        await expect(article).toContainText('A black hole is a region of space');
        await expect(article).toContainText('Source: First M87 Event Horizon Telescope Results');
        await expect(article).toContainText('You asked, about the event horizon: dive on event horizon');
        await expect(article).toContainText('The event horizon is where the speed needed to escape');
        await page.getByRole('button', { name: 'I have finished reading' }).click();

        await page.getByRole('button', { name: 'Finish' }).click();
        await expect(page.locator('.live-error')).toHaveText('Please answer every question. A guess is fine.');
        await answer(page);

        const { name, value } = await takeRecord(page);
        const storedAfter = await page.evaluate(() => JSON.stringify([Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort()]));
        expect(storedAfter).toBe(storedBefore);
        expect(name).toMatch(/^rise-study-[0-9a-f]{12}\.json$/u);
        expect(() => validateRecord(value)).not.toThrow();
        expect(value).toMatchObject({ schema: RECORD_SCHEMA, condition: 'text' });
        expect(value.answers).toEqual({ c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0, e1: 0, o1: 0 });
        expect(value.ratings).toEqual({ coherence: 5 });
        expect(Object.keys(value).sort()).toEqual(['answers', 'condition', 'environment', 'finishedAt', 'participantId', 'ratings', 'schema', 'startedAt']);
        expect(JSON.stringify(value)).not.toMatch(/name|email|@|http/iu);

        // Nothing left the device, and nothing was kept on it.
        expect(requests.filter(line => line.startsWith('POST'))).toEqual([]);
        expect(requests.filter(line => !line.includes('localhost'))).toEqual([]);
        expect(await page.evaluate(id => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]).includes(id), value.participantId)).toBe(false);
        expect(errors).toEqual([]);
    });

    test('the later questions: open the file, answer the six again, and the file comes back with them added', async ({ page }) => {
        await page.goto(open('text'));
        await agree(page);
        await page.getByRole('button', { name: 'I have finished reading' }).click();
        await answer(page);
        const { path } = await takeRecord(page);

        await page.goto('/live?eval=later');
        await expect(page.locator('h1')).toHaveText('The later questions');
        await page.locator('#live-eval-file').setInputFiles(path);
        await expect(page.locator('h1')).toHaveText('The same six questions');
        for (const name of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']) await page.locator(`input[name="${name}"][value="1"]`).check();
        await page.getByRole('button', { name: 'Finish' }).click();
        const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download the updated file' }).click()]);
        const updated = validateRecord(JSON.parse(readFileSync(await download.path(), 'utf8')));
        expect(updated.delayed.answers).toEqual({ c1: 1, c2: 1, c3: 1, c4: 1, c5: 1, c6: 1 });
        expect(updated.answers.c1).toBe(0);

        await page.goto('/live?eval=later');
        await page.locator('#live-eval-file').setInputFiles(download.path ? await download.path() : path);
        await expect(page.locator('.live-error')).toHaveText('These questions were already answered.');
    });

    test('is one condition per participant, in balance, and never a second', async ({ page }) => {
        const seen = new Set();
        for (let n = 0; n < 4; n += 1) {
            await page.goto(`/live?eval=1&n=${n}&seed=1`);
            await page.locator('#live-eval-agree').check();
            await page.locator('.live-start').click();
            await expect(page.locator('body')).toContainText(`Condition ${['Text', 'Spoken', 'Spoken, with a generic visualizer', 'A live Current'][CONDITION_IDS.indexOf(conditionFor(n, 1))]}.`);
            seen.add(conditionFor(n, 1));
        }
        expect(seen.size).toBe(4);
    });

    test('spoken over a generic visualizer, with a voice that speaks: the field is behind it, the voice is recorded as a voice, and it goes on to the questions', async ({ page }) => {
        const errors = watch(page).errors;
        await page.addInitScript(() => {
            class Utterance { constructor(text) { this.text = text; } }
            const words = text => [...text.matchAll(/\S+/gu)].map(match => match.index);
            window.__spoken = [];
            Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
                getVoices: () => [{ name: 'Fake', lang: 'en' }],
                addEventListener() {}, removeEventListener() {},
                queue: [],
                speak(utterance) { this.queue.push(utterance); if (this.queue.length === 1) this.run(); },
                run() {
                    const utterance = this.queue[0];
                    window.__spoken.push(utterance.text.slice(0, 30));
                    setTimeout(() => utterance.onstart?.({}), 2);
                    words(utterance.text).forEach((charIndex, i) => setTimeout(() => utterance.onboundary?.({ name: 'word', charIndex }), 4 + i * 3));
                    setTimeout(() => { this.queue.shift(); utterance.onend?.({}); if (this.queue.length) this.run(); }, 6 + words(utterance.text).length * 3);
                },
                cancel() { this.queue.length = 0; }, pause() {}, resume() {}
            } });
            window.SpeechSynthesisUtterance = Utterance;
        });
        await page.goto(open('spoken-visualizer'));
        await agree(page);
        await expect(page.locator('.live-eval__field canvas')).toHaveCount(1);
        await expect(page.locator('.live-eval__status')).toHaveText('The answer has finished.', { timeout: 30_000 });
        const said = await page.evaluate(() => window.__spoken);
        expect(said[0]).toContain('A black hole is a region of');
        await page.getByRole('button', { name: 'Continue' }).click();
        await answer(page);
        const { value } = await takeRecord(page);
        expect(value.condition).toBe('spoken-visualizer');
        expect(value.environment.voice).toBe('browser');
        expect(value.ratings).toEqual({ coherence: 5, informative: 5, decorative: 5 });
        expect(errors).toEqual([]);
    });

    test('a live Current: the real runtime, a prompt to ask about the horizon, the questions afterwards, and a record that says the participant asked', async ({ page }) => {
        test.setTimeout(150_000);
        const errors = watch(page).errors;
        await page.goto(open('rise-current', '&voice=paced'));
        await agree(page);
        await expect(page.locator('#live-eval-guide')).toContainText('dive on event horizon');
        await expect(page.locator('#live-controls')).toBeVisible();
        // The passage about the size of the horizon comes in three atoms; any of them is the place to ask.
        await expect.poll(() => page.locator('#atom-display').innerText().catch(() => ''), { timeout: 30_000 })
            .toMatch(/For a black hole|that does not spin|kilometres from the centre/u);
        await page.locator('#live-controls-question').fill('dive on event horizon');
        await page.locator('#live-controls-question').press('Enter');
        await expect(page.locator('.live-controls__status')).toContainText('answered', { timeout: 30_000 });
        await page.getByRole('button', { name: 'Surface', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Continue to the questions' })).toBeVisible({ timeout: 90_000 });
        await page.getByRole('button', { name: 'Continue to the questions' }).click();
        await answer(page, { rated: 6 });
        const { value } = await takeRecord(page);
        expect(value.condition).toBe('rise-current');
        expect(value.environment).toMatchObject({ dived: true, voice: 'paced' });
        expect(value.ratings).toEqual({ coherence: 6, informative: 6, decorative: 6 });
        expect(errors).toEqual([]);
    });
});
