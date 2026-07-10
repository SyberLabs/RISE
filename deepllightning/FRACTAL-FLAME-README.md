# Fractal Flame Generator

A complete JavaScript implementation of the **Fractal Flame Algorithm** invented by Scott Draves in 1992. This creates organic, flame-like fractal images using iterated function systems (IFS) with non-linear variations, log-density display, and structural coloring.

## Features

- **35+ Variation Functions**: Linear, Sinusoidal, Spherical, Swirl, Julia, Heart, Spiral, and many more
- **Log-Density Rendering**: Reveals intricate details through tone mapping
- **Structural Coloring**: Beautiful color gradients based on transform selection
- **Camera Controls**: Pan, zoom, and rotate your view
- **Customizable Palettes**: 256-color gradients for vibrant rendering
- **Import/Export**: Save and load flame parameters as JSON
- **Random Generation**: Create unique fractals with one click
- **High Resolution**: Render up to 2048x2048 (or higher)
- **Anti-Aliasing**: Oversampling for smooth, high-quality output
- **Browser-Based**: Pure JavaScript with HTML5 Canvas rendering

## Quick Start

### Browser Usage

1. Open [fractal-flame-demo.html](fractal-flame-demo.html) in a modern web browser
2. Click "Generate Random Flame" or choose a preset
3. Adjust render settings (quality, gamma, brightness)
4. Click "Render Flame" to generate the image
5. Download your creation as PNG

### Programmatic Usage

```javascript
// Create generator
const generator = new FractalFlameGenerator();

// Add transforms (functions)
generator.addTransform({
  affine: [0.5, 0, 0, 0, 0.5, 0],        // Affine coefficients [a,b,c,d,e,f]
  variations: { linear: 0.7, swirl: 0.3 }, // Weighted variation mix
  color: 0.5,                              // Color index (0-1)
  weight: 1.0                              // Selection probability
});

generator.addTransform({
  affine: [-0.5, 0.5, 0.5, -0.5, -0.5, 0],
  variations: { spherical: 0.5, julia: 0.5 },
  color: 0.9,
  weight: 1.0
});

// Set camera
generator.setCamera(0, 0, 1, 0); // centerX, centerY, zoom, rotation

// Generate image
const imageData = await generator.generateImage({
  iterations: 10000000,  // 10 million iterations (higher = better quality)
  width: 1024,
  height: 1024,
  gamma: 4.0,           // Gamma correction (2-6 typical)
  brightness: 4.0,      // Overall brightness
  vibrancy: 1.0,        // Color saturation
  oversample: 2         // Anti-aliasing (2x or 4x)
});

// Render to canvas
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
ctx.putImageData(imageData, 0, 0);
```

## Algorithm Overview

### 1. Iterated Function System (IFS)

The fractal flame algorithm uses a chaos game with multiple transform functions:

```
For millions of iterations:
  1. Select random transform Fi based on weights
  2. Apply affine transformation: (x',y') = affine(x, y)
  3. Apply weighted sum of variations: (x'',y'') = Σ wk * Vk(x', y')
  4. Optional: Apply post-affine and final transform
  5. Accumulate point in histogram with color
```

### 2. Transform Structure

Each transform `Fi` consists of:

- **Affine coefficients** [a, b, c, d, e, f]:
  ```
  x' = a*x + b*y + c
  y' = d*x + e*y + f
  ```

- **Variation weights**: Non-linear distortion functions (see below)
- **Color index**: For structural coloring (0 to 1)
- **Selection weight**: Probability of choosing this transform

### 3. Variation Functions

Variations are non-linear transformations applied after the affine. Some examples:

| Variation | Formula | Effect |
|-----------|---------|--------|
| Linear | `[x, y]` | Identity (no change) |
| Sinusoidal | `[sin(x), sin(y)]` | Wavy distortion |
| Spherical | `[x/r², y/r²]` | Inversion through sphere |
| Swirl | Rotates points based on distance | Creates spiraling effect |
| Julia | `sqrt(r) * [cos(θ/2), sin(θ/2)]` | Julia set-like features |
| Heart | `r * [sin(θ*r), -cos(θ*r)]` | Heart-shaped distortion |

