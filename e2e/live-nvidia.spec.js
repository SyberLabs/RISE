/**
 * The NVIDIA provider in the Live venue, in a real browser, with no NVIDIA.
 *
 * NVIDIA's endpoint is answered by the test in its OpenAI-compatible form (chat completions chunks, the usage chunk,
 * `[DONE]`; a refusal is NVIDIA's problem document), so this runs offline and spends nothing. It proves the venue,
 * the adapter, the key handling and the reading, end to end in the page. It does NOT prove NVIDIA: the wire is the
 * documented one, hand-written, no session has been run on a real key, and NVIDIA's own preflight today refuses this
 * site's origin (the last test replays that refusal). See src/live/adapters/nvidia.js and docs/plans/LIVE-NVIDIA.md.
 */
import { BLACK_HOLES } from '../src/live/fixtures/black-holes.js';
import { fakeNvidiaKey, openaiChunk, openaiClose, openaiOpen, openaiText } from '../src/test/fake-direct-fetch.js';
import { scriptToLines } from '../src/test/fake-text-transport.js';
import { expect, test } from './fixtures.js';

const KEY = fakeNvidiaKey();
const VENUE = '/live?voice=paced';
const NVIDIA = 'https://integrate.api.nvidia.com/**';
const CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const UNREACHABLE = 'NVIDIA’s API lets a browser reach it only from NVIDIA’s own sites today, so it may refuse this page.';

const shown = async page => (await page.locator('#atom-display').innerText()).replace(/\s+/gu, ' ').trim();
const expectShown = (page, phrase, timeout = 12_000) =>
    expect.poll(() => shown(page).catch(() => ''), { timeout, message: `waiting to see “${phrase}”` }).toContain(phrase);

/** NVIDIA's answer: the words in pieces, then the finish, the usage and [DONE]. */
function stream(text) {
    const sizes = [7, 19, 3, 31, 11, 23];
    const chunks = [...openaiOpen()];
    for (let at = 0, count = 0; at < text.length; count += 1) {
        const size = sizes[count % sizes.length];
        chunks.push(openaiText(text.slice(at, at + size)));
        at += size;
    }
    return [...chunks, ...openaiClose('stop')].join('');
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'POST' };

/** Answer NVIDIA, recording what it was asked. */
async function nvidia(page, { status = 200, problem, hold } = {}) {
    const asked = [];
    await page.route(NVIDIA, async route => {
        const request = route.request();
        if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
        asked.push({ url: request.url(), method: request.method(), headers: request.headers(), body: JSON.parse(request.postData() ?? '{}') });
        if (hold) await hold;
        try {
            if (status !== 200) {
                await route.fulfill({ status, headers: CORS, contentType: 'application/problem+json', body: JSON.stringify(problem) });
                return;
            }
            await route.fulfill({ status: 200, headers: CORS, contentType: 'text/event-stream', body: stream(scriptToLines(BLACK_HOLES)) });
        } catch { /* the page stopped the request first */ }
    });
    return asked;
}

/** Everything the page asks for, so that where the key went can be said. */
function watchRequests(page) {
    const seen = [];
    page.on('request', request => seen.push({ url: request.url(), headers: request.headers(), body: request.postData() ?? '' }));
    return seen;
}

const holdsKey = request => JSON.stringify(request).includes(KEY);

/** Choose NVIDIA under Who answers, and type the key and the question. */
async function askNvidia(page, words = 'Explain black holes with RISE.', key = KEY) {
    await page.getByRole('button', { name: /^Who answers:/u }).click();
    await page.getByRole('radio', { name: 'NVIDIA (your key)' }).check();
    if (key) await page.getByLabel('Your NVIDIA key').fill(key);
    await page.locator('#live-venue-question').fill(words);
    await page.locator('#live-venue-question').press('Enter');
}

