/**
 * The School recipes read from Wikisource, CCEL, sacred-texts.com, EEBO-TCP,
 * plain HTML pages and local files (scripts/school-sources/). The grammar is
 * scripts/school-ingest.mjs's; each source kind's reader is in
 * src/content/school/. Imported only by scripts/school-ingest.mjs.
 */

/** 1 -> 'I', 24 -> 'XXIV'. */
function roman(n) {
    return [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
        .reduce((out, [value, numeral]) => {
            while (n >= value) {
                out += numeral;
                n -= value;
            }
            return out;
        }, '');
}

/** Page files `<prefix>NNN.htm` from `from` to `to`, inclusive, numbered to `width` digits. */
function pages(prefix, from, to, width = 3, except = []) {
    return Array.from({ length: to - from + 1 }, (_, index) => from + index)
        .filter(n => !except.includes(n))
        .map(n => `${prefix}${String(n).padStart(width, '0')}.htm`);
}

/** The Enneads' volumes in MacKenna's edition, by Ennead. */
const VOLUME = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 4, 6: 5 };
/** [Ennead, tractate, title as the tractate's own page sets it]. */
const ENNEADS = [
    'The Animate and the Man', 'On Virtue', 'On Dialectic (The Upward Way)', 'On True Happiness', 'Happiness and Extension of Time',
    'Beauty', 'On the Primal Good and Secondary Forms of Good', 'On the Nature and Source of Evil', 'The Reasoned Dismissal',
    'On the Kosmos or on the Heavenly System', 'The Heavenly Circuit', 'Are the Stars Causes?', 'Matter in its Two Kinds',
    'On Potentiality and Actuality', 'Quality and Form-Idea', 'On Complete Transfusion', 'Why Distant Objects Appear Small',
    'Against Those that Affirm the Creator of the Kosmos and the Kosmos Itself to be Evil',
    'Fate', 'Providence: First Treatise', 'On Providence: Second Treatise', 'Our Tutelary Spirit', 'On Love',
    'The Impassivity of the Unembodied', 'Time and Eternity', 'Nature Contemplation and the One', 'Detached Considerations',
    'On the Essence of the Soul (I)', 'On the Essence of the Soul (II)', 'Problems of the Soul (I)', 'Problems of the Soul (II)',
    'Problems of the Soul (III)', 'Perception and Memory', 'The Immortality of the Soul', 'The Soul’s Descent into Body', 'Are All Souls One?',
    'The Three Initial Hypostases', 'The Origin and Order of the Beings following on the First', 'The Knowing Hypostases and the Transcendent',
    'How the Secondaries rise from The First: and on The One',
    'That the Intellectual Beings are not outside the Intellectual-Principle, and on the Nature of the Good',
    'That the Principle transcending Being has no Intellectual Act', 'Is there an Ideal Archetype of Particular Beings?',
    'On the Intellectual Beauty', 'The Intellectual-Principle, the Ideas and the Authentic Existence',
    'On the Kinds of Being: First Treatise', 'On the Kinds of Being: Second Treatise', 'On the Kinds of Being: Third Treatise',
    'On the Integral Omnipresence of the Authentic Existent (1)', 'On the Integral Omnipresence of the Authentic Existent (2)',
    'On Numbers', 'How the Multiplicity of the Ideal-Forms came into Being, and Upon the Good', 'On Free-Will and the Will of The One',
    'On The Good, or The One'
].map((title, index) => [Math.floor(index / 9) + 1, (index % 9) + 1, title]);

/** The four functions Jung's chapter X heads once under each type: the first is the extravert's, the second the introvert's. */
const SHARED = ['Thinking', 'Feeling', 'Sensation', 'Intuition'];

/** J. B. Hare's request, made on every sacred-texts.com etext, kept with the source and never in the text. */
const SACRED_TEXTS_NOTE = 'Transcribed by J. B. Hare for the Internet Sacred Text Archive (sacred-texts.com), which asks that its etexts be attributed to it and that this notice be kept with them.';

