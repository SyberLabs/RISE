/**
 * Personalized Vault A — Dr. Margareta (Maya) Ackerman
 *
 * PROVENANCE CONTRACT
 * ───────────────────
 * Every sequence in this vault is drawn from text Dr. Ackerman actually
 * wrote, in papers she actually authored. Each carries a `source` block
 * naming the paper, venue, year, and co-authors, and each passage is a
 * faithful excerpt — condensed and phrase-marked for reading rhythm, but
 * never reworded, never invented, never paraphrased into her mouth.
 *
 * The `|` markers are the chunker's phrase boundaries: they set breath,
 * not meaning. Sentences may be selected and joined across a paragraph,
 * but the words within them are hers.
 *
 * VERIFIED against OpenAlex author A5035014734 and the open-access
 * copies of record:
 *   - Algorithmic Songwriting with ALYSIA — arXiv:1612.01058 (EvoMUSART 2017)
 *   - The Humble Creative Machine — ICCC 2021, kar.kent.ac.uk/90259
 *   - SOVIA: Sonification of Visual Interactive Art — Gayhardt & Ackerman, SCU
 *   - Interactive Augmented Reality for Dance — Brockhoeft et al., FSU (ICCC 2016)
 *
 * SENSORY DESIGN
 * ──────────────
 * Phrase chunking throughout — Dr. Ackerman's stated preference from
 * the demo. The `|` markers author the phrase boundaries directly, so
 * every atom is a breath she can read rather than a mechanical split.
 *
 * The soundscapes alternate, half Faded Signal and half Aurora, so the
 * suite breathes between two rooms rather than sitting in one. In both
 * cases audioPreset rests at 'silent': a soundscape is a finished mix,
 * so the pure tones stay out of its way (exclusive beds).
 *
 * Each sequence carries a DISTINCT visual identity so the vault reads
 * as a suite rather than a repetition:
 *   1. Genesis                  — the origin of a system
 *   2. Attractor                — the space of possibility
 *   3. Fractal, behind-stream   — the words stay, the flames breathe beneath
 *   4. Neural, behind-stream    — the model as living substrate
 *   5. Turrell, behind-stream   — light fields under Monet's sonified art
 *   6. Klee + collections blend — full-frame, the co-creative finale
 */

