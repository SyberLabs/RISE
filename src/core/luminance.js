/**
 * The light a frame puts on the screen, in the terms WCAG 2.3.1 measures.
 *
 * Pure arithmetic on RGBA bytes, so the same summary can be computed in a
 * worker while a reel compiles, in a test, or on a frame already drawn. Every
 * average is taken in linear light: averaging sRGB codes would say a frame
 * that is half black and half white has a relative luminance of about 0.21,
 * when the light it emits is 0.5.
 *
 * See docs/specs/IMAGE-STREAM-SPEC.md §3.
 */

const LINEAR = new Float32Array(256);
for (let code = 0; code < 256; code++) {
    const c = code / 255;
    LINEAR[code] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

const R_WEIGHT = 0.2126;
const G_WEIGHT = 0.7152;
const B_WEIGHT = 0.0722;

/** WCAG relative luminance of one sRGB colour given as 0..255 codes. */
export function relativeLuminance(r, g, b) {
    return R_WEIGHT * LINEAR[r] + G_WEIGHT * LINEAR[g] + B_WEIGHT * LINEAR[b];
}

/**
 * WCAG's saturated-red measure for linear R, G, B in 0..1: `(R - G - B) × 320`,
 * clamped at 0, and 0 unless red is at least 80% of the light. A red flash is
 * a pair of opposing changes of more than 20 in this value.
 */
export function saturatedRedValue(r, g, b) {
    const sum = r + g + b;
    if (sum <= 0 || r / sum < 0.8) return 0;
    return Math.max(0, (r - g - b) * 320);
}

/**
 * Summarise an RGBA frame as a grid of cells, each holding its mean relative
 * luminance and saturated-red value. Transparent pixels are composited over
 * `ground` (sRGB codes), which is the Chamber's dark ground by default.
 *
 * The default grid is one cell per pixel. A coarser grid averages, so a
 * pattern finer than a cell can invert with every cell's mean unchanged; it
 * suits ordering a reel, never the flash meter, which refuses it.
 *
 * The grid never has more cells than the frame has pixels on either axis.
 */
export function summarizeFrame(rgba, width, height, {
    cols = width,
    rows = height,
    ground = [0, 0, 0]
} = {}) {
    if (!(width > 0) || !(height > 0) || rgba.length !== width * height * 4) {
        throw new RangeError(`frame dimensions ${width}×${height} do not match a buffer of ${rgba.length} bytes`);
    }
    const gridCols = Math.max(1, Math.min(width, cols | 0));
    const gridRows = Math.max(1, Math.min(height, rows | 0));
    const groundLinear = ground.map(code => LINEAR[code]);
    const luminance = new Float32Array(gridCols * gridRows);
    const red = new Float32Array(gridCols * gridRows);

    for (let row = 0; row < gridRows; row++) {
        const y0 = Math.floor(row * height / gridRows);
        const y1 = Math.floor((row + 1) * height / gridRows);
        for (let col = 0; col < gridCols; col++) {
            const x0 = Math.floor(col * width / gridCols);
            const x1 = Math.floor((col + 1) * width / gridCols);
            let sr = 0;
            let sg = 0;
            let sb = 0;
            for (let y = y0; y < y1; y++) {
                for (let x = x0; x < x1; x++) {
                    const i = (y * width + x) * 4;
                    const alpha = rgba[i + 3] / 255;
                    const keep = 1 - alpha;
                    sr += alpha * LINEAR[rgba[i]] + keep * groundLinear[0];
                    sg += alpha * LINEAR[rgba[i + 1]] + keep * groundLinear[1];
                    sb += alpha * LINEAR[rgba[i + 2]] + keep * groundLinear[2];
                }
            }
            const n = (x1 - x0) * (y1 - y0);
            const r = sr / n;
            const g = sg / n;
            const b = sb / n;
            const cell = row * gridCols + col;
            luminance[cell] = R_WEIGHT * r + G_WEIGHT * g + B_WEIGHT * b;
            red[cell] = saturatedRedValue(r, g, b);
        }
    }
    return Object.freeze({ cols: gridCols, rows: gridRows, width, height, luminance, red });
}
