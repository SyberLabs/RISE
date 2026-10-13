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
import { PENDING_KEY, takeOpenRouterReturn } from '../../core/openrouter-callback.js';

// The face's engine is a worker's to draw (face-layer.test.js holds it); here it is a fake that records its cues.
const faces = vi.hoisted(() => []);
vi.mock('./face-layer.js', () => ({
    mountFace: options => {
        const face = {
            options, cues: [], skins: [], places: [], playing: false, destroyed: false,
            cue(name) { face.cues.push(name); }, setSkin(name) { face.skins.push(name); },
            place(geometry) { face.places.push(geometry); }, point() {},
            play() { face.playing = true; }, pause() { face.playing = false; }, destroy() { face.destroyed = true; },
            frameTimes: () => [], lumas: () => [], frozen: () => false
        };
        faces.push(face);
        return face;
    }
}));

const env = ({ recognition = null } = {}) => ({
    window: {
        ...(recognition ? { SpeechRecognition: recognition } : {}),
        matchMedia: () => ({ matches: false }),
        AudioContext: function Context() {}
    },
    navigator: {},
    document: { createElement: () => ({ getContext: () => ({}) }), fullscreenEnabled: true }
});

function fakeRuntime({ segmentId = 'p1', running = null, chooses = true } = {}) {
    const listeners = new Set();
    let state = { status: 'idle', main: { segmentId }, position: { segmentIndex: 0, segmentCount: 2 }, pace: 1, interjection: { state: 'none', failed: null } };
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
        visualEngine: vi.fn(() => running),
        chooseVisual: vi.fn(() => {
            if (chooses) runtime.set('live', 'none');
            return chooses;
        }),
        interrupt: vi.fn(async () => runtime.set('interrupted')),
        seek: vi.fn(() => runtime.set('live')),
        set(status, interjection = state.interjection.state, failed = null) {
            state = { ...state, status, interjection: { state: interjection, failed } };
            for (const fn of [...listeners]) fn(state);
        },
        /** The reading's first atom is shown: the runtime names the passage the reader is in. */
        shows(id) {
            state = { ...state, main: { ...state.main, segmentId: id } };
            for (const fn of [...listeners]) fn(state);
        }
    };
    return runtime;
}

/** What the next runtime built is made with (fakeRuntime's options). */
let nextRuntime = {};

let host;
let container;
let runtimes;

