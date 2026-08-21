/**
 * WHAT THE VERDICT IS, AND THAT BOTH DOORS REACH IT.
 *
 * Two claims, and the table below has to make both. It made only the second
 * for a pass: sixteen inputs were driven through the room and through argv and
 * the two verdicts compared field by field, with no expected code anywhere.
 * That cannot fail at the gate. Both surfaces call the same
 * `ScriptoriumSession.examine`, so agreement between them is a fact about
 * function calls — the red team's proof was a passing run of this very table
 * in which all three doors admitted a 315,299-word score against a 200-word
 * budget, agreeing perfectly on the wrong answer.
 *
 * So every case now carries the code it OUGHT to produce and the status a
 * shell OUGHT to see, written down independently of the code that produces
 * them. A shared path that is wrong in the same way at every door fails this
 * table, which is the only shape of assertion it can fail. `a score behind a
 * Markdown fence` is the case that says it best: it must be refused
 * `PROGRAM_IO_JSON`, because the gate refuses and never repairs (law 1), and
 * the agreement-only table would have been equally happy if the fence were
 * silently stripped and the score admitted.
 *
 * The agreement claim is still worth making and is still made here — the room
 * is mounted in jsdom and driven the way a reader drives it, argv is driven as
 * a script drives it, and the code, the status and the prose a curator would
 * paste back must be the same. The Library seam is NOT mocked: the gate decides
 * from the catalogue alone, and a stub between the two surfaces would be a stub
 * that could hide a difference.
 *
 * THIS TABLE USED TO HAVE A TWIN. Scriptorium.room.test.js grew an independent
 * verdict table with pinned expectations while this one had none, as a stopgap
 * — one vocabulary in two places (law 5), and the weaker of the two could pass
 * alone. Its cases are folded in here, where they are asserted at both doors
 * instead of one.
 *
 * The rest of this file is the shell itself: strict argv, the exit mapping, and
 * the guard that keeps a new refusal from silently inheriting a status.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import {
  exitStatusForCode,
  parseScriptoriumArgv,
  runScriptoriumCli,
  SCRIPTORIUM_EXIT
} from './scriptorium-cli.js';
import { createScriptoriumSession } from './scriptorium-session.js';
import { describeImportFailure } from './experience-program-io.js';
import { Scriptorium } from '../components/Scriptorium.js';
import { MAX_SAFE_TARGET_WORDS } from './reading-limits.js';
import { CURATOR_CONTEXT_SCHEMA } from './curator-context.js';

const TAO = 'sacred-tao-te-ching';

const movements = (sourceIds) => ({
  id: 'movements',
  kind: 'movement',
  clips: sourceIds.map((sourceId, index) => ({
    id: `m${index + 1}`,
    anchor: { sourceIds: [sourceId] },
    data: { index, title: sourceId }
  }))
});

const scoreOf = (tracks, extra = {}) => JSON.stringify({
  schema: 'rise.experience-program.v1',
  id: 'a-reading',
  authority: 'proposed',
  editable: true,
  tracks,
  ...extra
});

const score = (sourceIds, id = 'a-reading') => JSON.stringify({
  schema: 'rise.experience-program.v1',
  id,
  authority: 'proposed',
  editable: true,
  tracks: [movements(sourceIds)]
});

/** One movement per division, so the count is the thing under test. */
const chapters = (count) => scoreOf([{
  id: 'movements',
  kind: 'movement',
  clips: [
    {
      id: 'm1',
      anchor: {
        sourceIds: Array.from({ length: 32 }, (unused, index) => `${TAO}#${index + 1}`)
      },
      data: { index: 0, title: 'A' }
    },
    {
      id: 'm2',
      anchor: {
        sourceIds: Array.from({ length: count - 32 },
          (unused, index) => `${TAO}#${index + 33}`)
      },
      data: { index: 1, title: 'B' }
    }
  ]
}]);

/** A transition clip's anchor carries source ids of its own. */
const transitionNaming = (sourceId) => ({
  id: 'transitions',
  kind: 'transition',
  clips: [{
    id: 't1',
    anchor: { sourceIds: [sourceId], afterSourceId: `${TAO}#40` },
    data: { fromMovementId: 'm1' },
    durationMs: 1_000
  }]
});

/** argv in, one JSON object and an exit status out. Nothing spawned. */
async function cli(argv, text = null) {
  const lines = [];
  const errors = [];
  const status = await runScriptoriumCli(argv, {
    out: (line) => lines.push(line),
    err: (line) => errors.push(line),
    readTextFile: () => {
      if (text === null) throw new Error('no such file');
      return text;
    }
  });
  const stdout = lines.join('\n');
  let payload = null;
  if (argv.includes('--json')) {
    try {
      payload = JSON.parse(stdout);
    } catch { /* asserted on by the caller when it matters */ }
  }
  return { status, stdout, stderr: errors.join('\n'), payload };
}

