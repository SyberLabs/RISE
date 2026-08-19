/**
 * Acquire a work from a Standard Ebooks edition.
 *
 *   node scripts/standard-ebooks-ingest.mjs spoon-river
 *
 * Every ingest before this one was archaeology. A flat text arrived and RISE
 * guessed where the divisions were, whether a line break was the poet's or the
 * file's, and which lines were headings — and guessed wrong often enough to
 * delete 303 words of Walden and 11,359 of Leaves of Grass. A missing line has
 * no shape, so nothing could detect it (ARCHIVE-CLEANSING-SPEC §2j).
 *
 * A Standard Ebooks edition declares its structure, so this reads rather than
 * infers. It refuses to publish a payload whose word count does not match the
 * source — the check that would have caught §2j on the day it was made.
 *
 * Their production work is CC0 and their determinations are made for the
 * UNITED STATES, which is why rights carry a territory rather than a boolean.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import {
    readContainerHeadings,
    readContainerName,
    readStandardEbooksFile,
    reconcileWords,
    sectionsFromParts
} from '../src/content/archive/standard-ebooks.js';

const ROOT = resolve(import.meta.dirname, '..');
const CACHE = resolve(ROOT, '.ingest-cache', 'standard-ebooks');
const OUT = resolve(ROOT, 'src/content/archive/works');
const RAW = 'https://raw.githubusercontent.com/standardebooks';
const API = 'https://api.github.com/repos/standardebooks';

const WORKS = {
    'emerson': {
        id: 'literary-essays-emerson',
        repo: 'ralph-waldo-emerson_essays',
        title: 'Essays',
        author: 'Ralph Waldo Emerson',
        shelf: 'western',
        edition: { publisher: 'Standard Ebooks', year: 1841 },
        rights: { basis: 'pre-1930-us', territory: 'US', evidence: 'First published 1841; in the public domain in the United States. Standard Ebooks production work is released CC0, proofread against page scans. Public-domain status elsewhere is not established by this record.' }
    },
    'analects': {
        id: 'confucius-analects',
        repo: 'confucius_analects_james-legge',
        title: 'Analects',
        author: 'Confucius',
        shelf: 'eastern',
        edition: { translator: 'James Legge', publisher: 'Standard Ebooks', year: 1861 },
        rights: { basis: 'pre-1930-us', territory: 'US', evidence: 'First published 1861; in the public domain in the United States. Standard Ebooks production work is released CC0, proofread against page scans. Public-domain status elsewhere is not established by this record.' }
    },
    'lyrical-ballads': {
        id: 'lyrical-ballads',
        repo: 'william-wordsworth_samuel-taylor-coleridge_lyrical-ballads',
        title: 'Lyrical Ballads',
        author: 'William Wordsworth and Samuel Taylor Coleridge',
        shelf: 'western',
        edition: { publisher: 'Standard Ebooks', year: 1798 },
        rights: { basis: 'pre-1930-us', territory: 'US', evidence: 'First published 1798; in the public domain in the United States. Standard Ebooks production work is released CC0, proofread against page scans. Public-domain status elsewhere is not established by this record.' }
    },
    'oedipus-rex': {
        id: 'oedipus-rex',
        repo: 'sophocles_oedipus-rex_francis-storr',
        title: 'Oedipus Rex',
        author: 'Sophocles',
        shelf: 'western',
        edition: { translator: 'Francis Storr', publisher: 'Standard Ebooks', year: 1912 },
        rights: {
            basis: 'pre-1930-us',
            territory: 'US',
            evidence: "Francis Storr translation, Loeb Classical Library, 1912 — in the "
                + 'public domain in the United States. Standard Ebooks production work is '
                + 'released CC0. Public-domain status elsewhere is not established here.'
        }
    },
    'middlemarch': {
        id: 'middlemarch',
        repo: 'george-eliot_middlemarch',
        title: 'Middlemarch',
        author: 'George Eliot',
        shelf: 'western',
        edition: { publisher: 'Standard Ebooks', year: 1872 },
        rights: {
            basis: 'pre-1930-us',
            territory: 'US',
            evidence: 'First published 1872; in the public domain in the United States. Standard Ebooks production work is released CC0, proofread against page scans. Public-domain status elsewhere is not established by this record.'
        }
    },
    'karamazov': {
        id: 'the-brothers-karamazov',
        repo: 'fyodor-dostoevsky_the-brothers-karamazov_constance-garnett',
        title: 'The Brothers Karamazov',
        author: 'Fyodor Dostoevsky',
        shelf: 'western',
        edition: { translator: 'Constance Garnett', publisher: 'Standard Ebooks', year: 1880 },
        rights: {
            basis: 'pre-1930-us',
            territory: 'US',
            evidence: 'First published 1880; in the public domain in the United States. Standard Ebooks production work is released CC0, proofread against page scans. Public-domain status elsewhere is not established by this record.'
        }
    },
    'meditations': {
        id: 'literary-meditations',
        repo: 'marcus-aurelius_meditations_george-long',
        title: 'Meditations',
        author: 'Marcus Aurelius',
        shelf: 'western',
        edition: { translator: 'George Long', publisher: 'Standard Ebooks', year: 1862 },
        rights: {
            basis: 'pre-1930-us',
            territory: 'US',
            evidence: 'First published 1862; in the public domain in the United States. Standard Ebooks production work is released CC0, proofread against page scans. Public-domain status elsewhere is not established by this record.'
        }
    },
    'tao-te-ching': {
        id: 'sacred-tao-te-ching',
        repo: 'laozi_tao-te-ching_james-legge',
        title: 'Tao Te Ching',
        author: 'Laozi',
        shelf: 'eastern',
        edition: { translator: 'James Legge', publisher: 'Standard Ebooks', year: 1891 },
        rights: {
            basis: 'pre-1930-us',
            territory: 'US',
            evidence: 'First published 1891; in the public domain in the United States. Standard Ebooks production work is released CC0, proofread against page scans. Public-domain status elsewhere is not established by this record.'
        }
    },
    'iliad': {
        id: 'the-iliad',
        repo: 'homer_the-iliad_william-cullen-bryant',
        title: 'The Iliad',
        author: 'Homer',
        shelf: 'western',
        edition: { translator: 'William Cullen Bryant', publisher: 'Standard Ebooks', year: 1870 },
        rights: {
            basis: 'pre-1930-us',
            territory: 'US',
            evidence: 'First published 1870; in the public domain in the United States. Standard Ebooks production work is released CC0, proofread against page scans. Public-domain status elsewhere is not established by this record.'
        }
    },
    'divine-comedy': {
        id: 'the-divine-comedy',
        repo: 'dante-alighieri_the-divine-comedy_henry-wadsworth-longfellow',
        title: 'The Divine Comedy',
        author: 'Dante Alighieri',
        shelf: 'western',
        edition: { translator: 'Henry Wadsworth Longfellow', publisher: 'Standard Ebooks', year: 1867 },
        rights: {
            basis: 'pre-1930-us',
            territory: 'US',
            evidence: 'First published 1867; in the public domain in the United States. Standard Ebooks production work is released CC0, proofread against page scans. Public-domain status elsewhere is not established by this record.'
        }
    },
    'metamorphoses': {
        id: 'metamorphoses',
        repo: 'ovid_metamorphoses_various-translators',
        title: 'Metamorphoses',
        author: 'Ovid',
        shelf: 'western',
        edition: { translator: 'various translators', publisher: 'Standard Ebooks', year: 1717 },
        rights: {
            basis: 'pre-1930-us',
            territory: 'US',
            evidence: 'First published 1717; in the public domain in the United States. Standard Ebooks production work is released CC0, proofread against page scans. Public-domain status elsewhere is not established by this record.'
        }
    },
    'paradise-lost': {
        id: 'paradise-lost',
        repo: 'john-milton_paradise-lost',
        title: 'Paradise Lost',
        author: 'John Milton',
        shelf: 'western',
        edition: { publisher: 'Standard Ebooks', year: 1667 },
        rights: {
            basis: 'pre-1930-us',
            territory: 'US',
            evidence: 'First published 1667; in the public domain in the United States. Standard Ebooks production work is released CC0, proofread against page scans. Public-domain status elsewhere is not established by this record.'
        }
    },
    'ulysses': {
        id: 'ulysses',
        repo: 'james-joyce_ulysses',
        title: 'Ulysses',
        author: 'James Joyce',
        shelf: 'western',
        edition: { publisher: 'Standard Ebooks', year: 1922 },
        rights: {
            basis: 'pre-1930-us',
            territory: 'US',
            evidence: 'First published 1922; in the public domain in the United States. Standard Ebooks production work is released CC0, proofread against page scans. Public-domain status elsewhere is not established by this record.'
        }
    },
    walden: {
        id: 'literary-walden',
        repo: 'henry-david-thoreau_walden',
        title: 'Walden',
        author: 'Henry David Thoreau',
        shelf: 'western',
        edition: { publisher: 'Standard Ebooks', year: 1854, statement: 'Ticknor and Fields, 1854' },
        rights: {
            basis: 'pre-1930-us',
            territory: 'US',
            evidence: 'First published 1854; in the public domain in the United States. '
                + 'Standard Ebooks production work is released CC0, proofread against '
                + 'page scans at the Internet Archive. Public-domain status elsewhere is '
                + 'not established by this record.'
        }
    },
    'spoon-river': {
        id: 'spoon-river-anthology',
        repo: 'edgar-lee-masters_spoon-river-anthology',
        title: 'Spoon River Anthology',
        author: 'Edgar Lee Masters',
        shelf: 'western',
        // Reading order comes from the edition's own spine (see readSpine).
        // Named here only to record what the publisher's matter is called, so
        // a file appearing that is neither the work nor known apparatus is a
        // refusal rather than a silent inclusion.
        edition: { publisher: 'Standard Ebooks', year: 1916, statement: 'the expanded 1916 edition' },
        rights: {
            basis: 'pre-1930-us',
            territory: 'US',
            evidence: 'First published 1916; in the public domain in the United States. '
                + 'Standard Ebooks production work is released CC0. Public-domain status '
                + 'elsewhere is not established by this record.'
        }
    }
};

const parse = markup => new JSDOM(markup, { contentType: 'text/html' }).window.document;
const sha = value => createHash('sha256').update(value).digest('hex');

/**
 * WHAT IS THE WORK IS THE EDITION'S TO SAY.
 *
 * Every file declares itself on its own body element — `bodymatter` for the
 * work, `frontmatter` and `backmatter` for a title page, a colophon, a
 * translator's preface. A hand-written list of apparatus filenames was here
 * first and it was a guess: it knew about colophons and did not know that
 * Middlemarch opens on a preface and the Tao Te Ching on a translator's,
 * both of which those editions call frontmatter.
 */
