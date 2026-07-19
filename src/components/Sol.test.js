/**
 * Custom SOL (My Day) tests — plan persistence, window resolution through
 * the plan (curated reassignments, blueprints, dangling references), and
 * the My Day tab's assignment UI.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Sol } from './Sol.js';
import { MemoryCore } from '../core/memory.js';

const PLAN_KEY = 'rise_sol_plan_v1';
const WORKSHOP_KEY = 'rise_workshop_v1';

const BLUEPRINT = {
    id: 'bp-evening',
    title: 'Evening Ritual',
    wpm: 200,
    paceV2: true, // authored under the honest temporal contract
    curve: 'induction',
    audioPreset: 'deep',
    chunkMode: 'word',
    sources: [{ name: 'ritual', data: 'breathe and settle into the evening quiet '.repeat(20) }],
    visualConfig: { visualMode: 'attractor', attractor: { system: 'thomas' } }
};

function makeSol(hour, options = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const sol = new Sol(container, options);
    sol.currentTime = new Date(2026, 6, 14, hour, 30);
    return { sol, container };
}

beforeEach(() => {
    localStorage.removeItem(PLAN_KEY);
    localStorage.removeItem(WORKSHOP_KEY);
});

describe('SOL plan store', () => {
    it('round-trips entries and clears with null', () => {
        expect(MemoryCore.getSolPlan()).toEqual({});
        MemoryCore.setSolPlanEntry('evening', { kind: 'sol', id: 'sol-sit-grief' });
        expect(MemoryCore.getSolPlan()).toEqual({ evening: { kind: 'sol', id: 'sol-sit-grief' } });
        MemoryCore.setSolPlanEntry('evening', null);
        expect(MemoryCore.getSolPlan()).toEqual({});
    });
});

describe('My Day resolution', () => {
    it('unplanned windows resolve to the canonical default', () => {
        const { sol, container } = makeSol(19); // evening
        const { suggestion } = sol.getSuggestedSequence();
        expect(suggestion.id).toBe('sol-evening');
        expect(suggestion.isCustom).toBe(false);
        sol.destroy();
        container.remove();
    });

    it('a curated reassignment resolves as custom', () => {
        MemoryCore.setSolPlanEntry('evening', { kind: 'sol', id: 'sol-arch-cosmological' });
        const { sol, container } = makeSol(19);
        const { suggestion } = sol.getSuggestedSequence();
        expect(suggestion.id).toBe('sol-arch-cosmological');
        expect(suggestion.isCustom).toBe(true);
        expect(suggestion.kind).toBe('sol');
        sol.destroy();
        container.remove();
    });

    it('a blueprint assignment resolves with normalized display fields', () => {
        localStorage.setItem(WORKSHOP_KEY, JSON.stringify([BLUEPRINT]));
        MemoryCore.setSolPlanEntry('evening', { kind: 'blueprint', id: 'bp-evening' });
        const { sol, container } = makeSol(19);
        const { suggestion } = sol.getSuggestedSequence();
        expect(suggestion.kind).toBe('blueprint');
        expect(suggestion.title).toBe('Evening Ritual');
        expect(suggestion.subtitle).toBe('From your Workshop');
        expect(suggestion.config.wpm).toBe(200);
        expect(suggestion.isCustom).toBe(true);
        // Duration computes from the blueprint's sources
        expect(sol.getSuggestionDuration(suggestion)).toMatch(/min/);
        sol.destroy();
        container.remove();
    });

    it('a dangling blueprint reference degrades to the default and reports missing', () => {
        MemoryCore.setSolPlanEntry('evening', { kind: 'blueprint', id: 'deleted-bp' });
        const { sol, container } = makeSol(19);
        const { suggestion } = sol.getSuggestedSequence();
        expect(suggestion.id).toBe('sol-evening');
        expect(suggestion.isCustom).toBe(false);
        expect(suggestion.missing).toBe(true);
        sol.destroy();
        container.remove();
    });

    it('Begin launches blueprints through onLaunchBlueprint, sequences through onLaunchSequence', () => {
        localStorage.setItem(WORKSHOP_KEY, JSON.stringify([BLUEPRINT]));
        MemoryCore.setSolPlanEntry('evening', { kind: 'blueprint', id: 'bp-evening' });
        const onLaunchBlueprint = vi.fn();
        const onLaunchSequence = vi.fn();
        const { sol, container } = makeSol(19, { onLaunchBlueprint, onLaunchSequence });

        sol.launchSuggestion(sol.getSuggestedSequence().suggestion);
        expect(onLaunchBlueprint).toHaveBeenCalledWith(expect.objectContaining({ id: 'bp-evening' }));
        expect(onLaunchSequence).not.toHaveBeenCalled();

        MemoryCore.setSolPlanEntry('evening', null);
        sol.launchSuggestion(sol.getSuggestedSequence().suggestion);
        expect(onLaunchSequence).toHaveBeenCalled();
        sol.destroy();
        container.remove();
    });
});

describe('My Day tab UI', () => {
    it('renders all seven windows with selectors; assignment persists and marks the row', () => {
        localStorage.setItem(WORKSHOP_KEY, JSON.stringify([BLUEPRINT]));
        const { sol, container } = makeSol(19);
        sol.activeCategory = 'myday';
        sol.render();

        const rows = container.querySelectorAll('.sol-myday-row');
        expect(rows).toHaveLength(7);
        expect(container.querySelectorAll('.sol-myday-select')).toHaveLength(7);

        const eveningSelect = container.querySelector('[data-window="evening"]');
        eveningSelect.value = 'blueprint:bp-evening';
        eveningSelect.dispatchEvent(new Event('change'));

        expect(MemoryCore.getSolPlan().evening).toEqual({ kind: 'blueprint', id: 'bp-evening' });
        expect(container.querySelector('[data-reset-window="evening"]')).not.toBeNull();

        // Reset restores the default
        container.querySelector('[data-reset-window="evening"]').click();
        expect(MemoryCore.getSolPlan().evening).toBeUndefined();

        sol.destroy();
        container.remove();
    });
});
