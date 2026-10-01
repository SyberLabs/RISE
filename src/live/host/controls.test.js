/**
 * What the reader is told, and what the buttons ask for.
 *
 * The controls draw no reading and keep no time; they show what the runtime
 * says and ask the runtime for things. So the runtime here is a fake that
 * records what it was asked, and the assertions are about words and wiring:
 * every state has a plain sentence, a silent voice is never called speech,
 * a failure is said in words, and the buttons are the ones the state allows.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVirtualClock } from '../clock.js';
import { createFakeRecognition, open } from '../../test/fake-recognition.js';
import { createSpeechListener, describeMic, LISTEN_LIMITS, MIC_PRIVACY, MIC_PRIVACY_LEAD } from '../mic/listener.js';
import { interpret } from '../mic/interpret.js';
import { createLiveControls, describeStatus } from './controls.js';

const snapshot = (status, extra = {}) => ({
    status, error: null, main: { voiceDegraded: false, speaking: null, ...extra.main }, side: 'side' in extra ? extra.side : (status === 'diving' ? { finished: false, error: null } : null), ...(extra.error ? { error: extra.error } : {}),
    // In a Dive, the Dive the reader is in; `extra.dive` says otherwise.
    dive: extra.dive !== undefined ? extra.dive : (status === 'diving' ? { id: 'dive-1', turns: 1, opening: false } : null)
});

describe('the sentence for each state', () => {
    it('says a voice that makes no sound is pacing the reading, not speaking', () => {
        expect(describeStatus(snapshot('live', { main: { speaking: 'a' } }), { audible: true })).toBe('Speaking.');
        expect(describeStatus(snapshot('live', { main: { speaking: 'a' } }), { audible: false })).toBe('Reading, paced as if spoken.');
    });

    it('says when the voice has stopped and the reading has carried on without it', () => {
        const text = describeStatus(snapshot('live', { main: { voiceDegraded: true } }), { audible: true });
        expect(text).toMatch(/The voice stopped; the reading carries on at its own pace\./u);
        expect(text).not.toMatch(/^Speaking/u);
    });

    it('has a sentence for every state, and none of them is a code', () => {
        for (const status of ['starting', 'live', 'interrupted', 'diving', 'ended', 'failed', 'stopped']) {
            const text = describeStatus(snapshot(status, { error: { message: 'the provider failed' } }), { question: 'why' });
            expect(text.length, status).toBeGreaterThan(3);
            expect(text, status).not.toMatch(/undefined|null|\[object/u);
        }
        expect(describeStatus(snapshot('idle'))).toBe('');
    });

    it('names the question a Dive was asked, briefly, and says the parent is held', () => {
        const text = describeStatus(snapshot('diving'), { question: 'dive on event horizon' });
        expect(text).toContain('“dive on event horizon”');
        expect(text).toMatch(/held exactly where it was/u);
        expect(describeStatus(snapshot('diving'), { question: 'x'.repeat(500) }).length).toBeLessThan(260);
    });

    it('says, while a Dive is open, that a follow-up can be asked here and that Surface goes back, both while it is being answered and once it is', () => {
        const writing = describeStatus(snapshot('diving'), { question: 'q' });
        const answered = describeStatus(snapshot('diving', { side: { finished: true } }), { question: 'q' });
        for (const text of [writing, answered]) expect(text).toMatch(/follow-up.*Surface/u);
        expect(describeStatus(snapshot('diving', { side: { error: { message: 'no answer' } } }), { question: 'q' })).toBe('The Dive could not be answered (no answer). Ask again, or Surface to go back.');
        expect(describeStatus(snapshot('diving', { dive: { id: 'dive-1', turns: 2, opening: true }, side: null }), { question: 'q' })).toBe('Asking…');
        expect(describeStatus(snapshot('diving', { side: null }), { question: 'q' })).toMatch(/could not be opened.*Ask again, or Surface/u);
    });

    it('says a Dive is answered when it is, and that it could not be when it could not', () => {
        expect(describeStatus(snapshot('diving', { side: { finished: true } }), { question: 'q' })).toMatch(/answered. Ask a follow-up here, or Surface/u);
        expect(describeStatus(snapshot('diving', { side: { error: { message: 'no answer' } } }), { question: 'q' })).toMatch(/could not be answered \(no answer\)/u);
    });

    it('says why it failed, in the provider’s words and not a code', () => {
        expect(describeStatus(snapshot('failed', { error: { code: 'X', message: 'the key was refused' } }))).toBe('It could not be answered: the key was refused.');
    });
});

describe('an answer that stopped early', () => {
    const cut = { code: 'RESPONSE_MAX_TOKENS', message: 'The answer reached its length limit and was cut off.' };

    it('says so when the reading that arrived is finished, and that it can still be asked about', () => {
        const text = describeStatus(snapshot('ended', { main: { error: cut } }));
        expect(text).toBe('Finished reading what arrived. The answer stopped early: The answer reached its length limit and was cut off. You can still ask about any place in it.');
    });

    it('says so while what arrived is still being read, and keeps saying the voice stopped if it did', () => {
        expect(describeStatus(snapshot('live', { main: { error: cut, speaking: 'a' } }), { audible: false }))
            .toBe('Reading, paced as if spoken. The answer stopped early: The answer reached its length limit and was cut off.');
        expect(describeStatus(snapshot('live', { main: { error: cut, voiceDegraded: true } }), { audible: true }))
            .toBe('Reading. The answer stopped early: The answer reached its length limit and was cut off. The voice stopped; the reading carries on at its own pace.');
    });

    it('says nothing of it when nothing stopped early, in any state that says anything of it', () => {
        expect(describeStatus(snapshot('ended'))).toBe('Finished. You can still ask about any place in it.');
        expect(describeStatus(snapshot('live', { main: { speaking: 'a' } }), { audible: true })).toBe('Speaking.');
    });

    it('does not mix a Dive’s failure into the main answer’s: a Dive says its own', () => {
        const text = describeStatus(snapshot('diving', { side: { error: { message: 'no answer' } }, main: { error: cut } }), { question: 'q' });
        expect(text).toBe('The Dive could not be answered (no answer). Ask again, or Surface to go back.');
    });

    it('is only ever words: a hostile or missing message is clipped, or replaced by a plain one', () => {
        const long = describeStatus(snapshot('ended', { main: { error: { message: `${'x'.repeat(500)}.` } } }));
        expect(long.length).toBeLessThan(330);
        expect(describeStatus(snapshot('ended', { main: { error: {} } }))).toBe('Finished reading what arrived. The answer stopped early: the provider failed. You can still ask about any place in it.');
        expect(describeStatus(snapshot('ended', { main: { error: { message: 'Ends with no full stop' } } }))).toContain('stopped early: Ends with no full stop. You');
        expect(describeStatus(snapshot('ended', { main: { error: cut } }))).not.toMatch(/undefined|null|\[object/u);
    });
});

function fakeRuntime(initial = 'live') {
    const listeners = new Set();
    let state = snapshot(initial);
    const calls = [];
    const runtime = {
        get status() { return state.status; },
        snapshot: () => state,
        subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
        composed: role => ({ segments: role === 'side' ? [{ id: 'd1', text: 'a dive line', ended: true }] : [{ id: 's1', text: 'first line', ended: true }, { id: 's2', text: 'second line', ended: true }, { id: 's3', text: 'still being written', ended: false }] }),
        undercurrent: () => runtime.dives,
        dives: [],
        interrupt: vi.fn(async body => { calls.push(['interrupt', body]); runtime.set('interrupted'); }),
        hold: vi.fn(body => { if (state.status !== 'live') throw new Error('There is nothing to hold'); calls.push(['hold', body]); runtime.set('interrupted'); }),
        resume: vi.fn(() => { calls.push(['resume']); runtime.set('live'); }),
        dive: vi.fn(async body => { calls.push(['dive', body]); runtime.set('diving'); }),
        surface: vi.fn(async () => { calls.push(['surface']); runtime.set('live'); }),
        set(status, extra) { state = snapshot(status, extra); for (const fn of [...listeners]) fn(state); },
        /** The undercurrent changes while the state stays as it is. */
        setDives(dives) { runtime.dives = dives; for (const fn of [...listeners]) fn(state); },
        calls
    };
    return runtime;
}

