import { describe, expect, it } from 'vitest';
import {
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
  const RADII = { 1: 0.42, 2: 0.62, 3: 0.82 };
  const near = (a, b) => Math.abs(a - b) < 1e-9;

  it('sets the Gate at the origin', () => {
    expect(wheelPosition(recordById('gate.oration'))).toEqual({ x: 0, y: 0, angle: 0, radius: 0 });
  });

  it('divides the circle into seven sectors', () => {
    expect(WHEEL_SECTOR_DEGREES).toBe(360 / 7);
  });

  it('puts each text on its degree\'s ring, inside its house\'s sector, 12 degrees clear of each edge', () => {
    for (const record of SCHOOL_CANON.filter(r => r.house !== 'gate')) {
      const { x, y, angle, radius } = wheelPosition(record);
      const start = houseById(record.house).order * WHEEL_SECTOR_DEGREES;
      expect(radius, record.id).toBe(RADII[record.degree]);
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

  it('centres a lone text in its sector and spreads siblings evenly', () => {
    const lone = wheelPosition(recordById('venus.aesthetic-education'));
    expect(near(lone.angle, 1 * WHEEL_SECTOR_DEGREES + WHEEL_SECTOR_DEGREES / 2)).toBe(true);
    const sunThreshold = recordsOfHouse('sun').filter(r => r.degree === 1).map(r => wheelPosition(r).angle);
    expect(near(sunThreshold[0], 12)).toBe(true);
    expect(near(sunThreshold[2], WHEEL_SECTOR_DEGREES - 12)).toBe(true);
    expect(near(sunThreshold[1] - sunThreshold[0], sunThreshold[2] - sunThreshold[1])).toBe(true);
  });

  it('gives every text a distinct position', () => {
    const keys = SCHOOL_CANON.map(record => {
      const { x, y } = wheelPosition(record);
      return `${x.toFixed(6)},${y.toFixed(6)}`;
    });
    expect(new Set(keys).size).toBe(SCHOOL_CANON.length);
  });
});
