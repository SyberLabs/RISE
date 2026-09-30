/**
 * The listener, against a fake recogniser.
 *
 * What is held: it listens from a press until the reader has stopped talking, and
 * not until the browser first thinks they have (a pause in the middle of a
 * sentence is not the end of it); everything said in that time is one utterance,
 * joined in order; it lets go of the microphone on every path (a silence, an
 * error, a timeout, a cancel, being destroyed); every failure is one of a closed
 * list of states with a sentence for the reader; it delivers an utterance once;
 * and a recogniser that was replaced cannot speak for the one that replaced it.
 */
import { describe, expect, it } from 'vitest';
import { createVirtualClock } from '../clock.js';
import { createFakeRecognition, open } from '../../test/fake-recognition.js';
import { createSpeechListener, describeMic, LISTEN_LIMITS, MIC_PRIVACY, MIC_STATES } from './listener.js';

const { silenceMs: SILENCE, noSpeechMs: NOBODY, maxMs: LONGEST, stopMs: STOP } = LISTEN_LIMITS;

/** By default the recogniser ends by itself once asked to stop, as a browser does; `{ endsOnStop: false }` has it say nothing more. */
function setup(recognitionOptions = {}) {
    const Recognition = createFakeRecognition({ endsOnStop: true, ...recognitionOptions });
    const clock = createVirtualClock();
    const log = { states: [], interim: [], final: [] };
    const listener = createSpeechListener({
        Recognition, clock,
        onState: state => log.states.push(state),
        onInterim: text => log.interim.push(text),
        onFinal: text => log.final.push(text)
    });
    return { Recognition, clock, listener, log, current: () => Recognition.instances.at(-1) };
}

/** What the recogniser holds after each thing said: every result so far, each final or not. */
const said = (...parts) => parts.map(part => (Array.isArray(part)
    ? Object.assign([{ transcript: part[0], confidence: 0.9 }], { isFinal: part[1] === true })
    : Object.assign([{ transcript: part, confidence: 0.9 }], { isFinal: false })));
const hear = (recognition, ...parts) => recognition.say('', { results: said(...parts) });

