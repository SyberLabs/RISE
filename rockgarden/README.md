# Abstract Figure Engine

A procedural generator for creating minimalist abstract figures inspired by Japanese Zen rock gardens (karesansui). This standalone JavaScript implementation uses HTML5 Canvas to render contemplative, sculptural forms through overlapping rock-like shapes.

## Philosophy

The Abstract Figure Engine embodies core principles of Japanese Zen aesthetics:

- **Wabi-Sabi (侘寂)**: Embracing imperfection and transience through organic variations
- **Ma (間)**: The power of negative space and emptiness
- **Asymmetry**: Dynamic balance through non-uniform compositions
- **Simplicity**: Minimalist forms that invite contemplation

Each generated figure is a unique sculptural entity emerging from procedurally overlapped shapes, suggesting presence and solidity without literal representation.

## Features

- **15+ Shape Variations**: Ellipses, blobs, irregular polygons, teardrops, crescents, fractal rocks, enso circles, and more
- **Procedural Overlapping**: Intelligent shape placement with density tracking and merging
- **Minimalist Styling**: Grayscale palettes with subtle gradients and textures
- **Wabi-Sabi Aesthetics**: Random perturbations for organic imperfection
- **Canvas-Based Rendering**: No external dependencies beyond browser APIs
- **Themeable Presets**: Serene, dynamic, contemplative, organic, and architectural modes
- **Extensible Architecture**: Add custom shape variations and rendering effects

## Quick Start

### Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
  <title>Zen Rock Garden</title>
</head>
<body>
  <canvas id="canvas" width="1024" height="1024"></canvas>
  <script src="abstract-figure-engine.js"></script>
  <script>
    const engine = new AbstractFigureEngine();
    const canvas = document.getElementById('canvas');

    // Generate a contemplative figure
    engine.generateThemed('contemplative', 1024, 1024);
    engine.render(canvas);
  </script>
</body>
</html>
```

### Using Themed Presets

```javascript
const engine = new AbstractFigureEngine();
const canvas = document.getElementById('canvas');

// Available themes: serene, dynamic, contemplative, organic, architectural
engine.generateThemed('serene', 1024, 1024);
engine.render(canvas, {
  backgroundRaking: true,
  useGradient: true,
  softEdges: true
});
```

### Custom Configuration

```javascript
const engine = new AbstractFigureEngine();

// Configure the core composition
engine.setCore({
  anchor: [512, 512],                    // Center point
  variationWeights: {                    // Shape type probabilities
    blob: 0.3,
    ellipse: 0.3,
    irregularPoly: 0.4
  },
  overlapFactor: 0.7,                    // 0-1: How much shapes overlap
  asymmetryBias: [0.2, 0],               // Directional bias [x, y]
  styleIndex: 0.5,                       // 0-1: Palette darkness
  symmetry: 0.3                          // 0-1: Degree of mirroring
});

// Generate the figure
engine.generateFigure({
  iterations: 20,                        // Number of shapes to add
  width: 1024,
  height: 1024,
  asymmetry: 0.5                         // Overall asymmetry factor
});

