#!/usr/bin/env node

/**
 * Bring the typefaces in-house.
 *
 * RISE used to load its fonts from `fonts.googleapis.com`, which meant every
 * reader's browser announced itself to Google — IP address and user-agent —
 * before the first character of a public-domain text appeared. The request sat
 * in the critical path, because the `@import` was in the stylesheet
 * `index.html` loads. A reader who came here to read Marcus Aurelius should
 * not have to tell a third party about it.
 *
 * So the files are fetched once, committed, and served from our own origin.
 * That deletes the transfer, removes a render-blocking third-party connection,
 * and lets the fonts ride the same immutable cache headers as everything else
 * under /assets.
 *
 * ONLY THE LATIN SUBSETS. Google splits each family by `unicode-range` — 21
 * files for Inter alone, most of them Cyrillic, Greek and Vietnamese that this
 * interface never sets. Taking latin and latin-ext is 12 files against 53.
 *
 * NOTO SERIF JP IS NOT HERE, DELIBERATELY. Google serves it as 248 files, and
 * it existed for one optional stream face. Mirroring a quarter of a thousand
 * files into the repository to letter a typeface picker is the wrong trade, so
 * the Japanese face falls back to the system stack the tokens already declare
 * (Hiragino Mincho ProN, Yu Mincho, Noto Serif CJK) — every desktop and mobile
 * OS ships a CJK serif.
 *
 * All six families are SIL Open Font License 1.1, which permits this. The
 * licence obligation travels in ASSET-LICENSES.md.
 *
 *   node scripts/build-fonts.mjs           fetch, write files and CSS
 *   node scripts/build-fonts.mjs --check   verify what is committed is current
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'fonts');
const CSS_OUT = join(ROOT, 'src', 'fonts.css');
/* The same faces, linkable by a standalone page in public/ that is not
   part of the bundle. Generated so no static page hardcodes a hash. */
const PUBLIC_CSS_OUT = join(OUT_DIR, 'fonts.css');

/**
 * A browser user-agent is required: Google serves TTF to anything it does not
 * recognise, and woff2 is roughly half the bytes.
 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** The families the interface actually sets, and the weights it actually uses. */
const FAMILIES = [
    { name: 'Inter', spec: 'Inter:wght@300;400;500' },
    { name: 'Space Grotesk', spec: 'Space+Grotesk:wght@300;500;700' },
    { name: 'Crimson Pro', spec: 'Crimson+Pro:ital,wght@0,400;0,600;1,400' },
    { name: 'Marcellus', spec: 'Marcellus' },
    { name: 'JetBrains Mono', spec: 'JetBrains+Mono:wght@400;500' }
];

/**
 * The scripts this interface sets. `latin` carries English; `latin-ext` carries
 * the accented characters that appear in author names and in translations.
 */
const WANTED_RANGES = [
    'U+0000-00FF', // latin
    'U+0100-02BA'  // latin-ext (matched on its opening range)
];

async function fetchText(url) {
    const response = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
    return response.text();
}

async function fetchBinary(url) {
    const response = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
    return Buffer.from(await response.arrayBuffer());
}

/** One `@font-face` block as Google wrote it, before the URL is rehomed. */
function parseFaces(css) {
    return [...css.matchAll(/@font-face\s*\{([^}]*)\}/gu)].map(([, body]) => {
        const field = (name) => (body.match(new RegExp(`${name}:\\s*([^;]+);`, 'u')) || [])[1]?.trim();
        return {
            family: (field('font-family') || '').replace(/['"]/gu, ''),
            style: field('font-style') || 'normal',
            weight: field('font-weight') || '400',
            display: field('font-display') || 'swap',
            unicodeRange: field('unicode-range') || '',
            url: (body.match(/url\((https:[^)]+\.woff2)\)/u) || [])[1]
        };
    }).filter(face => face.url);
}

function wanted(face) {
    return WANTED_RANGES.some(range => face.unicodeRange.includes(range));
}

