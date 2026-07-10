# Quick Start Guide - Abstract Figure Engine

Get up and running with the Abstract Figure Engine in 5 minutes!

## Installation

No installation required! Just download the files and open in a browser.

### Option 1: Use the Demo

```bash
# Simply open demo.html in your browser
open demo.html
```

The demo provides a full interactive interface with:
- Theme presets (Serene, Dynamic, Contemplative, Organic, Architectural)
- Real-time parameter controls
- Export functionality
- Live preview

### Option 2: Create Your Own HTML

Create a new file `my-zen-art.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Zen Art</title>
</head>
<body>
  <canvas id="canvas" width="1024" height="1024"></canvas>

  <script src="abstract-figure-engine.js"></script>
  <script>
    const engine = new AbstractFigureEngine();
    const canvas = document.getElementById('canvas');

    // Generate a figure
    engine.generateThemed('contemplative', 1024, 1024);

    // Render it
    engine.render(canvas, {
      backgroundRaking: true,
      useGradient: true,
      softEdges: true
    });
  </script>
</body>
</html>
```

Open it in your browser - done!

## Your First Generation

### 1. Using Themes (Easiest)

```javascript
const engine = new AbstractFigureEngine();
const canvas = document.getElementById('canvas');

// Choose a theme:
// 'serene', 'dynamic', 'contemplative', 'organic', 'architectural'
engine.generateThemed('serene', 1024, 1024);
engine.render(canvas);
```

**That's it!** You've generated your first Zen-inspired abstract figure.

### 2. Customizing Parameters

```javascript
const engine = new AbstractFigureEngine();

// Configure the composition
engine.setCore({
  anchor: [512, 512],           // Center point
  variationWeights: {           // Which shapes to use
    blob: 0.4,
    ellipse: 0.4,
    irregularPoly: 0.2
  },
  overlapFactor: 0.7,           // How much shapes overlap (0-1)
  asymmetryBias: [0.2, 0]       // Directional bias [x, y]
});

// Generate with custom settings
engine.generateFigure({
  iterations: 25,               // Number of shapes
  width: 1024,
  height: 1024,
  asymmetry: 0.6                // Overall randomness (0-1)
});

// Render with options
engine.render(canvas, {
  backgroundRaking: true,       // Add raked gravel pattern
  useGradient: true,            // Use radial gradients
  softEdges: true,              // Apply soft vignette
  outlineWidth: 2,              // Stroke width
  textureIntensity: 0.1         // Noise texture strength
});
```

## Common Recipes

### Recipe 1: Minimalist Monolith

A single dominant form - perfect for logos or icons.

```javascript
engine.setCore({
  variationWeights: { blob: 0.6, ellipse: 0.4 },
  overlapFactor: 0.9            // High overlap = unified form
});

engine.generateFigure({
  iterations: 5,                // Very few shapes
  asymmetry: 0.1                // Low asymmetry = stable
});

engine.render(canvas, {
  backgroundRaking: false,
  useGradient: true,
  softEdges: true
});
```

### Recipe 2: Dynamic Energy

Lots of shapes with strong movement.

```javascript
engine.setCore({
  variationWeights: {
    irregularPoly: 0.4,
    fractalRock: 0.3,
    waveDistorted: 0.3
  },
  overlapFactor: 0.5,           // Low overlap = separate forms
  asymmetryBias: [0.4, 0.3]     // Strong directional bias
});

engine.generateFigure({
  iterations: 35,               // Many shapes
  asymmetry: 0.9                // High asymmetry = chaotic
});

engine.render(canvas, {
  backgroundRaking: true,
  useGradient: false,           // Flat colors
  outlineWidth: 3
});
```

### Recipe 3: Zen Circle Meditation

Inspired by enso (Zen circle).

```javascript
engine.setCore({
  variationWeights: {
    enso: 0.5,
    blob: 0.3,
    ellipse: 0.2
  },
  overlapFactor: 0.85
});

engine.generateFigure({
  iterations: 10,
  asymmetry: 0.2                // Low for circular symmetry
});

engine.render(canvas, {
  backgroundRaking: false,
  useGradient: false,           // Traditional ink effect
  outlineWidth: 4,
  textureIntensity: 0.05
});
```

### Recipe 4: Organic Garden

Natural, flowing composition.

```javascript
engine.setCore({
  variationWeights: {
    blob: 0.3,
    layered: 0.2,
    petalForm: 0.2,
    waveDistorted: 0.3
  },
  overlapFactor: 0.8
});

engine.generateFigure({
  iterations: 20,
  asymmetry: 0.5
});

engine.render(canvas, {
  backgroundRaking: true,
  useGradient: true,
  softEdges: true,
  textureIntensity: 0.15        // Higher texture for organic feel
});
```

## Available Shape Variations

Use these in your `variationWeights`:

**Basic Shapes:**
- `ellipse` - Classic elliptical rock
- `blob` - Organic shape with noise
- `irregularPoly` - Jagged polygon

**Organic Forms:**
- `teardrop` - Elongated, tapering shape
- `crescent` - Moon-like form
- `asymmetricalOval` - Ellipse with flat side
- `petalForm` - Flower petal-like

**Complex Forms:**
- `fractalRock` - Textured edges
- `layered` - Multiple overlapped sub-shapes
- `stackedBoulders` - Vertical arrangement
- `triangularCluster` - Three-point composition

