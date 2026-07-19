/**
 * Personalized Vault A
 *
 * Curated selections on computational creativity,
 * generative music systems, and human-AI co-creation.
 */

export const VAULT_A_SEQUENCES = [
  {
    id: 'alysia-origins',
    name: 'The ALYSIA Vision',
    curve: 'induction',
    category: 'research',
    description: 'The foundational vision of algorithmic songwriting as human-AI partnership.',
    wpm: 140,
    audioPreset: 'gateway',
    content: `ALYSIA: | Automated Lyrical Songwriting Application.

A new approach | to writing songs | that requires minimal | to no musical training.

The system makes it easy | to explore melodic lines, | reducing songwriting | to the ability | to select melodies | based on one's musical taste.

This is not replacement.
This is amplification.

The creativity comes | from both parties— | human intuition | meeting machine possibility.

We trained Random Forests | to predict pitch and rhythm.

Not to compose in isolation.

But to offer.

The human chooses.

The human always chooses.

The machine expands the space | of what can be chosen.

ALYSIA was the first | songwriting system | whose songs were recorded | and produced.

Not as novelty.

As music.

Real songs, | born from the collaboration | between human intention | and algorithmic suggestion.

The future of automated songwriting | lies not in autonomous systems | that create without us—

But in co-creative systems | that create with us.

The tool becomes a partner.

The partner becomes a mirror.

In the mirror, | we see our own creativity | reflected, | refracted, | expanded.

This is the vision:

AI that elevates | human creativity | rather than replaces it.`
  },

  {
    id: 'computational-creativity-defined',
    name: 'What Is Computational Creativity?',
    curve: 'wave',
    category: 'philosophy',
    description: 'Defining the field that asks: can machines be creative?',
    wpm: 130,
    audioPreset: 'gateway',
    content: `Computational Creativity | is an emerging subfield | of Artificial Intelligence.

It studies the potential | for computers to be | more than feature-rich tools.

Instead: | to act as autonomous creators | and co-creators | in their own right.

Consider the distinction carefully:

In a traditional tool, | creativity comes from the user.

In a Computational Creativity system, | the creativity comes | from the machine.

Or—in a hybrid system— | a joint impetus may come | from both parties.

This is the question | that animates the field:

Can a machine be creative?

Not: | can a machine produce outputs | that appear creative?

But: | can the machine itself | participate in the creative act?

Computational Creativity | can also be defined | as the computational analysis | or synthesis of works of art, | in a partially | or fully automated way.

Analysis. | Synthesis. | Partial. | Full.

The spectrum is wide.

At one end: | tools that assist.

At the other: | systems that originate.

In the middle: | the most interesting space.

The space | where human and machine meet.

Where intention meets generation.

Where taste meets possibility.

This is where the new forms emerge.`
  },

  {
    id: 'creative-machines-reflection',
    name: 'Creative Machines: A Reflection',
    curve: 'induction',
    category: 'philosophy',
    description: 'On the true capabilities and limitations of generative AI.',
    wpm: 120,
    audioPreset: 'gateway',
    content: `We must cut through the hype.

Generative AI | has true capabilities.

It also has true limitations.

The hype obscures both.

Let us be clear | about what these systems can do:

They can traverse | vast spaces of possibility.

They can suggest combinations | no human would stumble upon.

They can iterate tirelessly.

They can learn patterns | from the accumulated | creative output of humanity.

Let us also be clear | about what they cannot do:

They do not understand meaning.

They do not feel the weight | of a word.

They do not know | why one melody moves us | and another does not.

They do not have taste.

But here is the insight | that changes everything:

They do not need to.

Because you do.

You have meaning. | You feel weight. | You know what moves you. | You have taste.

The machine offers. | You choose.

The machine generates. | You curate.

The machine expands. | You direct.

This is not a diminishment of AI.

This is an accurate understanding | of its role.

And in that understanding, | its potential to amplify | human creativity | becomes clear.

Not replacement.

Amplification.

The creative machine | is not creative alone.

The creative machine | is creative with us.`
  },

  {
    id: 'the-co-creative-future',
    name: 'The Co-Creative Future',
    curve: 'ascent',
    category: 'vision',
    description: 'A vision of human-AI creative partnership.',
    wpm: 150,
    audioPreset: 'gateway',
    content: `Imagine a future | where millions of creators | express themselves—

Not despite AI, | but through it.

With it.

Alongside it.

The songwriter | who never learned music theory | finds melodies flowing | through algorithmic suggestion.

The poet | who struggles with form | discovers structures | that carry their meaning further.

The artist | who sees images | they cannot render | finds a system | that can translate vision | into visible.

This is not the death | of human creativity.

This is its democratization.

The tools of creation, | once gated | by years of technical training, | become accessible to anyone | with something to say.

And everyone | has something to say.

The question was never | whether AI could be creative.

The question was always: | what happens | when AI creativity | and human creativity meet?

The answer is emerging now.

In studios | and bedrooms | and classrooms | around the world.

In the hands of professionals | and amateurs alike.

In the space between | intention and generation.

The co-creative future | is not coming.

It is here.

You are living in it.

You are shaping it.

Every choice you make— | to use these tools, | to direct them, | to curate their outputs—

Is a choice that defines | what human-AI creativity becomes.

The machine learns from us.

We learn from the machine.

Together, | we become something | neither could be alone.

This is the promise.

This is the work.

This is the future | we are building.`
  }
];

// Archetype tuned for research-oriented reading
export const VAULT_A_ARCHETYPE = {
  id: 'researcher',
  name: 'The Researcher',
  sigil: '◈',
  focus: 'Analytical Contemplation',
  description: 'Optimized for absorbing academic and philosophical content. Balanced pacing allows for both comprehension and reflection.',
  textSeed: 'Computational Creativity Research',
  config: {
    wpm: 270,
    curve: 'wave',
    audioPreset: 'focus',
    visualConfig: {
      visualMode: 'interlocution',
      interlocution: {
        sourceFamily: 'procedural',
        // Fractal Flames + Neural Networks - both procedurally generated
        // Neural networks thematically aligned with the vault content
        procedural: ['fractal', 'neural'],
        sourced: [],
        frequency: 0.30,
        duration: 150
      }
    }
  },
  sequences: ['alysia-origins', 'computational-creativity-defined', 'creative-machines-reflection', 'the-co-creative-future']
};
