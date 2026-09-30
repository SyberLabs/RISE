/**
 * The listener, against a fake recogniser.
 *
 * What is held: it listens only between a press and the end of one utterance;
 * it lets go of the microphone on every path (a result, an error, a silence, a
 * timeout, a cancel, being destroyed); every failure is one of a closed list
 * of states with a sentence for the reader; it delivers an utterance once; and
 * a recogniser that was replaced cannot speak for the one that replaced it.
 */
import { describe, expect, it } from 'vitest';
import { createVirtualClock } from '../clock.js';
import { createFakeRecognition, open } from '../../test/fake-recognition.js';
import { createSpeechListener, describeMic, MIC_PRIVACY, MIC_STATES } from './listener.js';

function setup(recognitionOptions = {}, options = {}) {
    const Recognition = createFakeRecognition(recognitionOptions);
    const clock = createVirtualClock();
    const log = { states: [], interim: [], final: [] };
    const listener = createSpeechListener({
        Recognition, clock, ...options,
        onState: state => log.states.push(state),
        onInterim: text => log.interim.push(text),
        onFinal: text => log.final.push(text)
    });
    return { Recognition, clock, listener, log, current: () => Recognition.instances.at(-1) };
}

describe('one utterance', () => {
    it('begins on a press, hears interim words, delivers the final ones once, and lets go of the microphone before anything acts on them', () => {
        const { listener, log, current, Recognition } = setup();
        expect(listener.state).toBe('idle');
        expect(listener.start()).toBe(true);
        expect(listener.state).toBe('starting');
        current().begin();
        expect(listener.state).toBe('listening');
        expect(current()).toMatchObject({ lang: 'en-US', continuous: false, interimResults: true, maxAlternatives: 1 });

        current().say('wait dive');
        current().say('wait dive on event horizon', { final: true });
        expect(log.interim).toEqual(['wait dive']);
        expect(log.final).toEqual(['wait dive on event horizon']);
        expect(listener.state).toBe('idle');
        expect(open(Recognition)).toEqual([]);
        expect(current().aborted).toBe(true);

        // A late repeat of the same result, from a recogniser that was already let go, says nothing.
        const finished = current();
        finished.say('again', { final: true });
        expect(log.final).toEqual(['wait dive on event horizon']);
    });

    it('takes the final words from a result list that also holds earlier ones', () => {
        const { listener, log, current } = setup();
        listener.start();
        current().begin();
        const interim = Object.assign([{ transcript: 'earlier ' }], { isFinal: false });
        const final = Object.assign([{ transcript: 'the final words' }], { isFinal: true });
        current().say('', { results: [interim, final], index: 1 });
        expect(log.final).toEqual(['the final words']);
    });

    it('does nothing if asked to start while it is already listening, and starts one recogniser only', () => {
        const { listener, Recognition, current } = setup();
        expect(listener.start()).toBe(true);
        current().begin();
        expect(listener.start()).toBe(true);
        expect(Recognition.instances).toHaveLength(1);
        expect(listener.listening).toBe(true);
    });

    it('can listen again after an utterance, with a fresh recogniser', () => {
        const { listener, log, Recognition, current } = setup();
        for (const words of ['first', 'second']) {
            listener.start();
            current().begin();
            current().say(words, { final: true });
        }
        expect(log.final).toEqual(['first', 'second']);
        expect(Recognition.instances).toHaveLength(2);
        expect(open(Recognition)).toEqual([]);
    });
});

describe('every way it can go wrong is said, and lets go of the microphone', () => {
    const CASES = [
        ['not-allowed', 'denied'], ['service-not-allowed', 'denied'], ['audio-capture', 'no-microphone'], ['no-speech', 'no-speech'],
        ['network', 'network'], ['language-not-supported', 'error'], ['bad-grammar', 'error'], ['something-new', 'error']
    ];
    for (const [error, state] of CASES) {
        it(`${error} becomes "${state}", with a sentence, and nothing is left open`, () => {
            const { listener, log, current, Recognition } = setup();
            listener.start();
            current().begin();
            current().fail(error);
            expect(listener.state).toBe(state);
            expect(log.states.at(-1)).toBe(state);
            expect(describeMic(state).length).toBeGreaterThan(5);
            expect(open(Recognition)).toEqual([]);
            expect(log.final).toEqual([]);
            // The end that follows an error does not turn it into something else.
            current().end();
            expect(listener.state).toBe(state);
        });
    }

    it('says "aborted" is nothing wrong: the reader stopped it', () => {
        const { listener, current } = setup();
        listener.start();
        current().begin();
        current().fail('aborted');
        expect(listener.state).toBe('idle');
    });

    it('says nothing was heard when the recogniser ends with no words and no error', () => {
        const { listener, current, Recognition } = setup();
        listener.start();
        current().begin();
        current().end();
        expect(listener.state).toBe('no-speech');
        expect(open(Recognition)).toEqual([]);
    });

    it('says it is unavailable, without throwing, where there is no recogniser', () => {
        const log = [];
        const listener = createSpeechListener({ Recognition: undefined, onState: state => log.push(state) });
        expect(listener.state).toBe('unavailable');
        expect(listener.start()).toBe(false);
        expect(log).toEqual([]);
        expect(describeMic('unavailable')).toMatch(/not available in this browser\. Type instead/u);
    });

    it('says so, and does not leave one open, if the browser refuses to construct or to start', () => {
        const constructing = setup({ throwOnConstruct: true });
        expect(constructing.listener.start()).toBe(false);
        expect(constructing.listener.state).toBe('error');
        const starting = setup({ throwOnStart: true });
        expect(starting.listener.start()).toBe(false);
        expect(starting.listener.state).toBe('error');
        expect(open(starting.Recognition)).toEqual([]);
        expect(starting.clock.pending()).toBe(0);
    });
});

