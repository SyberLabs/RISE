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

function createOrbital(onBeginSession = vi.fn()) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const orbital = new ChamberOrbital(container, { onBeginSession });
    return { container, orbital, onBeginSession };
}

describe('ChamberOrbital static Recitation controls', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('offers only Heart and locks Spoken sessions to Phrase atoms', () => {
        const { container, orbital } = createOrbital();
        const select = container.querySelector('#voice-select');

        expect([...select.options].map(option => option.value))
            .toEqual(['af_heart']);
        container.querySelector('[data-recitation="on"]').click();

        expect(orbital.config.recitation).toEqual({ enabled: true });
        expect(orbital.config.chunkMode).toBe('phrase');
        expect(container.querySelector('[data-chunk="phrase"]').disabled)
            .toBe(false);
        expect(container.querySelector('[data-chunk="word"]').disabled)
            .toBe(true);
        expect(container.querySelector('[data-chunk="sentence"]').disabled)
            .toBe(true);

        orbital.destroy();
    });

    it('migrates stale runtime voice state without reviving browser speech', () => {
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({
            paceV2: true,
            chunkMode: 'word',
            voiceEnabled: true,
            voiceId: 'am_fenrir',
            recitation: { enabled: true }
        }));
        const onBeginSession = vi.fn();
        const { orbital } = createOrbital(onBeginSession);
        orbital.loadText('Begin the morning', 'Meditations');
        orbital.beginSession();

        expect(orbital.config.voiceId).toBe('af_heart');
        expect(orbital.config.chunkMode).toBe('phrase');
        expect(onBeginSession).toHaveBeenCalledOnce();
        const payload = onBeginSession.mock.calls[0][0];
        expect(payload.voiceId).toBe('af_heart');
        expect(payload.recitation).toEqual({ enabled: true });
        expect(payload).not.toHaveProperty('voiceEnabled');

        orbital.destroy();
    });
});
