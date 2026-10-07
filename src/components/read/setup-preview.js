/**
 * The live preview on Reader setup's first screen (CONSOLIDATED-READER §3):
 * the chosen look's field in its colour, and the reading's first unit in the
 * chosen rhythm over it. It plays no sound and holds no control.
 *
 * THE NAVIGATOR'S STAGE, NOT A SECOND ONE. The still is the navigator's still
 * (one queue, one cache, shared with its rail), and the motion is its live
 * stage: at most one engine, mounted only after a dwell, only an engine that
 * is whole at once, released whenever anything claims the screen. An engine
 * with no live factory shows its still alone.
 *
 * ONE STILL FRAME when motion is unwelcome: reduced motion, the OS asking for
 * it, or photosensitivity mode. The still stays under the engine, so a paused
 * or released preview still shows the field.
 *
 * `?measure=1` keeps `window.__riseSetupPreview`, a read-only record of the
 * frames drawn while an engine is live. Nothing is kept or logged otherwise.
 */
import { compileSession } from '../../core/session-compiler.js';
import { safeUrl } from '../../core/sanitize.js';
import { createLiveStage } from '../visual-navigator/live-stage.js';
import { stillQueue } from '../visual-navigator/preview.js';

// Enough for any first sentence. The compiler refuses a source over its limit,
// and a book recompiled on every rhythm change would stall the screen.
const HEAD_CHARACTERS = 2000;

const engineStill = engineId => stillQueue.request(engineId, async () => {
  const { visualCortex } = await import('../../visuals/visual-cortex.js');
  return (await visualCortex.renderLeafStill(engineId))?.url;
});

/**
 * The reading's first unit in `chunkMode`, cut by the session compiler from
 * the opening of its first source.
 */
export function firstUnit({ text, sources, chunkMode, verseLines } = {}) {
  const first = Array.isArray(sources) && typeof sources[0]?.data === 'string' ? sources[0] : null;
  const head = (first ? first.data : (typeof text === 'string' ? text : '')).slice(0, HEAD_CHARACTERS);
  if (!head.trim()) return '';
  try {
    const session = compileSession(first
      ? { sources: [{ ...first, data: head }], chunkMode }
      : { text: head, chunkMode, verseLines });
    return session.atoms.find(atom => typeof atom.content === 'string' && atom.content.trim())?.content ?? '';
  } catch {
    return '';
  }
}

export function createSetupPreview(host, {
  factories,
  loadStill = engineStill,
  dwellMs,
  win = window,
  doc = document
} = {}) {
  host.innerHTML = '<div class="setup-preview-still"></div><div class="setup-preview-live"></div><p class="setup-preview-unit"></p>';
  const stillEl = host.querySelector('.setup-preview-still');
  const unitEl = host.querySelector('.setup-preview-unit');
  const stillOnly = () => {
    const root = doc.documentElement.classList;
    return root.contains('reduced-motion') || root.contains('photosensitivity-mode')
      || (typeof win.matchMedia === 'function' && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  const stage = createLiveStage({
    host: host.querySelector('.setup-preview-live'),
    ...(factories ? { factories } : {}),
    ...(dwellMs !== undefined ? { dwellMs } : {}),
    reducedMotion: stillOnly,
    doc
  });
  let stillEngine = null;
  let destroyed = false;

  // Intervals between animation frames while an engine is mounted; the first
  // frame after a release starts a new run, so a pause is never a long frame.
  const tally = { frames: 0, longest: 0, over16: 0, over33: 0 };
  let lastFrame = null;
  let frameId = 0;
  const onFrame = now => {
    if (destroyed) return;
    frameId = win.requestAnimationFrame(onFrame);
    if (!stage.mounted) {
      lastFrame = null;
      return;
    }
    if (lastFrame !== null) {
      const interval = now - lastFrame;
      tally.frames += 1;
      tally.longest = Math.max(tally.longest, interval);
      if (interval > 16.7) tally.over16 += 1;
      if (interval > 33) tally.over33 += 1;
    }
    lastFrame = now;
  };
  if (new URLSearchParams(win.location?.search || '').has('measure')) {
    const share = count => (tally.frames ? count / tally.frames : 0);
    win.__riseSetupPreview = Object.freeze({
      get frames() { return tally.frames; },
      get longestFrameMs() { return tally.longest; },
      get shareOver16_7ms() { return share(tally.over16); },
      get shareOver33ms() { return share(tally.over33); }
    });
    frameId = win.requestAnimationFrame(onFrame);
  }

  const paintStill = engine => {
    if (engine === stillEngine) return;
    stillEngine = engine;
    stillEl.style.backgroundImage = '';
    if (!engine) return;
    void Promise.resolve(loadStill(engine)).then(url => {
      const safe = safeUrl(url || '');
      if (destroyed || stillEngine !== engine || !safe) return;
      stillEl.style.backgroundImage = `url("${safe}")`;
    });
  };

  return {
    show({ engine = null, style = {}, ground, ink, unit = '' }) {
      if (destroyed) return;
      host.style.setProperty('--preview-ground', ground);
      host.style.setProperty('--preview-ink', ink);
      unitEl.textContent = unit;
      paintStill(engine);
      stage.focus(engine, style);
    },
    suspend(reason) {
      stage.suspend(reason);
    },
    resume(reason) {
      stage.resume(reason);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stage.destroy();
      if (frameId) win.cancelAnimationFrame?.(frameId);
    }
  };
}
