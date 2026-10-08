/**
 * The v1 contract: what a Current of passages is, and the rules a model
 * follows to write one. The numbers come from the sealed Current's own
 * limits, and the example is a real Current the strict validator accepts
 * (held by index.test.js), so what a model is told cannot drift from what is
 * accepted. The guide asks for no Dive notes: a Composer presentation does
 * not show them, though the validator still accepts them.
 */
import { RISE_CURRENT_LIMITS as LIMITS, RISE_CURRENT_LOOKS, RISE_CURRENT_SCHEMA, RISE_CURRENT_THEME_IDS, RISE_CURRENT_VISUALS } from '../../core/rise-current.js';
import { LOOK_HINTS, THEME_HINTS } from './looks.js';

/** A real, valid Current, small enough to read at a glance. */
export const CURRENT_EXAMPLE = Object.freeze({
    schema: RISE_CURRENT_SCHEMA,
    id: 'light-and-holes',
    title: 'Why a black hole is black',
    theme: 'cobalt',
    look: 'signal',
    origin: { kind: 'model', name: 'Your name', provider: 'Who runs you' },
    segments: [
        { id: 'first', text: 'Nothing that falls inside can come back out.', visual: 'still' },
        { id: 'second', text: 'Not even light, which is the fastest thing there is.', visual: 'attractor' }
    ]
});

export const CONTRACT_GUIDE = [
    'A RISE Current is one JSON object. RISE speaks its passages aloud and shows each as it is spoken.',
    '',
    JSON.stringify(CURRENT_EXAMPLE, null, 2),
    '',
    'Rules:',
    `- "schema" is exactly "${RISE_CURRENT_SCHEMA}". Use no field that is not shown above.`,
    `- "title" and every "id" are short text; ids are unique. "title" is at most ${LIMITS.title} characters.`,
    '- "origin": you are a model, so use "kind": "model" and give your name and who runs you.',
    `- 1 to ${LIMITS.segments} segments, each at most ${LIMITS.segmentText} characters and ${LIMITS.totalText} in all. Begin with a short one, so the answer starts at once.`,
    '- Segment text is plain words meant to be heard: no markdown, no lists, no headings, and never the character | or [PAUSE], [FLASH], [HOLD].',
    `- "look" sets how the whole answer looks: its imagery, its typeface and its colors. Choose the one that suits the answer: ${RISE_CURRENT_LOOKS.map(id => `${id} (${LOOK_HINTS[id]})`).join(', ')}. It may be left out.`,
    `- "visual" says what a segment is like: ${RISE_CURRENT_VISUALS.join(', ')}. It may be left out; with a "look", a segment that leaves it out shows the look's imagery.`,
    `- "theme" colors the whole answer: its page, its moving light and its drawings. Choose the one that suits the subject: ${RISE_CURRENT_THEME_IDS.map(id => `${id} (${THEME_HINTS[id]})`).join(', ')}. Leave it out only if none suits; a "look" then brings its own.`,
    '- Do not cite sources: a Current carries none.'
].join('\n');
