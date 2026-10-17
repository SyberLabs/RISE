/**
 * Acquire a Mystery School text into the School corpus.
 *
 *   node scripts/school-ingest.mjs --list
 *   node scripts/school-ingest.mjs <school-record-id> [--dry-run]
 *   node scripts/school-ingest.mjs --all [--dry-run]
 *
 * Each School record that the corpus serves has a recipe here: where its
 * edition lives and which of the edition's parts are its units. The script
 * reads those parts from the edition's own markup, refuses to write unless
 * every gate holds, writes `src/content/school/works/<id>.js`, and updates
 * that record's line in `src/content/school/corpus.js` in place.
 *
 * Gates, every work, every time: words in equal words out for the files
 * read; unit names unique and never a bare numeral or a slug; the recipe's
 * unit count when it states one; no distributor matter; every unit at least
 * MIN_CHARS long; a verse unit keeps at least the verse lines its markup
 * declared.
 *
 * Two kinds of source. A Standard Ebooks recipe names a `repo` and reads
 * the edition's spine and markup (src/content/archive/standard-ebooks.js).
 * A Project Gutenberg recipe names an `ebook` and reads its HTML edition
 * (src/content/school/gutenberg.js): `{ ebook, artifact: 'html', extract?,
 * units, ... }`, the units a list of exact headings or every heading of one
 * level. A record drawn from more than one edition lists them under
 * `artifacts`, in reading order, each with its own units.
 *
 * Fetched files are cached under .ingest-cache/standard-ebooks/<repo>/ and
 * .ingest-cache/gutenberg/<ebook>.html; a Gutenberg file's sha256 is
 * recorded in the work's source.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { DISTRIBUTOR_MATTER } from '../src/content/archive/divisions.js';
import {
    readContainerHeadings,
    readContainerName,
    readStandardEbooksElement,
    readStandardEbooksFile,
    reconcileWords,
    sectionsFromParts
} from '../src/content/archive/standard-ebooks.js';
import { SCHOOL_CANON } from '../src/content/school/canon.js';
import { readGutenberg } from '../src/content/school/gutenberg.js';

const ROOT = resolve(import.meta.dirname, '..');
const CACHE = resolve(ROOT, '.ingest-cache', 'standard-ebooks');
const GUTENBERG_CACHE = resolve(ROOT, '.ingest-cache', 'gutenberg');
const OUT = resolve(ROOT, 'src/content/school/works');
const CORPUS = resolve(ROOT, 'src/content/school/corpus.js');
const RAW = 'https://raw.githubusercontent.com/standardebooks';
const MIN_CHARS = 200;
const FOOTNOTE_MARKER = /\[(?:FN#?)?\d{1,4}\]/u;
const LEFTOVER = /produced by|transcriber['’]s note/iu;

/**
 * `units: 'spine'` takes every bodymatter file in the edition's reading
 * order, plus the front or back matter `include` names, less the files
 * `exclude` names, as the importer divides them; `rename` replaces a name
 * the importer composed where it dropped a word the heading printed;
 * `perFile` makes each file one unit. A list takes exactly the units it
 * names: `{ file, id?, name?, verse? }` is one unit, the element `id` names
 * in `file` (else the file's outermost section or article), under `name`
 * (else its own heading).
 */