The library includes 35+ variations. See [fractal-flame.js](fractal-flame.js) for complete formulas.

### 4. Rendering (Tone Mapping)

After accumulating points in a density histogram:

```
1. Log-density mapping: logD = log(density + 1)
2. Normalize: normalized = logD / max(logD)
3. Gamma correction: alpha = normalized^(1/gamma)
4. Apply color from palette
5. Final pixel = color * alpha * brightness
```

This reveals details in both high and low-density areas.

## API Reference

### FractalFlameGenerator Class

#### Constructor
```javascript
const generator = new FractalFlameGenerator();
```

#### Methods

**`addTransform(transform)`**
Add an IFS transform function.

Parameters:
- `transform.affine`: Array `[a, b, c, d, e, f]` (default: `[1,0,0,0,1,0]`)
- `transform.variations`: Object `{ variationName: weight }` (default: `{linear: 1}`)
- `transform.color`: Number 0-1 (default: random)
- `transform.weight`: Selection probability (default: 1.0)
- `transform.postAffine`: Optional second affine (default: null)
- `transform.params`: Variation-specific parameters (default: `{}`)

**`setFinalTransform(transform)`**
Set optional final transform applied to all iterations.

**`setCamera(centerX, centerY, zoom, rotation)`**
Set viewport parameters.
- `centerX`, `centerY`: World coordinates of center
- `zoom`: Zoom level (1.0 = default)
- `rotation`: Rotation in radians

**`setPalette(palette)`**
Set color palette (array of 256 RGB arrays).

**`async generateImage(options)`**
Generate fractal flame image.

Options:
- `iterations`: Number of chaos game iterations (default: 10000000)
- `width`, `height`: Output resolution (default: 1024)
- `gamma`: Gamma correction 1-10 (default: 4.0)
- `brightness`: Brightness multiplier (default: 4.0)
- `vibrancy`: Color saturation (default: 1.0)
- `oversample`: Anti-aliasing 1-4 (default: 2)
- `skipIterations`: Initial iterations to skip (default: 20)

Returns: `ImageData` object for canvas rendering

**`generateRandomFlame(numTransforms)`**
Generate random flame with 2-6 transforms.

**`clearTransforms()`**
Remove all transforms.

**`exportJSON()`**
Export flame parameters as JSON string.

**`importJSON(json)`**
Import flame parameters from JSON string.

## Variation Reference

### Basic Variations

| Name | Parameters | Description |
|------|------------|-------------|
| `linear` | - | Identity (no distortion) |
| `sinusoidal` | - | Sine wave distortion |
| `spherical` | - | Inversion through unit sphere |
| `swirl` | - | Rotation based on distance |
| `horseshoe` | - | Horseshoe-shaped distortion |
| `polar` | - | Converts to polar coordinates |

### Artistic Variations

| Name | Parameters | Description |
|------|------------|-------------|
| `handkerchief` | - | Handkerchief-like folds |
| `heart` | - | Heart-shaped distortion |
| `disc` | - | Disc-like patterns |
| `spiral` | - | Logarithmic spiral |
| `diamond` | - | Diamond-shaped patterns |
| `ex` | - | Complex exponential-like |

### Julia Set Variations

| Name | Parameters | Description |
|------|------------|-------------|
| `julia` | - | Basic Julia set mapping |
| `julian` | `power`, `dist` | Generalized Julia |
| `juliascope` | `power`, `dist` | Julia with random sign |

### Parametric Variations

| Name | Parameters | Description |
|------|------------|-------------|
| `blob` | `low`, `high`, `waves` | Blob-like distortions |
| `pdj` | `a`, `b`, `c`, `d` | Peter de Jong attractor |
| `rings` | `ringsC` | Ring-like patterns |
| `fan` | `fanC`, `fanF` | Fan-like shapes |
| `perspective` | `angle`, `dist` | Perspective projection |
| `pie` | `slices`, `rotation`, `thickness` | Pie slice patterns |

