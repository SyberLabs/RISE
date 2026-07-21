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
