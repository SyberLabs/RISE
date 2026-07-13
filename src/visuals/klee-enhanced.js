/**
 * KLEE ENGINE - ENHANCED VERSION
 * With multi-octave 2D Simplex noise and marching squares for smooth organic forms
 *
 * Improvements over base version:
 * - 2D Simplex noise (no external dependencies - implemented from scratch)
 * - Multi-octave noise for richer textures
 * - Marching squares algorithm for smooth contours
 * - Bezier curve fitting for elegant form boundaries
 * - Resolves the "blocky sleeve" aesthetic issue
 *
 * @author Klee Engine Team
 * @version 2.0.0 - Enhanced
 */

class KleeEngine {
  constructor() {
    // Core state
    this.seeds = [];
    this.lines = [];
    this.forms = [];
    this.palette = [];
    this.densityGrid = null;
    this.gridResolution = 100; // Increased for smoother contours

    // Generation parameters
    this.width = 1024;
    this.height = 1024;
    this.stepLength = 5;
    this.maxSteps = 500;

    // Enhanced 2D Simplex noise
    this.simplexPermutation = this._initializeSimplex();

    // Initialize default palette
    this._generateDefaultPalette();
  }

  /**
   * Initialize 2D Simplex noise with permutation table
   * Based on Ken Perlin's improved noise
   */
  _initializeSimplex() {
    const p = [];
    for (let i = 0; i < 256; i++) {
      p[i] = Math.floor(Math.random() * 256);
    }

    // Duplicate for easy wrapping
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      perm[i] = p[i & 255];
    }

