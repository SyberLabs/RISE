/**
 * Regression tests for preset visibility in the Visual Settings panel.
 *
 * A SOL sequence (or archetype) launches with a visualConfig preset; the
 * panel must render that preset visibly and modifiably — and must not
 * wipe it back to defaults on the first user interaction.
 */
import { describe, it, expect } from 'vitest';
import { VisualInterlocutionPanel } from './VisualInterlocutionPanel.js';
import { WIKIMEDIA_CATEGORIES } from '../sources/visual/wikimedia.js';
import { MUSEUM_CATEGORIES } from '../sources/visual/museum.js';

// SOL Dawn's visual preset, as it arrives via `...visualConfig` spread
const SOL_DAWN_CONFIG = {
    visualMode: 'interlocution',
    interlocution: { frequency: 0.2, duration: 120, sourced: ['solar'], procedural: [] }
};

function makePanel(options = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const panel = new VisualInterlocutionPanel(container, { expanded: true, ...options });
    return { panel, container };
}

describe('VisualInterlocutionPanel preset visibility', () => {
    it('honors a nested interlocution preset passed at construction (SOL launch path)', () => {
        const { panel, container } = makePanel({ ...SOL_DAWN_CONFIG });

        const config = panel.getConfig();
        expect(config.visualMode).toBe('interlocution');
        expect(config.interlocution.frequency).toBe(0.2);
        expect(config.interlocution.duration).toBe(120);
        expect(config.interlocution.sourced).toEqual(['solar']);

        // The preset is visible: the solar checkbox exists and is checked
        const solarCheckbox = container.querySelector('[data-sourced="solar"]');
        expect(solarCheckbox).not.toBeNull();
        expect(solarCheckbox.checked).toBe(true);

        panel.destroy();
        container.remove();
    });

    it('still honors legacy flattened options', () => {
        const { panel, container } = makePanel({ frequency: 0.4, sourced: ['haeckel'], procedural: ['klee'] });
        const config = panel.getConfig();
        expect(config.interlocution.frequency).toBe(0.4);
        expect(config.interlocution.sourced).toEqual(['haeckel']);
        expect(config.interlocution.procedural).toEqual(['klee']);
        panel.destroy();
        container.remove();
    });

    it('treats ASCII as a render language and preserves the selected source', () => {
        let emitted = null;
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: {
                renderLanguage: 'native',
                sourceFamily: 'procedural',
                procedural: ['klee'],
                sourced: []
            },
            onChange: config => { emitted = config; }
        });

        container.querySelector('[data-render-language="ascii"]').click();

        expect(emitted.interlocution.renderLanguage).toBe('ascii');
        expect(emitted.interlocution.procedural).toEqual(['klee']);
        expect(emitted.interlocution.sourced).toEqual([]);
        expect(container.querySelector('[data-render-language="ascii"]').classList.contains('active')).toBe(true);

        panel.destroy();
        container.remove();
    });

    it('renders the categories the Wikimedia provider defines (minus AIC-shadowed ids)', () => {
        const { panel, container } = makePanel({ ...SOL_DAWN_CONFIG });

        for (const id of Object.keys(WIKIMEDIA_CATEGORIES)) {
            if (id === 'romantic') continue; // legacy-routed to AIC; lives in the AIC section
            expect(container.querySelector(`[data-sourced="${id}"]`), `missing checkbox for '${id}'`).not.toBeNull();
        }

        panel.destroy();
        container.remove();
    });

    it('renders every Art Institute category under its namespaced aic- id', () => {
        const { panel, container } = makePanel({ ...SOL_DAWN_CONFIG });

        for (const id of Object.keys(MUSEUM_CATEGORIES)) {
            expect(container.querySelector(`[data-sourced="aic-${id}"]`), `missing AIC checkbox for '${id}'`).not.toBeNull();
        }
        // Bare (un-namespaced) AIC ids must not appear as checkboxes
        expect(container.querySelector('[data-sourced="renaissance"]')).toBeNull();
        expect(container.querySelector('[data-sourced="landscapes"]')).toBeNull();
        expect(container.querySelector('[data-sourced="romantic"]')).toBeNull();

        panel.destroy();
        container.remove();
    });

    it('an AIC preset is visible and checked (e.g. archetype with aic-oldmasters)', () => {
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { frequency: 0.3, duration: 80, sourced: ['aic-oldmasters'], procedural: [] }
        });

        const box = container.querySelector('[data-sourced="aic-oldmasters"]');
        expect(box).not.toBeNull();
        expect(box.checked).toBe(true);

        panel.destroy();
        container.remove();
    });

    it('retires stale met-* ids while preserving other compatible sources', () => {
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { frequency: 0.3, duration: 80, sourced: ['aic-surrealism', 'met-egyptian'], procedural: [] }
        });

        expect(container.querySelector('[data-sourced="aic-surrealism"]')).toBeNull();
        expect(container.querySelector('[data-sourced="met-egyptian"]')).toBeNull();
        expect(panel.getConfig().interlocution.sourced).toEqual(['aic-surrealism']);
        expect(panel.getConfig().interlocution.procedural).toEqual([]);
        // The replacement categories are offered
        expect(container.querySelector('[data-sourced="aic-ukiyoe"]')).not.toBeNull();
        expect(container.querySelector('[data-sourced="aic-postimpressionism"]')).not.toBeNull();
        expect(container.querySelector('[data-sourced="aic-oldmasters"]')).not.toBeNull();
        expect(container.querySelector('[data-sourced="aic-portraits"]')).not.toBeNull();

        panel.destroy();
        container.remove();
    });

    it('migrates a saved Met-only preset to procedural Klee', () => {
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { frequency: 0.3, duration: 80, sourced: ['met-egyptian'], procedural: [] }
        });

        expect(panel.getConfig().interlocution.sourced).toEqual([]);
        expect(panel.getConfig().interlocution.procedural).toEqual(['klee']);
        expect(container.querySelector('[data-procedural="klee"]').checked).toBe(true);

        panel.destroy();
        container.remove();
    });

    it('switching a collection preset to Procedural clears painting categories', () => {
        let emitted = null;
        const { panel, container } = makePanel({
            ...SOL_DAWN_CONFIG,
            onChange: (config) => { emitted = config; }
        });

        // The source family is the deliberate boundary. Temporal settings
        // remain intact while incompatible image categories are discarded.
        expect(panel.getConfig().interlocution.sourceFamily).toBe('collections');
        container.querySelector('[data-source-family="procedural"]').click();

        const kleeCheckbox = container.querySelector('[data-procedural="klee"]');
        kleeCheckbox.checked = true;
        kleeCheckbox.dispatchEvent(new Event('change'));

        expect(emitted).not.toBeNull();
        expect(emitted.interlocution.sourceFamily).toBe('procedural');
        expect(emitted.interlocution.sourced).toEqual([]);
        expect(emitted.interlocution.duration).toBe(120);
        expect(emitted.interlocution.procedural).toContain('klee');

        panel.destroy();
        container.remove();
    });

    it('preserves mixed sources only when Blend is explicit', () => {
        const { panel, container } = makePanel({
            ...SOL_DAWN_CONFIG,
            interlocution: {
                ...SOL_DAWN_CONFIG.interlocution,
                sourceFamily: 'blend'
            }
        });

        const kleeCheckbox = container.querySelector('[data-procedural="klee"]');
        kleeCheckbox.checked = true;
        kleeCheckbox.dispatchEvent(new Event('change'));

        expect(panel.getConfig().interlocution).toMatchObject({
            sourceFamily: 'blend',
            sourced: ['solar']
        });
        expect(panel.getConfig().interlocution.procedural).toContain('klee');

        panel.destroy();
        container.remove();
    });

    it('treats a partial preset source array as a complete selection replacement', () => {
        const { panel, container } = makePanel({ ...SOL_DAWN_CONFIG });

        panel.setConfig({ interlocution: { procedural: ['klee'] } });

        expect(panel.getConfig().interlocution).toMatchObject({
            sourceFamily: 'procedural',
            procedural: ['klee'],
            sourced: [],
            duration: 120
        });

        panel.destroy();
        container.remove();
    });

    it('Living Response section: Responsive is disabled outside Rhythmic mode but keeps its state', () => {
        const { panel, container } = makePanel({
            visualMode: 'attractor',
            interlocution: { frequency: 0.3, duration: 80, sourced: [], procedural: [], responsive: true }
        });

        const responsive = container.querySelector('[data-responsive]');
        expect(responsive.disabled).toBe(true);
        expect(responsive.checked).toBe(true); // stored preference preserved, visibly

        // Living Text stays operable in any mode
        expect(container.querySelector('[data-livingtext]').disabled).toBe(false);

        panel.destroy();
        container.remove();
    });

    it('Living Response section: Responsive is operable in Rhythmic mode', () => {
        const { panel, container } = makePanel({ ...SOL_DAWN_CONFIG });
        expect(container.querySelector('[data-responsive]').disabled).toBe(false);
        panel.destroy();
        container.remove();
    });

    it('mood/rhythm sub-toggles appear only when Responsive is on, defaulting enabled', () => {
        const off = makePanel({ ...SOL_DAWN_CONFIG });
        expect(off.container.querySelector('[data-responsive-mood]')).toBeNull();
        off.panel.destroy();
        off.container.remove();

        const on = makePanel({
            visualMode: 'interlocution',
            interlocution: { frequency: 0.2, duration: 80, sourced: [], procedural: ['klee'], responsive: true }
        });
        const mood = on.container.querySelector('[data-responsive-mood]');
        const rhythm = on.container.querySelector('[data-responsive-rhythm]');
        expect(mood).not.toBeNull();
        expect(rhythm).not.toBeNull();
        expect(mood.checked).toBe(true);
        expect(rhythm.checked).toBe(true);
        on.panel.destroy();
        on.container.remove();
    });

    it('toggling a sub-intent emits the updated config', () => {
        let emitted = null;
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { frequency: 0.2, duration: 80, sourced: [], procedural: ['klee'], responsive: true },
            onChange: (config) => { emitted = config; }
        });

        const mood = container.querySelector('[data-responsive-mood]');
        mood.checked = false;
        mood.dispatchEvent(new Event('change'));

        expect(emitted.interlocution.responsiveMood).toBe(false);
        expect(emitted.interlocution.responsiveRhythm).toBe(true);
        expect(emitted.interlocution.responsive).toBe(true);

        panel.destroy();
        container.remove();
    });

    it('genesis panel: glass tile toggle defaults on and emits config changes', () => {
        let emitted = null;
        const { panel, container } = makePanel({
            visualMode: 'genesis',
            onChange: (config) => { emitted = config; }
        });

        const glass = container.querySelector('[data-genesis-glass]');
        expect(glass).not.toBeNull();
        expect(glass.checked).toBe(true);

        glass.checked = false;
        glass.dispatchEvent(new Event('change'));
        expect(emitted.genesis.glass).toBe(false);
        expect(emitted.visualMode).toBe('genesis');

        panel.destroy();
        container.remove();
    });

    it('setConfig merges a preset into an already-constructed panel', () => {
        const { panel, container } = makePanel({});
        panel.setConfig(SOL_DAWN_CONFIG);

        const config = panel.getConfig();
        expect(config.visualMode).toBe('interlocution');
        expect(config.interlocution.sourced).toEqual(['solar']);
        expect(container.querySelector('[data-sourced="solar"]').checked).toBe(true);

        panel.destroy();
        container.remove();
    });

    it('setConfig also migrates a late Met-only archetype preset', () => {
        const { panel, container } = makePanel({});
        panel.setConfig({
            visualMode: 'interlocution',
            interlocution: { sourced: ['met-egyptian'], procedural: [] }
        });

        expect(panel.getConfig().interlocution.sourced).toEqual([]);
        expect(panel.getConfig().interlocution.procedural).toEqual(['klee']);
        expect(container.querySelector('[data-procedural="klee"]').checked).toBe(true);

        panel.destroy();
        container.remove();
    });
});

