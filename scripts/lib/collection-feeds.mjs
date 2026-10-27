/**
 * The feed readers and the delivery probe shared by the collection harvests
 * (`harvest-science.mjs`, `harvest-landscape-candidates.mjs`). One author of
 * how a feed row becomes a candidate, so a credit is read the same way in
 * every harvest; the credit itself is composed by `artwork-label.js`.
 */

export const USER_AGENT = 'RISE/harvest (curation)';

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
export const getJson = async (url, label, { retries = 2, headers = {} } = {}) => {
    for (let attempt = 0; ; attempt++) {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, ...headers } });
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
 * fetches the image directly — `img-src` in netlify.toml names each
 * catalogue's image hosts (a new host is added there, and
 * src/core/csp-image-hosts.test.js holds the set), while `connect-src`
 * does NOT list api.si.edu, so the browser could not reach the search
 * API even if something asked it to. That whole arrangement holds only if the
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
export const CARRIES_SECRET = /[?&](api_?key|access_?token|token|signature|sig|auth)=/i;

export async function verifyDelivery(url) {
    if (!url) return { ok: false, why: 'no delivery url' };
    if (CARRIES_SECRET.test(url)) return { ok: false, why: 'url carries a credential' };
    try {
        // A one-byte range: enough to learn the status and the type
        // without pulling a full plate from a museum for every candidate.
        const res = await fetch(url, {
            headers: { Range: 'bytes=0-0', 'User-Agent': USER_AGENT },
            redirect: 'follow'
        });
        if (!res.ok && res.status !== 206) return { ok: false, why: `HTTP ${res.status}` };
        const type = (res.headers.get('content-type') || '').split(';')[0].trim();
        // Every source now yields a direct image, so every one must prove
        // it. An HTML error page returns 200 with text/html and would
        // otherwise pass as a working plate.
        if (!/^image\//i.test(type)) {
            return { ok: false, why: `not an image (${type || 'no content-type'})` };
        }
        return { ok: true, type };
    } catch (err) {
        return { ok: false, why: err.message };
    }
}

/** Probe with a small concurrency; this is a by-hand script, not a service. */
export async function verifyAll(rows, lanes = 4) {
    let next = 0;
    const worker = async () => {
        while (next < rows.length) {
            const row = rows[next++];
            row.delivery = await verifyDelivery(row.image);
        }
    };
    await Promise.all(Array.from({ length: Math.min(lanes, rows.length) }, worker));
}

/**
 * Djangoplicity serves Python bytes-repr in its JSON — `b'CC BY 4.0'`.
 * Recorded in SOURCE-EXPANSION-SPEC §2z so it is handled rather than
 * rediscovered.
 */
