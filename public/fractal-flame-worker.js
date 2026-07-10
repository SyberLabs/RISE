/**
 * Fractal Flame Web Worker
 * Handles parallel iteration for multi-threaded rendering
 */

// Import variations (need to duplicate or share)
let VARIATIONS = null;

// Worker receives flame parameters and generates histogram data
self.onmessage = function (e) {
    const {
        type,
        transforms,
        finalTransform,
        palette,
        camera,
        width,
        height,
        iterations,
        skipIterations,
        workerId,
        seed
    } = e.data;

    if (type === 'init') {
        // Initialize variations
        // VARIATIONS is defined at module scope
        VARIATIONS = LOCAL_VARIATIONS;

        // Debug
        // console.log('[Worker] Worker initialized. Variations loaded.');

        self.postMessage({ type: 'ready', workerId });
        return;
    }

    if (type === 'render') {
        if (!VARIATIONS) VARIATIONS = LOCAL_VARIATIONS;

        try {
            // Initialize histograms
            const histogramSize = width * height;
            const density = new Float64Array(histogramSize);
            const colorR = new Float64Array(histogramSize);
            const colorG = new Float64Array(histogramSize);
            const colorB = new Float64Array(histogramSize);

            // Seed random number generator for this worker
            let randomSeed = seed || workerId;
            function seededRandom() {
                randomSeed = (randomSeed * 9301 + 49297) % 233280;
                return randomSeed / 233280;
            }

            // Iterate
            iterateFlame(
                density, colorR, colorG, colorB,
                transforms, finalTransform, palette, camera,
                width, height, iterations, skipIterations,
                seededRandom
            );

            // Send results back
            self.postMessage({
                type: 'complete',
                workerId,
                density: density.buffer,
                colorR: colorR.buffer,
                colorG: colorG.buffer,
                colorB: colorB.buffer
            }, [density.buffer, colorR.buffer, colorG.buffer, colorB.buffer]); // Transfer ownership

        } catch (error) {
            self.postMessage({
                type: 'error',
                workerId,
                error: error.message
            });
        }
    }
};

function iterateFlame(density, colorR, colorG, colorB, transforms, finalTransform,
    palette, camera, width, height, iterations, skipIterations, random) {
    // Start with random point
    let x = random() * 4 - 2;
    let y = random() * 4 - 2;
    let color = random();

    // Precompute cumulative probabilities
    const cumulativeProbs = [];
    let sum = 0;
    for (const t of transforms) {
        sum += t.weight;
        cumulativeProbs.push(sum);
    }

    for (let i = 0; i < iterations + skipIterations; i++) {
        // Select random transform based on weights
        const rand = random() * sum;
        let transformIndex = 0;
        for (let j = 0; j < cumulativeProbs.length; j++) {
            if (rand < cumulativeProbs[j]) {
                transformIndex = j;
                break;
            }
        }

        const transform = transforms[transformIndex];

        // Apply transform
        const result = applyTransform(x, y, transform, random);
        x = result.x;
        y = result.y;

        // Apply final transform if defined
        if (finalTransform) {
            const finalResult = applyTransform(x, y, finalTransform, random);
            x = finalResult.x;
            y = finalResult.y;
        }

        // Update color
        color = (color + transform.color) / 2;

        // Skip initial iterations
        if (i < skipIterations) continue;

        // Apply symmetry if enabled
        const points = applySymmetry(x, y, transform.symmetry);

        for (const point of points) {
            // Project to screen coordinates
            const coords = worldToScreen(point.x, point.y, camera, width, height);

            if (coords.px >= 0 && coords.px < width && coords.py >= 0 && coords.py < height) {
                const idx = coords.py * width + coords.px;

                // Accumulate density
                density[idx] += 1;

                // Accumulate color
                const paletteColor = getPaletteColor(color, palette);
                colorR[idx] += paletteColor[0];
                colorG[idx] += paletteColor[1];
                colorB[idx] += paletteColor[2];
            }
        }
    }
}