describe('Harmonograph climate chips', () => {
    it('chips appear only when harmonograph is enabled; Auto is the default', () => {
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { procedural: [], sourced: [] }
        });
        panel.activeAccordions = ['procedural'];
        panel.render();
        panel.attachEvents();
        expect(container.querySelector('[data-preset-group="harmonograph"]')).toBeNull();

        container.querySelector('[data-procedural="harmonograph"]').click();
        const chips = container.querySelectorAll('[data-for="harmonograph"]');
        expect(chips.length).toBe(7);
        expect(container.querySelector('[data-for="harmonograph"][data-preset="auto"]')
            .classList.contains('active')).toBe(true);

        panel.destroy();
        container.remove();
    });

    it('selecting a climate pins it in config; klee preset is untouched', () => {
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { procedural: ['harmonograph', 'klee'], sourced: [], kleePreset: 'harmonic' }
        });
        panel.activeAccordions = ['procedural'];
        panel.render();
        panel.attachEvents();

        container.querySelector('[data-for="harmonograph"][data-preset="stormViolet"]').click();
        const config = panel.getConfig();
        expect(config.interlocution.harmonographClimate).toBe('stormViolet');
        expect(config.interlocution.kleePreset).toBe('harmonic');
        expect(container.querySelector('[data-for="harmonograph"][data-preset="stormViolet"]')
            .classList.contains('active')).toBe(true);

        panel.destroy();
        container.remove();
    });
});