// Render with custom options
const canvas = document.getElementById('canvas');
engine.render(canvas, {
  backgroundRaking: true,                // Add raked gravel pattern
  useGradient: true,                     // Use radial gradients
  softEdges: true,                       // Apply vignette effect
  outlineWidth: 2,                       // Stroke width for shapes
  textureIntensity: 0.1,                 // 0-1: Noise texture strength
  backgroundColor: '#f5f5f0'             // Canvas background color
});
```

## Shape Variations

The engine includes 15+ built-in shape variations, each parameterizable:

### Basic Forms
- **Ellipse**: Classic elliptical rock with adjustable eccentricity
- **Blob**: Organic shape with noise-perturbed radius
- **Irregular Polygon**: Jagged 5-8 sided polygon

### Organic Forms
- **Teardrop**: Elongated shape tapering at one end
- **Crescent**: Moon-like form from overlapping arcs
- **Asymmetrical Oval**: Ellipse with flattened side
- **Petal Form**: Flower petal-like radiating shape

### Complex Forms
- **Fractal Rock**: Koch-curve-like textured edges
- **Layered**: Multiple sub-shapes overlapped for depth
- **Stacked Boulders**: Vertical arrangement of circles
- **Triangular Cluster**: Three-point composition

### Textured Forms
- **Raked**: Internal concentric or radial lines
- **Enso**: Imperfect circle with gap (Zen brush stroke)
- **Wave Distorted**: Sinusoidal perturbation
- **Spiral Rock**: Logarithmic spiral formation
- **Split Rock**: Shape with crack/gap effect

## API Reference

### Constructor

```javascript
const engine = new AbstractFigureEngine();
```

### Methods

#### `setCore(config)`
Configure the core composition parameters.

**Parameters:**
- `anchor`: [x, y] center point
- `variationWeights`: Object mapping variation names to probability weights
- `overlapFactor`: 0-1, degree of overlap between shapes
- `asymmetryBias`: [x, y] directional bias vector
- `styleIndex`: 0-1, controls palette darkness
- `symmetry`: 0-1, degree of mirroring (optional)

#### `generateFigure(config)`
Generate a new abstract figure.

**Parameters:**
- `iterations`: Number of shapes to generate (default: 20)
- `width`: Canvas width (default: 1024)
- `height`: Canvas height (default: 1024)
- `asymmetry`: 0-1, overall asymmetry factor (default: 0.5)

**Returns:** Array of shape objects

#### `generateThemed(theme, width, height)`
Generate a figure using a preset theme.

**Parameters:**
- `theme`: 'serene' | 'dynamic' | 'contemplative' | 'organic' | 'architectural'
- `width`: Canvas width
- `height`: Canvas height

**Returns:** Array of shape objects

#### `render(canvasElement, config)`
Render the generated figure to a canvas.

**Parameters:**
- `canvasElement`: HTMLCanvasElement to render to
- `config`: Rendering configuration object
  - `backgroundRaking`: Boolean (default: false)
  - `useGradient`: Boolean (default: true)
  - `softEdges`: Boolean (default: false)
  - `outlineWidth`: Number (default: 2)
  - `textureIntensity`: 0-1 (default: 0.1)
  - `backgroundColor`: String (default: '#f5f5f0')

#### `addVariation(name, generatorFn)`
Add a custom shape variation.

**Parameters:**
- `name`: String identifier for the variation
- `generatorFn`: Function with signature `(center, size, params) => points[]`

**Example:**
```javascript
engine.addVariation('customShape', (c, s, params = {}) => {
  const points = [];
  // Generate shape points...
  return points;
});
```

#### `export(canvasElement, format)`
Export the canvas as a data URL.

**Parameters:**
- `canvasElement`: Canvas to export
- `format`: 'png' | 'jpg' (default: 'png')

**Returns:** Data URL string

#### `saveConfig()`
Save the current configuration as JSON.

**Returns:** JSON string

#### `loadConfig(jsonString)`
Load configuration from JSON.

**Parameters:**
- `jsonString`: JSON configuration string

## Examples

### Example 1: Basic Rock Figure

```javascript
const engine = new AbstractFigureEngine();
const canvas = document.getElementById('canvas');

engine.setCore({
  anchor: [512, 512],
  variationWeights: { ellipse: 0.5, blob: 0.5 },
  overlapFactor: 0.8
});

engine.generateFigure({ iterations: 10 });
engine.render(canvas);
```

### Example 2: Enso Meditation

```javascript
const engine = new AbstractFigureEngine();

engine.setCore({
  anchor: [512, 512],
  variationWeights: { enso: 0.5, blob: 0.3, ellipse: 0.2 },
  overlapFactor: 0.9,
  asymmetryBias: [0.05, 0.05]
});

engine.generateFigure({ iterations: 8, asymmetry: 0.2 });
engine.render(canvas, {
  useGradient: false,  // Flat fills for traditional ink effect
  outlineWidth: 4,
  textureIntensity: 0.05
});
```

### Example 3: Dynamic Angular Composition

```javascript
engine.setCore({
  variationWeights: {
    irregularPoly: 0.4,
    fractalRock: 0.3,
    triangularCluster: 0.3
  },
  overlapFactor: 0.5,
  asymmetryBias: [0.4, 0.3]
});

