/**
 * Every named engine can be built, and every built engine is named.
 *
 * WHAT THIS TEST USED TO BE, AND WHY IT ISN'T. WORK_ENGINE_MANIFEST was a
 * hand-kept copy of ids, names and categories that also lived beside the
 * engine classes, and this file compared the two id for id — the
 * duplication being how the curator context once came to advertise engines
 * from a list nobody was maintaining. There is one copy now: each family's
 * `engines.meta.js` is read by its own `index.js` and by the manifest, so
 * a name cannot drift from itself and comparing it to itself would prove
 * nothing. PROJECT-KNOWLEDGE §2.4: a guard no input can fail is decoration.
 *
 * The failure that IS still possible is the seam the split created — an
 * entry in the metadata with no class behind it, or a class the metadata
 * never names. Either one is a family that half-exists: the first
 * advertises an engine that throws on `new undefined()`, the second hides
 * a working engine from every surface that offers one. Both are silent.
 */
import { describe, expect, it } from 'vitest';
import {
    WORK_ENGINE_MANIFEST,
    workEngineFamilies,
    workEngineFamilyOf,
    loadWorkEngines
} from './work-engines.js';

describe('the work-engine manifest', () => {
    it('names every family the registry knows, and no other', () => {
        const declared = new Set(WORK_ENGINE_MANIFEST.map(entry => entry.family));
        expect([...declared].sort()).toEqual([...workEngineFamilies()].sort());
    });

    it.each(['paradise-lost', 'storm-of-steel'])(
        'gives every %s engine it names a class that can be constructed',
        async (family) => {
            const loaded = await loadWorkEngines(family);
            const named = WORK_ENGINE_MANIFEST.filter(entry => entry.family === family);
            expect(named.length).toBeGreaterThan(0);

            // Same engines, same order — the manifest IS the family's order.
            expect(loaded.map(entry => entry.id)).toEqual(named.map(entry => entry.id));

            for (const entry of loaded) {
                expect(typeof entry.engineClass,
                    `${family}/${entry.id} is named but has no class`).toBe('function');
                expect(() => new entry.engineClass(),
                    `${family}/${entry.id} cannot be constructed`).not.toThrow();
            }
        }
    );

    it('describes every engine it names', () => {
        for (const entry of WORK_ENGINE_MANIFEST) {
            expect(entry.name, `${entry.id} has no name`).toBeTruthy();
            expect(entry.category, `${entry.id} has no category`).toBeTruthy();
            expect(entry.description, `${entry.id} has no description`).toBeTruthy();
        }
    });

    it('answers which work an engine belongs to', () => {
        expect(workEngineFamilyOf('flaming_sword')).toBe('paradise-lost');
        expect(workEngineFamilyOf('voronoi')).toBe('storm-of-steel');
        // A cortex-general pattern belongs to no work — the distinction a
        // curator needs, since a Milton engine over Anna Karenina is
        // permitted by the capability list and wrong for the reading.
        expect(workEngineFamilyOf('klee')).toBeNull();
        expect(workEngineFamilyOf('nonexistent')).toBeNull();
    });

    it('carries no duplicate ids', () => {
        const ids = WORK_ENGINE_MANIFEST.map(entry => entry.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