function applyTransform(x, y, transform, random) {
    // Step 1: Apply pre-affine transformation
    const [a, b, c, d, e, f] = transform.affine;
    const affineX = a * x + b * y + c;
    const affineY = d * x + e * y + f;

    // Step 2: Apply weighted sum of variations
    let resultX = 0;
    let resultY = 0;

    for (const [variationName, weight] of Object.entries(transform.variations)) {
        if (weight === 0) continue;

        const variation = getVariation(variationName);
        const varResult = variation(affineX, affineY, transform, random);

        resultX += weight * varResult.x;
        resultY += weight * varResult.y;
    }

    // Step 3: Apply post-affine if defined
    if (transform.postAffine) {
        const [pa, pb, pc, pd, pe, pf] = transform.postAffine;
        const postX = pa * resultX + pb * resultY + pc;
        const postY = pd * resultX + pe * resultY + pf;
        return { x: postX, y: postY };
    }

    return { x: resultX, y: resultY };
}

function applySymmetry(x, y, symmetry) {
    if (!symmetry || symmetry <= 1) {
        return [{ x, y }];
    }

    const points = [];
    for (let i = 0; i < symmetry; i++) {
        const angle = (2 * Math.PI * i) / symmetry;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        points.push({
            x: x * cos - y * sin,
            y: x * sin + y * cos
        });
    }
    return points;
}

function getVariation(name) {
    return VARIATIONS[name] || VARIATIONS.linear;
}

function worldToScreen(x, y, camera, width, height) {
    const { centerX, centerY, zoom, rotation } = camera;

    let wx = x - centerX;
    let wy = y - centerY;

    if (rotation !== 0) {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const rx = wx * cos - wy * sin;
        const ry = wx * sin + wy * cos;
        wx = rx;
        wy = ry;
    }

    const sx = (wx * zoom + 1) * width / 2;
    const sy = (wy * zoom + 1) * height / 2;

    return {
        px: Math.floor(sx),
        py: Math.floor(sy)
    };
}

function getPaletteColor(colorIndex, palette) {
    const index = Math.floor(colorIndex * 255) % 256;
    return palette[index];
}

