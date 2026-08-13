/**
 * Profile layout: text, caption, title, and credit safe areas.
 * Profiles may change layout. They may not change source text or cues.
 */

export function safeAreasFor(viewport) {
  const width = viewport.width | 0;
  const height = viewport.height | 0;
  const inset = Math.max(24, Math.round(width * 0.08));
  const inner = Math.max(1, width - inset * 2);
  return Object.freeze({
    title: Object.freeze({
      x: inset, y: Math.round(height * 0.035), width: inner, height: Math.round(height * 0.05)
    }),
    text: Object.freeze({
      x: inset, y: Math.round(height * 0.60), width: inner, height: Math.round(height * 0.28)
    }),
    caption: Object.freeze({
      x: inset, y: Math.round(height * 0.90), width: inner, height: Math.round(height * 0.055)
    }),
    credit: Object.freeze({
      x: inset, y: Math.round(height * 0.96), width: inner, height: Math.round(height * 0.03)
    })
  });
}

export const RENDER_BACKGROUND = Object.freeze({ r: 10, g: 10, b: 12, a: 255 });
export const RENDER_TEXT_COLOR = Object.freeze({ r: 236, g: 232, b: 224, a: 255 });
export const RENDER_SAMPLE_RATE = 48_000;
export const RENDER_AUDIO_CHANNELS = 2;
