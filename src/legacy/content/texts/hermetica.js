/**
 * The Hermetica
 * Translation: G.R.S. Mead (1906) / Brian Copenhaver - Public Domain
 * Hermetic philosophical texts attributed to Hermes Trismegistus
 */

import { registerText } from '../library.js';

/**
 * Key passages from the Corpus Hermeticum
 */
export const HERMETICA_SEQUENCES = [
    // ═══════════════════════════════════════════════════════════
    // POIMANDRES (Corpus Hermeticum I)
    // ═══════════════════════════════════════════════════════════
    {
        id: 'hermes-poimandres-1',
        name: 'Poimandres — The Vision',
        curve: 'induction',
        category: 'sacred',
        description: 'The opening vision of divine mind',
        wpm: 110,
        content: `Once, when thought came to me |
of the things that are, |
and my thinking soared high |
and my bodily senses were restrained, |

[PAUSE]

I seemed to see a vast being |
of boundless magnitude, |
who called my name and said: |

"What do you wish to hear and see, |
and having seen, to learn and know?" |

[PAUSE]

I said, | "Who are you?" |

"I am Poimandres," he said, |
"Mind of the Sovereignty. |
I know what you wish, |
and I am with you everywhere."`
    },
    {
        id: 'hermes-poimandres-2',
        name: 'Poimandres — Light and Darkness',
        curve: 'induction',
        category: 'sacred',
        description: 'The primordial light',
        wpm: 110,
        content: `I saw an endless vision |
in which everything became light — |
serene and joyful — |

and I fell in love with it. |

[PAUSE]

After a little while, |
darkness arose separately |
and descended — |
fearful and gloomy, |
coiling like a snake. |

[PAUSE]

Then the darkness changed |
into a watery nature, |
unspeakably agitated, |
giving off smoke as from fire |
and producing an indescribable sound of groaning. |

[PAUSE]

And from the light |
a holy word came forth, |
and untempered fire leapt up |
out of the watery nature.`
    },
    {
        id: 'hermes-poimandres-3',
        name: 'Poimandres — The Human and the Divine',
        curve: 'induction',
        category: 'sacred',
        description: 'Humanity created from light',
        wpm: 110,
        content: `Mind, the Father of all, |
being life and light, |
gave birth to a human being |
equal to himself. |

[PAUSE]

This human was beautiful, |
bearing the image of the Father. |

For god fell in love |
with his own form |
and handed over to it |
all his own creations. |

[PAUSE]

And when humanity observed |
what the craftsman had created, |
it also wished to create. |

And it entered |
the craftsman's sphere.`
    },
    // ═══════════════════════════════════════════════════════════
    // THE KEY (Corpus Hermeticum X)
    // ═══════════════════════════════════════════════════════════
    {
        id: 'hermes-key',
        name: 'The Key — As Above, So Below',
        curve: 'induction',
        category: 'sacred',
        description: 'The Hermetic axiom',
        wpm: 100,
        content: `That which is above |
is like that which is below, |
and that which is below |
is like that which is above, |

to accomplish the miracles of the One Thing. |

[PAUSE]

And as all things arose |
from the One by mediation of the One, |
so all things were born |
from this One Thing |
by adaptation. |

[PAUSE]

Its father is the Sun; |
its mother is the Moon. |
The Wind carried it in its womb; |
its nurse is the Earth.`
    },
    // ═══════════════════════════════════════════════════════════
    // ASCLEPIUS
    // ═══════════════════════════════════════════════════════════
    {
        id: 'hermes-asclepius-1',
        name: 'Asclepius — The Great Miracle',
        curve: 'induction',
        category: 'sacred',
        description: 'Humanity as a great miracle',
        wpm: 110,
        content: `A great miracle, Asclepius, |
is humanity. |

[PAUSE]

A being worthy of reverence and honor. |

For humanity passes |
into the nature of a god |
as though it were itself a god. |

[PAUSE]

Humanity knows the demonic kind |
because it recognizes |
that it shares their origin. |

It despises the part of it |
that is merely human, |

for it has put its hope |
in the divinity of its other part.`
    },
    {
        id: 'hermes-asclepius-2',
        name: 'Asclepius — Knowing God',
        curve: 'induction',
        category: 'sacred',
        description: 'Through understanding, one reaches god',
        wpm: 100,
        content: `Therefore, Asclepius, |
attend to the one who speaks, |
and understand. |

[PAUSE]

For to reason about god |
is not to speak, |
but to know. |

[PAUSE]

To know god |
is to be silent about god. |

Every other thing can be known, |
expressed, and spoken of. |

[PAUSE]

But the One |
cannot be spoken or heard |
except by silence and understanding.`
    },
    // ═══════════════════════════════════════════════════════════
    // MIND TO HERMES (Corpus Hermeticum XI)
    // ═══════════════════════════════════════════════════════════
    {
        id: 'hermes-mind-xi',
        name: 'Mind to Hermes — The All is Mind',
        curve: 'induction',
        category: 'sacred',
        description: 'God is mind; mind is everything',
        wpm: 100,
        content: `Hermes, understand this: |

God, | Eternity, | Cosmos, | Time, | Becoming. |

[PAUSE]

God makes Eternity; |
Eternity makes Cosmos; |
Cosmos makes Time; |
Time makes Becoming. |

[PAUSE]

The essence of God | is, so to speak, | Mind. |

The essence of Eternity | is permanence. |

The essence of Cosmos | is order. |

The essence of Time | is change. |

The essence of Becoming | is life and death. |

[PAUSE]

Energy of god is mind and soul; |
energy of eternity | is permanence and immortality.`
    },
    // ═══════════════════════════════════════════════════════════
    // THE CRATER (Corpus Hermeticum IV)
    // ═══════════════════════════════════════════════════════════
    {
        id: 'hermes-crater',
        name: 'The Crater — The Mixing Bowl',
        curve: 'induction',
        category: 'sacred',
        description: 'God filled a great bowl with mind',
        wpm: 110,
        content: `God filled a great bowl with mind |
and sent it down, |
appointing a herald |
and commanding him to proclaim |
to the hearts of humans: |

[PAUSE]

"Baptize yourself in this bowl, |
you who can, |
you who believe |
that you shall rise up again |
to the one who sent down the bowl, |
you who know why you came to be." |

[PAUSE]

Those who heeded the proclamation |
and were baptized in mind |
came to share in knowledge |
and became complete, |

having received mind.`
    },
    // ═══════════════════════════════════════════════════════════
    // REBIRTH (Corpus Hermeticum XIII)
    // ═══════════════════════════════════════════════════════════
    {
        id: 'hermes-rebirth',
        name: 'On Rebirth — The Secret Teaching',
        curve: 'induction',
        category: 'sacred',
        description: 'The mystery of regeneration',
        wpm: 100,
        content: `Father, in the general teachings |
you spoke in riddles |
about divinity, |
and you did not reveal yourself. |

[PAUSE]

You said, |
"No one can be saved |
before rebirth." |

[PAUSE]

When I asked to learn |
the discourse on rebirth, |
you said you would give it to me |
when I was ready |
to become a stranger to the world. |

[PAUSE]

I have now made myself ready. |
Father, complete my deficiency. |
Teach me about rebirth.`
    },
    {
        id: 'hermes-rebirth-2',
        name: 'On Rebirth — The New Birth',
        curve: 'induction',
        category: 'sacred',
        description: 'Born again in mind',
        wpm: 100,
        content: `Child, this wisdom |
is to be understood in silence, |
and the seed is the true good. |

[PAUSE]

Who sows the seed? |

The will of god, my child. |

And who is the one begotten? |

[PAUSE]

A child different from the father: |
a god, | the son of god, |
the All that is in All, |
possessing all the powers. |

[PAUSE]

Father, | I see the All, |
and I see myself | in Mind. |

This, my child, | is rebirth.`
    }
];

// Register with the library system
registerText({
    id: 'hermetica',
    title: 'The Hermetica',
    author: 'Hermes Trismegistus',
    translator: 'G.R.S. Mead / Brian Copenhaver',
    category: 'sacred',
    tradition: 'Hermeticism',
    description: 'Egyptian-Greek wisdom texts on the nature of the divine, cosmos, mind, and humanity. The foundation of Western esoteric tradition.',
    chapterCount: HERMETICA_SEQUENCES.length,
    defaultCurve: 'induction',
    defaultWpm: 100,
    getSequences: () => HERMETICA_SEQUENCES
});

console.log(`[Library] Hermetica loaded: ${HERMETICA_SEQUENCES.length} passages`);
