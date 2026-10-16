import { describe, expect, it } from 'vitest';
import { DEGREES, GATE, HOUSES } from './houses.js';
import { RISE_CURRENT_THEMES } from '../../core/rise-current.js';

describe('the houses', () => {
  it('are the seven planets in the Chaldean cycle clockwise from the top', () => {
    const byOrder = [...HOUSES].sort((a, b) => a.order - b.order).map(house => house.id);
    expect(byOrder).toEqual(['sun', 'venus', 'mercury', 'moon', 'saturn', 'jupiter', 'mars']);
    expect(HOUSES.map(house => house.order).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('each wear a theme a reading can carry', () => {
    for (const house of HOUSES) {
      expect(Object.hasOwn(RISE_CURRENT_THEMES, house.theme), `${house.id}: ${house.theme}`).toBe(true);
    }
    expect(Object.fromEntries(HOUSES.map(house => [house.id, house.theme]))).toEqual({
      sun: 'citrine', moon: 'silver', mercury: 'prism', venus: 'rose',
      mars: 'ember', jupiter: 'cobalt', saturn: 'amethyst'
    });
  });

  it('carry the plan\'s names, readings and glyphs', () => {
    const mercury = HOUSES.find(house => house.id === 'mercury');
    expect(mercury).toMatchObject({
      planet: 'Mercury', glyph: '☿', name: 'House of the Machine',
      reading: 'computation, technology, signal'
    });
    expect(HOUSES.map(house => house.glyph).join('')).toBe('☉☿☽♀♂♃♄');
    for (const house of HOUSES) {
      expect(house.name).toMatch(/^House of /u);
      expect(house.reading.length).toBeGreaterThan(0);
    }
  });

  it('are frozen, with the Gate at their centre and three degrees', () => {
    expect(Object.isFrozen(HOUSES)).toBe(true);
    expect(HOUSES.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(GATE)).toBe(true);
    expect(GATE).toMatchObject({ id: 'gate', name: 'The Gate' });
    expect(DEGREES.map(degree => degree.name)).toEqual(['Threshold', 'Core', 'Arcanum']);
    expect(DEGREES.map(degree => degree.n)).toEqual([1, 2, 3]);
  });
});
