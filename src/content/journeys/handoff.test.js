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

describe('the opening field', () => {
    it('turns the cortex on, in gallery, at the first movement\'s cue', async () => {
        // A cue can swap a field; it cannot turn one on. Without this
        // the Chamber began with visuals off and every cue the
        // controller sent landed on a disabled cortex — the movement
        // changed, the pool changed, and the reader saw nothing.
        const handoff = await createJourneyHandoff(WAR_JOURNEY, WAR_PASSAGES);
        const visual = handoff.config.visualConfig;

        expect(visual.visualMode).toBe('interlocution');
        // Gallery: a persistent field behind the reading, not a flash
        // between phrases. A Journey's imagery accompanies its whole
        // movement.
        expect(visual.interlocution.presentation).toBe('continuous');
        // War opens on Milton, whose accompaniment is procedural.
        expect(visual.interlocution.procedural).toEqual(['paradise-lost']);
        expect(visual.interlocution.sourced).toEqual([]);
    }, 240000);
});

describe('Book VI is read figure by figure', () => {
    /**
     * The point of the whole mechanism: an engine appears where the poem
     * puts the thing it draws. These assertions are about MILTON, not
     * about arithmetic — they check that the compiled range contains the
     * line it was authored for and excludes the ones it was not.
     */
    const MILTON = 'pass-paradise-lost-war-heaven';

    async function figures() {
        const handoff = await createJourneyHandoff(WAR_JOURNEY, WAR_PASSAGES);
        const passage = handoff.config.sources.find(s => s.id === MILTON);
        const lines = passage.data.split(/\r?\n/);
        const total = lines.reduce((n, l) => n + l.split(/\s+/).filter(Boolean).length, 0);
        // Where a given printed line falls, as a fraction of the passage.
        const progressOfLine = (line) => {
            let words = 0;
            for (let i = 0; i < line && i < lines.length; i += 1) {
                words += lines[i].split(/\s+/).filter(Boolean).length;
            }
            return words / total;
        };
        const segments = handoff.config.visualProgram.segments
            .filter(s => s.id.startsWith(`${MILTON}-figure-`));
        const byName = new Map(segments.map(s =>
            [s.id.replace(`${MILTON}-figure-`, ''), s]));
        return { byName, progressOfLine, lines, segments };
    }

    it('puts each engine where the poem puts the thing it draws', async () => {
        const { byName, progressOfLine, lines } = await figures();
        const expected = [
            // figure, engine, a line that must be inside it, the phrase there
            ['michaels-sword', 'flaming_sword', 251, /sword of Michael smote/],
            ['the-invention', 'sulfur_magma', 513, /sulphurous and nitrous/],
            ['the-chariot', 'chariot_deity', 751, /chariot of Paternal Deity/],
            ['the-expulsion', 'fall_hypercube', 865, /Headlong themselves they threw/],
            ['nine-days-falling', 'dark_ocean_chaos', 872, /Nine days they fell/]
        ];
        for (const [name, engine, line, phrase] of expected) {
            const segment = byName.get(name);
            expect(segment, `no figure ${name}`).toBeTruthy();
            expect(segment.cue.engines).toEqual([engine]);
            // The line really does say what the figure claims it says.
            expect(lines[line], `line ${line}`).toMatch(phrase);
            const at = progressOfLine(line);
            expect(at, `${name} excludes its own line`)
                .toBeGreaterThanOrEqual(segment.match.fromProgress);
            expect(at).toBeLessThan(segment.match.toProgress);
        }
    }, 240000);

    it('does not let a figure spill onto the wrong event', async () => {
        const { byName, progressOfLine } = await figures();
        // The chariot must be gone before Chaos, and the sword must not
        // still be running at the invention.
        expect(progressOfLine(872))
            .toBeGreaterThanOrEqual(byName.get('the-chariot').match.toProgress);
        expect(progressOfLine(513))
            .toBeGreaterThanOrEqual(byName.get('michaels-sword').match.toProgress);
    }, 240000);

    it('leaves the five unwritten figures as gaps, not as wrong engines', async () => {
        // Milton's Book VI wants ten figures and five engines exist. The
        // opening — heaven in order before the breach — is the largest
        // of them, and it must fall through to the movement's own cue
        // rather than borrowing the chariot or the sword.
        const { byName, segments, progressOfLine } = await figures();
        expect(segments).toHaveLength(5);
        for (const gap of ['heaven-in-order', 'the-hosts-meet', 'the-rebel-night',
            'the-cannonade', 'the-hills-uptorn']) {
            expect(byName.has(gap), `${gap} should not be a segment`).toBe(false);
        }
        // Nothing claims the opening.
        const opening = progressOfLine(20);
        for (const segment of segments) {
            expect(opening < segment.match.fromProgress
                || opening >= segment.match.toProgress).toBe(true);
        }
    }, 240000);

    it('every named engine exists in the family it belongs to', async () => {
        // A figure naming an engine nothing provides would go still at
        // exactly the moment it should be loudest.
        const { PARADISE_LOST_ENGINES } = await import('../../visuals/paradise_lost/index.js');
        const available = new Set(PARADISE_LOST_ENGINES.map(e => e.id));
        const { segments } = await figures();
        for (const segment of segments) {
            for (const engine of segment.cue.engines) {
                expect(available.has(engine), `unknown engine ${engine}`).toBe(true);
            }
        }
    }, 240000);
});
