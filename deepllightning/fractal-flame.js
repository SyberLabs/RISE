/**
 * Fractal Flame Generator
 * Implementation of the fractal flame algorithm (Scott Draves, 1992)
 * Creates organic, flame-like fractal images using iterated function systems
 * with non-linear variations, log-density display, and structural coloring.
 */

class FractalFlameGenerator {
  constructor() {
    this.transforms = [];
    this.finalTransform = null;

    // Camera parameters (world space to screen space)
    this.camera = {
      centerX: 0,
      centerY: 0,
      zoom: 1,
      rotation: 0
    };

    // Color palette (256 RGB colors)
    this.palette = this.generateDefaultPalette();

    // Rendering parameters
    this.backgroundColor = [0, 0, 0]; // RGB

    // Performance optimization
    this.epsilon = 1e-10; // Prevent division by zero
  }

  /**
   * Add a transform (IFS function) to the flame
   * @param {Object} transform - Transform specification
   */
  addTransform(transform) {
    // Validate and set defaults
    const t = {
      // Affine coefficients: [a, b, c, d, e, f]
      // Transformation: x' = a*x + b*y + c, y' = d*x + e*y + f
      affine: transform.affine || [1, 0, 0, 0, 1, 0],

      // Variation weights: { variationName: weight }
      variations: transform.variations || { linear: 1.0 },

      // Color index (0-1) for structural coloring
      color: transform.color !== undefined ? transform.color : Math.random(),

      // Selection probability (will be normalized)
      weight: transform.weight || 1.0,

      // Optional post-transform affine
      postAffine: transform.postAffine || null,

      // Variation parameters (for parametric variations)
      params: transform.params || {}
    };

    this.transforms.push(t);
    this._normalizeWeights();
  }

  /**
   * Set the final transform (applied after all other transforms)
   */
  setFinalTransform(transform) {
    this.finalTransform = {
      affine: transform.affine || [1, 0, 0, 0, 1, 0],
      variations: transform.variations || { linear: 1.0 },
      params: transform.params || {}
    };
  }

  /**
   * Set camera parameters
   */
  setCamera(centerX, centerY, zoom, rotation = 0) {
    this.camera = { centerX, centerY, zoom, rotation };
  }

  /**
   * Set color palette from array of RGB arrays
   */
  setPalette(palette) {
    if (palette.length === 256) {
      this.palette = palette;
    }
  }

  /**
   * Generate a fractal flame image
   * @param {Object} options - Rendering options
   */
  async generateImage(options = {}) {
    const {
      iterations = 10000000, // 10 million for good quality
      width = 1024,
      height = 1024,
      gamma = 4.0,
      brightness = 4.0,
      vibrancy = 1.0,
      oversample = 2, // Anti-aliasing
      skipIterations = 20 // Initial iterations to skip
    } = options;

    if (this.transforms.length === 0) {
      throw new Error('No transforms defined');
    }

    // Render at higher resolution for oversampling
    const renderWidth = width * oversample;
    const renderHeight = height * oversample;

    // Initialize histograms using typed arrays for performance
    const histogramSize = renderWidth * renderHeight;
    const density = new Float64Array(histogramSize);
    const colorR = new Float64Array(histogramSize);
    const colorG = new Float64Array(histogramSize);
    const colorB = new Float64Array(histogramSize);

    // Iteration phase (chaos game)
    await this._iterateFlame(
      density, colorR, colorG, colorB,
      renderWidth, renderHeight,
      iterations, skipIterations
    );

    // Rendering phase (tone mapping)
    const imageData = this._renderFlame(
      density, colorR, colorG, colorB,
      renderWidth, renderHeight,
      width, height,
      gamma, brightness, vibrancy, oversample
    );

    return imageData;
  }

