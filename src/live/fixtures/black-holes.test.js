import { describe, expect, it } from 'vitest';
import { compileRiseCurrent } from '../../core/rise-current.js';
import { RISE_CURRENT_EVENTS_SCHEMA, validateEvent } from '../protocol.js';
import { BLACK_HOLES, HORIZON_DIVE, UNKNOWN_ANSWER, UNKNOWN_DIVE, scriptFor } from './black-holes.js';

const asSealed = script => ({
    schema: 'rise.current.v1', id: 'fixture', title: script.title, origin: script.origin,
    segments: script.segments.map(segment => ({
        id: segment.id, text: segment.text, visual: segment.visual,
        dives: (segment.dives ?? []).map(dive => ({ id: dive.id, text: dive.text, anchor: dive.anchor }))
    }))
});

const scripts = { BLACK_HOLES, HORIZON_DIVE, UNKNOWN_DIVE, UNKNOWN_ANSWER };

describe('the scripted answers', () => {
    for (const [name, script] of Object.entries(scripts)) {
        it(`${name} is a valid sealed Current, and compiles`, () => {
            expect(compileRiseCurrent(asSealed(script)).atoms.length).toBeGreaterThan(0);
        });

        it(`${name} says only what the event protocol allows`, () => {
            const at = (seq, type, body) => validateEvent({ schema: RISE_CURRENT_EVENTS_SCHEMA, currentId: 'x', seq, type, ...body });
            for (const segment of script.segments) {
                expect(() => at(1, 'segment.begin', { segmentId: segment.id, visual: segment.visual })).not.toThrow();
                expect(() => at(2, 'state.set', { segmentId: segment.id, state: segment.state })).not.toThrow();
                for (const evidence of segment.evidence ?? []) {
                    expect(() => at(3, 'evidence.add', { segmentId: segment.id, evidence }), evidence.id).not.toThrow();
                }
                for (const dive of segment.dives ?? []) {
                    expect(() => at(4, 'dive.attach', { segmentId: segment.id, dive }), dive.id).not.toThrow();
                }
            }
        });
    }

    it('gives every claim in the main answer that rests on a publication a real one, by identifier', () => {
        const evidence = BLACK_HOLES.segments.flatMap(segment => segment.evidence ?? []);
        expect(evidence.map(item => item.uri)).toEqual([
            'https://doi.org/10.3847/2041-8213/ab0ec7',
            'https://doi.org/10.1103/PhysRevLett.116.061102',
            'https://doi.org/10.1038/248030a0'
        ]);
        expect(new Set(evidence.map(item => item.kind))).toEqual(new Set(['supplied']));
    });

    it('marks the one prediction as a prediction', () => {
        const note = BLACK_HOLES.segments.at(-1).dives[0].text;
        expect(note).toMatch(/theoretical prediction/u);
        expect(note).toMatch(/not been observed/u);
    });

    it('chooses an answer by what is asked, and an honest one when it does not know', () => {
        expect(scriptFor({ intent: 'answer', prompt: 'Explain black holes with RISE.' })).toBe(BLACK_HOLES);
        expect(scriptFor({ intent: 'answer', prompt: 'Explain the French Revolution.' })).toBe(UNKNOWN_ANSWER);
        expect(scriptFor({ intent: 'dive', prompt: 'dive on event horizon', parent: { context: [] } })).toBe(HORIZON_DIVE);
        expect(scriptFor({ intent: 'dive', prompt: 'the weather', parent: { context: [] } })).toBe(UNKNOWN_DIVE);
        // The question decides: the place it was asked from does not answer it.
        expect(scriptFor({ intent: 'dive', prompt: 'the weather', parent: { context: ['the event horizon'] } })).toBe(UNKNOWN_DIVE);
        // Unless it points at that place.
        expect(scriptFor({ intent: 'dive', prompt: 'dive on this', parent: { context: ['Its boundary is the event horizon.'] } })).toBe(HORIZON_DIVE);
    });
});
