/**
 * The Scriptorium from a terminal — an internal development entrance.
 *
 * SAME MODULES, SECOND ENTRANCE. This file parses argv, prints, and picks an
 * exit status. It performs no step of the sequence: every one of them is
 * ScriptoriumSession's, which is the object the room renders and the suite
 * asserts on. If this file ever contains a decision the room does not make
 * through the same call, the extraction has come apart — and the test that
 * says so is `the CLI and the room reach the same verdict` in
 * scriptorium-cli.test.js.
 *
 * WHY IT EXISTS. Fourteen `scripts/probe-scriptorium-*.mjs` were deleted in
 * the pass before this one; three of them were describing source that had
 * already changed within hours of being written, because a probe is a
 * transcript and a transcript rots. What survives here is a way to ASK the
 * live modules a question, so the answer is current by construction. Anything
 * worth keeping about the answer becomes a test.
 *
 * REFUSAL CODES ARE THE EXIT STATUS. That is the whole of what makes this
 * scriptable: CI can assert that one input refuses with PROGRAM_IO_EXTENT_FLOOR
 * rather than assert that some string appears somewhere in some output. The
 * mapping is SCRIPTORIUM_EXIT below and it is documented in
 * docs/vision/SCRIPTORIUM-SPEC.md §13.
 *
 * NO AGENT LOOP. Nothing here calls a model, and nothing here retries. RISE
 * calls no model (docs/vision/SCRIPTORIUM-SPEC.md §9); this entrance does not
 * become the exception.
 */

import { readFileSync, statSync } from 'node:fs';
import { basename, extname } from 'node:path';

import { createScriptoriumSession, SCRIPTORIUM_LENGTH } from './scriptorium-session.js';
import { serializeCuratorContext } from './curator-context.js';
import { describeImportFailure } from './experience-program-io.js';
import { inspectMaterial } from './materials.js';
import {
  createSequenceVisualAsset,
  SEQUENCE_ASSET_STORAGE_IDB,
  VISUAL_SCORE_COLORS
} from './visual-score-lane.js';
import { workshopProjectToSessionConfig } from './workshop-project.js';
import { compileSession } from './session-compiler.js';
import { countWords } from './chunker.js';

/**
 * A REFUSAL A SCRIPT CAN BRANCH ON.
 *
 * 0 is acceptance and nothing else. 1 is this file's own fault — a code the
 * vocabulary does not name, which is a bug here rather than a verdict about
 * the score. 2 is the argv. Everything from 20 up is the gate refusing, and
 * the number says which KIND of refusal without a script having to read prose:
 *
 *   20 document      it is not a score yet — empty, fenced, cut off, too large
 *   21 authority     a score, but not one this doorway may admit
 *   22 smuggled      it carries a URI or a prototype key
 *   23 shape         the program's own fields are wrong
 *   24 context       the capability document itself is malformed
 *   30 source        it names a work this build does not hold
 *   31 division      the work is here; that division is not
 *   32 extent floor  it asks for an opening below EXTENT_MIN_WORDS
 *   33 extent grammar the id is not one of the three forms
 *   34 capability    a collection, engine, soundscape, tone, swell or asset
 *   40 budget        longer than the reader asked for
 *   41 unmeasured    one source declares no length, so nothing can be proved
 *   42 atom ceiling  more WORDS than one session can hold at all
 *   43 source ceiling more WORKS than one session can hold at all
 *   50 unloadable    only the text could settle it, and the text refused
 *   51 nothing       there is no reading here to load
 *   60 operations    an operation set, or the producer, refused
 *   70 governance    acquisition, narration or publication refused
 *
 * The four extent statuses are separate on purpose: they are the grammar the
 * room teaches, and telling one from another is the difference between "the
 * curator asked wrongly" and "this build cannot serve that".
 *
 * 42 and 43 are separate for the same reason. Both are "longer than one
 * session can hold", and the curator's move differs: 42 is read less, 43 is
 * name the same reading in fewer ids. They were one status for a pass, told
 * apart only by a field in `details` — which is not something a shell can
 * branch on, and a status a shell cannot branch on is the whole of what §13
 * exists to prevent.
 */
