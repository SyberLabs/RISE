/**
 * The rocket, as geometry: low-poly, flat-shaded, built from a few prisms.
 *
 * Units are arbitrary but consistent: the ship is about 2.6 long (nose at -z,
 * engines at +z), so a camera looking down -z sees it from behind, flying into
 * the gate. Every face carries its own normal (flat shading is the low-poly
 * look) and a colour; the flame is built apart, because it is drawn additively
 * and its length changes.
 *
 * Pure: it returns arrays, and never touches WebGL, so a test can hold it.
 */

const HULL_TOP = [0.78, 0.87, 0.85];
const HULL_SIDE = [0.43, 0.58, 0.59];
const HULL_UNDER = [0.15, 0.27, 0.34];
const WING_TOP = [0.38, 0.5, 0.56];
const WING_UNDER = [0.17, 0.32, 0.4];
const NOSE = [0.96, 0.71, 0.53];
const NOSE_SHADE = [0.73, 0.4, 0.25];
const STEEL = [0.09, 0.15, 0.21];
const GLASS = [0.05, 0.2, 0.25];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = v => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

class Mesh {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.indices = [];
  }

  /** One flat triangle, its normal turned to face away from `inside`. */
  tri(a, b, c, color, inside) {
    let normal = unit(cross(sub(b, a), sub(c, a)));
    const centre = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    const flip = dot(normal, sub(centre, inside)) < 0;
    if (flip) { normal = normal.map(v => -v); [b, c] = [c, b]; }
    const base = this.positions.length / 3;
    for (const point of [a, b, c]) {
      this.positions.push(...point);
      this.normals.push(...normal);
      this.colors.push(...color);
    }
    this.indices.push(base, base + 1, base + 2);
  }

  quad(a, b, c, d, color, inside) {
    this.tri(a, b, c, color, inside);
    this.tri(a, c, d, color, inside);
  }

  /** A slab: `outline` (convex, in order) raised and lowered by half of `thick` in y. */
  slab(outline, thick, topColor, underColor, sideColor, inside) {
    const up = outline.map(p => [p[0], p[1] + thick / 2, p[2]]);
    const down = outline.map(p => [p[0], p[1] - thick / 2, p[2]]);
    for (let i = 1; i < outline.length - 1; i += 1) {
      this.tri(up[0], up[i], up[i + 1], topColor, inside);
      this.tri(down[0], down[i], down[i + 1], underColor, inside);
    }
    for (let i = 0; i < outline.length; i += 1) {
      const j = (i + 1) % outline.length;
      this.quad(up[i], up[j], down[j], down[i], sideColor, inside);
    }
  }
}

/** A hexagonal ring at depth z: flat underneath, so the ship sits like a craft, not a pencil. */
function ring(z, radius, lift = 0) {
  return Array.from({ length: 6 }, (_, k) => {
    const angle = (k * Math.PI) / 3;
    const y = Math.sin(angle);
    return [Math.cos(angle) * radius, (y < 0 ? y * 0.7 : y) * radius + lift, z];
  });
}

/** Colour of one of the six hull facets, from its angle: top light, sides mid, underside dark. */
const facetColor = k => (k === 1 || k === 2 ? HULL_TOP : k === 0 || k === 3 ? HULL_SIDE : HULL_UNDER);

export function buildShip() {
  const hull = new Mesh();
  const inside = [0, 0, 0.1];

  // Fuselage: tail, belly, shoulder, neck, tip.
  const rings = [ring(0.95, 0.26), ring(0.3, 0.32), ring(-0.4, 0.23), ring(-0.85, 0.1)];
  const tip = [0, 0.02, -1.35];
  for (let r = 0; r < rings.length - 1; r += 1) {
    for (let k = 0; k < 6; k += 1) {
      const n = (k + 1) % 6;
      // From the shoulder forward the hull turns to the warm nose colour.
      const color = r < 2 ? facetColor(k) : (k === 1 || k === 2 ? NOSE : NOSE_SHADE);
      hull.quad(rings[r][k], rings[r][n], rings[r + 1][n], rings[r + 1][k], color, inside);
    }
  }
  for (let k = 0; k < 6; k += 1) {
    hull.tri(rings[3][k], rings[3][(k + 1) % 6], tip, k === 1 || k === 2 ? NOSE : NOSE_SHADE, inside);
  }
  // The tail is closed by the engine block.
  for (let k = 1; k < 5; k += 1) hull.tri(rings[0][0], rings[0][k], rings[0][k + 1], STEEL, inside);

  // Wings: swept deltas, thin, a little lower than the spine.
  for (const s of [-1, 1]) {
    hull.slab([
      [s * 0.24, -0.03, -0.4], [s * 0.24, -0.03, 0.85], [s * 1.32, -0.17, 0.98], [s * 1.02, -0.15, 0.5]
    ], 0.06, WING_TOP, WING_UNDER, HULL_SIDE, [s * 0.5, -0.09, 0.5]);
    // A wingtip fin, canted out.
    hull.slab([
      [s * 1.32, -0.17, 0.98], [s * 1.26, -0.17, 0.66], [s * 1.35, -0.02, 0.98]
    ], 0.05, NOSE, NOSE_SHADE, NOSE_SHADE, [s * 1.3, -0.12, 0.85]);
  }

  // Canopy: a low glass wedge on the spine.
  const canopy = [[-0.13, 0.27, -0.3], [0.13, 0.27, -0.3], [0.16, 0.3, 0.25], [-0.16, 0.3, 0.25]];
  const apex = [0, 0.43, -0.02];
  for (let i = 0; i < 4; i += 1) hull.tri(canopy[i], canopy[(i + 1) % 4], apex, GLASS, [0, 0.2, -0.02]);

  // Engine block: a hexagonal collar behind the tail.
  const collar = [ring(0.95, 0.2), ring(1.14, 0.17)];
  for (let k = 0; k < 6; k += 1) {
    const n = (k + 1) % 6;
    hull.quad(collar[0][k], collar[0][n], collar[1][n], collar[1][k], STEEL, [0, 0, 1.02]);
  }
  for (let k = 1; k < 5; k += 1) hull.tri(collar[1][0], collar[1][k], collar[1][k + 1], [0.02, 0.04, 0.06], [0, 0, 1]);

  // The flame: a cone from the collar. Its base is hot, its tip fades; the shader
  // stretches everything past FLAME_BASE_Z to make it longer or shorter.
  const flame = new Mesh();
  const base = ring(FLAME_BASE_Z, 0.15);
  const flameTip = [0, 0, FLAME_BASE_Z + 1];
  for (let k = 0; k < 6; k += 1) {
    flame.tri(base[k], base[(k + 1) % 6], flameTip, [1, 0.86, 0.66], [0, 0, FLAME_BASE_Z + 0.4]);
  }

  return {
    hull: { positions: hull.positions, normals: hull.normals, colors: hull.colors, indices: hull.indices },
    flame: { positions: flame.positions, normals: flame.normals, colors: flame.colors, indices: flame.indices }
  };
}

/** Where the flame starts: the shader lengthens the mesh past here. */
export const FLAME_BASE_Z = 1.14;
