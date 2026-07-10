# Fractal Flame Generator - Quick Reference Cheatsheet

## Essential Files
- `fractal-flame.js` - Main library
- `fractal-flame-demo.html` - Interactive editor
- `fractal-flame-test.html` - Test suite
- `FRACTAL-FLAME-README.md` - Full documentation

## Quick Start

### Browser
```html
<script src="fractal-flame.js"></script>
<canvas id="c" width="800" height="800"></canvas>
<script>
  const gen = new FractalFlameGenerator();
  gen.generateRandomFlame();

  gen.generateImage({
    iterations: 10000000,
    width: 800,
    height: 800,
    gamma: 4,
    brightness: 4
  }).then(img => {
    document.getElementById('c').getContext('2d').putImageData(img, 0, 0);
  });
</script>
```

### Node.js
```bash
npm install canvas
node fractal-flame-node-example.js output.png
```

## Basic API

### Create Generator
```javascript
const gen = new FractalFlameGenerator();
```

### Add Transform
```javascript
gen.addTransform({
  affine: [a, b, c, d, e, f],     // Default: [1,0,0,0,1,0]
  variations: { var1: w1, var2: w2 },  // Default: {linear: 1}
  color: 0.5,                     // 0-1, Default: random
  weight: 1.0                     // Default: 1
});
```

### Affine Coefficients [a,b,c,d,e,f]
```
x' = a*x + b*y + c
y' = d*x + e*y + f

Identity: [1, 0, 0, 0, 1, 0]
Scale 0.5: [0.5, 0, 0, 0, 0.5, 0]
Rotate 90°: [0, -1, 0, 1, 0, 0]
Translate: [1, 0, tx, 0, 1, ty]
```

### Camera
```javascript
gen.setCamera(centerX, centerY, zoom, rotation);
// Default: (0, 0, 1, 0)
```

### Render
```javascript
const img = await gen.generateImage({
  iterations: 10000000,  // Quality (higher = better)
  width: 1024,
  height: 1024,
  gamma: 4.0,           // 2-6 typical
  brightness: 4.0,      // 1-20
  vibrancy: 1.0,        // 0.1-2
  oversample: 2         // 1, 2, or 4
});
```

### Random Flame
```javascript
gen.generateRandomFlame();  // 2-6 random transforms
gen.generateRandomFlame(4); // Exactly 4 transforms
```

### Save/Load
```javascript
const json = gen.exportJSON();
gen.importJSON(json);
```

## Common Variations

### Basic
- `linear` - No change
- `sinusoidal` - Wavy
- `spherical` - Inversion
- `swirl` - Spiral rotation
- `horseshoe` - Horseshoe shape
- `polar` - Polar coordinates

### Artistic
- `heart` - Heart shape
- `disc` - Disc patterns
- `spiral` - Logarithmic spiral
- `handkerchief` - Folds
- `diamond` - Diamond patterns
- `ex` - Complex exponential

### Julia-like
- `julia` - Basic Julia
- `julian` - Generalized Julia
- `juliascope` - Julia with sign flip

### Effects
- `blur` - Gaussian blur
- `noise` - Random noise
- `gaussian` - Gaussian distribution
- `radialBlur` - Motion blur

### Parametric
- `blob(low, high, waves)` - Blob shapes
- `pdj(a, b, c, d)` - Peter de Jong
- `rings(c)` - Ring patterns
- `fan(c, f)` - Fan shapes
- `pie(slices, rotation, thickness)` - Pie slices

## Parameter Ranges

| Parameter | Min | Typical | Max | Effect |
|-----------|-----|---------|-----|--------|
| iterations | 100K | 10M | 100M+ | Quality |
| gamma | 1 | 4 | 10 | Contrast |
| brightness | 1 | 4 | 20 | Overall brightness |
| vibrancy | 0.1 | 1 | 2 | Color saturation |
| zoom | 0.1 | 1 | 10 | Magnification |
| oversample | 1 | 2 | 4 | Anti-aliasing |

## Common Recipes

### Sierpinski Triangle
```javascript
gen.addTransform({ affine: [0.5, 0, 0, 0, 0.5, 0], variations: {linear: 1}, color: 0 });
gen.addTransform({ affine: [0.5, 0, 0.5, 0, 0.5, 0], variations: {linear: 1}, color: 0.5 });
gen.addTransform({ affine: [0.5, 0, 0.25, 0, 0.5, 0.5], variations: {linear: 1}, color: 1 });
```

### Swirl Pattern
```javascript
gen.addTransform({
  affine: [0.7, -0.3, 0, 0.3, 0.7, 0],
  variations: { swirl: 0.7, linear: 0.3 },
  color: 0.2
});
gen.addTransform({
  affine: [-0.5, 0.5, 0.5, -0.5, -0.5, 0],
  variations: { swirl: 0.8, spherical: 0.2 },
  color: 0.8
});
```

