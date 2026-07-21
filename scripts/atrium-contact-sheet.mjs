/**
 * Atrium curation tool — resolve candidate works and build a contact sheet.
 *
 * Step 3 of the curation workflow (ATRIUM-IMAGERY-SPEC.md §7): a human
 * looks at the images. This is the step the previous Wikimedia-category
 * system lacked, and no automated metric replaces it — `atr-james-watt`
 * passed every machine check we could devise and still fails on sight.
 *
 * Usage:
 *   node scripts/atrium-contact-sheet.mjs candidates.json out.html
 *
 * Input is { collectionId: [{ source, id, note? }, ...] }. Output is a
 * static page showing every candidate at thumbnail size with its full
 * catalog record, so approval is a visual judgment made against real
 * attribution rather than against a filename.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const UA = 'RISE-Atrium/1.0 (curation contact sheet)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const RESOLVERS = {
    async met(id) {
        const r = await fetch(
            `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
            { headers: { 'User-Agent': UA } }
        );
        if (!r.ok) return null;
        const o = await r.json();
        if (!o || o.message) return null;
        return {
            id: `met:${o.objectID}`,
            title: o.title,
            artist: o.artistDisplayName || '',
            date: o.objectDate || '',
            medium: o.medium || '',
            dept: o.department || '',
            rights: o.isPublicDomain ? 'CC0' : 'UNKNOWN',
            image: o.primaryImageSmall || o.primaryImage || '',
            page: o.objectURL || ''
        };
    },

    async cleveland(id) {
        const r = await fetch(`https://openaccess-api.clevelandart.org/api/artworks/${id}`,
            { headers: { 'User-Agent': UA } });
        if (!r.ok) return null;
        const { data } = await r.json();
        if (!data) return null;
        const creator = data.creators?.[0]?.description || '';
        return {
            id: `cleveland:${id}`,
            title: data.title,
            artist: creator,
            date: data.creation_date || '',
            medium: data.technique || data.type || '',
            dept: data.department || '',
            rights: data.share_license_status === 'CC0' ? 'CC0' : 'UNKNOWN',
            image: data.images?.web?.url || '',
            page: data.url || ''
        };
    }
};

const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function main() {
    const [, , inPath, outPath = 'contact-sheet.html'] = process.argv;
    if (!inPath) {
        console.error('usage: atrium-contact-sheet.mjs <candidates.json> [out.html]');
        process.exit(1);
    }

    const candidates = JSON.parse(readFileSync(inPath, 'utf8'));
    const sections = [];

    for (const [collectionId, pins] of Object.entries(candidates)) {
        const cards = [];
        for (const pin of pins) {
            const resolve = RESOLVERS[pin.source];
            if (!resolve) {
                cards.push({ error: `no adapter for source "${pin.source}"`, pin });
                continue;
            }
            let work = null;
            try {
                work = await resolve(pin.id);
            } catch (error) {
                work = null;
            }
            await sleep(400);

            if (!work) {
                cards.push({ error: 'did not resolve', pin });
                continue;
            }
            // Flags the curator must see, not silently filtered away
            const flags = [];
            if (work.rights !== 'CC0') flags.push('RIGHTS');
            if (!work.image) flags.push('NO IMAGE');
            cards.push({ work, flags, pin });
            console.log(`${collectionId.padEnd(22)} ${String(pin.id).padEnd(8)} ${flags.join(',').padEnd(10)} ${work.title?.slice(0, 46)}`);
        }
        sections.push({ collectionId, cards });
    }

    writeFileSync(outPath, render(sections));
    console.log(`\nwrote ${outPath}`);
}

function render(sections) {
    const body = sections.map(({ collectionId, cards }) => `
    <section>
      <h2>${esc(collectionId)} <span class="count">${cards.length} candidates</span></h2>
      <div class="grid">
        ${cards.map(c => c.error ? `
          <div class="card bad">
            <div class="ph">unresolved</div>
            <div class="meta"><strong>${esc(c.pin.source)}:${esc(c.pin.id)}</strong>
            <div class="err">${esc(c.error)}</div>
            ${c.pin.note ? `<div class="note">${esc(c.pin.note)}</div>` : ''}</div>
          </div>` : `
          <div class="card${c.flags.length ? ' flagged' : ''}">
            <a href="${esc(c.work.page)}" target="_blank" rel="noopener">
              <img loading="lazy" src="${esc(c.work.image)}" alt="${esc(c.work.title)}">
            </a>
            <div class="meta">
              <strong>${esc(c.work.title)}</strong>
              <div>${esc(c.work.artist || '—')}</div>
              <div class="dim">${esc(c.work.date)} · ${esc(c.work.medium).slice(0, 40)}</div>
              <div class="dim">${esc(c.work.dept)}</div>
              <div class="id">${esc(c.work.id)} · ${esc(c.work.rights)}</div>
              ${c.flags.length ? `<div class="flag">${esc(c.flags.join(' · '))}</div>` : ''}
              ${c.pin.note ? `<div class="note">${esc(c.pin.note)}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>
    </section>`).join('');

    return `<!doctype html><meta charset="utf-8"><title>Atrium contact sheet</title>
<style>
 body{margin:0;padding:28px;background:#0b0b0d;color:#d8d8de;
      font:14px/1.5 -apple-system,Segoe UI,sans-serif}
 h1{font-weight:300;letter-spacing:.04em}
 h2{font-weight:400;margin:36px 0 12px;border-bottom:1px solid #26262c;padding-bottom:8px}
 .count{color:#6b6b75;font-size:12px;font-weight:400}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}
 .card{background:#141418;border:1px solid #26262c;border-radius:3px;overflow:hidden}
 .card.flagged{border-color:#d4a574}
 .card.bad{border-color:#d47f8b}
 img{width:100%;height:210px;object-fit:cover;display:block;background:#000}
 .ph{height:210px;display:flex;align-items:center;justify-content:center;color:#6b6b75;
     font:11px monospace;background:#000}
 .meta{padding:10px 12px 12px;font-size:12px}
 .meta strong{color:#e8e8ec;font-weight:500}
 .dim{color:#8b8b95;font-size:11px}
 .id{color:#6b6b75;font:10px monospace;margin-top:6px}
 .flag{color:#d4a574;font:10px monospace;margin-top:4px}
 .err{color:#d47f8b;font:11px monospace;margin-top:4px}
 .note{color:#9b9ba5;font-style:italic;font-size:11px;margin-top:4px}
</style>
<h1>Atrium contact sheet</h1>
<p style="color:#8b8b95">Approve only what you would want a reader to see mid-passage.</p>
${body}`;
}

main().catch(e => { console.error(e); process.exit(1); });
