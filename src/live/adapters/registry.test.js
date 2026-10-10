import { describe, expect, it } from 'vitest';
import { LIVE_PROVIDERS, liveProvider } from './registry.js';
import { assertAdapter } from '../adapter.js';
import { createVirtualClock } from '../clock.js';

describe('the providers the venue offers', () => {
    it('lists the demo first, needing no key', () => {
        const [first] = LIVE_PROVIDERS;
        expect(first).toMatchObject({ id: 'mock', label: 'Demo (no key)', credential: 'none' });
        expect(typeof first.adapter).toBe('function');
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

    it('does not offer a provider whose key would pass through this site', () => {
        // The OpenAI Realtime adapter opens its session through this site's Worker route.
        expect(liveProvider('openai')).toBeNull();
        expect(LIVE_PROVIDERS.every(entry => entry.id !== 'openai')).toBe(true);
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
