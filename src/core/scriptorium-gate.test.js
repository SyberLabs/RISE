/**
 * THE DOOR A READER WALKS THROUGH.
 *
 * Everything here goes in the way Scriptorium.examine() sends it: a real
 * capability document from exportCuratorContext, a pasted string, and
 * parseCuratorPaste. Nothing calls an internal helper.
 *
 * That distinction is the whole reason this file exists. scriptorium-
 * extent.test.js passed for as long as the extent grammar was unreachable,
 * because it only ever asked the RESOLVER — the far side of a gate that had
 * never heard of an extent. Every id the room teaches its curator to write
 * was refused before the resolver saw it:
 *
 *   sacred-tao-te-ching        ACCEPTED
 *   sacred-tao-te-ching#40     REFUSED PROGRAM_IO_UNKNOWN_SOURCE
 *   sacred-tao-te-ching#40:200 REFUSED PROGRAM_IO_UNKNOWN_SOURCE
 *
 * and below 10,321 words — the shortest whole work on the shelf — no score
 * of any kind could be admitted at all.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { availableVoicePacks } from '../audio/voice-pack.js';
import { exportCuratorContext } from './curator-context.js';
import { PROGRAM_VISUAL_FIELD_RENDERERS } from './experience-program.js';
import {
  AGENT_OPERATION_OPS,
  applyAgentOperationSet,
  OPERATION_CAPABILITY_FIELDS
} from './agent-operations.js';
import { audioScoreAssetFromId } from './workshop-audio.js';
import {
  CAPABILITY_FAMILIES,
  describeImportFailure,
  LIBRARY_LOAD_REFUSAL,
  parseCuratorPaste,
  programSourceIds,
  unloadableLibrarySourcesError
} from './experience-program-io.js';
import {
  resolveLibrarySourceIds,
  resolveOperationLibrarySources,
  resolveProgramLibrarySources
} from './scriptorium-resolve.js';
import { EXTENT_MIN_WORDS, extentReadingBound } from './library-extent.js';
import { MAX_SAFE_TARGET_WORDS, READING_LIMITS } from './reading-limits.js';

/** Exactly what the room builds when the reader moves the slider. */
const roomContext = (targetWords) => exportCuratorContext({
  id: 'scriptorium-test',
  sources: [],
  includeLibrary: true,
  constraints: { targetWords }
});

const score = (sourceIds) => JSON.stringify({
  schema: 'rise.experience-program.v1',
  id: 'a-reading',
  authority: 'proposed',
  editable: true,
  tracks: [{
    id: 'movements',
    kind: 'movement',
    clips: sourceIds.map((sourceId, index) => ({
      id: `m${index + 1}`,
      anchor: { sourceIds: [sourceId] },
      data: { index, title: sourceId }
    }))
  }]
});

/** What the reader is handed back when the gate throws. */
function refuse(text, context) {
  try {
    parseCuratorPaste(text, { context });
  } catch (error) {
    return { code: error.code, text: describeImportFailure(error, { context }) };
  }
  return null;
}

const TAO = 'sacred-tao-te-ching';
const catalogueFor = (context, id) => context.library.find(entry => entry.id === id);

describe('the gate reads the extents the room teaches', () => {
  it('admits a work, one of its divisions, and a division opening', () => {
    const context = roomContext(20_000);
    for (const id of [TAO, `${TAO}#40`, `${TAO}#40:200`]) {
      expect(() => parseCuratorPaste(score([id]), { context }),
        `${id} was refused`).not.toThrow();
    }
  });

  it('admits a reading below the length of the shortest work on the shelf', () => {
    // 200 words is the slider's floor. The shortest WHOLE work is 10,321, so
    // before the extents reached the gate this position could admit nothing.
    const context = roomContext(200);
    expect(() => parseCuratorPaste(score([`${TAO}#40`]), { context })).not.toThrow();
    // And the whole work at that length is still refused, by the budget it
    // was always supposed to be refused by.
    expect(refuse(score([TAO]), context).code).toBe('PROGRAM_IO_BUDGET_EXCEEDED');
  });

  it('measures divisions against the budget rather than declaring them unmeasurable', () => {
    // Fixing membership alone turned the refusal into PROGRAM_IO_BUDGET_
    // UNMEASURED, which is the same closed door with a different sign on it.
    const context = roomContext(400);
    const words = catalogueFor(context, TAO).divisions.words;
    expect(Array.isArray(words)).toBe(true);

    // Enough chapters to pass 400 words, and one fewer.
    const chapters = [];
    let total = 0;
    while (total <= 400) {
      chapters.push(`${TAO}#${chapters.length + 1}`);
      total += words[chapters.length - 1];
    }
    const under = chapters.slice(0, -1);
    expect(() => parseCuratorPaste(score(under), { context })).not.toThrow();

    const refusal = refuse(score(chapters), context);
    expect(refusal.code).toBe('PROGRAM_IO_BUDGET_EXCEEDED');
    expect(refusal.text).toMatch(/asked for 400/);
  });

  it('charges an opening the most it can read, and the resolver stays inside it', async () => {
    // The gate decides with nothing but the catalogue; the cut happens later
    // against the real bytes. If the second can exceed the first, the budget
    // is a promise the reading is free to break.
    //
    // THE THREE IDS THIS USED TO NAME COULD NOT SEE THE FAILURE IT GUARDS.
    // middlemarch#2, sacred-tao-te-ching#1 and the-iliad#3 all have a full
    // stop comfortably inside the overshoot cap, so restoring the pre-fix
    // `if (words > ceiling && best) break` — which could not reject the FIRST
    // candidate, the only case a cap on overshoot was ever written for — left
    // every assertion here passing. The two divisions on the whole shelf that
    // actually exercise it are named below.
    const context = roomContext(20_000);
    // Molly's soliloquy runs 24,058 words to its first full stop, and Lyrical
    // Ballads #42 has none nearer than 336. Asked for 200 words, the cap can
    // honour neither, and a passage of a wildly different length is not a
    // smaller true thing — so the id is absent rather than substituted.
    const REFUSING = ['ulysses#18:200', 'lyrical-ballads#42:200'];
    const RESOLVING = ['middlemarch#2:200', `${TAO}#1:200`, 'the-iliad#3:500'];
    const pasted = parseCuratorPaste(score([...RESOLVING, ...REFUSING]), { context });
    const { sources, missing, refused } = await resolveProgramLibrarySources(pasted.program);

    expect(missing).toEqual([]);
    // ABSENT, NEVER A SUBSTITUTE. Pre-fix these came back as sources of 5,714
    // and 336 words against a charge of 320 — the budget broken by the very
    // reading it admitted.
    expect([...refused].sort()).toEqual([...REFUSING].sort());
    expect(sources.map(source => source.id).sort()).toEqual([...RESOLVING].sort());

    for (const source of sources) {
      const [workId, rest] = source.id.split('#');
      const [division, asked] = rest.split(':');
      const declared = catalogueFor(context, workId).divisions.words[Number(division) - 1];
      expect(source.words,
        `${source.id} reads ${source.words} words`)
        .toBeLessThanOrEqual(extentReadingBound(declared, Number(asked)));
    }
  }, 180_000);
});

