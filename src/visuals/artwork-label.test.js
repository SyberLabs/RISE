import { describe, expect, it } from 'vitest';
import {
    applyArtworkLabelElement,
    artworkMayBeShown,
    creditProper,
    displayedArtworkLabel,
    LICENCE,
    licenceClassOf,
    normalizeArtworkLabel,
    plainArtworkText,
    shortLicenceName
} from './artwork-label.js';

describe('artwork label metadata boundary', () => {
    it('normalizes provider metadata and removes remote markup', () => {
        const label = normalizeArtworkLabel({
            name: 'File:Wild_Turkey.jpg',
            data: {
                title: 'Wild Turkey',
                artist: '<a href="/wiki/Audubon">John James &amp; John W. Audubon</a>',
                date: '1827',
                sourceName: 'Cincinnati Library',
                sourceUrl: 'https://example.org/work/1',
                rights: 'PUBLIC_DOMAIN'
            }
        });

        expect(label).toMatchObject({
            title: 'Wild Turkey',
            artist: 'John James & John W. Audubon',
            labelText: 'Wild Turkey · John James & John W. Audubon',
            creditRequired: false
        });
        expect(label.sourceUrl).toBe('https://example.org/work/1');
    });

    it('withholds optional labels when disabled', () => {
        const label = normalizeArtworkLabel({
            name: 'A Work',
            data: { artist: 'An Artist', rights: 'PUBLIC_DOMAIN' }
        });

        expect(displayedArtworkLabel(label, true)).toBe('A Work · An Artist');
        expect(displayedArtworkLabel(label, false)).toBe('');
    });

    it('never suppresses a legally required credit', () => {
        const label = normalizeArtworkLabel({
            name: 'Nebula',
            data: {
                artist: 'Observatory',
                license: 'CC BY 4.0',
                attribution: 'Nebula · Observatory · CC BY 4.0'
            }
        });

        expect(label.creditRequired).toBe(true);
        expect(displayedArtworkLabel(label, false))
            .toBe('Nebula · Observatory · CC BY 4.0');
    });

    it('rejects unsafe source links and decodes numeric entities', () => {
        const label = normalizeArtworkLabel({
            name: 'Study &#38; Variation',
            data: { sourceUrl: 'javascript:alert(1)' }
        });

        expect(label.title).toBe('Study & Variation');
        expect(label.sourceUrl).toBe('');
        expect(plainArtworkText('<b>one</b>&nbsp;two')).toBe('one two');
    });

    it('classifies long labels for compact typography and preserves full hover text', () => {
        const element = document.createElement('div');
        const long = 'A'.repeat(90);
        applyArtworkLabelElement(element, long, false);
        expect(element.dataset.labelLength).toBe('long');
        expect(element.dataset.creditRequired).toBe('false');
        expect(element.title).toBe(long);
        expect(element.hidden).toBe(false);

        applyArtworkLabelElement(element, 'B'.repeat(180), true);
        expect(element.dataset.labelLength).toBe('very-long');
        expect(element.dataset.creditRequired).toBe('true');

        applyArtworkLabelElement(element, '', false);
        expect(element.hidden).toBe(true);
        expect(element.hasAttribute('title')).toBe(false);
    });
});

