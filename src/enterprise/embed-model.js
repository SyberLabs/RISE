/**
 * What the matcher's embedder is allowed to load, and how its cosine maps onto
 * the rail's score scale.
 *
 * Every file is pinned by revision and SHA-256 and refused otherwise. The
 * runtime is the plain WebAssembly build of the onnxruntime-web in the
 * lockfile (no JSPI, no GPU), fetched from a version-pinned address and
 * checked against the lockfile copy's digest.
 *
 * `scale` was fitted on the spike benchmark (spike/kev-benchmark): the best
 * cut on the top match's cosine (0.51) lands on RAIL_POLICY.showThreshold and
 * the level quiet lines sit at (0.44) on holdThreshold.
 */

const REVISION = 'ea104dacec62c0de699686887e3f920caeb4f3e3';
const BASE = `https://huggingface.co/Xenova/bge-small-en-v1.5/resolve/${REVISION}`;

export const EMBED_MODEL = Object.freeze({
    id: 'Xenova/bge-small-en-v1.5',
    revision: REVISION,
    dims: 384,
    maxTokens: 512,
    queryPrefix: 'Represent this sentence for searching relevant passages: ',
    files: Object.freeze({
        model: Object.freeze({
            url: `${BASE}/onnx/model_quantized.onnx`,
            bytes: 34_014_426,
            sha256: '6c9c6101a956d62dfb5e7190c538226c0c5bb9cb27b651234b6df063ee7dbfe4'
        }),
        tokenizer: Object.freeze({
            url: `${BASE}/tokenizer.json`,
            bytes: 711_396,
            sha256: 'd241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66'
        }),
        tokenizerConfig: Object.freeze({
            url: `${BASE}/tokenizer_config.json`,
            bytes: 366,
            sha256: '9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3'
        })
    }),
    scale: Object.freeze({ floor: 0.363, ceiling: 0.713 })
});

export const ORT_WASM_CPU = Object.freeze({
    url: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/ort-wasm-simd-threaded.wasm',
    bytes: 14_239_897,
    sha256: '3398c10d07d229bd91b364548e130e0e51a8e5704b88c7c083ebbeb78842dee2'
});
