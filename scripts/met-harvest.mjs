/**
 * Met harvest → interactive contact sheet.
 *
 * Find candidates, then discard most. Every candidate starts KEPT; a click
 * discards. Done → paste-ready block for ATRIUM_PINNED_COLLECTIONS.
 *
 *   node scripts/met-harvest.mjs --dept 13 --q "Achilles" --out sheet.html
 *   node scripts/met-harvest.mjs --config harvest.json
 *
 * Discard-default (not select-to-keep): the eye rejects faster than it
 * approves; an untouched kept work has been looked at, not missed.
 *
 * Met search is unstable across identical calls — union object ids across
 * repeated attempts (MUSEUM-ATLAS §4). Search returns ids only; each
 * candidate needs its own fetch. Pace ~1 req/s, retry once after backoff,
 * never concurrent.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const API = 'https://collectionapi.metmuseum.org/public/collection/v1';
const UA = 'RISE-Atrium/1.0 (curation harvest; contact sheet review)';
const PACE_MS = 950;
const BACKOFF_MS = 5000;
const SEARCH_ATTEMPTS = 3;
const MAX_CANDIDATES = 400;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url, attempt = 0) {
    try {
        const response = await fetch(url, { headers: { 'User-Agent': UA } });
        if (!response.ok) throw new Error(`${response.status}`);
        return await response.json();
    } catch (error) {
        if (attempt >= 1) return null;
        // A miss may be rate limiting rather than absence.
        await sleep(BACKOFF_MS);
        return getJson(url, attempt + 1);
    }
}

/**
 * Object ids for one query, unioned across repeated attempts.
 *
 * Returns a Map of id -> how many attempts saw it, because a candidate
 * the index agreed on three times out of three is worth more of a
 * curator's attention than one it mentioned once.
 */
async function search(params) {
    // Pass params through unchanged: Met search does not intersect axes
    // cleanly, and injected defaults can zero or ignore the query.
    const query = new URLSearchParams(params).toString();
    const seen = new Map();
    for (let attempt = 0; attempt < SEARCH_ATTEMPTS; attempt++) {
        const data = await getJson(`${API}/search?${query}`);
        await sleep(PACE_MS);
        for (const id of data?.objectIDs || []) {
            seen.set(id, (seen.get(id) || 0) + 1);
        }
        process.stderr.write(
            `  search attempt ${attempt + 1}: ${data?.total ?? 'null'} total, ${seen.size} unique so far\n`);
    }
    return seen;
}

async function fetchObject(id) {
    const o = await getJson(`${API}/objects/${id}`);
    await sleep(PACE_MS);
    if (!o || o.message) return null;
    return {
        objectID: o.objectID,
        title: o.title || '(untitled)',
        artist: o.artistDisplayName || o.culture || '',
        date: o.objectDate || '',
        medium: o.medium || '',
        classification: o.classification || '',
        dept: o.department || '',
        culture: o.culture || '',
        // The ONLY value that clears (MUSEUM-ATLAS §5).
        publicDomain: o.isPublicDomain === true,
        image: o.primaryImageSmall || o.primaryImage || '',
        full: o.primaryImage || '',
        page: o.objectURL || ''
    };
}

