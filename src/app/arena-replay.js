/**
 * A frozen Decision Arena result, shown and replayed as real readings.
 *
 * `/arena` lists the cases of the latest real run, each by the reader's own
 * request. `/arena/<caseId>` sets the four deciders' choices for one case
 * side by side, in words; `/arena/<caseId>/<decider>` is the same page with
 * that decider's reading the one last played. The decision each decider made
 * was captured once and frozen; scripts/arena writes a slim replay file beside
 * the full run (`/content/arena/replay-<sha12>.json`, run 1 only, no raw
 * answers), and this reads only that. Nothing here calls a model. A frozen
 * decision plays under RISE's own label, `rise/arena-replay-1`, naming the
 * model that made it, and goes through the same gate as every other reading
 * (jev-reading.js). Loaded only when an arena address is opened.
 */
import './arena-replay.css';
import cases from '../../scripts/jev-eval-cases.json' with { type: 'json' };
import { ARENA_DECIDERS } from '../core/jev-demo-path.js';
import { SECTION_WORDS, summarizeJevPlan } from '../core/jev-describe.js';
import { getTextById } from '../content/library.js';

const SCHEMA = 'syberlabs.decision-arena-replay/v1';
const INDEX_SCHEMA = 'syberlabs.decision-arena-index/v1';
const REPLAY_FILE = /^replay-[0-9a-f]{12}\.json$/u;
const REQUESTS = new Map(cases.map(item => [item.id, item.intent]));

export const ARENA_LABELS = Object.freeze({
  openai: 'A · OpenAI Decisions',
  jev: 'B · TypeSafe Jev',
  kev: 'C · Kev',
  rules: 'D · rules, no model'
});

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

/**
 * The reading envelope for a frozen decision. The harness keeps only what was
 * admitted (book and choices); it plays under RISE's replay label, naming the
 * model that made it: the one the provider served, else the one asked for,
 * else the decider itself (rules call no model).
 */
export function arenaReplayDecision(requestId, provider, admitted) {
  const { workId, editionId, sourceRevision, reason, config } = admitted;
  return {
    schemaVersion: 2, requestId, model: 'rise/arena-replay-1', provider: 'RISE',
    sourceModel: provider.servedModels?.[0] || provider.requestedModel || provider.id,
    workId, editionId, sourceRevision, reason, config
  };
}

/**
 * The latest real (not mock) run in the index: when it was captured, and
 * each case's id and the reader's request in words. Throws when the files are
 * missing or malformed (a host that answers every path with the app's page
 * has no JSON to give). File names carry content hashes; those are checked
 * where runs are written (scripts/arena), not here.
 */
export async function loadArenaRun(load = fetchJson) {
  const index = await load('/content/arena/index.json');
  // The latest real run; a run stopped at its cost cap only when no complete one exists.
  const real = index?.schema === INDEX_SCHEMA && Array.isArray(index.runs)
    ? index.runs.filter(entry => entry?.mock === false) : [];
  const latest = (real.filter(entry => entry.partial !== true).at(-1) ?? real.at(-1))?.replay;
  if (!REPLAY_FILE.test(latest)) throw new Error('The arena index names no run.');
  const replay = await load(`/content/arena/${latest}`);
  if (replay?.schema !== SCHEMA || typeof replay.runFile !== 'string'
    || !Array.isArray(replay.providers) || !replay.decisions) throw new Error('The arena run is not readable.');
  return {
    replay,
    createdAt: typeof replay.createdAt === 'string' ? replay.createdAt.slice(0, 10) : 'unknown',
    cases: Object.keys(replay.decisions).map(id => ({ id, request: REQUESTS.get(id) || null }))
  };
}

/**
 * One case of a loaded run: for each decider either its admitted decision or
 * why there is none. Throws when the run lacks the case.
 */
export function arenaCase({ replay }, caseId) {
  const found = Object.hasOwn(replay.decisions, caseId) ? replay.decisions[caseId] : null;
  if (!found) throw new Error(`The arena run has no case ${caseId}.`);
  const deciders = {};
  for (const id of ARENA_DECIDERS) {
    const provider = replay.providers.find(item => item?.id === id);
    const entry = provider && Object.hasOwn(found, id) ? found[id] : null;
    deciders[id] = !entry ? { status: /^not run: /u.test(provider?.status) ? provider.status : 'not run' }
      : entry.rejectCode ? { status: `rejected: ${entry.rejectCode}` }
        : { decision: arenaReplayDecision(replay.runFile, provider, entry) };
  }
  return deciders;
}

/** What a frozen decision chose, in words: book, look, sound and pace. */
export function describeArenaDecision(decision) {
  const work = getTextById(decision.workId);
  const book = [work?.title || decision.workId, work?.author].filter(Boolean).join(', by ');
  const [pace, imagery, sound, face] = summarizeJevPlan(decision.config);
  return {
    book: `${book} · ${SECTION_WORDS[decision.config.section] || 'a section'}`,
    look: `${imagery} · ${face}`,
    sound,
    pace
  };
}

