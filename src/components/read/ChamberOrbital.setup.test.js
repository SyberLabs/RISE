/**
 * Reader setup's first screen: four choices and two sheets (RDR-021).
 *
 * Text, look, rhythm and pace, Begin. Everything else sits one sheet away,
 * and nothing a reader could reach before is lost on the way: the sheets hold
 * the controls the first screen gave up, and Begin hands the Chamber the same
 * session it always did for the same choices.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

if (typeof globalThis.indexedDB === 'undefined') {
    globalThis.indexedDB = {
        open: () => ({ onsuccess: null, onerror: null, onupgradeneeded: null })
    };
}

const { ChamberOrbital } = await import('./ChamberOrbital.js');
const { LOOKS, applyLook, lookOf } = await import('../../core/looks.js');
const { composeRoll } = await import('../../core/roll.js');
const { jevReleasedWorkIds } = await import('../../core/jev-describe.js');

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** A screen this many CSS pixels wide, as matchMedia reports it. */
function setWidth(width) {
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: vi.fn(query => {
            const max = /max-width:\s*(\d+)px/.exec(query);
            return {
                matches: max ? width <= Number(max[1]) : false,
                media: query,
                addEventListener: () => {},
                removeEventListener: () => {}
            };
        })
    });
}

function createOrbital(options = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onBeginSession = vi.fn();
    const onNavigate = vi.fn();
    const orbital = new ChamberOrbital(container, { onBeginSession, onNavigate, ...options });
    return { container, orbital, onBeginSession, onNavigate };
}

const hookOf = el => (el.dataset.look && `look:${el.dataset.look}`)
    || (el.dataset.orbit && `sheet:${el.dataset.orbit}`)
    || el.dataset.action
    || el.id;

const firstScreen = container => [...container.querySelectorAll(FOCUSABLE)]
    .filter(el => !el.closest('.orbital-modals') && !el.closest('[hidden]'));

const tiles = container => [...container.querySelectorAll('[data-look]')].map(tile => tile.dataset.look);
const pressed = (container, selector) => [...container.querySelectorAll(selector)]
    .filter(el => el.getAttribute('aria-pressed') === 'true');

const roll = look => composeRoll({ look, workId: jevReleasedWorkIds()[0], section: 'first' }).config;

beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    setWidth(1280);
});

afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('the first screen', () => {
    it('holds exactly eight controls: Home, Change text, three looks, Customize look, Rhythm & pace, Begin', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning by saying to thyself', 'Meditations');

        expect(firstScreen(container).map(hookOf)).toEqual([
            'back', 'library',
            'look:gallery', 'look:plain', 'look:nocturne',
            'sheet:look', 'sheet:temporal',
            'begin-btn'
        ]);
        orbital.destroy();
    });

    it('holds the same eight before a text is chosen, with Begin waiting for one', () => {
        const { container, orbital } = createOrbital();
        const controls = firstScreen(container);
        expect(controls).toHaveLength(8);
        expect(container.querySelector('#begin-btn').disabled).toBe(true);
        orbital.destroy();
    });

    it('names the text with its length and its time at the chosen pace', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText(Array(600).fill('word').join(' '), 'Meditations');

        expect(container.querySelector('.text-name').textContent).toBe('Meditations');
        expect(container.querySelector('.text-meta').textContent).toBe('600 words · about 3 min');
        expect(container.querySelector('[data-action="library"]').textContent.trim()).toBe('Change text');
        orbital.destroy();
    });

    it('has no Reset, no Stream or Page choice, no Remove text and no stance row', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');

        for (const selector of ['[data-action="reset-prefs"]', '[data-projection]',
            '[data-action="clear-text"]', '[data-stance]', '[data-action="toggle-adjust"]']) {
            expect(container.querySelector(selector), selector).toBeNull();
        }
        expect(orbital.resetPrefs).toBeUndefined();
        expect(orbital.clearText).toBeUndefined();
        orbital.destroy();
    });

    it('reads the rhythm and pace on its row', () => {
        const { container, orbital } = createOrbital();
        const row = container.querySelector('[data-orbit="temporal"]');
        expect(row.textContent).toContain('Rhythm & pace');
        expect(row.querySelector('.orbit-status').textContent).toBe('Phrase · 200 wpm');
        orbital.destroy();
    });
});

