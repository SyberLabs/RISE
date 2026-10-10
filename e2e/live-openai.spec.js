/**
 * The OpenAI provider, in a real browser, with no OpenAI.
 *
 * A fake WebRTC peer stands in for the data channel and the site's relay route
 * is answered by the test, so this runs offline and spends nothing. It proves
 * the host, the adapter, the key handling and the reading, end to end in the
 * page. It does NOT prove OpenAI: the wire it speaks is the documented one,
 * hand-written, and no live session has been run. See src/live/adapters/openai-wire.js.
 */
import { scriptToLines } from '../src/test/fake-text-transport.js';
import { BLACK_HOLES, HORIZON_DIVE } from '../src/live/fixtures/black-holes.js';
import { expect, test } from './fixtures.js';

const KEY = 'sk-test-0123456789abcdefghijklmnopqrstuvwxyz';
const OPEN = '/live?provider=openai&voice=paced';
const ANSWER_SDP = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n';

const shown = async page => (await page.locator('#atom-display').innerText()).replace(/\s+/gu, ' ').trim();
const status = page => page.locator('.live-controls__status');
const expectShown = (page, phrase, timeout = 12_000) =>
    expect.poll(() => shown(page).catch(() => ''), { timeout, message: `waiting to see “${phrase}”` }).toContain(phrase);

/** A fake peer whose data channel speaks the documented Realtime events, from the fixtures. */
async function installFakePeer(page, { answer = scriptToLines(BLACK_HOLES), dive = scriptToLines(HORIZON_DIVE) } = {}) {
    await page.addInitScript(({ answer, dive }) => {
        window.__rtc = { peers: 0, sent: [] };
        class Channel extends EventTarget {
            constructor() { super(); this.readyState = 'connecting'; this.asked = ''; }
            emit(event) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(event) })); }
            send(text) {
                const event = JSON.parse(text);
                window.__rtc.sent.push(event);
                if (event.type === 'conversation.item.create') this.asked = event.item.content[0].text;
                if (event.type === 'response.create') this.stream(this.asked.startsWith('The reader stopped') ? dive : answer);
                if (event.type === 'response.cancel') { this.cancelled = true; this.emit({ type: 'response.done', response: { id: 'r', status: 'cancelled' } }); }
            }
            stream(text) {
                this.emit({ type: 'response.created', response: { id: 'r', status: 'in_progress' } });
                const sizes = [7, 19, 3, 31, 11, 23];
                let at = 0;
                let count = 0;
                const step = () => {
                    if (this.cancelled || this.readyState !== 'open') return;
                    if (at >= text.length) {
                        this.emit({ type: 'response.done', response: { id: 'r', status: 'completed' } });
                        return;
                    }
                    const size = sizes[count % sizes.length];
                    this.emit({ type: 'response.output_text.delta', response_id: 'r', delta: text.slice(at, at + size) });
                    at += size;
                    count += 1;
                    setTimeout(step, 20);
                };
                setTimeout(step, 20);
            }
            close() { this.readyState = 'closed'; this.dispatchEvent(new Event('close')); }
        }
        window.RTCPeerConnection = class {
            constructor() { this.iceGatheringState = 'complete'; this.connectionState = 'new'; window.__rtc.peers += 1; }
            createDataChannel() { this.channel = new Channel(); return this.channel; }
            addTransceiver() {}
            async createOffer() { return { type: 'offer', sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n' }; }
            async setLocalDescription(description) { this.localDescription = description; }
            async setRemoteDescription() { setTimeout(() => { this.channel.readyState = 'open'; this.channel.dispatchEvent(new Event('open')); }, 10); }
            addEventListener() {}
            removeEventListener() {}
            close() { this.connectionState = 'closed'; }
        };
    }, { answer, dive });
}

/** Answer the site's relay route, recording what it was asked. */
async function relay(page, { status = 200 } = {}) {
    const asked = [];
    await page.route('**/api/live/realtime**', async route => {
        const request = route.request();
        asked.push({ url: request.url(), method: request.method(), headers: request.headers(), body: request.postData() });
        if (status === 200) await route.fulfill({ status: 200, contentType: 'application/sdp', body: ANSWER_SDP });
        else await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { code: 'X', message: `secret ${KEY}` } }) });
    });
    return asked;
}

function watchErrors(page) {
    const errors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
        // The relay is answered by the test, so a refused request is expected there.
        if (message.type() === 'error' && !/Failed to load resource/u.test(message.text())) errors.push(`console: ${message.text().slice(0, 200)}`);
    });
    return errors;
}

