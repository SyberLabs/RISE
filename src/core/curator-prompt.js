/**
 * Live Curator / Scriptorium prompt — generated at export time, never
 * stored inside rise.curator-context.v1
 * (docs/vision/SCRIPTORIUM-SPEC.md §5).
 *
 * Contexts are shareable; a prompt is an instruction. Keeping them apart
 * prevents a received context file from carrying forged directions.
 *
 * EVERY ID IN HERE IS READ OUT OF THE CONTEXT IT SHIPS WITH.
 * ─────────────────────────────────────────────────────────
 * The worked examples used to name `montaigne-essays` and
 * `extended-dhammapada-full`, both withheld from the shelf (canon.js), so a
 * model that copied the shape faithfully — the behaviour the shape exists to
 * produce — got PROGRAM_IO_UNKNOWN_SOURCE. Nothing could catch that, because
 * the examples were prose and prose is not checked against anything.
 *
 * So the examples are composed from `context.library` and priced against
 * `constraints.targetWords`: the score printed below is a score this context
 * would ACCEPT. curator-prompt.test.js parses the JSON back out of the
 * generated text and puts it through the gate.
 */

import {
  CURATOR_CONTEXT_SCHEMA,
  SEQUENCE_ASSET_DEFAULT_DESCRIPTIONS,
  validateCuratorContext
} from './curator-context.js';
import {
  EXPERIENCE_PROGRAM_LIMITS,
  EXPERIENCE_PROGRAM_SCHEMA
} from './experience-program.js';
import { AGENT_OPERATION_SET_SCHEMA } from './agent-operations.js';
import { BOUNDARY_SOURCE_PREFIX } from './journey-compiler.js';
import {
  MAX_SAFE_TARGET_WORDS, READING_LIMITS, READING_PACE
} from './reading-limits.js';
import {
  EXTENT_MIN_WORDS,
  EXTENT_OVERSHOOT_LIMIT,
  extentNominalWords,
  extentReadingBound
} from './library-extent.js';

const MAX_INTENT = 2_000;

/** How many capability ids a section names before it starts counting. */
const MAX_NAMED = 48;
/**
 * The beat the transition example holds for, kept inside the gate's own range
 * rather than typed as a literal that could drift outside it.
 */
const EXAMPLE_TRANSITION_MS = Math.min(1_200,
  EXPERIENCE_PROGRAM_LIMITS.maxTransitionDurationMs);
/** The opening length the examples ask for, when they need an opening. */
const EXAMPLE_OPENING_WORDS = 200;
/**
 * THE MOST THAT ASK MAY READ, from the function that decides it.
 *
 * The prompt used to price "#12:200" at 320 words and stop there. That figure
 * is `extentReadingBound`'s and was typed in as a literal beside a literal
 * 1.6 — two copies of an arithmetic the gate performs, in prose nothing
 * checks. Any division longer than the bound gives the bound, so the ceiling
 * is what a long division reports.
 */
const EXAMPLE_OPENING_BOUND = extentReadingBound(
  Number.MAX_SAFE_INTEGER, EXAMPLE_OPENING_WORDS
);
/**
 * WHAT THAT ASK COSTS A BUDGET, which is the other number and was the wrong
 * one to leave unsaid.
 *
 * The gate spends what an extent NAMES against the reader's length and the
 * bound only against the atom ceiling (experience-program-io.js says why in
 * full). While the prompt taught the bound as the price, a model obeying it
 * budgeted 320 for a reading that cost 200 and under-filled the reader's
 * length by about 40% — the same defect as the gate's old over-charge with
 * the sign reversed. Both numbers are now said, and both are derived here
 * rather than typed, so the brief cannot drift from the gate again.
 */
const EXAMPLE_OPENING_COST = extentNominalWords(
  EXAMPLE_OPENING_BOUND, EXAMPLE_OPENING_WORDS
);

const number = (value) => Number(value).toLocaleString('en-US');

/**
 * A list of ids as a model can read it: named, wrapped, and honest about
 * what it left out. `${count} offered` is not a capability list.
 */
