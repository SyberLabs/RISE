/**
 * Today's poem: one short poem per local calendar day, the same for every
 * reader on that date. Pure; reads the static division index, never text.
 */
import DIVISION_INDEX from '../content/archive/division-index.json' with { type: 'json' };
import { localDateKey } from './local-day.js';

export const TODAY_WORKS = Object.freeze(['spoon-river-anthology', 'lyrical-ballads']);
export const TODAY_MAX_WORDS = 400;
const SHUFFLE_SEED = 'rise-today-v1';

function hash(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

function random(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A repeatable random sequence for a string seed. */
export const seededRandom = text => random(hash(text));

export function todayPool(index = DIVISION_INDEX) {
  const pool = [];
  for (const workId of TODAY_WORKS) {
    const work = index[workId];
    work?.labels.forEach((label, entryId) => {
      if (work.divisionWords[entryId] <= TODAY_MAX_WORDS) pool.push({ workId, entryId, label });
    });
  }
  const next = seededRandom(SHUFFLE_SEED);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export { localDateKey };
export const dayNumber = date =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;

let pool = null;
export function todayPoem(date = new Date()) {
  pool ??= todayPool();
  const day = dayNumber(date);
  return { ...pool[((day % pool.length) + pool.length) % pool.length], seed: localDateKey(date), dayNumber: day };
}

export const poemTitle = label => String(label).replace(/^Volume [IVX]+ · /u, '');
