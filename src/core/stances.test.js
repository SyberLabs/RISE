/**
 * A stance is a curated POINT in the parameter space, not new machinery, so
 * these tests are about three properties and nothing else:
 *
 *   what a stance writes      — a coherent slice, in valid engine values
 *   what a stance leaves      — the reading's own imagery, a held focal
 *   what the engine does next  — normalizes it, unchanged
 *
 * The third is the load-bearing one. NORTH-STAR §4 rule 2 says the engine
 * stays sovereign: a stance emits a config that takes the SAME path as a
 * hand-built one. A test that only checked the registry's literals would pass
 * while a stance wrote a value the compiler silently clamps away, which is the
 * exact failure the rule exists to prevent.
 */
import { describe, expect, it } from 'vitest';
import { STANCES, applyStance, findStance, matchStance } from './stances.js';
import { normalizeVisualConfig } from './session-compiler.js';
import { normalizeVisualSelection } from './visual-selection.js';
import { normalizePresentation } from './visual-presence.js';

/** The shape a stance is a partial of, reduced to the fields stances touch. */
function bareConfig(overrides = {}) {
    return {
        wpm: 320,
        curve: 'climax',
        soundscape: 'faded-signal',
        audioPreset: 'gateway',
        visualInterlocution: {
            visualMode: 'genesis',
            focals: { type: 'standard', standardGlyph: 'breath', personalImage: null },
            livingText: { enabled: true },
            interlocution: {
                sourceFamily: 'procedural',
                procedural: [],
                sourced: [],
                presentation: 'full-frame',
                streamGlass: true,
                galleryCadence: 0.5
            }
        },
        ...overrides
    };
}

describe('the stance registry', () => {
    it('offers three named stances, in the order a reader meets them', () => {
        expect(STANCES.map(stance => stance.id))
            .toEqual(['plainly', 'imagery', 'contemplate']);
    });

    it('gives every stance a name and a line of its own', () => {
        for (const stance of STANCES) {
            expect(stance.name, stance.id).toMatch(/\S/u);
            expect(stance.line, stance.id).toMatch(/\S/u);
        }
    });

    it('finds a stance by id and nothing by a name it does not know', () => {
        expect(findStance('imagery').name).toBe('Read with imagery');
        expect(findStance('sit-with-the-passion')).toBeNull();
    });
});

describe('what each stance sets', () => {
    it('reads plainly: no imagery behind the words, a calm pace, silence', () => {
        const config = applyStance('plainly', bareConfig());
        expect(config.visualInterlocution.visualMode).toBe('off');
        expect(config.wpm).toBe(200);
        expect(config.curve).toBe('flat');
        expect(config.soundscape).toBe('none');
        expect(config.audioPreset).toBe('silent');
    });

    it('reads with imagery: the Gallery behind the text, contemplative', () => {
        const config = applyStance('imagery', bareConfig());
        const { interlocution } = config.visualInterlocution;
        expect(config.visualInterlocution.visualMode).toBe('interlocution');
        expect(interlocution.presentation).toBe('continuous');
        expect(interlocution.streamGlass).toBe(true);
        expect(interlocution.galleryCadence).toBeLessThan(0.34);
        expect(config.wpm).toBe(180);
        expect(config.soundscape).toBe('aurora');
        expect(config.audioPreset).toBe('silent');
    });

    it('contemplates: a held focal, an unhurried pace, a soundscape', () => {
        const config = applyStance('contemplate', bareConfig());
        expect(config.visualInterlocution.visualMode).toBe('focals');
        expect(config.wpm).toBe(140);
        expect(config.soundscape).toBe('aurora');
    });

    it('paces every stance on the step the Chamber slider can express', () => {
        // The Orbital's pacing slider is min 100, max 500, step 10. A stance
        // landing between steps would be a posture the reader cannot return to
        // after nudging the dial once.
        for (const stance of STANCES) {
            const { wpm } = applyStance(stance.id, bareConfig());
            expect(wpm % 10, stance.id).toBe(0);
            expect(wpm, stance.id).toBeGreaterThanOrEqual(100);
            expect(wpm, stance.id).toBeLessThanOrEqual(500);
        }
    });

    it('never leaves a soundscape and a pure tone sounding at once', () => {
        // Two beds at one carrier mask each other; the Orbital resolves the
        // pair in the soundscape's favour. A stance must not need that repair.
        for (const stance of STANCES) {
            const config = applyStance(stance.id, bareConfig());
            if (config.soundscape !== 'none') {
                expect(config.audioPreset, stance.id).toBe('silent');
            }
        }
    });

    it('refuses a stance it has no entry for', () => {
        expect(() => applyStance('study', bareConfig())).toThrow(TypeError);
    });
});

