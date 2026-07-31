/**
 * Audit and replace the 17 acquired legacy classics named in SOL's
 * 2026-07-30 review. `starter-the-descent` is deliberately excluded:
 * it is an original R.I.S.E. composition, not an acquired edition.
 *
 * Usage:
 *   node scripts/legacy-ingest.mjs --all
 *   node scripts/legacy-ingest.mjs sacred-tao-te-ching
 *   node scripts/legacy-ingest.mjs --all --dry-run
 */
import {
    existsSync,
    mkdirSync,
    readFileSync,
    writeFileSync
} from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SACRED_DEEP } from '../src/sources/text/data/sacred_deep.js';
import { LITERARY_DEEP } from '../src/sources/text/data/literary_deep.js';
import { SACRED_TEXTS } from '../src/sources/text/sacred.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(ROOT, '.ingest-cache', 'legacy');
const OUT = resolve(ROOT, 'src/content/archive/works');
const CATALOG = resolve(ROOT, 'src/content/archive/legacy-catalog.js');
const REPORT = resolve(ROOT, 'docs/reviews/SOL-LEGACY-CLASSICS-AUDIT-2026-07-30.json');
const EXTENDED = JSON.parse(readFileSync(
    resolve(ROOT, 'src/sources/text/data/sacred_texts.json'),
    'utf8'
));

const pg = (id, file = `pg${id}.txt`) =>
    `https://www.gutenberg.org/cache/epub/${id}/${file}`;
const ia = id =>
    `https://archive.org/download/${id}/${id}_djvu.txt`;
const source = (url, label, file, mediaType = 'text/plain') =>
    ({ url, label, file, mediaType });