engine.generateFigure({ iterations: 30, asymmetry: 0.9 });
engine.render(canvas, {
  backgroundRaking: true,
  useGradient: false,
  outlineWidth: 3
});
```

### Example 4: Custom Variation

```javascript
// Add a star-like rock variation
engine.addVariation('star', (c, s, params = {}) => {
  const points = [];
  const spikes = params.spikes || 7;
  const innerRadius = s * 0.4;

  for (let i = 0; i <= spikes * 2; i++) {
    const angle = (i / (spikes * 2)) * Math.PI * 2;
    const radius = i % 2 === 0 ? s : innerRadius;
    points.push([
      c[0] + radius * Math.cos(angle),
      c[1] + radius * Math.sin(angle)
    ]);
  }
  return points;
});

engine.setCore({
  variationWeights: { star: 0.6, blob: 0.4 }
});
```

## Aesthetic Principles

### Wabi-Sabi Implementation

The engine introduces organic imperfection through:
- Random perturbations in shape positioning (±20% of size)
- Noise-based radius variation for blobs and organic forms
- Irregular polygon vertices with jaggedness parameter
- Imperfect circle generation with gap for enso variations

### Ma (Negative Space)

Compositions emphasize emptiness through:
- Sparse shape distribution (default 10-20 shapes)
- Asymmetric positioning leaving large empty areas
- Minimal overlap factor options (0.3-0.7)
- High canvas-to-shape ratio

### Asymmetry and Balance

Dynamic balance achieved via:
- Asymmetry bias vectors directing growth
- Off-center anchor points
- Variable shape sizes (8-15% of canvas dimension)
- Optional subtle symmetry (10-30%) for organic balance

### Minimalist Styling

Visual simplicity through:
- Grayscale palettes (4-8 shades)
- Subtle gradients for depth without complexity
- Minimal texture (procedural noise at 5-15% intensity)
- Clean outlines (1-3px stroke width)

## Technical Details

### Algorithm Overview

1. **Initialization**
   - Create density grid (50x50 cell resolution)
   - Generate grayscale palette based on styleIndex
   - Set core shape at anchor point

2. **Iterative Generation**
   - For each iteration:
     - Select variation based on weights
     - Calculate position near existing shape with overlap bias
     - Apply wabi-sabi perturbation (random wobble)
     - Generate shape points using variation function
     - Update density grid
     - Calculate overlaps with existing shapes

3. **Color Assignment**
   - Compute density at each shape's center
   - Map density to palette index (darker = higher density)

4. **Rendering**
   - Sort shapes by density (lighter first for depth)
   - Render background raking pattern if enabled
   - For each shape:
     - Create path from points
     - Fill with gradient or solid color
     - Add procedural texture
     - Stroke outline
     - Render internal rake lines if present
   - Apply post-processing (vignette, etc.)

### Performance Considerations

- **Shape Count**: 5-50 shapes render smoothly (< 100ms)
- **Canvas Size**: 512-2048px optimal; scales linearly
- **Density Grid**: O(n) updates; sparse grid for efficiency
- **Path Complexity**: 32-64 points per shape for smoothness
- **Convex Hull**: Graham scan O(n log n) for merging

### Shape Generation Math

**Ellipse:**
```
x = cx + scale * cos(t) * a
y = cy + scale * sin(t) * b
where a, b = axes from eccentricity
```

**Blob (Perlin noise):**
```
r(t) = scale * (1 + noise(t) * amplitude)
where noise(t) = sin(t * 12.9898 + seed) * 43758.5453 (fractional part)
```

**Fractal Rock (Koch-like):**
```
For each edge midpoint:
  offset = random(-1, 1) * scale * displacement
  insert new point at midpoint + offset