    return perm;
  }

  /**
   * 2D Simplex Noise
   * Returns value in [-1, 1]
   */
  noise2D(x, y) {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

    // Skew input space
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);

    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    // Determine simplex
    let i1, j1;
    if (x0 > y0) {
      i1 = 1; j1 = 0;
    } else {
      i1 = 0; j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    // Gradients
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.simplexPermutation[ii + this.simplexPermutation[jj]] % 12;
    const gi1 = this.simplexPermutation[ii + i1 + this.simplexPermutation[jj + j1]] % 12;
    const gi2 = this.simplexPermutation[ii + 1 + this.simplexPermutation[jj + 1]] % 12;

    // Gradient vectors
    const grad3 = [
      [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
      [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
      [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
    ];

    // Calculate contributions
    let n0, n1, n2;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) n0 = 0.0;
    else {
      t0 *= t0;
      n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) n1 = 0.0;
    else {
      t1 *= t1;
      n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) n2 = 0.0;
    else {
      t2 *= t2;
      n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2);
    }

    // Sum and scale to [-1, 1]
    return 70.0 * (n0 + n1 + n2);
  }

  /**
   * Multi-octave 2D noise (fractal Brownian motion)
   * This is the secret sauce for rich, natural textures
   */
  multiOctaveNoise2D(x, y, octaves = 4, persistence = 0.5) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return total / maxValue;
  }

  /**
   * Generate a Klee-inspired color palette
   */
  _generateDefaultPalette() {
    this.palette = [];
    const baseHues = [0, 30, 60, 120, 180, 210, 240, 270, 300, 330];

    for (let hue of baseHues) {
      this.palette.push(this._hslToRgb(hue, 0.7, 0.5));
      this.palette.push(this._hslToRgb(hue, 0.5, 0.7));
      this.palette.push(this._hslToRgb(hue, 0.8, 0.3));
    }

    this.palette.push(this._hslToRgb(0, 0, 0.9));
    this.palette.push(this._hslToRgb(0, 0, 0.2));
    this.palette.push(this._hslToRgb(40, 0.2, 0.8));
  }

  setPalette(colors) {
    this.palette = colors.map(c => {
      if (typeof c === 'string') return c;
      if (c.h !== undefined) return this._hslToRgb(c.h, c.s, c.l);
      return `rgb(${c.r},${c.g},${c.b})`;
    });
  }

  _hslToRgb(h, s, l) {
    h = h / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

    return `rgb(${r},${g},${b})`;
  }

  addSeed(config) {
    const seed = {
      x: config.x || this.width * Math.random(),
      y: config.y || this.height * Math.random(),
      angle: config.angle !== undefined ? config.angle : Math.random() * Math.PI * 2,
      variations: config.variations || { straight: 1.0 },
      colorIndex: config.colorIndex !== undefined ? config.colorIndex : Math.random(),
      branchProbability: config.branchProbability || 0.02,
      symmetry: config.symmetry || 0,
      maxBranches: config.maxBranches || 3,
      params: config.params || {}
    };

    this.seeds.push(seed);
    return this.seeds.length - 1;
  }

  /**
   * ENHANCED LINE VARIATIONS
   * Now with proper 2D noise
   */

  _varStraight(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varWavy(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const amplitude = params.amplitude || 0.3;
    const frequency = params.frequency || 0.1;
    const progress = step / total;
    const offset = Math.sin(progress * frequency * Math.PI * 20) * amplitude;

    return [
      x + r * Math.cos(theta + offset),
      y + r * Math.sin(theta + offset),
      theta
    ];
  }

  _varCurved(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const curveRate = params.curveRate || 0.05;
    const newTheta = theta + curveRate;

    return [x + r * Math.cos(newTheta), y + r * Math.sin(newTheta), newTheta];
  }

  _varSpiral(x, y, theta, step, total, params) {
    let r = params.stepLength || this.stepLength;
    const spiralFactor = params.spiralFactor || 1.02;
    const spiralRate = params.spiralRate || 0.1;

    r *= Math.pow(spiralFactor, step / 10);
    const newTheta = theta + spiralRate;

    return [x + r * Math.cos(newTheta), y + r * Math.sin(newTheta), newTheta];
  }

  _varZigzag(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const zigzagAngle = params.zigzagAngle || Math.PI / 4;
    const newTheta = theta + (Math.random() < 0.5 ? zigzagAngle : -zigzagAngle);

    return [x + r * Math.cos(newTheta), y + r * Math.sin(newTheta), newTheta];
  }

  /**
   * ENHANCED: Organic variation with rich 2D multi-octave noise
   * This is the big improvement - much more natural movement
   */
  _varOrganic(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const noiseScale = params.noiseScale || 0.01;
    const noiseAmount = params.noiseAmount || 0.5;
    const octaves = params.octaves || 3;

    // Use actual position for 2D noise (not just step)
    const noiseX = this.multiOctaveNoise2D(x * noiseScale, y * noiseScale, octaves);
    const noiseY = this.multiOctaveNoise2D(x * noiseScale + 100, y * noiseScale + 100, octaves);

    // Apply noise to both angle and distance
    const thetaPerturbation = theta + noiseX * noiseAmount;
    const rPerturbation = r * (1 + noiseY * noiseAmount * 0.3);

    return [
      x + rPerturbation * Math.cos(thetaPerturbation),
      y + rPerturbation * Math.sin(thetaPerturbation),
      theta + noiseX * 0.1
    ];
  }

  _varRhythmic(x, y, theta, step, total, params) {
    const baseR = params.stepLength || this.stepLength;
    const frequency = params.frequency || 0.2;
    const progress = step / total;
    const r = baseR * (1 + 0.5 * Math.sin(progress * frequency * Math.PI * 30));

    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varCircular(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const circleRate = params.circleRate || 0.2;
    const newTheta = theta + circleRate;

    return [x + r * Math.cos(newTheta), y + r * Math.sin(newTheta), newTheta];
  }

  _varDotted(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varLooping(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const progress = step / total;
    const loopFreq = params.loopFrequency || 0.5;
    const offset = Math.sin(progress * loopFreq * Math.PI * 10) * Math.PI / 3;

    return [
      x + r * Math.cos(theta + offset),
      y + r * Math.sin(theta + offset),
      theta + offset * 0.1
    ];
  }

  _varAngular(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const angleSteps = params.angleSteps || 8;
    const angleIncrement = (Math.PI * 2) / angleSteps;

    if (step % 5 === 0) {
      theta = Math.round(theta / angleIncrement) * angleIncrement;
      theta += (Math.random() < 0.5 ? angleIncrement : -angleIncrement);
    }

    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varGravitational(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const centerX = params.centerX || this.width / 2;
    const centerY = params.centerY || this.height / 2;
    const gravity = params.gravity || 0.05;

    const dx = centerX - x;
    const dy = centerY - y;
    const angleToCenter = Math.atan2(dy, dx);
    const newTheta = theta + (angleToCenter - theta) * gravity;

    return [x + r * Math.cos(newTheta), y + r * Math.sin(newTheta), newTheta];
  }

  _varRepelling(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const centerX = params.centerX || this.width / 2;
    const centerY = params.centerY || this.height / 2;
    const repulsion = params.repulsion || 0.1;

    const dx = x - centerX;
    const dy = y - centerY;
    const angleFromCenter = Math.atan2(dy, dx);
    const newTheta = theta + (angleFromCenter - theta) * repulsion;

    return [x + r * Math.cos(newTheta), y + r * Math.sin(newTheta), newTheta];
  }

  _varTrembling(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const tremble = params.tremble || 0.5;
    const offset = (Math.random() - 0.5) * tremble;

    return [
      x + r * Math.cos(theta + offset),
      y + r * Math.sin(theta + offset),
      theta + offset * 0.5
    ];
  }

  _varBranching(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varExplosive(x, y, theta, step, total, params) {
    let r = params.stepLength || this.stepLength;
    const acceleration = params.acceleration || 1.05;
    r *= Math.pow(acceleration, step / 5);

    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varMeandering(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const meander = params.meander || 0.02;
    const newTheta = theta + Math.sin(step * 0.1) * meander;

    return [x + r * Math.cos(newTheta), y + r * Math.sin(newTheta), newTheta];
  }

  _varChaotic(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const chaos = params.chaos || 0.5;
    const newTheta = theta + (Math.random() - 0.5) * Math.PI * chaos;
    const newR = r * (0.5 + Math.random());

    return [x + newR * Math.cos(newTheta), y + newR * Math.sin(newTheta), newTheta];
  }

  _varHarmonic(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const progress = step / total;
    const wave1 = Math.sin(progress * Math.PI * 10) * 0.2;
    const wave2 = Math.sin(progress * Math.PI * 30) * 0.1;
    const wave3 = Math.sin(progress * Math.PI * 50) * 0.05;
    const offset = wave1 + wave2 + wave3;

    return [
      x + r * Math.cos(theta + offset),
      y + r * Math.sin(theta + offset),
      theta
    ];
  }

  _varCrystalline(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const latticeAngle = params.latticeAngle || Math.PI / 3;

    if (step % 3 === 0) {
      const options = [-latticeAngle, 0, latticeAngle];
      theta += options[Math.floor(Math.random() * options.length)];
    }

    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varTwittering(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const twitter = Math.sin(step * 0.5) * 0.3 + Math.cos(step * 0.3) * 0.2;
    const jitter = (Math.random() - 0.5) * 0.2;

    return [
      x + r * Math.cos(theta + twitter + jitter),
      y + r * Math.sin(theta + twitter + jitter),
      theta + twitter * 0.1
    ];
  }

  _varCorporeal(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const progress = step / total;

    if (progress > 0.7) {
      const pullback = (progress - 0.7) * 3;
      theta += pullback * 0.5;
    }

    const wobble = Math.sin(step * 0.2) * 0.15;

    return [
      x + r * Math.cos(theta + wobble),
      y + r * Math.sin(theta + wobble),
      theta + wobble * 0.1
    ];
  }

  _varArchitectural(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength * 2;

    if (step % 5 === 0) {
      const cardinal = Math.round(theta / (Math.PI / 2)) * (Math.PI / 2);
      theta = cardinal;

      if (Math.random() < 0.3) {
        theta += Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1);
      }
    }

    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varFlowing(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const flow = params.flow || 0.03;
    const newTheta = theta + Math.sin(step * 0.2) * flow;

    return [x + r * Math.cos(newTheta), y + r * Math.sin(newTheta), newTheta];
  }

  _varMechanical(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const gearSteps = params.gearSteps || 12;

    if (step % gearSteps === 0) {
      theta += Math.PI / 6;
    }

    return [x + r * Math.cos(theta), y + r * Math.sin(theta), theta];
  }

  _varMythical(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const dragon = Math.sin(step * 0.15) * 0.4 * Math.cos(step * 0.08);
    const scale = 1 + Math.sin(step * 0.05) * 0.3;

    return [
      x + r * scale * Math.cos(theta + dragon),
      y + r * scale * Math.sin(theta + dragon),
      theta + dragon * 0.15
    ];
  }

  _getVariationFunction(name) {
    const variations = {
      straight: this._varStraight,
      wavy: this._varWavy,
      curved: this._varCurved,
      spiral: this._varSpiral,
      zigzag: this._varZigzag,
      organic: this._varOrganic,
      rhythmic: this._varRhythmic,
      circular: this._varCircular,
      dotted: this._varDotted,
      looping: this._varLooping,
      angular: this._varAngular,
      gravitational: this._varGravitational,
      repelling: this._varRepelling,
      trembling: this._varTrembling,
      branching: this._varBranching,
      explosive: this._varExplosive,
      meandering: this._varMeandering,
      chaotic: this._varChaotic,
      harmonic: this._varHarmonic,
      crystalline: this._varCrystalline,
      twittering: this._varTwittering,
      corporeal: this._varCorporeal,
      architectural: this._varArchitectural,
      flowing: this._varFlowing,
      mechanical: this._varMechanical,
      mythical: this._varMythical
    };

    return variations[name] || this._varStraight;
  }

  _selectVariation(variations) {
    const total = Object.values(variations).reduce((sum, w) => sum + w, 0);
    let rand = Math.random() * total;

    for (let [name, weight] of Object.entries(variations)) {
      rand -= weight;
      if (rand <= 0) return name;
    }

    return Object.keys(variations)[0];
  }

  _growLine(seed, lineIndex, totalLines) {
    const points = [];
    let x = seed.x;
    let y = seed.y;
    let theta = seed.angle;

    const steps = this.maxSteps + Math.floor(Math.random() * 200 - 100);
    const settleSteps = 5;

    for (let step = 0; step < steps; step++) {
      const varName = this._selectVariation(seed.variations);
      const varFunc = this._getVariationFunction(varName);

      const [newX, newY, newTheta] = varFunc.call(
        this, x, y, theta, step, steps, seed.params
      );

      if (step >= settleSteps) {
        if (newX >= 0 && newX < this.width && newY >= 0 && newY < this.height) {
          points.push([newX, newY]);
          this._updateDensityGrid(newX, newY);
        } else {
          if (seed.params.bounce) {
            theta += Math.PI;
            continue;
          } else {
            break;
          }
        }
      }

      x = newX;
      y = newY;
      theta = newTheta;

      if (varName === 'branching' || Math.random() < seed.branchProbability) {
        if (this.lines.length < totalLines * 3) {
          this._createBranch(x, y, theta, seed, step / steps);
        }
      }
    }

    return {
      points,
      colorIndex: seed.colorIndex,
      variation: Object.keys(seed.variations)[0],
      seedIndex: this.lines.length
    };
  }

  _createBranch(x, y, theta, parentSeed, progress) {
    const branchAngles = [Math.PI / 4, -Math.PI / 4, Math.PI / 3, -Math.PI / 3];
    const branchAngle = branchAngles[Math.floor(Math.random() * branchAngles.length)];

    const branchSeed = {
      x,
      y,
      angle: theta + branchAngle,
      variations: parentSeed.variations,
      colorIndex: parentSeed.colorIndex,
      branchProbability: parentSeed.branchProbability * 0.5,
      symmetry: 0,
      maxBranches: parentSeed.maxBranches - 1,
      params: { ...parentSeed.params, stepLength: this.stepLength * 0.8 }
    };

    if (branchSeed.maxBranches > 0) {
      const branchLine = this._growLine(branchSeed, this.lines.length, this.seeds.length * 10);
      if (branchLine.points.length > 10) {
        this.lines.push(branchLine);
      }
    }
  }

  _updateDensityGrid(x, y) {
    if (!this.densityGrid) return;

    const cellX = Math.floor(x / this.width * this.gridResolution);
    const cellY = Math.floor(y / this.height * this.gridResolution);

    if (cellX >= 0 && cellX < this.gridResolution && cellY >= 0 && cellY < this.gridResolution) {
      const index = cellY * this.gridResolution + cellX;
      this.densityGrid[index]++;
    }
  }

  _applySymmetry(line, symmetry, centerX, centerY) {
    if (symmetry === 0) return [line];

    const symmetricLines = [line];

    if (symmetry === 2) {
      const mirrored = {
        ...line,
        points: line.points.map(([x, y]) => [centerX + (centerX - x), y])
      };
      symmetricLines.push(mirrored);
    } else if (symmetry > 2) {
      for (let i = 1; i < symmetry; i++) {
        const angle = (Math.PI * 2 * i) / symmetry;
        const rotated = {
          ...line,
          points: line.points.map(([x, y]) => {
            const dx = x - centerX;
            const dy = y - centerY;
            return [
              centerX + dx * Math.cos(angle) - dy * Math.sin(angle),
              centerY + dx * Math.sin(angle) + dy * Math.cos(angle)
            ];
          })
        };
        symmetricLines.push(rotated);
      }
    }

    return symmetricLines;
  }

  /**
   * MARCHING SQUARES ALGORITHM
   * Extract smooth contours from density field
   */
  _marchingSquares(threshold = 3) {
    const contours = [];
    const cellSize = 1; // Grid is already discretized

    for (let y = 0; y < this.gridResolution - 1; y++) {
      for (let x = 0; x < this.gridResolution - 1; x++) {
        // Get density values at 4 corners
        const tl = this.densityGrid[y * this.gridResolution + x] >= threshold ? 1 : 0;
        const tr = this.densityGrid[y * this.gridResolution + (x + 1)] >= threshold ? 1 : 0;
        const br = this.densityGrid[(y + 1) * this.gridResolution + (x + 1)] >= threshold ? 1 : 0;
        const bl = this.densityGrid[(y + 1) * this.gridResolution + x] >= threshold ? 1 : 0;

        // Calculate marching squares index (0-15)
        const squareIndex = tl * 8 + tr * 4 + br * 2 + bl * 1;

        // Skip empty or full squares
        if (squareIndex === 0 || squareIndex === 15) continue;

        // Get line segments for this square
        const segments = this._getMarchingSquaresSegments(x, y, squareIndex);
        if (segments.length > 0) {
          contours.push(...segments);
        }
      }
    }

    // Connect segments into continuous contours
    return this._connectContours(contours);
  }

  /**
   * Get line segments for a marching squares configuration
   */
  _getMarchingSquaresSegments(x, y, index) {
    const cellSize = this.width / this.gridResolution;

    // Edge midpoints
    const top = [x + 0.5, y];
    const right = [x + 1, y + 0.5];
    const bottom = [x + 0.5, y + 1];
    const left = [x, y + 0.5];

    // Marching squares lookup table
    const segments = [
      [], // 0
      [[left, bottom]], // 1
      [[bottom, right]], // 2
      [[left, right]], // 3
      [[top, right]], // 4
      [[top, bottom], [left, bottom]], // 5 (ambiguous)
      [[top, bottom]], // 6
      [[top, left]], // 7
      [[top, left]], // 8
      [[top, bottom]], // 9
      [[top, right], [left, bottom]], // 10 (ambiguous)
      [[top, right]], // 11
      [[left, right]], // 12
      [[bottom, right]], // 13
      [[left, bottom]], // 14
      [] // 15
    ];

    const segs = segments[index] || [];

    // Scale to canvas coordinates
    return segs.map(seg =>
      seg.map(([px, py]) => [
        px * cellSize,
        py * cellSize
      ])
    );
  }

  /**
   * Connect segments into continuous contour paths
   */
  _connectContours(segments) {
    if (segments.length === 0) return [];

    const contours = [];
    const used = new Set();
    const tolerance = 2; // Connection tolerance in pixels

    for (let i = 0; i < segments.length; i++) {
      if (used.has(i)) continue;

      const contour = [segments[i][0], segments[i][1]];
      used.add(i);

      let connected = true;
      while (connected) {
        connected = false;
        const lastPoint = contour[contour.length - 1];

        // Find next connecting segment
        for (let j = 0; j < segments.length; j++) {
          if (used.has(j)) continue;

          const [p1, p2] = segments[j];
          const dist1 = this._distance(lastPoint, p1);
          const dist2 = this._distance(lastPoint, p2);

          if (dist1 < tolerance) {
            contour.push(p2);
            used.add(j);
            connected = true;
            break;
          } else if (dist2 < tolerance) {
            contour.push(p1);
            used.add(j);
            connected = true;
            break;
          }
        }
      }

      if (contour.length > 3) {
        contours.push(contour);
      }
    }

    return contours;
  }

  _distance(p1, p2) {
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * ENHANCED: Detect forms with smooth boundaries
   */
  _detectForms() {
    if (!this.densityGrid) return;

    // Use marching squares to extract smooth contours
    const contours = this._marchingSquares(3);

    // Convert contours to forms
    for (let contour of contours) {
      if (contour.length < 5) continue;

      // Calculate form properties
      const avgX = contour.reduce((sum, [x]) => sum + x, 0) / contour.length;
      const avgY = contour.reduce((sum, [, y]) => sum + y, 0) / contour.length;

      this.forms.push({
        contour,
        centerX: avgX,
        centerY: avgY,
        type: 'smooth'
      });
    }
  }

  generateArtwork(options = {}) {
    this.width = options.width || 1024;
    this.height = options.height || 1024;
    this.maxSteps = options.steps || 500;
    this.stepLength = options.stepLength || 5;

    this.densityGrid = new Float32Array(this.gridResolution * this.gridResolution);
    this.lines = [];
    this.forms = [];

    const totalLines = this.seeds.length * 10;

    for (let seed of this.seeds) {
      const linesForSeed = Math.floor(Math.random() * 5) + 3;

      for (let i = 0; i < linesForSeed; i++) {
        const line = this._growLine(seed, this.lines.length, totalLines);

        if (line.points.length > 10) {
          const symmetricLines = this._applySymmetry(
            line,
            seed.symmetry,
            this.width / 2,
            this.height / 2
          );

          this.lines.push(...symmetricLines);
        }
      }
    }

    this._detectForms();

    return {
      lines: this.lines,
      forms: this.forms,
      width: this.width,
      height: this.height
    };
  }

  /**
   * ENHANCED: Render smooth organic forms
   */
  render(canvasElement, options = {}) {
    const ctx = canvasElement.getContext('2d');

    canvasElement.width = this.width;
    canvasElement.height = this.height;

    const bgColor = options.background || '#F5F1E8';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, this.width, this.height);

    if (options.showForms !== false) {
      this._renderSmoothForms(ctx, options);
    }

    this._renderLines(ctx, options);

    if (options.texture) {
      this._applyTexture(ctx, options.texture);
    }
  }

  /**
   * Render forms with smooth Bezier curves
   */
  _renderSmoothForms(ctx, options) {
    for (let form of this.forms) {
      if (!form.contour || form.contour.length < 3) continue;

      ctx.globalAlpha = 0.15;

      const colorIndex = Math.floor(form.centerX / this.width * this.palette.length);
      ctx.fillStyle = this.palette[colorIndex % this.palette.length];

      // Draw smooth curve through contour points
      ctx.beginPath();

      const smoothness = 0.3;
      const points = form.contour;

      ctx.moveTo(points[0][0], points[0][1]);

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const p2 = points[(i + 2) % points.length];

        // Calculate control points for smooth curve
        const cp1x = p1[0] - (p2[0] - p0[0]) * smoothness;
        const cp1y = p1[1] - (p2[1] - p0[1]) * smoothness;

        ctx.quadraticCurveTo(cp1x, cp1y, p1[0], p1[1]);
      }

      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 1;
    }
  }

  _renderLines(ctx, options) {
    const lineWidth = options.lineWidth || 1.5;
    const alpha = options.lineAlpha !== undefined ? options.lineAlpha : 0.8;

    for (let line of this.lines) {
      if (line.points.length < 2) continue;

      ctx.beginPath();
      ctx.moveTo(line.points[0][0], line.points[0][1]);

      for (let i = 1; i < line.points.length; i++) {
        const [x, y] = line.points[i];

        if (line.variation === 'dotted' && i % 3 === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      const colorIndex = Math.floor(line.colorIndex * this.palette.length);
      ctx.strokeStyle = this.palette[colorIndex % this.palette.length];
      ctx.lineWidth = lineWidth * (0.5 + Math.random() * 0.5);
      ctx.globalAlpha = alpha;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  _applyTexture(ctx, intensity = 0.05) {
    const imageData = ctx.getImageData(0, 0, this.width, this.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * intensity * 255;
      data[i] += noise;
      data[i + 1] += noise;
      data[i + 2] += noise;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  export(canvasElement, format = 'image/png') {
    return canvasElement.toDataURL(format);
  }

  saveConfig() {
    return JSON.stringify({
      seeds: this.seeds,
      palette: this.palette,
      width: this.width,
      height: this.height,
      stepLength: this.stepLength,
      maxSteps: this.maxSteps
    }, null, 2);
  }

  loadConfig(jsonString) {
    const config = JSON.parse(jsonString);
    this.seeds = config.seeds || [];
    this.palette = config.palette || [];
    this.width = config.width || 1024;
    this.height = config.height || 1024;
    this.stepLength = config.stepLength || 5;
    this.maxSteps = config.maxSteps || 500;
  }

  generateRandom(theme = 'harmonic') {
    this.seeds = [];

    // Curated preset roster. Each theme is LED by its namesake variation
    // (guaranteed 0.7 weight) with a supporting cast. Spiral/circular walks
    // under high-order rotational symmetry produced moiré tangles — those
    // combinations are deliberately absent, and symmetry orders are capped.
    const themes = {
      architectural: {
        variations: ['architectural', 'angular', 'straight', 'crystalline'],
        seedCount: [4, 7],
        symmetry: [0, 2, 4]
      },
      chaotic: {
        variations: ['chaotic', 'explosive', 'zigzag', 'trembling'],
        seedCount: [5, 10],
        symmetry: [0]
      },
      harmonic: {
        variations: ['harmonic', 'wavy', 'flowing', 'rhythmic'],
        seedCount: [2, 5],
        symmetry: [0, 2, 3]
      },
      gravitational: {
        variations: ['gravitational', 'looping', 'meandering', 'curved'],
        seedCount: [2, 4],
        symmetry: [0, 2]
      },
      twittering: {
        variations: ['twittering', 'dotted', 'looping', 'mythical'],
        seedCount: [3, 6],
        symmetry: [0, 2]
      }
    };

    // Retired preset names (and stray historical ids) map onto the
    // nearest curated theme so saved blueprints keep rendering.
    const LEGACY_ALIASES = {
      corporeal: 'harmonic',
      structural: 'architectural',
      mythic: 'twittering',
      volatile: 'chaotic',
      centered: 'gravitational',
      'gravitational-pull': 'gravitational',
      wireframe: 'architectural'
    };

    const resolved = themes[theme] ? theme : (LEGACY_ALIASES[theme] || 'harmonic');
    const config = themes[resolved];
    const seedCount = config.seedCount[0] +
      Math.floor(Math.random() * (config.seedCount[1] - config.seedCount[0]));

    for (let i = 0; i < seedCount; i++) {
      // The namesake variation always leads, so presets keep their identity;
      // a random supporting variation colors each seed differently.
      const variations = {};
      variations[config.variations[0]] = 0.7;

      const secondary = config.variations[
        1 + Math.floor(Math.random() * (config.variations.length - 1))
      ];
      variations[secondary] = (variations[secondary] || 0) + 0.3;

      this.addSeed({
        x: this.width * (0.2 + Math.random() * 0.6),
        y: this.height * (0.2 + Math.random() * 0.6),
        angle: Math.random() * Math.PI * 2,
        variations,
        colorIndex: i / seedCount,
        branchProbability: 0.01 + Math.random() * 0.03,
        symmetry: config.symmetry[Math.floor(Math.random() * config.symmetry.length)],
        params: {
          stepLength: this.stepLength * (0.7 + Math.random() * 0.6),
          amplitude: 0.2 + Math.random() * 0.4,
          frequency: 0.1 + Math.random() * 0.3,
          noiseScale: 0.005 + Math.random() * 0.015,
          octaves: 3
        }
      });
    }

    return this.generateArtwork();
  }
}

// ES Module export
export { KleeEngine };
