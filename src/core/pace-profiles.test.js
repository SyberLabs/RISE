/**
 * The pace profiles are one list, and every place that names them is held to it.
 *
 * The list used to be written out in six places, so a profile added to the
 * compiler was not offered by the room that lets a reader choose it, or was
 * offered and quietly turned to Flat by the layer that saves the choice
 * (PROJECT-KNOWLEDGE §2.1). Each copy left is checked here against the one.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PACE_CURVE_IDS } from './pacing.js';
import { workshopProjectToSessionConfig } from './workshop-project.js';
import { compileSession } from './session-compiler.js';
import { CURVE_OPTIONS } from '../components/ChamberOrbital.js';
import { CURVE_PATHS } from '../components/make/Workshop.js';

const source = path => readFileSync(join(process.cwd(), path), 'utf8');

const blueprint = curve => ({
    id: 'blueprint-1', title: 'A reading', intent: 'custom',
    sources: [{ id: 's1', name: 'S', providerId: 'local', type: 'text/plain', data: 'Still water.' }],
    wpm: 200, paceV2: true, chunkMode: 'word', curve,
    displayMode: 'focal', soundscape: 'none', audioPreset: 'silent',
    visualConfig: { visualMode: 'off' }
});

describe('one list of pace profiles', () => {
    it('is what the Reader Setup offers, no more and no fewer', () => {
        expect(Object.keys(CURVE_OPTIONS)).toEqual([...PACE_CURVE_IDS]);
    });

    it('is what the Workshop can draw', () => {
        expect(Object.keys(CURVE_PATHS)).toEqual([...PACE_CURVE_IDS]);
    });

    it('is what a saved Workshop project keeps, and an unknown one is not kept', () => {
        for (const id of PACE_CURVE_IDS) {
            expect(workshopProjectToSessionConfig(blueprint(id)).curve, id).toBe(id);
        }
        expect(workshopProjectToSessionConfig(blueprint('sigh')).curve).toBe('flat');
    });

    it('is what the compiler plays', () => {
        for (const id of PACE_CURVE_IDS) {
            const session = compileSession({ title: 'T', text: 'Still water lay under the moon.', curve: id });
            expect(session.curve, id).toBe(id);
        }
    });

    it('is what the settings a reader keeps are checked against', () => {
        expect(source('src/app.js')).toContain('new Set(PACE_CURVE_IDS)');
    });

    it('contains every profile Jev may choose, which is a smaller contract with the Worker', () => {
        const listed = source('src/app/jev-reading.js')
            .match(/const CURVES = new Set\(\[([^\]]*)\]\)/u);
        expect(listed, 'jev-reading.js no longer lists its curves where this test looks').not.toBeNull();
        const jev = [...listed[1].matchAll(/'([a-z]+)'/gu)].map(match => match[1]);
        expect(jev.length).toBeGreaterThan(0);
        for (const id of jev) expect(PACE_CURVE_IDS, id).toContain(id);
    });
});
