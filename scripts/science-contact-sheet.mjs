/**
 * Science imagery contact sheet — step 3 of the curation workflow.
 *
 *   node scripts/harvest-science.mjs --out science.candidates.json
 *   node scripts/science-contact-sheet.mjs science.candidates.json sheet.html
 *
 * A human looks at the images. No automated metric replaces this step —
 * `atr-james-watt` passed every machine check we could devise and still
 * failed on sight, which is why `atrium-contact-sheet.mjs` exists and why
 * this does too.
 *
 * TWO THINGS MAKE THIS SHEET DIFFERENT FROM THE ATRIUM ONE.
 *
 * It does not resolve. The Atrium sheet takes bare `{source, id}` pins and
 * fetches each record; these candidates arrive with their metadata and a
 * delivery URL the harvest already probed, so the sheet is a pure
 * renderer and runs offline.
 *
 * And it shows the CREDIT, verbatim, as the Chamber chip will render it.
 * This is the first harvest carrying works that owe attribution, so the
 * question a reviewer must answer is no longer only "does this belong
 * mid-passage" but "is this line what we are obliged to say, and does it
 * read as a sentence rather than as a database row". A credit that is
 * wrong here is wrong on every page the work appears on, and the sheet is
 * the last place to see it before it is pinned.
 *
 * The verdicts persist in localStorage and export as JSON, because 234
 * candidates is not a single sitting and a review that loses its place is
 * a review that gets rushed.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * Licence classes shown as themselves, never merged into "open".
 *
 * The whole point of `LICENCE` was that these obligations are opposite:
 * a CC0 specimen photograph and a CC-BY observatory plate are reviewed
 * against different questions, and a sheet that coloured them alike would
 * undo the separation the label boundary was built to hold.
 */
const LICENCE_NOTE = {
    'open': 'no attribution owed',
    'cc-by': 'credit + licence required',
    'cc-by-sa': 'credit + licence, share-alike governs derivatives',
    'public-domain-credit': 'not copyrighted; acknowledgement asked',
    'undeclared': 'NOTHING DECLARED — do not pin'
};

function card(w) {
    const note = LICENCE_NOTE[w.licence] || w.licence;
    const dims = w.delivery?.type ? w.delivery.type.replace('image/', '') : '';
    return `
    <label class="card" data-source="${esc(w.sourceName)}" data-licence="${esc(w.licence)}" data-id="${esc(w.id)}">
      <input type="checkbox" class="pick">
      <span class="tick">✓</span>
      <a class="frame" href="${esc(w.page || w.sourceUrl)}" target="_blank" rel="noopener">
        <img loading="lazy" src="${esc(w.thumb || w.image)}" alt="${esc(w.title)}">
      </a>
      <div class="meta">
        <strong>${esc(w.title) || '<em class="warn">untitled</em>'}</strong>
        <div class="dim">${esc(w.artist || w.credit || '—')}</div>
        <div class="dim">${esc(w.date)}${w.term ? ` · <span class="term">${esc(w.term)}</span>` : ''}</div>
        <div class="lic lic-${esc(w.licence)}">${esc(w.licence)} — ${esc(note)}</div>
        <div class="credit" title="exactly what the chip will show">${esc(w.requiredCredit) || '<em>no credit line</em>'}</div>
        <div class="id">${esc(w.id)} · ${esc(dims)}</div>
      </div>
    </label>`;
}