export const WEB_RECIPES = {
    // A picture work: its units are the plates of a pinned plate catalog, and its imagery is that catalog.
    'jupiter.art-forms-in-nature': {
        kind: 'commons-plates',
        path: 'src/sources/visual/haeckel-catalog.generated.json',
        book: 'Kunstformen der Natur',
        year: 1904,
        imagery: 'haeckel:plates',
        count: 100,
        language: 'de',
        edition: {
            statement: 'Bibliographisches Institut, Leipzig and Vienna, 1904; 100 plates; captions from Wikimedia Commons',
            translator: null,
            year: 1904
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    // Local files under scripts/school-sources/<id>/.
    // RISE's English first, the Latin it was made from after it, paragraph for paragraph.
    'gate.oration': {
        artifacts: ['oratio.en.md', 'oratio.la.md'].map((file, index) => ({
            kind: 'file',
            path: `scripts/school-sources/gate.oration/${file}`,
            extract: { from: '§ 1' },
            units: 'headings',
            level: 2,
            // The Pico Project's running sentence numbers are for reference, not for reading aloud.
            strike: { pattern: '(?<=^|\\s)\\d{1,3}\\.\\s', kind: 'sentence numbers' },
            ...(index ? { prefix: 'Latin' } : {})
        })),
        count: 94,
        translation: 'RISE translation, English draft, Latin beside it',
        edition: {
            statement: 'English: RISE translation from the Latin, 2026, CC BY 4.0; a first draft made by a model from the Latin alone, '
                + 'not yet read against it by a person (notes on uncertain readings are in the source folder). '
                + 'Latin: the Pico Project text, 1486.',
            translator: 'RISE',
            year: 2026
        },
        // Pico's Latin is public domain; the translation is RISE's, under CC BY 4.0.
        rights: { us: 'pd', life70: 'pd', note: 'English CC BY 4.0, RISE 2026' }
    },
    'saturn.emerald-tablet': {
        kind: 'file',
        path: 'scripts/school-sources/saturn.emerald-tablet/newton-emerald-tablet.md',
        extract: { from: 'Tabula Smaragdina Hermetis Trismegistri Philosophorum patris' },
        units: 'whole',
        name: 'The Emerald Tablet',
        count: 1,
        edition: {
            statement: 'Isaac Newton’s English translation, Keynes MS. 28, ff. 2r–2v (King’s College, Cambridge), re-keyed from the manuscript text for RISE',
            translator: 'Isaac Newton',
            year: null
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    // Proofed from Internet Archive OCR: the OCR, the diff and the provenance sit beside the file.
    'mercury.philosophie-der-technik': {
        kind: 'file',
        path: 'scripts/school-sources/mercury.philosophie-der-technik/grundlinien.proofed.md',
        extract: { from: 'Vorwort' },
        units: 'headings',
        level: 2,
        count: 4,
        language: 'de',
        edition: {
            statement: 'Westermann, Braunschweig, 1877; selection: the Vorwort and chapters I to III (Der anthropologische Maassstab, Die Organprojection, Die ersten Werkzeuge); Internet Archive 11379066bsb (Bayerische Staatsbibliothek), proofed from the Internet Archive scan by RISE, 2026, diff on file',
            translator: null,
            year: 1877
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'mars.muqaddimah': {
        kind: 'file',
        path: 'scripts/school-sources/mars.muqaddimah/prolegomenes.proofed.md',
        extract: { from: 'Livre premier' },
        units: 'headings',
        level: 2,
        group: 1,
        count: 19,
        language: 'fr',
        edition: {
            statement: 'W. MacGuckin de Slane, Prolégomènes, Imprimerie impériale, 1863; vol. I selection: the opening of Book I, the first preliminary discourse, and the second section to “L’esprit de corps aboutit à l’acquisition de la souveraineté”; Internet Archive lesprolgomne01abdauoft, proofed from the Internet Archive scan by RISE, 2026, diff on file',
            translator: 'W. MacGuckin de Slane',
            year: 1863
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    // Converted from Project Gutenberg's LaTeX (PG 15114) by scripts/school-latex.mjs.
    'mercury.laws-of-thought': {
        kind: 'file',
        path: 'scripts/school-sources/mercury.laws-of-thought/laws-of-thought.md',
        extract: { from: 'Chapter I: Nature and Design of This Work' },
        units: 'headings',
        level: 2,
        count: 22,
        textNote: 'equations shown as text',
        edition: { statement: 'Walton and Maberly, 1854; equations shown as text', translator: null, year: 1854 },
        rights: { us: 'pd', life70: 'pd' }
    },
    // Proofed from the Internet Archive's OCR of the Journal of Botany, 1863; the diff beside it lists every change.
    'jupiter.metamorphosis-of-plants': {
        kind: 'file',
        path: 'scripts/school-sources/jupiter.metamorphosis-of-plants/metamorphosis.proofed.md',
        extract: { from: 'Introduction' },
        units: 'headings',
        level: 2,
        count: 19,
        edition: {
            statement: 'Emily M. Cox, Journal of Botany, 1863; proofed from the Internet Archive scan by RISE, 2026, diff on file',
            translator: 'Emily M. Cox',
            year: 1863
        },
        // Cox's dates are not known.
        rights: { us: 'pd', life70: 'unknown' }
    },

    // Wikisource: the MediaWiki API's parsed HTML of each page.
    'sun.monadology': {
        kind: 'wikisource',
        pages: ['Monadology (Leibniz, tr. Latta)'],
        // Most of the ninety sections are a sentence or two, under the
        // minimum a unit must hold; they are read ten at a time.
        units: 'numbered',
        every: 10,
        count: 9,
        edition: {
            statement: 'Robert Latta, The Monadology and Other Philosophical Writings, Oxford, 1898; the ninety sections, read ten at a time',
            translator: 'Robert Latta',
            year: 1898
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'sun.nature': {
        kind: 'wikisource',
        pages: ['Nature (1836)/Introduction', ...Array.from({ length: 8 }, (_, index) => `Nature (1836)/Chapter ${index + 1}`)],
        units: 'page',
        names: ['Introduction', 'Chapter I: Nature', 'Chapter II: Commodity', 'Chapter III: Beauty', 'Chapter IV: Language',
            'Chapter V: Discipline', 'Chapter VI: Idealism', 'Chapter VII: Spirit', 'Chapter VIII: Prospects'],
        count: 9,
        edition: { statement: 'James Munroe and Company, Boston, 1836', translator: null, year: 1836 },
        rights: { us: 'pd', life70: 'pd' }
    },
    'sun.enneads': {
        kind: 'wikisource',
        pages: ENNEADS.map(([ennead, tractate]) => `Plotinus (MacKenna)/Volume ${VOLUME[ennead]}/Ennead ${ennead}.${tractate}`),
        units: 'page',
        names: ENNEADS.map(([ennead, tractate, title]) => `${roman(ennead)}.${tractate}: ${title}`),
        count: 54,
        edition: {
            statement: 'Stephen MacKenna, Plotinus, five volumes, Philip Lee Warner and the Medici Society, London, 1917 to 1930 (the fifth with B. S. Page); the fifty-four tractates',
            translator: 'Stephen MacKenna',
            year: 1917
        },
        rights: { us: 'pd', life70: 'unknown' }
    },
    'mercury.on-governors': {
        kind: 'wikisource',
        pages: ['On Governors'],
        // The paper's own title and its section heads, set centred.
        headings: 'div.wst-center',
        units: [
            { heading: 'ON GOVERNORS', name: 'On Governors' },
            { heading: 'Distinction between Moderators and Governors.' },
            { heading: 'General Theory of Chronometric Centrifugal Pieces.' },
            { heading: 'On the Motion of a Liquid in a Tube revolving about a Vertical Axis.' },
            { heading: 'Theory of Differential Gearing.' }
        ],
        count: 5,
        textNote: 'equations as transcribed; to be re-set',
        edition: {
            statement: 'Proceedings of the Royal Society, No. 100, 1868; equations as Wikisource transcribed them, to be re-set from the scan',
            translator: null,
            year: 1868
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'mercury.increasing-human-energy': {
        kind: 'wikisource',
        pages: ['The Problem of Increasing Human Energy'],
        // The section heads are paragraphs set in capitals; the units are those the article prints.
        headings: 'p',
        units: [
            'THE ONWARD MOVEMENT OF MAN—THE ENERGY OF THE MOVEMENT—THE THREE WAYS OF INCREASING HUMAN ENERGY.',
            'THE FIRST PROBLEM: HOW TO INCREASE THE HUMAN MASS—THE BURNING OF ATMOSPHERIC NITROGEN.',
            'THE SECOND PROBLEM: HOW TO REDUCE THE FORCE RETARDING THE HUMAN MASS—THE ART OF TELAUTOMATICS.',
            'THE THIRD PROBLEM: HOW TO INCREASE THE FORCE ACCELERATING THE HUMAN MASS—THE HARNESSING OF THE SUN\'S ENERGY.',
            'THE SOURCE OF HUMAN ENERGY—THE THREE WAYS OF DRAWING ENERGY FROM THE SUN.',
            'GREAT POSSIBILITIES OFFERED BY IRON FOR INCREASING HUMAN PERFORMANCE—ENORMOUS WASTE IN IRON MANUFACTURE.',
            'ECONOMICAL PRODUCTION OF IRON BY A NEW PROCESS.',
            'THE COMING OF AGE OF ALUMINIUM—DOOM OF THE COPPER INDUSTRY—THE GREAT CIVILIZING POTENCY OF THE NEW METAL.',
            'EFFORTS TOWARD OBTAINING MORE ENERGY FROM COAL—THE ELECTRIC TRANSMISSION—THE GAS-ENGINE—THE COLD-COAL BATTERY.',
            'ENERGY FROM THE MEDIUM—THE WINDMILL AND THE SOLAR ENGINE,—MOTIVE POWER FROM TERRESTRIAL HEAT—ELECTRICITY FROM NATURAL SOURCES.',
            'A DEPARTURE FROM KNOWN METHODS—POSSIBILITY OF A "SELF-ACTING" ENGINE OR MACHINE, INANIMATE, YET CAPABLE, LIKE A LIVING BEING, OF DERIVING ENERGY FROM THE MEDIUM—THE IDEAL WAY OF OBTAINING MOTIVE POWER.',
            'FIRST EFFORTS TO PRODUCE THE SELF-ACTING ENGINE—THE MECHANICAL OSCILLATOR—WORK OF DEWAR AND LINDE—LIQUID AIR.',
            'DISCOVERY OF UNEXPECTED PROPERTIES OF THE ATMOSPHERE—STRANGE EXPERIMENTS—TRANSMISSION OF ELECTRICAL ENERGY THROUGH ONE WIRE WITHOUT RETURN—TRANSMISSION THROUGH THE EARTH WITHOUT ANY WIRE.',
            '"WIRELESS" TELEGRAPHY—THE SECRET OF TUNING—ERRORS IN THE HERTZIAN INVESTIGATIONS—A RECEIVER OF WONDERFUL SENSITIVENESS.',
            'DEVELOPMENT OF A NEW PRINCIPLE—THE ELECTRICAL OSCILLATOR—PRODUCTION OF IMMENSE ELECTRICAL MOVEMENTS—THE EARTH RESPONDS TO MAN—INTERPLANETARY COMMUNICATION NOW PROBABLE.',
            'TRANSMISSION OF ELECTRICAL ENERGY TO ANY DISTANCE WITHOUT WIRES—NOW PRACTICABLE—THE BEST MEANS OF INCREASING THE FORCE ACCELERATING THE HUMAN MASS.'
        ].map(heading => (heading.startsWith('THE THIRD PROBLEM')
            ? { heading, name: 'The Third Problem: How to Increase the Force Accelerating the Human Mass—The Harnessing of the Sun’s Energy' }
            : { heading })),
        count: 16,
        edition: { statement: 'The Century Illustrated Monthly Magazine, June 1900; figure captions kept as text', translator: null, year: 1900 },
        rights: { us: 'pd', life70: 'pd' }
    },
    'moon.matter-and-memory': {
        kind: 'wikisource',
        pages: ['Introduction', 'Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4', 'Summary and Conclusion'].map(page => `Matter and Memory/${page}`),
        units: 'page',
        names: ['Introduction', 'Chapter I', 'Chapter II', 'Chapter III', 'Chapter IV', 'Summary and Conclusion'],
        // The translators' marginal summaries float beside the text and would run into its sentences.
        drop: 'span[style*="float:left"], span[style*="float:right"]',
        count: 6,
        edition: {
            statement: 'Nancy Margaret Paul and W. Scott Palmer, authorised translation; Swan Sonnenschein, London, and Macmillan, New York, 1911',
            translator: 'Nancy Margaret Paul and W. Scott Palmer',
            year: 1911
        },
        rights: { us: 'pd', life70: 'unknown' }
    },
    'venus.marriage-of-heaven-and-hell': {
        kind: 'wikisource',
        pages: ['The Marriage of Heaven and Hell'],
        // Blake's own section heads, set centred over the plates.
        headings: 'div.wst-center',
        units: [
            { heading: 'The Argument.', name: 'The Argument' },
            { heading: 'The voice of the Devil', name: 'The Voice of the Devil' },
            { heading: 'A Memorable Fancy.', name: 'A Memorable Fancy (I)' },
            { heading: 'Proverbs of Hell' },
            ...[2, 3, 4, 5].map((n, index) => ({ heading: 'A Memorable Fancy', nth: index + 1, name: `A Memorable Fancy (${roman(n)})` })),
            { heading: 'A Song of Liberty' }
        ],
        count: 9,
        edition: { statement: 'Blake’s illuminated book, c. 1790–93, transcribed from Copy D; verse as the plates set it', translator: null, year: 1793 },
        rights: { us: 'pd', life70: 'pd' }
    },
    // CCEL: the plain-text file, cut to the work.
    'saturn.cloud-of-unknowing': {
        kind: 'ccel',
        work: 'anonymous2/cloud',
        // Underhill's introduction and glossary stand before the Prayer; CCEL's indexes after the end.
        extract: { from: 'Here Beginneth the Prayer on the Prologue', to: 'Indexes' },
        cut: [{ from: 'Here Beginneth a Table of the Chapters', to: 'AND HERE ENDETH THE TABLE OF THE CHAPTERS' }],
        levels: { 2: '^(?:Here Beginneth the Prayer on the Prologue|HERE BEGINNETH THE .* CHAPTER)$' },
        units: 'headings',
        level: 2,
        retitle: { pattern: '^Here Beginneth the ', to: '' },
        count: 76,
        edition: {
            statement: 'Evelyn Underhill’s edition from the British Museum MS. Harl. 674, second edition, John M. Watkins, London, 1922; the Prayer and Prologue, then the seventy-five chapters',
            translator: 'Evelyn Underhill',
            year: 1922
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'saturn.interior-castle': {
        kind: 'ccel',
        work: 'teresa/castle2',
        extract: { from: 'IHS', to: 'INDEX' },
        cut: [{ from: 'INTRODUCTORY NOTE TO CHAPTER III.', before: 'CHAPTER III.' }],
        levels: { 2: '^THE (?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH) MANSIONS$', 3: '^(?:IHS|CHAPTER [IVXL]+\\.|ONLY CHAPTER)$' },
        units: [
            { heading: 'IHS', nth: 1, name: 'Prologue' },
            ...[['FIRST', 2], ['SECOND', 0], ['THIRD', 2], ['FOURTH', 3], ['FIFTH', 4], ['SIXTH', 11], ['SEVENTH', 4]].flatMap(([nth, chapters], mansion, all) => {
                const before = all.slice(0, mansion).reduce((sum, [, count]) => sum + count, 0);
                const name = `The ${nth[0]}${nth.slice(1).toLowerCase()} Mansions`;
                return [
                    { heading: `THE ${nth} MANSIONS`, group: true },
                    ...(chapters ? Array.from({ length: chapters }, (_, index) => ({
                        heading: `CHAPTER ${roman(index + 1)}.`,
                        // CHAPTER I. is printed once in each mansion that has chapters.
                        nth: all.slice(0, mansion).filter(([, count]) => count > index).length + 1,
                        name: `${name} · Chapter ${roman(index + 1)}`
                    })) : [{ heading: 'ONLY CHAPTER', name: `${name} · The Only Chapter` }])
                ];
            }),
            { heading: 'IHS', nth: 2, name: 'Epilogue' }
        ],
        count: 29,
        edition: {
            statement: 'The Benedictines of Stanbrook, revised with notes and an introduction by Benedict Zimmerman, third edition, Thomas Baker, London, 1921',
            translator: 'The Benedictines of Stanbrook',
            year: 1921
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'saturn.mystical-theology': {
        kind: 'ccel',
        work: 'dionysius/works',
        // The Mystic Theology within Parker's Works; his preface to it stands before the first Caput.
        extract: { after: 'PREFACE TO MYSTIC THEOLOGY.', from: 'CAPUT I.', to: 'PREFACE TO THE LETTERS OF DIONYSIUS THE AREOPAGITE.' },
        levels: { 2: '^CAPUT [IV]+\\.$' },
        units: 'headings',
        level: 2,
        retitle: { pattern: '^Caput ', to: 'Chapter ' },
        count: 5,
        edition: {
            statement: 'John Parker, The Works of Dionysius the Areopagite, James Parker and Co., London, 1897; the Mystic Theology',
            translator: 'John Parker',
            year: 1897
        },
        rights: { us: 'pd', life70: 'unknown' }
    },
    'saturn.sermons': {
        kind: 'ccel',
        work: 'eckhart/sermons',
        // Field's preface stands before the first sermon.
        extract: { from: 'I', to: 'Indexes' },
        levels: { 2: '^[IV]+$' },
        units: 'headings',
        level: 2,
        // Each sermon's numeral is followed by its title.
        subtitle: 'p',
        count: 7,
        edition: {
            statement: 'Claud Field, Meister Eckhart’s Sermons, first time translated into English, H. R. Allenson, London, c. 1909; seven sermons; Evans’s 1924 volume to follow after proofing',
            translator: 'Claud Field',
            year: 1909
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    // sacred-texts.com: J. B. Hare's chapter pages.
    'moon.cosmic-consciousness': {
        kind: 'sacred-texts',
        base: 'eso/cc',
        pages: pages('cc', 5, 60, 2),
        units: 'page',
        names: [
            'Part I: First Words',
            ...['To Self Consciousness', 'On the Plane of Self Consciousness', 'Devolution'].map((title, index) => `Part II · Chapter ${index + 1}: ${title}`),
            'Part III: From Self to Cosmic Consciousness',
            ...['Gautama the Buddha', 'Jesus the Christ', 'Paul', 'Plotinus', 'Mohammed', 'Dante', 'Bartolomé Las Casas',
                'John Yepes (Called St. John of the Cross)', 'Francis Bacon', 'Jacob Behmen', 'William Blake', 'Honoré de Balzac',
                'Walt Whitman', 'Edward Carpenter'].map((title, index) => `Part IV · Chapter ${index + 1}: ${title}`),
            ...['The Twilight', 'Moses', 'Gideon, Surnamed Jerubbaal', 'Isaiah', 'The Case of Lî R', 'Socrates', 'Roger Bacon',
                'Blaise Pascal', 'Benedict Spinoza', 'Colonel James Gardiner', 'Swedenborg', 'William Wordsworth', 'Charles G. Finney',
                'Alexander Pushkin', 'Ralph Waldo Emerson', 'Alfred Tennyson', 'J. B. B.', 'Henry David Thoreau', 'J. B.', 'C. P.',
                'The Case of H. B. in His Own Words', 'R. P. S.', 'E. T.', 'Case of Ramakrishna Paramahansa', 'Case of J. H. J.',
                'T. S. R.', 'W. H. W.', 'Richard Jefferies', 'Case of C. M. C. in Her Own Words', 'The Case of M. C. L. in His Own Words',
                'Case of J. W. W., Largely in His Own Words', 'Case of J. William Lloyd, in His Own Words', 'Horace Traubel',
                'The Case of Paul Tyner, in His Own Words', 'The Case of C. Y. E., in Her Own Words', 'Case of A. J. S.'
            ].map((title, index) => `Part V · Chapter ${index + 1}: ${title}`)
                // Chapter 23, E. T., is three sentences; it is read with the chapter after it.
                .map(name => (name.startsWith('Part V · Chapter 23:') ? 'Part V · Chapters 23 and 24: E. T.; Case of Ramakrishna Paramahansa'
                    : name.startsWith('Part V · Chapter 24:') ? null : name)),
            'Part VI: Last Words'
        ],
        // The site's Swedenborg chapter opens on "<s :", a broken small-caps tag set as text.
        strike: { pattern: '^<s : ', kind: 'transcription faults' },
        count: 55,
        note: SACRED_TEXTS_NOTE,
        edition: { statement: 'E. P. Dutton, New York, 1901', translator: null, year: 1901 },
        rights: { us: 'pd', life70: 'pd' }
    },
    'moon.tertium-organum': {
        kind: 'sacred-texts',
        base: 'eso/to',
        // The twenty-three chapters and the Conclusion; the prefaces, Bragdon's introduction and the closing table are left.
        pages: pages('to', 4, 27, 2),
        units: 'page',
        names: [...Array.from({ length: 23 }, (_, index) => `Chapter ${roman(index + 1)}`), 'Conclusion'],
        count: 24,
        note: SACRED_TEXTS_NOTE,
        edition: {
            statement: 'Nicholas Bessaraboff and Claude Bragdon, from the Russian; second American edition, revised, Alfred A. Knopf, New York, 1922',
            translator: 'Nicholas Bessaraboff and Claude Bragdon',
            year: 1922
        },
        rights: { us: 'pd', life70: 'unknown' }
    },
    'saturn.upanishads': {
        // Müller's prefaces, introductions and transliteration charts are left; the Upanishads are read.
        artifacts: [
            {
                kind: 'sacred-texts', base: 'hin/sbe01', pages: pages('sbe01', 22, 243), note: SACRED_TEXTS_NOTE,
                units: [
                    { heading: 'KHÂNDOGYA-UPANISHAD.', name: 'The Khândogya-Upanishad' },
                    { heading: 'TALAVAKÂRA', name: 'The Talavakâra or Kena-Upanishad' },
                    { heading: 'AITAREYA-ÂRANYAKA.', name: 'The Aitareya-Âranyaka' },
                    { heading: 'KAUSHÎTAKI-BRÂHMANA-UPANISHAD.', name: 'The Kaushîtaki-Brâhmana-Upanishad' },
                    { heading: 'VÂGASANEYI-SAMHITÂ-UPANISHAD.', name: 'The Vâgasaneyi-Samhitâ-Upanishad' }
                ]
            },
            // Hare set Hume's translation of VI, 4 beside Müller's; it is not Müller's.
            {
                kind: 'sacred-texts', base: 'hin/sbe15', pages: pages('sbe15', 10, 118, 3, [98]), note: SACRED_TEXTS_NOTE,
                units: [
                    { heading: 'KATHA-UPANISHAD.', name: 'The Katha-Upanishad' },
                    { heading: 'MUNDAKA-UPANISHAD.', name: 'The Mundaka-Upanishad' },
                    { heading: 'TAITTIRÎYAKA-UPANISHAD.', name: 'The Taittirîyaka-Upanishad' },
                    { heading: 'BRIHADÂRANYAKA-UPANISHAD.', name: 'The Brihadâranyaka-Upanishad' },
                    { heading: 'SVETÂSVATARA-UPANISHAD.', name: 'The Svetâsvatara-Upanishad' },
                    { heading: 'PRASÑA-UPANISHAD.', name: 'The Prasña-Upanishad' },
                    { heading: 'Maitrâyana-Brâhmana-Upanishad', name: 'The Maitrâyana-Brâhmana-Upanishad' }
                ]
            }
        ],
        count: 12,
        edition: {
            statement: 'F. Max Müller, The Upanishads, Sacred Books of the East, vols. I and XV, Clarendon Press, Oxford, 1879 and 1884; the twelve Upanishads without Müller’s introductions',
            translator: 'F. Max Müller',
            year: 1879
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'saturn.corpus-hermeticum': {
        kind: 'sacred-texts',
        base: 'gno/th2',
        // The eighteen sermons of the Corpus; Mead's commentary after each, and the Perfect Sermon (Asclepius) after them, are left.
        pages: [2, 4, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35].map(n => `th2${String(n).padStart(2, '0')}.htm`),
        units: 'page',
        names: [
            'I. Pœmandres, the Shepherd of Men', '(II.) The General Sermon', 'II. (III.) To Asclepius', 'III. (IV.) The Sacred Sermon',
            'IV. (V.) The Cup or Monad', 'V. (VI.) Though Unmanifest God is Most Manifest', 'VI. (VII.) In God Alone is Good and Elsewhere Nowhere',
            'VII. (VIII.) The Greatest Ill Among Men is Ignorance of God',
            'VIII. (IX.) That No One of Existing Things doth Perish, but Men in Error Speak of Their Changes as Destructions and as Deaths',
            'IX. (X.) On Thought and Sense', 'X. (XI.) The Key', 'XI. (XII.) Mind Unto Hermes', 'XII. (XIII.) About the Common Mind',
            'XIII. (XIV.) The Secret Sermon on the Mountain', 'XIV. (XV.) A Letter to Asclepius', '(XVI.) The Definitions of Asclepius unto King Ammon',
            '(XVII.) Of Asclepius to the King', '(XVIII.) The Encomium of Kings'
        ],
        count: 18,
        note: SACRED_TEXTS_NOTE,
        edition: {
            statement: 'G. R. S. Mead, Thrice-Greatest Hermes, vol. II, Theosophical Publishing Society, London, 1906; the sermons of the Corpus Hermeticum, without Mead’s commentaries',
            translator: 'G. R. S. Mead',
            year: 1906
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'saturn.masnavi': {
        kind: 'sacred-texts',
        base: 'isl/masnavi',
        pages: pages('msn', 1, 6, 2),
        units: 'page',
        names: Array.from({ length: 6 }, (_, index) => `Book ${roman(index + 1)}`),
        count: 6,
        note: SACRED_TEXTS_NOTE,
        edition: {
            statement: 'E. H. Whinfield, Masnavi i Ma’navi, the Spiritual Couplets, translated and abridged, second edition, Kegan Paul, Trench, Trübner, London, 1898',
            translator: 'E. H. Whinfield',
            year: 1898
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    // EEBO-TCP: the TEI transcription, its body only.
    'saturn.occult-philosophy': {
        kind: 'eebo-tcp',
        tcp: 'A26565',
        // The three books; Agrippa's letters and his Censure, printed after the third, are left.
        extract: { from: 'Three Books of Occult Philosophy, or of Magick; Written by that Famous Man Henry Cornelius Agrippa, Knight, And Doctor of both Laws, Counsellor to Caesars Sacred Majesty, and Judge of the Prerogative Court.', to: 'To the Reverend Father, and Doctor of Divinity Aurelius de Aquapendente, Austin Fryar; Henry Cornelius Agrippa sendeth greeting.' },
        units: 'headings',
        level: 3,
        group: 2,
        groupPrefix: true,
        count: 199,
        edition: {
            statement: 'J. F., Three Books of Occult Philosophy, R. W. for Gregory Moule, London, 1651; EEBO-TCP transcription, CC0',
            translator: 'J. F.',
            year: 1651
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    // Plain HTML, read by the recipe's selectors.
    // Chapter X only: the one chapter of the Baynes translation anyone has proofed (Classics in the History of Psychology).
    'moon.psychological-types': {
        kind: 'html',
        url: 'https://psychclassics.yorku.ca/Jung/types.htm',
        pages: ['https://psychclassics.yorku.ca/Jung/types.htm'],
        encoding: 'windows-1252',
        body: 'body',
        // The site sets its headings as centred paragraphs; the two note anchors stand bare inside brackets.
        headings: 'p[align]',
        drops: { 'footnote markers': 'a[href^="#"]' },
        strike: [
            // The 1923 printing's page breaks, set inline as [p. 413].
            { pattern: '\\s?\\[p\\. \\d{3}\\]', kind: 'page numbers' },
            // The brackets each of the two dropped note anchors leaves behind ("[sic]" is set the same way and stays).
            { pattern: '(?<="devouring") \\[$|(?<=\'mneme\',)\\[$|^\\](?= As is| whereas)', kind: 'footnote markers', replace: '' },
            // The transcriber's marks for a letter the page could not set: me[accent]tier, na[umlaut]ive, ae[]sthenic.
            { pattern: '\\[(?:accent|umlaut)?\\]', kind: 'transcriber notes', replace: '' },
            // Slips in the proofed transcription, each corrected as the sentence reads.
            { pattern: 'The are, as it were', kind: 'transcription slips', replace: 'They are, as it were' },
            { pattern: 'con~sdousness', kind: 'transcription slips', replace: 'consciousness' },
            { pattern: "forbidden' This other", kind: 'transcription slips', replace: 'forbidden. This other' },
            { pattern: ' ,(?=very simply explained)', kind: 'transcription slips' },
            { pattern: '(?<=ascendancy on)\\.(?= the part)', kind: 'transcription slips', replace: '' },
            { pattern: '(?<=as a), (?=universal psychological)', kind: 'transcription slips' },
            { pattern: '(?<=universal psychological)\\.(?= phenomenon)', kind: 'transcription slips', replace: '' },
            { pattern: '(?<= )ie\\.(?= )', kind: 'transcription slips', replace: 'i.e.' }
        ],
        extract: { from: 'A. INTRODUCTION' },
        units: [
            { heading: 'A. INTRODUCTION', name: 'Introduction' },
            { heading: 'B. The Extraverted Type', group: true },
            { heading: '(1)THE GENERAL ATTITUDE OF CONSCIOUSNESS', name: 'The Extraverted Type: The General Attitude of Consciousness' },
            { heading: '(II) THE ATTITUDE OF THE UNCONSCIOUS', name: 'The Extraverted Type: The Attitude of the Unconscious' },
            { heading: '(III) THE PECULIARITIES OF THE BASIC PSYCHOLOGICAL FUNCTIONS IN THE EXTRAVERTED ATTITUDE', group: true },
            ...['Thinking', 'The Extraverted Thinking Type', 'Feeling', 'The Extraverted Feeling-Type', 'Recapitulation of Extraverted Rational Types',
                'Sensation', 'The Extraverted Sensation Type', 'Intuition', 'The Extraverted Intuitive Type', 'Recapitulation of Extraverted Irrational Types']
                .map((title, index) => ({ heading: `${index + 1}. ${title}`, nth: SHARED.includes(title) ? 1 : undefined, name: `The Extraverted Type: ${title.replace('Feeling-Type', 'Feeling Type')}` })),
            { heading: 'C. THE INTROVERTED TYPE', group: true },
            { heading: '(I) THE GENERAL ATTITUDE OF CONSCIOUSNESS', name: 'The Introverted Type: The General Attitude of Consciousness' },
            { heading: '(II) THE UNCONSCIOUS ATTITUDE', name: 'The Introverted Type: The Unconscious Attitude' },
            { heading: '(III) PECULIARITIES OF THE BASIC PSYCHOLOGICAL FUNCTIONS IN THE INTROVERTED ATTITUDE', group: true },
            ...['Thinking', 'The Introverted Thinking Type', 'Feeling', 'The Introverted Feeling Type', 'Recapitulation of Introverted Rational Types',
                'Sensation', 'The Introverted Sensation Type', 'Intuition', 'The Introverted Intuitive Type', 'Recapitulation of Introverted Irrational Types',
                'The Principal and Auxiliary Functions']
                .map((title, index) => ({ heading: `${index + 1}. ${title}`, nth: SHARED.includes(title) ? 2 : undefined, name: `The Introverted Type: ${title}` }))
        ],
        count: 26,
        note: 'Transcribed for Classics in the History of Psychology (psychclassics.yorku.ca), an internet resource developed by Christopher D. Green, York University, Toronto. The site states that it has tried to ensure every document it posts is in the public domain, and asks any party claiming copyright to contact its editor (https://psychclassics.yorku.ca/copyright.htm, retrieved 2026-10-17).',
        edition: {
            statement: 'H. G. Baynes, 1923; chapter X only; the rest after a proofing pass of the 1924 printing',
            translator: 'H. Godwin Baynes',
            year: 1923
        },
        rights: { us: 'pd', life70: 'pd' }
    },
    'mercury.ninth-bridgewater': {
        kind: 'html',
        url: 'https://victorianweb.org/science/science_texts/bridgewater/intro.htm',
        pages: ['intro.htm', ...Array.from({ length: 15 }, (_, index) => `b${index + 1}.htm`), 'conclusion.htm']
            .map(page => `https://victorianweb.org/science/science_texts/bridgewater/${page}`),
        encoding: 'windows-1252',
        // The text is in div#main; Babbage's notes stand in the left-hand column and are left with it.
        body: '#main',
        drops: { navigation: '.nav-tile, p.date' },
        // Page breaks of the 1838 edition, set inline as [108/109].
        strike: { pattern: '\\[\\d{1,3}(?:/\\d{1,3})?\\]', kind: 'page numbers' },
        units: 'page',
        names: ['Title Page and Preface', ...Array.from({ length: 15 }, (_, index) => `Chapter ${roman(index + 1)}`), 'Conclusion'],
        count: 17,
        note: 'Victorian Web transcription: digitized by John van Wyhe, proofed and paragraphed by George P. Landow, 2008. The Victorian Web allows its texts to be used for scholarly or educational purposes when the author and the site are credited and the source URL is linked (https://victorianweb.org/misc/using.html).',
        edition: {
            statement: 'Second edition, John Murray, London, 1838; Victorian Web transcription (John van Wyhe; proofed by George P. Landow)',
            translator: null,
            year: 1838
        },
        rights: { us: 'pd', life70: 'pd' }
    }
};

export { pages, roman };
