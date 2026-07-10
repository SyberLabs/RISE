# Fractal Flame Generator - Complete Package

## 🔥 What Is This?

A complete, from-scratch JavaScript implementation of the **Fractal Flame Algorithm** (Scott Draves, 1992) - the algorithm that powers Apophysis and Electric Sheep. Creates stunning, organic fractal images using iterated function systems with non-linear variations.

## 📁 Files in This Package

### Core Implementation
| File | Size | Purpose |
|------|------|---------|
| **[fractal-flame.js](fractal-flame.js)** | ~1200 lines | Main library - all the math and rendering |

### Interactive Demos
| File | Purpose |
|------|---------|
| **[fractal-flame-demo.html](fractal-flame-demo.html)** | Full-featured editor with presets, controls, export |
| **[fractal-flame-test.html](fractal-flame-test.html)** | Automated test suite with visual verification |

### Server-Side
| File | Purpose |
|------|---------|
| **[fractal-flame-node-example.js](fractal-flame-node-example.js)** | Node.js CLI for batch rendering |
| **[fractal-flame-package.json](fractal-flame-package.json)** | NPM package configuration |

### Documentation
| File | Lines | Purpose |
|------|-------|---------|
| **[FRACTAL-FLAME-README.md](FRACTAL-FLAME-README.md)** | ~400 | Complete documentation and API reference |
| **[FRACTAL-FLAME-SUMMARY.md](FRACTAL-FLAME-SUMMARY.md)** | ~200 | Implementation summary and highlights |
| **[FRACTAL-FLAME-CHEATSHEET.md](FRACTAL-FLAME-CHEATSHEET.md)** | ~150 | Quick reference guide |
| **FRACTAL-FLAME-INDEX.md** | This file | Package overview and getting started |

## 🚀 Getting Started (3 Options)

### Option 1: Interactive Demo (Easiest!)
1. Open **[fractal-flame-demo.html](fractal-flame-demo.html)** in any modern browser
2. Click "Generate Random Flame" or choose a preset
3. Adjust parameters (gamma, brightness, quality)
4. Click "Render Flame"
5. Download your creation as PNG!

**No installation required!**

### Option 2: Embed in Your Web App
```html
<script src="fractal-flame.js"></script>
<canvas id="myCanvas" width="800" height="800"></canvas>
<script>
  const gen = new FractalFlameGenerator();
  gen.generateRandomFlame();

  gen.generateImage({
    iterations: 10000000,
    width: 800,
    height: 800,
    gamma: 4,
    brightness: 4
  }).then(imageData => {
    const ctx = document.getElementById('myCanvas').getContext('2d');
    ctx.putImageData(imageData, 0, 0);
  });
</script>
```

### Option 3: Node.js Server-Side Rendering
```bash
# Install canvas library
npm install canvas

# Generate single image
node fractal-flame-node-example.js output.png phoenix

# Batch generate 10 random images
node fractal-flame-node-example.js batch 10
```

## 📚 Documentation Guide

**New user?** Start here:
1. ✅ Open [fractal-flame-demo.html](fractal-flame-demo.html) - Play with presets
2. ✅ Read [FRACTAL-FLAME-CHEATSHEET.md](FRACTAL-FLAME-CHEATSHEET.md) - Quick recipes
3. ✅ Read [FRACTAL-FLAME-README.md](FRACTAL-FLAME-README.md) - Full documentation

**Developer?** Check out:
1. ✅ [FRACTAL-FLAME-SUMMARY.md](FRACTAL-FLAME-SUMMARY.md) - Implementation details
2. ✅ [fractal-flame.js](fractal-flame.js) - Source code (well commented)
3. ✅ [fractal-flame-test.html](fractal-flame-test.html) - Test suite

## 🎨 Features

### Algorithm
- ✅ Iterated Function System (IFS) with chaos game
- ✅ Affine transformations (6-coefficient: scale, rotate, translate, shear)
- ✅ **35+ non-linear variation functions**
- ✅ Weighted variation blending
- ✅ Log-density tone mapping
- ✅ Structural coloring (color blending based on transform sequence)
- ✅ Gamma correction for detail
- ✅ Oversampling anti-aliasing (2x, 4x)
- ✅ Camera controls (pan, zoom, rotate)
- ✅ Final transforms
- ✅ Post-affine transforms

