/**
 * The doorway, from the reader's side.
 *
 * `stances.test.js` proves what a stance writes. This proves the Orbital
 * actually stands in one: that a single tap moves all three orbits, that the
 * visual panel is told rather than left disagreeing, that the choice survives
 * Begin and a rebuild, and — the rule that is easiest to claim and hardest to
 * keep — that the row stops claiming a posture the moment a dial moves.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

if (typeof globalThis.indexedDB === 'undefined') {
    globalThis.indexedDB = {
        open: () => ({ onsuccess: null, onerror: null, onupgradeneeded: null })
    };
}

const { ChamberOrbital, createDefaultConfig } = await import('./ChamberOrbital.js');
const { STANCES, matchStance } = await import('../core/stances.js');
const { default: App } = await import('../app.js');

function createOrbital(onBeginSession = vi.fn()) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const orbital = new ChamberOrbital(container, { onBeginSession });
    return { container, orbital, onBeginSession };
}

const chosen = container => [...container.querySelectorAll('[data-stance]')]
    .filter(button => button.getAttribute('aria-pressed') === 'true')
    .map(button => button.dataset.stance);

describe('the stance row', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete globalThis.rise;
        vi.restoreAllMocks();
    });

    it('offers every stance the registry knows, and no more', () => {
        const { container, orbital } = createOrbital();
        expect([...container.querySelectorAll('[data-stance]')].map(b => b.dataset.stance))
            .toEqual(STANCES.map(stance => stance.id));
        orbital.destroy();
    });

    it('names each stance and says what it feels like', () => {
        const { container, orbital } = createOrbital();
        const button = container.querySelector('[data-stance="contemplate"]');
        expect(button.textContent).toContain('Contemplate');
        expect(button.textContent).toContain('unhurried pace');
        orbital.destroy();
    });

    it('meets a reader who has chosen nothing already standing in Read plainly', () => {
        // The factory defaults ARE a named posture. If they drift out of one,
        // the first thing a visitor sees is a row where nothing is chosen.
        expect(matchStance(createDefaultConfig())).toBe('plainly');
        const { container, orbital } = createOrbital();
        expect(chosen(container)).toEqual(['plainly']);
        orbital.destroy();
    });
});

describe('choosing a stance', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete globalThis.rise;
        vi.restoreAllMocks();
    });

    it('moves all three orbits at once', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');

        container.querySelector('[data-stance="imagery"]').click();

        expect(orbital.config.visualInterlocution.visualMode).toBe('interlocution');
        expect(orbital.config.visualInterlocution.interlocution.presentation)
            .toBe('continuous');
        expect(orbital.config.wpm).toBe(180);
        expect(orbital.config.soundscape).toBe('aurora');
        expect(chosen(container)).toEqual(['imagery']);
        orbital.destroy();
    });

    it('repaints the orbit rings so the reader can see what it did', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');

        container.querySelector('[data-stance="contemplate"]').click();

        expect(container.querySelector('.orbit-temporal .orbit-status').textContent)
            .toContain('140');
        expect(container.querySelector('.orbit-audio .orbit-status').textContent)
            .toContain('Aurora');
        expect(container.querySelector('.orbit-visual .orbit-status').textContent)
            .toContain('Focals');
        orbital.destroy();
    });

    it('leaves the full controls agreeing with it, one level deeper', () => {
        // Progressive disclosure, not amputation: the orbits still hold every
        // control, and they must show the stance rather than the dials it
        // replaced. A stance that set config without syncing the panel would
        // put two answers in front of the reader.
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');

        container.querySelector('[data-stance="contemplate"]').click();

        expect(container.querySelector('#wpm-slider').value).toBe('140');
        expect(container.querySelector('#wpm-val').textContent).toBe('140 WPM');
        expect(container.querySelector('[data-soundscape="aurora"]').classList)
            .toContain('active');
        expect(container.querySelector('[data-audio-preset="silent"]').classList)
            .toContain('active');
        // The Navigator holds its own mapped selection; a stance it was never
        // told about would be reverted the next time it emitted a change.
        expect(orbital.visualNavigator.getConfig().visualMode).toBe('focals');
        orbital.destroy();
    });

    it('stops claiming a posture once a dial has moved', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        container.querySelector('[data-stance="imagery"]').click();

        const slider = container.querySelector('#wpm-slider');
        slider.value = '300';
        slider.dispatchEvent(new Event('input'));

        expect(orbital.config.wpm).toBe(300);
        expect(chosen(container)).toEqual([]);
        orbital.destroy();
    });

    it('persists a Thick + Fit text-material transaction as one synchronized state change', () => {
        const { container, orbital } = createOrbital();
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: vi.fn(() => ({ matches: false }))
        });
        const app = new App();
        app.loadSettings();
        const handleSettingsTransaction = vi.spyOn(app, 'handleSettingsTransaction');
        globalThis.rise = app;
        orbital.loadText('Begin the morning', 'Meditations');
        orbital.config.chunkMode = 'phrase';
        orbital.config.recitation = { enabled: true };
        const syncSpy = vi.spyOn(orbital, 'syncUIWithConfig');
        const persistSpy = vi.spyOn(orbital, '_persistPrefs');

        container.querySelector('.vnav-node[data-id="ink"]').click();
        container.querySelector('[data-word-fill="same"]').click();
        container.querySelector('[data-action="use-thick-fit"]').click();

        expect(globalThis.rise.settings).toMatchObject({ chamberFace: 'thick', fontSize: 'fit' });
        expect(orbital.config.chunkMode).toBe('word');
        expect(orbital.config.recitation).toEqual({ enabled: false });
        expect(orbital.config.visualInterlocution.interlocution.wordFill)
            .toEqual({ mode: 'same', border: 'cream' });
        expect(container.querySelector('[data-chunk="word"]').classList).toContain('active');
        const saved = JSON.parse(localStorage.getItem('rise_orbital_prefs_v1'));
        expect(saved.chunkMode).toBe('word');
        expect(saved.visualInterlocution.interlocution.wordFill)
            .toEqual({ mode: 'same', border: 'cream' });
        expect(handleSettingsTransaction).toHaveBeenCalledOnce();
        expect(handleSettingsTransaction).toHaveBeenCalledWith({ chamberFace: 'thick', fontSize: 'fit' });
        const restored = new App();
        restored.loadSettings();
        expect(restored.settings).toMatchObject({ chamberFace: 'thick', fontSize: 'fit' });
        expect(syncSpy).toHaveBeenCalledTimes(1);
        expect(persistSpy).toHaveBeenCalledTimes(1);
        orbital.destroy();
    });

    it('cancels or confirms leaving Thick + Fit without splitting text-material domains', () => {
        for (const change of [
            {
                entry: 'face',
                selector: '[data-chamber-face="display"]',
                settings: { chamberFace: 'display', fontSize: 'fit' }
            },
            {
                entry: 'size',
                selector: '[data-font-size="m"]',
                settings: { chamberFace: 'thick', fontSize: 'medium' }
            }
        ]) {
            const { container, orbital } = createOrbital();
            globalThis.rise = {
                settings: { chamberFace: 'thick', fontSize: 'fit' },
                handleSettingsTransaction: vi.fn(settings => Object.assign(globalThis.rise.settings, settings))
            };
            orbital.loadText('Begin the morning', 'Meditations', {
                visualConfig: {
                    visualMode: 'interlocution',
                    interlocution: { wordFill: { mode: 'same', border: 'cream' } }
                }
            });
            const before = structuredClone({
                settings: globalThis.rise.settings,
                config: orbital.config
            });
            const syncUIWithConfig = orbital.syncUIWithConfig.bind(orbital);
            const syncSnapshots = [];
            const syncSpy = vi.spyOn(orbital, 'syncUIWithConfig').mockImplementation(() => {
                syncSnapshots.push(structuredClone({
                    settings: globalThis.rise.settings,
                    temporal: {
                        chunkMode: orbital.config.chunkMode,
                        recitation: orbital.config.recitation
                    },
                    wordFill: orbital.config.visualInterlocution.interlocution.wordFill
                }));
                return syncUIWithConfig();
            });
            const persistSpy = vi.spyOn(orbital, '_persistPrefs');

            container.querySelector(`.vnav-node[data-id="${change.entry}"]`).click();
            container.querySelector(change.selector).click();
            expect(container.querySelector('[role="dialog"]')).toBeTruthy();
            container.querySelector('[data-action="dialog-cancel"]').click();

            expect({ settings: globalThis.rise.settings, config: orbital.config }).toEqual(before);
            expect(syncSpy).not.toHaveBeenCalled();
            expect(persistSpy).not.toHaveBeenCalled();

            container.querySelector(change.selector).click();
            container.querySelector('[data-action="dialog-confirm"]').click();

            expect(globalThis.rise.settings).toMatchObject(change.settings);
            expect(orbital.config.visualInterlocution.interlocution.wordFill)
                .toEqual({ mode: 'accent' });
            expect(orbital.visualNavigator.getConfig().interlocution.wordFill)
                .toEqual({ mode: 'accent' });
            expect(syncSnapshots).toEqual([{
                settings: change.settings,
                temporal: { chunkMode: 'word', recitation: { enabled: false } },
                wordFill: { mode: 'accent' }
            }]);
            expect(syncSpy).toHaveBeenCalledTimes(1);
            expect(persistSpy).toHaveBeenCalledTimes(1);
            orbital.destroy();
            document.body.innerHTML = '';
            localStorage.clear();
        }
    });

    it('carries the whole slice into the session', () => {
        const onBeginSession = vi.fn();
        const { container, orbital } = createOrbital(onBeginSession);
        orbital.loadText('Begin the morning', 'Meditations');

        container.querySelector('[data-stance="imagery"]').click();
        orbital.beginSession();

        const payload = onBeginSession.mock.calls[0][0];
        expect(payload.wpm).toBe(180);
        expect(payload.soundscape).toBe('aurora');
        expect(payload.audioPreset).toBe('silent');
        expect(payload.visualConfig.visualMode).toBe('interlocution');
        expect(payload.visualConfig.interlocution.presentation).toBe('continuous');
        // A Gallery with an empty shelf shows nothing at all, so the promise
        // "read with imagery" has to arrive with something to draw.
        expect(payload.visualConfig.interlocution.procedural.length)
            .toBeGreaterThan(0);
        orbital.destroy();
    });

    it('is still standing there after the Chamber is rebuilt', () => {
        const first = createOrbital();
        first.orbital.loadText('Begin the morning', 'Meditations');
        first.container.querySelector('[data-stance="contemplate"]').click();
        first.orbital.destroy();
        document.body.innerHTML = '';

        const second = createOrbital();
        expect(chosen(second.container)).toEqual(['contemplate']);
        expect(second.orbital.config.wpm).toBe(140);
        second.orbital.destroy();
    });

    it('gives a reading its own art back rather than a procedural field', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('In the beginning', 'Genesis', {
            origin: { view: 'chapel', name: 'The Chapel' },
            provenance: { kind: 'chapel-book', bookId: 'genesis' },
            visualConfig: {
                visualMode: 'interlocution',
                interlocution: {
                    sourceFamily: 'collections',
                    procedural: [],
                    sourced: ['dore:genesis'],
                    atriumCollections: ['dore:genesis']
                }
            }
        });

        container.querySelector('[data-stance="imagery"]').click();

        const { interlocution } = orbital.config.visualInterlocution;
        expect(interlocution.sourced).toEqual(['dore:genesis']);
        expect(interlocution.presentation).toBe('continuous');
        orbital.destroy();
    });

    it('keeps the focal the Chapel is holding when asked to contemplate', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('And he was transfigured', 'Matthew', {
            origin: { view: 'chapel', name: 'The Chapel' },
            provenance: { kind: 'chapel-book', bookId: 'matthew' },
            visualConfig: {
                visualMode: 'focals',
                focals: { type: 'icon', iconId: 'transfiguration' }
            }
        });

        container.querySelector('[data-stance="contemplate"]').click();

        expect(orbital.config.visualInterlocution.focals.type).toBe('icon');
        expect(orbital.config.visualInterlocution.focals.iconId)
            .toBe('transfiguration');
        orbital.destroy();
    });

    it('survives Reset by returning to the posture the defaults stand in', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        container.querySelector('[data-stance="contemplate"]').click();

        orbital.resetPrefs();

        expect(chosen(orbital.container)).toEqual(['plainly']);
        orbital.destroy();
    });
});