export const unbytes = (value) => {
    const raw = String(value ?? '').trim();
    const wrapped = /^b(['"])([\s\S]*)\1$/.exec(raw);
    if (!wrapped) return raw;
    const body = wrapped[2];

    // STRIPPING THE WRAPPER IS NOT DECODING THE CONTENTS. The first pass
    // did only the former, so an ESA/Hubble credit reached the sheet
    // reading "Carol Christian (STScI/AURA)\xc2\xa0and Selma de Mink" —
    // the escapes rendered literally, in a line we are legally obliged to
    // display. `\xNN` here are raw UTF-8 BYTES, not code points, so
    // \xe2\x80\x99 is one apostrophe and not three characters; they have
    // to be gathered into a byte stream and decoded together.
    const bytes = [];
    const encoder = new TextEncoder();
    for (let i = 0; i < body.length; i++) {
        if (body[i] !== '\\') {
            for (const b of encoder.encode(body[i])) bytes.push(b);
            continue;
        }
        const next = body[i + 1];
        if (next === 'x') {
            const code = Number.parseInt(body.slice(i + 2, i + 4), 16);
            if (Number.isFinite(code)) { bytes.push(code); i += 3; continue; }
        }
        const simple = { n: 10, r: 13, t: 9, '\\': 92, "'": 39, '"': 34 }[next];
        if (simple !== undefined) { bytes.push(simple); i += 1; continue; }
        bytes.push(92);
    }
    return new TextDecoder('utf-8').decode(Uint8Array.from(bytes)).trim();
};

/**
 * ESA/Hubble and ESO — one adapter, because they run the same stack and
 * expose the same feed. CC BY 4.0 with a per-item `Credit` line: the
 * case the attribution machinery was built for.
 */
/**
 * Pick a delivery image out of a djangoplicity `Resources` array.
 *
 * ENUMERATED, NOT GUESSED. Across 200 rows the types are exactly Small
 * (jpg, ~1280px, 100/100), Thumbnail (jpg, 220×140, 100/100), Large (jpg,
 * full resolution, 99/100), and Original — which is a **tif**, and in
 * three cases a psb of 108199×81503 pixels. `ResourceURL`, the obvious
 * top-level field, points at that Original: taking it would have pinned a
 * multi-gigapixel Photoshop file as a reading-surface image.
 *
 * Small is the display copy and Thumbnail is the contact sheet's.
 */
/**
 * AVM subject codes — the source's OWN taxonomy, read rather than inferred.
 *
 * Astronomy Visualization Metadata classifies by what is depicted, and the
 * top-level branch is the useful part: A solar system, B stars & nebulae,
 * C galaxies, D cosmology, E sky phenomena, F photographic/facilities.
 *
 * This earns its place because of what the ESO first pass measured. Of 60
 * reviewed works, every A and every E was cut — 20 of 25 rejections — and
 * they are exactly the observatory-landscape shots ("ALMA's world at
 * night", "Total solar eclipse, La Silla Observatory"). ESO files those
 * under sky phenomena, so the field a reviewer needs was in the feed the
 * whole time.
 *
 * It is carried to the CONTACT SHEET, not applied as a filter. A code that
 * predicted one reviewer's 25 cuts is a hint worth showing, not a rule
 * worth trusting — that distinction is the whole of curation-only.
 */
export const AVM_BRANCH = Object.freeze({
    A: 'Solar system', B: 'Stars & nebulae', C: 'Galaxies',
    D: 'Cosmology', E: 'Sky phenomena', F: 'Photographic / facilities'
});

export const avmSubject = (row) => {
    const raw = row['Subject.Category'];
    const codes = (Array.isArray(raw) ? raw : [raw]).map(unbytes).filter(Boolean);
    const branches = [...new Set(codes.map(c => c[0]))];
    return {
        codes,
        branches,
        label: branches.map(b => `${b} · ${AVM_BRANCH[b] || 'unclassified'}`).join(' | ')
    };
};

export const resourceOf = (row, ...types) => {
    for (const type of types) {
        const hit = (row.Resources || []).find(r =>
            r.ResourceType === type && r.MediaType === 'Image'
            && /\.jpe?g$/i.test(String(r.URL || '')));
        if (hit) return hit;
    }
    return null;
};

export const fromResources = (row, ...types) => {
    const hit = resourceOf(row, ...types);
    return hit ? String(hit.URL) : '';
};

/** One djangoplicity feed row as a candidate. */
export function djangoplicityRow(row, { id, sourceName, sourceBase }) {
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
        subject: avmSubject(row),
        image: fromResources(row, 'Small', 'Large'),
        thumb: fromResources(row, 'Thumbnail', 'Small'),
        page: unbytes(row.ReferenceURL) || `${sourceBase}${workId}/`
    };
}

export async function djangoplicity({ id, sourceName, feed, sourceBase }) {
    const rows = await getJson(feed, sourceName);
    const list = Array.isArray(rows) ? rows : (rows.collection || []);
    return list.map((row) => djangoplicityRow(row, { id, sourceName, sourceBase }));
}

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
export function interleave(groups) {
    const out = [];
    for (let i = 0; ; i++) {
        let placed = false;
        for (const group of groups) {
            if (i < group.length) { out.push(group[i]); placed = true; }
        }
        if (!placed) return out;
    }
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
export const THIRD_PARTY = /copyright|©|\(c\)\s*\d{4}|all rights reserved|used with permission/i;

/** One NASA search item as a candidate. */
export function nasaRow(item) {
    const d = item.data?.[0] || {};
    // Prefer jpgs from `item.links` (~thumb/~small/~medium/~orig);
    // no second hop to the asset manifest.
    const link = (suffix) => (item.links || [])
        .map(l => String(l.href || ''))
        .find(href => href.includes(suffix)) || '';
    const prose = [d.description, d.description_508, d.title].filter(Boolean).join(' ');
    // Credit must name NASA even when the record only names a centre.
    const source = d.secondary_creator || d.photographer || d.center || '';
    const credit = /\bNASA\b/i.test(source) ? source : (source ? `NASA/${source}` : 'NASA');
    return {
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
        image: link('~medium.jpg') || link('~small.jpg') || link('~orig.jpg'),
        thumb: link('~thumb.jpg') || link('~small.jpg'),
        page: `https://images.nasa.gov/details/${d.nasa_id}`
    };
}
