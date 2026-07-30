/**
 * Batch accession for the approved 66-work imaginative-literature pass.
 *
 * Usage:
 *   node scripts/literature-ingest.mjs --list
 *   node scripts/literature-ingest.mjs W01
 *   node scripts/literature-ingest.mjs --all
 *   node scripts/literature-ingest.mjs --all --dry-run
 *
 * `--all` acquires every directly downloadable text artifact currently
 * named by the dossier. Scan-only, compound-catalogue, and release-gated
 * records are reported explicitly; they are never silently substituted.
 */
import {
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync
} from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    assertDossier,
    parseLiteratureDossier
} from './archive-dossier.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(ROOT, '.ingest-cache', 'literature');
const OUT = resolve(ROOT, 'src/content/archive/works');
const CATALOG = resolve(ROOT, 'src/content/archive/literature-catalog.js');
const CURATION = resolve(ROOT, 'src/content/archive/literature-curation.js');
const REPORT = resolve(ROOT, 'docs/reviews/SOL-LITERATURE-INGEST-REPORT.json');
const entries = assertDossier(parseLiteratureDossier()).map(entry => {
    if (entry.code !== 'W42') return entry;
    return {
        ...entry,
        provenance: {
            ...entry.provenance,
            edition: 'Chatto & Windus, London, 1929; Basil Creighton translation',
            evidence: [
                ...entry.provenance.evidence,
                'The accession payload is the complete London setting, not the differently paginated 284-page Doubleday, Doran U.S. setting.'
            ]
        },
        caveats: [
            ...entry.caveats,
            'This holding is explicitly the 319-page London setting. Collation against the first U.S. setting remains an editorial task and no identity of readings is claimed.'
        ]
    };
});

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

/**
 * The cache key must name the SOURCE, not just the slot.
 *
 * It used to be `w13-1.txt` — the work's code and nothing else. When
 * W13's dossier was corrected from Gutenberg #1246 (Conrad Aiken's
 * "The House of Dust") to #8604 (Morshead's actual Oresteia), the
 * re-ingest read the cache, found `w13-1.txt`, and served the Aiken
 * again. A correction that cannot invalidate its own cache is not a
 * correction; it is a second copy of the mistake.
 */
