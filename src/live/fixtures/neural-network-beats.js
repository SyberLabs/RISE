/**
 * The venue's demonstration of interactive scenes (docs/plans/LIVE-CURRENT.md §20; VISION §2.5's neural-network page):
 * asked "How does a neural network learn?", a code scene of the smallest network there is, two inputs, two weights on
 * sliders and one output, with the input a point the reader drags over the plane its answer colours. The beats invite
 * the reader to move the weights and the point, and hold while they do; what they set comes back with their next words.
 *
 * And a scene that misbehaves on purpose, asked "Show me a scene that misbehaves": it emits an object, a 500-character
 * string, a thousand values and a hundred controls for every press, and a value on every frame. RISE bounds it all and
 * the reading goes on (e2e/live.spec.js). Both written by hand, as a model would write them; the demo streams them.
 */

/** The network: the reader's widgets at the top, the plane in the middle, the words below as a caption. */
export const NETWORK_SCENE = `export default function scene(rise) {
  rise.listen('pointer', 'keys');
  const { lib } = rise;
  const sigmoid = z => 1 / (1 + Math.exp(-z));
  const box = () => {
    const narrow = rise.size.width < 640;
    const upper = narrow ? 296 : 136;
    const side = Math.max(80, Math.min(rise.size.width * (narrow ? 0.7 : 0.42), rise.size.height - upper - 64));
    return { side, left: Math.max(narrow ? 0 : 240, (rise.size.width - side) / 2), upper };
  };
  const plane = {
    x0: -1, x1: 1, y0: -1, y1: 1,
    toX: x => (box().left + ((x + 1) / 2) * box().side) * rise.size.dpr,
    toY: y => (box().upper + ((1 - y) / 2) * box().side) * rise.size.dpr
  };
  const w1 = lib.slider({ id: 'w1', x: 28, y: 48, w: 170, min: -2, max: 2, value: 1, step: 0.1, label: 'Weight 1' });
  const w2 = lib.slider({ id: 'w2', x: 28, y: 104, w: 170, min: -2, max: 2, value: -0.5, step: 0.1, label: 'Weight 2' });
  const input = lib.point({ id: 'input', x: 0.5, y: 0.5, draggable: true, label: 'Input', frame: plane });
  lib.focusable(w1, w2, input);
  const answer = (x, y) => sigmoid(2 * (w1.value * x + w2.value * y));
  const net = { toX: v => v * rise.size.dpr, toY: v => v * rise.size.dpr };
  return {
    frame() {
      lib.clear();
      const ctx = rise.ctx;
      const cells = 14;
      const edge = (from, to, k) => Math.round(from + ((to - from) * k) / cells);
      for (let i = 0; i < cells; i += 1) {
        for (let j = 0; j < cells; j += 1) {
          const x = -1 + (2 * (i + 0.5)) / cells;
          const y = 1 - (2 * (j + 0.5)) / cells;
          const [left, top] = [edge(plane.toX(-1), plane.toX(1), i), edge(plane.toY(1), plane.toY(-1), j)];
          ctx.fillStyle = lib.color('accent', 0.05 + 0.55 * answer(x, y));
          ctx.fillRect(left, top, edge(plane.toX(-1), plane.toX(1), i + 1) - left, edge(plane.toY(1), plane.toY(-1), j + 1) - top);
        }
      }
      lib.line(plane, [-1, 0], [1, 0], { color: lib.color('muted'), width: 1 });
      lib.line(plane, [0, -1], [0, 1], { color: lib.color('muted'), width: 1 });
      const nodes = [[48, 172], [48, 244], [178, 208]];
      [w1.value, w2.value].forEach((w, k) => {
        lib.line(net, nodes[k], nodes[2], { color: lib.color(w >= 0 ? 'accent' : 'highlight'), width: 1 + 2.5 * Math.abs(w) });
      });
      const out = answer(input.x, input.y);
      lib.point(net, nodes[0], { radius: 8, color: lib.color('text') });
      lib.point(net, nodes[1], { radius: 8, color: lib.color('text') });
      lib.point(net, nodes[2], { radius: 8 + 8 * out, color: lib.color('highlight') });
      lib.label('x1 ' + input.x.toFixed(2), { at: [48, 198], align: 'center' });
      lib.label('x2 ' + input.y.toFixed(2), { at: [48, 270], align: 'center' });
      lib.label('Output ' + out.toFixed(2), { at: [178, 250], align: 'center' });
      w1.draw();
      w2.draw();
      input.draw();
    }
  };
}`;

const SAID = Object.freeze({
    what: 'A neural network is a machine for weighing evidence.',
    weights: 'Each input arrives with a weight: how much that piece of evidence counts, and in which direction.',
    sum: 'The network adds up the weighted evidence, and squashes the sum into an answer between nought and one.',
    smallest: 'Here is the smallest one there is: two inputs, two weights, and one output.',
    slider: 'Drag the slider for the first weight, and watch the output change.',
    point: 'Now move the yellow point. It is the input, and the colour under it is the network’s answer.',
    learning: 'Learning is nothing more than nudging the weights until the answers come out right.'
});

/**
 * What the model writes. Three beats are said while the scene's code is still being written (some 3,000 characters, at
 * a model's pace); the words then sit below the scene as a caption, away from its widgets.
 */
export const NETWORK_TEXT = [
    `@say ${SAID.what}`,
    `@say ${SAID.weights}`,
    `@say ${SAID.sum}`,
    '@scene network code',
    '```js',
    NETWORK_SCENE,
    '```',
    `@say scene=network place=caption ${SAID.smallest}`,
    `@say place=caption ${SAID.slider}`,
    '@hold 4000',
    `@say place=caption ${SAID.point}`,
    '@hold 4000',
    `@say place=caption ${SAID.learning}`,
    ''
].join('\n');

/** A scene that misbehaves on purpose: every bound of §20 meets it. */
export const UNRULY_SCENE = `export default function scene(rise) {
  rise.listen('pointer', 'keys');
  const { lib } = rise;
  let presses = 0;
  return {
    frame() {
      lib.clear();
      lib.label('Presses: ' + presses, { at: [24, 48] });
      rise.emit('count', presses);
    },
    input(event) {
      if (event.type !== 'pointerdown' && event.type !== 'keydown') return;
      presses += 1;
      rise.emit('shape', { kind: 'an object' });
      rise.emit('note', 'x'.repeat(500));
      for (let i = 0; i < 1000; i += 1) rise.emit('count', presses * 1000 + i);
      for (let i = 0; i < 100; i += 1) rise.emit('c' + i, i);
    }
  };
}`;

export const UNRULY_TEXT = [
    '@say This scene misbehaves on purpose, to show what RISE does with it.',
    '@scene unruly code',
    '```js',
    UNRULY_SCENE,
    '```',
    '@say scene=unruly place=caption Press it as often as you like.',
    '@hold 3000',
    '@say place=caption Whatever it says, the reading goes on.',
    ''
].join('\n');
