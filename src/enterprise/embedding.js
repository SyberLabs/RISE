/**
 * Sentence vectors for the matcher. The model returns one hidden vector per
 * token; a sentence is their mean over real tokens, scaled to unit length,
 * so two sentences compare by a dot product.
 */

export function meanPool(hidden, mask, dims) {
    const out = new Float32Array(dims);
    let kept = 0;
    for (let t = 0; t < mask.length; t += 1) {
        if (!Number(mask[t])) continue;
        kept += 1;
        for (let d = 0; d < dims; d += 1) out[d] += hidden[t * dims + d];
    }
    let norm = 0;
    for (let d = 0; d < dims; d += 1) {
        out[d] /= kept || 1;
        norm += out[d] * out[d];
    }
    norm = Math.sqrt(norm) || 1;
    for (let d = 0; d < dims; d += 1) out[d] /= norm;
    return out;
}

export function cosine(left, right) {
    let total = 0;
    for (let i = 0; i < left.length; i += 1) total += left[i] * right[i];
    return total;
}

/** Cosine onto the rail's 0-1 score scale (see EMBED_MODEL.scale). */
export function calibrate(value, { floor, ceiling }) {
    return Math.min(1, Math.max(0, (value - floor) / (ceiling - floor)));
}
