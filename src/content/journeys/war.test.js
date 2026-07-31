/**
 * War — the first authored Journey, checked against the Archive it cites.
 *
 * The assertions worth having are about the EDITORIAL LAW, not the data
 * shape. A Journey needs an argument rather than a topic (§1.1); its
 * sources must not become equivalent (§1.3); a passage may cite only a
 * division that stands alone (§1.4). Those are the things that make it
 * a Journey rather than a playlist, and they are the things a schema
 * check cannot see.
 */
import { describe, expect, it } from 'vitest';
import { WAR_JOURNEY, WAR_PASSAGES, WAR_BOUND_MOVEMENTS } from './war.js';
import { resolveJourneyPassages, entriesForDivision } from './passages.js';
import { compileJourney, cueForSource, JourneyCompileError } from '../../core/journey-compiler.js';
import { readJourneySegments } from '../atrium/journey-segments.js';

describe('the manifest states an argument, not a topic', () => {
    it('names a thesis, a transformation, and a terminal condition', () => {
        expect(WAR_JOURNEY.thesis).toMatch(/descends/);
        expect(WAR_JOURNEY.transformation).toBeTruthy();
        expect(WAR_JOURNEY.terminalCondition).toMatch(/No synthesis/);
    });

    it('gives every movement a function and a counterpressure', () => {
        // §1.3: a source must resist the thesis rather than illustrate
        // it. A movement with no counterpressure is an illustration.
        for (const movement of WAR_JOURNEY.movements) {
            expect(movement.function, `${movement.id} has no function`).toBeTruthy();
            expect(movement.counterpressure, `${movement.id} has no counterpressure`).toBeTruthy();
            expect(movement.counterpressure.length).toBeGreaterThan(40);
        }
    });

    it('changes the active world at every movement', () => {
        // §1.2: a movement is not a chapter heading over continuous
        // playback. Distinct imagery pools and distinct soundscapes are
        // the machine-checkable part of that.
        const pools = WAR_JOURNEY.movements.map(m => m.presentation.visual.collections?.join());
        const scapes = WAR_JOURNEY.movements.map(m => m.presentation.audio.soundscapeId);
        expect(new Set(pools).size).toBe(WAR_JOURNEY.movements.length);
        expect(new Set(scapes).size).toBe(WAR_JOURNEY.movements.length);
    });

    it('scores a boundary between every adjacent movement', () => {
        for (const movement of WAR_JOURNEY.movements) {
            expect(movement.transitionOut, `${movement.id} has no boundary`).toBeTruthy();
            expect(movement.transitionOut.durationMs).toBeGreaterThan(0);
        }
    });
});

describe('all three movements are bound', () => {
    it('publishes, and declares what is still outstanding', () => {
        // Blocked for one day, on the reading that Junger's unnumbered
        // chapters were not citable. True about ordinals, false about
        // the book: he titles them, and the edition prints the titles in
        // its own contents.
        expect(WAR_JOURNEY.status).toBe('publishable');

        // This asserted an EMPTY list, and that was a falsehood the
        // suite was holding in place: all three soundscapes are
        // uncomposed and War reads in silence. Nothing said so, so
        // nothing found it. A Journey may ship with a layer missing —
        // the reading is whole and the imagery is scored — but it must
        // say which.
        expect(WAR_JOURNEY.openRequirements.length).toBe(3);
        for (const id of ['war-ordered-field', 'war-mortal-pulse', 'war-pressure-field']) {
            expect(WAR_JOURNEY.openRequirements.join(' ')).toContain(id);
        }
    });

    it('keeps the descent whole — three movements, not two', () => {
        // The argument's shape IS the descent into machinery. A version
        // that stops at Hector says something else.
        expect(WAR_JOURNEY.movements.map(m => m.id))
            .toEqual(['war-heaven', 'war-hero', 'war-steel']);
        for (const movement of WAR_JOURNEY.movements) {
            expect(movement.segments.length, `${movement.id} is unbound`).toBeGreaterThan(0);
        }
    });

    it('compiles whole', () => {
        expect(() => compileJourney(WAR_JOURNEY)).not.toThrow();
    });

    it('depicts only the movement that has a body to depict', () => {
        // The first two movements are accompanied by works someone made
        // ABOUT war. The third cannot be: a photograph of the Somme is
        // evidence of the thing Junger says stopped being perceptible,
        // and hanging it beside him settles retrospectively what the
        // chapter refuses to settle.
        // Two procedural movements, for MIRRORED reasons, with the one
        // depicted movement between them. Milton's combatants cannot
        // die, so there are no bodies yet; Junger's have been effaced,
        // so there are none left. Homer is the only movement where a
        // person can be seen — which is the descent, made visible in
        // how each movement is shown.
        const kinds = Object.fromEntries(
            WAR_JOURNEY.movements.map(m => [m.id, m.presentation.visual.kind]));
        expect(kinds).toEqual({
            'war-heaven': 'procedural',
            'war-hero': 'sourced',
            'war-steel': 'procedural'
        });
    });

    it('compiles the bound movements for rehearsal', () => {
        const { movementProgram, visualProgram, audioProgram } =
            compileJourney({ ...WAR_JOURNEY, movements: WAR_BOUND_MOVEMENTS });

        expect(movementProgram.movements.map(m => m.id))
            .toEqual(['war-heaven', 'war-hero', 'war-steel']);
        expect(cueForSource(visualProgram, 'pass-paradise-lost-war-heaven'))
            .toMatchObject({ kind: 'procedural', collections: ['paradise-lost'] });
        expect(cueForSource(visualProgram, 'pass-iliad-hector-household'))
            .toMatchObject({ kind: 'sourced', collections: ['atr-attic-vases'] });
        expect(cueForSource(audioProgram, 'pass-iliad-hector-death'))
            .toMatchObject({ kind: 'soundscape', soundscapeId: 'war-mortal-pulse' });
        // Hector's two passages are one movement, not two.
        expect(movementProgram.movements[1].sourceIds).toEqual([
            'pass-iliad-hector-household', 'pass-iliad-hector-death'
        ]);
    });
});