const escape = value => String(value).replace(/[&<>"']/gu, c => `&#${c.charCodeAt(0)};`);
const arenaPath = (...parts) => ['/arena', ...parts.map(encodeURIComponent)].join('/');
const EYEBROW = '<p class="portal-eyebrow"><span class="portal-dot" aria-hidden="true"></span>Decision Arena</p>';
const FOOTNOTE = 'Independent comparison; no partnership with OpenAI or TypeSafe.';
// Set when the reader follows an arena link, so the next page's heading takes focus.
let moved = false;

function deciderCard(id, entry, current) {
  const label = ARENA_LABELS[id];
  const titleId = `arena-${id}-title`;
  if (!entry.decision) {
    return `<article class="arena-decider" data-arena-decider="${id}" aria-labelledby="${titleId}">
      <h2 class="arena-decider-title" id="${titleId}">${label}</h2>
      <p class="portal-help">${escape(entry.status)}</p>
    </article>`;
  }
  const { sourceModel } = entry.decision;
  const words = describeArenaDecision(entry.decision);
  const rows = [['Book', words.book], ['Look', words.look], ['Sound', words.sound], ['Pace', words.pace]]
    .map(([name, value]) => `<dt>${name}</dt><dd>${escape(value)}</dd>`).join('');
  return `<article class="arena-decider" data-arena-decider="${id}" aria-labelledby="${titleId}"${current ? ' aria-current="true"' : ''}>
      <h2 class="arena-decider-title" id="${titleId}">${label}${sourceModel !== id
        ? ` <span class="arena-model">— ${escape(sourceModel)}</span>` : ''}</h2>
      <dl class="arena-choices">${rows}</dl>
      <button class="portal-primary" type="button" data-arena-play="${id}" aria-label="Play this one: ${label}">Play this one</button>
    </article>`;
}

function caseView({ createdAt, cases: list }, caseId, deciders, decider) {
  const request = list.find(item => item.id === caseId)?.request;
  return `${EYEBROW}
    <h1 class="portal-title arena-title" id="portal-ask-title" tabindex="-1">${request ? `“${escape(request)}”` : escape(caseId)}</h1>
    <div id="arena-replay">
      <p class="portal-help">One reader request, four deciders. Each chose a book, a look, a sound and a pace when the run was captured; play any one to see it. No model is called here.</p>
      <div class="arena-deciders">
        ${ARENA_DECIDERS.map(id => deciderCard(id, deciders[id], id === decider)).join('')}
      </div>
      <p class="portal-status" id="arena-replay-status" role="status" aria-live="polite"></p>
      <p class="portal-help">Case ${escape(caseId)}. Frozen result captured ${escape(createdAt)}. ${FOOTNOTE}</p>
      <p class="portal-help"><a href="/arena" data-arena-go>All cases</a></p>
    </div>`;
}

function listView({ createdAt, cases: list }) {
  return `${EYEBROW}
    <h1 class="portal-title arena-title" id="portal-ask-title" tabindex="-1">The same request, four deciders</h1>
    <div id="arena-replay">
      <p class="portal-help">Each case is one reader’s request. Open one to compare what OpenAI Decisions, TypeSafe Jev, Kev and plain rules chose for it, and play each choice as a reading.</p>
      <ul class="arena-cases">
        ${list.map(({ id, request }) => `<li><a href="${arenaPath(id)}" data-arena-go>${escape(request || id)}</a></li>`).join('')}
      </ul>
      <p class="portal-help">Frozen result captured ${escape(createdAt)}. ${FOOTNOTE}</p>
    </div>`;
}

function emptyView(line, href, link) {
  return `${EYEBROW}
    <h1 class="portal-title arena-title" id="portal-ask-title" tabindex="-1">Decision Arena</h1>
    <div id="arena-replay">
      <p class="portal-help" role="status">${escape(line)}</p>
      <p class="portal-help"><a href="${href}" data-arena-go>${link}</a></p>
    </div>`;
}

/**
 * Show an arena address in `section`: the case list (no `caseId`), or one
 * case's four deciders side by side. Each admitted decision is one press
 * away; pressing one opens its reading at its own address, which replaces
 * whatever reading was open, so one plays at a time. With no published run,
 * or no such case, it says so in one line and links on. `go(path)` moves to
 * another address in place.
 */
export async function mountArenaReplay(section, { caseId = null, decider = null, launch, go, load }) {
  section.innerHTML = `${EYEBROW}<p class="portal-status" role="status">Loading the comparison…</p>`;
  let run;
  let deciders = null;
  try {
    run = await loadArenaRun(load);
    if (caseId !== null) deciders = arenaCase(run, caseId);
  } catch (error) {
    console.warn('[RISE] Arena replay unavailable:', error);
    section.innerHTML = run
      ? emptyView(`The published run has no case “${caseId}”.`, '/arena', 'All cases')
      : emptyView('No published run yet — the comparison is being captured.', '/', 'Back to Home');
  }
  if (run && (caseId === null || deciders)) {
    section.innerHTML = deciders ? caseView(run, caseId, deciders, decider) : listView(run);
  }
  if (moved) section.querySelector('h1')?.focus();
  moved = false;
  section.addEventListener('click', event => {
    const link = event.target.closest('a[data-arena-go]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    moved = true;
    go(link.getAttribute('href'));
  });
  const status = section.querySelector('#arena-replay-status');
  section.querySelector('.arena-deciders')?.addEventListener('click', async event => {
    const button = event.target.closest('button[data-arena-play]');
    if (!button || button.disabled) return;
    const id = button.dataset.arenaPlay;
    button.disabled = true;
    status.textContent = `Preparing ${ARENA_LABELS[id]}…`;
    try {
      await launch(deciders[id].decision, arenaPath(caseId, id));
      status.textContent = '';
    } catch (error) {
      status.textContent = error.message || 'This reading could not be opened.';
    } finally {
      button.disabled = false;
    }
  });
}
