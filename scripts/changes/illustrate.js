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
import { OPEN_LIMITS } from '../../src/live/adapter.js';
import { svgLayoutProblems } from '../../src/core/quality/svg-layout.js';
import { admitSvg } from '../../src/core/svg-admission.js';
import { renderFigure } from '../../src/core/figures/figure-kit.js';
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
  '- A chart or a diagram the brief asks for is drawn as asked. A picture of where things sit places them only where the brief says (above, below, at the foot); a layout the brief gives no positions for is drawn as a labelled list of its parts, never an arrangement it did not state.'
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
function illustratorAdapter({ ask, model, pulls, period, tally }) {
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
  // A code scene has no static text to place, so only a figure's labels are held to the layout rules.
  const diagnoseScene = scene => {
    const found = [
      ...adapter.diagnoseScene(scene),
      ...(scene.svg !== undefined ? figureNumberProblems(scene.svg, { pulls, period }) : typeof scene.code === 'string' ? codeNumberProblems(scene.code, { pulls, period }) : []).map(message => ({ line: null, column: null, rule: 'number', message })),
      ...(scene.svg !== undefined ? svgLayoutProblems(scene.svg).problems.map(({ rule, line, message }) => ({ line, column: null, rule, message })) : [])
    ];
    for (const diagnostic of found) tally.fired(diagnostic.rule);
    return found;
  };
  return { ...adapter, diagnoseScene };
}

/**
 * Each picture drawn, in beat order (a kit figure by RISE itself, a brief by the illustrator): `{ current, notes }`, the
 * Current with every admitted picture as a scene
 * (`picture-<n>`) started on its beat, and a sentence for each picture let go. `tally` is told each rule that fired
 * and each repair asked for. `renderCheck(svg)`, when given, renders an admitted figure and answers
 * `{ problems: [{ rule, message }], ms }`: a figure it finds fault with goes back to the illustrator once, as a
 * refusal, and is let go if the repaired one is still at fault.
 */
export async function illustrate({ ask, model, current, pictures, pulls, period, log, now = Date.now, tally = { fired() {}, repaired() {} }, renderCheck }) {
  const adapter = illustratorAdapter({ ask, model, pulls, period, tally });
  const drawn = { ...current, scenes: [...(current.scenes ?? [])], beats: current.beats.map(beat => ({ ...beat })) };
  const notes = [];
  const ordered = [...pictures].sort((a, b) => a.beat - b.beat);
  const place = (index, picture, scene) => {
    const id = `picture-${index + 1}`;
    drawn.scenes.push({ id, ...scene });
    drawn.beats[picture.beat].scene = id;
    // A cue on this beat was for the scene the picture replaces.
    delete drawn.beats[picture.beat].cue;
  };
  const letGo = note => {
    notes.push(note);
    log(`  ${note}`);
  };
  for (const [index, picture] of ordered.entries()) {
    const rendered = async svg => {
      const verdict = await renderCheck(svg);
      for (const problem of verdict.problems) tally.fired(problem.rule);
      log(`  picture for beat ${picture.beat}: rendered check in ${Math.round(verdict.ms)} ms: ${verdict.problems.length ? verdict.problems.map(problem => problem.rule).join(', ') : 'clean'}`);
      return verdict.problems;
    };
    if (picture.kit !== undefined) {
      // RISE draws a kit figure itself: there is no model to repair it, so a fault lets it go.
      const kind = picture.kit.kind;
      let svg = null;
      let fault = null;
      try {
        svg = renderFigure(picture.kit, { theme: current.theme });
      } catch (error) {
        fault = String(error?.message ?? error);
      }
      if (svg !== null) {
        const rules = [
          ...(admitSvg(svg).ok ? [] : ['figure']),
          ...figureNumberProblems(svg, { pulls, period }).map(() => 'number'),
          ...svgLayoutProblems(svg).problems.map(problem => problem.rule)
        ];
        for (const rule of rules) tally.fired(rule);
        if (rules.length) fault = `RISE\u2019s own checks refused it (${[...new Set(rules)].join(', ')})`;
        else if (renderCheck) {
          const problems = await rendered(svg);
          if (problems.length) fault = `its labels failed the rendered check (${[...new Set(problems.map(problem => problem.rule))].join(', ')})`;
        }
      }
      if (fault === null) {
        place(index, picture, { svg });
        log(`  picture for beat ${picture.beat}: a kit ${kind} figure, drawn by RISE`);
      } else {
        letGo(`The kit ${kind} figure for beat ${picture.beat} (\u201c${clip(picture.kit.title ?? kind, 80)}\u201d) was not drawn: ${fault}; the beat keeps the scene before it.`);
      }
      continue;
    }
    const said = drawn.beats.slice(picture.beat, picture.beat + 2)
      .map(beat => beat.say ?? beat.show).filter(text => typeof text === 'string').map(text => clip(text, 300));
    const running = runningAt(drawn, picture.beat);
    const room = { said, ...(RISE_CURRENT_THEME_IDS.includes(current.theme) ? { theme: current.theme } : {}), ...(running ? { running } : {}) };
    const attempt = repair => draw({
      adapter, brief: picture.brief, medium: picture.medium, room: repair ? { ...room, repair } : room, now,
      onNote: (type, body) => {
        if (type === 'illustration.requested' && body.attempt > 1) tally.repaired('illustrator');
        if (type === 'illustration.refused') log(`  picture for beat ${picture.beat}: attempt ${body.attempt} refused (${body.rule}${body.line === null ? '' : `, line ${body.line}`})`);
      }
    });
    let result = await attempt(null);
    let fault = null;
    if (renderCheck && result.status === 'admitted' && result.medium === 'figure') {
      const problems = await rendered(result.scene.svg);
      if (problems.length) {
        tally.repaired('illustrator');
        result = await attempt({
          source: result.scene.svg.slice(0, OPEN_LIMITS.source),
          diagnostics: problems.slice(0, OPEN_LIMITS.diagnostics).map(({ rule, message }) => ({ line: null, column: null, rule, message: clip(message, OPEN_LIMITS.diagnostic) }))
        });
        if (result.status === 'admitted' && result.medium === 'figure') {
          const again = await rendered(result.scene.svg);
          if (again.length) fault = [...new Set(again.map(problem => problem.rule))].join(', ');
        }
      }
    }
    if (result.status === 'admitted' && result.scene.svg !== undefined) {
      for (const note of svgLayoutProblems(result.scene.svg).notes) log(`  picture for beat ${picture.beat}: not checked: ${note}`);
    }
    if (fault === null && result.status === 'admitted' && result.medium !== 'cue') {
      place(index, picture, result.scene);
      log(`  picture for beat ${picture.beat}: a ${result.medium} admitted on attempt ${result.attempts}`);
    } else {
      const why = fault !== null ? `its labels still failed the rendered check after a repair (${fault})`
        : result.status === 'failed' ? `${result.reason} after ${result.attempts} attempt${result.attempts === 1 ? '' : 's'}` : `the illustrator answered with a ${result.status}`;
      letGo(`The picture for beat ${picture.beat} (“${clip(picture.brief, 80)}”) was not drawn: ${why}; the beat keeps the scene before it.`);
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