let controls;
afterEach(() => {
    controls?.destroy();
    document.body.replaceChildren();
});

const $ = selector => document.querySelector(selector);
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('the buttons', () => {
    it('shows only what the state allows', () => {
        const runtime = fakeRuntime('live');
        controls = createLiveControls({ runtime, onStop: () => {} });
        expect($('[data-live="interrupt"]').hidden).toBe(false);
        expect($('[data-live="surface"]').hidden).toBe(true);
        expect($('[data-live="dive"]').disabled).toBe(false);

        runtime.set('diving');
        expect($('[data-live="surface"]').hidden).toBe(false);
        expect($('[data-live="interrupt"]').hidden).toBe(true);
        // Asked inside a Dive, a question is a follow-up, so it can still be asked.
        expect($('[data-live="dive"]').disabled).toBe(false);
        expect($('input[name="question"]').disabled).toBe(false);
        expect($('[data-live="dive"]').textContent).toBe('Ask again');
        expect($('[data-live="dive"]').getAttribute('aria-label')).toBe('Ask a follow-up in this Dive');
        runtime.set('diving', { dive: { id: 'dive-1', turns: 2, opening: true }, side: { phase: 'idle' } });
        expect($('[data-live="dive"]').disabled).toBe(true);
        expect($('input[name="question"]').disabled).toBe(true);

        runtime.set('starting');
        expect($('[data-live="dive"]').disabled).toBe(true);
        runtime.set('ended');
        expect($('[data-live="dive"]').disabled).toBe(false);
        expect($('[data-live="interrupt"]').hidden).toBe(true);
    });

    it('cannot ask a second Dive while the first is still connecting', () => {
        const runtime = fakeRuntime('live');
        controls = createLiveControls({ runtime, onStop: () => {} });
        runtime.set('live', { side: { phase: 'open', finished: false, error: null } });
        expect($('[data-live="dive"]').disabled).toBe(true);
        expect($('input[name="question"]').disabled).toBe(true);
    });

    it('turns Interrupt into Resume while held, and Resume carries on', async () => {
        const runtime = fakeRuntime('live');
        controls = createLiveControls({ runtime, onStop: () => {} });
        $('input[name="question"]').value = 'wait';
        $('[data-live="interrupt"]').click();
        await flush();
        expect(runtime.calls).toEqual([['interrupt', { text: 'wait' }]]);
        expect($('[data-live="resume"]').textContent).toBe('Resume');
        $('[data-live="resume"]').click();
        await flush();
        expect(runtime.calls.at(-1)).toEqual(['resume']);
        expect($('[data-live="interrupt"]').textContent).toBe('Interrupt');
    });

    it('asks a Dive with what was typed, empties the box, and refuses an empty question', async () => {
        const runtime = fakeRuntime('live');
        controls = createLiveControls({ runtime, onStop: () => {} });
        $('.live-controls__ask').requestSubmit();
        await flush();
        expect(runtime.dive).not.toHaveBeenCalled();

        $('input[name="question"]').value = '  dive on event horizon ';
        $('.live-controls__ask').requestSubmit();
        await flush();
        expect(runtime.dive).toHaveBeenCalledWith({ question: 'dive on event horizon' });
        expect($('input[name="question"]').value).toBe('');
        expect($('.live-controls__status').textContent).toContain('“dive on event horizon”');
    });

    it('Surface comes back, and Stop hands over to the host', async () => {
        const runtime = fakeRuntime('diving');
        const onStop = vi.fn();
        controls = createLiveControls({ runtime, onStop });
        $('[data-live="surface"]').click();
        await flush();
        expect(runtime.surface).toHaveBeenCalledTimes(1);
        $('[data-live="stop"]').click();
        await flush();
        expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('says in words what went wrong when the runtime refuses, and stays usable', async () => {
        const runtime = fakeRuntime('live');
        runtime.dive = vi.fn(async () => { throw new Error('A Dive is still opening'); });
        controls = createLiveControls({ runtime, onStop: () => {} });
        $('input[name="question"]').value = 'deeper';
        $('.live-controls__ask').requestSubmit();
        await flush();
        expect($('.live-controls__error').hidden).toBe(false);
        expect($('.live-controls__error').textContent).toBe('A Dive is still opening');
        expect($('[data-live="dive"]').disabled).toBe(false);
    });
});

describe('what is said so far', () => {
    it('lists only what has been committed, and the live region is the status alone', () => {
        const runtime = fakeRuntime('live');
        controls = createLiveControls({ runtime, onStop: () => {} });
        expect([...document.querySelectorAll('.live-controls__lines li')].map(li => li.textContent)).toEqual(['first line', 'second line']);
        expect($('.live-controls__status').getAttribute('role')).toBe('status');
        expect(document.querySelectorAll('[aria-live]').length).toBe(1);
        runtime.set('diving');
        expect([...document.querySelectorAll('.live-controls__lines li')].map(li => li.textContent)).toEqual(['a dive line']);
    });

    it('is a labelled region with a labelled field, and real buttons', () => {
        controls = createLiveControls({ runtime: fakeRuntime(), onStop: () => {} });
        expect($('#live-controls').getAttribute('aria-label')).toBeTruthy();
        expect($('label[for="live-controls-question"]').textContent).toMatch(/Ask about this place/u);
        for (const button of document.querySelectorAll('#live-controls button')) expect(button.tagName).toBe('BUTTON');
    });
});

describe('about this passage', () => {
    const richRuntime = () => {
        const runtime = fakeRuntime('live');
        const state = { status: 'live', main: { segmentId: 'a', voiceDegraded: false }, side: null, error: null };
        runtime.snapshot = () => state;
        runtime.composed = role => ({
            origin: { kind: 'model', name: 'Scripted answer', provider: 'mock' },
            segments: role === 'main' ? [
                {
                    id: 'a', text: 'In 2019 a telescope took an image.', ended: true,
                    state: { solemnity: 0.8, motionEnergy: 0.1 },
                    evidence: [
                        { id: 'e1', kind: 'supplied', title: 'The paper', location: 'Letters 875', uri: 'https://doi.org/10.3847/x', supports: { fromCharacter: 0, toCharacter: 7 } },
                        { id: 'e2', kind: 'model-proposed', title: 'Something remembered', uri: 'javascript:alert(1)' }
                    ],
                    dives: [{ id: 'n1', text: 'A note.', anchor: { fromCharacter: 8, toCharacter: 17 } }]
                },
                { id: 'b', text: 'Nothing cited here.', ended: true, state: {}, evidence: [], dives: [] }
            ] : [{ id: 's', text: 'A dive line', ended: true, state: {}, evidence: [], dives: [] }]
        });
        return { runtime, state };
    };

    it('says what a passage is meant to be, in coarse words, and that it says nothing about the reader', () => {
        const { runtime } = richRuntime();
        controls = createLiveControls({ runtime, onStop: () => {} });
        expect([...$('.live-passage__condition').children].map(li => li.textContent)).toEqual(['Motion: low', 'Solemnity: high']);
        expect($('.live-passage__note').textContent).toMatch(/says nothing about you/u);
    });

    it('lists sources with where they came from, links only a plain https address, and never a script address', () => {
        const { runtime } = richRuntime();
        controls = createLiveControls({ runtime, onStop: () => {} });
        const items = [...$('.live-passage__sources').children];
        expect(items).toHaveLength(2);
        expect(items[0].textContent).toContain('Provided with the answer');
        expect(items[0].textContent).toContain('The paper');
        expect(items[0].textContent).toContain('supports “In 2019”');
        const link = items[0].querySelector('a');
        expect(link.getAttribute('href')).toBe('https://doi.org/10.3847/x');
        expect(link.rel).toBe('noopener noreferrer');
        expect(link.target).toBe('_blank');
        expect(items[1].textContent).toContain('Proposed by the model, not checked');
        expect(items[1].querySelector('a')).toBeNull();
        expect(document.querySelector('#live-controls a[href^="javascript"]')).toBeNull();
    });

    it('says there is no source, in words, when there is none', () => {
        const { runtime, state } = richRuntime();
        state.main.segmentId = 'b';
        controls = createLiveControls({ runtime, onStop: () => {} });
        expect($('.live-passage__sources').textContent).toBe('No source was given for this passage.');
        expect($('.live-passage__condition').textContent).toMatch(/Nothing was said about how this passage is meant to be/u);
    });

    it('tells stable depth (a note written with the answer) from generative depth (a question asked now)', () => {
        const { runtime } = richRuntime();
        controls = createLiveControls({ runtime, onStop: () => {} });
        const depth = [...$('.live-passage__depth').children].map(li => li.textContent);
        expect(depth[0]).toMatch(/^Note written with the answer, about “.*”: A note.$/u);
        expect(depth.at(-1)).toMatch(/written now, for you, and marked as the model/u);
    });

    it('says a Dive was written when it was asked, and follows the reader to the side Current', () => {
        const { runtime, state } = richRuntime();
        controls = createLiveControls({ runtime, onStop: () => {} });
        expect($('.live-passage__origin').hidden).toBe(true);
        controls.destroy();
        state.status = 'diving';
        state.side = { segmentId: 's', finished: false };
        controls = createLiveControls({ runtime, onStop: () => {} });
        expect($('.live-passage__origin').hidden).toBe(false);
        expect($('.live-passage__origin').textContent).toBe('Written when you asked, by Scripted answer (mock). It does not change what you left.');
    });
});

describe('hostile words', () => {
    it('are shown as words: nothing a model says becomes an element, a handler or a style', () => {
        const runtime = fakeRuntime('live');
        const hostile = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script><style>body{display:none}</style>';
        runtime.composed = () => ({ segments: [{ text: hostile, ended: true }] });
        controls = createLiveControls({ runtime, onStop: () => {} });
        runtime.set('diving');
        const line = document.querySelector('.live-controls__lines li');
        expect(line.textContent).toBe(hostile);
        expect(document.querySelector('#live-controls img, #live-controls script, #live-controls style')).toBeNull();
        expect(window.__pwned).toBeUndefined();
        expect(line.children.length).toBe(0);
    });

    it('are shown as words in the status line and the error line too', async () => {
        const runtime = fakeRuntime('live');
        runtime.dive = vi.fn(async () => { throw new Error('<b onmouseover=x>bad</b>'); });
        controls = createLiveControls({ runtime, onStop: () => {} });
        document.querySelector('input[name="question"]').value = '<i>q</i>';
        document.querySelector('.live-controls__ask').requestSubmit();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(document.querySelector('.live-controls__error').textContent).toBe('<b onmouseover=x>bad</b>');
        expect(document.querySelector('.live-controls__error b')).toBeNull();
        expect(document.querySelector('.live-controls__status i')).toBeNull();
    });
});

describe('leaving', () => {
    it('removes itself, and stops listening, when destroyed, and destroying twice is fine', () => {
        const runtime = fakeRuntime();
        controls = createLiveControls({ runtime, onStop: () => {} });
        controls.destroy();
        controls.destroy();
        expect($('#live-controls')).toBeNull();
        expect(() => runtime.set('diving')).not.toThrow();
    });
});

describe('speaking to it', () => {
    const CLOCK = createVirtualClock();
    let Recognition;

    /** Real listener and grammar, a fake recogniser: everything but the browser's own hearing. */
    function withMic(status = 'live') {
        Recognition = createFakeRecognition({ endsOnStop: true });
        const runtime = fakeRuntime(status);
        const mic = {
            createListener: handlers => createSpeechListener({ Recognition, clock: CLOCK, ...handlers }),
            interpret, describe: describeMic, privacy: MIC_PRIVACY, privacyLead: MIC_PRIVACY_LEAD
        };
        controls = createLiveControls({ runtime, onStop: () => {}, mic });
        return runtime;
    }
    const recogniser = () => Recognition.instances.at(-1);
    const press = () => $('[data-live="listen"]').click();
    /** Said, then the quiet that ends it. */
    const hear = async words => { recogniser().begin(); recogniser().say(words, { final: true }); await CLOCK.advance(LISTEN_LIMITS.silenceMs); };
    const micLine = () => $('.live-controls__mic');

    it('has no Speak button, and no privacy text, where there is no microphone to use', () => {
        controls = createLiveControls({ runtime: fakeRuntime('live'), onStop: () => {} });
        expect($('[data-live="listen"]').hidden).toBe(true);
        expect($('.live-controls__mic-note').hidden).toBe(true);
    });

    it('says, before anyone presses, where their voice goes, and adds one live region for what it hears and no more', () => {
        withMic();
        expect(document.querySelectorAll('[aria-live]').length).toBe(2);
        expect(document.querySelector('.live-controls__lines').closest('[aria-live]')).toBeNull();
        expect($('.live-controls__mic-note').hidden).toBe(false);
        expect($('.live-controls__mic-note summary').textContent).toBe(MIC_PRIVACY_LEAD);
        expect($('.live-controls__mic-note p').textContent).toBe(MIC_PRIVACY);
        // The button is described by the full text, for anyone who cannot see the disclosure.
        expect($('[data-live="listen"]').getAttribute('aria-describedby')).toBe($('.live-controls__mic-note p').id);
        expect(MIC_PRIVACY_LEAD.length).toBeLessThan(60);
        expect(Recognition.instances).toHaveLength(0);
    });

    it('is offered when there is something to speak to, and not otherwise', () => {
        const runtime = withMic('live');
        const button = $('[data-live="listen"]');
        expect(button.hidden).toBe(false);
        for (const status of ['interrupted', 'diving', 'ended']) { runtime.set(status); expect(button.hidden, status).toBe(false); }
        for (const status of ['starting', 'failed', 'stopped', 'idle']) { runtime.set(status); expect(button.hidden, status).toBe(true); }
    });

    it('holds the reading before it listens, so the voice does not talk over the reader, and says it is listening', () => {
        const runtime = withMic('live');
        press();
        expect(runtime.calls).toEqual([['hold', undefined]]);
        expect($('[data-live="listen"]').getAttribute('aria-pressed')).toBe('true');
        recogniser().begin();
        expect(micLine().textContent).toMatch(/Listening/u);
        expect(micLine().hidden).toBe(false);
        recogniser().say('wait dive');
        expect(micLine().textContent).toBe('Hearing: “wait dive”');
    });

    it('takes the second press as "that is all I wanted to say"', () => {
        withMic('live');
        press();
        recogniser().begin();
        press();
        expect(recogniser().stopped).toBe(true);
        expect(Recognition.instances).toHaveLength(1);
    });

    it('dives on "wait, dive on event horizon", asking with the reader’s own words, and lets go of the microphone first', async () => {
        const runtime = withMic('live');
        press();
        await hear('Wait — dive on event horizon');
        await flush();
        expect(runtime.calls.at(-1)).toEqual(['dive', { question: 'dive on event horizon' }]);
        expect(runtime.status).toBe('diving');
        expect(open(Recognition)).toEqual([]);
        expect($('[data-live="listen"]').getAttribute('aria-pressed')).toBe('false');
        expect(micLine().hidden).toBe(true);
    });

    it('dives on a plain question, from a reading that was already held', async () => {
        const runtime = withMic('interrupted');
        press();
        expect(runtime.hold).not.toHaveBeenCalled();
        await hear('why does light not escape?');
        await flush();
        expect(runtime.calls.at(-1)).toEqual(['dive', { question: 'why does light not escape?' }]);
    });

    it('surfaces on "go back", from inside a Dive', async () => {
        const runtime = withMic('diving');
        press();
        expect(runtime.hold).not.toHaveBeenCalled();
        await hear('go back');
        await flush();
        expect(runtime.surface).toHaveBeenCalledTimes(1);
        expect(runtime.status).toBe('live');
    });

    it('resumes on "continue", and on a press that turned out to say nothing', async () => {
        const runtime = withMic('live');
        press();
        await hear('continue');
        await flush();
        expect(runtime.calls.map(call => call[0])).toEqual(['hold', 'resume']);

        press();
        await hear('um');
        await flush();
        expect(runtime.calls.map(call => call[0])).toEqual(['hold', 'resume', 'hold', 'resume']);
        expect(runtime.status).toBe('live');
    });

    it('stays held on "wait", and does not ask anything', async () => {
        const runtime = withMic('live');
        press();
        await hear('wait');
        await flush();
        expect(runtime.status).toBe('interrupted');
        expect(runtime.dive).not.toHaveBeenCalled();
        expect(runtime.resume).not.toHaveBeenCalled();
    });

    it('does not act on what it cannot be sure of: it holds, shows the words in the box, and leaves asking to the reader', async () => {
        const runtime = withMic('live');
        press();
        await hear('the horizon is interesting');
        await flush();
        expect(runtime.dive).not.toHaveBeenCalled();
        expect(runtime.status).toBe('interrupted');
        expect($('input[name="question"]').value).toBe('the horizon is interesting');
        expect(micLine().textContent).toBe('Heard “the horizon is interesting”. Press Dive to ask it, or Resume.');
        // The reader then decides.
        $('.live-controls__ask').requestSubmit();
        await flush();
        expect(runtime.dive).toHaveBeenCalledWith({ question: 'the horizon is interesting' });
    });

    it('shows what it heard as words, never as markup', async () => {
        withMic('live');
        press();
        await hear('<img src=x onerror=alert(1)> banana');
        await flush();
        expect(micLine().querySelector('img')).toBeNull();
        expect(micLine().textContent).toContain('<img src=x onerror=alert(1)> banana');
        expect($('input[name="question"]').value).toBe('<img src=x onerror=alert(1)> banana');
    });

    it('asks what is said inside a Dive as a follow-up, and stays in the Dive', async () => {
        const runtime = withMic('diving');
        press();
        await hear('what is the shadow?');
        await flush();
        expect(runtime.calls.at(-1)).toEqual(['dive', { question: 'what is the shadow?' }]);
        expect(runtime.status).toBe('diving');
    });

    for (const [error, sentence] of [['not-allowed', /blocked/u], ['audio-capture', /No microphone/u], ['no-speech', /Nothing was heard/u], ['network', /could not be reached/u]]) {
        it(`when the microphone says ${error}, says so in words and lets go of a reading it held`, async () => {
            const runtime = withMic('live');
            press();
            recogniser().begin();
            recogniser().fail(error);
            await flush();
            expect(micLine().textContent).toMatch(sentence);
            expect(runtime.status).toBe('live');
            expect(open(Recognition)).toEqual([]);
            expect($('[data-live="listen"]').getAttribute('aria-pressed')).toBe('false');
        });
    }

    it('does not resume a reading the reader had held themselves, when the microphone fails', async () => {
        const runtime = withMic('interrupted');
        press();
        recogniser().begin();
        recogniser().fail('network');
        await flush();
        expect(runtime.status).toBe('interrupted');
        expect(runtime.resume).not.toHaveBeenCalled();
    });

    it('stops listening when the reader uses a button instead, or when it ends', async () => {
        const runtime = withMic('live');
        press();
        recogniser().begin();
        const first = recogniser();
        $('[data-live="resume"]').click();
        await flush();
        expect(first.aborted).toBe(true);
        expect(runtime.calls.at(-1)).toEqual(['resume']);
        expect(micLine().hidden).toBe(true);

        press();
        recogniser().begin();
        const second = recogniser();
        runtime.set('stopped');
        expect(second.aborted).toBe(true);
        expect(open(Recognition)).toEqual([]);
    });

    it('lets go of the microphone when the controls are destroyed', () => {
        withMic('live');
        press();
        recogniser().begin();
        controls.destroy();
        expect(open(Recognition)).toEqual([]);
        controls = null;
    });
});

describe('asking without submitting a form', () => {
    it('asks with the button, and with Enter, though the form is never submitted (a frame sandboxed without allow-forms never fires it)', async () => {
        const runtime = fakeRuntime('live');
        controls = createLiveControls({ runtime, onStop: () => {} });
        const box = $('input[name="question"]');
        const submitted = vi.fn();
        $('.live-controls__ask').addEventListener('submit', submitted, { capture: true });

        box.value = 'first question';
        $('[data-live="dive"]').click();
        await flush();
        expect(runtime.dive).toHaveBeenLastCalledWith({ question: 'first question' });
        expect(submitted).not.toHaveBeenCalled();

        runtime.set('live');
        box.value = 'second question';
        const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        box.dispatchEvent(enter);
        await flush();
        expect(enter.defaultPrevented).toBe(true);
        expect(runtime.dive).toHaveBeenLastCalledWith({ question: 'second question' });
        expect(runtime.dive).toHaveBeenCalledTimes(2);
    });

    it('does not ask on any other key, while a word is being composed, or with nothing typed', async () => {
        const runtime = fakeRuntime('live');
        controls = createLiveControls({ runtime, onStop: () => {} });
        const box = $('input[name="question"]');
        box.value = 'something';
        for (const init of [{ key: 'a' }, { key: 'Tab' }, { key: 'Enter', isComposing: true }]) box.dispatchEvent(new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true }));
        box.value = '   ';
        box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        $('[data-live="dive"]').click();
        await flush();
        expect(runtime.dive).not.toHaveBeenCalled();
    });

    it('still asks when the form is submitted, once', async () => {
        const runtime = fakeRuntime('live');
        controls = createLiveControls({ runtime, onStop: () => {} });
        $('input[name="question"]').value = 'via the form';
        $('.live-controls__ask').requestSubmit();
        await flush();
        expect(runtime.dive).toHaveBeenCalledTimes(1);
    });
});

