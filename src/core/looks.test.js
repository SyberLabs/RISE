/**
 * A look is a named point in the configuration space, the preset mechanism
 * (ARCHITECTURE §8.26) over field, colour, sound and typography. These
 * tests hold it to four properties:
 *
 *   what a look writes        — values the engine's own gates admit unchanged
 *   what a look leaves        — a reading's own art, a held focal, Living Text,
 *                               pace and rhythm
 *   which look a config is in — derived, and distinct for every look
 *   what it replaces          — every roll reopens in Reader setup as the
 *                               look it drew, and every Ask answer as the
 *                               look Home names it by
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

if (typeof globalThis.indexedDB === 'undefined') {
    globalThis.indexedDB = {
        open: () => ({ onsuccess: null, onerror: null, onupgradeneeded: null })
    };
}

const { LOOKS, applyLook, lookOf, lookOfSession } = await import('./looks.js');
const { ChamberOrbital, createDefaultConfig } = await import('../components/read/ChamberOrbital.js');
const { normalizeVisualConfig } = await import('./session-compiler.js');
const { normalizeVisualSelection } = await import('./visual-selection.js');
const { sessionColorThemeId, sessionPresentation } = await import('./session-presentation.js');
const { ENGINE_CATALOG } = await import('./visual-registry.js');
const { THEME_ENGINE_MAP } = await import('./theme-engine-map.js');
const { SOUNDSCAPES } = await import('../audio/soundscapes.js');
const { ROLL_LOOKS, ROLL_RANGES, VIVID_LOOKS, composeRoll } = await import('./roll.js');
const { todayDecision } = await import('./today-reading.js');
const { todayPoem, todayPool } = await import('./today-poem.js');
const { jevReleasedEdition, jevReleasedWorkIds } = await import('./jev-describe.js');
const { CHOICES, CONFIG_ANSWERS, validDecision } = await import('./decision/recommend.js');
const { JEV } = await import('./decision/providers.js');
const { validateJevRecommendation } = await import('../app/jev-reading.js');

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

    /** A gallery reading drawing `procedural`, in every other respect `id`'s look. */
    const galleryOf = (id, procedural) => {
        const config = applyLook(createDefaultConfig(), id);
        config.visualInterlocution.interlocution = {
            ...config.visualInterlocution.interlocution, sourceFamily: 'procedural', procedural, sourced: []
        };
        return config;
    };

    it('is never Flame for a gallery that draws an engine, which is not Living Flame', () => {
        expect(lookOf(galleryOf('flame', ['fractal']))).toBe('custom');
        // The same, as an Ask answer lowers it: fractal flames, Wonder, Display L, ember.
        const { visualConfig, ...asked } = composeRoll({ look: 'revel', workId: jevReleasedWorkIds()[0], section: 'first' }).config;
        expect(lookOfSession({ ...asked, ...look('flame').config, visualConfig })).toBe('custom');
    });

    it('is Nocturne for a gallery of its own engines, and Custom for one drawing another', () => {
        expect(lookOf(galleryOf('nocturne', ['turrell', 'harmonograph']))).toBe('nocturne');
        expect(lookOf(galleryOf('nocturne', ['fractal']))).toBe('custom');
    });

    it('is the chosen look after choosing it over a gallery of another look\'s engines, keeping the reader\'s own art', () => {
        const config = applyLook(galleryOf('nocturne', ['harmonograph']), 'gallery');
        expect(config.visualInterlocution.interlocution.procedural).toEqual(['turrell']);
        expect(lookOf(config)).toBe('gallery');

        const blend = galleryOf('nocturne', ['harmonograph']);
        blend.visualInterlocution.interlocution = {
            ...blend.visualInterlocution.interlocution, sourceFamily: 'blend', sourced: ['dore:genesis']
        };
        const { interlocution } = applyLook(blend, 'revel').visualInterlocution;
        expect([interlocution.procedural, interlocution.sourced]).toEqual([['fractal'], ['dore:genesis']]);
    });

    it('keeps a roll\'s one engine when its own look is chosen again', () => {
        expect(applyLook(galleryOf('nocturne', ['harmonograph']), 'nocturne').visualInterlocution.interlocution.procedural)
            .toEqual(['harmonograph']);
    });

    it('still names the look of a gallery of the reader\'s own art, whose engines are not compared', () => {
        const base = createDefaultConfig();
        base.visualInterlocution.interlocution = {
            ...base.visualInterlocution.interlocution,
            sourceFamily: 'collections', sourced: ['dore:genesis'], procedural: []
        };
        expect(lookOf(applyLook(base, 'nocturne'))).toBe('nocturne');
        expect(lookOf(applyLook(base, 'flame'))).toBe('flame');
    });
});

describe('which look a session input is in', () => {
    it('reads a lowered decision by its visualConfig, as Begin hands it over', () => {
        const nocturne = composeRoll({ look: 'nocturne', workId: jevReleasedWorkIds()[0], section: 'first' });
        expect(nocturne.config).not.toHaveProperty('visualInterlocution');
        expect(lookOfSession(nocturne.config)).toBe('nocturne');
    });

    it('reads an unset gallery glass as set, and a glass turned off as Custom', () => {
        const visualConfig = { visualMode: 'interlocution', interlocution: { presentation: 'continuous', galleryCadence: 0.15 } };
        const nocturne = { ...look('nocturne').config, visualConfig };
        expect(lookOfSession(nocturne)).toBe('nocturne');
        expect(lookOfSession({ ...nocturne, visualConfig: { ...visualConfig, interlocution: { ...visualConfig.interlocution, streamGlass: false } } }))
            .toBe('custom');
    });

    it('is Custom for nothing at all', () => {
        expect(lookOfSession(null)).toBe('custom');
    });
});

