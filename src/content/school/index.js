/**
 * Lookups over the school's data, a record's reading state, and its place on
 * the Wheel.
 */

import { getTextById } from '../library.js';
import { SCHOOL_CANON } from './canon.js';
import { GATE, HOUSES } from './houses.js';
import { SCHOOL_PATHS } from './paths.js';

export const WHEEL_SECTOR_DEGREES = 360 / 7;

const SECTOR_MARGIN_DEGREES = 12;
const RING_RADIUS = Object.freeze({ 1: 0.42, 2: 0.62, 3: 0.82 });

export function houseById(id) {
  if (id === GATE.id) return GATE;
  return HOUSES.find(house => house.id === id) ?? null;
}

export function recordById(id) {
  return SCHOOL_CANON.find(record => record.id === id) ?? null;
}

/** Threshold to Arcanum; within a degree, canon order (the sort is stable). */
export function recordsOfHouse(houseId) {
  return SCHOOL_CANON.filter(record => record.house === houseId)
    .sort((a, b) => a.degree - b.degree);
}

export function pathsOfRecord(id) {
  return SCHOOL_PATHS.filter(path => path.steps.some(step => step.record === id));
}

/**
 * Readable only when the manifest shelves the work AND the Library registers
 * it; carried when the manifest withholds it; absent otherwise, including
 * before the manifest has loaded (`manifest` null).
 */
export function schoolStatus(record, manifest) {
  const workId = record?.work?.id;
  const entry = workId ? manifest?.works?.find(work => work.id === workId) : null;
  if (entry?.shelved === true && getTextById(workId)) return { state: 'readable', reason: null };
  if (entry?.shelved === false) return { state: 'carried', reason: entry.withheldReason ?? null };
  return { state: 'absent', reason: null };
}

/**
 * A record's point in a unit circle centred on the Gate. `angle` is degrees
 * clockwise from the top; y grows downward, as in SVG. A house's texts of one
 * degree spread evenly across its sector, the outermost 12 degrees in from
 * each edge; a lone text sits at the sector's centre.
 */
export function wheelPosition(record) {
  if (record.house === GATE.id) return { x: 0, y: 0, angle: 0, radius: 0 };
  const start = houseById(record.house).order * WHEEL_SECTOR_DEGREES;
  const ring = SCHOOL_CANON.filter(r => r.house === record.house && r.degree === record.degree);
  const k = ring.indexOf(record);
  const span = WHEEL_SECTOR_DEGREES - 2 * SECTOR_MARGIN_DEGREES;
  const angle = ring.length === 1
    ? start + WHEEL_SECTOR_DEGREES / 2
    : start + SECTOR_MARGIN_DEGREES + span * k / (ring.length - 1);
  const radius = RING_RADIUS[record.degree];
  const theta = angle * Math.PI / 180;
  return { x: radius * Math.sin(theta), y: -radius * Math.cos(theta), angle, radius };
}
