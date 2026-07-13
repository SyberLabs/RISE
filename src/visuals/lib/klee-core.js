/**
 * Klee core — pure, environment-free functions shared by the KleeEngine
 * (sync fallback paths) and its worker (module worker entry). One
 * implementation of the seeded RNG, marching-squares contour analysis,
 * and grain texture, so fixes land everywhere at once.
 */

export function hashSeed(seed) {
    const text = String(seed ?? 'klee');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function createSeededRandom(seed) {
    let state = hashSeed(seed) || 0x6d2b79f5;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function pointKey(point) {
    return `${point[0].toFixed(4)},${point[1].toFixed(4)}`;
}

function connectSegments(segments) {
    const adjacency = new Map();
    segments.forEach((segment, index) => {
        for (const point of segment) {
            const key = pointKey(point);
            if (!adjacency.has(key)) adjacency.set(key, []);
            adjacency.get(key).push(index);
        }
    });

    const used = new Set();
    const contours = [];
    for (let start = 0; start < segments.length; start++) {
        if (used.has(start)) continue;
        used.add(start);
        const contour = [segments[start][0], segments[start][1]];
        let guard = segments.length;
        while (guard-- > 0) {
            const key = pointKey(contour[contour.length - 1]);
            const nextIndex = (adjacency.get(key) || []).find(index => !used.has(index));
            if (nextIndex === undefined) break;
            used.add(nextIndex);
            const [a, b] = segments[nextIndex];
            contour.push(pointKey(a) === key ? b : a);
        }
        if (contour.length > 4) contours.push(contour);
    }
    return contours;
}

/**
 * Marching squares over a density grid → smooth contour forms.
 * @param {Float32Array|number[]} field - gridResolution² density values
 * @returns {{forms: Array<{contour, centerX, centerY, type}>}}
 */
export function analyzeDensityGrid(field, gridResolution, width, height, threshold = 3) {
    const cellWidth = width / gridResolution;
    const cellHeight = height / gridResolution;
    const segments = [];
    const lookup = [
        [], [['l', 'b']], [['b', 'r']], [['l', 'r']],
        [['t', 'r']], [['t', 'b'], ['l', 'b']], [['t', 'b']], [['t', 'l']],
        [['t', 'l']], [['t', 'b']], [['t', 'r'], ['l', 'b']], [['t', 'r']],
        [['l', 'r']], [['b', 'r']], [['l', 'b']], []
    ];

    for (let y = 0; y < gridResolution - 1; y++) {
        for (let x = 0; x < gridResolution - 1; x++) {
            const tl = field[y * gridResolution + x] >= threshold ? 1 : 0;
            const tr = field[y * gridResolution + x + 1] >= threshold ? 1 : 0;
            const br = field[(y + 1) * gridResolution + x + 1] >= threshold ? 1 : 0;
            const bl = field[(y + 1) * gridResolution + x] >= threshold ? 1 : 0;
            const index = tl * 8 + tr * 4 + br * 2 + bl;
            if (index === 0 || index === 15) continue;
            const points = {
                t: [(x + 0.5) * cellWidth, y * cellHeight],
                r: [(x + 1) * cellWidth, (y + 0.5) * cellHeight],
                b: [(x + 0.5) * cellWidth, (y + 1) * cellHeight],
                l: [x * cellWidth, (y + 0.5) * cellHeight]
            };
            for (const [from, to] of lookup[index]) segments.push([points[from], points[to]]);
        }
    }

    const forms = connectSegments(segments).map(contour => ({
        contour,
        centerX: contour.reduce((sum, point) => sum + point[0], 0) / contour.length,
        centerY: contour.reduce((sum, point) => sum + point[1], 0) / contour.length,
        type: 'smooth'
    }));
    return { forms };
}

/**
 * Seeded monochrome grain tile bytes (RGBA), ready for ImageData.
 */
export function buildTextureBytes(seed, size, intensity) {
    const random = createSeededRandom(seed);
    const pixels = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < pixels.length; i += 4) {
        const value = random() > 0.5 ? 255 : 0;
        pixels[i] = value;
        pixels[i + 1] = value;
        pixels[i + 2] = value;
        pixels[i + 3] = Math.round(random() * intensity * 255);
    }
    return pixels;
}
