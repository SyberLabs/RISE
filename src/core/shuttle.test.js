import { describe, expect, it } from 'vitest';
import { Shuttle, SHUTTLE_LADDER } from './shuttle.js';

describe('The Shuttle (LATERAL-TRAVERSAL-SPEC §3, §6)', () => {
    it('is born at home (1×), the only steady state', () => {
        const s = new Shuttle();
        expect(s.velocity).toBe(1);
        expect(s.atHome).toBe(true);
        expect(s.rewinding).toBe(false);
    });

    it('climbs the forward ladder rung by rung and clamps at the top', () => {
        const s = new Shuttle();
        expect(s.stepForward()).toBe(2);
        expect(s.stepForward()).toBe(4);
        expect(s.stepForward()).toBe(8);
        expect(s.stepForward()).toBe(8); // clamped
    });

    it('descends into rewind rung by rung and clamps at the deepest', () => {
        const s = new Shuttle();
        expect(s.stepBackward()).toBe(-2);
        expect(s.stepBackward()).toBe(-4);
        expect(s.stepBackward()).toBe(-8);
        expect(s.stepBackward()).toBe(-8); // clamped
    });

    it('stepping toward home stops AT home — never through it in one press', () => {
        const s = new Shuttle();
        s.stepForward(); s.stepForward(); // 4×
        expect(s.stepBackward()).toBe(2);
        expect(s.stepBackward()).toBe(1); // home
        expect(s.atHome).toBe(true);
        // the NEXT press may enter rewind — that is a second decision
        expect(s.stepBackward()).toBe(-2);
        expect(s.stepForward()).toBe(1); // and back to home, stopping
        expect(s.atHome).toBe(true);
    });

    it('reset returns to home from anywhere', () => {
        const s = new Shuttle();
        s.stepBackward(); s.stepBackward();
        expect(s.reset()).toBe(1);
        s.stepForward(); s.stepForward(); s.stepForward();
        expect(s.reset()).toBe(1);
    });

    it('the high-water mark only ever rises', () => {
        const s = new Shuttle();
        expect(s.markPosition(5)).toBe(5);
        expect(s.markPosition(3)).toBe(5);   // rewound — the mark stands
        expect(s.markPosition(12)).toBe(12); // new territory
        expect(s.markPosition(-1)).toBe(12); // garbage cannot lower it
        expect(s.markPosition(NaN)).toBe(12);
    });

    it('the duration divisor is speed in either direction', () => {
        const s = new Shuttle();
        expect(s.durationDivisor).toBe(1);
        s.stepForward(); s.stepForward();
        expect(s.durationDivisor).toBe(4);
        s.reset();
        s.stepBackward(); s.stepBackward(); s.stepBackward();
        expect(s.durationDivisor).toBe(8);
    });

    it('the ladder is the spec ladder', () => {
        expect(SHUTTLE_LADDER).toEqual([-8, -4, -2, 1, 2, 4, 8]);
    });
});
