/**
 * RISE Changes: what merged into RISE, as a RISE reading.
 *
 * `/changes` lists the digests, newest first, leaving out one a re-run of its
 * period superseded; `/changes/<id>` shows one: its reading, the pull requests
 * it speaks about, how every merged pull request was routed, and, when it was
 * superseded, a link to the reading that replaces it. The weekly workflow writes the files to the
 * `changes-data` branch and the Worker serves them at `/content/changes/`
 * (worker/changes.mjs). `/changes/<slug>` and `/changes/<slug>/<id>` are the same for a team RISE lists
 * (src/core/changes/listed.js), from that team's own branch, under its own name. Everything in them is model- or PR-written, so each
 * file is held to its contract (src/core/changes/contract.js, the generator's
 * own check) before anything of it is shown, and the
 * digest's Current to the admission a card's Current passes at the Worker's
 * door (worker/mcp-server.mjs): the Current validator, and every generated
 * scene's code and figure's SVG. A file that fails is one line and
 * no reading. Nothing here calls a model. Loaded only when a changes address
 * is opened.
 */
import './changes.css';
import { RISE_CURRENT_SCHEMA_V2, validateRiseCurrent } from '../core/rise-current.js';
import { sceneRefusal } from '../core/scene-admission.js';
import { DIGEST_ID, LIMITS, REPOSITORY, densityLine, digestProblems, indexProblems, qualityLine } from '../core/changes/contract.js';
import { listedTeam } from '../core/changes/listed.js';

const BADGES = { team: 'Team', readers: 'Readers' };

const utf8Bytes = value => new TextEncoder().encode(JSON.stringify(value) ?? '').byteLength;

function refuse(what) {
  throw new Error(`RISE Changes refused the file: ${what}`);
}

/** The index's entries, newest first as written. Throws for anything outside the contract (src/core/changes/contract.js). */
export function admitChangesIndex(value) {
  const problems = indexProblems(value);
  if (problems.length) refuse(problems.join('; '));
  return value.digests;
}

/** The Current, held to what a card's Current is held to at the Worker's door; the original is what plays. */
function admitCurrent(current, composer) {
  const valid = validateRiseCurrent(current);
  if (valid.schema !== RISE_CURRENT_SCHEMA_V2) refuse('the Current is not a rise.current.v2');
  if (valid.origin.kind !== 'model' || valid.origin.name !== composer) refuse('the Current names another author than the digest');
  for (const scene of valid.scenes) {
    if (scene.code === undefined && scene.svg === undefined) continue;
    const refusal = sceneRefusal(scene);
    if (refusal) refuse(refusal);
  }
  return valid;
}

/**
 * One digest of `repo`, held to the contract (src/core/changes/contract.js) and served as `id`, its Current admitted,
 * with its included changes in order. Throws for anything else: the page then shows no part of it.
 */
export function admitChangesDigest(value, id, repo = REPOSITORY) {
  if (utf8Bytes(value) > LIMITS.fileBytes) refuse('the digest is over 256 KB');
  const problems = digestProblems(value, repo);
  if (problems.length) refuse(problems.join('; '));
  if (value.id !== id) refuse('the digest is not the one asked for');
  admitCurrent(value.current, value.model.composer);
  return { ...value, included: value.changes.filter(change => change.included) };
}

