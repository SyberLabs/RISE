/**
 * The Mystery School's Gate and seven houses.
 *
 * `order` places a house on the Wheel: sectors run clockwise from the top in
 * the Chaldean cycle, Sun first. `theme` is a RISE_CURRENT_THEMES id, so a
 * reading launched from a house wears the house's colour.
 */

const freeze = Object.freeze;

export const GATE = freeze({ id: 'gate', name: 'The Gate', glyph: '◯' });

export const HOUSES = freeze([
  freeze({ id: 'sun', planet: 'Sun', glyph: '☉', name: 'House of the Logos', reading: 'philosophy and first principles', theme: 'citrine', order: 0 }),
  freeze({ id: 'mercury', planet: 'Mercury', glyph: '☿', name: 'House of the Machine', reading: 'computation, technology, signal', theme: 'prism', order: 2 }),
  freeze({ id: 'moon', planet: 'Moon', glyph: '☽', name: 'House of Mind', reading: 'consciousness, dream, psyche', theme: 'silver', order: 3 }),
  freeze({ id: 'venus', planet: 'Venus', glyph: '♀', name: 'House of Imagination', reading: 'poetry, art, beauty', theme: 'rose', order: 1 }),
  freeze({ id: 'mars', planet: 'Mars', glyph: '♂', name: 'House of the City', reading: 'history, culture, power', theme: 'ember', order: 6 }),
  freeze({ id: 'jupiter', planet: 'Jupiter', glyph: '♃', name: 'House of Cosmos', reading: 'nature, form, order', theme: 'cobalt', order: 5 }),
  freeze({ id: 'saturn', planet: 'Saturn', glyph: '♄', name: 'House of the Mysteries', reading: 'hermetic, mystical, contemplative', theme: 'amethyst', order: 4 })
]);

export const DEGREES = freeze([
  freeze({ n: 1, name: 'Threshold' }),
  freeze({ n: 2, name: 'Core' }),
  freeze({ n: 3, name: 'Arcanum' })
]);
