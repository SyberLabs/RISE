import { describe, expect, it } from 'vitest';
import { compileSession } from '../session-compiler.js';
import { VisualScheduleController } from '../visual-scheduler.js';
import { PassageDirector, blockSignal } from './director.js';
import { prepareVisualSource } from './segmentation.js';
import {
  INTENSITY_BANDS,
  TREATMENT_IDS,
  compileTreatmentCue,
  effectiveEnergy,
  FOLLOW_TREATMENT_IDS,
  followTreatmentIds,
  isFollowChoice,
  localDirection
} from './treatments.js';
import { flamePreset } from '../../visuals/living-flame/flame-presets.js';

const calm = 'The quiet garden rests in gentle peace and the still water holds the soft light of evening.';
const storm = 'The furious storm tore the burning city apart with terror and rage and the screaming war raged on.';

function reading(paragraphs) {
  const text = paragraphs.join('\n\n');
  const session = compileSession({ title: 'Direction', text, wpm: 300, chunkMode: 'phrase', visualConfig: { visualMode: 'off' } });
  const director = new PassageDirector({
    sources: session.sources.map(source => ({ id: source.id, text: session.sourceTexts.get(source.id) })),
    atoms: session.atoms,
    flameRecipe: flamePreset
  });
  return { text, session, director };
}

const long = (sentence, count) => Array.from({ length: count }, () => sentence).join(' ');

describe('local direction mapping', () => {
  it.each([
    [{ valence: 0.9, arousal: 0.9, confidence: 0.149 }, 'glacial-silk', 'quiet'],
    [{ valence: 0.9, arousal: 0.9, confidence: undefined }, 'glacial-silk', 'quiet'],
    [{ valence: 0.16, arousal: 0.65, confidence: 0.15 }, 'solar-bloom', 'intense'],
    [{ valence: 0.15, arousal: 0.65, confidence: 1 }, 'ember-cathedral', 'intense'],
    [{ valence: -0.16, arousal: 0.7, confidence: 1 }, 'violet-nebula', 'intense'],
    [{ valence: -0.16, arousal: 0.35, confidence: 1 }, 'violet-nebula', 'quiet'],
    [{ valence: 0.16, arousal: 0.2, confidence: 1 }, 'glacial-silk', 'quiet'],
    [{ valence: -0.5, arousal: 0.5, confidence: 1 }, 'ember-cathedral', 'balanced'],
    [{ valence: 0, arousal: 0.36, confidence: 1 }, 'ember-cathedral', 'balanced']
  ])('maps %o to %s / %s', (signal, treatmentId, intensityBand) => {
    expect(localDirection(signal)).toEqual({ treatmentId, intensityBand });
  });

  it('keeps to the flame compositions a theme can colour, so a reading keeps one family and one colour', () => {
    expect(FOLLOW_TREATMENT_IDS).toEqual(['ember-cathedral', 'violet-nebula', 'glacial-silk', 'solar-bloom', 'verdant-current']);
    for (let valence = -1; valence <= 1; valence += 0.25) {
      for (let arousal = 0; arousal <= 1; arousal += 0.25) {
        const { treatmentId } = localDirection({ valence, arousal, confidence: 1 });
        expect(FOLLOW_TREATMENT_IDS, `${valence}/${arousal}`).toContain(treatmentId);
      }
    }
  });

  it('follows a Gallery reading with museum works by mood: calm open land, ordinary light, agitation, grief', () => {
    const gallery = signal => localDirection(signal, 'gallery');
    expect(gallery({ valence: 0.9, arousal: 0.9, confidence: 0.1 })).toEqual({ treatmentId: 'gallery-landscapes', intensityBand: 'quiet' });
    expect(gallery({ valence: 0.5, arousal: 0.2, confidence: 1 })).toEqual({ treatmentId: 'gallery-landscapes', intensityBand: 'quiet' });
    expect(gallery({ valence: 0, arousal: 0.5, confidence: 1 })).toEqual({ treatmentId: 'gallery-impressionism', intensityBand: 'balanced' });
    expect(gallery({ valence: 0.5, arousal: 0.8, confidence: 1 })).toEqual({ treatmentId: 'gallery-impressionism', intensityBand: 'intense' });
    expect(gallery({ valence: -0.5, arousal: 0.8, confidence: 1 })).toEqual({ treatmentId: 'gallery-postimpressionism', intensityBand: 'intense' });
    expect(gallery({ valence: -0.5, arousal: 0.2, confidence: 1 })).toEqual({ treatmentId: 'gallery-oldmasters', intensityBand: 'quiet' });
  });

  it('keeps a Gallery reading in museum works, one collection a passage, and never offers it a flame', () => {
    const works = followTreatmentIds('gallery');
    expect(works).toEqual(['gallery-landscapes', 'gallery-impressionism', 'gallery-postimpressionism', 'gallery-oldmasters']);
    for (let valence = -1; valence <= 1; valence += 0.25) {
      for (let arousal = 0; arousal <= 1; arousal += 0.25) {
        expect(works).toContain(localDirection({ valence, arousal, confidence: 1 }, 'gallery').treatmentId);
      }
    }
    for (const id of works) {
      const cue = compileTreatmentCue(id, 'balanced');
      expect(cue.kind, id).toBe('sourced');
      expect(cue.collections, id).toHaveLength(1);
      expect(cue.collections[0], id).toMatch(/^aic-/);
    }
    expect(isFollowChoice('violet-nebula', 'quiet', 'gallery')).toBe(false);
    expect(isFollowChoice('gallery-oldmasters', 'quiet', 'flame')).toBe(false);
    expect(followTreatmentIds('flame')).toEqual(FOLLOW_TREATMENT_IDS);
  });

  it('treats unsupported-language text as low confidence without claiming to read it', () => {
    const signal = blockSignal('夏の夜は月のころはさらなり闇もなほ蛍の多く飛びちがひたる');
    expect(signal).toMatchObject({ confidence: 0, supported: false });
    expect(localDirection(signal)).toEqual({ treatmentId: 'glacial-silk', intensityBand: 'quiet' });
  });

  it('reads English lexicon signal from a block', () => {
    const signal = blockSignal(long(storm, 4));
    expect(signal.supported).toBe(true);
    expect(signal.confidence).toBeGreaterThan(0.15);
    expect(signal.valence).toBeLessThan(0);
  });
});

