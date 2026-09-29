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
import { createLiveControls, describeStatus } from './controls.js';

const snapshot = (status, extra = {}) => ({
    status, error: null, main: { voiceDegraded: false, speaking: null, ...extra.main }, side: extra.side ?? null, ...(extra.error ? { error: extra.error } : {})
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

    it('says a Dive is answered when it is, and that it could not be when it could not', () => {
        expect(describeStatus(snapshot('diving', { side: { finished: true } }), { question: 'q' })).toMatch(/answered\. Surface/u);
        expect(describeStatus(snapshot('diving', { side: { error: { message: 'no answer' } } }), { question: 'q' })).toMatch(/could not be answered \(no answer\)/u);
    });

    it('says why it failed, in the provider’s words and not a code', () => {
        expect(describeStatus(snapshot('failed', { error: { code: 'X', message: 'the key was refused' } }))).toBe('It could not be answered: the key was refused.');
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
        composed: role => ({ segments: role === 'side' ? [{ text: 'a dive line', ended: true }] : [{ text: 'first line', ended: true }, { text: 'second line', ended: true }, { text: 'still being written', ended: false }] }),
        interrupt: vi.fn(async body => { calls.push(['interrupt', body]); runtime.set('interrupted'); }),
        resume: vi.fn(() => { calls.push(['resume']); runtime.set('live'); }),
        dive: vi.fn(async body => { calls.push(['dive', body]); runtime.set('diving'); }),
        surface: vi.fn(async () => { calls.push(['surface']); runtime.set('live'); }),
        set(status, extra) { state = snapshot(status, extra); for (const fn of [...listeners]) fn(state); },
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
        expect($('[data-live="dive"]').disabled).toBe(true);
        expect($('input[name="question"]').disabled).toBe(true);

        runtime.set('starting');
        expect($('[data-live="dive"]').disabled).toBe(true);
        runtime.set('ended');
        expect($('[data-live="dive"]').disabled).toBe(false);
        expect($('[data-live="interrupt"]').hidden).toBe(true);
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
        runtime.dive = vi.fn(async () => { throw new Error('A Dive inside a Dive is not built'); });
        controls = createLiveControls({ runtime, onStop: () => {} });
        $('input[name="question"]').value = 'deeper';
        $('.live-controls__ask').requestSubmit();
        await flush();
        expect($('.live-controls__error').hidden).toBe(false);
        expect($('.live-controls__error').textContent).toBe('A Dive inside a Dive is not built');
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
