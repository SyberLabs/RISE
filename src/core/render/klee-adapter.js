/**
 * Deterministic Klee adapter for offline render.
 *
 * Uses the same seeded RNG as the Chamber engine. It does not call
 * requestAnimationFrame, workers, or Math.random. Time is an explicit
 * argument so frame n is a pure function of seed, preset, and n.
 */

import { createSeededRandom } from '../../visuals/lib/klee-core.js';
import { RENDER_BACKGROUND } from './layout.js';

const PRESET_COUNTS = Object.freeze({
  architectural: 14,
  chaotic: 22,
  harmonic: 10,
  gravitational: 8,
  twittering: 18,
  random: 12
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function kleeStrokes({ seed, width, height, preset = 'harmonic', timeMs = 0 }) {
  const name = PRESET_COUNTS[preset] ? preset : 'harmonic';
  const random = createSeededRandom(`${seed}:klee:${name}`);
  const count = PRESET_COUNTS[name];
  const strokes = [];
  for (let i = 0; i < count; i += 1) {
    const points = [];
    let x = random() * width;
    let y = random() * height * 0.62;
    const steps = 6 + Math.floor(random() * 10);
    for (let step = 0; step < steps; step += 1) {
      x = clamp(x + (random() - 0.45) * width * 0.22, 0, width - 1);
      y = clamp(y + (random() - 0.5) * height * 0.12, 0, height * 0.7);
      points.push(Object.freeze([x, y]));
    }
    const gray = 180 + Math.floor(random() * 60);
    strokes.push(Object.freeze({
      points: Object.freeze(points),
      width: 1 + random() * 2.2,
      color: Object.freeze({ r: gray, g: gray - 8, b: gray - 16, a: 255 }),
      phase: random() * Math.PI * 2
    }));
  }
  return Object.freeze({
    background: RENDER_BACKGROUND,
    timeMs,
    strokes: Object.freeze(strokes)
  });
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function put(rgba, width, height, x, y, color, alpha) {
  const px = x | 0;
  const py = y | 0;
  if (px < 0 || py < 0 || px >= width || py >= height) return;
  const i = (py * width + px) * 4;
  const a = alpha * (color.a / 255);
  rgba[i] = mix(rgba[i], color.r, a);
  rgba[i + 1] = mix(rgba[i + 1], color.g, a);
  rgba[i + 2] = mix(rgba[i + 2], color.b, a);
  rgba[i + 3] = 255;
}

function drawLine(rgba, width, height, x0, y0, x1, y1, color, alpha, radius) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
  const r = Math.max(1, Math.round(radius));
  for (let s = 0; s <= steps; s += 1) {
    const x = x0 + (dx * s) / steps;
    const y = y0 + (dy * s) / steps;
    for (let oy = -r; oy <= r; oy += 1) {
      for (let ox = -r; ox <= r; ox += 1) {
        if (ox * ox + oy * oy > r * r) continue;
        put(rgba, width, height, x + ox, y + oy, color, alpha);
      }
    }
  }
}

export function rasterKlee(rgba, width, height, drawing, scaleX, scaleY) {
  const pulse = drawing.timeMs / 1000;
  for (const stroke of drawing.strokes) {
    const alpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(pulse + stroke.phase));
    const points = stroke.points;
    for (let i = 1; i < points.length; i += 1) {
      drawLine(
        rgba, width, height,
        points[i - 1][0] * scaleX, points[i - 1][1] * scaleY,
        points[i][0] * scaleX, points[i][1] * scaleY,
        stroke.color, alpha, stroke.width * Math.min(scaleX, scaleY)
      );
    }
  }
}
