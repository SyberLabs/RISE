/**
 * What the Demo can answer, and what it says to anything else. Small on purpose: the venue's entry shows the
 * questions while the Demo answers, and must not bring the answers' scenes and figures with it.
 */

/** Questions the Demo answers with a reading of its own, each matched by beatsTextFor (black-holes-beats.js). */
export const DEMO_QUESTIONS = Object.freeze([
    'How do black holes work?',
    'Why is the sky blue?',
    'What is a tesseract?',
    'How does a neural network learn?',
    'What are the three states of water?'
]);

/** How many of them the entry offers. */
export const DEMO_OFFERED = 3;

/** What the Demo says to a question it has no reading for: what it knows, and how to ask anything. */
export const DEMO_REFUSAL = Object.freeze([
    'This demo knows five subjects: black holes, the sky, the tesseract, neural networks and water.',
    'To ask anything, leave this room and choose who answers, on your own key.'
]);
