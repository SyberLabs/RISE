/**
 * Browser stage for Chamber-identical offline frames.
 *
 * Drives the same painters the Chamber uses — Klee, Turrell, fractal,
 * neural, rock garden, harmonograph, iris plates, spectral plates,
 * genesis, attractor, focals, work
 * engines — at explicit presentation time. Not a screen recording of rAF.
 */

import { sizeAtomScale, stripEmphasis } from '../recitation.js';
import { PROCEDURAL_PATTERN_IDS } from '../visual-registry.js';
import { FOCAL_GLYPHS } from '../visual-style-definitions.js';
import { createSeededRandom } from '../../visuals/lib/klee-core.js';
import { KleeEngine, KLEE_CHAMBER_BACKGROUND, KLEE_PRESET_NAMES } from '../../visuals/klee-enhanced.js';
import { genesisProgressForRun } from '../../visuals/klee-field.js';
import {
  GALLERY_CADENCE_DEFAULT,
  galleryCadenceTimings,
  galleryDrawProgress,
  harmonographDrawProgress
} from '../visual-presence.js';
import { Turrell } from '../../visuals/turrell.js';
import { Harmonograph } from '../../visuals/harmonograph.js';
import { Ostensoria } from '../../visuals/ostensoria.js';
import { Apparitio } from '../../visuals/apparitio.js';
import { RockGarden } from '../../visuals/rockgarden.js';
import { NeuralNetwork } from '../../visuals/neural.js';
import { FractalFlameGenerator } from '../../visuals/lib/fractal-engine.js';
import { AttractorField } from '../../visuals/attractor.js';
import { RosaMystica } from '../../visuals/rosa-mystica.js';
import {
  isWorkEngineFamily,
  loadWorkEngines
} from '../../visuals/work-engines.js';
import { TIME_SCALE } from '../../visuals/work-engine-field.js';

const VOID = KLEE_CHAMBER_BACKGROUND;

function paintAtom(el, text, showGlass) {
  const content = stripEmphasis(text || '');
  el.textContent = content;
  el.style.setProperty('--atom-scale', String(sizeAtomScale(content)));
  el.classList.toggle('glass-tile', Boolean(showGlass && content));
}

function withSeededRandom(seed, fn) {
  const rng = createSeededRandom(String(seed));
  const original = Math.random;
  Math.random = rng;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function pick(seed, list) {
  if (!list.length) return null;
  const rng = createSeededRandom(String(seed));
  return list[Math.floor(rng() * list.length)];
}

function pinKleePreset(seed, authored) {
  if (KLEE_PRESET_NAMES.includes(authored)) return authored;
  return pick(`${seed}:genesis-preset`, KLEE_PRESET_NAMES);
}

function hashSeed(seed) {
  const rng = createSeededRandom(String(seed));
  return Math.floor(rng() * 0xffffff);
}

function focalGlyph(id) {
  return FOCAL_GLYPHS.find(item => item.id === id) || FOCAL_GLYPHS[0];
}

function clearVoid(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function loadDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Admitted still failed to decode'));
    img.src = dataUrl;
  });
}

async function drawCover(canvas, image, alpha = 1) {
  if (!image || alpha <= 0) return;
  let source = null;
  let width = 0;
  let height = 0;
  if (image?.dataUrl) {
    if (!image._img) image._img = await loadDataUrl(image.dataUrl);
    const img = image._img;
    source = img;
    width = img.naturalWidth;
    height = img.naturalHeight;
  } else if (image?.width && image?.height && image.rgba) {
    const pixels = new ImageData(
      new Uint8ClampedArray(image.rgba),
      image.width,
      image.height
    );
    const off = document.createElement('canvas');
    off.width = image.width;
    off.height = image.height;
    off.getContext('2d').putImageData(pixels, 0, 0);
    source = off;
    width = image.width;
    height = image.height;
  }
  if (!source || !width || !height) return;
  const scale = Math.max(canvas.width / width, canvas.height / height);
  const tw = width * scale;
  const th = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(source, (canvas.width - tw) / 2, (canvas.height - th) / 2, tw, th);
  ctx.restore();
}

async function coverImage(canvas, image) {
  clearVoid(canvas);
  await drawCover(canvas, image, 1);
}

