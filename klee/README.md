# Klee Engine - Procedural Art Generator

![Klee Engine](https://img.shields.io/badge/version-1.0.0-blue)
![JavaScript](https://img.shields.io/badge/language-JavaScript%20ES6+-yellow)
![License](https://img.shields.io/badge/license-MIT-green)

> "A line is a dot that went for a walk" - Paul Klee

A sophisticated procedural art generation engine inspired by Paul Klee's artistic philosophy, where lines are dynamic forces that give birth to corporeal forms. Built with pure JavaScript and HTML5 Canvas API, no external dependencies required.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Line Variations](#line-variations)
- [Examples](#examples)
- [Extending the Engine](#extending-the-engine)
- [Technical Details](#technical-details)
- [Performance Optimization](#performance-optimization)
- [Future Enhancements](#future-enhancements)

## Overview

The Klee Engine generates abstract artworks through procedural line generation that evolves into organic, corporeal forms. It implements Paul Klee's teachings from his *Pedagogical Sketchbook*, treating lines as paths of movement, points as origins, and planes as emergent bodies.

### Core Philosophy

1. **Lines as Active Forces**: Lines "walk" through space following procedural rules
2. **Emergence**: Complex forms arise from simple iterative processes
3. **Color Harmony**: Complementary colors and warm/cool balance
4. **Composition Balance**: Symmetry, rhythm, and controlled randomness

## Features

### Line Generation
- **25 parametric variation algorithms** including:
  - Organic (Perlin noise-based)
  - Geometric (architectural, angular)
  - Dynamic (spiral, explosive)
  - Artistic (twittering, mythical)
- **Weighted variation mixing**: Combine multiple behaviors
- **Branching logic**: Lines spawn children with modified parameters

### Form Detection
- **Density-based form discovery**: Tracks line intersections
- **Flood-fill clustering**: Groups high-density regions
- **Corporeal shape approximation**: Converts clusters to renderable forms

### Visual Features
- **Symmetry transformations**: Mirror and rotational (2-8 way)
- **Color palette generation**: HSL-based harmonious colors
- **Texture post-processing**: Subtle noise for organic feel
- **Multiple rendering modes**: Lines only, forms only, or combined

### Usability
- **Theme-based generation**: Organic, Architectural, Mythical, Chaotic, Meditative
- **Configuration save/load**: JSON export of all parameters
- **Image export**: PNG data URL generation
- **Real-time preview**: Interactive parameter adjustment

## Installation

### Browser Usage

Simply include the engine in your HTML:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Klee Art</title>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script src="kleeEngine.js"></script>
  <script>
    const engine = new KleeEngine();
    const canvas = document.getElementById('canvas');

    engine.generateRandom('organic');
    engine.generateArtwork({ width: 1024, height: 1024 });
    engine.render(canvas);
  </script>
</body>
</html>
```

### Node.js Usage

```javascript
const KleeEngine = require('./kleeEngine.js');
const { createCanvas } = require('canvas'); // requires node-canvas package

const engine = new KleeEngine();
const canvas = createCanvas(1024, 1024);

engine.generateRandom('organic');
engine.generateArtwork({ width: 1024, height: 1024 });
engine.render(canvas);
```

## Quick Start

### Generate a Simple Artwork

```javascript
const engine = new KleeEngine();

// Add a seed point
engine.addSeed({
  x: 512,
  y: 512,
  angle: 0,
  variations: { wavy: 1.0 },
  colorIndex: 0.5
});

// Generate and render
engine.generateArtwork({ width: 1024, height: 1024, steps: 500 });
engine.render(document.getElementById('canvas'));
```

### Generate with Theme

```javascript
const engine = new KleeEngine();

// Automatically create themed seeds
engine.generateRandom('mythical');
engine.generateArtwork({ width: 1024, height: 1024 });
engine.render(canvas);
```

### Export Image

```javascript
const dataURL = engine.export(canvas, 'image/png');
// Use dataURL for download or display
```

## Architecture

### Generation Phase

```
Initialize
    ↓
Create Seeds (origin points)
    ↓
For each seed:
    ↓
    Grow Lines (iterative steps)
        ├─ Select variation (weighted)
        ├─ Calculate next point
        ├─ Update density grid
        ├─ Check for branching
        └─ Apply boundary conditions
    ↓
Apply Symmetry Transformations
    ↓
Detect Corporeal Forms (flood fill)
    ↓
Ready for Rendering
```

### Rendering Phase

```
Setup Canvas
    ↓
Draw Background
    ↓
Render Forms (filled regions)
    ↓
Render Lines (strokes)
    ↓
Post-Process (texture/noise)
    ↓
Export
```

## API Reference

### Constructor

```javascript
const engine = new KleeEngine();
```

Creates a new engine instance with default palette and noise table.

### Methods

#### `addSeed(config)`

Add a seed point for line generation.

**Parameters:**
- `config` (Object):
  - `x` (Number): X coordinate (optional, random if omitted)
  - `y` (Number): Y coordinate (optional, random if omitted)
  - `angle` (Number): Initial angle in radians (optional, random if omitted)
  - `variations` (Object): Map of variation names to weights (e.g., `{ wavy: 0.7, spiral: 0.3 }`)
  - `colorIndex` (Number): Palette index 0-1 (optional, random if omitted)
  - `branchProbability` (Number): Chance to branch per step (default: 0.02)
  - `symmetry` (Number): Symmetry type (0=none, 2=mirror, 3+=rotational)
  - `maxBranches` (Number): Maximum branch depth (default: 3)
  - `params` (Object): Variation-specific parameters

**Returns:** Seed index (Number)

**Example:**
```javascript
engine.addSeed({
  x: 500,
  y: 500,
  angle: Math.PI / 4,
  variations: { organic: 0.6, wavy: 0.4 },
  colorIndex: 0.3,
  branchProbability: 0.03,
  symmetry: 4,
  params: {
    amplitude: 0.4,
    frequency: 0.2,
    stepLength: 6
  }
});
```

#### `generateArtwork(options)`

Generate the complete artwork from all seeds.

**Parameters:**
- `options` (Object):
  - `width` (Number): Canvas width (default: 1024)
  - `height` (Number): Canvas height (default: 1024)
  - `steps` (Number): Steps per line (default: 500)
  - `stepLength` (Number): Length of each step (default: 5)

**Returns:** Object with `{ lines, forms, width, height }`

**Example:**
```javascript
const result = engine.generateArtwork({
  width: 1920,
  height: 1080,
  steps: 1000,
  stepLength: 4
});

console.log(`Generated ${result.lines.length} lines`);
```

#### `render(canvasElement, options)`

Render the generated artwork to a canvas.

**Parameters:**
- `canvasElement` (HTMLCanvasElement): Target canvas
- `options` (Object):
  - `background` (String): Background color (default: '#F5F1E8')
  - `lineWidth` (Number): Stroke width (default: 1.5)
  - `lineAlpha` (Number): Line opacity 0-1 (default: 0.8)
  - `showForms` (Boolean): Render filled forms (default: true)
  - `texture` (Number): Texture intensity 0-1 (default: 0)

**Example:**
```javascript
engine.render(canvas, {
  background: '#FFF',
  lineWidth: 2,
  lineAlpha: 0.9,
  showForms: true,
  texture: 0.05
});
```

#### `setPalette(colors)`

Set a custom color palette.

**Parameters:**
- `colors` (Array): Array of color objects or strings

**Example:**
```javascript
// Using HSL objects
engine.setPalette([
  { h: 0, s: 0.7, l: 0.5 },
  { h: 120, s: 0.6, l: 0.4 },
  { h: 240, s: 0.8, l: 0.6 }
]);

// Using RGB strings
engine.setPalette([
  'rgb(255, 100, 100)',
  'rgb(100, 255, 100)',
  'rgb(100, 100, 255)'
]);
```

#### `generateRandom(theme)`

Generate random artwork based on a theme.

**Parameters:**
- `theme` (String): One of 'organic', 'architectural', 'mythical', 'chaotic', 'meditative'

**Returns:** Artwork result object

**Example:**
```javascript
engine.generateRandom('architectural');
engine.render(canvas);
```

#### `export(canvasElement, format)`

Export canvas as data URL.

**Parameters:**
- `canvasElement` (HTMLCanvasElement): Canvas to export
- `format` (String): MIME type (default: 'image/png')

**Returns:** Data URL string

**Example:**
```javascript
const dataURL = engine.export(canvas, 'image/jpeg');
const link = document.createElement('a');
link.download = 'artwork.jpg';
link.href = dataURL;
link.click();
```

#### `saveConfig()`

Export configuration as JSON string.

**Returns:** JSON string

**Example:**
```javascript
const json = engine.saveConfig();
localStorage.setItem('myArtwork', json);
```

#### `loadConfig(jsonString)`

Load configuration from JSON string.

**Parameters:**
- `jsonString` (String): Configuration JSON

**Example:**
```javascript
const json = localStorage.getItem('myArtwork');
engine.loadConfig(json);
engine.generateArtwork();
engine.render(canvas);
```

## Line Variations

The engine implements 25 line variation algorithms. Each variation defines how a line "walks" through space.

### Catalog of Variations

| Variation | Description | Key Parameters |
|-----------|-------------|----------------|
| **straight** | Linear movement | - |
| **wavy** | Sinusoidal oscillation | amplitude, frequency |
| **curved** | Gradual direction change | curveRate |
| **spiral** | Rotating with radius change | spiralFactor, spiralRate |
| **zigzag** | Sharp angular changes | zigzagAngle |
| **organic** | Perlin noise perturbation | noiseScale, noiseAmount |
| **rhythmic** | Pulsing step length | frequency |
| **circular** | Circular motion | circleRate |
| **dotted** | Intermittent drawing | - |
| **looping** | Figure-eight pattern | loopFrequency |
| **angular** | Discrete angle steps | angleSteps |
| **gravitational** | Attracted to point | centerX, centerY, gravity |
| **repelling** | Avoiding center | centerX, centerY, repulsion |
| **trembling** | Rapid small jitters | tremble |
| **branching** | Spawns child lines | branchAngle |
| **explosive** | Accelerating outward | acceleration |
| **meandering** | Lazy river curves | meander |
| **chaotic** | Unpredictable jumps | chaos |
| **harmonic** | Multiple frequencies | - |
| **crystalline** | Geometric lattice | latticeAngle |
| **twittering** | Klee's "Twittering Machine" | - |
| **corporeal** | Blob-forming tendency | - |
| **architectural** | Grid with right angles | - |
| **flowing** | Water-like smooth | flow |
| **mechanical** | Precise geometric | gearSteps |
| **mythical** | Dragon-like curves | - |

### Variation Details

#### Organic
Uses 1D Perlin noise for natural-looking perturbations.

```javascript
variations: { organic: 1.0 },
params: {
  noiseScale: 0.1,    // Frequency of noise
  noiseAmount: 0.5    // Amplitude of effect
}
```

#### Spiral
Creates expanding or contracting spirals.

```javascript
variations: { spiral: 1.0 },
params: {
  spiralFactor: 1.02,  // >1 expands, <1 contracts
  spiralRate: 0.1      // Rotation speed
}
```

#### Gravitational
Lines bend towards a focal point.

```javascript
variations: { gravitational: 1.0 },
params: {
  centerX: 512,
  centerY: 512,
  gravity: 0.05  // Attraction strength
}
```

#### Corporeal
Designed to create closed, body-like forms.

```javascript
variations: { corporeal: 0.7, organic: 0.3 },
params: {
  stepLength: 5
}
```

## Examples

### Example 1: Simple Wavy Line

```javascript
const engine = new KleeEngine();

engine.addSeed({
  x: 100,
  y: 512,
  angle: 0,
  variations: { wavy: 1.0 },
  params: { amplitude: 0.3, frequency: 0.15 }
});

engine.generateArtwork({ width: 1024, height: 1024, steps: 800 });
engine.render(canvas);
```

### Example 2: Symmetrical Mandala

```javascript
const engine = new KleeEngine();

engine.addSeed({
  x: 512,
  y: 512,
  angle: 0,
  variations: { spiral: 0.5, harmonic: 0.5 },
  symmetry: 8,  // 8-way rotational
  params: {
    spiralFactor: 1.01,
    spiralRate: 0.08
  }
});

engine.generateArtwork({ width: 1024, height: 1024, steps: 1000 });
engine.render(canvas);
```

### Example 3: Organic Corporeal Form

```javascript
const engine = new KleeEngine();

for (let i = 0; i < 3; i++) {
  engine.addSeed({
    x: 300 + i * 200,
    y: 512,
    variations: {
      corporeal: 0.5,
      organic: 0.3,
      flowing: 0.2
    },
    branchProbability: 0.04,
    params: {
      noiseScale: 0.08,
      noiseAmount: 0.4
    }
  });
}

engine.generateArtwork({ width: 1024, height: 1024, steps: 600 });
engine.render(canvas, { showForms: true, texture: 0.05 });
```

### Example 4: Architectural Composition

```javascript
const engine = new KleeEngine();

engine.addSeed({
  x: 512,
  y: 100,
  angle: Math.PI / 2,
  variations: { architectural: 0.8, angular: 0.2 },
  symmetry: 2,
  params: { stepLength: 8 }
});

engine.addSeed({
  x: 200,
  y: 512,
  angle: 0,
  variations: { mechanical: 0.7, crystalline: 0.3 },
  params: { gearSteps: 16 }
});

engine.generateArtwork({ width: 1024, height: 1024, steps: 400 });
engine.render(canvas, { lineWidth: 2, lineAlpha: 0.9 });
```

### Example 5: Twittering Machine

Inspired by Klee's famous work.

```javascript
const engine = new KleeEngine();

// Create multiple "birds"
for (let i = 0; i < 5; i++) {
  engine.addSeed({
    x: 200 + i * 150,
    y: 300,
    angle: Math.PI / 2,
    variations: {
      twittering: 0.7,
      trembling: 0.2,
      looping: 0.1
    },
    params: { stepLength: 3 }
  });
}

// Base line
engine.addSeed({
  x: 100,
  y: 600,
  angle: 0,
  variations: { straight: 0.9, wavy: 0.1 },
  params: { stepLength: 10 }
});

engine.generateArtwork({ width: 1024, height: 1024, steps: 300 });
engine.render(canvas, { lineWidth: 1.2, showForms: false });
```

## Extending the Engine

### Adding a New Variation

To add a custom line variation:

```javascript
// 1. Define the variation function
KleeEngine.prototype._varCustom = function(x, y, theta, step, total, params) {
  const r = params.stepLength || this.stepLength;

  // Your custom logic here
  const customOffset = Math.sin(step * 0.1) * 0.5;
  const newTheta = theta + customOffset;

  return [
    x + r * Math.cos(newTheta),
    y + r * Math.sin(newTheta),
    newTheta
  ];
};

// 2. Register in _getVariationFunction
// Add 'custom': this._varCustom to the variations object

// 3. Use it
engine.addSeed({
  variations: { custom: 1.0 },
  params: { stepLength: 5 }
});
```

### Custom Color Palette

```javascript
// Generate palette from image
function paletteFromImage(imageData, count = 16) {
  // Extract dominant colors using k-means or similar
  // Return array of RGB strings
}

const palette = paletteFromImage(myImage);
engine.setPalette(palette);
```

### Advanced Form Detection

Replace the flood-fill algorithm with more sophisticated methods:

```javascript
// Override _detectForms for custom logic
KleeEngine.prototype._detectForms = function() {
  // Implement convex hull, alpha shapes, or other algorithms
  // Must populate this.forms array
};
```

## Technical Details

### Intersection Detection

The engine uses a density grid for efficient form detection:

```javascript
// Grid resolution: 50x50 cells
// Each cell tracks line density (number of line segments)
// Threshold: 3+ segments = potential form
```

**Simplification**: True line-line intersection checking is computationally expensive (O(n²) for n line segments). The density grid reduces this to O(n) at the cost of spatial precision.

**Improvement**: For exact intersections, implement Bentley-Ottmann sweep line algorithm or spatial indexing (R-tree, quadtree).

### Perlin Noise

Simple 1D Perlin noise is implemented using:
- 256-value lookup table
- Smoothstep interpolation
- No octaves (single frequency)

**Improvement**: Implement multi-octave Perlin noise or Simplex noise for richer organic variations. Consider using libraries like `simplex-noise.js` if dependencies are allowed.

### Color Harmony

Colors are generated using HSL color space:
- Base hues from color wheel (12 segments)
- Tints (higher lightness) and shades (lower lightness)
- Complementary pairs (180° hue rotation)

**Theory**: Based on Klee's teachings on color as "psychic effect" and use of complementary contrasts.

### Symmetry Transformations

Implemented transformations:
- Mirror (symmetry = 2): Reflect across vertical axis
- Rotational (symmetry > 2): Rotate around center by (360° / symmetry)

**Math**:
```
For rotation by angle θ:
x' = centerX + (x - centerX) * cos(θ) - (y - centerY) * sin(θ)
y' = centerY + (x - centerX) * sin(θ) + (y - centerY) * cos(θ)
```

### Memory Usage

Approximate memory per artwork:
- Lines: ~40 bytes per point × steps × seeds × branches
- Density grid: 4 bytes × resolution²
- Example: 10 seeds, 500 steps, 5 branches, 50 res = ~4 MB

## Performance Optimization

### Current Optimizations

1. **Typed Arrays**: Float32Array for density grid (50% memory reduction)
2. **Bounded Iteration**: Maximum steps and branch depth limits
3. **Early Termination**: Stop lines at canvas boundaries
4. **Batch Rendering**: Single path for all line segments

### Recommended Optimizations

#### 1. Web Workers
Offload generation to background thread:

```javascript
// worker.js
self.onmessage = (e) => {
  const engine = new KleeEngine();
  engine.loadConfig(e.data.config);
  const result = engine.generateArtwork(e.data.options);
  self.postMessage(result);
};

// main.js
const worker = new Worker('worker.js');
worker.postMessage({ config, options });
worker.onmessage = (e) => {
  engine.lines = e.data.lines;
  engine.forms = e.data.forms;
  engine.render(canvas);
};
```

#### 2. Progressive Rendering
Use `requestAnimationFrame` for responsive UI:

```javascript
function renderProgressive(lines, index = 0, batchSize = 100) {
  const end = Math.min(index + batchSize, lines.length);

  for (let i = index; i < end; i++) {
    drawLine(lines[i]);
  }

  if (end < lines.length) {
    requestAnimationFrame(() => renderProgressive(lines, end, batchSize));
  }
}
```

#### 3. WebGL Rendering
For large-scale artworks (>100k line segments):

```javascript
// Use WebGL for GPU-accelerated rendering
// Encode lines as vertex buffers
// Implement fragment shaders for texture effects
```

#### 4. Spatial Indexing
Replace density grid with quadtree:

```javascript
class Quadtree {
  // Efficient region queries for intersection detection
  // O(log n) instead of O(n) for proximity checks
}
```

## Future Enhancements

### Algorithmic Improvements

1. **3D Line Walking**: Extend to 3D space with Three.js or WebGL
2. **Physics Simulation**: Add mass, velocity, attraction/repulsion forces
3. **L-Systems**: Implement Lindenmayer systems for fractal-like growth
4. **Genetic Algorithms**: Evolve parameters for aesthetic optimization

### Visual Enhancements

1. **Watercolor Simulation**: Layer semi-transparent shapes with bleeding
2. **Brushstroke Textures**: Replace flat lines with textured strokes
3. **Lighting/Shading**: Add depth perception with shadows
4. **Animation**: Animate line growth for mesmerizing displays

### Interactivity

1. **Click-to-Add Seeds**: User interaction for seed placement
2. **Real-time Parameter Tweaking**: Sliders affecting live generation
3. **Undo/Redo**: History stack for editing
4. **Layer System**: Separate layers with blending modes

### Integration

1. **SVG Export**: Vector format for scalability
2. **Node.js CLI**: Command-line tool for batch generation
3. **REST API**: Web service for artwork generation
4. **NFT Minting**: On-chain generative art

## License

MIT License - Feel free to use in personal and commercial projects.

## Acknowledgments

Inspired by:
- Paul Klee's *Pedagogical Sketchbook* (1925)
- *The Thinking Eye* (Klee's notebooks)
- Tyler Hobbs' writing on generative art
- Processing and p5.js communities

## Support

For questions, issues, or contributions:
- GitHub Issues: [Report bugs or request features]
- Documentation: This README
- Examples: See `demo.html` for interactive examples

---

**"Art does not reproduce what we see; rather, it makes us see."** - Paul Klee