function mount(search = '', environment = env(), options = {}) {
    container = document.createElement('div');
    document.body.appendChild(container);
    host = new LiveHost(container, { router: { navigate: async () => true, views: new Map() }, search, env: environment, venue: true, ...options });
    runtimes = [];
    host.buildRuntime = vi.fn(async () => {
        const runtime = fakeRuntime(nextRuntime);
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
    nextRuntime = {};
    faces.length = 0;
    document.body.replaceChildren();
    vi.restoreAllMocks();
});

describe('the venue is /live in the app', () => {
    it('is a question, the providers the registry offers, and a sentence on whose key', () => {
        mount();
        expect(container.querySelector('h1').textContent).toBe('RISE Live');
        expect(question().type).toBe('text');
        expect(question().labels[0].textContent).toBe('Your question');
        expect(radios().map(radio => radio.value)).toEqual(['mock', 'openrouter', 'anthropic', 'openai', 'gemini']);
        expect(radios().find(radio => radio.checked).value).toBe('mock');
        expect(radios()[0].labels[0].textContent).toContain('Demo (no key)');
        expect(container.querySelector('.live-venue__privacy').textContent).toMatch(/nothing you type leaves this browser/u);
    });

    it('names who answers and who speaks in one quiet line, each name opening its choices, and the key under its provider', () => {
        mount();
        const answered = $('[data-venue-open="providers"]');
        const spoken = $('[data-venue-open="voices"]');
        expect($('.live-venue__choices').textContent).toBe('Answered by Demo · spoken by your device');
        const panel = $('#live-venue-providers-panel');
        expect(panel.hidden).toBe(true);
        answered.click();
        expect(panel.hidden).toBe(false);
        expect(answered.getAttribute('aria-expanded')).toBe('true');
        expect(document.activeElement).toBe(radios()[0]);
        choose('anthropic');
        expect(answered.textContent).toBe('Anthropic');
        expect(answered.getAttribute('aria-label')).toBe('Who answers: Anthropic');
        // The key field sits directly under the chosen provider.
        expect(radios().find(radio => radio.value === 'anthropic').closest('label').nextElementSibling.querySelector('#live-venue-key')).not.toBeNull();
        spoken.click();
        expect(panel.hidden).toBe(true);
        expect($('#live-venue-voices-panel').hidden).toBe(false);
        $('.live-venue').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect($('#live-venue-voices-panel').hidden).toBe(true);
        expect(document.activeElement).toBe(spoken);
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
        await vi.waitFor(() => expect(runtimes[1]?.start).toHaveBeenCalledWith('Second?', { earlier: [{ asked: 'First?', said: 'One.', cut: true }] }));
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
        await vi.waitFor(() => expect(runtimes[0].interject).toHaveBeenCalledWith('Second?', { earlier: [{ asked: 'First?' }] }));
        expect(host.buildRuntime).toHaveBeenCalledTimes(1);
    });

    it('asks a new reading when the reader asks while it is paused, as before', async () => {
        mount('?voice=paced');
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        runtimes[0].hold();
        askAgain('Second?');
        await vi.waitFor(() => expect(runtimes[1]?.start).toHaveBeenCalledWith('Second?', { earlier: [{ asked: 'First?', said: 'One.', cut: true }] }));
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

    it('asks for your own Anthropic or OpenAI key the same way, and says the key goes to that company alone', () => {
        mount();
        for (const [id, name] of [['anthropic', 'Anthropic'], ['openai', 'OpenAI']]) {
            choose(id);
            expect($('#live-venue-key').type).toBe('password');
            expect(container.querySelector('label[for="live-venue-key"]').textContent).toBe(`Your ${name} key`);
            expect(container.querySelector('.live-venue__privacy').textContent)
                .toContain(`Your ${name} key stays in this page’s memory and goes only to ${name}, billed to your key.`);
            ask('Why?');
            expect(container.querySelector('.live-error').textContent).toBe(`Enter your ${name} key to use this provider.`);
        }
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

    it('connecting keeps /live and the question for the round trip in this tab', async () => {
        mount();
        choose('openrouter');
        question().value = 'Why is the sky blue?';
        container.querySelector('[data-venue="connect"]').click();
        await vi.waitFor(() => expect(sessionStorage.getItem(PENDING_KEY)).not.toBeNull());
        expect(JSON.parse(sessionStorage.getItem(PENDING_KEY))).toMatchObject({ returnTo: '/live', draft: 'Why is the sky blue?' });
        expect(container.querySelector('.live-venue__note').textContent).toMatch(/brings you back here/u);
        sessionStorage.clear();
    });

    it('comes back from OpenRouter to the room: OpenRouter chosen, connected, and the question where it was', async () => {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier: 'v'.repeat(43), state: 'S'.repeat(32), createdAt: Date.now(), returnTo: '/live', draft: 'Why is the sky blue?' }));
        const location = { pathname: `/connect/openrouter/${'S'.repeat(32)}`, href: `https://rise.example/connect/openrouter/${'S'.repeat(32)}?code=abc12345` };
        takeOpenRouterReturn(location, { replaceState: () => {} }, sessionStorage);
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ key: 'sk-or-v1-0123456789abcdef0123' })));
        mount();
        expect(radios().find(radio => radio.checked).value).toBe('openrouter');
        expect(question().value).toBe('Why is the sky blue?');
        await vi.waitFor(() => expect(container.querySelector('.live-venue__credential').textContent).toMatch(/Connected/u));
        expect(container.querySelector('.live-venue__heard').textContent).toMatch(/OpenRouter connected/u);
        expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
        vi.unstubAllGlobals();
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
            },
            earlier: [{ asked: 'First?', said: 'One. Two.', cut: true }]
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

describe('the room remembers what was said in it, until the reader leaves (LIVE-026)', () => {
    const FINISHED = [{ at: 0, type: 'start' }, { at: 50, type: 'run.finished', role: 'main' }];
    const answered = (runtime, passages) => {
        runtime.journal = () => FINISHED;
        runtime.passages = () => passages;
        runtime.composed = () => ({ segments: [{ id: 'p1', text: passages[0].text, beat: { scene: 'field' } }] });
        runtime.set('ended');
    };

    it('sends each earlier question and what RISE said with the next, in order, to the room’s one adapter', async () => {
        mount('?voice=paced');
        ask('What is time?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalledWith('What is time?'));
        answered(runtimes[0], [{ segmentId: 'p1', spoken: true, text: 'Time is what clocks measure.' }, { segmentId: 'p2', spoken: true, text: 'It runs one way.' }]);
        askAgain('What did Einstein say about it?');
        await vi.waitFor(() => expect(runtimes[1]?.start).toHaveBeenCalled());
        const first = { asked: 'What is time?', said: 'Time is what clocks measure. It runs one way.', showed: ['the scene field'] };
        expect(runtimes[1].start).toHaveBeenCalledWith('What did Einstein say about it?', expect.objectContaining({ earlier: [first] }));
        answered(runtimes[1], [{ segmentId: 'p1', spoken: true, text: 'That it is relative.' }]);
        askAgain('Why?');
        await vi.waitFor(() => expect(runtimes[2]?.start).toHaveBeenCalled());
        expect(runtimes[2].start).toHaveBeenCalledWith('Why?', expect.objectContaining({
            earlier: [first, { asked: 'What did Einstein say about it?', said: 'That it is relative.', showed: ['the scene field'] }]
        }));
    });

    it('sends them with an interjection too, with the question the reading answers, and never the words being asked', async () => {
        mount('?voice=paced');
        ask('What is time?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        answered(runtimes[0], [{ segmentId: 'p1', spoken: true, text: 'Time is what clocks measure.' }]);
        askAgain('And space?');
        await vi.waitFor(() => expect(runtimes[1]?.start).toHaveBeenCalled());
        askAgain('Where?');
        await vi.waitFor(() => expect(runtimes[1].interject).toHaveBeenCalled());
        expect(runtimes[1].interject).toHaveBeenCalledWith('Where?', expect.objectContaining({
            earlier: [{ asked: 'What is time?', said: 'Time is what clocks measure.', showed: ['the scene field'] }, { asked: 'And space?' }]
        }));
    });

    it('forgets them when the reader leaves the room, and keeps them nowhere but the page’s memory', async () => {
        const stored = () => [localStorage.length, sessionStorage.length];
        const before = stored();
        mount('?voice=paced');
        ask('What is time?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        answered(runtimes[0], [{ segmentId: 'p1', spoken: true, text: 'Time is what clocks measure.' }]);
        await host.venue.leave();
        ask('Why?');
        await vi.waitFor(() => expect(runtimes[1]?.start).toHaveBeenCalled());
        expect(runtimes[1].start).toHaveBeenCalledWith('Why?');
        expect(stored()).toEqual(before);
        expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('clocks measure');
    });

    it('says so in What is sent, and in About this reading how many earlier turns went up', async () => {
        mount();
        choose('gemini');
        expect(container.querySelector('.live-venue__privacy').textContent)
            .toContain('Your earlier questions in this room and what RISE said in answer go with each new question, to the provider you chose; they are forgotten when you leave.');
        choose('mock');
        ask('What is time?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        answered(runtimes[0], [{ segmentId: 'p1', spoken: true, text: 'Time is what clocks measure.' }]);
        askAgain('Why?');
        await vi.waitFor(() => expect(runtimes[1]?.start).toHaveBeenCalled());
        const about = $('.rise-settings__about');
        about.open = true;
        about.dispatchEvent(new Event('toggle'));
        expect($('.rise-settings__about-text').textContent).toContain('earlier in this room: 1 turn, sent with this question');
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
            perception: { events: [{ type: 'replayed', from: 1, to: 1, times: 1, quote: 'One.' }], earlier: 0 },
            earlier: [{ asked: 'First?' }]
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

describe('catalog words: the reader names one of RISE’s own visuals (§24)', () => {
    async function playing(options = {}) {
        nextRuntime = options;
        mount('?voice=paced');
        ask('Why is the sky blue?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        return runtimes[0];
    }
    const note = () => $('.live-again__note').textContent;

    it('shows it at once: the reading goes on, nothing is asked of the model, and the bar says so for a few seconds', async () => {
        const runtime = await playing();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        try {
            askAgain('Show me the attractor.');
            expect(runtime.beginInterjection).toHaveBeenCalledTimes(1);
            expect(runtime.chooseVisual).toHaveBeenCalledWith({ engine: 'attractor', params: {} });
            expect(runtime.interject).not.toHaveBeenCalled();
            expect(runtime.status).toBe('live');
            expect($('#live-again-question').value).toBe('');
            expect(note()).toBe('Showing the attractor.');
            expect(host.venue.usage.requests).toEqual({ answer: 0, interject: 0, illustrate: 0, dive: 0 });
            runtime.set('live');
            expect(note()).toBe('Showing the attractor.');
            vi.advanceTimersByTime(4_000);
            expect(note()).toBe('');
        } finally {
            vi.useRealTimers();
        }
        expect(host.buildRuntime).toHaveBeenCalledTimes(1);
    });

    it('takes a cue on the engine running, in plain words', async () => {
        const runtime = await playing({ running: 'attractor' });
        askAgain('calmer');
        expect(runtime.chooseVisual).toHaveBeenCalledWith({ engine: 'attractor', cue: 'calm' });
        expect(note()).toBe('Making the attractor calmer.');
        expect(runtime.interject).not.toHaveBeenCalled();
    });

    it('asks the model as before for anything else, and for what the reading could not show', async () => {
        const runtime = await playing();
        askAgain('attractor, and why does it never repeat?');
        expect(runtime.chooseVisual).not.toHaveBeenCalled();
        await vi.waitFor(() => expect(runtime.interject).toHaveBeenCalledWith('attractor, and why does it never repeat?', expect.any(Object)));
        host.destroy();
        const refused = await playing({ chooses: false });
        askAgain('fractal flame');
        expect(refused.chooseVisual).toHaveBeenCalledWith({ engine: 'living-flame', params: {} });
        await vi.waitFor(() => expect(refused.interject).toHaveBeenCalledWith('fractal flame', expect.any(Object)));
    });

    it('before a reading and after one, a catalog word is a question for RISE, and the next reading is the model’s again', async () => {
        mount('?voice=paced');
        ask('attractor');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalledWith('attractor'));
        askAgain('swarm');
        expect(runtimes[0].chooseVisual).toHaveBeenCalledWith({ engine: 'attractor', params: { trace: 'swarm' } });
        runtimes[0].set('ended');
        askAgain('attractor');
        await vi.waitFor(() => expect(runtimes[1]?.start).toHaveBeenCalledWith('attractor', expect.any(Object)));
        expect(runtimes[1].chooseVisual).not.toHaveBeenCalled();
        expect(runtimes[0].chooseVisual).toHaveBeenCalledTimes(1);
    });
});

describe('the illustrator, as the venue shows it (stage 5.5)', () => {
    async function reading() {
        mount('?voice=paced');
        ask('What are the three states of water?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        return runtimes[0];
    }
    const about = () => {
        const panel = $('.rise-settings__about');
        panel.open = true;
        panel.dispatchEvent(new Event('toggle'));
        return $('.rise-settings__about-text').textContent.split('\n');
    };

    it('says in one line that RISE could not draw the picture, and that the reading goes on', async () => {
        const runtime = await reading();
        const state = runtime.snapshot();
        runtime.snapshot = () => ({ ...state, illustration: { drawing: 0, failed: 'REFUSED' } });
        runtime.set('live');
        expect($('.live-again__note').textContent).toBe('RISE could not draw that picture; the reading goes on.');
    });

    it('counts every request the room opens for the reading, the illustrator’s among them, and shows it in About', async () => {
        await reading();
        const adapter = await host.venueAdapter({});
        expect(adapter.id).toBe('mock');
        const connections = await Promise.all([
            adapter.open({ intent: 'answer', prompt: 'What are the three states of water?' }),
            adapter.open({ intent: 'illustrate', prompt: 'water', illustration: { medium: 'figure', attempt: 1, said: [] } }),
            adapter.open({ intent: 'illustrate', prompt: 'water', illustration: { medium: 'figure', attempt: 2, said: [] } })
        ]);
        await Promise.all(connections.map(connection => connection.close()));
        expect(about()).toContain('requests: 3 (1 answer, 2 illustrator), tokens: none reported (the demo spends nothing)');
    });

    it('passes the provider a way to say what each request cost, and adds it to the reading’s', async () => {
        await reading();
        host.venue.usage = { requests: { answer: 1, interject: 0, illustrate: 1, dive: 0 }, promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0, reported: false };
        const told = [];
        const providers = [{ id: 'mock', label: 'x', credential: 'none', adapter: async options => { told.push(options); return { id: 'mock', capabilities: {}, open: async () => ({}) }; } }];
        host.venue.providers = providers;
        host.venue.adapter = null;
        await host.venueAdapter({});
        told[0].onUsage({ model: 'a/b', promptTokens: 900, completionTokens: 100, totalTokens: 1_000, cost: 0.001 });
        expect(host.venue.usageLine()).toBe('requests: 2 (1 answer, 1 illustrator), tokens: 1,000 (900 in, 100 out), $0.0010');
    });
});

describe('who speaks (design §8 stage 7)', () => {
    const voiceRadio = value => $(`input[name="live-venue-voice"][value="${value}"]`);

    it('offers the device’s voice, chosen, and ElevenLabs on the reader’s key, whose field appears only when chosen', () => {
        mount();
        expect(voiceRadio('device').checked).toBe(true);
        expect($('#live-venue-voice-key')).toBeNull();
        expect($('.live-venue__privacy').textContent).toMatch(/The voice is your device’s own/u);
        voiceRadio('elevenlabs').checked = true;
        voiceRadio('elevenlabs').dispatchEvent(new Event('change', { bubbles: true }));
        expect(host.voiceChoice).toBe('elevenlabs');
        const field = $('#live-venue-voice-key');
        expect(field.type).toBe('password');
        expect($('label[for="live-venue-voice-key"]').textContent).toBe('Your ElevenLabs key');
        expect($('.live-venue__privacy').textContent).toMatch(/goes only to ElevenLabs, billed per character/u);
        voiceRadio('device').checked = true;
        voiceRadio('device').dispatchEvent(new Event('change', { bubbles: true }));
        expect($('#live-venue-voice-key')).toBeNull();
    });

    it('refuses to ask without the key, then keeps a typed key in the host’s memory and out of the page', async () => {
        mount();
        voiceRadio('elevenlabs').checked = true;
        voiceRadio('elevenlabs').dispatchEvent(new Event('change', { bubbles: true }));
        ask('Why is the sky blue?');
        expect($('.live-error').textContent).toMatch(/Enter your ElevenLabs key/u);
        expect(runtimes).toHaveLength(0);
        $('#live-venue-voice-key').value = ' xi-test-key ';
        ask('Why is the sky blue?');
        expect(host.voiceKey).toBe('xi-test-key');
        expect($('#live-venue-voice-key')?.value ?? '').toBe('');
        expect(document.body.innerHTML).not.toContain('xi-test-key');
        await vi.waitFor(() => expect(runtimes).toHaveLength(1));
        host.venue.destroy?.();
    });

    it('forgets the key when the device’s voice is chosen again', () => {
        mount();
        host.voiceChoice = 'elevenlabs';
        host.voiceKey = 'xi-test-key';
        voiceRadio('device').checked = true;
        voiceRadio('device').dispatchEvent(new Event('change', { bubbles: true }));
        expect(host.voiceKey).toBe('');
    });
});

describe('the face: RISE rests in the room, listens, thinks, and steps back while the reading speaks (§22)', () => {
    const face = () => $('.live-face');
    const engine = () => faces.at(-1);
    const typeIn = (field, words) => {
        field.value = words;
        field.dispatchEvent(new Event('input', { bubbles: true }));
    };

    it('rests in the entry at arrival, the still eye shown in Sophia until the engine has drawn', async () => {
        mount();
        expect(container.querySelector('.live-venue .live-face')).toBe(face());
        expect(face().dataset.faceState).toBe('arrival');
        expect(face().getAttribute('aria-hidden')).toBe('true');
        expect(face().querySelector('svg.live-face__still').dataset.skin).toBe('sophia');
        await vi.waitFor(() => expect(engine()).toBeTruthy());
        expect(engine().options).toMatchObject({ host: face().querySelector('.live-face__disc'), skin: 'sophia', state: 'arrival' });
        expect(engine().playing).toBe(true);
        expect(face().dataset.faceDrawn).toBe('false');
        engine().options.onFirstFrame();
        expect(face().dataset.faceDrawn).toBe('true');
    });

    it('wears the skin the reader kept, and keeps the one they choose in Settings', async () => {
        const kept = [];
        mount('?voice=paced', env(), { getSettings: () => ({ liveFace: 'jade' }), onSettingChange: (key, value) => kept.push([key, value]) });
        expect(face().dataset.faceSkin).toBe('jade');
        // The room wears the skin: its ground is the face's own dark.
        const rootStyle = () => document.documentElement.style;
        expect(rootStyle().getPropertyValue('--live-ground')).toBe('rgb(7, 12, 10)');
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        const choice = $('#rise-settings-face');
        expect([...choice.options].map(option => option.textContent)).toEqual(['Sophia', 'Ember', 'Jade', 'Silver']);
        expect(choice.value).toBe('jade');
        choice.value = 'ember';
        choice.dispatchEvent(new Event('change', { bubbles: true }));
        expect(kept).toEqual([['liveFace', 'ember']]);
        expect(face().dataset.faceSkin).toBe('ember');
        expect(face().querySelector('svg.live-face__still').dataset.skin).toBe('ember');
        await vi.waitFor(() => expect(engine()?.skins).toEqual(['ember']));
        expect(rootStyle().getPropertyValue('--live-ground')).toBe('rgb(14, 9, 8)');
        expect(rootStyle().getPropertyValue('--live-iris')).toBe('rgb(240, 163, 107)');
        host.destroy();
        host = null;
        expect(rootStyle().getPropertyValue('--live-ground')).toBe('');
    });

    it('listens while the reader types, thinks from the ask until the first words, then withdraws', async () => {
        nextRuntime = { segmentId: null };
        mount('?voice=paced');
        await vi.waitFor(() => expect(engine()).toBeTruthy());
        typeIn(question(), 'Why');
        expect(face().dataset.faceState).toBe('listening');
        typeIn(question(), '');
        expect(face().dataset.faceState).toBe('arrival');
        ask('Why is the sky blue?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        // Over the room now, not in the entry: the stage and the bar above it.
        expect(face().parentElement).toBe(document.body);
        expect(face().classList.contains('live-face--room')).toBe(true);
        expect(face().dataset.faceState).toBe('thinking');
        runtimes[0].shows('p1');
        expect(face().dataset.faceState).toBe('speaking');
        await vi.waitFor(() => expect(engine()?.cues).toEqual(['listening', 'arrival', 'thinking', 'speaking']));
        runtimes[0].set('ended');
        expect(face().dataset.faceState).toBe('rest');
        expect(engine().playing).toBe(true);
    });

    it('comes forward over a held reading for an interjection, and withdraws as the answer comes', async () => {
        mount('?voice=paced');
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        const runtime = runtimes[0];
        expect(face().dataset.faceState).toBe('speaking');
        typeIn($('#live-again-question'), 'Wait');
        expect(face().dataset.faceState).toBe('listening');
        $('.live-again').requestSubmit();
        await vi.waitFor(() => expect(face().dataset.faceState).toBe('thinking'));
        runtime.set('live', 'answering');
        expect(face().dataset.faceState).toBe('speaking');
    });

    it('rests when a question fails, and is gone with the room', async () => {
        mount('?voice=paced');
        host.buildRuntime = vi.fn(async () => { throw new Error('no'); });
        ask('First?');
        await vi.waitFor(() => expect(container.querySelector('.live-error').hidden).toBe(false));
        expect(face().dataset.faceState).toBe('rest');
        expect(container.querySelector('.live-venue .live-face')).toBe(face());
        await vi.waitFor(() => expect(engine()).toBeTruthy());
        host.destroy();
        expect(face()).toBeNull();
        expect(engine().destroyed).toBe(true);
        host = null;
    });

    it('holds still as soon as the reader asks for still imagery, without a reload', async () => {
        mount();
        await vi.waitFor(() => expect(engine()).toBeTruthy());
        const first = engine();
        expect(first.options.reducedMotion).toBe(false);
        document.documentElement.classList.add('reduced-motion');
        try {
            await vi.waitFor(() => expect(faces).toHaveLength(2));
            expect(first.destroyed).toBe(true);
            expect(engine().options).toMatchObject({ reducedMotion: true, state: 'arrival', skin: 'sophia' });
        } finally {
            document.documentElement.classList.remove('reduced-motion');
        }
        await vi.waitFor(() => expect(faces).toHaveLength(3));
        expect(engine().options.reducedMotion).toBe(false);
    });

    it('is never the model’s: the reading’s scenes and journal are not touched by it', async () => {
        mount('?voice=paced');
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalledWith('First?'));
        expect(runtimes[0].journal()).toEqual([{ type: 'start' }]);
        expect(document.querySelector('#chamber-field .live-face')).toBeNull();
    });
});

describe('the three frames: the face holds each visual the reading shows (§23)', () => {
    const engine = () => faces.at(-1);
    const root = () => document.documentElement;

    /** A window whose animation frames are cranked by hand, at the time given. */
    function cranked() {
        let due = new Map();
        let next = 1;
        const window = {
            ...env().window,
            requestAnimationFrame: callback => { const id = next; next += 1; due.set(id, callback); return id; },
            cancelAnimationFrame: id => due.delete(id)
        };
        const run = now => { const ready = due; due = new Map(); for (const callback of ready.values()) callback(now); };
        return { environment: { ...env(), window }, run, pending: () => due.size };
    }

    /** A room with a reading on screen, its Chamber showing `cue`; the engine drawn. */
    async function room(cue) {
        const frames = cranked();
        mount('?voice=paced', frames.environment);
        const field = document.createElement('div');
        field.id = 'chamber-field';
        document.body.append(field);
        const chamber = { cue, visualCue: () => chamber.cue };
        host.chamberPlaying = () => chamber;
        ask('First?');
        await vi.waitFor(() => expect(runtimes[0]?.start).toHaveBeenCalled());
        runtimes[0].playerFor = () => 'player';
        await vi.waitFor(() => expect(engine()).toBeTruthy());
        engine().options.onFirstFrame();
        let now = 0;
        const crank = (ms, step = 16) => { for (let gone = 0; gone < ms; gone += step) { now += step; frames.run(now); } };
        crank(16);
        return { frames, field, chamber, crank, runtime: runtimes[0] };
    }

    afterEach(() => {
        delete root().dataset.liveFrame;
        root().removeAttribute('style');
    });

    it('frames the visual on screen as it chooses: the root marked, the layers scaled by the one geometry the face is sent', async () => {
        const { field, crank } = await room({ kind: 'field', renderer: 'attractor', config: {} });
        crank(1700);
        expect(root().dataset.liveFrame).toBe('shell');
        const geometry = engine().places.at(-1);
        expect(geometry).toMatchObject({ frame: 'shell', aperture: { hole: 1, settle: 1 } });
        const half = Math.min(window.innerWidth, window.innerHeight) / 2;
        expect(Number(field.style.getPropertyValue('--live-vk'))).toBeCloseTo(geometry.aperture.r / half, 9);
        expect(field.style.getPropertyValue('--live-vx')).toBe(`${geometry.aperture.x - window.innerWidth / 2}px`);
    });

    it('opens the full frame for a figure, the face travelling to the dock by the bar', async () => {
        const { crank } = await room({ kind: 'scene', sceneId: 'h', svg: '<svg/>' });
        crank(2000);
        expect(root().dataset.liveFrame).toBe('full');
        const geometry = engine().places.at(-1);
        // jsdom lays nothing out, so the bar has no box: the dock is its place without one, at the top left.
        expect(geometry.small).toBe(1);
        expect(geometry.face.x).toBeCloseTo(40, 9);
        expect(geometry.face.y).toBeCloseTo(40, 9);
        expect(geometry.wipe).toMatchObject({ hole: 1 });
    });

    it('stands the frame still while the reader holds the reading, and goes on when they take it up', async () => {
        const { crank, runtime } = await room({ kind: 'procedural', collections: ['harmonograph'], config: {} });
        crank(320);
        const at = () => engine().places.at(-1);
        runtime.set('interrupted');
        const held = at();
        crank(2000);
        expect(at()).toEqual(held);
        runtime.set('live');
        crank(2000);
        expect(at()).toMatchObject({ frame: 'inner', aperture: { hole: 1 } });
    });

    it('changes the visual within a frame by one blink of the aperture, and the frame by closing it and opening the next', async () => {
        const { crank, chamber } = await room({ kind: 'field', renderer: 'attractor', config: {} });
        crank(1700);
        chamber.cue = { kind: 'procedural', collections: ['turrell'], config: {} };
        crank(160);
        expect(engine().places.at(-1)).toMatchObject({ frame: 'shell' });
        expect(engine().places.at(-1).aperture.hole).toBeLessThan(0.5);
        crank(600);
        expect(engine().places.at(-1).aperture.hole).toBe(1);
        chamber.cue = { kind: 'procedural', collections: ['harmonograph'], config: {} };
        crank(800);
        expect(engine().places.at(-1).frame).toBe('shell');
        crank(2000);
        expect(engine().places.at(-1)).toMatchObject({ frame: 'inner', aperture: { hole: 1 } });
    });

    it('closes to the eye when the reading ends, and leaves the root unmarked when the room is left', async () => {
        const { crank, runtime, field } = await room({ kind: 'field', renderer: 'attractor', config: {} });
        crank(1700);
        runtime.set('ended');
        crank(1700);
        expect(root().dataset.liveFrame).toBe('none');
        expect(field.style.getPropertyValue('--live-vk')).toBe('1');
        await host.venue.leave();
        expect(root().dataset.liveFrame).toBeUndefined();
        expect(field.style.getPropertyValue('--live-vk')).toBe('');
        expect(engine().places.at(-1)).toBe(null);
    });

    it('frames nothing while the face is not drawing: the visual whole, and the still eye aside', async () => {
        const { crank, field } = await room({ kind: 'field', renderer: 'attractor', config: {} });
        engine().options.onFailure({ phase: 'frame', message: 'slow' });
        crank(1700);
        expect(root().dataset.liveFrame).toBeUndefined();
        expect(field.style.getPropertyValue('--live-vk')).toBe('');
        expect($('.live-face').dataset.faceAside).toBe('true');
    });

    it('keeps the still eye in the room while the face is not drawing and nothing is to be framed', async () => {
        const { crank } = await room({ kind: 'still' });
        engine().options.onFailure({ phase: 'frame', message: 'slow' });
        crank(500);
        expect($('.live-face').dataset.faceAside).toBeUndefined();
        // The still eye is the room, its words at the foot: the root says there is no frame.
        expect(root().dataset.liveFrame).toBe('none');
    });
});
