/**
 * THE WORDS A READER RECEIVES, IN THE ORDER THEY RECEIVE THEM.
 *
 * Three defects in stitched readings survived 2,441 green tests, and they
 * survived for one reason: every test called an inner function directly. The
 * suite asserted on `programSourceIds`, on `assertProgramWithinContext`, on
 * `sentenceAlignedPrefix` — each of them correct about the question it was
 * asked, and none of them asked what a reader ends up hearing.
 *
 *   - Two scores with IDENTICAL movement tracks read in opposite directions,
 *     because one of them also carried a visual clip and listed that track
 *     first. Every assertion about `programSourceIds` was about the SET.
 *   - A reader asking for ten minutes was given five, because the budget spent
 *     the most a cut could read rather than what it names. Every assertion
 *     about the budget compared the charge to itself.
 *   - `spoon-river-anthology#12` and `#12:79` are the same seventy-nine words,
 *     and a score naming both was admitted and read Judge Somers twice. Every
 *     assertion about ownership compared id strings, which is the one thing
 *     that cannot see it.
 *
 * So this file drives ScriptoriumSession — the object the room renders and the
 * CLI prints — all the way to compiled atoms, and asserts on the text. It is
 * slower than calling the functions and it is the only place the answers can
 * be wrong in a way a reader would notice.
 */
import { describe, expect, it } from 'vitest';
import { createScriptoriumSession } from './scriptorium-session.js';
import { workshopProjectToSessionConfig } from './workshop-project.js';
import { compileSession } from './session-compiler.js';
import { countWords } from './chunker.js';
import { EXTENT_OVERSHOOT_LIMIT, extentNominalWords } from './library-extent.js';
import { createCuratorSourceReader, exportCuratorContext } from './curator-context.js';

/**
 * Everything a reader gets, from a pasted score: the verdict, the sources in
 * the order they will be read, and the compiled text itself.
 *
 * The compile is the point. `project.sources` is an array whose order nothing
 * downstream re-sorts, so the words come out in that order — and asserting on
 * the words rather than on the array is what makes the claim about the reading
 * instead of about an intermediate.
 */
async function readingOf(score, { length = 20_000 } = {}) {
  const session = createScriptoriumSession({ wpm: 200, mintId: () => 'stitched-test' });
  session.setIntent('a stitched reading');
  session.setTargetWords(length);
  session.take();

  const verdict = session.examine(JSON.stringify(score));
  if (!verdict.ok) {
    return { ok: false, stage: 'examine', code: verdict.code, refusal: verdict.text };
  }
  const outcome = await session.read();
  if (!outcome.ok) {
    return {
      ok: false, stage: 'read', code: outcome.verdict.code, refusal: outcome.verdict.text
    };
  }
  const compiled = compileSession(workshopProjectToSessionConfig(outcome.project));
  const words = compiled.atoms
    .map(atom => (typeof atom?.content === 'string' ? atom.content : ''))
    .join(' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  return {
    ok: true,
    sourceIds: outcome.project.sources.map(source => source.id),
    delivered: outcome.project.sources.reduce((sum, s) => sum + countWords(s.data), 0),
    words,
    opening: words.slice(0, 10).join(' '),
    closing: words.slice(-10).join(' ')
  };
}

const movementTrack = (sourceIds) => ({
  id: 'movements',
  kind: 'movement',
  clips: sourceIds.map((sourceId, index) => ({
    id: `m${index + 1}`,
    anchor: { sourceIds: Array.isArray(sourceId) ? sourceId : [sourceId] },
    data: { index, title: `Movement ${index + 1}` }
  }))
});

const score = (id, tracks) => ({
  schema: 'rise.experience-program.v1',
  id,
  authority: 'proposed',
  editable: true,
  tracks
});

/** A visual clip is the cheapest non-movement track that anchors to a source. */
const visualTrack = (sourceId) => ({
  id: 'visuals',
  kind: 'visual',
  fallback: { kind: 'still' },
  clips: [{
    id: 'v1',
    cue: { kind: 'procedural', collections: ['klee'] },
    anchor: { sourceIds: [sourceId], fromProgress: 0, toProgress: 1 }
  }]
});

