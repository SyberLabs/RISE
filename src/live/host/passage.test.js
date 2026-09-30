/**
 * Words about a passage: its intended condition, its sources, its depth.
 *
 * The invariants: a source is a link only when it is a plain https address; a
 * model's own proposal is never presented as checked; a passage with no source
 * says so through the shape of the description (empty, and not absent); the
 * condition is coarse and never about the reader; and none of it can carry
 * markup, because it is data that the controls draw with textContent.
 */
import { describe, expect, it } from 'vitest';
import { BLACK_HOLES } from '../fixtures/black-holes.js';
import { describeOrigin, describePassage, KIND_LABELS, safeHref } from './passage.js';

const view = () => ({
    segments: BLACK_HOLES.segments.map(segment => ({
        id: segment.id, text: segment.text, ended: true,
        state: { ...(segment.state ?? {}) },
        evidence: (segment.evidence ?? []).map(item => ({ ...item })),
        dives: (segment.dives ?? []).map(item => ({ ...item }))
    }))
});

describe('links', () => {
    it('is a link for a plain https address, and only then', () => {
        expect(safeHref('https://doi.org/10.3847/2041-8213/ab0ec7')).toBe('https://doi.org/10.3847/2041-8213/ab0ec7');
        for (const bad of [
            'http://example.org/', 'javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://example.org/', '//example.org/',
            'https://user:pass@example.org/', 'https://example.org/a b', 'https://example.org/"onclick=', 'https://ex\u0000ample.org/',
            'https://example.org/<x>', '', ' https://example.org/', undefined, null, 42, {}
        ]) {
            expect(safeHref(bad), String(bad)).toBeNull();
        }
    });
});

describe('a passage with sources', () => {
    it('says where each came from, what it is, where in it, and the words it supports', () => {
        const data = view();
        data.segments.find(s => s.id === 'shadow').evidence[0].supports = { fromCharacter: 0, toCharacter: 8 };
        const passage = describePassage(data, 'shadow');
        expect(passage.sources).toHaveLength(1);
        expect(passage.sources[0]).toMatchObject({
            kind: 'supplied',
            kindLabel: KIND_LABELS.supplied,
            title: expect.stringContaining('Event Horizon Telescope'),
            location: 'The Astrophysical Journal Letters 875, L1 (2019)',
            href: 'https://doi.org/10.3847/2041-8213/ab0ec7',
            supports: 'In 2019,'
        });
    });

    it('never presents a proposal by the model as checked', () => {
        const data = view();
        data.segments[0].evidence = [{ id: 'p', kind: 'model-proposed', title: 'A paper the model remembers', uri: 'https://example.org/paper' }];
        const [source] = describePassage(data, 'what').sources;
        expect(source.kindLabel).toBe('Proposed by the model, not checked');
        expect(source.kindLabel).not.toMatch(/verified|checked and|confirmed/iu);
        expect(KIND_LABELS.retrieved).toBe('Retrieved');
    });

    it('gives an address that is not plain https as words, not as a link', () => {
        const data = view();
        data.segments[0].evidence = [{ id: 'x', kind: 'supplied', title: 'Odd', uri: 'javascript:alert(1)' }];
        const [source] = describePassage(data, 'what').sources;
        expect(source.href).toBeNull();
        expect(source.uri).toBe('javascript:alert(1)');
    });
});

describe('a passage with none', () => {
    it('has an empty list of sources, which the controls say in words', () => {
        const passage = describePassage(view(), 'what');
        expect(passage.sources).toEqual([]);
        expect(passage.notes).toEqual([]);
    });
});

describe('the intended condition', () => {
    it('is coarse words in the closed list, and only for what the passage said', () => {
        const passage = describePassage(view(), 'what');
        expect(passage.condition.map(c => c.name).sort()).toEqual(['expansiveness', 'motionEnergy', 'perceptualDensity', 'solemnity', 'tension']);
        const word = name => passage.condition.find(c => c.name === name).word;
        expect(word('motionEnergy')).toBe('low');
        expect(word('solemnity')).toBe('medium');
        expect(describePassage(view(), 'waves').condition.find(c => c.name === 'motionEnergy').word).toBe('high');
    });

    it('is never a statement about the reader', () => {
        for (const segment of BLACK_HOLES.segments) {
            for (const item of describePassage(view(), segment.id).condition) {
                expect(`${item.label} ${item.word}`).not.toMatch(/\byou\b|\byour\b|reader|feel/iu);
            }
        }
    });

    it('does not show a dimension that was not given, as if it were zero', () => {
        const data = view();
        data.segments[0].state = {};
        expect(describePassage(data, 'what').condition).toEqual([]);
    });
});

describe('depth', () => {
    it('lists the notes written with the answer, with the words each is about', () => {
        const passage = describePassage(view(), 'horizon');
        expect(passage.notes).toHaveLength(1);
        expect(passage.notes[0].about).toBe('event horizon.');
        expect(passage.notes[0].text).toMatch(/Outside observers never see/u);
    });
});

describe('what it will not describe', () => {
    it('returns nothing for a passage that is not there, or no view', () => {
        expect(describePassage(view(), 'nope')).toBeNull();
        expect(describePassage(null, 'what')).toBeNull();
        expect(describePassage({}, 'what')).toBeNull();
    });

    it('carries hostile words as words: it is data, not markup', () => {
        const data = view();
        data.segments[0].evidence = [{ id: 'h', kind: 'supplied', title: '<img src=x onerror=1>', location: '<script>1</script>' }];
        const [source] = describePassage(data, 'what').sources;
        expect(source.title).toBe('<img src=x onerror=1>');
        expect(typeof source.title).toBe('string');
    });
});

describe('where a side Current came from', () => {
    it('says a model wrote it when the reader asked, and that it does not change what they left', () => {
        expect(describeOrigin({ kind: 'model', name: 'Scripted answer', provider: 'mock' }))
            .toBe('Written when you asked, by Scripted answer (mock). It does not change what you left.');
        expect(describeOrigin({ kind: 'human', name: 'A. Author' })).toBe('From A. Author.');
        expect(describeOrigin(null)).toBe('');
    });
});
