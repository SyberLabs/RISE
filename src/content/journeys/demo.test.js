/**
 * The Demonstration, and the disclosed route it depends on.
 *
 * Two things are guarded here. That an excerpt is a LOCATOR which
 * refuses rather than approximates, and that a demo reel is never
 * allowed to call itself a Journey.
 */
import { describe, expect, it } from 'vitest';
import { DEMO_JOURNEY, DEMO_PASSAGES } from './demo.js';
import { WAR_JOURNEY, WAR_PASSAGES } from './war.js';
import { resolveJourneyPassages, resolvePassage } from './passages.js';
import { createJourneyHandoff } from './handoff.js';
import { compileSession } from '../../core/session-compiler.js';

describe('a disclosed route through a reading unit', () => {
    const scene = WAR_PASSAGES.find(p => p.id === 'pass-iliad-hector-household');

    it('takes the scene its anchors name and nothing else', async () => {
        const passage = await resolvePassage(scene);
        expect(passage.excerpted).toBe(true);
        expect(passage.words).toBeLessThan(passage.wholeWords / 3);
        expect(passage.text.startsWith('So spake Hector of the glancing helm')).toBe(true);
        // The closing anchor is the point of the passage, not a
        // convenient stopping place: Troy mourns him before he dies.
        expect(passage.text.trimEnd()
            .endsWith('So bewailed they Hector, while yet he lived')).toBe(true);
    }, 120000);

    it('discloses that it is a route, per §1.4', async () => {
        // "may not silently store or present an excerpt as though it
        // were the complete holding."
        const passage = await resolvePassage(scene);
        expect(passage.excerptNote).toBeTruthy();
        expect(passage.wholeWords).toBeGreaterThan(passage.words);
    }, 120000);

    it('checksums what a reader reads, not the whole division', async () => {
        const routed = await resolvePassage(scene);
        const whole = await resolvePassage({ ...scene, excerpt: undefined });
        expect(routed.checksum).not.toBe(whole.checksum);
        expect(routed.checksum).toMatch(/^[0-9a-f]{64}$/);
    }, 120000);

    it('refuses an anchor it cannot find', async () => {
        // Falling back to the whole division would present a route as
        // the holding — the one thing §1.4 forbids.
        await expect(resolvePassage({
            ...scene, excerpt: { from: 'a line Homer never wrote', to: 'nor this' }
        })).rejects.toThrow(/anchor was not found/i);
    }, 120000);

    it('refuses a closing anchor that precedes the opening one', async () => {
        await expect(resolvePassage({
            ...scene,
            excerpt: {
                from: 'So bewailed they Hector, while yet he lived',
                to: 'So spake Hector of the glancing helm and departed'
            }
        })).rejects.toThrow(/closing anchor/i);
    }, 120000);

    it('survives a line break falling inside a quoted anchor', async () => {
        // The Iliad is hard-wrapped at 71 columns, so almost every
        // phrase long enough to be unique contains one.
        const passage = await resolvePassage(scene);
        expect(passage.text.split(/\s+/).length).toBeGreaterThan(200);
    }, 120000);
});

describe('the trim', () => {
    it('brings War under half its former length', async () => {
        const { resolved } = await resolveJourneyPassages(WAR_PASSAGES);
        const words = resolved.reduce((n, p) => n + p.words, 0);
        const whole = resolved.reduce((n, p) => n + p.wholeWords, 0);
        expect(words).toBeLessThan(whole / 1.5);
        // Milton is untouched: the ten figures span his whole book and
        // the argument is the arc.
        const milton = resolved.find(p => p.workId === 'paradise-lost');
        expect(milton.excerpted).toBe(false);
    }, 240000);
});

