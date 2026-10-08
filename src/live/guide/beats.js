/**
 * The v2 guidance: beats over scenes, and how to write a scene as code
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §5, §8, §12).
 *
 * Everything a model is told here is the runtime's own: the limits are
 * BEAT_LIMITS and SCENE_LIMITS, the refused names are the admission's list,
 * the module shape is the one the scene worker calls, and LIB_GUIDE names
 * exactly what createSceneLibrary gives a scene (index.test.js holds each).
 */
import { BANNED_SCENE_NAMES, BEAT_LIMITS, SCENE_ENGINES, SCENE_LIMITS, describeManifests } from '../../core/beats.js';
import { RISE_CURRENT_STYLES } from '../../core/rise-current.js';

/** A Current of beats: time the model composes (src/core/beats.js). */
export const CURRENT_EXAMPLE_V2 = Object.freeze({
    schema: 'rise.current.v2',
    id: 'vector-length',
    title: 'How long is a vector?',
    theme: 'cobalt',
    origin: { kind: 'model', name: 'Your name', provider: 'Who runs you' },
    scenes: [{ id: 'field', engine: 'attractor' }, { id: 'calm', engine: 'still' }],
    beats: [
        { say: 'A vector has a direction and a length.', scene: 'field', sound: 'starlight' },
        { hold: { ms: 2500 } },
        { say: 'Its length is the square root of x squared plus y squared.', show: 'Its length is √(x² + y²).', place: 'caption' },
        { show: 'The Pythagorean theorem, in two dimensions.', hold: { ms: 2000 }, scene: 'calm', size: 'smaller' },
        { say: 'So the whole story is one idea.' }
    ]
});

/** A scene as a model writes it: the module the scene worker loads, admitted by the server (held by a test). */
export const SCENE_CODE_EXAMPLE = [
    'export const reportsCompletion = true;',
    'export default function scene(rise) {',
    '  const { lib } = rise;',
    '  const plane = lib.axes({ x: [-1, 4], y: [-1, 3] });',
    "  const v = lib.vector({ x: 3, y: 2, label: 'v', t: 0 });",
    '  return {',
    '    frame(t, dt) {',
    '      lib.clear();',
    '      lib.grid(plane);',
    '      plane.draw();',
    '      v.draw(plane);',
    '    },',
    '    cue(name, { instant }) {',
    "      if (name === 'draw') return lib.tween(v, { t: 1 }, { ms: 900, instant });",
    "      if (name === 'turn') return lib.tween(v, { angle: Math.PI / 2 }, { ms: 1500, instant }).then(() => rise.done());",
    '    }',
    '  };',
    '}'
].join('\n');

/** What `rise.lib` gives a scene, one line each, by name. */
export const LIB_GUIDE = Object.freeze([
    ['clear', 'clear(color?): fills the canvas with the background; first in every frame.'],
    ['axes', 'axes({ x: [x0, x1], y: [y0, y1] }, { color, labels, margin }): returns a frame with draw(), toX(x), toY(y) (device pixels) for the calls below.'],
    ['grid', 'grid(frame, { step, color, alpha })'],
    ['plot', 'plot(frame, x => y or [[x, y], ...], { color, width, samples, to }): a curve; tween to (0 to 1) to draw it.'],
    ['vector', 'vector({ x, y, from, color, label, t, angle, width }): an arrow; tween its t (0 to 1, how much is drawn) and angle (radians); draw(frame) draws it.'],
    ['point', 'point(frame, [x, y], { color, radius, label })'],
    ['line', 'line(frame, [x0, y0], [x1, y1], { color, width, dash })'],
    ['arc', 'arc(frame, [cx, cy], radius, from, to, { color, width }): angles in radians.'],
    ['polygon', 'polygon(frame, [[x, y], ...], { color, alpha, outline })'],
    ['label', 'label(text, { at: [x, y], color, font, align, baseline, alpha }): plain canvas text at CSS pixels (divide toX and toY by rise.size.dpr).'],
    ['tween', "tween(target, { property: value }, { ms, ease, instant }): moves numbers on RISE's clock; returns a promise; instant, or reduced motion, lands at once."],
    ['ease', 'ease: linear, smooth, in, out, inOut; the style sets the default.'],
    ['color', 'color(name, alpha?): a theme colour (background, text, accent, muted, highlight), with an alpha.'],
    ['palette', 'palette: the theme colours by name.']
]);

