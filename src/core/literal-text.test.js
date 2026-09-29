/**
 * Literal text: a source whose `|` and `[PAUSE]` are words, not choreography.
 *
 * The chunker is the only reader of those controls, so the escape is made
 * where they are read. What has to hold for it to be safe, and not merely
 * convenient:
 *
 *   - it is one unit for one, so no offset (and no Dive anchored to one) moves;
 *   - it is reversible, so no two different texts can escape to the same thing;
 *   - a literal source produces no pause, flash or hold and no phrase break at
 *     a bar, and shows exactly what was written;
 *   - a source that is NOT literal behaves exactly as it always has, including
 *     for the very same words;
 *   - the score cut and the stand-ins are never text, and are refused.
 */
import { describe, expect, it } from 'vitest';
import {
    chunkText, escapeLiteral, hasLiteralForbidden, LITERAL_BRACKET, LITERAL_PIPE, restoreLiteral, SOURCE_MARKER, SOURCE_SCORE_CUT
} from './chunker.js';
import { compileRiseCurrent, validateRiseCurrent } from './rise-current.js';
import { compileSession } from './session-compiler.js';

const CONTROLS = ['pause', 'flash', 'hold'];
const controlAtoms = atoms => atoms.filter(atom => atom.tags.some(tag => CONTROLS.includes(String(tag).toLowerCase())));
const tokens = text => text.split(/\s+/u).filter(Boolean);

