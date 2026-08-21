#!/usr/bin/env node
/**
 * CI's own use of the Scriptorium CLI — the whole chain, as a process.
 *
 * WHY THIS EXISTS BESIDE THE UNIT TESTS. scriptorium-cli.test.js drives
 * `runScriptoriumCli` in-process, which proves the argv shell and the exit
 * mapping. It cannot prove that `npm run scriptorium` resolves, that vite-node
 * loads a module graph importing division-index.json, or that a refusal code
 * arrives at the shell as an exit status — three joints where nothing is
 * asserted unless something spawns the thing.
 *
 * WHAT IT ASSERTS. For each committed score under fixtures/scriptorium, the
 * documented exit status and the refusal code that goes with it. Not prose:
 * "this input refuses with PROGRAM_IO_EXTENT_FLOOR, which is status 32" is a
 * claim a machine settles, and it was the point of giving refusals codes.
 *
 * AND THAT EVERY DOCUMENTED STATUS IS ACTUALLY PRODUCED BY SOMETHING. Twelve
 * of the eighteen had no fixture, which is how `PROGRAM_IO_EXTENT_GRAMMAR`
 * could be remapped from 33 to 70 with the full suite AND this script green.
 * The rows of §13 are read out of the spec below and every one of them must
 * be reached by a case here or named in UNREACHABLE with the reason it cannot
 * be — so a status with neither fails, which is the only arrangement under
 * which the absence of a fixture is itself a failure.
 *
 * Anything not run by CI is documentation, and documentation about behaviour
 * is a label rather than evidence — three of the fourteen probes this CLI
 * replaces were describing source that had changed within hours of their being
 * written. Every case below runs on every push.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VITE_NODE = join(ROOT, 'node_modules', 'vite-node', 'vite-node.mjs');
const CLI = join(ROOT, 'scripts', 'scriptorium.mjs');
const FIXTURES = join(ROOT, 'scripts', 'fixtures', 'scriptorium');
const SPEC = join(ROOT, 'docs', 'vision', 'SCRIPTORIUM-SPEC.md');

const score = (name) => join(FIXTURES, `${name}.json`);

/**
 * Each case is an argv and the two things it must produce.
 *
 * `exit` is the number a shell sees; `code` is the refusal it stands for, read
 * back out of the CLI's own --json. Asserting both is what keeps the mapping
 * honest in one direction as well as the other: a table that renumbered every
 * status at once would satisfy either half alone.
 */
