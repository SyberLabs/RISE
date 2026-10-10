/**
 * The Creative Control evaluation (docs/evals/creative-control/CREATIVE-CONTROL-EVALS.md).
 *
 * For every case in the corpus (docs/evals/creative-control/<style>/*.json,
 * each { prompt, current }), the Current goes through the Worker's own
 * rise_present door (worker/mcp-server.mjs dispatch: the size limit, the
 * validator, and the static admission of every code scene and figure), every
 * figure is admitted again as the card admits it, and every code
 * scene that is admitted is then run headless through the scene worker's own
 * protocol (src/scenes/scene-worker.js) over a recording 2D context that
 * draws no pixels: a dry frame, 60 frames at 16.7 ms, every cue its beats
 * name played out; again with every cue instant, as a replay delivers them;
 * and again in reduced motion, where every tween must land at once.
 *
 * Frame times are measured in Node, so they are a proxy for the card's
 * budget, not the card's own numbers. The code runs in this process, not in
 * a sandbox: only reviewed cases belong in the corpus. Exits non-zero on any
 * refusal, any exception a scene throws, or a tween reduced motion left
 * moving.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dispatch } from '../worker/mcp-server.mjs';
import { TOOL_NAME } from '../src/live/guide/index.js';
import { attachSceneWorker } from '../src/scenes/scene-worker.js';
import { SCENE_LIMITS, SCENE_PROTOCOL_VERSION, TO_HOST, TO_WORKER } from '../src/scenes/scene-protocol.js';
import { styleOf } from '../src/core/styles.js';
import { jevColors } from '../src/core/jev-palette.js';
import { fakeCanvasContext } from '../src/test/fake-canvas-context.js';
import { admitSvg } from '../src/core/svg-admission.js';
import { createEventWriter } from '../src/live/adapter.js';
import { createCurrentStream } from '../src/live/stream.js';
import { createSegmentParser } from '../src/live/adapters/segment-parser.js';

const ROOT = resolve(import.meta.dirname, '..');
export const CORPUS_DIR = join(ROOT, 'docs', 'evals', 'creative-control');

const SIZE = Object.freeze({ width: 800, height: 450, dpr: 1 });
const STEP_MS = 16.7;
const WARM_FRAMES = 60;
/** The most frames a played cue is given to land: ten seconds of animation. */
const SETTLE_FRAMES = 600;

/** The cuts a streamed case is read at besides whole: a character at a time, a provider's uneven deltas, and pairs. */
const CUTS = Object.freeze([[1], [7, 19, 3, 31, 11, 23], [2, 5]]);

/** The events the parser sends for `text` cut into pieces of `sizes`, in turn, sealed into a reducer as a Current. */
function readStreamed(text, sizes) {
  const writer = createEventWriter('streamed');
  const stream = createCurrentStream();
  const sent = [];
  const apply = (type, body) => {
    const event = writer.next(type, body);
    if (type !== 'current.open' && type !== 'current.complete') sent.push(event);
    stream.apply(event);
  };
  apply('current.open', { title: 'Streamed', origin: { kind: 'model', name: 'Streamed case', provider: 'eval' } });
  const parser = createSegmentParser(apply);
  for (let at = 0, n = 0; at < text.length; n += 1) {
    const size = sizes[n % sizes.length];
    parser.push(text.slice(at, at + size));
    at += size;
  }
  parser.finish();
  apply('current.complete', {});
  return { stream, sent: JSON.stringify(sent) };
}

/**
 * A streamed case (`lines`, the answer a model writes in beats, one per line), read as the venue reads one: through
 * the text-stream parser into the reducer, whole and at every cut in CUTS. `current` is the rise.current.v2 it seals
 * to, or null when it seals to nothing.
 */