describe('it never listens for long', () => {
    it('stops after the limit, and takes what was said so far', async () => {
        const { listener, clock, current, log } = setup({}, { maxMs: 5_000 });
        listener.start();
        current().begin();
        await clock.advance(4_999);
        expect(current().stopped).toBe(false);
        await clock.advance(1);
        expect(current().stopped).toBe(true);
        current().say('cut off', { final: true });
        expect(log.final).toEqual(['cut off']);
        expect(clock.pending()).toBe(0);
    });

    it('frees its timer when the utterance ends first', () => {
        const { listener, clock, current } = setup();
        listener.start();
        current().begin();
        current().say('done', { final: true });
        expect(clock.pending()).toBe(0);
    });

    it('lets go if the limit passes and the browser will not stop', async () => {
        const { listener, clock, current, Recognition } = setup({}, { maxMs: 1_000 });
        listener.start();
        current().begin();
        current().stop = () => { throw new Error('cannot stop'); };
        await clock.advance(1_000);
        expect(listener.state).toBe('idle');
        expect(open(Recognition)).toEqual([]);
    });
});

describe('stopping', () => {
    it('stop asks the browser to finish and take what was said', () => {
        const { listener, current, log } = setup();
        listener.start();
        current().begin();
        listener.stop();
        expect(current().stopped).toBe(true);
        current().say('as far as it got', { final: true });
        expect(log.final).toEqual(['as far as it got']);
    });

    it('cancel lets go at once and delivers nothing, even if the browser still has a result to give', () => {
        const { listener, current, log, Recognition, clock } = setup();
        listener.start();
        current().begin();
        const cancelled = current();
        listener.cancel();
        expect(listener.state).toBe('idle');
        cancelled.say('late', { final: true });
        expect(log.final).toEqual([]);
        expect(open(Recognition)).toEqual([]);
        expect(clock.pending()).toBe(0);
    });

    it('is safe to stop or cancel when nothing is happening, and more than once', () => {
        const { listener } = setup();
        expect(() => { listener.stop(); listener.cancel(); listener.cancel(); listener.destroy(); listener.destroy(); }).not.toThrow();
    });

    it('destroy lets go, and refuses to start again', () => {
        const { listener, Recognition, current, clock } = setup();
        listener.start();
        current().begin();
        listener.destroy();
        expect(open(Recognition)).toEqual([]);
        expect(clock.pending()).toBe(0);
        expect(listener.start()).toBe(false);
        expect(Recognition.instances).toHaveLength(1);
    });
});

describe('a recogniser that was replaced', () => {
    it('cannot speak for the one that replaced it', () => {
        const { listener, Recognition, log } = setup();
        listener.start();
        const first = Recognition.instances[0];
        first.begin();
        const held = [first.onresult, first.onerror, first.onend];
        listener.cancel();
        listener.start();
        const second = Recognition.instances[1];
        second.begin();
        first.say('stale', { final: true });
        first.fail('network');
        first.end();
        // An event already on its way, holding the old handlers, is no better off.
        for (const handler of held) handler({ resultIndex: 0, results: [Object.assign([{ transcript: 'ghost' }], { isFinal: true })], error: 'network' });
        expect(log.final).toEqual([]);
        expect(listener.state).toBe('listening');
        second.say('current', { final: true });
        expect(log.final).toEqual(['current']);
    });
});

describe('what the reader is told', () => {
    it('has a sentence for every state but idle, and none that is a code', () => {
        for (const state of MIC_STATES) {
            if (state === 'idle') expect(describeMic(state)).toBe('');
            else expect(describeMic(state)).toMatch(/[a-z]{3}/u);
        }
        expect(describeMic('made-up')).toBe(describeMic('error'));
    });

    it('says, before anyone presses, where their voice goes and what RISE receives', () => {
        expect(MIC_PRIVACY).toMatch(/browser maker/u);
        expect(MIC_PRIVACY).toMatch(/never receives audio/u);
        expect(MIC_PRIVACY).toMatch(/only while you/u);
    });

    it('survives a state listener that throws', () => {
        const Recognition = createFakeRecognition();
        const listener = createSpeechListener({ Recognition, clock: createVirtualClock(), onState: () => { throw new Error('bad'); } });
        expect(() => { listener.start(); Recognition.instances[0].begin(); Recognition.instances[0].say('x', { final: true }); }).not.toThrow();
    });
});
