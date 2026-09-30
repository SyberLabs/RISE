import { describe, expect, it } from 'vitest';
import { compileSession, normalizeVisualConfig } from './session-compiler.js';
import {
    SESSION_FIELD_ROLES,
    successorConfig,
    unclassifiedSessionFields
} from './session-successor.js';

const FIRST = 'The first division says one thing. It says it plainly.';
const SECOND = 'The second division says another. It follows the first.';

// Every reading-level field set to something other than its default, so a
// field the successor forgets to carry shows up as a difference.
const READER_SETTINGS = {
    wpm: 410,
    chunkMode: 'phrase',
    curve: 'ascent',
    displayMode: 'stack',
    audioPreset: 'focus',
    soundscape: 'aurora',
    entrainmentMode: 'isochronic',
    entrainmentWaveform: 'triangle',
    revealMode: 'progressive',
    voiceId: 'am_michael',
    selectedSwellId: 'swell-a',
    intent: 'a slow evening reading',
    projection: 'page',
    presentation: { chamberFace: 'literary', bandOffset: -0.25 },
    customVisuals: ['data:image/png;base64,AAAA'],
    isCustom: true,
    provenance: { kind: 'received', note: 'from the shelf' },
    origin: { view: 'library', name: 'Library' },
    visualConfig: { visualMode: 'interlocution', enabled: true }
};

function first(extra = {}) {
    return compileSession({ title: 'First', text: FIRST, ...READER_SETTINGS, ...extra });
}

describe('a field of the compiled Session has exactly one role', () => {
    it('classifies every field a compiled session carries', () => {
        expect(unclassifiedSessionFields(first())).toEqual([]);
    });

    it('names a field that was added to the Session and not classified', () => {
        const session = first();
        session.aNewThingTheSessionLearned = true;
        expect(unclassifiedSessionFields(session)).toEqual(['aNewThingTheSessionLearned']);
    });

    it('lists no field that a compiled session does not carry', () => {
        const carried = new Set(Object.keys(first()));
        const listed = Object.values(SESSION_FIELD_ROLES).flat();
        expect(listed.filter(key => !carried.has(key))).toEqual([]);
    });

    it('puts no field in two roles', () => {
        const listed = Object.values(SESSION_FIELD_ROLES).flat();
        expect(new Set(listed).size).toBe(listed.length);
    });
});

describe('the successor is the same reading over the next text', () => {
    const successor = () => compileSession(successorConfig(first(), {
        title: 'Second',
        text: SECOND,
        textSource: 'Second'
    }));

    it('reads the next text and not the previous one', () => {
        const words = successor().atoms.map(atom => atom.content).join(' ');
        expect(words).toContain('second division');
        expect(words).not.toContain('first division');
    });

    it('carries every setting the reader chose', () => {
        const before = first();
        const after = successor();
        for (const key of SESSION_FIELD_ROLES.reading) {
            // The compiler normalizes the visual config on every pass and a
            // second pass adds a default the first left implicit (an explicit
            // word-fill border), so the carried value is what one more pass
            // of the compiler makes of it.
            const expected = key === 'visualConfig'
                ? normalizeVisualConfig(before[key])
                : before[key];
            expect(after[key], key).toEqual(expected);
        }
    });

    it('does not carry an anchor written against the previous text', () => {
        const source = compileSession({
            title: 'Anchored',
            text: FIRST,
            experienceProgram: {
                schema: 'rise.experience-program.v1',
                id: 'anchored',
                authority: 'user',
                editable: true,
                tracks: [
                    {
                        id: 'movements', kind: 'movement',
                        clips: [{ id: 'm1', anchor: { sourceIds: ['primary'] }, data: { index: 0, title: 'First' } }]
                    },
                    {
                        id: 'v', kind: 'visual', fallback: { kind: 'still' },
                        clips: [{
                            id: 'c1',
                            anchor: { sourceIds: ['primary'], fromToken: 0, toToken: 3,
                                quoteStart: 'The first', quoteEnd: 'first division' },
                            cue: { kind: 'still' }
                        }]
                    }
                ]
            }
        });
        expect(source.experienceProgram).not.toBeNull();
        const next = compileSession(successorConfig(source, { title: 'Second', text: SECOND }));
        expect(next.experienceProgram).toBeNull();
        expect(next.visualProgram).toBeNull();
    });

    it('takes the pointer, verse setting, and colours the caller supplies', () => {
        const config = successorConfig(first(), {
            title: 'Second',
            text: SECOND,
            verseLines: true,
            visualConfig: { visualMode: 'off', consentScope: 'fresh' }
        });
        expect(config.verseLines).toBe(true);
        expect(config.visualConfig.consentScope).toBe('fresh');
    });
});