const RECIPES = Object.freeze({
    'sun.zarathustra': {
        repo: 'friedrich-nietzsche_thus-spake-zarathustra_thomas-common',
        units: 'spine',
        count: 81,
        edition: { statement: 'Thomas Common, 1909, via Standard Ebooks', translator: 'Thomas Common', year: 1909 },
        rights: { us: 'pd', life70: 'pd' }
    },
    'sun.symposium-phaedrus-timaeus': {
        repo: 'plato_dialogues_benjamin-jowett',
        units: [
            { file: 'symposium.xhtml', id: 'symposium-introduction', name: 'Symposium: Introduction' },
            { file: 'symposium.xhtml', id: 'symposium-text', name: 'Symposium' },
            { file: 'phaedrus.xhtml', id: 'phaedrus-introduction', name: 'Phaedrus: Introduction' },
            { file: 'phaedrus.xhtml', id: 'phaedrus-text', name: 'Phaedrus' },
            { file: 'timaeus.xhtml', id: 'timaeus-introduction', name: 'Timaeus: Introduction and Analysis' },
            { file: 'timaeus.xhtml', id: 'timaeus-text', name: 'Timaeus' }
        ],
        count: 6,
        edition: {
            statement: 'Benjamin Jowett, third edition, 1892, via Standard Ebooks; three dialogues with Jowett’s introductions',
            translator: 'Benjamin Jowett',
            year: 1892
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'moon.varieties': {
        repo: 'william-james_the-varieties-of-religious-experience',
        units: 'spine',
        include: ['afterword.xhtml'],
        rename: {
            'Lectures IV V: The Religion of Healthy-Mindedness': 'Lectures IV and V: The Religion of Healthy-Mindedness',
            'Lectures VI VII: The Sick Soul': 'Lectures VI and VII: The Sick Soul',
            'Lectures XI XII XIII: Saintliness': 'Lectures XI, XII and XIII: Saintliness',
            'Lectures XIV XV: The Value of Saintliness': 'Lectures XIV and XV: The Value of Saintliness',
            'Lectures XVI XVII: Mysticism': 'Lectures XVI and XVII: Mysticism'
        },
        count: 15,
        edition: { statement: 'Longmans, Green, 1902, via Standard Ebooks', translator: null, year: 1902 },
        rights: { us: 'pd', life70: 'pd' }
    },
    // The essay "Darwin among the Machines" (1863) joins this record as a
    // further unit when the Gutenberg adapter lands.
    'mercury.book-of-the-machines': {
        repo: 'samuel-butler_erewhon',
        units: [
            { file: 'chapter-23.xhtml', name: 'The Book of the Machines I' },
            { file: 'chapter-24.xhtml', name: 'The Book of the Machines II' },
            { file: 'chapter-25.xhtml', name: 'The Book of the Machines III' }
        ],
        count: 3,
        edition: {
            statement: 'Erewhon, revised edition, 1901, chapters XXIII to XXV, via Standard Ebooks',
            translator: null,
            year: 1901
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'mercury.machine-stops': {
        repo: 'e-m-forster_short-fiction',
        units: [
            { file: 'the-machine-stops.xhtml', id: 'the-machine-stops-1' },
            { file: 'the-machine-stops.xhtml', id: 'the-machine-stops-2' },
            { file: 'the-machine-stops.xhtml', id: 'the-machine-stops-3' }
        ],
        count: 3,
        edition: { statement: 'The Oxford and Cambridge Review, 1909, via Standard Ebooks', translator: null, year: 1909 },
        rights: { us: 'pd', life70: 'until:2041' }
    },
    'mercury.rur': {
        repo: 'karel-capek_r-u-r_paul-selver_nigel-playfair',
        units: 'spine',
        count: 4,
        edition: {
            statement: 'Paul Selver and Nigel Playfair, 1923, a slightly abridged acting version, via Standard Ebooks',
            translator: 'Paul Selver and Nigel Playfair',
            year: 1923
        },
        rights: { us: 'pd', life70: 'until:2041' }
    },
    'mars.the-prince': {
        repo: 'niccolo-machiavelli_the-prince_w-k-marriott',
        units: 'spine',
        include: ['dedication.xhtml'],
        count: 27,
        edition: { statement: 'W. K. Marriott, 1908, via Standard Ebooks', translator: 'W. K. Marriott', year: 1908 },
        rights: { us: 'pd', life70: 'pd' }
    },
    'mars.peloponnesian-war': {
        repo: 'thucydides_history-of-the-peloponnesian-war_richard-crawley',
        units: 'spine',
        // The battle plans are maps; their captions are not the History.
        exclude: ['plans.xhtml'],
        count: 26,
        edition: { statement: 'Richard Crawley, 1874, via Standard Ebooks', translator: 'Richard Crawley', year: 1874 },
        rights: { us: 'pd', life70: 'pd' }
    },
    'jupiter.flatland': {
        repo: 'edwin-a-abbott_flatland',
        units: 'spine',
        count: 22,
        edition: { statement: 'Second and revised edition, 1884, via Standard Ebooks', translator: null, year: 1884 },
        rights: { us: 'pd', life70: 'pd' }
    },
    'venus.leaves-of-grass': {
        repo: 'walt-whitman_leaves-of-grass',
        units: 'spine',
        perFile: true,
        count: 36,
        edition: { statement: 'The 1891–92 “deathbed” edition, via Standard Ebooks', translator: null, year: 1892 },
        rights: { us: 'pd', life70: 'pd' }
    }
});

const parse = markup => new JSDOM(markup, { contentType: 'text/html' }).window.document;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const words = text => String(text).replace(/\s+/gu, ' ').trim().split(' ').filter(Boolean).length;
const constName = id => id.toUpperCase().replace(/[^A-Z0-9]+/gu, '_');

async function fetchFile(repo, path) {
    const dir = resolve(CACHE, repo);
    mkdirSync(dir, { recursive: true });
    const cached = resolve(dir, path.replace(/\//gu, '__'));
    if (existsSync(cached)) return readFileSync(cached, 'utf8');
    const url = `${RAW}/${repo}/master/src/epub/${path}`;
    process.stderr.write(`fetching ${url}\n`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${repo}/${path}: HTTP ${response.status}`);
    const text = await response.text();
    writeFileSync(cached, text);
    return text;
}

/** A Gutenberg HTML edition, from the cache or from gutenberg.org, with its sha256. */
async function fetchGutenberg(ebook) {
    mkdirSync(GUTENBERG_CACHE, { recursive: true });
    const cached = resolve(GUTENBERG_CACHE, `${ebook}.html`);
    if (!existsSync(cached)) {
        let response = null;
        for (const file of [`pg${ebook}-images.html`, `pg${ebook}.html`]) {
            const url = `https://www.gutenberg.org/cache/epub/${ebook}/${file}`;
            process.stderr.write(`fetching ${url}
`);
            response = await fetch(url);
            if (response.ok) break;
        }
        if (!response.ok) throw new Error(`Gutenberg ${ebook}: HTTP ${response.status}`);
        writeFileSync(cached, Buffer.from(await response.arrayBuffer()));
    }
    const bytes = readFileSync(cached);
    return { html: bytes.toString('utf8'), sha256: sha256(bytes) };
}

/** The edition's reading order, and its page on standardebooks.org. */
async function readOpf(repo) {
    const opf = await fetchFile(repo, 'content.opf');
    const spine = /<spine>([\s\S]*?)<\/spine>/u.exec(opf);
    if (!spine) throw new Error(`${repo}: no spine in content.opf`);
    const files = [...spine[1].matchAll(/idref="([^"]+)"/gu)].map(match => match[1]);
    const url = /<dc:identifier id="uid">(https:\/\/standardebooks\.org\/ebooks\/[^<]+)<\/dc:identifier>/u.exec(opf)?.[1];
    if (!files.length || !url) throw new Error(`${repo}: content.opf names no spine or no URL`);
    return { files, url };
}

function isBodyMatter(xhtml) {
    const body = /<body[^>]*epub:type="([^"]*)"/u.exec(xhtml);
    return Boolean(body) && body[1].split(/\s+/u).includes('bodymatter');
}

/**
 * A file's parts as one unit named by the file's heading: a nested part
 * opens on its own title, as the book prints it.
 */
function wholeFile(fileParts, headings) {
    const outer = fileParts.find(part => !part.composed);
    const total = fileParts.reduce((sum, part) => sum + words(part.content), 0);
    const verseWords = fileParts.reduce((sum, part) => sum + (part.verse ? words(part.content) : 0), 0);
    return {
        name: headings[0] || outer?.title || fileParts[0].title,
        content: fileParts.map(part => (part.composed ? `${part.title}\n\n${part.content}` : part.content)).join('\n\n'),
        verse: verseWords / total > 0.5,
        lines: fileParts.reduce((sum, part) => sum + part.lines, 0),
        composed: false
    };
}

/**
 * Every bodymatter file, in spine order, read as the Archive's importer reads
 * it (scripts/attic/standard-ebooks-ingest.mjs): a file that only names a
 * group prefixes the readings after it, and a file whose part the selector
 * does not name is read whole.
 */
async function spineUnits(recipe, files, ledger) {
    const include = new Set(recipe.include || []);
    const parts = [];
    const scope = [];
    let carried = null;
    for (const file of files) {
        const xhtml = await fetchFile(recipe.repo, `text/${file}`);
        if ((!isBodyMatter(xhtml) && !include.has(file)) || recipe.exclude?.includes(file)) continue;
        include.delete(file);
        ledger.files.push(`${file} ${sha256(xhtml)}`);
        const container = readContainerName(xhtml, parse);
        if (container) {
            ledger.count(file, reconcileWords(xhtml, [], parse, [container.name]));
            ledger.groups.push(container.name);
            while (scope.length && scope[scope.length - 1].rank >= container.rank) scope.pop();
            scope.push(container);
            continue;
        }
        let fileParts = readStandardEbooksFile(xhtml, parse);
        let inFile = readContainerHeadings(xhtml, parse);
        if (!fileParts.length) {
            const whole = readStandardEbooksElement(xhtml, parse);
            const rank = ['Volume', 'Part', 'Book'].indexOf(whole.unit);
            if (rank >= 0) {
                // A group that carries text of its own (an epigraph under
                // Zarathustra's and Flatland's Parts) scopes what follows,
                // and its text opens the first unit it holds, where the
                // edition prints it. Its title is `position: title`.
                ledger.count(file, reconcileWords(xhtml, [whole], parse));
                ledger.groups.push(whole.title);
                while (scope.length && scope[scope.length - 1].rank >= rank) scope.pop();
                scope.push({ prefix: whole.title.split(': ')[0], rank });
                carried = whole.content;
                continue;
            }
            fileParts = [{ ...whole, name: whole.title, composed: false }];
            inFile = [];
        }
        ledger.count(file, reconcileWords(xhtml, fileParts, parse, inFile));
        if (recipe.perFile) fileParts = [wholeFile(fileParts, inFile)];
        const within = scope[scope.length - 1];
        for (const part of fileParts) {
            if (within && !part.composed) part.within = within.prefix;
        }
        if (carried) {
            fileParts[0].content = `${carried}\n\n${fileParts[0].content}`;
            carried = null;
        }
        parts.push(...fileParts);
    }
    if (include.size) throw new Error(`${recipe.repo}: include names files not in the spine: ${[...include].join(', ')}`);
    if (carried) throw new Error(`${recipe.repo}: a group's own text has no unit after it to open`);

    const seen = new Map();
    for (const part of parts) {
        if (part.name || !part.unit) continue;
        const next = (seen.get(part.unit) || 0) + 1;
        seen.set(part.unit, next);
        part.name = `${part.unit} ${next}`;
    }
    for (const part of parts) {
        if (part.within) part.name = part.name ? `${part.within} · ${part.name}` : part.within;
    }
    const rename = new Map(Object.entries(recipe.rename || {}));
    for (const part of parts) {
        if (!rename.has(part.name)) continue;
        const name = rename.get(part.name);
        rename.delete(part.name);
        part.name = name;
    }
    if (rename.size) throw new Error(`${recipe.repo}: rename names units not found: ${[...rename.keys()].join(', ')}`);
    return parts;
}

/** Exactly the units the recipe names, each one element read whole. */
async function listedUnits(recipe, ledger) {
    const parts = [];
    const hashed = new Set();
    for (const unit of recipe.units) {
        const xhtml = await fetchFile(recipe.repo, `text/${unit.file}`);
        if (!hashed.has(unit.file)) ledger.files.push(`${unit.file} ${sha256(xhtml)}`);
        hashed.add(unit.file);
        const part = readStandardEbooksElement(xhtml, parse, unit.id ?? null);
        ledger.count(`${unit.file}#${unit.id ?? ''}`, {
            sourceWords: part.sourceWords,
            importedWords: words(`${part.sourceTitle ?? ''} ${part.content}`)
        });
        parts.push({ ...part, name: unit.name ?? part.title, ...(unit.verse === undefined ? {} : { verse: unit.verse }) });
    }
    return parts;
}

/** A Standard Ebooks edition's units, as its recipe selects them. */
async function standardEbooksUnits(artifact, ledger) {
    const { files, url } = await readOpf(artifact.repo);
    const parts = artifact.units === 'spine'
        ? await spineUnits(artifact, files, ledger)
        : await listedUnits(artifact, ledger);
    return {
        parts,
        source: { kind: 'standard-ebooks', url, repo: `https://github.com/standardebooks/${artifact.repo}` }
    };
}

/**
 * A Gutenberg HTML edition's units, as its recipe declares them; `prefix`
 * names the volume or part a unit belongs to when a work spans editions.
 */
async function gutenbergUnits(artifact, ledger) {
    if (artifact.artifact !== 'html') throw new Error(`Gutenberg ${artifact.ebook}: only the HTML edition is read (artifact: 'html')`);
    const { html, sha256: digest } = await fetchGutenberg(artifact.ebook);
    const read = readGutenberg(html, parse, artifact);
    ledger.count(`pg${artifact.ebook}`, read);
    for (const [kind, count] of Object.entries(read.dropped)) ledger.dropped[kind] = (ledger.dropped[kind] || 0) + count;
    ledger.groups.push(...read.groups);
    if (read.title) console.log(`  pg${artifact.ebook}: span opens under "${read.title}"`);
    console.log(`  pg${artifact.ebook}: ${read.sourceWords} words in the span, ${read.importedWords} out`);
    const parts = read.parts.map(part => ({ ...part, name: artifact.prefix ? `${artifact.prefix} · ${part.name}` : part.name }));
    return {
        parts,
        source: { kind: 'gutenberg', url: `https://www.gutenberg.org/ebooks/${artifact.ebook}`, artifact: 'html', sha256: digest }
    };
}

/** Refuses, with every failure named, unless the units are fit to serve. */
function gate(id, recipe, parts, ledger) {
    const failures = [];
    if (ledger.lost !== 0) {
        failures.push(`${ledger.lost} words lost between source and payload `
            + `(${ledger.losses.map(([file, lost]) => `${file} ${lost}`).join(', ')})`);
    }
    if (recipe.count !== undefined && parts.length !== recipe.count) {
        failures.push(`${parts.length} units where the recipe expects ${recipe.count}`);
    }
    const names = new Map();
    for (const part of parts) {
        if (!part.name || /^(?:[IVXLCDM]+|\d+)\.?$/u.test(part.name) || /^[a-z0-9]+(?:-[a-z0-9]+)+$/u.test(part.name)) {
            failures.push(`a unit carries no readable name (${JSON.stringify(part.name)})`);
        }
        if (names.has(part.name)) failures.push(`two units are named "${part.name}"`);
        names.set(part.name, true);
        if (DISTRIBUTOR_MATTER.test(part.name) || DISTRIBUTOR_MATTER.test(part.content)) {
            failures.push(`"${part.name}" carries distributor matter`);
        }
        if (FOOTNOTE_MARKER.test(part.content) || LEFTOVER.test(part.content)) {
            failures.push(`"${part.name}" carries a footnote marker or a producer's note`);
        }
        if (part.content.length < MIN_CHARS) {
            failures.push(`"${part.name}" is ${part.content.length} characters, under ${MIN_CHARS}`);
        }
        const lines = part.content.split('\n').filter(line => line.trim()).length;
        if (part.verse && (part.lines === 0 || lines < part.lines)) {
            failures.push(`"${part.name}" is verse with ${lines} lines where its markup declared ${part.lines}`);
        }
    }
    if (failures.length) {
        throw new Error(`${id}: refusing to write.\n  ${failures.join('\n  ')}`);
    }
}

function writeCorpusEntry(entry) {
    const source = readFileSync(CORPUS, 'utf8');
    const block = /(export const SCHOOL_WORKS = Object\.freeze\(\[)([\s\S]*?)(\]\);)/u.exec(source);
    if (!block) throw new Error('corpus.js: SCHOOL_WORKS not found');
    const current = block[2].split('\n').map(line => line.trim().replace(/,$/u, '')).filter(Boolean)
        .map(line => JSON.parse(line));
    const order = SCHOOL_CANON.map(record => record.id);
    const next = [...current.filter(work => work.id !== entry.id), entry]
        .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    const body = `\n${next.map(work => `  ${JSON.stringify(work)}`).join(',\n')}\n`;
    writeFileSync(CORPUS, source.replace(block[0], `${block[1]}${body}${block[3]}`));
}

async function ingest(id, { dryRun }) {
    const recipe = RECIPES[id];
    const record = SCHOOL_CANON.find(candidate => candidate.id === id);
    if (!recipe || !record) throw new Error(`no recipe for ${id}; known: ${Object.keys(RECIPES).join(', ')}`);

    const ledger = {
        files: [], groups: [], lost: 0, losses: [], words: 0, dropped: {},
        count(label, { sourceWords, importedWords }) {
            this.words += sourceWords;
            this.lost += sourceWords - importedWords;
            if (sourceWords !== importedWords) this.losses.push([label, sourceWords - importedWords]);
        }
    };
    const retrieved = new Date().toISOString().slice(0, 10);
    const parts = [];
    const sources = [];
    for (const artifact of recipe.artifacts ?? [recipe]) {
        const read = artifact.ebook
            ? await gutenbergUnits(artifact, ledger)
            : await standardEbooksUnits(artifact, ledger);
        parts.push(...read.parts);
        sources.push({ ...read.source, retrieved });
    }

    for (const part of parts) {
        console.log(`  ${part.verse ? 'verse' : 'prose'} ${String(part.content.length).padStart(8)}  ${part.name}${part.sourceTitle && part.sourceTitle !== part.name ? `  [${part.sourceTitle}]` : ''}`);
    }
    gate(id, recipe, parts, ledger);

    const sections = sectionsFromParts(parts);
    const checksum = `sha256:${sha256(JSON.stringify(sections))}`;
    // The first edition read is the work's source; a work read from more
    // than one names every one of them, in reading order.
    const source = sources.length > 1 ? { ...sources[0], artifacts: sources } : sources[0];
    const entry = {
        id, constName: constName(id), checksum, units: sections.length,
        edition: recipe.edition, source, rights: recipe.rights
    };
    const dropped = Object.entries(ledger.dropped).map(([kind, count]) => `${count} ${kind}`).join(', ');
    console.log(`${id}: ${sections.length} units, ${ledger.words} words in, ${ledger.words - ledger.lost} out, 0 lost`
        + `${dropped ? ` (dropped before reading: ${dropped})` : ''}, ${checksum}`);
    if (dryRun) return entry;

    const meta = {
        id,
        title: record.title,
        author: record.author,
        edition: recipe.edition,
        source: { ...source, ...(ledger.files.length ? { files: ledger.files } : {}) },
        // Words the ingest removed from the editions before reading them, by kind.
        ...(Object.keys(ledger.dropped).length ? { dropped: ledger.dropped } : {}),
        rights: recipe.rights,
        structure: 'declared',
        // Groups the edition sets above its units; a unit's name carries
        // its group's position.
        ...(ledger.groups.length ? { groups: ledger.groups } : {}),
        units: sections.length,
        verseLines: parts.reduce((total, part) => total + (part.verse ? part.lines : 0), 0),
        words: ledger.words
    };
    const module = `/**
 * ${record.title} — ${record.author}. ${recipe.edition.statement}.
 *
 * GENERATED by scripts/school-ingest.mjs — do not hand-edit. The School
 * corpus (src/content/school/corpus.js) names this payload by its checksum,
 * ${checksum}.
 */

export const ${entry.constName}_SECTIONS = ${JSON.stringify(sections, null, 4)};

export const ${entry.constName}_META = Object.freeze(${JSON.stringify(meta, null, 4)});
`;
    mkdirSync(OUT, { recursive: true });
    writeFileSync(resolve(OUT, `${id}.js`), module);
    writeCorpusEntry(entry);
    console.log(`wrote src/content/school/works/${id}.js and its line in corpus.js`);
    return entry;
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targets = args.filter(arg => !arg.startsWith('--'));
if (args.includes('--list') || (!targets.length && !args.includes('--all'))) {
    for (const [id, recipe] of Object.entries(RECIPES)) {
        const written = existsSync(resolve(OUT, `${id}.js`)) ? 'written' : 'not written';
        const editions = (recipe.artifacts ?? [recipe]).map(artifact => artifact.repo ?? `pg${artifact.ebook}`).join(' + ');
        console.log(`${id.padEnd(40)} ${editions}  (${written})`);
    }
} else {
    for (const id of args.includes('--all') ? Object.keys(RECIPES) : targets) {
        await ingest(id, { dryRun });
    }
}