function idLines(ids, indent = '  ') {
  const named = ids.slice(0, MAX_NAMED);
  const lines = [];
  let line = '';
  for (const id of named) {
    const next = line ? `${line}, ${id}` : `${indent}${id}`;
    if (next.length > 76) {
      lines.push(`${line},`);
      line = `${indent}${id}`;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (ids.length > named.length) {
    lines.push(`${indent}…and ${ids.length - named.length} more in context.json`);
  }
  return lines;
}

/**
 * The largest honest unit of `entry` that costs no more than `share`, passing
 * over anything the score has already named.
 *
 * The same ladder the prompt teaches — whole work, whole division, division's
 * opening — walked here so the worked example obeys the rule it demonstrates
 * and lands inside the reader's budget.
 *
 * SEVERAL PIECES OF ONE WORK IS NOW THE ORDINARY CASE, so `taken` is what a
 * work has already given up: 0 for the whole thing, otherwise the division
 * ordinals. An example that could only ever name one piece per work was
 * teaching a corpus of long chapters that has gone — the shelf's median
 * division is 853 words, and a Spoon River reading is forty epitaphs out of
 * one book.
 *
 * FRONT MATTER IS NOT THE WORK. `divisions.bodyFrom` is the first division
 * that is, and the prompt tells a curator never to name one below it. An
 * example that did would demonstrate the opposite of what it teaches.
 *
 * @returns {{id: string, words: number, title: string, division: number}|null}
 *   `division` is 0 for a whole work, so a caller can record what was spent.
 */
function unitWithin(entry, share, taken = new Set()) {
  const label = (index) => entry.divisions?.labels?.[index] || null;
  if (!taken.size && Number.isInteger(entry.words) && entry.words <= share) {
    return { id: entry.id, words: entry.words, title: entry.title || entry.id, division: 0 };
  }
  const words = Array.isArray(entry.divisions?.words) ? entry.divisions.words : null;
  if (!words || !words.length) return null;
  const body = Number.isInteger(entry.divisions?.bodyFrom) ? entry.divisions.bodyFrom : 1;
  const open = (index) => index + 1 >= body && !taken.has(index + 1);
  let best = -1;
  words.forEach((count, index) => {
    if (!open(index)) return;
    if (count <= share && (best < 0 || count > words[best])) best = index;
  });
  if (best >= 0) {
    return {
      id: `${entry.id}#${best + 1}`,
      words: words[best],
      title: label(best) || `${entry.title || entry.id}, part ${best + 1}`,
      division: best + 1
    };
  }
  // An opening, priced at what it names — which is what the reader's length
  // is spent against. It used to reserve the overshoot, asking for
  // `share / 1.6` so the BOUND would fit; the gate charges the bound only
  // against the atom ceiling now, so reserving it here bought nothing and
  // cost the example about 40% of every length it was generated under.
  const first = words.findIndex((_, index) => open(index));
  if (first < 0) return null;
  const ask = Math.max(EXTENT_MIN_WORDS,
    Math.min(EXAMPLE_OPENING_WORDS, Math.floor(share)));
  const cost = extentNominalWords(extentReadingBound(words[first], ask), ask);
  if (cost == null || cost > share) return null;
  return {
    id: `${entry.id}#${first + 1}:${ask}`,
    words: cost,
    title: `${label(first) || entry.title || entry.id}, opening`,
    division: first + 1
  };
}

/**
 * The pieces the score below names, priced inside the budget.
 *
 * Whole works first, then parts IN ROUNDS — the same ladder the prompt
 * teaches, so the example demonstrates the rule rather than contradicting it,
 * and spread across works before they pile up in one, because that is the
 * measured shape of a reading on this shelf. Each pick is capped at what is
 * left after reserving a floor for the ones still to come, so the total is
 * inside the reader's length whatever the shelf holds. With no library there
 * is nothing honest to name, and the placeholder says so rather than
 * inventing an id.
 */
function exampleSources(ctx, wanted = 2) {
  const entries = [
    ...(ctx?.library || []),
    ...(ctx?.sources || []).filter(source => Number.isInteger(source.words))
  ];
  // TWO CEILINGS, AND THE EXAMPLE OBEYS THE LOWER. The reader's length is
  // advice they set; MAX_SAFE_TARGET_WORDS is the atom ceiling no reader can
  // raise, and a score over it is refused (PROGRAM_IO_ATOM_CEILING). Two whole
  // works were small enough to hide this; six are not, and at the top of the
  // slider the prompt would have printed a score its own gate rejects.
  const budget = ctx?.constraints?.targetWords;
  let remaining = Math.min(budget || Infinity, MAX_SAFE_TARGET_WORDS);
  const picked = [];
  const spent = new Map();
  /**
   * AN EVEN SHARE, AND THE WHOLE REMAINDER ONLY WHERE NOTHING FITS AN EVEN ONE.
   *
   * Reserving one 40-word floor per piece still let the first pick eat the
   * budget: at 20,000 words the example opened on a whole 12,592-word play and
   * then named nine scraps, which is the shape the ladder printed directly
   * beneath it argues against. `share` is therefore the budget divided by the
   * pieces still to find — and the caller widens it to the remainder only
   * after a whole round has found nothing, so a short reading is still
   * fillable and one greedy work cannot trigger the widening for everyone.
   */
  const spend = (entry, { whole, even }) => {
    if (picked.length >= wanted) return false;
    const taken = spent.get(entry.id) || new Set();
    // A work already read whole has nothing left to give.
    if (taken.has(0)) return false;
    const left = wanted - picked.length;
    const full = remaining === Infinity ? Infinity : remaining - (left - 1) * EXTENT_MIN_WORDS;
    const share = even && remaining !== Infinity
      ? Math.min(Math.floor(remaining / left), full)
      : full;
    if (whole && !(Number.isInteger(entry.words) && entry.words <= share)) return false;
    const unit = whole ? unitWithin(entry, share) : unitWithin(entry, share, taken);
    if (!unit || (whole && unit.division !== 0)) return false;
    picked.push(unit);
    taken.add(unit.division);
    spent.set(entry.id, taken);
    if (remaining !== Infinity) remaining -= unit.words;
    return true;
  };
  const round = (options) => {
    let found = false;
    for (const entry of entries) {
      if (spend(entry, options)) found = true;
      if (picked.length >= wanted) break;
    }
    return found;
  };
  // Whole works, then parts, at an even share; the same two passes widened to
  // the remainder only if that left the reading short.
  for (const even of [true, false]) {
    while (picked.length < wanted && round({ whole: true, even })) { /* rounds */ }
    while (picked.length < wanted && round({ whole: false, even })) { /* rounds */ }
  }
  if (picked.length) return picked;
  return [{ id: 'a-source-id-from-context.json', words: 0, title: 'Opening', division: 0 }];
}

/**
 * HOW MANY PIECES A LENGTH IMPLIES, MEASURED OVER THIS SHELF.
 *
 * Not a rule and not an average of nothing: readings were generated at each
 * length and counted. A minute is about two pieces from one or two works; an
 * hour is about ten from five. The prompt prints this ladder and the worked
 * example obeys it, so a model is shown the shape at the length it was asked
 * for rather than always being shown two.
 *
 * MINUTES ARE WHAT WAS MEASURED AND WORDS ARE WHAT IS SPENT, so the words
 * column is derived at READING_PACE.default — the pace a reading that scores
 * none is performed at — rather than being a second set of figures that could
 * drift from the first.
 */
const COMPOSITION_LADDER = Object.freeze([
  Object.freeze({ minutes: 1, pieces: 2, works: 1.7 }),
  Object.freeze({ minutes: 5, pieces: 5, works: 2.6 }),
  Object.freeze({ minutes: 10, pieces: 6, works: 3.1 }),
  Object.freeze({ minutes: 30, pieces: 7, works: 4 }),
  Object.freeze({ minutes: 60, pieces: 9.5, works: 5.2 })
]);

const ladderWords = (minutes) => minutes * READING_PACE.default;

/**
 * The example's piece count for this budget — the ladder, held under the
 * ceiling on movements, which is the real bound on individually-named pieces.
 */
function piecesForLength(budget) {
  const rung = [...COMPOSITION_LADDER]
    .reverse()
    .find(step => (budget || 0) >= ladderWords(step.minutes))
    || COMPOSITION_LADDER[0];
  return Math.min(Math.round(rung.pieces), EXPERIENCE_PROGRAM_LIMITS.maxMovements);
}

/**
 * What the shelf is SHAPED like, counted rather than remembered.
 *
 * The sentence "the median division is 853 words" is the whole argument for
 * composing from several pieces, and a remembered figure is exactly the kind
 * of claim that goes quietly false when a work is acquired or withheld.
 */
function shelfShape(library) {
  const words = (library || []).flatMap(entry =>
    Array.isArray(entry.divisions?.words) ? entry.divisions.words : []);
  if (!words.length) return null;
  const sorted = [...words].sort((a, b) => a - b);
  return {
    works: library.length,
    divisions: sorted.length,
    median: sorted[Math.floor(sorted.length / 2)]
  };
}

/**
 * A division whose OWN number is not its position, found rather than claimed.
 *
 * This is the misaddressing the room could not otherwise warn about: labels
 * and resolver positions agree perfectly, so nothing is broken — but a work
 * served in three parts numbers each part from one, and a model reading
 * "Canto I" as `#1` lands in the wrong canticle. The widest gap on the shelf
 * is the clearest teacher, and it is recomputed from the catalogue so it can
 * never describe a work that has left.
 */
const ROMAN = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };

/**
 * A numeral only counts when a unit word introduces it. "John M. Church" is a
 * Spoon River epitaph and the M is a middle initial; read as a numeral it
 * makes the widest gap on the shelf a thousand and teaches nonsense.
 */
const UNIT_ORDINAL =
  /\b(Book|Chapter|Canto|Part|Volume|Act|Scene|Essay|Letter|Section|Ode|Rune)\s+(\d{1,4}|[IVXLCDM]{1,9})\b/gu;

function ownNumber(label) {
  const matches = [...String(label).matchAll(UNIT_ORDINAL)];
  if (!matches.length) return null;
  const [, unit, numeral] = matches[matches.length - 1];
  if (/^\d+$/u.test(numeral)) return { unit, numeral, value: Number(numeral) };
  let value = 0;
  let previous = 0;
  for (const character of [...numeral.toLowerCase()].reverse()) {
    const digit = ROMAN[character];
    value += digit < previous ? -digit : digit;
    previous = Math.max(previous, digit);
  }
  return value ? { unit, numeral, value } : null;
}

function widestOrdinalGap(library) {
  let found = null;
  for (const entry of library || []) {
    const labels = entry.divisions?.labels;
    if (!Array.isArray(labels)) continue;
    labels.forEach((label, index) => {
      const own = ownNumber(label);
      if (!own || own.value === index + 1) return;
      const gap = Math.abs(own.value - (index + 1));
      if (!found || gap > found.gap) {
        found = { gap, id: entry.id, position: index + 1, label, own };
      }
    });
  }
  return found;
}

/** What the shelf holds, by id, because a count is not a capability list. */
function libraryLines(ctx) {
  const library = ctx?.library || [];
  if (!library.length) return [];
  const lines = [
    `THE SHELF — ${library.length} work${library.length === 1 ? '' : 's'}, `
    + 'named here and described in full in context.json:'
  ];
  for (const entry of library.slice(0, MAX_NAMED)) {
    const count = entry.divisions?.count;
    const parts = Number.isInteger(count) && count > 1
      ? `${count} ${entry.divisions?.noun ? `${entry.divisions.noun}s` : 'divisions'}`
      : 'undivided';
    lines.push(`  ${entry.id.padEnd(23)} ${
      Number.isInteger(entry.words) ? `${number(entry.words)}w`.padStart(9) : '        ?'
    } · ${parts.padEnd(15)} ${entry.title || ''}${
      entry.author ? ` — ${entry.author}` : ''}`.trimEnd());
  }
  if (library.length > MAX_NAMED) {
    lines.push(`  …and ${library.length - MAX_NAMED} more in context.json`);
  }
  return lines;
}

/**
 * The reader's own words about a file, or nothing.
 *
 * Every entry in the catalogue carries a description; only some of them were
 * written by a person. The generated ones say no more than `mediaKind`
 * already does, so printing them would cost a line per file to repeat the
 * heading. Compared against the constants rather than matched on prose,
 * because prose defined in another module is not something this one can check.
 */
function readerDescription(entry) {
  const text = entry?.description;
  if (typeof text !== 'string' || !text.trim()) return null;
  if (entry.kind !== 'sequence-asset') return null;
  return Object.values(SEQUENCE_ASSET_DEFAULT_DESCRIPTIONS).includes(text) ? null : text;
}

function capabilityLines(ctx) {
  if (!ctx) {
    return [
      '',
      'A rise.curator-context.v1 document is supplied separately as context.json.',
      'It names every work, collection, engine and soundscape you may use, and',
      'describes each one. Name only ids that appear there.'
    ];
  }
  const collections = ctx.visuals?.collections || [];
  const engines = ctx.visuals?.engines || [];
  const engineIds = new Set(engines);
  const museums = collections.filter(id => id.startsWith('aic-'));
  const pools = collections.filter(id => engineIds.has(id));
  const families = collections.filter(id => id !== 'global-pool'
    && !id.startsWith('aic-') && !id.startsWith('sequence-asset:') && !engineIds.has(id));
  const soundscapes = ctx.audio?.soundscapes || [];
  const tones = ctx.audio?.tones || [];
  const voices = ctx.audio?.voices || [];
  const surfaces = ctx.visuals?.surfaces || [];
  // What the reader brought, as opposed to what RISE holds. Counted
  // separately because a score that uses someone's own audio or their own
  // images is doing something the Library cannot do for them.
  const materials = [
    ...Object.entries(ctx.catalog?.swells || {}),
    ...Object.entries(ctx.catalog?.collections || {})
      .filter(([, entry]) => entry?.kind === 'sequence-asset')
  ];
  // A video cue names the asset, not the collection the catalogue lists it
  // under, so the example is worth nothing unless it carries the real id.
  const video = materials
    .find(([, entry]) => entry?.mediaKind === 'video')?.[0]
    ?.replace(/^sequence-asset:/u, '') || null;
  return [
    '',
    `CAPABILITIES — the full document is context.json (id: ${ctx.id}), supplied`,
    'beside this prompt. It carries a description for every id below and the',
    'complete division list for every work. Name nothing that is not in it.',
    '',
    ...libraryLines(ctx),
    '',
    ...(collections.length || engines.length
      ? [
        'IMAGERY — a `sourced` cue draws photographs from a museum collection;',
        'a `procedural` cue draws a generated field from a pool, and may name',
        'engines within it.',
        ...(museums.length ? ['  museum collections:', ...idLines(museums, '    ')] : []),
        ...(pools.length ? ['  procedural pools:', ...idLines(pools, '    ')] : []),
        ...(engines.length ? ['  engines:', ...idLines(engines, '    ')] : []),
        ...(families.length
          ? [`  work-engine families: ${families.join(', ')}`,
            '    — imagery written for one book and named after it. These are',
            '    COLLECTION ids, not source ids.']
          : []),
        ...(collections.includes('global-pool')
          ? ['  global-pool — every image the reader added to this project.'] : [])
      ]
      : []),
    ...(soundscapes.length || tones.length
      ? ['SOUND — soundscapes: ' + soundscapes.join(', ')
        + (tones.length ? `;  tones: ${tones.join(', ')}` : '')]
      : []),
    // A CAPABILITY THE GATE CHECKS HAS TO BE A CAPABILITY THE PROMPT NAMES.
    // Neither of these was offered anywhere, so a voice could not be chosen on
    // purpose and a field renderer could only be guessed at.
    ...(voices.length
      ? [`VOICE — narration is spoken by: ${voices.join(', ')}. A voice is not a `
        + 'bed and not a swell; it may duck the bed and nothing more.']
      : []),
    ...(surfaces.length
      ? [`FIELD — a \`field\` cue names one renderer: ${surfaces.join(', ')}.`]
      : []),
    ...(materials.length
      ? [
        '',
        `THE READER'S OWN — ${materials.length} file${materials.length === 1 ? '' : 's'} `
        + 'they added to this project:',
        ...materials.slice(0, 24).flatMap(([id, entry]) => {
          const facts = [
            entry?.mediaKind,
            Number.isInteger(entry?.durationMs)
              ? `${(entry.durationMs / 1000).toFixed(1)}s`
              : null
          ].filter(Boolean).join(' · ');
          return [
            `  ${id}${entry?.name ? `  ${entry.name}` : ''}${facts ? `  (${facts})` : ''}`,
            ...(readerDescription(entry) ? [`      "${readerDescription(entry)}"`] : [])
          ];
        }),
        'These are the reader\'s own, not the Library\'s: RISE describes them',
        'rather than vouching for them. Use them where the reading is about',
        'what they brought. An image is scored as a `sourced` cue over its',
        'collection id, exactly like a museum set.',
        // A DESCRIPTION IS THE ONLY THING HERE THAT IS NOT A MEASUREMENT.
        // Filename, kind and duration are facts RISE read off the file; a
        // quoted line is the reader talking about their own photograph, and
        // it is the only signal that can tell a composer WHERE the image
        // belongs rather than merely that it exists.
        ...(materials.some(([, entry]) => readerDescription(entry))
          ? ['A quoted line under a file is the reader\'s own description of it,',
            'in their words. Place that file where the reading touches what they',
            'describe; an undescribed file has no such claim and is yours to',
            'arrange.']
          : []),
        ...(video
          ? [
            'A MOVING PICTURE IS NOT AN IMAGE. Scoring one as a still is refused',
            '(VISUAL_SCORE_ASSET_KIND). Its cue names the asset directly, without',
            'the `sequence-asset:` prefix, and its `durationMs` above is how long',
            'it actually runs — so you can give it a span it can fill:',
            `  { "kind": "video", "assetId": "${video}", "timeMode": "loop",`,
            '    "audioPolicy": "muted", "reducedMotion": "poster" }',
            '  timeMode is cue | fit-span | loop | hold-final.'
          ]
          : [])
      ]
      : [])
  ];
}

/**
 * A budget the reader set is a refusal, not advice, so it is stated as one.
 * Without it the ceiling is the compiler's and the only honest guidance is
 * approximate.
 */
function lengthLines(ctx, extent) {
  const budget = ctx?.constraints?.targetWords;
  const head = budget
    ? [
      `LENGTH — the reader asked for about ${number(budget)} words, and this is a`,
      'HARD LIMIT: a score over it is refused, not trimmed.',
      'The length of your score is the sum of the words your movement clips',
      'name. Add them up before you answer. Reach the number with SEVERAL SHORT',
      'PIECES rather than one long one — that is the shape of this shelf, and',
      'COMPOSING FROM SEVERAL PIECES below says how many a length implies.'
    ]
    : [
      'LENGTH — the reading has a hard ceiling of 120,000 atoms, and in word',
      'chunking one word is one atom. Every library entry carries a `words`',
      'count: keep the sum across the sources you name under about 100,000,',
      'or the session will refuse to compile. Reach that with several short',
      'pieces rather than a list of whole books — COMPOSING FROM SEVERAL',
      'PIECES below says how many a length implies.'
    ];
  return [
    ...head,
    '',
    'EXTENT — you may name a whole work, one of its divisions, or a',
    "division's opening. The extent rides in the source id:",
    `  "${extent.work}"${' '.repeat(Math.max(1, extent.pad))}the whole work, `
    + '`words` from the catalogue',
    `  "${extent.division}"${' '.repeat(Math.max(1, extent.pad - extent.suffix))}`
    + `division ${extent.ordinal} entire — \`divisions.words[${extent.ordinal - 1}]\``
    + (extent.words ? ` is ${number(extent.words)}` : ''),
    `  "${extent.opening}"${' '.repeat(Math.max(1, extent.pad - extent.openingSuffix))}`
    + `its opening ~${EXAMPLE_OPENING_WORDS} words, cut at the nearest sentence`,
    "Use the largest unit that fits the reader's length: a whole work if it",
    "fits, else a division, else a division's opening.",
    '',
    'HOW LONG A DIVISION IS — `divisions.words` is one count per division, in',
    'the same order as `divisions.labels`, so division n costs',
    '`divisions.words[n-1]`. These are measured, not averaged'
    + (extent.range
      ? `: on this shelf a division runs from ${number(extent.range.min)} words `
        + `to ${number(extent.range.max)}, so`
      : ', so'),
    "dividing a work's `words` by its `divisions.count` will mislead you.",
    '',
    'THREE WAYS AN EXTENT IS REFUSED — the gate refuses, it never repairs, so',
    'a near miss returns nothing rather than something else:',
    "- A division the work does not have. Ordinals start at 1 and end at the",
    "  entry's `divisions.count`.",
    `- An opening under ${EXTENT_MIN_WORDS} words: "#12:37" asks for a fragment,`,
    '  not an opening.',
    `- An opening the text cannot be cut near. "#12:${EXAMPLE_OPENING_WORDS}" costs `
    + `${number(EXAMPLE_OPENING_COST)} words`,
    "  against the reader's length, because an opening delivers the boundary",
    '  nearest its ask; RISE rounds to a sentence, so it may READ up to '
    + `${EXTENT_OVERSHOOT_LIMIT}×`,
    `  that — ${number(EXAMPLE_OPENING_BOUND)} words. Budget the first and add `
    + 'those up; the second is',
    '  only the most it can run to. Where the first honest boundary lies past',
    `  ${number(EXAMPLE_OPENING_BOUND)}, the id is refused rather than handed back `
    + '5,714 words for a',
    `  ${EXAMPLE_OPENING_WORDS}-word ask.`,
    '',
    'CHOOSING A DIVISION — `divisions.labels` names every division in order,',
    'so labels[0] is division 1. Choose by the name: a reader meets',
    `"${extent.label}", not "division ${extent.ordinal}".`,
    '',
    "A DIVISION'S POSITION IS NOT THE WORK'S OWN NUMBER. `#5` is the fifth",
    'entry in `divisions.labels`, whatever that entry calls itself — and a',
    'work served in several parts numbers each part from one, so the second',
    "part's Chapter I is not `#1`.",
    ...(extent.gap
      ? [`  In ${extent.gap.id}, ${JSON.stringify(extent.gap.label)} is division `
        + `${extent.gap.position} — not division ${extent.gap.own.value}.`]
      : []),
    'Find the label you mean in the list and count its position. Never turn a',
    'remembered chapter, canto or book number into an ordinal directly; where',
    'the two happen to agree, nothing marks the difference.',
    '',
    '`divisions.authored` says whether the scheme is the author\'s own or',
    'RISE-measured, and `divisions.reason` says which — prefer authored',
    'schemes when you cut, since those divisions are real units of the work.',
    'When authored is false (reason "measured"), RISE imposed the cuts: name',
    'progress or quotations rather than "Reading N".',
    '`divisions.bodyFrom`, when present, is the first division that is the',
    "WORK: everything before it is the edition's front matter, a scanner's",
    'header or a table of contents. Never name a division below it.'
  ];
}

/**
 * HOW TO COMPOSE A READING OUT OF SEVERAL PIECES.
 *
 * WHAT WAS HERE BEFORE. One sentence — "prefer fewer works over a long list of
 * whole books" — written for a corpus of long chapters, and pointing the wrong
 * way on the shelf as it now stands. Nothing said how many pieces a length
 * implies, nothing said that array order is reading order, neither ceiling
 * appeared anywhere, pace was only ever discussed WITHIN a source, and the
 * word juxtaposition did not occur. A model reading it composed a list.
 *
 * Every number below is read out of the shelf, the ladder, or a limits
 * constant, so none of them can quietly go false: `maxMovements` in
 * particular belongs to experience-program.js and may change under this file.
 */
function compositionLines(ctx, picked) {
  const shape = shelfShape(ctx?.library);
  // THE CROSSING THE EXAMPLE DESCRIBES IS THE ONE IT ANCHORS. `data` names the
  // movements and `anchor` names their sources, and if those two disagree the
  // snippet is a refusal printed as a lesson — so both come from the same pair.
  const from = picked[0];
  const to = picked.length > 1 ? picked[1] : null;
  const pad = (value) => String(value).padStart(7);
  return [
    '',
    'COMPOSING FROM SEVERAL PIECES — the ordinary case, not the exception.',
    ...(shape
      ? [`This shelf holds ${number(shape.divisions)} divisions across `
        + `${number(shape.works)} works, and the median division is`,
      `${number(shape.median)} words — so a reading of any length is several pieces from`,
      'several works rather than one book cut into parts. A whole book is the',
      'unusual answer now.']
      : ['A work is divided, and a division is short. A reading of any length is',
        'several pieces from several works rather than one book cut into parts.']),
    '',
    'HOW MANY PIECES A LENGTH IMPLIES — measured over this shelf, with the',
    `words column taken at ${READING_PACE.default} wpm:`,
    ...COMPOSITION_LADDER.map(step =>
      `  ${pad(number(ladderWords(step.minutes)))} words`
      + `${String(`~${step.minutes} min`).padStart(10)}`
      + `${String(step.pieces).padStart(6)} pieces across ${step.works} works`),
    'Longer than that the shape holds and grows: more pieces, and more works',
    'among them. These are the middle of a measured range, not a quota — forty',
    'Spoon River epitaphs is a legitimate thirty minutes, and so is one long',
    'chapter if the intent asks for one.',
    '',
    'ORDER — the movement track in ARRAY ORDER is the reading order, and it is',
    'the only thing in the document that says anything about sequence.',
    '`data.index` is that claim written down: it counts 0, 1, 2 … with no gaps',
    'and must equal the clip\'s own position, or the score is refused',
    '(PROGRAM_MOVEMENT_INDEX). No other track\'s position means anything — a',
    'visual track listed before the movements does not reverse the reading.',
    '',
    `THE CEILINGS — ${number(READING_LIMITS.maxSources)} sources and `
    + `${number(EXPERIENCE_PROGRAM_LIMITS.maxMovements)} movements in one reading.`,
    `Because \`data.title\` lives on the movement clip, ${number(EXPERIENCE_PROGRAM_LIMITS.maxMovements)} is the real`,
    'bound on pieces you can name to the reader one by one — a Spoon River',
    'reading reaches it at about eleven minutes. Past that, a movement may own',
    'SEVERAL sourceIds: group the neighbours under one movement and title the',
    'group.',
    '',
    'WHAT A JUXTAPOSITION IS FOR. A list is what you get when the order carries',
    'no argument. An ordering is a claim: an epitaph of self-justification set',
    'against the Tao on water says something neither says alone, and says it in',
    'that direction — reverse the two and the claim reverses with them. Choose',
    'what abuts what. Ask of each join what the reader learns by crossing it,',
    'and if the answer is nothing, the two pieces are in the wrong order or one',
    'of them is not in the reading.',
    '',
    'PACE IS HOW YOU KEEP TWO VOICES APART. The reading track is discussed',
    'above as a way to move WITHIN a passage, and that is the smaller half of',
    'it. Moving between an epitaph and a Tao chapter is exactly what it is for:',
    'a plain-spoken dead Illinoisan and a Chinese aphorism should not arrive at',
    'the same speed or in the same size of phrase. A pace clip anchored to a',
    'source with NO range covers that source entirely, so giving a voice its',
    'own wpm and chunkMode costs one clip.',
    '',
    'TRANSITIONS — a scored silence between two movements, carrying cues of its',
    'own. RISE already marks every join without being asked: the reader is',
    'shown the name of the piece arriving, and more prominently when the work',
    'changes than when it does not. A transition is how you take that beat and',
    'make it yours. One optional track, and every field below is required:',
    '',
    '  { "id": "transitions", "kind": "transition", "clips": [',
    `    { "id": "t1", "durationMs": ${EXAMPLE_TRANSITION_MS},`,
    // A ONE-PIECE READING HAS NOTHING TO CROSS INTO, so the example is a coda
    // there rather than a clip naming an m2 the score above does not contain.
    // The two shapes are the same clip minus a field, which is the whole of
    // what the sentence below says about codas.
    `      "data": { "fromMovementId": "m1"${to ? ', "toMovementId": "m2"' : ''} },`,
    `      "anchor": { "sourceIds": ["${BOUNDARY_SOURCE_PREFIX}t1"],`,
    `                  "afterSourceId": "${from.id}"${to ? ',' : ' } }'}`,
    ...(to ? [`                  "beforeSourceId": "${to.id}" } }`] : []),
    '  ] }',
    '',
    `durationMs is ${number(EXPERIENCE_PROGRAM_LIMITS.minTransitionDurationMs)}`
    + `–${number(EXPERIENCE_PROGRAM_LIMITS.maxTransitionDurationMs)}. The sourceId is `
    + 'SYNTHETIC: it names no text, it is',
    `program-local, it must begin \`${BOUNDARY_SOURCE_PREFIX}\` and it must appear nowhere`,
    'else in the document. A visual or audio clip may anchor to it, which is how',
    'a crossing gets an image or a held breath of its own. For a coda after the',
    'last movement, omit toMovementId and beforeSourceId.',
    `At most ${number(EXPERIENCE_PROGRAM_LIMITS.maxTransitions)} of them, and a transition `
    + 'costs no words: it is a silence,',
    'not a reading.'
  ];
}

/**
 * The extent grammar, taught with a work this context actually holds.
 *
 * The division chosen is the longest one in the most-divided work, so both
 * "the division entire" and "its opening" are sensible things to ask for.
 */
function extentExample(ctx) {
  const library = (ctx?.library || []).filter(entry =>
    Array.isArray(entry.divisions?.words) && entry.divisions.words.length > 1);
  const entry = library.reduce((best, item) =>
    (!best || item.divisions.words.length > best.divisions.words.length ? item : best), null);
  const gap = widestOrdinalGap(ctx?.library);
  const all = library.flatMap(item => item.divisions.words);
  const range = all.length ? { min: Math.min(...all), max: Math.max(...all) } : null;
  if (!entry) {
    const fallback = (ctx?.library || [])[0]?.id || 'a-work-id';
    const suffix = '#12';
    const openingSuffix = `#12:${EXAMPLE_OPENING_WORDS}`;
    return {
      work: fallback,
      division: `${fallback}${suffix}`,
      opening: `${fallback}${openingSuffix}`,
      ordinal: 12,
      words: 0,
      label: 'the name the catalogue gives it',
      pad: openingSuffix.length + 2,
      suffix: suffix.length,
      openingSuffix: openingSuffix.length,
      gap,
      range
    };
  }
  const words = entry.divisions.words;
  let ordinal = 1;
  words.forEach((count, index) => { if (count > words[ordinal - 1]) ordinal = index + 1; });
  const suffix = `#${ordinal}`;
  const openingSuffix = `#${ordinal}:${EXAMPLE_OPENING_WORDS}`;
  return {
    work: entry.id,
    division: `${entry.id}${suffix}`,
    opening: `${entry.id}${openingSuffix}`,
    ordinal,
    words: words[ordinal - 1],
    label: entry.divisions.labels?.[ordinal - 1] || entry.title || entry.id,
    pad: openingSuffix.length + 2,
    suffix: suffix.length,
    openingSuffix: openingSuffix.length,
    gap,
    range
  };
}

/**
 * @param {object} options
 * @param {string} [options.intent] reader wish
 * @param {object} [options.context] validated or raw curator context
 * @returns {string} plain text for the clipboard / a .txt download
 */
export function buildCuratorPrompt({ intent = '', context = null } = {}) {
  const wish = typeof intent === 'string' ? intent.trim().slice(0, MAX_INTENT) : '';
  const ctx = context
    ? (context.schema === CURATOR_CONTEXT_SCHEMA
      ? context
      : validateCuratorContext(context))
    : null;

  /**
   * HOW MANY PIECES THE EXAMPLE SHOWS IS NOW THE READER'S LENGTH'S ANSWER.
   *
   * It was always exactly two — at 2,000 words and at 60,000, only the ids
   * changing — so the one thing a model most needed the shape to demonstrate
   * was the one thing it never did.
   */
  const picked = exampleSources(ctx, piecesForLength(ctx?.constraints?.targetWords));
  const first = picked[0];
  // WHERE THE SECOND VOICE IS SCORED. Every cue in this example used to anchor
  // to `m1`, so the second movement arrived bare however long the example got
  // — the model was shown a scored opening followed by an unscored remainder,
  // which is exactly the list the shelf now tempts it into.
  const last = picked.length > 1 ? picked[picked.length - 1] : null;
  const collections = ctx?.visuals?.collections || [];
  // A museum set for the `sourced` cue where there is one: `global-pool` heads
  // the list and is every image the READER added, which for a reader who has
  // added none is an example of an empty screen.
  const visualCollection = collections.find(id => id.startsWith('aic-'))
    || collections.find(id => id !== 'global-pool')
    || collections[0] || 'a-collection-id';
  const proceduralEngine = ctx?.visuals?.engines?.[0] || 'an-engine-id';
  const soundscapes = ctx?.audio?.soundscapes || [];
  const soundscape = soundscapes[0] || 'a-soundscape-id';
  const secondSoundscape = soundscapes[1] || soundscape;
  const extent = extentExample(ctx);

  const lines = [
    'You are arranging an audiovisual reading score for RISE.',
    'Return ONLY a single JSON object. No markdown fences, no commentary.',
    '',
    `Schema: "${EXPERIENCE_PROGRAM_SCHEMA}" or "${AGENT_OPERATION_SET_SCHEMA}"`,
    'Authority: omit it, or use "proposed" / "user". Never "published".',
    'editable: true',
    ...capabilityLines(ctx),
    '',
    'SHAPE — every field below is required where shown. Anchors live INSIDE',
    'an `anchor` object; tracks and clips carry ids; movement clips carry',
    '`data`; visual and audio tracks carry a `fallback`.',
    ...(ctx?.library?.length
      ? ['The ids below are real ones from the document above and the lengths fit',
        'the reader\'s budget, so this is a score the session would accept — but',
        'it is a shape, not a suggestion. Choose for the intent.']
      : ['The ids below are placeholders: substitute ids from context.json.']),
    '',
    '{',
    '  "schema": "rise.experience-program.v1",',
    '  "id": "memory-and-loss",',
    '  "authority": "proposed",',
    '  "editable": true,',
    '  "tracks": [',
    '    { "id": "movements", "kind": "movement", "clips": [',
    ...picked.flatMap((source, index) => [
      `      { "id": "m${index + 1}", "anchor": { "sourceIds": ["${source.id}"] },`,
      `        "data": { "index": ${index}, "title": ${JSON.stringify(source.title)} } }`
      + (index < picked.length - 1 ? ',' : '')
    ]),
    '    ] },',
    '    { "id": "visuals", "kind": "visual", "fallback": { "kind": "still" }, "clips": [',
    `      { "id": "v1", "cue": { "kind": "procedural", "collections": ["${proceduralEngine}"] },`,
    `        "anchor": { "sourceIds": ["${first.id}"],`,
    '                    "fromProgress": 0, "toProgress": 0.6 } },',
    `      { "id": "v2", "cue": { "kind": "sourced", "collections": ["${visualCollection}"] },`,
    `        "anchor": { "sourceIds": ["${first.id}"],`,
    `                    "fromProgress": 0.6, "toProgress": 1 } }${last ? ',' : ''}`,
    ...(last
      ? [
        `      { "id": "v3", "cue": { "kind": "sourced", "collections": ["${visualCollection}"] },`,
        `        "anchor": { "sourceIds": ["${last.id}"] } }`
      ]
      : []),
    '    ] },',
    '    { "id": "bed", "kind": "audio", "fallback": { "kind": "silence", "fadeMs": 500 },',
    '      "clips": [',
    `      { "id": "a1", "cue": { "kind": "soundscape", "soundscapeId": "${soundscape}" },`,
    `        "anchor": { "sourceIds": ["${first.id}"] } }${last ? ',' : ''}`,
    ...(last
      ? [
        `      { "id": "a2", "cue": { "kind": "soundscape", "soundscapeId": "${secondSoundscape}" },`,
        `        "anchor": { "sourceIds": ["${last.id}"] } }`
      ]
      : []),
    '    ] },',
    '    { "id": "pace", "kind": "reading", "clips": [',
    '      { "id": "p1", "cue": { "kind": "pace", "wpm": 150 },',
    `        "anchor": { "sourceIds": ["${first.id}"],`,
    `                    "fromProgress": 0, "toProgress": 0.25 } }${last ? ',' : ''}`,
    ...(last
      ? [
        '      { "id": "p2", "cue": { "kind": "pace", "wpm": 110, "chunkMode": "phrase" },',
        `        "anchor": { "sourceIds": ["${last.id}"] } }`
      ]
      : []),
    '    ] }',
    '  ]',
    '}',
    '',
    'A movement clip anchored with no range covers its whole source.',
    ...(last
      ? ['The cues above do not all sit on the first movement: v3, a2 and p2 give',
        'the last piece a world and a voice of its own. A piece nothing is scored',
        'over arrives bare, which is how a stitch comes to read as a list.']
      : []),
    'Structure:',
    '- Exactly one non-empty movement track (kind "movement").',
    '- Optional transition, visual, audio (bed), swell, and reading tracks.',
    '  A transition is a scored silence between two movements — see COMPOSING',
    '  FROM SEVERAL PIECES below for its four fields and an example.',
    '- Each clip names sourceIds drawn from context.json (library works and/or',
    '  loaded sources). Ids only — no URLs, no data:, no blob:, no embedded',
    '  text or images.',
    '- Visual cues: still | focal | sourced { collections } |',
    '  procedural { collections, engines? } | video { assetId, timeMode,',
    '  audioPolicy: "muted", reducedMotion: "poster" }',
    '- Audio bed cues: silence | hold | soundscape { soundscapeId } | tone { presetId }',
    '- Swell cues: { kind: "swell", swellId }',
    '- Reading (pace) cues: { kind: "pace", wpm?, chunkMode? } — at least one.',
    '  wpm is 50–1000; chunkMode is word | phrase | sentence | paragraph.',
    '',
    'PACE — this is how the reading itself moves, and it is the one lane no',
    'other tool gives you. Use it to slow into a passage, to hold a section',
    'in whole phrases rather than single words, or to quicken a narrative',
    'stretch. THE READING TRACK IS OPTIONAL: Leave it out entirely where the',
    'reader\'s own pace is right for the arrangement, which is the common',
    'case — an unscored stretch runs at their pace. A cue that sets neither',
    'wpm nor chunkMode occupies its span while saying nothing, and is refused.',
    'Both are fields of a pace CUE and of nothing else: not the program, not',
    'a track, not a movement. There is no `curve` anywhere — do not invent one.',
    'A chunkMode cue needs a QUOTATION anchor (or no range at all, meaning',
    'the whole source). It cannot use progress, because progress is measured',
    'in the very atoms the chunk mode would change. wpm has no such limit.',
    'Within ONE source, keep every pace clip in the SAME coordinate system —',
    'all progress ranges, or all quotations. Two ranged clips in different',
    'systems cannot be shown not to overlap, so they are refused.',
    '',
    'Anchoring — three ways to point at a place in the text:',
    '1. Progress (preferred for broad arcs). Half-open [fromProgress, toProgress)',
    '   in 0–1, measured in reading words. Adjacent ranges may abut',
    '   (to === next from) and must not overlap. Do NOT attach quote',
    '   fingerprints to progress spans.',
    '2. Quotation (preferred for remembered lines). quoteStart and quoteEnd',
    '   only — no offsets. RISE will locate the lines in the edition or',
    '   omit the clip if they are absent. quoteStart must appear exactly',
    '   once in the source; a repeated phrase is refused — extend it until',
    '   it is unique. Do not invent character offsets.',
    '3. Character / token spans with quotes — Workshop authoring only;',
    '   you have not been given the bytes, so do not use these.',
    '',
    ...lengthLines(ctx, extent),
    ...compositionLines(ctx, picked),
    '',
    'Proportional thinking: if you would assign weights (e.g. 1:2:1),',
    'emit contiguous progress ranges that sum to 1 instead',
    '(e.g. [0,0.25), [0.25,0.75), [0.75,1)). The program has no weights field.',
    '',
    'Work-bound engines (flaming_sword, ascii_soldier, …) were authored for',
    'specific books. Prefer them only when the chosen source matches their',
    '`work` in the context catalogue; otherwise use procedural engines',
    '(klee, turrell, fractal, …) or museum collections (aic-…).'
  ];

  if (wish) {
    lines.push('', 'Reader intent:', wish);
  } else {
    lines.push('', 'Reader intent: (none supplied — choose a coherent audiovisual reading.)');
  }

  lines.push(
    '',
    'ALTERNATIVE — instead of a complete score you may return a bounded',
    'operation list. Same ids. No network acquisition. Every op is a command a',
    'person can already perform. This room applies them to an EMPTY project at',
    'revision 0, so an operation that edits, replaces or erases existing work',
    'has nothing to act on here.',
    '',
    '{',
    '  "schema": "rise.agent-operation-set.v1",',
    '  "id": "ops-memory-1",',
    '  "projectId": "project-memory",',
    '  "baseRevision": 0,',
    '  "generationId": "run-1",',
    '  "intent": "Build quietly, then open into color.",',
    '  "operations": [',
    `    { "op": "add-source", "id": "op-source", "sourceId": "${first.id}" },`,
    '    { "op": "assign-visual", "id": "op-visual", "assignmentId": "v1",',
    `      "sourceId": "${first.id}", "assetId": "procedural:${proceduralEngine}",`,
    '      "fromCharacter": 0, "toCharacter": 80 },',
    '    { "op": "assign-audio", "id": "op-audio", "assignmentId": "a1",',
    `      "sourceId": "${first.id}", "assetId": "soundscape:${soundscape}",`,
    '      "fromCharacter": 0, "toCharacter": 80 },',
    '    { "op": "set-pace", "id": "op-pace", "assignmentId": "p1",',
    `      "sourceId": "${first.id}", "cue": { "wpm": 150 } }`,
    '  ]',
    '}',
    '',
    'The operations this room can carry out: add-source, reorder-source,',
    'assign-visual, assign-audio, set-pace. `add-source` takes the extent in',
    'the source id and has no `division` field — naming one is refused, with',
    'the id you meant. The set defines more ops (narration, sync groups,',
    'render profiles, atmosphere, acquisition requests); none of them changes',
    'what this room reads. Do not invent ops.',
    '',
    // THE TWO DOORS DISAGREED AND THE PROMPT TAUGHT THE REFUSING ONE. The only
    // mention of transitions anywhere in this brief said create-transition is
    // refused "because the Workshop has no such command", which a model reads
    // as "transitions do not exist" — on the one construct written for exactly
    // the problem an inverted shelf poses. The refusal is correct and it
    // stands (agent-operations.js says why in full); what changes is that the
    // sentence now says which door DOES take one.
    'TRANSITIONS BELONG TO A SCORE, NOT TO AN OPERATION LIST. create-transition',
    'and revise-transition are refused here — not because RISE lacks them, but',
    'because an operation set is a list of commands a person can already',
    'perform, and the Workshop has no transition control for a person to',
    'inspect or undo. The score above takes a `transition` track and compiles',
    'it. If a reading needs a scored crossing, return a program, not operations.',
    '',
    'There is no publish, approve, deliver, withdraw, or channel-policy operation.',
    'Publication is a human decision over a hashed artifact; rendering does not post.',
    'baseRevision must match the project; a newer human edit refuses the set.',
    'Rationale is optional explanation and never enters the Experience Program.'
  );

  return `${lines.join('\n')}\n`;
}
