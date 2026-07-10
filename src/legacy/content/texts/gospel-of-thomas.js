/**
 * Gospel of Thomas
 * Translation: Thomas O. Lambdin (1988) - Nag Hammadi Library
 * 114 sayings attributed to Jesus, Gnostic wisdom tradition
 */

import { registerText } from '../library.js';

/**
 * Selected key sayings from the Gospel of Thomas
 */
export const GOSPEL_OF_THOMAS_SEQUENCES = [
    {
        id: 'thomas-1',
        name: 'Saying 1 — The Living Words',
        curve: 'induction',
        category: 'sacred',
        description: 'Whoever finds the interpretation will not taste death',
        wpm: 120,
        content: `These are the secret sayings | which the living Jesus spoke |

and which Didymos Judas Thomas wrote down. |

[PAUSE]

And he said: |

"Whoever finds the interpretation of these sayings |

will not experience death."`
    },
    {
        id: 'thomas-2',
        name: 'Saying 2 — Seek and Find',
        curve: 'induction',
        category: 'sacred',
        description: 'The stages of seeking',
        wpm: 110,
        content: `Jesus said: |

"Let him who seeks | continue seeking |

until he finds. |

[PAUSE]

When he finds, | he will become troubled. |

When he becomes troubled, | he will be astonished. |

And he will rule over all things."`
    },
    {
        id: 'thomas-3',
        name: 'Saying 3 — The Kingdom Within',
        curve: 'induction',
        category: 'sacred',
        description: 'The kingdom is inside you',
        wpm: 110,
        content: `Jesus said: |

"If those who lead you say to you, |

'See, the Kingdom is in the sky,' |

then the birds of the sky will precede you. |

[PAUSE]

If they say to you, | 'It is in the sea,' |

then the fish will precede you. |

[PAUSE]

Rather, | the Kingdom is inside of you, |

and it is outside of you. |

[PAUSE]

When you come to know yourselves, |

then you will become known, |

and you will realize that it is you |

who are the sons of the living Father."`
    },
    {
        id: 'thomas-5',
        name: 'Saying 5 — Nothing Hidden',
        curve: 'induction',
        category: 'sacred',
        description: 'Know what is before your face',
        wpm: 100,
        content: `Jesus said: |

"Recognize what is in your sight, |

and that which is hidden from you |

will become plain to you. |

[PAUSE]

For there is nothing hidden |

which will not become manifest."`
    },
    {
        id: 'thomas-22',
        name: 'Saying 22 — Making the Two One',
        curve: 'induction',
        category: 'sacred',
        description: 'When you make the two one',
        wpm: 110,
        content: `Jesus said: |

"When you make the two one, |

and when you make the inside like the outside |

and the outside like the inside, |

and the above like the below, |

[PAUSE]

and when you make the male and the female |

one and the same... |

[PAUSE]

then you will enter the Kingdom."`
    },
    {
        id: 'thomas-42',
        name: 'Saying 42 — Become Passers-By',
        curve: 'induction',
        category: 'sacred',
        description: 'The shortest saying',
        wpm: 80,
        content: `Jesus said: |

[PAUSE]

"Become passers-by." |

[PAUSE]

Become passers-by.`
    },
    {
        id: 'thomas-70',
        name: 'Saying 70 — What You Have Within',
        curve: 'induction',
        category: 'sacred',
        description: 'That which you bring forth will save you',
        wpm: 100,
        content: `Jesus said: |

"That which you have | will save you |

if you bring it forth from yourselves. |

[PAUSE]

That which you do not have within you |

will kill you |

if you do not have it within you."`
    },
    {
        id: 'thomas-77',
        name: 'Saying 77 — I Am the Light',
        curve: 'induction',
        category: 'sacred',
        description: 'Split wood and I am there',
        wpm: 100,
        content: `Jesus said: |

"It is I who am the light |

which is above them all. |

It is I who am the All. |

[PAUSE]

From me did the All come forth, |

and unto me did the All extend. |

[PAUSE]

Split a piece of wood, | and I am there. |

Lift up the stone, | and you will find me there."`
    },
    {
        id: 'thomas-108',
        name: 'Saying 108 — Drinking from My Mouth',
        curve: 'induction',
        category: 'sacred',
        description: 'He who drinks from my mouth will become like me',
        wpm: 100,
        content: `Jesus said: |

"He who will drink from my mouth |

will become like me. |

[PAUSE]

I myself shall become he, |

and the things that are hidden |

will be revealed to him."`
    },
    {
        id: 'thomas-113',
        name: 'Saying 113 — When Will the Kingdom Come',
        curve: 'induction',
        category: 'sacred',
        description: 'It will not come by waiting for it',
        wpm: 110,
        content: `His disciples said to him: |

"When will the Kingdom come?" |

[PAUSE]

Jesus said: |

"It will not come by waiting for it. |

It will not be a matter of saying |

'Here it is' or 'There it is.' |

[PAUSE]

Rather, | the Kingdom of the Father |

is spread out upon the earth, |

and men do not see it."`
    }
];

// Register with the library system
registerText({
    id: 'gospel-of-thomas',
    title: 'Gospel of Thomas',
    author: 'Didymos Judas Thomas',
    translator: 'Thomas O. Lambdin',
    category: 'sacred',
    tradition: 'Gnostic Christianity',
    description: '114 secret sayings of Jesus from the Nag Hammadi library. Gnostic wisdom on the inner kingdom.',
    chapterCount: GOSPEL_OF_THOMAS_SEQUENCES.length,
    defaultCurve: 'induction',
    defaultWpm: 110,
    getSequences: () => GOSPEL_OF_THOMAS_SEQUENCES
});

console.log(`[Library] Gospel of Thomas loaded: ${GOSPEL_OF_THOMAS_SEQUENCES.length} sayings`);
