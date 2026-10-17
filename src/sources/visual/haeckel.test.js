/**
 * Haeckel's Kunstformen der Natur: one pinned public-domain plate per
 * Tafel, 1 to 100, from the Commons files the build script resolved.
 */
import { describe, expect, it } from 'vitest';
import catalog from './haeckel-catalog.generated.json';

describe('the Haeckel plate catalog', () => {
    it('holds the hundred plates once each, in order', () => {
        expect(catalog.plates.map(plate => plate.plate))
            .toEqual(Array.from({ length: 100 }, (_, index) => index + 1));
        expect(new Set(catalog.plates.map(plate => plate.file)).size).toBe(100);
    });

    it('serves every plate from upload.wikimedia.org, public domain, with its credit', () => {
        for (const plate of catalog.plates) {
            for (const url of [plate.image, plate.original]) {
                expect(new URL(url).hostname, `${plate.plate} ${url}`).toBe('upload.wikimedia.org');
                expect(new URL(url).protocol).toBe('https:');
            }
            expect(plate.licence, `${plate.plate}`).toBe('Public domain');
            expect(plate.pdOld, `${plate.plate}`).toBe(true);
            expect(plate.sha1).toMatch(/^[0-9a-f]{40}$/u);
            expect(plate.width).toBeGreaterThan(0);
            expect(plate.height).toBeGreaterThan(0);
            expect(plate.title).toMatch(/^[A-Z][a-z]+$/u);
            expect(plate.attribution).toBe(
                `Ernst Haeckel, Kunstformen der Natur, 1904, Tafel ${plate.plate}; public domain; Wikimedia Commons, ${plate.file}`
            );
        }
    });
});
