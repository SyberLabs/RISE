/**
 * Premium Educational: a calm lesson in the manner of 3Blue1Brown
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §11). The
 * guidance says how to write in the style; the two worked Currents are real
 * ones the validator accepts and whose scenes the server admits (held by
 * src/live/guide/index.test.js, and run headless by npm run eval:creative).
 */

const ORIGIN = Object.freeze({ kind: 'model', name: 'Your name', provider: 'Who runs you' });

const VECTOR_SCENE = [
    'export const reportsCompletion = true;',
    'export default function scene(rise) {',
    '  const { lib, size } = rise;',
    '  const plane = lib.axes({ x: [-1, 4], y: [-1, 3] });',
    "  const v = lib.vector({ x: 3, y: 2, label: 'v', t: 0 });",
    '  const legs = { t: 0 };',
    '  return {',
    '    frame() {',
    '      lib.clear();',
    '      lib.grid(plane);',
    '      plane.draw();',
    '      if (legs.t > 0) {',
    "        const dash = { color: lib.color('highlight'), dash: [6, 6] };",
    '        lib.line(plane, [0, 0], [3 * legs.t, 0], dash);',
    '        lib.line(plane, [3, 0], [3, 2 * legs.t], dash);',
    '      }',
    '      v.draw(plane);',
    '      if (legs.t >= 1) {',
    "        lib.label('3', { at: [plane.toX(1.5) / size.dpr, plane.toY(0) / size.dpr + 22], color: lib.color('muted'), align: 'center' });",
    "        lib.label('2', { at: [plane.toX(3) / size.dpr + 12, plane.toY(1) / size.dpr], color: lib.color('muted') });",
    '      }',
    '    },',
    '    cue(name, { instant }) {',
    "      if (name === 'draw') return lib.tween(v, { t: 1 }, { ms: 1200, instant });",
    "      if (name === 'legs') return lib.tween(legs, { t: 1 }, { ms: 1500, instant }).then(() => rise.done());",
    '    }',
    '  };',
    '}'
].join('\n');

const TANGENT_SCENE = [
    'export const reportsCompletion = true;',
    'export default function scene(rise) {',
    '  const { lib } = rise;',
    '  const plane = lib.axes({ x: [-0.5, 3], y: [-0.5, 4] });',
    '  const f = x => 0.5 * x * x;',
    '  const a = 1.2;',
    '  const curve = { to: 0 };',
    '  const secant = { h: 1.5, shown: 0 };',
    '  return {',
    '    frame() {',
    '      lib.clear();',
    '      lib.grid(plane, { step: 0.5 });',
    '      plane.draw();',
    '      lib.plot(plane, f, { to: curve.to });',
    '      if (secant.shown > 0) {',
    '        const b = a + secant.h;',
    '        const slope = (f(b) - f(a)) / secant.h;',
    '        const y = x => f(a) + slope * (x - a);',
    "        lib.line(plane, [a - 1, y(a - 1)], [a + 1.6, y(a + 1.6)], { color: lib.color('highlight', secant.shown) });",
    "        lib.point(plane, [b, f(b)], { color: lib.color('muted') });",
    "        lib.point(plane, [a, f(a)], { label: 'a' });",
    '      }',
    '    },',
    '    cue(name, { instant }) {',
    "      if (name === 'curve') return lib.tween(curve, { to: 1 }, { ms: 1500, instant });",
    "      if (name === 'secant') return lib.tween(secant, { shown: 1 }, { ms: 600, instant });",
    "      if (name === 'shrink') return lib.tween(secant, { h: 0.001 }, { ms: 3000, instant }).then(() => rise.done());",
    '    }',
    '  };',
    '}'
].join('\n');

