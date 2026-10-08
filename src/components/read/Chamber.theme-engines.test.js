/**
 * The field renderers take the reading's theme at mount. An explicit value in
 * the cue wins; the engine's "no choice" value (an absent or white palette, an
 * absent or random preset) takes the theme's row; without a theme the engine
 * behaves as today. The cue itself is never written: a saved cue replays
 * exactly, and the director keys its fields by the cue.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { JEV_COLOR_THEMES } from '../../core/jev-color-themes.js';
import { jevColors } from '../../core/jev-palette.js';
import { MemoryCore } from '../../core/memory.js';
import { ensureDirector } from '../../core/passage-visuals/reading-state.js';
import { prepareVisualSource } from '../../core/passage-visuals/segmentation.js';
import { RISE_CURRENT_THEMES, compileRiseCurrent } from '../../core/rise-current.js';
import { compileSession } from '../../core/session-compiler.js';
import { themedFlameRecipe } from '../../core/theme-engine-map.js';
import { BLACK_HOLES_CURRENT } from '../../test/sealed-current.js';
import { flamePreset } from '../../visuals/living-flame/flame-presets.js';
import { createLivingFlameField, sampleLivingFlame } from '../../visuals/living-flame/index.js';

// The Chamber loads the flame lazily; the stubs show which recipe reaches it.
vi.mock('../../visuals/living-flame/index.js', async importOriginal => ({
  ...await importOriginal(),
  sampleLivingFlame: vi.fn(async () => 'data:,flame'),
  createLivingFlameField: vi.fn(() => ({ pause() {}, resume() {}, destroy() {} }))
}));

const mounted = [];

function makeChamber(session) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const chamber = new Chamber(container, {
    session: { title: 'Themed', atoms: [], totalDuration: 0, atomCount: 0, visualConfig: { visualMode: 'off' }, ...session },
    player: null,
    autoStart: false
  });
  mounted.push(chamber);
  return chamber;
}

const themed = theme => ({ presentation: { colorTheme: theme, colors: jevColors(theme) } });
const attractorCue = config => ({ kind: 'field', renderer: 'attractor', config });
const genesisCue = config => ({ kind: 'field', renderer: 'genesis', config });
const filament = field => ({ system: field.system, palette: field.palette, form: field.form });

function mountAttractor(session, config) {
  const chamber = makeChamber(session);
  const handle = chamber.mountVisualFieldCue(attractorCue(config));
  return { chamber, handle, field: chamber.attractorField };
}

function mountGenesis(session, config) {
  const chamber = makeChamber(session);
  chamber.mountVisualFieldCue(genesisCue(config));
  return chamber.kleeField;
}

afterEach(() => {
  mounted.splice(0).forEach(chamber => chamber.destroy());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('the attractor under a theme', () => {
  it('takes the theme\'s whole row when the palette is white', () => {
    const { field } = mountAttractor(themed('cobalt'), { system: 'aizawa', palette: 'white', form: 'kaleido' });
    expect(filament(field)).toEqual({ system: 'thomas', palette: 'blue', form: 'mirror' });
  });

  it('takes the theme\'s whole row when the palette is absent', () => {
    const { field } = mountAttractor(themed('cobalt'), {});
    expect(filament(field)).toEqual(RISE_CURRENT_THEMES.cobalt.attractor);
  });

  it('keeps an explicit palette, and the config\'s own system and form with it', () => {
    const { field } = mountAttractor(themed('cobalt'), { system: 'aizawa', palette: 'purple', form: 'kaleido' });
    expect(filament(field)).toEqual({ system: 'aizawa', palette: 'purple', form: 'kaleido' });
  });

  it('keeps the night drive\'s speed, intensity and streaks: neon is a choice', () => {
    const { chamber, handle, field } = mountAttractor(themed('cobalt'), {
      system: 'halvorsen', palette: 'neon', form: 'mirror', intensity: 0.85, speed: 2.4, streaks: true
    });
    expect(filament(field)).toEqual({ system: 'halvorsen', palette: 'neon', form: 'mirror' });
    expect(handle.node.dataset.attractorSpeed).toBe('2.4');
    expect(handle.node.dataset.attractorIntensity).toBe('0.85');
    expect(chamber.nightStreaks).not.toBeNull();
  });

  it('keeps the cue\'s own intensity and speed under the theme\'s row', () => {
    const { handle } = mountAttractor(themed('jade'), { palette: 'white', intensity: 0.4, speed: 0.5 });
    expect(handle.node.dataset.attractorSpeed).toBe('0.5');
    expect(handle.node.dataset.attractorIntensity).toBe('0.4');
  });

  it('stays white without a theme', () => {
    const { field } = mountAttractor({}, { system: 'aizawa', palette: 'white', form: 'kaleido' });
    expect(filament(field)).toEqual({ system: 'aizawa', palette: 'white', form: 'kaleido' });
  });

  it('never writes into the cue', () => {
    const cue = attractorCue({ palette: 'white' });
    const chamber = makeChamber(themed('cobalt'));
    chamber.mountVisualFieldCue(cue);
    expect(cue).toEqual(attractorCue({ palette: 'white' }));
  });

  it('still yields to a theme set over the reading, and returns to the row for null', () => {
    const chamber = makeChamber(themed('cobalt'));
    expect(chamber.setColourTheme('jade')).toBe(true);
    chamber.mountVisualFieldCue(attractorCue({ palette: 'white' }));
    expect(chamber.attractorField.palette).toBe('jade');
    expect(chamber.attractorField.system).toBe('thomas');
    chamber.setColourTheme(null);
    expect(chamber.attractorField.palette).toBe('blue');
  });
});

describe('Genesis under a theme', () => {
  it('takes the theme\'s preset for random', () => {
    expect(mountGenesis(themed('jade'), { preset: 'random' }).preset).toBe('gravitational');
  });

  it('takes the theme\'s preset when none is named', () => {
    expect(mountGenesis(themed('cobalt'), {}).preset).toBe('architectural');
  });

  it('keeps an explicit preset', () => {
    expect(mountGenesis(themed('jade'), { preset: 'harmonic' }).preset).toBe('harmonic');
  });

  it('stays random without a theme', () => {
    expect(mountGenesis({}, { preset: 'random' }).preset).toBe('random');
  });

  it('never writes into the cue', () => {
    const cue = genesisCue({ preset: 'random' });
    makeChamber(themed('jade')).mountVisualFieldCue(cue);
    expect(cue).toEqual(genesisCue({ preset: 'random' }));
  });
});

describe('a Current mounts exactly what Composer wrote', () => {
  const fieldCues = session => session.experienceProgram.tracks
    .find(track => track.kind === 'visual').clips.map(clip => clip.cue)
    .filter(cue => cue.kind === 'field');

  it.each([...JEV_COLOR_THEMES])('%s: the attractor row and the Genesis preset, with and without the theme', theme => {
    const session = compileRiseCurrent({ ...BLACK_HOLES_CURRENT, theme });
    expect(session.presentation.colorTheme).toBe(theme);
    const cues = fieldCues(session);
    const attractor = cues.find(cue => cue.renderer === 'attractor');
    const genesis = cues.find(cue => cue.renderer === 'genesis');
    expect(attractor.config).toEqual(RISE_CURRENT_THEMES[theme].attractor);
    expect(genesis.config).toEqual(RISE_CURRENT_THEMES[theme].genesis);

    for (const carried of [session, { ...session, presentation: undefined }]) {
      const chamber = makeChamber(carried);
      chamber.mountVisualFieldCue(attractor);
      expect(filament(chamber.attractorField)).toEqual(RISE_CURRENT_THEMES[theme].attractor);
      chamber.mountVisualFieldCue(genesis);
      expect(chamber.kleeField.preset).toBe(RISE_CURRENT_THEMES[theme].genesis.preset);
    }
  });

  it('a Current with no theme mounts white and random, as today', () => {
    const session = compileRiseCurrent(BLACK_HOLES_CURRENT);
    expect(session.presentation).toBeNull();
    const cues = fieldCues(session);
    const chamber = makeChamber(session);
    chamber.mountVisualFieldCue(cues.find(cue => cue.renderer === 'attractor'));
    expect(chamber.attractorField.palette).toBe('white');
    chamber.mountVisualFieldCue(cues.find(cue => cue.renderer === 'genesis'));
    expect(chamber.kleeField.preset).toBe('random');
  });
});

describe('the Living Flame under a theme', () => {
  // The flame takes the theme where its cue is built, never at mount, so a
  // saved cue draws as saved and a Page or Workshop project is exact.
  const jade = jevColors('jade');
  const themedPreset = id => themedFlameRecipe(flamePreset(id), jade);
  const text = Array.from({ length: 12 }, () => 'The quiet garden rests in gentle peace and the still water holds the soft light of evening.').join(' ');
  const gallery = { visualMode: 'interlocution', interlocution: { sourceFamily: 'procedural', procedural: [], sourced: [], presentation: 'continuous' } };

  it('saves a directed reading to the Workshop with its recipes in the theme', async () => {
    const session = compileSession({ title: 'Directed', text, wpm: 300, chunkMode: 'phrase', visualConfig: gallery, ...themed('jade') });
    const director = ensureDirector(session);
    director.identify('primary', (await prepareVisualSource(text)).blocks);
    director.stage([{ blockId: director.blocks[0].id, treatmentId: 'verdant-current', intensityBand: 'balanced' }]);
    director.admit(0);
    const save = vi.spyOn(MemoryCore, 'saveWorkshopBlueprintAsync').mockResolvedValue(true);
    const opened = await Chamber.prototype.editPassagesInWorkshop.call({ session, _direction: { director }, onExit() {} });
    expect(opened).toBe(true);
    const clips = save.mock.calls[0][0].experienceProgram.tracks.find(track => track.kind === 'visual').clips;
    expect(clips[0].cue.config.recipe).toEqual(themedPreset('verdant-current'));
    expect(clips[0].cue.config.recipe.macros.hue).not.toBe(0);
  });

  it('draws a Page flame the Stream never held in the theme', async () => {
    const works = await Chamber.prototype._resolvePageCollection.call(
      { session: themed('jade'), _effectiveFlameEnergy: () => 0.35 }, 'living-flame:verdant-current~00000000', 1, null, null);
    expect(works).toHaveLength(1);
    expect(sampleLivingFlame.mock.calls[0][0]).toEqual(themedPreset('verdant-current'));
  });

  it('opens a Living Flame reading on its theme’s composition, in the theme’s colours', async () => {
    makeChamber({ ...themed('jade'), visualConfig: { visualMode: 'living-flame' } });
    await vi.waitFor(() => expect(createLivingFlameField).toHaveBeenCalled());
    expect(createLivingFlameField.mock.calls.at(-1)[1].recipe).toEqual(themedPreset('verdant-current'));
    createLivingFlameField.mockClear();
  });

  it('opens a Living Flame reading with no theme on classic’s flame, as Follow text lowers it', async () => {
    createLivingFlameField.mockClear();
    makeChamber({ visualConfig: { visualMode: 'living-flame' } });
    await vi.waitFor(() => expect(createLivingFlameField).toHaveBeenCalled());
    expect(createLivingFlameField.mock.calls.at(-1)[1].recipe)
      .toEqual(themedFlameRecipe(flamePreset('ember-cathedral'), jevColors('classic')));
    createLivingFlameField.mockClear();
  });

  it('mounts a saved cue as saved', async () => {
    const recipe = flamePreset('verdant-current');
    makeChamber(themed('jade')).mountVisualFieldCue({ kind: 'field', renderer: 'living-flame', config: { recipe, intensity: 0.35 } });
    await vi.waitFor(() => expect(createLivingFlameField).toHaveBeenCalled());
    expect(createLivingFlameField.mock.calls[0][1].recipe).toEqual(recipe);
  });
});
