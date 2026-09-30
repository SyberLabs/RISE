/**
 * What a reader said, as what they meant.
 *
 * The transcript is untrusted text from a recogniser. What is held: a small
 * closed grammar; the four unmistakable things are acted on and everything
 * else is not (a misheard word must not cost a reader their place or spend a
 * question); the reader's own words are what a Dive is asked with, minus the
 * interjection in front; nothing can throw; and the output is always clipped
 * text.
 */
import { describe, expect, it } from 'vitest';
import { cleanHeard, HEARD_LIMIT, interpret } from './interpret.js';

const intent = text => interpret(text).intent;

describe('the four things that are acted on', () => {
    it('surfaces on the words for going back, in any case and with any punctuation', () => {
        for (const text of ['Surface', 'surface.', 'SURFACE!', 'Go back', 'go back to the answer', 'Come back', 'return', 'Resurface', 'um, surface', 'Okay, go back please']) {
            expect(intent(text), text).toBe('surface');
        }
    });

    it('resumes on the words for carrying on', () => {
        for (const text of ['Resume', 'continue', 'Carry on', 'go on', 'keep going', 'Keep reading.', 'okay, continue', 'so carry on']) {
            expect(intent(text), text).toBe('resume');
        }
    });

    it('holds on the words for waiting, when that is the whole of what was said', () => {
        for (const text of ['Wait', 'wait!', 'Hold on', 'hang on.', 'Pause', 'Stop', 'one moment', 'just a second', 'Um, wait', 'okay hold on']) {
            expect(intent(text), text).toBe('hold');
        }
    });

    it('dives on an unmistakable request to look deeper, with what was said as the question', () => {
        const cases = [
            ['Wait — dive on event horizon', 'dive on event horizon'],
            ['dive on the event horizon', 'dive on the event horizon'],
            ['Hold on, dive into the event horizon', 'dive into the event horizon'],
            ['go deeper into that', 'go deeper into that'],
            ['Dive in the shadow of the black hole.', 'Dive in the shadow of the black hole.'],
            ['um, wait, dive about Hawking radiation', 'dive about Hawking radiation']
        ];
        for (const [said, question] of cases) {
            const result = interpret(said);
            expect(result.intent, said).toBe('dive');
            expect(result.question, said).toBe(question);
        }
    });

    it('dives on a plain question, and asks with the reader’s own words and case', () => {
        const cases = [
            ['What is the event horizon?', 'What is the event horizon?'],
            ['wait, why does light not escape', 'why does light not escape'],
            ['How far is it from the centre', 'How far is it from the centre'],
            ['Tell me more about Hawking', 'Tell me more about Hawking'],
            ['explain the shadow', 'explain the shadow'],
            ['Is that measured or predicted?', 'Is that measured or predicted?'],
            ['stop, what does that mean', 'what does that mean']
        ];
        for (const [said, question] of cases) {
            const result = interpret(said);
            expect(result.intent, said).toBe('dive');
            expect(result.question, said).toBe(question);
        }
    });
});

describe('what is not acted on', () => {
    it('says "other", and asks nothing, for anything that is not one of the above', () => {
        for (const text of ['the horizon is interesting', 'banana', 'yes', 'no', 'thank you', 'hmm', 'mm-hm', 'louder', 'the cat sat', 'stop it right now please']) {
            const result = interpret(text);
            expect(result.intent, text).toBe('other');
            expect(result).not.toHaveProperty('question');
        }
    });

    it('does not dive on "dive" with nothing after it, because that asks about nothing', () => {
        for (const text of ['dive', 'dive on', 'wait, dive', 'go deeper', 'dive into.']) expect(intent(text), text).toBe('other');
    });

    it('does not hold on a sentence that merely begins with a hold word and says more, unless it is a question', () => {
        expect(intent('wait for the light to arrive')).toBe('other');
        expect(intent('stop the presses')).toBe('other');
    });

    it('says "none" for silence, whitespace, or only filler', () => {
        for (const text of ['', '   ', '\n\t', 'um', 'uh, er', 'ok', undefined, null]) expect(intent(text), String(text)).toBe('none');
    });
});

describe('untrusted words', () => {
    it('never throws, and always answers with one of the five intents, for anything at all', () => {
        const junk = [42, {}, [], () => 1, Symbol.iterator.toString(), '\u0000\u0007', 'x'.repeat(100_000), '\ud800', '😀'.repeat(50),
            'wait'.repeat(1000), '<script>alert(1)</script>', '__proto__', 'constructor', '‮wait‬', 'w​ait'];
        for (const text of junk) {
            const result = interpret(text);
            expect(['none', 'surface', 'resume', 'hold', 'dive', 'other']).toContain(result.intent);
            expect(typeof result.heard).toBe('string');
            expect(result.heard.length).toBeLessThanOrEqual(HEARD_LIMIT);
        }
    });

    it('takes a control or a zero-width character in the middle of a word as not that word', () => {
        for (const text of ['wa\u0000it', 'wa​it', 'sur‮face', 'con\u0007tinue']) expect(intent(text), JSON.stringify(text)).toBe('other');
    });

    it('clips what it heard, and what it asks with, to a limit, and strips controls from both', () => {
        const long = `dive on ${'a'.repeat(2_000)}`;
        const result = interpret(long);
        expect(result.intent).toBe('dive');
        expect(result.heard.length).toBe(HEARD_LIMIT);
        expect(result.question.length).toBeLessThanOrEqual(HEARD_LIMIT);
        expect(cleanHeard('a\u0000b‮c😀')).toBe('a b c😀'.replace('‮', ' ').replace(/\s+/g, ' '));
        expect(cleanHeard('  spaced   out \n words ')).toBe('spaced out words');
    });

    it('carries nothing but text: a question is a plain string, never markup that is made anything of', () => {
        const result = interpret('what is <img src=x onerror=alert(1)>?');
        expect(result.intent).toBe('dive');
        expect(typeof result.question).toBe('string');
        expect(result.question).toBe('what is <img src=x onerror=alert(1)>?');
    });

    it('is deterministic', () => {
        for (const text of ['Wait — dive on event horizon', 'banana', 'surface']) expect(interpret(text)).toEqual(interpret(text));
    });
});
