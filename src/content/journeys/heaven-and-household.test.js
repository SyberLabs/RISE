import { describe, expect, it } from 'vitest';
import { HEAVEN_HOUSEHOLD_JOURNEY, HEAVEN_HOUSEHOLD_PASSAGES, HEAVEN_HOUSEHOLD_CHECKSUMS } from './heaven-and-household.js';
import { resolveJourneyPassages, verifyPassageChecksums } from './passages.js';
import { createJourneyHandoff } from './handoff.js';
import { compileJourney } from '../../core/journey-compiler.js';
import { compileSession } from '../../core/session-compiler.js';

describe('Heaven and Household editorial draft', () => {
    it('binds every excerpt to the actual archive bytes and pinned checksums', async () => {
        const { resolved, failures } = await resolveJourneyPassages(HEAVEN_HOUSEHOLD_PASSAGES);
        expect(failures).toEqual([]);
        expect(resolved.map(p => p.workId)).toEqual(['paradise-lost', 'the-iliad']);
        expect(Object.keys(HEAVEN_HOUSEHOLD_CHECKSUMS).sort()).toEqual(resolved.map(p => p.id).sort());
        expect(verifyPassageChecksums(resolved, HEAVEN_HOUSEHOLD_CHECKSUMS).intact).toBe(true);
        expect(resolved.map(p => p.provenance.editionId)).toEqual([
            'standard-ebooks:john-milton/paradise-lost',
            'standard-ebooks:homer/the-iliad_william-cullen-bryant'
        ]);
        expect(resolved.map(p => p.provenance.sourceRevision)).toEqual([
            'sha256:e1f747c0f0e2d1b13433f6b2f51c9be28e53fe496c0ebb11904b8ef0c26c467e',
            'sha256:0695d06ded3af9669b8f314f1ae76e8186b1d67e81b6a726992a8c5ed88cf143'
        ]);
        expect(resolved.map(p => p.edition)).toEqual([
            'Standard Ebooks, 1667', 'Standard Ebooks, 1870'
        ]);
        expect(resolved[1].provenance.translator).toBe('William Cullen Bryant');
        for (const [index, passage] of resolved.entries()) {
            expect(passage.excerpted).toBe(true);
            expect(passage.excerptNote).toBeTruthy();
            expect(passage.provenance).toBeTruthy();
            expect(passage.checksum).toBe(HEAVEN_HOUSEHOLD_CHECKSUMS[passage.id]);
            expect(passage.text.startsWith(HEAVEN_HOUSEHOLD_PASSAGES[index].excerpt.from)).toBe(true);
            expect(passage.text.endsWith(HEAVEN_HOUSEHOLD_PASSAGES[index].excerpt.to)).toBe(true);
        }
    });

    it('compiles both movements without dropping either source', () => {
        const { movementProgram } = compileJourney(HEAVEN_HOUSEHOLD_JOURNEY);
        expect(movementProgram.movements.flatMap(m => m.sourceIds))
            .toEqual(HEAVEN_HOUSEHOLD_PASSAGES.map(p => p.id));
    });

    it('refuses launch until the editorial draft is approved', async () => {
        await expect(createJourneyHandoff(HEAVEN_HOUSEHOLD_JOURNEY, HEAVEN_HOUSEHOLD_PASSAGES))
            .rejects.toMatchObject({ code: 'JOURNEY_NOT_PUBLISHABLE' });
    });

    it('preserves the movement boundary through handoff and session compilation', async () => {
        // Test-only approved projection exercises assembly while the real
        // manifest remains draft and unlaunchable.
        const handoff = await createJourneyHandoff({
            ...HEAVEN_HOUSEHOLD_JOURNEY,
            status: 'publishable'
        }, HEAVEN_HOUSEHOLD_PASSAGES, { checksums: HEAVEN_HOUSEHOLD_CHECKSUMS });

        expect(handoff.config.sourceBoundaries).toEqual([expect.objectContaining({
            id: 'heaven-household-to-hector',
            kind: 'movement',
            afterSourceId: 'heaven-household-milton-fall',
            beforeSourceId: 'heaven-household-bryant-hector',
            durationMs: 4200
        })]);

        const session = compileSession({ name: 'Heaven and Household draft', ...handoff.config });
        const boundary = session.atoms.find(atom => atom.tags?.includes('authored-boundary'));
        expect(boundary).toMatchObject({
            sourceId: 'journey-boundary:heaven-household-to-hector',
            duration: 4200
        });
    });

    it('refuses handoff when a pinned source checksum has drifted', async () => {
        await expect(createJourneyHandoff({
            ...HEAVEN_HOUSEHOLD_JOURNEY,
            status: 'publishable'
        }, HEAVEN_HOUSEHOLD_PASSAGES, {
            checksums: {
                ...HEAVEN_HOUSEHOLD_CHECKSUMS,
                'heaven-household-bryant-hector': 'f'.repeat(64)
            }
        })).rejects.toMatchObject({ code: 'JOURNEY_PASSAGE_DRIFT' });
    });
});