const CASES = [
  {
    what: 'a division inside the length is admitted',
    argv: ['examine', score('division'), '--length', '200', '--json'],
    exit: 0,
    code: null
  },
  {
    what: 'and it loads, compiles, and reports its words',
    argv: ['read', score('division'), '--length', '200', '--json'],
    exit: 0,
    code: null,
    expect: (payload) => {
      if (!Number.isInteger(payload.words) || payload.words <= 0) {
        return `read reported ${payload.words} words`;
      }
      if (!Number.isInteger(payload.atoms) || payload.atoms < payload.words) {
        return `read reported ${payload.atoms} atoms for ${payload.words} words`;
      }
      // 0 IS ACCEPTANCE AND NOTHING ELSE. `read` used to catch a compile
      // failure into this field and still emit ok: true, exit: 0.
      if (payload.compileRefusal != null) {
        return `read exited 0 with compileRefusal ${JSON.stringify(payload.compileRefusal)}`;
      }
      return null;
    }
  },
  {
    what: 'the same work whole, at the same length, is over budget',
    argv: ['examine', score('whole-work'), '--length', '200', '--json'],
    exit: 40,
    code: 'PROGRAM_IO_BUDGET_EXCEEDED'
  },
  /**
   * THE ONE PLACE A SCORE COULD NAME A WORK THE BUDGET NEVER SAW.
   *
   * A transition clip's anchor carries `sourceIds` of its own, and the budget
   * walked movement tracks alone while the resolver walked every track. This
   * score is `whole-work` moved onto a transition: the same work, the same
   * length, and it used to be admitted.
   */
  {
    what: 'a work named only by a transition is spent by the budget too',
    argv: ['examine', score('transition-budget'), '--length', '200', '--json'],
    exit: 40,
    code: 'PROGRAM_IO_BUDGET_EXCEEDED',
    expect: (payload) => (payload.refusal?.includes('sacred-tao-te-ching — ')
      ? null
      : 'the refusal did not name the transition\'s own source')
  },
  {
    what: 'an operation set meets the same budget as a score',
    argv: ['examine', score('operations-budget'), '--length', '200', '--json'],
    exit: 40,
    code: 'PROGRAM_IO_BUDGET_EXCEEDED'
  },
  {
    what: 'an opening under the floor is refused as a floor',
    argv: ['examine', score('extent-floor'), '--length', '200', '--json'],
    exit: 32,
    code: 'PROGRAM_IO_EXTENT_FLOOR'
  },
  {
    what: 'and refuses the same way through the operations door',
    argv: ['examine', score('operations-extent-floor'), '--length', '20000', '--json'],
    exit: 32,
    code: 'PROGRAM_IO_EXTENT_FLOOR'
  },
  {
    what: 'a division the work does not have is its own refusal',
    argv: ['examine', score('unknown-division'), '--json'],
    exit: 31,
    code: 'PROGRAM_IO_UNKNOWN_DIVISION'
  },
  {
    what: 'a work nobody holds is its own refusal',
    argv: ['examine', score('unknown-work'), '--json'],
    exit: 30,
    code: 'PROGRAM_IO_UNKNOWN_SOURCE'
  },
  {
    what: 'a leading zero is refused as grammar, not corrected to 40',
    argv: ['examine', score('extent-grammar'), '--json'],
    exit: 33,
    code: 'PROGRAM_IO_EXTENT_GRAMMAR',
    expect: (payload) => (payload.refusal?.includes('sacred-tao-te-ching#0040')
      ? null
      : 'the refusal did not quote the id as it was written')
  },
  {
    what: 'a Markdown fence is named, not stripped',
    argv: ['examine', score('fenced'), '--json'],
    exit: 20,
    code: 'PROGRAM_IO_JSON'
  },
  {
    what: 'a published score cannot be laundered through this doorway',
    argv: ['examine', score('published'), '--json'],
    exit: 21,
    code: 'PROGRAM_IO_PUBLISHED_REFUSED'
  },
  {
    what: 'a score carrying a data: URI is refused',
    argv: ['examine', score('smuggled-uri'), '--json'],
    exit: 22,
    code: 'PROGRAM_IO_URI_REFUSED'
  },
  {
    what: 'an unknown field is refused rather than ignored',
    argv: ['examine', score('unknown-field'), '--json'],
    exit: 23,
    code: 'PROGRAM_UNKNOWN_FIELD'
  },
  {
    what: 'a collection nobody offers is refused',
    argv: ['examine', score('unknown-collection'), '--json'],
    exit: 34,
    code: 'PROGRAM_IO_UNKNOWN_COLLECTION'
  },
  /**
   * SIXTY-FIVE AND SIXTY-FOUR, BOTH.
   *
   * 65 chapters of the Tao is 8,456 words against a 20,000 budget — nothing
   * large or exotic — and it used to pass `examine`, fail at the reading with
   * `A Workshop project accepts at most 64 sources ($.sources)`, and exit 1,
   * which §13 says means a bug in the CLI. 64 is asserted beside it because a
   * ceiling tested only from above is a ceiling that may sit one too low.
   *
   * 43 RATHER THAN 42. This is the fixture for the status §13 gave "more
   * works than one session holds" of its own; sharing 42 with the word
   * ceiling meant a shell could not tell "read less" from "name the same
   * reading in fewer ids".
   */
  {
    what: 'more sources than one reading holds is refused at the gate',
    argv: ['examine', score('source-count'), '--length', '20000', '--json'],
    exit: 43,
    code: 'PROGRAM_IO_SOURCE_CEILING',
    expect: (payload) => {
      if (/\bWorkshop\b|\$\.sources/u.test(payload.refusal || '')) {
        return 'the refusal named the Workshop or a JSON path to a reader';
      }
      return payload.refusal?.includes('names 65 sources')
        ? null
        : 'the refusal did not say how many sources the score names';
    }
  },
  {
    what: 'and exactly as many as it holds is admitted',
    argv: ['examine', score('source-count-limit'), '--length', '20000', '--json'],
    exit: 0,
    code: null
  },
  /**
   * THE OTHER CEILING, WHICH IS WHY THE TWO NEEDED TELLING APART.
   *
   * One id, 315,261 words. The ceiling is checked before the budget, so this
   * is 42 at any length the slider offers rather than 40 — the reader cannot
   * ask for a length it would fit in. It shared a status with the case above
   * until §13 gave that one 43, and a fixture per status is what keeps the
   * split from being a claim in a document.
   */
  {
    what: 'more words than one session holds is its own refusal',
    argv: ['examine', score('atom-ceiling'), '--length', '20000', '--json'],
    exit: 42,
    code: 'PROGRAM_IO_ATOM_CEILING',
    expect: (payload) => (payload.refusal?.includes('315,261')
      ? null
      : 'the refusal did not say how long the score reads')
  },
  {
    what: 'an operation set that names a division in a field is refused',
    argv: ['examine', score('operations-division'), '--json'],
    exit: 60,
    code: 'AGENT_OP_DIVISION'
  },
  /**
   * THE FAMILY THE OPERATIONS DOOR NEVER CHECKED.
   *
   * `programSourceIds` made the SOURCE check derived and the derivation
   * stopped at text: a soundscape, a tone preset, a personal swell, a
   * narration voice and a field renderer were all still hand-written
   * allowlists that only `assertProgramWithinContext` consulted. Every one of
   * these five used to exit 0 with "Nothing refused." and persist the invented
   * id into the project — `set-atmosphere` wrote three of them straight into
   * the reading defaults. One fixture per family, because a shared check
   * proved by one case is a check that can lose four.
   */
  {
    what: 'a soundscape nobody offers is refused through the operations door',
    argv: ['examine', score('operations-atmosphere'), '--length', '20000', '--json'],
    exit: 34,
    code: 'PROGRAM_IO_UNKNOWN_SOUNDSCAPE'
  },
  {
    what: 'a tone preset nobody offers is refused through the operations door',
    argv: ['examine', score('operations-tone'), '--length', '20000', '--json'],
    exit: 34,
    code: 'PROGRAM_IO_UNKNOWN_TONE'
  },
  {
    what: 'a personal swell nobody holds is refused rather than fabricated',
    argv: ['examine', score('operations-swell'), '--length', '20000', '--json'],
    exit: 34,
    code: 'PROGRAM_IO_UNKNOWN_SWELL'
  },
  {
    what: 'a narration voice nobody offers is refused at last',
    argv: ['examine', score('operations-voice'), '--length', '20000', '--json'],
    exit: 34,
    code: 'PROGRAM_IO_UNKNOWN_VOICE'
  },
  {
    what: 'a field renderer that is not one of the three is refused',
    argv: ['examine', score('operations-surface'), '--length', '20000', '--json'],
    exit: 34,
    code: 'PROGRAM_IO_UNKNOWN_SURFACE',
    // It exited 1 as EDITOR_ASSET_CUE_KIND and quoted `$.cueTemplate.kind` —
    // a path into an object no reader ever wrote.
    expect: (payload) => (/\$\.cueTemplate/u.test(payload.refusal || '')
      ? 'the refusal quoted an internal path at the reader'
      : null)
  },
  /**
   * A MUSEUM COLLECTION SCORED AS A MUSEUM COLLECTION.
   *
   * Every museum id is in `context.visuals.collections`, and the resolver
   * tested that list BEFORE the `aic-` branch — so the branch was dead code
   * for every id the context offered and `aic-ukiyoe` built a PROCEDURAL
   * field. Accepted, and pointed at a pool that is not one. The cue kind is
   * asserted in scriptorium-gate.test.js, which can see the program; what
   * this case holds is that the reading still opens.
   */
  {
    what: 'a museum collection is admitted through the operations door',
    argv: ['read', score('operations-museum'), '--length', '20000', '--json'],
    exit: 0,
    code: null
  },
  /**
   * THERE IS NO READING HERE, THROUGH THE OTHER DOOR.
   *
   * §13 gives 51 to a document that names nothing to read and the program
   * door enforced it alone. `add-source` then `remove-source` — what a model
   * does when it changes its mind mid-proposal — reached "Ready to read." over
   * a project with zero sources, and the CLI tripped over it three functions
   * later inside measureReading and called it a fault in RISE.
   *
   * This is also what unseated the second half of 51's UNREACHABLE excuse,
   * which argued from a property of the PROGRAM validator and said nothing
   * about the door that had been added beside it.
   */
  {
    what: 'operations that add a work and remove it again leave no reading',
    argv: ['read', score('operations-empty-reading'), '--length', '20000', '--json'],
    exit: 51,
    code: 'PROGRAM_IO_NO_LIBRARY_SOURCES',
    expect: (payload) => (/RISE/u.test(payload.refusal || '')
      ? 'an empty reading was reported as a fault in RISE'
      : null)
  },
  /**
   * THE COMMONEST SCORING MISTAKE THERE IS, in the lane that had no status.
   *
   * The identical mistake in the visual lane exits 50. This one exited 1 —
   * "a bug in the CLI rather than a verdict about the score" — under prose
   * that said REFUSED. They contradicted each other on one line.
   */
  {
    what: 'two beds over one passage is a verdict, not a bug in RISE',
    argv: ['read', score('operations-audio-overlap'), '--length', '20000', '--json'],
    exit: 50,
    code: 'AUDIO_SCORE_OVERLAP'
  },
  /**
   * THE CAPABILITY DOCUMENT ITSELF, which 24's excuse said argv could not
   * reach. No flag accepts a context; `--id` goes INTO one, through
   * `session.mintId()` → `exportCuratorContext` → `validateCuratorContext`,
   * and left the process as an uncaught stack trace over exit 1.
   */
  {
    what: 'an id that is a URI refuses the capability document rather than throwing',
    argv: ['context', '--id', 'http://example.com/x', '--json'],
    exit: 24,
    code: 'CURATOR_CONTEXT_URI_REFUSED'
  },
  {
    what: 'narration cannot take swell authority',
    argv: ['examine', score('narration-duck'), '--json'],
    exit: 70,
    code: 'NARRATION_DUCK_TARGET'
  },
  {
    what: 'an opening the text cannot be cut near refuses at the reading',
    argv: ['read', score('unloadable-opening'), '--json'],
    exit: 50,
    code: 'PROGRAM_IO_LIBRARY_UNLOADABLE',
    expect: (payload) => (payload.refused?.includes('ulysses#18:200')
      ? null
      : `refused ids were ${JSON.stringify(payload.refused)}`)
  },
  {
    what: 'no command is a usage error and not a verdict',
    argv: [],
    exit: 2,
    code: undefined
  },
  {
    what: 'an unknown option is refused rather than ignored',
    argv: ['examine', score('division'), '--trim'],
    exit: 2,
    code: undefined
  }
];

