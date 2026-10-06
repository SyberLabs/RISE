/**
 * A look is a named point in the configuration space, the stance mechanism
 * (ARCHITECTURE §8.26) widened to field, colour, sound and typography. These
 * tests hold it to four properties:
 *
 *   what a look writes        — values the engine's own gates admit unchanged
 *   what a look leaves        — a reading's own art, a held focal, Living Text,
 *                               pace and rhythm
 *   which look a config is in — derived, and distinct for every look
 *   what it replaces          — every temper and stance has a look
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

if (typeof globalThis.indexedDB === 'undefined') {
    globalThis.indexedDB = {
        open: () => ({ onsuccess: null, onerror: null, onupgradeneeded: null })
    };
}

const { LOOKS, STANCE_LOOKS, TEMPER_LOOKS, applyLook, lookOf } = await import('./looks.js');
const { ChamberOrbital, createDefaultConfig } = await import('../components/read/ChamberOrbital.js');
const { normalizeVisualConfig } = await import('./session-compiler.js');
const { normalizeVisualSelection } = await import('./visual-selection.js');
const { sessionColorThemeId, sessionPresentation } = await import('./session-presentation.js');
const { ENGINE_CATALOG } = await import('./visual-registry.js');
const { THEME_ENGINE_MAP } = await import('./theme-engine-map.js');
const { SOUNDSCAPES } = await import('../audio/soundscapes.js');
const { STANCES, applyStance } = await import('./stances.js');
const { TEMPERS, composeRoll } = await import('./roll.js');
const { jevReleasedWorkIds } = await import('./jev-describe.js');

const look = id => LOOKS.find(entry => entry.id === id);

/** A configuration after the road a saved one takes: storage, then the compiler. */
function throughTheEngine(config) {
    const stored = JSON.parse(JSON.stringify(config));
    return { ...stored, visualInterlocution: normalizeVisualConfig(stored.visualInterlocution) };
}

describe('the look registry', () => {
    it('offers ten looks, in the order a reader meets them', () => {
        expect(LOOKS.map(entry => entry.id)).toEqual([
            'plain', 'gallery', 'nocturne', 'garden', 'flame',
            'signal', 'iris', 'revel', 'vigil', 'inlay'
        ]);
    });

    it('gives every look a name and a line of its own', () => {
        for (const entry of LOOKS) {
            expect(entry.name, entry.id).toMatch(/\S/u);
            expect(entry.line, entry.id).toMatch(/\S/u);
        }
        expect(new Set(LOOKS.map(entry => entry.line)).size).toBe(LOOKS.length);
    });

    it('is frozen, so no caller can retune a look in place', () => {
        for (const entry of LOOKS) {
            expect(Object.isFrozen(entry), entry.id).toBe(true);
            expect(Object.isFrozen(entry.config), entry.id).toBe(true);
            expect(Object.isFrozen(entry.config.presentation), entry.id).toBe(true);
        }
    });

    it('refuses a look it has no entry for', () => {
        expect(() => applyLook(createDefaultConfig(), 'salon')).toThrow(TypeError);
    });
});

describe('what each look names', () => {
    it('names only engines the catalog holds', () => {
        const catalog = new Set(ENGINE_CATALOG.map(engine => engine.id));
        for (const entry of LOOKS) {
            for (const engine of entry.engines) expect(catalog.has(engine), `${entry.id}: ${engine}`).toBe(true);
        }
    });

    it('draws Flame with Living Flame', () => {
        expect(look('flame').engines).toEqual(['living-flame']);
    });

    it('keeps ember for Flame alone, Iris in rose and Nocturne in amethyst', () => {
        const theme = id => look(id).config.presentation.colorTheme;
        expect(LOOKS.filter(entry => theme(entry.id) === 'ember').map(entry => entry.id)).toEqual(['flame']);
        expect(theme('iris')).toBe('rose');
        expect(theme('nocturne')).toBe('amethyst');
    });

    it('sets Revel extra large, a size phrases can read in', () => {
        expect(look('revel').config.presentation.fontSize).toBe('xlarge');
    });

    it('colours every look with one of the nine themes', () => {
        for (const { id, config } of LOOKS) {
            expect(Object.keys(THEME_ENGINE_MAP), id).toContain(config.presentation.colorTheme);
        }
    });

    it('sounds every look with a known soundscape and never a tone under it', () => {
        const known = new Set(['none', ...Object.keys(SOUNDSCAPES)]);
        for (const { id, config } of LOOKS) {
            expect(known.has(config.soundscape), id).toBe(true);
            expect(config.audioPreset, id).toBe('silent');
        }
    });

    it('leaves pace and curve to the reader, and only Inlay sets the rhythm', () => {
        for (const { id, config } of LOOKS) {
            expect(config, id).not.toHaveProperty('wpm');
            expect(config, id).not.toHaveProperty('curve');
        }
        expect(LOOKS.filter(entry => 'chunkMode' in entry.config).map(entry => entry.id)).toEqual(['inlay']);
        expect(look('inlay').config.chunkMode).toBe('word');
    });

    it('offers Inlay on a phone first, as data for the surfaces that list it', () => {
        expect(look('inlay').maxViewportWidth).toBe(820);
        expect(LOOKS.filter(entry => 'maxViewportWidth' in entry).map(entry => entry.id)).toEqual(['inlay']);
    });
});