function artifactName(entry, n, url) {
    const ext = url.match(/\.(txt|xml|json|pdf)(?:[?#]|$)/i)?.[1]?.toLowerCase() || 'txt';
    const key = createHash('sha256').update(url).digest('hex').slice(0, 8);
    return `${entry.code.toLowerCase()}-${n + 1}-${key}.${ext}`;
}

function projectGutenbergArtifact(source) {
    const id = source.url.match(/gutenberg\.org\/ebooks\/(\d+)/)?.[1];
    if (!id) return null;
    return {
        label: source.label,
        canonicalUrl: source.url,
        url: `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
        mediaType: 'text/plain'
    };
}

function internetArchiveArtifact(source) {
    const id = source.url.match(/archive\.org\/details\/([^/?#]+)/)?.[1];
    if (!id) return null;
    return {
        label: source.label,
        canonicalUrl: source.url,
        url: `https://archive.org/download/${id}/${id}_djvu.txt`,
        mediaType: 'text/plain',
        ocr: true
    };
}

const SPECIAL_ARTIFACTS = Object.freeze({
    W42: [{
        label: 'Internet Archive OCR of the complete Chatto & Windus London setting',
        canonicalUrl: 'https://archive.org/details/dli.ministry.23346',
        url: 'https://archive.org/download/dli.ministry.23346/E10036_The_Storm_Of_Steel_djvu.txt',
        mediaType: 'text/plain',
        ocr: true
    }],
    W04: [{
        label: 'Perseus Digital Library TEI transcription of the Brookes More translation',
        canonicalUrl: 'https://catalog.perseus.org/catalog/urn:cts:latinLit:phi0959.phi006.perseus-eng1',
        url: 'https://raw.githubusercontent.com/PerseusDL/canonical-latinLit/master/data/phi0959/phi006/phi0959.phi006.perseus-eng3.xml',
        mediaType: 'application/xml'
    }],
    W16: [{
        label: 'Cambridge Shakespeare, volume 8 scan OCR (Hamlet)',
        canonicalUrl: 'https://archive.org/details/worksofwilliamsh08shakuoft',
        url: 'https://archive.org/download/worksofwilliamsh08shakuoft/worksofwilliamsh08shakuoft_djvu.txt',
        mediaType: 'text/plain',
        ocr: true,
        slice: ['HAMLET.', 'KING LEAR.']
    }],
    W17: [{
        label: 'Cambridge Shakespeare, volume 8 scan OCR (King Lear)',
        canonicalUrl: 'https://archive.org/details/worksofwilliamsh08shakuoft',
        url: 'https://archive.org/download/worksofwilliamsh08shakuoft/worksofwilliamsh08shakuoft_djvu.txt',
        mediaType: 'text/plain',
        ocr: true,
        slice: ['KING LEAR.', 'OTHELLO']
    }],
    W18: [{
        label: 'Cambridge Shakespeare, volume 1 scan OCR (The Tempest)',
        canonicalUrl: 'https://archive.org/details/worksofwilliamsh01shakuoft',
        url: 'https://archive.org/download/worksofwilliamsh01shakuoft/worksofwilliamsh01shakuoft_djvu.txt',
        mediaType: 'text/plain',
        ocr: true,
        slice: ['THE TEMPEST.', 'THE TWO GENTLEMEN OF VERONA.']
    }],
    W22: [{
        label: 'Wikisource EPUB export of Bayard Taylor’s complete Faust',
        canonicalUrl: 'https://en.wikisource.org/wiki/Faust_(trans._Bayard_Taylor)',
        url: 'https://ws-export.wmcloud.org/?lang=en&page=Faust_%28trans._Bayard_Taylor%29&format=epub',
        mediaType: 'application/epub+zip'
    }],
    // The dossier cites the author collection because Ganguli's complete
    // translation is distributed as nine Gutenberg records.
    E02: ['15474', '15475', '15476', '15477', '15478', '15479', '15480', '15481', '15482']
        .map((id, i) => ({
            label: `Project Gutenberg Ganguli volume ${i + 1} (#${id})`,
            canonicalUrl: `https://www.gutenberg.org/ebooks/${id}`,
            url: `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
            mediaType: 'text/plain'
        })),
    // Dutt's nine-volume set is one bibliographic object even though
    // the dossier links its first catalogue record as the set witness.
    E03: Array.from({ length: 9 }, (_, i) => {
        const volume = String(i + 1).padStart(2, '0');
        const id = `shahnama${volume}firduoft`;
        return {
            label: `Internet Archive, Shahnama volume ${i + 1}`,
            canonicalUrl: `https://archive.org/details/${id}`,
            url: `https://archive.org/download/${id}/${id}_djvu.txt`,
            mediaType: 'text/plain',
            ocr: true
        };
    }),
    E04: ['51252', '51775', '52564', '53254', '54257', '54525', '54778', '55091', '55587', '58360']
        .map((id, i) => ({
            label: `Project Gutenberg Burton volume ${i + 1} of 10 (#${id})`,
            canonicalUrl: `https://www.gutenberg.org/ebooks/${id}`,
            url: `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
            mediaType: 'text/plain'
        })),
    E16: [1, 2].map(volume => {
        const file = `Romance of the Three Kingdoms - tr. Brewitt-Taylor - Volume ${volume}.djvu`;
        return {
            label: `Wikisource proofread transcription and facsimile, volume ${volume}`,
            canonicalUrl: `https://en.wikisource.org/wiki/File:${file.replace(/ /g, '_')}`,
            url: `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(file)}`,
            mediaType: 'application/wikisource-proofread',
            wikisourcePrefix: `${file}/`,
            exportPage: `San_Kuo/Volume_${volume}`
        };
    })
});

function artifactsFor(entry) {
    if (SPECIAL_ARTIFACTS[entry.code]) return SPECIAL_ARTIFACTS[entry.code];
    return entry.provenance.sources
        .map(source => projectGutenbergArtifact(source) || internetArchiveArtifact(source))
        .filter(Boolean);
}

async function fetchArtifact(entry, artifact, n) {
    mkdirSync(CACHE, { recursive: true });
    const path = resolve(CACHE, artifactName(entry, n, artifact.url));
    let bytes;
    let transcriptSha256;
    if (artifact.wikisourcePrefix) {
        const scanPath = resolve(CACHE, `${entry.code.toLowerCase()}-${n + 1}.djvu`);
        const textPath = resolve(CACHE, `${entry.code.toLowerCase()}-${n + 1}-export.epub`);
        if (existsSync(scanPath)) {
            bytes = readFileSync(scanPath);
        } else {
            process.stderr.write(`fetching ${entry.code} facsimile ${artifact.url}\n`);
            const response = await fetch(artifact.url, {
                headers: { 'User-Agent': 'SOL-Public-Domain-Archive/1.0 (edition audit)' }
            });
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
            bytes = Buffer.from(await response.arrayBuffer());
            writeFileSync(scanPath, bytes);
        }
        let text;
        let transcriptBytes;
        if (existsSync(textPath)) {
            transcriptBytes = readFileSync(textPath);
        } else {
            const exportUrl = new URL('https://ws-export.wmcloud.org/');
            exportUrl.search = new URLSearchParams({
                lang: 'en',
                page: artifact.exportPage,
                format: 'epub'
            });
            process.stderr.write(`fetching ${entry.code} transcription ${exportUrl}\n`);
            const response = await fetch(exportUrl, {
                headers: { 'User-Agent': 'SOL-Public-Domain-Archive/1.0 (edition audit)' }
            });
            if (!response.ok) throw new Error(`${response.status} exporting ${artifact.exportPage}`);
            transcriptBytes = Buffer.from(await response.arrayBuffer());
            writeFileSync(textPath, transcriptBytes);
        }
        text = epubText(transcriptBytes);
        transcriptSha256 = sha256(transcriptBytes);
        return {
            ...artifact,
            retrieved: new Date().toISOString().slice(0, 10),
            sha256: sha256(bytes),
            transcriptSha256,
            bytes: bytes.length,
            text
        };
    }
    if (existsSync(path)) {
        bytes = readFileSync(path);
    } else {
        process.stderr.write(`fetching ${entry.code} ${artifact.url}\n`);
        const response = await fetch(artifact.url, {
            headers: { 'User-Agent': 'SOL-Public-Domain-Archive/1.0 (edition audit)' }
        });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        bytes = Buffer.from(await response.arrayBuffer());
        writeFileSync(path, bytes);
    }
    let text = decodeArtifact(bytes, artifact.mediaType);
    if (entry.code === 'W25') {
        // Gutenberg #26 carries a digitiser's 1964–1992 production
        // history inside its START marker. It is not Milton's front
        // matter or part of any source edition.
        text = text.replace(
            /Introduction \(one page\)[\s\S]*?This is the second version of Paradise Lost released by Project\s+Gutenberg\.[\s\S]*?etext\.\s*/i,
            ''
        );
    }
    if (artifact.slice) {
        const loose = value => new RegExp(value
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\s+/g, '\\s+'), 'i');
        const start = loose(artifact.slice[0]).exec(text);
        const tail = start ? text.slice(start.index + start[0].length) : '';
        const end = loose(artifact.slice[1]).exec(tail);
        const from = start?.index ?? -1;
        const to = end ? from + start[0].length + end.index : -1;
        if (from < 0 || to < 0) {
            throw new Error(`edition boundary not found: ${artifact.slice.join(' → ')}`);
        }
        text = text.slice(from, to);
    }
    return {
        ...artifact,
        retrieved: new Date().toISOString().slice(0, 10),
        sha256: sha256(bytes),
        bytes: bytes.length,
        text
    };
}

function stripWikitext(value) {
    let text = value
        .replace(/<noinclude>[\s\S]*?<\/noinclude>/gi, '')
        .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, '')
        .replace(/<ref\b[^/>]*\/>/gi, '')
        .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1')
        .replace(/'{2,5}/g, '');
    // Proofread-page templates here are running headers and layout
    // instructions. Remove nested templates from the inside out.
    for (let i = 0; i < 8 && /\{\{[^{}]*\}\}/.test(text); i++) {
        text = text.replace(/\{\{[^{}]*\}\}/g, '');
    }
    return markupToText(text);
}

async function wikiApi(params) {
    const url = new URL('https://en.wikisource.org/w/api.php');
    url.search = new URLSearchParams({
        ...params,
        format: 'json',
        formatversion: '2',
        maxlag: '5'
    });
    for (let attempt = 0; attempt < 5; attempt++) {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'SOL-Public-Domain-Archive/1.0 (public-domain edition audit)',
                'Accept': 'application/json'
            }
        });
        if (response.ok) return response.json();
        if (![429, 503].includes(response.status)) {
            throw new Error(`${response.status} from Wikisource API`);
        }
        const retryAfter = Number(response.headers.get('retry-after')) || 2 ** attempt;
        await new Promise(resolveWait => setTimeout(resolveWait, retryAfter * 1000));
    }
    throw new Error('Wikisource API remained rate-limited after five retries');
}