describe('treatment cues', () => {
  it('compiles every treatment to a supported renderer with bounded data', () => {
    for (const id of TREATMENT_IDS) {
      const cue = compileTreatmentCue(id, 'balanced', flamePreset(id));
      expect(['field', 'procedural', 'sourced', 'still']).toContain(cue.kind);
      if (cue.renderer === 'living-flame') {
        expect(cue.config.recipe.id).toBe(id);
        expect(cue.config.intensity).toBe(INTENSITY_BANDS.balanced);
      }
    }
  });

  it('refuses unknown treatments and bands as stillness', () => {
    expect(compileTreatmentCue('shader', 'balanced')).toEqual({ kind: 'still' });
    expect(compileTreatmentCue('solar-bloom', 'extreme', flamePreset('solar-bloom'))).toEqual({ kind: 'still' });
  });

  it('scales energy globally with a reader ceiling', () => {
    expect(effectiveEnergy(0.35, 0.35)).toBeCloseTo(0.35);
    expect(effectiveEnergy(0.6, 1)).toBe(0.65);
    expect(effectiveEnergy(0.15, 0.7)).toBeCloseTo(0.3);
    expect(effectiveEnergy(0.6, 0)).toBe(0);
  });
});

describe('PassageDirector', () => {
  it('covers every atom with a block and admits local direction immediately', () => {
    const { session, director } = reading([long(calm, 12), long(storm, 12), long(calm, 12)]);
    expect(director.blocks.length).toBeGreaterThanOrEqual(3);
    for (const atom of session.atoms.filter(item => item.content?.trim())) {
      expect(director.blockIndexForAtom(atom)).toBeGreaterThanOrEqual(0);
    }
    const first = director.observe(session.atoms[0]);
    expect(first.record.provenance).toBe('local');
    expect(director.program.segments[first.index].cue.kind).not.toBe(undefined);
  });

  it('drives the existing scheduler at block boundaries without retiming atoms', () => {
    const { session, director } = reading([long(calm, 12), long(storm, 12)]);
    const durations = session.atoms.map(atom => atom.duration);
    const cues = [];
    const schedule = new VisualScheduleController(director.program, (cue, meta) => cues.push(meta.cueId));
    for (const atom of session.atoms) {
      director.observe(atom);
      schedule.observe(atom);
    }
    expect(session.atoms.map(atom => atom.duration)).toEqual(durations);
    expect(cues).toEqual(director.blocks.map(block => block.key));
  });

  it('stages a late choice only for unentered blocks and adopts it at the boundary', async () => {
    const { session, director, text } = reading([long(calm, 12), long(calm, 12), long(calm, 12)]);
    const prepared = await prepareVisualSource(text);
    director.identify('primary', prepared.blocks);
    director.observe(session.atoms[0]);
    const firstRecord = director.blocks[0].admitted;
    const staged = director.stage(director.blocks.map(block => ({
      blockId: block.id, treatmentId: 'solar-bloom', intensityBand: 'intense'
    })));
    expect(staged).toBe(director.blocks.length - 1);
    expect(director.blocks[0].admitted).toBe(firstRecord);
    const later = session.atoms.find(atom => director.blockIndexForAtom(atom) === 1);
    expect(director.observe(later).record).toEqual({
      treatmentId: 'solar-bloom', intensityBand: 'intense', provenance: 'jev'
    });
  });

  it('refuses a late choice of another engine, or of the spectrum, so Follow text keeps one family and one colour', async () => {
    const { director, text } = reading([long(calm, 12), long(storm, 12)]);
    director.identify('primary', (await prepareVisualSource(text)).blocks);
    expect(director.stage([
      { blockId: director.blocks[0].id, treatmentId: 'klee-harmonic', intensityBand: 'quiet' },
      { blockId: director.blocks[0].id, treatmentId: 'attractor', intensityBand: 'quiet' },
      { blockId: director.blocks[1].id, treatmentId: 'prismatic-knot', intensityBand: 'intense' },
      { blockId: director.blocks[1].id, treatmentId: 'stillness', intensityBand: 'quiet' }
    ])).toBe(0);
  });

  it('keeps admitted choices on a backward seek and ignores later rewrites', async () => {
    const { session, director, text } = reading([long(calm, 12), long(storm, 12)]);
    director.identify('primary', (await prepareVisualSource(text)).blocks);
    const secondAtom = session.atoms.find(atom => director.blockIndexForAtom(atom) === 1);
    director.observe(session.atoms[0]);
    director.observe(secondAtom);
    const before = director.admittedChoices();
    expect(director.stage(director.blocks.map(block => ({
      blockId: block.id, treatmentId: 'stillness', intensityBand: 'quiet'
    })))).toBe(0);
    director.observe(session.atoms[0]);
    expect(director.admittedChoices()).toEqual(before);
  });

  it('ignores unknown or malformed choices', async () => {
    const { director, text } = reading([long(calm, 12), long(storm, 12)]);
    director.identify('primary', (await prepareVisualSource(text)).blocks);
    expect(director.stage([
      { blockId: 'b-nope', treatmentId: 'solar-bloom', intensityBand: 'quiet' },
      { blockId: director.blocks[0].id, treatmentId: 'shader', intensityBand: 'quiet' },
      { blockId: director.blocks[0].id, treatmentId: 'solar-bloom', intensityBand: 'loud' }
    ])).toBe(0);
  });

  it('restores saved choices as Saved provenance', async () => {
    const { session, director, text } = reading([long(calm, 12), long(storm, 12)]);
    director.identify('primary', (await prepareVisualSource(text)).blocks);
    director.restore([{ blockId: director.blocks[0].id, treatmentId: 'turrell', intensityBand: 'quiet' }]);
    expect(director.observe(session.atoms[0]).record).toEqual({
      treatmentId: 'turrell', intensityBand: 'quiet', provenance: 'saved'
    });
  });

  it('never retains the source text on the persisted session', () => {
    const { session } = reading([long(calm, 4)]);
    expect(session.sourceTexts.get('primary')).toContain('quiet garden');
    expect(JSON.stringify(session)).not.toContain('sourceTexts');
    expect(Object.keys(session)).not.toContain('sourceTexts');
  });
});