export const VAULT_A_SEQUENCES = [
  {
    id: 'alysia-co-creative-process',
    name: 'The Co-Creative Process',
    curve: 'induction',
    category: 'ALYSIA · 2017',
    description: 'On songwriting with ALYSIA: how a machine offers melodies, and a human chooses.',
    wpm: 300,
    chunkMode: 'phrase',
    audioPreset: 'silent',
    soundscape: 'faded-signal',
    source: {
      title: 'Algorithmic Songwriting with ALYSIA',
      authors: 'Margareta Ackerman, David Loker',
      venue: 'EvoMUSART / arXiv:1612.01058',
      year: 2017,
      section: '§4 The Co-Creative Process of Songwriting with ALYSIA'
    },
    visualConfig: {
      visualMode: 'genesis',
      genesis: { preset: 'random' }
    },
    content: `This is a new approach | to writing songs | that requires minimal | to no musical training.

ALYSIA makes it easy | to explore melodic lines, | reducing songwriting | to the ability | to select melodies | based on one's musical taste.

[PAUSE]

The user provides ALYSIA | with the lyrics | broken down into separate lines.

Then, the system gives | the specified number of melodies | to which the given lyrics | can be sang.

We typically ask for | between fifteen to thirty | melodic variations | per line of text.

Among these, | we select between three | and ten melodic lines.

It should be noted | that nearly all | of ALYSIA's suggestions | are reasonable.

[PAUSE]

One may ask | why we choose to look | at fifteen to thirty options | if all are reasonable.

Having a variety of options | can lead to better quality songs | while also enabling artists | to incorporate | their own musical preferences,

without possessing | the composition | and text-melody juxtaposition skills | traditionally required | to engage in this art form.

[HOLD]

When making our selections, | we look for melodies | that are independently interesting, | and have intriguing relationships | with the underlying text.

We search for lines | that match the emotional meaning | of the text— | happy or sad— | as well as interesting word emphasis.

For example, | if the word "sunshine" | appears in the text, | we may select a melody | that rises with this word.

[PAUSE]

ALYSIA often suggests | melodic variations | for which we find | interesting explanations.

In the original song | Why Do I Still Miss You, | ALYSIA suggested a melody | where the phrase "went wrong" | is on the lower end of scale,

giving these words | an appropriately dark interpretation.

[HOLD]

The next step involves | combining the melodic lines | to form the complete song.

This takes some trial and error, | and several interesting variations | can typically be attained.

Having multiple options | allows the artist | to create several variations | for verses and chorus repetitions, | as often found in songs.`
  },

  {
    id: 'alysia-eating-and-cooking',
    name: 'Eating and Cooking',
    curve: 'wave',
    category: 'ALYSIA · 2017',
    description: 'Why an autonomous songwriter would never eliminate the need for a co-creative one.',
    wpm: 290,
    chunkMode: 'phrase',
    audioPreset: 'silent',
    soundscape: 'aurora',
    source: {
      title: 'Algorithmic Songwriting with ALYSIA',
      authors: 'Margareta Ackerman, David Loker',
      venue: 'EvoMUSART / arXiv:1612.01058',
      year: 2017,
      section: '§6 Discussion: Co-Creative and Autonomous Songwriting'
    },
    visualConfig: {
      visualMode: 'attractor',
      // The strange attractor IS the space of possible melodies ALYSIA
      // offers; the reader selects from it exactly as the passage
      // describes. Left unfolded so the kaleidoscope stays a discovery
      // (press K) rather than a preset — a humble machine steps back.
      attractor: { system: 'aizawa', palette: 'purple', form: 'mirror' }
    },
    content: `Songwriting is the art | of combining melodies and lyrics.

It is not enough | to have beautiful melodies | and poetic lyrics—

the music and words | must fit together | into a coherent whole.

[PAUSE]

This makes Algorithmic Songwriting | a distinct sub-field | of Algorithmic Composition.

Algorithmic songwriting | offers intriguing challenges | as both an autonomous | and a co-creative system.

An autonomous songwriting system | producing works on par | with those of expert human songwriters | would mark | a significant achievement.

Yet, | we can go beyond the score.

[HOLD]

What if, | in addition to writing the song, | an automated system | could also perform | and record | its own compositions?

A truly independent system | would not only create a score, | but incorporate the full spectrum | of expertise required | for the creation of a complete song—

including the vocal performance, | expressive rendition, | and automated music production.

[PAUSE]

As we aspire | to create autonomous songwriters, | artists and hobbyists alike | are thirsty for our help.

Even if we had access | to a fully autonomous songwriter, | it would not replace the need | for a corresponding | co-creative system.

[HOLD]

Whereas an autonomous songwriter | could be used | when complete works are desired,

a co-creative variation | would satisfy the human need | for music making—

much like the difference | between the joys | of eating | and cooking.

[PAUSE]

A co-creative algorithmic songwriter | would expand | our creative repertoire,

making songwriting accessible | to those who cannot otherwise | enjoy this art-form.

[HOLD]

In the development | of a co-creative songwriting system, | it is desired | that the users | retain creative control,

allowing them to claim ownership | of the resulting works, | or at least experience the process | as an expression of creativity.

The goal is to relieve the burden | of having to master | all of the diverse skills | needed for the creation of a song,

giving users the freedom | to focus on aspects | of the creative process | in which they either specialize | or find most enjoyable.`
  },

  {
    id: 'humble-machine-thesis',
    name: 'The Humble Creative Machine',
    curve: 'induction',
    category: 'ICCC · 2021',
    description: 'A machine less concerned with proving its own independence than with cultivating yours.',
    wpm: 280,
    chunkMode: 'phrase',
    audioPreset: 'silent',
    soundscape: 'faded-signal',
    source: {
      title: 'The Humble Creative Machine',
      authors: 'Christopher Cassion, Margareta Ackerman, Anna Jordanous',
      venue: 'ICCC 2021',
      year: 2021,
      section: 'Abstract & Introduction'
    },
    visualConfig: {
      visualMode: 'interlocution',
      interlocution: {
        sourceFamily: 'procedural',
        procedural: ['fractal'],
        sourced: [],
        frequency: 0.22,
        duration: 1000,
        presentation: 'behind-stream',
        streamGlass: true
      }
    },
    content: `In this paper, | we present a fresh perspective | at co-creativity.

Using human development | as a blueprint, | we argue that fostering | human creativity | is a natural evolution | of creative machines.

[PAUSE]

We introduce the notion | of a "humble" creative machine—

one that is less concerned | with demonstrating | its own independence,

and instead uses | its potentially advanced | creative abilities | to cultivate | human creativity.

[HOLD]

The Association of Computational Creativity | website states:

the goal of computational creativity | is to model, | simulate | or replicate creativity | using a computer,

to design programs | that can enhance | human creativity.

[PAUSE]

In practice, however, | the quoted aim | appears to have been de-emphasized | over the past decade or two.

[HOLD]

This stage in the development | of Computational Creativity | mirrors an analogous stage | in human development,

where a child | begins to differentiate | from their parents | and form their own identity.

[PAUSE]

Individuation is of course | not the final stage | of human development.

When a person reaches individuation, | they soon begin to move | towards taking care of others—

often in the form of parenting.

Analogously, | we would like to propose | that Autonomous Creativity | is not the final aim | of Computational Creativity.

[HOLD]

Another apt analogy | comes from academia.

A PhD student | will often initiate her studies | by learning from her advisor, | relying on the supervisor's vision | and ideas.

As the student progresses | in her studies, | she gradually develops | more of her own ideas,

and eventually becomes | an independent researcher, | often ending up with different views | and research interests | from their advisor.

[PAUSE]

If the student stays in academia, | before long, | she will take on students | of her own,

and generously share | her own vision | in order to help | the development of her students.

Confident in her own | research abilities, | she lets her students | take the spotlight.

[HOLD]

In this paper, | we propose | that Computational Creativity | is now sufficiently advanced | to take on | the mentorship role.

The autonomous | and mentorship roles | need not be conflicting.`
  },

  {
    id: 'humble-machine-characteristics',
    name: 'Flexibility, Learning, Independence',
    curve: 'wave',
    category: 'ICCC · 2021',
    description: 'The criteria: a machine that meets you at your level, then steps back as you grow.',
    wpm: 290,
    chunkMode: 'phrase',
    audioPreset: 'silent',
    soundscape: 'aurora',
    source: {
      title: 'The Humble Creative Machine',
      authors: 'Christopher Cassion, Margareta Ackerman, Anna Jordanous',
      venue: 'ICCC 2021',
      year: 2021,
      section: '§Humble Creative Machines — Flexibility, Learning & Independence, Creative'
    },
    visualConfig: {
      visualMode: 'interlocution',
      interlocution: {
        sourceFamily: 'procedural',
        procedural: ['neural'],
        sourced: [],
        frequency: 0.22,
        duration: 1000,
        presentation: 'behind-stream',
        streamGlass: true
      }
    },
    content: `These criteria, | at their core, | allow the system | and its interactions | to focus on the user | and the user's capabilities

rather than the machine | and what it can | independently.

[HOLD]

FLEXIBILITY

We propose that humble creative machines | should be flexible | in a couple of ways.

The first is flexibility | in its range of interaction.

Ideally, the system should be able | to either do all of the work— | autonomous— | or none of the work— | support tool— | and everything in between.

[PAUSE]

For the novice | who requires | a more guided approach, | the system can offer | heavy support.

Meanwhile, for the expert | who only needs | occasional inspiration, | the system may take | a more passive role,

and be available for the user | as much and when needed.

[PAUSE]

The second type of flexibility | is in the quality | of the output.

Being capable | of sophisticated creative artefacts, | the humble creative machine | is able to consistently provide | expert level engagement | to a user.

However, | the machine should be able | to reduce its own level of expertise | to better meet the user | at their current level | of creative development.

[HOLD]

LEARNING AND INDEPENDENCE

With flexibility, | the system is able | to gradually adjust | its level of interaction | and quality of outputs | to meet the user | at their level of expertise.

This offers | a gradual learning apparatus | tailored to the user.

Similar to teaching | or coaching scenarios, | the system can bridge the gap | in knowledge and expertise.

[PAUSE]

This can gradually change over time | as the user becomes | more of an expert | and needs the system | less and less.

As such, | it is crucial | that the system is able | to step back

and allow the user | to engage more deeply | in the creative process | as they gain | the ability to do so.

[HOLD]

CREATIVE

Being a creative system, | a humble creative machine | should be capable | of making creative contributions | in its co-creative interactions.

At minimum, | it should satisfy P-creativity, | having the ability | to come up with surprising, | valuable ideas | that are new to itself.

We further suggest | that a humble creative machine | should be able to produce output | that is surprising, | valuable, | and new | to their human partner.

[PAUSE]

The "humbleness" of the machine | stems from its willingness | to step aside | and reduce | their own creative contribution

when this would better serve | to cultivate the creative abilities | of their human partner,

and fostering independence— | that is, | helping the user | to develop creative abilities | to the point | that the machine | becomes unnecessary.`
  },

  {
    id: 'sovia-into-the-painting',
    name: 'Into the Painting',
    curve: 'induction',
    category: 'SOVIA · Monet',
    description: 'SOVIA gives Monet\'s landscapes a voice: chimes for flowers, herding bells for hills.',
    wpm: 280,
    chunkMode: 'phrase',
    audioPreset: 'silent',
    soundscape: 'faded-signal',
    source: {
      title: 'SOVIA: Sonification of Visual Interactive Art',
      authors: 'Lauryn Gayhardt, Margareta Ackerman',
      venue: 'Santa Clara University',
      year: 2022,
      section: 'Abstract & Introduction'
    },
    visualConfig: {
      visualMode: 'interlocution',
      interlocution: {
        sourceFamily: 'blend',
        procedural: ['turrell'],
        sourced: ['aic-impressionism', 'aic-landscapes'],
        frequency: 0.24,
        duration: 1400,
        presentation: 'behind-stream',
        streamGlass: true
      }
    },
    content: `This paper presents SOVIA, | an interactive system | that endows Claude Monet's art | with responsive | auditory experiences.

SOVIA uses computer vision | trained on Monet's artwork | to take the user | "into the painting."

[PAUSE]

When the user interacts | with a digital version | of Monet's landscapes,

their mouse positions | are mapped to sounds | that artistically represent | the objects | that the user | is currently exploring in the art.

These interactive musical journeys | have the potential | to make classical art | more captivating | for modern audiences.

[HOLD]

Visual art uses color, | light, | texture, | and stroke techniques | to convey the mood, | tone, | and meaning | of the artwork.

Every layer of information | aids in expressing | the artist's intent.

Adding music and sound | to a painting | can assist in creating | more depth, | strengthen existing themes,

and convert | a consumption-based experience | to an interactive one.

[PAUSE]

Monet was a French impressionist artist | and the first | to paint outside the studio.

He aimed to capture | "what is seen | rather than what is known."

[HOLD]

Instead of trying | to accurately reproduce | the scene before him | in detail,

Monet aimed to record | on the spot | the impression | that relaxed, | momentary vision | might receive—

what is seen | rather than what is known, | with all its vitality | and movement.

[PAUSE]

To reflect this balance | of the literal | and metaphorical, | SOVIA adds | an auditory dimension | that intermixes real sounds | with musical elements.

[HOLD]

When the user glides their mouse | over a hill | they will hear sounds | of herding bells | through the background music.

If the user's mouse wanders | over flowers, | chimes will play,

similar to what one may hear | in a garden | as a soft wind | floats by.

[PAUSE]

This mixture of music | with realistic | and associated sounds | creates an experience | that mimics realistic elements | in the art,

while reflecting | the gentle artistic reinterpretation | of those objects | through sound.

[HOLD]

We hope that the process | proposed here | will inspire more research | into how creative machine agents | can be used | to enliven | classical art forms.`
  },

  {
    id: 'viflow-freedom-of-movement',
    name: 'Freedom of Movement',
    curve: 'ascent',
    category: 'ViFlow · Dance',
    description: 'Augmented reality that follows the dancer, instead of making the dancer follow the video.',
    wpm: 310,
    chunkMode: 'phrase',
    audioPreset: 'silent',
    soundscape: 'aurora',
    source: {
      title: 'Interactive Augmented Reality for Dance',
      authors: 'Taylor Brockhoeft, Jennifer Petuch, James Bach, Emil Djerekarov, Margareta Ackerman, Gary Tyson',
      venue: 'ICCC 2016 · Florida State University',
      year: 2016,
      section: 'Abstract, Introduction & Conclusions'
    },
    // Pure harmonograph: a pendulum tracing its own path is ViFlow's
    // mechanism rendered as image. Klee flashes and static paintings
    // would contradict the passage arguing that pre-rendered video
    // destroys the dancer's freedom of movement. The text's semantic
    // signal (valence 0.55 / arousal 0.51) is the only one in the vault
    // that reaches solarFlare, so the climate is pinned to what the
    // conductor independently chose.
    visualConfig: {
      visualMode: 'interlocution',
      interlocution: {
        sourceFamily: 'procedural',
        procedural: ['harmonograph'],
        harmonographClimate: 'solarFlare',
        sourced: [],
        frequency: 0.26,
        duration: 200,
        presentation: 'full-frame'
      }
    },
    content: `Like the overlap | in a Venn diagram, | shared kinesthetic | and intellectual constructs

from the field of dance | and the field of technology | will reinforce | and enhance one another,

resulting in | an ultimately deepened experience | for both viewer | and performer.

[HOLD]

With the rise of the digital age, | dancers and choreographers | started looking for new ways | to connect with younger audiences.

This led to the growing popularity | of multimedia performances | where digitally projected spaces | appear to be influenced | by dancers' movements.

[PAUSE]

Unfortunately | current approaches, | such as reliance | on pre-rendered videos, | merely create | the illusion of interaction

when in fact the dancers | are actually closely synchronized | with the multimedia display | to create the illusion.

[PAUSE]

This calls for | unprecedented accuracy | of movement and timing | on the part of the dancers,

which increases cost | and rehearsal time, | as well as greatly limits | the dancers' creative expression.

[HOLD]

The dancers must rehearse extensively | to stay in sync | with the video.

This approach restricts | the range of motion | available to dancers | as they must align | with a precise location | and timing.

This not only sets limits | on improvisation, | but restricts the development | of creative expression | and movement invention.

If a dancer | even slightly misses a cue, | the illusion is ineffective | and distracting | for the viewer.

[PAUSE]

We propose | the first truly interactive solution | for integrating digital spaces | into dance performance: | ViFlow.

Our approach is simple, | cost effective, | and fully interactive | in real-time,

allowing the dancers | to retain full freedom | of movement | and creative expression.

[HOLD]

A movement-based language | enables choreographers | to directly interact with ViFlow,

empowering them | to independently create | fully interactive, | live augmented reality productions.

[PAUSE]

This is achieved | by moving the creation | of visual projection effects | from the computer keyboard | to the performance stage,

in a manner | more closely matching | the dance choreographic construction.

[HOLD]

The use of ViFlow | empowers dancers | to explore visualization techniques | dynamically,

at the same time | and in the same manner | as they explore dance technique | and movement invention | in the construction | of a new performance.

[PAUSE]

Through digital technology, | dance thrives.`
  }
];

