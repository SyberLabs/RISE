/**
 * EVERY ENGINE TAKES THE THEME, IN A REAL BROWSER.
 *
 * The theme-to-engine map (src/core/theme-engine-map.js) was written from
 * hue arithmetic, never rendered. This renders one still per engine under
 * each of the nine themes through the harness scripts/build-engine-stills.mjs
 * uses, and reads the pixels back as numbers: is the still painted, do themes
 * the map sends to different cells give different pictures, and do the
 * engines that derive their colour from the reading's own colours land on
 * them. Only numbers cross from the page; pixel arrays stay in the browser.
 *
 * What this cannot catch: an engine whose unthemed pick is random (Turrell,
 * Neural, the plates) still gives nine different stills when the theme never
 * reaches it. The derived checks below are exact; the distinctness checks
 * catch an engine stuck on one picture.
 */
import { expect, test } from './fixtures.js';
import { JEV_PALETTES } from '../src/core/jev-palette.js';
import { themeEngine } from '../src/core/theme-engine-map.js';

// Ostensoria last: its still queues three more plates, which the next
// theme's look flushes; nothing then bakes under a stale look.
const ENGINES = ['klee', 'turrell', 'neural', 'rockgarden', 'harmonograph', 'apparitio', 'ostensoria'];
const THEMES = Object.keys(JEV_PALETTES);

// A pixel within this of the corner pixel, per channel, is ground: the
// stills script's own line.
const GROUND_TOLERANCE = 14;
// Painted: at least this share of the still is not ground.
const PAINTED_SHARE = 0.001;
// Distinct: the mean colours of two stills are farther apart than this,
// Euclidean in RGB 0..255.
const DISTINCT_RGB = 8;
// Derived: the dominant hue lies within this many degrees of the accent.
const HUE_TOLERANCE = 25;
// Rock Garden fills the theme ground exactly; the WebP a work carries is
// lossy by a few units per channel.
const WEBP_TOLERANCE = 6;

/**
 * What the map hands each engine for a theme. Two themes with the same cell
 * are meant to look alike, so distinctness is asserted only between themes
 * whose cells differ (the record's §8 S3): classic and citrine share dawn,
 * prism and rose ganzfeld (Turrell); classic, ember, rose and citrine share
 * organic, amethyst and prism consciousness (Neural); amethyst and jade
 * share holo, cobalt and rose marian, ember and citrine ember (Apparitio);
 * Klee Lines take the Genesis preset, five presets for nine themes. The
 * Harmonograph derives from the reading's own colours, nine distinct sets.
 * Rock Garden is null here: its strokes are nine near-white inks two pixels
 * wide, which a lossy still cannot tell apart by mean colour, so it is held
 * to its ground below instead.
 */
const CELL = {
  klee: theme => themeEngine(theme, 'genesis').preset,
  turrell: theme => themeEngine(theme, 'turrell'),
  neural: theme => themeEngine(theme, 'neural'),
  rockgarden: null,
  harmonograph: theme => theme,
  // Not Spectral (apparitio): every one of its ramps opens at white and the
  // tint lives in halos a mean colour cannot see (on CI each theme's mean sat
  // within 3 of grey 160). Its carriage is pinned by plate-field.test.js and
  // visual-cortex.test.js; here it is only asserted painted.
  ostensoria: theme => JSON.stringify(themeEngine(theme, 'ostensoria'))
};

const rgbOf = hex => [1, 3, 5].map(at => Number.parseInt(hex.slice(at, at + 2), 16));
const hueOf = hex => {
  const [r, g, b] = rgbOf(hex);
  const max = Math.max(r, g, b);
  const chroma = max - Math.min(r, g, b);
  const raw = max === r ? ((g - b) / chroma) % 6 : max === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
  return (raw * 60 + 360) % 360;
};
const hueGap = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const show = rgb => rgb.map(Math.round).join(',');

/**
 * One theme's identity on the cortex, then one still per engine, measured
 * in the page. Each still comes back as its pixel count, how many are not
 * ground, the corner (ground) colour, the mean colour of the non-ground
 * pixels, and their dominant hue: the saturation-weighted circular mean,
 * the same reading the map's own hue turn uses. Null when the engine
 * returned no work.
 */