export const SCRIPTORIUM_EXIT = Object.freeze({
  ok: 0,
  internal: 1,
  usage: 2,
  document: 20,
  authority: 21,
  smuggled: 22,
  shape: 23,
  context: 24,
  unknownSource: 30,
  unknownDivision: 31,
  extentFloor: 32,
  extentGrammar: 33,
  unknownCapability: 34,
  budgetExceeded: 40,
  budgetUnmeasured: 41,
  atomCeiling: 42,
  sourceCeiling: 43,
  unloadable: 50,
  nothingToRead: 51,
  operations: 60,
  governance: 70
});

/**
 * Every PROGRAM_IO_* refusal, by name.
 *
 * EXPLICIT RATHER THAN BY PREFIX, and the guard in scriptorium-cli.test.js
 * reads the `case` labels out of experience-program-io.js and fails when one
 * of them is missing from here. A prefix rule would have silently given a new
 * refusal whatever its neighbours got, which is how a status stops meaning
 * anything — and PROGRAM_IO_ alone spans a fenced document, a budget and a
 * division that does not exist.
 */
const PROGRAM_IO_EXIT = Object.freeze({
  PROGRAM_IO_EMPTY: SCRIPTORIUM_EXIT.document,
  PROGRAM_IO_JSON: SCRIPTORIUM_EXIT.document,
  PROGRAM_IO_TOO_LARGE: SCRIPTORIUM_EXIT.document,
  PROGRAM_IO_DOWNLOAD: SCRIPTORIUM_EXIT.internal,

  PROGRAM_IO_RECORD: SCRIPTORIUM_EXIT.authority,
  PROGRAM_IO_SCHEMA: SCRIPTORIUM_EXIT.authority,
  PROGRAM_IO_PUBLISHED_REFUSED: SCRIPTORIUM_EXIT.authority,

  PROGRAM_IO_URI_REFUSED: SCRIPTORIUM_EXIT.smuggled,
  PROGRAM_IO_PROTOTYPE: SCRIPTORIUM_EXIT.smuggled,

  PROGRAM_IO_UNKNOWN_SOURCE: SCRIPTORIUM_EXIT.unknownSource,
  PROGRAM_IO_UNKNOWN_DIVISION: SCRIPTORIUM_EXIT.unknownDivision,
  PROGRAM_IO_EXTENT_FLOOR: SCRIPTORIUM_EXIT.extentFloor,
  PROGRAM_IO_EXTENT_GRAMMAR: SCRIPTORIUM_EXIT.extentGrammar,

  PROGRAM_IO_UNKNOWN_COLLECTION: SCRIPTORIUM_EXIT.unknownCapability,
  PROGRAM_IO_UNKNOWN_ENGINE: SCRIPTORIUM_EXIT.unknownCapability,
  PROGRAM_IO_UNKNOWN_SOUNDSCAPE: SCRIPTORIUM_EXIT.unknownCapability,
  PROGRAM_IO_UNKNOWN_TONE: SCRIPTORIUM_EXIT.unknownCapability,
  PROGRAM_IO_UNKNOWN_SWELL: SCRIPTORIUM_EXIT.unknownCapability,
  PROGRAM_IO_UNKNOWN_VOICE: SCRIPTORIUM_EXIT.unknownCapability,
  PROGRAM_IO_UNKNOWN_SURFACE: SCRIPTORIUM_EXIT.unknownCapability,
  PROGRAM_IO_UNKNOWN_ASSET: SCRIPTORIUM_EXIT.unknownCapability,

  PROGRAM_IO_BUDGET_EXCEEDED: SCRIPTORIUM_EXIT.budgetExceeded,
  PROGRAM_IO_BUDGET_UNMEASURED: SCRIPTORIUM_EXIT.budgetUnmeasured,
  PROGRAM_IO_ATOM_CEILING: SCRIPTORIUM_EXIT.atomCeiling,
  PROGRAM_IO_SOURCE_CEILING: SCRIPTORIUM_EXIT.sourceCeiling,

  PROGRAM_IO_LIBRARY_UNLOADABLE: SCRIPTORIUM_EXIT.unloadable,
  PROGRAM_IO_NO_LIBRARY_SOURCES: SCRIPTORIUM_EXIT.nothingToRead,
  PROGRAM_IO_NOT_EXAMINED: SCRIPTORIUM_EXIT.nothingToRead
});

/**
 * The families, for the vocabularies this doorway reports rather than owns.
 *
 * Ordered: the first prefix that matches wins, so `PROGRAM_IO_` must be
 * settled by the table above before `PROGRAM_` sweeps up the validator's own
 * codes.
 */
