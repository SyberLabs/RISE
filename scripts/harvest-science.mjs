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
 * RIGHTS ARE READ, NEVER ASSUMED — and read with the SAME vocabulary the
 * presenter uses. `licenceClassOf` and `artworkMayBeShown` are imported
 * from the label boundary rather than reimplemented here, because a
 * harvester that decides rights differently from the surface that shows
 * them is this codebase's oldest failure wearing a new hat: it would
 * admit works the Chamber then refuses, or worse, the reverse.
 *
 * Every candidate is therefore run through the exact check a figure
 * faces at render time, and one that cannot be credited is dropped here
 * rather than discovered later.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { licenceClassOf, artworkMayBeShown, normalizeArtworkLabel, LICENCE }
    from '../src/visuals/artwork-label.js';

const args = process.argv.slice(2);
const flag = (n, d = null) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const only = flag('source');
const limit = Number(flag('limit', '60'));
const out = flag('out', 'science-catalog.candidates.json');
const verify = !args.includes('--no-verify');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * One request, paced and honest about being throttled.
 *
 * `DEMO_KEY` is rate-limited hard on api.data.gov — a handful of probes
 * exhausted it and every later call returned 429. It is enough to prove
 * an endpoint answers and NOT enough to harvest with; a free key from
 * api.data.gov is the difference. That distinction is worth surfacing
 * rather than absorbing, because a silent 429 looks exactly like an
 * empty collection, and "the source has nothing" and "we were throttled"
 * are opposite facts.
 */
