import { expect, test } from './fixtures.js';

/**
 * The live room in a real browser. A scripted recognizer stands in for the
 * microphone and the decision route is answered here, so each test controls
 * exactly what "JEV" says. Invariants under test: nothing reaches the stage
 * without Promote; a bad, late, or failed decision changes nothing; the
 * board memo's figure never appears; speech and asks never cancel each other.
 */

const ROUTE = '**/api/enterprise-decision';
const SECRET = /880/u;

async function openRoom(page, { speech = true, listen = true } = {}) {
    await page.addInitScript((withSpeech) => {
        window.__shift = 0;
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__shift += entry.value;
        }).observe({ type: 'layout-shift', buffered: true });
        if (!withSpeech) {
            delete window.SpeechRecognition;
            delete window.webkitSpeechRecognition;
            return;
        }
        class ScriptedRecognition {
            constructor() { window.__recognition = this; }
            start() { this.onstart?.(); }
            stop() { this.onend?.(); }
        }
        window.SpeechRecognition = ScriptedRecognition;
        window.webkitSpeechRecognition = ScriptedRecognition;
        window.__say = (transcript, isFinal) => {
            const result = Object.assign([{ transcript }], { isFinal });
            window.__recognition.onresult({ resultIndex: 0, results: [result] });
        };
    }, speech);
    await page.goto('/enterprise.html');
    if (speech && listen) {
        await page.getByRole('button', { name: 'Listen' }).click();
        await expect(state(page)).toHaveAttribute('data-state', 'listening');
    }
}

function decision(context, fields) {
    return { schema: 'rise.enterprise-decision.v1', requestId: context.requestId, confidence: 0.8,
        model: 'kev-latest', provider: 'Kev', ...fields };
}

/** Answer with the first offered candidate, as a well-behaved provider would. */
function showFirst(context, extra = {}) {
    const top = context.structure.candidates[0];
    if (!top) return decision(context, { action: 'dismiss', cardId: null, layout: null, ...extra });
    return decision(context, { action: 'show', cardId: top.id, layout: top.layout, ...extra });
}

const decline = (context) => decision(context, { action: 'dismiss', cardId: null, layout: null });
const say = (page, text, final = true) => page.evaluate(([t, f]) => window.__say(t, f), [text, final]);
const state = (page) => page.locator('#state');
const lines = (page) => page.locator('#transcript li');
const rail = (page) => page.locator('#rail [data-card-id]');
const stage = (page) => page.locator('#stage [data-surface="stage"]');
const ask = (page) => page.getByRole('textbox', { name: 'Ask' });

