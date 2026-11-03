/**
 * A two-movement Experience Program lowered into its runtime schedules: the
 * shape the Chamber's movement, visual and audio controllers follow. Passage
 * ids and cues vary by test; one authored transition, `to-hero`, joins the two
 * movements. Only tests import this.
 */
import {
  BOUNDARY_SOURCE_PREFIX,
  EXPERIENCE_PROGRAM_SCHEMA,
  createExperienceProgram,
  lowerExperienceProgram
} from '../core/experience-program.js';

export const TO_HERO = `${BOUNDARY_SOURCE_PREFIX}to-hero`;

const clip = (id, sourceIds, cue) => ({ id, anchor: { sourceIds }, cue });

export function movementScore({
  heaven = ['p1'],
  hero = ['p2'],
  heavenVisual = { kind: 'sourced', collections: ['celestial'] },
  heroVisual = { kind: 'sourced', collections: ['bronze'] },
  heavenAudio = { kind: 'soundscape', soundscapeId: 'ordered-field', gain: 0.55 },
  heroAudio = { kind: 'soundscape', soundscapeId: 'mortal-pulse', gain: 0.48 }
} = {}) {
  return lowerExperienceProgram(createExperienceProgram({
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: 'journey-war',
    authority: 'published',
    editable: false,
    tracks: [
      {
        id: 'movements',
        kind: 'movement',
        clips: [
          { id: 'war-heaven', anchor: { sourceIds: heaven }, data: { index: 0, title: 'War in Heaven' } },
          { id: 'war-hero', anchor: { sourceIds: hero }, data: { index: 1, title: 'The Hero Under Heaven' } }
        ]
      },
      {
        id: 'transitions',
        kind: 'transition',
        clips: [{
          id: 'to-hero',
          anchor: { sourceIds: [TO_HERO], afterSourceId: heaven.at(-1), beforeSourceId: hero[0] },
          data: { fromMovementId: 'war-heaven', toMovementId: 'war-hero' },
          durationMs: 1600
        }]
      },
      {
        id: 'visual-main',
        kind: 'visual',
        fallback: { kind: 'still' },
        clips: [
          clip('war-heaven-visual', heaven, heavenVisual),
          clip('to-hero-visual', [TO_HERO], { kind: 'still' }),
          clip('war-hero-visual', hero, heroVisual)
        ]
      },
      {
        id: 'audio-bed',
        kind: 'audio',
        fallback: { kind: 'silence', fadeMs: 500 },
        clips: [
          clip('war-heaven-audio', heaven, heavenAudio),
          clip('to-hero-audio', [TO_HERO], { kind: 'silence', fadeMs: 300 }),
          clip('war-hero-audio', hero, heroAudio)
        ]
      }
    ]
  }));
}