describe('licence classes are kept apart', () => {
    // Open / CC0 owe no credit; withholding must ask which class.

    it('shows a CC0 work by an unknown artist', () => {
        const label = normalizeArtworkLabel({
            name: 'Woodcut of a hare', metadata: { rights: 'PUBLIC_DOMAIN' }
        });
        expect(label.licence).toBe(LICENCE.OPEN);
        expect(label.creditRequired).toBe(false);
        expect(artworkMayBeShown(label)).toBe(true);
        expect(displayedArtworkLabel(label, true)).toBe('Woodcut of a hare');
    });

    it('shows a CC0 work with no metadata whatever', () => {
        // Returns null — nothing to say and nothing owed — and a null
        // label has always meant "display the work without a chip".
        const label = normalizeArtworkLabel({ name: '', metadata: { rights: 'PUBLIC_DOMAIN' } });
        expect(label).toBeNull();
        expect(artworkMayBeShown(label)).toBe(true);
    });

    it('leaves an undeclared record displayable', () => {
        // Every provider that has never declared rights keeps working.
        // Tightening this default would be exactly the retroactive change
        // the separation exists to avoid.
        const label = normalizeArtworkLabel({ name: 'Untitled', metadata: {} });
        expect(label.licence).toBe(LICENCE.UNDECLARED);
        expect(artworkMayBeShown(label)).toBe(true);
    });

    it('reads the Art Institute record exactly as it arrives', () => {
        const label = normalizeArtworkLabel({
            name: 'The Bedroom',
            metadata: { artist: 'Vincent van Gogh', rights: 'PUBLIC_DOMAIN',
                sourceName: 'Art Institute of Chicago' }
        });
        expect(label.licence).toBe(LICENCE.OPEN);
        expect(displayedArtworkLabel(label, true)).toBe('The Bedroom · Vincent van Gogh');
        // …and the reader's preference still governs, because nothing is owed.
        expect(displayedArtworkLabel(label, false)).toBe('');
    });

    it('separates share-alike from plain attribution', () => {
        // Both require credit and they are not the same licence. Wildlife
        // imagery is a mixture, and a ledger that cannot tell them apart
        // cannot answer a question about derivatives later.
        expect(licenceClassOf({ metadata: { license: 'CC BY 4.0' } })).toBe(LICENCE.BY);
        expect(licenceClassOf({ metadata: { license: 'CC BY-SA 4.0' } })).toBe(LICENCE.BY_SA);
        expect(licenceClassOf({ metadata: { license: 'CC0 1.0' } })).toBe(LICENCE.OPEN);
        expect(licenceClassOf({ metadata: { rights: 'PUBLIC_DOMAIN' } })).toBe(LICENCE.OPEN);
        expect(licenceClassOf({ metadata: {} })).toBe(LICENCE.UNDECLARED);
    });
});

describe('a work that cannot be credited is not shown', () => {
    it('withholds a CC-BY work with nobody to name', () => {
        // SOURCE-EXPANSION-SPEC §3 ruled this in words; this is the rule
        // in code. Previously the normalizer returned null here and a
        // null label rendered nothing — so the image displayed bare.
        const label = normalizeArtworkLabel({ name: '', metadata: { license: 'CC BY 4.0' } });
        expect(label.creditRequired).toBe(true);
        expect(label.creditUnsatisfied).toBe(true);
        expect(artworkMayBeShown(label)).toBe(false);
    });

    it('withholds share-alike on the same terms', () => {
        const label = normalizeArtworkLabel({ name: '', metadata: { license: 'CC BY-SA 4.0' } });
        expect(artworkMayBeShown(label)).toBe(false);
    });

    it('a licence name alone is not a credit', () => {
        // "CC BY 4.0" is a non-empty string and credits nobody. The test
        // is on the NAMES, not on the composed text.
        const label = normalizeArtworkLabel({ name: '', metadata: { license: 'CC BY 4.0' } });
        expect(label.requiredText).toBe('CC BY 4.0');
        expect(label.creditUnsatisfied).toBe(true);
    });

    it('shows it the moment there is someone to name', () => {
        const label = normalizeArtworkLabel({
            name: '', metadata: { license: 'CC BY 4.0', artist: 'J. Lee' }
        });
        expect(artworkMayBeShown(label)).toBe(true);
        expect(displayedArtworkLabel(label, false)).toBe('J. Lee · CC BY 4.0');
    });
});

describe('the licence is identified concisely', () => {
    it('shortens the full legal title the feeds actually declare', () => {
        // All 120 CC-BY candidates arrived carrying this 54-character
        // string. §3(a)(1)(B) asks the licence be identified, and this is
        // the identification the deed itself uses.
        expect(shortLicenceName('Creative Commons Attribution 4.0 International License'))
            .toBe('CC BY 4.0');
    });

    it('matches share-alike BEFORE plain attribution', () => {
        // "Attribution-ShareAlike" CONTAINS "Attribution", so the looser
        // pattern would relabel a BY-SA work as BY — the precise
        // conflation LICENCE.BY_SA exists to prevent.
        expect(shortLicenceName('Creative Commons Attribution-ShareAlike 4.0 International License'))
            .toBe('CC BY-SA 4.0');
    });

    it('leaves an unrecognised declaration exactly as it arrived', () => {
        expect(shortLicenceName('Public domain (NASA) — acknowledgement required'))
            .toBe('Public domain (NASA) — acknowledgement required');
        expect(shortLicenceName('')).toBe('');
    });
});