const stage = {
  ready: false,
  width: 1080,
  height: 1920,
  seed: 'chamber-stage',
  canvas: null,
  host: null,
  field: null,
  stills: new Map(),
  activeKey: null,
  painter: null,

  async prepare({ width, height, seed, stills = [] } = {}) {
    this.width = width;
    this.height = height;
    this.seed = seed || 'chamber-stage';
    this.field = document.getElementById('chamber-field');
    this.host = document.getElementById('visual-host');
    this.host.replaceChildren();
    const canvas = document.createElement('canvas');
    canvas.className = 'klee-field-canvas';
    canvas.width = width;
    canvas.height = height;
    canvas.setAttribute('aria-hidden', 'true');
    this.host.appendChild(canvas);
    this.canvas = canvas;
    this.replaceStills(stills);
    await document.fonts.load('400 72px "Crimson Pro"');
    await document.fonts.ready;
    this.ready = true;
    await this.teardown();
    clearVoid(canvas);
    paintAtom(document.getElementById('atom-display'), '', false);
  },

  cacheStill(still) {
    if (still?.id) this.stills.set(still.id, still);
  },

  replaceStills(stills = []) {
    this.stills = new Map();
    for (const still of stills) this.cacheStill(still);
  },

  async teardown() {
    this.painter?.destroy?.();
    this.painter = null;
    this.activeKey = null;
    this.host?.querySelectorAll('canvas:not(.klee-field-canvas), .focal-glyph, .focal-rose, .chamber-attractor, .chamber-focal')
      .forEach(node => node.remove());
    if (this.canvas) this.canvas.style.display = 'block';
  },

  setFieldMode(mode) {
    const field = this.field;
    if (!field) return;
    field.classList.toggle('chamber-field-genesis', mode === 'genesis' || mode === 'figure');
    field.classList.toggle('chamber-field-focal', mode === 'focal');
    this.host.className = mode === 'attractor'
      ? 'chamber-attractor'
      : mode === 'focal'
        ? 'chamber-focal'
        : 'chamber-genesis';
  },

  async ensure(key, factory) {
    if (this.activeKey === key && this.painter) return this.painter;
    await this.teardown();
    this.painter = await factory();
    this.activeKey = key;
    return this.painter;
  },

  async paint(state = {}) {
    const text = state.text || '';
    const cueKind = state.cueKind || 'visual:still';
    const cue = state.cue || { kind: 'still' };
    const elapsedMs = Number(state.elapsedMs) || 0;
    const durationMs = Number(state.durationMs) || 0;
    const seed = state.seed || this.seed;
    const progress = genesisProgressForRun(elapsedMs, durationMs);
    const resolved = this.resolveKind(cueKind, cue, seed);
    const showGlass = resolved.glass;
    this.setFieldMode(resolved.mode);
    await this.paintResolved(resolved, {
      cue, elapsedMs, durationMs, progress, seed,
      stillId: state.stillId,
      incomingStillId: state.incomingStillId,
      dissolve: Number.isFinite(state.dissolve) ? state.dissolve : 1
    });
    paintAtom(document.getElementById('atom-display'), text, showGlass);
  },

  resolveKind(cueKind, cue, seed) {
    const genesisGlass = cue?.config?.glass !== false;
    if (cueKind === 'visual:procedural:shuffled') {
      const names = [...(cue.collections || []), ...(cue.engines || [])];
      const chosen = pick(`${seed}:${cueKind}:${names.join('|')}`, names)
        || names[0]
        || 'klee';
      if (isWorkEngineFamily(chosen)) {
        return { kind: 'visual:procedural:work-engine', family: chosen, glass: true, mode: 'figure' };
      }
      if (PROCEDURAL_PATTERN_IDS.includes(chosen)) {
        return {
          kind: `visual:procedural:${chosen}`,
          glass: chosen === 'klee' ? genesisGlass : true,
          mode: chosen === 'klee' ? 'genesis' : 'figure'
        };
      }
    }
    if (cueKind === 'visual:procedural:klee' || cueKind === 'visual:field:genesis') {
      return { kind: cueKind, glass: genesisGlass, mode: 'genesis' };
    }
    if (cueKind === 'visual:field:attractor') {
      return { kind: cueKind, glass: false, mode: 'attractor' };
    }
    if (cueKind === 'visual:focal' || cueKind === 'visual:field:focal') {
      return { kind: cueKind, glass: false, mode: 'focal' };
    }
    if (cueKind?.startsWith('visual:procedural:') || cueKind?.startsWith('visual:sourced:')) {
      return { kind: cueKind, glass: true, mode: 'figure' };
    }
    if (cueKind === 'visual:video') {
      return { kind: cueKind, glass: true, mode: 'figure' };
    }
    return { kind: 'visual:still', glass: false, mode: 'figure' };
  },

  async paintResolved(resolved, ctx) {
    const { kind } = resolved;
    if (kind === 'visual:procedural:klee' || kind === 'visual:field:genesis') {
      return this.paintKlee(ctx, kind);
    }
    if (kind === 'visual:procedural:turrell') return this.paintTurrell(ctx);
    if (kind === 'visual:procedural:harmonograph') return this.paintHarmonograph(ctx);
    if (kind === 'visual:procedural:ostensoria') return this.paintOstensoria(ctx);
    if (kind === 'visual:procedural:apparitio') return this.paintApparitio(ctx);
    if (kind === 'visual:procedural:rockgarden') return this.paintRockGarden(ctx);
    if (kind === 'visual:procedural:neural') return this.paintNeural(ctx);
    if (kind === 'visual:procedural:fractal') return this.paintFractal(ctx);
    if (kind === 'visual:procedural:work-engine') {
      return this.paintWorkEngine(ctx, resolved.family);
    }
    if (kind === 'visual:field:attractor') return this.paintAttractor(ctx);
    if (kind === 'visual:focal' || kind === 'visual:field:focal') return this.paintFocal(ctx);
    if (kind === 'visual:still'
      || kind === 'visual:sourced:project-image'
      || kind === 'visual:sourced:gallery'
      || kind === 'visual:sourced:collection'
      || kind === 'visual:video') {
      return this.paintStill(ctx);
    }
    await this.ensure('void', () => ({ destroy() {} }));
    clearVoid(this.canvas);
  },

  async paintKlee(ctx, kind) {
    const preset = pinKleePreset(ctx.seed, ctx.cue?.config?.preset);
    const key = `${kind}:${preset}:${ctx.seed}`;
    const painter = await this.ensure(key, () => {
      const engine = new KleeEngine();
      engine.width = this.width;
      engine.height = this.height;
      engine.generateRandom(preset, { seed: `${ctx.seed}:${preset}`, detectForms: false });
      return { engine, destroy() {} };
    });
    painter.engine.render(this.canvas, {
      background: VOID,
      progress: ctx.progress,
      showForms: ctx.progress > 0.7,
      texture: ctx.progress >= 1 ? painter.engine.renderStyle.texture : 0
    });
  },

  async paintTurrell(ctx) {
    const key = `turrell:${ctx.seed}`;
    const painter = await this.ensure(key, () => {
      const engine = new Turrell(document.createElement('div'));
      withSeededRandom(`${ctx.seed}:turrell`, () => engine.generate());
      return { engine, destroy() {} };
    });
    painter.engine.render(this.canvas, painter.engine.lastPlan);
  },

  async paintHarmonograph(ctx) {
    const climate = ctx.cue?.config?.climate || 'auto';
    const key = `harmonograph:${climate}:${ctx.seed}`;
    const painter = await this.ensure(key, () => {
      const engine = new Harmonograph();
      engine.generate(null, `${ctx.seed}:harmonograph`, { climate });
      return { engine, destroy() {} };
    });
    painter.engine.render(this.canvas, {
      backgroundColor: VOID,
      progress: harmonographDrawProgress(
        ctx.elapsedMs,
        ctx.durationMs || galleryCadenceTimings(GALLERY_CADENCE_DEFAULT).dwellMs
      )
    });
  },

  async paintOstensoria(ctx) {
    const key = `ostensoria:${ctx.seed}`;
    const painter = await this.ensure(key, () => {
      const engine = new Ostensoria();
      engine.generate(null, `${ctx.seed}:ostensoria`);
      return { engine, destroy() {} };
    });
    painter.engine.render(this.canvas, {
      progress: galleryDrawProgress(
        ctx.elapsedMs,
        ctx.durationMs || galleryCadenceTimings(GALLERY_CADENCE_DEFAULT).dwellMs
      )
    });
  },

  async paintApparitio(ctx) {
    const key = `apparitio:${ctx.seed}`;
    const painter = await this.ensure(key, () => {
      const engine = new Apparitio();
      engine.generate(null, `${ctx.seed}:apparitio`);
      return { engine, destroy() {} };
    });
    painter.engine.render(this.canvas, {
      progress: galleryDrawProgress(
        ctx.elapsedMs,
        ctx.durationMs || galleryCadenceTimings(GALLERY_CADENCE_DEFAULT).dwellMs
      )
    });
  },

  async paintRockGarden(ctx) {
    const key = `rockgarden:${ctx.seed}`;
    const painter = await this.ensure(key, () => {
      const engine = new RockGarden();
      withSeededRandom(`${ctx.seed}:rockgarden`, () => {
        engine.generateRockGarden({ width: this.width, height: this.height });
      });
      return { engine, destroy() {} };
    });
    painter.engine.renderRockGarden(this.canvas, {
      backgroundColor: VOID,
      strokeColor: 'rgba(232, 232, 236, 0.8)',
      brushStroke: true
    });
  },

  async paintNeural(ctx) {
    const key = `neural:${ctx.seed}`;
    const painter = await this.ensure(key, () => {
      const engine = new NeuralNetwork(this.canvas);
      withSeededRandom(`${ctx.seed}:neural`, () => engine.generate());
      return { engine, destroy() {} };
    });
    painter.engine.canvas = this.canvas;
    painter.engine.ctx = this.canvas.getContext('2d');
    withSeededRandom(`${ctx.seed}:neural:draw`, () => painter.engine._render());
  },

  async paintFractal(ctx) {
    const key = `fractal:${ctx.seed}`;
    const painter = await this.ensure(key, async () => {
      const generator = new FractalFlameGenerator();
      generator.useWorkers = false;
      generator.backgroundColor = [10, 10, 12];
      withSeededRandom(`${ctx.seed}:fractal`, () => {
        generator.palette = generator.generateDefaultPalette();
        generator.generateRandomFlame();
      });
      const imageData = await generator.generateImage({
        iterations: 400_000,
        width: this.width,
        height: this.height,
        gamma: 2.2,
        brightness: 15,
        vibrancy: 1.2,
        oversample: 1,
        useWorkers: false
      });
      return {
        imageData,
        destroy() { generator.dispose?.(); }
      };
    });
    this.canvas.getContext('2d').putImageData(painter.imageData, 0, 0);
  },

  async paintWorkEngine(ctx, familyFromShuffle = null) {
    const family = familyFromShuffle
      || (ctx.cue?.collections || []).find(id => isWorkEngineFamily(id));
    if (!family) {
      clearVoid(this.canvas);
      return;
    }
    const engineId = ctx.cue?.engines?.[0] || '';
    const key = `work:${family}:${engineId}:${ctx.seed}`;
    const painter = await this.ensure(key, async () => {
      const engines = await loadWorkEngines(family);
      const entry = (engineId && engines.find(item => item.id === engineId))
        || pick(`${ctx.seed}:${family}:engine`, engines);
      if (!entry) return { engine: null, elapsed: 0, destroy() {} };
      const engine = new entry.engineClass();
      engine.generate?.({}, `${ctx.seed}:${family}:${entry.id}`);
      return { engine, elapsed: 0, destroy() {} };
    });
    if (!painter.engine) {
      clearVoid(this.canvas);
      return;
    }
    const seconds = (ctx.elapsedMs / 1000) * TIME_SCALE;
    const dt = Math.max(0, seconds - painter.elapsed);
    const step = 1 / 24;
    for (let t = 0; t < dt; t += step) {
      painter.engine.step?.(Math.min(step, dt - t), {});
    }
    painter.elapsed = seconds;
    painter.engine.render(this.canvas, { width: this.width, height: this.height });
  },

  async paintAttractor(ctx) {
    const config = ctx.cue?.config || {};
    const key = `attractor:${config.system}:${config.palette}:${config.form}:${ctx.seed}`;
    const painter = await this.ensure(key, () => {
      this.canvas.style.display = 'none';
      const field = new AttractorField(this.host, {
        system: config.system,
        palette: config.palette,
        form: config.form,
        adaptive: false
      });
      field.pause();
      return {
        field,
        destroy() { field.destroy(); }
      };
    });
    painter.field.pause();
    painter.field.tick(painter.field.t0 + ctx.elapsedMs);
    painter.field.pause();
  },

  async paintFocal(ctx) {
    const config = ctx.cue?.config || ctx.cue?.focal || {};
    const personalId = config.personalAssetId || ctx.stillId;
    if (config.type === 'personal' || config.personalAssetId) {
      const key = `personal:${personalId || 'void'}`;
      const painter = await this.ensure(key, () => {
        this.canvas.style.display = 'none';
        const frame = document.createElement('div');
        frame.className = 'focal-personal';
        const pic = document.createElement('canvas');
        pic.className = 'focal-image';
        frame.appendChild(pic);
        this.host.appendChild(frame);
        return { pic, destroy() { frame.remove(); } };
      });
      const still = (personalId && this.stills.get(personalId)) || null;
      if (!still) return;
      const source = new ImageData(
        new Uint8ClampedArray(still.rgba),
        still.width,
        still.height
      );
      painter.pic.width = still.width;
      painter.pic.height = still.height;
      painter.pic.getContext('2d').putImageData(source, 0, 0);
      return;
    }
    const glyphId = config.standardGlyph || config.glyph || 'breath';
    if (config.type === 'rose' || glyphId === 'rose' || config.standardGlyph === 'rose') {
      const key = `rose:${config.petala}:${config.roseMode}:${ctx.seed}`;
      const painter = await this.ensure(key, () => {
        this.canvas.style.display = 'none';
        const host = document.createElement('div');
        host.className = 'focal-rose';
        this.host.appendChild(host);
        const rose = new RosaMystica(host, {
          petala: config.petala,
          seed: Number.isInteger(config.seed) ? config.seed : hashSeed(`${ctx.seed}:rose`),
          mode: config.roseMode === 'verbum' ? 'verbum' : 'vitrum'
        });
        rose._raf && cancelAnimationFrame(rose._raf);
        rose._raf = null;
        return {
          rose,
          destroy() { rose.destroy(); host.remove(); }
        };
      });
      painter.rose.renderOnce(ctx.elapsedMs / 1000);
      return;
    }
    const key = `glyph:${glyphId}`;
    await this.ensure(key, () => {
      this.canvas.style.display = 'none';
      const glyph = focalGlyph(glyphId);
      const node = document.createElement('div');
      node.className = `focal-glyph${glyph.dynamic ? ' focal-dynamic' : ''}`;
      const icon = document.createElement('span');
      icon.className = 'focal-icon';
      icon.textContent = glyph.icon;
      node.appendChild(icon);
      this.host.appendChild(node);
      return {
        icon,
        dynamic: glyph.dynamic,
        destroy() { node.remove(); }
      };
    });
    if (this.painter?.dynamic && this.painter.icon) {
      const wave = 0.5 + 0.5 * Math.sin((ctx.elapsedMs / 6000) * Math.PI * 2);
      this.painter.icon.style.opacity = String(0.4 + 0.3 * wave);
      this.painter.icon.style.transform = `scale(${1 + 0.04 * wave})`;
      this.painter.icon.style.animation = 'none';
    }
  },

  async paintStill(ctx) {
    await this.ensure('still', () => ({ destroy() {} }));
    if (!this.canvas) return;
    this.canvas.style.display = 'block';
    const outgoing = ctx.stillId && this.stills.get(ctx.stillId);
    const incoming = ctx.incomingStillId && this.stills.get(ctx.incomingStillId);
    const dissolve = Number.isFinite(ctx.dissolve) ? ctx.dissolve : 1;
    try {
      if (incoming && outgoing && incoming !== outgoing && dissolve < 1) {
        clearVoid(this.canvas);
        await drawCover(this.canvas, outgoing, 1);
        await drawCover(this.canvas, incoming, dissolve);
        return;
      }
      const still = incoming && dissolve >= 1 ? incoming : outgoing || incoming;
      if (!still) {
        clearVoid(this.canvas);
        return;
      }
      if (dissolve >= 1 || incoming) {
        await coverImage(this.canvas, still);
        return;
      }
      clearVoid(this.canvas);
      await drawCover(this.canvas, still, dissolve);
    } catch {
      clearVoid(this.canvas);
    }
  }
};

window.__stage = stage;
stage.ready = true;