// INLINED VARIATIONS FOR WORKER CONTEXT
const LOCAL_VARIATIONS = {
    linear: (x, y) => ({ x, y }),
    sinusoidal: (x, y) => ({ x: Math.sin(x), y: Math.sin(y) }),
    spherical: (x, y) => { const r2 = x * x + y * y + 1e-10; return { x: x / r2, y: y / r2 }; },
    swirl: (x, y) => { const r2 = x * x + y * y; return { x: x * Math.sin(r2) - y * Math.cos(r2), y: x * Math.cos(r2) + y * Math.sin(r2) }; },
    horseshoe: (x, y) => { const r = Math.sqrt(x * x + y * y) + 1e-10; return { x: (x - y) * (x + y) / r, y: 2 * x * y / r }; },
    polar: (x, y) => { const r = Math.sqrt(x * x + y * y), th = Math.atan2(y, x); return { x: th / Math.PI, y: r - 1 }; },
    handkerchief: (x, y) => { const r = Math.sqrt(x * x + y * y), th = Math.atan2(y, x); return { x: r * Math.sin(th + r), y: r * Math.cos(th - r) }; },
    heart: (x, y) => { const r = Math.sqrt(x * x + y * y), th = Math.atan2(y, x); return { x: r * Math.sin(th * r), y: -r * Math.cos(th * r) }; },
    disc: (x, y) => { const r = Math.sqrt(x * x + y * y), th = Math.atan2(y, x); return { x: th / Math.PI * Math.sin(Math.PI * r), y: th / Math.PI * Math.cos(Math.PI * r) }; },
    spiral: (x, y) => { const r = Math.sqrt(x * x + y * y) + 1e-10, th = Math.atan2(y, x); return { x: (Math.cos(th) + Math.sin(r)) / r, y: (Math.sin(th) - Math.cos(r)) / r }; },
    hyperbolic: (x, y) => { const r = Math.sqrt(x * x + y * y) + 1e-10, th = Math.atan2(y, x); return { x: Math.sin(th) / r, y: r * Math.cos(th) }; },
    diamond: (x, y) => { const r = Math.sqrt(x * x + y * y), th = Math.atan2(y, x); return { x: Math.sin(th) * Math.cos(r), y: Math.cos(th) * Math.sin(r) }; },
    ex: (x, y) => { const r = Math.sqrt(x * x + y * y), th = Math.atan2(y, x); const p0 = Math.sin(th + r), p1 = Math.cos(th - r); return { x: r * (p0 * p0 * p0 + p1 * p1 * p1), y: r * (p0 * p0 * p0 - p1 * p1 * p1) }; },
    julia: (x, y, t, r) => { const sqr = Math.sqrt(Math.sqrt(x * x + y * y)), th = Math.atan2(y, x); const om = (Math.random() < 0.5 ? 0 : Math.PI); return { x: sqr * Math.cos(th / 2 + om), y: sqr * Math.sin(th / 2 + om) }; },
    bent: (x, y) => { if (x >= 0 && y >= 0) return { x, y }; if (x < 0 && y >= 0) return { x: 2 * x, y }; if (x >= 0 && y < 0) return { x, y: y / 2 }; return { x: 2 * x, y: y / 2 }; },
    waves: (x, y, t) => { const p = t.params; return { x: x + (p.b || 1) * Math.sin(y / ((p.c || 2) * (p.c || 2))), y: y + (p.e || 1) * Math.sin(x / ((p.f || 2) * (p.f || 2))) }; },
    fisheye: (x, y) => { const r = Math.sqrt(x * x + y * y) + 1e-10; return { x: 2 * y / (r + 1), y: 2 * x / (r + 1) }; },
    popcorn: (x, y, t) => { const p = t.params; return { x: x + (p.c || 1) * Math.sin(Math.tan(3 * y)), y: y + (p.f || 1) * Math.sin(Math.tan(3 * x)) }; },
    exponential: (x, y) => { const ex = Math.exp(x - 1); return { x: ex * Math.cos(Math.PI * y), y: ex * Math.sin(Math.PI * y) }; },
    power: (x, y) => { const r = Math.sqrt(x * x + y * y), th = Math.atan2(y, x); const rp = Math.pow(r, Math.sin(th)); return { x: rp * Math.cos(th), y: rp * Math.sin(th) }; },
    cosine: (x, y) => ({ x: Math.cos(Math.PI * x) * Math.cosh(y), y: -Math.sin(Math.PI * x) * Math.sinh(y) }),
    rings: (x, y, t) => { const r = Math.sqrt(x * x + y * y) + 1e-10, th = Math.atan2(y, x), val = (r + (t.params.val || 0.1)) % (2 * (t.params.val || 0.1)), f = val - (t.params.val || 0.1) + r * (1 - (t.params.val || 0.1)); return { x: f * Math.cos(th), y: f * Math.sin(th) }; },
    fan: (x, y, t) => { const r = Math.sqrt(x * x + y * y) + 1e-10, th = Math.atan2(y, x), t1 = Math.PI * (t.params.c || 0.5) * (t.params.c || 0.5), t2 = (t.params.f || 0.5); if ((th + t2) % t1 > t1 / 2) return { x: r * Math.cos(th - t1 / 2), y: r * Math.sin(th - t1 / 2) }; else return { x: r * Math.cos(th + t1 / 2), y: r * Math.sin(th + t1 / 2) }; },
    bubble: (x, y) => { const r2 = x * x + y * y + 1e-10; return { x: 4 * x / r2, y: 4 * y / r2 }; },
    cylinder: (x, y) => ({ x: Math.sin(x), y: y }),
};
