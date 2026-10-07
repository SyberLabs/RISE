import { describe, expect, it } from 'vitest';
import { jevColors } from '../jev-palette.js';
import { compileSession } from '../session-compiler.js';
import { sessionColorTheme } from '../session-presentation.js';
import { themedFlameLookup, themedFlameRecipe } from '../theme-engine-map.js';
import { workshopProjectToSessionConfig, visualAssignmentsFromProgram } from '../workshop-project.js';
import { validateVisualScoreLane } from '../visual-score-lane.js';
import { VisualScheduleController } from '../visual-scheduler.js';
import { buildWorkshopVisualAssetRegistry } from '../../components/workshop/workshop-visual-assets.js';
import { flamePreset } from '../../visuals/living-flame/flame-presets.js';
import { PassageDirector } from './director.js';
import { directionEligibility, followProgram } from './reading-state.js';
import { prepareVisualSource } from './segmentation.js';
import { readingToWorkshopProject } from './workshop-export.js';

const calm = 'The quiet garden rests in gentle peace and the still water holds the soft light of evening.';
const storm = 'The furious storm tore the burning city apart with terror and rage and the screaming war raged on.';
const gallery = { visualMode: 'interlocution', interlocution: { sourceFamily: 'procedural', procedural: [], sourced: [], presentation: 'continuous' } };

async function directedReading(presentation) {
  const text = [calm, storm, calm, storm].map(sentence => Array.from({ length: 12 }, () => sentence).join(' ')).join('\n\n');
  const session = compileSession({ title: 'Directed', text, wpm: 300, chunkMode: 'phrase', visualConfig: gallery, presentation });
  const director = new PassageDirector({
    sources: [{ id: 'primary', text: session.sourceTexts.get('primary') }],
    atoms: session.atoms,
    flameRecipe: flamePreset
  });
  director.identify('primary', (await prepareVisualSource(text)).blocks);
  // The reader has entered the first three blocks; Jev chose one of them.
  director.stage([{ blockId: director.blocks[1].id, treatmentId: 'klee-architectural', intensityBand: 'balanced' }]);
  for (const index of [0, 1, 2]) director.admit(index);
  return { session, director, text };
}

describe('reading to Workshop', () => {
  it('turns admitted choices into exact, editable passage assignments with full recipes', async () => {
    const { session, director, text } = await directedReading();
    const project = readingToWorkshopProject({ session, director, flameRecipe: flamePreset, projectId: 'directed-1' });
    const clips = project.experienceProgram.tracks.find(track => track.kind === 'visual').clips;
    expect(clips.length).toBeGreaterThanOrEqual(2);
    expect(clips.length).toBeLessThanOrEqual(3);
    for (const clip of clips) {
      const selected = text.slice(clip.anchor.fromCharacter, clip.anchor.toCharacter);
      expect(selected.startsWith(clip.anchor.quoteStart.slice(0, 20))).toBe(true);
    }
    const flame = clips.find(clip => clip.cue.renderer === 'living-flame');
    expect(flame.cue.config.recipe.transforms.length).toBeGreaterThan(0);
    expect(clips.some(clip => clip.cue.kind === 'procedural' && clip.cue.config?.preset === 'architectural')).toBe(true);
    // Nothing the reader has not reached is assigned.
    expect(clips.at(-1).anchor.toCharacter).toBeLessThanOrEqual(director.blocks[2].to);
  });

  it('carries the reading\'s theme in every flame recipe it saves', async () => {
    const colors = jevColors('jade');
    const { session, director } = await directedReading({ colorTheme: 'jade', colors });
    const flameRecipe = themedFlameLookup(flamePreset, sessionColorTheme(session));
    const project = readingToWorkshopProject({ session, director, flameRecipe, projectId: 'directed-4' });
    const flames = project.experienceProgram.tracks.find(track => track.kind === 'visual').clips
      .filter(clip => clip.cue.renderer === 'living-flame');
    expect(flames.length).toBeGreaterThan(0);
    for (const clip of flames) {
      expect(clip.cue.config.recipe).toEqual(themedFlameRecipe(flamePreset(clip.cue.config.recipe.id), colors));
    }
    expect(flames.some(clip => clip.cue.config.recipe.macros.hue !== 0)).toBe(true);
  });

  it('opens in the Workshop lane against its own asset registry', async () => {
    const { session, director, text } = await directedReading();
    const project = readingToWorkshopProject({ session, director, flameRecipe: flamePreset, projectId: 'directed-2' });
    const assignments = visualAssignmentsFromProgram(project.experienceProgram);
    const registry = buildWorkshopVisualAssetRegistry({ visualConfig: project.defaults.visual.config });
    const lane = validateVisualScoreLane({
      sources: [{ id: 'primary', text }],
      assets: registry.map(entry => entry.asset),
      assignments
    });
    expect(lane.assignments.length).toBe(assignments.length);
    expect(assignments.some(item => item.assetId === 'surface:living-flame' && item.cue.config.recipe)).toBe(true);
  });

  it('plays back saved passages first and keeps local direction for the rest', async () => {
    const { session, director } = await directedReading();
    const project = readingToWorkshopProject({ session, director, flameRecipe: flamePreset, projectId: 'directed-3' });
    const reopened = compileSession(workshopProjectToSessionConfig(project));
    const eligibility = directionEligibility(reopened);
    expect(eligibility).toMatchObject({ canFollow: true, defaultMode: 'follow', composite: true });
    const replay = new PassageDirector({
      sources: [{ id: 'primary', text: reopened.sourceTexts.get('primary') }],
      atoms: reopened.atoms,
      flameRecipe: flamePreset
    });
    const program = followProgram(reopened, replay, eligibility);
    const seen = [];
    const schedule = new VisualScheduleController(program, (cue, meta) => seen.push(meta.cueId));
    for (const atom of reopened.atoms) {
      replay.observe(atom);
      schedule.observe(atom);
    }
    expect(seen.some(id => id.startsWith('passage-'))).toBe(true);
    expect(seen.some(id => id.startsWith('pv-'))).toBe(true);
    expect(seen[0].startsWith('passage-')).toBe(true);
  });
});
