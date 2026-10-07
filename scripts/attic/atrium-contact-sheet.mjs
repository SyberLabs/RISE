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

    /** Art Institute of Chicago — public API, id is the artwork id. */
    async aic(id) {
        const r = await fetch(
            `https://api.artic.edu/api/v1/artworks/${id}?fields=id,title,artist_display,date_display,is_public_domain,image_id,department_title,medium_display`,
            { headers: { 'User-Agent': UA } }
        );
        if (!r.ok) return null;
        const { data: o } = await r.json();
        if (!o) return null;
        return {
            id: `aic:${o.id}`,
            title: o.title,
            artist: (o.artist_display || '').split('\n')[0],
            date: o.date_display || '',
            medium: o.medium_display || '',
            dept: o.department_title || '',
            rights: o.is_public_domain ? 'CC0' : 'UNKNOWN',
            image: o.image_id
                ? `https://www.artic.edu/iiif/2/${o.image_id}/full/843,/0/default.jpg`
                : '',
            page: `https://www.artic.edu/artworks/${o.id}`
        };
    },

    /**
     * Rijksmuseum — key-free Linked Art resolver. id is the numeric
     * LOD id (https://id.rijksmuseum.nl/<id>). Resolution is 3 hops:
     * object → VisualItem (license lives here) → DigitalObject (IIIF
     * URL). Rights gate: the VisualItem must carry a Public Domain
     * Mark or CC0 statement.
     */
    async rijks(id) {
        const H = { 'User-Agent': UA, 'Accept': 'application/json' };
        const obj = await (await fetch(`https://id.rijksmuseum.nl/${id}`, { headers: H })).json()
            .catch(() => null);
        if (!obj || !obj.id) return null;
        const titles = (obj.identified_by || []).filter(x => x.type === 'Name').map(x => x.content);
        const objectNumber = (obj.identified_by || [])
            .find(x => x.type === 'Identifier' && /^[A-Z]{2}-/.test(x.content || ''))?.content || '';
        const visualRef = (obj.shows || [])[0]?.id;
        let rights = 'UNKNOWN';
        let image = '';
        if (visualRef) {
            await sleep(300);
            const vis = await (await fetch(visualRef, { headers: H })).json().catch(() => null);
            const visText = JSON.stringify(vis || {});
            if (/publicdomain\/(mark|zero)/.test(visText)) rights = 'CC0';
            const digRef = (vis?.digitally_shown_by || [])[0]?.id;
            if (digRef) {
                await sleep(300);
                const dig = await (await fetch(digRef, { headers: H })).json().catch(() => null);
                const access = (dig?.access_point || [])[0]?.id || '';
                // request a bounded IIIF size for the sheet
                image = access.replace('/full/max/', '/full/400,/');
            }
        }
        const artist = (obj.produced_by?.carried_out_by || [])
            .map(x => x._label).filter(Boolean).join(', ');
        return {
            id: `rijks:${id}`,
            title: titles[0] || '',
            artist,
            date: obj.produced_by?.timespan?._label || '',
            medium: (obj.made_of || []).map(x => x._label).filter(Boolean).join(', '),
            dept: `Rijksmuseum${objectNumber ? ' · ' + objectNumber : ''}`,
            rights,
            image,
            page: `https://id.rijksmuseum.nl/${id}`
        };
    },

    /**
     * Wikimedia Commons — id is the File: title. Rights come from the
     * file's own extmetadata: PD/CC0 map to CC0-equivalent for the
     * gate; anything else stays UNKNOWN and is flagged on the sheet.
     */
    async commons(id) {
        const title = String(id).startsWith('File:') ? String(id) : `File:${id}`;
        const u = 'https://commons.wikimedia.org/w/api.php?action=query&titles='
            + encodeURIComponent(title)
            + '&prop=imageinfo&iiprop=url|extmetadata|size&format=json&iiurlwidth=640';
        const r = await fetch(u, { headers: { 'User-Agent': UA } });
        if (!r.ok) return null;
        const d = await r.json();
        const page = Object.values(d?.query?.pages || {})[0];
        if (!page || page.missing !== undefined) return null;
        const ii = page.imageinfo?.[0];
        const em = ii?.extmetadata || {};
        const lic = String(em.License?.value || '').toLowerCase();
        const notCopyrighted = String(em.Copyrighted?.value || '') === 'False';
        return {
            id: `commons:${title}`,
            title: String(em.ObjectName?.value || title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '')),
            artist: String(em.Artist?.value || '').replace(/<[^>]+>/g, '').trim(),
            date: String(em.DateTimeOriginal?.value || '').replace(/<[^>]+>/g, '').slice(0, 40),
            medium: '',
            dept: 'Wikimedia Commons',
            rights: (lic.startsWith('pd') || lic === 'cc0' || notCopyrighted) ? 'CC0' : 'UNKNOWN',
            image: ii?.thumburl || ii?.url || '',
            page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`
        };
    },

    /**
     * Princeton University Art Museum — object JSON + IIIF image
     * service. The museum's PD statement lives on the object page;
     * IIIF media with no restrictions maps to CC0-equivalent when the
     * curator has verified the page states Public Domain (note it in
     * the candidate's `note`).
     */
    async princeton(id) {
        const r = await fetch(`https://data.artmuseum.princeton.edu/objects/${id}`,
            { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
        if (!r.ok) return null;
        const o = await r.json();
        if (!o || !o.objectnumber) return null;
        const media = (o.media || []).find(m => m.isprimary) || (o.media || [])[0];
        const iiif = media?.uri || '';
        return {
            id: `princeton:${id}`,
            title: o.displaytitle || o.title || '',
            artist: (o.makers || []).map(m => m.displayname).join(', ')
                || (o.cultureterms || []).map(c => c.culture).join(', '),
            date: o.displaydate || '',
            medium: o.medium || '',
            dept: 'Princeton University Art Museum',
            rights: media && media.restrictions == null ? 'CC0' : 'UNKNOWN',
            image: iiif ? `${iiif}/full/640,/0/default.jpg` : '',
            page: `https://artmuseum.princeton.edu/art/collections/objects/${id}`
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
            // A miss may be rate limiting rather than a bad pin — one
            // retry after a long backoff before declaring it unresolved
            // (a burst of Commons requests taught this the hard way).
            if (!work) {
                await sleep(4000);
                try {
                    work = await resolve(pin.id);
                } catch (error) {
                    work = null;
                }
            }
            await sleep(900);

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
