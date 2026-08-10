/**
 * The manifest and the engines it names must not drift.
 *
 * WORK_ENGINE_MANIFEST duplicates ids, names and categories that also
 * live beside the engine classes, because the classes must stay behind a
 * dynamic import and the names must not. A duplication that nothing
 * checks is how the curator context came to advertise engines from a
 * hardcoded list nobody was maintaining.
 */
import { describe, expect, it } from 'vitest';
import {
    WORK_ENGINE_MANIFEST,
    workEngineFamilies,
    workEngineFamilyOf,
    loadWorkEngines
} from './work-engines.js';

describe('the work-engine manifest matches what loads', () => {
    it('names every family the registry knows, and no other', () => {
        const declared = new Set(WORK_ENGINE_MANIFEST.map(entry => entry.family));
        expect([...declared].sort()).toEqual([...workEngineFamilies()].sort());
    });

    it.each(['paradise-lost', 'storm-of-steel'])(
        'matches %s id for id, name for name, in order',
        async (family) => {
            const loaded = await loadWorkEngines(family);
            expect(loaded.length).toBeGreaterThan(0);

            const fromManifest = WORK_ENGINE_MANIFEST
                .filter(entry => entry.family === family)
                .map(({ id, name, category }) => ({ id, name, category }));
            const fromModule = loaded
                .map(({ id, name, category }) => ({ id, name, category }));

            expect(fromManifest).toEqual(fromModule);
        }
    );

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
