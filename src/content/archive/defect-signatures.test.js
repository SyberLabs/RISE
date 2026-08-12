/**
 * The registry is only useful if it is swept — ARCHIVE-CLEANSING-SPEC §3d.
 *
 * A signature added but never run is a note, not a guard. This asserts the
 * committed report answers for every signature currently declared, so adding
 * one to `defect-signatures.js` without re-running the audit fails here.
 */
import { describe, expect, it } from 'vitest';
import REPORT from './defect-report.json';
import { DEFECT_SIGNATURES, scanLine } from './defect-signatures.js';

describe('every known defect stays looked-for', () => {
    it('sweeps every signature that has been declared', () => {
        const declared = DEFECT_SIGNATURES.map(signature => signature.id).sort();
        const swept = REPORT.signatures.map(entry => entry.id).sort();
        expect(swept, 'run scripts/audit-defect-signatures.mjs --write').toEqual(declared);
    });

    it('keeps the variorum tripwire at zero', () => {
        // The fault that withdrew three Shakespeares. It finds nothing today,
        // which is exactly why it is kept: the next acquisition is what it is
        // for, and a guard only retained while it fires is not a guard.
        const sigla = REPORT.signatures.find(entry => entry.id === 'variorum-sigla');
        expect(sigla.lines).toBe(0);
    });

    it('records where each signature was learned', () => {
        // Provenance is what separates a lesson from a guess: a later reader
        // can open the work that taught it and see the thing itself.
        for (const signature of DEFECT_SIGNATURES) {
            expect(signature.discoveredIn, signature.id).toBeTruthy();
            expect(signature.discoveredOn, signature.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(['withdraw', 'trim', 'review']).toContain(signature.disposition);
        }
    });

    it('matches a line against the defect that taught it, and spares clean prose', () => {
        expect(scanLine('spine.jpg (152K)'))
            .toEqual(expect.arrayContaining(['transcriber-image-file', 'file-size-annotation']));
        expect(scanLine('Digitized  by  Google')).toContain('scan-provider-header');
        expect(scanLine('Zwar f&uuml;hlen viele junge Menschen')).toContain('html-entity');
        expect(scanLine('Happy families are all alike; every unhappy family')).toEqual([]);
    });
});
