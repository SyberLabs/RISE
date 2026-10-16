import { describe, expect, it } from 'vitest';
import {
  GATE_RADIUS,
  RING_RADIUS,
  WHEEL_SECTOR_DEGREES,
  houseById,
  pathsOfRecord,
  recordById,
  recordsOfHouse,
  schoolStatus,
  wheelPosition
} from './index.js';
import { SCHOOL_CANON } from './canon.js';
import { GATE, HOUSES } from './houses.js';

const WITHHELD = 'Not in the launch canon.';
const MANIFEST = {
  works: [
    { id: 'literary-meditations', shelved: true },
    { id: 'faust', shelved: false, withheldReason: WITHHELD },
    { id: 'sacred-emerald-tablet', shelved: true }
  ]
};

describe('lookups', () => {
  it('find a house, the Gate, and a record by id', () => {
    expect(houseById('saturn')).toBe(HOUSES.find(house => house.id === 'saturn'));
    expect(houseById('gate')).toBe(GATE);
    expect(houseById('pluto')).toBeNull();
    expect(recordById('sun.meditations').title).toBe('Meditations');
    expect(recordById('sun.nothing')).toBeNull();
  });

  it('list a house\'s records by degree, then in canon order', () => {
    expect(recordsOfHouse('sun').map(record => record.id)).toEqual([
      'sun.fragments', 'sun.meditations', 'sun.nature',
      'sun.symposium-phaedrus-timaeus', 'sun.zarathustra', 'sun.monadology',
      'sun.ethics', 'sun.enneads'
    ]);
    expect(recordsOfHouse('gate').map(record => record.id)).toEqual(['gate.oration']);
    expect(recordsOfHouse('pluto')).toEqual([]);
  });

  it('name the paths a record lies on', () => {
    expect(pathsOfRecord('venus.spiritual-in-art').map(path => path.id)).toEqual(['ficino', 'form']);
    expect(pathsOfRecord('mars.renaissance-in-italy').map(path => path.id)).toEqual(['ficino', 'seasons']);
    expect(pathsOfRecord('sun.ethics')).toEqual([]);
  });
});

describe('schoolStatus', () => {
  it('is readable when the manifest shelves the work and the Library registers it', () => {
    expect(schoolStatus(recordById('sun.meditations'), MANIFEST)).toEqual({ state: 'readable', reason: null });
  });

  it('is carried, with the archive\'s reason, when the manifest withholds the work', () => {
    expect(schoolStatus(recordById('venus.faust'), MANIFEST)).toEqual({ state: 'carried', reason: WITHHELD });
  });

  it('is absent when the record names no work, or the manifest does not', () => {
    expect(schoolStatus(recordById('sun.zarathustra'), MANIFEST)).toEqual({ state: 'absent', reason: null });
    expect(schoolStatus(recordById('sun.fragments'), MANIFEST)).toEqual({ state: 'absent', reason: null });
  });

  it('keeps an original-only record absent, its rights shown beside the state', () => {
    const oration = recordById('gate.oration');
    expect(oration.rights).toBe('orig-only');
    expect(schoolStatus(oration, MANIFEST)).toEqual({ state: 'absent', reason: null });
  });

  it('is absent when the manifest shelves a work the Library does not register', () => {
    expect(schoolStatus(recordById('saturn.emerald-tablet'), MANIFEST)).toEqual({ state: 'absent', reason: null });
  });

  it('treats every work as absent until the manifest arrives', () => {
    expect(schoolStatus(recordById('sun.meditations'), null)).toEqual({ state: 'absent', reason: null });
  });
});

describe('wheelPosition', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const sub = (record, ring) => recordsOfHouse(record).filter(r => r.degree === ring).map(wheelPosition);

  it('climbs from the Gate disc through three rings', () => {
    expect(GATE_RADIUS).toBe(0.14);
    expect(RING_RADIUS).toEqual({ 1: 0.5, 2: 0.68, 3: 0.86 });
  });

  it('sets the Gate at the origin', () => {
    expect(wheelPosition(recordById('gate.oration'))).toEqual({ x: 0, y: 0, angle: 0, radius: 0 });
  });

  it('divides the circle into seven sectors', () => {
    expect(WHEEL_SECTOR_DEGREES).toBe(360 / 7);
  });

  it('puts each text within 0.05 of its degree ring, inside its house sector, 12 degrees clear of each edge', () => {
    for (const record of SCHOOL_CANON.filter(r => r.house !== 'gate')) {
      const { x, y, angle, radius } = wheelPosition(record);
      const start = houseById(record.house).order * WHEEL_SECTOR_DEGREES;
      expect(Math.abs(radius - RING_RADIUS[record.degree]), record.id).toBeLessThanOrEqual(0.05 + 1e-9);
      expect(angle, record.id).toBeGreaterThanOrEqual(start + 12 - 1e-9);
      expect(angle, record.id).toBeLessThanOrEqual(start + WHEEL_SECTOR_DEGREES - 12 + 1e-9);
      expect(near(Math.hypot(x, y), radius), record.id).toBe(true);
    }
  });

  it('measures angles clockwise from the top, with y growing downward', () => {
    const sun = wheelPosition(recordById('sun.ethics'));
    expect(sun.y).toBeLessThan(0);
    const venus = wheelPosition(recordById('venus.aesthetic-education'));
    expect(venus.x).toBeGreaterThan(0);
  });

  it('centres a lone text in its sector and spreads an uncrowded degree evenly on its ring', () => {
    const lone = wheelPosition(recordById('venus.aesthetic-education'));
    expect(near(lone.angle, 1 * WHEEL_SECTOR_DEGREES + WHEEL_SECTOR_DEGREES / 2)).toBe(true);
    const sunThreshold = sub('sun', 1);
    expect(sunThreshold.every(p => p.radius === RING_RADIUS[1])).toBe(true);
    expect(near(sunThreshold[0].angle, 12)).toBe(true);
    expect(near(sunThreshold[2].angle, WHEEL_SECTOR_DEGREES - 12)).toBe(true);
    expect(near(sunThreshold[1].angle - sunThreshold[0].angle, sunThreshold[2].angle - sunThreshold[1].angle)).toBe(true);
  });

  it('splits a crowded degree between sub-rings 0.05 either side of its ring', () => {
    const venus = sub('venus', 1).map(p => p.radius);
    expect(venus).toEqual([0.55, 0.45, 0.55, 0.45, 0.55, 0.45]);
  });

  it('keeps every pair of texts at least 0.10 of the radius apart', () => {
    const points = SCHOOL_CANON.map(wheelPosition);
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const gap = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
        expect(gap, `${SCHOOL_CANON[i].id} / ${SCHOOL_CANON[j].id}`).toBeGreaterThanOrEqual(0.1 - 1e-9);
      }
    }
  });
});
