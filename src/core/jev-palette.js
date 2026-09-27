/** Exact Chamber color sets Jev may select. No model-supplied CSS reaches the renderer. */
export const JEV_PALETTES = Object.freeze({
  classic: Object.freeze({ background: '#08090F', text: '#F4EEE4', accent: '#C8AE83' }),
  amethyst: Object.freeze({ background: '#140B20', text: '#F6EFFF', accent: '#BB8CFF' }),
  prism: Object.freeze({ background: '#0A0619', text: '#F4F4FF', accent: '#E84BFF' }),
  ember: Object.freeze({ background: '#1C0B0A', text: '#FFF0E4', accent: '#FF9A5A' }),
  cobalt: Object.freeze({ background: '#071326', text: '#EDF6FF', accent: '#58B8FF' }),
  jade: Object.freeze({ background: '#061912', text: '#E8FFF4', accent: '#4CE6A4' })
});

export function jevPalette(id) {
  return Object.hasOwn(JEV_PALETTES, id) ? JEV_PALETTES[id] : null;
}
