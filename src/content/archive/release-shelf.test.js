/**
 * WHAT A PUBLIC BUILD ACTUALLY SERVES.
 *
 * The shelf was empty in production and full in development, and every test
 * agreed with development because every test runs there: vitest sets DEV, and
 * `scripts/playwright-global-setup.mjs` sets VITE_RISE_ARCHIVE_REVIEW=1 before
 * building the candidate the browser suite drives. So `library-divisions.spec`
 * asserted fifteen cards under Received and passed, against a configuration no
 * reader is ever given.
 *
 * These assert the RELEASE configuration explicitly — `{ DEV: false }`, no
 * review variable — which is the only place the defect was visible.
 */
import { describe, expect, it } from 'vitest';
import {
    archiveReviewEnabled,
    releaseArchiveMetadata,
    releaseArchiveTexts,
    uncertifiedCount,
    RELEASE_SERVES_UNCERTIFIED
} from './index.js';
import { CERTIFIED_IDS, isArchiveEditionCertified } from './certification.js';

describe('the shelf a reader is actually given', () => {
    it('is not empty in a public build', () => {
        // The defect, stated as the thing it did: a reader opening the Library
        // met "No texts in this category" while the tests met fifteen works.
        expect(archiveReviewEnabled({ DEV: false })).toBe(false);
        expect(releaseArchiveTexts().length,
            'a public build serves an empty shelf').toBeGreaterThan(0);
        expect(releaseArchiveMetadata().length).toBe(releaseArchiveTexts().length);
    });

    it('serves candidates only because that is a stated decision', () => {
        // Not an accident of environment. When this flips, the gate closes
        // behind the certifications with nothing else to change — and this
        // test then requires that they exist.
        if (RELEASE_SERVES_UNCERTIFIED) {
            expect(uncertifiedCount()).toBeGreaterThan(0);
        } else {
            expect(CERTIFIED_IDS.size,
                'the gate is closed and nothing is certified').toBeGreaterThan(0);
            for (const meta of releaseArchiveMetadata()) {
                expect(isArchiveEditionCertified(meta), `${meta.id} is uncertified`).toBe(true);
            }
        }
    });

    it('counts the uncertified against what it serves, not against the canon', () => {
        // The shelf prints this number. It must describe the works a reader can
        // open, or it is a claim about a list they cannot see.
        expect(uncertifiedCount()).toBeLessThanOrEqual(releaseArchiveMetadata().length);
    });
});