export const EXAMPLES = Object.freeze([
    {
        prompt: 'Explain why the length of a vector is the square root of x squared plus y squared.',
        current: {
            schema: 'rise.current.v2',
            id: 'vector-length',
            title: 'How long is a vector?',
            theme: 'cobalt',
            style: 'premium-educational',
            origin: ORIGIN,
            scenes: [{ id: 'plane', code: VECTOR_SCENE }],
            beats: [
                { say: 'Here is a vector: three steps across, and two steps up.', scene: 'plane', cue: 'draw', sound: 'starlight' },
                { hold: { ms: 1500 } },
                { say: 'Drop its shadow onto the axes, and a right triangle appears.' },
                { hold: { ms: 2000, maxMs: 4000 }, cue: 'legs' },
                { say: 'Its length is the long side, so by Pythagoras it is the square root of three squared plus two squared.', show: 'Its length is $\\sqrt{3^2 + 2^2}$.' },
                { say: 'That is the square root of thirteen, a little over three and a half.', show: '$\\sqrt{13} \\approx 3.61$', emphasis: ['thirteen'] },
                { show: 'In general, the length of (x, y) is $\\sqrt{x^2 + y^2}$.', hold: { ms: 3000 }, place: 'centre', size: 'larger' }
            ]
        }
    },
    {
        prompt: 'Show me what a derivative is.',
        current: {
            schema: 'rise.current.v2',
            id: 'slope-of-a-curve',
            title: 'The slope of a curve',
            theme: 'silver',
            style: 'premium-educational',
            origin: ORIGIN,
            scenes: [{ id: 'curve', code: TANGENT_SCENE }],
            beats: [
                { say: 'Here is a curve: y equals one half x squared.', show: 'Here is a curve: $y = \\tfrac{1}{2}x^2$.', scene: 'curve', cue: 'curve', sound: 'starlight' },
                { hold: { ms: 1500 } },
                { say: 'Pick a point on it, and a second point a little further along. The line through both is a secant.', cue: 'secant' },
                { hold: { ms: 1500 } },
                { say: 'Now slide the second point toward the first.' },
                { hold: { ms: 3000, maxMs: 4500 }, cue: 'shrink' },
                { say: 'The secant settles into the tangent line, and its slope is the derivative at that point.', emphasis: ['derivative'] },
                { show: "$f'(a) = \\lim_{h \\to 0} \\dfrac{f(a+h) - f(a)}{h}$", hold: { ms: 3500 }, place: 'centre', size: 'larger' }
            ]
        }
    }
]);

export const GUIDANCE = [
    'Premium Educational ("style": "premium-educational")',
    '',
    'A calm lesson in the manner of 3Blue1Brown: one idea, built up on screen a step at a time, the voice saying what the picture is doing.',
    '',
    'What the style sets for you: a beat that sets no place is a caption in the lower third, at the reader\'s own size; captions are set in a humanist sans and lines shown in the centre in a book serif. In your code scene, rise.lib draws 2.5-pixel strokes, a faint grid and labels in a humanist sans, and eases every tween smoothly.',
    '',
    'How to write it:',
    '- Plan the picture first: one code scene that the whole lesson builds, cued beat by beat. A native engine is at most a quiet backdrop for an opening or a close.',
    '- Short spoken sentences, one claim each. Say maths as it is read ("x squared"), and show it as it is written in "show": $x^2$ is typeset.',
    '- After a sentence that introduces something, cue the scene to draw it, then hold (1500 to 4000 ms) so the reader watches it happen. A hold that waits for an animation gets a maxMs, and the scene calls rise.done() when the animation lands.',
    '- Every cue a beat names must change something the reader can see, and must land at once when instant is true.',
    '- Draw on the quiet field lib.clear() gives: the grid faint, the accent colour for the thing being explained, muted for scaffolding, highlight for the one point to look at. Nothing flashes, nothing spins for its own sake.',
    '- Keep text in the scene to a few labels; the captions carry the words.',
    '- Lay one quiet bed under the whole lesson: "sound": "starlight" (or "aurora") on the first beat and on no other. Never a tone, never a change of sound part way through, never a sound on a hold; the voice and the picture carry the lesson.',
    '- End on a shown line ("show" with "hold", in the centre, larger) that states the result.'
].join('\n');
