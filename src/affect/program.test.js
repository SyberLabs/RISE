import { describe, expect, it } from 'vitest';
import { chunkText } from '../core/chunker.js';
import { DIMENSIONS } from './dimensions.js';
import { contentHash } from './hash.js';
import {
    AFFECT_BRIEF_SCHEMA,
    affectProgramPrompt,
    buildAffectBrief,
    passageProposalsFor
} from './brief.js';
import {
    AFFECT_PROGRAM_SCHEMA,
    PROGRAM_REFUSALS,
    admitAffectProgram,
    saveAffectProgram
} from './program.js';

const TEXT = 'I celebrate myself, and sing myself. I am not happy.';

function phrasesOf(text, phraseFloor = true) {
    return chunkText(text, { mode: 'phrase', wpm: 220, phraseFloor })
        .filter(atom => atom.modality === 'text' && atom.content)
        .map(atom => atom.content);
}

function slot(value, source = 'inferred') {
    return { value, confidence: 0.4, source };
}

function state(dimensions) {
    return {
        version: 1,
        modality: 'text',
        dimensions,
        provenance: { method: 'hand' }
    };
}

function programFor(text, { phraseFloor = true, spans } = {}) {
    const phrases = phrasesOf(text, phraseFloor);
    return {
        schema: AFFECT_PROGRAM_SCHEMA,
        authority: 'proposed',
        textHash: contentHash(text),
        chunk: { mode: 'phrase', wpm: 220, phraseFloor },
        spans: spans || [{
            index: 0,
            text: phrases[0],
            state: state({ valence: slot(0.2) })
        }]
    };
}

function refusal(program, text) {
    try {
        admitAffectProgram(program, text);
        return null;
    } catch (error) {
        return error.code;
    }
}

describe('affect program gate', () => {
    it('admits a sparse program and leaves unnamed phrases absent', () => {
        const phrases = phrasesOf(TEXT);
        expect(phrases.length).toBeGreaterThan(1);
        const admitted = admitAffectProgram(programFor(TEXT), TEXT);
        expect(admitted.schema).toBe(AFFECT_PROGRAM_SCHEMA);
        expect(admitted.authority).toBe('proposed');
        expect(admitted.spans).toHaveLength(1);
        expect(admitted.spans[0].text).toBe(phrases[0]);
        expect(Object.isFrozen(admitted)).toBe(true);
    });

    it('refuses a phrase floor that no longer produces the stored phrase', () => {
        const atDefault = phrasesOf(TEXT, true);
        const withoutFloor = phrasesOf(TEXT, false);
        expect(atDefault.join('|')).not.toBe(withoutFloor.join('|'));
        const drifted = programFor(TEXT, { phraseFloor: true });
        drifted.chunk.phraseFloor = false;
        expect(refusal(drifted, TEXT)).toBe('AFFECT_PROGRAM_PHRASE');
    });

    it('refuses a hash, a measured source, an out-of-range value, and a null stored as a score', () => {
        const wrongHash = programFor(TEXT);
        wrongHash.textHash = '00000000';
        expect(refusal(wrongHash, TEXT)).toBe('AFFECT_PROGRAM_HASH');

        const measured = programFor(TEXT);
        measured.spans[0].state.dimensions.valence.source = 'measured';
        expect(refusal(measured, TEXT)).toBe('AFFECT_PROGRAM_MEASURED');

        const high = programFor(TEXT);
        high.spans[0].state.dimensions.valence.value = 2;
        expect(refusal(high, TEXT)).toBe('AFFECT_PROGRAM_STATE');

        const missing = programFor(TEXT);
        missing.spans[0].state.dimensions.valence.value = null;
        expect(refusal(missing, TEXT)).toBe('AFFECT_PROGRAM_STATE');
    });

    it('refuses a bad authority, a pace outside the reading window, and a phrase index the chunker did not make', () => {
        const authority = programFor(TEXT);
        authority.authority = 'published';
        expect(refusal(authority, TEXT)).toBe('AFFECT_PROGRAM_AUTHORITY');

        const pace = programFor(TEXT);
        pace.chunk.wpm = 20;
        expect(refusal(pace, TEXT)).toBe('AFFECT_PROGRAM_CHUNK');

        const missing = programFor(TEXT);
        missing.spans[0].index = 40;
        missing.spans[0].text = 'nowhere';
        expect(refusal(missing, TEXT)).toBe('AFFECT_PROGRAM_SPAN');
    });

    it('refuses an unknown field and a duplicate phrase', () => {
        const extra = programFor(TEXT);
        extra.note = 'hello';
        expect(refusal(extra, TEXT)).toBe('AFFECT_PROGRAM_UNKNOWN_FIELD');

        const phrases = phrasesOf(TEXT);
        const doubled = programFor(TEXT, {
            spans: [
                { index: 0, text: phrases[0], state: state({ valence: slot(0.1) }) },
                { index: 0, text: phrases[0], state: state({ valence: slot(0.2) }) }
            ]
        });
        expect(refusal(doubled, TEXT)).toBe('AFFECT_PROGRAM_DUPLICATE');
    });

    it('saves by marking the program user-authored and leaves the slot source alone', () => {
        const saved = saveAffectProgram(programFor(TEXT), TEXT);
        expect(saved.authority).toBe('user');
        expect(saved.spans[0].state.dimensions.valence.source).toBe('inferred');
        const again = saveAffectProgram(saved, TEXT);
        expect(again.authority).toBe('user');
    });

    it('admits an authored slot', () => {
        const hand = programFor(TEXT);
        hand.spans[0].state.dimensions.valence.source = 'authored';
        const admitted = admitAffectProgram(hand, TEXT);
        expect(admitted.spans[0].state.dimensions.valence.source).toBe('authored');
    });
});

describe('affect brief', () => {
    it('exports phrase proposals beside the text, not as a program', () => {
        const brief = buildAffectBrief(TEXT);
        expect(brief.schema).toBe(AFFECT_BRIEF_SCHEMA);
        expect(brief.textHash).toBe(contentHash(TEXT));
        expect(brief.phrases.length).toBe(phrasesOf(TEXT).length);
        expect(brief.proposals).toHaveLength(brief.phrases.length);
        expect(brief.proposals[0].role).toBe('proposal');
        expect(brief.proposals[0].grain).toBe('phrase');
        expect(brief.proposals[0].modelId).toBe('contextual-window-v1');
        expect(brief.schema).not.toBe(AFFECT_PROGRAM_SCHEMA);
    });

    it('attaches a passage-level score only when the whole text matches', () => {
        const catalog = [{
            text: TEXT,
            modelId: 'edsi-umd/PERT-EmoPair',
            raw: { valence: 3.6, arousal: 0.4, dominance: 0.3 }
        }];
        const hit = passageProposalsFor(TEXT, catalog);
        expect(hit).toEqual([{
            modelId: 'edsi-umd/PERT-EmoPair',
            role: 'proposal',
            grain: 'passage',
            raw: { valence: 3.6, arousal: 0.4, dominance: 0.3 }
        }]);
        expect(passageProposalsFor('A different sentence.', catalog)).toEqual([]);
        const brief = buildAffectBrief(TEXT, { passageProposals: hit });
        expect(brief.passageProposals).toEqual(hit);
    });

    it('names every axis and every refusal in the prompt', () => {
        const prompt = affectProgramPrompt();
        for (const dimension of DIMENSIONS) expect(prompt).toContain(dimension.id);
        for (const code of PROGRAM_REFUSALS) expect(prompt).toContain(code);
        expect(prompt).toContain(AFFECT_PROGRAM_SCHEMA);
        expect(prompt).toContain('proposed');
    });
});
