import { describe, expect, it } from 'vitest';
import {
    applyArtworkLabelElement,
    displayedArtworkLabel,
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
