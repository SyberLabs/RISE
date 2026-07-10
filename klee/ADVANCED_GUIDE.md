# Klee Engine - Advanced Guide

This guide covers advanced techniques, mathematical foundations, and deep customization of the Klee Engine.

## Table of Contents

1. [Mathematical Foundations](#mathematical-foundations)
2. [Variation Algorithm Design](#variation-algorithm-design)
3. [Form Detection Deep Dive](#form-detection-deep-dive)
4. [Color Theory Implementation](#color-theory-implementation)
5. [Performance Profiling](#performance-profiling)
6. [Custom Rendering Pipelines](#custom-rendering-pipelines)
7. [Advanced Examples](#advanced-examples)

## Mathematical Foundations

### Line Walking Mathematics

A line in the Klee Engine is a sequence of points P₀, P₁, P₂, ... generated iteratively:

```
P₀ = (x₀, y₀)              // Initial seed position
θ₀ = initial angle         // Initial direction

For step i:
  V = variation_function(Pᵢ, θᵢ, i)
  Pᵢ₊₁ = Pᵢ + V
  θᵢ₊₁ = updated angle
```

### Variation Function Structure

Each variation function returns a transformation vector:

```javascript
function variation(x, y, θ, step, totalSteps, params) {
  // 1. Calculate step length (may be dynamic)
  let r = params.stepLength || defaultLength;

  // 2. Apply variation-specific logic
  // - Modify r (distance)
  // - Modify θ (direction)
  // - Add noise/oscillation

  // 3. Return next position
  return [
    x + r * cos(θ),  // new x
    y + r * sin(θ),  // new y
    θ                // updated angle
  ];
}
```

### Perlin Noise Implementation

The engine uses a simplified 1D Perlin noise:

```javascript
// Initialize random gradient table
noiseTable[256] = random values in [-1, 1]

// Query noise at position x
function noise(x) {
  i = floor(x) mod 256         // Integer part
  f = x - floor(x)             // Fractional part
  u = smoothstep(f)            // Smooth interpolation

  a = noiseTable[i]
  b = noiseTable[i + 1]

  return lerp(a, b, u)         // Linear interpolation
}

// Smoothstep: f(t) = 3t² - 2t³
```

**Properties:**
- Continuous (no sharp jumps)
- Bounded [-1, 1]
- Pseudo-random appearance

**Multi-octave extension** (not implemented):
```javascript
function multiOctaveNoise(x, octaves = 4) {
  let total = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += noise(x * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return total / maxValue;
}
```

### Symmetry Transformations

#### Mirror Symmetry (2-way)

Reflect points across vertical axis through center:

```
x' = centerX + (centerX - x)
y' = y
```

#### Rotational Symmetry (n-way)

For n-fold symmetry, generate n-1 rotated copies:

```
For each copy k = 1 to n-1:
  θₖ = 2π * k / n

  For each point (x, y):
    dx = x - centerX
    dy = y - centerY

    x'ₖ = centerX + dx * cos(θₖ) - dy * sin(θₖ)
    y'ₖ = centerY + dx * sin(θₖ) + dy * cos(θₖ)
```

**Example:** 6-fold symmetry creates snowflake patterns.

## Variation Algorithm Design

### Design Principles

When creating custom variations, consider:

1. **Continuity**: Avoid sudden jumps (unless intentional, like 'chaotic')
2. **Boundedness**: Keep step length reasonable to avoid canvas overflow
3. **Parameterization**: Make amplitude/frequency adjustable
4. **Composability**: Should work well when mixed with other variations

### Anatomy of a Variation

```javascript
_varMyVariation(x, y, theta, step, total, params) {
  // SECTION 1: Parameter extraction
  const r = params.stepLength || this.stepLength;
  const myParam = params.myParam || defaultValue;

  // SECTION 2: Progress calculation
  const progress = step / total;  // 0 to 1

  // SECTION 3: Core logic
  // Modify theta (direction)
  const thetaOffset = someFunction(step, myParam);
  const newTheta = theta + thetaOffset;

  // Modify r (distance)
  const rScale = otherFunction(progress);
  const newR = r * rScale;

  // SECTION 4: Position calculation
  const newX = x + newR * Math.cos(newTheta);
  const newY = y + newR * Math.sin(newTheta);

  // SECTION 5: Return
  return [newX, newY, newTheta];
}
```

### Example: Lissajous Curve Variation

Create figure-eight and complex loops:

```javascript
_varLissajous(x, y, theta, step, total, params) {
  const r = params.stepLength || this.stepLength;
  const progress = step / total;

  // Lissajous parameters
  const A = params.amplitudeX || 50;
  const B = params.amplitudeY || 50;
  const a = params.frequencyX || 3;
  const b = params.frequencyY || 2;
  const delta = params.phase || Math.PI / 2;

  // Parametric Lissajous curve
  const t = progress * Math.PI * 2;
  const lx = A * Math.sin(a * t + delta);
  const ly = B * Math.sin(b * t);

  // Add to current position
  return [x + lx * 0.1, y + ly * 0.1, theta];
}
```

### Example: Reaction-Diffusion Variation

Simulate reaction-diffusion patterns:

```javascript
_varReactionDiffusion(x, y, theta, step, total, params) {
  const r = params.stepLength || this.stepLength;

  // Simplified Gray-Scott model
  const u = params.u || 0.5;
  const v = params.v || 0.25;
  const f = params.feed || 0.04;
  const k = params.kill || 0.06;

  // Update concentrations
  const uvv = u * v * v;
  const du = -uvv + f * (1 - u);
  const dv = uvv - (f + k) * v;

  // Use concentrations to influence direction
  const thetaOffset = (du - dv) * 0.5;

  return [
    x + r * Math.cos(theta + thetaOffset),
    y + r * Math.sin(theta + thetaOffset),
    theta + thetaOffset * 0.1
  ];
}
```

## Form Detection Deep Dive

### Density Grid Mechanism

The engine maintains a 2D grid overlaying the canvas:

```javascript
gridResolution = 50
cellSize = canvasWidth / gridResolution

// For each line point (x, y):
cellX = floor(x / cellSize)
cellY = floor(y / cellSize)
index = cellY * gridResolution + cellX
densityGrid[index]++
```

**Complexity:** O(1) per point insertion, O(n) total for n points.

### Flood Fill Algorithm

Detects connected regions of high density:

```javascript
function floodFill(startX, startY, threshold, visited) {
  const cells = [];
  const queue = [[startX, startY]];

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const index = y * gridResolution + x;

    // Boundary check
    if (x < 0 || x >= gridResolution ||
        y < 0 || y >= gridResolution) continue;

    // Already visited
    if (visited[index]) continue;

    // Below threshold
    if (densityGrid[index] < threshold) continue;

    // Mark as visited and add to form
    visited[index] = 1;
    cells.push([x, y]);

    // Add neighbors (4-connectivity)
    queue.push([x+1, y], [x-1, y], [x, y+1], [x, y-1]);
  }

  return cells;
}
```

**Complexity:** O(m) where m = number of cells in form.

### Advanced Form Detection Methods

#### Convex Hull

Extract outer boundary of point cloud:

```javascript
// Graham scan algorithm
function convexHull(points) {
  // 1. Find lowest point (anchor)
  const anchor = points.reduce((min, p) =>
    p[1] < min[1] ? p : min
  );

  // 2. Sort by polar angle from anchor
  const sorted = points.sort((a, b) => {
    const angleA = Math.atan2(a[1] - anchor[1], a[0] - anchor[0]);
    const angleB = Math.atan2(b[1] - anchor[1], b[0] - anchor[0]);
    return angleA - angleB;
  });

  // 3. Build hull with stack
  const hull = [sorted[0], sorted[1]];

  for (let i = 2; i < sorted.length; i++) {
    while (hull.length >= 2 &&
           !isLeftTurn(hull[hull.length-2], hull[hull.length-1], sorted[i])) {
      hull.pop();
    }
    hull.push(sorted[i]);
  }

  return hull;
}

function isLeftTurn(p1, p2, p3) {
  return ((p2[0] - p1[0]) * (p3[1] - p1[1]) -
          (p2[1] - p1[1]) * (p3[0] - p1[0])) > 0;
}
```

#### Alpha Shapes

More nuanced than convex hull, captures concave features:

```javascript
// Requires Delaunay triangulation
// Omitted for brevity - use libraries like d3-delaunay
```

#### Contour Tracing

Extract boundary pixels using marching squares:

```javascript
function traceContour(densityGrid, threshold) {
  // Marching squares algorithm
  // Generates polygonal outline of density region
}
```

## Color Theory Implementation

### Klee's Color Principles

1. **Complementary Contrast**: Opposite hues (180° apart on color wheel)
2. **Warm-Cool Balance**: Warm (red, orange, yellow) vs Cool (blue, green, purple)
3. **Light-Dark**: Tints and shades for depth
4. **Saturation**: Pure colors vs muted tones

### HSL Color Space

The engine uses HSL (Hue, Saturation, Lightness):

```
Hue: 0-360° (color wheel position)
Saturation: 0-100% (grayness to pure color)
Lightness: 0-100% (black to white)
```

**Advantages:**
- Intuitive for artists
- Easy to generate harmonies
- Simple tint/shade generation

**Conversion to RGB:**

```javascript
function hslToRgb(h, s, l) {
  h = h / 360;  // Normalize to [0, 1]

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

  const r = hue2rgb(p, q, h + 1/3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1/3);

  return [r * 255, g * 255, b * 255];
}
```

### Procedural Palette Generation

#### Analogous Colors

Colors adjacent on wheel (30° apart):

```javascript
function generateAnalogous(baseHue, count = 5) {
  const palette = [];
  for (let i = 0; i < count; i++) {
    const hue = (baseHue + i * 30) % 360;
    palette.push(hslToRgb(hue, 0.7, 0.5));
  }
  return palette;
}
```

#### Triadic Colors

Evenly spaced (120° apart):

```javascript
function generateTriadic(baseHue) {
  return [
    hslToRgb(baseHue, 0.7, 0.5),
    hslToRgb((baseHue + 120) % 360, 0.7, 0.5),
    hslToRgb((baseHue + 240) % 360, 0.7, 0.5)
  ];
}
```

#### Monochromatic

Single hue with varying saturation/lightness:

```javascript
function generateMonochromatic(hue, count = 7) {
  const palette = [];
  for (let i = 0; i < count; i++) {
    const lightness = 0.2 + (i / count) * 0.6;
    palette.push(hslToRgb(hue, 0.6, lightness));
  }
  return palette;
}
```

### Color Blending at Intersections

When lines cross, blend their colors:

```javascript
function blendColors(color1, color2, ratio = 0.5) {
  // Convert to RGB
  const [r1, g1, b1] = parseRgb(color1);
  const [r2, g2, b2] = parseRgb(color2);

  // Linear interpolation
  const r = r1 * (1 - ratio) + r2 * ratio;
  const g = g1 * (1 - ratio) + g2 * ratio;
  const b = b1 * (1 - ratio) + b2 * ratio;

  return `rgb(${r},${g},${b})`;
}
```

## Performance Profiling

### Timing Analysis

```javascript
console.time('generation');
engine.generateArtwork({ steps: 1000 });
console.timeEnd('generation');
// Typical: 50-200ms for 10 seeds

console.time('rendering');
engine.render(canvas);
console.timeEnd('rendering');
// Typical: 20-100ms for 1000 lines
```

### Memory Profiling

```javascript
const before = performance.memory.usedJSHeapSize;
engine.generateArtwork({ steps: 2000 });
const after = performance.memory.usedJSHeapSize;
console.log(`Memory used: ${(after - before) / 1024 / 1024} MB`);
```

### Bottleneck Identification

Most expensive operations:

1. **Line generation**: O(n × s) where n=seeds, s=steps
2. **Intersection detection**: O(n²) naive, O(n) with grid
3. **Rendering**: O(m) where m=total points
4. **Form detection**: O(g²) where g=grid resolution

### Optimization Strategies

#### 1. Reduce Iterations

```javascript
// Trade detail for speed
engine.generateArtwork({ steps: 250 });  // Instead of 500
```

#### 2. Lower Grid Resolution

```javascript
engine.gridResolution = 25;  // Instead of 50
// 4x faster form detection, less precise
```

#### 3. Skip Form Detection

```javascript
engine.render(canvas, { showForms: false });
// Saves flood-fill computation
```

#### 4. Batch Rendering

Already implemented - all lines drawn in single context state.

## Custom Rendering Pipelines

### Multi-Layer Rendering

Create depth effect with layers:

```javascript
function renderLayered(engine, canvas) {
  const ctx = canvas.getContext('2d');

  // Layer 1: Background forms
  ctx.globalAlpha = 0.1;
  engine._renderForms(ctx, {});

  // Layer 2: Background lines
  ctx.globalAlpha = 0.3;
  const backgroundLines = engine.lines.filter((_, i) => i % 3 === 0);
  renderLines(ctx, backgroundLines);

  // Layer 3: Foreground lines
  ctx.globalAlpha = 0.9;
  const foregroundLines = engine.lines.filter((_, i) => i % 3 !== 0);
  renderLines(ctx, foregroundLines);
}
```

### Watercolor Effect

Simulate watercolor bleeding:

```javascript
function renderWatercolor(engine, canvas) {
  const ctx = canvas.getContext('2d');

  for (let form of engine.forms) {
    // Multiple semi-transparent layers
    for (let layer = 0; layer < 5; layer++) {
      ctx.globalAlpha = 0.05;

      // Slightly offset each layer
      const offset = layer * 2;

      ctx.fillStyle = getFormColor(form);
      ctx.beginPath();
      for (let [x, y] of form.cells) {
        const px = x * cellSize + offset;
        const py = y * cellSize + offset;
        ctx.rect(px, py, cellSize, cellSize);
      }
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}
```

### Sketch Effect

Multiple passes with jitter:

```javascript
function renderSketch(engine, canvas) {
  const ctx = canvas.getContext('2d');

  for (let pass = 0; pass < 3; pass++) {
    ctx.globalAlpha = 0.3;

    for (let line of engine.lines) {
      ctx.beginPath();

      for (let i = 0; i < line.points.length; i++) {
        const [x, y] = line.points[i];

        // Add jitter
        const jx = x + (Math.random() - 0.5) * 2;
        const jy = y + (Math.random() - 0.5) * 2;

        if (i === 0) ctx.moveTo(jx, jy);
        else ctx.lineTo(jx, jy);
      }

      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
}
```

### Export to SVG

For vector output:

```javascript
function exportSVG(engine) {
  let svg = `<svg width="${engine.width}" height="${engine.height}" xmlns="http://www.w3.org/2000/svg">`;

  // Forms as polygons
  for (let form of engine.forms) {
    const points = form.cells.map(([x, y]) =>
      `${x * cellSize},${y * cellSize}`
    ).join(' ');

    svg += `<polygon points="${points}" fill="${getFormColor(form)}" opacity="0.2"/>`;
  }

  // Lines as polylines
  for (let line of engine.lines) {
    const points = line.points.map(([x, y]) =>
      `${x},${y}`
    ).join(' ');

    svg += `<polyline points="${points}" stroke="${getLineColor(line)}" fill="none" stroke-width="1.5"/>`;
  }

  svg += '</svg>';
  return svg;
}
```

## Advanced Examples

### Example: Animated Growth

```javascript
let step = 0;
const maxSteps = 500;

function animate() {
  if (step >= maxSteps) return;

  // Generate partial artwork
  engine.maxSteps = step;
  engine.generateArtwork();
  engine.render(canvas);

  step += 5;
  requestAnimationFrame(animate);
}

animate();
```

### Example: Interactive Seed Placement

```javascript
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  engine.addSeed({
    x: x * (engine.width / canvas.clientWidth),
    y: y * (engine.height / canvas.clientHeight),
    variations: { organic: 0.7, wavy: 0.3 },
    colorIndex: Math.random()
  });

  engine.generateArtwork();
  engine.render(canvas);
});
```

### Example: Music Visualization

```javascript
// Requires Web Audio API
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();

function visualizeAudio() {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  // Use frequency data to influence generation
  const avgFreq = dataArray.reduce((a, b) => a + b) / dataArray.length;

  engine.stepLength = 3 + avgFreq / 50;

  engine.addSeed({
    variations: {
      wavy: dataArray[0] / 255,
      spiral: dataArray[50] / 255,
      organic: dataArray[100] / 255
    },
    params: {
      amplitude: dataArray[0] / 255,
      frequency: dataArray[50] / 510
    }
  });

  engine.generateArtwork({ steps: 100 });
  engine.render(canvas);

  requestAnimationFrame(visualizeAudio);
}
```

### Example: Parameter Evolution

Genetic algorithm for aesthetic optimization:

```javascript
class GeneticOptimizer {
  constructor(populationSize = 20) {
    this.population = [];
    this.populationSize = populationSize;
  }

  // Initialize random population
  initializePopulation() {
    for (let i = 0; i < this.populationSize; i++) {
      this.population.push(this.randomGenome());
    }
  }

  randomGenome() {
    return {
      seeds: Math.floor(Math.random() * 8) + 2,
      steps: Math.floor(Math.random() * 1000) + 200,
      variations: {
        organic: Math.random(),
        wavy: Math.random(),
        spiral: Math.random()
      },
      symmetry: [0, 2, 3, 4, 6, 8][Math.floor(Math.random() * 6)]
    };
  }

  // User rates artwork (fitness function)
  evaluate(genome, rating) {
    genome.fitness = rating;
  }

  // Select top performers
  select() {
    this.population.sort((a, b) => b.fitness - a.fitness);
    return this.population.slice(0, this.populationSize / 2);
  }

  // Crossover and mutation
  evolve() {
    const survivors = this.select();
    const offspring = [];

    for (let i = 0; i < survivors.length; i += 2) {
      const parent1 = survivors[i];
      const parent2 = survivors[i + 1] || survivors[0];

      // Crossover
      const child = {
        seeds: Math.random() < 0.5 ? parent1.seeds : parent2.seeds,
        steps: Math.random() < 0.5 ? parent1.steps : parent2.steps,
        variations: { ...parent1.variations },
        symmetry: Math.random() < 0.5 ? parent1.symmetry : parent2.symmetry
      };

      // Mutation (10% chance)
      if (Math.random() < 0.1) {
        child.steps += Math.floor((Math.random() - 0.5) * 200);
      }

      offspring.push(child);
    }

    this.population = [...survivors, ...offspring];
  }

  generateFromGenome(genome) {
    const engine = new KleeEngine();

    for (let i = 0; i < genome.seeds; i++) {
      engine.addSeed({
        variations: genome.variations,
        symmetry: genome.symmetry
      });
    }

    engine.generateArtwork({ steps: genome.steps });
    return engine;
  }
}

// Usage
const optimizer = new GeneticOptimizer();
optimizer.initializePopulation();

// Show artwork, user rates it, evolve
for (let generation = 0; generation < 10; generation++) {
  for (let genome of optimizer.population) {
    const engine = optimizer.generateFromGenome(genome);
    engine.render(canvas);

    const rating = getUserRating();  // 1-10 scale
    optimizer.evaluate(genome, rating);
  }

  optimizer.evolve();
}
```

### Example: Multi-Canvas Composition

Create diptych or triptych:

```javascript
function createTriptych(canvas1, canvas2, canvas3) {
  const engines = [
    new KleeEngine(),
    new KleeEngine(),
    new KleeEngine()
  ];

  // Shared palette
  const palette = generateAnalogous(Math.random() * 360, 20);
  engines.forEach(e => e.setPalette(palette));

  // Complementary themes
  engines[0].generateRandom('organic');
  engines[1].generateRandom('meditative');
  engines[2].generateRandom('organic');

  engines[0].generateArtwork();
  engines[1].generateArtwork();
  engines[2].generateArtwork();

  engines[0].render(canvas1);
  engines[1].render(canvas2);
  engines[2].render(canvas3);
}
```

## Conclusion

The Klee Engine provides a foundation for exploring procedural art generation. By understanding its mathematical underpinnings and architectural patterns, you can extend it in limitless directions—from 3D visualizations to real-time generative music visualizations to evolutionary art systems.

The key is experimentation. Klee himself emphasized intuition and play. Let the code be your sketchbook.

---

**"Art does not reproduce the visible; rather, it makes visible."** - Paul Klee
