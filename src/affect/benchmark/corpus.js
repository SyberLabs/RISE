/**
 * Passages drawn from texts the RISE archive already holds.
 *
 * `archivePath` is the module that carries the string. A test checks that
 * the passage still occurs there, so a later ingest that drops the
 * sentence fails loudly. Probes are constructed and are not claimed as
 * literature.
 */

export const CORPUS = Object.freeze([
    Object.freeze({
        id: 'meditations-temper',
        text: 'From my grandfather Verus I learned good morals and the government of my temper.',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/literary-meditations.js',
            work: 'Meditations',
            author: 'Marcus Aurelius',
            form: 'philosophy',
            cases: Object.freeze(['philosophy', 'prose'])
        })
    }),
    Object.freeze({
        id: 'dickinson-death',
        text: 'Because I could not stop for Death, He kindly stopped for me; The carriage held but just ourselves And Immortality.',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/literary-poems-dickinson.js',
            work: 'Poems',
            author: 'Emily Dickinson',
            form: 'poetry',
            cases: Object.freeze(['poetry', 'irony', 'difficult'])
        })
    }),
    Object.freeze({
        id: 'austen-opening',
        text: 'It is a truth universally acknowledged, that a single man in possession of a good fortune must be in want of a wife.',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/pride-and-prejudice.js',
            work: 'Pride and Prejudice',
            author: 'Jane Austen',
            form: 'prose',
            cases: Object.freeze(['prose', 'irony', 'difficult'])
        })
    }),
    Object.freeze({
        id: 'ishmael-water',
        text: 'Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/moby-dick-or-the-whale.js',
            work: 'Moby-Dick',
            author: 'Herman Melville',
            form: 'prose',
            cases: Object.freeze(['prose', 'descriptive'])
        })
    }),
    Object.freeze({
        id: 'eyre-will',
        text: 'I am no bird; and no net ensnares me; I am a free human being with an independent will',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/jane-eyre.js',
            work: 'Jane Eyre',
            author: 'Charlotte Brontë',
            form: 'prose',
            cases: Object.freeze(['prose', 'dialogue'])
        })
    }),
    Object.freeze({
        id: 'dalloway-morning',
        text: 'Mrs. Dalloway said she would buy the flowers herself.',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/mrs-dalloway.js',
            work: 'Mrs Dalloway',
            author: 'Virginia Woolf',
            form: 'prose',
            cases: Object.freeze(['prose', 'descriptive'])
        })
    }),
    Object.freeze({
        id: 'paradise-woe',
        text: 'Of that forbidden Tree, whose mortal taste Brought death into the world, and all our woe, With loss of Eden',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/paradise-lost.js',
            work: 'Paradise Lost',
            author: 'John Milton',
            form: 'poetry',
            cases: Object.freeze(['poetry', 'solemn'])
        })
    }),
    Object.freeze({
        id: 'comedy-dark',
        text: 'Midway upon the journey of our life I found myself within a forest dark, For the straightforward pathway had been lost.',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/the-divine-comedy.js',
            work: 'The Divine Comedy',
            author: 'Dante Alighieri',
            form: 'poetry',
            cases: Object.freeze(['poetry', 'solemn'])
        })
    }),
    Object.freeze({
        id: 'blake-tyger',
        text: 'burning bright In the forests of the night, What immortal hand or eye Could frame thy fearful symmetry?',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/literary-poems-blake.js',
            work: 'Songs of Innocence and of Experience',
            author: 'William Blake',
            form: 'poetry',
            cases: Object.freeze(['poetry', 'difficult'])
        })
    }),
    Object.freeze({
        id: 'whitman-celebrate',
        text: 'I celebrate myself, and sing myself, And what I assume you shall assume, For every atom belonging to me as good belongs to you.',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/literary-leaves-of-grass.js',
            work: 'Leaves of Grass',
            author: 'Walt Whitman',
            form: 'poetry',
            cases: Object.freeze(['poetry', 'intimacy'])
        })
    }),
    Object.freeze({
        id: 'heights-souls',
        text: 'Whatever our souls are made of, his and mine are the same',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/wuthering-heights.js',
            work: 'Wuthering Heights',
            author: 'Emily Brontë',
            form: 'prose',
            cases: Object.freeze(['prose', 'dialogue', 'intimacy'])
        })
    }),
    Object.freeze({
        id: 'spoon-hill',
        text: 'Where are Elmer, Herman, Bert, Tom and Charley, The weak of will, the strong of arm, the clown, the boozer, the fighter? All, all are sleeping on the hill.',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/spoon-river-anthology.js',
            work: 'Spoon River Anthology',
            author: 'Edgar Lee Masters',
            form: 'poetry',
            cases: Object.freeze(['poetry', 'solemn'])
        })
    }),
    Object.freeze({
        id: 'tao-unnamed',
        text: 'The Tao that can be trodden is not the enduring and unchanging Tao. The name that can be named is not the enduring and unchanging name.',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/sacred-tao-te-ching.js',
            work: 'Tao Te Ching',
            author: 'Laozi',
            form: 'scripture',
            cases: Object.freeze(['scripture', 'ambiguity', 'difficult'])
        })
    }),
    Object.freeze({
        id: 'hamlet-question',
        text: 'nobler in the mind to suffer The slings and arrows of outrageous fortune, Or to take arms against a sea of troubles, And by opposing end them',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/hamlet.js',
            work: 'Hamlet',
            author: 'William Shakespeare',
            form: 'drama',
            cases: Object.freeze(['dialogue', 'difficult', 'uncertainty'])
        })
    }),
    Object.freeze({
        id: 'crime-question',
        text: 'fearful, frenzied and fantastic question, which tortured his heart and mind, clamouring insistently for an answer.',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/crime-and-punishment.js',
            work: 'Crime and Punishment',
            author: 'Fyodor Dostoevsky',
            form: 'prose',
            cases: Object.freeze(['prose', 'tension'])
        })
    }),
    Object.freeze({
        id: 'doll-tricks',
        text: 'I have existed merely to perform tricks for you, Torvald. But you would have it so.',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/a-doll-s-house.js',
            work: "A Doll's House",
            author: 'Henrik Ibsen',
            form: 'drama',
            cases: Object.freeze(['dialogue'])
        })
    }),
    Object.freeze({
        id: 'epictetus-power',
        text: 'you will find not one which is capable of contemplating itself',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/epictetus-encheiridion.js',
            work: 'Encheiridion',
            author: 'Epictetus',
            form: 'philosophy',
            cases: Object.freeze(['philosophy'])
        })
    }),
    Object.freeze({
        id: 'analects-learn',
        text: 'Is it not pleasant to learn with a constant perseverance and application?',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/confucius-analects.js',
            work: 'Analects',
            author: 'Confucius',
            form: 'philosophy',
            cases: Object.freeze(['philosophy'])
        })
    }),
    Object.freeze({
        id: 'vitruvius-order',
        text: 'Architecture depends on Order (in Greek [Greek: taxis]), Arrangement (in Greek [Greek: diathesis]), Eurythmy, Symmetry, Propriety, and Economy',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/vitruvius-architecture.js',
            work: 'On Architecture',
            author: 'Vitruvius',
            form: 'treatise',
            cases: Object.freeze(['neutral', 'descriptive'])
        })
    }),
    Object.freeze({
        id: 'dow-balance',
        text: 'balance of proportions, tone and color. A change in one member changes the whole.',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/dow-composition.js',
            work: 'Composition',
            author: 'Arthur Wesley Dow',
            form: 'treatise',
            cases: Object.freeze(['neutral', 'descriptive'])
        })
    }),
    Object.freeze({
        id: 'gita-universe',
        text: 'By Me the whole vast Universe of things Is spread abroad;--by Me, the Unmanifest!',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/extended-bhagavad-gita-full.js',
            work: 'Bhagavad Gita',
            author: 'attributed to Vyasa',
            form: 'scripture',
            cases: Object.freeze(['scripture', 'scale'])
        })
    }),
    Object.freeze({
        id: 'faustus-wrath',
        text: "heap God's heavy wrath upon thy head!",
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/the-tragical-history-of-doctor-faustus.js',
            work: 'Doctor Faustus',
            author: 'Christopher Marlowe',
            form: 'drama',
            cases: Object.freeze(['dialogue', 'tension'])
        })
    }),
    Object.freeze({
        id: 'koan-difference',
        text: 'Is there any difference between the teaching of the Patriarch and that of the Sutras, or not?',
        provenance: Object.freeze({
            archivePath: 'src/content/archive/works/sacred-zen-koans.js',
            work: 'Zen koans',
            author: 'collected',
            form: 'scripture',
            cases: Object.freeze(['scripture', 'ambiguity', 'difficult'])
        })
    })
]);

export const PROBES = Object.freeze([
    Object.freeze({
        id: 'probe-negation',
        origin: 'constructed-probe',
        text: 'I am not happy.',
        provenance: Object.freeze({
            archivePath: null,
            work: null,
            author: null,
            form: 'probe',
            cases: Object.freeze(['negation']),
            note: 'Not a RISE passage. The weak baseline should miss the negation that the window encoder applies.'
        })
    })
]);

export const REQUIRED_CASES = Object.freeze([
    'prose',
    'poetry',
    'philosophy',
    'scripture',
    'dialogue',
    'descriptive',
    'neutral',
    'ambiguity',
    'irony',
    'difficult'
]);