describe('one utterance', () => {
    it('begins on a press, hears the words as they come, and delivers them once, after the reader has gone quiet', async () => {
        const { listener, log, current, Recognition, clock } = setup();
        expect(listener.state).toBe('idle');
        expect(listener.start()).toBe(true);
        expect(listener.state).toBe('starting');
        current().begin();
        expect(listener.state).toBe('listening');
        // Continuous, so that the browser does not decide for the reader when they are done.
        expect(current()).toMatchObject({ lang: 'en-US', continuous: true, interimResults: true, maxAlternatives: 1 });

        hear(current(), 'wait dive');
        expect(log.interim).toEqual(['wait dive']);
        hear(current(), ['wait dive on event horizon', true]);
        expect(log.final).toEqual([]);
        await clock.advance(SILENCE - 1);
        expect(log.final).toEqual([]);
        await clock.advance(1);
        expect(log.final).toEqual(['wait dive on event horizon']);
        expect(listener.state).toBe('idle');
        expect(open(Recognition)).toEqual([]);
        // Asked to finish, not aborted: an abort throws away what the browser is still working out.
        expect(current().stopped).toBe(true);
        expect(clock.pending()).toBe(0);

        // A late repeat from a recogniser that was already let go says nothing.
        current().say('again', { final: true });
        await clock.advance(SILENCE * 2);
        expect(log.final).toEqual(['wait dive on event horizon']);
    });

    it('does not take a pause in the middle of a sentence for the end of it, and joins what is said either side', async () => {
        const { listener, log, current, clock } = setup();
        listener.start();
        current().begin();
        hear(current(), ['wait', true]);
        await clock.advance(SILENCE - 400);
        expect(log.final).toEqual([]);
        hear(current(), ['wait', true], 'dive on event horizon');
        await clock.advance(SILENCE - 400);
        expect(log.final).toEqual([]);
        hear(current(), ['wait', true], ['dive on event horizon', true]);
        await clock.advance(SILENCE);
        expect(log.final).toEqual(['wait dive on event horizon']);
    });

    it('says each thing heard once, though the recogniser repeats itself, and still counts the repeat as the reader not yet being quiet', async () => {
        const { listener, log, current, clock } = setup();
        listener.start();
        current().begin();
        hear(current(), 'same words');
        await clock.advance(SILENCE - 100);
        hear(current(), 'same words');
        expect(log.interim).toEqual(['same words']);
        await clock.advance(SILENCE - 100);
        expect(log.final).toEqual([]);
        await clock.advance(100);
        expect(log.final).toEqual(['same words']);
    });

    it('starts the wait afresh whenever more is heard, interim words included', async () => {
        const { listener, log, current, clock } = setup();
        listener.start();
        current().begin();
        for (let i = 1; i <= 6; i += 1) {
            hear(current(), 'words '.repeat(i).trim());
            await clock.advance(SILENCE - 100);
        }
        expect(log.final).toEqual([]);
        await clock.advance(100);
        expect(log.final).toEqual(['words words words words words words']);
    });

    it('joins every result in order, however the recogniser spaces them, and uses the latest version of one it revised', async () => {
        const { listener, log, current, clock } = setup();
        listener.start();
        current().begin();
        hear(current(), ['go', true], ' back', ' please');
        hear(current(), ['go', true], [' back to', true], ['please ', false]);
        hear(current(), ['go', true], [' back to the', true], ['  start ', true]);
        await clock.advance(SILENCE);
        expect(log.final).toEqual(['go back to the start']);
        expect(log.interim).toEqual(['go back please', 'go back to please', 'go back to the start']);
    });

    it('does nothing if asked to start while it is already listening, and starts one recogniser only', () => {
        const { listener, Recognition, current } = setup();
        expect(listener.start()).toBe(true);
        current().begin();
        expect(listener.start()).toBe(true);
        expect(Recognition.instances).toHaveLength(1);
        expect(listener.listening).toBe(true);
    });

    it('can listen again after an utterance, with a fresh recogniser', async () => {
        const { listener, log, Recognition, current, clock } = setup();
        for (const words of ['first', 'second']) {
            listener.start();
            current().begin();
            hear(current(), [words, true]);
            await clock.advance(SILENCE);
        }
        expect(log.final).toEqual(['first', 'second']);
        expect(Recognition.instances).toHaveLength(2);
        expect(open(Recognition)).toEqual([]);
    });

});

describe('when nothing is said, or the browser ends the listening itself', () => {
    it('says nothing was heard if nobody has spoken after a long while, and lets go of the microphone', async () => {
        const { listener, log, current, clock, Recognition } = setup();
        listener.start();
        current().begin();
        await clock.advance(NOBODY - 1);
        expect(listener.state).toBe('listening');
        await clock.advance(1);
        expect(listener.state).toBe('no-speech');
        expect(log.final).toEqual([]);
        expect(open(Recognition)).toEqual([]);
        expect(clock.pending()).toBe(0);
    });

    it('does not say nobody spoke once someone has, however long they then take', async () => {
        const { listener, log, current, clock } = setup();
        listener.start();
        current().begin();
        await clock.advance(NOBODY - 100);
        hear(current(), 'hello');
        await clock.advance(NOBODY);
        expect(listener.state).toBe('idle');
        expect(log.final).toEqual(['hello']);
    });

    it('delivers what was heard when the browser ends the listening by itself, without waiting for a silence', async () => {
        const { listener, log, current, clock, Recognition } = setup();
        listener.start();
        current().begin();
        hear(current(), ['wait', true], 'dive on the horizon');
        current().end();
        expect(log.final).toEqual(['wait dive on the horizon']);
        expect(listener.state).toBe('idle');
        expect(open(Recognition)).toEqual([]);
        expect(clock.pending()).toBe(0);
    });

    it('says nothing was heard when the recogniser ends with no words and no error', () => {
        const { listener, current, Recognition } = setup();
        listener.start();
        current().begin();
        current().end();
        expect(listener.state).toBe('no-speech');
        expect(open(Recognition)).toEqual([]);
    });

    it('says nothing was heard, not that something was, for results that are only blanks', async () => {
        const { listener, log, current, clock } = setup();
        listener.start();
        current().begin();
        hear(current(), ['   ', true], '');
        current().end();
        expect(listener.state).toBe('no-speech');
        expect(log.final).toEqual([]);
        expect(clock.pending()).toBe(0);
    });
});

