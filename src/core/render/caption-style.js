/**
 * MP4 caption style — movie-style burn-in on the kernel paint path.
 *
 * rise.kernel-request.v1 may carry `caption`. Omitted keeps today's
 * Chamber-identical MP4 paint (glass allowed). When present, glass is
 * forced off and the spoken atom is drawn as a stroked caption.
 *
 * Defaults (CSS px at 1080-wide):
 *   fontFamily  "Helvetica Neue", Arial, sans-serif
 *   fontSize    42
 *   color       #FFFFFF
 *   edgeColor   #000000
 *   position    "bottom-center"
 */

export const CAPTION_REFERENCE_WIDTH = 1080;
export const DEFAULT_CAPTION_FONT_FAMILY = '"Helvetica Neue", Arial, sans-serif';
export const DEFAULT_CAPTION_FONT_SIZE = 42;
export const DEFAULT_CAPTION_COLOR = '#FFFFFF';
export const DEFAULT_CAPTION_EDGE_COLOR = '#000000';
export const DEFAULT_CAPTION_POSITION = 'bottom-center';

export const CAPTION_POSITION_PRESETS = Object.freeze({
  'bottom-center': Object.freeze({ x: 0.5, y: 0.9 }),
  'top-center': Object.freeze({ x: 0.5, y: 0.1 }),
  center: Object.freeze({ x: 0.5, y: 0.5 })
});

export function captionModeOn(caption) {
  return caption != null && typeof caption === 'object' && !Array.isArray(caption);
}

/** Caption mode never draws the glass-tile / atom-band pane. */
export function captionAllowsGlass(caption, visualGlass = false) {
  if (captionModeOn(caption)) return false;
  return Boolean(visualGlass);
}

export function captionAnchor(position) {
  if (position && typeof position === 'object' && !Array.isArray(position)) {
    const x = Number(position.x);
    const y = Number(position.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x: clamp01(x), y: clamp01(y) };
    }
  }
  const preset = CAPTION_POSITION_PRESETS[position]
    || CAPTION_POSITION_PRESETS[DEFAULT_CAPTION_POSITION];
  return { x: preset.x, y: preset.y };
}

/** Scale a 1080-wide CSS px size onto the current frame or CSS viewport. */
export function captionCssFontSize(fontSize, frameWidth) {
  const size = Number(fontSize);
  const width = Number(frameWidth);
  const base = Number.isFinite(size) && size > 0 ? size : DEFAULT_CAPTION_FONT_SIZE;
  if (!Number.isFinite(width) || width <= 0) return base;
  return base * (width / CAPTION_REFERENCE_WIDTH);
}

export function resolveCaptionStyle(caption) {
  if (!captionModeOn(caption)) return null;
  const fontSize = Number(caption.fontSize);
  return Object.freeze({
    fontFamily: typeof caption.fontFamily === 'string' && caption.fontFamily.trim()
      ? caption.fontFamily.trim()
      : DEFAULT_CAPTION_FONT_FAMILY,
    fontSize: Number.isFinite(fontSize) && fontSize > 0 ? fontSize : DEFAULT_CAPTION_FONT_SIZE,
    color: normalizeColor(caption.color, DEFAULT_CAPTION_COLOR),
    edgeColor: normalizeColor(caption.edgeColor, DEFAULT_CAPTION_EDGE_COLOR),
    position: resolvePosition(caption.position)
  });
}

export function parseCssColor(value, fallback = DEFAULT_CAPTION_COLOR) {
  return parseColorChannels(value)
    || parseColorChannels(fallback)
    || { r: 255, g: 255, b: 255, a: 255 };
}

export function captionTextRegion(width, height, caption) {
  const style = resolveCaptionStyle(caption) || caption;
  const { x, y } = captionAnchor(style?.position);
  const inset = Math.max(24, Math.round(width * 0.08));
  const regionWidth = Math.max(1, width - inset * 2);
  const regionHeight = Math.max(1, Math.round(height * 0.12));
  return {
    x: inset,
    y: Math.max(0, Math.min(height - regionHeight, Math.round(y * height - regionHeight / 2))),
    width: regionWidth,
    height: regionHeight
  };
}

function resolvePosition(position) {
  if (typeof position === 'string' && CAPTION_POSITION_PRESETS[position]) {
    return position;
  }
  if (position && typeof position === 'object' && !Array.isArray(position)) {
    const x = Number(position.x);
    const y = Number(position.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return Object.freeze({ x: clamp01(x), y: clamp01(y) });
    }
  }
  return DEFAULT_CAPTION_POSITION;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function normalizeColor(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return parseColorChannels(value) ? value.trim() : fallback;
}

function parseColorChannels(value) {
  if (typeof value !== 'string') return null;
  const hex = value.trim();
  const short = /^#([0-9a-fA-F]{3})$/.exec(hex);
  if (short) {
    const [r, g, b] = short[1].split('').map(ch => parseInt(ch + ch, 16));
    return { r, g, b, a: 255 };
  }
  const long = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!long) return null;
  return {
    r: parseInt(long[1].slice(0, 2), 16),
    g: parseInt(long[1].slice(2, 4), 16),
    b: parseInt(long[1].slice(4, 6), 16),
    a: 255
  };
}