/**
 * Content-addressed, and the address is the point: Google serves these as
 * VARIABLE fonts, so one file answers for every weight of a family. Naming by
 * weight wrote identical bytes three times over — Inter 300, 400 and 500 are
 * one file. Hashing the bytes makes the duplicates collapse on their own.
 */
function fileNameFor(face, bytes) {
    const slug = face.family.toLowerCase().replace(/[^a-z0-9]+/gu, '-');
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
    return `${slug}-${face.style}-${hash}.woff2`;
}

function cssFor(faces) {
    const blocks = faces.map(face => `@font-face {
  font-family: '${face.family}';
  font-style: ${face.style};
  font-weight: ${face.weight};
  font-display: swap;
  src: url('/fonts/${face.file}') format('woff2');
  unicode-range: ${face.unicodeRange};
}`).join('\n\n');

    return `/* Generated by scripts/build-fonts.mjs — do not edit.
 *
 * Self-hosted so no reader's browser has to announce itself to a font CDN
 * before a page of public-domain text will render. All faces are SIL Open
 * Font License 1.1; see ASSET-LICENSES.md.
 *
 * Regenerate with: npm run build:fonts
 */

${blocks}
`;
}

async function collect() {
    const faces = [];
    for (const family of FAMILIES) {
        const css = await fetchText(
            `https://fonts.googleapis.com/css2?family=${family.spec}&display=swap`
        );
        const chosen = parseFaces(css).filter(wanted);
        if (!chosen.length) throw new Error(`No latin faces resolved for ${family.name}`);
        for (const face of chosen) {
            const bytes = await fetchBinary(face.url);
            faces.push({ ...face, bytes, file: fileNameFor(face, bytes) });
        }
        process.stderr.write(`  ${family.name}: ${chosen.length} faces\n`);
    }
    return faces;
}

const check = process.argv.includes('--check');
process.stderr.write(check ? 'Verifying committed fonts…\n' : 'Fetching fonts…\n');

const faces = await collect();
const css = cssFor(faces);
const expected = new Set(faces.map(face => face.file));

/**
 * Line endings are git's business, not the generator's. This repository is
 * checked out with `core.autocrlf`, so a committed LF file is CRLF on disk
 * here — comparing raw bytes failed on the line terminators while every
 * declaration was identical.
 */
const sameContent = (path, expected) => existsSync(path)
    && readFileSync(path, 'utf8').replace(/\r\n?/gu, '\n') === expected.replace(/\r\n?/gu, '\n');

if (check) {
    const problems = [];
    if (!sameContent(CSS_OUT, css)) {
        problems.push('src/fonts.css is not what the upstream faces produce');
    }
    if (!sameContent(PUBLIC_CSS_OUT, css)) {
        problems.push('public/fonts/fonts.css is not what the upstream faces produce');
    }
    const present = existsSync(OUT_DIR) ? new Set(readdirSync(OUT_DIR)) : new Set();
    for (const file of expected) {
        if (!present.has(file)) problems.push(`missing public/fonts/${file}`);
    }
    for (const file of present) {
        if (file.endsWith('.woff2') && !expected.has(file)) {
            problems.push(`stale public/fonts/${file}`);
        }
    }
    if (problems.length) {
        process.stderr.write(`\n✗ ${problems.join('\n✗ ')}\n\nRun: npm run build:fonts\n`);
        process.exit(1);
    }
    process.stderr.write(`✓ ${expected.size} font files match upstream\n`);
    process.exit(0);
}

if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

let total = 0;
const written = new Set();
for (const face of faces) {
    if (written.has(face.file)) continue;
    written.add(face.file);
    writeFileSync(join(OUT_DIR, face.file), face.bytes);
    total += face.bytes.length;
}
writeFileSync(CSS_OUT, css);
writeFileSync(PUBLIC_CSS_OUT, css);

process.stderr.write(
    `✓ ${faces.length} faces over ${written.size} files, `
    + `${Math.round(total / 1024)} KB → public/fonts/\n`
    + '✓ src/fonts.css written\n'
);
