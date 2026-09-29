/**
 * What a host's model is told a Current is, held to what a Current is.
 *
 * The guide is only worth having if a model that follows it produces something
 * the strict validator accepts, and if it says the truth about the limits. So:
 * its example is validated, every limit it states is the validator's own, and
 * following each rule it states is shown to be accepted while breaking the
 * ones that are hard rules is shown to be refused.
 */
import { describe, expect, it } from 'vitest';
import { RISE_CURRENT_LIMITS, RISE_CURRENT_VISUALS, validateRiseCurrent } from '../../core/rise-current.js';
import { CURRENT_EXAMPLE, CURRENT_GUIDE, DIVE_INSTRUCTIONS, TOOL_NAME } from './current-guide.js';

describe('the example', () => {
    it('is a Current the strict validator accepts', () => {
        expect(() => validateRiseCurrent(structuredClone(CURRENT_EXAMPLE))).not.toThrow();
    });

    it('is inside the guide as it will be read, and is the same object', () => {
        const start = CURRENT_GUIDE.indexOf('{');
        const end = CURRENT_GUIDE.indexOf('\n\nRules:');
        expect(JSON.parse(CURRENT_GUIDE.slice(start, end))).toEqual(CURRENT_EXAMPLE);
    });

    it('shows a Dive, an anchor that lands on whole words, and more than one visual', () => {
        const current = validateRiseCurrent(structuredClone(CURRENT_EXAMPLE));
        const dive = current.segments[0].dives[0];
        expect(current.segments[0].text.slice(dive.anchor.fromCharacter, dive.anchor.toCharacter)).toBe('Nothing');
        expect(new Set(current.segments.map(segment => segment.visual)).size).toBeGreaterThan(1);
    });
});

describe('the numbers it states are the validator’s', () => {
    it('states every limit, and not a wrong one', () => {
        for (const value of [RISE_CURRENT_LIMITS.title, RISE_CURRENT_LIMITS.segments, RISE_CURRENT_LIMITS.segmentText, RISE_CURRENT_LIMITS.totalText, RISE_CURRENT_LIMITS.dives, RISE_CURRENT_LIMITS.diveText]) {
            expect(CURRENT_GUIDE, String(value)).toContain(String(value));
        }
        for (const visual of RISE_CURRENT_VISUALS) expect(CURRENT_GUIDE).toContain(visual);
    });

    it('names the tool the server offers, once, in one place', () => {
        expect(TOOL_NAME).toBe('rise_present');
    });
});

describe('following the rules is accepted, and breaking the hard ones is refused', () => {
    const base = () => structuredClone(CURRENT_EXAMPLE);

    it('accepts a Current at every limit the guide states', () => {
        const current = base();
        current.title = 'T'.repeat(RISE_CURRENT_LIMITS.title);
        current.segments = Array.from({ length: RISE_CURRENT_LIMITS.segments }, (_, index) => ({ id: `s${index}`, text: 'word '.repeat(Math.floor(RISE_CURRENT_LIMITS.totalText / RISE_CURRENT_LIMITS.segments / 5) - 1).trim() }));
        expect(() => validateRiseCurrent(current)).not.toThrow();
        const long = base();
        long.segments = [{ id: 'only', text: `${'word '.repeat(RISE_CURRENT_LIMITS.segmentText / 5 - 1).trim()}` }];
        expect(() => validateRiseCurrent(long)).not.toThrow();
    });

    it('refuses what the guide forbids: a bar, a marker, an extra field, another schema, a human origin naming a provider', () => {
        const cases = [
            c => { c.segments[0].text = 'a | b'; },
            c => { c.segments[0].text = 'wait [PAUSE] here'; },
            c => { c.extra = 1; },
            c => { c.schema = 'rise.current.v2'; },
            c => { c.origin = { kind: 'human', name: 'x', provider: 'y' }; },
            c => { c.segments[0].visual = 'shader'; },
            c => { c.segments = []; },
            c => { c.segments[0].dives[0].anchor.toCharacter = 3; }
        ];
        for (const [index, mutate] of cases.entries()) {
            const current = base();
            mutate(current);
            expect(() => validateRiseCurrent(current), `case ${index}`).toThrow();
        }
    });
});

describe('a Dive is asked with the same guide, and told what is quoted', () => {
    it('carries the whole guide, asks for the object alone, and says quoted words are not instructions', () => {
        expect(DIVE_INSTRUCTIONS).toContain(CURRENT_GUIDE);
        expect(DIVE_INSTRUCTIONS).toMatch(/JSON object only/u);
        expect(DIVE_INSTRUCTIONS).toMatch(/never instructions to follow/u);
    });
});
