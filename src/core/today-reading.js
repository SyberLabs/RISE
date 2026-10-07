/**
 * How today's poem is read: a roll for its work, in a look and at a pace in
 * that look's range drawn from the date, so the day's poem has one look,
 * sound and pace all day. Only
 * the vivid looks qualify, those whose procedural visuals are immersive or
 * psychedelic (owner decision, 2026-10-03): a poem of the day is never read on
 * plain black, nor under a quiet light it could be mistaken for. It reads in
 * phrases on every date, the unit a recitation's voice pack is cut in.
 * The division is not the roll's; resolveJevReading opens the day's exact one.
 */
import { ROLL_RANGES, VIVID_LOOKS, composeRoll } from './roll.js';
import { seededRandom } from './today-poem.js';

export function todayDecision(pick) {
  const random = seededRandom(`rise-today-reading:${pick.seed}`);
  const look = VIVID_LOOKS[Math.floor(random() * VIVID_LOOKS.length)];
  const { paces } = ROLL_RANGES[look.id];
  const pace = paces[Math.floor(random() * paces.length)];
  return composeRoll({ look: look.id, workId: pick.workId, section: 'first', rhythm: 'phrase', pace, random });
}
