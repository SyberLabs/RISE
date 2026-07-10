/**
 * Fractal Flame Generator V2
 * Enhanced with: Web Workers, Progressive Rendering, Symmetry Support, 20+ New Variations
 * Implementation of the fractal flame algorithm (Scott Draves, 1992)
 */

class FractalFlameGenerator {
  constructor() {
    this.transforms = [];
    this.finalTransform = null;

    // Camera parameters
    this.camera = {
      centerX: 0,
      centerY: 0,
      zoom: 1,
      rotation: 0
    };

    // Color palette (256 RGB colors)
    this.palette = this.generateDefaultPalette();

    // Rendering parameters
    this.backgroundColor = [0, 0, 0];

    // Performance optimization
    this.epsilon = 1e-10;

    // Web Workers support
    this.workers = [];
    this.useWorkers = this._detectWorkerSupport();
    this.maxWorkers = typeof navigator !== 'undefined' ?
      (navigator.hardwareConcurrency || 4) : 4;

    // Progressive rendering callbacks
    this.onProgressUpdate = null;
  }

  /**
   * Detect if Web Workers are available
   * @private
   */
  _detectWorkerSupport() {
    return typeof Worker !== 'undefined' && typeof window !== 'undefined';
  }

  /**
   * Add a transform (IFS function) to the flame
   */
  addTransform(transform) {
    const t = {
      affine: transform.affine || [1, 0, 0, 0, 1, 0],
      variations: transform.variations || { linear: 1.0 },
      color: transform.color !== undefined ? transform.color : Math.random(),
      weight: transform.weight || 1.0,
      postAffine: transform.postAffine || null,
      params: transform.params || {},
      symmetry: transform.symmetry || 0  // NEW: Symmetry support
    };

    this.transforms.push(t);
    this._normalizeWeights();
  }

  setFinalTransform(transform) {
    this.finalTransform = {
      affine: transform.affine || [1, 0, 0, 0, 1, 0],
      variations: transform.variations || { linear: 1.0 },
      params: transform.params || {},
      symmetry: transform.symmetry || 0
    };
  }

  setCamera(centerX, centerY, zoom, rotation = 0) {
    this.camera = { centerX, centerY, zoom, rotation };
  }

  setPalette(palette) {
    if (palette.length === 256) {
      this.palette = palette;
    }
  }

  /**
   * Generate fractal flame with progressive rendering
   * @param {Object} options - Rendering options
   * @returns {Promise<ImageData>} Final rendered image
   */
  async generateImage(options = {}) {
    const {
      iterations = 10000000,
      width = 1024,
      height = 1024,
      gamma = 4.0,
      brightness = 4.0,
      vibrancy = 1.0,
      oversample = 2,
      skipIterations = 20,
      progressive = false,  // NEW: Enable progressive rendering
      progressInterval = 1000000,  // Update every 1M iterations
      useWorkers = this.useWorkers  // NEW: Enable Web Workers
    } = options;

    if (this.transforms.length === 0) {
      throw new Error('No transforms defined');
    }

    const renderWidth = width * oversample;
    const renderHeight = height * oversample;

    if (progressive) {
      return this._generateImageProgressive(
        iterations, renderWidth, renderHeight,
        width, height, gamma, brightness, vibrancy,
        oversample, skipIterations, progressInterval, useWorkers
      );
    } else if (useWorkers) {
      return this._generateImageWithWorkers(
        iterations, renderWidth, renderHeight,
        width, height, gamma, brightness, vibrancy,
        oversample, skipIterations
      );
    } else {
      return this._generateImageSingleThreaded(
        iterations, renderWidth, renderHeight,
        width, height, gamma, brightness, vibrancy,
        oversample, skipIterations
      );
    }
  }