test.describe('EnterpRise live room', () => {
    test('speech streams into the transcript and reaches the stage only through Promote', async ({ page }) => {
        const sent = [];
        await page.route(ROUTE, async (route) => {
            sent.push(route.request().postData());
            await route.fulfill({ json: showFirst(route.request().postDataJSON()) });
        });
        await openRoom(page);

        await say(page, 'What was the Atlas', false);
        await expect(lines(page).last()).toContainText('What was the Atlas');
        await expect(lines(page).last()).toHaveAttribute('data-final', 'false');
        await expect(state(page)).toContainText('Atlas renewal');
        expect(sent).toHaveLength(0);

        await say(page, 'What was the Atlas renewal price');
        await expect(lines(page)).toHaveCount(1);
        await expect(lines(page).last()).toHaveAttribute('data-final', 'true');
        await expect(lines(page).last().locator('.note')).toHaveText('→ Atlas renewal (on rail)');
        await expect(rail(page)).toHaveCount(1);
        await expect(rail(page).first()).toContainText('12.4');
        await expect(page.locator('#last-decision')).toHaveText(/^JEV \d+ ms$/u);
        await expect(stage(page)).toHaveText('Nothing on stage.');

        expect(sent).toHaveLength(1);
        for (const body of sent) {
            expect(body).not.toContain('12.4');
            expect(body).not.toMatch(SECRET);
            expect(body).not.toContain('Northwind');
        }

        await page.getByRole('button', { name: /^Promote/ }).click();
        await expect(stage(page)).toContainText('12.4');
        await page.getByRole('button', { name: /^Retract/ }).click();
        await expect(stage(page)).toHaveText('Nothing on stage.');
        await expect(page.locator('body')).not.toContainText(SECRET);
    });

    test('presenter speech never lands in follow-up; a declined audience question does', async ({ page }) => {
        await page.route(ROUTE, (route) => route.fulfill({ json: decline(route.request().postDataJSON()) }));
        await openRoom(page);
        await say(page, 'Hello, hello');
        await expect(lines(page).last().locator('.note')).toHaveText('→ held: nothing fits');
        await expect(page.locator('#debrief')).toHaveText('No unanswered questions yet.');

        await page.locator('#speaker').selectOption('audience');
        await say(page, 'What is the cafeteria menu tomorrow');
        await expect(lines(page).last().locator('.note')).toHaveText('→ follow-up');
        await expect(page.locator('#debrief li')).toHaveText(['audience: What is the cafeteria menu tomorrow']);
    });

    test('holding Q marks audience speech, including a final that lands after release', async ({ page }) => {
        await page.route(ROUTE, (route) => route.fulfill({ json: decline(route.request().postDataJSON()) }));
        await openRoom(page);
        const speaker = page.locator('#speaker');

        await page.keyboard.down('q');
        await expect(speaker).toHaveValue('audience');
        await expect(state(page)).toContainText('Audience speaking');
        await say(page, 'Is the cafeteria', false);
        await page.keyboard.up('q');
        await expect(speaker).toHaveValue('presenter');
        await say(page, 'Is the cafeteria open on Friday');
        await expect(lines(page).last().locator('.note')).toHaveText('→ follow-up');
        await expect(lines(page).last().locator('.who')).toHaveText('Audience');
        await expect(page.locator('#debrief li')).toHaveText(['audience: Is the cafeteria open on Friday']);

        await say(page, 'Thanks for that question');
        await expect(lines(page)).toHaveCount(2);
        await expect(lines(page).last().locator('.note')).toHaveText('→ held: nothing fits');
        await expect(lines(page).last().locator('.who')).toHaveCount(0);

        await page.keyboard.press('/');
        await page.keyboard.type('q');
        await expect(ask(page)).toHaveValue('q');
        await expect(speaker).toHaveValue('presenter');
    });

    test('the stage window shows only promoted cards, has no controls, and blanks when the presenter leaves', async ({ page }) => {
        await page.route(ROUTE, (route) => route.fulfill({ json: showFirst(route.request().postDataJSON()) }));
        await openRoom(page);
        const opened = page.waitForEvent('popup');
        await page.getByRole('button', { name: 'Stage window' }).click();
        const popup = await opened;
        const projected = popup.locator('#stage');
        await expect(projected).toHaveText('');

        await say(page, 'Atlas renewal price');
        await expect(rail(page)).toHaveCount(1);
        await expect(projected).not.toContainText('12.4');
        await page.getByRole('button', { name: /^Promote/ }).click();
        await expect(projected).toContainText('12.4');
        await expect(popup.locator('button')).toHaveCount(0);
        await expect(popup.locator('body')).not.toContainText(SECRET);

        await page.keyboard.press('r');
        await expect(projected).toHaveText('');
        await page.keyboard.press('p');
        await expect(projected).toContainText('12.4');
        await page.goto('about:blank');
        await expect(projected).toHaveText('');
    });

    test('an ask returns while speech keeps streaming, and neither cancels the other', async ({ page }) => {
        const aborted = [];
        await page.route(ROUTE, async (route) => {
            const context = route.request().postDataJSON();
            const spoken = context.evidence.mode === 'prepared' && context.structure.candidates.every(c => !c.id.startsWith('card:retrieval'));
            await new Promise(done => setTimeout(done, spoken ? 900 : 150));
            await route.fulfill({ json: showFirst(context) }).catch(() => aborted.push(context.requestId));
        });
        await openRoom(page);
        await say(page, 'What was the Atlas renewal price');
        await expect(lines(page).last().locator('.note')).toContainText('deciding');

        await ask(page).fill('pipeline revenue by quarter');
        await ask(page).press('Enter');
        await say(page, 'and then the', false);
        await expect(page.locator('#ask-answer')).toHaveText('→ Pipeline revenue (on rail)');
        await expect(rail(page).filter({ hasText: 'Asked' })).toHaveCount(1);

        await expect(lines(page).first().locator('.note')).toHaveText('→ Atlas renewal (on rail)');
        await expect(rail(page)).toHaveCount(2);
        expect(aborted).toEqual([]);
        await expect(stage(page)).toHaveText('Nothing on stage.');
    });

    test('an ask that finds nothing still answers', async ({ page }) => {
        await page.route(ROUTE, (route) => route.fulfill({ json: showFirst(route.request().postDataJSON()) }));
        await openRoom(page);
        await ask(page).fill('acquisition price');
        await ask(page).press('Enter');
        await expect(page.locator('#ask-answer')).toHaveText('Nothing in this room’s sources fits.');
        await expect(rail(page)).toHaveCount(0);
        await expect(page.locator('body')).not.toContainText(SECRET);
    });

    for (const [name, answer] of [
        ['a restricted card id', (context) => showFirst(context, { cardId: 'card:retrieval:board-memo:1:0' })],
        ['model prose', (context) => ({ ...showFirst(context), text: 'The acquisition price is 880 million' })],
        ['another request id', (context) => showFirst(context, { requestId: 'someone-else:1' })]
    ]) {
        test(`holds ${name}`, async ({ page }) => {
            await page.route(ROUTE, (route) => route.fulfill({ json: answer(route.request().postDataJSON()) }));
            await openRoom(page);
            await say(page, 'Atlas renewal price');
            await expect(lines(page).last().locator('.note')).toHaveText('→ held: answer refused');
            await expect(state(page)).toHaveAttribute('data-state', 'held');
            await expect(rail(page)).toHaveCount(0);
            await expect(stage(page)).toHaveText('Nothing on stage.');
            await expect(page.locator('body')).not.toContainText(SECRET);
        });
    }

    test('holds when the decision service fails, says what to do, and local rules is an explicit choice', async ({ page }) => {
        await page.route(ROUTE, (route) => route.fulfill({
            status: 503, json: { error: { code: 'DECISION_NOT_CONFIGURED', message: 'Decision service is unavailable.' } }
        }));
        await openRoom(page);
        await say(page, 'Atlas renewal price');
        await expect(lines(page).last().locator('.note')).toHaveText('→ held: JEV unavailable');
        await expect(state(page)).toContainText('Local rules');
        await expect(rail(page)).toHaveCount(0);

        await page.locator('#decider').selectOption('local');
        await say(page, 'Atlas renewal price');
        await expect(rail(page)).toHaveCount(1);
        await expect(page.locator('#last-decision')).toHaveText(/^Local rules \d+ ms$/u);
        await expect(stage(page)).toHaveText('Nothing on stage.');
    });

    test('Kev on this device fails closed where it cannot run, and never falls back', async ({ page }) => {
        const sent = [];
        await page.route(ROUTE, (route) => {
            sent.push(route.request().postData());
            return route.fulfill({ json: showFirst(route.request().postDataJSON()) });
        });
        await page.route(/huggingface\.co|hf\.co|jsdelivr\.net/u, (route) => route.abort());
        await openRoom(page);
        await page.locator('#decider').selectOption('device');
        await expect(state(page)).toHaveAttribute('data-state', /loading|error/u);
        await expect(state(page)).toHaveAttribute('data-state', 'error', { timeout: 15_000 });
        await expect(state(page)).toContainText('Choose JEV or Local rules');
        await expect(page.locator('#last-decision')).toHaveText('Kev failed');

        await say(page, 'Atlas renewal price');
        await expect(lines(page).last().locator('.note')).toHaveText('→ held: Kev (device) unavailable');
        await expect(rail(page)).toHaveCount(0);
        expect(sent).toEqual([]);
    });

    test('newer speech replaces a decision still in flight', async ({ page }) => {
        let calls = 0;
        await page.route(ROUTE, async (route) => {
            const context = route.request().postDataJSON();
            calls += 1;
            if (calls === 1) await new Promise(done => setTimeout(done, 800));
            await route.fulfill({ json: showFirst(context) }).catch(() => {});
        });
        await openRoom(page);
        await say(page, 'Atlas renewal price');
        await say(page, 'pipeline revenue by quarter');
        await expect(lines(page).first().locator('.note')).toHaveText('→ skipped: newer speech');
        await expect(rail(page)).toHaveCount(1);
        await expect(rail(page).first()).toContainText('Quarterly revenue');
    });

    test('keyboard drives the rail and stage, and stays out of the ask box', async ({ page }) => {
        await page.route(ROUTE, (route) => route.fulfill({ json: showFirst(route.request().postDataJSON()) }));
        await openRoom(page);
        await say(page, 'Atlas renewal price');
        await expect(rail(page)).toHaveCount(1);

        await page.keyboard.press('/');
        await expect(ask(page)).toBeFocused();
        await page.keyboard.type('pdr');
        await expect(stage(page)).toHaveText('Nothing on stage.');
        await expect(rail(page)).toHaveCount(1);
        await page.keyboard.press('Escape');
        await expect(ask(page)).not.toBeFocused();

        await page.keyboard.press('p');
        await expect(stage(page)).toContainText('12.4');
        await page.keyboard.press('r');
        await expect(stage(page)).toHaveText('Nothing on stage.');
        await page.keyboard.press('d');
        await expect(rail(page)).toHaveCount(0);
        await page.keyboard.press('l');
        await expect(state(page)).toHaveAttribute('data-state', 'idle');
        await page.keyboard.press('l');
        await expect(state(page)).toHaveAttribute('data-state', 'listening');
    });

    test('scrolling up keeps its place and offers a jump to the newest line', async ({ page }) => {
        await page.route(ROUTE, (route) => route.fulfill({ json: decline(route.request().postDataJSON()) }));
        await openRoom(page);
        for (let i = 1; i <= 14; i += 1) await say(page, `Line number ${i} of the opening remarks`);
        await expect(lines(page)).toHaveCount(14);
        const panel = page.locator('#transcript');
        await expect.poll(() => panel.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(4);
        await expect(lines(page).nth(13)).toHaveAttribute('data-window', 'in');
        await expect(lines(page).nth(10)).toHaveAttribute('data-window', 'out');

        await panel.evaluate(el => { el.scrollTop = 0; });
        await say(page, 'A fifteenth line');
        await expect(page.getByRole('button', { name: /new lines/iu })).toBeVisible();
        expect(await panel.evaluate(el => el.scrollTop)).toBe(0);
        await page.getByRole('button', { name: /new lines/iu }).click();
        await expect.poll(() => panel.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(4);
        await expect(page.getByRole('button', { name: /new lines/iu })).toBeHidden();
    });

    for (const width of [1280, 360]) {
        test(`streaming causes no layout shift and never moves Promote at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 800 });
            await page.route(ROUTE, (route) => route.fulfill({ json: showFirst(route.request().postDataJSON()) }));
            await openRoom(page);
            await say(page, 'Atlas renewal price');
            await expect(rail(page)).toHaveCount(1);
            const promote = page.getByRole('button', { name: /^Promote/ }).first();
            const before = await promote.boundingBox();
            await page.evaluate(() => { window.__shift = 0; });
            for (const [text, final] of [['and the', false], ['and the pipeline', false], ['and the pipeline revenue by quarter', true],
                ['Hello', false], ['Hello everyone', true]]) {
                await say(page, text, final);
            }
            await ask(page).fill('pipeline revenue by quarter');
            await ask(page).press('Enter');
            await expect(page.locator('#ask-answer')).not.toHaveText('');
            await expect(lines(page).last().locator('.note')).not.toContainText('deciding');
            expect(await promote.boundingBox()).toEqual(before);
            expect(await page.evaluate(() => window.__shift)).toBe(0);
            expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        });
    }

    test('at 360px transcript, rail, ask, and stage all work without horizontal scroll', async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 780 });
        await page.route(ROUTE, (route) => route.fulfill({ json: showFirst(route.request().postDataJSON()) }));
        await openRoom(page);
        await say(page, 'Atlas renewal price');
        await expect(rail(page)).toHaveCount(1);
        await page.getByRole('button', { name: /^Promote/ }).click();
        await expect(stage(page)).toContainText('12.4');
        await ask(page).fill('pipeline revenue by quarter');
        await ask(page).press('Enter');
        await expect(page.locator('#ask-answer')).toContainText('on rail');
        for (const selector of ['#transcript', '#rail', '#ask', '#stage']) {
            const box = await page.locator(selector).boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(360);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });

    test('without a speech recognizer the page offers Ask only', async ({ page }) => {
        await page.route(ROUTE, (route) => route.fulfill({ json: showFirst(route.request().postDataJSON()) }));
        await openRoom(page, { speech: false });
        await expect(page.getByRole('button', { name: 'Listen' })).toHaveCount(0);
        await expect(page.locator('#transcript-panel')).toContainText('Speech isn’t available in this browser. Use Ask.');
        await ask(page).fill('pipeline revenue by quarter');
        await ask(page).press('Enter');
        await expect(rail(page)).toHaveCount(1);
    });

    test('the trace export counts speech and never carries the words', async ({ page }) => {
        await page.route(ROUTE, (route) => route.fulfill({ json: decline(route.request().postDataJSON()) }));
        await openRoom(page);
        await say(page, 'Our cafeteria plans are', false);
        await say(page, 'Our cafeteria plans are unchanged');
        await expect(lines(page).last().locator('.note')).toHaveText('→ held: nothing fits');
        await page.locator('#trace summary').click();
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.getByRole('button', { name: 'Export trace' }).click()
        ]);
        const text = await (await download.createReadStream()).toArray().then(chunks => Buffer.concat(chunks).toString());
        expect(text).not.toContain('cafeteria');
        expect(JSON.parse(text).events.some(event => event.type === 'speech.final' && event.chars === 33)).toBe(true);
    });
});