describe('every bound passage resolves against the Archive', () => {
    it('finds real text for each locator', async () => {
        const bound = WAR_PASSAGES.filter(p =>
            readJourneySegments({ movements: WAR_BOUND_MOVEMENTS })
                .some(s => s.passageId === p.id));

        const { resolved, failures, ready } = await resolveJourneyPassages(bound);
        expect(failures, JSON.stringify(failures)).toEqual([]);
        expect(ready).toBe(true);
        expect(resolved).toHaveLength(4);

        for (const passage of resolved) {
            expect(passage.words, `${passage.id} is empty`).toBeGreaterThan(500);
            expect(passage.checksum).toMatch(/^[0-9a-f]{64}$/);
            // §1.3: the edition and translator travel with the passage.
            expect(passage.edition, `${passage.id} has no edition`).toBeTruthy();
            expect(passage.title).toBeTruthy();
        }
    }, 180000);

    it('reads Milton\'s war in heaven, not a neighbouring book', async () => {
        const { resolved } = await resolveJourneyPassages(
            [WAR_PASSAGES.find(p => p.id === 'pass-paradise-lost-war-heaven')]);
        const text = resolved[0].text.toLowerCase();
        // Book VI is Raphael's account of the third day.
        expect(text).toContain('book vi');
        expect(resolved[0].words).toBeGreaterThan(4000);
    }, 180000);

    it('keeps a split division whole', async () => {
        // The Iliad's books are long enough that the divider offers some
        // as "Book VI (1/2)" and "(2/2)". A passage citing "Book VI"
        // means the book, not half of it.
        const entries = [
            { label: 'Book VI (1/2)', content: 'a', words: 1 },
            { label: 'Book VI (2/2)', content: 'b', words: 1 },
            { label: 'Book VII', content: 'c', words: 1 }
        ];
        expect(entriesForDivision(entries, 'Book VI')).toHaveLength(2);
        expect(entriesForDivision(entries, 'Book VII')).toHaveLength(1);
    });

    it('refuses a division the work does not have', async () => {
        const { failures, ready } = await resolveJourneyPassages([
            { id: 'pass-bogus', workId: 'paradise-lost', division: 'Book XCIX' }
        ]);
        expect(ready).toBe(false);
        expect(failures[0].code).toBe('DIVISION_NOT_FOUND');
    }, 120000);
});

describe('the sources do not become equivalent', () => {
    it('keeps each passage\'s own edition and role', async () => {
        // §1.3: "The Journey may create a relation. It may not erase the
        // differences that make the relation meaningful."
        const { resolved } = await resolveJourneyPassages(WAR_PASSAGES);
        const editions = new Set(resolved.map(p => p.edition));
        expect(editions.size).toBeGreaterThan(1);
        expect(resolved.map(p => p.role))
            .toEqual(['proposition', 'context', 'critique', 'transmission']);
    }, 180000);
});
