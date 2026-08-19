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
    'spoon-river': {
        id: 'spoon-river-anthology',
        repo: 'edgar-lee-masters_spoon-river-anthology',
        title: 'Spoon River Anthology',
        author: 'Edgar Lee Masters',
        shelf: 'western',
        // The files that are the WORK. Standard Ebooks keeps its own colophon,
        // imprint and uncopyright beside the text; they are the publisher
        // speaking and are not read.
        files: ['spoon-river-anthology.xhtml', 'epilogue.xhtml'],
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

async function fetchFile(work, file) {
    mkdirSync(CACHE, { recursive: true });
    const path = resolve(CACHE, `${work.repo}__${file}`);
    if (existsSync(path)) return readFileSync(path, 'utf8');
    const url = `${RAW}/${work.repo}/master/src/epub/text/${file}`;
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

    for (const file of work.files) {
        const xhtml = await fetchFile(work, file);
        digests.push(`${file} ${sha(xhtml)}`);
        const fileParts = readStandardEbooksFile(xhtml, parse);
        if (!fileParts.length) throw new Error(`${file}: no addressable parts found`);
        const reconciled = reconcileWords(xhtml, fileParts, parse);
        sourceWords += reconciled.sourceWords;
        importedWords += reconciled.importedWords;
        parts.push(...fileParts);
        console.log(`  ${file.padEnd(30)} ${String(fileParts.length).padStart(4)} parts  `
            + `${String(reconciled.sourceWords).padStart(7)}w  lost ${reconciled.lost}`);
    }

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
