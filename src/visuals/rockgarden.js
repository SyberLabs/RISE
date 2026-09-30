/**
 * Abstract Figure Engine
 * A procedural generator for minimalist abstract figures inspired by Japanese Zen rock gardens (karesansui)
 *
 * Features:
 * - 5 shape variations (ellipse, blob, irregular polygon, asymmetrical oval, wave-distorted)
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
   * Initialize density grid for tracking overlaps
   */
  _initDensityGrid(width, height) {
    const cols = Math.ceil(width / this.gridResolution);
    const rows = Math.ceil(height / this.gridResolution);
    this.densityGrid = new Array(rows).fill(0).map(() => new Array(cols).fill(0));
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
    // Random 50/50 selection between lateral and mountains distribution
    const distribution = config.distribution || (Math.random() < 0.5 ? 'lateral' : 'mountains');

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

    const bgColor = config.backgroundColor || '#f5f5f0';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Optional subtle raking in background
    if (config.backgroundRaking) {
      this._renderBackgroundRaking(ctx, width, height);
    }

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

// ES Module export
export { AbstractFigureEngine as RockGarden };