test.describe('the NVIDIA provider with the reader’s own key, in the venue', () => {
    test('asks for the key, sends it to NVIDIA in one header and nowhere else, reads the answer, and names NVIDIA and the model in About', async ({ page }) => {
        const requests = watchRequests(page);
        const asked = await nvidia(page);
        await page.goto(VENUE);
        await page.getByRole('button', { name: /^Who answers:/u }).click();
        await page.getByRole('radio', { name: 'NVIDIA (your key)' }).check();
        await expect(page.getByLabel('Your NVIDIA key')).toHaveAttribute('type', 'password');
        await expect(page.locator('.live-venue__note')).toHaveText(UNREACHABLE);
        await expect(page.locator('.live-venue__privacy')).toContainText('Your NVIDIA key stays in this page’s memory and goes only to NVIDIA');

        // No key, no request.
        await page.locator('#live-venue-question').fill('Explain black holes with RISE.');
        await page.locator('#live-venue-question').press('Enter');
        await expect(page.locator('.live-error')).toHaveText('Enter your NVIDIA key to use this provider.');
        expect(asked).toEqual([]);

        await page.getByRole('button', { name: 'Who answers: NVIDIA' }).click();
        await page.getByLabel('Your NVIDIA key').fill(KEY);
        await page.locator('#live-venue-question').press('Enter');
        await expectShown(page, 'A black hole is a region of space');

        // One request, to NVIDIA, with the key in its bearer header and nowhere else.
        expect(asked).toHaveLength(1);
        expect(asked[0]).toMatchObject({ url: CHAT_URL, method: 'POST' });
        expect(asked[0].headers.authorization).toBe(`Bearer ${KEY}`);
        expect(JSON.stringify(asked[0].body)).not.toContain(KEY);
        expect(asked[0].body).toMatchObject({ model: 'nvidia/nemotron-3.5-lightning-30b-a3b', stream: true, max_tokens: 4096 });
        // The key is not in the page, and went nowhere but NVIDIA.
        expect(await page.content()).not.toContain(KEY);
        for (const request of requests.filter(item => !item.url.startsWith('https://integrate.api.nvidia.com/'))) {
            expect(holdsKey(request), request.url).toBe(false);
        }

        const stage = page.locator('#rise-stage-controls');
        await stage.getByRole('button', { name: 'Settings', exact: true }).click();
        await expect(page.locator('.rise-settings__about-text')).toContainText('RISE, speaking through nvidia/nemotron-3.5-lightning-30b-a3b via NVIDIA, on your key');
    });

    test('says in words that the key was refused, never says the key, and forgets it', async ({ page }) => {
        const asked = await nvidia(page, { status: 403, problem: { status: 403, title: 'Forbidden', detail: `Authorization failed for ${KEY}` } });
        await page.goto(VENUE);
        await askNvidia(page);
        await expect(page.locator('.live-error')).toHaveText('Could not start: NVIDIA did not accept your key: Authorization failed for [key]');
        expect(await page.content()).not.toContain(KEY);
        expect(asked).toHaveLength(1);
        // Forgotten: asking again needs the key again, and sends nothing.
        await page.locator('#live-venue-question').press('Enter');
        await expect(page.locator('.live-error')).toHaveText('Enter your NVIDIA key to use this provider.');
        expect(asked).toHaveLength(1);
    });

    test('while NVIDIA is still connecting, asking again sends nothing more, and the one answer that arrives is read', async ({ page }) => {
        // The venue offers no Stop while it connects (the stage's Play is disabled and the bar is not yet shown), so what
        // a reader can do is ask again; that the adapter aborts a request stopped while it is being made is nvidia.test.js's.
        let release;
        const hold = new Promise(resolve => { release = resolve; });
        const asked = await nvidia(page, { hold });
        await page.goto(VENUE);
        await askNvidia(page);
        await expect.poll(() => asked.length).toBe(1);
        await expect(page.locator('#rise-stage-controls [data-stage="play"]')).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Ask', exact: true })).toBeDisabled();
        await page.locator('#live-venue-question').press('Enter');
        await page.waitForTimeout(500);
        expect(asked).toHaveLength(1);
        release();
        await expectShown(page, 'A black hole is a region of space');
        expect(asked).toHaveLength(1);
        expect(await page.content()).not.toContain(KEY);
    });

    test('when the browser cannot send the request, as NVIDIA’s preflight makes it today, says why that is likely and keeps the key', async ({ page }) => {
        // integrate.api.nvidia.com answered an OPTIONS from https://rise.syberlabs.io on 2026-10-26 with 200 and no
        // CORS headers, so the browser refuses the request as a network failure ("Failed to fetch"). Playwright's
        // interception does not apply CORS to its own answers, so that failure is replayed here as the network error it is.
        await page.route(NVIDIA, route => (route.request().method() === 'OPTIONS' ? route.fulfill({ status: 200, body: '' }) : route.abort('failed')));
        await page.goto(VENUE);
        await askNvidia(page);
        await expect(page.locator('.live-error')).toHaveText(`Could not start: Could not reach NVIDIA: Failed to fetch. ${UNREACHABLE}`);
        expect(await page.content()).not.toContain(KEY);
        // Not a refusal of the key: it is kept for another try.
        await page.locator('#live-venue-question').press('Enter');
        await expect(page.locator('.live-error')).not.toHaveText('Enter your NVIDIA key to use this provider.');
    });
});
