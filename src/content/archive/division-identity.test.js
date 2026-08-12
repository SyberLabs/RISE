/**
 * Per-division identity — ARCHIVE-CLEANSING-SPEC §1b, the guard named as
 * `identity.test.js`'s successor in its own exemption list.
 *
 * `identity.test.js` asks whether a WORK names itself, and a reading is served
 * at the DIVISION. The Mahabharata answered that question seventeen thousand
 * times while five of its volumes were a 1915 war periodical. This asks it
 * where the reading is served:
 *
 *   > No division may be devoid of the vocabulary its own work is dense in.
 *
 * WHY AN ARTIFACT RATHER THAN A LIVE SWEEP. Measuring this needs every payload
 * tokenised — 16.3 million words. `identity.test.js` already pays 22s to load
 * them once, and a second full pass would put the unit suite past four minutes
 * for a corpus that changes on acquisition days only. So it is derived offline
 * by `scripts/audit-division-identity.mjs`, committed, and asserted here — the
 * same shape as `division-index.json`, for the same reason.
 *
 * The coverage check is the half that matters most: a work added to the shelf
 * without re-running the audit fails here rather than passing unexamined.
 */
import { describe, expect, it } from 'vitest';
import REPORT from './division-identity.json';
import { INGESTED_META } from './index.js';

describe('no division is devoid of its own work’s vocabulary', () => {
    it('reports no violation anywhere on the shelf', () => {
        // Named individually rather than counted: a violation is a division
        // serving a different book, and the id is the whole of the news.
        expect(REPORT.violations.map(entry => `${entry.work} · ${entry.division} (${entry.words}w)`))
            .toEqual([]);
    });

    it('measures a division long enough for zero to mean something', () => {
        // Swept across the corpus: 107 divisions score zero at 400 words and
        // none at 5,000. Below that floor the instrument would refuse
        // Epictetus for being aphoristic.
        expect(REPORT.minDivisionWords).toBe(5_000);
    });

    it('covers every shelved work, so an acquisition cannot arrive unexamined', () => {
        const shelved = INGESTED_META.map(meta => meta.id).sort();
        const audited = Object.keys(REPORT.works).sort();
        const missing = shelved.filter(id => !REPORT.works[id]);
        expect(missing, 'run scripts/audit-division-identity.mjs --write').toEqual([]);
        expect(audited.length).toBeGreaterThanOrEqual(shelved.length);
    });

    it('says which works it cannot speak for, rather than passing them quietly', () => {
        // A work whose vocabulary is not distinctive against the rest of the
        // shelf — Tao Te Ching, Blake, Dickinson — has nothing for this measure
        // to hold on to. Recording them is the honest form of the limitation:
        // eight of ninety-one are unchecked, and that is visible rather than
        // implied by a silent pass.
        const uncheckable = Object.entries(REPORT.works)
            .filter(([, entry]) => !entry.checkable)
            .map(([id]) => id);
        expect(uncheckable).toEqual([
            'kandinsky-spiritual-in-art',
            'literary-essays-emerson',
            'literary-poems-blake',
            'literary-poems-dickinson',
            'paradise-lost',
            'sacred-emerald-tablet',
            'sacred-rumi',
            'sacred-tao-te-ching'
        ]);
    });
});
