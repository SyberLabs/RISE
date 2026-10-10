/**
 * The perception measurement (scripts/eval-perception.mjs, the RISE Live design §8 stage 4): does a model change
 * what it says when told the reader replayed? With no key it cannot be measured, so here the provider is
 * scripted: the same answer whatever it is told. What this holds is the experiment's wiring, through the real
 * OpenRouter adapter: the block goes up only on the request that carries it, the answers are compared by passage,
 * and a provider that ignores the block is reported as unchanged.
 */
import { describe, expect, it } from 'vitest';
import { runPerceptionEval, wordSimilarity } from '../../scripts/eval-perception.mjs';
import { BLACK_HOLES_BEATS_TEXT } from '../live/fixtures/black-holes-beats.js';
import { createFakeOpenRouterFetch } from './fake-openrouter-fetch.js';

/** A provider that writes as fast as it is read. */
const AT_ONCE = { sleep: () => new Promise(resolve => setImmediate(resolve)) };

describe('the perception measurement', () => {
    it('asks three times through the real adapter, and only the third request carries the reader’s actions', async () => {
        const fake = createFakeOpenRouterFetch({ clock: AT_ONCE, textFor: () => BLACK_HOLES_BEATS_TEXT });
        const report = await runPerceptionEval({ chat: { request: fake.request }, question: 'Explain black holes.' });
        expect(fake.requests).toHaveLength(3);
        const asked = fake.requests.map(init => JSON.parse(init.body).messages[1].content);
        expect(asked[0]).toBe('Explain black holes.');
        expect(asked[1]).toBe('Explain black holes.');
        expect(asked[2]).toBe(`${report.block}\n\nThen the reader asked: Explain black holes.`);
        expect(report.block).toMatch(/^- replayed passage 3 twice: “.+”$/mu);
        expect(report.carried).toEqual({ baseline: false, control: false, perceived: true });
    });

    it('reports passage 3 of each answer, and a provider that ignores the block as unchanged', async () => {
        const fake = createFakeOpenRouterFetch({ clock: AT_ONCE, textFor: () => BLACK_HOLES_BEATS_TEXT });
        const report = await runPerceptionEval({ chat: { request: fake.request }, question: 'Explain black holes.' });
        expect(report.passage3.baseline).toBeTruthy();
        expect(report.passage3.perceived).toBe(report.passage3.baseline);
        expect(report.similarity).toEqual({ control: 1, perceived: 1 });
        expect(report.changed).toBe(false);
        expect(report.verdict).toMatch(/unchanged/u);
    });

    it('measures words, not order or case', () => {
        expect(wordSimilarity('Light bends.', 'light BENDS')).toBe(1);
        expect(wordSimilarity('one two', 'three four')).toBe(0);
        expect(wordSimilarity('a b c d', 'a b')).toBe(0.5);
        expect(wordSimilarity(null, 'a')).toBe(0);
    });
});
