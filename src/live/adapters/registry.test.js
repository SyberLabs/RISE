import { describe, expect, it, vi } from 'vitest';
import { LIVE_PROVIDERS, liveProvider } from './registry.js';
import { assertAdapter } from '../adapter.js';
import { createVirtualClock } from '../clock.js';
import { createFakeAnthropicFetch, createFakeNvidiaFetch, createFakeOpenAIChatFetch } from '../../test/fake-direct-fetch.js';

describe('the providers the venue offers', () => {
    it('lists the demo first, needing no key', () => {
        const [first] = LIVE_PROVIDERS;
        expect(first).toMatchObject({ id: 'mock', label: 'Demo (no key)', credential: 'none' });
        expect(typeof first.adapter).toBe('function');
    });

    it('makes the demo the answer written in beats, read by the same text-stream adapter a real provider is', async () => {
        const adapter = await LIVE_PROVIDERS[0].adapter({ clock: createVirtualClock() });
        expect(adapter.id).toBe('mock');
        expect(adapter.capabilities.speaks).toBe('host');
    });

    it('offers OpenRouter on the site connection, and Gemini on a typed key', () => {
        expect(liveProvider('openrouter')).toMatchObject({ label: 'OpenRouter (your key)', credential: 'openrouter' });
        expect(liveProvider('gemini')).toMatchObject({ credential: 'key', keyName: 'Gemini' });
    });

    it('makes the OpenRouter text-stream adapter, which carries text for RISE to speak', async () => {
        const adapter = await liveProvider('openrouter').adapter({ clock: createVirtualClock(), getKey: () => '' });
        expect(adapter.id).toBe('openrouter-stream');
        expect(adapter.capabilities.speaks).toBe('host');
    });

    it('lists the demo, OpenRouter, then the direct providers on a typed key, in that order', () => {
        expect(LIVE_PROVIDERS.map(entry => entry.id)).toEqual(['mock', 'openrouter', 'anthropic', 'openai', 'gemini', 'nvidia']);
        expect(liveProvider('anthropic')).toMatchObject({ label: 'Anthropic (your key)', credential: 'key', keyName: 'Anthropic', keyGoesTo: 'Anthropic' });
        expect(liveProvider('openai')).toMatchObject({ label: 'OpenAI (your key)', credential: 'key', keyName: 'OpenAI', keyGoesTo: 'OpenAI' });
        expect(liveProvider('nvidia')).toMatchObject({ label: 'NVIDIA (your key)', credential: 'key', keyName: 'NVIDIA', keyGoesTo: 'NVIDIA' });
    });

    it('makes each direct provider a text-stream adapter that RISE speaks, naming the model and who runs it', async () => {
        for (const [id, adapterId, fake, origin] of [
            ['anthropic', 'anthropic-stream', createFakeAnthropicFetch, { kind: 'model', name: 'claude-haiku-5-5', provider: 'Anthropic' }],
            ['openai', 'openai-chat-stream', createFakeOpenAIChatFetch, { kind: 'model', name: 'gpt-6-luna', provider: 'OpenAI' }],
            ['nvidia', 'nvidia-stream', createFakeNvidiaFetch, { kind: 'model', name: 'nvidia/nemotron-3.5-lightning-30b-a3b', provider: 'NVIDIA' }]
        ]) {
            const clock = createVirtualClock();
            vi.stubGlobal('fetch', fake({ clock }).fetch);
            const adapter = await liveProvider(id).adapter({ clock, getKey: () => 'typed-key' });
            expect(adapter.id).toBe(adapterId);
            expect(adapter.capabilities.speaks).toBe('host');
            const connection = await adapter.open({ intent: 'answer', prompt: 'Why?' });
            const { value: first } = await connection.events[Symbol.asyncIterator]().next();
            expect(first).toMatchObject({ type: 'current.open', origin });
            await connection.close();
            vi.unstubAllGlobals();
        }
    });

    it('does not offer a provider whose key would pass through this site', () => {
        // The OpenAI Realtime adapter opens its session through this site's Worker route; the OpenAI entry is chat completions, browser to OpenAI.
        expect(LIVE_PROVIDERS.some(entry => entry.id === 'openai-realtime')).toBe(false);
    });

    it('says no for an id it does not know, or one inherited from Object', () => {
        expect(liveProvider('nonsense')).toBeNull();
        expect(liveProvider('toString')).toBeNull();
    });

    it('makes a conforming adapter for every provider that has one, without asking anything', async () => {
        const offered = LIVE_PROVIDERS.filter(entry => entry.adapter);
        expect(offered.map(entry => entry.id)).toContain('mock');
        for (const entry of offered) {
            const adapter = await entry.adapter({ clock: createVirtualClock(), getKey: () => '' });
            expect(() => assertAdapter(adapter), entry.id).not.toThrow();
        }
    });

    it('is frozen: a page cannot add a provider to it', () => {
        expect(Object.isFrozen(LIVE_PROVIDERS)).toBe(true);
        for (const entry of LIVE_PROVIDERS) expect(Object.isFrozen(entry)).toBe(true);
    });
});
