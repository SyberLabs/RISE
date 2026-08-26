/**
 * Face, Size, and Ink sit beside the visual taxonomy in the Navigator
 * directory. They are text material, not field leaves — kept here so the
 * tree in visual-taxonomy.js stays a field tree.
 */
import { VISUAL_TAXONOMY } from './visual-taxonomy.js';

export const TEXT_CONTROLS = Object.freeze([
  Object.freeze({ id: 'face', label: 'Face', textControl: true }),
  Object.freeze({ id: 'size', label: 'Size', textControl: true }),
  Object.freeze({ id: 'ink', label: 'Ink', textControl: true })
]);

export const ROOT_WITH_TEXT = Object.freeze([...VISUAL_TAXONOMY.children, ...TEXT_CONTROLS]);