describe('a refusal says what a curator can act on', () => {
  it('separates a division the work lacks from a work the room lacks', () => {
    const context = roomContext(20_000);
    const refusal = refuse(score(['spoon-river-anthology#900']), context);
    // It used to report an unknown SOURCE and then list spoon-river-anthology
    // among the works available — an answer directly beneath its own denial.
    expect(refusal.code).toBe('PROGRAM_IO_UNKNOWN_DIVISION');
    expect(refusal.text).toMatch(/246/);
    expect(refusal.text).not.toMatch(/Available sources/);
    // And it says which division was asked for. The count alone passes on a
    // refusal that lost the ordinal on the way here and reads "the score asks
    // for number null … drop the "#null"" — advice about an id nobody wrote.
    expect(refusal.text).toMatch(/asks for number 900/u);
    expect(refusal.text).toMatch(/"#900"/u);

    expect(refuse(score(['no-such-work#3']), context).code).toBe('PROGRAM_IO_UNKNOWN_SOURCE');
  });

  it('names the floor when the opening asked for is a fragment', () => {
    // `spoon-river-anthology#50:37` returned the whole string as a work id,
    // missed in the registry, and told the reader the room does not hold
    // Spoon River — while Spoon River stood in the same catalogue.
    const context = roomContext(20_000);
    const refusal = refuse(score(['spoon-river-anthology#50:37']), context);
    expect(refusal.code).toBe('PROGRAM_IO_EXTENT_FLOOR');
    expect(refusal.text).toMatch(new RegExp(String(EXTENT_MIN_WORDS)));
    expect(refusal.text).toMatch(/spoon-river-anthology#50/);
    // AND THE ADVICE NAMES THE DIVISION, not the book it is in. The line above
    // cannot see the difference: the refusal quotes the whole offending id, so
    // `spoon-river-anthology#50` is a substring of it whatever the advice ends
    // up saying. A refusal that dropped the ordinal would tell a curator who
    // asked for 37 words to load forty thousand instead.
    expect(refusal.text).toMatch(/name "spoon-river-anthology#50"/u);
    // The division itself is 37 words and is perfectly readable whole — the
    // floor governs a CUT, not the id grammar.
    expect(() => parseCuratorPaste(score(['spoon-river-anthology#50']), { context }))
      .not.toThrow();
  });

  it('names a Markdown fence instead of quoting a backtick, and does not strip it', () => {
    const context = roomContext(20_000);
    const fenced = `\`\`\`json\n${score([TAO])}\n\`\`\``;
    const refusal = refuse(fenced, context);
    expect(refusal.code).toBe('PROGRAM_IO_JSON');
    expect(refusal.text).toMatch(/code fence/i);
    // REPAIR IS FORBIDDEN. The fence is named, never removed.
    expect(() => parseCuratorPaste(fenced, { context })).toThrow();
  });

  it('says a document looks cut off instead of quoting a character offset', () => {
    const context = roomContext(20_000);
    const whole = score([TAO]);
    const refusal = refuse(whole.slice(0, whole.length - 40), context);
    expect(refusal.code).toBe('PROGRAM_IO_JSON');
    expect(refusal.text).toMatch(/cut off/i);
    expect(refusal.text).not.toMatch(/position \d+/);

    // And a document that is merely wrong still gets the parser's own words.
    const plain = refuse('{ "schema": "rise.experience-program.v1", }', context);
    expect(plain.text).not.toMatch(/cut off|code fence/i);
  });
});

describe('a length the reader can ask for is a length a session can hold', () => {
  it('refuses at the gate what would have thrown at Begin', () => {
    // Reproduced end to end: the reader drags the slider to its maximum, the
    // model returns these four works, the gate accepted 118,695 words, and
    // Begin threw with 121,617 atoms — advising a chunk mode this room has no
    // control for. An atom is not a word; a paragraph costs one of its own.
    const context = roomContext(READING_LIMITS.maxAtoms);
    const ids = ['spoon-river-anthology', 'confucius-analects', 'lyrical-ballads', TAO];
    const total = ids.reduce((sum, id) => sum + catalogueFor(context, id).words, 0);
    expect(total).toBeGreaterThan(MAX_SAFE_TARGET_WORDS);
    expect(total).toBeLessThanOrEqual(READING_LIMITS.maxAtoms);

    const refusal = refuse(score(ids), context);
    expect(refusal.code).toBe('PROGRAM_IO_ATOM_CEILING');
    expect(refusal.text).not.toMatch(/chunking/);
    expect(refusal.text).toContain(total.toLocaleString('en-US'));
  });

  it('quotes a ceiling the gate turns out to enforce', () => {
    // WHAT THIS USED TO ASSERT was that the refusal contains
    // MAX_SAFE_TARGET_WORDS.toLocaleString() — against a message built by
    // interpolating MAX_SAFE_TARGET_WORDS.toLocaleString(). The sentence
    // agreed with itself, and would have gone on agreeing with itself if the
    // number had been wrong by any amount.
    //
    // So the number is read back OUT of the prose the reader is handed and
    // put through the gate. One word under it is admitted; one word over is
    // refused. That is the only sense in which a quoted ceiling is true.
    const context = roomContext(READING_LIMITS.maxAtoms);
    const refusal = refuse(score(['the-brothers-karamazov']), context);
    expect(refusal.code).toBe('PROGRAM_IO_ATOM_CEILING');

    const quoted = Number(
      /One session holds ([\d,]+)/u.exec(refusal.text)?.[1].replace(/,/gu, '')
    );
    expect(Number.isInteger(quoted), `no ceiling in: ${refusal.text}`).toBe(true);
    expect(quoted).toBeLessThan(READING_LIMITS.maxAtoms);

    // A reader's own pasted text, measured by the exporter that measures it
    // in the room — the shelf has no work of an arbitrary length to probe
    // with, and inventing one in the context would be probing the test.
    const pastedWords = (count) => exportCuratorContext({
      id: 'scriptorium-test',
      sources: [{
        id: 'pasted',
        name: 'Pasted',
        data: Array.from({ length: count }, () => 'word').join(' ')
      }],
      includeLibrary: false,
      constraints: { targetWords: READING_LIMITS.maxAtoms }
    });

    expect(() => parseCuratorPaste(score(['pasted']), { context: pastedWords(quoted) }),
      `${quoted} words is the quoted ceiling and was refused`).not.toThrow();
    expect(refuse(score(['pasted']), pastedWords(quoted + 1))?.code,
      `${quoted + 1} words is one over the quoted ceiling and was admitted`)
      .toBe('PROGRAM_IO_ATOM_CEILING');
  });

  it('leaves a score under the ceiling alone', () => {
    const context = roomContext(READING_LIMITS.maxAtoms);
    const ids = ['spoon-river-anthology', 'lyrical-ballads', TAO];
    const total = ids.reduce((sum, id) => sum + catalogueFor(context, id).words, 0);
    expect(total).toBeLessThanOrEqual(MAX_SAFE_TARGET_WORDS);
    expect(() => parseCuratorPaste(score(ids), { context })).not.toThrow();
  });
});

/**
 * THE BUDGET AND THE RESOLVER WERE TWO WALKS OVER ONE SCORE.
 *
 * `assertProgramWithinBudget` iterated `if (track.kind !== 'movement')
 * continue`; `programSourceIds` walked every track. A transition clip's
 * anchor carries `sourceIds` of its own, which is the one place a score could
 * name a work the budget never saw: a 38-word chapter as the movement and
 * Middlemarch as the coda passed a 200-word budget and then read 315,299
 * words — 1,576× — with the room's preview listing `middlemarch — 315,261
 * words` directly above a rundown saying the reading is 38 words.
 *
 * They are one function now. These tests are the behaviour that says so, and
 * the field list is read out of the validator so that a NEW way to name a
 * source fails here rather than reopening the hole.
 */
describe('the budget spends exactly what the reading will load', () => {
  const OVER_BUDGET = TAO;
  const BUDGET = 200;

  /** The anchor fields `validateAnchor` lets a clip name a source with. */
  const SOURCE_ANCHOR_FIELDS = (() => {
    const source = readFileSync(
      join(process.cwd(), 'src/core/experience-program.js'), 'utf8'
    );
    const body = source.slice(source.indexOf('function validateAnchor'));
    const found = new Set();
    for (const match of body.slice(0, body.indexOf('\n}\n')).matchAll(
      /'([A-Za-z]*[Ss]ource(?:Id|Ids))'/gu
    )) found.add(match[1]);
    return [...found];
  })();

  const movementTrack = (sourceIds) => ({
    id: 'movements',
    kind: 'movement',
    clips: sourceIds.map((sourceId, index) => ({
      id: `m${index + 1}`,
      anchor: { sourceIds: [sourceId] },
      data: { index, title: sourceId }
    }))
  });

  /**
   * One program per anchor field, naming the over-budget work ONLY there.
   *
   * `#40` is 38 words and is what the movements carry, so anything the gate
   * admits here it admits because it did not count the field under test.
   */
  const PLACEMENTS = {
    sourceIds: (id) => JSON.stringify({
      schema: 'rise.experience-program.v1',
      id: 'named-by-a-transition',
      authority: 'proposed',
      editable: true,
      tracks: [
        movementTrack([`${TAO}#40`]),
        {
          id: 'transitions',
          kind: 'transition',
          clips: [{
            id: 't1',
            anchor: { sourceIds: [id], afterSourceId: `${TAO}#40` },
            data: { fromMovementId: 'm1' },
            durationMs: 1000
          }]
        }
      ]
    }),
    afterSourceId: (id) => JSON.stringify({
      schema: 'rise.experience-program.v1',
      id: 'left-by-a-work-no-movement-owns',
      authority: 'proposed',
      editable: true,
      tracks: [
        movementTrack([`${TAO}#40`]),
        {
          id: 'transitions',
          kind: 'transition',
          clips: [{
            id: 't1',
            anchor: { sourceIds: ['journey-boundary:t1'], afterSourceId: id },
            data: { fromMovementId: 'm1' },
            durationMs: 1000
          }]
        }
      ]
    }),
    beforeSourceId: (id) => JSON.stringify({
      schema: 'rise.experience-program.v1',
      id: 'entered-by-a-work-no-movement-owns',
      authority: 'proposed',
      editable: true,
      tracks: [
        movementTrack([`${TAO}#40`, `${TAO}#41`]),
        {
          id: 'transitions',
          kind: 'transition',
          clips: [{
            id: 't1',
            anchor: {
              sourceIds: ['journey-boundary:t1'],
              afterSourceId: `${TAO}#40`,
              beforeSourceId: id
            },
            data: { fromMovementId: 'm1', toMovementId: 'm2' },
            durationMs: 1000
          }]
        }
      ]
    })
  };

  it('leaves no anchor field that can name a source untried', () => {
    // A new source-bearing field in validateAnchor arrives here with no
    // placement and fails, rather than arriving in programSourceIds unread.
    expect(SOURCE_ANCHOR_FIELDS.length).toBeGreaterThan(0);
    for (const field of SOURCE_ANCHOR_FIELDS) {
      expect(PLACEMENTS[field],
        `anchor.${field} can name a source and nothing below puts a work in it`)
        .toBeTypeOf('function');
    }
  });

  for (const field of SOURCE_ANCHOR_FIELDS) {
    it(`refuses a work named only by anchor.${field}`, () => {
      const context = roomContext(BUDGET);
      const verdict = refuse(PLACEMENTS[field](OVER_BUDGET), context);
      expect(verdict,
        `${OVER_BUDGET} named by anchor.${field} was admitted against ${BUDGET} words`)
        .toBeTruthy();
      // Either the budget spends it, or the validator forbids naming a work
      // there at all — PROGRAM_TRANSITION_NEIGHBOR requires a neighbour id to
      // be one a movement already owns, which is what closes the two ends.
      expect(['PROGRAM_IO_BUDGET_EXCEEDED', 'PROGRAM_TRANSITION_NEIGHBOR'],
        `anchor.${field} refused with ${verdict.code}`).toContain(verdict.code);
    });
  }

  it('names the transition-owned work in the refusal it hands back', () => {
    const context = roomContext(BUDGET);
    const verdict = refuse(PLACEMENTS.sourceIds(OVER_BUDGET), context);
    expect(verdict.code).toBe('PROGRAM_IO_BUDGET_EXCEEDED');
    expect(verdict.text).toContain(`${OVER_BUDGET} — `);
    // NOT "its movements name". The sum is over every source the reading
    // loads, and it was the word "movements" that made the old sum look right.
    expect(verdict.text).not.toMatch(/movements name/u);
  });

  it('measures the set the resolver actually loads', async () => {
    // The two functions are one; this is the behaviour that says the one they
    // share is the right one. Every id the resolver turns into a source, or
    // reports as missing or refused, was an id the budget could have spent.
    const context = roomContext(20_000);
    const pasted = parseCuratorPaste(PLACEMENTS.sourceIds(`${TAO}#41`), { context });
    const named = programSourceIds(pasted.program);
    const { sources, missing, refused } = await resolveProgramLibrarySources(pasted.program);
    expect([...named].sort())
      .toEqual([...sources.map(source => source.id), ...missing, ...refused].sort());
    expect(named).toContain(`${TAO}#41`);
  }, 60_000);
});

/**
 * ONE GATE, TWO DOORS, AND FOR A WHILE ONLY ONE OF THEM WAS A GATE.
 *
 * `parseCuratorPaste` routed `rise.agent-operation-set.v1` to
 * `validateAgentOperationSet(parsed)` with the context dropped, so an
 * operation set met no membership check, no budget and no ceiling. Every one
 * of the four extent verdicts §13 calls load-bearing collapsed into a single
 * unloadable at the reading — and one of them arrived with prose that was
 * false about the work.
 */
describe('an operation set meets the gate a score meets', () => {
  const operations = (sourceId) => JSON.stringify({
    schema: 'rise.agent-operation-set.v1',
    id: 'ops-1',
    projectId: 'project-1',
    baseRevision: 0,
    operations: [{ op: 'add-source', id: 'op-1', sourceId }]
  });

  const THROUGH_BOTH = [
    ['no-such-work', 'PROGRAM_IO_UNKNOWN_SOURCE'],
    ['spoon-river-anthology#900', 'PROGRAM_IO_UNKNOWN_DIVISION'],
    ['spoon-river-anthology#50:37', 'PROGRAM_IO_EXTENT_FLOOR'],
    [`${TAO}#0`, 'PROGRAM_IO_EXTENT_GRAMMAR']
  ];

  for (const [sourceId, code] of THROUGH_BOTH) {
    it(`reaches the same verdict for ${sourceId} through either door`, () => {
      const context = roomContext(20_000);
      expect(refuse(score([sourceId]), context)?.code,
        `the program door refused ${sourceId} differently`).toBe(code);
      expect(refuse(operations(sourceId), context)?.code,
        `the operations door refused ${sourceId} differently`).toBe(code);
    });
  }

  it('keeps the four verdicts apart rather than bucketing them', () => {
    const context = roomContext(20_000);
    const codes = THROUGH_BOTH.map(([sourceId]) => refuse(operations(sourceId), context).code);
    expect(new Set(codes).size).toBe(4);
  });

  it('spends the reader\'s length on the works an operation set would admit', () => {
    // 315,261 words behind one line reading `add-source — proposed ·
    // middlemarch`, against a length of 200.
    expect(refuse(operations('middlemarch'), roomContext(200)).code)
      .toBe('PROGRAM_IO_ATOM_CEILING');
    expect(refuse(operations(TAO), roomContext(200)).code)
      .toBe('PROGRAM_IO_BUDGET_EXCEEDED');
    expect(() => parseCuratorPaste(operations(`${TAO}#40`), { context: roomContext(200) }))
      .not.toThrow();
  });

  it('loads exactly the ids it measured', async () => {
    const context = roomContext(20_000);
    const pasted = parseCuratorPaste(operations(`${TAO}#40`), { context });
    const { sources } = await resolveOperationLibrarySources(pasted.operationSet);
    expect(sources.map(source => source.id)).toEqual([`${TAO}#40`]);
  }, 60_000);
});

/**
 * A SUB-FLOOR ASK MAY NOT SHADOW EXISTENCE.
 *
 * `parseLibraryExtent` is a string reader: it can see that `:39` is under the
 * floor and it cannot see whether the work, the division or its text exists.
 * Judging FLOOR before asking the shelf let a fact about the cut speak for
 * facts nobody had established — `no-such-work-at-all#5:20` and
 * `sacred-tao-te-ching#900:39` were both refused below-floor, and the wording
 * of that refusal instructs the curator to name `sacred-tao-te-ching#900`
 * instead, which is a chapter the Tao does not have. The same ids spelled
 * `:200` were correctly absent and correctly no-such-division, so which of
 * §13's four extent statuses a script learned turned on the `:N`.
 *
 * The resolver was fixed a pass before the gate was, so for a while the two
 * doors disagreed about the same id. THE GATE'S EXPECTED CODE IS DERIVED FROM
 * THE READING'S OWN VERDICT rather than written out twice: neither side can be
 * changed alone without this saying so.
 */
describe('the gate and the reading agree about which refusal it is', () => {
  /** What the resolver puts an id into, in its own vocabulary. */
  async function atTheReading(id) {
    const { sources, missing, refused, reasons } = await resolveLibrarySourceIds([id]);
    if (sources.length) return 'loaded';
    if (missing.includes(id)) return 'absent';
    if (refused.includes(id)) return reasons[id];
    return 'nothing at all';
  }

  /** The refusal the gate owes for each verdict the reading can reach. */
  const GATE_OWES = Object.freeze({
    loaded: null,
    absent: 'PROGRAM_IO_UNKNOWN_SOURCE',
    [LIBRARY_LOAD_REFUSAL.NO_DIVISION]: 'PROGRAM_IO_UNKNOWN_DIVISION',
    [LIBRARY_LOAD_REFUSAL.FLOOR]: 'PROGRAM_IO_EXTENT_FLOOR',
    [LIBRARY_LOAD_REFUSAL.GRAMMAR]: 'PROGRAM_IO_EXTENT_GRAMMAR'
  });

  /**
   * Each sub-floor ask beside the same id spelled `:200`. The PAIR is the
   * finding: a guard on the sub-floor ask alone would pass on a gate that got
   * both of them wrong in the same way.
   */
  const PAIRS = Object.freeze([
    ['no-such-work-at-all#5:20', 'no-such-work-at-all#5:200'],
    [`${TAO}#900:39`, `${TAO}#900:200`],
    ['oedipus-rex#2:20', 'oedipus-rex#2:200'],
    ['spoon-river-anthology#50:37', 'spoon-river-anthology#50:200']
  ]);

  for (const id of PAIRS.flat()) {
    it(`reaches the reading's own verdict for ${id}`, async () => {
      const context = roomContext(20_000);
      const verdict = await atTheReading(id);
      expect(Object.hasOwn(GATE_OWES, verdict),
        `the reading answered "${verdict}", which no gate refusal is mapped to`).toBe(true);
      expect(refuse(score([id]), context)?.code ?? null,
        `the gate and the reading disagree about ${id}`).toBe(GATE_OWES[verdict]);
    }, 60_000);
  }

  it('is not reaching agreement by answering alike', async () => {
    // Four distinct verdicts across the eight ids, so a door that bucketed
    // them — which is exactly what judging the floor first did — cannot pass
    // the guards above by accident.
    const verdicts = [];
    for (const id of PAIRS.flat()) verdicts.push(await atTheReading(id));
    expect(new Set(verdicts).size).toBe(4);
  }, 120_000);

  it('tells a floor refusal how many divisions the work has', () => {
    // The same root, smaller: `divisionCount` was null on every floor refusal
    // while the same id at `:200` reported it, so the reader was given the
    // count where it does not matter and denied it where it does.
    const context = roomContext(20_000);
    let details = null;
    try {
      parseCuratorPaste(score(['spoon-river-anthology#50:37']), { context });
    } catch (error) {
      details = error.details;
    }
    expect(details?.divisionCount)
      .toBe(catalogueFor(context, 'spoon-river-anthology').divisions.count);
  });
});

/**
 * A REFUSAL MAY NOT STATE A FACT THAT IS NOT SO.
 *
 * `describeImportFailure`'s unloadable branch re-parsed the refused id and
 * switched on `extent.words` — which `parseLibraryExtent` nulls for a cut
 * below the floor — so a floor refusal was indistinguishable from a division
 * holding no text, and the reader of `spoon-river-anthology#50:37` was told
 * "The work is here; this edition yields no text for division 50." Division
 * 50 exists and has text. That is a substitute offered where an absence was
 * required, written by the function that owns the wording.
 */
describe('the reason a work would not load is carried, not inferred', () => {
  const unloadable = (id, reason) => describeImportFailure(
    unloadableLibrarySourcesError({ unreadable: [id], reasons: { [id]: reason } }),
    { context: roomContext(20_000) }
  );

  it('gives every reason the resolver can report a sentence of its own', () => {
    const said = new Map();
    for (const reason of Object.values(LIBRARY_LOAD_REFUSAL)) {
      const text = unloadable('spoon-river-anthology#50:37', reason);
      expect(text, `${reason} reaches the reader with no account of why`)
        .not.toMatch(/no account of why/u);
      said.set(reason, text);
    }
    // And they are not one sentence wearing eight labels.
    expect(new Set(said.values()).size).toBe(Object.values(LIBRARY_LOAD_REFUSAL).length);
  });

  it('says the gap rather than the nearest plausible sentence', () => {
    // The failing input, constructed. A reason this build has no wording for
    // must not borrow one.
    expect(unloadable('spoon-river-anthology#50:37', 'invented-today'))
      .toMatch(/no account of why \(invented-today\)/u);
  });

  it('does not tell a below-floor cut that its division holds no text', () => {
    const floor = unloadable('spoon-river-anthology#50:37', LIBRARY_LOAD_REFUSAL.FLOOR);
    expect(floor).toMatch(new RegExp(`${EXTENT_MIN_WORDS} words`, 'u'));
    expect(floor).toMatch(/division itself is here and has text/u);
    expect(floor).not.toMatch(/yields no text/u);
    // And the refusal that IS about a division with no text still says so.
    expect(unloadable('spoon-river-anthology#50', LIBRARY_LOAD_REFUSAL.EMPTY_DIVISION))
      .toMatch(/yields no text/u);
  });

  it('does not print a broken id as the title of a work', () => {
    const grammar = unloadable(`${TAO}#0`, LIBRARY_LOAD_REFUSAL.GRAMMAR);
    // It used to read `sacred-tao-te-ching#0 — sacred-tao-te-ching#0` above
    // "This work is in the catalogue" — it is not a work and it is not in the
    // catalogue.
    expect(grammar).not.toContain(`${TAO}#0 — `);
    expect(grammar).not.toMatch(/in the catalogue/u);
    expect(grammar).toMatch(/names no work/u);
  });

  it('is the reason the resolver actually reports', async () => {
    // The vocabulary is only worth anything if the resolver speaks it.
    const { refused, reasons } = await resolveLibrarySourceIds([
      'ulysses#18:200', `${TAO}#0`, 'spoon-river-anthology#50:37', `${TAO}#900`
    ]);
    expect([...refused].sort()).toEqual([
      `${TAO}#0`, `${TAO}#900`, 'spoon-river-anthology#50:37', 'ulysses#18:200'
    ].sort());
    expect(reasons['ulysses#18:200']).toBe(LIBRARY_LOAD_REFUSAL.NO_BOUNDARY);
    expect(reasons[`${TAO}#0`]).toBe(LIBRARY_LOAD_REFUSAL.GRAMMAR);
    expect(reasons['spoon-river-anthology#50:37']).toBe(LIBRARY_LOAD_REFUSAL.FLOOR);
    expect(reasons[`${TAO}#900`]).toBe(LIBRARY_LOAD_REFUSAL.NO_DIVISION);
  }, 180_000);
});

/**
 * THE GATE REFUSES AND NEVER REPAIRS.
 *
 * `EXTENT_PATTERN`'s `(\d+)` accepted leading zeros and `Number()` normalised
 * them, so `#0` was refused as grammar while `#0040` was silently corrected
 * to 40. Two things followed: the gate rewrote a model's output, and
 * `PROGRAM_SOURCE_OWNERSHIP` — which refuses one source named by two
 * movements — was defeated by a spelling, so the reader heard Chapter XL
 * twice under different movement titles.
 */
describe('a malformed ordinal is refused, not corrected', () => {
  const twoSpellings = JSON.stringify({
    schema: 'rise.experience-program.v1',
    id: 'octal-canto',
    authority: 'proposed',
    editable: true,
    tracks: [{
      id: 'movements',
      kind: 'movement',
      clips: [
        {
          id: 'm1',
          anchor: { sourceIds: [`${TAO}#0040`] },
          data: { index: 0, title: 'Chapter forty, spelled oddly' }
        },
        {
          id: 'm2',
          anchor: { sourceIds: [`${TAO}#40`] },
          data: { index: 1, title: 'Chapter forty again' }
        }
      ]
    }]
  });

  it('refuses a leading zero in the ordinal', () => {
    const refusal = refuse(score([`${TAO}#0040`]), roomContext(20_000));
    expect(refusal.code).toBe('PROGRAM_IO_EXTENT_GRAMMAR');
    expect(refusal.text).toContain(`${TAO}#0040`);
    expect(refusal.text).toMatch(/leading zeros/u);
  });

  it('refuses a leading zero in the length as well', () => {
    expect(refuse(score([`${TAO}#40:0200`]), roomContext(20_000)).code)
      .toBe('PROGRAM_IO_EXTENT_GRAMMAR');
  });

  it('does not let a spelling defeat one-source-one-movement', () => {
    // The score reads Chapter XL twice, under two titles, and used to be
    // admitted because the two ids were not equal as strings.
    expect(refuse(twoSpellings, roomContext(20_000))).toBeTruthy();
  });

  it('still admits the ordinals a curator is taught to write', () => {
    const context = roomContext(20_000);
    for (const id of [TAO, `${TAO}#40`, `${TAO}#40:200`, `${TAO}#1`]) {
      expect(() => parseCuratorPaste(score([id]), { context }), id).not.toThrow();
    }
  });
});

/**
 * SIXTY-FIVE SOURCES WAS AN EXCEPTION WITH A JSON PATH IN IT.
 *
 * Nothing at the gate counted sources, so 65 chapters of the Tao — 8,456
 * words against a 20,000 budget — passed `examine` and threw at the reading
 * with `A Workshop project accepts at most 64 sources ($.sources)`, in a room
 * whose §10b ruling is that the reader never passes through the Workshop.
 */
describe('a reading holds so many works and no more', () => {
  const chapters = (count) => {
    const ids = Array.from({ length: count }, (unused, index) => `${TAO}#${index + 1}`);
    return JSON.stringify({
      schema: 'rise.experience-program.v1',
      id: `chapters-${count}`,
      authority: 'proposed',
      editable: true,
      tracks: [{
        id: 'movements',
        kind: 'movement',
        clips: [
          { id: 'm1', anchor: { sourceIds: ids.slice(0, 32) }, data: { index: 0, title: 'A' } },
          { id: 'm2', anchor: { sourceIds: ids.slice(32) }, data: { index: 1, title: 'B' } }
        ]
      }]
    });
  };

  it('refuses one more than it holds, at the gate', () => {
    const refusal = refuse(chapters(READING_LIMITS.maxSources + 1), roomContext(20_000));
    // ITS OWN CODE, not the word ceiling's. 8,456 words against a 20,000
    // budget is not "longer than one session can hold" in any sense the
    // reader would recognise, and the fix — name the work once instead of
    // sixty-five times — is not the fix for a score that is too long. §13
    // gives this status 43 for that reason.
    expect(refusal.code).toBe('PROGRAM_IO_SOURCE_CEILING');
    expect(refusal.text).toContain(`names ${READING_LIMITS.maxSources + 1} sources`);
    expect(refusal.text).toContain(`holds ${READING_LIMITS.maxSources}`);
    // The reader never passes through the Workshop, so the reply may not
    // mention it — nor a JSON path, nor an internal schema.
    expect(refusal.text).not.toMatch(/Workshop/u);
    expect(refusal.text).not.toMatch(/\$\.sources/u);
  });

  it('admits exactly as many as it holds', () => {
    // A ceiling tested only from above is a ceiling that may sit one too low,
    // and this one governs an ordinary score rather than an exotic one.
    expect(() => parseCuratorPaste(chapters(READING_LIMITS.maxSources),
      { context: roomContext(20_000) })).not.toThrow();
  });
});

/**
 * THE DERIVATION STOPPED AT TEXT.
 *
 * `programSourceIds` made the SOURCE check one function the budget spends and
 * the resolver walks, and eleven smuggling attempts against it failed. Nothing
 * else a document may name was derived at all: a collection, an engine, a
 * field renderer, a soundscape, a tone preset, a personal swell and a
 * narration voice were six hand-written loops inside
 * `assertProgramWithinContext`, and the operations door consulted none of
 * them — on the strength of a comment claiming an operation set "names no
 * collections, engines or soundscapes of its own".
 *
 * What that bought, measured through this same door:
 *
 *   a soundscape nobody offers   34 at one door,  ACCEPTED at the other
 *   a tone preset nobody offers  34 at one door,  ACCEPTED at the other
 *   a personal swell nobody has  34 at one door,  ACCEPTED and FABRICATED
 *   a narration voice nobody has ACCEPTED at both, and undescribed by either
 *
 * So the families are one table (`CAPABILITY_FAMILIES`), both doors enumerate
 * into one shape, and this drives an invented id through every family at both
 * doors and requires the SAME refusal from each. A family with no check is a
 * failing test rather than an accepted score.
 */
describe('every capability family is refused the same way at both doors', () => {
  const context = () => roomContext(20_000);
  const INVENTED = 'no-such-capability-anywhere';

  const operations = (ops) => JSON.stringify({
    schema: 'rise.agent-operation-set.v1',
    id: 'ops-capability',
    projectId: 'project-1',
    baseRevision: 0,
    operations: [
      { op: 'add-source', id: 'op-source', sourceId: `${TAO}#40` },
      ...ops
    ]
  });

  const scored = (tracks) => JSON.stringify({
    schema: 'rise.experience-program.v1',
    id: 'a-capability',
    authority: 'proposed',
    editable: true,
    tracks: [
      {
        id: 'movements',
        kind: 'movement',
        clips: [{
          id: 'm1',
          anchor: { sourceIds: [`${TAO}#40`] },
          data: { index: 0, title: 'Chapter XL' }
        }]
      },
      ...tracks
    ]
  });

  const laneClip = (cue) => ({ id: 'c1', anchor: { sourceIds: [`${TAO}#40`] }, cue });

  /**
   * One row per family in CAPABILITY_FAMILIES. `program` is null where the
   * program validator settles the family on its own before membership is
   * consulted — a field renderer is closed by `PROGRAM_VISUAL_FIELD_RENDERERS`
   * and refused as `PROGRAM_VISUAL_FIELD_RENDERER`, which is a different and
   * earlier verdict. The operations door had no such validator, which is
   * exactly why `surface:<anything>` reached `createEditorAsset`.
   */
  const FAMILIES = Object.freeze([
    {
      family: 'collections',
      program: () => scored([{
        id: 'v', kind: 'visual', fallback: { kind: 'still' },
        clips: [laneClip({ kind: 'sourced', collections: [INVENTED] })]
      }]),
      operations: () => operations([{
        op: 'assign-visual', id: 'op-x', assignmentId: 'v1',
        sourceId: `${TAO}#40`, assetId: `collection:${INVENTED}`
      }])
    },
    {
      family: 'engines',
      program: () => scored([{
        id: 'v', kind: 'visual', fallback: { kind: 'still' },
        clips: [laneClip({ kind: 'procedural', collections: ['klee'], engines: [INVENTED] })]
      }]),
      operations: () => operations([{
        op: 'assign-visual', id: 'op-x', assignmentId: 'v1',
        sourceId: `${TAO}#40`, assetId: `procedural:${INVENTED}`
      }])
    },
    {
      family: 'surfaces',
      program: null,
      operations: () => operations([{
        op: 'assign-visual', id: 'op-x', assignmentId: 'v1',
        sourceId: `${TAO}#40`, assetId: `surface:${INVENTED}`
      }])
    },
    {
      family: 'soundscapes',
      program: () => scored([{
        id: 'a', kind: 'audio', fallback: { kind: 'silence' },
        clips: [laneClip({ kind: 'soundscape', soundscapeId: INVENTED })]
      }]),
      // The same capability by the two spellings an operation has for it.
      operations: () => operations([{
        op: 'set-atmosphere', id: 'op-x', soundscape: INVENTED
      }])
    },
    {
      family: 'tones',
      program: () => scored([{
        id: 'a', kind: 'audio', fallback: { kind: 'silence' },
        clips: [laneClip({ kind: 'tone', presetId: INVENTED })]
      }]),
      operations: () => operations([{
        op: 'set-atmosphere', id: 'op-x', audioPreset: INVENTED
      }])
    },
    {
      family: 'swells',
      program: () => scored([{
        id: 's', kind: 'swell',
        clips: [laneClip({ kind: 'swell', swellId: INVENTED })]
      }]),
      operations: () => operations([{
        op: 'set-atmosphere', id: 'op-x', selectedSwellId: INVENTED
      }])
    },
    {
      family: 'voices',
      program: () => scored([{
        id: 'n', kind: 'narration',
        clips: [laneClip({ kind: 'spoken', voiceId: INVENTED })]
      }]),
      operations: () => operations([{
        op: 'assign-narration', id: 'op-x', assignmentId: 'n1',
        sourceId: `${TAO}#40`, voiceId: INVENTED
      }])
    },
    {
      family: 'assets',
      // A VIDEO CUE, not a `sourced` cue over `sequence-asset:<id>`. The
      // latter is refused as an unknown COLLECTION first, which is true — that
      // is the id's spelling in the document — and would prove nothing about
      // the asset family.
      program: () => scored([{
        id: 'v', kind: 'visual', fallback: { kind: 'still' },
        clips: [laneClip({
          kind: 'video', assetId: INVENTED, timeMode: 'loop',
          audioPolicy: 'muted', reducedMotion: 'poster'
        })]
      }]),
      operations: () => operations([{
        op: 'import-asset', id: 'op-x', assetId: INVENTED
      }])
    }
  ]);

  it('leaves no family of CAPABILITY_FAMILIES untried', () => {
    // A family added to the table with no row here would be a family nothing
    // below proves anything about — the shape of hole this whole block exists
    // to close, one level up.
    expect(Object.keys(CAPABILITY_FAMILIES).sort())
      .toEqual(FAMILIES.map(row => row.family).sort());
  });

  for (const row of FAMILIES) {
    const expected = CAPABILITY_FAMILIES[row.family].code;

    it(`refuses an invented ${row.family.slice(0, -1)} through the operations door`, () => {
      const verdict = refuse(row.operations(), context());
      expect(verdict,
        `an invented ${row.family.slice(0, -1)} was ACCEPTED through the operations door`)
        .toBeTruthy();
      expect(verdict.code).toBe(expected);
      // And the reader is told what IS offered, which is the whole of what
      // makes a membership refusal actionable.
      expect(verdict.text.length).toBeGreaterThan(20);
    });

    if (!row.program) continue;

    it(`refuses an invented ${row.family.slice(0, -1)} identically through the program door`, () => {
      expect(refuse(row.program(), context())?.code,
        `the two doors disagree about an invented ${row.family.slice(0, -1)}`)
        .toBe(expected);
    });
  }

  it('admits every family\'s real ids at both doors', () => {
    // A refusal proved only from the refusing side is a refusal that could be
    // "refuse everything". These are ids the context actually offers.
    const ctx = context();
    expect(() => parseCuratorPaste(operations([
      { op: 'set-atmosphere', id: 'op-a',
        soundscape: ctx.audio.soundscapes[0], audioPreset: ctx.audio.tones[0] },
      { op: 'assign-visual', id: 'op-b', assignmentId: 'v1', sourceId: `${TAO}#40`,
        assetId: `collection:${ctx.visuals.collections.find(id => id.startsWith('aic-'))}` },
      { op: 'configure-field', id: 'op-c', assignmentId: 'f1', sourceId: `${TAO}#40`,
        renderer: ctx.visuals.surfaces[0] },
      { op: 'assign-narration', id: 'op-d', assignmentId: 'n1', sourceId: `${TAO}#40`,
        voiceId: ctx.audio.voices[0] }
    ]), { context: ctx })).not.toThrow();
  });

  /**
   * THE CAPABILITY DOCUMENT HAS TO DESCRIBE WHAT THE GATE CHECKS.
   *
   * A gate checking against a list the composer was never given is a gate that
   * refuses on a rule nobody could have followed. The context carried NO voice
   * list at all, so a model could not name a real voice on purpose and every
   * one it invented was admitted; the three field renderers had been closed by
   * the program validator since it existed and were offered nowhere.
   */
  it('offers every family it checks, and describes each id', () => {
    // Swells and assets are the READER'S OWN, so a document exports them only
    // when the reader brought some — which is why this asks a surface that
    // has. Every other family is RISE's and rides in every document.
    const ctx = exportCuratorContext({
      id: 'a-reader-who-brought-things',
      sources: [],
      includeLibrary: true,
      swells: [{ id: 'swell_1_mine', name: 'Rain on the window' }],
      assets: [{ id: 'asset-1', name: 'cliff.png', kind: 'image', mimeType: 'image/png' }],
      constraints: { targetWords: 20_000 }
    });
    for (const [family, rule] of Object.entries(CAPABILITY_FAMILIES)) {
      expect((rule.offered(ctx) || []).length,
        `the gate checks ${family} against a list the document does not carry`)
        .toBeGreaterThan(0);
    }
    // An unbuilt voice is silence wearing a name, so the list is what is BUILT.
    expect(ctx.audio.voices).toEqual(availableVoicePacks().map(pack => pack.id));
    expect(ctx.visuals.surfaces).toEqual([...PROGRAM_VISUAL_FIELD_RENDERERS]);
    for (const id of ctx.audio.voices) {
      expect(ctx.catalog.voices[id]?.kind, `${id} reaches the model as a bare id`)
        .toBe('narration-voice');
    }
  });
});

/**
 * WHICH FIELDS OF AN OPERATION NAME SOMETHING THE READER WAS OFFERED.
 *
 * The table above proves each family is checked. It cannot prove that a field
 * added to `OP_FIELDS` tomorrow reaches a family at all — and that is the
 * defect exactly: `soundscape`, `audioPreset` and `selectedSwellId` were
 * declared legal fields, validated as ids, and written into the project's
 * reading defaults without one of them ever being compared to anything.
 *
 * So the field list is read out of the validator and every field must be
 * either enumerated by `operationSetCapabilities` (via
 * `OPERATION_CAPABILITY_FIELDS`) or named below as a field that names nothing
 * offered, with a reason. A new capability-bearing field arrives here.
 */
describe('no field of an operation can name a capability unread', () => {
  const NAMES_NOTHING_OFFERED = Object.freeze({
    id: 'the author\'s own label for the operation, unique within the set',
    rationale: 'free prose that never enters the Experience Program',
    op: 'the operation itself, closed against AGENT_OPERATION_OPS',
    assignmentId: 'the author\'s own label for the span',
    requestId: 'the author\'s own label for an acquisition request',
    transitionId: 'the author\'s own label; create/revise-transition are refused outright',
    fromMovementId: 'names a movement of this same document, not a capability',
    toMovementId: 'the same',
    visualAssignmentId: 'names a span this same set created',
    audioAssignmentId: 'the same',
    syncGroup: 'the author\'s own name for a pairing',
    division: 'refused outright — an extent rides in the source id (AGENT_OP_DIVISION)',
    fromCharacter: 'a coordinate in the source text',
    toCharacter: 'a coordinate in the source text',
    quoteStart: 'a phrase located in the source text, not an id',
    quoteEnd: 'the same',
    anchor: 'a record of the four fields above',
    overlap: 'closed to reject | replace by the validator',
    cue: 'a pace or visual cue whose own ids the program validator settles',
    kind: 'closed to the six asset kinds by the validator',
    query: 'free prose describing what to acquire',
    duck: 'a bed-ducking envelope; narration.js closes its target',
    pronunciations: 'spoken forms of words in the source text',
    words: 'timings for words in the source text',
    fromMs: 'a preview boundary in milliseconds',
    toMs: 'the same',
    tier: 'closed to draft | final by the validator'
  });

  const DECLARED_FIELDS = (() => {
    const source = readFileSync(join(process.cwd(), 'src/core/agent-operations.js'), 'utf8');
    const body = source.slice(source.indexOf('const OP_FIELDS = Object.freeze({'));
    const table = body.slice(0, body.indexOf('\n});'));
    return new Set([
      ...[...table.matchAll(/'([A-Za-z]+)'/gu)].map(match => match[1]),
      ...[...source.matchAll(/const COMMON_OP_FIELDS = new Set\(\[([^\]]*)\]\)/gu)]
        .flatMap(match => [...match[1].matchAll(/'([A-Za-z]+)'/gu)].map(found => found[1]))
    ]);
  })();

  it('reads the field vocabulary out of the validator', () => {
    // If this ever stops finding fields, everything below passes vacuously.
    expect(DECLARED_FIELDS.size).toBeGreaterThan(20);
    expect(DECLARED_FIELDS.has('soundscape')).toBe(true);
    expect(DECLARED_FIELDS.has('voiceId')).toBe(true);
  });

  it('routes every field to a family or excuses it here', () => {
    for (const field of DECLARED_FIELDS) {
      // Operation NAMES are also matched by the pattern above; they are not
      // fields and each is already closed by AGENT_OPERATION_OPS.
      if (AGENT_OPERATION_OPS.includes(field)) continue;
      if (OPERATION_CAPABILITY_FIELDS[field]) continue;
      expect(NAMES_NOTHING_OFFERED[field],
        `an operation may carry "${field}" and nothing says whether it names a `
        + 'capability. Add it to OPERATION_CAPABILITY_FIELDS so the gate checks '
        + 'it, or give a reason here for why it names nothing the reader was '
        + 'offered.').toBeTypeOf('string');
    }
  });

  it('leaves no excuse standing for a field that is gone', () => {
    for (const field of Object.keys(NAMES_NOTHING_OFFERED)) {
      expect(DECLARED_FIELDS.has(field),
        `"${field}" is excused here and no operation carries it any more`).toBe(true);
    }
    for (const field of Object.keys(OPERATION_CAPABILITY_FIELDS)) {
      expect(DECLARED_FIELDS.has(field),
        `"${field}" is routed to a family and no operation carries it`).toBe(true);
      expect(NAMES_NOTHING_OFFERED[field],
        `"${field}" is both routed to a family and excused as naming nothing`)
        .toBeUndefined();
    }
  });
});