describe('which three looks the tiles offer', () => {
    it('offers Gallery, Plain and Nocturne on a desk to a reading with no look of its own', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        expect(tiles(container)).toEqual(['gallery', 'plain', 'nocturne']);
        orbital.destroy();
    });

    it('offers Inlay third on a screen 820 pixels wide or less', () => {
        setWidth(820);
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        expect(tiles(container)).toEqual(['gallery', 'plain', 'inlay']);
        orbital.destroy();
    });

    it('puts the reading\'s own look first', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations', roll('signal'));
        expect(tiles(container)).toEqual(['signal', 'plain', 'nocturne']);
        orbital.destroy();
    });

    it('offers Gallery third when the reading\'s own look is Nocturne', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations', roll('nocturne'));
        expect(tiles(container)).toEqual(['nocturne', 'plain', 'gallery']);
        orbital.destroy();
    });

    it('keeps Gallery first when the reading\'s own look is Plain, which has its own place', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations', roll('plain'));
        expect(tiles(container)).toEqual(['gallery', 'plain', 'nocturne']);
        orbital.destroy();
    });

    it('does not move the tiles when the reader chooses one', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        container.querySelector('[data-look="nocturne"]').click();
        expect(tiles(container)).toEqual(['gallery', 'plain', 'nocturne']);
        orbital.destroy();
    });
});

describe('choosing a tile', () => {
    it('applies the look and marks its tile, and only its tile', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        const expected = applyLook(orbital.config, 'gallery');

        container.querySelector('[data-look="gallery"]').click();

        expect(lookOf(orbital.config)).toBe('gallery');
        expect(orbital.config.presentation).toEqual(expected.presentation);
        expect(orbital.config.soundscape).toBe('aurora');
        expect(pressed(container, '[data-look]').map(tile => tile.dataset.look)).toEqual(['gallery']);
        expect(container.querySelector('[data-look="gallery"]').textContent).toContain('Gallery');
        orbital.destroy();
    });

    it('marks no tile once the reading leaves every look', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        container.querySelector('[data-look="gallery"]').click();
        container.querySelector('[data-soundscape="soft-rain"]').click();

        expect(pressed(container, '[data-look]')).toEqual([]);
        expect(container.querySelector('[data-orbit="look"] .orbit-status').textContent).toBe('Custom');
        orbital.destroy();
    });
});