/** Every declared field must contain its value. An empty filter passes all. */
function matchesFilter(work, filters) {
    return filters.every(({ field, value }) =>
        String(work[field] ?? '').toLowerCase().includes(value));
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function render(collectionId, queries, works) {
    const cards = works.map(w => `
    <figure class="card" data-id="${w.objectID}"
            data-comment="${esc(`${w.artist ? w.artist + ', ' : ''}${w.title}${w.date ? ', ' + w.date : ''}`)}">
      <div class="thumb"><img loading="lazy" src="${esc(w.image)}" alt=""></div>
      <figcaption>
        <span class="t">${esc(w.title)}</span>
        <span class="a">${esc(w.artist || w.culture || '—')}</span>
        <span class="m">${esc(w.date)} · ${esc(w.classification || w.medium)}</span>
        <span class="k">met:${w.objectID} · seen ${w.agreement}/${SEARCH_ATTEMPTS}
          <a href="${esc(w.page)}" target="_blank" rel="noreferrer">record</a></span>
      </figcaption>
      <button class="x" title="Discard">✕</button>
    </figure>`).join('');

    return `<!doctype html><meta charset="utf-8">
<title>Met contact sheet — ${esc(collectionId)}</title>
<style>
  :root { color-scheme: dark; }
  body { background:#0b0b0d; color:#e8e8ea; font:14px/1.5 system-ui,sans-serif; margin:0; padding:24px 28px 120px; }
  h1 { font-weight:300; font-size:1.5rem; margin:0 0 4px; }
  .sub { color:#8b8b93; margin:0 0 6px; }
  .queries { color:#6f6f78; font:12px ui-monospace,monospace; margin:0 0 20px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:16px; }
  .card { margin:0; background:#141418; border:1px solid #24242c; border-radius:4px;
          overflow:hidden; position:relative; transition:opacity .12s, filter .12s; }
  .card.out { opacity:.22; filter:grayscale(1); }
  .card.out .x { transform:rotate(45deg); }
  .thumb { aspect-ratio:1; background:#000; display:grid; place-items:center; }
  .thumb img { width:100%; height:100%; object-fit:contain; }
  figcaption { display:flex; flex-direction:column; gap:2px; padding:8px 10px 10px; }
  .t { font-size:.85rem; line-height:1.3; }
  .a { color:#a9a9b2; font-size:.78rem; }
  .m, .k { color:#6f6f78; font-size:.72rem; }
  .k a { color:#6f6f78; }
  .x { position:absolute; top:6px; right:6px; width:26px; height:26px; border-radius:50%;
       border:1px solid #33333d; background:#0e0e12cc; color:#c9c9d2; cursor:pointer;
       font-size:13px; line-height:1; transition:transform .12s; }
  .x:hover { background:#1d1d24; }
  .bar { position:fixed; left:0; right:0; bottom:0; padding:12px 28px; background:#111116;
         border-top:1px solid #26262e; display:flex; gap:16px; align-items:center; }
  .bar button { background:#2a2a5c; color:#e8e8ea; border:1px solid #3b3b7a;
                border-radius:3px; padding:8px 16px; cursor:pointer; font:inherit; }
  .bar .count { color:#8b8b93; font:13px ui-monospace,monospace; }
  textarea { position:fixed; left:-9999px; }
</style>
<h1>${esc(collectionId)}</h1>
<p class="sub">${works.length} candidates. Every one starts <strong>kept</strong> — click ✕ to discard.
   All are public domain; rights were checked per object before this page was written.</p>
<p class="queries">${queries.map(q => esc(JSON.stringify(q))).join('  ·  ')}</p>
<div class="grid">${cards}</div>
<div class="bar">
  <button id="copy">Copy kept pins</button>
  <span class="count" id="count"></span>
  <span class="count">Paste into ATRIUM_PINNED_COLLECTIONS in src/content/atrium/imagery/collections.js</span>
</div>
<textarea id="sink"></textarea>
<script>
  const cards = [...document.querySelectorAll('.card')];
  const count = document.getElementById('count');
  const tally = () => {
    const kept = cards.filter(c => !c.classList.contains('out'));
    count.textContent = kept.length + ' kept / ' + cards.length;
    return kept;
  };
  cards.forEach(card => {
    const toggle = () => { card.classList.toggle('out'); tally(); };
    card.querySelector('.x').addEventListener('click', e => { e.stopPropagation(); toggle(); });
    card.querySelector('.thumb').addEventListener('click', toggle);
  });
  document.getElementById('copy').addEventListener('click', () => {
    const lines = tally().map(c =>
      "            { source: 'met', id: " + c.dataset.id + " },  // " + c.dataset.comment);
    const block = "    '${esc(collectionId)}': {\\n        name: '',\\n        works: [\\n"
      + lines.join('\\n').replace(/,(\\s*\\/\\/[^\\n]*)$/, '$1') + "\\n        ]\\n    },";
    const sink = document.getElementById('sink');
    sink.value = block;
    sink.select();
    document.execCommand('copy');
    navigator.clipboard?.writeText(block).catch(() => {});
    count.textContent = tally().length + ' kept — copied to clipboard';
  });
  tally();
</script>`;
}

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        if (!argv[i].startsWith('--')) continue;
        const key = argv[i].slice(2);
        const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
        if (key === 'q') (args.q ||= []).push(value);
        else args[key] = value;
    }
    return args;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const collectionId = args.collection || 'atr-new-collection';
    const out = args.out || 'met-contact-sheet.html';

    const queries = args.config
        ? JSON.parse(readFileSync(args.config, 'utf8')).queries
        : (args.q || ['']).map(q => (
            // Two axes, never combined — see search().
            //
            // A term search pairs with hasImages rather than with
            // isPublicDomain, and that is deliberate. Achilles+PD
            // returns 7 where Achilles+hasImages returns 140, and the
            // rights gate loses nothing by moving: the atlas requires
            // rights to be checked PER WORK at the authoritative
            // location, which fetchObject does anyway. Filtering in
            // the search merely hides candidates from the curator on
            // the word of an index that disagrees with itself.
            //
            // A department search stands alone; q is ignored beside it.
            args.dept
                // `q` is required syntactically and IGNORED semantically
                // beside departmentId, which is exactly what makes this
                // axis trustworthy: it returns a department, not a rank.
                ? { departmentId: args.dept, q: 'a' }
                : { q, hasImages: 'true' }
        ));

    const agreement = new Map();
    for (const query of queries) {
        process.stderr.write(`\nquery ${JSON.stringify(query)}\n`);
        const seen = await search(query);
        for (const [id, n] of seen) agreement.set(id, Math.max(agreement.get(id) || 0, n));
    }

    // Bounded runs, so a 21,937-object department can be walked in
    // sittings rather than in one six-hour crawl.
    const offset = Number(args.offset) || 0;
    const limit = Number(args.limit) || MAX_CANDIDATES;
    const ids = [...agreement.keys()].slice(offset, offset + limit);
    process.stderr.write(
        `\n${agreement.size} ids; taking ${ids.length} from offset ${offset}\n`);

    // LOCAL FILTERING, BECAUSE THE INDEX CANNOT BE ASKED.
    //
    // Measured 2026-07-30: the Met's q search does not find subjects.
    // `q=Achilles&isPublicDomain=true` returns seven works and not one
    // of them contains Achilles — Manet's Boating, Gauguin's Ia Orana
    // Maria, an Egyptian peasant woman. `title=true` returns zero for
    // everything. Iconography cannot be searched for; a department can
    // be enumerated, and the sorting happens here and then in an eye.
    const filters = String(args.filter || '').split(',').filter(Boolean).map(pair => {
        const [field, value] = pair.split('=');
        return { field: field.trim(), value: String(value || '').trim().toLowerCase() };
    });

    const works = [];
    let withheld = 0;
    let offTarget = 0;
    for (const [i, id] of ids.entries()) {
        const work = await fetchObject(id);
        if (!work) continue;
        // Rights are checked per work at the authoritative location
        // (MUSEUM-ATLAS §5). A non-PD object never reaches the sheet,
        // so a curator is never asked to judge something unusable.
        if (!work.publicDomain || !work.image) { withheld++; continue; }
        if (!matchesFilter(work, filters)) { offTarget++; continue; }
        work.agreement = agreement.get(id);
        works.push(work);
        if ((i + 1) % 25 === 0) {
            process.stderr.write(`  ${i + 1}/${ids.length} — ${works.length} kept\n`);
        }
    }

    works.sort((a, b) => b.agreement - a.agreement);
    writeFileSync(out, render(collectionId, queries, works));
    process.stderr.write(
        `\n${works.length} on the sheet, ${withheld} withheld (rights or no image)`
        + `${filters.length ? `, ${offTarget} off-filter` : ''}\n`
        + `wrote ${out}\n`);
}

main();