/**
 * A MUSEUM COLLECTION COULD NOT BE SCORED THROUGH THE OPERATIONS DOOR.
 *
 * `visualAssetFor` tested `context.visuals.collections.includes(assetId)`
 * BEFORE the `aic-` branch, and every museum id is in that list — so the
 * `aic-` branch was dead code for every id the context offered. `aic-ukiyoe`
 * yielded `{kind:"procedural"}` where `collection:aic-ukiyoe` yielded
 * `{kind:"sourced"}`, and only the sourced branch arms the image pools
 * downstream. The reader asked for ukiyo-e prints and got a generated field
 * pointed at a pool that is not one, under "Nothing refused."
 *
 * The curator prompt names `aic-` twelve times and `collection:` zero, so the
 * spelling that failed was the only spelling a model was taught.
 */
describe('a museum collection is scored as a collection', () => {
  const MUSEUM = 'aic-ukiyoe';
  const source = {
    id: `${TAO}#40`,
    name: 'Chapter XL',
    data: 'Returning is the movement of the Tao. Yielding is the way of the Tao.'
  };

  const applyVisual = (assetId) => {
    const context = roomContext(20_000);
    const operationSet = {
      schema: 'rise.agent-operation-set.v1',
      id: 'ops-museum',
      projectId: 'project-1',
      baseRevision: 0,
      operations: [
        { op: 'add-source', id: 'op-1', sourceId: source.id },
        { op: 'assign-visual', id: 'op-2', assignmentId: 'v1', sourceId: source.id, assetId }
      ]
    };
    parseCuratorPaste(JSON.stringify(operationSet), { context });
    const applied = applyAgentOperationSet({
      operationSet, context, resolvedSources: { [source.id]: source }
    });
    return applied.project.experienceProgram.tracks
      .find(track => track.kind === 'visual').clips[0].cue;
  };

  it('reaches the same cue by the bare id and the prefixed one', () => {
    const bare = applyVisual(MUSEUM);
    expect(bare.kind,
      `${MUSEUM} built a procedural field: the aic- branch is dead code again`)
      .toBe('sourced');
    expect(bare.collections).toEqual([MUSEUM]);
    expect(applyVisual(`collection:${MUSEUM}`)).toEqual(bare);
  });

  it('is the spelling the prompt teaches', () => {
    // The prompt names `aic-` throughout, so the id a model actually writes is
    // the bare one — which is the reason this mattered rather than a curiosity.
    const prompt = readFileSync(join(process.cwd(), 'src/core/curator-prompt.js'), 'utf8');
    expect(prompt).toMatch(/aic-/u);
  });

  it('still tells a procedural pool from a collection', () => {
    // The fix is an ORDER, and an order can be got wrong the other way.
    expect(applyVisual('procedural:klee').kind).toBe('procedural');
    expect(applyVisual('klee').kind).toBe('procedural');
  });

  /**
   * THE BACKSTOP, HELD FROM THE SIDE THE GATE CANNOT REACH.
   *
   * The gate refuses an unoffered field renderer at `examine`, which is where
   * the Scriptorium meets one. A Workshop caller applies an operation set with
   * no capability document at all, and there `surface:<anything>` went
   * straight into `createEditorAsset` — refused as EDITOR_ASSET_CUE_KIND, with
   * `$.cueTemplate.kind` quoted at whoever was looking. A check nothing
   * exercises is decoration, so this drives the producer directly.
   */
  it('refuses an unoffered renderer in the producer, with no context at all', () => {
    const run = (assetId) => applyAgentOperationSet({
      operationSet: {
        schema: 'rise.agent-operation-set.v1',
        id: 'ops-surface', projectId: 'project-1', baseRevision: 0,
        operations: [
          { op: 'add-source', id: 'op-1', sourceId: source.id },
          { op: 'assign-visual', id: 'op-2', assignmentId: 'v1', sourceId: source.id, assetId }
        ]
      },
      resolvedSources: { [source.id]: source }
    });

    let refusal = null;
    try {
      run('surface:not-a-renderer');
    } catch (error) {
      refusal = error;
    }
    expect(refusal, 'surface:not-a-renderer built an editor asset').toBeTruthy();
    expect(refusal.code).toBe('AGENT_OP_SURFACE');
    // The path names the operation, not an object the caller never wrote.
    expect(refusal.path).toContain('$.operations[id=op-2]');
    expect(refusal.path).not.toContain('cueTemplate');
    expect(refusal.details.offered).toEqual([...PROGRAM_VISUAL_FIELD_RENDERERS]);

    // And each of the three it does offer still builds its field.
    for (const renderer of PROGRAM_VISUAL_FIELD_RENDERERS) {
      const cue = run(`surface:${renderer}`).project.experienceProgram.tracks
        .find(track => track.kind === 'visual').clips[0].cue;
      expect(cue).toMatchObject({ kind: 'field', renderer });
    }
  });
});