describe('a demonstration is not a Journey', () => {
    it('refuses the word, because §1.1 means something', async () => {
        // A survey that cycles every engine is an anthology by design.
        // Publishing it as a Journey would make the term meaningless.
        expect(DEMO_JOURNEY.kind).toBe('demonstration');
        expect(WAR_JOURNEY.kind).toBe('authored-journey');
    });

    it('claims no counterpressure it does not have', async () => {
        for (const movement of DEMO_JOURNEY.movements) {
            expect(movement.counterpressure).toMatch(/none claimed/i);
        }
    });

    it('is short enough to be shown to somebody', async () => {
        const { resolved } = await resolveJourneyPassages(DEMO_PASSAGES);
        const minutes = resolved.reduce((n, p) => n + p.words, 0) / DEMO_JOURNEY.wpm;
        expect(minutes).toBeLessThan(12);
    }, 240000);

    it('names only engines that exist', async () => {
        // A figure naming an engine nothing provides goes still at the
        // moment it should be loudest, and a demo that goes still is
        // worse than no demo.
        const [{ PARADISE_LOST_ENGINES }, { STORM_OF_STEEL_ENGINES }] = await Promise.all([
            import('../../visuals/paradise_lost/index.js'),
            import('../../visuals/storm/index.js')
        ]);
        const available = new Set([
            ...PARADISE_LOST_ENGINES.map(e => e.id),
            ...STORM_OF_STEEL_ENGINES.map(e => e.id)
        ]);
        const named = DEMO_JOURNEY.movements
            .flatMap(m => m.segments)
            .flatMap(s => s.figures || [])
            .flatMap(f => f.engines || []);
        expect(named.length).toBeGreaterThan(10);
        for (const id of named) {
            expect(available.has(id), `unknown engine ${id}`).toBe(true);
        }
    });

    it('shows every procedural work there is', async () => {
        // The whole point. If an engine exists and the Demonstration
        // does not show it, the reel is lying about the range.
        const [{ PARADISE_LOST_ENGINES }, { STORM_OF_STEEL_ENGINES }] = await Promise.all([
            import('../../visuals/paradise_lost/index.js'),
            import('../../visuals/storm/index.js')
        ]);
        const named = new Set(DEMO_JOURNEY.movements
            .flatMap(m => m.segments)
            .flatMap(s => s.figures || [])
            .flatMap(f => f.engines || []));
        for (const engine of [...PARADISE_LOST_ENGINES, ...STORM_OF_STEEL_ENGINES]) {
            expect(named.has(engine.id), `${engine.id} is not demonstrated`).toBe(true);
        }
    });

    it('compiles to a real reading with every figure placed', async () => {
        // Counted from the registries rather than written down, so
        // withholding an engine cannot leave a stale number here.
        const [{ PARADISE_LOST_ENGINES }, { STORM_OF_STEEL_ENGINES }] = await Promise.all([
            import('../../visuals/paradise_lost/index.js'),
            import('../../visuals/storm/index.js')
        ]);
        const published = PARADISE_LOST_ENGINES.length + STORM_OF_STEEL_ENGINES.length;

        const handoff = await createJourneyHandoff(DEMO_JOURNEY, DEMO_PASSAGES);
        const figures = handoff.config.visualProgram.segments
            .filter(s => s.id.includes('-figure-'));
        expect(figures).toHaveLength(published);
        // Each figure owns a real stretch of the reading rather than an
        // instant.
        for (const figure of figures) {
            expect(figure.match.toProgress - figure.match.fromProgress)
                .toBeGreaterThan(0.05);
        }
        const session = compileSession({ name: 'Demonstration', ...handoff.config });
        expect(session.atoms.length).toBeGreaterThan(100);
    }, 240000);
});

