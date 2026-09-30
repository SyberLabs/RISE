import { describe, expect, it } from 'vitest';
import { fitBradleyTerry } from './preference/bradley-terry.js';
import { canFitReadout, recordJudgment } from './preference/judgments.js';

function row(id, leftId, rightId, winner) {
    return {
        id,
        leftId,
        rightId,
        questionId: 'more-tense',
        winner,
        annotator: 'synthetic',
        annotatorKind: 'synthetic'
    };
}

describe('pairwise judgments', () => {
    it('appends a frozen record and will not revise it', () => {
        const store = recordJudgment([], row('j1', 'a', 'b', 'left'));
        expect(Object.isFrozen(store)).toBe(true);
        expect(Object.isFrozen(store[0])).toBe(true);
        expect(() => {
            store[0].winner = 'right';
        }).toThrow();
        expect(store[0].winner).toBe('left');
    });

    it('refuses a pooled fit across prompts', () => {
        const store = recordJudgment([], row('j1', 'a', 'b', 'left'));
        expect(() => fitBradleyTerry(store, {})).toThrow(/questionId/);
    });

    it('recovers a ranking and does not write the observations', () => {
        let store = [];
        let n = 0;
        const add = (leftId, rightId, winner, times) => {
            for (let index = 0; index < times; index += 1) {
                n += 1;
                store = recordJudgment(store, row(`j${n}`, leftId, rightId, winner));
            }
        };
        add('a', 'b', 'left', 8);
        add('b', 'c', 'left', 8);
        add('a', 'c', 'left', 4);
        const before = JSON.stringify(store);
        const fitted = fitBradleyTerry(store, { questionId: 'more-tense' });
        expect(JSON.stringify(store)).toBe(before);
        expect(fitted.status).toBe('fitted');
        expect(fitted.scores.a).toBeGreaterThan(fitted.scores.b);
        expect(fitted.scores.b).toBeGreaterThan(fitted.scores.c);
        expect(fitted.model).toBe('bradley-terry-v1');
    });

    it('will not fit a readout from a handful of non-human notes', () => {
        const store = recordJudgment([], row('j1', 'a', 'b', 'left'));
        const decision = canFitReadout(store);
        expect(decision.ok).toBe(false);
        expect(decision.human).toBe(0);
    });
});
