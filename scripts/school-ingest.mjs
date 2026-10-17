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
 * Every other source names its `kind` and the pages or file it reads, and is
 * read by its own reader in src/content/school/ with the same unit grammar:
 * `wikisource` (`pages`: page titles, through the MediaWiki API's parsed
 * HTML), `sacred-texts` (`base` and `pages`: chapter pages), `ccel`
 * (`work`: the CCEL path of a plain-text file), `eebo-tcp` (`tcp`: the TCP
 * id, its TEI from GitHub), `html` (`pages`: URLs, read by the recipe's
 * selectors) and `file` (`path` under scripts/school-sources/). Pages are
 * read as one document unless `units: 'page'`, which makes each page one
 * unit named from `names` (a null name carries the page on in the unit
 * before it).
 *
 * Fetched files are cached under .ingest-cache/<kind>/; the sha256 of every
 * file read is recorded in the work's source (a work on several pages names
 * each page's, and the source's own is the hash of all of them in order).
 */
import { execFileSync } from 'node:child_process';
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
import { readCcel } from '../src/content/school/ccel.js';
import { readFile } from '../src/content/school/file.js';
import { readGutenberg } from '../src/content/school/gutenberg.js';
import { readHtml } from '../src/content/school/html.js';
import { readSacredTexts } from '../src/content/school/sacred-texts.js';
import { readTei, teiAvailability } from '../src/content/school/tei.js';
import { readWikisource } from '../src/content/school/wikisource.js';
import { WEB_RECIPES } from './school-ingest-recipes.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const CACHE = resolve(ROOT, '.ingest-cache', 'standard-ebooks');
const GUTENBERG_CACHE = resolve(ROOT, '.ingest-cache', 'gutenberg');
const OUT = resolve(ROOT, 'src/content/school/works');
const CORPUS = resolve(ROOT, 'src/content/school/corpus.js');
const RAW = 'https://raw.githubusercontent.com/standardebooks';
const MIN_CHARS = 200;
// A marker attached to the word before it, or any [FN#n]; "[3553]" set
// after a space is a year in Vico's chronology, not a note.
const FOOTNOTE_MARKER = /\S\[(?:\d{1,4}|[A-Z]{1,2})\]|\[[A-Z]{1,2}\]\S|\[FN#?\d{1,4}\]|\[Footnote/u;
// A producer's credit opens a paragraph ("Produced by Works" opens a verse line in the Gita).
const LEFTOVER = /(?:^|\n\n)\s*produced by\b|transcriber['’]?s note/iu;

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
/** 1 -> 'I', 24 -> 'XXIV'. */
function roman(n) {
    return [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
        .reduce((out, [value, numeral]) => {
            while (n >= value) {
                out += numeral;
                n -= value;
            }
            return out;
        }, '');
}

const DIALOGUES = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];

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
    // The essay of 1863, then the three chapters of Erewhon it grew into.
    'mercury.book-of-the-machines': {
        artifacts: [
            {
                ebook: 3279,
                artifact: 'html',
                extract: { from: 'Darwin Among the Machines', to: 'Lucubratio Ebria' },
                units: [{ heading: 'Darwin Among the Machines' }]
            },
            {
                repo: 'samuel-butler_erewhon',
                units: [
                    { file: 'chapter-23.xhtml', name: 'The Book of the Machines I' },
                    { file: 'chapter-24.xhtml', name: 'The Book of the Machines II' },
                    { file: 'chapter-25.xhtml', name: 'The Book of the Machines III' }
                ]
            }
        ],
        count: 4,
        edition: {
            statement: '“Darwin Among the Machines” (The Press, Christchurch, 13 June 1863), from Canterbury Pieces, '
                + 'edited by R. A. Streatfeild, A. C. Fifield, London, 1914, via Project Gutenberg; '
                + 'Erewhon, revised edition, 1901, chapters XXIII to XXV, via Standard Ebooks',
            translator: null,
            year: null
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
    },
    // Project Gutenberg editions: `ebook` is the ebook number, `artifact`
    // the file read, and the units are the edition's own headings.
    'sun.fragments': {
        ebook: 67097,
        artifact: 'html',
        // The chapter divides itself by the marginal notes Burnet set beside
        // its numbered sections; the fragments are one of them.
        extract: { from: 'CHAPTER III HERAKLEITOS OF EPHESOS', to: 'CHAPTER IV PARMENIDES OF ELEA' },
        units: 'headings',
        level: 'div.sidenote',
        count: 21,
        edition: {
            statement: 'John Burnet, Early Greek Philosophy, second edition, Adam and Charles Black, London, 1908; chapter III, Herakleitos of Ephesos',
            translator: 'John Burnet',
            year: 1908
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'sun.ethics': {
        ebook: 3800,
        artifact: 'html',
        extract: { from: 'PART I. CONCERNING GOD.' },
        // "End of the Ethics by Benedict de Spinoza" is the transcriber's closing line.
        drop: 'p.finis',
        units: [
            { heading: 'PART I. CONCERNING GOD.', name: 'Part I: Concerning God' },
            { heading: 'PART II.', name: 'Part II: On the Nature and Origin of the Mind' },
            { heading: 'PART III.', name: 'Part III: On the Origin and Nature of the Emotions' },
            { heading: 'PART IV:', name: 'Part IV: Of Human Bondage, or the Strength of the Emotions' },
            { heading: 'PART V:', name: 'Part V: Of the Power of the Understanding, or of Human Freedom' }
        ],
        count: 5,
        edition: { statement: 'Translated from the Latin by R. H. M. Elwes', translator: 'R. H. M. Elwes', year: null },
        rights: { us: 'pd', life70: 'pd' }
    },
    'mercury.new-atlantis': {
        ebook: 2434,
        artifact: 'html',
        // The Introductory Note before it is an editor's, not Bacon's.
        extract: { from: 'THE NEW ATLANTIS', level: 3 },
        units: [{ heading: 'THE NEW ATLANTIS', level: 3, name: 'The New Atlantis' }],
        count: 1,
        edition: { statement: 'A modern-spelling text; the edition names no printing', translator: null, year: null },
        rights: { us: 'pd', life70: 'pd' }
    },
    'mercury.lovelace-notes': {
        ebook: 75107,
        artifact: 'html',
        extract: { from: 'ARTICLE XXIX.' },
        units: [
            { heading: 'ARTICLE XXIX.', name: 'Sketch of the Analytical Engine' },
            { heading: 'NOTES BY THE TRANSLATOR.', group: true },
            { heading: 'NOTE A.—Page 9.', name: 'Note A' },
            { heading: 'NOTE B.—Page 11.', name: 'Note B' },
            { heading: 'NOTE C.—Page 12.', name: 'Note C' },
            { heading: 'NOTE D.—Page 15.', name: 'Note D' },
            { heading: 'NOTE E.—Page 19.', name: 'Note E' },
            { heading: 'NOTE F.—Page 23.', name: 'Note F' },
            { heading: 'NOTE G.—Page 24.', name: 'Note G' }
        ],
        count: 8,
        edition: {
            statement: 'L. F. Menabrea’s memoir with notes by the translator, A. A. L.; extracted from Taylor’s Scientific Memoirs, vol. III, Richard and John E. Taylor, London, 1843; equations as text',
            translator: 'Ada Lovelace',
            year: 1843
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'moon.life-after-death': {
        ebook: 74480,
        artifact: 'html',
        // The publisher's advertisements follow chapter XII.
        extract: { from: 'INTRODUCTION', to: 'The World Beautiful' },
        units: 'headings',
        level: 2,
        count: 16,
        edition: {
            statement: 'Translated from the German by Mary C. Wadsworth, with an introduction by William James; Little, Brown, and Company, Boston, 1904',
            translator: 'Mary C. Wadsworth',
            year: 1904
        },
        rights: { us: 'pd', life70: 'unknown' }
    },
    'moon.stream-of-thought': {
        ebook: 57628,
        artifact: 'html',
        extract: { from: 'CHAPTER IX.', to: 'CHAPTER X.' },
        units: 'headings',
        level: 4,
        count: 8,
        edition: {
            statement: 'From The Principles of Psychology, vol. I, chapter IX; Henry Holt and Company, New York, 1918 printing',
            translator: null,
            year: 1918
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'moon.interpretation-of-dreams': {
        ebook: 66048,
        artifact: 'html',
        extract: { from: 'I THE SCIENTIFIC LITERATURE ON THE PROBLEMS OF THE DREAM', to: 'VIII LITERARY INDEX' },
        units: 'headings',
        level: 2,
        count: 7,
        edition: {
            statement: 'A. A. Brill, authorised translation of the third edition; The Macmillan Company, New York, 1913',
            translator: 'A. A. Brill',
            year: 1913
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'moon.human-personality': {
        ebook: 38492,
        artifact: 'html',
        // The appendices to the chapters are case records; the chapters are the book.
        extract: { from: 'CHAPTER I INTRODUCTION', to: 'APPENDICES TO CHAPTER II' },
        units: 'headings',
        level: 2,
        count: 10,
        edition: {
            statement: 'The 1906 abridgment, edited by his son, L. H. Myers; Longmans, Green and Co., new impression, 1918',
            translator: null,
            year: 1906
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'venus.hymns-to-the-night': {
        ebook: 8949,
        artifact: 'html',
        extract: { from: 'HYMNS TO THE NIGHT.', to: 'SPIRITUAL SONGS. I.' },
        units: [
            { heading: 'I.', name: 'Hymn I' },
            { heading: 'II.', name: 'Hymn II' },
            { heading: 'III.', name: 'Hymn III' },
            { heading: 'IV.', name: 'Hymn IV' },
            { heading: 'V.', name: 'Hymn V' },
            { heading: 'VI.', name: 'Hymn VI: Longing after Death' }
        ],
        count: 6,
        edition: {
            statement: 'George MacDonald, Rampolli, his translations from the German; the Hymns to the Night from Novalis',
            translator: 'George MacDonald',
            year: null
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'venus.defence-of-poetry': {
        ebook: 5428,
        artifact: 'html',
        extract: { from: 'A DEFENCE OF POETRY', to: 'THE END' },
        units: [{ heading: 'I', name: 'A Defence of Poetry' }],
        count: 1,
        edition: { statement: 'From A Defence of Poetry and Other Essays; the edition names no printing', translator: null, year: null },
        rights: { us: 'pd', life70: 'pd' }
    },
    'venus.spiritual-in-art': {
        ebook: 5321,
        artifact: 'html',
        extract: { from: 'PART 1: ABOUT GENERAL AESTHETIC' },
        // The edition sets its two Part banners and three figure captions at
        // the chapters' own level; the nine chapters are named.
        units: [
            { heading: 'PART 1: ABOUT GENERAL AESTHETIC', group: true },
            { heading: 'I. INTRODUCTION' },
            { heading: 'II. THE MOVEMENT OF THE TRIANGLE' },
            { heading: 'III. SPIRITUAL REVOLUTION' },
            { heading: 'IV. THE PYRAMID' },
            { heading: 'PART II: ABOUT PAINTING', group: true },
            { heading: 'V. THE PSYCHOLOGICAL WORKING OF COLOUR' },
            { heading: 'VI. THE LANGUAGE OF FORM AND COLOUR' },
            { heading: 'VII. THEORY' },
            { heading: 'VIII. ART AND ARTISTS' },
            { heading: 'IX. CONCLUSION' }
        ],
        count: 9,
        edition: { statement: 'Translated by Michael T. H. Sadler', translator: 'Michael T. H. Sadler', year: null },
        rights: { us: 'pd', life70: 'until:2028' }
    },
    'venus.faust': {
        ebook: 14591,
        artifact: 'html',
        extract: { from: 'DEDICATION' },
        verse: true,
        units: [
            { heading: 'DEDICATION', name: 'Dedication' },
            { heading: 'PRELUDE AT THE THEATRE', name: 'Prelude at the Theatre' },
            { heading: 'PROLOGUE IN HEAVEN', name: 'Prologue in Heaven' },
            { heading: 'FIRST PART OF THE TRAGEDY', group: true },
            ...[
                'Night', 'Before the City-Gate', 'The Study (The Exorcism)', 'The Study (The Compact)', 'Auerbach’s Cellar',
                'Witches’ Kitchen', 'A Street', 'Evening', 'Promenade', 'The Neighbor’s House', 'Street', 'Garden',
                'A Garden-Arbor', 'Forest and Cavern', 'Margaret’s Room', 'Martha’s Garden', 'At the Fountain',
                'Donjon (Margaret’s Prayer)', 'Night (Valentine’s Death)', 'Cathedral', 'Walpurgis-Night',
                'Oberon and Titania’s Golden Wedding', 'Dreary Day', 'Night', 'Dungeon'
            ].map((title, index) => ({ heading: roman(index + 1), name: `Scene ${roman(index + 1)}: ${title}` }))
        ],
        count: 28,
        edition: {
            statement: 'Bayard Taylor, translated in the original metres; an illustrated edition, The World Publishing Company; Part One; Part Two to follow',
            translator: 'Bayard Taylor',
            year: null
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'venus.biographia-literaria': {
        ebook: 6081,
        artifact: 'html',
        extract: { from: 'CHAPTER I', to: 'FOOTNOTES' },
        units: [
            ...Array.from({ length: 22 }, (_, index) => ({ heading: `CHAPTER ${roman(index + 1)}` })),
            { heading: 'SATYRANE’S LETTERS', name: 'Satyrane’s Letters' },
            { heading: 'CHAPTER XXIII' },
            { heading: 'CHAPTER XXIV', name: 'Chapter XXIV: Conclusion' }
        ],
        count: 25,
        edition: { statement: 'The edition names no printing', translator: null, year: null },
        rights: { us: 'pd', life70: 'pd' }
    },
    'venus.aesthetic-education': {
        ebook: 6798,
        artifact: 'html',
        // The Letters end where the edition's next section opens under its own banner.
        extract: { from: 'LETTERS ON THE AESTHETICAL EDUCATION OF MAN.', to: '=== AESTHETICAL ESSAYS.' },
        units: 'headings',
        level: 2,
        from: 'LETTER I.',
        count: 27,
        edition: {
            statement: 'From Aesthetical and Philosophical Essays, in an uncredited translation; the edition names neither translator nor printing',
            translator: null,
            year: null
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'mars.renaissance-in-italy': {
        ebook: 2074,
        artifact: 'html',
        extract: { from: 'PART I. THE STATE AS A WORK OF ART.', to: 'INDEX.' },
        units: 'headings',
        level: 3,
        group: 2,
        groupPrefix: true,
        count: 46,
        edition: {
            statement: 'S. G. C. Middlemore, authorised translation; George Allen & Unwin, London, and The Macmillan Company, New York',
            translator: 'S. G. C. Middlemore',
            year: null
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'mars.golden-bough': {
        ebook: 3623,
        artifact: 'html',
        extract: { from: 'Preface', level: 3 },
        units: 'headings',
        level: 3,
        count: 70,
        edition: { statement: 'The one-volume abridgement, its preface dated June 1922', translator: null, year: 1922 },
        rights: { us: 'pd', life70: 'pd' }
    },
    'mars.new-science': {
        ebook: 43307,
        artifact: 'html',
        // Each book is printed twice by name: over its Argument, and over its text.
        extract: { from: "PRINCIPES DE LA PHILOSOPHIE DE L'HISTOIRE.", to: 'Notes' },
        units: [
            { heading: 'LIVRE PREMIER. DES PRINCIPES.', nth: 1, name: 'Livre premier. Des principes' },
            { heading: 'LIVRE SECOND. DE LA SAGESSE POÉTIQUE.', nth: 1, name: 'Livre second. De la sagesse poétique' },
            { heading: 'LIVRE TROISIÈME. DÉCOUVERTE DU VÉRITABLE HOMÈRE.', nth: 1, name: 'Livre troisième. Découverte du véritable Homère' },
            { heading: "LIVRE QUATRIÈME. DU COURS QUE SUIT L'HISTOIRE DES NATIONS.", nth: 1, name: 'Livre quatrième. Du cours que suit l’histoire des nations' },
            {
                heading: 'LIVRE CINQUIÈME. RETOUR DES MÊMES RÉVOLUTIONS LORSQUE LES SOCIÉTÉS DÉTRUITES SE RELÈVENT DE LEURS RUINES.',
                nth: 1,
                name: 'Livre cinquième. Retour des mêmes révolutions lorsque les sociétés détruites se relèvent de leurs ruines'
            },
            { heading: 'ADDITION AU SECOND LIVRE.', name: 'Addition au second livre' }
        ],
        count: 6,
        edition: {
            statement: 'In French, from the Italian: Principes de la philosophie de l’histoire, traduits de la Scienza nuova, an abridged translation by Jules Michelet; Jules Renouard, Paris, 1827',
            translator: 'Jules Michelet',
            year: 1827
        },
        language: 'fr',
        rights: { us: 'pd', life70: 'pd' }
    },
    'mars.decline-of-the-west': {
        artifacts: [
            {
                ebook: 72344,
                artifact: 'html',
                prefix: 'Volume I',
                extract: { from: 'CHAPTER I INTRODUCTION', to: 'INDEX' },
                units: 'headings',
                level: 2
            },
            {
                ebook: 78914,
                artifact: 'html',
                prefix: 'Volume II',
                extract: { from: 'CHAPTER I ORIGIN AND LANDSCAPE (A) THE COSMIC AND THE MICROCOSM', to: 'INDEX' },
                units: 'headings',
                level: 2
            }
        ],
        count: 25,
        edition: {
            statement: 'Charles Francis Atkinson, authorised translation with notes: vol. I, Form and Actuality, George Allen & Unwin, London; vol. II, Perspectives of World-History, Alfred A. Knopf, New York, 1928',
            translator: 'Charles Francis Atkinson',
            year: 1928
        },
        rights: { us: 'pd', life70: 'until:2031' }
    },
    'jupiter.nature-of-things': {
        ebook: 785,
        artifact: 'html',
        extract: { from: 'BOOK I' },
        units: Array.from({ length: 6 }, (_, index) => ({ heading: `BOOK ${roman(index + 1)}`, verse: true })),
        count: 6,
        edition: { statement: 'A metrical translation by William Ellery Leonard', translator: 'William Ellery Leonard', year: null },
        rights: { us: 'pd', life70: 'pd' }
    },
    'jupiter.growth-and-form': {
        ebook: 55264,
        artifact: 'html',
        // The seventeen chapters and the Epilogue; the notes, index and
        // publisher's catalogue after them are not the book.
        extract: { from: 'CHAPTER I INTRODUCTORY', to: 'NOTES:' },
        units: 'headings',
        level: 2,
        // The headings run numeral and title together; their title attributes name them.
        nameFrom: 'title',
        count: 18,
        edition: { statement: 'Cambridge University Press, 1917; figures referenced as text', translator: null, year: 1917 },
        rights: { us: 'pd', life70: 'pd' }
    },
    // A transcription set as plain text in <p>s: its notes are paragraphs
    // opening "[footnote]" (and the transcriber's misspellings of it), its
    // page numbers lines of their own ("p 4"), its note markers asterisks,
    // and each of its source files opens with the transcriber's header.
    // "[Greek words]" is the edition's own marker and stays.
    'jupiter.cosmos': {
        ebook: 14565,
        artifact: 'html',
        // The translator's preface and Humboldt's summary of contents come before; the index after.
        extract: { from: 'REFLECTIONS ON THE DIFFERENT DEGREES OF ENJOYMENT PRESENTED TO US BY THE ASPECT OF NATURE AND THE STUDY OF HER LAWS.', to: 'INDEX TO VOL. I.' },
        dropBlocks: [
            // One note set without its label opens with its marker: "** (This word is written 'gaard' …) — Tr."
            { pattern: '^\\s*(?:\\[+(?:further )?(?:footnote|fotnote|footnonte|footnnote|fiitbite)(?: continue[sd])?[\\]\\[\']|\\*+\\s)', kind: 'footnotes' },
            { pattern: '^\\s*(?:This material taken from pages|This section from pp|COSMOS: A Sketch of the Physical Description of the Universe, Vol\\. 1\\s+by Alexander von Humboldt\\s*$|Translated by E C Otte\\s*$|from the 1858 Harper|\\[NB +Table will line up|p \\d+ is blank\\s*$)', kind: 'transcriber notes' },
            // The last words of p. 305, closing one of the transcriber's files and opening the next.
            { pattern: '^\\s*It is no slight\\s*$', kind: 'duplicated text' }
        ],
        strike: [
            { pattern: '\\[balance of p 305 is in file "09 Humboldt"\\]', kind: 'transcriber notes' },
            { pattern: '(?<=^|\\n)[ \\t]*p [0-9ivxlc]+[ \\t]*(?=\\n|$)', kind: 'page numbers' },
            { pattern: '(?<=^|\\n)[ \\t]*[—_-]{4,}[ \\t]*(?=\\n|$)', kind: 'rules' },
            // A marker set against the next word leaves a space; one before punctuation or a line's end, nothing.
            { pattern: '\\*+(?=[\\p{L}\\d(])', kind: 'footnote markers' },
            { pattern: '\\*+', kind: 'footnote markers', replace: '' }
        ],
        units: [
            { heading: 'REFLECTIONS ON THE DIFFERENT DEGREES OF ENJOYMENT PRESENTED TO US BY THE ASPECT OF NATURE AND THE STUDY OF HER LAWS.' },
            { heading: 'LIMITS AND METHOD OF EXPOSITION OF THE PHYSICAL DESCRIPTION OF THE UNIVERSE.' },
            { heading: 'COSMOS.', name: 'Delineation of Nature: General Review of Natural Phenomena' },
            { heading: 'ADDITIONAL NOTES', name: 'Additional Notes to the Present Edition, March 1849' }
        ],
        count: 4,
        edition: {
            statement: 'E. C. Otté, vol. 1, from the Harper & Brothers edition, New York, 1858; vols. 2–5 to follow',
            translator: 'E. C. Otté',
            year: 1858
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'jupiter.relativity': {
        ebook: 30155,
        artifact: 'html',
        extract: { from: 'PREFACE' },
        units: 'headings',
        level: 3,
        groups: [
            'PART I: THE SPECIAL THEORY OF RELATIVITY', 'PART II: THE GENERAL THEORY OF RELATIVITY',
            'PART III: CONSIDERATIONS ON THE UNIVERSE AS A WHOLE', 'APPENDICES'
        ],
        count: 37,
        edition: {
            statement: 'Robert W. Lawson, authorised translation; the revised edition of 1924; equations as text',
            translator: 'Robert W. Lawson',
            year: 1924
        },
        rights: { us: 'pd', life70: 'until:2031' }
    },
    'saturn.zhuangzi': {
        ebook: 59709,
        artifact: 'html',
        // Canon Moore's essay and Giles's introduction stand before chapter I.
        extract: { from: 'CHAPTER I.', to: 'INDEX' },
        units: 'headings',
        level: 2,
        subtitle: 'p.ph3',
        count: 33,
        edition: {
            statement: 'Herbert A. Giles, Chuang Tzŭ: Mystic, Moralist, and Social Reformer; Bernard Quaritch, London, 1889',
            translator: 'Herbert A. Giles',
            year: 1889
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'saturn.bhagavad-gita': {
        ebook: 2388,
        artifact: 'html',
        extract: { from: 'CHAPTER I' },
        units: 'headings',
        level: 3,
        verse: true,
        count: 18,
        edition: {
            statement: 'Sir Edwin Arnold, The Song Celestial; Truslove, Hanson & Comba, New York, 1900',
            translator: 'Edwin Arnold',
            year: 1900
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'saturn.heroic-frenzies': {
        artifacts: [
            {
                ebook: 19817,
                artifact: 'html',
                prefix: 'Part I',
                // The dialogues open on a bold line, not a heading; their
                // anchors name them. The Apology closes the First Part after
                // the printer's colophon.
                headings: `${DIALOGUES.map(nth => `a#${nth}`).join(', ')}, p.center > strong`,
                drop: 'p.style1',
                extract: { from: 'HEROIC ENTHUSIASTS.', level: 2, to: 'Transcribers Notes:' },
                units: [
                    ...DIALOGUES.map(nth => ({ heading: `${nth} Dialogue.`, name: `${nth} Dialogue` })),
                    { heading: 'THE APOLOGY OF THE NOLAN', name: 'The Apology of the Nolan' }
                ]
            },
            {
                ebook: 19833,
                artifact: 'html',
                prefix: 'Part II',
                headings: DIALOGUES.map(nth => `a#${nth}`).join(', '),
                extract: { from: 'HEROIC ENTHUSIASTS.', level: 1, to: "Transcriber's Notes:" },
                // The Second Part prints its second dialogue's title without a stop.
                units: DIALOGUES.map(nth => ({ heading: nth === 'Second' ? `${nth} Dialogue` : `${nth} Dialogue.`, name: `${nth} Dialogue` }))
            }
        ],
        count: 11,
        edition: {
            statement: 'L. Williams: Part the First, George Redway, London, 1887; Part the Second, Bernard Quaritch, London, 1889',
            translator: 'L. Williams',
            year: 1887
        },
        rights: { us: 'pd', life70: 'unknown' }
    },
    // Wikisource, CCEL, sacred-texts, EEBO-TCP, plain HTML and local files.
    ...WEB_RECIPES
});

const parse = markup => new JSDOM(markup, { contentType: 'text/html' }).window.document;
const parseXml = markup => new JSDOM(markup, { contentType: 'application/xml' }).window.document;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/**
 * A file from the cache, or from the first of `urls` that serves it; with
 * the URL that served it (null when cached before) and its sha256.
 */
async function fetchCached(kind, name, urls, { headers = {}, curl = false } = {}) {
    const dir = resolve(ROOT, '.ingest-cache', kind);
    mkdirSync(dir, { recursive: true });
    const cached = resolve(dir, name.replace(/[^A-Za-z0-9._-]+/gu, '_'));
    let served = null;
    if (!existsSync(cached)) {
        const refusals = [];
        for (const url of urls) {
            process.stderr.write(`fetching ${url}\n`);
            const response = curl ? curlGet(url) : await fetch(url, { headers: { 'User-Agent': BROWSER, ...headers }, redirect: 'manual' });
            if (response.status === 200) {
                writeFileSync(cached, curl ? response.body : Buffer.from(await response.arrayBuffer()));
                writeFileSync(`${cached}.url`, url);
                served = url;
                break;
            }
            refusals.push(`${url}: HTTP ${response.status}`);
        }
        if (!served) throw new Error(`${kind} ${name}: no URL served it (${refusals.join('; ')})`);
    }
    const bytes = readFileSync(cached);
    return { text: bytes.toString('utf8'), bytes, sha256: sha256(bytes), served: served ?? readFileSync(`${cached}.url`, 'utf8') };
}

/**
 * A GET through curl, for a host whose bot challenge refuses Node's own
 * client: redirects are not followed (a page that moved is not the page
 * asked for), except the Wayback Machine's to its nearest capture.
 */
function curlGet(url) {
    const out = resolve(ROOT, '.ingest-cache', 'curl.tmp');
    const follow = url.startsWith('https://web.archive.org/') ? ['-L'] : [];
    const status = execFileSync('curl', ['-s', '-A', BROWSER, ...follow, '-o', out, '-w', '%{http_code}', url], { encoding: 'utf8' });
    return { status: Number(status), body: existsSync(out) ? readFileSync(out) : Buffer.alloc(0) };
}

const WIKISOURCE_API = 'https://en.wikisource.org/w/api.php?action=parse&prop=text%7Crevid&format=json&formatversion=2&redirects=1&page=';

/** Each source kind: what it fetches, as `{ texts, files, url, sha256 }`, and the reader that reads it. */
const SOURCES = {
    wikisource: {
        async fetch(artifact) {
            const pages = [];
            for (const title of artifact.pages) {
                const file = await fetchCached('wikisource', `${title}.json`, [`${WIKISOURCE_API}${encodeURIComponent(title)}`],
                    { headers: { 'User-Agent': 'RISE school ingest (https://github.com/sykosyber)' } });
                const page = JSON.parse(file.text);
                if (page.error) throw new Error(`Wikisource ${title}: ${page.error.info}`);
                pages.push({ ...file, html: page.parse.text, title, revid: page.parse.revid });
            }
            return {
                texts: pages.map(page => page.html),
                files: pages.map(page => `${page.title} rev ${page.revid} ${page.sha256}`),
                url: `https://en.wikisource.org/wiki/${encodeURI(artifact.pages[0].split('/')[0].replace(/ /gu, '_'))}`,
                sha256: sha256(pages.map(page => page.sha256).join('\n'))
            };
        },
        read: (texts, artifact) => readWikisource(texts, parse, artifact)
    },
    'sacred-texts': {
        async fetch(artifact) {
            const pages = [];
            for (const page of artifact.pages) {
                const path = `${artifact.base}/${page}`;
                // The site sits behind a bot challenge and now redirects its
                // old pages; its own archive host, then the Wayback Machine,
                // serve the same pages.
                pages.push({ page, ...await fetchCached('sacred-texts', path, [
                    `https://sacred-texts.com/${path}`,
                    `https://archive.sacred-texts.com/${path}`,
                    `https://web.archive.org/web/2024id_/https://sacred-texts.com/${path}`
                ], { curl: true }) });
            }
            const hosts = [...new Set(pages.map(page => new URL(page.served).origin))];
            return {
                texts: pages.map(page => page.text),
                files: pages.map(page => `${page.served} ${page.sha256}`),
                url: `https://sacred-texts.com/${artifact.base}/index.htm`,
                sha256: sha256(pages.map(page => page.sha256).join('\n')),
                extra: { served: hosts.join(', ') }
            };
        },
        read: (texts, artifact) => readSacredTexts(texts, parse, artifact)
    },
    ccel: {
        async fetch(artifact) {
            const name = artifact.work.split('/').pop();
            const url = `https://ccel.org/ccel/${artifact.work}/cache/${name}.txt`;
            const file = await fetchCached('ccel', `${artifact.work}.txt`, [url]);
            return { texts: [file.text], files: [`${url} ${file.sha256}`], url: `https://ccel.org/ccel/${artifact.work}`, sha256: file.sha256 };
        },
        read: ([text], artifact) => readCcel(text, parse, artifact)
    },
    'eebo-tcp': {
        async fetch(artifact) {
            const url = `https://raw.githubusercontent.com/textcreationpartnership/${artifact.tcp}/master/${artifact.tcp}.xml`;
            const file = await fetchCached('eebo-tcp', `${artifact.tcp}.xml`, [url]);
            return {
                texts: [file.text], files: [`${url} ${file.sha256}`], url: `https://github.com/textcreationpartnership/${artifact.tcp}`,
                sha256: file.sha256, rightsNote: teiAvailability(file.text, parseXml)
            };
        },
        read: ([text], artifact) => readTei(text, parseXml, parse, artifact)
    },
    html: {
        async fetch(artifact) {
            const pages = [];
            for (const url of artifact.pages) pages.push({ url, ...await fetchCached('html', url.replace(/^https?:\/\//u, ''), [url]) });
            // A site that still serves Latin-1 or Windows-1252 names its encoding in the recipe.
            const decoder = new TextDecoder(artifact.encoding ?? 'utf-8');
            return {
                texts: pages.map(page => decoder.decode(page.bytes)),
                files: pages.map(page => `${page.url} ${page.sha256}`),
                url: artifact.url,
                sha256: sha256(pages.map(page => page.sha256).join('\n'))
            };
        },
        read: (texts, artifact) => readHtml(texts, parse, artifact)
    },
    file: {
        async fetch(artifact) {
            const bytes = readFileSync(resolve(ROOT, artifact.path));
            return { texts: [bytes.toString('utf8')], files: [`${artifact.path} ${sha256(bytes)}`], url: artifact.path, sha256: sha256(bytes) };
        },
        read: ([text], artifact) => readFile(text, parse, artifact)
    }
};

/**
 * An artifact of any kind but Standard Ebooks and Gutenberg, read by its
 * kind's reader: its pages as one document, or (`units: 'page'`) each page
 * one unit named from `names`.
 */
async function sourceUnits(artifact, ledger) {
    const source = SOURCES[artifact.kind];
    if (!source) throw new Error(`no reader for source kind ${JSON.stringify(artifact.kind)}`);
    const fetched = await source.fetch(artifact);
    const reads = artifact.units === 'page'
        ? fetched.texts.map((text, index) => source.read([text], { ...artifact, units: 'whole', name: artifact.names?.[index] ?? 'continued' }))
        : [source.read(fetched.texts, artifact)];
    const parts = [];
    reads.forEach((read, index) => {
        ledger.count(`${artifact.kind}${reads.length > 1 ? ` page ${index + 1}` : ''}`, read);
        for (const [kind, count] of Object.entries(read.dropped)) ledger.dropped[kind] = (ledger.dropped[kind] || 0) + count;
        ledger.groups.push(...read.groups);
        // A page named null carries on the unit the page before it opened (a chapter too short to stand alone).
        if (artifact.units === 'page' && artifact.names?.[index] === null) {
            const last = parts[parts.length - 1];
            last.content = `${last.content}\n\n${read.parts[0].content}`;
            last.lines += read.parts[0].lines;
        } else {
            parts.push(...read.parts);
        }
    });
    ledger.files.push(...fetched.files);
    const total = reads.reduce((sum, read) => sum + read.sourceWords, 0);
    console.log(`  ${artifact.kind}: ${total} words in the span, ${reads.reduce((sum, read) => sum + read.importedWords, 0)} out`);
    return {
        parts: parts.map(part => ({ ...part, name: artifact.prefix ? `${artifact.prefix} · ${part.name}` : part.name })),
        source: {
            kind: artifact.kind, url: fetched.url, sha256: fetched.sha256, ...fetched.extra,
            ...(artifact.note ? { note: artifact.note } : {})
        },
        rightsNote: fetched.rightsNote
    };
}
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
        const leftover = FOOTNOTE_MARKER.exec(part.content) ?? LEFTOVER.exec(part.content);
        if (leftover) {
            const around = part.content.slice(Math.max(0, leftover.index - 40), leftover.index + 40).replace(/\s+/gu, ' ');
            failures.push(`"${part.name}" carries a footnote marker or a producer's note: …${around}…`);
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
    let rights = recipe.rights;
    for (const artifact of recipe.artifacts ?? [recipe]) {
        const read = artifact.ebook ? await gutenbergUnits(artifact, ledger)
            : artifact.repo ? await standardEbooksUnits(artifact, ledger)
                : await sourceUnits(artifact, ledger);
        parts.push(...read.parts);
        sources.push({ ...read.source, retrieved });
        // A TEI transcription's licence is the one its header states.
        if (read.rightsNote) rights = { ...rights, note: read.rightsNote };
    }

    for (const part of parts) {
        console.log(`  ${part.verse ? 'verse' : 'prose'} ${String(part.content.length).padStart(8)}  ${part.name}${part.sourceTitle && part.sourceTitle !== part.name ? `  [${part.sourceTitle}]` : ''}`);
        // --show prints how each unit opens and closes, for reading a recipe against its source.
        if (process.argv.includes('--show')) console.log(`      ${JSON.stringify(part.content.slice(0, 160))} … ${JSON.stringify(part.content.slice(-100))}`);
    }
    gate(id, recipe, parts, ledger);

    const sections = sectionsFromParts(parts);
    const checksum = `sha256:${sha256(JSON.stringify(sections))}`;
    // The first edition read is the work's source; a work read from more
    // than one names every one of them, in reading order.
    const source = sources.length > 1 ? { ...sources[0], artifacts: sources } : sources[0];
    const entry = {
        id, constName: constName(id), checksum, units: sections.length,
        edition: recipe.edition, source, rights,
        // A work not in English names its language; a note says what a reader should know of the text as served.
        ...(recipe.language ? { language: recipe.language } : {}),
        ...(recipe.textNote ? { note: recipe.textNote } : {})
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
        rights,
        ...(recipe.language ? { language: recipe.language } : {}),
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
        const editions = (recipe.artifacts ?? [recipe]).map(artifact => artifact.repo ?? (artifact.ebook ? `pg${artifact.ebook}` : artifact.kind)).join(' + ');
        console.log(`${id.padEnd(40)} ${editions}  (${written})`);
    }
} else {
    for (const id of args.includes('--all') ? Object.keys(RECIPES) : targets) {
        await ingest(id, { dryRun });
    }
}