/** The file's JSON, or null for a 404: the Worker's answer while the data branch has no such file. */
async function fetchJson(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

/** Where the Worker serves the files: RISE's own, or a listed team's (null for RISE). */
const filesOf = team => (team ? `/content/changes/${team.slug}/` : '/content/changes/');

/** The index's entries; none while no index has been written. */
export async function loadChangesIndex(load = fetchJson, team = null) {
  const index = await load(`${filesOf(team)}index.json`);
  return index === null ? [] : admitChangesIndex(index);
}

export async function loadChangesDigest(id, load = fetchJson, team = null) {
  if (typeof id !== 'string' || !DIGEST_ID.test(id)) refuse('the address names no digest');
  return admitChangesDigest(await load(`${filesOf(team)}${id}.json`), id, team?.repo);
}

const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' });
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const FULL = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** A period in words, in UTC: `12–19 October 2026`, `28 September – 5 October 2026`. */
export function periodWords({ from, to }) {
  const start = new Date(from);
  const end = new Date(to);
  if (start.getUTCFullYear() !== end.getUTCFullYear()) return `${FULL.format(start)} – ${FULL.format(end)}`;
  if (start.getUTCMonth() !== end.getUTCMonth()) return `${DAY_MONTH.format(start)} – ${FULL.format(end)}`;
  return `${DAY.format(start)}–${FULL.format(end)}`;
}

const escape = value => String(value).replace(/[&<>"']/gu, c => `&#${c.charCodeAt(0)};`);
const changesPath = (id, team = null) => `/changes${team ? `/${team.slug}` : ''}${id ? `/${encodeURIComponent(id)}` : ''}`;
const nameOf = team => team?.name ?? 'RISE';
const plural = (count, one) => `${count} ${one}${count === 1 ? '' : 's'}`;
const EYEBROW = '<p class="portal-eyebrow"><span class="portal-dot" aria-hidden="true"></span>RISE Changes</p>';
const badge = audience => `<span class="changes-badge">${BADGES[audience]}</span>`;
// Set when the reader follows a changes link, so the next page's heading takes focus.
let moved = false;

/** Why a change is or is not in a digest for `audience`, in words. */
/**
 * Why a change is or is not in the reading, true to the team digest's inclusion rule: any audience but skip, notable
 * or major, at most the limit, and spoken of by a beat.
 */
function reasonWords({ included, reason, route }) {
  if (included) return 'Included';
  if (reason === 'records-only') return 'Left out: records only';
  if (reason === 'limit') return `Left out: over the ${LIMITS.included}-change limit`;
  if (reason === 'unspoken') return 'Left out: the reading did not speak of it';
  if (route.audience === 'skip') return 'Left out: skipped by the router';
  return route.significance === 'minor' ? 'Left out: minor' : 'Left out';
}

function listView(digests, team = null) {
  const rows = digests.filter(entry => entry.supersededBy === undefined).map(({ id, audience, title, period: when, count }) => `<li class="changes-digest">
        <a class="changes-digest-title" href="${changesPath(id, team)}" data-changes-go>${escape(title)}</a>
        <p class="changes-meta">${escape(periodWords(when))} · ${plural(count, 'change')} in the reading ${badge(audience)}</p>
      </li>`).join('');
  return `${EYEBROW}
    <h1 class="portal-title changes-title" id="portal-ask-title" tabindex="-1">What changed in ${escape(nameOf(team))}</h1>
    <div id="changes">
      <p class="portal-help">Each digest is the pull requests merged into ${escape(nameOf(team))} over a week, told as a RISE reading. A model writes it; RISE checks it before showing it. Nothing here calls a model.</p>
      ${digests.length ? `<ul class="changes-digests">${rows}</ul>`
        : '<p class="portal-help" role="status">No digest has been written yet.</p>'}
    </div>`;
}

/** Who wrote the digest's reading, through what, from what: RISE's honesty rule names the model and the service. */
function whoWrote(digest) {
  const { composer, via } = digest.model;
  return `Written by ${composer} via ${via} from ${plural(digest.included.length, 'merged pull request')}, ${periodWords(digest.period)}.`;
}

/**
 * What the room is given to play a digest: the admitted Current, the page's address, who wrote it, and the pull
 * requests it speaks about, which About this reading lists while it plays.
 */
export function sealedReading(digest, team = null) {
  return {
    current: digest.current,
    path: changesPath(digest.id, team),
    who: whoWrote(digest),
    about: ['What changed:', ...digest.included.map(({ number, title }) => `#${number} ${title}`)]
  };
}

/** The line a superseded digest's page carries: the reading that replaced it, by its title, one press away. */
function supersededLine(replacement, team) {
  return `<p class="portal-help changes-superseded">A newer reading of this period replaces this one: <a href="${changesPath(replacement.id, team)}" data-changes-go>${escape(replacement.title)}</a>.</p>`;
}

function detailView(digest, replacement = null, team = null) {
  const when = periodWords(digest.period);
  const { router, via } = digest.model;
  const included = digest.included.map(({ number, title, url }) => `<li>
        <a href="${escape(url)}" target="_blank" rel="noopener noreferrer"><span class="changes-number">#${number}</span> ${escape(title)}</a>
      </li>`).join('');
  const chosen = digest.changes.map(change => `<li class="changes-route"${change.included ? ' data-included' : ''}>
        <a href="${escape(change.url)}" target="_blank" rel="noopener noreferrer"><span class="changes-number">#${change.number}</span> ${escape(change.title)}</a>
        <p class="changes-meta"><span class="changes-route-words">${change.route.audience} · ${change.route.significance} · ${change.route.kind}</span> — ${reasonWords(change)}</p>
      </li>`).join('');
  return `${EYEBROW}
    <h1 class="portal-title changes-title" id="portal-ask-title" tabindex="-1">${escape(digest.title)}</h1>
    <div id="changes">
      <p class="changes-meta">${escape(when)} · ${plural(digest.included.length, 'change')} in the reading ${badge(digest.audience)}</p>
      ${replacement ? supersededLine(replacement, team) : ''}
      <div class="portal-actions">
        <button class="portal-primary" type="button" data-changes-play>Open the reading</button>
        <p class="portal-status" id="changes-status" role="status" aria-live="polite"></p>
      </div>
      <p class="portal-help">${escape(whoWrote(digest))}</p>
      <section class="changes-section" aria-labelledby="changes-included-title">
        <h2 class="changes-heading" id="changes-included-title">What changed</h2>
        <ol class="changes-included">${included}</ol>
      </section>
      <details class="changes-chosen">
        <summary>How this was chosen</summary>
        <p class="portal-help">Every pull request merged in the period, routed by ${escape(router)} via ${escape(via)}: who it is for, how much it matters, what kind of change it is, and whether the reading tells it.</p>
        <ul class="changes-routes">${chosen}</ul>
        ${digest.quality ? `<p class="portal-help changes-quality">${escape(qualityLine(digest.quality))}</p>` : ''}
        ${digest.quality?.density ? `<p class="portal-help changes-density">${escape(densityLine(digest.quality.density))}</p>` : ''}
        ${digest.notes ?`<p class="portal-help">What the run let go:</p>
        <ul class="changes-notes">${digest.notes.map(note => `<li>${escape(note)}</li>`).join('')}</ul>` : ''}
      </details>
      <p class="portal-help"><a href="${changesPath(null, team)}" data-changes-go>All digests</a></p>
    </div>`;
}

function emptyView(line, href, link) {
  return `${EYEBROW}
    <h1 class="portal-title changes-title" id="portal-ask-title" tabindex="-1">RISE Changes</h1>
    <div id="changes">
      <p class="portal-help" role="status">${escape(line)}</p>
      <p class="portal-help"><a href="${href}" data-changes-go>${link}</a></p>
    </div>`;
}

/**
 * Show a changes address in `section`: the list (no `digestId`), or one digest, RISE's or the listed team's at `team`
 * (a slug; `teams` defaults to src/core/changes/listed.js). Its reading is one press away:
 * `launch(sealedReading(digest))` opens RISE's room for the admitted Current, at the digest's own address.
 * `go(path)` moves to another address in place.
 */
export async function mountChanges(section, { team: slug = null, digestId = null, launch, go, load, teams }) {
  section.innerHTML = `${EYEBROW}<p class="portal-status" role="status">Loading…</p>`;
  const team = slug === null ? null : listedTeam(slug, teams);
  let digest = null;
  try {
    if (slug !== null && team === null) section.innerHTML = emptyView('RISE shows no team\'s digests at this address.', '/changes', 'What changed in RISE');
    else if (digestId === null) section.innerHTML = listView(await loadChangesIndex(load, team), team);
    else {
      // The index says whether a re-run replaced this digest; a list that cannot be read only costs that line.
      const [loaded, entries] = await Promise.all([loadChangesDigest(digestId, load, team), loadChangesIndex(load, team).catch(() => [])]);
      digest = loaded;
      const replacedBy = entries.find(entry => entry.id === digestId)?.supersededBy;
      section.innerHTML = detailView(digest, entries.find(entry => entry.id === replacedBy) ?? null, team);
    }
  } catch (error) {
    console.warn('[RISE] Changes unavailable:', error);
    section.innerHTML = digestId === null
      ? emptyView('The list of digests could not be shown.', '/', 'Back to Home')
      : emptyView('This digest could not be shown.', changesPath(null, team), 'All digests');
  }
  if (moved) section.querySelector('h1')?.focus();
  moved = false;
  section.addEventListener('click', event => {
    const link = event.target.closest('a[data-changes-go]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    moved = true;
    go(link.getAttribute('href'));
  });
  const play = section.querySelector('[data-changes-play]');
  const status = section.querySelector('#changes-status');
  play?.addEventListener('click', async () => {
    if (play.disabled) return;
    play.disabled = true;
    status.textContent = 'Opening the reading…';
    try {
      await launch(sealedReading(digest, team));
      status.textContent = '';
    } catch (error) {
      status.textContent = error.message || 'This reading could not be opened.';
    } finally {
      play.disabled = false;
    }
  });
}
