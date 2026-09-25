/**
 * At most one engine drawing behind the phone stage.
 *
 * A rail of stills costs nothing to scroll; a rail of live engines would cost
 * a canvas and an animation frame each. So there is one slot. It is filled
 * only after the reader has dwelt on a drawn visual, only by an engine that
 * can stand alone (the same classes the Chamber mounts), and it is emptied
 * whenever anything else claims the screen: a sheet, a hidden page, a
 * different visual. Under reduced motion it is never filled.
 *
 * ONLY AN ENGINE THAT IS WHOLE AT ONCE. The attractor integrates its figure
 * before the first frame, so going live adds motion to the picture already
 * shown. Genesis grows from an empty page over ~28 s; mounted here it replaced
 * a finished still with a nearly black canvas — less, not more. It keeps its
 * still.
 */

const DEFAULT_FACTORIES = Object.freeze({
  attractor: async (host, style = {}) => {
    const { AttractorField } = await import('../../visuals/attractor.js');
    return new AttractorField(host, { ...style, adaptive: true });
  }
});

export function createLiveStage({
  host,
  factories = DEFAULT_FACTORIES,
  dwellMs = 600,
  reducedMotion = () => typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  doc = document
} = {}) {
  let wanted = null;
  let wantedStyle = {};
  let engine = null;
  let timer = null;
  let generation = 0;
  let destroyed = false;
  const holds = new Set();

  const release = () => {
    generation += 1;
    clearTimeout(timer);
    timer = null;
    host.classList.remove('is-live');
    engine?.destroy?.();
    engine = null;
  };

  const arm = () => {
    release();
    if (destroyed || holds.size || !wanted || !factories[wanted] || reducedMotion()) return;
    const ticket = generation;
    const id = wanted;
    timer = setTimeout(async () => {
      timer = null;
      let made = null;
      try {
        made = await factories[id](host, wantedStyle);
      } catch {
        return;
      }
      if (ticket !== generation || destroyed) {
        made?.destroy?.();
        return;
      }
      engine = made;
      host.classList.add('is-live');
    }, dwellMs);
  };

  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') {
      holds.add('hidden');
      release();
    } else if (holds.delete('hidden')) {
      arm();
    }
  };
  doc.addEventListener('visibilitychange', onVisibility);

  return {
    focus(id, style = {}) {
      if (destroyed) return;
      const same = id === wanted && JSON.stringify(style) === JSON.stringify(wantedStyle);
      wanted = id || null;
      wantedStyle = style || {};
      if (!same || (!engine && !timer)) arm();
    },
    suspend(reason = 'external') {
      holds.add(reason);
      release();
    },
    resume(reason = 'external') {
      if (holds.delete(reason)) arm();
    },
    destroy() {
      if (destroyed) return;
      release();
      destroyed = true;
      doc.removeEventListener('visibilitychange', onVisibility);
    },
    get mounted() {
      return engine ? wanted : null;
    }
  };
}