describe('Begin', () => {
    // Captured from Reader setup before RDR-021, for the same choices.
    const BEFORE = {
        text: 'Begin the morning by saying to thyself', textSource: 'Meditations',
        origin: null, provenance: null, continuation: null, capabilities: [],
        wpm: 200, curve: 'flat', chunkMode: 'phrase', revealMode: 'instant', verseLines: false,
        audioPreset: 'silent', soundscape: 'none', entrainmentMode: 'binaural', entrainmentWaveform: 'sine',
        voiceId: 'af_heart', recitation: { enabled: false }, selectedSwellId: null, projection: 'stream',
        visualConfig: {
            visualMode: 'off',
            focals: { type: 'standard', standardGlyph: 'breath', personalImage: null },
            attractor: { system: 'aizawa', palette: 'white', form: 'mirror' },
            genesis: { preset: 'random', glass: true },
            livingText: { enabled: true },
            interlocution: {
                sourceFamily: 'procedural', procedural: [], sourced: [], frequency: 0.2, duration: 200,
                galleryCadence: 0.5, renderLanguage: 'native', presentation: 'continuous', streamGlass: true,
                kleePreset: 'random', harmonographClimate: 'auto', responsive: false, responsiveMood: true,
                responsiveRhythm: true, atriumCollections: []
            }
        }
    };
    const withLook = (soundscape, presentation, visual, interlocution) => {
        const payload = structuredClone(BEFORE);
        payload.soundscape = soundscape;
        payload.presentation = presentation;
        Object.assign(payload.visualConfig, visual);
        Object.assign(payload.visualConfig.interlocution, interlocution);
        return payload;
    };
    const EXPECTED = {
        none: BEFORE,
        gallery: withLook('aurora', {
            chamberFace: 'literary', fontSize: 'medium', colorTheme: 'classic', textColor: 'classic',
            backgroundColor: 'classic', colors: { background: '#08090F', text: '#F4EEE4', accent: '#C8AE83' }
        }, { visualMode: 'interlocution' }, { procedural: ['turrell'], galleryCadence: 0.3 }),
        vigil: withLook('aurora', {
            chamberFace: 'display', fontSize: 'large', colorTheme: 'amethyst', textColor: 'amethyst',
            backgroundColor: 'amethyst', colors: { background: '#140B20', text: '#DDBAFF', accent: '#BB8CFF' }
        }, { visualMode: 'focals' }, {})
    };

    const begin = (choose) => {
        localStorage.clear();
        document.body.innerHTML = '';
        const { container, orbital, onBeginSession } = createOrbital();
        orbital.loadText('Begin the morning by saying to thyself', 'Meditations');
        choose(container);
        container.querySelector('#begin-btn').click();
        const payload = structuredClone(onBeginSession.mock.calls[0][0]);
        delete payload.visualConfig.consentScope;
        orbital.destroy();
        return payload;
    };

    it('starts the same session as before when nothing is chosen', () => {
        expect(begin(() => {})).toEqual(EXPECTED.none);
    });

    it('starts the same session as before for a look chosen on a tile', () => {
        expect(begin(c => c.querySelector('[data-look="gallery"]').click())).toEqual(EXPECTED.gallery);
    });

    it('starts the same session as before for a look chosen in the sheet', () => {
        expect(begin(c => {
            c.querySelector('[data-orbit="look"]').click();
            c.querySelector('[data-look-option="vigil"]').click();
        })).toEqual(EXPECTED.vigil);
    });
});

