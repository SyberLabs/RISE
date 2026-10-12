/**
 * The illustrator measurement (scripts/eval-illustrator.mjs; docs/plans/LIVE-CURRENT.md §19). With no key it cannot be
 * measured, so here the provider is scripted. What this holds is the wiring, through the real OpenRouter adapter: the
 * illustrator's own instructions on every request, the refusal and the source sent back on the repair, the attempts
 * and the time reported, and a provider that never draws admissibly reported as not admitted after three.
 */
import { describe, expect, it } from 'vitest';
import { runIllustratorEval } from '../../scripts/eval-illustrator.mjs';
import { ILLUSTRATOR_INSTRUCTIONS } from '../live/adapters/openai-instructions.js';
import { WATER_FIGURE, WATER_FIGURE_REFUSED } from '../live/fixtures/water-illustrated-beats.js';
import { createFakeOpenRouterFetch } from './fake-openrouter-fetch.js';

const AT_ONCE = { sleep: () => new Promise(resolve => setImmediate(resolve)) };
const fence = svg => `@scene picture svg\n\`\`\`svg\n${svg}\n\`\`\`\n`;

describe('the illustrator measurement', () => {
    it('asks through the real adapter with the illustrator’s instructions, sends the refusal back, and reports the repair admitted', async () => {
        const fake = createFakeOpenRouterFetch({ clock: AT_ONCE, textFor: asked => (/RISE refused the last picture/u.test(asked) ? fence(WATER_FIGURE) : fence(WATER_FIGURE_REFUSED)) });
        const report = await runIllustratorEval({ chat: { request: fake.request } });
        expect(fake.requests).toHaveLength(2);
        const [first, second] = fake.requests.map(init => JSON.parse(init.body).messages);
        expect(first[0].content.startsWith(ILLUSTRATOR_INSTRUCTIONS)).toBe(true);
        expect(second[1].content).toContain('Attempt 2 of 3. RISE refused the last picture:');
        expect(second[1].content).toContain(WATER_FIGURE_REFUSED);
        expect(report.carried).toEqual({ instructions: true, repair: true });
        expect(report.result).toMatchObject({ status: 'admitted', medium: 'figure', attempts: 2 });
        expect(report.refusals).toEqual([expect.stringMatching(/^figure at \d+:\d+$/u)]);
        expect(report.tokens.prompt).toBeGreaterThan(0);
    });

    it('reports a provider that never draws admissibly as not admitted, after three requests', async () => {
        const fake = createFakeOpenRouterFetch({ clock: AT_ONCE, textFor: () => fence(WATER_FIGURE_REFUSED) });
        const report = await runIllustratorEval({ chat: { request: fake.request } });
        expect(fake.requests).toHaveLength(3);
        expect(report.result).toEqual({ status: 'failed', reason: 'REFUSED', attempts: 3 });
    });
});
