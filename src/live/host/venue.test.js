/**
 * The Live venue: the Reader site's `/live` page, where RISE owns the room.
 *
 * The runtime is a fake that records what it was asked; the stage, the registry, the entry state machine
 * and the microphone listener are the real ones. What is held: what the reader sees and chooses before
 * asking, what is refused in words, that a typed key is never kept anywhere but the page's memory, and that
 * one room holds many readings on one adapter.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveHost } from './LiveHost.js';
import { createFakeRecognition, open } from '../../test/fake-recognition.js';
import { acceptOpenRouterKey, resetConnectionForTests } from '../../core/ai-connection.js';

const env = ({ recognition = null } = {}) => ({
    window: {
        ...(recognition ? { SpeechRecognition: recognition } : {}),
        matchMedia: () => ({ matches: false }),
        AudioContext: function Context() {}
    },
    navigator: {},
    document: { createElement: () => ({ getContext: () => ({}) }), fullscreenEnabled: true }
});

function fakeRuntime() {
    const listeners = new Set();
    let state = { status: 'idle', main: { segmentId: 'p1' }, position: { segmentIndex: 0, segmentCount: 2 }, pace: 1, interjection: { state: 'none', failed: null } };
    const runtime = {
        get status() { return state.status; },
        snapshot: () => state,
        subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
        composed: () => ({ segments: [] }),
        passages: () => [{ segmentId: 'p1', spoken: true, text: 'One.' }, { segmentId: 'p2', spoken: true, text: 'Two.' }],
        journal: () => [{ type: 'start' }],
        discoverVisual: () => null,
        start: vi.fn(async () => { runtime.set('live'); }),
        stop: vi.fn(async () => { runtime.set('stopped'); }),
        hold: vi.fn(() => runtime.set('interrupted')),
        resume: vi.fn(() => runtime.set('live', 'none')),
        beginInterjection: vi.fn(() => runtime.set('interrupted', 'held')),
        interject: vi.fn(async () => runtime.set('interrupted', 'asking')),
        cancelInterjection: vi.fn(() => runtime.set('live', 'none')),
        interrupt: vi.fn(async () => runtime.set('interrupted')),
        seek: vi.fn(() => runtime.set('live')),
        set(status, interjection = state.interjection.state, failed = null) {
            state = { ...state, status, interjection: { state: interjection, failed } };
            for (const fn of [...listeners]) fn(state);
        }
    };
    return runtime;
}

let host;
let container;
let runtimes;

function mount(search = '', environment = env(), options = {}) {
    container = document.createElement('div');
    document.body.appendChild(container);
    host = new LiveHost(container, { router: { navigate: async () => true, views: new Map() }, search, env: environment, venue: true, ...options });
    runtimes = [];
    host.buildRuntime = vi.fn(async () => {
        const runtime = fakeRuntime();
        runtimes.push(runtime);
        return runtime;
    });
    return host;
}

const $ = selector => document.querySelector(selector);
const question = () => $('#live-venue-question');
const radios = () => [...container.querySelectorAll('input[name="live-venue-provider"]')];
const choose = id => {
    const radio = radios().find(item => item.value === id);
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
};
const askAt = (form, field, words) => {
    field.value = words;
    form.requestSubmit();
};
const ask = words => askAt(container.querySelector('.live-venue__ask'), question(), words);
const askAgain = words => askAt($('.live-again'), $('#live-again-question'), words);

beforeEach(() => resetConnectionForTests());

afterEach(() => {
    host?.destroy();
    host = null;
    document.body.replaceChildren();
    vi.restoreAllMocks();
});

describe('the venue is /live in the app', () => {
    it('is a question, the providers the registry offers, and a sentence on whose key', () => {
        mount();
        expect(container.querySelector('h1').textContent).toBe('RISE Live');
        expect(question().type).toBe('text');
        expect(question().labels[0].textContent).toBe('Your question');
        expect(radios().map(radio => radio.value)).toEqual(['mock', 'openrouter', 'gemini']);
        expect(radios().find(radio => radio.checked).value).toBe('mock');
        expect(radios()[0].labels[0].textContent).toContain('Demo (no key)');
        expect(container.querySelector('.live-venue__privacy').textContent).toMatch(/nothing you type leaves this browser/u);
    });

    it('offers OpenRouter, now that its adapter is in the registry, as a provider that can be chosen', () => {
        mount();
        const openRouter = radios().find(radio => radio.value === 'openrouter');
        expect(openRouter.disabled).toBe(false);
        expect(openRouter.labels[0].textContent).not.toContain('soon');
    });

    it('keeps the runtime’s test page at ?host=prompt, with a provider or a catalog, and outside the app', () => {
        for (const search of ['?host=prompt', '?provider=gemini', '?catalog=attractor']) {
            mount(search);
            expect(container.querySelector('.live-venue'), search).toBeNull();
            expect(container.querySelector('.live-ask'), search).not.toBeNull();
            host.destroy();
        }
        mount('', env(), { venue: false });
        expect(container.querySelector('.live-ask')).not.toBeNull();
    });
});

describe('ask, read, ask again', () => {
    it('asks a typed question on the demo and puts the stage up with the whole instrument', async () => {
        mount('?voice=paced');
        ask('Why is the sky blue?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalledWith('Why is the sky blue?'));
        expect($('#rise-stage-controls').dataset.transport).toBe('full');
        expect($('#rise-stage-controls [data-stage="fullscreen"]')).not.toBeNull();
        expect($('.live-again')).not.toBeNull();
        // While it plays, only the microphone and a small field to speak into it (the interjection).
        expect($('.live-again').hidden).toBe(false);
        expect($('.live-again').dataset.open).toBe('false');
    });

    it('refuses an empty question in words, and builds nothing', () => {
        mount();
        ask('   ');
        expect(container.querySelector('.live-error').textContent).toBe('Ask something first.');
        expect(host.buildRuntime).not.toHaveBeenCalled();
    });

    it('offers to ask again at the end, and the next question reads in the same room with the reader’s theme', async () => {
        mount('?voice=paced');
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        const theme = $('#rise-settings-theme');
        theme.value = 'ember';
        theme.dispatchEvent(new Event('change', { bubbles: true }));
        runtimes[0].set('ended');
        expect($('.live-again').hidden).toBe(false);
        askAgain('Second?');
        await vi.waitFor(() => expect(runtimes[1]?.start).toHaveBeenCalledWith('Second?'));
        expect(runtimes[0].stop).toHaveBeenCalled();
        expect($('#rise-settings-theme').value).toBe('ember');
        expect(document.querySelectorAll('#rise-stage-controls')).toHaveLength(1);
        expect(host.venueTurns().map(turn => turn.question)).toEqual(['First?', 'Second?']);
        // The journal of the reading that ended is carried with the room, for perception (design §8 stage 4).
        expect(host.venueTurns()[0].journal).toEqual([{ type: 'start' }]);
    });

    it('asks every question of a room through one adapter', async () => {
        mount();
        const first = await host.venueAdapter({});
        expect(await host.venueAdapter({})).toBe(first);
        expect(first.id).toBe('mock');
    });

    it('asks inside the reading when the reader asks while it plays: an interjection, not a new reading', async () => {
        mount('?voice=paced');
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        askAgain('Second?');
        expect(runtimes[0].beginInterjection).toHaveBeenCalled();
        await vi.waitFor(() => expect(runtimes[0].interject).toHaveBeenCalledWith('Second?', {}));
        expect(host.buildRuntime).toHaveBeenCalledTimes(1);
    });

    it('asks a new reading when the reader asks while it is paused, as before', async () => {
        mount('?voice=paced');
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        runtimes[0].hold();
        askAgain('Second?');
        await vi.waitFor(() => expect(runtimes[1]?.start).toHaveBeenCalledWith('Second?'));
        expect(runtimes[0].interject).not.toHaveBeenCalled();
    });

    it('plays an ended reading again from its first passage, asking nothing', async () => {
        mount('?voice=paced');
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        runtimes[0].set('ended');
        $('#rise-stage-controls [data-stage="play"]').click();
        expect(runtimes[0].seek).toHaveBeenCalledWith({ segmentId: 'p1' });
        expect(host.buildRuntime).toHaveBeenCalledTimes(1);
        expect($('.live-again').dataset.open).toBe('false');
    });

    it('says why a question could not be asked, and goes back to the entry', async () => {
        mount('?voice=paced');
        host.buildRuntime = vi.fn(async () => { throw new Error('refused'); });
        ask('First?');
        await vi.waitFor(() => expect(container.querySelector('.live-error').textContent).toBe('Could not start: refused'));
        expect($('#rise-stage-controls')).toBeNull();
        expect(container.querySelector('.live-error').hidden).toBe(false);
    });

    it('leaves the room for the entry: the reading stops and the stage and the bar go', async () => {
        mount('?voice=paced');
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        runtimes[0].set('ended');
        $('.live-again__leave').click();
        await vi.waitFor(() => expect(runtimes[0].stop).toHaveBeenCalled());
        expect($('#rise-stage-controls')).toBeNull();
        expect($('.live-again')).toBeNull();
        expect(host.venueTurns()).toEqual([]);
    });

    it('takes the stage and the bar away when the page goes', async () => {
        mount('?voice=paced');
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        host.destroy();
        expect($('#rise-stage-controls')).toBeNull();
        expect($('.live-again')).toBeNull();
        await vi.waitFor(() => expect(runtimes[0].stop).toHaveBeenCalled());
    });
});

describe('whose key', () => {
    it('asks for a typed key for Gemini in a password field, and refuses without one', () => {
        mount();
        choose('gemini');
        const key = $('#live-venue-key');
        expect(key.type).toBe('password');
        expect(key.autocomplete).toBe('off');
        expect(container.querySelector('.live-venue__privacy').textContent).toMatch(/Gemini key stays in this page’s memory/u);
        ask('Why?');
        expect(container.querySelector('.live-error').textContent).toBe('Enter your Gemini key to use this provider.');
        expect(host.buildRuntime).not.toHaveBeenCalled();
    });

    it('takes the typed key into memory only: the field is emptied, and no storage is written or opened', async () => {
        const writes = vi.spyOn(Storage.prototype, 'setItem');
        const indexedDB = { open: vi.fn() };
        vi.stubGlobal('indexedDB', indexedDB);
        mount('?voice=paced');
        choose('gemini');
        $('#live-venue-key').value = 'AIza-the-readers-own-key';
        ask('Why?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalledWith('Why?'));
        expect($('#live-venue-key').value).toBe('');
        expect(host.key).toBe('AIza-the-readers-own-key');
        expect(writes).not.toHaveBeenCalled();
        expect(indexedDB.open).not.toHaveBeenCalled();
        expect(document.documentElement.outerHTML).not.toContain('AIza-the-readers-own-key');
        // Leaving the room forgets it.
        runtimes[0].set('ended');
        $('.live-again__leave').click();
        await vi.waitFor(() => expect(host.key).toBe(''));
        vi.unstubAllGlobals();
    });

    it('shows the connect control for OpenRouter without a connection, and asks once connected', async () => {
        const providers = Object.freeze([
            Object.freeze({ id: 'mock', label: 'Demo (no key)', credential: 'none', adapter: async () => ({}) }),
            Object.freeze({ id: 'openrouter', label: 'OpenRouter (your key)', credential: 'openrouter', adapter: async () => ({}) })
        ]);
        mount('?voice=paced', env(), { providers });
        choose('openrouter');
        const connect = container.querySelector('[data-venue="connect"]');
        expect(connect.textContent).toBe('Connect OpenRouter');
        expect(container.querySelector('.live-venue__privacy').textContent).toMatch(/OpenRouter key stays in this tab’s memory/u);
        ask('Why?');
        expect(container.querySelector('.live-error').textContent).toBe('Connect OpenRouter first, or choose the demo.');
        acceptOpenRouterKey('sk-or-v1-0123456789abcdef0123');
        await vi.waitFor(() => expect(container.querySelector('[data-venue="connect"]')).toBeNull());
        expect(container.querySelector('.live-venue__credential').textContent).toMatch(/Connected/u);
        ask('Why?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalledWith('Why?'));
    });
});

describe('the microphone', () => {
    it('puts a spoken question in the field, and asks it only when the reader does', async () => {
        const Recognition = createFakeRecognition();
        mount('?voice=paced', env({ recognition: Recognition }));
        const mic = await vi.waitFor(() => {
            const found = container.querySelector('[data-venue="listen"]');
            expect(found).not.toBeNull();
            return found;
        });
        expect(container.querySelector('.live-venue__mic-privacy').textContent).toMatch(/browser maker/u);
        mic.click();
        const [recogniser] = Recognition.instances;
        recogniser.begin();
        recogniser.say('what is a quasar', { final: true });
        recogniser.end();
        await vi.waitFor(() => expect(question().value).toBe('what is a quasar'));
        expect(open(Recognition)).toHaveLength(0);
        expect(host.buildRuntime).not.toHaveBeenCalled();
        ask(question().value);
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalledWith('what is a quasar'));
    });

    it('holds the voice while the reader speaks during a reading, and carries on when told to', async () => {
        const Recognition = createFakeRecognition();
        mount('?voice=paced', env({ recognition: Recognition }));
        await vi.waitFor(() => expect(container.querySelector('[data-venue="listen"]')).not.toBeNull());
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        $('.live-again [data-venue="listen"]').click();
        expect(runtimes[0].beginInterjection).toHaveBeenCalled();
        const recogniser = Recognition.instances.at(-1);
        recogniser.begin();
        recogniser.say('carry on', { final: true });
        recogniser.end();
        await vi.waitFor(() => expect(runtimes[0].resume).toHaveBeenCalled());
    });

    it('puts other words heard during a reading in the bar’s field, held, for the reader to ask', async () => {
        const Recognition = createFakeRecognition();
        mount('?voice=paced', env({ recognition: Recognition }));
        await vi.waitFor(() => expect(container.querySelector('[data-venue="listen"]')).not.toBeNull());
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        $('.live-again [data-venue="listen"]').click();
        const recogniser = Recognition.instances.at(-1);
        recogniser.begin();
        recogniser.say('why is it dark at night', { final: true });
        recogniser.end();
        await vi.waitFor(() => expect($('#live-again-question').value).toBe('why is it dark at night'));
        expect(runtimes[0].status).toBe('interrupted');
        expect($('.live-again').hidden).toBe(false);
        expect(host.buildRuntime).toHaveBeenCalledTimes(1);
    });
});

describe('what the reader did goes up with their next words (perception, design §4)', () => {
    const JOURNAL = [
        { at: 0, type: 'start', prompt: 'First?' },
        { at: 10, type: 'replay', from: 'p2', to: 'p2', reason: 'reader' },
        { at: 20, type: 'setting', parameter: 'theme', value: 'ember' },
        { at: 30, type: 'speech.start', role: 'main', segmentId: 'p2' }
    ];

    it('carries the last reading’s actions with the next question, rebuilt from its journal, to the room’s one adapter', async () => {
        mount('?voice=paced');
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalledWith('First?'));
        runtimes[0].journal = () => JOURNAL;
        runtimes[0].composed = () => ({ segments: [{ id: 'p1', text: 'One.' }, { id: 'p2', text: 'Two.' }] });
        runtimes[0].set('ended');
        askAgain('Again?');
        await vi.waitFor(() => expect(runtimes[1]?.start).toHaveBeenCalled());
        expect(runtimes[1].start).toHaveBeenCalledWith('Again?', {
            perception: {
                events: [
                    { type: 'replayed', from: 2, to: 2, times: 1, quote: 'Two.' },
                    { type: 'visual.changed', parameter: 'theme', value: 'ember' }
                ],
                earlier: 0
            }
        });
    });

    it('sends nothing by itself: a reading held, or ended, for a long time asks nothing more', async () => {
        vi.useFakeTimers();
        try {
            mount('?voice=paced');
            ask('First?');
            await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
            runtimes[0].journal = () => JOURNAL;
            runtimes[0].set('interrupted');
            await vi.advanceTimersByTimeAsync(10 * 60_000);
            runtimes[0].set('ended');
            await vi.advanceTimersByTimeAsync(10 * 60_000);
            expect(host.buildRuntime).toHaveBeenCalledTimes(1);
            expect(runtimes[0].start).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('keeps what the reader said to the microphone during a reading in its journal', async () => {
        const Recognition = createFakeRecognition();
        mount('?voice=paced', env({ recognition: Recognition }));
        await vi.waitFor(() => expect(container.querySelector('[data-venue="listen"]')).not.toBeNull());
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        runtimes[0].noteSaid = vi.fn();
        $('.live-again [data-venue="listen"]').click();
        const recogniser = Recognition.instances.at(-1);
        recogniser.begin();
        recogniser.say('carry on', { final: true });
        recogniser.end();
        await vi.waitFor(() => expect(runtimes[0].resume).toHaveBeenCalled());
        expect(runtimes[0].noteSaid).toHaveBeenCalledWith('carry on');
    });

    it('says so before the first question: what you did while it played is sent only with your next words', () => {
        mount();
        choose('gemini');
        expect(container.querySelector('.live-venue__privacy').textContent)
            .toContain('and what you did while it played (play, pause, replay, pace, settings, words you spoke to it), sent only with your next words');
        expect(container.querySelector('.live-venue__privacy').textContent)
            .toContain('A question asked while it reads also carries the reading so far.');
    });

    it('shows in About who is speaking: RISE, through the model and service the Current names', async () => {
        mount('?voice=paced');
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        runtimes[0].composed = () => ({ segments: [], origin: { kind: 'model', name: 'anthropic/claude-haiku-5.5', provider: 'OpenRouter' } });
        const about = $('.rise-settings__about');
        about.open = true;
        about.dispatchEvent(new Event('toggle'));
        expect($('.rise-settings__about-text').textContent.split('\n')[0]).toBe('RISE, speaking through anthropic/claude-haiku-5.5 via OpenRouter, on your key');
    });
});

describe('the interjection: the reader speaks while it plays (stage 4.5)', () => {
    async function playing() {
        mount('?voice=paced');
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        return runtimes[0];
    }
    const field = () => $('#live-again-question');
    const type = words => {
        field().value = words;
        field().dispatchEvent(new Event('input', { bubbles: true }));
    };

    it('offers a small field beside the microphone while the reading plays', async () => {
        await playing();
        expect($('.live-again').hidden).toBe(false);
        expect($('.live-again').dataset.open).toBe('false');
        expect(field().placeholder).toBe('Ask while it reads…');
    });

    it('holds the reading at the first letter typed, once, and asks with Enter inside the reading', async () => {
        const runtime = await playing();
        runtime.journal = () => [{ at: 0, type: 'start' }, { at: 5, type: 'replay', from: 'p1', to: 'p1', reason: 'reader' }];
        runtime.passages = () => [{ segmentId: 'p1', spoken: true, text: 'One.' }, { segmentId: 'p2', spoken: true, text: 'Two.' }];
        type('W');
        type('What is two?');
        expect(runtime.beginInterjection).toHaveBeenCalledTimes(1);
        expect($('.live-again').dataset.open).toBe('true');
        expect(field().placeholder).toBe('Ask RISE…');
        $('.live-again').requestSubmit();
        await vi.waitFor(() => expect(runtime.interject).toHaveBeenCalledWith('What is two?', {
            perception: { events: [{ type: 'replayed', from: 1, to: 1, times: 1, quote: 'One.' }], earlier: 0 }
        }));
        expect(field().value).toBe('');
        expect($('.live-again__note').textContent).toBe('Asking RISE…');
        expect(host.buildRuntime).toHaveBeenCalledTimes(1);
    });

    it('takes it back on Escape, and the reading plays on', async () => {
        const runtime = await playing();
        type('Wait');
        const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        field().dispatchEvent(escape);
        expect(runtime.cancelInterjection).toHaveBeenCalled();
        expect(escape.defaultPrevented).toBe(true);
        expect(field().value).toBe('');
        expect(runtime.status).toBe('live');
    });

    it('asks nothing more while RISE is answering, and says why', async () => {
        const runtime = await playing();
        runtime.set('live', 'answering');
        askAgain('And another?');
        expect(runtime.interject).not.toHaveBeenCalled();
        expect(host.buildRuntime).toHaveBeenCalledTimes(1);
        expect($('.live-again__note').textContent).toBe('RISE is answering; ask again once it has.');
    });

    it('says in one line that RISE could not answer, and that the reading goes on', async () => {
        const runtime = await playing();
        runtime.set('live', 'none', 'PROVIDER_FAILED');
        expect($('.live-again__note').textContent).toBe('RISE could not answer that just now; the reading goes on.');
    });
});
