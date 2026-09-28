import { describe, expect, it } from 'vitest';
import {
  EXPERIENCE_PROGRAM_SCHEMA,
  ExperienceProgramValidationError,
  lowerExperienceProgram,
  validateExperienceProgram
} from './experience-program.js';
import {
  deserializeVisualProgram,
  normalizeVisualCue,
  serializeVisualProgram
} from './visual-program.js';
import { Session } from './models.js';
import { classifyCue } from './render/support.js';
import { flamePreset } from '../visuals/living-flame/flame-presets.js';

const recipe = flamePreset('violet-nebula');
const cue = { kind: 'field', renderer: 'living-flame', config: { recipe, intensity: 0.15 } };

function program(visualCue = cue) {
  return {
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: 'flame-program',
    authority: 'user',
    editable: true,
    tracks: [
      { id: 'movements', kind: 'movement', clips: [{ id: 'source-1', anchor: { sourceIds: ['primary'] }, data: { index: 0, title: 'Primary' } }] },
      {
        id: 'visual-main',
        kind: 'visual',
        clips: [{
          id: 'flame-1',
          anchor: {
            sourceIds: ['primary'], fromCharacter: 0, toCharacter: 11,
            quoteStart: 'Hello world', quoteEnd: 'Hello world'
          },
          cue: visualCue
        }],
        fallback: { kind: 'still' }
      }
    ]
  };
}

describe('living-flame field cue', () => {
  it('validates canonically with the full recipe', () => {
    const validated = validateExperienceProgram(program());
    const clip = validated.tracks[1].clips[0];
    expect(clip.cue).toEqual({ kind: 'field', renderer: 'living-flame', config: { recipe, intensity: 0.15 } });
  });

  it('refuses a malformed recipe with a path into the recipe', () => {
    const broken = { ...cue, config: { recipe: { ...recipe, transforms: [{ ...recipe.transforms[0], variations: { julia: 1 } }] } } };
    let error;
    try { validateExperienceProgram(program(broken)); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(ExperienceProgramValidationError);
    expect(error.code).toBe('PROGRAM_FLAME_RECIPE');
    expect(error.path).toContain('.cue.config.recipe.transforms[0].variations.julia');
  });

  it('refuses a preset id in place of a recipe', () => {
    expect(() => validateExperienceProgram(program({ ...cue, config: { preset: 'violet-nebula' } })))
      .toThrow(ExperienceProgramValidationError);
  });

  it('survives lowering, runtime normalization, and JSON persistence unchanged', () => {
    const lowered = lowerExperienceProgram(validateExperienceProgram(program()));
    const segment = lowered.visualProgram.segments[0];
    expect(segment.cue).toEqual(cue);
    const restored = deserializeVisualProgram(JSON.parse(JSON.stringify(serializeVisualProgram(lowered.visualProgram))));
    expect(restored.segments[0].cue).toEqual(cue);
  });

  it('becomes stillness at runtime when the recipe is not valid', () => {
    expect(normalizeVisualCue({ kind: 'field', renderer: 'living-flame', config: { recipe: { id: 'x' } } }))
      .toEqual({ kind: 'still' });
  });

  it('keeps the full recipe on a restored Session', () => {
    const session = new Session({ atoms: [], experienceProgram: program() });
    expect(session.visualProgram.segments[0].cue.config.recipe).toEqual(recipe);
    const again = new Session({ atoms: [], experienceProgram: JSON.parse(JSON.stringify(session.experienceProgram)) });
    expect(again.visualProgram.segments[0].cue).toEqual(cue);
  });

  it('classifies for export as its own declared cue kind', () => {
    expect(classifyCue(cue, 'visual')).toBe('visual:field:living-flame');
  });
});
