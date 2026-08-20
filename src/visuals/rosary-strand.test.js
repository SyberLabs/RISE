// @vitest-environment jsdom
/**
 * THE COUNT IS THE FORM.
 *
 * The Rosarium's whole thesis is fidelity to a physical object, and
 * until this test existed the object's most basic fact was unguarded in
 * the one file a reader actually looks at. `rosary-strand.js` drew SIXTY
 * beads — a fifth pendant bead for the Glory Be, which is prayed on the
 * centrepiece and has no bead — while the doc comment two files away
 * said fifty-nine and `ROSARY_BEAD_COUNT` evaluated to sixty-one.
 *
 * Infidelity is the only defect class a received form admits. So this
 * asserts the count against the physical rosary, and — more importantly
 * — asserts the strand and the liturgy against EACH OTHER. The previous
 * guard compared the constant to a formula that produced it, and passed
 * for any value of the formula, including the wrong one.
 */

import { describe, expect, it } from 'vitest';
import { RosaryStrand } from './rosary-strand.js';
import {
    buildRosaryDefinition,
    ROSARY_BEAD_COUNT,
    ROSARY_CENTREPIECE
} from '../content/chapel/liturgy/rosary-liturgy.js';
import { compileLiturgy } from '../core/liturgy-runner.js';

function layout(w = 900, h = 700) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return new RosaryStrand(canvas)._layout(w, h);
}

const beadsOnly = list => list.filter(b => b.kind !== 'medal' && b.kind !== 'crucifix');

describe('the strand draws a five-decade rosary', () => {
    it('draws exactly 59 beads, one crucifix and one centrepiece', () => {
        const { beads } = layout();
        expect(beadsOnly(beads)).toHaveLength(59);
        expect(beads.filter(b => b.kind === 'crucifix')).toHaveLength(1);
        expect(beads.filter(b => b.kind === 'medal')).toHaveLength(1);
        expect(ROSARY_BEAD_COUNT).toBe(59);
    });

    it('puts four beads on the pendant and fifty-five on the loop', () => {
        const { beads, loopCy, ry } = layout();
        const loop = beadsOnly(beads).filter(b => b.y <= loopCy + ry + 1);
        const pendant = beadsOnly(beads).filter(b => b.y > loopCy + ry + 1);
        expect(loop).toHaveLength(55);
        expect(pendant).toHaveLength(4);
    });

    it('carries six Our Father beads and fifty-three Hail Mary beads', () => {
        const beads = beadsOnly(layout().beads);
        expect(beads.filter(b => b.kind === 'pater')).toHaveLength(6);
        expect(beads.filter(b => b.kind === 'ave')).toHaveLength(53);
    });

    it('numbers every bead once, 1 through 59, with the crucifix at 0', () => {
        const { beads } = layout();
        const numbers = beadsOnly(beads).map(b => b.bead).sort((a, b) => a - b);
        expect(numbers).toEqual(Array.from({ length: 59 }, (_, i) => i + 1));
        expect(beads.find(b => b.kind === 'crucifix').bead).toBe(0);
        expect(beads.find(b => b.kind === 'medal').bead).toBe(ROSARY_CENTREPIECE);
    });

    it('lays out the same numbering at every size it will be asked for', () => {
        for (const [w, h] of [[2560, 1600], [900, 700], [390, 844]]) {
            const numbers = beadsOnly(layout(w, h).beads).map(b => b.bead).sort((a, b) => a - b);
            expect(numbers, `${w}x${h}`).toEqual(Array.from({ length: 59 }, (_, i) => i + 1));
        }
    });
});

describe('the strand and the liturgy are the same rosary', () => {
    it('every bead the liturgy names exists on the strand', () => {
        const drawn = new Set(layout().beads.map(b => b.bead));
        for (const setId of ['joyful', 'sorrowful', 'glorious', 'luminous']) {
            const compiled = compileLiturgy(buildRosaryDefinition(setId));
            for (const step of compiled.steps) {
                expect(drawn, `${setId}/${step.id} → bead ${step.state.bead}`)
                    .toContain(step.state.bead);
            }
        }
    });

    it('the ten Hail Marys of decade five land on beads 50–59', () => {
        const compiled = compileLiturgy(buildRosaryDefinition('sorrowful'));
        const fifth = compiled.steps
            .filter(s => s.state.phase === 'decade' && s.state.decade === 5 && s.state.bead >= 50)
            .map(s => s.state.bead);
        expect(Math.max(...fifth)).toBe(59);
    });

    it('the Glory Be is prayed on the centrepiece, never on a bead', () => {
        const compiled = compileLiturgy(buildRosaryDefinition('joyful'));
        const opening = compiled.steps.find(s => s.id === 'opening-glory-be');
        expect(opening.state.bead).toBe(ROSARY_CENTREPIECE);
    });
});