  /**
   * Progressive rendering - shows updates as it renders
   * @private
   */
  async _generateImageProgressive(iterations, renderWidth, renderHeight,
                                    finalWidth, finalHeight, gamma, brightness, vibrancy,
                                    oversample, skipIterations, progressInterval, useWorkers) {
    const histogramSize = renderWidth * renderHeight;
    const density = new Float64Array(histogramSize);
    const colorR = new Float64Array(histogramSize);
    const colorG = new Float64Array(histogramSize);
    const colorB = new Float64Array(histogramSize);

    const batches = Math.ceil(iterations / progressInterval);
    let totalIterationsCompleted = 0;

    for (let batch = 0; batch < batches; batch++) {
      const batchIterations = Math.min(progressInterval, iterations - totalIterationsCompleted);

      if (useWorkers) {
        await this._iterateFlameWithWorkers(
          density, colorR, colorG, colorB,
          renderWidth, renderHeight,
          batchIterations, skipIterations
        );
      } else {
        await this._iterateFlame(
          density, colorR, colorG, colorB,
          renderWidth, renderHeight,
          batchIterations, skipIterations
        );
      }

      totalIterationsCompleted += batchIterations;

      // Render intermediate result
      const intermediateImage = this._renderFlame(
        density, colorR, colorG, colorB,
        renderWidth, renderHeight,
        finalWidth, finalHeight,
        gamma, brightness, vibrancy, oversample
      );

      // Call progress callback
      if (this.onProgressUpdate) {
        this.onProgressUpdate({
          progress: totalIterationsCompleted / iterations,
          iterations: totalIterationsCompleted,
          totalIterations: iterations,
          imageData: intermediateImage
        });
      }

      // Yield control
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Return final image
    return this._renderFlame(
      density, colorR, colorG, colorB,
      renderWidth, renderHeight,
      finalWidth, finalHeight,
      gamma, brightness, vibrancy, oversample
    );
  }

  /**
   * Single-threaded rendering (original method)
   * @private
   */
  async _generateImageSingleThreaded(iterations, renderWidth, renderHeight,
                                      finalWidth, finalHeight, gamma, brightness, vibrancy,
                                      oversample, skipIterations) {
    const histogramSize = renderWidth * renderHeight;
    const density = new Float64Array(histogramSize);
    const colorR = new Float64Array(histogramSize);
    const colorG = new Float64Array(histogramSize);
    const colorB = new Float64Array(histogramSize);

    await this._iterateFlame(
      density, colorR, colorG, colorB,
      renderWidth, renderHeight,
      iterations, skipIterations
    );

    return this._renderFlame(
      density, colorR, colorG, colorB,
      renderWidth, renderHeight,
      finalWidth, finalHeight,
      gamma, brightness, vibrancy, oversample
    );
  }

  /**
   * Multi-threaded rendering using Web Workers
   * @private
   */
  async _generateImageWithWorkers(iterations, renderWidth, renderHeight,
                                    finalWidth, finalHeight, gamma, brightness, vibrancy,
                                    oversample, skipIterations) {
    const histogramSize = renderWidth * renderHeight;
    const density = new Float64Array(histogramSize);
    const colorR = new Float64Array(histogramSize);
    const colorG = new Float64Array(histogramSize);
    const colorB = new Float64Array(histogramSize);

    await this._iterateFlameWithWorkers(
      density, colorR, colorG, colorB,
      renderWidth, renderHeight,
      iterations, skipIterations
    );

    return this._renderFlame(
      density, colorR, colorG, colorB,
      renderWidth, renderHeight,
      finalWidth, finalHeight,
      gamma, brightness, vibrancy, oversample
    );
  }

  /**
   * Parallel iteration using Web Workers
   * @private
   */
  async _iterateFlameWithWorkers(density, colorR, colorG, colorB,
                                   width, height, iterations, skipIterations) {
    // Initialize workers if needed
    if (this.workers.length === 0) {
      await this._initializeWorkers();
    }

    const workerCount = Math.min(this.maxWorkers, this.workers.length);
    const iterationsPerWorker = Math.floor(iterations / workerCount);

    // Create serializable variation functions
    const variationCode = this._serializeVariations();

    // Dispatch work to workers
    const promises = [];
    for (let i = 0; i < workerCount; i++) {
      const workerIterations = i === workerCount - 1 ?
        iterations - (iterationsPerWorker * (workerCount - 1)) :
        iterationsPerWorker;

      const promise = new Promise((resolve, reject) => {
        const worker = this.workers[i];

        worker.onmessage = (e) => {
          if (e.data.type === 'complete') {
            // Merge results into main histograms
            const workerDensity = new Float64Array(e.data.density);
            const workerColorR = new Float64Array(e.data.colorR);
            const workerColorG = new Float64Array(e.data.colorG);
            const workerColorB = new Float64Array(e.data.colorB);

            for (let j = 0; j < density.length; j++) {
              density[j] += workerDensity[j];
              colorR[j] += workerColorR[j];
              colorG[j] += workerColorG[j];
              colorB[j] += workerColorB[j];
            }

            resolve();
          } else if (e.data.type === 'error') {
            reject(new Error(e.data.error));
          }
        };

        // Send work to worker
        worker.postMessage({
          type: 'render',
          transforms: this.transforms,
          finalTransform: this.finalTransform,
          palette: this.palette,
          camera: this.camera,
          width,
          height,
          iterations: workerIterations,
          skipIterations,
          workerId: i,
          seed: Date.now() + i,
          variations: variationCode
        });
      });

      promises.push(promise);
    }

    // Wait for all workers to complete
    await Promise.all(promises);
  }

  /**
   * Initialize Web Workers
   * @private
   */
  async _initializeWorkers() {
    const workerCount = this.maxWorkers;

    // Create variation code to send to workers
    const variationCode = this._serializeVariations();

    for (let i = 0; i < workerCount; i++) {
      try {
        const worker = new Worker('fractal-flame-worker.js');

        // Initialize worker with variations
        await new Promise((resolve) => {
          worker.onmessage = (e) => {
            if (e.data.type === 'ready') {
              resolve();
            }
          };

          worker.postMessage({
            type: 'init',
            variations: variationCode
          });
        });

        this.workers.push(worker);
      } catch (error) {
        console.warn('Failed to create worker:', error);
        this.useWorkers = false;
        break;
      }
    }
  }

  /**
   * Serialize variation functions for workers
   * @private
   */
  _serializeVariations() {
    const serialized = {};
    for (const [name, fn] of Object.entries(VARIATIONS)) {
      // Convert function to string (works for most variations)
      serialized[name] = fn;
    }
    return serialized;
  }

  /**
   * Single-threaded iteration (original method with symmetry support)
   * @private
   */
  async _iterateFlame(density, colorR, colorG, colorB, width, height, iterations, skipIterations) {
    let x = Math.random() * 4 - 2;
    let y = Math.random() * 4 - 2;
    let color = Math.random();

    const cumulativeProbs = [];
    let sum = 0;
    for (const t of this.transforms) {
      sum += t.weight;
      cumulativeProbs.push(sum);
    }

    for (let i = 0; i < iterations + skipIterations; i++) {
      const rand = Math.random() * sum;
      let transformIndex = 0;
      for (let j = 0; j < cumulativeProbs.length; j++) {
        if (rand < cumulativeProbs[j]) {
          transformIndex = j;
          break;
        }
      }

      const transform = this.transforms[transformIndex];
      const result = this._applyTransform(x, y, transform);
      x = result.x;
      y = result.y;

      if (this.finalTransform) {
        const finalResult = this._applyTransform(x, y, this.finalTransform);
        x = finalResult.x;
        y = finalResult.y;
      }

      color = (color + transform.color) / 2;

      if (i < skipIterations) continue;

      // NEW: Apply symmetry
      const points = this._applySymmetry(x, y, transform.symmetry);

      for (const point of points) {
        const coords = this._worldToScreen(point.x, point.y, width, height);

        if (coords.px >= 0 && coords.px < width && coords.py >= 0 && coords.py < height) {
          const idx = coords.py * width + coords.px;

          density[idx] += 1;

          const paletteColor = this._getPaletteColor(color);
          colorR[idx] += paletteColor[0];
          colorG[idx] += paletteColor[1];
          colorB[idx] += paletteColor[2];
        }
      }

      if (i % 100000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  /**
   * Apply rotational symmetry to a point
   * @private
   */
  _applySymmetry(x, y, symmetry) {
    if (!symmetry || symmetry <= 1) {
      return [{ x, y }];
    }

    const points = [];
    for (let i = 0; i < symmetry; i++) {
      const angle = (2 * Math.PI * i) / symmetry;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      points.push({
        x: x * cos - y * sin,
        y: x * sin + y * cos
      });
    }
    return points;
  }

  _applyTransform(x, y, transform) {
    const [a, b, c, d, e, f] = transform.affine;
    const affineX = a * x + b * y + c;
    const affineY = d * x + e * y + f;

    let resultX = 0;
    let resultY = 0;

    for (const [variationName, weight] of Object.entries(transform.variations)) {
      if (weight === 0) continue;

      const variation = this._getVariation(variationName);
      const varResult = variation(affineX, affineY, transform);

      resultX += weight * varResult.x;
      resultY += weight * varResult.y;
    }

    if (transform.postAffine) {
      const [pa, pb, pc, pd, pe, pf] = transform.postAffine;
      const postX = pa * resultX + pb * resultY + pc;
      const postY = pd * resultX + pe * resultY + pf;
      return { x: postX, y: postY };
    }

    return { x: resultX, y: resultY };
  }

  _getVariation(name) {
    return VARIATIONS[name] || VARIATIONS.linear;
  }

  _worldToScreen(x, y, width, height) {
    const { centerX, centerY, zoom, rotation } = this.camera;

    let wx = x - centerX;
    let wy = y - centerY;

    if (rotation !== 0) {
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const rx = wx * cos - wy * sin;
      const ry = wx * sin + wy * cos;
      wx = rx;
      wy = ry;
    }

    const sx = (wx * zoom + 1) * width / 2;
    const sy = (wy * zoom + 1) * height / 2;

    return {
      px: Math.floor(sx),
      py: Math.floor(sy)
    };
  }

  _getPaletteColor(colorIndex) {
    const index = Math.floor(colorIndex * 255) % 256;
    return this.palette[index];
  }

  _renderFlame(density, colorR, colorG, colorB, renderWidth, renderHeight,
                finalWidth, finalHeight, gamma, brightness, vibrancy, oversample) {
    let maxDensity = 0;
    for (let i = 0; i < density.length; i++) {
      if (density[i] > maxDensity) {
        maxDensity = density[i];
      }
    }

    const maxLogDensity = Math.log(maxDensity + 1);
    const imageData = new ImageData(finalWidth, finalHeight);
    const pixels = imageData.data;

    for (let y = 0; y < finalHeight; y++) {
      for (let x = 0; x < finalWidth; x++) {
        let totalDensity = 0;
        let totalR = 0, totalG = 0, totalB = 0;

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

        const logDensity = Math.log(totalDensity + 1);
        const normalizedDensity = logDensity / maxLogDensity;
        const alpha = Math.pow(normalizedDensity, 1 / gamma);

        let r = 0, g = 0, b = 0;

        if (totalDensity > 0) {
          const avgR = totalR / totalDensity;
          const avgG = totalG / totalDensity;
          const avgB = totalB / totalDensity;

          r = avgR * alpha * brightness * vibrancy;
          g = avgG * alpha * brightness * vibrancy;
          b = avgB * alpha * brightness * vibrancy;
        } else {
          r = this.backgroundColor[0];
          g = this.backgroundColor[1];
          b = this.backgroundColor[2];
        }

        r = Math.min(255, Math.max(0, r));
        g = Math.min(255, Math.max(0, g));
        b = Math.min(255, Math.max(0, b));

        const pixelIdx = (y * finalWidth + x) * 4;
        pixels[pixelIdx] = r;
        pixels[pixelIdx + 1] = g;
        pixels[pixelIdx + 2] = b;
        pixels[pixelIdx + 3] = 255;
      }
    }

    return imageData;
  }

  generateDefaultPalette() {
    const palette = [];
    for (let i = 0; i < 256; i++) {
      const hue = (i / 256) * 360;
      const rgb = this._hslToRgb(hue, 1.0, 0.5);
      palette.push(rgb);
    }
    return palette;
  }

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

  _normalizeWeights() {
    const total = this.transforms.reduce((sum, t) => sum + t.weight, 0);
    if (total > 0) {
      for (const t of this.transforms) {
        t.weight /= total;
      }
    }
  }

  clearTransforms() {
    this.transforms = [];
    this.finalTransform = null;
  }

  exportJSON() {
    return JSON.stringify({
      transforms: this.transforms,
      finalTransform: this.finalTransform,
      camera: this.camera,
      palette: this.palette,
      backgroundColor: this.backgroundColor
    }, null, 2);
  }

  importJSON(json) {
    const data = JSON.parse(json);
    this.transforms = data.transforms || [];
    this.finalTransform = data.finalTransform || null;
    this.camera = data.camera || { centerX: 0, centerY: 0, zoom: 1, rotation: 0 };
    this.palette = data.palette || this.generateDefaultPalette();
    this.backgroundColor = data.backgroundColor || [0, 0, 0];
  }

  generateRandomFlame(numTransforms = null) {
    this.clearTransforms();

    const count = numTransforms || Math.floor(Math.random() * 5) + 2;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const scale = 0.3 + Math.random() * 0.7;
      const a = Math.cos(angle) * scale;
      const b = -Math.sin(angle) * scale;
      const d = Math.sin(angle) * scale;
      const e = Math.cos(angle) * scale;
      const c = (Math.random() - 0.5) * 2;
      const f = (Math.random() - 0.5) * 2;

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

      for (const key in variations) {
        variations[key] /= totalWeight;
      }

      this.addTransform({
        affine: [a, b, c, d, e, f],
        variations: variations,
        color: i / count,
        weight: 1.0,
        symmetry: Math.random() < 0.2 ? Math.floor(Math.random() * 6) + 2 : 0  // 20% chance of symmetry
      });
    }
  }

  /**
   * Cleanup workers
   */
  dispose() {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
  }
}

// Include all original 35 variations plus 20 new ones
const VARIATIONS = {
  // === ORIGINAL 35 VARIATIONS ===
  linear: (x, y) => ({ x, y }),

  sinusoidal: (x, y) => ({
    x: Math.sin(x),
    y: Math.sin(y)
  }),

  spherical: (x, y) => {
    const r2 = x * x + y * y + 1e-10;
    return { x: x / r2, y: y / r2 };
  },

  swirl: (x, y) => {
    const r2 = x * x + y * y;
    const sinR2 = Math.sin(r2);
    const cosR2 = Math.cos(r2);
    return {
      x: x * sinR2 - y * cosR2,
      y: x * cosR2 + y * sinR2
    };
  },

  horseshoe: (x, y) => {
    const r = Math.sqrt(x * x + y * y) + 1e-10;
    return {
      x: (x - y) * (x + y) / r,
      y: 2 * x * y / r
    };
  },

  polar: (x, y) => {
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    return {
      x: theta / Math.PI,
      y: r - 1
    };
  },

  handkerchief: (x, y) => {
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    return {
      x: r * Math.sin(theta + r),
      y: r * Math.cos(theta - r)
    };
  },

  heart: (x, y) => {
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    const tr = theta * r;
    return {
      x: r * Math.sin(tr),
      y: -r * Math.cos(tr)
    };
  },

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

  spiral: (x, y) => {
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y) + 1e-10;
    return {
      x: (Math.cos(theta) + Math.sin(r)) / r,
      y: (Math.sin(theta) - Math.cos(r)) / r
    };
  },

  hyperbolic: (x, y) => {
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y) + 1e-10;
    return {
      x: Math.sin(theta) / r,
      y: Math.cos(theta) * r
    };
  },

  diamond: (x, y) => {
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    return {
      x: Math.sin(theta) * Math.cos(r),
      y: Math.cos(theta) * Math.sin(r)
    };
  },

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

  waves: (x, y, transform) => {
    const [a, b, c, d, e, f] = transform.affine;
    const b2 = b * b + 1e-10;
    const e2 = e * e + 1e-10;
    return {
      x: x + b * Math.sin(y / b2),
      y: y + e * Math.sin(x / e2)
    };
  },

  fisheye: (x, y) => {
    const r = Math.sqrt(x * x + y * y);
    const factor = 2 / (r + 1);
    return {
      x: factor * y,
      y: factor * x
    };
  },

  popcorn: (x, y, transform) => {
    const [a, b, c, d, e, f] = transform.affine;
    return {
      x: x + c * Math.sin(Math.tan(3 * y)),
      y: y + f * Math.sin(Math.tan(3 * x))
    };
  },

  exponential: (x, y) => {
    const exp = Math.exp(x - 1);
    const piY = Math.PI * y;
    return {
      x: exp * Math.cos(piY),
      y: exp * Math.sin(piY)
    };
  },

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

  cosine: (x, y) => ({
    x: Math.cos(Math.PI * x) * Math.cosh(y),
    y: -Math.sin(Math.PI * x) * Math.sinh(y)
  }),

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

  eyefish: (x, y) => {
    const r = Math.sqrt(x * x + y * y);
    const factor = 2 / (r + 1);
    return {
      x: factor * x,
      y: factor * y
    };
  },

  bubble: (x, y) => {
    const r2 = x * x + y * y;
    const factor = 4 / (r2 + 4);
    return {
      x: factor * x,
      y: factor * y
    };
  },

  cylinder: (x, y) => ({
    x: Math.sin(x),
    y: y
  }),

  perspective: (x, y, transform) => {
    const angle = transform.params.perspectiveAngle || 1.0;
    const dist = transform.params.perspectiveDist || 2.0;
    const factor = dist / (dist - y * Math.sin(angle));
    return {
      x: factor * x,
      y: factor * y * Math.cos(angle)
    };
  },

  noise: (x, y) => {
    const psi1 = Math.random();
    const psi2 = Math.random();
    return {
      x: psi1 * x * Math.cos(2 * Math.PI * psi2),
      y: psi1 * y * Math.sin(2 * Math.PI * psi2)
    };
  },

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

  blur: () => {
    const psi1 = Math.random();
    const psi2 = Math.random();
    return {
      x: psi1 * Math.cos(2 * Math.PI * psi2),
      y: psi1 * Math.sin(2 * Math.PI * psi2)
    };
  },

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
  },

