/**
 * Named wrong-work regressions.
 *
 * ARCHIVE-CLEANSING-SPEC §1b. These are gates because each one is a
 * MEASURED fact about a named work, not a heuristic applied to the
 * shelf. The heuristic exists too — `scripts/audit-division-identity.mjs`
 * — and is deliberately a report rather than a test, because the
 * distributions overlap: Don Quixote's interpolated novel and Le Morte
 * d'Arthur's glossary both score lower than the intruder did. No
 * threshold separates them, so a gate there would either miss the
 * intruder or condemn Cervantes.
 *
 * What CAN be gated is the specific thing that was found and fixed.
 */
import { describe, it, expect } from 'vitest';

/**
 * Vocabulary that cannot occur in a 19th-century Sanskrit translation.
 *
 * "submarine" was in this list and had to come out: Ganguli uses it in
 * its older sense of *underwater* — "Jayadratha its (submarine) rock" —
 * three times over. A detector that reads shape rather than meaning is
 * the fault this whole pass keeps finding, and writing one into the test
 * that guards against it would have been a poor joke.
 *
 * What remains cannot be said in 1883: a Kaiser's Reichstag, a Zeppelin,
 * Petrograd (renamed 1914), Kipling as a subject, a machine-gun.
 */
const ANACHRONISM = /\b(Kaiser|Zeppelin|Reichstag|Petrograd|Kipling|machine-gun)\b/;

describe('the Mahābhārata is the Mahābhārata', () => {
    it('carries no division of the First World War', async () => {
        // Five "volumes" of it were the New York Times Current History of
        // the European War (1915): the ingest declared nine Gutenberg
        // artifacts as "Ganguli volume N" and assumed a contiguous
        // identifier range. Ganguli occupies #15474–#15477.
        const mod = await import('./works/the-mahabharata-of-krishna-dwaipayana-vyasa.js');
        const sections = Object.values(mod).find(v => Array.isArray(v) && v[0]?.content);

        const foreign = sections.filter(s => ANACHRONISM.test(String(s.content || '')));
        expect(foreign.map(s => s.name), 'a division names the Great War').toEqual([]);
        // And the work that remains is still the work.
        expect(sections.length).toBeGreaterThan(1800);
    }, 120_000);

    it('claims only the artifacts that are actually it', async () => {
        // A payload trimmed without its dossier following is a book
        // presented under a name that no longer describes it — the
        // Hamlet failure from the other direction.
        const mod = await import('./works/the-mahabharata-of-krishna-dwaipayana-vyasa.js');
        const meta = Object.values(mod).find(v => v && v.id && v.source);

        const kept = meta.source.artifacts.map(a => a.canonicalUrl);
        expect(kept, 'four Gutenberg records are Ganguli').toHaveLength(4);
        for (const id of [15478, 15479, 15480, 15481, 15482]) {
            expect(kept.some(u => String(u).endsWith(String(id))),
                `#${id} is still claimed as this work`).toBe(false);
        }

        // The withdrawal is recorded rather than silent, and its record
        // does not repeat the assertion that caused the fault.
        expect(meta.source.withdrawn, 'the withdrawal is recorded').toHaveLength(5);
        for (const a of meta.source.withdrawn) {
            expect(a.label).not.toMatch(/Ganguli volume/);
            expect(a.reason.length).toBeGreaterThan(80);
        }

        // And the rights evidence no longer claims nine records.
        expect(meta.rights.evidence).not.toMatch(/\bnine\b/i);
        expect(meta.rights.evidence).toMatch(/Four Gutenberg records/);
    }, 120_000);
});
