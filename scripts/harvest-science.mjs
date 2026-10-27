/**
 * Harvest candidate science imagery — cosmos and natural history.
 *
 *   node scripts/harvest-science.mjs                     # all sources
 *   node scripts/harvest-science.mjs --source esahubble --limit 40
 *
 * WHAT THIS PRODUCES, AND WHAT IT DOES NOT.
 *
 * It produces CANDIDATES, not a shelf. RISE is curation-only: a
 * collection is a fixed list of works someone looked at, which is why
 * `probe-collections.mjs` can assert that 341 pinned works resolve and
 * mean something by it. Nothing here reaches a reader until it has been
 * contact-sheet reviewed and pinned, exactly as the Rijksmuseum and
 * Cleveland harvests were (`museum-pins.js` records their culls).
 *
 * So the output is a reviewable file, and the pipeline is:
 *
 *     harvest  →  contact-sheet review  →  pin  →  probe
 *
 * Rights are read with the same `licenceClassOf` / `artworkMayBeShown`
 * vocabulary the presenter uses (imported from artwork-label), so the
 * harvester cannot admit what Chamber refuses or refuse what Chamber shows.
 * Uncreditables are dropped here.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { licenceClassOf, artworkMayBeShown, normalizeArtworkLabel, LICENCE }
    from '../src/visuals/artwork-label.js';
import { getJson as get, sleep, verifyAll, djangoplicity, interleave, nasaRow }
    from './lib/collection-feeds.mjs';

const args = process.argv.slice(2);
const flag = (n, d = null) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const only = flag('source');
const limit = Number(flag('limit', '60'));
const out = flag('out', 'science-catalog.candidates.json');
const verify = !args.includes('--no-verify');

// ── Sources ─────────────────────────────────────────────────────────

/**
 * Smithsonian Open Access — the only per-item machine-readable licence.
 *
 * THE QUERY SYNTAX IS NARROW and worth recording. `online_media_type:
 * Images AND bird` returns 55 media items from 60 rows, every one CC0.
 * `unit_code:NMNH`, a multi-word phrase, and a bare `galaxy` all return
 * ZERO. So the harvest asks one word at a time behind the media filter,
 * and it asks natural history rather than cosmos: this is a natural
 * history museum, and its nebula holdings are one image per sixty rows.
 */

async function smithsonian({ terms, rows }) {
    const key = process.env.SI_API_KEY || 'DEMO_KEY';
    const groups = [];
    for (const term of terms) {
        const q = `online_media_type:Images AND ${term}`;
        const url = `https://api.si.edu/openaccess/api/v1.0/search`
            + `?q=${encodeURIComponent(q)}&api_key=${key}&rows=${rows}`;
        let body;
        try { body = await get(url, `Smithsonian(${term})`); }
        catch (err) {
            if (err.status === 429) {
                throw new Error(
                    'rate limited. DEMO_KEY proves the endpoint and cannot harvest with it — '
                    + 'get a free key at https://api.data.gov/signup/ and set SI_API_KEY');
            }
            console.log(`  ! ${term}: ${err.message}`);
            continue;
        }
        groups.push(harvestSmithsonianRows(body, term));
        // Polite pacing between terms; the museum harvests set this
        // precedent and nothing here is in a hurry.
        await sleep(400);
    }
    return interleave(groups);
}

function harvestSmithsonianRows(body, term) {
    const out = [];
    for (const row of body.response?.rows || []) {
        const d = row.content?.descriptiveNonRepeating || {};
        // ONLY 1 IN 40 SEARCH ROWS CARRIES MEDIA (§2z). Filtering here
        // rather than counting rowCount is why the yield is honest.
        for (const media of d.online_media?.media || []) {
            if (media.type && media.type !== 'Images') continue;
            out.push({
                id: `si:${media.idsId || media.guid || row.id}`,
                title: row.title,
                description: '',
                artist: '',
                credit: '',
                date: '',
                // The authoritative per-item field.
                rights: media.usage?.access || '',
                sourceName: d.data_source || 'Smithsonian',
                sourceUrl: d.guid || d.record_link || '',
                kind: media.type || 'Images',
                // IDS delivers the pixels directly and needs no key —
                // which is the whole basis of the no-secret design, so it
                // is verified rather than trusted.
                image: media.content || media.thumbnail || '',
                thumb: media.thumbnail || media.content || '',
                page: d.record_link || d.guid || '',
                term });
        }
    }
    return out;
}

/** NASA Image and Video Library; the row's rights and credit are read in `nasaRow`. */
async function nasa({ query, rows }) {
    const url = `https://images-api.nasa.gov/search`
        + `?q=${encodeURIComponent(query)}&media_type=image&page_size=${rows}`;
    const body = await get(url, 'NASA');
    return (body.collection?.items || []).map(nasaRow);
}

const SOURCES = {
    esahubble: () => djangoplicity({
        id: 'esahubble', sourceName: 'ESA/Hubble',
        feed: 'https://esahubble.org/images/json/',
        sourceBase: 'https://esahubble.org/images/'
    }),
    eso: () => djangoplicity({
        id: 'eso', sourceName: 'ESO',
        feed: 'https://www.eso.org/public/images/json/',
        sourceBase: 'https://www.eso.org/public/images/'
    }),
    smithsonian: () => smithsonian({
        terms: ['bird', 'botanical', 'butterfly', 'orchid', 'shell', 'fossil'], rows: 60 }),
    nasa: () => nasa({ query: 'nebula galaxy', rows: 100 })
};

// ── Harvest ─────────────────────────────────────────────────────────

const works = [];
const rejected = [];
const report = [];