/**
 * A SWELL THAT DOES NOT EXIST IS ABSENT, NOT INVENTED.
 *
 * `audioScoreAssetFromId` ended `personalSwells.find(...) || { id: swellId,
 * name: 'Personal audio' }`. That is a repair rather than an omission, and it
 * broke two laws on one line: the gate rewrote what it was handed, and it
 * offered a substitute where an absence was required.
 */
describe('a personal swell is not fabricated', () => {
  const RECORDING = Object.freeze({ id: 'swell_1_mine', name: 'Rain on the window' });

  it('returns nothing for a recording nobody holds', () => {
    expect(audioScoreAssetFromId('swell:ghost', [RECORDING])).toBeNull();
    expect(audioScoreAssetFromId('swell:ghost', [])).toBeNull();
    // And the reader's own is still resolved, under the reader's own name.
    expect(audioScoreAssetFromId(`swell:${RECORDING.id}`, [RECORDING]))
      .toMatchObject({ name: RECORDING.name });
  });

  it('does not throw when the shelf is not an array', () => {
    // `.map(audioScoreAssetFromId)` passes the index as the second argument,
    // so a swell there did not fabricate — it threw.
    expect(['swell:ghost', 'tone:focus'].map(audioScoreAssetFromId).filter(Boolean))
      .toHaveLength(1);
  });

  it('refuses it at the gate rather than at the reading', () => {
    const verdict = refuse(JSON.stringify({
      schema: 'rise.agent-operation-set.v1',
      id: 'ops-swell',
      projectId: 'project-1',
      baseRevision: 0,
      operations: [
        { op: 'add-source', id: 'op-1', sourceId: `${TAO}#40` },
        { op: 'assign-audio', id: 'op-2', assignmentId: 'a1',
          sourceId: `${TAO}#40`, assetId: 'swell:ghost' }
      ]
    }), roomContext(20_000));
    expect(verdict.code).toBe('PROGRAM_IO_UNKNOWN_SWELL');
  });
});

