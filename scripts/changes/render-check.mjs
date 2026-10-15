/**
 * The rendered check (docs/plans/RISE-CHANGES.md, Quality gates): an admitted figure drawn by headless Chromium as the
 * room shows it, fitted whole into a phone 390 pixels wide and a desktop 1440 wide on the room's ground with the
 * words' ink for currentColor, and every label measured by the browser itself (getBoundingClientRect): two labels
 * drawn over each other, a label cut off at the figure's edge, and, at 390, a label under 12 pixels tall. It measures
 * what svg-layout.js estimates. Inline SVG measures as the <img> the room draws it in: one viewport, the same
 * default font, the image's own currentColor written on its root.
 *
 * The figure is model-written. It is drawn only after admission, in a context with JavaScript off, a policy that
 * loads nothing, and every request refused and recorded.
 */
import { MIN_PIXELS, ROOM } from '../../src/core/quality/svg-layout.js';

export const RENDER_ROOMS = Object.freeze([{ width: 390, height: 844 }, { width: 1440, height: 900 }]);
const MAX_PROBLEMS = 10;
/** A label's box is its glyph cells; the top and bottom tenth is the font's own leading, which may touch. */
const LEADING = 0.1;
const TOLERANCE_PX = 1;

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<style>html,body{margin:0;height:100%;background:${ROOM.ground}}#figure{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}#figure>svg{display:block}</style>
</head><body><div id="figure"></div></body></html>`;

/** Runs in the page: the figure fitted whole into the viewport (object-fit: contain), and every label's box. */
function measure({ svg, ink }) {
  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') return { error: 'the figure does not parse' };
  const root = document.importNode(parsed.documentElement, true);
  document.getElementById('figure').replaceChildren(root);
  const box = root.viewBox.baseVal;
  if (!box || !box.width || !box.height) return { error: 'the figure has no viewBox' };
  const scale = Math.min(innerWidth / box.width, innerHeight / box.height);
  root.setAttribute('width', String(box.width * scale));
  root.setAttribute('height', String(box.height * scale));
  if (!root.hasAttribute('color')) root.setAttribute('color', ink);
  root.pauseAnimations();
  root.setCurrentTime(0);
  const rect = element => { const r = element.getBoundingClientRect(); return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }; };
  const labels = [];
  for (const text of root.querySelectorAll('text')) {
    if (text.closest('defs, clipPath, mask, marker, pattern, symbol')) continue;
    const lines = [...text.querySelectorAll('tspan')].filter(tspan => tspan.hasAttribute('x') || tspan.hasAttribute('y'));
    for (const element of lines.length ? lines : [text]) {
      const words = element.textContent.replace(/\s+/gu, ' ').trim();
      const r = element.getBoundingClientRect();
      if (!words || !r.width || !r.height) continue;
      const m = element.getScreenCTM();
      labels.push({ words, box: rect(element), pixels: parseFloat(getComputedStyle(element).fontSize) * Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) });
    }
  }
  return { frame: rect(root), labels };
}

const label = words => {
  const flat = words.replace(/[\u0000-\u001f\u007f"]/gu, ' ').trim();
  return flat.length <= 40 ? flat : `${flat.slice(0, 39)}…`;
};
const inner = ({ x0, y0, x1, y1 }) => ({ x0, x1, y0: y0 + (y1 - y0) * LEADING, y1: y1 - (y1 - y0) * LEADING });
const drawnOver = (one, other) => Math.min(one.x1, other.x1) - Math.max(one.x0, other.x0) > TOLERANCE_PX
  && Math.min(one.y1, other.y1) - Math.max(one.y0, other.y0) > TOLERANCE_PX;

/** What one measured room shows wrong: `{ rule, key, message }`, `key` the same fault at another width. */
function problemsAt(width, { frame, labels }) {
  const at = `at ${width} pixels wide, the text`;
  const found = [];
  labels.forEach((item, index) => {
    for (const earlier of labels.slice(0, index)) {
      if (drawnOver(inner(item.box), inner(earlier.box))) {
        found.push({ rule: 'rendered-overlap', key: `overlap ${item.words} ${earlier.words}`, message: `${at} "${label(item.words)}" is drawn over the text "${label(earlier.words)}"; move one clear of the other, or use fewer words` });
      }
    }
    const sides = [item.box.x0 < frame.x0 - TOLERANCE_PX && 'left', item.box.x1 > frame.x1 + TOLERANCE_PX && 'right',
      item.box.y0 < frame.y0 - TOLERANCE_PX && 'top', item.box.y1 > frame.y1 + TOLERANCE_PX && 'bottom'].filter(Boolean);
    if (sides.length) {
      found.push({ rule: 'rendered-outside', key: `outside ${item.words}`, message: `${at} "${label(item.words)}" is cut off at the ${sides.join(' and ')} edge of the figure; move it inside, or use fewer words` });
    }
    if (width === RENDER_ROOMS[0].width && item.pixels < MIN_PIXELS) {
      found.push({ rule: 'rendered-too-small', key: `small ${item.words}`, message: `${at} "${label(item.words)}" is drawn ${Math.round(item.pixels * 10) / 10} pixels tall; make it at least ${MIN_PIXELS}` });
    }
  });
  return found;
}

/**
 * One browser for a run. `check(svg)` answers `{ problems: [{ rule, message }], ms }` for an admitted figure, each
 * fault once at the narrowest width it shows; `requests()` the addresses the page tried to reach (none, by design);
 * `close()` ends it.
 */
export async function openRenderCheck({ rooms = RENDER_ROOMS } = {}) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const requests = [];
    await context.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
    const page = await context.newPage();
    return {
      async check(svg) {
        const started = performance.now();
        const seen = new Map();
        for (const { width, height } of rooms) {
          await page.setViewportSize({ width, height });
          await page.setContent(PAGE);
          const measured = await page.evaluate(measure, { svg, ink: ROOM.ink });
          if (measured.error) return { problems: [{ rule: 'rendered-unreadable', message: measured.error }], ms: performance.now() - started };
          for (const problem of problemsAt(width, measured)) if (!seen.has(problem.key)) seen.set(problem.key, problem);
        }
        const problems = [...seen.values()].slice(0, MAX_PROBLEMS).map(({ rule, message }) => ({ rule, message }));
        return { problems, ms: performance.now() - started };
      },
      requests: () => [...requests],
      close: () => browser.close()
    };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
