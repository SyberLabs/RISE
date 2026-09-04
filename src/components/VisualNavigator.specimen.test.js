/**
 * THE SPECIMEN IS A SMALLER SURFACE, NOT A DIFFERENT EFFECT.
 *
 * The Chamber paints a Fit word's ink over a ground plate that sits inside
 * the glyph, behind the engine: mask-ground.js declares Attractor, Klee,
 * Turrell and Harmonograph as `dark`, so their filaments read against Dark
 * Slate rather than against whatever is behind the reading. The specimen had
 * no plate at all, so the same Attractor still — a thin bright filament on
 * near-black — was clipped to 26px letters over a near-black panel and
 * disappeared. A reader inspecting it would conclude the effect makes the
 * word almost invisible, which is false documentation of a real effect.
 *
 * The fix is not to weaken the effect for the preview. It is to give the
 * specimen the same ground, from the same function, so the miniature and the
 * Chamber cannot disagree about what an ink looks like.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisualNavigator } from './VisualNavigator.js';
import { GROUNDS, maskGroundFromConfig } from '../core/mask-ground.js';

let nav = null;
let settings = null;

const mount = (visualConfig = {}, options = {}) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    settings = { chamberFace: 'thick', fontSize: 'fit' };
    nav = new VisualNavigator(container, {
        visualConfig: {
            visualMode: 'interlocution',
            interlocution: { presentation: 'continuous' },
            ...visualConfig
        },
        onChange: vi.fn(),
        getSettings: () => settings,
        onSettingChange: (key, value) => { settings[key] = value; },
        onTextMaterialTransaction: ({ settings: patch = {} }) => Object.assign(settings, patch),
        ...options
    });
    return nav;
};

const click = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
/** The specimen lives in the Type pane; a reader opens it to see one. */
const openType = () => click(nav.container.querySelector('.vnav-node[data-id="ink"]'));
const specimen = () => nav.container.querySelector('.vnav-specimen');

afterEach(() => {
    nav?.destroy();
    nav?.container.remove();
    nav = null;
    settings = null;
    vi.restoreAllMocks();
});

describe('the masking specimen represents the Chamber', () => {
    it('carries the ground the Chamber computes for the same ink', () => {
        mount();
        openType();
        nav.setWordFill('procedural:attractor');

        const figure = specimen();
        expect(figure, 'the specimen is rendered').toBeTruthy();

        // Not a value the panel invented: the same function the runtime asks.
        const expected = maskGroundFromConfig({
            procedural: ['attractor'],
            sourced: [],
            wordFill: nav.selection.wordFill
        });
        expect(expected, 'Attractor declares a dark ground').toBe(GROUNDS.dark);
        expect(figure.dataset.specimenGround).toBe(expected);
    });

    it('gives a light-ground ink its own plate rather than one plate for all', () => {
        mount();
        openType();
        nav.setWordFill('procedural:fractal');

        const expected = maskGroundFromConfig({
            procedural: ['fractal'],
            sourced: [],
            wordFill: nav.selection.wordFill
        });
        expect(specimen().dataset.specimenGround).toBe(expected);
    });

    it('carries no plate where the Chamber carries none', () => {
        mount();
        openType();
        // A flat accent ink paints no imagery, so there is nothing to ground.
        nav.setWordFill('accent');
        const figure = specimen();
        expect(figure.classList.contains('has-ink')).toBe(false);
        expect(figure.dataset.specimenGround ?? '').toBe('');
    });

    it('shows the same word every time it is opened', () => {
        // A specimen that reseeded per mount could open on a pathological
        // frame; the explanatory surface has to be the same one twice.
        mount();
        openType();
        nav.setWordFill('procedural:attractor');
        const first = specimen().querySelector('.vnav-preview-sample').textContent;

        nav.destroy();
        nav.container.remove();
        mount();
        openType();
        nav.setWordFill('procedural:attractor');
        expect(specimen().querySelector('.vnav-preview-sample').textContent).toBe(first);
    });
});