**Textured Forms:**
- `raked` - Internal line patterns
- `enso` - Imperfect circle with gap
- `waveDistorted` - Sinusoidal variation
- `spiralRock` - Logarithmic spiral
- `splitRock` - Shape with crack

## Exporting Your Art

### Export as PNG

```javascript
const dataURL = engine.export(canvas, 'png');

// Download it
const link = document.createElement('a');
link.download = 'my-zen-art.png';
link.href = dataURL;
link.click();
```

### Save Configuration

```javascript
const config = engine.saveConfig();
console.log(config);  // JSON string

// Save to file
const blob = new Blob([config], { type: 'application/json' });
const url = URL.createObjectURL(blob);
// Download blob...
```

### Load Configuration

```javascript
const config = `{ "core": { ... } }`;  // Your saved JSON
engine.loadConfig(config);
```

## Parameter Reference

### Quick Parameter Guide

| Parameter | Range | Effect |
|-----------|-------|--------|
| `iterations` | 5-50 | Number of shapes (more = complex) |
| `asymmetry` | 0-1 | Randomness (0 = stable, 1 = chaotic) |
| `overlapFactor` | 0.3-1 | Shape merging (low = separate, high = unified) |
| `asymmetryBias` | [-1,1] × 2 | Directional growth [x, y] |
| `styleIndex` | 0-1 | Palette darkness (0 = light, 1 = dark) |
| `backgroundRaking` | bool | Add raked gravel pattern |
| `useGradient` | bool | Radial gradients for depth |
| `softEdges` | bool | Vignette effect |
| `outlineWidth` | 1-5 | Stroke thickness |
| `textureIntensity` | 0-0.3 | Noise texture strength |

### Theme Characteristics

| Theme | Shapes | Overlap | Asymmetry | Best For |
|-------|--------|---------|-----------|----------|
| Serene | 15 | High (0.8) | Low (0.3) | Calm, balanced compositions |
| Dynamic | 25 | Low (0.5) | High (0.8) | Energetic, chaotic forms |
| Contemplative | 12 | Medium (0.7) | Low (0.2) | Meditative, simple |
| Organic | 20 | High (0.9) | Medium (0.5) | Natural, flowing |
| Architectural | 18 | Medium (0.6) | Medium (0.6) | Structured, angular |

## Troubleshooting

### Problem: Canvas is blank

**Solution:** Make sure you call `render()` after `generateFigure()`:

```javascript
engine.generateFigure({ ... });
engine.render(canvas);  // Don't forget this!
```

### Problem: Shapes are too small/large

**Solution:** Adjust canvas size or shape count:

```javascript
// For larger canvas
engine.generateFigure({
  width: 2048,
  height: 2048,
  iterations: 30  // Scale up shape count too
});
```

### Problem: Too many/few shapes

**Solution:** Adjust `iterations`:

```javascript
engine.generateFigure({
  iterations: 10   // Fewer shapes (minimalist)
  // or
  iterations: 40   // Many shapes (complex)
});
```

### Problem: Shapes all look the same

**Solution:** Use more variation types:

```javascript
engine.setCore({
  variationWeights: {
    blob: 0.2,
    ellipse: 0.2,
    irregularPoly: 0.2,
    teardrop: 0.2,
    waveDistorted: 0.2
  }
});
```

### Problem: Composition too uniform/boring

**Solution:** Increase asymmetry and add bias:

```javascript
engine.setCore({
  asymmetryBias: [0.3, 0.2]  // Strong directional growth
});

engine.generateFigure({
  asymmetry: 0.8  // High randomness
});
```

## Next Steps

1. **Explore Examples:** Open `test.html` to see 12 complete examples
2. **Read Full Docs:** Check `README.md` for comprehensive API reference
3. **Learn Technical Details:** See `TECHNICAL.md` for algorithm explanations
4. **Add Custom Shapes:** Use `engine.addVariation()` to create your own

## Example Projects

### Project 1: Random Daily Art

Generate a new piece each day:

```javascript
const today = new Date().toDateString();
const seed = hashCode(today);  // Implement a hash function

// Use seed for reproducible daily art
Math.random = seededRandom(seed);  // Replace Math.random

engine.generateThemed('contemplative', 1024, 1024);
```

### Project 2: Interactive Gallery

Generate multiple variations:

```javascript
const themes = ['serene', 'dynamic', 'contemplative', 'organic', 'architectural'];

themes.forEach((theme, i) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;

  engine.generateThemed(theme, 512, 512);
  engine.render(canvas);

  document.body.appendChild(canvas);
});
```

### Project 3: Animation

Create morphing shapes:

```javascript
let frame = 0;

function animate() {
  engine.setCore({
    asymmetryBias: [
      Math.cos(frame * 0.01) * 0.3,
      Math.sin(frame * 0.01) * 0.3
    ]
  });

  engine.generateFigure({ iterations: 20 });
  engine.render(canvas);

  frame++;
  requestAnimationFrame(animate);
}

animate();
```

## Community and Support

- **Issues:** Report bugs or request features (add GitHub link)
- **Examples:** Share your creations!
- **Contributions:** Custom variations welcome

---

**Happy generating! May your code be as contemplative as a Zen garden.** ◯
