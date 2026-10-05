/**
 * A reading's backdrop: its own engine, live behind a page that previews the
 * look the reading will have. Home runs it full-screen behind the reading it
 * opens on. The engine is the one
 * the reading itself uses:
 *
 *   attractor mode      -> AttractorField (signal), at the reader's own intensity
 *   ostensoria/apparitio -> PlateField (ember)
 *   fractal             -> one FractalFlame at a time, the next every 18 s (revel)
 *
 * Under reduced motion each holds one still frame. Engines load on demand.
 * `mountReadingBackdrop` resolves to { pause, resume, destroy }, or null when
 * the reading has no engine this knows (the page then stays on ink).
 *
 * A page shows its engine through a `ReadingStage`, which owns the rest: each
 * reading's engine in its own layer, cross-faded over the last; a mount that a
 * newer one overtook is destroyed; a hidden tab pauses it; and pausing or
 * destroying the stage finishes any fade first, so no engine runs behind
 * another room.
 */
import './reading-backdrop.css';
import { themeEngine } from '../core/theme-engine-map.js';

const FRACTAL_DWELL_MS = 18_000;
// The cross-fade, written once: the stage hands it to its stylesheet.
const FADE_MS = 900;

const reducedMotion = () => typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function mountReadingBackdrop(host, decision) {
  const visual = decision?.config?.visualConfig;
  const engine = visual?.interlocution?.procedural?.[0];

  if (visual?.visualMode === 'attractor') {
    const { AttractorField } = await import('../visuals/attractor.js');
    const own = visual.attractor || {};
    // White is no choice: the theme's row mounts, as the Chamber will mount it.
    const { system, palette, form } = !own.palette || own.palette === 'white'
      ? { ...own, ...themeEngine(decision.config.colorTheme, 'attractor') }
      : own;
    const field = new AttractorField(host, { system, palette, form });
    return { pause: () => field.pause(), resume: () => field.resume(), destroy: () => field.destroy() };
  }

  if (engine === 'ostensoria' || engine === 'apparitio') {
    const { PlateField } = await import('../visuals/plate-field.js');
    const field = new PlateField(host, { families: [engine], reducedMotion: reducedMotion(), sliceFirstPlate: true });
    // The first plate bakes in slices; the stage keeps the last engine up until it is drawn.
    await field.start();
    return { pause: () => field.pause(), resume: () => field.resume(), destroy: () => field.destroy() };
  }

  if (engine === 'fractal') {
    const { FractalFlame } = await import('../visuals/fractal.js');
    const canvas = document.createElement('canvas');
    canvas.className = 'reading-backdrop-flame';
    canvas.setAttribute('aria-hidden', 'true');
    host.append(canvas);
    const flame = new FractalFlame(canvas);
    flame.setColorTheme(decision.config.colors);
    await flame.preload(1);
    flame.generate(null);
    if (reducedMotion()) {
      return { pause() {}, resume() {}, destroy() { flame.destroy(); canvas.remove(); } };
    }
    let timer = 0;
    const next = () => {
      const mine = timer = setTimeout(async () => {
        await flame.fillQueue(1);
        // Paused, resumed or destroyed while the next frame loaded: this loop is over.
        if (timer !== mine) return;
        flame.generate(null);
        next();
      }, FRACTAL_DWELL_MS);
    };
    const stop = () => { clearTimeout(timer); timer = 0; };
    next();
    return {
      pause: stop,
      resume() { if (!timer) next(); },
      destroy() { stop(); flame.destroy(); canvas.remove(); }
    };
  }

  return null;
}

/** The engine behind a page, one reading at a time. */
export class ReadingStage {
  constructor(host) {
    this.host = host;
    host.style.setProperty('--reading-stage-fade', `${FADE_MS}ms`);
    // { decision, backdrop, layer }: the engine showing.
    this.current = null;
    // The decision last asked for, mounted or not.
    this.wanted = null;
    // Engines fading out under the current one, each with its timer.
    this.fading = [];
    this.ticket = 0;
    this.paused = false;
    this.onVisibility = () => {
      if (document.hidden) this.halt();
      else if (!this.paused) this.current?.backdrop?.resume();
    };
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /**
   * Show the decision's engine: mount it in a new layer over the old, fade it
   * in, then destroy the old. Showing the decision already shown does nothing.
   */
  async show(decision) {
    if (decision === this.wanted) return;
    this.wanted = decision;
    const ticket = ++this.ticket;
    const layer = document.createElement('div');
    layer.className = 'reading-stage-layer';
    this.host.append(layer);
    let backdrop = null;
    try {
      backdrop = await mountReadingBackdrop(layer, decision);
    } catch (error) {
      console.warn('[RISE] the reading\'s engine could not start; the page shows on ink.', error);
    }
    if (ticket !== this.ticket) {
      backdrop?.destroy();
      layer.remove();
      return;
    }
    const old = this.current;
    this.current = { decision, backdrop, layer };
    if (this.paused || document.hidden) backdrop?.pause();
    // A style read between append and class, so the layer fades from nothing.
    void layer.offsetWidth;
    layer.classList.add('is-shown');
    if (!old) return;
    old.layer.classList.remove('is-shown');
    if (this.paused || reducedMotion()) {
      end(old);
      return;
    }
    old.timer = setTimeout(() => {
      this.fading = this.fading.filter(item => item !== old);
      end(old);
    }, FADE_MS);
    this.fading.push(old);
  }

  /** Hold the engine still; one still fading goes now. */
  pause() {
    this.paused = true;
    this.halt();
  }

  resume() {
    this.paused = false;
    if (!document.hidden) this.current?.backdrop?.resume();
  }

  destroy() {
    this.ticket++;
    this.wanted = null;
    this.halt();
    if (this.current) end(this.current);
    this.current = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  halt() {
    for (const old of this.fading) {
      clearTimeout(old.timer);
      end(old);
    }
    this.fading = [];
    this.current?.backdrop?.pause();
  }
}

function end({ backdrop, layer }) {
  backdrop?.destroy();
  layer.remove();
}