### Blur/Noise Variations

| Name | Parameters | Description |
|------|------------|-------------|
| `blur` | - | Gaussian blur effect |
| `gaussian` | - | Gaussian random distribution |
| `noise` | - | Random noise |
| `radialBlur` | `angle` | Motion blur effect |

See [fractal-flame.js](fractal-flame.js) for complete formulas and additional variations.

## Example Flames

### Sierpinski Triangle
```javascript
generator.addTransform({
  affine: [0.5, 0, 0, 0, 0.5, 0],
  variations: { linear: 1 },
  color: 0,
  weight: 1
});
generator.addTransform({
  affine: [0.5, 0, 0.5, 0, 0.5, 0],
  variations: { linear: 1 },
  color: 0.5,
  weight: 1
});
generator.addTransform({
  affine: [0.5, 0, 0.25, 0, 0.5, 0.5],
  variations: { linear: 1 },
  color: 1,
  weight: 1
});
```

### Swirling Flame
```javascript
generator.addTransform({
  affine: [0.7, -0.3, 0, 0.3, 0.7, 0],
  variations: { swirl: 0.7, linear: 0.3 },
  color: 0.2,
  weight: 1
});
generator.addTransform({
  affine: [-0.5, 0.5, 0.5, -0.5, -0.5, 0],
  variations: { swirl: 0.8, spherical: 0.2 },
  color: 0.8,
  weight: 1
});
```

### Complex Julia-like Fractal
```javascript
generator.addTransform({
  affine: [1, 0, 0, 0, 1, 0],
  variations: { julia: 0.6, spherical: 0.4 },
  color: 0.3,
  weight: 1
});
generator.addTransform({
  affine: [0.8, 0.2, 0, -0.2, 0.8, 0],
  variations: { julia: 0.8, sinusoidal: 0.2 },
  color: 0.9,
  weight: 1
});
```

## Performance Optimization

### Tips for Faster Rendering

1. **Lower iterations for preview**: Use 100K-1M iterations for quick previews
2. **Reduce resolution**: Start with 512x512, increase for final render
3. **Disable oversampling**: Set `oversample: 1` for faster rendering
4. **Use simpler variations**: Linear and sinusoidal are faster than complex ones

### For Production

- **High quality**: 10M-100M iterations
- **Large prints**: 2048x2048 or higher resolution
- **Fine details**: `oversample: 2` or `4`
- **Optimal gamma**: Try values 3-6 for best detail

### Future Optimizations

Potential improvements (not yet implemented):

1. **Web Workers**: Parallelize iteration across CPU cores
2. **WebGL**: GPU-accelerated rendering for 10-100x speedup
3. **Incremental rendering**: Show progressive updates
4. **WASM**: Compile critical loops for native performance
5. **Adaptive sampling**: Focus iterations on interesting areas

## Mathematical Background

### Affine Transformations

An affine transformation is a linear mapping:

```
[ x' ]   [ a  b ] [ x ]   [ c ]
[ y' ] = [ d  e ] [ y ] + [ f ]
```

Where:
- `a, e`: Scale
- `b, d`: Shear/rotation
- `c, f`: Translation

For rotation by angle θ with scale s:
```
a = s * cos(θ)
b = -s * sin(θ)
d = s * sin(θ)
e = s * cos(θ)
```

### Chaos Game

The chaos game generates points by:
1. Starting with random point P₀
2. For each iteration: P_{i+1} = F_j(P_i) where j is randomly chosen
3. Accumulating points after initial convergence period

The resulting set is the **attractor** of the IFS.

### Structural Coloring

Each transform has a color index c_i. During iteration:
```
color_{n+1} = (color_n + c_i) / 2
```

This creates smooth color gradients based on the sequence of transforms visited.

### Log-Density Mapping

Raw density histograms have extreme dynamic range. Log mapping compresses this:
```
display = log(density + 1)
```

This reveals both bright and dim features. Gamma correction further adjusts contrast.

## Browser Compatibility

Requires modern browser with:
- HTML5 Canvas
- ES6+ JavaScript (classes, async/await, typed arrays)
- Tested on: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## Node.js Usage