/**
 * A status no committed score can reach, and why not.
 *
 * THIS IS THE ONLY ESCAPE FROM THE COVERAGE CHECK, and each entry is a claim
 * about the CLI or the catalogue rather than about how much work a fixture
 * would be. Each is proved separately in scriptorium-cli.test.js, which can
 * reach paths argv cannot.
 */
/**
 * A status no committed score can reach, and why not.
 *
 * TWO OF THE THREE WERE FALSE and the third was unchecked.
 *
 * 24 argued that "the CLI has no flag that accepts a capability document",
 * which is true and beside the point: `--id` flows INTO one, and
 * `--id "http://example.com/x"` came out of the process as a stack trace.
 * It has a case above now.
 *
 * 51 argued two things. The first — the CLI examines before it reads — holds.
 * The second was the load-bearing half and was about the PROGRAM validator,
 * in an excuse covering a door the operations gate had been added beside;
 * `add-source` then `remove-source` reached the reading with nothing in it.
 * It has a case above now too.
 *
 * 41 is the one that survives, and scriptorium-cli.test.js no longer proves
 * it by iterating a catalogue that could be empty.
 */
const UNREACHABLE = Object.freeze({
  41: 'every work in the catalogue carries a word count, so no score can name '
    + 'a source the budget cannot measure'
});

