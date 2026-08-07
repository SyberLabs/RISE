import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    assertDossier,
    parseLiteratureDossier
} from '../../../scripts/archive-dossier.mjs';
import { LITERATURE_WORKS } from './literature-catalog.js';

const ROOT = resolve(import.meta.dirname, '../../..');
const dossier = assertDossier(parseLiteratureDossier());
const report = JSON.parse(readFileSync(
    resolve(ROOT, 'docs/ingest-records/SOL-LITERATURE-INGEST-REPORT.json'),
    'utf8'
));

describe('the 66-work literature accession', () => {
    it('preserves the approved W42/E16/I08 decision set', () => {
        expect(dossier).toHaveLength(66);
        expect(dossier.filter(entry => entry.code.startsWith('W'))).toHaveLength(42);
        expect(dossier.filter(entry => entry.code.startsWith('E'))).toHaveLength(16);
        expect(dossier.filter(entry => entry.code.startsWith('I'))).toHaveLength(8);
    });

    it('registers every edition that cleared its release gate', () => {
        expect(report.dossierCount).toBe(66);
        expect(report.ingested).toHaveLength(58);
        expect(report.staged).toHaveLength(8);
        expect(report.blocked).toEqual([]);
        expect(LITERATURE_WORKS).toHaveLength(58);
    });

    it('includes Joyce and Jünger under exact edition provenance', () => {
        expect(report.ingested).toContain('W41');
        expect(report.ingested).toContain('W42');
        const junger = LITERATURE_WORKS.find(work => work.meta.id === 'the-storm-of-steel');
        expect(junger?.meta.edition.statement).toMatch(/Chatto & Windus, London, 1929/i);
    });

    it('keeps community-gated corpora out of the public registry', () => {
        const publicIds = new Set(LITERATURE_WORKS.map(work => work.meta.id));
        for (const entry of dossier.filter(item => item.code.startsWith('I'))) {
            expect(publicIds.has(entry.id), entry.code).toBe(false);
        }
    });
});