  /**
   * Iteration phase: Generate points using the chaos game
   * @private
   */
  async _iterateFlame(density, colorR, colorG, colorB, width, height, iterations, skipIterations) {
    // Start with random point
    let x = Math.random() * 4 - 2;
    let y = Math.random() * 4 - 2;
    let color = Math.random();

    // Precompute cumulative probabilities for transform selection
    const cumulativeProbs = [];
    let sum = 0;
    for (const t of this.transforms) {
      sum += t.weight;
      cumulativeProbs.push(sum);
    }

    for (let i = 0; i < iterations + skipIterations; i++) {
      // Select random transform based on weights
      const rand = Math.random() * sum;
      let transformIndex = 0;
      for (let j = 0; j < cumulativeProbs.length; j++) {
        if (rand < cumulativeProbs[j]) {
          transformIndex = j;
          break;
        }
      }

      const transform = this.transforms[transformIndex];

      // Apply transform
      const result = this._applyTransform(x, y, transform);
      x = result.x;
      y = result.y;

      // Apply final transform if defined
      if (this.finalTransform) {
        const finalResult = this._applyTransform(x, y, this.finalTransform);
        x = finalResult.x;
        y = finalResult.y;
      }

      // Update color (blend with transform color)
      color = (color + transform.color) / 2;

      // Skip initial iterations (let attractor converge)
      if (i < skipIterations) continue;

      // Project to screen coordinates
      const coords = this._worldToScreen(x, y, width, height);

      if (coords.px >= 0 && coords.px < width && coords.py >= 0 && coords.py < height) {
        const idx = coords.py * width + coords.px;

        // Accumulate density
        density[idx] += 1;

        // Accumulate color (get RGB from palette)
        const paletteColor = this._getPaletteColor(color);
        colorR[idx] += paletteColor[0];
        colorG[idx] += paletteColor[1];
        colorB[idx] += paletteColor[2];
      }

      // Yield control periodically for responsiveness
      if (i % 100000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  /**
   * Apply a transform to a point
   * @private
   */
  _applyTransform(x, y, transform) {
    // Step 1: Apply pre-affine transformation
    const [a, b, c, d, e, f] = transform.affine;
    const affineX = a * x + b * y + c;
    const affineY = d * x + e * y + f;

    // Step 2: Apply weighted sum of variations
    let resultX = 0;
    let resultY = 0;

    for (const [variationName, weight] of Object.entries(transform.variations)) {
      if (weight === 0) continue;

      const variation = this._getVariation(variationName);
      const varResult = variation(affineX, affineY, transform);

      resultX += weight * varResult.x;
      resultY += weight * varResult.y;
    }

    // Step 3: Apply post-affine if defined
    if (transform.postAffine) {
      const [pa, pb, pc, pd, pe, pf] = transform.postAffine;
      const postX = pa * resultX + pb * resultY + pc;
      const postY = pd * resultX + pe * resultY + pf;
      return { x: postX, y: postY };
    }

    return { x: resultX, y: resultY };
  }

  /**
   * Get variation function by name
   * @private
   */
  _getVariation(name) {
    return VARIATIONS[name] || VARIATIONS.linear;
  }

  /**
   * Convert world coordinates to screen coordinates
   * @private
   */
  _worldToScreen(x, y, width, height) {
    // Apply camera transformation
    const { centerX, centerY, zoom, rotation } = this.camera;

    // Translate to camera center
    let wx = x - centerX;
    let wy = y - centerY;

    // Apply rotation
    if (rotation !== 0) {
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const rx = wx * cos - wy * sin;
      const ry = wx * sin + wy * cos;
      wx = rx;
      wy = ry;
    }

    // Apply zoom and convert to screen space
    const sx = (wx * zoom + 1) * width / 2;
    const sy = (wy * zoom + 1) * height / 2;

    return {
      px: Math.floor(sx),
      py: Math.floor(sy)
    };
  }

  /**
   * Get color from palette based on color index (0-1)
   * @private
   */
  _getPaletteColor(colorIndex) {
    const index = Math.floor(colorIndex * 255) % 256;
    return this.palette[index];
  }

  /**
   * Rendering phase: Apply tone mapping and create image
   * @private
   */
  _renderFlame(density, colorR, colorG, colorB, renderWidth, renderHeight,
                finalWidth, finalHeight, gamma, brightness, vibrancy, oversample) {

    // Find max density for normalization
    let maxDensity = 0;
    for (let i = 0; i < density.length; i++) {
      if (density[i] > maxDensity) {
        maxDensity = density[i];
      }
    }

    const maxLogDensity = Math.log(maxDensity + 1);

    // Create output image
    const imageData = new ImageData(finalWidth, finalHeight);
    const pixels = imageData.data;

    // Downsample with simple box filter
    for (let y = 0; y < finalHeight; y++) {
      for (let x = 0; x < finalWidth; x++) {
        let totalDensity = 0;
        let totalR = 0, totalG = 0, totalB = 0;

        // Sample from oversample grid
        for (let oy = 0; oy < oversample; oy++) {
          for (let ox = 0; ox < oversample; ox++) {
            const rx = x * oversample + ox;
            const ry = y * oversample + oy;
            const idx = ry * renderWidth + rx;

            totalDensity += density[idx];
            totalR += colorR[idx];
            totalG += colorG[idx];
            totalB += colorB[idx];
          }
        }

        const sampleCount = oversample * oversample;
        totalDensity /= sampleCount;
        totalR /= sampleCount;
        totalG /= sampleCount;
        totalB /= sampleCount;

        // Apply log-density tone mapping
        const logDensity = Math.log(totalDensity + 1);
        const normalizedDensity = logDensity / maxLogDensity;

        // Apply gamma correction
        const alpha = Math.pow(normalizedDensity, 1 / gamma);

        // Calculate final color
        let r = 0, g = 0, b = 0;

        if (totalDensity > 0) {
          // Average color
          const avgR = totalR / totalDensity;
          const avgG = totalG / totalDensity;
          const avgB = totalB / totalDensity;

          // Apply brightness and vibrancy
          r = avgR * alpha * brightness * vibrancy;
          g = avgG * alpha * brightness * vibrancy;
          b = avgB * alpha * brightness * vibrancy;
        } else {
          // Background color
          r = this.backgroundColor[0];
          g = this.backgroundColor[1];
          b = this.backgroundColor[2];
        }

        // Clamp to valid range
        r = Math.min(255, Math.max(0, r));
        g = Math.min(255, Math.max(0, g));
        b = Math.min(255, Math.max(0, b));

        // Write to image data
        const pixelIdx = (y * finalWidth + x) * 4;
        pixels[pixelIdx] = r;
        pixels[pixelIdx + 1] = g;
        pixels[pixelIdx + 2] = b;
        pixels[pixelIdx + 3] = 255; // Alpha
      }
    }

    return imageData;
  }

  /**
   * Generate a default rainbow palette
   * @private
   */
  generateDefaultPalette() {
    const palette = [];
    for (let i = 0; i < 256; i++) {
      const hue = (i / 256) * 360;
      const rgb = this._hslToRgb(hue, 1.0, 0.5);
      palette.push(rgb);
    }
    return palette;
  }

  /**
   * Convert HSL to RGB
   * @private
   */
  _hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r, g, b;
    if (h < 60) {
      [r, g, b] = [c, x, 0];
    } else if (h < 120) {
      [r, g, b] = [x, c, 0];
    } else if (h < 180) {
      [r, g, b] = [0, c, x];
    } else if (h < 240) {
      [r, g, b] = [0, x, c];
    } else if (h < 300) {
      [r, g, b] = [x, 0, c];
    } else {
      [r, g, b] = [c, 0, x];
    }

    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255)
    ];
  }

