/**
 * What each theme and look is for, in words a model can choose by. The guide
 * names every one (index.test.js holds the lists to the validator's).
 */

/** What each theme is for, in the theme order. */
export const THEME_HINTS = Object.freeze({
    classic: 'ivory and gold, for history, literature and ideas',
    amethyst: 'violet, for the mind, dreams and music',
    prism: 'magenta and cyan, for technology, cities and speed',
    ember: 'fire red, for warmth, conflict and passion',
    cobalt: 'deep blue, for space, the sea and physics',
    jade: 'green, for nature, life and health',
    rose: 'rose pink, for love, family, poetry and art',
    citrine: 'lemon yellow, for food, travel and play',
    silver: 'silver grey, for money, law, mathematics and the news'
});

/**
 * What each look shows in the card, in the look order. No look promises
 * sound: the card plays the spoken voice and no bed under it.
 */
export const LOOK_HINTS = Object.freeze({
    plain: 'the words alone, nothing behind them',
    gallery: 'soft light dissolving slowly behind the words',
    nocturne: 'soft light and fine traced lines at a slow pace',
    garden: 'a line drawing growing behind the words',
    flame: 'a living flame breathing behind the words',
    signal: 'a strange attractor circling the words',
    iris: 'spectral plates turning behind the words',
    revel: 'fractal flames at a lively pace',
    vigil: 'one quiet image, held',
    inlay: 'fractal flames behind the words, in a heavy face'
});
