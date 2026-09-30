/**
 * The reader-owned AI path in a real browser, with only the network stood in:
 * OpenRouter's OAuth pages and Decisions API, and the Worker's public catalog.
 * Everything between (PKCE, the decision contract, admission, settings) is
 * the shipped code.
 */
import { readFileSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const inventory = read('../src/content/archive/release-inventory.json');
const modern = read('../src/content/modern-readings-manifest.json');

export const E2E_READER_KEY = 'sk-or-v1-e2e-reader-key-00000000000000';
const AUTH = /^https:\/\/openrouter\.ai\/auth\?/u;
const EXCHANGE = 'https://openrouter.ai/api/v1/auth/keys';
const DECISIONS = 'https://openrouter.ai/api/alpha/decisions';

const QUESTION_FIELDS = Object.freeze({
  section: 'section', pace: 'wpm', curve: 'curve', chunk: 'chunkMode', audio: 'audio',
  visual: 'visualMode', visualStyle: 'visualStyle', visualEngine: 'visualEngine', visualArc: 'visualArc',
  arcSplit: 'arcSplit', middleEngine: 'middleEngine', finaleEngine: 'finaleEngine', middleTheme: 'middleTheme',
  finaleTheme: 'finaleTheme', middleAudio: 'middleAudio', finaleAudio: 'finaleAudio',
  visualPalette: 'visualPalette', kleePreset: 'kleePreset', galleryCadence: 'galleryCadence',
  chamberFace: 'chamberFace', fontSize: 'fontSize', colorTheme: 'colorTheme', textColor: 'textColor',
  backgroundColor: 'backgroundColor', wordFill: 'wordFill', projection: 'projection', reveal: 'revealMode'
});

/** The public catalog the Worker would publish, with exactly these sounds. */
export function catalogWith(soundIds) {
  const books = [
    ...Object.values(inventory).filter(item => item.editionId?.startsWith('standard-ebooks:')
      && item.source?.url?.startsWith('https://standardebooks.org/ebooks/')),
    ...Object.values(modern)
  ].map(item => ({
    work_id: item.workId, title: item.title || item.workId, author: item.author || 'Unknown author',
    edition_id: item.editionId, source_revision: item.sourceRevision,
    fit_description: item.fitDescription || 'A released reading from the RISE archive.',
    decision_criterion: item.decisionCriterion || 'Choose this for a reader who asks for it.', active: true
  }));
  const sounds = [...new Set(soundIds)].filter(id => id !== 'silent' && id !== 'night-drive').slice(0, 9)
    .map(id => ({ sound_id: id, decision_criterion: `A ${id} soundscape for this reading.`, active: true }));
  return { schemaVersion: 1, books, sounds, options: null };
}

/** System One answers that would make the contract rebuild this plan. */
export function answersFor(decision) {
  const answers = { book: { type: 'choice', choice: decision.workId } };
  for (const [question, field] of Object.entries(QUESTION_FIELDS)) {
    answers[question] = { type: 'choice', choice: String(decision.config[field]) };
  }
  return answers;
}

/** Walk "Connect OpenRouter" through OAuth PKCE with OpenRouter stood in. */
export async function connectOpenRouter(page, { key = E2E_READER_KEY } = {}) {
  const exchanges = [];
  await page.route(AUTH, route => {
    const url = new URL(route.request().url());
    const callback = new URL(url.searchParams.get('callback_url'));
    callback.searchParams.set('code', 'e2e-authorization-code');
    return route.fulfill({ status: 302, headers: { location: callback.href } });
  });
  await page.route(EXCHANGE, route => {
    exchanges.push(route.request().postDataJSON());
    return route.fulfill({ json: { key, user_id: 'e2e-reader' } });
  });
  await page.locator('#portal-ai [data-ai="connect"]').click();
  await page.waitForURL(url => new URL(url).pathname === '/');
  await page.locator('#portal-ai [data-ai="disconnect"]').waitFor({ timeout: 15_000 });
  return exchanges;
}

/**
 * Answer the reader's Decisions requests from scripted plans. Returns the
 * list of request bodies and Authorization headers OpenRouter would see.
 */
export async function answerDecisions(page, plans, { status, onRequest = () => {} } = {}) {
  const list = Array.isArray(plans) ? plans : [plans];
  const seen = [];
  const sounds = list.flatMap(plan => [plan.config.audio, plan.config.middleAudio, plan.config.finaleAudio]);
  await page.route('**/api/decision-catalog', route => route.fulfill({ json: catalogWith(sounds) }));
  await page.route(DECISIONS, route => {
    const request = route.request();
    const observation = { body: request.postDataJSON(), authorization: request.headers().authorization };
    seen.push(observation);
    onRequest(observation);
    if (status) return route.fulfill({ status, json: { error: { message: 'Scripted failure.' } } });
    const plan = list[Math.min(seen.length - 1, list.length - 1)];
    return route.fulfill({ json: {
      id: plan.requestId || `e2e-${seen.length}`, provider: 'TypeSafe', model: plan.model || 'typesafe/jev-1.13',
      answers: answersFor(plan)
    } });
  });
  return seen;
}

export const KEV_REVISION = '139fdd94f1b6a6ad80cc15e08fcb99cac885a101';

/**
 * Serve the page the way local RISE does (the bridge marks its HTML and
 * reports Kev ready) and answer the same-origin Kev route with attestation.
 */
export async function runAsLocalRise(page, plans) {
  const list = Array.isArray(plans) ? plans : [plans];
  const seen = [];
  await page.route(url => url.pathname === '/' || url.pathname === '/index.html', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('<head>', '<head>\n    <meta name="rise-local" content="1">');
    return route.fulfill({ response, body });
  });
  await page.route('**/api/local/status', route => route.fulfill({ json: {
    rise: 'local', kev: { state: 'ready', revision: KEV_REVISION, device: 'Test GPU' }
  } }));
  const sounds = list.flatMap(plan => [plan.config.audio, plan.config.middleAudio, plan.config.finaleAudio]);
  await page.route('**/api/decision-catalog', route => route.fulfill({ json: catalogWith(sounds) }));
  await page.route('**/api/local/kev/systemone', route => {
    seen.push({ body: route.request().postDataJSON(), authorization: route.request().headers().authorization });
    const plan = list[Math.min(seen.length - 1, list.length - 1)];
    return route.fulfill({ headers: { 'x-kev-revision': KEV_REVISION },
      json: { model: 'kev-latest', answers: answersFor(plan), latency_ms: 42 } });
  });
  return seen;
}
