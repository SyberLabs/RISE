/**
 * Today's poem, ready to read: the day's exact division in the day's look
 * (the vivid temper todayDecision draws), through the same edition gate as
 * Home's rolls. Leaving the reading returns Home.
 *
 * When this release carries the poem's recitation (src/audio/poem-recitation.json,
 * written by scripts/build-poem-recitation.mjs), it is read aloud a line at a
 * time; otherwise it is read silently, as before.
 */
import POEM_RECITATIONS from '../audio/poem-recitation.json' with { type: 'json' };
import { jevReleasedEdition } from '../core/jev-describe.js';
import { SEQUENCE_CAPABILITIES } from '../core/sequence-capabilities.js';
import { todayPoem } from '../core/today-poem.js';
import { todayDecision } from '../core/today-reading.js';
import { resolveJevReading } from './jev-reading.js';

/** The poem's recitation, if one was made from the edition this release serves. */
export function poemRecitation(pick, index = POEM_RECITATIONS) {
  const entry = index?.poems?.[`${pick.workId}:${pick.entryId}`];
  if (!entry || !index.voiceId) return null;
  if (entry.sourceRevision !== jevReleasedEdition(pick.workId)?.sourceRevision) return null;
  return { voiceId: index.voiceId, pack: entry.pack };
}

export async function todaySession(date = new Date(), index = POEM_RECITATIONS) {
  const pick = todayPoem(date);
  const recitation = poemRecitation(pick, index);
  const reading = await resolveJevReading(todayDecision(pick, { recited: Boolean(recitation) }),
    { entryId: pick.entryId, label: pick.label });
  return {
    ...reading,
    ...(recitation ? {
      revealMode: 'progressive',
      capabilities: [SEQUENCE_CAPABILITIES.RECITATION_AUDIO],
      recitation: { enabled: true, pack: recitation.pack },
      voiceId: recitation.voiceId
    } : {}),
    origin: { view: 'home', icon: '✧', name: 'Home', experience: 'today' },
    continuation: reading.continuation && { ...reading.continuation, noun: 'poem' }
  };
}
