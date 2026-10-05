import { describe, expect, it } from 'vitest';
import { compileRiseCurrent, RISE_CURRENT_VISUALS, validateRiseCurrent } from '../../core/rise-current.js';
import { BLACK_HOLES_CURRENT } from '../../test/sealed-current.js';
import { handleMcp } from '../../../worker/mcp-server.mjs';
import { FOREST_AFTER_FIRE, WEATHER_CHAOS } from './explanations.js';

/** The black-hole explanation and the two others, in the order the instrument page describes them. */
const COMPOSER_EXPLANATIONS = [BLACK_HOLES_CURRENT, FOREST_AFTER_FIRE, WEATHER_CHAOS];

/** How many of a Current's segments ask for each instrument. */
const demand = current => Object.fromEntries(RISE_CURRENT_VISUALS.map(visual =>
    [visual, current.segments.filter(segment => segment.visual === visual).length]));

describe('the Composer explanations', () => {
    it('are three distinct answers', () => {
        expect(new Set(COMPOSER_EXPLANATIONS.map(current => current.id)).size).toBe(3);
    });

    for (const current of COMPOSER_EXPLANATIONS) {
        it(`${current.id} is admitted with nothing changed but an empty Dive list made explicit, and compiles`, () => {
            expect(validateRiseCurrent(current)).toEqual({ ...current, segments: current.segments.map(segment => ({ dives: [], ...segment })) });
            const session = compileRiseCurrent(current);
            expect(session.atoms.length).toBeGreaterThan(0);
            expect(session.visualConfig.interlocution.presentation).toBe('continuous');
        });

        it(`${current.id} is admitted by the Worker's rise_present tool`, async () => {
            const response = await handleMcp(new Request('https://rise.example/api/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'rise_present', arguments: { current } } })
            }), { MCP_ENABLED: 'true' });
            const { result } = await response.json();
            expect(result.isError).toBeUndefined();
            expect(result.structuredContent).toEqual({ current });
        });
    }

    it('are written the way the guide asks a host model to write one: a short first passage and no Dive notes', () => {
        for (const current of [FOREST_AFTER_FIRE, WEATHER_CHAOS]) {
            expect(current.segments[0].text.length, current.id).toBeLessThanOrEqual(80);
            expect(current.segments.every(segment => segment.dives === undefined), current.id).toBe(true);
            expect(current.theme, current.id).toBeDefined();
        }
    });

    it('make different presentation demands', () => {
        expect(demand(BLACK_HOLES_CURRENT)).toEqual({ still: 3, attractor: 2, genesis: 1 });
        // Contemplative: mostly still, growth for what grows, no motion.
        expect(demand(FOREST_AFTER_FIRE)).toEqual({ still: 3, attractor: 0, genesis: 3 });
        // Dynamic: the attractor carries it, and only the limit is still.
        expect(demand(WEATHER_CHAOS)).toEqual({ still: 1, attractor: 5, genesis: 0 });
        expect(FOREST_AFTER_FIRE.theme).not.toBe(WEATHER_CHAOS.theme);
    });

    it('use only the three admitted instruments, and Neural, Flame and Gallery are not among them', () => {
        expect(RISE_CURRENT_VISUALS).toEqual(['still', 'attractor', 'genesis']);
        for (const current of COMPOSER_EXPLANATIONS) {
            for (const segment of current.segments) expect(RISE_CURRENT_VISUALS).toContain(segment.visual);
        }
        for (const visual of ['neural', 'flame', 'gallery']) {
            const asked = { ...WEATHER_CHAOS, segments: [{ ...WEATHER_CHAOS.segments[0], visual }] };
            expect(() => validateRiseCurrent(asked), visual).toThrow(expect.objectContaining({ code: 'CURRENT_VISUAL' }));
        }
    });
});