  // === 20 NEW VARIATIONS ===

  // V36: Curl
  curl: (x, y, transform) => {
    const c1 = transform.params.curlC1 || 1.0;
    const c2 = transform.params.curlC2 || 0.0;
    const re = 1 + c1 * x + c2 * (x * x - y * y);
    const im = c1 * y + 2 * c2 * x * y;
    const denom = re * re + im * im + 1e-10;
    return {
      x: (x * re + y * im) / denom,
      y: (y * re - x * im) / denom
    };
  },

  // V37: Rectangles
  rectangles: (x, y, transform) => {
    const rx = transform.params.rectanglesX || 1.0;
    const ry = transform.params.rectanglesY || 1.0;
    return {
      x: (2 * Math.floor(x / rx) + 1) * rx - x,
      y: (2 * Math.floor(y / ry) + 1) * ry - y
    };
  },

  // V38: Arch
  arch: (x, y) => {
    const psi = Math.random();
    const sinPi = Math.sin(Math.PI * psi);
    return {
      x: sinPi,
      y: sinPi * sinPi / Math.cos(Math.PI * psi)
    };
  },

  // V39: Tangent
  tangent: (x, y) => ({
    x: Math.sin(x) / Math.cos(y),
    y: Math.tan(y)
  }),

  // V40: Square
  square: (x, y) => {
    const psi1 = Math.random();
    const psi2 = Math.random();
    return {
      x: psi1 - 0.5,
      y: psi2 - 0.5
    };
  },