### Variations Included (35+)
Linear, Sinusoidal, Spherical, Swirl, Horseshoe, Polar, Handkerchief, Heart, Disc, Spiral, Hyperbolic, Diamond, Ex, Julia, Bent, Waves, Fisheye, Popcorn, Exponential, Power, Cosine, Rings, Fan, Blob, PDJ, Eyefish, Bubble, Cylinder, Perspective, Noise, Julian, Juliascope, Blur, Gaussian, Radial Blur, Pie

### User Interface
- ✅ Random flame generation
- ✅ 6 preset flames
- ✅ Quality slider (100K - 100M iterations)
- ✅ Gamma, brightness, vibrancy controls
- ✅ Resolution selector (512px - 2048px+)
- ✅ Camera controls
- ✅ Export PNG
- ✅ Export/Import JSON parameters
- ✅ Beautiful gradient UI

### Technical
- ✅ Pure JavaScript (ES6+)
- ✅ No external dependencies (browser)
- ✅ Typed arrays for performance
- ✅ Async/await for responsiveness
- ✅ Browser and Node.js compatible
- ✅ ~2000 total lines (library + demo + docs)

## 🎯 Quick Examples

### Example 1: Sierpinski Triangle
```javascript
const gen = new FractalFlameGenerator();

gen.addTransform({
  affine: [0.5, 0, 0, 0, 0.5, 0],
  variations: { linear: 1 },
  color: 0
});

gen.addTransform({
  affine: [0.5, 0, 0.5, 0, 0.5, 0],
  variations: { linear: 1 },
  color: 0.5
});

gen.addTransform({
  affine: [0.5, 0, 0.25, 0, 0.5, 0.5],
  variations: { linear: 1 },
  color: 1
});

const img = await gen.generateImage({ iterations: 10000000, width: 1024, height: 1024 });
```

### Example 2: Swirling Flame
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

### Example 3: Random Generation
```javascript
gen.generateRandomFlame();  // Creates 2-6 random transforms
const img = await gen.generateImage({ iterations: 10000000, width: 1024, height: 1024 });
```

## 🧪 Testing

Open **[fractal-flame-test.html](fractal-flame-test.html)** to run:
- ✅ 9 unit tests (API, transforms, variations, colors)
- ✅ 4 visual tests (Sierpinski, Swirl, Julia, Random)
- ✅ Automatic verification with visual output

All tests should pass ✓

## 🎓 Learning Path

### Beginner (Just want pretty pictures)
1. Open `fractal-flame-demo.html`
2. Click "Generate Random Flame" until you find something cool
3. Adjust brightness/gamma to taste
4. Download PNG
5. Repeat!

### Intermediate (Want to understand)
1. Read the "Algorithm Overview" section in README
2. Try the preset flames
3. Modify a preset by tweaking affine coefficients
4. Experiment with variation weights
5. Read about individual variations

### Advanced (Want to create custom)
1. Study the mathematics in README
2. Read the source code in `fractal-flame.js`
3. Implement your own variation function
4. Create custom palettes
5. Build complex multi-transform flames from scratch

## 📊 Performance Guide

| Quality | Iterations | Resolution | Time | Use Case |
|---------|-----------|------------|------|----------|
| Preview | 1M | 512x512 | ~2s | Quick exploration |
| Good | 10M | 1024x1024 | ~20s | Sharing online |
| Great | 50M | 2048x2048 | ~2min | Wallpapers |
| Print | 100M+ | 2048x2048+ | ~5min | High-quality prints |

*Times approximate on modern hardware*

## 🐛 Troubleshooting

| Problem | Quick Fix | See |
|---------|-----------|-----|
| Black image | Increase brightness to 10-20 | Cheatsheet |
| White/blown out | Decrease brightness, increase gamma | Cheatsheet |
| Too slow | Reduce iterations or resolution | README Performance Tips |
| Blocky/pixelated | Increase resolution or oversample | README |
| Colors dull | Increase vibrancy | Cheatsheet |

Full troubleshooting guide in [FRACTAL-FLAME-README.md](FRACTAL-FLAME-README.md)

## 🔬 Technical Details

### Implementation Stats
- **Lines of Code**: ~1200 (fractal-flame.js)
- **Variations**: 35+ implemented
- **Documentation**: ~1000 lines
- **Test Coverage**: Unit + Visual tests
- **Dependencies**: 0 (browser), 1 optional (Node.js)
- **Browser Support**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