const renderTheme = (page, theme) => page.evaluate(async ({ theme, flameColors, engines, groundTolerance }) => {
  const measure = async url => {
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const ground = [data[0], data[1], data[2]];
    let painted = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    let chromaWeight = 0;
    const chromaRgb = [0, 0, 0];
    let x = 0;
    let y = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.abs(data[i] - ground[0]) <= groundTolerance
        && Math.abs(data[i + 1] - ground[1]) <= groundTolerance
        && Math.abs(data[i + 2] - ground[2]) <= groundTolerance) continue;
      painted += 1;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      const max = Math.max(data[i], data[i + 1], data[i + 2]);
      const chroma = max - Math.min(data[i], data[i + 1], data[i + 2]);
      if (!chroma) continue;
      const raw = max === data[i] ? ((data[i + 1] - data[i + 2]) / chroma) % 6
        : max === data[i + 1] ? (data[i + 2] - data[i]) / chroma + 2
          : (data[i] - data[i + 1]) / chroma + 4;
      const hue = raw * Math.PI / 3;
      const sat = chroma / max;
      chromaWeight += chroma;
      for (let channel = 0; channel < 3; channel += 1) {
        chromaRgb[channel] += data[i + channel] * chroma;
      }
      x += sat * Math.cos(hue);
      y += sat * Math.sin(hue);
    }
    return {
      total: data.length / 4,
      painted,
      ground,
      mean: painted ? [r / painted, g / painted, b / painted] : null,
      // Weight the derived ink by chroma so its faint neutral glow cannot bury the theme.
      chromaMean: chromaWeight ? chromaRgb.map(channel => channel / chromaWeight) : null,
      hue: Math.hypot(x, y) < 1e-6 ? null : (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
    };
  };

  const cortex = await window.__RISE_TEST__.ensureVisualCortex();
  cortex.init();
  // Compare each theme on the same drawing; random geometry changes its mean ink.
  const generateHarmonograph = Object.getPrototypeOf(cortex.harmonograph).generate;
  cortex.harmonograph.generate = function (signal, seed, options) {
    return generateHarmonograph.call(this, signal, 'theme-engine-comparison', options);
  };
  cortex.beginSessionVisualIdentity({ colorTheme: theme, flameColors, activeTypes: engines });
  const out = {};
  for (const engine of engines) {
    const work = await cortex._renderContinuousProceduralWork(engine);
    out[engine] = work?.url ? await measure(work.url) : null;
  }
  return out;
}, { theme, flameColors: JEV_PALETTES[theme], engines: ENGINES, groundTolerance: GROUND_TOLERANCE });

test('every engine takes each of the nine themes', async ({ page }) => {
  // Nine identities, sixty-three stills; the two plate engines cost about
  // a second a still.
  test.setTimeout(120_000);
  await page.goto('/');
  await page.waitForFunction(() => !!window.__RISE_TEST__);

  /** stills[engine][theme] */
  const stills = Object.fromEntries(ENGINES.map(engine => [engine, {}]));
  for (const theme of THEMES) {
    const byEngine = await renderTheme(page, theme);
    for (const engine of ENGINES) stills[engine][theme] = byEngine[engine];
  }

  for (const engine of ENGINES) {
    for (const theme of THEMES) {
      const still = stills[engine][theme];
      expect.soft(still, `${engine} under ${theme} returned no work`).not.toBeNull();
      if (!still) continue;
      if (engine === 'harmonograph') {
        expect.soft(still.chromaMean, `harmonograph under ${theme} has no colored ink`).not.toBeNull();
        expect.soft(still.hue, `harmonograph under ${theme} has no measurable hue`).not.toBeNull();
      }
      expect.soft(still.painted / still.total, `${engine} under ${theme} is unpainted (${still.painted} of ${still.total} pixels off ground)`)
        .toBeGreaterThanOrEqual(PAINTED_SHARE);
    }
    if (!CELL[engine]) continue;
    for (let i = 0; i < THEMES.length; i += 1) {
      for (let j = i + 1; j < THEMES.length; j += 1) {
        const [a, b] = [THEMES[i], THEMES[j]];
        if (CELL[engine](a) === CELL[engine](b)) continue;
        const color = engine === 'harmonograph' ? 'chromaMean' : 'mean';
        const [meanA, meanB] = [stills[engine][a]?.[color], stills[engine][b]?.[color]];
        if (!meanA || !meanB) continue;
        expect.soft(distance(meanA, meanB), `${engine}: ${a} (${show(meanA)}) and ${b} (${show(meanB)}) look the same`)
          .toBeGreaterThan(DISTINCT_RGB);
      }
    }
  }

  // The derived engines. The Harmonograph's anchors are the accent and the
  // ink, so its strokes carry the accent's hue. Rock Garden's ground is the
  // theme ground, pixel for pixel; its strokes are the ink at 0.8 over that
  // ground, and the ground and the ink come from one rockGardenInk call,
  // so a themed ground is a themed stroke. The ink's hue is not asserted:
  // a near-white tint blended into a dark ground by anti-aliasing has the
  // blend's hue, not the ink's (classic is a warm ink over a cool ground).
  for (const theme of THEMES) {
    const harmonograph = stills.harmonograph[theme];
    if (harmonograph?.hue != null) {
      const accent = hueOf(JEV_PALETTES[theme].accent);
      expect.soft(hueGap(harmonograph.hue, accent), `harmonograph under ${theme}: hue ${harmonograph.hue.toFixed(0)}° against the accent's ${accent.toFixed(0)}°`)
        .toBeLessThanOrEqual(HUE_TOLERANCE);
    }
    const rockgarden = stills.rockgarden[theme];
    if (rockgarden) {
      const ground = rgbOf(JEV_PALETTES[theme].background);
      for (let channel = 0; channel < 3; channel += 1) {
        expect.soft(Math.abs(rockgarden.ground[channel] - ground[channel]), `rockgarden under ${theme}: ground ${show(rockgarden.ground)} is not the theme ground ${show(ground)}`)
          .toBeLessThanOrEqual(WEBP_TOLERANCE);
      }
    }
  }
});
