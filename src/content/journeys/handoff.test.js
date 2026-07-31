/**
 * The Journey → Chamber boundary.
 *
 * This is the seam where an authored argument becomes a reading, and
 * the assertions that matter are the refusals. A Journey missing a step
 * is not a shorter Journey; it is a different one, and every way of
 * quietly shipping one anyway is guarded here.
 */
import { describe, expect, it } from 'vitest';
import { createJourneyHandoff, journeyIntroduction, JourneyHandoffError } from './handoff.js';
import { WAR_JOURNEY, WAR_PASSAGES } from './war.js';
import { resolveJourneyPassages } from './passages.js';
import { compileSession } from '../../core/session-compiler.js';
import { boundarySourceId } from '../../core/journey-compiler.js';

describe('War assembles for launch', () => {
    it('resolves every passage and hands over one payload', async () => {
        const handoff = await createJourneyHandoff(WAR_JOURNEY, WAR_PASSAGES);

        expect(handoff.source).toBe('Journey · War');
        expect(handoff.config.sources).toHaveLength(4);
        expect(handoff.text.length).toBeGreaterThan(50_000);

        // The three programs travel as launch identity.
        expect(handoff.config.movementProgram.movements.map(m => m.id))
            .toEqual(['war-heaven', 'war-hero', 'war-steel']);
        expect(handoff.config.visualProgram.coordinateSpace).toBe('source');
        expect(handoff.config.audioProgram.coordinateSpace).toBe('source');
    }, 240000);

    it('locates each boundary between the passages that actually meet', async () => {
        // The compiler knows a transition joins two MOVEMENTS; only the
        // handoff knows which two SOURCES end up adjacent. Hector's
        // movement holds two passages, so the boundary after it must
        // name the second one, not the first.
        const handoff = await createJourneyHandoff(WAR_JOURNEY, WAR_PASSAGES);
        const boundaries = handoff.config.sourceBoundaries;

        // Three, not two: §3.1 requires a boundary between every
        // adjacent PASSAGE, and Hector's two books are adjacent inside
        // one movement.
        expect(boundaries.map(b => b.id)).toEqual([
            'war-heaven-to-hero', 'hector-gate-to-death', 'war-hero-to-steel'
        ]);
        expect(boundaries[0]).toMatchObject({
            kind: 'movement',
            afterSourceId: 'pass-paradise-lost-war-heaven',
            beforeSourceId: 'pass-iliad-hector-household'
        });
        // A passage boundary INSIDE a movement, and the longest of the
        // three — sixteen books pass between the gate and the dust.
        expect(boundaries[1]).toMatchObject({
            kind: 'passage',
            afterSourceId: 'pass-iliad-hector-household',
            beforeSourceId: 'pass-iliad-hector-death'
        });
        expect(boundaries[1].durationMs).toBeGreaterThan(boundaries[0].durationMs);
        expect(boundaries[2]).toMatchObject({
            kind: 'movement',
            afterSourceId: 'pass-iliad-hector-death',
            beforeSourceId: 'pass-storm-of-steel-guillemont'
        });
    }, 240000);

    it('drops the coda, which joins nothing', async () => {
        // A transition after the final movement is a scored ending. It
        // stays in the movement program for reporting and has no atom,
        // because there is no break for it to replace.
        const handoff = await createJourneyHandoff(WAR_JOURNEY, WAR_PASSAGES);
        expect(handoff.config.movementProgram.boundaries.map(b => b.id))
            .toContain('war-coda');
        expect(handoff.config.sourceBoundaries.map(b => b.id)).not.toContain('war-coda');
    }, 240000);

    it('compiles into a session whose transitions land in the right places', async () => {
        const handoff = await createJourneyHandoff(WAR_JOURNEY, WAR_PASSAGES);
        const session = compileSession({ name: 'War', ...handoff.config });

        const authored = session.atoms.filter(a => a.tags?.includes('authored-boundary'));
        expect(authored).toHaveLength(3);
        expect(authored[0].sourceId).toBe(boundarySourceId('war-heaven-to-hero'));
        expect(authored[0].duration).toBe(1600);

        // Each boundary sits between the two worlds it separates.
        for (const boundary of authored) {
            const i = session.atoms.indexOf(boundary);
            expect(session.atoms[i - 1].sourceId).not.toBe(session.atoms[i + 1].sourceId);
        }
        // And no generic break survives between authored movements.
        const generic = session.atoms.filter(a =>
            a.tags?.includes('source-break') && !a.tags.includes('authored-boundary'));
        expect(generic).toHaveLength(0);
    }, 240000);

    it('keeps every work distinct in its provenance', async () => {
        // §1.3: the Journey creates a relation; it may not erase the
        // differences that make the relation meaningful.
        const handoff = await createJourneyHandoff(WAR_JOURNEY, WAR_PASSAGES);
        const editions = handoff.config.sources.map(s => s.provenance.edition);
        expect(new Set(editions).size).toBeGreaterThan(1);
        for (const source of handoff.config.sources) {
            expect(source.provenance.checksum).toMatch(/^[0-9a-f]{64}$/);
            expect(source.provenance.segmentRole).toBeTruthy();
            expect(source.provenance.workTitle).toBeTruthy();
        }
    }, 240000);

    it('carries the author\'s pace rather than a reader\'s last setting', async () => {
        // §3.3: opening the generic Session controls does not rewrite a
        // published Journey.
        const handoff = await createJourneyHandoff(WAR_JOURNEY, WAR_PASSAGES);
        expect(handoff.config.recitation.enabled).toBe(true);
        expect(handoff.config.voiceId).toBe('am_michael');
        expect(handoff.config.curve).toBe('flat');
    }, 240000);
});

