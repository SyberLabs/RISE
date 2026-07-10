/**
 * The Upanishads
 * Translation: Max Müller (1879-1884) / Swami Nikhilananda - Public Domain
 * Core teachings from the principal Upanishads
 */

import { registerText } from '../library.js';

/**
 * Selected passages from key Upanishads
 */
export const UPANISHADS_SEQUENCES = [
    // ═══════════════════════════════════════════════════════════
    // ISHA UPANISHAD
    // ═══════════════════════════════════════════════════════════
    {
        id: 'isha-1',
        name: 'Isha 1 — All This is Brahman',
        curve: 'induction',
        category: 'sacred',
        description: 'The opening declaration',
        wpm: 100,
        content: `Īśā vāsyam idaṃ sarvaṃ |

yat kiñca jagatyāṃ jagat |

[PAUSE]

All this, | whatsoever moves in this moving world, |

is enveloped by the Lord. |

[PAUSE]

Renounce and enjoy. |

Do not covet the possessions of others.`
    },
    {
        id: 'isha-4',
        name: 'Isha 4-5 — The Self',
        curve: 'induction',
        category: 'sacred',
        description: 'The Self is one and yet the many',
        wpm: 100,
        content: `The Self is one. |

Unmoving, | it moves faster than the mind. |

[PAUSE]

The senses cannot reach it, | for it moves ever in front. |

Standing still, | it overtakes all who run. |

[PAUSE]

It moves, | and it moves not. |

It is far, | and it is near. |

It is within all this, |

and it is outside all this.`
    },
    // ═══════════════════════════════════════════════════════════
    // KENA UPANISHAD
    // ═══════════════════════════════════════════════════════════
    {
        id: 'kena-1',
        name: 'Kena 1 — By Whom?',
        curve: 'induction',
        category: 'sacred',
        description: 'The ultimate question',
        wpm: 100,
        content: `By whom willed and directed | does the mind alight on its objects? |

By whom commanded | does the first breath move? |

By whom willed | do we utter this speech? |

What god is behind | the eye and the ear? |

[PAUSE]

That which is the hearing of the ear, |

the thought of the mind, |

the speech of the voice, |

the life of the breath, |

the sight of the eye. |

[PAUSE]

The wise, | leaving this world, |

become immortal.`
    },
    {
        id: 'kena-2',
        name: 'Kena 2 — Not Known by Those Who Know',
        curve: 'induction',
        category: 'sacred',
        description: 'The paradox of knowing Brahman',
        wpm: 100,
        content: `If you think | that you know it well, |

little indeed | do you know the form of Brahman. |

[PAUSE]

That of it | which is in you, |

and that of it | which is among the gods — |

this you must investigate. |

[PAUSE]

I think it is known. |

I do not think | that I know it well, |

nor do I think | that I do not know it. |

[PAUSE]

He among us | who knows this, |

knows it; |

he does not think | that he does not know it.`
    },
    // ═══════════════════════════════════════════════════════════
    // KATHA UPANISHAD
    // ═══════════════════════════════════════════════════════════
    {
        id: 'katha-nachiketas',
        name: 'Katha — Nachiketas and Death',
        curve: 'induction',
        category: 'sacred',
        description: 'The boy who questioned Yama',
        wpm: 110,
        content: `There is this doubt | about a man who has departed: |

some say he exists, | others say he does not. |

[PAUSE]

I would know this, | taught by you. |

This is the third of my boons. |

[PAUSE]

Death said: |

"Even the gods | have had doubts about this. |

It is not easy to understand. |

Subtle is this truth. |

[PAUSE]

Choose another boon, Nachiketas. |

Do not press me. | Release me from this."`
    },
    {
        id: 'katha-razor',
        name: 'Katha — The Razor\'s Edge',
        curve: 'induction',
        category: 'sacred',
        description: 'The path is sharp like a razor',
        wpm: 100,
        content: `Arise! Awake! |

Having obtained your boons, | understand them. |

[PAUSE]

The path is as sharp as a razor's edge, |

difficult to tread and hard to cross — |

so the wise say. |

[PAUSE]

The Self is not born, | nor does it die. |

It did not spring from anything, |

nor did anything spring from it. |

[PAUSE]

Unborn, | eternal, | everlasting, | ancient — |

it is not slain | when the body is slain.`
    },
    // ═══════════════════════════════════════════════════════════
    // MUNDAKA UPANISHAD
    // ═══════════════════════════════════════════════════════════
    {
        id: 'mundaka-two-birds',
        name: 'Mundaka — Two Birds',
        curve: 'induction',
        category: 'sacred',
        description: 'The famous parable of the two birds',
        wpm: 100,
        content: `Two birds, | inseparable companions, |

perch on the same tree. |

[PAUSE]

One eats the fruit of the tree, |

the other looks on | without eating. |

[PAUSE]

On the same tree | the jīva sits, |

bewildered, | immersed in sorrow, |

overcome by its lack of power. |

[PAUSE]

But when it sees | the other — |

the Lord, | the worshipful, | and his greatness — |

then it becomes free from sorrow.`
    },
    // ═══════════════════════════════════════════════════════════
    // CHANDOGYA UPANISHAD
    // ═══════════════════════════════════════════════════════════
    {
        id: 'chandogya-tat-tvam-asi',
        name: 'Chandogya — Tat Tvam Asi',
        curve: 'induction',
        category: 'sacred',
        description: 'That Thou Art - the mahavakya',
        wpm: 100,
        content: `In the beginning, | there was only Being, |

one without a second. |

[PAUSE]

It thought, | "May I become many, | may I grow forth." |

[PAUSE]

This subtle essence | is the Self of all that exists. |

That is Truth. | That is the Self. |

[PAUSE]

Tat tvam asi. |

[PAUSE]

That | thou | art. |

[PAUSE]

That art thou, Śvetaketu.`
    },
    // ═══════════════════════════════════════════════════════════
    // BRIHADARANYAKA UPANISHAD
    // ═══════════════════════════════════════════════════════════
    {
        id: 'brihadaranyaka-asato-ma',
        name: 'Brihadaranyaka — Lead Me from Darkness',
        curve: 'induction',
        category: 'sacred',
        description: 'The great prayer',
        wpm: 80,
        content: `Asato mā sad gamaya |

Tamaso mā jyotir gamaya |

Mṛtyor mā amṛtaṃ gamaya |

[PAUSE]

Lead me | from the unreal | to the Real. |

Lead me | from darkness | to Light. |

Lead me | from death | to Immortality. |

[PAUSE]

Om. | Shanti, | shanti, | shanti.`
    },
    {
        id: 'brihadaranyaka-aham-brahmasmi',
        name: 'Brihadaranyaka — I Am Brahman',
        curve: 'induction',
        category: 'sacred',
        description: 'The great declaration',
        wpm: 100,
        content: `In the beginning | this was Self alone, |

one only; | nothing else whatsoever. |

[PAUSE]

He thought, | "I am all." |

[PAUSE]

Whoever knows, | "I am Brahman," |

becomes all this. |

Even the gods | cannot prevent him from becoming so, |

for he has become their Self. |

[PAUSE]

Aham brahmāsmi. |

[PAUSE]

I | am | Brahman.`
    }
];

// Register with the library system
registerText({
    id: 'upanishads',
    title: 'The Upanishads',
    author: 'Various Rishis',
    translator: 'Max Müller / Swami Nikhilananda',
    category: 'sacred',
    tradition: 'Hinduism / Vedanta',
    description: 'The philosophical core of the Vedas. Teachings on Brahman, Atman, and the nature of ultimate reality.',
    chapterCount: UPANISHADS_SEQUENCES.length,
    defaultCurve: 'induction',
    defaultWpm: 100,
    getSequences: () => UPANISHADS_SEQUENCES
});

console.log(`[Library] Upanishads loaded: ${UPANISHADS_SEQUENCES.length} passages`);
