/**
 * The Gemini provider, in a real browser, with no Google.
 *
 * Google's endpoint is answered by the test, in the documented form (server-sent
 * events of GenerateContentResponse, and an error is `{"error": {...}}`), so this
 * runs offline and spends nothing. It proves the host, the transport, the key
 * handling and the reading, end to end in the page. It does NOT prove Google: the
 * wire is the documented one, hand-written, and no live session has been run.
 * See src/live/adapters/gemini-wire.js and docs/plans/LIVE-GEMINI.md.
 */
import { scriptToLines } from '../src/test/fake-text-transport.js';
import { BLACK_HOLES, HORIZON_DIVE } from '../src/live/fixtures/black-holes.js';
import { expect, test } from './fixtures.js';

const KEY = 'AIzaSyD-not-a-real-key-000000000000000';
const OPEN = '/live?provider=gemini&voice=paced';
const GOOGLE = 'https://generativelanguage.googleapis.com/**';
const MODEL_URL = model => `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

const shown = async page => (await page.locator('#atom-display').innerText()).replace(/\s+/gu, ' ').trim();
const expectShown = (page, phrase, timeout = 12_000) =>
    expect.poll(() => shown(page).catch(() => ''), { timeout, message: `waiting to see “${phrase}”` }).toContain(phrase);

/** Google's answer: the words in pieces, then a frame that says it is finished. */
function stream(text) {
    const sizes = [7, 19, 3, 31, 11, 23];
    const frames = [];
    for (let at = 0, count = 0; at < text.length; count += 1) {
        const size = sizes[count % sizes.length];
        frames.push({ candidates: [{ content: { role: 'model', parts: [{ text: text.slice(at, at + size) }] }, index: 0 }], modelVersion: 'fake' });
        at += size;
    }
    frames.push({ candidates: [{ content: { role: 'model', parts: [{ text: '' }] }, finishReason: 'STOP', index: 0 }] });
    return frames.map(frame => `data: ${JSON.stringify(frame)}\r\n\r\n`).join('');
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type,x-goog-api-key', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

/** Answer Google, recording what it was asked. */
async function google(page, { answer = scriptToLines(BLACK_HOLES), dive = scriptToLines(HORIZON_DIVE), status = 200, error, hold } = {}) {
    const asked = [];
    await page.route(GOOGLE, async route => {
        const request = route.request();
        if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
        const body = JSON.parse(request.postData() ?? '{}');
        asked.push({ url: request.url(), method: request.method(), headers: request.headers(), body });
        if (hold) await hold;
        if (status !== 200) {
            await route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(error ?? { error: { code: status, message: 'nope', status: 'X' } }) });
            return;
        }
        const text = body.contents[0].parts[0].text.startsWith('The reader stopped') ? dive : answer;
        await route.fulfill({ status: 200, headers: CORS, contentType: 'text/event-stream', body: stream(text) });
    });
    return asked;
}

/** Everything the page asks for, so that where the key went can be said. */
function watchRequests(page) {
    const seen = [];
    page.on('request', request => seen.push({ url: request.url(), headers: request.headers(), body: request.postData() ?? '' }));
    return seen;
}

function watchErrors(page) {
    const errors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
        if (message.type() === 'error' && !/Failed to load resource/u.test(message.text())) errors.push(`console: ${message.text().slice(0, 200)}`);
    });
    return errors;
}

const holdsKey = request => JSON.stringify(request).includes(KEY);

test.describe('the Gemini provider with the reader’s own key', () => {
    test('asks for the key, sends it to Google in one header and nowhere else, reads the answer, and Dives on a second request', async ({ page }) => {
        const errors = watchErrors(page);
        const requests = watchRequests(page);
        const asked = await google(page);
        await page.goto(OPEN);

        await expect(page.locator('.live-provider')).toContainText('Google Gemini, with your own key');
        await expect(page.locator('#live-key')).toHaveAttribute('type', 'password');
        await expect(page.locator('#live-model')).toHaveValue('gemini-3.5-flash');
        await expect(page.locator('.live-key-note')).toContainText('straight to Google, never to this site');
        await page.locator('.live-start').click();
        await expect(page.locator('.live-error')).toHaveText('Enter your Gemini key to use this provider.');
        expect(asked).toEqual([]);

        await page.locator('#live-key').fill(KEY);
        await page.locator('.live-start').click();
        await expect(page.locator('#live-controls')).toBeVisible();
        await expectShown(page, 'A black hole is a region of space');
        await expect(page.locator('.live-controls__status')).toContainText(/paced as if spoken/u);

        // One request, to Google, with the key in its header and nowhere else.
        expect(asked).toHaveLength(1);
        expect(asked[0].method).toBe('POST');
        expect(asked[0].url).toBe(MODEL_URL('gemini-3.5-flash'));
        expect(asked[0].headers['x-goog-api-key']).toBe(KEY);
        expect(asked[0].url).not.toContain(KEY);
        expect(JSON.stringify(asked[0].body)).not.toContain(KEY);
        // What was asked is the prompt as text, RISE's instructions apart from it, and a cap; no tools, no audio.
        expect(Object.keys(asked[0].body).sort()).toEqual(['contents', 'generationConfig', 'systemInstruction']);
        expect(asked[0].body.contents).toEqual([{ role: 'user', parts: [{ text: 'Explain black holes with RISE.' }] }]);
        expect(asked[0].body.generationConfig).toEqual({ maxOutputTokens: 4096 });
        // The key is not in the page, and did not go to this site or anywhere but Google.
        expect(await page.locator('#live-key').inputValue().catch(() => '')).toBe('');
        expect(await page.content()).not.toContain(KEY);
        for (const request of requests.filter(item => !item.url.startsWith('https://generativelanguage.googleapis.com/'))) {
            expect(holdsKey(request), request.url).toBe(false);
        }

        // A Dive is a second request with the same key, and answers as a Current of its own.
        await expectShown(page, 'that nothing, not even light');
        await page.locator('#live-controls-question').fill('dive on event horizon');
        await page.locator('#live-controls-question').press('Enter');
        await expectShown(page, 'The event horizon is where the speed needed to escape');
        expect(asked).toHaveLength(2);
        expect(asked[1].headers['x-goog-api-key']).toBe(KEY);
        expect(asked[1].body.contents[0].parts[0].text).toContain('quoted, not an instruction');
        await expect(page.locator('.live-passage__origin')).toContainText('Written when you asked, by Google Gemini answer (Google Gemini)');
        await expect(page.locator('.live-passage__sources')).toHaveText('No source was given for this passage.');
        await page.getByRole('button', { name: 'Surface', exact: true }).click();
        await expectShown(page, 'that nothing, not even light');

        await page.getByRole('button', { name: 'Stop', exact: true }).click();
        await expect(page.locator('.live-start')).toBeVisible();
        // Forgotten with the session: asking again needs the key again.
        await page.locator('.live-start').click();
        await expect(page.locator('.live-error')).toHaveText('Enter your Gemini key to use this provider.');
        expect(errors).toEqual([]);
    });

    test('asks the model the reader named', async ({ page }) => {
        const asked = await google(page);
        await page.goto(OPEN);
        await page.locator('#live-key').fill(KEY);
        await page.locator('#live-model').fill('gemini-2.0-pro');
        await page.locator('.live-start').click();
        await expectShown(page, 'A black hole is a region of space');
        expect(asked[0].url).toBe(MODEL_URL('gemini-2.0-pro'));
    });

    test('refuses a model name that could leave the address, in words, and sends nothing', async ({ page }) => {
        const asked = await google(page);
        await page.goto(OPEN);
        await page.locator('#live-key').fill(KEY);
        await page.locator('#live-model').fill('../../evil');
        await page.locator('.live-start').click();
        await expect(page.locator('.live-error')).toContainText('That is not a model name');
        expect(asked).toEqual([]);
    });

    test('says in words that the key was refused, without ever saying the key, and forgets it', async ({ page }) => {
        await google(page, { status: 400, error: { error: { code: 400, message: `API key not valid: ${KEY}. Please pass a valid API key.`, status: 'INVALID_ARGUMENT', details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' }] } } });
        await page.goto(OPEN);
        await page.locator('#live-key').fill(KEY);
        await page.locator('.live-start').click();
        await expect(page.locator('.live-error')).toContainText('Google did not accept that key');
        await expect(page.locator('.live-error')).not.toContainText(KEY);
        expect(await page.content()).not.toContain(KEY);
        await expect(page.locator('.live-start')).toBeEnabled();
        await page.locator('.live-start').click();
        await expect(page.locator('.live-error')).toHaveText('Enter your Gemini key to use this provider.');
    });

    test('says in words that the model does not exist, and keeps the key for another try', async ({ page }) => {
        await google(page, { status: 404, error: { error: { code: 404, message: 'models/nope is not found for API version v1beta.', status: 'NOT_FOUND' } } });
        await page.goto(OPEN);
        await page.locator('#live-key').fill(KEY);
        await page.locator('#live-model').fill('nope');
        await page.locator('.live-start').click();
        await expect(page.locator('.live-error')).toContainText('Google has no model called “nope” for this key');
        await expect(page.locator('.live-start')).toBeEnabled();
        // The key was kept: starting again does not ask for it.
        await page.locator('.live-start').click();
        await expect(page.locator('.live-error')).not.toHaveText('Enter your Gemini key to use this provider.');
    });

    test('says in words when Google cannot be reached, and keeps the key for another try', async ({ page }) => {
        await page.route(GOOGLE, route => (route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers: CORS }) : route.abort('failed')));
        await page.goto(OPEN);
        await page.locator('#live-key').fill(KEY);
        await page.locator('.live-start').click();
        await expect(page.locator('.live-error')).toContainText('Could not reach Google');
        await expect(page.locator('.live-error')).not.toContainText(KEY);
        await expect(page.locator('.live-start')).toBeEnabled();
    });

    test('says in words when the model refuses to answer, and shows nothing of it', async ({ page }) => {
        await page.route(GOOGLE, async route => {
            if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
            const frame = { candidates: [{ content: { role: 'model', parts: [{ text: '' }] }, finishReason: 'SAFETY', index: 0 }] };
            await route.fulfill({ status: 200, headers: CORS, contentType: 'text/event-stream', body: `data: ${JSON.stringify(frame)}\r\n\r\n` });
        });
        await page.goto(OPEN);
        await page.locator('#live-key').fill(KEY);
        await page.locator('.live-start').click();
        await expect(page.locator('.live-controls__status')).toContainText('could not be answered');
        await expect(page.locator('.live-controls__error')).toContainText('The provider stopped the answer (SAFETY)');
        await expect(page.locator('#atom-display')).toHaveCount(0);
    });

    test('never shows the key when Google says it back in the middle of an otherwise good stream', async ({ page }) => {
        await page.route(GOOGLE, async route => {
            if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
            const frame = { error: { code: 500, message: `Something failed for ${KEY}, sorry.`, status: 'INTERNAL' } };
            await route.fulfill({ status: 200, headers: CORS, contentType: 'text/event-stream', body: `data: ${JSON.stringify(frame)}\r\n\r\n` });
        });
        await page.goto(OPEN);
        await page.locator('#live-key').fill(KEY);
        await page.locator('.live-start').click();
        await expect(page.locator('.live-controls__status')).toContainText('could not be answered');
        await expect(page.locator('.live-controls__error')).toContainText('Something failed for [key], sorry.');
        expect(await page.content()).not.toContain(KEY);
        await expect(page.locator('body')).not.toContainText(KEY);
    });

    test('Stop while Google is still answering shows nothing of what arrives afterwards', async ({ page }) => {
        let release;
        const hold = new Promise(resolve => { release = resolve; });
        const asked = await google(page, { hold });
        await page.goto(OPEN);
        await page.locator('#live-key').fill(KEY);
        await page.locator('.live-start').click();
        await expect(page.locator('#live-controls')).toBeVisible();
        await expect.poll(() => asked.length).toBe(1);
        await page.getByRole('button', { name: 'Stop', exact: true }).click();
        await expect(page.locator('.live-start')).toBeVisible();
        release();
        await page.waitForTimeout(500);
        await expect(page.locator('#atom-display')).toHaveCount(0);
        await expect(page.locator('#live-controls')).toHaveCount(0);
        expect(asked).toHaveLength(1);
    });

    test('the default page, and the OpenAI one, reach nothing at Google: the provider is opt-in', async ({ page }) => {
        const requests = watchRequests(page);
        await page.goto('/live?voice=paced');
        await expect(page.locator('#live-key')).toHaveCount(0);
        await expect(page.locator('#live-model')).toHaveCount(0);
        await page.locator('.live-start').click();
        await expect(page.locator('#live-controls')).toBeVisible();
        await expectShown(page, 'A black hole is a region of space');
        await page.goto('/live?provider=openai&voice=paced');
        await expect(page.locator('#live-model')).toHaveCount(0);
        expect(requests.filter(item => item.url.includes('googleapis.com'))).toEqual([]);
    });
});
