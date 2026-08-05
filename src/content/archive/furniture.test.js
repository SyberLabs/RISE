/**
 * The guard that keeps the shelf clean after the pass ends
 * (ARCHIVE-CLEANSING-SPEC §6.7).
 *
 * A cleanse is worth little on its own — the next ingest would put the
 * furniture straight back. This asserts the property rather than the
 * event: no shelved payload carries a running head that POSITION proves
 * is furniture.
 *
 * It deliberately does NOT assert that no running head exists at all.
 * The ambiguous ones — where the sentence had ended, which is also the
 * shape of a real chapter title — are left in place on purpose and go to
 * a reviewer. A test that demanded their removal would be demanding a
 * judgement no rule here can make.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { stemsOf, furnitureIn, isStrictlyFurniture, RUNNING_HEAD,
         illustrationStubsIn, isIllustrationStub } from './furniture.js';

const WORKS_DIR = resolve('src/content/archive/works');

describe('page furniture', () => {
    it('no shelved payload carries a provable running head', async () => {
        const files = readdirSync(WORKS_DIR)
            .filter(n => n.endsWith('.js') && !n.includes('.test.'));
        expect(files.length).toBeGreaterThan(50);

        const offences = [];
        for (const file of files) {
            const mod = await import(pathToFileURL(resolve(WORKS_DIR, file)).href);
            const sections = Object.values(mod).find(v => Array.isArray(v) && v[0]?.content);
            if (!sections) continue;
            const stems = stemsOf(sections);
            for (const section of sections) {
                for (const f of furnitureIn(String(section.content || ''), stems)) {
                    if (!f.proven) continue;
                    offences.push(`${file.replace(/\.js$/, '')} / ${section.name}: ${JSON.stringify(f.text)}`);
                }
            }
        }
        expect(offences, offences.slice(0, 8).join('\n')).toEqual([]);
    }, 300_000);

    it('recognises the running head that started this', () => {
        // The guard is only worth having if it can fire. Jünger's page
        // 93, as it stood in the payload before the cleanse.
        const content = [
            'One could see that the man had been',
            '',
            '92 ',
            '',
            '',
            'GUILLEMONT 93 ',
            '',
            '',
            'through horror to the limit of despair and there had learnt'
        ].join('\n');
        const stems = new Map([['GUILLEMONT', 8]]);
        const found = furnitureIn(content, stems);

        expect(found).toHaveLength(1);
        expect(found[0].proven, 'position proves it').toBe(true);
        expect(found[0].text).toBe('92\nGUILLEMONT 93');
        // …and the sentence rejoins rather than keeping the break.
        expect(found[0].rejoin).toBe(' ');
        expect(isStrictlyFurniture(content.slice(found[0].start, found[0].end))).toBe(true);

        const healed = content.slice(0, found[0].start) + found[0].rejoin + content.slice(found[0].end);
        expect(healed).toBe('One could see that the man had been through horror to the limit of despair and there had learnt');
    });

    it('removes a bare illustration stub but never one that carries a caption', () => {
        // "[Illustration]" alone marks a plate this edition does not
        // have; rendered, the reader is shown those characters, which is
        // a broken frame written in words.
        const bare = 'He went out.\n\n[Illustration]\n\nThe road was empty.';
        const stubs = illustrationStubsIn(bare);
        expect(stubs).toHaveLength(1);
        expect(isIllustrationStub(bare.slice(stubs[0].start, stubs[0].end))).toBe(true);
        expect(bare.slice(0, stubs[0].start) + stubs[0].rejoin + bare.slice(stubs[0].end))
            .toBe('He went out.\n\nThe road was empty.');

        // A caption OUTSIDE the bracket must stop it. Removing the marker
        // would strand an all-capital line between two paragraphs, which
        // the compositor then reads as a title — R11's fault arriving by
        // another door.
        expect(illustrationStubsIn('He went out.\n\n[Illustration] BUTTERFLY DANCE\n\nThe road was empty.'))
            .toHaveLength(0);
        // And a caption INSIDE it carries content.
        expect(illustrationStubsIn('He went out.\n\n[Illustration: “I’m the tallest”]\n\nThe road.'))
            .toHaveLength(0);
    });

    it('every payload still terminates its SECTIONS array', () => {
        // The cleanser rewrites that array in place, and the first
        // version dropped the semicolon — "\n];" is three characters and
        // JSON.stringify ends at the bracket. Automatic semicolon
        // insertion made the result valid JavaScript, so every test
        // passed and five payloads were quietly edited in a way nobody
        // asked for. A rewriter that can reach the file's syntax needs a
        // check on the file's syntax.
        const files = readdirSync(WORKS_DIR)
            .filter(n => n.endsWith('.js') && !n.includes('.test.'));
        const bad = [];
        for (const file of files) {
            const src = readFileSync(resolve(WORKS_DIR, file), 'utf8');
            const meta = src.indexOf('_META');
            if (meta < 0) continue;
            if (!/\n\];\s*\n/.test(src.slice(0, meta))) bad.push(file);
        }
        expect(bad, bad.join(', ')).toEqual([]);
    });

    it('refuses a stem that is not a word', () => {
        // Hamlet's "I  2" and the Shahnama's "V, 82" met the class when
        // the stem could be spaces and a comma, and the strict-deletion
        // gate refused both works whole. Refusing was right; being asked
        // was the defect.
        expect(RUNNING_HEAD.test('I  2')).toBe(false);
        expect(RUNNING_HEAD.test('V, 82')).toBe(false);
        expect(RUNNING_HEAD.test('GUILLEMONT 93')).toBe(true);
        expect(RUNNING_HEAD.test('THE GREAT OFFENSIVE 273')).toBe(true);
    });

    it('leaves a chapter opening alone, however much it looks like one', () => {
        // "BOOK 1" between a title page and "ADI PARVA" is the
        // Mahabharata's structure. Nothing here may take it.
        const content = 'Krishna-Dwaipayana Vyasa\n\nBOOK 1\n\nADI PARVA\n\nTranslated into English Prose';
        const found = furnitureIn(content, new Map([['BOOK', 18]]));
        expect(found.every(f => !f.proven), 'a division heading is never provable furniture').toBe(true);
    });
});
