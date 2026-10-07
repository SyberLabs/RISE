/**
 * One vocabulary of limits, stated in five places.
 *
 * `rise.experience-program.v1` is the semantic centre (2026-10-03 direction
 * decision). `rise.current.v1` is a model-facing adapter whose contract stays
 * fixed. The Workshop project, the compiled Session and the portable sequence
 * each restate some of the same ceilings in their own words. Where a ceiling
 * lives in two tables, only one of them learns a new number
 * (PROJECT-KNOWLEDGE §2.1), so this file maps each shared bound by name and
 * fails when the tables stop agreeing.
 *
 * Nothing here changes a limit. Where two tables express the same thing with
 * different numbers today, the test records the relationship that holds now
 * (the adapter never exceeds the centre) and fails only on future drift.
 */
import { describe, expect, it } from 'vitest';
import {
  EXPERIENCE_PROGRAM_LIMITS,
  EXPERIENCE_PROGRAM_SCHEMA,
  ExperienceProgramValidationError,
  createExperienceProgram,
  lowerExperienceProgram
} from './experience-program.js';
import { WORKSHOP_PROJECT_LIMITS } from './workshop-project.js';
import { SESSION_LIMITS } from './session-compiler.js';
import {
  RISE_CURRENT_LIMITS,
  RISE_CURRENT_SCHEMA,
  RiseCurrentError,
  materializeRiseCurrent,
  validateDiveAnchor
} from './rise-current.js';
import { PORTABLE_SEQUENCE_MAX_BYTES, inspectPortableSequence } from './portable-sequence.js';

const EP = EXPERIENCE_PROGRAM_LIMITS;
const WORKSHOP = WORKSHOP_PROJECT_LIMITS;
const SESSION = SESSION_LIMITS;
const CURRENT = RISE_CURRENT_LIMITS;

/**
 * Two ceilings the schemas write as literals rather than table entries. A
 * movement's title and a portable sequence's title are both `200` in code;
 * a Dive's quote fingerprint is `500`. They are measured below by behaviour
 * (the longest admitted string) so that a change to the literal is caught
 * without this file hard-coding the number a second time.
 */
const TITLE_CEILING = WORKSHOP.maxTitleLength;
const QUOTE_CEILING = EP.maxQuoteLength;

const errorCode = fn => {
  try { fn(); } catch (error) { return error.code; }
  return null;
};

const movementProgram = title => ({
  schema: EXPERIENCE_PROGRAM_SCHEMA,
  id: 'one-movement',
  authority: 'user',
  editable: true,
  tracks: [{
    id: 'movements',
    kind: 'movement',
    clips: [{ id: 'only', anchor: { sourceIds: ['source'] }, data: { index: 0, title } }]
  }]
});

describe('program vocabularies: one bound, several tables', () => {
  it('states each shared ceiling with one number', () => {
    const identical = [
      ['characters of one source text',
        [EP.maxSourceCharacters, SESSION.maxTextCharacters, WORKSHOP.maxSourceCharacters]],
      ['characters across every source of one reading',
        [SESSION.maxTotalChars, WORKSHOP.maxTotalCharacters]],
      ['sources one reading may hold',
        [EP.maxSourceIds, SESSION.maxSources, WORKSHOP.maxSources]],
      ['slowest reading pace', [EP.minWpm, SESSION.minWpm]],
      ['fastest reading pace', [EP.maxWpm, SESSION.maxWpm]],
      ['length of an id', [EP.maxIdLength, WORKSHOP.maxIdLength]],
      ['length of a title', [WORKSHOP.maxTitleLength, CURRENT.title]],
      ['free-form metadata depth', [EP.maxMetadataDepth, SESSION.maxProvenanceDepth]],
      ['free-form metadata keys per object', [EP.maxMetadataKeys, SESSION.maxProvenanceKeys]],
      ['free-form metadata array length', [EP.maxMetadataArray, SESSION.maxProvenanceArray]],
      ['free-form metadata string length', [EP.maxMetadataString, SESSION.maxProvenanceString]]
    ];
    for (const [what, values] of identical) {
      expect(new Set(values).size, `${what}: ${values.join(' vs ')}`).toBe(1);
    }
  });

  it('bounds the movement title and the portable title by the one title ceiling', async () => {
    const at = 'a'.repeat(TITLE_CEILING);
    const over = 'a'.repeat(TITLE_CEILING + 1);

    expect(createExperienceProgram(movementProgram(at)).tracks[0].clips[0].data.title).toBe(at);
    expect(() => createExperienceProgram(movementProgram(over)))
      .toThrow(ExperienceProgramValidationError);

    const bundle = title => JSON.stringify({
      schema: 'rise.portable-sequence.v1', id: 'x', title, sources: [], program: {}, reading: { wpm: 200 }
    });
    await expect(inspectPortableSequence(bundle(over))).rejects.toMatchObject({ code: 'PORTABLE_TITLE' });
    // At the ceiling the title passes and the refusal moves on to the empty score.
    await expect(inspectPortableSequence(bundle(at))).rejects.not.toMatchObject({ code: 'PORTABLE_TITLE' });
  });

  it('bounds a Dive quote fingerprint by the Experience Program quote ceiling', () => {
    const word = 'q'.repeat(QUOTE_CEILING);
    const text = `${word} tail`;
    const span = { fromCharacter: 0, toCharacter: word.length };

    expect(validateDiveAnchor({ ...span, quoteStart: word, quoteEnd: word }, text, '$').quoteStart)
      .toBe(word);
    const longer = `${word}x`;
    expect(errorCode(() => validateDiveAnchor(
      { fromCharacter: 0, toCharacter: longer.length, quoteStart: longer, quoteEnd: longer },
      `${longer} tail`, '$'))).toBe('CURRENT_TEXT');
  });
});

