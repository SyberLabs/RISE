/**
 * Fit a linear probe on frozen all-MiniLM-L6-v2 embeddings.
 * Targets are the mapped PERT-EmoPair scores for this corpus.
 * The number reported is leave-one-out error. The saved weights are
 * the fit on all 24 passages and are not a claim of generalization.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline, env } from '@huggingface/transformers';
import { mapPert } from '../../src/affect/benchmark/external.js';

const scoresPath = new URL('../../docs/affect/emopair-scores.json', import.meta.url);
const outPath = new URL('../../docs/affect/minilm-probe.json', import.meta.url);

function invert(matrix) {
    const n = matrix.length;
    const work = matrix.map((row, i) => {
        const next = row.slice();
        for (let j = 0; j < n; j++) next.push(i === j ? 1 : 0);
        return next;
    });
    for (let col = 0; col < n; col++) {
        let pivot = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(work[row][col]) > Math.abs(work[pivot][col])) pivot = row;
        }
        if (Math.abs(work[pivot][col]) < 1e-10) throw new Error('Ridge system is singular');
        [work[col], work[pivot]] = [work[pivot], work[col]];
        const scale = work[col][col];
        for (let j = 0; j < work[col].length; j++) work[col][j] /= scale;
        for (let row = 0; row < n; row++) {
            if (row === col) continue;
            const factor = work[row][col];
            for (let j = 0; j < work[row].length; j++) work[row][j] -= factor * work[col][j];
        }
    }
    return work.map(row => row.slice(n));
}

function predict(weights, bias, vector) {
    let sum = bias;
    for (let i = 0; i < vector.length; i++) sum += weights[i] * vector[i];
    return sum;
}

function fit(X, y, lambda) {
    const n = X.length;
    const d = X[0].length;
    const gram = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = i; j < n; j++) {
            let dot = 1;
            for (let k = 0; k < d; k++) dot += X[i][k] * X[j][k];
            gram[i][j] = dot;
            gram[j][i] = dot;
        }
    }
    for (let i = 0; i < n; i++) gram[i][i] += lambda;
    const alpha = invert(gram).map(row => row.reduce((sum, value, i) => sum + value * y[i], 0));
    const weights = Array(d).fill(0);
    for (let i = 0; i < n; i++) {
        for (let k = 0; k < d; k++) weights[k] += X[i][k] * alpha[i];
    }
    const bias = alpha.reduce((sum, value) => sum + value, 0);
    return { weights, bias };
}

function mae(errors) {
    return errors.reduce((sum, value) => sum + Math.abs(value), 0) / errors.length;
}

const document = JSON.parse(await readFile(scoresPath, 'utf8'));
const rows = document.models['pert-emopair'].passages.map(row => ({
    id: row.id,
    target: mapPert(row.raw)
}));
env.cacheDir = process.env.RISE_HF_CACHE || join(tmpdir(), 'rise-affect-minilm');
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
const X = [];
for (const row of rows) {
    const passage = document.models['pert-emopair'].passages.find(item => item.id === row.id);
    const text = (await readPassageText(passage.id));
    const embedding = Array.from((await extractor(text, { pooling: 'mean', normalize: true })).data);
    X.push(embedding);
    row.text = text;
}

async function readPassageText(id) {
    const { CORPUS, PROBES } = await import('../../src/affect/benchmark/corpus.js');
    const found = [...CORPUS, ...PROBES].find(item => item.id === id);
    if (!found) throw new Error(`Missing passage ${id}`);
    return found.text;
}

const axes = ['valence', 'arousal', 'dominance'];
const lambdas = [0.01, 0.1, 1, 10, 100, 1000];
let best = null;
for (const lambda of lambdas) {
    const loo = rows.map(() => ({}));
    for (let held = 0; held < rows.length; held++) {
        const trainX = X.filter((_, i) => i !== held);
        for (const axis of axes) {
            const trainY = rows.filter((_, i) => i !== held).map(row => row.target[axis]);
            const fitted = fit(trainX, trainY, lambda);
            loo[held][axis] = predict(fitted.weights, fitted.bias, X[held]);
        }
    }
    const errors = {};
    for (const axis of axes) {
        errors[axis] = mae(rows.map((row, i) => loo[i][axis] - row.target[axis]));
    }
    const mean = axes.reduce((sum, axis) => sum + errors[axis], 0) / axes.length;
    if (!best || mean < best.mean) best = { lambda, loo, errors, mean };
}

const full = {};
for (const axis of axes) {
    full[axis] = fit(X, rows.map(row => row.target[axis]), best.lambda);
}

const probe = {
    modelId: 'Xenova/all-MiniLM-L6-v2',
    parameters: 22_700_000,
    head: 'linear probe, encoder frozen',
    teacher: 'edsi-umd/PERT-EmoPair',
    lambda: best.lambda,
    leaveOneOutMae: best.errors,
    leaveOneOutMaeMean: best.mean,
    caveat: 'twenty-four-passages-leave-one-out',
    weights: Object.fromEntries(axes.map(axis => [axis, {
        bias: full[axis].bias,
        coefficients: full[axis].weights
    }])),
    passages: rows.map((row, i) => ({
        id: row.id,
        target: row.target,
        loo: {
            valence: best.loo[i].valence,
            arousal: best.loo[i].arousal,
            dominance: best.loo[i].dominance
        }
    }))
};
await writeFile(outPath, `${JSON.stringify(probe, null, 2)}\n`);
console.log(JSON.stringify({
    lambda: best.lambda,
    leaveOneOutMae: best.errors,
    mean: best.mean,
    wrote: outPath.pathname
}, null, 2));
