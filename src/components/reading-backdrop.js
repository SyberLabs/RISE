/**
 * A reading's backdrop: its own engine, live behind a page that previews the
 * look the reading will have. Today runs it faint behind the day's poem; Home
 * runs it full-screen behind the reading it opens on. The engine is the one
 * the reading itself uses:
 *
 *   attractor mode      -> AttractorField (signal), at the reader's own intensity
 *   ostensoria/apparitio -> PlateField (ember)
 *   fractal             -> one FractalFlame at a time, the next every 18 s (revel)
 *
 * Under reduced motion each holds one still frame. Engines load on demand.
 * Resolves to { pause, resume, destroy }, or null when the reading has no
 * engine this knows (the page then stays on ink).
 */
import './reading-backdrop.css';

const FRACTAL_DWELL_MS = 18_000;

const reducedMotion = () => typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function mountReadingBackdrop(host, decision) {
  const visual = decision?.config?.visualConfig;
  const engine = visual?.interlocution?.procedural?.[0];

  if (visual?.visualMode === 'attractor') {
    const { AttractorField } = await import('../visuals/attractor.js');
    const { system, palette, form } = visual.attractor || {};
    const field = new AttractorField(host, { system, palette, form });
    return { pause: () => field.pause(), resume: () => field.resume(), destroy: () => field.destroy() };
  }

  if (engine === 'ostensoria' || engine === 'apparitio') {
    const { PlateField } = await import('../visuals/plate-field.js');
    const field = new PlateField(host, { families: [engine], reducedMotion: reducedMotion() });
    field.start();
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
      timer = setTimeout(async () => {
        await flame.fillQueue(1);
        if (!timer) return;
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