/**
 * AN OPERATION SET THAT NAMES NO TEXT REACHED "Ready to read."
 *
 * §13 gives 51 to "there is no reading here" and the program door enforced it
 * alone. Three shapes got past the operations door with `project.sources`
 * empty, and the add-then-remove one is what a model does when it changes its
 * mind mid-proposal — invisible to any check that only reads which ids
 * `add-source` names.
 */
describe('an operation set has to leave something to read', () => {
  const operations = (ops) => JSON.stringify({
    schema: 'rise.agent-operation-set.v1',
    id: 'ops-empty',
    projectId: 'project-1',
    baseRevision: 0,
    operations: ops
  });

  const EMPTY = Object.freeze([
    ['set-atmosphere alone', [
      { op: 'set-atmosphere', id: 'op-1', soundscape: 'aurora' }
    ]],
    ['request-asset alone', [
      { op: 'request-asset', id: 'op-1', requestId: 'r1', kind: 'image', query: 'a cliff' }
    ]],
    ['add-source then remove-source', [
      { op: 'add-source', id: 'op-1', sourceId: `${TAO}#40` },
      { op: 'remove-source', id: 'op-2', sourceId: `${TAO}#40` }
    ]]
  ]);

  for (const [what, ops] of EMPTY) {
    it(`refuses ${what}`, () => {
      const verdict = refuse(operations(ops), roomContext(20_000));
      expect(verdict, `${what} reached the reading with nothing in it`).toBeTruthy();
      expect(verdict.code).toBe('PROGRAM_IO_NO_LIBRARY_SOURCES');
      // §13 says 51 is a verdict about the document. It used to arrive as a
      // fault in RISE, three functions later, inside measureReading.
      expect(verdict.text).not.toMatch(/fault in RISE/u);
    });
  }

  it('admits the same operations when one work is left standing', () => {
    expect(() => parseCuratorPaste(operations([
      { op: 'add-source', id: 'op-1', sourceId: `${TAO}#40` },
      { op: 'add-source', id: 'op-2', sourceId: `${TAO}#41` },
      { op: 'remove-source', id: 'op-3', sourceId: `${TAO}#41` },
      { op: 'set-atmosphere', id: 'op-4', soundscape: 'aurora' }
    ]), { context: roomContext(20_000) })).not.toThrow();
  });

  it('lets a surface that already holds text propose atmosphere alone', () => {
    // In the Workshop the project's own sources ride in the context, so an
    // operation set that only changes the bed is an ordinary thing to send.
    const context = exportCuratorContext({
      id: 'workshop-like',
      sources: [{ id: 'held', name: 'Held', data: 'Some text already in the project.' }],
      includeLibrary: true,
      constraints: { targetWords: 20_000 }
    });
    expect(() => parseCuratorPaste(operations([
      { op: 'set-atmosphere', id: 'op-1', soundscape: 'aurora' }
    ]), { context })).not.toThrow();
  });
});

describe('an operation names its extent the way a score does', () => {
  it('refuses the division field that nothing read', () => {
    // ACCEPTED, and then it loaded the whole 10,321-word book with division
    // metadata null. The reader asked for a 38-word chapter.
    const context = roomContext(20_000);
    const operations = (addSource) => JSON.stringify({
      schema: 'rise.agent-operation-set.v1',
      id: 'ops-1',
      projectId: 'project-1',
      baseRevision: 0,
      operations: [{ op: 'add-source', id: 'op-1', ...addSource }]
    });

    const refusal = refuse(operations({ sourceId: TAO, division: 40 }), context);
    expect(refusal.code).toBe('AGENT_OP_DIVISION');
    expect(refusal.text).toContain(`${TAO}#40`);

    // The id the refusal points at is the one that works. It is stated, not
    // substituted: rewriting a model's output is what this doorway refuses.
    expect(() => parseCuratorPaste(operations({ sourceId: `${TAO}#40` }), { context }))
      .not.toThrow();
  });
});