export function sealStreamed(lines) {
  const text = `${lines.join('\n')}\n`;
  const { stream, sent } = readStreamed(text, [text.length]);
  const view = stream.snapshot();
  let current = null;
  try { current = stream.toCurrent(); } catch { /* nothing ended: reported as refused */ }
  return {
    lines, current, phase: view.phase, refusals: view.refusals, refusedScenes: stream.refusedScenes,
    sameAtEveryCut: CUTS.every(sizes => readStreamed(text, sizes).sent === sent)
  };
}

/** Every case in the corpus, in style and file order. A case in `streamed/` is the answer in beats, sealed here. */
export function loadCorpus(dir = CORPUS_DIR) {
  const cases = [];
  const styles = readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  for (const style of styles) {
    for (const name of readdirSync(join(dir, style)).filter(file => file.endsWith('.json')).sort()) {
      const file = join(dir, style, name);
      const { prompt, current, lines } = JSON.parse(readFileSync(file, 'utf8'));
      const where = relative(ROOT, file).split(sep).join('/');
      if (lines) {
        const streamed = sealStreamed(lines);
        cases.push({ file: where, style, prompt, current: streamed.current, streamed });
      } else cases.push({ file: where, style, prompt, current });
    }
  }
  return cases;
}

/** Whether a streamed case was read without anything dropped, refused, or read differently at another cut. */
const streamedOk = run => run.current !== null && run.phase === 'complete' && run.refusals === 0 && run.refusedScenes.length === 0 && run.sameAtEveryCut;

/** What the Worker says to a host that calls rise_present with this Current: null when it accepts it, else its refusal. */
async function admit(current) {
  const response = dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: TOOL_NAME, arguments: { current } } }, 'https://rise.invalid');
  const { result, error } = await response.json();
  if (error) return error.message;
  return result.isError ? result.content.map(item => item.text).join('\n') : null;
}

/** The cues the beats send to one scene, in order, each once. */
function cuesFor(current, sceneId) {
  const cues = [];
  let running = null;
  for (const beat of current.beats ?? []) {
    running = beat.scene ?? running;
    if (running === sceneId && beat.cue !== undefined && !cues.includes(beat.cue)) cues.push(beat.cue);
  }
  return cues;
}

let runs = 0;

/** Let a scene's settled or rejected tween promises report. */
const flush = () => new Promise(done => setImmediate(done));

/**
 * One run of a scene through the worker's protocol, driven by `drive`.
 * @returns {Promise<Array<object>>} everything the worker posted
 */
async function runPass({ code, theme, library, reducedMotion }, drive) {
  const posted = [];
  const ctx = fakeCanvasContext();
  let rise = null;
  const scope = { addEventListener() {}, postMessage: message => posted.push(message), close() {} };
  const worker = attachSceneWorker(scope, {
    // A fresh module each run, as the card loads a fresh blob: Node keeps one module per URL. The mark goes last so lines keep their numbers.
    toUrl: text => `data:text/javascript;base64,${Buffer.from(`${text}\n// run ${(runs += 1)}`, 'utf8').toString('base64')}`,
    load: async url => {
      const module = await import(/* @vite-ignore */ url);
      if (typeof module.default !== 'function') return module;
      // The rise the scene is given, kept so the run can ask the library whether anything still moves.
      return { ...module, default: given => { rise = given; return module.default(given); } };
    }
  });
  const canvas = { width: 0, height: 0, getContext: kind => (kind === '2d' ? ctx : null) };
  await worker.handle({ type: TO_WORKER.init, version: SCENE_PROTOCOL_VERSION, code, ...SIZE, theme, reducedMotion, library, canvas });
  if (posted.some(message => message.type === TO_HOST.ready)) {
    let t = 0;
    await drive({
      frame: async () => { t += STEP_MS; await worker.handle({ type: TO_WORKER.frame, t, dt: STEP_MS }); },
      cue: async (name, instant) => { await worker.handle({ type: TO_WORKER.cue, name, instant }); await flush(); },
      moving: () => (rise ? rise.lib.moving : 0)
    });
  }
  await flush();
  return posted;
}

