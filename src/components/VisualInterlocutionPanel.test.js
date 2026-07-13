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

    it('an AIC preset is visible and checked (e.g. archetype with aic-surrealism)', () => {
        const { panel, container } = makePanel({
            visualMode: 'interlocution',
            interlocution: { frequency: 0.3, duration: 80, sourced: ['aic-surrealism'], procedural: [] }
        });

        const box = container.querySelector('[data-sourced="aic-surrealism"]');
        expect(box).not.toBeNull();
        expect(box.checked).toBe(true);

        panel.destroy();
        container.remove();
    });

    it('does not wipe the preset on first user interaction', () => {
        let emitted = null;
        const { panel, container } = makePanel({
            ...SOL_DAWN_CONFIG,
            onChange: (config) => { emitted = config; }
        });

        // User toggles an unrelated procedural pattern — the first emit must
        // still carry the SOL preset, not constructor defaults
        const kleeCheckbox = container.querySelector('[data-procedural="klee"]');
        kleeCheckbox.checked = true;
        kleeCheckbox.dispatchEvent(new Event('change'));

        expect(emitted).not.toBeNull();
        expect(emitted.interlocution.sourced).toEqual(['solar']);
        expect(emitted.interlocution.duration).toBe(120);
        expect(emitted.interlocution.procedural).toContain('klee');

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
});