  // V41: Rays
  rays: (x, y) => {
    const r2 = x * x + y * y + 1e-10;
    const psi = Math.random();
    const factor = Math.tan(psi * Math.PI) / r2;
    return {
      x: factor * Math.cos(x),
      y: factor * Math.sin(y)
    };
  },

  // V42: Blade
  blade: (x, y) => {
    const r = Math.sqrt(x * x + y * y);
    const psi = Math.random();
    const blade = r * (Math.cos(psi * r) + Math.sin(psi * r));
    return {
      x: x * blade,
      y: x * blade
    };
  },

  // V43: Secant
  secant: (x, y) => {
    const r = Math.sqrt(x * x + y * y) + 1e-10;
    return {
      x: x,
      y: 1 / Math.cos(r)
    };
  },

  // V44: Twintrian
  twintrian: (x, y) => {
    const r = Math.sqrt(x * x + y * y);
    const psi = Math.random();
    const sinR = Math.sin(psi * r);
    const t = Math.log10(sinR * sinR) + Math.cos(psi * r);
    return {
      x: x * t,
      y: x * (t - Math.PI * sinR)
    };
  },

  // V45: Cross
  cross: (x, y) => {
    const sq = x * x - y * y;
    const denom = sq * sq + 1e-10;
    return {
      x: x / Math.sqrt(denom),
      y: y / Math.sqrt(denom)
    };
  },

