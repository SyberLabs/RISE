/**
 * Ink vs void on an Ostensoria density field.
 *
 * The plate is generated onto a square field, then cover-blitted. Empty
 * pixels here are the same emptiness the Chamber shows (now the void,
 * not cream paper). A plate is sparse when void covers at least
 * VOID_FRACTION_LIMIT of the field.
 */

export const VOID_FRACTION_LIMIT = 0.95;

export function measureFieldVoid(field, fMax = 0) {
  const n = field?.length || 0;
  if (!n) {
    return {
      pixels: 0,
      inked: 0,
      significant: 0,
      inkFraction: 0,
      significantFraction: 0,
      voidFraction: 1,
      sparse: true
    };
  }
  const sig = Math.max(1e-6, (Number(fMax) || 0) * 0.01);
  let inked = 0;
  let significant = 0;
  for (let i = 0; i < n; i++) {
    const d = field[i];
    if (d > 0) inked++;
    if (d >= sig) significant++;
  }
  const inkFraction = inked / n;
  const significantFraction = significant / n;
  const voidFraction = 1 - inkFraction;
  return {
    pixels: n,
    inked,
    significant,
    inkFraction,
    significantFraction,
    voidFraction,
    sparse: voidFraction >= VOID_FRACTION_LIMIT
  };
}