async function fetchWikisourceProofread(prefix) {
    const titles = [];
    let continuation;
    do {
        const data = await wikiApi({
            action: 'query',
            list: 'allpages',
            apnamespace: '104',
            apprefix: prefix,
            aplimit: 'max',
            ...(continuation ? { apcontinue: continuation } : {})
        });
        titles.push(...data.query.allpages.map(page => page.title));
        continuation = data.continue?.apcontinue;
    } while (continuation);
    titles.sort((a, b) => {
        const an = Number(a.match(/\/(\d+)$/)?.[1]);
        const bn = Number(b.match(/\/(\d+)$/)?.[1]);
        return an - bn;
    });
    if (titles.length < 500) throw new Error(`only ${titles.length} proofread pages found for ${prefix}`);

    const pages = [];
    for (let i = 0; i < titles.length; i += 40) {
        if (i) await new Promise(resolveWait => setTimeout(resolveWait, 250));
        const data = await wikiApi({
            action: 'query',
            prop: 'revisions',
            rvprop: 'content',
            rvslots: 'main',
            titles: titles.slice(i, i + 40).join('|')
        });
        const byTitle = new Map(data.query.pages.map(page => [page.title, page]));
        for (const title of titles.slice(i, i + 40)) {
            const raw = byTitle.get(title)?.revisions?.[0]?.slots?.main?.content || '';
            const text = stripWikitext(raw);
            if (text) pages.push(text);
        }
    }
    return pages.join('\n\n');
}

