/**
 * Today's poem: one short poem per local calendar day, the same for every
 * reader on that date. Pure; reads the static division index, never text.
 */
import DIVISION_INDEX from '../content/archive/division-index.json' with { type: 'json' };
import { localDateKey } from './local-day.js';

export const TODAY_WORKS = Object.freeze(['spoon-river-anthology', 'lyrical-ballads']);
export const TODAY_MAX_WORDS = 400;
const SHUFFLE_SEED = 'rise-today-v2';

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

/**
 * Each work's short divisions, each shuffled once with its own fixed seed.
 * The works take turns day by day (todayPoem), so the 244 Spoon River
 * epitaphs no longer outnumber Lyrical Ballads' 31 poems eight days to one.
 */
export function todayPools(index = DIVISION_INDEX) {
  const pools = {};
  for (const workId of TODAY_WORKS) {
    const work = index[workId];
    const list = [];
    work?.labels.forEach((label, entryId) => {
      const words = work.divisionWords[entryId];
      if (words <= TODAY_MAX_WORDS) list.push({ workId, entryId, label, words });
    });
    const next = seededRandom(`${SHUFFLE_SEED}:${workId}`);
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    pools[workId] = list;
  }
  return pools;
}

/** Every poem the day can choose, across the works. */
export const todayPool = (index = DIVISION_INDEX) => Object.values(todayPools(index)).flat();

export { localDateKey };
export const dayNumber = date =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;

const mod = (n, m) => ((n % m) + m) % m;
let pools = null;
export function todayPoem(date = new Date()) {
  pools ??= todayPools();
  const day = dayNumber(date);
  const list = pools[TODAY_WORKS[mod(day, TODAY_WORKS.length)]];
  return { ...list[mod(Math.floor(day / TODAY_WORKS.length), list.length)], seed: localDateKey(date), dayNumber: day };
}

export const poemTitle = label => String(label).replace(/^Volume [IVX]+ · /u, '');
