/**
 * KLEE ENGINE - Procedural Art Generator
 * Inspired by Paul Klee's philosophy of lines as dynamic forces
 * "A line is a dot that went for a walk" - Paul Klee
 *
 * @author Klee Engine Team
 * @version 1.0.0
 */

class KleeEngine {
  constructor() {
    // Core state
    this.seeds = [];
    this.lines = [];
    this.forms = [];
    this.palette = [];
    this.densityGrid = null;
    this.gridResolution = 50; // cells per dimension

    // Generation parameters
    this.width = 1024;
    this.height = 1024;
    this.stepLength = 5;
    this.maxSteps = 500;

    // Simple 1D Perlin noise implementation
    this.noiseTable = this._initializeNoise();

    // Initialize default palette
    this._generateDefaultPalette();
  }

  /**
   * Initialize simple pseudo-random noise table for organic variations
   */
  _initializeNoise() {
    const table = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      table[i] = Math.random() * 2 - 1;
    }
    return table;
  }

  /**
   * Simple 1D Perlin-like noise function
   */
  noise(x) {
    const i = Math.floor(x) & 255;
    const f = x - Math.floor(x);
    const u = f * f * (3 - 2 * f); // smoothstep

    const a = this.noiseTable[i];
    const b = this.noiseTable[(i + 1) & 255];

    return a * (1 - u) + b * u;
  }

  /**
   * Generate a Klee-inspired color palette
   * Uses complementary colors, warm/cool balance
   */
  _generateDefaultPalette() {
    this.palette = [];

    // Primary colors inspired by Klee
    const baseHues = [0, 30, 60, 120, 180, 210, 240, 270, 300, 330];

    for (let hue of baseHues) {
      // Add main color
      this.palette.push(this._hslToRgb(hue, 0.7, 0.5));

      // Add tint (lighter)
      this.palette.push(this._hslToRgb(hue, 0.5, 0.7));

      // Add shade (darker)
      this.palette.push(this._hslToRgb(hue, 0.8, 0.3));
    }

    // Add neutrals
    this.palette.push(this._hslToRgb(0, 0, 0.9)); // near white
    this.palette.push(this._hslToRgb(0, 0, 0.2)); // near black
    this.palette.push(this._hslToRgb(40, 0.2, 0.8)); // beige
  }

  /**
   * Set custom color palette
   */
  setPalette(colors) {
    this.palette = colors.map(c => {
      if (typeof c === 'string') return c;
      if (c.h !== undefined) return this._hslToRgb(c.h, c.s, c.l);
      return `rgb(${c.r},${c.g},${c.b})`;
    });
  }

  /**
   * Convert HSL to RGB
   */
  _hslToRgb(h, s, l) {
    h = h / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);

    return `rgb(${r},${g},${b})`;
  }

  /**
   * Add a seed point for line generation
   */
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
   * LINE VARIATION FUNCTIONS
   * Each returns the next point [x, y] given current state
   */

  /**
   * V0: Straight line - the fundamental
   */
  _varStraight(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    return [
      x + r * Math.cos(theta),
      y + r * Math.sin(theta),
      theta
    ];
  }

  /**
   * V1: Wavy line - sinusoidal oscillation
   */
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

  /**
   * V2: Curved - gradually changing direction
   */
  _varCurved(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const curveRate = params.curveRate || 0.05;
    const newTheta = theta + curveRate;

    return [
      x + r * Math.cos(newTheta),
      y + r * Math.sin(newTheta),
      newTheta
    ];
  }

  /**
   * V3: Spiral - rotating and expanding/contracting
   */
  _varSpiral(x, y, theta, step, total, params) {
    let r = params.stepLength || this.stepLength;
    const spiralFactor = params.spiralFactor || 1.02;
    const spiralRate = params.spiralRate || 0.1;

    r *= Math.pow(spiralFactor, step / 10);
    const newTheta = theta + spiralRate;

    return [
      x + r * Math.cos(newTheta),
      y + r * Math.sin(newTheta),
      newTheta
    ];
  }

  /**
   * V4: Zigzag - sharp angular changes
   */
  _varZigzag(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const zigzagAngle = params.zigzagAngle || Math.PI / 4;
    const newTheta = theta + (Math.random() < 0.5 ? zigzagAngle : -zigzagAngle);

    return [
      x + r * Math.cos(newTheta),
      y + r * Math.sin(newTheta),
      newTheta
    ];
  }

  /**
   * V5: Organic - Perlin noise perturbation
   */
  _varOrganic(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const noiseScale = params.noiseScale || 0.1;
    const noiseAmount = params.noiseAmount || 0.5;

    const n = this.noise(step * noiseScale);
    const rPerturbation = r * (1 + n * noiseAmount * 0.3);
    const thetaPerturbation = theta + n * noiseAmount;

    return [
      x + rPerturbation * Math.cos(thetaPerturbation),
      y + rPerturbation * Math.sin(thetaPerturbation),
      theta + n * 0.1
    ];
  }

  /**
   * V6: Rhythmic - pulsing length
   */
  _varRhythmic(x, y, theta, step, total, params) {
    const baseR = params.stepLength || this.stepLength;
    const frequency = params.frequency || 0.2;
    const progress = step / total;
    const r = baseR * (1 + 0.5 * Math.sin(progress * frequency * Math.PI * 30));

    return [
      x + r * Math.cos(theta),
      y + r * Math.sin(theta),
      theta
    ];
  }

  /**
   * V7: Circular - moving in circles
   */
  _varCircular(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const circleRate = params.circleRate || 0.2;
    const newTheta = theta + circleRate;

    return [
      x + r * Math.cos(newTheta),
      y + r * Math.sin(newTheta),
      newTheta
    ];
  }

  /**
   * V8: Dotted - intermittent drawing
   * (handled in rendering, returns normal straight)
   */
  _varDotted(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    return [
      x + r * Math.cos(theta),
      y + r * Math.sin(theta),
      theta
    ];
  }

  /**
   * V9: Looping - figure-eight pattern
   */
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

  /**
   * V10: Angular - discrete angle steps
   */
  _varAngular(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const angleSteps = params.angleSteps || 8;
    const angleIncrement = (Math.PI * 2) / angleSteps;

    if (step % 5 === 0) {
      theta = Math.round(theta / angleIncrement) * angleIncrement;
      theta += (Math.random() < 0.5 ? angleIncrement : -angleIncrement);
    }

    return [
      x + r * Math.cos(theta),
      y + r * Math.sin(theta),
      theta
    ];
  }

  /**
   * V11: Gravitational - attracted to center
   */
  _varGravitational(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const centerX = params.centerX || this.width / 2;
    const centerY = params.centerY || this.height / 2;
    const gravity = params.gravity || 0.05;

    const dx = centerX - x;
    const dy = centerY - y;
    const angleToCenter = Math.atan2(dy, dx);

    const newTheta = theta + (angleToCenter - theta) * gravity;

    return [
      x + r * Math.cos(newTheta),
      y + r * Math.sin(newTheta),
      newTheta
    ];
  }

  /**
   * V12: Repelling - avoiding center
   */
  _varRepelling(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const centerX = params.centerX || this.width / 2;
    const centerY = params.centerY || this.height / 2;
    const repulsion = params.repulsion || 0.1;

    const dx = x - centerX;
    const dy = y - centerY;
    const angleFromCenter = Math.atan2(dy, dx);

    const newTheta = theta + (angleFromCenter - theta) * repulsion;

    return [
      x + r * Math.cos(newTheta),
      y + r * Math.sin(newTheta),
      newTheta
    ];
  }

  /**
   * V13: Trembling - rapid small oscillations
   */
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

  /**
   * V14: Branching - creates split paths
   * (handled in growth logic, returns straight)
   */
  _varBranching(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    return [
      x + r * Math.cos(theta),
      y + r * Math.sin(theta),
      theta
    ];
  }

  /**
   * V15: Explosive - radiating outward with acceleration
   */
  _varExplosive(x, y, theta, step, total, params) {
    let r = params.stepLength || this.stepLength;
    const acceleration = params.acceleration || 1.05;

    r *= Math.pow(acceleration, step / 5);

    return [
      x + r * Math.cos(theta),
      y + r * Math.sin(theta),
      theta
    ];
  }

  /**
   * V16: Meandering - lazy river-like curves
   */
  _varMeandering(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const meander = params.meander || 0.02;

    const newTheta = theta + Math.sin(step * 0.1) * meander;

    return [
      x + r * Math.cos(newTheta),
      y + r * Math.sin(newTheta),
      newTheta
    ];
  }

  /**
   * V17: Chaotic - unpredictable jumps
   */
  _varChaotic(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const chaos = params.chaos || 0.5;

    const newTheta = theta + (Math.random() - 0.5) * Math.PI * chaos;
    const newR = r * (0.5 + Math.random());

    return [
      x + newR * Math.cos(newTheta),
      y + newR * Math.sin(newTheta),
      newTheta
    ];
  }

  /**
   * V18: Harmonic - multiple frequency overlay
   */
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

  /**
   * V19: Crystalline - geometric lattice movements
   */
  _varCrystalline(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const latticeAngle = params.latticeAngle || Math.PI / 3;

    if (step % 3 === 0) {
      const options = [-latticeAngle, 0, latticeAngle];
      theta += options[Math.floor(Math.random() * options.length)];
    }

    return [
      x + r * Math.cos(theta),
      y + r * Math.sin(theta),
      theta
    ];
  }

  /**
   * V20: Twittering - inspired by "Twittering Machine"
   */
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

  /**
   * V21: Corporeal - blob-forming tendency
   */
  _varCorporeal(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const progress = step / total;

    // Create tendency to loop back
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

  /**
   * V22: Architectural - grid-based with right angles
   */
  _varArchitectural(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength * 2;

    if (step % 5 === 0) {
      // Snap to cardinal directions
      const cardinal = Math.round(theta / (Math.PI / 2)) * (Math.PI / 2);
      theta = cardinal;

      if (Math.random() < 0.3) {
        theta += Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1);
      }
    }

    return [
      x + r * Math.cos(theta),
      y + r * Math.sin(theta),
      theta
    ];
  }

  /**
   * V23: Flowing - water-like smooth curves
   */
  _varFlowing(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const flow = params.flow || 0.03;

    const newTheta = theta + Math.sin(step * 0.2) * flow;

    return [
      x + r * Math.cos(newTheta),
      y + r * Math.sin(newTheta),
      newTheta
    ];
  }

  /**
   * V24: Mechanical - precise geometric patterns
   */
  _varMechanical(x, y, theta, step, total, params) {
    const r = params.stepLength || this.stepLength;
    const gearSteps = params.gearSteps || 12;

    if (step % gearSteps === 0) {
      theta += Math.PI / 6;
    }

    return [
      x + r * Math.cos(theta),
      y + r * Math.sin(theta),
      theta
    ];
  }

  /**
   * V25: Mythical - dragon-like curves
   */
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

  /**
   * Get variation function by name
   */
  _getVariationFunction(name) {
    const variations = {
      straight: this._varStraight,
      wavy: this._varWavy,
      curved: this._varCurved,
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

  /**
   * Select variation based on weighted probabilities
   */
  _selectVariation(variations) {
    const total = Object.values(variations).reduce((sum, w) => sum + w, 0);
    let rand = Math.random() * total;

    for (let [name, weight] of Object.entries(variations)) {
      rand -= weight;
      if (rand <= 0) return name;
    }

    return Object.keys(variations)[0];
  }

  /**
   * Grow a single line from a seed
   */
  _growLine(seed, lineIndex, totalLines) {
    const points = [];
    let x = seed.x;
    let y = seed.y;
    let theta = seed.angle;

    const steps = this.maxSteps + Math.floor(Math.random() * 200 - 100);
    const settleSteps = 5;

    for (let step = 0; step < steps; step++) {
      // Select variation
      const varName = this._selectVariation(seed.variations);
      const varFunc = this._getVariationFunction(varName);

      // Generate next point
      const [newX, newY, newTheta] = varFunc.call(
        this, x, y, theta, step, steps, seed.params
      );

      // Skip settling steps
      if (step >= settleSteps) {
        // Boundary check
        if (newX >= 0 && newX < this.width && newY >= 0 && newY < this.height) {
          points.push([newX, newY]);

          // Update density grid
          this._updateDensityGrid(newX, newY);
        } else {
          // Out of bounds - stop or reflect
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

      // Check for branching
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

  /**
   * Create a branch from an existing line
   */
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

  /**
   * Update density grid for form detection
   */
  _updateDensityGrid(x, y) {
    if (!this.densityGrid) return;

    const cellX = Math.floor(x / this.width * this.gridResolution);
    const cellY = Math.floor(y / this.height * this.gridResolution);

    if (cellX >= 0 && cellX < this.gridResolution && cellY >= 0 && cellY < this.gridResolution) {
      const index = cellY * this.gridResolution + cellX;
      this.densityGrid[index]++;
    }
  }

  /**
   * Apply symmetry transformation to a line
   */
  _applySymmetry(line, symmetry, centerX, centerY) {
    if (symmetry === 0) return [line];

    const symmetricLines = [line];

    if (symmetry === 2) {
      // Mirror symmetry
      const mirrored = {
        ...line,
        points: line.points.map(([x, y]) => [
          centerX + (centerX - x),
          y
        ])
      };
      symmetricLines.push(mirrored);
    } else if (symmetry > 2) {
      // Rotational symmetry
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
   * Detect corporeal forms from density grid
   */
  _detectForms() {
    if (!this.densityGrid) return;

    const threshold = 3; // minimum density to be considered a form
    const visited = new Uint8Array(this.gridResolution * this.gridResolution);

    for (let y = 0; y < this.gridResolution; y++) {
      for (let x = 0; x < this.gridResolution; x++) {
        const index = y * this.gridResolution + x;

        if (this.densityGrid[index] >= threshold && !visited[index]) {
          const form = this._floodFillForm(x, y, threshold, visited);
          if (form.cells.length > 5) {
            this.forms.push(form);
          }
        }
      }
    }
  }

  /**
   * Flood fill to find connected high-density regions
   */
  _floodFillForm(startX, startY, threshold, visited) {
    const cells = [];
    const queue = [[startX, startY]];

    while (queue.length > 0) {
      const [x, y] = queue.shift();
      const index = y * this.gridResolution + x;

      if (x < 0 || x >= this.gridResolution || y < 0 || y >= this.gridResolution) continue;
      if (visited[index]) continue;
      if (this.densityGrid[index] < threshold) continue;

      visited[index] = 1;
      cells.push([x, y]);

      // Add neighbors
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    // Calculate form properties
    const avgX = cells.reduce((sum, [x]) => sum + x, 0) / cells.length;
    const avgY = cells.reduce((sum, [, y]) => sum + y, 0) / cells.length;

    return {
      cells,
      centerX: (avgX / this.gridResolution) * this.width,
      centerY: (avgY / this.gridResolution) * this.height,
      density: cells.reduce((sum, [x, y]) =>
        sum + this.densityGrid[y * this.gridResolution + x], 0) / cells.length
    };
  }

  /**
   * Generate the complete artwork
   */
  generateArtwork(options = {}) {
    // Setup
    this.width = options.width || 1024;
    this.height = options.height || 1024;
    this.maxSteps = options.steps || 500;
    this.stepLength = options.stepLength || 5;

    // Initialize density grid
    this.densityGrid = new Float32Array(this.gridResolution * this.gridResolution);

    // Reset state
    this.lines = [];
    this.forms = [];

    // Generate lines from each seed
    const totalLines = this.seeds.length * 10;

    for (let seed of this.seeds) {
      const linesForSeed = Math.floor(Math.random() * 5) + 3;

      for (let i = 0; i < linesForSeed; i++) {
        const line = this._growLine(seed, this.lines.length, totalLines);

        if (line.points.length > 10) {
          // Apply symmetry
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

    // Detect forms
    this._detectForms();

    return {
      lines: this.lines,
      forms: this.forms,
      width: this.width,
      height: this.height
    };
  }

  /**
   * Render artwork to canvas
   */
  render(canvasElement, options = {}) {
    const ctx = canvasElement.getContext('2d');

    // Set canvas size
    canvasElement.width = this.width;
    canvasElement.height = this.height;

    // Background
    const bgColor = options.background || '#F5F1E8'; // Klee's typical paper tone
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, this.width, this.height);

    // Render forms first (background)
    if (options.showForms !== false) {
      this._renderForms(ctx, options);
    }

    // Render lines
    this._renderLines(ctx, options);

    // Post-processing
    if (options.texture) {
      this._applyTexture(ctx, options.texture);
    }
  }

  /**
   * Render detected forms
   */
  _renderForms(ctx, options) {
    for (let form of this.forms) {
      // Convert cells to polygon
      const cellSize = this.width / this.gridResolution;

      // Simple approach: draw filled rectangles for each cell
      ctx.globalAlpha = 0.2;

      const colorIndex = Math.floor(form.centerX / this.width * this.palette.length);
      ctx.fillStyle = this.palette[colorIndex % this.palette.length];

      for (let [x, y] of form.cells) {
        const px = x * cellSize;
        const py = y * cellSize;
        ctx.fillRect(px, py, cellSize, cellSize);
      }

      ctx.globalAlpha = 1;
    }
  }

  /**
   * Render lines
   */
  _renderLines(ctx, options) {
    const lineWidth = options.lineWidth || 1.5;
    const alpha = options.lineAlpha !== undefined ? options.lineAlpha : 0.8;

    for (let line of this.lines) {
      if (line.points.length < 2) continue;

      ctx.beginPath();
      ctx.moveTo(line.points[0][0], line.points[0][1]);

      for (let i = 1; i < line.points.length; i++) {
        const [x, y] = line.points[i];

        // Handle dotted variation
        if (line.variation === 'dotted' && i % 3 === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      // Color based on seed
      const colorIndex = Math.floor(line.colorIndex * this.palette.length);
      ctx.strokeStyle = this.palette[colorIndex % this.palette.length];
      ctx.lineWidth = lineWidth * (0.5 + Math.random() * 0.5);
      ctx.globalAlpha = alpha;
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  /**
   * Apply texture overlay
   */
  _applyTexture(ctx, intensity = 0.05) {
    const imageData = ctx.getImageData(0, 0, this.width, this.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * intensity * 255;
      data[i] += noise;     // R
      data[i + 1] += noise; // G
      data[i + 2] += noise; // B
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Export as data URL
   */
  export(canvasElement, format = 'image/png') {
    return canvasElement.toDataURL(format);
  }

  /**
   * Save configuration as JSON
   */
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

  /**
   * Load configuration from JSON
   */
  loadConfig(jsonString) {
    const config = JSON.parse(jsonString);
    this.seeds = config.seeds || [];
    this.palette = config.palette || [];
    this.width = config.width || 1024;
    this.height = config.height || 1024;
    this.stepLength = config.stepLength || 5;
    this.maxSteps = config.maxSteps || 500;
  }

  /**
   * Generate random artwork with theme
   */
  generateRandom(theme = 'organic') {
    this.seeds = [];

    const themes = {
      organic: {
        variations: ['organic', 'flowing', 'corporeal', 'meandering'],
        seedCount: [3, 7],
        symmetry: [0, 2],
        palette: 'natural'
      },
      architectural: {
        variations: ['architectural', 'angular', 'mechanical', 'straight'],
        seedCount: [4, 8],
        symmetry: [2, 4, 8],
        palette: 'geometric'
      },
      mythical: {
        variations: ['mythical', 'twittering', 'looping', 'harmonic'],
        seedCount: [2, 5],
        symmetry: [2, 3, 5],
        palette: 'vibrant'
      },
      chaotic: {
        variations: ['chaotic', 'explosive', 'trembling', 'zigzag'],
        seedCount: [5, 12],
        symmetry: [0],
        palette: 'contrast'
      },
      meditative: {
        variations: ['circular', 'flowing', 'rhythmic', 'wavy'],
        seedCount: [2, 4],
        symmetry: [3, 4, 6, 8],
        palette: 'harmonious'
      }
    };

    const config = themes[theme] || themes.organic;
    const seedCount = config.seedCount[0] +
      Math.floor(Math.random() * (config.seedCount[1] - config.seedCount[0]));

    for (let i = 0; i < seedCount; i++) {
      const variation = config.variations[
        Math.floor(Math.random() * config.variations.length)
      ];

      const variations = {};
      variations[variation] = 0.7;

      // Add a secondary variation
      const secondary = config.variations[
        Math.floor(Math.random() * config.variations.length)
      ];
      variations[secondary] = 0.3;

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
          frequency: 0.1 + Math.random() * 0.3
        }
      });
    }

    return this.generateArtwork();
  }
}

// Export for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KleeEngine;
}
