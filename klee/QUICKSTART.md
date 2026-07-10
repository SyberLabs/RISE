# Klee Engine - Quick Start Guide

Get started with the Klee Engine in 5 minutes!

## What You Have

After setting up the Klee Engine, you'll have these files:

- **kleeEngine.js** - The core engine (~1200 lines)
- **demo.html** - Interactive demo with controls
- **examples.html** - Gallery of 12 curated examples
- **README.md** - Complete documentation
- **ADVANCED_GUIDE.md** - Deep dive into algorithms and extensions
- **package.json** - NPM package configuration

## Instant Start

### Option 1: Run the Interactive Demo

Simply open `demo.html` in any modern browser:

```bash
# On Windows
start demo.html

# On Mac
open demo.html

# On Linux
xdg-open demo.html
```

You'll see:
- ✅ Live artwork generation
- ✅ Interactive controls (theme, size, steps)
- ✅ Export to PNG
- ✅ Save/load configurations
- ✅ 5 preset examples

### Option 2: View the Gallery

Open `examples.html` for a curated collection:

```bash
open examples.html
```

Features:
- ✅ 12 different artistic styles
- ✅ Source code for each example
- ✅ Performance metrics
- ✅ Individual regeneration
- ✅ Batch download

## Your First Artwork (3 lines of code)

Create a new HTML file:

```html
<!DOCTYPE html>
<html>
<head><title>My First Klee Art</title></head>
<body>
  <canvas id="canvas"></canvas>
  <script src="kleeEngine.js"></script>
  <script>
    const engine = new KleeEngine();
    engine.generateRandom('organic');
    engine.generateArtwork();
    engine.render(document.getElementById('canvas'));
  </script>
</body>
</html>
```

Done! Open in browser to see your artwork.

## 5-Minute Tutorial

### Step 1: Create an Engine

```javascript
const engine = new KleeEngine();
```

### Step 2: Add Seeds (Starting Points)

```javascript
// Simple seed with wavy lines
engine.addSeed({
  x: 512,              // X position
  y: 512,              // Y position
  angle: 0,            // Starting angle
  variations: {        // Line behavior
    wavy: 1.0          // 100% wavy
  }
});
```

### Step 3: Generate

```javascript
engine.generateArtwork({
  width: 1024,
  height: 1024,
  steps: 500
});
```

### Step 4: Render

```javascript
const canvas = document.getElementById('canvas');
engine.render(canvas);
```

### Step 5: Export (Optional)

```javascript
const dataURL = engine.export(canvas);
// Use for download or display
```

## Common Patterns

### Pattern: Random Theme-Based Art

```javascript
const themes = ['organic', 'architectural', 'mythical', 'chaotic', 'meditative'];
const theme = themes[Math.floor(Math.random() * themes.length)];

engine.generateRandom(theme);
engine.generateArtwork();
engine.render(canvas);
```

### Pattern: Symmetrical Mandala

```javascript
engine.addSeed({
  x: 512, y: 512,
  variations: { spiral: 0.7, harmonic: 0.3 },
  symmetry: 8,  // 8-way rotational
  params: {
    spiralFactor: 1.01,
    spiralRate: 0.09
  }
});

engine.generateArtwork({ steps: 1000 });
engine.render(canvas);
```

### Pattern: Multiple Layers

```javascript
// Layer 1: Background
engine.addSeed({
  variations: { organic: 1.0 },
  colorIndex: 0.2
});

// Layer 2: Midground
engine.addSeed({
  variations: { wavy: 0.7, flowing: 0.3 },
  colorIndex: 0.5
});

// Layer 3: Foreground
engine.addSeed({
  variations: { spiral: 1.0 },
  colorIndex: 0.8
});

engine.generateArtwork();
engine.render(canvas);
```

### Pattern: Branching Tree

```javascript
engine.addSeed({
  x: 512,
  y: 800,  // Bottom of canvas
  angle: -Math.PI / 2,  // Pointing up
  variations: {
    organic: 0.5,
    branching: 0.5
  },
  branchProbability: 0.1,  // Branch often
  maxBranches: 5
});

engine.generateArtwork({ steps: 300 });
engine.render(canvas, { showForms: false });
```

## Variation Cheat Sheet

Quick reference for the 25 line variations:

| Category | Variations |
|----------|------------|
| **Smooth** | straight, wavy, curved, flowing, meandering |
| **Geometric** | angular, architectural, crystalline, mechanical |
| **Dynamic** | spiral, circular, looping, rhythmic |
| **Organic** | organic, corporeal, mythical, twittering |
| **Chaotic** | chaotic, explosive, trembling, zigzag |
| **Forces** | gravitational, repelling, harmonic |
| **Special** | dotted, branching |

### Most Popular Combinations

```javascript
// Natural/Organic
variations: { organic: 0.6, flowing: 0.3, wavy: 0.1 }

// Geometric/Structured
variations: { architectural: 0.7, angular: 0.3 }

// Mystical/Decorative
variations: { mythical: 0.5, harmonic: 0.3, spiral: 0.2 }

// Energetic/Chaotic
variations: { chaotic: 0.4, explosive: 0.4, trembling: 0.2 }

// Meditative/Calm
variations: { circular: 0.5, rhythmic: 0.3, wavy: 0.2 }
```

## Parameters Reference