describe('a stance sets, it does not lock', () => {
    it('leaves the config it was handed untouched', () => {
        const base = bareConfig();
        const before = JSON.parse(JSON.stringify(base));
        applyStance('imagery', base);
        expect(base).toEqual(before);
    });

    it('keeps a reading its own art rather than replacing it with a field', () => {
        // "Sourced from the reading's own collection" (NORTH-STAR §4). A Chapel
        // or Doré launch arrives with its shelf already filled; choosing
        // imagery must set the SURFACE and leave the art alone.
        const base = bareConfig();
        base.visualInterlocution.interlocution = {
            ...base.visualInterlocution.interlocution,
            sourceFamily: 'collections',
            sourced: ['dore:genesis'],
            procedural: []
        };

        const { interlocution } = applyStance('imagery', base).visualInterlocution;

        expect(interlocution.sourced).toEqual(['dore:genesis']);
        expect(interlocution.sourceFamily).toBe('collections');
    });

    it('gives an empty shelf something to show rather than promising imagery and holding still', () => {
        const { interlocution } = applyStance('imagery', bareConfig()).visualInterlocution;
        expect(interlocution.procedural.length).toBeGreaterThan(0);
        expect(interlocution.sourced).toEqual([]);
        // Whatever it seeds has to be a real engine, or the Gallery is empty
        // for a second time by a different route.
        expect(normalizeVisualSelection(interlocution).procedural)
            .toEqual(interlocution.procedural);
    });

    it('never touches a focal a launch is holding', () => {
        // Sacred restraint (NORTH-STAR §4 rule 4): the Chapel seeds an icon,
        // and Contemplate is the stance most tempted to overwrite it.
        const base = bareConfig();
        base.visualInterlocution.focals = { type: 'icon', iconId: 'transfiguration' };

        for (const stance of STANCES) {
            expect(applyStance(stance.id, base).visualInterlocution.focals, stance.id)
                .toEqual({ type: 'icon', iconId: 'transfiguration' });
        }
    });

    it('leaves the semantic condition of the text to the reader', () => {
        // Living Text is IN the words, not behind them, and it is on by
        // deliberate decision. No stance is a vote on that.
        const base = bareConfig();
        base.visualInterlocution.livingText = { enabled: true };
        for (const stance of STANCES) {
            expect(applyStance(stance.id, base).visualInterlocution.livingText, stance.id)
                .toEqual({ enabled: true });
        }
    });

    it('carries the loaded reading through unchanged', () => {
        const base = bareConfig({ text: 'Begin the morning', textSource: 'Meditations' });
        const config = applyStance('contemplate', base);
        expect(config.text).toBe('Begin the morning');
        expect(config.textSource).toBe('Meditations');
    });
});

describe('the engine stays sovereign', () => {
    it('emits nothing the session compiler has to clamp away', () => {
        for (const stance of STANCES) {
            const config = applyStance(stance.id, bareConfig());
            const asked = config.visualInterlocution;
            const given = normalizeVisualConfig(asked);

            expect(given.visualMode, stance.id).toBe(asked.visualMode);
            expect(given.interlocution.presentation, stance.id)
                .toBe(normalizePresentation(asked.interlocution.presentation));
            expect(given.interlocution.galleryCadence, stance.id)
                .toBe(asked.interlocution.galleryCadence);
            expect(given.interlocution.streamGlass, stance.id)
                .toBe(asked.interlocution.streamGlass);
            expect(given.interlocution.procedural, stance.id)
                .toEqual(asked.interlocution.procedural);
            expect(given.interlocution.sourced, stance.id)
                .toEqual(asked.interlocution.sourced);
        }
    });
});

describe('which stance a configuration is standing in', () => {
    it('is read off the configuration, not remembered', () => {
        for (const stance of STANCES) {
            expect(matchStance(applyStance(stance.id, bareConfig()))).toBe(stance.id);
        }
    });

    it('is nobody once a dial has moved', () => {
        const nudged = applyStance('imagery', bareConfig());
        nudged.wpm += 10;
        expect(matchStance(nudged)).toBeNull();
    });

    it('is still the stance when the reading brought its own art', () => {
        const base = bareConfig();
        base.visualInterlocution.interlocution = {
            ...base.visualInterlocution.interlocution,
            sourceFamily: 'collections',
            sourced: ['dore:genesis']
        };
        expect(matchStance(applyStance('imagery', base))).toBe('imagery');
    });

    it('is nobody for a configuration that matches none of them', () => {
        expect(matchStance(bareConfig())).toBeNull();
        expect(matchStance(null)).toBeNull();
    });
});