  // V46: Disc2
  disc2: (x, y, transform) => {
    const rot = transform.params.disc2Rot || 0.0;
    const twist = transform.params.disc2Twist || 0.5;
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    const sinr = Math.sin(r * twist);
    const cosr = Math.cos(r * twist);
    const k = (rot + theta) / Math.PI;
    return {
      x: k * sinr,
      y: k * cosr
    };
  },

  // V47: Super Shape
  supershape: (x, y, transform) => {
    const m = transform.params.supershapeM || 4;
    const n1 = transform.params.supershapeN1 || 2;
    const n2 = transform.params.supershapeN2 || 2;
    const n3 = transform.params.supershapeN3 || 2;
    const rnd = transform.params.supershapeRnd || 0.5;
    const holes = transform.params.supershapeHoles || 0;

    const theta = Math.atan2(y, x);
    const t1 = Math.pow(Math.abs(Math.cos(m * theta / 4)), n2);
    const t2 = Math.pow(Math.abs(Math.sin(m * theta / 4)), n3);
    const r = Math.pow(t1 + t2, -1 / n1);

    const psi = Math.random();
    const radius = r * (rnd * psi + (1 - rnd));

    return {
      x: radius * Math.cos(theta),
      y: radius * Math.sin(theta)
    };
  },

