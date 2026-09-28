import { describe, expect, it } from 'vitest';
import {
    CONTEXT_LIMITS,
    CONTEXT_SCHEMA,
    buildContext,
    validateContext,
    viewOf
} from './context.js';

const view = {
    window: 'Atlas renewal price',
    speaker: 'presenter',
    mode: 'prepared',
    candidates: [
        { id: 'card:a', title: 'Atlas renewal', score: 0.61234, tier: 'semantic', layouts: ['quote'], layout: 'quote' },
        { id: 'card:b', title: 'Quarterly revenue', score: 0.2, layouts: ['bar', 'line', 'table'], layout: 'line' }
    ],
    rail: [{ id: 'card:c', title: 'Earlier', status: 'shown' }]
};

describe('enterprise context protocol', () => {
    it('groups the view into evidence, structure, and authority', () => {
        const context = buildContext(view, 'room1:7');
        expect(context).toEqual({
            schema: CONTEXT_SCHEMA,
            requestId: 'room1:7',
            evidence: { window: 'Atlas renewal price', speaker: 'presenter', mode: 'prepared' },
            structure: {
                candidates: [
                    { id: 'card:a', title: 'Atlas renewal', score: 0.612, layouts: ['quote'], layout: 'quote' },
                    { id: 'card:b', title: 'Quarterly revenue', score: 0.2, layouts: ['bar', 'line', 'table'], layout: 'line' }
                ],
                rail: [{ id: 'card:c', title: 'Earlier' }]
            },
            authority: { actions: ['show', 'hold', 'dismiss'] }
        });
        expect(Object.isFrozen(context.structure.candidates[0])).toBe(true);
        expect(viewOf(context).candidates).toBe(context.structure.candidates);
    });

    it('withholds show when there is nothing to show', () => {
        const context = buildContext({ ...view, candidates: [] }, 'room1:8');
        expect(context.authority.actions).toEqual(['hold', 'dismiss']);
        expect(() => validateContext({
            ...context,
            authority: { actions: ['show', 'hold', 'dismiss'] }
        })).toThrow(/Authority/u);
    });

    it('keeps the newest words when the window is long', () => {
        const long = `${'old '.repeat(400)}Atlas renewal price`;
        const context = buildContext({ ...view, window: long }, 'room1:9');
        expect(context.evidence.window.length).toBeLessThanOrEqual(CONTEXT_LIMITS.window);
        expect(context.evidence.window.endsWith('Atlas renewal price')).toBe(true);
    });

    it.each([
        ['an extra top-level key', (c) => ({ ...c, documents: [] })],
        ['an extra evidence key', (c) => ({ ...c, evidence: { ...c.evidence, body: 'x' } })],
        ['a candidate body', (c) => ({ ...c, structure: { ...c.structure,
            candidates: [{ ...c.structure.candidates[0], body: '880 million' }] } })],
        ['an unknown layout', (c) => ({ ...c, structure: { ...c.structure,
            candidates: [{ ...c.structure.candidates[0], layouts: ['script'], layout: 'script' }] } })],
        ['a score above one', (c) => ({ ...c, structure: { ...c.structure,
            candidates: [{ ...c.structure.candidates[0], score: 2 }] } })],
        ['a promote action', (c) => ({ ...c, authority: { actions: ['show', 'hold', 'dismiss', 'promote'] } })],
        ['a wrong schema', (c) => ({ ...c, schema: 'rise.enterprise-context.v0' })],
        ['a request id with a slash', (c) => ({ ...c, requestId: '../etc' })],
        ['an unknown speaker', (c) => ({ ...c, evidence: { ...c.evidence, speaker: 'system' } })],
        ['too many rail entries', (c) => ({ ...c, structure: { ...c.structure,
            rail: Array.from({ length: 4 }, (_, i) => ({ id: `r${i}`, title: 'R' })) } })]
    ])('refuses %s', (_, mutate) => {
        const context = JSON.parse(JSON.stringify(buildContext(view, 'room1:1')));
        expect(() => validateContext(mutate(context))).toThrow();
    });

    it('drops a candidate whose id is longer than the protocol allows', () => {
        const context = buildContext({
            ...view,
            candidates: [{ ...view.candidates[0], id: 'x'.repeat(CONTEXT_LIMITS.id + 1) }]
        }, 'room1:2');
        expect(context.structure.candidates).toEqual([]);
        expect(context.authority.actions).toEqual(['hold', 'dismiss']);
    });
});