  /**
   * Normalize transform weights to sum to 1
   * @private
   */
  _normalizeWeights() {
    const total = this.transforms.reduce((sum, t) => sum + t.weight, 0);
    if (total > 0) {
      for (const t of this.transforms) {
        t.weight /= total;
      }
    }
  }

  /**
   * Clear all transforms
   */
  clearTransforms() {
    this.transforms = [];
    this.finalTransform = null;
  }

  /**
   * Export flame parameters to JSON
   */
  exportJSON() {
    return JSON.stringify({
      transforms: this.transforms,
      finalTransform: this.finalTransform,
      camera: this.camera,
      palette: this.palette,
      backgroundColor: this.backgroundColor
    }, null, 2);
  }

  /**
   * Import flame parameters from JSON
   */
  importJSON(json) {
    const data = JSON.parse(json);
    this.transforms = data.transforms || [];
    this.finalTransform = data.finalTransform || null;
    this.camera = data.camera || { centerX: 0, centerY: 0, zoom: 1, rotation: 0 };
    this.palette = data.palette || this.generateDefaultPalette();
    this.backgroundColor = data.backgroundColor || [0, 0, 0];
  }

  /**
   * Generate a random flame
   */
  generateRandomFlame(numTransforms = null) {
    this.clearTransforms();

    // Random number of transforms (2-6)
    const count = numTransforms || Math.floor(Math.random() * 5) + 2;

    for (let i = 0; i < count; i++) {
      // Random affine coefficients
      const angle = Math.random() * Math.PI * 2;
      const scale = 0.3 + Math.random() * 0.7;
      const a = Math.cos(angle) * scale;
      const b = -Math.sin(angle) * scale;
      const d = Math.sin(angle) * scale;
      const e = Math.cos(angle) * scale;
      const c = (Math.random() - 0.5) * 2;
      const f = (Math.random() - 0.5) * 2;

      // Random variations
      const variationNames = Object.keys(VARIATIONS);
      const numVariations = Math.floor(Math.random() * 3) + 1;
      const variations = {};

      let totalWeight = 0;
      for (let j = 0; j < numVariations; j++) {
        const varName = variationNames[Math.floor(Math.random() * variationNames.length)];
        const weight = Math.random();
        variations[varName] = weight;
        totalWeight += weight;
      }

      // Normalize variation weights
      for (const key in variations) {
        variations[key] /= totalWeight;
      }

      this.addTransform({
        affine: [a, b, c, d, e, f],
        variations: variations,
        color: i / count,
        weight: 1.0
      });
    }
  }
}

