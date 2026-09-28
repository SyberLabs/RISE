import { describe, expect, it } from 'vitest';
import { taxonomyLeaves } from './visual-taxonomy.js';
import { RAIL_FAMILIES, chooseField, railNeighbour, worldRail } from './world-rail.js';

describe('the world rail', () => {
  it('holds every taxonomy leaf exactly once, grouped by family in rail order', () => {
    const rail = worldRail();
    expect(rail.map(w => w.id).sort()).toEqual(taxonomyLeaves().map(l => l.id).sort());
    const order = RAIL_FAMILIES.map(f => f.id);
    const seen = rail.map(w => order.indexOf(w.family));
    expect(seen.every(i => i >= 0)).toBe(true);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it("names families in the reader's words", () => {
    const family = id => worldRail().find(w => w.id === id).family;
    expect(family('off')).toBe('stillness');
    expect(family('focal')).toBe('stillness');
    expect(family('attractor')).toBe('drawn');
    expect(family('klee')).toBe('drawn');
    expect(family('fractal')).toBe('fields');
    expect(family('by-manner')).toBe('art');
    expect(family('science')).toBe('art');
    expect(family('personal')).toBe('yours');
  });

  it('steps between neighbours and stops at either end', () => {
    const rail = worldRail();
    expect(railNeighbour(rail, rail[0].id, -1)).toBe(rail[0].id);
    expect(railNeighbour(rail, rail[0].id, 1)).toBe(rail[1].id);
    expect(railNeighbour(rail, rail.at(-1).id, 1)).toBe(rail.at(-1).id);
    expect(railNeighbour(rail, 'not-a-leaf', 1)).toBe(rail[0].id);
  });

  it('choosing replaces the field, even with a gallery visual', () => {
    expect([...chooseField(new Set(['fractal']), 'turrell')]).toEqual(['turrell']);
    expect([...chooseField(new Set(['attractor']), 'focal')]).toEqual(['focal']);
    expect([...chooseField(new Set(['fractal', 'turrell']), 'by-manner')]).toEqual(['by-manner']);
    expect([...chooseField(new Set(['fractal']), 'off')]).toEqual([]);
    expect([...chooseField(new Set(['fractal']), 'nope')]).toEqual(['fractal']);
  });
});