describe('the undercurrent', () => {
    const turn = (question, extra = {}) => ({ question, paragraphs: [`The answer to ${question}`], status: 'answered', error: null, ...extra });
    const dive = (number, segmentId, atCharacter, quote, turns) => ({ id: `dive-${number}`, number, anchor: { segmentId, atCharacter, quote }, turns });
    const DIVES = [
        dive(1, 's1', 4, 'line, the first', [turn('what is first?'), turn('and after it?', { status: 'cut-short', paragraphs: ['Half an'] })]),
        dive(2, 's2', 0, 'second line', [turn('why second?')])
    ];
    const panel = () => $('.live-controls__undercurrent');
    const entry = id => panel().querySelector(`details[data-dive="${id}"]`);

    it('is not there before any Dive, and says nothing about one', () => {
        controls = createLiveControls({ runtime: fakeRuntime('live'), onStop: () => {} });
        expect(panel().hidden).toBe(true);
        expect($('.live-controls__crumb').hidden).toBe(true);
        expect(document.querySelectorAll('.live-controls__forks').length).toBe(0);
    });

    it('draws every Dive, each question and answer as words, and how each ended, in every state the reading can be in', () => {
        const runtime = fakeRuntime('live');
        runtime.dives = DIVES;
        controls = createLiveControls({ runtime, onStop: () => {} });
        for (const status of ['live', 'interrupted', 'diving', 'ended']) {
            runtime.set(status);
            expect(panel().hidden, status).toBe(false);
        }
        expect(panel().querySelector('summary').textContent).toBe('Undercurrent (2)');
        expect(entry('dive-1').querySelector('summary').textContent).toContain('Dive 1: “what is first?”');
        expect(entry('dive-1').querySelector('summary').textContent).toContain('2 questions');
        const text = entry('dive-1').textContent;
        expect(text).toContain('You asked: what is first?');
        expect(text).toContain('The answer to what is first?');
        expect(text).toContain('You asked: and after it?');
        expect(text).toContain('Cut short. What was written is kept.');
        expect(text).toContain('Taken from “line, the first”');
        expect(entry('dive-2').textContent).toContain('The answer to why second?');
    });

    it('draws what a question or an answer says as words, never as markup', () => {
        const runtime = fakeRuntime('live');
        runtime.dives = [dive(1, 's1', 0, '<b>quote</b>', [turn('<img src=x onerror=alert(1)>', { paragraphs: ['<script>alert(2)</script>'] })])];
        controls = createLiveControls({ runtime, onStop: () => {} });
        expect(panel().querySelector('img, script, b')).toBeNull();
        expect(panel().textContent).toContain('<img src=x onerror=alert(1)>');
        expect(panel().textContent).toContain('<script>alert(2)</script>');
        expect(panel().textContent).toContain('<b>quote</b>');
    });

    it('is updated as the Dives change, without the reader’s open Dive closing', () => {
        const runtime = fakeRuntime('live');
        runtime.dives = [DIVES[0]];
        controls = createLiveControls({ runtime, onStop: () => {} });
        entry('dive-1').open = true;
        runtime.setDives([DIVES[0], DIVES[1]]);
        expect(panel().querySelector('summary').textContent).toBe('Undercurrent (2)');
        expect(entry('dive-1').open).toBe(true);
        expect(entry('dive-2').open).toBe(false);
        const grown = { ...DIVES[0], turns: [...DIVES[0].turns, turn('and a third?')] };
        runtime.setDives([grown, DIVES[1]]);
        expect(entry('dive-1').open).toBe(true);
        expect(entry('dive-1').textContent).toContain('and a third?');
    });

    it('marks, under the passage a Dive was taken from, that there was one, and the marker opens that Dive', () => {
        const runtime = fakeRuntime('live');
        runtime.dives = DIVES;
        controls = createLiveControls({ runtime, onStop: () => {} });
        const lines = [...document.querySelectorAll('.live-controls__lines > li')];
        expect(lines[0].querySelector('.live-controls__forks button').textContent).toBe('Dive 1: “what is first?”');
        expect(lines[1].querySelector('.live-controls__forks button').textContent).toBe('Dive 2: “why second?”');
        expect(lines[0].firstChild.textContent).toBe('first line');
        lines[1].querySelector('.live-controls__forks button').click();
        expect(panel().open).toBe(true);
        expect(entry('dive-2').open).toBe(true);
        expect(entry('dive-1').open).toBe(false);
        expect(document.activeElement).toBe(entry('dive-2').querySelector('summary'));
    });

    it('says in the breadcrumb where the reader is and where Surface goes back to, only while in a Dive', () => {
        const runtime = fakeRuntime('live');
        runtime.dives = DIVES;
        controls = createLiveControls({ runtime, onStop: () => {} });
        expect($('.live-controls__crumb').hidden).toBe(true);
        runtime.set('diving', { dive: { id: 'dive-1', turns: 2, opening: false } });
        expect($('.live-controls__crumb').hidden).toBe(false);
        expect($('.live-controls__crumb').textContent).toBe('Main › Dive 1: “and after it?” Surface returns to: “line, the first”');
        expect(entry('dive-1').querySelector('summary').textContent).toContain('You are here');
        expect(entry('dive-2').querySelector('summary').textContent).not.toContain('You are here');
        runtime.set('live');
        expect($('.live-controls__crumb').hidden).toBe(true);
        // From the moment a Dive begins to open: the place is already the reader's.
        runtime.set('live', { dive: { id: 'dive-2', turns: 1, opening: true } });
        expect($('.live-controls__crumb').textContent).toBe('Main › Dive 2: “why second?” Surface returns to: “second line”');
    });

    it('asks again in the Dive the reader is in, and a Dive from the main reading otherwise', async () => {
        const runtime = fakeRuntime('diving');
        runtime.dives = DIVES;
        controls = createLiveControls({ runtime, onStop: () => {} });
        $('input[name="question"]').value = 'and then?';
        $('[data-live="dive"]').click();
        await flush();
        expect(runtime.dive).toHaveBeenCalledWith({ question: 'and then?' });
        expect($('[data-live="dive"]').textContent).toBe('Ask again');
        runtime.set('live');
        expect($('[data-live="dive"]').textContent).toBe('Dive');
    });

    it('is still drawn from a runtime that keeps no undercurrent', () => {
        const runtime = fakeRuntime('live');
        delete runtime.undercurrent;
        controls = createLiveControls({ runtime, onStop: () => {} });
        expect(panel().hidden).toBe(true);
    });
});