describe('the engine stays sovereign', () => {
    it('emits field, colour and typography the gates admit unchanged', () => {
        for (const { id, config } of LOOKS) {
            const asked = applyLook(createDefaultConfig(), id);
            const given = throughTheEngine(asked);
            const visual = config.visualInterlocution;
            expect(given.visualInterlocution.visualMode, id).toBe(visual.visualMode);
            for (const [key, value] of Object.entries(visual.interlocution || {})) {
                expect(given.visualInterlocution.interlocution[key], `${id}: ${key}`).toEqual(value);
            }
            expect(sessionColorThemeId(given), id).toBe(config.presentation.colorTheme);
            expect(sessionPresentation(given), id).toEqual({
                chamberFace: config.presentation.chamberFace,
                fontSize: config.presentation.fontSize
            });
        }
    });

    it('reads every look back off its own configuration after the engine has normalized it', () => {
        for (const { id } of LOOKS) {
            expect(lookOf(throughTheEngine(applyLook(createDefaultConfig(), id))), id).toBe(id);
        }
    });

    it('lands in the chosen look from any other, so no two looks collide', () => {
        for (const from of LOOKS) {
            for (const to of LOOKS) {
                const config = applyLook(applyLook(createDefaultConfig(), from.id), to.id);
                expect(lookOf(config), `${from.id} then ${to.id}`).toBe(to.id);
            }
        }
    });
});

describe('a look sets, it does not lock', () => {
    it('leaves the config it was handed untouched', () => {
        const base = createDefaultConfig();
        const before = JSON.parse(JSON.stringify(base));
        applyLook(base, 'nocturne');
        expect(base).toEqual(before);
    });

    it('never touches a focal a launch is holding, or Living Text', () => {
        const base = createDefaultConfig();
        base.visualInterlocution.focals = { type: 'icon', iconId: 'transfiguration' };
        base.visualInterlocution.livingText = { enabled: false };
        for (const { id } of LOOKS) {
            const { visualInterlocution } = applyLook(base, id);
            expect(visualInterlocution.focals, id).toEqual({ type: 'icon', iconId: 'transfiguration' });
            expect(visualInterlocution.livingText, id).toEqual({ enabled: false });
        }
    });

    it('keeps the pace, curve and loaded reading the reader brought', () => {
        const base = { ...createDefaultConfig(), wpm: 340, curve: 'wave', text: 'Begin the morning' };
        for (const { id } of LOOKS) {
            const config = applyLook(base, id);
            expect([config.wpm, config.curve, config.text], id).toEqual([340, 'wave', 'Begin the morning']);
        }
    });

    it('keeps a reading its own art rather than replacing it with a field', () => {
        const base = createDefaultConfig();
        base.visualInterlocution.interlocution = {
            ...base.visualInterlocution.interlocution,
            sourceFamily: 'collections',
            sourced: ['dore:genesis'],
            procedural: []
        };
        for (const { id } of LOOKS) {
            const { interlocution } = applyLook(base, id).visualInterlocution;
            expect([interlocution.sourceFamily, interlocution.sourced], id)
                .toEqual(['collections', ['dore:genesis']]);
        }
    });

    it('gives an empty shelf the gallery engines the look names, and only those the shelf admits', () => {
        for (const entry of LOOKS.filter(item => item.config.visualInterlocution.visualMode === 'interlocution')) {
            const { interlocution } = applyLook(createDefaultConfig(), entry.id).visualInterlocution;
            const admitted = normalizeVisualSelection({ procedural: entry.engines }).procedural;
            expect(interlocution.procedural, entry.id).toEqual(admitted);
            expect(interlocution.sourced, entry.id).toEqual([]);
        }
    });

    it('leaves the shelf alone when the field is not a gallery', () => {
        for (const entry of LOOKS.filter(item => item.config.visualInterlocution.visualMode !== 'interlocution')) {
            const { interlocution } = applyLook(createDefaultConfig(), entry.id).visualInterlocution;
            expect(interlocution, entry.id).toEqual(createDefaultConfig().visualInterlocution.interlocution);
        }
    });

    it('keeps a composed reading its band position', () => {
        const base = { ...createDefaultConfig(), presentation: { bandOffset: 0.3 } };
        expect(applyLook(base, 'garden').presentation.bandOffset).toBe(0.3);
    });
});

