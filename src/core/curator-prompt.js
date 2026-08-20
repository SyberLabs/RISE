/**
 * Live Curator / Scriptorium prompt — generated at export time, never
 * stored inside rise.curator-context.v1 (SCRIPTORIUM-SPEC §5).
 *
 * Contexts are shareable; a prompt is an instruction. Keeping them apart
 * prevents a received context file from carrying forged directions.
 */

import { CURATOR_CONTEXT_SCHEMA, validateCuratorContext } from './curator-context.js';
import { EXPERIENCE_PROGRAM_SCHEMA } from './experience-program.js';
import { AGENT_OPERATION_SET_SCHEMA } from './agent-operations.js';

const MAX_INTENT = 2_000;

/**
 * A budget the reader set is a refusal, not advice, so it is stated as one.
 * Without it the ceiling is the compiler's and the only honest guidance is
 * approximate.
 */
function lengthLines(ctx) {
  const budget = ctx?.constraints?.targetWords;
  if (!budget) {
    return [
      'LENGTH — the reading has a hard ceiling of 120,000 atoms, and in word',
      'chunking one word is one atom. Every library entry carries a `words`',
      'count: keep the sum across the sources you name under about 100,000,',
      'or the session will refuse to compile. Prefer a few works, or name',
      'fewer movements, rather than a long list of whole books.'
    ];
  }
  return [
    `LENGTH — the reader asked for about ${budget.toLocaleString()} words, and this is a`,
    'HARD LIMIT: a score over it is refused, not trimmed.',
    'The length of your score is the sum of the words your movement clips',
    'name. Add them up before you answer, and prefer fewer works over a long',
    'list of whole books.',
    '',
    'EXTENT — you may name a whole work, one of its divisions, or a',
    "division's opening. The extent rides in the source id:",
    '  "montaigne-essays"        the whole work, `words` from the catalogue',
    '  "montaigne-essays#42"     division 42 entire',
    '  "montaigne-essays#42:200" the opening ~200 words of division 42,',
    '                            cut at the nearest sentence',
    "Ordinals start at 1 and must be within that entry's `divisions.count`;",
    'a division a work does not have is refused, not neared. Use the largest',
    "unit that fits the reader's length: a whole work if it fits, else a",
    "division, else a division's opening. `divisions.noun` names the unit",
    '(Essay, Chapter, Book) and `divisions.authored` says whether the scheme',
    "is the author's own or RISE-measured — prefer authored schemes when you",
    'cut, since those divisions are real units of the work.',
    "A division's length is roughly `words` / `divisions.count`; an opening",
    'is as long as you asked for, so a short reading is one opening, not many.',
    '',
    'CHOOSING A DIVISION — some entries carry `divisions.labels`, one name per',
    'division in order, so label[0] is division 1. Where they are given, choose',
    'by the name: a reader meets "The Cup of Humanity", not "division 3".',
    'Where they are not, the divisions are numbered rather than named and one',
    'is much like another — say why you chose in your note.',
    '`divisions.bodyFrom`, when present, is the first division that is the WORK:',
    "everything before it is the edition's front matter, a scanner's header or",
    'a table of contents. Never name a division below it.'
  ];
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

  const libraryCount = ctx?.library?.length ?? 0;
  const collectionCount = ctx?.visuals?.collections?.length ?? 0;
  const engineCount = ctx?.visuals?.engines?.length ?? 0;
  const soundscapeCount = ctx?.audio?.soundscapes?.length ?? 0;
  // What the reader brought, as opposed to what RISE holds. Counted
  // separately because a score that uses someone's own audio or their own
  // images is doing something the Library cannot do for them.
  const materials = [
    ...Object.entries(ctx?.catalog?.swells ?? {}),
    ...Object.entries(ctx?.catalog?.collections ?? {})
      .filter(([, entry]) => entry?.kind === 'sequence-asset')
  ];

  const lines = [
    'You are arranging an audiovisual reading score for RISE.',
    'Return ONLY a single JSON object. No markdown fences, no commentary.',
    '',
    `Schema: "${EXPERIENCE_PROGRAM_SCHEMA}" or "${AGENT_OPERATION_SET_SCHEMA}"`,
    'Authority: omit it, or use "proposed" / "user". Never "published".',
    'editable: true',
    '',
    '',
    'SHAPE — every field below is required where shown. Anchors live INSIDE',
    'an `anchor` object; tracks and clips carry ids; movement clips carry',
    '`data`; visual and audio tracks carry a `fallback`.',
    '',
    '{',
    '  "schema": "rise.experience-program.v1",',
    '  "id": "memory-and-loss",',
    '  "authority": "proposed",',
    '  "editable": true,',
    '  "tracks": [',
    '    { "id": "movements", "kind": "movement", "clips": [',
    '      { "id": "m1", "anchor": { "sourceIds": ["literary-meditations"] },',
    '        "data": { "index": 0, "title": "Stillness" } },',
    '      { "id": "m2", "anchor": { "sourceIds": ["extended-dhammapada-full"] },',
    '        "data": { "index": 1, "title": "Release" } }',
    '    ] },',
    '    { "id": "visuals", "kind": "visual", "fallback": { "kind": "still" }, "clips": [',
    '      { "id": "v1", "cue": { "kind": "procedural", "collections": ["rockgarden"] },',
    '        "anchor": { "sourceIds": ["literary-meditations"],',
    '                    "fromProgress": 0, "toProgress": 0.6 } },',
    '      { "id": "v2", "cue": { "kind": "sourced", "collections": ["aic-ukiyoe"] },',
    '        "anchor": { "sourceIds": ["literary-meditations"],',
    '                    "fromProgress": 0.6, "toProgress": 1 } }',
    '    ] },',
    '    { "id": "bed", "kind": "audio", "fallback": { "kind": "silence", "fadeMs": 500 },',
    '      "clips": [',
    '      { "id": "a1", "cue": { "kind": "soundscape", "soundscapeId": "aurora" },',
    '        "anchor": { "sourceIds": ["literary-meditations"] } }',
    '    ] },',
    '    { "id": "pace", "kind": "reading", "clips": [',
    '      { "id": "p1", "cue": { "kind": "pace", "wpm": 150 },',
    '        "anchor": { "sourceIds": ["literary-meditations"],',
    '                    "fromProgress": 0, "toProgress": 0.25 } },',
    '      { "id": "p2", "cue": { "kind": "pace", "chunkMode": "phrase" },',
    '        "anchor": { "sourceIds": ["extended-dhammapada-full"],',
    '                    "quoteStart": "Of the life of man", "quoteEnd": "a dream." } }',
    '    ] }',
    '  ]',
    '}',
    '',
    'A movement clip anchored with no range covers its whole source.',
    'Structure:',
    '- Exactly one non-empty movement track (kind "movement").',
    '- Optional transition, visual, audio (bed), swell, and reading tracks.',
    '- Each clip names sourceIds drawn from the companion context.json',
    '  (library works and/or loaded sources). Ids only — no URLs, no data:,',
    '  no blob:, no embedded text or images.',
    '- Visual cues: still | focal | sourced { collections } | procedural { collections, engines? }',
    '- Audio bed cues: silence | hold | soundscape { soundscapeId } | tone { presetId }',
    '- Swell cues: { kind: "swell", swellId }',
    '- Reading (pace) cues: { kind: "pace", wpm?, chunkMode? } — at least one.',
    '  wpm is 50–1000; chunkMode is word | phrase | sentence | paragraph.',
    '',
    'PACE — this is how the reading itself moves, and it is the one lane no',
    'other tool gives you. Use it to slow into a passage, to hold a section',
    'in whole phrases rather than single words, or to quicken a narrative',
    'stretch. Score it sparingly: an unscored stretch runs at the reader\'s',
    'own pace, which is the right answer most of the time.',
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
    ...lengthLines(ctx),
    '',
    'Proportional thinking: if you would assign weights (e.g. 1:2:1),',
    'emit contiguous progress ranges that sum to 1 instead',
    '(e.g. [0,0.25), [0.25,0.75), [0.75,1)). The program has no weights field.',
    '',
    'Work-bound engines (flaming_sword, ascii_soldier, …) were authored for',
    'specific books. Prefer them only when the chosen source matches their',
    '`work` in the context catalogue; otherwise use procedural engines',
    '(klee, turrell, fractal, …) or museum collections (aic-…).',
    '',
    'Library divisions: use `divisions.authored` and `divisions.reason`.',
    'When authored is false (reason "measured"), RISE imposed the cuts —',
    'name progress or quotations, not "Reading N". When titled is true,',
    'divisions have real names; when titled is false but authored is true,',
    'the author numbered them (Chapter / Book / Act) without titles.',
  ];

  if (wish) {
    lines.push('', 'Reader intent:', wish);
  } else {
    lines.push('', 'Reader intent: (none supplied — choose a coherent audiovisual reading.)');
  }

  if (ctx) {
    lines.push(
      '',
      `Capability document id: ${ctx.id}`,
      `Library works offered: ${libraryCount}`,
      `Visual collections: ${collectionCount}; engines: ${engineCount}`,
      `Soundscapes: ${soundscapeCount}`,
      ...(materials.length
        ? [
          '',
          `The reader has added ${materials.length} of their own:`,
          ...materials.slice(0, 24).map(([id, entry]) =>
            `  ${id}${entry?.name ? `  ${entry.name}` : ''}`),
          'These are the reader\'s own, not the Library\'s: RISE describes them',
          'rather than vouching for them. Use them where the reading is about',
          'what they brought.'
        ]
        : []),
      'Use only ids listed in that document. Prefer catalogue descriptions',
      'when choosing imagery and sound.'
    );
  } else {
    lines.push(
      '',
      'A rise.curator-context.v1 document is supplied separately as context.json.',
      'Name only ids that appear there.'
    );
  }

  lines.push(
    '',
    'Pace belongs on the reading track and nowhere else: `wpm` and `chunkMode`',
    'are fields of a pace CUE, never of the program, a track, or a movement.',
    'There is no `curve` anywhere — do not invent one.',
    '',
    'THE READING TRACK IS OPTIONAL. Leave it out entirely if the reader\'s own',
    'pace is right for this arrangement — that is the common case. Do not emit',
    'a pace cue that sets neither wpm nor chunkMode: an empty cue occupies its',
    'span while saying nothing, and is refused.',
    '',
    'ALTERNATIVE — instead of a complete score you may return a bounded',
    'operation list against the current Workshop revision. Same ids. No',
    'network acquisition. Every op is a command a person can already perform.',
    '',
    '{',
    '  "schema": "rise.agent-operation-set.v1",',
    '  "id": "ops-memory-1",',
    '  "projectId": "project-memory",',
    '  "baseRevision": 0,',
    '  "generationId": "run-1",',
    '  "intent": "Build quietly, then open into color.",',
    '  "operations": [',
    '    { "op": "add-source", "id": "op-source", "sourceId": "literary-meditations" },',
    '    { "op": "assign-visual", "id": "op-visual", "assignmentId": "v1",',
    '      "sourceId": "literary-meditations", "assetId": "procedural:klee",',
    '      "fromCharacter": 0, "toCharacter": 80 },',
    '    { "op": "assign-audio", "id": "op-audio", "assignmentId": "a1",',
    '      "sourceId": "literary-meditations", "assetId": "soundscape:aurora",',
    '      "fromCharacter": 0, "toCharacter": 80 },',
    '    { "op": "set-pace", "id": "op-pace", "assignmentId": "p1",',
    '      "sourceId": "literary-meditations", "cue": { "wpm": 150 } },',
    '    { "op": "set-render-profile", "id": "op-profile",',
    '      "profileId": "social-portrait-1080" }',
    '  ]',
    '}',
    '',
    'Closed operations: add-source, remove-source, reorder-source, request-asset',
    '(pending until admission; name a pinned object such as aic:27992, not a',
    'keyword search. Candidates are not assets; a human verdict admits them),',
    'import-asset, assign/replace/erase-visual,',
    'assign/replace/erase-audio, assign/replace/erase-narration (spoken voice;',
    'may duck the bed, never a soundscape or swell), configure-field, set-pace,',
    'create/remove-sync-group, set-atmosphere, set-render-profile, request-preview,',
    'request-compile.',
    'Do not invent ops. Do not emit create-transition until the Workshop has it.',
    'There is no publish, approve, deliver, withdraw, or channel-policy operation.',
    'A host producer may compile a private review and queue it. You cannot admit',
    'a candidate or post an artifact.',
    'Publication is a human decision over a hashed artifact; rendering does not post.',
    'baseRevision must match the project; a newer human edit refuses the set.',
    'Rationale is optional explanation and never enters the Experience Program.'
  );

  return `${lines.join('\n')}\n`;
}