### Seed Configuration

```javascript
engine.addSeed({
  // Position
  x: Number,                    // X coordinate (optional, random)
  y: Number,                    // Y coordinate (optional, random)
  angle: Number,                // Starting angle in radians (optional)

  // Behavior
  variations: Object,           // { variationName: weight }
  branchProbability: Number,    // 0-1, chance to branch (default: 0.02)
  symmetry: Number,             // 0, 2, 3, 4, 6, 8 (default: 0)
  maxBranches: Number,          // Max branch depth (default: 3)

  // Appearance
  colorIndex: Number,           // 0-1, palette position (optional)

  // Parameters
  params: {
    stepLength: Number,         // Step size (default: 5)
    amplitude: Number,          // For wavy/oscillating (0.1-1.0)
    frequency: Number,          // Oscillation frequency (0.05-0.5)
    noiseScale: Number,         // For organic (0.05-0.2)
    noiseAmount: Number,        // Noise intensity (0.2-0.8)
    spiralFactor: Number,       // For spiral (0.98-1.05)
    spiralRate: Number,         // Spiral speed (0.05-0.2)
    // ... and many more (see README)
  }
});
```

### Generation Options

```javascript
engine.generateArtwork({
  width: 1024,           // Canvas width
  height: 1024,          // Canvas height
  steps: 500,            // Steps per line (100-2000)
  stepLength: 5          // Default step size (3-10)
});
```

### Rendering Options

```javascript
engine.render(canvas, {
  background: '#F5F1E8',  // Background color
  lineWidth: 1.5,         // Stroke width (0.5-5)
  lineAlpha: 0.8,         // Line opacity (0.1-1)
  showForms: true,        // Render filled forms
  texture: 0.05           // Texture intensity (0-0.2)
});
```

## Tips for Best Results

### 1. Start Simple

Begin with one seed and one variation:

```javascript
engine.addSeed({ variations: { wavy: 1.0 } });
```

Then gradually add complexity.

### 2. Use Symmetry for Impact

Symmetry creates striking patterns:

```javascript
symmetry: 4  // or 6, 8 for more complexity
```

### 3. Mix Complementary Variations

Combine smooth + chaotic for interest:

```javascript
variations: { flowing: 0.7, trembling: 0.3 }
```

### 4. Adjust Steps for Detail

- **100-300 steps**: Loose, sketchy
- **400-600 steps**: Balanced detail
- **800-2000 steps**: Dense, intricate

### 5. Custom Palettes

Create themed color schemes:

```javascript
// Sunset palette
engine.setPalette([
  { h: 0, s: 0.8, l: 0.5 },    // Red
  { h: 30, s: 0.9, l: 0.6 },   // Orange
  { h: 60, s: 0.7, l: 0.5 },   // Yellow
  { h: 280, s: 0.5, l: 0.3 }   // Purple shadow
]);
```

## Troubleshooting

### Problem: Lines go off-canvas

**Solution:** Reduce step length or add boundary checks:

```javascript
params: { stepLength: 3 }  // Instead of 5+
```

### Problem: Too dense/cluttered

**Solution:** Reduce steps or seeds:

```javascript
engine.generateArtwork({ steps: 200 });  // Instead of 500+
```

### Problem: Not enough variation

**Solution:** Increase branch probability or add more seeds:

```javascript
branchProbability: 0.05  // Instead of 0.02
```

### Problem: Slow generation

**Solution:**
- Reduce steps
- Limit seeds
- Lower grid resolution:

```javascript
engine.gridResolution = 25;  // Instead of 50
```

### Problem: Want more organic feel

**Solution:** Use organic variation with noise:

```javascript
variations: { organic: 1.0 },
params: {
  noiseScale: 0.1,
  noiseAmount: 0.6
}
```

## Next Steps

1. ✅ **Experiment**: Try all variations in [examples.html](examples.html)
2. ✅ **Read**: Full API in [README.md](README.md)
3. ✅ **Explore**: Advanced techniques in [ADVANCED_GUIDE.md](ADVANCED_GUIDE.md)
4. ✅ **Create**: Build your own variations
5. ✅ **Share**: Export and share your creations!

## Example Gallery

Open `examples.html` to see these in action:

1. **Pure Organic** - Natural flowing lines
2. **Symmetrical Spiral** - 8-way mandala
3. **Twittering Machine** - Klee homage
4. **Corporeal Forms** - Body-like shapes
5. **Architectural Grid** - Geometric structures
6. **Chaotic Explosion** - Energetic chaos
7. **Harmonic Resonance** - Wave interference
8. **Crystalline Structure** - Mineral patterns
9. **Gravitational Pull** - Cosmic vortex
10. **Mythical Dragon** - Serpentine curves
11. **Mechanical Precision** - Clockwork
12. **Flowing Water** - Liquid movement

## Resources

- **Canvas API**: [MDN Canvas Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial)
- **Generative Art**: [Tyler Hobbs' Essays](https://tylerxhobbs.com/essays)
- **Paul Klee**: *Pedagogical Sketchbook* (1925)

## Need Help?

- Check the examples in `examples.html`
- Read the full docs in `README.md`
- Experiment with the interactive demo in `demo.html`

---

**Happy Creating!** 🎨

*"A line is a dot that went for a walk"* - Paul Klee