describe('it refuses rather than shipping a partial argument', () => {
    it('refuses a Journey that says it is not publishable', async () => {
        // Otherwise `status` is decorative, and the honest blocking we
        // did for a day would have meant nothing.
        await expect(createJourneyHandoff(
            { ...WAR_JOURNEY, status: 'blocked' }, WAR_PASSAGES
        )).rejects.toThrow(/not publishable/);
    });

    it('refuses when a named passage has no record', async () => {
        const thin = WAR_PASSAGES.filter(p => p.id !== 'pass-iliad-hector-death');
        await expect(createJourneyHandoff(WAR_JOURNEY, thin))
            .rejects.toThrow(/No passage record/);
    });

    it('refuses when a passage will not resolve', async () => {
        const broken = WAR_PASSAGES.map(p => p.id === 'pass-iliad-hector-death'
            ? { ...p, division: 'Book XCIX' } : p);
        await expect(createJourneyHandoff(WAR_JOURNEY, broken))
            .rejects.toThrow(JourneyHandoffError);
    }, 240000);

    it('refuses when the text has moved under the argument', async () => {
        // A Journey whose sources changed is not a Journey with slightly
        // different words.
        await expect(createJourneyHandoff(WAR_JOURNEY, WAR_PASSAGES, {
            checksums: { 'pass-paradise-lost-war-heaven': 'f'.repeat(64) }
        })).rejects.toThrow(/no longer matches/);
    }, 240000);

    it('refuses a manifest that will not compile', async () => {
        const hollow = {
            ...WAR_JOURNEY,
            movements: WAR_JOURNEY.movements.map(m =>
                m.id === 'war-steel' ? { ...m, segments: [] } : m)
        };
        await expect(createJourneyHandoff(hollow, WAR_PASSAGES))
            .rejects.toThrow(/names no passages/);
    });
});

describe('the introduction is derived, never authored twice', () => {
    it('states the argument, the movements, and the editions', async () => {
        const { resolved } = await resolveJourneyPassages(WAR_PASSAGES);
        const intro = journeyIntroduction(WAR_JOURNEY, resolved);

        expect(intro.title).toBe('War');
        expect(intro.thesis).toMatch(/descends/);
        expect(intro.terminalCondition).toMatch(/No synthesis/);
        expect(intro.movements.map(m => m.id))
            .toEqual(['war-heaven', 'war-hero', 'war-steel']);
        // Every movement states what resists it (§1.3).
        for (const movement of intro.movements) {
            expect(movement.counterpressure).toBeTruthy();
        }
        // Credits are the editions — what a reader is actually shown.
        expect(intro.credits.length).toBeGreaterThan(1);
        expect(intro.credits.join(' ')).toMatch(/trans\./);
    }, 240000);

    it('estimates from the real text rather than from a guess', async () => {
        const { resolved } = await resolveJourneyPassages(WAR_PASSAGES);
        const intro = journeyIntroduction(WAR_JOURNEY, resolved);
        const words = resolved.reduce((n, p) => n + p.words, 0);
        expect(intro.estimatedMinutes).toBe(Math.round(words / 200));
        // The manifest's own guess was 24; the text is longer than that.
        expect(intro.estimatedMinutes).toBeGreaterThan(24);
    }, 240000);

    it('falls back to the authored estimate when nothing is resolved', () => {
        const intro = journeyIntroduction(WAR_JOURNEY, []);
        expect(intro.estimatedMinutes).toBe(24);
    });
});
