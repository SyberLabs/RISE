/**
 * The venue's demonstration of the illustrator (docs/plans/LIVE-CURRENT.md §19), written by hand as a model would write
 * it and streamed by the demo (adapters/mock-beats.js):
 *
 *   asked "What are the three states of water?", the composer runs the attractor, asks for it brighter (answered by
 *   the attractor's own cue, no request), then asks for a labelled diagram and goes on speaking; the demo's
 *   illustrator first says a sentence and draws a figure with a <script> (refused), then the figure repaired;
 *   asked "show me that as a diagram" while it reads, the answer asks for a diagram itself;
 *   asked "What is a tesseract?", every picture the illustrator draws is refused, and the reading goes on without one.
 */

/** The figure the illustrator draws: ice, water and steam, with heat moving between them. */
export const WATER_FIGURE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 220" font-family="sans-serif" font-size="16" fill="currentColor">
  <title>The three states of water: ice, liquid water and steam</title>
  <g fill="none" stroke="currentColor" stroke-width="2">
    <rect x="20" y="40" width="110" height="110" rx="8"/>
    <rect x="155" y="40" width="110" height="110" rx="8"/>
    <rect x="290" y="40" width="110" height="110" rx="8"/>
    <path d="M134 95 H151 M145 89 L151 95 L145 101"/>
    <path d="M269 95 H286 M280 89 L286 95 L280 101"/>
  </g>
  <g>
    <circle cx="45" cy="65" r="7"/><circle cx="75" cy="65" r="7"/><circle cx="105" cy="65" r="7"/>
    <circle cx="45" cy="95" r="7"/><circle cx="75" cy="95" r="7"/><circle cx="105" cy="95" r="7"/>
    <circle cx="45" cy="125" r="7"/><circle cx="75" cy="125" r="7"/><circle cx="105" cy="125" r="7"/>
  </g>
  <g>
    <circle cx="178" cy="112" r="7"/><circle cx="196" cy="126" r="7"/><circle cx="214" cy="110" r="7"/>
    <circle cx="232" cy="128" r="7"/><circle cx="248" cy="112" r="7"/><circle cx="190" cy="96" r="7"/>
    <circle cx="226" cy="94" r="7"/><circle cx="208" cy="134" r="7"/>
  </g>
  <g>
    <circle cx="308" cy="58" r="7"/><circle cx="378" cy="70" r="7"/><circle cx="330" cy="118" r="7"/>
    <circle cx="384" cy="132" r="7"/><circle cx="352" cy="84" r="7"/>
  </g>
  <text x="75" y="178" text-anchor="middle">Ice</text>
  <text x="210" y="178" text-anchor="middle">Water</text>
  <text x="345" y="178" text-anchor="middle">Steam</text>
  <text x="210" y="24" text-anchor="middle" font-size="14">heat moves it on; cooling moves it back</text>
</svg>`;

/** The same figure, with what no figure may carry: the admission refuses it by name. */
export const WATER_FIGURE_REFUSED = WATER_FIGURE.replace('</svg>', '  <script>document.title = "drawn"</script>\n</svg>');

/** A tesseract the demo's illustrator cannot draw admissibly: small, and with a <script> every time. */
export const TESSERACT_REFUSED = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="20" y="20" width="60" height="60" fill="none" stroke="currentColor"/>
  <script>rotate()</script>
</svg>`;

const fence = svg => ['@scene picture svg', '```svg', svg, '```', ''].join('\n');

/** What the composer writes, asked about the states of water. */
export const WATER_TEXT = [
    '@say Water comes in three states: ice, liquid water, and steam.',
    '@scene field attractor palette=blue',
    '@say scene=field Which one you meet depends on how fast its molecules move.',
    '@illustrate medium=cue brighter attractor',
    '@say As water warms, its molecules move faster, and the field grows brighter with them.',
    '@illustrate a labelled diagram of the three states of water',
    '@say Let me draw the three states for you.',
    '@say In ice, the molecules are locked in a lattice; they only tremble where they are.',
    '@say In liquid water, they slide past one another, close together, but free.',
    '@say In steam, they fly apart, and fill whatever space they find.',
    '@say Heat moves water from one state to the next, and cooling moves it back again.',
    ''
].join('\n');

/** What the composer writes, asked about a tesseract: a picture the demo's illustrator cannot draw admissibly. */
export const TESSERACT_TEXT = [
    '@say A tesseract is a cube in four dimensions.',
    '@illustrate a picture of a tesseract unfolding into cubes',
    '@say It is hard to picture, so here it is in words.',
    '@say A square is drawn by moving a line sideways, and a cube by moving a square upward.',
    '@say Move a cube along a fourth direction, at right angles to all three, and it traces a tesseract.',
    '@say Its shadow in our space is a cube inside a cube, with each corner joined to its twin.',
    ''
].join('\n');

/** What the demo answers when the reader asks, while it reads, to see it as a diagram: the answer asks for a picture. */
export const DIAGRAM_ANSWER = [
    '@say Here is that as a diagram.',
    '@illustrate a labelled diagram of ice, water and steam side by side',
    '@say Ice, water and steam, side by side, with heat moving between them.',
    '@say And the reading goes on.',
    '@then resume',
    ''
].join('\n');

/**
 * What the demo's illustrator answers: for the tesseract, a figure with a <script> every time; for the three states of
 * water, first a sentence and the same refused figure, then the figure repaired; for anything else, the figure.
 */
export function illustratorTextFor(request) {
    const { attempt } = request.illustration;
    if (/tesseract/iu.test(request.prompt)) return fence(TESSERACT_REFUSED);
    if (/three states of water/iu.test(request.prompt) && attempt === 1) return `@say Here is your diagram.\n${fence(WATER_FIGURE_REFUSED)}`;
    return fence(WATER_FIGURE);
}