function decodeEntities(value) {
    const named = {
        amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
        mdash: '—', ndash: '–', hellip: '…', lsquo: '‘', rsquo: '’',
        ldquo: '“', rdquo: '”'
    };
    return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity) => {
        if (entity[0] === '#') {
            const hex = entity[1].toLowerCase() === 'x';
            return String.fromCodePoint(parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
        }
        return named[entity.toLowerCase()] ?? whole;
    });
}

function markupToText(value) {
    return decodeEntities(value
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<\/?(?:p|div|h[1-6]|li|tr|blockquote|section|article|br)\b[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ''))
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function epubText(bytes) {
    const files = [];
    let eocd = bytes.length - 22;
    while (eocd >= 0 && bytes.readUInt32LE(eocd) !== 0x06054b50) eocd--;
    if (eocd < 0) throw new Error('EPUB has no ZIP end-of-central-directory record');
    const count = bytes.readUInt16LE(eocd + 10);
    let at = bytes.readUInt32LE(eocd + 16);
    for (let i = 0; i < count; i++) {
        if (bytes.readUInt32LE(at) !== 0x02014b50) throw new Error('invalid EPUB central directory');
        const method = bytes.readUInt16LE(at + 10);
        const compressed = bytes.readUInt32LE(at + 20);
        const nameLength = bytes.readUInt16LE(at + 28);
        const extraLength = bytes.readUInt16LE(at + 30);
        const commentLength = bytes.readUInt16LE(at + 32);
        const local = bytes.readUInt32LE(at + 42);
        const name = bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8');
        if (/\.(xhtml|html)$/i.test(name) && !/(nav|toc|cover|titlepage|colophon)\./i.test(name)) {
            const localName = bytes.readUInt16LE(local + 26);
            const localExtra = bytes.readUInt16LE(local + 28);
            const start = local + 30 + localName + localExtra;
            const data = bytes.subarray(start, start + compressed);
            const body = method === 0 ? data : method === 8 ? inflateRawSync(data) : null;
            if (body) files.push({ name, text: markupToText(body.toString('utf8')) });
        }
        at += 46 + nameLength + extraLength + commentLength;
    }
    return files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        .map(file => file.text)
        .join('\n\n');
}

function decodeArtifact(bytes, mediaType) {
    if (mediaType === 'application/epub+zip') return epubText(bytes);
    const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
    if (mediaType === 'application/xml') return markupToText(text);
    return text;
}

function unwrapArtifact(raw) {
    const text = raw.replace(/\r\n?/g, '\n');
    const lines = text.split('\n');
    const start = lines.findIndex(line => /^\s*\*{3}\s*START OF/i.test(line));
    const end = lines.findIndex((line, i) =>
        i > Math.max(start, 0) && /^\s*\*{3}\s*END OF/i.test(line));
    return lines.slice(start >= 0 ? start + 1 : 0, end >= 0 ? end : lines.length);
}

/**
 * A DIVISION WORD IS NOT A HEADING.
 *
 * The ordinal used to be optional — `(?:[IVXLCDM\d]+|THE\s+\w+)?` — so
 * the pattern reduced to "a line beginning with one of these words".
 * Tolstoy writes "part. Anna Pávlovna Schérer on the contrary, despite
 * her forty years," and that became a section, named after itself. 27%
 * of the corpus's 9,212 section names were prose caught this way.
 *
 * A numbered division carries a number. Unnumbered matter is matched
 * separately and exactly, on its own line, as it always was.
 */
const NUMBERED_HEADING =
    /^(VOLUME|VOL\.?|PART|BOOK|CANTO|CHAPTER|ACT|SCENE|DAY|NIGHT|TALE|STORY|ADVENTURE|RUNE|POEM|SECTION)\b[\s.:—-]*(?:[IVXLCDM]+|\d{1,4})\b/i;

const NAMED_MATTER =
    /^(PREFACE|PROLOGUE|INTRODUCTION|EPILOGUE|APPENDIX|NOTES|GLOSSARY|INDEX)$/i;

function isStructuralHeading(line, previousLine = null) {
    const value = line.trim();
    if (!value || value.length > 100) return false;
    // A HEADING STANDS ALONE. Without this a contents page — where the
    // divisions are listed one per line, consecutively — became one
    // section per entry, and the Odyssey's title page ended up named
    // "BOOK XXIV." after the last line of its own table of contents.
    if (previousLine !== null && previousLine.trim()) return false;
    return NUMBERED_HEADING.test(value) || NAMED_MATTER.test(value);
}

function compactSections(sections) {
    const result = [];
    for (const section of sections) {
        if (section.content.trim().length > 200 || !result.length) {
            result.push(section);
        } else {
            // The heading is INSIDE the content now, so re-inserting the
            // name here would print it twice.
            result[result.length - 1].content += `\n\n${section.content}`;
            result[result.length - 1].endAnchor = section.endAnchor;
        }
    }
    if (result.length > 1 && result[0].content.trim().length <= 200) {
        const front = result.shift();
        result[0].content = `${front.content}\n\n${result[0].content}`;
        result[0].startAnchor = front.startAnchor;
    }
    return result;
}

function sectionsForArtifact(artifact, volumeIndex, volumeCount) {
    const lines = unwrapArtifact(artifact.text);
    const hits = [];
    for (let i = 0; i < lines.length; i++) {
        if (isStructuralHeading(lines[i], i > 0 ? lines[i - 1] : null)) hits.push(i);
    }
    const boundaries = [0, ...hits.filter(i => i > 0)];
    const volume = volumeCount > 1 ? `Volume ${volumeIndex + 1}` : null;
    const sections = boundaries.map((from, i) => {
        const to = boundaries[i + 1] ?? lines.length;
        const heading = hits.includes(from) ? lines[from].trim() : 'Front matter';
        // THE HEADING STAYS IN THE TEXT.
        //
        // It used to be dropped (`from + 1`), which left the section
        // NAME as the only witness to where a division began — and that
        // name is wrong a quarter of the time. Keeping the line makes
        // the payload self-describing: a reader sees the chapter it
        // announces, and anything deriving divisions can read the text
        // instead of trusting a label.
        const contentFrom = from;
        return {
            name: volume ? `${volume} — ${heading}` : heading,
            path: [volume, heading].filter(Boolean),
            startAnchor: heading,
            endAnchor: boundaries[i + 1] !== undefined
                ? lines[boundaries[i + 1]].trim()
                : 'end of artifact',
            content: lines.slice(contentFrom, to).join('\n').trim()
        };
    }).filter(section => section.content);
    return compactSections(sections);
}

function moduleText(entry, sections, artifacts) {
    const key = entry.id.toUpperCase().replace(/-/g, '_');
    const payload = sections.map(section => section.content).join('\n\n');
    const sourceDigest = sha256(artifacts.map(a => a.sha256).join('\n'));
    const meta = {
        id: entry.id,
        accessionCode: entry.code,
        title: entry.title,
        author: entry.author,
        shelf: entry.traditionShelf,
        traditionShelf: entry.traditionShelf,
        subjectShelves: entry.subjectShelves,
        division: entry.division,
        edition: {
            statement: entry.provenance.edition,
            year: entry.provenance.year
        },
        source: { sha256: sourceDigest, artifacts: artifacts.map(({ text, ...a }) => a) },
        rights: {
            basis: entry.provenance.basis,
            evidence: `${entry.provenance.edition}. ${entry.provenance.evidence.join(' ')}`
        },
        structure: entry.structure,
        extent: entry.extent,
        caveats: entry.caveats,
        chars: payload.length,
        payloadChecksum: sha256(payload)
    };
    return `/**\n * ${entry.code} — ${entry.title}.\n * GENERATED by scripts/literature-ingest.mjs; do not hand-edit.\n */\n\n`
        + `export const ${key}_SECTIONS = ${JSON.stringify(sections, null, 4)};\n\n`
        + `export const ${key}_META = Object.freeze(${JSON.stringify(meta, null, 4)});\n`;
}

function catalogueText(accessions) {
    const records = accessions.map(({ entry, meta }) => {
        const key = entry.id.toUpperCase().replace(/-/g, '_');
        return `    {\n`
            + `        meta: ${JSON.stringify(meta)},\n`
            + `        load: () => import('./works/${entry.id}.js')\n`
            + `            .then(module => module.${key}_SECTIONS)\n`
            + `    }`;
    });
    return `/** GENERATED by scripts/literature-ingest.mjs; do not hand-edit. */\n`
        + `export const LITERATURE_WORKS = [\n${records.join(',\n')}\n];\n`;
}

function curationText(accessions) {
    const records = {};
    const held = new Set(accessions.map(a => a.entry.id));
    for (const { entry } of accessions) {
        if (entry.releaseGate) continue;
        records[entry.id] = {
            shelf: entry.traditionShelf,
            traditionShelf: entry.traditionShelf,
            subjectShelves: entry.subjectShelves,
            division: entry.division,
            why: entry.why,
            functions: entry.functions,
            rhymes: entry.rhymes.filter(id => held.has(id)),
            provenance: entry.provenance,
            structure: entry.structure,
            extent: entry.extent,
            caveats: entry.caveats
        };
    }
    return `/** GENERATED by scripts/literature-ingest.mjs; do not hand-edit. */\n`
        + `export const LITERATURE_CURATION = Object.freeze(${JSON.stringify(records, null, 4)});\n`;
}

async function ingest(entry) {
    const declared = artifactsFor(entry);
    if (!declared.length) {
        if (entry.releaseGate) {
            return { entry, status: 'staged', reason: entry.releaseGate };
        }
        return {
            entry,
            status: 'blocked',
            reason: 'No directly downloadable text artifact is pinned; scan/catalogue adapter required.'
        };
    }
    const artifacts = [];
    for (let i = 0; i < declared.length; i++) {
        artifacts.push(await fetchArtifact(entry, declared[i], i));
    }
    const sections = artifacts.flatMap((artifact, i) =>
        sectionsForArtifact(artifact, i, artifacts.length));
    if (!sections.length) throw new Error('artifact produced no addressable reading units');
    const payload = sections.map(section => section.content).join('\n\n');
    if (payload.length < 1000) throw new Error(`payload is suspiciously short (${payload.length} chars)`);
    const sourceDigest = sha256(artifacts.map(a => a.sha256).join('\n'));
    const meta = {
        id: entry.id,
        title: entry.title,
        author: entry.author,
        shelf: entry.traditionShelf,
        traditionShelf: entry.traditionShelf,
        subjectShelves: entry.subjectShelves,
        division: entry.division,
        edition: { statement: entry.provenance.edition, year: entry.provenance.year },
        basis: entry.provenance.basis,
        sourceSha256: sourceDigest,
        payloadChecksum: sha256(payload),
        chars: payload.length,
        sections: sections.length
    };
    return {
        entry,
        status: entry.releaseGate ? 'staged' : 'ingested',
        reason: entry.releaseGate,
        meta,
        sections,
        artifacts
    };
}

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const selectedCode = argv.find(arg => /^[WEI]\d{2}$/i.test(arg))?.toUpperCase();

if (argv.includes('--list') || (!argv.includes('--all') && !selectedCode)) {
    for (const entry of entries) {
        const artifacts = artifactsFor(entry);
        const state = entry.releaseGate ? 'GATED' : artifacts.length ? 'READY' : 'ADAPTER';
        console.log(`${entry.code} ${state.padEnd(7)} ${String(artifacts.length).padStart(2)} artifact(s)  ${entry.title}`);
    }
    process.exit(argv.includes('--list') ? 0 : 1);
}

const selected = selectedCode
    ? entries.filter(entry => entry.code === selectedCode)
    : entries;
const results = [];
for (const entry of selected) {
    try {
        const result = await ingest(entry);
        results.push(result);
        console.log(`${entry.code} ${result.status.toUpperCase()} ${entry.title}`
            + (result.meta ? ` — ${result.meta.sections} units, ${result.meta.chars} chars` : ''));
    } catch (error) {
        results.push({ entry, status: 'failed', reason: error.message });
        console.error(`${entry.code} FAILED ${entry.title}: ${error.message}`);
    }
}

const acquired = results.filter(result => result.meta);
const ingested = results.filter(result => result.status === 'ingested');
if (!dryRun) {
    mkdirSync(OUT, { recursive: true });
    for (const result of acquired) {
        writeFileSync(
            resolve(OUT, `${result.entry.id}.js`),
            moduleText(result.entry, result.sections, result.artifacts),
            'utf8'
        );
    }
    // A full run is authoritative. A single-code run only writes its
    // payload; it cannot safely replace the batch catalogue.
    if (!selectedCode) {
        const released = ingested.filter(result => !result.entry.releaseGate);
        writeFileSync(CATALOG, catalogueText(released), 'utf8');
        writeFileSync(CURATION, curationText(released), 'utf8');
        const report = {
            generated: new Date().toISOString(),
            dossierCount: entries.length,
            ingested: ingested.map(r => r.entry.code),
            staged: results.filter(r => r.status === 'staged')
                .map(r => ({ code: r.entry.code, acquired: Boolean(r.meta), reason: r.reason })),
            blocked: results.filter(r => ['blocked', 'failed'].includes(r.status))
                .map(r => ({ code: r.entry.code, status: r.status, reason: r.reason }))
        };
        writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }
}

const failed = results.filter(result => ['blocked', 'failed'].includes(result.status));
console.log(`\n${ingested.length} ingested, `
    + `${results.filter(r => r.status === 'staged').length} staged, ${failed.length} blocked/failed`);
if (failed.length) process.exitCode = 3;
