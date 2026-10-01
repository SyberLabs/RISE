/** Match one reader-owned brightness direction; no extra instruction is interpreted. */
export function interpretVisualControl(text) {
  if (typeof text !== 'string') return null;
  const normalized = text.trim().toLowerCase().replace(/\s*[.!?]+$/u, '').trim().replace(/\s+/gu, ' ');
  const phrase = normalized.startsWith('please ') ? normalized.slice(7) : normalized;
  if (phrase === 'more vibrant') return 'more vibrant';
  return phrase === 'make it calmer' ? 'calmer' : null;
}