describe('an appended roster is set aside for the Curia', () => {
    it('cuts at the acknowledgment marker, not at a length', () => {
        const { text, elided } = creditProper(
            'NASA, ESA and the Hubble Heritage Team (STScI/AURA). '
            + 'Acknowledgment: J. Gallagher (University of Wisconsin), M. Mountain (STScI).');
        expect(text).toBe('NASA, ESA and the Hubble Heritage Team (STScI/AURA)');
        expect(elided).toBe(true);
    });

    it('handles the marker with no space before it', () => {
        const { text } = creditProper(
            'ESA/Hubble & NASA, J. C. Tan (Chalmers University), '
            + 'R. Fedriani (Chalmers University)Acknowledgement: Judy Schmidt');
        expect(text).toBe('ESA/Hubble & NASA, J. C. Tan (Chalmers University), R. Fedriani (Chalmers University)');
    });

    it('cuts a run-on where the feed concatenated two fields', () => {
        // 723 characters of two observing teams, joined with no separator
        // at all: "…Westerlund 2 Science Team The original observations…"
        const { text, elided } = creditProper(
            'NASA, ESA, the Hubble Heritage Team (STScI/AURA), A. Nota (ESA/STScI), '
            + 'and the Westerlund 2 Science Team The original observations of Westerlund 2 '
            + 'were obtained by the science team: Antonella Nota (ESA/STScI), Elena Sabbi.');
        expect(text).toBe('NASA, ESA, the Hubble Heritage Team (STScI/AURA), '
            + 'A. Nota (ESA/STScI), and the Westerlund 2 Science Team');
        expect(elided).toBe(true);
    });

    // Marker-less name lists stay whole — no length fallback.
    it('leaves a long pure name list whole', () => {
        const names = 'NASA, ESA, Michael Wong (Space Telescope Science Institute, '
            + 'Baltimore, MD), H. B. Hammel (Space Science Institute, Boulder, CO) '
            + 'and the Jupiter Impact Team';
        const { text, elided } = creditProper(names);
        expect(text).toBe(names);
        expect(elided).toBe(false);
    });

    it('never shortens a marker-less credit, however long it runs', () => {
        // NO LENGTH FALLBACK, deliberately. §3(a)(1)(A) requires retaining
        // identification of everyone designated to receive attribution, so
        // shortening a name list is the legally risky operation and
        // dropping a section the provider itself labelled supplementary is
        // not. A chip one line too tall beats a credit naming half a
        // person.
        const names = Array.from({ length: 14 },
            (_, i) => `Alexandra Konstantinopoulos-${i} (Some Long Institution Name)`).join(', ');
        expect(names.length).toBeGreaterThan(700);
        expect(creditProper(names)).toEqual({ text: names, elided: false });
    });

    it('drops a field label the feed left on its own value', () => {
        // "Image:" names the field, not the creator.
        const { text } = creditProper(
            'Image: European Space Agency & NASA Acknowledgements: K.D. Kuntz (GSFC)');
        expect(text).toBe('European Space Agency & NASA');
    });

    it('does not claim an elision when it only tidied a full stop', () => {
        // "elided" promises the Curia holds more. Comparing before/after
        // strings conflated a trimmed period with a dropped roster, and
        // showed the reviewer a promise the record could not keep.
        expect(creditProper('NASA, ESA, A. Simon (GSFC) and the OPAL team.'))
            .toEqual({ text: 'NASA, ESA, A. Simon (GSFC) and the OPAL team', elided: false });
    });

    it('keeps the closing bracket that belongs to the last affiliation', () => {
        // A leading character class matched the ")" before the marker and
        // shipped "(STScI/AURA" as the credit — a bracket silently taken
        // off a name.
        const { text } = creditProper('NASA (STScI/AURA). Acknowledgment: someone else');
        expect(text).toBe('NASA (STScI/AURA)');
    });

    it('keeps the full credit reachable even when the chip elides', () => {
        const full = 'NASA, ESA and the Hubble Heritage Team (STScI/AURA). '
            + 'Acknowledgment: J. Gallagher (University of Wisconsin).';
        const label = normalizeArtworkLabel({
            name: 'Nebula', metadata: { license: 'CC BY 4.0', attribution: full }
        });
        expect(label.creditElided).toBe(true);
        expect(label.fullCredit).toBe(full);
        expect(displayedArtworkLabel(label, false))
            .toBe('NASA, ESA and the Hubble Heritage Team (STScI/AURA) · CC BY 4.0');
    });
});

