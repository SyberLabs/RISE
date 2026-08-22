/**
 * A local work — reader text that became a Library work.
 *
 * The trunk of SCRIPTORIUM-STRENGTHENING-SPEC: a reader's `.txt` becomes a
 * catalogue work with named, addressable parts BEFORE the Scriptorium can
 * compose from it. Until it does, the extent grammar has nothing to point at
 * — `local-april-diary#4` and `sacred-tao-te-ching#40` are the same sentence,
 * and only one of them has ever had a work behind it.
 *
 * ONE TEXT AND A LIST OF JOINTS. Parts are derived from `cuts`, never stored
 * as a second copy of the prose, because two copies of a text is one copy and
 * one thing that will disagree with it.
 *
 * THE RECORD IS PURE AND THE STORE IS NOT. Everything here runs in Node with
 * no IndexedDB and no DOM: the session overlay is the product, and a browser
 * store is one hydrator of it. The CLI is another. Tests are a third, and
 * they hand fixtures straight to the overlay.
 *
 * What this module does NOT do is decide where a reader's cuts should fall.
 * The divider may propose (`draftLocalWork`); a reader disposes. That is the
 * Archive's law about models applied to the machine that packs paragraphs.
 */

import { countWords } from './chunker.js';
import { divideSections } from '../content/archive/divisions.js';
import { READING_LIMITS } from './reading-limits.js';

export const LOCAL_WORK_SCHEMA = 'rise.local-work.v1';

/**
 * RESERVED. Archive ingest may never mint an id under this prefix, which is
 * what makes "an id in both registries" impossible rather than merely
 * unlikely — the overlay is asked after the archive, so a collision would
 * silently shadow a shelved work.
 */
export const LOCAL_WORK_PREFIX = 'local-';

export const LOCAL_WORK_DEFAULT_NOUN = 'Reading';

export class LocalWorkError extends Error {
  constructor(message, code = 'LOCAL_WORK') {
    super(message);
    this.name = 'LocalWorkError';
    this.code = code;
  }
}

const fail = (code, message) => { throw new LocalWorkError(message, code); };

/** A bounded, lowercase slug — the id a reader will see in a source id. */
export function localWorkSlug(value) {
  const slug = String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 60)
    .replace(/-+$/gu, '');
  return slug || 'text';
}

export function localWorkId(value) {
  return `${LOCAL_WORK_PREFIX}${localWorkSlug(value)}`;
}

export function isLocalWorkId(id) {
  return typeof id === 'string' && id.startsWith(LOCAL_WORK_PREFIX);
}

/** The parts a record describes, derived from its joints. */
export function localWorkParts(record) {
  const { text, cuts, labels } = record;
  return labels.map((label, index) => ({
    id: index,
    label,
    title: null,
    content: text.slice(cuts[index], cuts[index + 1]).trim()
  }));
}

/**
 * Every invariant, checked on every write.
 *
 * Written as one pass rather than spread through the callers, because a
 * record that reaches the catalogue malformed is a refusal the reader meets
 * at the gate about a file they cannot see.
 */
export function validateLocalWork(record) {
  if (!record || typeof record !== 'object') fail('LOCAL_WORK_RECORD', 'Expected a local work record.');
  if (record.schema !== LOCAL_WORK_SCHEMA) {
    fail('LOCAL_WORK_SCHEMA', `Expected schema ${LOCAL_WORK_SCHEMA}.`);
  }
  if (!isLocalWorkId(record.id)) {
    fail('LOCAL_WORK_ID', `A local work id begins with "${LOCAL_WORK_PREFIX}".`);
  }
  const text = typeof record.text === 'string' ? record.text : '';
  if (!text.trim()) fail('LOCAL_WORK_EMPTY', 'There is no text in this file.');
  if (text.length > READING_LIMITS.maxTextCharacters) {
    fail('LOCAL_WORK_TOO_LARGE',
      `A work can hold up to ${READING_LIMITS.maxTextCharacters.toLocaleString()} characters.`);
  }

  const { cuts, labels } = record;
  if (!Array.isArray(cuts) || cuts.length < 2) fail('LOCAL_WORK_CUTS', 'A work has at least one part.');
  if (cuts[0] !== 0 || cuts[cuts.length - 1] !== text.length) {
    fail('LOCAL_WORK_CUTS', 'The joints must span the whole text.');
  }
  for (let i = 1; i < cuts.length; i += 1) {
    if (!Number.isInteger(cuts[i]) || cuts[i] <= cuts[i - 1]) {
      fail('LOCAL_WORK_CUTS', 'The joints must ascend.');
    }
  }
  if (!Array.isArray(labels) || labels.length !== cuts.length - 1) {
    fail('LOCAL_WORK_LABELS', 'Every part is named exactly once.');
  }
  for (const [index, part] of localWorkParts(record).entries()) {
    if (!countWords(part.content)) {
      fail('LOCAL_WORK_PART_EMPTY', `Part ${index + 1} has no words in it.`);
    }
    if (typeof labels[index] !== 'string' || !labels[index].trim()) {
      fail('LOCAL_WORK_LABELS', `Part ${index + 1} has no name.`);
    }
  }
  return record;
}

