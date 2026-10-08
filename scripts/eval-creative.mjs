/**
 * The Creative Control evaluation (docs/evals/creative-control/README.md).
 *
 * For every case in the corpus (docs/evals/creative-control/<style>/*.json,
 * each { prompt, current }), the Current goes through the Worker's own
 * rise_present door (worker/mcp-server.mjs dispatch: the size limit, the
 * validator, and the static admission of every code scene), and every code
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

const ROOT = resolve(import.meta.dirname, '..');
export const CORPUS_DIR = join(ROOT, 'docs', 'evals', 'creative-control');

const SIZE = Object.freeze({ width: 800, height: 450, dpr: 1 });
const STEP_MS = 16.7;
const WARM_FRAMES = 60;
/** The most frames a played cue is given to land: ten seconds of animation. */
const SETTLE_FRAMES = 600;

/** Every case in the corpus, in style and file order. */
export function loadCorpus(dir = CORPUS_DIR) {
  const cases = [];
  const styles = readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  for (const style of styles) {
    for (const name of readdirSync(join(dir, style)).filter(file => file.endsWith('.json')).sort()) {
      const file = join(dir, style, name);
      const { prompt, current } = JSON.parse(readFileSync(file, 'utf8'));
      cases.push({ file: relative(ROOT, file).split(sep).join('/'), style, prompt, current });
    }
  }
  return cases;
}

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
  const ok = scenes.every(scene => scene.kind === 'native' || (scene.errors.length === 0 && scene.reducedMotionSettled));
  return { id: current.id, accepted: true, ok, refusal: null, scenes };
}

const ms = value => `${value.toFixed(2)} ms`;

function describeScene(scene) {
  if (scene.kind === 'native') return `  scene "${scene.id}" (native ${scene.engine}): checked against its manifest; drawn only in the page, not here`;
  const lines = [
    `  scene "${scene.id}" (code): cues ${scene.cues.length ? scene.cues.join(', ') : 'none'}; ${scene.cuesHandled} of ${scene.cues.length * 3} cue deliveries answered (played, seeked, reduced motion)`,
    `    ${scene.frames} frames, slowest ${ms(scene.slowestMs)}, ${scene.overSoft} over ${SCENE_LIMITS.frameSoftMs} ms${scene.wouldFallBack ? '; WOULD FALL BACK on the card\'s budget' : ''}`,
    `    reduced motion: ${scene.reducedMotionSettled ? 'every tween landed at once' : 'FAILED, a tween was still moving'}`
  ];
  for (const error of scene.errors) lines.push(`    ERROR (${error.phase}): ${error.message}${error.where ? ` at ${error.where}` : ''}`);
  return lines.join('\n');
}

async function main() {
  const corpus = loadCorpus();
  console.log(`RISE Creative Control evaluation: ${corpus.length} Currents from ${relative(ROOT, CORPUS_DIR).split(sep).join('/')}`);
  console.log(`Frame times are measured in Node over a canvas that draws no pixels: a proxy for the card's budget (${SCENE_LIMITS.frameSoftMs} ms soft, ${SCENE_LIMITS.frameHardMs} ms hard), not the card's own numbers.`);
  const reports = [];
  for (const item of corpus) {
    const report = await evaluateCurrent(item.current);
    reports.push(report);
    console.log('');
    console.log(`${item.file}: ${report.ok ? 'PASS' : 'FAIL'} (${report.accepted ? 'accepted' : 'refused'})`);
    console.log(`  asked: "${item.prompt}"`);
    if (!report.accepted) console.log(report.refusal.split('\n').map(line => `  ${line}`).join('\n'));
    for (const scene of report.scenes) console.log(describeScene(scene));
  }
  const drawn = reports.flatMap(report => report.scenes).filter(scene => scene.kind === 'code');
  const failed = reports.filter(report => !report.ok).length;
  console.log('');
  console.log(`${reports.length} Currents: ${reports.filter(report => report.accepted).length} accepted, ${reports.filter(report => !report.accepted).length} refused; `
    + `${drawn.length} code scenes run, ${drawn.filter(scene => scene.errors.length).length} with errors, ${drawn.filter(scene => scene.wouldFallBack).length} over the budget; `
    + `slowest frame ${ms(Math.max(0, ...drawn.map(scene => scene.slowestMs)))}. ${failed ? `${failed} FAILED.` : 'All passed.'}`);
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(code => { process.exitCode = code; }, error => { console.error(error); process.exitCode = 1; });
}
