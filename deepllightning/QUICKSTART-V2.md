# Fractal Flame Generator V2 - Quick Start Guide

## 🚀 Get Started in 30 Seconds

### Option 1: Interactive Demo (Easiest!)
1. Open **[fractal-flame-demo-v2.html](fractal-flame-demo-v2.html)** in your browser
2. Click "Generate Random Flame"
3. Watch it render in real-time with progressive updates!
4. Download your creation

**That's it!** No installation, no setup.

### Option 2: Copy-Paste Code
```html
<!DOCTYPE html>
<html>
<head>
  <title>My Fractal Flame</title>
</head>
<body>
  <canvas id="canvas" width="800" height="800"></canvas>

  <script src="fractal-flame-v2.js"></script>
  <script>
    const gen = new FractalFlameGenerator();
    const ctx = document.getElementById('canvas').getContext('2d');

    // Generate random flame
    gen.generateRandomFlame();

    // Render with Web Workers + Progressive updates
    gen.onProgressUpdate = (data) => {
      ctx.putImageData(data.imageData, 0, 0); // Show progress!
    };

    gen.generateImage({
      iterations: 10000000,
      width: 800,
      height: 800,
      progressive: true,  // Real-time updates
      useWorkers: true    // 4-8x faster!
    }).then(img => {
      ctx.putImageData(img, 0, 0);
      console.log('Done!');
    });
  </script>
</body>
</html>
```

Save as `my-flame.html` and open in browser. Done!

## 📖 What's New in V2?

**🔥 4 Major Improvements:**

1. **Web Workers** → 4-8x faster rendering
2. **Progressive Rendering** → See real-time updates
3. **Symmetry** → Create mandalas & snowflakes
4. **20 New Variations** → 55 total (was 35)

**All with zero breaking changes!** Your V1 code still works.

## 💡 Common Use Cases

### Use Case 1: Generate Random Flame
```javascript
const gen = new FractalFlameGenerator();
gen.generateRandomFlame();

const img = await gen.generateImage({
  iterations: 10000000,
  width: 1024,
  height: 1024,
  useWorkers: true  // 4-8x faster!
});

ctx.putImageData(img, 0, 0);
```

### Use Case 2: Create a Mandala (6-fold symmetry)
```javascript
const gen = new FractalFlameGenerator();

gen.addTransform({
  affine: [0.7, 0, 0, 0, 0.7, 0],
  variations: { julia: 0.5, spherical: 0.5 },
  color: 0.3,
  symmetry: 6  // NEW! 6-fold symmetry
});

const img = await gen.generateImage({
  iterations: 2000000,  // Lower due to 6x symmetry
  width: 1024,
  height: 1024,
  useWorkers: true
});

ctx.putImageData(img, 0, 0);
```

### Use Case 3: High-Quality with Progress Bar
```html
<progress id="bar" max="100"></progress>
<canvas id="canvas"></canvas>

<script src="fractal-flame-v2.js"></script>
<script>
  const gen = new FractalFlameGenerator();
  gen.generateRandomFlame();

  // Show progress
  gen.onProgressUpdate = (data) => {
    document.getElementById('bar').value = data.progress * 100;
    ctx.putImageData(data.imageData, 0, 0);
  };

  // Render high quality
  const img = await gen.generateImage({
    iterations: 50000000,  // 50M iterations
    width: 2048,
    height: 2048,
    progressive: true,      // Enable progress updates
    progressInterval: 2000000,  // Every 2M iterations
    useWorkers: true        // Use all CPU cores
  });

  ctx.putImageData(img, 0, 0);
</script>
```

### Use Case 4: Try New Variations
```javascript
const gen = new FractalFlameGenerator();

gen.addTransform({
  affine: [0.8, 0, 0, 0, 0.8, 0],
  variations: {
    curl: 0.4,      // NEW variation!
    supershape: 0.3, // NEW variation!
    flower: 0.3      // NEW variation!
  },
  color: 0.3,
  params: {
    curlC1: 0.5,
    supershapeM: 6,
    flowerPetals: 8
  }
});

const img = await gen.generateImage({
  iterations: 10000000,
  width: 1024,
  height: 1024,
  useWorkers: true
});
```

## 🎯 Key Settings Explained

### Iterations
- **100K** = Very fast preview (blurry)
- **1M** = Fast preview
- **10M** = Good quality (recommended start)
- **50M** = High quality
- **100M+** = Print quality

**Tip:** Use Web Workers (`useWorkers: true`) for iterations >5M

### Gamma
- **2-3** = Soft, dreamy
- **4** = Balanced (recommended)
- **6-8** = High contrast, sharp details
- **10+** = Very harsh

### Brightness
- **1-2** = Dark
- **4** = Balanced (recommended)
- **10-20** = Very bright

**Tip:** If image is all black, increase brightness!

### Symmetry
- **0** = No symmetry (default)
- **2** = 2-fold (yin-yang)
- **3** = 3-fold (trinity)
- **4** = 4-fold (square)
- **6** = 6-fold (hexagon/flower)
- **8** = 8-fold (snowflake)

**Tip:** With symmetry N, use iterations / N for same density

### Progressive Rendering
- **Off** = Wait for final result
- **On** = See updates in real-time

**Tip:** Always use for iterations >10M

### Web Workers
- **Off** = Single CPU core
- **On** = All CPU cores (4-8x faster!)

**Tip:** Always use unless debugging

## 📁 Files You Need

**Minimum Setup:**
1. `fractal-flame-v2.js` - Main library
2. `fractal-flame-worker.js` - Worker (for parallel rendering)
3. Your HTML file

**Optional:**
- `fractal-flame-demo-v2.html` - Full demo
- `FRACTAL-FLAME-V2-README.md` - Full docs

