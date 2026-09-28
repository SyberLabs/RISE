import { expect, test } from './fixtures.js';

/**
 * The live room in a real browser: a scripted recognizer stands in for the
 * microphone, and the decision route is answered here, so each test controls
 * exactly what "JEV" says. The invariant under test is the same every time:
 * nothing reaches the stage without Promote, and a bad, late, or failed
 * decision leaves the rail and the stage as they were.
 */

const ROUTE = '**/api/enterprise-decision';

async function openRoom(page) {
    await page.addInitScript(() => {
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
    });
    await page.goto('/enterprise.html');
    await page.getByRole('button', { name: 'Listen' }).click();
    await expect(page.locator('#status')).toHaveText('Listening.');
}

/** Answer with the first offered candidate, as a well-behaved provider would. */
function showFirst(context, extra = {}) {
    const top = context.structure.candidates[0];
    return {
        schema: 'rise.enterprise-decision.v1',
        requestId: context.requestId,
        action: 'show',
        cardId: top.id,
        layout: top.layout,
        confidence: 0.8,
        model: 'kev-latest',
        provider: 'Kev',
        ...extra
    };
}

const rail = (page) => page.locator('#rail [data-surface="rail"] li');
const stage = (page) => page.locator('#stage [data-surface="stage"]');

test.describe('EnterpRise live room', () => {
    test('speech reaches the rail through JEV and the stage only through Promote', async ({ page }) => {
        const sent = [];
        await page.route(ROUTE, async (route) => {
            const context = route.request().postDataJSON();
            sent.push(route.request().postData());
            await route.fulfill({ json: showFirst(context) });
        });
        await openRoom(page);

        await page.evaluate(() => window.__say('Atlas', false));
        await expect(page.locator('#interim')).toContainText('likely: Atlas renewal');
        expect(sent).toHaveLength(0);
        await expect(rail(page)).toHaveCount(0);

        await page.evaluate(() => window.__say('What was the Atlas renewal price', true));
        await expect(rail(page)).toHaveCount(1);
        await expect(rail(page).first()).toContainText('12.4');
        await expect(rail(page).first()).toContainText('Chosen by Kev');
        await expect(stage(page)).toHaveText('Nothing on stage.');

        expect(sent).toHaveLength(1);
        expect(sent[0]).not.toContain('12.4');
        expect(sent[0]).not.toContain('880');
        expect(sent[0]).not.toContain('Northwind');

        await page.getByRole('button', { name: /^Promote/ }).click();
        await expect(stage(page)).toContainText('12.4');
        await expect(stage(page)).toContainText('pricing');
        await page.getByRole('button', { name: /^Retract/ }).click();
        await expect(stage(page)).toHaveText('Nothing on stage.');
        await expect(page.locator('body')).not.toContainText('880');
        await expect(page.locator('#trace-summary')).toContainText('1 decisions answered');
    });

    for (const [name, answer] of [
        ['a restricted card id', (context) => showFirst(context, { cardId: 'card:retrieval:board-memo:1:0' })],
        ['model prose', (context) => ({ ...showFirst(context), text: 'The acquisition price is 880 million' })],
        ['another request id', (context) => showFirst(context, { requestId: 'someone-else:1' })]
    ]) {
        test(`holds ${name}`, async ({ page }) => {
            await page.route(ROUTE, (route) => route.fulfill({ json: answer(route.request().postDataJSON()) }));
            await openRoom(page);
            await page.evaluate(() => window.__say('Atlas renewal price', true));
            await expect(page.locator('#status')).toHaveText(/Holding/u);
            await expect(rail(page)).toHaveCount(0);
            await expect(stage(page)).toHaveText('Nothing on stage.');
            await expect(page.locator('body')).not.toContainText('880');
        });
    }

    test('holds when the decision service fails, and local rules is an explicit choice', async ({ page }) => {
        await page.route(ROUTE, (route) => route.fulfill({
            status: 503, json: { error: { code: 'DECISION_NOT_CONFIGURED', message: 'Decision service is unavailable.' } }
        }));
        await openRoom(page);
        await page.evaluate(() => window.__say('Atlas renewal price', true));
        await expect(page.locator('#status')).toContainText('unavailable');
        await expect(rail(page)).toHaveCount(0);

        await page.locator('#decider').selectOption('local');
        await page.evaluate(() => window.__say('Atlas renewal price', true));
        await expect(rail(page)).toHaveCount(1);
        await expect(rail(page).first()).toContainText('Chosen by local rules');
        await expect(stage(page)).toHaveText('Nothing on stage.');
    });

    test('drops a decision that arrives after newer speech', async ({ page }) => {
        let calls = 0;
        await page.route(ROUTE, async (route) => {
            const context = route.request().postDataJSON();
            calls += 1;
            if (calls === 1) await new Promise(done => setTimeout(done, 800));
            await route.fulfill({ json: showFirst(context) }).catch(() => {});
        });
        await openRoom(page);
        await page.evaluate(() => window.__say('Atlas renewal price', true));
        await page.evaluate(() => window.__say('pipeline revenue by quarter', true));
        await expect(rail(page)).toHaveCount(1);
        await expect(rail(page).first()).toContainText('Quarterly revenue');
        await page.waitForTimeout(1200);
        await expect(rail(page)).toHaveCount(1);
        await expect(rail(page).first()).not.toContainText('12.4');
    });

    test('fits a phone without horizontal scroll', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.route(ROUTE, (route) => route.fulfill({ json: showFirst(route.request().postDataJSON()) }));
        await openRoom(page);
        await page.evaluate(() => window.__say('Atlas renewal price', true));
        await expect(rail(page)).toHaveCount(1);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });
});
