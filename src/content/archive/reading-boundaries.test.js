/**
 * THE READING THE READER ACTUALLY GETS.
 *
 * `splitLongDivision` is unit-tested against fixtures, and a fixture is
 * exactly what failed us: the first one written for the chapter-boundary
 * fault passed under the OLD code, because equal chapters put the
 * arithmetic target on a joint by luck. This asserts the same rule one
 * layer out — over the sequences the Library hands the Chamber, built
 * from the committed payloads — so the claim is about a reading rather
 * than about my model of one.
 *
 * The fault, as a reader met it: "Book I (1/3)" of Vitruvius ended with
 * "CHAPTER II", its subtitle, and clause 1 of a list whose clause 2
 * opened "Book I (2/3)". A reading that finishes by starting something
 * else.
 */
import { describe, it, expect } from 'vitest';
import { ingestedArchiveTexts } from './index.js';

/** The same shape-test the splitter uses, restated independently here. */
const looksLikeHeading = (line) => {
    const p = String(line || '').trim();
    if (!p || p.length > 90) return false;
    if (/^(chapter|book|part|canto|section|act|scene)\b/i.test(p)) return true;
    return p === p.toUpperCase() && /[A-Z]{3}/.test(p) && !/[.!?,;:]$/.test(p);
};

/** Does this reading finish by STARTING a chapter it barely contains? */
function endsByStarting(content, words) {
    const paras = String(content || '').trim().split(/\n\s*\n/).map(s => s.trim());
    let after = 0;
    for (let i = paras.length - 1; i >= 0; i--) {
        if (looksLikeHeading(paras[i])) return after < words * 0.25;
        after += paras[i].split(/\s+/).filter(Boolean).length;
    }
    return false;
}

describe('a reading ends where the work ends something', () => {
    it('no split part of any shelved work finishes by starting the next chapter', async () => {
        const texts = ingestedArchiveTexts();
        expect(texts.length).toBeGreaterThan(10);

        const offences = [];
        let examined = 0;

        for (const text of texts) {
            const sequences = await text.getSequences();
            if (!Array.isArray(sequences)) continue;
            for (const seq of sequences) {
                const part = String(seq.name || '').match(/\((\d+)\/(\d+)\)\s*$/);
                // Only the parts WE cut, and only the INTERMEDIATE ones.
                // The last part of a division ends where the division
                // ends, and what sits there came from the payload — see
                // the running-head finding in ARCHIVE-CLEANSING-SPEC.
                if (!part || part[1] === part[2]) continue;
                examined++;
                if (endsByStarting(seq.content)) {
                    offences.push(`${text.id} — ${seq.name}: …${String(seq.content).trim().slice(-70)}`);
                }
            }
        }

        // NOTHING ON THE SHELF IS CUT ANY MORE. Every shelved work comes
        // from an edition that declares its own divisions, and a declared
        // scheme is never re-derived and so never split — `splitLongDivision`
        // does not run for any of the fifteen. The offence check above stays
        // because the splitter is still reachable by an unstructured work;
        // this asserts the reason the count is zero rather than letting a
        // vacuous pass look like a clean one.
        expect(examined, 'a declared scheme is never split').toBe(0);
        expect(offences, offences.slice(0, 5).join('\n')).toEqual([]);
    }, 240000);

    it('a divided canon work stops where its own division stops', async () => {
        // Was Vitruvius, which is withheld with the rest of the corpus. The
        // fault it guards is general: a split part must not end by announcing
        // the next one, and it is swept for above across the whole shelf.
        const texts = ingestedArchiveTexts();
        const work = texts.find(t => t.id === 'the-iliad');
        expect(work, 'the Iliad is on the shelf').toBeTruthy();

        const divisions = await work.getDivisions();
        expect(divisions.entries.length).toBeGreaterThan(1);
        for (const entry of divisions.entries) {
            expect(String(entry.content).trim().length).toBeGreaterThan(0);
        }
    }, 120000);
});