### Julia Set
```javascript
gen.addTransform({
  affine: [1, 0, 0, 0, 1, 0],
  variations: { julia: 1 },
  color: 0.3
});
gen.addTransform({
  affine: [0.8, 0.2, 0, -0.2, 0.8, 0],
  variations: { julia: 0.8, spherical: 0.2 },
  color: 0.9
});
```

### Heart Shape
```javascript
gen.addTransform({
  affine: [0.7, 0, 0, 0, 0.7, 0],
  variations: { heart: 0.8, linear: 0.2 },
  color: 0.1
});
gen.addTransform({
  affine: [-0.6, 0.3, 0, -0.3, -0.6, 0],
  variations: { heart: 0.7, sinusoidal: 0.3 },
  color: 0.5
});
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Black image | Increase brightness (10-20) |
| White/blown out | Decrease brightness, increase gamma |
| Too blurry | Increase oversample (2x or 4x) |
| Slow rendering | Reduce iterations, lower resolution |
| No details | Increase iterations, adjust gamma |
| Colors too dull | Increase vibrancy |
| Colors too bright | Decrease vibrancy |

## Performance Tips

**Fast Preview:**
- iterations: 1M
- resolution: 512x512
- oversample: 1

**Good Quality:**
- iterations: 10M
- resolution: 1024x1024
- oversample: 2

**Print Quality:**
- iterations: 50M+
- resolution: 2048x2048+
- oversample: 2-4

## Keyboard Shortcuts (Demo)

N/A - Use buttons in demo interface

## Preset Names (Demo)

- `sierpinski` - Classic triangle
- `swirl` - Swirling pattern
- `spiral` - Spiral arms
- `julia` - Julia-like fractal
- `dragon` - Dragon-like shape
- `heart` - Heart shapes
- `phoenix` - Complex multi-transform

## Formula Reference

### Polar Coordinates
```javascript
r = Math.sqrt(x*x + y*y)
θ = Math.atan2(y, x)
```

### Common Transforms
```javascript
// Rotation
const cos = Math.cos(angle);
const sin = Math.sin(angle);
affine = [cos, -sin, 0, sin, cos, 0];

// Scale
affine = [s, 0, 0, 0, s, 0];

// Translation
affine = [1, 0, tx, 0, 1, ty];

// Combined (rotate + scale)
affine = [s*cos, -s*sin, 0, s*sin, s*cos, 0];
```

## File Structure

```
fractal-flame.js              - Main library (1200 lines)
fractal-flame-demo.html       - Interactive demo
fractal-flame-test.html       - Test suite
fractal-flame-node-example.js - Node.js CLI
fractal-flame-package.json    - NPM config
FRACTAL-FLAME-README.md       - Full docs (400 lines)
FRACTAL-FLAME-SUMMARY.md      - Implementation summary
FRACTAL-FLAME-CHEATSHEET.md   - This file
```

## Example Workflow

1. **Experiment**: Open demo.html, click random until you find something interesting
2. **Refine**: Adjust gamma, brightness, quality
3. **Export**: Download PNG and JSON
4. **Modify**: Edit JSON or code to tweak parameters
5. **Re-render**: Import JSON and render at high quality
6. **Batch**: Use Node.js to generate variations

## Advanced Techniques

### Variation Mixing
```javascript
variations: {
  linear: 0.3,
  swirl: 0.4,
  spherical: 0.2,
  julia: 0.1
}
// Weights should sum to ~1.0
```

### Post-Transform
```javascript
gen.addTransform({
  affine: [0.7, 0, 0, 0, 0.7, 0],
  variations: { swirl: 1 },
  postAffine: [1, 0, 0.5, 0, 1, 0],  // Translate after variation
  color: 0.5
});
```

### Final Transform
```javascript
gen.setFinalTransform({
  affine: [0.9, 0, 0, 0, 0.9, 0],
  variations: { spherical: 1 }
});
```

### Custom Palette
```javascript
const palette = [];
for (let i = 0; i < 256; i++) {
  const t = i / 255;
  palette.push([
    Math.floor(255 * (1 - t)),  // R: Red to black
    0,                          // G: No green
    Math.floor(255 * t)         // B: Black to blue
  ]);
}
gen.setPalette(palette);
```

## Common Mistakes

1. **Forgetting await**: `generateImage()` is async
2. **Weights don't sum to 1**: Auto-normalized, but be aware
3. **Too many iterations**: Start small, scale up
4. **Wrong affine order**: [a,b,c,d,e,f] not [a,d,b,e,c,f]
5. **Division by zero**: Use `r + 1e-10` for safety

## Links

- Demo: Open `fractal-flame-demo.html`
- Tests: Open `fractal-flame-test.html`
- Docs: See `FRACTAL-FLAME-README.md`
- Paper: "The Fractal Flame Algorithm" by Scott Draves
- Website: https://flam3.com/

---

**Quick tip**: Start with presets, tweak parameters, export JSON, then modify and re-import!
