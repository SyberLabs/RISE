/**
 * Styles: named bundles a v2 Current selects with `style`
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §11).
 *
 * A style is data. Its `line` is the one sentence the tool's description
 * gives it; its `typography` is what a beat that sets no place, size or face
 * takes (lowered in beats.js, in the words beats use); its `library` is what
 * a generated scene's `rise.lib` call leaves out (scene-library.js
 * LIBRARY_DEFAULTS names every key it reads). The guidance a model reads for
 * a style lives with the guide (src/live/guide/styles/), not here, so the
 * card and the Worker carry the defaults without the prose.
 *
 * Label faces name RISE's own faces first; a scene worker loads no fonts in
 * this stage, so a label falls back along the stack to the system's face.
 */
import { resolveTypeFace } from './typography.js';

const family = role => resolveTypeFace(role).family;

const style = record => Object.freeze({
  ...record,
  library: Object.freeze({ ...record.library }),
  typography: Object.freeze({ ...record.typography, type: Object.freeze({ ...record.typography.type }) })
});

export const STYLES = Object.freeze({
  'premium-educational': style({
    id: 'premium-educational',
    line: 'premium-educational: a calm lesson of clear narrated diagrams, one idea per beat, labelled figures and short captions under a drawn scene that explains one step at a time.',
    typography: { place: 'caption', size: 'as-set', type: { text: 'book-serif', caption: 'humanist-sans' } },
    library: { ease: 'smooth', stroke: 2.5, gridAlpha: 0.12, labelFont: `15px ${family('humanist-sans')}` }
  }),
  'open-field': style({
    id: 'open-field',
    line: 'open-field: free expression, the words in the centre over a look or a scene of your own, display faces welcome, livelier motion.',
    // No face for the text: a look brings its own, and the reader's setting stands where there is none.
    typography: { place: 'centre', size: 'as-set', type: { caption: 'display-serif' } },
    library: { ease: 'out', stroke: 2, gridAlpha: 0.25, labelFont: `16px ${family('display-serif')}` }
  })
});

/** The style a Current names, or null. */
export function styleOf(id) {
  return typeof id === 'string' && Object.hasOwn(STYLES, id) ? STYLES[id] : null;
}