const SCENE_GUIDE = [
    `Code scenes. A scene may instead be { "id": "...", "code": "..." }: a picture you write, drawn by RISE in a worker of its own behind the words. "code" is the text of one ES module of at most ${BEAT_LIMITS.code.toLocaleString('en-US')} bytes whose one default export function receives rise and returns { frame(t, dt), cue(name, { instant }) }:`,
    '',
    SCENE_CODE_EXAMPLE,
    '',
    '- The default export runs once. frame(t, dt) runs every display frame while the reading plays (t: scene time in ms, stopped while paused; dt: ms since the last frame); draw the whole picture each time. cue(name, { instant }) runs when a beat with that "cue" begins; instant is true on a replay or seek, so land on the end state at once (pass it to tween).',
    '- rise gives you: ctx (2D canvas; or rise.use("webgl2") before the first frame, then rise.gl), size { width, height, dpr } in CSS pixels, theme (background, text, accent, muted, highlight), reducedMotion, lib and done().',
    '- rise.lib draws in the style\'s defaults:',
    ...LIB_GUIDE.map(([, line]) => `  - ${line}`),
    `- To end a hold when its animation is over, export const reportsCompletion = true; and call rise.done(). The hold then ends at done, no sooner than ${SCENE_LIMITS.earliestDoneMs} ms into it and no later than its maxMs. Without the export, done is ignored and every hold lasts its ms.`,
    `- A scene has no import of any kind, no network, no DOM, no storage and no timers: time comes only from frame. These names are refused anywhere in the code, even as your own variable names: ${BANNED_SCENE_NAMES.join(', ')}.`,
    `- Budget: a frame should take a few milliseconds. ${SCENE_LIMITS.frameSoftCount} frames over ${SCENE_LIMITS.frameSoftMs} ms in one second, one frame over ${SCENE_LIMITS.frameHardMs} ms, or an exception ends the scene, and the reading's own field takes its place. Never flash: a scene whose brightness flickers more than three times a second is frozen.`,
    '- RISE checks every code scene before it accepts the Current. A refusal names the scene, the line and column, and the rule (Scene "plane" was refused: line 4, column 9: `fetch` is not available to a scene.); repair that line and call again with the whole Current.'
].join('\n');

export const BEATS_GUIDE = [
    'A Current may instead be a sequence of BEATS over SCENES ("schema": "rise.current.v2"), when the answer needs time of its own: a picture that plays while nothing is said, a caption under a running scene, a line shown for a while.',
    '',
    JSON.stringify(CURRENT_EXAMPLE_V2, null, 2),
    '',
    'Beats:',
    '- A beat SAYS: "say" is spoken and shown. Add "show" when what is shown differs from what is said (write maths as it is read in "say", as it is written in "show"). "place": "none" speaks without showing.',
    '- A beat HOLDS: "hold": { "ms": N } says nothing for N milliseconds while the scene plays. Use it to let a picture play out before the next sentence. 200 to 60000 ms.',
    '- A beat SHOWS: "show" with "hold" and no "say" shows a line for a while, said by no one: a title, a formula, a caption.',
    `- "scene" starts one of the Current’s scenes at that beat; it keeps running under the beats that follow until another starts. A scene names an engine (${SCENE_ENGINES.join(', ')}) or is code you write (below).`,
    '- "place" (centre, caption, top, left, right, none), "size" (smaller, as-set, larger, display), "type" (a face by role: book-serif, humanist-sans, mono, display…) and "emphasis" (words to set apart) shape the text of a beat.',
    `- "style" (${RISE_CURRENT_STYLES.join(', ')}) sets the place, size and faces of the beats that set none, and the drawing defaults of your code scenes; each style has guidance of its own.`,
    '- "sound" names one of RISE’s sounds: an atmosphere or music bed that stays (aurora, starlight, piano, nocturne…), a tone (focus, deep, gateway), or none.',
    `- At most ${BEAT_LIMITS.beats} beats and ${BEAT_LIMITS.scenes} scenes; ${BEAT_LIMITS.text} characters per sentence and ${BEAT_LIMITS.totalText} in all. The same text rules as passages apply.`,
    '- Prefer v2 when the reader asks for a lesson, a walkthrough, or an animation; v1 (passages) is fine for a plain spoken reading.',
    '',
    'Scenes, their parameters ("params", each within its bounds) and their cues ("cue" on a later beat: a named cue, or set:<parameter>=<value> on a cueable one):',
    describeManifests(),
    '',
    SCENE_GUIDE
].join('\n');
