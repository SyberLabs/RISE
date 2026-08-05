import { describe, expect, it } from 'vitest';
import {
    applyArtworkLabelElement,
    artworkMayBeShown,
    displayedArtworkLabel,
    LICENCE,
    licenceClassOf,
    normalizeArtworkLabel,
    plainArtworkText
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
    // THE POINT OF THIS WHOLE SEPARATION. The museum corpus cleared on
    // public domain and CC0, which owe no attribution at all, and many of
    // those works are by an unknown hand. A withholding rule that did not
    // ask WHICH LICENCE it was withholding under would empty shelves that
    // were never at risk. These cases come first because they are the
    // ones that must not move.

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
