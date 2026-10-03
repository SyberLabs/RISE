/**
 * How today's poem is read: a roll for its work, in a temper drawn from the
 * date, so the day's poem has one look and sound all day. Only the vivid
 * tempers qualify, those whose procedural visuals are immersive or
 * psychedelic (owner decision, 2026-10-03): a poem of the day is never read on
 * plain black, nor under a quiet light it could be mistaken for.
 * The division is not the roll's; resolveJevReading opens the day's exact one.
 */
import { VISUAL_TEMPERS, composeRoll } from './roll.js';
import { seededRandom } from './today-poem.js';

/**
 * A recited day is read a line at a time (the voice comes one clip per line);
 * every other draw (temper, engine, sound, colours) is the same, because the
 * chunk mode still takes its one draw from the same sequence.
 */
export function todayDecision(pick, { recited = false } = {}) {
  const random = seededRandom(`rise-today-reading:${pick.seed}`);
  const drawn = VISUAL_TEMPERS[Math.floor(random() * VISUAL_TEMPERS.length)];
  const temper = recited ? { ...drawn, chunkMode: ['phrase'] } : drawn;
  return composeRoll({ temper, workId: pick.workId, section: 'first', random });
}
