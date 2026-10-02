/**
 * The page before a Current begins.
 *
 * It is a prompt, a choice of voice, a plain statement of which provider is
 * answering, and what this device cannot do. The flow after Start is held by
 * the browser suite (e2e/live.spec.js); this holds what is decided before it:
 * what the reader is told, what is refused, and that nothing starts by itself.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveHost, framedBy } from './LiveHost.js';
import { createVirtualClock } from '../clock.js';
import { createMockAdapter } from '../adapters/mock.js';
import { BLACK_HOLES_CURRENT } from '../../test/sealed-current.js';

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
    it('refuses unknown and specimen-only catalog choices before building a runtime', async () => {
        for (const [search, message] of [
            ['?catalog=unknown', /not in the visual catalog/u],
            ['?catalog=turrell', /specimen only/u]
        ]) {
            mount(search);
            const build = vi.spyOn(host, 'buildRuntime');
            await host.start();
            expect(container.querySelector('.live-error').textContent).toMatch(message);
            expect(build).not.toHaveBeenCalled();
        }
    });

    it('uses an honest still opening when a known catalog choice lacks a 2D context', async () => {
        mount('?catalog=klee', { window: {}, navigator: {}, document: { createElement: () => ({ getContext: () => null }) } });
        const build = vi.spyOn(host, 'buildRuntime').mockRejectedValue(new Error('test stop before runtime'));
        await host.start();
        expect(container.querySelector('.live-catalog-note').textContent).toMatch(/drawing is unavailable.*without imagery/iu);
        expect(host.openingVisual).toBe('still');
        expect(build).toHaveBeenCalledTimes(1);
    });

    it('rejects catalog choices in keyed, embed, and evaluation modes before starting them', async () => {
        mount('?catalog=attractor&provider=openai');
        expect(container.querySelector('.live-error').textContent).toMatch(/only available in the offline demonstration/u);
        const start = vi.spyOn(host, 'start');
        await host.start();
        expect(start).toHaveBeenCalledTimes(1);
        expect(host.runtime).toBeNull();
        expect(host.modules).toBeUndefined();

        for (const search of ['?catalog=attractor&embed=mcp', '?catalog=attractor&eval=1']) {
            mount(search);
            expect(container.querySelector('.live-error').textContent).toMatch(/only available in the offline demonstration/u);
            expect(host.modules).toBeUndefined();
            await host.start();
            expect(host.runtime).toBeNull();
        }
    });

    it('admits catalog choices when an unknown provider falls back to mock, including differently cased names', async () => {
        for (const search of ['?catalog=klee&provider=GEMINI', '?catalog=klee&provider=nonsense']) {
            mount(search);
            expect(host.chosenProvider()).toBe('mock');
            expect(container.querySelector('.live-error').hidden).toBe(true);
            expect(container.querySelector('.live-catalog-note').textContent).toBe('This sample begins with klee.');
            expect(host.catalogConflict).toBe(false);
        }
    });

    it('revalidates the sample inside the mock-adapter path and chooses genesis or still', async () => {
        for (const [search, environment, expected] of [
            ['?catalog=klee', env(), 'genesis'],
            ['?catalog=attractor', { window: {}, navigator: {}, document: { createElement: () => ({ getContext: () => null }) } }, 'still']
        ]) {
            mount(search, environment);
            const clock = createVirtualClock();
            const adapter = await host.buildAdapter(clock, createMockAdapter);
            const connection = await adapter.open({ intent: 'answer', prompt: 'Explain black holes with RISE.' });
            const events = [];
            const drained = (async () => { for await (const event of connection.events) events.push(event); })();
            await clock.runAll();
            await drained;
            expect(events.find(event => event.type === 'segment.begin').visual).toBe(expected);
            await connection.close();
        }
    });

    it('links back to the searchable catalog', () => {
        mount();
        expect(container.querySelector('a[href="/visual-catalog"]')?.textContent).toMatch(/browse visuals/i);
    });

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

    it('starts nothing, and keeps no key, when the page is left while it is still getting ready', async () => {
        mount('?provider=openai&voice=paced');
        let ready;
        const runtime = { ...fakeRuntime(), start: vi.fn(async () => {}) };
        host.buildRuntime = () => new Promise(resolve => { ready = () => resolve(runtime); });
        container.querySelector('#live-key').value = 'sk-test-0123456789abcdefghijklmnop';
        const starting = host.start();
        host.destroy();
        ready();
        await starting;
        expect(runtime.start).not.toHaveBeenCalled();
        expect({ runtime: host.runtime, controls: host.controls, key: host.key }).toEqual({ runtime: null, controls: null, key: '' });
    });

    it('keeps the key out of everything it renders, including a hostile provider name', () => {
        mount('?provider=openai');
        container.querySelector('#live-key').value = 'sk-test-0123456789abcdefghijklmnop';
        expect(container.querySelector('.live-provider').textContent).not.toContain('sk-');
    });
});

describe('the Gemini provider, with the reader’s own key', () => {
    const KEY = 'AIzaSyD-test-key-0000000000000000000000';
    const fakeRuntime = () => ({
        status: 'live',
        snapshot: () => ({ status: 'live', error: null, main: {}, side: null }),
        subscribe: () => () => {},
        composed: () => null,
        start: async () => {},
        stop: async () => {}
    });

    it('asks for the key in a password field that nothing may remember, and says the key goes from this browser to Google and not to this site', () => {
        mount('?provider=gemini&voice=paced');
        const field = container.querySelector('#live-key');
        expect(field.type).toBe('password');
        expect(field.autocomplete).toBe('off');
        expect(field.getAttribute('spellcheck')).toBe('false');
        expect(container.querySelector('label[for="live-key"]').textContent).toMatch(/Your Gemini API key/u);
        const note = container.querySelector('.live-key-note').textContent;
        expect(note).toMatch(/memory only/u);
        expect(note).toMatch(/never stored/u);
        expect(note).toMatch(/straight to Google/u);
        expect(note).toMatch(/never to this site/u);
        expect(note).toMatch(/billed to your key/u);
        expect(note).toMatch(/RISE pays for nothing/u);
        expect(container.querySelector('.live-provider').textContent).toMatch(/Google Gemini, with your own key/u);
    });

    it('offers a model, named for what it is, with the default filled in, and only for this provider', () => {
        mount('?provider=gemini&voice=paced');
        const model = container.querySelector('#live-model');
        expect(model.type).toBe('text');
        expect(model.value).toBe('gemini-3.5-flash');
        expect(model.maxLength).toBe(64);
        expect(model.autocomplete).toBe('off');
        expect(container.querySelector('label[for="live-model"]').textContent).toMatch(/Model/u);
        mount('?provider=openai&voice=paced');
        expect(container.querySelector('#live-model')).toBeNull();
        mount('?voice=paced');
        expect(container.querySelector('#live-model')).toBeNull();
        expect(container.querySelector('#live-key')).toBeNull();
    });

    it('will not start without a key, says why, and builds nothing', async () => {
        mount('?provider=gemini&voice=paced');
        let built = 0;
        host.buildRuntime = async () => { built += 1; return fakeRuntime(); };
        await host.start();
        expect(container.querySelector('.live-error').textContent).toBe('Enter your Gemini key to use this provider.');
        expect(built).toBe(0);
        expect(host.key).toBe('');
    });

    it('takes the key into memory and empties the field at once, keeps the model as typed, and forgets the key when the session ends', async () => {
        mount('?provider=gemini&voice=paced');
        host.buildRuntime = async () => fakeRuntime();
        container.querySelector('#live-key').value = `  ${KEY}  `;
        container.querySelector('#live-model').value = ' gemini-2.0-pro ';
        await host.start();
        expect(host.key).toBe(KEY);
        expect(host.model).toBe('gemini-2.0-pro');
        expect(container.querySelector('#live-key').value).toBe('');
        expect(container.innerHTML).not.toContain('AIza');
        await host.stop();
        expect(host.key).toBe('');
    });

    it('uses the default model when the field is emptied', async () => {
        mount('?provider=gemini&voice=paced');
        host.buildRuntime = async () => fakeRuntime();
        container.querySelector('#live-key').value = KEY;
        container.querySelector('#live-model').value = '   ';
        await host.start();
        expect(host.model).toBeUndefined();
    });

    it('forgets a key that was refused, keeps one that failed for another reason, and says what happened', async () => {
        mount('?provider=gemini&voice=paced');
        host.buildRuntime = async () => { throw Object.assign(new Error('Google did not accept that key: API key not valid.'), { code: 'KEY_REFUSED' }); };
        container.querySelector('#live-key').value = KEY;
        await host.start();
        expect(host.key).toBe('');
        expect(container.querySelector('.live-error').textContent).toContain('Google did not accept that key');

        mount('?provider=gemini&voice=paced');
        host.buildRuntime = async () => { throw Object.assign(new Error('Could not reach Google.'), { code: 'CONNECT_FAILED' }); };
        container.querySelector('#live-key').value = KEY;
        await host.start();
        expect(host.key).toBe(KEY);
        expect(container.querySelector('.live-start').disabled).toBe(false);
    });

    it('builds an adapter that makes its request with the key and the model as they are at that moment, straight to Google', async () => {
        mount('?provider=gemini&voice=paced');
        const requests = [];
        vi.stubGlobal('fetch', vi.fn(async (url, init) => {
            requests.push({ url, key: init.headers['x-goog-api-key'] });
            return new Response('data: {"candidates":[{"content":{"parts":[{"text":"@passage visual=still\\nHi.\\n@end\\n"}]},"finishReason":"STOP"}]}\n\n', { status: 200 });
        }));
        try {
            host.providerName = 'gemini';
            host.key = KEY;
            host.model = 'gemini-2.0-pro';
            const adapter = await host.buildAdapter({}, () => { throw new Error('the mock must not be used'); });
            expect(adapter.id).toBe('gemini-stream');
            await adapter.open({ intent: 'answer', prompt: 'Hello' });
            // The key and model can change, or be forgotten, after the adapter is built.
            host.key = 'a-different-key-000000000000000';
            host.model = undefined;
            await adapter.open({ intent: 'answer', prompt: 'Again' });
            expect(requests).toEqual([
                { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro:streamGenerateContent?alt=sse', key: KEY },
                { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse', key: 'a-different-key-000000000000000' }
            ]);
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('is one of the providers the page knows, and the others are unchanged', () => {
        mount('?provider=gemini');
        expect(host.chosenProvider()).toBe('gemini');
        mount('?provider=openai');
        expect(host.chosenProvider()).toBe('openai');
        mount('?provider=GEMINI');
        expect(host.chosenProvider()).toBe('mock');
    });

    it('keeps the key out of everything it renders', () => {
        mount('?provider=gemini');
        container.querySelector('#live-key').value = KEY;
        expect(container.querySelector('.live-provider').textContent).not.toContain('AIza');
        expect(container.querySelector('.live-key-note').textContent).not.toContain('AIza');
    });
});

describe('speaking to it', () => {
    it('is fetched and offered only where the browser can recognise speech', async () => {
        mount('', env());
        expect(host.micModules).toBeNull();
        expect(await host.buildMic()).toBeNull();

        host.destroy();
        mount('', env({ recognition: true }));
        const mic = await host.buildMic();
        expect(mic).toMatchObject({ privacy: expect.stringMatching(/browser maker/u) });
        for (const name of ['createListener', 'interpret', 'describe']) expect(typeof mic[name], name).toBe('function');
    });

    it('listens with the browser’s own recogniser, in English because the grammar is English', async () => {
        const seen = [];
        const environment = env();
        environment.window.SpeechRecognition = function Recognition() { seen.push(this); };
        mount('', environment);
        const mic = await host.buildMic();
        const listener = mic.createListener({});
        listener.start();
        expect(seen).toHaveLength(1);
        expect(seen[0].lang).toBe('en-US');
        listener.destroy();
    });

    it('says, on the page before Start, that speaking is unavailable when it is, and offers no button then', () => {
        mount('', env());
        expect(notes()).toContain('speechRecognition');
        expect(document.querySelector('[data-live="listen"]')).toBeNull();
    });
});

describe('the runtime visual bridge', () => {
    it('only discovers and controls the mounted Chamber for the exact runtime Player', async () => {
        mount('?voice=paced');
        const router = {
            current: 'live',
            views: new Map(),
            getCurrentView() { return this.current; },
            getViewInstance(name) { return this.views.get(name)?.instance ?? null; },
            async navigate(name, options = {}) {
                this.current = name;
                if (name === 'chamber-session') {
                    const { takeLivePlayer } = await import('../../app/live-handoff.js');
                    const player = takeLivePlayer(options.data);
                    this.views.set(name, { instance: {
                        player,
                        discoverVisual: () => ({ manifest: { surface: 'attractor' }, current: { intensity: 0.65 }, target: { intensity: 0.65 } }),
                        controlVisual: vi.fn(command => ({ status: 'accepted', effective: command.value }))
                    } });
                }
                return true;
            }
        };
        host.router = router;
        host.buildVoices = async () => null;
        await host.start();
        await new Promise(resolve => setTimeout(resolve, 250));
        const player = host.runtime.playerFor();
        const chamber = router.getViewInstance('chamber-session');
        expect(chamber.player).toBe(player);
        expect(host.runtime.discoverVisual()).toMatchObject({ current: { intensity: 0.65 } });
        expect(host.runtime.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 0.7 }))
            .toMatchObject({ status: 'accepted', requested: 0.7, effective: 0.7 });
        expect(chamber.controlVisual).toHaveBeenCalledWith({ surface: 'attractor', parameter: 'intensity', value: 0.7 });

        chamber.player = {};
        expect(host.runtime.discoverVisual()).toBeNull();
        expect(host.runtime.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 0.7 }))
            .toEqual({ status: 'refused', code: 'NO_ACTIVE_VISUAL' });
        chamber.player = player;
        router.current = 'portal';
        expect(host.runtime.discoverVisual()).toBeNull();
        expect(host.runtime.controlVisual({ surface: 'attractor', parameter: 'intensity', value: 0.7 }))
            .toEqual({ status: 'refused', code: 'NO_ACTIVE_VISUAL' });
        await host.stop();
    });
});

describe('inside an MCP host', () => {
    /** A window with a parent that records what it is sent, and can answer. */
    function framed({ answer, initialCurrent = false } = {}) {
        const listeners = new Set();
        const sent = [];
        const environment = env();
        const host = {
            postMessage(message) {
                sent.push(message);
                if (initialCurrent && message.method === 'ui/notifications/initialized') {
                    queueMicrotask(() => answerCurrent(hostSays));
                }
                const reply = answer?.(message);
                if (reply) queueMicrotask(() => { for (const fn of [...listeners]) fn({ source: host, data: { jsonrpc: '2.0', id: message.id, ...reply } }); });
            }
        };
        Object.assign(environment.window, {
            parent: host,
            innerWidth: 390,
            addEventListener: (type, fn) => { if (type === 'message') listeners.add(fn); },
            removeEventListener: (type, fn) => { if (type === 'message') listeners.delete(fn); }
        });
        const hostSays = data => { for (const fn of [...listeners]) fn({ source: host, data }); };
        return { environment, sent, listeners, hostSays };
    }
    const answerCurrent = (hostSays, current = BLACK_HOLES_CURRENT, method = 'ui/notifications/tool-input') => hostSays({
        jsonrpc: '2.0', method,
        params: method === 'ui/notifications/tool-input' ? { arguments: { current } } : { structuredContent: { current } }
    });
    const line = () => container.querySelector('.live-embed');

    it('has no prompt, no provider to choose, and waits for a reader click after the host’s answer is ready', async () => {
        const { environment } = framed();
        mount('?embed=mcp&voice=paced', environment);
        expect(container.querySelector('.live-ask')).toBeNull();
        expect(container.querySelector('.live-start')).toBeNull();
        expect(container.querySelector('.live-key')).toBeNull();
        expect(host.embedded).toBe(true);
        await vi.waitFor(() => expect(line().textContent).toBe('Waiting for the answer…'));
    });

    it('holds the admitted Current until Begin, then starts that answer once despite duplicate delivery and clicks', async () => {
        const { environment, sent, listeners, hostSays } = framed();
        mount('?embed=mcp&voice=paced', environment);
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        const hello = sent[0];
        hostSays({ jsonrpc: '2.0', id: hello.id, result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} } });
        await vi.waitFor(() => expect(sent.some(message => message.method === 'ui/notifications/size-changed')).toBe(true));
        answerCurrent(hostSays);
        await vi.waitFor(() => expect(container.querySelector('.live-start')?.disabled).toBe(false));
        const begin = container.querySelector('.live-start');
        expect(begin.textContent).toBe('Begin');
        expect(begin.getAttribute('type')).toBe('button');
        expect(begin.getAttribute('aria-label')).toBeNull();
        expect(host.runtime).toBeNull();
        expect(document.querySelector('#live-controls')).toBeNull();

        const runtime = { start: vi.fn(async () => {}), stop: vi.fn(async () => {}), status: 'live', snapshot: () => ({ status: 'live' }), subscribe: () => () => {}, composed: () => null };
        host.buildRuntime = vi.fn(async () => runtime);
        host.buildMic = async () => null;
        // The same sealed Current may be delivered in both MCP notifications.
        answerCurrent(hostSays, BLACK_HOLES_CURRENT, 'ui/notifications/tool-result');
        begin.click();
        begin.click();
        await vi.waitFor(() => expect(runtime.start).toHaveBeenCalledTimes(1));
        expect(host.buildRuntime).toHaveBeenCalledTimes(1);
        expect(runtime.start).toHaveBeenCalledWith('The answer the assistant presents');
        expect(listeners.size).toBe(1);
        await host.stop();
    });

    it('removes the Current listener when a buffered answer is delivered during subscription', async () => {
        const { environment, sent } = framed({
            initialCurrent: true,
            answer: message => (message.method === 'ui/initialize' ? { result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} } } : null)
        });
        mount('?embed=mcp&voice=paced', environment);
        await vi.waitFor(() => expect(sent.some(message => message.method === 'ui/notifications/initialized')).toBe(true));
        await vi.waitFor(() => expect(container.querySelector('.live-start')?.textContent).toBe('Begin'));
        expect(host.stopListeningCurrent).toBeNull();
    });

    it('does not offer Begin for an invalid Current', async () => {
        const { environment, sent, hostSays } = framed();
        mount('?embed=mcp&voice=paced', environment);
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        hostSays({ jsonrpc: '2.0', id: sent[0].id, result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} } });
        await vi.waitFor(() => expect(sent.some(message => message.method === 'ui/notifications/size-changed')).toBe(true));
        const invalid = { ...BLACK_HOLES_CURRENT, segments: [{ id: 'bad', text: 'left | right' }] };
        answerCurrent(hostSays, invalid);
        await vi.waitFor(() => expect(line().getAttribute('role')).toBe('alert'));
        expect(line().textContent).toMatch(/refused/u);
        expect(line().textContent).toMatch(/Ask the assistant again/u);
        expect(container.querySelector('.live-start')).toBeNull();
        expect(host.runtime).toBeNull();
    });

    it('keeps listening after refusing one proposal so a corrected Current can be played', async () => {
        const { environment, sent, hostSays } = framed();
        mount('?embed=mcp&voice=paced', environment);
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        hostSays({ jsonrpc: '2.0', id: sent[0].id, result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} } });
        await vi.waitFor(() => expect(sent.some(message => message.method === 'ui/notifications/size-changed')).toBe(true));
        answerCurrent(hostSays, { ...BLACK_HOLES_CURRENT, segments: [{ id: 'bad', text: 'left | right' }] });
        await vi.waitFor(() => expect(line().getAttribute('role')).toBe('alert'));
        expect(container.querySelector('.live-start')).toBeNull();
        answerCurrent(hostSays, { ...BLACK_HOLES_CURRENT, id: 'corrected' });
        await vi.waitFor(() => expect(container.querySelector('.live-start')?.textContent).toBe('Begin'));
        expect(host.embeddedEvents).not.toBeNull();
        await host.stop();
    });

    it('does not restore Begin when an oversized refusal wins while validation is pending', async () => {
        const { environment, sent, hostSays } = framed();
        mount('?embed=mcp&voice=paced', environment);
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        hostSays({ jsonrpc: '2.0', id: sent[0].id, result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} } });
        await vi.waitFor(() => expect(sent.some(message => message.method === 'ui/notifications/size-changed')).toBe(true));
        let resolveValidation;
        host.validateEmbeddedCurrent = vi.fn(() => new Promise(resolve => { resolveValidation = resolve; }));
        answerCurrent(hostSays);
        await vi.waitFor(() => expect(host.validateEmbeddedCurrent).toHaveBeenCalledTimes(1));
        hostSays({ jsonrpc: '2.0', method: 'ui/notifications/tool-input', params: { arguments: { current: BLACK_HOLES_CURRENT }, metadata: 'x'.repeat(262_144) } });
        await vi.waitFor(() => expect(line().getAttribute('role')).toBe('alert'));
        resolveValidation(null);
        await vi.waitFor(() => expect(host.embeddedCurrentProcessing).toBe(false));
        expect(line().textContent).toContain('too large');
        expect(container.querySelector('.live-start')).toBeNull();
        expect(host.embeddedEvents).toBeNull();
        await host.stop();
    });

    it('discards queued unbegun proposals when a transport refusal arrives', async () => {
        const { environment, sent, hostSays } = framed();
        mount('?embed=mcp&voice=paced', environment);
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        hostSays({ jsonrpc: '2.0', id: sent[0].id, result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} } });
        await vi.waitFor(() => expect(sent.some(message => message.method === 'ui/notifications/size-changed')).toBe(true));
        let resolveValidation;
        host.validateEmbeddedCurrent = vi.fn(() => new Promise(resolve => { resolveValidation = resolve; }));
        answerCurrent(hostSays);
        await vi.waitFor(() => expect(host.validateEmbeddedCurrent).toHaveBeenCalledTimes(1));
        answerCurrent(hostSays, { ...BLACK_HOLES_CURRENT, id: 'queued' });
        hostSays({ jsonrpc: '2.0', method: 'ui/notifications/tool-input', params: { arguments: { current: BLACK_HOLES_CURRENT }, metadata: 'x'.repeat(262_144) } });
        await vi.waitFor(() => expect(line().getAttribute('role')).toBe('alert'));
        resolveValidation({ stale: true });
        await vi.waitFor(() => expect(host.embeddedCurrentProcessing).toBe(false));
        expect(host.validateEmbeddedCurrent).toHaveBeenCalledTimes(1);
        expect(container.querySelector('.live-start')).toBeNull();
        expect(host.embeddedEvents).toBeNull();
        await host.stop();
    });

    it('keeps an immediate corrected proposal while the first proposal is still validating', async () => {
        const { environment, sent, hostSays } = framed();
        mount('?embed=mcp&voice=paced', environment);
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        hostSays({ jsonrpc: '2.0', id: sent[0].id, result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} } });
        await vi.waitFor(() => expect(sent.some(message => message.method === 'ui/notifications/size-changed')).toBe(true));
        let rejectFirst;
        host.validateEmbeddedCurrent = vi.fn()
            .mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = reject; }))
            .mockResolvedValueOnce({ corrected: true });
        answerCurrent(hostSays, { ...BLACK_HOLES_CURRENT, segments: [{ id: 'bad', text: 'left | right' }] });
        await vi.waitFor(() => expect(host.validateEmbeddedCurrent).toHaveBeenCalledTimes(1));
        answerCurrent(hostSays, { ...BLACK_HOLES_CURRENT, id: 'corrected' });
        rejectFirst(new Error('refused first proposal'));
        await vi.waitFor(() => expect(host.validateEmbeddedCurrent).toHaveBeenCalledTimes(2));
        await vi.waitFor(() => expect(container.querySelector('.live-start')?.textContent).toBe('Begin'));
        expect(line().textContent).toBe('Answer ready.');
        await host.stop();
    });

    it('does not let a refused oversized trusted envelope leave stale Begin content', async () => {
        const { environment, sent, hostSays } = framed();
        mount('?embed=mcp&voice=paced', environment);
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        hostSays({ jsonrpc: '2.0', id: sent[0].id, result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} } });
        await vi.waitFor(() => expect(sent.some(message => message.method === 'ui/notifications/size-changed')).toBe(true));
        answerCurrent(hostSays);
        await vi.waitFor(() => expect(container.querySelector('.live-start')?.textContent).toBe('Begin'));
        hostSays({ jsonrpc: '2.0', method: 'ui/notifications/tool-input', params: { arguments: { current: BLACK_HOLES_CURRENT }, metadata: 'x'.repeat(262_144) } });
        await vi.waitFor(() => expect(line().getAttribute('role')).toBe('alert'));
        expect(line().textContent).toContain('too large');
        expect(container.querySelector('.live-start')).toBeNull();
        expect(host.embeddedEvents).toBeNull();
        await host.stop();
    });

    it('discards a ready Current when the reader stops before Begin', async () => {
        const { environment, sent, listeners, hostSays } = framed();
        mount('?embed=mcp&voice=paced', environment);
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        hostSays({ jsonrpc: '2.0', id: sent[0].id, result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} } });
        await vi.waitFor(() => expect(sent.some(message => message.method === 'ui/notifications/size-changed')).toBe(true));
        answerCurrent(hostSays);
        await vi.waitFor(() => expect(container.querySelector('.live-start')?.textContent).toBe('Begin'));

        await host.stop();
        expect(host.embeddedEvents).toBeNull();
        expect(host.port).toBeNull();
        expect(listeners.size).toBe(0);
        expect(container.querySelector('.live-start')).toBeNull();
        expect(host.runtime).toBeNull();
    });

    it('discards a ready Current when the host tears down before Begin', async () => {
        const { environment, sent, listeners, hostSays } = framed();
        mount('?embed=mcp&voice=paced', environment);
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        hostSays({ jsonrpc: '2.0', id: sent[0].id, result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} } });
        await vi.waitFor(() => expect(sent.some(message => message.method === 'ui/notifications/size-changed')).toBe(true));
        answerCurrent(hostSays);
        await vi.waitFor(() => expect(container.querySelector('.live-start')?.textContent).toBe('Begin'));

        hostSays({ jsonrpc: '2.0', id: 'teardown-before-begin', method: 'ui/resource-teardown', params: {} });
        await vi.waitFor(() => expect(line().textContent).toContain('Finished.'));
        expect(host.embeddedEvents).toBeNull();
        expect(host.port).toBeNull();
        expect(listeners.size).toBe(0);
        expect(container.querySelector('.live-start')).toBeNull();
        expect(host.runtime).toBeNull();
    });

    it('says hello to its parent, with the extension’s protocol version and nothing that names a key or a prompt', async () => {
        const { environment, sent } = framed();
        mount('?embed=mcp', environment);
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        expect(sent[0]).toMatchObject({ jsonrpc: '2.0', method: 'ui/initialize', params: { appInfo: { name: 'RISE' }, protocolVersion: '2026-01-26' } });
        expect(JSON.stringify(sent[0])).not.toMatch(/key|prompt/iu);
    });

    it('says in words why it could not start, when the host refuses to say hello', async () => {
        const { environment } = framed({ answer: message => (message.method === 'ui/initialize' ? { error: { code: -1, message: 'not for you' } } : null) });
        mount('?embed=mcp', environment);
        await vi.waitFor(() => expect(line().textContent).toBe('Could not start: not for you'));
        expect(line().closest('main').querySelector('[role="alert"]')).not.toBeNull();
        expect(host.runtime).toBeNull();
    });

    it('says it is meant to be opened by an assistant, and sends nothing, when there is no host to say hello to', () => {
        const environment = env();
        environment.window.parent = environment.window;
        mount('?embed=mcp', environment);
        expect(line().textContent).toMatch(/Open it from one/u);
        expect(line().closest('[role="alert"]') ?? line().getAttribute('role')).toBeTruthy();
    });

    it('lets go of the host’s messages when it is destroyed', async () => {
        const { environment, listeners, sent } = framed();
        mount('?embed=mcp', environment);
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        expect(listeners.size).toBe(1);
        host.destroy();
        expect(listeners.size).toBe(0);
    });

    it('closes the guest port and discards its messages when the reader ends', async () => {
        const { environment, sent, listeners, hostSays } = framed({
            initialCurrent: true,
            answer: message => (message.method === 'ui/initialize' ? { result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} } } : null)
        });
        mount('?embed=mcp&voice=paced', environment);
        await vi.waitFor(() => expect(container.querySelector('.live-start')?.textContent).toBe('Begin'));

        await host.ended();

        expect(host.embeddedEvents).toBeNull();
        expect(host.stopListeningCurrent).toBeNull();
        expect(host.port).toBeNull();
        expect(listeners.size).toBe(0);
        expect(document.querySelector('#live-controls')).toBeNull();
        const sentAfterEnd = sent.length;
        hostSays({ jsonrpc: '2.0', id: 'after-ended-ping', method: 'ping', params: {} });
        answerCurrent(hostSays);
        expect(sent).toHaveLength(sentAfterEnd);
    });

    it('does not recreate playback after teardown during delayed runtime startup', async () => {
        let releaseRuntime;
        const runtime = {
            status: 'live',
            snapshot: () => ({ status: 'live', error: null, main: {}, side: null }),
            subscribe: () => () => {},
            composed: () => null,
            start: vi.fn(async () => {}),
            stop: vi.fn(async () => {})
        };
        const { environment, sent, listeners, hostSays } = framed({ answer: () => null });
        mount('?embed=mcp&voice=paced', environment);
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        hostSays({ jsonrpc: '2.0', id: sent[0].id, result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} } });
        await vi.waitFor(() => expect(sent.some(message => message.method === 'ui/notifications/size-changed')).toBe(true));
        answerCurrent(hostSays);
        await vi.waitFor(() => expect(container.querySelector('.live-start')?.disabled).toBe(false));
        host.buildRuntime = () => new Promise(resolve => { releaseRuntime = () => resolve(runtime); });
        container.querySelector('.live-start').click();
        await vi.waitFor(() => expect(releaseRuntime).toBeTypeOf('function'));

        hostSays({ jsonrpc: '2.0', id: 'teardown-startup', method: 'ui/resource-teardown', params: {} });
        expect(sent.some(message => message.id === 'teardown-startup' && message.result)).toBe(true);

        releaseRuntime();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(runtime.start).not.toHaveBeenCalled();
        expect(document.querySelector('#live-controls')).toBeNull();
        expect(runtime.stop).toHaveBeenCalledTimes(1);
        expect(host.runtime).toBeNull();
        expect(host.port).toBeNull();
    });

    it('does not recreate controls if teardown arrives while microphone startup is delayed', async () => {
        let releaseMic;
        const runtime = {
            status: 'live',
            snapshot: () => ({ status: 'live', error: null, main: {}, side: null }),
            subscribe: () => () => {},
            composed: () => null,
            start: vi.fn(async () => {}),
            stop: vi.fn(async () => {})
        };
        const { environment, sent, listeners, hostSays } = framed({ answer: () => null });
        mount('?embed=mcp&voice=paced', environment);
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        hostSays({ jsonrpc: '2.0', id: sent[0].id, result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} } });
        await vi.waitFor(() => expect(sent.some(message => message.method === 'ui/notifications/size-changed')).toBe(true));
        answerCurrent(hostSays);
        await vi.waitFor(() => expect(container.querySelector('.live-start')?.disabled).toBe(false));
        host.buildRuntime = async () => runtime;
        host.buildMic = () => new Promise(resolve => { releaseMic = () => resolve(null); });
        container.querySelector('.live-start').click();
        await vi.waitFor(() => expect(releaseMic).toBeTypeOf('function'));

        hostSays({ jsonrpc: '2.0', id: 'teardown-mic', method: 'ui/resource-teardown', params: {} });
        expect(sent.some(message => message.id === 'teardown-mic' && message.result)).toBe(true);
        releaseMic();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(runtime.stop).toHaveBeenCalledTimes(1);
        expect(runtime.start).not.toHaveBeenCalled();
        expect(document.querySelector('#live-controls')).toBeNull();
        expect(host.runtime).toBeNull();
        expect(host.port).toBeNull();
    });

    it('unregisters a late global exit callback when Stop or destroy wins before runtime modules resolve', async () => {
        const { liveExited } = await import('../../app/live-handoff.js');
        for (const cancellation of ['stop', 'destroy']) {
            const { environment, sent, hostSays } = framed();
            mount('?embed=mcp&voice=paced', environment);
            await vi.waitFor(() => expect(sent).toHaveLength(1));
            hostSays({ jsonrpc: '2.0', id: sent[0].id, result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} } });
            await vi.waitFor(() => expect(sent.some(message => message.method === 'ui/notifications/size-changed')).toBe(true));
            answerCurrent(hostSays);
            await vi.waitFor(() => expect(container.querySelector('.live-start')?.textContent).toBe('Begin'));

            const loadedModules = await host.modules;
            let releaseModules;
            host.modules = new Promise(resolve => { releaseModules = () => resolve(loadedModules); });
            host.buildVoices = async () => null;
            host.buildAdapter = async () => ({ id: 'test', capabilities: {}, open: async () => { throw new Error('not started'); } });
            const startup = host.beginEmbedded();
            if (cancellation === 'stop') await host.stop();
            else host.destroy();
            releaseModules();
            await startup;

            const ended = vi.spyOn(host, 'ended');
            liveExited();
            expect(ended, cancellation).not.toHaveBeenCalled();
            expect(host.stopHearingExit, cancellation).toBeNull();
            if (!host.destroyed) host.destroy();
            host = null;
            document.body.replaceChildren();
        }
    });

    it('unregisters the global exit callback on Stop and on end of a built runtime', async () => {
        const { liveExited } = await import('../../app/live-handoff.js');
        for (const ending of ['stop', 'ended']) {
            mount(ending === 'stop' ? '?voice=paced' : '?embed=mcp&voice=paced');
            host.buildVoices = async () => null;
            host.buildAdapter = async () => ({ id: 'test', capabilities: {}, open: async () => { throw new Error('not started'); } });
            await host.buildRuntime();
            expect(host.stopHearingExit).toBeTypeOf('function');
            const callback = vi.spyOn(host, 'ended');
            await host[ending]();
            const callsAfterEnding = callback.mock.calls.length;
            liveExited();
            expect(callback).toHaveBeenCalledTimes(callsAfterEnding);
            expect(host.stopHearingExit).toBeNull();
            host.destroy();
            document.body.replaceChildren();
        }
    });

    it('keeps a replacement host exit callback when an older cancelled runtime finishes late', async () => {
        const { liveExited } = await import('../../app/live-handoff.js');
        const { environment, sent, hostSays } = framed();
        mount('?embed=mcp&voice=paced', environment);
        const oldHost = host;
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        hostSays({ jsonrpc: '2.0', id: sent[0].id, result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} } });
        await vi.waitFor(() => expect(sent.some(message => message.method === 'ui/notifications/size-changed')).toBe(true));
        answerCurrent(hostSays);
        await vi.waitFor(() => expect(container.querySelector('.live-start')?.textContent).toBe('Begin'));

        const loadedModules = await oldHost.modules;
        let releaseModules;
        oldHost.modules = new Promise(resolve => { releaseModules = () => resolve(loadedModules); });
        oldHost.buildVoices = async () => null;
        oldHost.buildAdapter = async () => ({ id: 'test', capabilities: {}, open: async () => { throw new Error('not started'); } });
        const oldStartup = oldHost.beginEmbedded();
        await oldHost.stop();

        const replacementContainer = document.createElement('div');
        document.body.append(replacementContainer);
        const replacement = new LiveHost(replacementContainer, {
            router: { navigate: async () => true, views: new Map() }, search: '?voice=paced', env: env()
        });
        replacement.buildVoices = async () => null;
        replacement.buildAdapter = async () => ({ id: 'test', capabilities: {}, open: async () => { throw new Error('not started'); } });
        await replacement.buildRuntime();
        const oldEnded = vi.spyOn(oldHost, 'ended');
        const replacementEnded = vi.spyOn(replacement, 'ended');

        releaseModules();
        await oldStartup;
        liveExited();
        expect(oldEnded).not.toHaveBeenCalled();
        expect(replacementEnded).toHaveBeenCalledTimes(1);

        replacement.destroy();
        oldHost.destroy();
    });

    it('builds nothing and writes nothing once it is destroyed while the host is still saying hello', async () => {
        let hello;
        const { environment, sent } = framed({ answer: message => (message.method === 'ui/initialize' ? hello : null) });
        mount('?embed=mcp&voice=paced', environment);
        host.buildRuntime = vi.fn(async () => { throw new Error('built after it was destroyed'); });
        await vi.waitFor(() => expect(sent).toHaveLength(1));
        host.destroy();
        hello = { result: { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} } };
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(host.buildRuntime).not.toHaveBeenCalled();
        expect(container.textContent).toBe('');
    });

    it('is not an embedded page when it is anything but exactly mcp', () => {
        for (const search of ['?embed=other', '?embed=', '?embed=MCP']) {
            const { environment } = framed();
            mount(search, environment);
            expect(host.embedded, search).toBe(false);
            expect(container.querySelector('.live-ask'), search).not.toBeNull();
            host.destroy();
            document.body.replaceChildren();
        }
    });

    it('is the study instrument, not an embedded page, when it is asked to be both', async () => {
        const { environment } = framed();
        mount('?embed=mcp&eval=1', environment);
        expect(host.embedded).toBe(false);
        await vi.waitFor(() => expect(host.eval).toBeDefined());
        expect(container.querySelector('.live-embed')).toBeNull();
    });
});

describe('the page that framed an embedded reading', () => {
    it('is named from the first ancestor, or the referrer, and otherwise said to be unidentified', () => {
        expect(framedBy({ location: { ancestorOrigins: ['https://host.example'] }, document: { referrer: 'https://other.example/x' } })).toBe('https://host.example');
        expect(framedBy({ location: { ancestorOrigins: ['null'] }, document: { referrer: 'https://other.example/x?q=1' } })).toBe('https://other.example');
        expect(framedBy({ location: {}, document: { referrer: '' } })).toBe('an unidentified page');
        expect(framedBy({ location: {}, document: { referrer: 'not a url' } })).toBe('an unidentified page');
    });
});
