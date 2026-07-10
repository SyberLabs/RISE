/**
 * Abstract Figure Engine
 * A procedural generator for minimalist abstract figures inspired by Japanese Zen rock gardens (karesansui)
 *
 * Features:
 * - 15+ shape variations (ellipses, blobs, irregular polygons, etc.)
 * - Procedural overlapping and merging
 * - Minimalist styling with grayscale palettes
 * - Wabi-sabi aesthetics (imperfection, asymmetry)
 * - Canvas-based rendering with no external dependencies
 */

class AbstractFigureEngine {
  constructor() {
    this.shapes = [];
    this.variations = {};
    this.core = null;
    this.palette = [];
    this.densityGrid = null;
    this.gridResolution = 50;

    // Distribution strategies for rock gardens
    this.distributions = {
      scatter: this._distributeScatter.bind(this),
      lateral: this._distributeLateral.bind(this),
      mountains: this._distributeMountains.bind(this)
    };

    // Initialize built-in shape variations
    this._initializeVariations();
  }

  /**
   * Simple 1D Perlin noise implementation for organic variation
   */
  _perlinNoise(x, seed = 0) {
    const p = Math.sin(x * 12.9898 + seed) * 43758.5453;
    return (p - Math.floor(p)) * 2 - 1;
  }

  /**
   * 2D Perlin-like noise for blob generation
   */
  _noise2D(x, y, seed = 0) {
    return (
      this._perlinNoise(x * 0.1 + y * 0.2, seed) * 0.5 +
      this._perlinNoise(x * 0.2 - y * 0.1, seed + 1) * 0.3 +
      this._perlinNoise(x * 0.05 + y * 0.05, seed + 2) * 0.2
    );
  }

  /**
   * Initialize all shape variation generators
   */
  _initializeVariations() {
    // V0: Ellipse - Basic elliptical rock form
    this.variations.ellipse = (c, s, params = {}) => {
      const points = [];
      const segments = params.segments || 32;
      const eccentricity = params.eccentricity || 0.5 + Math.random() * 0.5;
      const rotation = params.rotation || Math.random() * Math.PI * 2;

      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        const x = s * Math.cos(t);
        const y = s * Math.sin(t) * eccentricity;

        // Apply rotation
        const rx = x * Math.cos(rotation) - y * Math.sin(rotation);
        const ry = x * Math.sin(rotation) + y * Math.cos(rotation);

        points.push([c[0] + rx, c[1] + ry]);
      }
      return points;
    };

