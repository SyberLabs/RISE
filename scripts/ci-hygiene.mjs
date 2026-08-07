/**
 * Properties of the committed artifacts, checked where a unit test cannot
 * reach them.
 *
 * The unit suite tests the classifier. This tests the CATALOGUES — the
 * generated JSON that ships in the bundle — because a rights guarantee
 * that holds in `artwork-label.js` and fails in the file it reads is a
 * guarantee about nothing. Each check below is a promise made in
 * ASSET-LICENSES.md or in the harvester, restated as an assertion.
 *
 *   node scripts/ci-hygiene.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const failures = [];
const fail = (check, detail) => failures.push({ check, detail });
const read = (p) => readFileSync(p, 'utf8');
const json = (p) => JSON.parse(read(p));

/** Every file under a root, filtered by extension. */
function walk(dir, exts, out = []) {
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, exts, out);
        else if (exts.some(e => entry.endsWith(e))) out.push(full);
    }
    return out;
}

// ── 1. No secret may travel in a delivery URL ────────────────────────
//
// The harvester refuses a candidate whose delivery URL carries a
// credential, because a pinned URL is committed to the repository and
// served to every reader. This is the same rule applied to what actually
// landed, since the rule is only worth as much as the artifact obeying it.
const CARRIES_SECRET = /[?&](api_?key|access_?token|token|signature|sig|auth)=/i;

const CATALOGUES = [
    'src/sources/visual/science-catalog.generated.json',
    'src/sources/visual/audubon-catalog.generated.json'
];

for (const path of CATALOGUES) {
    const doc = json(path);
    for (const work of doc.works || []) {
        for (const field of ['image', 'thumb', 'sourceUrl']) {
            const url = work[field];
            if (url && CARRIES_SECRET.test(url)) {
                fail('secret in delivery URL', `${path} · ${work.id} · ${field}`);
            }
        }
    }
}

// ── 2. A key must never be inlined into the client bundle ────────────
//
// Vite substitutes anything named VITE_* into the shipped JavaScript. The
// Smithsonian API key stayed on the workstation for exactly this reason;
// the way that decision gets quietly undone is someone reaching for
// `import.meta.env.VITE_SOMETHING_KEY` because it was the convenient
// place to put it.
const SECRETISH_VITE = /import\.meta\.env\.VITE_[A-Z0-9_]*(KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*/;

for (const file of walk('src', ['.js'])) {
    const match = read(file).match(SECRETISH_VITE);
    if (match) fail('secret-shaped VITE_ variable reaches the client bundle', `${file} · ${match[0]}`);
}

// ── 3. Every work owing a credit has one ─────────────────────────────
//
// ASSET-LICENSES.md §6: "Every one of the 152 CC BY works carries a
// composed credit naming both the creator and the licence." That sentence
// is a claim about the catalogue, not about the code that reads it.
const OWES_CREDIT = new Set(['cc-by', 'cc-by-sa', 'public-domain-credit', 'permission']);

for (const path of CATALOGUES) {
    const doc = json(path);
    for (const work of doc.works || []) {
        if (!OWES_CREDIT.has(work.licence)) continue;
        if (!String(work.requiredCredit || '').trim()) {
            fail('work owes a credit and has none', `${path} · ${work.id} · ${work.licence}`);
        }
        // The elision is lawful under CC BY 4.0 §3(a)(3) only because the
        // full text is retained. If it was shortened, the long form has
        // to actually be there and actually be longer.
        if (work.creditElided) {
            const full = String(work.fullCredit || '');
            if (full.length <= String(work.requiredCredit || '').length) {
                fail('credit marked elided but no fuller text is held',
                    `${path} · ${work.id} · full ${full.length} ≤ shown ${String(work.requiredCredit).length}`);
            }
        }
    }
}

// ── 4. No catalogue may declare rights the classifier cannot read ────
//
// `LICENCE.UNKNOWN_DECLARED` withholds a work whose rights string this
// project has no pattern for. That is the correct behaviour and a silent
// way to empty a shelf: the work vanishes from the reading surface with
// its rights perfectly in order. Better to fail here, loudly, at the one
// moment somebody can still fix the vocabulary.
const { licenceClassOf, LICENCE } = await import('../src/visuals/artwork-label.js');

for (const path of CATALOGUES) {
    const doc = json(path);
    for (const work of doc.works || []) {
        const cls = licenceClassOf({ metadata: { rights: work.rights, license: work.licence } });
        if (cls === LICENCE.UNKNOWN_DECLARED) {
            fail('rights string the classifier does not recognise',
                `${path} · ${work.id} · ${JSON.stringify(String(work.rights).slice(0, 60))}`);
        }
    }
}

// ── 5. Every icon the page promises actually ships ───────────────────
//
// A missing favicon is invisible: no error, no broken image, just the
// browser's blank default and a 404 nobody opens devtools to see. The
// paths live in two files that are edited at different times, which is
// the only reason this can go wrong.
const indexHtml = read('index.html');
const manifestPath = 'public/site.webmanifest';
const manifest = json(manifestPath);

const referencedIcons = new Set([
    ...[...indexHtml.matchAll(/<link[^>]+rel="(?:icon|apple-touch-icon|manifest)"[^>]*href="([^"]+)"/g)]
        .map(match => match[1]),
    ...(manifest.icons || []).map(icon => icon.src)
]);

for (const href of referencedIcons) {
    if (!href.startsWith('/')) continue;          // external or data: — not ours to ship
    const onDisk = join('public', href.slice(1));
    try {
        statSync(onDisk);
    } catch {
        fail('page references an icon that does not ship', `${href} → ${onDisk} missing`);
    }
}

// ── 6. The manifest's colours are the page's colour ──────────────────
//
// favicon.io ships `#ffffff` for both. On a product whose first paint is
// #0A0A0C that is a white flash on every standalone launch — and the two
// values live in two files, so nothing but this notices when one moves.
const themeColor = indexHtml.match(/<meta\s+name="theme-color"\s+content="([^"]+)"/i)?.[1];
if (!themeColor) {
    fail('index.html declares no theme-color', 'the manifest has nothing to agree with');
} else {
    for (const key of ['theme_color', 'background_color']) {
        if (String(manifest[key] || '').toLowerCase() !== themeColor.toLowerCase()) {
            fail('manifest colour disagrees with the page',
                `${manifestPath} ${key}=${manifest[key]} vs index.html theme-color=${themeColor}`);
        }
    }
}

if (!String(manifest.name || '').trim() || !String(manifest.short_name || '').trim()) {
    fail('manifest ships without a name', `${manifestPath} — favicon.io leaves these empty`);
}

// ── Report ───────────────────────────────────────────────────────────
const CHECKS = 6;
if (failures.length) {
    console.error(`\n✗ ${failures.length} hygiene failure(s):\n`);
    for (const { check, detail } of failures) console.error(`  ${check}\n      ${detail}`);
    console.error('');
    process.exit(1);
}

const counted = CATALOGUES.reduce((n, p) => n + (json(p).works || []).length, 0);
console.log(`✓ ${CHECKS} checks clean across ${counted} catalogued works`);