describe('the Customize look sheet', () => {
    const open = container => {
        container.querySelector('[data-orbit="look"]').click();
        return container.querySelector('#modal-look');
    };

    it('opens as a modal dialog and takes focus', () => {
        const { container, orbital } = createOrbital();
        const sheet = open(container);
        expect(sheet.hidden).toBe(false);
        const dialog = sheet.querySelector('[role="dialog"]');
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(dialog.contains(document.activeElement)).toBe(true);
        orbital.destroy();
    });

    it('offers all ten looks where Inlay is offered, and nine where it is not', () => {
        setWidth(820);
        const narrow = createOrbital();
        const shown = c => [...c.querySelectorAll('[data-look-option]')]
            .filter(b => !b.hidden).map(b => b.dataset.lookOption);
        expect(shown(narrow.container)).toEqual(LOOKS.map(look => look.id));
        narrow.orbital.destroy();

        setWidth(1280);
        const wide = createOrbital();
        expect(shown(wide.container)).toEqual(LOOKS.map(look => look.id).filter(id => id !== 'inlay'));
        wide.orbital.destroy();
    });

    it('applies a look and marks it in the sheet and on the tiles', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        open(container);
        container.querySelector('[data-look-option="nocturne"]').click();

        expect(lookOf(orbital.config)).toBe('nocturne');
        expect(pressed(container, '[data-look-option]').map(b => b.dataset.lookOption)).toEqual(['nocturne']);
        expect(pressed(container, '[data-look]').map(b => b.dataset.look)).toEqual(['nocturne']);
        orbital.destroy();
    });

    it('offers the nine colour themes and applies one to the reading', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        container.querySelector('[data-look="gallery"]').click();
        open(container);

        expect([...container.querySelectorAll('[data-colour]')].map(b => b.dataset.colour))
            .toEqual(['classic', 'amethyst', 'prism', 'ember', 'cobalt', 'jade', 'rose', 'citrine', 'silver']);
        container.querySelector('[data-colour="jade"]').click();

        expect(orbital.config.presentation).toMatchObject({
            colorTheme: 'jade', textColor: 'jade', backgroundColor: 'jade',
            colors: { background: '#061912', text: '#AFFFCE', accent: '#4CE6A4' },
            chamberFace: 'literary'
        });
        expect(pressed(container, '[data-colour]').map(b => b.dataset.colour)).toEqual(['jade']);
        orbital.destroy();
    });

    it('marks the colour and size a fresh reading will use: classic, and the reader\'s own size', () => {
        const { container, orbital } = createOrbital({ getSettings: () => ({ fontSize: 'large' }) });
        orbital.loadText('Begin the morning', 'Pasted');
        open(container);

        expect(orbital.config.presentation).toBeNull();
        expect(pressed(container, '[data-colour]').map(b => b.dataset.colour)).toEqual(['classic']);
        expect(pressed(container, '[data-look-size]').map(b => b.dataset.lookSize)).toEqual(['large']);
        expect(pressed(container, '[data-look-option]').map(b => b.dataset.lookOption)).toEqual(['plain']);
        orbital.destroy();
    });

    it('marks the medium size when the reader has set none', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Pasted');
        expect(pressed(container, '[data-look-size]').map(b => b.dataset.lookSize)).toEqual(['medium']);
        orbital.destroy();
    });

    it('presses exactly one swatch after a colour is chosen, and draws it as chosen', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Pasted');
        open(container);
        container.querySelector('[data-colour="amethyst"]').click();

        expect(pressed(container, '[data-colour]').map(b => b.dataset.colour)).toEqual(['amethyst']);
        const css = readFileSync(resolve('src/components/read/ChamberOrbital.css'), 'utf8');
        const chosen = css.match(/\.sheet-colour\[aria-pressed="true"\]\s*\{[^}]+\}/);
        expect(chosen, '.sheet-colour[aria-pressed="true"]').toBeTruthy();
        expect(chosen[0]).toMatch(/border-color:\s*var\(--rs-brand\)/);
        expect(chosen[0]).toMatch(/box-shadow:[^;]*var\(--rs-brand\)/);
        orbital.destroy();
    });

    it('sets the size for this reading, and offers Fit only in Inlay', () => {
        setWidth(390);
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        open(container);
        const fit = () => container.querySelector('[data-look-size="fit"]');

        expect(fit().hidden).toBe(true);
        container.querySelector('[data-look-size="small"]').click();
        expect(orbital.config.presentation.fontSize).toBe('small');

        container.querySelector('[data-look-option="inlay"]').click();
        expect(fit().hidden).toBe(false);
        expect(fit().getAttribute('aria-pressed')).toBe('true');
        orbital.destroy();
    });

    it('opens the sound list and the imagery from inside, and returns to the sheet', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        const sheet = open(container);

        const sound = sheet.querySelector('[data-orbit="audio"]');
        sound.click();
        expect(container.querySelector('#modal-audio').hidden).toBe(false);
        expect(orbital.handleEscape()).toBe(true);
        expect(container.querySelector('#modal-audio').hidden).toBe(true);
        expect(sheet.hidden).toBe(false);
        expect(document.activeElement).toBe(sound);

        sheet.querySelector('[data-orbit="visual"]').click();
        expect(container.querySelector('#modal-visual').hidden).toBe(false);
        expect(container.querySelector('#modal-visual .vnav, #modal-visual .vstage')).not.toBeNull();
        orbital.destroy();
    });

    it('names the imagery a glyph when the look holds one', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        container.querySelector('[data-look="gallery"]').click();
        const label = () => container.querySelector('[data-orbit="visual"] .orbit-label').textContent;
        expect(label()).toBe('Imagery');
        open(container);
        container.querySelector('[data-look-option="vigil"]').click();
        expect(label()).toBe('Glyph');
        orbital.destroy();
    });

    it('offers the Visual Lab only in Flame', () => {
        const { container, orbital, onNavigate } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        open(container);
        const lab = container.querySelector('[data-action="open-visual-lab"]');
        expect(lab.hidden).toBe(true);

        container.querySelector('[data-look-option="flame"]').click();
        expect(lab.hidden).toBe(false);
        lab.click();
        expect(onNavigate).toHaveBeenCalledWith('visual-lab');
        orbital.destroy();
    });

    it('closes on Escape and gives focus back to Customize look', () => {
        const { container, orbital } = createOrbital();
        const sheet = open(container);
        sheet.querySelector('[role="dialog"]').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(sheet.hidden).toBe(true);
        expect(document.activeElement).toBe(container.querySelector('[data-orbit="look"]'));
        orbital.destroy();
    });

    it('keeps Tab inside the sheet', () => {
        const { container, orbital } = createOrbital();
        const sheet = open(container);
        const reachable = [...sheet.querySelectorAll(FOCUSABLE)].filter(el => !el.closest('[hidden]') && !el.disabled);
        reachable.at(-1).focus();
        sheet.querySelector('[role="dialog"]').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(reachable[0]);

        reachable[0].focus();
        sheet.querySelector('[role="dialog"]').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(reachable.at(-1));
        orbital.destroy();
    });
});

