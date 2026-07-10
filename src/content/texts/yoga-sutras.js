/**
 * Yoga Sutras of Patanjali
 * Translation: Swami Vivekananda (1896) - Public Domain
 * 196 aphorisms on the science of yoga
 */

import { registerText } from '../library.js';

/**
 * Selected key sutras from all four chapters (padas)
 */
export const YOGA_SUTRAS_SEQUENCES = [
    // ═══════════════════════════════════════════════════════════
    // SAMADHI PADA (Chapter 1) - Concentration
    // ═══════════════════════════════════════════════════════════
    {
        id: 'yoga-1-1',
        name: 'Sutra 1.1 — Now, Yoga',
        curve: 'induction',
        category: 'sacred',
        description: 'The opening instruction',
        wpm: 100,
        content: `Atha yogānuśāsanam |

[PAUSE]

Now, | the teachings of yoga. |

[PAUSE]

Now — | not yesterday, | not tomorrow. |

Now. |

[PAUSE]

The instruction begins | in this moment.`
    },
    {
        id: 'yoga-1-2',
        name: 'Sutra 1.2 — Definition of Yoga',
        curve: 'induction',
        category: 'sacred',
        description: 'Yoga is the stilling of the mind',
        wpm: 100,
        content: `Yogaś citta-vṛtti-nirodhaḥ |

[PAUSE]

Yoga is the cessation | of the movements of the mind. |

[PAUSE]

The stilling | of the thought waves | in the consciousness. |

[PAUSE]

When the lake of the mind | is still, |

then the Self | is reflected clearly.`
    },
    {
        id: 'yoga-1-3',
        name: 'Sutra 1.3 — The Seer Abides',
        curve: 'induction',
        category: 'sacred',
        description: 'Then the Seer rests in its own nature',
        wpm: 100,
        content: `Tadā draṣṭuḥ svarūpe 'vasthānam |

[PAUSE]

Then | the Seer | abides in its own nature. |

[PAUSE]

When the waves are stilled, |

who you truly are | becomes evident. |

[PAUSE]

Pure awareness. | Unchanging witness.`
    },
    {
        id: 'yoga-1-12',
        name: 'Sutra 1.12 — Practice and Detachment',
        curve: 'induction',
        category: 'sacred',
        description: 'The two wings of yoga',
        wpm: 110,
        content: `Abhyāsa-vairāgyābhyāṃ tan-nirodhaḥ |

[PAUSE]

The cessation of the thought waves |

is brought about | by practice and non-attachment. |

[PAUSE]

Two wings. |

Practice — | the effort. |

Detachment — | the release. |

[PAUSE]

Both are needed | to fly.`
    },
    {
        id: 'yoga-1-14',
        name: 'Sutra 1.14 — Firm Practice',
        curve: 'induction',
        category: 'sacred',
        description: 'Practice becomes firm when cultivated for a long time',
        wpm: 110,
        content: `Sa tu dīrgha-kāla-nairantarya-satkārāsevito dṛḍha-bhūmiḥ |

[PAUSE]

Practice becomes firmly grounded |

when well attended to | for a long time, |

without break, | and with devotion. |

[PAUSE]

Long time. | Without break. | With devotion. |

[PAUSE]

This is how roots grow deep.`
    },
    // ═══════════════════════════════════════════════════════════
    // SADHANA PADA (Chapter 2) - Practice
    // ═══════════════════════════════════════════════════════════
    {
        id: 'yoga-2-1',
        name: 'Sutra 2.1 — Kriya Yoga',
        curve: 'induction',
        category: 'sacred',
        description: 'Discipline, study, and surrender',
        wpm: 110,
        content: `Tapaḥ-svādhyāyeśvara-praṇidhānāni kriyā-yogaḥ |

[PAUSE]

Yoga in action consists of: |

Tapas — | discipline, | austerity, | heat. |

Svādhyāya — | self-study, | reflection. |

Īśvara praṇidhāna — | surrender to the divine. |

[PAUSE]

Action. | Inquiry. | Devotion.`
    },
    {
        id: 'yoga-2-29',
        name: 'Sutra 2.29 — The Eight Limbs',
        curve: 'induction',
        category: 'sacred',
        description: 'Ashtanga - the eightfold path',
        wpm: 120,
        content: `Yama-niyamāsana-prāṇāyāma-pratyāhāra-dhāraṇā-dhyāna-samādhayo 'ṣṭāv aṅgāni |

[PAUSE]

The eight limbs of yoga are: |

Yama — | ethical restraints. |

Niyama — | personal observances. |

Āsana — | posture. |

Prāṇāyāma — | breath control. |

Pratyāhāra — | sense withdrawal. |

Dhāraṇā — | concentration. |

Dhyāna — | meditation. |

Samādhi — | absorption. |

[PAUSE]

Eight limbs. | One body. | One path.`
    },
    {
        id: 'yoga-2-46',
        name: 'Sutra 2.46 — Sthira Sukham Asanam',
        curve: 'induction',
        category: 'sacred',
        description: 'Posture is steady and comfortable',
        wpm: 100,
        content: `Sthira-sukham āsanam |

[PAUSE]

Āsana is | a steady, comfortable posture. |

[PAUSE]

Sthira — | stable, | firm, | unwavering. |

Sukha — | ease, | comfort, | sweetness. |

[PAUSE]

Not rigid. Not collapsed. |

The middle way | of the body.`
    },
    // ═══════════════════════════════════════════════════════════
    // VIBHUTI PADA (Chapter 3) - Powers
    // ═══════════════════════════════════════════════════════════
    {
        id: 'yoga-3-1',
        name: 'Sutra 3.1 — Dharana',
        curve: 'induction',
        category: 'sacred',
        description: 'Concentration is binding the mind to one place',
        wpm: 100,
        content: `Deśa-bandhaś cittasya dhāraṇā |

[PAUSE]

Concentration is | binding the mind | to one place. |

[PAUSE]

One point. | One focus. |

All the scattered rays | gathered | into a single beam. |

[PAUSE]

This is dhāraṇā.`
    },
    {
        id: 'yoga-3-2',
        name: 'Sutra 3.2 — Dhyana',
        curve: 'induction',
        category: 'sacred',
        description: 'Meditation is the continuous flow of awareness',
        wpm: 100,
        content: `Tatra pratyayaikatānatā dhyānam |

[PAUSE]

Meditation is | the continuous flow | of awareness toward that point. |

[PAUSE]

Concentration sustained. |

Flow unbroken. |

Like oil poured | from one vessel to another. |

[PAUSE]

This is dhyāna.`
    },
    {
        id: 'yoga-3-3',
        name: 'Sutra 3.3 — Samadhi',
        curve: 'induction',
        category: 'sacred',
        description: 'Absorption - only the object shines forth',
        wpm: 100,
        content: `Tad evārtha-mātra-nirbhāsaṃ svarūpa-śūnyam iva samādhiḥ |

[PAUSE]

When only the object shines forth, |

as if empty of one's own form, |

that is samādhi. |

[PAUSE]

The meditator dissolves. |

Only the meditated remains. |

No separation. |

[PAUSE]

This is absorption.`
    },
    // ═══════════════════════════════════════════════════════════
    // KAIVALYA PADA (Chapter 4) - Liberation
    // ═══════════════════════════════════════════════════════════
    {
        id: 'yoga-4-34',
        name: 'Sutra 4.34 — Liberation',
        curve: 'induction',
        category: 'sacred',
        description: 'The final sutra - kaivalya attained',
        wpm: 100,
        content: `Puruṣārtha-śūnyānāṃ guṇānāṃ pratiprasavaḥ kaivalyaṃ svarūpa-pratiṣṭhā vā citi-śaktir iti |

[PAUSE]

Liberation | is the return of the guṇas to their source, |

having no further purpose to serve for the Self. |

[PAUSE]

Or: | it is the power of pure awareness |

established in its own nature. |

[PAUSE]

The journey is complete. |

Puruṣa rests in Puruṣa. |

Awareness | aware of itself. |

[PAUSE]

Kaivalya. | Aloneness. | Wholeness. |

[PAUSE]

Iti. | Thus ends the teaching.`
    }
];

// Register with the library system
registerText({
    id: 'yoga-sutras',
    title: 'Yoga Sutras',
    author: 'Patanjali',
    translator: 'Swami Vivekananda (1896)',
    category: 'sacred',
    tradition: 'Hinduism / Yoga',
    description: 'The foundational text of classical yoga. 196 aphorisms on the science of consciousness.',
    chapterCount: YOGA_SUTRAS_SEQUENCES.length,
    defaultCurve: 'induction',
    defaultWpm: 100,
    getSequences: () => YOGA_SUTRAS_SEQUENCES
});

console.log(`[Library] Yoga Sutras loaded: ${YOGA_SUTRAS_SEQUENCES.length} sutras`);