describe('the CLI and the room reach the same verdict', () => {
  let container;
  let room;

  beforeEach(() => {
    localStorage.clear();
    global.URL.createObjectURL = vi.fn(() => 'blob:scriptorium/x');
    global.URL.revokeObjectURL = vi.fn();
    container = document.createElement('div');
    room = new Scriptorium(container, {
      onNavigate: vi.fn(),
      onCreateSession: vi.fn()
    });
    room.mount();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Exactly the reader's gestures: move the length, paste, press Examine. */
  const throughTheRoom = (text, length) => {
    const slider = container.querySelector('#scriptorium-length');
    slider.value = String(length);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    const field = container.querySelector('#scriptorium-paste');
    field.value = text;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    container.querySelector('[data-action="examine"]').click();
    return room.verdict;
  };

  /**
   * One entry per KIND of verdict the gate can reach from the catalogue alone,
   * with the code and the exit status it OUGHT to produce.
   *
   * `code: null` means accepted, and `exit` is the number a shell sees. Both
   * are written here rather than derived from `exitStatusForCode`, because a
   * table that asked the mapping what the mapping says would pass through any
   * renumbering of it — which is the same trap the agreement-only version of
   * this table fell into one level up.
   *
   * A single accepted score would prove nothing either: two surfaces agree
   * trivially on the happy path, and the interesting question is whether they
   * refuse the same way, with the same words, for the right reason.
   */
  const CASES = [
    { what: 'a division inside the length',
      length: 200, code: null, exit: 0, text: score([`${TAO}#40`]) },
    { what: 'a division opening inside the length',
      length: 20_000, code: null, exit: 0, text: score([`${TAO}#1:200`]) },
    /**
     * THE GATE REFUSES AND NEVER REPAIRS (law 1). A fenced document is not
     * JSON, and stripping the fence would be the room editing a model's output
     * on its behalf. The agreement-only table listed this input and asserted
     * only that both doors said the same thing about it, which was true of
     * "refused" and would have been equally true of "quietly unwrapped".
     */
    { what: 'a score behind a Markdown fence',
      length: 20_000, code: 'PROGRAM_IO_JSON', exit: 20,
      text: `\`\`\`json\n${score([TAO])}\n\`\`\`` },
    { what: 'a document cut off',
      length: 20_000, code: 'PROGRAM_IO_JSON', exit: 20,
      text: score([TAO]).slice(0, -40) },
    { what: 'an empty paste',
      length: 20_000, code: 'PROGRAM_IO_EMPTY', exit: 20, text: '' },
    { what: 'a published score',
      length: 20_000, code: 'PROGRAM_IO_PUBLISHED_REFUSED', exit: 21,
      text: scoreOf([movements([`${TAO}#40`])], { authority: 'published' }) },
    { what: 'a work nobody holds',
      length: 20_000, code: 'PROGRAM_IO_UNKNOWN_SOURCE', exit: 30,
      text: score(['no-such-work']) },
    { what: 'a division the work has not',
      length: 20_000, code: 'PROGRAM_IO_UNKNOWN_DIVISION', exit: 31,
      text: score(['spoon-river-anthology#900']) },
    { what: 'an opening under the floor',
      length: 20_000, code: 'PROGRAM_IO_EXTENT_FLOOR', exit: 32,
      text: score(['spoon-river-anthology#50:37']) },
    { what: 'an ordinal the grammar has not',
      length: 20_000, code: 'PROGRAM_IO_EXTENT_GRAMMAR', exit: 33,
      text: score([`${TAO}#0`]) },
    /**
     * THE TWO CASES THE FOLD SAID IT HAD ABSORBED AND HAD NOT.
     *
     * The doc comment below claimed "the ordinal" came over from
     * Scriptorium.room.test.js. What came over was `#0`, which is a zero
     * rather than a leading zero — and the interesting one is `#0040`, where
     * `EXTENT_PATTERN`'s `(\d+)` accepted the spelling and `Number()`
     * normalised it, so the gate silently CORRECTED a model's output.
     *
     * The second follows from the first: two spellings of Chapter XL defeated
     * PROGRAM_SOURCE_OWNERSHIP, and the reader heard the same chapter twice
     * under two movement titles. Both still lived single-door in
     * scriptorium-gate.test.js, which cannot see the room or the exit status.
     */
    { what: 'a leading zero in the ordinal, which is not corrected to 40',
      length: 20_000, code: 'PROGRAM_IO_EXTENT_GRAMMAR', exit: 33,
      text: score([`${TAO}#0040`]) },
    { what: 'one chapter named twice, under two spellings',
      length: 20_000, code: 'PROGRAM_IO_EXTENT_GRAMMAR', exit: 33,
      text: scoreOf([{
        id: 'movements',
        kind: 'movement',
        clips: [
          { id: 'm1', anchor: { sourceIds: [`${TAO}#0040`] },
            data: { index: 0, title: 'Chapter forty, spelled oddly' } },
          { id: 'm2', anchor: { sourceIds: [`${TAO}#40`] },
            data: { index: 1, title: 'Chapter forty again' } }
        ]
      }]) },
    { what: 'a collection nobody offers',
      length: 20_000, code: 'PROGRAM_IO_UNKNOWN_COLLECTION', exit: 34,
      text: scoreOf([
        movements([`${TAO}#40`]),
        { id: 'visuals', kind: 'visual', fallback: { kind: 'still' }, clips: [
          { id: 'v1', anchor: { sourceIds: [`${TAO}#40`] },
            cue: { kind: 'sourced', collections: ['aic-nothing-like-this'] } }] }
      ]) },
    { what: 'a whole work longer than the length',
      length: 200, code: 'PROGRAM_IO_BUDGET_EXCEEDED', exit: 40,
      text: score([TAO]) },
    { what: 'a work no session can hold at any length',
      length: MAX_SAFE_TARGET_WORDS, code: 'PROGRAM_IO_ATOM_CEILING', exit: 42,
      text: score(['middlemarch']) },
    /**
     * MORE WORKS THAN A SESSION HOLDS, which is not the same refusal as more
     * words than a session holds and no longer wears its code. 65 chapters of
     * the Tao is 8,456 words against a 20,000 budget; a reader told "longer
     * than one session can hold" about that has been told the wrong thing.
     */
    { what: 'more works than one session holds',
      length: 20_000, code: 'PROGRAM_IO_SOURCE_CEILING', exit: 43,
      text: chapters(65) },
    { what: 'an operation set',
      length: 20_000, code: null, exit: 0, text: JSON.stringify({
        schema: 'rise.agent-operation-set.v1',
        id: 'ops-1',
        projectId: 'project-1',
        baseRevision: 0,
        operations: [{ op: 'add-source', id: 'op-1', sourceId: `${TAO}#40` }]
      }) },
    { what: 'an operation naming a division field',
      length: 20_000, code: 'AGENT_OP_DIVISION', exit: 60, text: JSON.stringify({
        schema: 'rise.agent-operation-set.v1',
        id: 'ops-2',
        projectId: 'project-1',
        baseRevision: 0,
        operations: [{ op: 'add-source', id: 'op-1', sourceId: TAO, division: 40 }]
      }) },
    /**
     * THE TWO SMUGGLING SHAPES, which is where a pinned expectation earns its
     * keep. The budget reads movement tracks and the resolver loads every
     * track, so a work named on a transition was charged nothing and read
     * entire — and three doors agreeing on "admitted" is exactly what that
     * defect looked like from an agreement table.
     */
    { what: 'a whole work smuggled onto a transition track',
      length: 200, code: 'PROGRAM_IO_BUDGET_EXCEEDED', exit: 40,
      text: scoreOf([movements([`${TAO}#40`]), transitionNaming(TAO)]) },
    { what: 'a novel smuggled onto a transition track',
      length: 200, code: 'PROGRAM_IO_ATOM_CEILING', exit: 42,
      text: scoreOf([movements([`${TAO}#40`]), transitionNaming('middlemarch')]) }
  ];

  for (const testCase of CASES) {
    const { what, length, code, exit, text } = testCase;
    it(`${code === null ? 'accepts' : `refuses ${code}`}: ${what}`, async () => {
      const roomVerdict = throughTheRoom(text, length);
      const { payload, status } = await cli(
        ['examine', 'score.json', '--length', String(length), '--json'],
        text
      );

      // WHAT THE VERDICT IS. Neither surface is asked what the other said.
      expect(room.targetWords, 'the slider did not reach the session').toBe(length);
      expect(roomVerdict.code ?? null, `the room said ${roomVerdict.text}`).toBe(code);
      expect(roomVerdict.ok).toBe(code === null);
      expect(payload, `the CLI printed no JSON for ${what}`).toBeTruthy();
      expect(payload.code ?? null).toBe(code);
      expect(status).toBe(exit);
      if (code === null) {
        expect(roomVerdict.text).toBeNull();
        expect(room.program ?? room.operationSet).toBeTruthy();
      } else {
        // A refusal is a thing the reader can act on, so it has prose too.
        expect(roomVerdict.text.length).toBeGreaterThan(20);
        expect(room.program).toBeNull();
        /**
         * THE ASSERTION THE FOLD DROPPED, RESTORED AT THE DOOR THAT CAN MAKE IT.
         *
         * `status` is the room's own line, and it is 'Refused.' only when
         * `ScriptoriumSession.isRefusal` recognises the error class. When it
         * does not, the raw exception message goes there instead — `An
         * operation set accepts 1–32 operations ($.operations)`, a JSON path
         * in a room whose §10b ruling is that the reader never passes through
         * the Workshop.
         *
         * The old room-only table carried this per case; the fold up into this
         * file kept the codes and lost it, and it is asserted exactly once in
         * the whole room test for a case that does not exercise the typed-error
         * path at all. So deleting a class from `isRefusal` passed everything.
         * Here it fails once per refusing case above.
         *
         * The CLI cannot make this claim: it prints `verdict.text` and never
         * reads `status`. That is why it belongs beside the room's verdict and
         * not in the payload comparison below.
         */
        expect(room.status,
          `the room's status line is the raw exception rather than 'Refused.' — `
          + `${code} is an error class isRefusal does not name`).toBe('Refused.');
      }

      // AND THAT BOTH DOORS REACH IT. The prose character for character: a
      // code can agree while the two surfaces phrase the correction
      // differently, and the phrasing is what a curator acts on.
      expect(payload.ok, `the CLI said ${payload.ok}; the room said ${roomVerdict.ok}`)
        .toBe(roomVerdict.ok);
      expect(payload.refusal ?? null).toBe(roomVerdict.text ?? null);
      expect(status).toBe(roomVerdict.ok ? 0 : exitStatusForCode(roomVerdict.code));
    });
  }

  it('names a length the score can be read at when it refuses one', () => {
    // What makes PROGRAM_IO_BUDGET_EXCEEDED useful is the number, not the
    // code, and no agreement between surfaces asserts the number is right
    // because both read it from the same place.
    const verdict = throughTheRoom(score([TAO]), 200);
    expect(verdict.code).toBe('PROGRAM_IO_BUDGET_EXCEEDED');
    // The Tao Te Ching is 10,321 words, which is what the reader is owed —
    // measured from the catalogue here rather than restated from the gate.
    const catalogued = room.context.library.find(entry => entry.id === TAO);
    expect(verdict.text).toContain(catalogued.words.toLocaleString('en-US'));
    expect(verdict.text).toContain('200');
  });

  /**
   * THE LENGTH IS THE ONE THING ARGV CAN GET WRONG WITHOUT LOOKING WRONG.
   *
   * Every case above passes `--length`, and most of them are asked at the
   * room's own default — so a CLI that dropped the flag entirely would still
   * reach the pinned verdict for all but a handful. This asks the same score
   * at two lengths and requires the verdicts to DIFFER, which is the only
   * shape of assertion a silently ignored budget fails.
   */
  it('measures against the length it was given, as the slider does', async () => {
    const text = score([TAO]);
    const under = await cli(['examine', 's.json', '--length', '20000', '--json'], text);
    const over = await cli(['examine', 's.json', '--length', '200', '--json'], text);
    expect(under.payload.ok).toBe(true);
    expect(over.payload.code).toBe('PROGRAM_IO_BUDGET_EXCEEDED');
    expect(over.status).toBe(SCRIPTORIUM_EXIT.budgetExceeded);

    expect(throughTheRoom(text, 20_000).ok).toBe(true);
    expect(throughTheRoom(text, 200).code).toBe('PROGRAM_IO_BUDGET_EXCEEDED');
  });

  /**
   * And the same agreement once the bytes are involved.
   *
   * `ulysses#18:200` is the score the catalogue cannot judge: 24,058 words to
   * its first full stop, so the cut has no honest boundary inside the 1.6×
   * cap. The gate admits it and the reading refuses it — which until this
   * tranche were two different sentences, because the Workshop owned the only
   * wording for it and this room said `Could not load: ulysses#18:200`.
   */
  it('refuses an unloadable opening in the same words at the reading', async () => {
    const text = score(['ulysses#18:200']);
    expect(throughTheRoom(text, 20_000).ok).toBe(true);
    container.querySelector('[data-action="begin"]').click();
    await vi.waitFor(() => expect(room.verdict.ok).toBe(false), { timeout: 60_000 });

    const { payload, status } = await cli(
      ['read', 'score.json', '--length', '20000', '--json'], text
    );
    expect(payload.code).toBe('PROGRAM_IO_LIBRARY_UNLOADABLE');
    expect(payload.code).toBe(room.verdict.code);
    expect(payload.refusal).toBe(room.verdict.text);
    expect(payload.refused).toEqual(['ulysses#18:200']);
    expect(status).toBe(SCRIPTORIUM_EXIT.unloadable);
  }, 120_000);
});

/**
 * READ OUT OF THE PHRASING, not listed here by hand.
 *
 * `describeImportFailure` is the one place a refusal is put into words, so
 * its switch is the authoritative list of refusals a curator can meet. A
 * hand-kept copy of that list in this file would be the duplication these
 * guards exist to catch.
 */
const PHRASED = [...readFileSync(
  join(process.cwd(), 'src/core/experience-program-io.js'), 'utf8'
).matchAll(/^\s*case '([A-Z_]+)':/gmu)].map(match => match[1]);

describe('a refusal code is an exit status', () => {
  it('finds the refusals the gate phrases', () => {
    expect(PHRASED.length).toBeGreaterThan(50);
    expect(PHRASED).toContain('PROGRAM_IO_EXTENT_FLOOR');
    expect(PHRASED).toContain('PROGRAM_IO_LIBRARY_UNLOADABLE');
  });

  it('gives every one of them a status a script can branch on', () => {
    for (const code of PHRASED) {
      const status = exitStatusForCode(code);
      // Never 0: that is acceptance. Never 1: that is this file admitting it
      // does not recognise the code. Never 2: that is the argv.
      expect(status, `${code} exits ${status}`).toBeGreaterThanOrEqual(20);
    }
  });

  it('names every PROGRAM_IO refusal explicitly rather than by family', () => {
    // The failing input, constructed. An unlisted PROGRAM_IO_ code falls
    // through to the PROGRAM_ family and quietly becomes "the program's shape",
    // which is what a budget, a fence and a missing division would all become.
    expect(exitStatusForCode('PROGRAM_IO_INVENTED_TODAY'))
      .toBe(SCRIPTORIUM_EXIT.shape);
    for (const code of PHRASED.filter(name => name.startsWith('PROGRAM_IO_'))) {
      expect(exitStatusForCode(code),
        `${code} is phrased but not named in the exit table, so it inherited `
        + 'the PROGRAM_ family default').not.toBe(SCRIPTORIUM_EXIT.shape);
    }
  });

  it('keeps the four extent verdicts apart', () => {
    const statuses = [
      'PROGRAM_IO_UNKNOWN_SOURCE',
      'PROGRAM_IO_UNKNOWN_DIVISION',
      'PROGRAM_IO_EXTENT_FLOOR',
      'PROGRAM_IO_EXTENT_GRAMMAR'
    ].map(exitStatusForCode);
    expect(new Set(statuses).size).toBe(4);
  });

  /**
   * §13 IS A TABLE, AND UNTIL NOW NOTHING BOUND A CODE TO ITS ROW.
   *
   * What stood here asserted that each status APPEARS somewhere in the table
   * and that four code names appear somewhere in §13. Both survive any
   * rearrangement of which code sits in which row: remapping
   * `PROGRAM_IO_EXTENT_GRAMMAR` from 33 to 70 left the full suite green and
   * `npm run scriptorium:ci` green with it, because the code still appeared
   * and 70 was still a row.
   *
   * So the rows are parsed, and each code the table names is put through
   * `exitStatusForCode` and required to come back as the number of the row it
   * was found in — and each code the CLI phrases is required to be named in
   * the row for the status it maps to. Both directions, so a swap fails on
   * one of them whichever way it is made.
   */
  /**
   * WHICH ROWS MAY END IN AN ELLIPSIS — HERE, NOT IN THE SPEC.
   *
   * `open` used to be computed from the cell under test, so the document
   * granted itself the exemption: appending `, …` to any row turned it into a
   * catch-all the backward pass skipped entirely. Row 23 is where every
   * unlisted code lands, and rehoming `AGENT_OP_SOURCE` (60),
   * `SOURCE_SPAN_QUOTE_NOT_FOUND` (50) and `PUBLICATION_HUMAN_REQUIRED` (70)
   * onto it left the whole suite and CI green.
   *
   * So the set lives here, the spec is required to mark exactly these rows and
   * no others, and an open row is no longer unchecked: every refusal the CLI
   * phrases at 23 must be named in the cell or excused below. The ellipsis
   * remains because it is TRUE — `PROGRAM_` is a prefix family, so a code
   * added to the program validator tomorrow lands at 23 by construction — but
   * it is now a claim about codes that do not exist yet rather than a hole.
   */
  const OPEN_ROWS = Object.freeze({
    23: 'PROGRAM_ is a prefix family in EXIT_FAMILIES, so a code added to the '
      + 'program validator lands here without the table being edited'
  });

  /**
   * A phrased code at an open row that the row does not name, with a reason.
   *
   * An entry here is a code somebody decided not to document, which is a
   * decision that should cost a sentence.
   *
   * THESE TWO ARE A HANDBACK RATHER THAN A DECISION. Both are the same verdict
   * — one passage named twice — and both reached readers as a raw validator
   * message until `describeImportFailure` was given words for them. Phrasing a
   * refusal is what puts it in this check, and §13 is edited elsewhere, so the
   * row 23 cell that should name them is handed back rather than written here.
   * Delete these when it does.
   */
  const UNNAMED_IN_OPEN_ROW = Object.freeze({
    PROGRAM_SOURCE_OWNERSHIP: '§13 row 23 has yet to name it; the spec is edited '
      + 'elsewhere and this file reads it rather than writing it',
    PROGRAM_TRANSITION_SOURCE_DUPLICATE: 'the same handback — its twin in the '
      + 'transition lane, refused by the same rule at the same status'
  });

  const SPEC_ROWS = (() => {
    const spec = readFileSync(
      join(process.cwd(), 'docs/vision/SCRIPTORIUM-SPEC.md'), 'utf8'
    );
    const table = spec.slice(spec.indexOf('## 13.'));
    const rows = new Map();
    for (const line of table.split('\n')) {
      const match = /^\|\s*(\d+)\s*\|([^|]*)\|(.*)\|\s*$/u.exec(line);
      if (!match) continue;
      rows.set(Number(match[1]), {
        codes: [...match[3].matchAll(/`([^`]+)`/gu)].map(found => found[1]),
        // Read only so the spec can be held to marking exactly the rows
        // OPEN_ROWS allows. Nothing branches on it.
        markedOpen: /,\s*…\s*$/u.test(match[3].trim()),
        open: Object.hasOwn(OPEN_ROWS, Number(match[1]))
      });
    }
    return rows;
  })();

  it('marks exactly the rows this file allows to end in an ellipsis', () => {
    const marked = [...SPEC_ROWS].filter(([, row]) => row.markedOpen)
      .map(([status]) => status).sort((left, right) => left - right);
    expect(marked,
      'a row §13 leaves open that this file does not is a row that exempted '
      + 'itself from the backward check by being edited')
      .toEqual(Object.keys(OPEN_ROWS).map(Number).sort((left, right) => left - right));
  });

  it('leaves no row of §13 without a code in it', () => {
    // The other evasion: emptying a row nothing phrases. Row 24 was empty of
    // any code the CLI could reach, so deleting its cell cost nothing.
    for (const [status, row] of SPEC_ROWS) {
      expect(row.codes.length, `§13 row ${status} names no code at all`)
        .toBeGreaterThan(0);
    }
  });

  /** Does a cell token name this code? `…_ENGINE` and `PROGRAM_READING_*` do. */
  const rowNames = (row, code) => row.codes.some(token => {
    if (token === code) return true;
    if (token.endsWith('*')) return code.startsWith(token.slice(0, -1));
    if (token.startsWith('…')) return code.endsWith(token.slice(1));
    return false;
  });

  it('reads §13 as a table rather than as a page of numbers', () => {
    expect(SPEC_ROWS.size).toBeGreaterThan(8);
    for (const [name, status] of Object.entries(SCRIPTORIUM_EXIT)) {
      if (status < 20) continue;
      expect(SPEC_ROWS.has(status), `§13 has no row for status ${status} (${name})`)
        .toBe(true);
    }
  });

  it('binds every code §13 names to the row it was written in', () => {
    let bound = 0;
    for (const [status, row] of SPEC_ROWS) {
      for (const token of row.codes) {
        // A wildcard is checked through a member of its family, since the
        // family is what the mapping actually keys on.
        const code = token.endsWith('*')
          ? `${token.slice(0, -1)}PROBE`
          : (token.startsWith('…') ? null : token);
        if (!code) continue;
        expect(exitStatusForCode(code),
          `§13 puts ${token} in row ${status}; exitStatusForCode says `
          + `${exitStatusForCode(code)}`).toBe(status);
        bound += 1;
      }
    }
    // The abbreviated `…_ENGINE` forms are checked from the other side below.
    expect(bound).toBeGreaterThan(20);
  });

  it('finds every refusal it phrases in the row for its own status', () => {
    for (const code of PHRASED) {
      const status = exitStatusForCode(code);
      const row = SPEC_ROWS.get(status);
      expect(row, `${code} exits ${status}, which §13 has no row for`).toBeTruthy();
      // AN OPEN ROW IS NOT AN UNCHECKED ROW. What stood here was
      // `if (row.open) continue`, and row 23 is where every unlisted code
      // lands — fifteen of the codes below lived there unread.
      if (row.open && Object.hasOwn(UNNAMED_IN_OPEN_ROW, code)) continue;
      expect(rowNames(row, code),
        `${code} exits ${status} and row ${status} does not name it — either the `
        + 'code moved or the table did').toBe(true);
    }
  });

  /**
   * THE FAILING INPUT FOR THE ELLIPSIS, CONSTRUCTED.
   *
   * The three codes below are the ones a red team actually rehomed onto 23,
   * and the pass above is only worth its words if doing it now fails.
   */
  it('notices a code rehomed into the row that ends in an ellipsis', () => {
    const rehomed = ['AGENT_OP_SOURCE', 'SOURCE_SPAN_QUOTE_NOT_FOUND',
      'PUBLICATION_HUMAN_REQUIRED'];
    const open = SPEC_ROWS.get(23);
    expect(open.open, 'row 23 is the one this file leaves open').toBe(true);
    for (const code of rehomed) {
      expect(exitStatusForCode(code), `${code} is no longer where §13 puts it`)
        .not.toBe(23);
      expect(rowNames(open, code),
        `row 23 names ${code}, so a rehoming of it would pass unread`).toBe(false);
    }
  });

  /**
   * THE FAILING INPUT, CONSTRUCTED.
   *
   * A binding that cannot fail is decoration, and the two guards above are
   * only worth their words if the swaps that used to pass now do not. These
   * rebuild the check against a table with two rows exchanged and require it
   * to notice — without touching the spec, which is what the previous shape
   * of this test had no way to do.
   */
  it('notices a code moved to another row', () => {
    const moved = new Map(SPEC_ROWS);
    moved.set(33, { codes: ['PROGRAM_IO_EXTENT_FLOOR'], open: false });
    const wrong = [...moved].filter(([status, row]) =>
      row.codes.some(token => !token.startsWith('…') && !token.endsWith('*')
        && exitStatusForCode(token) !== status));
    expect(wrong.map(([status]) => status)).toContain(33);
  });

  it('notices a refusal missing from its row', () => {
    const emptied = new Map(SPEC_ROWS);
    emptied.set(32, { codes: [], open: false });
    expect(rowNames(emptied.get(32), 'PROGRAM_IO_EXTENT_FLOOR')).toBe(false);
    expect(rowNames(SPEC_ROWS.get(32), 'PROGRAM_IO_EXTENT_FLOOR')).toBe(true);
  });
});

/**
 * AN ALLOWLIST OF REFUSALS SOMEBODY REMEMBERED IS NOT A VOCABULARY.
 *
 * `SCRIPTORIUM_EXIT` and the phrasing beside it were both lists someone kept
 * by hand, and `WORKSHOP_PROJECT_*` was the whole family nobody had put on
 * either. It had no status, so 65 chapters of the Tao — 8,456 words against a
 * 20,000 budget — exited 1, which §13 says means a bug in the CLI rather than
 * a verdict about the score; and `ScriptoriumSession.isRefusal` did not name
 * `WorkshopProjectError`, so the room's status line became the raw message
 * `A Workshop project accepts at most 64 sources ($.sources)`.
 *
 * So the list is derived rather than remembered. `isRefusal` says which error
 * classes this sequence phrases; each class is looked up in the module that
 * declares it; every code that module raises must have a status a script can
 * branch on. A new refusal anywhere in that closure arrives here.
 */
describe('every refusal the session can phrase has a status', () => {
  const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');
  const CORE = 'src/core';

  /**
   * `PROGRAM_IO_DOWNLOAD` is raised when `downloadTextFile` is called with no
   * `document` — an environment fault rather than a verdict about a score,
   * and unreachable from a terminal, which never downloads. It is the only
   * code in the closure allowed below 20, and naming it here is what makes
   * every other one a failure.
   */
  const INTERNAL_BY_DESIGN = new Set(['PROGRAM_IO_DOWNLOAD']);

  const REFUSAL_MODULES = (() => {
    const session = read(`${CORE}/scriptorium-session.js`);
    const classes = [...session.matchAll(/error instanceof (\w+)/gu)].map(match => match[1]);
    const home = new Map();
    // UNDER src/core, not merely in it. `render/` holds two more error classes
    // and a non-recursive read could not see them, so "every class" would have
    // meant "every class in one directory" — a guard whose reach is smaller
    // than its sentence.
    const walk = (directory) => {
      for (const entry of readdirSync(join(process.cwd(), directory), { withFileTypes: true })) {
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(path);
          continue;
        }
        if (!entry.name.endsWith('.js') || entry.name.endsWith('.test.js')) continue;
        for (const match of read(path).matchAll(/export class (\w+) extends Error/gu)) {
          home.set(match[1], path.slice(`${CORE}/`.length));
        }
      }
    };
    walk(CORE);
    return { classes, home };
  })();

  it('finds a module for every error class isRefusal names', () => {
    expect(REFUSAL_MODULES.classes.length).toBeGreaterThan(5);
    for (const name of REFUSAL_MODULES.classes) {
      expect(REFUSAL_MODULES.home.get(name), `${name} declares itself nowhere in ${CORE}`)
        .toBeTruthy();
    }
    // The family that had neither a status nor a wording.
    expect(REFUSAL_MODULES.classes).toContain('WorkshopProjectError');
  });

  /**
   * INVERTED, BECAUSE A LIST CANNOT SAY WHAT IS MISSING FROM IT.
   *
   * `isRefusal` names seven classes and twenty-five are exported under src/.
   * Two of the absentees — `EditorAssetError` and
   * `CuratorContextValidationError` — were reachable, so an ordinary scoring
   * mistake put a raw exception with a JSON path in the reader's status line,
   * in a room whose §10b ruling is that the reader never passes through the
   * Workshop. `WorkshopProjectError` was caught only because one literal
   * string is typed into a test; deleting `|| error instanceof
   * AgentOperationError` left the entire suite and CI green.
   *
   * So the direction is reversed. Every `export class … extends Error` under
   * src/core is enumerated and required to be named in `isRefusal` or listed
   * below with a reason it cannot reach this sequence. That is the only shape
   * in which a NEW unnamed class is a failure — the arrangement UNREACHABLE
   * already uses for statuses.
   */
  const NOT_A_REFUSAL_HERE = Object.freeze({
    JourneyCompileError:
      'a Journey is compiled from a published program the Scriptorium cannot '
      + 'produce; nothing in the sequence calls the Journey compiler',
    AcquisitionError:
      'the producer inspects acquisition without admitting and collects each '
      + 'refusal into `result.acquisition` rather than throwing (producer.js '
      + 'inspectPending), so it never reaches refuse()',
    PublicationError:
      'publication is a human decision over a hashed artifact and the '
      + 'Scriptorium runs the producer with render: false, so it enqueues '
      + 'nothing and can refuse nothing',
    VisualScoreHistoryError:
      'undo and redo are the Workshop\'s; this sequence keeps no score history',
    WorkshopMediaError:
      'IndexedDB is the room\'s, reached through prepareAssets, which the room '
      + 'catches where it renders the panel that took the file',
    ReadingScoreError:
      'the reading lane is scored inside the Experience Program, and '
      + 'experience-program.js rethrows its codes as PROGRAM_READING_* of its '
      + 'own — which ExperienceProgramValidationError already covers',
    ProjectAssetError:
      'render/project-asset.js resolves bytes for an encode, and the '
      + 'Scriptorium runs the producer with render: false',
    RenderError:
      'the same: nothing in this sequence renders'
  });

  it('names every error class under src/core, or excuses it here', () => {
    const named = new Set(REFUSAL_MODULES.classes);
    const declared = [...REFUSAL_MODULES.home.keys()];
    expect(declared.length,
      'nothing was found to enumerate, so this guard proves nothing')
      .toBeGreaterThan(12);

    for (const name of declared) {
      if (named.has(name)) continue;
      expect(NOT_A_REFUSAL_HERE[name],
        `${name} is exported under ${CORE}, is not named in isRefusal, and has no `
        + 'reason here for why it cannot reach the Scriptorium. An error class the '
        + 'sequence meets and does not phrase becomes the reader\'s status line '
        + 'verbatim — a JSON path in a room that has a refusal panel for exactly '
        + 'this.').toBeTypeOf('string');
    }

    // AND AN EXCUSE THAT IS NO LONGER NEEDED IS A FAILURE TOO, the same way a
    // status named unreachable that a fixture reaches is.
    for (const name of Object.keys(NOT_A_REFUSAL_HERE)) {
      expect(REFUSAL_MODULES.home.has(name),
        `${name} is excused here and is no longer declared in ${CORE}`).toBe(true);
      expect(named.has(name),
        `${name} is excused here and isRefusal names it`).toBe(false);
    }
  });

  it('names the three classes that were missing and reachable', () => {
    // Not a restatement of the guard above: these are the ones a reader
    // actually met, and each is proved to reach `Refused.` in the room by the
    // verdict table at the top of this file.
    for (const name of ['AudioScoreLaneError', 'EditorAssetError',
      'CuratorContextValidationError']) {
      expect(REFUSAL_MODULES.classes, `${name} is reachable and unnamed`).toContain(name);
    }
  });

  it('gives a branchable status to every code those modules raise', () => {
    // narration.js is here because experience-program.js rethrows its codes
    // as its own — `fail(error.code || 'PROGRAM_NARRATION', ...)` — so they
    // reach a reader without narration.js ever appearing in isRefusal.
    expect(read(`${CORE}/experience-program.js`)).toContain("error.code || 'PROGRAM_NARRATION'");
    const modules = [...new Set([
      ...REFUSAL_MODULES.classes.map(name => REFUSAL_MODULES.home.get(name)),
      'narration.js'
    ])];

    /**
     * A RETHROW IS STILL A RAISE, and the pattern could not see one.
     *
     * `fail('CODE'` was all it matched, so `fail(error.code || 'AGENT_OP_
     * NARRATION', …)` — the shape every rethrow in this tree takes, where a
     * lane's own code is preferred and a fallback named only when there is
     * none — contributed nothing. The optional first clause is what closes it.
     */
    const RAISES = /(?:fail|new \w*Error)\(\s*(?:[\w.?]+\s*\|\|\s*)?'([A-Z][A-Z0-9_]{3,})'/gu;

    const codes = new Set();
    for (const file of modules) {
      for (const match of read(`${CORE}/${file}`).matchAll(RAISES)) codes.add(match[1]);
    }
    // The failing input, constructed: both shapes, and a line break in each.
    expect([...'fail(\n  \'PROBE_PLAIN\''.matchAll(RAISES)].map(m => m[1]))
      .toEqual(['PROBE_PLAIN']);
    expect([...'fail(error.code || \'PROBE_RETHROWN\''.matchAll(RAISES)].map(m => m[1]))
      .toEqual(['PROBE_RETHROWN']);
    expect(codes, 'the rethrown fallback codes are still invisible to the scan')
      .toContain('AGENT_OP_NARRATION');
    expect(codes.size).toBeGreaterThan(120);

    for (const code of codes) {
      if (INTERNAL_BY_DESIGN.has(code)) {
        expect(exitStatusForCode(code), `${code} is excused and no longer needs to be`)
          .toBeLessThan(20);
        continue;
      }
      expect(exitStatusForCode(code),
        `${code} can reach a reader and exits ${exitStatusForCode(code)}, which means `
        + '"the CLI does not recognise this" rather than a verdict').toBeGreaterThanOrEqual(20);
    }
  });

  it('phrases the family that used to arrive as a raw exception', () => {
    for (const code of ['WORKSHOP_PROJECT_SOURCES', 'WORKSHOP_PROJECT_TOTAL_TEXT']) {
      expect(PHRASED, `${code} has no wording`).toContain(code);
      const said = describeImportFailure({ code, message: 'x', path: '$.sources', details: {} });
      // §10b: the reader never passes through the Workshop, so a reply may
      // not send them there — nor quote a JSON path at them.
      expect(said).not.toMatch(/\$\.sources/u);
      expect(said).not.toMatch(/Workshop project/u);
    }
  });

  /**
   * A PATH IS SHOWN ONLY WHERE IT NAMES SOMETHING THE READER WROTE.
   *
   * The rule was one literal — `!code.startsWith('WORKSHOP_PROJECT_')` — which
   * fixed the instance and left the shape, so the next family through leaked
   * again: `EDITOR_ASSET_CUE_KIND` put `$.cueTemplate.kind` in front of a
   * curator, a path into an object no document has. Three families validate
   * the pasted bytes and every other one describes something built downstream.
   */
  it('quotes a path only from the document the reader pasted', () => {
    const pasted = ['PROGRAM_IO_UNKNOWN_SOURCE', 'PROGRAM_UNKNOWN_FIELD', 'AGENT_OP_ASSET'];
    const downstream = ['WORKSHOP_PROJECT_SOURCES', 'EDITOR_ASSET_CUE_KIND',
      'AUDIO_SCORE_OVERLAP', 'CURATOR_CONTEXT_URI_REFUSED', 'VISUAL_SCORE_ASSET_NOT_FOUND'];

    for (const code of pasted) {
      expect(describeImportFailure({ code, message: 'x', path: '$.tracks', details: {} }),
        `${code} reads the reader's own document and hides where in it`)
        .toMatch(/At: \$\.tracks/u);
    }
    for (const code of downstream) {
      const said = describeImportFailure(
        { code, message: 'x', path: '$.cueTemplate.kind', details: {} }
      );
      expect(said, `${code} quotes a path into an object the reader never wrote`)
        .not.toMatch(/At: /u);
      expect(said).not.toMatch(/\$\.cueTemplate/u);
      // The code is still on the last line, so which refusal it was survives.
      expect(said).toContain(`(${code})`);
    }
  });
});

/**
 * THE ONE STATUS NO COMMITTED SCORE CAN REACH.
 *
 * scripts/scriptorium-ci.mjs requires every status §13 documents to be
 * produced by a fixture or named in its UNREACHABLE map. An escape hatch is
 * only worth having if the claims in it are checked — and two of the three
 * claims did not survive being checked.
 *
 * 24 said "the CLI has no flag that accepts a capability document", which is
 * true and beside the point: `--id` flows INTO one, through
 * `session.mintId()` → `exportCuratorContext` → `validateCuratorContext`, and
 * `--id "http://example.com/x"` left the process as an uncaught stack trace.
 *
 * 51 said two things. The first — the CLI examines before it reads — holds and
 * is still proved below. The second was about the PROGRAM validator requiring
 * a movement to own a source, in an excuse covering a door the operations gate
 * had been added beside; `add-source` then `remove-source` reached the reading
 * with nothing in it. It was the load-bearing half and it was unchecked.
 *
 * Both have fixtures now. 41 is what is left.
 */
describe('a status with no fixture is a status nothing can produce', () => {
  const CI = readFileSync(join(process.cwd(), 'scripts/scriptorium-ci.mjs'), 'utf8');
  const EXCUSED = new Set(
    [...CI.slice(CI.indexOf('const UNREACHABLE')).matchAll(/^\s{2}(\d+):/gmu)]
      .map(match => Number(match[1]))
  );

  it('excuses exactly the one proved below', () => {
    expect([...EXCUSED].sort((left, right) => left - right)).toEqual([41]);
  });

  it('41: every work in the catalogue carries a word count', async () => {
    // If one ever ships without, this fails and the excuse in the CI script
    // stops being true on the same run.
    const { stdout } = await cli(['context', '--id', 'fixed']);
    const document = JSON.parse(stdout);
    // A `for..of` OVER AN EMPTY CATALOGUE PASSES VACUOUSLY, which is the shape
    // of proof this excuse cannot afford: the whole claim is about what every
    // work carries, and a shelf that has gone empty would satisfy it silently.
    expect(document.library.length,
      'the excuse for 41 is a claim about the catalogue, and there is none')
      .toBeGreaterThan(8);
    for (const work of document.library) {
      expect(Number.isInteger(work.words), `${work.id} declares no word count`).toBe(true);
      expect(Array.isArray(work.divisions?.words)
        && work.divisions.words.length >= work.divisions.count,
      `${work.id} declares ${work.divisions?.count} divisions and `
      + `${work.divisions?.words?.length ?? 0} lengths`).toBe(true);
    }
    expect(exitStatusForCode('PROGRAM_IO_BUDGET_UNMEASURED'))
      .toBe(SCRIPTORIUM_EXIT.budgetUnmeasured);
  });

  /**
   * The half of 51's excuse that held, kept as behaviour now that the status
   * itself has a fixture. There is still no path from argv to an unexamined
   * read, and PROGRAM_IO_NOT_EXAMINED is still not dead code.
   */
  it('examines before it reads, so nothing arrives unexamined', async () => {
    expect(exitStatusForCode('PROGRAM_IO_NOT_EXAMINED')).toBe(SCRIPTORIUM_EXIT.nothingToRead);
    const { status, payload } = await cli(['read', 's.json', '--json'], score(['no-such-work']));
    expect(payload.code).toBe('PROGRAM_IO_UNKNOWN_SOURCE');
    expect(status).toBe(SCRIPTORIUM_EXIT.unknownSource);

    // And the code is not dead: the session reaches it when a surface calls
    // read() without examining, which is what the room's Begin button can do.
    const session = createScriptoriumSession();
    const outcome = await session.read();
    expect(outcome.verdict.code).toBe('PROGRAM_IO_NOT_EXAMINED');
  });

  /**
   * 24 IS REACHABLE, AND THIS IS THE PATH THE EXCUSE MISSED.
   *
   * `session.take()` was the one step `runScriptoriumCli` did not wrap.
   */
  it('refuses a capability document it cannot build, rather than throwing', async () => {
    const { status, payload } = await cli(['context', '--id', 'http://example.com/x', '--json']);
    expect(status).toBe(SCRIPTORIUM_EXIT.context);
    expect(payload.code).toBe('CURATOR_CONTEXT_URI_REFUSED');
    // A refusal, not a stack trace: it has prose a person can act on.
    expect(payload.refusal).toMatch(/must not be URIs/u);
    expect(payload.refusal).not.toMatch(/ {4}at /u);
    // And the flag vocabulary still accepts no capability document, which is
    // the true half of what the excuse used to claim.
    const shell = readFileSync(join(process.cwd(), 'src/core/scriptorium-cli.js'), 'utf8');
    const flags = /const FLAGS_WITH_VALUES = new Set\(\[([^\]]*)\]\)/u.exec(shell)[1];
    expect(flags).not.toMatch(/context/iu);
  });
});

/**
 * 0 IS ACCEPTANCE AND NOTHING ELSE.
 *
 * `measureReading` caught a compile failure into `compileRefusal` and the CLI
 * emitted `ok: true, exit: 0` anyway, excusing it as the terminal holding no
 * bytes for the reader's own files. Measured, that excuse buys nothing — a
 * score naming an image material compiles here, 38 words and 39 atoms — while
 * it bought cover for two real failures that both reported
 * `Maximum call stack size exceeded` under exit 0. A CI script asserting 0
 * passed on a reading that cannot open.
 */
describe('a reading that did not compile is not an acceptance', () => {
  afterEach(() => {
    vi.doUnmock('./session-compiler.js');
    vi.resetModules();
  });

  it('exits 1 and says the fault is RISE\'s, not the score\'s', async () => {
    vi.resetModules();
    vi.doMock('./session-compiler.js', () => ({
      compileSession: () => { throw new RangeError('Maximum call stack size exceeded'); }
    }));
    const { runScriptoriumCli: withBrokenCompiler } = await import('./scriptorium-cli.js');

    const lines = [];
    const status = await withBrokenCompiler(
      ['read', 's.json', '--length', '200', '--json'],
      { out: (line) => lines.push(line), err: () => {}, readTextFile: () => score([`${TAO}#40`]) }
    );
    const payload = JSON.parse(lines.join('\n'));
    expect(status).toBe(SCRIPTORIUM_EXIT.internal);
    expect(payload.ok).toBe(false);
    expect(payload.exit).toBe(SCRIPTORIUM_EXIT.internal);
    expect(payload.compileRefusal).toMatch(/call stack/u);
    // The words are still true and are still printed.
    expect(payload.words).toBeGreaterThan(0);
  }, 120_000);

  it('reports no compile refusal at all on a reading that opens', async () => {
    const { payload, status } = await cli(
      ['read', 's.json', '--length', '200', '--json'], score([`${TAO}#40`])
    );
    expect(status).toBe(SCRIPTORIUM_EXIT.ok);
    expect(payload.compileRefusal).toBeNull();
  }, 60_000);
});

/**
 * ANYTHING NOT RUN BY CI IS DOCUMENTATION.
 *
 * The tests above drive `runScriptoriumCli` in-process, which cannot see three
 * joints: the npm script, vite-node loading a graph that imports
 * division-index.json without an import attribute, and a refusal code reaching
 * a shell as an exit status. `npm run scriptorium:ci` spawns the CLI and
 * asserts all three. This is the guard that the workflow still calls it — a
 * check nobody runs is the failure mode this whole entrance was built against,
 * and three of the fourteen probes it replaces died of exactly that.
 */
describe('CI runs the CLI, not a description of it', () => {
  const read = (path) => readFileSync(join(process.cwd(), path), 'utf8');

  it('has both an entry point and a script that reaches it', () => {
    const manifest = JSON.parse(read('package.json'));
    expect(manifest.scripts.scriptorium).toContain('scripts/scriptorium.mjs');
    expect(manifest.scripts['scriptorium:ci']).toContain('scripts/scriptorium-ci.mjs');
    // The shell holds argv, two streams and a status, and nothing else: a
    // judgement here is a judgement no test in this file could reach.
    expect(read('scripts/scriptorium.mjs')).toContain('runScriptoriumCli');
  });

  it('is invoked by the workflow', () => {
    const workflow = read('.github/workflows/ci.yml');
    expect(workflow).toContain('npm run scriptorium:ci');
    // Its own job, so a red run names which promise broke.
    expect(workflow).toMatch(/^\s{2}scriptorium:$/mu);
  });

  it('spawns the entry point rather than importing past it', () => {
    const driver = read('scripts/scriptorium-ci.mjs');
    expect(driver).toContain('spawnSync');
    expect(driver).toContain('scriptorium.mjs');
    // Every case asserts a status, and every refusing case asserts the code
    // that status stands for. One without the other is half a mapping.
    expect(driver).toContain('PROGRAM_IO_EXTENT_FLOOR');
    expect(driver).toContain('PROGRAM_IO_LIBRARY_UNLOADABLE');
  });
});

describe('the argv shell refuses rather than guesses', () => {
  it('takes a command, a file, and the flags it documents', () => {
    expect(parseScriptoriumArgv(['examine', 'a.json', '--length', '900']))
      .toMatchObject({ command: 'examine', file: 'a.json', options: { length: 900 } });
    expect(parseScriptoriumArgv(['context', '--material', 'a.png', '--material', 'b.png']))
      .toMatchObject({ command: 'context', options: { materials: ['a.png', 'b.png'] } });
  });

  for (const [argv, why] of [
    [[], 'no command'],
    [['examine'], 'examine needs a score file'],
    [['read'], 'read needs a score file'],
    [['context', 'a.json'], 'context takes no file'],
    [['polish', 'a.json'], 'unknown command polish'],
    [['examine', 'a.json', '--trim'], 'unknown option --trim'],
    [['examine', 'a.json', 'b.json'], 'examine takes one file, not two'],
    [['examine', 'a.json', '--length'], '--length needs a value'],
    [['examine', 'a.json', '--length', 'longish'], '--length needs a number']
  ]) {
    it(`refuses: ${why}`, () => {
      expect(parseScriptoriumArgv(argv).usage).toBe(why);
    });
  }

  it('exits 2 on usage and says so on stderr, not stdout', async () => {
    const { status, stdout, stderr } = await cli(['examine', 'a.json', '--trim']);
    expect(status).toBe(SCRIPTORIUM_EXIT.usage);
    expect(stdout).toBe('');
    expect(stderr).toContain('unknown option --trim');
  });

  it('exits 2 when the score file is not there', async () => {
    const { status, stderr } = await cli(['examine', 'gone.json'], null);
    expect(status).toBe(SCRIPTORIUM_EXIT.usage);
    expect(stderr).toContain('cannot read gone.json');
  });

  it('prints the usage on --help and exits 0', async () => {
    const { status, stdout } = await cli(['--help']);
    expect(status).toBe(SCRIPTORIUM_EXIT.ok);
    expect(stdout).toContain('npm run scriptorium');
    expect(stdout).toContain('read <score.json>');
  });
});

describe('the four commands', () => {
  it('hands out the capability document the room hands out', async () => {
    const { status, stdout } = await cli(['context', '--length', '900', '--id', 'fixed']);
    expect(status).toBe(SCRIPTORIUM_EXIT.ok);
    const document = JSON.parse(stdout);
    expect(document.schema).toBe(CURATOR_CONTEXT_SCHEMA);
    expect(document.id).toBe('fixed');
    expect(document.constraints.targetWords).toBe(900);
    expect(document.library.length).toBeGreaterThan(8);
    // No bytes leave, ever — the document's first law.
    expect(stdout).not.toMatch(/data:|blob:/u);
  });

  it('clamps a length the gate would refuse rather than passing it on', async () => {
    const { stdout } = await cli(['context', '--length', '999999', '--id', 'fixed']);
    expect(JSON.parse(stdout).constraints.targetWords).toBe(MAX_SAFE_TARGET_WORDS);
    const { stdout: low } = await cli(['context', '--length', '4', '--id', 'fixed']);
    expect(JSON.parse(low).constraints.targetWords).toBe(200);
  });

  it('writes a prompt whose examples come from the document beside it', async () => {
    const { status, payload } = await cli(
      ['prompt', '--intent', 'A sequence about memory and loss.', '--length', '900', '--json']
    );
    expect(status).toBe(SCRIPTORIUM_EXIT.ok);
    expect(payload.prompt).toContain('A sequence about memory and loss.');
    expect(payload.prompt).toMatch(/about 900 words/);
    expect(payload.prompt).toContain(TAO);
  });

  it('reports the words and the atoms a reading costs', async () => {
    const { status, payload } = await cli(
      ['read', 's.json', '--length', '200', '--json'], score([`${TAO}#40`])
    );
    expect(status).toBe(SCRIPTORIUM_EXIT.ok);
    expect(payload.words).toBeGreaterThan(0);
    expect(payload.words).toBeLessThanOrEqual(200);
    // An atom is not a word: a paragraph costs one of its own, so a reading
    // never compiles to fewer atoms than it holds words.
    expect(payload.atoms).toBeGreaterThanOrEqual(payload.words);
    expect(payload.sources).toEqual([
      expect.objectContaining({ id: `${TAO}#40`, words: payload.words })
    ]);
    expect(payload.refused).toEqual([]);
  }, 60_000);

  it('accounts for what an accepted score does, extents included', async () => {
    const { payload } = await cli(
      ['examine', 's.json', '--length', '200', '--json'], score([`${TAO}#40`])
    );
    expect(payload.rundown.totals.movements).toBe(1);
    // NOT NULL. Section 5 of the room and this line are the same call, and it
    // reported "Length unknown" for every extent id the prompt teaches.
    expect(payload.rundown.totals.words).toBeGreaterThan(0);
    expect(payload.rundown.totals.words).toBe(payload.preview.sources[0].words);
  });

  it('reads nothing it has not examined', async () => {
    const { status, payload } = await cli(['read', 's.json', '--json'], '{}');
    expect(status).toBe(SCRIPTORIUM_EXIT.authority);
    expect(payload.code).toBe('PROGRAM_IO_SCHEMA');
  });

  it('carries no state from one invocation to the next', async () => {
    // Each run builds its own session. A second `read` after a refusal must
    // not find the first run's program lying about.
    const bad = await cli(['read', 's.json', '--json'], score(['no-such-work']));
    expect(bad.payload.code).toBe('PROGRAM_IO_UNKNOWN_SOURCE');
    const good = await cli(
      ['read', 's.json', '--length', '200', '--json'], score([`${TAO}#40`])
    );
    expect(good.payload.ok).toBe(true);
    expect(good.payload.projectId).not.toBe(bad.payload.projectId);
  }, 60_000);
});
