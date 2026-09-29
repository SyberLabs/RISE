/**
 * The page before a Current begins.
 *
 * It is a prompt, a choice of voice, a plain statement of which provider is
 * answering, and what this device cannot do. The flow after Start is held by
 * the browser suite (e2e/live.spec.js); this holds what is decided before it:
 * what the reader is told, what is refused, and that nothing starts by itself.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { LiveHost } from './LiveHost.js';

const env = ({ speech = false, recognition = false, motion = false } = {}) => ({
    window: {
        ...(speech ? { speechSynthesis: { getVoices: () => [{ name: 'a' }] }, SpeechSynthesisUtterance: function Utterance() {} } : {}),
        ...(recognition ? { SpeechRecognition: function Recognition() {} } : {}),
        matchMedia: query => ({ matches: motion && query.includes('reduce') }),
        AudioContext: function Context() {}
    },
    navigator: {},
    document: { createElement: () => ({ getContext: () => ({}) }), fullscreenEnabled: true }
});

let host;
let container;

function mount(search = '', environment = env()) {
    container = document.createElement('div');
    document.body.appendChild(container);
    host = new LiveHost(container, { router: { navigate: async () => true, views: new Map() }, search, env: environment });
    return host;
}

afterEach(() => {
    host?.destroy();
    host = null;
    document.body.replaceChildren();
});

const notes = () => [...container.querySelectorAll('.live-notes li')].map(li => li.dataset.capability);

describe('what the reader sees first', () => {
    it('is a prompt with a sensible default, one Start, and a named heading', () => {
        mount();
        expect(container.querySelector('h1').textContent).toBe('Live Current');
        expect(container.querySelector('#live-prompt').value).toBe('Explain black holes with RISE.');
        expect(container.querySelector('label[for="live-prompt"]')).not.toBeNull();
        expect(container.querySelectorAll('.live-start')).toHaveLength(1);
        expect(container.querySelector('main').getAttribute('aria-labelledby')).toBe('live-title');
    });

    it('says which provider is answering, and that it is the offline demonstration one', () => {
        mount();
        expect(container.querySelector('.live-provider').textContent).toMatch(/Deterministic demo provider \(offline\)/u);
    });

    it('says plainly when a provider asked for is not available, and which is used instead', () => {
        mount('?provider=anthropic');
        const line = container.querySelector('.live-provider').textContent;
        expect(line).toMatch(/“anthropic” is not available/u);
        expect(line).toMatch(/Using: Deterministic demo provider/u);
        // A long, hostile name is cut, and shown as words.
        mount(`?provider=${'x'.repeat(200)}`);
        expect(container.querySelector('.live-provider').textContent.length).toBeLessThan(160);
        mount(`?provider=${encodeURIComponent('<img src=x onerror=alert(1)>')}`);
        expect(container.querySelector('.live-provider img')).toBeNull();
    });

    it('starts nothing by itself', () => {
        mount();
        expect(host.runtime).toBeNull();
        expect(document.querySelector('#live-controls')).toBeNull();
    });
});

describe('choosing a voice', () => {
    it('offers speaking, and a silent paced reading, and takes the choice from the address', () => {
        mount('?voice=paced');
        const select = container.querySelector('select[name="voice"]');
        expect([...select.options].map(option => option.value)).toEqual(['auto', 'browser', 'paced']);
        expect(select.value).toBe('paced');
        expect(mount('?voice=nonsense') && container.querySelector('select').value).toBe('auto');
    });

    it('speaks only where the device can, and otherwise paces the reading silently and says so', () => {
        mount('', env({ speech: true }));
        expect(host.selectedVoice()).toBe('browser');
        expect(notes()).not.toContain('speechOutput');

        mount('', env({ speech: false }));
        expect(host.selectedVoice()).toBe('paced');
        expect(container.querySelector('.live-notes').textContent).toMatch(/cannot speak/u);
    });

    it('takes the reader’s choice of silence over a device that could speak', () => {
        mount('?voice=paced', env({ speech: true }));
        expect(host.selectedVoice()).toBe('paced');
        expect(container.querySelector('.live-notes').textContent).toMatch(/Speech is off/u);
    });
});

describe('what this device cannot do is said, and only what it cannot', () => {
    it('lists what is missing', () => {
        mount('?voice=paced', env({ recognition: false }));
        expect(notes()).toEqual(expect.arrayContaining(['speechOutput', 'speechRecognition']));
    });

    it('says reduced motion is on when it is, and not when it is not', () => {
        mount('?voice=paced', env({ motion: true, recognition: true }));
        expect(notes()).toContain('reducedMotion');
        mount('?voice=paced', env({ motion: false, recognition: true }));
        expect(notes()).not.toContain('reducedMotion');
    });
});

describe('refusing, in words', () => {
    it('will not start on an empty prompt, and says why, and builds nothing', async () => {
        mount();
        container.querySelector('#live-prompt').value = '   ';
        await host.start();
        const error = container.querySelector('.live-error');
        expect(error.hidden).toBe(false);
        expect(error.textContent).toBe('Ask something first.');
        expect(host.runtime).toBeNull();
        expect(container.querySelector('.live-start').disabled).toBe(false);
    });
});

describe('leaving', () => {
    it('can be destroyed twice', () => {
        mount();
        host.destroy();
        expect(() => host.destroy()).not.toThrow();
        expect(container.children).toHaveLength(0);
    });
});

describe('the OpenAI provider, with the reader\u2019s own key', () => {
    const fakeRuntime = () => ({
        status: 'live',
        snapshot: () => ({ status: 'live', error: null, main: {}, side: null }),
        subscribe: () => () => {},
        composed: () => null,
        start: async () => {},
        stop: async () => {}
    });

    it('asks for the key in a password field that nothing may remember, and says where the key goes', () => {
        mount('?provider=openai&voice=paced');
        const field = container.querySelector('#live-key');
        expect(field.type).toBe('password');
        expect(field.autocomplete).toBe('off');
        expect(field.getAttribute('spellcheck')).toBe('false');
        expect(container.querySelector('label[for="live-key"]').textContent).toMatch(/Your OpenAI API key/u);
        const note = container.querySelector('.live-key-note').textContent;
        expect(note).toMatch(/memory only/u);
        expect(note).toMatch(/never stored/u);
        expect(note).toMatch(/billed to your key/u);
        expect(note).toMatch(/RISE pays for nothing/u);
        expect(container.querySelector('.live-provider').textContent).toMatch(/OpenAI Realtime, with your own key/u);
    });

    it('offers no key field, and asks nothing, for the default provider, or for one it does not know', () => {
        mount('?voice=paced');
        expect(container.querySelector('#live-key')).toBeNull();
        mount('?provider=nonsense');
        expect(container.querySelector('#live-key')).toBeNull();
        expect(host.chosenProvider()).toBe('mock');
        expect(container.querySelector('.live-provider').textContent).toMatch(/not available\. Using: Deterministic demo provider/u);
    });

    it('will not start without a key, says why, and builds nothing', async () => {
        mount('?provider=openai&voice=paced');
        let built = 0;
        host.buildRuntime = async () => { built += 1; return fakeRuntime(); };
        await host.start();
        expect(container.querySelector('.live-error').textContent).toBe('Enter your OpenAI key to use this provider.');
        expect(built).toBe(0);
        expect(host.key).toBe('');
    });

    it('takes the key into memory and empties the field at once, and forgets it when the session ends', async () => {
        mount('?provider=openai&voice=paced');
        host.buildRuntime = async () => fakeRuntime();
        container.querySelector('#live-key').value = '  sk-test-0123456789abcdefghijklmnop  ';
        await host.start();
        expect(host.key).toBe('sk-test-0123456789abcdefghijklmnop');
        expect(container.querySelector('#live-key').value).toBe('');
        expect(container.innerHTML).not.toContain('sk-test');
        await host.stop();
        expect(host.key).toBe('');
    });

    it('forgets a key that was refused, keeps one that failed for another reason, and says what happened', async () => {
        mount('?provider=openai&voice=paced');
        host.buildRuntime = async () => { throw Object.assign(new Error('OpenAI refused the key.'), { code: 'KEY_REFUSED' }); };
        container.querySelector('#live-key').value = 'sk-test-0123456789abcdefghijklmnop';
        await host.start();
        expect(host.key).toBe('');
        expect(container.querySelector('.live-error').textContent).toContain('OpenAI refused the key.');

        mount('?provider=openai&voice=paced');
        host.buildRuntime = async () => { throw Object.assign(new Error('This site could not be reached.'), { code: 'NETWORK' }); };
        container.querySelector('#live-key').value = 'sk-test-0123456789abcdefghijklmnop';
        await host.start();
        expect(host.key).toBe('sk-test-0123456789abcdefghijklmnop');
        expect(container.querySelector('.live-start').disabled).toBe(false);
    });

    it('keeps the key out of everything it renders, including a hostile provider name', () => {
        mount('?provider=openai');
        container.querySelector('#live-key').value = 'sk-test-0123456789abcdefghijklmnop';
        expect(container.querySelector('.live-provider').textContent).not.toContain('sk-');
    });
});
