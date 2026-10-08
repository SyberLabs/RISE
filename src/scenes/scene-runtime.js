/**
 * The scene runtime: the Chamber's side of one generated scene
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §7, §12–13).
 *
 * It owns the worker's life and the scene's time. Frames are sent on the
 * display's clock only while the reading plays, so scene time stops with the
 * voice; a frame is not sent until the last is answered. A hold the scene is
 * running ends at its ms, or, for a scene that declared `reportsCompletion`,
 * when the scene says done (never sooner than SCENE_LIMITS.earliestDoneMs and
 * never later than maxMs).
 *
 * Everything the worker says is data: a message it does not know is dropped,
 * and one it knows is read field by field. A frame over budget, an error, or
 * silence ends the worker; the host is told once (onFailure) and any open hold
 * runs on its ms. A scene the flash gate stops is frozen instead: its last
 * frame stays and its holds run on their ms.
 */
import { SCENE_LIMITS, SCENE_PROTOCOL_VERSION, TO_HOST, TO_WORKER, knownMessage } from './scene-protocol.js';

const MESSAGE_LIMIT = 300;
const PHASES = ['load', 'init', 'frame', 'cue'];
const MAX_STEP_MS = 100;

/** What a running generated scene takes through the visual-control path: a cue, by name. */
export const SCENE_VISUAL_MANIFEST = Object.freeze({
  surface: 'scene',
  parameters: Object.freeze({ cue: Object.freeze({ type: 'name', cueable: true }) })
});

const wallClock = Object.freeze({
  now: () => performance.now(),
  setTimer: (fn, ms) => { const id = setTimeout(fn, ms); return () => clearTimeout(id); }
});

/**
 * @param {object} options
 * @param {() => Worker | Promise<Worker>} options.createWorker
 * @param {{transferControlToOffscreen: () => OffscreenCanvas}} options.canvas the layer's canvas, given to the worker
 * @param {{now: () => number, setTimer: (fn: Function, ms: number) => Function}} [options.clock] what holds and the silence watch wait on
 * @param {object} [options.theme] the reading's colours
 * @param {boolean} [options.reducedMotion]
 * @param {(diagnostic: {sceneId: string, phase: string, message: string, where: string|null}) => void} [options.onFailure]
 * @param {(value: number, t: number) => void} [options.onLuma] a brightness sample 0..1 at scene time t
 */