const EXIT_FAMILIES = Object.freeze([
  ['SOURCE_SPAN_', SCRIPTORIUM_EXIT.unloadable],
  ['VISUAL_SCORE_', SCRIPTORIUM_EXIT.unloadable],
  /**
   * THE LANE THAT HAD A STATUS AND ITS TWIN THAT HAD NONE.
   *
   * `VISUAL_SCORE_` was here and `AUDIO_SCORE_` was not, so the commonest
   * scoring mistake there is — two clips over one passage — exited 50 in one
   * lane and 1 in the other. 1 says a bug in the CLI rather than a verdict
   * about the score (§13), so a reader who scored two beds over one chapter
   * was told RISE is broken while the prose above it said REFUSED.
   *
   * A prefix rather than names, for the same reason as WORKSHOP_PROJECT_
   * below: the lane refuses one kind of thing — a span it cannot take — and a
   * code added there tomorrow gets the right status by construction.
   */
  ['AUDIO_SCORE_', SCRIPTORIUM_EXIT.unloadable],
  /**
   * An editor asset is what the PRODUCER builds out of an operation, so a
   * refusal from it is a verdict about the operation set. It exited 1 and
   * leaked `$.cueTemplate.kind` — a path into an object no reader ever wrote.
   * The gate now refuses the two ways an operation could provoke it (an
   * unoffered field renderer, a swell nobody holds) before a project is
   * built, so this is the backstop rather than the road.
   */
  ['EDITOR_ASSET_', SCRIPTORIUM_EXIT.operations],
  /**
   * THE FAMILY THAT HAD NO STATUS AT ALL.
   *
   * Every `WORKSHOP_PROJECT_*` refusal fell past this list and exited 1,
   * which §13 says means a bug in the CLI rather than a verdict about the
   * score — so 65 chapters of the Tao, 8,456 words against a 20,000 budget,
   * reported the CLI as broken. It is the score's shape that is wrong: it
   * asked to assemble a reading larger than a reading may be.
   *
   * A PREFIX RATHER THAN THREE NAMES, deliberately, and unlike PROGRAM_IO_
   * above. That table is explicit because PROGRAM_IO_ spans a fenced
   * document, a budget and a missing division — genuinely different kinds.
   * workshop-project.js refuses one kind of thing: a reading that cannot be
   * assembled. A code added there tomorrow gets the right status by
   * construction instead of falling into 1.
   */
  ['WORKSHOP_PROJECT_', SCRIPTORIUM_EXIT.shape],
  ['PROGRAM_', SCRIPTORIUM_EXIT.shape],
  ['CURATOR_CONTEXT_', SCRIPTORIUM_EXIT.context],
  ['AGENT_OP_', SCRIPTORIUM_EXIT.operations],
  ['PRODUCER_', SCRIPTORIUM_EXIT.operations],
  ['ACQUISITION_', SCRIPTORIUM_EXIT.governance],
  ['NARRATION_', SCRIPTORIUM_EXIT.governance],
  ['PUBLICATION_', SCRIPTORIUM_EXIT.governance]
]);

/**
 * The exit status one refusal code is worth.
 *
 * `internal` for anything unnamed, because a status that means "refused, kind
 * unknown" would be a script's licence to treat every refusal alike.
 */
export function exitStatusForCode(code) {
  const name = String(code || '');
  if (Object.hasOwn(PROGRAM_IO_EXIT, name)) return PROGRAM_IO_EXIT[name];
  for (const [prefix, status] of EXIT_FAMILIES) {
    if (name.startsWith(prefix)) return status;
  }
  return SCRIPTORIUM_EXIT.internal;
}

const USAGE = `The Scriptorium, from a terminal. Internal development entrance.

  npm run scriptorium -- <command> [options]

Commands
  context                  the capability document a composer is handed
  prompt                   the brief that travels beside it
  examine <score.json>     the gate's verdict, and nothing loaded
  read <score.json>        resolve the works, compile, and report the reading

Options
  --intent "<text>"        what the reading should be about
  --length <words>         what the reader asked for \
(${SCRIPTORIUM_LENGTH.min}–${SCRIPTORIUM_LENGTH.max})
  --material <path>        a file the reader brought (repeatable)
  --wpm <n>                the reader's pace, which no terminal can read
  --id <id>                fix the session id, for output that can be diffed
  --json                   one JSON object on stdout
  --help

Exit status is the refusal's, not a boolean: 0 accepted, 2 usage, and from 20
up the kind of refusal (docs/vision/SCRIPTORIUM-SPEC.md §13). So

  npm run scriptorium -- examine bad.json; echo $?   ->  32

says the score asked for an opening under the floor, without reading a word of
the reply.
`;