/**
 * Variation Functions
 * Each variation is a function (x, y, transform) => {x, y}
 */
const VARIATIONS = {
  // V0: Linear (identity)
  linear: (x, y) => ({ x, y }),

  // V1: Sinusoidal
  sinusoidal: (x, y) => ({
    x: Math.sin(x),
    y: Math.sin(y)
  }),

  // V2: Spherical
  spherical: (x, y) => {
    const r2 = x * x + y * y + 1e-10;
    return {
      x: x / r2,
      y: y / r2
    };
  },

  // V3: Swirl
  swirl: (x, y) => {
    const r2 = x * x + y * y;
    const sinR2 = Math.sin(r2);
    const cosR2 = Math.cos(r2);
    return {
      x: x * sinR2 - y * cosR2,
      y: x * cosR2 + y * sinR2
    };
  },

  // V4: Horseshoe
  horseshoe: (x, y) => {
    const r = Math.sqrt(x * x + y * y) + 1e-10;
    return {
      x: (x - y) * (x + y) / r,
      y: 2 * x * y / r
    };
  },

  // V5: Polar
  polar: (x, y) => {
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    return {
      x: theta / Math.PI,
      y: r - 1
    };
  },

  // V6: Handkerchief
  handkerchief: (x, y) => {
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    return {
      x: r * Math.sin(theta + r),
      y: r * Math.cos(theta - r)
    };
  },

  // V7: Heart
  heart: (x, y) => {
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    const tr = theta * r;
    return {
      x: r * Math.sin(tr),
      y: -r * Math.cos(tr)
    };
  },

  // V8: Disc
  disc: (x, y) => {
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    const piR = Math.PI * r;
    const thetaOverPi = theta / Math.PI;
    return {
      x: thetaOverPi * Math.sin(piR),
      y: thetaOverPi * Math.cos(piR)
    };
  },

  // V9: Spiral
  spiral: (x, y) => {
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y) + 1e-10;
    return {
      x: (Math.cos(theta) + Math.sin(r)) / r,
      y: (Math.sin(theta) - Math.cos(r)) / r
    };
  },

  // V10: Hyperbolic
  hyperbolic: (x, y) => {
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y) + 1e-10;
    return {
      x: Math.sin(theta) / r,
      y: Math.cos(theta) * r
    };
  },

  // V11: Diamond
  diamond: (x, y) => {
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    return {
      x: Math.sin(theta) * Math.cos(r),
      y: Math.cos(theta) * Math.sin(r)
    };
  },

  // V12: Ex
  ex: (x, y) => {
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    const p0 = Math.sin(theta + r);
    const p1 = Math.cos(theta - r);
    const p0_3 = p0 * p0 * p0;
    const p1_3 = p1 * p1 * p1;
    return {
      x: r * (p0_3 + p1_3),
      y: r * (p0_3 - p1_3)
    };
  },

  // V13: Julia
  julia: (x, y) => {
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    const omega = Math.random() < 0.5 ? 0 : Math.PI;
    const sqrtR = Math.sqrt(r);
    const halfTheta = theta / 2 + omega;
    return {
      x: sqrtR * Math.cos(halfTheta),
      y: sqrtR * Math.sin(halfTheta)
    };
  },

  // V14: Bent
  bent: (x, y) => {
    if (x >= 0 && y >= 0) {
      return { x, y };
    } else if (x < 0 && y >= 0) {
      return { x: 2 * x, y };
    } else if (x >= 0 && y < 0) {
      return { x, y: y / 2 };
    } else {
      return { x: 2 * x, y: y / 2 };
    }
  },

  // V15: Waves (depends on affine coefficients)
  waves: (x, y, transform) => {
    const [a, b, c, d, e, f] = transform.affine;
    const b2 = b * b + 1e-10;
    const e2 = e * e + 1e-10;
    return {
      x: x + b * Math.sin(y / b2),
      y: y + e * Math.sin(x / e2)
    };
  },

  // V16: Fisheye
  fisheye: (x, y) => {
    const r = Math.sqrt(x * x + y * y);
    const factor = 2 / (r + 1);
    return {
      x: factor * y,
      y: factor * x
    };
  },

  // V17: Popcorn (depends on affine coefficients)
  popcorn: (x, y, transform) => {
    const [a, b, c, d, e, f] = transform.affine;
    return {
      x: x + c * Math.sin(Math.tan(3 * y)),
      y: y + f * Math.sin(Math.tan(3 * x))
    };
  },

  // V18: Exponential
  exponential: (x, y) => {
    const exp = Math.exp(x - 1);
    const piY = Math.PI * y;
    return {
      x: exp * Math.cos(piY),
      y: exp * Math.sin(piY)
    };
  },

  // V19: Power
  power: (x, y) => {
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    const sinTheta = Math.sin(theta);
    const pow = Math.pow(r, sinTheta);
    return {
      x: pow * Math.cos(theta),
      y: pow * Math.sin(theta)
    };
  },

  // V20: Cosine
  cosine: (x, y) => ({
    x: Math.cos(Math.PI * x) * Math.cosh(y),
    y: -Math.sin(Math.PI * x) * Math.sinh(y)
  }),

  // V21: Rings (parametric)
  rings: (x, y, transform) => {
    const c = transform.params.ringsC || 1.0;
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    const c2 = c * c + 1e-10;
    const mod = ((r + c2) % (2 * c2)) - c2 + r * (1 - c2);
    return {
      x: mod * Math.cos(theta),
      y: mod * Math.sin(theta)
    };
  },

  // V22: Fan (parametric)
  fan: (x, y, transform) => {
    const c = transform.params.fanC || 1.0;
    const f = transform.params.fanF || 1.0;
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    const t = Math.PI * c * c + 1e-10;
    const halfT = t / 2;

    if ((theta + f) % t > halfT) {
      return {
        x: r * Math.cos(theta - halfT),
        y: r * Math.sin(theta - halfT)
      };
    } else {
      return {
        x: r * Math.cos(theta + halfT),
        y: r * Math.sin(theta + halfT)
      };
    }
  },

  // V23: Blob (parametric)
  blob: (x, y, transform) => {
    const low = transform.params.blobLow || 0.5;
    const high = transform.params.blobHigh || 1.5;
    const waves = transform.params.blobWaves || 6;
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    const blob = r * (low + (high - low) / 2 * (Math.sin(waves * theta) + 1));
    return {
      x: blob * Math.cos(theta),
      y: blob * Math.sin(theta)
    };
  },

  // V24: PDJ (Peter de Jong, parametric)
  pdj: (x, y, transform) => {
    const a = transform.params.pdjA || 1.0;
    const b = transform.params.pdjB || 1.0;
    const c = transform.params.pdjC || 1.0;
    const d = transform.params.pdjD || 1.0;
    return {
      x: Math.sin(a * y) - Math.cos(b * x),
      y: Math.sin(c * x) - Math.cos(d * y)
    };
  },

  // V25: Eyefish
  eyefish: (x, y) => {
    const r = Math.sqrt(x * x + y * y);
    const factor = 2 / (r + 1);
    return {
      x: factor * x,
      y: factor * y
    };
  },

  // V26: Bubble
  bubble: (x, y) => {
    const r2 = x * x + y * y;
    const factor = 4 / (r2 + 4);
    return {
      x: factor * x,
      y: factor * y
    };
  },

  // V27: Cylinder
  cylinder: (x, y) => ({
    x: Math.sin(x),
    y: y
  }),

  // V28: Perspective (parametric)
  perspective: (x, y, transform) => {
    const angle = transform.params.perspectiveAngle || 1.0;
    const dist = transform.params.perspectiveDist || 2.0;
    const factor = dist / (dist - y * Math.sin(angle));
    return {
      x: factor * x,
      y: factor * y * Math.cos(angle)
    };
  },

  // V29: Noise
  noise: (x, y) => {
    const psi1 = Math.random();
    const psi2 = Math.random();
    return {
      x: psi1 * x * Math.cos(2 * Math.PI * psi2),
      y: psi1 * y * Math.sin(2 * Math.PI * psi2)
    };
  },

  // V30: Julian (parametric)
  julian: (x, y, transform) => {
    const power = transform.params.julianPower || 2;
    const dist = transform.params.julianDist || 1.0;
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    const p3 = Math.floor(Math.abs(power) * Math.random());
    const t = (theta + 2 * Math.PI * p3) / power;
    const pow = Math.pow(r, dist / power);
    return {
      x: pow * Math.cos(t),
      y: pow * Math.sin(t)
    };
  },

  // V31: JuliaN2 (parametric - simplified)
  juliascope: (x, y, transform) => {
    const power = transform.params.juliascopePower || 2;
    const dist = transform.params.juliascopeDist || 1.0;
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    const p3 = Math.floor(Math.abs(power) * Math.random());
    const sign = Math.random() < 0.5 ? 1 : -1;
    const t = (sign * theta + 2 * Math.PI * p3) / power;
    const pow = Math.pow(r, dist / power);
    return {
      x: pow * Math.cos(t),
      y: pow * Math.sin(t)
    };
  },

  // V32: Blur
  blur: () => {
    const psi1 = Math.random();
    const psi2 = Math.random();
    return {
      x: psi1 * Math.cos(2 * Math.PI * psi2),
      y: psi1 * Math.sin(2 * Math.PI * psi2)
    };
  },

  // V33: Gaussian
  gaussian: () => {
    let psi1 = 0, psi2 = 0, psi3 = 0, psi4 = 0;
    for (let i = 0; i < 4; i++) {
      psi1 += Math.random();
      psi2 += Math.random();
      psi3 += Math.random();
      psi4 += Math.random();
    }
    psi1 = psi1 / 4 - 2;
    psi2 = psi2 / 4 - 2;
    return {
      x: psi1 * Math.cos(2 * Math.PI * psi3),
      y: psi2 * Math.sin(2 * Math.PI * psi4)
    };
  },

  // V34: Radial Blur (parametric)
  radialBlur: (x, y, transform) => {
    const angle = transform.params.radialBlurAngle || 1.0;
    const r = Math.sqrt(x * x + y * y);
    const theta = Math.atan2(y, x);
    let psi1 = 0;
    for (let i = 0; i < 4; i++) psi1 += Math.random();
    psi1 = (psi1 - 2) * angle * Math.PI / 2;
    const sinA = Math.sin(psi1);
    const cosA = Math.cos(psi1);
    return {
      x: r * Math.cos(theta) * cosA - r * Math.sin(theta) * sinA,
      y: r * Math.cos(theta) * sinA + r * Math.sin(theta) * cosA
    };
  },

  // V35: Pie (parametric)
  pie: (x, y, transform) => {
    const slices = transform.params.pieSlices || 6;
    const rotation = transform.params.pieRotation || 0;
    const thickness = transform.params.pieThickness || 0.5;
    const psi1 = Math.floor(Math.random() * slices);
    const psi2 = Math.random();
    const psi3 = Math.random();
    const angle = rotation + 2 * Math.PI * (psi1 + psi2 * thickness) / slices;
    return {
      x: psi3 * Math.cos(angle),
      y: psi3 * Math.sin(angle)
    };
  }
};

// Export for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FractalFlameGenerator, VARIATIONS };
}