describe('trimming does not reach the CC0 corpus', () => {
    // CC-BY rules must not change open-licence composition.

    it('leaves an open work with an acknowledgment section untouched', () => {
        const label = normalizeArtworkLabel({
            name: 'Trochilidae',
            metadata: {
                rights: 'CC0',
                attribution: 'Trochilidae · NMNH · Acknowledgment: a donor who owes nothing'
            }
        });
        expect(label.creditRequired).toBe(false);
        expect(label.creditElided).toBe(false);
        expect(displayedArtworkLabel(label, true)).toBe('Trochilidae');
    });

    it('leaves an open work with a very long title untouched', () => {
        // Under plainArtworkText's own 240-char title cap, which predates
        // all of this and is not what is being tested here.
        const long = 'A specimen sheet ' + 'x'.repeat(200);
        const label = normalizeArtworkLabel({ name: long, metadata: { rights: 'PUBLIC_DOMAIN' } });
        expect(label.labelText).toBe(long);
        expect(label.creditElided).toBe(false);
    });
});

describe('the licence is named as well as the creator', () => {
    it('appends the licence to a provider attribution string', () => {
        // This was `attribution || [...]` and the || short-circuited, so a
        // record that SUPPLIED an attribution never named its licence.
        // CC BY 4.0 §3(a)(1) wants both.
        const label = normalizeArtworkLabel({
            name: 'Pillars of Creation',
            metadata: { license: 'CC BY 4.0', attribution: 'ESA/Webb, NASA & CSA, J. Lee' }
        });
        expect(displayedArtworkLabel(label, false))
            .toBe('ESA/Webb, NASA & CSA, J. Lee · CC BY 4.0');
    });

    it('does not say it twice when the provider already did', () => {
        const label = normalizeArtworkLabel({
            name: 'Nebula',
            metadata: { license: 'CC BY 4.0', attribution: 'Observatory · CC BY 4.0' }
        });
        expect(displayedArtworkLabel(label, false)).toBe('Observatory · CC BY 4.0');
    });
});

describe('the guarantees are as strong as the words for them', () => {
    // Four claims this file makes were stronger than what it did. Each is
    // now a test rather than a sentence.

    it('holds the FULL credit, not five hundred characters of it', () => {
        // "The Curia carries the full record" is what makes the roster
        // elision permissible under CC BY 4.0 §3(a)(3). The attribution
        // was sanitised with a 500-character cap and THEN assigned to
        // fullCredit, so the promise was false for exactly the credits
        // long enough to need eliding — the science harvest found one of
        // 723 characters.
        const long = 'NASA, ESA, ' + Array.from({ length: 40 },
            (_, i) => `Investigator ${i} (An Institution of Astrophysics)`).join(', ');
        expect(long.length).toBeGreaterThan(1500);
        const label = normalizeArtworkLabel({
            name: 'X', metadata: { license: 'CC BY 4.0', attribution: long }
        });
        expect(label.fullCredit).toBe(long);
    });

    it('does not read a restrictive declaration as open', () => {
        for (const declared of ['All rights reserved', '© 2024 Some Agency',
            'Educational use only', 'CC BY-NC 4.0', 'CC BY-ND 4.0']) {
            const item = { metadata: { rights: declared } };
            expect(licenceClassOf(item), declared).toBe(LICENCE.RESTRICTED);
            expect(artworkMayBeShown(normalizeArtworkLabel({ name: 'W', metadata: { rights: declared } })),
                declared).toBe(false);
        }
    });

    it('does not let NonCommercial pass as plain attribution', () => {
        // The worst of the set: `CC BY-NC 4.0` satisfies the CC-BY test,
        // so before restriction was checked first it came out as `cc-by`
        // and the NonCommercial term vanished. A permissive misreading of
        // a restrictive licence is the one error here that noticing later
        // does not undo.
        expect(licenceClassOf({ metadata: { rights: 'CC BY-NC 4.0' } })).not.toBe(LICENCE.BY);
    });

    it('treats a permission grant as owing its credit', () => {
        // Permission grants owe credit by condition, not by luck.
        const item = { metadata: {
            rights: 'PERMISSION',
            attribution: 'Icon Museum and Study Center, Clinton MA'
        } };
        expect(licenceClassOf(item)).toBe(LICENCE.PERMISSION);
        const label = normalizeArtworkLabel({ name: 'An icon', metadata: item.metadata });
        expect(label.creditRequired).toBe(true);
        // …and so it survives the reader turning optional labels off.
        expect(displayedArtworkLabel(label, false)).toContain('Icon Museum and Study Center');
    });

    it('leaves every rights string the corpus actually declares where it was', () => {
        // Corpus rights strings must stay in their classes.
        expect(licenceClassOf({ metadata: { rights: 'PUBLIC_DOMAIN' } })).toBe(LICENCE.OPEN);
        expect(licenceClassOf({ metadata: { rights: 'Creative Commons Attribution 4.0 International License' } }))
            .toBe(LICENCE.BY);
        expect(licenceClassOf({ metadata: {
            rights: 'Public domain (NASA) — acknowledgement required', creditRequired: true
        } })).toBe(LICENCE.PD_CREDIT);
        expect(licenceClassOf({ metadata: {} })).toBe(LICENCE.UNDECLARED);
    });
});