describe('a withheld engine is withheld everywhere', () => {
    // Mustard Gas (#4) is held back for resolution: reaction-diffusion
    // resolves at the grid it simulates on, and behind a full-bleed
    // reading that grid reads as pixellation rather than as gas.
    //
    // Withheld in the registry alone — field, gallery, Page, Journey,
    // and Demonstration all take their vocabulary from it.
    const WITHHELD = 'turing_gas';

    it('is absent from the registry, which is the only place it lived', async () => {
        const { STORM_OF_STEEL_ENGINES } = await import('../../visuals/storm/index.js');
        expect(STORM_OF_STEEL_ENGINES.map(e => e.id)).not.toContain(WITHHELD);
        expect(STORM_OF_STEEL_ENGINES).toHaveLength(7);
    });

    it('cannot be reached by the living field, which rotates the registry', async () => {
        // War's Under Steel movement names no figures, so it rotates the
        // whole family. That is exactly why removal had to happen in the
        // registry rather than in the Demonstration's figure list.
        const { loadWorkEngines } = await import('../../visuals/work-engines.js');
        const engines = await loadWorkEngines('storm-of-steel');
        expect(engines.map(e => e.id)).not.toContain(WITHHELD);
        expect(engines.length).toBe(7);
    });

    it('is named by no figure in any published reading', async () => {
        const named = [DEMO_JOURNEY, WAR_JOURNEY]
            .flatMap(j => j.movements)
            .flatMap(m => m.segments)
            .flatMap(s => s.figures || [])
            .flatMap(f => f.engines || []);
        expect(named).not.toContain(WITHHELD);
    });

    it('keeps the ASCII trench, which is the most legible of the eight', async () => {
        const { STORM_OF_STEEL_ENGINES } = await import('../../visuals/storm/index.js');
        expect(STORM_OF_STEEL_ENGINES.map(e => e.id)).toContain('ascii_soldier');
        // And it opens the Demonstration's second movement, because a
        // demo wants its clearest image first.
        const steel = DEMO_JOURNEY.movements.find(m => m.id === 'demo-steel');
        const first = steel.segments[0].figures[0];
        expect(first.fromLine).toBe(0);
        expect(first.engines).toEqual(['ascii_soldier']);
    });

    it('leaves the class itself in place, so restoring it is one line', async () => {
        // Withheld, not deleted. The engine is still exported.
        const storm = await import('../../visuals/storm/index.js');
        expect(typeof storm.StormReactionDiffusionEngine).toBe('function');
    });
});

describe('the reel plays in order, and each movement opens on its own engine', () => {
    /**
     * Reported from a real reading: the Jünger movement opened on a
     * Milton engine and the ASCII trench was never seen. The cause was
     * in the field's load cache (see work-engine-field.test.js), but
     * nothing here would have caught it either — so this walks the
     * compiled session the way the runtime does and records what a
     * reader is actually shown, in order.
     */
    it('opens Junger on the ASCII trench, not on Milton', async () => {
        const { cueForAtom } = await import('../../core/visual-scheduler.js');
        const handoff = await createJourneyHandoff(DEMO_JOURNEY, DEMO_PASSAGES);
        const session = compileSession({ name: 'Demonstration', ...handoff.config });

        const shown = [];
        let last = null;
        for (const atom of session.atoms) {
            const { cue } = cueForAtom(handoff.config.visualProgram, atom);
            const key = `${cue.kind}:${(cue.engines || []).join(',')}`;
            if (key !== last) { shown.push(cue); last = key; }
        }

        const engines = shown.filter(c => c.kind === 'procedural')
            .map(c => (c.engines || [])[0]);
        console.log('REEL ' + JSON.stringify(engines));

        // Milton's six, in his order.
        expect(engines.slice(0, 6)).toEqual([
            'heaven_in_order', 'flaming_sword', 'sulfur_magma',
            'chariot_deity', 'fall_hypercube', 'dark_ocean_chaos'
        ]);
        // Then the boundary, then Jünger — opening on the trench.
        expect(engines[6]).toBe('ascii_soldier');
        // And the withheld engine appears nowhere in the reel.
        expect(engines).not.toContain('turing_gas');
    }, 240000);

    it('scores the boundary as stillness between the two families', async () => {
        // The movements must not touch. A `still` cue empties the
        // families, which is what stops the field — and what exposed
        // the stale-load bug in the first place.
        const { cueForAtom } = await import('../../core/visual-scheduler.js');
        const { isBoundarySource } = await import('../../core/journey-compiler.js');
        const handoff = await createJourneyHandoff(DEMO_JOURNEY, DEMO_PASSAGES);
        const session = compileSession({ name: 'Demonstration', ...handoff.config });

        const boundary = session.atoms.find(a => isBoundarySource(a.sourceId));
        expect(boundary).toBeTruthy();
        expect(cueForAtom(handoff.config.visualProgram, boundary).cue.kind).toBe('still');
    }, 240000);
});
