/**
 * How today's poem is read: a roll for its work, in a temper drawn from the
 * date, so the day's poem has one look and sound all day. Only the vivid
 * tempers qualify, those whose procedural visuals are immersive or
 * psychedelic (owner decision, 2026-10-03): a poem of the day is never read on
 * plain black, nor under a quiet light it could be mistaken for.
 * The division is not the roll's; resolveJevReading opens the day's exact one.
 */
import { TEMPERS, composeRoll } from './roll.js';
import { seededRandom } from './today-poem.js';

const VISUAL_TEMPERS = TEMPERS.filter(temper => temper.visualMode !== 'off'
  && ['immersive', 'psychedelic'].includes(temper.visualStyle));

export function todayDecision(pick) {
  const random = seededRandom(`rise-today-reading:${pick.seed}`);
  const temper = VISUAL_TEMPERS[Math.floor(random() * VISUAL_TEMPERS.length)];
  return composeRoll({ temper, workId: pick.workId, section: 'first', random });
}