    // V1: Blob - Organic shape with noise-perturbed radius
    this.variations.blob = (c, s, params = {}) => {
      const points = [];
      const segments = params.segments || 32;
      const noiseFactor = params.noiseFactor || 0.3;
      const seed = params.seed || Math.random() * 1000;

      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        const noise = this._perlinNoise(t * 3, seed);
        const r = s * (1 + noise * noiseFactor);

        points.push([
          c[0] + r * Math.cos(t),
          c[1] + r * Math.sin(t)
        ]);
      }
      return points;
    };

    // V2: Irregular Polygon - Jagged rock-like polygon
    this.variations.irregularPoly = (c, s, params = {}) => {
      const points = [];
      const sides = params.sides || Math.floor(5 + Math.random() * 4);
      const jaggedness = params.jaggedness || 0.4;
      const seed = params.seed || Math.random() * 1000;

      for (let i = 0; i <= sides; i++) {
        const t = (i / sides) * Math.PI * 2;
        const noise = this._perlinNoise(i, seed);
        const r = s * (1 + noise * jaggedness);

        points.push([
          c[0] + r * Math.cos(t),
          c[1] + r * Math.sin(t)
        ]);
      }
      return points;
    };

    // V3: Teardrop - Elongated shape tapering at one end
    this.variations.teardrop = (c, s, params = {}) => {
      const points = [];
      const segments = params.segments || 32;
      const elongation = params.elongation || 1.5;
      const rotation = params.rotation || Math.random() * Math.PI * 2;

      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        const taper = 1 - 0.5 * Math.cos(t);
        const x = s * Math.cos(t) * taper;
        const y = s * Math.sin(t) * elongation * taper;

        // Apply rotation
        const rx = x * Math.cos(rotation) - y * Math.sin(rotation);
        const ry = x * Math.sin(rotation) + y * Math.cos(rotation);

        points.push([c[0] + rx, c[1] + ry]);
      }
      return points;
    };

    // V4: Crescent - Moon-like shape from overlapping arcs
    this.variations.crescent = (c, s, params = {}) => {
      const points = [];
      const segments = params.segments || 32;
      const thickness = params.thickness || 0.3;
      const curvature = params.curvature || 0.5;

      // Outer arc
      for (let i = 0; i <= segments / 2; i++) {
        const t = (i / (segments / 2)) * Math.PI;
        points.push([
          c[0] + s * Math.cos(t),
          c[1] + s * Math.sin(t)
        ]);
      }

      // Inner arc (offset)
      for (let i = segments / 2; i >= 0; i--) {
        const t = (i / (segments / 2)) * Math.PI;
        const offset = s * thickness;
        points.push([
          c[0] + (s - offset) * Math.cos(t) + curvature * s,
          c[1] + (s - offset) * Math.sin(t)
        ]);
      }

      return points;
    };

    // V5: Fractal Rock - Koch-curve-like textured edges
    this.variations.fractalRock = (c, s, params = {}) => {
      const basePoints = this.variations.irregularPoly(c, s, { sides: 6, jaggedness: 0.2 });
      const iterations = params.iterations || 1;
      const displacement = params.displacement || 0.15;

      let points = basePoints;
      for (let iter = 0; iter < iterations; iter++) {
        const newPoints = [];
        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];

          newPoints.push(p1);

          // Midpoint with displacement
          const mid = [
            (p1[0] + p2[0]) / 2 + (Math.random() - 0.5) * s * displacement,
            (p1[1] + p2[1]) / 2 + (Math.random() - 0.5) * s * displacement
          ];
          newPoints.push(mid);
        }
        newPoints.push(points[points.length - 1]);
        points = newPoints;
      }

      return points;
    };

    // V6: Asymmetrical Oval - Ellipse with one side flattened
    this.variations.asymmetricalOval = (c, s, params = {}) => {
      const points = [];
      const segments = params.segments || 32;
      const flatness = params.flatness || 0.5;
      const flatSide = params.flatSide || Math.random() * Math.PI * 2;

      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        const distFromFlat = Math.abs(((t - flatSide + Math.PI) % (Math.PI * 2)) - Math.PI);
        const modifier = 1 - flatness * Math.exp(-distFromFlat);

        points.push([
          c[0] + s * Math.cos(t) * modifier,
          c[1] + s * Math.sin(t) * 0.7
        ]);
      }
      return points;
    };

    // V7: Layered - Composite of overlapping sub-shapes
    this.variations.layered = (c, s, params = {}) => {
      const layers = params.layers || 3;
      const allPoints = [];

      for (let i = 0; i < layers; i++) {
        const offset = [(Math.random() - 0.5) * s * 0.4, (Math.random() - 0.5) * s * 0.4];
        const layerSize = s * (1 - i * 0.15);
        const layerPoints = this.variations.ellipse(
          [c[0] + offset[0], c[1] + offset[1]],
          layerSize,
          { eccentricity: 0.6 + Math.random() * 0.3 }
        );
        allPoints.push(...layerPoints);
      }

      // Return convex hull approximation
      return this._convexHull(allPoints);
    };

    // V8: Raked - Shape with internal raking lines
    this.variations.raked = (c, s, params = {}) => {
      const baseShape = this.variations.ellipse(c, s, params);
      baseShape.rakeLines = [];

      const rakeCount = params.rakeCount || 8;
      const rakeStyle = params.rakeStyle || 'concentric'; // 'concentric' or 'radial'

      if (rakeStyle === 'concentric') {
        for (let i = 0; i < rakeCount; i++) {
          const ratio = (i + 1) / (rakeCount + 1);
          const rakePoints = [];
          for (let j = 0; j <= 32; j++) {
            const t = (j / 32) * Math.PI * 2;
            rakePoints.push([
              c[0] + s * ratio * Math.cos(t),
              c[1] + s * ratio * Math.sin(t) * 0.6
            ]);
          }
          baseShape.rakeLines.push(rakePoints);
        }
      } else {
        for (let i = 0; i < rakeCount; i++) {
          const angle = (i / rakeCount) * Math.PI * 2;
          baseShape.rakeLines.push([
            c,
            [c[0] + s * Math.cos(angle), c[1] + s * Math.sin(angle)]
          ]);
        }
      }

      return baseShape;
    };

    // V9: Enso-like - Imperfect circle with brush variation
    this.variations.enso = (c, s, params = {}) => {
      const points = [];
      const segments = params.segments || 64;
      const imperfection = params.imperfection || 0.15;
      const gap = params.gap || 0.1; // Characteristic enso gap
      const seed = params.seed || Math.random() * 1000;

      const gapStart = Math.random() * Math.PI * 2;
      const gapSize = gap * Math.PI * 2;

      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2;

        // Skip gap
        if (t > gapStart && t < gapStart + gapSize) continue;

        const noise = this._perlinNoise(t * 2, seed);
        const r = s * (1 + noise * imperfection);
        const thickness = 1 + Math.sin(t * 3) * 0.1; // Brush-like variation

        points.push([
          c[0] + r * Math.cos(t) * thickness,
          c[1] + r * Math.sin(t) * thickness
        ]);
      }
      return points;
    };

    // V10: Stacked Boulders - Multiple overlapping circles
    this.variations.stackedBoulders = (c, s, params = {}) => {
      const boulders = params.boulders || 3;
      const allPoints = [];

      for (let i = 0; i < boulders; i++) {
        const offset = [
          (Math.random() - 0.5) * s * 0.6,
          i * s * 0.4 - s * 0.4
        ];
        const boulderSize = s * (0.5 + Math.random() * 0.4);
        const boulderPoints = this.variations.blob(
          [c[0] + offset[0], c[1] + offset[1]],
          boulderSize,
          { noiseFactor: 0.2 }
        );
        allPoints.push(...boulderPoints);
      }

      return this._convexHull(allPoints);
    };

    // V11: Wave Distorted - Shape distorted by wave function
    this.variations.waveDistorted = (c, s, params = {}) => {
      const points = [];
      const segments = params.segments || 32;
      const waveFreq = params.waveFreq || 3;
      const waveAmp = params.waveAmp || 0.2;

      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        const wave = Math.sin(t * waveFreq) * waveAmp;
        const r = s * (1 + wave);

        points.push([
          c[0] + r * Math.cos(t),
          c[1] + r * Math.sin(t) * 0.8
        ]);
      }
      return points;
    };

    // V12: Spiral Rock - Logarithmic spiral form
    this.variations.spiralRock = (c, s, params = {}) => {
      const points = [];
      const turns = params.turns || 2;
      const segments = params.segments || 64;
      const growth = params.growth || 0.2;

      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * turns * Math.PI * 2;
        const r = s * (0.3 + growth * t / (Math.PI * 2));

        points.push([
          c[0] + r * Math.cos(t),
          c[1] + r * Math.sin(t)
        ]);
      }

      // Close the shape by connecting back
      for (let i = segments; i >= 0; i--) {
        const t = (i / segments) * turns * Math.PI * 2;
        const r = s * (0.2 + growth * t / (Math.PI * 2));

        points.push([
          c[0] + r * Math.cos(t),
          c[1] + r * Math.sin(t)
        ]);
      }

      return points;
    };

    // V13: Triangular Cluster - Triangular arrangement of circles
    this.variations.triangularCluster = (c, s, params = {}) => {
      const allPoints = [];
      const positions = [
        [0, -s * 0.3],
        [-s * 0.3, s * 0.3],
        [s * 0.3, s * 0.3]
      ];

      for (const pos of positions) {
        const circlePoints = this.variations.blob(
          [c[0] + pos[0], c[1] + pos[1]],
          s * 0.4,
          { noiseFactor: 0.15 }
        );
        allPoints.push(...circlePoints);
      }

      return this._convexHull(allPoints);
    };

    // V14: Petal Form - Flower petal-like shape
    this.variations.petalForm = (c, s, params = {}) => {
      const points = [];
      const segments = params.segments || 32;
      const petals = params.petals || 5;

      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2;
        const petalMod = Math.abs(Math.sin(t * petals / 2)) * 0.5 + 0.5;
        const r = s * petalMod;

        points.push([
          c[0] + r * Math.cos(t),
          c[1] + r * Math.sin(t)
        ]);
      }
      return points;
    };

    // V15: Split Rock - Rock with a crack/split
    this.variations.splitRock = (c, s, params = {}) => {
      const basePoints = this.variations.irregularPoly(c, s, { sides: 6 });
      const splitAngle = params.splitAngle || Math.random() * Math.PI * 2;
      const splitWidth = params.splitWidth || 0.05;

      // Add a gap by offsetting points near the split angle
      const points = basePoints.map((p, i) => {
        const angle = Math.atan2(p[1] - c[1], p[0] - c[0]);
        const dist = Math.sqrt((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2);
        const angleDiff = Math.abs(((angle - splitAngle + Math.PI) % (Math.PI * 2)) - Math.PI);

        if (angleDiff < Math.PI / 4) {
          const offset = s * splitWidth * (1 - angleDiff / (Math.PI / 4));
          return [
            p[0] + Math.cos(angle + Math.PI / 2) * offset,
            p[1] + Math.sin(angle + Math.PI / 2) * offset
          ];
        }
        return p;
      });

      return points;
    };
  }

  /**
   * Convex hull using Graham scan (simplified for merging shapes)
   */
  _convexHull(points) {
    if (points.length < 3) return points;

    // Find the bottom-most point (or left-most if tie)
    let start = points.reduce((min, p) =>
      p[1] < min[1] || (p[1] === min[1] && p[0] < min[0]) ? p : min
    );

    // Sort points by polar angle with respect to start
    const sorted = points
      .filter(p => p !== start)
      .sort((a, b) => {
        const angleA = Math.atan2(a[1] - start[1], a[0] - start[0]);
        const angleB = Math.atan2(b[1] - start[1], b[0] - start[0]);
        return angleA - angleB;
      });

    const hull = [start, sorted[0], sorted[1]];

    for (let i = 2; i < sorted.length; i++) {
      let top = hull[hull.length - 1];
      let nextTop = hull[hull.length - 2];

      // Cross product to determine turn direction
      while (hull.length > 1) {
        const cross =
          (top[0] - nextTop[0]) * (sorted[i][1] - nextTop[1]) -
          (top[1] - nextTop[1]) * (sorted[i][0] - nextTop[0]);

        if (cross <= 0) {
          hull.pop();
          if (hull.length > 1) {
            top = hull[hull.length - 1];
            nextTop = hull[hull.length - 2];
          }
        } else {
          break;
        }
      }

      hull.push(sorted[i]);
    }

    return hull;
  }

  /**
   * Check if a point is inside a polygon
   */
  _pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];

      const intersect = ((yi > point[1]) !== (yj > point[1])) &&
        (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi);

      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Calculate bounding box of a shape
   */
  _getBounds(points) {
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
  }

  /**
   * Check if two shapes overlap
   */
  _shapesOverlap(shape1, shape2) {
    const bounds1 = this._getBounds(shape1.points);
    const bounds2 = this._getBounds(shape2.points);

    // Quick bounding box check
    if (bounds1.maxX < bounds2.minX || bounds2.maxX < bounds1.minX ||
      bounds1.maxY < bounds2.minY || bounds2.maxY < bounds1.minY) {
      return false;
    }

    // Check if any points of shape1 are inside shape2
    for (const point of shape1.points) {
      if (this._pointInPolygon(point, shape2.points)) {
        return true;
      }
    }

    // Check if any points of shape2 are inside shape1
    for (const point of shape2.points) {
      if (this._pointInPolygon(point, shape1.points)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Set the core configuration for the figure
   */
  setCore(config) {
    this.core = {
      anchor: config.anchor || [512, 512],
      variationWeights: config.variationWeights || { blob: 0.3, ellipse: 0.3, irregularPoly: 0.4 },
      overlapFactor: config.overlapFactor || 0.7,
      styleIndex: config.styleIndex || 0.5,
      asymmetryBias: config.asymmetryBias || [0.1, 0],
      symmetry: config.symmetry || 0
    };
  }

  /**
   * Add a custom shape variation
   */
  addVariation(name, generatorFn) {
    this.variations[name] = generatorFn;
  }

  /**
   * Select a variation based on weights
   */
  _selectVariation(weights) {
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    let rand = Math.random() * total;

    for (const [name, weight] of Object.entries(weights)) {
      rand -= weight;
      if (rand <= 0) return name;
    }

    return Object.keys(weights)[0];
  }

  /**
   * Generate minimalist grayscale palette
   */
  _generatePalette(count = 8, styleIndex = 0.5) {
    const palette = [];

    // Base grayscale with slight variation
    for (let i = 0; i < count; i++) {
      const value = Math.floor(30 + (i / count) * 200);

      // Add subtle warmth or coolness based on styleIndex
      const r = Math.floor(value + (styleIndex - 0.5) * 20);
      const g = Math.floor(value);
      const b = Math.floor(value - (styleIndex - 0.5) * 20);

      palette.push(`rgb(${Math.max(0, Math.min(255, r))}, ${Math.max(0, Math.min(255, g))}, ${Math.max(0, Math.min(255, b))})`);
    }

    return palette;
  }

  /**
   * Initialize density grid for tracking overlaps
   */
  _initDensityGrid(width, height) {
    const cols = Math.ceil(width / this.gridResolution);
    const rows = Math.ceil(height / this.gridResolution);
    this.densityGrid = new Array(rows).fill(0).map(() => new Array(cols).fill(0));
  }

  /**
   * Update density grid with shape
   */
  _updateDensityGrid(shape) {
    const bounds = this._getBounds(shape.points);
    const startCol = Math.max(0, Math.floor(bounds.minX / this.gridResolution));
    const endCol = Math.min(this.densityGrid[0].length - 1, Math.ceil(bounds.maxX / this.gridResolution));
    const startRow = Math.max(0, Math.floor(bounds.minY / this.gridResolution));
    const endRow = Math.min(this.densityGrid.length - 1, Math.ceil(bounds.maxY / this.gridResolution));

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const point = [
          col * this.gridResolution + this.gridResolution / 2,
          row * this.gridResolution + this.gridResolution / 2
        ];

        if (this._pointInPolygon(point, shape.points)) {
          this.densityGrid[row][col]++;
        }
      }
    }
  }

  /**
   * Get density at a point
   */
  _getDensity(point) {
    const col = Math.floor(point[0] / this.gridResolution);
    const row = Math.floor(point[1] / this.gridResolution);

    if (row >= 0 && row < this.densityGrid.length &&
      col >= 0 && col < this.densityGrid[0].length) {
      return this.densityGrid[row][col];
    }
    return 0;
  }

  /**
   * Generate the abstract figure
   */
  generateFigure(config = {}) {
    const iterations = config.iterations || 20;
    const width = config.width || 1024;
    const height = config.height || 1024;
    const asymmetry = config.asymmetry || 0.5;

    // Initialize
    this.shapes = [];
    this._initDensityGrid(width, height);

    // Set default core if not set
    if (!this.core) {
      this.setCore({
        anchor: [width / 2, height / 2],
        asymmetryBias: [(Math.random() - 0.5) * asymmetry, (Math.random() - 0.5) * asymmetry]
      });
    }

    // Generate palette
    this.palette = this._generatePalette(8, this.core.styleIndex);

    // Create initial core shape
    const coreVariation = this._selectVariation(this.core.variationWeights);
    const coreSize = Math.min(width, height) * (0.15 + Math.random() * 0.1);
    const corePoints = this.variations[coreVariation](this.core.anchor, coreSize, { seed: Math.random() * 1000 });

    const coreShape = {
      points: corePoints,
      variation: coreVariation,
      size: coreSize,
      center: this.core.anchor,
      color: this.palette[Math.floor(this.palette.length / 2)],
      density: 1,
      rakeLines: corePoints.rakeLines || []
    };

    this.shapes.push(coreShape);
    this._updateDensityGrid(coreShape);

    // Iteratively add overlapping shapes
    for (let i = 0; i < iterations; i++) {
      // Select a random existing shape to overlap with
      const targetShape = this.shapes[Math.floor(Math.random() * this.shapes.length)];

      // Calculate new position with overlap bias
      const angle = Math.random() * Math.PI * 2;
      const distance = targetShape.size * (0.3 + Math.random() * 0.5) * this.core.overlapFactor;

      const newCenter = [
        targetShape.center[0] + Math.cos(angle) * distance + this.core.asymmetryBias[0] * width * 0.1,
        targetShape.center[1] + Math.sin(angle) * distance + this.core.asymmetryBias[1] * height * 0.1
      ];

      // Ensure within bounds
      newCenter[0] = Math.max(width * 0.1, Math.min(width * 0.9, newCenter[0]));
      newCenter[1] = Math.max(height * 0.1, Math.min(height * 0.9, newCenter[1]));

      // Select variation and generate shape
      const variation = this._selectVariation(this.core.variationWeights);
      const size = Math.min(width, height) * (0.08 + Math.random() * 0.12);

      // Add wabi-sabi perturbation
      const wobble = [(Math.random() - 0.5) * size * 0.2, (Math.random() - 0.5) * size * 0.2];
      const perturbedCenter = [newCenter[0] + wobble[0], newCenter[1] + wobble[1]];

      const points = this.variations[variation](perturbedCenter, size, {
        seed: Math.random() * 1000,
        rotation: Math.random() * Math.PI * 2
      });

      const newShape = {
        points: points,
        variation: variation,
        size: size,
        center: perturbedCenter,
        color: null, // Will be assigned based on density
        density: 0,
        rakeLines: points.rakeLines || []
      };

      this.shapes.push(newShape);
      this._updateDensityGrid(newShape);

      // Calculate density for color assignment
      newShape.density = this._getDensity(newShape.center);
    }

    // Assign colors based on density
    const maxDensity = Math.max(...this.shapes.map(s => s.density));
    this.shapes.forEach(shape => {
      const densityRatio = shape.density / maxDensity;
      const colorIndex = Math.floor(densityRatio * (this.palette.length - 1));
      shape.color = this.palette[colorIndex];
    });

    // Apply symmetry if specified
    if (this.core.symmetry > 0) {
      this._applySymmetry();
    }

    return this.shapes;
  }

  /**
   * Apply subtle symmetry to shapes
   */
  _applySymmetry() {
    const anchor = this.core.anchor;
    const originalShapes = [...this.shapes];

    // Mirror a subset of shapes
    const toMirror = originalShapes.slice(0, Math.floor(originalShapes.length * this.core.symmetry));

    toMirror.forEach(shape => {
      const mirroredPoints = shape.points.map(p => [
        2 * anchor[0] - p[0],
        p[1]
      ]);

      const mirroredShape = {
        points: mirroredPoints,
        variation: shape.variation,
        size: shape.size,
        center: [2 * anchor[0] - shape.center[0], shape.center[1]],
        color: shape.color,
        density: shape.density,
        rakeLines: shape.rakeLines.map(line =>
          line.map(p => [2 * anchor[0] - p[0], p[1]])
        )
      };

      this.shapes.push(mirroredShape);
    });
  }

  /**
   * Render the figure to a canvas
   */
  render(canvasElement, config = {}) {
    const ctx = canvasElement.getContext('2d');
    const width = canvasElement.width;
    const height = canvasElement.height;

    // Clear canvas with background
    const bgColor = config.backgroundColor || '#f5f5f0';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Optional background raking pattern
    if (config.backgroundRaking) {
      this._renderBackgroundRaking(ctx, width, height);
    }

    // Sort shapes by density (render lighter/further shapes first)
    const sortedShapes = [...this.shapes].sort((a, b) => a.density - b.density);

    // Render each shape
    sortedShapes.forEach(shape => {
      this._renderShape(ctx, shape, config);
    });

    // Optional post-processing
    if (config.softEdges) {
      this._applySoftEdges(ctx, width, height);
    }
  }

  /**
   * Render background raking pattern
   */
  _renderBackgroundRaking(ctx, width, height) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.03)';
    ctx.lineWidth = 1;

    const spacing = 15;
    const waveAmp = 10;
    const waveFreq = 0.02;

    for (let y = 0; y < height; y += spacing) {
      ctx.beginPath();
      for (let x = 0; x < width; x += 5) {
        const yOffset = Math.sin(x * waveFreq) * waveAmp;
        if (x === 0) {
          ctx.moveTo(x, y + yOffset);
        } else {
          ctx.lineTo(x, y + yOffset);
        }
      }
      ctx.stroke();
    }
  }

  /**
   * Render a single shape
   */
  _renderShape(ctx, shape, config) {
    const useGradient = config.useGradient !== false;
    const outlineWidth = config.outlineWidth || 2;
    const textureIntensity = config.textureIntensity || 0.1;

    // Create path
    ctx.beginPath();
    shape.points.forEach((point, i) => {
      if (i === 0) {
        ctx.moveTo(point[0], point[1]);
      } else {
        ctx.lineTo(point[0], point[1]);
      }
    });
    ctx.closePath();

    // Fill with gradient or solid color
    if (useGradient) {
      const bounds = this._getBounds(shape.points);
      const gradient = ctx.createRadialGradient(
        shape.center[0], shape.center[1], 0,
        shape.center[0], shape.center[1], shape.size
      );

      const baseColor = shape.color;
      gradient.addColorStop(0, this._lightenColor(baseColor, 1.2));
      gradient.addColorStop(1, this._lightenColor(baseColor, 0.8));

      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = shape.color;
    }

    ctx.fill();

    // Add subtle texture
    if (textureIntensity > 0) {
      this._addTexture(ctx, shape, textureIntensity);
    }

    // Stroke outline
    ctx.strokeStyle = this._lightenColor(shape.color, 0.7);
    ctx.lineWidth = outlineWidth;
    ctx.stroke();

    // Render rake lines if present
    if (shape.rakeLines && shape.rakeLines.length > 0) {
      ctx.strokeStyle = this._lightenColor(shape.color, 0.5);
      ctx.lineWidth = 1;

      shape.rakeLines.forEach(rakeLine => {
        ctx.beginPath();
        rakeLine.forEach((point, i) => {
          if (i === 0) {
            ctx.moveTo(point[0], point[1]);
          } else {
            ctx.lineTo(point[0], point[1]);
          }
        });
        ctx.stroke();
      });
    }
  }

  /**
   * Add procedural texture to shape
   */
  _addTexture(ctx, shape, intensity) {
    const bounds = this._getBounds(shape.points);

    ctx.save();
    ctx.globalAlpha = intensity;

    // Create noise texture
    for (let i = 0; i < 50; i++) {
      const x = bounds.minX + Math.random() * bounds.width;
      const y = bounds.minY + Math.random() * bounds.height;

      if (this._pointInPolygon([x, y], shape.points)) {
        const noise = this._noise2D(x, y, shape.center[0]);
        const brightness = Math.floor((noise + 1) * 127.5);

        ctx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, 0.1)`;
        ctx.fillRect(x, y, 2, 2);
      }
    }

    ctx.restore();
  }

  /**
   * Lighten or darken a color
   */
  _lightenColor(color, factor) {
    const match = color.match(/\d+/g);
    if (!match) return color;

    const [r, g, b] = match.map(v => Math.max(0, Math.min(255, Math.floor(parseInt(v) * factor))));
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Apply soft edges effect (simple blur approximation)
   */
  _applySoftEdges(ctx, width, height) {
    // This is a placeholder - real blur would require pixel manipulation
    // For now, we just add a subtle vignette
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, width * 0.3,
      width / 2, height / 2, width * 0.7
    );

    gradient.addColorStop(0, 'rgba(245, 245, 240, 0)');
    gradient.addColorStop(1, 'rgba(245, 245, 240, 0.3)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  /**
   * Export canvas as data URL
   */
  export(canvasElement, format = 'png') {
    return canvasElement.toDataURL(`image/${format}`);
  }

  /**
   * Save configuration as JSON
   */
  saveConfig() {
    return JSON.stringify({
      core: this.core,
      shapes: this.shapes.map(s => ({
        variation: s.variation,
        center: s.center,
        size: s.size,
        density: s.density
      }))
    }, null, 2);
  }

  /**
   * Load configuration from JSON
   */
  loadConfig(jsonString) {
    const config = JSON.parse(jsonString);
    this.core = config.core;
    // Shapes would need to be regenerated from the saved parameters
  }

  /**
   * Generate a random themed figure
   */
  generateThemed(theme, width = 1024, height = 1024) {
    const themes = {
      serene: {
        variationWeights: { ellipse: 0.5, blob: 0.3, asymmetricalOval: 0.2 },
        overlapFactor: 0.8,
        asymmetryBias: [0.05, 0],
        iterations: 15,
        asymmetry: 0.3
      },
      dynamic: {
        variationWeights: { irregularPoly: 0.3, fractalRock: 0.3, waveDistorted: 0.2, teardrop: 0.2 },
        overlapFactor: 0.5,
        asymmetryBias: [0.3, 0.2],
        iterations: 25,
        asymmetry: 0.8
      },
      contemplative: {
        variationWeights: { enso: 0.4, raked: 0.3, blob: 0.3 },
        overlapFactor: 0.7,
        asymmetryBias: [0, 0],
        iterations: 12,
        asymmetry: 0.2
      },
      organic: {
        variationWeights: { blob: 0.3, layered: 0.2, stackedBoulders: 0.2, petalForm: 0.3 },
        overlapFactor: 0.9,
        asymmetryBias: [0.15, -0.1],
        iterations: 20,
        asymmetry: 0.5
      },
      architectural: {
        variationWeights: { irregularPoly: 0.4, triangularCluster: 0.3, splitRock: 0.3 },
        overlapFactor: 0.6,
        asymmetryBias: [0.2, 0],
        iterations: 18,
        asymmetry: 0.6
      }
    };

    const themeConfig = themes[theme] || themes.serene;

    this.setCore({
      anchor: [width / 2, height / 2],
      variationWeights: themeConfig.variationWeights,
      overlapFactor: themeConfig.overlapFactor,
      asymmetryBias: themeConfig.asymmetryBias,
      styleIndex: 0.5 + (Math.random() - 0.5) * 0.3
    });

    return this.generateFigure({
      width,
      height,
      iterations: themeConfig.iterations,
      asymmetry: themeConfig.asymmetry
    });
  }

  /**
   * Distribution: Random scatter across canvas
   */
  _distributeScatter(count, width, height, margin = 0.1) {
    const positions = [];
    const marginX = width * margin;
    const marginY = height * margin;

    for (let i = 0; i < count; i++) {
      positions.push([
        marginX + Math.random() * (width - 2 * marginX),
        marginY + Math.random() * (height - 2 * marginY)
      ]);
    }
    return positions;
  }

  /**
   * Distribution: Lateral spread (wide horizontal arrangement)
   */
  _distributeLateral(count, width, height, margin = 0.1) {
    const positions = [];
    const marginX = width * margin;
    const marginY = height * margin;

    // Spread rocks horizontally with slight vertical variation
    const segmentWidth = (width - 2 * marginX) / count;

    for (let i = 0; i < count; i++) {
      // Horizontal position with jitter
      const x = marginX + segmentWidth * (i + 0.2 + Math.random() * 0.6);
      // Vertical position clustered around middle with variance
      const y = height * 0.4 + Math.random() * height * 0.3;

      positions.push([x, y]);
    }
    return positions;
  }

  /**
   * Distribution: Mountain-like (wide lateral spread with mountain silhouette)
   */
  _distributeMountains(count, width, height, margin = 0.1) {
    const positions = [];
    const marginX = width * margin;
    const usableWidth = width - 2 * marginX;

    // Spread rocks evenly across width with some jitter
    const segmentWidth = usableWidth / count;

    for (let i = 0; i < count; i++) {
      // Even horizontal spread with jitter
      const x = marginX + segmentWidth * (i + 0.2 + Math.random() * 0.6);

      // Y position follows mountain silhouette
      const normalizedX = (x - marginX) / usableWidth; // 0 to 1
      const distFromCenter = Math.abs(normalizedX - 0.5) * 2; // 0 at center, 1 at edges

      // Mountain curve: higher (lower y) near center, slopes down at edges
      // This creates a horizon-line silhouette
      const peakY = height * 0.35; // Peak height
      const valleyY = height * 0.55; // Edge height  
      const curveY = peakY + distFromCenter * distFromCenter * (valleyY - peakY);
      const y = curveY + (Math.random() - 0.5) * height * 0.1;

      positions.push([x, y]);
    }
    return positions;
  }

  /**
   * Generate a minimal rock garden with distributed rocks
   */
  generateRockGarden(config = {}) {
    const width = config.width || 1024;
    const height = config.height || 1024;
    const rockCount = config.rockCount || (5 + Math.floor(Math.random() * 4)); // 5-8 rocks
    const distribution = config.distribution || 'mountains'; // scatter, lateral, mountains

    // Initialize
    this.shapes = [];
    this._initDensityGrid(width, height);

    // Rock shape preferences (simpler, more organic shapes)
    const rockVariations = {
      blob: 0.35,
      ellipse: 0.25,
      asymmetricalOval: 0.2,
      irregularPoly: 0.1,
      waveDistorted: 0.1
    };

    // Get distribution positions
    const positions = this.distributions[distribution](rockCount, width, height);

    // Generate rocks at distributed positions
    positions.forEach((pos, i) => {
      const variation = this._selectVariation(rockVariations);

      // Varied rock sizes - some larger, some smaller
      const sizeBase = Math.min(width, height) * 0.08;
      const sizeVariance = Math.min(width, height) * 0.12;
      const size = sizeBase + Math.random() * sizeVariance;

      // Slight position jitter for organic feel
      const jitterX = (Math.random() - 0.5) * size * 0.3;
      const jitterY = (Math.random() - 0.5) * size * 0.3;
      const center = [pos[0] + jitterX, pos[1] + jitterY];

      const points = this.variations[variation](center, size, {
        seed: Math.random() * 1000,
        rotation: Math.random() * Math.PI * 2,
        eccentricity: 0.4 + Math.random() * 0.4, // Wider, more horizontal ellipses
        noiseFactor: 0.15 + Math.random() * 0.15
      });

      const shape = {
        points: points,
        variation: variation,
        size: size,
        center: center,
        color: '#2c2c2c', // Will use stroke color
        density: i,
        rakeLines: []
      };

      this.shapes.push(shape);
    });

    return this.shapes;
  }

  /**
   * Render shape with brush-stroke style outline
   */
  _renderBrushStroke(ctx, shape, config = {}) {
    const baseWidth = config.strokeWidth || 2;
    const strokeColor = config.strokeColor || '#2c2c2c';
    const points = shape.points;

    if (points.length < 2) return;

    ctx.strokeStyle = strokeColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw segments with varying thickness for brush effect
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      // Vary line width along the stroke
      const progress = i / points.length;
      const thicknessVariation = Math.sin(progress * Math.PI) * 0.6 + 0.4; // Thicker in middle
      const noise = 0.8 + Math.random() * 0.4; // Random variation

      ctx.lineWidth = baseWidth * thicknessVariation * noise;

      ctx.beginPath();
      ctx.moveTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.stroke();
    }
  }

  /**
   * Render rock garden with outline-only style
   */
  renderRockGarden(canvasElement, config = {}) {
    const ctx = canvasElement.getContext('2d');
    const width = canvasElement.width;
    const height = canvasElement.height;

    // Clear with background
    const bgColor = config.backgroundColor || '#f5f5f0';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Optional subtle raking in background
    if (config.backgroundRaking) {
      this._renderBackgroundRaking(ctx, width, height);
    }

    // Render each rock as outline only
    this.shapes.forEach(shape => {
      if (config.brushStroke) {
        this._renderBrushStroke(ctx, shape, config);
      } else {
        // Simple outline
        ctx.beginPath();
        shape.points.forEach((point, i) => {
          if (i === 0) {
            ctx.moveTo(point[0], point[1]);
          } else {
            ctx.lineTo(point[0], point[1]);
          }
        });
        ctx.closePath();
        ctx.strokeStyle = config.strokeColor || '#2c2c2c';
        ctx.lineWidth = config.strokeWidth || 1.5;
        ctx.stroke();
      }
    });
  }
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AbstractFigureEngine;
}
