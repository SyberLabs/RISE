import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LEGACY_REINGESTED_WORKS } from './legacy-catalog.js';
import { LIBRARY_TEXTS } from '../library.js';

const ROOT = resolve(import.meta.dirname, '../../..');
const report = JSON.parse(readFileSync(
    resolve(ROOT, 'docs/ingest-records/SOL-LEGACY-CLASSICS-AUDIT-2026-07-30.json'),
    'utf8'
));

const REPLACED_IDS = new Set([
    'sacred-i-ching',
    'sacred-zen-koans',
    'extended-bhagavad-gita-full',
    'sacred-emerald-tablet',
    'extended-dhammapada-full',
    'sacred-rumi',
    'sacred-corpus-hermeticum',
    'literary-letters-young-poet',
    'literary-thus-spoke-zarathustra',
    'literary-walden',
    'literary-leaves-of-grass',
    'literary-poems-dickinson',
    'literary-meditations',
    'literary-poems-blake',
    'literary-essays-emerson',
    'sacred-yoga-sutras',
    'sacred-tao-te-ching'
]);

describe('the legacy-classics replacement pass', () => {
    it('accounts for the complete 18-record review cohort', () => {
        expect(report.cohortCount).toBe(18);
        expect(report.acquiredClassics).toBe(17);
        expect(report.replacements).toHaveLength(17);
        expect(report.failures).toEqual([]);
        expect(new Set(report.replacements.map(item => item.id))).toEqual(REPLACED_IDS);
        expect(report.retainedComposition).toMatchObject({
            id: 'starter-the-descent',
            status: 'original-composition'
        });
    });

    it('publishes only the exact, checksummed replacement editions', () => {
        expect(LEGACY_REINGESTED_WORKS).toHaveLength(17);
        for (const work of LEGACY_REINGESTED_WORKS) {
            expect(work.meta.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
            expect(work.meta.payloadChecksum).toMatch(/^[0-9a-f]{64}$/);
            const registered = LIBRARY_TEXTS.filter(text => text.id === work.meta.id);
            expect(registered, `${work.meta.id} is not atomically replaced`).toHaveLength(1);
            expect(registered[0].provider).toBe('archive-ingest');
        }
    });

    it('serves Legge and Arnold rather than the audited modernized openings', () => {
        const tao = LEGACY_REINGESTED_WORKS.find(work => work.meta.id === 'sacred-tao-te-ching');
        const gita = LEGACY_REINGESTED_WORKS.find(work => work.meta.id === 'extended-bhagavad-gita-full');
        expect(tao.meta.edition.translator).toBe('James Legge');
        expect(gita.meta.edition.translator).toBe('Sir Edwin Arnold');
        expect(report.replacements.find(item => item.id === tao.meta.id).verdict)
            .not.toBe('matches-named-edition');
        expect(report.replacements.find(item => item.id === gita.meta.id).verdict)
            .not.toBe('matches-named-edition');
    });

    it('does not revive Norton under a public-domain claim', async () => {
        const letters = LEGACY_REINGESTED_WORKS.find(
            work => work.meta.id === 'literary-letters-young-poet'
        );
        expect(letters.meta.edition.language).toBe('German');
        expect(letters.meta.edition.translator).toBeUndefined();
        const sections = await letters.load();
        expect(sections.map(section => section.content).join('\n'))
            .not.toMatch(/M\.?\s*D\.?\s*Herter Norton/i);
    });

    it('keeps the Descent as an attributed RISE composition', () => {
        const descent = LIBRARY_TEXTS.find(text => text.id === 'starter-the-descent');
        expect(descent).toMatchObject({
            author: 'RISE Core',
            provider: 'starters',
            category: 'composed'
        });
    });
});