for (const [name, run] of Object.entries(SOURCES)) {
    if (only && name !== only) continue;
    let rows = [];
    const keptRows = [];
    try { rows = await run(); } catch (err) {
        report.push({ source: name, error: String(err.message) });
        console.log(`${name.padEnd(13)} FAILED — ${err.message}`);
        continue;
    }

    // ONE IMAGE IS ONE CANDIDATE. Smithsonian records share media across
    // catalogue entries — the first harvest returned 60 rows with 60
    // distinct record URLs and only 39 distinct images, so a third of the
    // shelf was the same photograph under different accession numbers.
    // Deduping BEFORE the cut is what makes `--limit` mean what it says;
    // after the cut it would silently return less than it was asked for.
    const seen = new Set();
    const distinct = rows.filter((row) => {
        const key = row.image || row.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    const duplicates = rows.length - distinct.length;

    let kept = 0, dropped = 0, flagged = 0;
    for (const row of distinct.slice(0, limit)) {
        // THE PRESENTER'S OWN CHECK, not a copy of it. A candidate that
        // the Chamber would refuse to show has no business being pinned.
        const probe = {
            name: row.title,
            data: {
                title: row.title, artist: row.artist, sourceName: row.sourceName,
                sourceUrl: row.sourceUrl, rights: row.rights,
                attribution: row.credit,
                ...(row.creditRequired ? { creditRequired: true } : {})
            }
        };
        const licence = licenceClassOf(probe);
        const label = normalizeArtworkLabel(probe);
        if (!artworkMayBeShown(label)) {
            dropped++;
            rejected.push({ id: row.id, why: 'no attributable credit', licence });
            continue;
        }
        if (row.thirdPartyRisk) { flagged++; }
        keptRows.push({
            ...row, licence,
            requiredCredit: label?.requiredText || '',
            // Carried so the contact sheet can SHOW which credits were
            // trimmed. A reviewer approving an elision needs to see that
            // one happened and what it set aside, or the roster ruling is
            // being applied behind their back.
            creditElided: Boolean(label?.creditElided),
            fullCredit: label?.creditElided ? label.fullCredit : ''
        });
        kept++;
    }

    // A CANDIDATE THAT WILL NOT RESOLVE IS ABSENT. The imagery's own law,
    // applied one stage earlier than usual: rather than let a reader meet
    // a broken frame, the work never reaches the contact sheet. The
    // Smithsonian API advertises media its delivery service does not
    // serve — 6 of 20 Smithsonian Gardens items 404 while NMNH and Cooper
    // Hewitt are clean — so a media manifest is a CLAIM, not a guarantee,
    // and the only way to tell the difference is to ask.
    let unreachable = 0;
    if (verify) {
        await verifyAll(keptRows);
        const dead = keptRows.filter(r => !r.delivery?.ok);
        unreachable = dead.length;
        for (const r of dead) rejected.push({ id: r.id, why: `unreachable: ${r.delivery?.why}` });
    }
    const live = verify ? keptRows.filter(r => r.delivery?.ok) : keptRows;
    works.push(...live);

    const unseen = distinct.length - Math.min(distinct.length, limit);
    report.push({ source: name, fetched: rows.length, duplicates,
        considered: kept, dropped, flagged, notShown: unseen,
        ...(verify ? { unreachable, kept: live.length } : { kept }) });
    // NAME THE TRUNCATION. The report said "fetched 100 … kept 60" and
    // read as a yield when it was a CUT: `--limit` had left 40 works
    // unseen, and the reviewer approved a collection "in full" having
    // been shown three fifths of it. A number that means "all of it" and
    // a number that means "as many as you asked for" cannot share a
    // column without eventually being read as the wrong one.
    console.log(`${name.padEnd(13)} fetched ${String(rows.length).padStart(4)}`
        + `  dup ${String(duplicates).padStart(3)}`
        + `  uncreditable ${String(dropped).padStart(3)}`
        + `  unreachable ${String(unreachable).padStart(3)}`
        + `  third-party-flagged ${flagged}`
        + `  → kept ${String(live.length).padStart(4)}`
        + (unseen ? `  ⚠ ${unseen} NOT SHOWN (--limit ${limit})` : ''));

    // Name the failures. A count alone would let a systematic problem —
    // one collection's media links rotted through — read as attrition.
    if (verify && unreachable) {
        const why = {};
        for (const r of keptRows) {
            if (r.delivery?.ok) continue;
            const at = `${r.delivery?.why} · ${r.sourceName}`;
            why[at] = (why[at] || 0) + 1;
        }
        for (const [reason, n] of Object.entries(why)) console.log(`              ! ${n} × ${reason}`);
    }
}

const byLicence = {};
for (const w of works) byLicence[w.licence] = (byLicence[w.licence] || 0) + 1;

const path = resolve(out);
writeFileSync(path, JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    status: 'CANDIDATES — not shelved. Contact-sheet review required before pinning.',
    report,
    licences: byLicence,
    rejected,
    works
}, null, 2), 'utf8');

console.log('');
console.log(`candidates : ${works.length}`);
console.log(`by licence : ${JSON.stringify(byLicence)}`);
// Two rejections that must not read as one. "Could not be credited" is a
// RIGHTS finding about the record; "unreachable" is a DELIVERY finding
// about the file. Reporting a single total would let a rotted collection
// masquerade as a licensing problem, and they call for opposite fixes.
const uncreditable = rejected.filter(r => !r.why.startsWith('unreachable')).length;
console.log(`rejected   : ${uncreditable} could not be credited`
    + `, ${rejected.length - uncreditable} unreachable`);
console.log(`wrote ${path}`);
console.log('');
console.log('CANDIDATES ONLY. Nothing here is on a shelf until it has been');
console.log('contact-sheet reviewed and pinned — the discipline museum-pins.js');
console.log('records for every earlier harvest.');