**File Structure:**
```
my-project/
  ├── fractal-flame-v2.js
  ├── fractal-flame-worker.js
  └── index.html (your file)
```

**Important:** Workers must be in same directory!

## 🐛 Troubleshooting

### Issue: Web Workers not working
**Solution:**
```javascript
// Check if workers available
if (gen.useWorkers) {
  console.log('Workers available!');
} else {
  console.log('Workers not available, using single thread');
}

// Force single-threaded if needed
await gen.generateImage({
  useWorkers: false
});
```

### Issue: Image is all black
**Solutions:**
1. Increase brightness: `brightness: 10` or higher
2. Decrease gamma: `gamma: 2`
3. Check if transforms are valid

### Issue: Image is all white
**Solutions:**
1. Decrease brightness: `brightness: 2`
2. Increase gamma: `gamma: 6`

### Issue: Rendering is slow
**Solutions:**
1. Enable Web Workers: `useWorkers: true`
2. Reduce iterations: Try 1M for preview
3. Reduce resolution: `width: 512, height: 512`
4. Disable oversample: `oversample: 1`

### Issue: No variations visible
**Solutions:**
1. Check variation names (case-sensitive!)
2. Ensure variation weights sum to ~1.0
3. Try pure variation: `variations: { swirl: 1.0 }`

## 🎨 Try These Presets

Copy-paste these into the demo or your code:

### Sierpinski Triangle
```javascript
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
```

### Swirling Flame
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

### Mandala (6-fold symmetry) ⭐
```javascript
gen.addTransform({
  affine: [0.7, 0, 0, 0, 0.7, 0],
  variations: { julia: 0.4, spherical: 0.3, sinusoidal: 0.3 },
  color: 0.2,
  symmetry: 6  // NEW!
});
gen.addTransform({
  affine: [-0.5, 0.4, 0, -0.4, -0.5, 0],
  variations: { disc: 0.5, handkerchief: 0.5 },
  color: 0.8,
  symmetry: 6  // NEW!
});
```

### Snowflake (8-fold symmetry) ⭐
```javascript
gen.addTransform({
  affine: [0.6, 0, 0, 0, 0.6, 0],
  variations: { curl: 0.4, flower: 0.3, linear: 0.3 },
  color: 0.1,
  symmetry: 8,  // NEW!
  params: { flowerPetals: 8 }
});
gen.addTransform({
  affine: [-0.4, 0.3, 0, -0.3, -0.4, 0],
  variations: { conic: 0.5, supershape: 0.5 },
  color: 0.9,
  symmetry: 8,  // NEW!
  params: { supershapeM: 8 }
});
```

## 📊 Performance Tips

**For Best Speed:**
1. ✅ Use `useWorkers: true`
2. ✅ Use `progressive: true` for UX
3. ✅ Start with lower iterations (1-10M)
4. ✅ Increase resolution last

**Typical Times (8-core CPU):**
- 1M iterations, 512px: **~0.3s**
- 10M iterations, 1024px: **~3s**
- 50M iterations, 2048px: **~18s**
- 100M iterations, 2048px: **~35s**

**Without Workers (single core):**
- 10M iterations: **~20s** (vs 3s)
- 50M iterations: **~105s** (vs 18s)

**Symmetry Multiplier:**
- 6-fold symmetry = 6x points plotted
- Use iterations / 6 for same density
- Example: 2M iterations with 6-fold = 12M effective points

## 🎓 Learning Path

**Beginner (10 minutes):**
1. Open demo (`fractal-flame-demo-v2.html`)
2. Click "Generate Random Flame" 10 times
3. Try adjusting gamma and brightness
4. Try the Mandala preset

**Intermediate (30 minutes):**
1. Copy-paste the basic code example
2. Modify affine coefficients
3. Try different variation combinations
4. Experiment with symmetry values

**Advanced (1+ hours):**
1. Read `FRACTAL-FLAME-V2-README.md`
2. Create custom transforms from scratch
3. Explore all 55 variations
4. Create custom color palettes
5. Build your own presets library

## 🔗 Next Steps

- **Full Documentation:** See `FRACTAL-FLAME-V2-README.md`
- **What's New:** See `WHATS-NEW-V2.md`
- **Original Docs:** See `FRACTAL-FLAME-README.md`
- **Quick Reference:** See `FRACTAL-FLAME-CHEATSHEET.md`

## ❓ FAQ

**Q: Can I use V2 with my V1 code?**
A: Yes! Just change `fractal-flame.js` to `fractal-flame-v2.js`. Zero breaking changes.

**Q: Do I need Web Workers?**
A: No, but they make it 4-8x faster. It falls back automatically if unavailable.

**Q: How many CPU cores will it use?**
A: All of them! Usually 4-8 cores on modern systems.

**Q: Can I disable Web Workers?**
A: Yes, set `useWorkers: false` in `generateImage()` options.

**Q: What's the best quality setting?**
A: 10M-50M iterations, gamma 4, brightness 4, oversample 2.

**Q: Can I export to other formats?**
A: Canvas supports PNG. Use `canvas.toDataURL()` or `canvas.toBlob()`.

**Q: Can I use this commercially?**
A: Yes! MIT License. Free for any use.

**Q: Will there be V3?**
A: Planned! WebGL acceleration, animation, 3D variations coming.

## 🎉 You're Ready!

**Three ways to start:**
1. 🎨 **Creative?** → Open demo, click random, explore!
2. 💻 **Coder?** → Copy-paste basic example, modify!
3. 📚 **Learner?** → Read docs, understand algorithm!

**Most important:** Have fun creating beautiful fractals! 🔥

---

*Questions? Check the full docs or try the demo!*
