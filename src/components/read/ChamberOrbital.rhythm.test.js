import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

if (typeof globalThis.indexedDB === 'undefined') {
    globalThis.indexedDB = {
        open: () => ({
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null
        })
    };
}

const { ChamberOrbital } = await import('./ChamberOrbital.js');

function createOrbital(onBeginSession = vi.fn(), settings = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const orbital = new ChamberOrbital(container, { onBeginSession, getSettings: () => settings });
    return { container, orbital };
}

describe('the rhythm a returning reader finds in Reader setup', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('turns a Word saved before Phrase became the default into Phrase', () => {
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({ paceV2: true, chunkMode: 'word' }));
        const { orbital } = createOrbital();
        expect(orbital.config.chunkMode).toBe('phrase');
        orbital.destroy();
    });

    it('keeps a Word saved under Fit, which paints one word at a time', () => {
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({ paceV2: true, chunkMode: 'word' }));
        const { orbital } = createOrbital(undefined, { chamberFace: 'thick', fontSize: 'fit' });
        expect(orbital.config.chunkMode).toBe('word');
        orbital.destroy();
    });

    it('keeps any other rhythm saved before then', () => {
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({ paceV2: true, chunkMode: 'sentence' }));
        const { orbital } = createOrbital();
        expect(orbital.config.chunkMode).toBe('sentence');
        orbital.destroy();
    });

    it('keeps a Word the reader chooses now, across visits', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        container.querySelector('[data-chunk="word"]').click();
        expect(orbital.config.chunkMode).toBe('word');
        orbital.beginSession();
        orbital.destroy();

        const { orbital: returning } = createOrbital();
        expect(returning.config.chunkMode).toBe('word');
        returning.destroy();
    });
});
