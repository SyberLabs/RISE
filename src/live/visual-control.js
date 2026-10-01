/** Match the one reader-owned visual phrase; no extra instruction is interpreted. */
export function interpretVisualControl(text) {
  if (typeof text !== 'string') return false;
  const normalized = text.trim().toLowerCase().replace(/\s*[.!?]+$/u, '').trim().replace(/\s+/gu, ' ');
  return normalized === 'more vibrant' || normalized === 'please more vibrant';
}
