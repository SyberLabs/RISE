import { describe, expect, it } from 'vitest';
import { RING_CENTER, bearingOf } from './bearing.js';

// A picture 400 wide and 300 tall, placed away from the page's corner.
const rect = { left: 100, top: 50, width: 400, height: 300 };
const centre = { x: rect.left + rect.width * RING_CENTER.x, y: rect.top + rect.height * RING_CENTER.y };

describe('a bearing round the gate', () => {
  it('reads the four quarters the way the ship is posed: right is 0, up a quarter turn, left a half, down the other quarter', () => {
    expect(bearingOf(centre.x + 120, centre.y, rect)).toBeCloseTo(0, 9);
    expect(bearingOf(centre.x, centre.y - 120, rect)).toBeCloseTo(Math.PI / 2, 9);
    expect(Math.abs(bearingOf(centre.x - 120, centre.y, rect))).toBeCloseTo(Math.PI, 9);
    expect(bearingOf(centre.x, centre.y + 120, rect)).toBeCloseTo(-Math.PI / 2, 9);
  });

  it('measures from the gate, which sits above the middle of the picture, not from the middle', () => {
    expect(RING_CENTER.y).toBeLessThan(0.5);
    // Level with the picture's own middle, a point below-centre of the gate reads as straight down from it.
    expect(bearingOf(centre.x, rect.top + rect.height * 0.5, rect)).toBeCloseTo(-Math.PI / 2, 9);
  });

  it('does not depend on how far away the pointer is, only on which way', () => {
    const near = bearingOf(centre.x + 40, centre.y - 40, rect);
    const far = bearingOf(centre.x + 900, centre.y - 900, rect);
    expect(far).toBeCloseTo(near, 9);
    expect(near).toBeCloseTo(Math.PI / 4, 9);
  });

  it('has none at the gate itself, where a direction would be noise', () => {
    expect(bearingOf(centre.x, centre.y, rect)).toBeNull();
    expect(bearingOf(centre.x + 3, centre.y - 2, rect)).toBeNull();
    expect(bearingOf(centre.x + 40, centre.y, rect)).not.toBeNull();
  });

  it('is finite everywhere else, including far off the picture', () => {
    for (const [x, y] of [[-5000, 9000], [0, 0], [rect.left, rect.top], [1e6, -1e6]]) {
      const bearing = bearingOf(x, y, rect);
      expect(Number.isFinite(bearing)).toBe(true);
      expect(Math.abs(bearing)).toBeLessThanOrEqual(Math.PI);
    }
  });
});
