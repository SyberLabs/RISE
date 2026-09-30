/**
 * Write the readout matrix and, when the `onnx` Python package imports,
 * an ONNX Gemm of that same matrix. The JavaScript module remains the
 * source of the coefficients.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIMENSIONS } from '../../src/affect/dimensions.js';
import { FEATURE_NAMES } from '../../src/affect/text/features.js';
import { READOUT } from '../../src/affect/text/readout.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'src/affect/text');
const tensorPath = join(outDir, 'readout-tensor.json');
const onnxPath = join(outDir, 'readout.onnx');

const weights = FEATURE_NAMES.map((_, feature) =>
    DIMENSIONS.map(dimension => READOUT[dimension.id].weights[feature])
);
const bias = DIMENSIONS.map(dimension => READOUT[dimension.id].bias);
const tensor = {
    id: 'contextual-window-v1',
    trained: false,
    featureNames: FEATURE_NAMES,
    dimensionIds: DIMENSIONS.map(dimension => dimension.id),
    weights,
    bias,
    note: 'Unfitted linear prior. Gemm input is the contextual feature vector, not raw text.'
};

mkdirSync(outDir, { recursive: true });
writeFileSync(tensorPath, `${JSON.stringify(tensor)}\n`);

const python = spawnSync('python3', [
    join(root, 'scripts/affect/export_onnx.py'),
    tensorPath,
    onnxPath
], { encoding: 'utf8' });

if (python.status !== 0) {
    console.log(JSON.stringify({
        tensor: tensorPath,
        onnx: null,
        status: 'python-onnx-unavailable',
        stderr: (python.stderr || python.stdout || '').slice(0, 500)
    }, null, 2));
    process.exit(0);
}

console.log(JSON.stringify({ tensor: tensorPath, onnx: onnxPath, status: 'written' }, null, 2));