describe('which look a configuration is in', () => {
    it('is Custom once a field the look sets has moved', () => {
        const sound = applyLook(createDefaultConfig(), 'garden');
        sound.soundscape = 'jazz';
        expect(lookOf(sound)).toBe('custom');

        const colour = applyLook(createDefaultConfig(), 'garden');
        colour.presentation = { ...colour.presentation, colorTheme: 'cobalt' };
        expect(lookOf(colour)).toBe('custom');
    });

    it('is still the look after pace, curve or rhythm moves', () => {
        const config = applyLook(createDefaultConfig(), 'nocturne');
        Object.assign(config, { wpm: 420, curve: 'climax', chunkMode: 'sentence' });
        expect(lookOf(config)).toBe('nocturne');
    });

    it('is Custom for a configuration that matches none of them', () => {
        const config = createDefaultConfig();
        config.visualInterlocution.visualMode = 'attractor';
        config.soundscape = 'chase';
        expect(lookOf(config)).toBe('custom');
        expect(lookOf(null)).toBe('custom');
    });
});

describe('what the looks replace', () => {
    it('gives every temper and every stance a look, named by the table', () => {
        expect(TEMPER_LOOKS).toEqual({
            nocturne: 'nocturne', plainsong: 'plain', signal: 'signal', ember: 'iris',
            garden: 'garden', vigil: 'vigil', revel: 'revel', salon: 'garden'
        });
        expect(Object.keys(TEMPER_LOOKS).sort()).toEqual(TEMPERS.map(temper => temper.id).sort());
        expect(STANCE_LOOKS).toEqual({ plainly: 'plain', imagery: 'gallery', contemplate: 'vigil' });
        expect(Object.keys(STANCE_LOOKS).sort()).toEqual(STANCES.map(stance => stance.id).sort());
        for (const id of [...Object.values(TEMPER_LOOKS), ...Object.values(STANCE_LOOKS)]) {
            expect(look(id), id).toBeTruthy();
        }
    });

    it('reads each stance configuration as its look', () => {
        for (const { id } of STANCES) {
            expect(lookOf(applyStance(id, createDefaultConfig())), id).toBe(STANCE_LOOKS[id]);
        }
    });

    describe('a temper centre reopened in Reader setup', () => {
        let container;
        beforeEach(() => {
            localStorage.clear();
            container = document.createElement('div');
            document.body.appendChild(container);
        });
        afterEach(() => { document.body.innerHTML = ''; });

        function centreInSetup(temperId) {
            const temper = TEMPERS.find(item => item.id === temperId);
            const { config } = composeRoll({
                temper, workId: jevReleasedWorkIds()[0], section: 'first', random: () => 0
            });
            const orbital = new ChamberOrbital(container, {});
            orbital.loadText('Begin the morning', 'Library', config);
            const reopened = orbital.config;
            orbital.destroy();
            return reopened;
        }

        it.each(['plainsong', 'signal', 'garden'])(
            'reads %s as its look', temperId => {
                expect(lookOf(centreInSetup(temperId))).toBe(TEMPER_LOOKS[temperId]);
            }
        );

        it('reads nocturne as Custom: its centre is classic, and Nocturne is amethyst', () => {
            expect(lookOf(centreInSetup('nocturne'))).toBe('custom');
        });

        it('reads ember as Custom: its centre is the ember theme, and Iris is rose', () => {
            expect(lookOf(centreInSetup('ember'))).toBe('custom');
        });

        it('reads revel as Custom: its centre asks for Fit, which phrases read as large, and Revel is extra large', () => {
            expect(lookOf(centreInSetup('revel'))).toBe('custom');
        });

        it('reads salon as Custom: it folds into Garden by name, and its Klee lines, jazz and cobalt are not Garden', () => {
            expect(lookOf(centreInSetup('salon'))).toBe('custom');
        });

        it('reads vigil as Custom: Vigil keeps the Contemplate stance\'s aurora, not the temper\'s haunted bed', () => {
            expect(lookOf(centreInSetup('vigil'))).toBe('custom');
        });
    });
});