describe('an unrecognised declaration is not an open one', () => {
    it('recognises PUBLIC_DOMAIN as public domain, by name and not by accident', () => {
        // PUBLIC_DOMAIN matches by pattern (underscore), not fallback.
        expect(licenceClassOf({ metadata: { rights: 'PUBLIC_DOMAIN' } })).toBe(LICENCE.OPEN);
        // …and proof it is no longer the FALLBACK answering: a fallback
        // has no way to know an acknowledgement was asked for.
        expect(licenceClassOf({ metadata: { rights: 'PUBLIC_DOMAIN', creditRequired: true } }))
            .toBe(LICENCE.PD_CREDIT);
        expect(licenceClassOf({ metadata: { rights: 'Commons extmetadata: License pd, Copyrighted False' } }))
            .toBe(LICENCE.OPEN);
    });

    it('withholds a declaration it has no pattern for', () => {
        const label = normalizeArtworkLabel({
            name: 'A work', metadata: { rights: 'Terms of use per bilateral agreement, ref. 88/2', artist: 'An artist' }
        });
        expect(label.licence).toBe(LICENCE.UNKNOWN_DECLARED);
        expect(artworkMayBeShown(label)).toBe(false);
    });

    it('still tolerates a provider that declares nothing at all', () => {
        // The distinction the class exists for. Several providers have
        // never declared rights; that is a known condition and closing on
        // it would be a different, much larger change than this one.
        const label = normalizeArtworkLabel({ name: 'Untitled', metadata: { artist: 'An artist' } });
        expect(label.licence).toBe(LICENCE.UNDECLARED);
        expect(artworkMayBeShown(label)).toBe(true);
    });

    it('shows every rights string the corpus declares — all eight of them', () => {
        // Every corpus rights string must classify; none as UNKNOWN_DECLARED.
        const CORPUS_RIGHTS = [
            'PUBLIC_DOMAIN',
            'PERMISSION',
            'Creative Commons Attribution 4.0 International License',
            'Public domain (NASA) — acknowledgement required',
            'Written permission from the Registrar, 2026-07-22',
            'Museum page states Public Domain with free-download invitation',
            'Commons extmetadata: License Public domain, Copyrighted False',
            'Commons extmetadata: License pd, Copyrighted False'
        ];
        for (const rights of CORPUS_RIGHTS) {
            const label = normalizeArtworkLabel({
                name: 'A work', metadata: { rights, artist: 'An artist' } });
            expect(licenceClassOf({ metadata: { rights } }), rights).not.toBe(LICENCE.UNKNOWN_DECLARED);
            expect(artworkMayBeShown(label), rights).toBe(true);
        }
    });
});