```

### Browser Compatibility

- Modern browsers with Canvas 2D support (Chrome 4+, Firefox 2+, Safari 3.1+, Edge 12+)
- ES6+ features: Classes, arrow functions, template literals, destructuring
- No transpilation required for modern environments
- Polyfills needed for IE11 (Promise, Array methods)

## Extending the Engine

### Adding New Variations

```javascript
engine.addVariation('myVariation', (center, scale, params = {}) => {
  const points = [];
  const segments = params.segments || 32;

  // Generate path points
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    // Your algorithm here
    points.push([x, y]);
  }

  // Optional: Add rake lines
  points.rakeLines = [
    [[x1, y1], [x2, y2]],
    // More lines...
  ];

  return points;
});
```

### Custom Rendering Effects

```javascript
// Override internal render method
const originalRender = engine._renderShape;
engine._renderShape = function(ctx, shape, config) {
  // Pre-render custom effect
  // ...

  // Call original
  originalRender.call(this, ctx, shape, config);

  // Post-render custom effect
  // ...
};
```

### Mutation and Evolution

```javascript
function mutate(engine, mutationRate = 0.1) {
  const core = engine.core;

  Object.keys(core.variationWeights).forEach(key => {
    if (Math.random() < mutationRate) {
      core.variationWeights[key] *= (0.8 + Math.random() * 0.4);
    }
  });

  // Normalize weights
  const total = Object.values(core.variationWeights).reduce((a, b) => a + b);
  Object.keys(core.variationWeights).forEach(key => {
    core.variationWeights[key] /= total;
  });

  return engine;
}
```

## Future Enhancements

### Suggested Improvements

1. **SVG Export**: Vector output for infinite scaling
2. **WebGL Rendering**: Hardware-accelerated effects and 3D projection
3. **Path Union/Intersection**: True boolean operations for shape merging
4. **Bezier Smoothing**: Cubic curves for organic edges
5. **Color Palettes**: Expanded color theory (earth tones, blues)
6. **Animation**: Morphing between states, particle effects
7. **3D Projection**: Isometric or perspective views
8. **Texture Libraries**: Pre-made gravel, sand, stone textures
9. **Machine Learning**: Generate variations from trained models
10. **Interactive Editor**: Real-time manipulation of shapes

### Known Limitations

- **Shape Merging**: Uses convex hull approximation, not true union
- **Overlap Detection**: Point-in-polygon only, no edge intersection
- **Blur Effect**: Vignette placeholder, not pixel-level blur
- **Memory**: Large canvas (4K+) may cause slowdown
- **Browser Variance**: Slight rendering differences across engines

## Design Decisions

### Why Canvas, Not SVG?

- **Performance**: Canvas rasterizes faster for complex shapes
- **Effects**: Pixel-level texture and gradients simpler
- **File Size**: No DOM overhead for many shapes
- **Trade-off**: Loses vector scalability (future SVG export planned)

### Why Convex Hull for Merging?

- **Speed**: O(n log n) vs. O(n²) for polygon union
- **Simplicity**: No external geometry library dependency
- **Aesthetic**: Simplifies shapes, aligning with minimalism
- **Trade-off**: Loses concavities (acceptable for rock abstraction)

### Why Perlin Noise Approximation?

- **Dependency-free**: Implements from scratch
- **Performance**: Fast sin-based pseudo-noise
- **Quality**: Sufficient for organic variation at small scales
- **Trade-off**: Not true Perlin (no octaves, limited smoothness)

## Credits and Inspiration

This project draws inspiration from:

- **Karesansui (枯山水)**: Japanese dry landscape gardens
- **Ryoan-ji Temple Garden**: Famous 15-rock composition in Kyoto
- **Zen Aesthetics**: Wabi-sabi, ma, kanso (simplicity)
- **Abstract Expressionism**: Mark Rothko, Kazuo Shiraga
- **Generative Art**: Sol LeWitt, Casey Reas, Tyler Hobbs
- **Procedural Generation**: Perlin noise, L-systems, fractals

## License

This code is provided as-is for educational and artistic purposes. Feel free to use, modify, and extend for your projects.

## Example Gallery

See [examples.js](examples.js) for 12 complete example implementations demonstrating various techniques and compositions.

---

**Created with contemplative code** ◯