describe('what the looks replace', () => {
    describe('a roll reopened in Reader setup', () => {
        let container;
        beforeEach(() => {
            localStorage.clear();
            container = document.createElement('div');
            document.body.appendChild(container);
        });
        afterEach(() => { document.body.innerHTML = ''; });

        function inSetup(decision) {
            const orbital = new ChamberOrbital(container, {});
            orbital.loadText('Begin the morning', 'Library', decision.config);
            const reopened = orbital.config;
            orbital.destroy();
            return reopened;
        }

        it('is the look it drew, at the rhythm and pace it drew, for every look and every rhythm and pace in its range', () => {
            const workId = jevReleasedWorkIds()[0];
            let turn = 0;
            for (const { id } of ROLL_LOOKS) {
                for (const rhythm of ROLL_RANGES[id].rhythms) {
                    for (const pace of ROLL_RANGES[id].paces) {
                        // Alternate ends of the draw, so a look with two engines opens with each.
                        const random = turn++ % 2 ? () => 0.999 : () => 0;
                        const reopened = inSetup(composeRoll({ look: id, workId, section: 'first', rhythm, pace, random }));
                        expect(lookOf(reopened), `${id} × ${rhythm} × ${pace}`).toBe(id);
                        expect([reopened.chunkMode, reopened.wpm], `${id} × ${rhythm} × ${pace}`).toEqual([rhythm, pace]);
                    }
                }
            }
        }, 60_000);

        it('is the day\'s look for today\'s poem, for every look, engine and pace a cycle draws', () => {
            const drawn = new Map();
            for (let day = 0; day < todayPool().length; day++) {
                const decision = todayDecision(todayPoem(new Date(2026, 0, 1 + day, 12)));
                const { visualEngine, wpm } = decision.config;
                drawn.set(`${decision.look} ${visualEngine} ${wpm}`, decision);
            }
            for (const [drew, decision] of drawn) {
                const reopened = inSetup(decision);
                expect(lookOf(reopened), drew).toBe(decision.look);
                expect([reopened.chunkMode, reopened.wpm], drew).toEqual(['phrase', decision.config.wpm]);
            }
            expect([...new Set([...drawn.values()].map(decision => decision.look))].sort())
                .toEqual(VIVID_LOOKS.map(entry => entry.id).sort());
        }, 60_000);
    });

    describe('an Ask answer reopened in Reader setup', () => {
        let container;
        beforeEach(() => {
            localStorage.clear();
            container = document.createElement('div');
            document.body.appendChild(container);
        });
        afterEach(() => { document.body.innerHTML = ''; });

        const edition = jevReleasedEdition(jevReleasedWorkIds()[0]);
        const book = {
            work_id: edition.workId, edition_id: edition.editionId,
            source_revision: edition.sourceRevision, fit_description: 'A reading.'
        };
        /** The plan field each question answers, where the names differ. */
        const FIELD = { pace: 'wpm', chunk: 'chunkMode', visual: 'visualMode', reveal: 'revealMode' };
        const answersOf = plan => Object.fromEntries(CONFIG_ANSWERS.map(question =>
            [question, { type: 'choice', choice: String(plan[FIELD[question] ?? question]) }]));
        /** What the model's answers become through the same admission a live Ask takes. */
        const ask = (answers, intent) => validDecision({
            id: 'ask-round-trip', provider: 'TypeSafe', model: 'typesafe/jev-1.13',
            answers: { book: { type: 'choice', choice: book.work_id }, ...answers }
        }, [book], intent, CHOICES, JEV);

        it('is the look Home names it by, for every look an answer can land in and every choice of every question away from one', () => {
            const workId = edition.workId;
            const bases = [
                answersOf({ ...composeRoll({ look: 'plain', workId, section: 'first' }).config, chamberFace: 'literary', fontSize: 'medium' }),
                ...ROLL_LOOKS.map(({ id }) => answersOf(composeRoll({ look: id, workId, section: 'first' }).config))
            ];
            const answers = [
                ...bases.flatMap(base => ['a reading', 'a night drive through neon tokyo'].map(intent => [base, intent])),
                // Each choice once, away from the bases in turn, so the sweep
                // stays a few seconds of setup rather than a minute.
                ...CONFIG_ANSWERS.flatMap((question, row) => Object.keys(CHOICES[question]).map((choice, column) =>
                    [{ ...bases[(row + column) % bases.length], [question]: { type: 'choice', choice } }, 'a reading']))
            ];
            const opened = new Map();
            for (const [answer, intent] of answers) {
                const decision = ask(answer, intent);
                if (!decision) continue;
                const { visualConfig, soundscape, audioPreset, presentation, chunkMode } = decision.config;
                opened.set(JSON.stringify([visualConfig, soundscape, audioPreset, presentation, chunkMode]), decision);
            }
            const named = new Set();
            // One setup, as a reader opens one answer after another in it.
            const orbital = new ChamberOrbital(container, {});
            for (const [lowered, decision] of opened) {
                expect(() => validateJevRecommendation(decision), lowered).not.toThrow();
                orbital.loadText('Begin the morning', 'Library', decision.config);
                const reopened = lookOf(orbital.config);
                expect(lookOfSession(decision.config), lowered).toBe(reopened);
                named.add(reopened);
            }
            orbital.destroy();
            // Both sides agreeing on Custom alone would prove nothing.
            expect([...named].sort()).toEqual([...ROLL_LOOKS.map(entry => entry.id), 'custom'].sort());
        }, 60_000);
    });
});
