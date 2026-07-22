import { describe, expect, it } from 'vitest';
import { prepareChunkText } from './chunk-profiles.js';
import { compileSession } from './session-compiler.js';
import { ATRIUM_PILOT_PAYLOADS } from '../content/atrium/packs/pilot-v1/payloads.js';

const tokens = text => text.trim().split(/\s+/u).filter(Boolean);
const stableAtom = atom => ({
    content: atom.content,
    modality: atom.modality,
    duration: atom.duration,
    weight: atom.weight,
    complexity: atom.complexity,
    tags: atom.tags,
    source: atom.source,
    sourceId: atom.sourceId,
    position: atom.position,
    timingLocked: atom.timingLocked
});

describe('chunk profiles', () => {
    it('is pure and conserves every dialogue token exactly once', () => {
        const raw = 'An opening question? THEAETETUS: Yes. SOCRATES: Then continue.';
        const first = prepareChunkText(raw, 'dialogue');
        const second = prepareChunkText(raw, 'dialogue');

        expect(first).toEqual(second);
        expect(tokens(first.text)).toEqual(tokens(raw));
        expect(first.text).toContain('question?\n\nTHEAETETUS: Yes.\n\nSOCRATES: Then');
        expect(raw).toBe('An opening question? THEAETETUS: Yes. SOCRATES: Then continue.');
    });

    it('puts every matching Protagoras speaker label at its utterance head in Phrase mode', () => {
        const raw = ATRIUM_PILOT_PAYLOADS['pass-protagoras-measure'];
        const session = compileSession({
            sources: [{ id: 'pass-protagoras-measure', name: 'Theaetetus', data: raw, chunkProfile: 'dialogue' }],
            chunkMode: 'phrase',
            curve: 'flat',
            wpm: 140
        });
        const content = session.atoms.filter(atom => atom.content).map(atom => atom.content);
        const labelled = content.filter(value => /(?:THEAETETUS|SOCRATES):/.test(value));

        expect(labelled.length).toBeGreaterThan(10);
        expect(labelled.every(value => /^(?:THEAETETUS|SOCRATES):\s+\S/.test(value))).toBe(true);
        expect(content).toContain('THEAETETUS: O yes,');
        expect(content.some(value => /\s(?:THEAETETUS|SOCRATES):$/.test(value))).toBe(false);
        expect(tokens(content.join(' '))).toEqual(tokens(raw));
    });

    it('passes Timaeus through byte-for-byte when no speaker tag is present', () => {
        const raw = ATRIUM_PILOT_PAYLOADS['pass-plato-cosmos'];
        expect(prepareChunkText(raw, 'dialogue').text).toBe(raw);
    });

    it('keeps the no-profile compiler path identical to direct chunking', () => {
        const raw = 'A sentence, with deliberate punctuation.\n\nThen return.';
        const baseline = compileSession({
            sources: [{ id: 'control', name: 'Control', data: raw }],
            chunkMode: 'phrase',
            curve: 'flat',
            wpm: 180
        }).atoms.map(stableAtom);
        const explicitNull = compileSession({
            sources: [{ id: 'control', name: 'Control', data: raw, chunkProfile: null }],
            chunkProfile: null,
            chunkMode: 'phrase',
            curve: 'flat',
            wpm: 180
        }).atoms.map(stableAtom);

        expect(prepareChunkText(raw, null)).toEqual({ text: raw });
        expect(explicitNull).toEqual(baseline);
    });

    it('supports a session default and a per-source override without auto-detection', () => {
        const raw = 'Question? SOCRATES: Answer.';
        const profiled = compileSession({
            sources: [{ id: 'a', name: 'A', data: raw }],
            chunkProfile: 'dialogue',
            chunkMode: 'phrase'
        });
        const unprofiled = compileSession({
            sources: [{ id: 'a', name: 'A', data: raw }],
            chunkMode: 'phrase'
        });

        expect(profiled.atoms.some(atom => atom.content === 'SOCRATES: Answer.')).toBe(true);
        expect(unprofiled.atoms.some(atom => atom.content?.endsWith('SOCRATES:'))).toBe(true);
        expect(() => compileSession({ text: raw, chunkProfile: 'unknown-profile' })).toThrow(/Unknown chunk profile/);
    });
});

describe('scripture profile', () => {
    const verses = '[v 1:1] In the beginning God created heaven, and earth.\n\n'
        + '[v 1:2] And the earth was void and empty.\n\n'
        + '[v 2:1] So the heavens and the earth were finished.';

    it('strips verse sentinels from display and preserves them as anchors', () => {
        const prepared = prepareChunkText(verses, 'scripture');

        expect(prepared.text).toBe(
            'In the beginning God created heaven, and earth.\n\n'
            + 'And the earth was void and empty.\n\n'
            + 'So the heavens and the earth were finished.'
        );
        expect(prepared.text).not.toContain('[v ');
        expect(prepared.hints.scripture.verseAnchors).toEqual([
            { paragraph: 0, chapter: 1, verse: 1 },
            { paragraph: 1, chapter: 1, verse: 2 },
            { paragraph: 2, chapter: 2, verse: 1 }
        ]);
        expect(prepared.hints.scripture.chapterStarts).toEqual([
            { paragraph: 0, chapter: 1 },
            { paragraph: 2, chapter: 2 }
        ]);
    });

    it('conserves every Scripture token exactly once, sentinels excepted', () => {
        const prepared = prepareChunkText(verses, 'scripture');
        const sentinelFree = verses.replace(/\[v \d+:\d+\] /g, '');
        expect(tokens(prepared.text)).toEqual(tokens(sentinelFree));
    });

    it('never speaks a verse number: no compiled atom contains a sentinel', () => {
        const session = compileSession({
            sources: [{ id: 'chapel-genesis', name: 'Genesis', data: verses, chunkProfile: 'scripture' }],
            chunkMode: 'phrase',
            curve: 'flat',
            wpm: 140
        });
        const content = session.atoms.filter(atom => atom.content).map(atom => atom.content);
        expect(content.length).toBeGreaterThan(0);
        expect(content.some(value => /\[v \d+:\d+\]/.test(value))).toBe(false);
        expect(content.join(' ')).toContain('In the beginning God created');
    });

    it('is inert on text without sentinels: byte-identical, no hints', () => {
        const raw = 'A plain paragraph.\n\nAnother, with 1:1 odds mentioned inline.';
        const prepared = prepareChunkText(raw, 'scripture');
        expect(prepared.text).toBe(raw);
        expect(prepared.hints).toBeUndefined();
    });

    it('is display-side only: the raw payload string is never mutated', () => {
        const raw = '[v 1:1] Immutable input.';
        prepareChunkText(raw, 'scripture');
        expect(raw).toBe('[v 1:1] Immutable input.');
        // and it is pure
        expect(prepareChunkText(raw, 'scripture')).toEqual(prepareChunkText(raw, 'scripture'));
    });
});
