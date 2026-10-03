/**
 * Today's poem, ready to read: the day's exact division in the day's look
 * (the vivid temper todayDecision draws), through the same edition gate as
 * Home's rolls. Leaving the reading returns Home.
 */
import { todayPoem } from '../core/today-poem.js';
import { todayDecision } from '../core/today-reading.js';
import { resolveJevReading } from './jev-reading.js';

export async function todaySession(date = new Date()) {
  const pick = todayPoem(date);
  const reading = await resolveJevReading(todayDecision(pick), { entryId: pick.entryId, label: pick.label });
  return {
    ...reading,
    origin: { view: 'portal', icon: '✧', name: 'Home', experience: 'today' },
    continuation: reading.continuation && { ...reading.continuation, noun: 'poem' }
  };
}