/**
 * The first draft — what the machine proposes, before anyone has looked.
 *
 * `authored: false` and `reason: 'measured'` say exactly that, and the prompt
 * already reads them: when a work is not authored it tells the model to
 * prefer progress and quotation over naming "Reading 4". Save is the
 * authoring act, and it is the reader's, not this function's.
 */
export function draftLocalWork({ text, sourceName = '', title = '', author = null, now = () => new Date() }) {
  const body = String(text ?? '');
  const name = String(title || sourceName).replace(/\.[a-z0-9]+$/iu, '').trim();
  const record = {
    schema: LOCAL_WORK_SCHEMA,
    id: localWorkId(name || 'text'),
    title: name || 'Untitled',
    author: author || null,
    createdAt: now().toISOString(),
    sourceName: String(sourceName || ''),
    text: body,
    ...cutsFromDraft(body),
    noun: LOCAL_WORK_DEFAULT_NOUN,
    authored: false,
    reason: 'measured'
  };
  return validateLocalWork(record);
}

/**
 * Joints from the divider, converted to offsets into the original text.
 *
 * `divideSections` returns CONTENT, not positions, and the spec's record is a
 * list of positions — so each part is located in the text it came from rather
 * than trusted to be an exact substring boundary. A part the search cannot
 * place ends the packing: a joint that is not where it says it is would put
 * every later offset out by the same amount.
 */
function cutsFromDraft(text) {
  const scheme = divideSections([{ name: 'Local text', content: text }]);
  const entries = Array.isArray(scheme?.entries) ? scheme.entries : [];
  const cuts = [0];
  const labels = [];
  let cursor = 0;

  for (const entry of entries) {
    const content = String(entry?.content ?? '').trim();
    if (!content) continue;
    const at = text.indexOf(content, cursor);
    if (at < 0) break;
    const end = at + content.length;
    if (end <= cuts[cuts.length - 1]) continue;
    if (cuts.length > 1 || labels.length) cuts.push(at);
    labels.push(defaultLabel(content, labels.length));
    cursor = end;
  }

  // One part is the honest answer for a wall of text, and the admit surface
  // teaches the gesture on it rather than inventing a seam to look busy.
  // A LONE PART IS NOT NAMED AFTER ITS FIRST LINE. The first line describes a
  // part when there are several; over the whole work it claims the file is
  // about its opening — "April 2" over a diary that runs to April 4.
  if (labels.length < 2) {
    return { cuts: [0, text.length], labels: [`${LOCAL_WORK_DEFAULT_NOUN} 1`] };
  }
  cuts.push(text.length);
  return { cuts, labels };
}

/** The first line when it reads as a heading; otherwise the counted name. */
export function defaultLabel(content, index, noun = LOCAL_WORK_DEFAULT_NOUN) {
  const first = String(content ?? '').trim().split(/\r?\n/, 1)[0].trim();
  if (first && first.length <= 60 && !/[.!?,;:]$/u.test(first) && countWords(first) <= 9) {
    return first;
  }
  return `${noun} ${index + 1}`;
}

/**
 * What leaves the building — no payload.
 *
 * Exactly the shape `normalizeLibrary` already accepts and
 * `createCuratorSourceReader` needs for `#n` and `#n:200`. `words` is
 * whole-or-nothing against `count`, and so are `labels`: a short array reads
 * as the work's complete scheme and would have a curator naming a part past
 * the end of it.
 */
export function localWorkCatalogue(record) {
  validateLocalWork(record);
  const parts = localWorkParts(record);
  const entry = {
    id: record.id,
    title: record.title,
    words: countWords(record.text),
    divisions: {
      authored: record.authored === true,
      reason: record.reason || 'measured',
      noun: record.noun || LOCAL_WORK_DEFAULT_NOUN,
      count: parts.length,
      labels: parts.map(part => part.label),
      words: parts.map(part => countWords(part.content))
    }
  };
  if (record.author) entry.author = record.author;
  return entry;
}

/**
 * The runtime shape `resolveLibrarySourceIds` already knows how to ask.
 *
 * A local work answers the same questions an archive work answers, so the
 * resolver gains an overlay rather than a second resolver — one code path
 * loading two kinds of work is the only way they cannot drift apart.
 */
export function localWorkRuntime(record) {
  validateLocalWork(record);
  const parts = localWorkParts(record);
  return {
    id: record.id,
    title: record.title,
    author: record.author || null,
    wordCount: countWords(record.text),
    providerId: 'local-work',
    getSections: async () => [{ name: record.title, content: record.text }],
    getDivisions: async () => ({
      divided: parts.length > 1,
      noun: record.noun || LOCAL_WORK_DEFAULT_NOUN,
      reason: record.reason || 'measured',
      authored: record.authored === true,
      entries: parts.map((part, index) => ({ ...part, ordinal: index + 1 }))
    })
  };
}
