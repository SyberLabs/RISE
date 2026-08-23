/**
 * THE MANIFEST IS THE CONTRACT BETWEEN THE TWO PLANES, and this is the
 * whole of what crosses it.
 *
 * This replaces reachable-payloads.test.js, whose subject no longer exists.
 * That test guarded a correspondence between a catalogue and a bundler's
 * behaviour: every entry carried `load: () => import(...)`, Rollup could
 * not prove the runtime filter would drop the withheld ones, and so it
 * emitted a chunk for all ninety-five — a fifteen-megabyte Mahabharata no
 * reader could open, built and deployed on every push. The test asserted
 * that a shelved work had a loader and a withheld work did not.
 *
 * There are no loaders now. Nothing about a work is built, so no filter can
 * fail to be applied at build time, and the defect that test was written
 * against cannot occur. Deleting a test because its defect became
 * impossible is the strongest available fix.
 *
 * What still needs guarding is the manifest itself, in both directions,
 * because either half failing is silent: a shelved work with no address is
 * a book that will not open, and a withheld work with no reason is a
 * withholding that does not say why — which the Archive's own norm forbids.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { CONTENT_MANIFEST_SCHEMA } from '../../../scripts/lib/content-plane.mjs';
import { WITHHELD_WORKS, ingestedArchiveTexts } from './index.js';

const PUBLIC = resolve(process.cwd(), 'public');
const manifest = JSON.parse(
    readFileSync(resolve(PUBLIC, 'content/manifest.json'), 'utf8')
);

const shelved = manifest.works.filter(work => work.shelved);
const withheld = manifest.works.filter(work => !work.shelved);

describe('the content manifest', () => {
    it('declares its schema and a revision', () => {
        expect(manifest.schema).toBe(CONTENT_MANIFEST_SCHEMA);
        expect(manifest.revision).toMatch(/^[0-9a-f]{16}$/);
    });

    it('names every work the shelf serves, and no other, as shelved', () => {
        const served = ingestedArchiveTexts().map(text => text.id).sort();
        expect(shelved.map(work => work.id).sort()).toEqual(served);
    });

    it('gives every shelved work an address', () => {
        expect(shelved.length).toBeGreaterThan(0);
        for (const work of shelved) {
            expect(work.sha256, `${work.id} has no digest`).toMatch(/^[0-9a-f]{64}$/);
            expect(work.url, `${work.id} is not addressed by its digest`)
                .toBe(`/content/works/${work.sha256}.json`);
            expect(work.bytes, `${work.id} claims no bytes`).toBeGreaterThan(0);
        }
    });

    /**
     * The address IS the digest, so this is the property the reader's
     * browser re-checks on every arrival. If it does not hold on disk it
     * cannot hold over the wire, and every reading would refuse.
     */
    it('publishes objects whose bytes hash to the address they are published at', () => {
        for (const work of shelved) {
            const bytes = readFileSync(resolve(PUBLIC, work.url.replace(/^\//, '')));
            expect(bytes.length, `${work.id} is the wrong size`).toBe(work.bytes);
            expect(createHash('sha256').update(bytes).digest('hex'),
                `${work.id} does not hash to its own URL`).toBe(work.sha256);
        }
    });

    it('publishes readable sections, not an opaque blob', () => {
        for (const work of shelved) {
            const sections = JSON.parse(
                readFileSync(resolve(PUBLIC, work.url.replace(/^\//, '')), 'utf8')
            );
            expect(Array.isArray(sections), `${work.id} is not an array`).toBe(true);
            expect(sections.length, `${work.id} carries no sections`).toBeGreaterThan(0);
            for (const section of sections) {
                expect(typeof section.content, `${work.id} has a section without content`)
                    .toBe('string');
            }
        }
    });

    it('carries every withheld work, with its stated reason and no address', () => {
        expect(withheld.length).toBeGreaterThan(50);
        expect(withheld.map(work => work.id).sort())
            .toEqual(Object.keys(WITHHELD_WORKS).sort());
        for (const work of withheld) {
            expect(work.withheldReason, `${work.id} is withheld without a reason`)
                .toBeTruthy();
            expect(work.url, `${work.id} is withheld and still addressed`).toBeUndefined();
        }
    });

    it('keeps the ingest payload checksum, which certification binds to', () => {
        for (const work of shelved) {
            expect(work.payloadChecksum, `${work.id} lost its ingest checksum`)
                .toMatch(/^[0-9a-f]{64}$/);
        }
    });
});