For server-side rendering, use `node-canvas`:

```javascript
const { createCanvas, ImageData } = require('canvas');
const { FractalFlameGenerator } = require('./fractal-flame.js');

const generator = new FractalFlameGenerator();
generator.generateRandomFlame();

const imageData = await generator.generateImage({
  iterations: 10000000,
  width: 1024,
  height: 1024
});

// Convert to PNG
const canvas = createCanvas(1024, 1024);
const ctx = canvas.getContext('2d');
ctx.putImageData(imageData, 0, 0);

const fs = require('fs');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('output.png', buffer);
```

## Credits and References

### Original Algorithm
- **Scott Draves** - Fractal Flame Algorithm (1992)
- Paper: "The Fractal Flame Algorithm" (2003)
- Website: https://flam3.com/

### Software Inspiration
- **Apophysis** - Popular fractal flame editor (Windows)
- **flam3** - Original C implementation
- **Electric Sheep** - Distributed fractal flame renderer

### Implementation
This is a clean-room implementation based on the published algorithm and mathematics, with no code copied from existing flame renderers.

## License

This implementation is provided as-is for educational and creative purposes. Feel free to use, modify, and extend it for your projects.

## Extending the Library

### Adding New Variations

Add to the `VARIATIONS` object in [fractal-flame.js](fractal-flame.js):

```javascript
VARIATIONS.myVariation = (x, y, transform) => {
  // Your math here
  const r = Math.sqrt(x * x + y * y);
  const theta = Math.atan2(y, x);

  return {
    x: /* your formula */,
    y: /* your formula */
  };
};
```

### Custom Palettes

Create palette from gradient stops:

```javascript
function createGradientPalette(stops) {
  // stops: [[pos, r, g, b], ...]
  const palette = [];
  for (let i = 0; i < 256; i++) {
    const pos = i / 255;
    // Interpolate between stops
    const color = interpolateColor(pos, stops);
    palette.push(color);
  }
  return palette;
}

generator.setPalette(createGradientPalette([
  [0.0, 255, 0, 0],     // Red
  [0.5, 255, 255, 0],   // Yellow
  [1.0, 0, 0, 255]      // Blue
]));
```

### Symmetry

For rotational symmetry, modify the iteration loop to plot multiple rotated copies:

```javascript
for (let sym = 0; sym < symmetry; sym++) {
  const angle = (2 * Math.PI * sym) / symmetry;
  const rx = x * Math.cos(angle) - y * Math.sin(angle);
  const ry = x * Math.sin(angle) + y * Math.cos(angle);
  // Plot (rx, ry)
}
```

## Troubleshooting

**Problem**: Blank or mostly black image
- **Solution**: Increase brightness (try 10-20)
- **Solution**: Check gamma (try 2-4)
- **Solution**: Increase iterations

**Problem**: Image is all white/blown out
- **Solution**: Decrease brightness
- **Solution**: Increase gamma
- **Solution**: Check camera zoom (try zoom=1)

**Problem**: Slow rendering
- **Solution**: Reduce iterations (try 1M for preview)
- **Solution**: Lower resolution
- **Solution**: Use fewer/simpler variations

**Problem**: Blocky/pixelated output
- **Solution**: Increase resolution
- **Solution**: Enable oversampling (2x or 4x)

**Problem**: No variation visible
- **Solution**: Increase variation weights
- **Solution**: Try different variation combinations
- **Solution**: Adjust affine coefficients

## Gallery Ideas

Try these parameter combinations:

1. **Fire**: Multiple swirl + linear variations with red-orange palette
2. **Ice**: Spherical + julia variations with blue-white palette
3. **Electric**: High disc + spiral with bright cyan-purple palette
4. **Organic**: Heart + handkerchief with earth tones
5. **Geometric**: Pure linear with triangle/square symmetry
6. **Psychedelic**: Mix 4+ variations with rainbow palette

Experiment and discover your own!

---

**Happy fractal generating!** 🔥

For questions, issues, or contributions, please refer to the source code documentation.