test.describe('the OpenAI provider with the reader’s own key', () => {
    test('asks for the key, sends it to this site in one header, reads the answer, and Dives on a second session', async ({ page }) => {
        const errors = watchErrors(page);
        await installFakePeer(page);
        const asked = await relay(page);
        await page.goto(OPEN);

        await expect(page.locator('.live-provider')).toContainText('OpenAI Realtime, with your own key');
        await expect(page.locator('#live-key')).toHaveAttribute('type', 'password');
        await page.locator('.live-start').click();
        await expect(page.locator('.live-error')).toHaveText('Enter your OpenAI key to use this provider.');
        expect(asked).toEqual([]);

        await page.locator('#live-key').fill(KEY);
        await page.locator('.live-start').click();
        await expect(page.locator('#live-controls')).toBeVisible();
        await expectShown(page, 'A black hole is a region of space');
        await expect(page.locator('.live-controls__status')).toContainText(/paced as if spoken/u);

        // One request, to this site, with the key in the header and nowhere else.
        expect(asked).toHaveLength(1);
        expect(asked[0].method).toBe('POST');
        expect(asked[0].url).toMatch(/\/api\/live\/realtime$/u);
        expect(asked[0].url).not.toContain(KEY);
        expect(asked[0].headers.authorization).toBe(`Bearer ${KEY}`);
        expect(asked[0].headers['content-type']).toBe('application/sdp');
        expect(asked[0].body).not.toContain(KEY);
        // And the key is not in the page: not in the field, not in what is drawn.
        expect(await page.locator('#live-key').inputValue().catch(() => '')).toBe('');
        expect(await page.content()).not.toContain(KEY);

        // What was asked of the provider is the prompt, as text only, and nothing about a model or tools.
        const sent = await page.evaluate(() => window.__rtc.sent);
        expect(sent[0]).toEqual({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Explain black holes with RISE.' }] } });
        expect(sent[1]).toEqual({ type: 'response.create', response: { output_modalities: ['text'] } });

        // A Dive opens a second session, with the same key, and answers as a Current of its own.
        await expectShown(page, 'that nothing, not even light');
        await page.locator('#live-controls-question').fill('dive on event horizon');
        await page.locator('#live-controls-question').press('Enter');
        await expectShown(page, 'The event horizon is where the speed needed to escape');
        expect(asked).toHaveLength(2);
        expect(asked[1].headers.authorization).toBe(`Bearer ${KEY}`);
        await expect(page.locator('.live-passage__origin')).toContainText('Written when you asked, by OpenAI Realtime answer (OpenAI Realtime)');
        // Nothing the model wrote could name a source, so none is shown, and that is said.
        await expect(page.locator('.live-passage__sources')).toHaveText('No source was given for this passage.');
        await page.getByRole('button', { name: 'Surface', exact: true }).click();
        await expectShown(page, 'that nothing, not even light');

        await page.getByRole('button', { name: 'Stop', exact: true }).click();
        await expect(page.locator('.live-start')).toBeVisible();
        // Forgotten with the session: asking again needs the key again.
        await page.locator('.live-start').click();
        await expect(page.locator('.live-error')).toHaveText('Enter your OpenAI key to use this provider.');
        expect(errors).toEqual([]);
    });

    test('says in words that the key was refused, and forgets it', async ({ page }) => {
        await installFakePeer(page);
        await relay(page, { status: 401 });
        await page.goto(OPEN);
        await page.locator('#live-key').fill(KEY);
        await page.locator('.live-start').click();
        await expect(page.locator('.live-error')).toContainText('OpenAI refused the key.');
        await expect(page.locator('.live-error')).not.toContainText(KEY);
        await expect(page.locator('.live-start')).toBeEnabled();
        await page.locator('.live-start').click();
        await expect(page.locator('.live-error')).toHaveText('Enter your OpenAI key to use this provider.');
    });

    test('says in words that live answers are not switched on, when the site says so', async ({ page }) => {
        await installFakePeer(page);
        await relay(page, { status: 503 });
        await page.goto(OPEN);
        await page.locator('#live-key').fill(KEY);
        await page.locator('.live-start').click();
        await expect(page.locator('.live-error')).toContainText('Live answers are not switched on for this site.');
        await expect(page.locator('.live-error')).not.toContainText(KEY);
    });

    test('a passage the model marks literal shows its bars and marker words as written, and an unmarked one has them neutralised', async ({ page }) => {
        const errors = watchErrors(page);
        const answer = [
            '@passage visual=still literal=yes',
            'To pause a reading write [PAUSE], and to split a phrase write a | b.',
            '@end',
            '@passage visual=still',
            'Here a | b and [PAUSE] were not marked, so they are made ordinary.',
            '@end',
            ''
        ].join('\n');
        await installFakePeer(page, { answer });
        await relay(page);
        await page.goto(OPEN);
        await page.locator('#live-key').fill(KEY);
        await page.locator('.live-start').click();
        await expectShown(page, 'To pause a reading write [PAUSE]', 15_000);
        await expectShown(page, 'a | b', 15_000);
        // Neither the words nor the bars were obeyed: the reading did not stop for a pause it was only told about.
        await page.locator('.live-controls__transcript summary').click();
        const lines = page.locator('.live-controls__lines li');
        await expect(lines.first()).toHaveText('To pause a reading write [PAUSE], and to split a phrase write a | b.');
        await expectShown(page, 'Here a / b and (PAUSE) were not marked', 30_000);
        await expect(lines.nth(1)).toHaveText('Here a / b and (PAUSE) were not marked, so they are made ordinary.');
        expect(errors).toEqual([]);
    });

    test('the default page offers no key field and reaches nothing: the provider is opt-in', async ({ page }) => {
        const asked = await relay(page);
        await page.goto('/live?host=prompt&voice=paced');
        await expect(page.locator('#live-key')).toHaveCount(0);
        await page.locator('.live-start').click();
        await expect(page.locator('#live-controls')).toBeVisible();
        await expectShown(page, 'A black hole is a region of space');
        expect(asked).toEqual([]);
    });
});
