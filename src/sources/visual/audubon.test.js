import { describe, expect, it } from 'vitest';
import {
    AUDUBON_CORPORA,
    AudubonHydrationService,
    hydrateAudubonRecord
} from './audubon.js';

const makeRecord = (corpus, plate, overrides = {}) => ({
    id: `audubon:${corpus}:${plate}`,
    corpus,
    plate,
    title: `${corpus} ${plate}`,
    caption: `Plate ${plate}`,
    artist: 'John James Audubon',
    contributors: '',
    date: corpus === AUDUBON_CORPORA.BIRDS ? '1830' : '1846',
    medium: 'Hand-colored print',
    rights: 'PUBLIC_DOMAIN',
    rightsUri: corpus === AUDUBON_CORPORA.BIRDS
        ? 'http://rightsstatements.org/vocab/NoC-US/1.0/'
        : 'https://creativecommons.org/publicdomain/mark/1.0/',
    imageService: corpus === AUDUBON_CORPORA.BIRDS
        ? `https://cdm16998.contentdm.oclc.org/iiif/2/birds:${plate}`
        : `https://quod.lib.umich.edu/cgi/i/image/api/image/quadrupeds:${plate}`,
    width: 6000,
    height: 4000,
    sourceName: 'Institution',
    sourceUrl: corpus === AUDUBON_CORPORA.BIRDS
        ? `https://digital.cincinnatilibrary.org/item/${plate}`
        : `https://quod.lib.umich.edu/item/${plate}`,
    ...overrides
});

describe('Audubon hydration service', () => {
    it('ships an exact, gapless canonical folio catalog', () => {
        const service = new AudubonHydrationService();
        const stats = service.getStats();

        expect(stats.total).toBe(585);
        expect(stats.corpora).toEqual({
            [AUDUBON_CORPORA.BIRDS]: 435,
            [AUDUBON_CORPORA.QUADRUPEDS]: 150
        });

        for (const [corpus, count] of Object.entries(stats.corpora)) {
            const plates = service.getPool()
                .filter(work => work.corpus === corpus)
                .map(work => work.plate);
            expect(plates).toEqual(Array.from({ length: count }, (_, i) => i + 1));
        }
    });

    it('hydrates responsive IIIF URLs without exposing full master images', () => {
        const work = hydrateAudubonRecord(makeRecord(AUDUBON_CORPORA.BIRDS, 1), {
            displayWidth: 1400,
            detailWidth: 2800
        });

        expect(work.url.endsWith('/full/1400,/0/default.jpg')).toBe(true);
        expect(work.fullUrl.endsWith('/full/2800,/0/default.jpg')).toBe(true);
        expect(work.width).toBe(6000);
        expect(work.height).toBe(4000);
    });

    it('withholds rights-silent, foreign-host, and undersized records', () => {
        expect(hydrateAudubonRecord(makeRecord(
            AUDUBON_CORPORA.BIRDS, 1, { rights: 'UNKNOWN' }
        ))).toBeNull();
        expect(hydrateAudubonRecord(makeRecord(
            AUDUBON_CORPORA.BIRDS, 1, { rightsUri: '' }
        ))).toBeNull();
        expect(hydrateAudubonRecord(makeRecord(
            AUDUBON_CORPORA.BIRDS, 1, {
                imageService: 'https://example.com/not-an-institutional-image'
            }
        ))).toBeNull();
        expect(hydrateAudubonRecord(makeRecord(
            AUDUBON_CORPORA.BIRDS, 1, { width: 800, height: 600 }
        ))).toBeNull();
    });

    it('draws eleven birds and nine mammals in every twenty-work schedule', () => {
        const records = [
            ...Array.from({ length: 12 }, (_, i) =>
                makeRecord(AUDUBON_CORPORA.BIRDS, i + 1)),
            ...Array.from({ length: 10 }, (_, i) =>
                makeRecord(AUDUBON_CORPORA.QUADRUPEDS, i + 1))
        ];
        const service = new AudubonHydrationService({
            catalog: records,
            expectedCounts: null,
            random: () => 0.25
        });
        const draws = Array.from({ length: 20 }, () => service.draw());

        expect(draws.filter(work => work.corpus === AUDUBON_CORPORA.BIRDS)).toHaveLength(11);
        expect(draws.filter(work => work.corpus === AUDUBON_CORPORA.QUADRUPEDS)).toHaveLength(9);
    });

    it('does not repeat a work before its own corpus deck is exhausted', () => {
        const records = [
            ...Array.from({ length: 4 }, (_, i) =>
                makeRecord(AUDUBON_CORPORA.BIRDS, i + 1)),
            ...Array.from({ length: 4 }, (_, i) =>
                makeRecord(AUDUBON_CORPORA.QUADRUPEDS, i + 1))
        ];
        const service = new AudubonHydrationService({
            catalog: records,
            expectedCounts: null,
            random: () => 0.5
        });
        const perCorpus = new Map([
            [AUDUBON_CORPORA.BIRDS, []],
            [AUDUBON_CORPORA.QUADRUPEDS, []]
        ]);

        while ([...perCorpus.values()].some(works => works.length < 4)) {
            const work = service.draw();
            const corpusWorks = perCorpus.get(work.corpus);
            if (corpusWorks.length < 4) corpusWorks.push(work.id);
        }

        expect(new Set(perCorpus.get(AUDUBON_CORPORA.BIRDS))).toHaveProperty('size', 4);
        expect(new Set(perCorpus.get(AUDUBON_CORPORA.QUADRUPEDS))).toHaveProperty('size', 4);
    });
});
