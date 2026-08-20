import { describe, expect, it } from 'vitest';
import { prepareChunkText } from './chunk-profiles.js';
import { chunkText } from './chunker.js';
import { compileSession } from './session-compiler.js';

/**
 * THE FIXTURES ARE THIS TEST'S OWN.
 *
 * They were two payloads from the Atrium's pilot pack — chosen because they
 * existed, not because the profile needed Plato — and they went when the room
 * did. What was actually being proven is a property of the profile: a speaker
 * label belongs at the head of the utterance that follows it, never trailing
 * the one before. A test that owns its fixture cannot be broken by deleting a
 * corpus it was never really about.
 *
 * Long enough to yield more than ten labelled atoms, because a speaker-head
 * rule that holds for one exchange proves nothing about the next.
 */
const DIALOGUE = [
    'SOCRATES: Then tell me what you take knowledge to be.',
    'THEAETETUS: O yes, I will try, though I have tried before and failed.',
    'SOCRATES: You failed alone. Fail again, and I will fail with you.',
    'THEAETETUS: Knowledge is perception, I think.',
    'SOCRATES: A brave answer. Is the wind cold?',
    'THEAETETUS: To one who shivers, cold; to another, not cold.',
    'SOCRATES: Then the same wind is and is not cold.',
    'THEAETETUS: It seems so, and that troubles me.',
    'SOCRATES: Let it trouble you. What troubles a man is what he has not yet thought through.',
    'THEAETETUS: Then perception is of what appears, and no more.',
    'SOCRATES: And is appearing the same as being?',
    'THEAETETUS: I would not say so now.',
    'SOCRATES: Then knowledge is something other than perception, and we must look again.',
    'THEAETETUS: We must, and I am not sorry for it.'
].join(' ');

/** No speaker tag anywhere, so the profile must not touch a character. */
const UNSPOKEN = 'Now that which is created must of necessity be created by a '
    + 'cause. But the father and maker of all this universe is past finding out; '
    + 'and even if we found him, to tell of him to all men would be impossible. '
    + 'This question, however, we must ask about the world: which of the patterns '
    + 'had the artificer in view when he made it?';

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

    it('puts every speaker label at its utterance head in Phrase mode', () => {
        const raw = DIALOGUE;
        const session = compileSession({
            sources: [{ id: 'dialogue-fixture', name: 'Dialogue', data: raw, chunkProfile: 'dialogue' }],
            chunkMode: 'phrase',
            curve: 'flat',
            wpm: 140
        });
        const content = session.atoms.filter(atom => atom.content).map(atom => atom.content);
        const labelled = content.filter(value => /(?:THEAETETUS|SOCRATES):/.test(value));

        expect(labelled.length).toBeGreaterThan(10);
        expect(labelled.every(value => /^(?:THEAETETUS|SOCRATES):\s+\S/.test(value))).toBe(true);
        expect(content.some(value => /\s(?:THEAETETUS|SOCRATES):$/.test(value))).toBe(false);
        expect(tokens(content.join(' '))).toEqual(tokens(raw));
    });

    it('passes prose through byte-for-byte when no speaker tag is present', () => {
        expect(prepareChunkText(UNSPOKEN, 'dialogue').text).toBe(UNSPOKEN);
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
            chunkMode: 'phrase',
            // The floor is the default now and it UN-STRANDS a speaker
            // label, so it is declined here to show what the profile is
            // actually for: the label survives without it too.
            phraseFloor: false
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

describe('the verse profile', () => {
    it('changes no text — it carries a chunking decision, not a normalisation', () => {
        const raw = 'Sugriva moved by wondering awe\nThe high-souled sons of Raghu saw,';
        const prepared = prepareChunkText(raw, 'verse');
        expect(prepared.text).toBe(raw);
        expect(prepared.phraseFloor).toBe(false);
    });

    it('is the INVERSE of the profile that stood here this morning', () => {
        // While the floor was opt-in, the useful statement was "floor this
        // text". The floor is now the default, so the statement worth
        // making is the opposite — and a `prose` profile asking for what
        // everything already gets would be a control that does nothing.
        expect(() => prepareChunkText('x', 'prose')).toThrow(RangeError);
    });

    it('keeps a text unfloored when it asks to be', () => {
        const raw = 'Line, Notan, Color, Design, Composition, Painting, and the crafts '
            + 'alike rest upon them, as every teacher of the subject has always known.';
        const pieces = floor => chunkText(raw, { mode: 'phrase', phraseFloor: floor })
            .filter(a => a.content).length;
        expect(pieces(false)).toBeGreaterThan(pieces(true));
    });

    it('is refused if it is not a profile anyone declared', () => {
        expect(() => prepareChunkText('x', 'poetry')).toThrow(RangeError);
    });
});