/**
 * What a terminal knows about a file that a browser would have been told.
 *
 * MATERIALS.JS REMAINS THE JUDGE. This says only what the operating system
 * would have said — a name, a size, and the type a browser infers from the
 * extension — and `inspectMaterial` decides whether it may be carried, by the
 * same call the room makes. A second accept policy here is the duplication
 * this whole tranche exists to remove.
 *
 * A video's DURATION cannot be had: probeVideoDurationMs decodes metadata in
 * a <video> element, and there is none. So a clip named here reaches the
 * capability document without its length, and the prompt's video example says
 * so rather than inventing a number.
 */
const MATERIAL_TYPES = Object.freeze({
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4'
});

function materialFromPath(path, held) {
  const stats = statSync(path);
  const file = {
    name: basename(path),
    type: MATERIAL_TYPES[extname(path).toLowerCase()] || '',
    size: stats.size
  };
  const verdict = inspectMaterial(file, { held });
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  return {
    ok: true,
    asset: createSequenceVisualAsset({
      id: `asset-cli-${held + 1}-${file.name.replace(/[^\w.-]+/gu, '-')}`,
      name: file.name,
      kind: verdict.kind === 'video' ? 'video' : 'image',
      storage: SEQUENCE_ASSET_STORAGE_IDB,
      mimeType: file.type,
      byteLength: file.size,
      color: VISUAL_SCORE_COLORS[held % VISUAL_SCORE_COLORS.length]
    })
  };
}

const COMMANDS = new Set(['context', 'prompt', 'examine', 'read']);
const FLAGS_WITH_VALUES = new Set(['--intent', '--length', '--material', '--wpm', '--id']);

/**
 * Strict argv. An unrecognised flag is a refusal, not an omission — the same
 * rule the program validator follows, for the same reason: a misspelling that
 * passes as silence is a run that answered a question nobody asked.
 */
export function parseScriptoriumArgv(argv = []) {
  const args = [...argv];
  const options = { materials: [], json: false, help: false };
  let command = null;
  let file = null;

  while (args.length) {
    const token = args.shift();
    if (token === '--help' || token === '-h') {
      options.help = true;
      continue;
    }
    if (token === '--json') {
      options.json = true;
      continue;
    }
    if (FLAGS_WITH_VALUES.has(token)) {
      if (!args.length) return { usage: `${token} needs a value` };
      const value = args.shift();
      if (token === '--intent') options.intent = value;
      else if (token === '--material') options.materials.push(value);
      else if (token === '--id') options.id = value;
      else {
        const number = Number(value);
        if (!Number.isFinite(number)) return { usage: `${token} needs a number` };
        if (token === '--length') options.length = number;
        else options.wpm = number;
      }
      continue;
    }
    if (token.startsWith('-')) return { usage: `unknown option ${token}` };
    if (!command) {
      if (!COMMANDS.has(token)) return { usage: `unknown command ${token}` };
      command = token;
      continue;
    }
    if (file) return { usage: `${command} takes one file, not two` };
    file = token;
  }

  if (options.help) return { command: 'help' };
  if (!command) return { usage: 'no command' };
  if ((command === 'examine' || command === 'read') && !file) {
    return { usage: `${command} needs a score file` };
  }
  if ((command === 'context' || command === 'prompt') && file) {
    return { usage: `${command} takes no file` };
  }
  return { command, file, options };
}

/**
 * Words as read and atoms as compiled — the two numbers a reading costs.
 *
 * A COMPILE FAILURE IS NOT AN ACCEPTANCE. This used to swallow the failure
 * into `compileRefusal` and let the CLI emit `ok: true, exit: 0`, on the
 * argument that a terminal holds no bytes for the reader's own files, so a
 * score with imagery would compile in the room and not here. That exemption
 * was measured and buys nothing: `read` on a score naming an image material
 * compiles here — 38 words, 39 atoms, no refusal. What it did buy was cover
 * for two real failures, both of which reported
 * `Maximum call stack size exceeded` under `exit: 0`, so a CI script
 * asserting 0 passed on a reading that cannot open.
 *
 * Against "0 is acceptance and nothing else" (§13) the exemption loses. The
 * caller reports the failure and exits non-zero.
 */