describe('the movement track decides the reading order', () => {
  /**
   * THE DEFECT, AS A READER MET IT.
   *
   * `programSourceIds` walked `program.tracks` in array order; that
   * enumeration becomes `project.sources`, and `project.sources` is the
   * reading. So a visual track listed before the movements put its own anchor
   * into the reading first, and chapter 81 of the Tao was read before chapter
   * 1 in a score whose movements say the opposite.
   *
   * The two scores below differ in NOTHING a reader could see except the
   * position of a cue in a JSON array. If they ever disagree about the text
   * again, this says so in the words themselves.
   */
  it('reads the same words in the same order however the tracks are arranged', async () => {
    const movements = ['sacred-tao-te-ching#1', 'sacred-tao-te-ching#81'];
    const forward = await readingOf(score('order-forward', [movementTrack(movements)]));
    const visualFirst = await readingOf(score('order-visual-first', [
      visualTrack('sacred-tao-te-ching#81'),
      movementTrack(movements)
    ]));

    expect(forward.ok, forward.refusal).toBe(true);
    expect(visualFirst.ok, visualFirst.refusal).toBe(true);

    // THE ASSERTION IS ON THE TEXT. An array comparison is what the old tests
    // made and it is a claim about a variable; this is a claim about a reading.
    expect(visualFirst.words).toEqual(forward.words);
    expect(forward.opening).toMatch(/^The Tao that can be trodden/u);
    expect(visualFirst.opening).toMatch(/^The Tao that can be trodden/u);
    expect(visualFirst.closing).toBe(forward.closing);
  }, 120_000);

  it('follows the movement order rather than the order the ids appear in', async () => {
    // Reversed movements read reversed. Without this the test above would pass
    // on a resolver that sorted alphabetically, or that always read #1 first.
    const reverse = await readingOf(score('order-reverse', [
      movementTrack(['sacred-tao-te-ching#81', 'sacred-tao-te-ching#1'])
    ]));
    expect(reverse.ok, reverse.refusal).toBe(true);
    expect(reverse.opening).toMatch(/^Sincere words are not fine/u);
    expect(reverse.sourceIds).toEqual(['sacred-tao-te-ching#81', 'sacred-tao-te-ching#1']);
  }, 120_000);

  it('reads a work no movement names, after the movements that do', async () => {
    // A transition carries source ids of its own and they still have to be
    // loaded. They come last rather than wherever the track happened to sit —
    // which is a smaller wrong than a reversed reading and is honestly not
    // where `afterSourceId` says they belong. Pinned so that the seam's
    // position is a decision somebody has to change rather than discover.
    const stitched = await readingOf(score('seamed', [
      movementTrack(['sacred-tao-te-ching#1', 'sacred-tao-te-ching#81']),
      {
        id: 'seams',
        kind: 'transition',
        clips: [{
          id: 't1',
          durationMs: 1_500,
          data: { fromMovementId: 'm1', toMovementId: 'm2' },
          anchor: {
            sourceIds: ['sacred-tao-te-ching#40'],
            afterSourceId: 'sacred-tao-te-ching#1',
            beforeSourceId: 'sacred-tao-te-ching#81'
          }
        }]
      }
    ]));
    expect(stitched.ok, stitched.refusal).toBe(true);
    expect(stitched.sourceIds).toEqual([
      'sacred-tao-te-ching#1', 'sacred-tao-te-ching#81', 'sacred-tao-te-ching#40'
    ]);
  }, 120_000);
});