const WORKS = Object.freeze([
    {
        id: 'sacred-i-ching',
        title: 'The Yî King',
        author: 'traditional; King Wăn and the Duke of Kâu',
        shelf: 'eastern',
        edition: { translator: 'James Legge', publisher: 'Clarendon Press', year: 1882 },
        sources: [source(
            ia('sacredbooksofchi16conf'),
            'Internet Archive scan of Sacred Books of the East, vol. 16',
            'i-ching-legge-1882.txt'
        )],
        rights: { basis: 'pre-1930-us', evidence: 'James Legge translation, Clarendon Press, 1882; the exact Internet Archive scan OCR and its retrieval URL are pinned by SHA-256.' },
        headings: /^(?:[IVXLCDM]+\.\s+THE .+ HEXAGRAM|APPENDIX [IVXLCDM]+|CHAPTER [IVXLCDM]+)$/i
    },
    {
        id: 'sacred-zen-koans',
        title: 'Essays in Zen Buddhism: First Series',
        author: 'Daisetz Teitaro Suzuki',
        shelf: 'eastern',
        edition: { publisher: 'Luzac and Company', year: 1927 },
        sources: [source(pg(71157), 'Project Gutenberg #71157', 'zen-suzuki-71157.txt')],
        rights: { basis: 'pre-1930-us', evidence: 'The artifact reproduces Suzuki’s 1927 Luzac first series and is marked public domain in the United States by Project Gutenberg.' },
        headings: /^(?:INTRODUCTION|ZEN AS CHINESE INTERPRETATION OF THE DOCTRINE OF ENLIGHTENMENT|ENLIGHTENMENT AND IGNORANCE|HISTORY OF ZEN BUDDHISM FROM BODHI-DHARMA TO HUI-NENG \(YENO\)|ON SATORI—THE REVELATION OF A NEW TRUTH IN ZEN BUDDHISM|PRACTICAL METHODS OF ZEN INSTRUCTION|THE MEDITATION HALL,? AND THE IDEALS OF THE MONKISH DISCIPLINE|THE TEN COW-HERDING PICTURES|CHINESE NOTES)$/i,
        headingLabels: {
            'INTRODUCTION': 'ESSAY I — Introduction',
            'ZEN AS CHINESE INTERPRETATION OF THE DOCTRINE OF ENLIGHTENMENT': 'ESSAY II — Zen as Chinese Interpretation of the Doctrine of Enlightenment',
            'ENLIGHTENMENT AND IGNORANCE': 'ESSAY III — Enlightenment and Ignorance',
            'HISTORY OF ZEN BUDDHISM FROM BODHI-DHARMA TO HUI-NENG (YENO)': 'ESSAY IV — History of Zen Buddhism in China',
            'ON SATORI—THE REVELATION OF A NEW TRUTH IN ZEN BUDDHISM': 'ESSAY V — Satori',
            'PRACTICAL METHODS OF ZEN INSTRUCTION': 'ESSAY VI — Practical Methods of Zen Instruction',
            'THE MEDITATION HALL, AND THE IDEALS OF THE MONKISH DISCIPLINE': 'ESSAY VII — The Meditation Hall',
            'THE TEN COW-HERDING PICTURES': 'ESSAY VIII — The Ten Cow-Herding Pictures',
            'CHINESE NOTES': 'Appendix — Chinese Notes'
        },
        caveat: 'The legacy “Zen Koans” miscellany had no named edition. It is replaced by a complete, attributable 1927 Zen source that includes historical koan material; the legacy identifier is retained for link stability.'
    },
    {
        id: 'extended-bhagavad-gita-full',
        title: 'The Song Celestial; or, Bhagavad-Gîtâ',
        author: 'traditional attribution to Vyasa',
        shelf: 'eastern',
        edition: {
            translator: 'Sir Edwin Arnold',
            publisher: 'Truslove, Hanson & Comba, Ltd.',
            year: 1900,
            statement: '1900 New York reprint; Arnold translation first published 1885'
        },
        sources: [source(pg(2388), 'Project Gutenberg #2388', 'gita-arnold-2388.txt')],
        rights: { basis: 'pre-1930-us', evidence: 'The artifact is the 1900 Truslove, Hanson & Comba reprint of Arnold’s 1885 verse translation and is marked public domain in the United States by Project Gutenberg.' },
        headings: /^(?:CHAPTER|THE BOOK OF)\s+(?:THE\s+)?[A-Z][A-Z ,'-]+$/i
    },
    {
        id: 'sacred-emerald-tablet',
        title: 'Tabula Smaragdina',
        author: 'Hermes Trismegistus, traditional attribution',
        shelf: 'western',
        edition: { translator: 'Isaac Newton', publisher: 'Keynes MS. 28, King’s College Library', year: 1680 },
        sources: [source(
            'https://newton.dlib.indiana.edu/text/ALCH00017/normalized',
            'Chymistry of Isaac Newton, Keynes MS. 28 normalized transcription',
            'emerald-tablet-newton.html',
            'text/html'
        )],
        rights: { basis: 'author-death-70', evidence: 'Newton’s English translation survives in Keynes MS. 28; Newton died in 1727. The scholarly transcription and manuscript identity are pinned.' },
        extract: ['Tis true without lying, certain & most true.', 'That which I have said of the operation of the Sun']
    },
    {
        id: 'extended-dhammapada-full',
        title: 'The Dhammapada',
        author: 'traditional Buddhist canon',
        shelf: 'eastern',
        edition: { translator: 'F. Max Müller', publisher: 'Sacred Books of the East, vol. X', year: 1881 },
        sources: [source(pg(2017), 'Project Gutenberg #2017', 'dhammapada-muller-2017.txt')],
        rights: { basis: 'pre-1930-us', evidence: 'Müller’s 1881 Sacred Books of the East translation; the artifact is marked public domain in the United States by Project Gutenberg.' },
        headings: /^CHAPTER [IVXLCDM]+\.\s+.+$/i
    },
    {
        id: 'sacred-rumi',
        title: 'Selected Poems from the Dīvāni Shamsi Tabrīz',
        author: 'Jalálu’ddín Rúmí',
        shelf: 'eastern',
        edition: { translator: 'Reynold A. Nicholson', publisher: 'Cambridge University Press', year: 1898 },
        sources: [source(
            'https://www.sattor.com/english/Divani_Shamsi_Tabriz.pdf',
            'Scanned PDF of Nicholson’s 1898 Cambridge edition',
            'rumi-nicholson-1898.pdf',
            'application/pdf'
        )],
        rights: { basis: 'author-death-70', evidence: 'Nicholson’s 1898 translation; Nicholson died in 1945. Exact scan OCR is pinned by SHA-256.' },
        headings: /^(?:[IVXLCDM]+\.|ODE [IVXLCDM]+|INTRODUCTION|NOTES)$/i
    },
    {
        id: 'sacred-corpus-hermeticum',
        title: 'Thrice-Greatest Hermes',
        author: 'Hermes Trismegistus, traditional attribution',
        shelf: 'western',
        edition: { translator: 'G. R. S. Mead', publisher: 'Theosophical Publishing Society', year: 1906 },
        sources: [
            source(ia('thricegreatesthe01hermuoft'), 'Internet Archive, Mead volume I', 'hermes-mead-v1.txt'),
            source(ia('thricegreatesthe02hermuoft'), 'Internet Archive, Mead volume II', 'hermes-mead-v2.txt'),
            source(ia('thricegreatesthe03hermuoft'), 'Internet Archive, Mead volume III', 'hermes-mead-v3.txt')
        ],
        rights: { basis: 'pre-1930-us', evidence: 'Complete three-volume Mead edition, 1906; each scan OCR artifact is separately pinned.' },
        headings: /^(?:BOOK [IVXLCDM]+|PART [IVXLCDM]+|CHAPTER [IVXLCDM]+|[IVXLCDM]+\.\s+[A-Z].+)$/i
    },
    {
        id: 'literary-letters-young-poet',
        title: 'Briefe an einen jungen Dichter',
        author: 'Rainer Maria Rilke',
        shelf: 'western',
        edition: { editor: 'Franz Xaver Kappus', publisher: 'Insel-Verlag', year: 1929, language: 'German' },
        sources: [
            ['170203', 'Paris, 17 February 1903'],
            ['050403', 'Viareggio, 5 April 1903'],
            ['230403', 'Viareggio, 23 April 1903'],
            ['160703', 'Worpswede, 16 July 1903'],
            ['291003', 'Rome, 29 October 1903'],
            ['231203', 'Rome, 23 December 1903'],
            ['140504', 'Rome, 14 May 1904'],
            ['120804', 'Borgeby gård, 12 August 1904'],
            ['040904', 'Furuborg, 4 November 1904'],
            ['261208', 'Paris, 26 December 1908']
        ].map(([slug, label]) => source(
            `https://www.rilke.de/briefe/${slug}.htm`,
            `Rilke.de transcription — ${label}`,
            `rilke-${slug}.html`,
            'text/html'
        )),
        rights: { basis: 'author-death-70', evidence: 'Rilke’s original German letters; Rilke died in 1926. The former M. D. Herter Norton English payload was renewed in 1962 and is not reused.' },
        headings: /^(?:PARIS|VIAREGGIO|ROM|BREMEN|BORGHETTO|FURUBORG|BORGEBY|OBERNEULAND|CAPRI|WORPSWEDE).*\d{4}\.?$/i,
        caveat: 'No public-domain English translation was substituted for Norton’s renewed 1934 translation. This verified holding is the German original.'
    },
    {
        id: 'literary-thus-spoke-zarathustra',
        title: 'Thus Spake Zarathustra',
        author: 'Friedrich Nietzsche',
        shelf: 'western',
        edition: { translator: 'Thomas Common', publisher: 'T. N. Foulis', year: 1909 },
        sources: [source(pg(1998), 'Project Gutenberg #1998', 'zarathustra-common-1998.txt')],
        rights: { basis: 'pre-1930-us', evidence: 'Thomas Common translation, 1909; exact Project Gutenberg artifact is marked public domain in the United States.' },
        headings: /^(?:ZARATHUSTRA’S PROLOGUE|[IVXLCDM]+\.\s+[A-Z][A-Z ,’'-]+|PART [IVXLCDM]+)$/i
    },
    {
        id: 'literary-walden',
        title: 'Walden; or, Life in the Woods',
        author: 'Henry David Thoreau',
        shelf: 'western',
        edition: { publisher: 'Ticknor and Fields', year: 1854 },
        sources: [source(pg(205), 'Project Gutenberg #205', 'walden-thoreau-205.txt')],
        rights: { basis: 'pre-1930-us', evidence: 'Thoreau’s original English text, first published in 1854; exact artifact is marked public domain in the United States.' },
        headings: /^[A-Z][A-Z ,'-]{4,55}$/i
    },
    {
        id: 'literary-leaves-of-grass',
        title: 'Leaves of Grass',
        author: 'Walt Whitman',
        shelf: 'western',
        edition: { publisher: 'David McKay', year: 1892, statement: '1891–92 “deathbed” edition' },
        sources: [source(pg(1322), 'Project Gutenberg #1322', 'leaves-of-grass-whitman-1322.txt')],
        rights: { basis: 'pre-1930-us', evidence: 'Whitman’s final authorial 1891–92 edition; exact artifact is marked public domain in the United States.' },
        headings: /^(?:BOOK [IVXLCDM]+|[A-Z][A-Z ,’'-]{5,65})$/i
    },
    {
        id: 'literary-poems-dickinson',
        title: 'Poems by Emily Dickinson: Three Series, Complete',
        author: 'Emily Dickinson',
        shelf: 'western',
        edition: { editors: 'Mabel Loomis Todd and T. W. Higginson', publisher: 'Roberts Brothers', year: 1890, statement: 'three historical series, 1890–1896' },
        sources: [source(pg(12242), 'Project Gutenberg #12242', 'dickinson-three-series-12242.txt')],
        rights: { basis: 'pre-1930-us', evidence: 'The three historical public-domain series are complete in the pinned Project Gutenberg artifact.' },
        headings: /^(?:LIFE|LOVE|NATURE|TIME AND ETERNITY|[IVXLCDM]+\.)$/i
    },
    {
        id: 'literary-meditations',
        title: 'Meditations',
        author: 'Marcus Aurelius',
        shelf: 'western',
        edition: { translator: 'George Long', publisher: 'George Bell & Sons', year: 1862 },
        sources: [source(pg(2680), 'Project Gutenberg #2680', 'meditations-long-2680.txt')],
        rights: { basis: 'author-death-70', evidence: 'George Long’s 1862 English translation; Long died in 1879. The exact Project Gutenberg artifact and retrieval URL are pinned by SHA-256.' },
        headings: /^(?:THE FIRST BOOK|THE (?:SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH) BOOK)$/i
    },
    {
        id: 'literary-poems-blake',
        title: 'Songs of Innocence and of Experience',
        author: 'William Blake',
        shelf: 'western',
        edition: { publisher: 'R. Brimley Johnson', year: 1901 },
        sources: [source(pg(1934), 'Project Gutenberg #1934', 'blake-songs-1934.txt')],
        rights: { basis: 'pre-1930-us', evidence: 'Blake’s original English poems in the 1901 R. Brimley Johnson edition; the exact Project Gutenberg artifact is pinned by SHA-256.' },
        headings: /^[A-Z][A-Z ’,'-]{2,55}$/i
    },
    {
        id: 'literary-essays-emerson',
        title: 'Essays: First Series',
        author: 'Ralph Waldo Emerson',
        shelf: 'western',
        edition: { publisher: 'James Munroe and Company', year: 1841 },
        sources: [source(pg(2944), 'Project Gutenberg #2944', 'emerson-essays-2944.txt')],
        rights: { basis: 'pre-1930-us', evidence: 'Emerson’s original English 1841 first series; exact artifact is marked public domain in the United States.' },
        headings: /^(?:ESSAY [IVXLCDM]+\.|[IVXLCDM]+\.\s+[A-Z][A-Z -]+)$/i
    },
    {
        id: 'sacred-yoga-sutras',
        title: 'The Yoga Sutras of Patanjali: The Book of the Spiritual Man',
        author: 'Patañjali',
        shelf: 'eastern',
        edition: { translator: 'Charles Johnston', publisher: 'Quarterly Book Department', year: 1912 },
        sources: [source(pg(2526), 'Project Gutenberg #2526', 'yoga-sutras-johnston-2526.txt')],
        rights: { basis: 'pre-1930-us', evidence: 'Charles Johnston’s 1912 interpretation; exact artifact is marked public domain in the United States.' },
        headings: /^(?:BOOK [IVXLCDM]+|[IVXLCDM]+\.\s+[A-Z][A-Z ,'-]+)$/i,
        caveat: 'The legacy record named Swami Vivekananda but its choreographed English did not establish that source. The replacement is the exact Charles Johnston edition named here.'
    },
    {
        id: 'sacred-tao-te-ching',
        title: 'The Tao Teh King; or, The Tao and Its Characteristics',
        author: 'Lao-tze',
        shelf: 'eastern',
        edition: { translator: 'James Legge', publisher: 'Clarendon Press', year: 1891 },
        sources: [source(pg(216), 'Project Gutenberg #216', 'tao-legge-216.txt')],
        rights: { basis: 'pre-1930-us', evidence: 'James Legge’s 1891 Sacred Books of the East translation; exact artifact is marked public domain in the United States.' },
        headings: /^(?:CHAPTER|Ch\.)\s+[IVXLCDM]+\.?$/i
    }
]);

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

function decodeEntities(value) {
    const named = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘' };
    return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity) => {
        if (entity[0] === '#') {
            const hex = entity[1].toLowerCase() === 'x';
            return String.fromCodePoint(parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
        }
        return named[entity.toLowerCase()] ?? whole;
    });
}

function htmlText(value) {
    return decodeEntities(value
        .replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<\/?(?:p|div|h[1-6]|li|tr|blockquote|section|article|br)\b[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ''))
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function epubText(buffer) {
    const entries = [];
    let end = -1;
    for (let at = buffer.length - 22; at >= Math.max(0, buffer.length - 65557); at--) {
        if (buffer.readUInt32LE(at) === 0x06054b50) {
            end = at;
            break;
        }
    }
    if (end < 0) throw new Error('EPUB central directory not found');
    const count = buffer.readUInt16LE(end + 10);
    let at = buffer.readUInt32LE(end + 16);
    for (let i = 0; i < count; i++) {
        if (buffer.readUInt32LE(at) !== 0x02014b50) throw new Error('invalid EPUB directory');
        const method = buffer.readUInt16LE(at + 10);
        const compressedSize = buffer.readUInt32LE(at + 20);
        const nameLength = buffer.readUInt16LE(at + 28);
        const extraLength = buffer.readUInt16LE(at + 30);
        const commentLength = buffer.readUInt16LE(at + 32);
        const localOffset = buffer.readUInt32LE(at + 42);
        const name = buffer.subarray(at + 46, at + 46 + nameLength).toString('utf8');
        if (/\.(?:xhtml|html|htm)$/i.test(name)) {
            const localNameLength = buffer.readUInt16LE(localOffset + 26);
            const localExtraLength = buffer.readUInt16LE(localOffset + 28);
            const dataAt = localOffset + 30 + localNameLength + localExtraLength;
            const compressed = buffer.subarray(dataAt, dataAt + compressedSize);
            const value = method === 8 ? inflateRawSync(compressed) : compressed;
            entries.push({ name, text: htmlText(value.toString('utf8')) });
        }
        at += 46 + nameLength + extraLength + commentLength;
    }
    if (!entries.length) throw new Error('EPUB contains no HTML reading files');
    return entries.sort((a, b) => a.name.localeCompare(b.name))
        .map(entry => entry.text)
        .join('\n\n');
}

async function pdfText(buffer) {
    let pdfjs;
    try {
        pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    } catch {
        const bundled = resolve(
            process.env.USERPROFILE || '',
            '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs'
        );
        if (!existsSync(bundled)) {
            throw new Error('PDF ingestion requires pdfjs-dist (local dependency or Codex bundled runtime)');
        }
        pdfjs = await import(pathToFileURL(bundled).href);
    }
    const document = await pdfjs.getDocument({
        data: new Uint8Array(buffer),
        disableWorker: true,
        useSystemFonts: true
    }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        let text = '';
        for (const item of content.items) {
            text += item.str;
            text += item.hasEOL ? '\n' : ' ';
        }
        pages.push(text.trim());
    }
    return pages.join('\n\n');
}

/**
 * Who digitised a text is not part of the text.
 *
 * The same rule as literature-ingest.mjs, and it has to be stated in
 * both places because the two scripts share no code. This one was
 * written afterwards and did not inherit the fix, so the Tao opened on
 * "Produced by Gregory Walker", the Gita on "Produced by J. C. Byers.
 * HTML version by Al Haines.", and Rilke on a website's own header —
 * three of the seventeen classics acquired to raise the shelf's
 * standard.
 *
 * Bounded to the head so a line of prose reading "produced by" cannot
 * be swallowed out of the middle of a book.
 */
const PRODUCER = /^\s*(produced by|e-?text (was )?prepared by|transcribed (from|by)|this e-?book was produced|updated editions will replace|html version by)\b/i;
const NOTE_OPEN = /^\s*\[?\s*transcriber'?s?\s+note/i;
const CHROME = /^\s*(www\.|https?:\/\/|[\w.-]+\.(?:de|com|org|net)\s*[-–—])/i;
const HEAD_WINDOW = 120;

function stripDistributionMatter(lines) {
    const out = [];
    let skipUntilBlank = false;
    let skipUntilBracket = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i < HEAD_WINDOW) {
            if (skipUntilBracket) {
                if (line.includes(']')) skipUntilBracket = false;
                continue;
            }
            if (skipUntilBlank) {
                if (!line.trim()) skipUntilBlank = false;
                continue;
            }
            if (NOTE_OPEN.test(line)) {
                if (!line.includes(']')) skipUntilBracket = true;
                continue;
            }
            if (PRODUCER.test(line)) { skipUntilBlank = true; continue; }
            if (CHROME.test(line)) continue;
        }
        out.push(line);
    }
    while (out.length && !out[0].trim()) out.shift();
    return out;
}

function unwrap(value) {
    const text = value.replace(/\r\n?/g, '\n');
    const lines = text.split('\n');
    const start = lines.findIndex(line => /^\s*\*{3}\s*START OF/i.test(line));
    const end = lines.findIndex((line, i) => i > Math.max(start, 0)
        && /^\s*(?:\*{3}\s*END OF|End of the Project Gutenberg)/i.test(line));
    return stripDistributionMatter(
        lines.slice(start >= 0 ? start + 1 : 0, end >= 0 ? end : lines.length)).join('\n');
}

function reflow(lines) {
    const paragraphs = [];
    let buffer = [];
    const flush = () => {
        if (buffer.length) paragraphs.push(buffer.join(' ').replace(/\s+/g, ' ').trim());
        buffer = [];
    };
    for (const line of lines) {
        const value = line.trim();
        if (!value) flush();
        else buffer.push(value);
    }
    flush();
    return paragraphs.filter(Boolean).join('\n\n');
}

function sectionsFor(work, artifacts) {
    const sections = [];
    const completeFallback = [];
    const usedHeadingLabels = new Set();
    for (let volume = 0; volume < artifacts.length; volume++) {
        let text = artifacts[volume].text;
        if (work.extract) {
            const from = text.indexOf(work.extract[0]);
            const to = text.indexOf(work.extract[1], from);
            if (from < 0 || to < 0) throw new Error(`${work.id}: exact extraction bounds not found`);
            text = text.slice(from, to + work.extract[1].length);
        }
        completeFallback.push({
            name: artifacts.length > 1 ? `Part ${volume + 1}` : 'Full text',
            path: artifacts.length > 1 ? [`Part ${volume + 1}`] : ['Full text'],
            content: reflow(text.split('\n'))
        });
        const lines = text.split('\n');
        const hits = [];
        if (work.headings) {
            lines.forEach((line, index) => {
                if (line.trim().length <= 100 && work.headings.test(line.trim())) hits.push(index);
            });
        }
        const usable = hits.filter((at, i) => (hits[i + 1] ?? lines.length) - at > 3);
        if (usable.length >= 2) {
            const opening = reflow(lines.slice(0, usable[0]));
            if (opening.length >= 120) {
                sections.push({
                    name: artifacts.length > 1 ? `Volume ${volume + 1} — Opening` : 'Opening',
                    path: artifacts.length > 1 ? [`Volume ${volume + 1}`, 'Opening'] : ['Opening'],
                    content: opening
                });
            }
            for (let i = 0; i < usable.length; i++) {
                const from = usable[i];
                const to = usable[i + 1] ?? lines.length;
                const content = reflow(lines.slice(from + 1, to));
                if (content.length >= 120) {
                    const rawHeading = lines[from].trim();
                    const mappedHeading = work.headingLabels?.[rawHeading.toUpperCase()];
                    const heading = mappedHeading && !usedHeadingLabels.has(mappedHeading)
                        ? mappedHeading
                        : rawHeading;
                    if (mappedHeading) usedHeadingLabels.add(mappedHeading);
                    sections.push({
                        name: `${artifacts.length > 1 ? `Volume ${volume + 1} — ` : ''}${heading}`,
                        path: artifacts.length > 1 ? [`Volume ${volume + 1}`, heading] : [heading],
                        content
                    });
                }
            }
        } else {
            const content = reflow(lines);
            if (content.length >= 120) {
                sections.push({
                    name: artifacts.length > 1 ? `Volume ${volume + 1}` : 'Full text',
                    path: artifacts.length > 1 ? [`Volume ${volume + 1}`] : ['Full text'],
                    content
                });
            }
        }
    }
    const parsedChars = sections.reduce((sum, section) => sum + section.content.length, 0);
    const completeChars = completeFallback.reduce((sum, section) => sum + section.content.length, 0);
    // A heading detector may mistake all-caps verse lines for structure. Never
    // allow structural segmentation to silently discard a material part of a book.
    const resolved = parsedChars >= completeChars * 0.8 ? sections : completeFallback;
    // Very short poems or OCR fragments are not useful reading entries on
    // their own. Merge them without dropping a byte of source text.
    const compacted = [];
    for (const section of resolved) {
        if (section.content.length < 240 && compacted.length) {
            const previous = compacted.at(-1);
            previous.content += `\n\n${section.name}\n\n${section.content}`;
        } else {
            compacted.push({ ...section, path: [...section.path] });
        }
    }
    return compacted;
}

function legacyOpening(id) {
    const plain = id.replace(/^sacred-/, '').replace(/^literary-/, '');
    if (SACRED_DEEP[plain]) return SACRED_DEEP[plain].sequences[0]?.content || '';
    if (LITERARY_DEEP[plain]) return LITERARY_DEEP[plain].sequences[0]?.content || '';
    if (SACRED_TEXTS[plain]) return SACRED_TEXTS[plain].verses[0] || '';
    const extended = id.replace(/^extended-/, '');
    return EXTENDED[extended]?.chapters?.[0] || '';
}

function normalized(value) {
    return value
        .replace(/\[PAUSE\]/gi, ' ')
        .replace(/[|—–]/g, ' ')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function openingAudit(id, current, replacement) {
    const oldTokens = normalized(current).split(' ').filter(Boolean).slice(0, 60);
    const replacementTokens = normalized(replacement).split(' ').filter(Boolean);
    let bestOverlap = 0;
    let bestAt = 0;
    const stride = Math.max(1, Math.floor(oldTokens.length / 3));
    const windowSize = Math.max(180, oldTokens.length * 3);
    for (let at = 0; at < replacementTokens.length; at += stride) {
        const window = new Set(replacementTokens.slice(at, at + windowSize));
        const overlap = oldTokens.filter(token => window.has(token)).length;
        if (overlap > bestOverlap) {
            bestOverlap = overlap;
            bestAt = at;
        }
    }
    const score = oldTokens.length
        ? Number((bestOverlap / oldTokens.length).toFixed(3))
        : 0;
    const exactFragment = normalized(current).slice(0, 120);
    const exact = exactFragment.length > 30 && normalized(replacement).includes(exactFragment);
    return {
        legacyOpening: current.slice(0, 500),
        verifiedOpening: replacement.slice(0, 500),
        closestVerifiedPassage: replacementTokens.slice(bestAt, bestAt + 80).join(' '),
        openingTokenOverlap: score,
        verdict: exact ? 'matches-named-edition' : score >= 0.72 ? 'edited-or-modernized' : 'does-not-match-named-edition'
    };
}

async function fetchArtifact(work, descriptor) {
    mkdirSync(CACHE, { recursive: true });
    const path = resolve(CACHE, descriptor.file);
    let raw;
    if (existsSync(path)) raw = readFileSync(path);
    else {
        process.stderr.write(`fetching ${work.id} ${descriptor.url}\n`);
        const response = await fetch(descriptor.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8'
            }
        });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        raw = Buffer.from(await response.arrayBuffer());
        writeFileSync(path, raw);
    }
    const decoded = descriptor.mediaType === 'text/html'
        ? htmlText(raw.toString('utf8'))
        : descriptor.mediaType === 'application/epub+zip'
            ? epubText(raw)
            : descriptor.mediaType === 'application/pdf'
                ? await pdfText(raw)
                : raw.toString('utf8');
    return {
        ...descriptor,
        retrieved: new Date().toISOString().slice(0, 10),
        sha256: sha256(raw),
        bytes: Buffer.byteLength(raw),
        text: unwrap(decoded)
    };
}

function moduleText(work, sections, artifacts) {
    const key = work.id.toUpperCase().replace(/-/g, '_');
    const payload = sections.map(section => section.content).join('\n\n');
    const meta = {
        id: work.id,
        title: work.title,
        author: work.author,
        shelf: work.shelf,
        edition: work.edition,
        source: {
            sha256: sha256(artifacts.map(item => item.sha256).join('\n')),
            artifacts: artifacts.map(({ text, ...item }) => item)
        },
        rights: work.rights,
        extent: 'full',
        caveats: work.caveat ? [work.caveat] : [],
        chars: payload.length,
        payloadChecksum: sha256(payload)
    };
    return `/** GENERATED by scripts/legacy-ingest.mjs; do not hand-edit. */\n\n`
        + `export const ${key}_SECTIONS = ${JSON.stringify(sections, null, 4)};\n\n`
        + `export const ${key}_META = Object.freeze(${JSON.stringify(meta, null, 4)});\n`;
}

function catalogText(records) {
    const rows = records.map(({ work, meta }) => {
        const key = work.id.toUpperCase().replace(/-/g, '_');
        return `    {\n        meta: ${JSON.stringify(meta)},\n`
            + `        load: () => import('./works/${work.id}.js')\n`
            + `            .then(module => module.${key}_SECTIONS)\n    }`;
    });
    return `/** GENERATED by scripts/legacy-ingest.mjs; do not hand-edit. */\n`
        + `export const LEGACY_REINGESTED_WORKS = [\n${rows.join(',\n')}\n];\n`;
}

async function ingest(work) {
    const artifacts = [];
    for (const descriptor of work.sources) artifacts.push(await fetchArtifact(work, descriptor));
    const sections = sectionsFor(work, artifacts);
    if (!sections.length) throw new Error('no reading sections resolved');
    const payload = sections.map(section => section.content).join('\n\n');
    if (payload.length < 500) throw new Error(`payload is suspiciously short (${payload.length} chars)`);
    const meta = {
        id: work.id,
        title: work.title,
        author: work.author,
        shelf: work.shelf,
        edition: work.edition,
        basis: work.rights.basis,
        chars: payload.length,
        sections: sections.length,
        sourceSha256: sha256(artifacts.map(item => item.sha256).join('\n')),
        payloadChecksum: sha256(payload)
    };
    return {
        work,
        meta,
        artifacts,
        sections,
        audit: openingAudit(work.id, legacyOpening(work.id), payload)
    };
}

async function reuseGenerated(work) {
    const path = resolve(OUT, `${work.id}.js`);
    if (!existsSync(path)) throw new Error(`${work.id}: no generated payload available to reuse`);
    const module = await import(`${pathToFileURL(path).href}?reuse=${Date.now()}`);
    const key = work.id.toUpperCase().replace(/-/g, '_');
    const sections = module[`${key}_SECTIONS`];
    const prior = module[`${key}_META`];
    if (!sections || !prior) throw new Error(`${work.id}: generated exports are incomplete`);
    const payload = sections.map(section => section.content).join('\n\n');
    if (sha256(payload) !== prior.payloadChecksum) {
        throw new Error(`${work.id}: generated payload checksum does not verify`);
    }
    const artifacts = prior.source.artifacts.map(item => ({ ...item, text: '' }));
    const meta = {
        id: work.id,
        title: work.title,
        author: work.author,
        shelf: work.shelf,
        edition: work.edition,
        basis: work.rights.basis,
        chars: payload.length,
        sections: sections.length,
        sourceSha256: sha256(artifacts.map(item => item.sha256).join('\n')),
        payloadChecksum: sha256(payload)
    };
    return {
        work,
        meta,
        artifacts,
        sections,
        audit: openingAudit(work.id, legacyOpening(work.id), payload)
    };
}

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const reuseIds = new Set(
    argv.filter(arg => arg.startsWith('--reuse-generated='))
        .flatMap(arg => arg.slice('--reuse-generated='.length).split(','))
        .filter(Boolean)
);
const selectedId = argv.find(arg => !arg.startsWith('--'));
const selected = selectedId ? WORKS.filter(work => work.id === selectedId) : WORKS;
if (!argv.includes('--all') && !selectedId) {
    WORKS.forEach(work => console.log(`${work.id.padEnd(40)} ${work.title}`));
    process.exit(0);
}
if (!selected.length) throw new Error(`unknown legacy id ${selectedId}`);

const results = [];
const failures = [];
for (const work of selected) {
    try {
        const result = reuseIds.has(work.id)
            ? await reuseGenerated(work)
            : await ingest(work);
        results.push(result);
        console.log(`${work.id} — ${result.meta.sections} units, ${result.meta.chars} chars, ${result.audit.verdict}`);
    } catch (error) {
        failures.push({ id: work.id, reason: error.message });
        console.error(`${work.id} FAILED: ${error.message}`);
    }
}

if (!dryRun) {
    mkdirSync(OUT, { recursive: true });
    for (const result of results) {
        writeFileSync(
            resolve(OUT, `${result.work.id}.js`),
            moduleText(result.work, result.sections, result.artifacts),
            'utf8'
        );
    }
    if (!selectedId) {
        writeFileSync(CATALOG, catalogText(results), 'utf8');
        const report = {
            generated: new Date().toISOString(),
            cohortCount: 18,
            acquiredClassics: 17,
            retainedComposition: {
                id: 'starter-the-descent',
                status: 'original-composition',
                reason: 'Authored R.I.S.E. starter; no external edition or public-domain claim applies.'
            },
            replacements: results.map(result => ({
                id: result.work.id,
                title: result.work.title,
                edition: result.work.edition,
                rights: result.work.rights,
                sourceSha256: result.meta.sourceSha256,
                payloadChecksum: result.meta.payloadChecksum,
                sections: result.meta.sections,
                chars: result.meta.chars,
                caveat: result.work.caveat || null,
                ...result.audit
            })),
            failures
        };
        writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }
}

console.log(`\n${results.length} ingested, ${failures.length} failed`);
if (failures.length) process.exitCode = 3;