export function createSceneRuntime({
  createWorker, canvas, clock = wallClock, theme = {}, reducedMotion = false, onFailure = () => {}, onLuma = () => {},
  requestFrame = callback => requestAnimationFrame(callback), cancelFrame = id => cancelAnimationFrame(id)
}) {
  let worker = null;
  let sceneId = null;
  let size = { width: 300, height: 150, dpr: 1 };
  let ready = false;
  let reportsCompletion = false;
  let playing = false;
  let failed = false;
  let frozen = false;
  let disposed = false;
  let frameId = null;
  let lastStamp = null;
  let t = 0;
  let pending = false;
  let stopSilence = null;
  let slow = [];
  const queued = [];
  const holds = new Set();

  const post = message => { try { worker?.postMessage(message); } catch { /* a worker that is gone answers nothing, which the silence watch sees */ } };
  const live = () => worker !== null && !failed && !frozen && !disposed;

  function stopFrames() {
    if (frameId !== null) cancelFrame(frameId);
    frameId = null;
    lastStamp = null;
  }

  function loop() {
    if (frameId === null && playing && ready && live()) frameId = requestFrame(tick);
  }

  function tick(stamp) {
    frameId = null;
    if (!playing || !ready || !live()) return;
    if (!pending) {
      const dt = lastStamp === null ? 0 : Math.min(MAX_STEP_MS, Math.max(0, stamp - lastStamp));
      lastStamp = stamp;
      t += dt;
      pending = true;
      post({ type: TO_WORKER.frame, t, dt });
      stopSilence = clock.setTimer(() => fail('frame', 'The scene stopped answering'), SCENE_LIMITS.silenceMs);
    }
    loop();
  }

  /** Every open hold runs on its ms from where it began, the scene no longer deciding. */
  function holdsOnMs() {
    for (const hold of holds) hold.toMs();
  }

  function fail(phase, message, where = null) {
    if (failed || disposed) return;
    failed = true;
    stopFrames();
    stopSilence?.();
    try { worker?.terminate(); } catch { /* already gone */ }
    holdsOnMs();
    onFailure({ sceneId, phase, message: String(message).slice(0, MESSAGE_LIMIT), where });
  }

  function answered(data) {
    if (!Number.isFinite(data.t) || !Number.isFinite(data.ms)) return;
    pending = false;
    stopSilence?.();
    stopSilence = null;
    if (data.ms > SCENE_LIMITS.frameHardMs) {
      fail('frame', `A frame took ${Math.round(data.ms)} ms`);
      return;
    }
    if (data.ms > SCENE_LIMITS.frameSoftMs) {
      slow = [...slow.filter(at => data.t - at < 1000), data.t];
      if (slow.length >= SCENE_LIMITS.frameSoftCount) fail('frame', `The scene drew too slowly: ${slow.length} frames over ${SCENE_LIMITS.frameSoftMs} ms in one second`);
    }
  }

  function receive(data) {
    if (!knownMessage(data, TO_HOST) || failed || disposed) return;
    switch (data.type) {
      case TO_HOST.ready:
        if (ready) return;
        ready = true;
        reportsCompletion = data.reportsCompletion === true;
        for (const message of queued.splice(0)) post(message);
        loop();
        return;
      case TO_HOST.frameDone:
        answered(data);
        return;
      case TO_HOST.done:
        if (reportsCompletion && !frozen) for (const hold of holds) hold.done();
        return;
      case TO_HOST.luma:
        if (!frozen && Number.isFinite(data.value) && data.value >= 0 && data.value <= 1 && Number.isFinite(data.t)) onLuma(data.value, data.t);
        return;
      case TO_HOST.error:
        fail(PHASES.includes(data.phase) ? data.phase : 'frame',
          typeof data.message === 'string' && data.message ? data.message : 'The scene failed',
          typeof data.where === 'string' ? data.where.slice(0, 120) : null);
        return;
      default:
    }
  }

  return {
    /** Make the worker, give it the canvas and the code. */
    async start(scene) {
      sceneId = scene.id;
      let made;
      try {
        made = await createWorker();
      } catch (error) {
        if (!disposed) fail('load', `The scene could not start: ${error?.message ?? error}`);
        return;
      }
      if (disposed) { try { made.terminate(); } catch { /* never started */ } return; }
      worker = made;
      worker.onmessage = event => receive(event.data);
      worker.onerror = () => fail('load', 'The scene could not run');
      try {
        const offscreen = canvas.transferControlToOffscreen();
        worker.postMessage({
          type: TO_WORKER.init, version: SCENE_PROTOCOL_VERSION, code: scene.code, ...size, theme, reducedMotion, canvas: offscreen
        }, [offscreen]);
      } catch (error) {
        fail('load', `The scene could not start: ${error?.message ?? error}`);
      }
    },

    play() { playing = true; loop(); },

    pause() { playing = false; stopFrames(); },

    cue(name, { instant = false } = {}) {
      if (failed || disposed) return;
      const message = { type: TO_WORKER.cue, name, instant: instant === true };
      if (ready) post(message);
      else queued.push(message);
    },

    resize(width, height, dpr = 1) {
      if (![width, height, dpr].every(Number.isFinite)) return;
      size = { width, height, dpr: Math.min(SCENE_LIMITS.maxDpr, Math.max(1, dpr)) };
      if (worker && live()) post({ type: TO_WORKER.resize, ...size });
    },

    /** A hold of this scene: resolved { reason: 'ended' } by its ms, the scene's done, or its maxMs. */
    hold({ ms, maxMs }) {
      return new Promise(resolve => {
        const began = clock.now();
        let cancel = null;
        const hold = {
          end() { cancel?.(); holds.delete(hold); resolve({ reason: 'ended' }); },
          at(due) { cancel?.(); cancel = clock.setTimer(() => hold.end(), Math.max(0, began + due - clock.now())); },
          toMs() { hold.at(ms); },
          done() { hold.at(Math.min(Math.max(clock.now() - began, SCENE_LIMITS.earliestDoneMs), maxMs ?? ms)); }
        };
        holds.add(hold);
        if (reportsCompletion && live()) hold.at(maxMs ?? ms);
        else hold.toMs();
      });
    },

    /** Stop drawing and keep the last frame: what the flash gate asks for. */
    freeze() {
      if (frozen) return;
      frozen = true;
      stopFrames();
      holdsOnMs();
    },

    dispose() {
      if (disposed) return;
      stopFrames();
      stopSilence?.();
      post({ type: TO_WORKER.dispose });
      try { worker?.terminate(); } catch { /* already gone */ }
      disposed = true;
      holdsOnMs();
    }
  };
}

/**
 * Turn a scene's brightness samples into flashes for a VisualFlashGate: a
 * flash is a pair of opposing changes of at least a tenth of full brightness
 * where the darker state is below 0.8 (the general flash threshold). Returns
 * a function of (value, t) that is true once the gate refuses a flash.
 */
export function createFlashWatch(gate) {
  let last = null;
  let open = 0;
  return (value, t) => {
    const previous = last;
    last = value;
    if (previous === null) return false;
    const change = value - previous;
    if (Math.abs(change) < 0.1 || Math.min(value, previous) >= 0.8) return false;
    const direction = Math.sign(change);
    if (open === -direction) {
      open = 0;
      if (!gate.canAllow(t)) return true;
      gate.commit(t);
    } else {
      open = direction;
    }
    return false;
  };
}
