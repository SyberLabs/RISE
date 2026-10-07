/**
 * The doorway, from the reader's side.
 *
 * `looks.test.js` proves what a look writes. This proves the Orbital
 * actually reads in one: that a single tap moves field, sound, type and
 * colour, that the visual panel is told rather than left disagreeing, that
 * the choice survives Begin and a rebuild, and — the rule that is easiest to
 * claim and hardest to keep — that no tile or option goes on claiming a look
 * the moment a field the look sets moves.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

if (typeof globalThis.indexedDB === 'undefined') {
    globalThis.indexedDB = {
        open: () => ({ onsuccess: null, onerror: null, onupgradeneeded: null })
    };
}

const { ChamberOrbital, createDefaultConfig } = await import('./ChamberOrbital.js');
const { lookOf } = await import('../../core/looks.js');
const { composeRoll } = await import('../../core/roll.js');
const { jevReleasedWorkIds } = await import('../../core/jev-describe.js');
const { default: App } = await import('../../app.js');

function createOrbital(onBeginSession = vi.fn(), options = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const orbital = new ChamberOrbital(container, { onBeginSession, ...options });
    return { container, orbital, onBeginSession };
}

// The Customize look sheet lists every look, so it is where a choice is read.
const chosen = container => [...container.querySelectorAll('[data-look-option]')]
    .filter(option => option.getAttribute('aria-pressed') === 'true')
    .map(option => option.dataset.lookOption);
const choose = (container, id) => container.querySelector(`[data-look-option="${id}"]`).click();

describe('the looks', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('names each look and says what the chosen one feels like', () => {
        const { container, orbital } = createOrbital();
        choose(container, 'vigil');
        expect(container.querySelector('[data-look-option="vigil"]').textContent).toBe('Vigil');
        expect(container.querySelector('#look-line').textContent)
            .toBe('One held image, and a soundscape beneath it.');
        orbital.destroy();
    });

    it('meets a reader who has chosen nothing already in Plain', () => {
        // The factory defaults ARE a named look. If they drift out of one,
        // the first thing a visitor sees is a row where nothing is chosen.
        expect(lookOf(createDefaultConfig())).toBe('plain');
        const { container, orbital } = createOrbital();
        expect(chosen(container)).toEqual(['plain']);
        orbital.destroy();
    });

    it('marks and names a reading that arrives in a look', () => {
        const { container, orbital } = createOrbital();
        const roll = composeRoll({ look: 'nocturne', workId: jevReleasedWorkIds()[0], section: 'first' });
        orbital.loadText('Begin the morning', 'Meditations', roll.config);
        expect(chosen(container)).toEqual(['nocturne']);
        expect(container.querySelector('[data-look="nocturne"]').getAttribute('aria-pressed')).toBe('true');
        expect(container.querySelector('#reader-summary-text').textContent).toBe('Meditations · Nocturne');
        orbital.destroy();
    });

    it('marks Gallery once chosen over a roll that drew another engine', () => {
        const { container, orbital } = createOrbital();
        const roll = composeRoll({ look: 'nocturne', workId: jevReleasedWorkIds()[0], section: 'first', random: () => 0.999 });
        orbital.loadText('Begin the morning', 'Meditations', roll.config);
        expect(orbital.config.visualInterlocution.interlocution.procedural).toEqual(['harmonograph']);

        container.querySelector('[data-look="gallery"]').click();

        expect(chosen(container)).toEqual(['gallery']);
        expect(container.querySelector('#reader-summary-text').textContent).toBe('Meditations · Gallery');
        orbital.destroy();
    });
});

describe('soundscape choices', () => {
    it('lets a reader choose Soft Rain from the soundscape controls', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        const button = container.querySelector('[data-soundscape="soft-rain"]');
        expect(button).not.toBeNull();
        button.click();
        expect(orbital.config.soundscape).toBe('soft-rain');
        expect(button.classList).toContain('active');
        orbital.destroy();
    });
});

describe('choosing a look', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('moves field, sound, type and colour at once, and leaves the pace', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');

        choose(container, 'gallery');

        expect(orbital.config.visualInterlocution.visualMode).toBe('interlocution');
        expect(orbital.config.visualInterlocution.interlocution.presentation)
            .toBe('continuous');
        expect(orbital.config.soundscape).toBe('aurora');
        expect(orbital.config.presentation).toMatchObject({
            chamberFace: 'literary', fontSize: 'medium', colorTheme: 'classic'
        });
        expect(orbital.config.wpm).toBe(200);
        expect(chosen(container)).toEqual(['gallery']);
        expect(container.querySelector('#reader-summary-text').textContent).toBe('Meditations · Gallery');
        orbital.destroy();
    });

    it('repaints the rows in the sheet so the reader can see what it did', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');

        choose(container, 'vigil');

        expect(container.querySelector('.orbit-audio .orbit-status').textContent)
            .toContain('Aurora');
        expect(container.querySelector('.orbit-visual .orbit-status').textContent)
            .toContain('Focals');
        orbital.destroy();
    });

    it('leaves the full controls agreeing with it, one level deeper', () => {
        // Progressive disclosure, not amputation: the orbits still hold every
        // control, and they must show the look rather than the dials it
        // replaced. A look that set config without syncing the panel would
        // put two answers in front of the reader.
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');

        choose(container, 'vigil');

        expect(container.querySelector('#wpm-slider').value).toBe('200');
        expect(container.querySelector('[data-soundscape="aurora"]').classList)
            .toContain('active');
        expect(container.querySelector('#modal-audio .active[data-audio-preset]')).toBeNull();
        // The Navigator holds its own mapped selection; a look it was never
        // told about would be reverted the next time it emitted a change.
        expect(orbital.visualNavigator.getConfig().visualMode).toBe('focals');
        orbital.destroy();
    });

    it('stops claiming a look once a field the look sets has moved', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        choose(container, 'gallery');

        container.querySelector('[data-soundscape="soft-rain"]').click();

        expect(orbital.config.soundscape).toBe('soft-rain');
        expect(chosen(container)).toEqual([]);
        expect(container.querySelector('#reader-summary-text').textContent).toBe('Meditations · Custom');
        orbital.destroy();
    });

    it('keeps the look when only the pace moves', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        choose(container, 'gallery');

        const slider = container.querySelector('#wpm-slider');
        slider.value = '300';
        slider.dispatchEvent(new Event('input'));

        expect(orbital.config.wpm).toBe(300);
        expect(chosen(container)).toEqual(['gallery']);
        orbital.destroy();
    });

    it('persists a Thick + Fit text-material transaction as one synchronized state change', () => {
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            value: vi.fn(() => ({ matches: false }))
        });
        const app = new App();
        app.loadSettings();
        const handleSettingsTransaction = vi.spyOn(app, 'handleSettingsTransaction');
        const { container, orbital } = createOrbital(undefined, {
            getSettings: () => app.settings,
            onSettingChange: (key, value) => app.handleSettingsChange(key, value),
            onSettingsTransaction: settings => app.handleSettingsTransaction(settings)
        });
        orbital.loadText('Begin the morning', 'Meditations');
        orbital.config.chunkMode = 'phrase';
        orbital.config.recitation = { enabled: true };
        const syncSpy = vi.spyOn(orbital, 'syncUIWithConfig');
        const persistSpy = vi.spyOn(orbital, '_persistPrefs');

        container.querySelector('.vnav-node[data-id="ink"]').click();
        container.querySelector('[data-word-fill="same"]').click();
        container.querySelector('[data-action="use-thick-fit"]').click();

        expect(app.settings).toMatchObject({ chamberFace: 'thick', fontSize: 'fit' });
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
            const settings = { chamberFace: 'thick', fontSize: 'fit' };
            const { container, orbital } = createOrbital(undefined, {
                getSettings: () => settings,
                onSettingChange: (key, value) => { settings[key] = value; },
                onSettingsTransaction: patch => Object.assign(settings, patch)
            });
            orbital.loadText('Begin the morning', 'Meditations', {
                visualConfig: {
                    visualMode: 'interlocution',
                    interlocution: { wordFill: { mode: 'same', border: 'cream' } }
                }
            });
            const before = structuredClone({
                settings,
                config: orbital.config
            });
            const syncUIWithConfig = orbital.syncUIWithConfig.bind(orbital);
            const syncSnapshots = [];
            const syncSpy = vi.spyOn(orbital, 'syncUIWithConfig').mockImplementation(() => {
                syncSnapshots.push(structuredClone({
                    settings,
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

            expect({ settings, config: orbital.config }).toEqual(before);
            expect(syncSpy).not.toHaveBeenCalled();
            expect(persistSpy).not.toHaveBeenCalled();

            container.querySelector(change.selector).click();
            container.querySelector('[data-action="dialog-confirm"]').click();

            expect(settings).toMatchObject(change.settings);
            expect(orbital.config.visualInterlocution.interlocution.wordFill)
                .toEqual({ mode: 'accent', border: 'cream' });
            expect(orbital.visualNavigator.getConfig().interlocution.wordFill)
                .toEqual({ mode: 'accent', border: 'cream' });
            expect(syncSnapshots).toEqual([{
                settings: change.settings,
                temporal: { chunkMode: before.config.chunkMode, recitation: { enabled: false } },
                wordFill: { mode: 'accent', border: 'cream' }
            }]);
            expect(syncSpy).toHaveBeenCalledTimes(1);
            expect(persistSpy).toHaveBeenCalledTimes(1);
            orbital.destroy();
            document.body.innerHTML = '';
            localStorage.clear();
        }
    });

    it('carries the whole look into the session', () => {
        const onBeginSession = vi.fn();
        const { container, orbital } = createOrbital(onBeginSession);
        orbital.loadText('Begin the morning', 'Meditations');

        choose(container, 'gallery');
        orbital.beginSession();

        const payload = onBeginSession.mock.calls[0][0];
        expect(payload.wpm).toBe(200);
        expect(payload.soundscape).toBe('aurora');
        expect(payload.audioPreset).toBe('silent');
        expect(payload.visualConfig.visualMode).toBe('interlocution');
        expect(payload.visualConfig.interlocution.presentation).toBe('continuous');
        // A Gallery with an empty shelf shows nothing at all, so the look
        // has to arrive with something to draw.
        expect(payload.visualConfig.interlocution.procedural.length)
            .toBeGreaterThan(0);
        expect(payload.presentation).toMatchObject({
            chamberFace: 'literary', fontSize: 'medium', colorTheme: 'classic'
        });
        orbital.destroy();
    });

    it('is still in it, type and colour too, after the Chamber is rebuilt', () => {
        const first = createOrbital();
        first.orbital.loadText('Begin the morning', 'Meditations');
        choose(first.container, 'vigil');
        first.orbital.destroy();
        document.body.innerHTML = '';

        const second = createOrbital();
        expect(chosen(second.container)).toEqual(['vigil']);
        expect(second.orbital.config.presentation).toMatchObject({
            chamberFace: 'display', fontSize: 'large', colorTheme: 'amethyst'
        });
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

        choose(container, 'gallery');

        const { interlocution } = orbital.config.visualInterlocution;
        expect(interlocution.sourced).toEqual(['dore:genesis']);
        expect(interlocution.presentation).toBe('continuous');
        orbital.destroy();
    });

    it('keeps the focal the Chapel is holding when asked for Vigil', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('And he was transfigured', 'Matthew', {
            origin: { view: 'chapel', name: 'The Chapel' },
            provenance: { kind: 'chapel-book', bookId: 'matthew' },
            visualConfig: {
                visualMode: 'focals',
                focals: { type: 'icon', iconId: 'transfiguration' }
            }
        });

        choose(container, 'vigil');

        expect(orbital.config.visualInterlocution.focals.type).toBe('icon');
        expect(orbital.config.visualInterlocution.focals.iconId)
            .toBe('transfiguration');
        orbital.destroy();
    });
});

describe('the reader setup controls', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
    });

    it('labels every icon-only control', () => {
        const { container, orbital } = createOrbital();
        for (const button of container.querySelectorAll('button')) {
            const name = button.getAttribute('aria-label') || button.textContent.trim();
            expect(name, button.outerHTML.slice(0, 80)).not.toBe('');
        }
        orbital.destroy();
    });
});