describe('a rung delivers roughly its own length', () => {
  const context = exportCuratorContext({
    id: 'rung-measure', sources: [], includeLibrary: true,
    constraints: { targetWords: 20_000 }
  });
  const read = createCuratorSourceReader(context);

  /** Divisions long enough that a 200-word ask really cuts. */
  const longDivisionOpenings = () => {
    const ids = [];
    for (const work of context.library) {
      const words = work.divisions?.words;
      if (!Array.isArray(words)) continue;
      words.forEach((count, index) => {
        // The two the shelf cannot cut at 200 words are named in
        // shelf-measurements.test.js; they refuse at the reading, which is a
        // different verdict from the one under test here.
        if (count > 400 && !`${work.id}#${index + 1}`.match(/^(?:ulysses#18|lyrical-ballads#42)$/u)) {
          ids.push(`${work.id}#${index + 1}:200`);
        }
      });
    }
    return ids;
  };

  /**
   * A MODEL THAT ADDS UP BEFORE IT ANSWERS, which is what the prompt asks for.
   *
   * It prices each opening by `extentNominalWords` — what the extent names —
   * and stops at the reader's length. That is the arithmetic the prompt has to
   * teach for this to hold, and it is computable from the catalogue alone,
   * which is what makes it teachable.
   */
  const fillTo = (budget) => {
    const chosen = [];
    let spent = 0;
    for (const id of longDivisionOpenings()) {
      if (chosen.length >= 60) break;
      const reading = read(id);
      const cost = extentNominalWords(reading.words, reading.askedWords) ?? 0;
      if (!cost || spent + cost > budget) continue;
      chosen.push(id);
      spent += cost;
    }
    return { chosen, spent };
  };

  /**
   * THE NUMBER THE WHOLE DEFECT IS ABOUT.
   *
   * Spending `extentReadingBound` — the 1.6× ceiling — from the reader's
   * length made a 2,000-word sitting deliver 1,254 words. The rung is a
   * promise about how long the reader will be sitting there, so the tolerance
   * is a reader's tolerance rather than an accountant's: within a tenth.
   */
  it('gives a 2,000-word sitting about 2,000 words', async () => {
    const { chosen, spent } = fillTo(2_000);
    expect(spent).toBeGreaterThan(1_900);
    const reading = await readingOf(
      score('ten-minute-rung', [movementTrack([chosen])]), { length: 2_000 }
    );
    expect(reading.ok, reading.refusal).toBe(true);
    expect(
      reading.delivered / 2_000,
      `a 2,000-word rung delivered ${reading.delivered} words from `
      + `${chosen.length} openings`
    ).toBeGreaterThan(0.9);
    expect(reading.delivered / 2_000).toBeLessThan(1.1);
  }, 180_000);

  it('holds across the ladder of sittings, not at one rung', async () => {
    // One rung is one accident. The shortfall was 54% at the shortest sitting
    // and 63% at the longest, so a single measurement could have been read as
    // rounding.
    for (const budget of [1_000, 4_000, 6_000]) {
      const { chosen } = fillTo(budget);
      const reading = await readingOf(
        score(`rung-${budget}`, [movementTrack([chosen])]), { length: budget }
      );
      expect(reading.ok, `${budget}: ${reading.refusal}`).toBe(true);
      expect(
        reading.delivered / budget,
        `a ${budget}-word rung delivered ${reading.delivered} words`
      ).toBeGreaterThan(0.9);
      expect(reading.delivered / budget).toBeLessThan(1.1);
    }
  }, 300_000);

  /**
   * AND NOTHING GOT OPTIMISTIC ABOUT THE MACHINE.
   *
   * The reader's length is spent on what an extent names; the compiler is
   * still protected by the bound. The envelope between them is not a second
   * ceiling the gate checks — it falls out of the arithmetic — so it is
   * measured here rather than asserted where it is computed.
   */
  it('keeps the most a rung can read inside the overshoot of the rung', () => {
    for (const budget of [400, 1_000, 2_000, 4_000, 6_000]) {
      const { chosen } = fillTo(budget);
      const bound = chosen.reduce((sum, id) => sum + (read(id).words ?? 0), 0);
      expect(
        bound,
        `a ${budget}-word rung could read up to ${bound} words`
      ).toBeLessThanOrEqual(Math.round(budget * EXTENT_OVERSHOOT_LIMIT));
    }
  }, 120_000);

  it('refuses a score longer than the rung, and says about how long it is', async () => {
    const refused = await readingOf(
      score('over', [movementTrack(['sacred-tao-te-ching'])]), { length: 2_000 }
    );
    expect(refused.ok).toBe(false);
    expect(refused.code).toBe('PROGRAM_IO_BUDGET_EXCEEDED');
    // "about", because the figure is now an estimate of the reading rather
    // than a ceiling over it — and it is still the reader's own number that
    // the score is compared to.
    expect(refused.refusal).toMatch(/reads about 10,321 words/u);
    expect(refused.refusal).toMatch(/You asked for 2,000/u);
  }, 120_000);
});

describe('one passage is one source, however it is spelled', () => {
  /**
   * THE HONEST REPRISE AND THE DISHONEST ONE, ANSWERED THE SAME WAY.
   *
   * `#12` and `#12:79` are the same seventy-nine words — 79 clears the
   * division's own length, so the cutter returns it whole — and the program
   * validator compares id strings, which cannot see that. One score was
   * refused and its twin was read twice.
   */
  it('refuses a coda that returns to a movement under the same id', async () => {
    const reprise = await readingOf(score('reprise', [movementTrack([
      'sacred-tao-te-ching#1', 'sacred-tao-te-ching#40', 'sacred-tao-te-ching#1'
    ])]));
    expect(reprise.ok).toBe(false);
    expect(reprise.code).toBe('PROGRAM_SOURCE_OWNERSHIP');
  }, 120_000);

  it('refuses the same coda spelled with a redundant length', async () => {
    // The twin. Division 12 of Spoon River holds 79 words, so `:79` names the
    // whole of it and Judge Somers was read twice under two movement titles.
    const twin = await readingOf(score('reprise-two-ids', [movementTrack([
      'spoon-river-anthology#12', 'sacred-tao-te-ching#16', 'spoon-river-anthology#12:79'
    ])]));
    expect(twin.ok).toBe(false);
    expect(twin.code).toBe('PROGRAM_SOURCE_OWNERSHIP');
    expect(twin.refusal).toMatch(/name the same passage/u);
    expect(twin.refusal).toMatch(/spoon-river-anthology#12/u);
    // The reader is told what to do instead, which the bare validator message
    // never was.
    expect(twin.refusal).toMatch(/Give each movement its own work, division or opening/u);
  }, 120_000);

  it('refuses every ask that covers the division, not the one that was found', async () => {
    // 79 was the ask in the reproduction. Any ask at or above the division's
    // own length names the same whole division, so a check written against 79
    // would be a check against one accident.
    for (const asked of [79, 80, 200, 3_000]) {
      const twin = await readingOf(score(`reprise-${asked}`, [movementTrack([
        'spoon-river-anthology#12', `spoon-river-anthology#12:${asked}`
      ])]));
      expect(twin.ok, `:${asked} was admitted`).toBe(false);
      expect(twin.code).toBe('PROGRAM_SOURCE_OWNERSHIP');
    }
  }, 180_000);

  it('leaves two real openings of one division alone', async () => {
    // WHAT IS NOT CLAIMED. Two asks inside a long division cut somewhere the
    // catalogue cannot see, so they are not folded together — the gate refuses
    // what it can prove and guesses at nothing. Both are read.
    const two = await readingOf(score('two-openings', [movementTrack([
      'metamorphoses#1:200', 'metamorphoses#2:200'
    ])]));
    expect(two.ok, two.refusal).toBe(true);
    expect(two.sourceIds).toEqual(['metamorphoses#1:200', 'metamorphoses#2:200']);
  }, 120_000);

  it('folds a redundant length to its own division and no further', async () => {
    // Divisions 12 and 13 of Spoon River hold 79 and 156 words, so both asks
    // above name a whole division — and they are still two different passages.
    // Canonicalising to the WORK would refuse this, and refusing two epitaphs
    // of one book is a worse reading of the rule than the hole it closed.
    const two = await readingOf(score('two-wholes', [movementTrack([
      'spoon-river-anthology#12:200', 'spoon-river-anthology#13:200'
    ])]));
    expect(two.ok, two.refusal).toBe(true);
    expect(two.sourceIds).toEqual([
      'spoon-river-anthology#12:200', 'spoon-river-anthology#13:200'
    ]);
  }, 120_000);

  it('refuses a transition that names a movement\'s passage under another spelling', async () => {
    // The same hole in the lane that has its own uniqueness rule. A transition
    // source must not be one a movement owns; spelled with a `:N` that covers
    // the division, it was.
    const smuggled = await readingOf(score('seam-twin', [
      movementTrack(['spoon-river-anthology#12', 'sacred-tao-te-ching#16']),
      {
        id: 'seams',
        kind: 'transition',
        clips: [{
          id: 't1',
          durationMs: 1_500,
          data: { fromMovementId: 'm1', toMovementId: 'm2' },
          anchor: {
            sourceIds: ['spoon-river-anthology#12:79'],
            afterSourceId: 'spoon-river-anthology#12',
            beforeSourceId: 'sacred-tao-te-ching#16'
          }
        }]
      }
    ]));
    expect(smuggled.ok).toBe(false);
    expect(smuggled.code).toBe('PROGRAM_TRANSITION_SOURCE_DUPLICATE');
  }, 120_000);
});