function measureReading(project) {
  const sources = project.sources.map(source => ({
    id: source.id,
    name: source.name || source.id,
    words: countWords(source.data)
  }));
  const words = sources.reduce((sum, source) => sum + source.words, 0);
  let atoms = null;
  let compileRefusal = null;
  try {
    atoms = compileSession(workshopProjectToSessionConfig(project)).atoms.length;
  } catch (error) {
    compileRefusal = error?.message || String(error);
  }
  return { words, atoms, sources, compileRefusal };
}

/**
 * @param {string[]} argv the arguments after the script name
 * @param {object} [io]
 * @param {(line: string) => void} [io.out] stdout
 * @param {(line: string) => void} [io.err] stderr
 * @param {(path: string) => string} [io.readTextFile]
 * @returns {Promise<number>} the exit status
 */
export async function runScriptoriumCli(argv = [], io = {}) {
  const out = io.out || ((line) => { process.stdout.write(`${line}\n`); });
  const err = io.err || ((line) => { process.stderr.write(`${line}\n`); });
  const readTextFile = io.readTextFile || ((path) => readFileSync(path, 'utf8'));

  const parsed = parseScriptoriumArgv(argv);
  if (parsed.usage) {
    err(`scriptorium: ${parsed.usage}`);
    err('');
    err(USAGE);
    return SCRIPTORIUM_EXIT.usage;
  }
  if (parsed.command === 'help') {
    out(USAGE);
    return SCRIPTORIUM_EXIT.ok;
  }

  const { command, file, options } = parsed;
  const emit = (payload, lines) => {
    if (options.json) out(JSON.stringify({ command, ...payload }, null, 2));
    else for (const line of lines) out(line);
  };

  const session = createScriptoriumSession({
    wpm: options.wpm ?? null,
    ...(options.id ? { mintId: () => options.id } : {})
  });
  session.setIntent(options.intent ?? '');
  if (options.length != null) session.setTargetWords(options.length);

  for (const path of options.materials) {
    let taken;
    try {
      taken = materialFromPath(path, session.materials.length);
    } catch (error) {
      err(`scriptorium: cannot read ${path}: ${error.message}`);
      return SCRIPTORIUM_EXIT.usage;
    }
    if (!taken.ok) {
      // The room says this beside the panel that took the file. Here it is
      // the reason the run cannot proceed as asked.
      err(`scriptorium: ${taken.reason}`);
      return SCRIPTORIUM_EXIT.usage;
    }
    session.addMaterial(taken.asset);
  }

  /**
   * THE ONE STEP THIS FILE DID NOT WRAP.
   *
   * `take()` builds the capability document, and `--id` flows straight into
   * it: `npm run scriptorium -- context --id "http://example.com/x"` reached
   * `exportCuratorContext` → `validateCuratorContext` and came back out of the
   * process as an uncaught stack trace over exit 1. §13 gives
   * `CURATOR_CONTEXT_*` status 24 — the capability document itself is
   * malformed — and the excuse in scripts/scriptorium-ci.mjs said 24 was
   * unreachable because no flag accepts a context. No flag does; a flag that
   * goes INTO one is the same thing and nothing had looked.
   */
  try {
    session.take();
  } catch (error) {
    const code = error?.code;
    if (!code) throw error;
    const text = describeImportFailure(error, { context: null });
    emit(
      { ok: false, code, exit: exitStatusForCode(code), refusal: text },
      ['REFUSED before the gate', '', text]
    );
    return exitStatusForCode(code);
  }

  if (command === 'context') {
    if (options.json) out(JSON.stringify({ command, ok: true, context: session.context }, null, 2));
    else out(serializeCuratorContext(session.context).trimEnd());
    return SCRIPTORIUM_EXIT.ok;
  }

  if (command === 'prompt') {
    if (options.json) {
      out(JSON.stringify({
        command, ok: true, contextId: session.context.id, prompt: session.promptText
      }, null, 2));
    } else {
      out(session.promptText.trimEnd());
    }
    return SCRIPTORIUM_EXIT.ok;
  }

  let text;
  try {
    text = readTextFile(file);
  } catch (error) {
    err(`scriptorium: cannot read ${file}: ${error.message}`);
    return SCRIPTORIUM_EXIT.usage;
  }

  const verdict = session.examine(text);
  if (!verdict.ok) {
    emit(
      { ok: false, code: verdict.code, exit: exitStatusForCode(verdict.code), refusal: verdict.text },
      ['REFUSED', '', verdict.text]
    );
    return exitStatusForCode(verdict.code);
  }

  if (command === 'examine') {
    emit(
      {
        ok: true,
        code: null,
        exit: SCRIPTORIUM_EXIT.ok,
        kind: verdict.kind,
        status: session.status,
        length: { targetWords: session.targetWords, wpm: session.wpm },
        preview: session.preview,
        rundown: session.rundown,
        operations: session.proposalRows
      },
      [
        'ACCEPTED at the gate.',
        `  ${session.status}`,
        ...describeAccepted(session)
      ]
    );
    return SCRIPTORIUM_EXIT.ok;
  }

  const outcome = await session.read();
  if (!outcome.ok) {
    const code = outcome.verdict.code;
    const details = {
      ok: false,
      code,
      exit: exitStatusForCode(code),
      refusal: outcome.verdict.text,
      // WHAT WAS REFUSED, by id. The prose names them too, but a script that
      // has to grep prose for an id is a script asserting on wording.
      missing: outcome.verdict.details.absent ?? [],
      refused: outcome.verdict.details.unreadable ?? []
    };
    emit(details, ['REFUSED at the reading', '', outcome.verdict.text]);
    return exitStatusForCode(code);
  }

  const measured = measureReading(outcome.project);
  /**
   * EVERY GATE SAID YES AND THE READING STILL WILL NOT OPEN.
   *
   * That is exactly what status 1 is for — "the CLI met something its own
   * vocabulary does not name, which is a bug here rather than a verdict
   * about the score" — and until the gate became exhaustive it was not true:
   * an ordinary score reached this line with 315,299 words and a blown
   * stack. Now the gate refuses the score first, and anything that still
   * arrives here is the bug 1 has always claimed to mean.
   *
   * The words are still printed. They are true, and hiding them would be a
   * second failure on top of the first.
   */
  if (measured.compileRefusal) {
    emit(
      {
        ok: false,
        code: 'SCRIPTORIUM_COMPILE',
        exit: SCRIPTORIUM_EXIT.internal,
        projectId: outcome.project.id,
        words: measured.words,
        atoms: null,
        targetWords: session.targetWords,
        wpm: session.wpm,
        sources: measured.sources,
        refused: [],
        missing: [],
        compileRefusal: measured.compileRefusal
      },
      [
        'DID NOT COMPILE',
        `  ${measured.words.toLocaleString()} words were loaded and the reading `
        + 'could not be built from them.',
        `  ${measured.compileRefusal}`,
        '',
        '  Every gate admitted this score, so this is a fault in RISE rather than '
        + 'a verdict about the score.'
      ]
    );
    return SCRIPTORIUM_EXIT.internal;
  }
  emit(
    {
      ok: true,
      code: null,
      exit: SCRIPTORIUM_EXIT.ok,
      projectId: outcome.project.id,
      words: measured.words,
      atoms: measured.atoms,
      targetWords: session.targetWords,
      wpm: session.wpm,
      sources: measured.sources,
      refused: [],
      missing: [],
      compileRefusal: measured.compileRefusal
    },
    [
      'READ',
      `  ${measured.words.toLocaleString()} words`
      + `${measured.atoms == null ? '' : `, ${measured.atoms.toLocaleString()} atoms`}`
      + ` against a budget of ${session.targetWords.toLocaleString()}`,
      ...measured.sources.map(source =>
        `  ${source.id} — ${source.words.toLocaleString()} words · ${source.name}`),
      '  Nothing refused.'
    ]
  );
  return SCRIPTORIUM_EXIT.ok;
}

/** The verdict, for a person, in the room's own vocabulary. */
function describeAccepted(session) {
  if (session.proposalRows) {
    return [
      `  ${session.proposalRows.length} proposed operation`
      + `${session.proposalRows.length === 1 ? '' : 's'}`,
      ...session.proposalRows.map(row =>
        `  ${row.op} — ${row.status}${row.sourceId ? ` · ${row.sourceId}` : ''}`)
    ];
  }
  const rundown = session.rundown;
  if (!rundown) return [];
  return [
    `  ${rundown.totals.words == null
      ? 'length unknown'
      : `${rundown.totals.words.toLocaleString()} words`}`
    + ` · ${rundown.totals.movements} movement${rundown.totals.movements === 1 ? '' : 's'}`,
    ...(session.preview?.sources || []).map(source =>
      `  ${source.id} — ${source.words == null
        ? 'length unknown'
        : `${source.words.toLocaleString()} words`} · ${source.title}`)
  ];
}