function random(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const PIECES = ['a', 'word', 'The', 'quick', 'brown', ',', '.', '|', '[PAUSE]', '[flash]', '[Hold]', '[', ']', '[PAUSE', 'PAUSE]', '\n', '\n\n', ' ', ' ', ' ',
    'x|y', 'a|', '|b', '[HOLD]!', '(not)', 'Dr.', 'I.', '—', 'café', '😀'];

function fuzzText(next) {
    let out = '';
    const n = 1 + Math.floor(next() * 40);
    for (let i = 0; i < n; i += 1) out += PIECES[Math.floor(next() * PIECES.length)] + (next() < 0.7 ? ' ' : '');
    return out;
}

describe('the escape', () => {
    it('is one unit for one, so no offset moves', () => {
        const next = random(1);
        for (let i = 0; i < 500; i += 1) {
            const text = fuzzText(next);
            expect(escapeLiteral(text).length).toBe(text.length);
        }
        expect(escapeLiteral('a | b [PAUSE] c').length).toBe('a | b [PAUSE] c'.length);
    });

    it('is reversible: what comes back is exactly what went in, so no two texts escape alike', () => {
        const next = random(2);
        const seen = new Map();
        for (let i = 0; i < 1_000; i += 1) {
            const text = fuzzText(next);
            const escaped = escapeLiteral(text);
            expect(restoreLiteral(escaped)).toBe(text);
            if (seen.has(escaped)) expect(seen.get(escaped)).toBe(text);
            seen.set(escaped, text);
        }
    });

    it('leaves nothing for the chunker to obey: no bar, no marker, no score cut', () => {
        const next = random(3);
        for (let i = 0; i < 500; i += 1) {
            const escaped = escapeLiteral(fuzzText(next));
            expect(escaped).not.toContain('|');
            expect(new RegExp(SOURCE_MARKER.source, 'i').test(escaped)).toBe(false);
            expect(escaped).not.toContain(SOURCE_SCORE_CUT);
        }
    });

    it('swaps a bar for one stand-in, and only the opening bracket of a marker, in any case', () => {
        expect(escapeLiteral('a | b')).toBe(`a ${LITERAL_PIPE} b`);
        expect(escapeLiteral('[PAUSE]')).toBe(`${LITERAL_BRACKET}PAUSE]`);
        expect(escapeLiteral('[pause] [Flash] [HOLD]')).toBe(`${LITERAL_BRACKET}pause] ${LITERAL_BRACKET}Flash] ${LITERAL_BRACKET}HOLD]`);
        // Brackets that are not the start of a marker are ordinary text and are left alone.
        expect(escapeLiteral('[not a marker] [PAUS] [PAUSE')).toBe('[not a marker] [PAUS] [PAUSE');
    });

    it('refuses text that holds the score cut or a stand-in, because those are never text and would make it ambiguous', () => {
        for (const bad of [`a${SOURCE_SCORE_CUT}b`, `a${LITERAL_PIPE}b`, `a${LITERAL_BRACKET}b`]) {
            expect(hasLiteralForbidden(bad)).toBe(true);
            expect(() => escapeLiteral(bad)).toThrow(RangeError);
        }
        for (const bad of [null, undefined, 5, {}]) expect(() => escapeLiteral(bad)).toThrow(TypeError);
        expect(hasLiteralForbidden('a | b [PAUSE]')).toBe(false);
    });
});

const SAMPLE = 'Write a | b to split, and [PAUSE] to pause. Then [flash] and [HOLD] too.';

describe('a literal text through the chunker', () => {
    for (const mode of ['word', 'phrase', 'sentence', 'paragraph']) {
        it(`in ${mode} mode makes no pause, flash or hold, and shows what was written`, () => {
            const atoms = chunkText(escapeLiteral(SAMPLE), { mode, literal: true });
            expect(controlAtoms(atoms)).toEqual([]);
            const shown = atoms.map(atom => atom.content).join(' ');
            expect(shown).toContain('|');
            expect(shown).toContain('[PAUSE]');
            expect(shown).toContain('[flash]');
            expect(shown).toContain('[HOLD]');
            expect(shown).not.toMatch(/[]/u);
            expect(tokens(shown)).toEqual(tokens(SAMPLE));
        });
    }

    it('does not treat a bar as a phrase edge, so a bar does not change where a reading breaks', () => {
        const withBar = chunkText(escapeLiteral('one two | three four'), { mode: 'phrase', literal: true, phraseFloor: false });
        expect(withBar.map(atom => atom.content)).toEqual(['one two | three four']);
        // The same words, authored as a control, do break there: that is what the escape prevents.
        const asControl = chunkText('one two | three four', { mode: 'phrase', phraseFloor: false });
        expect(asControl.map(atom => atom.content)).toEqual(['one two', 'three four']);
    });

    it('keeps a bar that stands alone as a word in word mode, where any other lone mark is dropped', () => {
        const kept = chunkText(escapeLiteral('a | b'), { mode: 'word', literal: true });
        expect(kept.map(atom => atom.content)).toEqual(['a', '|', 'b']);
        const dropped = chunkText('a — b', { mode: 'word' });
        expect(dropped.map(atom => atom.content)).toEqual(['a', 'b']);
    });

    it('shows a whole text as written, however it is cut, for random text in every mode', () => {
        const next = random(4);
        for (let i = 0; i < 300; i += 1) {
            const text = fuzzText(next).replace(/[ \t\n]+/gu, ' ').trim();
            if (!text) continue;
            for (const mode of ['sentence', 'paragraph']) {
                const atoms = chunkText(escapeLiteral(text), { mode, literal: true });
                expect(controlAtoms(atoms), text).toEqual([]);
                const shown = atoms.filter(atom => atom.content).map(atom => atom.content).join(' ');
                expect(tokens(shown), `${mode}: ${text}`).toEqual(tokens(text));
            }
        }
    });

    it('never produces a control atom for random text in any mode, however hostile', () => {
        const next = random(5);
        for (let i = 0; i < 400; i += 1) {
            const text = fuzzText(next);
            for (const mode of ['word', 'phrase', 'sentence', 'paragraph']) {
                const atoms = chunkText(escapeLiteral(text), { mode, literal: true });
                expect(controlAtoms(atoms), `${mode}: ${text}`).toEqual([]);
                for (const atom of atoms) expect(atom.content).not.toMatch(/[]/u);
            }
        }
    });
});

describe('a text that is not literal', () => {
    it('is chunked exactly as it always was, for the very same words', () => {
        const atoms = chunkText(SAMPLE, { mode: 'sentence' });
        const tags = atoms.flatMap(atom => atom.tags);
        expect(tags).toEqual(expect.arrayContaining(['PAUSE', 'FLASH', 'HOLD']));
        expect(atoms.map(atom => atom.content).join(' ')).not.toContain('|');
        expect(atoms.map(atom => atom.content).join(' ')).not.toContain('[PAUSE]');
    });

    it('is not touched by the stand-ins: it never restores what it never escaped', () => {
        const atoms = chunkText(`a ${LITERAL_PIPE} b`, { mode: 'sentence' });
        expect(atoms.map(atom => atom.content)).toEqual([`a ${LITERAL_PIPE} b`]);
    });
});

describe('a literal source in a Session', () => {
    it('is compiled to atoms that show the words, with the exact text kept for whatever reads it', () => {
        const session = compileSession({
            title: 'Literal',
            sources: [{ id: 's', name: 'S', type: 'text/plain', data: 'Type a | b, then [PAUSE] to pause.', literal: true }],
            chunkMode: 'sentence'
        });
        expect(session.atoms.map(atom => atom.content)).toEqual(['Type a | b, then [PAUSE] to pause.']);
        expect(session.atoms.flatMap(atom => atom.tags)).not.toContain('PAUSE');
        expect(session.sourceTexts.get('s')).toBe('Type a | b, then [PAUSE] to pause.');
        expect(session.sources[0].literal).toBe(true);
    });

    it('does the ordinary thing for the same source when it is not literal', () => {
        const session = compileSession({
            title: 'Not literal',
            sources: [{ id: 's', name: 'S', type: 'text/plain', data: 'Type a | b, then [PAUSE] to pause.' }],
            chunkMode: 'sentence'
        });
        expect(session.atoms.flatMap(atom => atom.tags)).toContain('PAUSE');
        expect(session.sources[0].literal).toBeUndefined();
    });

    it('refuses a literal source that holds the stand-ins, and takes the rest of the session with it', () => {
        expect(() => compileSession({
            title: 'Bad', sources: [{ id: 's', name: 'S', type: 'text/plain', data: `a ${LITERAL_PIPE} b`, literal: true }]
        })).toThrow(RangeError);
    });
});

const current = (segments, extra = {}) => ({
    schema: 'rise.current.v1', id: 'lit', title: 'Literal', origin: { kind: 'human', name: 'Tester' }, segments, ...extra
});

describe('a literal segment in a sealed Current', () => {
    const text = 'To pause, write [PAUSE]. To split, write a | b. Nothing here is an instruction.';

    it('may carry bars and marker words, and is refused without saying so', () => {
        expect(() => validateRiseCurrent(current([{ id: 's', text }]))).toThrow(/reserved playback marker/u);
        const clean = validateRiseCurrent(current([{ id: 's', text, literal: true }]));
        expect(clean.segments[0].literal).toBe(true);
        expect(clean.segments[0].text).toBe(text);
    });

    it('says nothing about literal when it is not, so the sealed form of an ordinary Current is unchanged', () => {
        expect(validateRiseCurrent(current([{ id: 's', text: 'Plain words.', literal: false }])).segments[0]).not.toHaveProperty('literal');
        expect(validateRiseCurrent(current([{ id: 's', text: 'Plain words.' }])).segments[0]).not.toHaveProperty('literal');
    });

    it('still refuses the score cut and the stand-ins, and a literal that is not a boolean', () => {
        for (const bad of [`a${SOURCE_SCORE_CUT}b`, `a${LITERAL_PIPE}b`, `a${LITERAL_BRACKET}b`]) {
            expect(() => validateRiseCurrent(current([{ id: 's', text: bad, literal: true }])), JSON.stringify(bad)).toThrow(/score cut/u);
        }
        for (const bad of ['yes', 1, 'true', null, {}, []]) {
            expect(() => validateRiseCurrent(current([{ id: 's', text: 'ok', literal: bad }])), String(bad)).toThrow(/literal is true or false/u);
        }
    });

    it('lowers to atoms that show the words and no choreography', () => {
        const session = compileRiseCurrent(current([{ id: 's', text, literal: true }]));
        const shown = session.atoms.map(atom => atom.content).join(' ');
        expect(shown).toContain('[PAUSE]');
        expect(shown).toContain('a | b');
        expect(session.atoms.flatMap(atom => atom.tags).map(String)).not.toContain('PAUSE');
    });

    it('keeps a Dive anchored over literal words exactly where it was written', () => {
        const from = text.indexOf('a | b');
        const withDive = current([{
            id: 's', text, literal: true,
            dives: [{ id: 'd', text: 'A note on the bar.', anchor: { fromCharacter: from, toCharacter: from + 'a | b.'.length, quoteStart: 'a | b.', quoteEnd: 'a | b.' } }]
        }]);
        const session = compileRiseCurrent(withDive);
        const anchored = session.atoms.filter(atom => Number.isInteger(atom.sourceCharacterStart) && atom.sourceCharacterEnd > atom.sourceCharacterStart);
        expect(anchored.length).toBeGreaterThan(0);
        const kept = session.sourceTexts.get('s');
        expect(kept).toBe(text);
        for (const atom of anchored) {
            expect(tokens(kept.slice(atom.sourceCharacterStart, atom.sourceCharacterEnd)), atom.content).toEqual(tokens(atom.content));
        }
    });

    it('keeps a Dive anchored over a marker word in place, even when the anchor is the marker itself', () => {
        const from = text.indexOf('[PAUSE].');
        const session = compileRiseCurrent(current([{
            id: 's', text, literal: true,
            dives: [{ id: 'd', text: 'What the marker does elsewhere.', anchor: { fromCharacter: from, toCharacter: from + '[PAUSE].'.length, quoteStart: '[PAUSE].', quoteEnd: '[PAUSE].' } }]
        }]));
        expect(session.atoms.map(atom => atom.content).join(' ')).toContain('[PAUSE].');
    });

    it('also compiles as a page, and the page reads the words as written', () => {
        const session = compileRiseCurrent(current([{ id: 's', text, literal: true }]), { projection: 'page' });
        expect(session.projection).toBe('page');
        expect(session.sourceTexts.get('s')).toBe(text);
        expect(session.atoms.map(atom => atom.content).join(' ')).toContain('a | b');
    });

    it('refuses a Dive whose quotation does not match the words as written', () => {
        const from = text.indexOf('a | b');
        expect(() => compileRiseCurrent(current([{
            id: 's', text, literal: true,
            dives: [{ id: 'd', text: 'x', anchor: { fromCharacter: from, toCharacter: from + 5, quoteStart: 'a / b', quoteEnd: 'a / b' } }]
        }]))).toThrow();
    });
});
