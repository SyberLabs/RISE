/**
 * Properties of the committed artifacts, checked where a unit test cannot
 * reach them.
 *
 * The unit suite tests the classifier; this tests the catalogues (generated
 * JSON in the bundle). Each check restates a promise from ASSET-LICENSES.md
 * or the harvester as an assertion.
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
// Same rule as the harvester: a pinned URL is committed and served to
// every reader, so credentials must not appear in what actually landed.
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
// Vite substitutes VITE_* into shipped JavaScript. Secret-shaped names
// must not appear as `import.meta.env.VITE_*KEY` (etc.) in src/.
const SECRETISH_VITE = /import\.meta\.env\.VITE_[A-Z0-9_]*(KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*/;

for (const file of walk('src', ['.js'])) {
    const match = read(file).match(SECRETISH_VITE);
    if (match) fail('secret-shaped VITE_ variable reaches the client bundle', `${file} · ${match[0]}`);
}

// ── 3. Every work owing a credit has one ─────────────────────────────
//
// ASSET-LICENSES.md §6: every CC BY (etc.) work carries a composed credit.
// That claim is about the catalogue, not the code that reads it.
const OWES_CREDIT = new Set(['cc-by', 'cc-by-sa', 'public-domain-credit', 'permission']);

for (const path of CATALOGUES) {
    const doc = json(path);
    for (const work of doc.works || []) {
        if (!OWES_CREDIT.has(work.licence)) continue;
        if (!String(work.requiredCredit || '').trim()) {
            fail('work owes a credit and has none', `${path} · ${work.id} · ${work.licence}`);
        }
        // Elision is lawful under CC BY 4.0 §3(a)(3) only if the full
        // text is retained and actually longer.
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
// `LICENCE.UNKNOWN_DECLARED` withholds unrecognized rights strings. Fail
// here so an unknown vocabulary is fixed rather than silently emptying
// a shelf.
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
// Paths live in index.html and the manifest; a missing file is a quiet
// 404 with the browser default icon.
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
// theme_color / background_color must match index.html theme-color so
// standalone launch does not flash a mismatched chrome colour.
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

// ── 7. The share card is absolute, and it ships ──────────────────────
//
// og:image must be an absolute URL for crawler/preview compatibility;
// a relative path is not portable across share scrapers.
const ogImage = indexHtml.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1];
if (!ogImage) {
    fail('no og:image', 'a shared link would show a bare title-and-description row');
} else if (!/^https?:\/\//i.test(ogImage)) {
    fail('og:image is not absolute', `${ogImage} — needs an absolute URL for preview compatibility`);
} else {
    const onDisk = join('public', new URL(ogImage).pathname.slice(1));
    try {
        statSync(onDisk);
    } catch {
        fail('og:image does not ship', `${ogImage} → ${onDisk} missing`);
    }
}

// ── 8. No retired name in reader-facing metadata ─────────────────────
//
// Scans only index.html, the webmanifest, README.md, and NOTICE — the
// files a stranger may see. Docs/specs may keep historical names.
const RETIRED_VOCABULARY = [
    /Recursive Installation/i,
    /consciousness-first/i,
    /content delivery system/i,
    /\bR\.I\.S\.E\.?\b/,
    /Symbolic Reading Environment/i
];
const GREETS_A_STRANGER = ['index.html', 'public/site.webmanifest', 'README.md', 'NOTICE'];

for (const file of GREETS_A_STRANGER) {
    let text;
    try { text = read(file); } catch { continue; }
    for (const pattern of RETIRED_VOCABULARY) {
        const hit = text.match(pattern);
        if (hit) fail('retired name in reader-facing metadata', `${file} — ${JSON.stringify(hit[0])}`);
    }
}

// ── Report ───────────────────────────────────────────────────────────
const CHECKS = 8;
if (failures.length) {
    console.error(`\n✗ ${failures.length} hygiene failure(s):\n`);
    for (const { check, detail } of failures) console.error(`  ${check}\n      ${detail}`);
    console.error('');
    process.exit(1);
}

const counted = CATALOGUES.reduce((n, p) => n + (json(p).works || []).length, 0);
console.log(`✓ ${CHECKS} checks clean across ${counted} catalogued works`);