/** Whether the card's kill switch would end a scene that drew these frames (scene-runtime.js). */
function wouldFallBack(frames) {
  let slow = [];
  for (const { t, ms } of frames) {
    if (ms > SCENE_LIMITS.frameHardMs) return true;
    if (ms > SCENE_LIMITS.frameSoftMs) {
      slow = [...slow.filter(at => t - at < 1000), t];
      if (slow.length >= SCENE_LIMITS.frameSoftCount) return true;
    }
  }
  return false;
}

async function evaluateScene(scene, current) {
  // A figure is drawn by the browser as an image; here it is only admitted again, as the card admits it.
  if (typeof scene.svg === 'string') return { id: scene.id, kind: 'figure', bytes: new TextEncoder().encode(scene.svg).length, cardAdmits: admitSvg(scene.svg).ok };
  if (typeof scene.code !== 'string') return { id: scene.id, kind: 'native', engine: scene.engine };
  const cues = cuesFor(current, scene.id);
  const setup = { code: scene.code, theme: current.theme ? jevColors(current.theme) : {}, library: styleOf(current.style)?.library ?? {} };
  // Playing: frames as the card sends them, then each cue animated and played out.
  const play = await runPass({ ...setup, reducedMotion: false }, async ({ frame, cue, moving }) => {
    for (let i = 0; i < WARM_FRAMES; i += 1) await frame();
    for (const name of cues) {
      await cue(name, false);
      for (let i = 0; i < SETTLE_FRAMES && moving() > 0; i += 1) await frame();
      await frame();
    }
  });
  // Seeking: every cue at once, as a replay delivers the cues of earlier beats.
  const seek = await runPass({ ...setup, reducedMotion: false }, async ({ frame, cue }) => {
    for (const name of cues) await cue(name, true);
    await frame();
  });
  // Reduced motion: a played cue's tweens land before the next frame.
  let settled = true;
  const still = await runPass({ ...setup, reducedMotion: true }, async ({ frame, cue, moving }) => {
    for (const name of cues) {
      await cue(name, false);
      if (moving() > 0) settled = false;
      await frame();
    }
  });
  const passes = [play, seek, still];
  const of = type => passes.flatMap(posted => posted.filter(message => message.type === type));
  const times = of(TO_HOST.frameDone).map(message => message.ms);
  return {
    id: scene.id,
    kind: 'code',
    cues,
    cuesHandled: of(TO_HOST.cued).length,
    frames: times.length,
    slowestMs: times.length ? Math.max(...times) : 0,
    overSoft: times.filter(ms => ms > SCENE_LIMITS.frameSoftMs).length,
    wouldFallBack: passes.some(posted => wouldFallBack(posted.filter(message => message.type === TO_HOST.frameDone))),
    reducedMotionSettled: settled,
    errors: of(TO_HOST.error).map(({ phase, message, where }) => ({ phase, message, where }))
  };
}

/**
 * @param {object} current a Current, as a host's model would pass it
 * @returns {Promise<{id: string|null, accepted: boolean, ok: boolean, refusal: string|null, scenes: Array<object>}>}
 */
export async function evaluateCurrent(current) {
  const refusal = await admit(current);
  if (refusal !== null) return { id: current?.id ?? null, accepted: false, ok: false, refusal, scenes: [] };
  const scenes = [];
  for (const scene of current.scenes ?? []) scenes.push(await evaluateScene(scene, current));
  const ok = scenes.every(scene => scene.kind === 'native'
    || (scene.kind === 'figure' ? scene.cardAdmits : scene.errors.length === 0 && scene.reducedMotionSettled));
  return { id: current.id, accepted: true, ok, refusal: null, scenes };
}

const ms = value => `${value.toFixed(2)} ms`;

