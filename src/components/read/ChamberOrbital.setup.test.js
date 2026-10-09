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
const { SOUND_GROUPS } = await import('../../audio/sound-list.js');
const { SOUNDSCAPES } = await import('../../audio/soundscapes.js');

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

describe('the live preview', () => {
    const MORNING = 'Begin the morning by saying to thyself, I shall meet with the busy-body. The rest follows.';
    let built = [];
    let loadStill = null;
    const factories = {
        attractor: async (_host, style) => {
            const record = { style, destroyed: false };
            record.destroy = () => { record.destroyed = true; };
            built.push(record);
            return record;
        }
    };
    const living = () => built.filter(record => !record.destroyed);
    const settle = async (ms = 0) => {
        await vi.advanceTimersByTimeAsync(ms);
        await Promise.resolve();
    };
    const withPreview = () => {
        const made = createOrbital({ preview: { factories, loadStill } });
        made.orbital.loadText(MORNING, 'Meditations');
        return made;
    };
    const chooseSignal = (container, orbital) => {
        container.querySelector('[data-orbit="look"]').click();
        container.querySelector('[data-look-option="signal"]').click();
        orbital.closeModal('look');
    };
    const previewOf = container => container.querySelector('.setup-preview');
    const unit = container => previewOf(container).querySelector('.setup-preview-unit').textContent;
    const ground = container => previewOf(container).style.getPropertyValue('--preview-ground');
    const ink = container => previewOf(container).style.getPropertyValue('--preview-ink');
    const stillOf = container => previewOf(container).querySelector('.setup-preview-still').style.backgroundImage;
    const setHidden = hidden => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: hidden ? 'hidden' : 'visible' });
        document.dispatchEvent(new Event('visibilitychange'));
    };

    beforeEach(() => {
        vi.useFakeTimers();
        built = [];
        loadStill = vi.fn(async id => `https://rise.test/${id}.webp`);
    });

    afterEach(() => {
        setHidden(false);
        vi.useRealTimers();
    });

    it('sits above the text and adds no control, at every width', () => {
        for (const width of [1280, 390, 360]) {
            setWidth(width);
            const { container, orbital } = withPreview();
            const preview = previewOf(container);
            expect(preview, `${width}`).not.toBeNull();
            expect(preview.compareDocumentPosition(container.querySelector('.reader-text'))
                & Node.DOCUMENT_POSITION_FOLLOWING, `${width}`).toBeTruthy();
            expect(preview.querySelectorAll(FOCUSABLE), `${width}`).toHaveLength(0);
            expect(firstScreen(container), `${width}`).toHaveLength(8);
            orbital.destroy();
            container.remove();
        }
    });

    it('shows the current look\'s field and colour, and the first unit in the current rhythm', async () => {
        const { container, orbital } = withPreview();
        container.querySelector('[data-look="gallery"]').click();
        await settle(0);

        expect(loadStill).toHaveBeenLastCalledWith('turrell');
        expect(stillOf(container)).toContain('https://rise.test/turrell.webp');
        expect(ground(container)).toBe('#08090F');
        expect(ink(container)).toBe('#F4EEE4');
        expect(unit(container)).toBe('Begin the morning by saying to thyself,');
        orbital.destroy();
    });

    it('draws Signal\'s attractor live, coloured by its theme as the Chamber colours it', async () => {
        const { container, orbital } = withPreview();
        chooseSignal(container, orbital);
        await settle(600);

        expect(living()).toHaveLength(1);
        expect(living()[0].style).toEqual({ system: 'thomas', palette: 'blue', form: 'mirror' });
        expect(ground(container)).toBe('#071326');
        orbital.destroy();
    });

    it('draws no field in Plain: the ground and the first unit only', async () => {
        const { container, orbital } = withPreview();
        container.querySelector('[data-look="plain"]').click();
        await settle(1000);

        expect(loadStill).not.toHaveBeenCalled();
        expect(built).toHaveLength(0);
        expect(stillOf(container)).toBe('');
        expect(unit(container)).toBe('Begin the morning by saying to thyself,');
        orbital.destroy();
    });

    it('follows the look, the colour, the rhythm and the text', () => {
        const { container, orbital } = withPreview();
        container.querySelector('[data-look="nocturne"]').click();
        expect(ground(container)).toBe('#140B20');

        container.querySelector('[data-orbit="look"]').click();
        container.querySelector('[data-colour="jade"]').click();
        expect(ground(container)).toBe('#061912');
        expect(ink(container)).toBe('#AFFFCE');
        orbital.closeModal('look');

        container.querySelector('[data-orbit="temporal"]').click();
        container.querySelector('[data-chunk="word"]').click();
        expect(unit(container)).toBe('Begin');
        container.querySelector('[data-chunk="sentence"]').click();
        expect(unit(container)).toBe('Begin the morning by saying to thyself, I shall meet with the busy-body.');
        orbital.closeModal('temporal');

        orbital.loadText('It is enough. The rest follows.', 'Enchiridion');
        expect(unit(container)).toBe('It is enough.');
        orbital.destroy();
    });

    it('pauses while a sheet or panel covers it, and resumes when the last one closes', async () => {
        const { container, orbital } = withPreview();
        container.querySelector('[data-orbit="look"]').click();
        container.querySelector('[data-look-option="signal"]').click();
        await settle(1000);
        expect(living()).toHaveLength(0);

        container.querySelector('#modal-look [data-orbit="audio"]').click();
        orbital.closeModal('audio');
        await settle(1000);
        expect(living()).toHaveLength(0);

        orbital.closeModal('look');
        await settle(600);
        expect(living()).toHaveLength(1);

        container.querySelector('[data-orbit="temporal"]').click();
        expect(living()).toHaveLength(0);
        orbital.destroy();
    });

    it('pauses while the tab is hidden', async () => {
        const { container, orbital } = withPreview();
        chooseSignal(container, orbital);
        await settle(600);
        setHidden(true);
        expect(living()).toHaveLength(0);
        setHidden(false);
        await settle(600);
        expect(living()).toHaveLength(1);
        orbital.destroy();
    });

    it('stops when Begin is pressed', async () => {
        const { container, orbital, onBeginSession } = withPreview();
        chooseSignal(container, orbital);
        await settle(600);
        expect(living()).toHaveLength(1);
        container.querySelector('#begin-btn').click();
        expect(onBeginSession).toHaveBeenCalledOnce();
        expect(living()).toHaveLength(0);
        await settle(1000);
        expect(living()).toHaveLength(0);
        orbital.destroy();
    });

    it('is destroyed when setup unmounts', async () => {
        const { container, orbital } = withPreview();
        chooseSignal(container, orbital);
        await settle(600);
        expect(living()).toHaveLength(1);
        orbital.destroy();
        expect(living()).toHaveLength(0);
        setHidden(true);
        setHidden(false);
        await settle(1000);
        expect(living()).toHaveLength(0);
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

    it('in Inlay, locks Phrase and Sentence and says why on the controls; another look gives them back', () => {
        setWidth(820);
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        container.querySelector('[data-look="inlay"]').click();
        const sheet = open(container);
        const chunk = id => sheet.querySelector(`[data-chunk="${id}"]`);
        const note = sheet.querySelector('[data-chunk-lock-note]');
        for (const id of ['phrase', 'sentence']) {
            expect(chunk(id).disabled, id).toBe(true);
            expect(chunk(id).title, id).toBe('Inlay paints one word at a time');
            expect(chunk(id).querySelector('.chunk-lock'), id).not.toBeNull();
        }
        expect(chunk('word').disabled).toBe(false);
        expect(chunk('word').classList).toContain('active');
        expect(note.hidden).toBe(false);
        expect(note.textContent).toMatch(/Inlay paints one word at a time/u);

        container.querySelector('[data-look="plain"]').click();
        for (const id of ['phrase', 'sentence', 'word']) {
            expect(chunk(id).disabled, id).toBe(false);
            expect(chunk(id).querySelector('.chunk-lock'), id).toBeNull();
        }
        expect(note.hidden).toBe(true);
        orbital.destroy();
    });

    it('keeps Inlay in Inlay on Default: its rhythm is the word', () => {
        setWidth(820);
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        container.querySelector('[data-look="inlay"]').click();
        open(container).querySelector('[data-action="rhythm-default"]').click();
        expect(orbital.config.chunkMode).toBe('word');
        expect(lookOf(orbital.config)).toBe('inlay');
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

describe('the Sound panel: one sound list (RDR-024)', () => {
    const choiceId = button => button.dataset.soundscape ?? button.dataset.audioPreset;
    const active = container => [...container.querySelectorAll('#modal-audio .active[data-soundscape], #modal-audio .active[data-audio-preset]')]
        .map(choiceId);

    it('offers Silence, the 13 soundscapes and the 3 tones, in the four groups', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        const groups = [...container.querySelectorAll('#modal-audio [data-sound-group]')]
            .filter(group => !group.hidden);

        expect(groups.map(group => group.dataset.soundGroup)).toEqual(SOUND_GROUPS.map(group => group.id));
        const offered = groups.map(group => [...group.querySelectorAll('[data-soundscape], [data-audio-preset]')]
            .filter(button => !button.hidden).map(choiceId));
        expect(offered).toEqual(SOUND_GROUPS.map(group => group.entries.map(entry => entry.id)));
        expect(offered.flat().filter(id => Object.hasOwn(SOUNDSCAPES, id))).toHaveLength(13);
        expect(offered.at(-1)).toEqual(['focus', 'deep', 'gateway']);
        orbital.destroy();
    });

    it('plays one sound at a time: a tone rests the soundscape, and Silence rests both', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        const choose = id => container.querySelector(`#modal-audio [data-soundscape="${id}"], #modal-audio [data-audio-preset="${id}"]`).click();
        const status = () => container.querySelector('.orbit-audio .orbit-status').textContent;

        choose('night-drive');
        expect(orbital.config).toMatchObject({ soundscape: 'night-drive', audioPreset: 'silent' });
        expect(active(container)).toEqual(['night-drive']);
        expect(status()).toBe('Night Drive');

        choose('gateway');
        expect(orbital.config).toMatchObject({ soundscape: 'none', audioPreset: 'gateway' });
        expect(active(container)).toEqual(['gateway']);
        expect(status()).toBe('Gateway');

        choose('none');
        expect(orbital.config).toMatchObject({ soundscape: 'none', audioPreset: 'silent' });
        expect(active(container)).toEqual(['none']);
        expect(status()).toBe('Silence');
        orbital.destroy();
    });

    it('keeps personal swells out of setup: they live in the Workshop', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        const panel = container.querySelector('#modal-audio');
        expect(panel.querySelector('#swell-upload')).toBeNull();
        expect(panel.querySelector('#personal-swell-list')).toBeNull();
        expect(panel.textContent).not.toMatch(/swell/i);
        orbital.destroy();
    });

    it('forgets a swell an older setup remembered, so no choice is left that setup cannot show', () => {
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({ paceV2: true, selectedSwellId: 'swell_1' }));
        const { orbital, onBeginSession } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        orbital.beginSession();
        expect(onBeginSession.mock.calls[0][0].selectedSwellId).toBeNull();
        expect(JSON.parse(localStorage.getItem('rise_orbital_prefs_v1'))).not.toHaveProperty('selectedSwellId');
        orbital.destroy();
    });

    it('keeps a tone’s delivery and waveform out of setup: they are shaped in the Workshop', () => {
        const { container, orbital } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        container.querySelector('#modal-audio [data-audio-preset="focus"]').click();
        const panel = container.querySelector('#modal-audio');
        expect(panel.querySelector('[data-entrainment], [data-waveform]')).toBeNull();
        expect(panel.textContent).not.toMatch(/Entrainment|Waveform/u);
        orbital.destroy();
    });

    it('forgets a delivery and waveform an older setup remembered, so its tone plays as the Workshop would start it', () => {
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({ paceV2: true, audioPreset: 'focus', entrainmentMode: 'isochronic', entrainmentWaveform: 'sawtooth' }));
        const { orbital, onBeginSession } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        orbital.beginSession();
        expect(onBeginSession.mock.calls[0][0]).toMatchObject({ audioPreset: 'focus', entrainmentMode: 'binaural', entrainmentWaveform: 'sine' });
        const saved = JSON.parse(localStorage.getItem('rise_orbital_prefs_v1'));
        expect(saved).not.toHaveProperty('entrainmentMode');
        expect(saved).not.toHaveProperty('entrainmentWaveform');
        orbital.destroy();
    });

    it('carries the delivery and waveform of a composition opened in setup through to its reading', () => {
        const { orbital, onBeginSession } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations', { audioPreset: 'deep', entrainmentMode: 'monaural', entrainmentWaveform: 'triangle' });
        orbital.beginSession();
        expect(onBeginSession.mock.calls[0][0]).toMatchObject({ audioPreset: 'deep', entrainmentMode: 'monaural', entrainmentWaveform: 'triangle' });
        orbital.destroy();
    });
});

describe('Living Text: the reader’s Setting, not setup’s', () => {
    it('asks for it in every setup reading, whatever an older setup saved: Settings decides', () => {
        localStorage.setItem('rise_orbital_prefs_v1', JSON.stringify({
            paceV2: true, visualInterlocution: { visualMode: 'off', livingText: { enabled: false } }
        }));
        const { orbital, onBeginSession } = createOrbital();
        orbital.loadText('Begin the morning', 'Meditations');
        orbital.beginSession();
        expect(onBeginSession.mock.calls[0][0].visualConfig.livingText).toEqual({ enabled: true });
        orbital.destroy();
    });
});
