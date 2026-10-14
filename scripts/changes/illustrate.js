/**
 * The illustrator pass (docs/plans/RISE-CHANGES.md): the composer's briefs drawn one by one by RISE Live's own
 * illustrator (src/live/illustrator.js `draw`, docs/plans/LIVE-CURRENT.md §19), through a text-stream adapter whose
 * one request is a call to `ask`. Its instructions are Live's (ILLUSTRATOR_INSTRUCTIONS), its request is Live's
 * (promptFor), its admission and repair are Live's, and every figure is also held to the digest's number rule. A
 * picture still refused after its attempts is let go: its beat keeps the scene before it, and a note says so.
 */
import { MCP_CURRENT_BYTES, serializedUtf8Bytes } from '../../src/live/hosts/mcp-size.js';
import { createTextStreamAdapter } from '../../src/live/adapters/text-stream.js';
import { ILLUSTRATOR_INSTRUCTIONS, promptFor } from '../../src/live/adapters/openai-instructions.js';
import { draw } from '../../src/live/illustrator.js';
import { RISE_CURRENT_THEME_IDS, validateRiseCurrent } from '../../src/core/rise-current.js';
import { COMPOSER_PROVIDER } from '../../src/core/changes/contract.js';
import { codeNumberProblems, figureNumberProblems, numberProblems } from './admit.js';

/** What the digest adds to Live's illustrator instructions: where its pictures are seen. */
export const DIGEST_PICTURE_NOTE = [
  'These pictures illustrate RISE’s weekly digest for the team that builds it, one change or group of changes each.',
  '- The room’s ground is dark, near black, and the picture fills the frame behind the words. Draw in currentColor, which RISE inks in the words’ light colour; leave the background empty; no dark fills.',
  '- Labels must read on a phone 390 pixels wide: text of at least 20 units in a viewBox about 400 wide, few words per label, nothing smaller.',
  '- Every label sits clear of every other label and of every line and box: no text over a stroke, no two labels touching. Fewer words is the fix when space runs out.',
  '- Draw only what the brief and the beats just said state: no number, name or claim of your own. A number in the picture must be one the brief gives.',
  '- Place things only where the brief says: a layout puts each part where the brief puts it (above, below, at the foot). When the brief gives no positions, draw a flow or a list, never an arrangement it did not state.'
].join('\n');

const clip = (text, length) => (text.length <= length ? text : `${text.slice(0, length - 1)}…`);

/** The scene running when a beat begins: the last one a beat before it started. */
function runningAt(current, index) {
  for (let at = index - 1; at >= 0; at -= 1) {
    const scene = (current.scenes ?? []).find(item => item.id === current.beats[at]?.scene);
    if (scene) return { id: scene.id, ...(scene.engine ? { engine: scene.engine } : { form: scene.svg !== undefined ? 'svg' : 'code' }) };
  }
  return undefined;
}

/** A text-stream adapter whose one request is one `ask`, its admission widened by the number rule for figures. */
function illustratorAdapter({ ask, model, pulls, period }) {
  const system = `${ILLUSTRATOR_INSTRUCTIONS}\n\n${DIGEST_PICTURE_NOTE}`;
  const adapter = createTextStreamAdapter({
    id: 'changes-illustrator',
    origin: () => ({ name: model, provider: COMPOSER_PROVIDER }),
    async connect(request, sink) {
      ask({ system, prompt: promptFor(request), model }).then(
        text => { sink.delta(String(text)); sink.done(); },
        error => sink.error({ code: 'PROVIDER_FAILED', message: String(error?.message ?? error), recoverable: false })
      );
      return { cancel() {}, close() {} };
    }
  });
  const diagnoseScene = scene => [
    ...adapter.diagnoseScene(scene),
    ...(scene.svg !== undefined ? figureNumberProblems(scene.svg, { pulls, period }) : typeof scene.code === 'string' ? codeNumberProblems(scene.code, { pulls, period }) : []).map(message => ({ line: null, column: null, rule: 'number', message }))
  ];
  return { ...adapter, diagnoseScene };
}

/**
 * Each brief drawn, in beat order: `{ current, notes }`, the Current with every admitted picture as a scene
 * (`picture-<n>`) started on its beat, and a sentence for each picture let go.
 */
export async function illustrate({ ask, model, current, pictures, pulls, period, log, now = Date.now }) {
  const adapter = illustratorAdapter({ ask, model, pulls, period });
  const drawn = { ...current, scenes: [...(current.scenes ?? [])], beats: current.beats.map(beat => ({ ...beat })) };
  const notes = [];
  const ordered = [...pictures].sort((a, b) => a.beat - b.beat);
  for (const [index, picture] of ordered.entries()) {
    const said = drawn.beats.slice(picture.beat, picture.beat + 2)
      .map(beat => beat.say ?? beat.show).filter(text => typeof text === 'string').map(text => clip(text, 300));
    const running = runningAt(drawn, picture.beat);
    const room = { said, ...(RISE_CURRENT_THEME_IDS.includes(current.theme) ? { theme: current.theme } : {}), ...(running ? { running } : {}) };
    const result = await draw({
      adapter, brief: picture.brief, medium: picture.medium, room, now,
      onNote: (type, body) => { if (type === 'illustration.refused') log(`  picture for beat ${picture.beat}: attempt ${body.attempt} refused (${body.rule}${body.line === null ? '' : `, line ${body.line}`})`); }
    });
    if (result.status === 'admitted' && result.medium !== 'cue') {
      const id = `picture-${index + 1}`;
      drawn.scenes.push({ id, ...result.scene });
      drawn.beats[picture.beat].scene = id;
      // A cue on this beat was for the scene the picture replaces.
      delete drawn.beats[picture.beat].cue;
      log(`  picture for beat ${picture.beat}: a ${result.medium} admitted on attempt ${result.attempts}`);
    } else {
      const why = result.status === 'failed' ? `${result.reason} after ${result.attempts} attempt${result.attempts === 1 ? '' : 's'}` : `the illustrator answered with a ${result.status}`;
      const note = `The picture for beat ${picture.beat} (“${clip(picture.brief, 80)}”) was not drawn: ${why}; the beat keeps the scene before it.`;
      notes.push(note);
      log(`  ${note}`);
    }
  }
  // A Current over the connector's bound loses its last pictures until it fits.
  while (serializedUtf8Bytes(drawn) > MCP_CURRENT_BYTES) {
    const last = drawn.scenes.findLast(scene => scene.id.startsWith('picture-'));
    if (!last) break;
    drawn.scenes = drawn.scenes.filter(scene => scene !== last);
    const beat = drawn.beats.findIndex(item => item.scene === last.id);
    delete drawn.beats[beat].scene;
    const note = `The picture for beat ${beat} was left out: the Current would pass ${MCP_CURRENT_BYTES.toLocaleString('en-US')} bytes; the beat keeps the scene before it.`;
    notes.push(note);
    log(`  ${note}`);
  }
  validateRiseCurrent(drawn);
  const problems = numberProblems(drawn, { pulls, period });
  if (problems.length) throw new Error(`The illustrated Current breaks the number rule: ${problems[0]}`);
  return { current: drawn, notes };
}
