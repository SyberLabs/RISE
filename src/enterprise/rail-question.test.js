import { describe, expect, it } from 'vitest';
import { BLEND_CUT, railQuestion, readRailAnswer } from './rail-question.js';

const ATLAS = { id: 'card:atlas', title: 'Atlas renewal', score: 0.62, layouts: ['quote'], layout: 'quote' };
const CHART = { id: 'card:chart', title: 'Quarterly revenue', score: 0.2, layouts: ['bar', 'line', 'table'], layout: 'line' };

function context(candidates = [ATLAS, CHART]) {
    return {
        schema: 'rise.enterprise-context.v1',
        requestId: 'r:1',
        evidence: { window: 'Atlas renewal price', speaker: 'presenter', mode: 'prepared' },
        structure: { candidates, rail: [] },
        authority: { actions: candidates.length ? ['show', 'hold', 'dismiss'] : ['hold', 'dismiss'] }
    };
}

function read(p, ctx = context()) {
    const { options } = railQuestion(ctx);
    const choice = Object.entries(p).sort((a, b) => b[1] - a[1])[0][0];
    return readRailAnswer({ type: 'choice', choice, confidence: 0.5, probabilities: p }, options, ctx);
}

describe('pick one source or none', () => {
    it('shows the source whose blend of pick and match score is best', () => {
        // Kev prefers the chart, but the Atlas match is far stronger: 0.5*0.3+0.5*0.62 > 0.5*0.6+0.5*0.2.
        expect(read({ none: 0.1, source_1: 0.3, source_2: 0.6 })).toMatchObject({ action: 'show', cardId: 'card:atlas', layout: 'quote' });
    });

    it('lets a strong match carry a lukewarm pick past the cut', () => {
        expect(0.5 * 0.1 + 0.5 * 0.62).toBeGreaterThanOrEqual(BLEND_CUT);
        expect(read({ none: 0.85, source_1: 0.1, source_2: 0.05 })).toMatchObject({ action: 'show', cardId: 'card:atlas' });
    });

    it('dismisses when no blend reaches the cut', () => {
        const weak = context([{ ...ATLAS, score: 0.2 }, CHART]);
        expect(read({ none: 0.7, source_1: 0.2, source_2: 0.1 }, weak)).toMatchObject({ action: 'dismiss', cardId: null, layout: null });
    });

    it('never offers hold or a layout choice, and has nothing to ask with no candidates', () => {
        const { question } = railQuestion(context());
        expect(Object.keys(question.criteria)).toEqual(['none', 'source_1', 'source_2']);
        expect(railQuestion(context([])).question).toBeNull();
    });

    it('reads a provider that names only its choice as all weight on it', () => {
        const ctx = context([{ ...ATLAS, score: 0.3 }, CHART]);
        const { options } = railQuestion(ctx);
        expect(readRailAnswer({ type: 'choice', choice: 'source_1' }, options, ctx)).toMatchObject({ action: 'show', cardId: 'card:atlas' });
        expect(readRailAnswer({ type: 'choice', choice: 'none' }, options, ctx)).toMatchObject({ action: 'dismiss' });
    });
});
