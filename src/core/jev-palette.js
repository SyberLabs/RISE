/** Exact Chamber color sets Jev may select. No model-supplied CSS reaches the renderer. */
export const JEV_PALETTES = Object.freeze({
  classic: Object.freeze({ background: '#08090F', text: '#F4EEE4', accent: '#C8AE83' }),
  amethyst: Object.freeze({ background: '#140B20', text: '#F6EFFF', accent: '#BB8CFF' }),
  prism: Object.freeze({ background: '#0A0619', text: '#F4F4FF', accent: '#E84BFF' }),
  ember: Object.freeze({ background: '#1C0B0A', text: '#FFF0E4', accent: '#FF9A5A' }),
  cobalt: Object.freeze({ background: '#071326', text: '#EDF6FF', accent: '#58B8FF' }),
  jade: Object.freeze({ background: '#061912', text: '#E8FFF4', accent: '#4CE6A4' }),
  rose: Object.freeze({ background: '#1A0414', text: '#FFF0F4', accent: '#FF5C93' }),
  citrine: Object.freeze({ background: '#101205', text: '#FAFBE6', accent: '#E4DA3C' }),
  silver: Object.freeze({ background: '#111215', text: '#F5F6F8', accent: '#B4C3D6' })
});

/** Distinct light inks that remain readable over every offered dark ground. */
export const JEV_INKS = Object.freeze({
  classic: '#F4EEE4',
  amethyst: '#DDBAFF',
  prism: '#FFC4F2',
  ember: '#FFE095',
  cobalt: '#A8F1FF',
  jade: '#AFFFCE',
  rose: '#FFB3B8',
  citrine: '#EAF57A',
  silver: '#C9D0DA'
});

/** What the reader's Text and Backdrop pickers call each theme's ink and ground. */
export const JEV_COLOR_NAMES = Object.freeze({
  classic: Object.freeze({ ink: 'Ivory', ground: 'Night' }),
  amethyst: Object.freeze({ ink: 'Lilac', ground: 'Violet' }),
  prism: Object.freeze({ ink: 'Rose', ground: 'Prism' }),
  ember: Object.freeze({ ink: 'Gold', ground: 'Ember' }),
  cobalt: Object.freeze({ ink: 'Cyan', ground: 'Cobalt' }),
  jade: Object.freeze({ ink: 'Mint', ground: 'Jade' }),
  rose: Object.freeze({ ink: 'Blush', ground: 'Wine' }),
  citrine: Object.freeze({ ink: 'Lemon', ground: 'Olive' }),
  silver: Object.freeze({ ink: 'Silver', ground: 'Graphite' })
});

export function jevPalette(id) {
  return Object.hasOwn(JEV_PALETTES, id) ? JEV_PALETTES[id] : null;
}

/** Resolve named choices to shipped ink, ground, and accent colors. */
export function jevColors(colorTheme, textColor, backgroundColor = colorTheme) {
  const theme = jevPalette(colorTheme);
  const ink = textColor == null ? theme?.text
    : Object.hasOwn(JEV_INKS, textColor) ? JEV_INKS[textColor] : null;
  const ground = jevPalette(backgroundColor);
  return theme && ink && ground
    ? { background: ground.background, text: ink, accent: theme.accent }
    : null;
}
