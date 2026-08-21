/**
 * Canonical Keystone → Experience Program lowering.
 *
 * Chamber and MP4 export begin with the same exact source, pace, visual,
 * soundscape, and voice identities. Publication still has a separate rights
 * and certification gate; this module only makes the composition portable.
 */

import {
  EXPERIENCE_PROGRAM_SCHEMA,
  lowerExperienceProgram,
  validateExperienceProgram
} from '../core/experience-program.js';
import { compileSession } from '../core/session-compiler.js';
import { DEFAULT_VOICE_ID } from '../audio/voice-pack.js';
import { resolveKeystone } from './keystones.js';

function wholeSource(sourceId) {
  return { sourceIds: [sourceId] };
}

function visualCue(manifest) {
  if (manifest.visual.kind === 'collection') {
    return { kind: 'sourced', collections: [manifest.visual.id] };
  }
  return {
    kind: 'procedural',
    collections: [manifest.visual.id]
  };
}

export async function buildKeystoneRenderComposition(slug, options = {}) {
  const result = await resolveKeystone(slug, {
    allowIncomplete: options.allowIncomplete === true
  });
  if (!result.sessionInput) {
    const reason = result.blockers[0]?.message || 'The Keystone is not admitted.';
    throw new Error(reason);
  }

  const manifest = result.manifest;
  const input = result.sessionInput;
  const sourceId = input.sourceId;
  const anchor = wholeSource(sourceId);
  const tracks = [
    {
      id: 'movements',
      kind: 'movement',
      clips: [{
        id: 'movement-1',
        anchor,
        data: { index: 0, title: manifest.title }
      }]
    },
    {
      id: 'visual-main',
      kind: 'visual',
      clips: [{ id: 'visual-1', anchor, cue: visualCue(manifest) }],
      fallback: { kind: 'still' }
    },
    {
      id: 'reading',
      kind: 'reading',
      clips: [{
        id: 'pace-1',
        anchor,
        cue: { kind: 'pace', wpm: input.wpm, chunkMode: input.chunkMode }
      }]
    },
    {
      id: 'narration',
      kind: 'narration',
      clips: [{
        id: 'voice-1',
        anchor,
        cue: {
          kind: 'spoken',
          voiceId: DEFAULT_VOICE_ID,
          duck: { target: 'bed', floor: 0.18, downMs: 150, upMs: 600 }
        }
      }]
    }
  ];
  if (manifest.soundscape && manifest.soundscape !== 'none') {
    tracks.splice(2, 0, {
      id: 'audio-bed',
      kind: 'audio',
      clips: [{
        id: 'bed-1',
        anchor,
        cue: { kind: 'soundscape', soundscapeId: manifest.soundscape, fadeMs: 500 }
      }],
      fallback: { kind: 'silence', fadeMs: 500 }
    });
  }

  const program = validateExperienceProgram({
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: `keystone-${manifest.slug}`,
    authority: 'published',
    editable: false,
    tracks
  });
  const sources = [{
    id: sourceId,
    name: input.textSource,
    data: input.text,
    metadata: {
      author: manifest.author,
      editionId: input.provenance.editionId,
      sourceRevision: input.provenance.sourceRevision
    }
  }];
  const sessionInput = {
    title: input.title,
    wpm: input.wpm,
    chunkMode: input.chunkMode,
    curve: input.curve,
    revealMode: input.revealMode,
    verseLines: input.verseLines,
    capabilities: input.capabilities,
    recitation: { enabled: false },
    voiceId: DEFAULT_VOICE_ID,
    visualConfig: input.visualConfig,
    provenance: input.provenance
  };
  const session = compileSession({
    ...sessionInput,
    experienceProgram: program,
    sources
  });
  const lowered = lowerExperienceProgram(program);

  return Object.freeze({
    manifest,
    admission: Object.freeze({
      admitted: result.admitted,
      releaseCertified: result.ready,
      blockers: result.blockers
    }),
    program,
    lowered,
    sources: Object.freeze(sources),
    sessionInput: Object.freeze(sessionInput),
    session
  });
}