  // V48: Flower
  flower: (x, y, transform) => {
    const holes = transform.params.flowerHoles || 0;
    const petals = transform.params.flowerPetals || 6;
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    const psi = Math.random();
    const radius = psi * (holes + Math.sin(petals * theta));
    return {
      x: radius * Math.cos(theta),
      y: radius * Math.sin(theta)
    };
  },

  // V49: Conic
  conic: (x, y, transform) => {
    const eccentricity = transform.params.conicEccentricity || 1.0;
    const holes = transform.params.conicHoles || 0;
    const theta = Math.atan2(y, x);
    const r = Math.sqrt(x * x + y * y);
    const psi = Math.random();
    const ct = holes * psi;
    const radius = ct / (1 + eccentricity * Math.cos(theta));
    return {
      x: radius * Math.cos(theta),
      y: radius * Math.sin(theta)
    };
  },

  // V50: Parabola
  parabola: (x, y, transform) => {
    const height = transform.params.parabolaHeight || 1.0;
    const width = transform.params.parabolaWidth || 1.0;
    const r = Math.sqrt(x * x + y * y);
    const psi1 = Math.random();
    const psi2 = Math.random();
    const sinR = Math.sin(r);
    const cosR = Math.cos(r);
    return {
      x: height * sinR * sinR * psi1,
      y: width * cosR * psi2
    };
  },

