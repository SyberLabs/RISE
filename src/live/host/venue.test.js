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
    let state = { status: 'idle', main: { segmentId: 'p1' }, position: { segmentIndex: 0, segmentCount: 2 }, pace: 1 };
    const runtime = {
        get status() { return state.status; },
        snapshot: () => state,
        subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
        composed: () => ({ segments: [] }),
        passages: () => [{ segmentId: 'p1', spoken: true }, { segmentId: 'p2', spoken: true }],
        journal: () => [{ type: 'start' }],
        discoverVisual: () => null,
        start: vi.fn(async () => { runtime.set('live'); }),
        stop: vi.fn(async () => { runtime.set('stopped'); }),
        hold: vi.fn(() => runtime.set('interrupted')),
        resume: vi.fn(() => runtime.set('live')),
        interrupt: vi.fn(async () => runtime.set('interrupted')),
        seek: vi.fn(() => runtime.set('live')),
        set(status) { state = { ...state, status }; for (const fn of [...listeners]) fn(state); }
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
        expect($('.live-again').hidden).toBe(true);
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

    it('holds a playing reading when the reader asks while it plays', async () => {
        mount('?voice=paced');
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        askAgain('Second?');
        expect(runtimes[0].hold).toHaveBeenCalled();
        await vi.waitFor(() => expect(runtimes[1]?.start).toHaveBeenCalledWith('Second?'));
    });

    it('plays an ended reading again from its first passage, asking nothing', async () => {
        mount('?voice=paced');
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        runtimes[0].set('ended');
        $('#rise-stage-controls [data-stage="play"]').click();
        expect(runtimes[0].seek).toHaveBeenCalledWith({ segmentId: 'p1' });
        expect(host.buildRuntime).toHaveBeenCalledTimes(1);
        expect($('.live-again').hidden).toBe(true);
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
        expect(runtimes[0].hold).toHaveBeenCalled();
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