// Archetype tuned for research-oriented reading. Individual sequences
// carry their own visual identity; this is the house style they inherit
// from when they do not state one.
export const VAULT_A_ARCHETYPE = {
  id: 'researcher',
  name: 'The Researcher',
  sigil: '◈',
  focus: 'Analytical Contemplation',
  description: 'Optimized for absorbing academic and philosophical content. Balanced pacing allows for both comprehension and reflection.',
  textSeed: 'Computational Creativity Research',
  config: {
    wpm: 290,
    curve: 'wave',
    // Phrase chunking is the vault's reading unit — the authored `|`
    // boundaries are what each atom is built from
    chunkMode: 'phrase',
    // A soundscape is a finished mix, so the pure-tone preset rests
    // (exclusive beds). Sequences alternate Faded Signal and Aurora.
    audioPreset: 'silent',
    soundscape: 'faded-signal',
    visualConfig: {
      visualMode: 'interlocution',
      interlocution: {
        sourceFamily: 'procedural',
        procedural: ['fractal', 'neural'],
        sourced: [],
        frequency: 0.22,
        duration: 1000,
        presentation: 'behind-stream',
        streamGlass: true
      }
    }
  },
  sequences: [
    'alysia-co-creative-process',
    'alysia-eating-and-cooking',
    'humble-machine-thesis',
    'humble-machine-characteristics',
    'sovia-into-the-painting',
    'viflow-freedom-of-movement'
  ]
};
