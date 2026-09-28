import { describe, expect, it } from 'vitest';
import { handleEnterpriseDecision } from './enterprise-decision.mjs';

const view = {
    window: 'Atlas renewal price',
    speaker: 'presenter',
    mode: 'prepared',
    candidates: [{ id: 'a', title: 'Atlas renewal', score: 0.9, layouts: ['quote'], layout: 'quote' }],
    rail: []
};

describe('enterprise decision route', () => {
    it('returns a bounded choice and refuses document fields', async () => {
        const origin = 'https://rise.example';
        const ok = await handleEnterpriseDecision(new Request(`${origin}/api/enterprise-decision`, {
            method: 'POST',
            headers: { Origin: origin, 'Content-Type': 'application/json' },
            body: JSON.stringify(view)
        }));
        expect(ok.status).toBe(200);
        expect(await ok.json()).toEqual({ action: 'show', cardId: 'a', layout: 'quote' });

        const dirty = await handleEnterpriseDecision(new Request(`${origin}/api/enterprise-decision`, {
            method: 'POST',
            headers: { Origin: origin, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...view, body: 'price is 999' })
        }));
        expect(dirty.status).toBe(400);
        expect(await dirty.json()).toEqual({
            error: { code: 'DECISION_SHAPE', message: 'Decision view has an unknown field' }
        });
    });
});
