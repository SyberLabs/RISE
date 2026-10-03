/** Exact Chamber color sets Jev may select. No model-supplied CSS reaches the renderer. */
export const JEV_PALETTES = Object.freeze({
  classic: Object.freeze({ background: '#08090F', text: '#F4EEE4', accent: '#C8AE83' }),
  amethyst: Object.freeze({ background: '#140B20', text: '#F6EFFF', accent: '#BB8CFF' }),
  prism: Object.freeze({ background: '#0A0619', text: '#F4F4FF', accent: '#E84BFF' }),
  ember: Object.freeze({ background: '#1C0B0A', text: '#FFF0E4', accent: '#FF9A5A' }),
  cobalt: Object.freeze({ background: '#071326', text: '#EDF6FF', accent: '#58B8FF' }),
  jade: Object.freeze({ background: '#061912', text: '#E8FFF4', accent: '#4CE6A4' })
});

/** Distinct light inks that remain readable over every offered dark ground. */
export const JEV_INKS = Object.freeze({
  classic: '#F4EEE4',
  amethyst: '#DDBAFF',
  prism: '#FFC4F2',
  ember: '#FFE095',
  cobalt: '#A8F1FF',
  jade: '#AFFFCE'
});

/**
 * Human labels for the same closed color vocabulary. Derived from the shipped
 * palette ids so the Chamber picker cannot invent a seventh color family.
 */
export const JEV_COLOR_NAMES = Object.freeze(Object.fromEntries(
  Object.keys(JEV_PALETTES).map(id => {
    const name = id[0].toUpperCase() + id.slice(1);
    return [id, Object.freeze({ ink: `${name} text`, ground: `${name} backdrop` })];
  })
));

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
