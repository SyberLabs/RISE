/**
 * A frozen Decision Arena result, replayed as a real reading.
 *
 * `/arena/<caseId>/<decider>` names one case and one of four deciders. The
 * decision each decider made for that case was captured once and frozen into
 * a same-origin file (`/content/arena/run-<sha12>.json`, written by
 * scripts/arena); nothing here calls a model. The frozen decision plays under
 * RISE's own label, `rise/arena-replay-1`, and goes through the same gate as
 * every other reading (jev-reading.js). Loaded only when the address is opened.
 */
import { ARENA_DECIDERS } from '../core/jev-demo-path.js';

const SCHEMA = 'syberlabs.decision-arena/v1';
const RUN_FILE = /^run-[0-9a-f]{12}\.json$/u;

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

/** A frozen decision, under RISE's replay label, keeping the model that made it. */
export function arenaReplayDecision(admitted) {
  return { ...admitted, model: 'rise/arena-replay-1', provider: 'RISE', sourceModel: admitted.model };
}

/**
 * One case from the latest frozen run: when it was captured, and for each
 * decider either its first run's admitted decision or why there is none.
 * Throws when the files are missing or malformed, or the run lacks the case.
 */
export async function loadArenaCase(caseId, load = fetchJson) {
  const index = await load('/content/arena/index.json');
  if (!RUN_FILE.test(index?.latest)) throw new Error('The arena index names no run.');
  const run = await load(`/content/arena/${index.latest}`);
  if (run?.schema !== SCHEMA || !Array.isArray(run.results)) throw new Error('The arena run is not readable.');
  const rows = run.results.filter(row => row?.caseId === caseId && row.run === 1);
  if (!rows.length) throw new Error(`The arena run has no case ${caseId}.`);
  const deciders = {};
  for (const id of ARENA_DECIDERS) {
    const row = rows.find(item => item.providerId === id);
    deciders[id] = !row ? { status: 'not run' }
      : row.admitted ? { decision: arenaReplayDecision(row.admitted) }
        : { status: `rejected: ${row.error?.code || row.error || 'invalid'}` };
  }
  return { capturedAt: typeof run.capturedAt === 'string' ? run.capturedAt.slice(0, 10) : 'unknown', deciders };
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
  const { capturedAt, deciders } = found;
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
      <p class="portal-help">Frozen result captured ${escape(capturedAt)}. Independent comparison; no partnership with OpenAI or TypeSafe.</p>
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