### Algorithm Complexity
- **Time**: O(N) where N = iterations
- **Space**: O(W × H) where W,H = resolution
- **Quality**: Linear with iteration count

### File Sizes
- `fractal-flame.js`: ~50 KB
- `fractal-flame-demo.html`: ~15 KB
- Total package: ~150 KB (code + docs)

## 🎨 Gallery of Presets

Try these built-in presets in the demo:

1. **Sierpinski** - Classic fractal triangle (linear variation only)
2. **Swirl** - Swirling spiral patterns (swirl + spherical)
3. **Spiral** - Logarithmic spiral arms (spiral + handkerchief)
4. **Julia** - Julia set-like fractal (julia + spherical)
5. **Dragon** - Dragon-like shape (linear + swirl + horseshoe + disc)
6. **Phoenix** - Complex organic shape (4 transforms, multiple variations)

Each demonstrates different aspects of the algorithm.

## 🚀 Extending the Library

### Add New Variation
```javascript
VARIATIONS.myVariation = (x, y, transform) => {
  const r = Math.sqrt(x * x + y * y);
  const theta = Math.atan2(y, x);

  return {
    x: r * Math.sin(theta * 2),
    y: r * Math.cos(theta * 2)
  };
};
```

### Custom Palette
```javascript
const fireGradient = [];
for (let i = 0; i < 256; i++) {
  const t = i / 255;
  fireGradient.push([
    255,
    Math.floor(255 * t),
    0
  ]);
}
gen.setPalette(fireGradient);
```

### Future Enhancements
Ideas for extension (not yet implemented):
- Web Workers for parallel rendering
- WebGL/GPU acceleration
- Symmetry groups
- Animation with keyframes
- 3D variations
- Mutation algorithms
- Advanced color mapping

See SUMMARY for details.

## 📖 Mathematical Background

The fractal flame algorithm combines:
1. **Iterated Function Systems (IFS)** - Random iteration through transform functions
2. **Chaos Game** - Stochastic point generation
3. **Non-linear Variations** - Distortions beyond affine transformations
4. **Density Estimation** - Histogram accumulation
5. **Tone Mapping** - Log-density with gamma correction
6. **Structural Coloring** - Color blending based on transform sequence

For full mathematical details, see [FRACTAL-FLAME-README.md](FRACTAL-FLAME-README.md)

## 🏆 Credits

### Original Algorithm
- **Scott Draves** - Inventor of Fractal Flame Algorithm (1992)
- Paper: "The Fractal Flame Algorithm" (2003)
- Website: https://flam3.com/

### Implementation
- This is a **clean-room implementation** based on published papers
- No code copied from Apophysis, flam3, or other renderers
- Implemented from mathematical specifications

## 📝 License

MIT License - Free to use, modify, and distribute in your projects.

## 🔗 Quick Links

### Run It
- 🎨 **[fractal-flame-demo.html](fractal-flame-demo.html)** - Start here!
- 🧪 **[fractal-flame-test.html](fractal-flame-test.html)** - Verify it works

### Learn It
- 📖 **[FRACTAL-FLAME-README.md](FRACTAL-FLAME-README.md)** - Full documentation
- 📝 **[FRACTAL-FLAME-CHEATSHEET.md](FRACTAL-FLAME-CHEATSHEET.md)** - Quick reference
- 📊 **[FRACTAL-FLAME-SUMMARY.md](FRACTAL-FLAME-SUMMARY.md)** - Implementation summary

### Code It
- 💻 **[fractal-flame.js](fractal-flame.js)** - Main library
- 🖥️ **[fractal-flame-node-example.js](fractal-flame-node-example.js)** - Node.js example

## 🎯 Next Steps

1. **Try the demo**: Open `fractal-flame-demo.html`
2. **Generate 10 random flames**: Find one you like
3. **Adjust parameters**: Tweak gamma, brightness, quality
4. **Download it**: Save as PNG
5. **Read the cheatsheet**: Learn the parameter ranges
6. **Create custom flame**: Write your own transforms
7. **Share your creation**: Tag #FractalFlame

---

**Enjoy creating beautiful fractal flames!** 🔥🎨✨

*Total package: ~2000 lines of code + documentation | MIT License | No dependencies*
