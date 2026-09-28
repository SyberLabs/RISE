/**
 * Carry a directed reading into the Workshop as an editable project.
 *
 * Admitted choices become passage assignments anchored to exact source
 * spans (token-snapped, with quote fingerprints), cues carry full recipes,
 * and adjacent identical choices merge into one assignment. Passages the
 * reader has not reached stay unassigned; the project is marked so those
 * passages keep local direction when it is read again.
 */

import { EXPERIENCE_PROGRAM_SCHEMA, validateExperienceProgram } from '../experience-program.js';
import { normalizeQuote, snapCharacterRangeToTokens } from '../source-span.js';
import { workshopEditorDataToProject } from '../workshop-project.js';
import { compileTreatmentCue } from './treatments.js';

export const PASSAGE_DIRECTION_LOCAL = 'local';

function fingerprint(text, edge) {
  const normalized = normalizeQuote(text);
  if (normalized.length <= 200) return normalized;
  if (edge === 'start') {
    const candidate = normalized.slice(0, 200);
    return candidate.replace(/\s+\S*$/u, '') || candidate;
  }
  const candidate = normalized.slice(-200);
  return candidate.replace(/^\S*\s+/u, '') || candidate;
}

/**
 * @param {object} options
 * @param {object} options.session the reading
 * @param {import('./director.js').PassageDirector} options.director
 * @param {(id: string) => object|null} options.flameRecipe preset lookup
 * @param {string} options.projectId
 * @param {number} [options.updatedAt]
 */
export function readingToWorkshopProject({ session, director, flameRecipe, projectId, updatedAt = 0 }) {
  const names = new Map((session.sources || []).map(source => [source.id, source.name]));
  const sources = director.sources.map(source => ({
    id: source.id,
    name: names.get(source.id) || session.name || 'Reading',
    type: 'text/plain',
    data: source.text
  }));
  const textOf = new Map(director.sources.map(source => [source.id, source.text]));

  const runs = [];
  for (const choice of director.admittedChoices()) {
    const cue = compileTreatmentCue(choice.treatmentId, choice.intensityBand, flameRecipe(choice.treatmentId));
    const last = runs.at(-1);
    if (last && last.sourceId === choice.sourceId && last.to === choice.from
      && JSON.stringify(last.cue) === JSON.stringify(cue)) {
      last.to = choice.to;
    } else {
      runs.push({ sourceId: choice.sourceId, from: choice.from, to: choice.to, cue });
    }
  }

  const clips = [];
  for (const run of runs) {
    const text = textOf.get(run.sourceId);
    const snapped = snapCharacterRangeToTokens(text, run.from, Math.min(run.to, text.length));
    if (!snapped) continue;
    const selected = text.slice(snapped.fromCharacter, snapped.toCharacter);
    clips.push({
      id: `passage-${clips.length + 1}`,
      anchor: {
        sourceIds: [run.sourceId],
        fromCharacter: snapped.fromCharacter,
        toCharacter: snapped.toCharacter,
        quoteStart: fingerprint(selected, 'start'),
        quoteEnd: fingerprint(selected, 'end')
      },
      cue: run.cue
    });
  }

  const experienceProgram = clips.length ? validateExperienceProgram({
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: `workshop-${projectId}`,
    authority: 'user',
    editable: true,
    tracks: [
      {
        id: 'movements',
        kind: 'movement',
        clips: sources.map((source, index) => ({
          id: `source-${index + 1}`,
          anchor: { sourceIds: [source.id] },
          data: { index, title: String(source.name).slice(0, 200) }
        }))
      },
      { id: 'visual-main', kind: 'visual', clips, fallback: { kind: 'still' } }
    ],
    metadata: { kind: 'workshop-visual-score' }
  }) : null;

  return workshopEditorDataToProject({
    id: projectId,
    title: String(session.name || 'Directed reading').slice(0, 120),
    intent: 'custom',
    sources,
    wpm: session.wpm,
    curve: session.curve,
    chunkMode: session.chunkMode,
    displayMode: session.displayMode,
    soundscape: session.soundscape,
    audioPreset: session.audioPreset,
    projection: session.projection,
    visualConfig: {
      ...(session.visualConfig || {}),
      passageDirection: PASSAGE_DIRECTION_LOCAL
    },
    experienceProgram,
    provenance: { kind: 'directed-reading' }
  }, { id: projectId, updatedAt });
}
