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
const { SEQUENCE_CAPABILITIES } = await import('../../core/sequence-capabilities.js');

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
        orbital.loadText('Begin the morning', 'Meditations', {
            capabilities: [SEQUENCE_CAPABILITIES.RECITATION_AUDIO]
        });
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

    it('shows a Voice row only when the text has a recitation', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        const row = container.querySelector('[data-recitation-capability]');
        expect(row.hidden).toBe(true);
        expect(row.querySelector('.config-label').textContent).toBe('Voice');

        orbital.loadText('Begin the morning', 'Meditations', {
            capabilities: [SEQUENCE_CAPABILITIES.RECITATION_AUDIO]
        });
        expect(row.hidden).toBe(false);
        expect([...row.querySelectorAll('[data-recitation]')].map(button => button.textContent.trim()))
            .toEqual(['None', 'Recited']);

        orbital.destroy();
    });

    it('says Phrase (recited), and why, where the rhythm used to lock in silence', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations', {
            capabilities: [SEQUENCE_CAPABILITIES.RECITATION_AUDIO]
        });
        container.querySelector('[data-chunk="word"]').click();
        const rhythm = () => container.querySelector('[data-orbit="temporal"] .orbit-status').textContent;
        const note = container.querySelector('[data-recitation-note]');
        expect(rhythm()).toBe('Word · 200 wpm');
        expect(note.hidden).toBe(true);

        container.querySelector('[data-recitation="on"]').click();
        expect(rhythm()).toBe('Phrase (recited) · 200 wpm');
        expect(note.hidden).toBe(false);
        expect(note.textContent).toContain('Phrase (recited)');
        expect(note.textContent.replace(/\s+/g, ' ')).toContain('recorded one phrase at a time');

        container.querySelector('[data-recitation="off"]').click();
        expect(rhythm()).toBe('Phrase · 200 wpm');
        expect(note.hidden).toBe(true);

        orbital.destroy();
    });

    it('draws the chunking lock as a labelled SVG, not an emoji, and removes it on release', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations', {
            capabilities: [SEQUENCE_CAPABILITIES.RECITATION_AUDIO]
        });
        container.querySelector('[data-recitation="on"]').click();

        const word = container.querySelector('[data-chunk="word"]');
        const lock = word.querySelector('svg.chunk-lock');
        expect(lock).not.toBeNull();
        expect(lock.getAttribute('aria-label')).toBe('Locked');
        expect(word.textContent).not.toContain('\u{1F512}');
        expect(word.textContent.trim()).toBe('Word');
        expect(container.querySelector('[data-chunk="phrase"] .chunk-lock')).toBeNull();

        container.querySelector('[data-recitation="off"]').click();
        expect(word.querySelector('.chunk-lock')).toBeNull();
        expect(word.textContent.trim()).toBe('Word');

        orbital.destroy();
    });

    it('does not let a stale Recitation preference grant capability to ordinary text', () => {
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({
            paceV2: true,
            phraseDefault: true,
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
        expect(orbital.config.chunkMode).toBe('word');
        expect(orbital.config.recitation).toEqual({ enabled: false });
        expect(onBeginSession).toHaveBeenCalledOnce();
        const payload = onBeginSession.mock.calls[0][0];
        expect(payload.voiceId).toBe('af_heart');
        expect(payload.recitation).toEqual({ enabled: false });
        expect(payload.capabilities).toEqual([]);
        expect(payload).not.toHaveProperty('voiceEnabled');

        orbital.destroy();
    });

    it('authors Progressive text arrival independently of Spoken voice', () => {
        const onBeginSession = vi.fn();
        const { container, orbital } = createOrbital(onBeginSession);
        orbital.loadText('Silent words can still arrive progressively.', 'Test');

        container.querySelector('[data-reveal="progressive"]').click();
        expect(orbital.config.revealMode).toBe('progressive');
        expect(orbital.config.recitation).toEqual({ enabled: false });

        orbital.beginSession();
        const payload = onBeginSession.mock.calls[0][0];
        expect(payload.revealMode).toBe('progressive');
        expect(payload.recitation).toEqual({ enabled: false });
        orbital.destroy();
    });
});