function render(doc) {
    const works = doc.works || [];
    const bySource = {};
    for (const w of works) (bySource[w.sourceName] ||= []).push(w);

    const sections = Object.entries(bySource).map(([source, list]) => `
    <section data-section="${esc(source)}">
      <h2>${esc(source)} <span class="count">${list.length}</span></h2>
      <div class="grid">${list.map(card).join('')}</div>
    </section>`).join('');

    const licences = Object.entries(doc.licences || {})
        .map(([k, n]) => `<span class="pill lic-${esc(k)}">${esc(k)} ${n}</span>`).join('');

    const rejected = (doc.rejected || []).length ? `
    <section>
      <h2>Rejected at harvest <span class="count">${doc.rejected.length}</span></h2>
      <p class="sub">Dropped before review. A work that will not resolve is absent,
      never a broken frame — and one that cannot be credited is absent, never uncredited.</p>
      <ul class="rej">${doc.rejected.map(r =>
        `<li><code>${esc(r.id)}</code> — ${esc(r.why)}</li>`).join('')}</ul>
    </section>` : '';

    return `<!doctype html><meta charset="utf-8">
<title>Science imagery contact sheet</title>
<style>
 :root{color-scheme:dark}
 body{margin:0;padding:24px 24px 96px;background:#0b0b0d;color:#d8d8de;
      font:14px/1.5 -apple-system,Segoe UI,sans-serif}
 h1{font-weight:300;letter-spacing:.04em;margin:0 0 4px}
 .sub{color:#8b8b95;margin:0 0 18px;max-width:70ch}
 h2{font-weight:400;margin:34px 0 12px;border-bottom:1px solid #26262c;padding-bottom:8px}
 .count{color:#6b6b75;font-size:12px}
 .pill{display:inline-block;padding:2px 9px;border-radius:99px;font:11px monospace;
       margin-right:6px;border:1px solid currentColor}
 .lic-open{color:#7fb37f}
 .lic-cc-by{color:#d4a574}
 .lic-cc-by-sa{color:#c98fb0}
 .lic-public-domain-credit{color:#7fa8d4}
 .lic-undeclared{color:#d47f8b}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
 .card{position:relative;display:block;background:#141418;border:1px solid #26262c;
       border-radius:3px;overflow:hidden;cursor:pointer}
 .card:has(.pick:checked){border-color:#7fb37f;box-shadow:0 0 0 1px #7fb37f}
 .pick{position:absolute;opacity:0;pointer-events:none}
 .tick{position:absolute;top:8px;right:8px;z-index:2;width:22px;height:22px;border-radius:3px;
       background:#0b0b0dcc;border:1px solid #3a3a44;color:transparent;text-align:center;
       line-height:21px;font-size:13px}
 .card:has(.pick:checked) .tick{background:#7fb37f;border-color:#7fb37f;color:#0b0b0d}
 /* CONTAIN, NOT COVER. These are wide-field astronomical plates and
    specimen sheets; cropping them to a square misrepresents the very
    composition the reviewer is being asked to judge. */
 .frame{display:block;height:200px;background:#000}
 img{width:100%;height:100%;object-fit:contain;display:block}
 .meta{padding:9px 11px 11px;font-size:12px}
 .meta strong{color:#e8e8ec;font-weight:500;display:block;
              overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .dim{color:#8b8b95;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .term{color:#6b6b75;font:10px monospace}
 .lic{font:10px monospace;margin-top:6px}
 .credit{color:#b9b9c3;font-size:11px;margin-top:5px;padding:5px 7px;background:#0f0f13;
         border-left:2px solid #3a3a44;word-break:break-word}
 .id{color:#5b5b65;font:10px monospace;margin-top:6px}
 .warn{color:#d47f8b}
 .rej{color:#8b8b95;font-size:12px}
 .rej code{color:#d47f8b}
 #bar{position:fixed;left:0;right:0;bottom:0;background:#141418ee;border-top:1px solid #2c2c34;
      padding:12px 24px;display:flex;gap:14px;align-items:center;backdrop-filter:blur(6px)}
 button{background:#1e1e24;color:#d8d8de;border:1px solid #3a3a44;border-radius:3px;
        padding:6px 13px;font:12px inherit;cursor:pointer}
 button:hover{border-color:#6b6b75}
 #n{font:12px monospace;color:#7fb37f}
 #out{position:fixed;inset:8% 12%;background:#0f0f13;border:1px solid #3a3a44;padding:18px;
      display:none;overflow:auto;z-index:9;white-space:pre-wrap;font:11px monospace}
</style>

<h1>Science imagery — contact sheet</h1>
<p class="sub">Keep only what you would want a reader to meet mid-passage.
The boxed line under each work is <strong>the credit exactly as the Chamber chip will render it</strong> —
if it reads as a database row rather than a sentence, that is a finding, not a detail.</p>
<p>${licences}</p>

${sections}
${rejected}

<div id="bar">
  <span id="n">0 kept</span>
  <button data-all>select all visible</button>
  <button data-none>clear all</button>
  <button data-invert>invert visible</button>
  <button data-export>export kept →</button>
  <button data-close style="display:none">close</button>
</div>
<pre id="out"></pre>

<script>
const KEY = 'rise.science.contactsheet';
const picks = document.querySelectorAll('.pick');
const state = new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));

// PERSIST. 234 candidates is not one sitting, and a review that loses its
// place is a review that gets rushed.
const idOf = (el) => el.closest('.card').dataset.id;
const save = () => {
  localStorage.setItem(KEY, JSON.stringify([...state]));
  document.getElementById('n').textContent = state.size + ' kept';
};
picks.forEach(p => {
  if (state.has(idOf(p))) p.checked = true;
  p.addEventListener('change', () => {
    p.checked ? state.add(idOf(p)) : state.delete(idOf(p));
    save();
  });
});
save();

const visible = () => [...picks].filter(p => p.closest('.card').offsetParent !== null);
const setAll = (list, on) => { list.forEach(p => { p.checked = on; on ? state.add(idOf(p)) : state.delete(idOf(p)); }); save(); };

document.querySelector('[data-all]').onclick = () => setAll(visible(), true);
document.querySelector('[data-none]').onclick = () => setAll([...picks], false);
document.querySelector('[data-invert]').onclick = () =>
  visible().forEach(p => { p.checked = !p.checked; p.checked ? state.add(idOf(p)) : state.delete(idOf(p)); save(); });

const out = document.getElementById('out');
const closeBtn = document.querySelector('[data-close]');
document.querySelector('[data-export]').onclick = () => {
  out.textContent = JSON.stringify([...state], null, 2);
  out.style.display = 'block';
  closeBtn.style.display = '';
  // Select it so it can be copied straight out; no clipboard permission
  // prompt, no dependency, and it still works from a file:// URL.
  const r = document.createRange(); r.selectNodeContents(out);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
};
closeBtn.onclick = () => { out.style.display = 'none'; closeBtn.style.display = 'none'; };
</script>`;
}

const [, , inPath, outPath = 'science-contact-sheet.html'] = process.argv;
if (!inPath) {
    console.error('usage: science-contact-sheet.mjs <candidates.json> [out.html]');
    process.exit(1);
}
const doc = JSON.parse(readFileSync(inPath, 'utf8'));
writeFileSync(outPath, render(doc));

const works = doc.works || [];
const missing = works.filter(w => !w.thumb && !w.image).length;
const noCredit = works.filter(w => !w.requiredCredit).length;
console.log(`${works.length} candidates → ${outPath}`);
console.log(`  by licence   ${JSON.stringify(doc.licences || {})}`);
if (missing) console.log(`  ! ${missing} with no image to show`);
if (noCredit) console.log(`  ! ${noCredit} with an empty credit line`);
console.log('\nOpen it, keep what belongs mid-passage, then export.');
