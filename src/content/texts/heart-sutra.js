/**
 * Heart Sutra (Prajñāpāramitā Hṛdaya)
 * Translation: Edward Conze - Public Domain adaptation
 * The essence of wisdom on emptiness
 */

import { registerText } from '../library.js';

/**
 * The Heart Sutra - formatted as a single powerful sequence
 * Plus key sections as separate contemplations
 */
export const HEART_SUTRA_SEQUENCES = [
    {
        id: 'heart-sutra-full',
        name: 'The Complete Heart Sutra',
        curve: 'induction',
        category: 'sacred',
        description: 'The complete sutra on emptiness and wisdom',
        wpm: 120,
        content: `The Bodhisattva of Compassion, |

when practicing deeply the Prajñāpāramitā, |

perceived that all five skandhas are empty |

and was saved from all suffering and distress. |

[PAUSE]

Śāriputra, |

form does not differ from emptiness, |

emptiness does not differ from form. |

That which is form is emptiness, |

that which is emptiness is form. |

[PAUSE]

The same is true of feelings, |

perceptions, |

impulses, |

consciousness. |

[PAUSE]

Śāriputra, |

all dharmas are marked with emptiness; |

they do not appear or disappear, |

are not tainted or pure, |

do not increase or decrease. |

[PAUSE]

Therefore, in emptiness | no form, no feelings, |

no perceptions, no impulses, no consciousness. |

No eyes, no ears, no nose, no tongue, no body, no mind; |

no color, no sound, no smell, no taste, no touch, no object of mind; |

no realm of eyes | and so forth until no realm of mind consciousness. |

[PAUSE]

No ignorance | and also no extinction of it, |

and so forth until no old age and death |

and also no extinction of them. |

No suffering, no origination, no stopping, no path, |

no cognition, | also no attainment | with nothing to attain. |

[PAUSE]

The Bodhisattva depends on Prajñāpāramitā |

and the mind is no hindrance; |

without any hindrance no fears exist. |

Far apart from every perverted view | one dwells in Nirvana. |

[PAUSE]

In the three worlds | all Buddhas depend on Prajñāpāramitā |

and attain Anuttara Samyak Sambodhi. |

[PAUSE]

Therefore know that Prajñāpāramitā |

is the great transcendent mantra, |

is the great bright mantra, |

is the utmost mantra, |

is the supreme mantra, |

which is able to relieve all suffering |

and is true, not false. |

[PAUSE]

So proclaim the Prajñāpāramitā mantra, |

proclaim the mantra which says: |

[PAUSE]

Gate gate pāragate pārasaṃgate bodhi svāhā. |

[PAUSE]

Gone, gone, | gone beyond, |

gone utterly beyond. |

Enlightenment. |

So be it.`
    },
    {
        id: 'heart-sutra-emptiness',
        name: 'Form is Emptiness',
        curve: 'induction',
        category: 'sacred',
        description: 'The core teaching on emptiness and form',
        wpm: 100,
        content: `Form does not differ from emptiness, |

emptiness does not differ from form. |

[PAUSE]

That which is form | is emptiness. |

That which is emptiness | is form. |

[PAUSE]

The same is true of feelings, |

perceptions, |

impulses, |

consciousness. |

[PAUSE]

All dharmas are marked with emptiness; |

they do not appear or disappear, |

are not tainted or pure, |

do not increase or decrease.`
    },
    {
        id: 'heart-sutra-mantra',
        name: 'The Gate Mantra',
        curve: 'induction',
        category: 'sacred',
        description: 'The closing mantra of transcendence',
        wpm: 80,
        content: `Gate gate pāragate pārasaṃgate bodhi svāhā. |

[PAUSE]

Gone, | gone, |

gone beyond, |

gone utterly beyond. |

[PAUSE]

Enlightenment. |

[PAUSE]

So be it.`
    },
    {
        id: 'heart-sutra-no-hindrance',
        name: 'No Hindrance',
        curve: 'induction',
        category: 'sacred',
        description: 'Freedom from fear through wisdom',
        wpm: 110,
        content: `The Bodhisattva depends on Prajñāpāramitā |

and the mind is no hindrance; |

[PAUSE]

without any hindrance | no fears exist. |

[PAUSE]

Far apart from every perverted view |

one dwells in Nirvana. |

[PAUSE]

In the three worlds |

all Buddhas depend on Prajñāpāramitā |

and attain Anuttara Samyak Sambodhi. |

[PAUSE]

Supreme perfect enlightenment.`
    }
];

// Register with the library system
registerText({
    id: 'heart-sutra',
    title: 'Heart Sutra',
    author: 'Traditional',
    translator: 'Edward Conze (adapted)',
    category: 'sacred',
    tradition: 'Buddhism',
    description: 'The essence of the Perfection of Wisdom teachings. A profound meditation on emptiness (śūnyatā).',
    chapterCount: HEART_SUTRA_SEQUENCES.length,
    defaultCurve: 'induction',
    defaultWpm: 120,
    getSequences: () => HEART_SUTRA_SEQUENCES
});

console.log(`[Library] Heart Sutra loaded: ${HEART_SUTRA_SEQUENCES.length} sequences`);