  // V51: Bent2
  bent2: (x, y, transform) => {
    const cx = transform.params.bent2X || 1.0;
    const cy = transform.params.bent2Y || 1.0;
    let nx = x;
    let ny = y;
    if (nx < 0) nx *= cx;
    if (ny < 0) ny *= cy;
    return { x: nx, y: ny };
  },

  // V52: Bipolar
  bipolar: (x, y, transform) => {
    const shift = transform.params.bipolarShift || 1.0;
    const r2 = x * x + y * y;
    const t = r2 + 1;
    const x2 = 2 * x;
    const y2 = shift + y;
    const factor = 2 / (shift * t + x2 - shift);
    return {
      x: factor * x,
      y: factor * y2
    };
  },

  // V53: Boarders
  boarders: (x, y) => {
    const rnx = Math.floor(x);
    const rny = Math.floor(y);
    const cx = x - rnx;
    const cy = y - rny;

    if (Math.random() < 0.75) {
      return {
        x: rnx + 0.5,
        y: rny + 0.5
      };
    } else {
      if (cx >= 0.5) {
        return cx >= cy && cx >= 1 - cy ?
          { x: rnx + 1, y: rny + cy } :
          cy > cx ? { x: rnx + cx, y: rny + 1 } :
          { x: rnx + cx, y: rny };
      } else {
        return cx <= cy && cx <= 1 - cy ?
          { x: rnx, y: rny + cy } :
          cy < cx ? { x: rnx + cx, y: rny } :
          { x: rnx + cx, y: rny + 1 };
      }
    }
  },

  // V54: Butterfly
  butterfly: (x, y) => {
    const r = Math.sqrt(x * x + y * y);
    const wx = 4 / (Math.sqrt(r) * (Math.pow(Math.E, r) - 1) + 1e-10);
    return {
      x: wx * x,
      y: wx * wx * y
    };
  },

  // V55: Cell
  cell: (x, y, transform) => {
    const size = transform.params.cellSize || 1.0;
    const inv = 1 / size;
    const cellX = Math.floor(x * inv);
    const cellY = Math.floor(y * inv);

    const dx = x - cellX * size;
    const dy = y - cellY * size;

    return {
      x: dx - 0.5,
      y: dy - 0.5
    };
  }
};

// Export for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FractalFlameGenerator, VARIATIONS };
}
