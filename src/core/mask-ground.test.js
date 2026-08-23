import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LISTED_PROCEDURAL_PATTERNS, PROCEDURAL_PATTERN_IDS } from './visual-registry.js';
import { MUSEUM_CATEGORIES } from '../sources/visual/museum.js';
import { SCIENCE_CATEGORIES } from '../content/science/imagery/science-pins.js';
import { ATRIUM_PINNED_COLLECTIONS } from '../content/imagery/collections.js';
import {
    GROUNDS,
    combine,
    describeSource,
    isProceduralSource,
    isStillSource,
    maskGroundFromConfig,
    profileFor
} from './mask-ground.js';

describe('source color profiles', () => {
    it('every listed procedural declares Transparent | Light | Dark', () => {
        const ids = [...PROCEDURAL_PATTERN_IDS, ...LISTED_PROCEDURAL_PATTERNS.map(p => p.id)];
        for (const id of new Set(ids)) {
            expect(['transparent', 'light', 'dark'], id).toContain(profileFor(id));
        }
    });

    it('uses Dark only for the four procedural engines that need it', () => {
        for (const id of ['attractor', 'turrell', 'klee', 'harmonograph']) {
            expect(profileFor(id), id).toBe(GROUNDS.dark);
        }
    });

    it('uses Light cream for the procedural default and legacy mask ids', () => {
        for (const id of ['fractal', 'ostensoria', 'neural', 'rockgarden', 'apparitio']) {
            expect(profileFor(id), id).toBe(GROUNDS.light);
        }
    });

    it('every museum and science collection id has a profile', () => {
        for (const id of Object.keys(MUSEUM_CATEGORIES)) {
            expect(['transparent', 'light', 'dark'], `aic-${id}`).toContain(profileFor(`aic-${id}`));
        }
        for (const id of Object.keys(SCIENCE_CATEGORIES)) {
            expect(['transparent', 'light', 'dark'], `sci-${id}`).toContain(profileFor(`sci-${id}`));
        }
        expect(profileFor('sci-astronomy')).toBe(GROUNDS.dark);
        expect(profileFor('aic-oldmasters')).toBe(GROUNDS.dark);
    });

    it('personal, blend, and collection families declare a profile', () => {
        expect(profileFor('personal')).toBe(GROUNDS.transparent);
        expect(profileFor('blend')).toBe(GROUNDS.transparent);
        expect(profileFor('collections')).toBe(GROUNDS.transparent);
        expect(profileFor('global-pool')).toBe(GROUNDS.transparent);
        expect(profileFor('personal:album')).toBe(GROUNDS.transparent);
    });

    it('atrium stills are still sources, not procedurals', () => {
        for (const id of Object.keys(ATRIUM_PINNED_COLLECTIONS)) {
            expect(isStillSource(id), id).toBe(true);
            expect(isProceduralSource(id), id).toBe(false);
            expect(['transparent', 'light', 'dark'], id).toContain(profileFor(id));
        }
    });

    it('the plate stylesheet binds named tokens, never #000 or #fff', () => {
        const css = readFileSync(resolve('src/components/Chamber.css'), 'utf8');
        const ruleFor = (ground) => css.match(
            new RegExp(`\\.chamber-mask-ground-plate\\[data-ground="${ground}"\\]\\s*\\{([^}]*)\\}`)
        )?.[1];

        expect(ruleFor('dark')).toContain('var(--color-dark-slate)');
        expect(ruleFor('light')).toContain('var(--color-cream)');
        expect(ruleFor('dark')).not.toMatch(/#fff|#ffffff|#000|#000000/i);
        expect(ruleFor('light')).not.toMatch(/#fff|#ffffff|#000|#000000/i);
    });
});

describe('combine(A, B) — Firstmate law', () => {
    it('1. a procedural fill starts from the fill profile', () => {
        expect(combine('aic-landscapes', 'attractor', { roomOpaque: true })).toBe(GROUNDS.dark);
        expect(combine('aic-landscapes', 'fractal', { roomOpaque: true })).toBe(GROUNDS.light);
        expect(combine('aic-ukiyoe', 'harmonograph', { roomOpaque: true })).toBe(GROUNDS.dark);
        expect(combine('aic-ukiyoe', 'neural', { roomOpaque: true })).toBe(GROUNDS.light);
    });

    it('2. Astronomy + Attractor → Dark, via Attractor’s own profile', () => {
        expect(combine('sci-astronomy', 'attractor', { roomOpaque: true })).toBe(GROUNDS.dark);
        expect(combine('astronomy', 'attractor', { roomOpaque: true })).toBe(GROUNDS.dark);
    });

    it('2. Old Masters + Fractal → Light, via Fractal’s own profile', () => {
        expect(combine('aic-oldmasters', 'fractal', { roomOpaque: true })).toBe(GROUNDS.light);
        expect(combine('oldmasters', 'fractal', { roomOpaque: true })).toBe(GROUNDS.light);
    });

    it('2. locked Astronomy + Fractal → Light (cream), even when A is not opaque', () => {
        expect(combine('sci-astronomy', 'fractal', { roomOpaque: true })).toBe(GROUNDS.light);
        expect(combine('sci-astronomy', 'fractal', { roomOpaque: false })).toBe(GROUNDS.light);
        expect(combine('astronomy', 'fractal')).toBe(GROUNDS.light);
        expect(combine('sci-astronomy', 'fractal')).not.toBe(GROUNDS.dark);
    });

    it('3. two collection/still sources → Transparent when A is already opaque', () => {
        expect(combine('sci-astronomy', 'aic-ukiyoe', { roomOpaque: true }))
            .toBe(GROUNDS.transparent);
        expect(combine('aic-oldmasters', 'aic-landscapes', { roomOpaque: true }))
            .toBe(GROUNDS.transparent);
        expect(combine('global-pool', 'aic-flowers', { roomOpaque: true }))
            .toBe(GROUNDS.transparent);
    });

    it('4. Transparent result with A not yet opaque → Dark (never page punch)', () => {
        expect(combine('sci-astronomy', 'aic-ukiyoe', { roomOpaque: false }))
            .toBe(GROUNDS.dark);
        expect(combine('aic-landscapes', 'aic-ukiyoe')).toBe(GROUNDS.dark);
    });

    it('a procedural room under a still fill is not both-still; missing A goes Dark', () => {
        expect(combine('fractal', 'aic-ukiyoe', { roomOpaque: false })).toBe(GROUNDS.dark);
        expect(isProceduralSource('fractal')).toBe(true);
        expect(isStillSource('aic-ukiyoe')).toBe(true);
    });

    it('describeSource classifies engines vs collections', () => {
        expect(describeSource('attractor')).toMatchObject({
            id: 'attractor',
            procedural: true,
            still: false,
            profile: GROUNDS.dark
        });
        expect(describeSource('sci-astronomy')).toMatchObject({
            id: 'sci-astronomy',
            family: 'astronomy',
            procedural: false,
            still: true,
            profile: GROUNDS.dark
        });
        expect(describeSource('aic-oldmasters').family).toBe('oldmasters');
    });
});

describe('maskGroundFromConfig', () => {
    it('Astronomy room + Attractor word-fill → Dark', () => {
        expect(maskGroundFromConfig({
            activeTypes: ['sci-astronomy'],
            sourced: ['sci-astronomy'],
            wordFill: { mode: 'pick', sourced: [], procedural: ['attractor'] },
            roomOpaque: true
        })).toBe(GROUNDS.dark);
    });

    it('Old Masters room + Fractal word-fill → Light', () => {
        expect(maskGroundFromConfig({
            activeTypes: ['aic-oldmasters'],
            sourced: ['aic-oldmasters'],
            wordFill: { mode: 'pick', sourced: [], procedural: ['fractal'] },
            roomOpaque: true
        })).toBe(GROUNDS.light);
    });

    it('Astronomy room + Fractal word-fill → Light (cream), A-not-opaque cannot force Dark', () => {
        expect(maskGroundFromConfig({
            activeTypes: ['sci-astronomy'],
            sourced: ['sci-astronomy'],
            wordFill: { mode: 'pick', sourced: [], procedural: ['fractal'] },
            roomOpaque: false
        })).toBe(GROUNDS.light);
        expect(maskGroundFromConfig({
            activeTypes: ['sci-astronomy'],
            sourced: ['sci-astronomy'],
            wordFill: { mode: 'pick', sourced: [], procedural: ['fractal'] },
            roomOpaque: true
        })).toBe(GROUNDS.light);
    });

    it('undefined wordFill on an Astronomy × Fractal session still yields Light cream', () => {
        expect(maskGroundFromConfig({
            activeTypes: ['sci-astronomy'],
            sourced: ['sci-astronomy'],
            procedural: ['fractal'],
            roomOpaque: false
        })).toBe(GROUNDS.light);
        expect(maskGroundFromConfig({
            activeTypes: ['sci-astronomy'],
            sourced: ['sci-astronomy'],
            procedural: ['fractal']
        })).not.toBe(GROUNDS.dark);
    });

    it('same-as-gallery collections stay Transparent once A is opaque', () => {
        expect(maskGroundFromConfig({
            activeTypes: ['aic-landscapes'],
            sourced: ['aic-landscapes'],
            wordFill: { mode: 'same' },
            roomOpaque: true
        })).toBe(GROUNDS.transparent);
    });

    it('two sourced stills stay Transparent', () => {
        expect(maskGroundFromConfig({
            activeTypes: ['sci-astronomy'],
            sourced: ['sci-astronomy'],
            wordFill: { mode: 'pick', sourced: ['aic-ukiyoe'], procedural: [] },
            roomOpaque: true
        })).toBe(GROUNDS.transparent);
    });
});
