/**
 * Time the JavaScript encoder. Try the ONNX Gemm on WASM if the file
 * and runtime both load. WebGPU is not requested: the readout is small.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORPUS } from '../../src/affect/benchmark/corpus.js';
import { runReadoutSession } from '../../src/affect/inference.js';
import { encodeText } from '../../src/affect/text/encode.js';
import { extractFeatures, FEATURE_NAMES } from '../../src/affect/text/features.js';
import { linearCore } from '../../src/affect/text/readout.js';
import { DIMENSIONS } from '../../src/affect/dimensions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const texts = CORPUS.map(passage => passage.text);
const repeats = 50;
const start = performance.now();
for (let pass = 0; pass < repeats; pass += 1) {
    for (const text of texts) encodeText(text);
}
const elapsed = performance.now() - start;
const calls = texts.length * repeats;
const heap = process.memoryUsage();

const report = {
    js: {
        calls,
        ms: elapsed,
        perCallMs: elapsed / calls,
        heapUsed: heap.heapUsed
    },
    wasm: { status: 'not-run' },
    webgpu: {
        status: 'not-used',
        reason: 'The readout is a few hundred parameters. CPU JavaScript is the reliable path. WebGPU stays an acceleration option for a future transformer-class encoder.'
    }
};

const onnxPath = join(root, 'src/affect/text/readout.onnx');
if (!existsSync(onnxPath)) {
    report.wasm = { status: 'unavailable', reason: 'readout.onnx is absent' };
} else {
    try {
        const ort = await import('onnxruntime-web');
        const session = await ort.InferenceSession.create(readFileSync(onnxPath), {
            executionProviders: ['wasm']
        });
        const sample = extractFeatures(texts[0], { negate: true });
        const expected = linearCore(sample.values);
        const wasmStart = performance.now();
        let last = null;
        for (let pass = 0; pass < 20; pass += 1) {
            last = await runReadoutSession(session, sample.values, ort.Tensor);
        }
        const wasmMs = performance.now() - wasmStart;
        const maxDelta = last.available
            ? Math.max(...DIMENSIONS.map((dimension, index) =>
                Math.abs(last.values[index] - expected[dimension.id])))
            : null;
        report.wasm = {
            status: last.available ? 'ran' : 'failed',
            provider: 'wasm',
            calls: 20,
            ms: wasmMs,
            perCallMs: wasmMs / 20,
            maxAbsDeltaVersusJs: maxDelta,
            featureCount: FEATURE_NAMES.length
        };
    } catch (error) {
        report.wasm = { status: 'unavailable', reason: String(error.message || error).slice(0, 300) };
    }
}

writeFileSync(join(root, 'docs/affect/runtime-bench.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