describe('rise.current.v1 is an adapter: its bounds never exceed the centre', () => {
  /**
   * Each row maps one Current field to the Experience Program (or Session)
   * field it lands in when `materializeRiseCurrent` runs. The first column is
   * the adapter's number; the second is the centre's. The adapter may be
   * narrower, never wider.
   */
  const rows = [
    ['segments -> movement clips', CURRENT.segments, EP.maxMovements],
    ['segments -> visual clips on one track', CURRENT.segments, EP.maxClipsPerTrack],
    ['segments -> sources of the reading', CURRENT.segments, EP.maxSourceIds],
    ['segments -> sources of the Session', CURRENT.segments, SESSION.maxSources],
    ['dives across all segments -> thread clips on one track',
      CURRENT.segments * CURRENT.dives, EP.maxClipsPerTrack],
    ['dive text -> gloss text', CURRENT.diveText, EP.maxThreadTextLength],
    ['segment text -> one source text', CURRENT.segmentText, EP.maxSourceCharacters],
    ['segment text -> one Session source', CURRENT.segmentText, SESSION.maxTextCharacters],
    ['total text -> all Session sources', CURRENT.totalText, SESSION.maxTotalChars],
    ['current id -> program id', CURRENT.id, EP.maxIdLength],
    ['segment id -> source id in an anchor', CURRENT.id, EP.maxIdLength],
    ['title -> a title', CURRENT.title, TITLE_CEILING]
  ];

  it.each(rows)('%s: %d <= %d', (_what, adapter, centre) => {
    expect(adapter).toBeLessThanOrEqual(centre);
  });

  /** The rows where the adapter was written to the centre's number exactly. */
  const identical = [
    ['segments -> movement clips', CURRENT.segments, EP.maxMovements],
    ['dive text -> gloss text', CURRENT.diveText, EP.maxThreadTextLength],
    ['title -> a title', CURRENT.title, TITLE_CEILING]
  ];

  it.each(identical)('%s: %d is the same number', (_what, adapter, centre) => {
    expect(adapter).toBe(centre);
  });

  /**
   * A Current filled to every one of its own ceilings at once, with
   * `totalText` spread evenly across `segments` segments. If the centre
   * admits this, no legal Current is refused for a reason the adapter did
   * not already state.
   */
  const maximalCurrent = () => {
    const perSegment = Math.floor(CURRENT.totalText / CURRENT.segments);
    const word = 'w';
    const words = Math.floor(perSegment / (word.length + 1));
    const text = Array.from({ length: words }, () => word).join(' ').padEnd(perSegment, ' ');
    expect(text.length).toBe(perSegment);
    expect(perSegment).toBeLessThanOrEqual(CURRENT.segmentText);
    expect(CURRENT.dives).toBeLessThanOrEqual(words);

    return {
      schema: RISE_CURRENT_SCHEMA,
      id: 'i'.repeat(CURRENT.id),
      title: 't'.repeat(CURRENT.title),
      origin: { kind: 'model', name: 'n'.repeat(CURRENT.name), provider: 'p'.repeat(CURRENT.name) },
      segments: Array.from({ length: CURRENT.segments }, (_, index) => ({
        id: `segment-${index}`.padEnd(CURRENT.id, 's'),
        text,
        visual: index % 2 ? 'attractor' : 'still',
        dives: Array.from({ length: CURRENT.dives }, (_, dive) => {
          const fromCharacter = dive * (word.length + 1);
          return {
            id: `dive-${index}-${dive}`.padEnd(CURRENT.id, 'd'),
            text: 'd'.repeat(CURRENT.diveText),
            anchor: { fromCharacter, toCharacter: fromCharacter + word.length, quoteStart: word, quoteEnd: word }
          };
        })
      }))
    };
  };

  it('admits a Current at every one of its ceilings as an Experience Program', () => {
    const { program, sources } = materializeRiseCurrent(maximalCurrent());
    const track = kind => program.tracks.find(item => item.kind === kind);

    expect(program.tracks.length).toBeLessThanOrEqual(EP.maxTracks);
    expect(track('movement').clips).toHaveLength(CURRENT.segments);
    expect(track('visual').clips).toHaveLength(CURRENT.segments);
    expect(track('thread').clips).toHaveLength(CURRENT.segments * CURRENT.dives);
    expect(sources).toHaveLength(CURRENT.segments);
    expect(sources.reduce((sum, source) => sum + source.data.length, 0))
      .toBeLessThanOrEqual(CURRENT.totalText);
  });

  it('refuses a Current one past a shared ceiling as a Current, not as a program', () => {
    const current = maximalCurrent();
    current.segments.push({ ...current.segments[0], id: 'one-too-many' });
    expect(errorCode(() => materializeRiseCurrent(current))).toBe('CURRENT_SEGMENTS');
    expect(errorCode(() => materializeRiseCurrent(current))).not.toMatch(/^PROGRAM_/u);
  });

  it('lowers the adapter program to schedules inside the Experience Program bounds', () => {
    const { program } = materializeRiseCurrent(maximalCurrent());
    const lowered = lowerExperienceProgram(program);

    expect(lowered.movementProgram.movements.length).toBeLessThanOrEqual(EP.maxMovements);
    expect(lowered.movementProgram.movements.length).toBe(CURRENT.segments);
    expect(lowered.boundaries.length).toBeLessThanOrEqual(EP.maxTransitions);
    for (const movement of lowered.movementProgram.movements) {
      expect(movement.sourceIds.length).toBeLessThanOrEqual(EP.maxSourceIds);
      for (const sourceId of movement.sourceIds) expect(sourceId.length).toBeLessThanOrEqual(EP.maxIdLength);
      if (movement.title !== null) expect(movement.title.length).toBeLessThanOrEqual(TITLE_CEILING);
    }
    const visualTracks = program.tracks.filter(track => track.kind === 'visual').length;
    expect(lowered.visualProgram.segments.length).toBeLessThanOrEqual(EP.maxClipsPerTrack * visualTracks);
    expect(lowered.audioProgram).toBeNull();
    expect(lowered.readingProgram).toBeNull();
    expect(lowered.narrationProgram).toBeNull();
    const sourceIds = new Set(program.tracks.flatMap(track => track.clips.flatMap(clip => clip.anchor.sourceIds)));
    expect(sourceIds.size).toBeLessThanOrEqual(EP.maxSourceIds);
  });

  it('an adapter refusal and a centre refusal are different classes', () => {
    expect(RiseCurrentError).not.toBe(ExperienceProgramValidationError);
  });
});

describe('rise.portable-sequence.v1 carries the centre', () => {
  it('can hold one thread track filled with glosses at the centre ceiling', () => {
    // A bundle names its sources by reference and carries the program whole,
    // so the byte ceiling must at least admit the text one track may hold.
    expect(PORTABLE_SEQUENCE_MAX_BYTES)
      .toBeGreaterThanOrEqual(EP.maxClipsPerTrack * EP.maxThreadTextLength);
  });
});
