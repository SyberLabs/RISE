/**
 * A frozen Decision Arena result, replayed as a real reading.
 *
 * `/arena/<caseId>/<decider>` names one case and one of four deciders. The
 * decision each decider made for that case was captured once and frozen;
 * scripts/arena writes a slim replay file beside the full run
 * (`/content/arena/replay-<sha12>.json`, run 1 only, no raw answers), and
 * this reads only that. Nothing here calls a model. The frozen decision plays under
 * RISE's own label, `rise/arena-replay-1`, and goes through the same gate as
 * every other reading (jev-reading.js). Loaded only when the address is opened.
 */
import { ARENA_DECIDERS } from '../core/jev-demo-path.js';

const SCHEMA = 'syberlabs.decision-arena-replay/v1';
const INDEX_SCHEMA = 'syberlabs.decision-arena-index/v1';
const REPLAY_FILE = /^replay-[0-9a-f]{12}\.json$/u;

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
 * One case from the latest real (not mock) run in the index: when it was
 * captured, and for each decider either its admitted decision or why there is
 * none. Throws when the files are missing or malformed, or the run lacks the
 * case. File names carry content hashes; those are checked where runs are
 * written (scripts/arena), not here.
 */
export async function loadArenaCase(caseId, load = fetchJson) {
  const index = await load('/content/arena/index.json');
  const latest = index?.schema === INDEX_SCHEMA && Array.isArray(index.runs)
    ? index.runs.filter(entry => entry?.mock === false).at(-1)?.replay : null;
  if (!REPLAY_FILE.test(latest)) throw new Error('The arena index names no run.');
  const replay = await load(`/content/arena/${latest}`);
  if (replay?.schema !== SCHEMA || typeof replay.runFile !== 'string'
    || !Array.isArray(replay.providers) || !replay.decisions) throw new Error('The arena run is not readable.');
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
  return { createdAt: typeof replay.createdAt === 'string' ? replay.createdAt.slice(0, 10) : 'unknown', deciders };
}

const escape = value => String(value).replace(/[&<>"']/gu, c => `&#${c.charCodeAt(0)};`);

/**
 * Show the case's four deciders in `section`. Each admitted decision is one
 * press away; pressing one opens its reading at its own address, which
 * replaces whatever reading was open, so one plays at a time. `fallback`
 * runs when there is no frozen result to show.
 */
export async function mountArenaReplay(section, { caseId, decider, launch, fallback, load }) {
  let found;
  try {
    found = await loadArenaCase(caseId, load);
  } catch (error) {
    console.warn('[RISE] Arena replay unavailable:', error);
    fallback();
    return;
  }
  const { createdAt, deciders } = found;
  section.innerHTML = `
    <p class="portal-eyebrow"><span class="portal-dot" aria-hidden="true"></span>Decision Arena replay</p>
    <h1 class="portal-title" id="portal-ask-title">${escape(caseId)}</h1>
    <div class="portal-jev-form" id="arena-replay">
      <p class="portal-help">The same request, four deciders. Each plays the decision it made when the run was captured; no model is called here.</p>
      <div class="portal-actions">
        ${ARENA_DECIDERS.map(id => (deciders[id].decision
          ? `<button class="portal-primary" type="button" data-arena-decider="${id}"${id === decider ? ' aria-current="true"' : ''}>${ARENA_LABELS[id]}</button>`
          : `<p class="portal-help" data-arena-decider="${id}">${ARENA_LABELS[id]}: ${escape(deciders[id].status)}</p>`)).join('')}
      </div>
      <p class="portal-status" id="arena-replay-status" role="status" aria-live="polite"></p>
      <p class="portal-help">Frozen result captured ${escape(createdAt)}. Independent comparison; no partnership with OpenAI or TypeSafe.</p>
    </div>`;
  const status = section.querySelector('#arena-replay-status');
  section.querySelector('.portal-actions').addEventListener('click', async event => {
    const button = event.target.closest('button[data-arena-decider]');
    if (!button || button.disabled) return;
    const id = button.dataset.arenaDecider;
    button.disabled = true;
    status.textContent = `Preparing ${ARENA_LABELS[id]}…`;
    try {
      await launch(deciders[id].decision, `/arena/${encodeURIComponent(caseId)}/${id}`);
      status.textContent = '';
    } catch (error) {
      status.textContent = error.message || 'This reading could not be opened.';
    } finally {
      button.disabled = false;
    }
  });
}
