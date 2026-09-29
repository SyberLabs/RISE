/**
 * The names of the colour themes, without the colours.
 *
 * The session model only needs to know whether a theme NAME is one RISE ships,
 * and it is part of what loads before Home paints. The colours themselves
 * (jev-palette.js) are needed only once a reading is composed or played, so they
 * stay out of that first load. jev-palette.test.js holds the two to each other.
 */
export const JEV_COLOR_THEMES = Object.freeze(['classic', 'amethyst', 'prism', 'ember', 'cobalt', 'jade']);

export const isJevColorTheme = id => JEV_COLOR_THEMES.includes(id);