function describeScene(scene) {
  if (scene.kind === 'figure') return `  scene "${scene.id}" (figure): ${scene.bytes} bytes of SVG; ${scene.cardAdmits ? 'the card admits it too' : 'the CARD REFUSES it'}; drawn only in the page, as an image`;
  if (scene.kind === 'native') return `  scene "${scene.id}" (native ${scene.engine}): checked against its manifest; drawn only in the page, not here`;
  const lines = [
    `  scene "${scene.id}" (code): cues ${scene.cues.length ? scene.cues.join(', ') : 'none'}; ${scene.cuesHandled} of ${scene.cues.length * 3} cue deliveries answered (played, seeked, reduced motion)`,
    `    ${scene.frames} frames, slowest ${ms(scene.slowestMs)}, ${scene.overSoft} over ${SCENE_LIMITS.frameSoftMs} ms${scene.wouldFallBack ? '; WOULD FALL BACK on the card\'s budget' : ''}`,
    `    reduced motion: ${scene.reducedMotionSettled ? 'every tween landed at once' : 'FAILED, a tween was still moving'}`
  ];
  for (const error of scene.errors) lines.push(`    ERROR (${error.phase}): ${error.message}${error.where ? ` at ${error.where}` : ''}`);
  return lines.join('\n');
}

function describeStreamed(run) {
  const beats = run.current?.beats.length ?? 0;
  const lines = [`  streamed: ${run.lines.length} lines in beats read to ${beats} beats and ${run.current?.scenes?.length ?? 0} scenes; ${run.phase}, ${run.refusals} events refused; `
    + `${run.sameAtEveryCut ? 'the same Current at every cut' : 'a DIFFERENT Current at some cut'} (whole, ${CUTS.map(sizes => sizes.join('/')).join(', ')})`];
  for (const { message } of run.refusedScenes) lines.push(`    REFUSED: ${message}`);
  return lines.join('\n');
}

async function main() {
  const corpus = loadCorpus();
  console.log(`RISE Creative Control evaluation: ${corpus.length} Currents from ${relative(ROOT, CORPUS_DIR).split(sep).join('/')}`);
  console.log(`Frame times are measured in Node over a canvas that draws no pixels: a proxy for the card's budget (${SCENE_LIMITS.frameSoftMs} ms soft, ${SCENE_LIMITS.frameHardMs} ms hard), not the card's own numbers.`);
  const reports = [];
  for (const item of corpus) {
    const evaluated = await evaluateCurrent(item.current);
    // A streamed case also passes only if the line format read it whole: nothing dropped, refused or cut differently.
    const report = item.streamed ? { ...evaluated, ok: evaluated.ok && streamedOk(item.streamed) } : evaluated;
    reports.push(report);
    console.log('');
    console.log(`${item.file}: ${report.ok ? 'PASS' : 'FAIL'} (${report.accepted ? 'accepted' : 'refused'})`);
    console.log(`  asked: "${item.prompt}"`);
    if (item.streamed) console.log(describeStreamed(item.streamed));
    if (!report.accepted) console.log(report.refusal.split('\n').map(line => `  ${line}`).join('\n'));
    for (const scene of report.scenes) console.log(describeScene(scene));
  }
  const drawn = reports.flatMap(report => report.scenes).filter(scene => scene.kind === 'code');
  const failed = reports.filter(report => !report.ok).length;
  const streamed = corpus.filter(item => item.streamed);
  console.log('');
  console.log(`${streamed.length} streamed: ${streamed.filter(item => streamedOk(item.streamed)).length} read whole and the same at every cut.`);
  console.log(`${reports.length} Currents: ${reports.filter(report => report.accepted).length} accepted, ${reports.filter(report => !report.accepted).length} refused; `
    + `${drawn.length} code scenes run, ${drawn.filter(scene => scene.errors.length).length} with errors, ${drawn.filter(scene => scene.wouldFallBack).length} over the budget; `
    + `slowest frame ${ms(Math.max(0, ...drawn.map(scene => scene.slowestMs)))}. ${failed ? `${failed} FAILED.` : 'All passed.'}`);
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => { process.exitCode = code; }, error => { console.error(error); process.exitCode = 1; });
}
