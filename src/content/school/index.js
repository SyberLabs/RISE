/**
 * Lookups over the school's data, a record's reading state, and its place on
 * the Wheel.
 */

import { getTextById } from '../library.js';
import { SCHOOL_CANON } from './canon.js';
import { GATE, HOUSES } from './houses.js';
import { SCHOOL_PATHS } from './paths.js';

export const WHEEL_SECTOR_DEGREES = 360 / 7;

export const RING_RADIUS = Object.freeze({ 1: 0.5, 2: 0.68, 3: 0.86 });
export const GATE_RADIUS = 0.14;

const SECTOR_MARGIN_DEGREES = 12;
const SECTOR_SPAN_DEGREES = WHEEL_SECTOR_DEGREES - 2 * SECTOR_MARGIN_DEGREES;
const MIN_GAP = 0.1;
const SUB_RING_OFFSET = 0.05;

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

function chord(radius, degrees) {
  return 2 * radius * Math.sin(degrees * Math.PI / 360);
}

/**
 * A record's point in a unit circle centred on the Gate. `angle` is degrees
 * clockwise from the top; y grows downward, as in SVG. A house's texts of one
 * degree spread evenly across its sector, the outermost 12 degrees in from
 * each edge; a lone text sits at the sector's centre.
 *
 * A degree too crowded to keep MIN_GAP on its ring splits between two
 * sub-rings 0.05 either side: even-placed texts take the outer, each sub-ring
 * spread across the whole span, the inner one between the outer's points when
 * it holds one fewer. Alternating along one even spread cannot hold the gap
 * (Venus's six) nor clear a crowded neighbour ring (Saturn's I and II).
 */
export function wheelPosition(record) {
  if (record.house === GATE.id) return { x: 0, y: 0, angle: 0, radius: 0 };
  const start = houseById(record.house).order * WHEEL_SECTOR_DEGREES + SECTOR_MARGIN_DEGREES;
  const ring = SCHOOL_CANON.filter(r => r.house === record.house && r.degree === record.degree);
  const k = ring.indexOf(record);
  const n = ring.length;
  let radius = RING_RADIUS[record.degree];
  let angle;
  if (n === 1) {
    angle = start + SECTOR_SPAN_DEGREES / 2;
  } else if (chord(radius, SECTOR_SPAN_DEGREES / (n - 1)) >= MIN_GAP) {
    angle = start + SECTOR_SPAN_DEGREES * k / (n - 1);
  } else {
    const outer = k % 2 === 0;
    const outerCount = Math.ceil(n / 2);
    const count = outer ? outerCount : Math.floor(n / 2);
    const inset = (outerCount - count) * SECTOR_SPAN_DEGREES / (outerCount - 1) / 2;
    const j = Math.floor(k / 2);
    angle = start + inset + (count === 1 ? 0 : (SECTOR_SPAN_DEGREES - 2 * inset) * j / (count - 1));
    radius += outer ? SUB_RING_OFFSET : -SUB_RING_OFFSET;
  }
  const theta = angle * Math.PI / 180;
  return { x: radius * Math.sin(theta), y: -radius * Math.cos(theta), angle, radius };
}
