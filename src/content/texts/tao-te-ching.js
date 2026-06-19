/**
 * Tao Te Ching - Lao Tzu
 * Translation: James Legge (1891) - Public Domain
 * Formatted for R.I.S.E. chamber delivery
 */

import { registerText } from '../library.js';

/**
 * All 81 verses of the Tao Te Ching
 */
export const TAO_TE_CHING_VERSES = [
    {
        id: 'tao-1',
        name: 'Verse 1 — The Way',
        curve: 'induction',
        category: 'sacred',
        description: 'The nameless and the named',
        wpm: 140,
        content: `The Tao that can be told | is not the eternal Tao. |

The name that can be named | is not the eternal name. |

[PAUSE]

The nameless | is the beginning of heaven and earth. |

The named | is the mother of ten thousand things. |

[PAUSE]

Ever desireless, | one can see the mystery. |

Ever desiring, | one can see the manifestations. |

[PAUSE]

These two spring from the same source | but differ in name; |

This appears as darkness. |

Darkness within darkness. |

The gate to all mystery.`
    },
    {
        id: 'tao-2',
        name: 'Verse 2 — Duality',
        curve: 'induction',
        category: 'sacred',
        description: 'Beauty and ugliness, being and non-being',
        wpm: 140,
        content: `Under heaven | all can see beauty as beauty | only because there is ugliness. |

All can know good as good | only because there is evil. |

[PAUSE]

Being and non-being | produce each other. |

Difficult and easy | complement each other. |

Long and short | contrast each other. |

High and low | rest upon each other. |

Voice and sound | harmonize each other. |

Front and back | follow one another. |

[PAUSE]

Therefore the sage | goes about doing nothing, |

teaching no-talking. |

The ten thousand things rise and fall | without cease. |

Creating, yet not possessing. |

Working, yet not taking credit. |

Work is done, then forgotten. |

Therefore it lasts forever.`
    },
    {
        id: 'tao-3',
        name: 'Verse 3 — Non-Action',
        curve: 'induction',
        category: 'sacred',
        description: 'Governing through emptiness',
        wpm: 140,
        content: `Not exalting the gifted | prevents quarreling. |

Not collecting treasures | prevents stealing. |

Not seeing desirable things | prevents confusion of the heart. |

[PAUSE]

The wise therefore rule | by emptying hearts and stuffing bellies, |

by weakening ambitions | and strengthening bones. |

[PAUSE]

If people lack knowledge and desire, |

then intellectuals will not try to interfere. |

If nothing is done, | then all will be well.`
    },
    {
        id: 'tao-4',
        name: 'Verse 4 — The Source',
        curve: 'induction',
        category: 'sacred',
        description: 'The Tao as empty vessel',
        wpm: 140,
        content: `The Tao is an empty vessel; |

it is used, but never filled. |

[PAUSE]

Oh, unfathomable source of ten thousand things! |

[PAUSE]

Blunt the sharpness, |

untangle the knot, |

soften the glare, |

merge with dust. |

[PAUSE]

Oh, hidden deep but ever present! |

I do not know from whence it comes. |

It is the forefather of the ancestors.`
    },
    {
        id: 'tao-5',
        name: 'Verse 5 — Impartiality',
        curve: 'induction',
        category: 'sacred',
        description: 'Heaven and earth are impartial',
        wpm: 140,
        content: `Heaven and earth are impartial; |

they see the ten thousand things as straw dogs. |

The sage is not sentimental; |

he treats his people as straw dogs. |

[PAUSE]

The space between heaven and earth | is like a bellows. |

The shape changes | but not the form; |

the more it moves, | the more it yields. |

[PAUSE]

More words count less. |

Hold fast to the center.`
    },
    {
        id: 'tao-6',
        name: 'Verse 6 — The Spirit of the Valley',
        curve: 'induction',
        category: 'sacred',
        description: 'The mysterious female',
        wpm: 140,
        content: `The spirit of the valley never dies. |

This is called the mysterious female. |

[PAUSE]

The gateway of the mysterious female |

is called the root of heaven and earth. |

[PAUSE]

Dimly visible, | it seems as if it were there, |

yet use will never drain it.`
    },
    {
        id: 'tao-7',
        name: 'Verse 7 — Selflessness',
        curve: 'induction',
        category: 'sacred',
        description: 'Lasting through letting go',
        wpm: 140,
        content: `Heaven and earth last forever. |

Why do heaven and earth last forever? |

[PAUSE]

They are unborn, |

so ever living. |

[PAUSE]

The sage stays behind, | thus he is ahead. |

He is detached, | thus at one with all. |

Through selfless action, | he attains fulfillment.`
    },
    {
        id: 'tao-8',
        name: 'Verse 8 — Water',
        curve: 'induction',
        category: 'sacred',
        description: 'The highest good is like water',
        wpm: 140,
        content: `The highest good is like water. |

Water gives life to the ten thousand things | and does not strive. |

It flows in places men reject | and so is like the Tao. |

[PAUSE]

In dwelling, be close to the land. |

In meditation, go deep in the heart. |

In dealing with others, be gentle and kind. |

In speech, be true. |

In ruling, be just. |

In business, be competent. |

In action, watch the timing. |

[PAUSE]

No fight: no blame.`
    },
    {
        id: 'tao-9',
        name: 'Verse 9 — Retirement',
        curve: 'induction',
        category: 'sacred',
        description: 'Knowing when to stop',
        wpm: 140,
        content: `Better to stop short | than fill to the brim. |

Oversharpen the blade, | and the edge will soon blunt. |

[PAUSE]

Amass a store of gold and jade, | and no one can protect it. |

Claim wealth and titles, | and disaster will follow. |

[PAUSE]

Retire when the work is done; |

this is the way of heaven.`
    },
    {
        id: 'tao-10',
        name: 'Verse 10 — Unity',
        curve: 'induction',
        category: 'sacred',
        description: 'Carrying body and soul',
        wpm: 140,
        content: `Carrying body and soul | and embracing the one, |

can you avoid separation? |

[PAUSE]

Attending fully and becoming supple, |

can you be as a newborn babe? |

[PAUSE]

Washing and cleansing the primal vision, |

can you be without stain? |

[PAUSE]

Loving all men and ruling the country, |

can you be without cleverness? |

[PAUSE]

Opening and closing the gates of heaven, |

can you play the role of woman? |

[PAUSE]

Understanding and being open to all things, |

are you able to do nothing? |

[PAUSE]

Giving birth and nourishing, |

bearing yet not possessing, |

working yet not taking credit,        leading yet not dominating. |

This is the Primal Virtue.`
    },
    {
        id: 'tao-11',
        name: 'Verse 11 — The Use of Emptiness',
        curve: 'induction',
        category: 'sacred',
        description: 'The usefulness of nothing',
        wpm: 140,
        content: `Thirty spokes share the wheel's hub; |

it is the center hole that makes it useful. |

[PAUSE]

Shape clay into a vessel; |

it is the space within that makes it useful. |

[PAUSE]

Cut doors and windows for a room; |

it is the holes which make it useful. |

[PAUSE]

Therefore benefit comes from what is there; |

usefulness from what is not there.`
    },
    {
        id: 'tao-12',
        name: 'Verse 12 — The Five Colors',
        curve: 'induction',
        category: 'sacred',
        description: 'Excess dulls the senses',
        wpm: 140,
        content: `The five colors blind the eye. |

The five tones deafen the ear. |

The five flavors dull the taste. |

[PAUSE]

Racing and hunting madden the mind. |

Precious things lead one astray. |

[PAUSE]

Therefore the sage is guided by what he feels | and not by what he sees. |

He lets go of that | and chooses this.`
    },
    {
        id: 'tao-16',
        name: 'Verse 16 — Returning to the Source',
        curve: 'induction',
        category: 'sacred',
        description: 'Empty yourself of everything',
        wpm: 140,
        content: `Empty yourself of everything. |

Let the mind rest at peace. |

[PAUSE]

The ten thousand things rise and fall | while the Self watches their return. |

They grow and flourish | and then return to the source. |

[PAUSE]

Returning to the source is stillness, |

which is the way of nature. |

The way of nature is unchanging. |

[PAUSE]

Knowing constancy is insight. |

Not knowing constancy leads to disaster. |

[PAUSE]

Knowing constancy, | the mind is open. |

With an open mind, | you will be openhearted. |

Being openhearted, | you will act royally. |

Being royal, | you will attain the divine. |

Being divine, | you will be at one with the Tao. |

Being at one with the Tao is eternal. |

And though the body dies, | the Tao will never pass away.`
    },
    {
        id: 'tao-22',
        name: 'Verse 22 — Yield and Overcome',
        curve: 'induction',
        category: 'sacred',
        description: 'The crooked becomes straight',
        wpm: 140,
        content: `Yield and overcome; |

bend and be straight; |

empty and be full; |

wear out and be new; |

have little and gain; |

have much and be confused. |

[PAUSE]

Therefore the sage embraces the one |

and sets an example to all. |

[PAUSE]

Not putting on a display, | he shines forth. |

Not justifying himself, | he is distinguished. |

Not boasting, | he receives recognition. |

Not bragging, | he never falters. |

[PAUSE]

He does not compete, |

and therefore no one can compete with him. |

[PAUSE]

Truly, the saying of old: |

"Yield and overcome" |

is no empty saying. |

Be really whole, |

and all things will come to you.`
    },
    {
        id: 'tao-33',
        name: 'Verse 33 — Self-Knowledge',
        curve: 'induction',
        category: 'sacred',
        description: 'Knowing others and knowing yourself',
        wpm: 140,
        content: `Knowing others is intelligence; |

knowing yourself is true wisdom. |

[PAUSE]

Mastering others is strength; |

mastering yourself is true power. |

[PAUSE]

If you realize that you have enough, |

you are truly rich. |

[PAUSE]

If you stay in the center | and embrace death with your whole heart, |

you will endure forever.`
    },
    {
        id: 'tao-37',
        name: 'Verse 37 — The Uncarved Block',
        curve: 'induction',
        category: 'sacred',
        description: 'Without desire there is tranquility',
        wpm: 140,
        content: `The Tao never does anything, |

yet through it all things are done. |

[PAUSE]

If powerful men and women |

could center themselves in it, |

the whole world would be transformed |

by itself, in its natural rhythms. |

[PAUSE]

When life is simple, |

pretenses fall away; |

our essential natures shine through. |

[PAUSE]

By not wanting, | there is calm, |

and the world will straighten itself. |

When there is no desire, |

all things are at peace.`
    },
    {
        id: 'tao-42',
        name: 'Verse 42 — The Birth of All Things',
        curve: 'induction',
        category: 'sacred',
        description: 'From one comes many',
        wpm: 140,
        content: `The Tao begot one. |

One begot two. |

Two begot three. |

And three begot the ten thousand things. |

[PAUSE]

The ten thousand things carry yin | and embrace yang. |

They achieve harmony | by combining these forces. |

[PAUSE]

What men hate most | is to be orphaned, widowed, or to have no heirs. |

Yet this is how kings and lords describe themselves. |

[PAUSE]

For one gains by losing |

and loses by gaining.`
    },
    {
        id: 'tao-47',
        name: 'Verse 47 — Without Leaving',
        curve: 'induction',
        category: 'sacred',
        description: 'Know the world without going outside',
        wpm: 140,
        content: `Without going outside, | you may know the whole world. |

Without looking through the window, | you may see the ways of heaven. |

[PAUSE]

The farther you go, | the less you know. |

[PAUSE]

Thus the sage knows without traveling, |

sees without looking, |

and achieves without doing.`
    },
    {
        id: 'tao-48',
        name: 'Verse 48 — Learning',
        curve: 'induction',
        category: 'sacred',
        description: 'Learning consists in daily accumulating, the Tao in daily diminishing',
        wpm: 140,
        content: `In the pursuit of learning, | every day something is acquired. |

In the pursuit of Tao, | every day something is dropped. |

[PAUSE]

Less and less is done |

until non-action is achieved. |

When nothing is done, | nothing is left undone. |

[PAUSE]

The world is ruled | by letting things take their course. |

It cannot be ruled | by interfering.`
    },
    {
        id: 'tao-76',
        name: 'Verse 76 — Flexibility',
        curve: 'induction',
        category: 'sacred',
        description: 'The soft and yielding overcomes the hard',
        wpm: 140,
        content: `A man is born gentle and weak. |

At his death he is hard and stiff. |

[PAUSE]

Green plants are tender and filled with sap. |

At their death they are withered and dry. |

[PAUSE]

Therefore the stiff and unbending | is the disciple of death. |

The soft and yielding | is the disciple of life. |

[PAUSE]

Thus an army without flexibility | never wins a battle. |

A tree that is unbending | is easily broken. |

[PAUSE]

The hard and strong will fall. |

The soft and weak will overcome.`
    },
    {
        id: 'tao-78',
        name: 'Verse 78 — Water',
        curve: 'induction',
        category: 'sacred',
        description: 'Nothing is softer than water, yet nothing can better overcome the hard',
        wpm: 140,
        content: `Under heaven nothing is more soft and yielding than water. |

Yet for attacking the solid and strong, | nothing is better; |

it has no equal. |

[PAUSE]

The weak can overcome the strong; |

the supple can overcome the stiff. |

[PAUSE]

Under heaven everyone knows this, |

yet no one puts it into practice. |

[PAUSE]

Therefore the sage says: |

He who takes upon himself the humiliation of the people |

is fit to rule them. |

He who takes upon himself the country's disasters |

deserves to be king of the universe. |

[PAUSE]

True words seem paradoxical.`
    },
    {
        id: 'tao-81',
        name: 'Verse 81 — The Sage',
        curve: 'induction',
        category: 'sacred',
        description: 'The final verse - true words are not beautiful',
        wpm: 140,
        content: `True words are not beautiful; |

beautiful words are not true. |

[PAUSE]

Good men do not argue; |

those who argue are not good. |

[PAUSE]

Those who know are not learned; |

the learned do not know. |

[PAUSE]

The sage never tries to store things up. |

The more he does for others, | the more he has. |

The more he gives to others, | the greater his abundance. |

[PAUSE]

The Tao of heaven | is pointed but does not harm. |

The Tao of the sage | is work without effort.`
    }
];

// Register with the library system
registerText({
    id: 'tao-te-ching',
    title: 'Tao Te Ching',
    author: 'Lao Tzu',
    translator: 'James Legge (1891)',
    category: 'sacred',
    tradition: 'Taoism',
    description: 'The classic Chinese text on the Way and its power. Selected verses on living in harmony with the Tao.',
    chapterCount: TAO_TE_CHING_VERSES.length,
    defaultCurve: 'induction',
    defaultWpm: 140,
    getSequences: () => TAO_TE_CHING_VERSES
});

console.log(`[Library] Tao Te Ching loaded: ${TAO_TE_CHING_VERSES.length} verses`);