describe('the Rhythm & pace sheet', () => {
    const open = container => {
        container.querySelector('[data-orbit="temporal"]').click();
        return container.querySelector('#modal-temporal');
    };

    it('holds rhythm, pace, curve and text arrival, rhythm first', () => {
        const { container, orbital } = createOrbital();
        const sheet = open(container);
        expect(sheet.hidden).toBe(false);
        expect(sheet.querySelector('h2').textContent).toBe('Rhythm & pace');
        expect([...sheet.querySelectorAll('[data-chunk]')].map(b => b.dataset.chunk))
            .toEqual(['phrase', 'sentence', 'word']);
        for (const selector of ['#wpm-slider', '[data-curve]', '[data-reveal]']) {
            expect(sheet.querySelector(selector), selector).not.toBeNull();
        }
        orbital.destroy();
    });

    it('applies a rhythm and a pace and says so on the row', () => {
        const { container, orbital } = createOrbital();
        const sheet = open(container);
        sheet.querySelector('[data-chunk="word"]').click();
        const slider = sheet.querySelector('#wpm-slider');
        slider.value = '320';
        slider.dispatchEvent(new Event('input'));

        expect(orbital.config.chunkMode).toBe('word');
        expect(orbital.config.wpm).toBe(320);
        expect(container.querySelector('[data-orbit="temporal"] .orbit-status').textContent)
            .toBe('Word · 320 wpm');
        orbital.destroy();
    });

    it('returns rhythm, pace, curve and arrival to their defaults, and nothing else', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        container.querySelector('[data-look="gallery"]').click();
        const sheet = open(container);
        sheet.querySelector('[data-chunk="sentence"]').click();
        sheet.querySelector('[data-curve="wave"]').click();
        sheet.querySelector('[data-reveal="progressive"]').click();
        const slider = sheet.querySelector('#wpm-slider');
        slider.value = '400';
        slider.dispatchEvent(new Event('input'));

        sheet.querySelector('[data-action="rhythm-default"]').click();

        expect(orbital.config).toMatchObject({ wpm: 200, curve: 'flat', chunkMode: 'phrase', revealMode: 'instant' });
        expect(lookOf(orbital.config)).toBe('gallery');
        expect(slider.value).toBe('200');
        expect(sheet.querySelector('[data-chunk="phrase"]').classList).toContain('active');
        expect(JSON.parse(localStorage.getItem('rise_orbital_prefs_v1'))).toMatchObject({ wpm: 200, chunkMode: 'phrase' });
        orbital.destroy();
    });

    it('closes on Escape and gives focus back to its row', () => {
        const { container, orbital } = createOrbital();
        const sheet = open(container);
        expect(sheet.querySelector('[role="dialog"]').contains(document.activeElement)).toBe(true);
        sheet.querySelector('[role="dialog"]').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(sheet.hidden).toBe(true);
        expect(document.activeElement).toBe(container.querySelector('[data-orbit="temporal"]'));
        orbital.destroy();
    });
});