describe('every way it can go wrong is said, and lets go of the microphone', () => {
    const CASES = [
        ['not-allowed', 'denied'], ['service-not-allowed', 'denied'], ['audio-capture', 'no-microphone'], ['no-speech', 'no-speech'],
        ['network', 'network'], ['language-not-supported', 'error'], ['bad-grammar', 'error'], ['something-new', 'error']
    ];
    for (const [error, state] of CASES) {
        it(`${error} becomes "${state}", with a sentence, and nothing is left open`, () => {
            const { listener, log, current, Recognition, clock } = setup();
            listener.start();
            current().begin();
            hear(current(), ['go back', true]);
            current().fail(error);
            expect(listener.state).toBe(state);
            expect(log.states.at(-1)).toBe(state);
            expect(describeMic(state).length).toBeGreaterThan(5);
            expect(open(Recognition)).toEqual([]);
            expect(log.final).toEqual([]);
            expect(clock.pending()).toBe(0);
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
    it('stops at the limit however much is being said, and takes what was said so far', async () => {
        const { listener, clock, current, log } = setup({ endsOnStop: false });
        listener.start();
        current().begin();
        for (let t = 0; t < LONGEST; t += 1_000) {
            hear(current(), `still talking ${t}`);
            expect(current().stopped).toBe(false);
            await clock.advance(1_000);
        }
        expect(current().stopped).toBe(true);
        hear(current(), ['cut off', true]);
        current().end();
        expect(log.final).toEqual(['cut off']);
        expect(clock.pending()).toBe(0);
    });

    it('lets go if the limit passes and the browser will not stop', async () => {
        const { listener, clock, current, Recognition, log } = setup();
        listener.start();
        current().begin();
        current().stop = () => { throw new Error('cannot stop'); };
        for (let t = 0; t < LONGEST; t += 1_000) {
            hear(current(), 'something');
            await clock.advance(1_000);
        }
        expect(listener.state).toBe('idle');
        expect(log.final).toEqual(['something']);
        expect(open(Recognition)).toEqual([]);
    });
});

describe('stopping', () => {
    it('stop asks the browser to finish, and takes what it then says', async () => {
        const { listener, current, log, clock } = setup({ endsOnStop: false });
        listener.start();
        current().begin();
        hear(current(), 'as far as it');
        listener.stop();
        expect(current().stopped).toBe(true);
        hear(current(), ['as far as it got', true]);
        current().end();
        expect(log.final).toEqual(['as far as it got']);
        expect(clock.pending()).toBe(0);
    });

    it('stop gives the browser the time it was promised to finish, and a guess that arrives then does not shorten it', async () => {
        const { listener, current, log, clock } = setup({ endsOnStop: false });
        listener.start();
        current().begin();
        listener.stop();
        await clock.advance(100);
        hear(current(), 'go ba');
        // The silence timer of a listener still listening would have ended it by now.
        await clock.advance(SILENCE + 50);
        expect(log.final).toEqual([]);
        hear(current(), ['go back', true]);
        current().end();
        expect(log.final).toEqual(['go back']);
    });

    it('stop at the last moment of the wait for a first word still gets the promised time to answer', async () => {
        const { listener, current, log, clock } = setup({ endsOnStop: false });
        listener.start();
        current().begin();
        await clock.advance(NOBODY - 500);
        listener.stop();
        await clock.advance(1_000);
        expect(listener.state).toBe('listening');
        hear(current(), ['go back', true]);
        current().end();
        expect(log.final).toEqual(['go back']);
    });

    it('stop does not leave the reader waiting on a browser that never ends: what was heard is taken after a short while', async () => {
        const { listener, current, log, clock, Recognition } = setup({ endsOnStop: false });
        listener.start();
        current().begin();
        hear(current(), ['go back', true]);
        listener.stop();
        expect(log.final).toEqual([]);
        await clock.advance(STOP);
        expect(log.final).toEqual(['go back']);
        expect(open(Recognition)).toEqual([]);
        expect(clock.pending()).toBe(0);
    });

    it('stop with nothing heard says nothing was heard', async () => {
        const { listener, current, clock } = setup({ endsOnStop: false });
        listener.start();
        current().begin();
        listener.stop();
        await clock.advance(STOP);
        expect(listener.state).toBe('no-speech');
    });

    it('cancel lets go at once and delivers nothing, even if words were heard and a silence is being waited out', async () => {
        const { listener, current, log, Recognition, clock } = setup();
        listener.start();
        current().begin();
        hear(current(), ['go back', true]);
        const cancelled = current();
        listener.cancel();
        expect(listener.state).toBe('idle');
        hear(cancelled, ['late', true]);
        await clock.advance(SILENCE * 3);
        expect(log.final).toEqual([]);
        expect(open(Recognition)).toEqual([]);
        expect(clock.pending()).toBe(0);
    });

    it('is safe to stop or cancel when nothing is happening, and more than once', () => {
        const { listener } = setup();
        expect(() => { listener.stop(); listener.cancel(); listener.cancel(); listener.destroy(); listener.destroy(); }).not.toThrow();
    });

    it('destroy lets go, delivers nothing, and refuses to start again', async () => {
        const { listener, Recognition, current, clock, log } = setup();
        listener.start();
        current().begin();
        hear(current(), ['go back', true]);
        listener.destroy();
        await clock.advance(SILENCE * 3);
        expect(open(Recognition)).toEqual([]);
        expect(clock.pending()).toBe(0);
        expect(log.final).toEqual([]);
        expect(listener.start()).toBe(false);
        expect(Recognition.instances).toHaveLength(1);
    });
});

describe('what the browser settles on, not what it first guessed', () => {
    it('on silence asks it to finish, and delivers the settled words rather than the first guess', async () => {
        const { listener, current, log, clock } = setup({ endsOnStop: false });
        listener.start();
        current().begin();
        hear(current(), 'go bag');
        await clock.advance(SILENCE);
        expect(current().stopped).toBe(true);
        expect(current().aborted).toBe(false);
        expect(log.final).toEqual([]);
        hear(current(), ['go back', true]);
        current().end();
        expect(log.final).toEqual(['go back']);
        expect(clock.pending()).toBe(0);
    });

    it('takes the guess it had, after the time it was promised, if the browser never settles', async () => {
        const { listener, current, log, clock } = setup({ endsOnStop: false });
        listener.start();
        current().begin();
        hear(current(), 'go bag');
        await clock.advance(SILENCE + STOP - 1);
        expect(log.final).toEqual([]);
        await clock.advance(1);
        expect(log.final).toEqual(['go bag']);
    });

    it('does not restart the silence for what arrives while it is finishing', async () => {
        const { listener, current, log, clock } = setup({ endsOnStop: false });
        listener.start();
        current().begin();
        hear(current(), 'go ba');
        await clock.advance(SILENCE);
        await clock.advance(STOP - 100);
        hear(current(), 'go bac');
        await clock.advance(100);
        expect(log.final).toEqual(['go bac']);
    });

    it('a second press while it is finishing does not ask twice or extend the wait', async () => {
        const { listener, current, log, clock } = setup({ endsOnStop: false });
        listener.start();
        current().begin();
        hear(current(), 'go back');
        let asked = 0;
        current().stop = () => { asked += 1; };
        listener.stop();
        await clock.advance(STOP - 100);
        listener.stop();
        await clock.advance(100);
        expect(asked).toBe(1);
        expect(log.final).toEqual(['go back']);
    });

    it('leaves no timer behind if the browser ends the moment it is asked to stop', () => {
        const { listener, current, log, clock } = setup();
        listener.start();
        current().begin();
        hear(current(), ['go back', true]);
        const recogniser = current();
        recogniser.stop = () => recogniser.end();
        listener.stop();
        expect(log.final).toEqual(['go back']);
        expect(clock.pending()).toBe(0);
    });

    it('a guess the browser takes back is gone: nothing is delivered for it, by silence or by the end', async () => {
        for (const how of ['silence', 'end']) {
            const { listener, current, log, clock } = setup();
            listener.start();
            current().begin();
            hear(current(), 'go back');
            current().say('', { results: [] });
            if (how === 'end') current().end(); else await clock.advance(SILENCE + STOP);
            expect(log.final, how).toEqual([]);
            // Ended by the browser: nobody spoke. Otherwise it goes on listening, and the wait for a first word begins again.
            expect(listener.state, how).toBe(how === 'end' ? 'no-speech' : 'listening');
            if (how === 'silence') {
                await clock.advance(NOBODY);
                expect(listener.state).toBe('no-speech');
            }
            expect(clock.pending()).toBe(0);
        }
    });

    it('a guess taken back leaves only what stands, and the silence is counted from what stands', async () => {
        const { listener, current, log, clock } = setup();
        listener.start();
        current().begin();
        hear(current(), ['wait', true], 'dive now');
        await clock.advance(SILENCE - 100);
        hear(current(), ['wait', true]);
        await clock.advance(SILENCE - 100);
        expect(log.final).toEqual([]);
        await clock.advance(100);
        expect(log.final).toEqual(['wait']);
    });

    it('does not start the wait for a first word before the microphone is open', async () => {
        const { listener, current, clock } = setup();
        listener.start();
        await clock.advance(NOBODY * 2);
        expect(listener.state).toBe('starting');
        current().begin();
        await clock.advance(NOBODY - 1);
        expect(listener.state).toBe('listening');
    });

    it('does not deliver the last utterance again when the next press hears nothing', async () => {
        const { listener, current, log, clock, Recognition } = setup();
        listener.start();
        current().begin();
        hear(current(), ['go back', true]);
        await clock.advance(SILENCE);
        expect(log.final).toEqual(['go back']);
        listener.start();
        Recognition.instances.at(-1).begin();
        Recognition.instances.at(-1).end();
        expect(listener.state).toBe('no-speech');
        expect(log.final).toEqual(['go back']);
    });
});

describe('a recogniser that was replaced', () => {
    it('cannot speak for the one that replaced it', async () => {
        const { listener, Recognition, log, clock } = setup();
        listener.start();
        const first = Recognition.instances[0];
        first.begin();
        const held = [first.onresult, first.onerror, first.onend];
        listener.cancel();
        listener.start();
        const second = Recognition.instances[1];
        second.begin();
        hear(first, ['stale', true]);
        first.fail('network');
        first.end();
        // An event already on its way, holding the old handlers, is no better off.
        for (const handler of held) handler({ resultIndex: 0, results: said(['ghost', true]), error: 'network' });
        await clock.advance(SILENCE * 2);
        expect(log.final).toEqual([]);
        expect(listener.state).toBe('listening');
        hear(second, ['current', true]);
        await clock.advance(SILENCE);
        expect(log.final).toEqual(['current']);
        expect(log.interim).toEqual(['current']);
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

    it('says, while listening, that a pause is fine and that pressing again ends it', () => {
        expect(describeMic('listening')).toMatch(/pause/u);
        expect(describeMic('listening')).toMatch(/press/u);
    });

    it('says, before anyone presses, where their voice goes and what RISE receives', () => {
        expect(MIC_PRIVACY).toMatch(/browser maker/u);
        expect(MIC_PRIVACY).toMatch(/never receives audio/u);
        expect(MIC_PRIVACY).toMatch(/only while you/u);
    });

    it('survives a state listener that throws', async () => {
        const Recognition = createFakeRecognition();
        const clock = createVirtualClock();
        const listener = createSpeechListener({ Recognition, clock, onState: () => { throw new Error('bad'); } });
        listener.start();
        Recognition.instances[0].begin();
        hear(Recognition.instances[0], ['x', true]);
        await expect(clock.advance(SILENCE)).resolves.not.toThrow();
    });
});
