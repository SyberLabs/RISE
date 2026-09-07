/**
 * MP4 caption style — movie-style burn-in on the kernel paint path.
 *
 * rise.kernel-request.v1 may carry `caption`. Omitted keeps today's
 * Chamber-identical MP4 paint (glass follows the visual). When present,
 * the spoken atom is drawn as a caption and glass is off unless the
 * caption asks for it back with `glass: true`.
 * `edgeColor: "none"` skips the stroke.
 *
 * Defaults (CSS px at 1080-wide):
 *   fontFamily    "Helvetica Neue", Arial, sans-serif
 *   fontSize      42
 *   fontWeight    600
 *   lineHeight    1.28   (multiple of fontSize)
 *   letterSpacing 0      (em)
 *   maxWidth      0.9    (fraction of the frame)
 *   color         #FFFFFF
 *   edgeColor     #000000
 *   shadow        null   (true, or { blur, color, opacity })
 *   scrim         null   (true, or { height, color, opacity })
 *   glass         false
 *   position      "bottom-center"
 */

export const CAPTION_REFERENCE_WIDTH = 1080;
export const DEFAULT_CAPTION_FONT_FAMILY = '"Helvetica Neue", Arial, sans-serif';
export const DEFAULT_CAPTION_FONT_SIZE = 42;
export const DEFAULT_CAPTION_FONT_WEIGHT = 600;
export const DEFAULT_CAPTION_LINE_HEIGHT = 1.28;
export const DEFAULT_CAPTION_LETTER_SPACING = 0;
export const DEFAULT_CAPTION_MAX_WIDTH = 0.9;
export const DEFAULT_CAPTION_COLOR = '#FFFFFF';
export const DEFAULT_CAPTION_EDGE_COLOR = '#000000';
export const DEFAULT_CAPTION_POSITION = 'bottom-center';

/** Soft drop shadow when `shadow: true`. Blur is in 1080-wide CSS px. */
export const DEFAULT_CAPTION_SHADOW = Object.freeze({
  blur: 18,
  color: '#000000',
  opacity: 0.55
});

/**
 * A scrim is one shape: clear `height` above the caption anchor, full
 * `opacity` at the anchor, held to the bottom edge. A band that cleared
 * again below the text left bright imagery under the footer, which is
 * where a phone's own chrome already competes for the eye.
 */
export const DEFAULT_CAPTION_SCRIM = Object.freeze({
  height: 0.34,
  color: '#0A0A0C',
  opacity: 0.62
});

export const CAPTION_POSITION_PRESETS = Object.freeze({
  'bottom-center': Object.freeze({ x: 0.5, y: 0.9 }),
  'top-center': Object.freeze({ x: 0.5, y: 0.1 }),
  center: Object.freeze({ x: 0.5, y: 0.5 })
});

export function captionModeOn(caption) {
  return caption != null && typeof caption === 'object' && !Array.isArray(caption);
}

/**
 * Caption mode draws no glass pane unless the caption asks for one.
 * `glass: true` is how a take keeps the Chamber's own frosted tile
 * while still burning the words in at a chosen size and place.
 */
export function captionAllowsGlass(caption, visualGlass = false) {
  if (captionModeOn(caption)) return caption.glass === true;
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
  return Object.freeze({
    fontFamily: typeof caption.fontFamily === 'string' && caption.fontFamily.trim()
      ? caption.fontFamily.trim()
      : DEFAULT_CAPTION_FONT_FAMILY,
    fontSize: positive(caption.fontSize, DEFAULT_CAPTION_FONT_SIZE),
    fontWeight: positive(caption.fontWeight, DEFAULT_CAPTION_FONT_WEIGHT),
    lineHeight: positive(caption.lineHeight, DEFAULT_CAPTION_LINE_HEIGHT),
    letterSpacing: finite(caption.letterSpacing, DEFAULT_CAPTION_LETTER_SPACING),
    maxWidth: clamp01(positive(caption.maxWidth, DEFAULT_CAPTION_MAX_WIDTH)),
    color: normalizeColor(caption.color, DEFAULT_CAPTION_COLOR),
    edgeColor: resolveEdgeColor(caption.edgeColor),
    shadow: resolveShadow(caption.shadow),
    scrim: resolveScrim(caption.scrim),
    glass: caption.glass === true,
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
  const { y } = captionAnchor(style?.position);
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

function resolveShadow(value) {
  if (value === true) return DEFAULT_CAPTION_SHADOW;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.freeze({
    blur: positive(value.blur, DEFAULT_CAPTION_SHADOW.blur),
    color: normalizeColor(value.color, DEFAULT_CAPTION_SHADOW.color),
    opacity: clamp01(finite(value.opacity, DEFAULT_CAPTION_SHADOW.opacity))
  });
}

function resolveScrim(value) {
  if (value === true) return DEFAULT_CAPTION_SCRIM;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.freeze({
    height: clamp01(positive(value.height, DEFAULT_CAPTION_SCRIM.height)),
    color: normalizeColor(value.color, DEFAULT_CAPTION_SCRIM.color),
    opacity: clamp01(finite(value.opacity, DEFAULT_CAPTION_SCRIM.opacity))
  });
}

function resolveEdgeColor(value) {
  if (value === 'none' || value === false || value === null) return null;
  if (typeof value === 'string' && value.trim().toLowerCase() === 'none') return null;
  if (value === undefined || value === '') return DEFAULT_CAPTION_EDGE_COLOR;
  return normalizeColor(value, DEFAULT_CAPTION_EDGE_COLOR);
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

function positive(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function finite(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
