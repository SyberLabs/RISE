import { describe, expect, it } from 'vitest';
import { EARTH_AND_SKY, LANDSCAPES, LANDSCAPE_COLLECTIONS, REVIEW } from './landscape-pins.js';
import decisions from './landscape-decisions.2026-10-26.json';
import sheet from './sheet-2026-10-26.json';
import catalog from '../../sources/visual/landscapes-catalog.generated.json';

const SET_OF = { landscapes: LANDSCAPES, 'earth-and-sky': EARTH_AND_SKY };
const cutByOwner = new Set(Object.entries(decisions).filter(([, d]) => d.decision === 'cut').map(([id]) => id));

describe('the pins are the owner’s decisions, exactly', () => {
    it('records only cuts, every one on the reviewed sheet', () => {
        expect(Object.values(decisions).every(d => d.decision === 'cut')).toBe(true);
        expect(cutByOwner.size).toBe(125);
        const onSheet = new Set(sheet.works.map(w => w.id));
        for (const id of cutByOwner) expect(onSheet.has(id), id).toBe(true);
    });

    it('cuts what the owner cut and keeps every other work of the sheet, set by set', () => {
        for (const [set, collection] of Object.entries(SET_OF)) {
            const works = sheet.works.filter(w => w.set === set).map(w => w.id);
            expect([...collection.cut].sort(), set).toEqual(works.filter(id => cutByOwner.has(id)).sort());
            expect([...collection.kept].sort(), set).toEqual(works.filter(id => !cutByOwner.has(id)).sort());
        }
        expect([LANDSCAPES.kept.length, LANDSCAPES.cut.length]).toEqual([68, 112]);
        expect([EARTH_AND_SKY.kept.length, EARTH_AND_SKY.cut.length]).toEqual([65, 13]);
    });

    it('names each work once, and the owner’s three favourites among the kept', () => {
        const all = Object.values(LANDSCAPE_COLLECTIONS).flatMap(c => [...c.kept, ...c.cut]);
        expect(new Set(all).size).toBe(all.length);
        expect(LANDSCAPES.favourites).toEqual(['cleveland:144967', 'cleveland:84371']);
        expect(EARTH_AND_SKY.favourites).toEqual(['nasa:GSFC_20171208_Archive_e002131']);
        for (const collection of Object.values(LANDSCAPE_COLLECTIONS)) {
            for (const id of collection.favourites) expect(collection.kept, id).toContain(id);
        }
        expect(REVIEW).toMatchObject({ by: 'owner, by eye', date: '2026-10-26' });
    });
});

describe('the catalog is the pins’ result', () => {
    it('holds every kept work and no cut one, each in its own collection', () => {
        for (const [id, collection] of Object.entries(LANDSCAPE_COLLECTIONS)) {
            expect(catalog.collections[id].works).toEqual([...collection.kept]);
            expect(catalog.collections[id].favourites).toEqual([...collection.favourites]);
        }
        const ids = catalog.works.map(w => w.id);
        expect(ids).toHaveLength(133);
        for (const id of cutByOwner) expect(ids, id).not.toContain(id);
        expect(catalog.works.filter(w => w.favourite).map(w => w.id).sort())
            .toEqual(['cleveland:144967', 'cleveland:84371', 'nasa:GSFC_20171208_Archive_e002131']);
    });

    it('keeps the rights the harvest read and the credit the owner reviewed', () => {
        expect(catalog.rightsVerifiedAt).toBe(sheet.rightsVerifiedAt);
        const reviewed = new Map(sheet.works.map(w => [w.id, w]));
        for (const work of catalog.works) {
            const was = reviewed.get(work.id);
            expect([work.licence, work.requiredCredit, work.image], work.id).toEqual([was.licence, was.requiredCredit, was.image]);
            expect(work.image, work.id).toMatch(/^https:\/\//u);
            if (work.licence !== 'open') expect(work.requiredCredit, work.id).toBeTruthy();
        }
    });
});