/** `| 32 | an opening below the floor | \`PROGRAM_IO_EXTENT_FLOOR\` |` */
function documentedStatuses() {
  const spec = readFileSync(SPEC, 'utf8');
  const table = spec.slice(spec.indexOf('## 13.'));
  const found = new Set();
  for (const match of table.matchAll(/^\|\s*(\d+)\s*\|/gmu)) found.add(Number(match[1]));
  return [...found].sort((left, right) => left - right);
}

function run(argv) {
  const result = spawnSync(process.execPath, [VITE_NODE, CLI, '--', ...argv], {
    cwd: ROOT,
    encoding: 'utf8',
    // The archive is loaded from disk for `read`; a slow runner is not a
    // failure, so this is generous rather than tight.
    timeout: 300_000
  });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

if (!existsSync(VITE_NODE)) {
  console.error(`vite-node is not installed at ${VITE_NODE}; run npm ci first.`);
  process.exit(1);
}

const failures = [];
for (const testCase of CASES) {
  const { status, stdout, stderr } = run(testCase.argv);
  const problems = [];
  if (status !== testCase.exit) {
    problems.push(`exited ${status}, expected ${testCase.exit}`);
  }
  if (testCase.code !== undefined) {
    let payload = null;
    try {
      payload = JSON.parse(stdout);
    } catch {
      problems.push(`stdout was not JSON: ${stdout.slice(0, 200)}`);
    }
    if (payload) {
      if ((payload.code ?? null) !== testCase.code) {
        problems.push(`refused with ${payload.code}, expected ${testCase.code}`);
      }
      const extra = testCase.expect ? testCase.expect(payload) : null;
      if (extra) problems.push(extra);
    }
  }
  const mark = problems.length ? 'FAIL' : 'ok  ';
  console.log(`${mark} ${testCase.what}`);
  if (problems.length) {
    for (const problem of problems) console.log(`       ${problem}`);
    if (stderr.trim()) console.log(`       stderr: ${stderr.trim().split('\n')[0]}`);
    failures.push(testCase.what);
  }
}

const produced = new Set(CASES.map(testCase => testCase.exit));
const uncovered = documentedStatuses()
  .filter(status => !produced.has(status) && !UNREACHABLE[status]);
if (uncovered.length) {
  console.log(`FAIL every status §13 documents is produced by a fixture`);
  for (const status of uncovered) {
    console.log(`       nothing here exits ${status}, and it is not named unreachable`);
  }
  failures.push('status coverage');
} else {
  console.log('ok   every status §13 documents is produced by a fixture or named unreachable');
}
// A status that becomes reachable must lose its excuse, or the excuse rots
// into the same kind of stale description this entrance was built against.
const stale = Object.keys(UNREACHABLE).map(Number).filter(status => produced.has(status));
if (stale.length) {
  console.log(`FAIL a status named unreachable was reached: ${stale.join(', ')}`);
  failures.push('stale unreachable claim');
}

if (failures.length) {
  console.error(`\n${failures.length} of ${CASES.length + 1} Scriptorium CLI cases failed.`);
  process.exit(1);
}
console.log(`\nAll ${CASES.length} Scriptorium CLI cases hold, over every documented status.`);
