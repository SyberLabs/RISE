// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createDemoSession } from './demo.js';

const SCALE = { floor: 0.2, ceiling: 0.9 };

/** One axis per text, so a query equal to one text's vector matches it alone. */
function axisVectors(items) {
    const dims = items.length;
    return new Map(items.map(({ id }, i) => {
        const vector = new Float32Array(dims);
        vector[i] = 1;
        return [id, vector];
    }));
}

function room() {
    const { program, session } = createDemoSession((at) => at);
    const texts = session.embeddingTexts();
    const all = [...texts.cards, ...texts.entries];
    const vectors = axisVectors(all);
    const cards = new Map(texts.cards.map(({ id }) => [id, vectors.get(id)]));
    const entries = new Map(texts.entries.map(({ id }) => [id, vectors.get(id)]));
    return { program, session, texts, cards, entries };
}

const presenterLine = (program, text, vector, at = 1000) =>
    ({ text, final: true, speaker: 'presenter', speakerId: program.presenterId, at, vector });

describe('the room with sentence vectors', () => {
    it('never asks to embed a document the audience may not see', () => {
        const { texts } = room();
        const joined = [...texts.cards, ...texts.entries].map(item => item.text).join('\n');
        expect(joined).not.toMatch(/880/u);
        expect(texts.entries.some(entry => entry.id.includes('board-memo'))).toBe(false);
        expect(texts.cards.length).toBeGreaterThan(0);
        expect(texts.entries.length).toBeGreaterThan(0);
    });

    it('ranks prepared cards by the line vector once every vector is attached', () => {
        const { program, session, cards, entries } = room();
        expect(session.attachVectors({ cards, entries, scale: SCALE })).toBe(true);
        const [targetId] = [...cards.keys()].filter(id => id.includes('quarterly-revenue'));
        // Words point at Atlas; the vector points at revenue. The vector wins.
        const turn = session.prepare(presenterLine(program, 'Atlas renewal price', cards.get(targetId)));
        const [top, next] = turn.context.structure.candidates;
        expect(top.id).toBe(targetId);
        expect(top.score).toBe(1);
        expect(next.score).toBe(0);
    });

    it('keeps the word tier until every vector is attached, and for a line without a vector', () => {
        const { program, session, cards, entries } = room();
        const partial = new Map([...cards].slice(1));
        expect(session.attachVectors({ cards: partial, entries, scale: SCALE })).toBe(false);
        const [revenueId] = [...cards.keys()].filter(id => id.includes('quarterly-revenue'));
        const withVector = session.prepare(presenterLine(program, 'Atlas renewal price', cards.get(revenueId)));
        expect(withVector.context.structure.candidates[0].id).toContain('atlas-renewal');

        session.attachVectors({ cards, entries, scale: SCALE });
        const without = session.prepare(presenterLine(program, 'Atlas renewal price', undefined, 2000));
        expect(without.context.structure.candidates[0].id).toContain('atlas-renewal');
    });

    it('retrieves for an ask by the vector, with the calibrated score, through the gate', () => {
        const { session, cards, entries } = room();
        session.attachVectors({ cards, entries, scale: SCALE });
        const [chartId] = [...entries.keys()].filter(id => id.includes('chart:pipeline'));
        const turn = session.prepareReasoning({ text: 'numbers by quarter', at: 1, vector: entries.get(chartId) });
        const candidates = turn.context.structure.candidates;
        expect(candidates.map(c => c.id)).toEqual([chartId]);
        expect(candidates[0].score).toBe(1);
    });

    it('offers nothing when no permitted entry is near the ask', () => {
        const { session, cards, entries } = room();
        session.attachVectors({ cards, entries, scale: SCALE });
        const nowhere = new Float32Array(entries.values().next().value.length);
        const turn = session.prepareReasoning({ text: 'acquisition price', at: 1, vector: nowhere });
        expect(turn.context.structure.candidates).toEqual([]);
    });
});
