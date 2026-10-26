import { speakable } from '../core/math-typeset.js';

/**
 * The typesetter as a runtime test on fake timers needs it: settled at once, so a Current with maths is not held
 * on a real dynamic import the fake clock cannot advance; formulas are said as their plain reading.
 */
export const SETTLED_MATHS = Object.freeze({ load: () => Promise.resolve(), speakable });