const get = async (url, label, { retries = 2 } = {}) => {
    for (let attempt = 0; ; attempt++) {
        const res = await fetch(url, { headers: { 'User-Agent': 'RISE/harvest (curation)' } });
        if (res.ok) return res.json();
        if (res.status === 429 && attempt < retries) { await sleep(2000 * (attempt + 1)); continue; }
        const err = new Error(`${label}: HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
};

/**
 * THE NO-SECRET DESIGN RESTS ON THIS, so it is verified rather than assumed.
 *
 * Nothing on Netlify holds an API key. The harvest runs here on a
 * workstation, the reviewed pins are committed, and the deployed reader
 * fetches the image directly — `img-src ... https:` in netlify.toml
 * already permits any image host, while `connect-src` does NOT list
 * api.si.edu, so the browser could not reach the search API even if
 * something asked it to. That whole arrangement holds only if the
 * delivery URL is publicly fetchable, and an unverified assumption there
 * would surface as a missing figure in production rather than as an
 * error at harvest time, which is the wrong end to find out.
 *
 * TWO things are checked, and the second matters more than it looks: the
 * URL answers WITHOUT credentials, and it does not CARRY any. A delivery
 * URL with the key in its query string would fetch perfectly well from
 * this machine and then commit the secret into a pin file — publishing
 * it exactly as a VITE_ variable would, just by a quieter route.
 */
const CARRIES_SECRET = /[?&](api_?key|access_?token|token|signature|sig|auth)=/i;

async function verifyDelivery(url, kind) {
    if (!url) return { ok: false, why: 'no delivery url' };
    if (CARRIES_SECRET.test(url)) return { ok: false, why: 'url carries a credential' };
    try {
        // A one-byte range: enough to learn the status and the type
        // without pulling a full plate from a museum for every candidate.
        const res = await fetch(url, {
            headers: { Range: 'bytes=0-0', 'User-Agent': 'RISE/harvest (curation)' },
            redirect: 'follow'
        });
        if (!res.ok && res.status !== 206) return { ok: false, why: `HTTP ${res.status}` };
        const type = (res.headers.get('content-type') || '').split(';')[0].trim();
        // Only a hop DECLARED to be a direct image must prove it is one.
        // ESA/ESO hops are listing pages and NASA's is an asset manifest;
        // holding those to image/* would fail them for being what they are.
        if (kind === 'image' && !/^image\//i.test(type)) {
            return { ok: false, why: `not an image (${type || 'no content-type'})` };
        }
        return { ok: true, type };
    } catch (err) {
        return { ok: false, why: err.message };
    }
}

/** Probe with a small concurrency; this is a by-hand script, not a service. */
async function verifyAll(rows, lanes = 4) {
    let next = 0;
    const worker = async () => {
        while (next < rows.length) {
            const row = rows[next++];
            row.delivery = await verifyDelivery(row.imageHop, row.deliveryKind);
        }
    };
    await Promise.all(Array.from({ length: Math.min(lanes, rows.length) }, worker));
}

/**
 * Djangoplicity serves Python bytes-repr in its JSON — `b'CC BY 4.0'`.
 * Recorded in SOURCE-EXPANSION-SPEC §2z so it is handled rather than
 * rediscovered.
 */
const unbytes = (value) => String(value ?? '')
    .replace(/^b'(.*)'$/s, '$1')
    .replace(/^b"(.*)"$/s, '$1')
    .replace(/\\'/g, "'")
    .trim();

// ── Sources ─────────────────────────────────────────────────────────

/**
 * ESA/Hubble and ESO — one adapter, because they run the same stack and
 * expose the same feed. CC BY 4.0 with a per-item `Credit` line: the
 * case the attribution machinery was built for.
 */
async function djangoplicity({ id, sourceName, feed, sourceBase }) {
    const rows = await get(feed, sourceName);
    const list = Array.isArray(rows) ? rows : (rows.collection || []);
    return list.map((row) => {
        const rights = unbytes(row.Rights);
        const credit = unbytes(row.Credit);
        const workId = unbytes(row.ID);
        return {
            id: `${id}:${workId}`,
            title: unbytes(row.Title),
            description: unbytes(row.Description).slice(0, 600),
            artist: unbytes(row.Creator),
            credit,
            date: unbytes(row.Date),
            rights,
            sourceName,
            sourceUrl: unbytes(row.ReferenceURL) || `${sourceBase}${workId}/`,
            kind: unbytes(row.Type),
            // The feed is a listing; the deliverable image is a second
            // hop, exactly as Rijks and NASA are. Recorded, not guessed.
            imageHop: `${sourceBase}${workId}/`,
            deliveryKind: 'page'
        };
    });
}

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
/**
 * ROUND-ROBIN, NOT CONCATENATION — and this is not a nicety.
 *
 * The caller cuts to `--limit`, and a cut applied to a concatenated list
 * hands the entire budget to whichever term ran first. The first harvest
 * proved it: `bird` came first, and 54 of 60 candidates were hummingbird
 * specimen trays from one NMNH division while `fossil` and `shell`
 * contributed nothing at all. The result looked like a full shelf and was
 * one query wearing six labels.
 *
 * This is the exact failure that made me judge 7,223 corpus findings from
 * four samples that all came from `a-doll-s-house` — `readdirSync` is
 * alphabetical, the bucket kept the first N, and the prefix was not the
 * population. Interleaving fixes it at the source: any prefix of a
 * round-robin list is balanced by construction, so the limit can be
 * applied anywhere downstream without needing to know how the list was
 * built.
 */
function interleave(groups) {
    const out = [];
    for (let i = 0; ; i++) {
        let placed = false;
        for (const group of groups) {
            if (i < group.length) { out.push(group[i]); placed = true; }
        }
        if (!placed) return out;
    }
}

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
                // IDS delivers the pixels directly, so this hop must
                // prove it is an image and that it needs no key.
                imageHop: media.content || media.thumbnail || '',
                deliveryKind: 'image',
                term });
        }
    }
    return out;
}

/**
 * NASA Image and Video Library.
 *
 * §2z: the API carries NO licence field at any depth, and NASA's own
 * policy requires acknowledgement — "NASA should be acknowledged as the
 * source of the material". So the rights basis is DECLARED here rather
 * than read, and that is stated in the record instead of being hidden in
 * a default: `rightsDeclaredBy: 'policy'` marks every NASA row as a
 * standing claim about the institution rather than a fact read off the
 * item, which is exactly the distinction a ledger has to preserve.
 *
 * The third-party fraction is not machine-detectable, so a prose scan is
 * the only available signal and anything it flags is withheld for review.
 */
const THIRD_PARTY = /copyright|©|\(c\)\s*\d{4}|all rights reserved|used with permission/i;

async function nasa({ query, rows }) {
    const url = `https://images-api.nasa.gov/search`
        + `?q=${encodeURIComponent(query)}&media_type=image&page_size=${rows}`;
    const body = await get(url, 'NASA');
    const out = [];
    for (const item of body.collection?.items || []) {
        const d = item.data?.[0] || {};
        const prose = [d.description, d.description_508, d.title].filter(Boolean).join(' ');
        // 27 of 100 items carry no secondary_creator (§2z), so the credit
        // falls back through what NASA's policy actually asks for.
        const credit = d.secondary_creator || d.photographer || d.center || 'NASA';
        out.push({
            id: `nasa:${d.nasa_id}`,
            title: d.title || '',
            description: (d.description || '').slice(0, 600),
            artist: d.photographer || '',
            credit,
            date: d.date_created || '',
            rights: 'Public domain (NASA) — acknowledgement required',
            rightsDeclaredBy: 'policy',
            creditRequired: true,
            thirdPartyRisk: THIRD_PARTY.test(prose),
            sourceName: 'NASA Image and Video Library',
            sourceUrl: `https://images.nasa.gov/details/${d.nasa_id}`,
            kind: 'Images',
            imageHop: `https://images-api.nasa.gov/asset/${d.nasa_id}`,
            deliveryKind: 'manifest'
        });
    }
    return out;
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
        const key = row.imageHop || row.id;
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
        keptRows.push({ ...row, licence, requiredCredit: label?.requiredText || '' });
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

    report.push({ source: name, fetched: rows.length, duplicates,
        considered: kept, dropped, flagged,
        ...(verify ? { unreachable, kept: live.length } : { kept }) });
    console.log(`${name.padEnd(13)} fetched ${String(rows.length).padStart(4)}`
        + `  dup ${String(duplicates).padStart(3)}`
        + `  uncreditable ${String(dropped).padStart(3)}`
        + `  unreachable ${String(unreachable).padStart(3)}`
        + `  third-party-flagged ${flagged}`
        + `  → kept ${String(live.length).padStart(4)}`);

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
