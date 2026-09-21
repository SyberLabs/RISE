import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HOUSE_PROGRAMS, houseProgram, programPath } from './index.js';
import { programSlugShape, PROGRAM_ROUTE_PREFIX } from '../../core/program-paths.js';
import { parseExperienceProgramJson } from '../../core/experience-program-io.js';

const assetPath = program => resolve(process.cwd(), 'public', program.asset.replace(/^\/+/u, ''));

describe('the sequences the house has minted', () => {
    it('mints at least one', () => {
        expect(HOUSE_PROGRAMS.length).toBeGreaterThan(0);
    });

    it('ships the file every slug names', () => {
        for (const program of HOUSE_PROGRAMS) {
            expect(existsSync(assetPath(program)), `${program.slug} has no asset`).toBe(true);
        }
    });

    it('passes each one through the same gate a paste goes through', () => {
        // A mint is a short URL, not a shortcut. If one of these cannot be
        // parsed the route would refuse it at runtime in front of a reader,
        // and a QR code printed on a card cannot be recalled.
        for (const program of HOUSE_PROGRAMS) {
            const parsed = parseExperienceProgramJson(readFileSync(assetPath(program), 'utf8'));
            expect(parsed.id, `${program.slug} parsed`).toBeTruthy();
        }
    });

    it('claims no authority a paste could not claim', () => {
        // `published` is what RISE's own Journeys claim. Being in the
        // repository earns a short URL; it does not earn that word, and a
        // second way to claim it is the laundering the io gate refuses.
        for (const program of HOUSE_PROGRAMS) {
            const raw = JSON.parse(readFileSync(assetPath(program), 'utf8'));
            expect(raw.authority, `${program.slug} authority`).not.toBe('published');
            const parsed = parseExperienceProgramJson(readFileSync(assetPath(program), 'utf8'));
            expect(parsed.authority).toBe('proposed');
        }
    });

    it('round-trips every slug through its own path', () => {
        for (const program of HOUSE_PROGRAMS) {
            expect(programSlugShape(programPath(program.slug))).toBe(program.slug);
            expect(houseProgram(program.slug)).toMatchObject({ slug: program.slug });
        }
    });
});

describe('the register is the allowlist', () => {
    it('answers nothing for a slug nobody minted', () => {
        // The SHAPE is fine — this is a mint URL. The register is what
        // refuses it, and the threshold says so rather than the reader
        // landing on the Portal wondering what their card was for.
        expect(programSlugShape('/p/not-a-real-mint')).toBe('not-a-real-mint');
        expect(houseProgram('not-a-real-mint')).toBeNull();
    });

    it('refuses a path that is trying to name a file', () => {
        // The route never builds a path out of what it was given — it looks
        // one up — so this is already impossible. Refused at the shape step
        // as well, while the thing is still a string.
        for (const hostile of [
            '/p/../../etc/passwd',
            '/p/..%2f..%2fsecrets',
            '/p/programs/the-uncarved-block.json',
            '/p/THE-UNCARVED-BLOCK',
            '/p/',
            '/p/a..b'
        ]) {
            expect(programSlugShape(hostile), hostile).toBeNull();
        }
    });

    it('survives a malformed escape rather than throwing into the boot path', () => {
        // decodeURIComponent throws on a lone %, and this runs while the
        // application is deciding where to open.
        expect(programSlugShape('/p/%E0%A4%A')).toBeNull();
    });

    it('answers nothing for paths that are not mints at all', () => {
        for (const other of ['/', '/try-rise', '/keystone/meditations', '/portal']) {
            expect(programSlugShape(other), other).toBeNull();
        }
        expect(PROGRAM_ROUTE_PREFIX).toBe('/p/');
    });
});