function isBodyMatter(xhtml) {
    const body = /<body[^>]*epub:type="([^"]*)"/u.exec(xhtml);
    return Boolean(body) && body[1].split(/\s+/u).includes('bodymatter');
}

/**
 * READING ORDER IS THE EDITION'S, NOT OURS.
 *
 * A directory listing is alphabetical, which for Walden would open on Baker
 * Farm and end at Winter Animals. The spine says what follows what, and
 * supplying that order from memory is exactly the kind of deciding this path
 * exists to stop.
 */
async function readSpine(work) {
    const opf = await fetchFile(work, 'content.opf', '');
    const spine = /<spine>([\s\S]*?)<\/spine>/u.exec(opf);
    if (!spine) throw new Error(`${work.repo}: no spine in content.opf`);
    const refs = [...spine[1].matchAll(/idref="([^"]+)"/gu)].map(match => match[1]);
    if (!refs.length) throw new Error(`${work.repo}: spine names no files`);
    return refs;
}

async function fetchFile(work, file, dir = 'text/') {
    mkdirSync(CACHE, { recursive: true });
    const path = resolve(CACHE, `${work.repo}__${file}`);
    if (existsSync(path)) return readFileSync(path, 'utf8');
    const url = `${RAW}/${work.repo}/master/src/epub/${dir}${file}`;
    process.stderr.write(`fetching ${url}\n`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    const text = await response.text();
    writeFileSync(path, text);
    return text;
}

function constantName(id) {
    return id.toUpperCase().replace(/[^A-Z0-9]+/gu, '_');
}

async function ingest(key) {
    const work = WORKS[key];
    if (!work) throw new Error(`unknown work ${key}; known: ${Object.keys(WORKS).join(', ')}`);

    const parts = [];
    const digests = [];
    let sourceWords = 0;
    let importedWords = 0;

    const spine = await readSpine(work);
    const skipped = [];
    const containers = [];

    for (const file of spine) {
        const xhtml = await fetchFile(work, file);
        if (!isBodyMatter(xhtml)) {
            skipped.push(file);
            continue;
        }
        // A Book or Part with no prose in it names the readings that follow.
        // Recorded rather than dropped: the flat section model cannot hold two
        // levels, and the shape a work has is not ours to forget.
        const container = readContainerName(xhtml, parse);
        if (container) {
            containers.push(container);
            console.log(`  ${file.padEnd(34)}    container  "${container}"`);
            continue;
        }
        digests.push(`${file} ${sha(xhtml)}`);
        const fileParts = readStandardEbooksFile(xhtml, parse);
        // A bodymatter file that yields nothing is markup this importer does
        // not understand, and guessing at it is the one thing forbidden here.
        if (!fileParts.length) throw new Error(`${file}: no addressable parts found`);
        // Containers inside a file own no reading, so their headings are
        // counted where they went rather than silently vanishing.
        const inFile = readContainerHeadings(xhtml, parse);
        containers.push(...inFile);
        const reconciled = reconcileWords(xhtml, fileParts, parse, inFile);
        sourceWords += reconciled.sourceWords;
        importedWords += reconciled.importedWords;
        parts.push(...fileParts);
        console.log(`  ${file.padEnd(34)} ${String(fileParts.length).padStart(4)} parts  `
            + `${String(reconciled.sourceWords).padStart(7)}w  lost ${reconciled.lost}`);
    }
    console.log(`  spine: ${spine.length} files, ${digests.length} bodymatter, `
        + `${skipped.length} apparatus (${skipped.join(', ')})`);

    // WORDS IN MUST EQUAL WORDS OUT. There is no acceptable loss: the importer
    // reads declared structure, so anything missing is the importer's fault.
    const lost = sourceWords - importedWords;
    if (lost !== 0) {
        throw new Error(`${work.id}: ${lost} words lost between source and payload. `
            + 'Refusing to write a payload that is not the edition.');
    }

    const sections = sectionsFromParts(parts);
    const payload = JSON.stringify(sections, null, 4);
    const name = constantName(work.id);
    const chars = sections.reduce((total, section) => total + section.content.length, 0);

    const meta = {
        id: work.id,
        title: work.title,
        author: work.author,
        shelf: work.shelf,
        edition: work.edition,
        source: {
            label: `Standard Ebooks — ${work.repo}`,
            url: `https://standardebooks.org/ebooks/${work.repo.replace('_', '/')}`,
            repo: `${RAW}/${work.repo}`,
            files: digests,
            retrieved: new Date().toISOString().slice(0, 10)
        },
        rights: work.rights,
        // Groups the edition declares above the reading level. RISE serves a
        // flat list of readings, so these are recorded and not served.
        ...(containers.length ? { containers } : {}),
        // The slugs the edition itself gave each part, in order. A curator can
        // name `spoon-river-anthology#lucinda-matlock` rather than `#87`.
        slugs: parts.map(part => part.id),
        parts: parts.length,
        lines: parts.reduce((total, part) => total + part.lines, 0),
        chars,
        payloadChecksum: sha(payload)
    };

    const header = `/**
 * ${work.title} — ${work.author}.
 *
 * EDITION   ${work.edition.statement || ''} via Standard Ebooks
 * SOURCE    ${meta.source.url}
 *           retrieved ${meta.source.retrieved}
 *           ${digests.join('\n *           ')}
 * RIGHTS    ${work.rights.basis} (${work.rights.territory})
 *           ${work.rights.evidence}
 *
 * GENERATED by scripts/standard-ebooks-ingest.mjs — do not hand-edit.
 * sha256(payload) ${meta.payloadChecksum}
 *
 * STRUCTURE IS READ, NOT INFERRED. The edition declares its own parts —
 * <article epub:type="z3998:poem"> for a poem, <p> for a stanza, <span> for a
 * verse line — so nothing here guesses where a poem begins or whether a line
 * break is the poet's. ${meta.parts} parts and ${meta.lines} verse lines came
 * through, and the ingest refuses to write a payload whose word count differs
 * from the source's by even one.
 */

export const ${name}_SECTIONS = ${payload};

export const ${name}_META = Object.freeze(${JSON.stringify(meta, null, 4)});
`;

    const file = resolve(OUT, `${work.id}.js`);
    writeFileSync(file, header);
    console.log(`\n${work.id} — ${meta.parts} parts, ${meta.lines} verse lines, `
        + `${sourceWords} words, 0 lost`);
    console.log(`wrote ${file}`);
}

const key = process.argv[2];
if (!key) {
    console.log('works:', Object.keys(WORKS).join(', '));
    process.exit(0);
}
await ingest(key);
